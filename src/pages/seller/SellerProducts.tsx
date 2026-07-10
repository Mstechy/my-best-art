import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Package, Pencil, Trash2, ImagePlus, Eye, EyeOff, Archive, Clock, CheckCircle2, X, Heart, ShoppingCart, GripVertical, Play, Upload, RotateCcw, Star } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, countryName } from "@/lib/countries";
import { findCategoryConfig, findProductTypeConfig, getCategoryAttributes, getProductType, getProductVideos, mergeCategoryAttributes } from "@/lib/categoryConfig";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Globe } from "lucide-react";
import { uploadProductImagePair } from "@/lib/productImages";
import ProductImage from "@/components/product/ProductImage";

interface Category {
  id: string;
  name: string;
  slug: string;
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
  shipping_info: string | null;
  key_features: string[] | null;
  tags: string[] | null;
  ships_to: string[] | null;
  variants: Record<string, unknown> | null;
  created_at: string;
  product_images: { id: string; image_url: string; is_primary: boolean; sort_order?: number }[];
}

type UploadState = "local" | "uploading" | "uploaded" | "error";

interface ImageMediaItem {
  id: string;
  dbId?: string;
  file?: File;
  url: string;
  name: string;
  isPrimary: boolean;
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

export default function SellerProducts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Record<string, { views: number; saves: number; orders: number }>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formTab, setFormTab] = useState("basic");

  // Form state — basic
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [sku, setSku] = useState("");
  const [imageItems, setImageItems] = useState<ImageMediaItem[]>([]);
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([]);
  const [videoItems, setVideoItems] = useState<VideoMediaItem[]>([]);
  const [removedVideoUrls, setRemovedVideoUrls] = useState<string[]>([]);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [showSoldCount, setShowSoldCount] = useState(true);

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

  const [saving, setSaving] = useState(false);
  const [savedProductId, setSavedProductId] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setProducts(data.map(p => {
      const sortedImages = [...(((p as any).product_images || []) as Product["product_images"])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      return ({
      ...p,
      product_images: sortedImages,
      is_approved: (p as any).is_approved ?? false,
      brand: (p as any).brand ?? null,
      weight: (p as any).weight ?? null,
      dimensions: (p as any).dimensions ?? null,
      material: (p as any).material ?? null,
      color: (p as any).color ?? null,
      condition: (p as any).condition ?? "new",
      warranty: (p as any).warranty ?? null,
      shipping_info: (p as any).shipping_info ?? null,
      key_features: (p as any).key_features ?? null,
      tags: (p as any).tags ?? null,
      ships_to: (p as any).ships_to ?? null,
      variants: (p as any).variants ?? null,
    });
    }) as unknown as Product[]);
    setLoading(false);

    // fetch per-product stats
    const ids = (data || []).map((p: any) => p.id);
    if (ids.length) {
      const [viewsRes, savesRes, itemsRes] = await Promise.all([
        supabase.from("product_views" as any).select("product_id").in("product_id", ids),
        supabase.from("wishlists").select("product_id").in("product_id", ids),
        supabase.from("order_items").select("product_id").in("product_id", ids),
      ]);
      const s: Record<string, { views: number; saves: number; orders: number }> = {};
      ids.forEach((id) => { s[id] = { views: 0, saves: 0, orders: 0 }; });
      (viewsRes.data || []).forEach((r: any) => { if (s[r.product_id]) s[r.product_id].views++; });
      (savesRes.data || []).forEach((r: any) => { if (s[r.product_id]) s[r.product_id].saves++; });
      (itemsRes.data || []).forEach((r: any) => { if (s[r.product_id]) s[r.product_id].orders++; });
      setStats(s);
    }
  }, [user]);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    if (data) setCategories(data);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const revokeLocalMediaUrls = () => {
    imageItems.forEach((item) => {
      if (item.file) URL.revokeObjectURL(item.url);
    });
    videoItems.forEach((item) => {
      if (item.file) URL.revokeObjectURL(item.url);
    });
  };

  const addImageFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setImageItems((prev) => {
      const next = [
        ...prev,
        ...imageFiles.map((file, index): ImageMediaItem => ({
          id: `local-image-${Date.now()}-${index}-${file.name}`,
          file,
          url: URL.createObjectURL(file),
          name: file.name,
          isPrimary: prev.length === 0 && index === 0,
          status: "local",
          progress: 0,
        })),
      ];
      return next.some((item) => item.isPrimary) ? next : next.map((item, index) => ({ ...item, isPrimary: index === 0 }));
    });
  };

  const addVideoFiles = (files: File[]) => {
    const accepted = files.filter((file) => /video\/(mp4|quicktime|webm)/i.test(file.type) || /\.(mp4|mov|webm)$/i.test(file.name)).slice(0, 3);
    if (accepted.length === 0) return;
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

  const resetForm = () => {
    revokeLocalMediaUrls();
    setTitle(""); setDescription(""); setPrice(""); setCompareAtPrice("");
    setCategoryId(""); setStockQuantity(""); setSku(""); setImageItems([]); setVideoItems([]);
    setRemovedImageIds([]); setRemovedVideoUrls([]); setDraggedImageId(null); setSavedProductId(null);
    setDocFile(null); setShowSoldCount(true);
    setBrand(""); setWeight(""); setDimensions(""); setMaterial("");
    setColor(""); setCondition("new"); setWarrantyPeriod("none"); setShippingInfo("");
    setKeyFeatures([""]); setTagsInput(""); setShipsTo([]); setCategoryAttributes({});
    setProductTypeKey(""); setExistingProductVideos([]);
    setEditingProduct(null); setFormTab("basic");
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
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
    setWarrantyPeriod(((product as any).warranty_period as string) || "none");
    setShippingInfo(product.shipping_info || "");
    setKeyFeatures(product.key_features?.length ? product.key_features : [""]);
    setTagsInput(product.tags?.join(", ") || "");
    setShipsTo(product.ships_to || []);
    setShowSoldCount(((product as any).show_sold_count as boolean) ?? true);
    setProductTypeKey(getProductType(product.variants)?.key || "");
    const savedVideos = getProductVideos(product.variants);
    setExistingProductVideos(savedVideos);
    setImageItems(
      [...(product.product_images || [])]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((image, index) => ({
          id: `existing-image-${image.id}`,
          dbId: image.id,
          url: image.image_url,
          name: `Image ${index + 1}`,
          isPrimary: image.is_primary,
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
    setRemovedImageIds([]);
    setRemovedVideoUrls([]);
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
    setFormTab("basic");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !title.trim() || !price) return;
    if (!categoryId) {
      toast({ title: "Choose a category", description: "Select a category before submitting this product.", variant: "destructive" });
      return;
    }
    if (!productTypeKey) {
      toast({ title: "Choose a product type", description: "Select a product type so buyers see the right details.", variant: "destructive" });
      return;
    }
    if (description.trim().length > 0 && description.trim().length < 30) {
      toast({ title: "Description too short", description: "Please write at least 30 characters.", variant: "destructive" });
      return;
    }
    setSaving(true);

    const cleanFeatures = keyFeatures.map(f => f.trim()).filter(Boolean).slice(0, 5);
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
    const attr = (key: string) => cleanCategoryAttributes[key] || "";

    const productData = {
      seller_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      price: parseFloat(price),
      compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : null,
      category_id: categoryId || null,
      stock_quantity: parseInt(stockQuantity) || 0,
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
      variants: mergeCategoryAttributes(editingProduct?.variants, {
        categoryGroup: selectedConfig.title,
        ...cleanCategoryAttributes,
      }, { key: selectedProductType.key, label: selectedProductType.label }, existingProductVideos),
    };

    let productId = editingProduct?.id || savedProductId;

    if (productId) {
      const { error } = await supabase.from("products").update(productData as any).eq("id", productId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("products").insert({ ...productData, status: "active" } as any).select("id").single();
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setSaving(false); return; }
      productId = data.id;
      setSavedProductId(data.id);
    }

    let mediaHadError = false;

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
          } as any).eq("id", item.dbId);
          if (error) {
            mediaHadError = true;
            updateImageUploadState(item.id, { status: "error", error: error.message });
          }
          continue;
        }
        if (!item.file) continue;
        try {
          updateImageUploadState(item.id, { status: "uploading", progress: 20, error: undefined });
          const { originalUrl } = await uploadProductImagePair(item.file, `${user.id}/${productId}`);
          updateImageUploadState(item.id, { progress: 80 });
          const { data: inserted, error: insertError } = await supabase.from("product_images").insert({
            product_id: productId,
            image_url: originalUrl,
            is_primary: item.isPrimary,
            sort_order: i,
          } as any).select("id").single();
          if (insertError) throw insertError;
          updateImageUploadState(item.id, { dbId: (inserted as any).id, file: undefined, url: originalUrl, status: "uploaded", progress: 100 });
        } catch (error) {
          mediaHadError = true;
          updateImageUploadState(item.id, {
            status: "error",
            progress: 0,
            error: error instanceof Error ? error.message : "Upload failed",
          });
          toast({
            title: "Image upload failed",
            description: error instanceof Error ? error.message : "One of the product images could not be uploaded.",
            variant: "destructive",
          });
        }
      }
    }

    // Upload optional PDF document
    if (docFile && productId) {
      const ext = docFile.name.split(".").pop();
      const path = `${user.id}/${productId}/doc_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, docFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        await (supabase as any).from("product_documents").insert({
          product_id: productId,
          url: urlData.publicUrl,
          label: docFile.name,
        });
      }
    }

    // Upload optional product videos and save URLs in variants JSON.
    if (productId) {
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
          updateVideoUploadState(item.id, {
            status: "error",
            progress: 0,
            error: error instanceof Error ? error.message : "Upload failed",
          });
        }
      }
      const { error: videoUpdateError } = await supabase.from("products").update({
        variants: mergeCategoryAttributes(productData.variants, cleanCategoryAttributes, { key: selectedProductType.key, label: selectedProductType.label }, finalVideos),
      } as any).eq("id", productId);
      if (videoUpdateError) mediaHadError = true;
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
    resetForm();
    setDialogOpen(false);
    setSaving(false);
    fetchProducts();
  };

  const toggleStatus = async (product: Product) => {
    const newStatus = product.status === "active" ? "draft" : "active";
    await supabase.from("products").update({ status: newStatus }).eq("id", product.id);
    fetchProducts();
  };

  const archiveProduct = async (id: string) => {
    await supabase.from("products").update({ status: "archived" as any }).eq("id", id);
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

  const filtered = products.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCategory = categories.find(c => c.id === categoryId) || null;
  const selectedCategoryConfig = findCategoryConfig(selectedCategory);
  const selectedProductTypeConfig = findProductTypeConfig(selectedCategory, productTypeKey);
  const updateCategoryAttribute = (key: string, value: string) => {
    setCategoryAttributes(prev => ({ ...prev, [key]: value }));
  };

  const getApprovalBadge = (product: Product) => {
    if (product.status !== "active") return null;
    if (product.is_approved) {
      return <Badge className="bg-accent/10 text-accent border-accent/20 gap-1 text-xs"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>;
    }
    return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 gap-1 text-xs"><Clock className="h-3 w-3" /> Pending Approval</Badge>;
  };

  const statusColors: Record<string, string> = {
    active: "bg-accent/10 text-accent border-accent/20",
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
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 gradient-seller text-primary-foreground shadow-glow-seller">
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-display">{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                {!editingProduct && (
                  <p className="text-sm text-muted-foreground mt-1">Fill in product details. Your listing will be reviewed by admin before going live.</p>
                )}
              </DialogHeader>

              <Tabs value={formTab} onValueChange={setFormTab} className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="specs">Specifications</TabsTrigger>
                  <TabsTrigger value="media">Images & Tags</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
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
                        {selectedCategoryConfig.productTypes.map(type => <SelectItem key={type.key} value={type.key}>{type.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">Product type controls the exact fields buyers and admins will see.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Product Title *</label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wireless Bluetooth Headphones" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">Description <span className="text-xs text-muted-foreground font-normal">(min 30 characters)</span></label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed product description — features, use cases, what's in the box..." className="mt-1" rows={5} />
                    {description.length > 0 && description.length < 30 && (
                      <p className="mt-1 text-xs text-destructive">Description must be at least 30 characters ({description.length}/30)</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Price (USD) *</label>
                      <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Compare at price</label>
                      <Input type="number" step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Original price" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground">Stock Quantity</label>
                      <Input type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="0" className="mt-1" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">SKU</label>
                      <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" className="mt-1" />
                    </div>
                  </div>
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
                        <p className="mt-1 text-xs text-muted-foreground">These fields help buyers compare products in {selectedCategory?.name || "this category"}.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {selectedProductTypeConfig.fields.map((field) => (
                          <div key={field.key}>
                            <label className="text-sm font-medium text-foreground">{field.label}</label>
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
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
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
                      <span className="text-xs text-muted-foreground">{imageItems.length} image{imageItems.length === 1 ? "" : "s"}</span>
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
                          <p className="text-xs text-muted-foreground mt-1">Upload any product photo. Cards are optimized automatically and originals stay available on the detail page.</p>
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
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
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
                                <video src={item.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <Play className="h-5 w-5 fill-white text-white" />
                                </div>
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
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 h-11" />
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
