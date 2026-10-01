/**
 * Hero artwork resolution.
 *
 * Lives in a plain module rather than in `HeroSlider.tsx` for two reasons: a
 * component file that also exports a constant defeats React Fast Refresh
 * (`react-refresh/only-export-components`), and the landing page needs the
 * default URL without importing the slider, so the shell's first paint does not
 * have to pull the carousel in for it.
 */

/**
 * The first production hero was stored as a 1.46 MB PNG. Keep its database
 * record intact until an authenticated admin can replace it, but serve the
 * equivalent responsive WebP assets bundled with the application. New or
 * changed collection URLs automatically use their original source.
 */
export const LEGACY_ELECTRONICS_HERO_URL =
  "https://bnkyddmmhaaefzfvzpqs.supabase.co/storage/v1/object/public/collection-banners/fbd21376-73f5-40f4-bea7-e2abf0bdb686/1789836120388-93ee0dad-7ae7-4b8f-bd88-aeb316960426.png";

export type HeroImageSources = {
  src: string;
  mobileSrc?: string;
  width?: number;
  height?: number;
  mobileWidth?: number;
  mobileHeight?: number;
};

export function getHeroImageSources(src: string | null): HeroImageSources {
  if (src === LEGACY_ELECTRONICS_HERO_URL) {
    return {
      src: "/images/electronics-products-1600x686.webp",
      mobileSrc: "/images/electronics-products-960x540.webp",
      width: 1600,
      height: 686,
      mobileWidth: 960,
      mobileHeight: 540,
    };
  }

  return { src: src ?? "" };
}

/**
 * The artwork the landing page paints before `hero_collections` resolves.
 *
 * `HeroSlider` can only mount once the hero query returns, so the largest
 * contentful paint used to queue behind a Supabase round trip: Lighthouse
 * measured the image bytes ready at ~0.66s and still painted at ~3.39s, a 2.72s
 * Render Delay. This is byte-for-byte the URL the shell already preloads
 * (`index.html`), so painting it first costs no extra request and the element
 * that lands is identical to the one the slider renders for the primary
 * campaign.
 */
export const DEFAULT_HERO_IMAGE_URL = LEGACY_ELECTRONICS_HERO_URL;
