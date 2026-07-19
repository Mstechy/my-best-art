/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState, memo } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Package, Sparkles, Star } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import PromoBanner from "@/components/PromoBanner";
import MarqueeBanner from "@/components/MarqueeBanner";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/product/ProductImage";
import HeroSlider from "@/components/HeroSlider";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { fetchHeroCollections } from "@/lib/collectionResolver";
import type { EnhancedCollection } from "@/lib/collectionResolver";

type Product = { id: string; title: string; price: number; compare_at_price: number | null; currency: string; seller_id: string; average_rating: number; review_count: number; ships_to: string[] | null; product_images: { image_url: string; is_primary: boolean }[] };
type Category = { id: string; name: string; slug: string };
type Seller = { full_name: string | null; is_verified: boolean };
type FeedItem = Product & { sold_count: number; trend_score: number };
type FeedName = "flash_deals" | "best_sellers" | "new_arrivals" | "trending" | "recommended";

const FEEDS: { key: FeedName; title: string; href: string; empty: string }[] = [
  { key: "flash_deals", title: "Flash Deals", href: "/marketplace?promo=summer20", empty: "No live deals right now." },
  { key: "best_sellers", title: "Best Sellers", href: "/marketplace?sort=best_sellers", empty: "Sales will appear here once orders are delivered." },
  { key: "new_arrivals", title: "New Arrivals", href: "/marketplace?sort=newest", empty: "New approved listings will appear here." },
  { key: "trending", title: "Trending", href: "/marketplace?sort=trending", empty: "Trending products will appear as shoppers engage with them." },
  { key: "recommended", title: "Recommended", href: "/marketplace?sort=recommended", empty: "Recommendations will appear as the catalogue grows." },
];

export default function LandingPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [heroSlides, setHeroSlides] = useState<EnhancedCollection[]>([]);
  const [feeds, setFeeds] = useState<Record<FeedName, FeedItem[]>>({ flash_deals: [], best_sellers: [], new_arrivals: [], trending: [], recommended: [] });
  const [sellers, setSellers] = useState<Record<string, Seller>>({});
  const [loading, setLoading] = useState(true);
  const [heroLoading, setHeroLoading] = useState(true);
  const { formatPrice } = useCurrency();

  // Early hero preload: triggers immediately when hero data arrives
  // All other requests continue loading in parallel
  useEffect(() => {
    // Start hero fetch early - preload happens as soon as URL is available
    fetchHeroCollections().then(heroRes => {
      if (heroRes.length > 0 && heroRes[0].image_url) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        // Use responsive image size for mobile-first LCP optimization
        const separator = heroRes[0].image_url.includes("?") ? "&" : "?";
        link.href = `${heroRes[0].image_url}${separator}width=1280&quality=85`;
        link.fetchPriority = 'high';
        // Using type assertion for image preload attributes (imagesrcset/imageSizes)
        (link as { imagesrcset?: string }).imagesrcset = `${heroRes[0].image_url}${separator}width=768&quality=85 768w, ${heroRes[0].image_url}${separator}width=1280&quality=85 1280w, ${heroRes[0].image_url}${separator}width=1920&quality=85 1920w`;
        (link as { imagesizes?: string }).imagesizes = "100vw";
        document.head.appendChild(link);
      }
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Fetch all data in parallel for maximum speed
      const [categoriesRes, countsRes, heroRes, ...feedRes] = await Promise.all([
        supabase.from("categories").select("id,name,slug").order("sort_order"),
        (supabase as any).rpc("homepage_category_counts"),
        fetchHeroCollections(),
        ...FEEDS.map(feed => (supabase as any).rpc("homepage_product_feed", { p_section: feed.key, p_limit: 10 })),
      ]);
      
      // Extract product IDs from feeds
      const ids = [...new Set(feedRes.flatMap((result: any) => (result.data || []).map((row: any) => row.product_id)))];
      
      // Extract seller IDs from feeds
      const sellerIds: string[] = [...new Set(feedRes.flatMap((result: any) => (result.data || []).map((row: any) => (row as any).seller_id)))];
      
      // Fetch products and seller profiles in parallel (not sequential!)
      const [productsRes, profilesRes] = await Promise.all([
        ids.length ? supabase.from("products").select("id,title,price,compare_at_price,currency,seller_id,average_rating,review_count,ships_to,product_images(image_url,is_primary)").in("id", ids) : { data: [] },
        sellerIds.length ? supabase.from("seller_profiles_public").select("user_id,full_name,is_verified").in("user_id", sellerIds) : { data: [] }
      ]);
      
      if (!mounted) return;
      
      const products = new Map(((productsRes.data || []) as unknown as Product[]).map(product => [product.id, product]));
      const profiles = new Map(((profilesRes.data || []) as any).filter((row: any) => row.user_id).map((row: any) => [row.user_id, { full_name: row.full_name, is_verified: !!row.is_verified }]));
      
      setCategories((categoriesRes.data || []) as Category[]);
      setCounts(Object.fromEntries((countsRes.data || []).map((row: any) => [row.category_id, Number(row.product_count)])));
      setHeroSlides(heroRes);
      setHeroLoading(false);
      setSellers(Object.fromEntries(profiles));
      setFeeds(Object.fromEntries(FEEDS.map((feed, index) => [feed.key, (feedRes[index].data || []).flatMap((row: any) => products.has(row.product_id) ? [{ ...products.get(row.product_id)!, sold_count: Number(row.sold_count), trend_score: Number(row.trend_score) }] : [])])) as Record<FeedName, FeedItem[]>);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const visibleCategories = useMemo(() => categories.filter(category => counts[category.id] > 0).slice(0, 8), [categories, counts]);
  return <div className="min-h-screen bg-[#FAFAFA] font-sans text-[#111111] antialiased dark:bg-[#111111] dark:text-[#FAF5F2]">
    <MarketplaceNavbar categories={categories.map(category => ({ label: category.name, value: category.id }))} />
    <CartDrawer /><PromoBanner /><MarqueeBanner />
    <main className="pb-16">
      {/* Hero Slider — uses hero-enabled collections */}
      {heroLoading ? (
        <div className="border-b border-[#E8E8E8] bg-[#F8F3F0] dark:border-[#222222] dark:bg-[#1C1C1E]">
          <div className="mx-auto aspect-[21/9] min-h-[320px] animate-pulse bg-[#F2F3F5] dark:bg-[#202020] md:min-h-[420px]" />
        </div>
      ) : heroSlides.length > 0 ? (
        <HeroSlider slides={heroSlides} />
      ) : (
        <section className="border-b border-[#E8E8E8] bg-[#F8F3F0] dark:border-[#222222] dark:bg-[#1C1C1E]">
          <div className="mx-auto flex aspect-[21/9] min-h-[320px] items-center justify-center md:min-h-[420px]">
            <div className="text-center">
              <Sparkles className="mx-auto mb-3 h-9 w-9 text-[#F6C75D]" />
              <p className="font-semibold text-lg">Campaigns appear here when published</p>
              <p className="mt-1 text-sm text-muted-foreground">Manage hero slides in Admin → Collections.</p>
            </div>
          </div>
        </section>
      )}
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#888880]">Browse</p><h2 className="mt-1 text-2xl font-bold">Shop by category</h2></div><Link to="/categories" className="text-sm font-semibold hover:underline">All categories</Link></div>
        {loading ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-[#F2F3F5] dark:bg-[#202020]" />)}</div> : visibleCategories.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{visibleCategories.map(category => <Link key={category.id} to={`/categories/${category.slug}`} className="rounded-2xl border border-[#E8E8E8] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#222222] dark:bg-[#1A1A1A]"><Package className="mb-6 h-6 w-6 text-[#F6C75D]" /><p className="font-semibold">{category.name}</p><p className="mt-1 text-xs text-[#888880]">{counts[category.id]} {counts[category.id] === 1 ? "product" : "products"}</p></Link>)}</div> : <Empty text="Categories will appear when approved products are available." />}
      </section>
      {FEEDS.map(feed => <section key={feed.key} className="mx-auto max-w-7xl px-4 py-7 lg:px-8"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold">{feed.title}</h2><Link to={feed.href} className="text-sm font-semibold hover:underline">View all</Link></div>{loading ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-[#F2F3F5] dark:bg-[#202020]" />)}</div> : feeds[feed.key].length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{feeds[feed.key].map(product => <ProductCard key={product.id} product={product} seller={sellers[product.seller_id]} formatPrice={formatPrice} />)}</div> : <Empty text={feed.empty} />}</section>)}
    </main><SiteFooter />
  </div>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#D8D8D2] bg-white px-5 py-10 text-center text-sm text-[#888880] dark:border-[#333333] dark:bg-[#1A1A1A]">{text}</div>; }
const ProductCard = memo(function ProductCard({ product, seller, formatPrice }: { product: FeedItem; seller?: Seller; formatPrice: (amount: number, sourceCurrency?: string) => string }) {
  const image = useMemo(() => product.product_images.find(item => item.is_primary)?.image_url || product.product_images[0]?.image_url, [product.product_images]);
  const discount = useMemo(() => product.compare_at_price && product.compare_at_price > product.price ? Math.round((1 - product.price / product.compare_at_price) * 100) : null, [product.price, product.compare_at_price]);
  return <Link to={`/product/${product.id}`} className="group overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#222222] dark:bg-[#1A1A1A]"><div className="relative aspect-square bg-[#F2F3F5] dark:bg-[#202020]">{image ? <ProductImage src={image} alt={product.title} className="group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center"><Package className="h-8 w-8 text-[#888880]" /></div>}{discount && <span className="absolute left-3 top-3 rounded bg-[#E53935] px-2 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>}</div><div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{product.title}</h3><div className="mt-2 flex items-baseline gap-2"><span className="font-bold">{formatPrice(product.price, product.currency)}</span>{product.compare_at_price && product.compare_at_price > product.price && <span className="text-xs text-[#888880] line-through">{formatPrice(product.compare_at_price, product.currency)}</span>}</div>{product.review_count > 0 && <div className="mt-2 flex items-center gap-1 text-xs text-[#666666] dark:text-[#A0A0A0]"><Star className="h-3 w-3 fill-[#F6C75D] text-[#F6C75D]" />{product.average_rating.toFixed(1)} <span>({product.review_count})</span></div>}{product.sold_count > 0 && <p className="mt-1 text-xs text-[#888880]">{product.sold_count} sold</p>}{seller && <div className="mt-2 flex items-center gap-1 border-t border-[#F2F3F5] pt-2 text-[10px] text-[#888880] dark:border-[#262626]"><span className="truncate">{seller.full_name || "Seller"}</span>{seller.is_verified && <CheckCircle2 className="h-3 w-3 shrink-0 text-[#F6C75D]" />}</div>}</div></Link>;
});
