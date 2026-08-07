-- Scalable public catalogue search. Products remain protected by the existing
-- active-and-approved policy; this function only returns IDs visible to buyers.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_document tsvector;

CREATE OR REPLACE FUNCTION public.refresh_product_search_document()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_document :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.brand, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.key_features, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.color, '') || ' ' || coalesce(NEW.material, '') || ' ' || coalesce(NEW.condition, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_search_document_trigger ON public.products;
CREATE TRIGGER products_search_document_trigger
BEFORE INSERT OR UPDATE OF title, brand, tags, key_features, description, color, material, condition
ON public.products
FOR EACH ROW EXECUTE FUNCTION public.refresh_product_search_document();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'search_document') THEN
    UPDATE public.products
    SET search_document =
      setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
      setweight(to_tsvector('simple'::regconfig, coalesce(brand, '')), 'A') ||
      setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string(tags, ' '), '')), 'B') ||
      setweight(to_tsvector('simple'::regconfig, coalesce(array_to_string(key_features, ' '), '')), 'B') ||
      setweight(to_tsvector('simple'::regconfig, coalesce(description, '')), 'C') ||
      setweight(to_tsvector('simple'::regconfig, coalesce(color, '') || ' ' || coalesce(material, '') || ' ' || coalesce(condition, '')), 'C')
    WHERE search_document IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_public_browse
  ON public.products (created_at DESC, id DESC)
  WHERE status = 'active' AND is_approved = true;

CREATE INDEX IF NOT EXISTS idx_products_public_category_browse
  ON public.products (category_id, created_at DESC, id DESC)
  WHERE status = 'active' AND is_approved = true;

CREATE INDEX IF NOT EXISTS idx_products_search_document
  ON public.products USING gin (search_document)
  WHERE status = 'active' AND is_approved = true;

CREATE INDEX IF NOT EXISTS idx_products_ships_to ON public.products USING gin (ships_to);

CREATE OR REPLACE FUNCTION public.search_marketplace_product_ids(
  p_query text DEFAULT '',
  p_category_id uuid DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_min_rating numeric DEFAULT NULL,
  p_in_stock_only boolean DEFAULT false,
  p_condition text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_cursor_relevance real DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE(product_id uuid, created_at timestamptz, relevance real)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      p.id AS product_id,
      p.created_at,
      CASE WHEN trim(coalesce(p_query, '')) = '' THEN 0::real
        ELSE ts_rank_cd(p.search_document, websearch_to_tsquery('simple', p_query))::real
      END AS relevance
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
  )
  SELECT product_id, created_at, relevance
  FROM ranked
  WHERE p_cursor_relevance IS NULL
    OR relevance < p_cursor_relevance
    OR (relevance = p_cursor_relevance AND created_at < p_cursor_created_at)
    OR (relevance = p_cursor_relevance AND created_at = p_cursor_created_at AND product_id < p_cursor_id)
  ORDER BY relevance DESC, created_at DESC, product_id DESC
  LIMIT greatest(1, least(p_limit, 48));
$$;

GRANT EXECUTE ON FUNCTION public.search_marketplace_product_ids(text, uuid, text, numeric, numeric, numeric, boolean, text, integer, real, timestamptz, uuid) TO anon, authenticated;
