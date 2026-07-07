
DROP POLICY IF EXISTS "Sellers upload product images to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users upload offers/reviews to own folder" ON storage.objects;

-- Single unified insert policy: bucket must be product-images, and the file must live
-- inside a path that includes the authenticated user's ID at either the first or second
-- folder segment. Prevents another user's ID from being used as a path prefix.
CREATE POLICY "Users upload to their own folder in product-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR (storage.foldername(name))[2] = (auth.uid())::text
    )
  );
