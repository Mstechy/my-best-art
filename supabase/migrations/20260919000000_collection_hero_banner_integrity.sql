-- A hero slide without an image renders as an empty campaign. Keep this rule
-- in the database so imports and direct API writes cannot bypass the form.
CREATE OR REPLACE FUNCTION public.require_banner_for_hero_collection()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.hero_enabled AND nullif(btrim(NEW.image_url), '') IS NULL THEN
    RAISE EXCEPTION 'Hero-enabled collections require a banner image';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_banner_for_hero_collection ON public.marketplace_collections;
CREATE TRIGGER require_banner_for_hero_collection
  BEFORE INSERT OR UPDATE OF hero_enabled, image_url
  ON public.marketplace_collections
  FOR EACH ROW EXECUTE FUNCTION public.require_banner_for_hero_collection();
