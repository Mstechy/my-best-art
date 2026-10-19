-- Authoritative shipping quotes for checkout.
--
-- A quote is calculated from trusted product/variant prices and the seller's
-- shipping policy. The same calculation is called again while creating the
-- order, so the amount sent to Paystack cannot diverge from the checkout UI.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_delivery_from date,
  ADD COLUMN IF NOT EXISTS estimated_delivery_to date;

CREATE OR REPLACE FUNCTION public.quote_marketplace_shipping(
  p_seller_id uuid,
  p_items jsonb,
  p_destination text
)
RETURNS TABLE (
  shipping_amount numeric(12,2),
  currency text,
  shipping_known boolean,
  destination_supported boolean,
  delivery_min_date date,
  delivery_max_date date,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_product record;
  v_variant record;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_currency text;
  v_destination text := upper(trim(coalesce(p_destination, '')));
  v_store record;
  v_platform record;
  v_cost numeric(12,2);
  v_shipping_currency text;
  v_free_threshold numeric(12,2);
  v_processing_min integer;
  v_processing_max integer;
  v_delivery_min integer;
  v_delivery_max integer;
  v_shipping_amount numeric(12,2);
  v_region_supported boolean := true;
  v_has_store boolean := false;
  v_has_platform boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;
  IF p_seller_id IS NULL OR v_destination !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'A valid delivery country is required';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Provide between 1 and 50 order items';
  END IF;

  SELECT * INTO v_store FROM public.seller_stores WHERE seller_id = p_seller_id;
  v_has_store := FOUND;
  SELECT * INTO v_platform FROM public.platform_policies WHERE id = true;
  v_has_platform := FOUND;

  -- A seller-specific region list wins. If no seller store exists, use the
  -- platform region list. An empty list means no additional restriction.
  IF v_has_store AND cardinality(v_store.ships_to) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM unnest(v_store.ships_to) region
      WHERE lower(trim(region)) IN (lower(v_destination), 'worldwide')
    ) INTO v_region_supported;
  ELSIF v_has_platform AND cardinality(v_platform.shipping_regions) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM unnest(v_platform.shipping_regions) region
      WHERE lower(trim(region)) IN (lower(v_destination), 'worldwide')
    ) INTO v_region_supported;
  END IF;

  IF NOT v_region_supported THEN
    RAISE EXCEPTION 'This seller does not deliver to the selected country';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'product_variant_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 100 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    SELECT id, seller_id, price, currency, ships_to, status, is_approved
      INTO v_product
    FROM public.products
    WHERE id = v_product_id;
    IF NOT FOUND OR v_product.seller_id <> p_seller_id OR v_product.status <> 'active' OR v_product.is_approved <> true THEN
      RAISE EXCEPTION 'A product is unavailable or belongs to another seller';
    END IF;

    IF cardinality(v_product.ships_to) > 0 AND NOT EXISTS (
      SELECT 1 FROM unnest(v_product.ships_to) region
      WHERE lower(trim(region)) IN (lower(v_destination), 'worldwide')
    ) THEN
      RAISE EXCEPTION 'One or more items do not ship to the selected country';
    END IF;

    v_unit_price := v_product.price;
    IF v_variant_id IS NOT NULL THEN
      SELECT id, product_id, price, stock_quantity, is_active
        INTO v_variant
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id;
      IF NOT FOUND OR v_variant.is_active <> true THEN
        RAISE EXCEPTION 'The selected product option is unavailable';
      END IF;
      v_unit_price := coalesce(v_variant.price, v_product.price);
    END IF;

    IF v_currency IS NULL THEN v_currency := upper(v_product.currency);
    ELSIF v_currency <> upper(v_product.currency) THEN
      RAISE EXCEPTION 'Items from one seller must use the same currency';
    END IF;
    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  v_cost := coalesce(CASE WHEN v_has_store THEN v_store.shipping_cost_amount END, CASE WHEN v_has_platform THEN v_platform.shipping_cost_amount END);
  v_shipping_currency := upper(coalesce(CASE WHEN v_has_store THEN v_store.shipping_currency END, CASE WHEN v_has_platform THEN v_platform.shipping_currency END, v_currency));
  v_free_threshold := coalesce(CASE WHEN v_has_store THEN v_store.free_shipping_threshold END, CASE WHEN v_has_platform THEN v_platform.free_shipping_threshold END);
  v_processing_min := coalesce(CASE WHEN v_has_store THEN v_store.processing_days_min END, CASE WHEN v_has_platform THEN v_platform.processing_days_min END);
  v_processing_max := coalesce(CASE WHEN v_has_store THEN v_store.processing_days_max END, CASE WHEN v_has_platform THEN v_platform.processing_days_max END);
  v_delivery_min := coalesce(CASE WHEN v_has_store THEN v_store.delivery_days_min END, CASE WHEN v_has_platform THEN v_platform.delivery_days_min END);
  v_delivery_max := coalesce(CASE WHEN v_has_store THEN v_store.delivery_days_max END, CASE WHEN v_has_platform THEN v_platform.delivery_days_max END);

  IF v_shipping_currency <> v_currency THEN
    RETURN QUERY SELECT 0::numeric(12,2), v_currency, false, true, NULL::date, NULL::date,
      'Shipping currency is not configured for this order currency';
    RETURN;
  END IF;

  IF v_cost IS NULL THEN
    RETURN QUERY SELECT 0::numeric(12,2), v_currency, false, true, NULL::date, NULL::date,
      'Shipping fee is not configured for this seller';
    RETURN;
  END IF;

  v_shipping_amount := CASE WHEN v_free_threshold IS NOT NULL AND v_subtotal >= v_free_threshold THEN 0 ELSE v_cost END;

  RETURN QUERY SELECT
    v_shipping_amount,
    v_currency,
    true,
    true,
    CASE WHEN v_processing_min IS NOT NULL AND v_delivery_min IS NOT NULL
      THEN current_date + v_processing_min + v_delivery_min ELSE NULL::date END,
    CASE WHEN v_processing_max IS NOT NULL AND v_delivery_max IS NOT NULL
      THEN current_date + v_processing_max + v_delivery_max ELSE NULL::date END,
    CASE WHEN v_processing_min IS NOT NULL AND v_delivery_min IS NOT NULL
      THEN 'Delivery estimate based on seller processing and delivery windows'
      ELSE 'Delivery estimate is not configured for this seller' END;
END;
$$;

ALTER FUNCTION public.quote_marketplace_shipping(uuid, jsonb, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.quote_marketplace_shipping(uuid, jsonb, text) TO authenticated;

-- Replace the current reservation writer with the same shipping calculation.
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
  v_quote record;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_currency text;
  v_destination text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.orders
    WHERE idempotency_key = p_idempotency_key AND buyer_id = auth.uid();
    IF FOUND THEN RETURN v_existing_id; END IF;
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Provide between 1 and 50 order items';
  END IF;

  v_destination := upper(trim(coalesce(p_shipping_address->>'country', '')));
  IF p_shipping_address IS NULL OR coalesce(trim(p_shipping_address->>'name'), '') = ''
    OR coalesce(trim(p_shipping_address->>'street'), '') = ''
    OR coalesce(trim(p_shipping_address->>'city'), '') = '' OR v_destination !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'A complete shipping address with a valid country is required';
  END IF;

  INSERT INTO public.orders (buyer_id, seller_id, total_amount, shipping_amount, shipping_address, status, idempotency_key, idempotency_key_created_at)
  VALUES (auth.uid(), p_seller_id, 0, 0, p_shipping_address, 'pending', p_idempotency_key,
    CASE WHEN p_idempotency_key IS NOT NULL THEN now() ELSE NULL END)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'product_variant_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 100 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;

    SELECT id, seller_id, price, currency, stock_quantity, ships_to INTO v_product
    FROM public.products WHERE id = v_product_id AND status = 'active' AND is_approved = true FOR UPDATE;
    IF NOT FOUND OR v_product.seller_id <> p_seller_id THEN RAISE EXCEPTION 'A product is unavailable or belongs to another seller'; END IF;
    IF cardinality(v_product.ships_to) > 0 AND NOT EXISTS (
      SELECT 1 FROM unnest(v_product.ships_to) region WHERE lower(trim(region)) IN (lower(v_destination), 'worldwide')
    ) THEN RAISE EXCEPTION 'One or more items do not ship to the selected country'; END IF;

    v_unit_price := v_product.price;
    IF v_variant_id IS NOT NULL THEN
      SELECT id, product_id, price, stock_quantity INTO v_variant FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id AND is_active = true FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'The selected product option is unavailable'; END IF;
      IF v_variant.stock_quantity < v_quantity THEN RAISE EXCEPTION 'The selected product option does not have enough stock'; END IF;
      UPDATE public.product_variants SET stock_quantity = stock_quantity - v_quantity WHERE id = v_variant_id;
      v_unit_price := coalesce(v_variant.price, v_product.price);
    ELSE
      IF v_product.stock_quantity < v_quantity THEN RAISE EXCEPTION 'This product does not have enough stock'; END IF;
      UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_product_id;
    END IF;

    IF v_currency IS NULL THEN v_currency := upper(v_product.currency);
    ELSIF v_currency <> upper(v_product.currency) THEN RAISE EXCEPTION 'Items from one seller must use the same currency'; END IF;

    INSERT INTO public.order_items (order_id, product_id, product_variant_id, quantity, unit_price, total_price)
    VALUES (v_order_id, v_product_id, v_variant_id, v_quantity, v_unit_price, v_unit_price * v_quantity);
    INSERT INTO public.inventory_reservations (order_id, product_id, product_variant_id, quantity)
    VALUES (v_order_id, v_product_id, v_variant_id, v_quantity)
    ON CONFLICT (order_id, product_id, product_variant_id) DO NOTHING;
    v_total := v_total + (v_unit_price * v_quantity);
  END LOOP;

  SELECT * INTO v_quote FROM public.quote_marketplace_shipping(p_seller_id, p_items, v_destination);
  IF NOT v_quote.shipping_known THEN RAISE EXCEPTION '%', v_quote.message; END IF;
  UPDATE public.orders SET
    total_amount = v_total + v_quote.shipping_amount,
    shipping_amount = v_quote.shipping_amount,
    estimated_delivery_from = v_quote.delivery_min_date,
    estimated_delivery_to = v_quote.delivery_max_date,
    currency = coalesce(v_currency, 'NGN')
  WHERE id = v_order_id;

  PERFORM public.log_order_event(v_order_id, NULL, 'pending', 'Order created, shipping quoted, and inventory reserved');
  RETURN v_order_id;
END;
$$;

ALTER FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb, text) TO authenticated;
