import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, DollarSign, Repeat } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function SellerAnalytics() {
  const { user } = useAuth();
  const [topProducts, setTopProducts] = useState<{ name: string; revenue: number }[]>([]);
  const [stats, setStats] = useState({ completion: 0, views: 0, aov: 0, repeat: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // orders for this seller
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total_amount, status, buyer_id, created_at")
        .eq("seller_id", user.id);
      const list = orders || [];

      const delivered = list.filter((o) => o.status === "delivered");
      const completion = list.length ? (delivered.length / list.length) * 100 : 0;
      const aov = delivered.length
        ? delivered.reduce((s, o) => s + (Number(o.total_amount) || 0), 0) / delivered.length
        : 0;

      const buyersAll = list.map((o) => o.buyer_id);
      const buyersUnique = new Set(buyersAll);
      const repeatBuyers = [...buyersUnique].filter((b) => buyersAll.filter((x) => x === b).length > 1).length;
      const repeat = buyersUnique.size ? (repeatBuyers / buyersUnique.size) * 100 : 0;

      // views this month on this seller's products
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { data: prods } = await supabase.from("products").select("id, title").eq("seller_id", user.id);
      const ids = (prods || []).map((p) => p.id);
      let viewsCount = 0;
      if (ids.length) {
        const { count } = await supabase
          .from("product_views" as any)
          .select("id", { count: "exact", head: true })
          .in("product_id", ids)
          .gte("created_at", monthStart.toISOString());
        viewsCount = count || 0;
      }

      // top 5 by revenue (delivered orders → items)
      if (delivered.length) {
        const orderIds = delivered.map((o) => o.id);
        const { data: items } = await supabase
          .from("order_items")
          .select("product_id, total_price")
          .in("order_id", orderIds);
        const revByProd: Record<string, number> = {};
        (items || []).forEach((it: any) => {
          if (!it.product_id) return;
          revByProd[it.product_id] = (revByProd[it.product_id] || 0) + (Number(it.total_price) || 0);
        });
        const titleMap: Record<string, string> = {};
        (prods || []).forEach((p: any) => { titleMap[p.id] = p.title; });
        const top = Object.entries(revByProd)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([pid, rev]) => ({ name: (titleMap[pid] || "Product").slice(0, 18), revenue: Number(rev.toFixed(2)) }));
        setTopProducts(top);
      }

      setStats({ completion, views: viewsCount, aov, repeat });
      setLoading(false);
    })();
  }, [user?.id]);

  const kpis = [
    { label: "Completion Rate", value: `${stats.completion.toFixed(1)}%`, icon: TrendingUp },
    { label: "Profile Views (mo)", value: String(stats.views), icon: Users },
    { label: "Avg Order Value", value: `$${stats.aov.toFixed(2)}`, icon: DollarSign },
    { label: "Repeat Buyer Rate", value: `${stats.repeat.toFixed(1)}%`, icon: Repeat },
  ];

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Performance insights for your store</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                <k.icon className="h-4 w-4" />
                <span className="text-xs font-medium">{k.label}</span>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Top Products by Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No delivered orders yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="revenue" fill="hsl(var(--seller))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
