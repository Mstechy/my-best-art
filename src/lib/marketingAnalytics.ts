import { hasAnalyticsConsent } from "@/lib/analyticsConsent";

export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  item_brand?: string;
  item_category?: string;
}

interface PurchaseEvent {
  transaction_id: string;
  value: number;
  currency: string;
  items: AnalyticsItem[];
}

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID?.trim();
const sentPurchaseIds = new Set<string>();
let analyticsInitialized = false;

function initializeAnalytics(): boolean {
  if (!measurementId || !hasAnalyticsConsent() || typeof window === "undefined") return false;
  if (analyticsInitialized) return true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.id = "tradibu-ga4";
  document.head.appendChild(script);
  analyticsInitialized = true;
  return true;
}

export function trackGA4Event(
  eventName: string,
  parameters: Record<string, unknown>,
): boolean {
  if (!initializeAnalytics() || !window.gtag) return false;
  window.gtag("event", eventName, parameters);
  return true;
}

export function trackGA4PageView(pathname: string): void {
  trackGA4Event("page_view", {
    page_location: `${window.location.origin}${pathname}`,
    page_title: document.title,
  });
}

export function buildGA4PurchaseEvent(purchase: PurchaseEvent): PurchaseEvent {
  return {
    ...purchase,
    items: purchase.items.map((item) => ({ ...item })),
  };
}

export function trackVerifiedPurchase(purchase: PurchaseEvent): void {
  if (!hasAnalyticsConsent() || !measurementId || typeof window === "undefined") return;
  if (sentPurchaseIds.has(purchase.transaction_id)) return;
  let alreadySent = false;
  try {
    alreadySent = window.sessionStorage.getItem(`tradibu_ga4_purchase_${purchase.transaction_id}`) === "sent";
  } catch {
    // GA4 transaction_id remains the cross-session duplicate guard.
  }
  if (alreadySent) return;

  const sent = trackGA4Event("purchase", { ...buildGA4PurchaseEvent(purchase) });
  if (!sent) return;

  sentPurchaseIds.add(purchase.transaction_id);
  try {
    window.sessionStorage.setItem(`tradibu_ga4_purchase_${purchase.transaction_id}`, "sent");
  } catch {
    // Keep the in-memory guard when session storage is unavailable.
  }
}
