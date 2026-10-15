import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackSiteVisit } from "@/lib/siteAnalytics";
import { ANALYTICS_CONSENT_CHANGED, hasAnalyticsConsent } from "@/lib/analyticsConsent";
import { trackGA4PageView } from "@/lib/marketingAnalytics";

/** Tracks anonymous visits on initial load and client-side route changes. */
export default function SiteAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackSiteVisit();
    trackGA4PageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const onConsentChanged = () => {
      if (!hasAnalyticsConsent()) return;
      trackSiteVisit();
      trackGA4PageView(location.pathname);
    };
    window.addEventListener(ANALYTICS_CONSENT_CHANGED, onConsentChanged);
    return () => window.removeEventListener(ANALYTICS_CONSENT_CHANGED, onConsentChanged);
  }, [location.pathname]);

  return null;
}
