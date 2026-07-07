import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CurrencyInfo {
  code: string;
  symbol: string;
  rate: number;
}

const FALLBACK: Record<string, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", rate: 1 },
  NGN: { code: "NGN", symbol: "₦", rate: 1550 },
  GBP: { code: "GBP", symbol: "£", rate: 0.79 },
  EUR: { code: "EUR", symbol: "€", rate: 0.92 },
  CAD: { code: "CAD", symbol: "C$", rate: 1.36 },
  AUD: { code: "AUD", symbol: "A$", rate: 1.52 },
  ZAR: { code: "ZAR", symbol: "R", rate: 18.5 },
  KES: { code: "KES", symbol: "KSh", rate: 129 },
  GHS: { code: "GHS", symbol: "₵", rate: 15.5 },
};

interface CurrencyContextType {
  currency: CurrencyInfo;
  setCurrencyCode: (code: string) => void;
  formatPrice: (usdPrice: number) => string;
  currencies: Record<string, CurrencyInfo>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const NO_DECIMAL = new Set(["NGN", "KES"]);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencies, setCurrencies] = useState<Record<string, CurrencyInfo>>(FALLBACK);
  const [code, setCode] = useState<string>(() => {
    const saved = localStorage.getItem("preferred_currency");
    return saved && FALLBACK[saved] ? saved : "USD";
  });

  // Load live rates from currency_rates table
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("currency_rates").select("code, symbol, rate_to_usd");
      if (data && data.length) {
        const map: Record<string, CurrencyInfo> = { ...FALLBACK };
        data.forEach((r: any) => {
          map[r.code] = { code: r.code, symbol: r.symbol, rate: Number(r.rate_to_usd) };
        });
        setCurrencies(map);
      }
    })();
  }, []);

  // Auto-detect on first visit (best-effort; do not spam console / do not hard-fail UI)
  useEffect(() => {
    if (localStorage.getItem("preferred_currency")) return;
    // In dev, repeated refreshes can trigger ipapi rate limits (429). Avoid retry loops.
    // We also skip detection entirely during local dev.
    if (import.meta.env.DEV) return;
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = { NG: "NGN", GB: "GBP", US: "USD", CA: "CAD", AU: "AUD", ZA: "ZAR", KE: "KES", GH: "GHS" };
        const eu = ["DE", "FR", "IT", "ES", "NL", "BE", "IE", "PT", "AT", "FI", "GR"];
        const next = map[data.country] || (eu.includes(data.country) ? "EUR" : null);
        if (next) setCode(next);
      })
      .catch(() => {
        // ignore CORS/429/network errors
      });
  }, []);

  const setCurrencyCode = useCallback((c: string) => {
    setCode(c);
    localStorage.setItem("preferred_currency", c);
  }, []);

  const current = currencies[code] || currencies.USD;

  const formatPrice = useCallback((usdPrice: number) => {
    const info = currencies[code] || currencies.USD;
    const converted = usdPrice * info.rate;
    if (NO_DECIMAL.has(info.code)) {
      return `${info.symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    return `${info.symbol}${converted.toFixed(2)}`;
  }, [code, currencies]);

  return (
    <CurrencyContext.Provider value={{ currency: current, setCurrencyCode, formatPrice, currencies }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
