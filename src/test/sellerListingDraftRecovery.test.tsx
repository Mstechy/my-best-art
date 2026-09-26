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
import type { RestoredMedia } from "@/lib/listingDraftMedia";

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

/**
 * The draft's files live in IndexedDB, which jsdom does not implement. Mocking
 * the store keeps these tests focused on the behaviour the page guarantees:
 * whatever the store hands back must reappear in the form, and discarding must
 * clear the store so a later draft cannot resurrect the photos.
 *
 * The parameter types are declared explicitly. A bare `vi.fn(async () => {})`
 * infers a zero-argument signature, so calling it with the draft key is a
 * compile error; annotating the parameter is what makes these usable as
 * assertions on *which* draft was touched.
 */
const mockLoadDraftMedia = vi.fn<(key: string) => Promise<RestoredMedia>>();
const clearDraftMediaSpy = vi.fn<(key: string) => Promise<void>>(async () => {});
const saveDraftMediaSpy = vi.fn<(key: string, files: unknown[]) => Promise<void>>(async () => {});

vi.mock("@/lib/listingDraftMedia", () => ({
  loadDraftMedia: (key: string) => mockLoadDraftMedia(key),
  saveDraftMedia: (key: string, files: unknown[]) => saveDraftMediaSpy(key, files),
  clearDraftMedia: (key: string) => clearDraftMediaSpy(key),
  hasDraftMedia: vi.fn<(key: string) => Promise<boolean>>(async () => false),
  pruneExpiredMedia: vi.fn<() => Promise<number>>(async () => 0),
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
  mockLoadDraftMedia.mockReset();
  mockLoadDraftMedia.mockResolvedValue({
    images: [],
    descriptionImages: [],
    videos: [],
    doc: null,
  });
  clearDraftMediaSpy.mockClear();
  // The page mints object URLs for restored files. jsdom has no URL.createObjectURL,
  // and without this the restore path throws before it can update state.
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = () => "blob:mock";
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = () => {};
  }
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

  it("restores the draft's photos when reopening an unfinished listing", async () => {
    // A JPEG-shaped File: the page re-reads .name and .type when rebuilding the
    // item, and a file with no type would be dropped by the accept filters.
    const restored = new File(["fake-bytes"], "front-view.jpg", { type: "image/jpeg" });
    mockLoadDraftMedia.mockResolvedValue({
      images: [restored],
      descriptionImages: [],
      videos: [],
      doc: null,
    });
    seedDraft();
    render(<SellerProducts />);
    await screen.findByText("Add New Product");
    await settle();

    // Radix Tabs activates on pointerdown, so a bare `click` is not enough to
    // switch steps in jsdom; the full pointer sequence is required.
    const photosTab = screen.getByRole("tab", { name: /photos/i });
    fireEvent.pointerDown(photosTab, { button: 0 });
    fireEvent.mouseDown(photosTab, { button: 0 });
    fireEvent.pointerUp(photosTab, { button: 0 });
    fireEvent.click(photosTab);
    await settle();

    // The counter is `{count}/{max} images` in the JSX, which renders as three
    // separate text nodes, so match on the element's own textContent.
    expect(
      screen.getByText((_content, element) => element?.textContent === "1/12 images"),
    ).toBeInTheDocument();
    expect(screen.getByText("front-view.jpg")).toBeInTheDocument();
  });

  it("clears the stored files when the draft is discarded", async () => {
    mockLoadDraftMedia.mockResolvedValue({
      images: [new File(["b"], "old-photo.jpg", { type: "image/jpeg" })],
      descriptionImages: [],
      videos: [],
      doc: null,
    });
    seedDraft();
    render(<SellerProducts />);
    await screen.findByText("Add New Product");
    await settle();

    fireEvent.click(screen.getByRole("button", { name: /discard draft/i }));
    await settle();

    // Without this the blobs would outlive the text draft and reappear in the
    // next "Add Product".
    expect(clearDraftMediaSpy).toHaveBeenCalledWith(DRAFT_KEY);
  });
});

