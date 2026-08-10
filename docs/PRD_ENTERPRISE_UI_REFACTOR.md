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

---

## 11b. Design-First Audit Rule (CRITICAL)

> **Before ANY implementation, perform a visual audit of the CURRENT website first.**

1. **NEVER blindly apply a prompt's classes** — every component must be evaluated against the actual current page layout.
2. **Place things where they make sense** — don't just stack elements; consider spacing, hierarchy, and visual breathing room.
3. **Fix broken layouts first** — if the current page has jam-packed/overcrowded sections, misaligned grids, or overlapping elements, fix those BEFORE adding new features.
4. **Respect visual hierarchy** — titles, prices, CTAs, and badges each have a place; don't cram them together.
5. **No clutter** — if a design would cause elements to "jam pack together" (as the user described), redesign it to breathe.
6. **Balance designer + engineer rules** — a design that breaks functionality is wrong; functionality that looks ugly is also wrong. Both must pass.
7. **Website-specific adaptation** — the prompts reference AliExpress/gray-based styles, but **MarketHub has its own brand colors** (`--primary` indigo, `--accent` teal, `--seller` amber, `--buyer` teal). Adapt every design to MarketHub's brand, not copy AliExpress's gray/blue blindly.
8. **Audit before implement** — for EACH stored prompt, first:
   - Read the current component/page code
   - Check the current visual structure
   - Identify if the prompt would improve or clutter
   - Adapt the design to fit MarketHub's existing patterns
   - Only then implement

---

## 11. Pending Prompts (Stored — NOT Implemented)

> **STATUS: PLANNING PHASE — Do NOT implement until user says "start"**
>
> ## ⭐ PRIORITY #1 — MASTER TASK: MarketHub Redesign & Fix (Mobile-First)
>
> **Role & Context:** Senior product designer + frontend engineer. Full audit + redesign pass on MarketHub multi-vendor marketplace. Benchmark: AliExpress mobile web — not to copy branding, but because spacing/hierarchy/component design/IA are intentional and professional. Ours looks like default/generic UI-kit output with broken elements, inconsistent styling, misplaced components.
>
> **CRITICAL: Mobile-first (viewport ~375-428px). Build and test mobile first. Desktop is separate — adapt with standard responsive best practices (sidebar nav, wider grids, hover states), but mobile is priority and source of truth.**
>
> ### ⚡ AUDIT RULES (must follow before any implementation)
> 1. Audit and list every affected file/component BEFORE making changes
> 2. Fix root causes (broken/misplaced elements, missing design tokens) — not surface patches
> 3. Implement shared, reusable components — not page-specific one-off code
> 4. Report every file changed with explanation after implementation for review before committing
> 5. **Do NOT spoil the website** — make sure everything fits the existing design before applying; no blind code/implement
> 6. Don't touch product data/content — layout/component/design-system work only (except flagging spec-data bug in Part 1.4)
>
> ### PART 1: Confirmed bugs to fix (actual broken elements)
> 1. **Floating black circular button with arrow (→)** fixed top-left on every page, overlapping content. Investigate purpose — if no function, delete entirely. If scroll-to-top remnant, reposition to bottom-right, hidden until scroll, 16-24px edge spacing.
> 2. **Blurred/smeared gradient artifact behind header bar** — ghosted color smear behind "markethub" logo. Broken/stuck state (unhidden loading skeleton, leftover placeholder bg, broken image ref). Remove — header background must be clean solid (white or brand color), zero noise.
> 3. **Wishlist (heart) icon wrong location.** Remove red circular heart next to "Add to Cart". Wishlist icon should live INSIDE the image gallery — small semi-transparent circular icon overlay top-right of hero image. Scrolls away with image, does NOT reappear elsewhere. No duplicate wishlist anywhere.
> 4. **Mismatched spec data** ("iPhone 16 Pro Max 6.9'" title vs "Model: iPhone 12 Pro Max / Screen Size: 6.1" specs) — data integrity bug in product content layer. Flag for product/seed layer correction (fields should pull from actual listing variant/spec data, not placeholders).
>
> ### PART 2: Header system — two DISTINCT components
> - **2a. HomeHeader (mobile)**: top row (logo + delivery/location indicator grouped), full-width search bar with camera/visual-search icon, horizontal icon shortcut row (Deals, Categories, Promotions, etc. — icon + label underneath). No back arrow.
> - **2b. PageHeader (mobile)**: compact single row — back arrow (←) + hamburger (☰) + logo, search/cart/account icons right-aligned. SEPARATE component from HomeHeader — not one header with conditional branching. Renders on every non-home page. Below header on product pages: breadcrumb trail (Part 4).
>
> ### PART 3: Navigation drawer (hamburger menu)
> - Tapping ☰ opens full-height panel sliding in from LEFT (not dropdown, not centered modal)
> - Contents top→bottom: Home icon/logo header with close; "Popular Category" expandable (category rows with thumbnail + label, sourced dynamically, not hardcoded); secondary section (curated collections/trending); "Settings" section at bottom
> - Dimmed non-interactive overlay behind; closes via overlay tap, close icon, or Escape (desktop)
> - Reusable `<NavDrawer />` component, category list driven by data source/API
> - Animate slide: CSS transform + transition ~250-300ms ease-out
> - Accessible: focus trap, `role="dialog"`, `aria-modal="true"`
>
> ### PART 4: Breadcrumb component
> - "Home / Marketplace / Electronics / [Product Name]" below product page header
> - Small font (~13-14px), muted gray for non-current, current/last slightly darker/bolder
> - Consistent horizontal padding matching page spacing scale
> - Shared `<Breadcrumb />` component reused across all category/product pages
>
> ### PART 5: Bottom-sheet modal pattern
> - Specs, Shipping, Return & refund, Security & Privacy open as BOTTOM SHEET (not inline accordions)
> - Tapping row slides panel UP from bottom, ~70-90% viewport height
> - Title bar with section name + X close button (top-right); scrollable content; dimmed overlay, tap to close
> - ONE reusable `<BottomSheet title onClose>{children}</BottomSheet>` — every info panel reuses it
> - Rows triggering bottom sheet need chevron (>) affordance on right
> - **Description**: short preview on page + "View full description" row opens same `<BottomSheet>` (or dedicated full-page view — match existing MarketHub detail-view convention for consistency)
>
> ### PART 6: Card system — stop reusing one generic card
> - **SellerCard**: distinct visual treatment — subtle tinted bg or different elevation, better avatar/verified-badge/name/rating/stats alignment, not like a spec table row
> - **InfoCard** (shipping, buyer protection, warranty): own consistent but visually distinct treatment
> - **ReviewCard**: own treatment
> - Define 2-3 distinct reusable components (`<SellerCard />`, `<InfoCard />`, `<ReviewCard />`) rather than one generic `<Card>` everywhere
>
> ### PART 7: Design system foundation
> - **Color tokens**: primary, secondary, neutral grays, success/error/warning/accent — replace ad-hoc colors (e.g. mismatched red wishlist circle)
> - **Border-radius scale**: don't mix sharp, slightly-rounded, pill randomly
> - **Shadow/elevation scale**: subtle intentional levels
> - **Spacing scale** (4/8/12/16px): gaps between images, spec rows, description blocks, card padding — eliminate both excessive whitespace and cramped crowding
> - **Typography scale**: consistent sizes/weights for headings, body, captions, prices
>
> ### PART 8: Page structure & information architecture
> - **Product page (mobile), top→bottom**: Images (in-gallery wishlist) → breadcrumb → title/price → variant selector (if applicable) → Add to Cart/Buy Now (sticky bottom bar, flush, safe-area aware) → seller card → service commitment rows (shipping/returns/security — tappable, open bottom sheets) → reviews summary + list → Q&A → specifications (tappable → bottom sheet or inline table) → description (preview + "view full")
> - **Home page**: clear visual sections (deals, categories, recommendations) each with heading + "see all" — no undifferentiated wall of content
>
> ### PART 9: Sticky/fixed positioning requirements
> - **Bottom action bar** (Add to Cart/Buy Now): `position: fixed; bottom: 0; left: 0; right: 0;` ZERO gap. `padding-bottom: env(safe-area-inset-bottom, 0px)`. Add matching padding-bottom to page scrollable content so nothing hides behind.
> - **Seller card**: `position: sticky` (not fixed) with appropriate `top` offset. Check ancestor chain for `overflow: hidden/auto` breaking sticky. Confirm z-index doesn't conflict with fixed bottom bar.
>
> ### PART 10: Navigation behavior — search, account, bottom tab bar
> 1. **Search icon, not bar, on inner pages.** `<PageHeader />` shows magnifying-glass ICON only — not expanded input. Tapping navigates to dedicated search page/screen (reuse home search bar UI, pre-focused). Only `<HomeHeader />` shows full search bar inline.
> 2. **Account icon — direct auth navigation, no dropdown.** Tapping checks auth: logged OUT → login/signup screen; logged IN → account/profile page.
> 3. **Persistent bottom tab bar** (Home, Category, Cart, Account), icon + label, reusable `<BottomTabBar />`.
>    - Cart: logged OUT → login/signup; logged IN → cart page
>    - Account: same auth-gated behavior
>    - Home → home page; Category → category browsing page
>    - Active tab has visual indicator (color/icon fill change)
>    - Separate from product page fixed action bar (different page types)
>
> ### Acceptance criteria
> 1. No floating/broken UI artifacts (arrow button, header smear) anywhere
> 2. Wishlist icon lives only inside image gallery (AliExpress placement/behavior)
> 3. Home and product pages use distinct purpose-built headers
> 4. Hamburger opens left slide-in drawer with dynamically-sourced categories
> 5. Specs/Shipping/Returns/Security open in shared bottom-sheet component
> 6. Seller, info, review cards visually distinct — not one generic box
> 7. Real design system (color/radius/shadow/spacing/type tokens) defined + applied
> 8. Bottom action bar flush to screen edge, safe-area aware
> 9. Works cleanly at mobile widths (375-428px)
> 10. Inner pages show search icon (not bar) → dedicated search screen on tap
> 11. Account icon → login/signup (logged out) or profile (logged in) — no dropdown
> 12. Persistent bottom tab bar (Home/Category/Cart/Account), Cart+Account trigger login when unauthenticated
>
> ### 🏗️ New reusable components to build (shared library)
> `<NavDrawer />`, `<BottomSheet />`, `<PageHeader />`, `<HomeHeader />`, `<SellerCard />`, `<InfoCard />`, `<ReviewCard />`, `<Breadcrumb />`, `<BottomTabBar />`
>
> ### 📁 General engineering requirements
> - Match existing project conventions (Tailwind styling via existing classes)
> - Mobile-first: build/test at 375px, 390px, 428px first; desktop adapts responsively (drawer → persistent sidebar okay)
> - Accessible: ARIA roles, focus management, keyboard closeability
> - Don't touch product data/content (except flagging spec mismatch)

### Prompt 1: Enterprise Category Drawer (Slide-over)

**Role:** Senior Frontend Engineer
**Task:** Refactor/Implement an enterprise-grade slide-over Category Drawer component for MarketHub with nested multi-level navigation and smooth transitions.

#### 1. Overlay & Drawer Backdrop
- Backdrop: `fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity duration-300`
- `onClick` on backdrop → `onClose()`
- Panel: `fixed inset-y-0 left-0 w-full max-w-xs sm:max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out`
- Slide: `-translate-x-full` (closed) → `translate-x-0` (active)

#### 2. Drawer Header
- Header: `p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800`
- Title + icon: "All Departments" / "Categories" — `text-base font-bold text-gray-900 dark:text-white flex items-center gap-2`
- Dismiss: `p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500`

#### 3. Nested Accordion Category List
- Category item: `w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors`
- Chevron indicator: `ChevronRight` / `ChevronDown` on expandable parents
- Sub-category panel: smooth height/opacity transitions
- Sub-item links: `pl-8 pr-4 py-2 text-xs font-normal text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2`

#### 4. Drawer Footer Utilities
- `mt-auto border-t border-gray-100 p-4`
- Language/Currency selector: e.g., `NGN (₦) • English`
- Vendor CTA: "Become a Seller" / "Vendor Dashboard"

#### 5. Accessibility & UX
- Trap focus inside drawer when open
- Close on `Escape` key
- Body scroll lock: `document.body.style.overflow = 'hidden'` when open

> **Note:** A `CategoryDrawer.tsx` component file already exists (created earlier) but is NOT wired into the navbar. It will be wired when implementation begins.

### Prompt 2: Product Grid Layout & Card Arrangement

**Role:** Senior Frontend Engineer
**Task:** Refactor the product grid layout and card arrangement component for MarketHub to ensure strict structural alignment, visual consistency, and responsive grid flow across all viewport sizes.

#### 1. Responsive Product Grid Container (`ProductGrid` / `CatalogGrid`)
- Grid columns: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6`
- Parent padding: `p-4 max-w-7xl mx-auto`

#### 2. Product Card Structural Standard (`ProductCard`)
- Card base: `group relative flex flex-col h-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200`
- Image box: `relative w-full aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden`
- Image: `<img className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300" />`
- Discount badge (top-left): `bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-md absolute top-0 left-0 z-10`
- Wishlist heart (top-right): `absolute top-2 right-2 z-10 p-1.5 rounded-full bg-white/80 dark:bg-gray-900/80 hover:bg-white backdrop-blur-sm text-gray-600 dark:text-gray-300 transition-colors`

#### 3. Card Typography & Hierarchy
- Body: `p-3 flex-1 flex flex-col justify-between`
- Title: `text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 min-h-[2.5rem] leading-snug`
- Rating row: `flex items-center gap-1.5 text-[11px] text-gray-500 my-1.5` with amber star + `•` + sold count / "New"
- Vendor pill: `inline-block text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded mb-2 w-fit` — `by {sellerName}`
- Price row (bottom via `mt-auto`): `mt-auto pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2` with sale price + original price strikethrough + cart button

#### 4. Empty & Skeleton Loading States
- Skeleton cards with `animate-pulse` matching container dimensions (`aspect-square` thumbnail + line placeholders) to eliminate layout shift during loading

### Prompt 3: Product-to-Direct-Message (Conversational Commerce)

**Role:** Senior Full-Stack Engineer
**Task:** Implement a seamless Product-to-Direct-Message (Conversational Commerce) flow for MarketHub, allowing buyers to initiate a seller chat directly from product cards or detail pages with auto-attached product context.

#### 1. Navigation & Route Context Transfer (`ProductCard` Component)
- Update product card click handlers / links to route to the chat page while attaching context:
  - Route structure: `/chat/${vendorId}?productId=${productId}`
  - Alternatively, pass state via router: `navigate('/chat', { state: { product, vendor } })`.

#### 2. Chat Interface Product Context Header (`ChatWindow` Component)
- At the top of the active chat panel, render a sticky, high-density **Product Preview Bar**:
  ```tsx
  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <img src={product.image} alt={product.title} className="w-12 h-12 object-cover rounded-lg border" />
    <div className="flex-1 min-w-0">
      <h4 className="text-xs font-semibold text-gray-900 dark:text-white truncate">{product.title}</h4>
      <p className="text-xs font-bold text-gray-900 dark:text-gray-100">{product.price}</p>
    </div>
    <button className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800">
      Buy Now
    </button>
  </div>
  ```

### Prompt 4: Bundle Deals Aggregator Page (Mobile-optimized)

**Role:** Senior Frontend Engineer
**Task:** Build a mobile-optimized "Bundle Deals Aggregator" page layout inspired by enterprise e-commerce platforms (AliExpress Bundle Deals style).

#### 1. Sticky Header & App Promotion Banner
- App Download Top Bar: dismissible promo bar — `flex items-center justify-between p-2 bg-pink-50 border-b` — logo, rating stars, text ("Try the app & save"), "Open" button
- Navigation Header: fixed header — `h-12 bg-blue-600 text-white flex items-center justify-between px-4` — Back chevron, title "Bundle deals", Search icon, Help icon

#### 2. Tiered Promotion & Incentive Section
- Multi-Tier Savings Card: two-column split container with yellow/white background accent
  - Left: `US $3 OFF` / `On 3+ items & over US $3`
  - Right: `US $4 OFF` / `On 4+ items & over US $4`
- Free Shipping Banner: full-width below tiers — `bg-sky-100 text-sky-800 text-xs font-semibold py-2 px-4 flex items-center gap-2` — truck icon + "Free shipping on orders of 3+ items"

#### 3. "Hot Picks" Horizontal Carousel
- Horizontal Scroll Wrapper: `flex overflow-x-auto gap-3 p-4 no-scrollbar`
- Mini Product Card: `w-32 flex-shrink-0 bg-white rounded-xl p-2 border relative flex flex-col`
  - `aspect-square` thumbnail with absolute positioned `+` add button on bottom right
  - Price + sales volume text (`₦3,010.99`, `🔥 50,000+ sold` in bold red)

#### 4. Category Filter Chips (`HorizontalNav`)
- Horizontally scrollable chip list
- Active chip: `bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold`
- Inactive chips: `bg-gray-100 text-gray-700 px-4 py-1.5 rounded-full text-xs font-medium hover:bg-gray-200`

#### 5. Vertical Feed Cards & Sticky Bottom Bar
- Product Feed Grid: `grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 pb-24`
- Card: Image, product title (2-line clamp), rating star + score, order volume, pricing row (sale price + original price + discount percentage badge `-61%`)
- Sticky Floating Checkout Bar: `fixed bottom-0 inset-x-0 bg-gray-900 text-white p-3 flex items-center justify-between shadow-2xl z-40`
  - Left: Basket icon + progress text ("Pick items for free shipping")
  - Right: Disabled/Active CTA button ("Checkout ₦0")

### Prompt 5: Mobile-optimized Product Detail Page (PDP)

**Role:** Lead Frontend Engineer
**Task:** Implement a high-converting, mobile-optimized Product Detail Page (PDP) layout modeled after top-tier e-commerce platforms (AliExpress PDP standard).

#### 1. Sticky Navigation & Media Viewer (`ProductMediaGallery`)
- Header Bar: `sticky top-0 z-30 bg-white dark:bg-gray-900 flex items-center justify-between px-4 h-12 border-b`
  - Left: Back arrow (`ChevronLeft`), Category Menu (`Menu`)
  - Right: Search (`Search`), Account (`User`), Cart (`ShoppingCart`)
- Image Carousel: `relative w-full aspect-square bg-gray-50 dark:bg-gray-800 overflow-hidden`
- Pagination pill (bottom-left): `absolute bottom-3 left-3 bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-full backdrop-blur-sm` — "Item 1/6"
- Wishlist action (bottom-right): `absolute bottom-3 right-3 p-2.5 rounded-full bg-white dark:bg-gray-900 shadow-md text-gray-700 dark:text-gray-200 hover:text-red-500 transition-colors`

#### 2. Title, Social Proof, & Pricing Section (`ProductMainDetails`)
- Title: `text-sm sm:text-base font-semibold text-gray-900 dark:text-white line-clamp-2 mt-3 px-4`
- Social Proof Bar: `px-4 mt-2 flex items-center gap-2 text-xs text-gray-500` — star rating `★ 3.7` (amber bold), `10,000+ sold` (gray-900 bold)
- Campaign Pricing Banner: `mx-4 my-2 p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white font-bold text-xs flex justify-between items-center`
- Main Price Display:
  ```tsx
  <div className="px-4 flex items-baseline gap-2">
    <span className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">₦2,103.16</span>
    <span className="text-xs text-gray-400 line-through">₦6,728.31</span>
    <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">New shopper only</span>
  </div>
  ```

#### 3. SKU Options & Trust Guarantee Badges
- Variant Selector: selectable SKU option chips (`Color: 1pc`) inside `border rounded-lg p-3 mx-4 my-2`
- Platform Commitments: `bg-gray-50 dark:bg-gray-800/50 p-3 mx-4 rounded-xl space-y-2 text-xs`
  - Free Shipping badge + delivery window (`Aug 15 - 23`)
  - Return & Refund policy link with right chevron
  - Security & Privacy guarantee text

#### 4. Verified Reviews & Q&A Sections
- Review Summary Widget: `mx-4 my-4 p-4 border rounded-xl` — score display (`3.7 / 5`), rating breakdown bars, tag chips (`"good quality"`, `"meets expectations"`)
- Review Items: individual reviewer blocks with date, rating stars, selected variant, review text
- Q&A Accordion: section header + expandable list for community questions and buyer responses

#### 5. Recommended Products Grid ("More to Love")
- Header: `px-4 text-base font-bold text-gray-900 dark:text-white mb-3` — "More to love"
- Grid: `grid grid-cols-2 gap-3 px-4 pb-24`
- Standard product cards: `aspect-square` thumbnail, price, discount badge (`-70%`), sales volume (`2,000+ sold`), shipping badge (`Free shipping over ₦15,130.62`)

### Prompt 6: Rich Visual Product Description (Lazy-loaded)

**Role:** Senior Frontend Engineer
**Task:** Implement an ultra-fast, responsive, lazy-loaded "Rich Visual Product Description" section for product detail pages (PDP) to render rich media banners smoothly without layout shifts.

#### 1. Section Container & Heading (`ProductRichDescription`)
- Container Layout: `w-full max-w-4xl mx-auto px-4 py-6 border-t border-gray-100 dark:border-gray-800`
- Section Header: bold title (`Product Description` / `Item Details`) — `text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-between`

#### 2. High-Performance Image Gallery Feed
- **Image Stream Stack**: stack description images vertically using `flex flex-col w-full`
- **Lazy Loading & Layout Shift Prevention (`DescriptionImage` Component)**:
  - Image Wrapper: `relative w-full bg-gray-100 dark:bg-gray-800 overflow-hidden rounded-lg mb-2 min-h-[200px]`
  - Native Lazy Loading & Responsive Srcset:
    ```tsx
    <img
      src={image.url}
      alt={image.altText || "Product detail description graphic"}
      loading="lazy"
      decoding="async"
      className="w-full h-auto object-cover transition-opacity duration-300 opacity-0 data-[loaded=true]:opacity-100"
      onLoad={(e) => e.currentTarget.setAttribute('data-loaded', 'true')}
    />
    ```

#### 3. Fallback Text & Specification Accordion
- Beneath the image stream, provide a fallback HTML specifications block for SEO crawling and screen-reader accessibility:
  ```tsx
  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2 text-xs">
    <h4 className="font-bold text-gray-900 dark:text-white mb-2">Specifications</h4>
    <div className="grid grid-cols-2 gap-2 text-gray-600 dark:text-gray-300">
      <div><span className="font-semibold text-gray-800 dark:text-gray-200">Material:</span> Soft HD Film</div>
      <div><span className="font-semibold text-gray-800 dark:text-gray-200">Hardness:</span> 9H Scratch Resistant</div>
      <div><span className="font-semibold text-gray-800 dark:text-gray-200">Compatibility:</span> JBL Live Beam 3</div>
    </div>
  </div>
  ```
