# Tradibu Shiro Audit and Product Plan

Date: 2026-10-19
Review mode: full rubric review plus targeted fix pass

## What Tradibu is

Tradibu is a multi-vendor B2C marketplace: independent sellers publish products, buyers discover and compare listings, and Tradibu provides marketplace navigation, secure payment, order coordination, buyer protection, seller tools, and administration.

The current product is best understood as an electronics-led launch that is structurally prepared for broader departments. The strongest initial wedge is phones, accessories, computers, audio, and related electronics. Fashion, home, beauty, sports, and other departments should expand only when each has real, approved inventory and category-specific filters.

The system has four product surfaces:

1. Public discovery: homepage, marketplace, categories, collections, search, image search, and seller storefronts.
2. Purchase flow: product detail, variants, cart, checkout, Paystack payment, order success, and tracking.
3. Seller workspace: dashboard, product listing, inventory, orders, storefront, reviews, analytics, ads, wallet, and chat.
4. Admin control plane: product and seller moderation, orders, disputes, collections, ads, analytics, SEO pages, and merchant feeds.

## Evidence and limits

This review is based on the React/Vite codebase, existing tests, route structure, product data contracts, migration history, and the supplied reference screens. It does not prove live Supabase migration state, RLS behavior, Paystack webhooks, real seller accounts, mobile rendering on physical devices, or production hover/keyboard behavior. Those require a deployed-environment release pass.

## Shiro score after the targeted fixes

Overall: 84/100. Strong foundation; resolve the named operational and content gaps before paid traffic or broad category expansion.

| Category | Score | Evidence |
| --- | ---: | --- |
| Messaging and value proposition | 16/20 | The SEO copy clearly describes a trusted-seller marketplace. The launch hero now avoids claiming millions of products, but live database hero copy still needs to be kept honest in admin-managed content. |
| Information hierarchy | 13/15 | Homepage hero, category tree, deals, feeds, product detail, and seller dashboard have a clear reading path. The public site still carries a lot of marketplace surfaces before the buyer has seen one strong product story. |
| Interaction and usability | 13/15 | Search, filters, variants, cart, checkout, and seller workflows are present. Variant purchase controls match selection state; seller drafts recover; the listing review now shows variant totals and keeps the save/submit action reachable on mobile. |
| Visual consistency | 13/15 | Tradibu has a coherent ink, cream, gold, and restrained red system. High-traffic copy and dashboard order rows are now safer on narrow screens; older secondary surfaces still deserve a final content sweep. |
| Brand originality | 11/15 | The monochrome/gold marketplace language is more distinctive than a generic purple AI dashboard. The brand still needs a stronger repeated seller-trust and Nigeria-first visual signature. |
| Accessibility and readability | 8/10 | Skip link, labelled controls, focus states, responsive navigation, and semantic headings are present. The remaining encoded strings and some custom control patterns need a dedicated accessibility sweep. |
| Fit and finish / QA | 10/10 | Lazy routes, image dimensions, responsive tests, draft recovery, shipping contracts, search contracts, and checkout tests are unusually strong. Production-only data, migration, RLS, payment, and realtime behavior remain unverified. |

## Findings

### P1 - Variant purchase controls previously promised an action too early.

On product detail pages with variants, Add to Cart and Buy Now could appear enabled before a complete in-stock combination was selected. The handler rejected the action later, but the control state contradicted the visible promise. The purchase state now uses one `canPurchase` rule for desktop and mobile controls, and the button says `Select options` until a valid SKU exists.

### P1 - Category navigation did not reliably show the active category.

The marketplace stores the selected category as an id, while the sidebar compared it only to a slug. A buyer could navigate into a department and still see no active category. The sidebar now resolves either id or slug and opens the matching group when a category route is selected.

### P1 - Launch messaging was larger than the available inventory.

The build-time hero copy said “millions of products from trusted sellers around the world.” That is not appropriate for a small launch catalogue and creates a trust problem. The fallback/static hero now says the marketplace is starting with independent sellers and electronics, while live admin-managed hero content must be kept aligned with actual inventory.

### P1 - Encoding defects were visible in several shopping surfaces.

The targeted pass normalized the highest-traffic product, cart, checkout, marketplace, buyer, and seller strings to readable separators, labels, and ASCII-safe controls. This is now materially better, but a repository-wide content sweep should still be kept on the release checklist for older admin and secondary surfaces.

### P1 - Shipping information must become destination-specific.

The policy resolver now surfaces available shipping destinations, dispatch time, delivery range, fee, and free-shipping threshold when the seller or product provides them. The checkout destination still needs to be selected before Tradibu can show final eligibility and total cost, so that deployed flow remains a release requirement.

### P1 - Marketplace category expansion must remain inventory-gated.

The code hides empty homepage rails and marketplace navigation categories. The full directory may show future departments, but empty ones now say `Coming soon` instead of presenting `0 products` as an active destination. Keep this rule as the catalogue grows.

### P0 - Production safety still needs deployed verification.

The existing repository audit correctly calls out migration-history reconciliation, RLS checks for anonymous/buyer/seller/admin sessions, end-to-end checkout, payment-provider verification, and inventory-locking behavior. Local build and unit tests cannot prove these guarantees.

## Second targeted fix pass

- Normalized customer-facing separators, quantity labels, sort labels, order summaries, and seller listing guidance in the highest-traffic routes.
- Added product-level shipping data support for destinations, processing time, delivery time, shipping fee, and free-shipping threshold without inventing missing values.
- Added coverage for the expanded shipping summary and retained the existing variant, responsive, and shell contracts.
- Made empty department status explicit in the full category directory while preserving inventory-gated homepage and marketplace navigation.

## Responsive and workflow review

### Product detail

The product page is strong but not yet “excellent” until live checkout, real delivery data, and multiple seller/product records are verified. Desktop uses a clear gallery-plus-purchase layout; mobile keeps store, chat, cart, and purchase actions reachable in a fixed safe-area-aware bar. Remaining gaps are destination-selected final shipping totals, real seller review depth, and a live-device visual pass.

### Seller listing workflow

The five-step flow is appropriate for Tradibu: Basics, Options, Details, Photos, and Review. It is category-driven, supports SKU-level price/stock, links variant images, validates media, recovers drafts, and explains missing requirements. The final review now uses the lowest SKU price and total SKU stock instead of showing a misleading zero, and sellers can explicitly save the draft and exit from the mobile-friendly footer.

Compared with current marketplace conventions, the next meaningful upgrade is server-side drafts that can resume across devices. Local draft recovery is useful, but it is not a replacement for a seller who changes phones or browsers.

### Seller and admin dashboards

The seller dashboard is organized around action: revenue, live products, stock, approval, orders, store health, order pipeline, revenue, and quick actions. The admin dashboard now exposes the pending-seller queue as an operational KPI in addition to pending products, alerts, disputes, orders, and revenue. The next missing operational layer is a unified moderation queue with reason, age, owner, and next action rather than only aggregate counts.

## Product structure to protect

```text
Tradibu
├── Discover
│   ├── Home
│   ├── Marketplace / Search
│   ├── Categories and collections
│   └── Seller storefronts
├── Buy
│   ├── Product detail and variants
│   ├── Cart
│   ├── Checkout and Paystack
│   └── Orders, delivery, reviews, disputes
├── Sell
│   ├── Seller dashboard
│   ├── Products, variants, media, inventory
│   ├── Orders and fulfillment
│   ├── Store, reviews, analytics, ads
│   └── Wallet, payouts, chat
└── Operate
    ├── Admin moderation
    ├── Categories, collections, campaigns
    ├── Orders, disputes, sellers
    └── SEO, analytics, merchant feeds
```

## Recommended execution plan

### Phase 0 - Release safety

- Reconcile and apply the complete Supabase migration history in a staging project.
- Test anonymous, buyer, seller, and admin RLS boundaries.
- Run the full buyer journey with real Nigerian delivery data and a Paystack test transaction.
- Verify variant price, stock, currency, shipping, payment, order confirmation, and retry/idempotency behavior.
- Confirm seller fulfillment and admin moderation end to end.

### Phase 1 - Trust and purchase clarity

- Complete the UTF-8/encoding cleanup across public, buyer, seller, and admin surfaces.
- Make shipping destination, estimate, fee, tracking, returns, and warranty explicit on product pages.
- Keep selected variant, SKU, price, stock, images, and cart payload synchronized.
- Show “New seller” or “No reviews yet” without implying established reputation.

### Phase 2 - Discovery quality

- Keep one controlled category tree with primary category ownership and optional attributes.
- Add category-specific filters only when the category has enough inventory to justify them.
- Add saved searches and no-result analytics.
- Build listing-health queues for missing images, missing specifications, no stock, rejected listings, and low conversion.

### Phase 3 - Seller supply quality

- Finish the mobile-first seller workflows: add product, edit exact SKU inventory, process order, upload tracking, understand payout.
- Add moderation reasons and a clear resubmission path.
- Add store profile completeness and seller performance signals.
- Make reviews verified post-purchase and useful to both buyers and sellers.

### Phase 4 - Growth after operational proof

- Expand departments based on approved inventory and conversion data.
- Add seller-funded campaigns, recommendations, and retention journeys.
- Measure search-to-product click, product-to-cart, cart-to-purchase, successful order, seller activation, fulfillment, cancellation, refund, and repeat purchase rates.

## Ship call

Do not rewrite the whole interface. Tradibu already has a real marketplace architecture and stronger operational foundations than a typical generated storefront. Ship the targeted fixes, complete the deployed safety pass, make seller delivery terms concrete, and clean the remaining encoding defects before spending heavily on acquisition or opening every seeded department.

## First remaining-gap implementation: moderation queue

The seller moderation gap is now addressed at the data and interface layers.

- Product moderation now stores a reason, next action, responsible owner, and moderation timestamp in Supabase.
- Admin product review can request changes with an actionable reason instead of silently hiding a listing.
- Seller Dashboard now shows a review queue with status, waiting age, owner, reason, and next action.
- Seller product cards repeat the requested change so the seller does not need to hunt through another screen.
- Editing a listing clears the old request metadata and starts a fresh review state.

This is intentionally product-focused first. The unified admin operations queue for seller applications, disputes, refunds, and payout risks remains the next dashboard gap rather than being represented by invented placeholder data.

## Second remaining-gap implementation: server-side listing drafts

Seller listing drafts now have a cloud backup path in addition to the existing localStorage and IndexedDB recovery.

- Text, options, specifications, settings, and the current workflow tab are saved to a seller-owned Supabase draft row.
- A seller can recover that work from another browser or device after signing in.
- Local IndexedDB media recovery remains in place for the original device.
- Cloud recovery clearly tells the seller that photos must be selected again on a device where they are not available.
- Discarding or successfully submitting a listing clears both local and cloud draft state.

This keeps the first cross-device version safe and small. Uploading unfinished media to cloud storage is a separate step because it needs storage cleanup, file ownership rules, size limits, and abandoned-upload retention policy.

## Third remaining-gap implementation: admin operations queue

The admin dashboard now has one oldest-first operations queue built from live records rather than aggregate counters.

- Pending products show why they need review, who owns the next step, how long they have waited, and the action to take.
- Pending seller applications link directly to seller review.
- Open and investigating disputes appear in the same queue.
- Empty state confirms when there is no unresolved seller, product, or dispute work.
- Items remain responsive on narrow screens and link to the existing specialist pages for the actual action.

Wallet balances are not presented as payout-risk tasks yet because the current schema has wallet balances and transactions but no explicit withdrawal-request state. That should be added as a separate finance workflow rather than inferred from balance totals.

## Fourth remaining-gap implementation: authoritative shipping quotes

Checkout now requests a server-side quote for each seller after the buyer selects a delivery country. The quote uses trusted product/variant prices, product and store delivery regions, seller/platform shipping fees, free-shipping thresholds, and processing/delivery windows. Checkout shows the quoted shipping amount and estimated delivery range, and keeps payment disabled when the destination or shipping fee cannot be verified.

The order writer recalculates the same quote inside the transaction and stores `shipping_amount` plus the delivery date range on the order. Paystack already initializes from `orders.total_amount`, so payment now uses the server-authoritative product subtotal plus shipping rather than the former product-only total.

Seller Store now exposes the minimum operational inputs needed for a trustworthy quote: fee, currency, free-shipping threshold, ISO destination codes, origin, and delivery window. Apply `20261019002000_authoritative_shipping_quotes.sql` before testing checkout in Supabase. A seller or platform policy with no shipping fee intentionally blocks payment with an actionable message instead of silently charging an incomplete amount.
