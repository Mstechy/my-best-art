# MarketHub Enterprise UI Refactor — PRD

## 1. Design System Rules (Non-Negotiable)

### Brand Colors (from `src/index.css` — DO NOT CHANGE)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `hsl(252 62% 55%)` | `hsl(252 62% 65%)` | Buttons, links, active states |
| `--accent` | `hsl(173 58% 39%)` | `hsl(173 58% 45%)` | Highlights, badges |
| `--seller` | `hsl(45 93% 47%)` | same | Seller branding |
| `--buyer` | `hsl(173 58% 39%)` | same | Buyer branding |
| `--admin` | `hsl(252 62% 55%)` | same | Admin branding |
| `--background` | `hsl(0 0% 99%)` | `hsl(222 47% 6%)` | Page background |
| `--card` | `hsl(0 0% 100%)` | `hsl(222 47% 9%)` | Card surfaces |

### Fonts
- **Display**: Space Grotesk (`font-display`)
- **Body**: Inter (`font-body`)

### Hard Rules
1. **NEVER** replace brand colors with gray/neutral defaults. Use `--primary`, `--accent`, `--seller`, `--buyer`, `--admin` tokens.
2. **NEVER** break dark mode. Every change must have `dark:` variants.
3. **NEVER** remove existing functionality (search, image search, cart, wishlist, i18n).
4. **ALWAYS** use `useTranslation()` for user-facing strings (i18n already wired).
5. **ALWAYS** keep `max-w-7xl mx-auto px-4 lg:px-8` container pattern.
6. **ALWAYS** verify with `npx tsc --noEmit` after changes.
7. **ALWAYS** preserve existing data flow (Supabase hooks, React Query, cart context).

---

## 2. Global Container Architecture

### Current State
- Pages use `max-w-7xl px-4 lg:px-8` individually (LandingPage, MarketplacePage, ProductDetailPage)
- Footer already uses `max-w-7xl px-4 lg:px-8`

### Target
Create a reusable `Container` component:
```tsx
// src/components/ui/Container.tsx
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${className ?? ""}`}>{children}</div>;
}
```
Replace all inline `max-w-7xl px-4 lg:px-8` with `<Container>`.

### Card Standard
Create a `BrandCard` wrapper using brand tokens:
```tsx
// src/components/ui/BrandCard.tsx
export function BrandCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className ?? ""}`}>
      {children}
    </div>
  );
}
```

---

## 3. Header & Integrated Search

### Current State
- `MarketplaceNavbar.tsx` (547 lines) — already has integrated search with suggestions, image search, categories, cart, wishlist, language switcher, currency selector, theme toggle
- Uses `h-16`-style compact layout already

### Target (Refine, don't rebuild)
1. **Keep all existing functionality** — search suggestions, image search, cart drawer, wishlist, language, currency, theme
2. **Standardize search input** — wrap in `relative` container, put search icon inside right edge:
   ```tsx
   <div className="relative w-full">
     <Input className="pr-10" />
     <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">
       <Search className="h-4 w-4" />
     </button>
   </div>
   ```
3. **Ensure single-row density** — `h-16 flex items-center justify-between gap-4`
4. **Mobile** — keep existing Sheet-based mobile menu, ensure search is accessible

---

## 4. Product Card Grid

### Current State
- `MarketplacePage.tsx` has inline product cards (lines 555-700)
- Already uses `aspect-square`, `flex flex-col h-full`, `mt-auto` for price alignment
- Already shows rating, sold count, vendor, discount badges, flash deals

### Target (Refine)
1. **Extract to reusable `ProductCard` component** — currently inline in MarketplacePage
2. **Strict thumbnail container**:
   ```tsx
   <div className="w-full aspect-square relative rounded-t-xl overflow-hidden bg-muted">
     <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
   </div>
   ```
3. **Flex body with bottom alignment**:
   ```tsx
   <div className="p-3 flex-1 flex flex-col justify-between">
     <div>
       <h4 className="line-clamp-2">{title}</h4>
       <div className="flex items-center gap-1.5 text-xs text-muted-foreground my-1">
         <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
         <span className="font-semibold text-foreground">{rating.toFixed(1)}</span>
         <span className="text-muted-foreground/50">•</span>
         <span>{soldCount ? `${soldCount.toLocaleString()} sold` : "New"}</span>
       </div>
       <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md inline-block w-fit">
         by {vendorName}
       </span>
     </div>
     <div className="mt-auto pt-2">
       <div className="flex items-baseline gap-1.5">
         <span className="text-sm font-bold text-foreground">{formatPrice(price)}</span>
         {compareAt && <span className="text-[10px] text-muted-foreground line-through">{formatPrice(compareAt)}</span>}
       </div>
       <div className="flex gap-2 mt-2">
         <button className="bg-primary text-primary-foreground rounded-full px-3 h-8 text-[10px] font-bold">Buy Now</button>
         <button className="bg-foreground text-background rounded-full p-2 h-8 w-8"><ShoppingCart /></button>
       </div>
     </div>
   </div>
   ```
4. **Apply to all product grids** — MarketplacePage, LandingPage feeds, CollectionPage, RecommendedProducts, RecentlyViewed

---

## 5. Section Headers (Deals & Aggregators)

### Target
Standardize all homepage section headers:
```tsx
<div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
  <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
  {link && <Link className="text-sm font-medium text-primary hover:text-primary/80">{t("seeAll")} →</Link>}
</div>
```

Apply to:
- LandingPage: "Top Deals", "Trending Products", "Category Highlights", flash deal rail
- MarketplacePage: "Popular Now"
- CollectionPage sections
- RecommendedProducts, RecentlyViewed

---

## 6. Localization Cleanup

### Current State
- `SiteFooter.tsx` already uses `useTranslation()` — correct
- `MarketplaceNavbar.tsx` already uses `useTranslation()` — correct
- `LandingPage.tsx` — need to verify all strings use `t()`
- `MarketplacePage.tsx` — need to verify all strings use `t()`

### Target
1. Audit all pages for hardcoded strings → move to `en.json` / `fr.json`
2. Ensure footer, header, body all use the same language context (already via `useTranslation`)
3. Add missing keys to both `en.json` and `fr.json`

---

## 7. Engineering Verification Checklist

Before considering any task complete:
- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] Dark mode works (toggle theme, verify contrast)
- [ ] Mobile responsive (test at 375px, 768px, 1024px, 1440px)
- [ ] i18n works (switch EN/FR, verify no hardcoded strings)
- [ ] All existing features still work (search, cart, wishlist, auth, checkout)
- [ ] No console errors
- [ ] Performance: no new large chunks in critical path

---

## 8. Implementation Order (Phased)

### Phase 1: Foundation (Safe, no visual change)
1. Create `Container` component
2. Create `BrandCard` component
3. Create `SectionHeader` component
4. Replace inline containers with `<Container>`

### Phase 2: Product Card Extraction
1. Extract `ProductCard` from MarketplacePage inline code
2. Apply to all product grids
3. Verify all features (wishlist, cart, buy now, flash deals, videos) preserved

### Phase 3: Header Refinement
1. Standardize search input with integrated icon
2. Ensure single-row density
3. Keep all existing functionality

### Phase 4: Section Headers
1. Apply `SectionHeader` to all homepage sections
2. Verify i18n keys

### Phase 5: Localization Audit
1. Audit all pages for hardcoded strings
2. Add missing i18n keys
3. Verify EN/FR parity

---

## 9. Files to Modify

| File | Change |
|------|--------|
| `src/components/ui/Container.tsx` | **NEW** — reusable container |
| `src/components/ui/BrandCard.tsx` | **NEW** — brand card wrapper |
| `src/components/ui/SectionHeader.tsx` | **NEW** — section header |
| `src/components/product/ProductCard.tsx` | **NEW** — extracted product card |
| `src/pages/MarketplacePage.tsx` | Use Container, ProductCard, SectionHeader |
| `src/pages/LandingPage.tsx` | Use Container, ProductCard, SectionHeader |
| `src/pages/CollectionPage.tsx` | Use Container, ProductCard |
| `src/components/MarketplaceNavbar.tsx` | Standardize search input |
| `src/components/SiteFooter.tsx` | Verify i18n (already correct) |
| `src/lib/i18n/locales/en.json` | Add missing keys |
| `src/lib/i18n/locales/fr.json` | Add missing keys |

---

## 10. Rules for AI Implementation

1. **Never guess** — if unsure about a data field or behavior, read the source first
2. **Never break** — preserve all existing functionality
3. **Never remove** — don't delete features, only refactor/extract
4. **Always verify** — run tsc + build after each phase
5. **Always use brand tokens** — never introduce new colors outside the design system
6. **Always support dark mode** — every change needs `dark:` variants
7. **Always use i18n** — no hardcoded user-facing strings
8. **Keep it full-stack** — design changes must not break data flow (Supabase, React Query, cart context)