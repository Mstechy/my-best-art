-- Order display snapshots, safe existing-order backfill, and seller-only order reads.
-- Snapshot values are copied from the catalogue at purchase time.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS variant text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_recipient_name text,
  ADD COLUMN IF NOT EXISTS shipping_phone text,
  ADD COLUMN IF NOT EXISTS shipping_address_line text,
  ADD COLUMN IF NOT EXISTS shipping_city text,
  ADD COLUMN IF NOT EXISTS shipping_country text;

-- Backfill only rows that already have a real product or variant link. No placeholder
-- products are created. Notices identify legacy orders that still need mapping.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT o.id FROM public.orders o
    WHERE NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  LOOP
    RAISE NOTICE 'Order % has no order_items and was not backfilled; product mapping is required', r.id;
  END LOOP;
END $$;

UPDATE public.order_items oi
SET title = p.title,
    image_url = COALESCE(
      (SELECT v.image_url FROM public.product_variants v WHERE v.id = oi.product_variant_id),
      (SELECT pi.image_url FROM public.product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1)
    ),
    variant = (
      SELECT string_agg(e.key || ': ' || e.value, ' / ' ORDER BY e.key)
      FROM public.product_variants v
      CROSS JOIN LATERAL jsonb_each_text(v.option_values) AS e(key, value)
      WHERE v.id = oi.product_variant_id
    )
FROM public.products p
WHERE oi.product_id = p.id;

UPDATE public.orders o
SET shipping_recipient_name = COALESCE(shipping_recipient_name, o.shipping_address->>'name'),
    shipping_phone = COALESCE(shipping_phone, o.shipping_address->>'phone'),
    shipping_address_line = COALESCE(shipping_address_line,
      NULLIF(trim(concat_ws(', ', o.shipping_address->>'street', o.shipping_address->>'region', o.shipping_address->>'zip')), '')),
    shipping_city = COALESCE(shipping_city, o.shipping_address->>'city'),
    shipping_country = COALESCE(shipping_country, o.shipping_address->>'country')
WHERE o.shipping_address IS NOT NULL;

-- Replace legacy policies so seller access is explicitly scoped to seller_id.
DROP POLICY IF EXISTS "Sellers can read own orders" ON public.orders;
CREATE POLICY "Sellers can read own orders" ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = seller_id);
DROP POLICY IF EXISTS "Users can read own order items" ON public.order_items;
CREATE POLICY "Users can read own order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
    AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())));


-- Sellers may read only the buyer profile attached to one of their own orders.
-- The application selects only user_id/full_name; email is never needed here.
DROP POLICY IF EXISTS "Sellers can view buyer profiles (for orders)" ON public.profiles;
CREATE POLICY "Sellers can view buyer profiles (for orders)" ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.buyer_id = profiles.user_id AND o.seller_id = auth.uid()));

-- The checkout RPC remains the trusted writer of product and variant snapshots.
CREATE OR REPLACE FUNCTION public.place_marketplace_order(
  p_seller_id uuid, p_items jsonb, p_shipping_address jsonb, p_idempotency_key text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid; v_existing_id uuid; v_item jsonb; v_product record; v_variant record;
  v_product_id uuid; v_variant_id uuid; v_quantity integer; v_unit_price numeric(12,2);
  v_total numeric(12,2) := 0; v_currency text; v_destination text; v_variant_label text; v_image_url text;
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
  IF p_shipping_address IS NULL OR trim(coalesce(p_shipping_address->>'name','')) = ''
    OR trim(coalesce(p_shipping_address->>'street','')) = '' OR trim(coalesce(p_shipping_address->>'city','')) = ''
    OR v_destination !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'A complete shipping address with a valid country is required';
  END IF;
  INSERT INTO public.orders (buyer_id, seller_id, total_amount, shipping_address, status,
    idempotency_key, idempotency_key_created_at, shipping_recipient_name, shipping_phone,
    shipping_address_line, shipping_city, shipping_country)
  VALUES (auth.uid(), p_seller_id, 0, p_shipping_address, 'pending', p_idempotency_key,
    CASE WHEN p_idempotency_key IS NOT NULL THEN now() ELSE NULL END,
    p_shipping_address->>'name', p_shipping_address->>'phone',
    concat_ws(', ', p_shipping_address->>'street', p_shipping_address->>'region', p_shipping_address->>'zip'),
    p_shipping_address->>'city', p_shipping_address->>'country') RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_variant_id := NULLIF(v_item->>'product_variant_id','')::uuid;
    v_quantity := (v_item->>'quantity')::integer;
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 100 THEN RAISE EXCEPTION 'Invalid item quantity'; END IF;
    SELECT id, seller_id, price, currency, stock_quantity, ships_to INTO v_product
      FROM public.products WHERE id = v_product_id AND status = 'active' AND is_approved = true FOR UPDATE;
    IF NOT FOUND OR v_product.seller_id <> p_seller_id THEN
      RAISE EXCEPTION 'A product is unavailable or belongs to another seller';
    END IF;
    IF cardinality(v_product.ships_to) > 0 AND NOT (v_destination = ANY(v_product.ships_to) OR 'worldwide' = ANY(v_product.ships_to)) THEN
      RAISE EXCEPTION 'One or more items do not ship to the selected country';
    END IF;
    v_unit_price := v_product.price;
    v_variant_label := NULL;
    v_image_url := NULL;
    IF v_variant_id IS NOT NULL THEN
      SELECT id, product_id, price, stock_quantity, option_values, image_url INTO v_variant
        FROM public.product_variants WHERE id = v_variant_id AND product_id = v_product_id AND is_active = true FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'The selected product option is unavailable'; END IF;
      IF v_variant.stock_quantity < v_quantity THEN RAISE EXCEPTION 'The selected product option does not have enough stock'; END IF;
      UPDATE public.product_variants SET stock_quantity = stock_quantity - v_quantity WHERE id = v_variant_id;
      v_image_url := v_variant.image_url;
      v_unit_price := coalesce(v_variant.price, v_product.price);
      SELECT string_agg(e.key || ': ' || e.value, ' / ' ORDER BY e.key) INTO v_variant_label
        FROM jsonb_each_text(v_variant.option_values) e;
    ELSE
      IF v_product.stock_quantity < v_quantity THEN RAISE EXCEPTION 'This product does not have enough stock'; END IF;
      UPDATE public.products SET stock_quantity = stock_quantity - v_quantity WHERE id = v_product_id;
    END IF;
    IF v_currency IS NULL THEN v_currency := v_product.currency;
    ELSIF v_currency <> v_product.currency THEN RAISE EXCEPTION 'Items from one seller must use the same currency'; END IF;

    INSERT INTO public.order_items (order_id, product_id, product_variant_id, quantity,
      unit_price, total_price, title, image_url, variant)
    VALUES (v_order_id, v_product_id, v_variant_id, v_quantity, v_unit_price,
      v_unit_price * v_quantity, v_product.title,
      coalesce(v_image_url, (SELECT pi.image_url FROM public.product_images pi
        WHERE pi.product_id = v_product.id ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1)),
      v_variant_label);
    v_total := v_total + (v_unit_price * v_quantity);
  END LOOP;
  UPDATE public.orders SET total_amount = v_total, currency = coalesce(v_currency, 'NGN') WHERE id = v_order_id;
  PERFORM public.log_order_event(v_order_id, NULL, 'pending', 'Order created and inventory reserved');
  RETURN v_order_id;
END; $$;
ALTER FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb, text) TO authenticated;
NOTIFY pgrst, 'reload schema';

