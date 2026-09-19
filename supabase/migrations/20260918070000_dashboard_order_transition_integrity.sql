-- Dashboard actions are convenience UI; order-state integrity must be enforced
-- by the database so callers cannot skip workflow steps through the API.

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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF p_status IS NOT NULL AND p_status <> current_order.status THEN
    IF NOT (
      (current_order.status = 'pending'::order_status AND p_status IN ('processing'::order_status, 'shipped'::order_status, 'cancelled'::order_status)) OR
      (current_order.status = 'processing'::order_status AND p_status IN ('shipped'::order_status, 'cancelled'::order_status)) OR
      (current_order.status = 'shipped'::order_status AND p_status = 'delivered'::order_status)
    ) THEN
      RAISE EXCEPTION 'Invalid order status transition from % to %', current_order.status, p_status;
    END IF;
  END IF;

  next_carrier := coalesce(nullif(trim(p_carrier), ''), current_order.carrier);
  next_tracking_number := coalesce(nullif(trim(p_tracking_number), ''), current_order.tracking_number);

  IF p_status = 'shipped'::order_status AND (next_carrier IS NULL OR next_tracking_number IS NULL) THEN
    RAISE EXCEPTION 'Carrier and tracking number are required before shipping an order';
  END IF;

  UPDATE public.orders
  SET
    status = coalesce(p_status, status),
    carrier = next_carrier,
    tracking_number = next_tracking_number,
    estimated_delivery = coalesce(p_estimated_delivery, estimated_delivery),
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_buyer_order_cancellation(
  p_order_id uuid,
  p_reason text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status order_status;
BEGIN
  SELECT status INTO current_status
  FROM public.orders
  WHERE id = p_order_id AND buyer_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF current_status <> 'pending'::order_status THEN
    RAISE EXCEPTION 'Only orders awaiting seller confirmation can be cancelled';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'::order_status, updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_cancellations (order_id, buyer_id, reason, note)
  VALUES (p_order_id, auth.uid(), trim(p_reason), nullif(trim(coalesce(p_note, '')), ''));
END;
$$;

REVOKE ALL ON FUNCTION public.update_seller_order_fulfillment(uuid, order_status, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_buyer_order_cancellation(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_seller_order_fulfillment(uuid, order_status, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_buyer_order_cancellation(uuid, text, text) TO authenticated;
