-- Add database-level CHECK constraints for data integrity.
-- These mirror the client-side validation already in place.
-- Using NOT VALID to avoid locking production tables with existing data.
-- Constraints will be validated for new/updated rows immediately.

-- ============================================================
-- 1. products: price must be positive
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_price_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_price_check
      CHECK (price > 0)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 2. products: stock_quantity must be non-negative
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_quantity_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_quantity_check
      CHECK (stock_quantity >= 0)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 3. orders: total_amount must be positive
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_amount_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_total_amount_check
      CHECK (total_amount > 0)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 4. order_items: quantity must be positive
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_quantity_check'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_quantity_check
      CHECK (quantity > 0)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 5. order_items: price must be positive
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_price_check'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_price_check
      CHECK (price > 0)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 6. product_variants: stock_quantity must be non-negative
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_stock_quantity_check'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_stock_quantity_check
      CHECK (stock_quantity >= 0)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 7. product_variants: price must be positive (nullable, only when set)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_price_check'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_price_check
      CHECK (price IS NULL OR price > 0)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 8. reviews: rating must be between 1 and 5
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_rating_check'
  ) THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_rating_check
      CHECK (rating >= 1 AND rating <= 5)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 9. ads: budget must be positive
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ads_budget_check'
  ) THEN
    ALTER TABLE public.ads
      ADD CONSTRAINT ads_budget_check
      CHECK (budget > 0)
      NOT VALID;
  END IF;
END $$;

-- ============================================================
-- 10. disputes: ensure status transitions are valid
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'disputes_status_check'
  ) THEN
    ALTER TABLE public.disputes
      ADD CONSTRAINT disputes_status_check
      CHECK (status IN ('open', 'under_review', 'resolved', 'closed'))
      NOT VALID;
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';