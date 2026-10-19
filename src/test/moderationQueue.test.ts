import { describe, expect, it } from "vitest";
import { buildProductModerationQueue, formatModerationAge, toProductModerationItem, type ProductModerationRecord } from "@/lib/moderationQueue";

const product = (overrides: Partial<ProductModerationRecord> = {}): ProductModerationRecord => ({
  id: "product-1",
  title: "Wireless headphones",
  status: "active",
  is_approved: false,
  created_at: "2026-10-19T08:00:00.000Z",
  updated_at: "2026-10-19T08:30:00.000Z",
  ...overrides,
});

describe("product moderation queue", () => {
  it("shows the seller what happens while a listing waits for review", () => {
    expect(toProductModerationItem(product())).toMatchObject({
      state: "waiting",
      ownerLabel: "Tradibu moderation",
      reason: "Your listing is in the approval queue.",
    });
  });

  it("shows a seller-owned next action when admin requests changes", () => {
    expect(toProductModerationItem(product({
      status: "draft",
      moderation_reason: "Add a clear photo of the product label.",
      moderation_next_action: "Upload the label photo and submit again.",
      moderation_updated_at: "2026-10-19T09:00:00.000Z",
    }))).toMatchObject({
      state: "changes_requested",
      ownerLabel: "You",
      reason: "Add a clear photo of the product label.",
      nextAction: "Upload the label photo and submit again.",
    });
  });

  it("does not put ordinary drafts into the moderation queue", () => {
    expect(toProductModerationItem(product({ status: "draft" }))).toBeNull();
  });

  it("sorts the oldest waiting listing first and formats its age", () => {
    const now = new Date("2026-10-19T12:00:00.000Z");
    const queue = buildProductModerationQueue([
      product({ id: "newer", moderation_updated_at: "2026-10-19T11:00:00.000Z" }),
      product({ id: "older", moderation_updated_at: "2026-10-19T08:00:00.000Z" }),
    ]);
    expect(queue.map((item) => item.id)).toEqual(["older", "newer"]);
    expect(formatModerationAge(queue[0].waitingSince, now)).toBe("4h waiting");
  });
});
