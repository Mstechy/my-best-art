
This is a multi-part cleanup. I'll do it in one migration + focused UI edits.

## 1. Bug: `seller_wallets.available_balance does not exist`
The BuyerOrders / delivery flow triggers `handle_order_delivered` which writes to `seller_wallets.available_balance`. That column is missing. I'll add the missing columns (`available_balance`, `pending_balance`, `total_earned`) with safe defaults if not already present, so wallet updates + delivery actions stop erroring.

## 2. Admin permissions (Amazon/Facebook model)
Admin should NOT edit other sellers' products. They can only:
- Approve / Reject (ban from marketplace)
- Delete
- Edit ONLY products where they are the seller

Changes:
- Remove admin UPDATE policies on `products`, `product_images`, `product_documents` added in the last migration (keep admin DELETE + admin approval via `is_approved` toggle).
- Add a dedicated `admin_set_product_approval(_id, _approved)` RPC (SECURITY DEFINER) so admins can still moderate the `is_approved` and `status` fields without a broad UPDATE policy.
- Rework `AdminProducts.tsx`:
  - Remove edit dialog for other sellers' products; show only Approve/Reject/Delete + "View".
  - For products where `seller_id = current admin`, show a full Edit button that opens the same product form sellers use.
  - Add a "Publish new product" button on Admin Products page that opens the seller product creation dialog (admin publishes as themselves).
- Delete `AdminProductEditDialog.tsx` (or repurpose as read-only detail view).

## 3. Buyer rating prompt on delivered orders
- In `BuyerOrders.tsx` and `BuyerDashboard.tsx`, show a persistent "Rate this order" banner/card for every `delivered` order that has no review yet.
- Prompt survives page reloads (query `reviews` table by buyer+product). A dismissible toast + inline CTA on the order card + a top-of-page banner listing pending reviews.
- No auto-dismiss until review is submitted.

## 4. Admin danger notifications
- Add `system_alerts` table (level: info|warning|critical, message, source, resolved bool, created_at).
- Add a red pulsing indicator in the admin dashboard header when unresolved `critical` alerts exist; dropdown lists them with "Mark resolved".
- Seed it from: failed edge functions, missing wallet columns, pending seller approvals count > threshold, disputes open > 24h. For now wire the UI + table; log alerts from a helper the app can call. Also surface Supabase linter-style checks (pending sellers count, open disputes) as computed alerts on the dashboard.

## 5. Security hardening (from screenshots)

### Critical
- **Hardcoded admin creds in `seed-admin`**: delete the edge function entirely. Admin is already seeded; leaving the function is a live risk. Also remove reference from `config.toml`.
- **Public can read seller profile emails**: replace "Public can read seller profiles" policy with a view `public.seller_profiles_public` that exposes only `user_id, full_name, avatar_url, country`; deny public SELECT on `profiles` for the email column path by tightening the policy to non-email fields via a view, and rewrite the public read policy to require `auth.uid() = user_id OR has_role(auth.uid(),'admin')`. Update `SellerStorePage`, `SellerMiniCard`, etc. to read the view.
- **Any seller can read all buyer profiles**: restrict "Sellers can view buyer profiles" policy to `EXISTS (SELECT 1 FROM orders o WHERE o.buyer_id = profiles.user_id AND o.seller_id = auth.uid())`.
- **User self-assigns seller role**: change `user_roles` INSERT policy to only allow role='buyer' self-insert. Seller role must go through `admin_grant_seller` or an approval flow (`ensure_user_profile` already routes seller signups through pending state — I'll enforce admin approval before role insert).
- **Order total_amount trusted from client**: add a BEFORE INSERT trigger `orders_recompute_total` that sums `order_items.price*quantity` server-side and overrides `NEW.total_amount`. Also validate each order_item price matches products.price.

### Warnings
- **Ad target_url unsafe schemes**: add CHECK/trigger `ads_validate_target_url` — must match `^https?://`. Also sanitize in `AdFormDialog` + guard the click site with `rel="noopener"` and refuse non-http links in render (`MarqueeBanner`, ads renderer).
- **Ads financial data public**: create view `public.ads_public` exposing (id, title, image_url, target_url, placement, seller_id) and change public SELECT policy on `ads` to deny anon; keep seller/admin full access. Update ad-consuming components to read the view.
- **product-images bucket INSERT policy**: require folder to start with `auth.uid()::text || '/'` and require `is_seller_capable(auth.uid())`.

## Files touched
- New migration `2026070*_hardening.sql` (all SQL above).
- Delete `supabase/functions/seed-admin/`.
- `src/pages/admin/AdminProducts.tsx`, `src/components/AdminProductEditDialog.tsx` (remove/guard).
- New `src/components/ProductFormDialog.tsx` (extracted from SellerProducts for reuse in admin).
- `src/pages/admin/AdminDashboard.tsx` (danger bell + system alerts).
- `src/components/DashboardLayout.tsx` (red indicator on Admin nav item).
- `src/pages/buyer/BuyerOrders.tsx`, `src/pages/buyer/BuyerDashboard.tsx` (rating prompts).
- `src/components/AdFormDialog.tsx`, `src/pages/MarketplacePage.tsx`, `MarqueeBanner.tsx` (safe URL + read `ads_public`).
- `src/components/product/SellerMiniCard.tsx`, `src/pages/SellerStorePage.tsx` (read `seller_profiles_public`).

Reply to confirm and I'll ship it.
