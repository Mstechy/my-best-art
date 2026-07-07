import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OfferBody {
  productId?: string;
  offerPrice?: number;
  note?: string;
  attachmentPath?: string;
  expiresInHours?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_HOURS = new Set([1, 6, 24, 72]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json()) as OfferBody;
    const { productId, offerPrice, note = "", attachmentPath, expiresInHours = 24 } = body ?? {};

    if (!productId || !UUID_RE.test(productId)) return json({ error: "Invalid productId" }, 400);
    if (typeof offerPrice !== "number" || !Number.isFinite(offerPrice) || offerPrice <= 0 || offerPrice > 9_999_999) {
      return json({ error: "Invalid offer price" }, 400);
    }
    if (typeof note !== "string" || note.length > 500) return json({ error: "Note too long" }, 400);
    const hours = ALLOWED_HOURS.has(expiresInHours) ? expiresInHours : 24;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: product, error: prodErr } = await admin
      .from("products")
      .select("id, title, price, seller_id, status, currency")
      .eq("id", productId)
      .maybeSingle();
    if (prodErr || !product) return json({ error: "Product not found" }, 404);
    if (product.status !== "active") return json({ error: "Product not available" }, 400);
    if (product.seller_id === userId) return json({ error: "Cannot offer on your own product" }, 400);
    if (offerPrice > Number(product.price) * 2) return json({ error: "Offer too high" }, 400);
    if (offerPrice < Number(product.price) * 0.3) return json({ error: "Offer too low" }, 400);

    let attachmentUrl: string | null = null;
    if (attachmentPath) {
      const expectedPrefix = `offers/${userId}/`;
      if (!attachmentPath.startsWith(expectedPrefix) || attachmentPath.length > 500) {
        return json({ error: "Invalid attachment path" }, 400);
      }
      const { data: pub } = admin.storage.from("product-images").getPublicUrl(attachmentPath);
      attachmentUrl = pub.publicUrl;
    }

    const cleanNote = (note.trim() || `I'd like to offer $${offerPrice.toFixed(2)} for "${product.title}".`).slice(0, 500);
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000).toISOString();

    const { data: offer, error: offerErr } = await admin.from("offers").insert({
      product_id: product.id,
      buyer_id: userId,
      seller_id: product.seller_id,
      amount: offerPrice,
      currency: product.currency || "USD",
      note: cleanNote,
      attachment_url: attachmentUrl,
      expires_at: expiresAt,
    }).select("id, expires_at").single();
    if (offerErr || !offer) return json({ error: offerErr?.message || "Failed to create offer" }, 400);

    return json({ ok: true, sellerId: product.seller_id, offerId: offer.id, expiresAt: offer.expires_at });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
