#!/usr/bin/env node
/* v7 · tests/docs.test.js — headless checks for the four v7 pages. Node only, no dependencies; run from site/v7:
   node tests/docs.test.js [-v]                 the checks
   node tests/docs.test.js --fill-actions       first writes each chapter's action counts into v7/2's hand-off doc, from the
                                                files the end-to-end walks write (1/tests/out/actions71.json and
                                                2/tests/out/actions72.json), then runs the checks
   CTL_V72_ROUTES=1 node tests/docs.test.js     also renders every v7/2 page the pages link, as when v7/2 is published
   Pages: index.html (the overview), challenges.html (the challenges doc), 1/index.html (v7/1's hand-off doc) and
   2/index.html (v7/2's hand-off doc).
   1. sources   each page loads only the shared decision file (plus its stylesheet and Google Fonts), has one inline
                script that says which page it is (V7_PAGE; V7_VARIANT on a hand-off), a title, a description and a
                viewport; the two pages in site/v7 carry light and dark tokens, an explicit background and a 16px gutter
                at phone width.
   2. render    each page's inline script runs against a stub DOM with the decision file, with empty storage, with calls
                stored and with storage blocked. Every card renders once with its #Dn anchor (the overview links each to
                challenges.html#Dn); the challenges doc groups the cards by when they arose, lists every reading and the
                calls about the study, and a deep link (#D15) lands on its card. v7/2's hand-off has its ten sections in
                order, every card with both columns, every reading, acceptance criteria V72-1 to V72-148 in their groups,
                the chapter action counts, and every number it quotes equal to v7/2's engine.
   3. public    the scrub patterns and the they/them check find nothing in any page source (comments included), in the
                rendered text, in README's v7 lines, in this file, or in any other file under site/v7 (every script, style
                and test that ships; only the tests' own pattern lists and a few quoted data words are allowed). v7/2's
                hand-off never names the control system outside the cards.
   4. v7/2      the pages on v7/1's side link v7/2 exactly when V7DEC.V72_READY is true: while it is false they say v7/2 is
                in build, and each page is also drawn with the flag set, to prove the links appear. Every v7/2 route any
                page links is a v7/2 route naming objects v7/2 has; with the flag true (or CTL_V72_ROUTES=1) each must also
                land on a real v7/2 page, and the overview's chapter pairs must match v7/2's story.
   5. links     every v7/1 route the pages link is a real v7/1 route that lands on a real page; every in-page anchor
                exists; every linked file exists.
   6. answers   your-call chips write ctl7.decisions; Copy my answers copies every card and the study calls, or shows the
                text to copy by hand when the browser blocks copying.
   Exit 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const APPS = require('./apps.js');

const V7 = path.resolve(__dirname, '..');
const SITE = path.resolve(V7, '..');
const V71 = path.join(V7, '1');
const V72 = path.join(V7, '2');
const VERBOSE = process.argv.includes('-v');
const smoke = require(path.join(V71, 'tests', 'smoke.js'));     // the v7/1 stub DOM and text helpers (not run when required)

const FAIL = []; const NOTES = []; let CHECKS = 0;
function ok(cond, what, extra) { CHECKS++; if (!cond) FAIL.push(what + (extra ? `  — ${extra}` : '')); return !!cond; }
function note(s) { NOTES.push(s); }
const read = (f) => fs.readFileSync(f, 'utf8');

const PAGES = [
  { key: 'overview', file: path.join(V7, 'index.html'), page: 'overview', dec: '1/assets/decisions7.js', css: '1/assets/decisions7.css', app: '1/prototype.html', app2: '2/prototype.html', v2: /^2\//, top: true },
  { key: 'challenges', file: path.join(V7, 'challenges.html'), page: 'challenges', dec: '1/assets/decisions7.js', css: '1/assets/decisions7.css', app: '1/prototype.html', app2: '2/prototype.html', v2: /^2\//, top: true },
  { key: 'v7/1 hand-off', file: path.join(V71, 'index.html'), page: 'doc', variant: '1', dec: 'assets/decisions7.js', css: 'assets/decisions7.css', app: 'prototype.html', app2: '../2/prototype.html', v2: /^\.\.\/2\//, top: false },
  { key: 'v7/2 hand-off', file: path.join(V72, 'index.html'), page: 'doc', variant: '2', dec: 'assets/decisions7.js', css: 'assets/decisions7.css', app: '../1/prototype.html', app2: 'prototype.html', v2: null, top: false },
];
/* the v7/2 hand-off's ten sections, and its acceptance criteria by group (first and last number) */
const SECTIONS72 = ['what', 'model', 'walk', 'decisions', 'silent', 'comparison', 'words', 'simulated', 'ac', 'run'];
const AC72 = [['1 · The library', 1, 8], ['2 · A new plant from the survey', 9, 24], ['3 · The bindings pass', 25, 31], ['4 · Readiness', 32, 42], ['5 · Trial and tuning', 43, 53],
  ['6 · Safety in commissioning', 54, 60], ['7 · Go live', 61, 71], ['8 · Live operation', 72, 82], ['9 · Coverage', 83, 92], ['10 · A library change', 93, 104],
  ['11 · Deviations', 105, 119], ['12 · Decisions, docs, overview', 120, 131], ['Across the app', 132, 148]];
const TITLES72 = ['The library', 'A new plant from the survey', 'The bindings pass', 'Readiness', 'Trial and tuning', 'Safety in commissioning', 'Go live', 'Live operation', 'Coverage', 'A library change', 'Deviations', 'Decisions'];

/* ── the public scrub: the site is public, so no page names Alex's internals. Written so this file passes it too: the
   names that must not appear are kept here only as hashes of their lowercase words. An id never follows a hyphen or a
   letter, so equipment tags such as AMP-P1 pass. ──────────────────────────────────────────────────────────────── */
const SCRUB = [
  ['an Alex decision, conflict or open-question ID', /\b(C[M]|C|O)-\d/],
  ['a commissioning-memo exception ID', /(?<![-\w])E[1-5]\b/],
  ['a wireframe ID', /(?<![-\w])W\d[a-z]?\b/],
  ['a scenario or screen ID', /(?<![-\w])S[1-8]\b/],
  ['a pattern ID', /(?<![-\w])P[12]\b/],
  ['a limits-memo row', /\bmemo D\d\b/],
  ['an Equipment Card decision ID', /\bD-\d{3}\b/],
  ['a file name', /\.m[d]\b/],
  ['an internal document pointer', /\bP[R]D\b|Brief v\d|\bpack [12]\b|\bStage [13]\b|§\s*\d|\bAnnex [A-E]\b|contract-v\d/],
  ['a memo option letter', /\boption [CD]\b/],
  ['a scratch path', /scr[a]tchpad|App[D]ata|Temp[\\/]claude/i],
  ['a folder path', /c[a]nonical\//],
];
const HASHED = new Set(['24db5f8427eef946', 'ce12e19a28f61d26', '200dc10df420c7a2', '06f32a2349041f87', 'a6849e5b805302ce',
  '89d0013c04ad6650', 'c2976d6f4b7fda55', 'fc275738225b22fd', '473a54910dd853a4']);
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const PRON = /\b(h[e]|h[i]m|h[i]s|s[h]e|h[e]r|h[e]rs|h[i]mself|h[e]rself)\b/i;
function scrubHits(text) {
  const t = String(text == null ? '' : text); const out = [];
  for (const [what, re] of SCRUB) { const m = t.match(re); if (m) out.push(`${what} "${m[0]}": …${t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30).replace(/\s+/g, ' ')}…`); }
  const words = t.toLowerCase().match(/[a-z0-9_]+/g) || [];
  for (let i = 0; i < words.length; i++) {
    if (HASHED.has(hash(words[i]))) { out.push(`an internal or private name (word ${i + 1})`); break; }
    if (i + 1 < words.length && HASHED.has(hash(words[i] + ' ' + words[i + 1]))) { out.push(`an internal document name (words ${i + 1}–${i + 2})`); break; }
  }
  const p = t.match(PRON); if (p) out.push(`a gendered pronoun "${p[0]}": …${t.slice(Math.max(0, p.index - 50), p.index + 20).replace(/\s+/g, ' ')}…`);
  return out;
}
function clean(text, where) { const h = scrubHits(text); ok(!h.length, `${where}: nothing internal or private, they/them only`, h.join(' | ')); }
const JUNK = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\$\{/];
const SOURCE_NAME = new RegExp(['S', 'C', 'A', 'D', 'A'].join(''));          // the control system's name, built so this file never spells it

/* ── v7/1's app, for the routes the pages link ─────────────────────────────────────────────────────────────── */
smoke.installDom();
const proto = read(path.join(V71, 'prototype.html'));
const ORDER = [...proto.matchAll(/<script[^>]*\bsrc="assets\/([^"?]+)/g)].map((m) => m[1]);
{
  const quiet = console.warn; console.warn = () => {};
  for (const f of ORDER) { const file = path.join(V71, 'assets', f); try { vm.runInThisContext(read(file), { filename: file }); } catch (e) { ok(false, `v7/1 loads ${f}`, e.message); } }
  console.warn = quiet;
}
const G = global; const UI = G.V7UI; const APP = G.V7;
if (APP && APP.reset) APP.reset();
ok(!!(UI && UI.match && UI.renderPath), 'v7/1\'s router loads for the route checks');
const CARDS = G.V7_DECISIONS || []; const READINGS = G.V7_READINGS || []; const N = CARDS.length;
ok(N >= 21 && CARDS.every((d, i) => d.id === 'D' + (i + 1)), `the decision file has D1…D${N}`);
const READY = !!(G.V7DEC && G.V7DEC.V72_READY === true);
const STRICT72 = READY || process.env.CTL_V72_ROUTES === '1';
const NOTFOUND = APPS.NOTFOUND;
const HAS72 = fs.existsSync(path.join(V72, 'prototype.html'));
const routeMemo = new Map();
function routeProblem(hash) {
  if (routeMemo.has(hash)) return routeMemo.get(hash);
  let r = '';
  if (!UI || !UI.match(hash)) r = 'no route';
  else { try { if (NOTFOUND.test(smoke.visibleText(UI.renderPath(hash)).slice(0, 300))) r = 'lands on a "not found" page'; } catch (e) { r = 'throws ' + e.message; } }
  routeMemo.set(hash, r); return r;
}

/* ── v7/2: its routes, its objects and the numbers its hand-off quotes, asked of v7/2 in its own process ─────────── */
const V72_HASHES = new Set();                        // every v7/2 route any page links (filled as the pages are read)
function staticProblem72(h) {
  const m = APPS.matchRoute(APPS.V72_ROUTES, h); const o = APPS.objectsOf72(m);
  return { m, qs: o.qs, problem: m ? o.problem : 'is not a v7/2 route' };
}
let CORE72 = null;                                   // {ids, values} from v7/2's core
function core72(qs) {
  if (CORE72) return CORE72;
  CORE72 = HAS72 ? APPS.probe('2', { ids: qs, values: true }) : { loaded: false, errors: ['v7/2 is missing'], ids: {}, values: null };
  return CORE72;
}

/* ── a stub DOM for one page: elements by id, with their static inner HTML; ids written by the scripts count too ── */
function innerOf(html, id) {
  const open = new RegExp(`<([a-zA-Z][\\w-]*)\\b[^>]*\\sid="${id.replace(/[-]/g, '\\-')}"[^>]*>`).exec(html);
  if (!open) return null;
  const tag = open[1].toLowerCase(); let i = open.index + open[0].length; let depth = 1;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi'); re.lastIndex = i; let m;
  while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (!depth) return { inner: html.slice(i, m.index), openTag: open[0] }; }
  return { inner: html.slice(i), openTag: open[0] };
}
function runPage(pg, o) {
  o = o || {};
  const html = read(pg.file);
  const els = new Map(); const scrolled = []; const copied = []; const added = [];
  const idKnown = (id) => html.includes(`id="${id}"`) || [...els.values()].some((e) => String(e.innerHTML).includes(`id="${id}"`));
  function makeEl(id) {
    const st = innerOf(html, id);
    return {
      id, innerHTML: st ? st.inner : '', textContent: '', value: '', hidden: !!(st && /\shidden(\s|>|=)/.test(st.openTag)), attrs: {}, on: {},
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
      addEventListener(t, f) { (this.on[t] = this.on[t] || []).push(f); }, focus() {}, select() {}, scrollIntoView() { scrolled.push(id); },
    };
  }
  const sheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map((m) => ({ getAttribute: (k) => ((m[0].match(new RegExp(`\\s${k}="([^"]*)"`)) || [])[1] || null) }));
  const store = new Map(Object.entries(o.store || {}));
  const ls = o.blocked ? { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } : { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); } };
  const clipboard = o.noClipboard ? undefined : { writeText: (t) => (o.clipboardFails ? Promise.reject(new Error('blocked')) : (copied.push(t), Promise.resolve())) };
  const document = {
    getElementById(id) { if (!els.has(id)) { if (!idKnown(id)) return null; els.set(id, makeEl(id)); } return els.get(id); },
    querySelectorAll(sel) { return /stylesheet/.test(sel) ? sheets : []; },
    createElement() { return {}; }, head: { appendChild(x) { added.push(x); } }, currentScript: null, addEventListener() {},
  };
  const ctx = { console, document, navigator: { clipboard }, location: { hash: o.hash || '' }, localStorage: ls, setTimeout, clearTimeout, addEventListener() {} };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  const src = (html.match(/<script\b[^>]*\bsrc="([^"]+)"/) || [])[1] || '';
  document.currentScript = { getAttribute: (k) => (k === 'src' ? src : null) };
  vm.runInContext(read(path.join(path.dirname(pg.file), src.split('?')[0])), ctx, { filename: `${pg.key}: decisions7.js` });
  document.currentScript = null;
  if (o.ready === true) ctx.V7DEC.V72_READY = true;
  if (o.ready === false) ctx.V7DEC.V72_READY = false;
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let threw = null;
  try { inline.forEach((s, i) => vm.runInContext(s, ctx, { filename: `${pg.key}: inline script ${i + 1}` })); } catch (e) { threw = e; }
  const rendered = () => [...els.values()].map((e) => e.innerHTML).join('\n');
  const whole = () => html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ') + '\n' + rendered();
  return { html, ctx, els, store, scrolled, copied, added, threw, rendered, whole, el: (id) => document.getElementById(id) };
}
const T = (h) => smoke.visibleText(h);
/* the page as a reader sees it: each element the script wrote shows what it wrote, and a hidden one shows nothing */
function live(r) {
  let h = r.html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  for (const [id, e] of r.els) {
    const st = innerOf(h, id); if (!st) continue;
    const start = h.indexOf(st.openTag) + st.openTag.length;
    h = h.slice(0, start) + (e.hidden ? '' : e.innerHTML) + h.slice(start + st.inner.length);
  }
  return h;
}
const hrefs = (h) => [...String(h).matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => smoke.decode(m[1]));     // the links a reader follows
const tick = () => new Promise((r) => setImmediate(r));

/* ── the chapter action counts the end-to-end walks write: {n: count} from an array of 12 counts, an object keyed by
   chapter, or a list of {n, count | actions} (under "chapters" or at the top) ─────────────────────────────────────── */
function actionCounts(file) {
  if (!fs.existsSync(file)) return null;
  let j = null; try { j = JSON.parse(read(file)); } catch (e) { return { error: e.message }; }
  const src = j && typeof j === 'object' && !Array.isArray(j) && j.chapters != null ? j.chapters : j;
  const out = {};
  const num = (v) => (typeof v === 'number' ? v : v && typeof v === 'object' ? (typeof v.count === 'number' ? v.count : typeof v.actions === 'number' ? v.actions : null) : null);
  if (Array.isArray(src)) src.forEach((v, i) => { const n = v && typeof v === 'object' && v.n != null ? +v.n : i + 1; const c = num(v); if (c != null) out[n] = c; });
  else if (src && typeof src === 'object') Object.keys(src).forEach((k) => { const c = num(src[k]); if (c != null && /^\d+$/.test(k)) out[+k] = c; });
  return out;
}
const ACT71 = actionCounts(path.join(V71, 'tests', 'out', 'actions71.json'));
const ACT72 = actionCounts(path.join(V72, 'tests', 'out', 'actions72.json'));
if (process.argv.includes('--fill-actions')) {
  const f = path.join(V72, 'index.html'); let s = read(f); let n = 0;
  if (ACT71 && !ACT71.error) s = s.replace(/(<b data-act71="(\d+)">)[^<]*(<\/b>)/g, (all, a, k, b) => (ACT71[+k] != null ? (n++, `${a}${ACT71[+k]}${b}`) : all));
  if (ACT72 && !ACT72.error) s = s.replace(/(<b data-act72="(\d+)">)[^<]*(<\/b>)/g, (all, a, k, b) => (ACT72[+k] != null ? (n++, `${a}${ACT72[+k]}${b}`) : all));
  fs.writeFileSync(f, s); console.log(`--fill-actions: ${n} counts written into v7/2's hand-off`);
}

(async () => {
  /* ── 1. sources ─────────────────────────────────────────────────────────────────────────────────────────── */
  for (const pg of PAGES) {
    if (!ok(fs.existsSync(pg.file), `${pg.key}: the page exists`)) continue;
    const html = read(pg.file);
    const srcs = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
    ok(srcs.length === 1 && new RegExp(`^${pg.dec.replace(/[./]/g, '\\$&')}\\?v=\\d+$`).test(srcs[0]), `${pg.key}: loads only the shared decision file (${pg.dec})`, srcs.join(', '));
    const sheets = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((l) => /\srel="stylesheet"/.test(l)).map((l) => (l.match(/\shref="([^"]+)"/) || [])[1]);
    ok(sheets.length === 2 && sheets.some((s) => /^https:\/\/fonts\.googleapis\.com\/css2\?family=Figtree/.test(s)) && sheets.some((s) => s.split('?')[0] === pg.css), `${pg.key}: stylesheets are Google Fonts and decisions7.css only`, sheets.join(', '));
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    ok(inline.length === 1, `${pg.key}: one inline script`);
    ok(new RegExp(`window\\.V7_PAGE = '${pg.page}';`).test(inline[0] || ''), `${pg.key}: sets V7_PAGE = '${pg.page}'`);
    if (pg.page === 'doc') ok(new RegExp(`window\\.V7_VARIANT = '${pg.variant}';`).test(inline[0] || ''), `${pg.key}: sets V7_VARIANT = '${pg.variant}'`);
    ok(/<title>[^<]{6,}<\/title>/.test(html) && /<meta name="description" content="[^"]{40,}">/.test(html) && /<meta name="viewport" content="width=device-width, initial-scale=1">/.test(html), `${pg.key}: title, description and viewport`);
    ok(fs.existsSync(path.join(path.dirname(pg.file), pg.css)), `${pg.key}: its stylesheet exists`);
    if (pg.top) {
      ok(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/.test(html) && /:root\[data-theme="dark"\]/.test(html), `${pg.key}: light and dark tokens (dark follows the reader unless the page says otherwise)`);
      ok(/body \{[^}]*background: var\(--bg\)/.test(html), `${pg.key}: the body has an explicit background`);
      ok(/@media \(max-width: 640px\) \{[\s\S]*?\.wrap \{ padding: 0 16px; \}/.test(html), `${pg.key}: a 16px gutter at phone width`);
    } else {
      ok(/<html lang="en" data-theme="light">/.test(html), `${pg.key}: stays light, so the shared cards never turn dark inside it`);
      ok(/@media \(max-width: 640px\) \{[\s\S]*?\.wrap \{ padding: 0 16px; \}/.test(html), `${pg.key}: a 16px gutter at phone width`);
    }
  }
  ok(PAGES.every((pg) => !fs.existsSync(pg.file) || (read(pg.file).match(/decisions7\.js\?v=(\d+)/) || [])[1] === (read(path.join(V71, 'prototype.html')).match(/decisions7\.js\?v=(\d+)/) || [])[1])
    && (read(path.join(V71, 'prototype.html')).match(/decisions7\.js\?v=(\d+)/) || [])[1] === (HAS72 ? (read(path.join(V72, 'prototype.html')).match(/decisions7\.js\?v=(\d+)/) || [])[1] : (read(path.join(V71, 'prototype.html')).match(/decisions7\.js\?v=(\d+)/) || [])[1]),
  'every page and both prototypes ask for the same version of the shared decision file');

  /* ── 2–6 per page ───────────────────────────────────────────────────────────────────────────────────────── */
  const WEEK = { 'ctl7.decisions': JSON.stringify({ v: 1, answers: { D3: { opt: 1, note: '', at: '' }, D15: { opt: 'other', note: 'Ask Alex first', at: '' }, D2: { opt: 2, note: '', at: '' } } }), 'ctl7.study': JSON.stringify({ v: 1, answers: { 'study-words': 2 } }) };
  const GROUPS = (G.V7DEC.ARISINGS || ['First review']).map((a) => [a, CARDS.filter((d) => (d.arose || 'First review') === a)]).filter(([, ds]) => ds.length);
  const slugOf = (a) => 'group-' + String(a).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const TITLE_OF = { 'First review': 'From the first review of Alex\'s packs', 'Reviewing v7/1': 'From reviewing v7/1', 'Designing v7/2': 'From designing v7/2', 'Building v7/2': 'From building v7/2', 'Team feedback': 'From the team\'s feedback on the prototypes' };
  const v72Links = [];                               // [page key, route] for every link into v7/2's prototype
  for (const pg of PAGES) {
    if (!fs.existsSync(pg.file)) continue;
    const r = runPage(pg);
    if (!ok(!r.threw, `${pg.key}: the inline script runs with empty storage`, r.threw && r.threw.stack)) continue;
    const out = r.rendered(); const whole = r.whole(); const text = T(live(r));
    ok(out.length > (pg.key === 'overview' ? 5000 : 50000), `${pg.key}: the script draws the page from the decision file`, `${out.length} characters`);
    for (const j of JUNK) ok(!j.test(T(out)), `${pg.key}: the rendered text has no "${j.source}"`);

    /* 3. public */
    clean(r.html.replace(/the lab weights W\d\/W\d/g, 'the lab weights'), `${pg.key} source (comments and scripts included; the workbook's lab weights are quoted data)`);
    clean(T(whole).replace(/the lab weights W\d\/W\d/g, 'the lab weights'), `${pg.key} rendered text`);

    /* 4. v7/2 links on v7/1's side follow the flag */
    const all = hrefs(whole);
    if (pg.v2) {
      const into2 = all.filter((h) => pg.v2.test(h) || /(^|\/)2\/(prototype|index)\.html/.test(h));
      if (!READY) {
        ok(!into2.length, `${pg.key}: no link into v7/2 while V72_READY is false`, into2.slice(0, 4).join(' | '));
        ok(/v7\/2[^.]{0,80}in build/i.test(text), `${pg.key}: says v7/2 is in build`);
      } else {
        ok(into2.length >= (pg.key === 'v7/1 hand-off' ? 20 : 12), `${pg.key}: V72_READY is true, so it links v7/2`, `${into2.length} links`);
        ok(!/v7\/2[^.]{0,80}in build/i.test(text), `${pg.key}: no longer says v7/2 is in build`);
      }
    }

    /* 5. links into v7/1 (the app routes this page links) */
    const appLinks = [...new Set(all.filter((h) => h.split('#')[0] === pg.app))];
    ok(appLinks.length >= (pg.key === 'overview' ? 13 : 40), `${pg.key}: links into v7/1`, `${appLinks.length} distinct`);
    const bad = []; for (const h of appLinks) { const route = h.slice(pg.app.length); if (!route) continue; if (!/^#\//.test(route)) { bad.push(`${h}: not an app route`); continue; } const p = routeProblem(route); if (p) bad.push(`${h}: ${p}`); }
    ok(!bad.length, `${pg.key}: every v7/1 route it links is a real v7/1 page`, bad.slice(0, 5).join(' | '));
    all.filter((h) => h.split('#')[0] === pg.app2).forEach((h) => { const route = h.slice(pg.app2.length); if (/^#\//.test(route)) v72Links.push([pg.key, route]); });
    const ids = new Set([...whole.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...new Set(all.filter((h) => h[0] === '#' && h.length > 1 && !/^#\//.test(h)).map((h) => h.slice(1)))];
    const missing = anchors.filter((a) => !ids.has(a));
    ok(!missing.length, `${pg.key}: every in-page anchor exists`, missing.join(', '));
    const files = [...new Set(all.filter((h) => h && h[0] !== '#' && !/^[a-z]+:/i.test(h)).map((h) => h.split('#')[0].split('?')[0]).filter(Boolean))];
    const gone = files.filter((f) => !fs.existsSync(path.resolve(path.dirname(pg.file), f)));
    ok(!gone.length, `${pg.key}: every linked file exists`, gone.join(', '));
    const external = [...new Set(all.filter((h) => /^[a-z]+:/i.test(h)))];
    ok(!external.length, `${pg.key}: no links off the site`, external.join(', '));
    /* cross-page anchors to the challenges doc name real cards */
    const chal = all.filter((h) => /(^|\/)challenges\.html#/.test(h)).map((h) => h.split('#')[1]);
    const chalIds = new Set(CARDS.map((d) => d.id).concat(['readings', 'study', 'how']));
    ok(chal.every((a) => chalIds.has(a)), `${pg.key}: every link into the challenges doc names a card or a section in it`, chal.filter((a) => !chalIds.has(a)).join(', '));

    /* 2. render, per page */
    if (pg.key === 'challenges') {
      const doc = r.el('doc').innerHTML;
      ok(CARDS.every((d) => (doc.match(new RegExp(`<section class="dd-card" id="${d.id}"`, 'g')) || []).length === 1), 'challenges: every card renders once, anchored #Dn');
      ok(/<title>CloseTheLoop v7 challenges<\/title>/.test(r.html) && /<h1>CloseTheLoop v7 challenges<\/h1>/.test(r.html), 'challenges: titled "CloseTheLoop v7 challenges"');
      const at = GROUPS.map(([a]) => doc.indexOf(`id="${slugOf(a)}"`));
      ok(GROUPS.length >= 3 && at.every((i) => i >= 0) && at.every((i, k) => !k || i > at[k - 1]) && doc.indexOf('id="readings"') > at[at.length - 1] && doc.indexOf('id="dd-glance-h"') < at[0], 'challenges: at a glance, then the groups in order of when they arose, then the readings', GROUPS.map(([a]) => a).join(', '));
      GROUPS.forEach(([a, ds]) => ok(T(doc).includes(`${TITLE_OF[a] || a} · ${ds.length}`), `challenges: "${TITLE_OF[a] || a} · ${ds.length}"`));
      const first = doc.slice(at[0], at[1]);
      ok(CARDS.slice(0, 21).every((d) => first.includes(`id="${d.id}"`)) && !CARDS.slice(21).some((d) => first.includes(`id="${d.id}"`)), 'challenges: D1–D21 sit under the first review, the later cards after it');
      ok(T(doc).includes(`Readings v7/2 takes where Alex's drafts are silent · ${READINGS.length}`) && READINGS.every((x) => doc.includes(`id="reading-${x.n}"`)), `challenges: the ${READINGS.length} readings, each anchored`);
      ok((doc.match(/<tr><td data-label="Card">/g) || []).length === N, 'challenges: the at-a-glance table has a row per card');
      ok(r.html.indexOf('<main class="doc" id="doc">') < r.html.indexOf('id="study"'), 'challenges: the cards are drawn into <main>, the study calls follow');
      const study = r.el('study-list').innerHTML; const SN = (study.match(/<section class="dd-card" id="study-[a-z]+"/g) || []).length;
      ok(SN >= 2 && (study.match(/<span class="dd-id">Study call \d+<\/span>/g) || []).length === SN && /Recommended/.test(study) && /data-study="study-words" data-opt="0"/.test(study) && /data-study="study-markers"/.test(study), 'challenges: the calls about the study, each with options and a call to mark', `${SN} calls`);
      const toc = r.el('toc-cards').innerHTML;
      ok(CARDS.every((d) => toc.includes(`href="#${d.id}"`)) && GROUPS.every(([a]) => toc.includes(`href="#${slugOf(a)}"`)), 'challenges: the contents link every group and every card');
      ok(T(r.el('counts').innerHTML) === `${N} challenges · ${READINGS.length} readings v7/2 takes · ${SN} calls about the study`, 'challenges: the counts under the title, counted as challenges like the overview', T(r.el('counts').innerHTML));
      ok(/<a href="index\.html">Both approaches<\/a>/.test(r.html) && /<a href="1\/prototype\.html#\/plants">the prototype<\/a>/.test(r.html) && /<a href="1\/index\.html">its hand-off<\/a>/.test(r.html) && (READY ? /2\/prototype\.html/.test(r.el('v72-links').innerHTML) : T(r.el('v72-links').innerHTML) === 'in build'), 'challenges: links the overview, v7/1\'s prototype and hand-off; v7/2 is "in build" text until it is published');
      const how = T(innerOf(r.html, 'how').inner);
      ok(/Copy my answers/.test(how) && /shared with the Decisions pages of both prototypes/.test(how) && /Pick your call/.test(how), 'challenges: "How to answer" says how to pick, copy, and that calls are shared');
      ok(/marker/.test(T(r.html.slice(r.html.indexOf('<p class="sub">'), r.html.indexOf('</p>', r.html.indexOf('<p class="sub">'))))), 'challenges: the lede says each screen\'s marker links here');
      const deep = runPage(pg, { hash: '#D15' });
      ok(deep.scrolled.includes('D15'), 'challenges: challenges.html#D15 scrolls to card D15', deep.scrolled.join(','));
      const deepS = runPage(pg, { hash: '#study-markers' });
      ok(deepS.scrolled.includes('study-markers'), 'challenges: a deep link to a study call lands on it');
      const y = runPage(pg, { ready: true });
      ok(/<a href="2\/prototype\.html#\/plants">the prototype<\/a> and <a href="2\/index\.html">its hand-off<\/a>/.test(y.el('v72-links').innerHTML), 'challenges: once v7/2 is published it links v7/2\'s prototype and hand-off');
    }
    if (pg.key === 'overview') {
      const tbl = r.el('ov-table').innerHTML;
      ok(/<th scope="col">Card<\/th><th scope="col">Question<\/th><th scope="col">Severity<\/th><th scope="col">v7\/1 builds<\/th><th scope="col">v7\/2 builds<\/th><th scope="col">Same or differs<\/th><th scope="col">Your call<\/th><th scope="col">Open<\/th>/.test(tbl), 'overview: the table\'s columns');
      const rows = tbl.split('<tr>').slice(2);
      ok(rows.length === N && CARDS.every((d, i) => (rows[i] || '').includes(`href="challenges.html#${d.id}"`)), 'overview: a row per card, each linking its section in the challenges doc');
      ok(CARDS.every((d, i) => (rows[i] || '').includes(d.both === true ? 'sd-same">Same<' : 'sd-diff">Differs<')), 'overview: Same exactly where both prototypes build the same thing');
      ok(CARDS.every((d, i) => T(rows[i] || '').includes(T(G.V7DEC.esc(G.V7DEC.builds(d, '1')))) && T(rows[i] || '').includes(T(G.V7DEC.esc(G.V7DEC.builds(d, '2'))))), 'overview: what each prototype builds, from the card');
      const four = (html, ready) => CARDS.every((d, i) => {
        const row = (html.split('<tr>').slice(2)[i] || ''); const l = d.links[0];
        const want = [`challenges.html#${d.id}`, `1/prototype.html${l.href}`, `1/index.html#${d.id}`].concat(ready ? [`2/prototype.html${l.href72}`, `2/index.html#${d.id}`] : []);
        return want.every((h) => row.includes(`href="${G.V7DEC.esc(h)}"`)) && (ready || /v7\/2 in build/.test(T(row))) && (ready || !/href="2\//.test(row));
      });
      ok(four(tbl, READY), `overview: each row opens its card, the same place in v7/1 and v7/1's hand-off${READY ? ', and the same in v7/2' : ', and says v7/2 is in build'}`);
      const yt = runPage(pg, { ready: true }).el('ov-table').innerHTML;
      ok(four(yt, true), 'overview: once v7/2 is published every row has four working links into the prototypes and their hand-offs');
      ok(/<a class="p" href="challenges\.html">Read the challenges doc →<\/a>/.test(r.html), 'overview: the challenges doc is its first call to action');
      ok(/<a class="btn p" href="1\/prototype\.html#\/plants">Open the prototype<\/a><a class="btn s" href="1\/index\.html">Read the hand-off<\/a>/.test(r.html), 'overview: v7/1 opens the prototype and the hand-off');
      if (!READY) ok(/In build/.test(T(innerOf(r.html, 'v72-state').inner)) && !/<a\b/.test(r.el('v72-go').innerHTML), 'overview: v7/2 is "In build", with no link');
      const yo = runPage(pg, { ready: true });
      ok(/<a class="btn p" href="2\/prototype\.html#\/plants">Open the prototype<\/a><a class="btn s" href="2\/index\.html">Read the hand-off<\/a>/.test(yo.el('v72-go').innerHTML), 'overview: once v7/2 is published, it opens v7/2\'s prototype and hand-off');
      ok(/What is the same in both/.test(r.html), 'overview: what is the same in both');
      const story = innerOf(r.html, 'story-rows').inner;
      const chs = UI.chapters();
      const sRows = [...story.matchAll(/<tr><td>(\d+)<\/td><td><a href="1\/prototype\.html(#[^"]*)">([^<]+)<\/a><\/td><td id="v72-ch-(\d+)">([^<]+)<\/td><\/tr>/g)];
      ok(sRows.length === 12 && sRows.every((m, i) => +m[1] === i + 1 && chs[i] && m[2] === chs[i].href && smoke.decode(m[3]) === chs[i].title), 'overview: the twelve chapters match v7/1\'s story (title and link)', sRows.map((m) => m[1] + ' ' + m[2]).join(', '));
      ok(sRows.length === 12 && sRows.every((m, i) => smoke.decode(m[5]) === TITLES72[i]), 'overview: the twelve v7/2 chapter titles are v7/2\'s', sRows.map((m) => m[5]).join(' · '));
      const ys = innerOf(yo.html, 'story-rows') ? [...Array(12)].map((_, i) => yo.el(`v72-ch-${i + 1}`).innerHTML) : [];
      const yHrefs = ys.map((h) => (h.match(/href="2\/prototype\.html(#[^"]*)"/) || [])[1] || null);
      ok(yHrefs.length === 12 && yHrefs.every(Boolean), 'overview: once v7/2 is published, each v7/2 chapter links its moment in v7/2', yHrefs.join(', '));
      yHrefs.forEach((h) => { if (h) v72Links.push(['overview story', h]); });
      PAGES[0].story72 = yHrefs;
      ok(T(r.el('ov-more').innerHTML).includes(`${READINGS.length} readings`), 'overview: points to the readings in the challenges doc');
    }
    if (pg.key === 'v7/1 hand-off') {
      const list = r.el('dec-list').innerHTML; const glance = r.el('dec-table').innerHTML;
      ok(CARDS.every((d) => (list.match(new RegExp(`<section class="dd-card" id="${d.id}"`, 'g')) || []).length === 1), 'v7/1 hand-off: every card renders once, anchored #Dn');
      ok((glance.match(/<tr><td data-label="Card">/g) || []).length === N && (list.match(/You are here/g) || []).length === N, 'v7/1 hand-off: the at-a-glance table and "You are here" on v7/1');
      ok(/<p class="ver">This is v7\/1, the recommended approach\. <a href="\.\.\/index\.html">Both approaches<\/a> · <a href="\.\.\/challenges\.html">Challenges doc<\/a>\. <span id="v72-ver">v7\/2, [^<]*in build\.<\/span><\/p>/.test(r.html), 'v7/1 hand-off: the top block names v7/1, links both approaches and the challenges doc, and names v7/2 as in build until it is published');
      const yv = runPage(pg, { ready: true });
      ok(/<a href="\.\.\/2\/index\.html">Read v7\/2<\/a>/.test(yv.el('v72-ver').innerHTML) && /<a class="s" href="\.\.\/2\/index\.html">Read v7\/2<\/a>/.test(yv.el('cta').innerHTML), 'v7/1 hand-off: once v7/2 is published, "Read v7/2" in the top block and with the buttons');
      ok(/href="\.\.\/challenges\.html">Read every challenge in the challenges doc/.test(r.html), 'v7/1 hand-off: its decisions section links the challenges doc');
      ok(r.el('dec-contract').innerHTML.includes('<table class="dsum">'), 'v7/1 hand-off: "Changes the cards ask for" still draws');
      ok(T(r.el('dec-n').innerHTML) === String(N), 'v7/1 hand-off: the decisions tile counts every card', T(r.el('dec-n').innerHTML));
      const deep = runPage(pg, { hash: '#D7' });
      ok(deep.scrolled.includes('D7'), 'v7/1 hand-off: index.html#D7 lands on its card');
    }
    if (pg.key === 'v7/2 hand-off') {
      const h = r.html;
      /* the ten sections, in order */
      const h2 = [...h.matchAll(/<h2 id="([a-z-]+)"><span class="n">(\d+)<\/span>/g)].map((m) => [m[1], +m[2]]);
      ok(h2.map((x) => x[0]).join() === SECTIONS72.join() && h2.every((x, i) => x[1] === i + 1), 'v7/2 hand-off: the ten sections in order (what it is, the model, the walk, card by card, readings, the comparison, words, simulated, acceptance criteria, run)', h2.map((x) => x.join(' ')).join(', '));
      ok(/<title>CloseTheLoop Configuration v7\/2<\/title>/.test(h) && /<h1>Alex's model, built as drafted, end to end\.<\/h1>/.test(h) && /CloseTheLoop configuration · v7\/2 · 30 Oct 2026/.test(h), 'v7/2 hand-off: title, heading and eyebrow');
      ok(/<a class="p" href="prototype\.html#\/plants">Open the v7\/2 prototype →<\/a>/.test(h) && /<a class="s" href="\.\.\/1\/index\.html">Read v7\/1<\/a>/.test(h) && /<a class="s" href="\.\.\/index\.html">Both approaches<\/a>/.test(h), 'v7/2 hand-off: Open the v7/2 prototype · Read v7/1 · Both approaches');
      ok(/<p class="ver">This is v7\/2, Alex's model as drafted\. <a href="\.\.\/index\.html">Both approaches<\/a> · <a href="\.\.\/challenges\.html">Challenges doc<\/a>/.test(h), 'v7/2 hand-off: the top block names v7/2 and links both approaches and the challenges doc');
      /* section 4: every card, both columns, v7/2 marked here */
      const list = r.el('dec-list').innerHTML; const glance = r.el('dec-table').innerHTML;
      ok(CARDS.every((d) => (list.match(new RegExp(`<section class="dd-card" id="${d.id}"`, 'g')) || []).length === 1), 'v7/2 hand-off: every card renders once in section 4, anchored #Dn');
      ok((list.match(/class="dk-col dk-col-1"/g) || []).length === N && (list.match(/class="dk-col dk-col-2"/g) || []).length === N, 'v7/2 hand-off: every card shows both columns');
      const cols2 = list.split('class="dk-col dk-col-2"').slice(1);
      ok((list.match(/>You are here</g) || []).length === N && cols2.every((c) => c.split('class="dk-col dk-col-1"')[0].includes('>You are here<')), 'v7/2 hand-off: "You are here" on v7/2\'s column of every card');
      ok((glance.match(/<tr><td data-label="Card">/g) || []).length === N, 'v7/2 hand-off: the at-a-glance table has a row per card');
      ok(/href="\.\.\/1\/prototype\.html#\/[^"]*" target="v7-1"/.test(list) && /href="prototype\.html#\/[^"]*"/.test(list), 'v7/2 hand-off: the cards link v7/1 in its own window and v7/2 here');
      ok(T(r.el('dec-n').innerHTML) === String(N) && T(r.el('dec-n2').innerHTML) === String(N), 'v7/2 hand-off: it counts every card, from the file');
      ok(/href="\.\.\/challenges\.html">Read every challenge in the challenges doc/.test(h), 'v7/2 hand-off: section 4 links the challenges doc');
      /* section 5: the readings */
      const rd = r.el('dec-readings').innerHTML;
      ok(/id="readings"/.test(rd) && READINGS.every((x) => rd.includes(`id="reading-${x.n}"`)), `v7/2 hand-off: section 5 lists all ${READINGS.length} readings, each anchored`);
      const conf = READINGS.filter((x) => x.confirm === true).length;
      ok(T(r.el('read-sum').innerHTML).includes(String(conf)) && (rd.match(/class="dk-chip dk-confirm">Mihir to confirm/g) || []).length === conf, `v7/2 hand-off: ${conf} readings for Mihir to confirm, counted from the file`);
      /* the control system's name only inside the cards (section 4 quotes both approaches' options) */
      const outside = h.replace(/<script\b[\s\S]*?<\/script>/gi, ' ') + '\n' + [...r.els.entries()].filter(([id]) => id !== 'dec-table' && id !== 'dec-list').map(([, e]) => e.innerHTML).join('\n');
      ok(!SOURCE_NAME.test(T(outside)) && !SOURCE_NAME.test(h), 'v7/2 hand-off: the control system is never named outside the cards');
      /* section 3: the walk */
      const walk = h.slice(h.indexOf('id="walk"'), h.indexOf('id="decisions"'));
      const chTitles = [...walk.matchAll(/<li><h4>([^<]+)<\/h4>/g)].map((m) => smoke.decode(m[1]));
      ok(chTitles.join() === TITLES72.join(), 'v7/2 hand-off: the walk has the twelve chapters, in v7/2\'s words', chTitles.join(' · '));
      const items = walk.split('<li><h4>').slice(1);
      const opens = items.map((it) => (it.match(/<a class="go" href="prototype\.html(#[^"]*)">Open in v7\/2 →<\/a>/) || [])[1] || null);
      const sames = items.map((it) => (it.match(/<a class="go" href="\.\.\/1\/prototype\.html(#[^"]*)" target="v7-1">Same moment in v7\/1<\/a>/) || [])[1] || null);
      const chs1 = UI.chapters();
      ok(items.length === 12 && opens.every(Boolean) && sames.every((s, i) => s && chs1[i] && s === chs1[i].href), 'v7/2 hand-off: each chapter opens in v7/2 and links the same moment in v7/1 (v7/1\'s own chapter link)', sames.join(', '));
      PAGES[3].opens = opens;
      ok(items.every((it) => /<p class="do"><b>Do:<\/b>/.test(it) && /<p class="see"><b>See:<\/b>/.test(it)), 'v7/2 hand-off: each chapter says what to do and what you see');
      const acts = items.map((it, i) => [(it.match(new RegExp(`<b data-act71="${i + 1}">([^<]*)</b>`)) || [])[1], (it.match(new RegExp(`<b data-act72="${i + 1}">([^<]*)</b>`)) || [])[1]]);
      ok(acts.every(([a, b]) => a != null && b != null), 'v7/2 hand-off: each chapter has its action counts in v7/1 and in v7/2');
      [['v7/1', ACT71, 0], ['v7/2', ACT72, 1]].forEach(([w, A, k]) => {
        if (!A) { ok(acts.every((x) => x[k] === '—'), `v7/2 hand-off: ${w}'s action counts read "—" until the walk writes them`); note(`${w}'s action file is not written yet: the chapter counts read "—" (run the end-to-end walk, then node tests/docs.test.js --fill-actions)`); return; }
        if (A.error) { ok(false, `v7/2 hand-off: ${w}'s action file reads`, A.error); return; }
        ok(acts.every((x, i) => A[i + 1] != null && x[k] === String(A[i + 1])), `v7/2 hand-off: the chapter counts equal ${w}'s action file (fill them with --fill-actions)`, acts.map((x) => x[k]).join(','));
      });
      /* section 9: acceptance criteria V72-1 … V72-148, grouped */
      const ac = h.slice(h.indexOf('id="ac"'), h.indexOf('id="run"'));
      const nums = [...ac.matchAll(/<td>V72-(\d+)<\/td>/g)].map((m) => +m[1]);
      ok(nums.length === 148 && nums.every((n, i) => n === i + 1), 'v7/2 hand-off: acceptance criteria V72-1 … V72-148 without gaps', `${nums.length}: ${nums.slice(-3).join(',')}`);
      const groups = ac.split(/<h3>/).slice(1).map((g) => [smoke.decode(g.split(/<a |<\/h3>/)[0].trim()), [...g.matchAll(/<td>V72-(\d+)<\/td>/g)].map((m) => +m[1])]);
      ok(groups.length === AC72.length && AC72.every(([t, a, b], i) => groups[i] && groups[i][0] === t && groups[i][1][0] === a && groups[i][1][groups[i][1].length - 1] === b), 'v7/2 hand-off: the criteria are grouped by the twelve chapters, then across the app', groups.map((g) => `${g[0]} ${g[1][0]}–${g[1][g[1].length - 1]}`).join(' | '));
      ok(!/\[(structure72|library72|limits72|freeze72|overrides72|readiness72|smoke|ui7|plant7|object7|lib7|work7|deviations72|lists7|structure7|compare|docs|decisions7|core7|integrate72|nohardcode72)\b/.test(ac), 'v7/2 hand-off: the criteria name no test files');
      /* every number the doc quotes is compared with v7/2's engine below, in one visit to v7/2 */
      PAGES[3].spans = [...h.matchAll(/<(?:span|b) data-v="([\w]+)">([^<]*)<\/(?:span|b)>/g)].map((m) => [m[1], smoke.decode(m[2])]);
      const deep = runPage(pg, { hash: '#D7' });
      ok(deep.scrolled.includes('D7'), 'v7/2 hand-off: index.html#D7 lands on its card');
    }

    /* storage: calls made elsewhere show; blocked storage still renders */
    const s = runPage(pg, { store: WEEK });
    const so = s.rendered();
    ok(!s.threw && /Option 2/.test(T(so)) && /Something else|Note only/.test(T(so)), `${pg.key}: calls stored in this browser show`, s.threw && s.threw.message);
    const b = runPage(pg, { blocked: true });
    ok(!b.threw && b.rendered().length > out.length * 0.9, `${pg.key}: renders with storage blocked`, b.threw && b.threw.message);

    /* 4. with v7/2 published, the pages on v7/1's side link it (the flag alone decides) */
    if (pg.v2) {
      const y = runPage(pg, { ready: true });
      const yl = hrefs(y.whole()).filter((h) => pg.v2.test(h));
      ok(!y.threw && yl.length >= (pg.key === 'v7/1 hand-off' ? 20 : 12), `${pg.key}: once V72_READY is true it links v7/2 (the flag alone decides)`, `${yl.length} links`);
      yl.filter((h) => h.split('#')[0] === pg.app2).forEach((h) => { const route = h.slice(pg.app2.length); if (/^#\//.test(route)) v72Links.push([pg.key, route]); });
      const doc2 = pg.top ? '2/index.html' : '../2/index.html';
      const cardsIn2 = yl.filter((h) => h.split('#')[0] === doc2 && h.includes('#')).map((h) => h.split('#')[1]);
      ok(cardsIn2.every((a) => (/^D\d+$/.test(a) ? !!G.V7DEC.byId(a) : true)) && (!yl.some((h) => h.split('#')[0] === doc2) || fs.existsSync(path.join(V72, 'index.html'))), `${pg.key}: every card it links in v7/2's hand-off is a real card, and the hand-off exists`);
      if (READY) { const n = runPage(pg, { ready: false }); ok(!hrefs(n.whole()).some((h) => pg.v2.test(h)), `${pg.key}: drawn with the flag off, it links nothing in v7/2`); }
    }
  }

  /* ── 4. every v7/2 route the pages link: a v7/2 route on objects v7/2 has; a real page when published ─────────── */
  {
    const routes = [...new Set(v72Links.map(([, r]) => r))];
    routes.forEach((r) => V72_HASHES.add(r));
    const stat = routes.map((r) => [r, staticProblem72(r)]);
    const notRoute = stat.filter(([, s]) => s.problem).map(([r, s]) => `${r}: ${s.problem}`);
    ok(routes.length >= 40 && !notRoute.length, `every link into v7/2 (${routes.length} routes) is a v7/2 route`, notRoute.slice(0, 6).join(' | '));
    const qs = []; stat.forEach(([, s]) => s.qs.forEach((q) => qs.push(q)));
    CORE72 = null; const c = core72(qs);
    if (ok(c.loaded, 'v7/2\'s core loads to check the objects the pages link', (c.errors || []).join(' | '))) {
      const missingObj = stat.flatMap(([r, s]) => s.qs.filter((q) => c.ids[APPS.idKey(q)] !== true).map((q) => `${r}: no ${q.kind} "${q.id}"`));
      ok(!missingObj.length, 'every link into v7/2 names objects v7/2 has', [...new Set(missingObj)].slice(0, 6).join(' | '));
    }
    /* every number v7/2's hand-off quotes equals v7/2's engine at the start of the story (v7/1's own figure from v7/1's) */
    const spans = PAGES[3].spans || []; const keys = [...new Set(spans.map((s) => s[0]))];
    const vals = Object.assign({}, c.values || {});
    try { vals.v71VedPerDay = String(APP.goLivePreview('vedanta').tasksPerDay); } catch (e) { /* named below */ }
    if (ok(c.loaded && c.values && spans.length > 50, 'v7/2 hand-off: v7/2\'s engine answers for the numbers the doc quotes', `${spans.length} places; ${(c.errors || []).join(' | ')}`)) {
      const badV = spans.filter(([k, v]) => vals[k] !== v).map(([k, v]) => `${k}: doc "${v}", engine "${vals[k]}"`);
      ok(!badV.length, `v7/2 hand-off: every number it quotes (${spans.length} places, ${keys.length} values) equals v7/2's engine at the start of the story`, [...new Set(badV)].slice(0, 6).join(' | '));
      const facts = require(path.join(V72, 'tests', 'facts72.js')).KEYS;
      ok(facts.every((k) => keys.includes(k)), 'v7/2 hand-off: it quotes every fact the cards quote', facts.filter((k) => !keys.includes(k)).join(', '));
      /* the cards and the readings quote the same numbers inside their own sentences: each sentence, rebuilt from the
         engine's values, must be in the card or reading as written */
      const F = vals; const cardText = (id) => { const d = CARDS.find((x) => x.id === id) || {}; return [d.v72Short, d.v72Does].join('\n'); };
      const readingText = (n) => { const r = READINGS.find((x) => x.n === n) || {}; return [r.title, r.drafts, r.reading, r.why].join('\n'); };
      const [clrDay, clrTime] = String(F.noisyClears || '').split(', ');
      const bases = String(F.blAmps || '').replace(/ A$/, '').split(' / ');
      const review = String(F.migratedReview || '').replace(/^\w{3} /, '');
      const QUOTES = [
        ['D1', () => `proposes ${F.dpUnitProcesses} unit processes and ${F.dpControlGroups} control groups and leaves ${F.dpUnclassified} pieces of equipment unclassified`],
        ['D3', () => `pH Emergency on ${F.emergencyAt} is one more trial firing`], ['D3', () => `with a peak of ${F.emergencyPeak}`],
        ['D5', () => `"Fired ${F.lvlCount} times in ${F.lvlDays} days · median ${F.lvlMedian} min · peak ${F.lvlPeak}"`],
        ['D7', () => `about ${F.vedTasksPerDay} Tasks a day at Vedanta, where v7/1's grouping shows about ${F.v71VedPerDay} on screen`], ['D7', () => `about ${F.dpTasksPerDay} Tasks a day once Live`],
        ['D19', () => `"Entered for ${F.vedLastService} of ${F.vedEq} pieces of equipment"`], ['D19', () => `so ${F.vedDueOnGoLive} scheduled Tasks would fall due`],
        ['D21', () => `Level high · EQ-1 (${F.lvlPerDay} a day)`], ['D21', () => `DO low · SBR-1 (${F.doPerDay} a day`],
        ['D24', () => `'Fired ${F.lvlCount} times in ${F.lvlDays} days'`], ['D24', () => `would have fired ${F.lvlTuned} times instead of ${F.lvlCount}'`], ['D24', () => `about ${clrTime} on ${clrDay}`],
        ['D25', () => `Caution 44 A (base ${bases[0]} A), Minor 48 A (base ${bases[1]} A) and Major none (base ${bases[2]} A)`], ['D25', () => `review by ${review}`],
        [8, () => `${F.dpUnclassified} of DigitalPaani's ${F.dpEquipment} pieces of equipment and ${F.bawalByRules} of Bawal's ${F.bawalEq}`],
        [18, () => `so it falls on ${review}`], [24, () => `puts ${F.vedDueOnGoLive} of Vedanta's ${F.vedScheduled} scheduled Tasks on that day`],
      ];
      const off = QUOTES.map(([w, f]) => [w, f()]).filter(([w, s]) => /undefined|NaN/.test(s) || !(typeof w === 'number' ? readingText(w) : cardText(w)).includes(s));
      ok(!off.length, `the cards and readings quote v7/2's engine (${QUOTES.length} sentences rebuilt from its numbers)`, off.map(([w, s]) => `${typeof w === 'number' ? 'reading ' + w : w}: "${s}"`).slice(0, 6).join(' | '));
    }
    if (STRICT72 && HAS72) {
      const full = APPS.probe('2', { full: true, hashes: routes, chapters: true });
      if (ok(full.loaded, 'v7/2 loads in full to land on each linked page', (full.errors || []).join(' | '))) {
        const bad2 = routes.map((r) => [r, full.routes[r] || { problem: 'not asked' }]).filter(([, x]) => x.problem).map(([r, x]) => `${r}: ${x.problem} (${(staticProblem72(r).m || {}).owner || '?'})`);
        ok(!bad2.length, `every v7/2 page the pages link lands on a real v7/2 page (${routes.length} routes)`, bad2.slice(0, 8).join(' | '));
        const ch = full.chapters;
        if (ok(Array.isArray(ch) && ch.length === 12, 'v7/2\'s story has twelve chapters to match', ch ? `${ch.length}` : 'no chapters()')) {
          ok(ch.every((c2, i) => c2.title === TITLES72[i]), 'v7/2\'s chapter titles are the ones the overview and the hand-off name', ch.map((c2) => c2.title).join(' · '));
          const ov = PAGES[0].story72 || []; const ho = PAGES[3].opens || [];
          ok(ov.length === 12 && ch.every((c2, i) => ov[i] === c2.href), 'overview: each v7/2 chapter links what v7/2\'s own story opens', ov.map((x, i) => (x === ch[i].href ? '' : `${i + 1}: ${x} ≠ ${ch[i].href}`)).filter(Boolean).join(' | '));
          ok(ho.length === 12 && ch.every((c2, i) => ho[i] === c2.href), 'v7/2 hand-off: each chapter opens what v7/2\'s own story opens', ho.map((x, i) => (x === ch[i].href ? '' : `${i + 1}: ${x} ≠ ${ch[i].href}`)).filter(Boolean).join(' | '));
        }
      }
    } else note(`v7/2's pages are checked by route and object only; set V72_READY (or CTL_V72_ROUTES=1) to land on each of the ${routes.length} pages`);
  }
  /* v7/1's reverse links: "Same place in v7/2 →" and "Compare with v7/2 →" name real v7/2 moments */
  {
    const chs = UI.chapters();
    ok(chs.length === 12 && chs.every((c) => typeof c.cmp72 === 'string' && !staticProblem72(c.cmp72).problem), 'v7/1\'s chapters each name their moment in v7/2', chs.map((c) => c.cmp72).join(', '));
    const was = G.V7DEC.V72_READY;
    G.V7DEC.V72_READY = false;
    const off = UI.chromeHtml('p/vedanta');
    ok(!/tbSame|Compare with v7\/2/.test(off) && UI.chapters().every((c) => c.compare72 === null), 'v7/1: no link into v7/2 in the top bar or the story while v7/2 is unpublished');
    G.V7DEC.V72_READY = true;
    const on = UI.chromeHtml('p/vedanta/alert/a_3d');
    ok(/<a class="tb-ver tb-same" id="tbSame" href="\.\.\/2\/prototype\.html#\/p\/vedanta\/trigger\/a_3d" target="v7-2"[^>]*><span>Same place in <\/span><b>v7\/2<\/b> →<\/a>/.test(on), 'v7/1: once v7/2 is published the top bar has "Same place in v7/2 →" for the current page\'s chapter, in window v7-2');
    ok((on.match(/class="ch-also ch-cmp" href="\.\.\/2\/prototype\.html#\/[^"]+" target="v7-2"/g) || []).length === 12 && /Compare with v7\/2 →/.test(T(on)), 'v7/1: and every story chapter has "Compare with v7/2 →"');
    G.V7DEC.V72_READY = was;
    chs.forEach((c) => V72_HASHES.add(c.cmp72));
  }

  ok(G.V7DEC.V72_READY !== true || (HAS72 && fs.existsSync(path.join(V72, 'index.html')) && /window\.V7_VARIANT = '2';/.test(read(path.join(V72, 'index.html')))), 'V72_READY is true only once v7/2 is published (its prototype and hand-off exist)', `v7/2 ${HAS72 ? 'exists' : 'is missing'}, V72_READY ${G.V7DEC.V72_READY}`);

  /* ── 6. answers on the challenges doc ───────────────────────────────────────────────────────────────────── */
  {
    const pg = PAGES[1];
    const r = runPage(pg);
    const doc = r.el('doc');
    const pick = (id, opt) => doc.on.click[0]({ target: { closest: (sel) => (sel === '[data-dd-pick]' ? { getAttribute: (k) => ({ 'data-dd-pick': id, 'data-opt': String(opt) })[k] } : null) } });
    ok(doc.on.click && doc.on.click.length, 'answers: the doc binds its your-call chips');
    pick('D15', 2); pick('D22', 1);
    let saved = null; try { saved = JSON.parse(r.store.get('ctl7.decisions')); } catch (e) { /* none */ }
    ok(saved && saved.v === 1 && saved.answers.D15.opt === 2 && saved.answers.D22.opt === 1, 'answers: a chip writes ctl7.decisions, the key both prototypes read');
    const sl = r.el('study-list');
    sl.on.click[0]({ target: { closest: (sel) => (sel === '[data-study]' ? { getAttribute: (k) => ({ 'data-study': 'study-markers', 'data-opt': '1' })[k] } : null) } });
    ok(JSON.parse(r.store.get('ctl7.study')).answers['study-markers'] === 1 && /Option 2, as recommended/.test(T(sl.innerHTML)), 'answers: a study call is kept under ctl7.study and shows');
    r.el('copy-answers').on.click[0]({});
    await tick(); await tick();
    const t = r.copied[0] || '';
    ok(/^My calls on the v7 decisions/.test(t) && /D15 — [^\n]+: No freeze/.test(t) && /D22 — /.test(t) && /Not answered yet: D1, D2,/.test(t) && /Calls about the study\nStudy call 2 — [^\n]+: On by default/.test(t), 'answers: Copy my answers copies every card and the study call', t.slice(0, 300));
    ok(/^Copied 2 calls on the cards and 1 about the study\./.test(r.el('copy-msg').textContent), 'answers: and says what it copied', r.el('copy-msg').textContent);
    const f = runPage(pg, { store: { 'ctl7.decisions': r.store.get('ctl7.decisions') }, clipboardFails: true });
    f.el('copy-answers').on.click[0]({}); await tick(); await tick();
    ok(f.el('copy-box').hidden === false && /D15 — /.test(f.el('copy-text').value), 'answers: when the browser blocks copying, the text shows to copy by hand');
    const e = runPage(pg); e.el('copy-answers').on.click[0]({}); await tick();
    ok(/No calls yet/.test(e.el('copy-msg').textContent) && !e.copied.length, 'answers: with no call yet it says so and copies nothing');
  }

  /* ── 3. README's v7 lines and this file ─────────────────────────────────────────────────────────────────── */
  const readme = read(path.join(SITE, ['README', 'md'].join('.')));
  const v7lines = readme.split('\n').filter((l) => /^- `v7\//.test(l));
  const line2 = v7lines.find((l) => /^- `v7\/2\/` /.test(l)) || '';
  const line3 = v7lines.find((l) => /^- `v7\/3\/` /.test(l)) || '';   /* v7/3, the decided build, once it exists */
  ok(v7lines.length === (line3 ? 5 : 4) && (!line3 || (/prototype\.html/.test(line3) && /index\.html/.test(line3))) && v7lines.some((l) => /^- `v7\/` /.test(l)) && v7lines.some((l) => /^- `v7\/challenges\.html` /.test(l)) && v7lines.some((l) => /^- `v7\/1\/` /.test(l) && /prototype\.html/.test(l) && /index\.html/.test(l))
    && (READY ? /prototype\.html/.test(line2) && /index\.html/.test(line2) && !/in build/.test(line2) : /^- `v7\/2\/` — v7\/2 \(Alex's model as drafted\) — in build/.test(line2)),
  `README: the overview, the challenges doc, v7/1 and v7/2 (${READY ? 'published: its prototype and hand-off' : '"in build"'})`, v7lines.map((l) => l.slice(0, 40)).join(' | '));
  clean(v7lines.join('\n'), 'README\'s v7 lines');
  clean(read(__filename), 'this test file');
  /* every other file that ships under site/v7: scripts, styles, tests and pages, comments included. Allowed: the tests' own
     pattern lists (a line that defines one, or a pattern written as a regular expression in a list); the workbook's quoted
     lab weights and lab steps; object7.js's local lookup table; v6's notes in app.js and data.js that name its spec
     document (no section or line pointers). Written so this file passes too. */
  const walk = (d) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
  const REGEX_ITEM = /\/(?![\/*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^\/\\\n[])+\/[dgimsuy]*(?=\s*[,\]\)}]|\s*$)/g;
  let swept = 0;
  for (const f of walk(V7)) {
    if (f === __filename || !/\.(js|css|html|json|md|txt|svg)$/i.test(f)) continue;
    const isTest = /[\\/]tests[\\/]/.test(f);
    const bad = []; swept++;
    read(f).split('\n').forEach((l, i) => {
      if (/^\s*\[['"][^'"]+['"],\s*(\/|new RegExp)|\bconst (PRON|SCRUB|STRIP|BANNED|IDS|HASHED|JUNK)\s*=/.test(l)) return;
      let t = l.replace(/lab weights "?W\d\\?\/W\d"?|"W[1]" in a lab step|\(W[12]\)|W[2] − W[1]|\bW[2](?=\s*[=\[])/g, ' ');
      if (/[\\/](app|data)\.js$/.test(f)) t = t.replace(/\bP[R]D\b/g, ' ');
      if (isTest) t = t.replace(REGEX_ITEM, ' ');
      const h = scrubHits(t); if (h.length) bad.push(`${i + 1}: ${h[0]}`);
    });
    ok(!bad.length, `${path.relative(SITE, f)}: nothing internal in the source`, bad.slice(0, 3).join(' | '));
  }
  ok(swept >= 30, 'the public sweep reads every file under site/v7', `${swept} files`);

  finish();
})().catch((e) => { ok(false, 'the test runs', e.stack); finish(); });

function finish() {
  const lines = [`docs test · ${PAGES.length} pages · ${N} cards · ${READINGS.length} readings · v7/2 ${READY ? 'published' : 'in build'}${STRICT72 ? ' · v7/2 pages rendered' : ''}`];
  if (NOTES.length) lines.push(`notes (${NOTES.length}): ` + NOTES.join(' | '));
  if (FAIL.length) { lines.push(`FAILURES (${FAIL.length}):`); (VERBOSE ? FAIL : FAIL.slice(0, 30)).forEach((f) => lines.push('  ✗ ' + f)); if (!VERBOSE && FAIL.length > 30) lines.push(`  … ${FAIL.length - 30} more (use -v)`); }
  lines.push(`${FAIL.length ? 'RESULT: FAIL' : 'RESULT: PASS'} · ${CHECKS} checks · ${FAIL.length} failures`);
  console.log(lines.join('\n'));
  process.exit(FAIL.length ? 1 : 0);
}
