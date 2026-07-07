import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, CheckCircle2, Package, Flame, Heart, X, Sparkles, Globe } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import SiteFooter from "@/components/SiteFooter";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRIES, countryName } from "@/lib/countries";

// Promo descriptors keyed by URL ?promo=
const PROMOS: Record<string, { label: string; filter: (p: any) => boolean }> = {
  summer20: { label: "20% Off Summer Sale", filter: (p) => !!p.compare_at_price && p.compare_at_price > p.price },
  hot50: { label: "Hot Deals — Up to 50% Off", filter: (p) => !!p.compare_at_price && (1 - p.price / p.compare_at_price) >= 0.2 },
  freeship: { label: "Free Shipping on $50+", filter: (p) => Number(p.price) >= 50 },
  new: { label: "New Arrivals", filter: () => true },
  bundle15: { label: "Bundle & Save 15%", filter: () => true },
  gifts: { label: "Gift Cards", filter: () => true },
};

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  category_id: string | null;
  stock_quantity: number;
  seller_id: string;
  ships_to: string[] | null;
  created_at: string;
  average_rating: number;
  review_count: number;
  product_images: { image_url: string; is_primary: boolean }[];
}

interface Category { id: string; name: string; slug: string; icon: string; }

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const promoKey = searchParams.get("promo");
  const categoryParam = searchParams.get("category");
  const searchParam = searchParams.get("search");
  const promo = promoKey ? PROMOS[promoKey] : null;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(searchParam ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [shipsTo, setShipsTo] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, { full_name: string | null; is_verified: boolean }>>({});
  const { addItem } = useCart();
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { isWishlisted, toggleWishlist } = useWishlist();

  useEffect(() => { fetchData(); }, []);

  // Default ships-to from buyer profile country
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("addresses" as any)
        .select("country").eq("user_id", user.id).eq("is_default", true).maybeSingle();
      const c = (data as any)?.country;
      if (c && COUNTRIES.find(x => x.code === c) && shipsTo === "all") setShipsTo(c);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Sync category from URL once categories load
  useEffect(() => {
    if (!categoryParam || categories.length === 0) return;
    const cat = categories.find(c => c.slug === categoryParam || c.id === categoryParam);
    if (cat) setSelectedCategory(cat.id);
  }, [categoryParam, categories]);

  useEffect(() => { if (searchParam !== null) setSearch(searchParam); }, [searchParam]);

  const clearPromo = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("promo");
    setSearchParams(next, { replace: true });
  };

  const fetchData = async () => {
    const [productsRes, categoriesRes] = await Promise.all([
      supabase.from("products").select("*, product_images(*)").eq("status", "active").eq("is_approved", true).order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    if (productsRes.data) {
      setProducts(productsRes.data as unknown as Product[]);
      const sellerIds = [...new Set(productsRes.data.map(p => p.seller_id))];
      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase.from("seller_profiles_public" as any).select("user_id, full_name, is_verified").in("user_id", sellerIds);
        if (profiles) {
          const map: Record<string, { full_name: string | null; is_verified: boolean }> = {};
          profiles.forEach(p => { map[p.user_id] = { full_name: p.full_name, is_verified: p.is_verified }; });
          setSellerProfiles(map);
        }
      }
    }
    if (categoriesRes.data) setCategories(categoriesRes.data);
    setLoading(false);
  };

  const filtered = useMemo(() => products.filter(p => {
    const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    const matchesPromo = !promo || promo.filter(p);
    const list = p.ships_to || [];
    const matchesShipsTo = shipsTo === "all" || list.length === 0 || list.includes(shipsTo);
    return matchesSearch && matchesCategory && matchesPromo && matchesShipsTo;
  }), [products, search, selectedCategory, promo, shipsTo]);

  const handleAddToCart = (product: Product) => {
    const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
    const seller = sellerProfiles[product.seller_id];
    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
      image_url: primaryImage?.image_url || null,
      seller_id: product.seller_id,
      seller_name: seller?.full_name || "Seller",
      stock_quantity: product.stock_quantity,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNavbar search={search} onSearchChange={setSearch} />
      <CartDrawer />

      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
        <AnimatedSection variant="fade-up">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Marketplace</h1>
          <p className="text-muted-foreground mb-4">Discover products from verified sellers worldwide</p>
          {promo && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="font-medium text-foreground">Promotion:</span>
                <span className="text-foreground/90">{promo.label}</span>
              </div>
              <button onClick={clearPromo} aria-label="Clear promotion" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </AnimatedSection>

        {/* Category pills */}
        <AnimatedSection variant="fade-up" delay={50}>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            <button onClick={() => setSelectedCategory(null)}
              className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all ${!selectedCategory ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all ${selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </AnimatedSection>

        {/* Ships-to + currency hint */}
        <AnimatedSection variant="fade-up" delay={60}>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ships to</span>
              <Select value={shipsTo} onValueChange={setShipsTo}>
                <SelectTrigger className="h-9 w-[180px] text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Anywhere</SelectItem>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              Prices shown in <span className="font-semibold text-foreground">{currency.code}</span>
            </span>
          </div>
        </AnimatedSection>

        <AnimatedSection variant="fade-up" delay={100}>
          {loading ? (
            <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="rounded-lg border border-border bg-card overflow-hidden animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="p-2 space-y-1.5"><div className="h-3 bg-muted rounded w-3/4" /><div className="h-4 bg-muted rounded w-1/3" /></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="font-display text-xl font-semibold text-foreground">
                {search || selectedCategory ? "No products match your filters" : "No products listed yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                {search || selectedCategory ? "Try different search terms or categories" : "Products will appear here as sellers list them."}
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map(product => {
                const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
                const seller = sellerProfiles[product.seller_id];
                const discount = product.compare_at_price && product.compare_at_price > product.price
                  ? Math.round((1 - product.price / product.compare_at_price) * 100) : null;

                return (
                  <div key={product.id} className="group rounded-lg border border-border/60 bg-card overflow-hidden transition-all hover:shadow-md">
                    <Link to={`/product/${product.id}`}>
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        {primaryImage ? (
                          <img src={primaryImage.image_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        ) : (
                          <div className="flex items-center justify-center h-full"><Package className="h-10 w-10 text-muted-foreground/20" /></div>
                        )}
                        {discount && <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground font-bold text-[10px] px-1.5 py-0">-{discount}%</Badge>}
                        {product.stock_quantity <= 5 && product.stock_quantity > 0 ? (
                          <Badge className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0"><Flame className="h-2.5 w-2.5 mr-0.5" /> Hot</Badge>
                        ) : (Date.now() - new Date(product.created_at).getTime()) < 1000 * 60 * 60 * 24 * 14 ? (
                          <Badge className="absolute top-1.5 right-1.5 bg-accent text-accent-foreground text-[10px] px-1.5 py-0">New</Badge>
                        ) : null}
                        {user && (
                          <button
                            onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
                            className={`absolute bottom-1.5 right-1.5 h-7 w-7 flex items-center justify-center rounded-full bg-background/90 backdrop-blur transition-colors ${isWishlisted(product.id) ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
                          >
                            <Heart className={`h-3.5 w-3.5 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                          </button>
                        )}
                      </div>
                    </Link>
                    <div className="p-2">
                      <Link to={`/product/${product.id}`}>
                        <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors text-xs leading-snug min-h-[2rem]">{product.title}</h3>
                      </Link>
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-baseline gap-1 min-w-0">
                          <span className="font-display text-base font-bold text-destructive">${product.price}</span>
                          {product.compare_at_price && product.compare_at_price > product.price && (
                            <span className="text-[10px] text-muted-foreground line-through">${product.compare_at_price}</span>
                          )}
                        </div>
                        <Button size="sm" onClick={(e) => { e.preventDefault(); handleAddToCart(product); }}
                          className="h-7 w-7 p-0 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shrink-0"
                          disabled={product.stock_quantity === 0}>
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {seller && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] text-muted-foreground truncate">{seller.full_name || "Seller"}</span>
                          {seller.is_verified && <CheckCircle2 className="h-2.5 w-2.5 text-accent shrink-0" />}
                        </div>
                      )}
                      {shipsTo !== "all" && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-accent">
                          <Globe className="h-2.5 w-2.5" /> Ships to {countryName(shipsTo)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AnimatedSection>
      </div>
      <SiteFooter />
    </div>
  );
}
