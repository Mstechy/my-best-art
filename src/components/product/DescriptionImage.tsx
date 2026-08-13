import React, { useState } from "react";
import { X, ZoomIn } from "lucide-react";

type DescriptionImageProps = {
  url: string;
  alt?: string | null;
  className?: string;
};

export default function DescriptionImage({ url, alt, className = "" }: DescriptionImageProps) {
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <div className={`relative w-full bg-gray-100 dark:bg-gray-800 overflow-hidden rounded-lg mb-2 min-h-[200px] ${className}`}>
        <img
          src={url}
          alt={alt || "Product detail description graphic"}
          loading="lazy"
          decoding="async"
          className="w-full h-auto object-cover transition-opacity duration-300 opacity-0 data-[loaded=true]:opacity-100"
          onLoad={(e) => e.currentTarget.setAttribute("data-loaded", "true")}
        />
        {/* Tap-to-zoom lightbox trigger */}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="absolute top-2 right-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          aria-label="Zoom image"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      {/* Fullscreen Lightbox */}
      {zoomed && (
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