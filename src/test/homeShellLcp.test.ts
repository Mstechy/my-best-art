import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DEFAULT_HERO_IMAGE_URL, getHeroImageSources } from "@/lib/heroImages";

/**
 * Regression guards for the homepage shell's LCP plumbing - the two ways the
 * field audits have already caught it breaking:
 *
 *   1. Connection hints arriving late. The Oct 2026 report still found
 *      fonts.googleapis.com creating its connection at request time even though
 *      the head carried a preconnect for it, so the hints moved to the very top
 *      of <head>. This pins the SHAPE that makes them work: exactly one hint per
 *      origin (duplicates were never the fix), each with the crossorigin mode
 *      that matches how the resource is actually fetched, ordered before every
 *      fetchable resource.
 *
 *   2. The preload and the <picture> disagreeing about which file to fetch.
 *      A previous imagesrcset + imagesizes="100vw" rule resolved to a different
 *      file than the <source> on high-DPR phones: two downloads, neither reused,
 *      and the LCP request stayed attributed to the JS bundle. The candidate
 *      lists are now asserted byte-for-byte against src/lib/heroImages.ts (the
 *      single source of truth both sides read from), and every candidate is
 *      asserted to exist on disk so a renamed asset cannot silently 404 the LCP.
 */

/** The real shell, comments stripped so prose about <link> cannot match as markup. */
const shell = readFileSync(path.join(process.cwd(), "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");

const linkTags = (html: string): string[] => html.match(/<link\b[^>]*>/g) ?? [];
const preconnects = linkTags(shell).filter((tag) => /rel="preconnect"/.test(tag));
const imagePreloads = linkTags(shell).filter((tag) => /rel="preload"/.test(tag) && /as="image"/.test(tag));

const sources = getHeroImageSources(DEFAULT_HERO_IMAGE_URL);

describe("homepage shell LCP plumbing", () => {
  it("carries exactly one preconnect per origin, ahead of every fetchable resource", () => {
    const hrefs = preconnects.map((tag) => /href="([^"]+)"/.exec(tag)?.[1]);
    expect(hrefs.sort()).toEqual([
      "https://bnkyddmmhaaefzfvzpqs.supabase.co",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ]);
    // One hint per origin: a second one adds nothing but another thing to keep
    // in sync (the user-visible failure mode of "duplicate link errors").
    expect(new Set(hrefs).size).toBe(hrefs.length);

    // The crossorigin mode has to match how each origin is fetched or the socket
    // cannot be reused: font files are CORS requests, the fonts stylesheet and
    // the Supabase REST calls are no-cors / CORS respectively.
    expect(shell).toContain('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />');
    expect(shell).toContain('<link rel="preconnect" href="https://bnkyddmmhaaefzfvzpqs.supabase.co" crossorigin="anonymous" />');
    expect(shell).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />');

    // Earliest possible position: before the image preloads and before the font
    // stylesheet, so the sockets are already opening while those are scanned.
    const fontsAt = shell.indexOf('href="https://fonts.googleapis.com" />');
    expect(fontsAt).toBeGreaterThan(-1);
    expect(shell.indexOf('rel="preload"')).toBeGreaterThan(fontsAt);
    expect(shell.indexOf("fonts.googleapis.com/css2")).toBeGreaterThan(fontsAt);
  });

  it("preloads byte-for-byte the candidate list the <picture> selects from", () => {
    expect(sources.mobileSrcSet).toBeDefined();
    expect(sources.mobileSrc).toBeDefined();

    // Exactly one preload per media band - never two preloads naming different
    // files for the same viewport, which is the double-download bug itself.
    expect(imagePreloads).toHaveLength(2);

    const mobile = imagePreloads.find((tag) => /media="\(max-width: 640px\)"/.test(tag));
    expect(mobile, "mobile preload present").toBeDefined();
    expect(mobile).toContain(`imagesrcset="${sources.mobileSrcSet}"`);
    // href stays as the fallback for UAs without imagesrcset support; it must
    // name a real candidate of that same list, not a third file.
    expect(mobile).toContain(`href="${sources.mobileSrc}"`);

    const desktop = imagePreloads.find((tag) => /media="\(min-width: 641px\)"/.test(tag));
    expect(desktop, "desktop preload present").toBeDefined();
    expect(desktop).toContain(`href="${sources.src}"`);

    // Both preloads fetch with priority - the LCP request must not queue.
    for (const tag of imagePreloads) expect(tag).toContain('fetchpriority="high"');
  });

  it("ships every candidate file the shell and the <picture> name", () => {
    const candidateUrls = new Set<string>([
      sources.src,
      ...(sources.mobileSrc ? [sources.mobileSrc] : []),
      ...(sources.mobileSrcSet ?? "").split(",").map((candidate) => candidate.trim().split(" ")[0]),
    ]);
    candidateUrls.delete("");
    expect(candidateUrls.size).toBeGreaterThanOrEqual(3);
    for (const url of candidateUrls) {
      const onDisk = path.join(process.cwd(), "public", url);
      expect(existsSync(onDisk), `${url} must exist under public/`).toBe(true);
    }
  });
});