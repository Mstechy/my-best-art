-- Extend homepage_product_feed to also return flash_deal_end_at
-- so the homepage flash-deal rail can show a real countdown.
-- Additive only — existing return columns are preserved.

CREATE OR REPLACE FUNCTION public.homepage_product_feed(
  p_section text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(product_id uuid, sold_count integer, trend_score bigint, flash_deal_end_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT p.id, p.created_at, p.price, p.compare_at_price, p.average_rating, p.review_count,
      p.flash_deal_end_at,
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
      AND (
        p_section <> 'flash_deals'
        OR (p.flash_deal_status = 'active' AND now() >= p.flash_deal_start_at AND now() <= p.flash_deal_end_at)
        OR compare_at_price > price
      )
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
  LIMIT greatest(1, least(p_limit, 24));
$$;

GRANT EXECUTE ON FUNCTION public.homepage_product_feed(text, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';