/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery, supabaseKeys } from "./useSupabaseQuery";

export interface SellerProduct {
  id: string;
  title: string;
  price: number;
  status: string;
  is_approved: boolean;
  average_rating: number;
  review_count: number;
  created_at: string;
}

export interface RecentOrder {
  id: string;
  status: string;
  total_amount: number | string;
  created_at: string;
  buyer_id: string;
  buyer_name?: string;
}

export interface DashboardStats {
  products: number;
  pendingApproval: number;
  pendingOrders: number;
  totalRevenue: number;
}

export function useSellerProducts(sellerId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("products"), sellerId ?? ""],
    async () => {
      if (!sellerId) return [];
      const { data } = await supabase
        .from("products")
        .select("id,title,price,status,is_approved,average_rating,review_count,created_at")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as SellerProduct[];
    },
    { enabled: !!sellerId, staleTime: 2 * 60 * 1000 },
  );
}

export function usePendingApprovalCount(sellerId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("products"), "pending", sellerId ?? ""],
    async () => {
      if (!sellerId) return 0;
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId)
        .eq("is_approved", false);
      return count ?? 0;
    },
    { enabled: !!sellerId, staleTime: 2 * 60 * 1000 },
  );
}

export function useSellerRecentOrders(userId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("orders"), userId ?? ""],
    async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("orders")
        .select("id,status,total_amount,created_at,buyer_id,profiles:buyer_id(full_name)")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data) return [];
      return data.map((row: any) => ({
        id: row.id,
        status: row.status,
        total_amount: row.total_amount,
        created_at: row.created_at,
        buyer_id: row.buyer_id,
        buyer_name: row.profiles?.full_name || undefined,
      })) as RecentOrder[];
    },
    { enabled: !!userId, staleTime: 1 * 60 * 1000 },
  );
}

export function useSellerRevenue(userId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("orders"), "revenue", userId ?? ""],
    async () => {
      if (!userId) return 0;
      const { data } = await supabase
        .from("orders")
        .select("total_amount,status")
        .eq("seller_id", userId)
        .eq("status", "delivered");
      return ((data ?? []) as { total_amount: number }[]).reduce((s, r) => s + (r.total_amount || 0), 0);
    },
    { enabled: !!userId, staleTime: 5 * 60 * 1000 },
  );
}

export function useSellerWeeklyRevenue(userId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("orders"), "weekly", userId ?? ""],
    async () => {
      if (!userId) return [];
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from("orders")
        .select("total_amount,created_at,status")
        .eq("seller_id", userId)
        .eq("status", "delivered")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (!data) return [];

      const byDay = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(end.getDate() - i);
        byDay.set(d.toLocaleDateString("en-US", { weekday: "short" }), 0);
      }
      (data as { total_amount: number; created_at: string }[]).forEach(row => {
        const day = new Date(row.created_at).toLocaleDateString("en-US", { weekday: "short" });
        if (byDay.has(day)) byDay.set(day, (byDay.get(day) || 0) + (row.total_amount || 0));
      });
      return Array.from(byDay.entries()).map(([day, revenue]) => ({ day, revenue }));
    },
    { enabled: !!userId, staleTime: 5 * 60 * 1000 },
  );
}

export interface SellerOrder {
  id: string;
  buyer_id: string;
  status: string;
  total_amount: number;
  currency: string;
  tracking_number: string | null;
  carrier: string | null;
  estimated_delivery: string | null;
  created_at: string;
}

export function useSellerOrders(sellerId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("orders"), sellerId ?? ""],
    async () => {
      if (!sellerId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as SellerOrder[];
    },
    { enabled: !!sellerId, staleTime: 30_000 },
  );
}

export function useSellerDashboard(userId: string | undefined) {
  const products = useSellerProducts(userId);
  const pendingApproval = usePendingApprovalCount(userId);
  const recentOrders = useSellerRecentOrders(userId);
  const revenue = useSellerRevenue(userId);
  const weekly = useSellerWeeklyRevenue(userId);

  const stats = useMemo(() => {
    const all = products.data ?? [];
    const pending = pendingApproval.data ?? 0;
    const pendingOrders = (recentOrders.data ?? []).filter((o: RecentOrder) => o.status === "pending").length;
    return {
      products: all.length,
      pendingApproval: pending,
      pendingOrders,
      totalRevenue: revenue.data ?? 0,
    } as DashboardStats;
  }, [products.data, pendingApproval.data, recentOrders.data, revenue.data]);

  const loading = products.isLoading || pendingApproval.isLoading || recentOrders.isLoading || revenue.isLoading || weekly.isLoading;

  return { products: products.data ?? [], stats, loading, recentOrders: recentOrders.data ?? [], weekly: weekly.data ?? [] };
}