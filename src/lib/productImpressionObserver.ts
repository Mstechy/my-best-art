const IMPRESSION_THRESHOLD = 0.6;
const callbacks = new Map<Element, () => void>();
let sharedObserver: IntersectionObserver | null = null;

export function observeProductImpression(node: Element, callback: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};

  callbacks.set(node, callback);
  const observer = sharedObserver ?? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.intersectionRatio < IMPRESSION_THRESHOLD) return;
      const onImpression = callbacks.get(entry.target);
      if (!onImpression) return;
      callbacks.delete(entry.target);
      const activeObserver = sharedObserver;
      activeObserver?.unobserve(entry.target);
      onImpression();
      if (callbacks.size === 0 && sharedObserver === activeObserver) {
        activeObserver?.disconnect();
        sharedObserver = null;
      }
    });
  }, { threshold: IMPRESSION_THRESHOLD });
  sharedObserver = observer;
  observer.observe(node);

  return () => {
    callbacks.delete(node);
    observer.unobserve(node);
    if (callbacks.size === 0 && sharedObserver === observer) {
      observer.disconnect();
      sharedObserver = null;
    }
  };
}
