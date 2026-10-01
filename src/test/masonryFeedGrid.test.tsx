/**
 * Behaviour of the home feed's masonry shell.
 *
 * These cover the states a shopper actually reaches - loading, a feed with nothing
 * in it, a failure under the last row, and a page that repeats a product - plus the
 * two guarantees that make a waterfall feed usable: one list to a screen reader, and
 * only NEW tiles being rendered.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { MasonryFeedGrid, type MasonryFeedItem } from "@/components/product/MasonryFeedGrid";

type Item = MasonryFeedItem & { name: string };

const item = (id: string): Item => ({ id, name: id });

const renderGrid = (overrides: Partial<Parameters<typeof MasonryFeedGrid<Item>>[0]> = {}) =>
  render(
    <MasonryFeedGrid<Item>
      items={[item("a"), item("b")]}
      getAspectRatio={() => 1}
      label="Best sellers"
      renderItem={(card) => <article>{card.name}</article>}
      {...overrides}
    />,
  );

describe("MasonryFeedGrid", () => {
  it("renders one labelled list of items", () => {
    renderGrid();
    const list = screen.getByRole("list", { name: "Best sellers" });
    expect(list).toBeInTheDocument();
    // Every card is a listitem, and only one card is rendered per product.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("renders a product once even if it is repeated in the source", () => {
    renderGrid({ items: [item("a"), item("b"), item("a")] });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows sized skeletons while the first page loads", () => {
    const { container } = renderGrid({ items: [], loading: true, skeletonCount: 8 });
    // The skeleton boxes carry a reserved ratio, so the page height is already
    // correct before the real tiles arrive.
    const reserved = container.querySelectorAll("[style*='aspect-ratio']");
    expect(reserved.length).toBeGreaterThanOrEqual(8);
    expect(screen.queryByText("a")).not.toBeInTheDocument();
  });

  it("shows the section's empty state when there is genuinely nothing to show", () => {
    renderGrid({
      items: [],
      loading: false,
      emptyState: <p>Approved listings will appear here.</p>,
    });
    expect(screen.getByText("Approved listings will appear here.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("offers a retry when the next page fails", async () => {
    const onRetry = vi.fn();
    renderGrid({ items: [item("a")], error: new Error("network down"), onRetry });

    const retry = await screen.findByRole("button", { name: /try again/i });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    retry.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders no footer when there is nothing to load", () => {
    const { container } = renderGrid({ items: [item("a")], onLoadMore: undefined });
    expect(container.textContent).not.toContain("Loading more");
    expect(container.textContent).not.toContain("Scroll for more");
  });

  it("passes the priority flag to the first row and only the first row", () => {
    const renderItem = vi.fn(
      (card: Item, _index: number, state: { priority: boolean }) => <article>{card.name}</article>,
    );
    renderGrid({
      items: Array.from({ length: 10 }, (_, index) => item(`p${index}`)),
      renderItem,
    });

    const priorityById = new Map(
      renderItem.mock.calls.map(([card, , state]) => [card.id, state.priority]),
    );
    // Render order is column-major, so this is asserted per ITEM rather than by call
    // order. The first six tiles in ranking order (p0-p5) are the first row on a
    // 2-6 column layout; everything below the fold stays lazy.
    for (let index = 0; index < 10; index += 1) {
      expect(priorityById.get(`p${index}`)).toBe(index < 6);
    }
  });
});
