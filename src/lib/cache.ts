/**
 * In-memory cache with TTL (time-to-live) for client-side data caching.
 * Reduces redundant Supabase calls and improves perceived performance.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a cached value. Returns undefined if the key doesn't exist or is expired.
 */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

/**
 * Set a cached value with an optional TTL in milliseconds.
 */
export function cacheSet<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * Invalidate a specific cache key.
 */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all cache entries whose key matches a prefix.
 */
export function cacheInvalidateByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Clear the entire cache.
 */
export function cacheClear(): void {
  store.clear();
}

/**
 * Fetch data with caching: returns cached value if fresh,
 * otherwise calls the fetcher and caches the result.
 */
export async function cacheFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) return cached;

  const data = await fetcher();
  cacheSet(key, data, ttlMs);
  return data;
}

/**
 * Create a cache key from a list of parts (e.g. table name, params).
 */
export function cacheKey(...parts: (string | number | boolean | undefined | null)[]): string {
  return parts.filter(p => p != null).join(":");
}

/**
 * Reactively fetch with a stale-while-revalidate pattern:
 * returns cached data immediately (if any), then re-fetches in background.
 */
export async function cacheStaleWhileRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<{ data: T; stale: boolean }> {
  const cached = cacheGet<T>(key);
  if (cached !== undefined) {
    // Fire background refresh
    fetcher()
      .then(fresh => cacheSet(key, fresh, ttlMs))
      .catch(() => { /* silent – stale data is better than nothing */ });
    return { data: cached, stale: true };
  }

  const fresh = await fetcher();
  cacheSet(key, fresh, ttlMs);
  return { data: fresh, stale: false };
}