CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS TABLE(profile_ready boolean, user_role app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  user_email text := COALESCE(auth.jwt() ->> 'email', '');
  user_full_name text := COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name', '');
  requested_role app_role;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  requested_role := CASE auth.jwt() -> 'user_metadata' ->> 'role'
    WHEN 'seller' THEN 'seller'::text
    ELSE 'buyer'::text
  END;

  INSERT INTO public.profiles (user_id, email, full_name, is_approved)
  VALUES (current_user_id, user_email, user_full_name, requested_role = 'buyer'::text)
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (current_user_id, requested_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN QUERY
  SELECT true, public.get_user_role(current_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;
