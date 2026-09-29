import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import {
  LEGAL_PAGES,
  MARKETPLACE_SEO,
  STATIC_PAGES,
  buildCollectionSeo,
  buildDepartmentSeo,
  buildLegalPageDescription,
  buildMarketplaceDescription,
  buildSellerSeo,
  canonicalUrlFor,
  injectPageHead,
  type PageSeoInput,
} from "../src/lib/pageSeo";
import { fetchRows, readSupabaseConfig, resolveSupabase, type ResolvedSupabase } from "./supabaseRest";

/**
 * Build-time <head> prerender for every public route that is not a product.
 *
 * `scripts/prerenderProductPages.ts` fixed this for `/product/<id>` and left the
 * rest of the site alone, which meant the rest of the site kept the defect it
 * was written to remove: one byte-identical `index.html` for `/marketplace`,
 * `/categories`, all 26 departments, the collections, the seller storefronts and
 * ten legal URLs, every one of them declaring the homepage as its canonical.
 * Google consolidated the lot into `/`, so a 27-URL sitemap described a
 * one-page site.
 *
 * The mechanism is the product prerenderer's, deliberately:
 *
 *  - Vercel routes `File System Routes -> Rewrites`, so a file in `dist/` wins
 *    over the catch-all rewrite and the response stays static - no function
 *    invocation, no extra TTFB.
 *  - Each file is written twice, as `<route>.html` (reached from the
 *    extensionless URL via `cleanUrls`) and as `<route>/index.html` (so the
 *    trailing-slash form resolves to the same head instead of falling through).
 *  - The <head> comes from `injectPageHead`, the same function `useSEO` mirrors
 *    at runtime, so the served document and the rendered document agree.
 *
 * No directory is cleared first, unlike the product pages. Vite empties `dist/`
 * on every build and these files are written next to each other under
 * `dist/categories/`, where a targeted `rm` would delete the other routes'
 * output as a side effect.
 *
 * Every failure degrades to today's behaviour rather than failing the build. A
 * page with the site-wide head is the status quo; a red build is a deploy that
 * never happened.
 */

interface SitePageRow {
  slug: string;
  title: string | null;
  body_markdown: string | null;
}

interface CategoryRow {
  slug: string;
  name: string;
}

interface CollectionRow {
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  description: string | null;
}

interface SellerRow {
  user_id: string;
  full_name: string | null;
}

interface StaticRoute {
  path: string;
  seo: PageSeoInput;
}

/**
 * Routes whose copy lives in code rather than in the database.
 *
 * `/marketplace` is stated here rather than in `STATIC_PAGES` because
 * `MarketplacePage` builds its own values from i18n at runtime; these are the
 * English defaults it resolves to, and `<html lang="en">` is what the shell
 * declares, so the static file and the default render agree. A visitor who has
 * chosen French still gets French copy after mount - they share the English
 * static head, which is correct for the canonical URL the document points at.
 */
function codeDefinedRoutes(): StaticRoute[] {
  const marketplace: StaticRoute = {
    path: "/marketplace",
    seo: {
      url: "/marketplace",
      title: MARKETPLACE_SEO.title,
      description: buildMarketplaceDescription(),
    },
  };
  return [
    marketplace,
    ...STATIC_PAGES.map((page) => ({
      path: page.path,
      seo: { url: page.path, title: page.title, description: page.description },
    })),
  ];
}

/**
 * The ten `DynamicPage` routes, filled in from `site_pages`.
 *
 * The canonical is `canonicalUrlFor(path)`, NOT the path itself, and that is the
 * whole point for the four aliases: `/faq` renders the About row, `/cookies`
 * renders the Privacy row, and `/seller-agreement` and `/prohibited-items` both
 * render the Terms row. Each of those bodies is byte-identical to the page it
 * aliases, so standing on its own feet would put four pairs of duplicate
 * documents into the index - the same defect as the homepage canonical, just
 * between two real pages.
 *
 * The title falls back the same way `DynamicPage` does (`row.title || fallback`),
 * so a page whose row is missing is not titled differently in the static file
 * than in the app.
 */
function legalRoutes(rows: SitePageRow[]): StaticRoute[] {
  const bySlug = new Map<string, SitePageRow>();
  for (const row of rows) bySlug.set(row.slug, row);

  return LEGAL_PAGES.map((page) => {
    const row = bySlug.get(page.slug);
    const stored = row && row.title ? row.title.trim() : "";
    return {
      path: page.path,
      seo: {
        url: canonicalUrlFor(page.path),
        title: stored || page.fallbackTitle,
        description: buildLegalPageDescription(page.fallbackTitle, row ? row.body_markdown : null),
      },
    };
  });
}

/**
 * A route path that can safely become a file below `dist`, or null.
 *
 * `path` comes from `App.tsx` for the code-defined routes but from a database
 * column for the other three, and a slug is data: `../../` in one would aim
 * `fs.writeFile` outside the build output, and an empty segment would collapse
 * `/a//b` onto `/a/b` without saying so. Refusing such a route costs it its own
 * <head>, which is the status quo; writing into the wrong directory is not.
 */
function safeRelativePath(routePath: string): string | null {
  const relative = routePath.replace(/^\/+/, "");
  if (!relative) return null;
  const segments = relative.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) return null;
  return relative;
}

/** Write a route's head to both resolutions Vercel can pick for it. */
async function writeRoute(dist: string, route: StaticRoute, shell: string): Promise<boolean> {
  const relative = safeRelativePath(route.path);
  if (!relative) {
    console.warn(`[prerender] Skipped unusable route path: ${route.path}`);
    return false;
  }

  const html = injectPageHead(shell, route.seo);
  const file = path.join(dist, `${relative}.html`);
  const directoryIndex = path.join(dist, relative, "index.html");
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.mkdir(path.dirname(directoryIndex), { recursive: true });
  await fs.writeFile(file, html, "utf8");
  await fs.writeFile(directoryIndex, html, "utf8");
  return true;
}

/**
 * One table's worth of routes, degrading to nothing instead of to everything.
 *
 * The product prerenderer wraps its single fetch in one try/catch, which is
 * exactly right for one call. There are four independent sources here, and if a
 * single rejected promise escaped into the caller's catch, a wrong column name
 * in the collections query would also cost `/terms`, `/about` and all 26
 * department pages their heads. Each one is therefore fenced on its own.
 */
async function attempt<T>(label: string, work: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch (error) {
    console.warn(`[prerender] ${label} unavailable:`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

async function departmentRoutes(supabase: ResolvedSupabase): Promise<StaticRoute[]> {
  // Every department, including the ones holding no stock today. An empty
  // department is a thin page, but a department that inherits the homepage's
  // canonical is a page Google will never show at all - and the catalogue is
  // seeded with 26 of them so it can scale.
  const rows = await fetchRows<CategoryRow>(supabase, "categories", "select=slug,name&order=sort_order");
  return rows
    .filter((row) => Boolean(row.slug && row.name))
    .map((row) => ({ path: `/categories/${row.slug}`, seo: buildDepartmentSeo({ slug: row.slug, name: row.name }) }));
}

async function collectionRoutes(supabase: ResolvedSupabase): Promise<StaticRoute[]> {
  const rows = await fetchRows<CollectionRow>(
    supabase,
    "marketplace_collections",
    "select=slug,title,meta_title,meta_description,description&status=eq.active",
  );
  return rows
    .filter((row) => Boolean(row.slug && row.title))
    .map((row) => ({
      path: `/collections/${row.slug}`,
      seo: buildCollectionSeo({
        slug: row.slug,
        title: row.title,
        metaTitle: row.meta_title,
        metaDescription: row.meta_description,
        description: row.description,
      }),
    }));
}

/**
 * Storefronts for sellers who actually have something to sell.
 *
 * A seller with no approved stock renders an empty shop, which is not worth
 * asking Google to index, and their storefront is only reachable from a product
 * page or a link they shared anyway. The id list comes from the live products
 * rather than from `profiles`, so it stays in step with what the site offers.
 */
async function sellerRoutes(supabase: ResolvedSupabase): Promise<StaticRoute[]> {
  const products = await fetchRows<{ seller_id: string | null }>(
    supabase,
    "products",
    "select=seller_id&status=eq.active&is_approved=eq.true",
  );
  const ids = [...new Set(products.map((row) => row.seller_id).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];

  const rows = await fetchRows<SellerRow>(
    supabase,
    "seller_profiles_public",
    `select=user_id,full_name&user_id=in.(${ids.join(",")})`,
  );
  return rows
    .filter((row) => Boolean(row.user_id))
    .map((row) => ({
      path: `/seller/${row.user_id}`,
      seo: buildSellerSeo({ id: row.user_id, storeName: (row.full_name || "").trim() || "Store" }),
    }));
}

/**
 * One file per path.
 *
 * Nothing in the sources above can collide today - the prefixes are distinct -
 * but two rows in one table CAN share a slug, and two writers on one path would
 * race: whichever landed last would decide the <head>, so the document served
 * would depend on network timing rather than on the data. The first source to
 * claim a path keeps it, and the collision is reported rather than swallowed.
 */
function dedupeByPath(routes: StaticRoute[]): StaticRoute[] {
  const byPath = new Map<string, StaticRoute>();
  for (const route of routes) {
    if (byPath.has(route.path)) {
      console.warn(`[prerender] ${route.path} was claimed twice; keeping the first.`);
      continue;
    }
    byPath.set(route.path, route);
  }
  return [...byPath.values()];
}

/** Columns read from `site_pages`, the table the ten `DynamicPage` routes render. */
const SITE_PAGES_QUERY = "select=slug,title,body_markdown";

/**
 * The public half of the site, in one pass.
 *
 * `dist/index.html` is read once and reused: every file written here is that
 * same shell with a different <head>, which is what keeps the SPA's mount
 * behaviour identical on all of them. Head surgery, not rendering - the body
 * stays inside React, because pre-seeding `#root` would be thrown away on mount
 * and cost the CLS score the project currently passes.
 */
async function prerender(root: string, mode: string): Promise<void> {
  const dist = path.join(root, "dist");
  let shell: string;
  try {
    shell = await fs.readFile(path.join(dist, "index.html"), "utf8");
  } catch {
    console.warn("[prerender] dist/index.html is missing; every page keeps the SPA shell.");
    return;
  }

  const supabase = resolveSupabase(readSupabaseConfig(mode, root));
  if (!supabase) {
    // Not fatal, and not the end of the run: the code-defined routes and the ten
    // legal pages carry copy that needs no database, and `legalRoutes([])` still
    // writes each of them from its fallback title. Only the routes whose
    // EXISTENCE is a row - departments, collections and storefronts - are lost,
    // and they fall back to the shell.
    console.warn(
      "[prerender] Supabase env unavailable; department, collection and storefront heads are skipped.",
    );
  }

  const [pages, departments, collections, sellers] = await Promise.all([
    supabase
      ? attempt("legal pages", () => fetchRows<SitePageRow>(supabase, "site_pages", SITE_PAGES_QUERY), [])
      : Promise.resolve<SitePageRow[]>([]),
    supabase ? attempt("departments", () => departmentRoutes(supabase), []) : Promise.resolve<StaticRoute[]>([]),
    supabase ? attempt("collections", () => collectionRoutes(supabase), []) : Promise.resolve<StaticRoute[]>([]),
    supabase ? attempt("storefronts", () => sellerRoutes(supabase), []) : Promise.resolve<StaticRoute[]>([]),
  ]);

  const codeAndLegal = [...codeDefinedRoutes(), ...legalRoutes(pages)];
  const routes = dedupeByPath([...codeAndLegal, ...departments, ...collections, ...sellers]);

  // One unwritable route must not cost the other forty their <head>, so each is
  // fenced on its own and the run continues. Two writers never interleave on one
  // file, because `dedupeByPath` already saw to that.
  let written = 0;
  for (const route of routes) {
    if (await attempt(`route ${route.path}`, () => writeRoute(dist, route, shell), false)) written += 1;
  }

  console.log(
    `[prerender] Wrote page <head> for ${written} route(s): ${codeAndLegal.length} code/legal, ` +
      `${departments.length} department(s), ${collections.length} collection(s), ${sellers.length} storefront(s).`,
  );
}

/** Vite plugin. `apply: "build"` keeps it out of `vite dev`. */
export function prerenderPublicPages(): Plugin {
  let mode = "production";
  let root = process.cwd();

  return {
    name: "tradibu:prerender-public-pages",
    apply: "build",
    configResolved(config) {
      mode = config.mode;
      root = config.root;
    },
    // `writeBundle` fires once the output is on disk, which is the first point at
    // which dist/index.html exists to be read. Both prerequisites hold by then:
    // Vite has written its own HTML, and - because Vite awaits plugins in
    // registration order - vite.config.ts has already run `preloadLandingRoute`
    // (whose landing-chunk hints this strips again for every route but `/`) and
    // `prerenderProductPages`.
    async writeBundle() {
      try {
        await prerender(root, mode);
      } catch (error) {
        console.warn(
          "[prerender] Failed; every page falls back to the SPA shell:",
          error instanceof Error ? error.message : error,
        );
      }
    },
  };
}
