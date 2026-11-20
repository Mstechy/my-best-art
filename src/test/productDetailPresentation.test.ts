import { describe, expect, it } from "vitest";
import {
  formatVariantAttributeLabel,
  getProductDetailFactKeys,
  getProductSurface,
  getVariantAttributeOrder,
  getVariantSelectionDescription,
} from "@/lib/productDetailPresentation";

describe("product detail presentation", () => {
  it("uses the saved product type before the broad department", () => {
    expect(getProductSurface("electronics", "mobile-phones")).toBe("phone");
    expect(getProductSurface("electronics", "laptops")).toBe("laptop");
    expect(getProductSurface("electronics", "smart-watches")).toBe("smart-watch");
  });

  it("does not give watches or laptops phone-only facts", () => {
    expect(getProductDetailFactKeys("watch")).toEqual([
      "brand", "gender", "movement", "caseMaterial", "strapMaterial", "waterResistance", "color", "condition",
    ]);
    expect(getProductDetailFactKeys("laptop")).toContain("processor");
    expect(getProductDetailFactKeys("laptop")).not.toContain("network");
  });

  it("puts the comparison dimension first for each catalogue surface", () => {
    expect(getVariantAttributeOrder("phone")[0]).toBe("storage");
    expect(getVariantAttributeOrder("laptop")[0]).toBe("processor");
    expect(getVariantAttributeOrder("watch")[0]).toBe("movement");
    expect(getVariantSelectionDescription("phone")).toMatch(/storage/i);
  });

  it("uses buyer-facing labels for saved attribute keys", () => {
    expect(formatVariantAttributeLabel("storageType")).toBe("Storage type");
    expect(formatVariantAttributeLabel("simType")).toBe("SIM / cellular support");
    expect(formatVariantAttributeLabel("batteryHealth")).toBe("Battery health");
  });
});
