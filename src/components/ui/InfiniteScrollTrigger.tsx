import { useRef, useEffect, memo } from "react";

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  hasMore: boolean;
  loading?: boolean;
  threshold?: number;
  rootMargin?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const InfiniteScrollTrigger = memo(function InfiniteScrollTrigger({
  onLoadMore,
  hasMore,
  loading = false,
  threshold = 0.1,
  rootMargin = "400px 0px",
  disabled = false,
  className = "",
  children,
}: InfiniteScrollTriggerProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);

  // Keep a ref to onLoadMore to avoid effect dependency issues
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!hasMore || disabled || loading) return;

    // Disconnect previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !loadingRef.current && hasMore && !disabled) {
            loadingRef.current = true;
            onLoadMoreRef.current();
            // Reset after a short delay to allow for re-triggering
            setTimeout(() => {
              loadingRef.current = false;
            }, 500);
          }
        });
      },
      { threshold, rootMargin }
    );

    if (triggerRef.current) {
      observerRef.current.observe(triggerRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loading, disabled, threshold, rootMargin]);

  return (
    <div ref={triggerRef} className={`flex justify-center items-center py-8 ${className}`}>
      {loading ? (
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-xs font-semibold text-[#888880]">Loading more products...</span>
        </div>
      ) : hasMore ? (
        children || (
          <div className="flex items-center gap-2 text-xs text-[#888880]">
            <span>Scroll for more</span>
            <svg
              className="h-4 w-4 animate-bounce"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        )
      ) : (
        <p className="text-xs text-[#888880]">You're all caught up! Showing all products.</p>
      )}
    </div>
  );
});

export default InfiniteScrollTrigger;