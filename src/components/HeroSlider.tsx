import { useCallback, useEffect, useRef, useState, memo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EnhancedCollection } from "@/lib/collectionResolver";
import { getHeroImageSources, DEFAULT_HERO_IMAGE_URL } from "@/lib/heroImages";
import { DEFAULT_HERO_COPY } from "@/lib/heroDefaults";

interface HeroSliderProps {
  slides: EnhancedCollection[];
  autoRotate?: boolean;
  defaultDuration?: number;
}

/**
 * One slide's artwork, without the overlay text.
 *
 * Exported so the landing page's first paint and `HeroSlider` emit the SAME
 * `<picture>`: an identical `src` and an identically sized box (the container
 * owns the aspect ratio), so replacing the placeholder with the slider cannot
 * shift layout or re-download the file.
 */
export function HeroArtwork({
  imageUrl,
  alt,
  priority = false,
  imgClassName = "h-full w-full object-cover",
  onLoad,
  onError,
}: {
  imageUrl: string | null;
  alt: string;
  priority?: boolean;
  imgClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
}) {
  const source = getHeroImageSources(imageUrl);
  if (!source.src) return null;
  return (
    <picture className="block h-full w-full">
      {/* The mobile source is a different aspect ratio to the desktop one, so it
          carries its own intrinsic size. Without this the <img> advertised
          1600x686 while displaying a 960x540 file, which reserves the wrong box
          before CSS applies. */}
      {source.mobileSrc && (
        <source
          media="(max-width: 640px)"
          srcSet={source.mobileSrcSet ?? source.mobileSrc}
          width={source.mobileWidth}
          height={source.mobileHeight}
          type="image/webp"
        />
      )}
      <img
        src={source.src}
        width={source.width}
        height={source.height}
        alt={alt}
        className={imgClassName}
        loading={priority ? "eager" : "lazy"}
        {...({ fetchpriority: priority ? "high" : "auto" } as React.HTMLAttributes<HTMLImageElement>)}
        decoding="async"
        onLoad={onLoad}
        onError={onError}
      />
    </picture>
  );
}

/**
 * One slide's overlay copy: badge, title, description, CTA.
 *
 * Shared by the pending stage and the live slides ON PURPOSE. The two states
 * must emit the exact same element tree - same wrappers, same classes, same
 * child order - so React patches the nodes painted before the query resolved
 * instead of replacing them. A replaced <h2>/<p>/<a> repaints the hero box,
 * which hands Largest Contentful Paint a fresh candidate at data arrival; an
 * attribute write on the existing nodes does not. The pending stage passes the
 * build-time defaults (src/lib/heroDefaults.ts, byte-aligned with the
 * hero-enabled row), the live slides pass the row itself - for the seeded
 * campaign those are the same strings, so the swap is visually silent and the
 * user never sees a bare image waiting on the query.
 */
function HeroCopy({
  badge,
  title,
  description,
  destination,
  ctaLabel,
}: {
  badge?: string | null;
  title: string;
  description?: string | null;
  destination: string;
  ctaLabel: string;
}) {
  const ctaClassName =
    "mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#111111] transition-all hover:bg-[#F6C75D] hover:shadow-lg sm:mt-5 sm:px-6 sm:py-3 sm:text-sm";
  return (
    <div className="absolute inset-0 flex items-center overflow-hidden">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-8 md:px-12">
        <div className="max-w-xl">
          {badge && (
            <span className="mb-2 inline-block rounded-full bg-[#F6C75D] px-2.5 py-0.5 text-[10px] font-bold text-[#5C3A00] sm:mb-3 sm:px-3 sm:py-1 sm:text-xs">
              {badge}
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
            {title}
          </h2>
          {description && (
            <p
              className="mt-2 max-w-md text-xs leading-relaxed text-white/80 sm:mt-3 sm:max-w-lg sm:text-sm md:text-base"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {description}
            </p>
          )}
          {/^https?:\/\//i.test(destination) ? (
            <a href={destination} target="_blank" rel="noreferrer" className={ctaClassName}>
              {ctaLabel}
            </a>
          ) : (
            <Link to={destination} className={ctaClassName}>
              {ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const HeroSlider = memo(function HeroSlider({
  slides,
  autoRotate = true,
  defaultDuration = 5000,
}: HeroSliderProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const len = slides.length;
  const hasMultiple = len > 1;

  // Navigation must remain responsive even when a CSS fade is in progress.
  // The former timeout-based transition lock could leave the controls ignored
  // after the Home data changed or a timer was throttled in the background.
  const goTo = useCallback((index: number) => {
    if (len === 0) return;
    setCurrent(((index % len) + len) % len);
  }, [len]);

  const next = useCallback(() => {
    if (len === 0) return;
    setCurrent((index) => (index + 1) % len);
  }, [len]);
  const prev = useCallback(() => {
    if (len === 0) return;
    setCurrent((index) => (index - 1 + len) % len);
  }, [len]);

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handleImageError = (index: number) => {
    setFailedImages((previous) => new Set(previous).add(index));
  };

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

  // A collection can be edited while the Home page is open. Keep the active
  // index valid so the hero never renders an undefined slide.
  useEffect(() => {
    if (len > 0 && current >= len) setCurrent(0);
  }, [current, len]);

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

  // `len === 0` is the pending state: the hero query has not resolved yet. The
  // component still renders - see the pending stage inside the slides container -
  // so the hero <img> enters the DOM in the FIRST React commit and is PATCHED in
  // place when the slides arrive, rather than the whole slider being mounted
  // later and repainting an identical box (which resets Largest Contentful Paint
  // to the moment the query returned, ~1.3s after the bytes were already ready).
  const pending = len === 0;
  const activeIndex = current < len ? current : 0;
  const slide = pending ? null : slides[activeIndex];
  const overlayOpacity = slide?.hero_overlay_opacity ?? 0.45;

  return (
    // The section stays decorative (aria-hidden) while pending: no slides, nothing
    // for assistive tech to explore. Dropping the attribute when slides arrive is
    // an attribute write, never a repaint.
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
      aria-hidden={pending || undefined}
    >
      {/* Slides container */}
      <div
        className="relative aspect-[16/9] min-h-[240px] w-full sm:min-h-[280px] md:aspect-[21/9] md:min-h-[360px] lg:min-h-[440px]"
        style={{ backgroundColor: "#1C1C1E" }}
      >
        {/* Pending stage: the hero query is still in flight, so slide 0 does not
            exist yet - but the box still paints the default artwork (byte-for-
            byte the file index.html preloads) behind the default overlay.

            Same key ("lead"), same classes, same HeroArtwork props as slide 0
            below. When the query resolves, React therefore PATCHES this div in
            place instead of replacing the subtree: the <picture> and <img> nodes
            survive with identical src/srcset for the seeded campaign (the legacy
            banner URL resolves to the same preloaded webp via
            getHeroImageSources), and an <img> whose attributes never change
            never repaints - so the Largest Contentful Paint candidate painted at
            first commit stays the final one. The old shape - a placeholder
            <div> in LandingPage swapped for this slider - replaced those nodes
            and repainted the identical box, which is why Lighthouse reported LCP
            at the QUERY arrival instead of at first paint. */}
        {/* ONE child slot for both states: the pending stage and the live slides
            must come from the SAME expression, both as arrays, so React's children
            normalization sees identical shapes and keys. Two separate slots
            (`{pending && ...}` beside `{slides.map(...)}`) normalize differently
            (element vs array), the keys never line up, and React REPLACES the
            subtree on arrival - a fresh <img> repaints the identical box and
            resets Largest Contentful Paint to the data. The node-identity contract
            is pinned by src/test/heroLcpSwap.test.tsx. */}
        {pending ? [
          <div
            key="lead"
            className="absolute inset-0 transition-opacity duration-500 ease-in-out opacity-100"
            aria-hidden="true"
          >
            <HeroArtwork
              imageUrl={DEFAULT_HERO_IMAGE_URL}
              alt=""
              priority
              imgClassName="h-full w-full object-cover opacity-100"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to right, rgba(0,0,0,${overlayOpacity + 0.2}) 0%, rgba(0,0,0,${overlayOpacity}) 50%, rgba(0,0,0,${overlayOpacity * 0.6}) 100%)`,
              }}
            />
            {/* Copy overlay painted BEFORE the query resolves, from the
                build-time defaults. Same HeroCopy the live slide uses, so the
                pending -> live swap patches these text nodes in place. */}
            <HeroCopy
              badge={DEFAULT_HERO_COPY.badge}
              title={DEFAULT_HERO_COPY.title}
              description={DEFAULT_HERO_COPY.description}
              destination={DEFAULT_HERO_COPY.ctaLink}
              ctaLabel={DEFAULT_HERO_COPY.ctaLabel}
            />
          </div>,
        ] : slides.map((s, index) => {
          const isActive = index === activeIndex;
          const imageAlt = s.title || "Hero banner";
          const imageSource = getHeroImageSources(s.image_url);
          // Slide 0 shares the pending stage's key so the swap from pending to
          // live slides reconciles onto the SAME DOM node.
          return (
            <div
              key={index === 0 ? "lead" : s.id}
              className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${index + 1} of ${len}: ${s.title}`}
              aria-hidden={!isActive}
            >
              {/* Background image */}
              {imageSource.src && !failedImages.has(index) ? (
                <HeroArtwork
                  imageUrl={s.image_url}
                  alt={imageAlt}
                  priority={index === 0}
                  imgClassName={`h-full w-full object-cover ${
                    index === 0 ? "opacity-100" : "transition-opacity duration-700 " + (loadedImages.has(index) ? "opacity-100" : "opacity-0")
                  }`}
                  onLoad={() => handleImageLoad(index)}
                  onError={() => handleImageError(index)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1C1C1E] to-[#333333]">
                  <div className="px-6 text-center">
                    <p className="text-4xl font-black text-white/20 uppercase tracking-tight">{s.title}</p>
                    {failedImages.has(index) && <p className="mt-3 text-xs font-medium text-white/60">Banner image unavailable</p>}
                  </div>
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
              <HeroCopy
                badge={s.hero_badge}
                title={s.title}
                description={s.description}
                destination={s.hero_cta_link || `/collections/${s.slug}`}
                ctaLabel={s.cta_label || "Shop now"}
              />
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
              aria-current={index === activeIndex ? "true" : undefined}
              className={`h-2 rounded-full transition-all ${
                index === activeIndex ? "w-8 bg-white" : "w-2 bg-white/40 hover:bg-white/60"
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
