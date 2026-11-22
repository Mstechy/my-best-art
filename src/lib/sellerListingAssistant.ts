import type { CategoryAttribute } from "@/lib/categoryConfig";
import { normalizeSellerListingDescription, normalizeSellerListingTitle, normalizeSellerListingValue } from "@/lib/sellerProductCsv";

export type SellerListingSuggestionInput = {
  productTypeLabel?: string;
  fields: CategoryAttribute[];
  categoryAttributes: Record<string, string | undefined>;
  requiredKeys?: string[];
};

export type SellerListingFact = {
  key: string;
  label: string;
  value: string;
};

export type SellerListingSuggestions = {
  title: string;
  description: string;
  facts: SellerListingFact[];
  missingRequiredLabels: string[];
};

const TITLE_ATTRIBUTE_KEYS = [
  "storage",
  "ram",
  "processor",
  "storageType",
  "connectivity",
  "screenSize",
  "size",
  "material",
  "movement",
];

const trimValue = (value: unknown) => typeof value === "string" ? normalizeSellerListingValue(value) : "";

const comparable = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const containsFact = (parts: string[], value: string) => {
  const candidate = comparable(value);
  if (!candidate) return true;
  return parts.some((part) => {
    const existing = comparable(part);
    return existing === candidate || existing.includes(candidate) || candidate.includes(existing);
  });
};

function buildFacts(input: SellerListingSuggestionInput): SellerListingFact[] {
  const facts: SellerListingFact[] = [];
  const seenKeys = new Set<string>();

  input.fields.forEach((field) => {
    if (seenKeys.has(field.key)) return;
    const value = trimValue(input.categoryAttributes[field.key]);
    if (!value) return;
    seenKeys.add(field.key);
    facts.push({ key: field.key, label: field.label, value });
  });

  // Some older listings keep generic facts outside the selected product type.
  // Include them only when the selected type did not already define the field,
  // so the suggestion never repeats Brand, Condition, or another attribute.
  const genericFields: Array<[string, string]> = [
    ["brand", "Brand"],
    ["condition", "Condition"],
    ["material", "Material"],
    ["color", "Color"],
  ];
  genericFields.forEach(([key, label]) => {
    if (seenKeys.has(key)) return;
    const value = trimValue(input.categoryAttributes[key]);
    if (!value) return;
    seenKeys.add(key);
    facts.push({ key, label, value });
  });

  return facts;
}

function buildTitle(input: SellerListingSuggestionInput, facts: SellerListingFact[]): string {
  if (facts.length === 0) return "";
  const valueFor = (key: string) => facts.find((fact) => fact.key === key)?.value || "";
  const model = valueFor("model");
  const brand = valueFor("brand");
  const parts: string[] = [];

  const append = (value: string) => {
    const cleaned = trimValue(value);
    if (!cleaned || containsFact(parts, cleaned)) return;
    parts.push(cleaned);
  };

  // A model is the strongest buyer-facing title anchor. If it already contains
  // the brand, do not produce titles such as “Apple Apple iPhone 17”.
  if (model) {
    if (brand && !comparable(model).includes(comparable(brand))) append(brand);
    append(model);
  } else {
    append(brand);
    append(input.productTypeLabel || "Product");
  }

  TITLE_ATTRIBUTE_KEYS.forEach((key) => {
    const value = valueFor(key);
    // A title should describe the model, not enumerate every selectable SKU.
    // The full values remain available in Details and Options.
    if (value.includes(",") || value.includes(" / ")) return;
    append(value);
  });

  const condition = valueFor("condition");
  if (condition && comparable(condition) !== "new") append(condition);

  return normalizeSellerListingTitle(parts.join(", ")).slice(0, 140).trim().replace(/[,\s]+$/, "");
}

function buildDescription(input: SellerListingSuggestionInput, facts: SellerListingFact[]): string {
  if (facts.length === 0) return "";
  const prefix = input.productTypeLabel ? `${input.productTypeLabel} product details:` : "Product details:";
  const factsText = facts.map((fact) => `${fact.label}: ${fact.value}`).join(". ");
  return normalizeSellerListingDescription(`${prefix} ${factsText}.`);
}

export function buildSellerListingSuggestions(input: SellerListingSuggestionInput): SellerListingSuggestions {
  const facts = buildFacts(input);
  const required = new Set(input.requiredKeys || []);
  const labelByKey = new Map(input.fields.map((field) => [field.key, field.label]));

  return {
    title: buildTitle(input, facts),
    description: buildDescription(input, facts),
    facts,
    missingRequiredLabels: [...required]
      .filter((key) => !trimValue(input.categoryAttributes[key]))
      .map((key) => labelByKey.get(key) || key),
  };
}
