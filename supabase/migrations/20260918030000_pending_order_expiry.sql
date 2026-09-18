-- Bound unpaid order reservations until a payment provider is connected.
-- A scheduler should call expire_pending_marketplace_orders() every few minutes.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_pending_reservation_expiry
  ON public.orders (reservation_expires_at)
  WHERE status = 'pending'::order_status;

CREATE OR REPLACE FUNCTION public.set_pending_order_expiry()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'pending'::order_status AND NEW.reservation_expires_at IS NULL THEN
    NEW.reservation_expires_at := now() + interval '30 minutes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_set_pending_expiry ON public.orders;
CREATE TRIGGER trg_orders_set_pending_expiry
  BEFORE INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_pending_order_expiry();

CREATE OR REPLACE FUNCTION public.expire_pending_marketplace_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.orders
  SET status = 'cancelled'::order_status,
      updated_at = now()
  WHERE status = 'pending'::order_status
    AND reservation_expires_at IS NOT NULL
    AND reservation_expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER FUNCTION public.expire_pending_marketplace_orders() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.expire_pending_marketplace_orders() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_marketplace_orders() TO service_role;

-- Existing order RPCs are superseded by the security/inventory migration.
-- New orders receive a bounded reservation window until payment is confirmed.
