declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.tradibu.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const env = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required Edge Function secret: ${name}`);
  return value;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function encryptionKey() {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(env("GOOGLE_TOKEN_ENCRYPTION_KEY")),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return `${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

async function decrypt(value: string) {
  const [encodedIv, encodedCiphertext] = value.split(".");
  if (!encodedIv || !encodedCiphertext) throw new Error("Stored Google credentials are invalid");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(encodedIv) },
    await encryptionKey(),
    fromBase64(encodedCiphertext),
  );
  return new TextDecoder().decode(plaintext);
}

async function requireAdmin(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) throw new Response("Unauthorized", { status: 401 });

  const url = env("SUPABASE_URL");
  const anon = createClient(url, env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getUser();
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });

  const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const { data: roles, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  if (roleError) throw roleError;
  if (!(roles ?? []).some((role: { role: string }) => role.role === "admin")) {
    throw new Response("Admin only", { status: 403 });
  }
  return { admin, user: data.user };
}

async function fetchGoogleToken(code: string, redirectUri: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`Google token exchange failed: ${body.error_description || body.error || response.status}`);
  return body as { refresh_token?: string };
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(`Google access-token refresh failed: ${body.error_description || body.error || response.status}`);
  }
  return body.access_token as string;
}

async function querySearchConsole(accessToken: string, property: string, body: Record<string, unknown>) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, type: "web", rowLimit: 1000 }),
    },
  );
  const result = await response.json();
  if (!response.ok) {
    const message = result.error?.message || `Google Search Console returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return (result.rows ?? []) as Array<{
    keys?: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Missing Supabase Edge Function configuration" }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // OAuth redirects back to this endpoint, not the browser app.
  if (request.method === "GET") {
    const callback = new URL(request.url);
    const state = callback.searchParams.get("state") || "";
    const code = callback.searchParams.get("code");
    const error = callback.searchParams.get("error");
    const appUrl = Deno.env.get("GOOGLE_SEARCH_CONSOLE_APP_URL") || "https://www.tradibu.com";
    const redirect = new URL("/admin/google-merchant", appUrl);

    try {
      if (error) throw new Error(`Google authorization was not completed: ${error}`);
      if (!state || !code) throw new Error("Google authorization callback is incomplete");

      const stateHash = toBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state))));
      const { data: stateRow, error: stateError } = await admin
        .from("google_search_console_oauth_states")
        .delete()
        .eq("state_hash", stateHash)
        .gt("expires_at", new Date().toISOString())
        .select("admin_user_id")
        .maybeSingle();
      if (stateError) throw stateError;
      if (!stateRow) throw new Error("Google authorization expired or was already used; please connect again");

      const token = await fetchGoogleToken(code, env("GOOGLE_OAUTH_REDIRECT_URI"));
      if (!token.refresh_token) throw new Error("Google did not return offline access; reconnect and approve access");

      const { error: saveTokenError } = await admin.from("google_search_console_credentials").upsert({
        id: true,
        refresh_token_ciphertext: await encrypt(token.refresh_token),
        connected_at: new Date().toISOString(),
        connected_by: stateRow.admin_user_id,
      });
      if (saveTokenError) throw saveTokenError;
      redirect.searchParams.set("gsc", "connected");
    } catch (error) {
      redirect.searchParams.set("gsc", "error");
      redirect.searchParams.set("gsc_message", error instanceof Error ? error.message.slice(0, 180) : "Google authorization failed");
    }
    return Response.redirect(redirect, 302);
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { admin: db, user } = await requireAdmin(request);
    const body = await request.json().catch(() => ({})) as {
      action?: string;
      startDate?: string;
      endDate?: string;
    };

    if (body.action === "start") {
      const state = toBase64(crypto.getRandomValues(new Uint8Array(32)));
      const stateHash = toBase64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state))));
      const { error: cleanupError } = await db.from("google_search_console_oauth_states").delete().lt("expires_at", new Date().toISOString());
      if (cleanupError) throw cleanupError;
      const { error } = await db.from("google_search_console_oauth_states").insert({
        state_hash: stateHash,
        admin_user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (error) throw error;

      const redirectUri = env("GOOGLE_OAUTH_REDIRECT_URI");
      const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authorize.search = new URLSearchParams({
        client_id: env("GOOGLE_OAUTH_CLIENT_ID"),
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "https://www.googleapis.com/auth/webmasters.readonly",
        access_type: "offline",
        prompt: "consent",
        state,
      }).toString();
      return json({ authorizationUrl: authorize.toString() });
    }

    if (body.action === "disconnect") {
      const { error } = await db.from("google_search_console_credentials").delete().eq("id", true);
      if (error) throw error;
      return json({ connected: false });
    }

    if (body.action === "status") {
      const [{ data: credentials, error: credentialError }, { data: settings, error: settingsError }] = await Promise.all([
        db.from("google_search_console_credentials").select("connected_at").eq("id", true).maybeSingle(),
        db.from("google_search_console_settings").select("property_url").eq("id", true).maybeSingle(),
      ]);
      if (credentialError) throw credentialError;
      if (settingsError) throw settingsError;
      return json({ connected: Boolean(credentials), connectedAt: credentials?.connected_at ?? null, property: settings?.property_url ?? null });
    }

    if (body.action === "report") {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!body.startDate || !body.endDate || !datePattern.test(body.startDate) || !datePattern.test(body.endDate) || body.startDate > body.endDate) {
        return json({ error: "Choose a valid Search Console date range" }, 400);
      }
      const [{ data: credentials, error: credentialError }, { data: settings, error: settingsError }] = await Promise.all([
        db.from("google_search_console_credentials").select("refresh_token_ciphertext").eq("id", true).maybeSingle(),
        db.from("google_search_console_settings").select("property_url").eq("id", true).maybeSingle(),
      ]);
      if (credentialError) throw credentialError;
      if (settingsError) throw settingsError;
      if (!credentials) return json({ error: "Connect a Google Search Console account first" }, 409);
      if (!settings?.property_url) return json({ error: "Set the Search Console property URL first" }, 400);

      const accessToken = await refreshAccessToken(await decrypt(credentials.refresh_token_ciphertext));
      const range = { startDate: body.startDate, endDate: body.endDate };
      const [totals, dates, countries, pages] = await Promise.all([
        querySearchConsole(accessToken, settings.property_url, range),
        querySearchConsole(accessToken, settings.property_url, { ...range, dimensions: ["date"] }),
        querySearchConsole(accessToken, settings.property_url, { ...range, dimensions: ["country"] }),
        querySearchConsole(accessToken, settings.property_url, { ...range, dimensions: ["page"] }),
      ]);
      const total = totals[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
      return json({
        property: settings.property_url,
        totals: { clicks: total.clicks, impressions: total.impressions, ctr: total.ctr, position: total.position },
        dates: dates.map((row) => ({ date: row.keys?.[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })),
        countries: countries.map((row) => ({ country: row.keys?.[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })),
        pages: pages.map((row) => ({ page: row.keys?.[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position })),
        geographyLevel: "country",
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    if (error instanceof Response) return json({ error: await error.text() }, error.status);
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, 500);
  }
});
