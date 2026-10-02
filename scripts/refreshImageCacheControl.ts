/**
 * Rewrite the `Cache-Control` header on existing product-image objects -
 * the originals themselves and their `card-` / `card320-` derivatives.
 *
 * WHY THIS EXISTS
 * ---------------
 * `backfillCardWidths.ts` and `backfillSmallCards.ts` each sent the literal
 * header value `Cache-Control: 31536000`. That is not a directive - a
 * Cache-Control field is a comma-separated list of `name=value` directives, and
 * a bare integer matches none of them, so user agents discard it and the
 * resource is left with NO freshness lifetime. Supabase stores the header
 * verbatim (it only prepends "public, "), so what shipped was:
 *
 *     cache-control: public, 31536000
 *
 * Verified against the live bucket, versus the runtime upload path which omits
 * the option and therefore inherits Supabase's default:
 *
 *     original-*.jpeg    ->  public, max-age=3600     (1h)
 *     card320-*.webp     ->  public, 31536000         (no directive, ignored)
 *
 * The practical cost was every grid image being re-fetched on every visit.
 * Lighthouse costed it at 224 KiB of repeat-visit transfer. The first pass
 * repaired only the derivatives and left `original-*` alone; a later audit then
 * priced ONE homepage `original-*.jpeg` at 93 KiB of repeat-visit transfer,
 * because its own header still said 1h. Originals are included from now on:
 * their keys embed `Date.now()` at write time (`original-<epoch>-<stem>`) and
 * are never overwritten in place, so a year-long lifetime is correct - and it
 * stays revalidatable (not `immutable`) in case a key ever is rewritten.
 *
 * WHY NOT JUST RE-RUN THE BACKFILLS
 * ---------------------------------
 * They are both designed to skip work that is already done - `backfillCardWidths`
 * returns "unchanged" for any derivative already at 600px, and
 * `backfillSmallCards` only selects rows whose `card_small_url` is still NULL.
 * Re-running either would therefore leave these headers exactly as broken as
 * they are. Repairing stored metadata needs its own pass.
 *
 * HOW
 * ---
 * Supabase storage exposes no metadata-only update, so the header can only be
 * rewritten by writing the object again. This job re-uploads the bytes it just
 * read back from storage rather than re-encoding from the original: the pixels
 * are already correct, so re-encoding would burn CPU to produce a byte-identical
 * file. That also means this job cannot change what any image looks like.
 *
 * Deliberately not `immutable`. These keys ARE rewritten in place whenever the
 * derivative recipe changes (the 800/900px -> 600px `card-` resize did exactly
 * that), so a stale copy has to remain revalidatable on reload.
 *
 * USAGE
 *   node --experimental-strip-types scripts/refreshImageCacheControl.ts           # report only
 *   node --experimental-strip-types scripts/refreshImageCacheControl.ts --apply   # rewrite
 */
import { loadEnv } from "vite";

import { fetchRows, readSupabaseConfig, type ResolvedSupabase } from "./supabaseRest.ts";

/** Must match the values the runtime and the backfills write. */
const BUCKET = "product-images";

/**
 * Content type for the re-upload, derived from the key's own extension.
 * Derivatives are always WebP, but originals carry whatever the seller
 * uploaded - re-uploading a `.jpeg` as `image/webp` would silently corrupt the
 * object's stored MIME type for every future response.
 */
function mimeForKey(key: string): string {
  const ext = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "avif") return "image/avif";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/**
 * A real directive. See the header comment: a bare number is silently ignored.
 * One year is safe here because every key embeds the write-time timestamp (or,
 * for the older rows, has only ever been written once), so a changed file
 * cannot reuse an old key.
 */
const CACHE_CONTROL = "max-age=31536000";

const PAGE_SIZE = 100;
const CONCURRENCY = 5;

interface ProductImageRow {
  id: string;
  image_url: string | null;
}

interface Outcome {
  key: string;
  status: "rewritten" | "missing" | "failed";
  reason?: string;
  bytes: number;
}

/**
 * Writes go to the service role, exactly as `backfillCardWidths` and
 * `backfillSmallCards` do: rewriting a storage object is an UPDATE against
 * storage.objects, which the anon role is not permitted to make. The anon key
 * still only ever reads, and `readSupabaseConfig` deliberately exposes no
 * service key, so it is read from the environment here.
 */
function resolveConfig(root: string): ResolvedSupabase | null {
  const env = { ...loadEnv("production", root, ""), ...process.env };
  const url = readSupabaseConfig("production", root).url;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}


/** Split an `/original-<stem>.<ext>` key into the directory and stem. */
function splitOriginal(key: string): { dir: string; stem: string } | null {
  const slash = key.lastIndexOf("/");
  const dir = key.slice(0, slash + 1);
  const file = key.slice(slash + 1);
  if (!/^original-/i.test(file)) return null;
  return { dir, stem: file.replace(/^original-/i, "").replace(/\.[^.]+$/, "") };
}

/** Turn a public storage URL into its object key. */
function storageKeyFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  return decodeURIComponent(url.slice(at + marker.length));
}

/**
 * Every derivative that can exist beside a given original. Kept as a list rather
 * than one key so a row that only ever produced `card320-` is still repaired.
 */
function derivativeKeys(originalKey: string): string[] {
  const parts = splitOriginal(originalKey);
  if (!parts) return [];
  return [`${parts.dir}card-${parts.stem}.webp`, `${parts.dir}card320-${parts.stem}.webp`];
}

async function refreshOne(config: ResolvedSupabase, key: string, apply: boolean): Promise<Outcome> {
  const base = config.url.replace(/\/$/, "");
  const authHeaders = { apikey: config.key, Authorization: `Bearer ${config.key}` };
  const objectUrl = `${base}/storage/v1/object/${BUCKET}/${key}`;

  // Read the existing object. A 404 is normal - not every row has both sizes -
  // and must not be reported as a failure.
  let bytes: Buffer;
  try {
    const read = await fetch(objectUrl, { headers: authHeaders });
    if (!read.ok) {
      return { key, status: read.status === 404 ? "missing" : "failed", reason: `HTTP ${read.status}`, bytes: 0 };
    }
    bytes = Buffer.from(await read.arrayBuffer());
  } catch (error) {
    return { key, status: "failed", reason: `read failed: ${(error as Error).message}`, bytes: 0 };
  }

  if (!apply) return { key, status: "rewritten", bytes: bytes.length };

  // Write the SAME bytes back, only to replace the stored metadata.
  try {
    const upload = await fetch(objectUrl, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": mimeForKey(key), "x-upsert": "true", "Cache-Control": CACHE_CONTROL },
      body: new Uint8Array(bytes),
    });
    if (!upload.ok) {
      return { key, status: "failed", reason: `HTTP ${upload.status} ${await upload.text()}`, bytes: bytes.length };
    }
  } catch (error) {
    return { key, status: "failed", reason: `upload failed: ${(error as Error).message}`, bytes: bytes.length };
  }

  return { key, status: "rewritten", bytes: bytes.length };
}

/** Run `worker` over `items` with at most `limit` in flight. */
async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  });
  await Promise.all(runners);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const config = resolveConfig(process.cwd());
  if (!config) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; nothing to do.");
    process.exitCode = 1;
    return;
  }

  const outcomes: Outcome[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const rows = await fetchRows<ProductImageRow>(
      config,
      "product_images",
      `select=id,image_url&image_url=not.is.null&order=id&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    if (rows.length === 0) break;

    const keys = rows.flatMap((row) => {
      const key = row.image_url ? storageKeyFromUrl(row.image_url) : null;
      if (!key || !splitOriginal(key)) return [];
      // The original itself first (this is the object a fallback or hero slide
      // actually fetches, and the one the audit priced at 93 KiB), then every
      // derivative name that can exist beside it.
      return [key, ...derivativeKeys(key)];
    });

    await mapLimit(keys, CONCURRENCY, async (key) => {
      outcomes.push(await refreshOne(config, key, apply));
    });

    if (rows.length < PAGE_SIZE) break;
  }

  const count = (status: Outcome["status"]) => outcomes.filter((o) => o.status === status).length;
  const rewritten = outcomes.filter((o) => o.status === "rewritten");
  const totalBytes = rewritten.reduce((sum, o) => sum + o.bytes, 0);

  for (const o of outcomes.filter((x) => x.status === "failed")) {
    console.error(`FAILED  ${o.key}  ${o.reason}`);
  }

  console.log(`${apply ? "Rewrote" : "Would rewrite"} : ${count("rewritten")} (${(totalBytes / 1024).toFixed(0)} KiB)`);
  console.log(`Missing   : ${count("missing")}`);
  console.log(`Failed    : ${count("failed")}`);
  if (!apply) console.log("\nDry run. Re-run with --apply to write the corrected headers.");
  if (count("failed") > 0) process.exitCode = 1;
}

await main();
