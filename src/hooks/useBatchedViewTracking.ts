/**
 * Batched product view tracking.
 *
 * Collects product_id + viewer_id pairs in a queue and flushes them
 * via a single RPC call every 30 seconds or when the queue reaches 100 items.
 *
 * Singleton — one shared queue across the entire app.
 *
 * Usage: trackView("some-product-uuid", "optional-viewer-uuid")
 * Inline alternative for non-critical analytics: individual INSERT.
 */

import { supabase } from "@/integrations/supabase/client";

interface ViewRecord {
  product_id: string;
  viewer_id: string | null;
  timestamp: string;
}

const FLUSH_INTERVAL_MS = 30_000;
const MAX_BATCH_SIZE = 100;

class BatchedViewTracker {
  private queue: ViewRecord[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.timerId = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
      // Flush on page unload (best-effort — may not fire in all browsers)
      window.addEventListener("beforeunload", () => this.flush());
    }
  }

  push(product_id: string, viewer_id: string | null): void {
    this.queue.push({
      product_id,
      viewer_id,
      timestamp: new Date().toISOString(),
    });

    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    const batch = this.queue.splice(0, MAX_BATCH_SIZE);

    try {
      // Use the same product_views table but insert all rows in one call
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("product_views" as any) as any).insert(
        batch.map((v) => ({
          product_id: v.product_id,
          viewer_id: v.viewer_id,
        }))
      );
    } catch {
      // Silently drop on error — non-critical analytics
    } finally {
      this.flushing = false;
    }
  }

  destroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.flush();
  }
}

// Singleton — shared across all component instances
let instance: BatchedViewTracker | null = null;

function getTracker(): BatchedViewTracker {
  if (!instance) {
    instance = new BatchedViewTracker();
  }
  return instance;
}

/** Track a product view. Batches into groups of 100, flushes every 30s. */
export function trackView(product_id: string, viewer_id: string | null = null): void {
  getTracker().push(product_id, viewer_id);
}