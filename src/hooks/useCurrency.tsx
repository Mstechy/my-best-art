import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  countryToCurrency,
  detectCountryFromEnvironment,
  detectCountryFromIP,
  getCachedIpCountry,
  resolveCountryPreference,
  RegionSource,
} from "@/lib/region";

interface CurrencyInfo {
  code: string;
  symbol: string;
  rate: number;
}

interface CurrencyRateRow {
  code: string;
  symbol: string;
  rate_to_usd: number;
}

const FALLBACK: Record<string, CurrencyInfo> = {
  USD: { code: "USD", symbol: "$", rate: 1 },
  NGN: { code: "NGN", symbol: "₦", rate: 1550 },
  GBP: { code: "GBP", symbol: "£", rate: 0.79 },
  EUR: { code: "EUR", symbol: "€", rate: 0.92 },
  CAD: { code: "CAD", symbol: "CA$", rate: 1.36 },
  AUD: { code: "AUD", symbol: "A$", rate: 1.52 },
  ZAR: { code: "ZAR", symbol: "R", rate: 18.5 },
  KES: { code: "KES", symbol: "KSh", rate: 129 },
  GHS: { code: "GHS", symbol: "GH₵", rate: 15.5 },
  INR: { code: "INR", symbol: "₹", rate: 83 },
  JPY: { code: "JPY", symbol: "¥", rate: 155 },
  BRL: { code: "BRL", symbol: "R$", rate: 5.1 },
  MXN: { code: "MXN", symbol: "MX$", rate: 17 },
};

interface CurrencyContextType {
  currency: CurrencyInfo;
  automaticCurrency: CurrencyInfo;
  currencies: Record<string, CurrencyInfo>;
  country: string | null;
  detectedCountry: string | null;
  regionSource: RegionSource;
  isRegionResolving: boolean;
  currencyIsOverridden: boolean;
  setCurrencyCode: (code: string) => void;
  resetCurrencyOverride: () => void;
  setCountry: (country: string | null) => void;
  convertPrice: (amount: number, sourceCurrency?: string) => number;
  formatPrice: (amount: number, sourceCurrency?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
const NO_DECIMAL = new Set(["NGN", "KES", "JPY"]);
const CURRENCY_MANUAL_KEY = "preferred_currency_manual";
const COUNTRY_MANUAL_KEY = "preferred_country_manual";

const getStored = (key: string) => (typeof window === "undefined" ? null : localStorage.getItem(key));
const saveStored = (key: string, value: string | null) => {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
};

function getInitialCountry(): string {
  const saved = getStored("preferred_country")?.toUpperCase();
  if (getStored(COUNTRY_MANUAL_KEY) === "true" && saved && countryToCurrency(saved)) return saved;
  return detectCountryFromEnvironment() || getCachedIpCountry() || "NG";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const initialDetectedCountry = useMemo(() => detectCountryFromEnvironment() || getCachedIpCountry(), []);
  const [currencies, setCurrencies] = useState<Record<string, CurrencyInfo>>(FALLBACK);
  const [country, setCountryState] = useState<string | null>(getInitialCountry);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(initialDetectedCountry);
  const [regionSource, setRegionSource] = useState<RegionSource>(() => {
    if (getStored(COUNTRY_MANUAL_KEY) === "true") return "manual";
    if (detectCountryFromEnvironment()) return "environment";
    if (getCachedIpCountry()) return "ip";
    return "default";
  });
  const [isRegionResolving, setIsRegionResolving] = useState(true);
  const [currencyIsOverridden, setCurrencyIsOverridden] = useState(
    () => getStored(CURRENCY_MANUAL_KEY) === "true",
  );
  const [code, setCode] = useState<string>(() => {
    const saved = getStored("preferred_currency")?.toUpperCase();
    if (getStored(CURRENCY_MANUAL_KEY) === "true" && saved && FALLBACK[saved]) return saved;
    return countryToCurrency(getInitialCountry()) || "NGN";
  });

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await supabase.from("currency_rates").select("code, symbol, rate_to_usd");
      if (!active || !data?.length) return;

      setCurrencies((current) => {
        const updated = { ...current };
        (data as CurrencyRateRow[]).forEach((rate) => {
          const normalized = rate.code?.toUpperCase();
          if (normalized && Number(rate.rate_to_usd) > 0) {
            updated[normalized] = {
              code: normalized,
              symbol: rate.symbol || normalized,
              rate: Number(rate.rate_to_usd),
            };
          }
        });
        return updated;
      });
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    // A buyer who has already chosen a delivery country does not need a
    // network-location request. This avoids unnecessary third-party disclosure.
    if (getStored(COUNTRY_MANUAL_KEY) === "true") {
      setIsRegionResolving(false);
      return () => {
        active = false;
      };
    }

    void detectCountryFromIP().then((ipCountry) => {
      if (!active) return;
      setDetectedCountry(ipCountry || initialDetectedCountry);

      // Background detection may establish defaults, but it must never
      // overwrite an explicitly selected delivery country or currency view.
      const hasManualCountry = getStored(COUNTRY_MANUAL_KEY) === "true";
      const hasCurrencyOverride = getStored(CURRENCY_MANUAL_KEY) === "true";
      if (ipCountry && !hasManualCountry) {
        setCountryState(ipCountry);
        setRegionSource("ip");
        saveStored("preferred_country", ipCountry);

        if (!hasCurrencyOverride) {
          const mapped = countryToCurrency(ipCountry) || "NGN";
          setCode(mapped);
          saveStored("preferred_currency", mapped);
        }
      }
    }).finally(() => {
      if (active) setIsRegionResolving(false);
    });

    return () => {
      active = false;
    };
  }, [initialDetectedCountry]);

  const setCurrencyCode = useCallback((nextCode: string) => {
    const normalized = nextCode.toUpperCase();
    if (!currencies[normalized]) return;
    setCode(normalized);
    setCurrencyIsOverridden(true);
    saveStored("preferred_currency", normalized);
    saveStored(CURRENCY_MANUAL_KEY, "true");
  }, [currencies]);

  const setCountry = useCallback((nextCountry: string | null) => {
    const resolved = resolveCountryPreference(nextCountry, detectCountryFromEnvironment());
    const automaticCountry = detectedCountry || detectCountryFromEnvironment() || getCachedIpCountry() || "NG";
    const nextResolvedCountry = resolved.country || automaticCountry;
    const mapped = countryToCurrency(nextResolvedCountry) || resolved.currency || "NGN";

    setCountryState(nextResolvedCountry);
    setDetectedCountry(detectedCountry || automaticCountry);
    setRegionSource(resolved.country ? "manual" : detectCountryFromEnvironment() ? "environment" : "ip");
    setCode(mapped);
    setCurrencyIsOverridden(false);

    saveStored("preferred_country", nextResolvedCountry);
    saveStored(COUNTRY_MANUAL_KEY, resolved.country ? "true" : null);
    saveStored("preferred_currency", mapped);
    saveStored(CURRENCY_MANUAL_KEY, null);
  }, [detectedCountry]);

  const automaticCode = countryToCurrency(country || detectedCountry || "NG") || "NGN";
  const automaticCurrency = currencies[automaticCode] || FALLBACK[automaticCode] || currencies.NGN;
  const resetCurrencyOverride = useCallback(() => {
    const mapped = countryToCurrency(country || detectedCountry || "NG") || "NGN";
    setCode(mapped);
    setCurrencyIsOverridden(false);
    saveStored("preferred_currency", mapped);
    saveStored(CURRENCY_MANUAL_KEY, null);
  }, [country, detectedCountry]);

  const current = currencies[code] || currencies.NGN;
  const convertPrice = useCallback((amount: number, sourceCurrency = "NGN") => {
    const source = currencies[sourceCurrency.toUpperCase()] || currencies.NGN;
    const converted = (Number(amount) / source.rate) * current.rate;
    return Number.isFinite(converted) ? converted : NaN;
  }, [currencies, current]);

  const sourceAwareFormatPrice = useCallback((amount: number, sourceCurrency = "NGN") => {
    const converted = convertPrice(amount, sourceCurrency);
    if (!Number.isFinite(converted)) return "—";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: current.code,
      minimumFractionDigits: NO_DECIMAL.has(current.code) ? 0 : 2,
      maximumFractionDigits: NO_DECIMAL.has(current.code) ? 0 : 2,
    }).format(converted);
  }, [convertPrice, current]);

  return (
    <CurrencyContext.Provider
      value={{
        currency: current,
        automaticCurrency,
        currencies,
        country,
        detectedCountry,
        regionSource,
        isRegionResolving,
        currencyIsOverridden,
        setCurrencyCode,
        resetCurrencyOverride,
        setCountry,
        convertPrice,
        formatPrice: sourceAwareFormatPrice,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
