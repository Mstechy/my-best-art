import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, Package, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ShipOrderDialog from "@/components/ShipOrderDialog";
import { useAuth } from "@/hooks/useAuth";
import { useSellerOrderDetail } from "@/hooks/useSellerDashboard";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  delivered: "bg-success/10 text-success border-success/20",
};

export default function SellerOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const query = useSellerOrderDetail(user?.id, id);
  const [shipping, setShipping] = useState(false);
  const order = query.data;

  if (query.isLoading) return <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (query.isError) return <Card><CardContent className="py-12 text-center text-destructive">Could not load this order. Please refresh and try again.</CardContent></Card>;
  if (!order) return <Card><CardContent className="py-12 text-center text-muted-foreground">Order not found.</CardContent></Card>;

  const confirmShip = async (data: { carrier: string; tracking_number: string; estimated_delivery: string | null }) => {
    const { error } = await supabase.rpc("update_seller_order_fulfillment" as never, { p_order_id: order.id, p_status: "shipped", p_carrier: data.carrier, p_tracking_number: data.tracking_number, p_estimated_delivery: data.estimated_delivery } as never);
    if (error) { toast({ title: "Could not mark order as shipped", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Order marked as shipped" });
    setShipping(false);
    query.refetch();
  };

  const history = Array.isArray(order.status_history) ? order.status_history as { status?: string; changed_at?: string }[] : [];

  return <div className="space-y-6">
    <Button variant="ghost" className="gap-2 px-0" onClick={() => navigate("/seller/orders")}><ArrowLeft className="h-4 w-4" /> Back to orders</Button>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-display text-2xl font-bold">Order #{order.id.slice(0, 8)}</h1><p className="mt-1 text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p></div><Badge className={statusColors[order.status] || ""}>{order.status}</Badge></div>
    <Card><CardContent className="p-5"><h2 className="mb-4 font-semibold">Items ({order.items.length})</h2><div className="space-y-4">{order.items.map((item) => <div key={item.id} className="flex gap-3"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">{item.image_url ? <img src={item.image_url} alt={item.title || "Product"} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-5 w-5 text-muted-foreground" /></div>}</div><div className="min-w-0 flex-1"><p className="font-medium">{item.title || "Product details unavailable"}</p>{item.variant && <p className="text-xs text-muted-foreground">{item.variant}</p>}<p className="mt-1 text-xs text-muted-foreground">Qty {item.quantity}</p></div><div className="text-right text-sm"><p>{order.currency} {Number(item.unit_price).toLocaleString()}</p><p className="text-xs text-muted-foreground">{order.currency} {Number(item.total_price).toLocaleString()}</p></div></div>)}</div><div className="mt-5 border-t pt-4 text-right font-semibold">Total: {order.currency} {Number(order.total_amount).toLocaleString()}</div></CardContent></Card>
    <Card><CardContent className="p-5"><h2 className="mb-3 font-semibold">Shipping address</h2><p>{order.shipping_recipient_name || order.buyer_name || "Buyer"}</p>{order.shipping_phone && <p className="text-sm text-muted-foreground">{order.shipping_phone}</p>}<p className="text-sm text-muted-foreground">{order.shipping_address_line || "Address unavailable"}</p><p className="text-sm text-muted-foreground">{order.shipping_city || "City unavailable"}{order.shipping_country ? `, ${order.shipping_country}` : ""}</p></CardContent></Card>
    <Card><CardContent className="p-5"><h2 className="mb-4 font-semibold">Order timeline</h2><div className="space-y-3">{history.length ? history.map((event, index) => <div key={`${event.changed_at}-${index}`} className="flex gap-3 text-sm"><span className="mt-1 h-2 w-2 rounded-full bg-primary" /><span className="capitalize">{event.status || "updated"}</span><span className="ml-auto text-xs text-muted-foreground">{event.changed_at ? new Date(event.changed_at).toLocaleString() : ""}</span></div>) : <p className="text-sm text-muted-foreground">Current status: {order.status}</p>}</div></CardContent></Card>
    <div className="flex flex-wrap gap-2"><Button onClick={() => setShipping(true)} disabled={!["pending", "processing"].includes(order.status)} className="gap-2"><Truck className="h-4 w-4" /> Mark as shipped</Button><Button variant="outline" asChild><Link to={`/seller/chat?partner=${order.buyer_id}`} className="gap-2"><MessageSquare className="h-4 w-4" /> Message buyer</Link></Button></div>
    <ShipOrderDialog open={shipping} onOpenChange={setShipping} orderId={order.id} initialCarrier={order.carrier} initialTracking={order.tracking_number} onConfirm={confirmShip} />
  </div>;
}
