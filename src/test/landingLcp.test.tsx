/**
 * Regression guard for the landing page's first-commit contract.
 *
 * The Oct 2026 field audit measured the LCP image ready at ~0.69s and the hero
 * still painting 2.13s later: the first React commit after `load` built the hero
 * AND every below-the-fold feed skeleton in one batch, so the hero's render
 * delay was the whole commit. The feed Container now mounts through the house
 * `AfterFirstPaint` (load + two frames, never a timer).
 *
 * Two halves are pinned here, mirroring src/test/afterFirstPaint.test.tsx:
 *
 *   1. On a cold load the hero artwork IS in the first render (it is the LCP
 *      element - if it waited for `load` the regression this whole mechanism
 *      exists to prevent would be back), while the feed Container is NOT, and
 *      when it does mount it is a DIRECT child of <main> - `AfterFirstPaint`
 *      renders children with no wrapper, and a wrapper would break the
 *      `order-4` flex ordering that places the feed after the hero rails.
 *
 *   2. On a client-side navigation (document already complete) nothing is held
 *      back, so the feed never appears empty mid-session.
 */
import { act, render, screen } from "@testing-library/react";
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

/**
 * jsdom implements requestAnimationFrame as a timer, so a stub that runs the
 * callback synchronously makes AfterFirstPaint's double-frame hop deterministic
 * (same approach as afterFirstPaint.test.tsx).
 */
function installFrameStub() {
  const original = window.requestAnimationFrame;
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
  return () => {
    window.requestAnimationFrame = original;
  };
}

function setReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, "readyState", { value, configurable: true });
}

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

/** The below-the-fold feed: `order-4` marks the deferred Container uniquely. */
const deferredFeed = () => document.querySelector("main > .order-4");

describe("landing first-commit contract", () => {
  let restoreFrames: () => void;

  beforeEach(() => {
    restoreFrames = installFrameStub();
    setReadyState("loading");
  });

  afterEach(() => {
    restoreFrames();
    setReadyState("complete");
  });

  it("paints the hero artwork immediately and defers the feed until after load", () => {
    renderLanding();

    // The LCP element is in the FIRST render - it must not wait for `load`.
    // HeroArtwork's <img> always carries the desktop src; the mobile rendition
    // is the <source> in the same <picture>.
    expect(document.querySelector('img[src*="electronics-products-1600x686"]')).not.toBeNull();
    expect(document.querySelector('source[srcset*="electronics-products-480x270"]')).not.toBeNull();

    // The below-the-fold feed is NOT part of that commit...
    expect(deferredFeed()).toBeNull();

    // ...until load has happened and two frames have confirmed the paint.
    act(() => {
      window.dispatchEvent(new Event("load"));
    });
    expect(deferredFeed()).not.toBeNull();
  });

  it("keeps the deferred Container a direct child of main so order-4 still places it", () => {
    // AfterFirstPaint renders children with NO wrapper element; a wrapper would
    // sit between <main> and the Container and silently defeat its position in
    // the flex ordering of the page.
    setReadyState("complete");
    renderLanding();
    const feed = deferredFeed();
    expect(feed).not.toBeNull();
    expect(feed?.parentElement?.tagName).toBe("MAIN");
    expect(feed?.className).toContain("order-4");
  });

  it("renders the feed without waiting when the document already finished loading", () => {
    // A client-side navigation back to "/" must not blank the feed section
    // while the document re-fires no `load` event.
    setReadyState("complete");
    renderLanding();
    expect(deferredFeed()).not.toBeNull();
    // Sanity: the above-the-fold shell (the single H1) is present too.
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
