import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EnhancedCollection } from "@/lib/collectionResolver";

interface HeroSliderProps {
  slides: EnhancedCollection[];
  autoRotate?: boolean;
  defaultDuration?: number;
}

// Supabase image transformations (/render/image/…) are NOT enabled on this
// project — the endpoint returns 403 for these assets. Always serve the
// original public storage URL; the browser caches it after the first request.
function getHeroImageUrl(src: string | null): string {
  return src ?? "";
}

const HeroSlider = memo(function HeroSlider({
  slides,
  autoRotate = true,
  defaultDuration = 5000,
}: HeroSliderProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const len = slides.length;
  const hasMultiple = len > 1;

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setCurrent(((index % len) + len) % len);
      setTimeout(() => setIsTransitioning(false), 500);
    },
    [len, isTransitioning]
  );

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  // Preload next 2 slides for instant rotation and better LCP
  useEffect(() => {
    if (typeof document === "undefined") return;
    const links: HTMLLinkElement[] = [];
    for (let offset = 1; offset <= 2; offset++) {
      const index = (current + offset) % len;
      const slide = slides[index];
      if (!slide?.image_url) continue;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = getHeroImageUrl(slide.image_url);
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      links.forEach(l => {
        try { document.head.removeChild(l); } catch { /* ignore cleanup error */ }
      });
    };
  }, [current, len, slides]);

  // Auto-rotate
  useEffect(() => {
    if (!autoRotate || !hasMultiple || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const duration = slides[current]?.hero_auto_rotate_duration || defaultDuration;
    timerRef.current = setInterval(next, duration);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRotate, hasMultiple, isPaused, current, slides, defaultDuration, next]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  };

  if (!slides.length) return null;

  const slide = slides[current];
  const overlayOpacity = slide.hero_overlay_opacity ?? 0.45;

  return (
    <section
      className="relative w-full overflow-hidden bg-[#111111]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured collections"
    >
      {/* Slides container */}
      <div
        className="relative aspect-[16/9] min-h-[240px] w-full sm:min-h-[280px] md:aspect-[21/9] md:min-h-[360px] lg:min-h-[440px]"
        style={{ backgroundColor: "#1C1C1E" }}
      >
        {slides.map((s, index) => {
          const isActive = index === current;
          const imageAlt = s.title || "Hero banner";
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${len}: ${s.title}`}
              aria-hidden={!isActive}
            >
              {/* Background image */}
              {s.image_url ? (
                <img
                  src={getHeroImageUrl(s.image_url)}
                  alt={imageAlt}
                  className={`h-full w-full object-cover ${
                    index === 0 ? "opacity-100" : "transition-opacity duration-700 " + (loadedImages.has(index) ? "opacity-100" : "opacity-0")
                  }`}
                  loading={index === 0 ? "eager" : "lazy"}
                  {...({ fetchpriority: index === 0 ? "high" : "auto" } as React.HTMLAttributes<HTMLImageElement>)}
                  decoding="async"
                  onLoad={() => handleImageLoad(index)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1C1C1E] to-[#333333]">
                  <p className="text-4xl font-black text-white/20 uppercase tracking-tight">
                    {s.title}
                  </p>
                </div>
              )}

              {/* Gradient overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to right, rgba(0,0,0,${overlayOpacity + 0.2}) 0%, rgba(0,0,0,${overlayOpacity}) 50%, rgba(0,0,0,${overlayOpacity * 0.6}) 100%)`,
                }}
              />

              {/* Content overlay — clamped so text and CTA always fit inside
                  the fixed hero height without growing it */}
              <div className="absolute inset-0 flex items-center overflow-hidden">
                <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-8 md:px-12">
                  <div className="max-w-xl">
                    {s.hero_badge && (
                      <span className="mb-2 inline-block rounded-full bg-[#F6C75D] px-2.5 py-0.5 text-[10px] font-bold text-[#5C3A00] sm:mb-3 sm:px-3 sm:py-1 sm:text-xs">
                        {s.hero_badge}
                      </span>
                    )}
                    <h2
                      className="break-words font-black uppercase tracking-tight text-white"
                      style={{
                        fontSize: "clamp(1.375rem, 2.5vw + 1rem, 3.75rem)",
                        lineHeight: 1.08,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {s.title}
                    </h2>
                    {s.description && (
                      <p
                        className="mt-2 max-w-md text-xs leading-relaxed text-white/80 sm:mt-3 sm:max-w-lg sm:text-sm md:text-base"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {s.description}
                      </p>
                    )}
                    {(() => {
                      const destination = s.hero_cta_link || `/collections/${s.slug}`;
                      const className = "mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#111111] transition-all hover:bg-[#F6C75D] hover:shadow-lg sm:mt-5 sm:px-6 sm:py-3 sm:text-sm";
                      return /^https?:\/\//i.test(destination) ? (
                        <a href={destination} target="_blank" rel="noreferrer" className={className}>{s.cta_label || "Shop now"}</a>
                      ) : (
                        <Link to={destination} className={className}>{s.cta_label || "Shop now"}</Link>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-all hover:bg-white/40"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-all hover:bg-white/40"
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Dots */}
      {hasMultiple && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((s, index) => (
            <button
              key={s.id}
              onClick={() => goTo(index)}
              aria-current={index === current ? "true" : undefined}
              className={`h-2 rounded-full transition-all ${
                index === current ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
});

export default HeroSlider;