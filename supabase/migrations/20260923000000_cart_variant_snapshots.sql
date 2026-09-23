-- Preserve the buyer-facing SKU selection and quoted unit price in cart rows.
-- Checkout remains authoritative and revalidates the live SKU price and stock.
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS unit_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS variant_attributes jsonb NOT NULL DEFAULT '{}'::jsonb;
