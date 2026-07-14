import { useCurrency } from "@/hooks/useCurrency";
import { countryName } from "@/lib/countries";
import { Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const REGIONS: Record<string, string[]> = { Americas: ["USD", "CAD", "BRL", "MXN"], Europe: ["GBP", "EUR"], Africa: ["NGN", "ZAR", "KES", "GHS"], "Asia Pacific": ["AUD", "INR", "JPY"] };

export default function CurrencySelector() {
  const { currency, setCurrencyCode, currencies, country } = useCurrency();
  const available = Object.keys(currencies);
  const groups = Object.entries(REGIONS).map(([region, codes]) => ({ region, codes: codes.filter((code) => available.includes(code)) })).filter((group) => group.codes.length);
  return <DropdownMenu><DropdownMenuTrigger asChild><button className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-[hsl(var(--navbar-foreground)/0.1)]" aria-label="Choose display currency"><span>{currency.symbol}</span><span>{currency.code}</span></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-[200px]">{groups.map((group, index) => <div key={group.region}>{index > 0 && <DropdownMenuSeparator />}<DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{group.region}</DropdownMenuLabel>{group.codes.map((code) => <DropdownMenuItem key={code} onClick={() => setCurrencyCode(code)} className={`gap-2 ${currency.code === code ? "bg-primary/10 text-primary" : ""}`}><span className="text-base leading-none">{currencies[code].symbol}</span><span className="font-medium">{code}</span><span className="text-xs text-muted-foreground">{currencies[code].symbol}</span>{currency.code === code && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}</DropdownMenuItem>)}</div>)}{country && <><DropdownMenuSeparator /><p className="px-2 py-1.5 text-[10px] text-muted-foreground">Delivery country: {countryName(country)}</p></>}</DropdownMenuContent></DropdownMenu>;
}
