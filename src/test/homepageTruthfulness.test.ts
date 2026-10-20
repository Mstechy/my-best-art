import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("homepage merchandising truthfulness", () => {
  it("does not render a flash-deal rail while the feed is unresolved or empty", () => {
    const landing = read("src/pages/LandingPage.tsx");
    expect(landing).toContain("{feeds.flash_deals.length > 0 && (");
    expect(landing).not.toContain("(loading || feeds.flash_deals.length > 0)");
  });

  it("routes deal navigation to the real flash-deal sort", () => {
    for (const file of [
      "index.html",
      "src/components/MarketplaceNavbar.tsx",
      "src/components/HomeHeader.tsx",
      "src/components/SiteFooter.tsx",
      "src/pages/LandingPage.tsx",
    ]) {
      const source = read(file);
      expect(source, file).not.toContain("promo=summer20");
      expect(source, file).not.toContain("promo=hot50");
    }
  });

  it("makes the database the authority for Flash Deal eligibility", () => {
    const migration = read("supabase/migrations/20261020000000_flash_deals_require_explicit_schedule.sql");
    expect(migration).toContain("p.flash_deal_status = 'active' AND now() BETWEEN p.flash_deal_start_at AND p.flash_deal_end_at");
    expect(migration).not.toContain("OR p.compare_at_price > p.price");
    expect(migration).not.toContain("OR compare_at_price > price");
  });

  it("does not let zero-signal snapshot rows become Best Sellers or Trending", () => {
    const snapshotMigration = read("supabase/migrations/20261020002000_homepage_sections_require_evidence.sql");
    const homepageHook = read("src/hooks/useHomepage.ts");
    expect(snapshotMigration).toContain("s.section <> 'best_sellers' OR coalesce(pm.delivered_units, 0) > 0");
    expect(snapshotMigration).toContain("s.section <> 'trending' OR coalesce(pm.discovery_events_30d, 0) > 0");
    expect(snapshotMigration).toContain("p_sort <> 'best_sellers' OR coalesce(pm.delivered_units, 0) > 0");
    expect(snapshotMigration).toContain("p_sort <> 'trending' OR coalesce(pm.discovery_events_30d, 0) > 0");
    expect(homepageHook).toContain('if (name === "best_sellers") return Number(item?.sold_count ?? 0) > 0;');
    expect(homepageHook).toContain('if (name === "trending") return Number(item?.trend_score ?? 0) > 0;');
  });
});
