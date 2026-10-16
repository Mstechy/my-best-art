-- One round trip for the homepage: all four merchandising sections, fully
-- hydrated (product row + primary image + seller display info + section
-- metrics), as a single jsonb object keyed by section.
--
-- Why: the client previously needed three sequential waves to paint a rail —
-- 4x homepage_product_feed (IDs only) -> products.in(ids) -> seller profiles
-- .in(ids) — and the catch-all grid waited for all of them. This function
-- collapses that into one call.
--
-- Cost fix vs homepage_product_feed: the sales/discovery correlated subqueries
-- are computed ONLY for the section that ranks by them (best_sellers ->
-- sold_count, trending -> trend_score). new_arrivals and flash_deals pay
-- neither, and every section hydrates only its final rows (<= p_limit).
--
-- Ranking, candidate rotation (p_seed) and section filters mirror
-- 20260918050000_homepage_feed_integrity.sql so the same products appear in
-- the same order as before.

CREATE OR REPLACE FUNCTION public.homepage_snapshot(
  p_limit integer DEFAULT 24,
  p_seed uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH settings AS (
    SELECT COALESCE(p_seed, '00000000-0000-0000-0000-000000000000'::uuid) AS seed,
      greatest(1, least(coalesce(p_limit, 24), 24)) AS result_limit,
      greatest(8, least(coalesce(p_limit, 24), 24) * 8) AS candidate_limit
  ),
  sections AS (
    SELECT unnest(ARRAY['flash_deals', 'best_sellers', 'trending', 'new_arrivals']::text[]) AS section
  ),
  -- Seed-rotated candidate windows per section (identical to
  -- homepage_product_feed): walk forward from the seed, then wrap around.
  candidates AS (
    SELECT s.section, c.id, c.created_at, c.price, c.compare_at_price,
      c.flash_deal_status, c.flash_deal_start_at, c.flash_deal_end_at
    FROM sections s
    CROSS JOIN settings
    CROSS JOIN LATERAL (
      SELECT p.id, p.created_at, p.price, p.compare_at_price,
        p.flash_deal_status, p.flash_deal_start_at, p.flash_deal_end_at
      FROM public.products p
      WHERE p.status = 'active' AND p.is_approved = true AND p.id >= settings.seed
        AND (s.section <> 'flash_deals'
          OR ((p.flash_deal_status = 'active'
            AND now() >= p.flash_deal_start_at
            AND now() <= p.flash_deal_end_at)
          OR p.compare_at_price > p.price))
      ORDER BY p.id
      LIMIT settings.candidate_limit
      UNION ALL
      SELECT p.id, p.created_at, p.price, p.compare_at_price,
        p.flash_deal_status, p.flash_deal_start_at, p.flash_deal_end_at
      FROM public.products p
      WHERE p.status = 'active' AND p.is_approved = true AND p.id < settings.seed
        AND (s.section <> 'flash_deals'
          OR ((p.flash_deal_status = 'active'
            AND now() >= p.flash_deal_start_at
            AND now() <= p.flash_deal_end_at)
          OR p.compare_at_price > p.price))
      ORDER BY p.id
      LIMIT settings.candidate_limit
    ) c
  ),
  -- Section-guarded metrics: the correlated subqueries run only for the
  -- section that orders by them.
  scored AS (
    SELECT c.section, c.id, c.created_at, c.flash_deal_end_at, c.flash_deal_status,
      CASE WHEN c.section = 'best_sellers' THEN
        COALESCE((
          SELECT sum(oi.quantity)::integer
          FROM public.order_items oi
          JOIN public.orders o ON o.id = oi.order_id
          WHERE oi.product_id = c.id AND o.status = 'delivered'::order_status
        ), 0)
      ELSE 0 END AS sold_count,
      CASE WHEN c.section = 'trending' THEN
        COALESCE((
          SELECT count(*)
          FROM public.product_discovery_events e
          WHERE e.product_id = c.id AND e.created_at >= now() - interval '30 days'
        ), 0)
      ELSE 0 END AS trend_score
    FROM candidates c
  ),
