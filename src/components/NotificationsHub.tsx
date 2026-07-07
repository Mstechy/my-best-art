import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Global, mounted-once listener for offer lifecycle events and new messages.
 * Surfaces in-app toasts with a clickable link to the negotiation chat.
 */
export default function NotificationsHub() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const seen = useRef<Set<string>>(new Set());
  const chatPath = role === "seller" || role === "admin" ? "/seller/chat" : "/buyer/chat";

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`offer-notifs-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "offers" }, (payload: any) => {
        const row = payload.new;
        const old = payload.old;
        if (!row) return;
        const involved = row.buyer_id === user.id || row.seller_id === user.id;
        if (!involved) return;
        if (row.status === old?.status) return;

        const key = `${row.id}:${row.status}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);

        const partnerId = row.buyer_id === user.id ? row.seller_id : row.buyer_id;
        const open = () => navigate(`${chatPath}?seller=${partnerId}&product=${row.product_id}`);
        const amount = `$${Number(row.amount).toFixed(2)}`;

        const opts = { action: { label: "Open chat", onClick: open } };
        switch (row.status) {
          case "accepted":
            toast.success(`Offer accepted: ${amount}`, opts); break;
          case "rejected":
            toast.error(`Offer rejected: ${amount}`, opts); break;
          case "countered":
            toast(`Counter offer received`, opts); break;
          case "expired":
            toast(`Offer expired (${amount})`, opts); break;
          case "cancelled":
            toast(`Offer cancelled`, opts); break;
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "offers" }, (payload: any) => {
        const row = payload.new;
        if (!row || row.seller_id !== user.id) return; // notify seller of new buyer offers
        const key = `new:${row.id}`;
        if (seen.current.has(key)) return;
        seen.current.add(key);
        toast(`New offer: $${Number(row.amount).toFixed(2)}`, {
          action: { label: "Review", onClick: () => navigate(`${chatPath}?seller=${row.buyer_id}&product=${row.product_id}`) },
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, role]);

  return null;
}
