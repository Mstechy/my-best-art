import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getProductCardImageUrl } from "@/lib/productImages";
import ProgressiveImage from "@/components/ui/ProgressiveImage";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  variant?: "card" | "detail" | "thumb";
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
}

export default function ProductImage({
  src,
  alt,
  variant = "card",
  className,
  loading = "lazy",
  fetchPriority = "auto",
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
  const [currentSrc, setCurrentSrc] = useState<string | null>(cardSrc);
  const [triedFallback, setTriedFallback] = useState(false);

  useEffect(() => {
    setCurrentSrc(cardSrc);
    setTriedFallback(false);
  }, [cardSrc]);

  const handleError = () => {
    // If we're showing the card-optimized URL and it fails, fall back to the original URL
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
      className={cn(
        "h-full w-full select-none transition-transform duration-300",
        variant === "detail" ? "object-contain" : "object-cover",
        className,
      )}
    />
  );
}
