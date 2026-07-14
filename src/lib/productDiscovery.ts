import { supabase } from "@/integrations/supabase/client";

export type DiscoveryEvent = "impression" | "view" | "click" | "wishlist" | "add_to_cart";
const VISITOR_KEY = "markethub_visitor_id";

function getVisitorId() {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(VISITOR_KEY, id); }
  return id;
}

export function trackProductDiscovery(productIds: string | string[], event: DiscoveryEvent) {
  const ids = (Array.isArray(productIds) ? productIds : [productIds]).filter(Boolean).slice(0, 48);
  if (!ids.length || typeof window === "undefined") return;
  void supabase.rpc("track_product_discovery_event", { p_product_ids: ids, p_event_type: event, p_visitor_id: getVisitorId() });
}
