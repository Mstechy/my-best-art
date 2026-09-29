/**
 * Product SEO policy: the title, description and schema.org/Product node that a
 * product URL must publish. Shared by the client-side `useProductSEO` hook and
 * the build-time prerenderer in `scripts/prerenderProductPages.ts`.
 *
 * Both must produce byte-identical output. The prerendered <head> is what a
 * crawler reads on its first, HTML-only pass; the hook is what it reads after
 * executing JavaScript. If the two drift, Google is shown a price in the
 * structured data that the rendered page then contradicts, which is exactly the
 * kind of mismatch that gets rich results withdrawn.
 *
 * The actual <head> surgery lives in `./htmlHead`, which this module shares with
 * `./pageSeo`. Only the decisions live here: what the title should say, which
 * offer fields a rich result needs.
 *
 * Kept free of DOM and Node APIs so it type-checks under BOTH tsconfig.app.json
 * (lib: ES2020 + DOM) and tsconfig.node.json (lib: ES2023, strict). That means
 * no `replaceAll` and no `Array.prototype.at` - both are newer than ES2020.
 */
import {
  insertBeforeHeadClose,
  LANDING_PRELOAD_START,
  LANDING_PRELOAD_END,
  removeMeta,
  setCanonical,
  setMeta,
  setTitle,
  stripImagePreloads,
  stripJsonLdByType,
  stripLandingPreloads,
  toHtmlJsonLd,
} from "./htmlHead";

// Re-exported because they were declared here first and are imported from this
// path in two places (`scripts/preloadLandingRoute.ts` and the head tests).
// Moving the definition without keeping the path working would have been a
// silent, build-time-only break.
export { LANDING_PRELOAD_START, LANDING_PRELOAD_END };


export type ProductAvailability = "InStock" | "OutOfStock";

export interface ProductSeoInput {
  /** Product id. Used as `sku` so the structured data ties back to the row. */
  id: string;
  /** Absolute canonical URL of this product page. */
  url: string;
  productName: string;
  price: number;
  currency: string;
  image?: string | null;
  description?: string | null;
  availability?: ProductAvailability;
  rating?: number;
  reviewCount?: number;
  brand?: string | null;
}

const SITE_NAME = "Tradibu";

/**
 * `id` of the Product JSON-LD script `injectProductHead` bakes into prerendered
 * HTML.
 *
 * `useSEO` looks for this exact element on mount and removes it before
 * installing its own structured-data script. Without a stable handle the static
 * node is invisible to the hook, so a direct load of `/product/<id>` ends the
 * render with two Product blocks.
 */
export const PRODUCT_STRUCTURED_DATA_ID = "product-structured-data";

/**
 * Canonical origin. The prerenderer runs in Node where there is no `location`,
 * and the hook runs in the browser where `location.href` can carry a query
 * string, so both resolve against this constant instead.
 */
const SITE_URL = "https://www.tradibu.com";

/** Meta description cap. Google truncates SERP snippets around here anyway. */
export const META_DESCRIPTION_MAX = 160;

/** Rendered without decimals, mirroring the NO_DECIMAL set in useCurrency. */
const NO_DECIMAL_CURRENCIES = ["NGN", "KES", "JPY"];

const FALLBACK_TRAIL = "Secure escrow payments, buyer protection, fast delivery worldwide.";

/**
 * Page title shared by `useSEO` and the prerenderer.
 *
 * Exported rather than re-implemented so the `<head>` a crawler fetches and the
 * `<head>` it sees after running JavaScript can never disagree about the title.
 */
export function buildPageTitle(title?: string): string {
  return title ? `${title} | ${SITE_NAME}` : SITE_NAME;
}

/**
 * `<product> | Tradibu`.
 *
 * Deliberately unchanged from what the client already publishes: the product
 * name is the part that matches the query, and anything appended after the site
 * name is cut off in the SERP anyway.
 */
export function buildProductTitle(productName: string): string {
  return buildPageTitle(productName.trim() || "Product");
}

/** Resolve a possibly relative asset path against the canonical origin. */
export function resolveSiteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}


function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Cut at a word boundary where possible and drop trailing punctuation, so a
 * truncated description never ends mid-word or on a dangling comma.
 */
export function truncateText(value: string, max: number): string {
  const text = collapseWhitespace(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return trimmed.replace(/[\s,.;:!?-]+$/, "");
}

/**
 * Price in the product's OWN currency.
 *
 * `useCurrency().formatPrice` converts into whatever currency the visitor has
 * selected, which is exactly what makes it unusable here: a crawler would then
 * be shown a number that disagrees with `offers.priceCurrency`. Pricing in
 * structured data has to be the listing price, always. Locale is pinned to
 * `en-US` because `Intl.NumberFormat(undefined, ...)` would otherwise vary with
 * the machine running the build.
 */
function formatListingPrice(price: number, currency: string): string {
  const code = (currency || "NGN").toUpperCase();
  const noDecimals = NO_DECIMAL_CURRENCIES.indexOf(code) !== -1;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    }).format(price);
  } catch {
    // An unknown currency code throws instead of formatting. Falling back to
    // the raw amount keeps one bad row from failing the whole build.
    return `${code} ${price}`;
  }
}

/** 160-char summary for <meta name="description"> and the og:/twitter: tags. */
export function buildProductDescription(input: ProductSeoInput): string {
  const source = input.description ? collapseWhitespace(input.description) : "";
  const name = input.productName.trim() || "Product";
  const text =
    source ||
    `Buy ${name} for ${formatListingPrice(input.price, input.currency)} on Tradibu. ${FALLBACK_TRAIL}`;
  return truncateText(text, META_DESCRIPTION_MAX);
}

/**
 * schema.org/Product with Offer + AggregateRating.
 *
 * `offers` carrying price/priceCurrency/availability is what turns a blue link
 * into a price in the SERP, and `aggregateRating` is what turns it into stars.
 * Both are omitted when the underlying data is missing rather than emitted as
 * nulls - a malformed node loses the whole rich result.
 */
export function buildProductJsonLd(input: ProductSeoInput): Record<string, unknown> {
  const name = collapseWhitespace(input.productName) || "Product";
  const price = Number.isFinite(input.price) ? input.price : 0;
  // `description` falls back rather than being omitted: `useSEO` always writes a
  // top-level description, so leaving the key out here would let the generic one
  // survive the spread instead of this product-specific one.
  const description = input.description ? collapseWhitespace(input.description) : `Buy ${name} on Tradibu.`;
  const brand = input.brand ? collapseWhitespace(String(input.brand)) : "";
  const rating = typeof input.rating === "number" && Number.isFinite(input.rating) ? input.rating : 0;
  const reviewCount =
    typeof input.reviewCount === "number" && Number.isFinite(input.reviewCount) ? input.reviewCount : 0;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    sku: input.id,
    offers: {
      "@type": "Offer",
      url: input.url,
      priceCurrency: (input.currency || "NGN").toUpperCase(),
      // String with two decimals, and ratingValue a one-decimal string below:
      // both match what the client has been publishing, so an already-earned
      // rich result is not invalidated by the format changing.
      price: price.toFixed(2),
      availability: `https://schema.org/${input.availability || "InStock"}`,
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  if (input.image) schema.image = [resolveSiteUrl(input.image)];
  if (brand) schema.brand = { "@type": "Brand", name: brand };
  if (rating > 0 && reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.toFixed(1),
      reviewCount,
    };
  }

  return schema;
}

/**
 * The head-surgery primitives that used to live here - `escapeHtmlText`,
 * `escapeAttribute`, `escapeRegExp`, `insertBeforeHeadClose`, `replaceFirst`,
 * `setMeta`, `stripImagePreloads` - now live in `./htmlHead`, so the page head
 * writer in `./pageSeo` reuses them instead of re-deriving them. Their doc
 * comments moved with them, including the reasoning for stripping the hero
 * preloads.
 */

// `LANDING_PRELOAD_START` / `LANDING_PRELOAD_END` and `stripLandingPreloads`
// moved to `./htmlHead` and are re-exported at the top of this file.

/**
 * Rewrite the SPA shell's <head> so a product URL returns product-specific
 * HTML instead of the byte-identical homepage shell.
 *
 * The shell is served unchanged today, which is why `site:tradibu.com/product`
 * reports zero indexed URLs: title, description, canonical and structured data
 * are all the homepage's, so from a crawler's first pass every product URL is a
 * duplicate of `/`.
 *
 * Only the <head> is touched. Body content stays inside React, because
 * pre-seeding `#root` would be replaced on mount and cost the CLS score this
 * project currently passes.
 */
export function injectProductHead(html: string, input: ProductSeoInput): string {
  const title = buildProductTitle(input.productName);
  const description = buildProductDescription(input);
  let out = stripJsonLdByType(html, "Product");
  out = stripImagePreloads(out);
  out = stripLandingPreloads(out);

  out = setTitle(out, title);
  out = setMeta(out, "name", "description", description);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:url", input.url);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", description);

  if (input.image) {
    out = setMeta(out, "property", "og:image", input.image);
    out = setMeta(out, "name", "twitter:image", input.image);
    // The shell's og:image metadata describes og-image.jpg, not this product:
    // `width`/`height` still claim 1200x630 for an arbitrary product photo, and
    // `alt` still names the brand. A wrong declared ratio makes WhatsApp and
    // Facebook crop the shared preview to the wrong shape - most link previews
    // are opened on a phone, so this is the mobile-visible half of the job.
    // Dropping the dimensions lets the scraper measure the real file instead.
    out = removeMeta(out, "property", "og:image:width");
    out = removeMeta(out, "property", "og:image:height");
    out = setMeta(out, "property", "og:image:alt", title);
    out = setMeta(out, "name", "twitter:image:alt", title);
  }

  out = setCanonical(out, input.url);
  out = insertBeforeHeadClose(out, toHtmlJsonLd(buildProductJsonLd(input), PRODUCT_STRUCTURED_DATA_ID));
  return out;
}



