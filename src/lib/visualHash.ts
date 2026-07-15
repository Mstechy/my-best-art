export type VisualHash = { hash: string; buckets: string[] };

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Unable to read image")); };
    image.src = url;
  });
}

/** 64-bit difference hash: free, fast, and robust to small resizes/compression changes. */
export async function createVisualHash(file: File): Promise<VisualHash> {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = 9; canvas.height = 8;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Visual search is not supported by this browser");
  context.drawImage(image, 0, 0, 9, 8);
  const pixels = context.getImageData(0, 0, 9, 8).data;
  let bits = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const left = (y * 9 + x) * 4; const right = left + 4;
    const leftLuma = pixels[left] * 0.299 + pixels[left + 1] * 0.587 + pixels[left + 2] * 0.114;
    const rightLuma = pixels[right] * 0.299 + pixels[right + 1] * 0.587 + pixels[right + 2] * 0.114;
    bits += leftLuma > rightLuma ? "1" : "0";
  }
  const hash = Array.from({ length: 16 }, (_, index) => parseInt(bits.slice(index * 4, index * 4 + 4), 2).toString(16)).join("");
  return { hash, buckets: ["a:", "b:", "c:", "d:"].map((prefix, index) => prefix + hash.slice(index * 4, index * 4 + 4)) };
}
