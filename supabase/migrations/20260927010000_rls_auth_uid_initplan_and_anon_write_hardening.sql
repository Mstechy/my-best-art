-- RLS performance and anonymous-write hardening. No paid features required.
--
-- 1. auth.uid() -> (select auth.uid()) in every policy.
--    Supabase's documented pattern. Without the subquery the planner cannot hoist the
--    call out of the per-row predicate, so every row of every list query re-evaluates
--    it. The rewrite is generated from the live catalog (pg_policies) rather than from
--    the migration history, so the command, the roles and the expression are taken
--    from the database itself and nothing is widened. Policies that already use the
--    wrapped form are skipped, so re-running this is a no-op.
--
-- 2. product_views: anonymous visitors may record a view, but only the columns a
--    view actually needs. The blanket INSERT grant also allowed the surrogate id to
--    be supplied, which is not something a visitor should control. Tracking keeps
--    working; the grant is simply narrowed.
--
-- Still open, deliberately not changed here: track_ad_impression()/track_ad_click()
-- are SECURITY DEFINER and callable by anon, so ad counters can be inflated by anyone.
-- The correct fix is to move them behind a rate-limited Edge Function, which is a
-- behaviour change for the ad banner and is left as a separate, deliberate step.

DO $$
DECLARE
  r record;
  stmt text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') LIKE '%auth.uid()%' OR coalesce(with_check, '') LIKE '%auth.uid()%')
      AND coalesce(qual, '') NOT LIKE '%(select auth.uid())%'
      AND coalesce(with_check, '') NOT LIKE '%(select auth.uid())%'
  LOOP
    stmt := format(
      'alter policy %I on %I.%I %s to %s using (%s)%s',
      r.policyname,
      r.schemaname,
      r.tablename,
      CASE WHEN r.cmd <> 'ALL' THEN 'for ' || lower(r.cmd) ELSE '' END,
      array_to_string(r.roles, ', '),
      replace(r.qual, 'auth.uid()', '(select auth.uid())'),
      CASE
        WHEN r.with_check IS NULL THEN ''
        ELSE ' with check (' || replace(r.with_check, 'auth.uid()', '(select auth.uid())') || ')'
      END
    );
    EXECUTE stmt;
  END LOOP;
END;
$$;

-- Verification: both counts should be identical after the rewrite.
DO $$
DECLARE
  bare integer;
  wrapped integer;
BEGIN
  SELECT count(*) INTO bare FROM pg_policies
  WHERE schemaname = 'public'
    AND qual NOT LIKE '%(select auth.uid())%' AND qual LIKE '%auth.uid()%';
  SELECT count(*) INTO wrapped FROM pg_policies
  WHERE schemaname = 'public' AND qual LIKE '%(select auth.uid())%';
  RAISE NOTICE 'policies using bare auth.uid(): %   policies using the hoisted form: %', bare, wrapped;
END;
$$;

-- Anonymous view tracking, narrowed to the three columns a view needs.
REVOKE INSERT ON public.product_views FROM anon;
GRANT INSERT (product_id, viewer_id, created_at) ON public.product_views TO anon;
GRANT INSERT (product_id, viewer_id, created_at) ON public.product_views TO authenticated;
