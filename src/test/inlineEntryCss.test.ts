import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { inlineEntryCssHtml } from "../../scripts/inlineEntryCss";

const VITE_LINK =
  '<link rel="stylesheet" crossorigin href="/assets/index-CzB-x2tQ.css">';

describe("inlineEntryCssHtml", () => {
  it("replaces Vite's blocking link with an inline style block", () => {
    const html = `<head>${VITE_LINK}</head><body><div id="root"></div></body>`;
    const out = inlineEntryCssHtml(html, [
      { href: "/assets/index-CzB-x2tQ.css", css: ".a{color:red}" },
    ]);
    expect(out).not.toContain('rel="stylesheet"');
    expect(out).not.toContain('href="/assets/index-CzB-x2tQ.css"');
    expect(out).toContain("<style>");
    expect(out).toContain(".a{color:red}");
    expect(out).toContain("first paint waits only on the document");
    expect(out).toContain('<div id="root"></div>');
  });

  it("matches the link even if Vite ever puts href before rel", () => {
    const html = '<head><link crossorigin href="/assets/entry.css" rel="stylesheet"></head>';
    const out = inlineEntryCssHtml(html, [{ href: "/assets/entry.css", css: "body{}" }]);
    expect(out).not.toContain('rel="stylesheet"');
    expect(out).toContain("<style>");
  });

  it("leaves HTML without a matching link byte-identical", () => {
    const html =
      '<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"></head>';
    const out = inlineEntryCssHtml(html, [{ href: "/assets/index-123.css", css: ".x{}" }]);
    expect(out).toBe(html);
  });

  it("escapes a stray closing style tag inside the CSS", () => {
    const out = inlineEntryCssHtml(`<head>${VITE_LINK}</head>`, [
      { href: "/assets/index-CzB-x2tQ.css", css: '.x{content:"</style>"}' },
    ]);
    expect(out).toContain('<\\/style');
    expect(out.split("<style>").length).toBe(2); // exactly one block opened
  });

  it("keeps the real index.html untouched when no link matches", () => {
    const real = readFileSync(path.join(__dirname, "../../index.html"), "utf8");
    const out = inlineEntryCssHtml(real, [{ href: "/assets/index-none.css", css: ".x{}" }]);
    expect(out).toBe(real);
    // The shell and the async fonts pattern must still be in there untouched.
    expect(out).toContain("first-paint-shell");
    expect(out).toContain('media="print"');
  });
});
