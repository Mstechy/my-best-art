-- Bounded seller dashboard read model.
-- The dashboard must not download an entire catalogue to calculate summary KPIs.
CREATE OR REPLACE FUNCTION public.seller_dashboard_summary(p_seller_id uuid)
RETURNS TABLE (
  total_products bigint,
  active_products bigint,
  pending_approval bigint,
  pending_orders bigint,
  processing_orders bigint,
  total_revenue numeric,
  inventory_units bigint,
  low_stock bigint,
  out_of_stock bigint,
  average_rating numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_seller_id
     AND NOT public.has_role(auth.uid(), 'admin'::text) THEN
    RAISE EXCEPTION 'Seller access required';
  END IF;

  RETURN QUERY
  WITH product_stats AS (
    SELECT
      count(*)::bigint AS total_products,
      count(*) FILTER (WHERE status = 'active')::bigint AS active_products,
      count(*) FILTER (WHERE is_approved = false)::bigint AS pending_approval,
      coalesce(sum(stock_quantity) FILTER (WHERE status = 'active' AND stock_quantity > 0), 0)::bigint AS inventory_units,
      count(*) FILTER (WHERE status = 'active' AND stock_quantity > 0 AND stock_quantity <= coalesce(low_stock_threshold, 5))::bigint AS low_stock,
      count(*) FILTER (WHERE status = 'active' AND stock_quantity <= 0)::bigint AS out_of_stock,
      coalesce(sum(coalesce(average_rating, 0) * coalesce(review_count, 0)) / nullif(sum(coalesce(review_count, 0)), 0), 0)::numeric AS average_rating
    FROM public.products
    WHERE seller_id = p_seller_id
  ), order_stats AS (
    SELECT
      count(*) FILTER (WHERE status = 'pending')::bigint AS pending_orders,
      count(*) FILTER (WHERE status = 'processing')::bigint AS processing_orders,
      coalesce(sum(total_amount) FILTER (WHERE status = 'delivered'), 0)::numeric AS total_revenue
    FROM public.orders
    WHERE seller_id = p_seller_id
  )
  SELECT product_stats.total_products, product_stats.active_products,
    product_stats.pending_approval, order_stats.pending_orders,
    order_stats.processing_orders, order_stats.total_revenue,
    product_stats.inventory_units, product_stats.low_stock,
    product_stats.out_of_stock, product_stats.average_rating
  FROM product_stats CROSS JOIN order_stats;
END;
$$;

ALTER FUNCTION public.seller_dashboard_summary(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.seller_dashboard_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_dashboard_summary(uuid) TO authenticated;
