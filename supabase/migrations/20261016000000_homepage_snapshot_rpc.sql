-- One server round trip for homepage merchandising sections.
-- The client receives hydrated product cards and seller summaries instead of
-- requesting four ID feeds, then products, then seller profiles.
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
      CASE WHEN s.section = 'best_sellers' THEN coalesce((
        SELECT sum(oi.quantity)::integer
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id AND o.status = 'delivered'::order_status
      ), 0) ELSE 0 END AS sold_count,
      CASE WHEN s.section = 'trending' THEN (
        SELECT count(*)::integer
        FROM public.product_discovery_events e
        WHERE e.product_id = p.id AND e.created_at >= now() - interval '30 days'
      ) ELSE 0 END AS trend_score,
      row_number() OVER (
        PARTITION BY s.section
        ORDER BY
          CASE WHEN s.section = 'flash_deals' THEN p.flash_deal_end_at END ASC NULLS LAST,
          CASE WHEN s.section = 'best_sellers' THEN coalesce((
            SELECT sum(oi.quantity)::integer
            FROM public.order_items oi
            JOIN public.orders o ON o.id = oi.order_id
            WHERE oi.product_id = p.id AND o.status = 'delivered'::order_status
          ), 0) END DESC NULLS LAST,
          CASE WHEN s.section = 'trending' THEN (
            SELECT count(*)::integer
            FROM public.product_discovery_events e
            WHERE e.product_id = p.id AND e.created_at >= now() - interval '30 days'
          ) END DESC NULLS LAST,
          CASE WHEN s.section = 'new_arrivals' THEN p.created_at END DESC NULLS LAST,
          p.created_at DESC,
          p.id
      ) AS position
    FROM sections s
    CROSS JOIN public.products p
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
