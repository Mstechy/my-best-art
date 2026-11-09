import { describe, expect, it } from "vitest";

import { getLaptopTitleQuality, getPhoneTitleQuality, getProductListingMeta } from "@/lib/productListingPresentation";

describe("product listing presentation", () => {
  it("shows compact iPhone comparison signals without repeating the title", () => {
    expect(getProductListingMeta({
      title: "Apple iPhone 16 Pro",
      brand: "Apple",
      categorySlug: "phones-accessories",
      variants: {
        productType: { key: "mobile-phones" },
        categoryAttributes: {
          brand: "Apple",
          model: "iPhone 16 Pro",
          storage: "256GB",
          network: "5G",
          cosmeticCondition: "New / sealed",
        },
      },
    })).toEqual(["256GB", "5G", "New / sealed"]);
  });

  it("does not fabricate metadata when optional product attributes are absent", () => {
    expect(getProductListingMeta({
      title: "Unspecified phone",
      categorySlug: "phones-accessories",
      variants: { productType: { key: "mobile-phones" }, categoryAttributes: {} },
    })).toEqual([]);
  });

  it("shows laptop comparison signals in price-driving order", () => {
    expect(getProductListingMeta({
      title: "Lenovo ThinkPad T14 Gen 5",
      categorySlug: "electronics",
      variants: {
        productType: { key: "laptops" },
        categoryAttributes: {
          model: "ThinkPad T14 Gen 5",
          processor: "Intel Core Ultra 7",
          ram: "16GB",
          storage: "512GB",
          storageType: "NVMe SSD",
        },
      },
    })).toEqual(["Intel Core Ultra 7", "16GB", "512GB"]);
  });

  it("warns sellers when an iPhone title cannot be compared reliably", () => {
    expect(getPhoneTitleQuality({
      title: "Phone for sale",
      brand: "Apple",
      variants: { productType: { key: "mobile-phones" }, categoryAttributes: { model: "iPhone 16 Pro" } },
    })).toContain("brand and model");
    expect(getPhoneTitleQuality({
      title: "Apple iPhone 16 Pro 256GB",
      brand: "Apple",
      variants: { productType: { key: "mobile-phones" }, categoryAttributes: { model: "iPhone 16 Pro" } },
    })).toBeNull();
  });

  it("warns sellers when a laptop title is missing its comparison identity", () => {
    expect(getLaptopTitleQuality({
      title: "Laptop for sale",
      brand: "Lenovo",
      variants: { productType: { key: "laptops" }, categoryAttributes: { model: "ThinkPad T14 Gen 5" } },
    })).toContain("brand and model");
    expect(getLaptopTitleQuality({
      title: "Lenovo ThinkPad T14 Gen 5",
      brand: "Lenovo",
      variants: { productType: { key: "laptops" }, categoryAttributes: { model: "ThinkPad T14 Gen 5" } },
    })).toBeNull();
  });
});
