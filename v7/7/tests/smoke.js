#!/usr/bin/env node
/* v7 smoke harness. Node only, no dependencies.

   Loads every asset in prototype.html's order into one context with a stub DOM, boots V7, then calls every
   registered route's renderFn with sampled params: every plant, equipment (at most 3 per type per plant), alert,
   issue, task and library type, plus every in-app link found in the output (a bounded crawl, so tabs and filters
   are covered too). It fails on: a load error, a throw, a non-string result, banned words or decision IDs in the
   visible text (tags and attribute values stripped first), "undefined"/"NaN"/"[object Object]" on screen, and dead
   links (an href "#/…" no route matches) once every module is present. A second pass re-renders after the story
   clock moves on a day.
   A banned word or ID that sits inside verbatim library or workbook text (ISSUES, ISSUE_TASKS, flows, causes,
   catalogue, readings: e.g. "dead zones", "W1" in a lab step) is reported as a warning ("data-word"), not a failure:
   the words are in the data itself, so rewording them is a content decision, not a page bug.

   The decisions strip (decisions7.js, under each page header) is checked on its own on every render: markerHtml never
   throws for either prototype, the strip is on the page exactly when markerHtml says so, once, between the page
   header and the tabs, never on a Decisions page, and its own words are clean (its card ids are allowed). A third
   pass renders a sample of every route again with the strip on: while no card carries `where`, each card temporarily
   gets the routes of its own links (and every third card the same routes at any plant), so "+n more" shows too.

   Usage   node tests/smoke.js [options]
     --only=<text>     render only routes whose pattern contains <text> (e.g. --only=eq)
     --max=<n>         renders per route pattern (default 600)
     --no-crawl        render the sampled params only, do not follow links
     --no-advance      skip the second pass after V7.advance(1440)
     --strict          missing assets and dead links fail even while modules are missing
     --stub[=<file>]   when core7.js is missing, load this stub instead (default tests/ui7.stub.js)
     --list            list routes and sample counts, then exit
     -v, --verbose     print every failure and warning (default: the first 25 of each)
   Exit code 0 = pass, 1 = failures. Requiring this file exports the checkers {visibleText, scan, BANNED}. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const DEFAULT_ORDER = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js',
  'core7.js', 'ui7.js', 'peek74.js', 'plant7.js', 'object7.js', 'lib7.js', 'work7.js', 'decisions7.js'];

/* ── words on screen ───────────────────────────────────────────────────────────────────────── */
const BANNED = [
  ['machine', /\bmachines?\b/i], ['Custom', /\bcustom\b/i], ['widget', /\bwidgets?\b/i], ['estate', /\bestates?\b/i],
  /* v7/3: a range "triggers" an issue or a task (card D29), and stages group unit processes (card D1) */ ['Zones', /\bzones?\b/i], ['Binding', /\bbindings?\b/i], ['Persistence', /\bpersistence\b/i],
  ['Derived', /\bderived\b/i],   /* v7/3 builds unit processes and control groups (card D1), so those two words are on screen */
  ['diverged', /\bdiverg(e|ed|es|ing|ence)\b/i], ['stale', /\bstale\b/i],
  ['PRD', /\bPRD\b/], ['AC number', /\bAC-?\d+\b/], ['section number', /§\s*\d/],
];
const IDS = [/\b(CM|C|O)-\d{1,2}\b/, /\bD\d{1,2}\b/, /\bE\d\b/, /\bW\d{1,2}[a-d]?\b/, /\bV7-\d+\b/];
const JUNK = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Invalid Date/, /\$\{/];

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', rarr: '→', larr: '←', hellip: '…', times: '×', bull: '•', rsaquo: '›', lsaquo: '‹', deg: '°', micro: 'µ', copy: '©' };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m;
  });
}
const TAG = /<\/?[a-zA-Z][^\s>\/]*(?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/g;
function visibleText(html) {
  return decode(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(TAG, ' ')
    .replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}
function context(text, idx, len) { const a = Math.max(0, idx - 40); return (a > 0 ? '…' : '') + text.slice(a, idx + len + 40).trim() + (idx + len + 40 < text.length ? '…' : ''); }
/* The decisions strip (<aside class="dec-mark">, from decisions7.js) is a study note laid over a screen, not the app's
   own words: it names v7's own decision cards (D1…Dn) and quotes their text. scan() leaves it out unless {marks:true};
   the smoke run checks the strip on its own (checkMarks: placement, never throws, its own words). */
const MARK_RE = /<aside class="dec-mark"[\s\S]*?<\/aside>/g;
function withoutMarks(html) { return String(html == null ? '' : html).replace(MARK_RE, ' '); }
function markStrips(html) { return String(html == null ? '' : html).match(MARK_RE) || []; }
/* scan(html, {ids:true, marks:false}) → [{kind:'banned'|'id'|'junk', word, ctx}] */
function scan(html, o) {
  const text = visibleText(o && o.marks ? html : withoutMarks(html));
  const out = [];
  const all = (re) => { const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); const r = []; let m; while ((m = g.exec(text)) && r.length < 50) { r.push(m); if (!m[0]) g.lastIndex++; } return r; };
  const fromData = (m) => !!(o && o.isData && o.isData(text, m.index, m[0].length));
  for (const [word, re] of BANNED) {
    const ms = all(re); const ui = ms.find((m) => !fromData(m));
    if (ui) out.push({ kind: 'banned', word, ctx: context(text, ui.index, ui[0].length) });
    else if (ms.length) out.push({ kind: 'data-word', word, ctx: context(text, ms[0].index, ms[0][0].length) });
  }
  if (!o || o.ids !== false) for (const re of IDS) {
    const ms = all(re); const ui = ms.find((m) => !fromData(m));
    if (ui) out.push({ kind: 'id', word: ui[0], ctx: context(text, ui.index, ui[0].length) });
    else if (ms.length) out.push({ kind: 'data-word', word: ms[0][0], ctx: context(text, ms[0].index, ms[0][0].length) });
  }
  for (const re of JUNK) { const m = re.exec(text); if (m) out.push({ kind: 'junk', word: m[0], ctx: context(text, m.index, m[0].length) }); }
  return out;
}
function links(html) {
  const out = new Set();
  const re = /\s(?:href|data-href)\s*=\s*("([^"]*)"|'([^']*)')/gi; let m;
  while ((m = re.exec(String(html || '')))) { const v = decode(m[2] != null ? m[2] : m[3]); if (v[0] === '#') out.add(v); }
  return [...out];
}
/* verbatim data text, to tell UI copy from library/workbook content (and, on the Decisions page, from the cards' quoted text) */
const DATA_GLOBALS = ['ISSUES', 'ISSUE_TASKS', 'SEED', 'CATALOGUE', 'READINGS', 'PLANT_PROFILES', 'NEXT_PHASE_FLOWS', 'NEXT_PHASE_CAUSES', 'RCA_MAPS', 'FORM_RULES', 'SCADA_FORM', 'DB_PALETTE'];
function corpusOf(W, names) {
  const seen = new Set(); const parts = [];
  const walk = (x, d) => {
    if (x == null || d > 8) return;
    if (typeof x === 'string') { if (x.length > 3) parts.push(x.replace(/\s+/g, ' ')); return; }
    if (typeof x !== 'object' || seen.has(x)) return; seen.add(x);
    if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1)); else Object.keys(x).forEach((k) => walk(x[k], d + 1));
  };
  (names || DATA_GLOBALS).forEach((g) => walk(W[g], 0));
  return parts.join('\n');
}
/* isDataIn(corpus) → (text, index, length) → true when the match sits inside verbatim corpus text */
function isDataIn(corpus) {
  return (text, i, len) => {
    if (!corpus) return false;
    const left = text.slice(Math.max(0, i - 16), i + len).trim(); const right = text.slice(i, i + len + 16).trim();
    return (left.length > len + 3 && corpus.includes(left)) || (right.length > len + 3 && corpus.includes(right)) || corpus.includes(text.slice(Math.max(0, i - 6), i + len + 6));
  };
}
/* decisionsCorpus(W): the decision cards' own text (Alex's quoted words, evidence) and the plain words for Alex's IDs */
function decisionsCorpus(W) {
  const dec = W.V7DEC || {};
  const ids = dec.IDS ? Object.keys(dec.IDS).map((k) => dec.IDS[k]) : [];
  return corpusOf({ V7_DECISIONS: W.V7_DECISIONS, IDS: ids }, ['V7_DECISIONS', 'IDS']);
}
module.exports = { visibleText, scan, links, BANNED, IDS, JUNK, decode, installDom, corpusOf, isDataIn, decisionsCorpus, MARK_RE, withoutMarks, markStrips };
if (require.main !== module) return;

/* ── arguments ───────────────────────────────────────────────────────────────────────────────────────────── */
const ARGS = { max: 600, crawl: true, advance: true, strict: false, verbose: false, only: '', stub: null, list: false };
for (const a of process.argv.slice(2)) {
  if (a === '--no-crawl') ARGS.crawl = false;
  else if (a === '--no-advance') ARGS.advance = false;
  else if (a === '--strict') ARGS.strict = true;
  else if (a === '-v' || a === '--verbose') ARGS.verbose = true;
  else if (a === '--list') ARGS.list = true;
  else if (a.startsWith('--only=')) ARGS.only = a.slice(7);
  else if (a.startsWith('--max=')) ARGS.max = Math.max(1, +a.slice(6) || 600);
  else if (a === '--stub') ARGS.stub = path.join(__dirname, 'ui7.stub.js');
  else if (a.startsWith('--stub=')) ARGS.stub = path.resolve(a.slice(7));
  else { console.error('unknown option ' + a); process.exit(2); }
}

/* ── stub DOM: enough for string-rendering routes and for modules that touch the DOM at load ────────────────── */
function installDom() {
  const g = global;
  const classList = () => { const s = new Set(); return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => { const on = f === undefined ? !s.has(c) : !!f; if (on) s.add(c); else s.delete(c); return on; }, contains: (c) => s.has(c), get length() { return s.size; } }; };
  function el(tag) {
    const e = {
      tagName: String(tag || 'div').toUpperCase(), nodeName: String(tag || 'div').toUpperCase(), nodeType: 1, children: [], childNodes: [], style: {}, dataset: {}, attributes: {},
      innerHTML: '', outerHTML: '', textContent: '', innerText: '', value: '', checked: false, disabled: false, className: '', id: '', name: '', type: '',
      classList: classList(), parentNode: null, parentElement: null, firstChild: null, lastChild: null, nextSibling: null, previousSibling: null,
      offsetTop: 0, offsetLeft: 0, offsetHeight: 0, offsetWidth: 0, scrollTop: 0, scrollLeft: 0, scrollHeight: 0, clientHeight: 0, clientWidth: 0,
      setAttribute(k, v) { this.attributes[k] = String(v); }, getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }, removeAttribute(k) { delete this.attributes[k]; }, toggleAttribute() { return false; },
      addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
      appendChild(c) { this.children.push(c); return c; }, removeChild(c) { return c; }, insertBefore(c) { return c; }, replaceChild(c) { return c; },
      append() {}, prepend() {}, after() {}, before() {}, remove() {}, replaceWith() {}, insertAdjacentHTML() {}, insertAdjacentElement() {}, cloneNode() { return el(tag); },
      querySelector() { return null; }, querySelectorAll() { return []; }, getElementsByTagName() { return []; }, getElementsByClassName() { return []; },
      closest() { return null; }, matches() { return false; }, contains() { return false; },
      focus() {}, blur() {}, click() {}, select() {}, scrollIntoView() {}, scrollTo() {}, scrollBy() {}, setSelectionRange() {}, showModal() {}, close() {},
      getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; }, getClientRects() { return []; },
      animate() { return { finished: Promise.resolve(), cancel() {} }; },
    };
    return e;
  }
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(), key: (i) => [...m.keys()][i] || null, get length() { return m.size; } }; };
  g.window = g; g.self = g; g.globalThis = g;
  const doc = el('#document');
  Object.assign(doc, {
    nodeType: 9, body: el('body'), head: el('head'), documentElement: el('html'), activeElement: null, title: '', cookie: '', readyState: 'complete', hidden: false, visibilityState: 'visible',
    createElement: el, createElementNS: (ns, t) => el(t), createTextNode: (t) => ({ nodeType: 3, textContent: String(t) }), createDocumentFragment: () => el('#fragment'), createRange: () => ({ selectNodeContents() {}, setStart() {}, setEnd() {} }),
    getElementById: () => null, getSelection: () => ({ removeAllRanges() {}, addRange() {} }), execCommand: () => false, contains: () => false, hasFocus: () => true,
  });
  g.document = doc;
  g.location = { hash: '#/plants', href: 'http://localhost/prototype.html#/plants', pathname: '/prototype.html', search: '', origin: 'http://localhost', host: 'localhost', protocol: 'http:', reload() {}, assign() {}, replace() {} };
  g.history = { length: 1, state: null, replaceState() {}, pushState() {}, back() {}, forward() {}, go() {} };
  try { Object.defineProperty(g, 'navigator', { value: { userAgent: 'node-smoke', language: 'en-IN', languages: ['en-IN'], clipboard: { writeText: () => Promise.resolve(), readText: () => Promise.resolve('') }, onLine: true }, configurable: true, writable: true }); } catch (e) { /* keep node's */ }
  g.localStorage = store(); g.sessionStorage = store();
  g.addEventListener = () => {}; g.removeEventListener = () => {}; g.dispatchEvent = () => true;
  g.innerWidth = 1280; g.innerHeight = 800; g.devicePixelRatio = 1; g.scrollX = 0; g.scrollY = 0; g.pageYOffset = 0;
  g.scrollTo = () => {}; g.scrollBy = () => {};
  g.matchMedia = () => ({ matches: false, media: '', addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  g.requestAnimationFrame = () => 0; g.cancelAnimationFrame = () => {};
  g.requestIdleCallback = () => 0; g.cancelIdleCallback = () => {};
  g.getComputedStyle = () => ({ getPropertyValue: () => '' });
  g.CSS = { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c), supports: () => false };
  g.alert = () => {}; g.confirm = () => true; g.prompt = () => null; g.print = () => {}; g.open = () => null;
  g.Event = g.Event || class Event { constructor(t, o) { this.type = t; Object.assign(this, o || {}); } preventDefault() {} stopPropagation() {} };
  g.CustomEvent = g.CustomEvent || class CustomEvent extends g.Event { constructor(t, o) { super(t, o); this.detail = o && o.detail; } };
  g.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
  g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  g.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  g.HTMLElement = g.HTMLElement || class HTMLElement {};
  g.Element = g.Element || class Element {};
  g.Node = g.Node || class Node {};
  g.Blob = g.Blob || class Blob {};
  if (!g.URL.createObjectURL) g.URL.createObjectURL = () => 'blob:smoke';
  if (!g.URL.revokeObjectURL) g.URL.revokeObjectURL = () => {};
  g.V7_NO_V6_SHELL = true;
}

/* ── run ─────────────────────────────────────────────────────────────────────────────────────────────────── */
const T0 = performance.now();
const FAIL = []; const WARN = [];
const fail = (kind, where, msg, extra) => FAIL.push({ kind, where, msg, extra });
const warn = (kind, where, msg, extra) => WARN.push({ kind, where, msg, extra });
function frame(e) {
  const st = String(e && e.stack || '');
  const line = st.split('\n').find((l) => /[\\/](assets|tests)[\\/][^\\/]+\.js/.test(l));
  const m = line && line.match(/[\\/]((?:assets|tests)[\\/][^\\/:]+\.js):(\d+)/);
  return m ? `${m[1].replace(/\\/g, '/')}:${m[2]}` : '';
}
function errMsg(e) { return `${e && e.name ? e.name + ': ' : ''}${e && e.message ? e.message : String(e)}${frame(e) ? '  (' + frame(e) + ')' : ''}`; }

process.on('uncaughtException', (e) => { fail('async', 'timer or callback', errMsg(e)); });
process.on('unhandledRejection', (e) => { warn('async', 'promise', errMsg(e)); });

installDom();
const consoleErrors = []; let capture = false;
const origError = console.error; const origWarn = console.warn;
console.error = (...a) => { if (capture) consoleErrors.push(a.map((x) => (x && x.message ? x.message : String(x))).join(' ')); else origError(...a); };
console.warn = (...a) => { if (capture) consoleErrors.push('warn: ' + a.map(String).join(' ')); else origWarn(...a); };

function scriptOrder() {
  try {
    const html = fs.readFileSync(path.join(ROOT, 'prototype.html'), 'utf8');
    const re = /<script[^>]*\bsrc\s*=\s*["']assets\/([^"'?]+)(?:\?[^"']*)?["']/gi; const out = []; let m;
    while ((m = re.exec(html))) out.push(m[1]);
    if (out.length >= 7) return { order: out, from: 'prototype.html' };
  } catch (e) { /* fall back */ }
  return { order: DEFAULT_ORDER, from: 'built-in list' };
}
const { order: ORDER, from: ORDER_FROM } = scriptOrder();
const missing = []; const loaded = []; let stubbed = false;
for (const f of ORDER) {
  let file = path.join(ASSETS, f);
  if (!fs.existsSync(file)) {
    if (f === 'core7.js' && ARGS.stub && fs.existsSync(ARGS.stub)) { file = ARGS.stub; stubbed = true; }
    else { missing.push(f); continue; }
  }
  try { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); loaded.push(f); }
  catch (e) { fail('load', f, errMsg(e)); }
}
const allPresent = missing.length === 0;
const W = global; const UI = W.V7UI; const V7 = W.V7;
if (missing.length) (ARGS.strict ? fail : warn)('missing', 'assets', missing.join(', '));
if (!UI) { fail('load', 'ui7.js', 'window.V7UI is not defined'); return finish(); }
if (!V7) { fail('load', 'core7.js', 'window.V7 is not defined' + (missing.includes('core7.js') ? ' (core7.js missing; try --stub)' : '')); }
if (V7 && typeof V7.boot === 'function') { try { V7.boot(); } catch (e) { fail('boot', 'V7.boot()', errMsg(e)); } }

const CORPUS = corpusOf(W);
const isData = isDataIn(CORPUS);
/* The Decisions page quotes Alex's pack and v6 in order to decide on their words (card D14 asks for this): a banned
   word inside a card's own text is a warning there; the page's own copy is still checked. */
const DEC_CORPUS = decisionsCorpus(W);
const isDecData = isDataIn(DEC_CORPUS);
const isDataOnDecisions = (text, i, len) => isData(text, i, len) || isDecData(text, i, len);
const call = (fn, fb) => { try { const v = fn(); return v == null ? fb : v; } catch (e) { return fb; } };
const arr = (x) => (Array.isArray(x) ? x : []);
function plantKeys() { return arr(call(() => V7.plants(), [])).map((p) => p && p.key).filter(Boolean); }
const SAMPLED_EQ = new Map();          // plant → Set(eqId) actually rendered
function sampleEq(key) {
  const groups = new Map();
  for (const e of arr(call(() => V7.equipment(key), []))) {
    if (!e || e.id == null) continue;
    const t = e.type || e.typeName || e.dbType || e.code || '?';
    if (!groups.has(t)) groups.set(t, []);
    if (groups.get(t).length < 3) groups.get(t).push(String(e.id));
  }
  const ids = [].concat(...groups.values());
  SAMPLED_EQ.set(key, new Set(ids));
  return ids;
}
const idsOf = (list) => arr(list).map((x) => x && (x.id != null ? x.id : x.pid)).filter((x) => x != null).map(String);
function libCodes() { const c = idsOf(arr(call(() => V7.libTypes(), [])).map((t) => ({ id: t && (t.code || t.id) }))); return c.length ? c : arr(W.CATALOGUE).map((t) => t.code); }
function decisionIds() { const d = arr(W.V7_DECISIONS).map((x) => x && x.id).filter(Boolean); return d.length ? d : Array.from({ length: 21 }, (_, i) => 'D' + (i + 1)); }
const HARVEST = new Map();               // `${pattern}|${param}` → Set(values) seen in links
const UNSAMPLED = new Set();
function sample(param, prevLit, bound, pattern, optional) {
  const key = bound.plant || bound.key || bound.plantKey;
  const p = String(param);
  if (/^(plant|key|plantKey)$/.test(p)) return plantKeys();
  if (prevLit === 'eq' || /^eq(Id)?$/.test(p)) return key ? sampleEq(key) : [];
  if (prevLit === 'alert' || p === 'alertId') return key ? idsOf(call(() => V7.alerts(key, {}), [])) : [];
  if (prevLit === 'issue' || p === 'issueId') return key ? idsOf(call(() => V7.issues(key, {}), [])) : [];
  if (prevLit === 'task' || p === 'taskId') { if (!key) return []; const t = idsOf(call(() => V7.tasks(key, {}), [])); return t.length ? t : idsOf(call(() => V7.schedules(key, {}), [])); }
  if (prevLit === 'library' || p === 'code' || p === 'typeCode') return libCodes();
  if (prevLit === 'decisions') return decisionIds();
  const h = HARVEST.get(pattern + '|' + p);
  if (h && h.size) return [...h];
  if (!optional) UNSAMPLED.add(`${pattern} :${p}`);
  return [];
}
function expand(r) {
  let combos = [{ parts: [], bound: {} }];
  r.segs.forEach((s, i) => {
    const prevLit = i > 0 && r.segs[i - 1].lit ? r.segs[i - 1].lit : null;
    const next = [];
    for (const c of combos) {
      if (s.lit) { next.push({ parts: c.parts.concat(s.lit), bound: c.bound }); continue; }
      if (s.opt) next.push(c);
      for (const v of sample(s.param, prevLit, c.bound, r.pattern, s.opt)) next.push({ parts: c.parts.concat(encodeURIComponent(v)), bound: Object.assign({}, c.bound, { [s.param]: v }) });
    }
    combos = next;
  });
  return combos.map((c) => c.parts.join('/'));
}

const STATS = new Map(); const RENDERED = new Set(); const QUEUE = []; const DEAD = new Map();
let pass = 'start'; let renders = 0;
const stat = (pattern) => { if (!STATS.has(pattern)) STATS.set(pattern, { n: 0, fail: 0, ms: 0, slow: '' }); return STATS.get(pattern); };
function isSampledEq(m) {
  const segs = m.route.segs; const params = m.params;
  for (let i = 1; i < segs.length; i++) if (!segs[i].lit && segs[i - 1].lit === 'eq') {
    const key = params.plant || params.key; const id = params[segs[i].param];
    if (key && id != null) { if (!SAMPLED_EQ.has(key)) sampleEq(key); return SAMPLED_EQ.get(key).has(String(id)); }
  }
  return true;
}
function checkLinks(html, where) {
  for (const href of links(html)) {
    if (href === '#' || href === '#/') { warn('link', where, `bare "${href}" link (use data-act or a route)`); continue; }
    if (!href.startsWith('#/')) continue;
    const m = UI.match(href);
    if (!m) { if (!DEAD.has(href)) DEAD.set(href, where); continue; }
    if (!ARGS.crawl || pass !== 'start') continue;
    const p = href.slice(2);
    if (RENDERED.has(p)) continue;
    if (ARGS.only && !m.pattern.includes(ARGS.only)) continue;
    m.route.segs.forEach((s) => { if (!s.lit && m.params[s.param] != null) { const k = m.pattern + '|' + s.param; if (!HARVEST.has(k)) HARVEST.set(k, new Set()); HARVEST.get(k).add(m.params[s.param]); } });
    if (!isSampledEq(m)) continue;
    QUEUE.push(p);
  }
}
function checkHtml(html, where, pattern) {
  const ids = !/^decisions/.test(pattern || '');
  for (const f of scan(html, { ids, isData: ids ? isData : isDataOnDecisions })) {
    if (f.kind === 'data-word' && !ids) { warn('quoted', where, `"${f.word}" quoted in a decision card`, f.ctx); continue; }
    if (f.kind === 'data-word') { warn('data-word', where, `"${f.word}" inside verbatim library or workbook text`, f.ctx); continue; }
    fail(f.kind, where, `"${f.word}"`, f.ctx);
  }
  checkLinks(html, where);
}
function renderOne(p) {
  if (RENDERED.has(p + '@' + pass)) return;
  RENDERED.add(p + '@' + pass); if (pass === 'start') RENDERED.add(p);
  const m = UI.match('#/' + p);
  if (!m) { warn('route', '#/' + p, 'no route matches'); return; }
  const st = stat(m.pattern);
  if (st.n >= ARGS.max) return;
  st.n++; renders++;
  W.location.hash = '#/' + p; W.location.href = 'http://localhost/prototype.html#/' + p;
  const where = '#/' + p + (pass === 'start' ? '' : '  [' + pass + ']');
  consoleErrors.length = 0; capture = true;
  const t = performance.now(); let out; let err = null;
  try { out = m.route.fn(m.params); } catch (e) { err = e; }
  const ms = performance.now() - t; capture = false;
  if (ms > st.ms) { st.ms = ms; st.slow = p; }
  if (ms > 1500) warn('slow', where, `${Math.round(ms)} ms`);
  consoleErrors.splice(0).forEach((e) => warn('console', where, e));
  if (err) { st.fail++; fail('throw', where, errMsg(err)); return; }
  if (typeof out !== 'string') { st.fail++; fail('type', where, `renderFn returned ${out === null ? 'null' : typeof out}, not an html string`); return; }
  if (!out.trim()) warn('empty', where, 'rendered an empty string');
  const before = FAIL.length;
  checkHtml(out, where, m.pattern);
  checkMarks(out, p, where, m.pattern);
  if (FAIL.length > before) st.fail++;
}
/* the decisions strip on this render: never throws (either prototype), on the page exactly when markerHtml says so, once,
   after the page header and before the tabs, never on a Decisions page; its own words clean, card text quoted */
const MARKS = { pages: 0, fixture: 0, more: 0 };
function checkMarks(html, p, where, pattern) {
  const D = W.V7DEC;
  if (!D || typeof D.markerHtml !== 'function') return;
  const v = W.V7_VARIANT == null ? '1' : String(W.V7_VARIANT);
  let mine = '';
  for (const variant of ['1', '2']) {
    let m;
    try { m = D.markerHtml(variant, p); } catch (e) { fail('marks', where, `the decisions strip threw (prototype ${variant}): ${errMsg(e)}`); continue; }
    if (typeof m !== 'string') { fail('marks', where, `markerHtml returned ${m === null ? 'null' : typeof m}, not a string`); continue; }
    if (variant === v) mine = m;
  }
  const strips = markStrips(html);
  if (/^decisions/.test(pattern || '')) { if (strips.length || mine) fail('marks', where, 'a Decisions page carries the decisions strip'); return; }
  if (!mine) { if (strips.length) fail('marks', where, 'the page carries a strip that markerHtml does not give'); return; }
  if (strips.length !== 1 || strips[0] !== mine) { fail('marks', where, `${strips.length} strips on the page, want exactly the one markerHtml gives`); return; }
  MARKS.pages++; if (pass === 'strip') { MARKS.fixture++; if (/class="dm dm-more"/.test(mine)) MARKS.more++; }
  const at = html.indexOf(mine); const head = html.indexOf('<header class="ph">'); const tabs = html.indexOf('<nav class="tabs"');
  if (head >= 0 && at < html.indexOf('</header>', head)) fail('marks', where, 'the strip sits inside or before the page header');
  if (tabs >= 0 && at > tabs) fail('marks', where, 'the strip sits after the tabs');
  for (const f of scan(mine, { ids: false, marks: true, isData: isDataOnDecisions })) {
    if (f.kind === 'data-word') { warn('quoted', where + ' (decisions strip)', `"${f.word}" quoted in a decision card`, f.ctx); continue; }
    fail(f.kind, where + ' (decisions strip)', `"${f.word}"`, f.ctx);
  }
}

const ROUTES = UI.routes();
if (ARGS.list) {
  for (const r of ROUTES) console.log(`${r.pattern.padEnd(34)} ${expand(r).length} sampled`);
  process.exit(0);
}
// shell chrome (top bar + story panel)
for (const p of ['plants', 'p/digitalpaani', 'p/vedanta', 'p/manesar', 'library', 'differences', 'decisions']) {
  let html = '';
  try { html = UI.chromeHtml(p); } catch (e) { fail('throw', 'shell ' + p, errMsg(e)); }
  checkHtml(html, 'shell (top bar + story) at #/' + p, 'shell');
}
// story deep links resolve
try { for (const c of UI.chapters()) { for (const h of [c.href].concat(c.also.map((a) => a.href))) if (!UI.match(h)) DEAD.set(h, 'story chapter ' + c.n); } } catch (e) { fail('throw', 'story chapters', errMsg(e)); }

// pass 1: sampled params, then the crawl
for (const r of ROUTES) { if (ARGS.only && !r.pattern.includes(ARGS.only)) continue; for (const p of expand(r)) QUEUE.push(p); }
while (QUEUE.length && renders < 20000) renderOne(QUEUE.shift());
const pass1 = { renders, ms: performance.now() - T0 };

// unknown route falls back to All Plants
try { const html = UI.renderPath('#/no/such/page'); if (!/All Plants/.test(visibleText(html))) fail('router', '#/no/such/page', 'unknown route did not fall back to All Plants'); } catch (e) { fail('throw', '#/no/such/page', errMsg(e)); }

// pass 2: after the story clock moves on a day
let pass2 = null;
if (ARGS.advance && V7 && typeof V7.advance === 'function') {
  const t2 = performance.now(); const r0 = renders;
  let res = null;
  try { res = V7.advance(1440); } catch (e) { fail('throw', 'V7.advance(1440)', errMsg(e)); }
  pass = '+1 day'; STATS.forEach((s) => { s.n2 = s.n; });
  const cap = ARGS.max; ARGS.max = cap * 2;
  for (const r of ROUTES) {
    if (ARGS.only && !r.pattern.includes(ARGS.only)) continue;
    if (!r.segs.some((s) => !s.lit)) { renderOne(r.pattern); continue; }
    expand(r).slice(0, 150).forEach(renderOne);
  }
  for (const p of ['plants', 'p/digitalpaani', 'p/vedanta', 'p/manesar', 'p/bawal']) try { checkHtml(UI.chromeHtml(p), 'shell [+1 day]', 'shell'); } catch (e) { fail('throw', 'shell [+1 day]', errMsg(e)); }
  ARGS.max = cap;
  pass2 = { renders: renders - r0, ms: performance.now() - t2, res: res ? Object.keys(res).filter((k) => Array.isArray(res[k])).map((k) => `${k} ${res[k].length}`).join(', ') : '' };
}

// pass 3: the decisions strip on a sample of every route. While no card carries `where` yet, each card gets the routes of
// its own links for this pass (every third card also the same routes at any plant, so "+n more" shows); restored after.
let pass3 = null;
if (W.V7DEC && Array.isArray(W.V7_DECISIONS) && W.V7_DECISIONS.length) {
  const cards = W.V7_DECISIONS; const t3 = performance.now(); const r0 = renders;
  const fixture = !cards.some((d) => d && d.where);
  const saved = cards.map((d) => (d && Object.prototype.hasOwnProperty.call(d, 'where') ? { v: d.where } : null));
  if (fixture) {
    cards.forEach((d, k) => {
      if (!d) return;
      const ps = arr(d.links).map((l) => String((l && l.href) || '').replace(/^#\/?/, '').split('?')[0]).filter(Boolean);
      d.where = { 1: ps.concat(k % 3 === 0 ? ps.map((x) => x.replace(/^p\/[^/]+/, 'p/:plant')) : []), 2: ps };
    });
  }
  pass = 'strip'; const cap = ARGS.max; ARGS.max = Infinity;
  try {
    for (const r of ROUTES) {
      if (ARGS.only && !r.pattern.includes(ARGS.only)) continue;
      if (!r.segs.some((s) => !s.lit)) { renderOne(r.pattern); continue; }
      expand(r).slice(0, 40).forEach(renderOne);
    }
  } finally {
    ARGS.max = cap;
    if (fixture) cards.forEach((d, k) => { if (!d) return; if (saved[k]) d.where = saved[k].v; else delete d.where; });
  }
  pass3 = { renders: renders - r0, ms: performance.now() - t3, fixture };
}

// dead links, grouped by shape (#/p/*/alert/*) so a missing module reads as one line
const KEYS = new Set(plantKeys());
const AFTER_ID = new Set(['eq', 'alert', 'issue', 'task', 'library', 'decisions', 'activity']);
function shape(href) {
  const [p, q] = href.slice(2).split('?');
  const segs = p.split('/').map((s, i, a) => (KEYS.has(s) || /\d/.test(s) || (i > 0 && AFTER_ID.has(a[i - 1])) ? '*' : s));
  return '#/' + segs.join('/') + (q ? '?…' : '');
}
const SHAPES = new Map();
DEAD.forEach((where, href) => { const k = shape(href); if (!SHAPES.has(k)) SHAPES.set(k, { n: 0, eg: [], where }); const s = SHAPES.get(k); s.n++; if (s.eg.length < 2) s.eg.push(href); });
SHAPES.forEach((s, k) => ((allPresent || ARGS.strict) ? fail : warn)('dead-link', s.where, `${k}  (${s.n} link${s.n > 1 ? 's' : ''}, e.g. ${s.eg.join(', ')})`));
for (const u of UNSAMPLED) warn('unsampled', u, 'no values found for this param');
const soft = arr(UI._soft);
if (soft.length) warn('soft', 'V7 calls caught by ui7', [...new Set(soft)].slice(0, 6).join(' | '));
finish();

function finish() {
  const out = [];
  const t = (performance.now() - T0) / 1000;
  out.push(`v7 smoke · ${loaded.length}/${ORDER.length} assets loaded (order from ${ORDER_FROM})${missing.length ? ' · missing: ' + missing.join(', ') : ''}${stubbed ? ' · core7.js STUBBED' : ''}`);
  if (UI) {
    out.push(`routes: ${STATS.size} rendered of ${UI.routes().length} registered · pass 1: ${pass1Text()}${pass2Text()}`);
    if (typeof pass3 !== 'undefined' && pass3) out.push(`decisions strip: on ${MARKS.pages - MARKS.fixture} page renders from the live cards · pass 3 (${pass3.fixture ? 'fixture from each card\'s links' : 'the live cards'}): ${pass3.renders} renders, ${MARKS.fixture} with a strip, ${MARKS.more} with "+n more"`);
    const rows = [...STATS.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const w = Math.max(10, ...rows.map(([p]) => p.length));
    rows.forEach(([p, s]) => out.push(`  ${p.padEnd(w)}  ${String(s.n).padStart(4)}  ${s.fail ? ('FAIL ' + s.fail).padEnd(9) : 'ok'.padEnd(9)} slowest ${Math.round(s.ms)} ms`));
    const never = UI.routes().filter((r) => !STATS.has(r.pattern) && (!ARGS.only || r.pattern.includes(ARGS.only)));
    if (never.length) out.push(`  not rendered (no sample values): ${never.map((r) => r.pattern).join(', ')}`);
  }
  const group = (list) => { const g = new Map(); list.forEach((x) => { const k = x.kind; if (!g.has(k)) g.set(k, []); g.get(k).push(x); }); return g; };
  const lim = ARGS.verbose ? Infinity : 25;
  const show = (title, list) => {
    if (!list.length) return;
    const g = group(list);
    // de-duplicate identical messages across routes
    const seen = new Map();
    list.forEach((x) => { const key = x.kind + '|' + x.msg + '|' + (x.extra || ''); if (!seen.has(key)) seen.set(key, { x, n: 0 }); seen.get(key).n++; });
    out.push(`${title} (${list.length}, ${seen.size} distinct): ` + [...g.entries()].map(([k, v]) => `${k} ${v.length}`).join(', '));
    [...seen.values()].slice(0, lim).forEach(({ x, n }) => out.push(`  [${x.kind}] ${x.where}${n > 1 ? `  (+${n - 1} more)` : ''}\n      ${x.msg}${x.extra ? '\n      ' + x.extra : ''}`));
    if (seen.size > lim) out.push(`  … ${seen.size - lim} more distinct (use -v)`);
  };
  show('FAILURES', FAIL);
  show('warnings', WARN);
  out.push(`${FAIL.length ? 'RESULT: FAIL' : 'RESULT: PASS'} · ${FAIL.length} failures · ${WARN.length} warnings · ${t.toFixed(1)} s`);
  console.log(out.join('\n'));
  process.exit(FAIL.length ? 1 : 0);
}
function pass1Text() { return pass1 ? `${pass1.renders} renders in ${(pass1.ms / 1000).toFixed(1)} s` : 'not run'; }
function pass2Text() { return pass2 ? ` · pass 2 (+1 day: ${pass2.res || 'advanced'}): ${pass2.renders} renders` : ''; }
