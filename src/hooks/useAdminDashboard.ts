 
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery, supabaseKeys } from "./useSupabaseQuery";

export interface AdminProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export interface AdminProduct {
  id: string;
  title: string;
  price: number;
  status: string;
  is_approved: boolean;
  stock_quantity: number;
  created_at: string;
  seller_id: string;
  seller_name?: string;
  seller_email?: string;
  primary_image?: string;
}

export interface AdminSeller {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  is_verified: boolean;
  is_approved: boolean | null;
  created_at: string;
}

export interface AdminOrder {
  id: string;
  status: string;
  total_amount: number | string;
  created_at: string;
  buyer_id: string;
  seller_id: string;
  buyer_name?: string;
  seller_name?: string;
}

export function useAdminProducts(page: number, pageSize: number, search: string, tab: "all" | "pending" | "approved" | "archived") {
  return useSupabaseQuery(
    [...supabaseKeys.table("products"), "admin", page, pageSize, search, tab],
    async () => {
      const start = page * pageSize;
      let productsQuery = supabase
        .from("products")
        .select("*, product_images(image_url, is_primary)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(start, start + pageSize - 1);

      if (search.trim()) productsQuery = productsQuery.ilike("title", `%${search.trim()}%`);
      if (tab === "pending") productsQuery = productsQuery.eq("status", "active").eq("is_approved", false);
      if (tab === "approved") productsQuery = productsQuery.eq("is_approved", true);
      if (tab === "archived") productsQuery = productsQuery.eq("status", "archived");

      const [{ data: productsData, error: productsError, count }, allCount, pendingCount, approvedCount, archivedCount] = await Promise.all([
        productsQuery,
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "active").eq("is_approved", false),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("is_approved", true),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "archived"),
      ]);

      if (productsError) throw productsError;
      for (const result of [allCount, pendingCount, approvedCount, archivedCount]) {
        if (result.error) throw result.error;
      }
      if (!productsData) return { products: [], total: 0, counts: { all: 0, pending: 0, approved: 0, archived: 0 } };

      const sellerIds = [...new Set(productsData.map(p => p.seller_id))];
      const { data: profiles, error: profileError } = sellerIds.length
        ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", sellerIds)
        : { data: [], error: null };
      if (profileError) throw profileError;

      const profileMap = new Map<string, AdminProfile>();
      (profiles ?? []).forEach((p: AdminProfile) => profileMap.set(p.user_id, p));

      const mapped: AdminProduct[] = productsData.map((p) => {
        const imgs = (p as any).product_images || [];
        const primary = imgs.find((i: any) => i.is_primary) || imgs[0];
        const profile = profileMap.get(p.seller_id);
        return {
          id: p.id,
          title: p.title,
          price: p.price,
          status: p.status,
          is_approved: p.is_approved ?? false,
          stock_quantity: p.stock_quantity,
          created_at: p.created_at,
          seller_id: p.seller_id,
          seller_name: profile?.full_name || undefined,
          seller_email: profile?.email || undefined,
          primary_image: primary?.image_url,
        };
      });

      return {
        products: mapped,
        total: count ?? 0,
        counts: {
          all: allCount.count ?? 0,
          pending: pendingCount.count ?? 0,
          approved: approvedCount.count ?? 0,
          archived: archivedCount.count ?? 0,
        },
      };
    },
    { enabled: true, staleTime: 30_000, placeholderData: (previous) => previous }
  );
}

export function useAdminSellers() {
  return useSupabaseQuery(
    [...supabaseKeys.table("profiles"), "admin"],
    async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,user_id,full_name,email,is_verified,is_approved,created_at")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as AdminSeller[];
    },
    { enabled: true, staleTime: 60_000 }
  );
}

export function useAdminOrders() {
  return useSupabaseQuery(
    [...supabaseKeys.table("orders"), "admin"],
    async () => {
      const { data } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as AdminOrder[];
    },
    { enabled: true, staleTime: 30_000 }
  );
}