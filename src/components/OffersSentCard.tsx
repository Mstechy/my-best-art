import { useState, useEffect } from "react";
import { Loader2, DollarSign, Clock, Trash2, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isPast } from "date-fns";

interface Offer {
  id: string;
  product_id: string;
  product_title?: string;
  product_image?: string;
  seller_id: string;
  seller_name?: string;
  amount: string;
  currency: string;
  note: string;
  attachment_url: string | null;
  status: "pending" | "accepted" | "countered" | "rejected" | "expired" | "cancelled";
  expires_at: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pending:   { bg: "bg-[#F6C75D]/15", text: "text-[#5C3A00] dark:text-[#F6C75D]", dot: "bg-[#F6C75D]", label: "⏳ Pending" },
  countered: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-400", label: "↔ Countered" },
  accepted:  { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-400", label: "✓ Accepted" },
  rejected:  { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-500 dark:text-red-400", dot: "bg-red-400", label: "✗ Rejected" },
  expired:   { bg: "bg-[#F2F3F5] dark:bg-[#1A1A1A]", text: "text-[#888880] dark:text-[#A0A0A0]", dot: "bg-[#888880]", label: "⏳ Expired" },
  cancelled: { bg: "bg-[#F2F3F5] dark:bg-[#1A1A1A]", text: "text-[#888880] dark:text-[#A0A0A0]", dot: "bg-[#888880]", label: "✕ Cancelled" },
};

export default function OffersSentCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadOffers();
  }, [user]);

  const loadOffers = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("offers")
      .select(`
        id,
      product_id,
      seller_id,
      buyer_id,
      amount,
        currency,
        note,
        attachment_url,
        status,
        expires_at,
        created_at
      `)
      .eq("buyer_id", user.id)
      .in("status", ["pending", "countered", "rejected", "accepted"])
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Failed to load offers", variant: "destructive" });
      setLoading(false);
      return;
    }

    type OfferRow = Omit<Offer, "product_title" | "product_image" | "seller_name"> & {
      product_title?: string | null;
      product_image?: string | null;
      seller_name?: string | null;
    };

    const formatted: Offer[] = (data || []).map((offer: OfferRow) => ({
      id: offer.id,
      product_id: offer.product_id,
      product_title: offer.product_title ?? undefined,
      product_image: offer.product_image ?? undefined,
      seller_id: offer.seller_id,
      seller_name: offer.seller_name ?? undefined,
      amount: offer.amount,
      currency: offer.currency,
      note: offer.note,
      attachment_url: offer.attachment_url,
      status: offer.status,
      expires_at: offer.expires_at,
      created_at: offer.created_at,
    }));

    setOffers(formatted);
    setLoading(false);
  };

  const handleCancel = async (offerId: string) => {
    setCancelling(offerId);
    const { data, error } = await supabase.functions.invoke("respond-offer", {
      body: { offerId, action: "cancel" },
    });
    setCancelling(null);

    if (error || data?.error) {
      toast({
        title: "Failed to cancel offer",
        description: data?.error || error?.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Offer cancelled" });
    loadOffers();
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222]">
        <div className="px-5 pt-5 pb-4 border-b border-[#F2F3F5] dark:border-[#222222]">
          <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">My Offers</p>
        </div>
        <div className="p-5 flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[#888880]" />
        </div>
      </div>
    );
  }

  // Empty state
  if (offers.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222]">
        <div className="px-5 pt-5 pb-4 border-b border-[#F2F3F5] dark:border-[#222222]">
          <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">My Offers</p>
          <p className="mt-0.5 text-[10px] text-[#888880] dark:text-[#A0A0A0]">Track offers you've made to sellers</p>
        </div>
        <div className="p-5 text-center py-10">
          <div className="h-10 w-10 rounded-2xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center mx-auto mb-2">
            <DollarSign className="h-4.5 w-4.5 text-[#888880] dark:text-[#A0A0A0]" />
          </div>
          <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">No offers yet</p>
          <p className="mt-1 text-[10px] text-[#888880] dark:text-[#A0A0A0]">You haven't made any offers yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222]">
      <div className="px-5 pt-5 pb-4 border-b border-[#F2F3F5] dark:border-[#222222]">
        <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">
          My Offers <span className="ml-1 text-[#888880] dark:text-[#A0A0A0] font-normal">({offers.length})</span>
        </p>
        <p className="mt-0.5 text-[10px] text-[#888880] dark:text-[#A0A0A0]">Track your active and past offers</p>
      </div>

      <div className="p-5 space-y-3">
        {offers.map((offer) => {
          const isExpired = isPast(new Date(offer.expires_at));
          const isPending = offer.status === "pending" && !isExpired;
          const cfg = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG.expired;

          return (
            <div
              key={offer.id}
              className="flex items-start gap-4 p-4 rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#111111] hover:border-[#E8E8E8] dark:hover:border-[#222222] transition-colors"
            >
              {/* Product image */}
              {offer.product_image ? (
                <img
                  src={offer.product_image}
                  alt={offer.product_title}
                  className="h-14 w-14 rounded-xl object-cover shrink-0 border border-[#E8E8E8] dark:border-[#222222]"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-[#F2F3F5] dark:bg-[#1A1A1A] flex items-center justify-center shrink-0 border border-[#E8E8E8] dark:border-[#222222]">
                  <DollarSign className="h-5 w-5 text-[#888880]" />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] line-clamp-1">
                      {offer.product_title || "Product"}
                    </p>
                    <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">to {offer.seller_name}</p>
                  </div>
                  {/* Status badge */}
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Amount + expiry */}
                <div className="mt-2 flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1 text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">
                    <DollarSign className="h-3 w-3 text-[#888880]" />
                    {parseFloat(offer.amount).toFixed(2)} {offer.currency}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#888880] dark:text-[#A0A0A0]">
                    <Clock className="h-3 w-3" />
                    {isExpired ? "Expired" : `Expires in ${formatDistanceToNow(new Date(offer.expires_at))}`}
                  </span>
                </div>

                {/* Note */}
                {offer.note && (
                  <p className="mt-1.5 text-[10px] text-[#888880] dark:text-[#A0A0A0] italic line-clamp-2">
                    "{offer.note}"
                  </p>
                )}

                {/* Attachment */}
                {offer.attachment_url && (
                  <a
                    href={offer.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#111111] dark:text-[#FAF5F2] hover:underline"
                  >
                    <MessageCircle className="h-3 w-3" /> View attachment
                  </a>
                )}
              </div>

              {/* Cancel action */}
              {isPending && (
                <button
                  onClick={() => handleCancel(offer.id)}
                  disabled={cancelling === offer.id}
                  className="flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors shrink-0 mt-0.5"
                >
                  {cancelling === offer.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Cancel
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
