import fs from "node:fs/promises";
import path from "node:path";
import { loadEnv, type Plugin } from "vite";
import { injectProductHead, resolveSiteUrl, truncateText, type ProductSeoInput } from "../src/lib/productSeo";
import { injectStaticBody } from "../src/lib/prerenderBody";

/**
 * Build-time <head> prerender for product URLs.
 *
 * Vite's SPA serves one byte-identical index.html for every route, which is why
 * `site:tradibu.com/product` reports zero indexed URLs: on its first, HTML-only
 * pass a crawler sees the homepage's title, description, canonical and
 * structured data on all 15 product URLs and concludes they are duplicates of
 * `/`. React fills the real values in afterwards, but only for a crawler that
 * both runs JavaScript and chooses to.
 *
 * A per-product HTML file fixes that without SSR. Vercel's routing order is
 * `File System Routes -> Rewrites`, so a file in `dist/` wins over the
 * catch-all that rewrites everything to `index.html`, and the response stays
 * static - no function invocation, no extra TTFB on the route.
 *
 * Every failure here degrades to today's behaviour (the plain SPA shell) rather
 * than failing the build: a product page with a generic head is the status quo,
 * whereas a red build is a deployment that never happened.
 */

interface ProductImageRow {
  image_url: string | null;
  is_primary: boolean | null;
}

interface ProductRow {
  id: string;
  title: string;
  price: string | number;
  currency: string | null;
  description: string | null;
  meta_description: string | null;
  brand: string | null;
  stock_quantity: string | number | null;
  average_rating: string | number | null;
  review_count: string | number | null;
  product_images: ProductImageRow[] | null;
}

/**
 * `product_images` is embedded, so it must be named explicitly - Supabase
 * returns only the columns requested. The primary image is picked by the same
 * "primary, else first" rule ProductDetailPage uses.
 */
const SELECT_COLUMNS =
  "id,title,price,currency,description,meta_description,brand,stock_quantity,average_rating,review_count,product_images(image_url,is_primary)";

/**
 * The project ships `VITE_SUPABASE_ANON` in .env while earlier Vercel setups
 * used `VITE_SUPABASE_ANON_KEY`. Reading only one of them is what made
 * api/sitemap.js fail on some deploys, so every spelling is accepted here too.
 */
function readConfig(mode: string, root: string): { url?: string; key?: string } {
  const env = { ...loadEnv(mode, root, ""), ...process.env };
  return {
    url: env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    key: env.VITE_SUPABASE_ANON || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
  };
}

async function fetchProducts(url: string, key: string): Promise<ProductRow[]> {
  const query = `select=${encodeURIComponent(SELECT_COLUMNS)}&status=eq.active&is_approved=eq.true&order=updated_at.desc`;
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/products?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`Supabase responded ${response.status}`);
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? (rows as ProductRow[]) : [];
}

function pickImage(images: ProductImageRow[] | null): string | null {
  if (!images || images.length === 0) return null;
  const usable = images.filter((image) => image && image.image_url && image.image_url.trim());
  if (usable.length === 0) return null;
  const primary = usable.find((image) => image.is_primary);
  return (primary || usable[0]).image_url;
}

/** PostgREST returns numeric columns as strings; JSON-LD needs a real number. */
const toNumber = (value: string | number | null | undefined): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function prerender(root: string, mode: string): Promise<void> {
  const dist = path.join(root, "dist");
  const shell = await fs.readFile(path.join(dist, "index.html"), "utf8");

  const { url, key } = readConfig(mode, root);
  if (!url || !key) {
    console.warn("[prerender] Supabase env unavailable; product pages keep the SPA shell.");
    return;
  }

  const products = await fetchProducts(url, key);

  // Cleared first, so a product deactivated after the previous deploy stops
  // serving a stale copy instead of living on until the next full build.
  const outputRoot = path.join(dist, "product");
  await fs.rm(outputRoot, { recursive: true, force: true });

  for (const product of products) {
    const input: ProductSeoInput = {
      id: product.id,
      url: resolveSiteUrl(`/product/${product.id}`),
      productName: product.title,
      price: toNumber(product.price),
      currency: product.currency || "NGN",
      image: pickImage(product.product_images),
      description: product.meta_description || product.description,
      availability: toNumber(product.stock_quantity) > 0 ? "InStock" : "OutOfStock",
      rating: toNumber(product.average_rating),
      reviewCount: toNumber(product.review_count),
      brand: product.brand,
    };

    // Head first, then the static body (heading + paragraph + core link graph):
    // on its HTML-only pass a crawler sees a real product page instead of an
    // empty #root, and links onward to the rest of the site. React clears it on
    // its first commit - see src/lib/prerenderBody.ts.
    const html = injectStaticBody(injectProductHead(shell, input), {
      heading: product.title,
      description: input.description ? truncateText(input.description, 480) : null,
    });
    const directory = path.join(outputRoot, product.id);
    await fs.mkdir(directory, { recursive: true });
    // Written both ways round, because the two resolutions Vercel can pick are
    // not the same code path:
    //
    //  - `product/<id>.html`, reached from the canonical extensionless URL via
    //    `cleanUrls`. This is the one that matters: it is what the sitemap and
    //    every internal link point at.
    //  - `product/<id>/index.html`, the directory-index form, so `/product/<id>/`
    //    resolves too rather than falling through to the SPA shell.
    //
    // Both hold byte-identical HTML, so whichever wins returns the same head.
    // `cleanUrls` was chosen over a rewrite to `/product/:id/index.html` on
    // purpose: if a build ever fails to fetch products, the .html file simply is
    // absent and the request falls through to the catch-all rewrite and serves
    // today's shell - whereas a rewrite to a missing file is a hard 404.
    //
    // That fallback only exists while the catch-all is reachable at all, which
    // it was not: `cleanUrls` strips `.html` from rewrite DESTINATIONS too, so
    // aiming it at `/index.html` resolved to nothing and Vercel returned its
    // plain-text platform 404 for every unrouted path. The destination is
    // `/index`, and src/test/vercelRouting.test.ts fails if that regresses.
    await fs.writeFile(path.join(directory, "index.html"), html, "utf8");
    await fs.writeFile(path.join(outputRoot, `${product.id}.html`), html, "utf8");
  }

  console.log(`[prerender] Wrote product <head> for ${products.length} product(s).`);
}

/** Vite plugin. `apply: "build"` keeps it out of `vite dev`. */
export function prerenderProductPages(): Plugin {
  let mode = "production";
  let root = process.cwd();

  return {
    name: "tradibu:prerender-product-pages",
    apply: "build",
    configResolved(config) {
      mode = config.mode;
      root = config.root;
    },
    // `writeBundle` fires once the output files are on disk, which is the first
    // point at which dist/index.html exists to be read.
    async writeBundle() {
      try {
        await prerender(root, mode);
      } catch (error) {
        console.warn(
          "[prerender] Failed; product pages fall back to the SPA shell:",
          error instanceof Error ? error.message : error,
        );
      }
    },
  };
}

