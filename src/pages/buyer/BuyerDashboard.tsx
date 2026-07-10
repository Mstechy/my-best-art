import { useState, useEffect } from "react";
import AnimatedSection from "@/components/AnimatedSection";
import OffersSentCard from "@/components/OffersSentCard";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingCart, Truck, DollarSign, Search, MessageSquare,
  Package, Flag, ArrowRight, Shield, Star, Clock, Heart, TrendingUp, ChevronRight,
  Loader2
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = ["#F6C75D", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#3F3F46"];

export default function BuyerDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ activeOrders: 0, inTransit: 0, totalSpent: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [spendData, setSpendData] = useState<{ month: string; total: number }[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [activeTrackingOrder, setActiveTrackingOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Status badge styles
  const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-[#F6C75D]/15", text: "text-[#5C3A00] dark:text-[#F6C75D]", label: "Pending" },
    processing: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", label: "Processing" },
    shipped: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", label: "Shipped" },
    delivered: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", label: "Delivered" },
    cancelled: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-500 dark:text-red-400", label: "Cancelled" },
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      // 1. Fetch Orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, total_amount, created_at, seller_id, tracking_number, carrier, estimated_delivery")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (orders) {
        const active = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length;
        const transit = orders.filter(o => o.status === "shipped").length;
        const spent = orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        setStats({ activeOrders: active, inTransit: transit, totalSpent: spent });

        // Get most recent active order for tracking timeline
        const latestActive = orders.find(o => o.status !== "delivered" && o.status !== "cancelled");
        if (latestActive) {
          setActiveTrackingOrder(latestActive);
        }

        // Get recent 3 orders
        const recent = orders.slice(0, 3);
        if (recent.length > 0) {
          const sellerIds = [...new Set(recent.map(o => o.seller_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", sellerIds);
          const map: Record<string, string> = {};
          profiles?.forEach(p => { map[p.user_id] = p.full_name || "Unknown Seller"; });
          setRecentOrders(recent.map(o => ({ ...o, seller_name: map[o.seller_id] || "Unknown Seller" })));
        }

        // 6-month spend trend
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

        // 2. Fetch Order Items & Products to build Category Spend Breakdown
        const orderIds = orders.map(o => o.id);
        if (orderIds.length > 0) {
          const { data: items } = await supabase
            .from("order_items")
            .select("quantity, unit_price, product_id")
            .in("order_id", orderIds);

          const productIds = [...new Set((items || []).filter(i => i.product_id).map(i => i.product_id!))];
          if (productIds.length > 0) {
            const { data: products } = await supabase
              .from("products")
              .select("id, category_id")
              .in("id", productIds);

            const catIds = [...new Set((products || []).filter(p => p.category_id).map(p => p.category_id!))];
            let catMap: Record<string, string> = {};
            if (catIds.length > 0) {
              const { data: categories } = await supabase
                .from("categories")
                .select("id, name")
                .in("id", catIds);
              categories?.forEach(c => { catMap[c.id] = c.name; });
            }

            const prodToCat: Record<string, string> = {};
            products?.forEach(p => {
              if (p.category_id) {
                prodToCat[p.id] = catMap[p.category_id] || "Other";
              }
            });

            const spendByCat: Record<string, number> = {};
            items?.forEach(it => {
              if (!it.product_id) return;
              const catName = prodToCat[it.product_id] || "Other";
              const cost = (Number(it.unit_price) || 0) * (it.quantity || 1);
              spendByCat[catName] = (spendByCat[catName] || 0) + cost;
            });

            const formattedCats = Object.entries(spendByCat).map(([name, value]) => ({
              name,
              value: Math.round(value * 100) / 100
            })).sort((a, b) => b.value - a.value);

            setCategoryData(formattedCats);
          }
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const statCards = [
    {
      label: "Active Orders",
      value: String(stats.activeOrders),
      icon: ShoppingCart,
      iconBg: "bg-[#F6C75D]/10",
      iconColor: "text-[#5C3A00] dark:text-[#F6C75D]",
    },
    {
      label: "In Transit",
      value: String(stats.inTransit),
      icon: Truck,
      iconBg: "bg-[#3B82F6]/10",
      iconColor: "text-[#3B82F6]",
    },
    {
      label: "Total Spent",
      value: `$${stats.totalSpent.toFixed(2)}`,
      icon: DollarSign,
      iconBg: "bg-emerald-50 dark:bg-emerald-950/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const quickActions = [
    { label: "Browse Products", desc: "Shop unique listings", icon: Search, href: "/marketplace" },
    { label: "Track Package", desc: "Real-time updates", icon: Truck, href: "/buyer/tracking" },
    { label: "My Orders", desc: "View order logs", icon: Package, href: "/buyer/orders" },
    { label: "Wishlist", desc: "View saved items", icon: Heart, href: "/buyer/wishlist" },
    { label: "Conversations", desc: "Chat with sellers", icon: MessageSquare, href: "/buyer/chat" },
    { label: "Support Ticket", desc: "Open a dispute", icon: Flag, href: "/buyer/reports" },
  ];

  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  return (
    <div className="space-y-6 max-w-[1280px]">
      {/* Top Welcome Strip */}
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">
              {firstName ? `Welcome back, ${firstName}.` : "Your Purchase Analytics."}
            </h1>
            <p className="text-[11px] text-[#888880] dark:text-[#A0A0A0]">Everything you need to manage your orders and activity.</p>
          </div>
          <Link to="/marketplace">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-[11px] font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
              <Search className="h-3.5 w-3.5" /> Start Shopping
            </button>
          </Link>
        </div>
      </AnimatedSection>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        {statCards.map((stat, i) => (
          <AnimatedSection
            key={stat.label}
            variant="fade-up"
            delay={i * 50}
            className={i === 2 ? "col-span-2 sm:col-span-1" : ""}
          >
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">{stat.label}</p>
                <p className="mt-1 text-xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">{stat.value}</p>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.iconBg}`}>
                <stat.icon className={`h-4.5 w-4.5 ${stat.iconColor}`} />
              </div>
            </div>
          </AnimatedSection>
        ))}
      </div>

      {/* Main Grid: Columns */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">

        {/* Left Column: Analytics & Live Tracking */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Delivery Status Tracker */}
          {activeTrackingOrder && (
            <AnimatedSection variant="fade-up" delay={150}>
              <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
                <div className="flex items-center justify-between mb-4 border-b border-[#F2F3F5] dark:border-[#222222] pb-3">
                  <div>
                    <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Active Shipment Tracking</p>
                    <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] mt-0.5">Order #{activeTrackingOrder.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <Link to="/buyer/tracking" className="text-[10px] font-bold text-[#3B82F6] hover:underline flex items-center gap-0.5">
                    View Maps <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] capitalize">Status: {activeTrackingOrder.status}</p>
                    <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">
                      {activeTrackingOrder.carrier ? `${activeTrackingOrder.carrier} ` : ""}
                      {activeTrackingOrder.tracking_number ? `(${activeTrackingOrder.tracking_number})` : ""}
                    </p>
                  </div>
                  {activeTrackingOrder.estimated_delivery && (
                    <div className="text-right">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#888880]">Est. Delivery</p>
                      <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">{new Date(activeTrackingOrder.estimated_delivery).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                {/* Progress bar timeline representation */}
                <div className="mt-4 flex items-center gap-1.5">
                  {["pending", "processing", "shipped", "delivered"].map((step, idx, arr) => {
                    const currentIdx = arr.indexOf(activeTrackingOrder.status);
                    const active = idx <= currentIdx;
                    return (
                      <div key={step} className="flex-1 space-y-1">
                        <div className={`h-1.5 rounded-full ${active ? "bg-[#3B82F6]" : "bg-[#F2F3F5] dark:bg-[#2A2A2A]"}`} />
                        <p className={`text-[8px] font-semibold text-center uppercase tracking-wider ${active ? "text-[#3B82F6]" : "text-[#888880]"}`}>{step}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </AnimatedSection>
          )}

          {/* Quick Actions Grid */}
          <AnimatedSection variant="fade-up" delay={200}>
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
              <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Quick Navigation</p>
              <div className="grid gap-2 grid-cols-3">
                {quickActions.map(action => (
                  <Link key={action.label} to={action.href}>
                    <div className="flex flex-col items-start gap-2 p-3 rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#111111] hover:border-[#3B82F6] hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111] dark:bg-[#FAF5F2]">
                        <action.icon className="h-3.5 w-3.5 text-white dark:text-[#111111]" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#111111] dark:text-[#FAF5F2] leading-tight">{action.label}</p>
                        <p className="text-[8px] text-[#888880] dark:text-[#A0A0A0] leading-tight mt-0.5">{action.desc}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </AnimatedSection>

          {/* Spend trend line graph */}
          {spendData.length > 0 && !spendData.every(m => m.total === 0) && (
            <AnimatedSection variant="fade-up" delay={180}>
              <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
                <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-3">Spend Timeline</p>
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spendData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="#DBEAFE" vertical={false} className="dark:[stroke:#222222]" />
                      <XAxis dataKey="month" tick={{ fill: "#888880", fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: "#888880", fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip contentStyle={{ background: "white", border: "1px solid #E8E8E8", borderRadius: 8, fontSize: 10, color: "#111111" }} />
                      <Area type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={1.5} fill="url(#spendGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </AnimatedSection>
          )}

        </div>

        {/* Right Column: Order History, active negotiations */}
        <div className="space-y-6">

          {/* Recent Orders block */}
          <AnimatedSection variant="fade-up" delay={220}>
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#F2F3F5] dark:border-[#222222]">
                <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Order Feed</p>
                <Link to="/buyer/orders" className="text-[9px] font-bold text-[#3B82F6] hover:underline flex items-center">
                  All Logs <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#888880]">No purchases logged yet.</div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map(order => {
                    const s = statusStyle[order.status] ?? { bg: "bg-[#F2F3F5]", text: "text-[#888880]", label: order.status };
                    return (
                      <div key={order.id} className="flex items-center justify-between p-2.5 rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#111111]">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#111111] dark:text-[#FAF5F2] font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-[8px] text-[#888880] truncate">from {order.seller_name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">${Number(order.total_amount).toFixed(2)}</span>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-bold ${s.bg} ${s.text}`}>{s.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </AnimatedSection>

          {/* Active Offers / Negotiations Block */}
          <AnimatedSection variant="fade-up" delay={250}>
            <OffersSentCard />
          </AnimatedSection>

          {/* Trust Guarantees */}
          <AnimatedSection variant="fade-up" delay={280}>
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">Security & Protections</p>
              {[
                { icon: Shield, label: "Escrow-held checkout protection" },
                { icon: Star, label: "Independently verified sellers" },
                { icon: Clock, label: "24/7 direct dispute mediation" }
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-xs text-[#888880] dark:text-[#A0A0A0]">
                  <Icon className="h-3.5 w-3.5 text-[#3B82F6] shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </AnimatedSection>

        </div>

      </div>
    </div>
  );
}
