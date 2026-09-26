/**
 * HTML email templates for order lifecycle messages.
 *
 * Kept deliberately inline and table-based: email clients ignore modern CSS and
 * many strip <style> blocks entirely, so layout has to come from the markup.
 * Every template must render correctly in Gmail, which is the strictest client
 * and the one most likely to be the first to break on a new layout.
 */

export interface OrderEmailItem {
  title: string;
  quantity: number;
  lineTotal: string;
}

export interface OrderEmailData {
  orderRef: string;
  items: OrderEmailItem[];
  total: string;
  status?: string;
  trackingNumber?: string | null;
  orderUrl: string;
}

const BRAND = "#111111";
const ACCENT = "#F6C75D";
const MUTED = "#6E6C64";
const BORDER = "#E8E8E8";

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // An unknown currency code must not take down the whole email.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, preheader: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
<tr><td style="padding:24px 28px;border-bottom:1px solid ${BORDER};">
<span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">tradi<span style="color:${ACCENT};">bu</span></span>
</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:800;">${escapeHtml(title)}</h1>
<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:${MUTED};">${escapeHtml(preheader)}</p>
${body}
</td></tr>
<tr><td style="padding:20px 28px;background:#F8F8F6;border-top:1px solid ${BORDER};">
<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">Questions about this order? Reply to this email or contact <a href="mailto:support@tradibu.com" style="color:${BRAND};font-weight:600;">support@tradibu.com</a>.</p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:${MUTED};">&copy; Tradibu. All rights reserved.</p>
</td></tr>
</table>
</body>
</html>`;
}


function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
<tr><td style="border-radius:999px;background:${BRAND};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
</td></tr>
</table>`;
}

function itemsTable(items: OrderEmailItem[]): string {
  const rows = items
    .map(
      (item) => `<tr>
<td style="padding:12px 0;border-bottom:1px solid ${BORDER};font-size:14px;">${escapeHtml(item.title)}<span style="color:${MUTED};">&nbsp;&times;&nbsp;${item.quantity}</span></td>
<td align="right" style="padding:12px 0;border-bottom:1px solid ${BORDER};font-size:14px;font-weight:600;white-space:nowrap;">${escapeHtml(item.lineTotal)}</td>
</tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">${rows}</table>`;
}

function totalRow(total: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
<tr><td style="font-size:15px;font-weight:700;">Total</td><td align="right" style="font-size:17px;font-weight:800;">${escapeHtml(total)}</td></tr>
</table>`;
}

/** Sent to the buyer immediately after a successful purchase. */
export function buyerOrderConfirmation(d: OrderEmailData): string {
  return layout(
    "Thanks for your order",
    `Order ${d.orderRef} confirmed — total ${d.total}.`,
    `${itemsTable(d.items)}${totalRow(d.total)}${button(d.orderUrl, "View your order")}`
  );
}

/** Sent to the seller so a new sale is never missed. */
export function sellerNewOrder(d: OrderEmailData): string {
  return layout(
    "You have a new order",
    `Order ${d.orderRef} for ${d.total} is waiting for you.`,
    `<p style="margin:0 0 4px;font-size:14px;line-height:1.6;">A buyer just placed an order in your store. Fulfil it promptly to keep your standing.</p>${itemsTable(d.items)}${totalRow(d.total)}${button(d.orderUrl, "View order")}`
  );
}

/** Sent to the buyer when the order moves to a new status. */
export function buyerStatusUpdate(d: OrderEmailData): string {
  const status = (d.status || "updated").replace(/_/g, " ");
  const tracking = d.trackingNumber
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;">Tracking number: <strong>${escapeHtml(d.trackingNumber)}</strong></p>`
    : "";
  return layout(
    `Your order is ${status}`,
    `Order ${d.orderRef} is now ${status}.`,
    `<p style="margin:0 0 4px;font-size:14px;line-height:1.6;">This is a status update on your order.</p>${tracking}${button(d.orderUrl, "Track your order")}`
  );
}

/** Sent to the seller when a buyer opens a dispute on one of their orders. */
export function sellerDisputeOpened(d: OrderEmailData): string {
  return layout(
    "A dispute was opened",
    `A buyer opened a dispute on order ${d.orderRef}.`,
    `<p style="margin:0 0 4px;font-size:14px;line-height:1.6;">A buyer reported a problem with this order. Please open it in your dashboard and respond so it can be resolved.</p>${button(d.orderUrl, "Respond to dispute")}`
  );
}
