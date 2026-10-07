/**
 * Zero-dependency website speed checker (PageSpeed-style core web vitals).
 *
 * Why hand-rolled: this workspace builds offline, so there is no Lighthouse or
 * Puppeteer in node_modules. Chrome plus Node 22's built-in global WebSocket are
 * all that is needed to drive the DevTools Protocol directly.
 *
 * Measures the REAL production build (npm run build && npm run preview):
 *   FCP / LCP / CLS / TTFB / DCL / load, transferred bytes, request count,
 *   long tasks (INP proxy) - all under a configurable network throttle.
 *
 * Usage:
 *   node scripts/speedCheck.mjs --url http://localhost:4173/ --label desktop
 *   node scripts/speedCheck.mjs --url http://localhost:4173/ --label mobile --slow-3g
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};
const has = (n) => argv.includes(`--${n}`);

const URL_TARGET = flag('url', 'http://localhost:4173/');
const LABEL = flag('label', 'desktop');
const SLOW_3G = has('slow-3g');
// How long to wait for the load event. Slow 3G needs a generous budget or we
// end up measuring a half-downloaded document and reporting nonsense.
const BUDGET_MS = Number(flag('budget', SLOW_3G ? 240000 : 60000));

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

/** Minimal promise-based DevTools Protocol client. */
class Cdp {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.onopen = () => resolve(this);
      ws.onerror = () => reject(new Error(`cannot reach ${this.url}`));
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
        } else if (msg.method) {
          (this.listeners.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
        }
      };
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) {
    console.error('Chrome not found. Set CHROME_PATH or install Chrome.');
    process.exit(2);
  }
  return found;
}

/** Boots headless Chrome with the debug port open, returns a connected client. */
async function launchChrome(port = 9222) {
  const profile = mkdtempSync(join(tmpdir(), 'speedcheck-'));
  const child = spawn(findChrome(), [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      target = (await res.json()).find((t) => t.type === 'page');
      if (target) break;
    } catch { /* not up yet */ }
  }
  if (!target) { killChrome(child.pid); throw new Error('Chrome exposed no page target.'); }

  const client = await new Cdp(target.webSocketDebuggerUrl).connect();
  return { child, client };
}

/**
 * Kills Chrome AND its process tree.
 *
 * `child.kill()` only signals the launcher process. Headless Chrome forks helper
 * processes that survive and keep the debug port bound, so the next run fails to
 * find a page target. taskkill /T takes the whole tree down.
 */
function killChrome(pid) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch { /* already gone */ }
}

/**
 * Injected via Page.addScriptToEvaluateOnNewDocument so it installs before any
 * page script runs - otherwise LCP/CLS entries emitted early can be missed.
 * Results are read back off a plain global.
 */
const OBSERVER_SCRIPT = `
window.__audit = { lcp: 0, lcpEl: '', lcpHistory: [], cls: 0, longTasks: 0, longTaskMs: 0, shifts: [], tasks: [], forcedReflows: 0 };
const A = window.__audit;
// Chrome logs "Forced reflow" as a console warning when a layout property is read
// after a write invalidated layout. Counting them turns that invisible cost into a
// number, and it has to be installed before any page script runs to catch load.
(() => {
  const count = (args) => {
    try {
      if (/Forced reflow|forced recalculation/i.test(Array.from(args).map(String).join(' '))) {
        A.forcedReflows++;
      }
    } catch (e) { /* never break the page */ }
  };
  for (const level of ['warn', 'error', 'log']) {
    const original = console[level];
    console[level] = (...a) => { count(a); original.apply(console, a); };
  }
})();
const desc = (n) => {
  if (!n || !n.nodeName) return '?';
  let s = n.nodeName.toLowerCase();
  if (n.id) s += '#' + n.id;
  const c = n.className && n.className.baseVal === undefined ? String(n.className) : '';
  if (c) s += '.' + c.trim().split(/\\s+/).slice(0, 2).join('.');
  return s;
};
new PerformanceObserver((l) => {
  const es = l.getEntries();
  for (const e of es) {
    A.lcp = e.startTime;
    A.lcpEl = desc(e.element) + (e.url ? ' <- ' + String(e.url).slice(-40) : '');
    // Every candidate, not just the winner: entry id is stable per SOURCE
    // ELEMENT (a repaint of the same node repeats the id, a replacement changes
    // it), so the history answers "did the LCP element repaint or get replaced?".
    A.lcpHistory.push({
      at: Math.round(e.startTime), id: e.id, size: Math.round(e.size),
      load: Math.round(e.loadTime || 0), el: desc(e.element),
      url: e.url ? String(e.url).slice(-40) : '',
    });
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) {
    A.longTasks++; A.longTaskMs += e.duration;
    A.tasks.push({ ms: Math.round(e.duration), at: Math.round(e.startTime), src: (e.attribution || [])
      .map((t) => t.name + '@' + (t.containerName || '?') + ':' + (t.containerType || '?')).join(', ') });
  }
}).observe({ type: 'longtask', buffered: true });
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) {
    if (!e.hadRecentInput && e.value > 0.0001) {
      A.cls += e.value;
      const detail = (e.sources || []).map((s) => {
        const n = s.node;
        if (!n) return '?';
        let d = desc(n);
        // A <section> is anonymous - name it by the heading it contains so the
        // offending feed can be identified without guessing.
        const h = n.querySelector && n.querySelector('h1,h2,h3');
        if (h && h.textContent.trim()) d += ' \u201c' + h.textContent.trim().slice(0, 28) + '\u201d';
        return d;
      });
      A.shifts.push({ value: Number(e.value.toFixed(4)), at: Math.round(e.startTime), nodes: detail });
    }
  }
}).observe({ type: 'layout-shift', buffered: true });
new PerformanceObserver((l) => { for (const e of l.getEntries()) { A.longTasks++; A.longTaskMs += e.duration; } })
  .observe({ type: 'longtask', buffered: true });
`;

/** SEO + accessibility + best-practice heuristics, evaluated after load. */
const AUDIT_SNIPPET = `(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const o = {};
  const meta = (n) => ($(n) ? $(n).getAttribute('content') : null);
  o.title = document.title;
  o.titleLength = document.title.length;
  o.description = meta('meta[name="description"]');
  o.descriptionLength = o.description ? o.description.length : 0;
  const can = $('link[rel="canonical"]');
  o.canonical = can ? can.href : null;
  o.lang = document.documentElement.lang || null;
  o.ogTitle = meta('meta[property="og:title"]');
  o.ogImage = meta('meta[property="og:image"]');
  o.twitterCard = meta('meta[name="twitter:card"]');
  o.viewport = meta('meta[name="viewport"]');
  o.h1Count = $$('h1').length;
  o.headingOrder = $$('h1,h2,h3,h4').map((h) => Number(h.tagName[1]));
  o.jsonLd = $$('script[type="application/ld+json"]').map((s) => {
    try { return JSON.parse(s.textContent)['@type'] || 'unknown'; } catch { return 'INVALID JSON'; }
  });
  o.imgTotal = $$('img').length;
  o.imgMissingAlt = $$('img:not([alt])').length;
  // Space is reserved by width/height attrs, an inline aspect-ratio, a Tailwind
  // aspect-* utility, or an ancestor box with one. All four prevent CLS.
  const reserves = (i) => {
    if (i.getAttribute('width') && i.getAttribute('height')) return true;
    if (i.style.aspectRatio) return true;
    let el = i;
    while (el && el !== document.body) {
      const c = el.className && el.className.baseVal === undefined ? String(el.className) : '';
      if (/\\baspect-\\[/.test(c) || /\\baspect-(square|video)\\b/.test(c)) return true;
      if (el.style && el.style.aspectRatio) return true;
      el = el.parentElement;
    }
    return false;
  };
  o.imgNoDims = $$('img').filter((i) => !reserves(i)).length;
  o.imgNoDimsList = $$('img').filter((i) => !reserves(i))
    .map((i) => (i.getAttribute('src') || i.currentSrc || '?').slice(-48));
  o.linkTotal = $$('a[href]').length;
  o.linkNoName = $$('a[href]').filter((a) => !a.textContent.trim() && !a.getAttribute('aria-label')).length;
  o.linkGeneric = $$('a[href]').filter((a) => /^(click here|here|link|learn more)$/i.test(a.textContent.trim())).length;
  o.btnNoName = $$('button').filter((b) => !b.textContent.trim() && !b.getAttribute('aria-label')
    && !b.getAttribute('aria-labelledby')).length;
  o.iframeNoTitle = $$('iframe:not([title])').length;
  o.roleList = $$('[role="list"]').length;
  o.roleListitem = $$('[role="listitem"]').length;
  o.mixedContent = $$('[src^="http://"]').length;
  o.domNodes = document.getElementsByTagName('*').length;
  const n = performance.getEntriesByType('navigation')[0];
  o.protocol = n ? n.nextHopProtocol : null;
  o.forcedReflows = (window.__audit && window.__audit.forcedReflows) || 0;
  return o;
})()`;

/** Formats a millisecond value. */
const ms = (v) => (v == null || Number.isNaN(v) ? 'n/a' : `${Math.round(v)} ms`);
const kb = (b) => `${(b / 1024).toFixed(0)} KB`;

/** Prints the SEO / a11y audit with pass-fail lines. */
function printSeo(a) {
  const w = 78;
  const line = (s = '') => console.log(s);
  const check = (ok, label, detail = '') =>
    line(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(46)}${detail}`);

  console.log('\n' + '='.repeat(w));
  console.log(` SEO / ACCESSIBILITY AUDIT  (${LABEL})`);
  console.log('='.repeat(w));

  line('\n Crawlable basics');
  check(a.titleLength > 0 && a.titleLength <= 60, 'Title present and <= 60 chars', `${a.titleLength}: "${(a.title || '').slice(0, 44)}"`);
  check(a.descriptionLength > 50 && a.descriptionLength <= 160, 'Meta description 50-160 chars', `${a.descriptionLength}`);
  check(!!a.canonical, 'Canonical URL', a.canonical || 'MISSING');
  check(!!a.lang, 'html lang attribute', a.lang || 'MISSING');
  check(!!a.viewport, 'Viewport meta', a.viewport || 'MISSING');

  line('\n Social / sharing');
  check(!!a.ogTitle, 'og:title', '');
  check(!!a.ogImage, 'og:image', '');
  check(!!a.twitterCard, 'twitter:card', a.twitterCard || 'MISSING');

  line('\n Structure');
  check(a.h1Count === 1, 'Exactly one H1', `${a.h1Count} found`);
  const jumps = a.headingOrder.filter((l, i) => i > 0 && l - a.headingOrder[i - 1] > 1).length;
  check(jumps === 0, 'No skipped heading levels', jumps ? `${jumps} jump(s)` : '');
  check(a.jsonLd.length > 0, 'JSON-LD structured data', a.jsonLd.join(', ') || 'MISSING');
  check(a.jsonLd.every((t) => t !== 'INVALID JSON'), 'All JSON-LD parses', '');

  line('\n Images');
  check(a.imgMissingAlt === 0, 'Every img has an alt attribute', `${a.imgMissingAlt} missing of ${a.imgTotal}`);
  check(a.imgNoDims === 0, 'Images reserve space (dims/aspect-ratio)', a.imgNoDims ? `${a.imgNoDims} without: ${(a.imgNoDimsList || []).join(' | ')}` : `${a.imgTotal} images`);

  line('\n Links and controls');
  check(a.linkNoName === 0, 'Every link has an accessible name', `${a.linkNoName} empty of ${a.linkTotal}`);
  check(a.linkGeneric === 0, 'No generic link text (click here)', `${a.linkGeneric} found`);
  check(a.btnNoName === 0, 'Every button has an accessible name', `${a.btnNoName} without`);
  check(a.iframeNoTitle === 0, 'Iframes have a title', `${a.iframeNoTitle} without`);

  line('\n Lists (masonry accessibility)');
  check(a.roleList > 0, 'A semantic list role exists', `${a.roleList} role=list container(s)`);
  check(a.roleListitem > 0, 'Cards exposed as role=listitem', `${a.roleListitem} items`);

  line('\n Payload and security');
  check(a.mixedContent === 0, 'No mixed content (http:// on https)', `${a.mixedContent} found`);
  check(!!a.protocol && a.protocol !== 'http/1.0', 'HTTP/1.1 or better', a.protocol || 'unknown');
  console.log('='.repeat(w));
}

/** Grade helper matching Lighthouse's good/needs-improvement bands.
 *  Never reports GOOD for a missing or zero value - that would be a lie. */
function grade(value, good, poor) {
  if (value == null || value <= 0) return 'n/a ';
  return value <= good ? 'GOOD ' : value <= poor ? 'WARN ' : 'POOR ';
}

/** Runs one audit pass against URL_TARGET, prints it, and returns its numbers.
 *  Each run gets its own debug port so a lingering Chrome from a previous run
 *  cannot make this one fail to attach. */
let runSeq = 0;
async function audit() {
  const { child, client } = await launchChrome(9300 + (runSeq++ % 300));
  const net = { requests: 0, bytes: 0, largest: [], waterfall: new Map(), netStart: 0 };

  try {
    await client.send('Page.enable');
    await client.send('Network.enable');
    await client.send('Runtime.enable');
    await client.send('Performance.enable');

    // iPhone-class emulation (390x844 @3x, touch) when the label says mobile.
    const isMobile = /mobile|ios|iphone|android/i.test(LABEL);
    await client.send('Emulation.setDeviceMetricsOverride', isMobile
      ? { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }
      : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    if (isMobile) {
      await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await client.send('Emulation.setUserAgentOverride', {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 '
          + '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      });
    }

    const CPU_RATE = Number(flag('cpu', /mobile|ios|iphone|android/i.test(LABEL) ? 4 : 1));
    await client.send('Emulation.setCPUThrottlingRate', { rate: CPU_RATE });

    // Lighthouse-equivalent throttles. DevTools "Slow 3G" is ~400 kbps; Lighthouse
    // "Slow 4G" is 1.6 Mbps / 150 ms, which is the more realistic mobile case.
    const THROTTLES = {
      cable: { label: 'cable 10Mbps / 150ms RTT', latency: 150, down: (10 * 1024 * 1024) / 8, up: (5 * 1024 * 1024) / 8 },
      'slow-4g': { label: 'slow 4G 1.6Mbps / 150ms RTT (Lighthouse mobile)', latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8 },
      'slow-3g': { label: 'slow 3G 400kbps / 400ms RTT', latency: 400, down: (400 * 1000) / 8, up: (400 * 1000) / 8 },
    };
    const profile = THROTTLES[SLOW_3G ? 'slow-3g' : has('slow-4g') ? 'slow-4g' : 'cable'];
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.latency,
      downloadThroughput: profile.down,
      uploadThroughput: profile.up,
    });
    await client.send('Network.setCacheDisabled', { cacheDisabled: false });
    await client.send('Page.addScriptToEvaluateOnNewDocument', { source: OBSERVER_SCRIPT });

    client.on('Network.responseReceived', (p) => {
      net.requests++;
      net.bytes += p.response.encodedDataLength || 0;
      net.largest.push({ url: p.response.url.slice(0, 86), size: p.response.encodedDataLength || 0 });
      const e = net.waterfall.get(p.requestId);
      if (e) e.size = p.response.encodedDataLength || 0;
    });

    // Optional --waterfall: a per-request start/end timeline, so a slow first
    // paint can be traced to the exact request that gates it instead of
    // guessed at from aggregate bytes.
    client.on('Network.requestWillBeSent', (p) => {
      if (!net.waterfall.has(p.requestId)) {
        net.waterfall.set(p.requestId, {
          url: p.request.url,
          start: Date.now() - net.netStart,
          end: null,
          size: 0,
          type: p.type,
          priority: p.initialPriority || '',
          failed: false,
        });
      } else {
        // Same requestId re-fired = redirect hop; keep the original start.
        net.waterfall.get(p.requestId).url = p.request.url;
      }
    });
    const markDone = (p, failed) => {
      const e = net.waterfall.get(p.requestId);
      if (e) {
        e.end = Date.now() - net.netStart;
        e.failed = failed;
      }
    };
    client.on('Network.loadingFinished', (p) => markDone(p, false));
    client.on('Network.loadingFailed', (p) => markDone(p, true));

    const loaded = new Promise((resolve) => client.on('Page.loadEventFired', resolve));
    net.netStart = Date.now();
    await client.send('Page.navigate', { url: URL_TARGET });
    // A real slow-3G load of a JS-heavy SPA can exceed a minute. Wait long
    // enough that we measure the page, not a half-loaded document.
    const timedOut = await Promise.race([loaded.then(() => false), sleep(BUDGET_MS).then(() => true)]);
    await sleep(3000); // let LCP settle and lazy below-the-fold images resolve

    const a = JSON.parse((await client.send('Runtime.evaluate', {
      expression: 'JSON.stringify(window.__audit || {})', returnByValue: true,
    })).result.value || '{}');
    const seo = (await client.send('Runtime.evaluate', {
      expression: AUDIT_SNIPPET, returnByValue: true,
    })).result.value;
    const nav = JSON.parse((await client.send('Runtime.evaluate', {
      expression: `(() => { const n = performance.getEntriesByType('navigation')[0];
        const f = performance.getEntriesByName('first-contentful-paint')[0];
        return JSON.stringify({ ttfb: n && n.responseStart, dcl: n && n.domContentLoadedEventEnd,
          load: n && n.loadEventEnd, fcp: f && f.startTime, protocol: n && n.nextHopProtocol }); })()`,
      returnByValue: true,
    })).result.value || '{}');
    const metrics = (await client.send('Performance.getMetrics')).metrics;
    const pick = (name) => metrics.find((m) => m.name === name)?.value ?? null;

    const tbt = Math.round(a.longTaskMs || 0); // INP proxy when no interaction occurs
    const rows = [
      ['First Contentful Paint', nav.fcp, 1800, 3000],
      ['Largest Contentful Paint', a.lcp, 2500, 4000],
      ['Total Blocking Time (long tasks)', tbt, 200, 600],
      ['Time to First Byte', nav.ttfb, 800, 1800],
      ['DOMContentLoaded', nav.dcl, 2000, 4000],
      ['Load', nav.load, 3000, 5000],
    ];

    console.log('\n' + '='.repeat(78));
    console.log(` SPEED AUDIT - ${LABEL}${isMobile ? ' (iPhone 390x844 @3x, touch)' : ' (desktop 1440x900)'}`);
    console.log(` ${URL_TARGET}`);
    console.log(` ${isMobile ? '390x844 @3x, touch' : '1440x900'} | CPU ${CPU_RATE}x${CPU_RATE > 1 ? ' (Lighthouse mobile)' : ''} | [${profile.label}]`);
    console.log('='.repeat(78));
    console.log('\n Metric                                  Value      Grade   Target');
    console.log(' ' + '-'.repeat(74));
    for (const [label, value, good] of rows) {
      const g = grade(value, good, good * 2);
      console.log(` ${label.padEnd(38)} ${ms(value).padStart(9)}   ${g}   <= ${ms(good)}`);
    }
    console.log(` ${'Cumulative Layout Shift (CLS)'.padEnd(38)} ${String((a.cls ?? 0).toFixed(4)).padStart(9)}   ${grade((a.cls ?? 0) * 1000, 100, 250)}   <= 0.100`);
    console.log(' ' + '-'.repeat(74));
    console.log(` HTTP protocol              ${nav.protocol || 'n/a'}`);
    console.log(` Requests / transferred     ${net.requests} / ${kb(net.bytes)}`);
    console.log(` DOM nodes                  ${Math.round(pick('Nodes') ?? seo.domNodes ?? 0)}`);
    console.log(` Script / Layout / Recalc   ${Math.round((pick('ScriptDuration') ?? 0) * 1000)} / ${Math.round((pick('LayoutDuration') ?? 0) * 1000)} / ${Math.round((pick('RecalcStyleDuration') ?? 0) * 1000)} ms`);
    console.log(` Long tasks                 ${a.longTasks ?? 0} (${tbt} ms total)`);
    console.log(` Forced reflows detected   ${a.forcedReflows ?? 0}`);
    if (a.lcpEl) console.log(` LCP element                ${a.lcpEl}`);
    if (a.lcpHistory && a.lcpHistory.length > 1) {
      console.log('\n LCP entry history (same id = same element re-painted; new id = replaced):');
      a.lcpHistory.forEach((h, i) =>
        console.log(`   #${i + 1}  ${String(h.at).padStart(5)}ms  id=${h.id || '?'}  size=${h.size}  load=${h.load}ms  ${h.el}${h.url ? ' <- ' + h.url : ''}`));
    }
    if (a.tasks?.length) {
      console.log('\n Long tasks (INP blockers), worst first:');
      a.tasks.slice().sort((x, y) => y.ms - x.ms).slice(0, 6)
        .forEach((t) => console.log(`   ${String(t.ms).padStart(4)}ms at ${String(t.at).padStart(5)}ms  ${t.src || 'unattributed'}`));
    }

    if (a.shifts?.length) {
      console.log('\n Layout shifts (the CLS offenders):');
      a.shifts.slice(0, 6).forEach((s) => console.log(`   +${s.value} at ${s.at}ms  on <${[...new Set(s.nodes)].join('>, <')}>`));
    }
    const heavy = net.largest.sort((x, y) => y.size - x.size).slice(0, 6);
    if (heavy.length) {
      console.log('\n Heaviest responses:');
      heavy.forEach((h) => console.log(`  ${kb(h.size).padStart(9)}  ${h.url}`));
    }
    if (has('waterfall')) {
      const fcp = Math.round(nav.fcp || 0);
      const wf = [...net.waterfall.values()]
        .filter((r) => r.start <= fcp + 1500)
        .sort((x, y) => x.start - y.start);
      console.log(`\n Waterfall (requests starting by FCP ${fcp}ms + 1.5s):`);
      console.log('    start      end       ms      KB  priority    type      url');
      for (const r of wf) {
        const end = r.end == null ? '    ...' : String(r.end).padStart(8);
        const dur = r.end == null ? '    ...' : String(r.end - r.start).padStart(8);
        const size = (r.size / 1024).toFixed(1).padStart(7);
        const prio = String(r.priority || '-').padEnd(12);
        const type = String(r.type || '-').padEnd(10);
        const u = r.url.replace(/^https?:\/\//, '');
        console.log(`  ${String(r.start).padStart(6)}${end}${dur}${size}  ${prio}${type}${u.slice(0, 84)}${r.failed ? '  [FAILED]' : ''}`);
      }
      if (!wf.length) console.log('  (nothing recorded)');
    }
    if (timedOut) {
      console.log('\n *** LOAD EVENT NEVER FIRED within the budget - the metrics below are');
      console.log(' *** INCOMPLETE and must NOT be read as passing. Treat this run as FAIL.');
    }
    console.log('='.repeat(78));
    printSeo(seo);
    console.log('\n Targets from the spec: LCP < 2.5s | CLS < 0.1 | INP < 200ms');
    console.log(' (INP is reported as total long-task time - a no-interaction proxy.)');

    return {
      fcp: nav.fcp ?? 0, lcp: a.lcp ?? 0, cls: a.cls ?? 0, tbt,
      ttfb: nav.ttfb ?? 0, dcl: nav.dcl ?? 0, load: nav.load ?? 0,
      nodes: Math.round(pick('Nodes') ?? seo.domNodes ?? 0),
      bytes: net.bytes, requests: net.requests, timedOut,
    };
  } finally {
    client.close();
    killChrome(child.pid);
  }
}

/** Median of a numeric list. Used because single runs are noisy. */
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Repeats the audit and reports the MEDIAN.
 *
 * One run is not evidence: repeated measurements of the same build moved TBT by
 * 1138 ms -> 1990 ms, which is enough to flip a pass/fail verdict. Three runs
 * with the median keeps the reported number tied to the build, not the machine.
 */
const RUNS = Math.max(1, Number(flag('runs', 1)));
const results = [];
for (let i = 0; i < RUNS; i++) {
  if (i > 0) console.log(`\n--- run ${i + 1} of ${RUNS} ---`);
  results.push(await audit());
}

if (RUNS > 1) {
  console.log('\n' + '='.repeat(78));
  console.log(` MEDIAN OF ${RUNS} RUNS - ${LABEL}`);
  console.log('='.repeat(78));
  const rows = [
    ['First Contentful Paint', results.map((r) => r.fcp), 1800],
    ['Largest Contentful Paint', results.map((r) => r.lcp), 2500],
    ['Total Blocking Time (long tasks)', results.map((r) => r.tbt), 200],
    ['Time to First Byte', results.map((r) => r.ttfb), 800],
    ['DOMContentLoaded', results.map((r) => r.dcl), 2000],
    ['Load', results.map((r) => r.load), 3000],
  ];
  console.log('\n Metric                                  Median    All runs                 Grade');
  console.log(' ' + '-'.repeat(74));
  for (const [label, xs, good] of rows) {
    const m = median(xs);
    const all = xs.map((v) => Math.round(v)).join(', ');
    console.log(` ${label.padEnd(38)} ${ms(m).padStart(9)}   ${all.padEnd(22)}  ${grade(m, good, good * 2)}`);
  }
  const clsMed = median(results.map((r) => r.cls));
  console.log(` ${'Cumulative Layout Shift (CLS)'.padEnd(38)} ${clsMed.toFixed(4).padStart(9)}   ${results.map((r) => r.cls.toFixed(4)).join(', ').padEnd(22)}  ${grade(clsMed * 1000, 100, 250)}`);
  console.log(' ' + '-'.repeat(74));
  const incomplete = results.filter((r) => r.timedOut).length;
  if (incomplete) console.log(` *** ${incomplete}/${RUNS} runs never finished loading - treat as FAIL ***`);
  console.log('='.repeat(78));
}

await audit();
