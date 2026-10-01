/**
 * Seed the fixture catalogue the masonry layout is verified against.
 *
 *     npm run seed:masonry-fixtures -- --seller=<uuid>          create 30 products
 *     npm run seed:masonry-fixtures -- --cleanup                remove them again
 *
 * Why fixtures and not the real catalogue: the checks in section 8 of the brief are
 * about EDGE SHAPES - a product that is genuinely 3:4, one that is genuinely
 * square, one panorama, one portrait screenshot, one with no stored dimensions at
 * all, and one whose image URL 404s. A real catalogue rarely contains all of those
 * at once, so the layout regressions they cause go unnoticed until a seller
 * happens to upload a photo with exactly the wrong shape.
 *
 * Every fixture is titled with a `[Masonry fixture]` prefix, so they are obvious in
 * the catalogue, easy to filter for cleanup, and impossible to mistake for stock.
 * Images are generated at exact dimensions by picsum.photos, which is why the ratios
 * are controlled; the deliberately broken URL resolves to `.test`, a reserved TLD
 * that never resolves, so the placeholder case is reproducible without relying on a
 * host being down.
 *
 * Run it against a development project. `--seller` is required because the product
 * row is owned by a seller, and a fixture that belongs to nobody is a fixture that
 * cannot be cleaned up.
 */
import { loadEnv } from "vite";

import { deleteRows, fetchRows, insertRows, readSupabaseConfig, type ResolvedSupabase } from "./supabaseRest.ts";

const FIXTURE_PREFIX = "[Masonry fixture]";
const FIXTURE_SKU_PREFIX = "MASONRY-FIXTURE-";

interface FixtureShape {
  name: string;
  width: number;
  height: number;
  /** Set for the row that has no stored dimensions, to exercise the 1:1 fallback. */
  omitDimensions?: boolean;
  /** Set for the row whose image URL must never load. */
  brokenUrl?: boolean;
}

/**
 * The shapes the layout has to survive, in the order they cycle through the list.
 * `w x h` is the true intrinsic size, before the 3:4 - 1:1 display clamp.
 */
const SHAPES: FixtureShape[] = [
  { name: "tall", width: 900, height: 1200 },
  { name: "square", width: 1000, height: 1000 },
  { name: "wide", width: 1400, height: 1050 },
  { name: "panorama", width: 3000, height: 600 },
  { name: "portrait", width: 720, height: 1280 },
  { name: "extreme-tall", width: 600, height: 3000 },
  { name: "tiny", width: 120, height: 80 },
  { name: "huge", width: 5000, height: 4000 },
  { name: "no-dimensions", width: 1000, height: 1000, omitDimensions: true },
  { name: "broken-url", width: 900, height: 1350, brokenUrl: true },
];

interface Args {
  seller?: string;
  cleanup: boolean;
  count: number;
}

function parseArgs(argv: string[]): Args {
  const sellerFlag = argv.find((flag) => flag.startsWith("--seller="));
  const countFlag = argv.find((flag) => flag.startsWith("--count="));
  return {
    seller: sellerFlag?.split("=")[1] || undefined,
    cleanup: argv.includes("--cleanup"),
    count: countFlag ? Math.max(1, Number(countFlag.split("=")[1]) || 30) : 30,
  };
}

function resolveWriteConfig(root: string): ResolvedSupabase | null {
  const env = { ...loadEnv("development", root, ""), ...process.env };
  const url = readSupabaseConfig("development", root).url;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

interface ProductRow {
  id: string;
  title: string;
}

/** Remove every product this script has ever created. Safe to run repeatedly. */
async function cleanup(config: ResolvedSupabase): Promise<number> {
  const recent = await fetchRows<ProductRow>(
    config,
    "products",
    "select=id,title&order=created_at.desc&limit=1000",
  );
  // Filtered in JavaScript rather than through a PostgREST pattern, because the
  // LIKE syntax and its escaping vary by server version and a misquoted pattern
  // would quietly delete real products.
  const fixtures = recent.filter((row) => row.title.startsWith(FIXTURE_PREFIX));
  if (fixtures.length === 0) {
    console.log("No masonry fixtures found; nothing to remove.");
    return 0;
  }
  const ids = fixtures.map((row) => row.id).join(",");
  // product_images references products ON DELETE CASCADE, so the image rows (and
  // their dimensions) go with them.
  await deleteRows(config, "products", `id=in.(${ids})`);
  console.log(`Removed ${fixtures.length} fixture product(s) and their image rows.`);
  return fixtures.length;
}

async function seed(config: ResolvedSupabase, seller: string, count: number): Promise<void> {
  const products: Record<string, unknown>[] = [];

  for (let index = 0; index < count; index += 1) {
    const shape = SHAPES[index % SHAPES.length];
    const name = String(index + 1).padStart(2, "0");
    // A title the section headings and filters can see, and a SKU the cleanup can
    // never miss even if the title wording changes later.
    const title = `${FIXTURE_PREFIX} ${name} - ${shape.name} (${shape.width}x${shape.height})`;
    const price = 5000 + index * 137;

    products.push({
      seller_id: seller,
      title,
      description: `Masonry fixture product ${name}. Shape: ${shape.name}. Used to verify the waterfall feed's reserved tile heights, clamped ratios and broken-image handling.`,
      price,
      // Above the price on purpose: the CHECK constraint only accepts a compare-at
      // price that is genuinely higher, and a discount badge is part of what the
      // card is being verified for.
      compare_at_price: price + 1500,
      currency: "NGN",
      status: "active",
      stock_quantity: 7,
      sku: `${FIXTURE_SKU_PREFIX}${name}`,
      is_approved: true,
      low_stock_threshold: 5,
    });
  }

  const created = await insertRows<ProductRow>(config, "products", products);
  console.log(`Inserted ${created.length} fixture product(s).`);

  const images = created.map((product, index) => {
    const shape = SHAPES[index % SHAPES.length];
    const name = String(index + 1).padStart(2, "0");
    const imageUrl = shape.brokenUrl
      // `.test` is reserved by RFC 2606 and never resolves, so this image is
      // guaranteed to fail on every machine rather than only when a host is down.
      ? `https://masonry-fixture.invalid/broken-${name}.jpg`
      : `https://picsum.photos/seed/tradibu-masonry-${name}/${shape.width}/${shape.height}.jpg`;

    return {
      product_id: product.id,
      image_url: imageUrl,
      is_primary: true,
      sort_order: 0,
      alt: `Masonry fixture ${shape.name} image`,
      // Stored so the fixture does not depend on the backfill having run first:
      // the point is to test the layout, not the backfill.
      image_width: shape.omitDimensions ? null : shape.width,
      image_height: shape.omitDimensions ? null : shape.height,
      image_bytes: 4096,
      image_format: "jpg",
    };
  });

  await insertRows(config, "product_images", images);
  console.log(
    `Inserted ${images.length} image row(s): tall, square, wide, panorama, portrait, ` +
      "extreme-tall, tiny, huge, one with no dimensions, and one broken URL.",
  );
  console.log(
    `Clean up with: npm run seed:masonry-fixtures -- --cleanup` +
      `\nIds: ${created.map((row) => row.id).join(", ")}`,
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = resolveWriteConfig(process.cwd());
  if (!config) {
    console.error(
      "Missing credentials. Set VITE_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exitCode = 1;
    return;
  }

  if (args.cleanup) {
    await cleanup(config);
    return;
  }

  if (!args.seller) {
    console.error(
      "Missing --seller=<uuid>. A product row is owned by a seller, and a fixture\n" +
        "nobody owns is a fixture nobody can clean up. Pass any seller user id.",
    );
    process.exitCode = 1;
    return;
  }

  await seed(config, args.seller, args.count);
}

void main().catch((error) => {
  console.error("Seeding failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
