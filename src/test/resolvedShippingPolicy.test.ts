import { describe, expect, it } from "vitest";
import { resolveShippingPolicy } from "@/hooks/useResolvedPolicies";

describe("resolveShippingPolicy", () => {
  it("does not present a generic shipping heading as a product-specific shipping policy", () => {
    expect(resolveShippingPolicy({ shipping_info: "Shipping Information" }, "product")).toBeNull();
  });

  it("uses a meaningful policy line instead of repeating its heading", () => {
    const policy = resolveShippingPolicy({
      shipping_terms: "Shipping Information\nSellers are responsible for shipping their own items.\n• Standard delivery: 3-7 business days",
    }, "platform");

    expect(policy?.summary).toBe("Sellers are responsible for shipping their own items.");
    expect(policy?.detail).toContain("Standard delivery: 3-7 business days");
  });

  it("summarizes known delivery cost, origin, and timing without inventing missing values", () => {
    const policy = resolveShippingPolicy({
      shipping_cost_amount: 0,
      ship_from_location: "Lagos, Nigeria",
      delivery_days_min: 3,
      delivery_days_max: 7,
    }, "seller");

    expect(policy?.summary).toBe("Free shipping · Ships from Lagos, Nigeria · Delivery 3–7 days");
    expect(resolveShippingPolicy({ delivery_days_min: 3 }, "seller")?.summary).toBe("Delivery 3 days");
  });
});
