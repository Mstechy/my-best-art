import { describe, expect, it, vi } from "vitest";
import { countryFromTimeZone, countryToCurrency, detectCountryFromEnvironment } from "@/lib/region";
import { phonePlaceholder } from "@/lib/countries";

describe("region detection", () => {
  it.each([
    ["Africa/Lagos", "NG", "NGN"],
    ["Africa/Johannesburg", "ZA", "ZAR"],
    ["Africa/Nairobi", "KE", "KES"],
    ["Africa/Accra", "GH", "GHS"],
    ["Europe/Berlin", "DE", "EUR"],
  ])("maps %s to %s and %s", (timeZone, country, currency) => {
    expect(countryFromTimeZone(timeZone)).toBe(country);
    expect(countryToCurrency(country)).toBe(currency);
  });

  it("does not treat a timezone region as a country", () => {
    expect(countryFromTimeZone("Africa/Maputo")).toBeNull();
    expect(countryFromTimeZone("Europe/Athens")).toBeNull();
    expect(countryFromTimeZone("America/Argentina/Buenos_Aires")).toBeNull();
  });

  it("prefers the exact timezone country before the browser language region", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { language: "en-US" });
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "en-US",
      timeZone: "Africa/Johannesburg",
    } as Intl.ResolvedDateTimeFormatOptions);

    expect(detectCountryFromEnvironment()).toBe("ZA");

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the selected country's dial code in checkout guidance", () => {
    expect(phonePlaceholder("NG")).toContain("+234");
    expect(phonePlaceholder("US")).toContain("+1");
  });
});
