-- Optional SKU-level inventory. Products without rows here continue to use products.stock_quantity.
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku text,
  option_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  price numeric(12,2),
  compare_at_price numeric(12,2),
  stock_quantity integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, option_values),
  UNIQUE NULLS NOT DISTINCT (product_id, sku)
);

CREATE INDEX product_variants_browse_idx ON public.product_variants (product_id, is_active, sort_order);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read active product variants" ON public.product_variants FOR SELECT TO public
  USING (is_active AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active' AND p.is_approved = true));
CREATE POLICY "Sellers manage own product variants" ON public.product_variants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid()));
CREATE POLICY "Admins manage product variants" ON public.product_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text)) WITH CHECK (public.has_role(auth.uid(), 'admin'::text));
CREATE TRIGGER update_product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_items ADD COLUMN product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
CREATE INDEX order_items_variant_idx ON public.order_items (product_variant_id) WHERE product_variant_id IS NOT NULL;

CREATE TABLE public.variant_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  reason text NOT NULL DEFAULT 'order_delivered',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_variant_id, reason)
);
ALTER TABLE public.variant_stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read variant stock movements" ON public.variant_stock_movements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));

-- Replace the delivery trigger so a variant order reduces its own stock, not parent stock.
CREATE OR REPLACE FUNCTION public.deduct_stock_for_delivered_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item record; inserted_count integer;
BEGIN
  IF NEW.status <> 'delivered'::order_status OR OLD.status = 'delivered'::order_status THEN RETURN NEW; END IF;
  FOR item IN SELECT product_id, product_variant_id, sum(quantity)::integer AS quantity FROM public.order_items WHERE order_id = NEW.id GROUP BY product_id, product_variant_id LOOP
    IF item.product_variant_id IS NOT NULL THEN
      INSERT INTO public.variant_stock_movements (product_variant_id, order_id, quantity) VALUES (item.product_variant_id, NEW.id, item.quantity) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS inserted_count = ROW_COUNT;
      IF inserted_count = 1 THEN UPDATE public.product_variants SET stock_quantity = greatest(stock_quantity - item.quantity, 0), updated_at = now() WHERE id = item.product_variant_id; END IF;
    ELSE
      INSERT INTO public.stock_movements (product_id, order_id, quantity, reason) VALUES (item.product_id, NEW.id, item.quantity, 'order_delivered') ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS inserted_count = ROW_COUNT;
      IF inserted_count = 1 THEN UPDATE public.products SET stock_quantity = greatest(stock_quantity - item.quantity, 0), updated_at = now() WHERE id = item.product_id; END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
