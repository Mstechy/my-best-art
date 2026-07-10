import { useState, useEffect, useRef } from "react";
import { Truck, Search, MapPin, ArrowRight, Copy, Loader2, Package, Hash, CalendarCheck2, ExternalLink } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import OrderTimeline from "@/components/OrderTimeline";
import { PackageTrackerCard } from "@/components/ui/tracker-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  product_image?: string | null;
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
  const [modalOrder, setModalOrder] = useState<Order | null>(null);

  const ordersRef = useRef<Order[]>([]);
  ordersRef.current = orders;

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      const { data: ordersData } = await supabase
        .from("orders").select("*").eq("buyer_id", user.id)
        .in("status", ["pending", "processing", "shipped", "delivered"])
        .order("updated_at", { ascending: false });
      
      if (!ordersData) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch items for these orders to extract product images
      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("order_id, product_id")
        .in("order_id", orderIds);

      const productIds = [...new Set((itemsData || []).filter(i => i.product_id).map(i => i.product_id!))];
      const productImageMap: Record<string, string | null> = {};

      if (productIds.length > 0) {
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, image_url, is_primary")
          .in("product_id", productIds);

        productIds.forEach(pid => {
          const img = images?.find(i => i.product_id === pid && i.is_primary) || images?.find(i => i.product_id === pid);
          productImageMap[pid] = img?.image_url || null;
        });
      }

      // Map the first found product image to each order
      const ordersWithImages = (ordersData as unknown as Order[]).map(order => {
        const items = (itemsData || []).filter(item => item.order_id === order.id);
        const firstProductWithImage = items.find(item => item.product_id && productImageMap[item.product_id]);
        const imgUrl = firstProductWithImage && firstProductWithImage.product_id 
          ? productImageMap[firstProductWithImage.product_id] 
          : null;

        return {
          ...order,
          product_image: imgUrl,
        };
      });

      setOrders(ordersWithImages);
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
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {filtered.map(order => (
              <PackageTrackerCard
                  key={order.id}
                  status={order.status}
                  packageNumber={order.tracking_number || order.id.slice(0, 16).toUpperCase()}
                  destination={order.carrier || "In Transit"}
                  date={`Order #${order.id.slice(0, 8).toUpperCase()} · ${new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  qrCodeValue={
                    order.tracking_number
                      ? `https://track.my-best-art.com/${order.tracking_number}`
                      : `https://my-best-art.com/buyer/orders/${order.id}`
                  }
                  packageImage={
                    order.product_image ? (
                      <img
                        src={order.product_image}
                        alt="Product Image"
                        className="w-full h-full object-cover"
                      />
                    ) : undefined
                  }
                  onTrackClick={() => setModalOrder(order)}
                  className="w-full max-w-none"
                />
            ))}
          </div>
        )}
      </AnimatedSection>

      {/* Full Tracking Modal */}
      <Dialog open={!!modalOrder} onOpenChange={open => { if (!open) setModalOrder(null); }}>
        {modalOrder && (
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Package className="h-4 w-4 text-[#3B82F6]" />
                Full Shipment Tracking
              </DialogTitle>
              <DialogDescription className="text-[11px] text-[#888880]">
                Order #{modalOrder.id.slice(0, 8).toUpperCase()}
              </DialogDescription>
            </DialogHeader>

            {/* Carrier & tracking number row */}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div className="rounded-xl bg-[#F8F8F8] dark:bg-[#111111] border border-[#F0F0F0] dark:border-[#222222] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Truck className="h-3.5 w-3.5 text-[#3B82F6]" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#888880]">Carrier</p>
                </div>
                <p className="text-sm font-semibold text-[#111111] dark:text-[#FAF5F2] capitalize">
                  {modalOrder.carrier || "—"}
                </p>
              </div>
              <div className="rounded-xl bg-[#F8F8F8] dark:bg-[#111111] border border-[#F0F0F0] dark:border-[#222222] p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Hash className="h-3.5 w-3.5 text-[#3B82F6]" />
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#888880]">Tracking #</p>
                </div>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-mono font-semibold text-[#111111] dark:text-[#FAF5F2] truncate">
                    {modalOrder.tracking_number || "Not assigned"}
                  </p>
                  {modalOrder.tracking_number && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(modalOrder.tracking_number!); sonnerToast("Copied!"); }}
                      className="shrink-0 text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Estimated delivery */}
            {modalOrder.estimated_delivery && (
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 p-3 flex items-center gap-3">
                <CalendarCheck2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Estimated Delivery</p>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {new Date(modalOrder.estimated_delivery).toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric", year: "numeric"
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Status timeline */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888880] mb-1">Status Timeline</p>
              <OrderTimeline status={modalOrder.status} history={getStatusHistory(modalOrder.status_history)} />
            </div>

            {/* Footer CTA */}
            <div className="pt-1 border-t border-[#F0F0F0] dark:border-[#222222]">
              <Link
                to="/buyer/tracking"
                onClick={() => setModalOrder(null)}
                className="flex items-center justify-center gap-1.5 w-full rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-[11px] font-bold py-2.5 hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors"
              >
                <MapPin className="h-3.5 w-3.5" />
                Open Live Map View
                <ExternalLink className="h-3 w-3 ml-0.5 opacity-70" />
              </Link>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
