# Implementation Plan

## Overview

Eliminate the multi-round-trip waterfall that makes products take several seconds to appear when a visitor enters the website, by replacing the homepage's 3–4 sequential Supabase request waves with **one** snapshot RPC, giving the homepage the same instant stale-while-revalidate persistence the marketplace already has, and recording the result in the project's mandatory performance ledger (`docs/PERF_PROGRESS.md` §0 measurement protocol).

**Verified diagnosis (why products show up late today).** When `LandingPage` mounts, `useHomepageData()` (`src/hooks/useHomepage.ts:171`) executes this chain:

1. **Wave 1 (parallel, ~7 requests):** `hero_collections` RPC, `categories` select, `homepage_category_counts` RPC, and **4 separate** `homepage_product_feed` RPC calls (flash_deals / best_sellers / new_arrivals / trending).
2. **Wave 2:** those RPCs return only `product_id, sold_count, trend_score, flash_deal_end_at` — so a second wave must fetch the actual rows: `products … .in(productIds)` with embedded `product_images` (`useProductsByIds`, `useHomepage.ts:131`).
3. **Wave 3:** the feed rows carry no `seller_id`, so `seller_profiles_public … .in(sellerIds)` (`useSellerProfiles`, `useHomepage.ts:149`) can only start **after** wave 2 resolves.
4. **Wave 4:** the catch-all masonry grid (`useCatalogueFeed`) is gated on `enabled: !loading` (`LandingPage.tsx:195`), and `loading` includes waves 1–3, so the main product grid waits for everything.

On top of that:

- The rails' skeletons are gated on the composite `loading` flag (`LandingPage.tsx:483-485`, `MasonryFeedGrid` `showSkeletons = loading && uniqueItems.length === 0`), so **no product card paints until all three waves finish** — 3 sequential RTTs to Supabase plus query execution time.
- `homepage_product_feed` (`supabase/migrations/20260918050000_homepage_feed_integrity.sql`) computes two correlated subqueries (`sum(order_items) ⋈ orders` for `sold_count`, `count(product_discovery_events)` for `trend_score`) for **every candidate row (8× limit) × 4 sections on every visit**, even for sections (`new_arrivals`, `flash_deals`) that never use those values.
- Homepage data has **only the in-memory React Query cache** (`staleTime` 3–10 min, `src/App.tsx:82`), so every page reload starts from zero — while `/marketplace` already paints instantly from IndexedDB via `useCachedFetch` + `staleWhileRevalidate` (`MarketplacePage.tsx:350`, `useCatalogueFeed.ts:261`).
- The service worker's API stale-while-revalidate tier never applies to Supabase calls: `service-worker.js` skips any request carrying an `Authorization` header, and supabase-js sends one on every request — so there is no SW fast path either.

Non-causes confirmed during investigation (do not "fix" these): Vercel HTML cache (`max-age=0, must-revalidate`), prerendered product pages (SEO head only; content hydrates live), React Query `refetchOnWindowFocus: false` (only affects background refresh, not first load), and the 1-year image cache (perf ledger item 7, already fixed). Separately, a new product also stays invisible until an admin approves it (`products.is_approved` defaults to `false`); that is a workflow delay, not a fetch delay, and is out of scope here except for one correctness bug noted in Phase 2.

**Approach:** one `homepage_snapshot` RPC that returns fully-formed cards (product row + primary image + seller display info + section metrics) for all four sections in a single round trip; compose `useHomepageData` from it; persist it with the existing `useCachedFetch` IndexedDB SWR pattern so returning visitors paint instantly; add guard tests; verify with the canonical `speedCheck.mjs` protocol and update `docs/PERF_PROGRESS.md`.

## Types

All client types live in `src/lib/homepageSnapshot.ts` (new) and are re-exported where needed.

```ts
/** One fully-hydrated homepage card, returned by the homepage_snapshot RPC. */
export interface HomepageSnapshotCard {
  id: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  seller_id: string;
  stock_quantity: number;
  average_rating: number;
  review_count: number;
  ships_to: string[] | null;
  created_at: string;
  flash_deal_end_at: string | null;
  /** Embedded product_images rows, primary-ordered, exactly the columns the card reads. */
  product_images: Array<{
    image_url: string;
    is_primary: boolean;
    card_small_url?: string | null;
    image_width?: number | null;
    image_height?: number | null;
  }>;
  sold_count: number;
  trend_score: number;
  /** Denormalised from seller_profiles_public so no second query is ever needed. */
  seller_full_name: string | null;
  seller_is_verified: boolean;
}

/** RPC response: jsonb object keyed by the four section names. */
export interface HomepageSnapshot {
  flash_deals: HomepageSnapshotCard[];
  best_sellers: HomepageSnapshotCard[];
  new_arrivals: HomepageSnapshotCard[];
  trending: HomepageSnapshotCard[];
}
```

Compatibility requirements (existing types must keep their exact shapes so `LandingPage.fromFeedItem` and the test mocks keep compiling):

- `Product`, `ProductImageRow`, `FeedItem = Product & { sold_count: number; trend_score: number }`, `FeedName`, `FEEDS` stay exported from `src/hooks/useHomepage.ts` unchanged.
- `useHomepageData()` return contract stays identical: `{ heroSlides, heroLoading, categories, counts, categoryImages, feeds, sellers, loading }` where `feeds: Record<FeedName, FeedItem[]>` and `sellers: Map<string, Seller>` (`Seller = { full_name, is_verified }`). `src/test/heroLcpSwap.test.tsx:40-52` mocks exactly this shape — it must not change.


## Files

### New files

| Path | Purpose |
|---|---|
| `supabase/migrations/20261016000000_homepage_snapshot_rpc.sql` | `public.homepage_snapshot(p_limit integer, p_seed uuid) RETURNS jsonb` — all four sections, fully hydrated, one call. Grants to `anon, authenticated`. |
| `src/lib/homepageSnapshot.ts` | Types above + `fetchHomepageSnapshot()` fetcher + pure `mapSnapshotToFeeds(snapshot)` and `sellersFromSnapshot(snapshot)` helpers (unit-testable without React). |
| `src/test/homepageSnapshot.test.ts` | Guard tests: one RPC call populates every rail; no follow-up `from("products")`/`from("seller_profiles_public")` queries; seller map derived from snapshot; empty-payload tolerance. |

### Existing files to modify

| Path | Change |
|---|---|
| `src/hooks/useHomepage.ts` | Add `useHomepageSnapshot()` (uses `useCachedFetch` with `staleWhileRevalidate: true, ttlMs: 3 * 60 * 1000`, mirroring `useCatalogueFeed.ts:261`). Rewrite `useHomepageData()` (line 171) to compose `feeds` + `sellers` from the snapshot; hero/categories hooks unchanged. Remove now-unused `useHomepageFeed`, `useProductsByIds`, `useSellerProfiles` (grep confirms their only consumer is this file). |
| `src/pages/LandingPage.tsx` | No structural change expected — verify `loading` semantics after the rewrite: it must become `categories.isLoading || snapshotLoading` (both wave 1), so `enabled: !loading` for the catch-all fires one wave earlier. Only adjust if the composed flag needs narrowing; keep `visibleFeeds`/`sectionLoading` behaviour identical (rails still hide when empty, still show skeletons while loading). |
| `public/service-worker.js` | **Optional, Phase 2.** Allow the API SWR tier to cache GETs whose `Authorization` Bearer JWT payload has `role: "anon"` (decode the JWT middle segment; the anon key is public by definition and RLS makes anon responses identical for all visitors). Keep skipping authenticated (user JWT) requests. Bump `CACHE_VERSION` to `v8`. |
| `supabase/migrations/20261016010000_notify_followers_on_approval.sql` | **Phase 2 correctness fix.** `trg_notify_followers_new_product` fires on `INSERT` while `is_approved` is still `false` (`20260701213116…sql:161-178`), so followers are told about products they cannot see. Move the notification to an `AFTER UPDATE` trigger that fires when `is_approved` transitions `false → true` (and keep the `status = 'active'` check). |
| `docs/PERF_PROGRESS.md` | Append a row to §1 FIXED (fix → why it works → guard test) and paste before/after numbers into §2 using the §0 protocol (two runs, `--slow-4g --waterfall`, same-profile comparison, date + target recorded). |
## Functions

**New (SQL):**

- `public.homepage_snapshot(p_limit integer DEFAULT 24, p_seed uuid DEFAULT NULL) RETURNS jsonb`
  - `LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public`, `GRANT EXECUTE … TO anon, authenticated` — same contract as `homepage_product_feed`.
  - Body: for each section reuse the seed-rotation candidate selection from `20260918050000_homepage_feed_integrity.sql` (`p.id >= seed` UNION `p.id < seed`, `candidate_limit = 8 × limit`) with the section filter (`flash_deals` deal window, `best_sellers` needs `sold_count > 0`, `trending` needs `trend_score > 0`).
  - **Cost fix:** compute `sold_count` only for `best_sellers` and `trend_score` only for `trending` (a `CASE`-guarded expression or section-specific branches); `new_arrivals` and `flash_deals` must not pay for either correlated subquery.
  - After ranking and `LIMIT`, join `public.products` (the same column list `useProductsByIds` selects today), `LATERAL`/aggregate `public.product_images` as `json_agg` ordered by `is_primary DESC, sort_order` (mirror `search_products_combined`'s `products_with_images` pattern, `20260918040000…sql:86-89`), and join `public.seller_profiles_public` for `full_name`/`is_verified`.
  - Return `jsonb_build_object('flash_deals', …, 'best_sellers', …, 'new_arrivals', …, 'trending', …)`.

**New (TS), in `src/lib/homepageSnapshot.ts`:**

- `fetchHomepageSnapshot(): Promise<HomepageSnapshot>` — one `supabase.rpc("homepage_snapshot", { p_limit: 24 })`, parses the JSON-string-or-object response exactly the way `MarketplacePage` parses `search_products_combined` (`typeof data === "string" ? JSON.parse(data) : data`), tolerates a null/empty payload by returning empty sections.
- `mapSnapshotToFeeds(snapshot: HomepageSnapshot): Record<FeedName, FeedItem[]>` — plain mapping, keeps section arrays in `FeedName` order and applies no dedup (dedup stays in `useHomepageData`'s `seenAcrossHomepage` logic, which must be preserved verbatim).
- `sellersFromSnapshot(snapshot: HomepageSnapshot): Map<string, Seller>` — built from `seller_full_name` / `seller_is_verified` on every card.

**Modified:**

- `useHomepageData()` (`src/hooks/useHomepage.ts:171`) — replace the four `useHomepageFeed` calls + `useProductsByIds` + `useSellerProfiles` with the single `useHomepageSnapshot()`; keep the feed-priority/dedup/section-budget logic (lines 207–249) exactly as-is, operating on `mapSnapshotToFeeds` output; build the `sellers` map via `sellersFromSnapshot`; `loading = categories.isLoading || snapshot.loading` (hero is deliberately not part of `loading`, as today).
- `useHomepageFeed`, `useProductsByIds`, `useSellerProfiles` (`src/hooks/useHomepage.ts:113,131,149`) — **removed**. Migration strategy: their only consumer is `useHomepageData` (verified by codebase search; `LandingPage` imports only `useHomepageData, FEEDS, FeedItem`, `CategoriesPage`/`MarketplacePage` import `usePopulatedCategories`). TypeScript (`npm run typecheck`) is the safety net for any missed consumer.

**Removed (SQL, Phase 2):** the `AFTER INSERT` trigger `trg_notify_followers_new_product` is replaced by `AFTER UPDATE OF is_approved` on `public.products` calling the reworked `notify_followers_new_product()` which requires `NEW.is_approved = true AND NEW.status = 'active' AND (OLD.is_approved IS DISTINCT FROM TRUE)`.

## Classes

No class changes. The codebase uses hooks + plain functions for this area; the only classes involved (`MarketHubDB` in `src/lib/indexedDBCache.ts`, `ListingMediaDB` in `src/lib/listingDraftMedia.ts`) are untouched — the snapshot reuses the existing `persistentCacheGet`/`persistentCacheSet` API through `useCachedFetch`, so no new Dexie schema/version bump is required (it stores arbitrary JSON under the `cache` table).

## Dependencies

**None.** No new packages. All required libraries are already in `package.json`: `@tanstack/react-query`, `@supabase/supabase-js`, `dexie` (via `useCachedFetch`). Keep it that way — `docs/MARKETPLACE_SCALE_AUDIT.md` P1 explicitly says to keep new dependencies out of public routes.

## Testing

**New test file: `src/test/homepageSnapshot.test.ts`** (vitest, jsdom; follow the hanging-chain mock style of `src/test/landingLcp.test.tsx:33` and the fixture style of `googleFeed.test.ts`):

1. `fetchHomepageSnapshot` issues exactly one RPC and parses both string and object payloads.
2. `mapSnapshotToFeeds` + the `useHomepageData` composition render all four rails from a single snapshot; assert the mocked supabase client saw **no** `.from("products")` or `.from("seller_profiles_public")` calls and exactly one `rpc("homepage_snapshot", …)`.
3. Cross-rail dedup and section budgets (`SECTION_LIMIT = 10`, `CATCH_ALL_LIMIT = 24`, priority `flash_deals → best_sellers → trending → new_arrivals`) still hold on snapshot input — port the current behaviour into a fixture assertion so the rewrite cannot silently change the homepage's merchandising rules.
4. Empty snapshot → every rail empty, `loading` resolves false, catch-all still renders its empty state (preserves the promise that nothing is hidden).

**Existing tests that must stay green (and what to check):**

- `src/test/heroLcpSwap.test.tsx` and `src/test/landingLcp.test.tsx` — they mock `@/hooks/useHomepage` (heroLcpSwap) or hang the supabase chain (landingLcp). Export names and `useHomepageData`'s return shape must not change; if the new `useCachedFetch` path makes landingLcp's IndexedDB access noisy in jsdom, mock `@/hooks/useCachedFetch` there the same way `useCatalogueFeed` already resolves in that environment (verify before changing the mock — do not weaken the assertion).
- `src/test/masonryFeedGrid.test.tsx`, `masonryLayout.test.ts` — skeleton-count/CLS alignment (`skeletonCount === FEED_PAGE_SIZE`) must be unaffected.
- SQL-side: cannot be executed in this repo. Verification is `EXPLAIN (ANALYZE)` on the live project for `homepage_snapshot` (must show the candidate scan using `idx_products_public_discovery_id` / PK index and no aggregate computation for `new_arrivals`/`flash_deals`), plus a manual anon-session check that the RPC returns the same products the four old RPCs did.

**Validation gate sequence (mandatory, from `docs/PERF_PROGRESS.md` §0 — do not improvise):**

1. `npm run typecheck` — 0 diagnostics
2. `npm test` — full suite green
3. `npm run lint` — 0 errors
4. `npm run build` — clean
5. Speed audit, two runs minimum, same profile: `node scripts/speedCheck.mjs --url http://localhost:4173/ --label mobile --slow-4g --waterfall` (after `npm run build && npm run preview`), then the live URL after deploy; paste date + target + range into §2 of `docs/PERF_PROGRESS.md`.

## Implementation Order

1. **Write the migration** `supabase/migrations/20261016000000_homepage_snapshot_rpc.sql` — `homepage_snapshot` with section-guarded aggregates, embedded images, denormalised seller fields, grants, and the `NOTIFY pgrst, 'reload schema';` tail. (Independent of all client work; can be pushed to Supabase first and verified with a raw anon REST call.)
2. **Create `src/lib/homepageSnapshot.ts`** — types, `fetchHomepageSnapshot`, `mapSnapshotToFeeds`, `sellersFromSnapshot`. Pure functions first so step 5's test can be written against them.
3. **Rewrite `src/hooks/useHomepage.ts`** — add `useHomepageSnapshot()` backed by `useCachedFetch` SWR (3 min TTL, same as `useCatalogueFeed`), recompose `useHomepageData`, delete `useHomepageFeed` / `useProductsByIds` / `useSellerProfiles`.
4. **Verify `src/pages/LandingPage.tsx`** — confirm `loading` now resolves after wave 1, catch-all `enabled: !loading` fires earlier, rail gating/dedup/empty-state semantics unchanged; touch only if the composed flag needs narrowing.
5. **Add `src/test/homepageSnapshot.test.ts`** — guards from the Testing section.
6. **Run the full gate sequence** (typecheck → test → lint → build); fix any mock/export fallout in `heroLcpSwap`/`landingLcp` without weakening their assertions.
7. **Speed audit** with the canonical protocol (localhost, then post-deploy live); record numbers in `docs/PERF_PROGRESS.md` §2 and append the §1 FIXED row (fix → why → guard).
8. **Phase 2 (separate commits, after Phase 1 is measured):** (a) follower-notification trigger moved to approval time; (b) optional service-worker anon-GET SWR tier + `CACHE_VERSION` bump to `v8`.
9. **Deploy:** reconcile the pending migration backlog, `supabase db push`, Vercel deploy, re-run the live speed audit and update the ledger with the final numbers.

---

**Scope boundary:** this plan fixes *fetch latency* (the confirmed complaint: "when I enter the website it looks like fetching not quick to show up"). The admin-approval gate (`products.is_approved = false` until an admin approves) is a separate workflow delay — surfaced only here as a note; if products are *never* appearing, check the Pending Products queue in the admin dashboard first.



### Files intentionally NOT touched

- `src/App.tsx` query defaults — global `staleTime`/`gcTime` stay as they are; per-hook values already override them.
- `vercel.json`, `scripts/prerender*`, `index.html` — verified correct for this problem.
- `src/pages/MarketplacePage.tsx` — already has the IndexedDB SWR pattern; it is the template, not a target.

### Configuration / deployment notes

- The repo cannot prove DB changes locally (`docs/MARKETPLACE_SCALE_AUDIT.md`, "Known verification limits"). The migration must be applied with `supabase db push` — **and note the audit's P0 warning: the linked project has a migration-history backlog from `20260714004000` onward; reconcile the full pending set first**, do not push only this file.
- After applying, run `NOTIFY pgrst, 'reload schema';` (statement included at the end of the migration, as every existing RPC migration does).

