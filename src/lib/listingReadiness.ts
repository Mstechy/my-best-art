/**
 * The readiness checks behind the seller's Submit button.
 *
 * Kept as a pure function, separate from SellerProducts, so the rules that
 * decide "why is Submit disabled?" can be tested directly.
 *
 * The bug this exists to prevent: the button used to require a non-empty base
 * `price` string. That field becomes read-only and empty as soon as a listing
 * prices itself through SKU rows, so every option-based listing was stuck with
 * a permanently disabled button and no explanation of why.
 *
 * These checks are a convenience, not a security boundary. handleSave re-checks
 * every one of them before writing, so a listing can never be published by
 * getting past this list.
 */

export interface ListingVariantRow {
  price: string;
  stock: string;
  optionName?: string;
  optionValue?: string;
  size?: string;
  color?: string;
}

export interface ListingReadinessInput {
  categoryId: string;
  productTypeKey: string;
  title: string;
  description: string;
  metaDescription?: string;
  shippingInfo?: string;
  /** Base price field. Empty whenever the listing prices itself through variants. */
  price: string;
  stockQuantity: string;
  categoryAttributes: Record<string, string>;
  requiredSpecificationKeys: readonly string[];
  imageCount: number;
  variantRows: readonly ListingVariantRow[];
}

export type ListingRequirementTab = "basic" | "variants" | "specs" | "media";

export interface ListingRequirement {
  /** Short name, shown before the detail. */
  label: string;
  /** What is still needed, in the seller's words. */
  detail: string;
  /** Tab that fixes this item, so the button can jump straight to it. */
  tab: ListingRequirementTab;
  complete: boolean;
}

export interface ListingQualityWarning {
  message: string;
  tab: ListingRequirementTab;
}

const capacityClaims = (value: string) =>
  [...value.matchAll(/\b(\d+(?:\.\d+)?)\s*(gb|tb)\b/gi)]
    .map((match) => `${match[1]}${match[2].toLowerCase()}`);

const isGenericShippingText = (value: string) =>
  /^(shipping|shipping information|shipping policy|delivery information)$/i.test(value.trim().replace(/[.!?]+$/, ""));

export function buildListingQualityWarnings(input: ListingReadinessInput): ListingQualityWarning[] {
  const warnings: ListingQualityWarning[] = [];
  const title = input.title.trim();

  if (/[.,;:!?)]$/.test(title)) {
    warnings.push({
      message: "Check the title ending; remove stray punctuation so the product name reads cleanly.",
      tab: "basic",
    });
  }

  const metaDescription = input.metaDescription?.trim() ?? "";
  if (metaDescription) {
    const supportedClaims = new Set([
      ...capacityClaims(title),
      ...capacityClaims(input.description),
      ...input.variantRows.flatMap((row) => [
        ...capacityClaims(row.optionValue ?? ""),
        ...capacityClaims(row.size ?? ""),
        ...capacityClaims(row.color ?? ""),
      ]),
      ...Object.values(input.categoryAttributes).flatMap(capacityClaims),
    ]);
    const unsupportedClaims = [...new Set(capacityClaims(metaDescription))]
      .filter((claim) => !supportedClaims.has(claim));
    if (unsupportedClaims.length > 0) {
      warnings.push({
        message: `Search description mentions ${unsupportedClaims.join(", ").toUpperCase()}, which is not listed in the title, description, specifications, or options. Verify it or remove it.`,
        tab: "basic",
      });
    }
  }

  if (input.shippingInfo && isGenericShippingText(input.shippingInfo)) {
    warnings.push({
      message: "Replace the generic shipping label with accurate delivery terms, or leave it blank until you can provide them.",
      tab: "basic",
    });
  }

  if (input.imageCount > 0 && input.imageCount < 3) {
    warnings.push({
      message: "Add more clear product photos from different angles to help buyers judge the item.",
      tab: "media",
    });
  }

  return warnings;
}

/** Minimum description length enforced by handleSave. */
export const MIN_DESCRIPTION_LENGTH = 80;

const isPriced = (row: ListingVariantRow) =>
  Number.isFinite(Number(row.price)) && Number(row.price) > 0;

const isWholeQuantity = (value: string) =>
  Number.isInteger(Number(value)) && Number(value) >= 0;

export function buildListingReadiness(input: ListingReadinessInput): ListingRequirement[] {
  const usesOptionPricing = input.variantRows.length > 0;
  const everyOptionPriced = usesOptionPricing && input.variantRows.every(isPriced);
  const everyOptionStocked = usesOptionPricing && input.variantRows.every((row) => isWholeQuantity(row.stock));

  return [
    {
      label: "Product identity",
      detail: "Category, product type, and a title",
      tab: "basic",
      complete: Boolean(input.categoryId && input.productTypeKey && input.title.trim()),
    },
    {
      label: "Buyer-facing content",
      detail: `A description of at least ${MIN_DESCRIPTION_LENGTH} characters`,
      tab: "basic",
      complete: input.description.trim().length >= MIN_DESCRIPTION_LENGTH,
    },
    {
      label: "Offer",
      detail: usesOptionPricing
        ? "A price and stock for every option"
        : "A price above zero and a whole stock quantity",
      tab: usesOptionPricing ? "variants" : "basic",
      complete: usesOptionPricing
        ? everyOptionPriced && everyOptionStocked
        : Number(input.price) > 0 && isWholeQuantity(input.stockQuantity),
    },
    {
      label: "Required specifications",
      detail: `${input.requiredSpecificationKeys.length} fields for this product type`,
      tab: "specs",
      complete: input.requiredSpecificationKeys.every((key) => Boolean(input.categoryAttributes[key]?.trim())),
    },
    {
      label: "Main product photo",
      detail: "One is required; 3 or more views are recommended",
      tab: "media",
      complete: input.imageCount > 0,
    },
  ];
}
