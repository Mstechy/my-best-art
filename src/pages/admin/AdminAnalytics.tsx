import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, TrendingUp, Package, ShoppingCart,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, AreaChart, Area,
} from "recharts";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";

interface Bucket { week: string; value: number }
interface TopProduct { title: string; total: number }

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // Monday start
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function weeksBack(n: number): Date[] {
  const out: Date[] = [];
  const now = startOfWeek(new Date());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i * 7);
    out.push(d);
  }
  return out;
}

function fmt(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function bucketize(rows: { created_at: string; amount?: number }[], weeks: Date[], mode: "count" | "sum"): Bucket[] {
  const map = new Map<string, number>();
  weeks.forEach(w => map.set(w.toISOString(), 0));
  rows.forEach(r => {
    const w = startOfWeek(new Date(r.created_at)).toISOString();
    if (!map.has(w)) return;
    const inc = mode === "sum" ? (r.amount || 0) : 1;
    map.set(w, (map.get(w) || 0) + inc);
  });
  return weeks.map(w => ({ week: fmt(w), value: Math.round((map.get(w.toISOString()) || 0) * 100) / 100 }));
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0, sellers: 0 });
  const [ordersSeries, setOrdersSeries] = useState<Bucket[]>([]);
  const [usersSeries, setUsersSeries] = useState<Bucket[]>([]);
  const [revenueSeries, setRevenueSeries] = useState<Bucket[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const weeks = weeksBack(12);
      const since = weeks[0].toISOString();

      const [usersRes, productsRes, ordersRes, sellersRes, ordersListRes, profilesListRes, itemsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "seller"),
        supabase.from("orders").select("created_at, total_amount, status").gte("created_at", since),
        supabase.from("profiles").select("created_at").gte("created_at", since),
        supabase.from("order_items").select("quantity, products(title)").limit(500),
      ]);

      setStats({
        users: usersRes.count || 0,
        products: productsRes.count || 0,
        orders: ordersRes.count || 0,
        sellers: sellersRes.count || 0,
      });

      const orders = (ordersListRes.data || []) as { created_at: string; total_amount: number; status: string }[];
      setOrdersSeries(bucketize(orders.map(o => ({ created_at: o.created_at })), weeks, "count"));
      setRevenueSeries(bucketize(
        orders.filter(o => o.status === "delivered").map(o => ({ created_at: o.created_at, amount: Number(o.total_amount) || 0 })),
        weeks, "sum"
      ));

      const profiles = (profilesListRes.data || []) as { created_at: string }[];
      setUsersSeries(bucketize(profiles, weeks, "count"));

      // Top products by quantity sold
      const items = (itemsRes.data || []) as any[];
      const agg = new Map<string, number>();
      items.forEach(it => {
        const title = it.products?.title || "Unknown";
        agg.set(title, (agg.get(title) || 0) + (Number(it.quantity) || 0));
      });
      const top = [...agg.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([title, total]) => ({ title: title.length > 22 ? title.slice(0, 20) + "…" : title, total }));
      setTopProducts(top);

      setLoading(false);
    };
    load();
  }, []);

  const analyticsStats = [
    { label: "Total Users", value: String(stats.users), icon: Users, gradient: "gradient-primary" },
    { label: "Active Sellers", value: String(stats.sellers), icon: TrendingUp, gradient: "gradient-seller" },
    { label: "Products Listed", value: String(stats.products), icon: Package, gradient: "gradient-buyer" },
    { label: "Total Orders", value: String(stats.orders), icon: ShoppingCart, gradient: "gradient-admin" },
  ];

  const chartTheme = {
    grid: "hsl(var(--border))",
    text: "hsl(var(--muted-foreground))",
    primary: "hsl(var(--primary))",
    accent: "hsl(var(--accent))",
  };

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Platform Analytics</h1>
          <p className="mt-1 text-muted-foreground">Real performance data for the last 12 weeks</p>
        </div>
      </AnimatedSection>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analyticsStats.map((stat, i) => (
          <AnimatedSection key={stat.label} variant="fade-up" delay={i * 60}>
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.gradient}`}>
                  <stat.icon className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          </AnimatedSection>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AnimatedSection variant="fade-up" delay={120}>
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">Orders per week</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-64 animate-pulse bg-muted/40 rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={ordersSeries}>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="week" stroke={chartTheme.text} fontSize={11} />
                    <YAxis stroke={chartTheme.text} fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="value" stroke={chartTheme.primary} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection variant="fade-up" delay={160}>
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">New users per week</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-64 animate-pulse bg-muted/40 rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={usersSeries}>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="week" stroke={chartTheme.text} fontSize={11} />
                    <YAxis stroke={chartTheme.text} fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" fill={chartTheme.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection variant="fade-up" delay={200}>
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">Revenue per week (delivered)</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-64 animate-pulse bg-muted/40 rounded-lg" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={revenueSeries}>
                    <defs>
                      <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={chartTheme.primary} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={chartTheme.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="week" stroke={chartTheme.text} fontSize={11} />
                    <YAxis stroke={chartTheme.text} fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `$${Number(v).toFixed(2)}`} />
                    <Area type="monotone" dataKey="value" stroke={chartTheme.primary} strokeWidth={2.5} fill="url(#revFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection variant="fade-up" delay={240}>
          <Card className="border-border/60">
            <CardHeader><CardTitle className="font-display text-base">Top-selling products</CardTitle></CardHeader>
            <CardContent>
              {loading ? <div className="h-64 animate-pulse bg-muted/40 rounded-lg" /> : topProducts.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">No sales yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
                    <XAxis type="number" stroke={chartTheme.text} fontSize={11} allowDecimals={false} />
                    <YAxis type="category" dataKey="title" stroke={chartTheme.text} fontSize={11} width={130} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="total" fill={chartTheme.accent} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>
    </div>
  );
}
