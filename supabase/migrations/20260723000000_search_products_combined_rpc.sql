-- Combined search RPC: returns full product data with images in a single call.
-- Eliminates the client-side second roundtrip that was causing slow search.

CREATE OR REPLACE FUNCTION public.search_products_combined(
  p_query text DEFAULT '',
  p_category_id uuid DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_rating numeric DEFAULT NULL,
  p_in_stock_only boolean DEFAULT false,
  p_condition text DEFAULT NULL,
  p_sort text DEFAULT 'relevance',
  p_limit integer DEFAULT 24,
  p_cursor_relevance real DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  WITH ranked AS (
    SELECT
      p.id,
      p.title,
      p.description,
      p.price,
      p.compare_at_price,
      p.currency,
      p.category_id,
      p.stock_quantity,
      p.seller_id,
      p.brand,
      p.color,
      p.condition,
      p.material,
      p.weight,
      p.dimensions,
      p.ships_to,
      p.created_at,
      p.average_rating,
      p.review_count,
      p.variants,
      CASE WHEN trim(coalesce(p_query, '')) = '' THEN 0::real
        ELSE ts_rank_cd(p.search_document, websearch_to_tsquery('simple', p_query))::real
      END AS relevance,
      p.created_at AS c_created_at,
      p.id AS c_id
    FROM public.products p
    WHERE p.status = 'active'
      AND p.is_approved = true
      AND (trim(coalesce(p_query, '')) = '' OR p.search_document @@ websearch_to_tsquery('simple', p_query))
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_country IS NULL OR cardinality(p.ships_to) = 0 OR p_country = ANY(p.ships_to))
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (p_min_rating IS NULL OR p.average_rating >= p_min_rating)
      AND (NOT p_in_stock_only OR p.stock_quantity > 0)
      AND (p_condition IS NULL OR p.condition = p_condition)
  ),
  sorted AS (
    SELECT *
    FROM ranked
    WHERE p_cursor_relevance IS NULL
      OR relevance < p_cursor_relevance
      OR (relevance = p_cursor_relevance AND c_created_at < p_cursor_created_at)
      OR (relevance = p_cursor_relevance AND c_created_at = p_cursor_created_at AND c_id < p_cursor_id)
    ORDER BY
      CASE p_sort
        WHEN 'newest' THEN 0
        WHEN 'price_low' THEN 0
        WHEN 'price_high' THEN 0
        WHEN 'rating' THEN 0
        ELSE relevance
      END DESC,
      CASE p_sort WHEN 'newest' THEN c_created_at ELSE NULL END DESC,
      CASE p_sort WHEN 'price_low' THEN price ELSE NULL END ASC,
      CASE p_sort WHEN 'price_high' THEN price ELSE NULL END DESC,
      CASE p_sort WHEN 'rating' THEN average_rating ELSE NULL END DESC,
      c_created_at DESC, c_id DESC
    LIMIT greatest(1, least(p_limit, 48))
  ),
  products_with_images AS (
    SELECT
      s.id,
      s.title,
      s.description,
      s.price,
      s.compare_at_price,
      s.currency,
      s.category_id,
      s.stock_quantity,
      s.seller_id,
      s.brand,
      s.color,
      s.condition,
      s.material,
      s.weight,
      s.dimensions,
      s.ships_to,
      s.created_at,
      s.average_rating,
      s.review_count,
      s.variants,
      s.relevance,
      (SELECT COALESCE(json_agg(json_build_object('image_url', pi.image_url, 'is_primary', pi.is_primary) ORDER BY pi.sort_order, pi.is_primary DESC), '[]'::json)
       FROM public.product_images pi
       WHERE pi.product_id = s.id) AS product_images
    FROM sorted s
  )
  SELECT json_build_object(
    'products', COALESCE((SELECT json_agg(to_json(pwi.*) ORDER BY pwi.relevance DESC, pwi.created_at DESC, pwi.id DESC)) FROM products_with_images pwi),
    'has_more', (SELECT COUNT(*) FROM ranked) > greatest(1, least(p_limit, 48))
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_combined(
  text, uuid, text, numeric, numeric, numeric, boolean, text, text, integer, real, timestamptz, uuid
) TO anon, authenticated;