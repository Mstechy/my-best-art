import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";
import { notifyAnalyticsConsentChanged, readAnalyticsConsent, saveAnalyticsConsent } from "@/lib/analyticsConsent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const choice = readAnalyticsConsent();
    if (!choice) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const decide = (choice: "accepted" | "declined") => {
    saveAnalyticsConsent(choice);
    notifyAnalyticsConsentChanged();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    /* Phones/tablets keep the persistent bottom chrome (BottomTabBar h≈58,
       the checkout/product CTA bars h≈65), so the card is lifted clear of it
       instead of covering — and being covered by — that navigation. `md` and
       up have no bottom bar, so the normal corner offset applies there. */
    <aside
      role="region"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-description"
      data-testid="cookie-consent"
      className="fixed inset-x-3 bottom-[calc(6rem_+_env(safe-area-inset-bottom,0px))] z-[60] sm:inset-x-auto sm:right-4 sm:w-[360px] md:bottom-4 animate-fade-in"
    >
      <div className="relative rounded-2xl border border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#1A1A1A] shadow-xl p-4">

        {/* Close button */}
        <button
          type="button"
          onClick={() => decide("declined")}
          aria-label="Decline cookie consent"
          className="absolute top-0 right-0 h-11 w-11 flex items-center justify-center rounded-full text-[#4A4944] hover:bg-[#F2F3F5] dark:text-[#BEB8B2] dark:hover:bg-[#222222] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          {/* Icon */}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6C75D]/15 shrink-0">
            <Cookie aria-hidden="true" className="h-4 w-4 text-[#4A2A00] dark:text-[#F6C75D]" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 id="cookie-consent-title" className="bg-white text-sm font-bold text-[#111111] dark:bg-[#1A1A1A] dark:text-[#FAF5F2]">We use cookies</h2>
            <p id="cookie-consent-description" className="mt-1 bg-white text-[11px] text-[#4A4944] dark:bg-[#1A1A1A] dark:text-[#BEB8B2] leading-relaxed">
              Essential cookies keep Tradibu running. Optional analytics cookies help us understand how the marketplace is used.{" "}
              <Link to="/cookies" className="bg-white text-[#111111] dark:bg-[#1A1A1A] dark:text-[#FAF5F2] font-semibold underline underline-offset-2 hover:text-[#F6C75D] transition-colors">
                Cookie Policy
              </Link>
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => decide("accepted")}
                className="min-h-11 flex-1 px-3 py-1.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-[11px] font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors"
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => decide("declined")}
                className="min-h-11 flex-1 rounded-full border border-[#B8B7B2] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#111111] dark:border-[#555555] dark:bg-[#1A1A1A] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
}
