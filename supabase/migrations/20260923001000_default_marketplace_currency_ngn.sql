-- New marketplace records use Nigerian naira by default. Existing records
-- retain their recorded currency and are converted for shoppers at display time.
ALTER TABLE public.products
  ALTER COLUMN currency SET DEFAULT 'NGN';

ALTER TABLE public.orders
  ALTER COLUMN currency SET DEFAULT 'NGN';

ALTER TABLE public.seller_wallets
  ALTER COLUMN currency SET DEFAULT 'NGN';

ALTER TABLE public.profiles
  ALTER COLUMN preferred_currency SET DEFAULT 'NGN';
