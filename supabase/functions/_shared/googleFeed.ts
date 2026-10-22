/**
 * Google Shopping product feed (RSS 2.0 + `g:` namespace) builders, plus the
 * readiness checks the seller dashboard badge uses.
 *
 * One implementation, three consumers:
 *  - `supabase/functions/google-feed/index.ts` (Deno) writes the XML file,
 *  - seller product cards import `googleFeedIssues` for the Google badge,
 *  - Vitest exercises everything here directly (src/test/googleFeed.test.ts).
 *
 * Kept free of DOM and Node APIs (string in, string out), like `productSeo` /
 * `htmlHead`, so it type-checks under tsconfig.app.json (ES2020) AND the
 * edge-function typecheck, and unit-tests without a build. No `replaceAll`
 * and no `Array.prototype.at` - both newer than ES2020.
 */
function truncateText(value: string, max: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return trimmed.replace(/[\s,.;:!?-]+$/, "");
}

/** Canonical origin. Same constant productSeo.ts resolves against. */
export const FEED_SITE_URL = "https://www.tradibu.com";
export const FEED_CURRENCY = "NGN";

/** Google caps titles at 150 characters; longer values are disapproved. */
export const FEED_TITLE_MAX = 150;
/** Google caps descriptions at 5000 characters. */
export const FEED_DESCRIPTION_MAX = 5000;
/** At most 10 additional images per item, per the product data spec. */
export const FEED_MAX_ADDITIONAL_IMAGES = 10;

export interface FeedShippingSettings {
  /** ISO 3166-1 alpha-2, e.g. "NG". */
  country: string;
  method: string;
  /** Numeric amount. `null` omits the g:shipping block entirely. */
  price: number | string | null;
  currency?: string;
}

export interface FeedProduct {
  id: string;
  /** Stable SEO slug. The UUID remains the feed id; the public link is slug-first. */
  slug?: string | null;
  variantId?: string | null;
  itemGroupId?: string | null;
  color?: string | null;
  size?: string | null;
  googleProductCategory?: string | null;
  title: string;
  description?: string | null;
  /** Current selling price. Numeric or PostgREST numeric-as-string. */
  price: number | string;
  /** Struck-through original. When > price it becomes g:price and `price` becomes g:sale_price. */
  compare_at_price?: number | string | null;
  currency?: string | null;
  /** Product's OWN brand only; empty omits g:brand (admin set no fallbacks). */
  brand?: string | null;
  condition?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  stock_quantity?: number | string | null;
  /** Category path like "Electronics > Phones", joined by the caller. */
  product_type?: string | null;
  /** Primary image first, then display order. https URLs only. */
  images?: string[];
}

export interface FeedItemOptions {
  /** Omit (or leave price null) to emit no g:shipping block at all. */
  shipping?: FeedShippingSettings | null;
  /** Only set this when every item without its own brand is genuinely unbranded. */
  defaultBrand?: string | null;
}

/** Text-node / attribute escaping for XML content. `&` first, always. */
export function escapeXml(value: unknown): string {
  return String(value ?? "")
    // XML 1.0 rejects these control characters even after entity escaping.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Descriptions arrive as plain text or light HTML from the editor. Google wants
 * plain text: tags stripped, common entities decoded, whitespace collapsed.
 */
export function stripHtml(value?: string | null): string {
  if (!value) return "";
  let text = String(value).replace(/<[^>]*>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
  return text.replace(/\s+/g, " ").trim();
}


/**
 * Google's price format is `<amount>.<decimals> <CURRENCY>`, e.g.
 * `15000.00 NGN`. PostgREST returns numeric columns as strings, so everything
 * is coerced first. A non-finite amount degrades to `0.00 NGN` rather than
 * throwing: one bad row must never fail a whole feed run.
 */
export function formatFeedPrice(amount: number | string | null | undefined, currency?: string | null): string {
  const parsed = Number(amount);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  const code = (currency || FEED_CURRENCY).toUpperCase();
  return `${safe.toFixed(2)} ${code}`;
}

/** Google supports exactly new | used | refurbished for condition [condition]. */
export function normalizeFeedCondition(value?: string | null): "new" | "used" | "refurbished" {
  const raw = String(value ?? "").toLowerCase();
  if (raw.indexOf("refurb") !== -1) return "refurbished";
  if (raw.indexOf("used") !== -1 || raw.indexOf("second") !== -1) return "used";
  return "new";
}

/** Mirrors what the product page shows as buyable: stock above zero. */
export function feedAvailability(stock?: number | string | null): "in_stock" | "out_of_stock" {
  return Number(stock) > 0 ? "in_stock" : "out_of_stock";
}

export function isValidGtin(value: string): boolean {
  const digits = value.trim();
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(digits)) return false;
  const checkDigit = Number(digits[digits.length - 1]);
  let sum = 0;
  for (let index = digits.length - 2, position = 0; index >= 0; index--, position++) {
    sum += Number(digits[index]) * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

export const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

/** One `<item>`: the native RSS elements Google requires + the `g:` attributes. */
export function buildFeedItem(product: FeedProduct, options: FeedItemOptions = {}): string {
  const slug = String(product.slug || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const baseUrl = `${FEED_SITE_URL}/product/${encodeURIComponent(slug || product.id)}`;
  const url = product.variantId ? `${baseUrl}?variant=${encodeURIComponent(product.variantId)}` : baseUrl;
  const title = truncateText(stripHtml(product.title), FEED_TITLE_MAX) || "Product";
  const description = truncateText(stripHtml(product.description), FEED_DESCRIPTION_MAX) || title;

  const currentPrice = Number(product.price);
  const compareAt = Number(product.compare_at_price);
  // Marketplace semantics: `price` is what the buyer pays, `compare_at_price`
  // is the struck-through original. Google requires sale_price <= price, so
  // when a compare-at exists the original becomes g:price and the live price
  // becomes g:sale_price. That is what keeps feed price == product page price.
  const hasSale =
    Number.isFinite(compareAt) && Number.isFinite(currentPrice) && compareAt > currentPrice;
  const regularPrice = hasSale ? compareAt : Number.isFinite(currentPrice) ? currentPrice : 0;
  const salePrice = hasSale ? currentPrice : null;
  const currency = (product.currency || FEED_CURRENCY).toUpperCase();

  const images = (product.images || [])
    .map((src) => (typeof src === "string" ? src.trim() : ""))
    .filter((src) => src && isHttps(src));
  const primaryImage = images[0];
  const extraImages = images.slice(1);

  const lines: string[] = [
    "  <item>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(url)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    `    <g:id>${escapeXml(product.id)}</g:id>`,
    `    <g:title>${escapeXml(title)}</g:title>`,
    `    <g:description>${escapeXml(description)}</g:description>`,
    `    <g:link>${escapeXml(url)}</g:link>`,
  ];

  if (primaryImage) lines.push(`    <g:image_link>${escapeXml(primaryImage)}</g:image_link>`);
  for (const extra of extraImages.slice(0, FEED_MAX_ADDITIONAL_IMAGES)) {
    lines.push(`    <g:additional_image_link>${escapeXml(extra)}</g:additional_image_link>`);
  }

  lines.push(`    <g:price>${escapeXml(formatFeedPrice(regularPrice, currency))}</g:price>`);
  if (salePrice !== null) {
    lines.push(`    <g:sale_price>${escapeXml(formatFeedPrice(salePrice, currency))}</g:sale_price>`);
  }
  lines.push(`    <g:availability>${feedAvailability(product.stock_quantity)}</g:availability>`);
  lines.push(`    <g:condition>${normalizeFeedCondition(product.condition)}</g:condition>`);

  if (product.itemGroupId) lines.push(`    <g:item_group_id>${escapeXml(product.itemGroupId)}</g:item_group_id>`);
  if (product.color) lines.push(`    <g:color>${escapeXml(stripHtml(product.color))}</g:color>`);
  if (product.size) lines.push(`    <g:size>${escapeXml(stripHtml(product.size))}</g:size>`);

  const brand = stripHtml(product.brand) || stripHtml(options.defaultBrand);
  if (brand) lines.push(`    <g:brand>${escapeXml(brand)}</g:brand>`);

  const gtin = stripHtml(product.gtin);
  const mpn = stripHtml(product.mpn);
  if (gtin) lines.push(`    <g:gtin>${escapeXml(gtin)}</g:gtin>`);
  if (mpn) lines.push(`    <g:mpn>${escapeXml(mpn)}</g:mpn>`);
  if (!gtin && !mpn) lines.push("    <g:identifier_exists>false</g:identifier_exists>");

  const productType = stripHtml(product.product_type);
  if (productType) lines.push(`    <g:product_type>${escapeXml(productType)}</g:product_type>`);
  if (product.googleProductCategory) {
    lines.push(`    <g:google_product_category>${escapeXml(product.googleProductCategory)}</g:google_product_category>`);
  }

  const shipping = options.shipping;
  if (shipping && shipping.price !== null && shipping.price !== undefined && shipping.country) {
    const shippingPrice = formatFeedPrice(shipping.price, shipping.currency || FEED_CURRENCY);
    lines.push(
      "    <g:shipping>",
      `      <g:country>${escapeXml(shipping.country.toUpperCase())}</g:country>`,
      `      <g:service>${escapeXml(shipping.method || "Standard")}</g:service>`,
      `      <g:price>${escapeXml(shippingPrice)}</g:price>`,
      "    </g:shipping>",
    );
  }

  lines.push("  </item>");
  return lines.join("\n");
}

/** Full RSS 2.0 document wrapping pre-built items. */
export function buildFeedXml(items: readonly string[]): string {
  return [
    buildFeedXmlHeader(),
    items.join("\n"),
    items.length > 0 ? "\n" : "",
    buildFeedXmlFooter(),
  ].join("");
}

export function buildFeedXmlHeader(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    "  <channel>",
    "    <title>Tradibu - Google Shopping product feed</title>",
    `    <link>${FEED_SITE_URL}</link>`,
    "    <description>All live products from trusted Tradibu sellers.</description>",
    "",
  ].join("\n");
}

export function buildFeedXmlFooter(): string {
  return "  </channel>\n</rss>\n";
}

/**
 * Seller-eligibility rule used by the feed generator.
 *
 * Deliberately `is_approved && !is_banned && !is_frozen` and NOT `is_verified`:
 * `is_verified` is a display badge in this codebase while admin approval
 * (`is_approved`) is what actually gates selling, and the only seller carrying
 * live products has `is_verified = false` - requiring it would ship an empty
 * feed to Google. Flip it here if the platform later mandates the badge.
 */
export interface FeedSellerFlags {
  is_approved?: boolean | null;
  is_banned?: boolean | null;
  is_frozen?: boolean | null;
}

export function feedSellerEligible(seller: FeedSellerFlags | null | undefined): boolean {
  if (!seller) return false;
  return Boolean(seller.is_approved) && !seller.is_banned && !seller.is_frozen;
}

export interface FeedReadyInput {
  status: string;
  is_approved: boolean;
  sellerEligible?: boolean;
  price: number | string | null;
  imageCount: number;
  title?: string | null;
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  product_type?: string | null;
}

/**
 * Map the controlled marketplace category paths to Google's taxonomy for the
 * high-volume electronics types. Unknown paths are left to product_type rather
 * than guessing a potentially wrong Google category.
 */
export function googleProductCategory(productType?: string | null): string | null {
  const value = stripHtml(productType).toLowerCase();
  if (/\bmobile phones?\b|\bsmartphones?\b|\bcell phones?\b|\bphones?\b/.test(value)) {
    return "Electronics > Communications > Telephony > Mobile Phones";
  }
  if (/\blaptops?\b|\bnotebooks?\b/.test(value)) {
    return "Electronics > Computers > Laptops";
  }
  if (/\btablets?\b/.test(value)) {
    return "Electronics > Computers > Tablet Computers";
  }
  return null;
}

/**
 * Why a product cannot enter the feed - shown verbatim as the seller badge
 * tooltip. Product-level only: seller-level eligibility (banned/frozen/excluded)
 * lives in the generator's run report because a seller cannot fix it from the
 * listing form.
 */
export function googleFeedIssues(product: FeedReadyInput): string[] {
  const issues: string[] = [];
  if (product.sellerEligible === false) issues.push("Seller account is not approved to sell");
  if (product.status !== "active") {
    issues.push(product.status === "draft" ? "Not published yet (draft)" : "Not visible (archived)");
  }
  if (!product.is_approved) issues.push("Waiting for admin approval");
  if (!product.title || !product.title.trim()) issues.push("Add a title");
  if (!(Number(product.price) > 0)) issues.push("Set a price above zero");
  if (!product.imageCount) issues.push("Add at least one product image");

  // Electronics are normally manufactured goods. Google can match them much
  // better when the seller supplies the real brand plus GTIN, or brand plus
  // manufacturer part number when no GTIN exists. Do not apply this rule to
  // every category: handmade and custom products may legitimately have no UPI.
  const productType = String(product.product_type || "").toLowerCase();
  const manufacturedElectronics = /electronics|computer|mobile phone|laptop|tablet|camera|television|audio/.test(productType);
  if (manufacturedElectronics) {
    const brand = String(product.brand || "").trim();
    const gtin = String(product.gtin || "").trim();
    const mpn = String(product.mpn || "").trim();
    if (!brand) issues.push("Add the product brand");
    if (gtin && !isValidGtin(gtin)) issues.push("Fix the GTIN or remove it if the manufacturer did not assign one");
    if (!gtin && !mpn) issues.push("Add the manufacturer GTIN or MPN when available");
  }
  return issues;
}
