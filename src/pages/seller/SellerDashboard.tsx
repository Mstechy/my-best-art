import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, ShoppingCart, Plus, Megaphone, Wallet, ArrowRight, BarChart3, Clock, Store, AlertTriangle, CheckCircle2, Star, Boxes, ClipboardCheck } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import OffersReceivedCard from "@/components/OffersReceivedCard";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSellerDashboard } from "@/hooks/useSellerDashboard";
import { useCurrency } from "@/hooks/useCurrency";
import { buildProductModerationQueue, formatModerationAge } from "@/lib/moderationQueue";

const SellerRevenueChart = lazy(() => import("@/components/seller/SellerRevenueChart"));

export default function SellerDashboard() {
  const { formatPrice } = useCurrency();
  const { user, profile, refetchProfile } = useAuth();
  const [isApproved, setIsApproved] = useState<boolean>(profile?.is_approved ?? false);
  const [checkingApproval, setCheckingApproval] = useState<boolean>(profile?.is_approved === undefined);

  const { products, stats, loading: dashboardLoading, recentOrders, weekly } = useSellerDashboard(user?.id);

  const pendingOrdersCount = useMemo(() => (recentOrders || []).filter((o) => o.status === "pending" || o.status === "processing").length, [recentOrders]);
  const activeProductCount = useMemo(() => products.filter((product) => product.status === "active").length, [products]);
  const inventoryUnits = useMemo(() => products.reduce((total, product) => total + Math.max(0, Number(product.stock_quantity) || 0), 0), [products]);
  const ratedProducts = useMemo(() => products.filter((product) => Number(product.review_count) > 0), [products]);
  const averageRating = useMemo(() => {
    if (!ratedProducts.length) return null;
    return ratedProducts.reduce((total, product) => total + Number(product.average_rating || 0), 0) / ratedProducts.length;
  }, [ratedProducts]);
  const orderPipeline = useMemo(() => [
    { label: "To process", value: recentOrders.filter((order) => order.status === "pending"), className: "bg-yellow-500" },
    { label: "Processing", value: recentOrders.filter((order) => order.status === "processing"), className: "bg-blue-500" },
    { label: "Shipped", value: recentOrders.filter((order) => order.status === "shipped"), className: "bg-violet-500" },
    { label: "Delivered", value: recentOrders.filter((order) => order.status === "delivered"), className: "bg-emerald-500" },
  ], [recentOrders]);
  const moderationQueue = useMemo(() => buildProductModerationQueue(products), [products]);
  const attentionItems = useMemo(() => [
    stats.pendingApproval > 0 ? { label: `${stats.pendingApproval} product${stats.pendingApproval > 1 ? "s" : ""} awaiting approval`, href: "/seller/products", icon: Clock } : null,
    stats.outOfStock > 0 ? { label: `${stats.outOfStock} product${stats.outOfStock > 1 ? "s are" : " is"} out of stock`, href: "/seller/products", icon: AlertTriangle } : null,
    pendingOrdersCount > 0 ? { label: `${pendingOrdersCount} order${pendingOrdersCount > 1 ? "s need" : " needs"} your attention`, href: "/seller/orders", icon: ShoppingCart } : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Clock }>, [pendingOrdersCount, stats.outOfStock, stats.pendingApproval]);

  useEffect(() => {
    if (!user) return;

    let isCancelled = false;
    const intervalIdRef: { current: number | undefined } = { current: undefined };

    const userId = user.id;

    const tryReadApproval = async (): Promise<boolean> => {
      const { data: byUserId } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("user_id", userId)
        .maybeSingle();

      if (typeof byUserId?.is_approved === "boolean") return byUserId.is_approved;

      const { data: byId } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", userId)
        .maybeSingle();

      return byId?.is_approved === true;
    };

    const runOnce = async () => {
      if (isCancelled) return;
      if (isApproved) {
        setCheckingApproval(false);
        if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
        return;
      }

      try {
        const approvedNow = await tryReadApproval();
        if (isCancelled) return;

        if (approvedNow) {
          setIsApproved(true);
          await refetchProfile();
          setCheckingApproval(false);
          if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
        }
      } catch {
        // keep UI stable on errors
      }
    };

    setCheckingApproval(profile?.is_approved === undefined);

    if (profile?.is_approved === undefined) {
      runOnce();
      intervalIdRef.current = window.setInterval(() => runOnce(), 4000);
      return () => {
        isCancelled = true;
        if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
      };
    }

    if (profile?.is_approved === true) {
      setIsApproved(true);
      setCheckingApproval(false);
    } else {
      setCheckingApproval(false);
    }

    return () => {
      isCancelled = true;
      if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
    };
  }, [user, isApproved, profile?.is_approved, refetchProfile]);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    delivered: "bg-success/10 text-success border-success/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const loading = dashboardLoading;
  const showChecking = Boolean(checkingApproval || (loading && (!products.length && !stats.totalRevenue)));

  const statCards = [
    { label: "Total Revenue", value: formatPrice(stats.totalRevenue || 0), icon: DollarSign, cardClass: "stat-card stat-card-seller" },
    { label: "Live Products", value: String(activeProductCount), icon: Package, cardClass: "stat-card" },
    { label: "Units in Stock", value: inventoryUnits.toLocaleString(), icon: Boxes, cardClass: "stat-card" },
    { label: "Pending Approval", value: String(stats.pendingApproval || 0), icon: Clock, cardClass: (stats.pendingApproval || 0) > 0 ? "stat-card stat-card-destructive" : "stat-card" },
    { label: "Pending Orders", value: String(pendingOrdersCount), icon: ShoppingCart, cardClass: pendingOrdersCount > 0 ? "stat-card stat-card-buyer" : "stat-card" },
    { label: "Store Rating", value: averageRating === null ? "New" : `${averageRating.toFixed(1)} / 5`, icon: Star, cardClass: "stat-card" },
  ];

  const quickActions = [
    { label: "Add Product", icon: Plus, href: "/seller/products", gradient: "gradient-seller", desc: "List new item" },
    { label: "View Orders", icon: ShoppingCart, href: "/seller/orders", gradient: "gradient-primary", desc: "Manage orders" },
    { label: "My Store", icon: Store, href: `/seller/${user?.id}`, gradient: "gradient-buyer", desc: "Preview storefront" },
    { label: "Run Ad", icon: Megaphone, href: "/seller/ads", gradient: "gradient-admin", desc: "Boost visibility" },
    { label: "Withdraw", icon: Wallet, href: "/seller/wallet", gradient: "gradient-primary", desc: "Cash out earnings" },
  ];

  if (showChecking) {
    return (
      <div className="space-y-8">
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          Checking approval...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">
              {profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}` : 'Seller Dashboard'}
            </h1>
            <p className="mt-1 text-muted-foreground">Your store performance at a glance</p>
          </div>
          <Link to="/seller/products">
            <Button className="gap-2 gradient-seller text-primary-foreground shadow-glow-seller">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </Link>
        </div>
      </AnimatedSection>

      {(stats.pendingApproval || 0) > 0 && (
        <AnimatedSection variant="fade-up" delay={30}>
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
            <div>
              <p className="font-medium text-foreground text-sm">{stats.pendingApproval} product{(stats.pendingApproval || 0) > 1 ? "s" : ""} pending admin approval</p>
              <p className="text-xs text-muted-foreground">Products will be visible on the marketplace once approved</p>
            </div>
          </div>
        </AnimatedSection>
      )}

      {moderationQueue.length > 0 && (
        <AnimatedSection variant="fade-up" delay={40}>
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 font-display">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Listing review queue
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Every item shows who must act and what happens next.</p>
              </div>
              <Link to="/seller/products" className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground">Manage listings</Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {moderationQueue.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge className={item.state === "changes_requested" ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"}>
                          {item.state === "changes_requested" ? "Changes requested" : "Waiting for review"}
                        </Badge>
                        <span>{formatModerationAge(item.waitingSince)}</span>
                        <span>Owner: {item.ownerLabel}</span>
                      </div>
                    </div>
                    <Link to="/seller/products" className="shrink-0">
                      <Button size="sm" variant="outline" className="gap-1">
                        {item.state === "changes_requested" ? "Update listing" : "View listing"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Why:</span> {item.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground"><span className="font-medium text-foreground">Next:</span> {item.nextAction}</p>
                </div>
              ))}
              {moderationQueue.length > 4 && <p className="text-center text-xs text-muted-foreground">+{moderationQueue.length - 4} more listings in review</p>}
            </CardContent>
          </Card>
        </AnimatedSection>
      )}

      {(stats.lowStock > 0 || stats.outOfStock > 0) && (
        <AnimatedSection variant="fade-up" delay={45}>
          <div className="flex flex-col gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div>
                <p className="font-medium text-foreground text-sm">Inventory needs attention</p>
                <p className="text-xs text-muted-foreground">
                  {stats.outOfStock > 0 ? `${stats.outOfStock} out of stock` : ""}{stats.outOfStock > 0 && stats.lowStock > 0 ? " / " : ""}{stats.lowStock > 0 ? `${stats.lowStock} low in stock` : ""}.
                </p>
              </div>
            </div>
            <Link to="/seller/products"><Button size="sm" variant="outline">Review inventory <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
          </div>
        </AnimatedSection>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      <div className="grid gap-6 lg:grid-cols-5">
        <AnimatedSection variant="fade-up" delay={120} className="lg:col-span-3">
          <Card className="h-full border-border/60">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
              <div>
                <CardTitle className="font-display">Store health</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Keep the next important seller task visible.</p>
              </div>
              {attentionItems.length === 0 ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
            </CardHeader>
            <CardContent>
              {attentionItems.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Everything looks up to date</p>
                    <p className="mt-1 text-xs text-muted-foreground">Your listings and recent orders have no urgent actions.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {attentionItems.map((item) => (
                    <Link key={item.label} to={item.href} className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-muted/40">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-foreground">{item.label}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection variant="fade-up" delay={150} className="lg:col-span-2">
          <Card className="h-full border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-display">Recent order pipeline</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Based on your latest orders</p>
                </div>
                <Link to="/seller/orders" className="text-xs font-medium text-muted-foreground hover:text-foreground">View all</Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {orderPipeline.map((stage) => (
                  <div key={stage.label} className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${stage.className}`} />
                    <span className="flex-1 text-sm text-muted-foreground">{stage.label}</span>
                    <span className="text-sm font-semibold text-foreground">{stage.value.length}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>

      <AnimatedSection variant="fade-up" delay={150}>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-display">Revenue - last 7 days</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">From delivered orders</p>
            </div>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <Suspense fallback={<div className="h-full animate-pulse rounded-lg bg-muted/40" />}>
                <SellerRevenueChart weekly={weekly} />
              </Suspense>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>

      <div className="grid gap-6 lg:grid-cols-3">
        <AnimatedSection variant="fade-up" delay={200} className="lg:col-span-2">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Recent Orders</CardTitle>
              <Link to="/seller/orders">
                <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">View All <ArrowRight className="h-3 w-3" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/40 mb-4" />
                  <p className="text-sm text-muted-foreground">No orders yet. Orders will appear as buyers purchase your products.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map(order => (
                    <div key={order.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground">#{order.id.slice(0, 8)}</p>
                        <p className="truncate text-xs text-muted-foreground">from {order.buyer_name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                        <span className="font-semibold text-sm text-foreground">{formatPrice(Number(order.total_amount))}</span>
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
        <OffersReceivedCard />
      </AnimatedSection>
    </div>
  );
}
