-- Complete inventory lifecycle and maintained ranking metrics.

-- Reservation ledger makes checkout reservation and cancellation/restock explicit.
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  UNIQUE (order_id, product_id, product_variant_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_status ON public.inventory_reservations(order_id, status);
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Buyers can read own reservations" ON public.inventory_reservations;
CREATE POLICY "Buyers can read own reservations" ON public.inventory_reservations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::text))));

-- Maintained ranking counters avoid correlated scans over orders/events.
CREATE TABLE IF NOT EXISTS public.product_metrics (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  delivered_units bigint NOT NULL DEFAULT 0,
  discovery_events_30d bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_metrics ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.product_metrics TO anon, authenticated;
DROP POLICY IF EXISTS "Public can read product metrics" ON public.product_metrics;
CREATE POLICY "Public can read product metrics" ON public.product_metrics FOR SELECT TO anon, authenticated USING (true);

-- Replace delivery stock deduction: stock was already reserved at checkout.
DROP TRIGGER IF EXISTS trg_orders_deduct_stock_delivered ON public.orders;
DROP FUNCTION IF EXISTS public.deduct_stock_for_delivered_order();

CREATE OR REPLACE FUNCTION public.release_inventory_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'cancelled'::order_status AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR r IN SELECT * FROM public.inventory_reservations WHERE order_id = NEW.id AND status = 'reserved' FOR UPDATE LOOP
      IF r.product_variant_id IS NULL THEN
        UPDATE public.products SET stock_quantity = stock_quantity + r.quantity, updated_at = now() WHERE id = r.product_id;
      ELSE
        UPDATE public.product_variants SET stock_quantity = stock_quantity + r.quantity WHERE id = r.product_variant_id;
      END IF;
      UPDATE public.inventory_reservations SET status = 'released', released_at = now() WHERE id = r.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_release_inventory_cancel ON public.orders;
CREATE TRIGGER trg_orders_release_inventory_cancel AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.release_inventory_on_cancel();

CREATE OR REPLACE FUNCTION public.refresh_product_metrics_for_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'delivered'::order_status AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.product_metrics(product_id, delivered_units, updated_at)
    SELECT product_id, sum(quantity), now() FROM public.order_items WHERE order_id = NEW.id AND product_id IS NOT NULL GROUP BY product_id
    ON CONFLICT(product_id) DO UPDATE SET delivered_units = product_metrics.delivered_units + EXCLUDED.delivered_units, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_refresh_product_metrics ON public.orders;
CREATE TRIGGER trg_orders_refresh_product_metrics AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.refresh_product_metrics_for_order();

-- Seller fulfillment RPC: only approved fulfillment fields can be changed.
CREATE OR REPLACE FUNCTION public.update_seller_order_fulfillment(
  p_order_id uuid,
  p_status order_status DEFAULT NULL,
  p_carrier text DEFAULT NULL,
  p_tracking_number text DEFAULT NULL,
  p_estimated_delivery timestamptz DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_status order_status;
BEGIN
  SELECT status INTO current_status FROM public.orders WHERE id = p_order_id AND seller_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('processing', 'shipped', 'delivered', 'cancelled') THEN RAISE EXCEPTION 'Invalid fulfillment status'; END IF;
  UPDATE public.orders SET
    status = coalesce(p_status, status),
    carrier = coalesce(p_carrier, carrier),
    tracking_number = coalesce(p_tracking_number, tracking_number),
    estimated_delivery = coalesce(p_estimated_delivery, estimated_delivery),
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;
ALTER FUNCTION public.update_seller_order_fulfillment(uuid, order_status, text, text, timestamptz) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.update_seller_order_fulfillment(uuid, order_status, text, text, timestamptz) TO authenticated;
DROP POLICY IF EXISTS "Sellers can update own orders" ON public.orders;

-- Keep only the latest metrics path for new discovery events.
CREATE OR REPLACE FUNCTION public.track_product_discovery_event(
  p_product_ids uuid[], p_event_type text, p_visitor_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_event_type NOT IN ('impression', 'view', 'click', 'wishlist', 'add_to_cart') OR cardinality(p_product_ids) = 0 OR cardinality(p_product_ids) > 48 THEN RAISE EXCEPTION 'Invalid discovery event'; END IF;
  INSERT INTO public.product_discovery_events (product_id, event_type, visitor_id, user_id)
  SELECT p.id, p_event_type, p_visitor_id, auth.uid() FROM public.products p
  WHERE p.id = ANY(p_product_ids) AND p.status = 'active' AND p.is_approved = true;
  INSERT INTO public.product_metrics(product_id, discovery_events_30d, updated_at)
  SELECT unnest(p_product_ids), cardinality(p_product_ids), now()
  ON CONFLICT(product_id) DO UPDATE SET discovery_events_30d = product_metrics.discovery_events_30d + EXCLUDED.discovery_events_30d, updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.track_product_discovery_event(uuid[], text, uuid) TO anon, authenticated;
