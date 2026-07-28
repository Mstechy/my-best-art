/**
 * Sentry error monitoring configuration.
 *
 * This module is a CONFIGURATION-ONLY wrapper around @sentry/react.
 * It is safe to import — if Sentry is not configured, calls are no-ops.
 *
 * To activate Sentry for your project:
 *   1. Create a Sentry account at https://sentry.io
 *   2. Create a new JavaScript/Vite project
 *   3. Copy your DSN (looks like: https://xxx@xxx.ingest.sentry.io/xxx)
 *   4. Set it in your .env file: VITE_SENTRY_DSN=your-dsn-here
 *
 * Sentry is already installed via npm. When DSN is present, it will:
 *   - Capture unhandled exceptions automatically
 *   - Capture unhandled promise rejections
 *   - Report errors via the logError() function
 *   - Track Core Web Vitals (LCP, FID, CLS)
 *   - Provide breadcrumbs for user interactions
 */

import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const IS_ACTIVE = Boolean(SENTRY_DSN);

let initialized = false;

export function initSentry(): void {
  if (!SENTRY_DSN || initialized) return;
  initialized = true;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.PROD ? "production" : "development",
    release: `markethub@${import.meta.env.VITE_APP_VERSION || "1.0.0"}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance monitoring (sampling rate)
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Session replay sampling
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Don't send errors in development
    enabled: import.meta.env.PROD,
  });
}

/**
 * Report an error to Sentry. Safe to call even if Sentry is not configured.
 */
export function captureError(error: unknown, context?: string): void {
  if (!IS_ACTIVE) return;

  if (error instanceof Error) {
    Sentry.captureException(error, {
      tags: context ? { context } : undefined,
      level: "error",
    });
  } else {
    Sentry.captureMessage(
      context ? `[${context}] ${String(error)}` : String(error),
      { level: "error" }
    );
  }
}

/**
 * Report a web vital metric to Sentry as a custom metric.
 */
export function reportWebVital(name: string, value: number, rating?: string): void {
  if (!IS_ACTIVE) return;
  // Use captureMessage with tags as a simple approach for web vitals
  Sentry.captureMessage(`Web Vital: ${name}`, {
    level: "info",
    tags: {
      metric: name,
      value: String(Math.round(value * 100) / 100),
      rating: rating || "unknown",
    },
  });
}

/**
 * Report Core Web Vitals using PerformanceObserver and send to Sentry.
 * Call this once from App.tsx on mount.
 */
export function reportCoreWebVitals(): () => void {
  if (!IS_ACTIVE || typeof window === "undefined" || !("PerformanceObserver" in window)) {
    return () => {};
  }

  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length > 0) {
        const entry = entries[entries.length - 1];
        const value = entry.startTime;
        const rating = value < 2500 ? "good" : value < 4000 ? "needs-improvement" : "poor";
        reportWebVital("LCP", value, rating);
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    const fidObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const fiEntry = entry as PerformanceEventTiming;
        const value = fiEntry.processingStart - fiEntry.startTime;
        const rating = value < 100 ? "good" : value < 300 ? "needs-improvement" : "poor";
        reportWebVital("FID", value, rating);
      });
    });
    fidObserver.observe({ type: "first-input", buffered: true });

    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0;
      list.getEntries().forEach((entry) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clsValue += (entry as any).value || 0;
      });
      const rating = clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor";
      reportWebVital("CLS", clsValue, rating);
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });

    return () => {
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
    };
  } catch {
    return () => {};
  }
}