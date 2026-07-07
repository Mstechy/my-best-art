-- 1. Restrict storage.objects listing in product-images bucket to authenticated users.
-- (Files are still publicly readable by direct URL because the bucket is public,
-- but anon users can no longer list/discover all files.)
DO $$
BEGIN
  -- drop any prior loose select policy we created previously
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public can list product images') THEN
    DROP POLICY "Public can list product images" ON storage.objects;
  END IF;
END $$;

-- Allow only authenticated users to list/select objects metadata in the bucket.
DROP POLICY IF EXISTS "Authenticated can list product images" ON storage.objects;
CREATE POLICY "Authenticated can list product images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-images');

-- Allow uploads by authenticated seller-capable users (and admins) to their own folder
DROP POLICY IF EXISTS "Sellers and admins can upload product images" ON storage.objects;
CREATE POLICY "Sellers and admins can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    public.is_seller_capable(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::text)
  )
);

DROP POLICY IF EXISTS "Owners can update product images" ON storage.objects;
CREATE POLICY "Owners can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'::text))
);

DROP POLICY IF EXISTS "Owners can delete product images" ON storage.objects;
CREATE POLICY "Owners can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (auth.uid() = owner OR public.has_role(auth.uid(), 'admin'::text))
);

-- 2. Lock down admin-only SECURITY DEFINER functions: revoke EXECUTE from anon.
REVOKE EXECUTE ON FUNCTION public.admin_user_directory() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_platform_counts() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_grant_seller(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_seller(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_account_status(uuid, boolean, boolean, boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.ensure_user_profile() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.admin_user_directory() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_platform_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_seller(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_seller(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, boolean, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;
