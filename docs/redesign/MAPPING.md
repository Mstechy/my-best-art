# Homepage Redesign — Sketch → Codebase Mapping

Reference sketch: `docs/redesign/markethub-index.sketch.html` (Claude concept, piece 1 of N)
Design tokens: `redesign_style_guide.html` (repo root)
Target file: `src/pages/LandingPage.tsx` → routed at `/` in `src/App.tsx:131`

---

## 1. Section-by-section mapping

| Sketch section | Sketch class | Existing React equivalent | Verdict |
| --- | --- | --- | --- |
| Header (logo, search, Saved/Cart/Account) | `.site-header`, `.search-form`, `.header-actions`, `.icon-link`, `.logo .mkt/.hub` | `MarketplaceNavbar` (551 lines) — already has logo, search, image-search, cart badge, account menu | **Keep existing component**, restyle only. Do NOT rebuild. |
| Horizontal category rail | `.category-rail` | *nothing* — `LandingPage` currently puts categories in a `CategorySidebar` (left column) + a grid section | **Net-new component.** Good idea, replaces the 260px left column. |
| Hero (pill, h1, p, CTA) | `.hero`, `.hero-inner`, `.pill`, `.btn-primary` | `HeroSlider` (254 lines, DB-driven from Admin→Collections) | **Merge.** Keep `HeroSlider` data, render single-hero fallback when empty. |
| Shop by category (grid) | `.section`, `.section-head`, `.cat-grid`, `.cat-card`, `.cat-icon` | Inline grid in `LandingPage` (lines 166–194) using `category.slug` + `counts[category.id]` | **Restyle existing.** Already DB-wired. |
| [truncated middle] deal rails / product grids | `.product-card`, `.pc-media`, `.pc-badge`, `.pc-title`, `.pc-rating`, `.pc-price` | `HorizontalScrollSection` + `FEEDS.map()` + `ProductCard` (139 lines) | **Needs re-send.** Cannot judge yet. |
| Footer | `.site-footer`, `.footer-grid`, `.footer-bottom` | `SiteFooter` (55 lines, i18n-driven) | **Keep**, already matches 4-col structure. |
| Mobile bottom nav | `.bottom-nav` | `BottomTabBar` (103 lines) | **Keep**, already matches exactly. |

---

## 2. What the sketch gets RIGHT (adopt)

1. **Category rail replaces the sidebar.** A horizontal one-tap rail is the correct pattern for this catalogue and matches the "always one tap away" comment. The current `lg:grid-cols-[260px_1fr_220px]` wastes 260px on desktop and hides the tree entirely on mobile.
2. **Category grid moved ABOVE the deal rail.** Better for a young catalogue — with few live deals, leading with deals shows empty rails. Categories never look empty.
3. **Hero has ONE message and ONE CTA.** Current hero is an auto-rotating carousel of admin collections, which is fine, but the single-focus fallback ("Electronics, sorted by trust." + buyer-protection copy) is stronger than the current generic "campaigns appear here" placeholder.
4. **Semantic landmarks + ARIA.** `role="search"`, `aria-label` on inputs/buttons, `aria-label="Categories"`, real `<header>/<main>/<nav>/<footer>`. Matches what `BottomTabBar` already does.
5. **Sticky header intent** ("never scrolls away") is correct for a marketplace.
6. **Trust framing** ("verified sellers", "buyer protection", "escrow") is a genuine differentiator — this is the right hook, not "cheap prices".

---

## 3. What the sketch gets WRONG (must NOT copy blindly)

1. **It is static HTML with fake data.** `3,210 items`, `$44.99`, `4.7 · 1,540 sold`, `unsplash.com` images, `href="#"` are all placeholders. Every value must be rewired to `useHomepageData()` / `formatPrice()`.
2. **`.html` links and `href="#"` break react-router.** All become `<Link to="…">`. `category.html?c=phones` → `/categories/${slug}`.
3. **Hardcoded category names are a maintenance trap.** "Phones", "Laptops", "Fashion" are not the DB's categories. Must map over `categories[]` (`{id, name, slug}`) and use `counts[category.id]` — which the existing code already does.
4. **Hand-written inline SVGs duplicate `lucide-react`**, which is already a dependency and used everywhere. Swap to `Search`, `Heart`, `ShoppingCart`, `User`, `Home`, `LayoutGrid`, `Star`.
5. **A "Best Seller" pill is styled as `.pill`, not as the style-guide badge.** Per `redesign_style_guide.html` badges must be `#F6C75D` bg / `#5C3A00` text / `6px` radius / `11px` / weight 500.
6. **Replacing `HeroSlider` with a static hero would delete functionality.** Admin→Collections hero management is a live feature. The static hero must become the *empty-state*, not the default.
7. **Three nav surfaces (header + rail + bottom nav) is one too many on desktop.** `.bottom-nav` must stay `md:hidden` (current `BottomTabBar` already does this correctly).
8. **`.product-card` prices ignore dual-currency.** Existing code calls `formatPrice(product.price, product.currency)`. Hardcoded `$44.99` would break for non-USD.
9. **No dark-mode classes anywhere in the sketch.** The live app is dual-theme everywhere (`dark:` variants). This is a large real gap.
10. **No `line-clamp` on `.pc-title`.** Long titles will break the card grid; existing code uses `line-clamp-2`.

---

## 4. Blockers / open questions

- **`style.css` was never sent.** Every class name above (`.hero`, `.cat-card`, `.pc-price`…) has no definition without it. The sketch is currently structure only, with no colours, spacing, type scale, or pill button.
- **~10,342 chars of the middle were truncated on paste.** The deal rails, countdown, and product grid markup is missing.
- **Token debt is unresolved** — `tailwind.config.ts` references `--success/--info/--price/--ink/--ink-foreground` and `index.css` has `.gradient-deal`, but none of those CSS variables exist. Either define them or revert them.
- **Palette clash** — `--primary` is purple (`252 62% 55%`) and `--accent` is teal (`173 58% 39%`), which fight the `#111111` + `#F6C75D` palette. shadcn components will render purple.
- **Font mismatch** — `tailwind.config.ts` body = `DM Sans`, `index.css` `--font-body` = `Inter`, homepage uses `font-sans` (uncustomised → system font).

---

# PIECE 2 — Category / listing page (`category.html`)

Sketch saved to `docs/redesign/markethub-category.sketch.html` (196 lines).
Maps to `src/pages/MarketplacePage.tsx` (715 lines, routes `/marketplace`, `/categories/:slug`, `/collections/:slug`).

New design tokens revealed (both **undefined** in this repo): `--line-strong`, `--panel`.

## Mapping

| Sketch | Existing equivalent | Verdict |
| --- | --- | --- |
| `.breadcrumb` | *nothing* — `MarketplacePage` has no breadcrumb | **Net-new.** Good addition. |
| `.listing` (2-col: sidebar + grid) | `MarketplacePage` layout | Restyle. |
| `.filters` persistent `<aside>` sidebar | `MarketplaceFilters` — a **modal `Sheet` drawer** triggered by a "Filters" button | ⚠️ **See conflict below** |
| `.filter-toggle` (mobile only, `max-width:760px`) | the `Sheet` trigger `<Button variant="outline">` | Merge |
| `.price-inputs` (Min/Max number inputs) | `Slider` dual-thumb for `minPrice`/`maxPrice` | Different control, same data |
| `Category` checkbox group w/ counts | **single** `selectedCategory` from route/`p_category` | ⚠️ **Model mismatch** |
| `Brand` checkbox group | `products.brand` **exists**, but no `p_brand` RPC param | ⚠️ Client-side facet only — see Conflict 2 |
| `.product-card` grid | `ProductCard` + `VirtualizedProductGrid` | Restyle |
| `.pc-badge` / `.pc-rating` / `.pc-price` `.now`/`.was` | `badge`, `averageRating`/`reviewCount`, `compareAtPrice` | Already supported ✅ |

## ⚠️ Conflict 1 — persistent sidebar vs. modal drawer

The sketch wants an **always-visible left `<aside class="filters">`** that only collapses behind a `.filter-toggle` button below 760px.

Your `MarketplaceFilters` is the **opposite**: a Radix `Sheet` modal that is *always* behind a button, on every breakpoint. These are different UX models and cannot both be true. Options:
- **(A) Adopt the sketch** — persistent left column on desktop, `Sheet` on mobile. Best for discoverability; costs horizontal space.
- **(B) Keep the drawer everywhere** — zero rework, but the sketch's desktop layout won't match.
- **(C) Persistent on `lg+`, drawer below `lg`** — the standard compromise, and what the sketch's `760px` breakpoint essentially describes.

## ⚠️ Conflict 2 — the filter data model does not match the sketch

Your `MarketplaceFiltersState` is exactly:
```ts
{ minPrice, maxPrice, minRating, inStockOnly, condition, categoryAttributes }
```
The sketch shows **multi-select Category** checkboxes and a **Brand** group. Neither maps:
- **Category**: you carry a *single* `selectedCategory` (from the route / `p_category`). Multi-select needs a new state field + a new RPC parameter. Non-trivial.
- **Brand — CORRECTED (I was wrong):** `brand` **is a real column** on `products` (`supabase/types.ts:788`, typed in `MarketplacePage.tsx:53`, `useProductDetail.ts:16`, `CollectionPage.tsx:38`). What's missing is a **server-side filter param** — the RPC accepts `p_category_id, p_attribute_filters, p_condition, p_country, p_cursor_*, p_in_stock_only, p_limit, p_max_price, p_min_price, p_min_rating, p_query, p_sort` and **there is no `p_brand`**. So Brand is *feasible* but not via a URL/RPC filter: it would have to be a **client-side facet** built the same way `MarketplacePage` already builds facets via `attributeValue(product, filter)` + `selectedCategoryConfig.filters` (`MarketplacePage.tsx:421-432`). Doable, but it's real work — not a freebie.
- **CORRECTED (complete paste received):** the sketch **does** include a **Rating** group (4★ & up / 3★ & up) — this maps cleanly to your existing `minRating` ✅. It also adds a **Shipping** group (Free shipping / Ships in 3 days) and a **Clear all filters** button (your `reset()` already does this ✅).
- **Still unmatched:** `Brand` (no schema field) and the **Shipping** group (you have `ships_to` for geo, but no "free shipping" or "ships in N days" flag to filter on).

**Recommendation:** keep your real filter set (Price, Rating, Condition, In-Stock + `categoryAttributes`), present it in the sketch's sidebar *style*, drop the fake `Brand` group, and don't build a Shipping filter that the schema can't answer.

## Listing toolbar (newly revealed — all already supported ✅)

| Sketch | Your code |
| --- | --- |
| `.result-count` "2,481 results in Electronics" | your product count / `totalCount` |
| `.sort-select` (Relevance, Price ↑, Price ↓, Newest, Best rated) | `sortBy` with **your 9 options**: `relevance, newest, rating, price_low, price_high, best_sellers, trending, recommended, random` — the sketch only shows 5, keep all 9 |
| `.filter-toggle` → `#filters.classList.toggle('open')` | your `Sheet` trigger (mobile equivalent) |
| `.btn-clear` "Clear all filters" | `MarketplaceFilters.reset()` ✅ |
| `.listing-grid` (8 cards) | `VirtualizedProductGrid` / `ProductCard` ✅ |

## Still missing
- **`style.css`** — STILL not received. Now blocking **two** pages (home + category).
- Piece 1 middle (~10,342 chars) — the homepage deal rails / product grid.
- **Piece 3 (the real product detail page) has NOT arrived yet.** The paste labelled "3. product html" was the complete category page, not a PDP. `src/pages/ProductDetailPage.tsx` (779 lines) is still unmapped.

---

# PIECE 4 — Cart page (`cart.html`)

Saved to `docs/redesign/markethub-cart.sketch.html` (98 lines).

| Sketch | Existing equivalent | Verdict |
| --- | --- | --- |
| Full **page** `cart.html`, `.cart-wrap` (1fr + 340px sticky summary) | `src/components/CartDrawer.tsx` (170 lines) — a slide-over `Sheet` | ⚠️ **Conflict — see below** |
| `.seller-group` (items grouped by store) | `useCart` items carry `seller_id` + `seller_name` | ✅ Feasible |
| `Qty: 1` stepper | `updateQuantity()` ✅ | ✅ |
| `Remove` link | `removeItem()` ✅ | ✅ |
| `Save for later` | *nothing* | ❌ Net-new feature |
| `.summary` Subtotal / Shipping / **Total** | `totalPrice` ✅; "Shipping: Free" is hardcoded | ✅ |
| `.coupon-input` + "Apply" (coupon `SHIP5`) | *nothing* | ❌ **No coupon system exists** (no table, no field, no hook) |
| `Proceed to Checkout` → `checkout.html` | `/checkout` route ✅ | ✅ |

## ⚠️ Conflict 3 — there is no `/cart` route

`App.tsx` routes only `/checkout` and `/order-success/:id`. The cart is **exclusively** the `CartDrawer` slide-over. Note `BottomTabBar` already tests `path.startsWith("/cart")` — a route that **doesn't exist**. So the sketch's cart *page* is net-new: it needs a new route + a new page, and then the drawer and the page must be reconciled.

## 📌 Sketch inconsistency found
The same button style is given two different radii: `.btn-primary` in `cart.html` = `border-radius:6px`; in `checkout.html` "Place Order" = `border-radius:999px` (pill). The style guide says the primary button is a **24px pill**. The sketch contradicts itself — the style guide should win.

---

# PIECE 5 — Checkout page (`checkout.html`)

Saved to `docs/redesign/markethub-checkout.sketch.html` (69 lines).
Maps to `src/pages/CheckoutPage.tsx` (322 lines), route `/checkout` ✅

| Sketch | Existing equivalent | Verdict |
| --- | --- | --- |
| `.checkout-wrap` max-width 640px single column | CheckoutPage layout | Restyle |
| `.steps` 1 Address / 2 Shipping / 3 Payment / 4 Review + `.progress` 25% bar | **NOTHING — no step/wizard/progress state exists in CheckoutPage** | ❌ **Net-new UX** |
| Saved shipping address card + "Change" | `SavedAddress[]` + `applySaved()` — genuinely good match ✅ | ✅ |
| `.pay-option` Visa •••• 4417 / Bank transfer | `CreditCard` imported; payment options need verification | ⚠️ Verify |
| `Order total` | `totalPrice` ✅ | ✅ |
| `Place Order` | real order insert w/ **idempotency key** ✅ | ✅ |
| Header = logo only (no search, no Saved/Cart/Account) | CheckoutPage renders `MarketplaceNavbar` | ⚠️ Decide |
| No `.bottom-nav` on checkout | deliberate — correct for a checkout flow | ✅ |

## ⚠️ Conflict 4 — 4-step wizard vs. single-page form

The sketch presents checkout as a **stepped flow with a progress bar**. `CheckoutPage.tsx` is a **single-page form** — searching the file for `step` / `wizard` / `progress` returns nothing (the only `step=` hits in the repo are numeric `<Input step="0.01">` attributes and upload percentages in `SellerProducts.tsx`).

Converting checkout to a wizard is **not a restyle** — it means reworking form state, validation boundaries per step, back/forward navigation, and where the order is actually created. It is the single largest piece of real engineering in the whole redesign.

---

# ✅ CONFLICT 1 RESOLVED by `style.css`

`style.css` settles the filter-sidebar question definitively:

```css
.listing{display:grid; grid-template-columns:240px 1fr; gap:28px}
.filters{border:1px solid var(--line); border-radius:var(--radius-m);
         padding:18px; align-self:start;
         position:sticky; top:calc(var(--header-h) + var(--catbar-h) + 16px)}
```
```css
@media (max-width:760px){
  .listing{grid-template-columns:1fr}
  .filters{position:static; display:none}
  .filters.open{display:block}      /* ← toggled by the .filter-toggle button */
}
```

**→ This is option (C): a persistent, sticky 240px sidebar on desktop that collapses to a toggle-able panel below 760px.** Your current `MarketplaceFilters` is a modal `Sheet` at *every* breakpoint, so it must be refactored into a persistent `<aside>` + mobile toggle. Note the sticky offset depends on `--header-h` + `--catbar-h`, i.e. it assumes **and the category rail are both sticky** — which they are in `style.css`.

---

# PIECE 6 — Account page (`account.html`)

Saved to `docs/redesign/markethub-account.sketch.html` (80 lines).

| Sketch | Existing equivalent | Verdict |
| --- | --- | --- |
| `.acct-wrap` = `200px nav + 1fr` | `DashboardLayout` (sidebar) | Restyle |
| `.acct-nav` → Orders | `/buyer/orders` → `BuyerOrders.tsx` ✅ | ✅ route exists |
| `.acct-nav` → Wishlist | `/buyer/wishlist` → `BuyerWishlist.tsx` ✅ | ✅ route exists |
| `.acct-nav` → Addresses | **no route** — addresses live inside `CheckoutPage` (`SavedAddress`) | ⚠️ Net-new |
| `.acct-nav` → Payment methods | **no route** (`/payment` is a *legal* page, `PaymentPage.tsx`) | ⚠️ Net-new |
| `.acct-nav` → Notifications | **no route** — there's `NotificationsHub`, not a settings page | ⚠️ Net-new |
| `.acct-nav` → Settings | **no route** — but `/buyer/profile` (`BuyerProfile.tsx`) is the natural home | ⚠️ Map to profile |
| `.order-card` + `.status.delivered` (`--ok-tint`/`--ok`) | `BuyerOrders.tsx` + `StatusBadge.tsx` ✅ | ✅ |
| `.status.shipped` (`--brand-tint`/`--brand-dark`) | `StatusBadge` needs orange tones | ⚠️ Restyle |
| `Buy again` / `Leave a review` | reviews exist; "buy again" is net-new | ⚠️ |
| `Track order` → `tracking.html` | `/buyer/tracking` ✅ | ✅ |
| Mobile: `.acct-nav` becomes horizontal scroller | — | ⚠️ Net-new |

**Note:** the sketch's account nav is a *buyer* account, but your app splits seller/admin into `DashboardLayout`. The sketch only designs the buyer side.

---

# PIECE 7 — Seller store page (`store.html`)

Saved to `docs/redesign/markethub-store.sketch.html` (75 lines).
Route: `/seller/:id` → `src/pages/SellerStorePage.tsx`

| Sketch | Existing equivalent | Verdict |
| --- | --- | --- |
| `.store-banner` gradient (`--ink`→`#2b2a24`) | `SellerStorePage` banner | Restyle |
| `.store-id` overlapping logo (`margin-top:-32px`) | seller avatar/name | Restyle |
| `★ 4.8 · 98.6% positive · 12.4k followers` | `SellerMiniCard`, `StoreCredibilityCard` | Partial |
| `+ Follow` button | `StoreFollowButton.tsx` ✅ **exists** | ✅ |
| `Message` button | `ChatInterface` / `BuyerChat` ✅ | ✅ |
| `.store-metrics` (Item as described / Ships on time / Avg. response) | `StoreCredibilityCard` ✅ close | ✅ |
| `.store-tabs` (All products / Categories / Reviews / About) | — | ⚠️ Net-new tabs |
| `.product-grid` = `repeat(5,1fr)` | product grid | Restyle |

**Note:** `98.6% positive` and `12.4k followers` need a followers count — check whether `store_follows` is countable. `Item as described` / `Ships on time` / `Avg. response` are three **new** seller metrics that may not be in the schema.

---

# 📁 Complete asset inventory

| File | Lines | Purpose |
| --- | --- | --- |
| `docs/redesign/style.reference.css` | 384 | **SOURCE OF TRUTH for all design tokens** |
| `docs/redesign/DESIGN-TOKENS.md` | 132 | Token reconciliation + shadcn impact + breakpoints |
| `docs/redesign/MAPPING.md` | this file | Page-by-page mapping + conflicts |
| `markethub-index.sketch.html` | 190 | Home (⛔ middle still missing) |
| `markethub-category.sketch.html` | 258 | Category/listing ✅ |
| `markethub-cart.sketch.html` | 98 | Cart ✅ |
| `markethub-checkout.sketch.html` | 69 | Checkout ✅ |
| `markethub-account.sketch.html` | 80 | Account ✅ |
| `markethub-store.sketch.html` | 75 | Seller store ✅ |

## Still outstanding
- ✅ **RESOLVED — homepage middle received.** See "PIECE 1 COMPLETE" below.

---

# PIECE 1 COMPLETE — homepage (`index.html`, 339 lines)

The previously missing ~10,342 chars arrived. Full section list:

| # | Section | Notes |
| --- | --- | --- |
| 1 | `.site-header` | logo + full search + Saved/Cart/Account |
| 2 | `.category-rail` | dark, sticky, 9 links + "All Categories" |
| 3 | `.hero` → `.hero-inner` | single, `max-width:640px`, dark card |
| 4 | Shop by category | `.cat-grid` 6 cards with item counts |
| 5 | **Flash Deals** | `.rail` of 5 cards + countdown **in the heading** |
| 6 | **Trust strip** | 4 items: Verified sellers / Fast delivery / Easy returns / 24-7 support |
| 7 | **New Arrivals** | `.rail` of 5 cards, "New" instead of rating |
| 8 | **Recommended** | `.rail` of 5 cards |
| 9 | `.site-footer` | 4-column |
| 10 | `.bottom-nav` | mobile only |

## ⚠️ CONFLICT 5 — this sketch REVERSES `PRD_HOMEPAGE_ALIEXPRESS_LAYOUT.md`

That PRD (Draft v1, 2026-08-05) specifies the target layout, and it **is what you already built**:

> 2. **Hero area — 3 columns**: Left: category tree (`CategorySidebar`) · Center: `HeroSlider` · Right: promo tiles
> 3. Flash-deal rail · 4. Trust strip · 5. Category grid · 6. Product feeds

`LandingPage.tsx:38` confirms the 3-column grid is live: `lg:grid-cols-[260px_1fr_220px]`.

The sketch instead:
- **Deletes the 3-column hero** → one `640px` dark `.hero-inner`. This removes `HeroSlider` (admin-managed campaigns), `CategorySidebar`, and the promo tiles from the homepage.
- **Deletes the promo tiles** (Hot Deals / New Arrivals / Join MarketHub).
- **Moves the category grid UP** to directly after the hero (PRD had it at position 5).
- Replaces the category tree with the horizontal `.category-rail`.

**This is a deliberate reversal, not a styling change. It needs an explicit decision** — the sketch supersedes the PRD, or the PRD stands and the sketch is adapted.

## ⚠️ Defect in the sketch — one countdown for a per-product deal

The heading reads `Flash Deals · ends in 04:12:39` — a **single** countdown for the whole rail. But your schema has a **per-product** `flash_deal_end_at` (plus `flash_deal_start_at`, `flash_deal_discount_percent`). Deals end at different times, so one rail-wide timer would be **wrong**.

Your current implementation is correct: `FlashDealCountdown` renders **per card** (`LandingPage.tsx:120-124`). Keep it — or move a single timer into the heading only if you enforce one shared deal window.

## ✅ Likely improvements worth taking
- The **`.trust-strip`** is genuinely nicer than the current 4-up trust row (styled `.ic` chip + two-line copy).
- **`.pc-rating`** showing `4.7 · 2,108 sold` is denser and better than a separate rating line.
- The **`.section-head`** pattern (title + "View all" + bottom border) is cleaner than the current mixed `SectionHeader` usage.
- The hero's **single-focus copy** beats the current "Manage hero slides in Admin → Collections" placeholder, which leaks a dev note to customers. 🫤

---

# PRODUCT DETAIL PAGE (`product.html`, 194 lines)

Saved to `docs/redesign/markethub-product.sketch.html`.
Maps to `src/pages/ProductDetailPage.tsx` (779 lines).

| Sketch | Existing equivalent | Verdict |
| --- | --- | --- |
| `.pd-wrap` 1fr/1fr grid | PDP 2-col layout | Restyle |
| `.pd-gallery-main` + `.pd-thumbs` (56px, `.active`) | `Carousel` + `ProductImage` | Restyle; variant-image swap already works |
| `.pd-title` 20px/700 | title block | ✅ |
| `.pd-meta` `★4.4 · 318 reviews · 620 sold · Sold by <a>` | rating/sold/seller link | ✅ |
| `.pd-price-row` `.now` 28px/800 `--deal` | price display | ✅ |
| `.swatch-row` / `.swatch` `.active` `.oos` (dashed + not-allowed) | **`VariantSelector.tsx` ✅ implemented, generic dimension detection** | ✅ Sketch is *behind* your impl |
| `.pd-actions` → `.btn-secondary` Add to Cart + `.btn-add` Buy Now | real add-to-cart w/ variant | ⚠️ see UX note |
| `.pd-info-line` (Get it by · buyer protection · 30-day returns) | shipping icons + accordion (**known dup issue**) | ✅ sketch helps dedupe |
| `.seller-card` + `.seller-avatar` + Visit Store/Message | `SellerMiniCard.tsx` ✅ | ✅ |
| **Specifications table** | **documented MISSING in PRD** | 🎉 **Sketch fills a real gap** |
| `.pd-tabs` Description/Specifications/Reviews | not implemented as tabs | ⚠️ Static labels only in sketch |
| "You may also like" `.rail` (2 static cards) | `RecommendedProducts.tsx` + `InfiniteScrollTrigger` ✅ | ❌ **Sketch regresses** |

## ⚠️ CONFLICT 6 — the PDP sketch regresses 4 shipped PRD requirements

`PRD_MARKETHUB_PRODUCT_PAGE_AND_SELLER_UPLOAD.md` §3 records these as **done**:

1. **"Search bar hidden on PDP ✓"** (`MarketplaceNavbar showSearch={false}`) → the sketch **shows a full search bar**.
2. **"Breadcrumb removed from above gallery ✓ — no text precedes the hero image"** → the sketch **adds a breadcrumb directly above the gallery**. Direct contradiction.
3. **"sticky mobile CTA (store icon + Add to Cart + Buy Now)"** → the sketch has **no sticky CTA**.
4. **"Infinite 'You May Also Like' ✓ via `InfiniteScrollTrigger`"** → the sketch shows a **static 2-card rail**.

**Do not apply those four.** Your implementation is ahead of the sketch there.

## ⚠️ UX concern — "Add to Cart" is the *secondary* button

In the sketch, `Add to Cart` is outline (`1.5px solid var(--ink)`) and `Buy Now` is the filled orange CTA. On a marketplace that typically **suppresses add-to-cart rate and reduces basket size**, because the eye goes to Buy Now (single-item checkout). Most marketplaces make Add to Cart the primary action. Worth a deliberate call — the sketch is not obviously right here.

## Also missing from the sketch
- **No quantity selector** in the buy area.
- **No wishlist/save button** in the buy area (header only).
- No review content, photo gallery, or Q&A — all of which you already have.

---

# ✅ ALL PIECES RECEIVED — nothing outstanding

| File | Lines | Status |
| --- | --- | --- |
| `style.reference.css` | 384 | ✅ **source of truth** for all tokens |
| `markethub-index.sketch.html` | 339 | ✅ complete |
| `markethub-category.sketch.html` | 258 | ✅ |
| `markethub-product.sketch.html` | 194 | ✅ |
| `markethub-cart.sketch.html` | 98 | ✅ |
| `markethub-account.sketch.html` | 80 | ✅ |
| `markethub-store.sketch.html` | 75 | ✅ |
| `markethub-checkout.sketch.html` | 69 | ✅ |

Supporting docs: `DESIGN-TOKENS.md` (token reconciliation), `TAILWIND_ALIGNMENT.md` + `TAILWIND-ALIGNMENT-REVIEW.md` (config plan + corrections).

## The 6 conflicts, gathered

| # | Sketch wants | Repo has | Decision needed |
| --- | --- | --- | --- |
| 1 | Persistent filter sidebar (desktop) + toggle (mobile) | Modal `Sheet` at all breakpoints | ✅ **resolved by `style.css`** — build the sidebar |
| 2 | Multi-select Category + Brand + Shipping filters | single `selectedCategory`; no `p_brand`; no shipping flags | Scope vs schema |
| 3 | A **cart page** at `/cart` | No such route — cart is `CartDrawer` | Build page or keep drawer |
| 4 | **4-step checkout wizard** w/ progress bar | `CheckoutPage` is single-page; zero step state | Largest job |
| 5 | Homepage: single hero, category-rail, no promo tiles | 3-column hero per AliExpress PRD | Sketch vs PRD |
| 6 | PDP: search bar, breadcrumb above gallery, no sticky CTA, static recs | PRD explicitly removed/added the opposite | **Keep yours** |




