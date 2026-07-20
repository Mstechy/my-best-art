// Font optimization utilities
export const FONT_CONFIG = {
  families: {
    heading: "'Space Grotesk', system-ui, -apple-system, sans-serif",
    body: "'Inter', system-ui, -apple-system, sans-serif",
  },
  weights: [400, 500, 600, 700] as const,
  subsets: ['latin-ext'] as const,
  display: 'swap' as const,
};

// Preload critical font weights only
export const preloadCriticalFonts = () => {
  if (typeof document === 'undefined') return;
  
  const criticalWeights = [400, 600]; // Only load regular and semibold initially
  const fontPromises = criticalWeights.map(() => {
    return document.fonts.load(`400 1em "${FONT_CONFIG.families.body}"`).catch(() => null);
  });
  
  return Promise.all(fontPromises);
};