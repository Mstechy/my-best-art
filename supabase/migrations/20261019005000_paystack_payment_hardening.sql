-- Harden payment lifecycle for marketplace checkout.
-- One Paystack transaction can cover several seller orders, so a payment
-- reference is shared by the batch and must not be unique per order.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('unpaid', 'initialized', 'paid', 'failed', 'refund_required', 'refunded'));

DROP INDEX IF EXISTS public.idx_orders_payment_reference;
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference
  ON public.orders (payment_reference) WHERE payment_reference IS NOT NULL;
