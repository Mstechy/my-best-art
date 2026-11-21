import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProductRichDescription from "@/components/product/ProductRichDescription";

describe("ProductRichDescription", () => {
  it("keeps long seller detail galleries collapsed until requested", () => {
    render(
      <ProductRichDescription
        images={[
          { url: "/listing-detail-1.jpg", alt: "Listing detail one", order: 1 },
          { url: "/listing-detail-2.jpg", alt: "Listing detail two", order: 2 },
        ]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Show full listing details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByAltText("Listing detail one")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Hide full listing details" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByAltText("Listing detail one")).toBeInTheDocument();
    expect(screen.getByAltText("Listing detail two")).toBeInTheDocument();
  });

  it("keeps a single detail image visible without an extra interaction", () => {
    render(
      <ProductRichDescription
        images={[{ url: "/listing-detail.jpg", alt: "Listing detail", order: 1 }]}
      />,
    );

    expect(screen.getByRole("button", { name: "Hide full listing details" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByAltText("Listing detail")).toBeInTheDocument();
  });
});
