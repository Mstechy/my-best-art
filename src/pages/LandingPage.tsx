import { useMemo, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Package, Sparkles, Star, Zap, Clock, UserPlus, Flame, Shield, Truck, RefreshCw, Headphones } from "lucide-react";
import FlashDealCountdown from "@/components/FlashDealCountdown";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import PromoBanner from "@/components/PromoBanner";
import MarqueeBanner from "@/components/MarqueeBanner";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/product/ProductImage";
import HeroSlider from "@/components/HeroSlider";
import HorizontalScrollSection from "@/components/ui/HorizontalScrollSection";
import CategorySidebar from "@/components/CategorySidebar";
import { useCurrency } from "@/hooks/useCurrency";
import { useHomepageData, FEEDS, type FeedItem, type Seller } from "@/hooks/useHomepage";

export default function LandingPage() {
  const { categories, counts, heroSlides, heroLoading, feeds, sellers, loading } = useHomepageData();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();

  const visibleCategories = useMemo(() => categories.filter(category => counts[category.id] > 0).slice(0, 8), [categories, counts]);

  return <div className="min-h-screen bg-[#FAFAFA] font-sans text-[#111111] antialiased dark:bg-[#121212] dark:text-[#FAF5F2]">
    <MarketplaceNavbar categories={categories.map(category => ({ label: category.name, value: category.id }))} />
    <CartDrawer /><PromoBanner /><MarqueeBanner />
    <main className="pb-8">
      {/* Hero area — 3 columns: category tree | carousel | promo tiles (AliExpress/1688 style) */}
      <div className="border-b border-[#E8E8E8] bg-[#F8F3F0] dark:border-[#222222] dark:bg-[#1C1C1E]">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_220px] gap-4">
            {/* Left: category tree (hidden on mobile) */}
            <div className="hidden lg:block">
              <CategorySidebar
                selectedCategory={null}
                onSelect={(slug) => { if (slug) navigate(`/categories/${slug}`); }}
                categories={categories.map(category => ({ id: category.id, name: category.name, slug: category.slug }))}
              />
            </div>

            {/* Center: hero carousel */}
            <div className="min-w-0">
              {heroLoading ? (
                <div className="aspect-[21/9] min-h-[320px] animate-pulse rounded-2xl bg-[#F2F3F5] dark:bg-[#202020] md:min-h-[420px]" />
              ) : heroSlides.length > 0 ? (
                <HeroSlider slides={heroSlides} />
              ) : (
                <div className="flex aspect-[21/9] min-h-[320px] items-center justify-center rounded-2xl bg-white dark:bg-[#1E1E1E] md:min-h-[420px]">
                  <div className="text-center">
                    <Sparkles className="mx-auto mb-3 h-9 w-9 text-[#F6C75D]" />
                    <p className="font-semibold text-lg">Campaigns appear here when published</p>
                    <p className="mt-1 text-sm text-muted-foreground">Manage hero slides in Admin → Collections.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: promo tiles (hidden on mobile) */}
            <div className="hidden lg:flex flex-col gap-4">
              <Link to="/marketplace?promo=hot50" className="group flex-1 rounded-2xl bg-gradient-to-br from-[#E53935] to-[#C62828] p-4 flex flex-col justify-between text-white transition hover:shadow-lg">
                <Zap className="h-6 w-6" />
                <div>
                  <p className="text-lg font-bold leading-tight">Hot Deals</p>
                  <p className="text-xs text-white/80 mt-1">Up to 50% off</p>
                </div>
              </Link>
              <Link to="/marketplace?sort=newest" className="group flex-1 rounded-2xl bg-gradient-to-br from-[#111111] to-[#333333] dark:from-[#FAF5F2] dark:to-[#EAE0D8] p-4 flex flex-col justify-between text-white dark:text-[#111111] transition hover:shadow-lg">
                <Clock className="h-6 w-6" />
                <div>
                  <p className="text-lg font-bold leading-tight">New Arrivals</p>
                  <p className="text-xs text-white/80 dark:text-[#111111]/70 mt-1">Fresh finds daily</p>
                </div>
              </Link>
              <Link to="/auth/register" className="group flex-1 rounded-2xl bg-gradient-to-br from-[#F6C75D] to-[#E8A93D] p-4 flex flex-col justify-between text-[#111111] transition hover:shadow-lg">
                <UserPlus className="h-6 w-6" />
                <div>
                  <p className="text-lg font-bold leading-tight">Join MarketHub</p>
                  <p className="text-xs text-[#111111]/70 mt-1">Sell to millions</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Flash Deal Rail — real countdowns from flash_deal_end_at */}
      {feeds.flash_deals.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <div className="mb-5 flex items-end justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-[#E53935]" />
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#888880]">Limited time</p>
                <h2 className="mt-1 text-2xl font-bold">Flash Deals</h2>
              </div>
            </div>
            <Link to="/marketplace?sort=flash_deals" className="text-sm font-semibold hover:underline whitespace-nowrap">View all</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {feeds.flash_deals.slice(0, 5).map(product => {
              const image = product.product_images.find(i => i.is_primary)?.image_url || product.product_images[0]?.image_url;
              const discount = product.compare_at_price && product.compare_at_price > product.price
                ? Math.round((1 - product.price / product.compare_at_price) * 100)
                : null;
              return (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="group overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#222222] dark:bg-[#1A1A1A]"
                >
                  <div className="relative aspect-square bg-[#F2F3F5] dark:bg-[#202020]">
                    {image ? (
                      <ProductImage src={image} alt={product.title} className="group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-8 w-8 text-[#888880]" />
                      </div>
                    )}
                    {discount && (
                      <span className="absolute left-3 top-3 rounded bg-[#E53935] px-2 py-0.5 text-[10px] font-bold text-white">-{discount}%</span>
                    )}
                    {product.flash_deal_end_at && (
                      <div className="absolute bottom-2 inset-x-2 flex justify-center">
                        <FlashDealCountdown endAt={product.flash_deal_end_at} />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{product.title}</h3>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-bold text-[#E53935]">{formatPrice(product.price)}</span>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="text-xs text-[#888880] line-through">{formatPrice(product.compare_at_price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Trust / value props */}
      <section className="border-y border-[#E8E8E8] bg-white dark:border-[#222222] dark:bg-[#1A1A1A]">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: "Verified sellers", desc: "Every store reviewed" },
              { icon: Truck, title: "Fast delivery", desc: "Track every order" },
              { icon: RefreshCw, title: "Easy returns", desc: "Hassle-free refunds" },
              { icon: Headphones, title: "24/7 support", desc: "We're here to help" },
            ].map(item => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-[#F6C75D]/10 p-2 text-[#F6C75D]">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-[#888880]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category - Grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#888880]">Browse</p>
            <h2 className="mt-1 text-2xl font-bold">Shop by category</h2>
          </div>
          <Link to="/categories" className="text-sm font-semibold hover:underline whitespace-nowrap">All categories</Link>
        </div>
        {loading ? (
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-28 w-40 shrink-0 animate-pulse rounded-2xl bg-[#F2F3F5] dark:bg-[#202020]" />
            ))}
          </div>
        ) : visibleCategories.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {visibleCategories.map(category => (
              <Link
                key={category.id}
                to={`/categories/${category.slug}`}
                className="rounded-2xl border border-[#E8E8E8] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#222222] dark:bg-[#1A1A1A]"
              >
                <Package className="mb-4 h-6 w-6 text-[#F6C75D]" />
                <p className="font-semibold text-sm">{category.name}</p>
                <p className="mt-1 text-xs text-[#888880]">{counts[category.id]} {counts[category.id] === 1 ? "product" : "products"}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D8D8D2] bg-white px-5 py-10 text-center text-sm text-[#888880] dark:border-[#333333] dark:bg-[#1A1A1A]">
            Categories will appear when approved products are available.
          </div>
        )}
      </section>

      {/* Product Feeds - Horizontal Scroll */}
      {FEEDS.map(feed => (
        <HorizontalScrollSection
          key={feed.key}
          title={feed.title}
          subtitle={feed.subtitle}
          href={feed.href}
          loading={loading}
          loadingCount={8}
          emptyText={feed.empty}
          itemWidth={220}
          gap={16}
        >
          {feeds[feed.key].map(product => (
            <HorizontalProductCard
              key={product.id}
              product={product}
              seller={sellers.get(product.seller_id)}
              formatPrice={formatPrice}
            />
          ))}
        </HorizontalScrollSection>
      ))}
    </main>
    <SiteFooter />
  </div>;
}

// Horizontal scroll product card (compact, for carousel)
const HorizontalProductCard = memo(function HorizontalProductCard({
  product,
  seller,
  formatPrice,
}: {
  product: FeedItem;
  seller?: Seller;
  formatPrice: (amount: number, sourceCurrency?: string) => string;
}) {
  const image = useMemo(
    () => product.product_images.find(item => item.is_primary)?.image_url || product.product_images[0]?.image_url,
    [product.product_images]
  );
  const discount = useMemo(
    () => product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : null,
    [product.price, product.compare_at_price]
  );

  return (
    <Link
      to={`/product/${product.id}`}
      className="shrink-0 group overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#222222] dark:bg-[#1A1A1A]"
      style={{ width: 220 }}
      role="listitem"
    >
      <div className="relative aspect-square bg-[#F2F3F5] dark:bg-[#202020]">
        {image ? (
          <ProductImage
            src={image}
            alt={product.title}
            className="group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-8 w-8 text-[#888880]" />
          </div>
        )}
        {discount && (
          <span className="absolute left-3 top-3 rounded bg-[#E53935] px-2 py-0.5 text-[10px] font-bold text-white">
            -{discount}%
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-snug">{product.title}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-bold">{formatPrice(product.price, product.currency)}</span>
          {product.compare_at_price && product.compare_at_price > product.price && (
            <span className="text-xs text-[#888880] line-through">{formatPrice(product.compare_at_price, product.currency)}</span>
          )}
        </div>
        {product.review_count > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-[#666666] dark:text-[#A0A0A0]">
            <Star className="h-3 w-3 fill-[#F6C75D] text-[#F6C75D]" />
            {product.average_rating.toFixed(1)} <span>({product.review_count})</span>
          </div>
        )}
        {product.sold_count > 0 && (
          <p className="mt-1 text-xs text-[#888880]">{product.sold_count} sold</p>
        )}
        {seller && (
          <div className="mt-2 flex items-center gap-1 border-t border-[#F2F3F5] pt-2 text-[10px] text-[#888880] dark:border-[#262626]">
            <span className="truncate">{seller.full_name || "Seller"}</span>
            {seller.is_verified && <CheckCircle2 className="h-3 w-3 shrink-0 text-[#F6C75D]" />}
          </div>
        )}
      </div>
    </Link>
  );
});
