import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getProductCardImageUrl } from "@/lib/productImages";
import ProgressiveImage from "@/components/ui/ProgressiveImage";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  // 320px derivative for grid cards. When present the browser picks between it and the
  // 900px asset, so a phone stops downloading a 280 KB image for a 180px slot.
  cardSmallUrl?: string | null;
  variant?: "card" | "detail" | "thumb";
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  style?: React.CSSProperties;
}

export default function ProductImage({
  src,
  alt,
  cardSmallUrl,
  variant = "card",
  className,
  loading = "lazy",
  fetchPriority = "auto",
  style,
}: ProductImageProps) {
  const hasSource = !!src && src.trim().length > 0;
  const originalSrc = hasSource ? src : null;
  const cardSrc = useMemo(
    () => {
      if (!originalSrc) return null;
      return variant === "card" || variant === "thumb" ? getProductCardImageUrl(originalSrc) ?? originalSrc : originalSrc;
    },
    [originalSrc, variant],
  );
  // A phone only needs the 320px derivative; the 900px asset stays available for wider
  // viewports and high-density screens. srcSet is only emitted when the small file is
  // known to exist, so the browser is never asked for a missing image.
  //
  // `sizes` mirrors the column widths of BOTH grids this card is used in: the masonry
  // home feed (2/3/4/5 columns at 640/1024/1440) and the aligned catalogue grid
  // (2/3/4/5 at the Tailwind steps). Gaps are about 8-16px, which is well inside the
  // rounding of vw, so one string is honest for both.
  const responsiveSrc = useMemo(() => {
    if (variant !== "card" && variant !== "thumb") return null;
    if (!cardSmallUrl || !cardSrc || cardSmallUrl === cardSrc) return null;
    return {
      srcSet: `${cardSmallUrl} 320w, ${cardSrc} 900w`,
      sizes: "(min-width: 1440px) 18vw, (min-width: 1024px) 23vw, (min-width: 640px) 30vw, 45vw",
    };
  }, [cardSmallUrl, cardSrc, variant]);
  const [currentSrc, setCurrentSrc] = useState<string | null>(responsiveSrc?.srcSet ? cardSmallUrl ?? cardSrc : cardSrc);
  const [triedFallback, setTriedFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(responsiveSrc ? cardSmallUrl ?? cardSrc : cardSrc);
    setTriedFallback(false);
  }, [cardSrc, cardSmallUrl, responsiveSrc]);

  const handleError = () => {
    // Never leave a shopper with a broken tile. The 320px derivative is the first
    // fallback, then the 900px card, then the original upload.
    if (currentSrc === cardSmallUrl && cardSmallUrl && cardSrc && cardSrc !== cardSmallUrl) {
      setCurrentSrc(cardSrc);
      return;
    }
    if (!triedFallback && cardSrc && originalSrc && cardSrc !== originalSrc) {
      setTriedFallback(true);
      setCurrentSrc(originalSrc);
      return;
    }
    setCurrentSrc(null);
  };

  if (!currentSrc) {
    return (
      <div className={cn("h-full w-full rounded-xl bg-[#F2F3F5] text-[#888880] flex items-center justify-center", className)}>
        <span className="text-xs uppercase tracking-[0.15em]">No image</span>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={cn("h-full w-full", className)}>
        <ProgressiveImage
          src={currentSrc}
          srcSet={responsiveSrc?.srcSet}
          sizes={responsiveSrc?.sizes}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          wrapperClassName="h-full w-full"
          className="group-hover:scale-105"
          onError={handleError}
        />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      width={900}
      height={900}
      onError={handleError}
      style={style}
      className={cn(
        "h-full w-full select-none transition-transform duration-300",
        variant === "detail" ? "object-contain" : "object-cover",
        className,
      )}
    />
  );
}
