const MAX_QUERIES = 80;

export type CachedSearchResult = {
  query: string;
  results: Array<{
    id: string;
    title: string;
    price: number;
    product_images?: { image_url: string }[];
  }>;
  updatedAt: number;
};

const recentSearches: CachedSearchResult[] = [];

export function getCachedSearch(query: string): CachedSearchResult | undefined {
  if (!query.trim()) return undefined;
  const q = query.trim().toLowerCase();
  const now = Date.now();
  const hit = recentSearches.find(item => item.query.toLowerCase() === q);
  if (!hit) return undefined;
  const age = now - hit.updatedAt;
  if (age > 5 * 60 * 1000) {
    const idx = recentSearches.indexOf(hit);
    if (idx >= 0) recentSearches.splice(idx, 1);
    return undefined;
  }
  return hit;
}

export function setCachedSearch(result: CachedSearchResult) {
  const idx = recentSearches.findIndex(item => item.query.toLowerCase() === result.query.toLowerCase());
  if (idx >= 0) recentSearches.splice(idx, 1);
  recentSearches.unshift(result);
  while (recentSearches.length > MAX_QUERIES) recentSearches.pop();
}