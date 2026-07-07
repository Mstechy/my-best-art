-- Product detail columns
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS dimensions text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS condition text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS warranty text,
  ADD COLUMN IF NOT EXISTS shipping_info text,
  ADD COLUMN IF NOT EXISTS key_features text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS average_rating numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;

-- Order tracking columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS carrier text,
  ADD COLUMN IF NOT EXISTS estimated_delivery timestamp with time zone,
  ADD COLUMN IF NOT EXISTS shipped_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS status_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  order_id uuid,
  rating integer NOT NULL,
  title text,
  comment text,
  is_verified_purchase boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reviews_rating_range CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT reviews_one_per_buyer_product UNIQUE (product_id, buyer_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read approved reviews" ON public.reviews;
CREATE POLICY "Anyone can read approved reviews"
ON public.reviews
FOR SELECT
USING (is_approved = true);

DROP POLICY IF EXISTS "Buyers can create reviews for purchased products" ON public.reviews;
CREATE POLICY "Buyers can create reviews for purchased products"
ON public.reviews
FOR INSERT
WITH CHECK (
  auth.uid() = buyer_id
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.order_items oi ON oi.order_id = o.id
    WHERE o.id = reviews.order_id
      AND o.buyer_id = auth.uid()
      AND o.seller_id = reviews.seller_id
      AND oi.product_id = reviews.product_id
      AND o.status = 'delivered'
  )
);

DROP POLICY IF EXISTS "Review authors can update own reviews" ON public.reviews;
CREATE POLICY "Review authors can update own reviews"
ON public.reviews
FOR UPDATE
USING (auth.uid() = buyer_id)
WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.reviews;
CREATE POLICY "Admins can manage all reviews"
ON public.reviews
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::text))
WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.track_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_history = COALESCE(NEW.status_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('status', NEW.status, 'changed_at', now())
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_history = COALESCE(OLD.status_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('status', NEW.status, 'changed_at', now())
    );

    IF NEW.status = 'shipped' AND NEW.shipped_at IS NULL THEN
      NEW.shipped_at = now();
    END IF;

    IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS track_order_status_change_trigger ON public.orders;
CREATE TRIGGER track_order_status_change_trigger
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.track_order_status_change();

CREATE OR REPLACE FUNCTION public.refresh_product_review_summary(_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products p
  SET
    average_rating = COALESCE((
      SELECT round(avg(r.rating)::numeric, 2)
      FROM public.reviews r
      WHERE r.product_id = _product_id AND r.is_approved = true
    ), 0),
    review_count = COALESCE((
      SELECT count(*)::integer
      FROM public.reviews r
      WHERE r.product_id = _product_id AND r.is_approved = true
    ), 0)
  WHERE p.id = _product_id;
$$;

CREATE OR REPLACE FUNCTION public.handle_review_summary_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_product_review_summary(OLD.product_id);
    RETURN OLD;
  END IF;

  PERFORM public.refresh_product_review_summary(NEW.product_id);

  IF TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    PERFORM public.refresh_product_review_summary(OLD.product_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_summary_change_trigger ON public.reviews;
CREATE TRIGGER reviews_summary_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.handle_review_summary_change();

CREATE INDEX IF NOT EXISTS idx_products_seller_status ON public.products (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_products_category_status ON public.products (category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_reviews_product_created ON public.reviews (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer ON public.reviews (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON public.orders (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_participants ON public.messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_product ON public.wishlists (user_id, product_id);

DO $$
DECLARE
  realtime_table text;
BEGIN
  FOREACH realtime_table IN ARRAY ARRAY['orders', 'messages', 'products', 'reviews', 'wishlists', 'ads']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', realtime_table);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;
