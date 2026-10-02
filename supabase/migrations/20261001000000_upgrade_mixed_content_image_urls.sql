-- Upgrade stored media URLs to https.
--
-- The Oct 2026 field audit flagged "Page contains both http: and https: URLs"
-- on the homepage: a seeded image was still stored as
-- http://bp.blogspot.com/-.../s1600/... and rendered straight into the page. On
-- https://www.tradibu.com every modern browser blocks or auto-upgrades that
-- request, so the stored http:// form is both an audit failure and a source of
-- unpredictable loading behaviour for visitors.
--
-- The fix belongs in the data: the application has no reason to rewrite URLs on
-- every render, and the value is wrong at rest. Each (table, column) pair is
-- visited in its own BEGIN/EXCEPTION block, so this is safe to run against any
-- environment - a pair that does not exist is skipped with a NOTICE instead of
-- failing the migration, and only rows whose URL still starts with http:// are
-- touched, so re-running updates nothing.

DO $$
DECLARE
  pair RECORD;
  changed integer;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('product_images', 'image_url'),
      ('product_images', 'card_url'),
      ('product_images', 'card_small_url'),
      ('products', 'image_url'),
      ('product_variants', 'image_url'),
      ('marketplace_collections', 'image_url'),
      ('ads_public', 'image_url'),
      ('profiles', 'avatar_url'),
      ('seller_stores', 'banner_url'),
      ('seller_stores', 'logo_url'),
      ('order_items', 'image_url')
    ) AS t(tbl, col)
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE %I SET %I = ''https://'' || substring(%I FROM 8) WHERE %I LIKE ''http://%%''',
        pair.tbl, pair.col, pair.col, pair.col
      );
      GET DIAGNOSTICS changed = ROW_COUNT;
      RAISE NOTICE 'mixed-content upgrade: %.% -> % row(s)', pair.tbl, pair.col, changed;
    EXCEPTION
      WHEN undefined_table OR undefined_column THEN
        RAISE NOTICE 'mixed-content upgrade: %.% not present here, skipped', pair.tbl, pair.col;
    END;
  END LOOP;
END $$;
