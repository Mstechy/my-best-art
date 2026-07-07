import { describe, it, expect } from "vitest";
import { extractProductRef } from "../components/ProductRefCard";

describe("extractProductRef", () => {
  const validUuid = "11111111-2222-3333-4444-555555555555";

  it("parses a valid product marker", () => {
    const r = extractProductRef(`Hi [product:${validUuid}]`);
    expect(r.productId).toBe(validUuid);
    expect(r.clean).toBe("Hi");
  });

  it("ignores malformed product UUID", () => {
    const r = extractProductRef("Hi [product:not-a-uuid]");
    expect(r.productId).toBeNull();
    expect(r.clean).toContain("[product:not-a-uuid]");
  });

  it("parses bounded offer prices", () => {
    expect(extractProductRef("[offer:99.99]").offerPrice).toBe(99.99);
    expect(extractProductRef("[offer:0]").offerPrice).toBeNull();
    expect(extractProductRef("[offer:1e9]").offerPrice).toBeNull();
    expect(extractProductRef("[offer:abc]").offerPrice).toBeNull();
  });

  it("parses order markers", () => {
    const r = extractProductRef(`Shipped [order:${validUuid}]`);
    expect(r.orderId).toBe(validUuid);
  });

  it("rejects unsafe attachment URLs", () => {
    const r = extractProductRef("look [attachment:http://evil.example/x.png]");
    expect(r.attachmentUrl).toBeNull();
  });

  it("leaves unknown brackets untouched", () => {
    const r = extractProductRef("Hello [random:thing]");
    expect(r.clean).toBe("Hello [random:thing]");
  });
});
