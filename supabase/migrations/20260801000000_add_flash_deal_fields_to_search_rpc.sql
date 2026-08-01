-- Add flash deal fields to search_products_combined RPC output
-- so product cards can show countdown timers.

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
      p.flash_deal_discount_percent,
      p.flash_deal_start_at,
      p.flash_deal_end_at,
      p.flash_deal_status,
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
  )
  SELECT json_build_object(
    'products', (
      SELECT coalesce(json_agg(row_to_json(r)), '[]'::json)
      FROM (
        SELECT *
        FROM ranked
        ORDER BY
          CASE WHEN p_sort = 'price_low' THEN price END ASC,
          CASE WHEN p_sort = 'price_high' THEN price END DESC,
          CASE WHEN p_sort = 'newest' THEN created_at END DESC,
          CASE WHEN p_sort = 'rating' THEN average_rating END DESC,
          relevance DESC,
          c_created_at DESC,
          c_id ASC
        LIMIT p_limit
      ) r
    ),
    'has_more', (
      SELECT EXISTS (
        SELECT 1
        FROM ranked r2
        WHERE (p_cursor_relevance IS NULL OR r2.relevance < p_cursor_relevance)
           OR (p_cursor_relevance = r2.relevance AND r2.c_created_at < p_cursor_created_at)
           OR (p_cursor_relevance = r2.relevance AND r2.c_created_at = p_cursor_created_at AND r2.c_id < p_cursor_id)
      )
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_combined(
  text, uuid, text, numeric, numeric, numeric, boolean, text, text, integer, real, timestamptz, uuid
) TO public, anon, authenticated;