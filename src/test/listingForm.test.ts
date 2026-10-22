import { describe, expect, it } from "vitest";
import { deriveVariantAttributes, type VariantDraft } from "@/lib/sellerListing/listingForm";

const row = (overrides: Partial<VariantDraft> = {}): VariantDraft => ({
  key: "row-1",
  size: "",
  color: "Black",
  optionName: "storage",
  optionValue: "128GB",
  sku: "PHONE-128-BLK",
  price: "100",
  stock: "2",
  imageUrl: "",
  ...overrides,
});

describe("variant-backed phone attributes", () => {
  it("derives storage and colour from the SKU matrix", () => {
    expect(deriveVariantAttributes([
      row(),
      row({ key: "row-2", color: "Blue", optionValue: "256GB" }),
    ])).toEqual({ storage: "128GB, 256GB", color: "Black, Blue" });
  });

  it("does not invent an attribute when the matrix does not own it", () => {
    expect(deriveVariantAttributes([row({ optionName: "model", optionValue: "Pro" })])).toEqual({ color: "Black" });
  });

  it("derives laptop RAM and processor when those are the selected SKU option", () => {
    expect(deriveVariantAttributes([
      row({ optionName: "ram", optionValue: "16GB" }),
      row({ key: "row-2", optionName: "ram", optionValue: "32GB", color: "Silver" }),
    ])).toEqual({ ram: "16GB, 32GB", color: "Black, Silver" });
    expect(deriveVariantAttributes([
      row({ optionName: "processor", optionValue: "Core i5" }),
      row({ key: "row-2", optionName: "processor", optionValue: "Core i7" }),
    ])).toEqual({ processor: "Core i5, Core i7", color: "Black" });
  });
});
