import { Truck, RotateCcw, Shield, ChevronRight } from "lucide-react";
import { deliveryEstimateRange } from "@/lib/productContent";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full text-left rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm transition-all hover:bg-[#FAFAFA] dark:hover:bg-[#111111]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FAFAFA] dark:bg-[#111111] overflow-hidden shrink-0 border border-[#E8E8E8] dark:border-[#222222]">
                <Shield className="h-5 w-5 text-[#888880]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] truncate">MarketHub Guarantee</div>
                <div className="mt-1 flex items-center gap-2.5 text-[10px] font-semibold text-[#888880] flex-wrap">
                  <span className="flex items-center gap-1">
                    <Truck className="h-3 w-3" /> Free Shipping
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#D9D9D9] dark:bg-[#333333]"></span>
                    <RotateCcw className="h-3 w-3" /> 7-day Returns
                  </span>
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#C0C0B8] shrink-0" />
          </div>
        </button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md bg-white dark:bg-[#111111] border-[#E8E8E8] dark:border-[#222222] rounded-2xl sm:rounded-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-5 border-b border-[#E8E8E8] dark:border-[#222222]">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">
            <Shield className="h-4 w-4 text-[#F6C75D]" /> MarketHub Guarantee
          </DialogTitle>
        </DialogHeader>
        <div className="p-5">
          <ul className="space-y-6">
            {rows.map((r, i) => {
              const Icon = r.icon;
              return (
                <li key={r.title} className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#E8E8E8] dark:border-[#222222]">
                    <Icon className="h-4 w-4 text-[#111111] dark:text-[#FAF5F2]" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5">
                      <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">{r.title}</span>
                      <span className="text-[10px] font-semibold text-[#888880]">{r.hint}</span>
                    </div>
                    <p className="text-[11px] text-[#666666] dark:text-[#A0A0A0] leading-relaxed">
                      {r.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
