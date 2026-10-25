// This file runs in Supabase Edge Functions (Deno), not the Vite/browser TypeScript environment.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const clients = () => {
  const url = env("SUPABASE_URL");
  return {
    anon: createClient(url, env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: Deno.env.get("Authorization") ?? "" } } }),
    admin: createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } }),
  };
};
const hmac = async (body: string, secret: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))).map((n) => n.toString(16).padStart(2, "0")).join("");
};
const equalSignature = (left: string, right: string) => {
  const a = left.trim().toLowerCase();
  const b = right.trim().toLowerCase();
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
};

type PayableOrder = { id: string; buyer_id: string; total_amount: number; currency: string; status: string; payment_status: string };

// createClient is imported from a URL, so every query result comes back as `any` and
// the callbacks consuming it would otherwise have implicitly-any parameters. Asserting
// the selected shape once keeps the webhook logic type checked.
type OrderRow = {
  id: string;
  buyer_id: string;
  total_amount: number;
  currency: string;
  status: string;
  payment_status: string;
  payment_reference: string | null;
  reservation_expires_at: string | null;
};
type IdRow = { id: string };
type VerifiedTransaction = {
  status?: boolean;
  data?: {
    status?: string;
    reference?: string;
    amount?: number | string;
    currency?: string;
    metadata?: { order_ids?: unknown; user_id?: unknown } | string | null;
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const rawBody = await req.text();
  let body: { action?: string; event?: string; orderIds?: string[]; email?: string; data?: { reference?: unknown } };
  try { body = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON" }, 400); }
  // Paystack sends event payloads without an `action` property. The signature
  // header is the authoritative webhook indicator; the action branch remains
  // accepted for backwards-compatible manual tests.
  const isWebhook = Boolean(req.headers.get("x-paystack-signature")) || body.action === "webhook" || typeof body.event === "string";
  if (isWebhook) {
    const signature = req.headers.get("x-paystack-signature");
    const secret = env("PAYSTACK_SECRET_KEY");
    if (!signature || !equalSignature(signature, await hmac(rawBody, secret))) return json({ error: "Invalid signature" }, 401);
    const event = JSON.parse(rawBody);
    if (event.event !== "charge.success") return json({ received: true });
    const reference = typeof event.data?.reference === "string" ? event.data.reference : "";
    if (!reference) return json({ error: "Payment reference missing" }, 400);
    const transaction = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
    const verified = await transaction.json() as VerifiedTransaction;
    const verifiedData = verified.data;
    if (!transaction.ok || verified.status !== true || verifiedData?.status !== "success" || verifiedData.reference !== reference) {
      return json({ error: "Payment not verified" }, 400);
    }
    const metadata = verifiedData.metadata && typeof verifiedData.metadata === "object" ? verifiedData.metadata : null;
    const ids = Array.isArray(metadata?.order_ids)
      ? [...new Set(metadata.order_ids.filter((id): id is string => typeof id === "string"))]
      : [];
    if (!ids.length) return json({ error: "Order metadata missing" }, 400);
    const { admin } = clients();
    const paidAt = new Date().toISOString();

    // A payment can arrive after the 30-minute reservation window closed and the
    // expiry sweep already cancelled the order and released its stock. Fulfilment is
    // therefore conditional, never blind:
    //   * orders are only fulfilled while they are still 'pending' and unpaid;
    //   * an order whose reservation window has already passed is treated as expired
    //     even if the sweep has not run yet.
    // The 'pending' predicate is evaluated by Postgres on the row being updated, so
    // this update and the expiry sweep cannot both succeed - whichever one moves the
    // order out of 'pending' first leaves the other with nothing to do. That is what
    // keeps released stock from being sold twice.
    const { data: rows, error: readError } = await admin
      .from("orders")
      .select("id, buyer_id, total_amount, currency, status, payment_status, payment_reference, reservation_expires_at")
      .in("id", ids);
    if (readError) return json({ error: "Could not read orders" }, 500);
    const orderRows = (rows ?? []) as OrderRow[];
    if (orderRows.length !== ids.length) return json({ error: "Payment orders not found" }, 400);

    const expectedAmount = Math.round(orderRows.reduce((sum, order) => sum + Number(order.total_amount), 0) * 100);
    const receivedAmount = Math.round(Number(verifiedData.amount));
    if (!Number.isFinite(receivedAmount) || receivedAmount !== expectedAmount || verifiedData.currency !== "NGN") {
      console.error("paystack: verified amount or currency does not match orders", JSON.stringify({ ids, reference, expectedAmount, receivedAmount, currency: verifiedData.currency }));
      return json({ error: "Payment amount or currency does not match the order" }, 400);
    }
    if (metadata?.user_id && typeof metadata.user_id === "string" && orderRows.some((order) => order.buyer_id !== metadata.user_id)) {
      return json({ error: "Payment buyer does not match the orders" }, 400);
    }
    if (orderRows.some((order) => order.payment_reference && order.payment_reference !== reference)) {
      return json({ error: "Payment reference does not match the orders" }, 409);
    }

    const windowOpen = (row: OrderRow) =>
      !row.reservation_expires_at || new Date(row.reservation_expires_at) > new Date(paidAt);
    const payableIds = orderRows
      .filter((row) => row.status === "pending" && row.payment_status !== "paid" && windowOpen(row))
      .map((row) => row.id);

    let fulfilledIds: string[] = [];
    if (payableIds.length) {
      const { data: fulfilled, error: fulfilError } = await admin
        .from("orders")
        .update({ payment_status: "paid", payment_reference: reference, paid_at: paidAt, status: "processing" })
        .in("id", payableIds)
        .eq("status", "pending")
        .neq("payment_status", "paid")
        .select("id");
      if (fulfilError) return json({ error: "Could not update orders" }, 500);
      fulfilledIds = ((fulfilled ?? []) as IdRow[]).map((row) => row.id);
    }

    // Anything paid but not fulfilled is money with no order behind it. Cancelled
    // orders are flagged for refund or manual reconciliation - never fulfilled, and
    // never silently downgraded from 'paid' (that case is a replayed webhook).
    const outstanding = ids.filter((id) => !fulfilledIds.includes(id));
    let refundRequired: string[] = [];
    if (outstanding.length) {
      const cancelled = orderRows
        .filter((row) => outstanding.includes(row.id) && row.status === "cancelled" && row.payment_status !== "paid")
        .map((row) => row.id);
      if (cancelled.length) {
        const { data: flagged, error: flagError } = await admin
          .from("orders")
          .update({ payment_status: "refund_required", payment_reference: reference })
          .in("id", cancelled)
          .neq("payment_status", "paid")
          .select("id, status, payment_status, buyer_id, total_amount, currency");
        if (flagError) {
          console.error("paystack: could not flag cancelled orders for refund", JSON.stringify(flagError));
          refundRequired = cancelled;
        } else {
          refundRequired = ((flagged ?? []) as IdRow[]).map((row) => row.id);
        }
        // Surfaced in the function log: these need a refund issued manually.
        console.error("paystack: payment received for cancelled orders - refund required", JSON.stringify({ orders: refundRequired, reference }));
      }
      const replays = outstanding.filter((id) => !refundRequired.includes(id));
      if (replays.length) {
        console.error("paystack: payment for orders already handled - ignored", JSON.stringify({ orders: replays, reference }));
      }
    }

    return json({ received: true, fulfilled: fulfilledIds.length, refund_required: refundRequired.length });
  }
  if (body.action !== "initialize") return json({ error: "Unsupported action" }, 400);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required" }, 401);
  const { anon, admin } = clients();
  const { data: auth } = await anon.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (!auth.user) return json({ error: "Authentication required" }, 401);
  const ids = Array.isArray(body.orderIds) ? body.orderIds.filter((id): id is string => typeof id === "string") : [];
  if (!ids.length || ids.length > 50) return json({ error: "orderIds must contain 1-50 orders" }, 400);
  const { data: rawOrders, error: orderError } = await admin.from("orders").select("id,buyer_id,total_amount,currency,status,payment_status").in("id", ids);
  const orders = (rawOrders ?? []) as PayableOrder[];
  if (orderError || orders.length !== ids.length) return json({ error: "Order not found" }, 404);
  if (orders.some((order) => order.buyer_id !== auth.user.id || order.status !== "pending" || order.payment_status !== "unpaid")) return json({ error: "Orders are not payable" }, 409);
  if (orders.some((order) => order.currency !== "NGN")) return json({ error: "Paystack currently supports NGN orders only" }, 400);
  const amount = Math.round(orders.reduce((sum, order) => sum + Number(order.total_amount), 0) * 100);
  const reference = `mh_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

  // Claim the unpaid orders before calling Paystack. A fast webhook can arrive
  // immediately after Paystack accepts a transaction; marking the orders first
  // closes the race where payment succeeds but the browser's follow-up update
  // loses to the webhook.
  const { data: claimedOrders, error: claimError } = await admin
    .from("orders")
    .update({ payment_status: "initialized", payment_reference: reference })
    .in("id", ids)
    .eq("status", "pending")
    .eq("payment_status", "unpaid")
    .select("id");
  if (claimError || ((claimedOrders ?? []) as IdRow[]).length !== ids.length) {
    return json({ error: "Orders are no longer payable" }, 409);
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("PAYSTACK_SECRET_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email || auth.user.email, amount, currency: "NGN", reference, callback_url: `https://www.tradibu.com/buyer/orders?payment_reference=${encodeURIComponent(reference)}`, metadata: { order_ids: ids, user_id: auth.user.id } }),
  });
  const initialized = await response.json();
  if (!response.ok || !initialized.status || typeof initialized.data?.authorization_url !== "string") {
    // Do not leave a failed gateway attempt blocking a retry. If a webhook won
    // the race and marked an order paid, this predicate leaves it untouched.
    await admin
      .from("orders")
      .update({ payment_status: "unpaid", payment_reference: null })
      .in("id", ids)
      .eq("status", "pending")
      .eq("payment_status", "initialized")
      .eq("payment_reference", reference);
    return json({ error: initialized.message || "Could not initialize payment" }, 502);
  }
  return json({ authorization_url: initialized.data.authorization_url, reference });
});
