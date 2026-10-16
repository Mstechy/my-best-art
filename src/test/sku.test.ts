import { describe, expect, it } from "vitest";

import { generateSku } from "@/lib/sku";

describe("generateSku", () => {
  it("prefixes generated SKUs with the Tradibu code, not the legacy MarketHub one", () => {
    expect(generateSku()).toMatch(/^TRB-\d{6}-[A-Z0-9]{5}$/);
  });

  it("accepts a custom prefix for seller-specific numbering", () => {
    expect(generateSku("ABC")).toMatch(/^ABC-\d{6}-[A-Z0-9]{5}$/);
  });

  it("generates unique SKUs", () => {
    expect(generateSku()).not.toBe(generateSku());
  });
});
