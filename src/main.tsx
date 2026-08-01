import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/lib/i18n/config";
import { applyTheme, getPreferredTheme } from "@/lib/theme";

applyTheme(getPreferredTheme());

// Lazy-load Sentry only when a DSN is configured to keep it out of the main bundle.
// This also enables the dynamic import in errorHandler.ts to split @sentry/react into its own chunk.
if (import.meta.env.VITE_SENTRY_DSN) {
  import("@/lib/sentry").then(({ initSentry }) => initSentry()).catch(() => {
    // Sentry is optional and non-fatal
  });
}

// Register service worker for asset caching and offline support
if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {
      // Service worker registration failure is non-fatal
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
