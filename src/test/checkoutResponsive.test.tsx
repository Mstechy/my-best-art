/**
 * Responsive contract for /checkout.
 *
 * The page renders one primary CTA twice — inline in the order summary for
 * `md` and up, and inside a fixed bottom bar for phones — plus a two-column
 * layout that used to clip on a phone. Two separate defects are guarded here:
 *
 *   1. Grid children get a content-based min-width floor, so a long product
 *      title widened the order-summary column past a 390px viewport. The fix
 *      is `min-w-0` on both `lg:col-span-*` columns, and the paired field rows
 *      (City/State, ZIP/Country) must collapse to one column below `sm`.
 *   2. iOS Safari zooms the viewport when a focused input is below 16px, so
 *      every field carries `text-base md:text-sm`.
import { describe, expect, it, vi } from "vitest";
 *
 * jsdom cannot measure layout, so the viewport-specific classes are asserted
 * directly, following src/test/dashboardResponsiveShell.test.tsx.
 */
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CheckoutPage from "@/pages/CheckoutPage";

/** Mutable holder, hoisted so the vi.mock factories can read it. */
const state = vi.hoisted(() => ({
  items: [
    {
      id: "cart-1",
      product_id: "product-1",
      product_variant_id: null,
      title: "Probe wireless earbuds with charging case and spare tips",
      price: 130,
      quantity: 2,
      image_url: null as string | null,
      seller_id: "seller-1",
      stock_quantity: 9,
      variant_attributes: {},
    },
  ] as Array<Record<string, unknown>>,
}));

vi.mock("@/integrations/supabase/client", () => {
  /** Chainable stub: queries and RPCs never settle or throw. */
  const chain: unknown = new Proxy(function () {}, {
    get: (_target, prop) =>
      prop === "then" ? () => new Promise(() => {}) : chain,
    apply: () => chain,
  });
  return { supabase: chain };
});

vi.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    items: state.items,
    directCheckoutItem: null,
    groupedBySeller: {},
    loading: false,
    addItem: () => {},
    replaceItems: () => {},
    syncItems: () => {},
    beginDirectCheckout: () => {},
    updateDirectCheckoutItem: () => {},
    clearDirectCheckout: () => {},
    removeItem: () => {},
    updateQuantity: () => {},
    clearCart: () => {},
    totalItems: state.items.length,
    totalPrice: 0,
    isOpen: false,
    setIsOpen: () => {},
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (amount: number) => `$${amount.toFixed(2)}`,
    convertPrice: (amount: number) => amount,
  }),
}));

// Signed-out: the saved-address effect returns before touching Supabase.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

vi.mock("@/components/MarketplaceNavbar", () => ({
  default: (_props: { showSearch?: boolean }) => <nav aria-label="Marketplace" />,
}));

vi.mock("@/components/CartDrawer", () => ({ default: () => null }));

function renderCheckout() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CheckoutPage />
    </MemoryRouter>,
  );
}

/** Both "Place Order" affordances: the summary CTA and the mobile bar CTA. */
function placeOrderButtons(): HTMLElement[] {
  const buttons = screen.getAllByRole("button", { name: /place order/i });
  expect(buttons).toHaveLength(2);
  return buttons;
}

describe("checkout responsive layout", () => {
  it("pins Place Order in a mobile-only bottom bar and keeps the summary CTA inline from md up", () => {
    renderCheckout();

    const [first, second] = placeOrderButtons();
    const summaryCta = [first, second].find((button) => button.className.includes("hidden"));
    const mobileCta = [first, second].find((button) => !button.className.includes("hidden"));

    // The order-summary CTA exists but is hidden below `md`.
    expect(summaryCta).toBeDefined();
    expect(summaryCta?.className).toContain("md:flex");

    // The phone CTA lives in a fixed, full-width bar that only exists below
    // `md` and reserves room for the iOS home indicator.
    expect(mobileCta).toBeDefined();
    const bar = mobileCta?.parentElement?.parentElement;
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain("fixed");
    expect(bar?.className).toContain("inset-x-0");
    expect(bar?.className).toContain("bottom-0");
    expect(bar?.className).toContain("md:hidden");
    expect(bar?.className).toContain("env(safe-area-inset-bottom");

    // The bar overlays the page below `md`, so the scroll container reserves
    // bottom padding so the trust badges are not hidden behind it.
    const container = document.querySelector(".pb-28");
    expect(container).not.toBeNull();
    expect(container?.className).toContain("md:pb-8");
  });

  it("keeps every field at 16px on phones so iOS Safari does not zoom on focus", () => {
    renderCheckout();

    const fields = ["checkout-name", "checkout-phone", "checkout-street", "checkout-city", "checkout-state", "checkout-zip"];
    for (const id of fields) {
      const input = document.getElementById(id);
      expect(input, `#${id} should render`).not.toBeNull();
      expect(input?.className).toContain("text-base");
      expect(input?.className).toContain("md:text-sm");
      // Shrinkable inside its grid column instead of widening the card.
      expect(input?.className).toContain("min-w-0");
    }
  });

  it("collapses the paired field rows below sm and keeps both layout columns shrinkable", () => {
    renderCheckout();

    // City/State and ZIP/Country stack on phones, side by side from `sm`.
    for (const id of ["checkout-city", "checkout-zip"]) {
      const row = document.getElementById(id)?.parentElement?.parentElement;
      expect(row, `the row containing #${id} should render`).not.toBeNull();
      expect(row?.className).toContain("grid-cols-1");
      expect(row?.className).toContain("sm:grid-cols-2");
    }

    // Without `min-w-0` a grid item is floored by its content-based minimum,
    // which pushed the order summary past a phone viewport and clipped it.
    for (const column of ["lg\\:col-span-3", "lg\\:col-span-2"]) {
      const element = document.querySelector(`.${column}`);
      expect(element, `.${column} should render`).not.toBeNull();
      expect(element?.className).toContain("min-w-0");
    }
  });
});
