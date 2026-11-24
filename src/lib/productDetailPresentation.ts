export type ProductSurface = "phone" | "laptop" | "watch" | "smart-watch" | "general";

const ATTRIBUTE_LABELS: Record<string, string> = {
  brand: "Brand",
  model: "Model",
  color: "Colour",
  colour: "Colour",
  storage: "Storage",
  storageType: "Storage type",
  ram: "RAM",
  processor: "Processor",
  screenSize: "Screen size",
  displayResolution: "Display resolution",
  resolution: "Resolution",
  graphics: "Graphics",
  operatingSystem: "Operating system",
  network: "Mobile network support",
  simType: "SIM / cellular support",
  battery: "Battery",
  batteryCapacity: "Battery capacity",
  batteryHealth: "Battery health",
  gender: "Gender",
  caseSize: "Case size",
  caseMaterial: "Case material",
  strapMaterial: "Strap material",
  waterResistance: "Water resistance",
  connectivity: "Connectivity",
  movement: "Movement",
  size: "Size",
  capacity: "Capacity",
  material: "Material",
  dimensions: "Dimensions",
  weight: "Weight",
  cosmeticCondition: "Cosmetic condition",
  condition: "Condition",
};

const normalize = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function formatVariantAttributeLabel(key: string): string {
  const trimmed = key.trim();
  const compactKey = trimmed.replace(/[\s_-]+/g, "").toLowerCase();
  const canonicalKey = Object.keys(ATTRIBUTE_LABELS).find(
    (candidate) => candidate.replace(/[\s_-]+/g, "").toLowerCase() === compactKey,
  );
  return ATTRIBUTE_LABELS[trimmed]
    ?? ATTRIBUTE_LABELS[trimmed.charAt(0).toLowerCase() + trimmed.slice(1)]
    ?? (canonicalKey ? ATTRIBUTE_LABELS[canonicalKey] : undefined)
    ?? trimmed.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

/**
 * Resolve the buyer-facing product surface from saved catalogue metadata.
 * Product type wins over the department because Electronics can contain
 * phones, laptops, audio and appliances at the same time.
 */
export function getProductSurface(
  categorySlug: string | null | undefined,
  productTypeKey: string | null | undefined,
): ProductSurface {
  const productType = normalize(productTypeKey);
  if (productType === "mobile-phones" || productType === "phones") return "phone";
  if (productType === "laptops") return "laptop";
  if (productType === "smart-watches") return "smart-watch";
  if (productType === "watches") return "watch";

  const category = normalize(categorySlug);
  if (category === "watches") return "watch";
  if (category === "smart-watches") return "smart-watch";
  if (category === "computers") return "laptop";
  if (category === "phones-accessories" || category === "phones-and-accessories") return "phone";
  return "general";
}

/** High-signal facts shown beside the purchase controls. Missing facts are omitted. */
export function getProductDetailFactKeys(surface: ProductSurface): readonly string[] {
  switch (surface) {
    case "phone":
      return ["brand", "model", "storage", "network", "connectivity", "operatingSystem", "batteryHealth", "condition"];
    case "laptop":
      return ["brand", "model", "processor", "ram", "storage", "storageType", "screenSize", "displayResolution", "graphics", "operatingSystem", "condition"];
    case "watch":
      return ["brand", "gender", "movement", "caseMaterial", "strapMaterial", "waterResistance", "color", "condition"];
    case "smart-watch":
      return ["brand", "model", "caseSize", "connectivity", "battery", "condition"];
    default:
      return ["brand", "model", "material", "color", "condition"];
  }
}

/**
 * Keep variant selection in the order buyers use to compare a product type.
 * The selector still derives the actual values from real in-stock variants.
 */
export function getVariantAttributeOrder(surface: ProductSurface): readonly string[] {
  switch (surface) {
    case "phone":
      return ["storage", "ram", "processor", "color", "colour", "network", "connectivity", "condition"];
    case "laptop":
      return ["processor", "ram", "storage", "storageType", "screenSize", "color", "colour", "condition"];
    case "watch":
      return ["movement", "caseMaterial", "strapMaterial", "color", "colour", "size", "condition"];
    case "smart-watch":
      return ["caseSize", "connectivity", "color", "colour", "condition"];
    default:
      return ["size", "capacity", "color", "colour", "condition"];
  }
}

export function getVariantSelectionDescription(surface: ProductSurface): string {
  switch (surface) {
    case "phone":
      return "Choose the storage or configuration to see its exact price, stock, and matching image.";
    case "laptop":
      return "Choose the exact processor, memory, storage, or configuration before adding it to your cart.";
    case "watch":
      return "Choose the exact movement, size, colour, or configuration when the seller provides variants.";
    case "smart-watch":
      return "Choose the exact case size or connectivity configuration when available.";
    default:
      return "Choose the exact configuration to see its price, stock, and matching image.";
  }
}
