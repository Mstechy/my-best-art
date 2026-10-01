/**
 * Bring legacy `card-` derivatives up to the width the code advertises.
 *
 *     npm run backfill:card-widths              # report only, changes nothing
 *     npm run backfill:card-widths -- --apply   # re-encode and overwrite
 *
 * The bug this fixes
 * ------------------
 * `ProductImage.tsx` emits a srcset built from compile-time constants:
 *
 *     srcSet: `${cardSmallUrl} 320w, ${cardSrc} 600w`
 *
 * That 600 comes from `CARD_SIZE` in productImages.ts, which was lowered from 900
 * to 600 in an earlier change. Files uploaded BEFORE that change were never
 * re-encoded, so the srcset keeps advertising 600w for a file that is really
 * 800px or 900px wide. The browser trusts the descriptor, picks what it believes
 * is a 600px candidate, and downloads an 800px asset. Measured on production: a
 * card the page describes as 600w is 800x800 and weighs 461 KB.
 *
 * The srcset is not merely imprecise - it is selecting the wrong file.
 *
 * Why this writes nothing to the database
 * ---------------------------------------
 * The large card URL is not a stored column. `getProductCardImageUrl` derives it
 * from the original URL by a string rewrite:
 *
 *     /original-<stem>.jpg  ->  /card-<stem>.webp
 *
 * So the destination key is already known and already correct. Re-uploading to it
 * fixes every reference at once, and there is no row to update and therefore
 * nothing that can be left half-written. This is a storage-only job.
 *
 * The key is upserted, so a partially completed run is safe to repeat, and the
 * originals are only ever read - never modified.
 */
import { loadEnv } from "vite";
import sharp from "sharp";

import { fetchRows, readSupabaseConfig, type ResolvedSupabase } from "./supabaseRest.ts";

/** Must match CARD_SIZE / CARD_QUALITY / CARD_MIME_TYPE in src/lib/productImages.ts. */
const CARD_SIZE = 600;
const CARD_QUALITY = 72;
const CARD_MIME = "image/webp";

/** Tolerant of a small pixel delta so a correct 600px file is never re-encoded. */
const SIZE_TOLERANCE = 4;

const PAGE_SIZE = 100;
const CONCURRENCY = 5;
const BUCKET = "product-images";

interface ProductImageRow {
  id: string;
  image_url: string | null;
}

interface Outcome {
  id: string;
  status: "ok" | "unchanged" | "failed";
  reason: string;
  beforeBytes: number;
  afterBytes: number;
  beforeWidth: number;
  afterWidth: number;
}

function resolveConfig(root: string): ResolvedSupabase | null {
  const env = { ...loadEnv("production", root, ""), ...process.env };
  const url = readSupabaseConfig("production", root).url;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** The `/original-<stem>.<ext>` storage key, derived from the public URL. */
function originalKeyFromUrl(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const at = publicUrl.indexOf(marker);
  if (at === -1) return null;
  const key = publicUrl.slice(at + marker.length).split("?")[0];
  return key && /\/original-/i.test(key) ? key : null;
}

/** `/card-<stem>.webp` beside it - the exact key `getProductCardImageUrl` asks for. */
function cardKeyFromOriginal(originalKey: string): string {
  const slash = originalKey.lastIndexOf("/");
  const dir = originalKey.slice(0, slash + 1);
  const stem = originalKey.slice(slash + 1).replace(/^original-/i, "").replace(/\.[^.]+$/, "");
  return `${dir}card-${stem}.webp`;
}

async function fetchBuffer(url: string, headers: Record<string, string> = {}): Promise<Buffer | null> {
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer());
}

async function resizeOne(config: ResolvedSupabase, row: ProductImageRow, apply: boolean): Promise<Outcome> {
  const fail = (reason: string): Outcome => ({
    id: row.id, status: "failed", reason, beforeBytes: 0, afterBytes: 0, beforeWidth: 0, afterWidth: 0,
  });

  if (!row.image_url) return fail("no image_url");
  const originalKey = originalKeyFromUrl(row.image_url);
  if (!originalKey) return fail("not a product-images original URL");

  const cardKey = cardKeyFromOriginal(originalKey);
  const base = config.url.replace(/\/$/, "");
  const publicBase = `${base}/storage/v1/object/public/${BUCKET}`;
  const authHeaders = { apikey: config.key, Authorization: `Bearer ${config.key}` };

  // Read the existing derivative straight from storage rather than via the public
  // URL, so a private bucket is measured the same way as a public one.
  const existing = await fetchBuffer(`${base}/storage/v1/object/${BUCKET}/${cardKey}`, authHeaders);
  if (!existing) return fail("no existing card- derivative");

  const beforeWidth = (await sharp(existing).metadata()).width ?? 0;
  const beforeBytes = existing.length;

  if (beforeWidth && Math.abs(beforeWidth - CARD_SIZE) <= SIZE_TOLERANCE) {
    return {
      id: row.id, status: "unchanged", reason: `already ${beforeWidth}px`,
      beforeBytes, afterBytes: beforeBytes, beforeWidth, afterWidth: beforeWidth,
    };
  }

  const original = await fetchBuffer(`${publicBase}/${originalKey}`);
  if (!original) return fail("could not download the original");

  let resized: Buffer;
  try {
    resized = await sharp(original)
      .resize(CARD_SIZE, CARD_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: CARD_QUALITY })
      .toBuffer();
  } catch (error) {
    return fail(`re-encode failed: ${(error as Error).message}`);
  }

  const afterWidth = (await sharp(resized).metadata()).width ?? 0;
  const afterBytes = resized.length;

  if (!apply) {
    return { id: row.id, status: "ok", reason: cardKey, beforeBytes, afterBytes, beforeWidth, afterWidth };
  }

  // Upsert to the SAME key the runtime already resolves, so every existing
  // reference picks up the smaller file and no row needs touching.
  const upload = await fetch(`${base}/storage/v1/object/${BUCKET}/${cardKey}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": CARD_MIME, "x-upsert": "true", "Cache-Control": "31536000" },
    body: new Uint8Array(resized),
  });
  if (!upload.ok) return fail(`upload failed: HTTP ${upload.status} ${await upload.text()}`);

  return { id: row.id, status: "ok", reason: cardKey, beforeBytes, afterBytes, beforeWidth, afterWidth };
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

  console.log(apply ? "MODE: --apply (this WILL overwrite card files)" : "MODE: report only (no writes)");
  console.log(`Target width: ${CARD_SIZE}px (tolerance ${SIZE_TOLERANCE}px)\n`);

  const outcomes: Outcome[] = [];
  // All-zero sentinel, so the first page uses the same id=gt. shape as the rest.
  // A nullable cursor would need narrowing, and narrowing inside a loop whose
  // break conditions read `rows` re-creates the inference cycle documented in
  // backfillSmallCards.ts.
  let lastId = "00000000-0000-0000-0000-000000000000";

  for (;;) {
    const rows = await fetchRows<ProductImageRow>(
      config,
      "product_images",
      `select=id,image_url&id=gt.${lastId}&order=id.asc&limit=${PAGE_SIZE}`,
    );
    if (rows.length === 0) break;

    await mapLimit(rows, CONCURRENCY, async (row) => {
      outcomes.push(await resizeOne(config, row, apply));
    });

    lastId = rows[rows.length - 1].id;
    if (rows.length < PAGE_SIZE) break;
  }

  const kb = (bytes: number) => `${Math.round(bytes / 1024)}KB`;
  const resized = outcomes.filter((o) => o.status === "ok");
  const already = outcomes.filter((o) => o.status === "unchanged");
  const failed = outcomes.filter((o) => o.status === "failed");

  for (const o of outcomes) {
    if (o.status === "ok") {
      console.log(`  [resize] ${o.beforeWidth}px -> ${o.afterWidth}px   ${kb(o.beforeBytes)} -> ${kb(o.afterBytes)}`);
    } else if (o.status === "failed") {
      console.log(`  [failed] ${o.id} ${o.reason}`);
    }
  }

  const before = resized.reduce((sum, o) => sum + o.beforeBytes, 0);
  const after = resized.reduce((sum, o) => sum + o.afterBytes, 0);
  console.log(
    `\n${outcomes.length} image(s): ${resized.length} to resize, ${already.length} already correct, ${failed.length} failed.`,
  );
  if (resized.length) {
    console.log(`Desktop grid weight: ${kb(before)} -> ${kb(after)} (${(100 - (after / before) * 100).toFixed(0)}% smaller)`);
  }
  if (!apply && resized.length) console.log("\nRe-run with --apply to overwrite the card files.");
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

