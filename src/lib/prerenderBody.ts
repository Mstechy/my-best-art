/**
 * Static <body> content for prerendered pages.
 *
 * The prerenderers fix <head> but leave <body> as an empty
 * `<div id="root"></div>`, which made every prerendered document a head plus
 * nothing: no <h1>, no copy, and - the reason Google never discovered the
 * deeper pages - no links. A crawler on its first, HTML-only pass could see
 * the homepage's shell (which linked only to marketplace query-string URLs),
 * the sitemaps, and then a dead end: /categories linked to nothing, /terms
 * linked to nothing, and the department and legal URLs sat behind JavaScript
 * that first-pass crawlers do not run. ~130 pages returned 200 with perfect
 * heads and an empty body, and Search Console counted two indexed pages.
 *
 * `injectStaticBody` fills the empty mount with a minimal document - heading,
 * one paragraph, one nav of links - before React boots. React 18's
 * `clearContainer()` wipes it in the same commit that inserts the real page,
 * the same mechanism the first-paint shell uses on `/`: removed nodes do not
 * shift, so the swap costs no CLS while the static copy gives crawlers a link
 * graph and visitors readable content at first paint.
 *
 * Deliberately inline-styled rather than Tailwind-classed: the markup must be
 * readable even if the stylesheet never loads, and it exists for about a second
 * per visit anyway.
 *
 * Kept free of DOM and Node APIs (string in, string out) like `pageSeo` /
 * `productSeo`, so it type-checks under BOTH tsconfigs and unit-tests without
 * a build. `scripts/prerenderPublicPages.ts` and `scripts/prerenderProductPages.ts`
 * are its callers.
 */

export interface StaticBodyLink {
  href: string;
  label: string;
}

/**
 * Pages every prerendered document links to: the canonical set in
 * public/sitemap-pages.xml plus `/`. src/test/prerenderBody.test.ts fails if a
 * core link drifts off a URL that sitemap actually submits, so the link graph
 * and the submitted index cannot disagree.
 */
export const CORE_NAV_LINKS: StaticBodyLink[] = [
  { href: "/", label: "Home" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/categories", label: "Categories" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/shipping", label: "Shipping" },
  { href: "/payment", label: "Payment" },
  { href: "/refund-policy", label: "Refund & return policy" },
];

/** Escape for text nodes and attribute values alike. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface StaticBodyOptions {
  /** Page heading: the same raw string the route uses as its <title> base. */
  heading: string;
  /** One paragraph - the route's meta description where there is one. */
  description?: string | null;
  /** Route-specific links appended to (and de-duplicated against) the core nav. */
  links?: StaticBodyLink[];
}

/**
 * What `stripHomeShell` (public routes) and `injectProductHead` (products)
 * leave behind: nothing at all. Matching this exact marker is also what makes
 * the injection idempotent - a second pass sees a non-empty root and no-ops -
 * and what keeps the homepage's first-paint shell untouched: its root holds
 * the shell markup, not the empty marker.
 */
const EMPTY_ROOT = '<div id="root"></div>';

export function injectStaticBody(html: string, options: StaticBodyOptions): string {
  if (!html.includes(EMPTY_ROOT)) return html;

  const seen = new Set<string>();
  const links = [...CORE_NAV_LINKS, ...(options.links ?? [])].filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
  const items = links
    .map((link) => `            <li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join("\n");
  const description = options.description
    ? `\n        <p>${escapeHtml(options.description)}</p>`
    : "";
  const body = [
    '<div id="static-prerendered">',
    '      <main style="max-width:48rem;margin:0 auto;padding:2.5rem 1rem;line-height:1.6">',
    `        <h1 style="margin:0 0 0.75rem;font-size:clamp(1.5rem,4vw,2.25rem);line-height:1.2;font-weight:800;letter-spacing:-0.02em">${escapeHtml(options.heading)}</h1>${description}`,
    '        <nav aria-label="Site links" style="border-top:1px solid #E8E8E8;padding-top:1.25rem">',
    '          <ul style="display:flex;flex-wrap:wrap;gap:0.5rem 1.25rem;margin:0;padding:0;list-style:none">',
    items,
    "          </ul>",
    "        </nav>",
    "      </main>",
    "    </div>",
  ].join("\n");
  // Function replacement so a `$&`-looking sequence in a heading can never be
  // reinterpreted as a replacement pattern.
  return html.replace(EMPTY_ROOT, () => `<div id="root">${body}</div>`);
}