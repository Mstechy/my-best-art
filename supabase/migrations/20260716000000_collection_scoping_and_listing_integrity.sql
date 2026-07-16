-- Add seller-scoped collections without replacing the established marketplace tables.
ALTER TABLE public.marketplace_collections
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rules jsonb;

ALTER TABLE public.marketplace_collections
  DROP CONSTRAINT IF EXISTS marketplace_collections_placement_check;
ALTER TABLE public.marketplace_collections
  ADD CONSTRAINT marketplace_collections_placement_check
  CHECK (placement IN ('homepage', 'navigation', 'seasonal', 'featured', 'new_arrivals', 'store'));

CREATE INDEX IF NOT EXISTS marketplace_collections_seller_public_idx
  ON public.marketplace_collections (seller_id, placement, sort_order, created_at DESC)
  WHERE status = 'active';

-- Public marketplace placements remain reserved for platform collections.
ALTER TABLE public.marketplace_collections
  ADD CONSTRAINT marketplace_collections_platform_placement_check
  CHECK (seller_id IS NOT NULL OR placement IN ('homepage', 'navigation', 'seasonal'));

DROP POLICY IF EXISTS "Public can view live marketplace collections" ON public.marketplace_collections;
CREATE POLICY "Public can view live marketplace collections"
  ON public.marketplace_collections FOR SELECT TO public
  USING (
    status = 'active'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "Sellers manage own marketplace collections"
  ON public.marketplace_collections FOR ALL TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (
    seller_id = auth.uid()
    AND placement IN ('featured', 'new_arrivals', 'store')
  );

CREATE POLICY "Sellers manage products in own collections"
  ON public.marketplace_collection_products FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_collections c
    WHERE c.id = collection_id AND c.seller_id = auth.uid()
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.marketplace_collections c
      WHERE c.id = collection_id AND c.seller_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.seller_id = auth.uid()
    )
  );

-- Banner uploads are stored in Supabase Storage, never accepted as pasted URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('collection-banners', 'collection-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users upload collection banners"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'collection-banners' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners update collection banners"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'collection-banners' AND owner_id = auth.uid())
  WITH CHECK (bucket_id = 'collection-banners' AND owner_id = auth.uid());
CREATE POLICY "Owners delete collection banners"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'collection-banners' AND owner_id = auth.uid());
CREATE POLICY "Public reads collection banners"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'collection-banners');

-- A live product must always have a category, including writes that bypass the UI.
CREATE OR REPLACE FUNCTION public.require_category_for_active_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.category_id IS NULL THEN
    RAISE EXCEPTION 'A category is required before a product can be active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_category_for_active_product ON public.products;
CREATE TRIGGER require_category_for_active_product
  BEFORE INSERT OR UPDATE OF status, category_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.require_category_for_active_product();
