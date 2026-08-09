import React, { useRef, useState, useCallback, useEffect, memo, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeader } from "@/components/ui/SectionHeader";

interface HorizontalScrollSectionProps {
  title: string;
  subtitle?: string;
  href?: string;
  children: ReactNode;
  itemWidth?: number;
  gap?: number;
  loading?: boolean;
  loadingCount?: number;
  loadingTemplate?: ReactNode;
  emptyText?: string;
  empty?: ReactNode;
  viewAllText?: string;
  onViewAll?: () => void;
  className?: string;
  showArrows?: boolean;
  showDots?: boolean;
  autoScroll?: boolean;
  autoScrollInterval?: number;
}

const HorizontalScrollSection = memo(function HorizontalScrollSection({
  title,
  subtitle,
  href,
  children,
  itemWidth = 220,
  gap = 16,
  loading = false,
  loadingCount = 5,
  loadingTemplate,
  emptyText,
  empty,
  viewAllText = "View all",
  onViewAll,
  className = "",
  showArrows = true,
  showDots = false,
  autoScroll = false,
  autoScrollInterval = 4000,
}: HorizontalScrollSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, children]);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll || autoScrollPaused) {
      if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
      return;
    }
    autoScrollTimerRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const scrollAmount = itemWidth + gap;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }, autoScrollInterval);
    return () => {
      if (autoScrollTimerRef.current) clearInterval(autoScrollTimerRef.current);
    };
  }, [autoScroll, autoScrollPaused, autoScrollInterval, itemWidth, gap]);

  const scrollBy = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = (itemWidth + gap) * (direction === "left" ? -1 : 1) * 2;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }, [itemWidth, gap]);

  // Mouse drag to scroll
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDragging, handleMouseUp]);

  // Default loading template
  const defaultLoading = (
    <div className="flex gap-4">
      {Array.from({ length: loadingCount }).map((_, i) => (
        <div
          key={i}
          className="shrink-0 animate-pulse rounded-2xl bg-[#F2F3F5] dark:bg-[#202020]"
          style={{ width: itemWidth, height: itemWidth * 1.3 }}
        />
      ))}
    </div>
  );

  // Empty state
  const defaultEmpty = emptyText ? (
    <div className="rounded-2xl border border-dashed border-[#D8D8D2] bg-white px-5 py-10 text-center text-sm text-[#888880] dark:border-[#333333] dark:bg-[#1A1A1A]">
      {emptyText}
    </div>
  ) : null;

  return (
    <Container className={`py-7 ${className}`}>
      <SectionHeader
        className="mb-5"
        title={title}
        subtitle={subtitle}
        action={<div className="flex items-center gap-3">
          {/* Navigation arrows */}
          {showArrows && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                onClick={() => scrollBy("left")}
                disabled={!canScrollLeft}
                className={`grid h-8 w-8 place-items-center rounded-full border transition-all ${
                  canScrollLeft
                    ? "border-[#E8E8E8] dark:border-[#333333] text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D]"
                    : "border-[#F2F3F5] dark:border-[#222222] text-[#C8C8C0] dark:text-[#444444] cursor-not-allowed"
                }`}
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => scrollBy("right")}
                disabled={!canScrollRight}
                className={`grid h-8 w-8 place-items-center rounded-full border transition-all ${
                  canScrollRight
                    ? "border-[#E8E8E8] dark:border-[#333333] text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D]"
                    : "border-[#F2F3F5] dark:border-[#222222] text-[#C8C8C0] dark:text-[#444444] cursor-not-allowed"
                }`}
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          {/* View all link */}
          {href || onViewAll ? (
            <a
              href={href}
              onClick={onViewAll ? (e) => { e.preventDefault(); onViewAll(); } : undefined}
              className="text-sm font-semibold hover:underline whitespace-nowrap"
            >
              {viewAllText}
            </a>
          ) : null}
        </div>}
      />

      {/* Scrollable content */}
      {loading ? (
        loadingTemplate || defaultLoading
      ) : React.Children.count(children) > 0 ? (
        <div className="relative group">
          {/* Left gradient fade */}
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#FAFAFA] dark:from-[#121212] to-transparent z-10 pointer-events-none hidden sm:block" />
          )}

          <div
            ref={scrollRef}
            className={`flex-nowrap flex overflow-x-auto scrollbar-hide pb-2 -mb-2 select-none ${!canScrollLeft && !canScrollRight ? "justify-center" : "justify-start"}`}
            style={{ gap, scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setAutoScrollPaused(true)}
            onMouseLeave={() => { setAutoScrollPaused(false); setIsDragging(false); }}
            onTouchStart={() => setAutoScrollPaused(true)}
            onTouchEnd={() => setAutoScrollPaused(false)}
            role="list"
            aria-label={`${title} products`}
          >
            {children}
          </div>

          {/* Right gradient fade */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#FAFAFA] dark:from-[#121212] to-transparent z-10 pointer-events-none hidden sm:block" />
          )}
        </div>
      ) : (
        empty || defaultEmpty
      )}

      {/* Dots indicator */}
      {showDots && !loading && React.Children.count(children) > 0 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: Math.min(React.Children.count(children), 8) }).map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = scrollRef.current;
                if (!el) return;
                el.scrollTo({
                  left: i * (itemWidth + gap) * 2,
                  behavior: "smooth",
                });
              }}
              className={`h-1.5 rounded-full transition-all ${
                i === 0 ? "w-6 bg-[#111111] dark:bg-[#FAF5F2]" : "w-1.5 bg-[#D8D8D2] dark:bg-[#444444]"
              }`}
              aria-label={`Go to section ${i + 1}`}
            />
          ))}
        </div>
      )}
    </Container>
  );
});

export default HorizontalScrollSection;
