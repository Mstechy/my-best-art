import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guards `vercel.json` against a routing regression that took every deep link on
 * the site off the air while the homepage and the prerendered product pages kept
 * working, which is what made it look like a stale-search-result problem.
 *
 * `cleanUrls: true` is required here: the product prerender writes
 * `product/<id>.html` and depends on Vercel serving it from the extensionless
 * `/product/<id>` that the sitemap and every internal link point at.
 *
 * The trap is that `cleanUrls` strips `.html` from REWRITE DESTINATIONS as well
 * as from request paths. Pointing the SPA catch-all at `/index.html` therefore
 * resolved to a path that does not exist, and Vercel answered with its plain-text
 * platform 404 for every client route that had no prerendered file - /terms,
 * /privacy, /about, /marketplace, /categories, /seller/<id>. The shell was never
 * served, so React Router never booted: the live `/terms` returned a 79-byte
 * `text/plain` 404 instead of the ~11 KB app shell, which is a hard HTTP 404 and
 * not the app's own NotFound page. Only `/` and the prerendered product pages
 * survived, because those are real files that cleanUrls resolves by itself.
 *
 * The destination must therefore be the clean-URL form, `/index`.
 */
const configPath = path.join(process.cwd(), "vercel.json");
const config = JSON.parse(readFileSync(configPath, "utf8")) as {
  cleanUrls?: boolean;
  rewrites?: { source: string; destination: string }[];
};
const rewrites = config.rewrites ?? [];

describe("vercel.json routing", () => {
  it("keeps cleanUrls on, because the prerendered product pages are served through it", () => {
    expect(config.cleanUrls).toBe(true);
  });

  it("keeps the SPA catch-all on the clean-URL form of the shell", () => {
    const catchAll = rewrites.find((rule) => rule.source === "/(.*)");
    expect(catchAll).toBeDefined();
    expect(catchAll?.destination).toBe("/index");
  });

  // The regression itself. Written as a rule rather than one expected value, so a
  // future rewrite (an app-shell variant for a single route, say) cannot quietly
  // reintroduce the same trap.
  it("points every rewrite destination at a path that survives cleanUrls", () => {
    const htmlDestinations = rewrites
      .map((rule) => rule.destination)
      .filter((destination) => destination.endsWith(".html"));
    expect(htmlDestinations).toEqual([]);
  });

  // Rewrites are evaluated in order and the first match wins, so a catch-all
  // placed above the sitemap rule would serve the app shell at
  // /sitemap-products.xml and take the product sitemap off the air.
  it("keeps the catch-all after the specific rewrites", () => {
    expect(rewrites.findIndex((rule) => rule.source === "/(.*)")).toBe(rewrites.length - 1);
  });
});
