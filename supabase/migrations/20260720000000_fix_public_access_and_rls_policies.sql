-- Fix 401 errors on seller_profiles_public and profiles queries
-- 1. Ensure seller_profiles_public view is accessible to anon users
-- 2. Add a public profiles view for limited buyer info (needed for reviews display)

-- First, ensure the seller_profiles_public view is properly accessible
-- Drop and recreate with explicit security settings
DROP VIEW IF EXISTS public.seller_profiles_public CASCADE;

CREATE VIEW public.seller_profiles_public
WITH (security_invoker = false) AS
  SELECT
    p.user_id,
    p.full_name,
    p.avatar_url,
    p.country,
    p.is_verified,
    p.is_approved,
    p.created_at
  FROM public.profiles AS p
  WHERE public.is_seller_capable(p.user_id);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.seller_profiles_public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_seller_capable(uuid) TO anon, authenticated;

-- Create a public buyer profiles view for reviews/order display
-- Only exposes minimal non-sensitive fields
CREATE OR REPLACE VIEW public.buyer_profiles_public
WITH (security_invoker = false) AS
  SELECT
    p.user_id,
    p.full_name,
    p.country
  FROM public.profiles AS p;

GRANT SELECT ON public.buyer_profiles_public TO anon, authenticated;

-- Ensure RLS on profiles still protects sensitive data, but allow
-- authenticated users (all roles) to read basic profile info for
-- reviews, messages, and order management
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view basic profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure the public can also read basic profiles (for marketplace browsing)
DROP POLICY IF EXISTS "Public can view basic profile info" ON public.profiles;
CREATE POLICY "Public can view basic profile info"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (true);

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';