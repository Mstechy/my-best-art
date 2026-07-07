
-- Offer status enum
DO $$ BEGIN
  CREATE TYPE public.offer_status AS ENUM ('pending','accepted','countered','rejected','expired','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Offers table
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  note text,
  attachment_url text,
  status public.offer_status NOT NULL DEFAULT 'pending',
  parent_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);

CREATE INDEX IF NOT EXISTS idx_offers_buyer ON public.offers(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_seller ON public.offers(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_product ON public.offers(product_id);
CREATE INDEX IF NOT EXISTS idx_offers_status_expiry ON public.offers(status, expires_at);

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can read offers" ON public.offers;
CREATE POLICY "Participants can read offers" ON public.offers
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyer can create own offers" ON public.offers;
CREATE POLICY "Buyer can create own offers" ON public.offers
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Seller can update offers status" ON public.offers;
CREATE POLICY "Seller can update offers status" ON public.offers
  FOR UPDATE USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyer can cancel own offers" ON public.offers;
CREATE POLICY "Buyer can cancel own offers" ON public.offers
  FOR UPDATE USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Admins manage offers" ON public.offers;
CREATE POLICY "Admins manage offers" ON public.offers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_offers_updated_at ON public.offers;
CREATE TRIGGER trg_offers_updated_at BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bridge offer status changes into chat messages as system notices
CREATE OR REPLACE FUNCTION public.offer_status_to_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_title text;
  body text;
  sender uuid;
  receiver uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO product_title FROM public.products WHERE id = NEW.product_id;

  IF NEW.status = 'accepted' THEN
    body := format('Offer accepted: %s at $%s', COALESCE(product_title,'item'), NEW.amount);
    sender := NEW.seller_id; receiver := NEW.buyer_id;
  ELSIF NEW.status = 'rejected' THEN
    body := format('Offer rejected for %s', COALESCE(product_title,'item'));
    sender := NEW.seller_id; receiver := NEW.buyer_id;
  ELSIF NEW.status = 'countered' THEN
    body := format('Seller countered with a new offer for %s', COALESCE(product_title,'item'));
    sender := NEW.seller_id; receiver := NEW.buyer_id;
  ELSIF NEW.status = 'expired' THEN
    body := format('Offer expired for %s ($%s)', COALESCE(product_title,'item'), NEW.amount);
    sender := NEW.seller_id; receiver := NEW.buyer_id;
  ELSIF NEW.status = 'cancelled' THEN
    body := format('Buyer cancelled offer for %s', COALESCE(product_title,'item'));
    sender := NEW.buyer_id; receiver := NEW.seller_id;
  ELSIF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    body := format('New offer: $%s for %s', NEW.amount, COALESCE(product_title,'item'));
    sender := NEW.buyer_id; receiver := NEW.seller_id;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.messages (sender_id, receiver_id, content)
  VALUES (sender, receiver, body || format(' [product:%s] [offer:%s] [offer-id:%s]', NEW.product_id, NEW.amount, NEW.id));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_offer_status_message_ins ON public.offers;
CREATE TRIGGER trg_offer_status_message_ins AFTER INSERT ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offer_status_to_message();

DROP TRIGGER IF EXISTS trg_offer_status_message_upd ON public.offers;
CREATE TRIGGER trg_offer_status_message_upd AFTER UPDATE OF status ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.offer_status_to_message();

-- Allow validate_message_markers to accept system-generated [offer-id:UUID] markers (already permitted by current regex; no change needed)

-- Expire stale offers
CREATE OR REPLACE FUNCTION public.expire_stale_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated_count integer;
BEGIN
  UPDATE public.offers
    SET status = 'expired', responded_at = now()
    WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Realtime
ALTER TABLE public.offers REPLICA IDENTITY FULL;
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.offers';
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;

-- Disputes: validate order ownership when order_id is provided
CREATE OR REPLACE FUNCTION public.validate_dispute_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE o_buyer uuid; o_seller uuid;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  SELECT buyer_id, seller_id INTO o_buyer, o_seller FROM public.orders WHERE id = NEW.order_id;
  IF o_buyer IS NULL THEN RAISE EXCEPTION 'Order % not found', NEW.order_id; END IF;
  IF o_buyer <> NEW.buyer_id THEN RAISE EXCEPTION 'Order does not belong to reporting buyer'; END IF;
  IF NEW.seller_id IS DISTINCT FROM o_seller THEN
    NEW.seller_id := o_seller;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_dispute_order ON public.disputes;
CREATE TRIGGER trg_validate_dispute_order BEFORE INSERT OR UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.validate_dispute_order();
