// Visual query extraction for marketplace search. Set OPENAI_API_KEY as a Supabase Edge Function secret.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type VisualResult = { search: string; category: string | null; confidence: "high" | "medium" | "low" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "Visual search is not configured yet." }, 503);
    const { imageDataUrl } = await req.json();
    if (typeof imageDataUrl !== "string" || !/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl) || imageDataUrl.length > 7_000_000) {
      return json({ error: "Use a JPG, PNG, or WebP image up to 5 MB." }, 400);
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: [
          { type: "text", text: "Inspect this shopping image. Return JSON only: {search:string, category:string|null, confidence:'high'|'medium'|'low'}. search must be 2-6 useful product/brand/type terms for an ecommerce catalogue, never a sentence. category is one of electronics, fashion, home, beauty, jewelry, toys, automotive, appliances, or null. Do not invent a brand or model if it is not clearly visible." },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
        ] }],
      }),
    });
    if (!response.ok) return json({ error: "Could not analyse that image." }, 502);
    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw || "{}") as Partial<VisualResult>;
    const search = typeof parsed.search === "string" ? parsed.search.trim().slice(0, 120) : "";
    if (!search) return json({ error: "We could not identify a product in that image." }, 422);
    return json({ search, category: typeof parsed.category === "string" ? parsed.category.toLowerCase() : null, confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low" });
  } catch {
    return json({ error: "Could not analyse that image." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
