const TIMEZONE_COUNTRY_MAP: Record<string, string> = {
  Lagos: "NG",
  Africa: "NG",
  New_York: "US",
  Chicago: "US",
  Denver: "US",
  Los_Angeles: "US",
  America: "US",
  London: "GB",
  Europe: "GB",
  Johannesburg: "ZA",
  Nairobi: "KE",
  Accra: "GH",
  Toronto: "CA",
  Sydney: "AU",
  Tokyo: "JP",
  Berlin: "DE",
  Paris: "FR",
  Rome: "IT",
  Madrid: "ES",
  Amsterdam: "NL",
  Dublin: "IE",
  Delhi: "IN",
  Sao_Paulo: "BR",
  Mexico_City: "MX",
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

export function detectCountryFromEnvironment(): string | null {
  if (typeof window === "undefined") return null;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  for (const [needle, country] of Object.entries(TIMEZONE_COUNTRY_MAP)) {
    if (timeZone.includes(needle)) return country;
  }

  const locale = navigator.language || "";
  const match = locale.match(/-([A-Za-z]{2})$/);
  if (match) {
    const code = match[1].toUpperCase();
    if (LOCALE_COUNTRY_MAP.has(code)) return code;
  }

  return null;
}

export function detectRegionDefaults() {
  const country = detectCountryFromEnvironment() || "US";
  const currency = countryToCurrency(country) || "USD";
  return { country, currency };
}
