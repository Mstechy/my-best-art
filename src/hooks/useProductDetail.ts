/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery, supabaseKeys } from "./useSupabaseQuery";

// ── Types ────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  stock_quantity: number;
  seller_id: string;
  category_id: string | null;
  brand: string | null;
  weight: string | null;
  dimensions: string | null;
  material: string | null;
  color: string | null;
  condition: string | null;
  warranty: string | null;
  warranty_period: string | null;
  shipping_info: string | null;
  key_features: string[] | null;
  tags: string[] | null;
  average_rating: number;
  review_count: number;
  show_sold_count: boolean | null;
  variants: { sizes?: string[]; colors?: string[]; categoryAttributes?: Record<string, string> } | null;
  product_images: { id: string; image_url: string; is_primary: boolean }[];
}

export interface ProductDoc { id: string; url: string; label: string | null; }
export interface ProductVariant { id: string; option_values: Record<string, string>; price: number | null; stock_quantity: number; is_active: boolean; }
export interface SellerInfo { user_id: string; full_name: string | null; is_verified: boolean; avatar_url: string | null; }
export interface CategoryInfo { name: string; slug?: string | null; }
export interface ReviewData {
  id: string;
  buyer_id: string;
  reviewer_name: string;
  buyer_country: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  created_at: string;
  photos: { url: string }[];
  seller_reply: string | null;
  pinned: boolean;
}
export interface KeywordItem { keyword: string; count: number; }

// ── Individual hooks ─────────────────────────────────────────────────────

/** Fetch the main product by ID */
export function useProduct(id: string | undefined) {
  return useSupabaseQuery(
    supabaseKeys.row("products", id ?? ""),
    async () => {
      if (!id) throw new Error("No product ID");
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as Product;
    },
    { enabled: !!id, staleTime: 5 * 60 * 1000 },
  );
}

/** Fetch seller profile */
export function useProductSeller(sellerId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("seller_profiles_public"), sellerId ?? ""],
    async () => {
      if (!sellerId) throw new Error("No seller ID");
      const { data } = await supabase
        .from("seller_profiles_public")
        .select("user_id, full_name, is_verified, avatar_url")
        .eq("user_id", sellerId)
        .single();
      return data as SellerInfo | null;
    },
    { enabled: !!sellerId, staleTime: 10 * 60 * 1000 },
  );
}

/** Fetch category for a product */
export function useProductCategory(categoryId: string | undefined | null) {
  return useSupabaseQuery(
    [...supabaseKeys.table("categories"), categoryId ?? ""],
    async () => {
      if (!categoryId) return null;
      const { data } = await supabase
        .from("categories")
        .select("name, slug")
        .eq("id", categoryId)
        .single();
      return data as CategoryInfo | null;
    },
    { enabled: !!categoryId, staleTime: 10 * 60 * 1000 },
  );
}

/** Fetch sold count for a product */
export function useProductSoldCount(productId: string | undefined) {
  return useSupabaseQuery(
    supabaseKeys.rpcWithArgs("product_sold_count", { id: productId ?? "" }),
    async () => {
      if (!productId) return 0;
      const { data } = await supabase.rpc("product_sold_count", { _product_id: productId });
      return Number(data ?? 0);
    },
    { enabled: !!productId, staleTime: 3 * 60 * 1000 },
  );
}

/** Fetch product documents (specs, manuals) */
export function useProductDocs(productId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("product_documents"), productId ?? ""],
    async () => {
      if (!productId) return [] as ProductDoc[];
      const { data } = await supabase.from("product_documents").select("*").eq("product_id", productId);
      return (data ?? []) as ProductDoc[];
    },
    { enabled: !!productId, staleTime: 10 * 60 * 1000 },
  );
}

/** Fetch product variants */
export function useProductVariants(productId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("product_variants"), productId ?? ""],
    async () => {
      if (!productId) return [] as ProductVariant[];
      const { data } = await supabase
        .from("product_variants")
        .select("id, option_values, price, stock_quantity, is_active")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("sort_order");
      return (data ?? []) as unknown as ProductVariant[];
    },
    { enabled: !!productId, staleTime: 5 * 60 * 1000 },
  );
}

/** Fetch seller follower count */
export function useSellerFollowerCount(sellerId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.rpc("seller_follower_count"), sellerId ?? ""],
    async () => {
      if (!sellerId) return 0;
      const { count } = await supabase
        .from("store_follows")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", sellerId);
      return count ?? 0;
    },
    { enabled: !!sellerId, staleTime: 5 * 60 * 1000 },
  );
}

/** Fetch all products by a seller (for avg rating + total sold) */
export function useSellerProducts(sellerId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("products"), "seller", sellerId ?? ""],
    async () => {
      if (!sellerId) return [] as { id: string; average_rating: number; review_count: number }[];
      const { data } = await supabase
        .from("products")
        .select("id, average_rating, review_count")
        .eq("seller_id", sellerId);
      return (data ?? []) as { id: string; average_rating: number; review_count: number }[];
    },
    { enabled: !!sellerId, staleTime: 5 * 60 * 1000 },
  );
}

/** Aggregate seller total sold from order_items */
export function useSellerTotalSold(productIds: string[]) {
  return useSupabaseQuery(
    [...supabaseKeys.rpc("seller_total_sold"), ...productIds.sort()],
    async () => {
      if (productIds.length === 0) return 0;
      const { data } = await supabase
        .from("order_items")
        .select("quantity, orders!inner(status)")
        .in("product_id", productIds)
        .eq("orders.status", "delivered");
      return ((data ?? []) as { quantity: number }[]).reduce((s, r) => s + (r.quantity || 0), 0);
    },
    { enabled: productIds.length > 0, staleTime: 3 * 60 * 1000 },
  );
}

/** Fetch reviews for a product */
export function useProductReviews(productId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.table("reviews"), productId ?? ""],
    async () => {
      if (!productId) return [] as ReviewData[];
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });
      if (!data) return [];

      const list = data as unknown as { id: string; buyer_id: string; rating: number; title: string | null; comment: string | null; created_at: string; is_verified_purchase: boolean; subrating_communication: number | null; subrating_description: number | null; subrating_shipping: number | null }[];
      const buyerIds = [...new Set(list.map(r => r.buyer_id))];
      const reviewIds = list.map(r => r.id);

      const [{ data: profiles }, { data: photos }, { data: replies }, { data: pins }] = await Promise.all([
        buyerIds.length ? (supabase as any).from("buyer_profiles_public").select("user_id, full_name, country").in("user_id", buyerIds) : Promise.resolve({ data: [] }),
        supabase.from("review_photos").select("*").in("review_id", reviewIds),
        supabase.from("review_replies").select("*").in("review_id", reviewIds),
        supabase.from("review_pins").select("review_id").in("review_id", reviewIds),
      ]);

      const nameMap: Record<string, { name: string; country: string | null }> = {};
      (profiles || []).forEach((p: { user_id: string; full_name: string | null; country: string | null }) => { nameMap[p.user_id] = { name: p.full_name || "Buyer", country: p.country || null }; });
      const photoMap: Record<string, { url: string }[]> = {};
      (photos || []).forEach((p: { review_id: string; url: string }) => { (photoMap[p.review_id] ||= []).push({ url: p.url }); });
      const replyMap: Record<string, string> = {};
      (replies || []).forEach((r: { review_id: string; body: string }) => { replyMap[r.review_id] = r.body; });
      const pinSet = new Set((pins || []).map((p: { review_id: string }) => p.review_id));

      const mapped: ReviewData[] = list.map(r => ({
        id: r.id,
        buyer_id: r.buyer_id,
        reviewer_name: nameMap[r.buyer_id]?.name || "Buyer",
        buyer_country: nameMap[r.buyer_id]?.country || null,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        is_verified_purchase: r.is_verified_purchase,
        created_at: r.created_at,
        photos: photoMap[r.id] || [],
        seller_reply: replyMap[r.id] || null,
        pinned: pinSet.has(r.id),
      }));
      mapped.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
      return mapped;
    },
    { enabled: !!productId, staleTime: 2 * 60 * 1000 },
  );
}

/** Fetch review keywords */
export function useProductKeywords(productId: string | undefined) {
  return useSupabaseQuery(
    supabaseKeys.rpcWithArgs("product_review_keywords", { id: productId ?? "" }),
    async () => {
      if (!productId) return [] as KeywordItem[];
      const { data } = await supabase.rpc("product_review_keywords", { _product_id: productId });
      return (data ?? []) as KeywordItem[];
    },
    { enabled: !!productId, staleTime: 10 * 60 * 1000 },
  );
}

/** Check if current user can review this product */
export function useCanReview(productId: string | undefined, userId: string | undefined) {
  return useSupabaseQuery(
    [...supabaseKeys.rpc("can_review"), productId ?? "", userId ?? ""],
    async () => {
      if (!productId || !userId) return { canReview: false, alreadyReviewed: false };
      const { data: items } = await supabase.from("order_items").select("order_id").eq("product_id", productId);
      const oids = [...new Set((items || []).map((i: { order_id: string | null }) => i.order_id).filter(Boolean))];
      if (oids.length === 0) return { canReview: false, alreadyReviewed: false };
      const { data: delivered } = await supabase
        .from("orders").select("id").eq("buyer_id", userId).eq("status", "delivered").in("id", oids).limit(1).maybeSingle();
      const { data: existing } = await supabase
        .from("reviews").select("id").eq("product_id", productId).eq("buyer_id", userId).limit(1).maybeSingle();
      return { canReview: !!delivered, alreadyReviewed: !!existing };
    },
    { enabled: !!productId && !!userId, staleTime: 30 * 1000 }, // short TTL — state changes after user submits review
  );
}

// ── Composed hook ────────────────────────────────────────────────────────

export function useProductDetailData(productId: string | undefined) {
  const product = useProduct(productId);
  const sellerId = product.data?.seller_id;
  const categoryId = product.data?.category_id;

  const seller = useProductSeller(sellerId);
  const category = useProductCategory(categoryId);
  const soldCount = useProductSoldCount(productId);
  const docs = useProductDocs(productId);
  const variants = useProductVariants(productId);
  const sellerFollowerCount = useSellerFollowerCount(sellerId);
  const sellerProducts = useSellerProducts(sellerId);
  const reviews = useProductReviews(productId);
  const keywords = useProductKeywords(productId);

  // Aggregate seller stats
  const sellerProductIds = useMemo(
    () => (sellerProducts.data ?? []).map(p => p.id),
    [sellerProducts.data],
  );
  const sellerTotalSold = useSellerTotalSold(sellerProductIds);
  const sellerAvgRating = useMemo(() => {
    const prods = sellerProducts.data ?? [];
    const totalReviews = prods.reduce((s, p) => s + (p.review_count || 0), 0);
    const weighted = prods.reduce((s, p) => s + (p.average_rating || 0) * (p.review_count || 0), 0);
    return totalReviews > 0 ? weighted / totalReviews : 0;
  }, [sellerProducts.data]);

  const loading = product.isLoading || seller.isLoading || category.isLoading ||
    soldCount.isLoading || docs.isLoading || variants.isLoading ||
    sellerFollowerCount.isLoading || sellerProducts.isLoading || reviews.isLoading || keywords.isLoading;

  return {
    product,
    seller,
    category,
    soldCount,
    docs,
    variants,
    reviews,
    keywords,
    sellerFollowerCount,
    sellerAvgRating,
    sellerTotalSold,
    loading,
  };
}