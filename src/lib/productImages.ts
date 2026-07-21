import { supabase } from "@/integrations/supabase/client";

const CARD_SIZE = 900;
const CARD_QUALITY = 0.86;
const CARD_MIME_TYPE = "image/webp";

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

export async function createProductCardImage(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = CARD_SIZE;
  canvas.height = CARD_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image optimization is not supported in this browser");

  ctx.fillStyle = "#f7f7f5";
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const scale = Math.max(CARD_SIZE / image.naturalWidth, CARD_SIZE / image.naturalHeight);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const x = Math.round((CARD_SIZE - width) / 2);
  const y = Math.round((CARD_SIZE - height) / 2);

  ctx.drawImage(image, x, y, width, height);
  return canvasToBlob(canvas, CARD_MIME_TYPE, CARD_QUALITY);
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
  return {
    originalUrl: data.publicUrl,
    cardUrl: getProductCardImageUrl(data.publicUrl),
  };
}
