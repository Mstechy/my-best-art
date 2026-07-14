CREATE TABLE IF NOT EXISTS public.product_discovery_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression', 'view', 'click', 'wishlist', 'add_to_cart')),
  visitor_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_discovery_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_product_discovery_events_product_type_created
  ON public.product_discovery_events (product_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_discovery_events_created
  ON public.product_discovery_events (created_at DESC);

CREATE OR REPLACE FUNCTION public.track_product_discovery_event(
  p_product_ids uuid[],
  p_event_type text,
  p_visitor_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN ('impression', 'view', 'click', 'wishlist', 'add_to_cart') OR cardinality(p_product_ids) = 0 OR cardinality(p_product_ids) > 48 THEN
    RAISE EXCEPTION 'Invalid discovery event';
  END IF;

  INSERT INTO public.product_discovery_events (product_id, event_type, visitor_id, user_id)
  SELECT p.id, p_event_type, p_visitor_id, auth.uid()
  FROM public.products p
  WHERE p.id = ANY(p_product_ids)
    AND p.status = 'active'
    AND p.is_approved = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_product_discovery_event(uuid[], text, uuid) TO anon, authenticated;
