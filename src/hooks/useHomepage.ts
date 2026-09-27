import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery, supabaseKeys } from "./useSupabaseQuery";
import { fetchHeroCollections } from "@/lib/collectionResolver";
import type { EnhancedCollection } from "@/lib/collectionResolver";

// ── Types ────────────────────────────────────────────────────────────────
export type Product = { id: string; title: string; price: number; compare_at_price: number | null; currency: string; seller_id: string; stock_quantity: number; average_rating: number; review_count: number; ships_to: string[] | null; flash_deal_end_at: string | null; product_images: { image_url: string; is_primary: boolean }[] };
export type Category = { id: string; name: string; slug: string; image_url?: string | null };
export type Seller = { full_name: string | null; is_verified: boolean };
export type FeedItem = Product & { sold_count: number; trend_score: number };
export type FeedName = "flash_deals" | "best_sellers" | "new_arrivals" | "trending" | "recommended";

// Homepage sections, defined by translation key rather than by literal text so a French
// visitor sees French headings. Only evidence-based sections are listed first: Best
// Sellers needs delivered units, Trending needs real visits, Flash Deals needs a live
// deal. The final "All products" entry is the catch-all - it lists every approved
// product that no section claimed, newest first and uncapped, so nothing is ever
// hidden from a shopper. A "Discover More" section was removed because with a young
// catalogue every rating is 0, so it was only ever the leftovers under a heading that
// told a shopper nothing.
export const FEEDS: { key: FeedName; titleKey: string; subtitleKey: string; href: string; emptyKey: string }[] = [
  { key: "best_sellers", titleKey: "home.bestSellers", subtitleKey: "home.bestSellersSubtitle", href: "/marketplace?sort=best_sellers", emptyKey: "home.bestSellersEmpty" },
  { key: "trending", titleKey: "home.trending", subtitleKey: "home.trendingSubtitle", href: "/marketplace?sort=trending", emptyKey: "home.trendingEmpty" },
  { key: "new_arrivals", titleKey: "home.allProducts", subtitleKey: "home.allProductsSubtitle", href: "/marketplace?sort=newest", emptyKey: "home.allProductsEmpty" },
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
        supabase.from("categories").select("id,name,slug,image_url").order("sort_order"),
        (supabase as any).rpc("homepage_category_counts"),
      ]);
      const categories = (categoriesRes.data ?? []) as Category[];
      const counts = Object.fromEntries(
        ((countsRes.data ?? []) as any[]).map((row: any) => [row.category_id, Number(row.product_count)])
      );

      // Departments carry no artwork of their own: categories.image_url is null for
      // every seeded row, so a department card shows the first approved product
      // listed in it. Only departments that actually have stock render a card, so
      // the lookup is restricted to those ids and to a handful of products rather
      // than scanning the whole catalogue.
      const populatedIds = categories.filter((category) => (counts[category.id] ?? 0) > 0).map((category) => category.id);
      const imageByCategory: Record<string, string> = {};
      if (populatedIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("category_id, product_images(image_url, is_primary)")
          .eq("status", "active")
          .eq("is_approved", true)
          .in("category_id", populatedIds)
          .limit(12);
        for (const product of (products ?? []) as any[]) {
          if (!product?.category_id || imageByCategory[product.category_id]) continue;
          const image = product.product_images?.find((item: any) => item.is_primary)?.image_url || product.product_images?.[0]?.image_url;
          if (image) imageByCategory[product.category_id] = image;
        }
      }

      return { categories, counts, imageByCategory };
    },
    { staleTime: 5 * 60 * 1000 },
  );
}

/**
 * Departments that actually have approved stock. The catalogue is pre-seeded with 26
 * departments so it can grow, which means most of them are empty until sellers list
 * in them. Navigation (header dropdown, category sidebar) must only offer departments a
 * shopper can actually buy from; the full directory stays on /categories.
 */
export function usePopulatedCategories() {
  const { data } = useHomepageCategories();
  return useMemo(
    () => (data?.categories ?? []).filter((category) => (data?.counts?.[category.id] ?? 0) > 0),
    [data],
  );
}

/** Raw feed data from a single RPC call (returns product IDs + metadata) */
export function useHomepageFeed(feedName: FeedName) {
  return useSupabaseQuery(
    supabaseKeys.rpcWithArgs("homepage_product_feed", { section: feedName }),
    async () => {
      const { data } = await (supabase as any).rpc("homepage_product_feed", {
        p_section: feedName,
        // Fetch a small reserve. Products that appeared in an earlier rail are
        // removed below, so later rails still have enough unique cards.
        p_limit: 24,
        // p_seed is omitted on purpose: ordering must be deterministic (see useHomepageData).
      });
      return (data ?? []) as any[];
    },
    { staleTime: 3 * 60 * 1000 },
  );
}

/** Fetch product details by IDs */
export function useProductsByIds(ids: string[]) {
  return useSupabaseQuery(
    // "byIds" segment prevents collision with per-product row keys
    // (supabaseKeys.row) when the id list happens to contain exactly one id.
    [...supabaseKeys.table("products"), "byIds", ...ids.sort()],
    async () => {
      if (ids.length === 0) return [] as Product[];
      const { data } = await supabase
        .from("products")
        .select("id,title,price,compare_at_price,currency,seller_id,stock_quantity,average_rating,review_count,ships_to,flash_deal_end_at,product_images(image_url,is_primary)")
        .in("id", ids);
      return (data ?? []) as unknown as Product[];
    },
    { enabled: ids.length > 0, staleTime: 5 * 60 * 1000 },
  );
}

/** Fetch seller profiles by user IDs */
export function useSellerProfiles(userIds: string[]) {
  return useSupabaseQuery(
    // "byIds" segment prevents collision with per-seller row keys
    [...supabaseKeys.table("seller_profiles_public"), "byIds", ...userIds.sort()],
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
  // Ordering comes from real signals only, so p_seed is deliberately left at its
  // default for every section: delivered units for Best Sellers, discovery events for
  // Trending, created_at for New Arrivals, rating for Discover More. The previous
  // per-visit random seed rotated the starting point on every refresh, which only made
  // the page look arbitrary and stopped the same product from holding the same spot.

  // Fetch all 5 feeds in parallel
  const flashDeals = useHomepageFeed("flash_deals");
  const bestSellers = useHomepageFeed("best_sellers");
  const newArrivals = useHomepageFeed("new_arrivals");
  const trending = useHomepageFeed("trending");

  const feedResults = useMemo(
    () => [flashDeals, bestSellers, newArrivals, trending] as const,
    [flashDeals, bestSellers, newArrivals, trending],
  );
  const allFeedData = useMemo(() => feedResults.flatMap(r => (Array.isArray(r.data) ? r.data : []) as any[]), [feedResults]);
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
    const productMap = new Map((Array.isArray(products.data) ? products.data : []).map(p => [p.id, p]));
    const feedNames: FeedName[] = ["flash_deals", "best_sellers", "new_arrivals", "trending"];

    // A homepage is a set of distinct merchandising stories, not five copies
    // of the same catalogue. Priority is deliberate: time-bound deals, fresh
    // stock, proven sellers, active trends, then broad discovery.
    const feedPriority: FeedName[] = ["flash_deals", "best_sellers", "trending", "new_arrivals"];
    // Budget each section. A section that qualifies for a large share of the
    // catalogue would otherwise consume every unique id through seenAcrossHomepage and
    // the later sections would render empty, so the homepage would collapse into one
    // long block. The cap keeps the stack balanced; anything left over still appears in
    // the final Discover More section, so nothing is ever hidden from shoppers.
    const SECTION_LIMIT = 10;
    // Matches the database ceiling (least(p_limit, 24)) for the catch-all section.
    const CATCH_ALL_LIMIT = 24;
    const seenAcrossHomepage = new Set<string>();
    const distinctFeeds = new Map<FeedName, FeedItem[]>();
    feedPriority.forEach((name) => {
      const index = feedNames.indexOf(name);
        const rawData = Array.isArray(feedResults[index].data) ? feedResults[index].data as any[] : [];
        const seenInRail = new Set<string>();
        const items: FeedItem[] = rawData
          .flatMap((row: any) => {
            const p = productMap.get(row.product_id);
            if (!p || seenInRail.has(p.id) || seenAcrossHomepage.has(p.id)) return [];
            seenInRail.add(p.id);
            seenAcrossHomepage.add(p.id);
            const flashDealEndAt = row.flash_deal_end_at || p.flash_deal_end_at || null;
            return [{
              ...p,
              sold_count: Number(row.sold_count),
              trend_score: Number(row.trend_score),
              flash_deal_end_at: flashDealEndAt,
            }];
          });
        // The catch-all is never capped - it is the promise that every approved product
        // is reachable from the homepage. Evidence-based sections stay bounded so one
        // broad feed cannot crowd out the rest of the page.
        distinctFeeds.set(name, items.slice(0, name === "new_arrivals" ? CATCH_ALL_LIMIT : SECTION_LIMIT));
    });
    return Object.fromEntries(feedNames.map((name) => [name, distinctFeeds.get(name) ?? []])) as Record<FeedName, FeedItem[]>;
  }, [products.data, feedResults]);

  const loading = categories.isLoading || feedLoading || products.isLoading || profiles.isLoading;

  return {
    heroSlides: hero.data ?? [],
    heroLoading: hero.isLoading,
    categories: categories.data?.categories ?? [],
    counts: categories.data?.counts ?? {},
    categoryImages: categories.data?.imageByCategory ?? {},
    feeds,
    sellers: profiles.data instanceof Map ? profiles.data : new Map<string, Seller>(),
    loading,
  };
}
