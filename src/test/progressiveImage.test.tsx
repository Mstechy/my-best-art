import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ProgressiveImage from "@/components/ui/ProgressiveImage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProgressiveImage", () => {
  it("shows an image that completed before its load handler was attached", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(600);

    render(
      <ProgressiveImage
        src="/cached-product-image.webp"
        alt="Cached product image"
        loading="eager"
      />,
    );

    expect(screen.getByRole("img", { name: "Cached product image" })).toHaveClass("opacity-100");
  });

  it("runs the error handler for a cached image that failed to load", () => {
    const onError = vi.fn();
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);

    render(
      <ProgressiveImage
        src="/missing-product-image.webp"
        alt="Missing product image"
        loading="eager"
        onError={onError}
      />,
    );

    expect(onError).toHaveBeenCalledOnce();
  });
});
