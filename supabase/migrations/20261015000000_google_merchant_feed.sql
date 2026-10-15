-- ============================================================
-- Google Merchant Center product feed
-- ============================================================
-- Adds the identifiers Google needs, the feed settings/exclusions/run-log
-- tables, a public `feeds` storage bucket the generated XML is written to,
-- a debounce table + change triggers so edits regenerate the feed within minutes,
-- and two pg_cron jobs (every 3h unconditional, every minute debounced).
-- Additive only: no existing table is altered beyond two new columns.
-- ============================================================

-- 1. Product identifiers ------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gtin text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mpn text;

-- 2. Feed settings (singleton row) --------------------------------------
-- default_brand is optional and should only be set when it is accurate for all
-- otherwise-unbranded products that use it.
CREATE TABLE IF NOT EXISTS public.google_feed_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  default_brand text,
  shipping_country text NOT NULL DEFAULT 'NG',
  shipping_method text NOT NULL DEFAULT 'Standard',
  shipping_price_ngn numeric(12,2) CHECK (shipping_price_ngn IS NULL OR shipping_price_ngn >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.google_feed_settings
  ADD COLUMN IF NOT EXISTS default_brand text;
INSERT INTO public.google_feed_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- 3. Include/exclude switches ------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_feed_exclusions (
  entity_type text NOT NULL CHECK (entity_type IN ('seller', 'product', 'collection')),
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);

-- 4. Run log ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_feed_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  product_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'schedule'
);

-- 5. Debounce marker ----------------------------------------------------
-- Catalogue, seller eligibility, settings, and exclusion triggers stamp requested_at
-- on the first change of a burst; the every-minute cron fires once the stamp
-- is >= 2 minutes old, then clears it. Bursts collapse into one run.
CREATE TABLE IF NOT EXISTS public.google_feed_pending (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  requested_at timestamptz
);
INSERT INTO public.google_feed_pending (id, requested_at) VALUES (true, NULL) ON CONFLICT (id) DO NOTHING;

-- 6. RLS: admin-only, service_role for the generator --------------------
ALTER TABLE public.google_feed_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_feed_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_feed_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_feed_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage feed settings" ON public.google_feed_settings;
CREATE POLICY "Admins manage feed settings" ON public.google_feed_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

DROP POLICY IF EXISTS "Admins manage feed exclusions" ON public.google_feed_exclusions;
CREATE POLICY "Admins manage feed exclusions" ON public.google_feed_exclusions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

DROP POLICY IF EXISTS "Admins read feed runs" ON public.google_feed_runs;
CREATE POLICY "Admins read feed runs" ON public.google_feed_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text));
-- google_feed_pending gets no user-facing policy at all: only the
-- SECURITY DEFINER trigger function and service_role ever touch it.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_feed_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_feed_exclusions TO authenticated;
GRANT SELECT ON public.google_feed_runs TO authenticated;

-- 8. Debounce trigger ----------------------------------------------------
-- SECURITY DEFINER so a seller's INSERT/UPDATE/DELETE can stamp the marker
-- without holding any grant on google_feed_pending (RLS there is admin-free
-- by design). requested_at keeps the FIRST change time of a burst: the cron
-- fires once that stamp is 2 minutes old, then clears it, so a hundred rapid
-- edits collapse into exactly one regeneration ~2 minutes later.
CREATE OR REPLACE FUNCTION public.mark_google_feed_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.google_feed_pending (id, requested_at)
  VALUES (true, now())
  ON CONFLICT (id) DO UPDATE
    SET requested_at = COALESCE(public.google_feed_pending.requested_at, now());
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_feed_pending ON public.products;
CREATE TRIGGER trg_google_feed_pending
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.mark_google_feed_pending();

DROP TRIGGER IF EXISTS trg_google_feed_pending_images ON public.product_images;
CREATE TRIGGER trg_google_feed_pending_images
  AFTER INSERT OR UPDATE OR DELETE ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.mark_google_feed_pending();

DROP TRIGGER IF EXISTS trg_google_feed_pending_variants ON public.product_variants;
CREATE TRIGGER trg_google_feed_pending_variants
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.mark_google_feed_pending();

DROP TRIGGER IF EXISTS trg_google_feed_pending_seller_status ON public.profiles;
CREATE TRIGGER trg_google_feed_pending_seller_status
  AFTER UPDATE OF is_approved, is_banned, is_frozen ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.mark_google_feed_pending();

DROP TRIGGER IF EXISTS trg_google_feed_pending_settings ON public.google_feed_settings;
CREATE TRIGGER trg_google_feed_pending_settings
  AFTER INSERT OR UPDATE ON public.google_feed_settings
  FOR EACH ROW EXECUTE FUNCTION public.mark_google_feed_pending();

DROP TRIGGER IF EXISTS trg_google_feed_pending_exclusions ON public.google_feed_exclusions;
CREATE TRIGGER trg_google_feed_pending_exclusions
  AFTER INSERT OR UPDATE OR DELETE ON public.google_feed_exclusions
  FOR EACH ROW EXECUTE FUNCTION public.mark_google_feed_pending();

DROP TRIGGER IF EXISTS trg_google_feed_pending_collection_products ON public.marketplace_collection_products;
CREATE TRIGGER trg_google_feed_pending_collection_products
  AFTER INSERT OR UPDATE OR DELETE ON public.marketplace_collection_products
  FOR EACH ROW EXECUTE FUNCTION public.mark_google_feed_pending();

-- 9. Cron -> Edge Function invoker --------------------------------------
-- The HTTP call and its secret live here in the database, never in the repo:
-- the secret is read from Vault at call time, and the Edge Function checks the
-- same value in its own env. If the Vault entry does not exist yet the job
-- logs a NOTICE and does nothing (no error spam before setup is finished).
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS vault;

CREATE OR REPLACE FUNCTION public.run_google_feed_job(p_triggered_by text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'google_feed_secret'
  LIMIT 1;

  IF v_secret IS NULL THEN
    RAISE NOTICE 'google feed: vault secret "google_feed_secret" not set; skipping % run', p_triggered_by;
    RETURN;
  END IF;

  PERFORM extensions.net.http_post(
    url := 'https://bnkyddmmhaaefzfvzpqs.supabase.co/functions/v1/google-feed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-feed-secret', v_secret
    ),
    body := jsonb_build_object('trigger', p_triggered_by),
    timeout_milliseconds := 120000
  );
END;
$$;

-- Debounced entry point: fires only when a change marker is at least 2 minutes
-- old, then clears it. Rapid edits across the change triggers above collapse into
-- a single run; the every-3-hour job below is the unconditional safety net.
CREATE OR REPLACE FUNCTION public.maybe_run_google_feed_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requested timestamptz;
  v_last_started timestamptz;
BEGIN
  SELECT requested_at INTO v_requested FROM public.google_feed_pending WHERE id;
  IF v_requested IS NULL OR v_requested > now() - interval '2 minutes' THEN
    RETURN;
  END IF;

  -- Never stack runs: if a generation started in the last 5 minutes, leave the
  -- marker in place and let the next minute-tick retry.
  SELECT max(started_at) INTO v_last_started FROM public.google_feed_runs;
  IF v_last_started IS NOT NULL AND v_last_started > now() - interval '5 minutes' THEN
    RETURN;
  END IF;

  UPDATE public.google_feed_pending SET requested_at = NULL WHERE id;

  PERFORM public.run_google_feed_job('change');
END;
$$;

REVOKE ALL ON FUNCTION public.run_google_feed_job(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.maybe_run_google_feed_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_google_feed_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.maybe_run_google_feed_job() TO service_role;

REVOKE ALL ON FUNCTION public.mark_google_feed_pending() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_google_feed_pending() TO authenticated, service_role;

GRANT ALL ON public.google_feed_settings TO service_role;
GRANT ALL ON public.google_feed_exclusions TO service_role;
GRANT ALL ON public.google_feed_runs TO service_role;
GRANT ALL ON public.google_feed_pending TO service_role;

-- 10. The two schedules ---------------------------------------------------
-- Same re-run guard as the reservation-expiry migration: unschedule first so
-- reapplying never stacks duplicate jobs.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'regenerate-google-feed') THEN
    PERFORM cron.unschedule('regenerate-google-feed');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'regenerate-google-feed-debounced') THEN
    PERFORM cron.unschedule('regenerate-google-feed-debounced');
  END IF;
END;
$$;

-- Safety net: full regeneration every 3 hours even if no trigger ever fired.
SELECT cron.schedule(
  'regenerate-google-feed',
  '0 */3 * * *',
  'SELECT public.run_google_feed_job(''schedule'');'
);

-- Change-driven: every minute, fire only when a change marker is >= 2 min old.
-- "A few minutes after any product change, debounced" in one line.
SELECT cron.schedule(
  'regenerate-google-feed-debounced',
  '* * * * *',
  'SELECT public.maybe_run_google_feed_job();'
);

-- 7. Public bucket the generated XML lives in ---------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('feeds', 'feeds', true, 1073741824)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), EXCLUDED.file_size_limit);

DROP POLICY IF EXISTS "Anyone can read feed files" ON storage.objects;
CREATE POLICY "Anyone can read feed files" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'feeds');
