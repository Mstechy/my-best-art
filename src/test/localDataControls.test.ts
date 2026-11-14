import { beforeEach, describe, expect, it, vi } from "vitest";

const { persistentCacheDelete } = vi.hoisted(() => ({
  persistentCacheDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/indexedDBCache", () => ({
  persistentCacheDelete,
}));

import {
  clearGuestCart,
  clearLocalBrowsingHistory,
  resetLocalPreferences,
} from "@/lib/localDataControls";

describe("local data controls", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    persistentCacheDelete.mockClear();
  });

  it("clears browsing history without touching unrelated storage", () => {
    localStorage.setItem("recently_viewed_products", '["product-1"]');
    localStorage.setItem("viewed_product_ids", '["product-1"]');
    localStorage.setItem("sb-project-auth-token", "session-is-not-history");

    clearLocalBrowsingHistory();

    expect(localStorage.getItem("recently_viewed_products")).toBeNull();
    expect(localStorage.getItem("viewed_product_ids")).toBeNull();
    expect(localStorage.getItem("sb-project-auth-token")).toBe("session-is-not-history");
  });

  it("clears only the anonymous cart cache and direct checkout session", async () => {
    sessionStorage.setItem("direct_checkout_item", '{"id":"product-1"}');

    await clearGuestCart();

    expect(persistentCacheDelete).toHaveBeenCalledWith("anon_cart");
    expect(sessionStorage.getItem("direct_checkout_item")).toBeNull();
  });

  it("resets named local preferences without clearing auth storage", () => {
    localStorage.setItem("preferred_country", "NG");
    localStorage.setItem("preferred_currency_manual", "true");
    localStorage.setItem("tradibu_cookie_consent", "accepted");
    localStorage.setItem("sb-project-auth-token", "session-is-not-preferences");

    resetLocalPreferences();

    expect(localStorage.getItem("preferred_country")).toBeNull();
    expect(localStorage.getItem("preferred_currency_manual")).toBeNull();
    expect(localStorage.getItem("tradibu_cookie_consent")).toBeNull();
    expect(localStorage.getItem("sb-project-auth-token")).toBe("session-is-not-preferences");
  });
});
