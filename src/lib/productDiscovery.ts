import { supabase } from "@/integrations/supabase/client";

export type DiscoveryEvent = "impression" | "view" | "click" | "wishlist" | "add_to_cart" | "buy_now";
const VISITOR_KEY = "markethub_visitor_id";

/**
 * Batched product discovery tracking.
 * Instead of one INSERT per view, we buffer events and flush them
 * in batches every 30 seconds or every 50 events — whichever comes first.
 * This prevents overwhelming the database at scale.
 */

interface QueuedEvent {
  product_id: string;
  event_type: DiscoveryEvent;
  visitor_id: string;
}

let eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 30_000; // flush every 30 seconds
const MAX_BATCH_SIZE = 50;        // or every 50 events

function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(VISITOR_KEY, id); }
  return id;
}

async function flushEvents() {
  const batch = eventQueue.slice();
  eventQueue = [];
  flushTimer = null;

  if (batch.length === 0) return;

  try {
    await supabase.rpc("track_product_discovery_event", {
      p_product_ids: batch.map(e => e.product_id),
      p_event_type: batch[0].event_type,
      p_visitor_id: batch[0].visitor_id,
    });
  } catch (err) {
    // Silently drop — failed analytics shouldn't break the user experience
    if (import.meta.env.DEV) {
      console.warn("[Discovery] Failed to flush events:", err);
    }
  }
}

function enqueue(ids: string[], event: DiscoveryEvent, visitorId: string) {
  for (const productId of ids) {
    eventQueue.push({ product_id: productId, event_type: event, visitor_id: visitorId });
  }

  // Flush if we've hit the batch size limit
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flushEvents();
    return;
  }

  // Schedule flush if not already scheduled
  if (!flushTimer) {
    flushTimer = setTimeout(() => void flushEvents(), FLUSH_INTERVAL_MS);
  }
}

export function trackProductDiscovery(productIds: string | string[], event: DiscoveryEvent) {
  const ids = (Array.isArray(productIds) ? productIds : [productIds]).filter(Boolean).slice(0, 48);
  if (!ids.length || typeof window === "undefined") return;

  const visitorId = getVisitorId();
  enqueue(ids, event, visitorId);
}