import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Truck, DollarSign, Search, MessageSquare, Package, Flag, ArrowRight, Shield, Star, Clock, Heart, TrendingUp } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import OffersSentCard from "@/components/OffersSentCard";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function BuyerDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ activeOrders: 0, inTransit: 0, totalSpent: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [spendData, setSpendData] = useState<{ month: string; total: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    delivered: "bg-accent/10 text-accent border-accent/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, total_amount, created_at, seller_id")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (orders) {
        const active = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length;
        const transit = orders.filter(o => o.status === "shipped").length;
        const spent = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        setStats({ activeOrders: active, inTransit: transit, totalSpent: spent });

        // Get recent 5 orders with seller names
        const recent = orders.slice(0, 5);
        if (recent.length > 0) {
          const sellerIds = [...new Set(recent.map(o => o.seller_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", sellerIds);
          const map: Record<string, string> = {};
          profiles?.forEach(p => { map[p.user_id] = p.full_name || "Unknown Seller"; });
          setRecentOrders(recent.map(o => ({ ...o, seller_name: map[o.seller_id] || "Unknown Seller" })));
        }

        // 6-month spend chart (includes 0-value months)
        const now = new Date();
        const months: { key: string; month: string; total: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          months.push({ key, month: d.toLocaleString("en-US", { month: "short" }), total: 0 });
        }
        orders.forEach(o => {
          const d = new Date(o.created_at);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const m = months.find(mm => mm.key === key);
          if (m) m.total += Number(o.total_amount) || 0;
        });
        setSpendData(months.map(({ month, total }) => ({ month, total: Math.round(total * 100) / 100 })));
      }
      setChartLoading(false);
    };
    fetchData();
  }, [user]);


  const statCards = [
    { label: "Active Orders", value: String(stats.activeOrders), icon: ShoppingCart, cardClass: "stat-card stat-card-buyer" },
    { label: "In Transit", value: String(stats.inTransit), icon: Truck, cardClass: "stat-card stat-card-seller" },
    { label: "Total Spent", value: `$${stats.totalSpent.toFixed(2)}`, icon: DollarSign, cardClass: "stat-card" },
  ];

  const quickActions = [
    { label: "Browse Marketplace", icon: Search, href: "/marketplace", gradient: "gradient-buyer", desc: "Discover products" },
    { label: "Track Orders", icon: Truck, href: "/buyer/tracking", gradient: "gradient-seller", desc: "Real-time tracking" },
    { label: "My Orders", icon: Package, href: "/buyer/orders", gradient: "gradient-primary", desc: "Order history" },
    { label: "Wishlist", icon: Heart, href: "/buyer/wishlist", gradient: "gradient-admin", desc: "Saved items" },
    { label: "Messages", icon: MessageSquare, href: "/buyer/chat", gradient: "gradient-buyer", desc: "Chat with sellers" },
    { label: "Report Issue", icon: Flag, href: "/buyer/reports", gradient: "gradient-primary", desc: "File a complaint" },
  ];

  return (
    <div className="space-y-8">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-1 text-muted-foreground">Your shopping dashboard</p>
          </div>
          <Link to="/marketplace">
            <Button className="gap-2 gradient-buyer text-primary-foreground shadow-glow-buyer">
              <Search className="h-4 w-4" /> Browse Marketplace
            </Button>
          </Link>
        </div>
      </AnimatedSection>

      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((stat, i) => (
          <AnimatedSection key={stat.label} variant="fade-up" delay={i * 80}>
            <div className={stat.cardClass}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <p className="font-display text-2xl font-bold text-foreground">{stat.value}</p>
            </div>
          </AnimatedSection>
        ))}
      </div>

      <AnimatedSection variant="fade-up" delay={180}>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-buyer" /> Spend (last 6 months)
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Total: <span className="font-semibold text-foreground">${spendData.reduce((s, m) => s + m.total, 0).toFixed(2)}</span>
            </span>
          </CardHeader>
          <CardContent>
            {chartLoading ? (
              <div className="h-48 animate-pulse rounded-lg bg-muted" />
            ) : spendData.every(m => m.total === 0) ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <DollarSign className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No spend yet. Place your first order to see trends here.</p>
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, "Spent"]}
                    />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#spendGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>


      <div className="grid gap-6 lg:grid-cols-3">
        <AnimatedSection variant="fade-up" delay={200} className="lg:col-span-2">
          <Card className="border-border/60 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Recent Orders</CardTitle>
              <Link to="/buyer/orders">
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">View All <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                    <ShoppingCart className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="font-display font-semibold text-foreground">No orders yet</p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">Start shopping in the marketplace to see your orders here</p>
                  <Link to="/marketplace" className="mt-4"><Button variant="outline" className="gap-2"><Search className="h-4 w-4" /> Browse Products</Button></Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                      <div>
                        <p className="font-medium text-sm text-foreground">#{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">from {order.seller_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm text-foreground">${order.total_amount}</span>
                        <Badge className={`${statusColors[order.status] || ""} capitalize text-xs`}>{order.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection variant="fade-up" delay={300}>
          <Card className="border-border/60 h-full">
            <CardHeader><CardTitle className="font-display">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <Link key={action.label} to={action.href}>
                  <Button variant="outline" className="w-full justify-start gap-3 h-12 hover:bg-muted/50 mb-1">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.gradient}`}>
                      <action.icon className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="text-left">
                      <span className="font-medium text-sm">{action.label}</span>
                      <p className="text-xs text-muted-foreground">{action.desc}</p>
                    </div>
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>

      <AnimatedSection variant="fade-up" delay={350}>
        <OffersSentCard />
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={400}>
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-accent" /><span>Escrow Protected Payments</span></div>
            <div className="flex items-center gap-2"><Star className="h-5 w-5 text-seller" /><span>Verified Sellers Only</span></div>
            <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><span>24/7 Dispute Resolution</span></div>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
