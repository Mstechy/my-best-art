import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Package, Search } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { BottomTabBar } from "@/components/ui/BottomTabBar";
import { fetchCollectionsByPlacement, type EnhancedCollection } from "@/lib/collectionResolver";

type Category = { id: string; name: string; slug: string; icon: string | null; image_url?: string | null; product_count?: number; };

/** A stable browse entry point: shoppers can choose a department before seeing products. */
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<EnhancedCollection[]>([]);
  const [loading, setLoading] = useState(true);

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
      const countsByCategory = new Map<string, number>(
        ((categoryCounts || []) as { category_id: string; product_count: number }[])
          .map((item) => [item.category_id, Number(item.product_count)]),
      );
      setCategories(categoryRows.map(category => ({
        ...category,
        image_url: imageByCategory.get(category.id) || null,
        product_count: countsByCategory.get(category.id) || 0,
      })));
      setCollections(categoryCollections);
      setLoading(false);
    };
    void load();
  }, []);

  return <div className="min-h-screen bg-[#FAFAFA] text-[#111111] dark:bg-[#121212] dark:text-[#FAF5F2]">
    <MarketplaceNavbar showSearch={false} categories={categories.map(category => ({ label: category.name, value: category.id }))} />
    <BottomTabBar />
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-[#888880]"><Link to="/" className="hover:underline">Home</Link><span className="mx-2">/</span><span>Categories</span></nav>
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#888880]">Find your next favourite</p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight md:text-5xl">Shop by category</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#888880]">Start with a department, then use search, filters, and sorting to keep exploring until you find the right product.</p>
      </div>
      {!loading && collections.length > 0 && <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#888880]">Curated for you</p><h2 className="mt-1 text-2xl font-black tracking-tight">Featured collections</h2></div>
          <Link to="/marketplace" className="text-sm font-semibold underline">View all</Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {collections.map((collection) => <Link key={collection.id} to={`/collections/${encodeURIComponent(collection.slug)}`} className="group relative min-h-44 overflow-hidden rounded-2xl bg-[#1A1A1A] p-5 text-white shadow-sm">
            {collection.image_url && <img src={collection.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60 transition duration-300 group-hover:scale-105" loading="lazy" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" />
            <div className="relative flex h-full flex-col justify-end"><span className="mb-2 text-xs font-bold uppercase tracking-wider text-[#F6C75D]">{collection.badge || "Collection"}</span><h3 className="text-xl font-bold">{collection.title}</h3><span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold">Shop now <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></div>
          </Link>)}
        </div>
      </section>}
      {loading ? <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div> : categories.length === 0 ? <div className="mt-10 rounded-2xl border bg-card p-10 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Categories are being prepared.</p><Link to="/marketplace" className="mt-3 inline-flex items-center gap-2 text-sm underline">Browse all products <ArrowRight className="h-4 w-4" /></Link></div> : <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map(category => <Link key={category.id} to={`/categories/${encodeURIComponent(category.slug)}`} className="group rounded-2xl border border-[#E8E8E8] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#111111] hover:shadow-lg dark:border-[#222222] dark:bg-[#1E1E1E] dark:hover:border-[#FAF5F2]">
          <div className="relative flex h-28 items-center justify-center overflow-hidden rounded-xl bg-[#F8F3F0] text-lg dark:bg-[#252528]">
            {category.image_url ? <img src={category.image_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" /> : <span>{category.icon || <Package className="h-5 w-5" />}</span>}
          </div>
          <h2 className="mt-5 text-lg font-bold">{category.name}</h2>
          <p className="mt-1 text-xs text-[#888880]">{category.product_count || 0} {category.product_count === 1 ? "product" : "products"}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#888880] group-hover:text-[#111111] dark:group-hover:text-[#FAF5F2]">Explore products <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>)}
      </section>}
      <Link to="/marketplace" className="mt-10 inline-flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-5 py-3 text-sm font-semibold hover:bg-[#F2F3F5] dark:border-[#222222] dark:bg-[#1E1E1E] dark:hover:bg-[#222222]"><Search className="h-4 w-4" /> Search all products</Link>
    </main>
    <SiteFooter />
  </div>;
}
