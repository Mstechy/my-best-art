import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import { CheckCircle2, Package, Truck, ArrowRight, Printer, Copy, ShoppingBag, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OrderData {
  id: string;
  tracking_number: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  shipping_address: any;
  items: { id: string; quantity: number; unit_price: number; product_title: string; product_image: string | null }[];
}

const TIMELINE = [
  { step: "Order Confirmed",  desc: "Your order has been received",       icon: CheckCircle2, doneKey: "pending"    },
  { step: "Processing",       desc: "Seller is preparing your items",     icon: Package,      doneKey: "processing" },
  { step: "Shipped",          desc: "Your order is on its way",           icon: Truck,        doneKey: "shipped"    },
  { step: "Delivered",        desc: "Enjoy your purchase!",               icon: ShoppingBag,  doneKey: "delivered"  },
];
const STATUS_ORDER = ["pending", "processing", "shipped", "delivered"];

export default function OrderSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchOrder = async () => {
      const { data: orderData } = await supabase.from("orders").select("*").eq("id", id).single();
      if (!orderData) { setLoading(false); return; }

      const { data: itemsData } = await supabase.from("order_items").select("id, quantity, unit_price, product_id").eq("order_id", id);
      const productIds = (itemsData || []).filter(i => i.product_id).map(i => i.product_id!);
      let productMap: Record<string, { title: string; image: string | null }> = {};
      if (productIds.length > 0) {
        const [{ data: products }, { data: images }] = await Promise.all([
          supabase.from("products").select("id, title").in("id", productIds),
          supabase.from("product_images").select("product_id, image_url, is_primary").in("product_id", productIds),
        ]);
        products?.forEach(p => {
          const img = images?.find(i => i.product_id === p.id && i.is_primary) || images?.find(i => i.product_id === p.id);
          productMap[p.id] = { title: p.title, image: img?.image_url || null };
        });
      }

      setOrder({
        id: orderData.id,
        tracking_number: orderData.tracking_number,
        total_amount: orderData.total_amount,
        status: orderData.status,
        created_at: orderData.created_at,
        shipping_address: orderData.shipping_address,
        items: (itemsData || []).map(item => ({
          id: item.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          product_title: item.product_id ? productMap[item.product_id]?.title || "Product" : "Product",
          product_image: item.product_id ? productMap[item.product_id]?.image || null : null,
        })),
      });
      setLoading(false);
    };
    fetchOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E]">
        <MarketplaceNavbar showSearch={false} />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-[#888880]" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E]">
        <MarketplaceNavbar showSearch={false} />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="h-14 w-14 rounded-2xl bg-[#F2F3F5] dark:bg-[#1A1A1A] flex items-center justify-center mb-4">
            <Package className="h-6 w-6 text-[#C0C0B8]" />
          </div>
          <h2 className="text-lg font-bold text-[#111111] dark:text-[#FAF5F2]">Order not found</h2>
          <Link to="/marketplace" className="mt-5">
            <button className="px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] transition-colors">
              Back to Marketplace
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const currentStatusIdx = STATUS_ORDER.indexOf(order.status);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E]">
      <MarketplaceNavbar showSearch={false} />
      <CartDrawer />

      <div className="mx-auto max-w-2xl px-4 lg:px-8 py-12">

        {/* Success hero */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center mb-5">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Order Placed!</h1>
          <p className="mt-1.5 text-sm text-[#888880] dark:text-[#A0A0A0]">
            Thank you for your purchase. Your order is being processed.
          </p>
          <p className="mt-1 text-[10px] font-mono text-[#C0C0B8] dark:text-[#444444]">
            #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Tracking number card */}
        {order.tracking_number && (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 mb-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#888880] mb-2">Tracking Number</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-mono text-xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-widest">
                {order.tracking_number}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(order.tracking_number!); toast.success("Copied!"); }}
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-[#E8E8E8] dark:border-[#222222] text-[#888880] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Delivery timeline */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 mb-4">
          <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Delivery Timeline</p>
          <div className="space-y-4">
            {TIMELINE.map((item, i) => {
              const done = i <= currentStatusIdx;
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${done ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-[#F2F3F5] dark:bg-[#111111]"}`}>
                    <Icon className={`h-3.5 w-3.5 ${done ? "text-emerald-500" : "text-[#C0C0B8] dark:text-[#333333]"}`} />
                  </div>
                  <div className={`flex-1 pb-4 border-b border-[#F2F3F5] dark:border-[#1E1E1E] last:border-0 last:pb-0`}>
                    <p className={`text-xs font-semibold ${done ? "text-[#111111] dark:text-[#FAF5F2]" : "text-[#888880] dark:text-[#A0A0A0]"}`}>{item.step}</p>
                    <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] mt-0.5">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order items */}
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 mb-6">
          <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Order Items</p>
          <div className="space-y-3">
            {order.items.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[#F2F3F5] dark:bg-[#111111] overflow-hidden shrink-0">
                  {item.product_image ? (
                    <img src={item.product_image} alt={item.product_title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Package className="h-4 w-4 text-[#C0C0B8]" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] truncate">{item.product_title}</p>
                  <p className="text-[10px] text-[#888880]">Qty: {item.quantity}</p>
                </div>
                <span className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">{formatPrice(item.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[#F2F3F5] dark:border-[#1E1E1E] mt-4 pt-3 flex justify-between text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">
            <span>Total</span><span>{formatPrice(order.total_amount)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors"
          >
            <Printer className="h-3.5 w-3.5" /> Print Receipt
          </button>
          <Link to="/buyer/orders" className="flex-1">
            <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors">
              <Package className="h-3.5 w-3.5" /> View Orders
            </button>
          </Link>
          <Link to="/marketplace" className="flex-1">
            <button className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
              Continue Shopping <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        </div>
      </div>

      <style>{`
        @media print {
          nav, button, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  );
}
