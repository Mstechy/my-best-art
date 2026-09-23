import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Store, CheckCircle2, Package, Calendar, ArrowLeft, Truck, RotateCcw, Globe, Flame, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ThemeToggle from "../components/ThemeToggle";
import CopyLinkButton from "../components/CopyLinkButton";
import StoreFollowButton from "../components/store/StoreFollowButton";
import StoreCredibilityCard from "../components/store/StoreCredibilityCard";
import { countryName } from "../lib/countries";
import ProductImage from "@/components/product/ProductImage";
import StarRating from "@/components/ui/StarRating";
import { useResolvedPolicies } from "@/hooks/useResolvedPolicies";

interface SellerProfile {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  country?: string | null;
}

interface StoreProfile {
  banner_url: string | null;
  logo_url: string | null;
  bio: string | null;
  return_policy: string | null;
  shipping_policy: string | null;
}

interface Product {
  id: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  average_rating: number;
  review_count: number;
  created_at: string;
  product_images: { image_url: string; is_primary: boolean }[];
}
interface StoreCollection { id: string; title: string; slug: string; description: string | null; image_url: string | null; }

export default function SellerStorePage() {
  const { id } = useParams<{ id: string }>();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productOrders, setProductOrders] = useState<Record<string, number>>({});
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { policies, isLoading: policiesLoading, sourceLabel } = useResolvedPolicies(id, null);

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      setLoadError(false);
      const [sellerRes, fallbackSellerRes, productsRes, storeRes, collectionsRes] = await Promise.all([
        (supabase as any).from("seller_profiles_public").select("*").eq("user_id", id).single(),
        supabase.from("profiles").select("user_id, full_name, avatar_url, country, is_verified, created_at").eq("user_id", id).maybeSingle(),
        supabase.from("products").select("id, title, price, compare_at_price, average_rating, review_count, created_at, product_images(*)").eq("seller_id", id).eq("status", "active").eq("is_approved", true).order("created_at", { ascending: false }),
        supabase.from("seller_stores").select("banner_url, logo_url, bio, return_policy, shipping_policy").eq("seller_id", id).maybeSingle(),
        (supabase.from("marketplace_collections") as any).select("id,title,slug,description,image_url").eq("seller_id", id).eq("status", "active").order("sort_order"),
      ]);
      if (sellerRes.data) setSeller(sellerRes.data as SellerProfile);
      else if (fallbackSellerRes.data) setSeller(fallbackSellerRes.data as SellerProfile);
      if (productsRes.data) {
        setProducts(productsRes.data as unknown as Product[]);
        const pIds = productsRes.data.map((p: any) => p.id);
        if (pIds.length) {
          const { data: items } = await supabase
            .from("order_items")
            .select("product_id, quantity, orders!inner(status)")
            .in("product_id", pIds)
            .eq("orders.status", "delivered");
          const m: Record<string, number> = {};
          (items || []).forEach((r: any) => { m[r.product_id] = (m[r.product_id] || 0) + (r.quantity || 0); });
          setProductOrders(m);
        }
      }
      if (storeRes.data) setStore(storeRes.data as StoreProfile);
      if (collectionsRes.data) setCollections(collectionsRes.data as StoreCollection[]);
      if (sellerRes.error && fallbackSellerRes.error) setLoadError(true);
      setLoading(false);
    };
    fetch();
  }, [id]);

  if (loading) return <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-8" aria-label="Loading store"><div className="h-40 animate-pulse rounded-2xl bg-muted" /><div className="h-40 animate-pulse rounded-2xl bg-muted" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />)}</div></div>;
  if (loadError) return <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center"><h2 className="font-display text-xl font-bold text-foreground">This store could not be loaded</h2><Link to="/marketplace"><Button variant="outline">Back to Marketplace</Button></Link></div>;
  if (!seller) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Store className="h-16 w-16 text-muted-foreground" />
      <h2 className="font-display text-2xl font-bold text-foreground">Seller not found</h2>
      <Link to="/marketplace"><Button variant="outline">Back to Marketplace</Button></Link>
    </div>
  );

  const displayLogo = store?.logo_url || seller.avatar_url;
  const storeName = seller.full_name?.trim() || "Store";
  const storeInitial = storeName.charAt(0).toUpperCase();
  const joined = new Date(seller.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const sellerCountry = seller.country ? countryName(seller.country) : null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary transition-transform group-hover:scale-110">
              <ShoppingBag className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">Tradibu</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/marketplace"><Button variant="outline" size="sm">Marketplace</Button></Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-6">
        <Link to="/marketplace" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Marketplace
        </Link>

        {/* Banner — uploaded image OR purple gradient fallback */}
        <div className="rounded-2xl overflow-hidden h-40 sm:h-56 relative">
          {store?.banner_url ? (
            <img src={store.banner_url} alt="Store banner" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="font-display text-5xl font-bold text-muted-foreground/40" aria-hidden>{storeInitial}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
        </div>

        {/* Store header — overlaps banner */}
        <div className="relative -mt-12 rounded-2xl border border-border/60 bg-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-muted overflow-hidden shrink-0 ring-4 ring-background -mt-16">
              {displayLogo ? (
                <img src={displayLogo} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-3xl font-bold text-muted-foreground" aria-label={`${storeName} logo`}>{storeInitial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-foreground">{storeName}</h1>
                {seller.is_verified && (
                  <Badge className="bg-success/10 text-success border-success/20 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                {sellerCountry && <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> {sellerCountry}</span>}
                <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Joined {joined}</span>
                <span>{products.length} products</span>
              </div>
              {store?.bio && <p className="mt-2 text-sm text-foreground/80 max-w-2xl">{store.bio}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StoreFollowButton sellerId={seller.user_id} />
              <CopyLinkButton label="Share Store" />
            </div>
          </div>
        </div>

        {/* Store credibility */}
        <div id="store-credibility" className="mb-6">
          <StoreCredibilityCard sellerId={seller.user_id} />
        </div>

        {/* Policies */}
        {!policiesLoading && (policies.shipping || policies.returns) && (
          <section className="mb-8 border-y border-border/60">
            {[policies.shipping, policies.returns].filter((policy): policy is NonNullable<typeof policy> => policy !== null).map((policy) => (
              <div key={policy.title} className="flex gap-3 py-4 first:border-b first:border-border/60">
                {policy.title === "Shipping" ? <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> : <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />}
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h2 className="font-display font-semibold text-foreground">{policy.title}</h2><span className="text-xs text-muted-foreground">{sourceLabel(policy.source)}</span></div><p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{policy.detail}</p></div>
              </div>
            ))}
          </section>
        )}

        {/* Seller collections */}
        {collections.length > 0 && <section className="mb-8"><h2 className="font-display text-xl font-bold text-foreground mb-4">Store Collections</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{collections.map(collection => <Link key={collection.id} to={`/collections/${collection.slug}`} className="overflow-hidden rounded-2xl border border-border/60 bg-card"><div className="flex aspect-[16/6] items-center justify-center bg-muted">{collection.image_url ? <img src={collection.image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <span className="font-display text-xl font-bold text-muted-foreground/40" aria-hidden>{collection.title.charAt(0).toUpperCase()}</span>}</div><div className="p-4"><p className="font-semibold">{collection.title}</p>{collection.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{collection.description}</p>}</div></Link>)}</div></section>}
        {/* Products */}
        <h2 className="font-display text-xl font-bold text-foreground mb-4">All Products</h2>
        {products.length === 0 ? (
          <div className="border-y border-border/60 py-8 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <h3 className="font-display font-semibold text-foreground">No products listed</h3>
            <p className="mt-1 text-sm text-muted-foreground">This seller has not listed products yet.</p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {products.map(product => {
              const img = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
              const orders = productOrders[product.id] || 0;
              const isHot = orders > 50;
              const isNew = (Date.now() - new Date(product.created_at).getTime()) < 1000 * 60 * 60 * 24 * 14;
              const discount = product.compare_at_price && product.compare_at_price > product.price
                ? Math.round((1 - product.price / product.compare_at_price) * 100) : null;
              return (
                <Link key={product.id} to={`/product/${product.id}`} className="group">
                  <div className="rounded-xl border border-border/60 bg-card overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
                    <div className="aspect-square bg-muted relative">
                      {img ? (
                        <ProductImage src={img.image_url} alt={product.title} loading="lazy" className="group-hover:scale-105" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Package className="h-12 w-12 text-muted-foreground/30" /></div>
                      )}
                      {discount && <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 font-bold">-{discount}%</Badge>}
                      {isHot && <Badge className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0"><Flame className="h-2.5 w-2.5 mr-0.5" /> Hot</Badge>}
                      {!isHot && isNew && <Badge className="absolute top-1.5 right-1.5 bg-success text-success-foreground text-[10px] px-1.5 py-0"><Sparkles className="h-2.5 w-2.5 mr-0.5" /> New</Badge>}
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs font-medium text-foreground line-clamp-2 min-h-[2rem]">{product.title}</h3>
                      <div className="mt-1.5 flex items-baseline gap-1">
                        <span className="font-display text-base font-bold text-destructive">${product.price}</span>
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-[10px] text-muted-foreground line-through">${product.compare_at_price}</span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <StarRating rating={product.average_rating} reviewCount={product.review_count} reviewLabel="reviews" showNewWhenUnrated={false} />
                        {orders > 0 && <span>{orders >= 100 ? `${Math.floor(orders / 100) * 100}+ sold` : `${orders} sold`}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
