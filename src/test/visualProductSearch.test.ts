import { describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import { analyzeVisualProductImage } from "@/lib/visualProductSearch";

describe("visual product search", () => {
  it("normalizes vision terms generated from the uploaded image", async () => {
    invoke.mockResolvedValueOnce({
      data: { search: "black leather handbag", category: "FASHION", confidence: "high" },
      error: null,
    });

    await expect(analyzeVisualProductImage("data:image/jpeg;base64,abc")).resolves.toEqual({
      search: "black leather handbag",
      category: "fashion",
      confidence: "high",
    });
    expect(invoke).toHaveBeenCalledWith("visual-product-search", {
      body: { imageDataUrl: "data:image/jpeg;base64,abc" },
    });
  });

  it("fails clearly when the vision service returns no searchable terms", async () => {
    invoke.mockResolvedValueOnce({ data: { search: "" }, error: null });

    await expect(analyzeVisualProductImage("data:image/jpeg;base64,abc")).rejects.toThrow(
      "The image did not contain a searchable product.",
    );
  });
});
