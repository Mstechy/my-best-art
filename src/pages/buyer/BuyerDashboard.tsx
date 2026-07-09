import { useState, useEffect } from "react";
import AnimatedSection from "@/components/AnimatedSection";
import OffersSentCard from "@/components/OffersSentCard";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingCart, Truck, DollarSign, Search, MessageSquare,
  Package, Flag, ArrowRight, Shield, Star, Clock, Heart, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export default function BuyerDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ activeOrders: 0, inTransit: 0, totalSpent: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [spendData, setSpendData] = useState<{ month: string; total: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  // Status badge style map (inline tokens)
  const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
    pending:    { bg: "bg-[#F6C75D]/15", text: "text-[#5C3A00] dark:text-[#F6C75D]", label: "Pending" },
    processing: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", label: "Processing" },
    shipped:    { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", label: "Shipped" },
    delivered:  { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", label: "Delivered" },
    cancelled:  { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-500 dark:text-red-400", label: "Cancelled" },
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

        const recent = orders.slice(0, 5);
        if (recent.length > 0) {
          const sellerIds = [...new Set(recent.map(o => o.seller_id))];
          const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", sellerIds);
          const map: Record<string, string> = {};
          profiles?.forEach(p => { map[p.user_id] = p.full_name || "Unknown Seller"; });
          setRecentOrders(recent.map(o => ({ ...o, seller_name: map[o.seller_id] || "Unknown Seller" })));
        }

        // 6-month spend chart
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
    {
      label: "Active Orders",
      value: String(stats.activeOrders),
      icon: ShoppingCart,
      iconBg: "bg-[#F6C75D]/15",
      iconColor: "text-[#5C3A00] dark:text-[#F6C75D]",
    },
    {
      label: "In Transit",
      value: String(stats.inTransit),
      icon: Truck,
      iconBg: "bg-purple-50 dark:bg-purple-900/20",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Total Spent",
      value: `$${stats.totalSpent.toFixed(2)}`,
      icon: DollarSign,
      iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const quickActions = [
    { label: "Browse", desc: "Shop products", icon: Search, href: "/marketplace" },
    { label: "Track Orders", desc: "Real-time tracking", icon: Truck, href: "/buyer/tracking" },
    { label: "My Orders", desc: "Order history", icon: Package, href: "/buyer/orders" },
    { label: "Wishlist", desc: "Saved items", icon: Heart, href: "/buyer/wishlist" },
    { label: "Messages", desc: "Chat with sellers", icon: MessageSquare, href: "/buyer/chat" },
    { label: "Report Issue", desc: "File a complaint", icon: Flag, href: "/buyer/reports" },
  ];

  const firstName = profile?.full_name?.split(" ")[0] ?? null;

  return (
    <div className="space-y-6 max-w-[1280px]">

      {/* Welcome header */}
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">
              {firstName ? `Welcome back, ${firstName}.` : "Your Dashboard."}
            </h1>
            <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">Your shopping overview for today</p>
          </div>
          <Link to="/marketplace">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
              <Search className="h-3.5 w-3.5" /> Browse Marketplace
            </button>
          </Link>
        </div>
      </AnimatedSection>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {statCards.map((stat, i) => (
          <AnimatedSection key={stat.label} variant="fade-up" delay={i * 60}>
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
              <div className="flex items-center justify-between mb-4">
                <div className={`h-1 w-6 rounded-full bg-[#F6C75D]`} />
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.iconBg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">{stat.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">{stat.value}</p>
            </div>
          </AnimatedSection>
        ))}
      </div>

      {/* Spend Chart */}
      <AnimatedSection variant="fade-up" delay={160}>
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">Spend Overview</p>
              <p className="mt-1 text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Last 6 months</p>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-[#888880]" />
              <span className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">
                ${spendData.reduce((s, m) => s + m.total, 0).toFixed(2)}
              </span>
            </div>
          </div>
          {chartLoading ? (
            <div className="h-44 animate-pulse rounded-xl bg-[#F2F3F5] dark:bg-[#111111]" />
          ) : spendData.every(m => m.total === 0) ? (
            <div className="h-44 flex flex-col items-center justify-center text-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[#888880] dark:text-[#A0A0A0]" />
              </div>
              <p className="text-xs text-[#888880] dark:text-[#A0A0A0]">No spend yet. Place your first order to see trends.</p>
            </div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F6C75D" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#F6C75D" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#E8E8E8" vertical={false} className="dark:[stroke:#222222]" />
                  <XAxis dataKey="month" tick={{ fill: "#888880", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#888880", fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      background: "white",
                      border: "1px solid #E8E8E8",
                      borderRadius: 12,
                      fontSize: 11,
                      color: "#111111",
                    }}
                    formatter={(v: number) => [`$${v.toFixed(2)}`, "Spent"]}
                  />
                  <Area type="monotone" dataKey="total" stroke="#F6C75D" strokeWidth={2} fill="url(#spendGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </AnimatedSection>

      {/* Quick Actions + Recent Orders */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Recent Orders */}
        <AnimatedSection variant="fade-up" delay={200} className="lg:col-span-2">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] h-full">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#F2F3F5] dark:border-[#222222]">
              <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Recent Orders</p>
              <Link
                to="/buyer/orders"
                className="flex items-center gap-1 text-[10px] font-semibold text-[#888880] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors"
              >
                View All <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="p-5">
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-[#888880] dark:text-[#A0A0A0]" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">No orders yet</p>
                    <p className="mt-1 text-[10px] text-[#888880] dark:text-[#A0A0A0]">Start shopping to see your orders here</p>
                  </div>
                  <Link to="/marketplace">
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[10px] font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors">
                      <Search className="h-3 w-3" /> Browse Products
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map(order => {
                    const s = statusStyle[order.status] ?? { bg: "bg-[#F2F3F5]", text: "text-[#888880]", label: order.status };
                    return (
                      <div
                        key={order.id}
                        className="flex items-center justify-between rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#111111] px-4 py-3 hover:border-[#E8E8E8] dark:hover:border-[#222222] transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] truncate">from {order.seller_name}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">${order.total_amount}</span>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${s.bg} ${s.text}`}>
                            {s.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </AnimatedSection>

        {/* Quick Actions */}
        <AnimatedSection variant="fade-up" delay={260}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] h-full">
            <div className="px-5 pt-5 pb-4 border-b border-[#F2F3F5] dark:border-[#222222]">
              <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">Quick Actions</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Link key={action.label} to={action.href}>
                  <div className="flex flex-col items-start gap-2.5 p-3.5 rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#111111] hover:border-[#E8E8E8] dark:hover:border-[#222222] hover:shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#111111] dark:bg-[#FAF5F2]">
                      <action.icon className="h-3.5 w-3.5 text-white dark:text-[#111111]" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[#111111] dark:text-[#FAF5F2] leading-tight">{action.label}</p>
                      <p className="text-[9px] text-[#888880] dark:text-[#A0A0A0] leading-tight mt-0.5">{action.desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>

      {/* Offers sent */}
      <AnimatedSection variant="fade-up" delay={300}>
        <OffersSentCard />
      </AnimatedSection>

      {/* Trust strip */}
      <AnimatedSection variant="fade-up" delay={340}>
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] px-6 py-4">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {[
              { icon: Shield, label: "Escrow Protected Payments", color: "text-[#F6C75D]" },
              { icon: Star, label: "Verified Sellers Only", color: "text-purple-400" },
              { icon: Clock, label: "24/7 Dispute Resolution", color: "text-emerald-400" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-[#888880] dark:text-[#A0A0A0]">
                <Icon className={`h-4 w-4 ${color} shrink-0`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
