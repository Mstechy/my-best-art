import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CATEGORIES_PAGE_SEO,
  CATEGORY_DESCRIPTION_TEMPLATE,
  CONTACT_PAGE_SEO,
  HOME_PAGE_SEO,
  LEGAL_PAGES,
  MARKETPLACE_SEO,
  STATIC_PAGES,
  buildCollectionSeo,
  buildDepartmentSeo,
  buildLegalPageDescription,
  buildMarketplaceDescription,
  buildSellerSeo,
  canonicalPathFor,
  canonicalUrlFor,
  injectPageHead,
  normalizePath,
} from "@/lib/pageSeo";
import { HOME_SHELL_START } from "@/lib/htmlHead";
import {
  buildPageTitle,
  LANDING_PRELOAD_END,
  LANDING_PRELOAD_START,
  META_DESCRIPTION_MAX,
} from "@/lib/productSeo";

/**
 * The page-head contract for every public route that is not a product.
 *
 * The defect: index.html shipped one hardcoded canonical - the homepage - and
 * Vite serves that single file for every route without a prerendered copy, so
 * /marketplace, /categories, all 26 departments, ten legal URLs and every junk
 * URL told Google that the real version of them was `/`. Google believed it, and
 * consolidated a 27-URL site into one page.
 *
 * Two writers now publish these values - the build-time prerenderer
 * (scripts/prerenderPublicPages.ts) and `useSEO` after React mounts - and both are
 * fed by src/lib/pageSeo.ts. This file is what stops the three drifting apart.
 *
 * Everything below reads the real files rather than a fixture standing in for
 * them: a test built on its own copy of index.html passes happily while the
 * shipped document says something else, which is how the original defect lasted.
 */
const read = (relative: string): string => readFileSync(path.join(process.cwd(), relative), "utf8");

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

/** Value of a <meta>, whichever of name/property names it. */
function metaContent(html: string, key: string): string | undefined {
  return new RegExp(`<meta\\s+(?:name|property)="${key}"\\s+content="([^"]*)"`).exec(html)?.[1];
}

/** The one HTML document Vite, Vercel and every crawler start from. */
const shell = read("index.html");

/**
 * The shell as a browser actually receives it: `scripts/preloadLandingRoute.ts`
 * injects the lazy landing route's chunk hints between two markers at build time,
 * and Vite puts the entry's own modulepreload beside them. Both are exercised
 * here, because `injectPageHead` has to remove exactly one of the two.
 */
const builtShell = shell.replace(
  "</head>",
  `<link rel="modulepreload" crossorigin href="/assets/index-ENTRY.js">
    ${LANDING_PRELOAD_START}
    <link rel="modulepreload" crossorigin href="/assets/LandingPage-ROUTE.js">
    ${LANDING_PRELOAD_END}
  </head>`,
);

const MARKETPLACE_PAGE = {
  url: "/marketplace",
  title: MARKETPLACE_SEO.title,
  description: buildMarketplaceDescription(),
};

const marketplacePage = injectPageHead(builtShell, MARKETPLACE_PAGE);

describe("the homepage shell", () => {
  // `/` is the one route whose static head was already right, and the one route
  // the prerenderer must not touch. The constant, the shell and the render are
  // three places these two strings could drift apart.
  it("says exactly what LandingPage publishes once React mounts", () => {
    expect(/<title>([\s\S]*?)<\/title>/.exec(shell)?.[1]).toBe(buildPageTitle(HOME_PAGE_SEO.title));
    expect(metaContent(shell, "description")).toBe(HOME_PAGE_SEO.description);
  });

  it("publishes the same title and description in its social tags", () => {
    // Most shares of this site are link previews built from these tags rather than
    // from the human-readable ones above them.
    const title = buildPageTitle(HOME_PAGE_SEO.title);
    expect(metaContent(shell, "og:title")).toBe(title);
    expect(metaContent(shell, "twitter:title")).toBe(title);
    expect(metaContent(shell, "og:description")).toBe(HOME_PAGE_SEO.description);
    expect(metaContent(shell, "twitter:description")).toBe(HOME_PAGE_SEO.description);
  });

  it("points its canonical at the origin, the way the registry resolves it", () => {
    expect(/<link\s+rel="canonical"\s+href="([^"]*)"/.exec(shell)?.[1]).toBe(canonicalUrlFor("/"));
    expect(canonicalUrlFor("/")).toBe("https://www.tradibu.com/");
  });
});

const appSource = read("src/App.tsx");

/** Component name -> module specifier, for every lazy page App.tsx can render. */
const lazyModules = new Map<string, string>();
for (const match of appSource.matchAll(/const\s+(\w+)\s*=\s*lazy\(\(\)\s*=>\s*import\("([^"]+)"\)\)/g)) {
  lazyModules.set(match[1], match[2]);
}

/** The one line of App.tsx that declares `routePath`. */
function routeLine(routePath: string): string | undefined {
  return appSource.split("\n").find((line) => line.includes(`<Route path="${routePath}"`));
}

/** The lazy component that line renders, if any. */
function renderedComponent(routePath: string): string | undefined {
  const line = routeLine(routePath);
  if (!line) return undefined;
  return [...lazyModules.keys()].find((name) => new RegExp(`<${name}\\b`).test(line));
}

/** Read the component a wrapper route forwards its props to. */
function componentSource(component: string): string {
  const specifier = lazyModules.get(component);
  if (!specifier) throw new Error(`App.tsx does not lazy-import ${component}`);
  return read(path.join("src", `${specifier.replace("@/", "")}.tsx`));
}

describe("the registry against the app it describes", () => {
  it("routes every path it claims", () => {
    const declared = [...STATIC_PAGES.map((page) => page.path), ...LEGAL_PAGES.map((page) => page.path)];
    for (const routePath of declared) {
      expect(routeLine(routePath), `App.tsx declares no route for ${routePath}`).toBeDefined();
    }
  });

  it("passes each legal page the slug and fallback title the registry declares", () => {
    // AboutPage, TermsPage and the rest are one-liners forwarding two props to
    // DynamicPage. The registry duplicates those two values so the build can
    // prerender a page nobody has opened; this is what keeps the duplicate honest
    // when a wrapper is edited.
    for (const page of LEGAL_PAGES) {
      const component = renderedComponent(page.path);
      expect(component, `App.tsx renders nothing for ${page.path}`).toBeDefined();
      const source = componentSource(component as string);
      expect(source, `${component} must pass slug="${page.slug}"`).toContain(`slug="${page.slug}"`);
      expect(source, `${component} must pass fallbackTitle="${page.fallbackTitle}"`).toContain(
        `fallbackTitle="${page.fallbackTitle}"`,
      );
    }
  });

  it("renders an alias with the same component as the page it calls canonical", () => {
    // An alias renders the same row, so the two documents differ only in their
    // head. If they ever render different rows the canonical points at a page that
    // does not exist, which is worse than having no canonical at all.
    const aliases = LEGAL_PAGES.filter((page) => page.canonicalPath);
    // Sorted before comparing so declaration order in LEGAL_PAGES is not a
    // constraint, and pinned rather than read back out of the registry so that
    // dropping an alias fails here instead of silently redefining the contract.
    expect(aliases.map((page) => `${page.path}->${page.canonicalPath}`).sort()).toEqual([
      "/cookies->/privacy",
      "/faq->/about",
      "/prohibited-items->/terms",
      "/seller-agreement->/terms",
    ]);

    for (const alias of aliases) {
      expect(
        renderedComponent(alias.path),
        `${alias.path} must render what ${alias.canonicalPath} renders`,
      ).toBe(renderedComponent(canonicalPathFor(alias.path)));
    }
  });

  it("never chains a canonical onto another canonical", () => {
    for (const page of LEGAL_PAGES) {
      const canonical = canonicalPathFor(page.path);
      expect(canonicalUrlFor(page.path)).toBe(`https://www.tradibu.com${canonical}`);
      // Idempotent: following the alias twice lands in the same place.
      expect(canonicalUrlFor(canonical)).toBe(canonicalUrlFor(page.path));
    }
  });

  it("leaves a route with no canonical override its own URL", () => {
    for (const routePath of ["/", "/marketplace", "/categories", "/contact", "/terms", "/collections/summer"]) {
      expect(canonicalPathFor(routePath)).toBe(normalizePath(routePath));
    }
    // A trailing slash or a campaign parameter is the same page, not a new one.
    expect(canonicalPathFor("/about/?utm_source=newsletter")).toBe("/about");
    expect(normalizePath("/collections/summer/")).toBe("/collections/summer");
  });

  it("keeps the marketplace copy in step with the translations it is prerendered from", () => {
    // MarketplacePage renders t("marketplace.*") at runtime while the prerenderer
    // can only render constants. They describe one document, so they have to be the
    // same words in English - which is the language <html lang="en"> declares.
    const en = JSON.parse(read("src/lib/i18n/locales/en.json").replace(/^\uFEFF/, "")) as {
      marketplace: Record<string, string>;
    };
    expect(MARKETPLACE_SEO.title).toBe(en.marketplace.title);
    expect(MARKETPLACE_SEO.description).toBe(en.marketplace.defaultDescription);
    expect(CATEGORY_DESCRIPTION_TEMPLATE).toBe(en.marketplace.categoryDescription);
  });

  it("holds every description that is not run through the truncator to the SERP cap", () => {
    // The builders truncate. The constants are typed by hand and reach the head
    // unfiltered, so nothing else would catch one growing past the point where
    // Google rewrites it.
    const descriptions: [string, string][] = [
      ["home", HOME_PAGE_SEO.description],
      ["marketplace", buildMarketplaceDescription()],
      ["categories", CATEGORIES_PAGE_SEO.description],
      ["contact", CONTACT_PAGE_SEO.description],
      ["department", buildDepartmentSeo({ slug: "electronics", name: "Electronics" }).description],
      ["collection", buildCollectionSeo({ slug: "summer", title: "Summer" }).description],
      ["seller", buildSellerSeo({ id: "u1", storeName: "Ada Stores" }).description],
      ["legal", buildLegalPageDescription("Terms of Service", null)],
    ];
    for (const [label, description] of descriptions) {
      expect(description.length, `${label} description is empty`).toBeGreaterThan(0);
      expect(description.length, `${label} description is longer than the SERP cap`).toBeLessThanOrEqual(
        META_DESCRIPTION_MAX,
      );
    }
  });
});

describe("injectPageHead", () => {
  it("rewrites the title, the description, the canonical and the social tags", () => {
    expect(marketplacePage).toContain(`<title>${buildPageTitle(MARKETPLACE_SEO.title)}</title>`);
    expect(marketplacePage).toContain('<link rel="canonical" href="https://www.tradibu.com/marketplace" />');
    expect(metaContent(marketplacePage, "og:url")).toBe("https://www.tradibu.com/marketplace");
    expect(metaContent(marketplacePage, "description")).toBe(MARKETPLACE_SEO.description);
    expect(metaContent(marketplacePage, "og:description")).toBe(MARKETPLACE_SEO.description);
    expect(metaContent(marketplacePage, "twitter:title")).toBe(buildPageTitle(MARKETPLACE_SEO.title));
  });

  it("resolves a path and an absolute URL to the same document", () => {
    // The builders hand this function paths (`buildDepartmentSeo` returns
    // "/categories/electronics") while a runtime caller may pass an absolute URL.
    // Both have to end up as one absolute canonical, or the served file and the
    // rendered page disagree about which URL they are - the drift this whole
    // arrangement exists to prevent.
    expect(injectPageHead(shell, { ...MARKETPLACE_PAGE, url: "https://www.tradibu.com/marketplace" })).toBe(
      injectPageHead(shell, MARKETPLACE_PAGE),
    );
  });

  it("drops the homepage's hero preload from a page that never renders the hero", () => {
    // HeroSlider is mounted by LandingPage alone, and the preload scanner works on
    // raw HTML without waiting to find that out: left in place, one of the two
    // links fires on every route and pulls a 1600px hero at fetchpriority=high
    // instead of the image that page actually shows.
    expect(shell).toContain('as="image"');
    expect(marketplacePage).not.toContain('as="image"');
  });

  it("drops the landing route's chunk hints and keeps the entry's own", () => {
    expect(marketplacePage).not.toContain(LANDING_PRELOAD_START);
    expect(marketplacePage).not.toContain("LandingPage-ROUTE.js");
    expect(marketplacePage).toContain("index-ENTRY.js");
  });

  it("leaves the homepage's hints alone, because `/` is what they are for", () => {
    const home = injectPageHead(builtShell, {
      url: "/",
      title: HOME_PAGE_SEO.title,
      description: HOME_PAGE_SEO.description,
    });
    expect(home).toContain(LANDING_PRELOAD_START);
    expect(home).toContain("LandingPage-ROUTE.js");
    expect(home).toContain('as="image"');
    expect(home).toContain('<link rel="canonical" href="https://www.tradibu.com/" />');
  });

  it("writes one of each tag however many passes it makes", () => {
    // Two canonicals is a self-conflict and two titles is undefined behaviour, so a
    // second pass has to replace rather than append.
    const twice = injectPageHead(marketplacePage, MARKETPLACE_PAGE);
    expect(count(twice, "<title")).toBe(1);
    expect(count(twice, 'rel="canonical"')).toBe(1);
    expect(count(twice, 'property="og:url"')).toBe(1);
    expect(count(twice, 'property="og:title"')).toBe(1);
    expect(count(twice, 'name="description"')).toBe(1);
  });

  it("keeps the site-wide graph and adds no page-level structured data", () => {
    // The WebSite/Organization graph belongs to the document rather than to a
    // route, and a department page has no offer, rating or date to declare:
    // inventing one is how a rich result gets withdrawn. `useSEO` owns the
    // page-level node at runtime and tags it with an id; nothing here may shadow it.
    expect(count(marketplacePage, "application/ld+json")).toBe(1);
    expect(marketplacePage).toMatch(/"@type":\s*"WebSite"/);
    expect(marketplacePage).toContain('"SearchAction"');
    expect(marketplacePage).not.toMatch(/"@type":\s*"Product"/);
    expect(marketplacePage).not.toContain('id="page-structured-data"');
  });

  it("cannot be broken out of by markup in a title or a description", () => {
    // A title can contain a quote, and a `site_pages` body is user-editable
    // markdown: both are attacker-adjacent input landing inside attributes here.
    const hostile = injectPageHead(shell, {
      url: "/prohibited-items",
      title: 'Terms "of" Service',
      description: "</head><script>alert(1)</script>",
    });
    expect(hostile).not.toContain("<script>alert(1)");
    expect(hostile).toContain("&lt;/head&gt;");
    expect(hostile).toContain('<meta property="og:title" content="Terms &quot;of&quot; Service | Tradibu" />');
    expect(count(hostile, "</head>")).toBe(1);
  });

  it("appends what a stripped shell is missing instead of dropping it", () => {
    const minimal = "<html><head><title>Shell</title></head><body></body></html>";
    const result = injectPageHead(minimal, MARKETPLACE_PAGE);
    expect(result).toContain(`<title>${buildPageTitle(MARKETPLACE_SEO.title)}</title>`);
    expect(result).toContain('<link rel="canonical" href="https://www.tradibu.com/marketplace" />');
    expect(result).toContain('name="description"');
    expect(count(result, "</head>")).toBe(1);
  });
});

describe("the submitted sitemap", () => {
  // A sitemap is a submission, not a map of the site. A URL submitted here while
  // its own document points its canonical somewhere else is a contradictory
  // signal, and Search Console answers it with "Duplicate, submitted URL not
  // selected as canonical" - the four aliases that used to be listed.
  const locs = Array.from(read("public/sitemap-pages.xml").matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);

  it("submits no URL that redirects its canonical to another page", () => {
    // The alias's OWN url, not `canonicalUrlFor(alias)` - that resolves through
    // to /about, which is legitimately submitted, and would pass forever.
    const aliases = LEGAL_PAGES.filter((page) => page.canonicalPath).map((page) => page.path);
    for (const alias of aliases) {
      const own = `https://www.tradibu.com${alias}`;
      expect(locs, `${alias} aliases ${canonicalPathFor(alias)} and must not be submitted`).not.toContain(own);
      // And the page it points at has to be submitted, or the alias consolidates
      // into a URL nobody submitted.
      expect(locs).toContain(canonicalUrlFor(alias));
    }
  });

  it("submits only URLs that are canonical for themselves", () => {
    // Catches the general case, not just today's four: a new alias added to
    // LEGAL_PAGES and to this file fails here without anyone naming it.
    for (const loc of locs) {
      const path = new URL(loc).pathname;
      expect(canonicalPathFor(path), `${loc} is not canonical for itself`).toBe(path);
    }
  });

  it("submits every canonical page the registry declares", () => {
    // The other direction. Dropping /shipping from this file would be invisible to
    // the check above, and an omitted page is a page that is never crawled.
    for (const page of LEGAL_PAGES) {
      if (page.canonicalPath) continue;
      expect(locs).toContain(canonicalUrlFor(page.path));
    }
    for (const page of STATIC_PAGES) {
      expect(locs).toContain(canonicalUrlFor(page.path));
    }
    expect(locs).toContain(canonicalUrlFor("/marketplace"));
  });

  it("uses the same origin the canonical tags are built from", () => {
    // A sitemap on one host and canonicals on another splits the site's identity
    // in half, and nothing else in the codebase would notice.
    for (const loc of locs) {
      expect(loc.startsWith("https://www.tradibu.com/")).toBe(true);
    }
  });
});

describe("the build wiring", () => {
  const config = read("vite.config.ts");

  it("runs the page prerenderer, and runs it after the preload rewrite", () => {
    // Registration order is execution order for `writeBundle`, and the page
    // prerenderer reads the shell the preload plugin rewrites - so moving it
    // ahead of `preloadLandingRoute` would strip markers that are not there yet
    // and leave every non-home route pointing at the landing chunk.
    expect(config).toContain('prerenderPublicPages()');
    const preload = config.indexOf("preloadLandingRoute()");
    const products = config.indexOf("prerenderProductPages()");
    const pages = config.indexOf("prerenderPublicPages()");
    expect(preload).toBeGreaterThan(-1);
    expect(pages).toBeGreaterThan(preload);
    expect(pages).toBeGreaterThan(products);
  });

  it("keeps cleanUrls on, because the prerendered route files are served through it", () => {
    // The prerenderer writes `dist/marketplace.html`, and the sitemap and every
    // internal link point at `/marketplace` with no extension. `cleanUrls` is the
    // only thing that joins the two. Without it the file sits in dist/ unread and
    // the request falls through to the catch-all, which serves the shell - the
    // original defect back, with a green build. The catch-all ordering is guarded
    // in src/test/vercelRouting.test.ts; this is the other half.
    const vercel = JSON.parse(read("vercel.json")) as { cleanUrls?: boolean };
    expect(vercel.cleanUrls).toBe(true);
  });
});

describe("the first-paint shell", () => {
  // The static above-the-fold markup index.html paints before React boots is
  // homepage-only: on any other route it would flash the landing hero on the
  // way to the real page. `injectPageHead` strips it with the homepage-only
  // preloads - the same guard, the same reason.
  it("ships on / and is stripped from every other route", () => {
    expect(shell).toContain(HOME_SHELL_START);
    expect(marketplacePage).not.toContain(HOME_SHELL_START);
    expect(marketplacePage).not.toContain('id="first-paint-shell"');
    // The markers sit inside #root, so the strip must leave the mount point
    // byte-identical to a document that never carried a shell.
    expect(marketplacePage).toContain('<div id="root"></div>');
  });

  it("survives injectPageHead for the homepage itself", () => {
    // The guard exists so that calling this for `/` cannot silently drop the
    // homepage's static first paint - the exact shape of the earlier preload bug.
    const home = injectPageHead(builtShell, {
      url: "/",
      title: HOME_PAGE_SEO.title,
      description: HOME_PAGE_SEO.description,
    });
    expect(home).toContain(HOME_SHELL_START);
    expect(home).toContain('id="first-paint-shell"');
  });
});
