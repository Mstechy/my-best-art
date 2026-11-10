type ListingVariants = {
  productType?: { key?: unknown } | null;
  categoryAttributes?: Record<string, unknown> | null;
  colors?: string[] | null;
  sizes?: string[] | null;
} | null;

export type ProductListingPresentationInput = {
  title?: string | null;
  brand?: string | null;
  condition?: string | null;
  categorySlug?: string | null;
  variants?: unknown;
};

const PHONE_PRODUCT_TYPES = new Set(["mobile-phones", "phones"]);
const PHONE_CATEGORIES = new Set(["electronics", "phones-accessories", "phones-and-accessories"]);
const WATCH_PRODUCT_TYPES = new Set(["watches", "smart-watches"]);
const WATCH_CATEGORIES = new Set(["watches", "smart-watches"]);

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const cleanValue = (value: unknown) => typeof value === "string" ? value.trim() : "";

const readVariants = (value: unknown): ListingVariants => (
  value && typeof value === "object" ? value as ListingVariants : null
);

const isPhoneListing = (input: ProductListingPresentationInput) => {
  const variants = readVariants(input.variants);
  const productType = cleanValue(variants?.productType?.key);
  const category = cleanValue(input.categorySlug).toLowerCase();
  // A broad electronics category can contain laptops, audio and appliances.
  // Prefer the saved product type whenever it exists; only use the legacy
  // category fallback for older listings that have no product type metadata.
  return productType ? PHONE_PRODUCT_TYPES.has(productType) : PHONE_CATEGORIES.has(category);
};

const isLaptopListing = (input: ProductListingPresentationInput) => {
  const variants = readVariants(input.variants);
  return cleanValue(variants?.productType?.key) === "laptops";
};

const isAudioListing = (input: ProductListingPresentationInput) => {
  const variants = readVariants(input.variants);
  return cleanValue(variants?.productType?.key) === "audio";
};

const isWatchListing = (input: ProductListingPresentationInput) => {
  const variants = readVariants(input.variants);
  const productType = cleanValue(variants?.productType?.key);
  const category = cleanValue(input.categorySlug).toLowerCase();
  return productType ? WATCH_PRODUCT_TYPES.has(productType) : WATCH_CATEGORIES.has(category);
};

/**
 * Return the short comparison signals that belong under a catalogue price.
 *
 * The detail page remains the source of the complete specification sheet. A
 * card should only expose a few high-value facts, and only when the seller
 * supplied them. Values already present in the title are omitted so a listing
 * such as "Apple iPhone 16 Pro 256GB" does not repeat "256GB" below itself.
 */
export function getProductListingMeta(input: ProductListingPresentationInput): string[] {
  const attributes = readVariants(input.variants)?.categoryAttributes ?? {};
  const phone = isPhoneListing(input);
  const laptop = isLaptopListing(input);
  const audio = isAudioListing(input);
  const watch = isWatchListing(input);
  const keys = phone
    ? ["model", "storage", "network", "connectivity", "cosmeticCondition", "condition"]
    : laptop
      ? ["model", "processor", "ram", "storage", "storageType", "screenSize", "condition"]
      : audio
        ? ["model", "connectivity", "battery", "color", "condition"]
        : watch
          ? ["model", "movement", "caseMaterial", "strapMaterial", "waterResistance", "condition"]
    : ["model", "storage", "color", "size", "condition"];
  const title = normalize(cleanValue(input.title));
  const seen = new Set<string>();
  const values: string[] = [];

  for (const key of keys) {
    const value = cleanValue(attributes[key]);
    const normalized = normalize(value);
    if (!value || !normalized || normalized === title || title.includes(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    values.push(value);
    if (values.length === 3) break;
  }

  return values;
}

/**
 * Seller-facing title guidance for high-consideration phone listings. This is
 * advisory: it never blocks an existing listing or changes the saved title.
 */
function getTitleQuality(input: ProductListingPresentationInput, productLabel: "phone" | "laptop" | "audio"): string | null {
  const title = normalize(cleanValue(input.title));
  const attributes = readVariants(input.variants)?.categoryAttributes ?? {};
  const brand = normalize(cleanValue(input.brand) || cleanValue(attributes.brand));
  const model = normalize(cleanValue(attributes.model));
  const missing: string[] = [];

  if (!brand || !title.includes(brand)) missing.push("brand");
  if (!model || !title.includes(model)) missing.push("model");

  return missing.length > 0
    ? `Add the ${missing.join(" and ")} to the product title so buyers can compare ${productLabel} listings.`
    : null;
}

export function getProductTitleQuality(input: ProductListingPresentationInput): string | null {
  if (isPhoneListing(input)) return getTitleQuality(input, "phone");
  if (isLaptopListing(input)) return getTitleQuality(input, "laptop");
  if (isAudioListing(input)) return getTitleQuality(input, "audio");
  return null;
}

export function getPhoneTitleQuality(input: ProductListingPresentationInput): string | null {
  return isPhoneListing(input) ? getTitleQuality(input, "phone") : null;
}

export function getLaptopTitleQuality(input: ProductListingPresentationInput): string | null {
  return isLaptopListing(input) ? getTitleQuality(input, "laptop") : null;
}

export function getAudioTitleQuality(input: ProductListingPresentationInput): string | null {
  return isAudioListing(input) ? getTitleQuality(input, "audio") : null;
}
