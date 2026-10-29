-- An order must be paid before it can enter fulfilment.
-- Cancellation of an unpaid reservation remains valid and is intentionally
-- excluded from this guard.

CREATE OR REPLACE FUNCTION public.prevent_unpaid_order_fulfillment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    AND NEW.status IN ('processing'::order_status, 'shipped'::order_status, 'delivered'::order_status)
    AND NEW.payment_status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'An order must be paid before fulfilment';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unpaid_order_fulfillment ON public.orders;
CREATE TRIGGER trg_prevent_unpaid_order_fulfillment
  BEFORE UPDATE OF status, payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unpaid_order_fulfillment();

REVOKE ALL ON FUNCTION public.prevent_unpaid_order_fulfillment() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
