# Marketplace Scale Audit

Last updated: 2026-09-19

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
- Added reviewed bulk base price/stock edits and a listing-health filter. Variant SKU price and stock are deliberately excluded from bulk base updates.
- Hid empty homepage merchandising rails; a rail appears only after it has real, de-duplicated products.
- Added editorial collection cards and live product counts to the category entry page.
- Strengthened phone listings with structured buyer-decision fields (storage, colour, battery health, SIM, carrier, activation-lock, cosmetic condition, and in-box contents) while keeping IMEI and serial numbers out of public listing data.
- Corrected manual collection edits so removing every selected product actually clears the collection; automatic collections now require a rule and can be scheduled.
- Added `20260918060000_collection_resolver_integrity.sql`, which makes Best Seller and Trending collection rules use maintained metrics rather than unsupported product columns.
- Replaced the seller revenue chart dependency with a lightweight native SVG chart.

## P0 — must verify in a deployed environment

1. Apply every pending Supabase migration, including the exact-title search migration. The linked project currently has a migration-history backlog from `20260714004000` onward, so applying only the two latest migrations would be unsafe; reconcile and review the full pending set before `supabase db push`.
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

- Route and feature-level code splitting are in place. Keep new dependencies out of the public route unless they are lazy-loaded and justified by field performance data.
- Add real-user performance monitoring for LCP, INP, image failures, search latency, and checkout failures.
- Add integration tests for product variants, search ranking, and order inventory locking. Current unit tests cover display/contracts only.

## Known verification limits

This repository can build and run unit tests locally, but it cannot prove deployed database migrations, RLS, storage policies, payment-provider behavior, or live realtime events without the target Supabase project and test accounts.
