import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Package, Pencil, Trash2, ImagePlus, Eye, EyeOff, Archive, Clock, CheckCircle2, X, Heart, ShoppingCart, GripVertical, Play, Upload, RotateCcw, Star, Globe, Minus } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, countryName } from "@/lib/countries";
import { findCategoryConfig, findProductTypeConfig, getCategoryAttributes, getProductType, getProductVideos, getProductTypesForCategory, getRequiredFields, mergeCategoryAttributes } from "@/lib/categoryConfig";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { uploadProductImagePair } from "@/lib/productImages";
import ProductImage from "@/components/product/ProductImage";
import ProductVideoPlayer from "@/components/product/ProductVideoPlayer";
import { generateSku } from "@/lib/sku";
import { createVisualHash } from "@/lib/visualHash";

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
  if (!product.key_features?.some((feature) => feature.trim())) issues.push({ message: "Add key features", tone: "warning" });
  else if (product.key_features.filter((feature) => feature.trim()).length < 3) issues.push({ message: "Add three key features", tone: "warning" });
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

export default function SellerProducts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Record<string, { views: number; saves: number; orders: number }>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [listingMinimized, setListingMinimized] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formTab, setFormTab] = useState("basic");

  // Form state — basic
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [categoryId, setCategoryId] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [sku, setSku] = useState(() => generateSku());
  const [imageItems, setImageItems] = useState<ImageMediaItem[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [videoItems, setVideoItems] = useState<VideoMediaItem[]>([]);
  const [removedVideoUrls, setRemovedVideoUrls] = useState<string[]>([]);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [showSoldCount, setShowSoldCount] = useState(true);
  const [flashDealEnabled, setFlashDealEnabled] = useState(false);
  const [flashDealDiscount, setFlashDealDiscount] = useState("");
  const [flashDealStart, setFlashDealStart] = useState("");
  const [flashDealEnd, setFlashDealEnd] = useState("");
  const [seoSlug, setSeoSlug] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [descriptionImageItems, setDescriptionImageItems] = useState<DescriptionImageItem[]>([]);
  const [removedDescriptionImageUrls, setRemovedDescriptionImageUrls] = useState<string[]>([]);
  const [draggedDescriptionImageId, setDraggedDescriptionImageId] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [compareAtError, setCompareAtError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [altWarning, setAltWarning] = useState(false);

  // Form state — specifications
  const [brand, setBrand] = useState("");
  const [weight, setWeight] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [material, setMaterial] = useState("");
  const [color, setColor] = useState("");
  const [condition, setCondition] = useState("new");
  const [warrantyPeriod, setWarrantyPeriod] = useState("none");
  const [shippingInfo, setShippingInfo] = useState("");
  const [keyFeatures, setKeyFeatures] = useState<string[]>([""]);
  const [tagsInput, setTagsInput] = useState("");
  const [shipsTo, setShipsTo] = useState<string[]>([]);
  const [categoryAttributes, setCategoryAttributes] = useState<Record<string, string>>({});
  const [productTypeKey, setProductTypeKey] = useState("");
  const [existingProductVideos, setExistingProductVideos] = useState<string[]>([]);
  const [variantRows, setVariantRows] = useState<VariantDraft[]>([]);
  const [variantColorValues, setVariantColorValues] = useState("");
  const [variantStorageValues, setVariantStorageValues] = useState("");
  const [variantPrimaryOption, setVariantPrimaryOption] = useState("storage");

  const [saving, setSaving] = useState(false);
  const [savedProductId, setSavedProductId] = useState<string | null>(null);
  const draftKey = user ? `markethub:product-listing-draft:${user.id}` : "";

  // Auto-generate slug from title until the seller edits it manually
  useEffect(() => {
    if (slugTouched) return;
    const slug = title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    setSeoSlug(slug);
  }, [title, slugTouched]);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setProducts((data as unknown as ProductRow[]).map(normalizeProductRow));
    }
    setLoading(false);

    // fetch per-product stats
    const ids = (data || []).map((p) => (p as unknown as ProductRow).id);
    if (ids.length) {
      const [viewsRes, savesRes, itemsRes] = await Promise.all([
        supabase.from("product_views").select("product_id").in("product_id", ids),
        supabase.from("wishlists").select("product_id").in("product_id", ids),
        supabase.from("order_items").select("product_id").in("product_id", ids),
      ]);
      const s: Record<string, { views: number; saves: number; orders: number }> = {};
      ids.forEach((id) => { s[id] = { views: 0, saves: 0, orders: 0 }; });
      (viewsRes.data || []).forEach((r: { product_id: string }) => { if (s[r.product_id]) s[r.product_id].views++; });
      (savesRes.data || []).forEach((r: { product_id: string }) => { if (s[r.product_id]) s[r.product_id].saves++; });
      (itemsRes.data || []).forEach((r: { product_id: string }) => { if (s[r.product_id]) s[r.product_id].orders++; });
      setStats(s);
    }
  }, [user]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    if (data) setCategories(data as Category[]);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    if (!dialogOpen || editingProduct || !draftKey) return;
    const draft: ProductFormDraft = { title, description, price, compareAtPrice, currency, categoryId, stockQuantity, sku, brand, weight, dimensions, material, color, condition, warrantyPeriod, shippingInfo, keyFeatures, tagsInput, shipsTo, categoryAttributes, productTypeKey, variantRows, variantColorValues, variantStorageValues, variantPrimaryOption, showSoldCount, formTab, seoSlug, metaDescription, lowStockThreshold };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [dialogOpen, editingProduct, draftKey, title, description, price, compareAtPrice, currency, categoryId, stockQuantity, sku, brand, weight, dimensions, material, color, condition, warrantyPeriod, shippingInfo, keyFeatures, tagsInput, shipsTo, categoryAttributes, productTypeKey, variantRows, variantColorValues, variantStorageValues, variantPrimaryOption, showSoldCount, formTab, seoSlug, metaDescription, lowStockThreshold]);

  // When a seller returns from another tab or route, reopen the unfinished
  // listing automatically. They should never need to press Add Product again
  // just to recover work already entered.
  useEffect(() => {
    if (!draftKey || dialogOpen || editingProduct) return;
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const draft = JSON.parse(saved) as ProductFormDraft;
      const hasContent = Boolean(draft.title || draft.description || draft.price || draft.categoryId || draft.productTypeKey);
      if (!hasContent) return;
      setTitle(draft.title || ""); setDescription(draft.description || ""); setPrice(draft.price || ""); setCompareAtPrice(draft.compareAtPrice || ""); setCurrency(draft.currency || "NGN"); setCategoryId(draft.categoryId || ""); setStockQuantity(draft.stockQuantity || ""); setSku(draft.sku || generateSku()); setBrand(draft.brand || ""); setWeight(draft.weight || ""); setDimensions(draft.dimensions || ""); setMaterial(draft.material || ""); setColor(draft.color || ""); setCondition(draft.condition || "new"); setWarrantyPeriod(draft.warrantyPeriod || "none"); setShippingInfo(draft.shippingInfo || ""); setKeyFeatures(draft.keyFeatures?.length ? draft.keyFeatures : [""]); setTagsInput(draft.tagsInput || ""); setShipsTo(draft.shipsTo || []); setCategoryAttributes(draft.categoryAttributes || {}); setProductTypeKey(draft.productTypeKey || ""); setVariantRows(draft.variantRows || []); setVariantColorValues(draft.variantColorValues || ""); setVariantStorageValues(draft.variantStorageValues || ""); setVariantPrimaryOption(draft.variantPrimaryOption || "storage"); setShowSoldCount(draft.showSoldCount ?? true); setFormTab(draft.formTab || "basic"); setSeoSlug(draft.seoSlug || ""); setMetaDescription(draft.metaDescription || ""); setLowStockThreshold(draft.lowStockThreshold || "5");
      setDialogOpen(true);
      toast({ title: "Unfinished listing reopened", description: "Continue exactly where you left off. Re-select files only if the browser was reloaded." });
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  const revokeLocalMediaUrls = () => {
    imageItems.forEach((item) => {
      if (item.file) URL.revokeObjectURL(item.url);
    });
    videoItems.forEach((item) => {
      if (item.file) URL.revokeObjectURL(item.url);
    });
    descriptionImageItems.forEach((item) => {
      if (item.file) URL.revokeObjectURL(item.url);
    });
  };

  const addImageFiles = (files: File[]) => {
    const remaining = MAX_PRODUCT_IMAGES - imageItems.length;
    const imageFiles = files.filter((file) => ACCEPTED_IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_SIZE_BYTES).slice(0, Math.max(0, remaining));
    if (imageFiles.length === 0) {
      toast({ title: "Images not added", description: `Use JPG, PNG, or WebP files up to 10 MB. A product can have up to ${MAX_PRODUCT_IMAGES} images.`, variant: "destructive" });
      return;
    }
    if (imageFiles.length < files.length) toast({ title: "Some images skipped", description: `Use JPG, PNG, or WebP files up to 10 MB; maximum ${MAX_PRODUCT_IMAGES} images per product.` });
    setImageItems((prev) => {
      const next = [
        ...prev,
        ...imageFiles.map((file, index): ImageMediaItem => ({
          id: `local-image-${Date.now()}-${index}-${file.name}`,
          file,
          url: URL.createObjectURL(file),
          name: file.name,
          isPrimary: prev.length === 0 && index === 0,
          alt: "",
          status: "local",
          progress: 0,
        })),
      ];
      return next.some((item) => item.isPrimary) ? next : next.map((item, index) => ({ ...item, isPrimary: index === 0 }));
    });
  };

  const addVideoFiles = (files: File[]) => {
    const accepted = files.filter((file) => (/video\/(mp4|quicktime|webm)/i.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name)) && file.size <= MAX_VIDEO_SIZE_BYTES).slice(0, Math.max(0, 3 - videoItems.length));
    if (accepted.length === 0) {
      toast({ title: "Videos not added", description: "Use MP4, MOV, or WebM files up to 100 MB. A product can have up to 3 videos.", variant: "destructive" });
      return;
    }
    if (accepted.length < files.length) toast({ title: "Some videos skipped", description: "Videos must be MP4, MOV, or WebM and no larger than 100 MB." });
    setVideoItems((prev) => [
      ...prev,
      ...accepted.map((file, index): VideoMediaItem => ({
        id: `local-video-${Date.now()}-${index}-${file.name}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        status: "local",
        progress: 0,
      })),
    ].slice(0, 3));
  };

  const removeImageItem = (id: string) => {
    setImageItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.file) URL.revokeObjectURL(removed.url);
      if (removed?.dbId) setRemovedImageIds((ids) => [...ids, removed.dbId!]);
      const next = prev.filter((item) => item.id !== id);
      return next.some((item) => item.isPrimary) ? next : next.map((item, index) => ({ ...item, isPrimary: index === 0 }));
    });
  };

  const removeVideoItem = (id: string) => {
    setVideoItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.file) URL.revokeObjectURL(removed.url);
      else if (removed) setRemovedVideoUrls((urls) => [...urls, removed.url]);
      return prev.filter((item) => item.id !== id);
    });
  };

  const setPrimaryImage = (id: string) => {
    setImageItems((prev) => prev.map((item) => ({ ...item, isPrimary: item.id === id })));
  };

  const moveImageItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setImageItems((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === fromId);
      const toIndex = prev.findIndex((item) => item.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const updateImageUploadState = (id: string, patch: Partial<ImageMediaItem>) => {
    setImageItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const updateVideoUploadState = (id: string, patch: Partial<VideoMediaItem>) => {
    setVideoItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const addDescriptionImageFiles = (files: File[]) => {
    const remaining = 20 - descriptionImageItems.length;
    const imageFiles = files.filter((file) => ACCEPTED_IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_SIZE_BYTES).slice(0, Math.max(0, remaining));
    if (imageFiles.length === 0) {
      toast({ title: "Description photos not added", description: "Use JPG, PNG, or WebP files up to 10 MB. A product can have up to 20 description photos.", variant: "destructive" });
      return;
    }
    if (imageFiles.length < files.length) toast({ title: "Some photos skipped", description: "Use JPG, PNG, or WebP files up to 10 MB; maximum 20 description photos." });
    setDescriptionImageItems((prev) => [
      ...prev,
      ...imageFiles.map((file, index): DescriptionImageItem => ({
        id: `local-desc-image-${Date.now()}-${index}-${file.name}`,
        file,
        url: URL.createObjectURL(file),
        name: file.name,
        alt: "",
        status: "local",
        progress: 0,
      })),
    ].slice(0, 20));
  };

  const removeDescriptionImageItem = (id: string) => {
    setDescriptionImageItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.file) URL.revokeObjectURL(removed.url);
      else if (removed) setRemovedDescriptionImageUrls((urls) => [...urls, removed.url]);
      return prev.filter((item) => item.id !== id);
    });
  };

  const moveDescriptionImageItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setDescriptionImageItems((prev) => {
      const fromIndex = prev.findIndex((item) => item.id === fromId);
      const toIndex = prev.findIndex((item) => item.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const updateDescriptionImageState = (id: string, patch: Partial<DescriptionImageItem>) => {
    setDescriptionImageItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const resetForm = () => {
    revokeLocalMediaUrls();
    setTitle(""); setDescription(""); setPrice(""); setCompareAtPrice(""); setCurrency("NGN");
    setCategoryId(""); setStockQuantity(""); setSku(generateSku()); setImageItems([]); setVideoItems([]);
    setRemovedImageIds([]); setRemovedVideoUrls([]); setDraggedImageId(null); setSavedProductId(null);
    setDocFile(null); setShowSoldCount(true);
    setBrand(""); setWeight(""); setDimensions(""); setMaterial("");
    setColor(""); setCondition("new"); setWarrantyPeriod("none"); setShippingInfo("");
    setKeyFeatures([""]); setTagsInput(""); setShipsTo([]); setCategoryAttributes({});
    setProductTypeKey(""); setExistingProductVideos([]); setVariantRows([]); setVariantColorValues(""); setVariantStorageValues(""); setVariantPrimaryOption("storage");
    setSlugTouched(false); setSeoSlug(""); setMetaDescription(""); setLowStockThreshold("5");
    setDescriptionImageItems([]); setRemovedDescriptionImageUrls([]); setDraggedDescriptionImageId(null);
    setFlashDealEnabled(false); setFlashDealDiscount(""); setFlashDealStart(""); setFlashDealEnd("");
    setEditingProduct(null); setFormTab("basic");
  };

  const openNewProduct = () => {
    // A minimized form stays fully mounted in this page state, including files.
    // Reopening it must not rebuild the form from localStorage.
    if (listingMinimized) {
      setListingMinimized(false);
      setDialogOpen(true);
      return;
    }
    resetForm();
    const saved = draftKey ? localStorage.getItem(draftKey) : null;
    if (saved) {
      try {
        const draft = JSON.parse(saved) as ProductFormDraft;
        setTitle(draft.title || ""); setDescription(draft.description || ""); setPrice(draft.price || ""); setCompareAtPrice(draft.compareAtPrice || ""); setCurrency(draft.currency || "NGN"); setCategoryId(draft.categoryId || ""); setStockQuantity(draft.stockQuantity || ""); setSku(draft.sku || generateSku()); setBrand(draft.brand || ""); setWeight(draft.weight || ""); setDimensions(draft.dimensions || ""); setMaterial(draft.material || ""); setColor(draft.color || ""); setCondition(draft.condition || "new"); setWarrantyPeriod(draft.warrantyPeriod || "none"); setShippingInfo(draft.shippingInfo || ""); setKeyFeatures(draft.keyFeatures?.length ? draft.keyFeatures : [""]); setTagsInput(draft.tagsInput || ""); setShipsTo(draft.shipsTo || []); setCategoryAttributes(draft.categoryAttributes || {}); setProductTypeKey(draft.productTypeKey || ""); setVariantRows(draft.variantRows || []); setVariantColorValues(draft.variantColorValues || ""); setVariantStorageValues(draft.variantStorageValues || ""); setVariantPrimaryOption(draft.variantPrimaryOption || "storage"); setShowSoldCount(draft.showSoldCount ?? true); setFormTab(draft.formTab || "basic"); setSeoSlug(draft.seoSlug || ""); setMetaDescription(draft.metaDescription || ""); setLowStockThreshold(draft.lowStockThreshold || "5");
        toast({ title: "Unfinished listing restored", description: "Your text and settings were recovered. Please reselect any files before submitting." });
      } catch { localStorage.removeItem(draftKey); }
    }
    setDialogOpen(true);
  };

  const minimizeNewListing = () => {
    setDialogOpen(false);
    setListingMinimized(true);
    toast({ title: "Listing minimized", description: "Your form and selected files are ready to continue on this page." });
  };

  const handleListingDialogChange = (open: boolean) => {
    if (open) {
      setDialogOpen(true);
      return;
    }
    if (editingProduct) {
      setDialogOpen(false);
      setListingMinimized(false);
      resetForm();
      return;
    }
    minimizeNewListing();
  };

  const discardNewDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    resetForm();
    setDialogOpen(false);
    setListingMinimized(false);
    toast({ title: "Unfinished listing discarded" });
  };

  const openEdit = async (product: Product) => {
    setListingMinimized(false);
    setEditingProduct(product);
    setCurrency(product.currency || "NGN");
    setTitle(product.title);
    setDescription(product.description || "");
    setPrice(String(product.price));
    setCompareAtPrice(product.compare_at_price ? String(product.compare_at_price) : "");
    setCategoryId(product.category_id || "");
    setStockQuantity(String(product.stock_quantity));
    setSku(product.sku || "");
    setBrand(product.brand || "");
    setWeight(product.weight || "");
    setDimensions(product.dimensions || "");
    setMaterial(product.material || "");
    setColor(product.color || "");
    setCondition(product.condition || "new");
    setWarrantyPeriod(product.warranty_period || "none");
    setShippingInfo(product.shipping_info || "");
    setSeoSlug(product.seo_slug || "");
    setMetaDescription(product.meta_description || "");
    setLowStockThreshold(String(product.low_stock_threshold ?? 5));
    setSlugTouched(Boolean(product.seo_slug));
    setKeyFeatures(product.key_features?.length ? product.key_features : [""]);
    setTagsInput(product.tags?.join(", ") || "");
    setShipsTo(product.ships_to || []);
    setShowSoldCount(product.show_sold_count ?? true);
    setProductTypeKey(getProductType(product.variants)?.key || "");
    const savedVideos = getProductVideos(product.variants);
    setExistingProductVideos(savedVideos);
    setFlashDealEnabled(!!product.flash_deal_discount_percent);
    setFlashDealDiscount((product.flash_deal_discount_percent ?? 0).toString());
    setFlashDealStart((product.flash_deal_start_at || "").slice(0, 16));
    setFlashDealEnd((product.flash_deal_end_at || "").slice(0, 16));
    setImageItems(
      [...(product.product_images || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((image, index) => ({
          id: `existing-image-${image.id}`,
          dbId: image.id,
          url: image.image_url,
          name: `Image ${index + 1}`,
          isPrimary: image.is_primary,
          alt: image.alt || "",
          status: "uploaded" as const,
          progress: 100,
        }))
    );
    setVideoItems(savedVideos.map((url, index) => ({
      id: `existing-video-${index}-${url}`,
      url,
      name: `Product video ${index + 1}`,
      status: "uploaded" as const,
      progress: 100,
    })));
    setDescriptionImageItems(
      (product.description_images || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((image, index) => ({
          id: `existing-desc-image-${index}-${image.url}`,
          url: image.url,
          name: `Description photo ${index + 1}`,
          alt: image.alt || "",
          status: "uploaded" as const,
          progress: 100,
        }))
    );
    setRemovedImageIds([]);
    setRemovedVideoUrls([]);
    setRemovedDescriptionImageUrls([]);
    setSavedProductId(product.id);
    setCategoryAttributes({
      brand: product.brand || "",
      weight: product.weight || "",
      dimensions: product.dimensions || "",
      material: product.material || "",
      color: product.color || "",
      condition: product.condition || "",
      warranty: product.warranty || "",
      ...getCategoryAttributes(product.variants),
    });
    setDocFile(null);
    const { data: variants } = await supabase.from("product_variants").select("id, option_values, sku, price, stock_quantity, image_url").eq("product_id", product.id).order("sort_order");
    const loadedVariantRows = (variants ?? []).map((variant: ProductVariant) => {
      const imageUrl = variant.image_url || "";
      const sourceImage = (product.product_images || []).find((image) => image.image_url === imageUrl);
      const extraOption = Object.entries(variant.option_values || {}).find(([key, value]) => key !== "size" && key !== "color" && Boolean(value));
      return { key: variant.id, size: variant.option_values?.size || "", color: variant.option_values?.color || "", optionName: extraOption?.[0] || "", optionValue: extraOption?.[1] || "", sku: variant.sku || "", price: variant.price == null ? "" : String(variant.price), stock: String(variant.stock_quantity), imageUrl, imageSourceId: sourceImage ? `existing-image-${sourceImage.id}` : undefined };
    });
    setVariantRows(loadedVariantRows);
    setVariantColorValues([...new Set(loadedVariantRows.map((row) => row.color).filter(Boolean))].join(", "));
    const primaryOption = loadedVariantRows.find((row) => row.optionName.trim())?.optionName.toLowerCase() || "storage";
    setVariantPrimaryOption(primaryOption);
    setVariantStorageValues([...new Set(loadedVariantRows.filter((row) => row.optionName.toLowerCase() === primaryOption).map((row) => row.optionValue).filter(Boolean))].join(", "));
    setFormTab("basic");
    setDialogOpen(true);
  };

  const generateStorageColorMatrix = () => {
    const colors = splitVariantValues(variantColorValues);
    const primaryValues = splitVariantValues(variantStorageValues);
    const primaryOptionDetails = variationTypeDetails(variantPrimaryOption);
    if (colors.length === 0 && primaryValues.length === 0) {
      toast({ title: "Add option values", description: `Enter at least one ${primaryOptionDetails.label.toLowerCase()} or colour before generating SKU rows.`, variant: "destructive" });
      return;
    }

    const colorValues = colors.length > 0 ? colors : [""];
    const optionValues = primaryValues.length > 0 ? primaryValues : [""];
    const combinationCount = colorValues.length * optionValues.length;
    if (combinationCount > 100) {
      toast({ title: "Too many SKU combinations", description: "Use up to 100 colour and option combinations in one listing.", variant: "destructive" });
      return;
    }

    const existingRows = new Map(variantRows.map((row) => [optionColorVariantKey(row.color, row.optionName, row.optionValue), row]));
    const baseSku = sku.trim() || generateSku();
    const generatedAt = Date.now();
    const nextRows = colorValues.flatMap((variantColor) => optionValues.map((optionValue, index) => {
      const existing = existingRows.get(optionColorVariantKey(variantColor, variantPrimaryOption, optionValue));
      const suffix = [variantValueKey(variantColor), variantValueKey(optionValue)].filter(Boolean).join("-").toUpperCase();
      return existing ?? {
        key: `matrix-${generatedAt}-${index}-${variantValueKey(variantColor)}-${variantValueKey(variantStorage)}`,
        size: "",
        color: variantColor,
        optionName: optionValue ? variantPrimaryOption : "",
        optionValue,
        sku: suffix ? `${baseSku}-${suffix}` : `${baseSku}-${index + 1}`,
        // A variant must carry its own price. Leaving this blank makes the
        // seller deliberately price the exact Storage/Colour SKU below,
        // instead of accidentally selling every size at the base price.
        price: "",
        stock: "0",
        imageUrl: "",
      };
    }));

    setVariantRows(nextRows);
    toast({ title: "SKU matrix ready", description: `${nextRows.length} SKU row${nextRows.length === 1 ? "" : "s"} generated. Enter the price and stock for each exact option before publishing.` });
  };

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    if (!categoryId) {
      toast({ title: "Choose a category", description: "Select a category before submitting this product.", variant: "destructive" });
      return;
    }
    if (!productTypeKey) {
      toast({ title: "Choose a product type", description: "Select a product type so buyers see the right details.", variant: "destructive" });
      return;
    }
    if (!imageItems.length) {
      toast({ title: "Add a product image", description: "Listings need at least one clear product image before they can be submitted.", variant: "destructive" });
      setFormTab("media");
      return;
    }
    const hasVariantRows = variantRows.length > 0;
    const invalidVariant = variantRows.some(row => (
      (!row.size.trim() && !row.color.trim() && !(row.optionValue || "").trim()) ||
      Boolean((row.optionName || "").trim()) !== Boolean((row.optionValue || "").trim()) ||
      !Number.isFinite(Number(row.price)) || Number(row.price) <= 0 ||
      !Number.isInteger(Number(row.stock)) || Number(row.stock) < 0
    ));
    const variantKeys = variantRows.map(row => `${row.size.trim().toLowerCase()}|${row.color.trim().toLowerCase()}|${(row.optionName || "").trim().toLowerCase()}|${(row.optionValue || "").trim().toLowerCase()}`);
    if (invalidVariant || new Set(variantKeys).size !== variantKeys.length) {
      toast({ title: "Complete SKU prices and stock", description: "Every SKU needs an option, its own price above zero, a whole stock quantity, and a unique combination.", variant: "destructive" }); setFormTab("variants"); return;
    }

    // The parent listing uses the lowest purchasable SKU price and total SKU
    // stock. Buyers still pay and reserve stock from their selected SKU.
    const numericPrice = hasVariantRows
      ? Math.min(...variantRows.map((row) => Number(row.price)))
      : Number(price);
    const numericCompareAtPrice = compareAtPrice ? Number(compareAtPrice) : null;
    const numericStock = hasVariantRows
      ? variantRows.reduce((total, row) => total + Number(row.stock), 0)
      : Number(stockQuantity || 0);
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      toast({ title: "Enter a valid price", description: "For a single-price product, enter the price in Basic info. For options, enter a price on every SKU row.", variant: "destructive" });
      setFormTab("basic");
      return;
    }
    if (numericCompareAtPrice !== null && (!Number.isFinite(numericCompareAtPrice) || numericCompareAtPrice <= numericPrice)) {
      setCompareAtError("Compare-at price must be higher than the sale price.");
      toast({ title: "Check compare-at price", description: "Compare-at price must be higher than the sale price.", variant: "destructive" });
      setFormTab("basic");
      return;
    }
    if (!Number.isInteger(numericStock) || numericStock < 0) {
      toast({ title: "Check stock quantity", description: "Stock must be a whole number of zero or more.", variant: "destructive" });
      setFormTab("basic");
      return;
    }
    if (description.trim().length < 80) {
      setDescriptionError("Description must be at least 80 characters.");
      toast({ title: "Add a product description", description: "Write at least 80 characters so buyers know exactly what they are getting.", variant: "destructive" });
      setFormTab("basic");
      return;
    }
    // Alt-text warning (non-blocking, per PRD)
    const missingAlt = [...imageItems, ...descriptionImageItems].some(item => !item.alt.trim());
    setAltWarning(missingAlt);
    const cleanFeatures = keyFeatures.map(f => f.trim()).filter(Boolean).slice(0, 5);
    if (cleanFeatures.length < 3) {
      toast({ title: "Add key features", description: "Add at least three buyer-facing highlights, such as condition, compatibility, or what is included.", variant: "destructive" });
      setFormTab("media");
      return;
    }
    const cleanTags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const cleanCategoryAttributes = Object.fromEntries(
      Object.entries(categoryAttributes)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value)
    );
    const warrantyText = warrantyPeriod === "none" ? null :
      warrantyPeriod === "lifetime" ? "Lifetime Warranty" :
      warrantyPeriod;
    const selectedCategory = categories.find(c => c.id === categoryId);
    const selectedConfig = findCategoryConfig(selectedCategory);
    const selectedProductType = findProductTypeConfig(selectedCategory, productTypeKey);
    const minimumSpecificationCount = 3;
    if (Object.keys(cleanCategoryAttributes).length < minimumSpecificationCount) {
      toast({ title: "Add product specifications", description: `Add at least ${minimumSpecificationCount} relevant specifications so buyers can compare this listing.`, variant: "destructive" });
      setFormTab("specs");
      return;
    }
    const missingRequiredFields = getRequiredFields(selectedProductType)
      .filter(key => !cleanCategoryAttributes[key]?.trim())
      .map(key => selectedProductType.fields.find(field => field.key === key)?.label || key);
    if (missingRequiredFields.length > 0) {
      toast({
        title: "Complete the required specifications",
        description: `Add: ${missingRequiredFields.join(", ")}.`,
        variant: "destructive",
      });
      setFormTab("specs");
      return;
    }

    setSaving(true);

    const attr = (key: string) => cleanCategoryAttributes[key] || "";

    const flashDealFields = flashDealEnabled && flashDealDiscount && flashDealStart && flashDealEnd
      ? {
          flash_deal_discount_percent: Math.round(Number(flashDealDiscount)),
          flash_deal_start_at: new Date(flashDealStart).toISOString(),
          flash_deal_end_at: new Date(flashDealEnd).toISOString(),
        }
      : {
          flash_deal_discount_percent: null,
          flash_deal_start_at: null,
          flash_deal_end_at: null,
        };

    const productData: Record<string, unknown> = {
      seller_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      price: numericPrice,
      compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : null,
      currency,
      category_id: categoryId || null,
      stock_quantity: numericStock,
      seo_slug: seoSlug.trim() || null,
      meta_description: metaDescription.trim() || null,
      low_stock_threshold: parseInt(lowStockThreshold) || 5,
      sku: sku.trim() || null,
      brand: (attr("brand") || brand).trim() || null,
      weight: (attr("weight") || weight).trim() || null,
      dimensions: (attr("dimensions") || dimensions).trim() || null,
      material: (attr("material") || material).trim() || null,
      color: (attr("color") || color).trim() || null,
      condition: (attr("condition") || condition).toLowerCase(),
      warranty: attr("warranty") || warrantyText,
      warranty_period: warrantyPeriod === "none" ? null : warrantyPeriod,
      shipping_info: shippingInfo.trim() || null,
      key_features: cleanFeatures,
      tags: cleanTags.length > 0 ? cleanTags : null,
      ships_to: shipsTo,
      show_sold_count: showSoldCount,
      ...flashDealFields,
      variants: { ...mergeCategoryAttributes(editingProduct?.variants, {
        categoryGroup: selectedConfig.title,
        ...cleanCategoryAttributes,
      }, { key: selectedProductType.key, label: selectedProductType.label }, existingProductVideos),
        sizes: [...new Set(variantRows.map(row => row.size.trim()).filter(Boolean))],
        colors: [...new Set(variantRows.map(row => row.color.trim()).filter(Boolean))],
      },
    };

    let productId = editingProduct?.id || savedProductId;

    if (productId) {
      const { error } = await supabase.from("products").update(productData as never).eq("id", productId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("products").insert({ ...productData, status: "active" } as never).select("id").single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      productId = (data as { id: string }).id;
      setSavedProductId((data as { id: string }).id);
    }

    let mediaHadError = false;
    // Gallery images are uploaded first. This lets a colour/SKU reuse a gallery
    // photo without making the seller upload the same file twice.
    const galleryImageUrls = new Map(imageItems.filter((item) => !item.file).map((item) => [item.id, item.url]));

    if (removedImageIds.length > 0) {
      const { error } = await supabase.from("product_images").delete().in("id", removedImageIds);
      if (error) mediaHadError = true;
    }

    if (productId) {
      for (let i = 0; i < imageItems.length; i++) {
        const item = imageItems[i];
        if (item.dbId) {
          const { error } = await supabase.from("product_images").update({
            sort_order: i,
            is_primary: item.isPrimary,
            alt: item.alt.trim() || null,
          } as never).eq("id", item.dbId);
          if (error) {
            mediaHadError = true;
            updateImageUploadState(item.id, { status: "error", error: error.message });
          }
          continue;
        }
        if (!item.file) continue;
        try {
          updateImageUploadState(item.id, { status: "uploading", progress: 20, error: undefined });
          const visualHash = await createVisualHash(item.file);
          const { originalUrl } = await uploadProductImagePair(item.file, `${user.id}/${productId}`);
          updateImageUploadState(item.id, { progress: 80 });
          const { data: inserted, error: insertError } = await supabase.from("product_images").insert({
            product_id: productId,
            image_url: originalUrl,
            is_primary: item.isPrimary,
            sort_order: i,
            alt: item.alt.trim() || null,
            visual_hash: visualHash.hash,
            visual_hash_buckets: visualHash.buckets,
          } as never).select("id").single();
          if (insertError) throw insertError;
          galleryImageUrls.set(item.id, originalUrl);
          updateImageUploadState(item.id, { dbId: (inserted as { id: string }).id, file: undefined, url: originalUrl, status: "uploaded", progress: 100 });
        } catch (error) {
          mediaHadError = true;
          const message = error instanceof Error ? error.message : "Upload failed";
          console.error("[SellerProducts] image upload error", error);
          updateImageUploadState(item.id, {
            status: "error",
            progress: 0,
            error: message,
          });
          toast({
            title: "Image upload failed",
            description: message,
            variant: "destructive",
          });
        }
      }
    }

    if (productId) {
      const unavailableSource = variantRows.find((row) => row.imageSourceId && !galleryImageUrls.get(row.imageSourceId));
      if (unavailableSource) {
        toast({ title: "Variant image unavailable", description: "The selected gallery image could not be uploaded. Please try again.", variant: "destructive" });
        setSaving(false);
        return;
      }
      const variantRowsWithImages: VariantDraft[] = [];
      for (const row of variantRows) {
        let imageUrl = row.imageSourceId ? (galleryImageUrls.get(row.imageSourceId) || "") : row.imageUrl.trim();
        if (row.imageFile) {
          try {
            const ext = row.imageFile.name.split(".").pop();
            const filePath = `${user.id}/${productId}/variant_${row.key}_${Date.now()}.${ext}`;
            const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, row.imageFile, { contentType: row.imageFile.type || "image/jpeg", cacheControl: "3600" });
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
            imageUrl = urlData.publicUrl;
          } catch (error) {
            const message = error instanceof Error ? error.message : "Variant image upload failed";
            toast({ title: "Variant image upload failed", description: message, variant: "destructive" });
            setSaving(false);
            return;
          }
        }
        variantRowsWithImages.push({ ...row, imageUrl });
      }
      const { error: removeVariantsError } = await supabase.from("product_variants").delete().eq("product_id", productId);
      const { error: addVariantsError } = variantRows.length ? await supabase.from("product_variants").insert(variantRowsWithImages.map((row, sort_order) => ({ product_id: productId, option_values: { ...(row.size.trim() ? { size: row.size.trim() } : {}), ...(row.color.trim() ? { color: row.color.trim() } : {}), ...((row.optionName || "").trim() && (row.optionValue || "").trim() ? { [(row.optionName || "").trim().toLowerCase().replace(/\s+/g, "_")]: (row.optionValue || "").trim() } : {}) }, sku: row.sku.trim() || null, price: row.price ? Number(row.price) : null, stock_quantity: Number(row.stock), image_url: row.imageUrl || null, sort_order }))) : { error: null };
      if (removeVariantsError || addVariantsError) { toast({ title: "Could not save variants", description: removeVariantsError?.message || addVariantsError?.message, variant: "destructive" }); setSaving(false); return; }
    }

    // Upload description photos and save as JSONB in products.description_images
    if (productId && (descriptionImageItems.length > 0 || removedDescriptionImageUrls.length > 0)) {
      const finalDescriptionImages: { url: string; alt: string | null; order: number }[] = [];
      for (let i = 0; i < descriptionImageItems.length; i++) {
        const item = descriptionImageItems[i];
        if (!item.url) {
          continue;
        }
        if (!item.file) {
          if (!removedDescriptionImageUrls.includes(item.url)) {
            finalDescriptionImages.push({ url: item.url, alt: item.alt.trim() || null, order: i });
          }
          continue;
        }
        try {
          updateDescriptionImageState(item.id, { status: "uploading", progress: 20, error: undefined });
          const ext = item.file.name.split(".").pop();
          const filePath = `${user.id}/${productId}/desc_${Date.now()}_${i}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, item.file, {
            contentType: item.file.type || "image/jpeg",
            cacheControl: "3600",
          });
          if (uploadError) throw uploadError;
          updateDescriptionImageState(item.id, { progress: 85 });
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
          finalDescriptionImages.push({ url: urlData.publicUrl, alt: item.alt.trim() || null, order: i });
          updateDescriptionImageState(item.id, { file: undefined, url: urlData.publicUrl, status: "uploaded", progress: 100 });
        } catch (error) {
          mediaHadError = true;
          const message = error instanceof Error ? error.message : "Upload failed";
          updateDescriptionImageState(item.id, { status: "error", progress: 0, error: message });
          toast({ title: "Description photo upload failed", description: message, variant: "destructive" });
        }
      }
      const { error: descUpdateError } = await supabase
        .from("products")
        .update({ description_images: finalDescriptionImages } as never)
        .eq("id", productId);
      if (descUpdateError) {
        console.error("[SellerProducts] description images update failed", descUpdateError);
        mediaHadError = true;
      }
    }

    // Upload optional PDF document
    if (docFile && productId) {
      try {
        const ext = docFile.name.split(".").pop();
        const path = `${user.id}/${productId}/doc_${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, docFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        await supabase.from("product_documents").insert({
          product_id: productId,
          url: urlData.publicUrl,
          label: docFile.name,
        });
      } catch (error) {
        mediaHadError = true;
        const message = error instanceof Error ? error.message : "Document upload failed";
        toast({
          title: "Document upload failed",
          description: message,
          variant: "destructive",
        });
      }
    }

    // Upload optional product videos and save URLs in variants JSON.
    if (productId && (videoItems.length > 0 || removedVideoUrls.length > 0 || existingProductVideos.length > 0)) {
      const finalVideos: string[] = [];
      for (let i = 0; i < videoItems.slice(0, 3).length; i++) {
        const item = videoItems[i];
        if (!item.file) {
          if (!removedVideoUrls.includes(item.url)) finalVideos.push(item.url);
          continue;
        }
        try {
          updateVideoUploadState(item.id, { status: "uploading", progress: 20, error: undefined });
          const ext = item.file.name.split(".").pop();
          const filePath = `${user.id}/${productId}/video_${Date.now()}_${i}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("product-images").upload(filePath, item.file, {
            contentType: item.file.type || "video/mp4",
            cacheControl: "3600",
          });
          if (uploadError) throw uploadError;
          updateVideoUploadState(item.id, { progress: 85 });
          const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(filePath);
          finalVideos.push(urlData.publicUrl);
          updateVideoUploadState(item.id, { file: undefined, url: urlData.publicUrl, status: "uploaded", progress: 100 });
        } catch (error) {
          mediaHadError = true;
          const message = error instanceof Error ? error.message : "Upload failed";
          updateVideoUploadState(item.id, {
            status: "error",
            progress: 0,
            error: message,
          });
          toast({
            title: "Video upload failed",
            description: message,
            variant: "destructive",
          });
        }
      }

      const mergedVariants = mergeCategoryAttributes(
        productData.variants as Record<string, unknown>,
        cleanCategoryAttributes,
        { key: selectedProductType.key, label: selectedProductType.label },
        finalVideos
      );
      const { error: videoUpdateError } = await supabase
        .from("products")
        .update({ variants: mergedVariants })
        .eq("id", productId);

      if (videoUpdateError) {
        console.error("[SellerProducts] video metadata update failed", videoUpdateError);
        mediaHadError = true;
      }

      setExistingProductVideos(finalVideos);
    }

    if (mediaHadError) {
      setSaving(false);
      setFormTab("media");
      toast({
        title: "Some media did not upload",
        description: "The product details were saved. Review failed media and retry.",
        variant: "destructive",
      });
      fetchProducts();
      return;
    }

    toast({
      title: editingProduct ? "Product updated" : "Product submitted for approval",
      description: editingProduct ? undefined : "Your product will be visible on the marketplace once approved by admin.",
    });
    if (draftKey) localStorage.removeItem(draftKey);
    resetForm();
    setDialogOpen(false);
    setListingMinimized(false);
    setSaving(false);
    fetchProducts();
  };

  const toggleStatus = async (product: Product) => {
    const newStatus = product.status === "active" ? "draft" : "active";
    await supabase.from("products").update({ status: newStatus }).eq("id", product.id);
    fetchProducts();
  };

  const archiveProduct = async (id: string) => {
    await supabase.from("products").update({ status: "archived" }).eq("id", id);
    fetchProducts();
  };

  const updateSelectedProductStatus = async (status: "draft" | "archived") => {
    if (selectedProductIds.length === 0) return;
    setBulkSaving(true);
    const { error } = await supabase.from("products").update({ status }).in("id", selectedProductIds);
    setBulkSaving(false);
    if (error) {
      toast({ title: "Could not update selected products", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `${selectedProductIds.length} product${selectedProductIds.length === 1 ? "" : "s"} ${status === "archived" ? "archived" : "moved to drafts"}` });
    setSelectedProductIds([]);
    fetchProducts();
  };

  const applyBulkPriceAndStock = async () => {
    if (selectedProductIds.length === 0) return;
    const updates: { price?: number; stock_quantity?: number } = {};
    if (bulkPrice.trim()) {
      const value = Number(bulkPrice);
      if (!Number.isFinite(value) || value <= 0) {
        toast({ title: "Check the price", description: "Enter a price greater than zero, or leave it blank.", variant: "destructive" });
        return;
      }
      updates.price = value;
    }
    if (bulkStock.trim()) {
      const value = Number(bulkStock);
      if (!Number.isInteger(value) || value < 0) {
        toast({ title: "Check the stock", description: "Enter a whole number of zero or more, or leave it blank.", variant: "destructive" });
        return;
      }
      updates.stock_quantity = value;
    }
    if (Object.keys(updates).length === 0) {
      toast({ title: "Nothing to update", description: "Enter a base price or stock quantity first.", variant: "destructive" });
      return;
    }

    setBulkSaving(true);
    const { error } = await supabase.from("products").update(updates).in("id", selectedProductIds);
    setBulkSaving(false);
    if (error) {
      toast({ title: "Could not update selected products", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Selected listings updated", description: `${selectedProductIds.length} base listing${selectedProductIds.length === 1 ? "" : "s"} updated.` });
    setBulkEditOpen(false);
    setBulkPrice("");
    setBulkStock("");
    setSelectedProductIds([]);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    await supabase.from("products").delete().eq("id", id);
    toast({ title: "Product deleted" });
    fetchProducts();
  };

  const addFeature = () => { if (keyFeatures.length < 5) setKeyFeatures([...keyFeatures, ""]); };
  const removeFeature = (index: number) => setKeyFeatures(keyFeatures.filter((_, i) => i !== index));
  const updateFeature = (index: number, value: string) => {
    const updated = [...keyFeatures];
    updated[index] = value;
    setKeyFeatures(updated);
  };

  const filtered = products.filter((product) => {
    const category = categories.find((item) => item.id === product.category_id);
    return product.title.toLowerCase().includes(search.toLowerCase()) &&
      (!needsAttentionOnly || getListingHealth(product, category).length > 0);
  });

  const selectedCategory = categories.find(c => c.id === categoryId) || null;
  const selectedCategoryConfig = findCategoryConfig(selectedCategory);
  const selectableProductTypes = getProductTypesForCategory(selectedCategory);
  const selectedProductTypeConfig = findProductTypeConfig(selectedCategory, productTypeKey);
  const requiredSpecificationKeys = useMemo(
    () => new Set(getRequiredFields(selectedProductTypeConfig)),
    [selectedProductTypeConfig],
  );
  const isPhoneListing = selectedProductTypeConfig.key === "mobile-phones" || selectedProductTypeConfig.key === "phones";
  const primaryVariationDetails = variationTypeDetails(variantPrimaryOption);
  const hasVariantRows = variantRows.length > 0;
  const showLegacySizeColumn = variantRows.some((row) => Boolean(row.size.trim()));
  const showColourColumn = variantRows.some((row) => Boolean(row.color.trim())) || Boolean(variantColorValues.trim());
  const variantRowsWithPrices = variantRows.filter((row) => Number.isFinite(Number(row.price)) && Number(row.price) > 0);
  const lowestVariantPrice = variantRowsWithPrices.length > 0 ? Math.min(...variantRowsWithPrices.map((row) => Number(row.price))) : null;
  const totalVariantStock = variantRows.reduce((total, row) => total + (Number.isInteger(Number(row.stock)) && Number(row.stock) > 0 ? Number(row.stock) : 0), 0);
  const allVariantRowsPriced = hasVariantRows && variantRowsWithPrices.length === variantRows.length;
  const listingReadiness = [
    { label: "Product identity", detail: "Category, type, and a clear title", complete: Boolean(categoryId && productTypeKey && title.trim()) },
    { label: "Buyer-facing content", detail: "80+ character description and at least 3 key features", complete: description.trim().length >= 80 && keyFeatures.filter((feature) => feature.trim()).length >= 3 },
    { label: "Offer", detail: hasVariantRows ? "A price and stock for every SKU" : "Price and available stock", complete: hasVariantRows ? allVariantRowsPriced && variantRows.every((row) => Number.isInteger(Number(row.stock)) && Number(row.stock) >= 0) : Number(price) > 0 && Number.isInteger(Number(stockQuantity)) && Number(stockQuantity) >= 0 },
    { label: "Required specifications", detail: `${requiredSpecificationKeys.size} fields for this product type`, complete: [...requiredSpecificationKeys].every((key) => Boolean(categoryAttributes[key]?.trim())) },
    { label: "Main product photo", detail: "One is required; 3 or more views are recommended", complete: imageItems.length > 0 },
  ];
  const updateCategoryAttribute = (key: string, value: string) => {
    setCategoryAttributes(prev => ({ ...prev, [key]: value }));
  };

  const getApprovalBadge = (product: Product) => {
    if (product.status !== "active") return null;
    if (product.is_approved) {
      return <Badge className="bg-success/10 text-success border-success/20 gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>;
    }
    return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1 text-xs"><Clock className="h-3 w-3" /> Pending Approval</Badge>;
  };

  const statusColors: Record<string, string> = {
    active: "bg-success/10 text-success border-success/20",
    draft: "bg-muted text-muted-foreground border-border",
    archived: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">My Products</h1>
            <p className="mt-1 text-muted-foreground">Manage your product listings ({products.length} total)</p>
          </div>
          <Button onClick={openNewProduct} className="gap-2 gradient-seller text-primary-foreground shadow-glow-seller">
            {listingMinimized ? <><Play className="h-4 w-4" /> Continue listing</> : <><Plus className="h-4 w-4" /> Add Product</>}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleListingDialogChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between gap-3 pr-7">
                  <DialogTitle className="font-display">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                  {!editingProduct && <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={minimizeNewListing}><Minus className="h-3.5 w-3.5" /> Minimize</Button>}
                </div>
                {!editingProduct && (
                  <div className="mt-1 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Your progress is saved automatically. Minimize to continue later without losing this form; after a browser reload, re-select any files before submitting.</p><Button type="button" variant="ghost" size="sm" className="shrink-0 text-xs text-muted-foreground" onClick={discardNewDraft}>Discard draft</Button></div>
                )}
              </DialogHeader>

              <Tabs value={formTab} onValueChange={setFormTab} className="mt-4">
                <div className="mb-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Simple listing path:</span> 1. Describe the product &rarr; 2. Add options and exact SKU prices &rarr; 3. Fill the requested details &rarr; 4. Add photos &rarr; 5. Review and publish. Fields marked <span className="font-semibold text-foreground">*</span> are required.
                </div>
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic">1. Basics</TabsTrigger>
                  <TabsTrigger value="variants">2. Options</TabsTrigger>
                  <TabsTrigger value="specs">3. Details</TabsTrigger>
                  <TabsTrigger value="media">4. Photos</TabsTrigger>
                  <TabsTrigger value="preview">5. Review</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
                    Start with what every buyer needs to recognise this product. If storage, colour, or another option changes the price, set those exact prices in <span className="font-semibold">2. Options</span> - do not create separate product listings.
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Category *</label>
                    <Select value={categoryId} onValueChange={(value) => { setCategoryId(value); setProductTypeKey(""); setCategoryAttributes({}); }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">Choose a category first so the listing can show the right product details.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Product Type *</label>
                    <Select value={productTypeKey} onValueChange={(value) => { setProductTypeKey(value); setCategoryAttributes({}); }} disabled={!categoryId}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder={categoryId ? "Select product type" : "Choose category first"} /></SelectTrigger>
                      <SelectContent>
                        {selectableProductTypes.map(type => <SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">Only product types that belong to this category are shown. Product type controls the exact fields buyers and admins will see.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Product Title *</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isPhoneListing ? "e.g. Apple iPhone 15 Pro, 256GB, Factory Unlocked" : "e.g. Wireless Bluetooth Headphones"} className="mt-1" />
                    <p className="mt-1 text-xs text-muted-foreground">{isPhoneListing ? "Keep this short: brand, model, key configuration, and carrier status. Example: Apple iPhone 16, 128GB, Unlocked. Put screen, RAM, chip, connectivity, and other full details below." : "Keep this short: brand, product type, and main differentiator. Put full features, uses, and package contents in Product details below."}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Product Details <span className="text-xs text-muted-foreground font-normal">(min 80 characters)</span></label>
                    <Textarea value={description} onChange={(e) => { setDescription(e.target.value); setDescriptionError(""); }} placeholder="Detailed product description — features, use cases, what's in the box..." className="mt-1" rows={5} />
                    <p className="mt-1 text-xs text-muted-foreground">Add the long information here, not in the title. Example: “Original iPhone 16 with 6.1-inch Super Retina XDR OLED display, 128GB storage, 6GB RAM, Face ID, NFC, A18 chip, 5G support, unlocked US/CN version.”</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{description.length}/5000</span>
                      {description.length > 0 && description.length < 80 && (
                        <span className="text-xs text-destructive">Must be at least 80 characters</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">{hasVariantRows ? "Starting price (from SKU prices)" : "Price for a single-price product *"}</label>
                      {hasVariantRows ? (
                        <Input value={lowestVariantPrice === null ? "Add a price for each SKU in Options" : `${currency} ${lowestVariantPrice.toFixed(2)}`} readOnly className="mt-1 bg-muted" aria-label="Starting price calculated from SKU prices" />
                      ) : (
                        <Input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 250000" className="mt-1" />
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{hasVariantRows ? "Calculated from the lowest exact SKU price. Buyers pay the price for the storage and colour they choose." : "Use this only when every unit has the same price. Options with different prices are set in the next tab."}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Compare at price</label>
                      <Input type="number" step="0.01" value={compareAtPrice} onChange={(e) => { setCompareAtPrice(e.target.value); setCompareAtError(""); }} placeholder="Original price" className="mt-1" />
                      {compareAtError && <p className="mt-1 text-xs text-destructive">{compareAtError}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Listing currency *</label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{LISTING_CURRENCIES.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">Enter the real amount you charge in this currency. Buyers see an estimated conversion in their selected currency.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">URL Slug</label>
                    <Input value={seoSlug} onChange={(e) => { setSeoSlug(e.target.value); setSlugTouched(true); }} placeholder="product-url-slug" className="mt-1" />
                    <p className="mt-1 text-xs text-muted-foreground">Live URL: /product/{seoSlug || "your-slug"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Meta Description <span className="text-xs text-muted-foreground font-normal">(optional, max 160 chars)</span></label>
                    <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value.slice(0, 160))} placeholder="Short search snippet for this product" className="mt-1" rows={2} />
                    <p className="mt-1 text-xs text-muted-foreground">{metaDescription.length}/160</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Low Stock Threshold</label>
                    <Input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} placeholder="5" className="mt-1" />
                    <p className="mt-1 text-xs text-muted-foreground">Shows "Only X left" when stock drops to this number.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">{hasVariantRows ? "Total SKU stock" : "Stock quantity"}</label>
                      {hasVariantRows ? (
                        <Input value={String(totalVariantStock)} readOnly className="mt-1 bg-muted" aria-label="Total stock calculated from SKU rows" />
                      ) : (
                        <Input type="number" min="0" step="1" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="e.g. 12" className="mt-1" />
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{hasVariantRows ? "Calculated from the stock entered for each SKU in Options." : "How many units are ready to sell now."}</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2"><label className="text-sm font-medium text-foreground">SKU</label><Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSku(generateSku())}>Generate new</Button></div>
                      <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" className="mt-1" />
                    </div>
                  </div>
                  {/* Flash Deal */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox checked={flashDealEnabled} onCheckedChange={(v) => setFlashDealEnabled(!!v)} id="flash-deal" />
                      <label htmlFor="flash-deal" className="text-sm font-medium text-foreground cursor-pointer">Enable Flash Deal</label>
                    </div>
                    {flashDealEnabled && (
                      <>
                        <div>
                          <label className="text-sm font-medium text-foreground">Discount %</label>
                          <Input type="number" min="1" max="99" value={flashDealDiscount} onChange={(e) => setFlashDealDiscount(e.target.value)} placeholder="e.g. 20" className="mt-1" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-foreground">Start Date & Time</label>
                            <Input type="datetime-local" value={flashDealStart} onChange={(e) => setFlashDealStart(e.target.value)} className="mt-1" />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-foreground">End Date & Time</label>
                            <Input type="datetime-local" value={flashDealEnd} onChange={(e) => setFlashDealEnd(e.target.value)} className="mt-1" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="variants" className="space-y-4 mt-4">
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
                    <p className="font-semibold">Use options when a buyer can choose a different version of the same product.</p>
                    <p className="mt-1 text-xs leading-relaxed">For example, create one iPhone listing and add 128GB, 256GB, and 512GB here. Each row below is a real SKU: give it its own price and stock. The buyer pays the price for the storage and colour selected.</p>
                  </div>
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Step 1: Add the options you sell</p>
                        <p className="mt-1 text-xs text-muted-foreground">Choose the recognised variation type first, then enter its values separated by commas or new lines. For a phone, select Storage capacity and enter values such as 128GB and 256GB.</p>
                      </div>
                      <Button type="button" variant="secondary" className="gap-2" onClick={generateStorageColorMatrix}>
                        <Plus className="h-4 w-4" /> Create price & stock rows
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground">Variation type</label>
                        <Select value={variantPrimaryOption} onValueChange={setVariantPrimaryOption}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {!VARIATION_TYPES.some((type) => type.value === variantPrimaryOption) && <SelectItem value={variantPrimaryOption}>{primaryVariationDetails.label}</SelectItem>}
                            {VARIATION_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground">{primaryVariationDetails.label} values (optional)</label>
                        <Input value={variantStorageValues} onChange={(event) => setVariantStorageValues(event.target.value)} placeholder={primaryVariationDetails.placeholder} className="mt-1" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground">Colour values (optional)</label>
                        <Input value={variantColorValues} onChange={(event) => setVariantColorValues(event.target.value)} placeholder="Black, Blue, Silver" className="mt-1" />
                      </div>
                    </div>
                  </div>
                  {variantRows.length > 0 && <div className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-sm font-semibold text-foreground">Step 2: Price and stock every exact SKU</p><p className="mt-1 text-xs text-muted-foreground">{variantRows.length} SKU row{variantRows.length === 1 ? "" : "s"}. Price is required for every row - this is how 128GB can cost less than 256GB or 512GB. The lowest price becomes the listing's “From” price.</p></div>}
                  <div className="space-y-3">
                    {variantRows.map((row, index) => (
                      <div key={row.key} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-4 xl:grid-cols-7">
                        {showLegacySizeColumn && <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Size</span><Input value={row.size} onChange={e => setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, size: e.target.value } : item))} placeholder="e.g. Large" /></label>}
                        {showColourColumn && <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Colour</span><Input value={row.color} onChange={e => setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, color: e.target.value } : item))} placeholder="e.g. Black" /></label>}
                        {row.optionName && <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">{variationTypeDetails(row.optionName).label}</span><Input value={row.optionValue || ""} onChange={e => setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, optionValue: e.target.value } : item))} placeholder={variationTypeDetails(row.optionName).placeholder} /></label>}
                        <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Your SKU / code</span><Input value={row.sku} onChange={e => setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, sku: e.target.value } : item))} placeholder="Optional" /></label>
                        <label className="space-y-1"><span className="text-xs font-bold text-primary">Price for this exact SKU *</span><Input type="number" min="0.01" step="0.01" value={row.price} onChange={e => setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} placeholder={`e.g. ${currency === "NGN" ? "250000" : "250"}`} className="border-primary/50" aria-label={`Price for variant ${index + 1}`} /></label>
                        <label className="space-y-1"><span className="text-xs font-semibold text-muted-foreground">Stock for this SKU *</span><Input type="number" min="0" step="1" value={row.stock} onChange={e => setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, stock: e.target.value } : item))} placeholder="0" aria-label={`Stock for variant ${index + 1}`} /></label>
                        <div className="col-span-2 space-y-1.5 sm:col-span-1">
                          <Select
                            value={row.imageSourceId || "__none"}
                            onValueChange={(value) => {
                              const source = imageItems.find((item) => item.id === value);
                              setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, imageSourceId: value === "__none" ? undefined : value, imageFile: undefined, imageUrl: source?.url || "" } : item));
                            }}
                          >
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Gallery image" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">No gallery image</SelectItem>
                              {imageItems.map((image, imageIndex) => <SelectItem key={image.id} value={image.id}>Gallery image {imageIndex + 1}{image.isPrimary ? " (main)" : ""}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
                            <ImagePlus className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{row.imageFile ? row.imageFile.name : row.imageUrl && !row.imageSourceId ? "Change separate image" : "Upload separate image"}</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, imageFile: file, imageSourceId: undefined, imageUrl: "" } : item));
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {(row.imageSourceId || row.imageFile || row.imageUrl) && <button type="button" className="text-xs text-muted-foreground underline hover:text-destructive" onClick={() => setVariantRows(rows => rows.map((item, i) => i === index ? { ...item, imageSourceId: undefined, imageFile: undefined, imageUrl: "" } : item))}>Remove image</button>}
                        </div>
                        <Button type="button" variant="outline" className="text-destructive" onClick={() => setVariantRows(rows => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" className="gap-2" onClick={() => setVariantRows(rows => [...rows, { key: `variant-${Date.now()}`, size: "", color: "", optionName: variantPrimaryOption, optionValue: "", sku: `${sku || generateSku()}-${rows.length + 1}`, price: "", stock: "0", imageUrl: "" }])}><Plus className="h-4 w-4" /> Add another {primaryVariationDetails.label} SKU</Button>
                </TabsContent>

                <TabsContent value="specs" className="space-y-4 mt-4">
                  {!categoryId || !productTypeKey ? (
                    <div className="rounded-lg border border-dashed border-border p-6 text-center">
                      <Package className="mx-auto h-8 w-8 text-muted-foreground/50" />
                      <p className="mt-2 text-sm font-medium text-foreground">Select category and product type to continue</p>
                      <p className="mt-1 text-xs text-muted-foreground">Only relevant product fields will appear here.</p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-sm font-medium text-foreground">{selectedProductTypeConfig.label} Details</p>
                        <p className="mt-1 text-xs text-muted-foreground">Fields marked * are required before submission. These details help buyers compare products in {selectedCategory?.name || "this category"}.</p>
                        {isPhoneListing && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">For Wi-Fi-only devices, choose “Wi-Fi only” and “No SIM or eSIM support”; carrier and account-lock fields are optional. For used or refurbished phones, show the actual device, all sides, screen on, packaging/accessories, and visible flaws. Never enter an IMEI or serial number in a public listing.</p>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedProductTypeConfig.fields.map((field) => (
                          <div key={field.key}>
                            <label className="text-sm font-medium text-foreground">{field.label}{requiredSpecificationKeys.has(field.key) ? " *" : ""}</label>
                            {field.type === "select" ? (
                              <Select value={categoryAttributes[field.key] || ""} onValueChange={(value) => updateCategoryAttribute(field.key, value)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder={`Select ${field.label.toLowerCase()}`} /></SelectTrigger>
                                <SelectContent>
                                  {(field.options || []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : field.type === "textarea" ? (
                              <Textarea
                                value={categoryAttributes[field.key] || ""}
                                onChange={(e) => updateCategoryAttribute(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="mt-1"
                                rows={3}
                              />
                            ) : (
                              <Input
                                type={field.type === "date" ? "date" : "text"}
                                value={categoryAttributes[field.key] || ""}
                                onChange={(e) => updateCategoryAttribute(field.key, e.target.value)}
                                placeholder={field.placeholder}
                                className="mt-1"
                              />
                            )}
                            {field.helpText && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{field.helpText}</p>}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-sm font-medium text-foreground">Warranty</label>
                    <Select value={warrantyPeriod} onValueChange={setWarrantyPeriod}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="1 Month">1 Month</SelectItem>
                        <SelectItem value="3 Months">3 Months</SelectItem>
                        <SelectItem value="6 Months">6 Months</SelectItem>
                        <SelectItem value="1 Year">1 Year</SelectItem>
                        <SelectItem value="2 Years">2 Years</SelectItem>
                        <SelectItem value="lifetime">Lifetime</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Shipping Info</label>
                    <Textarea value={shippingInfo} onChange={(e) => setShippingInfo(e.target.value)}
                      placeholder="e.g. Ships within 3-5 business days via standard courier"
                      className="mt-1" rows={2} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">User Manual / Guide (optional PDF)</label>
                    <input type="file" accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && file.size > MAX_DOCUMENT_SIZE_BYTES) {
                          toast({ title: "Document too large", description: "PDF guides must be 10 MB or smaller.", variant: "destructive" });
                          e.currentTarget.value = "";
                          return;
                        }
                        setDocFile(file || null);
                      }}
                      className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted/80" />
                    {docFile && <p className="mt-1 text-xs text-muted-foreground">Selected: {docFile.name}</p>}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                    <Checkbox checked={showSoldCount} onCheckedChange={(v) => setShowSoldCount(!!v)} id="show-sold" />
                    <label htmlFor="show-sold" className="text-sm text-foreground cursor-pointer">Display sold count on product page</label>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Ships To</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="mt-1 w-full justify-start gap-2 font-normal">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          {shipsTo.length === 0 ? "Worldwide (all countries)" : `${shipsTo.length} ${shipsTo.length === 1 ? "country" : "countries"} selected`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3" align="start">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">Select countries</span>
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShipsTo([])}>Worldwide</Button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-1">
                          {COUNTRIES.map((c) => {
                            const checked = shipsTo.includes(c.code);
                            return (
                              <label key={c.code} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setShipsTo((prev) => v ? [...prev, c.code] : prev.filter((x) => x !== c.code));
                                  }}
                                />
                                <span className="text-foreground">{c.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {shipsTo.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {shipsTo.map((code) => (
                          <Badge key={code} variant="outline" className="gap-1 text-xs">
                            {countryName(code)}
                            <button type="button" onClick={() => setShipsTo((p) => p.filter((x) => x !== code))} className="ml-0.5 text-muted-foreground hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">Leave empty to ship worldwide.</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">Key Features <span className="text-xs text-muted-foreground font-normal">(up to 5)</span></label>
                      <Button type="button" variant="ghost" size="sm" onClick={addFeature} disabled={keyFeatures.length >= 5} className="h-7 text-xs gap-1">
                        <Plus className="h-3 w-3" /> Add Feature
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {keyFeatures.map((feature, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={feature}
                            onChange={(e) => updateFeature(i, e.target.value)}
                            placeholder={`Feature ${i + 1}`}
                          />
                          {keyFeatures.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeFeature(i)} className="h-10 w-10 p-0 shrink-0">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="media" className="space-y-4 mt-4">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-foreground">Product Images</label>
                      <span className="text-xs text-muted-foreground">{imageItems.length}/{MAX_PRODUCT_IMAGES} images</span>
                    </div>
                    <div className="mt-2">
                      <label
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          addImageFiles(Array.from(e.dataTransfer.files || []));
                        }}
                        className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-7 cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        <div className="text-center">
                          <span className="text-sm font-medium text-foreground">Drop images here or browse files</span>
                          <p className="text-xs text-muted-foreground mt-1">Add up to {MAX_PRODUCT_IMAGES} JPG, PNG, or WebP photos. The main photo appears on product cards, cart, and checkout.</p>
                        </div>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImageFiles(Array.from(e.target.files || []))} />
                      </label>
                    </div>
                    {imageItems.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {imageItems.map((item) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => setDraggedImageId(item.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedImageId) moveImageItem(draggedImageId, item.id);
                              setDraggedImageId(null);
                            }}
                            className="group rounded-xl border border-border bg-card p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                              <ProductImage src={item.url} alt={item.name} className="group-hover:scale-105" loading="lazy" />
                              <div className="absolute left-2 top-2 flex gap-1">
                                <button type="button" className="rounded-md bg-white/90 p-1 text-foreground shadow-sm" title="Drag to reorder">
                                  <GripVertical className="h-3.5 w-3.5" />
                                </button>
                                {item.isPrimary && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-1 text-[10px] font-semibold text-foreground shadow-sm">
                                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> Primary
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeImageItem(item.id)}
                                className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-foreground shadow-sm hover:text-destructive"
                                aria-label="Remove image"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              {item.status === "uploading" && (
                                <div className="absolute inset-x-2 bottom-2 rounded-full bg-white/90 p-1 shadow-sm">
                                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                                <p className={`text-[11px] ${item.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                                  {item.status === "uploaded" ? "Uploaded" : item.status === "uploading" ? `Uploading ${item.progress}%` : item.status === "error" ? item.error || "Upload failed" : "Ready"}
                                </p>
                              </div>
                              {item.status === "uploaded" ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                              ) : item.status === "error" ? (
                                <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={handleSave} disabled={saving}>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              ) : null}
                            </div>
                            {!item.isPrimary && (
                              <Button type="button" variant="outline" size="sm" className="mt-2 h-8 w-full text-xs" onClick={() => setPrimaryImage(item.id)}>
                                Set primary
                              </Button>
                            )}
                            <Input
                              value={item.alt}
                              onChange={(e) => updateImageUploadState(item.id, { alt: e.target.value })}
                              placeholder="Alt text (optional)"
                              className="mt-2 h-8 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">Photo quality checklist</p>
                      <p className="mt-1">Use a clean, well-lit main image that shows the full product. Add close-ups, back/side views, packaging, dimensions, and any flaws. Keep the same framing for colour options and use descriptive alt text, such as “Navy backpack, front view”.</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-foreground">Description Photos <span className="text-xs text-muted-foreground font-normal">(optional)</span></label>
                      <span className="text-xs text-muted-foreground">{descriptionImageItems.length}/20</span>
                    </div>
                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        addDescriptionImageFiles(Array.from(e.dataTransfer.files || []));
                      }}
                      className="mt-2 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-5 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <ImagePlus className="h-7 w-7 text-muted-foreground" />
                      <div className="text-center">
                        <span className="text-sm font-medium text-foreground">Drop description photos here or browse files</span>
                        <p className="text-xs text-muted-foreground mt-1">These build a visual story below the written description—use them for size charts, installation steps, packaging, comparison details, or proof of condition. They are optional and do not replace main gallery photos.</p>
                      </div>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addDescriptionImageFiles(Array.from(e.target.files || []))} />
                    </label>
                    {descriptionImageItems.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {descriptionImageItems.map((item) => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() => setDraggedDescriptionImageId(item.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedDescriptionImageId) moveDescriptionImageItem(draggedDescriptionImageId, item.id);
                              setDraggedDescriptionImageId(null);
                            }}
                            className="group rounded-xl border border-border bg-card p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                              <ProductImage src={item.url} alt={item.alt || item.name} className="group-hover:scale-105" loading="lazy" />
                              <button
                                type="button"
                                onClick={() => removeDescriptionImageItem(item.id)}
                                className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-foreground shadow-sm hover:text-destructive"
                                aria-label="Remove description photo"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                              {item.status === "uploading" && (
                                <div className="absolute inset-x-2 bottom-2 rounded-full bg-white/90 p-1 shadow-sm">
                                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="mt-2">
                              <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                              <p className={`text-[11px] ${item.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                                {item.status === "uploaded" ? "Uploaded" : item.status === "uploading" ? `Uploading ${item.progress}%` : item.status === "error" ? item.error || "Upload failed" : "Ready"}
                              </p>
                              <Input
                                value={item.alt}
                                onChange={(e) => updateDescriptionImageState(item.id, { alt: e.target.value })}
                                placeholder="Alt text (optional)"
                                className="mt-2 h-8 text-xs"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-foreground">Product Videos <span className="text-xs text-muted-foreground font-normal">(optional)</span></label>
                      <span className="text-xs text-muted-foreground">MP4, MOV, WebM</span>
                    </div>
                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        addVideoFiles(Array.from(e.dataTransfer.files || []));
                      }}
                      className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background border border-border">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Upload product demonstration video</p>
                          <p className="text-xs text-muted-foreground">Buyers can play it in the product gallery.</p>
                        </div>
                      </div>
                      <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" multiple className="hidden" onChange={(e) => addVideoFiles(Array.from(e.target.files || []))} />
                    </label>
                    {videoItems.length > 0 && (
                      <div className="mt-3 grid gap-3">
                        {videoItems.map((item) => (
                          <div key={item.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                            <div className="flex gap-3">
                              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-black">
                                <ProductVideoPlayer src={item.url} compact alt={item.name} className="h-20 w-28" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                                    <p className={`text-xs ${item.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                                      {item.status === "uploaded" ? "Uploaded" : item.status === "uploading" ? `Uploading ${item.progress}%` : item.status === "error" ? item.error || "Upload failed" : "Ready"}
                                    </p>
                                  </div>
                                  <button type="button" onClick={() => removeVideoItem(item.id)} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label="Remove video">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                {item.status === "uploading" && (
                                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} />
                                  </div>
                                )}
                                {item.status === "error" && (
                                  <Button type="button" size="sm" variant="outline" className="mt-2 h-8 gap-1 text-xs" onClick={handleSave} disabled={saving}>
                                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Tags</label>
                    <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="electronics, wireless, bluetooth (comma-separated)" className="mt-1" />
                    <p className="text-xs text-muted-foreground mt-1">Separate tags with commas. Tags help buyers find your product.</p>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-4 mt-4">
                  <div className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">Listing readiness</p>
                    <p className="mt-1 text-xs text-muted-foreground">Review this before submitting. Required items are enforced; additional photos improve buyer confidence.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {listingReadiness.map((item) => (
                        <div key={item.label} className={`rounded-md border px-3 py-2 text-xs ${item.complete ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"}`}>
                          <p className="font-semibold">{item.complete ? "Ready" : "Needs attention"}: {item.label}</p>
                          <p className="mt-0.5 opacity-80">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">{selectedCategory?.name || "Category"} {productTypeKey ? ` / ${selectedProductTypeConfig.label}` : ""}</p>
                        <h3 className="mt-1 font-display text-lg font-semibold text-foreground">{title || "Product name"}</h3>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg font-bold text-foreground">{price ? `$${Number(price).toFixed(2)}` : "$0.00"}</p>
                        {compareAtPrice && <p className="text-xs text-muted-foreground line-through">${Number(compareAtPrice).toFixed(2)}</p>}
                      </div>
                    </div>
                    {description && <p className="mt-3 text-sm text-muted-foreground line-clamp-3">{description}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">Stock: {stockQuantity || 0}</Badge>
                      {shippingInfo && <Badge variant="outline">Shipping added</Badge>}
                      {tagsInput.split(",").filter(t => t.trim()).slice(0, 3).map(tag => (
                        <Badge key={tag.trim()} variant="secondary">{tag.trim()}</Badge>
                      ))}
                    </div>
                  </div>
                  {productTypeKey && (
                    <div className="rounded-lg border border-border p-4">
                      <p className="text-sm font-medium text-foreground mb-3">{selectedProductTypeConfig.label} Specifications</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedProductTypeConfig.fields
                          .filter(field => categoryAttributes[field.key])
                          .map(field => (
                            <div key={field.key} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                              <span className="text-muted-foreground">{field.label}: </span>
                              <span className="font-medium text-foreground">{categoryAttributes[field.key]}</span>
                            </div>
                          ))}
                      </div>
                      {selectedProductTypeConfig.fields.every(field => !categoryAttributes[field.key]) && (
                        <p className="text-xs text-muted-foreground">Add specifications to make the listing easier to compare.</p>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <Button onClick={handleSave} disabled={saving || !title.trim() || !price || !categoryId || !productTypeKey} className="w-full mt-4 gradient-seller text-primary-foreground">
                {saving ? "Saving..." : editingProduct ? "Update Product" : "Submit for Approval"}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={50}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 h-11" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant={needsAttentionOnly ? "secondary" : "outline"} onClick={() => setNeedsAttentionOnly((value) => !value)}>
              {needsAttentionOnly ? "Showing listing health issues" : "Show listing health issues"}
            </Button>
          </div>
          {selectedProductIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
              <span className="mr-1 text-sm font-medium text-foreground">{selectedProductIds.length} selected</span>
              <Button type="button" size="sm" variant="outline" disabled={bulkSaving} onClick={() => setBulkEditOpen(true)}>Edit base price / stock</Button>
              <Button type="button" size="sm" variant="outline" disabled={bulkSaving} onClick={() => updateSelectedProductStatus("draft")}>Move to drafts</Button>
              <Button type="button" size="sm" variant="outline" className="text-destructive" disabled={bulkSaving} onClick={() => updateSelectedProductStatus("archived")}>Archive selected</Button>
              <Button type="button" size="sm" variant="ghost" disabled={bulkSaving} onClick={() => setSelectedProductIds([])}>Clear</Button>
            </div>
          )}
          <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Review bulk listing changes</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Apply the same base price or base stock quantity to {selectedProductIds.length} selected listing{selectedProductIds.length === 1 ? "" : "s"}. Leave either field empty to keep its current value.
              </p>
              <div className="grid gap-4 py-2 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">Base price
                  <Input inputMode="decimal" value={bulkPrice} onChange={(event) => setBulkPrice(event.target.value)} placeholder="Keep current" />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Base stock
                  <Input inputMode="numeric" value={bulkStock} onChange={(event) => setBulkStock(event.target.value)} placeholder="Keep current" />
                </label>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                This changes only the base listing. Variant SKU prices and inventory remain unchanged; edit a product’s Variants tab when each SKU needs a different value.
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setBulkEditOpen(false)} disabled={bulkSaving}>Cancel</Button>
                <Button type="button" onClick={applyBulkPriceAndStock} disabled={bulkSaving}>{bulkSaving ? "Updating..." : "Apply changes"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="border-border/60 overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
                  <Package className="h-9 w-9 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">
                  {search ? "No products match your search" : "No products yet"}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  {search ? "Try a different search term" : "Start listing products to reach buyers worldwide. Products will be reviewed by admin before going live."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => {
              const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
              const healthIssues = getListingHealth(product, categories.find((category) => category.id === product.category_id));
              return (
                <Card key={product.id} className="border-border/60 overflow-hidden group">
                  <div className="aspect-video bg-muted relative">
                    {primaryImage ? (
                      <ProductImage src={primaryImage.image_url} alt={product.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Package className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-1">
                      <Badge className={statusColors[product.status]}>
                        {product.status}
                      </Badge>
                    </div>
                    <div className="absolute left-3 top-3 rounded-md bg-background/90 p-1 shadow-sm">
                      <Checkbox
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={(checked) => setSelectedProductIds((ids) => checked ? [...new Set([...ids, product.id])] : ids.filter((id) => id !== product.id))}
                        aria-label={`Select ${product.title}`}
                      />
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-display font-semibold text-foreground truncate">{product.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-display text-lg font-bold text-foreground">${product.price}</span>
                      {product.compare_at_price && (
                        <span className="text-sm text-muted-foreground line-through">${product.compare_at_price}</span>
                      )}
                    </div>
                    {product.brand && (
                      <p className="text-xs text-muted-foreground mt-1">{product.brand} · {product.condition}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <p className="text-xs text-muted-foreground">Stock: {product.stock_quantity}</p>
                      {getApprovalBadge(product)}
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Globe className="h-3 w-3" />
                        {!product.ships_to || product.ships_to.length === 0
                          ? "Worldwide"
                          : product.ships_to.length <= 2
                            ? product.ships_to.map(countryName).join(", ")
                            : `${product.ships_to.length} countries`}
                      </Badge>
                    </div>
                    {healthIssues.length > 0 && (
                      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                        <p className="font-semibold">Listing health: needs attention</p>
                        <p className="mt-0.5">{healthIssues.slice(0, 2).map((issue) => issue.message).join(" · ")}{healthIssues.length > 2 ? ` · +${healthIssues.length - 2} more` : ""}</p>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5 text-center">
                      <div className="flex flex-col items-center" title="Views">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Eye className="h-3 w-3" /> Views</div>
                        <span className="text-sm font-semibold text-foreground">{stats[product.id]?.views ?? 0}</span>
                      </div>
                      <div className="flex flex-col items-center" title="Saves">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><Heart className="h-3 w-3" /> Saves</div>
                        <span className="text-sm font-semibold text-foreground">{stats[product.id]?.saves ?? 0}</span>
                      </div>
                      <div className="flex flex-col items-center" title="Orders">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground"><ShoppingCart className="h-3 w-3" /> Orders</div>
                        <span className="text-sm font-semibold text-foreground">{stats[product.id]?.orders ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 mt-3">
                      <Button variant="outline" size="sm" onClick={() => openEdit(product)} className="flex-1 gap-1">
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(product)}>
                        {product.status === "active" ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => archiveProduct(product.id)}>
                        <Archive className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteProduct(product.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </AnimatedSection>
    </div>
  );
}
