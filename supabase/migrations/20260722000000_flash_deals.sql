-- Flash Deals
-- Adds seller-controlled flash deal scheduling with system-managed status lifecycle.
-- Sellers set discount + start/end; system sets pending/active/expired.
-- Admin can pause or reject active deals.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS flash_deal_discount_percent integer,
  ADD COLUMN IF NOT EXISTS flash_deal_start_at    timestamptz,
  ADD COLUMN IF NOT EXISTS flash_deal_end_at      timestamptz,
  ADD COLUMN IF NOT EXISTS flash_deal_status      text NOT NULL DEFAULT 'pending',
  ADD CONSTRAINT IF NOT EXISTS products_flash_deal_status_check
    CHECK (flash_deal_status IN ('pending','active','paused','rejected','expired'));

-- Index to support fast active-flash-deal lookups in homepage/search feeds
CREATE INDEX IF NOT EXISTS idx_products_flash_deal_feed
  ON public.products (status, is_approved, flash_deal_end_at)
  WHERE flash_deal_status = 'active';

-- Maintain flash_deal_status automatically based on start/end timestamps
CREATE OR REPLACE FUNCTION public.maintain_flash_deal_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.flash_deal_discount_percent IS NULL OR NEW.flash_deal_start_at IS NULL OR NEW.flash_deal_end_at IS NULL THEN
    NEW.flash_deal_status := COALESCE(NEW.flash_deal_status, 'pending');
    RETURN NEW;
  END IF;

  IF NEW.flash_deal_status NOT IN ('paused','rejected') THEN
    IF now() < NEW.flash_deal_start_at THEN
      NEW.flash_deal_status := 'pending';
    ELSIF now() >= NEW.flash_deal_start_at AND now() <= NEW.flash_deal_end_at THEN
      NEW.flash_deal_status := 'active';
    ELSE
      NEW.flash_deal_status := 'expired';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintain_flash_deal_status ON public.products;
CREATE TRIGGER trg_maintain_flash_deal_status
  BEFORE INSERT OR UPDATE OF flash_deal_discount_percent, flash_deal_start_at, flash_deal_end_at
  ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.maintain_flash_deal_status();

-- Admin override for flash deal status (pause/reject/activate)
CREATE OR REPLACE FUNCTION public.admin_set_flash_deal_status(
  _product_id      uuid,
  _new_status      text  -- 'paused' | 'rejected' | 'pending' | 'active'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.products
  SET flash_deal_status = _new_status
  WHERE id = _product_id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_flash_deal_status(uuid, text) TO authenticated;