import Dexie, { type Table } from "dexie";

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  ttl: number;
  expiresAt: number;
  /** Size hint in bytes for eviction calculations */
  sizeBytes?: number;
}

/** Maximum number of entries in the cache before LRU eviction */
const MAX_CACHE_ENTRIES = 500;

/** Default TTL: 5 minutes */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Periodic cleanup interval: 2 minutes */
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;

class MarketHubDB extends Dexie {
  cache!: Table<CacheEntry<unknown>>;

  constructor() {
    super("MarketHubDB");
    this.version(2).stores({
      cache: "key, expiresAt, createdAt",
    });
  }
}

const db = new MarketHubDB();

// ---- Periodic cleanup of expired entries ----
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(async () => {
    try {
      const deleted = await db.cache
        .where("expiresAt")
        .below(Date.now())
        .delete();
      if (deleted > 0) {
        console.debug(`[IndexedDB Cache] Cleaned up ${deleted} expired entries`);
      }
    } catch {
      // Non-critical cleanup — ignore errors
    }
  }, CLEANUP_INTERVAL_MS);
}

startCleanupTimer();

// ---- LRU eviction when cache is full ----
async function ensureCapacity(): Promise<void> {
  try {
    const count = await db.cache.count();
    if (count < MAX_CACHE_ENTRIES) return;

    // Evict oldest entries (by createdAt) to get below 80% capacity
    const target = Math.floor(MAX_CACHE_ENTRIES * 0.8);
    const toEvict = count - target;

    const oldest = await db.cache
      .orderBy("createdAt")
      .limit(toEvict)
      .toArray();

    const keys = oldest.map(e => e.key);
    await db.cache.bulkDelete(keys);
    console.debug(`[IndexedDB Cache] Evicted ${keys.length} entries (capacity: ${count} → ${target})`);
  } catch {
    // Eviction is best-effort
  }
}

// ---- Public API ----

/**
 * Retrieve a value from the persistent cache.
 * Returns `null` if the key doesn't exist or has expired.
 */
export async function persistentCacheGet<T>(key: string): Promise<T | null> {
  try {
    const entry = await db.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      await db.cache.delete(key);
      return null;
    }

    // Update createdAt to mark as recently used (LRU refresh)
    await db.cache.update(key, { createdAt: Date.now() });
    return entry.value as T;
  } catch {
    return null;
  }
}

/**
 * Store a value in the persistent cache with an optional TTL.
 * Default TTL is 5 minutes. Automatically evicts old entries when full.
 */
export async function persistentCacheSet<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<void> {
  const now = Date.now();
  try {
    await ensureCapacity();
    await db.cache.put({
      key,
      value,
      createdAt: now,
      ttl: ttlMs,
      expiresAt: now + ttlMs,
    });
  } catch {
    // Storage full or private mode — fail silently
  }
}

/**
 * Delete a single entry from the cache.
 */
export async function persistentCacheDelete(key: string): Promise<void> {
  try {
    await db.cache.delete(key);
  } catch {
    // Non-critical
  }
}

/**
 * Clear all entries from the cache.
 */
export async function persistentCacheClear(): Promise<void> {
  try {
    await db.cache.clear();
  } catch {
    // Non-critical
  }
}

/**
 * Check if a key exists in the cache and is not expired.
 */
export async function persistentCacheHas(key: string): Promise<boolean> {
  try {
    const entry = await db.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      await db.cache.delete(key);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns all valid (non-expired) cache keys.
 */
export async function persistentCacheKeys(): Promise<string[]> {
  try {
    const now = Date.now();
    const all = await db.cache.where("expiresAt").above(now).toArray();
    return all.map(entry => entry.key);
  } catch {
    return [];
  }
}

/**
 * Get cache statistics for monitoring.
 */
export async function persistentCacheStats(): Promise<{
  totalEntries: number;
  expiredEntries: number;
  validEntries: number;
  estimatedSizeBytes: number;
}> {
  try {
    const now = Date.now();
    const all = await db.cache.toArray();
    const expired = all.filter(e => e.expiresAt <= now);
    const valid = all.filter(e => e.expiresAt > now);
    const estimatedSize = all.reduce((sum, e) => {
      try {
        return sum + JSON.stringify(e.value).length;
      } catch {
        return sum + 100;
      }
    }, 0);

    return {
      totalEntries: all.length,
      expiredEntries: expired.length,
      validEntries: valid.length,
      estimatedSizeBytes: estimatedSize,
    };
  } catch {
    return { totalEntries: 0, expiredEntries: 0, validEntries: 0, estimatedSizeBytes: 0 };
  }
}

/**
 * Delete all expired entries immediately.
 */
export async function persistentCacheCleanup(): Promise<number> {
  try {
    return await db.cache.where("expiresAt").below(Date.now()).delete();
  } catch {
    return 0;
  }
}

/**
 * Create a consistent cache key from a prefix and params object.
 * Sorts keys alphabetically for deterministic keys.
 */
export function createCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.fromEntries(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
  );
  return `${prefix}:${JSON.stringify(sorted)}`;
}