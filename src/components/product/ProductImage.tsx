import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { getProductCardImageUrl } from "@/lib/productImages";

interface ProductImageProps {
  src: string;
  alt: string;
  variant?: "card" | "detail" | "thumb";
  className?: string;
  loading?: "lazy" | "eager";
}

export default function ProductImage({
  src,
  alt,
  variant = "card",
  className,
  loading = "lazy",
}: ProductImageProps) {
  const preferredSrc = useMemo(
    () => (variant === "card" || variant === "thumb" ? getProductCardImageUrl(src) ?? src : src),
    [src, variant],
  );
  const [currentSrc, setCurrentSrc] = useState(preferredSrc);

  useEffect(() => {
    setCurrentSrc(preferredSrc);
  }, [preferredSrc]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      loading={loading}
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
