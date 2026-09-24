/**
 * Regression guard for the /product/:id bottom chrome.
 *
 * The page briefly mounted BOTH <BottomTabBar /> and its own sticky CTA bar, so
 * two cart affordances stacked in the same corner of the viewport. BottomTabBar
 * is the only bottom bar that renders a `<nav aria-label="Bottom navigation">`
 * landmark, so the assertions key off that landmark rather than class names.
 *
 * Every data source is mocked: the page reads a product through
 * useProductDetailData and returns null without one, so the stub supplies a
 * minimal product plus an inert Supabase client for child components.
 */
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProductDetailPage from "@/pages/ProductDetailPage";

/** Mutable holders, hoisted so the vi.mock factories can read them. */
const state = vi.hoisted(() => ({
  product: null as Record<string, unknown> | null,
  totalItems: 0,
  recentIds: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => {
  /**
   * Chainable query stub. Query chains never settle, so child sections (Q&A,
   * recommendations, recently viewed) cannot push state updates after the test
   * body finishes — that keeps act() warnings out of the run. The page itself
   * renders from the mocked useProductDetailData hook, not from Supabase.
   */
  const chain: unknown = new Proxy(function () {}, {
    get: (_target, prop) =>
      prop === "then" ? () => new Promise(() => {}) : chain,
    apply: () => chain,
  });
  return { supabase: chain };
});

vi.mock("@/hooks/useProductDetail", () => ({
  useProductDetailData: () => ({
    product: { data: state.product },
    seller: { data: { user_id: "seller-1", full_name: "Test Store", is_verified: true } },
    soldCount: { data: 0 },
    docs: { data: [] },
    variants: { data: [] },
    reviews: { data: [] },
    keywords: { data: [] },
    sellerFollowerCount: { data: 0 },
    sellerAvgRating: null,
    sellerTotalSold: { data: 0 },
    loading: false,
  }),
  useCanReview: () => ({ data: { canReview: false, alreadyReviewed: false } }),
}));

vi.mock("@/hooks/useCart", () => {
  // Stable references: a fresh [] every render would re-trigger consumer effects.
  const items: never[] = [];
  const groupedBySeller: Record<string, never[]> = {};
  return {
    useCart: () => ({
      items,
      groupedBySeller,
      loading: false,
      addItem: () => {},
      replaceItems: () => {},
      syncItems: () => {},
      directCheckoutItem: null,
      beginDirectCheckout: () => {},
      updateDirectCheckoutItem: () => {},
      clearDirectCheckout: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      totalItems: state.totalItems,
      totalPrice: 0,
      isOpen: false,
      setIsOpen: () => {},
    }),
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    session: null,
    profile: null,
    role: null,
    loading: false,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    refetchProfile: async () => {},
  }),
}));

vi.mock("@/hooks/useCurrency", () => {
  const ngn = { code: "NGN", symbol: "\u20A6", rate: 1550 };
  return {
    CurrencyProvider: ({ children }: { children: ReactNode }) => children,
    // Mirrors every field of CurrencyContextType in src/hooks/useCurrency.tsx —
    // RegionalPreferences in the navbar maps over `currencies`.
    useCurrency: () => ({
      currency: ngn,
      currencies: { NGN: ngn, USD: { code: "USD", symbol: "$", rate: 1 } },
      country: null,
      detectedCountry: null,
      setCurrencyCode: () => {},
      setCountry: () => {},
      convertPrice: (amount: number) => amount,
      formatPrice: (amount: number) => `$${amount.toFixed(2)}`,
    }),
  };
});

vi.mock("@/hooks/useWishlist", () => {
  const result = {
    wishlistIds: [] as string[],
    toggleWishlist: () => {},
    isWishlisted: () => false,
    refetch: async () => {},
  };
  return { useWishlist: () => result };
});

vi.mock("@/hooks/useRecentlyViewed", () => ({
  // state.recentIds keeps a stable identity: RecentlyViewed re-fetches whenever
  // `ids` changes, so a fresh array here would loop forever.
  useRecentlyViewed: () => ({ ids: state.recentIds, add: () => {}, clear: () => {} }),
}));

vi.mock("@/hooks/useResolvedPolicies", () => {
  const result = {
    policies: {},
    data: null,
    isLoading: false,
    isError: false,
    refetch: async () => {},
    sourceLabel: "",
  };
  return { useResolvedPolicies: () => result };
});

vi.mock("@/hooks/useSEO", () => ({ useProductSEO: () => {} }));
vi.mock("@/lib/productDiscovery", () => ({ trackProductDiscovery: () => {} }));
vi.mock("@/hooks/useBatchedViewTracking", () => ({ trackView: () => {} }));

const baseProduct = {
  id: "p1",
  title: "Test Product",
  price: 100,
  compare_at_price: null,
  currency: "NGN",
  description: "A product used by the bottom-bar regression test.",
  description_images: [],
  product_images: [{ id: "img-1", image_url: "https://example.test/p1.jpg", is_primary: true }],
  key_features: [],
  seller_id: "seller-1",
  category_id: "cat-1",
  average_rating: 4.5,
  review_count: 3,
  stock_quantity: 12,
  low_stock_threshold: 2,
  variants: { sizes: [], colors: [] },
  brand: "Acme",
  material: null,
  color: null,
  dimensions: null,
  weight: null,
  condition: null,
  warranty: null,
  warranty_period: null,
  meta_description: null,
};

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={["/product/p1"]}
      // Opt in early so the router does not log its v7 deprecation warnings.
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/product/:id" element={<ProductDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The one bar fixed to the viewport bottom for mobile. */
function bottomBar(container: HTMLElement) {
  const bar = container.querySelector("div.fixed.bottom-0");
  expect(bar).not.toBeNull();
  return bar as HTMLElement;
}

describe("ProductDetailPage mobile bottom chrome", () => {
  beforeEach(() => {
    state.product = { ...baseProduct };
    state.totalItems = 5;
  });

  it("mounts a single bottom bar instead of the tab bar", () => {
    const { container } = renderPage();
    // BottomTabBar is the only bottom bar exposing this landmark.
    expect(
      screen.queryByRole("navigation", { name: /bottom navigation/i }),
    ).not.toBeInTheDocument();
    // Nothing else may be pinned to the viewport bottom either: the page used to
    // also mount the tab bar here, which duplicated the cart icon and the count.
    const pinned = container.querySelectorAll("[class*='fixed'][class*='bottom-0']");
    expect(pinned).toHaveLength(1);
    expect(within(pinned[0] as HTMLElement).getAllByRole("button", { name: /open cart/i })).toHaveLength(1);
  });

  it("pins the action bar to the viewport bottom, below sheets and the cart drawer", () => {
    const { container } = renderPage();
    const bar = bottomBar(container);
    expect(bar.className).toContain("bottom-0");
    // SheetContent overlay + content are z-50 (src/components/ui/sheet.tsx) and
    // CartDrawer is that same Sheet, so the bar must not outrank them.
    expect(bar.className).toContain("z-40");
    expect(bar.className).not.toContain("z-[60]");
  });

  it("keeps the store, chat and buy actions reachable from the bar", () => {
    const { container } = renderPage();
    const bar = bottomBar(container);
    expect(within(bar).getByRole("button", { name: "Add to Cart" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Buy Now" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Visit store" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Chat with seller" })).toBeInTheDocument();
  });

  it("announces the cart count and drops the count when the cart is empty", () => {
    const { container } = renderPage();
    expect(
      within(bottomBar(container)).getByRole("button", { name: "Open cart, 5 items" }),
    ).toBeInTheDocument();

    state.totalItems = 0;
    const empty = renderPage();
    expect(within(bottomBar(empty.container)).getByRole("button", { name: "Open cart" })).toBeInTheDocument();
  });

  it("swaps Add to Cart for Out of stock when the product cannot be bought", () => {
    state.product = { ...baseProduct, stock_quantity: 0 };
    const { container } = renderPage();
    const bar = bottomBar(container);
    expect(within(bar).getByRole("button", { name: "Out of stock" })).toBeDisabled();
    expect(within(bar).getByRole("button", { name: "Buy Now" })).toBeDisabled();
  });
});
