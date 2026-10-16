import { supabase } from "@/integrations/supabase/client";
import { hasAnalyticsConsent } from "@/lib/analyticsConsent";
import { getVisitorId } from "@/lib/visitorId";

/** Records one anonymous daily visitor and page view for platform analytics. */
export function trackSiteVisit(): void {
  if (!hasAnalyticsConsent()) return;
  const visitorId = getVisitorId();
  if (!visitorId) return;
  void supabase.rpc("track_site_visit", { p_visitor_id: visitorId });
}
