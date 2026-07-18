-- ============================================================================
-- PHASE 1: Marketplace Collection Enhancements
-- Everything here is additive — no existing columns, data, or features are removed.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Extend marketplace_collections with new columns
-- --------------------------------------------------------------------------
ALTER TABLE public.marketplace_collections
  -- Hero slider settings
  ADD COLUMN IF NOT EXISTS hero_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hero_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hero_overlay_opacity real NOT NULL DEFAULT 0.45 CHECK (hero_overlay_opacity >= 0 AND hero_overlay_opacity <= 1),
  ADD COLUMN IF NOT EXISTS hero_auto_rotate_duration integer NOT NULL DEFAULT 5000 CHECK (hero_auto_rotate_duration >= 2000),
  ADD COLUMN IF NOT EXISTS hero_badge text,
  ADD COLUMN IF NOT EXISTS hero_cta_link text,
  
  -- SEO / Meta
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS meta_keywords text,
  
  -- Display settings
  ADD COLUMN IF NOT EXISTS show_in_navigation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_on_homepage boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0,
  
  -- Automatic collection
  ADD COLUMN IF NOT EXISTS is_automatic boolean NOT NULL DEFAULT false,
  
  -- Analytics (denormalized counters, updated by triggers)
  ADD COLUMN IF NOT EXISTS product_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count integer NOT NULL DEFAULT 0;

-- --------------------------------------------------------------------------
-- 2. Multi-placement support: convert single placement to JSON array
--    (We keep the old column for backward compatibility but add a new one)
-- --------------------------------------------------------------------------
ALTER TABLE public.marketplace_collections
  ADD COLUMN IF NOT EXISTS placements jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Migration helper: populate placements from existing placement column
UPDATE public.marketplace_collections
SET placements = to_jsonb(array[placement])
WHERE placements = '[]'::jsonb OR placements IS NULL;

-- --------------------------------------------------------------------------
-- 3. Collection rules for automatic product resolution
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.marketplace_collections(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN (
    'category_id', 'subcategory', 'brand', 'min_price', 'max_price',
    'min_discount', 'min_rating', 'max_rating',
    'is_featured', 'is_best_seller', 'is_trending', 'is_new_arrival',
    'is_flash_sale', 'is_popular', 'condition',
    'created_within_days', 'min_stock', 'max_stock',
    'tag', 'color', 'material'
  )),
  operator text NOT NULL DEFAULT 'equals' CHECK (operator IN (
    'equals', 'not_equals', 'contains', 'greater_than', 'less_than',
    'greater_or_equal', 'less_or_equal', 'between', 'in', 'not_in'
  )),
  value text NOT NULL,
  value_min text,       -- for between operator
  value_max text,       -- for between operator
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, field, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_collection_rules_collection
  ON public.collection_rules (collection_id, sort_order);

-- --------------------------------------------------------------------------
-- 4. Automatic collection resolver function
--    Given a collection ID, returns matching product IDs based on its rules.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_automatic_collection_products(
  p_collection_id uuid,
  p_limit integer DEFAULT 100
)
RETURNS TABLE(product_id uuid)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_is_automatic boolean;
  v_rules jsonb;
BEGIN
  -- Check if collection is automatic and has rules
  SELECT c.is_automatic, c.rules
  INTO v_is_automatic, v_rules
  FROM public.marketplace_collections c
  WHERE c.id = p_collection_id;

  IF NOT v_is_automatic THEN
    -- For manual collections, return existing product links
    RETURN QUERY
    SELECT mcp.product_id
    FROM public.marketplace_collection_products mcp
    WHERE mcp.collection_id = p_collection_id
    ORDER BY mcp.sort_order
    LIMIT p_limit;
    RETURN;
  END IF;

  -- Automatic collections: use the rules JSON to build a dynamic query
  RETURN QUERY
  SELECT p.id
  FROM public.products p
  WHERE p.status = 'active'
    AND p.is_approved = true
    AND (
      -- Category rule
      (v_rules @> '{"field": "category_id"}' AND p.category_id = (v_rules->>'value')::uuid)
      OR NOT (v_rules @> '{"field": "category_id"}')
    )
    AND (
      -- Brand rule
      (v_rules @> '{"field": "brand"}' AND p.brand ILIKE (v_rules->>'value'))
      OR NOT (v_rules @> '{"field": "brand"}')
    )
    AND (
      -- Discount rule
      (v_rules @> '{"field": "min_discount"}'
        AND p.compare_at_price IS NOT NULL
        AND p.compare_at_price > p.price
        AND ((p.compare_at_price - p.price) / p.compare_at_price * 100) >= (v_rules->>'value')::numeric)
      OR NOT (v_rules @> '{"field": "min_discount"}')
    )
    AND (
      -- Min rating rule
      (v_rules @> '{"field": "min_rating"}' AND p.average_rating >= (v_rules->>'value')::numeric)
      OR NOT (v_rules @> '{"field": "min_rating"}')
    )
    AND (
      -- Max price rule
      (v_rules @> '{"field": "max_price"}' AND p.price <= (v_rules->>'value')::numeric)
      OR NOT (v_rules @> '{"field": "max_price"}')
    )
    AND (
      -- Min price rule
      (v_rules @> '{"field": "min_price"}' AND p.price >= (v_rules->>'value')::numeric)
      OR NOT (v_rules @> '{"field": "min_price"}')
    )
    AND (
      -- Created within days rule
      (v_rules @> '{"field": "created_within_days"}'
        AND p.created_at >= now() - ((v_rules->>'value')::integer || ' days')::interval)
      OR NOT (v_rules @> '{"field": "created_within_days"}')
    )
    AND (
      -- In stock rule
      (v_rules @> '{"field": "min_stock"}' AND p.stock_quantity >= (v_rules->>'value')::integer)
      OR NOT (v_rules @> '{"field": "min_stock"}')
    )
  ORDER BY
    CASE WHEN v_rules @> '{"field": "is_best_seller"}' THEN p.sold_count ELSE 0 END DESC,
    CASE WHEN v_rules @> '{"field": "is_trending"}' THEN p.trend_score ELSE 0 END DESC,
    CASE WHEN v_rules @> '{"field": "is_new_arrival"}' THEN p.created_at ELSE '1970-01-01'::timestamptz END DESC,
    p.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_automatic_collection_products(uuid, integer) TO anon, authenticated;

-- --------------------------------------------------------------------------
-- 5. RLS for collection_rules
-- --------------------------------------------------------------------------
ALTER TABLE public.collection_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view rules of live collections"
  ON public.collection_rules FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_collections c
    WHERE c.id = collection_id
      AND c.status = 'active'
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at > now())
  ));

CREATE POLICY "Admins manage collection rules"
  ON public.collection_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "Sellers manage rules of own collections"
  ON public.collection_rules FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_collections c
    WHERE c.id = collection_id AND c.seller_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.marketplace_collections c
    WHERE c.id = collection_id AND c.seller_id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- 6. Add categories table if not present with parent support
--    (preserving existing categories)
-- --------------------------------------------------------------------------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories (parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories (is_active, sort_order);

-- --------------------------------------------------------------------------
-- 7. Helper function: get category ancestors (for breadcrumbs)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_category_ancestors(p_category_id uuid)
RETURNS TABLE(id uuid, name text, slug text, level integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH RECURSIVE ancestors AS (
    -- Base: the category itself
    SELECT id, name, slug, 0 AS level, parent_id
    FROM public.categories
    WHERE id = p_category_id

    UNION ALL

    -- Recursive: parent categories
    SELECT c.id, c.name, c.slug, a.level + 1, c.parent_id
    FROM public.categories c
    INNER JOIN ancestors a ON a.parent_id = c.id
  )
  SELECT id, name, slug, level
  FROM ancestors
  ORDER BY level DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_ancestors(uuid) TO anon, authenticated;

-- --------------------------------------------------------------------------
-- 8. Collection page view tracking
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_collection_view_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.marketplace_collections
  SET view_count = view_count + 1
  WHERE id = NEW.collection_id;
  RETURN NEW;
END;
$$;

-- --------------------------------------------------------------------------
-- 9. Update the placement check constraint to include new placements
-- --------------------------------------------------------------------------
ALTER TABLE public.marketplace_collections
  DROP CONSTRAINT IF EXISTS marketplace_collections_placement_check;

ALTER TABLE public.marketplace_collections
  ADD CONSTRAINT marketplace_collections_placement_check
  CHECK (placement IN ('homepage', 'navigation', 'seasonal', 'featured', 'new_arrivals', 'store', 'hero_slider', 'footer', 'hidden', 'flash_sale', 'deals', 'trending', 'brands', 'categories'));