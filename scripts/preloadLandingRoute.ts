import fs from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
import { LANDING_PRELOAD_START } from "../src/lib/productSeo";

/**
 * Build-time `modulepreload` for the landing route's chunk graph.
 *
 * `App.tsx` lazy-loads every page. That is the right call for total bytes, but
 * it gates the entire landing route behind index.js: a dynamic `import()` is
 * invisible to the preload scanner until index.js has been downloaded AND
 * executed, so the LandingPage chunk and the 24 files it statically imports
 * cannot even be *requested* until React has booted. On a throttled phone
 * Lighthouse measured that window as 2.85s of "LCP load delay", with the hero
 * `<img>` entering the DOM at 3.34s.
 *
 * What this is not: Vite's own preload helper (`__vitePreload`, visible in the
 * entry as `ae(() => import("./LandingPage-*.js"), __vite__mapDeps([...]))`)
 * already fetches those 24 files as a single parallel wave, so the cost was
 * never 24 sequential round trips - it was one serialization point between that
 * wave and the document. Emitting the graph into the raw HTML moves the wave's
 * start from "index.js has executed" to "the HTML has been parsed", so it
 * transfers alongside index.js instead of queuing behind it. Code splitting is
 * kept exactly as it was - nothing moves into the entry bundle.
 *
 * That distinction also bounds the win, and the bound is worth stating: this
 * removes a network-discovery gate (a round trip plus queued transfer time). It
 * does nothing for the time spent *executing* React and the landing subtree on
 * a CPU-throttled phone, and it does not touch the REST hop that still follows
 * the mount.
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
