import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
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
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix-ui";
          if (id.includes("recharts")) return "charts";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("@tanstack/react-query")) return "react-query";
          if (id.includes("@tanstack/react-virtual")) return "react-virtual";
          if (id.includes("react-hook-form") || id.includes("@hookform")) return "forms";
          if (id.includes("zod")) return "validation";
          if (id.includes("react-router")) return "router";
          if (id.includes("sonner")) return "toast";
          if (id.includes("i18next")) return "i18n";
          if (id.includes("embla-carousel")) return "carousel";
          if (id.includes("date-fns")) return "dates";
          if (id.includes("dexie") || id.includes("idb")) return "db";
          if (id.includes("@sentry")) return "sentry";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("node_modules\\react") || id.includes("node_modules/react")) return "react";
          return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 300,
    sourcemap: false,
    reportCompressedSize: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));