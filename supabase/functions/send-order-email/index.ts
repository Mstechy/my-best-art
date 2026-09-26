/**
 * Sends order lifecycle emails to buyers and sellers via Postmark.
 *
 * Called from a database trigger (see the order_email_dispatch migration) so
 * that a confirmation still goes out when the buyer closes the tab immediately
 * after paying. Nothing here is reachable from the browser.
 *
 * Auth: the caller must present x-webhook-secret, compared against
 * ORDER_EMAIL_WEBHOOK_SECRET. verify_jwt is off in config.toml because the
 * trigger calls this with a shared secret rather than a user JWT, and the
 * database cannot mint a scoped user token.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buyerOrderConfirmation,
  buyerStatusUpdate,
  sellerDisputeOpened,
  sellerNewOrder,
  money,
  type OrderEmailData,
  type OrderEmailItem,
} from "../_shared/orderEmails.ts";

const POSTMARK_API = "https://api.postmarkapp.com/email";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://www.tradibu.com";
const ORDER_REF_LENGTH = 8;

type Event = "order_created" | "order_status_changed" | "dispute_opened";

interface RequestBody {
  event: Event;
  orderId?: string;
  disputeId?: string;
}

interface PostmarkResponse {
  ErrorCode?: number;
  Message?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Short, quotable reference. A raw uuid is unusable in a support thread. */
function orderRef(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, ORDER_REF_LENGTH).toUpperCase()}`;
}

async function sendEmail(opts: {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  tag: string;
  metadata?: Record<string, string>;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const token = Deno.env.get("POSTMARK_SERVER_TOKEN");
  const from = Deno.env.get("POSTMARK_FROM_EMAIL");

  if (!token || !from) {
    // Email is a nice-to-have for the order itself. If it is not configured the
    // order must still succeed, so report a skip rather than an error.
    return { ok: false, skipped: true, reason: "Postmark is not configured" };
  }

  const res = await fetch(POSTMARK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: opts.toName ? `${opts.toName} <${opts.to}>` : opts.to,
      Subject: opts.subject,
      HtmlBody: opts.html,
      TextBody: htmlToText(opts.html),
      MessageStream: "outbound",
      Tag: opts.tag,
      Metadata: opts.metadata,
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as PostmarkResponse;
  if (!res.ok) {
    return { ok: false, reason: payload.Message || `Postmark responded ${res.status}` };
  }
  return { ok: true };
}

/** A plain-text alternative. Without one the email is more likely to be spam. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<tr[\s\S]*?<\/tr>/gi, (row) => row.replace(/<[^>]+>/g, " ").trim() + "\n")
    .replace(/<h1[\s\S]*?<\/h1>/gi, (m) => m.replace(/<[^>]+>/g, "").trim() + "\n")
    .replace(/<p[\s\S]*?<\/p>/gi, (m) => m.replace(/<[^>]+>/g, " ").trim() + "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  try {
    const expected = Deno.env.get("ORDER_EMAIL_WEBHOOK_SECRET");
    if (!expected) {
      return json({ error: "Email dispatch is not configured" }, 503);
    }
    const provided = req.headers.get("x-webhook-secret") ?? "";
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { event, orderId, disputeId } = (await req.json()) as RequestBody;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    if (event === "dispute_opened") {
      return await handleDispute(admin, disputeId);
    }
    if (!orderId || !["order_created", "order_status_changed"].includes(event)) {
      return json({ error: "Invalid request" }, 400);
    }
    return await handleOrder(admin, event, orderId);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

/** Constant-time compare so the secret cannot be recovered by timing the reply. */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(b.length - 1 - i);
  }
  return diff === 0;
}

async function handleOrder(
  admin: ReturnType<typeof createClient>,
  event: "order_created" | "order_status_changed",
  orderId: string
) {
  const { data: order } = await admin
    .from("orders")
    .select("id, buyer_id, seller_id, status, total_amount, currency, tracking_number")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, 404);

  // The item title is snapshotted at purchase time, so a later product rename
  // cannot change what the buyer was actually charged for.
  const { data: items } = await admin
    .from("order_items")
    .select("quantity, total_price, product_id, products(title)")
    .eq("order_id", orderId);

  const currency = String(order.currency || "NGN");
  const emailItems: OrderEmailItem[] = (items ?? []).map((item) => ({
    title: (item as any)?.products?.title ?? "Product",
    quantity: Number(item.quantity),
    lineTotal: money(Number(item.total_price), currency),
  }));

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, email, full_name")
    .in("user_id", [order.buyer_id, order.seller_id]);

  const byUser = new Map<string, any>(
    (profiles ?? []).map((p: any) => [p.user_id, p])
  );
  const buyer = byUser.get(order.buyer_id);
  const seller = byUser.get(order.seller_id);

  const base: OrderEmailData = {
    orderRef: orderRef(order.id),
    items: emailItems,
    total: money(Number(order.total_amount), currency),
    status: String(order.status),
    trackingNumber: order.tracking_number ?? null,
    orderUrl: `${SITE_URL}/order-success/${order.id}`,
  };

  const results: Record<string, unknown> = {};

  // Buyer always gets something: confirmation on create, updates after that.
  if (buyer?.email) {
    results.buyer = await sendEmail({
      to: buyer.email,
      toName: buyer.full_name,
      subject:
        event === "order_created"
          ? `Your Tradibu order ${base.orderRef} is confirmed`
          : `Order ${base.orderRef} is now ${String(order.status).replace(/_/g, " ")}`,
      html:
        event === "order_created"
          ? buyerOrderConfirmation(base)
          : buyerStatusUpdate(base),
      tag: event === "order_created" ? "order-confirmation" : "order-status",
      metadata: { orderId: order.id, role: "buyer" },
    });
  }

  // The seller is only alerted on creation. Emailing them on every status
  // change would be noise: they are the one setting the status.
  if (event === "order_created" && seller?.email) {
    results.seller = await sendEmail({
      to: seller.email,
      toName: seller.full_name,
      subject: `New order ${base.orderRef} — ${base.total}`,
      html: sellerNewOrder(base),
      tag: "seller-new-order",
      metadata: { orderId: order.id, role: "seller" },
    });
  }

  return json({ ok: true, results });
}

async function handleDispute(admin: ReturnType<typeof createClient>, disputeId?: string) {
  if (!disputeId) return json({ error: "disputeId is required" }, 400);

  const { data: dispute } = await admin
    .from("disputes")
    .select("id, order_id, seller_id")
    .eq("id", disputeId)
    .maybeSingle();

  if (!dispute) return json({ error: "Dispute not found" }, 404);

  const { data: order } = await admin
    .from("orders")
    .select("id, seller_id, total_amount, currency")
    .eq("id", dispute.order_id)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, 404);

  const { data: seller } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("user_id", dispute.seller_id)
    .maybeSingle();

  if (!seller?.email) return json({ ok: true, skipped: "seller has no email on file" });

  const ref = orderRef(order.id);
  const result = await sendEmail({
    to: seller.email,
    toName: seller.full_name,
    subject: `Action needed: a dispute was opened on order ${ref}`,
    html: sellerDisputeOpened({
      orderRef: ref,
      items: [],
      total: money(Number(order.total_amount), String(order.currency || "NGN")),
      orderUrl: `${SITE_URL}/seller/orders`,
    }),
    tag: "dispute-opened",
    metadata: { disputeId: dispute.id, orderId: order.id },
  });

  return json({ ok: true, results: { seller: result } });
}
