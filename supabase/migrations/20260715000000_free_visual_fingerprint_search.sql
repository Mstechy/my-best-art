-- Zero-cost visual matching for images already in the MarketHub catalogue.
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS visual_hash char(16);
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS visual_hash_buckets text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS product_images_visual_hash_buckets_idx ON public.product_images USING gin (visual_hash_buckets);

CREATE OR REPLACE FUNCTION public.visual_hash_buckets(p_hash text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'a:' || substring(lower(p_hash) FROM 1 FOR 4),
    'b:' || substring(lower(p_hash) FROM 5 FOR 4),
    'c:' || substring(lower(p_hash) FROM 9 FOR 4),
    'd:' || substring(lower(p_hash) FROM 13 FOR 4)
  ]
$$;

CREATE OR REPLACE FUNCTION public.search_marketplace_product_ids_by_visual_hash(
  p_hash text,
  p_category_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 24
)
RETURNS TABLE(product_id uuid, created_at timestamptz, relevance real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH candidates AS (
    SELECT pi.product_id, p.created_at,
      min(length(replace((((('x' || pi.visual_hash)::bit(64)) # (('x' || lower(p_hash))::bit(64)))::text), '0', ''))) AS distance
    FROM public.product_images pi
    JOIN public.products p ON p.id = pi.product_id
    WHERE p.status = 'active' AND p.is_approved = true
      AND pi.visual_hash ~ '^[0-9a-f]{16}$'
      AND pi.visual_hash_buckets && public.visual_hash_buckets(p_hash)
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
    GROUP BY pi.product_id, p.created_at
  )
  SELECT product_id, created_at, greatest(0::real, (1 - distance::real / 64))::real AS relevance
  FROM candidates
  ORDER BY distance ASC, created_at DESC, product_id DESC
  LIMIT greatest(1, least(coalesce(p_limit, 24), 48))
$$;

GRANT EXECUTE ON FUNCTION public.search_marketplace_product_ids_by_visual_hash(text, uuid, integer) TO anon, authenticated;
