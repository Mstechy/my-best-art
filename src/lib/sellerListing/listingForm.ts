/**
 * Types, limits and option helpers for the seller listing form.
 *
 * Moved out of SellerProducts.tsx to keep that file focused on the workflow.
 * The option helpers are pure string transforms, so they are safe to unit test
 * and to reuse anywhere a variant key is needed.
 */

type UploadState = "local" | "uploading" | "uploaded" | "error";
const MAX_PRODUCT_IMAGES = 12;
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface ImageMediaItem {
  id: string;
  dbId?: string;
  file?: File;
  url: string;
  name: string;
  isPrimary: boolean;
  alt: string;
  status: UploadState;
  progress: number;
  error?: string;
}

interface DescriptionImageItem {
  id: string;
  file?: File;
  url: string;
  name: string;
  alt: string;
  status: UploadState;
  progress: number;
  error?: string;
}

interface VideoMediaItem {
  id: string;
  file?: File;
  url: string;
  name: string;
  status: UploadState;
  progress: number;
  error?: string;
}

interface VariantDraft { key: string; size: string; color: string; optionName: string; optionValue: string; sku: string; price: string; stock: string; imageUrl: string; imageSourceId?: string; imageFile?: File; }
type ProductFormDraft = { title: string; description: string; price: string; compareAtPrice: string; currency: string; categoryId: string; stockQuantity: string; sku: string; brand: string; weight: string; dimensions: string; material: string; color: string; condition: string; warrantyPeriod: string; shippingInfo: string; keyFeatures: string[]; tagsInput: string; shipsTo: string[]; categoryAttributes: Record<string, string>; productTypeKey: string; variantRows: VariantDraft[]; variantColorValues: string; variantStorageValues: string; variantPrimaryOption?: string; showSoldCount: boolean; formTab: string; seoSlug: string; metaDescription: string; lowStockThreshold: string; };
const LISTING_CURRENCIES = ["NGN", "USD", "GBP", "EUR", "CAD", "AUD", "ZAR", "KES", "GHS", "INR", "JPY", "BRL", "MXN"];
const VARIATION_TYPES = [
  { value: "storage", label: "Storage capacity", placeholder: "128GB, 256GB, 512GB" },
  { value: "size", label: "Size", placeholder: "Small, Medium, Large" },
  { value: "model", label: "Model", placeholder: "Standard, Pro, Max" },
  { value: "finish", label: "Finish", placeholder: "Matte, Glossy" },
  { value: "material", label: "Material", placeholder: "Leather, Stainless steel" },
  { value: "pack_size", label: "Pack size", placeholder: "Single, Pack of 2, Pack of 6" },
];

function variationTypeDetails(value: string) {
  return VARIATION_TYPES.find((type) => type.value === value)
    ?? { value, label: value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), placeholder: "Enter values separated by commas" };
}

function splitVariantValues(values: string): string[] {
  return [...new Set(values.split(/[\n,]/).map((value) => value.trim()).filter(Boolean))];
}

function variantValueKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function optionColorVariantKey(color: string, optionName: string, optionValue: string): string {
  return `${color.trim().toLowerCase()}|${optionName.trim().toLowerCase()}|${optionValue.trim().toLowerCase()}`;
}

export type { UploadState, ImageMediaItem, DescriptionImageItem, VideoMediaItem, VariantDraft, ProductFormDraft };
export {
  MAX_PRODUCT_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
  MAX_DOCUMENT_SIZE_BYTES,
  ACCEPTED_IMAGE_TYPES,
  LISTING_CURRENCIES,
  VARIATION_TYPES,
  variationTypeDetails,
  splitVariantValues,
  variantValueKey,
  optionColorVariantKey,
};
