import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { Loader2, Package, RefreshCw } from "lucide-react";

import InfiniteScrollTrigger from "@/components/ui/InfiniteScrollTrigger";
import {
  ESTIMATED_CARD_BODY_HEIGHT,
  useMasonryPlacement,
  useMasonryViewport,
} from "@/hooks/useMasonryLayout";
import { cn } from "@/lib/utils";

export interface MasonryFeedItem {
  id: string;
}

type MasonryFeedGridProps<T extends MasonryFeedItem> = {
  /** The full list so far, in ranking order. Appended to, never reordered. */
  items: readonly T[];
  /** Ratio (w/h) the tile reserves. Use `clampDisplayAspectRatio` to derive it. */
  getAspectRatio: (item: T) => number;
  /**
   * `priority` is true for the first row only, where the images are inside the
   * largest-contentful-paint area and should load eagerly; everything below the
   * fold stays lazy.
   */
  renderItem: (item: T, index: number, state: { priority: boolean }) => ReactNode;
  /** Accessible name of the list, e.g. "Best sellers". */
  label: string;
  /** First load: render skeletons instead of items. */
  loading?: boolean;
  /** A page is in flight under the last row. */
  loadingMore?: boolean;
  /** Set when the last page failed; renders a retry footer. */
  error?: unknown;
  onRetry?: () => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  skeletonCount?: number;
  emptyState?: ReactNode;
  className?: string;
};

/**
 * How many tiles in the first row load eagerly.
 *
 * The row size cannot be known before the columns are computed, so this is an
 * upper bound: with 5 desktop columns it covers the first row, and on a 2-column
 * phone it covers the first three rows - still only 6 images, and exactly the ones
 * above the fold on the smallest screen.
 */
const PRIORITY_TILE_COUNT = 6;

/**
 * A representative mix of reserved ratios for skeletons.
 *
 * The real ratios are unknown before the data arrives - that is the whole reason
 * the dimensions are stored - so the placeholder silhouette is a spread across the
 * clamp window instead of a lie about specific products. What matters for layout
 * stability is that each skeleton RESERVES a box of about the right height, so
 * swapping skeletons for real tiles does not move the page.
 */
const SKELETON_RATIOS = [1, 0.75, 0.85, 1, 0.78, 0.9, 0.75, 1, 0.82, 1, 0.75, 0.88];

function dedupeById<T extends MasonryFeedItem>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

const SKELETON_TILE_CLASS =
  "w-full animate-pulse overflow-hidden rounded-xl border border-border bg-card";

/**
 * Masonry (waterfall) feed for the home page.
 *
 * Three properties this component is responsible for, in order of importance:
 *
 *   1. **Nothing already on screen moves.** Placement is append-only (see
 *      `useMasonryPlacement`), so a page that arrives while the shopper is reading
 *      the feed fills the shortest columns and leaves the visible cards untouched.
 *   2. **No layout shift.** Every tile reserves its image height from the stored
 *      dimensions before the file loads, so the page height is known from the first
 *      paint and the shopper's scroll position never moves under them.
 *   3. **One tap target per card.** The card owns a single stretched link; the
 *      controls that must win that tap are lifted above it by the card itself.
 *
 * Windowing: once a feed is long, layout and paint are skipped for off-screen tiles
 * with `content-visibility: auto` plus a remembered intrinsic size, so the
 * browser's scroll height stays correct while the cost of the far rows is deferred.
 * That is CSS windowing rather than unmounting; the difference is listed in the
 * handover notes rather than glossed over.
 */
export function MasonryFeedGrid<T extends MasonryFeedItem>({
  items,
  getAspectRatio,
  renderItem,
  label,
  loading = false,
  loadingMore = false,
  error,
  onRetry,
  hasMore = false,
  onLoadMore,
  skeletonCount = 10,
  emptyState,
  className,
}: MasonryFeedGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { columnCount, gutter, columnWidth } = useMasonryViewport(containerRef);

  // Filtered by identity, so a retry that re-returns an overlapping window - or a
  // page boundary that repeats a product - can never render two tiles for one
  // product or duplicate a React key.
  const uniqueItems = useMemo(() => dedupeById(items), [items]);

  const keyOf = useCallback((item: T) => item.id, []);
  const placement = useMasonryPlacement(uniqueItems, {
    columnCount,
    columnWidth,
    getAspectRatio,
    keyOf,
    bodyHeight: ESTIMATED_CARD_BODY_HEIGHT,
  });

  // Rank of each product, resolved once per list instead of `indexOf` inside the
  // render loop, so a long feed stays linear.
  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    uniqueItems.forEach((item, index) => map.set(item.id, index));
    return map;
  }, [uniqueItems]);

  const showSkeletons = loading && uniqueItems.length === 0;
  const showEmpty = !loading && uniqueItems.length === 0;
  const showFooter = !showSkeletons && !showEmpty;

  const columnStyle = { columnGap: `${gutter}px`, rowGap: `${gutter}px` } as const;
  const tileWindowStyle = {
    contentVisibility: "auto",
    containIntrinsicSize: `auto ${Math.round(columnWidth / 0.85 + ESTIMATED_CARD_BODY_HEIGHT)}px`,
  } as const;

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      {showSkeletons ? (
        <ul role="list" aria-label={label} className="flex w-full items-start" style={columnStyle}>
          {Array.from({ length: columnCount }).map((_, columnIndex) => (
            <li
              key={`skeleton-${columnIndex}`}
              role="presentation"
              className="flex min-w-0 flex-1 flex-col"
              style={{ rowGap: `${gutter}px` }}
            >
              {Array.from({ length: Math.ceil(skeletonCount / columnCount) }).map((__, index) => (
                <div key={index} aria-hidden="true" className={SKELETON_TILE_CLASS}>
                  <div className="w-full bg-muted" style={{ aspectRatio: SKELETON_RATIOS[(columnIndex + index) % SKELETON_RATIOS.length] }} />
                  {/* The body reserves EXACTLY the height a real card body reserves.
                      Two bars alone were ~60px against a real 132px body, so a full
                      page of skeletons was ~900px shorter than the page that replaced
                      it - measured as +0.048 CLS on a 390px phone. Matching the real
                      height is what removes the shift; matching the TILE COUNT alone
                      does not. */}
                  <div className="space-y-2 p-3" style={{ height: ESTIMATED_CARD_BODY_HEIGHT }}>
                    <div className="h-3 w-3/4 rounded bg-muted" />
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </li>
          ))}
        </ul>
      ) : showEmpty ? (
        emptyState ?? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-5 py-12 text-center text-sm text-muted-foreground">
            <Package className="h-8 w-8 opacity-40" />
            <p>No products to show here yet.</p>
          </div>
        )
      ) : (
        /* `ul > li[role=presentation] > div[role=listitem]`: one list is announced,
           and the intermediate column elements are removed from the accessibility
           tree. A nested <ul> per column would instead be announced as several
           lists, which reads as a broken page.

           Known trade-off: masonry DOM order is column order, so reading order is
           1, 4, 7, 2, 5, 8 rather than 1, 2, 3. That is inherent to a waterfall
           layout - the alternative, `grid-template-rows: masonry`, ships in no
           browser. Visual rank is preserved, and each card's link carries the
           product title as its text, so every tile is identifiable without relying
           on its position. */
        <ul role="list" aria-label={label} className="flex w-full items-start" style={columnStyle}>
          {placement.columns.map((column, columnIndex) => (
            <li
              key={`column-${columnIndex}`}
              role="presentation"
              className="flex min-w-0 flex-1 flex-col"
              style={{ rowGap: `${gutter}px` }}
            >
              {column.map((item) => {
                const index = indexById.get(item.id) ?? 0;
                return (
                  <div key={item.id} role="listitem" className="w-full" style={tileWindowStyle}>
                    {renderItem(item, index, { priority: index < PRIORITY_TILE_COUNT })}
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      )}

      {showFooter && error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center" role="alert">
          <p className="text-xs text-muted-foreground">Something went wrong while loading more products.</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
        </div>
      ) : null}

      {showFooter && !error && loadingMore ? (
        <div
          className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading more products...
        </div>
      ) : null}

      {showFooter && !error && !loadingMore && onLoadMore ? (
        <InfiniteScrollTrigger onLoadMore={onLoadMore} hasMore={hasMore} loading={loadingMore} />
      ) : null}
    </div>
  );
}

