-- Editable, plain-text marketplace policies. Apply through the normal Supabase migration flow.
ALTER TABLE public.seller_stores
  ADD COLUMN IF NOT EXISTS shipping_cost_amount numeric CHECK (shipping_cost_amount IS NULL OR shipping_cost_amount >= 0),
  ADD COLUMN IF NOT EXISTS shipping_currency text CHECK (shipping_currency IS NULL OR char_length(shipping_currency) BETWEEN 3 AND 3),
  ADD COLUMN IF NOT EXISTS free_shipping_threshold numeric CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold >= 0),
  ADD COLUMN IF NOT EXISTS ship_from_location text CHECK (ship_from_location IS NULL OR char_length(ship_from_location) <= 120),
  ADD COLUMN IF NOT EXISTS processing_days_min integer CHECK (processing_days_min IS NULL OR processing_days_min >= 0),
  ADD COLUMN IF NOT EXISTS processing_days_max integer CHECK (processing_days_max IS NULL OR processing_days_max >= processing_days_min),
  ADD COLUMN IF NOT EXISTS delivery_days_min integer CHECK (delivery_days_min IS NULL OR delivery_days_min >= 0),
  ADD COLUMN IF NOT EXISTS delivery_days_max integer CHECK (delivery_days_max IS NULL OR delivery_days_max >= delivery_days_min),
  ADD COLUMN IF NOT EXISTS return_accepted boolean,
  ADD COLUMN IF NOT EXISTS return_window_days integer CHECK (return_window_days IS NULL OR return_window_days >= 0),
  ADD COLUMN IF NOT EXISTS return_conditions text CHECK (return_conditions IS NULL OR char_length(return_conditions) <= 2000),
  ADD COLUMN IF NOT EXISTS return_shipping_payer text CHECK (return_shipping_payer IS NULL OR return_shipping_payer IN ('seller', 'buyer', 'case_by_case')),
  ADD COLUMN IF NOT EXISTS warranty_duration text CHECK (warranty_duration IS NULL OR char_length(warranty_duration) <= 120),
  ADD COLUMN IF NOT EXISTS warranty_terms text CHECK (warranty_terms IS NULL OR char_length(warranty_terms) <= 2000);

CREATE TABLE IF NOT EXISTS public.platform_policies (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  shipping_cost_amount numeric CHECK (shipping_cost_amount IS NULL OR shipping_cost_amount >= 0),
  shipping_currency text CHECK (shipping_currency IS NULL OR char_length(shipping_currency) = 3),
  free_shipping_threshold numeric CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold >= 0),
  ship_from_location text CHECK (ship_from_location IS NULL OR char_length(ship_from_location) <= 120),
  processing_days_min integer CHECK (processing_days_min IS NULL OR processing_days_min >= 0),
  processing_days_max integer CHECK (processing_days_max IS NULL OR processing_days_max >= processing_days_min),
  delivery_days_min integer CHECK (delivery_days_min IS NULL OR delivery_days_min >= 0),
  delivery_days_max integer CHECK (delivery_days_max IS NULL OR delivery_days_max >= delivery_days_min),
  shipping_regions text[] NOT NULL DEFAULT '{}',
  shipping_terms text CHECK (shipping_terms IS NULL OR char_length(shipping_terms) <= 2000),
  return_accepted boolean,
  return_window_days integer CHECK (return_window_days IS NULL OR return_window_days >= 0),
  return_conditions text CHECK (return_conditions IS NULL OR char_length(return_conditions) <= 2000),
  return_shipping_payer text CHECK (return_shipping_payer IS NULL OR return_shipping_payer IN ('seller', 'buyer', 'case_by_case')),
  warranty_duration text CHECK (warranty_duration IS NULL OR char_length(warranty_duration) <= 120),
  warranty_terms text CHECK (warranty_terms IS NULL OR char_length(warranty_terms) <= 2000),
  buyer_protection_refund_window_days integer CHECK (buyer_protection_refund_window_days IS NULL OR buyer_protection_refund_window_days >= 0),
  buyer_protection_claim_steps text CHECK (buyer_protection_claim_steps IS NULL OR char_length(buyer_protection_claim_steps) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.platform_policies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_policies TO authenticated;
ALTER TABLE public.platform_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads platform policies" ON public.platform_policies FOR SELECT USING (true);
CREATE POLICY "Admins manage platform policies" ON public.platform_policies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));
CREATE TRIGGER trg_platform_policies_updated BEFORE UPDATE ON public.platform_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.platform_policies (id, shipping_terms, return_conditions, warranty_terms, buyer_protection_claim_steps)
VALUES (true,
  '[ADMIN: enter platform shipping terms]',
  '[ADMIN: enter platform return conditions]',
  '[ADMIN: enter platform warranty terms]',
  '[ADMIN: enter buyer-protection claim steps]')
ON CONFLICT (id) DO NOTHING;
