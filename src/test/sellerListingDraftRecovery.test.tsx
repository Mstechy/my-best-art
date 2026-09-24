/**
 * Regression guard for the seller listing draft-recovery effect.
 *
 * SellerProducts.tsx auto-reopens an unfinished listing when the signed-in
 * seller changes ("draftKey"). That effect also reads the live dialog state, so
 * the tempting fix for the exhaustive-deps warning is to add `dialogOpen` /
 * `editingProduct` to its dependency array — but that is wrong: the dialog
 * closes on every "Minimize" press, so those dependencies make the effect fire
 * on the way out and instantly reopen the very form the seller just put away.
 *
 * These tests pin both halves of the contract:
 *   1. a stored draft still reopens on mount (recovery keeps working), and
 *   2. closing the dialog leaves it closed (the effect is keyed to draftKey).
 *
 * Supabase is stubbed with a chain whose queries never settle (the same trick
 * productDetailMobileBar.test.tsx uses), so the page mounts its real component
 * tree — including the Radix dialog — without network access and without async
 * state updates landing after the assertions.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SellerProducts from "@/pages/seller/SellerProducts";

const USER_ID = "seller-1";
const DRAFT_KEY = `markethub:product-listing-draft:${USER_ID}`;

vi.mock("@/integrations/supabase/client", () => {
  /** Chainable stub: every query hangs, so no data-driven re-render happens. */
  const chain: unknown = new Proxy(function () {}, {
    get: (_target, prop) =>
      prop === "then" ? () => new Promise(() => {}) : chain,
    apply: () => chain,
  });
  return { supabase: chain };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: USER_ID, email: "seller@example.com" },
    session: null,
    profile: null,
    role: "seller",
    loading: false,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    refetchProfile: async () => {},
  }),
}));

/** Mirrors the ProductFormDraft shape the page writes to localStorage. */
function seedDraft(title = "Seeded draft listing") {
  window.localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      title,
      description: "",
      price: "",
      compareAtPrice: "",
      currency: "NGN",
      categoryId: "",
      stockQuantity: "",
      sku: "",
      brand: "",
      weight: "",
      dimensions: "",
      material: "",
      color: "",
      condition: "new",
      warrantyPeriod: "none",
      shippingInfo: "",
      keyFeatures: [""],
      tagsInput: "",
      shipsTo: [],
      categoryAttributes: {},
      productTypeKey: "",
      variantRows: [],
      variantColorValues: "",
      variantStorageValues: "",
      variantPrimaryOption: "storage",
      showSoldCount: true,
      formTab: "basic",
      seoSlug: "",
      metaDescription: "",
      lowStockThreshold: "5",
    }),
  );
}

/** Lets the effects and microtasks queued by a state update flush. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("seller listing draft recovery", () => {
  it("reopens the unfinished listing when the page mounts", async () => {
    seedDraft();

    render(<SellerProducts />);

    expect(await screen.findByText("Add New Product")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Seeded draft listing")).toBeInTheDocument();
  });

  it("keeps the dialog closed after Minimize, keeping the draft", async () => {
    seedDraft();
    render(<SellerProducts />);
    await screen.findByText("Add New Product");

    fireEvent.click(screen.getByRole("button", { name: /minimize/i }));
    await settle();

    expect(screen.queryByText("Add New Product")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue listing/i })).toBeInTheDocument();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it("discards the stored draft and stays closed", async () => {
    seedDraft();
    render(<SellerProducts />);
    await screen.findByText("Add New Product");

    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));
    await settle();

    expect(screen.queryByText("Add New Product")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
