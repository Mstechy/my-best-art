// Supabase Edge Function (Deno), not the Vite/browser TypeScript environment.
// Declaration below lets the editor type-check without Deno's type packages;
// it is erased at runtime.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// Shared module is inside supabase/functions so the CLI includes it in the bundle.
import {
  buildFeedItem,
  buildFeedXmlFooter,
  buildFeedXmlHeader,
  FEED_CURRENCY,
  feedSellerEligible,
  googleFeedIssues,
  googleProductCategory,
  isHttps,
  type FeedSellerFlags,
} from "../_shared/googleFeed.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-feed-secret",
};

/** PostgREST page size. Keeps memory bounded regardless of catalogue size. */
const PAGE_SIZE = 1000;
/** The run report stores reasons; cap the array so one broken catalogue cannot bloat the row. */
const MAX_RECORDED_ERRORS = 100;

interface ProductRow {
  id: string;
  title: string;
  description: string | null;
  price: number | string;
  compare_at_price: number | string | null;
  currency: string | null;
  brand: string | null;
  condition: string | null;
  gtin: string | null;
  mpn: string | null;
  seo_slug: string | null;
  stock_quantity: number | string;
  category_id: string | null;
  seller_id: string;
  product_images: { image_url: string; is_primary: boolean; sort_order: number }[] | null;
  product_variants: {
    id: string;
    price: number | string | null;
    stock_quantity: number;
    is_active: boolean;
    sort_order: number;
    image_url: string | null;
    option_values: Record<string, string> | null;
  }[] | null;
}

interface ProfileRow {
  user_id: string;
  is_approved: boolean | null;
  is_banned: boolean | null;
  is_frozen: boolean | null;
}

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
}

interface FeedError {
  product_id?: string;
  title?: string;
  reason: string;
}

/**
 * Builds the full Google Shopping XML from the live catalogue, uploads it to
 * the public `feeds` bucket, and records a run row for the admin dashboard.
 *
 * Three ways in, one auth rule each:
 *  - pg_cron sends `x-feed-secret` matching FEED_SECRET (set with
 *    `supabase secrets set`, mirrored into Vault for the cron SQL);
 *  - an admin clicks "Regenerate now" -> their user JWT, role-checked below;
 *  - anything else is a 401. verify_jwt=false in config.toml because this
 *    function authenticates itself (same pattern as `paystack`).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  let triggeredBy = "manual";
  let startedAt: string | null = null;
  let productCount = 0;
  let errorCount = 0;
  const errors: FeedError[] = [];
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing Supabase Edge Function configuration");
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!ANON_KEY) throw new Error("Missing SUPABASE_ANON_KEY");
    const FEED_SECRET = Deno.env.get("FEED_SECRET") ?? "";

    const feedSecret = req.headers.get("x-feed-secret");
    const authHeader = req.headers.get("Authorization") ?? "";

    if (feedSecret && FEED_SECRET && feedSecret === FEED_SECRET) {
      // Cron path. The body's trigger label ("schedule"/"change") is advisory.
      const body = await req.json().catch(() => ({}) as { trigger?: string });
      triggeredBy = body.trigger || "schedule";
    } else if (authHeader) {
      // Admin path: resolve the caller, then require the admin role server-side.
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: roleRow, error: roleError } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      if (roleError) throw roleError;
      const isAdmin = (roleRow ?? []).some((r: { role: string }) => r.role === "admin");
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      triggeredBy = "admin";
    } else {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    startedAt = new Date().toISOString();
    const recordProductError = (error: FeedError) => {
      errorCount += 1;
      if (errors.length < MAX_RECORDED_ERRORS) errors.push(error);
    };

    // --- Settings, exclusions, category paths (all small tables) ----------
    const { data: settingsRow, error: settingsError } = await admin
      .from("google_feed_settings")
      .select("default_brand, shipping_country, shipping_method, shipping_price_ngn")
      .limit(1)
      .maybeSingle();
    if (settingsError) throw settingsError;
    const shipping = settingsRow
      ? {
          country: settingsRow.shipping_country || "NG",
          method: settingsRow.shipping_method || "Standard",
          price: settingsRow.shipping_price_ngn,
        }
      : null;
    const defaultBrand = settingsRow?.default_brand || null;

    const { data: exclusionRows, error: exclusionsError } = await admin
      .from("google_feed_exclusions")
      .select("entity_type, entity_id");
    if (exclusionsError) throw exclusionsError;
    const excludedSellers = new Set<string>();
    const excludedProducts = new Set<string>();
    const excludedCollections = new Set<string>();
    for (const row of exclusionRows ?? []) {
      if (row.entity_type === "seller") excludedSellers.add(row.entity_id);
      else if (row.entity_type === "product") excludedProducts.add(row.entity_id);
      else excludedCollections.add(row.entity_id);
    }

    // Collection membership: a product inside any excluded collection is out.
    let excludedByCollection = new Set<string>();
    if (excludedCollections.size > 0) {
      const { data: members, error: collectionError } = await admin
        .from("marketplace_collection_products")
        .select("product_id, collection_id")
        .in("collection_id", Array.from(excludedCollections));
      if (collectionError) throw collectionError;
      excludedByCollection = new Set((members ?? []).map((m: { product_id: string }) => m.product_id));
    }

    const { data: categoryRows, error: categoriesError } = await admin
      .from("categories")
      .select("id, name, parent_id");
    if (categoriesError) throw categoriesError;
    const categoryById = new Map<string, CategoryRow>();
    for (const row of categoryRows ?? []) categoryById.set(row.id, row);
    /** "Phones" -> "Electronics > Phones"; depth-capped against parent cycles. */
    const categoryPath = (id: string | null): string | null => {
      if (!id) return null;
      const parts: string[] = [];
      let current: CategoryRow | undefined = categoryById.get(id);
      for (let depth = 0; current && depth < 5; depth++) {
        parts.unshift(current.name);
        current = current.parent_id ? categoryById.get(current.parent_id) : undefined;
      }
      return parts.length > 0 ? parts.join(" > ") : null;
    };

    // --- Paged walk over active + approved products -----------------------
    // One catalogue page and a small upload queue are retained at a time.
    const sellerFlags = new Map<string, FeedSellerFlags | null>();
    const encoder = new TextEncoder();
    let generationError: unknown;
    let pageRows: ProductRow[] = [];
    let pageIndex = 0;
    let nextOffset = 0;
    let isLastPage = false;
    let headerSent = false;
    const loadNextPage = async () => {
      const { data: page, error } = await admin
        .from("products")
        .select(
            "id, title, description, price, compare_at_price, currency, brand, condition, gtin, mpn, seo_slug, stock_quantity, category_id, seller_id, " +
            "product_images(image_url, is_primary, sort_order), product_variants(id, price, stock_quantity, is_active, sort_order, image_url, option_values)",
        )
        .eq("status", "active")
        .eq("is_approved", true)
        .order("id", { ascending: true })
        .range(nextOffset, nextOffset + PAGE_SIZE - 1);
      if (error) throw error;

      pageRows = (page ?? []) as ProductRow[];
      pageIndex = 0;
      isLastPage = pageRows.length < PAGE_SIZE;
      const missingSellers = new Set(
        pageRows.map((product) => product.seller_id).filter((id) => !sellerFlags.has(id)),
      );
      if (missingSellers.size > 0) {
        const { data: profiles, error: profilesError } = await admin
          .from("profiles")
          .select("user_id, is_approved, is_banned, is_frozen")
          .in("user_id", Array.from(missingSellers));
        if (profilesError) throw profilesError;
        for (const profile of (profiles ?? []) as ProfileRow[]) sellerFlags.set(profile.user_id, profile);
        for (const id of missingSellers) if (!sellerFlags.has(id)) sellerFlags.set(id, null);
      }
    };

    const xmlStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (!headerSent) {
            controller.enqueue(encoder.encode(buildFeedXmlHeader()));
            headerSent = true;
            return;
          }
          while ((controller.desiredSize ?? 0) > 0) {
            if (pageIndex >= pageRows.length) {
              if (pageRows.length > 0 && isLastPage) {
                controller.enqueue(encoder.encode(buildFeedXmlFooter()));
                controller.close();
                return;
              }
              if (pageRows.length > 0) nextOffset += PAGE_SIZE;
              await loadNextPage();
              if (pageRows.length === 0) {
                controller.enqueue(encoder.encode(buildFeedXmlFooter()));
                controller.close();
                return;
              }
            }

            const product = pageRows[pageIndex++];
            if (excludedProducts.has(product.id) || excludedByCollection.has(product.id)) continue;
            if (excludedSellers.has(product.seller_id)) continue;
            if (!feedSellerEligible(sellerFlags.get(product.seller_id))) continue;

            const images = (product.product_images ?? [])
              .slice()
              .sort((left, right) => {
                if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
                return (left.sort_order ?? 0) - (right.sort_order ?? 0);
              })
              .map((image) => image.image_url)
              .filter((imageUrl) => typeof imageUrl === "string");
            const validImages = images.filter((imageUrl) => {
              try {
                return new URL(imageUrl).protocol === "https:";
              } catch {
                return false;
              }
            });

            const variants = product.product_variants ?? [];
            const activeVariants = variants
              .filter((variant) => variant.is_active !== false)
              .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0));
            const productType = categoryPath(product.category_id);
            const googleCategory = googleProductCategory(productType);
            const feedVariants = activeVariants.length > 0 ? activeVariants : [null];
            for (const variant of feedVariants) {
              const variantOptions = variant?.option_values ?? {};
              const variantStock = variant ? Number(variant.stock_quantity || 0) : Number(product.stock_quantity) || 0;
              const variantPrice = Number(variant?.price ?? product.price);
              const variantImage = variant?.image_url && isHttps(variant.image_url) ? variant.image_url : null;
              const variantLabel = Object.entries(variantOptions)
                .filter(([key, value]) => !["gtin", "mpn"].includes(key) && value)
                .map(([, value]) => value)
                .join(" / ");
              const variantTitle = variantLabel ? `${product.title} - ${variantLabel}` : product.title;
              const variantGtin = variantOptions.gtin || (activeVariants.length <= 1 ? product.gtin : null);
              const variantMpn = variantOptions.mpn || (activeVariants.length <= 1 ? product.mpn : null);
              const issues = googleFeedIssues({
                status: "active",
                is_approved: true,
                price: variantPrice,
                imageCount: validImages.length + (variantImage ? 1 : 0),
                title: variantTitle,
                brand: product.brand,
                gtin: variantGtin,
                mpn: variantMpn,
                product_type: productType,
              });
              const blockingIssues = issues.filter((issue) =>
                !issue.startsWith("Add the product brand") &&
                !issue.startsWith("Add the manufacturer GTIN or MPN"),
              );
              if (blockingIssues.length > 0) {
                recordProductError({ product_id: product.id, title: variantTitle, reason: blockingIssues.join("; ") });
                continue;
              }

              const item = buildFeedItem(
                {
                  id: variant ? `${product.id}-${variant.id}` : product.id,
                  variantId: variant?.id,
                  itemGroupId: activeVariants.length > 1 ? product.id : null,
                  slug: product.seo_slug,
                  title: variantTitle,
                  description: product.description,
                  price: variantPrice,
                  compare_at_price: product.compare_at_price,
                  currency: FEED_CURRENCY,
                  brand: product.brand,
                  condition: product.condition,
                  gtin: variantGtin,
                  mpn: variantMpn,
                  stock_quantity: variantStock,
                  product_type: productType,
                  googleProductCategory: googleCategory,
                  color: variantOptions.color || variantOptions.colour,
                  size: variantOptions.size,
                  images: variantImage ? [variantImage, ...validImages] : validImages,
                },
                { shipping, defaultBrand },
              );
              controller.enqueue(encoder.encode(`${item}\n`));
              productCount += 1;
            }
          }
        } catch (error) {
          generationError = error;
          controller.error(error);
        }
      },
    }, { highWaterMark: 64 });

    // Upload the generated XML as a stream: catalogue pages and serialized
    // items are not retained in memory, even for very large product sets.
    const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/feeds/google-products.xml`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/rss+xml; charset=utf-8",
        "x-upsert": "true",
      },
      body: xmlStream,
    });
    if (!uploadResponse.ok) {
      const message = await uploadResponse.text();
      throw new Error(`Feed upload failed (${uploadResponse.status}): ${message.slice(0, 500)}`);
    }
    if (generationError) throw generationError;

    const { error: runLogError } = await admin.from("google_feed_runs").insert({
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      status: "success",
      product_count: productCount,
      error_count: errorCount,
      errors,
      triggered_by: triggeredBy,
    });
    if (runLogError) throw runLogError;

    return json({ ok: true, productCount, errorCount, triggeredBy });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (SUPABASE_URL && SERVICE_KEY) {
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { error: logError } = await admin.from("google_feed_runs").insert({
        started_at: startedAt ?? new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status: "error",
        product_count: productCount,
        error_count: errorCount + 1,
        errors: [...errors.slice(0, MAX_RECORDED_ERRORS - 1), { reason: message }],
        triggered_by: triggeredBy,
      });
      if (logError) console.error("Could not record failed Google feed run", logError);
    }
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
