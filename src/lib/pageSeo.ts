/**
 * Page SEO policy for every public route that is NOT a product.
 *
 * The defect this module exists to kill: `index.html` shipped one hardcoded
 * canonical, `https://www.tradibu.com/`, and Vite serves that one file for every
 * route it does not have a prerendered copy of. So `/marketplace`, `/categories`,
 * every department, every legal page and every junk URL all told Google "the
 * real version of me is the homepage", and Google consolidated the lot into `/`.
 * A site with 26 departments had a crawlable surface of one page.
 *
 * The registry below is the single source of truth for what each route declares,
 * and it feeds BOTH writers:
 *
 *  - `scripts/prerenderPublicPages.ts` writes one static HTML file per route at
 *    build time, which is what a crawler reads on its first, HTML-only pass.
 *  - `useSEO` (src/hooks/useSEO.ts) publishes the same values once React mounts,
 *    which is what a crawler reads after executing JavaScript and what an SPA
 *    navigation ends up with.
 *
 * Two writers, one set of values. If they disagree, the served page and the
 * rendered page describe different documents, which is the same class of bug as
 * the missing canonical - just quieter.
 *
 * Kept free of DOM and Node APIs, like `./productSeo`, so it type-checks under
 * BOTH tsconfig.app.json (lib: ES2020 + DOM) and tsconfig.node.json (lib:
 * ES2023, strict). No `replaceAll`, no `Array.prototype.at`.
 */
import { setCanonical, setMeta, setTitle, stripImagePreloads, stripLandingPreloads } from "./htmlHead";
import { META_DESCRIPTION_MAX, buildPageTitle, resolveSiteUrl, truncateText } from "./productSeo";

/**
 * Homepage copy.
 *
 * `LandingPage` renders these exact strings through `useSEO`, and `index.html`
 * declares the same ones in its static <head>, so the shell and the rendered
 * page cannot disagree about what `/` is. src/test/pageSeoHead.test.ts fails if
 * index.html drifts from this constant.
 */
export const HOME_PAGE_SEO = {
  title: "Online Marketplace for Trusted Shopping",
  description:
    "Shop on Tradibu, the online marketplace for products from independent sellers. Discover great deals with secure payments and buyer protection.",
};

/**
 * Marketplace copy, mirroring `src/lib/i18n/locales/en.json`.
 *
 * English is what gets prerendered because `<html lang="en">` is what the shell
 * declares, so the static file and the default rendering must agree. A visitor
 * who has chosen French still gets French from `t()` after mount; they just
 * share the English static head, which is correct for the English canonical URL
 * the document points at.
 *
 * The test asserts these match en.json, so translation edits cannot leave the
 * served HTML behind. `{{category}}` is i18next's placeholder, kept verbatim.
 */
export const MARKETPLACE_SEO = {
  title: "Marketplace",
  description: "Discover products from verified sellers worldwide",
};

export const CATEGORY_DESCRIPTION_TEMPLATE =
  "Explore {{category}} from verified sellers. Filter, compare, and keep discovering.";

/** i18next's default `{{var}}` interpolation, reproduced so the build matches. */
function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match: string, key: string) => {
    const value = vars[key];
    return value === undefined ? match : value;
  });
}

/** Description for a department page, exactly as `MarketplacePage` renders it. */
export function buildCategoryDescription(categoryName: string): string {
  return interpolateTemplate(CATEGORY_DESCRIPTION_TEMPLATE, { category: categoryName });
}

/** The marketplace itself, for when no department is selected. */
export function buildMarketplaceDescription(): string {
  return MARKETPLACE_SEO.description;
}

export interface PageSeoInput {
  /** Canonical URL of this page: absolute, or a path resolved against the origin. */
  url: string;
  title: string;
  description: string;
}

export interface StaticPageSeo {
  /** Route path exactly as App.tsx declares it, no trailing slash. */
  path: string;
  title: string;
  description: string;
  /**
   * Set only when this path is an alias: the path whose URL is the canonical
   * one. `/faq` is not a page of its own, it is the About content reachable by a
   * second name, so it must not compete with `/about` in the index.
   */
  canonicalPath?: string;
}

/**
 * Copy for `/categories`, matching the page's own H1.
 */
export const CATEGORIES_PAGE_SEO = {
  title: "Find products by department",
  description:
    "Browse every marketplace department from verified sellers. Filter by brand, size, condition, price and delivery destination.",
};

/** Copy for `/contact`, matching the page's own H1 and subtitle. */
export const CONTACT_PAGE_SEO = {
  title: "Contact Tradibu",
  description:
    "Reach Tradibu support, privacy and legal teams about orders, disputes, data requests or anything else about using the platform.",
};

/**
 * Pages whose copy is static: it does not come from the database, so the same
 * strings can be prerendered and rendered.
 *
 * `/marketplace` is absent on purpose - `MarketplacePage` already publishes
 * itself, including per-department titles, and the prerenderer covers it from
 * the same builders. `/` is absent because the shell IS the homepage file: it is
 * the one route whose static head was already correct.
 */
export const STATIC_PAGES: StaticPageSeo[] = [
  { path: "/categories", ...CATEGORIES_PAGE_SEO },
  { path: "/contact", ...CONTACT_PAGE_SEO },
];

export interface LegalPageSeo {
  path: string;
  /** Row in `site_pages` that supplies the title and body. */
  slug: string;
  /** Used when the row is missing or its title is empty. */
  fallbackTitle: string;
  canonicalPath?: string;
}

/**
 * Every route rendered by `DynamicPage`, keyed by the slug its row lives under.
 *
 * Four of these are aliases, and saying so is the point:
 *
 *  - `/faq` renders the About row. `/cookies` renders the Privacy row.
 *    `/seller-agreement` and `/prohibited-items` both render the Terms row.
 *
 * Their bodies are therefore byte-identical to the page they alias, so treating
 * them as pages of their own would create four pairs of duplicates that Google
 * has to resolve - the exact problem this module exists to remove, only with
 * better manners. Pointing each alias's canonical at the real page consolidates
 * the pair honestly, and the test that walks `App.tsx` keeps this list honest
 * against the props the wrapper components actually pass.
 *
 * `slug` and `fallbackTitle` deliberately duplicate what AboutPage, TermsPage and
 * friends pass to `DynamicPage`: that keeps the wrapper components one line
 * each, and src/test/pageSeoHead.test.ts asserts the two agree rather than
 * trusting them to.
 */
export const LEGAL_PAGES: LegalPageSeo[] = [
  { path: "/about", slug: "about", fallbackTitle: "About Tradibu" },
  { path: "/faq", slug: "about", fallbackTitle: "About Tradibu", canonicalPath: "/about" },
  { path: "/terms", slug: "terms", fallbackTitle: "Terms of Service" },
  { path: "/seller-agreement", slug: "terms", fallbackTitle: "Terms of Service", canonicalPath: "/terms" },
  { path: "/prohibited-items", slug: "terms", fallbackTitle: "Terms of Service", canonicalPath: "/terms" },
  { path: "/privacy", slug: "privacy", fallbackTitle: "Privacy Policy" },
  { path: "/cookies", slug: "privacy", fallbackTitle: "Privacy Policy", canonicalPath: "/privacy" },
  { path: "/refund-policy", slug: "refund", fallbackTitle: "Refund & Return Policy" },
  { path: "/shipping", slug: "shipping", fallbackTitle: "Shipping Policy" },
  { path: "/payment", slug: "payment", fallbackTitle: "Payment Policy" },
];

/**
 * Strip a query string, a fragment and a trailing slash.
 *
 * `location.pathname` never carries a query, but a canonical path taken from
 * configuration or a sitemap might, and `/about/` and `/about` have to resolve to
 * the same entry or the alias lookup silently misses.
 */
export function normalizePath(path: string): string {
  const cut = path.split(/[?#]/)[0];
  if (cut.length > 1 && cut.endsWith("/")) return cut.slice(0, -1);
  return cut.length > 0 ? cut : "/";
}

export function findStaticPage(path: string): StaticPageSeo | undefined {
  const wanted = normalizePath(path);
  return STATIC_PAGES.find((page) => page.path === wanted);
}

export function findLegalPage(path: string): LegalPageSeo | undefined {
  const wanted = normalizePath(path);
  return LEGAL_PAGES.find((page) => page.path === wanted);
}

/**
 * The path whose URL is canonical for `path`.
 *
 * Identity for every normal route, and the primary page for an alias. This is
 * what makes `/faq` stop competing with `/about` while still serving a working
 * page to anyone who has the link.
 */
export function canonicalPathFor(path: string): string {
  const normalized = normalizePath(path);
  const entry = findStaticPage(normalized) || findLegalPage(normalized);
  return entry && entry.canonicalPath ? entry.canonicalPath : normalized;
}

/** Absolute canonical URL for a route path. */
export function canonicalUrlFor(path: string): string {
  return resolveSiteUrl(canonicalPathFor(path));
}

export function isHomePath(path: string): boolean {
  return normalizePath(path) === "/";
}

/**
 * Fallback meta description for a legal page whose body we cannot read.
 *
 * Derived from the title rather than stored per page so the four alias routes
 * inherit it automatically and cannot drift from the page they alias.
 */
export function legalFallbackDescription(fallbackTitle: string): string {
  return `${fallbackTitle} from Tradibu, the marketplace with verified sellers, secure Paystack payments, buyer protection and global delivery.`;
}

/**
 * Turn markdown into a single line of prose.
 *
 * `DynamicPage` renders its body as markdown and `site_pages` rows open with a
 * heading and contain list items and links. Without this, `## Terms of Service`
 * becomes a meta description starting with "## Terms", which is what a crawler
 * would then show as the snippet. Image and link markup is dropped but link TEXT
 * is kept, because that text is usually the sentence.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/\*\*|__|~~/g, "")
    .replace(/(^|\s)[*_](\S)/g, "$1$2")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize a description and hold it to the SERP limit. */
export function buildPageDescription(source: string | null | undefined, fallback: string): string {
  const text = source ? stripMarkdown(source) : "";
  return truncateText(text || fallback, META_DESCRIPTION_MAX);
}

/** Description for a `DynamicPage` route, from its row body where there is one. */
export function buildLegalPageDescription(fallbackTitle: string, body: string | null | undefined): string {
  return buildPageDescription(body, legalFallbackDescription(fallbackTitle));
}

/**
 * Department page: `/categories/<slug>`.
 *
 * `MarketplacePage` computes these itself from the selected department, and this
 * reproduces its rule exactly - the department name as the title, the same
 * "Explore X from verified sellers..." line as the description - so the
 * prerendered file for `/categories/electronics` and the page a visitor sees
 * after React mounts are the same document.
 */
export function buildDepartmentSeo(input: { slug: string; name: string }): PageSeoInput {
  return {
    url: `/categories/${encodeURIComponent(input.slug)}`,
    title: input.name,
    description: buildCategoryDescription(input.name),
  };
}

/**
 * Collection page: `/collections/<slug>`.
 *
 * Replaces the hand-rolled block that used to set `document.title` here: it
 * published `${title} - Tradibu` with an em-dash while every other page used
 * `buildPageTitle`'s ` | `, and it reached into the DOM to patch the description
 * instead of declaring one. Both now come from one builder that the prerenderer
 * also calls.
 */
export function buildCollectionSeo(input: {
  slug: string;
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  description?: string | null;
}): PageSeoInput {
  const title = (input.metaTitle && input.metaTitle.trim()) || input.title;
  return {
    url: `/collections/${encodeURIComponent(input.slug)}`,
    title,
    description: buildPageDescription(
      input.metaDescription || input.description,
      `Browse the ${input.title} collection on Tradibu - curated products from verified sellers with secure payments and buyer protection.`,
    ),
  };
}

/**
 * Seller storefront: `/seller/<id>`.
 *
 * Deliberately built from the store name alone. Mentioning the seller's bio or
 * their live product count would look richer, but both change without a deploy,
 * so the static file written at build time and the page rendered at visit time
 * would start to disagree the moment a seller edits their store - which is the
 * drift this whole arrangement exists to prevent.
 */
export function buildSellerSeo(input: { id: string; storeName: string }): PageSeoInput {
  return {
    url: `/seller/${encodeURIComponent(input.id)}`,
    title: input.storeName,
    description: buildPageDescription(
      null,
      `Shop ${input.storeName} on Tradibu - verified seller with buyer protection, secure Paystack payments and fast global delivery.`,
    ),
  };
}

/**
 * Rewrite the SPA shell's <head> so a non-product route returns its own
 * document instead of the homepage's.
 *
 * This is the page counterpart of `injectProductHead`, reusing the same
 * primitives from `./htmlHead`, so both writers produce the same markup from the
 * same instruction.
 *
 * No structured data is added or removed here. The shell's WebSite/Organization
 * `@graph` is site-level and correct on every page, and a page-specific node
 * would be inventing evidence this function does not have: a department page has
 * no offer, no rating and no dates to declare.
 *
 * The homepage-only hints - the hero image preload and the landing route's
 * modulepreload block - are stripped on every path except `/`, for the reasons
 * documented on `stripImagePreloads` and `stripLandingPreloads`. The guard is
 * here rather than at the call site so that calling this for `/` cannot silently
 * drop the homepage's LCP preload.
 */
export function injectPageHead(html: string, input: PageSeoInput): string {
  const title = buildPageTitle(input.title);
  // Resolved against the canonical origin once, so a relative `url` is accepted
  // and every tag below publishes the same absolute URL. `useSEO` writes an
  // absolute canonical and an absolute `og:url` after mount, so a relative one
  // here would put two descriptions of one page into circulation - and the Open
  // Graph protocol requires `og:url` to be absolute in any case.
  const absoluteUrl = new URL(input.url, resolveSiteUrl("/")).toString();
  // The homepage check below compares a path, so `/` and the full origin agree.
  const pathname = normalizePath(new URL(absoluteUrl).pathname);

  let out = html;
  if (!isHomePath(pathname)) {
    out = stripImagePreloads(out);
    out = stripLandingPreloads(out);
  }

  out = setTitle(out, title);
  out = setMeta(out, "name", "description", input.description);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", input.description);
  out = setMeta(out, "property", "og:url", absoluteUrl);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", input.description);
  out = setCanonical(out, absoluteUrl);
  return out;
}
