import { supabase } from "@/integrations/supabase/client";

export type VisualProductQuery = {
  search: string;
  category: string | null;
  confidence: "high" | "medium" | "low";
};

const VISUAL_CATEGORIES = new Set([
  "electronics",
  "fashion",
  "home",
  "beauty",
  "jewelry",
  "toys",
  "automotive",
  "appliances",
]);

/** Read the uploaded image without asking the shopper to describe it. */
export function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read image"));
    };
    reader.onerror = () => reject(reader.error || new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

/**
 * Ask the server-side vision function for visual product terms. The returned
 * terms are generated from the pixels in the upload; the shopper does not
 * need to provide a filename, title, or product description.
 */
export async function analyzeVisualProductImage(imageDataUrl: string): Promise<VisualProductQuery> {
  const { data, error } = await supabase.functions.invoke("visual-product-search", {
    body: { imageDataUrl },
  });
  if (error) throw error;

  const raw = data as Partial<VisualProductQuery> | null;
  const search = typeof raw?.search === "string" ? raw.search.trim().slice(0, 120) : "";
  if (!search) throw new Error("The image did not contain a searchable product.");

  const category = typeof raw?.category === "string" && VISUAL_CATEGORIES.has(raw.category.toLowerCase())
    ? raw.category.toLowerCase()
    : null;
  const confidence = raw?.confidence === "high" || raw?.confidence === "medium" ? raw.confidence : "low";

  return { search, category, confidence };
}
