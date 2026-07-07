
-- Validate message markers
CREATE OR REPLACE FUNCTION public.validate_message_markers()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  storage_host text := '';
  attachment_url text;
  supabase_url text;
BEGIN
  -- Offer requires product reference
  IF NEW.content ~ '\[offer:[0-9]+(\.[0-9]+)?\]' AND NEW.content !~ '\[product:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]' THEN
    RAISE EXCEPTION 'Offer marker requires a product reference';
  END IF;

  -- Attachment URL must be on supabase storage public path
  IF NEW.content ~* '\[attachment:' THEN
    attachment_url := substring(NEW.content from '\[attachment:(https?://[^\s\]]+)\]');
    IF attachment_url IS NULL THEN
      RAISE EXCEPTION 'Malformed attachment marker';
    END IF;
    IF attachment_url !~* '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/' THEN
      RAISE EXCEPTION 'Attachment URL must come from project storage';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_message_markers_trg ON public.messages;
CREATE TRIGGER validate_message_markers_trg
BEFORE INSERT OR UPDATE OF content ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.validate_message_markers();

-- Storage policies for dispute proof uploads (product-images bucket, disputes/<uid>/ prefix)
DROP POLICY IF EXISTS "Buyers upload dispute proof to own folder" ON storage.objects;
CREATE POLICY "Buyers upload dispute proof to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'disputes'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS "Owners and admins read dispute proof" ON storage.objects;
CREATE POLICY "Owners and admins read dispute proof"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'disputes'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::text)
  )
);

-- Realtime for disputes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'disputes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.disputes';
  END IF;
END $$;
