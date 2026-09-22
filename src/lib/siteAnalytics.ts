import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "tradibu_visitor_id";

function getVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Records one anonymous daily visitor and page view for platform analytics. */
export function trackSiteVisit(): void {
  const visitorId = getVisitorId();
  if (!visitorId) return;
  void supabase.rpc("track_site_visit", { p_visitor_id: visitorId });
}
