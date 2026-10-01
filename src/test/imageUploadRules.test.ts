/**
 * Guards for the vendor upload rules.
 *
 * Two claims are being pinned here:
 *
 *   * the HARD rules that must stop a publish - wrong format, too heavy, and the
 *     800px short side that a masonry tile cannot be filled from;
 *   * the SOFT rules that must NOT stop a publish - a crop outside the recommended
 *     3:4-1:1 window is a legitimate choice, and the feed cover-crops it safely.
 *
 * The second set matters as much as the first: a validator that refuses a real
 * product photo over a stylistic preference is a worse bug than a soft tile, because
 * it stops a seller trading.
 */
import { describe, expect, it } from "vitest";

import {
  checkImageUpload,
  imageFormatOf,
  MIN_UPLOAD_SHORT_SIDE,
  type ImageUploadCheckInput,
} from "@/lib/imageDimensions";
import { MAX_IMAGE_SIZE_BYTES } from "@/lib/sellerListing/listingForm";

const check = (overrides: Partial<ImageUploadCheckInput> = {}) =>
  checkImageUpload({
    width: 1200,
    height: 1600,
    bytes: 500_000,
    type: "image/jpeg",
    name: "photo.jpg",
    maxBytes: MAX_IMAGE_SIZE_BYTES,
    ...overrides,
  });

describe("imageFormatOf", () => {
  it("reads the extension, and the MIME type as the fallback", () => {
    expect(imageFormatOf("shot.WEBP", "")).toBe("webp");
    expect(imageFormatOf(undefined, "image/png")).toBe("png");
    // Browsers report "image/jpeg"; the stored format is always the short spelling.
    expect(imageFormatOf(undefined, "image/jpeg")).toBe("jpg");
  });

  it("rejects anything the marketplace does not publish", () => {
    expect(imageFormatOf("payload.exe", "application/octet-stream")).toBeNull();
    expect(imageFormatOf("photo.bmp", "image/bmp")).toBeNull();
  });
});

describe("checkImageUpload", () => {
  it("accepts a normal product photo", () => {
    const result = check();
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.format).toBe("jpg");
  });

  it("accepts a PNG and a WebP", () => {
    expect(check({ name: "a.png", type: "image/png" }).errors).toEqual([]);
    expect(check({ name: "a.webp", type: "image/webp" }).errors).toEqual([]);
  });

  it("rejects an unsupported format", () => {
    const result = check({ name: "vector.svg", type: "image/svg+xml" });
    expect(result.errors.join(" ")).toContain("JPG, PNG, or WebP");
  });

  it("rejects a photo under 800px on the SHORT side", () => {
    // 1600x600 is wide but its short side is 600, so a 3:4 crop cannot fill a tile.
    const result = check({ width: 1600, height: 600 });
    expect(result.errors.join(" ")).toContain(`${MIN_UPLOAD_SHORT_SIDE}px`);
  });

  it("accepts exactly the minimum short side", () => {
    expect(check({ width: 800, height: 2000 }).errors).toEqual([]);
    expect(check({ width: 2000, height: 800 }).errors).toEqual([]);
  });

  it("rejects a file over the byte ceiling", () => {
    const result = check({ bytes: MAX_IMAGE_SIZE_BYTES + 1 });
    expect(result.errors.join(" ")).toContain("10 MB");
  });

  it("warns about an unusual crop without blocking it", () => {
    const wide = check({ width: 4000, height: 900 });
    expect(wide.errors).toEqual([]);
    expect(wide.warnings.join(" ")).toContain("3:4 and 1:1");

    const tall = check({ width: 900, height: 4000 });
    expect(tall.errors).toEqual([]);
    expect(tall.warnings.length).toBeGreaterThan(0);
  });

  it("judges format and size even when the dimensions could not be read", () => {
    const unmeasurable = check({ width: null, height: null });
    expect(unmeasurable.errors).toEqual([]);
    const tooHeavy = check({ width: null, height: null, bytes: MAX_IMAGE_SIZE_BYTES * 2 });
    expect(tooHeavy.errors.length).toBe(1);
  });

  it("reports every problem at once rather than one at a time", () => {
    const result = check({ name: "clip.gif", type: "image/gif", width: 200, height: 200 });
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
