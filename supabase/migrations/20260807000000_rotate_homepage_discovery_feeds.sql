-- Rotate homepage product rails on each visit without sorting an entire
-- catalogue randomly. UUID primary keys are already uniformly distributed;
-- the supplied UUID is therefore an inexpensive random starting point.
CREATE INDEX IF NOT EXISTS idx_products_public_discovery_id
  ON public.products (id)
  WHERE status = 'active' AND is_approved = true;

CREATE OR REPLACE FUNCTION public.homepage_product_feed(
  p_section text,
  p_limit integer DEFAULT 10,
  p_seed uuid DEFAULT NULL
)
RETURNS TABLE(product_id uuid, sold_count integer, trend_score bigint, flash_deal_end_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH settings AS (
    SELECT
      COALESCE(p_seed, '00000000-0000-0000-0000-000000000000'::uuid) AS seed,
      greatest(1, least(p_limit, 24)) AS result_limit,
      greatest(8, least(p_limit, 24) * 8) AS candidate_limit
  ),
  candidates AS (
    SELECT * FROM (
      SELECT p.id, p.created_at, p.price, p.compare_at_price, p.average_rating,
        p.review_count, p.flash_deal_end_at
      FROM public.products p CROSS JOIN settings s
      WHERE p.status = 'active' AND p.is_approved = true
        AND p.id >= s.seed
        AND (
          p_section <> 'flash_deals'
          OR (p.flash_deal_status = 'active' AND now() >= p.flash_deal_start_at AND now() <= p.flash_deal_end_at)
          OR p.compare_at_price > p.price
        )
      ORDER BY p.id
      LIMIT (SELECT candidate_limit FROM settings)
    ) after_seed
    UNION ALL
    SELECT * FROM (
      SELECT p.id, p.created_at, p.price, p.compare_at_price, p.average_rating,
        p.review_count, p.flash_deal_end_at
      FROM public.products p CROSS JOIN settings s
      WHERE p.status = 'active' AND p.is_approved = true
        AND p.id < s.seed
        AND (
          p_section <> 'flash_deals'
          OR (p.flash_deal_status = 'active' AND now() >= p.flash_deal_start_at AND now() <= p.flash_deal_end_at)
          OR p.compare_at_price > p.price
        )
      ORDER BY p.id
      LIMIT (SELECT candidate_limit FROM settings)
    ) before_seed
  ),
  eligible AS (
    SELECT c.*,
      COALESCE((
        SELECT sum(oi.quantity)::integer
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.product_id = c.id AND o.status = 'delivered'::order_status
      ), 0) AS sold_count,
      COALESCE((
        SELECT count(*)
        FROM public.product_discovery_events e
        WHERE e.product_id = c.id AND e.created_at >= now() - interval '30 days'
      ), 0) AS trend_score
    FROM candidates c
  )
  SELECT id, sold_count, trend_score, flash_deal_end_at
  FROM eligible
  ORDER BY
    CASE WHEN p_section = 'best_sellers' THEN sold_count END DESC,
    CASE WHEN p_section = 'trending' THEN trend_score END DESC,
    CASE WHEN p_section = 'recommended' THEN average_rating END DESC,
    CASE WHEN p_section = 'recommended' THEN review_count END DESC,
    CASE WHEN p_section IN ('new_arrivals', 'flash_deals') THEN created_at END DESC,
    CASE WHEN p_section = 'flash_deals' THEN flash_deal_end_at END ASC,
    id DESC
  LIMIT (SELECT result_limit FROM settings);
$$;

GRANT EXECUTE ON FUNCTION public.homepage_product_feed(text, integer, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
