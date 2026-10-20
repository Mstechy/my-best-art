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
  const [activeDot, setActiveDot] = useState(0);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const autoScrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dotCount = Math.min(React.Children.count(children), 8);

  const checkScrollRef = useRef<number | null>(null);

  // Geometry reads are deferred to the next animation frame. Reading scrollLeft /
  // scrollWidth / clientWidth synchronously inside the effect that follows a DOM
  // write (mount, children swap, resize) forces the browser to lay out on the
  // spot - the pattern Lighthouse reports as "forced reflow". One frame later the
  // layout already exists to read, and coalescing through a single frame means
  // any burst of scroll/resize/children events costs one read, not several.
  const checkScroll = useCallback(() => {
    if (checkScrollRef.current !== null) return;
    checkScrollRef.current = requestAnimationFrame(() => {
      checkScrollRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
      if (dotCount > 0) {
        const pageWidth = Math.max((itemWidth + gap) * 2, 1);
        const nextDot = Math.min(dotCount - 1, Math.max(0, Math.round(el.scrollLeft / pageWidth)));
        setActiveDot(nextDot);
      }
    });
  }, [dotCount, gap, itemWidth]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setActiveDot(0);
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      // Never leave a frame pointing at an unmounted section.
      if (checkScrollRef.current !== null) {
        cancelAnimationFrame(checkScrollRef.current);
        checkScrollRef.current = null;
      }
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
    <div className="rounded-2xl border border-dashed border-[#D8D8D2] bg-white px-5 py-10 text-center text-sm text-[#6E6C64] dark:text-[#A0A0A0] dark:border-[#333333] dark:bg-[#1A1A1A]">
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
            {/* role="list" only permits role="listitem" children; the cards
                 handed in are links, and axe's aria-required-children rule -
                 another agent-critical rule - flagged every one of them.
                 `display: contents` keeps the wrappers out of the box tree,
                 so the flex layout and gap stay byte-for-byte identical. */}
            {React.Children.map(children, (child, index) => (
              <div key={index} role="listitem" className="contents">
                {child}
              </div>
            ))}
          </div>

          {/* Right gradient fade */}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#FAFAFA] dark:from-[#121212] to-transparent z-10 pointer-events-none hidden sm:block" />
          )}
        </div>
      ) : (
        empty || defaultEmpty
      )}

      {/* Dots indicator with reserved space. The outer mt-4 + h-6 box (40px)
           is always rendered when showDots is true, so the dots row can never
           push content down by its own height after load. Inside, either the
           loading placeholder, the active dots, or a hidden same-height box
           keeps the strip identical across every loading/children state. */}
      {showDots && (
        <div className="mt-4 h-6">
          {loading ? (
            <div aria-hidden="true" className="h-full" />
          ) : React.Children.count(children) > 0 ? (
            <div className="flex justify-center gap-0.5 h-full">
              {Array.from({ length: dotCount }).map((_, i) => (
                // The button is a full 24x24 hit target (axe target-size wants
                // >= 24px in each dimension) with the visual pill kept at its
                // original 6px height inside a centered grid cell, so the dots
                // look the same while remaining tappable.
                <button
                  key={i}
                  onClick={() => {
                    const el = scrollRef.current;
                    if (!el) return;
                    setActiveDot(i);
                    el.scrollTo({
                      left: i * (itemWidth + gap) * 2,
                      behavior: "smooth",
                    });
                  }}
                  className="grid h-6 w-6 place-items-center rounded-full transition-all"
                  aria-label={`Go to section ${i + 1}`}
                  aria-current={i === activeDot ? "true" : undefined}
                >
                  <span
                    className={`h-1.5 rounded-full transition-all ${
                      i === activeDot ? "w-6 bg-[#111111] dark:bg-[#FAF5F2]" : "w-1.5 bg-[#D8D8D2] dark:bg-[#444444]"
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : (
            <div aria-hidden="true" className="h-full" />
          )}
        </div>
      )}
    </Container>
  );
});

export default HorizontalScrollSection;
