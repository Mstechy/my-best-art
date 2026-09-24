import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
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
}));
