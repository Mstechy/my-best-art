
-- 1. Product variants
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Review titles
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS title text;

-- 3. Wishlist sharing
ALTER TABLE public.wishlists ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Public can read shared wishlists" ON public.wishlists;
CREATE POLICY "Public can read shared wishlists"
  ON public.wishlists FOR SELECT
  USING (is_public = true);

-- 4. Saved addresses
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text,
  recipient text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  region text,
  postal_code text,
  country text NOT NULL DEFAULT 'US',
  phone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own addresses" ON public.addresses;
CREATE POLICY "Users manage own addresses" ON public.addresses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all addresses" ON public.addresses;
CREATE POLICY "Admins read all addresses" ON public.addresses
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::text));

DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses;
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Dispute follow-up evidence
CREATE TABLE IF NOT EXISTS public.dispute_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  note text,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dispute_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read dispute updates" ON public.dispute_updates;
CREATE POLICY "Participants read dispute updates" ON public.dispute_updates
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::text) OR
    EXISTS (SELECT 1 FROM public.disputes d
            WHERE d.id = dispute_updates.dispute_id
              AND (d.buyer_id = auth.uid() OR d.seller_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Buyer or admin add dispute updates" ON public.dispute_updates;
CREATE POLICY "Buyer or admin add dispute updates" ON public.dispute_updates
  FOR INSERT WITH CHECK (
    auth.uid() = author_id AND (
      public.has_role(auth.uid(), 'admin'::text) OR
      EXISTS (SELECT 1 FROM public.disputes d
              WHERE d.id = dispute_updates.dispute_id
                AND d.buyer_id = auth.uid())
    )
  );

-- 6. Price drop notifier
CREATE OR REPLACE FUNCTION public.notify_price_drop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  w record;
  body text;
BEGIN
  IF NEW.price >= OLD.price THEN RETURN NEW; END IF;
  body := format('Price drop on %s: now $%s (was $%s) [product:%s]', NEW.title, NEW.price, OLD.price, NEW.id);
  FOR w IN SELECT user_id FROM public.wishlists WHERE product_id = NEW.id LOOP
    INSERT INTO public.messages (sender_id, receiver_id, content)
    VALUES (NEW.seller_id, w.user_id, body);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS price_drop_notifier ON public.products;
CREATE TRIGGER price_drop_notifier AFTER UPDATE OF price ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_price_drop();
