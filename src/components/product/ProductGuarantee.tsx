import { useState } from "react";
import { Truck, RotateCcw, Shield, ChevronDown } from "lucide-react";
import { deliveryEstimateRange } from "@/lib/productContent";

interface Row {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  detail: string;
}

export default function ProductGuarantee() {
  const range = deliveryEstimateRange();
  const rows: Row[] = [
    {
      icon: Truck,
      title: "Free Shipping",
      hint: `Delivery ${range}`,
      detail:
        "Standard shipping is on us. Your order will be processed within 1-2 business days and delivered in the estimated window.",
    },
    {
      icon: RotateCcw,
      title: "Return & Refund Policy",
      hint: "7-day returns",
      detail:
        "If the item isn't as described, request a return within 7 days of delivery for a full refund via MarketHub Buyer Protection.",
    },
    {
      icon: Shield,
      title: "Secure Payment",
      hint: "Escrow protected",
      detail:
        "Your payment is held in escrow and only released to the seller after you confirm delivery — so your money is always safe.",
    },
  ];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/10">
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">MarketHub Guarantee</span>
      </div>
      <ul className="divide-y divide-primary/10">
        {rows.map((r, i) => {
          const Icon = r.icon;
          const open = openIdx === i;
          return (
            <li key={r.title}>
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors"
              >
                <Icon className="h-4 w-4 text-primary shrink-0" />
                <span className="flex-1 text-sm font-medium text-foreground">{r.title}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{r.hint}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="px-4 pb-3 -mt-1 text-xs text-muted-foreground leading-relaxed">
                  <div className="sm:hidden mb-1 text-foreground/80 font-medium">{r.hint}</div>
                  {r.detail}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
