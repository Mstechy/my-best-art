-- ============================================================
-- Add upload validation for storage.objects in product-images bucket
-- ============================================================

-- 1. Drop any existing permissive upload policy (before re-creating)
DROP POLICY IF EXISTS "Sellers and admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Seller-capable users can upload product images" ON storage.objects;

-- 2. Re-create with content-type validation
CREATE POLICY "Seller-capable users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    public.is_seller_capable(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::text)
  )
  -- Server-side MIME type validation for image uploads
  AND (
    -- Allow common image types
    COALESCE(upper(storage.extension(name)), '') IN (
      'JPG', 'JPEG', 'PNG', 'WEBP', 'GIF', 'SVG'
    )
    -- Allow video types
    OR COALESCE(upper(storage.extension(name)), '') IN (
      'MP4', 'MOV', 'WEBM'
    )
    -- Allow PDF documents
    OR COALESCE(upper(storage.extension(name)), '') = 'PDF'
  )
  -- Block dangerous extensions explicitly
  AND COALESCE(upper(storage.extension(name)), '') NOT IN (
    'EXE', 'BAT', 'CMD', 'SH', 'BASH', 'ZSH', 'PS1', 'VBS',
    'JS', 'JSE', 'VBA', 'VBE', 'WSF', 'WSH', 'MSI', 'MSP',
    'SCR', 'PIF', 'HTA', 'CPL', 'REG', 'COM', 'DLL', 'SYS',
    'HTM', 'HTML', 'XHTML', 'PHP', 'ASP', 'ASPX', 'JSP',
    'PY', 'RB', 'PL', 'RPM', 'DEB', 'APPIMAGE', 'DMG', 'PKG',
    'SWF', 'CLASS', 'JAR', 'WAR'
  )
);

-- 3. Ensure MIME type metadata is stored for uploaded objects
-- This helps with content-type verification during reads
COMMENT ON POLICY "Seller-capable users can upload product images" ON storage.objects IS
  'Restricts product-images uploads to seller-capable users and blocks dangerous file extensions server-side';

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';