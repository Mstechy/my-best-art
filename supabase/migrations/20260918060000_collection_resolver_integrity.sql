-- Automatic collections must return only the products their rules promise.
-- Use maintained metrics rather than nonexistent product columns or repeated
-- scans of orders and discovery events.

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

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT v_is_automatic THEN
    RETURN QUERY
    SELECT mcp.product_id
    FROM public.marketplace_collection_products mcp
    WHERE mcp.collection_id = p_collection_id
    ORDER BY mcp.sort_order, mcp.created_at DESC
    LIMIT greatest(1, least(coalesce(p_limit, 100), 100));
    RETURN;
  END IF;

  -- An automatic collection without a rule is not a collection. Returning no
  -- rows is safer than accidentally exposing the entire catalogue.
  IF v_rules IS NULL OR v_rules = '{}'::jsonb THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id
  FROM public.products p
  LEFT JOIN public.product_metrics pm ON pm.product_id = p.id
  WHERE p.status = 'active'
    AND p.is_approved = true
    AND (NOT (v_rules ? 'category_id') OR p.category_id = (v_rules->>'category_id')::uuid)
    AND (NOT (v_rules ? 'brand') OR p.brand ILIKE (v_rules->>'brand'))
    AND (NOT (v_rules ? 'min_price') OR p.price >= (v_rules->>'min_price')::numeric)
    AND (NOT (v_rules ? 'max_price') OR p.price <= (v_rules->>'max_price')::numeric)
    AND (NOT (v_rules ? 'min_rating') OR p.average_rating >= (v_rules->>'min_rating')::numeric)
    AND (NOT (v_rules ? 'min_stock') OR p.stock_quantity >= (v_rules->>'min_stock')::integer)
    AND (NOT (v_rules ? 'created_within_days') OR p.created_at >= now() - ((v_rules->>'created_within_days')::integer || ' days')::interval)
    AND (NOT (v_rules ? 'min_discount') OR (
      p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price
      AND ((p.compare_at_price - p.price) / p.compare_at_price * 100) >= (v_rules->>'min_discount')::numeric
    ))
    AND (NOT (v_rules ? 'is_best_seller') OR coalesce(pm.delivered_units, 0) > 0)
    AND (NOT (v_rules ? 'is_trending') OR coalesce(pm.discovery_events_30d, 0) > 0)
  ORDER BY
    CASE WHEN v_rules ? 'is_best_seller' THEN coalesce(pm.delivered_units, 0) ELSE 0 END DESC,
    CASE WHEN v_rules ? 'is_trending' THEN coalesce(pm.discovery_events_30d, 0) ELSE 0 END DESC,
    CASE WHEN v_rules ? 'is_new_arrival' THEN p.created_at ELSE '1970-01-01'::timestamptz END DESC,
    p.created_at DESC,
    p.id DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 100));
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_automatic_collection_products(uuid, integer) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
