import * as React from "react";

/**
 * Shortest-column masonry (waterfall) placement for the home feed.
 *
 * Why not CSS `columns`: `column-count` flows items down one column before moving
 * to the next, so the DOM order stops matching the visual order. Ranking is lost
 * (item 1 sits above item 2, but item 5 sits above item 6 and beside item 1), and
 * infinite scrolling appends to the BOTTOM of the last column instead of the
 * shortest one, so a new page of products would land under a single column and
 * re-flow every column's contents - moving cards the shopper is already reading.
 *
 * Why not a library: `masonic` and `react-masonry-css` are not dependencies of
 * this project, and this workspace builds offline. The placement rule is small
 * enough to own, and owning it means it can be unit-tested as a pure function
 * instead of asserted through the DOM.
 *
 * The rule implemented here is append-only: items already placed keep their column
 * and their order forever, and only genuinely NEW items are placed into the
 * currently shortest column. That is what makes "never reshuffle items already on
 * screen" true by construction rather than by care.
 */

export interface MasonryPlacement<T> {
  /** One array per column, in display order. */
  columns: T[][];
  /** Estimated accumulated height per column, in the same unit the placement used. */
  columnHeights: number[];
}

export interface DistributeIntoColumnsOptions<T> {
  /** How many columns exist right now (2 phone, 3 tablet, 4-5 desktop). */
  columnCount: number;
  /**
   * Aspect ratio (width / height) the tile's image box reserves. Should already be
   * clamped to [3:4, 1:1] by `clampDisplayAspectRatio`, so one extreme upload
   * cannot claim a whole column.
   */
  getAspectRatio: (item: T) => number;
  /**
   * Column width in px, used to turn a ratio into a comparable height.
   * Defaults to 1, which makes the comparison purely relative - correct whenever
   * every card body is the same height, which is the usual case.
   */
  columnWidth?: number;
  /**
   * Height a card adds BELOW its image box (padding, title, price), in px.
   *
   * An estimate for balancing only - never used to reserve space. The image box
   * reserves its exact height from the stored dimensions; the body is content-sized
   * and is very nearly the same for every card, so it cancels out between columns.
   * Counting it anyway keeps the columns level when some cards carry extra rows
   * (sold count, rating, seller chip).
   */
  bodyHeight?: number;
  /**
   * The placement from the previous render. Items already in it are left exactly
   * where they are; only items beyond that count are placed.
   */
  previous?: MasonryPlacement<T>;
}

/**
 * Default body allowance below the image: `p-3` (24px) + two clamped title lines
 * (`min-h-10`, 40px) + price row (`pt-3` + `min-h-5`, 32px) + the meta rows that
 * most cards show (sold count and rating, ~36px).
 */
export const ESTIMATED_CARD_BODY_HEIGHT = 132;

const safeRatio = (ratio: number) => (Number.isFinite(ratio) && ratio > 0 ? ratio : 1);

/** Rendered height of one tile: its reserved image box plus the card body. */
export function estimateTileHeight(
  aspectRatio: number,
  columnWidth: number,
  bodyHeight: number = ESTIMATED_CARD_BODY_HEIGHT,
): number {
  return columnWidth / safeRatio(aspectRatio) + bodyHeight;
}

/**
 * Place `items` into `columnCount` columns, always into the shortest column.
 *
 * Ties go to the leftmost shortest column, which keeps the result deterministic -
 * two products that reserve the same height always land in the same order, so the
 * feed does not reshuffle itself between two renders of identical data.
 */
export function distributeIntoColumns<T>(
  items: readonly T[],
  options: DistributeIntoColumnsOptions<T>,
): MasonryPlacement<T> {
  const columnCount = Math.max(1, Math.floor(options.columnCount) || 1);
  const columnWidth = options.columnWidth && options.columnWidth > 0 ? options.columnWidth : 1;
  const bodyHeight = options.bodyHeight ?? ESTIMATED_CARD_BODY_HEIGHT;

  // A previous placement may only be appended to when it is structurally compatible:
  // the same number of columns (a resize means the layout is rebuilt), and no more
  // items already placed than exist in the list (a filter or a re-query means this
  // is a different list, not a longer one). Anything else is rebuilt from scratch
  // rather than silently merged - a half-reused placement is how a tile ends up in
  // a column that no longer exists.
  const previousCount = options.previous
    ? options.previous.columns.reduce((total, column) => total + column.length, 0)
    : 0;
  const canAppend = Boolean(
    options.previous && options.previous.columns.length === columnCount && previousCount <= items.length,
  );

  const columns: T[][] = canAppend
    ? (options.previous as MasonryPlacement<T>).columns.map((column) => column.slice())
    : Array.from({ length: columnCount }, () => [] as T[]);
  const heights = canAppend
    ? (options.previous as MasonryPlacement<T>).columnHeights.slice()
    : Array.from({ length: columnCount }, () => 0);

  // Appending only ever hands the NEW tiles to the placement, which is what makes
  // "nothing on screen moves" a structural guarantee rather than a hope.
  const pending = canAppend ? items.slice(previousCount) : items;

  for (const item of pending) {
    let target = 0;
    for (let index = 1; index < columns.length; index += 1) {
      if (heights[index] < heights[target]) target = index;
    }
    columns[target].push(item);
    heights[target] += estimateTileHeight(options.getAspectRatio(item), columnWidth, bodyHeight);
  }

  return { columns, columnHeights: heights };
}

/** Mobile-first column steps: 2 phones, 3 tablets, then 4 and 5 on desktop. */
export const MASONRY_MOBILE_MAX = 640;
export const MASONRY_TABLET_MAX = 1024;
export const MASONRY_WIDE_MAX = 1440;

export function columnCountForWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 2;
  if (width < MASONRY_MOBILE_MAX) return 2;
  if (width < MASONRY_TABLET_MAX) return 3;
  if (width < MASONRY_WIDE_MAX) return 4;
  return 5;
}

/** 8px on phones, 12px on tablets, 16px on desktop. */
export function gutterForWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 8;
  if (width < MASONRY_MOBILE_MAX) return 8;
  if (width < MASONRY_TABLET_MAX) return 12;
  return 16;
}

// ── React bindings ─────────────────────────────────────────────────────────

export interface MasonryViewport {
  /** Columns to render right now. */
  columnCount: number;
  /** Gap between columns and between tiles, in px. */
  gutter: number;
  /** Measured column width in px, used to compare tile heights. */
  columnWidth: number;
}

/**
 * Columns and gutters for the current viewport, recomputed on resize.
 *
 * Two widths are tracked for two different jobs:
 *   * `window.innerWidth` decides the COLUMN COUNT, because the task's breakpoints
 *     (2 / 3 / 4-5) are viewport breakpoints and must agree with the `sm:` / `lg:`
 *     steps Tailwind already uses elsewhere on the page.
 *   * the container's own width decides the column WIDTH, so the height estimate
 *     used to pick the shortest column is in real pixels even inside a max-width
 *     container.
 *
 * Recomputing never touches `scrollY`: the grid is re-flowed in place and the
 * browser keeps the scroll offset, which is what makes rotation and window resize
 * safe around a feed the shopper is reading.
 */
export function useMasonryViewport(containerRef: React.RefObject<HTMLElement | null>): MasonryViewport {
  const [viewportWidth, setViewportWidth] = React.useState<number>(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  const [containerWidth, setContainerWidth] = React.useState(0);

  React.useEffect(() => {
    // Every layout READ is collected before any state WRITE. Interleaving them
    // makes the browser flush layout synchronously - Chrome reported 221 ms of
    // forced reflows in this hook's chunk before this was split.
    const readWidth = (element: HTMLElement | null): number =>
      element ? element.clientWidth : 0;

    const measure = (width?: number) => {
      const element = containerRef.current;
      // read phase
      const vw = typeof window === "undefined" ? 0 : window.innerWidth;
      const cw = width ?? readWidth(element);
      // write phase
      setViewportWidth(vw);
      if (cw > 0) setContainerWidth(cw);
    };

    // The FIRST measure is deferred one frame. Synchronously inside this effect
    // it would read `clientWidth` in the same tick React finished writing DOM
    // and styles, forcing a layout flush - Chrome attributed forced reflow to
    // this hook's chunk on the homepage. One frame later the browser has already
    // laid out, and until then `containerWidth === 0` falls back to the
    // viewport-derived width, which is what the first paint used anyway.
    const firstMeasure = requestAnimationFrame(() => measure());
    // Wrapped, not passed directly: `measure` takes an optional width for the
    // ResizeObserver path, which makes it incompatible with the event-listener
    // signature (`Event` is not assignable to `number`).
    const onViewportChange = () => measure();
    window.addEventListener("resize", onViewportChange);
    // Fires after the viewport has settled on mobile browsers, where `resize` can
    // report the pre-rotation width.
    window.addEventListener("orientationchange", onViewportChange);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver === "function") {
      // The entry already carries the new content-box width, so the callback does
      // not have to read `clientWidth` and force a synchronous layout.
      observer = new ResizeObserver((entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        measure(entry.contentRect.width);
      });
      const element = containerRef.current;
      if (element) observer.observe(element);
    }

    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      cancelAnimationFrame(firstMeasure);
      observer?.disconnect();
    };
  }, [containerRef]);

  const columnCount = columnCountForWidth(viewportWidth || containerWidth || 1280);
  const gutter = gutterForWidth(viewportWidth || containerWidth || 1280);
  // Before the first measurement, assume a conservative phone-ish container so the
  // very first paint already has the right number of columns rather than one.
  const usable =
    (containerWidth || Math.max(320, viewportWidth - 32)) - gutter * (columnCount - 1);
  const columnWidth = Math.max(1, usable / columnCount);

  return { columnCount, gutter, columnWidth };
}

export interface UseMasonryPlacementOptions<T> {
  columnCount: number;
  columnWidth: number;
  getAspectRatio: (item: T) => number;
  /** Stable identity for each item, so an append can be told apart from a re-query. */
  keyOf: (item: T) => string;
  bodyHeight?: number;
}

/**
 * Placement for a live list, append-only.
 *
 * A new page of products is placed into the shortest columns and nothing already on
 * screen moves. A change to the item KEYS (a different query, a filter, a sort)
 * resets the placement, because that is a new list rather than a longer one.
 */
export function useMasonryPlacement<T>(
  items: readonly T[],
  options: UseMasonryPlacementOptions<T>,
): MasonryPlacement<T> {
  const { columnCount, columnWidth, getAspectRatio, keyOf, bodyHeight } = options;
  const placementRef = React.useRef<MasonryPlacement<T> | null>(null);
  const keysRef = React.useRef<string[]>([]);

  return React.useMemo(() => {
    const keys = items.map(keyOf);
    const previous = placementRef.current;
    const previousKeys = keysRef.current;
    const isAppend =
      previous !== null &&
      previous.columns.length === columnCount &&
      keys.length >= previousKeys.length &&
      previousKeys.every((key, index) => key === keys[index]);

    const next = distributeIntoColumns(items, {
      columnCount,
      columnWidth,
      getAspectRatio,
      bodyHeight,
      previous: isAppend ? (previous as MasonryPlacement<T>) : undefined,
    });

    placementRef.current = next;
    keysRef.current = keys;
    return next;
    // `items` is compared by reference, so callers must keep a stable array (the
    // feed hooks already return memoised arrays) rather than rebuilding it inline.
  }, [items, columnCount, columnWidth, getAspectRatio, keyOf, bodyHeight]);
}

