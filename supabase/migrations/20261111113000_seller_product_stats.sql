-- Aggregate seller catalogue signals in the database instead of downloading
-- every view, save, and order-item row for each dashboard page.
CREATE OR REPLACE FUNCTION public.seller_product_stats(
  p_seller_id uuid,
  p_product_ids uuid[]
)
RETURNS TABLE (product_id uuid, views bigint, saves bigint, orders bigint)
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
  SELECT
    p.id,
    (SELECT count(*) FROM public.product_views pv WHERE pv.product_id = p.id),
    (SELECT count(*) FROM public.wishlists w WHERE w.product_id = p.id),
    (SELECT count(*) FROM public.order_items oi WHERE oi.product_id = p.id)
  FROM public.products p
  WHERE p.seller_id = p_seller_id
    AND p.id = ANY(COALESCE(p_product_ids, ARRAY[]::uuid[]));
END;
$$;

ALTER FUNCTION public.seller_product_stats(uuid, uuid[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.seller_product_stats(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_product_stats(uuid, uuid[]) TO authenticated;
