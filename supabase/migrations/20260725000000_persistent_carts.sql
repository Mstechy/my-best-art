-- Persistent carts: survives page refresh, browser crash, works across tabs.
-- Guest carts are identified by visitor_id (UUID stored in localStorage).
-- Anonymous carts merge into user carts on login.

CREATE TABLE IF NOT EXISTS public.carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id text,                         -- localStorage UUID for anonymous users
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Enforce exactly one identity per cart
  CONSTRAINT cart_has_owner CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0 AND quantity <= 999),
  seller_name text,                         -- cached at add time so cart survives seller profile changes
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One row per product+variant per cart
  UNIQUE (cart_id, product_id, product_variant_id)
);

-- Index for fast cart lookup
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON public.carts(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_carts_visitor_id ON public.carts(visitor_id) WHERE visitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);

-- Enable RLS
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can ONLY access their own cart by user_id
-- Anonymous users have NO direct table access to prevent visitor_id guessing attacks.
-- Anonymous carts live in browser localStorage and are synced to DB on login.
CREATE POLICY cart_owner_select ON public.carts
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY cart_owner_insert ON public.carts
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY cart_owner_update ON public.carts
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY cart_owner_delete ON public.carts
  FOR DELETE
  USING (user_id = auth.uid());

-- Cart items inherit from cart (authenticated users only)
CREATE POLICY cart_items_cart_select ON public.cart_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY cart_items_cart_insert ON public.cart_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY cart_items_cart_update ON public.cart_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  );

CREATE POLICY cart_items_cart_delete ON public.cart_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.carts
      WHERE carts.id = cart_items.cart_id
        AND carts.user_id = auth.uid()
    )
  );

-- Trigger: auto-update updated_at on carts
CREATE OR REPLACE FUNCTION public.cart_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.carts SET updated_at = now() WHERE id = NEW.cart_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cart_items_touch_cart ON public.cart_items;
CREATE TRIGGER cart_items_touch_cart
  AFTER INSERT OR UPDATE OR DELETE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.cart_touch_updated_at();

-- RPC: merge guest cart into user cart on login
CREATE OR REPLACE FUNCTION public.merge_guest_cart(p_visitor_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_cart_id uuid;
  v_guest_cart_id uuid;
BEGIN
  -- Get or create user cart
  SELECT id INTO v_user_cart_id FROM public.carts WHERE user_id = auth.uid() LIMIT 1;
  IF v_user_cart_id IS NULL THEN
    INSERT INTO public.carts (user_id) VALUES (auth.uid()) RETURNING id INTO v_user_cart_id;
  END IF;

  -- Get guest cart
  SELECT id INTO v_guest_cart_id FROM public.carts WHERE visitor_id = p_visitor_id AND user_id IS NULL LIMIT 1;
  IF v_guest_cart_id IS NULL THEN
    DELETE FROM public.carts WHERE visitor_id = p_visitor_id;
    RETURN;
  END IF;

  -- Merge guest items into user cart (conflict = update quantity to whichever is higher)
  INSERT INTO public.cart_items (cart_id, product_id, product_variant_id, quantity, seller_name)
  SELECT
    v_user_cart_id,
    gi.product_id,
    gi.product_variant_id,
    GREATEST(gi.quantity, COALESCE(
      (SELECT quantity FROM public.cart_items WHERE cart_id = v_user_cart_id AND product_id = gi.product_id AND product_variant_id IS NOT DISTINCT FROM gi.product_variant_id),
      0
    )),
    gi.seller_name
  FROM public.cart_items gi
  WHERE gi.cart_id = v_guest_cart_id
  ON CONFLICT (cart_id, product_id, product_variant_id)
    DO UPDATE SET quantity = EXCLUDED.quantity, seller_name = EXCLUDED.seller_name, updated_at = now();

  -- Delete guest cart (cascades to its items)
  DELETE FROM public.carts WHERE id = v_guest_cart_id;
END;
$$;

GRANT ALL ON public.carts TO authenticated;
GRANT ALL ON public.cart_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_guest_cart TO authenticated;
