-- Serve public homepage rankings from the intentionally public aggregate table.
--
-- homepage_snapshot remains SECURITY INVOKER. It must not read order_items or
-- product_discovery_events directly because those tables intentionally expose
-- data only to order participants or through the event writer RPC.

-- Backfill the maintained counters for projects that already have historical
-- orders/events before this migration is applied.
INSERT INTO public.product_metrics (product_id, delivered_units, updated_at)
SELECT oi.product_id, sum(oi.quantity)::bigint, now()
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.status = 'delivered'::order_status
  AND oi.product_id IS NOT NULL
GROUP BY oi.product_id
ON CONFLICT (product_id) DO UPDATE
SET delivered_units = EXCLUDED.delivered_units,
    updated_at = now();

INSERT INTO public.product_metrics (product_id, discovery_events_30d, updated_at)
SELECT e.product_id, count(*)::bigint, now()
FROM public.product_discovery_events e
WHERE e.created_at >= now() - interval '30 days'
GROUP BY e.product_id
ON CONFLICT (product_id) DO UPDATE
SET discovery_events_30d = EXCLUDED.discovery_events_30d,
    updated_at = now();

-- Keep each accepted product event at one count per writer call. The previous
-- implementation added the whole batch cardinality to every product.
CREATE OR REPLACE FUNCTION public.track_product_discovery_event(
  p_product_ids uuid[], p_event_type text, p_visitor_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_product_ids IS NULL
    OR p_event_type NOT IN ('impression', 'view', 'click', 'wishlist', 'add_to_cart')
    OR cardinality(p_product_ids) = 0
    OR cardinality(p_product_ids) > 48 THEN
    RAISE EXCEPTION 'Invalid discovery event';
  END IF;

  INSERT INTO public.product_discovery_events (product_id, event_type, visitor_id, user_id)
  SELECT DISTINCT p.id, p_event_type, p_visitor_id, auth.uid()
  FROM public.products p
  WHERE p.id = ANY(p_product_ids)
    AND p.status = 'active'
    AND p.is_approved = true;

  INSERT INTO public.product_metrics(product_id, discovery_events_30d, updated_at)
  SELECT DISTINCT p.id, 1::bigint, now()
  FROM public.products p
  WHERE p.id = ANY(p_product_ids)
    AND p.status = 'active'
    AND p.is_approved = true
  ON CONFLICT(product_id) DO UPDATE
  SET discovery_events_30d = product_metrics.discovery_events_30d + EXCLUDED.discovery_events_30d,
      updated_at = now();
END;
$$;

ALTER FUNCTION public.track_product_discovery_event(uuid[], text, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.track_product_discovery_event(uuid[], text, uuid) TO anon, authenticated;

-- The event writer increments the counter immediately for fast reads. This
-- refresh keeps the 30-day value accurate as events age out.
CREATE OR REPLACE FUNCTION public.refresh_product_discovery_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH recent AS (
    SELECT product_id, count(*)::bigint AS event_count
    FROM public.product_discovery_events
    WHERE created_at >= now() - interval '30 days'
    GROUP BY product_id
  )
  UPDATE public.product_metrics pm
  SET discovery_events_30d = coalesce(recent.event_count, 0),
      updated_at = now()
  FROM recent
  WHERE pm.product_id = recent.product_id;

  UPDATE public.product_metrics pm
  SET discovery_events_30d = 0,
      updated_at = now()
  WHERE pm.discovery_events_30d <> 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.product_discovery_events e
      WHERE e.product_id = pm.product_id
        AND e.created_at >= now() - interval '30 days'
    );
END;
$$;

ALTER FUNCTION public.refresh_product_discovery_metrics() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.refresh_product_discovery_metrics() FROM PUBLIC;

-- Re-running this migration must not create duplicate schedules.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-product-discovery-metrics') THEN
    PERFORM cron.unschedule('refresh-product-discovery-metrics');
  END IF;
END;
$$;

SELECT cron.schedule(
  'refresh-product-discovery-metrics',
  '*/15 * * * *',
  'SELECT public.refresh_product_discovery_metrics();'
);

-- Rebuild the snapshot using only public product data, public seller summaries,
-- and public product_metrics. No order or visitor rows cross the RPC boundary.
CREATE OR REPLACE FUNCTION public.homepage_snapshot(
  p_limit integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH settings AS (
    SELECT greatest(1, least(coalesce(p_limit, 24), 24)) AS result_limit
  ), sections AS (
    SELECT unnest(ARRAY['flash_deals', 'best_sellers', 'trending', 'new_arrivals']::text[]) AS section
  ), ranked AS (
    SELECT
      s.section,
      p.id,
      p.title,
      p.price,
      p.compare_at_price,
      p.currency,
      p.seller_id,
      p.stock_quantity,
      p.average_rating,
      p.review_count,
      p.ships_to,
      p.flash_deal_end_at,
      p.created_at,
      coalesce(pm.delivered_units, 0) AS sold_count,
      coalesce(pm.discovery_events_30d, 0) AS trend_score,
      row_number() OVER (
        PARTITION BY s.section
        ORDER BY
          CASE WHEN s.section = 'flash_deals' THEN p.flash_deal_end_at END ASC NULLS LAST,
          CASE WHEN s.section = 'best_sellers' THEN coalesce(pm.delivered_units, 0) END DESC NULLS LAST,
          CASE WHEN s.section = 'trending' THEN coalesce(pm.discovery_events_30d, 0) END DESC NULLS LAST,
          CASE WHEN s.section = 'new_arrivals' THEN p.created_at END DESC NULLS LAST,
          p.created_at DESC,
          p.id
      ) AS position
    FROM sections s
    CROSS JOIN public.products p
    LEFT JOIN public.product_metrics pm ON pm.product_id = p.id
    WHERE p.status = 'active'
      AND p.is_approved = true
      AND (
        s.section <> 'flash_deals'
        OR ((p.flash_deal_status = 'active' AND now() BETWEEN p.flash_deal_start_at AND p.flash_deal_end_at) OR p.compare_at_price > p.price)
      )
  ), hydrated AS (
    SELECT
      r.section,
      r.position,
      jsonb_build_object(
        'id', r.id,
        'title', r.title,
        'price', r.price,
        'compare_at_price', r.compare_at_price,
        'currency', r.currency,
        'seller_id', r.seller_id,
        'stock_quantity', r.stock_quantity,
        'average_rating', r.average_rating,
        'review_count', r.review_count,
        'ships_to', r.ships_to,
        'flash_deal_end_at', r.flash_deal_end_at,
        'created_at', r.created_at,
        'sold_count', r.sold_count,
        'trend_score', r.trend_score,
        'product_images', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'image_url', pi.image_url,
            'is_primary', pi.is_primary,
            'card_small_url', pi.card_small_url,
            'image_width', pi.image_width,
            'image_height', pi.image_height
          ) ORDER BY pi.is_primary DESC, pi.sort_order)
          FROM public.product_images pi WHERE pi.product_id = r.id
        ), '[]'::jsonb),
        'seller', jsonb_build_object(
          'full_name', sp.full_name,
          'is_verified', coalesce(sp.is_verified, false)
        )
      ) AS item
    FROM ranked r
    LEFT JOIN public.seller_profiles_public sp ON sp.user_id = r.seller_id
    CROSS JOIN settings
    WHERE r.position <= settings.result_limit
  ), grouped AS (
    SELECT section, jsonb_agg(item ORDER BY position) AS items
    FROM hydrated
    GROUP BY section
  )
  SELECT coalesce(jsonb_object_agg(section, items), '{}'::jsonb) FROM grouped;
$$;

GRANT EXECUTE ON FUNCTION public.homepage_snapshot(integer) TO anon, authenticated;
