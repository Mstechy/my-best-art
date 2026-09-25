import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, Truck, Package, MessageSquare } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AnimatedSection from "@/components/AnimatedSection";
import ShipOrderDialog from "@/components/ShipOrderDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSellerOrders } from "@/hooks/useSellerDashboard";

type Tab = "all" | "pending" | "processing" | "shipped" | "delivered" | "cancelled";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  delivered: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  disputed: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function SellerOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [showArchive, setShowArchive] = useState(false);
  const [shipDialogOrder, setShipDialogOrder] = useState<ReturnType<typeof useSellerOrders>["data"][number] | null>(null);

  const ordersQuery = useSellerOrders(user?.id);
  const orders = ordersQuery.data ?? [];
  const loading = ordersQuery.isLoading;

  const confirmShip = async (data: { carrier: string; tracking_number: string; estimated_delivery: string | null }) => {
    if (!shipDialogOrder || !user) return;
    const { error } = await supabase.rpc("update_seller_order_fulfillment" as never, {
      p_order_id: shipDialogOrder.id,
      p_status: "shipped",
      p_carrier: data.carrier,
      p_tracking_number: data.tracking_number,
      p_estimated_delivery: data.estimated_delivery,
    } as never);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: shipDialogOrder.buyer_id,
      content: `Your order has shipped via ${data.carrier}. Tracking: ${data.tracking_number}. [order:${shipDialogOrder.id}]`,
    });

    toast({ title: "Order marked as shipped", description: "The buyer has been notified." });
    setShipDialogOrder(null);
    ordersQuery.refetch();
  };

  const archiveCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const isArchived = (order: (typeof orders)[number]) => ["delivered", "cancelled", "disputed"].includes(order.status) && new Date(order.created_at).getTime() < archiveCutoff;
  const visibleOrders = orders.filter((order) => showArchive ? isArchived(order) : !isArchived(order));
  const filtered = visibleOrders.filter(o => {
    const matchesSearch = !search || o.id.includes(search) || o.buyer_name?.toLowerCase().includes(search.toLowerCase()) || o.items.some((item) => item.title?.toLowerCase().includes(search.toLowerCase()));
    const matchesTab = tab === "all" || o.status === tab;
    return matchesSearch && matchesTab;
  });

  const tabs: Tab[] = ["all", "pending", "processing", "shipped", "delivered"];

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Orders</h1>
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground">{showArchive ? "Completed orders older than 30 days" : "Active order history"} ({visibleOrders.length})</p>
            <Button size="sm" variant="outline" onClick={() => setShowArchive((value) => !value)}>{showArchive ? "Show active" : "View archive"}</Button>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={50}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order ID..." className="pl-10 h-11" />
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={80}>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all capitalize ${tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >{t === "all" ? "All" : t} <span className="ml-1 text-xs opacity-70">({t === "all" ? visibleOrders.length : visibleOrders.filter(o => o.status === t).length})</span></button>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        {loading ? (
          <div className="space-y-3" aria-label="Loading orders">{[1, 2, 3].map((n) => <div key={n} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div>
        ) : ordersQuery.isError ? (
          <Card><CardContent className="py-12 text-center text-destructive">Could not load orders. Please refresh and try again.</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
                  <ShoppingCart className="h-9 w-9 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">No orders yet</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">Orders will appear here once buyers purchase your products.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const first = order.items[0];
              return (
                <Card key={order.id} className="border-border/60 transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <Link to={`/seller/orders/${order.id}`} className="block">
                      <div className="flex gap-3">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                          {first?.image_url ? <img src={first.image_url} alt={first.title || "Product"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-6 w-6 text-muted-foreground" /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-semibold text-foreground">{first?.title || "Product details unavailable"}</p>
                          {first?.variant && <p className="mt-1 text-xs text-muted-foreground">{first.variant}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">x{first?.quantity || 0}{order.items.length > 1 ? ` · +${order.items.length - 1} more` : ""}</p>
                           <p className="mt-2 text-xs font-medium text-foreground">{order.shipping_recipient_name || order.buyer_name || "Buyer"}</p>
                           {order.shipping_phone && <p className="text-xs text-muted-foreground">Phone: {order.shipping_phone}</p>}
                           <p className="text-xs text-muted-foreground">{order.shipping_address_line || "Address unavailable"}</p>
                           <p className="text-xs text-muted-foreground">{order.shipping_city || "City unavailable"}{order.shipping_country ? `, ${order.shipping_country}` : ""}</p>
                          <p className="mt-1 text-xs text-muted-foreground">#{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2"><span className="font-display font-bold text-foreground">{order.currency} {Number(order.total_amount).toLocaleString()}</span><Badge className={statusColors[order.status] || ""}>{order.status}</Badge></div>
                      </div>
                      {(order.carrier || order.tracking_number) && <p className="mt-3 text-xs text-muted-foreground">{order.carrier && `${order.carrier} · `}{order.tracking_number || "Tracking pending"}</p>}
                    </Link>
                    <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" onClick={() => navigate(`/seller/chat?partner=${order.buyer_id}`)}><MessageSquare className="h-3.5 w-3.5" /> Message buyer</Button>{(order.status === "pending" || order.status === "processing") && <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShipDialogOrder(order)}><Truck className="h-3.5 w-3.5" /> Ship</Button>}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AnimatedSection>

      {shipDialogOrder && (
        <ShipOrderDialog
          open={!!shipDialogOrder}
          onOpenChange={(o) => { if (!o) setShipDialogOrder(null); }}
          orderId={shipDialogOrder.id}
          initialCarrier={shipDialogOrder.carrier}
          initialTracking={shipDialogOrder.tracking_number}
          onConfirm={confirmShip}
        />
      )}
    </div>
  );
}
