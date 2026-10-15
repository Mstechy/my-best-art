CREATE TABLE IF NOT EXISTS public.google_search_console_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  property_url text NOT NULL DEFAULT 'sc-domain:tradibu.com',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.google_search_console_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.google_feed_settings
  ALTER COLUMN shipping_price_ngn DROP NOT NULL,
  ALTER COLUMN shipping_price_ngn DROP DEFAULT;

CREATE TABLE IF NOT EXISTS public.google_search_console_credentials (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  refresh_token_ciphertext text NOT NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  connected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.google_search_console_oauth_states (
  state_hash text PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

ALTER TABLE public.google_search_console_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_search_console_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_search_console_oauth_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage Search Console property" ON public.google_search_console_settings;
CREATE POLICY "Admins manage Search Console property"
  ON public.google_search_console_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

GRANT SELECT, INSERT, UPDATE ON public.google_search_console_settings TO authenticated;
REVOKE ALL ON public.google_search_console_credentials, public.google_search_console_oauth_states
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_search_console_settings TO service_role;
GRANT ALL ON public.google_search_console_credentials TO service_role;
GRANT ALL ON public.google_search_console_oauth_states TO service_role;
