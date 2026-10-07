import type { Plugin } from "vite";

/**
 * One inlinable stylesheet: `href` as it appears in the HTML (no origin), and
 * the CSS text to embed instead.
 */
export type EntryStylesheet = { href: string; css: string };

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces Vite's injected render-blocking entry stylesheet with an inline
 * <style> block, in place.
 *
 * Why this exists: the landing first-paint shell (see index.html) can paint as
 * soon as the HTML document has arrived, but a browser will not paint a single
 * pixel while a blocking <link rel="stylesheet"> is still pending. Under the
 * Lighthouse slow-4G profile the entry CSS arrived ~3s after the document
 * because it shared the emulated pipe with ~50 preloaded chunks and images, so
 * FCP/LCP were gated on that second round trip - and on a network where React
 * had already wiped the shell before the first paint ever happened. Inlining
 * removes the gate: the bytes travel inside the document (the HTML gains
 * ~22KB on the wire after brotli, roughly what the CSS alone costs) and paint
 * needs nothing else.
 *
 * Deliberate properties:
 * - The CSS asset is still emitted by Vite; anything else that references it
 *   keeps working. Only the blocking <link> disappears.
 * - Unknown/fixture HTML passes through byte-identical (no matching link, no
 *   change), which keeps the prerenderers and tests honest.
 * - A `</style>` sequence inside the CSS can only occur inside a CSS string,
 *   where `<\/style>` is a valid escape - so it is escaped rather than
 *   allowed to terminate the block early.
 */
export function inlineEntryCssHtml(html: string, sheets: readonly EntryStylesheet[]): string {
  let out = html;
  for (const { href, css } of sheets) {
    const h = escapeRegExp(href);
    // Vite currently emits rel before href; also match the reversed order so a
    // future Vite version reordering attributes degrades loudly (see the
    // warning in the plugin) instead of silently changing nothing.
    const patterns = [
      new RegExp(`<link\\b(?=[^>]*\\brel="stylesheet")[^>]*\\bhref="${h}"[^>]*\\/?>`, "g"),
      new RegExp(`<link\\b(?=[^>]*\\bhref="${h}")[^>]*\\brel="stylesheet"[^>]*\\/?>`, "g"),
    ];
    const safeCss = css.replace(/<\/style/gi, "<\\/style");
    let replaced = false;
    for (const re of patterns) {
      out = out.replace(re, () => {
        replaced = true;
        return `<style>\n/* inlined from ${href} so first paint waits only on the document */\n${safeCss}\n</style>`;
      });
    }
    if (!replaced) {
      return out; // not present - leave the document exactly as it was
    }
  }
  return out;
}

/**
 * Vite build plugin: inline every emitted .css asset referenced by a blocking
 * <link rel="stylesheet"> in the HTML (in practice exactly one, the entry
 * bundle's CSS).
 *
 * Runs at `order: "post"` so Vite has already injected its tags and the full
 * bundle (including CSS sources) is available on the transform context. It
 * runs before any writeBundle prerenderer reads dist/index.html, so every
 * prerendered page inherits the inlined style automatically.
 */
export function inlineEntryCss(): Plugin {
  return {
    name: "tradibu:inline-entry-css",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const sheets: EntryStylesheet[] = [];
        for (const [fileName, output] of Object.entries(ctx.bundle)) {
          if (output.type !== "asset" || !fileName.endsWith(".css")) continue;
          const raw = output.source;
          sheets.push({
            href: `/${fileName}`,
            css: typeof raw === "string" ? raw : Buffer.from(raw).toString("utf8"),
          });
        }
        if (sheets.length === 0) return html;
        const next = inlineEntryCssHtml(html, sheets);
        for (const { href } of sheets) {
          // If the link survived, Vite's injection format changed under us and
          // the page would ship exactly as render-blocking as before. Fail the
          // build loudly rather than measure the regression in production.
          if (next.includes(`href="${href}"`)) {
            throw new Error(
              `inline-entry-css: could not replace <link rel="stylesheet" href="${href}"> - ` +
                `Vite's HTML injection format changed; update the matcher in scripts/inlineEntryCss.ts`,
            );
          }
        }
        return next;
      },
    },
  };
}
