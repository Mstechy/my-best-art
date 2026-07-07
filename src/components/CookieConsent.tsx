import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";
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
    <div className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md animate-fade-in">
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Cookie className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">We use cookies</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Essential cookies keep MarketHub working. Optional cookies help us improve the experience.
              Read our <Link to="/cookies" className="text-primary underline underline-offset-2">Cookie Policy</Link>.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" onClick={() => decide("accepted")} className="gradient-primary text-primary-foreground">Accept</Button>
              <Button size="sm" variant="outline" onClick={() => decide("declined")}>Decline</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
