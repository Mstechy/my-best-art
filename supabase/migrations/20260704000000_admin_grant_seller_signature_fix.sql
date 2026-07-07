-- Enforce correct RPC signature for admin_grant_seller/admin_revoke_seller
-- This migration ensures PostgREST schema cache sees the expected argument name: _user_id

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
  SET is_approved = true,
      is_verified = true,
      updated_at = now()
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

