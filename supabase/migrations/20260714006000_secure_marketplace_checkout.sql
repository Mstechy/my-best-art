-- Create orders from trusted catalogue data, never browser-supplied prices or seller IDs.
CREATE OR REPLACE FUNCTION public.place_marketplace_order(
  p_seller_id uuid,
  p_items jsonb,
  p_shipping_address jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_currency text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Provide between 1 and 50 order items';
  END IF;
  IF p_shipping_address IS NULL OR coalesce(trim(p_shipping_address->>'name'), '') = '' OR coalesce(trim(p_shipping_address->>'street'), '') = '' OR coalesce(trim(p_shipping_address->>'city'), '') = '' OR coalesce(trim(p_shipping_address->>'country'), '') = '' THEN
    RAISE EXCEPTION 'A complete shipping address is required';
  END IF;

  INSERT INTO public.orders (buyer_id, seller_id, total_amount, shipping_address, status)
  VALUES (auth.uid(), p_seller_id, 0, p_shipping_address, 'pending') RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'product_variant_id', '')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 100 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;

    SELECT id, seller_id, price, currency, stock_quantity INTO v_product
    FROM public.products WHERE id = v_product_id AND status = 'active' AND is_approved = true FOR SHARE;
    IF NOT FOUND OR v_product.seller_id <> p_seller_id THEN RAISE EXCEPTION 'A product is unavailable or belongs to another seller'; END IF;

    v_unit_price := v_product.price;
    IF v_variant_id IS NOT NULL THEN
      SELECT id, product_id, price, stock_quantity INTO v_variant FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id AND is_active = true FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'The selected product option is unavailable'; END IF;
      IF v_variant.stock_quantity < v_quantity THEN RAISE EXCEPTION 'The selected product option does not have enough stock'; END IF;
      v_unit_price := coalesce(v_variant.price, v_product.price);
    ELSIF v_product.stock_quantity < v_quantity THEN
      RAISE EXCEPTION 'This product does not have enough stock';
    END IF;

    IF v_currency IS NULL THEN v_currency := v_product.currency;
    ELSIF v_currency <> v_product.currency THEN RAISE EXCEPTION 'Items from one seller must use the same currency'; END IF;
    INSERT INTO public.order_items (order_id, product_id, product_variant_id, quantity, unit_price, total_price)
    VALUES (v_order_id, v_product_id, v_variant_id, v_quantity, v_unit_price, v_unit_price * v_quantity);
    v_total := v_total + (v_unit_price * v_quantity);
  END LOOP;

  UPDATE public.orders SET total_amount = v_total, currency = coalesce(v_currency, 'USD') WHERE id = v_order_id;
  RETURN v_order_id;
END;
$$;

ALTER FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb) TO authenticated;
