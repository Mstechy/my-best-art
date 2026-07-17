import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Package, Search } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

type Category = { id: string; name: string; slug: string; icon: string | null; };

/** A stable browse entry point: shoppers can choose a department before seeing products. */
export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("categories").select("id,name,slug,icon").order("sort_order")
      .then(({ data }) => { setCategories((data || []) as Category[]); setLoading(false); });
  }, []);

  return <div className="min-h-screen bg-[#FAFAFA] text-[#111111] dark:bg-[#121212] dark:text-[#FAF5F2]">
    <MarketplaceNavbar showSearch={false} categories={categories.map(category => ({ label: category.name, value: category.id }))} />
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-[#888880]"><Link to="/" className="hover:underline">Home</Link><span className="mx-2">/</span><span>Categories</span></nav>
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#888880]">Find your next favourite</p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight md:text-5xl">Shop by category</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#888880]">Start with a department, then use search, filters, and sorting to keep exploring until you find the right product.</p>
      </div>
      {loading ? <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-muted" />)}</div> : categories.length === 0 ? <div className="mt-10 rounded-2xl border bg-card p-10 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-semibold">Categories are being prepared.</p><Link to="/marketplace" className="mt-3 inline-flex items-center gap-2 text-sm underline">Browse all products <ArrowRight className="h-4 w-4" /></Link></div> : <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map(category => <Link key={category.id} to={`/categories/${encodeURIComponent(category.slug)}`} className="group rounded-2xl border border-[#E8E8E8] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#111111] hover:shadow-lg dark:border-[#222222] dark:bg-[#1E1E1E] dark:hover:border-[#FAF5F2]">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F8F3F0] text-lg dark:bg-[#252528]">{category.icon || <Package className="h-5 w-5" />}</div>
          <h2 className="mt-5 text-lg font-bold">{category.name}</h2>
          <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#888880] group-hover:text-[#111111] dark:group-hover:text-[#FAF5F2]">Explore products <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>)}
      </section>}
      <Link to="/marketplace" className="mt-10 inline-flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-5 py-3 text-sm font-semibold hover:bg-[#F2F3F5] dark:border-[#222222] dark:bg-[#1E1E1E] dark:hover:bg-[#222222]"><Search className="h-4 w-4" /> Search all products</Link>
    </main>
    <SiteFooter />
  </div>;
}
