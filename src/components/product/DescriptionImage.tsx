import React, { useEffect, useRef, useState } from "react";
import { X, ZoomIn } from "lucide-react";

type DescriptionImageProps = {
  url: string;
  alt?: string | null;
  className?: string;
};

export default function DescriptionImage({ url, alt, className = "" }: DescriptionImageProps) {
  const [zoomed, setZoomed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [url]);

  if (!url) return null;

  return (
    <>
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-[#E8E8E8] bg-[#F7F7F5] shadow-sm dark:border-[#2A2A2A] dark:bg-[#181818] ${className}`}
        aria-busy={!loaded && !loadFailed}
      >
        {loadFailed ? (
          <div className="flex min-h-[180px] items-center justify-center px-6 text-center text-xs font-medium text-[#6E6C64] dark:text-[#A0A0A0]" role="img" aria-label={alt || "Product detail image unavailable"}>
            This product detail image is unavailable.
          </div>
        ) : (
          <>
            {!loaded && <div className="absolute inset-0 min-h-[180px] animate-pulse bg-[#ECECE8] dark:bg-[#242424]" aria-hidden="true" />}
            <img
              src={url}
              ref={imageRef}
              alt={alt || "Product detail description graphic"}
              loading="lazy"
              decoding="async"
              className={`relative block w-full h-auto object-contain transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setLoaded(false);
                setLoadFailed(true);
              }}
            />
            {/* Tap-to-zoom lightbox trigger */}
            {loaded && (
              <button
                type="button"
                onClick={() => setZoomed(true)}
                className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D]"
                aria-label="Zoom image"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Fullscreen Lightbox */}
      {zoomed && !loadFailed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-2"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={url} alt={alt || "Enlarged product detail"} className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30"
              aria-label="Close zoomed image"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
