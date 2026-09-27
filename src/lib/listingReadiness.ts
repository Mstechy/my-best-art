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
}

export interface ListingReadinessInput {
  categoryId: string;
  productTypeKey: string;
  title: string;
  description: string;
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
