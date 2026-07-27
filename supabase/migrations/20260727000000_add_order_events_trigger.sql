-- ============================================================================
-- Migration: Add order status change trigger for audit trail
--
-- This is an ADDITIVE migration. It adds:
--   1. A trigger function that auto-calls log_order_event() on status changes
--   2. A trigger attached to the orders table AFTER UPDATE OF status
--
-- Zero breaking changes. The order_events table already exists from
-- 20260726000000. This just makes it populate automatically.
-- ============================================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.trigger_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_note := CASE
      WHEN NEW.status = 'shipped' THEN
        CASE WHEN NEW.carrier IS NOT NULL THEN 'Shipped via ' || NEW.carrier ELSE 'Shipped' END
      WHEN NEW.status = 'cancelled' THEN 'Order cancelled'
      WHEN NEW.status = 'delivered' THEN 'Order delivered'
      ELSE 'Status changed from ' || COALESCE(OLD.status, 'none') || ' to ' || NEW.status
    END;

    PERFORM public.log_order_event(
      p_order_id => NEW.id,
      p_from_status => OLD.status,
      p_to_status => NEW.status,
      p_note => v_note,
      p_metadata => jsonb_build_object(
        'changed_by', auth.uid(),
        'changed_at', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Attach the trigger
DROP TRIGGER IF EXISTS trg_order_status_change ON public.orders;
CREATE TRIGGER trg_order_status_change
  AFTER UPDATE OF status
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_order_status_change();

-- 3. Grant execute on the trigger function
ALTER FUNCTION public.trigger_order_status_change() OWNER TO postgres;