import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CORE_NAV_LINKS, injectStaticBody } from "@/lib/prerenderBody";

/**
 * Guards for the static <body> the prerenderers inject into every prerendered
 * page (scripts/prerenderPublicPages.ts, scripts/prerenderProductPages.ts).
 *
 * The reported defect this fixes: ~130 pages served 200 with correct titles,
 * canonicals and `index,follow` - and a completely empty <body>. A crawler on
 * its first, HTML-only pass saw no heading, no copy, and, worst of all, no
 * links: the homepage linked only to marketplace query-string URLs and the
 * prerendered pages linked nowhere, so nothing deeper was reachable without
 * executing JavaScript. Search Console counted two indexed pages.
 *
 * The second contract here is what must NOT change: the homepage's
 * first-paint shell lives inside `#root` between markers, and injecting a
 * static body under it would stack a whole second page beneath the shell.
 */
const EMPTY = `<html><head><title>x</title></head><body><div id="root"></div></body></html>`;

describe("injectStaticBody", () => {
  it("fills an empty mount with heading, description and the core link graph", () => {
    const html = injectStaticBody(EMPTY, {
      heading: "Contact Tradibu",
      description: "Reach the team & support.",
    });
    expect(html).toContain(">Contact Tradibu</h1>");
    expect(html).toContain("<p>Reach the team &amp; support.</p>");
    expect(html).toContain('id="root"><div id="static-prerendered">');
    expect(html).not.toContain('<div id="root"></div>');
    for (const link of CORE_NAV_LINKS) {
      expect(html, link.href).toContain(
        `<li><a href="${link.href}">${link.label.replace(/&/g, "&amp;")}</a></li>`,
      );
    }
  });

  it("omits the paragraph when the route has no description", () => {
    const html = injectStaticBody(EMPTY, { heading: "Marketplace" });
    expect(html).toContain(">Marketplace</h1>");
    expect(html).not.toContain("<p>");
  });

  it("appends route-specific links after the core nav, de-duplicated by href", () => {
    const html = injectStaticBody(EMPTY, {
      heading: "Find products by department",
      links: [
        { href: "/categories/electronics", label: "Electronics" },
        // Same href as the core entry: first occurrence wins, so the core
        // label stands and the href never appears twice in one document.
        { href: "/marketplace", label: "Marketplace again" },
      ],
    });
    expect(html).toContain('<li><a href="/categories/electronics">Electronics</a></li>');
    expect(html).toContain(">Marketplace</a>");
    expect(html).not.toContain("Marketplace again");
    expect(html.match(/href="\/marketplace"/g)?.length).toBe(1);
  });

  it("leaves the homepage shell and any non-empty root untouched (and is idempotent)", () => {
    const shellDoc =
      `<html><body><div id="root"><!--tradibu:home-shell:start-->` +
      `<div id="first-paint-shell" aria-hidden="true"></div>` +
      `<!--tradibu:home-shell:end--></div></body></html>`;
    expect(injectStaticBody(shellDoc, { heading: "Home" })).toBe(shellDoc);

    const once = injectStaticBody(EMPTY, { heading: "Terms of Service" });
    expect(injectStaticBody(once, { heading: "Something else" })).toBe(once);
  });

  it("escapes heading, description, href and label before they reach the HTML", () => {
    const html = injectStaticBody(EMPTY, {
      heading: `<script>alert("x")</script> & "more"`,
      description: "5 < 6 & 7 > 6",
      links: [{ href: "/x?a=1&b=2", label: `<img src=x>` }],
    });
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;more&quot;");
    expect(html).toContain("5 &lt; 6 &amp; 7 &gt; 6");
    expect(html).toContain('href="/x?a=1&amp;b=2"');
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toMatch(/<img[^>]*src=x/);
  });

  it("keeps CORE_NAV_LINKS inside the pages public/sitemap-pages.xml submits", () => {
    // Link graph and submitted index must describe the same site: a core link
    // pointing at an unsubmitted or nonexistent URL wastes crawl budget the
    // indexing problem cannot afford.
    const sitemap = readFileSync(path.join(process.cwd(), "public/sitemap-pages.xml"), "utf8");
    for (const link of CORE_NAV_LINKS) {
      expect(sitemap, link.href).toContain(`<loc>https://www.tradibu.com${link.href}</loc>`);
    }
  });
});