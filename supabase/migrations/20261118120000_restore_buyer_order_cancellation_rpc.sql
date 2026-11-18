-- Forward-only repair for environments where the order cancellation table was
-- deployed but the RPC was not present in the PostgREST schema cache.
-- Keep the older migration immutable; this redeclaration is safe when the
-- function already exists and creates it when a deployment skipped that step.

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
  current_status public.order_status;
BEGIN
  SELECT status INTO current_status
  FROM public.orders
  WHERE id = p_order_id
    AND buyer_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF current_status <> 'pending'::public.order_status THEN
    RAISE EXCEPTION 'Only orders awaiting seller confirmation can be cancelled';
  END IF;

  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'::public.order_status,
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.order_cancellations (order_id, buyer_id, reason, note)
  VALUES (
    p_order_id,
    auth.uid(),
    trim(p_reason),
    nullif(trim(coalesce(p_note, '')), '')
  )
  ON CONFLICT (order_id) DO NOTHING;
END;
$$;

ALTER FUNCTION public.request_buyer_order_cancellation(uuid, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.request_buyer_order_cancellation(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_buyer_order_cancellation(uuid, text, text) TO authenticated;

-- PostgREST needs to refresh its function catalogue after a function is
-- redeclared outside the API transaction.
NOTIFY pgrst, 'reload schema';
