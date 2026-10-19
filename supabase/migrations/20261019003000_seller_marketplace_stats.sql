-- Small public read model for seller trust signals.
-- Product pages should not download every seller product or delivered order
-- item just to display two summary numbers.
CREATE OR REPLACE FUNCTION public.seller_marketplace_stats(p_seller_id uuid)
RETURNS TABLE (avg_rating numeric, total_reviews bigint, total_sold bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH rating_stats AS (
    SELECT
      coalesce(sum(review_count), 0)::bigint AS total_reviews,
      coalesce(sum(coalesce(average_rating, 0) * coalesce(review_count, 0)) / nullif(sum(coalesce(review_count, 0)), 0), 0)::numeric AS avg_rating
    FROM public.products
    WHERE seller_id = p_seller_id AND status = 'active' AND is_approved = true
  ), sales AS (
    SELECT coalesce(sum(oi.quantity), 0)::bigint AS total_sold
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    JOIN public.orders o ON o.id = oi.order_id
    WHERE p.seller_id = p_seller_id AND o.status = 'delivered'
  )
  SELECT rating_stats.avg_rating, rating_stats.total_reviews, sales.total_sold
  FROM rating_stats CROSS JOIN sales;
$$;

ALTER FUNCTION public.seller_marketplace_stats(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.seller_marketplace_stats(uuid) TO anon, authenticated;
