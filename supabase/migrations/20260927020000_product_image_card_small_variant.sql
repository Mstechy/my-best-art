-- A second, small card derivative so the catalogue can serve a right-sized image.
--
-- The single 900px WebP card averaged 280 KB, which a 24-card grid downloads in full
-- even though a card slot is roughly 180px on a phone and 300px on a desktop. The
-- small derivative is stored explicitly rather than derived from a filename pattern,
-- so the browser is never asked for a file that does not exist. Rows written before
-- this migration keep a NULL here and continue to receive the 900px asset, so nothing
-- changes for existing listings.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS card_small_url text;

COMMENT ON COLUMN public.product_images.card_small_url IS
  '320px WebP derivative for grid cards; NULL for images uploaded before responsive cards.';
