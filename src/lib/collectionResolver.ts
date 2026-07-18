import { supabase } from "@/integrations/supabase/client";

/**
 * Collection rule types for automatic product matching.
 */
export type CollectionRuleField =
  | "category_id"
  | "subcategory"
  | "brand"
  | "min_price"
  | "max_price"
  | "min_discount"
  | "min_rating"
  | "max_rating"
  | "is_featured"
  | "is_best_seller"
  | "is_trending"
  | "is_new_arrival"
  | "is_flash_sale"
  | "is_popular"
  | "condition"
  | "created_within_days"
  | "min_stock"
  | "max_stock"
  | "tag"
  | "color"
  | "material";

export type CollectionRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal"
  | "between"
  | "in"
  | "not_in";

export interface CollectionRule {
  id?: string;
  collection_id?: string;
  field: CollectionRuleField;
  operator: CollectionRuleOperator;
  value: string;
  value_min?: string;
  value_max?: string;
  sort_order?: number;
}

export interface CollectionHero {
  enabled: boolean;
  order: number;
  overlay_opacity: number;
  auto_rotate_duration: number;
  badge?: string;
  cta_link?: string;
}

export interface CollectionSEO {
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
}

export interface CollectionDisplay {
  show_in_navigation: boolean;
  show_on_homepage: boolean;
  display_order: number;
  priority: number;
}

export interface EnhancedCollection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  badge: string | null;
  cta_label: string;
  placement: string;
  placements: string[];
  status: string;
  sort_order: number;
  is_automatic: boolean;
  rules: Record<string, string> | null;
  hero_enabled: boolean;
  hero_order: number;
  hero_overlay_opacity: number;
  hero_auto_rotate_duration: number;
  hero_badge: string | null;
  hero_cta_link: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  show_in_navigation: boolean;
  show_on_homepage: boolean;
  display_order: number;
  priority: number;
  product_count: number;
  view_count: number;
  click_count: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

/**
 * Fetch hero-enabled collections for the homepage slider.
 * Uses `as any` cast because supabase types don't reflect new columns yet.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchHeroCollections(): Promise<EnhancedCollection[]> {
  const { data } = await (supabase
    .from("marketplace_collections") as any)
    .select("*")
    .is("seller_id", null)
    .eq("status", "active")
    .eq("hero_enabled", true)
    .order("hero_order")
    .order("sort_order");

  return ((data || []) as EnhancedCollection[]);
}

/**
 * Fetch collections for a specific placement.
 */
export async function fetchCollectionsByPlacement(
  placement: string,
  limit = 20
): Promise<EnhancedCollection[]> {
  const { data } = await (supabase
    .from("marketplace_collections") as any)
    .select("*")
    .is("seller_id", null)
    .eq("status", "active")
    .order("sort_order")
    .limit(limit);

  // Filter by placement (supports both old single and new multi-placement)
  return ((data || []) as EnhancedCollection[]).filter(
    (c) =>
      c.placement === placement ||
      c.placements?.includes(placement)
  );
}

/**
 * Fetch navigation collections (shown in navbar).
 */
export async function fetchNavigationCollections() {
  const { data } = await (supabase
    .from("marketplace_collections") as any)
    .select("title, slug")
    .is("seller_id", null)
    .eq("status", "active")
    .eq("show_in_navigation", true)
    .order("display_order")
    .order("sort_order");

  return (data || []) as { title: string; slug: string }[];
}

/**
 * Resolve products for a collection.
 * For automatic collections, uses the DB resolver function.
 * For manual collections, returns the existing product links.
 */
export async function resolveCollectionProducts(
  collectionId: string,
  limit = 100
): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "resolve_automatic_collection_products",
    {
      p_collection_id: collectionId,
      p_limit: limit,
    }
  );

  if (error) {
    console.error("[collectionResolver] RPC error:", error);
    return [];
  }

  const ids = (data || []).map((row: { product_id: string }) => row.product_id);
  console.log("[collectionResolver] Resolved products for", collectionId, ":", ids.length, "products");
  return ids;
}

/**
 * Build a rules JSON object from an array of rules for storage.
 */
export function buildRulesJson(rules: CollectionRule[]): Record<string, string> {
  const json: Record<string, string> = {};
  for (const rule of rules) {
    json[rule.field] = rule.value;
    if (rule.value_min) json[`${rule.field}_min`] = rule.value_min;
    if (rule.value_max) json[`${rule.field}_max`] = rule.value_max;
  }
  return json;
}

/**
 * Parse rules JSON into an array of rule objects for the UI.
 */
export function parseRulesFromJson(
  json: Record<string, string> | null
): CollectionRule[] {
  if (!json) return [];
  const rules: CollectionRule[] = [];
  const processed = new Set<string>();

  for (const [key, value] of Object.entries(json)) {
    // Skip min/max suffix keys (handled with their parent)
    if (key.endsWith("_min") || key.endsWith("_max")) continue;

    const field = key as CollectionRuleField;
    if (processed.has(field)) continue;
    processed.add(field);

    const rule: CollectionRule = {
      field,
      operator: "equals",
      value,
    };

    const minKey = `${field}_min`;
    const maxKey = `${field}_max`;
    if (minKey in json && maxKey in json) {
      rule.operator = "between";
      rule.value_min = json[minKey];
      rule.value_max = json[maxKey];
    }

    rules.push(rule);
  }

  return rules;
}

/**
 * Track a collection view (increments view_count).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function trackCollectionView(collectionId: string) {
  await (supabase
    .from("marketplace_collections") as any)
    .update({ view_count: (supabase.rpc as any)("increment", { x: 1 }) })
    .eq("id", collectionId);
}
