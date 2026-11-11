import { useState } from "react";
import { Check, Globe2, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/useCurrency";
import { COUNTRIES, countryName } from "@/lib/countries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function RegionalPreferences({ showLabel = false, className = "" }: { showLabel?: boolean; className?: string }) {
  const { t } = useTranslation();
  const {
    country,
    detectedCountry,
    currency,
    automaticCurrency,
    currencies,
    currencyIsOverridden,
    isRegionResolving,
    setCountry,
    setCurrencyCode,
    resetCurrencyOverride,
  } = useCurrency();
  const [showCurrencies, setShowCurrencies] = useState(currencyIsOverridden);
  const automatic = automaticCurrency || currency;
  const destinationCode = country || detectedCountry || "NG";
  const destinationLabel = countryName(destinationCode);
  const LocationIcon = showLabel ? MapPin : Globe2;
  const availableCurrencies = currencies ?? {};

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`flex items-center gap-1.5 rounded-full px-2 py-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#222222] ${className}`}
        >
          <LocationIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className={showLabel ? "text-xs font-semibold" : "sr-only xl:not-sr-only xl:text-xs xl:font-semibold"}>
            {showLabel ? `${t("nav.deliveryTo")} ${destinationLabel}` : destinationLabel}
          </span>
          <span className={showLabel ? "text-[10px] text-[#6E6C64] dark:text-[#A0A0A0]" : "sr-only xl:not-sr-only xl:text-[10px] xl:text-[#6E6C64] dark:xl:text-[#A0A0A0]"}>
            {currency.code}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Delivery country</DropdownMenuLabel>
          <p className="mt-1 text-xs font-normal text-muted-foreground">
            Choose where the order will be delivered. Prices follow this country automatically.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {isRegionResolving ? "Detecting your location…" : `Detected: ${countryName(detectedCountry || "NG")}`}
          </p>
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          <DropdownMenuRadioGroup value={country || "auto"} onValueChange={(value) => setCountry(value === "auto" ? null : value)}>
            <DropdownMenuRadioItem value="auto" className="text-xs">
              Automatic — {countryName(detectedCountry || "NG")}
            </DropdownMenuRadioItem>
            {COUNTRIES.map((item) => (
              <DropdownMenuRadioItem key={item.code} value={item.code} className="text-xs">
                {item.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>

        <DropdownMenuSeparator />

        <div className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Price display</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currencyIsOverridden
              ? `${currency.code} is display-only; checkout uses the supported payment currency.`
              : `Automatic: ${automatic.code} for ${destinationLabel}.`}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            {currencyIsOverridden ? (
              <button type="button" onClick={resetCurrencyOverride} className="text-xs font-semibold text-primary hover:underline">
                Use automatic currency
              </button>
            ) : (
              <button type="button" onClick={() => setShowCurrencies((visible) => !visible)} className="text-xs font-semibold text-primary hover:underline">
                {showCurrencies ? "Hide other currencies" : "Show another display currency"}
              </button>
            )}
            {currencyIsOverridden && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
          </div>
          {showCurrencies && (
            <div className="mt-2 grid grid-cols-2 gap-1">
              {Object.entries(availableCurrencies).map(([code, info]) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrencyCode(code)}
                  className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${currency.code === code ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                >
                  <span>{info.symbol}</span>
                  <span>{code}</span>
                  {currency.code === code && <Check className="ml-auto h-3 w-3" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
