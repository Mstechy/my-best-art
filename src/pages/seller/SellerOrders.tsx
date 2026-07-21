import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Search, Truck } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import ShipOrderDialog from "@/components/ShipOrderDialog";
import { supabase } from "@/integrations/supabase/client";
import type { Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Order {
  id: string;
  buyer_id: string;
  status: string;
  total_amount: number;
  currency: string;
  tracking_number: string | null;
  carrier: string | null;
  estimated_delivery: string | null;
  created_at: string;
}

type Tab = "all" | "pending" | "processing" | "shipped" | "delivered" | "cancelled";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  delivered: "bg-accent/10 text-accent border-accent/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  disputed: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function SellerOrders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [shipDialogOrder, setShipDialogOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setOrders(data as unknown as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    if (!user) return;
    const channel = supabase
      .channel(`seller-orders-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `seller_id=eq.${user.id}` },
        () => fetchOrders()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const updateStatus = async (orderId: string, newStatus: Enums<"order_status">) => {
    const order = orders.find(o => o.id === orderId);
    if (newStatus === "shipped") {
      if (order) setShipDialogOrder(order);
      return;
    }
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Order marked as ${newStatus}` });
    fetchOrders();
  };

  const confirmShip = async (data: { carrier: string; tracking_number: string; estimated_delivery: string | null }) => {
    if (!shipDialogOrder || !user) return;
    const { error } = await supabase.from("orders").update({
      status: "shipped",
      carrier: data.carrier,
      tracking_number: data.tracking_number,
      estimated_delivery: data.estimated_delivery,
    }).eq("id", shipDialogOrder.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: shipDialogOrder.buyer_id,
      content: `Your order has shipped via ${data.carrier}. Tracking: ${data.tracking_number}. [order:${shipDialogOrder.id}]`,
    });

    toast({ title: "Order marked as shipped", description: "The buyer has been notified." });
    fetchOrders();
  };

  const filtered = orders.filter(o => {
    const matchesSearch = !search || o.id.includes(search);
    const matchesTab = tab === "all" || o.status === tab;
    return matchesSearch && matchesTab;
  });

  const tabs: Tab[] = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Orders</h1>
          <p className="mt-1 text-muted-foreground">Track and manage incoming orders ({orders.length} total)</p>
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
            >{t === "all" ? "All" : t} <span className="ml-1 text-xs opacity-70">({t === "all" ? orders.length : orders.filter(o => o.status === t).length})</span></button>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
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
            {filtered.map(order => (
              <Card key={order.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-display font-semibold text-foreground text-sm">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(order.created_at).toLocaleDateString()}</p>
                      {(order.tracking_number || order.carrier) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {order.carrier && `${order.carrier} · `}{order.tracking_number || "tracking pending"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-foreground">${order.total_amount}</span>
                      <Badge className={statusColors[order.status] || ""}>{order.status}</Badge>
                      {(order.status === "pending" || order.status === "processing") && (
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setShipDialogOrder(order)}>
                          <Truck className="h-3.5 w-3.5" /> Ship
                        </Button>
                      )}
                      {(order.status === "pending" || order.status === "processing" || order.status === "shipped") && (
                        <Select onValueChange={(val) => updateStatus(order.id, val as Enums<"order_status">)}>
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Update status" />
                          </SelectTrigger>
                          <SelectContent>
                            {order.status === "pending" && <SelectItem value="processing">Processing</SelectItem>}
                            {order.status === "shipped" && <SelectItem value="delivered">Delivered</SelectItem>}
                            <SelectItem value="cancelled">Cancel</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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
