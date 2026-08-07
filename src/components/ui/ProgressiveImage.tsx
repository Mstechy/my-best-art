import { useState, useRef, useEffect, memo } from "react";

interface ProgressiveImageProps {
  src: string;
  alt: string;
  placeholderColor?: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "async" | "sync" | "auto";
  onLoad?: () => void;
  onError?: () => void;
  wrapperClassName?: string;
  blurAmount?: number;
  threshold?: number;
}

function getPlaceholderUrl(src: string): string | null {
  if (!src) return null;
  if (src.includes(".supabase.co/storage/")) {
    const renderSrc = src.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/"
    );
    const separator = renderSrc.includes("?") ? "&" : "?";
    return `${renderSrc}${separator}width=20&quality=10`;
  }
  return null;
}

const ProgressiveImage = memo(function ProgressiveImage({
  src,
  alt,
  placeholderColor = "#F2F3F5",
  className = "",
  style,
  width,
  height,
  loading = "lazy",
  fetchPriority = "auto",
  decoding = "async",
  onLoad,
  onError,
  wrapperClassName = "",
  blurAmount = 20,
  threshold = 0.1,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [inView, setInView] = useState(loading === "eager");
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const placeholderUrl = useRef(getPlaceholderUrl(src));
  const [showPlaceholder, setShowPlaceholder] = useState(!!placeholderUrl.current);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset state when src changes (e.g. fallback from card URL to original URL)
  useEffect(() => {
    setLoaded(false);
    setError(false);
    setShowPlaceholder(!!getPlaceholderUrl(src));
    placeholderUrl.current = getPlaceholderUrl(src);
  }, [src]);

  useEffect(() => {
    if (loading !== "lazy" || inView) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observerRef.current?.disconnect();
          }
        });
      },
      { rootMargin: "200px 0px", threshold }
    );
    if (wrapperRef.current) {
      observerRef.current.observe(wrapperRef.current);
    }
    return () => {
      observerRef.current?.disconnect();
    };
  }, [loading, inView, threshold]);

  const handleLoad = () => {
    setLoaded(true);
    setShowPlaceholder(false);
    setError(false);
    onLoad?.();
  };

  const handleError = () => {
    // Always set error state so the fallback UI shows if the image truly fails
    setError(true);
    setShowPlaceholder(false);
    onError?.();
  };

  const shimmerStyle: React.CSSProperties = !loaded && !error
    ? {
        background: `linear-gradient(90deg, ${placeholderColor} 25%, #E8E8E8 50%, ${placeholderColor} 75%)`,
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s ease-in-out infinite",
      }
    : {};

  return (
    <div
      ref={wrapperRef}
      className={`relative overflow-hidden ${wrapperClassName}`}
      style={{
        width: width ? `${width}px` : "100%",
        height: height ? `${height}px` : "100%",
        backgroundColor: placeholderColor,
        ...style,
      }}
    >
      {showPlaceholder && placeholderUrl.current && (
        <img
          src={placeholderUrl.current}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
          style={{ filter: `blur(${blurAmount}px)`, transform: "scale(1.1)" }}
          width={width ? Math.round(width / 20) : 20}
          height={height ? Math.round(height / 20) : 20}
          loading="eager"
          decoding="async"
        />
      )}

      {(inView || loading === "eager") && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${className}`}
          width={width}
          height={height}
          loading={loading}
          decoding={decoding}
          onLoad={handleLoad}
          onError={handleError}
          style={!error ? shimmerStyle : {}}
        />
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F2F3F5] dark:bg-[#202020]">
          <svg
            className="w-8 h-8 text-[#888880]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
});

export default ProgressiveImage;