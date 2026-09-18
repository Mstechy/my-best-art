# Marketplace Scale Audit

Last updated: 2026-09-18

## Verified foundations

- Catalogue browsing is server-side, cursor-paginated, category-aware, and bounded to 48 records per request.
- Product search uses a GIN-indexed full-text document and trigrams for suggestions.
- Product cards, category filters, country availability, sort modes, image search, and discovery rails already exist.
- Public, seller, buyer, and admin routes are lazy-loaded.
- Checkout uses a locking, idempotent database RPC that validates seller ownership, stock, variants, and shipping destination.
- Product options support up to three dimensions, gallery-image assignment, option-specific stock/price, and option-image switching on the product page.

## Completed in this audit pass

- Added exact-title priority and variant/category-attribute indexing in `20260918040000_catalogue_exact_title_and_variant_search.sql`.
- Added unavailable-combination states to the buyer option selector.
- Added seller bulk draft/archive actions and inventory-health alerts.
- Deferred the seller revenue chart behind a feature-level lazy import.

## P0 — must verify in a deployed environment

1. Apply every pending Supabase migration, including the exact-title search migration.
2. Run every item in `docs/E2E_CHECKLIST.md` using real buyer, seller, and admin accounts.
3. Test catalogue search with:
   - an exact full title;
   - a partial title;
   - a typo;
   - a brand + product query;
   - a newly added third option such as `Storage: 256GB`.
4. Verify row-level security with anonymous, buyer, seller, and admin sessions.

## P1 — next product improvements

- Bulk price and stock adjustment with an explicit preview and undo window.
- Saved searches and no-result search analytics.
- Seller listing-health queue: missing images/specifications, no stock, rejected, and low-conversion products.
- Category landing pages driven by editorial collections and server-side feed queries rather than the currently loaded catalogue page.
- Option-name templates per product type (for example Size/Colour/Storage for phones).

## P1 — performance and reliability

- The chart library remains a 400 KB deferred chunk. Replace it with a smaller chart implementation or load it only after the dashboard becomes idle if field data confirms it hurts seller-dashboard interaction.
- Add real-user performance monitoring for LCP, INP, image failures, search latency, and checkout failures.
- Add integration tests for product variants, search ranking, and order inventory locking. Current unit tests cover display/contracts only.

## Known verification limits

This repository can build and run unit tests locally, but it cannot prove deployed database migrations, RLS, storage policies, payment-provider behavior, or live realtime events without the target Supabase project and test accounts.
