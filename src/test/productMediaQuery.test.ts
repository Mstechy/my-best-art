import { describe, expect, it } from "vitest";
import { normalizeProduct, PRODUCT_DETAIL_COLUMNS } from "@/hooks/useProductDetail";

describe("product detail media contract", () => {
  it("selects seller-uploaded description and gallery alt media", () => {
    expect(PRODUCT_DETAIL_COLUMNS).toContain("description_images");
    expect(PRODUCT_DETAIL_COLUMNS).toContain("product_images(id,image_url,is_primary,sort_order,alt)");
  });

  it("preserves uploaded description image metadata during normalization", () => {
    const product = normalizeProduct({
      id: "product-1",
      title: "Uploaded product",
      description_images: [{ url: "https://cdn.example.test/detail-1.webp", alt: "Size chart", order: 0 }],
      product_images: [{ id: "image-1", image_url: "https://cdn.example.test/main.webp", is_primary: true, sort_order: 0, alt: "Product front" }],
    });

    expect(product.description_images).toEqual([
      { url: "https://cdn.example.test/detail-1.webp", alt: "Size chart", order: 0 },
    ]);
    expect(product.product_images[0].alt).toBe("Product front");
  });
});
