-- A seller can dispatch an order, but cannot self-confirm delivery. Delivery
-- completion drives inventory, earnings, reviews, and ranking metrics, so it
-- must come from the buyer, an authenticated carrier webhook, or an admin.

CREATE OR REPLACE FUNCTION public.update_seller_order_fulfillment(
  p_order_id uuid,
  p_status order_status DEFAULT NULL,
  p_carrier text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_estimated_delivery timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_order public.orders%ROWTYPE;
  next_carrier text;
  next_tracking_number text;
BEGIN
  SELECT * INTO current_order
  FROM public.orders
  WHERE id = p_order_id AND seller_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_status IS NOT NULL AND p_status <> current_order.status THEN
    IF NOT (
      (current_order.status = 'pending'::order_status AND p_status IN ('processing'::order_status, 'shipped'::order_status, 'cancelled'::order_status)) OR
      (current_order.status = 'processing'::order_status AND p_status IN ('shipped'::order_status, 'cancelled'::order_status))
    ) THEN
      RAISE EXCEPTION 'Invalid seller order status transition from % to %', current_order.status, p_status;
    END IF;
  END IF;

  next_carrier := coalesce(nullif(trim(p_carrier), ''), current_order.carrier);
  next_tracking_number := coalesce(nullif(trim(p_tracking_number), ''), current_order.tracking_number);
  IF p_status = 'shipped'::order_status AND (next_carrier IS NULL OR next_tracking_number IS NULL) THEN
    RAISE EXCEPTION 'Carrier and tracking number are required before shipping an order';
  END IF;

  UPDATE public.orders SET
    status = coalesce(p_status, status), carrier = next_carrier,
    tracking_number = next_tracking_number,
    estimated_delivery = coalesce(p_estimated_delivery, estimated_delivery), updated_at = now()
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_buyer_order_delivery(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = 'delivered'::order_status, updated_at = now()
  WHERE id = p_order_id
    AND buyer_id = auth.uid()
    AND status = 'shipped'::order_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a shipped order belonging to you can be confirmed as delivered';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_buyer_order_delivery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_buyer_order_delivery(uuid) TO authenticated;
