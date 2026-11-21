import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ProductRichDescription from "@/components/product/ProductRichDescription";

describe("ProductRichDescription", () => {
  it("shows long seller detail galleries and lets the buyer collapse them", () => {
    render(
      <ProductRichDescription
        images={[
          { url: "/listing-detail-1.jpg", alt: "Listing detail one", order: 1 },
          { url: "/listing-detail-2.jpg", alt: "Listing detail two", order: 2 },
        ]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Hide full listing details" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByAltText("Listing detail one")).toBeInTheDocument();
    expect(screen.getByAltText("Listing detail two")).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Show full listing details" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByAltText("Listing detail one")).not.toBeInTheDocument();
    expect(screen.queryByAltText("Listing detail two")).not.toBeInTheDocument();
  });

  it("shows a single detail image with the same collapse control", () => {
    render(
      <ProductRichDescription
        images={[{ url: "/listing-detail.jpg", alt: "Listing detail", order: 1 }]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "Hide full listing details" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByAltText("Listing detail")).toBeInTheDocument();

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Show full listing details" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByAltText("Listing detail")).not.toBeInTheDocument();
  });
});
