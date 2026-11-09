import { useCurrency } from "@/hooks/useCurrency";
import { countryName } from "@/lib/countries";
import { Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const REGIONS: Record<string, string[]> = {
  Americas: ["USD", "CAD", "BRL", "MXN"],
  Europe: ["GBP", "EUR"],
  Africa: ["NGN", "ZAR", "KES", "GHS"],
  "Asia Pacific": ["AUD", "INR", "JPY"],
};

export default function CurrencySelector() {
  const { currency, automaticCurrency, setCurrencyCode, resetCurrencyOverride, currencies, country, detectedCountry, currencyIsOverridden } = useCurrency();
  const available = Object.keys(currencies);
  const groups = Object.entries(REGIONS)
    .map(([region, codes]) => ({ region, codes: codes.filter((code) => available.includes(code)) }))
    .filter((group) => group.codes.length);
  const destinationLabel = countryName(country || detectedCountry || "NG");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-[hsl(var(--navbar-foreground)/0.1)]" aria-label="Choose price display currency">
          <span>{currency.symbol}</span>
          <span>{currency.code}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Price display</DropdownMenuLabel>
        <DropdownMenuItem onClick={resetCurrencyOverride} className={`gap-2 ${!currencyIsOverridden ? "bg-primary/10 text-primary" : ""}`}>
          <span className="font-medium">Automatic ({automaticCurrency.code})</span>
          {!currencyIsOverridden && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
        </DropdownMenuItem>
        {groups.map((group, index) => (
          <div key={group.region}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{group.region}</DropdownMenuLabel>
            {group.codes.map((code) => (
              <DropdownMenuItem key={code} onClick={() => setCurrencyCode(code)} className={`gap-2 ${currency.code === code && currencyIsOverridden ? "bg-primary/10 text-primary" : ""}`}>
                <span className="text-base leading-none">{currencies[code].symbol}</span>
                <span className="font-medium">{code}</span>
                <span className="text-xs text-muted-foreground">{currencies[code].symbol}</span>
                {currency.code === code && currencyIsOverridden && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-[10px] text-muted-foreground">Delivery country: {destinationLabel}. Currency changes here only affect display.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
