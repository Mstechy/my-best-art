import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import RouteLoadingFallback from "@/components/RouteLoadingFallback";

function renderFallback(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteLoadingFallback />
    </MemoryRouter>,
  );
}

describe("RouteLoadingFallback", () => {
  it("renders the public marketplace shell on public routes", () => {
    const { container } = renderFallback("/marketplace");

    expect(screen.getByRole("status", { name: "Loading page" })).toBeInTheDocument();
    expect(container.querySelector("main[aria-busy='true']")).toBeInTheDocument();
    expect(container.querySelector("aside")).not.toBeInTheDocument();
  });

  it("renders the dashboard shell for protected role routes", () => {
    const { container } = renderFallback("/seller/products");

    expect(container.querySelector("aside")).toBeInTheDocument();
    expect(container.querySelector("main[aria-busy='true']")).toBeInTheDocument();
  });

  it("renders a focused auth shell for authentication routes", () => {
    const { container } = renderFallback("/auth/login");

    expect(container.querySelector("aside")).not.toBeInTheDocument();
    expect(container.querySelector("main[aria-busy='true']")).not.toBeInTheDocument();
    expect(container.querySelector("form")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading page" })).toBeInTheDocument();
  });
});
