/**
 * Guards for the header parser behind the masonry feed's reserved boxes.
 *
 * The stakes: every card's height is `columnWidth / ratio`. A parser that returns a
 * wrong ratio does not throw - it silently reserves the wrong height, so the feed
 * re-flows when the image arrives, which is the exact defect the whole feature
 * exists to prevent. So each format is pinned with a hand-built header whose
 * dimensions are known by construction.
 */
import { describe, expect, it } from "vitest";

import {
  clampDisplayAspectRatio,
  clampDisplayAspectRatioOf,
  FALLBACK_ASPECT_RATIO,
  normalizeImageDimensions,
  parseImageDimensions,
  tileHeightForWidth,
} from "@/lib/imageHeaders";

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

/** PNG: signature, then IHDR with the width and height as big-endian 32-bit. */
function pngHeader(width: number, height: number): Uint8Array {
  const header = new Uint8Array(24);
  header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  header.set([0, 0, 0, 13], 8);
  header.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  new DataView(header.buffer).setUint32(16, width);
  new DataView(header.buffer).setUint32(20, height);
  return header;
}

/** JPEG: SOI, one decoy segment, then SOF0 carrying the height and width. */
function jpegHeader(width: number, height: number, decoySegmentBytes = 0): Uint8Array {
  const decoy = new Uint8Array(4 + decoySegmentBytes);
  decoy.set([0xff, 0xe0], 0); // APP0
  decoy.set([0x00, 0x02 + decoySegmentBytes], 2); // segment length
  const sof = new Uint8Array(11);
  sof.set([0xff, 0xc0], 0); // SOF0
  sof.set([0x00, 0x0b], 2); // segment length
  sof[4] = 8; // sample precision
  sof[5] = (height >> 8) & 0xff;
  sof[6] = height & 0xff;
  sof[7] = (width >> 8) & 0xff;
  sof[8] = width & 0xff;
  return new Uint8Array([0xff, 0xd8, ...decoy, ...sof]);
}

/** WebP: RIFF....WEBP then the variant-specific header. */
function webpLossy(width: number, height: number): Uint8Array {
  const header = new Uint8Array(30);
  header.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  header.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  header.set([0x56, 0x50, 0x38, 0x20], 12); // "VP8 "
  header.set([0x9d, 0x01, 0x2a], 23); // start code
  header[26] = width & 0xff;
  header[27] = (width >> 8) & 0xff;
  header[28] = height & 0xff;
  header[29] = (height >> 8) & 0xff;
  return header;
}

function webpLossless(width: number, height: number): Uint8Array {
  const header = new Uint8Array(30);
  header.set([0x52, 0x49, 0x46, 0x46], 0);
  header.set([0x57, 0x45, 0x42, 0x50], 8);
  header.set([0x56, 0x50, 0x38, 0x4c], 12); // "VP8L"
  header[20] = 0x2f;
  const packed = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  new DataView(header.buffer).setUint32(21, packed, true);
  return header;
}

function webpExtended(width: number, height: number): Uint8Array {
  const header = new Uint8Array(30);
  header.set([0x52, 0x49, 0x46, 0x46], 0);
  header.set([0x57, 0x45, 0x42, 0x50], 8);
  header.set([0x56, 0x50, 0x38, 0x58], 12); // "VP8X"
  for (let index = 0; index < 3; index += 1) {
    header[24 + index] = ((width - 1) >> (index * 8)) & 0xff;
    header[27 + index] = ((height - 1) >> (index * 8)) & 0xff;
  }
  return header;
}

function gifHeader(width: number, height: number): Uint8Array {
  const header = new Uint8Array(10);
  header.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0); // GIF89a
  header[6] = width & 0xff;
  header[7] = (width >> 8) & 0xff;
  header[8] = height & 0xff;
  header[9] = (height >> 8) & 0xff;
  return header;
}

describe("parseImageDimensions", () => {
  it("reads a square PNG", () => {
    expect(parseImageDimensions(pngHeader(800, 800))).toEqual({ width: 800, height: 800 });
  });

  it("reads a tall PNG, which is the ratio the feed actually reserves", () => {
    expect(parseImageDimensions(pngHeader(1200, 1600))).toEqual({ width: 1200, height: 1600 });
  });

  it("reads the frame header of a JPEG past its metadata segments", () => {
    // A phone photo carries kilobytes of EXIF before the frame header, so a parser
    // that assumed a fixed offset would report the wrong size for exactly the
    // uploads that matter most.
    expect(parseImageDimensions(jpegHeader(1024, 768, 4000))).toEqual({ width: 1024, height: 768 });
  });

  it("reads all three WebP containers", () => {
    expect(parseImageDimensions(webpLossy(640, 480))).toEqual({ width: 640, height: 480 });
    expect(parseImageDimensions(webpLossless(500, 1000))).toEqual({ width: 500, height: 1000 });
    expect(parseImageDimensions(webpExtended(3000, 2000))).toEqual({ width: 3000, height: 2000 });
  });

  it("reads a GIF", () => {
    expect(parseImageDimensions(gifHeader(320, 240))).toEqual({ width: 320, height: 240 });
  });

  it("accepts an ArrayBuffer, which is what the backfill's fetch returns", () => {
    const header = pngHeader(900, 1200);
    expect(parseImageDimensions(header.buffer)).toEqual({ width: 900, height: 1200 });
  });

  it("returns null for input that is not an image", () => {
    expect(parseImageDimensions(bytes(0, 1, 2, 3, 4, 5, 6, 7, 8, 9))).toBeNull();
    expect(parseImageDimensions(new Uint8Array(0))).toBeNull();
    // A truncated header is exactly what a short ranged read can produce.
    expect(parseImageDimensions(pngHeader(800, 800).slice(0, 18))).toBeNull();
  });

  it("returns null when a JPEG's frame header falls outside the bytes provided", () => {
    const full = jpegHeader(1024, 768, 4000);
    expect(parseImageDimensions(full.slice(0, 200))).toBeNull();
  });
});

describe("normalizeImageDimensions", () => {
  it("treats a missing or zero dimension as unknown rather than as a size", () => {
    expect(normalizeImageDimensions(0, 100)).toBeNull();
    expect(normalizeImageDimensions(100, null)).toBeNull();
    expect(normalizeImageDimensions(undefined, undefined)).toBeNull();
    expect(normalizeImageDimensions(Number.NaN, 100)).toBeNull();
    expect(normalizeImageDimensions(-5, 100)).toBeNull();
  });

  it("rounds fractional values, because a stored half pixel is not a size", () => {
    expect(normalizeImageDimensions(800.4, 1199.6)).toEqual({ width: 800, height: 1200 });
  });
});

describe("clampDisplayAspectRatio", () => {
  it("falls back to 1:1 when the size is unknown", () => {
    expect(clampDisplayAspectRatio(null, null)).toBe(FALLBACK_ASPECT_RATIO);
    expect(clampDisplayAspectRatioOf(null)).toBe(FALLBACK_ASPECT_RATIO);
  });

  it("leaves a ratio inside the window untouched", () => {
    expect(clampDisplayAspectRatio(900, 1200)).toBeCloseTo(0.75, 5);
    expect(clampDisplayAspectRatio(1000, 1000)).toBeCloseTo(1, 5);
    expect(clampDisplayAspectRatio(850, 1000)).toBeCloseTo(0.85, 5);
  });

  it("clamps a panorama to the widest allowed ratio", () => {
    // 3000x800 is 3.75:1 unclamped - a letterbox strip stretched across a column.
    expect(clampDisplayAspectRatio(3000, 800)).toBe(1);
  });

  it("clamps a very tall screenshot to the tallest allowed ratio", () => {
    // 900x4000 is 0.225 unclamped - one tile that tall would push every other card
    // off the first screen of the feed.
    expect(clampDisplayAspectRatio(900, 4000)).toBe(0.75);
  });

  it("never returns a value outside [3:4, 1]", () => {
    const cases: [number, number][] = [
      [100, 100], [100, 400], [400, 100], [800, 1200], [1200, 800], [1, 10000], [10000, 1],
    ];
    for (const [width, height] of cases) {
      const ratio = clampDisplayAspectRatio(width, height);
      expect(ratio).toBeGreaterThanOrEqual(0.75);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });
});

describe("tileHeightForWidth", () => {
  it("is the image height a tile reserves at that column width", () => {
    expect(tileHeightForWidth(1, 300)).toBe(300);
    expect(tileHeightForWidth(0.75, 300)).toBe(400);
  });

  it("treats a nonsensical ratio as 1:1 rather than dividing by zero", () => {
    expect(tileHeightForWidth(0, 300)).toBe(300);
    expect(tileHeightForWidth(Number.NaN, 300)).toBe(300);
  });
});
