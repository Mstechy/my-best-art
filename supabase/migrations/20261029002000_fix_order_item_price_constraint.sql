-- The historical order-item check referenced a non-existent `price` column.
-- Order snapshots store the authoritative unit amount in `unit_price`.
-- Add the intended constraint without rewriting or deleting existing data.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_unit_price_check'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_unit_price_check
      CHECK (unit_price > 0)
      NOT VALID;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
