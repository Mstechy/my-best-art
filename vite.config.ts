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
          if (id.includes("node_modules\\react") || id.includes("node_modules/react")) return "react";
          return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 200,
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