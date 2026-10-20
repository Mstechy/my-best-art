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
});
