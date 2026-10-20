import { describe, expect, it } from "vitest";
import { getProductTypesForCategory } from "@/lib/categoryConfig";

describe("electronics listing taxonomy", () => {
  it("offers one canonical mobile-phone type for the legacy phone department", () => {
    const types = getProductTypesForCategory({ slug: "phones-accessories", name: "Phones & Accessories" });
    const keys = types.map((type) => type.key);

    expect(keys).toContain("mobile-phones");
    expect(keys).not.toContain("phones");
  });
});
