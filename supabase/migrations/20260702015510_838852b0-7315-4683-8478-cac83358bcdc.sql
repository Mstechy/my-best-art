
-- Admin bypass for product_images
CREATE POLICY "Admins manage all product images" ON public.product_images
FOR ALL USING (public.has_role(auth.uid(), 'admin'::text))
WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

-- Admin bypass for product_documents
CREATE POLICY "Admins manage all product docs" ON public.product_documents
FOR ALL USING (public.has_role(auth.uid(), 'admin'::text))
WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

-- Payment policy on stores
ALTER TABLE public.seller_stores ADD COLUMN IF NOT EXISTS payment_policy text;

-- Site pages
CREATE TABLE public.site_pages (
  slug text PRIMARY KEY,
  title text NOT NULL,
  body_markdown text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.site_pages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_pages TO authenticated;
GRANT ALL ON public.site_pages TO service_role;

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site pages" ON public.site_pages
FOR SELECT USING (true);

CREATE POLICY "Admins can insert site pages" ON public.site_pages
FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "Admins can update site pages" ON public.site_pages
FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::text))
WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

CREATE POLICY "Admins can delete site pages" ON public.site_pages
FOR DELETE USING (public.has_role(auth.uid(), 'admin'::text));

CREATE TRIGGER site_pages_updated_at
BEFORE UPDATE ON public.site_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.site_pages (slug, title, body_markdown) VALUES
('terms', 'Terms of Service', E'## 1. Acceptance of Terms\n\nBy accessing or using MarketHub, you agree to be bound by these Terms of Service.\n\n## 2. Eligibility\n\nYou must be at least 18 years old to use MarketHub.\n\n## 3. User Accounts\n\n- Keep your credentials confidential\n- Provide accurate information\n- You are responsible for activity under your account\n\n## 4. Buyer Terms\n\nBuyers agree to pay listed prices and not transact off-platform.\n\n## 5. Seller Terms\n\nSellers must provide accurate listings, fulfill orders promptly, and follow platform policies.\n\n## 6. Platform Fees\n\nMarketHub charges commission on completed transactions.\n\n## 7. Prohibited Content\n\nCounterfeit goods, weapons, controlled substances, and illegal items are not allowed.\n\n## 8. Limitation of Liability\n\nMarketHub is a marketplace and not a party to buyer-seller transactions.\n\n## 9. Changes to Terms\n\nWe may modify these terms with 14 days notice.'),
('privacy', 'Privacy Policy', E'## 1. Information We Collect\n\nWe collect account info, transaction data, and usage analytics.\n\n## 2. How We Use Your Information\n\n- Manage your account\n- Process transactions\n- Prevent fraud\n- Improve the platform\n\n## 3. How We Share Your Information\n\nWe do not sell your personal data. We share only with sellers/buyers as needed to fulfill orders.\n\n## 4. Your Rights\n\nYou can request access, correction, or deletion of your data at privacy@markethub.com.\n\n## 5. Security\n\nWe use SSL/TLS encryption and industry-standard security practices.'),
('refund', 'Refund & Return Policy', E'## 1. Buyer Protection\n\nFull refunds are available when items are undelivered, misdescribed, or damaged.\n\n## 2. Return Process\n\n- Open a dispute within 7 days of delivery\n- Provide photo evidence\n- Sellers have 48 hours to respond\n- Refunds issued in 5-10 business days\n\n## 3. Non-Refundable\n\n- Change of mind (unless seller agrees)\n- Final sale items\n- Custom or personalized items'),
('shipping', 'Shipping Policy', E'## Shipping Information\n\nSellers are responsible for shipping their own items.\n\n- Standard delivery: 3-7 business days\n- Express delivery: 1-3 business days\n- International: 7-21 business days\n\nTracking is provided once orders are shipped.'),
('payment', 'Payment Policy', E'## Accepted Payment Methods\n\n- Credit and debit cards\n- Bank transfers\n- Digital wallets\n\n## Escrow Protection\n\nPayments are held in escrow until the buyer confirms delivery. This protects both buyers and sellers.\n\n## Refunds\n\nRefunds are processed to the original payment method within 5-10 business days.'),
('about', 'About MarketHub', E'## Our Mission\n\nMarketHub connects buyers and sellers in a trusted, secure marketplace.\n\n## What We Offer\n\n- Verified sellers\n- Secure escrow payments\n- Buyer protection\n- 24/7 support\n\n## Contact\n\nEmail: support@markethub.com'),
('contact', 'Contact MarketHub', E'We are here to help.\n\n- **Support:** support@markethub.com\n- **Privacy:** privacy@markethub.com\n- **Legal:** legal@markethub.com\n\nWe respond within 24 hours on business days.')
ON CONFLICT (slug) DO NOTHING;
