-- Add seller approval flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Add admin approval flag to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Update RLS: public can only see active AND approved products
DROP POLICY IF EXISTS "Anyone can read active products" ON public.products;
CREATE POLICY "Anyone can read active products" ON public.products
  FOR SELECT USING (status = 'active' AND is_approved = true);
