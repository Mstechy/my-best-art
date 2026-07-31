-- ============================================================
-- PERFORMANCE INDEXES — Scale to millions of users
-- Adds missing indexes for foreign keys, filters, and sorts
-- ============================================================

-- ORDERS
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
-- Composite for seller order dashboard (most common query)
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON public.orders (seller_id, status, created_at DESC);
-- Composite for buyer order history
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders (buyer_id, status, created_at DESC);

-- ORDER ITEMS
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON public.order_items (seller_id);

-- PRODUCT IMAGES
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images (product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_primary ON public.product_images (product_id, is_primary) WHERE is_primary = true;

-- PRODUCT VARIANTS
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants (product_id, sort_order);

-- MESSAGES
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages (receiver_id, created_at DESC);
-- Composite for chat listing (most common query: get conversations by user)
CREATE INDEX IF NOT EXISTS idx_messages_participants ON public.messages (sender_id, receiver_id, created_at DESC);

-- WISHLISTS
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists (user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON public.wishlists (product_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_product ON public.wishlists (user_id, product_id);

-- REVIEWS
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_buyer_id ON public.reviews (buyer_id);

-- DISPUTES
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON public.disputes (order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_reporter_id ON public.disputes (reporter_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes (status);

-- PRODUCT VIEWS (analytics — potentially high volume)
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON public.product_views (product_id);
CREATE INDEX IF NOT EXISTS idx_product_views_created_at ON public.product_views (created_at DESC);
-- Composite for trending products query
CREATE INDEX IF NOT EXISTS idx_product_views_product_date ON public.product_views (product_id, created_at DESC);

-- CATEGORIES
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories (sort_order);

-- MARKETPLACE COLLECTIONS
CREATE INDEX IF NOT EXISTS idx_collections_status_sort ON public.marketplace_collections (status, sort_order);
CREATE INDEX IF NOT EXISTS idx_collections_seller_status ON public.marketplace_collections (seller_id, status);

-- CARTS (persistent carts)
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items (product_id);

-- SELLER WALLETS
CREATE INDEX IF NOT EXISTS idx_seller_wallets_seller_id ON public.seller_wallets (seller_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions (wallet_id, created_at DESC);

-- ADS
CREATE INDEX IF NOT EXISTS idx_ads_status ON public.ads (status, placement);
CREATE INDEX IF NOT EXISTS idx_ads_created_at ON public.ads (created_at DESC);

-- PROFILES
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);