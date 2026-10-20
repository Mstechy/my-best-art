-- Admin analytics read model.
-- Aggregate delivered sales in the database so the dashboard does not use a
-- client-side 500-row sample or include unpaid/pending order items.
CREATE OR REPLACE FUNCTION public.admin_top_products(p_limit integer DEFAULT 6)
RETURNS TABLE(title text, total bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::text) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(nullif(trim(oi.title), ''), p.title) AS title,
    coalesce(sum(oi.quantity), 0)::bigint AS total
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE o.status = 'delivered'::order_status
  GROUP BY coalesce(nullif(trim(oi.title), ''), p.title)
  ORDER BY total DESC, title ASC
  LIMIT greatest(1, least(coalesce(p_limit, 6), 50));
END;
$$;

ALTER FUNCTION public.admin_top_products(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_top_products(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_top_products(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
