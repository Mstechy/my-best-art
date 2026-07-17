/* Supabase schema types are generated during deployment; these two new RPCs are intentionally cast until that refresh runs. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Package, Sparkles, Star } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import PromoBanner from "@/components/PromoBanner";
import MarqueeBanner from "@/components/MarqueeBanner";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/product/ProductImage";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";

type Product = { id: string; title: string; price: number; compare_at_price: number | null; currency: string; seller_id: string; average_rating: number; review_count: number; ships_to: string[] | null; product_images: { image_url: string; is_primary: boolean }[] };
type Category = { id: string; name: string; slug: string };
type Collection = { slug: string; title: string; description: string | null; image_url: string | null; badge: string | null; cta_label: string };
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
  const [collections, setCollections] = useState<Collection[]>([]);
  const [feeds, setFeeds] = useState<Record<FeedName, FeedItem[]>>({ flash_deals: [], best_sellers: [], new_arrivals: [], trending: [], recommended: [] });
  const [sellers, setSellers] = useState<Record<string, Seller>>({});
  const [loading, setLoading] = useState(true);
  const { formatPrice } = useCurrency();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [categoriesRes, countsRes, collectionsRes, ...feedRes] = await Promise.all([
        supabase.from("categories").select("id,name,slug").order("sort_order"),
        supabase.rpc("homepage_category_counts"),
        (supabase.from("marketplace_collections") as any).select("slug,title,description,image_url,badge,cta_label").is("seller_id", null).eq("status", "active").eq("placement", "homepage").order("sort_order"),
        ...FEEDS.map(feed => (supabase as any).rpc("homepage_product_feed", { p_section: feed.key, p_limit: 10 })),
      ]);
      const ids = [...new Set(feedRes.flatMap((result: any) => (result.data || []).map((row: any) => row.product_id)))];
      const productsRes = ids.length ? await supabase.from("products").select("id,title,price,compare_at_price,currency,seller_id,average_rating,review_count,ships_to,product_images(image_url,is_primary)").in("id", ids) : { data: [] };
      const products = new Map(((productsRes.data || []) as unknown as Product[]).map(product => [product.id, product]));
      const sellerIds = [...new Set((productsRes.data || []).map((product: any) => product.seller_id))];
      const profilesRes = sellerIds.length ? await supabase.from("seller_profiles_public").select("user_id,full_name,is_verified").in("user_id", sellerIds) : { data: [] };
      if (!mounted) return;
      setCategories((categoriesRes.data || []) as Category[]);
      setCounts(Object.fromEntries((countsRes.data || []).map((row: any) => [row.category_id, Number(row.product_count)])));
      setCollections((collectionsRes.data || []) as Collection[]);
      setSellers(Object.fromEntries((profilesRes.data || []).filter((row: any) => row.user_id).map((row: any) => [row.user_id, { full_name: row.full_name, is_verified: !!row.is_verified }])));
      setFeeds(Object.fromEntries(FEEDS.map((feed, index) => [feed.key, (feedRes[index].data || []).flatMap((row: any) => products.has(row.product_id) ? [{ ...products.get(row.product_id)!, sold_count: Number(row.sold_count), trend_score: Number(row.trend_score) }] : [])])) as Record<FeedName, FeedItem[]>);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const featuredCollection = collections[0];
  const visibleCategories = useMemo(() => categories.filter(category => counts[category.id] > 0).slice(0, 8), [categories, counts]);
  return <div className="min-h-screen bg-[#FAFAFA] font-sans text-[#111111] antialiased dark:bg-[#111111] dark:text-[#FAF5F2]">
    <MarketplaceNavbar categories={categories.map(category => ({ label: category.name, value: category.id }))} />
    <CartDrawer /><PromoBanner /><MarqueeBanner />
    <main className="pb-16">
      <section className="border-b border-[#E8E8E8] bg-[#F8F3F0] dark:border-[#222222] dark:bg-[#1C1C1E]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_.8fr] lg:px-8 lg:py-16">
          <div className="flex flex-col justify-center">
            {featuredCollection?.badge && <span className="mb-4 w-fit rounded-full bg-[#F6C75D] px-3 py-1 text-xs font-bold text-[#5C3A00]">{featuredCollection.badge}</span>}
            <h1 className="max-w-2xl text-4xl font-black uppercase leading-none tracking-tight md:text-6xl">{featuredCollection?.title || "Discover products from real sellers"}</h1>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#666666] dark:text-[#A0A0A0]">{featuredCollection?.description || "Browse live listings, verified seller details, and product information supplied by the marketplace."}</p>
            <Link to={featuredCollection ? `/collections/${featuredCollection.slug}` : "/marketplace"} className="mt-7 w-fit rounded-full bg-[#111111] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#333333] dark:bg-[#FAF5F2] dark:text-[#111111]">{featuredCollection?.cta_label || "Browse marketplace"}</Link>
          </div>
          {featuredCollection?.image_url ? <img src={featuredCollection.image_url} alt={featuredCollection.title} className="aspect-[16/10] w-full rounded-3xl object-cover shadow-sm" fetchPriority="high" /> : <div className="flex aspect-[16/10] items-center justify-center rounded-3xl border border-[#E8E8E8] bg-white p-8 text-center dark:border-[#333333] dark:bg-[#181818]"><div><Sparkles className="mx-auto mb-3 h-9 w-9 text-[#F6C75D]" /><p className="font-semibold">Campaigns appear here when published</p><p className="mt-1 text-sm text-muted-foreground">Manage homepage banners in Admin → Collections.</p></div></div>}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#888880]">Browse</p><h2 className="mt-1 text-2xl font-bold">Shop by category</h2></div><Link to="/categories" className="text-sm font-semibold hover:underline">All categories</Link></div>
        {loading ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-[#F2F3F5] dark:bg-[#202020]" />)}</div> : visibleCategories.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{visibleCategories.map(category => <Link key={category.id} to={`/categories/${category.slug}`} className="rounded-2xl border border-[#E8E8E8] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#222222] dark:bg-[#1A1A1A]"><Package className="mb-6 h-6 w-6 text-[#F6C75D]" /><p className="font-semibold">{category.name}</p><p className="mt-1 text-xs text-[#888880]">{counts[category.id]} {counts[category.id] === 1 ? "product" : "products"}</p></Link>)}</div> : <Empty text="Categories will appear when approved products are available." />}
      </section>
      {FEEDS.map(feed => <section key={feed.key} className="mx-auto max-w-7xl px-4 py-7 lg:px-8"><div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-bold">{feed.title}</h2><Link to={feed.href} className="text-sm font-semibold hover:underline">View all</Link></div>{loading ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl bg-[#F2F3F5] dark:bg-[#202020]" />)}</div> : feeds[feed.key].length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{feeds[feed.key].map(product => <ProductCard key={product.id} product={product} seller={sellers[product.seller_id]} formatPrice={formatPrice} />)}</div> : <Empty text={feed.empty} />}</section>)}
    </main><SiteFooter />
  </div>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#D8D8D2] bg-white px-5 py-10 text-center text-sm text-[#888880] dark:border-[#333333] dark:bg-[#1A1A1A]">{text}</div>; }
function ProductCard({ product, seller, formatPrice }: { product: FeedItem; seller?: Seller; formatPrice: (amount: number, sourceCurrency?: string) => string }) {
  const image = product.product_images.find(item => item.is_primary)?.image_url || product.product_images[0]?.image_url;
  const discount = product.compare_at_price && product.compare_at_price > product.price ? Math.round((1 - product.price / product.compare_at_price) * 100) : null;
  return <Link to={`/product/${product.id}`} className="group overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#222222] dark:bg-[#1A1A1A]"><div className="relative aspect-square bg-[#F2F3F5] dark:bg-[#202020]">{image ? <ProductImage src={image} alt={product.title} className="group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center"><Package className="h-8 w-8 text-[#888880]" /></div>}{discount && <span className="absolute left-3 top-3 rounded bg-[#E53935] px-2 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>}</div><div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{product.title}</h3><div className="mt-2 flex items-baseline gap-2"><span className="font-bold">{formatPrice(product.price, product.currency)}</span>{product.compare_at_price && product.compare_at_price > product.price && <span className="text-xs text-[#888880] line-through">{formatPrice(product.compare_at_price, product.currency)}</span>}</div>{product.review_count > 0 && <div className="mt-2 flex items-center gap-1 text-xs text-[#666666] dark:text-[#A0A0A0]"><Star className="h-3 w-3 fill-[#F6C75D] text-[#F6C75D]" />{product.average_rating.toFixed(1)} <span>({product.review_count})</span></div>}{product.sold_count > 0 && <p className="mt-1 text-xs text-[#888880]">{product.sold_count} sold</p>}{seller && <div className="mt-2 flex items-center gap-1 border-t border-[#F2F3F5] pt-2 text-[10px] text-[#888880] dark:border-[#262626]"><span className="truncate">{seller.full_name || "Seller"}</span>{seller.is_verified && <CheckCircle2 className="h-3 w-3 shrink-0 text-[#F6C75D]" />}</div>}</div></Link>;
}
