CREATE INDEX IF NOT EXISTS idx_products_category_attributes
  ON public.products USING gin ((variants -> 'categoryAttributes'));

DROP FUNCTION IF EXISTS public.search_marketplace_product_ids(text, uuid, text, numeric, numeric, numeric, boolean, text, integer, real, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.search_marketplace_product_ids(
  p_query text DEFAULT '', p_category_id uuid DEFAULT NULL, p_country text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL, p_max_price numeric DEFAULT NULL, p_min_rating numeric DEFAULT NULL,
  p_in_stock_only boolean DEFAULT false, p_condition text DEFAULT NULL, p_attribute_filters jsonb DEFAULT '{}'::jsonb,
  p_sort text DEFAULT 'relevance', p_limit integer DEFAULT 24, p_cursor_relevance real DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL, p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE(product_id uuid, created_at timestamptz, relevance real)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH ranked AS (
    SELECT p.id AS product_id, p.created_at,
      CASE p_sort
        WHEN 'price_low' THEN -p.price::real
        WHEN 'price_high' THEN p.price::real
        WHEN 'rating' THEN p.average_rating::real
        WHEN 'newest' THEN extract(epoch FROM p.created_at)::real
        WHEN 'relevance' THEN CASE WHEN trim(coalesce(p_query, '')) = '' THEN 0::real ELSE ts_rank_cd(p.search_document, websearch_to_tsquery('simple', p_query))::real END
        ELSE 0::real
      END AS relevance
    FROM public.products p
    WHERE p.status = 'active' AND p.is_approved = true
      AND (trim(coalesce(p_query, '')) = '' OR p.search_document @@ websearch_to_tsquery('simple', p_query))
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_country IS NULL OR cardinality(p.ships_to) = 0 OR p_country = ANY(p.ships_to))
      AND (p_min_price IS NULL OR p.price >= p_min_price) AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_rating IS NULL OR p.average_rating >= p_min_rating) AND (NOT p_in_stock_only OR p.stock_quantity > 0)
      AND (p_condition IS NULL OR p.condition = p_condition)
      AND coalesce(p.variants -> 'categoryAttributes', '{}'::jsonb) @> coalesce(p_attribute_filters, '{}'::jsonb)
  )
  SELECT product_id, created_at, relevance FROM ranked
  WHERE p_cursor_relevance IS NULL OR relevance < p_cursor_relevance
    OR (relevance = p_cursor_relevance AND created_at < p_cursor_created_at)
    OR (relevance = p_cursor_relevance AND created_at = p_cursor_created_at AND product_id < p_cursor_id)
  ORDER BY relevance DESC, created_at DESC, product_id DESC
  LIMIT greatest(1, least(p_limit, 48));
$$;

GRANT EXECUTE ON FUNCTION public.search_marketplace_product_ids(text, uuid, text, numeric, numeric, numeric, boolean, text, jsonb, text, integer, real, timestamptz, uuid) TO anon, authenticated;
