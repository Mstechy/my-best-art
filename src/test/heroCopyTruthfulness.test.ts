import { describe, expect, it } from "vitest";
import { normalizeHeroCollectionCopy } from "@/lib/collectionResolver";
import { DEFAULT_HERO_COPY } from "@/lib/heroDefaults";
import type { EnhancedCollection } from "@/lib/collectionResolver";

const collection = (overrides: Partial<EnhancedCollection> = {}) => ({
  id: "hero-1",
  slug: "electronics-products",
  title: "Electronics products",
  description: "Discover products from independent sellers.",
  image_url: "/hero.webp",
  badge: "SHOP ELECTRONICS ON TRADIBU",
  cta_label: "Shop collection",
  placement: "homepage",
  placements: ["homepage"],
  status: "active",
  sort_order: 0,
  is_automatic: false,
  rules: null,
  hero_enabled: true,
  hero_order: 0,
  hero_overlay_opacity: 0.45,
  hero_auto_rotate_duration: 5000,
  hero_badge: "SHOP ELECTRONICS ON TRADIBU",
  hero_cta_link: null,
  meta_title: null,
  meta_description: null,
  meta_keywords: null,
  show_in_navigation: false,
  show_on_homepage: true,
  display_order: 0,
  priority: 0,
  product_count: 0,
  view_count: 0,
  click_count: 0,
  starts_at: null,
  ends_at: null,
  created_at: "2026-10-20T00:00:00.000Z",
  ...overrides,
}) as EnhancedCollection;

describe("hero campaign copy", () => {
  it("replaces known unsupported launch claims with the honest fallback", () => {
    const normalized = normalizeHeroCollectionCopy(collection({
      description: "Discover millions of products from trusted sellers around the world.",
      hero_badge: "FREE SHIPPING ON YOUR FIRST ORDER",
    }));

    expect(normalized.description).toBe(DEFAULT_HERO_COPY.description);
    expect(normalized.hero_badge).toBe(DEFAULT_HERO_COPY.badge);
  });

  it("preserves ordinary admin-managed campaign copy", () => {
    const normalized = normalizeHeroCollectionCopy(collection({
      title: "Weekend electronics deals",
      description: "Save on approved electronics from independent sellers.",
      hero_badge: "LIMITED DEALS",
    }));

    expect(normalized.title).toBe("Weekend electronics deals");
    expect(normalized.description).toBe("Save on approved electronics from independent sellers.");
    expect(normalized.hero_badge).toBe("LIMITED DEALS");
  });
});
