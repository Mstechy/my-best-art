-- Paystack payment references and lifecycle. Card details never enter this database.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_status_check') THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
      CHECK (payment_status IN ('unpaid', 'initialized', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_reference
  ON public.orders (payment_reference) WHERE payment_reference IS NOT NULL;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Buyers can read own payment status" ON public.orders;
CREATE POLICY "Buyers can read own payment status" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id);
DROP POLICY IF EXISTS "Sellers can read order payment status" ON public.orders;
CREATE POLICY "Sellers can read order payment status" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);
NOTIFY pgrst, 'reload schema';
