# Aligning the design with Tailwind + your component structure

> **Status: PROPOSAL — reviewed, NOT YET APPROVED.** See `TAILWIND-ALIGNMENT-REVIEW.md`
> for verified corrections before applying any of this. Several items in here
> conflict with the actual repo and one would break 69 existing usages.

This translates everything in `style.css` and the HTML reference files into Tailwind config + a folder plan matching how you already organize components (by feature: product, ui, store, etc.).

---

## 1. Add these tokens to your `tailwind.config.js`

This is the direct Tailwind translation of every custom property in `style.css`. Give this to your AI verbatim — it means every "amber," "ink," "deal-red" reference in the spec maps to a real, reusable Tailwind class instead of a guessed hex code each time.

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        ink: '#14140f',
        'ink-soft': '#33322b',
        paper: '#fafaf9',
        line: '#e7e4dc',
        'line-strong': '#d8d4c8',
        muted: '#6e6c64',
        brand: {
          DEFAULT: '#ff7a1a',
          dark: '#e0630a',
          tint: '#fff1e6',
        },
        deal: {
          DEFAULT: '#e0281b',
          tint: '#fdecea',
        },
        ok: {
          DEFAULT: '#1a7a4c',
          tint: '#e9f7ef',
        },
        star: '#f5a623',
      },
      borderRadius: {
        s: '6px',
        m: '10px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'], // for headings/hero — you already load this font
      },
      spacing: {
        header: '60px',
        catbar: '44px',
      },
    },
  },
};
```

## 2. Class-by-class translation (reference HTML → Tailwind)

Give your AI this table directly — it stops it from guessing spacing/sizing and re-deriving values that are already decided.

| Reference CSS class | Tailwind equivalent |
|---|---|
| `.container` | `max-w-[1240px] mx-auto px-5` |
| `.site-header` | `sticky top-0 z-[60] bg-white border-b border-line h-header` |
| `.logo` | `text-xl font-extrabold tracking-tight` (brand: `text-ink` + `text-brand` split spans) |
| `.search-form input` | `flex-1 border-2 border-ink rounded-l-full px-4 py-2.5 text-sm` |
| `.category-rail` | `bg-ink sticky top-header z-[55] h-catbar` |
| `.hero-inner` | `bg-ink rounded-m p-10 flex flex-col gap-3.5 max-w-[640px]` |
| `.pill` | `inline-flex bg-brand text-ink text-xs font-bold px-3 py-1 rounded-full w-fit` |
| `.btn-primary` | `bg-white text-ink rounded-full px-6 py-3 text-sm font-bold` |
| `.cat-grid` | `grid grid-cols-6 gap-3.5` (responsive: `grid-cols-2 md:grid-cols-4 lg:grid-cols-6`) |
| `.product-card` | `bg-white border border-line rounded-m overflow-hidden flex flex-col hover:border-line-strong hover:shadow-sm` |
| `.pc-media` | `relative aspect-square bg-[#f1f0eb] overflow-hidden` |
| `.pc-badge` | `absolute top-2 left-2 bg-deal text-white text-[11px] font-extrabold px-1.5 py-0.5 rounded` |
| `.pc-title` | `text-[13px] font-medium text-ink-soft line-clamp-2 min-h-[34px]` |
| `.pc-price .now` | `text-[15px] font-extrabold text-deal` |
| `.pc-price .was` | `text-xs text-muted line-through` |
| `.filters` (sidebar) | `border border-line rounded-m p-4.5 sticky top-[120px]` |
| `.listing-grid` | `grid grid-cols-4 gap-3.5` (responsive down to `grid-cols-2`) |
| `.bottom-nav` | `fixed bottom-0 inset-x-0 z-[60] bg-white border-t border-line md:hidden` |

Anything not in this table but present in `style.css` follows the same pattern: the CSS value converts directly to the nearest Tailwind utility (e.g. `border-radius:8px` → `rounded-lg`, `gap:14px` → `gap-3.5`).

---

## 3. Where each piece goes in your folder structure

Since you organize by feature (product, ui, store, etc.), here's the mapping:

```
/components/ui/
  Header.tsx          — logo, search bar, wishlist/cart/account icons
  CategoryRail.tsx     — sticky category nav strip + mega-menu
  MobileNav.tsx        — bottom nav (Home/Category/Cart/Account)
  Footer.tsx
  MenuDrawer.tsx       — hamburger slide-in menu

/components/product/
  ProductCard.tsx      — the ONE shared card used everywhere (Part D1 in FULL_SPEC.md)
  ProductGallery.tsx   — image + thumbnails, product page
  VariantSelector.tsx  — color/storage buttons
  StarRating.tsx       — shared rating display (Part D2)
  PriceDisplay.tsx     — shared price formatter (Part D3)
  ReviewList.tsx

/components/store/
  StoreHeader.tsx      — seller storefront banner/logo/follow button
  StoreTrustMetrics.tsx — item-as-described %, ships-on-time %, response time

/components/cart/
  CartItem.tsx
  CartSellerGroup.tsx  — groups items by seller (Part E1)
  OrderSummary.tsx

/components/checkout/
  AddressStep.tsx
  PaymentStep.tsx
  CheckoutProgress.tsx — the 4-step progress bar

/components/filters/
  FilterSidebar.tsx
  FilterDrawer.tsx     — mobile bottom-sheet version
  SortDropdown.tsx

/pages/ (or /app/ routes, depending on your router)
  Home.tsx
  Category.tsx
  Product.tsx
  Cart.tsx
  Checkout.tsx
  Account.tsx
  Store.tsx
```

## 4. Updated instruction template for your AI

Use this instead of the generic one in `HANDOFF.md` — same sequencing, now with the real specifics:

> "I use Tailwind CSS and organize components by feature (`/components/product/`, `/components/ui/`, `/components/store/`, etc. — see the folder plan in TAILWIND_ALIGNMENT.md). Read FULL_SPEC.md for the full plan and index.html/category.html/etc. as visual reference — but don't copy their inline `<style>` blocks directly; translate them to Tailwind classes using the token config and class table in TAILWIND_ALIGNMENT.md.
>
> Starting with Build Order step 2 from FULL_SPEC.md: create `/components/product/ProductCard.tsx`, `/components/product/StarRating.tsx`, and `/components/product/PriceDisplay.tsx` as the shared components. Match the structure and Tailwind classes from the table in TAILWIND_ALIGNMENT.md. These get imported everywhere a product renders — don't create a second version of any of these later."

## 5. One habit specific to Tailwind

Once `tailwind.config.js` has the token extension above, tell your AI: **"always use the semantic color names (`brand`, `deal`, `ink`, `muted`) — never a raw hex code or Tailwind's default palette (`orange-500`, `red-600`, etc.) in these components."** This is what keeps your whole app on one consistent palette instead of six slightly-different oranges creeping in across components built in different sessions.

