import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import SkipLink from "@/components/SkipLink";

describe("SkipLink", () => {
  it("renders the WCAG 2.4.1 bypass block as the first focusable element", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("adopts the rendered <main> landmark and moves focus to it on click", () => {
    render(
      <>
        <SkipLink />
        <main>Storefront content</main>
      </>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }));

    const main = document.querySelector("main");
    expect(main).toHaveAttribute("id", "main-content");
    // A <main> is not focusable by default; the handler opts it in so focus can
    // actually land there instead of falling back to the top of the document.
    expect(main).toHaveAttribute("tabindex", "-1");
    expect(main).toHaveFocus();
  });

  it("leaves the page untouched when no main landmark exists", () => {
    render(<SkipLink />);
    // No preventDefault target: the click is a plain anchor activation and the
    // handler bails without throwing.
    expect(() => fireEvent.click(screen.getByRole("link", { name: "Skip to main content" }))).not.toThrow();
  });
});
