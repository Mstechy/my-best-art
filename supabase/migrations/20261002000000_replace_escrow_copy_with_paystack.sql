-- Remove the escrow framing from the seeded legal pages.
--
-- Tradibu settles payments through Paystack, so "payments are held in escrow" is
-- not how money actually moves: Paystack charges the buyer at checkout and the
-- seller is paid out of the seller wallet after fulfilment. The seeded
-- 'payment' and 'about' pages still promised escrow, which is a claim the
-- platform does not make.
--
-- Editing the 2026-07-02 seed migration alone would not help any database that
-- has already applied it, so this forward migration rewrites the stored copy
-- where the old escrow wording is still present. Rows an admin has since
-- rewritten by hand are left alone: only bodies still containing the escrow
-- text are touched, so re-running updates nothing.
--
-- Guarded in its own BEGIN/EXCEPTION block so an environment without the
-- site_pages table skips with a NOTICE rather than failing the migration.

DO $$
DECLARE
  changed integer;
BEGIN
  BEGIN
    UPDATE public.site_pages
    SET body_markdown = replace(
          replace(
            body_markdown,
            -- E'' so \n is a real newline: the stored markdown holds actual
            -- newlines, and in a plain '...' string \n would be a literal
            -- backslash-n and never match.
            E'## Escrow Protection\n\nPayments are held in escrow until the buyer confirms delivery. This protects both buyers and sellers.',
            E'## Payment Security\n\nPayments are processed by Paystack, Nigeria''s trusted payment provider, and verified before an order is marked as paid. This protects both buyers and sellers.'
          ),
          'Secure escrow payments',
          'Secure Paystack payments'
        )
    WHERE body_markdown ILIKE '%escrow%'
      AND slug IN ('payment', 'about', 'terms');
    GET DIAGNOSTICS changed = ROW_COUNT;
    RAISE NOTICE 'escrow copy removed from site_pages: % row(s)', changed;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'site_pages not present here, skipped';
  END;
END $$;