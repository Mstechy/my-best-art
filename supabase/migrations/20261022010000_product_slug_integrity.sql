-- Keep public product slugs safe, normalized, and unique.
--
-- Product URLs are now slug-first for search engines, while the UUID URL is
-- retained as a compatibility alias. The old trigger only generated a slug
-- when blank and did not protect manually entered duplicates, so two sellers
-- could publish the same public path or a slug containing spaces/case changes.

CREATE OR REPLACE FUNCTION public.sanitize_product_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_slug text;
  v_suffix integer := 2;
BEGIN
  IF NEW.description IS NOT NULL THEN
    NEW.description := regexp_replace(NEW.description, '<script[^>]*>.*?</script>', '', 'gi');
    NEW.description := regexp_replace(NEW.description, '<style[^>]*>.*?</style>', '', 'gi');
    NEW.description := regexp_replace(NEW.description, '\son\w+\s*=\s*("[^"]*"|''[^'']*''|[^\s>]+)', '', 'gi');
    NEW.description := btrim(NEW.description);
  END IF;

  IF NEW.seo_slug IS NULL OR btrim(NEW.seo_slug) = '' THEN
    v_base := lower(regexp_replace(btrim(NEW.title), '[^a-z0-9]+', '-', 'gi'));
    v_base := btrim(v_base, '-');
  ELSE
    v_base := lower(regexp_replace(btrim(NEW.seo_slug), '[^a-z0-9]+', '-', 'gi'));
    v_base := btrim(v_base, '-');
  END IF;

  IF v_base = '' THEN
    v_base := 'product-' || left(NEW.id::text, 8);
  END IF;

  v_slug := v_base;
  WHILE EXISTS (
    SELECT 1
    FROM public.products
    WHERE seo_slug = v_slug
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')::uuid
  ) LOOP
    v_slug := v_base || '-' || v_suffix;
    v_suffix := v_suffix + 1;
  END LOOP;

  NEW.seo_slug := v_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_product_input ON public.products;
CREATE TRIGGER trg_sanitize_product_input
  BEFORE INSERT OR UPDATE OF title, description, seo_slug
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sanitize_product_input();

-- Normalize existing rows before enforcing uniqueness. The ordering makes the
-- first existing row keep the shortest slug and gives later duplicates a stable
-- numeric suffix. No product is deleted or made inactive.
DO $$
DECLARE
  row_item record;
  base_slug text;
  candidate text;
  suffix integer;
BEGIN
  FOR row_item IN
    SELECT id, title, seo_slug
    FROM public.products
    ORDER BY created_at NULLS FIRST, id
  LOOP
    base_slug := lower(regexp_replace(
      btrim(COALESCE(NULLIF(row_item.seo_slug, ''), row_item.title)),
      '[^a-z0-9]+', '-', 'gi'
    ));
    base_slug := btrim(base_slug, '-');
    IF base_slug = '' THEN base_slug := 'product-' || left(row_item.id::text, 8); END IF;

    candidate := base_slug;
    suffix := 2;
    WHILE EXISTS (SELECT 1 FROM public.products WHERE seo_slug = candidate AND id <> row_item.id) LOOP
      candidate := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;

    UPDATE public.products SET seo_slug = candidate WHERE id = row_item.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS products_seo_slug_unique_idx
  ON public.products (seo_slug)
  WHERE seo_slug IS NOT NULL;

NOTIFY pgrst, 'reload schema';
