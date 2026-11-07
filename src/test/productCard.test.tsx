import React from "react";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import i18n from "@/lib/i18n/config";
import { ProductCard, type ProductCardProduct } from "@/components/product/ProductCard";

const product: ProductCardProduct = {
  id: "product-1",
  title: "Wireless headphones",
  brand: "Tradibu Audio",
  price: 120,
  compareAtPrice: 160,
  stockQuantity: 3,
  averageRating: 4.6,
  reviewCount: 18,
};

describe("ProductCard", () => {
  it("surfaces the catalogue signals shoppers need to compare products", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ProductCard
            product={product}
            formatPrice={(amount) => `$${amount}`}
            sellerName="Verified store"
            sellerVerified
            shippingLabel="Ships to Nigeria"
            hasVariants
          />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(screen.getByRole("heading", { name: product.title })).toBeInTheDocument();
    expect(screen.getByText(product.brand!)).toBeInTheDocument();
    expect(screen.getByText("4.6")).toBeInTheDocument();
    expect(screen.getByText("Ships to Nigeria")).toBeInTheDocument();
    expect(screen.getByText("Options available")).toBeInTheDocument();
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
  });
});
