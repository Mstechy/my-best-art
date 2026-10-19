-- Make a multi-seller checkout atomic.
--
-- The single-seller writer already validates prices, shipping, inventory, and
-- idempotency. Calling it inside one wrapper transaction keeps a failure for
-- any seller from leaving earlier seller orders and stock reservations behind.
CREATE OR REPLACE FUNCTION public.place_marketplace_orders(
  p_orders jsonb,
  p_shipping_address jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order jsonb;
  v_seller_id uuid;
  v_order_id uuid;
  v_order_ids uuid[] := ARRAY[]::uuid[];
  v_seen_sellers uuid[] := ARRAY[]::uuid[];
  v_seller_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  IF jsonb_typeof(p_orders) <> 'array' OR jsonb_array_length(p_orders) = 0 OR jsonb_array_length(p_orders) > 50 THEN
    RAISE EXCEPTION 'Provide between 1 and 50 seller orders';
  END IF;

  FOR v_order IN SELECT value FROM jsonb_array_elements(p_orders) LOOP
    IF jsonb_typeof(v_order) <> 'object'
      OR coalesce(trim(v_order->>'seller_id'), '') = ''
      OR jsonb_typeof(v_order->'items') <> 'array' THEN
      RAISE EXCEPTION 'Each seller order must include a seller and item list';
    END IF;

    v_seller_id := (v_order->>'seller_id')::uuid;
    IF v_seller_id = ANY(v_seen_sellers) THEN
      RAISE EXCEPTION 'Each seller may appear only once per checkout';
    END IF;
    v_seen_sellers := array_append(v_seen_sellers, v_seller_id);

    v_seller_key := CASE
      WHEN p_idempotency_key IS NULL THEN NULL
      ELSE p_idempotency_key || ':' || v_seller_id::text
    END;
    v_order_id := public.place_marketplace_order(
      v_seller_id,
      v_order->'items',
      p_shipping_address,
      v_seller_key
    );
    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  RETURN v_order_ids;
END;
$$;

ALTER FUNCTION public.place_marketplace_orders(jsonb, jsonb, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.place_marketplace_orders(jsonb, jsonb, text) TO authenticated;
