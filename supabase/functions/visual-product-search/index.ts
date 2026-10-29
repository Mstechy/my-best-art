// Visual query extraction for marketplace search. Set OPENAI_API_KEY as a Supabase Edge Function secret.

// This file runs in Supabase Edge Functions (Deno), not the Vite/browser TypeScript
// environment. The declaration below lets the editor type check the file without
// pulling in Deno's own type packages; it is erased at runtime.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.tradibu.com",
  "https://tradibu.com",
  "http://localhost:4173",
  "http://localhost:8080",
];
const allowedOrigins = new Set(
  (Deno.env.get("VISUAL_SEARCH_ALLOWED_ORIGINS") || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 60_000;
const OPENAI_TIMEOUT_MS = 15_000;
const MAX_IMAGE_DATA_URL_LENGTH = 7_000_000;
const MAX_CONTENT_LENGTH = MAX_IMAGE_DATA_URL_LENGTH + 128;
const MAX_ACTIVE_REQUESTS = 2;
let activeRequests = 0;
const VALID_CATEGORIES = new Set(["electronics", "fashion", "home", "beauty", "jewelry", "toys", "automotive", "appliances"]);

function corsHeaders(req: Request, extra: Record<string, string> = {}) {
  const origin = req.headers.get("origin");
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : "https://www.tradibu.com";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    ...extra,
  };
}

function requestKey(req: Request) {
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

function isRateLimited(req: Request) {
  const now = Date.now();
  // Discard expired buckets so spoofed or rotating request identifiers cannot
  // grow this process-local map without bound between platform cold starts.
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(key);
  }
  const key = requestKey(req);
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

type VisualResult = { search: string; category: string | null; confidence: "high" | "medium" | "low" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json({ error: "Only POST is supported." }, 405, req);
  if (isRateLimited(req)) return json({ error: "Too many visual searches. Please try again in a minute." }, 429, req, { "Retry-After": "60" });
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_CONTENT_LENGTH) return json({ error: "Image payload is too large." }, 413, req);
  if (activeRequests >= MAX_ACTIVE_REQUESTS) return json({ error: "Visual search is busy. Please try again shortly." }, 429, req, { "Retry-After": "10" });
  activeRequests += 1;
  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "Visual search is not configured yet." }, 503, req);
    const { imageDataUrl } = await req.json();
    if (typeof imageDataUrl !== "string" || !/^data:image\/(jpeg|png|webp);base64,/i.test(imageDataUrl) || imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return json({ error: "Use a JPG, PNG, or WebP image up to 5 MB." }, 400, req);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: [
          { type: "text", text: "Inspect this shopping image. Return JSON only: {search:string, category:string|null, confidence:'high'|'medium'|'low'}. search must be 2-6 useful product/brand/type terms for an ecommerce catalogue, never a sentence. category is one of electronics, fashion, home, beauty, jewelry, toys, automotive, appliances, or null. Do not invent a brand or model if it is not clearly visible." },
          { type: "image_url", image_url: { url: imageDataUrl, detail: "low" } },
        ] }],
      }),
    });
    clearTimeout(timeout);
    if (!response.ok) return json({ error: "Could not analyse that image." }, 502, req);
    const payload = await response.json();
    const raw = payload?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(raw || "{}") as Partial<VisualResult>;
    const search = typeof parsed.search === "string" ? parsed.search.trim().slice(0, 120) : "";
    if (!search) return json({ error: "We could not identify a product in that image." }, 422, req);
    const category = typeof parsed.category === "string" && VALID_CATEGORIES.has(parsed.category.toLowerCase())
      ? parsed.category.toLowerCase()
      : null;
    return json({ search, category, confidence: parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low" }, 200, req);
  } catch {
    return json({ error: "Could not analyse that image." }, 500, req);
  } finally {
    activeRequests -= 1;
  }
});

function json(body: unknown, status = 200, req: Request, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req, { "Content-Type": "application/json", ...extra }) });
}
