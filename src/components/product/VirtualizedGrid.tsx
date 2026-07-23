import { useRef, useEffect, useCallback, useState } from "react";

interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemMinHeight?: number;
  overscan?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export function VirtualizedGrid<T>({
  items,
  renderItem,
  itemMinHeight = 280,
  overscan = 4,
  onLoadMore,
  hasMore,
  loadingMore,
}: VirtualizedGridProps<T>) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ start: 0, end: 0 });

  const computeRange = useCallback(() => {
    const el = outerRef.current;
    if (!el || !items.length) {
      setViewport({ start: 0, end: Math.max(1, Math.floor((el?.clientHeight || 800) / (itemMinHeight / 2)) * 2) });
      return;
    }
    const scrollTop = el.scrollTop;
    const clientHeight = el.clientHeight;
    const rowHeight = itemMinHeight;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(items.length, Math.ceil((scrollTop + clientHeight) / rowHeight) + overscan);
    setViewport({ start, end });
  }, [items.length, itemMinHeight, overscan]);

  useEffect(() => {
    computeRange();
    const el = outerRef.current;
    if (!el) return;
    el.addEventListener("scroll", computeRange, { passive: true });
    window.addEventListener("resize", computeRange);
    return () => {
      el.removeEventListener("scroll", computeRange);
      window.removeEventListener("resize", computeRange);
    };
  }, [computeRange]);

  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore) return;
    const el = outerRef.current;
    if (!el) return;
    const threshold = 120;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) onLoadMore();
  }, [onLoadMore, hasMore, loadingMore]);

  const visibleItems = items.slice(viewport.start, viewport.end);
  const totalHeight = items.length * itemMinHeight;
  const offsetY = viewport.start * itemMinHeight;

  return (
    <div ref={outerRef} className="h-full overflow-y-auto scrollbar-thin">
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={index} style={{ minHeight: itemMinHeight }}>
              {renderItem(item, viewport.start + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}