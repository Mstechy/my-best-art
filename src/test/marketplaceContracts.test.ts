import { describe, expect, it } from "vitest";
import { dedupeProducts, filterProductsByCategory, isMarketplaceSort, MARKETPLACE_SORTS } from "@/lib/marketplaceContracts";

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
});
