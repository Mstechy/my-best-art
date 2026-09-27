import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import path from "path";

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
  plugins: [react()],
  // Inline the deploy identity so src/lib/sentry.ts can name the exact release.
  // Without this define the constant computed above is thrown away, and every
  // production build reports "dev" in error monitoring.
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(APP_VERSION),
  },
  build: {
    target: "es2020",
    cssMinify: "lightningcss",
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Keep only stable, shared runtime dependencies in the initial graph.
        // Recharts, Sentry, and dashboard primitives are route-level code and
        // must remain in their lazy import graph.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@tanstack/react-query")) return "react-query";
          if (id.includes("react-router")) return "router";
          if (id.includes("lucide-react")) return "icons";
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
