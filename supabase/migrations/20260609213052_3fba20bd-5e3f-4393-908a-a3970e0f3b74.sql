
-- =========================================================
-- PHASE 1: FOUNDATIONS
-- =========================================================

-- ---------- profiles extensions ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS preferred_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- ---------- seller_stores ----------
CREATE TABLE IF NOT EXISTS public.seller_stores (
  seller_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  banner_url text,
  logo_url text,
  bio text CHECK (bio IS NULL OR char_length(bio) <= 300),
  return_policy text,
  shipping_policy text,
  ships_to text[] NOT NULL DEFAULT ARRAY['worldwide']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seller_stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_stores TO authenticated;
GRANT ALL ON public.seller_stores TO service_role;
ALTER TABLE public.seller_stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view stores" ON public.seller_stores FOR SELECT USING (true);
CREATE POLICY "Sellers manage own store" ON public.seller_stores
  FOR ALL TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admins manage all stores" ON public.seller_stores
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::text))
  WITH CHECK (public.has_role(auth.uid(),'admin'::text));
CREATE TRIGGER trg_seller_stores_updated BEFORE UPDATE ON public.seller_stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- payout_methods ----------
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bank','paypal')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payout_methods_seller ON public.payout_methods(seller_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods TO authenticated;
GRANT ALL ON public.payout_methods TO service_role;
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seller manages own payout methods" ON public.payout_methods
  FOR ALL TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE TRIGGER trg_payout_methods_updated BEFORE UPDATE ON public.payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User reads own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "User updates own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User deletes own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------- currency_rates ----------
CREATE TABLE IF NOT EXISTS public.currency_rates (
  code text PRIMARY KEY,
  symbol text NOT NULL,
  rate_to_usd numeric NOT NULL CHECK (rate_to_usd > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.currency_rates TO anon, authenticated;
GRANT ALL ON public.currency_rates TO service_role;
ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads currency rates" ON public.currency_rates FOR SELECT USING (true);
CREATE POLICY "Admins write currency rates" ON public.currency_rates
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::text))
  WITH CHECK (public.has_role(auth.uid(),'admin'::text));

INSERT INTO public.currency_rates (code, symbol, rate_to_usd) VALUES
  ('USD','$',1),
  ('EUR','€',0.92),
  ('GBP','£',0.79),
  ('CAD','C$',1.37),
  ('AUD','A$',1.52),
  ('NGN','₦',1550),
  ('GHS','₵',15.5),
  ('KES','KSh',129),
  ('ZAR','R',18.4)
ON CONFLICT (code) DO NOTHING;

-- ---------- product_views ----------
CREATE TABLE IF NOT EXISTS public.product_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_product_views_product ON public.product_views(product_id, created_at DESC);
GRANT SELECT, INSERT ON public.product_views TO anon, authenticated;
GRANT ALL ON public.product_views TO service_role;
ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log views" ON public.product_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Seller reads own product views" ON public.product_views
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::text)
  );

-- ---------- review_replies ----------
CREATE TABLE IF NOT EXISTS public.review_replies (
  review_id uuid PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.review_replies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.review_replies TO authenticated;
GRANT ALL ON public.review_replies TO service_role;
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads replies" ON public.review_replies FOR SELECT USING (true);
CREATE POLICY "Seller writes own reply" ON public.review_replies
  FOR ALL TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE TRIGGER trg_review_replies_updated BEFORE UPDATE ON public.review_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- order_cancellations ----------
CREATE TABLE IF NOT EXISTS public.order_cancellations (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_cancellations TO authenticated;
GRANT ALL ON public.order_cancellations TO service_role;
ALTER TABLE public.order_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or seller reads cancellation" ON public.order_cancellations
  FOR SELECT TO authenticated USING (
    auth.uid() = buyer_id
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.seller_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::text)
  );
CREATE POLICY "Buyer writes own cancellation" ON public.order_cancellations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);

-- =========================================================
-- AUTO WALLET TRANSACTIONS ON DELIVERED
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_order_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_commission_rate numeric := 0.10; -- 10% platform fee
  v_gross numeric;
  v_commission numeric;
  v_net numeric;
  v_product_title text;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- ensure wallet exists
  INSERT INTO public.seller_wallets (seller_id, available_balance, pending_balance, total_earned)
  VALUES (NEW.seller_id, 0, 0, 0)
  ON CONFLICT (seller_id) DO NOTHING;

  SELECT id INTO v_wallet_id FROM public.seller_wallets WHERE seller_id = NEW.seller_id;

  v_gross := COALESCE(NEW.total_amount, 0);
  v_commission := round((v_gross * v_commission_rate)::numeric, 2);
  v_net := v_gross - v_commission;

  SELECT p.title INTO v_product_title
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id
  LIMIT 1;

  -- prevent duplicate sale entry per order
  IF NOT EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE wallet_id = v_wallet_id AND type = 'sale' AND description LIKE 'Order ' || NEW.id || '%'
  ) THEN
    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description)
    VALUES (v_wallet_id, 'sale', v_net,
      format('Order %s · %s · gross $%s commission $%s', NEW.id, COALESCE(v_product_title,'item'), v_gross, v_commission));

    INSERT INTO public.wallet_transactions (wallet_id, type, amount, description)
    VALUES (v_wallet_id, 'fee', v_commission,
      format('Commission on order %s', NEW.id));

    UPDATE public.seller_wallets
    SET available_balance = available_balance + v_net,
        total_earned = total_earned + v_net,
        updated_at = now()
    WHERE id = v_wallet_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_handle_delivered ON public.orders;
CREATE TRIGGER trg_orders_handle_delivered
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_order_delivered();

-- =========================================================
-- NOTIFICATION TRIGGERS
-- =========================================================

-- new order → notify seller
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (NEW.seller_id, 'order_new', 'New order received',
    format('Order %s for $%s', NEW.id, NEW.total_amount), '/seller/orders');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_notify_new ON public.orders;
CREATE TRIGGER trg_orders_notify_new AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

-- order status change → notify buyer
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (NEW.buyer_id, 'order_status',
      format('Order %s', NEW.status),
      format('Your order is now %s', NEW.status),
      '/buyer/orders');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_notify_status ON public.orders;
CREATE TRIGGER trg_orders_notify_status AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

-- new review → notify seller
CREATE OR REPLACE FUNCTION public.notify_new_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seller uuid;
BEGIN
  SELECT seller_id INTO v_seller FROM public.products WHERE id = NEW.product_id;
  IF v_seller IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (v_seller, 'review_new', 'New review received',
      format('You received a %s-star review', NEW.rating), '/seller/reviews');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_reviews_notify ON public.reviews;
CREATE TRIGGER trg_reviews_notify AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_review();

-- new dispute → notify both parties
CREATE OR REPLACE FUNCTION public.notify_new_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES
    (NEW.seller_id, 'dispute_new', 'Dispute opened', NEW.reason, '/seller/orders'),
    (NEW.buyer_id, 'dispute_new', 'Dispute submitted', 'We received your report', '/buyer/reports');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_disputes_notify ON public.disputes;
CREATE TRIGGER trg_disputes_notify AFTER INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_dispute();
