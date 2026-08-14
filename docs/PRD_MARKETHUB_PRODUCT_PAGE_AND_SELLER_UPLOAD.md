# MarketHub — Product Page & Seller Upload: PRD

**Status:** Draft v1
**Owner:** Engineering
**Last updated:** 2026-08-04
**Scope:** Buyer-facing product detail page + seller product upload form, treated as one connected feature.

---

## 1. Goal

Make the product listing experience match Amazon/AliExpress standards so the marketplace is ready for real buyers and sellers at scale. The data a seller enters must flow correctly to what a buyer sees — no orphaned fields, no duplicated trust info, no missing specs.

---

## 2. Guiding principles (non-negotiable)

1. **One complete feature at a time.** Each phase ships fully (data model + form + buyer page + tests + build) before the next starts.
2. **No guessing.** Every change is grounded in the existing codebase survey (already done) and verified with a build.
3. **Real data only.** Stock/sold/view counts are always pulled from real sources — never hardcoded or fabricated.
4. **Security first.** Sanitize all user content, enforce ownership server-side, validate files by magic bytes not extension.
5. **No breaking changes.** Existing columns, RLS, and flows stay intact; new work is additive.

---

## 3. Current state (from codebase survey — verified, not assumed)

### Products table — existing columns
`id, seller_id, title, description, price, compare_at_price, currency, category_id, status, stock_quantity, sku, created_at, updated_at, is_approved, brand, weight, dimensions, material, color, condition, warranty, warranty_period, shipping_info, key_features, tags, ships_to, show_sold_count, flash_deal_discount_percent, flash_deal_start_at, flash_deal_end_at, variants (JSONB)`

### product_images table
`id, product_id, image_url, is_primary, sort_order, visual_hash, visual_hash_buckets` — **no `alt` column**

### product_variants table
`id, product_id, option_values, sku, price, stock_quantity, sort_order, is_active`

### Seller form (`SellerProducts.tsx`)
- Saves specs into `variants.categoryAttributes` (JSONB) — **but buyer page never renders them**
- Uploads images to `product_images` with visual hash, no alt text
- No description-photo uploader, no slug, no meta description, no low-stock threshold
- Client validation exists for price/stock/description length but is partial

### Buyer page (`ProductDetailPage.tsx`)
- Render order: header (search icon only — no persistent search bar, no breadcrumb above gallery) → gallery → title/price → rating/sold/low-stock → variant selector → buy box → seller card → shipping icons → description → key features → reviews → Q&A → recommended → recently viewed → sticky mobile CTA (store icon + Add to Cart + Buy Now)
- **Search bar hidden on PDP** ✓ — `MarketplaceNavbar showSearch={false}`; a search icon in the header navigates to `/marketplace`
- **Breadcrumb removed from above gallery** ✓ — no text precedes the hero image
- **Variant selector: IMPLEMENTED** ✓ — generic `VariantSelector` component detects all attribute dimensions from `product_variants.option_values` (size, color, storage, etc.), renders labeled chips with selected state + checkmark, updates price/stock, and wires `product_variant_id` into cart/checkout
- **Variant image swap: IMPLEMENTED** ✓ — `product_variants.image_url` is selected by the PDP hook; when a variant with its own image is selected, that image is shown first in the gallery (AliExpress behavior). Seller form Variants tab now has an "Image URL (optional)" field per variant row, saved to `image_url` on insert and loaded back on edit.
- **Store icon in sticky mobile CTA** ✓ — leftmost circular button navigates to the seller's store page (`/seller/${product.seller_id}`), with the price shown left and full-width Add to Cart + Buy Now buttons
- **Specifications table: MISSING** (specs saved by seller never shown) — variant attribute keys AND system keys (`categoryGroup`, `productTypeKey`) are excluded from specs to avoid duplication and raw internal strings
- **Review photo gallery** ✓ — horizontal "Customer Photos" scroll row above review cards, tap to open lightbox
- **Review filter chips** ✓ — zero-count filters (e.g. `3★ (0)`) are hidden
- **Shipping shown twice** (inline icons + accordion) — needs dedupe
- **Description photos: MISSING**
- **JSON-LD structured data: MISSING**

### Libraries available
- `zod` ✓ (validation)
- **No DOMPurify / sanitize-html** — sanitization must be done server-side in SQL/edge function
- `@supabase/supabase-js`, `@tanstack/react-query`, `lucide-react`, `sonner`, `react-router-dom`

---

## 4. Phased implementation plan

Each phase is independently shippable and verified. Do NOT start a phase until the previous one is complete and built.

### PHASE 1 — Data model + server-side validation (SQL migration)
**Goal:** Add the missing columns and enforce rules at the database level so no client can bypass them.

**New columns on `products`:**
| Column | Type | Notes |
|---|---|---|
| `seo_slug` | text | unique, url-friendly, auto-generated from title, editable |
| `meta_description` | text | optional, max 160 chars |
| `low_stock_threshold` | int | default 5 |
| `description_images` | jsonb | `[{url, alt, order}]`, max 20 |
| `edit_history` | jsonb | `[{field, oldValue, newValue, editedAt}]` |

**New column on `product_images`:**
| Column | Type | Notes |
|---|---|---|
| `alt` | text | optional, for SEO/accessibility |

**Server-side validation (CHECK constraints + trigger):**
- `title`: required, 3–140 chars
- `description`: min 30 chars when present, max 5000, strip `<script>`/`<style>`/event-handler attributes (stored-XSS prevention)
- `price`: > 0, max 2 decimals
- `compare_at_price`: if present, must be > price
- `stock_quantity`: integer >= 0
- `seo_slug`: unique, non-empty when status = active
- Product cannot be `active` unless title, price, and ≥1 image pass validation

**RLS ownership enforcement:**
- Verify only the owning seller (or admin) can UPDATE/DELETE a product — server-side policy, not just hiding the button.

**Acceptance:**
- [ ] Migration applies cleanly
- [ ] Direct SQL insert of invalid data is rejected
- [ ] Non-owner UPDATE/DELETE is rejected by RLS

### PHASE 2 — Seller form: description photos + alt text + slug + counters
**Goal:** Seller can enter everything the buyer will see, with clear inline validation.

**Images & Tags tab:**
- Add "Description Photos" uploader (drag-to-reorder, no primary concept, max 20)
- Add optional Alt text input under every image (both blocks)
- Client-side file validation: real MIME via magic bytes, max 8MB, jpg/png/webp, inline errors

**Basic Info tab:**
- Character counter under Description (`x/5000`), block submit under 30 chars
- URL slug field, auto-filled from title, editable, live URL preview
- Compare-at price inline error if ≤ price

**Before submit:**
- Run full validation across ALL tabs; if Images & Tags has an error, jump to that tab and highlight it

**Acceptance:**
- [ ] Seller can upload/reorder description photos separately
- [ ] Alt text saved per image
- [ ] Slug auto-generates and is editable
- [ ] Invalid compare-at price blocked client-side
- [ ] Full-tab validation on submit

### PHASE 3 — Buyer page: specs table + description photo feed + shipping dedupe
**Goal:** Buyer sees everything the seller entered, in the correct standard order.

**Render order (final):**
1. Gallery
2. Title, price, rating snippet, stock/sold count
3. Add to Cart (+ sticky on scroll)
4. Trust icons (shipping, buyer protection) — **once, not twice**
5. Seller card
6. **Specifications table** (from `variants.categoryAttributes`) ← NEW
7. Description (text + **description photo feed**, lazy-loaded, alt applied) ← NEW
8. Reviews + Q&A
9. You May Also Like / Recently Viewed

**Changes:**
- Add Specifications table rendering (map `categoryAttributes` to label/value rows)
- Remove the duplicate "Shipping & Returns" accordion OR make it only appear when it has more detail than the icons
- Render `description_images` full-width, stacked, in `order`, `loading="lazy"`, with `alt`
- Low-stock: show "Only X left" when `stock_quantity <= low_stock_threshold && > 0`

**Acceptance:**
- [ ] Specs table renders from seller-entered data
- [ ] Shipping info appears exactly once
- [ ] Description photos render lazy-loaded with alt text
- [ ] Low-stock threshold drives "Only X left"

### PHASE 4 — SEO structured data + accessibility + performance
**Goal:** Make listings discoverable and accessible.

- Emit `schema.org/Product` JSON-LD (name, image, price, availability, aggregateRating) in page head
- Ensure all interactive controls keyboard-navigable with visible focus states
- Lazy-load below-the-fold images
- Paginate reviews (don't render all at once)

**Acceptance:**
- [ ] Product page emits valid JSON-LD
- [ ] Keyboard navigation works on all controls
- [ ] Reviews paginated

### PHASE 5 — Security hardening (sanitization + rate limiting)
**Goal:** Protect against stored XSS and spam.

- Sanitize description/reviews/Q&A server-side (strip script/style/event handlers) before storing
- Rate-limit review submissions and Q&A posts per user
- Strip EXIF/location metadata on image upload (buyer privacy)

**Acceptance:**
- [ ] Stored XSS payloads neutralized
- [ ] Review/Q&A rate limits enforced
- [ ] EXIF stripped on upload

---

## 5. Definition of Done (every phase)

- [ ] Code compiles: `npm run build` succeeds
- [ ] No new lint errors in touched files
- [ ] No existing behavior broken (existing columns/RLS/flows intact)
- [ ] Acceptance criteria for the phase all pass
- [ ] Phase is committed/complete before starting the next

---

## 6. Out of scope (for now)

- Bulk CSV upload for sellers
- Guest checkout / saved payment tokens
- Dispute/returns/payout ledger
- CDN/Redis caching layer
- Bundle-size optimization (charts/supabase/sentry chunks)

These are tracked separately and will be their own PRDs.