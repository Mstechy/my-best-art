import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { LANDING_PRELOAD_START } from "../src/lib/productSeo";

/**
 * Build-time `modulepreload` for the landing route's chunk graph.
 *
 * `App.tsx` lazy-loads every page, which is the right call for total bytes but
 * it turns the first visit into a chain of round trips: HTML -> index.js ->
 * LandingPage-*.js -> its own static imports -> the hero finally renders. On a
 * throttled phone Lighthouse measured that chain as 2.85s of "LCP load delay",
 * with the hero `<img>` entering the DOM at 3.34s.
 *
 * The browser cannot start step 2 until step 1 has been downloaded AND
 * executed, because a dynamic `import()` is only visible to the preload
 * scanner once index.js has run. Emitting the chunk graph into the raw HTML
 * lets the scanner see it on the first pass, so the landing route's files
 * download in parallel with index.js instead of after it. Code splitting is
 * kept exactly as it was - nothing moves into the entry bundle.
 *
 * Only chunks *outside* the entry graph are listed. Vite already emits
 * `<link rel="modulepreload">` for everything index.js imports statically, and
 * repeating those would be noise at best.
 *
 * Every failure degrades to today's behaviour (a plain chain), because the
 * block is a hint: an absent hint costs a round trip, a thrown build costs a
 * deployment.
 */

const LANDING_MODULE = "src/pages/LandingPage.tsx";

/** The subset of a Rollup/Rolldown output chunk this plugin reads. */
interface OutChunk {
  type: "chunk";
  fileName: string;
  isEntry: boolean;
  facadeModuleId: string | null;
  imports: string[];
}

type OutBundle = Record<string, { type: "asset" } | OutChunk>;

function isChunk(value: OutBundle[string]): value is OutChunk {
  return value.type === "chunk";
}

/** `facadeModuleId` is a native path on Windows and a URL-ish path elsewhere. */
function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

function withBase(base: string, fileName: string): string {
  return `${base.replace(/\/?$/, "/")}${fileName}`;
}

/**
 * Every chunk reachable from `start` through static imports.
 *
 * `chunk.imports` and the bundle keys are both output file names, so the
 * lookup is a plain map access - no path resolution needed.
 */
function reachable(start: OutChunk, bundle: OutBundle): Set<string> {
  const seen = new Set<string>();
  const stack: OutChunk[] = [start];
  while (stack.length > 0) {
    const chunk = stack.pop() as OutChunk;
    if (seen.has(chunk.fileName)) continue;
    seen.add(chunk.fileName);
    for (const imported of chunk.imports) {
      const next = bundle[imported];
      if (next && isChunk(next)) stack.push(next);
    }
  }
  return seen;
}

/** One `<link>` per chunk the landing route needs that the entry does not. */
function landingPreloadTags(bundle: OutBundle, base: string): string[] {
  const chunks = Object.values(bundle).filter(isChunk);
  const entry = chunks.find((chunk) => chunk.isEntry);
  const landing = chunks.find(
    (chunk) =>
      chunk.facadeModuleId !== null &&
      toPosix(chunk.facadeModuleId).endsWith(LANDING_MODULE),
  );
  // Either can be missing: no `LandingPage` chunk means the route was bundled
  // into the entry, in which case there is nothing left to prewarm.
  if (!entry || !landing) return [];

  const entryGraph = reachable(entry, bundle);
  return [...reachable(landing, bundle)]
    .filter((fileName) => !entryGraph.has(fileName))
    .sort()
    .map((fileName) => `<link rel="modulepreload" crossorigin href="${withBase(base, fileName)}">`);
}

/** Vite plugin. `apply: "build"` keeps it out of `vite dev`. */
export function preloadLandingRoute(): Plugin {
  let base = "/";

  return {
    name: "tradibu:preload-landing-route",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    // `writeBundle` is the first point at which both the emitted index.html and
    // the final hashed file names exist. It must run before the product-page
    // prerenderer, which reads that same file - vite.config lists this plugin
    // first for exactly that reason.
    async writeBundle(options, bundle) {
      try {
        if (!options.dir) return;
        const indexPath = path.join(options.dir, "index.html");
        let html: string;
        try {
          html = await fs.readFile(indexPath, "utf8");
        } catch {
          return;
        }
        if (html.includes(LANDING_PRELOAD_START)) return;

        const tags = landingPreloadTags(bundle as unknown as OutBundle, base);
        if (tags.length === 0) return;

        const close = html.lastIndexOf("</head>");
        if (close === -1) return;

        const block = `<!--tradibu:landing-preload:start-->\n${tags.join("\n")}\n<!--tradibu:landing-preload:end-->`;
        await fs.writeFile(`${indexPath}`, `${html.slice(0, close)}${block}\n${html.slice(close)}`, "utf8");
        console.log(`[preload] Landing route: warmed ${tags.length} chunk(s).`);
      } catch (error) {
        console.warn(
          "[preload] Skipped; the landing route keeps its serial chain:",
          error instanceof Error ? error.message : error,
        );
      }
    },
  };
}
