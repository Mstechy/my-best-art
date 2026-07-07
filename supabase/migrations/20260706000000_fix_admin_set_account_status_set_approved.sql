-- Force admin_set_account_status to correctly update seller approval/verification
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

  -- If admin approves, ensure user becomes seller-capable.
  -- Avoid forcing seller role for existing admins (they should remain admin-only primary role).
  IF COALESCE(_is_approved, false) = true AND NOT public.has_role(_user_id, 'admin'::text) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'seller'::text)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Approval implies seller verification in this app's admin workflow.
    _is_verified := true;
    _is_banned := COALESCE(_is_banned, false);
    _is_frozen := COALESCE(_is_frozen, false);
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

