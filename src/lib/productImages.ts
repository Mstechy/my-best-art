import { supabase } from "@/integrations/supabase/client";
import { normalizeImageDimensions, type ImageDimensions } from "@/lib/imageDimensions";

// Grid cards are roughly 180px on a phone and 300px on a desktop. At 3x DPR the
// largest realistic slot is about 900px, but Lighthouse measured the 900px
// derivative being fetched as 462 KB - far past what the slot can show - so the
// large derivative is now 600px, which covers a 200px slot at 3x and matches the
// 3:4-1:1 recommendation. Existing uploads keep their stored file; only new ones
// get the smaller derivative.
const CARD_SIZE = 600;
const CARD_QUALITY = 0.72;
const CARD_MIME_TYPE = "image/webp";
// A phone slot needs about 320px; this variant is uploaded alongside the large one.
const SMALL_CARD_SIZE = 320;
const SMALL_CARD_QUALITY = 0.72;

/** Intrinsic width of the large card derivative, for `srcset` descriptors. */
export const CARD_IMAGE_WIDTH = CARD_SIZE;

/** Intrinsic width of the small card derivative used on phones. */
export const SMALL_CARD_IMAGE_WIDTH = SMALL_CARD_SIZE;

const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "bash", "zsh", "ps1", "vbs", "js", "jse",
  "vba", "vbe", "wsf", "wsh", "msi", "msp", "scr", "pif", "hta",
  "cpl", "reg", "com", "dll", "sys",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);

const safeFileStem = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product-image";

const extensionFor = (file: File) => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !/^[a-z0-9]+$/.test(ext)) return "jpg";
  if (BLOCKED_EXTENSIONS.has(ext)) return "jpg";
  if (ALLOWED_EXTENSIONS.has(ext)) return ext;
  // Fallback for unknown safe extensions
  return /^[a-z]{2,4}$/.test(ext) ? ext : "jpg";
};

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image"));
    };
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to optimize image"));
    }, type, quality);
  });

/**
 * Geometry for the square cover-crop used by every product card derivative.
 *
 * The rule that matters: the output is never larger than the source needs, and
 * an image is never scaled UP. A 800x800 source used to be blown up to the 900px
 * target and re-encoded at quality 0.86, which produced a 456 KB "optimised"
 * card from a 108 KB original - over four times the bytes for zero extra detail,
 * and the single largest file on the homepage.
 *
 * The cover-crop shape is unchanged: the output stays square, the image still
 * fills it, and anything that does not fill it keeps the neutral background.
 * Only the size shrinks, and only when the source is smaller than the target.
 */
export function computeCardDrawBox(naturalWidth: number, naturalHeight: number, size: number) {
  // A decode can report 0 for a dimension; fall back to a 1px square rather than
  // dividing by zero and handing the canvas NaN dimensions.
  const sourceWidth = Math.max(1, naturalWidth || 0);
  const sourceHeight = Math.max(1, naturalHeight || 0);
  const longestEdge = Math.max(sourceWidth, sourceHeight);
  // Cap at the source's own longest edge: a smaller source keeps its own size.
  const outputSize = Math.max(1, Math.min(size, longestEdge));
  // Cover-crop: scale so the longest edge fills the output, never above 1:1.
  const scale = outputSize / longestEdge;
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  return {
    outputSize,
    width,
    height,
    x: Math.round((outputSize - width) / 2),
    y: Math.round((outputSize - height) / 2),
  };
}

export async function createProductCardImage(
  file: File,
  size = CARD_SIZE,
  quality = CARD_QUALITY,
  /**
   * An already-decoded bitmap for this file.
   *
   * The upload path measures the image and derives two card derivatives from it, and
   * decoding a 12 MP phone photo three times is real work on a phone. Passing the
   * first decode in removes two of those decodes without changing anything about
   * what is produced.
   */
  decoded?: HTMLImageElement,
): Promise<Blob> {
  const image = decoded ?? (await loadImage(file));
  const { outputSize, width, height, x, y } = computeCardDrawBox(image.naturalWidth, image.naturalHeight, size);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image optimization is not supported in this browser");

  ctx.fillStyle = "#f7f7f5";
  ctx.fillRect(0, 0, outputSize, outputSize);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(image, x, y, width, height);
  return canvasToBlob(canvas, CARD_MIME_TYPE, quality);
}

export function getProductCardImageUrl(originalUrl: string | null | undefined) {
  if (!originalUrl || !originalUrl.includes("/original-")) return originalUrl ?? null;
  const [withoutQuery, query] = originalUrl.split("?", 2);
  const cardUrl = withoutQuery.replace(/\/original-(.+?)(?:\.[^/.]+)?$/i, "/card-$1.webp");
  if (cardUrl === withoutQuery) return originalUrl;
  return query ? `${cardUrl}?${query}` : cardUrl;
}

export interface UploadedProductImage {
  originalUrl: string;
  cardUrl: string | null;
  cardSmallUrl: string | null;
  /** Intrinsic size of the ORIGINAL upload, or `null` when it could not be decoded. */
  dimensions: ImageDimensions | null;
  /** Byte size of the original upload. */
  bytes: number;
  /** Lowercase extension actually used for the stored original. */
  format: string;
}

/**
 * Upload one product photo as its derivatives and report what was measured.
 *
 * "At upload time" is the only moment the intrinsic size is free: the file is
 * already in memory and already being decoded for the card derivative, so the
 * dimensions cost one property read. The alternative - measuring later during the
 * backfill - means re-downloading every image, which is why the size is captured
 * here and persisted by the caller.
 *
 * This project has no application server: uploads go straight from the seller's
 * browser to Supabase Storage. So "server-side" measurement is not available and
 * this is the closest honest equivalent - the measurement happens once, at the
 * moment of upload, and the result is stored in the database rather than recomputed
 * per visitor.
 */
/**
 * One year, in seconds - the value storage-js wraps as `max-age=<value>`.
 *
 * Every key written here embeds `Date.now()` at upload time
 * (`original-<epoch>-<stem>`, `card-<epoch>-<stem>`, `card320-<epoch>-<stem>`),
 * so a changed file can never reuse an old key and a cached copy can never go
 * stale. Supabase's default (`3600`) is what made Lighthouse price a single
 * homepage `original-*.jpeg` at 93 KiB of repeat-visit transfer. Deliberately
 * not `immutable`: a year-long, revalidatable copy stays correct even if a key
 * is ever rewritten in place (the derivative recipe has been re-derived before).
 *
 * Must be seconds only - storage-js renders it as `max-age=${value}`.
 */
export const IMAGE_CACHE_CONTROL = "31536000";

export async function uploadProductImagePair(file: File, basePath: string): Promise<UploadedProductImage> {
  const timestamp = Date.now();
  const stem = `${timestamp}-${safeFileStem(file.name)}`;
  const format = extensionFor(file);
  const originalPath = `${basePath}/original-${stem}.${format}`;
  const cardPath = `${basePath}/card-${stem}.webp`;
  const cardSmallPath = `${basePath}/card320-${stem}.webp`;

  // One decode covers the measurement and both derivatives. A failure here is not
  // fatal: an unmeasurable image is published with a 1:1 reserved box rather than
  // rejected, because a product photo must not be blocked by a decode quirk.
  let decoded: HTMLImageElement | undefined;
  let dimensions: ImageDimensions | null = null;
  try {
    decoded = await loadImage(file);
    dimensions = normalizeImageDimensions(decoded.naturalWidth, decoded.naturalHeight);
  } catch (error) {
    console.warn("Could not measure the uploaded image; the card will reserve a 1:1 box.", error);
  }

  const { error: originalError } = await supabase.storage
    .from("product-images")
    .upload(originalPath, file, { contentType: file.type || "image/jpeg", cacheControl: IMAGE_CACHE_CONTROL, upsert: false });

  if (originalError) throw originalError;

  try {
    const cardBlob = await createProductCardImage(file, CARD_SIZE, CARD_QUALITY, decoded);
    await supabase.storage
      .from("product-images")
      .upload(cardPath, cardBlob, { contentType: CARD_MIME_TYPE, cacheControl: IMAGE_CACHE_CONTROL, upsert: false });
  } catch (error) {
    console.warn("Product card image optimization failed; original image will be used.", error);
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(originalPath);
  let cardSmallUrl: string | null = null;
  try {
    const smallBlob = await createProductCardImage(file, SMALL_CARD_SIZE, SMALL_CARD_QUALITY, decoded);
    const { error: smallError } = await supabase.storage
      .from("product-images")
      .upload(cardSmallPath, smallBlob, { contentType: CARD_MIME_TYPE, cacheControl: IMAGE_CACHE_CONTROL, upsert: false });
    if (smallError) {
      console.warn("Small card derivative failed; the grid will use the 900px asset.", smallError);
    } else {
      cardSmallUrl = supabase.storage.from("product-images").getPublicUrl(cardSmallPath).data.publicUrl;
    }
  } catch (error) {
    console.warn("Small card derivative failed; the grid will use the 900px asset.", error);
  }

  return {
    originalUrl: data.publicUrl,
    cardUrl: getProductCardImageUrl(data.publicUrl),
    cardSmallUrl,
    dimensions,
    bytes: file.size,
    format,
  };
}
