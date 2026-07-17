-- Homepage rankings are calculated from marketplace records only.  No card
-- falls back to invented product facts when a section has no qualifying stock.
CREATE OR REPLACE FUNCTION public.homepage_product_feed(
  p_section text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(product_id uuid, sold_count integer, trend_score bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT p.id, p.created_at, p.price, p.compare_at_price, p.average_rating, p.review_count,
      COALESCE((
        SELECT sum(oi.quantity)::integer
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id AND o.status = 'delivered'::order_status
      ), 0) AS sold_count,
      COALESCE((
        SELECT count(*)
        FROM public.product_discovery_events e
        WHERE e.product_id = p.id AND e.created_at >= now() - interval '30 days'
      ), 0) AS trend_score
    FROM public.products p
    WHERE p.status = 'active' AND p.is_approved = true
  )
  SELECT id, sold_count, trend_score
  FROM eligible
  WHERE (p_section <> 'flash_deals' OR compare_at_price > price)
  ORDER BY
    CASE WHEN p_section = 'best_sellers' THEN sold_count END DESC,
    CASE WHEN p_section = 'trending' THEN trend_score END DESC,
    CASE WHEN p_section = 'recommended' THEN average_rating END DESC,
    CASE WHEN p_section = 'recommended' THEN review_count END DESC,
    CASE WHEN p_section IN ('new_arrivals', 'flash_deals') THEN created_at END DESC,
    id DESC
  LIMIT greatest(1, least(p_limit, 24));
$$;

GRANT EXECUTE ON FUNCTION public.homepage_product_feed(text, integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.homepage_category_counts()
RETURNS TABLE(category_id uuid, product_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.category_id, count(*)::bigint
  FROM public.products p
  WHERE p.status = 'active' AND p.is_approved = true AND p.category_id IS NOT NULL
  GROUP BY p.category_id;
$$;

GRANT EXECUTE ON FUNCTION public.homepage_category_counts() TO anon, authenticated;

-- The same real ranking powers dedicated catalogue views linked from the header.
CREATE OR REPLACE FUNCTION public.search_marketplace_product_ids(
  p_query text DEFAULT '', p_category_id uuid DEFAULT NULL, p_country text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL, p_max_price numeric DEFAULT NULL, p_min_rating numeric DEFAULT NULL,
  p_in_stock_only boolean DEFAULT false, p_condition text DEFAULT NULL, p_attribute_filters jsonb DEFAULT '{}'::jsonb,
  p_sort text DEFAULT 'relevance', p_limit integer DEFAULT 24, p_cursor_relevance real DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL, p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE(product_id uuid, created_at timestamptz, relevance real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH ranked AS (
    SELECT p.id AS product_id, p.created_at,
      COALESCE((SELECT sum(oi.quantity)::integer FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.status = 'delivered'::order_status), 0) AS sold_count,
      COALESCE((SELECT count(*) FROM public.product_discovery_events e WHERE e.product_id = p.id AND e.created_at >= now() - interval '30 days'), 0) AS trend_score,
      CASE p_sort
        WHEN 'price_low' THEN -p.price::real WHEN 'price_high' THEN p.price::real WHEN 'rating' THEN p.average_rating::real
        WHEN 'newest' THEN extract(epoch FROM p.created_at)::real
        WHEN 'best_sellers' THEN COALESCE((SELECT sum(oi.quantity)::real FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE oi.product_id = p.id AND o.status = 'delivered'::order_status), 0)
        WHEN 'trending' THEN COALESCE((SELECT count(*)::real FROM public.product_discovery_events e WHERE e.product_id = p.id AND e.created_at >= now() - interval '30 days'), 0)
        WHEN 'recommended' THEN (p.average_rating * 1000 + least(p.review_count, 999))::real
        WHEN 'relevance' THEN CASE WHEN trim(coalesce(p_query, '')) = '' THEN 0::real ELSE ts_rank_cd(p.search_document, websearch_to_tsquery('simple', p_query))::real END ELSE 0::real END AS relevance
    FROM public.products p
    WHERE p.status = 'active' AND p.is_approved = true
      AND (trim(coalesce(p_query, '')) = '' OR p.search_document @@ websearch_to_tsquery('simple', p_query))
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_country IS NULL OR cardinality(p.ships_to) = 0 OR p_country = ANY(p.ships_to))
      AND (p_min_price IS NULL OR p.price >= p_min_price) AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_rating IS NULL OR p.average_rating >= p_min_rating) AND (NOT p_in_stock_only OR p.stock_quantity > 0)
      AND (p_condition IS NULL OR p.condition = p_condition)
      AND coalesce(p.variants -> 'categoryAttributes', '{}'::jsonb) @> coalesce(p_attribute_filters, '{}'::jsonb)
  )
  SELECT product_id, created_at, relevance FROM ranked
  WHERE p_cursor_relevance IS NULL OR relevance < p_cursor_relevance
    OR (relevance = p_cursor_relevance AND created_at < p_cursor_created_at)
    OR (relevance = p_cursor_relevance AND created_at = p_cursor_created_at AND product_id < p_cursor_id)
  ORDER BY relevance DESC, created_at DESC, product_id DESC
  LIMIT greatest(1, least(p_limit, 48));
$$;
