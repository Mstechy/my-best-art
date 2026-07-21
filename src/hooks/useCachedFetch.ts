import { useState, useEffect, useRef, useCallback } from "react";
import { cacheGet, cacheSet, cacheStaleWhileRevalidate, cacheKey as buildKey } from "@/lib/cache";

interface UseCachedFetchOptions<T> {
  /** Cache TTL in milliseconds (default 5 minutes) */
  ttlMs?: number;
  /** If true, always refetch from network before returning cache */
  bypassCache?: boolean;
  /** If true, shows stale data immediately while refreshing in background */
  staleWhileRevalidate?: boolean;
  /** Callback when data is successfully fetched */
  onSuccess?: (data: T) => void;
  /** Callback when fetch fails */
  onError?: (error: unknown) => void;
}

interface UseCachedFetchResult<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  /** Manually refetch, optionally bypassing cache */
  refetch: (bypass?: boolean) => Promise<void>;
}

/**
 * React hook for fetching data with client-side caching.
 * Wraps the cache.ts primitives into a convenient hook.
 *
 * @param cacheKey - Unique key for this cache entry (falsy = skip fetch)
 * @param fetcher - Async function that returns the data
 * @param options - Caching options
 */
export function useCachedFetch<T = unknown>(
  cacheKey: string | undefined | null,
  fetcher: () => Promise<T>,
  options: UseCachedFetchOptions<T> = {},
): UseCachedFetchResult<T> {
  const { ttlMs, bypassCache = false, staleWhileRevalidate: swr = false, onSuccess, onError } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(undefined);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetch = useCallback(async (bypass = false) => {
    if (!cacheKey) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      if (bypass) {
        // Bypass cache – always hit network
        const fresh = await fetcherRef.current();
        if (!mountedRef.current) return;
        cacheSet(cacheKey, fresh, ttlMs);
        setData(fresh);
        setLoading(false);
        onSuccess?.(fresh);
        return;
      }

      if (swr) {
        // Stale-while-revalidate: show cached immediately, refresh in bg
        const cached = cacheGet<T>(cacheKey);
        if (cached !== undefined) {
          setData(cached);
          setLoading(false);
          // Background refresh
          fetcherRef.current()
            .then(fresh => {
              if (!mountedRef.current) return;
              cacheSet(cacheKey, fresh, ttlMs);
              setData(fresh);
              onSuccess?.(fresh);
            })
            .catch(err => {
              if (!mountedRef.current) return;
              setError(err);
              onError?.(err);
            });
          return;
        }
      }

      // Standard: check cache, then fetch
      const cached = cacheGet<T>(cacheKey);
      if (cached !== undefined && !bypass) {
        setData(cached);
        setLoading(false);
        return;
      }

      const fresh = await fetcherRef.current();
      if (!mountedRef.current) return;
      cacheSet(cacheKey, fresh, ttlMs);
      setData(fresh);
      setLoading(false);
      onSuccess?.(fresh);
    } catch (err) {
      if (!mountedRef.current) return;
      // Fall back to cache on error if we have it
      const cached = cacheGet<T>(cacheKey);
      if (cached !== undefined) {
        setData(cached);
      }
      setError(err);
      setLoading(false);
      onError?.(err);
    }
  }, [cacheKey, ttlMs, swr, onSuccess, onError]);

  useEffect(() => {
    mountedRef.current = true;
    fetch(bypassCache);
    return () => {
      mountedRef.current = false;
    };
  }, [fetch, bypassCache]);

  const refetch = useCallback(async (bypass = false) => {
    await fetch(bypass);
  }, [fetch]);

  return { data, loading, error, refetch };
}

/**
 * Build a cache key from parts for use with Supabase queries.
 * e.g. cacheKeyFor("products", { categoryId: "abc" }) => "products:categoryId=abc"
 */
export function cacheKeyFor(prefix: string, params?: Record<string, unknown>): string {
  if (!params) return prefix;
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);
  return parts.length ? buildKey(prefix, ...parts) : prefix;
}