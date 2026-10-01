import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useCachedFetch, cacheKeyFor } from "@/hooks/useCachedFetch";
import type { ImageDimensions } from "@/lib/imageDimensions";

/**
 * Cursor-paginated catalogue feed for the home page masonry grid.
 *
 * Cursor, not offset, for the reason a feed cannot use `range()`: an offset page is
 * addressed by how many rows precede it, and a shopper scrolling a live catalogue
 * while a seller publishes a product makes that number mean something different by
 * the time the next page is asked for - so a product is shown twice or skipped
 * entirely. A keyset cursor names the last row actually seen and is immune to
 * inserts above it.
 *
 * The sort is `created_at DESC, id DESC` with `id` as the tie-breaker, because two
 * products published in the same transaction share a timestamp; without the
 * tie-breaker the cursor is ambiguous and the same product can be returned twice.
 */

/**
 * Products per page.
 *
 * Exported because the loading skeleton must reserve the SAME number of tiles
 * the first real page delivers. A skeleton count that differs from the page size
 * makes the section change height when data lands, which is a layout shift -
 * measured at +0.048 CLS on a 390px phone before this was aligned.
 */
export const FEED_PAGE_SIZE = 24;

/** Columns needed by a card. `product_images` is embedded, not fetched per row. */
const IMAGE_COLUMNS_WITH_DIMENSIONS =
  "image_url,card_small_url,is_primary,sort_order,image_width,image_height";
const IMAGE_COLUMNS_WITHOUT_DIMENSIONS = "image_url,card_small_url,is_primary,sort_order";

const BASE_COLUMNS =
  "id,title,price,compare_at_price,currency,seller_id,stock_quantity,average_rating,review_count,created_at,flash_deal_end_at";

export interface CatalogueFeedCursor {
  createdAt: string;
  id: string;
}

export interface CatalogueFeedItem {
  id: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  seller_id: string;
  stock_quantity: number;
  average_rating: number;
  review_count: number;
  created_at: string;
  flash_deal_end_at: string | null;
  image_url: string | null;
  image_small_url: string | null;
  image_width: number | null;
  image_height: number | null;
}

interface ProductImageRow {
  image_url: string | null;
  card_small_url?: string | null;
  is_primary?: boolean | null;
  sort_order?: number | null;
  image_width?: number | null;
  image_height?: number | null;
}

interface ProductFeedRow {
  id: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  currency: string;
  seller_id: string;
  stock_quantity: number;
  average_rating: number;
  review_count: number;
  created_at: string;
  flash_deal_end_at: string | null;
  product_images?: ProductImageRow[] | null;
}

/** The primary image, falling back to the lowest `sort_order` when none is flagged. */
function primaryImage(images: ProductImageRow[] | null | undefined): ProductImageRow | null {
  if (!images || images.length === 0) return null;
  const flagged = images.find((image) => image.is_primary);
  if (flagged) return flagged;
  return [...images].sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))[0] ?? null;
}

function toFeedItem(row: ProductFeedRow): CatalogueFeedItem {
  const image = primaryImage(row.product_images);
  return {
    id: row.id,
    title: row.title,
    price: Number(row.price),
    compare_at_price: row.compare_at_price === null ? null : Number(row.compare_at_price),
    currency: row.currency,
    seller_id: row.seller_id,
    stock_quantity: Number(row.stock_quantity ?? 0),
    average_rating: Number(row.average_rating ?? 0),
    review_count: Number(row.review_count ?? 0),
    created_at: row.created_at,
    flash_deal_end_at: row.flash_deal_end_at ?? null,
    image_url: image?.image_url ?? null,
    image_small_url: image?.card_small_url ?? null,
    image_width: image?.image_width ?? null,
    image_height: image?.image_height ?? null,
  };
}

/** The dimensions a card reserves, or `null` when the row predates the columns. */
export function feedItemDimensions(item: CatalogueFeedItem): ImageDimensions | null {
  if (!item.image_width || !item.image_height) return null;
  return { width: item.image_width, height: item.image_height };
}

interface FetchPageResult {
  items: CatalogueFeedItem[];
  cursor: CatalogueFeedCursor | null;
  hasMore: boolean;
}

/**
 * One page of products strictly after `cursor`.
 *
 * `pageSize + 1` rows are requested and the extra one is discarded: that single
 * extra row is what proves there is another page, so the feed never needs a
 * `count(*)` over the whole catalogue just to decide whether to show a footer.
 */
async function fetchFeedPage(
  cursor: CatalogueFeedCursor | null,
  pageSize: number,
  withDimensions: boolean,
): Promise<FetchPageResult> {
  const imageColumns = withDimensions ? IMAGE_COLUMNS_WITH_DIMENSIONS : IMAGE_COLUMNS_WITHOUT_DIMENSIONS;
  let query = supabase
    .from("products")
    .select(`${BASE_COLUMNS},product_images(${imageColumns})`)
    .eq("status", "active")
    .eq("is_approved", true);

  if (cursor) {
    // Keyset comparison. The timestamp is quoted so PostgREST does not have to
    // guess where the ISO value ends and the next filter begins.
    query = query.or(
      `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(pageSize + 1);

  if (error) throw error;

  const rows = (data ?? []) as unknown as ProductFeedRow[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  // The cursor advances from the last row the SERVER returned, never from the last
  // row kept after filtering - otherwise a filtered-out product would be fetched
  // again on the next page.
  const lastRow = page[page.length - 1];

  return {
    items: page.map(toFeedItem),
    cursor: lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null,
    hasMore,
  };
}

export interface UseCatalogueFeedOptions {
  /**
   * Where the feed already ended. The first page continues from here, so a section
   * that has already rendered its first screen does not start over.
   */
  startCursor?: CatalogueFeedCursor | null;
  /** Products already shown elsewhere on the page (the rails), never repeated here. */
  excludeIds?: readonly string[];
  /** Skip all fetching while the section is not rendered. */
  enabled?: boolean;
  pageSize?: number;
}

export interface UseCatalogueFeedResult {
  /** The first page plus every appended page, de-duplicated, in feed order. */
  items: CatalogueFeedItem[];
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

/**
 * Append-only pages for the home feed.
 *
 * The first page rides the same IndexedDB cache the catalogue uses, so coming back
 * from a product page renders the feed from disk immediately instead of showing
 * skeletons over a page the shopper has already scrolled past.
 *
 * Nothing rendered is ever re-sorted or re-fetched: `loadMore` only appends, the
 * cursor only moves forward, and products already on screen keep their tile.
 */
export function useCatalogueFeed({
  startCursor = null,
  excludeIds = [],
  enabled = true,
  pageSize = FEED_PAGE_SIZE,
}: UseCatalogueFeedOptions = {}): UseCatalogueFeedResult {
  const [pages, setPages] = useState<CatalogueFeedItem[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  const inFlightRef = useRef(false);
  // Null until the first page resolves; `loadMore` then falls back to the caller's
  // start cursor, so a scroll that lands before the first page finishes cannot
  // restart the feed from the top.
  const cursorRef = useRef<CatalogueFeedCursor | null>(null);
  const excludeIdsRef = useRef<readonly string[]>(excludeIds);
  excludeIdsRef.current = excludeIds;

  const cacheKey = useMemo(
    () =>
      enabled
        ? cacheKeyFor("home_feed_page", {
            cursorAt: startCursor?.createdAt ?? null,
            cursorId: startCursor?.id ?? null,
            pageSize,
          })
        : null,
    [enabled, startCursor?.createdAt, startCursor?.id, pageSize],
  );

  const {
    data: firstPage,
    loading,
    error: firstPageError,
    refetch,
  } = useCachedFetch<FetchPageResult>(
    cacheKey,
    async () => {
      try {
        return await fetchFeedPage(startCursor, pageSize, true);
      } catch (error) {
        // The dimension columns arrive with the masonry migration. A deployment
        // that serves this client before that migration is applied would otherwise
        // fail the whole feed on a 400, so it retries without them: the feed still
        // renders, every tile reserves 1:1, and no product is hidden.
        console.warn("[useCatalogueFeed] Retrying the feed without stored image dimensions.", error);
        return await fetchFeedPage(startCursor, pageSize, false);
      }
    },
    { staleWhileRevalidate: true, ttlMs: 3 * 60 * 1000 },
  );

  useEffect(() => {
    if (firstPage?.cursor) cursorRef.current = firstPage.cursor;
  }, [firstPage]);

  const loadMore = useCallback(() => {
    if (!enabled || inFlightRef.current) return;
    const from = cursorRef.current ?? startCursor ?? null;
    // At the end of the catalogue there is nothing to ask for.
    if (!from) return;
    const atEnd = cursorRef.current === null && firstPage !== undefined && !firstPage.hasMore;
    if (atEnd) return;

    inFlightRef.current = true;
    setLoadingMore(true);
    setError(undefined);

    void (async () => {
      try {
        const result = await fetchFeedPage(from, pageSize, true).catch(() =>
          fetchFeedPage(from, pageSize, false),
        );
        const excluded = new Set(excludeIdsRef.current);
        const fresh = result.items.filter((item) => !excluded.has(item.id));
        cursorRef.current = result.cursor ?? cursorRef.current;
        setHasMore(result.hasMore);
        if (fresh.length > 0) setPages((previous) => [...previous, ...fresh]);
      } catch (loadError) {
        setError(loadError);
      } finally {
        inFlightRef.current = false;
        setLoadingMore(false);
      }
    })();
  }, [enabled, firstPage, pageSize, startCursor]);

  const retry = useCallback(() => {
    setError(undefined);
    void refetch(true);
  }, [refetch]);

  const items = useMemo(() => {
    const excluded = new Set(excludeIds);
    const seen = new Set<string>();
    const list: CatalogueFeedItem[] = [];
    for (const item of [...(firstPage?.items ?? []), ...pages]) {
      if (excluded.has(item.id) || seen.has(item.id)) continue;
      seen.add(item.id);
      list.push(item);
    }
    return list;
  }, [firstPage, pages, excludeIds]);

  return {
    items,
    loading,
    loadingMore,
    error: error ?? firstPageError,
    hasMore: hasMore || Boolean(firstPage?.hasMore),
    loadMore,
    retry,
  };
}

