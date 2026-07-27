-- ============================================================================
-- Migration: Add idempotency key + order audit trail
-- 
-- This is an ADDITIVE migration. It adds:
--   1. idempotency_key column to orders table (unique constraint)
--   2. order_events table for immutable audit trail
--   3. Updated place_marketplace_order that accepts idempotency key
--   4. Function to log order events
--
-- Zero breaking changes. Existing rows get null idempotency_key.
-- All existing queries, RPCs, and code continue to work.
-- ============================================================================

-- 1. Add idempotency key to orders (nullable, existing rows unaffected)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key_created_at timestamptz;

-- Unique index for idempotency (ONLY for non-null keys, so existing nulls don't conflict)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key ON public.orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Order events audit table (immutable append-only log)
CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  note text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON public.order_events (order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created_at ON public.order_events (created_at DESC);

-- 3. Function to log order events (used by triggers and manual calls)
CREATE OR REPLACE FUNCTION public.log_order_event(
  p_order_id uuid,
  p_from_status text,
  p_to_status text,
  p_note text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.order_events (order_id, from_status, to_status, note, metadata, created_by)
  VALUES (p_order_id, p_from_status, p_to_status, p_note, p_metadata, auth.uid())
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_order_event(uuid, text, text, text, jsonb) TO authenticated;

-- 4. Updated order placement RPC with idempotency key
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
  v_item jsonb;
  v_product record;
  v_variant record;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_total numeric(12,2) := 0;
  v_currency text;
  v_existing_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication is required'; END IF;

  -- Idempotency check: if key provided and order exists, return existing order ID
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.orders
    WHERE idempotency_key = p_idempotency_key AND buyer_id = auth.uid();
    IF FOUND THEN
      RETURN v_existing_id;
    END IF;
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Provide between 1 and 50 order items';
  END IF;
  IF p_shipping_address IS NULL OR coalesce(trim(p_shipping_address->>'name'), '') = '' OR coalesce(trim(p_shipping_address->>'street'), '') = '' OR coalesce(trim(p_shipping_address->>'city'), '') = '' OR coalesce(trim(p_shipping_address->>'country'), '') = '' THEN
    RAISE EXCEPTION 'A complete shipping address is required';
  END IF;

  INSERT INTO public.orders (buyer_id, seller_id, total_amount, shipping_address, status, idempotency_key, idempotency_key_created_at)
  VALUES (auth.uid(), p_seller_id, 0, p_shipping_address, 'pending', p_idempotency_key, CASE WHEN p_idempotency_key IS NOT NULL THEN now() ELSE NULL END)
  RETURNING id INTO v_order_id;

  -- Log the creation event
  PERFORM public.log_order_event(v_order_id, NULL, 'pending', 'Order created');

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

ALTER FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.place_marketplace_order(uuid, jsonb, jsonb, text) TO authenticated;

-- Keep the old signature working for backwards compatibility
DROP FUNCTION IF EXISTS public.place_marketplace_order(uuid, jsonb, jsonb);