import { describe, expect, it } from "vitest";
import { dedupeProducts, isMarketplaceSort, MARKETPLACE_SORTS } from "@/lib/marketplaceContracts";

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
});