export const MARKETPLACE_SORTS = [
  "relevance",
  "newest",
  "rating",
  "price_low",
  "price_high",
  "best_sellers",
  "trending",
  "recommended",
  "random",
  "flash_deals",
] as const;

export type MarketplaceCategoryProduct = { category_id: string | null };

export type MarketplaceCategoryNode = {
  id: string;
  parent_id?: string | null;
};

/** Return the selected department and every nested child department. */
export function getCategoryTreeIds(
  categories: readonly MarketplaceCategoryNode[],
  categoryId: string | null,
): Set<string> | null {
  if (!categoryId) return null;

  const ids = new Set<string>([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
}

/** Keep stale or malformed catalogue responses from crossing category boundaries. */
export function filterProductsByCategory<T extends MarketplaceCategoryProduct>(
  products: T[],
  categoryId: string | null,
  categoryIds?: ReadonlySet<string> | null,
): T[] {
  if (!categoryId) return products;
  const allowedIds = categoryIds ?? new Set([categoryId]);
  return products.filter((product) => product.category_id !== null && allowedIds.has(product.category_id));
}

export type MarketplaceSort = typeof MARKETPLACE_SORTS[number];

export function isMarketplaceSort(value: string | null | undefined): value is MarketplaceSort {
  return MARKETPLACE_SORTS.includes(value as MarketplaceSort);
}

export function dedupeProducts<T extends { id: string }>(products: T[], existing: T[] = []) {
  const seen = new Set(existing.map(product => product.id));
  return products.filter(product => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}
