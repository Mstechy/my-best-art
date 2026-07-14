CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_public_title_trgm
  ON public.products USING gin (title gin_trgm_ops)
  WHERE status = 'active' AND is_approved = true;

CREATE OR REPLACE FUNCTION public.marketplace_search_suggestions(
  p_query text,
  p_limit integer DEFAULT 6
)
RETURNS TABLE(label text, suggestion_type text, category_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH input AS (SELECT lower(trim(coalesce(p_query, ''))) AS query),
  suggestions AS (
    SELECT c.name AS label, 'category'::text AS suggestion_type, c.id AS category_id,
      similarity(lower(c.name), input.query) AS score
    FROM public.categories c CROSS JOIN input
    WHERE length(input.query) >= 2 AND lower(c.name) % input.query

    UNION ALL

    SELECT p.title AS label, 'product'::text AS suggestion_type, p.category_id,
      greatest(similarity(lower(p.title), input.query), ts_rank_cd(p.search_document, websearch_to_tsquery('simple', input.query))) AS score
    FROM public.products p CROSS JOIN input
    WHERE length(input.query) >= 2
      AND p.status = 'active' AND p.is_approved = true
      AND (lower(p.title) % input.query OR p.search_document @@ websearch_to_tsquery('simple', input.query))
  )
  SELECT label, suggestion_type, category_id
  FROM suggestions
  ORDER BY score DESC, label ASC
  LIMIT greatest(1, least(p_limit, 8));
$$;

GRANT EXECUTE ON FUNCTION public.marketplace_search_suggestions(text, integer) TO anon, authenticated;
