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
 *   - Report errors via the captureError() function
 *   - Flush Core Web Vitals buffered by lib/webVitals.ts (LCP, INP, CLS)
 *   - Provide breadcrumbs for user interactions
 */

import * as Sentry from "@sentry/react";
import { setWebVitalSink, type WebVitalSample } from "@/lib/webVitals";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const IS_ACTIVE = Boolean(SENTRY_DSN);

// Injected at build time by vite.config.ts: VITE_APP_VERSION when the build
// environment provides it, otherwise the git short SHA. The previous literal fallback
// meant every deploy reported the same release, so a regression could never be tied
// to a build.
const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || "dev";

let initialized = false;

export function initSentry(): void {
  if (!SENTRY_DSN || initialized) return;
  initialized = true;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.PROD ? "production" : "development",
    release: `tradibu@${APP_VERSION}`,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    // Performance monitoring (sampling rate)
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Don't send errors in development
    enabled: import.meta.env.PROD,
  });

  // Sentry is loaded lazily, after first interaction, so it misses the paint metrics.
  // The Core Web Vitals collected since page load are buffered by lib/webVitals and
  // flushed here.
  //
  // Session replay is deliberately not enabled. replaysSessionSampleRate and
  // replaysOnErrorSampleRate were set without replayIntegration(), so they did
  // nothing; switching replay on would stream buyer and seller sessions to a third
  // party, which is a privacy decision rather than a performance fix.
  setWebVitalSink((sample: WebVitalSample) => reportWebVital(sample.name, sample.value, sample.rating));
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
 * Core Web Vitals are no longer observed here.
 *
 * They were, through reportCoreWebVitals(), but nothing ever called it - the
 * collectors therefore never ran and the site had no real-user performance data at
 * all. They now live in lib/webVitals.ts so the observers can start at page load
 * while Sentry itself is still deferred, and so INP (which replaced the retired FID
 * metric) is measured with the maintained Google implementation. startWebVitals() in
 * main.tsx owns the lifecycle; initSentry() registers the reporting sink.
 */