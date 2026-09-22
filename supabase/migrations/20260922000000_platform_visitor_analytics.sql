-- Anonymous, aggregate platform traffic analytics. This intentionally stores no
-- page URLs, IP addresses, or user-agent fingerprints.
CREATE TABLE IF NOT EXISTS public.site_visits (
  visitor_id uuid NOT NULL,
  visited_on date NOT NULL DEFAULT CURRENT_DATE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  page_views integer NOT NULL DEFAULT 1 CHECK (page_views > 0),
  PRIMARY KEY (visitor_id, visited_on)
);
CREATE INDEX IF NOT EXISTS idx_site_visits_visited_on ON public.site_visits (visited_on DESC);
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.track_site_visit(p_visitor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.site_visits (visitor_id, visited_on)
  VALUES (p_visitor_id, CURRENT_DATE)
  ON CONFLICT (visitor_id, visited_on) DO UPDATE
    SET last_seen_at = now(), page_views = public.site_visits.page_views + 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_site_visit(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_platform_traffic_analytics(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  p_days := greatest(1, least(coalesce(p_days, 30), 365));

  SELECT jsonb_build_object(
    'visitors_today', (SELECT count(*) FROM public.site_visits WHERE visited_on = CURRENT_DATE),
    'visitors_period', (SELECT count(DISTINCT visitor_id) FROM public.site_visits WHERE visited_on >= CURRENT_DATE - (p_days - 1)),
    'page_views_period', (SELECT coalesce(sum(page_views), 0) FROM public.site_visits WHERE visited_on >= CURRENT_DATE - (p_days - 1)),
    'daily_visitors', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('date', to_char(day, 'Mon DD'), 'visitors', coalesce(visitors, 0), 'pageViews', coalesce(page_views, 0)) ORDER BY day), '[]'::jsonb)
      FROM (
        SELECT day::date, count(v.visitor_id)::bigint AS visitors, coalesce(sum(v.page_views), 0)::bigint AS page_views
        FROM generate_series(CURRENT_DATE - (p_days - 1), CURRENT_DATE, interval '1 day') AS day
        LEFT JOIN public.site_visits v ON v.visited_on = day::date
        GROUP BY day
      ) daily
    ),
    'top_clicked_products', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'title', title, 'clicks', clicks) ORDER BY clicks DESC), '[]'::jsonb)
      FROM (
        SELECT p.id, p.title, count(*)::bigint AS clicks
        FROM public.product_discovery_events e
        JOIN public.products p ON p.id = e.product_id
        WHERE e.event_type = 'click' AND e.created_at >= now() - make_interval(days => p_days)
        GROUP BY p.id, p.title
        ORDER BY clicks DESC, p.title ASC
        LIMIT 8
      ) clicked
    )
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_platform_traffic_analytics(integer) TO authenticated;
