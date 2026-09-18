-- Keep the existing RPC signature, but make its cursor key match the active sort.
-- The client already stores the returned `relevance` field as its cursor value.

CREATE OR REPLACE FUNCTION public.search_products_combined(
  p_query text DEFAULT '',
  p_category_id uuid DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_rating numeric DEFAULT NULL,
  p_in_stock_only boolean DEFAULT false,
  p_condition text DEFAULT NULL,
  p_attribute_filters jsonb DEFAULT '{}'::jsonb,
  p_sort text DEFAULT 'relevance',
  p_limit integer DEFAULT 24,
  p_cursor_relevance real DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_seed uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result json;
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 48));
BEGIN
  WITH ranked AS (
    SELECT
      p.id, p.title, p.description, p.price, p.compare_at_price, p.currency,
      p.category_id, p.stock_quantity, p.seller_id, p.brand, p.color,
      p.condition, p.material, p.weight, p.dimensions, p.ships_to,
      p.created_at, p.average_rating, p.review_count, p.variants,
      p.flash_deal_discount_percent, p.flash_deal_start_at,
      p.flash_deal_end_at, p.flash_deal_status,
      COALESCE((SELECT sum(oi.quantity)::real
        FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id AND o.status = 'delivered'::order_status), 0::real) AS sold_count,
      COALESCE((SELECT count(*)::real FROM public.product_discovery_events e
        WHERE e.product_id = p.id AND e.created_at >= now() - interval '30 days'), 0::real) AS trend_score,
      CASE WHEN trim(coalesce(p_query, '')) = '' THEN 0::real
        ELSE ts_rank_cd(p.search_document, websearch_to_tsquery('simple', p_query))::real END AS search_relevance
    FROM public.products p
    WHERE p.status = 'active' AND p.is_approved = true
      AND (trim(coalesce(p_query, '')) = '' OR p.search_document @@ websearch_to_tsquery('simple', p_query))
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_country IS NULL OR cardinality(p.ships_to) = 0 OR p_country = ANY(p.ships_to))
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_rating IS NULL OR p.average_rating >= p_min_rating)
      AND (NOT coalesce(p_in_stock_only, false) OR p.stock_quantity > 0)
      AND (p_condition IS NULL OR p.condition = p_condition)
      AND coalesce(p.variants -> 'categoryAttributes', '{}'::jsonb) @> coalesce(p_attribute_filters, '{}'::jsonb)
      AND (p_sort <> 'flash_deals' OR (
        (p.flash_deal_status = 'active' AND now() >= p.flash_deal_start_at AND now() <= p.flash_deal_end_at)
        OR p.compare_at_price > p.price
      ))
  ), ranked_with_key AS (
    SELECT ranked.*,
      CASE p_sort
        WHEN 'price_low' THEN price::real
        WHEN 'price_high' THEN price::real
        WHEN 'newest' THEN extract(epoch FROM created_at)::real
        WHEN 'rating' THEN average_rating::real
        WHEN 'best_sellers' THEN sold_count
        WHEN 'trending' THEN trend_score
        WHEN 'recommended' THEN (average_rating * 1000 + least(review_count, 999))::real
        WHEN 'flash_deals' THEN CASE
          WHEN flash_deal_status = 'active' AND now() <= flash_deal_end_at
            THEN -extract(epoch FROM (flash_deal_end_at - now()))::real
          ELSE -1000000000::real END
        WHEN 'random' THEN (('x' || substring(md5(coalesce(p_seed::text, '') || ':' || id::text) FROM 1 FOR 6))::bit(24)::bigint)::real
        ELSE search_relevance
      END AS sort_key
    FROM ranked
  ), eligible_after_cursor AS (
    SELECT * FROM ranked_with_key
    WHERE p_cursor_relevance IS NULL
      OR (p_sort = 'price_low' AND (
        sort_key > p_cursor_relevance OR
        (sort_key = p_cursor_relevance AND (created_at < p_cursor_created_at OR (created_at = p_cursor_created_at AND id < p_cursor_id)))
      ))
      OR (p_sort <> 'price_low' AND (
        sort_key < p_cursor_relevance OR
        (sort_key = p_cursor_relevance AND (created_at < p_cursor_created_at OR (created_at = p_cursor_created_at AND id < p_cursor_id)))
      ))
  ), sorted AS (
    SELECT * FROM eligible_after_cursor
    ORDER BY
      CASE WHEN p_sort = 'price_low' THEN sort_key END ASC,
      CASE WHEN p_sort <> 'price_low' THEN sort_key END DESC,
      created_at DESC, id DESC
    LIMIT v_limit
  ), products_with_images AS (
    SELECT s.id, s.title, s.description, s.price, s.compare_at_price, s.currency,
      s.category_id, s.stock_quantity, s.seller_id, s.brand, s.color, s.condition,
      s.material, s.weight, s.dimensions, s.ships_to, s.created_at,
      s.average_rating, s.review_count, s.variants, s.flash_deal_discount_percent,
      s.flash_deal_start_at, s.flash_deal_end_at, s.flash_deal_status,
      s.sort_key AS relevance,
      (SELECT coalesce(json_agg(json_build_object('image_url', pi.image_url, 'is_primary', pi.is_primary)
        ORDER BY pi.sort_order, pi.is_primary DESC), '[]'::json)
       FROM public.product_images pi WHERE pi.product_id = s.id) AS product_images
    FROM sorted s
  )
  SELECT json_build_object(
    'products', coalesce((SELECT json_agg(to_json(pwi.*) ORDER BY
      CASE WHEN p_sort = 'price_low' THEN pwi.relevance END ASC,
      CASE WHEN p_sort <> 'price_low' THEN pwi.relevance END DESC,
      pwi.created_at DESC, pwi.id DESC), '[]'::json),
    'has_more', (SELECT count(*) > v_limit FROM eligible_after_cursor)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_combined(
  text, uuid, text, numeric, numeric, numeric, boolean, text, jsonb, text, integer, real, timestamptz, uuid, uuid
) TO public, anon, authenticated;