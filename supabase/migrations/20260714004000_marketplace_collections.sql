-- Admin-curated collections turn homepage campaigns into real, browsable product sets.
CREATE TABLE public.marketplace_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 100),
  description text,
  image_url text,
  badge text,
  cta_label text NOT NULL DEFAULT 'Shop collection',
  placement text NOT NULL DEFAULT 'homepage' CHECK (placement IN ('homepage', 'navigation', 'seasonal')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE public.marketplace_collection_products (
  collection_id uuid NOT NULL REFERENCES public.marketplace_collections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, product_id)
);

CREATE INDEX marketplace_collections_public_idx
  ON public.marketplace_collections (placement, sort_order, created_at DESC)
  WHERE status = 'active';
CREATE INDEX marketplace_collection_products_collection_idx
  ON public.marketplace_collection_products (collection_id, sort_order, created_at DESC);

ALTER TABLE public.marketplace_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_collection_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view live marketplace collections"
  ON public.marketplace_collections FOR SELECT TO public
  USING (status = 'active' AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "Admins manage marketplace collections"
  ON public.marketplace_collections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "Public can view products in live collections"
  ON public.marketplace_collection_products FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.marketplace_collections c
    WHERE c.id = collection_id
      AND c.status = 'active'
      AND (c.starts_at IS NULL OR c.starts_at <= now())
      AND (c.ends_at IS NULL OR c.ends_at > now())
  ));
CREATE POLICY "Admins manage collection products"
  ON public.marketplace_collection_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

CREATE TRIGGER update_marketplace_collections_updated_at
  BEFORE UPDATE ON public.marketplace_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
