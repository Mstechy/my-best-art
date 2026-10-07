/**
 * Regression guard for the hero's DOM-node stability - the mechanism that keeps
 * Largest Contentful Paint tied to the FIRST commit instead of to the data.
 *
 * The old landing page rendered a placeholder <div> while the hero query was in
 * flight and swapped it for <HeroSlider> when the data arrived. That swap
 * REPLACED the <picture>/<img> nodes and repainted the identical box, and a
 * same-size repaint is a new LCP candidate - so Lighthouse reported LCP at the
 * QUERY (~4.6s on the throttled phone) even though the image bytes had been
 * ready since HTML parse. The slider now mounts in the first commit with
 * `slides=[]` (its pending stage) and is supposed to be PATCHED in place when
 * slide 0 arrives: same key ("lead"), same props, same resolved src.
 *
 * This test pins that contract at the DOM level: the <img> element painted
 * during the pending state must be the SAME NODE after the campaign slides
 * arrive. If React ever reconciles the two states into different nodes (a
 * changed key, a changed children slot shape, a changed element type), this
 * fails - and so would LCP, silently, in the field.
 */
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Boot sequence parity with src/main.tsx: t() must resolve regardless of which
// module imports first.
import "@/lib/i18n/config";

import LandingPage from "@/pages/LandingPage";
import { LEGACY_ELECTRONICS_HERO_URL } from "@/lib/heroImages";
import type { EnhancedCollection } from "@/lib/collectionResolver";

/** Mutable state the mocked hook reads on every render. */
const home = {
  heroLoading: true,
  heroSlides: [] as EnhancedCollection[],
};

vi.mock("@/hooks/useHomepage", () => ({
  FEEDS: [],
  useHomepageData: () => ({
    categories: [],
    counts: {},
    categoryImages: {},
    heroSlides: home.heroSlides,
    heroLoading: home.heroLoading,
    feeds: { flash_deals: [], new_arrivals: [] },
    sellers: new Map(),
    loading: home.heroLoading,
  }),
}));

vi.mock("@/hooks/useCatalogueFeed", () => ({
  FEED_PAGE_SIZE: 24,
  useCatalogueFeed: () => ({
    items: [],
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    retry: () => {},
    loadMore: () => {},
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (amount: number) => `$${amount.toFixed(2)}`,
    convertPrice: (amount: number) => amount,
    currency: { code: "USD", symbol: "$" },
  }),
}));

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

// The navbar and cart drawer pull realtime subscriptions and search chrome this
// contract says nothing about.
vi.mock("@/components/MarketplaceNavbar", () => ({
  default: (_props: { categories?: unknown[] }) => <nav aria-label="Marketplace" />,
}));
vi.mock("@/components/CartDrawer", () => ({ default: () => null }));

// Any supabase call the un-mocked components make must never settle or throw.
vi.mock("@/integrations/supabase/client", () => {
  const chain: unknown = new Proxy(function () {}, {
    get: (_target, prop) =>
      prop === "then" ? () => new Promise(() => {}) : chain,
    apply: () => chain,
  });
  return { supabase: chain };
});

/** The seeded campaign: the legacy banner URL the shell preloads. */
const campaignSlide = {
  id: "11111111-2222-3333-4444-555555555555",
  title: "Electronics campaign",
  slug: "electronics-campaign",
  image_url: LEGACY_ELECTRONICS_HERO_URL,
} as unknown as EnhancedCollection;

function tree() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

/** The pending/live hero artwork - always the same resolved webp. */
const heroImg = () =>
  document.querySelector<HTMLImageElement>('img[src*="electronics-products-1600x686"]');

describe("hero LCP node stability", () => {
  beforeEach(() => {
    home.heroLoading = true;
    home.heroSlides = [];
  });

  afterEach(() => {
    home.heroLoading = true;
    home.heroSlides = [];
  });

  it("paints the pending stage in the first render", () => {
    render(tree());
    expect(heroImg()).not.toBeNull();
    // The mobile rendition of the same picture, byte-for-byte the preload.
    expect(document.querySelector('source[srcset*="electronics-products-480x270"]')).not.toBeNull();
  });

  it("patches the pending artwork in place when the campaign arrives", () => {
    const { rerender } = render(tree());
    const before = heroImg();
    expect(before).not.toBeNull();

    // The query resolves: same component instance, slide 0 takes the "lead" key.
    home.heroLoading = false;
    home.heroSlides = [campaignSlide];
    rerender(tree());

    const after = heroImg();
    expect(after).not.toBeNull();
    // The contract: the SAME DOM node survives. A replaced node repaints the
    // identical box, and that repaint becomes a new Largest Contentful Paint
    // candidate - resetting LCP to the moment the data arrived.
    expect(after).toBe(before);
    // ...with unchanged image attributes, so the browser has no repaint to give
    // LCP either.
    expect(after?.getAttribute("src")).toBe(before?.getAttribute("src"));
    expect(after?.getAttribute("srcset")).toBe(before?.getAttribute("srcset"));
  });

  it("drops the pending aria-hidden once the carousel is real", () => {
    const { rerender } = render(tree());
    const section = document.querySelector('section[aria-label="Featured collections"]');
    expect(section?.getAttribute("aria-hidden")).toBe("true");

    home.heroLoading = false;
    home.heroSlides = [campaignSlide];
    rerender(tree());

    const live = document.querySelector('section[aria-label="Featured collections"]');
    expect(live).not.toBeNull();
    expect(live?.getAttribute("aria-hidden")).toBeNull();
  });
});