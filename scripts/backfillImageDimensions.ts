/**
 * Backfill `product_images.image_width` / `image_height` for rows uploaded before
 * the masonry feed needed them.
 *
 * Run once after the `20260930000000_product_image_dimensions.sql` migration:
 *
 *     npm run backfill:image-dimensions
 *
 * How it works, and why this way:
 *
 *   * It reads only the FIRST 64 KB of each image (`Range: bytes=0-65535`) and
 *     parses the header. Every format the marketplace accepts carries its size in
 *     the first few dozen bytes, so backfilling a catalogue does not download a
 *     catalogue - the difference between a job that runs in a minute and one that
 *     runs for an hour and costs a month of storage egress.
 *   * It walks rows in `id` order with `id=gt.` keyset paging rather than OFFSET, so
 *     a row inserted mid-run cannot make another row be skipped or measured twice.
 *   * A row that cannot be read is REPORTED and left NULL, never written as 0. NULL
 *     means "unknown" and the card reserves 1:1; a zero would be a lie that the
 *     CHECK constraints from the migration reject anyway.
 *   * Writes need the service-role key, because `product_images` is only writable by
 *     the seller who owns the product (RLS). The key is read from
 *     `SUPABASE_SERVICE_ROLE_KEY` and is never logged.
 *
 * Safe to re-run: it only ever selects rows whose dimensions are still NULL.
 */
import { loadEnv } from "vite";

import { fetchRows, patchRows, readSupabaseConfig, type ResolvedSupabase } from "./supabaseRest.ts";
import { IMAGE_HEADER_SNIFF_BYTES, parseImageDimensions } from "../src/lib/imageHeaders.ts";

/** How many rows are read per page. Small enough to keep a long run resumable. */
const PAGE_SIZE = 100;

/** How many images are fetched at once. Enough to hide latency, gentle on storage. */
const CONCURRENCY = 5;

interface PendingImageRow {
  id: string;
  image_url: string | null;
}

interface Measurement {
  width: number | null;
  height: number | null;
  bytes: number | null;
}

function resolveWriteConfig(root: string): ResolvedSupabase | null {
  const env = { ...loadEnv("production", root, ""), ...process.env };
  // The URL comes from the shared resolver so every spelling of it keeps working;
  // only the key differs, because a write has to bypass RLS.
  const url = readSupabaseConfig("production", root).url;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** Intrinsic size from the leading bytes of an image, plus the file's true size. */
async function measure(url: string): Promise<Measurement> {
  const response = await fetch(url, {
    headers: { Range: `bytes=0-${IMAGE_HEADER_SNIFF_BYTES - 1}` },
  });
  if (!response.ok) throw new Error(`Image responded ${response.status}`);

  const buffer = await response.arrayBuffer();
  const dimensions = parseImageDimensions(buffer);

  // `Content-Range: bytes 0-65535/123456` carries the TOTAL size, which is the real
  // byte count of the upload; `content-length` would report the truncated range.
  const contentRange = response.headers.get("content-range");
  const totalFromRange = contentRange?.split("/")[1];
  const bytes =
    totalFromRange && totalFromRange !== "*"
      ? Number(totalFromRange)
      : Number(response.headers.get("content-length") ?? 0) || null;

  return {
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    bytes: Number.isFinite(bytes) ? bytes : null,
  };
}

async function main(): Promise<void> {
  const config = resolveWriteConfig(process.cwd());
  if (!config) {
    console.error(
      "Missing credentials. Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY, then re-run.",
    );
    process.exitCode = 1;
    return;
  }

  let lastId = "00000000-0000-0000-0000-000000000000";
  let scanned = 0;
  let updated = 0;
  let unreadable = 0;
  let failed = 0;

  // The same file can be attached to more than one product, so a URL is measured
  // once per run no matter how many rows point at it.
  const cache = new Map<string, Measurement>();

  for (;;) {
    const rows = await fetchRows<PendingImageRow>(
      config,
      "product_images",
      `select=id,image_url&or=(image_width.is.null,image_height.is.null)&id=gt.${lastId}&order=id.asc&limit=${PAGE_SIZE}`,
    );
    if (rows.length === 0) break;
    scanned += rows.length;
    lastId = rows[rows.length - 1].id;

    for (let index = 0; index < rows.length; index += CONCURRENCY) {
      const batch = rows.slice(index, index + CONCURRENCY);
      await Promise.all(
        batch.map(async (row) => {
          if (!row.image_url || !/^https?:/i.test(row.image_url)) {
            unreadable += 1;
            console.warn(`[skip] ${row.id}: image_url is not an http(s) URL`);
            return;
          }
          try {
            let measurement = cache.get(row.image_url);
            if (!measurement) {
              measurement = await measure(row.image_url);
              cache.set(row.image_url, measurement);
            }
            if (measurement.width === null || measurement.height === null) {
              unreadable += 1;
              console.warn(`[skip] ${row.id}: could not read a size from ${row.image_url}`);
              return;
            }
            await patchRows(config, "product_images", `id=eq.${row.id}`, {
              image_width: measurement.width,
              image_height: measurement.height,
              image_bytes: measurement.bytes,
            });
            updated += 1;
          } catch (error) {
            failed += 1;
            console.error(`[fail] ${row.id}:`, error instanceof Error ? error.message : error);
          }
        }),
      );
    }

    console.log(`...scanned ${scanned}, updated ${updated}, unreadable ${unreadable}, failed ${failed}`);
  }

  console.log(`Done. scanned ${scanned}, updated ${updated}, unreadable ${unreadable}, failed ${failed}.`);
  if (unreadable > 0 || failed > 0) {
    // A non-zero exit is reserved for real failures: an unreadable image is a known,
    // acceptable outcome (the card reserves 1:1) and must not fail a deploy.
    if (failed > 0) process.exitCode = 1;
    console.log(
      "Rows left with NULL dimensions keep a 1:1 reserved box on every card. Re-run this script to retry them.",
    );
  }
}

void main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
