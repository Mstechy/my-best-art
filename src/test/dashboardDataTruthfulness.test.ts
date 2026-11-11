import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("dashboard data truthfulness", () => {
  it("uses authoritative seller order counts and exposes query failures", () => {
    const hook = read("src/hooks/useSellerDashboard.ts");
    const dashboard = read("src/pages/seller/SellerDashboard.tsx");

    expect(hook).toContain("useSellerOrderCounts(userId)");
    expect(hook).toContain('seller_dashboard_summary');
    expect(hook).toContain('.limit(100)');
    expect(hook).toContain("orderCounts.data?.byStatus.pending ?? 0");
    expect(hook).toContain("summary RPC is an optimization");
    expect(hook).not.toContain("summary.error ?? pendingApproval.error");
    expect(hook).toContain("if (error) throw error;");
    expect(dashboard).toContain("dashboardError");
    expect(dashboard).toContain("Seller dashboard unavailable");
  });

  it("uses a protected delivered-sales aggregate for admin top products", () => {
    const analytics = read("src/pages/admin/AdminAnalytics.tsx");
    const migration = read("supabase/migrations/20261020001000_admin_analytics_aggregates.sql");

    expect(analytics).toContain('"admin_top_products"');
    expect(analytics).not.toContain('from("order_items").select("quantity, products(title)").limit(500)');
    expect(analytics).toContain("Analytics unavailable");
    expect(migration).toContain("o.status = 'delivered'::order_status");
    expect(migration).toContain("Admin access required");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.admin_top_products(integer) TO authenticated");
  });

  it("does not turn admin queue/query failures into an empty success state", () => {
    const dashboard = read("src/pages/admin/AdminDashboard.tsx");
    const queue = read("src/components/admin/AdminOperationsQueue.tsx");

    expect(dashboard).toContain("dashboardError");
    expect(dashboard).toContain("Platform totals could not be loaded");
    expect(queue).toContain("Some operations could not be loaded");
    expect(queue).toContain("role=\"alert\"");
  });

  it("bounds dashboard history reads and selects only fields needed by the views", () => {
    const adminOrders = read("src/pages/admin/AdminOrders.tsx");
    const adminDisputes = read("src/pages/admin/AdminDisputes.tsx");
    const buyerOrders = read("src/pages/buyer/BuyerOrders.tsx");
    const buyerTracking = read("src/pages/buyer/BuyerTracking.tsx");
    const buyerReports = read("src/pages/buyer/BuyerReports.tsx");
    const wishlist = read("src/pages/buyer/BuyerWishlist.tsx");

    for (const source of [adminOrders, adminDisputes, buyerOrders, buyerTracking, buyerReports, wishlist]) {
      expect(source).toContain(".limit(");
      expect(source).not.toContain('.select("*")');
    }
  });
});
