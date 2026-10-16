import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import fr from "@/lib/i18n/locales/fr.json";

const sortOptionKeys = [
  "bestMatch",
  "newest",
  "rating",
  "bestSellers",
  "trending",
  "recommended",
  "discover",
  "priceLow",
  "priceHigh",
] as const;

describe("marketplace sort translations", () => {
  it.each([
    ["English", en.marketplace.sortOptions],
    ["French", fr.marketplace.sortOptions],
  ])("defines every sort label in %s", (_language, labels) => {
    for (const key of sortOptionKeys) {
      expect(labels[key]).toBeTruthy();
      expect(labels[key]).not.toBe(`marketplace.sortOptions.${key}`);
    }
  });
});
