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
// Sentry must never compete with the LCP path. @sentry/react measured 1185ms of
// main-thread work on desktop and 2476ms on a throttled mobile connection.
//
// The previous gate used requestIdleCallback({ timeout: 5000 }). That timeout is
// the bug: it FORCES the callback to run after 5s even when the main thread is
// saturated, so on slow connections Sentry initialised during the LCP window
// anyway. Idle time does not exist while React is blocking the main thread.
//
// Instead, wait for a real idle period with NO timeout, and skip entirely on
// save-data and 2G, where the extra payload costs users real money for nothing.
// The trade-off stays deliberate: an error thrown before Sentry loads is not
// reported, which is far cheaper than delaying LCP on every visit.
if (import.meta.env.VITE_SENTRY_DSN) {
  const startSentry = () =>
    import("@/lib/sentry")
      .then(({ initSentry }) => initSentry())
      .catch(() => {
        // Sentry is optional and non-fatal
      });

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  const isConstrained = !!connection?.saveData || connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g";

  if (!isConstrained) {
    const initWhenIdle = () => {
      if ("requestIdleCallback" in window) {
        // Long backstop only: genuine idle time is what normally triggers this.
        // The point is that it is far longer than the LCP window, so a saturated
        // main thread no longer forces Sentry to initialise early.
        window.requestIdleCallback(startSentry, { timeout: 30000 });
      } else {
        window.setTimeout(startSentry, 5000);
      }
    };

    if (document.readyState === "complete") {
      initWhenIdle();
    } else {
      window.addEventListener("load", initWhenIdle, { once: true });
    }
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
