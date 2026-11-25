import { getProductType } from "@/lib/categoryConfig";

export interface DiscoveryCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  parent_id?: string | null;
  image_url?: string | null;
}

export interface DiscoveryProduct {
  category_id: string | null;
  variants: unknown;
  product_images?: Array<{
    image_url?: string | null;
    is_primary?: boolean | null;
  }>;
}

export interface DiscoveryShortcut extends DiscoveryCategory {
  productTypeKey?: string;
  productTypeLabel?: string;
}

/**
 * Return the canonical route for a product-led shortcut. A product type can
 * exist before a matching department row exists, so it must not route through
 * the synthetic `/categories/marketplace` slug.
 */
export function buildMarketplaceDiscoveryHref(shortcut: Pick<DiscoveryShortcut, "slug" | "productTypeKey">) {
  const query = shortcut.productTypeKey
    ? `?type=${encodeURIComponent(shortcut.productTypeKey)}`
    : "";

  if (shortcut.productTypeKey && shortcut.slug === "marketplace") {
    return `/marketplace${query}`;
  }

  return `/categories/${encodeURIComponent(shortcut.slug)}${query}`;
}

interface BuildMarketplaceDiscoveryArgs {
  products: DiscoveryProduct[];
  categories: DiscoveryCategory[];
  counts?: Record<string, number>;
  imageByCategory?: Record<string, string>;
  selectedCategoryId?: string | null;
  selectedProductTypeKey?: string | null;
  categoryContextPending?: boolean;
  maxItems?: number;
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  "mobile-phones": "Mobile phones",
  laptops: "Laptops",
  watches: "Watches",
  audio: "Audio",
};

const imageKey = (value: string) => {
  try {
    const url = new URL(value, "https://tradibu.local");
    url.search = "";
    url.hash = "";
    return url.href.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
};

const uniqueImages = (images: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  return images.filter((image): image is string => {
    if (!image?.trim()) return false;
    const key = imageKey(image);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const productImages = (product: DiscoveryProduct) =>
  (product.product_images || [])
    .slice()
    .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
    .map((image) => image.image_url);

const categoryHasPopulatedChild = (
  category: DiscoveryCategory,
  populatedIds: Set<string>,
  categories: DiscoveryCategory[],
) => categories.some((candidate) => candidate.parent_id === category.id && populatedIds.has(candidate.id));

/**
 * Builds the marketplace discovery rail from real catalogue rows.
 *
 * Product types are the shopper-facing leaf shortcuts. Their parent departments
 * stay in the sidebar and category hierarchy, but are not repeated beside their
 * children in the same rail (for example, Laptops + Computers).
 */
export function buildMarketplaceDiscoveryShortcuts({
  products,
  categories,
  counts = {},
  imageByCategory = {},
  selectedCategoryId = null,
  selectedProductTypeKey = null,
  categoryContextPending = false,
  maxItems = 8,
}: BuildMarketplaceDiscoveryArgs): DiscoveryShortcut[] {
  if (categoryContextPending) return [];

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const usedImages = new Set<string>();
  const productTypeGroups = new Map<string, {
    label: string;
    category: DiscoveryCategory | null;
    count: number;
    images: string[];
  }>();

  products.forEach((product) => {
    const productType = getProductType(product.variants);
    if (!productType?.key || !productType.label || productType.key === selectedProductTypeKey) return;

    const existing = productTypeGroups.get(productType.key);
    productTypeGroups.set(productType.key, {
      label: PRODUCT_TYPE_LABELS[productType.key] || productType.label,
      category: existing?.category || categoryById.get(product.category_id || "") || null,
      count: (existing?.count || 0) + 1,
      images: [...(existing?.images || []), ...productImages(product)],
    });
  });

  if (productTypeGroups.size > 0) {
    return [...productTypeGroups.entries()]
      .sort(([, left], [, right]) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, maxItems)
      .map(([key, group]) => {
        const category = group.category;
        const image = uniqueImages(group.images).find((candidate) => !usedImages.has(imageKey(candidate))) || null;
        if (image) usedImages.add(imageKey(image));
        return {
          id: `product-type:${key}`,
          name: group.label,
          slug: category?.slug || "marketplace",
          parent_id: category?.parent_id ?? null,
          image_url: image,
          productTypeKey: key,
          productTypeLabel: group.label,
        };
      });
  }

  const populated = categories.filter((category) => (counts[category.id] || 0) > 0);
  const populatedIds = new Set(populated.map((category) => category.id));
  const selectedCategory = selectedCategoryId ? categoryById.get(selectedCategoryId) : null;
  const source = selectedCategory
    ? populated.filter((category) => category.parent_id === selectedCategory.id)
    : populated.filter((category) => !categoryHasPopulatedChild(category, populatedIds, categories));

  const seenNames = new Set<string>();
  return source
    .slice()
    .sort((left, right) => (counts[right.id] || 0) - (counts[left.id] || 0) || left.name.localeCompare(right.name))
    .filter((category) => {
      const key = category.name.trim().toLowerCase();
      if (seenNames.has(key)) return false;
      seenNames.add(key);
      return true;
    })
    .slice(0, maxItems)
    .map((category) => {
      const productImage = uniqueImages(
        products
          .filter((product) => product.category_id === category.id)
          .flatMap(productImages),
      ).find((candidate) => !usedImages.has(imageKey(candidate)));
      const image = productImage || category.image_url || imageByCategory[category.id] || null;
      if (image) usedImages.add(imageKey(image));
      return { ...category, image_url: image };
    });
}
