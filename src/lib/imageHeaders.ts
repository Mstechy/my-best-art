/**
 * Intrinsic image size, read from an image file's own header bytes.
 *
 * This module is deliberately free of DOM types. The same code has to run in three
 * places that do not share a type environment:
 *
 *   1. the browser, at upload time (`src/lib/imageDimensions.ts` adds the decode),
 *   2. a Node maintenance script that backfills the products uploaded before the
 *      dimensions existed (`scripts/backfillImageDimensions.ts`), and
 *   3. the test suite.
 *
 * Keeping the parsing here means the size a card reserves and the size the backfill
 * stores come from one implementation. `tsconfig.node.json` compiles for Node with
 * `lib: ["ES2023"]` - no DOM - so a single shared module is only possible if
 * nothing in it touches `Image`, `createImageBitmap` or `File`.
 *
 * Formats: PNG, JPEG, GIF and WebP are parsed. SVG deliberately is not - its
 * `width`/`height` are optional and often absent or expressed in units the raster
 * pipeline cannot use, so it falls back to 1:1 like any other unknown. Nothing is
 * guessed from the file extension.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * The ratio a tile reserves when the real one is unknown.
 *
 * 1:1 rather than the tallest allowed size: an unmeasured product is usually one
 * of the older rows, and reserving a tall box for it would make the first paint of
 * every legacy listing taller than its image really is - a page that shrinks as it
 * loads is worse than one that grows slightly.
 */
export const FALLBACK_ASPECT_RATIO = 1;

/** Tallest ratio a masonry tile may be displayed at (portrait 3:4). */
export const MIN_DISPLAY_ASPECT_RATIO = 3 / 4;

/** Widest ratio a masonry tile may be displayed at (square). */
export const MAX_DISPLAY_ASPECT_RATIO = 1;

/**
 * Shortest edge the marketplace accepts for an uploaded product photo.
 *
 * A masonry tile is cropped to between 3:4 and 1:1 and rendered at up to about 360
 * CSS px on a desktop (roughly 1080 device px at DPR 3). Below an 800px short edge a
 * 3:4 crop can no longer fill that box with real pixels, so the tile would be
 * upscaled and the feed would look soft next to listings uploaded properly.
 */
export const MIN_UPLOAD_SHORT_SIDE = 800;

/**
 * Formats a SELLER may publish.
 *
 * jpg/jpeg/png/webp only, deliberately. GIF and SVG can be STORED as the original
 * upload (the card derivative path accepts them), but neither survives the crop a
 * catalogue tile applies: a GIF is animated and a flat SVG has no intrinsic pixel
 * size to crop from. The seller picker already filters to these same three formats
 * via `ACCEPTED_IMAGE_TYPES`, so this keeps the validator, the picker and the task's
 * upload rule in one agreement rather than three overlapping ones.
 */
export const ALLOWED_IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;

export type AllowedImageFormat = (typeof ALLOWED_IMAGE_FORMATS)[number];

/**
 * A whole, positive pixel count - or `null` when the value cannot be a size.
 *
 * `null` rather than `0` or a clamp to 1: a size of zero is not a size, and it must
 * never be stored or reserved, because the card's height is `width / height`.
 */
export function positiveInt(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : null;
}

/** `{ width, height }` with both sides usable, or `null` when either is unknown. */
export function normalizeImageDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): ImageDimensions | null {
  const safeWidth = positiveInt(width);
  const safeHeight = positiveInt(height);
  if (safeWidth === null || safeHeight === null) return null;
  return { width: safeWidth, height: safeHeight };
}

/**
 * Aspect ratio (width / height) to reserve for a tile, clamped to [3:4, 1:1].
 *
 * Clamped rather than trusted: a seller can upload a 3000x800 panorama or a
 * 900x4000 phone screenshot, and either one un-clamped would dominate the feed -
 * one as a letterbox strip, the other as a column-height monster that pushes every
 * other card off the first screen. The row keeps the true ratio in the data; only
 * the DISPLAY is bounded, and `object-fit: cover` means the crop loses edges, never
 * aspect accuracy to the shopper.
 */
export function clampDisplayAspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): number {
  const dimensions = normalizeImageDimensions(width, height);
  if (!dimensions) return FALLBACK_ASPECT_RATIO;
  const ratio = dimensions.width / dimensions.height;
  if (!Number.isFinite(ratio)) return FALLBACK_ASPECT_RATIO;
  return Math.min(MAX_DISPLAY_ASPECT_RATIO, Math.max(MIN_DISPLAY_ASPECT_RATIO, ratio));
}

/**
 * The same clamp applied to an already-normalised pair. */
export function clampDisplayAspectRatioOf(dimensions: ImageDimensions | null): number {
  if (!dimensions) return FALLBACK_ASPECT_RATIO;
  return clampDisplayAspectRatio(dimensions.width, dimensions.height);
}

/** Height of a tile body at a given column width - the value the layout sorts on. */
export function tileHeightForWidth(aspectRatio: number, width: number): number {
  const safeRatio = aspectRatio > 0 ? aspectRatio : FALLBACK_ASPECT_RATIO;
  return width / safeRatio;
}

// ── Byte-header parsing ────────────────────────────────────────────────────

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16) + bytes[offset + 3] * 0x1000000;
}

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length) return false;
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

function parsePng(bytes: Uint8Array): ImageDimensions | null {
  // 8-byte signature, then the IHDR chunk: length(4) type(4) width(4) height(4).
  if (bytes.length < 24) return null;
  if (bytes[0] !== 0x89 || !matchesAscii(bytes, 1, "PNG")) return null;
  if (!matchesAscii(bytes, 12, "IHDR")) return null;
  return normalizeImageDimensions(readUint32BE(bytes, 16), readUint32BE(bytes, 20));
}

function parseGif(bytes: Uint8Array): ImageDimensions | null {
  // "GIF87a"/"GIF89a", then width and height as little-endian 16-bit values.
  if (bytes.length < 10) return null;
  if (!matchesAscii(bytes, 0, "GIF8")) return null;
  return normalizeImageDimensions(readUint16LE(bytes, 6), readUint16LE(bytes, 8));
}

/**
 * JPEG is a marker walk, not a fixed offset: metadata segments of arbitrary length
 * (EXIF from a phone camera, an embedded colour profile, a thumbnail) sit between
 * the SOI marker and the frame header that carries the size. The walk skips each
 * segment by its declared length and stops at the first Start-Of-Frame.
 */
function parseJpeg(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      // Not a marker boundary: either the stream is corrupt or the header read was
      // too short to reach the frame header. Step one byte and keep looking.
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    // Padding (FF FF) and standalone markers carry no length field.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const segmentLength = readUint16BE(bytes, offset + 2);
    if (segmentLength < 2) return null;
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      // SOF payload: precision(1) height(2) width(2).
      return normalizeImageDimensions(readUint16BE(bytes, offset + 7), readUint16BE(bytes, offset + 5));
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function parseWebp(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) return null;
  if (!matchesAscii(bytes, 0, "RIFF") || !matchesAscii(bytes, 8, "WEBP")) return null;

  if (matchesAscii(bytes, 12, "VP8X")) {
    // Extended (alpha/animation) container: canvas width-1 and height-1 as 24-bit LE.
    return normalizeImageDimensions(readUint24LE(bytes, 24) + 1, readUint24LE(bytes, 27) + 1);
  }

  if (matchesAscii(bytes, 12, "VP8L")) {
    // Lossless: a 14-bit width-1 and 14-bit height-1 packed into one 32-bit LE word.
    if (bytes[20] !== 0x2f) return null;
    const bits = readUint32LE(bytes, 21);
    return normalizeImageDimensions((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }

  if (matchesAscii(bytes, 12, "VP8 ")) {
    // Lossy: frame tag(3) start code(3) then 14-bit width and height, little-endian.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return normalizeImageDimensions(readUint16LE(bytes, 26) & 0x3fff, readUint16LE(bytes, 28) & 0x3fff);
  }

  return null;
}

/**
 * Intrinsic size from an image file's leading bytes, or `null` if it cannot be read.
 *
 * Returning `null` rather than throwing is the contract the whole feature rests on:
 * an unknown size is a 1:1 reserved box, never a missing product.
 */
export function parseImageDimensions(bytes: Uint8Array | ArrayBuffer): ImageDimensions | null {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.length < 10) return null;
  return parsePng(view) ?? parseJpeg(view) ?? parseGif(view) ?? parseWebp(view);
}

/** How many leading bytes `parseImageDimensions` needs. Used for ranged backfill reads. */
export const IMAGE_HEADER_SNIFF_BYTES = 65_536;

