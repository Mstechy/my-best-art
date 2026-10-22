import { describe, expect, it } from "vitest";
import { getProductTypesForCategory } from "@/lib/categoryConfig";

describe("electronics listing taxonomy", () => {
  it("offers one canonical mobile-phone type for the legacy phone department", () => {
    const types = getProductTypesForCategory({ slug: "phones-accessories", name: "Phones & Accessories" });
    const keys = types.map((type) => type.key);

    expect(keys).toContain("mobile-phones");
    expect(keys).not.toContain("phones");
  });

  it("requires the core comparison fields for laptop listings", () => {
    const laptops = getProductTypesForCategory({ slug: "electronics", name: "Electronics" })
      .find((type) => type.key === "laptops");

    expect(laptops?.requiredFields).toEqual(expect.arrayContaining([
      "brand", "model", "processor", "ram", "storage", "storageType",
      "screenSize", "displayResolution", "graphics", "operatingSystem",
      "cosmeticCondition", "condition",
    ]));
    expect(laptops?.fields.map((field) => field.key)).toEqual(expect.arrayContaining([
      "ports", "wireless", "webcam", "keyboardLayout", "batteryHealth",
      "storageInterface", "processorGeneration", "memoryType", "memorySpeed", "touchscreen", "gpuMemory",
    ]));
  });

  it("covers the trust and comparison fields needed for modern phone listings", () => {
    const phones = getProductTypesForCategory({ slug: "electronics", name: "Electronics" })
      .find((type) => type.key === "mobile-phones");
    const fields = phones?.fields.map((field) => field.key) ?? [];

    expect(phones?.requiredFields).toEqual(expect.arrayContaining([
      "brand", "model", "storage", "color", "batteryHealth", "operatingSystem",
      "connectivity", "network", "simType", "cosmeticCondition", "condition",
    ]));
    expect(fields).toEqual(expect.arrayContaining([
      "displayType", "displayResolution", "refreshRate", "mainCamera", "frontCamera",
      "charging", "waterResistance", "marketRegion", "carrierStatus", "activationLockStatus",
    ]));
    const batteryHealth = phones?.fields.find((field) => field.key === "batteryHealth");
    expect(batteryHealth?.options).toContain("90–99%");
    expect(batteryHealth?.options).toContain("80–89%");
  });
});
