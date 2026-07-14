import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countryToCurrency, detectCountryFromEnvironment } from "@/lib/region";

interface CurrencyInfo { code: string; symbol: string; rate: number; }
interface CurrencyRateRow { code: string; symbol: string; rate_to_usd: number; }

const FALLBACK: Record<string, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", rate: 1 }, NGN: { code: "NGN", symbol: "\u20A6", rate: 1550 }, GBP: { code: "GBP", symbol: "\u00A3", rate: 0.79 }, EUR: { code: "EUR", symbol: "\u20AC", rate: 0.92 }, CAD: { code: "CAD", symbol: "CA$", rate: 1.36 }, AUD: { code: "AUD", symbol: "A$", rate: 1.52 }, ZAR: { code: "ZAR", symbol: "R", rate: 18.5 }, KES: { code: "KES", symbol: "KSh", rate: 129 }, GHS: { code: "GHS", symbol: "GH\u20B5", rate: 15.5 }, INR: { code: "INR", symbol: "\u20B9", rate: 83 }, JPY: { code: "JPY", symbol: "\u00A5", rate: 155 }, BRL: { code: "BRL", symbol: "R$", rate: 5.1 }, MXN: { code: "MXN", symbol: "MX$", rate: 17 },
};

interface CurrencyContextType { currency: CurrencyInfo; currencies: Record<string, CurrencyInfo>; country: string | null; detectedCountry: string | null; setCurrencyCode: (code: string) => void; setCountry: (country: string | null) => void; formatPrice: (usdPrice: number) => string; }
const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
const NO_DECIMAL = new Set(["NGN", "KES", "JPY"]);
const getStored = (key: string) => typeof window === "undefined" ? null : localStorage.getItem(key);
const saveStored = (key: string, value: string | null) => { if (typeof window === "undefined") return; if (value) localStorage.setItem(key, value); else localStorage.removeItem(key); };

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const detectedCountry = useMemo(() => detectCountryFromEnvironment(), []);
  const [currencies, setCurrencies] = useState<Record<string, CurrencyInfo>>(FALLBACK);
  const [country, setCountryState] = useState<string | null>(() => getStored("preferred_country") || detectCountryFromEnvironment());
  const [code, setCode] = useState<string>(() => { const saved = getStored("preferred_currency"); return saved && FALLBACK[saved] ? saved : countryToCurrency(getStored("preferred_country") || detectCountryFromEnvironment()) || "USD"; });

  useEffect(() => { (async () => {
    const { data } = await supabase.from("currency_rates").select("code, symbol, rate_to_usd");
    if (!data?.length) return;
    setCurrencies((current) => { const updated = { ...current }; (data as CurrencyRateRow[]).forEach((rate) => { if (rate.code && Number(rate.rate_to_usd) > 0) updated[rate.code] = { code: rate.code, symbol: rate.symbol || rate.code, rate: Number(rate.rate_to_usd) }; }); return updated; });
  })(); }, []);

  const setCurrencyCode = useCallback((nextCode: string) => { const normalized = nextCode.toUpperCase(); setCode(normalized); saveStored("preferred_currency", normalized); }, []);
  const setCountry = useCallback((nextCountry: string | null) => { const normalized = nextCountry?.toUpperCase() || null; setCountryState(normalized); saveStored("preferred_country", normalized); const mapped = countryToCurrency(normalized); if (mapped) { setCode(mapped); saveStored("preferred_currency", mapped); } }, []);
  const current = currencies[code] || currencies.USD;
  const formatPrice = useCallback((usdPrice: number) => { const amount = Number(usdPrice) * current.rate; if (!Number.isFinite(amount)) return "—"; return new Intl.NumberFormat(undefined, { style: "currency", currency: current.code, minimumFractionDigits: NO_DECIMAL.has(current.code) ? 0 : 2, maximumFractionDigits: NO_DECIMAL.has(current.code) ? 0 : 2 }).format(amount); }, [current]);

  return <CurrencyContext.Provider value={{ currency: current, currencies, country, detectedCountry, setCurrencyCode, setCountry, formatPrice }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() { const context = useContext(CurrencyContext); if (!context) throw new Error("useCurrency must be used within CurrencyProvider"); return context; }
