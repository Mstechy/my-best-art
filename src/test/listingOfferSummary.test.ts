import { describe, expect, it } from "vitest";
import { getListingOfferSummary } from "@/lib/sellerListing/listingEntities";

describe("listing offer summary", () => {
  it("uses SKU prices and stock for a variant listing", () => {
    expect(getListingOfferSummary({
      price: 900000,
      stock_quantity: 99,
      product_variants: [
        { id: "128-black", option_values: { storage: "128GB", color: "Black" }, sku: "A", price: 850000, stock_quantity: 3, image_url: null },
        { id: "256-black", option_values: { storage: "256GB", color: "Black" }, sku: "B", price: 940000, stock_quantity: 1, image_url: null },
      ],
    })).toEqual({ variantCount: 2, optionGroupCount: 2, availableStock: 4, lowestPrice: 850000 });
  });

  it("ignores inactive rows and falls back to no summary for a simple listing", () => {
    expect(getListingOfferSummary({
      price: 100,
      stock_quantity: 2,
      product_variants: [{ id: "old", option_values: { storage: "64GB" }, sku: null, price: 80, stock_quantity: 7, image_url: null, is_active: false }],
    })).toBeNull();
    expect(getListingOfferSummary({ price: 100, stock_quantity: 2, product_variants: null })).toBeNull();
  });
});
