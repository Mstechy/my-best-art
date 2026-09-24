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
  return { title: "Shipping", summary: parts.join(" · ") || detail, detail: detail || parts.join(". "), source, updatedAt: text(row.updated_at) || null };
}

function returns(row: PolicyRow, source: Source): ResolvedPolicy | null {
  const accepted = row.return_accepted;
  const conditions = text(row.return_conditions) || text(row.return_policy);
  const window = number(row.return_window_days);
  const payer = text(row.return_shipping_payer);
  const summary = [accepted === true ? "Returns accepted" : accepted === false ? "Returns not accepted" : "", window !== null ? `${window}-day window` : "", payer ? `Return shipping: ${payer.replace(/_/g, " ")}` : ""].filter(Boolean).join(" · ");
  if (!conditions && !summary) return null;
  return { title: "Returns & refunds", summary: summary || conditions, detail: conditions || summary, source, updatedAt: text(row.updated_at) || null };
}

function warranty(row: PolicyRow, source: Source): ResolvedPolicy | null {
  const duration = text(row.warranty_duration) || text(row.warranty) || text(row.warranty_period);
  const terms = text(row.warranty_terms);
  if (!duration && !terms) return null;
  return { title: "Warranty", summary: duration || terms, detail: terms || duration, source, updatedAt: text(row.updated_at) || null };
}

function protection(row: PolicyRow): ResolvedPolicy | null {
  const steps = text(row.buyer_protection_claim_steps);
  const window = number(row.buyer_protection_refund_window_days);
  if (!steps && window === null) return null;
  return { title: "Buyer protection", summary: window !== null ? `${window}-day claim window` : steps, detail: steps || `${window}-day claim window`, source: "platform", updatedAt: text(row.updated_at) || null };
}

function first<T>(...values: (T | null)[]) { return values.find((value): value is T => value !== null) ?? null; }

export function useResolvedPolicies(sellerId: string | undefined, product: { shipping_info: string | null; warranty: string | null; warranty_period: string | null } | null) {
  const query = useSupabaseQuery(
    [...supabaseKeys.table("platform_policies"), sellerId ?? ""],
    async () => {
      const [storeResult, platformResult] = await Promise.all([
        sellerId ? supabase.from("seller_stores").select("shipping_policy, return_policy, updated_at, shipping_cost_amount, shipping_currency, free_shipping_threshold, ship_from_location, processing_days_min, processing_days_max, delivery_days_min, delivery_days_max, return_accepted, return_window_days, return_conditions, return_shipping_payer, warranty_duration, warranty_terms").eq("seller_id", sellerId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        (supabase as any).from("platform_policies").select("*").eq("id", true).maybeSingle(),
      ]);
      if (storeResult.error) throw storeResult.error;
      if (platformResult.error) throw platformResult.error;
      return { store: storeResult.data as PolicyRow | null, platform: platformResult.data as PolicyRow | null };
    },
    { enabled: Boolean(sellerId), staleTime: 5 * 60 * 1000 },
  );

  const policies = useMemo(() => {
    const store = query.data?.store ?? null;
    const platform = query.data?.platform ?? null;
    const productRow: PolicyRow = { shipping_policy: product?.shipping_info, warranty: product?.warranty, warranty_period: product?.warranty_period };
    return {
      shipping: first(shipping(productRow, "product"), store ? shipping(store, "seller") : null, platform ? shipping(platform, "platform") : null),
      returns: first(store ? returns(store, "seller") : null, platform ? returns(platform, "platform") : null),
      warranty: first(warranty(productRow, "product"), store ? warranty(store, "seller") : null, platform ? warranty(platform, "platform") : null),
      protection: platform ? protection(platform) : null,
    };
  }, [product?.shipping_info, product?.warranty, product?.warranty_period, query.data]);

  return { ...query, policies, sourceLabel };
}
