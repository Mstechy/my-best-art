import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CookieConsent from "@/components/CookieConsent";
import { COOKIE_CONSENT_KEY } from "@/lib/analyticsConsent";

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderConsent() {
    render(
      <MemoryRouter>
        <CookieConsent />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(600);
    });
  }

  it("publishes a labelled region with keyboard-operable consent controls", () => {
    renderConsent();

    const region = screen.getByRole("region", { name: "We use cookies" });
    expect(region).toHaveAttribute("aria-describedby", "cookie-consent-description");
    expect(screen.getByRole("heading", { name: "We use cookies" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cookie Policy" })).toHaveAttribute("href", "/cookies");
    expect(screen.getByRole("button", { name: "Accept all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline cookie consent" })).toBeInTheDocument();
  });

  it("persists the selected consent and removes the banner", () => {
    renderConsent();

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));

    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe("accepted");
    expect(screen.queryByRole("region", { name: "We use cookies" })).not.toBeInTheDocument();
  });
});
