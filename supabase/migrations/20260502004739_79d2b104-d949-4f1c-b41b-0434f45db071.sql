-- Message integrity
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length CHECK (char_length(content) BETWEEN 1 AND 2000) NOT VALID;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_content_length;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_no_self CHECK (sender_id <> receiver_id) NOT VALID;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_no_self;

CREATE INDEX IF NOT EXISTS messages_pair_created_idx
  ON public.messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (receiver_id, is_read) WHERE is_read = false;

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.messages';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Storage policies for product-images bucket: products/* and offers/<uid>/*
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to product-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload offer attachments to own folder" ON storage.objects;

CREATE POLICY "Authenticated users can upload to product-images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (
    (storage.foldername(name))[1] = 'products'
    OR (
      (storage.foldername(name))[1] = 'offers'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
  )
);

CREATE POLICY "Users can update own uploads in product-images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND owner = auth.uid()
);

CREATE POLICY "Users can delete own uploads in product-images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND owner = auth.uid()
);
