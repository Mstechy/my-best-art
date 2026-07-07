import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Search, ShoppingCart, Package } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";

interface OrderWithDetails {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  tracking_number: string | null;
  buyer_name: string;
  buyer_email: string;
  seller_name: string;
  item_count: number;
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

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (!ordersData) { setLoading(false); return; }

      // Get all buyer + seller IDs
      const userIds = [...new Set([...ordersData.map(o => o.buyer_id), ...ordersData.map(o => o.seller_id)])];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
      const profileMap: Record<string, { name: string; email: string }> = {};
      profiles?.forEach(p => { profileMap[p.user_id] = { name: p.full_name || "Unknown", email: p.email }; });

      // Get order item counts
      const orderIds = ordersData.map(o => o.id);
      const { data: items } = await supabase.from("order_items").select("order_id").in("order_id", orderIds);
      const countMap: Record<string, number> = {};
      items?.forEach(i => { countMap[i.order_id] = (countMap[i.order_id] || 0) + 1; });

      setOrders(ordersData.map(o => ({
        id: o.id,
        status: o.status,
        total_amount: o.total_amount,
        currency: o.currency,
        created_at: o.created_at,
        tracking_number: o.tracking_number,
        buyer_name: profileMap[o.buyer_id]?.name || "Unknown",
        buyer_email: profileMap[o.buyer_id]?.email || "",
        seller_name: profileMap[o.seller_id]?.name || "Unknown",
        item_count: countMap[o.id] || 0,
      })));
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const filtered = orders.filter(o => {
    const matchesSearch = !search ||
      o.id.includes(search) ||
      o.buyer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.seller_name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || o.status === tab;
    return matchesSearch && matchesTab;
  });

  const tabs: Tab[] = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">All Orders</h1>
          <p className="mt-1 text-muted-foreground">Monitor all marketplace transactions ({orders.length} total)</p>
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={50}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order ID, buyer, or seller..." className="pl-10 h-11" />
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={80}>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all capitalize ${tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >{t === "all" ? `All (${orders.length})` : `${t} (${orders.filter(o => o.status === t).length})`}</button>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        <Card className="border-border/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading orders...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                  <ShoppingCart className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-display font-semibold text-foreground">No orders found</p>
                <p className="mt-1 text-sm text-muted-foreground">Orders will appear here as buyers make purchases.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs text-foreground">#{order.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <div>
                            <span className="text-sm font-medium text-foreground">{order.buyer_name}</span>
                            <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{order.seller_name}</TableCell>
                        <TableCell>{order.item_count}</TableCell>
                        <TableCell className="font-semibold">${order.total_amount}</TableCell>
                        <TableCell>
                          <Badge className={`${statusColors[order.status] || ""} capitalize text-xs`}>{order.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
