-- Give product moderation a durable workflow state that both sellers and admins
-- can understand after a refresh or on another device.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS moderation_reason text,
  ADD COLUMN IF NOT EXISTS moderation_next_action text,
  ADD COLUMN IF NOT EXISTS moderation_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.products
SET moderation_updated_at = COALESCE(moderation_updated_at, updated_at, created_at, now())
WHERE moderation_updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_moderation_queue
  ON public.products (seller_id, is_approved, status, moderation_updated_at DESC);

-- Replace the old three-argument function with one function whose optional
-- metadata arguments keep existing three-argument callers compatible.
DROP FUNCTION IF EXISTS public.admin_set_product_approval(uuid, boolean, public.product_status);

CREATE OR REPLACE FUNCTION public.admin_set_product_approval(
  _product_id uuid,
  _is_approved boolean,
  _status public.product_status DEFAULT NULL,
  _moderation_reason text DEFAULT NULL,
  _moderation_next_action text DEFAULT NULL,
  _moderation_owner_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::text) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT seller_id INTO v_seller_id
  FROM public.products
  WHERE id = _product_id;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF NOT _is_approved AND NULLIF(btrim(COALESCE(_moderation_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A reason is required when requesting changes';
  END IF;

  UPDATE public.products
  SET is_approved = _is_approved,
      status = COALESCE(_status, status),
      moderation_reason = CASE WHEN _is_approved THEN NULL ELSE btrim(_moderation_reason) END,
      moderation_next_action = CASE
        WHEN _is_approved THEN NULL
        ELSE COALESCE(NULLIF(btrim(_moderation_next_action), ''), 'Update the listing and submit it again for review.')
      END,
      moderation_owner_id = CASE
        WHEN _is_approved THEN NULL
        ELSE COALESCE(_moderation_owner_id, v_seller_id)
      END,
      moderation_updated_at = now(),
      updated_at = now()
  WHERE id = _product_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_product_approval(uuid, boolean, public.product_status, text, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_set_product_approval(uuid, boolean, public.product_status, text, text, uuid) TO authenticated;
