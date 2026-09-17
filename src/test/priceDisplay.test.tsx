import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PriceDisplay, discountPercent } from "@/components/product/PriceDisplay";

/** Pass-through formatter so assertions are not coupled to Intl output. */
const fmt = (amount: number) => `$${amount.toFixed(2)}`;

describe("discountPercent", () => {
  it("returns null when there is no compare-at price", () => {
    expect(discountPercent(100, null)).toBeNull();
    expect(discountPercent(100, undefined)).toBeNull();
  });

  it("returns null when the compare-at price is not actually higher", () => {
    expect(discountPercent(100, 100)).toBeNull();
    expect(discountPercent(100, 80)).toBeNull();
  });

  it("rounds the saving to a whole percent", () => {
    expect(discountPercent(489, 699)).toBe(30);
    expect(discountPercent(24.99, 39.99)).toBe(38);
    expect(discountPercent(18.4, 38)).toBe(52);
  });
});

describe("PriceDisplay", () => {
  it("renders the current price", () => {
    render(<PriceDisplay price={42.5} formatPrice={fmt} />);
    expect(screen.getByText("$42.50")).toBeInTheDocument();
  });

  it("renders the original price struck through when it is higher", () => {
    render(<PriceDisplay price={24.99} compareAtPrice={39.99} formatPrice={fmt} />);
    expect(screen.getByText("$24.99")).toBeInTheDocument();
    const was = screen.getByText("$39.99");
    expect(was).toBeInTheDocument();
    expect(was.className).toContain("line-through");
  });

  it("omits the original price when it is not a real discount", () => {
    render(<PriceDisplay price={50} compareAtPrice={50} formatPrice={fmt} />);
    expect(screen.queryByText("$50.00")).toHaveClass("text-deal");
    // only the current price is rendered, so exactly one $50.00 exists
    expect(screen.getAllByText("$50.00")).toHaveLength(1);
  });

  it("honours showCompareAt={false}", () => {
    render(
      <PriceDisplay price={24.99} compareAtPrice={39.99} formatPrice={fmt} showCompareAt={false} />,
    );
    expect(screen.queryByText("$39.99")).not.toBeInTheDocument();
  });

  it("uses the deal colour token for the current price", () => {
    render(<PriceDisplay price={10} formatPrice={fmt} />);
    expect(screen.getByText("$10.00").className).toContain("text-deal");
  });
});