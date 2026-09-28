import { supabase } from "@/integrations/supabase/client";

const CARD_SIZE = 900;
const CARD_QUALITY = 0.78;
const CARD_MIME_TYPE = "image/webp";

// Grid cards are roughly 180px on a phone and 300px on a desktop, so the 900px
// derivative was 3-5x larger than the slot it filled (280 KB on average). A 320px
// variant is the size a phone actually needs and is uploaded alongside the large one.
const SMALL_CARD_SIZE = 320;
const SMALL_CARD_QUALITY = 0.72;

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

export async function createProductCardImage(file: File, size = CARD_SIZE, quality = CARD_QUALITY): Promise<Blob> {
  const image = await loadImage(file);
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

export async function uploadProductImagePair(file: File, basePath: string) {
  const timestamp = Date.now();
  const stem = `${timestamp}-${safeFileStem(file.name)}`;
  const originalPath = `${basePath}/original-${stem}.${extensionFor(file)}`;
  const cardPath = `${basePath}/card-${stem}.webp`;
  const cardSmallPath = `${basePath}/card320-${stem}.webp`;

  const { error: originalError } = await supabase.storage
    .from("product-images")
    .upload(originalPath, file, { contentType: file.type || "image/jpeg", upsert: false });

  if (originalError) throw originalError;

  try {
    const cardBlob = await createProductCardImage(file);
    await supabase.storage
      .from("product-images")
      .upload(cardPath, cardBlob, { contentType: CARD_MIME_TYPE, upsert: false });
  } catch (error) {
    console.warn("Product card image optimization failed; original image will be used.", error);
  }

  const { data } = supabase.storage.from("product-images").getPublicUrl(originalPath);
  let cardSmallUrl: string | null = null;
  try {
    const smallBlob = await createProductCardImage(file, SMALL_CARD_SIZE, SMALL_CARD_QUALITY);
    const { error: smallError } = await supabase.storage
      .from("product-images")
      .upload(cardSmallPath, smallBlob, { contentType: CARD_MIME_TYPE, upsert: false });
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
  };
}
