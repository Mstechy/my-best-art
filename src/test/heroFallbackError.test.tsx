import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HeroSlider from "@/components/HeroSlider";

describe("hero fallback error state", () => {
  it("keeps the default hero usable and exposes retry when CMS loading fails", () => {
    const onRetry = vi.fn();

    render(
      <MemoryRouter>
        <HeroSlider slides={[]} isLoading={false} error={new Error("CMS unavailable")} onRetry={onRetry} />
      </MemoryRouter>,
    );

    const section = screen.getByRole("region", { name: "Featured collections" });
    expect(section).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("Showing the default hero");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
