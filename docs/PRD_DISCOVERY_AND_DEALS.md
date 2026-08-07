# MarketHub — Discovery, Deals, and Catalogue Navigation PRD

**Status:** Proposed — implementation must follow this document  
**Owner:** Product + Engineering  
**Last updated:** 2026-08-07

## 1. Problem

MarketHub has the building blocks of a large marketplace—categories, promotional
collections, flash-deal fields, product feeds, and a catalogue page—but they do
not yet form one deliberate discovery system. In particular, a homepage deal
preview must lead to a real full-deals experience, and mobile layout must be
chosen by content type rather than by forcing a convenient number of cards.

## 2. Product goal

Help a shopper move naturally through the following journey:

`Homepage discovery → category/deal collection → stable catalogue results → product page → cart`

The system must expose more inventory over repeated visits while keeping explicit
searches, filters, and category browsing predictable.

## 3. Decisions

| Surface | Purpose | Ordering | Mobile presentation |
| --- | --- | --- | --- |
| Homepage feed | Discovery and merchandising preview | Rotating, diversified session seed | Horizontal swipe rail; partial next card may be visible as a swipe cue |
| Flash Deals preview | Time-sensitive preview | Active deals first; ending soon, then discount/ranking | Horizontal swipe rail; no artificial item count |
| `/marketplace?sort=flash_deals` | Complete deal shopping | Stable active-deal sort; expiry and availability are authoritative | Two-column catalogue grid with incremental loading |
| Category/search results | Intentional shopping | Stable server-side sort and cursor | Two-column catalogue grid with incremental loading |
| Seller store/collection/wishlist/cart/orders | Ownership, saved choices, transactions | Explicit saved or seller-defined order | Grid/list appropriate to that feature; never randomize |

An incomplete final row in a finite two-column catalogue is valid at the true end
of results. It must **not** be padded with duplicate or invented products. During
normal browsing, incremental loading should make such short rows uncommon.

## 4. Required experience

### Homepage

- Hero categories link to a scoped catalogue page.
- Each merchandising module contains a small preview and a working `View all`
  route.
- Flash Deals appears only when there are qualifying active deals.
- Flash-deal cards show image, price, discount, expiry countdown, and stock state
  when available.
- On phones, product previews are swipe rails rather than forced grids. The rail
  provides a visual overflow cue and does not auto-scroll while the shopper is
  interacting with it.
- A new homepage visit can use a new discovery seed. The seed is not used for
  search, category, cart, checkout, seller, wishlist, or order pages.

### Full Deals catalogue

- `sort=flash_deals` is a supported marketplace sort in both the URL and UI.
- It returns only active scheduled flash deals, with legacy compare-at-price
  promotions only if product policy explicitly permits that fallback.
- The server owns qualification and ordering; the browser must not fetch a normal
  first page and filter it locally.
- It supports the same country, price, stock, condition, and category filters as
  the main catalogue.

### Catalogue pagination

- Replace results only when query, filter, destination, or sort changes.
- Append the next page for `Load more`/infinite scrolling; de-duplicate by product
  ID as a defensive safeguard.
- Use one cursor contract that matches every supported sort. A cursor based on
  relevance/created time cannot safely paginate price, rating, or deal-expiry
  sorting.
- Use an intersection-observer loading sentinel with an accessible manual
  `Load more` fallback, loading indicator, retry state, and end-of-results state.

## 5. Technical delivery plan

### Phase 0 — contract audit (required before UI expansion)

1. Consolidate catalogue RPC usage: the page currently calls
   `search_products_combined`, while the more complete sort/filter path is in
   `search_marketplace_product_ids`.
2. Define a versioned cursor payload containing the active sort key, tie-breaker,
   and product ID.
3. Add query-plan tests for active/approved product visibility and the relevant
   indexes. Never use `ORDER BY random()` against the full catalogue.

### Phase 1 — full Deals path

1. Expose `flash_deals` in the marketplace sort parser and controls.
2. Make the homepage `View all` action use that verified route.
3. Add tests for inactive, expired, unavailable, and valid deals.

### Phase 2 — mobile component system

1. Create/reuse a dedicated `ProductRail` for homepage previews.
2. Keep `ProductGrid` for full result pages only.
3. Test at 320px, 375px, 390px, 768px, 1024px, and desktop widths; include 0,
   1, 5, 6, 24, and end-of-results product counts.

### Phase 3 — measured discovery

1. Keep the existing indexed per-visit homepage seed.
2. Add seller/category diversity constraints only after measurement shows that a
   rail is over-concentrated.
3. Measure rail impressions, swipes, `View all` clicks, product clicks,
   add-to-cart rate, deal expiry, and duplicate exposure.

## 6. Acceptance criteria

- Every homepage `View all` link reaches matching, complete results.
- No shopper-facing grid is padded with fake products or forced to a particular
  count.
- Mobile rails are swipeable and accessible by keyboard/screen reader controls
  where applicable.
- Search/category/deal pagination neither duplicates nor skips products across
  pages for any sort.
- All public queries enforce `status = 'active'` and `is_approved = true` under
  existing RLS; no service-role key is exposed to the browser.
- Unit/integration coverage includes the states listed in Phase 2 and all deal
  eligibility states.

## 7. Non-goals

- Copying another marketplace's branding, assets, or proprietary ranking logic.
- Randomizing transactional/saved surfaces.
- Hiding empty states or fabricating products to make a row look full.
- Deploying a visual change before the data route it depends on is correct.
