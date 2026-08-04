-- ============================================================
-- PHASE 1 — Product Page & Seller Upload: Data model + validation
-- Adds columns, CHECK constraints, sanitization/slug trigger, and
-- an "active requires image" guard. Additive only — existing
-- columns, RLS, and constraints are left intact.
-- ============================================================

-- ------------------------------------------------------------
-- 1. New columns on products
-- ------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_slug            text,
  ADD COLUMN IF NOT EXISTS meta_description    text,
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS description_images  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS edit_history        jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ------------------------------------------------------------
-- 2. New column on product_images (alt text for SEO/a11y)
-- ------------------------------------------------------------
ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS alt text;

-- ------------------------------------------------------------
-- 3. CHECK constraints (idempotent, NOT VALID to avoid locking)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_title_length_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_title_length_check
      CHECK (char_length(btrim(title)) BETWEEN 3 AND 140)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_description_length_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_description_length_check
      CHECK (description IS NULL OR char_length(btrim(description)) BETWEEN 30 AND 5000)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_compare_at_price_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_compare_at_price_check
      CHECK (compare_at_price IS NULL OR compare_at_price > price)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_low_stock_threshold_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_low_stock_threshold_check
      CHECK (low_stock_threshold >= 0)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_meta_description_length_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_meta_description_length_check
      CHECK (meta_description IS NULL OR char_length(meta_description) <= 160)
      NOT VALID;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. Sanitization + slug auto-generation trigger
--    - Strips <script>/<style> and event-handler attributes
--      from description (stored-XSS prevention)
--    - Auto-generates seo_slug from title when not provided
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sanitize_product_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_base text;
  v_suffix int := 1;
BEGIN
  -- Sanitize description: remove script/style blocks and event-handler attributes
  IF NEW.description IS NOT NULL THEN
    NEW.description := regexp_replace(NEW.description, '<script[^>]*>.*?</script>', '', 'gi');
    NEW.description := regexp_replace(NEW.description, '<style[^>]*>.*?</style>', '', 'gi');
    NEW.description := regexp_replace(NEW.description, '\son\w+\s*=\s*("[^"]*"|\''[^\'']*\''|[^\s>]+)', '', 'gi');
    NEW.description := btrim(NEW.description);
  END IF;

  -- Auto-generate seo_slug from title if not provided
  IF NEW.seo_slug IS NULL OR btrim(NEW.seo_slug) = '' THEN
    v_base := lower(regexp_replace(btrim(NEW.title), '[^a-z0-9]+', '-', 'gi'));
    v_base := btrim(v_base, '-');
    v_slug := v_base;
    -- Ensure uniqueness by appending a numeric suffix if needed
    WHILE EXISTS (SELECT 1 FROM public.products WHERE seo_slug = v_slug AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')) LOOP
      v_suffix := v_suffix + 1;
      v_slug := v_base || '-' || v_suffix;
    END LOOP;
    NEW.seo_slug := v_slug;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_product_input ON public.products;
CREATE TRIGGER trg_sanitize_product_input
  BEFORE INSERT OR UPDATE OF title, description, seo_slug
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_product_input();

-- ------------------------------------------------------------
-- 5. Guard: product cannot be TRANSITIONED to 'active' without
--    title, price, and at least one image.
--    NOTE: only fires on UPDATE, not INSERT. The seller form
--    inserts a product as 'active' BEFORE uploading images, and
--    such rows are not publicly visible until is_approved = true,
--    so blocking the insert would break the existing upload flow.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_product_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_image_count int;
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF btrim(NEW.title) = '' OR NEW.price IS NULL OR NEW.price <= 0 THEN
      RAISE EXCEPTION 'Product cannot be active without a title and a positive price';
    END IF;
    SELECT count(*) INTO v_image_count
      FROM public.product_images
      WHERE product_id = NEW.id;
    IF v_image_count = 0 THEN
      RAISE EXCEPTION 'Product cannot be active without at least one image';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_product_activation ON public.products;
CREATE TRIGGER trg_guard_product_activation
  BEFORE UPDATE OF status
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_activation();

-- ------------------------------------------------------------
-- 6. Backfill seo_slug for existing rows
-- ------------------------------------------------------------
UPDATE public.products
SET seo_slug = lower(regexp_replace(btrim(title), '[^a-z0-9]+', '-', 'gi'))
WHERE seo_slug IS NULL OR btrim(seo_slug) = '';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';