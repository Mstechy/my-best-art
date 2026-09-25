import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery, supabaseKeys } from "./useSupabaseQuery";

type Source = "product" | "seller" | "platform";
type PolicyRow = Record<string, string | number | boolean | string[] | null | undefined>;

export interface ResolvedPolicy {
  title: string;
  summary: string;
  detail: string;
  source: Source;
  updatedAt: string | null;
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

// Public policy pages are written in markdown; product-page sheets show plain text.
function markdownToText(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s*(?:\d+\.\s*)?/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "• ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const firstLine = (value: string) => value.split("\n").map(line => line.trim()).find(Boolean) || value;

function sourceLabel(source: Source) {
  return source === "seller" ? "Set by seller" : source === "platform" ? "Platform policy" : "Set for this product";
}

function shipping(row: PolicyRow, source: Source): ResolvedPolicy | null {
  const detail = text(row.shipping_terms) || text(row.shipping_policy);
  const from = text(row.ship_from_location);
  const deliveryMin = number(row.delivery_days_min);
  const deliveryMax = number(row.delivery_days_max);
  const cost = number(row.shipping_cost_amount);
  const currency = text(row.shipping_currency);
  const parts = [
    cost === 0 ? "Free shipping" : cost !== null && currency ? `${currency} ${cost}` : "",
    from ? `Ships from ${from}` : "",
    deliveryMin !== null ? `Delivery ${deliveryMin}${deliveryMax !== null ? `–${deliveryMax}` : ""} days` : "",
  ].filter(Boolean);
  if (!detail && parts.length === 0) return null;
  return { title: "Shipping", summary: parts.join(" · ") || firstLine(detail), detail: detail || parts.join(". "), source, updatedAt: text(row.updated_at) || null };
}

function returns(row: PolicyRow, source: Source): ResolvedPolicy | null {
  const accepted = row.return_accepted;
  const conditions = text(row.return_conditions) || text(row.return_policy);
  const window = number(row.return_window_days);
  const payer = text(row.return_shipping_payer);
  const summary = [accepted === true ? "Returns accepted" : accepted === false ? "Returns not accepted" : "", window !== null ? `${window}-day window` : "", payer ? `Return shipping: ${payer.replace(/_/g, " ")}` : ""].filter(Boolean).join(" · ");
  if (!conditions && !summary) return null;
  return { title: "Returns & refunds", summary: summary || firstLine(conditions), detail: conditions || summary, source, updatedAt: text(row.updated_at) || null };
}

function warranty(row: PolicyRow, source: Source): ResolvedPolicy | null {
  const duration = text(row.warranty_duration) || text(row.warranty) || text(row.warranty_period);
  const terms = text(row.warranty_terms);
  if (!duration && !terms) return null;
  return { title: "Warranty", summary: duration || terms, detail: terms || duration, source, updatedAt: text(row.updated_at) || null };
}

function first<T>(...values: (T | null)[]) { return values.find((value): value is T => value !== null) ?? null; }

export function useResolvedPolicies(sellerId: string | undefined, product: { shipping_info: string | null; warranty: string | null; warranty_period: string | null } | null) {
  const query = useSupabaseQuery(
    [...supabaseKeys.table("site_pages"), sellerId ?? ""],
    async () => {
      const [storeResult, pagesResult] = await Promise.all([
        sellerId ? supabase.from("seller_stores").select("shipping_policy, return_policy, updated_at, shipping_cost_amount, shipping_currency, free_shipping_threshold, ship_from_location, processing_days_min, processing_days_max, delivery_days_min, delivery_days_max, return_accepted, return_window_days, return_conditions, return_shipping_payer, warranty_duration, warranty_terms").eq("seller_id", sellerId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        (supabase as any).from("site_pages").select("slug, body_markdown, updated_at").in("slug", ["shipping", "refund"]),
      ]);
      if (storeResult.error) throw storeResult.error;
      if (pagesResult.error) throw pagesResult.error;
      const pages = (pagesResult.data as { slug: string; body_markdown: string | null; updated_at: string | null }[] | null) ?? [];
      const page = (slug: string) => pages.find(item => item.slug === slug) ?? null;
      const shippingPage = page("shipping");
      const refundPage = page("refund");
      const platform: PolicyRow | null = shippingPage || refundPage ? {
        shipping_terms: markdownToText(shippingPage?.body_markdown),
        return_conditions: markdownToText(refundPage?.body_markdown),
        updated_at: shippingPage?.updated_at ?? refundPage?.updated_at ?? null,
      } : null;
      return { store: storeResult.data as PolicyRow | null, platform };
    },
    { enabled: Boolean(sellerId), staleTime: 5 * 60 * 1000 },
  );

  const policies = useMemo(() => {
    const store = query.data?.store ?? null;
    const platform = query.data?.platform ?? null;
    const productRow: PolicyRow = { warranty: product?.warranty, warranty_period: product?.warranty_period };
    return {
      // The published Shipping and Refund pages are authoritative for marketplace-wide terms.
      // Seller store values remain a compatibility fallback only.
      shipping: first(shipping(productRow, "product"), platform ? shipping(platform, "platform") : null, store ? shipping(store, "seller") : null),
      returns: first(platform ? returns(platform, "platform") : null, store ? returns(store, "seller") : null),
      warranty: first(warranty(productRow, "product"), store ? warranty(store, "seller") : null),
      // Buyer-protection steps have no platform-level editor any more; the Refund page already covers them.
      protection: null,
    };
  }, [product?.warranty, product?.warranty_period, query.data]);

  return { ...query, policies, sourceLabel };
}
