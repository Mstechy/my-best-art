-- Keep buyer dashboard aggregates in the database. The browser should not
-- download a buyer's complete order history just to render three KPIs and a
-- six-month chart.
CREATE OR REPLACE FUNCTION public.buyer_dashboard_summary()
RETURNS TABLE (
  active_orders bigint,
  in_transit bigint,
  total_spent numeric,
  spend_timeline jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scoped_orders AS (
    SELECT id, status, total_amount, created_at
    FROM public.orders
    WHERE buyer_id = auth.uid()
  ),
  timeline AS (
    SELECT
      months.month_start,
      coalesce(sum(orders.total_amount) FILTER (WHERE orders.status <> 'cancelled'::public.order_status), 0)::numeric AS total
    FROM generate_series(
      date_trunc('month', now()) - interval '5 months',
      date_trunc('month', now()),
      interval '1 month'
    ) AS months(month_start)
    LEFT JOIN scoped_orders AS orders
      ON orders.created_at >= months.month_start
      AND orders.created_at < months.month_start + interval '1 month'
    GROUP BY months.month_start
  )
  SELECT
    count(*) FILTER (WHERE status NOT IN ('delivered'::public.order_status, 'cancelled'::public.order_status))::bigint,
    count(*) FILTER (WHERE status = 'shipped'::public.order_status)::bigint,
    coalesce(sum(total_amount) FILTER (WHERE status <> 'cancelled'::public.order_status), 0)::numeric,
    (
      SELECT coalesce(
        jsonb_agg(
          jsonb_build_object(
            'month', to_char(month_start, 'Mon'),
            'total', total
          ) ORDER BY month_start
        ),
        '[]'::jsonb
      )
      FROM timeline
    )
  FROM scoped_orders;
$$;

ALTER FUNCTION public.buyer_dashboard_summary() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.buyer_dashboard_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buyer_dashboard_summary() TO authenticated;
