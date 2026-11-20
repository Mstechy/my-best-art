import { describe, expect, it } from "vitest";
import { dedupeProducts, filterProductsByCategory, getCategoryTreeIds, isMarketplaceSort, MARKETPLACE_SORTS } from "@/lib/marketplaceContracts";

describe("marketplace contracts", () => {
  it("accepts every server-supported sort and rejects unknown values", () => {
    expect(MARKETPLACE_SORTS).toContain("flash_deals");
    expect(isMarketplaceSort("price_low")).toBe(true);
    expect(isMarketplaceSort("not-a-sort")).toBe(false);
  });

  it("deduplicates appended pages without changing order", () => {
    const existing = [{ id: "a" }, { id: "b" }];
    const next = [{ id: "b" }, { id: "c" }, { id: "c" }, { id: "d" }];
    expect(dedupeProducts(next, existing)).toEqual([{ id: "c" }, { id: "d" }]);
  });

  it("never leaks products from another category into a listing", () => {
    const products = [
      { id: "phone", category_id: "electronics" },
      { id: "shirt", category_id: "fashion" },
      { id: "uncategorized", category_id: null },
    ];

    expect(filterProductsByCategory(products, "fashion")).toEqual([{ id: "shirt", category_id: "fashion" }]);
    expect(filterProductsByCategory(products, null)).toEqual(products);
  });

  it("includes child departments when a parent department is selected", () => {
    const categories = [
      { id: "electronics", parent_id: null },
      { id: "phones", parent_id: "electronics" },
      { id: "mobile-phones", parent_id: "phones" },
      { id: "fashion", parent_id: null },
    ];
    const categoryIds = getCategoryTreeIds(categories, "electronics");
    const products = [
      { id: "phone", category_id: "mobile-phones" },
      { id: "accessory", category_id: "phones" },
      { id: "shirt", category_id: "fashion" },
    ];

    expect([...categoryIds!]).toEqual(["electronics", "phones", "mobile-phones"]);
    expect(filterProductsByCategory(products, "electronics", categoryIds)).toEqual(products.slice(0, 2));
  });
});
