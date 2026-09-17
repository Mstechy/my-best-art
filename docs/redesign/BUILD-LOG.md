# Build Log — MarketHub redesign implementation

Execution record. Every phase is build-verified before the next starts
(same discipline as `PRD_HOMEPAGE_ALIEXPRESS_LAYOUT.md` §5 Definition of Done).

---

## PHASE 1 — Token layer ✅ DONE & VERIFIED

**Files:** `src/index.css`, `tailwind.config.ts`, `index.html`

### What changed

**`src/index.css`**
- Added the **full raw brand palette** from `style.css` as complete colour values:
  `--ink`, `--ink-soft`, `--paper`, `--panel`, `--line`, `--line-strong`, `--quiet`,
  `--brand`, `--brand-dark`, `--brand-tint`, `--deal`, `--deal-tint`, `--ok`, `--ok-tint`, `--star`.
- Added geometry/elevation: `--radius-s` (6px), `--radius-m` (10px), `--shadow-card`,
  `--shadow-pop`, `--header-h` (60px), `--catbar-h` (44px).
- **Retuned the entire shadcn semantic layer** from cool-grey/purple/teal →
  warm ink + orange, using exact HSL conversions
  (`#14140f`→`60 14% 7%`, `#ff7a1a`→`25 100% 55%`, `#e7e4dc`→`44 19% 88%`, …).
- **Defined `--success` and `--price`** — previously *referenced* by `tailwind.config.ts`
  but never defined, so `bg-success`/`text-price` rendered as nothing. **Hard bug fixed.**
- **Wrote a full dark palette** (raw tokens re-declared inside `.dark`, plus semantic
  triplets). `style.css` ships zero dark rules — this was the largest silent gap.
- `--radius` 0.5rem → **0.625rem** so `rounded-lg` = 10px (`--radius-m`) and
  `rounded-sm` = 6px (`--radius-s`), matching the design system.

**`tailwind.config.ts`** (merged into existing config — never replaced)
- `fontFamily.sans` → **Inter** (was undefined, so `font-sans` fell back to the browser
  stack and the homepage rendered in neither Inter nor the configured `DM Sans`).
  Removed the wrong `DM Sans` body font.
- Brand colours as **raw `var()`** with no `hsl()` wrapper (avoids the invalid-CSS bug):
  `ink{,.soft,.foreground}`, `paper`, `panel`, `line{,.strong}`, `quiet`,
  `brand{,.dark,.tint}`, `deal{,.tint}`, `ok{,.tint}`, `star`.
- `muted` **left as an object** — renaming it would have broken **69** existing
  `muted-foreground` usages. The sketch's muted-text token became **`quiet`**.
- `borderRadius.chip` (6px) / `card` (10px) — avoided `rounded-s`/`rounded-m`
  (would read as typos of `rounded-sm`; `s`/`e` are reserved for logical corners).
- `boxShadow.card` / `pop` now use the design's rgba values; `spacing.header`/`catbar`;
  `screens.xlg: 1080px` (1080px has no Tailwind default).

**`index.html`**
- Google Fonts now loads **Inter 800 + 900**. The design uses `font-weight:800`
  extensively; without it the browser paints a **synthesised faux-bold**. Fixes
  visible smearing on high-DPI screens.

### Evidence
```
npm run build  →  ✓ built in 41.23s
```
Verified present in compiled CSS (`index-CB1WbsKb.css`, 122.7 KB):
`--brand:#ff7a1a` · `--ink:#14140f` · `--quiet:#6e6c64` · `--line:#e7e4dc` ·
`--ok:#1a7a4c` · `--star:#f5a623` · `--header-h:60px` · `--catbar-h:44px` ·
`--gradient-deal` · `--primary:25 100% 55%` · `--muted-foreground:48 5% 41%` ·
`--border:44 19% 88%` · `--success:151 65% 29%` · `--price:4 78% 49%` ·
dark `--ink:#0b0b09` / `--brand:#ff8f3d`.

---

## PHASE 2 — `accent` de-collision ✅ DONE & VERIFIED

**The problem.** `accent` was **overloaded**:
- shadcn (`button.tsx` L14/L16, `dropdown-menu`, `select`, `dialog`, `toggle`) uses it as a
  **neutral hover surface** → `hover:bg-accent hover:text-accent-foreground`.
- 22 app files used it as a **success/positive** colour (Approved, Verified, Delivered,
  Positive, Resolved).

Making `--accent` green would have turned **every outline/ghost button** in the app
dark-green on hover. So `--accent` was kept **neutral** (shadcn's intended meaning) and
the status usages were migrated to the newly-defined **`--success`**.

### Migration — 21 files, 82 references
Ordered replaces (most specific first, so `text-accent-foreground` is never
half-matched by `text-accent`):
`bg-accent/N`→`bg-success/N` · `border-accent/N`→`border-success/N` ·
`from-accent/N`/`to-accent/N`→`from/to-success/N` ·
`text-accent-foreground`→`text-success-foreground` · `text-accent`→`text-success` ·
`border-accent`→`border-success` · `ring-accent`→`ring-success` · `bg-accent`→`bg-success`

`src/components/ui/**` was **excluded** — verified untouched (still `bg-accent`, neutral).

### Deliberately NOT changed
- `ProductVideoPlayer.tsx:211` → `accent-white`. Tailwind's **native** `accent-color`
  utility, not our token.
- `CheckoutPage.tsx:241` → `accent-[#111111]`. Same — native checkbox tint.
  (Worth migrating to `accent-ink` during the hex sweep.)

### Second-order fixes (consistency)
- `ProductCard` badge `tone` union: `"accent"` → **`"brand" | "success"`**.
  `brand` = `bg-brand text-ink` — ink-on-orange is ~7:1 contrast; white on `#ff7a1a`
  is only ~2.6:1 and **fails WCAG AA**. `MarketplacePage:632` "New" badge → `tone: "brand"`.
- `GradientOrb` colour key `accent` → `success` (union + map).
- `AdminAnalytics` `chartTheme.accent` → **`chartTheme.success`**, so chart bars stay
  a distinct data series from the orange `primary` series.

### Evidence
- Remaining `accent` refs in app code: **2** (both native utilities, correct).
- Generated in CSS: `.bg-success` `.text-success` `.border-success`
  `.text-success-foreground` `.from-success` `.bg-success\/10` `.hover\:bg-success\/90` ✅
- `npm run build` → **✓ built in 41.23s**
- `tsc --noEmit` → **5 errors, identical to the pre-existing 5** in `tsccheck.txt`
  ⇒ **zero new errors introduced.**

---

## ⚠️ Pre-existing type errors (NOT mine — verified by diff)

Diffed `tsccheck.txt` (written before this work) against the current run:
**5 before, 5 now, same file/line/column.** They are latent bugs worth fixing
separately, and two look like **real runtime defects**:

| File | Issue | Severity |
| --- | --- | --- |
| `components/RecentlyViewed.tsx:79` | `addItem(...)` omits required `product_id` | 🟠 **likely breaks add-to-cart from Recently Viewed** |
| `pages/buyer/BuyerWishlist.tsx:75` | `addItem(...)` omits required `product_id` | 🔴 **likely breaks add-to-cart from Wishlist** |
| `components/OffersReceivedCard.tsx:86` | `amount` typed `string`, DB returns `number` | 🟠 type/runtime mismatch |
| `components/OffersSentCard.tsx:79` | same as above | 🟠 |
| `lib/sku.ts:2` | `replaceAll` needs `lib: es2021+` | 🟢 one-line tsconfig fix |

---

## PHASE 3 — Shared primitives ✅ DONE & VERIFIED

Built the shared components the design reuses everywhere, so the same
star-rating, price and section-heading logic is never re-implemented per page
(the doc's "don't create a second version of any of these" rule).

### New: `src/components/ui/StarRating.tsx`
Implements the design's `.pc-rating` / `.pd-meta` pattern.
- Sizes `xs`/`sm`/`md`/`lg` (12→20px star, `text-xs`→`text-base`).
- `showStars` renders a **true 5-star row with fractional fill** — a grey track
  plus a colour overlay clipped to `rating/5*100%`, so 4.4 fills 88% with no
  half-star icon. `role="img"` + `aria-label="4.4 out of 5"`.
- Composes `★ 4.7 · 2,108 sold` / `★ 4.4 · 318 reviews · 620 sold` from
  optional `reviewCount` + `soldCount` with thousands separators.
- **Amazon/AliExpress convention built in:** an unrated product shows **"New"**
  rather than `0.0`, which reads as a bad rating to shoppers
  (`showNewWhenUnrated`, overridable via `newLabel`).

### New: `src/components/product/PriceDisplay.tsx`
- Sizes `sm` (card: 15px/800) / `md` / `lg` (PDP: 28px/800), struck-through
  original at 12px/15px — exactly the design's `.pc-price` and `.pd-price-row`.
- Current price uses **`text-deal`**, not `text-primary`, per the design.
- `formatPrice` is injected rather than imported, so the component stays
  presentational and testable.
- Exports **`discountPercent(price, compareAt)`** so callers can render the
  `-30%` badge on the image (design's `.pc-badge`) **without duplicating the
  maths** — several pages currently recompute this by hand.

### Updated: `src/components/ui/SectionHeader.tsx` → design's `.section-head`
`items-baseline` · `border-b border-line` · `pb-3` · `h2` 19px/`font-extrabold` ·
link 13px/`font-bold`/`text-brand-dark`. All existing props kept, so
`LandingPage` and `HorizontalScrollSection` keep working.
**Deliberate:** the title uses `text-foreground`, **not** `text-ink`. `--ink`
is re-declared in dark mode, so `text-ink` would render dark-on-dark; the
`foreground` HSL triplet inverts correctly.

### Updated: `src/components/ui/button.tsx` → brand variants
Added `brand` (Buy Now), `brandOutline` (Add to Cart), `outlineStrong`
(Message / Visit Store), `onInk` (white button on the hero/rail dark surface),
`deal`; plus pill sizes `pill` / `pillSm` / `pillLg`.

**Hover rule encoded in comments:** `bg-brand` resolves to `var(--brand)`, an
opaque raw value, so `hover:bg-brand/90` emits **nothing**. Brand hovers step to
the neighbouring **solid** token (`brand` → `brand-dark`).

**Contrast decision:** the sketch's `.btn-add` uses white on `#ff7a1a`, which is
**2.6:1 and fails WCAG AA**. The design's own `.pill` already uses ink-on-orange,
so `brand` follows that (≈7:1). One class to revert if the literal white is wanted.

### 🔴 Newly found: the entire test suite was dead
`vitest.config.ts` has always pointed `setupFiles` at `./src/test/setup.ts`, but
**`src/test/` did not exist** — so `npm test` failed before collecting a single
test. `docs/E2E_CHECKLIST.md` even references `src/test/productRefCard.test.ts`,
which was never committed.
Then a second layer: `@testing-library/react@16.3.2` declares
`@testing-library/dom@^10` as a **required peer**, and it was **not installed**.

Fixed both:
- Created `src/test/setup.ts` (jest-dom + `matchMedia` / `ResizeObserver` /
  `IntersectionObserver` stubs — Radix primitives throw in jsdom without them).
- Installed `@testing-library/dom@10.4.2` as a devDependency.
- Added `src/test/priceDisplay.test.tsx` (8 tests) and
  `src/test/starRating.test.tsx` (9 tests).

### Evidence
```
npx vitest run  →  Test Files  2 passed (2)
                   Tests      17 passed (17)
npm run build   →  ✓ built in 6.87s   (CSS 123.6 KB)
```
Confirmed generated in CSS: `.text-deal` `.text-quiet` `.text-ink-soft`
`.border-line` `.bg-brand` `.bg-deal` `.text-star` `.fill-star` `.bg-panel`
`.border-line-strong` `.border-foreground` `.hover:bg-brand-dark`
`.hover:bg-brand-tint` `.hover:border-brand` `.hover:text-brand-dark` ✅

---

##  Defect register (found while working — none caused by this redesign)

| # | Location | Issue | Status |
| --- | --- | --- | --- |
| 1 | `tailwind.config.ts` | `--success`, `--price`, `--ink`, `--gradient-deal` referenced but never defined → those classes emitted nothing | ✅ **fixed in Phase 1** |
| 2 | `src/index.css` | `hsl(var(--ink))` with a hex `--ink` = invalid CSS | ✅ **fixed in Phase 1** |
| 3 | `index.html` | Inter weight 800 never loaded → synthesised faux-bold headings | ✅ **fixed in Phase 1** |
| 4 | `src/test/` | Missing → `npm test` could never run | ✅ **fixed in Phase 3** |
| 5 | deps | `@testing-library/dom` peer not installed → tests uncollectable | ✅ **fixed in Phase 3** |
| 6 | `hooks/useCurrency.tsx` | `formatPrice(usdPrice)` takes **one** arg, but `LandingPage` calls `formatPrice(amount, product.currency)` — the currency is **silently ignored**, so non-USD products render at USD-converted rates | 🔴 **open** |
| 7 | `pages/buyer/BuyerWishlist.tsx:75` | `addItem(...)` omits required `product_id` → likely breaks add-to-cart from Wishlist | 🔴 **open** |
| 8 | `components/RecentlyViewed.tsx:79` | Same as #7 | 🔴 **open** |
| 9 | `components/OffersReceivedCard.tsx:86` / `OffersSentCard.tsx:79` | `amount` typed `string`, DB returns `number` | 🟠 **open** |
| 10 | `lib/sku.ts:2` | `replaceAll` needs `lib: es2021+` in tsconfig | 🟢 **open** |

---

## Next phases

4. `CategoryRail` + homepage restructure (Conflict 5 — needs the sketch-vs-PRD call)
5. `ProductCard` restyle onto the new primitives
6. `MarketplacePage` — persistent sticky filter sidebar
7. PDP — Specifications table (documented missing), shipping-info dedupe
8. Cart + account pages at `/cart` and `/account`
9. Hex sweep (≈200 hard-coded hexes → tokens across ≈15 components)
10. Defects #6–#10