import { createClient } from "@supabase/supabase-js";

const SITE_URL = "https://www.tradibu.com";
const PAGE_SIZE = 1000;

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

/** Vercel function: serves every approved public product to search crawlers. */
export default async function handler(_request, response) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON;
  if (!url || !key) {
    response.status(500).type("text/plain").send("Sitemap is not configured.");
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const products = [];
  let from = 0;

  try {
    while (true) {
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

    const urls = products.map((product) => {
      const lastmod = product.updated_at ? `<lastmod>${new Date(product.updated_at).toISOString().slice(0, 10)}</lastmod>` : "";
      return `<url><loc>${SITE_URL}/product/${escapeXml(product.id)}</loc>${lastmod}<changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    }).join("");
    response
      .status(200)
      .setHeader("Content-Type", "application/xml; charset=utf-8")
      .setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400")
      .send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  } catch {
    response.status(500).type("text/plain").send("Unable to generate product sitemap.");
  }
}
