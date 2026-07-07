import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Body {
  offerId?: string;
  action?: "accept" | "counter" | "reject" | "cancel";
  counterAmount?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const { offerId, action, counterAmount } = (await req.json()) as Body;
    if (!offerId || !UUID_RE.test(offerId)) return json({ error: "Invalid offerId" }, 400);
    if (!action || !["accept", "counter", "reject", "cancel"].includes(action)) return json({ error: "Invalid action" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: offer } = await admin.from("offers").select("*").eq("id", offerId).maybeSingle();
    if (!offer) return json({ error: "Offer not found" }, 404);
    if (offer.status !== "pending") return json({ error: `Offer already ${offer.status}` }, 400);

    if (action === "cancel") {
      if (userId !== offer.buyer_id) return json({ error: "Only buyer can cancel" }, 403);
      const { error } = await admin.from("offers").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("id", offerId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (userId !== offer.seller_id) return json({ error: "Only seller can respond" }, 403);

    if (action === "accept" || action === "reject") {
      const { error } = await admin.from("offers").update({
        status: action === "accept" ? "accepted" : "rejected",
        responded_at: new Date().toISOString(),
      }).eq("id", offerId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // counter
    if (typeof counterAmount !== "number" || !Number.isFinite(counterAmount) || counterAmount <= 0 || counterAmount > 9_999_999) {
      return json({ error: "Invalid counter amount" }, 400);
    }
    const { data: product } = await admin.from("products").select("price, currency").eq("id", offer.product_id).maybeSingle();
    if (!product) return json({ error: "Product not found" }, 404);
    if (counterAmount > Number(product.price) * 2) return json({ error: "Counter too high" }, 400);

    const { error: updErr } = await admin.from("offers").update({
      status: "countered",
      responded_at: new Date().toISOString(),
    }).eq("id", offerId);
    if (updErr) return json({ error: updErr.message }, 400);

    const { data: newOffer, error: insErr } = await admin.from("offers").insert({
      product_id: offer.product_id,
      buyer_id: offer.buyer_id,
      seller_id: offer.seller_id,
      amount: counterAmount,
      currency: product.currency || "USD",
      note: `Counter offer: $${counterAmount.toFixed(2)}`,
      parent_offer_id: offer.id,
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    }).select("id, expires_at").single();
    if (insErr) return json({ error: insErr.message }, 400);

    return json({ ok: true, counterOfferId: newOffer.id, expiresAt: newOffer.expires_at });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
