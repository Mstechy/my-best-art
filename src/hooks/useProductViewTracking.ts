import { useEffect, useRef, useCallback } from "react";
import { trackProductDiscovery } from "@/lib/productDiscovery";
import { observeProductImpression } from "@/lib/productImpressionObserver";

const VIEWED_SET_KEY = "viewed_product_ids";

function getViewedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(VIEWED_SET_KEY);
    if (!raw) return new Set();
    return new Set<string>(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function markViewed(id: string) {
  const set = getViewedIds();
  set.add(id);
  try {
    localStorage.setItem(VIEWED_SET_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // quota exceeded — silently fail
  }
}

export function useProductViewTracking(productId: string, onImpression?: () => void) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const trackedRef = useRef(false);
  const impressionTrackedRef = useRef(false);
  const onImpressionRef = useRef(onImpression);
  onImpressionRef.current = onImpression;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewed = getViewedIds();
    trackedRef.current = viewed.has(productId);
    impressionTrackedRef.current = false;

    const node = nodeRef.current;
    if (!node || (trackedRef.current && !onImpressionRef.current)) return;

    return observeProductImpression(node, () => {
      impressionTrackedRef.current = true;
      if (!trackedRef.current) {
        trackedRef.current = true;
        trackProductDiscovery(productId, "view");
        markViewed(productId);
      }
      onImpressionRef.current?.();
    });
  }, [productId]);

  const ref = useCallback((el: HTMLDivElement | null) => {
    nodeRef.current = el;
  }, []);

  return { ref };
}