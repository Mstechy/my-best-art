import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

const KEY = "markethub_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const choice = localStorage.getItem(KEY);
    if (!choice) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const decide = (choice: "accepted" | "declined") => {
    localStorage.setItem(KEY, choice);
    localStorage.setItem(`${KEY}_at`, new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[360px] animate-fade-in">
      <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#1A1A1A] shadow-xl p-4">

        {/* Close button */}
        <button
          onClick={() => decide("declined")}
          className="absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-full text-[#888880] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          {/* Icon */}
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6C75D]/15 shrink-0">
            <Cookie className="h-4 w-4 text-[#5C3A00] dark:text-[#F6C75D]" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">We use cookies</p>
            <p className="mt-1 text-[11px] text-[#888880] dark:text-[#A0A0A0] leading-relaxed">
              Essential cookies keep markethub running. Optional cookies help us improve your experience.{" "}
              <Link to="/cookies" className="text-[#111111] dark:text-[#FAF5F2] font-semibold underline underline-offset-2 hover:text-[#F6C75D] transition-colors">
                Cookie Policy
              </Link>
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => decide("accepted")}
                className="flex-1 py-1.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-[11px] font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors"
              >
                Accept all
              </button>
              <button
                onClick={() => decide("declined")}
                className="flex-1 py-1.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[11px] font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
