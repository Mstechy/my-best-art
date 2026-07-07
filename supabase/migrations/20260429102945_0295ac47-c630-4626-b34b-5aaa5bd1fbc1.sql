DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;

CREATE POLICY "Users can create safe buyer or seller role"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND role IN ('buyer'::text, 'seller'::text)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id_unique ON public.profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_user_role_unique ON public.user_roles (user_id, role);
