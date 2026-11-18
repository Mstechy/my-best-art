import { describe, expect, it } from "vitest";
import { getProductTypesForCategory } from "@/lib/categoryConfig";

describe("wrist-watch listing taxonomy", () => {
  it("requires the buyer-facing comparison fields before publishing", () => {
    const watches = getProductTypesForCategory({ slug: "watches", name: "Watches" })
      .find((type) => type.key === "watches");

    expect(watches?.requiredFields).toEqual(expect.arrayContaining([
      "brand", "gender", "movement", "color", "condition",
    ]));
    expect(watches?.fields.find((field) => field.key === "movement")?.required).toBe(true);
  });
});
