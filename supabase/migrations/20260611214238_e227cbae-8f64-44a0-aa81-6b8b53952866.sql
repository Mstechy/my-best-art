ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ships_to text[] NOT NULL DEFAULT '{}'::text[];
