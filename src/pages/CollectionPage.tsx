import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Package } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/product/ProductImage";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";

type Collection = { title: string; description: string | null; image_url: string | null; badge: string | null; cta_label: string };
type Product = { id: string; title: string; price: number; compare_at_price: number | null; currency: string; product_images: { image_url: string; is_primary: boolean }[] };

export default function CollectionPage() {
  const { slug } = useParams();
  const { formatPrice } = useCurrency();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;
      const { data: collectionData } = await supabase.from("marketplace_collections").select("id, title, description, image_url, badge, cta_label").eq("slug", slug).maybeSingle();
      if (!collectionData) { setLoading(false); return; }
      setCollection(collectionData as Collection & { id: string });
      const { data: membership } = await supabase.from("marketplace_collection_products").select("product_id").eq("collection_id", collectionData.id).order("sort_order");
      const ids = (membership ?? []).map(row => row.product_id);
      if (ids.length) {
        const { data } = await supabase.from("products").select("id, title, price, compare_at_price, currency, product_images(image_url, is_primary)").in("id", ids).eq("status", "active").eq("is_approved", true);
        const lookup = new Map((data ?? []).map(product => [product.id, product as Product]));
        setProducts(ids.flatMap(id => lookup.has(id) ? [lookup.get(id)!] : []));
      }
      setLoading(false);
    };
    load();
  }, [slug]);

  if (loading) return <div className="min-h-screen bg-background"><MarketplaceNavbar search="" onSearchChange={() => {}} /><main className="mx-auto max-w-7xl px-4 py-20 text-center text-muted-foreground">Loading collection…</main></div>;
  if (!collection) return <div className="min-h-screen bg-background"><MarketplaceNavbar search="" onSearchChange={() => {}} /><main className="mx-auto max-w-7xl px-4 py-20 text-center"><h1 className="text-2xl font-bold">Collection unavailable</h1><Link to="/marketplace" className="mt-4 inline-block underline">Browse marketplace</Link></main></div>;

  return <div className="min-h-screen bg-[#FAFAFA] text-[#111111] dark:bg-[#111111] dark:text-[#FAF5F2]"><MarketplaceNavbar search="" onSearchChange={() => {}} /><main><section className="border-b border-border bg-[#F8F3F0] dark:bg-[#1C1C1E]"><div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1fr_0.7fr] md:px-8 md:py-14"><div className="flex flex-col justify-center"><Link to="/marketplace" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Marketplace</Link>{collection.badge && <span className="mb-3 w-fit rounded-full bg-[#F6C75D] px-3 py-1 text-xs font-bold text-[#5C3A00]">{collection.badge}</span>}<h1 className="text-3xl font-black uppercase tracking-tight md:text-5xl">{collection.title}</h1>{collection.description && <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{collection.description}</p>}</div>{collection.image_url && <img src={collection.image_url} alt="" className="aspect-[16/9] h-full w-full rounded-2xl object-cover" />}</div></section><section className="mx-auto max-w-7xl px-4 py-10 md:px-8"><div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-semibold">Shop this collection</h2><span className="text-sm text-muted-foreground">{products.length} products</span></div>{products.length === 0 ? <div className="rounded-xl border bg-card py-14 text-center"><Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">This collection is being prepared</p><p className="mt-1 text-sm text-muted-foreground">Please check back soon.</p></div> : <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.map(product => { const image = product.product_images.find(item => item.is_primary)?.image_url || product.product_images[0]?.image_url; return <Link to={`/product/${product.id}`} key={product.id} className="group overflow-hidden rounded-xl border bg-card"><div className="aspect-square bg-muted">{image ? <ProductImage src={image} alt={product.title} className="group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center"><Package className="h-7 w-7 text-muted-foreground" /></div>}</div><div className="p-3"><h2 className="line-clamp-2 min-h-10 text-sm font-medium">{product.title}</h2><div className="mt-2 flex items-baseline gap-2"><span className="font-bold">{formatPrice(product.price, product.currency)}</span>{product.compare_at_price && product.compare_at_price > product.price && <span className="text-xs text-muted-foreground line-through">{formatPrice(product.compare_at_price, product.currency)}</span>}</div></div></Link>; })}</div>}</section></main><SiteFooter /></div>;
}
