-- Cloud backup for unfinished seller listings. Files remain in the existing
-- device-local IndexedDB draft store until the listing is submitted; this table
-- stores the text, options, settings, and workflow position across devices.
CREATE TABLE IF NOT EXISTS public.seller_listing_drafts (
  seller_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_listing_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers can read their listing draft" ON public.seller_listing_drafts;
CREATE POLICY "Sellers can read their listing draft"
  ON public.seller_listing_drafts FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can create their listing draft" ON public.seller_listing_drafts;
CREATE POLICY "Sellers can create their listing draft"
  ON public.seller_listing_drafts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can update their listing draft" ON public.seller_listing_drafts;
CREATE POLICY "Sellers can update their listing draft"
  ON public.seller_listing_drafts FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers can delete their listing draft" ON public.seller_listing_drafts;
CREATE POLICY "Sellers can delete their listing draft"
  ON public.seller_listing_drafts FOR DELETE TO authenticated
  USING (auth.uid() = seller_id);

DROP TRIGGER IF EXISTS update_seller_listing_drafts_updated_at ON public.seller_listing_drafts;
CREATE TRIGGER update_seller_listing_drafts_updated_at
  BEFORE UPDATE ON public.seller_listing_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
