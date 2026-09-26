/**
 * Filter state and helpers, kept out of MarketplaceFilters.tsx so that file
 * exports only components. React Fast Refresh can otherwise bail out of
 * hot-reloading the component when a module also exports plain values or
 * functions.
 */
export interface MarketplaceFiltersState {
  minPrice: number;
  maxPrice: number;
  minRating: number;
  inStockOnly: boolean;
  condition: string; // "any" | "new" | "used" | "refurbished"
  categoryAttributes: Record<string, string>;
}

export const defaultFilters: MarketplaceFiltersState = {
  minPrice: 0,
  maxPrice: 10000,
  minRating: 0,
  inStockOnly: false,
  condition: "any",
  categoryAttributes: {},
};

export function countActive(f: MarketplaceFiltersState): number {
  let n = 0;
  if (f.minPrice > 0 || f.maxPrice < 10000) n++;
  if (f.minRating > 0) n++;
  if (f.inStockOnly) n++;
  if (f.condition !== "any") n++;
  n += Object.values(f.categoryAttributes).filter(Boolean).length;
  return n;
}
