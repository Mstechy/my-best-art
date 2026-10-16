/**
 * One-time storage-key migration for the MarketHub -> Tradibu rebrand.
 *
 * Several keys users already have stored in their browser were written under
 * the previous brand (`markethub_*`). Renaming them outright would silently
 * reset every returning visitor: their saved language, their cookie-consent
 * choice, their anonymous cart's visitor id and every seller's in-progress
 * listing draft would look abandoned.
 *
 * Every renamed key therefore reads through `readMigrated`: the current
 * (Tradibu) key wins, and when it is empty the value is copied forward from
 * the legacy key exactly once and the legacy entry is deleted. Writes always
 * go to the current key and clear the legacy one, so within one session the
 * legacy entries drain away and these helpers degrade to plain get/set.
 */

export function readMigrated(key: string, legacyKey: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(key);
    if (current !== null) return current;
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy === null) return null;
    window.localStorage.setItem(key, legacy);
    window.localStorage.removeItem(legacyKey);
    return legacy;
  } catch {
    // Storage can throw in private-browsing modes; callers treat null as
    // "nothing stored", which is the same fallback they already had.
    return null;
  }
}

export function writeMigrated(key: string, legacyKey: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
    window.localStorage.removeItem(legacyKey);
  } catch {
    // Ignore: a failed write only means the value will not persist.
  }
}

export function removeMigrated(key: string, legacyKey: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(legacyKey);
  } catch {
    // Ignore: nothing to clean up if storage is unavailable.
  }
}
