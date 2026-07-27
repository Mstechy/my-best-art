/* eslint-disable @typescript-eslint/no-explicit-any */
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

export function useAdminProducts() {
  return useSupabaseQuery(
    [...supabaseKeys.table("products"), "admin"],
    async () => {
      const { data: productsData } = await supabase
        .from("products")
        .select("*, product_images(image_url, is_primary)")
        .order("created_at", { ascending: false });

      if (!productsData) return [];

      const sellerIds = [...new Set(productsData.map(p => p.seller_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", sellerIds);

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

      return mapped;
    },
    { enabled: true, staleTime: 30_000 }
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