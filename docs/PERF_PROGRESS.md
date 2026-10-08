# Performance Progress Ledger

> **Purpose:** single source of truth so we never re-fix solved problems, never lose
> measurement context, and never move by guesswork. Every perf change MUST update
> this file: what changed, how it was verified, what the numbers were before/after.

---

## 0. How to measure (canonical protocol — do not improvise)

```bash
# Mobile (Lighthouse-equivalent slow-4G, 4x CPU) — THE decisive profile
node scripts/speedCheck.mjs --url https://www.tradibu.com/ --label mobile --slow-4g --waterfall

# Desktop (cable 10Mbps)
node scripts/speedCheck.mjs --url https://www.tradibu.com/ --label desktop

# Local build (pre-deploy verification)
npm run build && npm run preview   # then point --url at http://localhost:4173/
```

Gate sequence for every change (all must pass, in this order):
1. `npm run typecheck` — 0 diagnostics
2. `npm test` — 23 files / 182 tests green
3. `npm run lint` — 0 errors (warnings allowed, currently 29)
4. `npm run build` — clean
5. Speed audit with the canonical flags above; paste numbers into §2 of this file

**Measurement rules:**
- Compare ONLY same-profile numbers (`--slow-4g` vs `--slow-4g`). `--slow-3g`
  (400kbps/400ms) is much harsher — never mix profiles in one table.
- Always record date + target (live vs localhost) with the numbers.
- Two runs minimum; report the range, not a single run.

---

## 1. FIXED — solved problems, DO NOT REWORK (all deployed live)

Each row: the fix → **why it works** → the **guard** that fails if it regresses.

| # | Fixed | Commit | Mechanism (how/why) | Guard (regression fails here) |
|---|-------|--------|---------------------|-------------------------------|
| 1 | Entry CSS blocked first paint | `5dbc492` | `scripts/inlineEntryCss.ts` — post-order `transformIndexHtml` Vite plugin swaps Vite's blocking `<link rel=stylesheet>` for an inline `<style>`; runs before the writeBundle prerenderers so all ~130 prerendered pages inherit it. Paint waits only on the HTML document. Build **throws** if the matcher stops matching (no silent regression). | `src/test/inlineEntryCss.test.ts` (5 tests) + build failure |
| 2 | `#root` shipped empty — hero entered DOM only at React first commit (FCP ~5.2 s) | `98631a6` | Static first-paint shell in `index.html`: landing above-the-fold DOM (navbar, promo, preloaded hero `<picture>`) as static HTML inside `#root` between markers. React 18 `clearContainer()` wipes it in the same commit that inserts the real tree — no handoff script; identical geometry keeps CLS ~0. Non-home routes strip it (prerenderers + inline guard). | `src/test/homeShellLcp.test.ts`, `src/test/pageSeoHead.test.ts` → "the first-paint shell" |
| 3 | LCP hero request started late / preload mismatch | `61a32db`, `5b109f4`, `3cf48bf` | Hero preloaded as static `<link rel=preload imagesrcset>` in `<head>`, media-keyed byte-for-byte to the `<picture><source>` (single source of truth `src/lib/heroImages.ts`). | `src/test/homeShellLcp.test.ts` (candidate lists asserted byte-for-byte) |
| 4 | Hero `<img>` node replaced by data-swap → LCP reset to query time (~4.6 s) | `48a1ca0`, `2e6d49c` | Slider mounts in the **first** React commit (even while `heroLoading`), so the SAME DOM node survives data arrival. | `src/test/heroLcpSwap.test.tsx` (node identity + attribute stability) |
| 5 | Dexie/IndexedDB blocked the critical path | `48a1ca0` | Kept off first-paint path; hero paints at first paint. | `src/test/landingLcp.test.tsx` |
| 6 | 221 ms forced reflows (masonry/scroll geometry reads) | `66e520d`, `135e250` | First geometry reads deferred to next `requestAnimationFrame`; scroll/resize bursts coalesce into one read; fallback width unchanged so first paint identical. | Audit shows **0 forced reflows** on every run since (verified live 2026-10-07) |
| 7 | Product images cached only 1 hour | `0d31b7f`, `3991f1a` | Upload passes `cacheControl` = 1 year (keys embed `Date.now()`, never overwritten → safe); refresh script covers originals + card/card320 with correct Content-Type. | `src/test/imageHeaders.test.ts`, `scripts/refreshImageCacheControl.ts` (`--apply`) |
| 8 | Card derivatives upscaled / wrong widths | `746209f`, `5f5a567`, `411ad58` | Never upscale; re-encode legacy files to advertised width; 320px backfill. | `src/test/productCardGeometry.test.ts`, `src/test/imageUploadRules.test.ts` |
| 9 | Service worker hijacked the LCP image request | `b5adea7` | SW no longer intercepts the hero. | `public/service-worker.js` + live LCP element check |
| 10 | Toasters + notification hub in the entry chunk | `0e20b2b` | Moved behind `AfterFirstPaint`. | `src/test/afterFirstPaint.test.tsx`, `src/test/landingLcp.test.tsx` |
| 11 | Landing route chunk wave arrived late | `7fe505c`, `444e886` | `modulepreload` of the landing route's chunk graph at build time. | `scripts/preloadLandingRoute.ts` + `pageSeoHead.test.ts` build wiring |
| 12 | Transpiled fallbacks shipped to modern browsers | `d5479f2` | Build target `es2022`. | tsconfig/build config |
| 13 | Layout shift on feed; missing prerendered heads | `3fe7870`, `12bf95b` | Masonry reserves image dimensions; `<head>` prerendered for every public route. | `src/test/masonryFeedGrid.test.tsx`, `masonryLayout.test.ts` — live CLS ≤ 0.005 |
| 14 | Catch-all cancelled every cache rule | `e024043`, `d5a6144` | Rewrites fixed so cache rules apply; SPA catch-all reachable under cleanUrls. | `src/test/vercelRouting.test.ts` |

**Live verification 2026-10-07 (confirmed on https://www.tradibu.com/):**
- inlined `<style>` marker present ✓, blocking entry `<link>` absent ✓
- first-paint shell + hero preload + `<picture>` present in served HTML ✓
- HTML served brotli (30 KB on the wire of 158 KB raw), `X-Vercel-Cache: HIT` ✓
- 0 forced reflows, CLS ≤ 0.005, all SEO/a11y checks PASS ✓


---

## 2. Scoreboard (canonical profile: mobile, slow-4G 1.6Mbps/150ms, 4x CPU)

| Metric | Baseline (2026-10-07, pre-shell/CSS work) | Current (2026-10-07, post-deploy) | Target |
|---|---|---|---|
| FCP | 6440 – 7228 ms POOR | **4136 – 4988 ms** POOR | ≤ 1800 ms |
| LCP | 6740 – 7844 ms POOR | **6268 – 6320 ms** POOR | ≤ 2500 ms |
| TBT | 938 – 2228 ms POOR | 1080 – 3572 ms POOR | ≤ 200 ms |
| TTFB | 952 – 1429 ms WARN | 983 – 1739 ms WARN/POOR | ≤ 800 ms |
| CLS | 0.0053 – 0.0095 GOOD | **0.0000 – 0.0002** GOOD ✓ | ≤ 0.1 |
| Forced reflows | 0 | 0 ✓ | 0 |
| Requests / bytes | 112 / ~700 KB | 102–111 / 492–842 KB | — |

Desktop (cable): **FCP 1720–2004 ms, LCP 1852–2056 ms — GOOD/WARN** ✓ — desktop
essentially passes; the remaining problem is mobile-only.

Trend: FCP improved ~30% (6.4–7.2 s → 4.1–5.0 s), LCP ~15%, CLS now effectively
zero. **Everything in §4 is still open — none of it is solved.**

---

## 3. Change log (append-only — add a row for EVERY perf change)

| Date | Change | FCP before → after | LCP before → after | Verified by |
|------|--------|--------------------|--------------------|-------------|
| 2026-10-07 | Inline entry CSS (`5dbc492`) | 6440–7228 → 4136–4988 | 6740–7844 → 6268–6320 | live audit + `inlineEntryCss.test.ts` |
| 2026-10-07 | Static first-paint shell (`98631a6`) | ~5200 → 1.4–2.2 s (local) | 6200 → =FCP (local) | local audit + `homeShellLcp.test.ts` |

---

## 4. OPEN — remaining work, ranked by evidence (each has a concrete next step)

### OPEN-1 (top priority): Mobile FCP still 4.1–5.0 s — paint waits for ~94% of the document
**Evidence (waterfall, live, slow-4G):** document request runs `50 → 4051 ms`;
**FCP = 4136 ms ≈ document end.** The first-paint shell starts at char **148,775 of
158,583** — the head is ~147 KB because the *entire* 131 KB entry CSS is now
inlined in `<head>`, and the shell (first paintable content) sits right after it.
TTFB alone ~1000 ms; the remaining ~3 s is document transfer sharing the throttled
pipe with ~15 scripts + hero image that start at ~1170 ms.

**Why this is not a re-fix of #1:** inlining correctly removed the *second round
trip* for CSS (baseline was worse: 6.4–7.2 s), but moved the CSS bytes into the
document's own critical path. The next step is complementary, not a revert.

**Next steps (in order):**
1. Confirm the split with a second waterfall run: TTFB ~1.0 s + transfer ~3.0 s.
2. Critical-CSS split: inline ONLY what the shell needs (shell + navbar + hero ≈ few
   KB) at the top of `<head>`; load the remaining ~120 KB non-blocking
   (`media="print" onload` — the pattern already used for fonts). Head shrinks
   ~147 KB → ~15 KB, so FCP gates on ~20 KB instead of ~147 KB.
   **Guard:** extend `inlineEntryCss.test.ts`; blocking-link build check stays.
3. TTFB ≤ 800 ms is server-side (HTML sends `max-age=0, must-revalidate`).
   Investigate `stale-while-revalidate` for prerendered HTML — only after 1.2,
   and only with a purge plan.

### OPEN-2: LCP 6.3 s although the hero bytes arrived at 2.1 s
**Evidence (LCP entry history, live):** entry #1 = a `span` at FCP (4136 ms, size
1188), #2 = `p` at 5700 ms, #3 = the hero `img` at **6268 ms with `load=5985 ms`**.
The preload finished at **2181 ms**, yet no image is an LCP candidate before
6268 ms. `load=5985 ms` ≈ when the `LandingPage` chunk commit lands (chunk fetched
3918→4643 ms) — i.e. the LCP candidate is **React's** `<img>` node, not the shell's.

**Hypotheses (separate by experiment, do NOT assume):**
- H1: the shell's hero `<img>` never painted before React's commit — then FCP's
  largest content being a 108×11 px span is explained; find why it didn't paint.
- H2: React's wipe inserts a *new* `<img>` node whose repaint becomes a new LCP
  candidate, resetting LCP to ~6.3 s — the failure mode `heroLcpSwap.test.tsx`
  guards *within* LandingPage, but the **shell→React** boundary has no guard.

**Next step:** run the same `--slow-4g --waterfall` audit against **localhost**
(local runs measured LCP = FCP). If local shows `img` as LCP entry #1 at FCP and
live does not → diff served HTML + headers. If neither does → H2 confirmed → make
React adopt the shell `<picture>` (reuse the node across the wipe) and add a guard
test for the shell→React boundary.

### OPEN-3: Total Blocking Time 1.1–3.6 s (long tasks at 5–7.5 s)
**Evidence:** 14–24 long tasks, worst 146–340 ms, all during React boot + data
fetch; attribution reports `unknown@?:window` (observer gap).
**Next step:** improve long-task attribution in `scripts/speedCheck.mjs`
(CDP `Profiler`/script URL correlation) → identify the top offender → split or
suppress it. Do NOT guess at bundles before attribution exists.

### OPEN-4: TTFB 983–1739 ms
**Evidence:** bare `curl` from this machine gets TTFB 0.38–0.41 s; audited TTFB
includes emulated 150 ms RTT + connection setup, so part is measurement overhead —
but HTML has `Cache-Control: max-age=0, must-revalidate` (revalidates every visit).
**Next step:** after OPEN-1, measure raw TTFB from the target market region before
changing cache headers.

---

## 5. Housekeeping state (as of 2026-10-07)

- typecheck: 0 diagnostics ✓ | tests: 23 files / 182 tests ✓ | lint: 0 errors,
  29 warnings (all `react-hooks/exhaustive-deps`) | build: clean ✓
- main in sync with origin/main; last commit `5dbc492`
- Live site runs the same build as local `dist/` (inline style marker verified both sides)
