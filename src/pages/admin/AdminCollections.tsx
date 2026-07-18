import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layers3, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { uploadCollectionBanner } from "@/lib/collectionBanners";

type Collection = {
  id: string; slug: string; title: string; description: string | null;
  image_url: string | null; badge: string | null; cta_label: string;
  placement: string; status: string; sort_order: number;
  is_automatic: boolean; rules: Record<string, string> | null;
  hero_enabled: boolean; hero_order: number; hero_overlay_opacity: number;
  hero_auto_rotate_duration: number; hero_badge: string | null; hero_cta_link: string | null;
  meta_title: string | null; meta_description: string | null; meta_keywords: string | null;
  show_in_navigation: boolean; show_on_homepage: boolean; display_order: number;
  product_count: number; placements: string[];
};
type ProductOption = { id: string; title: string; status: string; is_approved: boolean };

const PLACEMENT_OPTIONS = [
  "homepage", "navigation", "seasonal", "featured", "new_arrivals",
  "hero_slider", "footer", "hidden", "flash_sale", "deals", "trending", "brands", "categories"
];

const RULE_FIELD_OPTIONS = [
  { value: "category_id", label: "Category" },
  { value: "brand", label: "Brand" },
  { value: "min_price", label: "Min Price" },
  { value: "max_price", label: "Max Price" },
  { value: "min_discount", label: "Min Discount %" },
  { value: "min_rating", label: "Min Rating" },
  { value: "is_featured", label: "Featured" },
  { value: "is_best_seller", label: "Best Seller" },
  { value: "is_trending", label: "Trending" },
  { value: "is_new_arrival", label: "New Arrival" },
  { value: "created_within_days", label: "Created Within Days" },
  { value: "min_stock", label: "Min Stock" },
];

interface FormData {
  title: string; slug: string; description: string; image_url: string;
  badge: string; cta_label: string; placement: string; status: string; sort_order: string;
  is_automatic: boolean;
  hero_enabled: boolean; hero_order: string; hero_overlay_opacity: string;
  hero_auto_rotate_duration: string; hero_badge: string; hero_cta_link: string;
  meta_title: string; meta_description: string; meta_keywords: string;
  show_in_navigation: boolean; show_on_homepage: boolean; display_order: string;
  selectedPlacements: string[];
  rules: { field: string; value: string }[];
}

const emptyForm: FormData = {
  title: "", slug: "", description: "", image_url: "", badge: "",
  cta_label: "Shop collection", placement: "homepage", status: "draft", sort_order: "0",
  is_automatic: false,
  hero_enabled: false, hero_order: "0", hero_overlay_opacity: "0.45",
  hero_auto_rotate_duration: "5000", hero_badge: "", hero_cta_link: "",
  meta_title: "", meta_description: "", meta_keywords: "",
  show_in_navigation: false, show_on_homepage: false, display_order: "0",
  selectedPlacements: ["homepage"],
  rules: [],
};

const toSlug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function AdminCollections() {
  const { toast } = useToast(); const { user } = useAuth();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<Collection | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [productSearch, setProductSearch] = useState("");
  const [results, setResults] = useState<ProductOption[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const fetchCollections = useCallback(async () => {
    const { data, error } = await supabase
      .from("marketplace_collections")
      .select("*")
      .is("seller_id", null)
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load collections", description: error.message, variant: "destructive" });
    else setCollections((data || []) as unknown as Collection[]);
  }, [toast]);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  useEffect(() => {
    const query = productSearch.trim();
    if (query.length < 2) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase
        .from("products")
        .select("id, title, status, is_approved")
        .ilike("title", `%${query}%`)
        .limit(10);
      setResults((data ?? []) as unknown as ProductOption[]);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const updateForm = (key: keyof FormData, value: string | boolean | string[]) =>
    setForm(current => ({ ...current, [key]: value }));

  const togglePlacement = (placement: string) => {
    setForm(current => ({
      ...current,
      selectedPlacements: current.selectedPlacements.includes(placement)
        ? current.selectedPlacements.filter(p => p !== placement)
        : [...current.selectedPlacements, placement],
    }));
  };

  const addRule = () => {
    setForm(current => ({
      ...current,
      rules: [...current.rules, { field: "category_id", value: "" }],
    }));
  };

  const updateRule = (index: number, key: "field" | "value", val: string) => {
    setForm(current => {
      const rules = [...current.rules];
      rules[index] = { ...rules[index], [key]: val };
      return { ...current, rules };
    });
  };

  const removeRule = (index: number) => {
    setForm(current => ({
      ...current,
      rules: current.rules.filter((_, i) => i !== index),
    }));
  };

  const openCreate = () => {
    setEditing(null); setForm(emptyForm); setSelectedProducts([]);
    setProductSearch(""); setOpen(true);
  };

  const openEdit = async (collection: Collection) => {
    setEditing(collection);
    setForm({
      title: collection.title, slug: collection.slug,
      description: collection.description ?? "", image_url: collection.image_url ?? "",
      badge: collection.badge ?? "", cta_label: collection.cta_label,
      placement: collection.placement, status: collection.status,
      sort_order: String(collection.sort_order),
      is_automatic: collection.is_automatic ?? false,
      hero_enabled: collection.hero_enabled ?? false,
      hero_order: String(collection.hero_order ?? 0),
      hero_overlay_opacity: String(collection.hero_overlay_opacity ?? 0.45),
      hero_auto_rotate_duration: String(collection.hero_auto_rotate_duration ?? 5000),
      hero_badge: collection.hero_badge ?? "", hero_cta_link: collection.hero_cta_link ?? "",
      meta_title: collection.meta_title ?? "", meta_description: collection.meta_description ?? "",
      meta_keywords: collection.meta_keywords ?? "",
      show_in_navigation: collection.show_in_navigation ?? false,
      show_on_homepage: collection.show_on_homepage ?? false,
      display_order: String(collection.display_order ?? 0),
      selectedPlacements: collection.placements?.length
        ? collection.placements
        : [collection.placement],
      rules: collection.rules
        ? Object.entries(collection.rules).map(([field, value]) => ({ field, value }))
        : [],
    });
    const { data } = await supabase
      .from("marketplace_collection_products")
      .select("sort_order, products(id, title, status, is_approved)")
      .eq("collection_id", collection.id)
      .order("sort_order");
    setSelectedProducts((data ?? []).flatMap((row: { products: unknown }) =>
      row.products ? [row.products as unknown as ProductOption] : []
    ));
    setOpen(true);
  };

  const uploadBanner = async (file?: File) => {
    if (!file || !user) return;
    setUploadingBanner(true);
    try {
      updateForm("image_url", await uploadCollectionBanner(file, user.id));
      toast({ title: "Banner uploaded" });
    } catch (error) {
      toast({
        title: "Could not upload banner",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally { setUploadingBanner(false); }
  };

  const save = async () => {
    const slug = toSlug(form.slug || form.title);
    if (!form.title.trim() || !slug) {
      toast({ title: "Title and a valid slug are required", variant: "destructive" });
      return;
    }
    setSaving(true);

    // Build rules JSON from rules array
    const rulesJson: Record<string, string> = {};
    form.rules.forEach(rule => {
      if (rule.field && rule.value) rulesJson[rule.field] = rule.value;
    });

    // Cast for unsupported columns until Supabase types are regenerated
    const payload: Record<string, unknown> = {
      title: form.title.trim(), slug,
      description: form.description.trim() || null,
      image_url: form.image_url || null,
      badge: form.badge.trim() || null,
      cta_label: form.cta_label.trim() || "Shop collection",
      placement: form.selectedPlacements[0] || "homepage",
      placements: form.selectedPlacements,
      status: form.status,
      sort_order: Number(form.sort_order) || 0,
      is_automatic: form.is_automatic,
      rules: Object.keys(rulesJson).length > 0 ? rulesJson : null,
      hero_enabled: form.hero_enabled,
      hero_order: Number(form.hero_order) || 0,
      hero_overlay_opacity: Number(form.hero_overlay_opacity) || 0.45,
      hero_auto_rotate_duration: Number(form.hero_auto_rotate_duration) || 5000,
      hero_badge: form.hero_badge.trim() || null,
      hero_cta_link: form.hero_cta_link.trim() || null,
      meta_title: form.meta_title.trim() || null,
      meta_description: form.meta_description.trim() || null,
      meta_keywords: form.meta_keywords.trim() || null,
      show_in_navigation: form.show_in_navigation,
      show_on_homepage: form.show_on_homepage,
      display_order: Number(form.display_order) || 0,
      created_by: user?.id, seller_id: null,
    };

    const response = editing
      ? await supabase.from("marketplace_collections").update(payload as never).eq("id", editing.id).select("id").single()
      : await supabase.from("marketplace_collections").insert(payload as never).select("id").single();

    if (response.error || !response.data) {
      toast({ title: "Could not save collection", description: response.error?.message, variant: "destructive" });
      setSaving(false); return;
    }

    const collectionId = response.data.id;

    // For manual collections, save product links
    if (!form.is_automatic && selectedProducts.length > 0) {
      await supabase.from("marketplace_collection_products").delete().eq("collection_id", collectionId);
      await supabase.from("marketplace_collection_products").insert(
        selectedProducts.map((product, sort_order) => ({
          collection_id: collectionId, product_id: product.id, sort_order,
        }))
      );
    }

    setSaving(false);
    toast({ title: editing ? "Collection updated" : "Collection saved" });
    setOpen(false);
    fetchCollections();
  };

  const remove = async (collection: Collection) => {
    if (!confirm(`Delete "${collection.title}"?`)) return;
    const { error } = await supabase.from("marketplace_collections").delete().eq("id", collection.id);
    if (error) toast({ title: "Could not delete collection", description: error.message, variant: "destructive" });
    else { toast({ title: "Collection deleted" }); fetchCollections(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Collections</h1>
          <p className="mt-1 text-muted-foreground">Manage homepage campaigns, hero slides, navigation links, and curated product sets.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 gradient-admin text-primary-foreground">
          <Plus className="h-4 w-4" /> New collection
        </Button>
      </div>

      {collections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No collections yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {collections.map(collection => (
            <Card key={collection.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="h-14 w-20 rounded-lg bg-muted overflow-hidden shrink-0">
                  {collection.image_url && (
                    <img src={collection.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate flex items-center gap-2">
                    {collection.title}
                    {collection.is_automatic && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">AUTO</Badge>
                    )}
                    {collection.hero_enabled && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-[#F6C75D] text-[#5C3A00]">HERO</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    /{collection.slug} · placement: {collection.placement}
                    {collection.product_count > 0 && ` · ${collection.product_count} products`}
                  </p>
                </div>
                <Badge variant={collection.status === "active" ? "default" : "secondary"}>
                  {collection.status}
                </Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/collections/${collection.slug}`} target="_blank">View</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEdit(collection)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(collection)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit collection" : "New collection"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                Title
                <Input value={form.title} onChange={e => {
                  updateForm("title", e.target.value);
                  if (!editing) updateForm("slug", toSlug(e.target.value));
                }} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">URL slug<Input value={form.slug} onChange={e => updateForm("slug", toSlug(e.target.value))} /></label>
              <label className="grid gap-1.5 text-sm font-medium">Status
                <select value={form.status} onChange={e => updateForm("status", e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Description<Textarea value={form.description} onChange={e => updateForm("description", e.target.value)} /></label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                Banner image
                <input type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm"
                  onChange={e => uploadBanner(e.target.files?.[0])} disabled={uploadingBanner} />
                {form.image_url && <img src={form.image_url} alt="Preview" className="mt-2 aspect-[16/5] w-full rounded-md object-cover" />}
              </label>
            </div>

            {/* Placements (multi-select) */}
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Placements</p>
              <div className="flex flex-wrap gap-2">
                {PLACEMENT_OPTIONS.map(p => (
                  <button key={p} type="button" onClick={() => togglePlacement(p)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                      form.selectedPlacements.includes(p)
                        ? "bg-[#111111] text-white border-[#111111] dark:bg-[#FAF5F2] dark:text-[#111111]"
                        : "bg-white text-[#888880] border-[#E8E8E8] hover:border-[#111111] dark:bg-[#1A1A1A] dark:border-[#333333]"
                    }`}>
                    {p.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Automatic collection toggle */}
            <div className="border-t pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_automatic}
                  onChange={e => updateForm("is_automatic", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300" />
                <div>
                  <p className="text-sm font-medium">Automatic collection</p>
                  <p className="text-xs text-muted-foreground">Products are matched automatically based on rules instead of manual selection.</p>
                </div>
              </label>
            </div>

            {/* Rules for automatic collections */}
            {form.is_automatic && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Collection Rules</p>
                  <Button type="button" size="sm" variant="outline" onClick={addRule}>
                    <Plus className="h-3 w-3 mr-1" /> Add rule
                  </Button>
                </div>
                {form.rules.length === 0 && (
                  <p className="text-xs text-muted-foreground">No rules yet. Add rules to automatically match products.</p>
                )}
                <div className="space-y-2">
                  {form.rules.map((rule, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <select value={rule.field} onChange={e => updateRule(index, "field", e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm flex-1">
                        {RULE_FIELD_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <Input value={rule.value} onChange={e => updateRule(index, "value", e.target.value)}
                        placeholder="Value" className="flex-1 h-9 text-sm" />
                      <Button type="button" size="icon" variant="ghost" className="text-destructive h-9 w-9"
                        onClick={() => removeRule(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual product picker */}
            {!form.is_automatic && (
              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">Products in this collection</p>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" value={productSearch}
                    onChange={e => setProductSearch(e.target.value)} placeholder="Search products to add" />
                </div>
                {results.length > 0 && (
                  <div className="mt-2 rounded-md border">
                    {results.map(product => (
                      <button key={product.id} type="button"
                        onClick={() => {
                          if (!selectedProducts.some(item => item.id === product.id))
                            setSelectedProducts(items => [...items, product]);
                          setProductSearch(""); setResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                        {product.title}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedProducts.map(product => (
                    <Badge key={product.id} variant="secondary" className="gap-1 py-1">
                      <span className="max-w-48 truncate">{product.title}</span>
                      <button type="button" onClick={() => setSelectedProducts(items => items.filter(item => item.id !== product.id))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Hero slider settings */}
            <div className="border-t pt-4">
              <label className="flex items-center gap-3 cursor-pointer mb-4">
                <input type="checkbox" checked={form.hero_enabled}
                  onChange={e => updateForm("hero_enabled", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300" />
                <p className="text-sm font-medium">Show as Hero Slide</p>
              </label>

              {form.hero_enabled && (
                <div className="grid gap-4 sm:grid-cols-3 pl-7">
                  <label className="grid gap-1.5 text-sm font-medium">
                    Hero Order
                    <Input type="number" value={form.hero_order}
                      onChange={e => updateForm("hero_order", e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Overlay Opacity (0–1)
                    <Input type="number" min="0" max="1" step="0.05" value={form.hero_overlay_opacity}
                      onChange={e => updateForm("hero_overlay_opacity", e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Auto Rotate (ms)
                    <Input type="number" min="2000" step="500" value={form.hero_auto_rotate_duration}
                      onChange={e => updateForm("hero_auto_rotate_duration", e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Hero Badge
                    <Input value={form.hero_badge}
                      onChange={e => updateForm("hero_badge", e.target.value)} />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    CTA Link
                    <Input value={form.hero_cta_link}
                      onChange={e => updateForm("hero_cta_link", e.target.value)} />
                  </label>
                </div>
              )}
            </div>

            {/* Display settings */}
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">Display Settings</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.show_in_navigation}
                    onChange={e => updateForm("show_in_navigation", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300" />
                  <span className="text-sm">Show in Navigation</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.show_on_homepage}
                    onChange={e => updateForm("show_on_homepage", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300" />
                  <span className="text-sm">Show on Homepage</span>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Display Order
                  <Input type="number" value={form.display_order}
                    onChange={e => updateForm("display_order", e.target.value)} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Sort Order
                  <Input type="number" value={form.sort_order}
                    onChange={e => updateForm("sort_order", e.target.value)} />
                </label>
              </div>
            </div>

            {/* SEO */}
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">SEO & Meta</p>
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-medium">
                  Meta Title
                  <Input value={form.meta_title} onChange={e => updateForm("meta_title", e.target.value)} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Meta Description
                  <Textarea value={form.meta_description} onChange={e => updateForm("meta_description", e.target.value)} />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Meta Keywords
                  <Input value={form.meta_keywords} onChange={e => updateForm("meta_keywords", e.target.value)} />
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving || uploadingBanner}>
                {saving ? "Saving…" : uploadingBanner ? "Uploading banner…" : editing ? "Update collection" : "Save collection"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}