import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackSiteVisit } from "@/lib/siteAnalytics";

/** Tracks anonymous visits on initial load and client-side route changes. */
export default function SiteAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackSiteVisit();
  }, [location.pathname]);

  return null;
}
