/**
 * Cross-tab signal for CMS hero changes.
 *
 * React Query caches are tab-local, so an admin publishing a banner cannot
 * invalidate a shopper's cache by itself. The storage event carries the
 * signal to other tabs, while the custom event refreshes the current tab.
 */
export const HERO_COLLECTIONS_CHANGED_EVENT = "tradibu:hero-collections-changed";
export const HERO_COLLECTIONS_CHANGED_STORAGE_KEY = "tradibu:hero-collections-changed-at";

export function notifyHeroCollectionsChanged(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(HERO_COLLECTIONS_CHANGED_STORAGE_KEY, String(Date.now()));
  } catch {
    // The custom event still refreshes the current tab when storage is blocked.
  }

  window.dispatchEvent(new Event(HERO_COLLECTIONS_CHANGED_EVENT));
}
