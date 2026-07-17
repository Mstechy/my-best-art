-- Product and collection cards only need a seller's public display fields.
-- Recreate the view with definer privileges so profile RLS never blocks the
-- public catalogue, then refresh PostgREST's schema cache immediately.
CREATE OR REPLACE VIEW public.seller_profiles_public
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

-- Ensure the view predicate remains callable when the API executes it for a
-- public visitor. The function itself is SECURITY DEFINER and exposes only a
-- boolean result.
GRANT EXECUTE ON FUNCTION public.is_seller_capable(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
