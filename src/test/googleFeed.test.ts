import { describe, expect, it } from "vitest";
import {
  FEED_CURRENCY,
  FEED_SITE_URL,
  buildFeedItem,
  buildFeedXml,
  isValidGtin,
  feedSellerEligible,
  googleFeedIssues,
} from "@/lib/googleFeed";

describe("google feed helpers", () => {
  it("builds a valid Google Shopping item from a product record", () => {
    const xml = buildFeedItem({
      id: "prod_123",
      title: "<b>Galaxy Note</b> 10",
      description: "<p>Fast phone with <strong>big battery</strong>.</p>",
      price: 250000,
      compare_at_price: 300000,
      currency: "NGN",
      brand: "Samsung",
      condition: "new",
      gtin: "1234567890123",
      mpn: "GN10-01",
      stock_quantity: 12,
      product_type: "Electronics > Phones",
      images: [
        "https://cdn.example.com/primary.jpg",
        "https://cdn.example.com/secondary.jpg",
        "http://cdn.example.com/ignored.jpg",
      ],
    });

    expect(xml).toContain("<title>Galaxy Note 10</title>");
    expect(xml).toContain(`<link>${FEED_SITE_URL}/product/prod_123</link>`);
    expect(xml).toContain("<g:price>300000.00 NGN</g:price>");
    expect(xml).toContain("<g:sale_price>250000.00 NGN</g:sale_price>");
    expect(xml).toContain("<g:availability>in_stock</g:availability>");
    expect(xml).toContain("<g:condition>new</g:condition>");
    expect(xml).toContain("<g:brand>Samsung</g:brand>");
    expect(xml).toContain("<g:gtin>1234567890123</g:gtin>");
    expect(xml).toContain("<g:product_type>Electronics &gt; Phones</g:product_type>");
    expect(xml).toContain("<g:image_link>https://cdn.example.com/primary.jpg</g:image_link>");
    expect(xml).toContain("<g:additional_image_link>https://cdn.example.com/secondary.jpg</g:additional_image_link>");
    expect(xml).not.toContain("http://cdn.example.com/ignored.jpg");
  });

  it("wraps items in an RSS document with the expected channel metadata", () => {
    const xml = buildFeedXml([buildFeedItem({
      id: "prod_456",
      title: "Headphones",
      price: 9000,
      currency: "NGN",
      images: ["https://cdn.example.com/headphones.jpg"],
      stock_quantity: 0,
    })]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">');
    expect(xml).toContain("<title>Tradibu - Google Shopping product feed</title>");
    expect(xml).toContain("<g:availability>out_of_stock</g:availability>");
    expect(new DOMParser().parseFromString(xml, "application/xml").querySelector("parsererror")).toBeNull();
  });

  it("uses the Nigeria feed currency for prices when a product has no explicit currency", () => {
    const item = buildFeedItem({
      id: "ngn_default",
      title: "Nigerian product",
      price: 15000,
      images: ["https://cdn.example.com/item.jpg"],
    });
    expect(FEED_CURRENCY).toBe("NGN");
    expect(item).toContain("<g:price>15000.00 NGN</g:price>");
  });

  it("uses the configured genuine default brand and only reports missing identifiers when GTIN and MPN are absent", () => {
    const defaultBrandItem = buildFeedItem(
      { id: "prod_default", title: "Unbranded item", price: 100, images: ["https://cdn.example.com/item.jpg"] },
      { defaultBrand: "Tradibu House Brand" },
    );
    expect(defaultBrandItem).toContain("<g:brand>Tradibu House Brand</g:brand>");
    expect(defaultBrandItem).toContain("<g:identifier_exists>false</g:identifier_exists>");

    const mpnItem = buildFeedItem({
      id: "prod_mpn",
      title: "Item with MPN",
      price: 100,
      mpn: "MODEL-01",
      images: ["https://cdn.example.com/item.jpg"],
    });
    expect(mpnItem).toContain("<g:mpn>MODEL-01</g:mpn>");
    expect(mpnItem).not.toContain("<g:identifier_exists>false</g:identifier_exists>");
  });

  it("validates GTIN length and check digit", () => {
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("12345")).toBe(false);
  });

  it("accepts only eligible sellers and rejects ineligible ones with the same rule the feed uses", () => {
    expect(feedSellerEligible({ is_approved: true, is_banned: false, is_frozen: false })).toBe(true);
    expect(feedSellerEligible({ is_approved: true, is_banned: true, is_frozen: false })).toBe(false);
    expect(feedSellerEligible({ is_approved: false, is_banned: false, is_frozen: false })).toBe(false);
    expect(feedSellerEligible(null)).toBe(false);
  });

  it("reports the exact readiness issues the seller badge uses", () => {
    expect(googleFeedIssues({
      status: "active",
      is_approved: true,
      price: 1200,
      imageCount: 1,
      title: "Valid item",
    })).toEqual([]);

    expect(googleFeedIssues({
      status: "draft",
      is_approved: true,
      price: 0,
      imageCount: 0,
      title: "",
    })).toEqual([
      "Not published yet (draft)",
      "Add a title",
      "Set a price above zero",
      "Add at least one product image",
    ]);

    expect(googleFeedIssues({
      status: "active",
      is_approved: true,
      sellerEligible: false,
      price: 100,
      imageCount: 1,
      title: "Product",
    })).toContain("Seller account is not approved to sell");

    expect(googleFeedIssues({
      status: "active",
      is_approved: true,
      price: 500000,
      imageCount: 3,
      title: "Lenovo ThinkPad T14",
      product_type: "Electronics > Laptops",
      brand: "Lenovo",
      gtin: "",
      mpn: "",
    })).toContain("Add the manufacturer GTIN or MPN when available");

    expect(googleFeedIssues({
      status: "active",
      is_approved: true,
      price: 500000,
      imageCount: 3,
      title: "Lenovo ThinkPad T14",
      product_type: "Electronics > Laptops",
      brand: "Lenovo",
      mpn: "20W0001XUS",
    })).not.toContain("Add the manufacturer GTIN or MPN when available");
  });
});
