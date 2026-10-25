-- Replace legacy customer-facing seed copy without overwriting pages that an
-- administrator has since edited. This is intentionally narrow and idempotent.
DO $$
DECLARE
  changed integer;
BEGIN
  BEGIN
    UPDATE public.site_pages
    SET title = replace(title, 'MarketHub', 'Tradibu'),
        body_markdown = replace(
          replace(
            replace(body_markdown, 'MarketHub', 'Tradibu'),
            'support@markethub.com',
            'support@tradibu.com'
          ),
          'privacy@markethub.com',
          'privacy@tradibu.com'
        )
    WHERE title ILIKE '%MarketHub%'
       OR body_markdown ILIKE '%MarketHub%'
       OR body_markdown ILIKE '%@markethub.com%';
    GET DIAGNOSTICS changed = ROW_COUNT;
    RAISE NOTICE 'legacy customer-facing branding replaced in site_pages: % row(s)', changed;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'site_pages not present here, skipped';
  END;
END $$;
