# End-to-End Test Checklist

Live verification of every interactive flow. Run in this order against the published preview.

## Baseline
- 5 profiles · 2 admins · 3 sellers · 3 buyers · 6 products · 0 ads · 0 messages · 0 orders · 0 disputes · 0 reviews

## 1. Auth & role routing
- [ ] Register new buyer → `/buyer/dashboard`
- [ ] Register new seller → "Account Under Review" gate; admin sees +1 in **Pending Sellers**
- [ ] Login as admin → `/admin/dashboard`; counts match `admin_platform_counts()`
- [ ] Login as approved seller → `/seller/dashboard` accessible
- [ ] Banned/frozen user signed out at the gate

## 2. Admin user directory
- [ ] `/admin/sellers` lists every account (email, roles, products, orders, status)
- [ ] **Make Seller** grants `seller` role and approves
- [ ] **Approve / Revoke / Verify / Freeze / Ban / Restore** update flags live
- [ ] Tab counts (All / Sellers / Buyers / Admins / Pending / Frozen / Banned) update live

## 3. Marketplace browsing
- [ ] Landing + Marketplace use 2/3/4–5 col grid (mobile/tablet/desktop)
- [ ] Active `ads` row shows promo banner; dismiss works
- [ ] Marquee click deep-links to `/marketplace?promo=...`; filter applied
- [ ] PDP shows swipeable image carousel with dot indicators

## 4. PDP CTAs
- [ ] **Chat with Seller** primary purple button visible above **Buy Now** for logged-in buyers
- [ ] Hidden for guests and for the seller of the product themselves
- [ ] Clicking opens `/buyer/chat?seller=&product=` with prefilled negotiation message
- [ ] **Make Offer** opens dialog with note (max 500) and optional image/PDF attachment (≤5 MB)
- [ ] Submitted offer creates a chat message containing `[product:UUID] [offer:PRICE] [attachment:URL]`
- [ ] **Copy Product Link** copies and shows checkmark morph

## 5. Cart, checkout, orders, tracking
- [ ] Add to cart → drawer updates; checkout creates `orders` + `order_items`
- [ ] Seller sees order in `/seller/orders`
- [ ] Marking **Shipped** without carrier + tracking number is blocked with toast
- [ ] After Shipped: status_history appended; buyer's `/buyer/orders` shows new badge in real-time
- [ ] Buyer receives a system chat message with `[order:UUID]` and a sonner toast linking to `/buyer/tracking`
- [ ] `/buyer/tracking` shows latest status timeline live

## 6. Reviews
- [ ] Buyer with **delivered** order can submit a review
- [ ] `products.average_rating` and `review_count` update via trigger
- [ ] Buyer without delivered order is blocked

## 7. Wishlist
- [ ] Heart toggle on product card adds/removes from `wishlists`
- [ ] `/buyer/wishlist` reflects state

## 8. Per-product chat & negotiation
- [ ] BuyerChat & SellerChat render `ProductRefCard` for valid `[product:UUID]`, `[order:UUID]`, `[offer:PRICE]`, `[attachment:URL]`
- [ ] Malformed markers (e.g. `[offer:abc]`, non-supabase attachment) are ignored — see `src/test/productRefCard.test.ts`
- [ ] Realtime: new messages appear in both windows without refresh

## 9. Reports → disputes
- [ ] Buyer files a report tied to a real order → `disputes` row
- [ ] Admin sees it in `/admin/disputes`; can mark Investigating / Resolve / Dismiss
- [ ] `resolved_at` timestamp set on closure

## 10. Ads & promotional banners
- [ ] Admin creates ad (title, image, target URL, placement=banner, status=active)
- [ ] Banner appears on LandingPage; pause / resume / end / delete work

## 11. Security
- [ ] Storage: anon cannot list `product-images`; authenticated upload restricted to `products/*` and `offers/<own-uid>/*`
- [ ] `messages` enforces `1–2000 char` content and `sender_id <> receiver_id`
- [ ] Admin RPCs cannot be invoked by anon
- [ ] RLS enforces buyer/seller/admin scoping on every table

## How to run
- Manual: walk through each section in the preview.
- Automated parser tests: `bunx vitest run src/test/productRefCard.test.ts`
