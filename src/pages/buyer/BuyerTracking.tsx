import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Truck, Search, MapPin, ArrowRight, Copy } from "lucide-react";
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
        .from("orders")
        .select("*")
        .eq("buyer_id", user.id)
        .in("status", ["pending", "processing", "shipped", "delivered"])
        .order("updated_at", { ascending: false });
      if (data) setOrders(data as unknown as Order[]);
      setLoading(false);
    };
    fetchOrders();
    const channel = supabase
      .channel(`buyer-tracking-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` },
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
      )
      .subscribe();

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
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Delivery Tracking</h1>
          <p className="mt-1 text-muted-foreground">Track your deliveries in real-time</p>
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={50}>
        <Card className="border-border/60">
          <CardContent className="p-6">
            <h3 className="font-display font-semibold text-foreground mb-4">Track a Package</h3>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Enter tracking number or order ID..." className="pl-10 h-11" />
              </div>
              <Button className="gap-2 gradient-primary text-primary-foreground h-11">
                <MapPin className="h-4 w-4" /> Track
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">Purchase Tracking</h2>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
                  <Truck className="h-9 w-9 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">No tracked purchases</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  When you place an order, live status updates will appear here.
                </p>
                <Link to="/marketplace" className="mt-6"><Button variant="outline" className="gap-2">Browse Marketplace <ArrowRight className="h-4 w-4" /></Button></Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const history = getStatusHistory(order.status_history);
              return (
                <Card key={order.id} className="border-border/60">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-display font-semibold text-foreground text-sm">Order #{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Placed {new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge className={order.status === "delivered" ? "bg-accent/10 text-accent" : order.status === "shipped" ? "bg-purple-500/10 text-purple-600" : "bg-blue-500/10 text-blue-600"}>
                        {order.status}
                      </Badge>
                    </div>

                    {(order.carrier || order.tracking_number || order.estimated_delivery) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {order.carrier && <Badge variant="outline">{order.carrier}</Badge>}
                        {order.tracking_number && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(order.tracking_number!); sonnerToast("Tracking number copied"); }}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-muted/50"
                          >
                            <Copy className="h-3 w-3" /> {order.tracking_number}
                          </button>
                        )}
                        {order.estimated_delivery && (
                          <span className="text-muted-foreground">ETA {new Date(order.estimated_delivery).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}

                    <OrderTimeline status={order.status} history={history} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AnimatedSection>
    </div>
  );
}
