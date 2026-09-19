import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Package, Search, Sparkles, Tag, Clock3 } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { BottomTabBar } from "@/components/ui/BottomTabBar";
import { fetchCollectionsByPlacement, type EnhancedCollection } from "@/lib/collectionResolver";

type Category = { id: string; name: string; slug: string; icon: string | null; image_url?: string | null; product_count?: number; };

/** Marketplace department hub. Product-rich departments lead; the complete
 * directory remains available without burying the useful places to start. */
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<EnhancedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const [{ data }, { data: categoryCounts }, categoryCollections] = await Promise.all([
        supabase.from("categories").select("id,name,slug,icon").order("sort_order"),
        (supabase as any).rpc("homepage_category_counts"),
        fetchCollectionsByPlacement("categories", 6),
      ]);
      const categoryRows = (data || []) as Category[];
      const { data: products } = categoryRows.length
        ? await supabase.from("products").select("category_id, product_images(image_url, is_primary)").eq("status", "active").eq("is_approved", true).not("category_id", "is", null).limit(200)
        : { data: [] };
      const imageByCategory = new Map<string, string>();
      (products || []).forEach((product: any) => {
        if (imageByCategory.has(product.category_id)) return;
        const image = product.product_images?.find((item: any) => item.is_primary)?.image_url || product.product_images?.[0]?.image_url;
        if (image) imageByCategory.set(product.category_id, image);
      });
      const countsByCategory = new Map<string, number>(((categoryCounts || []) as { category_id: string; product_count: number }[]).map((item) => [item.category_id, Number(item.product_count)]));
      setCategories(categoryRows.map((category) => ({ ...category, image_url: imageByCategory.get(category.id) || null, product_count: countsByCategory.get(category.id) || 0 })));
      setCollections(categoryCollections);
      setLoading(false);
    };
    void load();
  }, []);

  const liveCategories = useMemo(() => categories.filter((category) => (category.product_count || 0) > 0).sort((a, b) => (b.product_count || 0) - (a.product_count || 0)), [categories]);
  const totalLiveProducts = useMemo(() => liveCategories.reduce((total, category) => total + (category.product_count || 0), 0), [liveCategories]);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/marketplace${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ""}`);
  };

  return <div className="min-h-screen bg-[#FAFAFA] text-[#111111] dark:bg-[#121212] dark:text-[#FAF5F2]">
    <MarketplaceNavbar showSearch={false} categories={categories.map((category) => ({ label: category.name, value: category.id }))} />
    <BottomTabBar />
    <main>
      <section className="border-b border-[#E8E8E8] bg-[#1A1A1A] text-white dark:border-[#333333]">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
          <nav aria-label="Breadcrumb" className="mb-6 text-xs text-white/60"><Link to="/" className="hover:text-white hover:underline">Home</Link><span className="mx-2">/</span><span>Departments</span></nav>
          <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F6C75D]">Marketplace departments</p>
              <h1 className="mt-3 max-w-2xl text-4xl font-black uppercase tracking-tight md:text-6xl">Find products by department</h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">Start broad, then narrow by the details that matter—brand, size, condition, price, material, compatibility, and delivery destination.</p>
              <form onSubmit={submitSearch} className="mt-6 flex max-w-xl rounded-xl bg-white p-1.5 shadow-lg">
                <label className="sr-only" htmlFor="department-search">Search the marketplace</label>
                <Search className="ml-3 h-5 w-5 shrink-0 self-center text-[#666666]" />
                <input id="department-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, brands, or models" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[#111111] outline-none" />
                <button type="submit" className="rounded-lg bg-[#F6C75D] px-4 py-2 text-sm font-bold text-[#111111] hover:bg-[#E8A93D]">Search</button>
              </form>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/15 bg-white/5 p-4"><p className="text-2xl font-black">{totalLiveProducts}</p><p className="mt-1 text-xs text-white/65">approved products to browse</p></div>
              <div className="rounded-xl border border-white/15 bg-white/5 p-4"><p className="text-2xl font-black">{liveCategories.length}</p><p className="mt-1 text-xs text-white/65">departments with live inventory</p></div>
              <Link to="/marketplace?sort=newest" className="col-span-2 flex items-center justify-between rounded-xl bg-[#F6C75D] p-4 text-[#111111] transition hover:bg-[#E8A93D]"><span><Clock3 className="mb-2 h-5 w-5" /><span className="block text-sm font-bold">See new arrivals</span></span><ArrowRight className="h-5 w-5" /></Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
        {loading ? <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl bg-muted" />)}</div> : liveCategories.length === 0 ? <div className="rounded-2xl border bg-card p-10 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Departments are being prepared.</p><Link to="/marketplace" className="mt-3 inline-flex items-center gap-2 text-sm underline">Browse all products <ArrowRight className="h-4 w-4" /></Link></div> : <>
          <section aria-labelledby="live-departments">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#888880]">Start here</p><h2 id="live-departments" className="mt-1 text-3xl font-black tracking-tight">Popular departments</h2></div><Link to="/marketplace" className="inline-flex items-center gap-1 text-sm font-semibold underline">Browse all products <ArrowRight className="h-4 w-4" /></Link></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {liveCategories.map((category, index) => <Link key={category.id} to={`/categories/${encodeURIComponent(category.slug)}`} className="group overflow-hidden rounded-xl border border-[#E8E8E8] bg-white p-3 transition hover:-translate-y-0.5 hover:border-[#111111] hover:shadow-lg dark:border-[#333333] dark:bg-[#1E1E1E] dark:hover:border-[#FAF5F2]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#F3EEE9] dark:bg-[#28282B]">
                  {category.image_url ? <img src={category.image_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading={index < 5 ? "eager" : "lazy"} /> : <Package className="absolute inset-0 m-auto h-7 w-7 text-[#B49A75]" />}
                </div>
                <div className="pt-3"><h3 className="line-clamp-1 text-sm font-bold">{category.name}</h3><p className="mt-1 text-xs text-[#888880]">{category.product_count} {category.product_count === 1 ? "product" : "products"}</p><span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#555550] group-hover:text-[#111111] dark:group-hover:text-white">Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span></div>
              </Link>)}
            </div>
          </section>

          {collections.length > 0 && <section className="mt-14" aria-labelledby="curated-collections"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#888880]">Shop by need</p><h2 id="curated-collections" className="mt-1 text-3xl font-black tracking-tight">Curated collections</h2><p className="mt-2 text-sm text-[#888880]">Focused product sets for deals, seasons, brands, and specific shopping missions.</p></div><div className="grid gap-4 md:grid-cols-3">{collections.map((collection) => <Link key={collection.id} to={`/collections/${encodeURIComponent(collection.slug)}`} className="group relative min-h-44 overflow-hidden rounded-2xl bg-[#1A1A1A] p-5 text-white shadow-sm"><img src={collection.image_url || ""} alt="" className={`absolute inset-0 h-full w-full object-cover opacity-60 transition duration-300 group-hover:scale-105 ${collection.image_url ? "" : "hidden"}`} loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" /><div className="relative flex h-full flex-col justify-end"><span className="mb-2 text-xs font-bold uppercase tracking-wider text-[#F6C75D]">{collection.badge || "Collection"}</span><h3 className="text-xl font-bold">{collection.title}</h3><span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold">Shop now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></div></Link>)}</div></section>}

          <section className="mt-14 border-t border-[#E8E8E8] pt-10 dark:border-[#333333]" aria-labelledby="all-departments"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#888880]">Full directory</p><h2 id="all-departments" className="mt-1 text-3xl font-black tracking-tight">All departments</h2><p className="mt-2 text-sm text-[#888880]">Every department remains available as the catalogue grows.</p></div><div className="grid gap-x-6 border-y border-[#E8E8E8] sm:grid-cols-2 lg:grid-cols-3 dark:border-[#333333]">{categories.map((category) => <Link key={category.id} to={`/categories/${encodeURIComponent(category.slug)}`} className="group flex items-center justify-between border-b border-[#E8E8E8] py-4 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0 lg:[&:nth-last-child(3)]:border-b-0 dark:border-[#333333]"><span><span className="block font-semibold group-hover:underline">{category.name}</span><span className="mt-0.5 block text-xs text-[#888880]">{category.product_count || 0} {category.product_count === 1 ? "product" : "products"}</span></span><ArrowRight className="h-4 w-4 text-[#888880] transition-transform group-hover:translate-x-1 group-hover:text-[#111111] dark:group-hover:text-white" /></Link>)}</div></section>

          <div className="mt-10 flex flex-wrap gap-3"><Link to="/marketplace?sort=flash_deals" className="inline-flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-5 py-3 text-sm font-semibold hover:bg-[#F2F3F5] dark:border-[#333333] dark:bg-[#1E1E1E]"><Tag className="h-4 w-4 text-[#E53935]" /> Shop deals</Link><Link to="/marketplace?sort=newest" className="inline-flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-5 py-3 text-sm font-semibold hover:bg-[#F2F3F5] dark:border-[#333333] dark:bg-[#1E1E1E]"><Sparkles className="h-4 w-4 text-[#F6C75D]" /> New arrivals</Link><Link to="/marketplace" className="inline-flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-5 py-3 text-sm font-semibold hover:bg-[#F2F3F5] dark:border-[#333333] dark:bg-[#1E1E1E]"><Search className="h-4 w-4" /> Search all products</Link></div>
        </>}
      </div>
    </main>
    <SiteFooter />
  </div>;
}
