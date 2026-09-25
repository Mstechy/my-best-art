-- Marketplace safety controls: 30-day active-order presentation is handled in the UI;
-- completed records are not deleted. Admin exports and message flags are auditable.

CREATE TABLE IF NOT EXISTS public.admin_order_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id),
  format text NOT NULL CHECK (format IN ('csv')),
  from_date date,
  to_date date,
  order_ids uuid[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_order_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage order export audit" ON public.admin_order_exports;
CREATE POLICY "Admins manage order export audit" ON public.admin_order_exports
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text) AND admin_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.message_safety_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reason text NOT NULL,
  matched_terms text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz
);
ALTER TABLE public.message_safety_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage message safety flags" ON public.message_safety_flags;
CREATE POLICY "Admins manage message safety flags" ON public.message_safety_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

CREATE OR REPLACE FUNCTION public.flag_off_platform_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  terms text[];
BEGIN
  terms := ARRAY(
    SELECT term FROM (VALUES
      (CASE WHEN NEW.content ~* '(whatsapp|telegram|wechat|signal)\.?me|https?://(wa\.me|chat\.whatsapp|t\.me)' THEN 'external-messaging-link' END),
      (CASE WHEN NEW.content ~* '([[:alnum:]._%+-]+)[[:space:]]*@[[:alnum:].-]+\.[[:alpha:]]{2,}' THEN 'email-address' END),
      (CASE WHEN NEW.content ~* '(\+?[0-9][0-9 ()-]{7,}[0-9])' THEN 'phone-number' END),
      (CASE WHEN NEW.content ~* '(pay|send|transfer).{0,35}(outside|directly|bank|account|cash|wire)|bank account|account number' THEN 'off-platform-payment' END)
    ) AS matches(term)
    WHERE term IS NOT NULL
  );
  IF cardinality(terms) > 0 THEN
    INSERT INTO public.message_safety_flags (message_id, reason, matched_terms)
    VALUES (NEW.id, 'possible-off-platform-contact-or-payment', terms);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_flag_off_platform_message ON public.messages;
CREATE TRIGGER trg_flag_off_platform_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.flag_off_platform_message();

CREATE INDEX IF NOT EXISTS idx_orders_active_created_at ON public.orders (created_at DESC) WHERE status NOT IN ('delivered', 'cancelled', 'disputed');
CREATE INDEX IF NOT EXISTS idx_message_safety_flags_status ON public.message_safety_flags (status, created_at DESC);
NOTIFY pgrst, 'reload schema';
