import { useState, useEffect, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
import type { Database } from "@/integrations/supabase/types";
import { COUNTRIES, countryName } from "@/lib/countries";
import { findCategoryConfig, getCategoryAttributes } from "@/lib/categoryConfig";
import MarketplaceFilters, { countActive, defaultFilters, type MarketplaceFiltersState } from "@/components/MarketplaceFilters";
import ProductImage from "@/components/product/ProductImage";
import { trackProductDiscovery } from "@/lib/productDiscovery";

// Promo descriptors keyed by URL ?promo=
type SellerProfilePublic = Database["public"]["Views"]["seller_profiles_public"]["Row"];

const PROMOS: Record<string, { label: string; filter: (p: Product) => boolean }> = {
  summer20: { label: "20% Off Summer Sale", filter: (p) => !!p.compare_at_price && p.compare_at_price > p.price },
  hot50: { label: "Hot Deals - Up to 50% Off", filter: (p) => !!p.compare_at_price && (1 - p.price / p.compare_at_price) >= 0.2 },
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
  brand: string | null;
  color: string | null;
  condition: string | null;
  material: string | null;
  weight: string | null;
  dimensions: string | null;
  ships_to: string[] | null;
  created_at: string;
  average_rating: number;
  review_count: number;
  variants: { categoryAttributes?: Record<string, string> } | null;
  product_images: { image_url: string; is_primary: boolean }[];
}

interface Category { id: string; name: string; slug: string; icon: string; }
interface CatalogueCursor { relevance: number; createdAt: string; id: string; }
const CATALOGUE_PAGE_SIZE = 24;

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { slug: categoryRouteSlug } = useParams<{ slug?: string }>();
  const promoKey = searchParams.get("promo");
  const categoryParam = categoryRouteSlug ?? searchParams.get("category");
  const searchParam = searchParams.get("search");
  const visualParam = searchParams.get("visual");
  const visualHashParam = searchParams.get("visualHash");
  const sortParam = searchParams.get("sort");
  const promo = promoKey ? PROMOS[promoKey] : null;
  const isVisualSearch = visualParam === "1";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(searchParam ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [shipsTo, setShipsTo] = useState<string>("all");
  const [filters, setFilters] = useState<MarketplaceFiltersState>(defaultFilters);
  const [sortBy, setSortBy] = useState(() => ["relevance", "newest", "rating", "price_low", "price_high", "best_sellers", "trending", "recommended"].includes(sortParam || "") ? sortParam! : "relevance");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<CatalogueCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, { full_name: string | null; is_verified: boolean }>>({});
  const { addItem } = useCart();
  const { user } = useAuth();
  const { currency, setCurrencyCode, currencies, country: preferredCountry, setCountry, formatPrice } = useCurrency();
  const { isWishlisted, toggleWishlist } = useWishlist();

  // Location and Currency Modal States
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [isLocationConfirmScreen, setIsLocationConfirmScreen] = useState(true);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);

  useEffect(() => { fetchData(); }, []);

  // The shared preference is detected once, then survives navigation and manual changes.
  useEffect(() => { setShipsTo(preferredCountry || "all"); }, [preferredCountry]);

  // Sync category from URL once categories load
  useEffect(() => {
    if (!categoryParam || categories.length === 0) return;
    const cat = categories.find(c => c.slug === categoryParam || c.id === categoryParam);
    if (cat) {
      setSelectedCategory(cat.id);
      setFilters(f => ({ ...f, categoryAttributes: {} }));
    }
  }, [categoryParam, categories]);

  useEffect(() => { if (searchParam !== null) setSearch(searchParam); }, [searchParam]);
  useEffect(() => {
    const nextSort = ["relevance", "newest", "rating", "price_low", "price_high", "best_sellers", "trending", "recommended"].includes(sortParam || "") ? sortParam! : "relevance";
    setSortBy(current => current === nextSort ? current : nextSort);
  }, [sortParam]);

  useEffect(() => {
    if (categoryRouteSlug) {
      const next = new URLSearchParams(searchParams);
      if (search.trim()) next.set("search", search.trim()); else next.delete("search");
      next.delete("category");
      if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
      return;
    }
    const next = new URLSearchParams(searchParams);
    const normalizedSearch = search.trim();
    const categoryRecord = categories.find(category => category.id === selectedCategory) || null;
    const normalizedCategory = categoryRecord?.slug || selectedCategory || null;

    if (normalizedSearch) {
      next.set("search", normalizedSearch);
    } else {
      next.delete("search");
    }

    if (normalizedCategory) {
      next.set("category", normalizedCategory);
    } else {
      next.delete("category");
    }

    if (sortBy !== "relevance") next.set("sort", sortBy); else next.delete("sort");

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [search, selectedCategory, categories, searchParams, setSearchParams, categoryRouteSlug, sortBy]);

  const clearPromo = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("promo");
    setSearchParams(next, { replace: true });
  };

  const fetchData = async () => {
    const { data: categoriesData } = await supabase.from("categories").select("*").order("sort_order");
    if (categoriesData) setCategories(categoriesData);
  };

  async function fetchCatalogue(reset = false) {
    if (reset) { setLoading(true); setCursor(null); } else { setLoadingMore(true); }
    const pageCursor = reset ? null : cursor;
    const response = visualHashParam
      ? await supabase.rpc("search_marketplace_product_ids_by_visual_hash", { p_hash: visualHashParam, p_category_id: selectedCategory, p_limit: CATALOGUE_PAGE_SIZE })
      : await supabase.rpc("search_marketplace_product_ids", {
        p_query: search.trim(), p_category_id: selectedCategory, p_country: shipsTo === "all" ? null : shipsTo,
        p_min_price: filters.minPrice || null, p_max_price: filters.maxPrice < 10000 ? filters.maxPrice : null,
        p_min_rating: filters.minRating || null, p_in_stock_only: filters.inStockOnly,
        p_condition: filters.condition === "any" ? null : filters.condition,
        p_attribute_filters: filters.categoryAttributes, p_sort: sortBy, p_limit: CATALOGUE_PAGE_SIZE,
        p_cursor_relevance: pageCursor?.relevance ?? null, p_cursor_created_at: pageCursor?.createdAt ?? null, p_cursor_id: pageCursor?.id ?? null,
      });
    const { data: matches, error } = response;
    if (error) { setLoading(false); setLoadingMore(false); return; }
    const ids = (matches || []).map((match) => match.product_id);
    if (!ids.length) {
      if (reset) setProducts([]);
      setHasMore(false); setLoading(false); setLoadingMore(false); return;
    }
    const { data: productsData } = await supabase.from("products").select("*, product_images(*)").in("id", ids);
    const byId = new Map((productsData || []).map((product) => [product.id, product as unknown as Product]));
    const ordered = ids.map((id) => byId.get(id)).filter((product): product is Product => !!product);
    setProducts((current) => reset ? ordered : [...current, ...ordered.filter((product) => !current.some((existing) => existing.id === product.id))]);
    const sellerIds = [...new Set(ordered.map((product) => product.seller_id).filter(Boolean))];
      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase.from("seller_profiles_public").select("user_id, full_name, is_verified").in("user_id", sellerIds);
        if (profiles) {
          const map: Record<string, { full_name: string | null; is_verified: boolean }> = {};
          profiles.forEach((p: SellerProfilePublic) => {
            if (p.user_id) map[p.user_id] = { full_name: p.full_name, is_verified: !!p.is_verified };
          });
          setSellerProfiles((current) => reset ? map : { ...current, ...map });
        }
      }
    const last = matches?.at(-1);
    setCursor(last ? { relevance: last.relevance, createdAt: last.created_at, id: last.product_id } : null);
    setHasMore(!visualHashParam && (matches?.length || 0) === CATALOGUE_PAGE_SIZE);
    setLoading(false); setLoadingMore(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { fetchCatalogue(true); }, 250);
    return () => window.clearTimeout(timer);
  }, 
  );

  const attributeValue = (product: Product, key: string) => {
    const categoryAttributes = getCategoryAttributes(product.variants);
    const fallback: Record<string, string | null> = {
      brand: product.brand,
      color: product.color,
      condition: product.condition,
      material: product.material,
      weight: product.weight,
      dimensions: product.dimensions,
    };
    return (categoryAttributes[key] || fallback[key] || "").trim();
  };

  const filtered = useMemo(() => products.filter(p => {
    const matchesPromo = !promo || promo.filter(p);
    return matchesPromo;
  }), [products, promo]);

  const visualFallbackProducts = useMemo(() => {
    if (!isVisualSearch || filtered.length > 0) return [];
    return products
      .filter(product => !selectedCategory || product.category_id === selectedCategory)
      .slice(0, 12);
  }, [isVisualSearch, filtered.length, products, selectedCategory]);

  const displayedProducts = filtered.length > 0 ? filtered : visualFallbackProducts;

  const selectedCategoryRecord = categories.find(c => c.id === selectedCategory) || null;
  const selectedCategoryConfig = findCategoryConfig(selectedCategoryRecord);
  const selectedCategoryProducts = useMemo(
    () => products.filter(product => !selectedCategory || product.category_id === selectedCategory),
    [products, selectedCategory]
  );
  const categoryFilterOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    selectedCategoryConfig.filters.forEach(filter => {
      const values = new Set<string>();
      selectedCategoryProducts.forEach(product => {
        const value = attributeValue(product, filter);
        if (value) values.add(value);
      });
      options[filter] = Array.from(values).sort((a, b) => a.localeCompare(b)).slice(0, 12);
    });
    return options;
  }, [selectedCategoryConfig, selectedCategoryProducts]);
  const activeFilterCount = countActive(filters);

  const handleAddToCart = (product: Product) => {
    trackProductDiscovery(product.id, "add_to_cart");
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

  useEffect(() => {
    if (displayedProducts.length) trackProductDiscovery(displayedProducts.map((product) => product.id), "impression");
  }, [displayedProducts]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] text-[#111111] dark:text-[#FAF5F2]">
      <MarketplaceNavbar
        search={search}
        onSearchChange={setSearch}
        categories={categories.map(category => ({ label: category.name, value: category.id }))}
        selectedCategory={selectedCategory}
        onCategoryChange={(value) => {
          setSelectedCategory(value);
          setFilters(f => ({ ...f, categoryAttributes: {} }));
        }}
      />
      <CartDrawer />

      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
        <AnimatedSection variant="fade-up">
          {selectedCategoryRecord && <nav aria-label="Breadcrumb" className="mb-2 text-xs text-[#888880]"><Link to="/" className="hover:underline">Home</Link><span className="mx-2">/</span><Link to="/categories" className="hover:underline">Categories</Link><span className="mx-2">/</span><span>{selectedCategoryRecord.name}</span></nav>}
          <h1 className="text-3xl font-black tracking-tight text-[#111111] dark:text-[#FAF5F2] uppercase leading-[1.05] font-sans mb-2">{selectedCategoryRecord?.name || "Marketplace"}</h1>
          <p className="text-[13px] text-[#888880] dark:text-[#A0A0A0] mb-4">
            {isVisualSearch
              ? (filtered.length > 0
                ? "Image search results from your upload"
                : "No exact visual match found, showing the closest products we have")
              : selectedCategoryRecord ? `Explore ${selectedCategoryRecord.name} from verified sellers. Filter, compare, and keep discovering.` : "Discover products from verified sellers worldwide"}
          </p>
          {promo && (
            <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-[#E8E8E8] dark:border-[#222222] bg-[#F8F3F0] dark:bg-[#1C1C1E] px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-[#111111] dark:text-[#FAF5F2] shrink-0" />
                <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">Promotion:</span>
                <span className="text-[#111111] dark:text-[#FAF5F2]">{promo.label}</span>
              </div>
              <button onClick={clearPromo} aria-label="Clear promotion" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#888880] dark:text-[#A0A0A0] hover:bg-[#E8E8E8] dark:hover:bg-[#2A2A2D] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {hasMore && displayedProducts.length > 0 && (
            <div className="mt-8 flex justify-center">
              <Button type="button" variant="outline" onClick={() => fetchCatalogue(false)} disabled={loadingMore} className="rounded-full px-6">
                {loadingMore ? "Loading products..." : "Load more products"}
              </Button>
            </div>
          )}
        </AnimatedSection>

        {/* Category pills */}
        <AnimatedSection variant="fade-up" delay={50}>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide select-none">
            <button onClick={() => { setSelectedCategory(null); setFilters(f => ({ ...f, categoryAttributes: {} })); }}
              className={`whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold border transition-all duration-200 ${!selectedCategory ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-transparent" : "bg-white dark:bg-[#1E1E1E] text-[#111111] dark:text-[#FAF5F2] border-[#E8E8E8] dark:border-[#222222] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D]"}`}>
              All
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setFilters(f => ({ ...f, categoryAttributes: {} })); }}
                className={`whitespace-nowrap rounded-full px-5 py-2 text-xs font-semibold border transition-all duration-200 ${selectedCategory === cat.id ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-transparent" : "bg-white dark:bg-[#1E1E1E] text-[#111111] dark:text-[#FAF5F2] border-[#E8E8E8] dark:border-[#222222] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D]"}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </AnimatedSection>

        {/* Ships-to + category filters + currency hint */}
        <AnimatedSection variant="fade-up" delay={60}>
          <div className="flex flex-wrap items-center gap-3 mb-6 select-none">
            <MarketplaceFilters
              value={filters}
              onChange={setFilters}
              activeCount={activeFilterCount}
              categoryName={selectedCategoryRecord?.name}
              categoryFilters={selectedCategoryRecord ? selectedCategoryConfig.filters : []}
              categoryFilterOptions={selectedCategoryRecord ? categoryFilterOptions : {}}
            />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-10 w-[150px] rounded-full border-[#E8E8E8] bg-white text-xs font-semibold dark:border-[#222222] dark:bg-[#1E1E1E]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Best match</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="rating">Top rated</SelectItem>
                <SelectItem value="best_sellers">Best sellers</SelectItem>
                <SelectItem value="trending">Trending</SelectItem>
                <SelectItem value="recommended">Recommended</SelectItem>
                <SelectItem value="price_low">Price: low to high</SelectItem>
                <SelectItem value="price_high">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#888880] dark:text-[#A0A0A0]" />
              <span className="text-xs font-semibold text-[#888880] dark:text-[#A0A0A0]">Ships to</span>
              <button
                onClick={() => {
                  setIsLocationConfirmScreen(true);
                  setIsLocationOpen(true);
                }}
                className="flex items-center gap-1.5 h-9 px-4 text-xs font-semibold bg-white dark:bg-[#1E1E1E] border border-[#E8E8E8] dark:border-[#222222] text-[#111111] dark:text-[#FAF5F2] rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] transition-colors focus:outline-none"
              >
                <span>{shipsTo === "all" ? "Anywhere 🌍" : countryName(shipsTo)}</span>
              </button>
            </div>
            <span className="text-xs text-[#888880] dark:text-[#A0A0A0] ml-auto">
              Prices shown in{" "}
              <button
                onClick={() => setIsCurrencyOpen(true)}
                className="font-bold text-[#111111] dark:text-[#FAF5F2] hover:underline focus:outline-none"
              >
                {currency.code} ({currency.symbol})
              </button>
            </span>
          </div>
          {selectedCategoryRecord && (
            <div className="mb-6 rounded-lg border border-border/60 bg-card px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{selectedCategoryRecord.name}</span>
                <span className="text-xs text-muted-foreground">filters:</span>
                {selectedCategoryConfig.filters.map(filter => (
                  <Badge key={filter} variant="outline" className="capitalize text-xs">
                    {filter.replace(/([A-Z])/g, " $1")}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </AnimatedSection>

        <AnimatedSection variant="fade-up" delay={100}>
          {loading ? (
            <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-[#E8E8E8]/40 dark:border-[#222222] bg-white dark:bg-[#1E1E1E] overflow-hidden animate-pulse">
                  <div className="aspect-square bg-[#F5F5F5] dark:bg-[#1E1E1E]" />
                  <div className="p-4 space-y-1.5">
                    <div className="h-3 bg-[#E8E8E8] dark:bg-[#2A2A2D] rounded w-3/4" />
                    <div className="h-4 bg-[#E8E8E8] dark:bg-[#2A2A2D] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center select-none">
              <Package className="h-16 w-16 text-[#888880]/30 dark:text-[#A0A0A0]/30 mb-4" />
              <h3 className="text-lg font-bold text-[#111111] dark:text-[#FAF5F2]">
                {search || selectedCategory ? "No products match your filters" : "No products listed yet"}
              </h3>
              <p className="mt-2 text-xs text-[#888880] dark:text-[#A0A0A0] max-w-sm">
                {search || selectedCategory ? "Try different search terms or categories" : "Products will appear here as sellers list them."}
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {displayedProducts.map(product => {
                const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
                const seller = sellerProfiles[product.seller_id];
                const discount = product.compare_at_price && product.compare_at_price > product.price
                  ? Math.round((1 - product.price / product.compare_at_price) * 100) : null;

                return (
                  <div key={product.id} className="group rounded-2xl bg-[#F5F5F5] dark:bg-[#1E1E1E] overflow-hidden flex flex-col p-4 relative border border-[#E8E8E8]/40 dark:border-[#222222]/60 hover:border-[#888880]/60 dark:hover:border-[#555555] transition-all duration-200 h-full">
                    <Link to={`/product/${product.id}`} onClick={() => trackProductDiscovery(product.id, "click")} className="block">
                      <div className="aspect-square bg-[#F7F7F5] dark:bg-[#1E1E1E] flex items-center justify-center relative overflow-hidden shrink-0 rounded-xl">
                        {primaryImage ? (
                          <ProductImage src={primaryImage.image_url} alt={product.title} className="group-hover:scale-105" loading="lazy" />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full bg-[#E8E8E8] dark:bg-[#2A2A2D] rounded-xl">
                            <Package className="h-8 w-8 text-[#888880] opacity-40" />
                          </div>
                        )}
                        {discount ? (
                          <span className="absolute top-3 left-3 bg-[#E53935] text-white text-[9px] font-bold px-2 py-0.5 rounded-[3px] z-10 shadow-sm select-none">-{discount}%</span>
                        ) : product.stock_quantity <= 5 && product.stock_quantity > 0 ? (
                          <span className="absolute top-3 left-3 bg-[#FFA000] text-white text-[9px] font-bold px-2 py-0.5 rounded-[3px] z-10 shadow-sm select-none flex items-center"><Flame className="h-2.5 w-2.5 mr-0.5" /> Hot</span>
                        ) : (Date.now() - new Date(product.created_at).getTime()) < 1000 * 60 * 60 * 24 * 14 ? (
                          <span className="absolute top-3 left-3 bg-[#2E7D32] text-white text-[9px] font-bold px-2 py-0.5 rounded-[3px] z-10 shadow-sm select-none">New</span>
                        ) : null}
                        {user && (
                          <button
                          onClick={(e) => { e.preventDefault(); trackProductDiscovery(product.id, "wishlist"); toggleWishlist(product.id); }}
                            className={`absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur shadow-sm transition-colors duration-200 ${isWishlisted(product.id) ? "text-[#E53935]" : "text-[#888880] dark:text-[#A0A0A0] hover:text-[#E53935] dark:hover:text-[#E53935]"}`}
                          >
                            <Heart className={`h-3.5 w-3.5 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                          </button>
                        )}
                      </div>
                    </Link>
                    <div className="p-0 flex flex-col flex-1 mt-2">
                      <Link to={`/product/${product.id}`} onClick={() => trackProductDiscovery(product.id, "click")}>
                        <h4 className="text-[12px] font-semibold text-[#111111] dark:text-[#FAF5F2] line-clamp-2 hover:underline min-h-[32px] leading-snug">{product.title}</h4>
                      </Link>
                      <div className="flex items-center justify-between mt-2.5">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{formatPrice(product.price)}</span>
                          {product.compare_at_price && product.compare_at_price > product.price && (
                            <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0] line-through">{formatPrice(product.compare_at_price)}</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.preventDefault(); handleAddToCart(product); }}
                          className="bg-[#111111] dark:bg-[#FAF5F2] hover:bg-[#222222] dark:hover:bg-[#EAE0D8] text-white dark:text-[#111111] rounded-full p-2 h-8 w-8 flex items-center justify-center transition-colors duration-200 shrink-0"
                          disabled={product.stock_quantity === 0}
                          aria-label="Add to cart"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {seller && (
                        <div className="flex items-center gap-1 mt-1.5 select-none">
                          <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0] truncate">{seller.full_name || "Seller"}</span>
                          {seller.is_verified && <CheckCircle2 className="h-2.5 w-2.5 text-[#F6C75D] shrink-0" />}
                        </div>
                      )}
                      {shipsTo !== "all" && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#888880] dark:text-[#A0A0A0]">
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

      {/* Location Modal */}
      <ModalWrapper
        isOpen={isLocationOpen}
        onClose={() => setIsLocationOpen(false)}
        title="Delivery Destination"
      >
        {isLocationConfirmScreen ? (
          <div className="text-center space-y-4 select-none">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#FAF5F2] dark:bg-[#2A2A2D] flex items-center justify-center text-[#F6C75D]">
              <Globe className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[#888880] dark:text-[#A0A0A0]">We detected that you are in</p>
              <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{shipsTo === "all" ? "Anywhere" : countryName(shipsTo)}</p>
            </div>
            <p className="text-xs text-[#888880] dark:text-[#A0A0A0] px-2 leading-relaxed">
              Do you want to change your delivery location to view matching products?
            </p>
            <div className="pt-2 space-y-2">
              <button
                onClick={() => setIsLocationConfirmScreen(false)}
                className="w-full bg-[#111111] dark:bg-[#FAF5F2] hover:bg-[#222222] dark:hover:bg-[#EAE0D8] text-white dark:text-[#111111] text-xs font-semibold py-2.5 rounded-full transition-colors duration-200"
              >
                Yes, Change Location
              </button>
              <button
                onClick={() => setIsLocationOpen(false)}
                className="w-full bg-transparent border border-[#C8C8C0] dark:border-[#333333] text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] text-xs font-semibold py-2.5 rounded-full transition-colors duration-200"
              >
                No, Keep Location
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 select-none">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#888880] dark:text-[#A0A0A0]">Select Destination</span>
              <button
                onClick={() => setIsLocationConfirmScreen(true)}
                className="text-[10px] font-semibold text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] hover:underline"
              >
                ← Back
              </button>
            </div>
            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1.5 scrollbar-thin">
              <button
                onClick={() => {
                  setCountry(null);
                  setIsLocationOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between ${
                  shipsTo === "all"
                    ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]"
                    : "hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] text-[#111111] dark:text-[#FAF5F2]"
                }`}
              >
                <span>Anywhere</span>
                {shipsTo === "all" && <CheckCircle2 className="h-3.5 w-3.5" />}
              </button>
              {COUNTRIES.map(c => {
                const isActive = shipsTo === c.code;
                return (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCountry(c.code);
                      setIsLocationOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between ${
                      isActive
                        ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]"
                        : "hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] text-[#111111] dark:text-[#FAF5F2]"
                    }`}
                  >
                    <span>{c.name}</span>
                    {isActive && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </ModalWrapper>

      {/* Currency Modal */}
      <ModalWrapper
        isOpen={isCurrencyOpen}
        onClose={() => setIsCurrencyOpen(false)}
        title="Preferred Currency"
      >
        <div className="space-y-4 select-none">
          <p className="text-xs text-[#888880] dark:text-[#A0A0A0]">Choose your preferred currency to convert prices dynamically:</p>
          <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
            {Object.entries(currencies).map(([code, info]) => {
              const isActive = currency.code === code;
              const FLAGS: Record<string, string> = {
                USD: "🇺🇸", GBP: "🇬🇧", EUR: "🇪🇺", CAD: "🇨🇦", AUD: "🇦🇺",
                NGN: "🇳🇬", ZAR: "🇿🇦", KES: "🇰🇪", GHS: "🇬🇭",
              };
              return (
                <button
                  key={code}
                  onClick={() => {
                    setCurrencyCode(code);
                    setIsCurrencyOpen(false);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between h-[76px] ${
                    isActive
                      ? "bg-[#111111] dark:bg-[#FAF5F2] border-transparent text-white dark:text-[#111111] shadow-md"
                      : "bg-[#FAFAFA] dark:bg-[#151515] border-[#E8E8E8] dark:border-[#222222] text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] hover:border-[#C8C8C0] dark:hover:border-[#333333]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm">{FLAGS[code] || info.symbol}</span>
                    <span className="text-[10px] font-bold tracking-wider opacity-70">{code}</span>
                  </div>
                  <span className="text-[11px] font-semibold truncate mt-1.5">{info.symbol} - {code}</span>
                </button>
              );
            })}
          </div>
        </div>
      </ModalWrapper>

      <SiteFooter />
    </div>
  );
}

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function ModalWrapper({ isOpen, onClose, title, children }: ModalWrapperProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#000000]/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in" 
        onClick={onClose} 
      />
      {/* Modal Box */}
      <div className="relative bg-white dark:bg-[#1E1E1E] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] w-full max-w-sm overflow-hidden shadow-2xl z-10 transition-all duration-300 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#F2F3F5] dark:border-[#222222]">
          <h3 className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] uppercase tracking-wider">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-[#888880] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#FAF5F2] p-1 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] transition-colors"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Body Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
