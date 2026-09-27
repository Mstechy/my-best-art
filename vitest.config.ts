import { defineConfig } from "vitest/config";
import type { Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Two Vite majors are installed. The root vite@8 (rolldown) types
// @vitejs/plugin-react, while vitest@3 bundles its own vite@7 (rollup) and types its
// own `plugins` option from that copy. The plugin instances are interchangeable at
// runtime - the test suite and the production build both work - but the two copies of
// Vite's Plugin type are structurally incompatible, which is what produced
// "No overload matches this call". Cast once here, at the boundary, rather than
// silencing the error for the whole file. Aligning the Vite majors is tracked as a
// dependency task.
const reactPlugin = react() as unknown as Plugin;

export default defineConfig({
  plugins: [reactPlugin],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Vitest defaults to a 5s per-test budget. Three component-mount tests
    // (dashboardResponsiveShell, productDetailMobileBar, sellerListingDraftRecovery)
    // exceeded it whenever the suite shared a machine with a production build or a
    // typecheck, so CI produced failures that had nothing to do with the code. A
    // generous budget keeps a genuinely hung test failing while removing the
    // load-dependent false negatives.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
