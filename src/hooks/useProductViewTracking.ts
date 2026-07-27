import { useEffect, useRef, useCallback } from "react";
import { trackProductDiscovery } from "@/lib/productDiscovery";

const OBSERVER_THRESHOLD = 0.6;
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

export function useProductViewTracking(productId: string) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewed = getViewedIds();
    if (viewed.has(productId)) {
      trackedRef.current = true;
      return;
    }

    const node = nodeRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.intersectionRatio >= OBSERVER_THRESHOLD && !trackedRef.current) {
          trackedRef.current = true;
          trackProductDiscovery(productId, "view");
          markViewed(productId);
          observer.disconnect();
        }
      },
      { threshold: OBSERVER_THRESHOLD }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [productId]);

  const ref = useCallback((el: HTMLDivElement | null) => {
    nodeRef.current = el;
  }, []);

  return { ref };
}