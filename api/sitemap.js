import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://www.tradibu.com";
const PAGE_SIZE = 1000;

/**
 * Both spellings are accepted. The project ships `VITE_SUPABASE_ANON` in .env
 * (see .env.example), while earlier Vercel setups used `VITE_SUPABASE_ANON_KEY`.
 * Reading only one of them is what made this endpoint return 500 on deploys
 * where the other name happened to be the one configured.
 */
function readConfig() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_ANON ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;
  return { url, key };
}

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

/**
 * Always answer with well-formed XML.
 *
 * A 500 from a sitemap is the worst outcome for indexing: Search Console drops
 * the child sitemap and stops crawling the product URLs entirely, whereas an
 * empty-but-valid urlset is simply re-read later. So a failure here degrades to
 * an empty sitemap and logs loudly, instead of taking the whole product index
 * offline until someone notices the dashboard.
 */
function sendSitemap(response, urls, status = 200) {
  response.status(status);
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  response.end(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
  );
}

/** Vercel function: serves every approved public product to search crawlers. */
export default async function handler(_request, response) {
  const { url, key } = readConfig();
  if (!url || !key) {
    // Logged, not thrown: a missing env var is a deployment mistake, and this
    // is the only way to see it. Vercel surfaces console output in the logs.
    console.error("[sitemap] Missing Supabase env vars. Expected VITE_SUPABASE_URL and VITE_SUPABASE_ANON.");
    sendSitemap(response, "");
    return;
  }

  // `createClient` validates the URL eagerly and THROWS on a malformed or
  // empty one. It used to sit outside the try block, so a single bad env var
  // produced an unhandled exception and a raw 500 for the crawler. Everything
  // that can throw has to be inside the guard.
  const products = [];
  let from = 0;

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    for (;;) {
      const { data, error } = await supabase
        .from("products")
        .select("id, updated_at")
        .eq("status", "active")
        .eq("is_approved", true)
        .order("updated_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      products.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const urls = products
      .map((product) => {
        const lastmod = product.updated_at
          ? `<lastmod>${new Date(product.updated_at).toISOString().slice(0, 10)}</lastmod>`
          : "";
        return `<url><loc>${SITE_URL}/product/${escapeXml(product.id)}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
      })
      .join("");

    console.log(`[sitemap] Served ${products.length} product URLs.`);
    sendSitemap(response, urls);
  } catch (error) {
    // Log the real cause. The previous catch discarded it entirely, which is
    // why this endpoint failed for an unknown reason on a live domain.
    console.error("[sitemap] Failed to build product sitemap:", error);
    sendSitemap(response, "", 200);
  }
}

