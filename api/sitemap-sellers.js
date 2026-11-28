import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://www.tradibu.com";
const PAGE_SIZE = 1000;

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

function sendSitemap(response, urls, status = 200) {
  response.status(status);
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  if (status >= 500) response.setHeader("Retry-After", "300");
  response.end(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
  );
}

/** Vercel function: serves public storefronts backed by live catalogue data. */
export default async function handler(_request, response) {
  const { url, key } = readConfig();
  if (!url || !key) {
    console.error("[seller-sitemap] Missing Supabase env vars.");
    sendSitemap(response, "", 503);
    return;
  }

  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const sellerLastModified = new Map();
    let from = 0;

    for (;;) {
      const { data, error } = await supabase
        .from("products")
        .select("seller_id, updated_at")
        .eq("status", "active")
        .eq("is_approved", true)
        .not("seller_id", "is", null)
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;

      for (const product of data || []) {
        if (!product.seller_id) continue;
        const current = sellerLastModified.get(product.seller_id);
        if (!current || (product.updated_at && product.updated_at > current)) {
          sellerLastModified.set(product.seller_id, product.updated_at || null);
        }
      }

      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const sellerIds = [...sellerLastModified.keys()];
    if (sellerIds.length === 0) {
      sendSitemap(response, "");
      return;
    }

    const { data: profiles, error: profileError } = await supabase
      .from("seller_profiles_public")
      .select("user_id")
      .in("user_id", sellerIds);
    if (profileError) throw profileError;

    const urls = (profiles || [])
      .filter((profile) => Boolean(profile.user_id))
      .map((profile) => {
        const updatedAt = sellerLastModified.get(profile.user_id);
        const lastmod = updatedAt
          ? `<lastmod>${new Date(updatedAt).toISOString().slice(0, 10)}</lastmod>`
          : "";
        return `<url><loc>${SITE_URL}/seller/${escapeXml(profile.user_id)}</loc>${lastmod}<changefreq>daily</changefreq><priority>0.6</priority></url>`;
      })
      .join("");

    console.log(`[seller-sitemap] Served ${profiles?.length || 0} storefront URLs.`);
    sendSitemap(response, urls);
  } catch (error) {
    console.error("[seller-sitemap] Failed to build seller sitemap:", error);
    sendSitemap(response, "", 503);
  }
}
