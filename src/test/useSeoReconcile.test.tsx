import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { injectProductHead, PRODUCT_STRUCTURED_DATA_ID, type ProductSeoInput } from "@/lib/productSeo";
import { PAGE_STRUCTURED_DATA_ID, useProductSEO, useSEO } from "@/hooks/useSEO";

/**
 * Two writers touch the product <head>: `injectProductHead` at build time and
 * `useSEO` after React mounts. The first is what a crawler reads with JS
 * disabled, the second what it reads after rendering - so a direct load of
 * `/product/<id>` passes through both.
 *
 * These pin down the handover: the client must REPLACE the prerendered Product
 * node rather than append alongside it, and must not strand it when the SPA
 * navigates away from the product route.
 */
const PRODUCT_ID = "9a31c1ef-4495-4bb3-aa7e-5dbbb37c06d9";

const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <title>Tradibu | Online Marketplace for Trusted Shopping</title>
    <meta name="description" content="Buy and sell with confidence on Tradibu." />
    <link rel="canonical" href="https://www.tradibu.com/" />
    <script type="application/ld+json">{"@context":"https://schema.org","@graph":[]}</script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

const input: ProductSeoInput = {
  id: PRODUCT_ID,
  url: `https://www.tradibu.com/product/${PRODUCT_ID}`,
  productName: "Apple iPhone 11 Pro 128/256, Factory Unlocked",
  price: 352000,
  currency: "NGN",
  image: "https://example.com/hero.jpeg",
  description: "5.8-inch Super Retina XDR OLED display with HDR10 and True Tone.",
  availability: "InStock",
  brand: "Apple",
};

/** Install the prerendered head exactly as the static file serves it. */
function mountPrerenderedHead(): void {
  const html = injectProductHead(SHELL, input);
  document.head.innerHTML = html.replace(/^[\s\S]*?<head>/, "").replace(/<\/head>[\s\S]*$/, "");
}

const jsonLdNodes = (): Element[] => [...document.querySelectorAll("script[type='application/ld+json']")];

const parse = (node: Element): Record<string, unknown> => JSON.parse(node.textContent || "{}");

const productNodes = (): Element[] => jsonLdNodes().filter((node) => parse(node)["@type"] === "Product");

function ProductRoute() {
  useProductSEO({
    id: input.id,
    productName: input.productName,
    price: input.price,
    currency: input.currency,
    image: input.image ?? undefined,
    description: input.description ?? undefined,
    availability: input.availability,
    brand: input.brand,
  });
  return null;
}

function AboutRoute() {
  useSEO({ title: "About", url: "/about" });
  return null;
}

afterEach(() => {
  document.head.innerHTML = "";
});

describe("useProductSEO against prerendered product HTML", () => {
  it("replaces the static Product node instead of stacking a second one", () => {
    mountPrerenderedHead();
    expect(productNodes().map((node) => node.id)).toEqual([PRODUCT_STRUCTURED_DATA_ID]);

    render(<ProductRoute />);

    expect(productNodes().map((node) => node.id)).toEqual([PAGE_STRUCTURED_DATA_ID]);
    expect(document.getElementById(PRODUCT_STRUCTURED_DATA_ID)).toBeNull();
    // The homepage graph was never the hook's to touch, so it survives.
    expect(jsonLdNodes()).toHaveLength(2);
  });

  it("publishes the same title, canonical and description as the static file", () => {
    mountPrerenderedHead();
    const before = {
      title: document.title,
      canonical: document.querySelector("link[rel=canonical]")?.getAttribute("href"),
      description: document.querySelector("meta[name=description]")?.getAttribute("content"),
    };

    render(<ProductRoute />);

    expect(document.title).toBe(before.title);
    expect(document.querySelector("link[rel=canonical]")?.getAttribute("href")).toBe(before.canonical);
    expect(document.querySelector("meta[name=description]")?.getAttribute("content")).toBe(
      before.description,
    );
  });

  it("clears the Product node when the SPA navigates to a non-product route", () => {
    mountPrerenderedHead();
    expect(productNodes()).toHaveLength(1);

    render(<AboutRoute />);

    expect(productNodes()).toHaveLength(0);
    expect(jsonLdNodes().map(parse).some((node) => "@graph" in node)).toBe(true);
    expect(document.getElementById(PRODUCT_STRUCTURED_DATA_ID)).toBeNull();
    expect(document.title).toBe("About | Tradibu");
  });
});
