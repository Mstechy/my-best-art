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
  /**
   * Density candidates for the mobile `<source>`, mirroring byte-for-byte the
   * `imagesrcset` on the shell's media-keyed preload (see index.html). Both sides
   * must state the SAME candidate list under the SAME media query: the preload
   * scanner and the `<picture>` then run the same selection algorithm and always
   * agree on one file - a phone at 1x CSS pixels gets the small 480x270 render
   * (about a third of the bytes Lighthouse flagged as oversized), 2x and 3x devices
   * keep the 960x540 file they get today.
   */
  mobileSrcSet?: string;
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
      mobileSrcSet: "/images/electronics-products-480x270.webp 1x, /images/electronics-products-960x540.webp 2x",
      width: 1600,
      height: 686,
      mobileWidth: 960,
      mobileHeight: 540,
    };
  }

  return { src: src ?? "" };
}

/**
 * The artwork `HeroSlider`'s pending stage paints before `hero_collections`
 * resolves, and the URL the shell already preloads (`index.html`).
 *
 * The slider mounts in the FIRST React commit with `slides=[]` and switches to
 * the live slides by patching slide 0 in place (same key, same props), so this
 * file is what the <img> shows from first paint through data arrival WITHOUT a
 * repaint - which is what keeps Largest Contentful Paint tied to the first
 * commit instead of to the query. It is byte-for-byte the preloaded file, and
 * `getHeroImageSources` above resolves the seeded campaign to the same webp, so
 * painting it first costs no extra request.
 */
export const DEFAULT_HERO_IMAGE_URL = LEGACY_ELECTRONICS_HERO_URL;
