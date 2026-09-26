-- =========================================================
-- TRANSACTIONAL ORDER EMAILS
-- =========================================================
-- Purchase emails are dispatched from the database, not the browser, so a
-- confirmation still goes out when the buyer closes the tab straight after
-- paying. pg_net posts the request asynchronously inside the transaction's
-- lifetime; the order insert never waits on Postmark.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- A trigger cannot read function environment variables, so the endpoint and the
-- shared secret live here. Both are readable only by the database owner.
CREATE TABLE IF NOT EXISTS public.order_email_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  function_url text NOT NULL,
  webhook_secret text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_email_config ENABLE ROW LEVEL SECURITY;
-- No policy: the table is deliberately unreachable from the client. Only the
-- SECURITY DEFINER trigger below and the service role can read it.
REVOKE ALL ON public.order_email_config FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_order_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.order_email_config;
  v_payload jsonb;
  v_event text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'order_created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_event := 'order_status_changed';
  ELSE
    RETURN NEW;  -- nothing meaningful changed
  END IF;

  SELECT * INTO v_config FROM public.order_email_config WHERE id LIMIT 1;
  IF NOT FOUND OR v_config.function_url IS NULL OR v_config.webhook_secret IS NULL THEN
    RETURN NEW;  -- email is not configured yet; never block the order
  END IF;

  v_payload := jsonb_build_object('event', v_event, 'orderId', NEW.id::text);

  PERFORM net.http_post(
    url     := v_config.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_config.webhook_secret
    ),
    body    := v_payload::text,
    timeout_milliseconds := 10000
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Email is never worth failing a paid order over. The in-app notification
    -- triggers still run, and the order itself is committed.
    RAISE WARNING 'order email dispatch failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_dispatch_email ON public.orders;
CREATE TRIGGER trg_orders_dispatch_email
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_order_email();

-- A dispute is escalated to the seller by email as well as in-app, because an
-- unresolved dispute is the fastest route to a chargeback.
CREATE OR REPLACE FUNCTION public.dispatch_dispute_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config public.order_email_config;
BEGIN
  SELECT * INTO v_config FROM public.order_email_config WHERE id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url     := v_config.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_config.webhook_secret
    ),
    body    := jsonb_build_object(
      'event', 'dispute_opened',
      'disputeId', NEW.id::text
    )::text,
    timeout_milliseconds := 10000
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'dispute email dispatch failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disputes_dispatch_email ON public.disputes;
CREATE TRIGGER trg_disputes_dispatch_email
  AFTER INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_dispute_email();
