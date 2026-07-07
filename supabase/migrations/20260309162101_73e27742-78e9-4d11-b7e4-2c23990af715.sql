
-- Enums
CREATE TYPE public.product_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE public.order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'disputed');
CREATE TYPE public.dispute_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
CREATE TYPE public.ad_placement AS ENUM ('banner', 'sidebar', 'featured');
CREATE TYPE public.ad_status AS ENUM ('active', 'paused', 'ended');
CREATE TYPE public.wallet_tx_type AS ENUM ('sale', 'withdrawal', 'fee', 'refund');

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text,
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON public.categories FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'::text));

-- Seed categories
INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Electronics', 'electronics', 'Cpu', 1),
  ('Fashion', 'fashion', 'Shirt', 2),
  ('Jewelry', 'jewelry', 'Gem', 3),
  ('Books', 'books', 'BookOpen', 4),
  ('Sports', 'sports', 'Dumbbell', 5),
  ('Home & Garden', 'home-garden', 'Home', 6),
  ('Food & Drink', 'food-drink', 'UtensilsCrossed', 7),
  ('Health & Beauty', 'health-beauty', 'Heart', 8);

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  compare_at_price numeric(12,2),
  currency text NOT NULL DEFAULT 'USD',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  status product_status NOT NULL DEFAULT 'draft',
  stock_quantity int NOT NULL DEFAULT 0,
  sku text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can read active products" ON public.products FOR SELECT TO public USING (status = 'active');
CREATE POLICY "Sellers can read own products" ON public.products FOR SELECT TO public USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can insert own products" ON public.products FOR INSERT TO public WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update own products" ON public.products FOR UPDATE TO public USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete own products" ON public.products FOR DELETE TO public USING (auth.uid() = seller_id);
CREATE POLICY "Admins can manage all products" ON public.products FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'::text));

-- Product images
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false
);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read product images" ON public.product_images FOR SELECT TO public USING (true);
CREATE POLICY "Sellers can manage own product images" ON public.product_images FOR ALL TO public USING (
  EXISTS (SELECT 1 FROM public.products WHERE id = product_id AND seller_id = auth.uid())
);

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  shipping_address jsonb,
  tracking_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Buyers can read own orders" ON public.orders FOR SELECT TO public USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers can read own orders" ON public.orders FOR SELECT TO public USING (auth.uid() = seller_id);
CREATE POLICY "Buyers can create orders" ON public.orders FOR INSERT TO public WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Sellers can update own orders" ON public.orders FOR UPDATE TO public USING (auth.uid() = seller_id);
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'::text));

-- Order items
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL,
  total_price numeric(12,2) NOT NULL
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own order items" ON public.order_items FOR SELECT TO public USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
);
CREATE POLICY "Buyers can insert order items" ON public.order_items FOR INSERT TO public WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND buyer_id = auth.uid())
);
CREATE POLICY "Admins can manage all order items" ON public.order_items FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'::text));

-- Messages
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT TO public USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO public WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Receiver can update messages (mark read)" ON public.messages FOR UPDATE TO public USING (auth.uid() = receiver_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Disputes
CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  proof_url text,
  status dispute_status NOT NULL DEFAULT 'open',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers can create disputes" ON public.disputes FOR INSERT TO public WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyers can read own disputes" ON public.disputes FOR SELECT TO public USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers can read own disputes" ON public.disputes FOR SELECT TO public USING (auth.uid() = seller_id);
CREATE POLICY "Admins can manage all disputes" ON public.disputes FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'::text));

-- Ads
CREATE TABLE public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid,
  title text NOT NULL,
  image_url text,
  target_url text,
  placement ad_placement NOT NULL DEFAULT 'banner',
  status ad_status NOT NULL DEFAULT 'active',
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  budget numeric(12,2) NOT NULL DEFAULT 0,
  spent numeric(12,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active ads" ON public.ads FOR SELECT TO public USING (status = 'active');
CREATE POLICY "Sellers can manage own ads" ON public.ads FOR ALL TO public USING (auth.uid() = seller_id);
CREATE POLICY "Admins can manage all ads" ON public.ads FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'::text));

-- Seller wallets
CREATE TABLE public.seller_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL UNIQUE,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seller_wallets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_seller_wallets_updated_at BEFORE UPDATE ON public.seller_wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Sellers can read own wallet" ON public.seller_wallets FOR SELECT TO public USING (auth.uid() = seller_id);
CREATE POLICY "Admins can manage all wallets" ON public.seller_wallets FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'::text));

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.seller_wallets(id) ON DELETE CASCADE,
  type wallet_tx_type NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers can read own wallet transactions" ON public.wallet_transactions FOR SELECT TO public USING (
  EXISTS (SELECT 1 FROM public.seller_wallets WHERE id = wallet_id AND seller_id = auth.uid())
);
CREATE POLICY "Admins can manage all wallet transactions" ON public.wallet_transactions FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'::text));

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
CREATE POLICY "Anyone can read product images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own product images" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own product images" ON storage.objects FOR DELETE TO public USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
