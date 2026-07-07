import { useEffect, useState } from "react";
import { Tag, Clock, Check, X, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Offer {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: "pending" | "accepted" | "countered" | "rejected" | "expired" | "cancelled";
  expires_at: string;
  parent_offer_id: string | null;
  created_at: string;
}

interface Props {
  currentUserId: string;
  partnerId: string;
  role: "buyer" | "seller";
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  accepted: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  countered: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  expired: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function timeLeftMs(iso: string): number {
  return new Date(iso).getTime() - Date.now();
}
function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s left`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s left`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)}d ${h % 24}h left`;
}

export default function NegotiationBar({ currentUserId, partnerId, role }: Props) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [productTitle, setProductTitle] = useState<string>("");
  const [productPrice, setProductPrice] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [counterMode, setCounterMode] = useState(false);
  const [counterAmount, setCounterAmount] = useState<string>("");
  const [, setTick] = useState(0);

  const fetchLatest = async () => {
    const { data } = await supabase
      .from("offers" as any)
      .select("*")
      .or(`and(buyer_id.eq.${currentUserId},seller_id.eq.${partnerId}),and(buyer_id.eq.${partnerId},seller_id.eq.${currentUserId})`)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (data as any)?.[0] as Offer | undefined;
    setOffer(row ?? null);
    if (row) {
      const { data: p } = await supabase.from("products").select("title, price").eq("id", row.product_id).maybeSingle();
      if (p) { setProductTitle((p as any).title); setProductPrice(Number((p as any).price)); }
      setCounterAmount(row.amount.toString());
    }
  };

  useEffect(() => { fetchLatest(); }, [currentUserId, partnerId]);

  // Realtime + countdown tick
  useEffect(() => {
    const ch = supabase.channel(`offers-${currentUserId}-${partnerId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, (payload: any) => {
        const row = payload.new ?? payload.old;
        if (!row) return;
        const involved = (row.buyer_id === currentUserId && row.seller_id === partnerId) ||
                         (row.buyer_id === partnerId && row.seller_id === currentUserId);
        if (!involved) return;
        if (payload.eventType === "UPDATE" && offer && row.id === offer.id) {
          if (row.status === "accepted") toast.success(`Offer accepted: $${Number(row.amount).toFixed(2)}`);
          if (row.status === "rejected") toast.error("Offer rejected");
          if (row.status === "expired") toast("Offer expired");
          if (row.status === "countered") toast("Seller countered the offer");
        }
        fetchLatest();
      })
      .subscribe();
    const tickId = setInterval(() => setTick(x => x + 1), 1000);
    return () => { supabase.removeChannel(ch); clearInterval(tickId); };
  }, [currentUserId, partnerId, offer?.id]);

  if (!offer) return null;

  const isPending = offer.status === "pending";
  const respond = async (action: "accept" | "reject" | "cancel" | "counter", amount?: number) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("respond-offer", {
      body: { offerId: offer.id, action, counterAmount: amount },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed");
      return;
    }
    setCounterMode(false);
    fetchLatest();
  };

  const msLeft = timeLeftMs(offer.expires_at);
  const expiringSoon = isPending && msLeft > 0 && msLeft < 60 * 60 * 1000; // < 1h
  const justExpired = isPending && msLeft <= 0;

  return (
    <div className="sticky top-0 z-10 space-y-2 mb-2">
      {expiringSoon && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Offer expiring soon — {formatTimeLeft(msLeft)}</span>
        </div>
      )}
      {justExpired && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>This offer has expired. Send a new one to continue.</span>
        </div>
      )}
      <div className={`rounded-lg border ${STATUS_COLOR[offer.status]} p-3 space-y-2`}>
      <div className="flex items-center gap-2 text-xs">
        <Tag className="h-3.5 w-3.5" />
        <span className="font-medium uppercase tracking-wide">{offer.status}</span>
        {isPending && (
          <span className={`ml-auto inline-flex items-center gap-1 ${expiringSoon ? "text-yellow-700 dark:text-yellow-400 font-semibold" : "text-muted-foreground"}`}>
            <Clock className="h-3 w-3" /> {formatTimeLeft(msLeft)}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{productTitle || "Product"}</p>
          <p className="text-sm font-bold text-foreground">${offer.amount.toFixed(2)}
            {productPrice > 0 && <span className="ml-2 text-[10px] text-muted-foreground line-through">${productPrice.toFixed(2)}</span>}
          </p>
        </div>
      </div>

      {isPending && role === "seller" && !counterMode && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy} onClick={() => respond("accept")} className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-600/90 text-white">
            <Check className="h-3.5 w-3.5" /> Accept
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setCounterMode(true)} className="h-8 gap-1">
            <RefreshCw className="h-3.5 w-3.5" /> Counter
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => respond("reject")} className="h-8 gap-1 text-destructive">
            <X className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      )}

      {isPending && role === "seller" && counterMode && (
        <div className="flex gap-2">
          <Input type="number" step="0.01" value={counterAmount} onChange={e => setCounterAmount(e.target.value)} className="h-8 text-xs" />
          <Button size="sm" disabled={busy} onClick={() => respond("counter", parseFloat(counterAmount))} className="h-8">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Send"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCounterMode(false)} className="h-8">Cancel</Button>
        </div>
      )}

      {isPending && role === "buyer" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => respond("cancel")} className="h-8 gap-1 text-destructive">
          <X className="h-3.5 w-3.5" /> Cancel offer
        </Button>
      )}
      </div>
    </div>
  );
}

