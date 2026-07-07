import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, DollarSign, ShoppingCart, AlertTriangle, Store, Megaphone, BarChart3, Package, ArrowRight, Clock, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AnimatedSection from "@/components/AnimatedSection";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SystemAlert {
  id: string;
  level: "info" | "warning" | "critical";
  source: string;
  message: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ sellers: 0, buyers: 0, totalUsers: 0, products: 0, orders: 0, disputes: 0, revenue: 0, pendingProducts: 0, pendingSellers: 0 });
  const [recentOrders, setRecentOrders] = useState<Array<{ id: string; status: string; total_amount: number | string; created_at: string; buyer_id: string; seller_id: string; buyer_name?: string; seller_name?: string }>>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);


  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase.rpc("admin_platform_counts");
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setStats({
          sellers: Number(row.sellers) || 0,
          buyers: Number(row.buyers) || 0,
          totalUsers: Number(row.total_users) || 0,
          products: Number(row.products) || 0,
          orders: Number(row.orders) || 0,
          disputes: Number(row.disputes) || 0,
          revenue: Number(row.revenue) || 0,
          pendingProducts: Number(row.pending_products) || 0,
          pendingSellers: Number(row.pending_sellers) || 0,
        });
      }
    };

    const fetchRecentOrders = async () => { 

      const { data } = await supabase
        .from("orders")
        .select("id, status, total_amount, created_at, buyer_id, seller_id")
        .order("created_at", { ascending: false })
        .limit(5);
      if (data && data.length > 0) {
        const userIds = [...new Set([...data.map(o => o.buyer_id), ...data.map(o => o.seller_id)])];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const map: Record<string, string> = {};
        profiles?.forEach(p => { map[p.user_id] = p.full_name || "Unknown"; });
        setRecentOrders(data.map(o => ({ ...o, buyer_name: map[o.buyer_id] || "Unknown", seller_name: map[o.seller_id] || "Unknown" })));
      }
    };

    const fetchAlerts = async () => {
      const { data } = await supabase

        .from("system_alerts")
        .select("id, level, source, message, created_at")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      setAlerts((data ?? []) as SystemAlert[]);
    };

    fetchStats();
    fetchRecentOrders();
    fetchAlerts();

    const channel = supabase
      .channel("admin-system-alerts")
      .on("postgres_changes", { event: "*", schema: "public", table: "system_alerts" }, fetchAlerts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const resolveAlert = async (id: string) => {
    const { error } = await supabase
      .from("system_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    setAlerts(alerts.filter(a => a.id !== id));
    toast.success("Alert resolved");
  };

  const criticalCount = alerts.filter(a => a.level === "critical").length;
  const warnCount = alerts.filter(a => a.level === "warning").length;


  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    delivered: "bg-accent/10 text-accent border-accent/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const statCards = [
    { label: "Total Revenue", value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, cardClass: "stat-card" },
    { label: "Pending Products", value: String(stats.pendingProducts), icon: Clock, cardClass: stats.pendingProducts > 0 ? "stat-card stat-card-destructive" : "stat-card" },
    { label: "Active Sellers", value: String(stats.sellers), icon: Store, cardClass: "stat-card stat-card-seller" },
    { label: "Total Buyers", value: String(stats.buyers), icon: Users, cardClass: "stat-card stat-card-buyer" },
    { label: "Total Users", value: String(stats.totalUsers), icon: Users, cardClass: "stat-card" },
    { label: "Total Orders", value: String(stats.orders), icon: ShoppingCart, cardClass: "stat-card" },
    { label: "Open Disputes", value: String(stats.disputes), icon: AlertTriangle, cardClass: "stat-card stat-card-destructive" },
  ];

  const quickActions = [
    { label: "Approve Products", icon: CheckCircle2, href: "/admin/products", gradient: "gradient-seller", desc: `${stats.pendingProducts} pending` },
    { label: "View All Orders", icon: ShoppingCart, href: "/admin/orders", gradient: "gradient-primary", desc: "Monitor transactions" },
    { label: "Manage Sellers", icon: Users, href: "/admin/sellers", gradient: "gradient-buyer", desc: "View & moderate" },
    { label: "View Disputes", icon: AlertTriangle, href: "/admin/disputes", gradient: "gradient-admin", desc: "Resolve issues" },
    { label: "Manage Ads", icon: Megaphone, href: "/admin/ads", gradient: "gradient-primary", desc: "Platform revenue" },
    { label: "Analytics", icon: BarChart3, href: "/admin/analytics", gradient: "gradient-buyer", desc: "Full insights" },
  ];

  return (
    <div className="space-y-8">
      <AnimatedSection variant="fade-up">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}` : 'Admin Dashboard'}
            </h1>
            <p className="mt-1 text-muted-foreground">Platform overview and management</p>
          </div>
          {(criticalCount > 0 || warnCount > 0) && (
            <div className={`relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${criticalCount > 0 ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-600"}`}>
              {criticalCount > 0 && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse" />}
              <ShieldAlert className="h-4 w-4" />
              {criticalCount > 0 ? `${criticalCount} critical alert${criticalCount > 1 ? "s" : ""}` : `${warnCount} warning${warnCount > 1 ? "s" : ""}`}
            </div>
          )}
        </div>
      </AnimatedSection>

      {alerts.length > 0 && (
        <AnimatedSection variant="fade-up" delay={20}>
          <Card className={`border-2 ${criticalCount > 0 ? "border-destructive/40 bg-destructive/5" : "border-yellow-500/30 bg-yellow-500/5"}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className={`flex items-center gap-2 text-base font-display ${criticalCount > 0 ? "text-destructive" : "text-yellow-600"}`}>
                <ShieldAlert className="h-5 w-5" />
                System alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={a.level === "critical" ? "bg-destructive/10 text-destructive border-destructive/30 text-xs" : a.level === "warning" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-xs" : "bg-muted text-muted-foreground text-xs"}>
                        {a.level}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{a.source}</span>
                    </div>
                    <p className="text-sm text-foreground mt-1">{a.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => resolveAlert(a.id)}>Resolve</Button>
                </div>
              ))}
              {alerts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">+{alerts.length - 5} more alerts</p>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      )}

      {stats.pendingProducts > 0 && (
        <AnimatedSection variant="fade-up" delay={30}>
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="font-medium text-foreground text-sm">{stats.pendingProducts} product{stats.pendingProducts > 1 ? "s" : ""} awaiting your approval</p>
              <p className="text-xs text-muted-foreground">Sellers are waiting for their products to go live</p>
            </div>
            <Link to="/admin/products" className="ml-auto shrink-0">
              <Button size="sm" className="gap-1 gradient-seller text-primary-foreground">Review Now <ArrowRight className="h-3 w-3" /></Button>
            </Link>
          </div>
        </AnimatedSection>
      )}


      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, i) => (
          <AnimatedSection key={stat.label} variant="fade-up" delay={i * 60}>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <AnimatedSection variant="fade-up" delay={200} className="lg:col-span-2">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Recent Orders</CardTitle>
              <Link to="/admin/orders">
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">View All <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mb-4" />
                  <p className="text-sm text-muted-foreground">No orders yet. Orders will appear as buyers make purchases.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                      <div>
                        <p className="font-medium text-sm text-foreground">#{order.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{order.buyer_name} → {order.seller_name}</p>
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
    </div>
  );
}
