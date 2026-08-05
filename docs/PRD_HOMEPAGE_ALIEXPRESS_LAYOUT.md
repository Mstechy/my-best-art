# MarketHub — Homepage Restructure to AliExpress/1688 Layout: PRD

**Status:** Draft v1
**Owner:** Engineering
**Last updated:** 2026-08-05
**Scope:** Public homepage (`src/pages/LandingPage.tsx`) only. No routing, dashboard, or data-model changes.

---

## 1. Goal

Restructure the public homepage to match the proven AliExpress/1688 layout so it converts like a real marketplace. Implement **one section at a time**, verifying the build after each, so nothing breaks.

---

## 2. Verified current state (from codebase survey)

- `src/App.tsx` routing is complete and correct — all dashboard links resolve to real routes. **No broken connections.**
- `src/pages/LandingPage.tsx` currently renders:
  1. Navbar
  2. Promo + marquee banners
  3. **Full-width hero slider** (no category sidebar, no side promo tiles)
  4. Shop by category (horizontal scroll of 8 cards)
  5. Product feeds (horizontal scrolls)
- `useHomepageData` provides: `categories`, `counts`, `heroSlides`, `feeds`, `sellers`, `loading`
- `CategorySidebar` component already exists and is used on MarketplacePage — reusable for the homepage hero.

---

## 3. Target layout (AliExpress/1688 standard, top to bottom)

1. **Navbar** (unchanged)
2. **Hero area — 3 columns** (the biggest structural change):
   - Left: **category tree** (reuse `CategorySidebar`)
   - Center: **hero carousel** (existing `HeroSlider`)
   - Right: **promo tiles** (2–3 small tiles: deals, new arrivals, login/register card)
3. **Flash-deal countdown rail** (urgency section with countdown)
4. **Trust/value-prop strip** (free shipping, buyer protection, secure payment icons)
5. **Category grid** (tiles with images, not a horizontal scroll)
6. **Product feeds** (existing, unchanged)
7. **Footer** (unchanged)

---

## 4. Phased implementation (one at a time, build after each)

### STEP 1 — 3-column hero
- Wrap hero in a 3-column grid: `CategorySidebar` (left) | `HeroSlider` (center) | promo tiles (right)
- On mobile, collapse to just the carousel (sidebar hidden, promo tiles hidden)
- **Build verify**

### STEP 2 — Flash-deal countdown rail
- Add a section between hero and categories showing active flash-deal products with `FlashDealCountdown`
- Uses existing `flash_deal_*` fields + `FlashDealCountdown` component
- **Build verify**

### STEP 3 — Trust/value-prop strip
- Add a 3–4 icon row: Free Shipping, Buyer Protection, Secure Payment, Easy Returns
- **Build verify**

### STEP 4 — Category grid
- Convert the horizontal-scroll category section to a responsive grid of category tiles
- **Build verify**

---

## 5. Definition of Done (each step)

- [ ] `npm run build` succeeds
- [ ] No new lint errors
- [ ] Existing sections (navbar, feeds, footer) unchanged
- [ ] Step is complete before starting the next

---

## 6. Out of scope

- Dashboard changes (verified clean — no broken connections)
- Data-model changes
- Routing changes