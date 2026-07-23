import { useCallback, useRef } from "react";

const prefetched = new Set<string>();
const chunkHrefs = new Set<string>();

function prefetchChunk(href: string) {
  if (typeof document === "undefined" || chunkHrefs.has(href)) return;
  chunkHrefs.add(href);
  const link = document.createElement("link");
  link.rel = "modulepreload";
  link.href = href;
  document.head.appendChild(link);
}

export function usePrefetchProduct() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetch = useCallback((productId: string, chunkHref?: string) => {
    if (prefetched.has(productId)) return;
    prefetched.add(productId);
    if (chunkHref) prefetchChunk(chunkHref);
  }, []);

  const handleMouseEnter = useCallback((productId: string, chunkHref?: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      prefetch(productId, chunkHref);
    }, 80);
  }, [prefetch]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { handleMouseEnter, handleMouseLeave, prefetch };
}