import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupabaseQuery, supabaseKeys } from "./useSupabaseQuery";
import { fetchHeroCollections } from "@/lib/collectionResolver";
import type { EnhancedCollection } from "@/lib/collectionResolver";

// ── Types ────────────────────────────────────────────────────────────────
export type ProductImageRow = {
  image_url: string;
  is_primary: boolean;
  /** 320px WebP derivative; NULL for images uploaded before responsive cards. */
  card_small_url?: string | null;
  /**
   * Intrinsic size of the original upload, used to reserve a masonry tile's height
   * before the file loads. NULL for rows written before the dimensions were
   * captured, which the card renders as 1:1 rather than as a guess.
   */
  image_width?: number | null;
  image_height?: number | null;
};

export type Product = { id: string; title: string; price: number; compare_at_price: number | null; currency: string; seller_id: string; stock_quantity: number; average_rating: number; review_count: number; ships_to: string[] | null; flash_deal_end_at: string | null; created_at: string; product_images: ProductImageRow[] };
export type Category = { id: string; name: string; slug: string; parent_id?: string | null };
export type Seller = { full_name: string | null; is_verified: boolean };
export type FeedItem = Product & { sold_count: number; trend_score: number };
export type FeedName = "flash_deals" | "best_sellers" | "new_arrivals" | "trending" | "recommended";
const SNAPSHOT_FEED_NAMES: FeedName[] = ["flash_deals", "best_sellers", "new_arrivals", "trending"];

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
        (supabase as any).from("categories").select("id,name,slug,parent_id").order("sort_order"),
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


/** Hydrated homepage read model for future high-traffic deployments. */
export function useHomepageSnapshot() {
  return useSupabaseQuery(
    supabaseKeys.rpcWithArgs("homepage_snapshot", { limit: 24 }),
    async () => {
      const { data, error } = await (supabase as any).rpc("homepage_snapshot", { p_limit: 24 });
      if (error) throw error;
      return (data ?? {}) as Record<string, any[]>;
    },
    { staleTime: 3 * 60 * 1000 },
  );
}

/** Homepage composition backed by the hydrated snapshot. */
export function useHomepageSnapshotData() {
  const hero = useHeroCollections();
  const categories = useHomepageCategories();
  const snapshot = useHomepageSnapshot();
  const { feeds, sellers } = useMemo(() => {
    const seen = new Set<string>();
    const sellerMap = new Map<string, Seller>();
    const result = Object.fromEntries(SNAPSHOT_FEED_NAMES.map((name) => {
      const items = (snapshot.data && Array.isArray(snapshot.data[name]) ? snapshot.data[name] : [])
        // Keep the UI truthful if an older snapshot function is still deployed
        // while migrations are rolling out. The database is authoritative, but a
        // client-side guard prevents a legacy response from labeling zero-signal
        // products as Best Sellers, Trending, or Flash Deals.
        .filter((item: any) => {
          if (name === "best_sellers") return Number(item?.sold_count ?? 0) > 0;
          if (name === "trending") return Number(item?.trend_score ?? 0) > 0;
          if (name === "flash_deals") {
            return item?.flash_deal_status === "active"
              && Boolean(item?.flash_deal_start_at)
              && Boolean(item?.flash_deal_end_at)
              && Date.now() >= new Date(item.flash_deal_start_at).getTime()
              && Date.now() <= new Date(item.flash_deal_end_at).getTime();
          }
          return true;
        })
        .filter((item: any) => item?.id && !seen.has(item.id))
        .map((item: any) => {
          seen.add(item.id);
          if (item.seller_id && item.seller) sellerMap.set(item.seller_id, { full_name: item.seller.full_name ?? null, is_verified: !!item.seller.is_verified });
          return item as FeedItem;
        });
      return [name, items.slice(0, name === "new_arrivals" ? 24 : 10)];
    })) as Record<FeedName, FeedItem[]>;
    return { feeds: result, sellers: sellerMap };
  }, [snapshot.data]);

  return {
    heroSlides: hero.data ?? [],
    heroLoading: hero.isLoading,
    categories: categories.data?.categories ?? [],
    counts: categories.data?.counts ?? {},
    categoryImages: categories.data?.imageByCategory ?? {},
    feeds,
    sellers,
    snapshotError: snapshot.error,
    retrySnapshot: snapshot.refetch,
    snapshotFetching: snapshot.isFetching,
    loading: categories.isLoading || snapshot.isLoading,
  };
}
