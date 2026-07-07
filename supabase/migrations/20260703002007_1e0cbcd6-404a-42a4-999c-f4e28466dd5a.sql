
-- ============================================================
-- 1. Fix seller_wallets missing columns (blocking delivery flow)
-- ============================================================
ALTER TABLE public.seller_wallets
  ADD COLUMN IF NOT EXISTS available_balance numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_balance   numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned      numeric(12,2) NOT NULL DEFAULT 0;

-- Backfill from legacy `balance` if any
UPDATE public.seller_wallets SET available_balance = balance WHERE available_balance = 0 AND balance > 0;

-- ============================================================
-- 2. system_alerts table for admin danger indicator
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.alert_level AS ENUM ('info','warning','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level public.alert_level NOT NULL DEFAULT 'warning',
  source text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.system_alerts TO authenticated;
GRANT ALL ON public.system_alerts TO service_role;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view alerts" ON public.system_alerts;
CREATE POLICY "Admins can view alerts" ON public.system_alerts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::text));

DROP POLICY IF EXISTS "Admins can update alerts" ON public.system_alerts;
CREATE POLICY "Admins can update alerts" ON public.system_alerts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::text));

CREATE INDEX IF NOT EXISTS system_alerts_unresolved_idx
  ON public.system_alerts (created_at DESC) WHERE resolved = false;

-- ============================================================
-- 3. Profiles: hide email from public and other users
-- ============================================================

-- Public/authed-non-admin read of seller profile display info goes through this view
CREATE OR REPLACE VIEW public.seller_profiles_public
WITH (security_invoker = off) AS
  SELECT
    user_id,
    full_name,
    avatar_url,
    country,
    is_verified,
    is_approved,
    created_at
  FROM public.profiles
  WHERE public.is_seller_capable(user_id);

GRANT SELECT ON public.seller_profiles_public TO anon, authenticated;

-- Drop the wide public policy (exposed emails)
DROP POLICY IF EXISTS "Public can read seller profiles" ON public.profiles;

-- Restrict seller-can-view-buyer to actual customers only
DROP POLICY IF EXISTS "Sellers can view buyer profiles (for orders)" ON public.profiles;
CREATE POLICY "Sellers can view their customers' profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.buyer_id = profiles.user_id
        AND o.seller_id = auth.uid()
    )
  );

-- Buyers can view the sellers they've ordered from
DROP POLICY IF EXISTS "Buyers can view their sellers' profiles" ON public.profiles;
CREATE POLICY "Buyers can view their sellers' profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.seller_id = profiles.user_id
        AND o.buyer_id = auth.uid()
    )
  );

-- Chat/message counterparties
DROP POLICY IF EXISTS "Chat partners can view each other" ON public.profiles;
CREATE POLICY "Chat partners can view each other" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (m.sender_id = auth.uid() AND m.receiver_id = profiles.user_id)
         OR (m.receiver_id = auth.uid() AND m.sender_id = profiles.user_id)
    )
  );

-- ============================================================
-- 4. user_roles: block self-assigning seller
-- ============================================================
DROP POLICY IF EXISTS "Users can create safe buyer or seller role" ON public.user_roles;
CREATE POLICY "Users can self-assign buyer role only" ON public.user_roles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND role = 'buyer'::text);

-- Sellers still onboard through ensure_user_profile / admin approval flows.
-- Update ensure_user_profile so a signup requesting seller does NOT auto-grant role;
-- the seller role must be granted by admin (admin_grant_seller).
CREATE OR REPLACE FUNCTION public.ensure_user_profile()
 RETURNS TABLE(profile_ready boolean, user_role app_role)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    COALESCE(existing_role, 'buyer'::text) IN ('admin'::text, 'buyer'::text),
    COALESCE(existing_role, 'buyer'::text) = 'admin'::text
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = now();

  -- Always grant buyer role by default. Seller role requires admin_grant_seller.
  IF existing_role IS NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (current_user_id, 'buyer'::text)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- If user requested seller, flag for admin approval via system_alerts
    IF requested_role = 'seller'::text THEN
      INSERT INTO public.system_alerts (level, source, message, metadata)
      VALUES ('info', 'seller_signup', 'New seller application awaiting approval',
              jsonb_build_object('user_id', current_user_id, 'email', user_email));
    END IF;
  END IF;

  RETURN QUERY
  SELECT true, public.get_user_role(current_user_id);
END;
$function$;

-- ============================================================
-- 5. Admin can no longer edit other sellers' products
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage all products" ON public.products;
-- Admin can view all products
CREATE POLICY "Admins can view all products" ON public.products
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::text));
-- Admin can delete (moderation)
CREATE POLICY "Admins can delete any product" ON public.products
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::text));
-- Admin can toggle approval/status via a locked-down function (below)

CREATE OR REPLACE FUNCTION public.admin_set_product_approval(_product_id uuid, _is_approved boolean, _status product_status DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::text) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.products
  SET is_approved = _is_approved,
      status = COALESCE(_status, status),
      updated_at = now()
  WHERE id = _product_id;
END;
$function$;

-- Product images: admins can delete for moderation but not edit others' listings
DROP POLICY IF EXISTS "Admins manage all product images" ON public.product_images;
CREATE POLICY "Admins can view all product images" ON public.product_images
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admins can delete any product image" ON public.product_images
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::text));

DROP POLICY IF EXISTS "Admins manage all product docs" ON public.product_documents;
CREATE POLICY "Admins can view all product docs" ON public.product_documents
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::text));
CREATE POLICY "Admins can delete any product doc" ON public.product_documents
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::text));

-- ============================================================
-- 6. Orders: server-side total recompute
-- ============================================================
CREATE OR REPLACE FUNCTION public.orders_recompute_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(sum(oi.quantity * COALESCE(p.price, oi.unit_price)), 0)
  INTO v_total
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.id;

  IF v_total > 0 THEN
    NEW.total_amount := v_total;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS orders_recompute_total_before ON public.orders;
CREATE TRIGGER orders_recompute_total_before
  BEFORE INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_recompute_total();

-- Also validate order item price on insert cannot exceed product price + 1%
CREATE OR REPLACE FUNCTION public.order_items_validate_price()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_price numeric;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  SELECT price INTO v_price FROM public.products WHERE id = NEW.product_id;
  IF v_price IS NOT NULL AND NEW.unit_price > v_price * 1.01 THEN
    NEW.unit_price := v_price;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS order_items_validate_price_before ON public.order_items;
CREATE TRIGGER order_items_validate_price_before
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_validate_price();

-- ============================================================
-- 7. Ads: validate target_url + hide financial columns from public
-- ============================================================
CREATE OR REPLACE FUNCTION public.ads_validate_target_url()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.target_url IS NOT NULL AND NEW.target_url <> '' THEN
    -- allow internal paths starting with '/' OR http(s) URLs
    IF NEW.target_url !~* '^(https?://|/)' THEN
      RAISE EXCEPTION 'Ad target URL must start with http(s):// or /';
    END IF;
    IF NEW.target_url ~* '^\s*javascript:' OR NEW.target_url ~* '^\s*data:' OR NEW.target_url ~* '^\s*vbscript:' THEN
      RAISE EXCEPTION 'Unsafe URL scheme not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ads_validate_target_url_before ON public.ads;
CREATE TRIGGER ads_validate_target_url_before
  BEFORE INSERT OR UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.ads_validate_target_url();

-- Public view: no budget/spent/impressions/clicks/dates
CREATE OR REPLACE VIEW public.ads_public
WITH (security_invoker = off) AS
  SELECT id, seller_id, title, image_url, target_url, placement, status
  FROM public.ads
  WHERE status = 'active'::ad_status;

GRANT SELECT ON public.ads_public TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can read active ads" ON public.ads;
-- Only sellers of the ad, admins, and service_role can read the full ads row now.

-- ============================================================
-- 8. Storage: tighten product-images INSERT policy
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can upload to product-images" ON storage.objects;
CREATE POLICY "Sellers upload product images to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_seller_capable(auth.uid())
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- Buyers keep dispute-proof upload policy (already scoped to disputes/{uid}/) and offers still allowed via own folder subpath below
CREATE POLICY "Users upload offers/reviews to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
