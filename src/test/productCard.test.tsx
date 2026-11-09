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

  it("places price directly after the title when optional details are absent", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ProductCard
            product={{
              id: "compact-product",
              title: "Compact product",
              price: 25,
              stockQuantity: 20,
            }}
            formatPrice={(amount) => `$${amount}`}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );

    const heading = screen.getByRole("heading", { name: "Compact product" });
    const price = screen.getByText("$25");
    expect(heading).not.toHaveClass("min-h-10");
    expect(price).toBeInTheDocument();
    expect(heading.compareDocumentPosition(price) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("Options available")).not.toBeInTheDocument();
  });

  it("renders category comparison metadata after the price without reserving empty rows", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ProductCard
            product={{
              id: "iphone-listing",
              title: "Apple iPhone 16 Pro",
              price: 933000,
              stockQuantity: 4,
              meta: ["256GB", "5G", "New / sealed"],
            }}
            formatPrice={(amount) => `₦${amount.toLocaleString()}`}
          />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(screen.getByText("256GB")).toBeInTheDocument();
    expect(screen.getByText("5G")).toBeInTheDocument();
    expect(screen.getByText("New / sealed")).toBeInTheDocument();
    expect(screen.getByText("₦933,000")).toBeInTheDocument();
  });

  it("keeps marketplace cards to the normal scan signals", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <ProductCard
            product={{ ...product, meta: ["Bluetooth 5.2", "30 hours"], soldCount: 120, stockQuantity: 3 }}
            formatPrice={(amount) => `$${amount}`}
            sellerName="Verified store"
            shippingLabel="Ships to Nigeria"
            hasVariants
            density="marketplace"
          />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(screen.getByRole("heading", { name: product.title })).toBeInTheDocument();
    expect(screen.getByText("$120")).toBeInTheDocument();
    expect(screen.getByText("4.6")).toBeInTheDocument();
    expect(screen.getByText("Verified store")).toBeInTheDocument();
    expect(screen.queryByText("Bluetooth 5.2")).not.toBeInTheDocument();
    expect(screen.queryByText("120 sold")).not.toBeInTheDocument();
    expect(screen.queryByText("Ships to Nigeria")).not.toBeInTheDocument();
    expect(screen.queryByText("Options available")).not.toBeInTheDocument();
  });
});
