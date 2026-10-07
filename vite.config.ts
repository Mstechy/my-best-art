import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import path from "path";
import { prerenderProductPages } from "./scripts/prerenderProductPages";
import { preloadLandingRoute } from "./scripts/preloadLandingRoute";
import { prerenderPublicPages } from "./scripts/prerenderPublicPages";

// Identify the exact deploy in error reports. VITE_APP_VERSION wins when CI sets
// it; otherwise the git short SHA does, so every build is distinguishable in
// Sentry instead of collapsing into one "1.0.0" release.
function resolveAppVersion(): string {
  const fromEnv = process.env.VITE_APP_VERSION;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "dev";
  }
}

const APP_VERSION = resolveAppVersion();

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  // Order matters: `preloadLandingRoute` rewrites dist/index.html from the
  // chunk graph, and `prerenderProductPages` reads that same file to seed the
  // product pages - so the preload block has to be there before it is read,
  // even though the product pages then strip it again.
  // Both prerenderers are `writeBundle` hooks and Vite awaits plugins in
  // registration order, so the page prerenderer reads the same untouched shell
  // the product one did, with the preload block already in place. It writes only
  // the non-product routes; see scripts/prerenderPublicPages.ts.
  plugins: [react(), preloadLandingRoute(), prerenderProductPages(), prerenderPublicPages()],
  // Inline the deploy identity so src/lib/sentry.ts can name the exact release.
  // Without this define the constant computed above is thrown away, and every
  // production build reports "dev" in error monitoring.
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION),
  },
  build: {
    // es2022 keeps class static blocks, top-level await and `.at()` native, so
    // browsers stop receiving transpiled fallbacks. Lighthouse was penalising the
    // es2020 output with an "avoid serving legacy JavaScript" deduction.
    target: "es2022",
    cssMinify: "lightningcss",
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Keep only stable, shared runtime dependencies in the initial graph.
        // Recharts, Sentry, and dashboard primitives are route-level code and
        // must remain in their lazy import graph.
        //
        // lucide-react is deliberately NOT listed here (it used to be, as
        // "icons"): forcing every icon the app references into one shared chunk
        // makes that chunk entry-reachable the moment ANY eagerly-loaded module
        // imports a single icon - the landing shell imports six, so the icons
        // every admin, seller and buyer page needs would download and parse
        // before first paint. Without the rule each icon lands in the graph that
        // uses it, and dashboard-only icons stay in their lazy routes.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack/react-query")) return "react-query";
          if (id.includes("react-router")) return "router";
          if (id.includes("node_modules\\react") || id.includes("node_modules/react")) return "react";
        },
      },
    },
    // Route-level chart libraries can be larger than the main entry while still
    // being outside the initial page graph. Keep the threshold useful without
    // hiding unexpectedly large shared chunks.
    chunkSizeWarningLimit: 400,
    sourcemap: false,
    reportCompressedSize: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
});
