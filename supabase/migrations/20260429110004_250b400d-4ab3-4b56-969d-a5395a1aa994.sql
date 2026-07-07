-- Ensure admin users are also treated as verified, approved sellers while keeping admin as their primary role
CREATE OR REPLACE FUNCTION public.is_seller_capable(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::text, 'seller'::text)
  )
$$;

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS TABLE(profile_ready boolean, user_role app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  user_email text := COALESCE(auth.jwt() ->> 'email', '');
  user_full_name text := COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', '');
  requested_role app_role;
  existing_role app_role;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  existing_role := public.get_user_role(current_user_id);

  requested_role := CASE auth.jwt() -> 'user_metadata' ->> 'role'
    WHEN 'seller' THEN 'seller'::text
    ELSE 'buyer'::text
  END;

  INSERT INTO public.profiles (user_id, email, full_name, is_approved, is_verified)
  VALUES (
    current_user_id,
    user_email,
    user_full_name,
    COALESCE(existing_role, requested_role) IN ('admin'::text, 'buyer'::text),
    COALESCE(existing_role, requested_role) = 'admin'::text
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    is_approved = CASE WHEN COALESCE(existing_role, requested_role) = 'admin'::text THEN true ELSE public.profiles.is_approved END,
    is_verified = CASE WHEN COALESCE(existing_role, requested_role) = 'admin'::text THEN true ELSE public.profiles.is_verified END,
    updated_at = now();

  IF existing_role IS NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_user_id, requested_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN QUERY
  SELECT true, public.get_user_role(current_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_directory()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  is_verified boolean,
  is_approved boolean,
  is_banned boolean,
  is_frozen boolean,
  created_at timestamp with time zone,
  roles app_role[],
  primary_role app_role,
  seller_capable boolean,
  product_count integer,
  order_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    p.user_id,
    p.email,
    p.full_name,
    p.is_verified,
    p.is_approved,
    p.is_banned,
    p.is_frozen,
    p.created_at,
    COALESCE(r.roles, '{}'::app_role[]) AS roles,
    public.get_user_role(p.user_id) AS primary_role,
    public.is_seller_capable(p.user_id) AS seller_capable,
    COALESCE(prod.product_count, 0)::integer AS product_count,
    COALESCE(ord.order_count, 0)::integer AS order_count
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT array_agg(ur.role ORDER BY CASE ur.role WHEN 'admin' THEN 1 WHEN 'seller' THEN 2 WHEN 'buyer' THEN 3 END) AS roles
    FROM public.user_roles ur
    WHERE ur.user_id = p.user_id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS product_count
    FROM public.products pr
    WHERE pr.seller_id = p.user_id
  ) prod ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS order_count
    FROM public.orders o
    WHERE o.buyer_id = p.user_id OR o.seller_id = p.user_id
  ) ord ON true
  WHERE public.has_role(auth.uid(), 'admin'::text);
$$;

CREATE OR REPLACE FUNCTION public.admin_platform_counts()
RETURNS TABLE(
  sellers integer,
  buyers integer,
  total_users integer,
  products integer,
  orders integer,
  disputes integer,
  revenue numeric,
  pending_products integer,
  pending_sellers integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(DISTINCT p.user_id)::integer FROM public.profiles p WHERE public.is_seller_capable(p.user_id)) AS sellers,
    (SELECT count(DISTINCT p.user_id)::integer FROM public.profiles p WHERE public.has_role(p.user_id, 'buyer'::text) AND NOT public.is_seller_capable(p.user_id)) AS buyers,
    (SELECT count(*)::integer FROM public.profiles) AS total_users,
    (SELECT count(*)::integer FROM public.products) AS products,
    (SELECT count(*)::integer FROM public.orders) AS orders,
    (SELECT count(*)::integer FROM public.disputes WHERE status = 'open'::dispute_status) AS disputes,
    (SELECT COALESCE(sum(total_amount), 0) FROM public.orders) AS revenue,
    (SELECT count(*)::integer FROM public.products WHERE status = 'active'::product_status AND is_approved = false) AS pending_products,
    (SELECT count(*)::integer FROM public.profiles p WHERE public.has_role(p.user_id, 'seller'::text) AND p.is_approved = false AND p.is_banned = false) AS pending_sellers
  WHERE public.has_role(auth.uid(), 'admin'::text);
$$;

CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  _user_id uuid,
  _is_verified boolean DEFAULT NULL,
  _is_approved boolean DEFAULT NULL,
  _is_banned boolean DEFAULT NULL,
  _is_frozen boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::text) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.profiles
  SET
    is_verified = COALESCE(_is_verified, is_verified),
    is_approved = COALESCE(_is_approved, is_approved),
    is_banned = COALESCE(_is_banned, is_banned),
    is_frozen = COALESCE(_is_frozen, is_frozen),
    updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_seller(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::text) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'seller'::text)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET is_approved = true, is_verified = true, updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_seller(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::text) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF public.has_role(_user_id, 'admin'::text) THEN
    RAISE EXCEPTION 'Admin seller access cannot be revoked here';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = 'seller'::text;
END;
$$;

-- Admins can use seller product tooling without needing a separate seller role row
DROP POLICY IF EXISTS "Sellers can insert own products" ON public.products;
CREATE POLICY "Seller-capable users can insert own products"
ON public.products
FOR INSERT
WITH CHECK (auth.uid() = seller_id AND public.is_seller_capable(auth.uid()));

DROP POLICY IF EXISTS "Sellers can update own products" ON public.products;
CREATE POLICY "Seller-capable users can update own products"
ON public.products
FOR UPDATE
USING (auth.uid() = seller_id AND public.is_seller_capable(auth.uid()))
WITH CHECK (auth.uid() = seller_id AND public.is_seller_capable(auth.uid()));

DROP POLICY IF EXISTS "Sellers can delete own products" ON public.products;
CREATE POLICY "Seller-capable users can delete own products"
ON public.products
FOR DELETE
USING (auth.uid() = seller_id AND public.is_seller_capable(auth.uid()));

DROP POLICY IF EXISTS "Sellers can manage own product images" ON public.product_images;
CREATE POLICY "Seller-capable users can manage own product images"
ON public.product_images
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_images.product_id
      AND products.seller_id = auth.uid()
      AND public.is_seller_capable(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products
    WHERE products.id = product_images.product_id
      AND products.seller_id = auth.uid()
      AND public.is_seller_capable(auth.uid())
  )
);

DROP POLICY IF EXISTS "Sellers can manage own ads" ON public.ads;
CREATE POLICY "Seller-capable users can manage own ads"
ON public.ads
FOR ALL
USING (auth.uid() = seller_id AND public.is_seller_capable(auth.uid()))
WITH CHECK (auth.uid() = seller_id AND public.is_seller_capable(auth.uid()));

DROP POLICY IF EXISTS "Sellers can read own wallet" ON public.seller_wallets;
CREATE POLICY "Seller-capable users can read own wallet"
ON public.seller_wallets
FOR SELECT
USING (auth.uid() = seller_id AND public.is_seller_capable(auth.uid()));

-- Recreate missing triggers shown absent in the live database
DROP TRIGGER IF EXISTS track_order_status_change_trigger ON public.orders;
CREATE TRIGGER track_order_status_change_trigger
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.track_order_status_change();

DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON public.reviews;
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS reviews_summary_refresh ON public.reviews;
CREATE TRIGGER reviews_summary_refresh
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.handle_review_summary_change();

-- Fix current live data: both existing admins become verified/approved seller-capable admins; orphan profile gets buyer role
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'buyer'::text
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.user_id)
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles p
SET is_approved = true,
    is_verified = true,
    is_banned = false,
    is_frozen = false,
    updated_at = now()
WHERE public.has_role(p.user_id, 'admin'::text);

UPDATE public.profiles p
SET is_approved = true,
    is_verified = true,
    updated_at = now()
WHERE public.has_role(p.user_id, 'seller'::text);

-- Ensure realtime publication includes interactive tables; ignore if already added
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reviews') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reviews;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'wishlists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlists;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ads') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ads;
  END IF;
END $$;
