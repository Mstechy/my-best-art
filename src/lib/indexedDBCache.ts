import Dexie, { type Table } from "dexie";

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  ttl: number;
  expiresAt: number;
}

export interface CacheMeta {
  key: string;
  createdAt: number;
  ttl: number;
}

class MarketHubDB extends Dexie {
  cache!: Table<CacheEntry<unknown>>;
  meta!: Table<CacheMeta>;

  constructor() {
    super("MarketHubDB");
    this.version(1).stores({
      cache: "key, expiresAt",
      meta: "key, createdAt",
    });
  }
}

const db = new MarketHubDB();

export async function persistentCacheGet<T>(key: string): Promise<T | null> {
  try {
    const entry = await db.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      await db.cache.delete(key);
      await db.meta.delete(key);
      return null;
    }
    await db.meta.put({ key, createdAt: entry.createdAt, ttl: entry.ttl });
    return entry.value as T;
  } catch {
    return null;
  }
}

export async function persistentCacheSet<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): Promise<void> {
  const now = Date.now();
  try {
    await db.cache.put({
      key,
      value,
      createdAt: now,
      ttl: ttlMs,
      expiresAt: now + ttlMs,
    });
    await db.meta.put({ key, createdAt: now, ttl: ttlMs });
  } catch {
    // Storage full or private mode - fail silently
  }
}

export async function persistentCacheDelete(key: string): Promise<void> {
  await db.cache.delete(key);
  await db.meta.delete(key);
}

export async function persistentCacheClear(): Promise<void> {
  await db.cache.clear();
  await db.meta.clear();
}

export async function persistentCacheHas(key: string): Promise<boolean> {
  try {
    const entry = await db.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      await db.cache.delete(key);
      await db.meta.delete(key);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function persistentCacheKeys(): Promise<string[]> {
  try {
    const all = await db.cache.toArray();
    const now = Date.now();
    const valid = all.filter(entry => entry.expiresAt > now);
    if (valid.length !== all.length) {
      const expired = all.filter(entry => entry.expiresAt <= now).map(entry => entry.key);
      await db.cache.bulkDelete(expired);
      await db.meta.bulkDelete(expired);
    }
    return valid.map(entry => entry.key);
  } catch {
    return [];
  }
}

export function createCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  return `${prefix}:${JSON.stringify(sorted)}`;
}