/**
 * The browser half of the intrinsic-image-size feature.
 *
 * The maths and the header parsing live in `@/lib/imageHeaders`, which is DOM-free
 * so the Node backfill script can share it. This module adds the only part that
 * needs a browser - decoding a file the seller just picked - and the upload rules
 * that decide whether a photo may be published.
 *
 * Everything in `imageHeaders` is re-exported below, so a component imports the
 * ratio helper and the validator from one place.
 */
import {
  ALLOWED_IMAGE_FORMATS,
  MAX_DISPLAY_ASPECT_RATIO,
  MIN_DISPLAY_ASPECT_RATIO,
  MIN_UPLOAD_SHORT_SIDE,
  normalizeImageDimensions,
  positiveInt,
  type AllowedImageFormat,
  type ImageDimensions,
} from "@/lib/imageHeaders";

export * from "@/lib/imageHeaders";


// ── Browser decode ─────────────────────────────────────────────────────────

/**
 * Intrinsic size of a file the seller just picked.
 *
 * `createImageBitmap` is preferred because it decodes off the main thread, so a
 * phone photo does not jank the listing form. The `Image` element is the fallback
 * for browsers without it. Either way the object URL is revoked on every path,
 * including failure, so picking a dozen large photos cannot leak a dozen decoded
 * bitmaps.
 *
 * Returns `null` - never throws - when the file cannot be decoded: the upload path
 * treats an unmeasurable image as 1:1 rather than as a failure, because a product
 * photo must not be rejected for a metadata problem.
 */
export async function readImageDimensionsFromFile(file: File | Blob): Promise<ImageDimensions | null> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(file);
      return normalizeImageDimensions(bitmap.width, bitmap.height);
    } catch {
      // Fall through to the <img> path: some browsers refuse certain encodings
      // through createImageBitmap while still rendering them in an element.
    } finally {
      bitmap?.close();
    }
  }

  if (typeof Image === "undefined" || typeof URL === "undefined") return null;

  return new Promise<ImageDimensions | null>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    let settled = false;
    const finish = (dimensions: ImageDimensions | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    };
    // A decode that never reports either event would otherwise hang the picker
    // forever, leaving the seller unable to add photos at all. Decoding a 10 MB
    // photo does not take 8 seconds on any device, so timing out is not ambiguous.
    const deadline = setTimeout(() => finish(null), 8000);
    image.onload = () => finish(normalizeImageDimensions(image.naturalWidth, image.naturalHeight));
    image.onerror = () => finish(null);
    image.src = objectUrl;
  });
}

// ── Upload rules ───────────────────────────────────────────────────────────

export interface ImageUploadCheckInput {
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  /** MIME type or filename; only used to name the detected format. */
  type?: string | null;
  name?: string | null;
  /** Hard ceiling for the file size, in bytes. Injected so the rule lives with it. */
  maxBytes: number;
}

export interface ImageUploadCheckResult {
  /** Reasons the image must not be published. Empty means "accept". */
  errors: string[];
  /** Advice that does not block publication (e.g. an unusual crop). */
  warnings: string[];
  format: AllowedImageFormat | null;
}

/** Extension of an upload, lowercased, or `null` when it is not an allowed format. */
export function imageFormatOf(
  name: string | null | undefined,
  type: string | null | undefined,
): AllowedImageFormat | null {
  const fromName = name?.split(".").pop()?.toLowerCase();
  if (fromName && (ALLOWED_IMAGE_FORMATS as readonly string[]).includes(fromName)) {
    return fromName as AllowedImageFormat;
  }
  const subtype = type?.split("/").pop()?.toLowerCase().replace("jpeg", "jpg");
  if (subtype && (ALLOWED_IMAGE_FORMATS as readonly string[]).includes(subtype)) {
    return subtype as AllowedImageFormat;
  }
  return null;
}

/**
 * The vendor upload rules, as a pure function.
 *
 * Two severities, deliberately:
 *   * `errors` block the publish - an unsupported format, a file over the ceiling,
 *     or a photo whose short side is below 800px (which cannot fill a masonry tile
 *     without visible upscaling).
 *   * `warnings` do NOT block - a crop outside the recommended 3:4-1:1 window is a
 *     legitimate creative choice, the feed cover-crops it safely, and refusing it
 *     would stop a seller publishing a real product over a stylistic preference.
 *
 * Dimension and size checks are skipped when the value is unknown, so a file whose
 * header could not be read is governed by format and byte size alone.
 */
export function checkImageUpload(input: ImageUploadCheckInput): ImageUploadCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const format = imageFormatOf(input.name, input.type);

  if (!format) {
    errors.push("Use a JPG, PNG, or WebP image.");
  }

  const bytes = positiveInt(input.bytes);
  if (bytes !== null && bytes > input.maxBytes) {
    const megabytes = (input.maxBytes / (1024 * 1024)).toFixed(0);
    errors.push(`The file is larger than ${megabytes} MB.`);
  }

  const dimensions = normalizeImageDimensions(input.width, input.height);
  if (dimensions) {
    const shortSide = Math.min(dimensions.width, dimensions.height);
    if (shortSide < MIN_UPLOAD_SHORT_SIDE) {
      errors.push(
        `The shortest side is ${shortSide}px. Upload at least ${MIN_UPLOAD_SHORT_SIDE}px on the short side.`,
      );
    }
    const ratio = dimensions.width / dimensions.height;
    if (ratio < MIN_DISPLAY_ASPECT_RATIO || ratio > MAX_DISPLAY_ASPECT_RATIO) {
      warnings.push("A ratio between 3:4 and 1:1 fits the catalogue grid best.");
    }
  }

  return { errors, warnings, format };
}

/** True when the pair is usable for a reserved tile. */
export function hasUsableDimensions(width?: number | null, height?: number | null): boolean {
  return normalizeImageDimensions(width, height) !== null;
}



