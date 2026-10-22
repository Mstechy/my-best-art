import { describe, expect, it } from "vitest";
import { getProductPath, getProductUrl, normalizeProductSlug } from "@/lib/productUrls";

describe("product URLs", () => {
  it("normalizes seller slugs into stable public paths", () => {
    expect(normalizeProductSlug("  Apple iPhone 15 Pro 256GB  ")).toBe("apple-iphone-15-pro-256gb");
    expect(getProductPath({ id: "p1", seo_slug: "Apple iPhone 15 Pro 256GB" })).toBe("/product/apple-iphone-15-pro-256gb");
  });

  it("falls back to the immutable product id when a slug is absent", () => {
    expect(getProductPath({ id: "p1", seo_slug: null })).toBe("/product/p1");
    expect(getProductUrl({ id: "p1", seo_slug: null })).toBe("https://www.tradibu.com/product/p1");
  });
});
