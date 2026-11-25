import { describe, expect, it } from "vitest";
import { buildMarketplaceDiscoveryHref, buildMarketplaceDiscoveryShortcuts } from "@/lib/marketplaceDiscovery";

const categories = [
  { id: "electronics", name: "Electronics", slug: "electronics", parent_id: null },
  { id: "computers", name: "Computers", slug: "computers", parent_id: null },
  { id: "watches", name: "Watches", slug: "watches", parent_id: null },
];

describe("marketplace discovery shortcuts", () => {
  it("keeps product-type shortcuts on the marketplace route when no department exists", () => {
    expect(buildMarketplaceDiscoveryHref({ slug: "marketplace", productTypeKey: "mobile-phones" })).toBe("/marketplace?type=mobile-phones");
    expect(buildMarketplaceDiscoveryHref({ slug: "electronics", productTypeKey: "mobile-phones" })).toBe("/categories/electronics?type=mobile-phones");
  });

  it("shows product-led types once instead of repeating their parent departments", () => {
    const shortcuts = buildMarketplaceDiscoveryShortcuts({
      categories,
      products: [
        { category_id: "electronics", variants: { productType: { key: "mobile-phones", label: "Mobile Phones" } }, product_images: [{ image_url: "https://cdn.test/phone.jpg", is_primary: true }] },
        { category_id: "computers", variants: { productType: { key: "laptops", label: "Laptops & Computers" } }, product_images: [{ image_url: "https://cdn.test/laptop.jpg", is_primary: true }] },
        { category_id: "watches", variants: { productType: { key: "watches", label: "Watches" } }, product_images: [{ image_url: "https://cdn.test/watch.jpg", is_primary: true }] },
      ],
    });

    expect(shortcuts.map((shortcut) => shortcut.name)).toEqual(expect.arrayContaining(["Mobile phones", "Laptops", "Watches"]));
    expect(shortcuts).toHaveLength(3);
    expect(shortcuts.some((shortcut) => shortcut.name === "Electronics")).toBe(false);
    expect(shortcuts.some((shortcut) => shortcut.name === "Computers")).toBe(false);
    expect(new Set(shortcuts.map((shortcut) => shortcut.image_url)).size).toBe(3);
  });

  it("does not repeat the active type on its own product-led page", () => {
    const shortcuts = buildMarketplaceDiscoveryShortcuts({
      categories,
      selectedCategoryId: "watches",
      selectedProductTypeKey: "watches",
      products: [{ category_id: "watches", variants: { productType: { key: "watches", label: "Watches" } }, product_images: [{ image_url: "https://cdn.test/watch.jpg", is_primary: true }] }],
    });

    expect(shortcuts).toEqual([]);
  });

  it("falls back to populated leaf departments and avoids duplicate images", () => {
    const fallbackCategories = [
      { id: "electronics", name: "Electronics", slug: "electronics", parent_id: null, image_url: "https://cdn.test/electronics.jpg" },
      { id: "phones", name: "Phones", slug: "phones", parent_id: "electronics", image_url: "https://cdn.test/electronics.jpg" },
      { id: "home", name: "Home", slug: "home", parent_id: null, image_url: "https://cdn.test/home.jpg" },
    ];
    const shortcuts = buildMarketplaceDiscoveryShortcuts({
      categories: fallbackCategories,
      counts: { electronics: 2, phones: 2, home: 1 },
      products: [],
    });

    expect(shortcuts.map((shortcut) => shortcut.name)).toEqual(["Phones", "Home"]);
    expect(shortcuts.some((shortcut) => shortcut.name === "Electronics")).toBe(false);
    expect(new Set(shortcuts.map((shortcut) => shortcut.image_url)).size).toBe(2);
  });
});
