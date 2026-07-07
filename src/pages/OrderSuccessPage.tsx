import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import { CheckCircle2, Package, Truck, ArrowRight, Printer, Copy, ShoppingBag } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OrderData {
  id: string;
  tracking_number: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  shipping_address: any;
  items: { id: string; quantity: number; unit_price: number; product_title: string; product_image: string | null }[];
}

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

  const copyTrackingId = () => {
    if (order?.tracking_number) {
      navigator.clipboard.writeText(order.tracking_number);
      toast({ title: "Copied!", description: "Tracking ID copied to clipboard" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNavbar showSearch={false} />
        <div className="flex items-center justify-center py-32">
          <div className="animate-pulse space-y-4 text-center">
            <div className="h-16 w-16 rounded-full bg-muted mx-auto" />
            <div className="h-6 w-48 bg-muted rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNavbar showSearch={false} />
        <div className="flex flex-col items-center justify-center py-32">
          <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h2 className="font-display text-2xl font-bold text-foreground">Order not found</h2>
          <Link to="/marketplace"><Button className="mt-4">Back to Marketplace</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNavbar showSearch={false} />
      <CartDrawer />

      <div className="mx-auto max-w-2xl px-4 lg:px-8 py-12">
        {/* Success animation */}
        <div className="text-center mb-10">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" style={{ animationDuration: "2s" }} />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
              <CheckCircle2 className="h-10 w-10 text-accent" />
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Order Placed Successfully!</h1>
          <p className="mt-2 text-muted-foreground">Thank you for your purchase. Your order is being processed.</p>
        </div>

        {/* Tracking ID card */}
        {order.tracking_number && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 mb-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">Your Tracking ID</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-display text-2xl font-bold text-foreground tracking-wider">{order.tracking_number}</span>
              <button onClick={copyTrackingId} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Copy">
                <Copy className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Use this ID to track your order status</p>
          </div>
        )}

        {/* Delivery timeline */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Delivery Timeline</h3>
          <div className="space-y-4">
            {[
              { step: "Order Confirmed", desc: "Your order has been received", done: true, icon: CheckCircle2 },
              { step: "Processing", desc: "Seller is preparing your items", done: false, icon: Package },
              { step: "Shipped", desc: "Your order is on its way", done: false, icon: Truck },
              { step: "Delivered", desc: "Enjoy your purchase!", done: false, icon: ShoppingBag },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${item.done ? "bg-accent/10" : "bg-muted"}`}>
                  <item.icon className={`h-4 w-4 ${item.done ? "text-accent" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 pb-4 border-b border-border/60 last:border-0">
                  <p className={`font-medium text-sm ${item.done ? "text-foreground" : "text-muted-foreground"}`}>{item.step}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order items */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Order Items</h3>
          <div className="space-y-3">
            {order.items.map(item => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                  {item.product_image ? (
                    <img src={item.product_image} alt={item.product_title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Package className="h-4 w-4 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.product_title}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <span className="text-sm font-medium text-foreground">{formatPrice(item.unit_price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-4 pt-4 flex justify-between font-display font-bold text-lg">
            <span>Total</span>
            <span>{formatPrice(order.total_amount)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={() => window.print()} variant="outline" className="flex-1 gap-2 h-12">
            <Printer className="h-4 w-4" /> Print Receipt
          </Button>
          <Link to="/buyer/orders" className="flex-1">
            <Button variant="outline" className="w-full gap-2 h-12">
              <Package className="h-4 w-4" /> View Orders
            </Button>
          </Link>
          <Link to="/marketplace" className="flex-1">
            <Button className="w-full gap-2 h-12 bg-primary text-primary-foreground hover:bg-primary/90">
              Continue Shopping <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          nav, button, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .rounded-xl { border: 1px solid #ddd !important; }
        }
      `}</style>
    </div>
  );
}
