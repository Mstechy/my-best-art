/**
 * Core Web Vitals collection, deliberately independent of Sentry.
 *
 * main.tsx intentionally delays @sentry/react until the visitor interacts: that SDK
 * costs over a second of main-thread work on a throttled phone and would otherwise
 * land inside the LCP window. The previous attempt at web-vitals reporting failed
 * because reportCoreWebVitals() lived in sentry.ts and nothing ever called it, so the
 * site measured no real-user performance at all.
 *
 * The collectors here are tiny and start immediately; samples are buffered until a
 * sink is registered. Sentry registers the sink whenever it finishes loading, and if
 * it never loads the buffer is dropped. Metrics are captured early and reported late,
 * so the LCP path pays nothing.
 */
import { onCLS, onINP, onLCP } from "web-vitals";

export interface WebVitalSample {
  name: string;
  value: number;
  rating: string;
  id: string;
}

type Sink = (sample: WebVitalSample) => void;

const MAX_BUFFERED = 50;
const buffer: WebVitalSample[] = [];
let sink: Sink | null = null;
let started = false;

/** Deliver anything buffered to `next`, then pass later samples straight through. */
export function setWebVitalSink(next: Sink): void {
  sink = next;
  while (buffer.length > 0) {
    const sample = buffer.shift();
    if (sample) next(sample);
  }
}

function record(metric: { name: string; value: number; rating: string; id: string }): void {
  const sample: WebVitalSample = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
  };
  if (sink) sink(sample);
  else if (buffer.length < MAX_BUFFERED) buffer.push(sample);
}

/** Start the observers. Safe to call more than once. */
export function startWebVitals(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  // LCP, INP and CLS are the current Core Web Vitals. FID was retired in favour of
  // INP, so FID is intentionally not reported.
  onLCP(record);
  onINP(record);
  onCLS(record);
}
