import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Package, Flame, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import FlashDealCountdown from "@/components/FlashDealCountdown";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import PromoBanner from "@/components/PromoBanner";
import SiteFooter from "@/components/SiteFooter";
import ProductImage from "@/components/product/ProductImage";
import { ProductCard } from "@/components/product/ProductCard";
import { MasonryFeedGrid } from "@/components/product/MasonryFeedGrid";
import HeroSlider from "@/components/HeroSlider";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { BottomTabBar } from "@/components/ui/BottomTabBar";
import { useCurrency } from "@/hooks/useCurrency";
import { useHomepageSnapshotData, FEEDS, type FeedItem } from "@/hooks/useHomepage";
import { useCatalogueFeed, FEED_PAGE_SIZE, type CatalogueFeedItem } from "@/hooks/useCatalogueFeed";
import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { clampDisplayAspectRatio } from "@/lib/imageHeaders";
import { useSEO } from "@/hooks/useSEO";
import { HOME_PAGE_SEO } from "@/lib/pageSeo";
import RegionalPreferences from "@/components/RegionalPreferences";

/**
 * The catch-all section - the one section that keeps going.
 *
 * The other sections are merchandising rails with a deliberate, bounded item count
 * (see FEEDS in useHomepage), so they render as a complete set. This one promises
 * the whole catalogue, which is why it is the section that paginates.
 */
const CATCH_ALL_FEED = "new_arrivals";

/**
 * Cards a merchandising rail shows once its data has resolved (SECTION_LIMIT in
 * `useHomepage`). The skeleton reserves exactly this many tiles so the section
 * does not change height when the real rail replaces it.
 */
const RAIL_FEED_SIZE = 10;

/** One shape for both sources: the seeded rails and the paginated catch-all. */
type FeedCard = {
  id: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  stockQuantity: number;
  averageRating: number;
  reviewCount: number;
  soldCount: number;
  currency: string;
  sellerId: string;
  imageUrl: string | null;
  imageSmallUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  flashDealEndAt: string | null;
};

/**
 * The discount the seller actually set.
 *
 * Derived, never invented: a badge appears only when `compare_at_price` is
 * genuinely above the live price, so the percentage on a card always corresponds to
 * two real numbers on the product.
 */
function discountLabel(price: number, compareAtPrice: number | null) {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return `-${Math.round((1 - price / compareAtPrice) * 100)}%`;
}

function fromFeedItem(product: FeedItem): FeedCard {
  const image = product.product_images.find(item => item.is_primary) ?? product.product_images[0];
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compare_at_price,
    stockQuantity: product.stock_quantity,
    averageRating: product.average_rating,
    reviewCount: product.review_count,
    soldCount: Number(product.sold_count ?? 0),
    currency: product.currency,
    sellerId: product.seller_id,
    imageUrl: image?.image_url ?? null,
    imageSmallUrl: image?.card_small_url ?? null,
    imageWidth: image?.image_width ?? null,
    imageHeight: image?.image_height ?? null,
    flashDealEndAt: product.flash_deal_end_at,
  };
}

function fromPageItem(product: CatalogueFeedItem): FeedCard {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    compareAtPrice: product.compare_at_price,
    stockQuantity: product.stock_quantity,
    averageRating: product.average_rating,
    reviewCount: product.review_count,
    // The paginated query cannot price social proof per row (sold counts are
    // aggregated in the feed RPC), so these tiles state what they know rather than
    // showing a zero.
    soldCount: 0,
    currency: product.currency,
    sellerId: product.seller_id,
    imageUrl: product.image_url,
    imageSmallUrl: product.image_small_url,
    imageWidth: product.image_width,
    imageHeight: product.image_height,
    flashDealEndAt: product.flash_deal_end_at,
  };
}


export default function LandingPage() {
  const { categories, counts, categoryImages, heroSlides, heroLoading, feeds, loading, snapshotError, retrySnapshot, snapshotFetching } = useHomepageSnapshotData();
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();

  // Copy lives in HOME_PAGE_SEO so index.html's static <head> and this render
  // cannot describe `/` differently. src/test/pageSeoHead.test.ts fails if the
  // shell drifts from that constant, which is what makes the served page and the
  // rendered page one document rather than two that happen to agree today.
  useSEO({
    title: HOME_PAGE_SEO.title,
    description: HOME_PAGE_SEO.description,
    url: "/",
  });

  // The catalogue is seeded with 26 departments so it can scale, which means most of
  // them hold no stock today. Navigation must only offer departments a shopper can
  // actually buy from - an empty department is a dead end that reads as a broken site.
  const populatedCategories = useMemo(() => categories.filter(category => (counts[category.id] ?? 0) > 0), [categories, counts]);
  const visibleCategories = useMemo(() => populatedCategories.slice(0, 8), [populatedCategories]);
  const heroFallback = useMemo(() => [feeds.flash_deals, ...FEEDS.map((feed) => feeds[feed.key])].flat().find(Boolean), [feeds]);

  // â”€â”€ Home feed: masonry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Returning from a product page re-renders the feed from the IndexedDB cache and
  // puts the shopper back where they were, instead of at the top of a page they had
  // already read past.
  useScrollRestoration();

  // A waterfall layout needs each tile's ratio before its image loads, and that
  // ratio comes from the image row. `clampDisplayAspectRatio` bounds it to
  // [3:4, 1:1] so one extreme upload cannot claim a whole column, and answers 1 for
  // a row whose dimensions were never captured - so every legacy listing renders as
  // the square it always did. See
  // supabase/migrations/20260930000000_product_image_dimensions.sql.
  const getAspectRatio = useCallback(
    (card: FeedCard) => clampDisplayAspectRatio(card.imageWidth, card.imageHeight),
    [],
  );

  // Mapped once per feed rather than inline: a new array identity on every render
  // would make the masonry layout recompute the placement it has already computed.
  const railCards = useMemo(() => {
    const byKey = new Map<string, FeedCard[]>();
    FEEDS.forEach((feed) => byKey.set(feed.key, feeds[feed.key].map(fromFeedItem)));
    return byKey;
  }, [feeds]);

  // Products already on the page in another section are never repeated in the
  // catch-all: the homepage is a stack of distinct stories, not one catalogue
  // printed five times.
  const catchAllExcludeIds = useMemo(() => {
    const shown = new Set<string>(feeds.flash_deals.map((product) => product.id));
    FEEDS.forEach((feed) => {
      if (feed.key === CATCH_ALL_FEED) return;
      feeds[feed.key].forEach((product) => shown.add(product.id));
    });
    return [...shown];
  }, [feeds]);

  // The catch-all continues from the last row the seeded page ended on. That section
  // is ordered newest-first, which is exactly the order the keyset cursor walks, so
  // page two is a genuine continuation rather than a re-query from the top.
  const catchAllStartCursor = useMemo(() => {
    const seeded = feeds[CATCH_ALL_FEED];
    const last = seeded[seeded.length - 1];
    return last ? { createdAt: last.created_at, id: last.id } : null;
  }, [feeds]);

  const catchAllFeed = useCatalogueFeed({
    startCursor: catchAllStartCursor,
    excludeIds: catchAllExcludeIds,
    // The seed cursor is only known once the homepage data resolves. Starting the
    // query before that would page from the TOP of the catalogue, and the first
    // batch would repeat products the rails above have already rendered.
    enabled: !loading,
  });

  const catchAllCards = useMemo(() => {
    const seeded = railCards.get(CATCH_ALL_FEED) ?? [];
    return [...seeded, ...catchAllFeed.items.map(fromPageItem)];
  }, [railCards, catchAllFeed.items]);

  const renderFeedCard = useCallback(
    (card: FeedCard, _index: number, state: { priority: boolean }) => {
      const discount = discountLabel(card.price, card.compareAtPrice);
      return (
        <ProductCard
          product={{
            id: card.id,
            title: card.title,
            price: card.price,
            compareAtPrice: card.compareAtPrice,
            stockQuantity: card.stockQuantity,
            averageRating: card.averageRating,
            reviewCount: card.reviewCount,
            soldCount: card.soldCount,
            imageUrl: card.imageUrl,
            imageSmallUrl: card.imageSmallUrl,
            flashDealEndAt: card.flashDealEndAt,
            badge: discount ? { label: discount, tone: "destructive" as const } : null,
          }}
          formatPrice={(amount) => formatPrice(amount, card.currency)}
          imageAspectRatio={getAspectRatio(card)}
          priority={state.priority}
        />
      );
    },
    [formatPrice, getAspectRatio],
  );

  const visibleFeeds = useMemo(
    () =>
      FEEDS.filter((feed) => {
        if (loading) return true;
        // The rails still hide when they have nothing to say - a heading over an
        // empty rail tells the shopper nothing.
        if (feed.key !== CATCH_ALL_FEED) return (railCards.get(feed.key)?.length ?? 0) > 0;
        // The catch-all always renders: it is the section that promises the whole
        // catalogue, so it is the one place the homepage's real empty state belongs
        // ("Approved listings will appear here") rather than a silent page with no
        // product section at all.
        return true;
      }),
    [loading, railCards],
  );

  // The bottom tab bar is fixed OVER the page and, below md, grows by the iOS
  // home-indicator inset (`pb-[env(safe-area-inset-bottom)]` on the bar itself).
  // A flat pb-16 (64px) covered the bar's ~58px of content but not the ~34px
  // inset too, so on a modern iPhone the footer's last row sat behind the bar's
  // safe-area padding. The reservation now mirrors the bar exactly: 4rem + inset
  // below md, where the bar hides, back to the flat 4rem.
  return <div className="min-h-screen bg-[#FAFAFA] font-sans text-[#111111] antialiased dark:bg-[#121212] dark:text-[#FAF5F2] pb-[calc(4rem_+_env(safe-area-inset-bottom,0px))] md:pb-16">
    <MarketplaceNavbar showRegionalPreferences={false} categories={populatedCategories.map(category => ({ label: category.name, value: category.id }))} />
    <BottomTabBar />
    <CartDrawer /><PromoBanner />
    <main className="flex flex-col pb-8">
      {snapshotError && (
        <Container className="order-first w-full pt-4">
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">{t("home.snapshotError")}</p>
                <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">{t("home.snapshotErrorDesc")}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void retrySnapshot()}
              disabled={snapshotFetching}
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 font-semibold text-amber-950 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
            >
              <RefreshCw className={`h-4 w-4 ${snapshotFetching ? "animate-spin" : ""}`} aria-hidden="true" />
              {t("common.retry")}
            </button>
          </div>
        </Container>
      )}
      {/* Public homepage opening: identity, hero, then one category discovery block. */}
      {/* Single H1 for the page. Visually hidden so the hero design is untouched,
          but present for crawlers and screen readers (the hero artwork already
          states the value proposition visually). */}
      <h1 className="sr-only">{t("home.pageTitle")}</h1>
      <div className="border-b border-[#E8E8E8] bg-[#F8F3F0] dark:border-[#222222] dark:bg-[#1C1C1E]">
        <Container className="py-4">
          <div className="mb-4 lg:hidden">
            <p className="text-2xl font-black tracking-tight text-[#111111] dark:text-[#FAF5F2]">{t("home.marketplaceTitle")}</p>
            <p className="mt-1 text-sm text-[#6E6C64] dark:text-[#A0A0A0]">{t("home.marketplaceSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {/* Primary hero carousel.

                ONE HeroSlider instance across both states: `slides=[]` while the
                hero query is in flight (the slider paints a neutral pending stage),
                then live slides the moment they arrive.

                The previous shape swapped a placeholder <div> for the slider on
                data arrival, which REPLACED the <picture>/<img> DOM nodes and
                repainted the identical box. A same-size repaint is a new Largest
                Contentful Paint candidate, so LCP tracked the QUERY (~4.6s on the
                throttled phone) even though the image bytes were ready before
                first paint. One instance lets React patch slide 0 onto the
                pending stage in place - same key, same props, same src - so the
                <img> never repaints and LCP lands with the first commit.

                `heroLoading ||` is checked alongside length so the
                loaded-but-empty case still falls through to the product hero. */}
            <div className="min-w-0">
              {heroLoading || heroSlides.length > 0 ? (
                <HeroSlider slides={heroSlides} />
              ) : heroFallback ? (
                <Link to={`/product/${heroFallback.id}`} className="group relative flex aspect-[16/9] min-h-[240px] w-full overflow-hidden rounded-2xl bg-[#F6C75D] sm:min-h-[280px] md:aspect-[21/9] md:min-h-[320px] lg:min-h-[340px]">
                  <div className="absolute inset-y-0 right-0 w-[56%] overflow-hidden">
                    {heroFallback.product_images[0]?.image_url && <ProductImage src={heroFallback.product_images[0].image_url} alt={heroFallback.title} fit="contain" className="h-full w-full p-3 transition-transform duration-500 group-hover:scale-105 md:p-6" loading="eager" />}
                  </div>
                  <div className="relative z-10 flex w-[62%] flex-col justify-center bg-gradient-to-r from-[#F6C75D] via-[#F6C75D]/95 to-transparent p-5 pr-2 text-[#111111] md:p-10">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#5C3A00]">{t("home.featuredProduct")}</p>
                    <p className="line-clamp-3 text-xl font-black leading-tight md:text-4xl">{heroFallback.title}</p>
                    <p className="mt-3 text-sm font-semibold text-[#5C3A00]">{formatPrice(heroFallback.price, heroFallback.currency)}</p>
                  </div>
                </Link>
              ) : null}
            </div>

          </div>

          <div className="mt-4 border-t border-[#E8E8E8] pt-3 dark:border-[#333333]">
            <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
              <div className="min-w-0 rounded-xl bg-white px-3 py-2 dark:bg-[#1A1A1A]">
                <RegionalPreferences showLabel className="w-full justify-start px-0 py-0" />
              </div>
              <div className="rounded-xl bg-white px-3 py-2 dark:bg-[#1A1A1A]">
                <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">{t("home.verifiedSellers")}</p>
                <p className="mt-0.5 text-[11px] text-[#6E6C64] dark:text-[#A0A0A0]">{t("home.verifiedSellersDesc")}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2 dark:bg-[#1A1A1A]">
                <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">{t("home.fastDelivery")}</p>
                <p className="mt-0.5 text-[11px] text-[#6E6C64] dark:text-[#A0A0A0]">{t("home.fastDeliveryDesc")}</p>
              </div>
            </div>
          </div>

        </Container>
      </div>

      {feeds.flash_deals.length > 0 && (
        // content-visibility lets the browser skip laying out and painting this
        // rail until it nears the viewport, which is where the audit's ~1.1s of
        // Style & Layout was going. The intrinsic size keeps the scrollbar from
        // jumping while the real height is still unknown.
        <Container className="w-full order-2 py-10 [content-visibility:auto] [contain-intrinsic-size:auto_600px]">
          <SectionHeader title={t("home.flashDeals")} subtitle={<span className="inline-flex items-center gap-2"><Flame className="h-4 w-4 text-destructive" />{t("home.limitedTime")}</span>} href="/marketplace?sort=flash_deals" linkLabel={t("common.viewAll")} className="mb-5" />
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
                        <Package className="h-8 w-8 text-[#6E6C64]" />
                      </div>
                    )}
                    {discount && (
                      <span className="absolute left-3 top-3 rounded bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">-{discount}%</span>
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
                      <span className="font-bold text-destructive">{formatPrice(product.price)}</span>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="text-xs text-[#6E6C64] dark:text-[#A0A0A0] line-through">{formatPrice(product.compare_at_price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

        </Container>
      )}

      {/* Shop by Category - Grid */}
      <Container className="w-full order-1 py-10 [content-visibility:auto] [contain-intrinsic-size:auto_500px]">
        {/* No "All categories" link: the department cards below are the way into a
            department now, and this header used to be a second route to the bare
            /categories directory sitting right above them. */}
        <SectionHeader title={t("home.shopByCategory")} subtitle={t("home.browse")} className="mb-5" />
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-[#E8E8E8] bg-white p-3 dark:border-[#222222] dark:bg-[#1A1A1A]">
                <div className="aspect-[4/3] animate-pulse rounded-lg bg-[#F3EEE9] dark:bg-[#28282B]" />
                <div className="pt-3"><div className="h-4 w-2/3 animate-pulse rounded bg-[#F2F3F5] dark:bg-[#202020]" /><div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-[#F2F3F5] dark:bg-[#202020]" /></div>
              </div>
            ))}
          </div>
        ) : visibleCategories.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {visibleCategories.map(category => (
              <Link
                key={category.id}
                to={`/categories/${category.slug}`}
                className="group overflow-hidden rounded-xl border border-[#E8E8E8] bg-white p-3 transition hover:-translate-y-0.5 hover:border-[#111111] hover:shadow-lg dark:border-[#333333] dark:bg-[#1E1E1E] dark:hover:border-[#FAF5F2]"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-[#F3EEE9] dark:bg-[#28282B]">
                  {categoryImages[category.id] ? <img src={categoryImages[category.id]} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" /> : <Package className="absolute inset-0 m-auto h-7 w-7 text-[#B49A75]" />}
                </div>
                <div className="pt-3">
                  <p className="line-clamp-1 text-sm font-bold">{category.name}</p>
                  <p className="mt-1 text-xs text-[#6E6C64] dark:text-[#A0A0A0]">{counts[category.id]} {counts[category.id] === 1 ? "product" : "products"}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#555550] group-hover:text-[#111111] dark:group-hover:text-white">Explore <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#D8D8D2] bg-white px-5 py-10 text-center text-sm text-[#6E6C64] dark:text-[#A0A0A0] dark:border-[#333333] dark:bg-[#1A1A1A]">
            Categories will appear when approved products are available.
          </div>
        )}
      </Container>

      {/* Product sections - a masonry (waterfall) feed per merchandising story.
          Only a section that genuinely qualifies renders: Flash Deals needs a live
          time-boxed deal, Best Sellers needs delivered units, Trending needs real
          visits in the last 30 days. The last section is the catch-all, so every
          approved product is reachable from the homepage.

          Placement is shortest-column, so cards of different heights pack without
          the ragged gaps an aligned grid leaves - and because each tile reserves its
          image height from the stored dimensions, the page height is already correct
          on the first paint. Only NEW items are ever placed, so nothing on screen
          moves when a page arrives. */}
      {/* Product rails mount in the first React commit. They render reserved
          skeletons while the snapshot is in flight, so a slow image/font/API
          request cannot leave the mobile page with a blank region waiting for the
          window `load` event. CSS content-visibility still defers expensive
          off-screen painting without deferring the DOM or its loading state. */}
      <Container className="w-full order-4 [content-visibility:auto] [contain-intrinsic-size:auto_1600px]">
          {visibleFeeds.map(feed => {
            const isCatchAll = feed.key === CATCH_ALL_FEED;
            const cards = isCatchAll ? catchAllCards : railCards.get(feed.key) ?? [];
            // The rails are a fixed, complete set once the homepage data resolves; the
            // catch-all stays on skeletons while EITHER source is still emptying out -
            // otherwise the catch-all would flash its empty state for the moment
            // between the homepage data arriving and its own first page landing.
            const sectionLoading = isCatchAll
              ? loading || (catchAllFeed.loading && cards.length === 0)
              : loading;
            return (
              <section key={feed.key} className="mb-12">
                <SectionHeader title={t(feed.titleKey)} subtitle={t(feed.subtitleKey)} href={feed.href} linkLabel={t("common.viewAll")} className="mb-4" />
                <MasonryFeedGrid
                  label={t(feed.titleKey)}
                  items={cards}
                  getAspectRatio={getAspectRatio}
                  renderItem={renderFeedCard}
                  loading={sectionLoading}
                  skeletonCount={isCatchAll ? FEED_PAGE_SIZE : RAIL_FEED_SIZE}
                  loadingMore={isCatchAll ? catchAllFeed.loadingMore : false}
                  error={isCatchAll ? catchAllFeed.error : undefined}
                  onRetry={isCatchAll ? catchAllFeed.retry : undefined}
                  hasMore={isCatchAll ? catchAllFeed.hasMore : false}
                  onLoadMore={isCatchAll ? catchAllFeed.loadMore : undefined}
                  emptyState={
                    <div className="rounded-2xl border border-dashed border-[#D8D8D2] bg-white px-5 py-10 text-center text-sm text-[#6E6C64] dark:border-[#333333] dark:bg-[#1A1A1A] dark:text-[#A0A0A0]">
                      {t(feed.emptyKey)}
                    </div>
                  }
                />
              </section>
            );
          })}
      </Container>
    </main>
    <SiteFooter />
  </div>;
}
