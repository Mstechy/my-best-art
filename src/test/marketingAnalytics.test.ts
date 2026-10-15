import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_CONSENT_KEY, hasAnalyticsConsent } from "@/lib/analyticsConsent";
import { buildGA4PurchaseEvent, trackGA4Event } from "@/lib/marketingAnalytics";
import { observeProductImpression } from "@/lib/productImpressionObserver";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("analytics consent", () => {
  it("allows optional analytics only after acceptance", () => {
    expect(hasAnalyticsConsent()).toBe(false);
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    expect(hasAnalyticsConsent()).toBe(false);
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("does not send events when consent is declined", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined");
    expect(trackGA4Event("view_item", {})).toBe(false);
    expect(document.getElementById("tradibu-ga4")).toBeNull();
  });
});

describe("buildGA4PurchaseEvent", () => {
  it("preserves transaction details and copies the items array", () => {
    const item = { item_id: "product-1", item_name: "Sample product", price: 12500, quantity: 2 };
    const purchase = {
      transaction_id: "paystack-reference",
      value: 25000,
      currency: "NGN",
      items: [item],
    };

    const event = buildGA4PurchaseEvent(purchase);

    expect(event).toEqual(purchase);
    expect(event.items).not.toBe(purchase.items);
    expect(event.items[0]).not.toBe(item);
  });
});

describe("observeProductImpression", () => {
  it("shares an observer and reports only visible product cards", () => {
    const instances: Array<{
      callback: IntersectionObserverCallback;
      observe: ReturnType<typeof vi.fn>;
      unobserve: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      trigger: (target: Element, ratio: number) => void;
    }> = [];
    class MockIntersectionObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();

      constructor(public callback: IntersectionObserverCallback) {
        instances.push(this);
      }

      trigger(target: Element, ratio: number) {
        this.callback(
          [{ target, intersectionRatio: ratio } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const first = document.createElement("div");
    const second = document.createElement("div");
    const onFirstImpression = vi.fn();
    const onSecondImpression = vi.fn();
    const stopFirst = observeProductImpression(first, onFirstImpression);
    const stopSecond = observeProductImpression(second, onSecondImpression);
    const [observer] = instances;

    expect(instances).toHaveLength(1);
    observer.trigger(first, 0.59);
    expect(onFirstImpression).not.toHaveBeenCalled();
    observer.trigger(first, 0.6);
    expect(onFirstImpression).toHaveBeenCalledOnce();
    expect(onSecondImpression).not.toHaveBeenCalled();

    stopFirst();
    stopSecond();
    expect(observer.disconnect).toHaveBeenCalledOnce();
  });
});
