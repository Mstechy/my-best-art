/**
 * DOM-less <head> rewriting primitives.
 *
 * Extracted from `productSeo.ts` so that the product head and the generic page
 * head are rewritten by ONE implementation instead of two that can drift. Every
 * crawler-visible tag in this project is written by exactly one of
 * `injectProductHead` (src/lib/productSeo.ts) or `injectPageHead`
 * (src/lib/pageSeo.ts), and both are built out of the functions below.
 *
 * These are mechanisms, not policies: they know how to replace a tag, not what
 * the tag should say. Kept free of DOM and Node APIs so this module type-checks
 * under BOTH tsconfig.app.json (lib: ES2020 + DOM) and tsconfig.node.json
 * (lib: ES2023, strict). That means no `replaceAll` and no
 * `Array.prototype.at` - both are newer than ES2020.
 */

/**
 * Insert `snippet` immediately before `</head>`.
 *
 * Slicing rather than `String.replace` matters: a JSON-LD payload routinely
 * contains `$&`, `$1` and friends when a product description does, and a string
 * replacement pattern would silently rewrite them into garbage.
 *
 * Returns the input unchanged when there is no `</head>` to insert before,
 * which is the only sane answer: appending a tag after `</html>` would be
 * worse than dropping it.
 */
export function insertBeforeHeadClose(html: string, snippet: string): string {
  const index = html.lastIndexOf("</head>");
  if (index === -1) return html;
  return html.slice(0, index) + snippet + "\n    " + html.slice(index);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** `escapeHtmlText` plus quotes, for a value landing inside an attribute. */
export function escapeAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

export function replaceFirst(html: string, pattern: RegExp, factory: () => string): string {
  if (!pattern.test(html)) return html;
  // Function replacement: no `$` interpretation in the produced string.
  return html.replace(pattern, () => factory());
}

/**
 * Replace the document title, or append one when the shell has none.
 *
 * The append branch matters because `useSEO` (the runtime writer) always ends up
 * with a title in the DOM, so a static file that silently kept the homepage's
 * title while the rendered page disagreed is precisely the drift this project
 * keeps trying to design out.
 */
export function setTitle(html: string, title: string): string {
  const tag = `<title>${escapeHtmlText(title)}</title>`;
  const pattern = /<title[^>]*>[\s\S]*?<\/title>/i;
  if (pattern.test(html)) return replaceFirst(html, pattern, () => tag);
  return insertBeforeHeadClose(html, tag);
}

/**
 * Overwrite an existing <meta> identified by name/property, or append one if
 * the shell has no such tag at all. Appending keeps this working against an
 * index.html that later gains or loses individual tags.
 */
export function setMeta(html: string, attr: "name" | "property", key: string, content: string): string {
  const tag = `<meta ${attr}="${key}" content="${escapeAttribute(content)}" />`;
  const pattern = new RegExp(`<meta[^>]*\\b${attr}="${escapeRegExp(key)}"[^>]*>`);
  if (pattern.test(html)) return replaceFirst(html, pattern, () => tag);
  return insertBeforeHeadClose(html, tag);
}

/**
 * Remove a meta identified by name/property if present, appending nothing.
 *
 * Used for tags whose value we can no longer vouch for rather than tags we are
 * replacing. The closing quote in the pattern is what keeps `og:image` from
 * matching `og:image:width`.
 */
export function removeMeta(html: string, attr: "name" | "property", key: string): string {
  const pattern = new RegExp(`<meta[^>]*\\b${attr}="${escapeRegExp(key)}"[^>]*>\\s*`, "g");
  return html.replace(pattern, "");
}

/**
 * Point the canonical at `href`, or append the link when the shell has none.
 *
 * The append branch is the safety net that lets `index.html` stop being the only
 * place a canonical is declared: a shell that ever loses its canonical still
 * cannot produce a page with two canonicals or none.
 */
export function setCanonical(html: string, href: string): string {
  const tag = `<link rel="canonical" href="${escapeAttribute(href)}" />`;
  const pattern = /<link[^>]*\brel="canonical"[^>]*>/;
  if (pattern.test(html)) return replaceFirst(html, pattern, () => tag);
  return insertBeforeHeadClose(html, tag);
}

/**
 * Drop every `<link ... as="image" ...>` from the head.
 *
 * The shell preloads the homepage hero image so the LCP element on `/` starts
 * on the first HTML pass. No other route renders that hero: `HeroSlider` is
 * mounted by `LandingPage` alone, and the preload scanner works on raw HTML
 * without waiting to find out. So on any other route one of the two
 * media-keyed links fires and downloads a hero at `fetchpriority="high"` only
 * to be thrown away, competing with the image that is that page's real LCP
 * element. Dropping every one of them is a mobile win first and a desktop win
 * second; the `/g` flag exists because there is more than one to drop.
 *
 * Callers must add their own preload back if a route ever gains one; this is
 * unconditional by design, because both head writers always start from the
 * homepage shell.
 */
export function stripImagePreloads(html: string): string {
  return html.replace(/<link\b[^>]*\bas="image"[^>]*>\s*/g, "");
}

/**
 * Delimiters around the landing route's `modulepreload` block.
 *
 * `scripts/preloadLandingRoute.ts` emits the chunk graph the lazy `LandingPage`
 * needs so a first visit to `/` starts downloading it while index.js is still on
 * the wire, instead of one round trip after index.js executes. Those hints are
 * only correct for `/`: every other route pays for chunks it will never mount.
 *
 * The markers exist so the block can be removed as one unit. Matching the
 * individual `<link>` tags instead would need the hashed filenames, which
 * neither head writer has any business knowing about.
 */
export const LANDING_PRELOAD_START = "<!--tradibu:landing-preload:start-->";
export const LANDING_PRELOAD_END = "<!--tradibu:landing-preload:end-->";

/**
 * Remove the landing-route preload block from the head.
 *
 * Every prerendered file except `/` is served to a visitor who mounted some
 * other page, so leaving the block there would make every crawler and every
 * shared WhatsApp link download the homepage's route chunk for nothing - the
 * same class of bug as the hero image preload, one file format over. There is
 * only one `</head>` to find, so indexOf is enough.
 *
 * Vite's own entry-graph modulepreloads sit OUTSIDE these markers and are left
 * alone: those are what boots the app at all, on every route.
 */
export function stripLandingPreloads(html: string): string {
  const start = html.indexOf(LANDING_PRELOAD_START);
  if (start === -1) return html;
  const end = html.indexOf(LANDING_PRELOAD_END, start);
  if (end === -1) return html;
  const rest = html.slice(end + LANDING_PRELOAD_END.length);
  return html.slice(0, start) + rest.replace(/^\r?\n/, "");
}

/**
 * Drop every JSON-LD block whose `@type` is `type`.
 *
 * Idempotence matters because every prerendered file starts from the same shell,
 * and because `useSEO` leaves a structured-data script in the DOM that a second
 * pass must not stack another copy on top of. Blocks of any other type - notably
 * the homepage's untagged WebSite/Organization graph - are left alone: that
 * graph is the document's, not a single route's, and deleting it would strip the
 * site entity out of every page that is not a product.
 *
 * The pattern deliberately tolerates extra attributes, because the block these
 * writers emit carries an `id` and `useSEO` creates its own as
 * `<script id="page-structured-data" type="application/ld+json">`. A pattern
 * anchored on `<script type=...` would match neither.
 */
export function stripJsonLdByType(html: string, type: string): string {
  return html.replace(
    /<script[^>]*\btype="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    (block: string, body: string) => {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        return parsed && parsed["@type"] === type ? "" : block;
      } catch {
        // Unparseable JSON is not ours to delete; leave it exactly as found.
        return block;
      }
    },
  );
}

/**
 * Serialize a schema node as a tagged `<script>`.
 *
 * The id is what lets `useSEO` swap the block on mount instead of adding a
 * second node next to it: the hook removes `id="<id>"` before installing its
 * own, so the static and the rendered document describe the same entity once.
 */
export function toHtmlJsonLd(schema: Record<string, unknown>, id: string): string {
  // Escaping every `<` keeps a description containing `</script>` from closing
  // the tag early and turning the remaining JSON into executable markup. It is
  // still valid JSON, so a parser decodes it back to `<`.
  const json = JSON.stringify(schema).replace(/</g, "\\u003c");
  return `<script id="${id}" type="application/ld+json">${json}</script>`;
}
