import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery, supabaseKeys } from "./useSupabaseQuery";
import { fetchHeroCollections } from "@/lib/collectionResolver";
import type { EnhancedCollection } from "@/lib/collectionResolver";

// ── Types ────────────────────────────────────────────────────────────────
export type Product = { id: string; title: string; price: number; compare_at_price: number | null; currency: string; seller_id: string; average_rating: number; review_count: number; ships_to: string[] | null; flash_deal_end_at: string | null; product_images: { image_url: string; is_primary: boolean }[] };
export type Category = { id: string; name: string; slug: string };
export type Seller = { full_name: string | null; is_verified: boolean };
export type FeedItem = Product & { sold_count: number; trend_score: number };
export type FeedName = "flash_deals" | "best_sellers" | "new_arrivals" | "trending" | "recommended";

export const FEEDS: { key: FeedName; title: string; subtitle: string; href: string; empty: string }[] = [
  { key: "flash_deals", title: "Flash Deals", subtitle: "Limited time offers", href: "/marketplace?promo=summer20", empty: "No live deals right now." },
  { key: "best_sellers", title: "Best Sellers", subtitle: "Most popular this week", href: "/marketplace?sort=best_sellers", empty: "Sales will appear here once orders are delivered." },
  { key: "new_arrivals", title: "New Arrivals", subtitle: "Fresh from sellers", href: "/marketplace?sort=newest", empty: "New approved listings will appear here." },
  { key: "trending", title: "Trending", subtitle: "What shoppers love", href: "/marketplace?sort=trending", empty: "Trending products will appear as shoppers engage with them." },
  { key: "recommended", title: "Recommended", subtitle: "Just for you", href: "/marketplace?sort=recommended", empty: "Recommendations will appear as the catalogue grows." },
];

// ── Individual hooks (each is independently cached by React Query) ───────

/** Hero collections (campaign slides) */
export function useHeroCollections() {
  return useSupabaseQuery(
    supabaseKeys.rpc("hero_collections"),
    async () => {
      const result = await fetchHeroCollections();
      return result as EnhancedCollection[];
    },
    { staleTime: 10 * 60 * 1000 }, // 10 min — hero rarely changes
  );
}

/** Categories with their product counts */
export function useHomepageCategories() {
  return useSupabaseQuery(
    supabaseKeys.rpc("homepage_categories"),
    async () => {
      const [categoriesRes, countsRes] = await Promise.all([
        supabase.from("categories").select("id,name,slug").order("sort_order"),
        (supabase as any).rpc("homepage_category_counts"),
      ]);
      const categories = (categoriesRes.data ?? []) as Category[];
      const counts = Object.fromEntries(
        ((countsRes.data ?? []) as any[]).map((row: any) => [row.category_id, Number(row.product_count)])
      );
      return { categories, counts };
    },
    { staleTime: 5 * 60 * 1000 },
  );
}

/** Raw feed data from a single RPC call (returns product IDs + metadata) */
export function useHomepageFeed(feedName: FeedName, discoverySeed: string) {
  return useSupabaseQuery(
    supabaseKeys.rpcWithArgs("homepage_product_feed", { section: feedName, discoverySeed }),
    async () => {
      const { data } = await (supabase as any).rpc("homepage_product_feed", {
        p_section: feedName,
        p_limit: 10,
        p_seed: discoverySeed,
      });
      return (data ?? []) as any[];
    },
    { staleTime: 3 * 60 * 1000 },
  );
}

/** Fetch product details by IDs */
export function useProductsByIds(ids: string[]) {
  return useSupabaseQuery(
    [...supabaseKeys.table("products"), ...ids.sort()],
    async () => {
      if (ids.length === 0) return [] as Product[];
      const { data } = await supabase
        .from("products")
        .select("id,title,price,compare_at_price,currency,seller_id,average_rating,review_count,ships_to,flash_deal_end_at,product_images(image_url,is_primary)")
        .in("id", ids);
      return (data ?? []) as unknown as Product[];
    },
    { enabled: ids.length > 0, staleTime: 5 * 60 * 1000 },
  );
}

/** Fetch seller profiles by user IDs */
export function useSellerProfiles(userIds: string[]) {
  return useSupabaseQuery(
    [...supabaseKeys.table("seller_profiles_public"), ...userIds.sort()],
    async () => {
      if (userIds.length === 0) return new Map<string, Seller>();
      const { data } = await supabase
        .from("seller_profiles_public")
        .select("user_id,full_name,is_verified")
        .in("user_id", userIds);
      const map = new Map<string, Seller>();
      ((data ?? []) as any[]).forEach((row: any) => {
        if (row.user_id) map.set(row.user_id, { full_name: row.full_name, is_verified: !!row.is_verified });
      });
      return map;
    },
    { enabled: userIds.length > 0, staleTime: 10 * 60 * 1000 },
  );
}

// ── Composed hook that merges all data ───────────────────────────────────

export function useHomepageData() {
  const hero = useHeroCollections();
  const categories = useHomepageCategories();
  // A new seed is created for each page visit. It lets the database begin each
  // rail at a different point in its indexed catalogue, so a browser refresh
  // reveals different inventory without an expensive ORDER BY random().
  const [discoverySeeds] = useState<Record<FeedName, string>>(() => ({
    flash_deals: crypto.randomUUID(),
    best_sellers: crypto.randomUUID(),
    new_arrivals: crypto.randomUUID(),
    trending: crypto.randomUUID(),
    recommended: crypto.randomUUID(),
  }));

  // Fetch all 5 feeds in parallel
  const flashDeals = useHomepageFeed("flash_deals", discoverySeeds.flash_deals);
  const bestSellers = useHomepageFeed("best_sellers", discoverySeeds.best_sellers);
  const newArrivals = useHomepageFeed("new_arrivals", discoverySeeds.new_arrivals);
  const trending = useHomepageFeed("trending", discoverySeeds.trending);
  const recommended = useHomepageFeed("recommended", discoverySeeds.recommended);

  const feedResults = useMemo(
    () => [flashDeals, bestSellers, newArrivals, trending, recommended] as const,
    [flashDeals, bestSellers, newArrivals, trending, recommended],
  );
  const allFeedData = useMemo(() => feedResults.flatMap(r => r.data ?? []), [feedResults]);
  const feedLoading = feedResults.some(r => r.isLoading);

  // Extract unique product IDs and seller IDs from all feeds
  const productIds = useMemo(() => {
    return [...new Set((allFeedData as any[]).map((row: any) => row.product_id).filter(Boolean))] as string[];
  }, [allFeedData]);

  const sellerIds = useMemo(() => {
    return [...new Set((allFeedData as any[]).map((row: any) => row.seller_id).filter(Boolean))] as string[];
  }, [allFeedData]);

  // Fetch products and profiles — only enabled when we have IDs
  const products = useProductsByIds(productIds);
  const profiles = useSellerProfiles(sellerIds);

  // Merge feed data with product details and seller profiles
  const feeds = useMemo(() => {
    const productMap = new Map((products.data ?? []).map(p => [p.id, p]));
    const feedNames: FeedName[] = ["flash_deals", "best_sellers", "new_arrivals", "trending", "recommended"];

    return Object.fromEntries(
      feedNames.map((name, index) => {
        const rawData = feedResults[index].data ?? [];
        const items: FeedItem[] = rawData
          .flatMap((row: any) => {
            const p = productMap.get(row.product_id);
            if (!p) return [];
            const flashDealEndAt = row.flash_deal_end_at || p.flash_deal_end_at || null;
            return [{
              ...p,
              sold_count: Number(row.sold_count),
              trend_score: Number(row.trend_score),
              flash_deal_end_at: flashDealEndAt,
            }];
          });
        return [name, items];
      })
    ) as Record<FeedName, FeedItem[]>;
  }, [products.data, feedResults]);

  const loading = categories.isLoading || feedLoading || products.isLoading || profiles.isLoading;

  return {
    heroSlides: hero.data ?? [],
    heroLoading: hero.isLoading,
    categories: categories.data?.categories ?? [],
    counts: categories.data?.counts ?? {},
    feeds,
    sellers: profiles.data ?? new Map(),
    loading,
  };
}
