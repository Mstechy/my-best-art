import { describe, expect, it } from "vitest";
import { buildSellerListingSuggestions } from "@/lib/sellerListingAssistant";

const fields = [
  { key: "brand", label: "Brand", required: true },
  { key: "model", label: "Model", required: true },
  { key: "storage", label: "Storage", required: true },
  { key: "color", label: "Color" },
  { key: "condition", label: "Condition", required: true },
];

describe("seller listing assistant", () => {
  it("builds a concise title without repeating facts already inside the model", () => {
    const result = buildSellerListingSuggestions({
      productTypeLabel: "Mobile Phones",
      fields,
      categoryAttributes: {
        brand: "Apple",
        model: "Apple iPhone 17",
        storage: "128GB, 256GB",
        color: "Black, White",
        condition: "New",
      },
      requiredKeys: ["brand", "model", "storage", "condition"],
    });

    expect(result.title).toBe("Apple iPhone 17");
    expect(result.title).not.toContain("Apple, Apple");
    expect(result.metaDescription).toContain("Apple iPhone 17");
    expect(result.tags).toContain("Mobile Phones");
    expect(result.tags).toContain("128GB, 256GB");
    expect(result.missingRequiredLabels).toEqual([]);
  });

  it("uses only entered facts when building the description", () => {
    const result = buildSellerListingSuggestions({
      productTypeLabel: "Watches",
      fields,
      categoryAttributes: {
        brand: "Olevs",
        model: "Business Quartz Chronograph",
        storage: "",
        color: "Silver",
        condition: "Used",
      },
      requiredKeys: ["brand", "model", "storage", "condition"],
    });

    expect(result.description).toContain("Brand: Olevs");
    expect(result.description).toContain("Color: Silver");
    expect(result.description).toContain("Condition: Used");
    expect(result.description).not.toContain("waterproof");
    expect(result.metaDescription).toContain("Business Quartz Chronograph");
    expect(result.tags).toEqual(expect.arrayContaining(["Watches", "Olevs", "Business Quartz Chronograph", "Silver"]));
    expect(result.missingRequiredLabels).toEqual(["Storage"]);
  });

  it("returns no suggestion when the seller has not entered facts", () => {
    const result = buildSellerListingSuggestions({ fields, categoryAttributes: {}, requiredKeys: ["model"] });

    expect(result.title).toBe("");
    expect(result.description).toBe("");
    expect(result.metaDescription).toBe("");
    expect(result.tags).toEqual([]);
    expect(result.facts).toEqual([]);
    expect(result.missingRequiredLabels).toEqual(["Model"]);
  });
});
