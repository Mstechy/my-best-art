/**
 * Regression guard for the product card derivative geometry.
 *
 * A real upload produced a 456 KB "optimised" 900px card from a 108 KB 800x800
 * original, because the canvas was always forced to the full target size - so a
 * source smaller than the target was scaled UP, adding no detail while the
 * encoder faithfully re-encoded the upscale at high quality. On mobile, where
 * every byte competes for a throttled connection, that single file was the
 * largest thing on the page.
 *
 * These tests pin the rule that prevents it: never upscale, and never emit a
 * canvas larger than the source needs.
 */
import { describe, expect, it } from "vitest";

import { computeCardDrawBox } from "@/lib/productImages";

const CARD_SIZE = 900;

describe("computeCardDrawBox", () => {
  it("keeps a source that is smaller than the target at its own size", () => {
    // The real 800x800 upload that produced the 456 KB card.
    const box = computeCardDrawBox(800, 800, CARD_SIZE);
    expect(box.outputSize).toBe(800);
    expect(box.width).toBe(800);
    expect(box.height).toBe(800);
  });

  it("never produces an output bigger than the source's longest edge", () => {
    const cases: [number, number][] = [
      [400, 300], [800, 800], [1024, 768], [320, 240], [1600, 1200], [5000, 5000],
    ];
    for (const [w, h] of cases) {
      const box = computeCardDrawBox(w, h, CARD_SIZE);
      expect(box.outputSize).toBeLessThanOrEqual(Math.min(CARD_SIZE, Math.max(w, h)));
    }
  });

  it("never scales above 1:1", () => {
    const box = computeCardDrawBox(800, 600, CARD_SIZE);
    expect(box.width).toBeLessThanOrEqual(800);
    expect(box.height).toBeLessThanOrEqual(600);
  });

  it("still downscales a large photo to the target", () => {
    // 3000x2000 cover-cropped into a 900 square: the width fills the target and
    // the height is cropped, so the drawn height is 900 * (2000/3000) = 600.
    const box = computeCardDrawBox(3000, 2000, CARD_SIZE);
    expect(box.outputSize).toBe(CARD_SIZE);
    expect(box.width).toBe(CARD_SIZE);
    expect(box.height).toBe(600);
    expect(box.x).toBe(0);
    expect(box.y).toBe(150);
  });

  it("cover-crops a landscape source by centring the overflow", () => {
    const box = computeCardDrawBox(1000, 500, CARD_SIZE);
    expect(box.outputSize).toBe(CARD_SIZE);
    expect(box.width).toBe(CARD_SIZE);
    expect(box.height).toBe(450);
    // 225px cropped from the top and bottom, split evenly.
    expect(box.y).toBe(225);
    expect(box.x).toBe(0);
  });

  it("centres a portrait source the same way", () => {
    const box = computeCardDrawBox(500, 1000, CARD_SIZE);
    expect(box.outputSize).toBe(CARD_SIZE);
    expect(box.width).toBe(450);
    expect(box.height).toBe(CARD_SIZE);
    expect(box.x).toBe(225);
    expect(box.y).toBe(0);
  });

  it("always emits a square canvas of at least one pixel", () => {
    const box = computeCardDrawBox(0, 0, CARD_SIZE);
    expect(box.outputSize).toBe(1);
    expect(box.width).toBe(1);
    expect(box.height).toBe(1);
  });
});
