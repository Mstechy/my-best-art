/**
 * Public product URLs are slug-first but remain backwards compatible with
 * the original UUID URLs.  The sitemap, feed, prerenderer, and browser all
 * use this helper so a listing has one discoverable canonical path.
 */
export interface ProductUrlInput {
  id: string;
  seo_slug?: string | null;
  seoSlug?: string | null;
}

export function normalizeProductSlug(value: string | null | undefined): string | null {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || null;
}

export function getProductSlug(product: ProductUrlInput): string | null {
  return normalizeProductSlug(product.seo_slug ?? product.seoSlug);
}

export function getProductPath(product: ProductUrlInput): string {
  return `/product/${encodeURIComponent(getProductSlug(product) || product.id)}`;
}

export function getProductUrl(product: ProductUrlInput, origin = "https://www.tradibu.com"): string {
  return new URL(getProductPath(product), origin).toString();
}
