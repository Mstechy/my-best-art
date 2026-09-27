import { describe, expect, it } from "vitest";
import { buildListingReadiness, MIN_DESCRIPTION_LENGTH, type ListingReadinessInput } from "@/lib/listingReadiness";

/** A listing that satisfies every requirement, so tests can change one thing at a time. */
const completeListing = (overrides: Partial<ListingReadinessInput> = {}): ListingReadinessInput => ({
  categoryId: "cat-1",
  productTypeKey: "mobile-phones",
  title: "Xiaomi 7 Pro Tablet",
  description: "x".repeat(MIN_DESCRIPTION_LENGTH),
  price: "250000",
  stockQuantity: "12",
  categoryAttributes: {},
  requiredSpecificationKeys: [],
  imageCount: 1,
  variantRows: [],
  ...overrides,
});

const requirement = (input: ListingReadinessInput, label: string) => {
  const found = buildListingReadiness(input).find((item) => item.label === label);
  if (!found) throw new Error(`no requirement labelled ${label}`);
  return found;
};

describe("listing readiness", () => {
  it("passes a single-price listing that meets every requirement", () => {
    const results = buildListingReadiness(completeListing());
    expect(results.every((item) => item.complete)).toBe(true);
    expect(results).toHaveLength(5);
  });

  // The regression: the base price field is read-only and therefore empty once a
  // listing prices itself through SKU rows. Requiring it disabled Submit forever.
  it("accepts an option-priced listing even though the base price is empty", () => {
    const input = completeListing({
      price: "",
      stockQuantity: "",
      variantRows: [{ price: "250000", stock: "3" }, { price: "310000", stock: "4" }],
    });
    const offer = requirement(input, "Offer");
    expect(offer.complete).toBe(true);
    expect(buildListingReadiness(input).every((item) => item.complete)).toBe(true);
  });

  it("sends option-pricing problems to the Options tab, not Basics", () => {
    const input = completeListing({
      price: "",
      variantRows: [{ price: "", stock: "3" }],
    });
    expect(requirement(input, "Offer")).toMatchObject({ complete: false, tab: "variants" });
  });

  it("requires every option row to be priced", () => {
    const priced = completeListing({
      price: "",
      variantRows: [{ price: "100", stock: "1" }, { price: "0", stock: "1" }],
    });
    expect(requirement(priced, "Offer").complete).toBe(false);

    const nonNumeric = completeListing({
      price: "",
      variantRows: [{ price: "abc", stock: "1" }],
    });
    expect(requirement(nonNumeric, "Offer").complete).toBe(false);
  });

  it("requires whole, non-negative stock on every option row", () => {
    const fractional = completeListing({
      price: "",
      variantRows: [{ price: "100", stock: "1.5" }],
    });
    expect(requirement(fractional, "Offer").complete).toBe(false);

    const negative = completeListing({
      price: "",
      variantRows: [{ price: "100", stock: "-1" }],
    });
    expect(requirement(negative, "Offer").complete).toBe(false);
  });

  it("treats a blank single-price stock as zero rather than an error", () => {
    // Matches handleSave, which reads Number("") as 0 and accepts it.
    expect(requirement(completeListing({ stockQuantity: "" }), "Offer").complete).toBe(true);
  });

  it("rejects a zero or missing base price for a single-price listing", () => {
    expect(requirement(completeListing({ price: "0" }), "Offer")).toMatchObject({ complete: false, tab: "basic" });
    expect(requirement(completeListing({ price: "" }), "Offer")).toMatchObject({ complete: false, tab: "basic" });
  });

  it("measures the description after trimming", () => {
    const padded = " ".repeat(20) + "x".repeat(MIN_DESCRIPTION_LENGTH - 1);
    expect(requirement(completeListing({ description: padded }), "Buyer-facing content")).toMatchObject({
      complete: false,
      tab: "basic",
    });
  });

  it("requires each required specification to be filled in", () => {
    const input = completeListing({
      requiredSpecificationKeys: ["brand", "storage"],
      categoryAttributes: { brand: "Xiaomi" },
    });
    expect(requirement(input, "Required specifications")).toMatchObject({ complete: false, tab: "specs" });

    const filled = completeListing({
      requiredSpecificationKeys: ["brand"],
      categoryAttributes: { brand: "  Xiaomi  " },
    });
    expect(requirement(filled, "Required specifications").complete).toBe(true);
  });

  it("asks for a photo on the Photos tab", () => {
    expect(requirement(completeListing({ imageCount: 0 }), "Main product photo")).toMatchObject({
      complete: false,
      tab: "media",
    });
  });

  it("groups all the remaining work when nothing has been filled in yet", () => {
    const empty = buildListingReadiness({
      categoryId: "",
      productTypeKey: "",
      title: "",
      description: "",
      price: "",
      stockQuantity: "",
      categoryAttributes: {},
      requiredSpecificationKeys: ["brand"],
      imageCount: 0,
      variantRows: [],
    });
    expect(empty.filter((item) => !item.complete).map((item) => item.label)).toEqual([
      "Product identity",
      "Buyer-facing content",
      "Offer",
      "Required specifications",
      "Main product photo",
    ]);
  });
});
