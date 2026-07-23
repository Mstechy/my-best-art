import { useRef, useEffect, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualizedProductGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  itemMinHeight?: number;
  overscan?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export function VirtualizedProductGrid<T>({
  items,
  renderItem,
  className = "",
  itemMinHeight = 280,
  overscan = 6,
  onLoadMore,
  hasMore,
  loadingMore,
}: VirtualizedProductGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemMinHeight,
    overscan,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const handleScroll = useCallback(() => {
    if (!onLoadMore || !hasMore || loadingMore) return;
    const el = parentRef.current;
    if (!el) return;
    const threshold = 120;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loadingMore]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div ref={parentRef} className={`h-full overflow-y-auto scrollbar-thin ${className}`}>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}