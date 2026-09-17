/**
 * Vitest setup.
 *
 * NOTE: vitest.config.ts has always pointed `setupFiles` at this path, but the
 * file (and the whole src/test directory) did not exist, so `npm test` failed
 * before running a single test. This restores the harness.
 */
import "@testing-library/jest-dom/vitest";

/**
 * jsdom implements neither matchMedia nor ResizeObserver, and Radix UI
 * primitives (used throughout src/components/ui) require both on mount.
 * Without these stubs any test that renders a shadcn component throws.
 */
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
}

if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverStub {
    root = null;
    rootMargin = "";
    thresholds: number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    IntersectionObserverStub;
}
