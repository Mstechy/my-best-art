
-- Replace broken seller-profile read policy that relied on user_roles RLS
DROP POLICY IF EXISTS "Public can read seller profiles" ON public.profiles;
CREATE POLICY "Public can read seller profiles"
ON public.profiles
FOR SELECT
USING (public.is_seller_capable(user_id));

-- Restore message marker validation trigger
DROP TRIGGER IF EXISTS validate_message_markers_trg ON public.messages;
CREATE TRIGGER validate_message_markers_trg
BEFORE INSERT OR UPDATE OF content ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.validate_message_markers();

-- Restore offer status -> chat message triggers
DROP TRIGGER IF EXISTS trg_offer_status_message_ins ON public.offers;
CREATE TRIGGER trg_offer_status_message_ins
AFTER INSERT ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.offer_status_to_message();

DROP TRIGGER IF EXISTS trg_offer_status_message_upd ON public.offers;
CREATE TRIGGER trg_offer_status_message_upd
AFTER UPDATE OF status ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.offer_status_to_message();

-- Restore offers updated_at trigger
DROP TRIGGER IF EXISTS trg_offers_updated_at ON public.offers;
CREATE TRIGGER trg_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Restore order status history trigger
DROP TRIGGER IF EXISTS trg_track_order_status ON public.orders;
CREATE TRIGGER trg_track_order_status
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.track_order_status_change();

-- Restore dispute order validation trigger
DROP TRIGGER IF EXISTS trg_validate_dispute_order ON public.disputes;
CREATE TRIGGER trg_validate_dispute_order
BEFORE INSERT OR UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.validate_dispute_order();
