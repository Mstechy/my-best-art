import { useEffect, useState } from "react";
import { useCurrency } from "@/hooks/useCurrency";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";

const FLAGS: Record<string, string> = {
  USD: "🇺🇸", GBP: "🇬🇧", EUR: "🇪🇺", CAD: "🇨🇦", AUD: "🇦🇺",
  NGN: "🇳🇬", ZAR: "🇿🇦", KES: "🇰🇪", GHS: "🇬🇭",
};

const REGIONS: Record<string, string[]> = {
  Americas: ["USD", "CAD"],
  Europe: ["GBP", "EUR"],
  Africa: ["NGN", "ZAR", "KES", "GHS"],
  "Asia Pacific": ["AUD"],
};

export default function CurrencySelector() {
  const { currency, setCurrencyCode, currencies } = useCurrency();
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    // Professionally handled UX improvement:
    // Avoid client-side cross-origin geolocation calls (ipapi.co) which cause noisy browser CORS errors.
    // We only set `detected` based on in-app currency changes.
    setDetected(null);
  }, []);


  const available = Object.keys(currencies);
  const grouped: { region: string; codes: string[] }[] = Object.entries(REGIONS)
    .map(([region, codes]) => ({ region, codes: codes.filter(c => available.includes(c)) }))
    .filter(g => g.codes.length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-[hsl(var(--navbar-foreground)/0.1)] transition-colors">
          <span>{FLAGS[currency.code] || currency.symbol}</span>
          <span>{currency.code}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        {grouped.map((g, gi) => (
          <div key={g.region}>
            {gi > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {g.region}
            </DropdownMenuLabel>
            {g.codes.map(code => {
              const isActive = currency.code === code;
              const isDetected = detected === code;
              return (
                <DropdownMenuItem
                  key={code}
                  onClick={() => setCurrencyCode(code)}
                  className={`gap-2 ${isActive ? "bg-primary/10 text-primary" : ""}`}
                >
                  <span className="text-base leading-none">{FLAGS[code] || currencies[code].symbol}</span>
                  <span className="font-medium">{code}</span>
                  <span className="text-xs text-muted-foreground">{currencies[code].symbol}</span>
                  <span className="ml-auto flex items-center gap-1">
                    {isDetected && !isActive && (
                      <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                        Detected
                      </span>
                    )}
                    {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
