import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LegalLayout from "@/components/LegalLayout";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type Kind = "shipping" | "returns";

interface Props {
  kind: Kind;
  fallbackTitle: string;
}

type PlatformPolicy = {
  shipping_terms: string | null;
  shipping_cost_amount: number | null;
  shipping_currency: string | null;
  free_shipping_threshold: number | null;
  ship_from_location: string | null;
  processing_days_min: number | null;
  processing_days_max: number | null;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  shipping_regions: string[] | null;
  return_conditions: string | null;
  return_window_days: number | null;
  return_shipping_payer: string | null;
  buyer_protection_refund_window_days: number | null;
  buyer_protection_claim_steps: string | null;
  updated_at: string | null;
};

/** Seeded placeholders like "[ADMIN: enter ...]" must never reach buyers. */
const clean = (value: string | null | undefined) => {
  const text = (value || "").trim();
  return /^\[ADMIN:/i.test(text) ? "" : text;
};

const range = (min: number | null, max: number | null, unit: string) => {
  if (min === null && max === null) return "";
  const span = min !== null && max !== null && max !== min ? `${min}–${max}` : `${min ?? max}`;
  return `${span} ${unit}`;
};

function shippingSections(policy: PlatformPolicy): string {
  const sections: string[] = [];
  const terms = clean(policy.shipping_terms);
  if (terms) sections.push(terms);
  const processing = range(policy.processing_days_min, policy.processing_days_max, "business days");
  if (processing) sections.push(`## Processing time\n\nOrders are prepared within ${processing}.`);
  const delivery = range(policy.delivery_days_min, policy.delivery_days_max, "days");
  if (delivery) sections.push(`## Delivery time\n\nEstimated delivery is ${delivery} after dispatch.`);
  const currency = clean(policy.shipping_currency) || "USD";
  if (policy.free_shipping_threshold !== null && policy.free_shipping_threshold > 0) {
    sections.push(`## Shipping costs\n\nFree shipping on orders over ${currency} ${policy.free_shipping_threshold}.`);
  } else if (policy.shipping_cost_amount === 0) {
    sections.push("## Shipping costs\n\nShipping is free on all orders.");
  } else if (policy.shipping_cost_amount !== null) {
    sections.push(`## Shipping costs\n\nFlat shipping fee of ${currency} ${policy.shipping_cost_amount}.`);
  }
  const from = clean(policy.ship_from_location);
  if (from) sections.push(`## Ships from\n\n${from}.`);
  const regions = (policy.shipping_regions || []).filter(Boolean);
  if (regions.length) sections.push(`## Shipping regions\n\n${regions.join(", ")}.`);
  return sections.join("\n\n");
}

function returnSections(policy: PlatformPolicy): string {
  const sections: string[] = [];
  const conditions = clean(policy.return_conditions);
  if (conditions) sections.push(conditions);
  if (policy.return_window_days !== null) {
    sections.push(`## Return window\n\nReturns are accepted within ${policy.return_window_days} days of delivery.`);
  }
  const payer = clean(policy.return_shipping_payer);
  if (payer) sections.push(`## Return shipping\n\nReturn shipping is paid by ${payer.replace(/_/g, " ")}.`);
  if (policy.buyer_protection_refund_window_days !== null) {
    sections.push(`## Buyer protection\n\nOpen a claim within ${policy.buyer_protection_refund_window_days} days of delivery.`);
  }
  const steps = clean(policy.buyer_protection_claim_steps);
  if (steps) sections.push(`## How to claim\n\n${steps}`);
  return sections.join("\n\n");
}

/**
 * Public policy page rendered from the single platform-wide source of truth
 * (public.platform_policies) that admins edit and product pages display.
 */
export default function PlatformPolicyPage({ kind, fallbackTitle }: Props) {
  const [body, setBody] = useState("");
  const [updated, setUpdated] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("platform_policies")
        .select("shipping_terms, shipping_cost_amount, shipping_currency, free_shipping_threshold, ship_from_location, processing_days_min, processing_days_max, delivery_days_min, delivery_days_max, shipping_regions, return_conditions, return_window_days, return_shipping_payer, buyer_protection_refund_window_days, buyer_protection_claim_steps, updated_at")
        .eq("id", true)
        .maybeSingle();
      const policy = (data as PlatformPolicy | null) || null;
      if (policy) {
        setBody(kind === "shipping" ? shippingSections(policy) : returnSections(policy));
        setUpdated(policy.updated_at ? `Last updated: ${new Date(policy.updated_at).toLocaleDateString()}` : "");
      } else {
        setBody("");
        setUpdated("");
      }
      setLoading(false);
    })();
  }, [kind]);

  return (
    <LegalLayout title={fallbackTitle} updated={updated}>
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : body.trim().length === 0 ? (
        <p className="text-muted-foreground italic">This policy has not been published yet.</p>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      )}
    </LegalLayout>
  );
}
