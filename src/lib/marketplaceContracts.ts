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

/** Keep stale or malformed catalogue responses from crossing category boundaries. */
export function filterProductsByCategory<T extends MarketplaceCategoryProduct>(products: T[], categoryId: string | null): T[] {
  return categoryId ? products.filter((product) => product.category_id === categoryId) : products;
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
