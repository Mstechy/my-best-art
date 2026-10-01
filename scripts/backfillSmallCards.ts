/**
 * Backfill `product_images.card_small_url` for rows uploaded before the feed
 * shipped its 320px phone variant.
 *
 * Run in report mode first - it changes nothing:
 *
 *     npm run backfill:small-cards
 *
 * Then, once the report looks right, write for real:
 *
 *     npm run backfill:small-cards -- --apply
 *
 * How it works, and why this way:
 *
 *   * It is the sibling of `backfillImageDimensions.ts` and follows the same
 *     contract: keyset paging on `id=gt.`, bounded concurrency, and a report of
 *     what could not be done rather than a silent skip.
 *   * It reuses the EXACT derivative recipe `uploadProductImagePair` uses -
 *     320px, WebP, quality 0.72, `card320-<stem>.webp` beside the original. That
 *     is deliberate. A second encoder or a different quality would leave the
 *     bucket holding two subtly different "small card" formats, and the grid
 *     would serve whichever one a given listing happened to get.
 *   * Unlike the dimensions job this cannot use a 64KB header read. Producing a
 *     derivative means decoding the whole image, so it does download the
 *     originals. That is the real cost of this job and the reason it is scoped
 *     to rows that have no variant at all.
 *   * It is safe to re-run: it only ever selects rows whose `card_small_url` is
 *     still NULL, so a partially completed run resumes where it stopped.
 *
 * Writes need the service-role key, because `product_images` is only writable by
 * the seller who owns the product (RLS). The key is read from
 * `SUPABASE_SERVICE_ROLE_KEY` and is never logged.
 *
 * `sharp` is a devDependency: this runs in Node at backfill time and never enters
 * the browser bundle.
 */
import { loadEnv } from "vite";
import sharp from "sharp";

import { fetchRows, patchRows, readSupabaseConfig, type ResolvedSupabase } from "./supabaseRest.ts";

/** Mirrors SMALL_CARD_SIZE / SMALL_CARD_QUALITY / CARD_MIME_TYPE in src/lib/productImages.ts. */
const SMALL_CARD_SIZE = 320;
const SMALL_CARD_QUALITY = 0.72;
const SMALL_CARD_MIME = "image/webp";

/** How many rows are read per page. */
const PAGE_SIZE = 100;

/** How many images are fetched and re-encoded at once. */
const CONCURRENCY = 5;

const BUCKET = "product-images";

interface PendingRow {
  id: string;
  image_url: string | null;
}

interface Outcome {
  id: string;
  status: "ok" | "skipped" | "failed";
  reason: string;
  beforeBytes: number;
  afterBytes: number;
}

function resolveWriteConfig(root: string): ResolvedSupabase | null {
  const env = { ...loadEnv("production", root, ""), ...process.env };
  const url = readSupabaseConfig("production", root).url;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * The storage object key, e.g. `abc/123/original-1699-photo.jpg`.
 *
 * Derived from the public URL rather than re-queried, because the URL is the only
 * record of the original path once the upload row has been written.
 */
function storageKeyFromUrl(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const at = publicUrl.indexOf(marker);
  if (at === -1) return null;
  const key = publicUrl.slice(at + marker.length).split("?")[0];
  return key || null;
}

/**
 * The 320px variant's object key for a given original.
 *
 * `uploadProductImagePair` writes `card320-<stem>.webp` next to
 * `original-<stem>.<format>`, so this is a prefix swap and an extension swap.
 * If either is missing, the row predates that layout and is skipped rather than
 * guessed at - writing to a key the app will never look up would be worse than
 * doing nothing, because the row would look complete and still serve 900px.
 */
function smallCardKey(originalKey: string): string | null {
  const slash = originalKey.lastIndexOf("/");
  const dir = slash === -1 ? "" : originalKey.slice(0, slash + 1);
  const file = slash === -1 ? originalKey : originalKey.slice(slash + 1);
  if (!/^original-/i.test(file)) return null;
  return `${dir}card320-${file.replace(/^original-/i, "").replace(/\.[^.]+$/, "")}.webp`;
}

async function backfillOne(config: ResolvedSupabase, row: PendingRow, apply: boolean): Promise<Outcome> {
  const fail = (reason: string): Outcome => ({ id: row.id, status: "failed", reason, beforeBytes: 0, afterBytes: 0 });

  if (!row.image_url) return fail("no image_url");

  const originalKey = storageKeyFromUrl(row.image_url);
  if (!originalKey) return fail(`not a ${BUCKET} public URL`);

  const cardKey = smallCardKey(originalKey);
  if (!cardKey) return fail("original key does not match the original-<stem>.<ext> layout");

  let original: ArrayBuffer;
  let beforeBytes: number;
  try {
    const response = await fetch(row.image_url);
    if (!response.ok) return fail(`download failed: HTTP ${response.status}`);
    original = await response.arrayBuffer();
    beforeBytes = original.byteLength;
  } catch (error) {
    return fail(`download failed: ${(error as Error).message}`);
  }

  let card: Buffer;
  try {
    card = await sharp(original)
      .resize(SMALL_CARD_SIZE, SMALL_CARD_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: SMALL_CARD_QUALITY })
      .toBuffer();
  } catch (error) {
    return fail(`re-encode failed: ${(error as Error).message}`);
  }

  if (!apply) {
    return { id: row.id, status: "ok", reason: cardKey, beforeBytes, afterBytes: card.byteLength };
  }

  const base = config.url.replace(/\/$/, "");
  const upload = await fetch(`${base}/storage/v1/object/${BUCKET}/${cardKey}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": SMALL_CARD_MIME,
      "x-upsert": "true",
      // Derivative keys embed a timestamp and are never rewritten in place, so
      // the browser and CDN can hold them indefinitely.
      "Cache-Control": "31536000",
    },
    body: new Uint8Array(card),
  });
  if (!upload.ok) return fail(`upload failed: HTTP ${upload.status} ${await upload.text()}`);

  try {
    await patchRows(
      config,
      "product_images",
      `id=eq.${row.id}`,
      { card_small_url: `${base}/storage/v1/object/public/${BUCKET}/${cardKey}` },
    );
  } catch (error) {
    return fail(`row update failed: ${(error as Error).message}`);
  }

  return { id: row.id, status: "ok", reason: cardKey, beforeBytes, afterBytes: card.byteLength };
}

/** Run `worker` over `items` with at most `limit` in flight. */
async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const root = process.cwd();
  const apply = process.argv.includes("--apply");
  const config = resolveWriteConfig(root);
  if (!config) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY; nothing to do.");
    process.exitCode = 1;
    return;
  }

  console.log(apply ? "MODE: --apply (this WILL write)" : "MODE: report only (no writes)");

  const outcomes: Outcome[] = [];

  // An all-zero UUID sorts before every real row, so the first page uses exactly
  // the same `id=gt.` shape as every page after it. A nullable cursor would also
  // work at runtime, but the `cursor ? ... : ""` ternary forces TypeScript to
  // narrow it, and narrowing inside a loop whose break conditions read `rows`
  // closes a cycle: rows <- query <- cursor <- control flow <- rows. TypeScript
  // resolves that cycle to `any`, which then poisons the row type downstream.
  // A plain string with no narrowing breaks the cycle by construction.
  let lastId = "00000000-0000-0000-0000-000000000000";

  for (;;) {
    const query =
      `select=id,image_url&card_small_url=is.null&id=gt.${lastId}&order=id.asc&limit=${PAGE_SIZE}`;
    const rows = await fetchRows<PendingRow>(config, "product_images", query);
    if (rows.length === 0) break;

    await mapLimit(rows, CONCURRENCY, async (row) => {
      outcomes.push(await backfillOne(config, row, apply));
    });

    lastId = rows[rows.length - 1].id;
    if (rows.length < PAGE_SIZE) break;
  }

  const kb = (bytes: number) => `${Math.round(bytes / 1024)}KB`;
  const failed = outcomes.filter((o) => o.status === "failed");
  const ok = outcomes.filter((o) => o.status === "ok");

  console.log(`\n${outcomes.length} row(s) missing a small card; ${ok.length} ok, ${failed.length} failed.`);
  for (const outcome of outcomes) {
    console.log(
      `  [${outcome.status}] ${outcome.id} ${outcome.reason}` +
        (outcome.status === "ok" ? ` ${kb(outcome.beforeBytes)} -> ${kb(outcome.afterBytes)}` : ""),
    );
  }

  const before = ok.reduce((sum, o) => sum + o.beforeBytes, 0);
  const after = ok.reduce((sum, o) => sum + o.afterBytes, 0);
  if (ok.length) {
    console.log(`\nOn a phone the grid would fetch ${kb(before)} instead of ${kb(after)} per full page.`);
  }
  if (!apply && outcomes.length) console.log("\nRe-run with --apply to write these.");
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
