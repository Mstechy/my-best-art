import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import DescriptionImage from "@/components/product/DescriptionImage";

afterEach(() => cleanup());

describe("DescriptionImage", () => {
  it("reveals seller-uploaded media only after the image has loaded", () => {
    render(<DescriptionImage url="/product-detail.png" alt="Product detail graphic" />);

    const image = screen.getByRole("img", { name: "Product detail graphic" });
    expect(image).toHaveClass("opacity-0");
    expect(screen.queryByRole("button", { name: "Zoom image" })).not.toBeInTheDocument();

    fireEvent.load(image);

    expect(image).toHaveClass("opacity-100");
    expect(screen.getByRole("button", { name: "Zoom image" })).toBeInTheDocument();
  });

  it("replaces a failed media request with a truthful fallback", () => {
    render(<DescriptionImage url="/missing-product-detail.png" alt="Missing detail graphic" />);

    const image = screen.getByRole("img", { name: "Missing detail graphic" });
    fireEvent.error(image);

    expect(document.querySelector('img[src="/missing-product-detail.png"]')).not.toBeInTheDocument();
    expect(screen.getByText("This product detail image is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zoom image" })).not.toBeInTheDocument();
  });
});
