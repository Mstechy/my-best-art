import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, Grid3X3, List, Package } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/product/ProductImage";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { resolveCollectionProducts, trackCollectionView } from "@/lib/collectionResolver";

type CollectionData = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  badge: string | null;
  cta_label: string;
  slug: string;
  meta_title: string | null;
  meta_description: string | null;
  product_count: number;
  is_automatic: boolean;
  rules: Record<string, string> | null;
  hero_enabled: boolean;
  hero_overlay_opacity: number;
};

type Product = {
  id: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  created_at: string;
  average_rating: number;
  review_count: number;
  brand: string | null;
  stock_quantity: number;
  product_images: { image_url: string; is_primary: boolean }[];
};

type SortOption = "newest" | "price_low" | "price_high" | "rating" | "best_selling" | "popularity";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "rating", label: "Highest Rated" },
  { value: "best_selling", label: "Best Selling" },
  { value: "popularity", label: "Most Popular" },
];

export default function CollectionPage() {
  const { slug } = useParams();
  const { formatPrice } = useCurrency();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const trackedRef = useRef(false);
  const PER_PAGE = 20;

  const loadCollection = useCallback(async () => {
    if (!slug) return;
    setLoading(true);

    // Load collection metadata
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: c } = await (supabase as any)
      .from("marketplace_collections")
      .select("id,title,description,image_url,badge,cta_label,slug,meta_title,meta_description,product_count,is_automatic,rules,hero_enabled,hero_overlay_opacity")
      .eq("slug", slug)
      .maybeSingle();

    if (!c) {
      setLoading(false);
      return;
    }

    setCollection(c as unknown as CollectionData);

    // Track view once per session (useRef to avoid triggering re-renders)
    if (!trackedRef.current) {
      trackCollectionView(c.id);
      trackedRef.current = true;
    }

    // Resolve products (works for both automatic and manual collections)
    let productIds = await resolveCollectionProducts(c.id, 100);

    console.log("[CollectionPage] Collection:", c.title, "is_automatic:", c.is_automatic, "rules:", c.rules, "resolved:", productIds.length);

    // Fallback for automatic collections: if resolver returns 0 but rules exist,
    // try loading products directly by category/brand so the page isn't empty.
    if (productIds.length === 0 && c.is_automatic && c.rules) {
      const rules = c.rules as Record<string, string>;
      const categoryId = rules.category_id;
      const brand = rules.brand;

      const fallbackQuery = supabase
        .from("products")
        .select("id")
        .eq("status", "active")
        .eq("is_approved", true);

      if (categoryId) {
        fallbackQuery.eq("category_id", categoryId);
      } else if (brand) {
        fallbackQuery.ilike("brand", brand);
      }

      const { data: fallbackData } = await fallbackQuery.limit(100);
      productIds = (fallbackData || []).map((row: { id: string }) => row.id);
      console.log("[CollectionPage] Fallback resolved:", productIds.length, "products");
    }

    if (productIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: productsData } = await (supabase as any)
        .from("products")
        .select("id,title,price,compare_at_price,currency,created_at,average_rating,review_count,brand,stock_quantity,product_images(image_url,is_primary)")
        .in("id", productIds)
        .eq("status", "active")
        .eq("is_approved", true);

      const productMap = new Map(
        ((productsData || []) as unknown as Product[]).map((p) => [p.id, p])
      );

      // Preserve the order from the resolver
      const orderedProducts = productIds
        .map((id) => productMap.get(id))
        .filter((p): p is Product => p !== undefined);

      setProducts(orderedProducts);
    } else {
      setProducts([]);
    }

    setLoading(false);
  }, [slug]);

  useEffect(() => {
    loadCollection();
  }, [loadCollection]);

  // Sorting
  const sorted = useMemo(() => {
    const list = [...products];
    switch (sort) {
      case "price_low":
        return list.sort((a, b) => a.price - b.price);
      case "price_high":
        return list.sort((a, b) => b.price - a.price);
      case "rating":
        return list.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
      case "best_selling":
        return list.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
      case "popularity":
        return list.sort((a, b) => (b.average_rating || 0) * (b.review_count || 0) - (a.average_rating || 0) * (a.review_count || 0));
      default:
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [products, sort]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = sorted.slice(0, page * PER_PAGE);

  const loadMore = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  // SEO meta tags
  useEffect(() => {
    if (!collection) return;
    const title = collection.meta_title || `${collection.title} — MarketHub`;
    const description = collection.meta_description || collection.description || `Browse ${collection.title} collection on MarketHub`;
    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);
  }, [collection]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNavbar />
        <main className="mx-auto max-w-7xl px-4 py-20 text-center text-muted-foreground">
          Loading collection…
        </main>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNavbar />
        <main className="mx-auto max-w-7xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Collection unavailable</h1>
          <p className="mt-2 text-muted-foreground">This collection may have been removed or is no longer active.</p>
          <Link to="/marketplace" className="mt-4 inline-block underline">
            Browse marketplace
          </Link>
        </main>
      </div>
    );
  }

  const overlayOpacity = collection.hero_overlay_opacity ?? 0.45;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] dark:bg-[#111111] dark:text-[#FAF5F2]">
      <MarketplaceNavbar />

      {/* Breadcrumb */}
      <div className="border-b border-[#E8E8E8] bg-white dark:border-[#222222] dark:bg-[#1A1A1A]">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
          <nav className="flex items-center gap-2 text-xs text-[#888880]">
            <Link to="/" className="hover:text-[#111111] dark:hover:text-[#FAF5F2]">Home</Link>
            <span>/</span>
            <span className="text-[#111111] dark:text-[#FAF5F2] font-medium">{collection.title}</span>
          </nav>
        </div>
      </div>

      <main>
        {/* Hero Banner with overlay */}
        {collection.image_url ? (
          <section className="relative overflow-hidden bg-[#111111]">
            <div className="relative aspect-[21/9] min-h-[240px] w-full md:min-h-[320px]">
              <img
                src={collection.image_url}
                alt={collection.title}
                className="h-full w-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to right, rgba(0,0,0,${overlayOpacity + 0.2}) 0%, rgba(0,0,0,${overlayOpacity * 0.8}) 100%)`,
                }}
              />
              <div className="absolute inset-0 flex items-center">
                <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
                  <div className="max-w-xl">
                    {collection.badge && (
                      <span className="mb-3 inline-block rounded-full bg-[#F6C75D] px-3 py-1 text-xs font-bold text-[#5C3A00]">
                        {collection.badge}
                      </span>
                    )}
                    <h1 className="text-3xl font-black uppercase leading-none tracking-tight text-white md:text-5xl">
                      {collection.title}
                    </h1>
                    {collection.description && (
                      <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/80">
                        {collection.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="border-b border-[#E8E8E8] bg-[#F8F3F0] dark:border-[#222222] dark:bg-[#1C1C1E]">
            <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
              {collection.badge && (
                <span className="mb-3 inline-block rounded-full bg-[#F6C75D] px-3 py-1 text-xs font-bold text-[#5C3A00]">
                  {collection.badge}
                </span>
              )}
              <h1 className="text-3xl font-black uppercase tracking-tight md:text-5xl">
                {collection.title}
              </h1>
              {collection.description && (
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {collection.description}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Products section */}
        <section className="mx-auto max-w-7xl px-4 py-8 md:px-8">
          {/* Controls bar */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">
                {products.length} {products.length === 1 ? "product" : "products"}
              </h2>
              {collection.is_automatic && (
                <span className="rounded-full bg-[#F6C75D]/20 px-2.5 py-0.5 text-[10px] font-semibold text-[#5C3A00]">
                  AUTO
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Sort */}
              <div className="relative">
                <label htmlFor="sort-select" className="sr-only">Sort products</label>
                <select
                  id="sort-select"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value as SortOption);
                    setPage(1);
                  }}
                  className="h-9 appearance-none rounded-lg border border-[#E8E8E8] bg-white pl-3 pr-8 text-sm text-[#111111] dark:border-[#333333] dark:bg-[#1A1A1A] dark:text-[#FAF5F2]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888880]" />
              </div>

              {/* View mode toggle */}
              <div className="hidden sm:flex items-center rounded-lg border border-[#E8E8E8] bg-white dark:border-[#333333] dark:bg-[#1A1A1A]">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded-l-lg p-2 ${
                    viewMode === "grid"
                      ? "bg-[#111111] text-white dark:bg-[#FAF5F2] dark:text-[#111111]"
                      : "text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
                  }`}
                  aria-label="Grid view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`rounded-r-lg p-2 ${
                    viewMode === "list"
                      ? "bg-[#111111] text-white dark:bg-[#FAF5F2] dark:text-[#111111]"
                      : "text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
                  }`}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Products grid / list */}
          {paginated.length === 0 ? (
            <div className="rounded-xl border bg-card py-14 text-center">
              <Package className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">This collection is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Products will appear here when they match the collection criteria.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {paginated.map((product) => {
                const image =
                  product.product_images.find((item) => item.is_primary)?.image_url ||
                  product.product_images[0]?.image_url;
                const discount =
                  product.compare_at_price && product.compare_at_price > product.price
                    ? Math.round((1 - product.price / product.compare_at_price) * 100)
                    : null;

                return (
                  <Link
                    to={`/product/${product.id}`}
                    key={product.id}
                    className="group overflow-hidden rounded-xl border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-square bg-muted">
                      {image ? (
                        <ProductImage
                          src={image}
                          alt={product.title}
                          className="group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-7 w-7 text-muted-foreground" />
                        </div>
                      )}
                      {discount && (
                        <span className="absolute left-2 top-2 rounded bg-[#E53935] px-2 py-0.5 text-[10px] font-bold text-white">
                          -{discount}%
                        </span>
                      )}
                      {product.stock_quantity === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black">
                            Out of stock
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      {product.brand && (
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[#888880]">
                          {product.brand}
                        </p>
                      )}
                      <h2 className="mt-0.5 line-clamp-2 min-h-10 text-sm font-medium leading-snug">
                        {product.title}
                      </h2>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-bold">
                          {formatPrice(product.price)}
                        </span>
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(product.compare_at_price)}
                          </span>
                        )}
                      </div>
                      {product.review_count > 0 && (
                        <p className="mt-1 text-xs text-[#888880]">
                          ★ {product.average_rating.toFixed(1)} ({product.review_count})
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            /* List view */
            <div className="space-y-3">
              {paginated.map((product) => {
                const image =
                  product.product_images.find((item) => item.is_primary)?.image_url ||
                  product.product_images[0]?.image_url;
                const discount =
                  product.compare_at_price && product.compare_at_price > product.price
                    ? Math.round((1 - product.price / product.compare_at_price) * 100)
                    : null;

                return (
                  <Link
                    to={`/product/${product.id}`}
                    key={product.id}
                    className="group flex items-center gap-4 rounded-xl border bg-card p-3 transition hover:shadow-md"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {image ? (
                        <img
                          src={image}
                          alt={product.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      {discount && (
                        <span className="absolute left-1 top-1 rounded bg-[#E53935] px-1.5 py-0.5 text-[9px] font-bold text-white">
                          -{discount}%
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {product.brand && (
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[#888880]">
                          {product.brand}
                        </p>
                      )}
                      <h2 className="truncate text-sm font-medium">{product.title}</h2>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="font-bold text-sm">
                          {formatPrice(product.price)}
                        </span>
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(product.compare_at_price)}
                          </span>
                        )}
                      </div>
                      {product.review_count > 0 && (
                        <p className="text-xs text-[#888880]">
                          ★ {product.average_rating.toFixed(1)} ({product.review_count})
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Load more / pagination */}
          {page < totalPages && (
            <div className="mt-10 text-center">
              <button
                onClick={loadMore}
                className="rounded-full border border-[#E8E8E8] bg-white px-8 py-2.5 text-sm font-semibold transition hover:bg-[#F2F3F5] dark:border-[#333333] dark:bg-[#1A1A1A] dark:hover:bg-[#222222]"
              >
                Show more products ({sorted.length - paginated.length} remaining)
              </button>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}