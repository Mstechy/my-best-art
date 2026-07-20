// Image optimization utilities for Core Web Vitals

// Responsive image srcset generator
export const generateSrcSet = (
  baseUrl: string,
  widths: number[] = [320, 640, 768, 1024, 1280, 1536]
): string => {
  return widths
    .map(width => {
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}width=${width}&quality=80 ${width}w`;
    })
    .join(', ');
};

// Get optimal image size based on viewport
export const getOptimalImageSize = (viewportWidth: number): number => {
  if (viewportWidth <= 640) return 640;
  if (viewportWidth <= 768) return 768;
  if (viewportWidth <= 1024) return 1024;
  if (viewportWidth <= 1536) return 1536;
  return 1920;
};

// Lazy load image with intersection observer
export const lazyLoadImage = (
  imgElement: HTMLImageElement,
  src: string,
  placeholder?: string
): void => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          imgElement.src = src;
          imgElement.loading = 'lazy';
          observer.disconnect();
        }
      });
    },
    { rootMargin: '50px 0px', threshold: 0.01 }
  );

  observer.observe(imgElement);
  
  if (placeholder) {
    imgElement.src = placeholder;
  }
};

// Preload critical images for LCP
export const preloadCriticalImage = (url: string, width?: number): void => {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  if (width) {
    link.imageSrcset = `${url}?width=${width} ${width}w`;
    link.imageSizes = `(max-width: ${width}px) ${width}px, ${width}px`;
  }
  link.href = url;
  document.head.appendChild(link);
};

// WebP/AVIF conversion helper
export const convertToModernFormat = (
  url: string,
  format: 'webp' | 'avif' = 'webp'
): string => {
  const separator = url.includes('?') ? '&' : '?';
  const ext = format === 'webp' ? '.webp' : '.avif';
  
  // For Supabase storage, append format parameter
  if (url.includes('supabase.co/storage')) {
    return `${url}${separator}format=${format}`;
  }
  
  return url;
};