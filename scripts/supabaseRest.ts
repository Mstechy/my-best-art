/**
 * Shared Supabase REST plumbing for the build-time prerenderers.
 *
 * `scripts/prerenderProductPages.ts` and `scripts/prerenderPublicPages.ts` both
 * read the same credentials and speak the same PostgREST dialect. Deriving that
 * twice is how the two would eventually disagree about which environment
 * variable counts - the exact bug that took `api/sitemap.js` off the air on some
 * deploys - so it lives here once.
 */
import { loadEnv } from "vite";

export interface SupabaseConfig {
  url?: string;
  key?: string;
}

export interface ResolvedSupabase {
  url: string;
  key: string;
}

/**
 * The project ships `VITE_SUPABASE_ANON` in .env while earlier Vercel setups
 * used `VITE_SUPABASE_ANON_KEY`. Reading only one of them is what made
 * api/sitemap.js fail on some deploys, so every spelling is accepted here too.
 *
 * `loadEnv(mode, root, "")` reads every variable rather than only the
 * `VITE_`-prefixed ones, and `process.env` is merged on top so a value injected
 * by the platform wins over the checked-in file.
 */
export function readSupabaseConfig(mode: string, root: string): SupabaseConfig {
  const env = { ...loadEnv(mode, root, ""), ...process.env };
  return {
    url: env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    key: env.VITE_SUPABASE_ANON || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
  };
}

/**
 * Narrow a config to the two strings, or null.
 *
 * Returning null rather than throwing keeps the prerenderers' contract intact:
 * a build with no credentials must still produce a working site, one whose pages
 * fall back to the plain SPA shell.
 */
export function resolveSupabase(config: SupabaseConfig): ResolvedSupabase | null {
  if (!config.url || !config.key) return null;
  return { url: config.url, key: config.key };
}

/**
 * One PostgREST GET.
 *
 * `query` is passed through as the raw query string, so a caller can ask for an
 * embedded relation (`select=a,b(c)`) without this helper second-guessing it.
 *
 * A non-2xx THROWS rather than resolving to an empty array. The two are not
 * interchangeable here: `[]` means the project genuinely has no rows, whereas a
 * 401 or a 500 wearing that disguise would strip a whole catalogue or every
 * department page off the site and do it so quietly that the build log would
 * still say "wrote 0 files" in a reassuring tone. The callers catch, warn, and
 * fall back to the shell.
 */
export async function fetchRows<T>(config: ResolvedSupabase, table: string, query: string): Promise<T[]> {
  const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
  });
  if (!response.ok) throw new Error(`Supabase ${table} responded ${response.status}`);
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? (rows as T[]) : [];
}

/**
 * One PostgREST PATCH, for rows that already exist.
 *
 * A PATCH rather than an upsert because the callers are maintenance jobs that fill
 * in a column on rows they did not create: an upsert would need the whole row, and
 * a missing column would silently rewrite the rest of it. `return=minimal` keeps
 * the response empty, since the caller only cares whether the write was accepted.
 *
 * A non-2xx THROWS, for the same reason `fetchRows` does: a silent 401 turns
 * "backfilled 0 rows" into a reassuring lie.
 */
export async function patchRows(
  config: ResolvedSupabase,
  table: string,
  query: string,
  body: unknown,
): Promise<void> {
  const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Supabase ${table} PATCH responded ${response.status}`);
  }
}

/**
 * Insert rows and hand back what the database assigned (ids, timestamps).
 *
 * `return=representation` is the whole point of taking this on: a fixture or a seed
 * needs the generated id immediately in order to write its dependent rows, and a
 * 201 with an empty body would force a second round trip just to find it again.
 */
export async function insertRows<T>(
  config: ResolvedSupabase,
  table: string,
  rows: Record<string, unknown>[],
): Promise<T[]> {
  if (rows.length === 0) return [];
  const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase ${table} INSERT responded ${response.status}: ${detail}`);
  }
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

/**
 * Delete the rows a query selects. A non-2xx THROWS for the same reason the other
 * helpers do: a maintenance job that "succeeded" while deleting nothing is worse
 * than one that failed loudly.
 */
export async function deleteRows(config: ResolvedSupabase, table: string, query: string): Promise<void> {
  const response = await fetch(`${config.url.replace(/\/$/, "")}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Prefer: "return=minimal",
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase ${table} DELETE responded ${response.status}`);
  }
}
