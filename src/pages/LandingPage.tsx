import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Package, Flame, ArrowRight, AlertCircle, RefreshCw, Store, Truck, ShieldCheck } from "lucide-react";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import PromoBanner from "@/components/PromoBanner";
import SiteFooter from "@/components/SiteFooter";
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
  const { categories, counts, categoryImages, heroSlides, feeds, loading, snapshotError, retrySnapshot, snapshotFetching } = useHomepageSnapshotData();
  const { t } = useTranslation();
  const { formatPrice } = useCurrency();

  // The HTML launch shell is an out-of-flow first-paint layer. Keep it visible
  // until this route actually mounts, then reveal the real interactive tree
  // without removing the shell's nodes from the document (which would register
  // a large layout shift in Chrome's CLS observer).
  useEffect(() => {
    document.documentElement.classList.add("app-ready");
  }, []);

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
          density="marketplace"
        />
      );
    },
    [formatPrice, getAspectRatio],
  );

  const visibleFeeds = useMemo(
    () =>
      FEEDS.filter((feed) => {
        if (loading) {
          // Reserve one honest catalogue rail while the snapshot is pending.
          // Rendering skeletons for every possible merchandising rail and then
          // removing empty rails when the response arrives moves the catch-all
          // section under the shopper's viewport on mobile. The resolved state
          // adds evidence-backed rails only after it knows they have products.
          return feed.key === CATCH_ALL_FEED;
        }
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
    <MarketplaceNavbar showRegionalPreferences={false} showCart={false} showPublicSecondaryNav categories={populatedCategories.map(category => ({ label: category.name, value: category.id }))} />
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
          <div className="min-w-0">
            {/* One stable hero instance. It paints the bundled launch campaign
                immediately and patches the CMS campaign into the same slide only
                when the query resolves; there is no blank interval or random
                product-to-banner swap. */}
            <div className="min-w-0">
              <HeroSlider slides={heroSlides} autoRotate={false} />
            </div>

          </div>

          <div className="mt-3 border-t border-[#E8E8E8] pt-3 dark:border-[#333333]">
            <div className="flex snap-x gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible">
              <div className="flex min-w-[175px] snap-start items-center gap-1.5 text-xs text-[#555550] sm:min-w-0 dark:text-[#A0A0A0]">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-[#9E6300]" aria-hidden="true" />
                <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">{t("home.verifiedSellers")}</span>
              </div>
              <div className="flex min-w-[175px] snap-start items-center gap-1.5 text-xs text-[#555550] sm:min-w-0 dark:text-[#A0A0A0]">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[#9E6300]" aria-hidden="true" />
                <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">{t("home.fastDelivery")}</span>
              </div>
              <div className="flex min-w-[175px] snap-start items-center gap-1.5 text-xs text-[#555550] sm:min-w-0 dark:text-[#A0A0A0]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9E6300]" aria-hidden="true" />
                <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">{t("home.easyReturns")}</span>
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {feeds.flash_deals.slice(0, 5).map((product, index) => {
              const card = fromFeedItem(product);
              const discount = discountLabel(card.price, card.compareAtPrice);
              return (
                <ProductCard
                  key={product.id}
                  product={{ id: card.id, title: card.title, price: card.price, compareAtPrice: card.compareAtPrice, stockQuantity: card.stockQuantity, averageRating: card.averageRating, reviewCount: card.reviewCount, imageUrl: card.imageUrl, imageSmallUrl: card.imageSmallUrl, flashDealEndAt: card.flashDealEndAt, badge: discount ? { label: discount, tone: "destructive" as const } : null }}
                  formatPrice={(amount) => formatPrice(amount, card.currency)}
                  imageAspectRatio={clampDisplayAspectRatio(card.imageWidth, card.imageHeight)}
                  priority={index < 4}
                  density="marketplace"
                />
              );
            })}
          </div>

        </Container>
      )}

      {/* Shop by Category - Grid */}
      <Container className="w-full order-1 py-8 [content-visibility:auto] [contain-intrinsic-size:auto_320px]">
        {/* Keep category discovery compact: these are navigation tokens, not
            promotional cards. The final token opens the complete department index. */}
        <SectionHeader title={t("home.shopByCategory")} subtitle={t("home.browse")} className="mb-5" />
        {loading ? (
          <div className="flex snap-x gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible md:grid-cols-6 lg:grid-cols-8">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex min-w-[76px] flex-col items-center gap-2 sm:min-w-0">
                <div className="h-16 w-16 animate-pulse rounded-full bg-[#F3EEE9] dark:bg-[#28282B]" />
                <div className="h-3 w-14 animate-pulse rounded bg-[#F2F3F5] dark:bg-[#202020]" />
              </div>
            ))}
          </div>
        ) : visibleCategories.length ? (
          <div className="flex snap-x gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible md:grid-cols-6 lg:grid-cols-8">
            {visibleCategories.slice(0, 6).map(category => (
              <Link
                key={category.id}
                to={`/categories/${category.slug}`}
                className="group flex min-w-[76px] snap-start flex-col items-center gap-2 text-center sm:min-w-0"
              >
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-[#E8E8E8] bg-[#F3EEE9] transition group-hover:border-[#111111] group-hover:shadow-md dark:border-[#333333] dark:bg-[#28282B] dark:group-hover:border-[#FAF5F2]">
                  {categoryImages[category.id] ? <img src={categoryImages[category.id]} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" /> : <Package className="absolute inset-0 m-auto h-6 w-6 text-[#B49A75]" />}
                </div>
                <span className="line-clamp-2 text-[11px] font-bold leading-tight">{category.name}</span>
                <span className="text-[10px] text-[#6E6C64] dark:text-[#A0A0A0]">{counts[category.id]}</span>
              </Link>
            ))}
            <Link to="/categories" className="group flex min-w-[76px] snap-start flex-col items-center gap-2 text-center sm:min-w-0">
              <span className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-[#C8C8C0] text-[#555550] transition group-hover:border-[#111111] dark:border-[#444444] dark:text-[#A0A0A0] dark:group-hover:border-[#FAF5F2]">
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-bold leading-tight">{t("home.allCategories")}</span>
            </Link>
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
      {/* Keep the feed's outer flow in normal layout. Applying content-visibility
          to this wrapper made the browser replace its 1600px intrinsic placeholder
          with the resolved masonry height several seconds after mobile paint,
          which produced a visible CLS burst. MasonryFeedGrid still windows each
          resolved tile individually, so long catalogues keep the paint savings. */}
      <Container className="w-full order-4">
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
