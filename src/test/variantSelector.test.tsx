import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import VariantSelector from "@/components/product/VariantSelector";
import { selectVariantOptions } from "@/lib/variantSelection";

const variants = [
  { id: "black-128", option_values: { color: "Black", storage: "128GB" }, price: 850000, stock_quantity: 3, is_active: true, image_url: null },
  { id: "black-256", option_values: { color: "Black", storage: "256GB" }, price: 950000, stock_quantity: 0, is_active: true, image_url: null },
  { id: "blue-128", option_values: { color: "Blue", storage: "128GB" }, price: 870000, stock_quantity: 2, is_active: true, image_url: null },
  { id: "yellow-256", option_values: { color: "Yellow", storage: "256GB" }, price: 990000, stock_quantity: 1, is_active: true, image_url: null },
  { id: "black-512", option_values: { color: "Black", storage: "512GB" }, price: 1100000, stock_quantity: 0, is_active: true, image_url: null },
];

describe("VariantSelector", () => {
  it("orders phone options as storage then colour and exposes availability", () => {
    render(<VariantSelector variants={variants} selectedOptions={{}} onChange={vi.fn()} />);

    const legends = screen.getAllByRole("group");
    expect(legends[0]).toHaveTextContent("Storage: Select");
    expect(legends[1]).toHaveTextContent("Colour: Select");
    expect(screen.getByRole("button", { name: "Storage: 512GB, unavailable" })).toBeDisabled();
  });

  it("keeps the selected option announced and sends the complete selection upward", () => {
    const onChange = vi.fn();
    render(<VariantSelector variants={variants} selectedOptions={{ storage: "128GB" }} onChange={onChange} />);

    const blue = screen.getByRole("button", { name: "Colour: Blue, available" });
    fireEvent.click(blue);

    expect(onChange).toHaveBeenCalledWith({ storage: "128GB", color: "Blue" });
    expect(screen.getByRole("button", { name: "Storage: 128GB, available" })).toHaveAttribute("aria-pressed", "true");
  });

  it("reconciles an incompatible selection to the first real SKU", () => {
    expect(selectVariantOptions(variants, { storage: "128GB", color: "Black" }, "color", "Yellow")).toEqual({
      color: "Yellow",
      storage: "256GB",
    });
  });

  it("resolves a dependent dimension when a choice has only one valid SKU value", () => {
    const onChange = vi.fn();
    render(
      <VariantSelector
        variants={[
          { id: "blue-128", option_values: { storage: "128GB", color: "Blue" }, price: 1, stock_quantity: 2, is_active: true, image_url: null },
          { id: "red-256", option_values: { storage: "256GB", color: "Red" }, price: 2, stock_quantity: 2, is_active: true, image_url: null },
        ]}
        selectedOptions={{}}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Storage: 128GB, available" }));
    expect(onChange).toHaveBeenCalledWith({ storage: "128GB", color: "Blue" });
  });

  it("disables values that are unavailable for the selected dimension", () => {
    render(<VariantSelector variants={variants} selectedOptions={{ storage: "128GB" }} onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Colour: Yellow, unavailable" })).toBeDisabled();
  });
});
