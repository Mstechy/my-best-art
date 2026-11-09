import { COUNTRIES } from "@/lib/countries";

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

const SUPPORTED_COUNTRY_CODES = new Set(COUNTRIES.map((country) => country.code));
const IP_COUNTRY_CACHE_KEY = "tradibu:ip-country:v1";
const IP_COUNTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type RegionSource = "manual" | "ip" | "environment" | "default";

function normalizeCountryCode(country?: string | null): string | null {
  const normalized = country?.trim().toUpperCase() || "";
  return SUPPORTED_COUNTRY_CODES.has(normalized) ? normalized : null;
}

export function countryToCurrency(country?: string | null): string | null {
  const normalized = normalizeCountryCode(country);
  return normalized ? COUNTRY_TO_CURRENCY[normalized] || null : null;
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

export function getCachedIpCountry(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(IP_COUNTRY_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { country?: string; cachedAt?: number };
    if (!cached.cachedAt || Date.now() - cached.cachedAt > IP_COUNTRY_CACHE_TTL_MS) return null;
    return normalizeCountryCode(cached.country);
  } catch {
    return null;
  }
}

function cacheIpCountry(country: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IP_COUNTRY_CACHE_KEY, JSON.stringify({ country, cachedAt: Date.now() }));
  } catch {
    // Storage is optional. Detection should still work when it is unavailable.
  }
}

function getIpCountryEndpoint(): string {
  return import.meta.env.VITE_IP_COUNTRY_ENDPOINT || "https://ipapi.co/country/";
}

/**
 * Returns a country inferred from the visitor's network, without exposing or
 * storing the raw IP in the application. This is only a best-effort default;
 * the buyer can always choose a different delivery country.
 */
export async function detectCountryFromIP(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const cached = getCachedIpCountry();
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(getIpCountryEndpoint(), {
      method: "GET",
      headers: { Accept: "text/plain, application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const body = await response.text();
    let candidate = body.trim();
    try {
      const parsed = JSON.parse(body) as { country_code?: string; country?: string };
      candidate = parsed.country_code || parsed.country || candidate;
    } catch {
      // The default endpoint returns a plain two-letter country code.
    }

    const country = normalizeCountryCode(candidate);
    if (country) cacheIpCountry(country);
    return country;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
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
