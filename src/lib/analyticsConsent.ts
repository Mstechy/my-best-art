import { readMigrated, writeMigrated } from "@/lib/legacyBrandStorage";

export const COOKIE_CONSENT_KEY = "tradibu_cookie_consent";
const LEGACY_COOKIE_CONSENT_KEY = "markethub_cookie_consent";
export const ANALYTICS_CONSENT_CHANGED = "tradibu:analytics-consent-changed";

/** The stored choice, migrated from the pre-rebrand key on first read. */
export function readAnalyticsConsent(): "accepted" | "declined" | null {
  const choice = readMigrated(COOKIE_CONSENT_KEY, LEGACY_COOKIE_CONSENT_KEY);
  return choice === "accepted" || choice === "declined" ? choice : null;
}

/**
 * Persist a consent choice. Also stamps when the choice was made, and clears
 * the legacy key so a visitor who already decided is never asked again after
 * the rebrand.
 */
export function saveAnalyticsConsent(choice: "accepted" | "declined"): void {
  writeMigrated(COOKIE_CONSENT_KEY, LEGACY_COOKIE_CONSENT_KEY, choice);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${COOKIE_CONSENT_KEY}_at`, new Date().toISOString());
    } catch {
      // The timestamp is informational; its absence must not block consent.
    }
  }
}

export function hasAnalyticsConsent(): boolean {
  return readAnalyticsConsent() === "accepted";
}

export function notifyAnalyticsConsentChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED));
  }
}

