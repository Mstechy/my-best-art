import { useState, useEffect, useRef } from "react";
import { Truck, Search, MapPin, ArrowRight, Copy, Loader2 } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import OrderTimeline from "@/components/OrderTimeline";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast as sonnerToast } from "sonner";

interface Order {
  id: string;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  estimated_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  status_history: unknown;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: "bg-[#F6C75D]/15", text: "text-[#5C3A00] dark:text-[#F6C75D]", label: "Pending" },
  processing: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", label: "Processing" },
  shipped:    { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", label: "Shipped" },
  delivered:  { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", label: "Delivered" },
};

export default function BuyerTracking() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const { data } = await supabase
        .from("orders").select("*").eq("buyer_id", user.id)
        .in("status", ["pending", "processing", "shipped", "delivered"])
        .order("updated_at", { ascending: false });
      if (data) setOrders(data as unknown as Order[]);
      setLoading(false);
    };
    fetchOrders();
    const channel = supabase.channel(`buyer-tracking-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` },
        (payload) => {
          const newOrder = payload.new as Order;
          const old = ordersRef.current.find(o => o.id === newOrder.id);
          if (old && old.status !== newOrder.status) {
            sonnerToast(`Order #${newOrder.id.slice(0, 8)} is now ${newOrder.status}`, {
              description: newOrder.tracking_number ? `Tracking: ${newOrder.tracking_number}` : undefined,
            });
          }
          fetchOrders();
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = orders.filter(o =>
    !searchQuery || o.id.includes(searchQuery) || o.tracking_number?.includes(searchQuery)
  );

  const getStatusHistory = (history: unknown): { status: string; changed_at: string }[] => {
    if (!Array.isArray(history)) return [];
    return history.filter((entry): entry is { status: string; changed_at: string } =>
      typeof entry === "object" && entry !== null && "status" in entry && "changed_at" in entry
    );
  };

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Header */}
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Delivery Tracking</h1>
          <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">Track your deliveries in real-time</p>
        </div>
      </AnimatedSection>

      {/* Search / Track input */}
      <AnimatedSection variant="fade-up" delay={50}>
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
          <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Track a Package</p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#888880]" />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Enter tracking number or order ID..."
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] text-sm placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors"
              />
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors shrink-0">
              <MapPin className="h-3.5 w-3.5" /> Track
            </button>
          </div>
        </div>
      </AnimatedSection>

      {/* Order list */}
      <AnimatedSection variant="fade-up" delay={100}>
        <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Purchase Tracking</p>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#888880]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] py-16">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center">
                <Truck className="h-6 w-6 text-[#888880] dark:text-[#A0A0A0]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">No tracked purchases</p>
                <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">When you place an order, live status updates will appear here.</p>
              </div>
              <Link to="/marketplace">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors">
                  Browse Marketplace <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const s = STATUS_STYLE[order.status] ?? { bg: "bg-[#F2F3F5]", text: "text-[#888880]", label: order.status };
              const history = getStatusHistory(order.status_history);
              return (
                <div key={order.id} className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 space-y-4">
                  {/* Order info */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] mt-0.5">Placed {new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${s.bg} ${s.text}`}>
                      {s.label}
                    </span>
                  </div>

                  {/* Carrier / tracking */}
                  {(order.carrier || order.tracking_number || order.estimated_delivery) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {order.carrier && (
                        <span className="px-2.5 py-1 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[9px] font-bold text-[#888880] dark:text-[#A0A0A0] uppercase tracking-wider">
                          {order.carrier}
                        </span>
                      )}
                      {order.tracking_number && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(order.tracking_number!); sonnerToast("Tracking number copied"); }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[9px] font-mono text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors"
                        >
                          <Copy className="h-2.5 w-2.5" /> {order.tracking_number}
                        </button>
                      )}
                      {order.estimated_delivery && (
                        <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">
                          ETA {new Date(order.estimated_delivery).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  <OrderTimeline status={order.status} history={history} />
                </div>
              );
            })}
          </div>
        )}
      </AnimatedSection>
    </div>
  );
}
