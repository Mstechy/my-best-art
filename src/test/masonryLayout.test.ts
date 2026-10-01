/**
 * Guards for the shortest-column placement rule.
 *
 * These are the properties a shopper would notice if they broke:
 *
 *   1. A card never moves once it is on screen - the promise that makes infinite
 *      scrolling over a feed the shopper is reading acceptable at all.
 *   2. Every tile goes to the currently shortest column, which is the definition of
 *      a waterfall layout (plain CSS `columns` fills one column at a time instead).
 *   3. The breakpoints are the ones the task specifies: 2 / 3 / 4 / 5.
 */
import { describe, expect, it } from "vitest";

import {
  columnCountForWidth,
  distributeIntoColumns,
  estimateTileHeight,
  gutterForWidth,
  MASONRY_MOBILE_MAX,
  MASONRY_TABLET_MAX,
  MASONRY_WIDE_MAX,
} from "@/hooks/useMasonryLayout";

type Tile = { id: string; ratio: number };

const tile = (id: string, ratio: number): Tile => ({ id, ratio });
const options = (columnCount: number) => ({
  columnCount,
  getAspectRatio: (item: Tile) => item.ratio,
  bodyHeight: 0,
  columnWidth: 100,
});

const idsOf = (columns: Tile[][]) => columns.map((column) => column.map((item) => item.id));
const flatten = <T,>(columns: T[][]) => columns.flat();

describe("distributeIntoColumns", () => {
  it("puts the first item in the first column and the next in the second", () => {
    const result = distributeIntoColumns([tile("a", 1), tile("b", 1)], options(2));
    expect(idsOf(result.columns)).toEqual([["a"], ["b"]]);
  });

  it("sends the next item to the currently shortest column", () => {
    // Two 100px columns, bodyHeight 0: "a" and "b" are both 100 tall after the first
    // pair, so the third item belongs to the FIRST column (a tie goes leftmost).
    const result = distributeIntoColumns(
      [tile("a", 1), tile("b", 1), tile("c", 0.5), tile("d", 1)],
      options(2),
    );
    expect(idsOf(result.columns)[0]).toEqual(["a", "c"]);
    expect(idsOf(result.columns)[1]).toEqual(["b", "d"]);
  });

  it("keeps the accumulated column heights in step with the placed tiles", () => {
    const result = distributeIntoColumns([tile("a", 1), tile("b", 0.5), tile("c", 0.75)], options(2));
    // a -> 100 (col 0), b -> 200 (col 1), c -> 133.33 (col 0, still the shortest).
    expect(result.columnHeights[0]).toBeCloseTo(100 + 100 / 0.75, 5);
    expect(result.columnHeights[1]).toBeCloseTo(200, 5);
  });

  it("never moves a tile that is already placed when a page is appended", () => {
    const first = distributeIntoColumns([tile("a", 1), tile("b", 0.75), tile("c", 1)], options(3));
    const appended = distributeIntoColumns(
      [tile("a", 1), tile("b", 0.75), tile("c", 1), tile("d", 0.5), tile("e", 1), tile("f", 0.8)],
      { ...options(3), previous: first },
    );

    for (let column = 0; column < 3; column += 1) {
      // The original tiles keep their column AND their position within it.
      expect(appended.columns[column].slice(0, first.columns[column].length)).toEqual(first.columns[column]);
    }
    // Order across the WHOLE list is not ranking order in a masonry - it is
    // column-major (column 0 top to bottom, then column 1...). What must hold is
    // that every tile is placed exactly once.
    const placed = flatten(appended.columns).map((item) => item.id);
    expect(placed).toHaveLength(6);
    expect(new Set(placed).size).toBe(6);
    expect([...new Set(placed)].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("distributes a long list evenly, which is the point of the shortest-column rule", () => {
    const items = Array.from({ length: 40 }, (_, index) => tile(`p${index}`, index % 2 === 0 ? 1 : 0.75));
    const result = distributeIntoColumns(items, options(4));
    const tallest = Math.max(...result.columnHeights);
    const shortest = Math.min(...result.columnHeights);
    // With a 2:1 spread of tile heights, no column may end up more than one tile
    // taller than another. A round-robin, or CSS `columns`, fails this.
    expect(tallest - shortest).toBeLessThanOrEqual(200);
  });

  it("places every tile exactly once, keeping ranking order inside each column", () => {
    const items = Array.from({ length: 37 }, (_, index) => tile(`p${index}`, 0.75 + (index % 4) * 0.05));
    const result = distributeIntoColumns(items, options(5));
    const placed = flatten(result.columns).map((item) => item.id);

    expect(placed).toHaveLength(items.length);
    expect(new Set(placed).size).toBe(items.length);
    expect([...new Set(placed)].sort()).toEqual(items.map((item) => item.id).sort());

    // RANKING is preserved within a column: a card never overtakes one listed above
    // it, even though the overall reading order is column-major rather than 1, 2, 3.
    const rank = new Map(items.map((item, index) => [item.id, index]));
    for (const column of result.columns) {
      const ranks = column.map((item) => rank.get(item.id)!);
      for (let index = 1; index < ranks.length; index += 1) {
        expect(ranks[index]).toBeGreaterThan(ranks[index - 1]);
      }
    }
  });

  it("re-places from scratch when the column count changes", () => {
    const first = distributeIntoColumns([tile("a", 1), tile("b", 1), tile("c", 1)], options(2));
    const resized = distributeIntoColumns([tile("a", 1), tile("b", 1), tile("c", 1)], {
      ...options(3),
      previous: first,
    });
    expect(resized.columns).toHaveLength(3);
    expect(idsOf(resized.columns)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("treats a nonsensical column count as one column rather than losing tiles", () => {
    const result = distributeIntoColumns([tile("a", 1), tile("b", 1)], options(0));
    expect(result.columns).toHaveLength(1);
    expect(idsOf(result.columns)).toEqual([["a", "b"]]);
  });
});

describe("estimateTileHeight", () => {
  it("is the reserved image height plus the card body", () => {
    expect(estimateTileHeight(1, 200, 132)).toBe(332);
    expect(estimateTileHeight(0.75, 300, 0)).toBe(400);
  });
});

describe("responsive steps", () => {
  it("uses 2 columns on a phone, 3 on a tablet, 4-5 on desktop", () => {
    expect(columnCountForWidth(360)).toBe(2);
    expect(columnCountForWidth(MASONRY_MOBILE_MAX - 1)).toBe(2);
    expect(columnCountForWidth(MASONRY_MOBILE_MAX)).toBe(3);
    expect(columnCountForWidth(MASONRY_TABLET_MAX - 1)).toBe(3);
    expect(columnCountForWidth(MASONRY_TABLET_MAX)).toBe(4);
    expect(columnCountForWidth(MASONRY_WIDE_MAX - 1)).toBe(4);
    expect(columnCountForWidth(MASONRY_WIDE_MAX)).toBe(5);
    expect(columnCountForWidth(2560)).toBe(5);
  });

  it("falls back to the phone layout when the width is unknown", () => {
    expect(columnCountForWidth(0)).toBe(2);
    expect(columnCountForWidth(Number.NaN)).toBe(2);
    expect(gutterForWidth(0)).toBe(8);
  });

  it("uses an 8px gutter on a phone and 12-16px on larger screens", () => {
    expect(gutterForWidth(360)).toBe(8);
    expect(gutterForWidth(768)).toBe(12);
    expect(gutterForWidth(1280)).toBe(16);
  });
});
