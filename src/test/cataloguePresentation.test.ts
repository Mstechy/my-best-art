import { describe, expect, it } from "vitest";
import { getCategoryPathLabel, getProductFactEntries } from "@/lib/cataloguePresentation";

describe("catalogue presentation", () => {
  it("shows the category parent when the hierarchy is available", () => {
    const categories = [
      { id: "electronics", name: "Electronics" },
      { id: "phones", name: "Phones & Accessories", parent_id: "electronics" },
    ];

    expect(getCategoryPathLabel(categories[1], categories)).toBe("Electronics / Phones & Accessories");
    expect(getCategoryPathLabel(categories[0], categories)).toBe("Electronics");
  });

  it("omits missing and duplicate facts instead of reserving empty slots", () => {
    expect(getProductFactEntries({
      attributes: { model: "iPhone 16 Pro", storage: "256GB", color: "" },
      topLevel: { brand: "Apple", color: "256GB", condition: null },
      labels: { model: "Model", storage: "Storage", color: "Colour" },
      keys: ["brand", "model", "storage", "color", "condition"],
    })).toEqual([
      { key: "brand", label: "Brand", value: "Apple" },
      { key: "model", label: "Model", value: "iPhone 16 Pro" },
      { key: "storage", label: "Storage", value: "256GB" },
    ]);
  });
});
