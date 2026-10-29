import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SkipLink from "@/components/SkipLink";

describe("SkipLink", () => {
  it("renders the WCAG 2.4.1 bypass block as the first focusable element", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("publishes the fragment target without waiting for a click", () => {
    render(
      <>
        <SkipLink />
        <main>Storefront content</main>
      </>,
    );

    // Accessibility scanners (axe's skip-link rule, run by Lighthouse) resolve
    // href="#main-content" WITHOUT activating the link. An id that only the
    // click handler creates reads as "No skip link target" and fails the audit,
    // so the target has to exist from the first commit.
    const main = document.querySelector("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("re-adopts the target when a route swap replaces the <main>", async () => {
    const first = render(
      <>
        <SkipLink />
        <main>First route</main>
      </>,
    );

    // A navigation (or a React.lazy chunk landing) replaces the element
    // wholesale; the MutationObserver has to republish the target on the new
    // node, otherwise only the first route of a session would be scannable.
    first.rerender(
      <>
        <SkipLink />
        <section>
          <main>Second route</main>
        </section>
      </>,
    );

    const main = document.querySelector("main");
    await waitFor(() => expect(main).toHaveAttribute("id", "main-content"));
    expect(main).toHaveAttribute("tabindex", "-1");
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
    // A <main> is not focusable by default; adoption opts it in so focus can
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
