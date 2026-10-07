import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { act } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { HOME_SHELL_END, HOME_SHELL_START, stripHomeShell } from "@/lib/htmlHead";
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

/**
 * The static first-paint shell: the landing page's above-the-fold DOM written
 * straight into index.html so FCP does not wait for the JS graph (it was ~5.2s
 * on a throttled phone with an empty `#root`).
 *
 * Three contracts are pinned here:
 *
 *  1. Placement. The shell sits between markers INSIDE `#root`, because React
 *     18's createRoot().render() calls clearContainer() on its first commit -
 *     the shell must be something React is allowed to delete, so the swap needs
 *     no handoff script and cannot race. The last test proves that behavior
 *     against the real react-dom rather than asserting it in a comment.
 *
 *  2. Geometry. The mirrored navbar, promo band and hero box must match what
 *     `MarketplaceNavbar`, `MarqueeBanner` and `HeroSlider`'s pending stage
 *     render in that first commit - same classes, same order, same hero
 *     <picture> bytes - or the swap shifts layout and spends the CLS this shell
 *     exists to protect. A change to those components must change this file.
 *
 *  3. Reachability of `/`. Every other route is served this same document when
 *     no prerendered copy exists, so the in-shell guard has to drop it for any
 *     path that is not the homepage, and the markers must survive in the source
 *     so the prerenderers can strip it at build time too.
 */
describe("the first-paint shell", () => {
  // The module-level `shell` const strips HTML comments - which is exactly what
  // the shell's markers are - so this describe reads the document raw.
  const rawShell = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const start = rawShell.indexOf(HOME_SHELL_START);
  const end = rawShell.indexOf(HOME_SHELL_END);
  const shellBody = rawShell.slice(start, end + HOME_SHELL_END.length);

  it("sits between markers inside #root, so React's first commit wipes it for free", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(rawShell.split(HOME_SHELL_START).length - 1).toBe(1);
    expect(rawShell.split(HOME_SHELL_END).length - 1).toBe(1);
    const rootOpen = rawShell.indexOf('<div id="root">');
    expect(rootOpen).toBeGreaterThan(-1);
    expect(rootOpen).toBeLessThan(start);
    // Nothing but the closing tag follows the end marker inside #root, so a
    // stripped route ends up byte-identical to a shell-less document.
    expect(rawShell.slice(end + HOME_SHELL_END.length, end + HOME_SHELL_END.length + 6)).toBe("</div>");

    const stripped = stripHomeShell(rawShell);
    expect(stripped).toContain('<div id="root"></div>');
    expect(stripped).not.toContain("first-paint-shell");
    expect(stripped).not.toContain(HOME_SHELL_START);
    expect(stripHomeShell(stripped)).toBe(stripped);
  });
  it("mirrors the navbar height the first React commit paints", () => {
    expect(shellBody).toContain(
      '<nav class="sticky top-0 z-50 w-full border-b border-[#E8E8E8] bg-white/90 text-[#111111] backdrop-blur-md dark:border-[#222222] dark:bg-[#111111]/90 dark:text-[#FAF5F2]">',
    );
    expect(shellBody).toContain('<div class="mx-auto max-w-7xl px-4 py-3 lg:px-8 lg:py-4">');
    // Below md the right side collapses to the hamburger (p-2.5 + h-5 = 40px),
    // then the mobile search field (h-11) stacks under the row.
    expect(shellBody).toContain('<div class="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-auto">');
    expect(shellBody).toContain('<div class="p-2.5 rounded-full">');
    expect(shellBody).toContain('<div class="p-2.5 rounded-full hidden md:inline-flex">');
    expect(shellBody).toContain('<div class="mt-3 lg:hidden">');
    expect(shellBody).toContain('class="h-11 w-full rounded-full border border-[#E8E8E8]');
    // At lg the desktop form's 48px field inside its 1px border drives the row.
    expect(shellBody).toContain('<div class="hidden lg:flex flex-1 items-center justify-center px-2">');
    expect(shellBody).toContain('class="h-12 w-full border-0 bg-transparent');
  });

  it("mirrors the band and hero box with byte-for-byte the preloaded picture", () => {
    expect(shellBody).toContain('<h1 class="sr-only">');
    expect(shellBody).toContain('<main class="flex flex-col pb-8">');
    expect(shellBody).toContain(
      '<div class="border-b border-[#E8E8E8] bg-[#F8F3F0] dark:border-[#222222] dark:bg-[#1C1C1E]">',
    );
    expect(shellBody).toContain('<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">');
    expect(shellBody).toContain('<div class="grid grid-cols-1 lg:grid-cols-[260px_1fr_220px] gap-4">');
    expect(shellBody).toContain('<div class="min-w-0">');
    // HeroSlider's slides-container box: base aspect 16/9 floored at 240px on
    // phones - the box the swap must reproduce to the pixel.
    expect(shellBody).toContain(
      'class="relative aspect-[16/9] min-h-[240px] w-full sm:min-h-[280px] md:aspect-[21/9] md:min-h-[360px] lg:min-h-[440px]"',
    );
    // The picture must be the same request the head preloads - one download,
    // reused by both documents, so the swap repaints the identical box.
    expect(shellBody).toContain(
      `<source media="(max-width: 640px)" srcset="${sources.mobileSrcSet}" width="${sources.mobileWidth}" height="${sources.mobileHeight}" type="image/webp" />`,
    );
    expect(shellBody).toContain(
      `<img src="${sources.src}" width="${sources.width}" height="${sources.height}" alt="" class="h-full w-full object-cover opacity-100" loading="eager" fetchpriority="high" decoding="async" />`,
    );
  });
  it("states the same English copy the first React commit resolves from t()", () => {
    const en = JSON.parse(
      readFileSync(path.join(process.cwd(), "src/lib/i18n/locales/en.json"), "utf8"),
    ) as { home: { pageTitle: string }; nav: Record<string, string> };
    expect(shellBody).toContain(`<h1 class="sr-only">${en.home.pageTitle}</h1>`);
    for (const key of ["dailyDeals", "topSellers", "newDrops"]) {
      expect(shellBody, `nav.${key}`).toContain(`>${en.nav[key]}</a>`);
    }
    // MarqueeBanner's ITEMS are English literals, mirrored verbatim - and the
    // shell's track is frozen (React installs the animated one, starting at 0).
    for (const label of [
      "20% Off Summer Sale",
      "Hot Deals — Up to 50% Off",
      "Free Shipping on Orders $50+",
      "New Arrivals This Week",
      "Bundle &amp; Save 15%",
      "Gift Cards Now Available",
    ]) {
      expect(shellBody, label).toContain(label);
    }
    expect(shellBody).not.toContain("animate-[marquee");
  });

  it("drops itself on any path that is not the homepage", () => {
    // The guard lives between the markers, so the build-time strip removes it
    // along with the shell; in the browser it covers every non-prerendered path
    // served through the SPA fallback (a junk path must not flash the hero).
    const guardAt = rawShell.indexOf('getElementById("first-paint-shell")');
    expect(guardAt).toBeGreaterThan(start);
    expect(guardAt).toBeLessThan(end);
    expect(shellBody).toContain(
      'if (path !== "/" && path !== "/index.html") shell.parentNode.removeChild(shell)',
    );
  });

  it("keeps the placeholder out of the accessibility tree and the tab order", () => {
    expect(shellBody).toContain('<div id="first-paint-shell" aria-hidden="true"');
    const focusables = shellBody.match(/<(?:a|input)\b[^>]*>/g) ?? [];
    expect(focusables.length).toBeGreaterThanOrEqual(12);
    for (const tag of focusables) expect(tag).toContain('tabindex="-1"');
    // Interactive controls would need real handlers that do not exist yet.
    expect(shellBody).not.toContain("<button");
  });

  it("is wiped by React 18's first commit - the handoff needs no script", async () => {
    // The architecture, executed: mount a REAL root over the REAL shell markup
    // and watch clearContainer remove it in the same commit that inserts the
    // app. If React ever stopped clearing its container, the shell and the app
    // would stack, and this fails before any user sees the doubled page.
    const host = document.createElement("div");
    host.innerHTML = `<div id="root">${shellBody}</div>`;
    document.body.appendChild(host);
    const mountPoint = host.querySelector("#root");
    if (!mountPoint) throw new Error("fixture malformed");
    const root = createRoot(mountPoint);
    try {
      await act(async () => {
        root.render(createElement("p", { className: "real" }, "landing"));
      });
      expect(mountPoint.children.length).toBe(1);
      expect(mountPoint.textContent).toBe("landing");
      expect(mountPoint.innerHTML).not.toContain("first-paint-shell");

      // React never restores what clearContainer removed: the shell is
      // one-shot, which is why nothing outside this document may depend on it.
      await act(async () => {
        root.unmount();
      });
      expect(mountPoint.innerHTML).not.toContain("first-paint-shell");
    } finally {
      host.remove();
    }
  });
});