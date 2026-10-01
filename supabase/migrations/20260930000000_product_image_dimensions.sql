-- Intrinsic dimensions for every product image, so a card can reserve its EXACT
-- space before the file has loaded.
--
-- Why this is a data-model change and not a frontend trick: a masonry (waterfall)
-- feed places each card in the currently shortest column, so a tile whose height is
-- unknown until the image decodes moves every card below it - the feed re-flows
-- while the shopper is reading it. CSS `aspect-ratio` removes that, but only if the
-- browser is told the ratio up front, and the ratio only exists server-side if it
-- was captured at upload time. `IntrinsicSize` from the decoded file is therefore
-- stored, not guessed.
--
-- All four columns are nullable on purpose:
--   * Rows written before this migration have no stored size (see
--     `scripts/backfillImageDimensions.ts`, which fills them from the image
--     headers).
--   * A row whose size cannot be established must still render, so the reader
--     falls back to 1:1 rather than hiding the product.
-- NULL therefore means "unknown", never "zero", which is why the CHECK
-- constraints below reject a stored 0 while permitting NULL.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS image_width  integer,
  ADD COLUMN IF NOT EXISTS image_height integer,
  ADD COLUMN IF NOT EXISTS image_bytes  bigint,
  ADD COLUMN IF NOT EXISTS image_format text;

COMMENT ON COLUMN public.product_images.image_width IS
  'Intrinsic width in pixels of the ORIGINAL upload; NULL when unknown. Never 0.';
COMMENT ON COLUMN public.product_images.image_height IS
  'Intrinsic height in pixels of the ORIGINAL upload; NULL when unknown. Never 0.';
COMMENT ON COLUMN public.product_images.image_bytes IS
  'Size in bytes of the original upload; NULL for rows written before this migration.';
COMMENT ON COLUMN public.product_images.image_format IS
  'Lowercase extension of the original upload (jpg, png, webp, gif, svg), or NULL.';

-- The card-clamping rule, expressed once in SQL so a future server-side reader
-- (RPC, generated column, sitemap) cannot invent a different clamp.
--   * 3:4 portrait is the tallest a tile may be shown at,
--   * 1:1 is the widest.
-- Anything outside that window is display-clamped by the client, which is why this
-- function is a convenience and not a constraint on the stored data: a genuinely
-- panoramic upload keeps its true dimensions and is cover-cropped on screen.
CREATE OR REPLACE FUNCTION public.product_image_display_ratio(
  p_width integer, p_height integer
)
RETURNS numeric
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT least(1.0, greatest(0.75,
    CASE
      WHEN coalesce(p_width, 0) > 0 AND coalesce(p_height, 0) > 0
        THEN p_width::numeric / p_height::numeric
      ELSE 1.0
    END
  ));
$$;

COMMENT ON FUNCTION public.product_image_display_ratio(integer, integer) IS
  'Display aspect ratio (w/h) for a masonry tile, clamped to [3:4, 1:1]; 1:1 when either dimension is unknown.';

GRANT EXECUTE ON FUNCTION public.product_image_display_ratio(integer, integer) TO anon, authenticated;

-- Constraints are added idempotently and NOT VALID to match the convention in
-- 20260804000000_product_page_and_upload_phase1.sql: a large table is never held
-- under an ACCESS EXCLUSIVE lock while every existing row is verified.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_width_check') THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_width_check
      CHECK (image_width IS NULL OR image_width > 0)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_height_check') THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_height_check
      CHECK (image_height IS NULL OR image_height > 0)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_bytes_check') THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_bytes_check
      CHECK (image_bytes IS NULL OR image_bytes > 0)
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_format_check') THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_format_check
      CHECK (image_format IS NULL OR image_format IN ('jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'))
      NOT VALID;
  END IF;
END $$;

-- Partial index: the masonry feed only ever asks "which rows still lack a size?",
-- and that predicate matches a shrinking minority of the table, so the index stays
-- small and the query stays cheap.
CREATE INDEX IF NOT EXISTS idx_product_images_missing_dimensions
  ON public.product_images (product_id)
  WHERE image_width IS NULL OR image_height IS NULL;

-- Refresh PostgREST schema cache so the new columns are selectable immediately.
NOTIFY pgrst, 'reload schema';
