-- Allow sellers to view basic buyer profile info needed for order management
DROP POLICY IF EXISTS "Sellers can view buyer profiles (for orders)" ON public.profiles;

CREATE POLICY "Sellers can view buyer profiles (for orders)"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() <> user_id
    AND public.is_seller_capable(auth.uid())
  );

-- Ensure PostgREST picks up the change
NOTIFY pgrst, 'reload schema';