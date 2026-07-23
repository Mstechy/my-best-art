import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getProductCardImageUrl } from "@/lib/productImages";
import ProgressiveImage from "@/components/ui/ProgressiveImage";

interface ProductImageProps {
  src: string;
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
  const preferredSrc = useMemo(
    () => (variant === "card" || variant === "thumb" ? getProductCardImageUrl(src) ?? src : src),
    [src, variant],
  );
  const [currentSrc, setCurrentSrc] = useState(preferredSrc);

  useEffect(() => {
    setCurrentSrc(preferredSrc);
  }, [preferredSrc]);

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
            if (currentSrc !== src) setCurrentSrc(src);
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
        if (currentSrc !== src) setCurrentSrc(src);
      }}
      className={cn(
        "h-full w-full select-none transition-transform duration-300",
        variant === "detail" ? "object-contain" : "object-cover",
        className,
      )}
    />
  );
}