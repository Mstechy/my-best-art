import { cacheClear } from "@/lib/cache";
import { persistentCacheDelete } from "@/lib/indexedDBCache";
import { COOKIE_CONSENT_KEY, notifyAnalyticsConsentChanged } from "@/lib/analyticsConsent";

/** Deliberately named keys: never replace this list with localStorage.clear(). */
export const LOCAL_BROWSING_KEYS = [
  "recently_viewed_products",
  "viewed_product_ids",
] as const;

export const LOCAL_PREFERENCE_KEYS = [
  "preferred_country",
  "preferred_currency",
  "preferred_country_manual",
  "preferred_currency_manual",
  "tradibu:ip-country:v1",
  "tradibu_language",
  "theme",
] as const;

function removeLocalKeys(keys: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Browsers may deny storage access in private or restricted contexts.
  }
}

/** Removes only local product browsing history and impression de-duplication. */
export function clearLocalBrowsingHistory(): void {
  removeLocalKeys(LOCAL_BROWSING_KEYS);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tradibu:local-browsing-history-cleared"));
  }
}

/**
 * Removes the anonymous cart cache only. Authenticated carts live on the
 * server and are intentionally not touched by this local-data control.
 */
export async function clearGuestCart(): Promise<void> {
  await persistentCacheDelete("anon_cart");
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem("direct_checkout_item");
    } catch {
      // Session storage can be unavailable; IndexedDB cleanup still ran.
    }
  }
}

/** Clears only in-memory query helpers, never authentication or server data. */
export function clearLocalCatalogueCache(): void {
  cacheClear();
}

/**
 * Resets local preference and consent choices without affecting account data.
 * Server-side analytics are not deleted by this browser-only operation.
 */
export function resetLocalPreferences(): void {
  removeLocalKeys([
    ...LOCAL_PREFERENCE_KEYS,
    COOKIE_CONSENT_KEY,
    `${COOKIE_CONSENT_KEY}_at`,
    "tradibu_visitor_id",
  ]);
  notifyAnalyticsConsentChanged();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("tradibu:local-preferences-reset"));
  }
}
