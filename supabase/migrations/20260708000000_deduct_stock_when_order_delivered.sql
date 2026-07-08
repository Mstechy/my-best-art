-- Deduct product stock exactly once when an order is delivered.
-- A ledger makes the operation idempotent even if the delivered status is saved more than once.

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL DEFAULT 'order_delivered',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id, reason)
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

DROP POLICY IF EXISTS "Admins can read stock movements" ON public.stock_movements;
CREATE POLICY "Admins can read stock movements"
  ON public.stock_movements
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

CREATE OR REPLACE FUNCTION public.deduct_stock_for_delivered_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  inserted_count integer;
BEGIN
  IF NEW.status <> 'delivered'::order_status OR OLD.status = 'delivered'::order_status THEN
    RETURN NEW;
  END IF;

  FOR item IN
    SELECT product_id, sum(quantity)::integer AS quantity
    FROM public.order_items
    WHERE order_id = NEW.id
      AND product_id IS NOT NULL
    GROUP BY product_id
  LOOP
    INSERT INTO public.stock_movements (product_id, order_id, quantity, reason)
    VALUES (item.product_id, NEW.id, item.quantity, 'order_delivered')
    ON CONFLICT (order_id, product_id, reason) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;

    IF inserted_count = 1 THEN
      UPDATE public.products
      SET stock_quantity = greatest(stock_quantity - item.quantity, 0),
          updated_at = now()
      WHERE id = item.product_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.deduct_stock_for_delivered_order() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_orders_deduct_stock_delivered ON public.orders;
CREATE TRIGGER trg_orders_deduct_stock_delivered
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_stock_for_delivered_order();
