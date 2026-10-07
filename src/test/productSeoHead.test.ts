import { describe, expect, it } from "vitest";
import {
  buildPageTitle,
  buildProductDescription,
  buildProductJsonLd,
  buildProductTitle,
  injectProductHead,
  PRODUCT_STRUCTURED_DATA_ID,
  resolveSiteUrl,
  type ProductSeoInput,
} from "@/lib/productSeo";
import { HOME_SHELL_END, HOME_SHELL_START } from "@/lib/htmlHead";

/**
 * Mirrors the real index.html head: multi-line metas, a homepage title, a
 * homepage canonical, an og:/twitter: block, and the WebSite/Organization JSON-LD
 * graph. Exercising the multi-line forms matters because a regex written against
 * single-line tags silently fails against this file.
 */
const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tradibu | Online Marketplace for Trusted Shopping</title>
    <meta
      name="description"
      content="Buy and sell with confidence on Tradibu, a multi-vendor marketplace."
    />
    <link rel="canonical" href="https://www.tradibu.com/" />
    <!-- Home hero LCP preload. Present in the shell, wrong on a product page. -->
    <link
      rel="preload"
      as="image"
      type="image/webp"
      media="(max-width: 640px)"
      href="/images/electronics-products-960x540.webp"
      imagesrcset="/images/electronics-products-480x270.webp 1x, /images/electronics-products-960x540.webp 2x"
      fetchpriority="high"
    />
    <link
      rel="preload"
      as="image"
      type="image/webp"
      media="(min-width: 641px)"
      href="/images/electronics-products-1600x686.webp"
      fetchpriority="high"
    />
    <meta property="og:title" content="Tradibu - Multi-Vendor Marketplace" />
    <meta
      property="og:description"
      content="Buy and sell with confidence on Tradibu."
    />
    <meta property="og:url" content="https://www.tradibu.com/" />
    <meta property="og:image" content="https://www.tradibu.com/og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Tradibu - Multi-Vendor Marketplace" />
    <meta name="twitter:image:alt" content="Tradibu - Multi-Vendor Marketplace" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Tradibu - Multi-Vendor Marketplace" />
    <meta
      name="twitter:description"
      content="Buy and sell with confidence on Tradibu."
    />
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[]}</script>
    <link rel="modulepreload" crossorigin href="/assets/react-9f8e7d6c.js">
    <!--tradibu:landing-preload:start-->
    <link rel="modulepreload" crossorigin href="/assets/LandingPage-a1b2c3d4.js">
    <link rel="modulepreload" crossorigin href="/assets/MarketplaceNavbar-e5f6a7b8.js">
    <!--tradibu:landing-preload:end-->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>
`;

const PRODUCT_ID = "9a31c1ef-4495-4bb3-aa7e-5dbbb37c06d9";

const input: ProductSeoInput = {
  id: PRODUCT_ID,
  url: `https://www.tradibu.com/product/${PRODUCT_ID}`,
  productName: "Apple iPhone 11 Pro 128/256, Factory Unlocked",
  price: 352000,
  currency: "NGN",
  image: "https://bnkyddmmhaaefzfvzpqs.supabase.co/storage/v1/object/public/product-images/x/hero.jpeg",
  description: "5.8-inch Super Retina XDR OLED display with HDR10 and True Tone. A13 Bionic chip.",
  availability: "InStock",
  rating: 4.5,
  reviewCount: 12,
  brand: "Apple",
};

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

const productJsonLd = (html: string): Record<string, unknown> => {
  // Tolerant of attributes on the open tag: the Product block carries an id,
  // and the shell's graph block does not.
  const blocks = html.match(/<script[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
  const parsed = blocks.map((block) =>
    JSON.parse(
      block.replace(/^<script[^>]*\btype="application\/ld\+json"[^>]*>/, "").replace(/<\/script>$/, ""),
    ),
  );
  const product = parsed.find((node) => node["@type"] === "Product");
  expect(product, "expected a Product JSON-LD block in the head").toBeTruthy();
  return product as Record<string, unknown>;
};

describe("buildPageTitle / buildProductTitle", () => {
  it("matches the title useSEO already publishes", () => {
    expect(buildProductTitle("  Apple iPhone 11 Pro ")).toBe("Apple iPhone 11 Pro | Tradibu");
    expect(buildPageTitle(undefined)).toBe("Tradibu");
    expect(buildPageTitle("About")).toBe("About | Tradibu");
  });
});

describe("buildProductDescription", () => {
  it("uses the product description and stays inside the SERP limit", () => {
    const meta = buildProductDescription(input);
    expect(meta).toContain("Super Retina XDR");
    expect(meta.length).toBeLessThanOrEqual(160);
  });

  it("collapses whitespace and truncates on a word boundary", () => {
    const long = Array.from({ length: 40 }, (_, index) => `word${index}`).join("   \n  ");
    const meta = buildProductDescription({ ...input, description: long });
    expect(meta.length).toBeLessThanOrEqual(160);
    expect(meta).not.toMatch(/\s{2,}/);
    expect(meta).not.toMatch(/[\s,]$/);
  });

  it("falls back to a listing-currency price rather than a visitor-converted one", () => {
    const meta = buildProductDescription({ ...input, description: null });
    expect(meta).toContain("Apple iPhone 11 Pro");
    // Listing currency (ISO code, not the visitor's FX rate) and no ".00".
    expect(meta).toContain("NGN 352,000");
    expect(meta).not.toContain("352000.00");
    expect(meta.length).toBeLessThanOrEqual(160);
  });
});

describe("buildProductJsonLd", () => {
  it("emits the offer fields product rich results require", () => {
    const schema = buildProductJsonLd(input) as Record<string, unknown>;
    const offers = schema.offers as Record<string, unknown>;

    expect(schema["@type"]).toBe("Product");
    expect(schema.sku).toBe(PRODUCT_ID);
    expect(offers.price).toBe("352000.00");
    expect(offers.priceCurrency).toBe("NGN");
    expect(offers.availability).toBe("https://schema.org/InStock");
    expect(offers.url).toBe(`https://www.tradibu.com/product/${PRODUCT_ID}`);
    expect(schema.image).toEqual([input.image]);
    expect(schema.brand).toEqual({ "@type": "Brand", name: "Apple" });
    expect(schema.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "4.5",
      reviewCount: 12,
    });
  });

  it("omits rating and brand instead of emitting empty evidence", () => {
    const schema = buildProductJsonLd({ ...input, brand: null, rating: 0, reviewCount: 0, image: null });
    expect(schema.aggregateRating).toBeUndefined();
    expect(schema.brand).toBeUndefined();
    expect(schema.image).toBeUndefined();
    expect((schema.offers as Record<string, unknown>).price).toBe("352000.00");
  });

  it("resolves a relative image against the canonical origin", () => {
    const schema = buildProductJsonLd({ ...input, image: "/placeholder.svg" });
    expect(schema.image).toEqual(["https://www.tradibu.com/placeholder.svg"]);
  });

  it("builds the same absolute URL the prerenderer uses as canonical", () => {
    expect(resolveSiteUrl(`/product/${PRODUCT_ID}`)).toBe(`https://www.tradibu.com/product/${PRODUCT_ID}`);
  });
});

describe("injectProductHead", () => {
  const html = injectProductHead(SHELL, input);

  it("replaces the homepage title with exactly one product title", () => {
    expect(count(html, "<title")).toBe(1);
    expect(html).toContain(`<title>${buildProductTitle(input.productName)}</title>`);
    expect(html).not.toContain("Online Marketplace for Trusted Shopping");
  });

  it("replaces the homepage description with exactly one product description", () => {
    expect(count(html, 'name="description"')).toBe(1);
    expect(count(html, "Buy and sell with confidence on Tradibu, a multi-vendor marketplace.")).toBe(0);
    expect(html).toContain("Super Retina XDR");
  });

  it("points the canonical and og:url at the product, not the homepage", () => {
    expect(count(html, 'rel="canonical"')).toBe(1);
    expect(html).toContain(`<link rel="canonical" href="${input.url}" />`);
    expect(html).not.toContain('<link rel="canonical" href="https://www.tradibu.com/" />');
    expect(html).toContain(`<meta property="og:url" content="${input.url}" />`);
    expect(count(html, 'property="og:url"')).toBe(1);
    expect(html).toContain(`<meta property="og:image" content="${input.image}" />`);
  });

  it("drops the homepage hero image preloads the product page never renders", () => {
    // The preload scanner fires on raw HTML, so on a phone one of these two
    // media-keyed links would fetch the hero at fetchpriority="high" and discard
    // it - competing with the product photo that is this page's actual LCP
    // element. The shell ships a pair, so both have to go.
    expect(html).not.toContain('rel="preload"');
    expect(html).not.toContain('as="image"');
    expect(html).not.toContain("electronics-products-960x540.webp");
    expect(html).not.toContain("electronics-products-1600x686.webp");
    expect(html).not.toContain('media="(max-width: 640px)"');
    // The comment survives; only the requests it describes are dropped.
    expect(html).toContain("Home hero LCP preload");
  });

  it("drops the landing route modulepreload block the product page never needs", () => {
    // scripts/preloadLandingRoute.ts puts the landing route's chunk graph in
    // the shell so `/` can download it in parallel with index.js. A product
    // page mounts ProductDetailPage, so those links would be pure waste on
    // every crawler hit and every shared WhatsApp link - the same defect as
    // the hero preload above, one file format over.
    expect(html).not.toContain("tradibu:landing-preload:start");
    expect(html).not.toContain("tradibu:landing-preload:end");
    expect(html).not.toContain("LandingPage-a1b2c3d4.js");
    expect(html).not.toContain("MarketplaceNavbar-e5f6a7b8.js");
    // Only the marked block goes. Vite's own entry-graph modulepreloads sit
    // outside the markers and are what every route, including this one, needs
    // to boot the app at all - stripping those would break the product page
    // rather than speed it up. Real builds keep 10 of them per product page.
    expect(html).toContain('<link rel="modulepreload" crossorigin href="/assets/react-9f8e7d6c.js">');
    expect(count(html, 'rel="modulepreload"')).toBe(1);
    // Everything else in the head is still intact.
    expect(html).toContain("</head>");
    expect(count(html, "</head>")).toBe(1);
  });

  it("rewrites the og:image metadata so the preview describes this product", () => {
    // The shell's 1200x630 and brand alt belonged to og-image.jpg. Declaring the
    // wrong ratio makes WhatsApp/Facebook crop the shared preview badly.
    expect(html).not.toContain('property="og:image:width"');
    expect(html).not.toContain('property="og:image:height"');
    expect(html).toContain(
      `<meta property="og:image:alt" content="${buildProductTitle(input.productName)}" />`,
    );
    expect(html).toContain(
      `<meta name="twitter:image:alt" content="${buildProductTitle(input.productName)}" />`,
    );
    expect(count(html, 'property="og:image"')).toBe(1);
  });

  it("keeps the homepage WebSite graph and appends the Product node", () => {
    expect(html).toContain('"@graph"');
    const product = productJsonLd(html);
    expect((product.offers as Record<string, unknown>).price).toBe("352000.00");
    expect(html).toMatch(/<script[^>]*type="application\/ld\+json"[^>]*>.*"App.*<\/script>/);
  });

  it("tags the Product script so useSEO can find and replace it", () => {
    // useSEO swaps structured data by id on mount. An untagged block would be
    // invisible to it, and the render would end with two Product nodes.
    expect(count(html, `id="${PRODUCT_STRUCTURED_DATA_ID}"`)).toBe(1);
    expect(html).toContain(`<script id="${PRODUCT_STRUCTURED_DATA_ID}" type="application/ld+json">`);
    // The homepage WebSite graph stays untagged: it is not the hook's to manage.
    expect(count(html, '<script type="application/ld+json">')).toBe(1);
  });

  it("leaves the React mount point and module script untouched", () => {
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/assets/index.js"></script>');
    expect(count(html, "</head>")).toBe(1);
  });

  it("cannot be broken out of by a </script> in the description", () => {
    const malicious = injectProductHead(SHELL, {
      ...input,
      description: 'Widget </script><script>alert(1)</script> eom',
    });
    expect(malicious).not.toContain("</script><script>alert(1)");
    expect(malicious).toContain("&lt;/script&gt;");
    expect(() => productJsonLd(malicious)).not.toThrow();
  });

  it("appends tags the shell is missing rather than dropping them", () => {
    const minimal = "<html><head><title>Shell</title></head><body></body></html>";
    const result = injectProductHead(minimal, input);
    expect(result).toContain(`<title>${buildProductTitle(input.productName)}</title>`);
    expect(result).toContain(`<link rel="canonical" href="${input.url}" />`);
    expect(result).toContain('name="description"');
    expect(() => productJsonLd(result)).not.toThrow();
  });

  it("never stacks a second Product node, so a rebuild cannot duplicate it", () => {
    const twice = injectProductHead(html, input);
    expect(count(twice, "<title")).toBe(1);
    expect(count(twice, 'rel="canonical"')).toBe(1);
    expect(count(twice, 'property="og:url"')).toBe(1);
    expect(count(twice, '"@type":"Product"')).toBe(1);
    // The homepage WebSite graph survives a second pass.
    expect(twice).toContain('"@graph"');
  });

  it("strips the homepage first-paint shell, which product pages never paint", () => {
    // The shell's hero is the landing page's; left in place it would flash on
    // the way to the product and hand every prerendered product URL the
    // homepage's LCP element at fetchpriority=high. The markers sit inside
    // #root, so the strip restores the exact mount point.
    const withShell = SHELL.replace(
      '<div id="root"></div>',
      `<div id="root">${HOME_SHELL_START}<div id="first-paint-shell" class="min-h-screen"></div>${HOME_SHELL_END}</div>`,
    );
    const stripped = injectProductHead(withShell, input);
    expect(stripped).not.toContain(HOME_SHELL_START);
    expect(stripped).not.toContain("first-paint-shell");
    expect(stripped).toContain('<div id="root"></div>');
    // A document that never carried a shell (this file's fixture, and the
    // product prerenderer's second pass) is untouched by the strip.
    expect(injectProductHead(SHELL, input)).toContain('<div id="root"></div>');
  });
});

