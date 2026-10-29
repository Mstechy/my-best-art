-- Sellers may edit their listing, but approval and moderation state belongs to admins.
-- Without this trigger, the seller-owned products UPDATE policy also allowed a
-- seller to set is_approved=true or rewrite the moderation queue metadata.

CREATE OR REPLACE FUNCTION public.prevent_seller_moderation_field_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role jobs have no end-user auth.uid() and remain trusted. Admins
  -- use admin_set_product_approval(), which intentionally changes these fields.
  IF auth.uid() IS NULL OR auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'admin'::text) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_approved IS DISTINCT FROM false
      OR NEW.moderation_reason IS NOT NULL
      OR NEW.moderation_next_action IS NOT NULL
      OR NEW.moderation_owner_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only administrators can set product moderation fields';
    END IF;
  ELSIF OLD.seller_id = auth.uid()
    AND (NEW.is_approved IS DISTINCT FROM OLD.is_approved
      OR NEW.moderation_reason IS DISTINCT FROM OLD.moderation_reason
      OR NEW.moderation_next_action IS DISTINCT FROM OLD.moderation_next_action
      OR NEW.moderation_owner_id IS DISTINCT FROM OLD.moderation_owner_id
      OR NEW.moderation_updated_at IS DISTINCT FROM OLD.moderation_updated_at) THEN
    RAISE EXCEPTION 'Only administrators can change product moderation fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_seller_moderation_field_changes ON public.products;
CREATE TRIGGER trg_prevent_seller_moderation_field_changes
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_moderation_field_changes();

REVOKE ALL ON FUNCTION public.prevent_seller_moderation_field_changes() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
