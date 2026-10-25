export const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "NG", name: "Nigeria" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "ZA", name: "South Africa" },
  { code: "KE", name: "Kenya" },
  { code: "GH", name: "Ghana" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "IE", name: "Ireland" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
];

const COUNTRY_DIAL_CODES: Record<string, string> = {
  NG: "+234", US: "+1", GB: "+44", CA: "+1", AU: "+61", ZA: "+27", KE: "+254", GH: "+233",
  DE: "+49", FR: "+33", IT: "+39", ES: "+34", NL: "+31", IE: "+353", IN: "+91", JP: "+81", BR: "+55", MX: "+52",
};

export function phonePlaceholder(countryCode?: string | null): string {
  const dialCode = COUNTRY_DIAL_CODES[countryCode?.toUpperCase() || ""] || "+234";
  return `${dialCode} 800 000 0000`;
}

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name || code;
}
