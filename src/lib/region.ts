const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  "Africa/Lagos": "NG",
  "Africa/Johannesburg": "ZA",
  "Africa/Nairobi": "KE",
  "Africa/Accra": "GH",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Sao_Paulo": "BR",
  "America/Mexico_City": "MX",
  "Europe/London": "GB",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/Amsterdam": "NL",
  "Europe/Dublin": "IE",
  "Asia/Kolkata": "IN",
  "Asia/Tokyo": "JP",
  "Australia/Sydney": "AU",
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  NG: "NGN",
  CA: "CAD",
  AU: "AUD",
  ZA: "ZAR",
  KE: "KES",
  GH: "GHS",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  IE: "EUR",
  IN: "INR",
  JP: "JPY",
  BR: "BRL",
  MX: "MXN",
};

const LOCALE_COUNTRY_MAP = new Set([
  "US", "GB", "NG", "CA", "AU", "ZA", "KE", "GH", "DE", "FR", "IT", "ES", "NL", "IE", "IN", "JP", "BR", "MX",
]);

export function countryToCurrency(country?: string | null): string | null {
  if (!country) return null;
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] || null;
}

export function resolveCountryPreference(nextCountry: string | null, detectedCountry: string | null = null) {
  const country = nextCountry?.trim().toUpperCase() || null;
  const fallbackCountry = detectedCountry?.trim().toUpperCase() || "NG";
  return {
    country,
    currency: countryToCurrency(country || fallbackCountry) || "NGN",
  };
}

export function countryFromTimeZone(timeZone: string): string | null {
  return TIMEZONE_COUNTRY_MAP[timeZone] || null;
}

export function detectCountryFromEnvironment(): string | null {
  if (typeof window === "undefined") return null;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const timeZoneCountry = countryFromTimeZone(timeZone);
  if (timeZoneCountry) return timeZoneCountry;

  const locale = navigator.language || "";
  const match = locale.match(/-([A-Za-z]{2})$/);
  if (match) {
    const code = match[1].toUpperCase();
    if (LOCALE_COUNTRY_MAP.has(code)) return code;
  }

  return null;
}

export function detectRegionDefaults() {
  // Tradibu's default marketplace currency is Nigerian naira. A detected or
  // explicitly selected country can still choose its matching currency.
  const country = detectCountryFromEnvironment() || "NG";
  const currency = countryToCurrency(country) || "NGN";
  return { country, currency };
}
