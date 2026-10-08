/**
 * Build-time defaults for the hero slide's copy.
 *
 * Why this exists: the hero slide's badge/title/description/CTA live in the
 * `marketplace_collections` row and only reach the browser after the Home query
 * resolves - seconds into the load. Until then `HeroSlider`'s pending stage
 * painted only the artwork, so first paint showed a bare image and the text
 * popped in later (and the prerendered static HTML carried no hero text at
 * all, so a crawler's HTML-only pass saw an image box with no content).
 *
 * The pending stage and the `index.html` first-paint shell now both state
 * these strings, byte-aligned with the one hero-enabled row
 * (`electronics-products`, `hero_enabled = true`). React patches the pending
 * text nodes in place when the data arrives - same key ("lead"), same element
 * types, same strings - so neither layout nor LCP moves. When an admin edits
 * the hero row, update this constant in the same deploy: the visible cost of
 * drift is one text reflow when the query lands. The shell side is pinned by
 * src/test/homeShellLcp.test.ts, the React side by src/test/heroLcpSwap.test.tsx;
 * the database itself cannot be asserted from a unit test, which is exactly
 * why the mirrors live next to each other in these files.
 *
 * Mirrors the role src/lib/heroImages.ts plays for the artwork: one source of
 * truth that shell and slider both read from, so they cannot disagree about
 * what first paint looks like.
 */
export const DEFAULT_HERO_COPY = {
  badge: "FREE SHIPPING ON YOUR FIRST ORDER",
  title: "Electronics products",
  description:
    "Discover millions of products from trusted sellers around the world. Shop electronics, fashion, home & garden, beauty, sports, accessories, and more.\nall at great prices.",
  ctaLabel: "Shop collection",
  /** `hero_cta_link` is null on the row, so the live slide computes `/collections/${slug}`. */
  ctaLink: "/collections/electronics-products",
} as const;