-- Fix: align resolver with how the admin form stores rules.
-- The frontend stores rules as a flat JSON object:
--   { category_id: "uuid", brand: "Apple", min_discount: "30" }
-- The original resolver expected nested {field, value} objects.
-- This replaces the resolver with the correct format.

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
  SELECT c.is_automatic, c.rules
  INTO v_is_automatic, v_rules
  FROM public.marketplace_collections c
  WHERE c.id = p_collection_id;

  IF NOT v_is_automatic OR v_rules IS NULL OR v_rules = '{}'::jsonb THEN
    RETURN QUERY
    SELECT mcp.product_id
    FROM public.marketplace_collection_products mcp
    WHERE mcp.collection_id = p_collection_id
    ORDER BY mcp.sort_order
    LIMIT p_limit;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id
  FROM public.products p
  WHERE p.status = 'active'
    AND p.is_approved = true
    AND (
      -- Category rule: exact match on category_id
      (v_rules ? 'category_id' AND p.category_id = (v_rules->>'category_id')::uuid)
      OR NOT (v_rules ? 'category_id')
    )
    AND (
      -- Brand rule: case-insensitive match
      (v_rules ? 'brand' AND p.brand ILIKE (v_rules->>'brand'))
      OR NOT (v_rules ? 'brand')
    )
    AND (
      -- Min discount rule
      (v_rules ? 'min_discount'
        AND p.compare_at_price IS NOT NULL
        AND p.compare_at_price > p.price
        AND ((p.compare_at_price - p.price) / p.compare_at_price * 100) >= (v_rules->>'min_discount')::numeric)
      OR NOT (v_rules ? 'min_discount')
    )
    AND (
      -- Min rating rule
      (v_rules ? 'min_rating' AND p.average_rating >= (v_rules->>'min_rating')::numeric)
      OR NOT (v_rules ? 'min_rating')
    )
    AND (
      -- Max price rule
      (v_rules ? 'max_price' AND p.price <= (v_rules->>'max_price')::numeric)
      OR NOT (v_rules ? 'max_price')
    )
    AND (
      -- Min price rule
      (v_rules ? 'min_price' AND p.price >= (v_rules->>'min_price')::numeric)
      OR NOT (v_rules ? 'min_price')
    )
    AND (
      -- Created within days rule
      (v_rules ? 'created_within_days'
        AND p.created_at >= now() - ((v_rules->>'created_within_days')::integer || ' days')::interval)
      OR NOT (v_rules ? 'created_within_days')
    )
    AND (
      -- Min stock rule
      (v_rules ? 'min_stock' AND p.stock_quantity >= (v_rules->>'min_stock')::integer)
      OR NOT (v_rules ? 'min_stock')
    )
  ORDER BY
    CASE WHEN v_rules ? 'is_best_seller' THEN p.sold_count ELSE 0 END DESC,
    CASE WHEN v_rules ? 'is_trending' THEN p.trend_score ELSE 0 END DESC,
    CASE WHEN v_rules ? 'is_new_arrival' THEN p.created_at ELSE '1970-01-01'::timestamptz END DESC,
    p.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_automatic_collection_products(uuid, integer) TO anon, authenticated;