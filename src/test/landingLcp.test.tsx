/**
 * Regression guard for the landing page's first-commit contract.
 *
 * The Oct 2026 field audit measured the LCP image ready at ~0.69s and the hero
 * still painting 2.13s later: the first React commit after `load` built the hero
 * AND every below-the-fold feed skeleton in one batch, so the hero's render
 * delay was the whole commit. The feed Container now mounts in the first commit
 * with reserved skeletons, so a slow mobile load cannot leave a blank product area.
 *
 * Two halves are pinned here:
 *
 *   1. On a cold load the hero artwork IS in the first render (it is the LCP
 *      element - if it waited for `load` the regression this whole mechanism
 *      exists to prevent would be back), and the feed Container is present as a
 *      DIRECT child of <main> with loading skeletons.
 *
 *   2. On a client-side navigation nothing is held back, so the feed never
 *      appears empty mid-session.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Boot sequence parity with src/main.tsx: t() must resolve for the section
// headers regardless of which module imports first.
import "@/lib/i18n/config";

import LandingPage from "@/pages/LandingPage";

vi.mock("@/integrations/supabase/client", () => {
  /** Chainable stub: queries and RPCs never settle or throw. */
  const chain: unknown = new Proxy(function () {}, {
    get: (_target, prop) =>
      prop === "then" ? () => new Promise(() => {}) : chain,
    apply: () => chain,
  });
  return { supabase: chain };
});

vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (amount: number) => `$${amount.toFixed(2)}`,
    convertPrice: (amount: number) => amount,
    currency: { code: "USD", symbol: "$" },
  }),
}));

// Signed-out: hooks gate their Supabase reads on a session that never arrives.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

vi.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    items: [],
    totalItems: 0,
    isOpen: false,
    setIsOpen: () => {},
    addItem: () => {},
    removeItem: () => {},
    clearCart: () => {},
    groupedBySeller: {},
    totalPrice: 0,
    loading: false,
  }),
}));

// The navbar pulls realtime subscriptions and search chrome the shell contract
// says nothing about; the landing page's own output is what is under test.
vi.mock("@/components/MarketplaceNavbar", () => ({
  default: (_props: { categories?: unknown[] }) => <nav aria-label="Marketplace" />,
}));
vi.mock("@/components/CartDrawer", () => ({ default: () => null }));

function renderLanding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The product feed: `order-4` marks the Container uniquely. */
const productFeed = () => document.querySelector("main > .order-4");

describe("landing first-commit contract", () => {
  it("paints the hero artwork and feed skeleton immediately", () => {
    renderLanding();

    // The LCP element is in the FIRST render - it must not wait for `load`.
    // HeroArtwork's <img> always carries the desktop src; the mobile rendition
    // is the <source> in the same <picture>.
    expect(document.querySelector('img[src*="electronics-products-1600x686"]')).not.toBeNull();
    expect(document.querySelector('source[srcset*="electronics-products-480x270"]')).not.toBeNull();

    // A slow window load must not hide products. The feed is present immediately
    // and its grid owns the loading skeleton while data is pending.
    expect(productFeed()).not.toBeNull();
    expect(productFeed()?.querySelector('[role="list"]')).not.toBeNull();
  });

  it("keeps the product Container a direct child of main so order-4 still places it", () => {
    renderLanding();
    const feed = productFeed();
    expect(feed).not.toBeNull();
    expect(feed?.parentElement?.tagName).toBe("MAIN");
    expect(feed?.className).toContain("order-4");
  });

  it("does not depend on a window load event for client-side navigation", () => {
    renderLanding();
    expect(productFeed()).not.toBeNull();
    // Sanity: the above-the-fold shell (the single H1) is present too.
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
