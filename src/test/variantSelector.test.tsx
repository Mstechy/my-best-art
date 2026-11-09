import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import VariantSelector from "@/components/product/VariantSelector";

const variants = [
  { id: "black-128", option_values: { color: "Black", storage: "128GB" }, price: 850000, stock_quantity: 3, is_active: true, image_url: null },
  { id: "black-256", option_values: { color: "Black", storage: "256GB" }, price: 950000, stock_quantity: 0, is_active: true, image_url: null },
  { id: "blue-128", option_values: { color: "Blue", storage: "128GB" }, price: 870000, stock_quantity: 2, is_active: true, image_url: null },
];

describe("VariantSelector", () => {
  it("orders phone options as storage then colour and exposes availability", () => {
    render(<VariantSelector variants={variants} selectedOptions={{}} onChange={vi.fn()} />);

    const legends = screen.getAllByRole("group");
    expect(legends[0]).toHaveTextContent("Storage: Select");
    expect(legends[1]).toHaveTextContent("Colour: Select");
    expect(screen.getByRole("button", { name: "Storage: 256GB, unavailable" })).toBeDisabled();
  });

  it("keeps the selected option announced and sends the complete selection upward", () => {
    const onChange = vi.fn();
    render(<VariantSelector variants={variants} selectedOptions={{ storage: "128GB" }} onChange={onChange} />);

    const blue = screen.getByRole("button", { name: "Colour: Blue, available" });
    fireEvent.click(blue);

    expect(onChange).toHaveBeenCalledWith({ storage: "128GB", color: "Blue" });
    expect(screen.getByRole("button", { name: "Storage: 128GB, available" })).toHaveAttribute("aria-pressed", "true");
  });
});
