# Tradibu header-to-hero implementation plan

## Goal

Make the first viewport immediately useful for a buyer: understand what Tradibu
is, search or browse real inventory, see the relevant promotion, and reach the
first product feed without oversized decorative space or duplicated controls.

This is the first implementation slice after the audit. The supplied reference
screens are direction, not content to copy: they use compact search-led headers,
horizontal category browsing, restrained promotional banners, and product cards
whose content flows naturally when optional fields are absent.

The latest Tradibu reference adds two explicit first-viewport cues: cart access
stays visible in the compact mobile header, and the page names the marketplace
before category discovery. Those cues are now part of the implementation
contract; the existing bottom navigation remains as a second, thumb-reachable
path rather than being removed.

## Evidence and current decisions

### Header

- Keep the existing `MarketplaceNavbar` and its real authentication, cart,
  currency, and location integrations.
- Make search the primary discovery action.
- Keep destination/currency controls in one global location. They should not be
  repeated as a second toolbar above marketplace products.
- Desktop keeps logo, search, destination, account/orders, and cart in one
  readable row. Mobile keeps search immediately reachable with compact account
  and cart actions.

### Category navigation

- Desktop will use a concise horizontal category rail before the hero instead of
  making the sidebar carry the entire first-viewport navigation burden. The
  homepage no longer spends a full hero column on the expandable tree; the tree
  remains available on marketplace listing pages for deep navigation.
- Mobile will use a horizontally scrollable category rail with visible labels and
  real category links.
- Category content must come from the existing catalogue; no placeholder category
  names, counts, or images will be introduced.

### Hero

- Keep `HeroSlider` because it already supports database-backed campaigns and
  fallback/error states.
- Desktop hero geometry will be compact and balanced: one primary campaign with
  optional secondary promotional content only when real campaign data exists.
- Mobile will show one readable campaign at a stable aspect ratio; side promos and
  large empty gutters will not be squeezed into the phone layout.
- The first hero image receives priority loading; later slides remain lazy.

### Content order before products

1. Global announcement, only when configured.
2. Compact marketplace header and search.
3. Category rail.
4. Primary campaign hero.
5. Trust or delivery information, only when backed by real configuration.
6. First real product section or category section; empty sections are omitted.

This order follows the useful parts of the supplied mobile and desktop
references while preserving Tradibu's own yellow brand identity and real data
contracts.

## Controlled implementation phases

1. **Card content flow (now)**
   Remove fixed heights from optional product metadata and verify cards with
   complete and sparse catalogue data.
2. **Header contract**
   Audit `MarketplaceNavbar` at 390px, 768px, 1440px, and 1920px. Reduce height,
   remove duplicated discovery controls, and preserve keyboard and screen-reader
   semantics.
3. **Category rail**
   Add the responsive real-data category rail and keep a discoverable desktop
   fallback for deep category navigation.
4. **Hero composition**
   Tune spacing, image aspect ratios, campaign fallbacks, loading states, and
   mobile stacking without changing campaign or Supabase contracts.
5. **Rendered QA**
   Test search, category navigation, campaign links, product links, image loading,
   keyboard navigation, reduced motion, and no-horizontal-overflow at mobile and
   desktop sizes.

## Acceptance criteria

- A product card with no brand, rating, seller, shipping, or variant metadata has
  its price immediately after the title.
- Cards with optional metadata retain the same visual language without blank
  reserved rows.
- Header controls have one clear ownership location and remain usable on mobile.
- Hero content is visible without excessive vertical space and does not shift when
  its image loads.
- All visible links and labels use real Tradibu data.
- Focus states, touch targets, loading states, and error states remain intact.
- Focused tests, typecheck, lint, build, and browser checks pass before release.
