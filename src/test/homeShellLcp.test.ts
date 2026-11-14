import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { act } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { HOME_SHELL_END, HOME_SHELL_START, stripHomeShell } from "@/lib/htmlHead";
import { CORE_NAV_LINKS } from "@/lib/prerenderBody";

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
 *   2. The shell must preload only the bundled launch artwork. The live
 *      homepage query starts from the same verified artwork, so the preload is
 *      useful instead of causing a campaign image swap.
 */

/** The real shell, comments stripped so prose about <link> cannot match as markup. */
const shell = readFileSync(path.join(process.cwd(), "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");

const linkTags = (html: string): string[] => html.match(/<link\b[^>]*>/g) ?? [];
const preconnects = linkTags(shell).filter((tag) => /rel="preconnect"/.test(tag));
const imagePreloads = linkTags(shell).filter((tag) => /rel="preload"/.test(tag) && /as="image"/.test(tag));

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

    // Earliest possible position: before the font stylesheet, so the socket is
    // already opening while it is scanned.
    const fontsAt = shell.indexOf('href="https://fonts.googleapis.com" />');
    expect(fontsAt).toBeGreaterThan(-1);
    expect(imagePreloads).toHaveLength(2);
    expect(shell.indexOf("fonts.googleapis.com/css2")).toBeGreaterThan(fontsAt);
  });

  it("preloads the same verified launch artwork used by the live hero", () => {
    expect(shell).toContain('href="/images/electronics-products-1600x686.webp"');
    expect(shell).toContain('imagesrcset="/images/electronics-products-480x270.webp 1x, /images/electronics-products-960x540.webp 2x"');
  });
});

/**
 * The static first-paint shell: the landing page's above-the-fold DOM written
 * straight into index.html so FCP does not wait for the JS graph (it was ~5.2s
 * on a throttled phone with an empty `#root`).
 *
 * Three contracts are pinned here:
 *
 *  1. Placement. The shell sits between markers OUTSIDE `#root`, because the
 *     lazy landing route must not remove painted nodes during its first commit.
 *     LandingPage hides the fixed shell after mounting; the real root remains
 *     the only interactive tree.
 *
 *  2. Geometry. The mirrored navbar and hero box must match what
 *     `MarketplaceNavbar` and `HeroSlider`'s pending stage render in that first
 *     commit. A change to those components must change this file.
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

  it("sits outside #root, so React can mount without removing painted nodes", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(rawShell.split(HOME_SHELL_START).length - 1).toBe(1);
    expect(rawShell.split(HOME_SHELL_END).length - 1).toBe(1);
    const rootOpen = rawShell.indexOf('<div id="root"></div>');
    expect(rootOpen).toBeGreaterThan(-1);
    expect(rootOpen).toBeGreaterThan(end);
    // The mount point follows the shell, so stripping it leaves the root intact.
    expect(rawShell.slice(rootOpen, rootOpen + '<div id="root"></div>'.length)).toBe('<div id="root"></div>');

    const stripped = stripHomeShell(rawShell);
    expect(stripped).toContain('<div id="root"></div>');
    expect(stripped).not.toContain('id="first-paint-shell"');
    expect(stripped).not.toContain(HOME_SHELL_START);
    expect(stripHomeShell(stripped)).toBe(stripped);
  });
  it("mirrors the navbar height the first React commit paints", () => {
    expect(shellBody).toContain(
      '<nav class="sticky top-0 z-50 w-full border-b border-[#E8E8E8] bg-white/90 text-[#111111] backdrop-blur-md dark:border-[#222222] dark:bg-[#111111]/90 dark:text-[#FAF5F2] lg:min-h-[140px]">',
    );
    expect(shellBody).toContain('<div class="mx-auto max-w-7xl px-4 py-3 lg:px-8 lg:py-3">');
    // Below md the right side collapses to the hamburger (p-2.5 + h-5 = 40px),
    // then the mobile search field (h-11) stacks under the row.
    expect(shellBody).toContain('<div class="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-auto">');
    expect(shellBody).toContain('<div class="p-2.5 rounded-full">');
    expect(shellBody).toContain('<div class="p-2.5 rounded-full hidden md:inline-flex">');
    expect(shellBody).toContain('<div class="mt-3 lg:hidden">');
    expect(shellBody).toContain('class="h-11 w-full rounded-full border border-[#E8E8E8]');
    // At lg the compact desktop field drives the row.
    expect(shellBody).toContain('<div class="hidden flex-1 items-center justify-center px-1 lg:flex">');
    expect(shellBody).toContain('class="h-11 w-full border-0 bg-transparent');
  });

  it("mirrors the public hero-first geometry with the verified launch campaign", () => {
    expect(shellBody).toContain('<h1 class="sr-only">');
    expect(shellBody).toContain('<main class="flex flex-col pb-8">');
    expect(shellBody).toContain(
      '<div class="border-b border-[#E8E8E8] bg-[#F8F3F0] dark:border-[#222222] dark:bg-[#1C1C1E]">',
    );
    expect(shellBody).toContain('<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">');
    expect(shellBody).toContain('<div class="min-w-0">');
    expect(shellBody).toContain('<div class="min-w-0">');
    // HeroSlider's real artwork box: base aspect 16/9 floored at 220px on
    // phones, with the desktop 21/9 marketplace banner shape.
    expect(shellBody).toContain(
      'class="relative aspect-[16/9] min-h-[220px] w-full bg-[#1C1C1E] sm:min-h-[260px] md:aspect-[21/9] md:min-h-[320px] lg:min-h-[340px]"',
    );
    expect(shellBody).toContain("electronics-products-1600x686.webp");
    expect(shellBody).toContain("Shop collection");
  });
  it("states the same English copy the first React commit resolves from t()", () => {
    const en = JSON.parse(
      readFileSync(path.join(process.cwd(), "src/lib/i18n/locales/en.json"), "utf8"),
    ) as { home: { pageTitle: string }; nav: Record<string, string> };
    expect(shellBody).toContain(`<h1 class="sr-only">${en.home.pageTitle}</h1>`);
    for (const key of ["dailyDeals", "topSellers", "newDrops"]) {
      expect(shellBody, `nav.${key}`).toContain(`>${en.nav[key]}</a>`);
    }
    expect(shellBody).not.toContain("MarqueeBanner");
    expect(shellBody).not.toContain("animate-[marquee");
  });

  it("keeps the first-paint shell out of normal document flow", () => {
    expect(rawShell).toContain(".js #first-paint-shell { position: fixed; inset: 0; z-index: 10; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }");
    expect(shellBody).toContain('id="first-paint-shell" aria-hidden="true"');
  });

  it("links the crawl graph from the static homepage", () => {
    // Reported defect: Google indexed ~2 of ~130 pages. The static homepage
    // linked only to marketplace query-string URLs, so a crawler that never
    // executes JavaScript had no path from / to /categories, the legal pages or
    // anything deep. shellBody is the marker slice, so anything found here is
    // inside the shell - hidden after the real landing route mounts.
    expect(shellBody).toContain('<nav aria-label="Footer"');
    for (const link of CORE_NAV_LINKS) {
      expect(shellBody, link.href).toContain(`href="${link.href}"`);
    }
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

  it("keeps the shell outside React's mount point during the handoff", async () => {
    // The architecture, executed: mount a REAL root beside the shell markup.
    // The shell is fixed and hidden by LandingPage after the route mounts; it
    // must never become a second React tree or be cleared as part of root boot.
    const host = document.createElement("div");
    host.innerHTML = `${shellBody}<div id="root"></div>`;
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
      expect(host.querySelector("#first-paint-shell")).not.toBeNull();

      await act(async () => {
        root.unmount();
      });
      expect(host.querySelector("#first-paint-shell")).not.toBeNull();
    } finally {
      host.remove();
    }
  });
});
