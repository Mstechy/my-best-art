import { describe, expect, it } from "vitest";
import { buildBuyerOrderTrackingUrl } from "@/lib/orderTracking";

describe("buildBuyerOrderTrackingUrl", () => {
  it("creates a same-site tracking URL that identifies the order", () => {
    expect(buildBuyerOrderTrackingUrl("order-123", "https://www.tradibu.com")).toBe(
      "https://www.tradibu.com/buyer/tracking?order=order-123",
    );
  });

  it("URL-encodes order identifiers", () => {
    expect(buildBuyerOrderTrackingUrl("order/with spaces", "https://www.tradibu.com")).toBe(
      "https://www.tradibu.com/buyer/tracking?order=order%2Fwith+spaces",
    );
  });
});
