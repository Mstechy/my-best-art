import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@/lib/i18n/config";
import { applyTheme, getPreferredTheme } from "@/lib/theme";

applyTheme(getPreferredTheme());

// Lazy-load Sentry only when a DSN is configured to keep it out of the main bundle.
// This also enables the dynamic import in errorHandler.ts to split @sentry/react into its own chunk.
//
// Sentry must never compete with the LCP path. @sentry/react is a heavy module
// and measured ~1.2s of main-thread work when imported during startup, which
// delayed the hero paint by seconds. Gate it behind the load event and then an
// idle callback so it lands well after the first contentful paint and the hero
// render. The trade-off is deliberate: an error thrown during the first paint
// window is not reported, which is far cheaper than delaying LCP on every visit.
if (import.meta.env.VITE_SENTRY_DSN) {
  const startSentry = () =>
    import("@/lib/sentry")
      .then(({ initSentry }) => initSentry())
      .catch(() => {
        // Sentry is optional and non-fatal
      });

  const initWhenIdle = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(startSentry, { timeout: 5000 });
    } else {
      window.setTimeout(startSentry, 2000);
    }
  };

  if (document.readyState === "complete") {
    initWhenIdle();
  } else {
    window.addEventListener("load", initWhenIdle, { once: true });
  }
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
