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

  it("keeps intrinsic dimensions on the image without fixing the responsive wrapper size", () => {
    render(
      <ProgressiveImage
        src="/product-image.webp"
        alt="Responsive product image"
        width={900}
        height={900}
        fit="contain"
        loading="eager"
        wrapperClassName="responsive-image-wrapper"
      />,
    );

    const image = screen.getByRole("img", { name: "Responsive product image" });
    const wrapper = document.querySelector(".responsive-image-wrapper");

    expect(image).toHaveAttribute("width", "900");
    expect(image).toHaveAttribute("height", "900");
    expect(image).toHaveClass("object-contain");
    expect(wrapper).not.toHaveStyle({ width: "900px", height: "900px" });
  });
});
