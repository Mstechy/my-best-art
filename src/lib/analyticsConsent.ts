export const COOKIE_CONSENT_KEY = "markethub_cookie_consent";
export const ANALYTICS_CONSENT_CHANGED = "tradibu:analytics-consent-changed";

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}

export function notifyAnalyticsConsentChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED));
  }
}
