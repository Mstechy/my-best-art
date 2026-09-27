/**
 * Seller listing entity types, plus the row mapper and derived listing health.
 *
 * Lifted unchanged out of SellerProducts.tsx so the page file holds behaviour
 * instead of declarations. Both the page and the health helper share these
 * shapes, so they live together rather than being duplicated per call site.
 */
import { findProductTypeConfig, getCategoryAttributes, getProductType, getRequiredFields } from "@/lib/categoryConfig";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductImage {
  id: string;
  image_url: string;
  is_primary: boolean;
  sort_order?: number;
  alt?: string | null;
}

interface ProductVariant {
  id: string;
  option_values: Record<string, string> | null;
  sku: string | null;
  price: number | null;
  stock_quantity: number;
  image_url: string | null;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  category_id: string | null;
  status: "draft" | "active" | "archived";
  is_approved: boolean;
  stock_quantity: number;
  sku: string | null;
  brand: string | null;
  weight: string | null;
  dimensions: string | null;
  material: string | null;
  color: string | null;
  condition: string;
  warranty: string | null;
  warranty_period: string | null;
  shipping_info: string | null;
  key_features: string[] | null;
  tags: string[] | null;
  ships_to: string[] | null;
  variants: Record<string, unknown> | null;
  show_sold_count: boolean | null;
  flash_deal_discount_percent: number | null;
  flash_deal_start_at: string | null;
  flash_deal_end_at: string | null;
  seo_slug: string | null;
  meta_description: string | null;
  low_stock_threshold: number | null;
  description_images: { url: string; alt: string | null; order: number }[] | null;
  created_at: string;
  product_images: ProductImage[];
}

// Raw row type from Supabase products table (snake_case fields)
interface ProductRow {
  id: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  category_id: string | null;
  status: "draft" | "active" | "archived";
  is_approved: boolean | null;
  stock_quantity: number;
  sku: string | null;
  brand: string | null;
  weight: string | null;
  dimensions: string | null;
  material: string | null;
  color: string | null;
  condition: string | null;
  warranty: string | null;
  warranty_period: string | null;
  shipping_info: string | null;
  key_features: string[] | null;
  tags: string[] | null;
  ships_to: string[] | null;
  variants: Record<string, unknown> | null;
  show_sold_count: boolean | null;
  flash_deal_discount_percent: number | null;
  flash_deal_start_at: string | null;
  flash_deal_end_at: string | null;
  seo_slug: string | null;
  meta_description: string | null;
  low_stock_threshold: number | null;
  description_images: { url: string; alt: string | null; order: number }[] | null;
  created_at: string;
  product_images: ProductImage[] | null;
}

type ListingHealthIssue = { message: string; tone: "warning" | "critical" };

function getListingHealth(product: Product, category?: Category): ListingHealthIssue[] {
  const issues: ListingHealthIssue[] = [];
  if (product.product_images.length === 0) issues.push({ message: "Add a main product image", tone: "critical" });
  else if (product.product_images.length < 3) issues.push({ message: "Add more product views", tone: "warning" });
  if (!product.description || product.description.trim().length < 80) issues.push({ message: "Add a fuller description (80+ characters)", tone: "warning" });
  // No key-feature check: the field is no longer collected in the form and the
  // description carries that content instead.
  if (product.stock_quantity <= 0) issues.push({ message: "Restock this listing", tone: "critical" });
  else if (product.stock_quantity <= (product.low_stock_threshold ?? 5)) issues.push({ message: "Low stock", tone: "warning" });
  if (product.status === "active" && !product.is_approved) issues.push({ message: "Waiting for approval", tone: "warning" });
  const savedProductType = getProductType(product.variants);
  const productType = findProductTypeConfig(category, savedProductType?.key);
  const attributes = getCategoryAttributes(product.variants);
  if (Object.keys(attributes).length < 3) issues.push({ message: "Add relevant specifications", tone: "warning" });
  const missingSpecifications = getRequiredFields(productType)
    .filter((key) => !attributes[key]?.trim())
    .map((key) => productType.fields.find((field) => field.key === key)?.label || key);
  if (missingSpecifications.length > 0) {
    issues.push({ message: `Missing required details: ${missingSpecifications.slice(0, 2).join(", ")}${missingSpecifications.length > 2 ? ` +${missingSpecifications.length - 2}` : ""}`, tone: "warning" });
  }
  if (["clothes", "shirt", "iphone", "apron", "nuckles"].includes(product.title.trim().toLowerCase())) issues.push({ message: "Use a specific searchable title", tone: "warning" });
  return issues;
}

/**
 * Maps a raw `products` row onto the `Product` shape the UI consumes, defaulting
 * the nullable columns and ordering images by sort_order.
 */
function normalizeProductRow(row: ProductRow): Product {
  const images = (row.product_images || []).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  return {
    ...row,
    product_images: images,
    is_approved: row.is_approved ?? false,
    brand: row.brand ?? null,
    weight: row.weight ?? null,
    dimensions: row.dimensions ?? null,
    material: row.material ?? null,
    color: row.color ?? null,
    condition: row.condition ?? "new",
    warranty: row.warranty ?? null,
    shipping_info: row.shipping_info ?? null,
    key_features: row.key_features ?? null,
    tags: row.tags ?? null,
    ships_to: row.ships_to ?? null,
    variants: row.variants ?? null,
  };
}

export type { Category, ProductImage, ProductVariant, Product, ProductRow, ListingHealthIssue };
export { getListingHealth, normalizeProductRow };
