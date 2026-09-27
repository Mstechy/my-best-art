# Tradibu

A multi-vendor marketplace for buying and selling with verified sellers, secure payments and buyer protection.

React + Vite + TypeScript on the front, Supabase (Postgres, RLS, Edge Functions) on the back, deployed on Vercel.

**Production:** https://www.tradibu.com

---

## Requirements

- Node.js 22+ (CI pins this in `.github/workflows/ci.yml`)
- npm

---

## Getting started

```bash
git clone https://github.com/Mstechy/my-best-art.git
cd marketplace-masters-main
npm ci
cp .env.example .env      # then fill in the values below
npm run dev
```

The dev server runs on http://localhost:8080.

### Environment variables

| Name | Needed for | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | App boot | Hard failure at startup if missing |
| `VITE_SUPABASE_ANON` | App boot | Also accepts `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `VITE_PAYSTACK_PUBLIC_KEY` | Checkout | Publishable key only |
| `VITE_SENTRY_DSN` | Error reporting | Optional — Sentry stays dormant without it |

All `VITE_*` values are inlined into the client bundle at build time. **They are public by definition.** Never put a secret here.

**Server-only secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `PAYSTACK_SECRET_KEY`) belong in Supabase Edge Function secrets, never in `.env` and never in client code:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... PAYSTACK_SECRET_KEY=...
```

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR on port 8080 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript — errors only, no emit |
| `npm run lint` | ESLint across the repo |
| `npm test` | Vitest (jsdom), one pass |

`.github/workflows/ci.yml` runs all four checks on every push and PR. Locally, run them before pushing:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

---

## Architecture

```
src/
  pages/            53 routes, all lazy-loaded (buyer, seller, admin, public)
  components/       123 components; ui/ is the shadcn layer
  hooks/            useCart, useAuth, useCurrency, useSupabaseQuery (React Query)
  lib/              categoryConfig, search, image/product helpers, i18n
  integrations/     Supabase client + generated Database types

supabase/
  migrations/       74 SQL migrations — schema, RLS, triggers, RPCs
  functions/        4 Edge Functions (Deno)

api/                Vercel serverless (sitemap)
```

### Backend

Postgres with **Row Level Security on 48 tables (176 policies)**. Read access is enforced in the database, not the client.

Key server-side invariants — all enforced in SQL so no client can bypass them:

- **`place_marketplace_order`** — the only order-creation path. `FOR UPDATE` row locks, idempotency key, stock/ownership/price/destination validation, quantity capped at 1–100.
- **Order state machine** — rejects invalid transitions; carrier and tracking number are required before `shipped`.
- **Stock** — decremented once at checkout with a reservation ledger; 30-minute window on unpaid orders, restocked on expiry or cancellation.
- **Reviews** — `UNIQUE(product_id, buyer_id)` and a verified-purchase requirement, so reviews can't be fabricated.
- **Payments** — Paystack webhook verifies an HMAC-SHA512 signature *and* re-verifies the transaction against Paystack's API before marking an order paid.
- **Search** — GIN-indexed weighted `tsvector` (title/brand A, tags B, description C) with `websearch_to_tsquery`, trigram suggestions and an exact-title boost.

### Data access

React Query handles caching (`staleTime` 5 min, `gcTime` 10 min).

> **Known issue:** ~137 queries are written inline inside components rather than behind a repository layer. See `docs/MARKETPLACE_SCALE_AUDIT.md` — this is a known restructuring target.

---

## Edge Functions

| Function | Purpose |
|---|---|
| `paystack` | Payment init + webhook (signature-verified) |
| `send-offer` / `respond-offer` | Buyer to seller price negotiation |
| `visual-product-search` | Image-based discovery |

`config.toml` sets `verify_jwt = false` only where a browser request or database trigger must reach the function; those authenticate themselves.

---

## Documentation

| File | Contents |
|---|---|
| `docs/MARKETPLACE_SCALE_AUDIT.md` | Scale review + prioritised P0/P1 backlog |
| `docs/E2E_CHECKLIST.md` | Manual release checklist |
| `docs/PRD_*.md` | Product requirements |
| `docs/redesign/` | Design tokens and UI mapping |
