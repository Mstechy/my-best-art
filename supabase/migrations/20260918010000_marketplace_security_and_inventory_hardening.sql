-- Marketplace security and inventory hardening.
-- This migration supersedes broad profile reads and the non-locking checkout RPC.

-- Public profile data must come from the intentionally limited public views.
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;

-- Keep direct profile access private to the account owner and existing
-- relationship-specific policies. Public seller/buyer views remain readable.
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Audit events are written by trusted RPCs/triggers, never arbitrary clients.
REVOKE EXECUTE ON FUNCTION public.log_order_event(uuid, text, text, text, jsonb) FROM anon, authenticated;

-- Prevent client-side role escalation, including legacy self-assignment policies.
DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;
DROP POLICY IF EXISTS "Users can create safe buyer or seller role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can self-assign buyer role only" ON public.user_roles;

CREATE OR REPLACE FUNCTION public.place_marketplace_order(
  p_seller_id uuid,
  p_items jsonb,
  p_shipping_address jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_existing_id uuid;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_currency text;
  v_destination text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key AND buyer_id = auth.uid();
    IF FOUND THEN RETURN v_existing_id; END IF;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Provide between 1 and 50 order items';
  END IF;

  v_destination := upper(trim(coalesce(p_shipping_address->>'country', '')));
  IF p_shipping_address IS NULL
    OR coalesce(trim(p_shipping_address->>'name'), '') = ''
    OR coalesce(trim(p_shipping_address->>'street'), '') = ''
    OR coalesce(trim(p_shipping_address->>'city'), '') = ''
    OR v_destination !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'A complete shipping address with a valid country is required';
  END IF;

  INSERT INTO public.orders (buyer_id, seller_id, total_amount, shipping_address, status, idempotency_key, idempotency_key_created_at)
  VALUES (auth.uid(), p_seller_id, 0, p_shipping_address, 'pending', p_idempotency_key,
    CASE WHEN p_idempotency_key IS NOT NULL THEN now() ELSE NULL END)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'product_variant_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;

    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 100 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    -- Row locks make the stock check and decrement one atomic transaction.
    SELECT id, seller_id, price, currency, stock_quantity, ships_to
      INTO v_product
    FROM public.products
    WHERE id = v_product_id AND status = 'active' AND is_approved = true
    FOR UPDATE;

    IF NOT FOUND OR v_product.seller_id <> p_seller_id THEN
      RAISE EXCEPTION 'A product is unavailable or belongs to another seller';
    END IF;

    IF cardinality(v_product.ships_to) > 0
      AND NOT (v_destination = ANY(v_product.ships_to) OR 'worldwide' = ANY(v_product.ships_to)) THEN
      RAISE EXCEPTION 'One or more items do not ship to the selected country';
    END IF;

    v_unit_price := v_product.price;
    IF v_variant_id IS NOT NULL THEN
      SELECT id, product_id, price, stock_quantity
        INTO v_variant
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id AND is_active = true
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'The selected product option is unavailable'; END IF;
      IF v_variant.stock_quantity < v_quantity THEN RAISE EXCEPTION 'The selected product option does not have enough stock'; END IF;
      UPDATE public.product_variants SET stock_quantity = stock_quantity - v_quantity WHERE id = v_variant_id;
      v_unit_price := coalesce(v_variant.price, v_product.price);
    ELSE
      IF v_product.stock_quantity < v_quantity THEN RAISE EXCEPTION 'This product does not have enough stock'; END IF;
      UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_product_id;
    END IF;

    IF v_currency IS NULL THEN v_currency := v_product.currency;
    ELSIF v_currency <> v_product.currency THEN
      RAISE EXCEPTION 'Items from one seller must use the same currency';
    END IF;

    INSERT INTO public.order_items (order_id, product_id, product_variant_id, quantity, unit_price, total_price)
    VALUES (v_order_id, v_product_id, v_variant_id, v_quantity, v_unit_price, v_unit_price * v_quantity);
    v_total := v_total + (v_unit_price * v_quantity);
  END LOOP;

  UPDATE public.orders
  SET total_amount = v_total, currency = coalesce(v_currency, 'USD')
  WHERE id = v_order_id;

  PERFORM public.log_order_event(v_order_id, NULL, 'pending', 'Order created and inventory reserved');
  RETURN v_order_id;
END;
$$;

ALTER FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb, text) TO authenticated;
DROP FUNCTION IF EXISTS public.place_marketplace_order(uuid, jsonb, jsonb);

NOTIFY pgrst, 'reload schema';
