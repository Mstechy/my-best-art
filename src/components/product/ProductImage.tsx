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
  const preferredSrc = useMemo(
    () => {
      if (!hasSource) return null;
      return variant === "card" || variant === "thumb" ? getProductCardImageUrl(src) ?? src : src;
    },
    [src, variant, hasSource],
  );
  const [currentSrc, setCurrentSrc] = useState<string | null>(preferredSrc);

  useEffect(() => {
    setCurrentSrc(preferredSrc);
  }, [preferredSrc]);

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
          onError={() => {
            setCurrentSrc(null);
          }}
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
      onError={() => {
        setCurrentSrc(null);
      }}
      className={cn(
        "h-full w-full select-none transition-transform duration-300",
        variant === "detail" ? "object-contain" : "object-cover",
        className,
      )}
    />
  );
}