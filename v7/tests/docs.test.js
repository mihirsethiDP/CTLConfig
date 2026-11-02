#!/usr/bin/env node
/* v7 · tests/docs.test.js — headless checks for the three v7 pages. Node only, no dependencies; run from site/v7:
   node tests/docs.test.js [-v]
   Pages: index.html (the overview), challenges.html (the challenges doc), 1/index.html (v7/1's hand-off doc).
   1. sources   each page loads only the shared decision file (plus its stylesheet and Google Fonts), has one inline
                script that says which page it is (V7_PAGE; V7_VARIANT on the hand-off), a title, a description and a
                viewport; the two pages in site/v7 carry light and dark tokens, an explicit background and a 16px gutter
                at phone width.
   2. render    each page's inline script runs against a stub DOM with the decision file, with empty storage, with calls
                stored and with storage blocked. Every card renders once with its #Dn anchor (the overview links each to
                challenges.html#Dn); the challenges doc groups the cards by when they arose, lists every reading and the
                calls about the study, and a deep link (#D15) lands on its card.
   3. public    the scrub patterns and the they/them check find nothing in any page source (comments included), in the
                rendered text, in README's v7 lines, in this file, or in any other file under site/v7 (every script, style
                and test that ships; only the tests' own pattern lists and a few quoted data words are allowed).
   4. v7/2      no link into v7/2 (2/… or ../2/…) is emitted while V7DEC.V72_READY is false; with it true, each page
                links v7/2, so the flag alone decides. Once site/v7/2/prototype.html exists, the flag must be true and every
                v7/2 route the pages link must land on a real v7/2 page (v7/2 is loaded in its own process).
   5. links     every app route the pages link (1/prototype.html#/… or prototype.html#/…) is a real v7/1 route that lands
                on a real page; every in-page anchor exists; every linked file exists.
   6. answers   your-call chips write ctl7.decisions; Copy my answers copies every card and the study calls, or shows the
                text to copy by hand when the browser blocks copying.
   Exit 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const V7 = path.resolve(__dirname, '..');
const SITE = path.resolve(V7, '..');
const V71 = path.join(V7, '1');
const VERBOSE = process.argv.includes('-v');
const smoke = require(path.join(V71, 'tests', 'smoke.js'));     // the v7/1 stub DOM and text helpers (not run when required)

const FAIL = []; let CHECKS = 0;
function ok(cond, what, extra) { CHECKS++; if (!cond) FAIL.push(what + (extra ? `  — ${extra}` : '')); return !!cond; }
const read = (f) => fs.readFileSync(f, 'utf8');

const PAGES = [
  { key: 'overview', file: path.join(V7, 'index.html'), page: 'overview', dec: '1/assets/decisions7.js', css: '1/assets/decisions7.css', app: '1/prototype.html', v2: /^2\//, top: true },
  { key: 'challenges', file: path.join(V7, 'challenges.html'), page: 'challenges', dec: '1/assets/decisions7.js', css: '1/assets/decisions7.css', app: '1/prototype.html', v2: /^2\//, top: true },
  { key: 'v7/1 hand-off', file: path.join(V71, 'index.html'), page: 'doc', dec: 'assets/decisions7.js', css: 'assets/decisions7.css', app: 'prototype.html', v2: /^\.\.\/2\//, top: false },
];

/* ── the public scrub: the site is public, so no page names Alex's internals. Written so this file passes it too: the
   names that must not appear are kept here only as hashes of their lowercase words. ───────────────────────────── */
const SCRUB = [
  ['an Alex decision, conflict or open-question ID', /\b(C[M]|C|O)-\d/],
  ['a commissioning-memo exception ID', /\bE[1-5]\b/],
  ['a wireframe ID', /\bW\d[a-z]?\b/],
  ['a scenario or screen ID', /\bS\d\b/],
  ['a pattern ID', /\bP[12]\b/],
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
const NOTFOUND = /\b(Not found|No such|could not be shown|is not in the prototype)\b/;
/* v7/2, once it exists: its prototype is loaded in a child process (its own globals), in its prototype.html's order */
const V72 = path.join(V7, '2'); const HAS72 = fs.existsSync(path.join(V72, 'prototype.html'));
function routes72(hashes) {
  if (!HAS72 || !hashes.length) return {};
  const code = `const fs=require('fs'),path=require('path'),vm=require('vm');const D=${JSON.stringify(V72)};`
    + `const sm=require(fs.existsSync(path.join(D,'tests','smoke.js'))?path.join(D,'tests','smoke.js'):${JSON.stringify(path.join(V71, 'tests', 'smoke.js'))});sm.installDom();`
    + `const html=fs.readFileSync(path.join(D,'prototype.html'),'utf8');const order=[...html.matchAll(/<script[^>]*\\bsrc="assets\\/([^"?]+)/g)].map((m)=>m[1]);`
    + `console.warn=()=>{};for(const f of order)vm.runInThisContext(fs.readFileSync(path.join(D,'assets',f),'utf8'),{filename:f});if(global.V7&&global.V7.reset)global.V7.reset();else if(global.V7&&global.V7.boot)global.V7.boot();`
    + `const NF=${NOTFOUND.toString()};const out={};for(const h of JSON.parse(fs.readFileSync(0,'utf8'))){let r='';`
    + `if(!global.V7UI.match(h))r='no route';else{try{if(NF.test(sm.visibleText(global.V7UI.renderPath(h)).slice(0,300)))r='lands on a "not found" page';}catch(e){r='throws '+e.message;}}out[h]=r;}`
    + `process.stdout.write(JSON.stringify(out));`;
  const res = require('child_process').spawnSync(process.execPath, ['-e', code], { input: JSON.stringify(hashes), encoding: 'utf8', maxBuffer: 64 << 20 });
  try { return JSON.parse(res.stdout); } catch (e) { return { '(v7/2 did not load)': (res.stderr || '').slice(0, 300) }; }
}
const routeMemo = new Map();
function routeProblem(hash) {
  if (routeMemo.has(hash)) return routeMemo.get(hash);
  let r = '';
  if (!UI.match(hash)) r = 'no route';
  else { try { if (NOTFOUND.test(smoke.visibleText(UI.renderPath(hash)).slice(0, 300))) r = 'lands on a "not found" page'; } catch (e) { r = 'throws ' + e.message; } }
  routeMemo.set(hash, r); return r;
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
  if (o.ready) ctx.V7DEC.V72_READY = true;
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let threw = null;
  try { inline.forEach((s, i) => vm.runInContext(s, ctx, { filename: `${pg.key}: inline script ${i + 1}` })); } catch (e) { threw = e; }
  const rendered = () => [...els.values()].map((e) => e.innerHTML).join('\n');
  const whole = () => html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ') + '\n' + rendered();
  return { html, ctx, els, store, scrolled, copied, added, threw, rendered, whole, el: (id) => document.getElementById(id) };
}
const T = (h) => smoke.visibleText(h);
const hrefs = (h) => [...String(h).matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => smoke.decode(m[1]));     // the links a reader follows
const tick = () => new Promise((r) => setImmediate(r));

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
    if (pg.page === 'doc') ok(/window\.V7_VARIANT = '1';/.test(inline[0] || ''), `${pg.key}: sets V7_VARIANT = '1'`);
    ok(/<title>[^<]{6,}<\/title>/.test(html) && /<meta name="description" content="[^"]{40,}">/.test(html) && /<meta name="viewport" content="width=device-width, initial-scale=1">/.test(html), `${pg.key}: title, description and viewport`);
    ok(fs.existsSync(path.join(path.dirname(pg.file), pg.css)), `${pg.key}: its stylesheet exists`);
    if (pg.top) {
      ok(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/.test(html) && /:root\[data-theme="dark"\]/.test(html), `${pg.key}: light and dark tokens (dark follows the reader unless the page says otherwise)`);
      ok(/body \{[^}]*background: var\(--bg\)/.test(html), `${pg.key}: the body has an explicit background`);
      ok(/@media \(max-width: 640px\) \{[\s\S]*?\.wrap \{ padding: 0 16px; \}/.test(html), `${pg.key}: a 16px gutter at phone width`);
    } else {
      ok(/<html lang="en" data-theme="light">/.test(html), `${pg.key}: stays light, so the shared cards never turn dark inside it`);
    }
  }

  /* ── 2–6 per page ───────────────────────────────────────────────────────────────────────────────────────── */
  const WEEK = { 'ctl7.decisions': JSON.stringify({ v: 1, answers: { D3: { opt: 1, note: '', at: '' }, D15: { opt: 'other', note: 'Ask Alex first', at: '' }, D2: { opt: 2, note: '', at: '' } } }), 'ctl7.study': JSON.stringify({ v: 1, answers: { 'study-words': 2 } }) };
  for (const pg of PAGES) {
    if (!fs.existsSync(pg.file)) continue;
    const r = runPage(pg);
    if (!ok(!r.threw, `${pg.key}: the inline script runs with empty storage`, r.threw && r.threw.stack)) continue;
    const out = r.rendered(); const whole = r.whole(); const text = T(whole);
    ok(out.length > (pg.key === 'overview' ? 5000 : 50000), `${pg.key}: the script draws the page from the decision file`, `${out.length} characters`);
    for (const j of JUNK) ok(!j.test(T(out)), `${pg.key}: the rendered text has no "${j.source}"`);

    /* 3. public */
    clean(r.html.replace(/the lab weights W\d\/W\d/g, 'the lab weights'), `${pg.key} source (comments and scripts included; the workbook's lab weights are quoted data)`);
    clean(T(whole).replace(/the lab weights W\d\/W\d/g, 'the lab weights'), `${pg.key} rendered text`);

    /* 4. no v7/2 link while it is in build */
    const all = hrefs(whole);
    const into2 = all.filter((h) => pg.v2.test(h) || /(^|\/)2\/(prototype|index)\.html/.test(h));
    ok(!into2.length, `${pg.key}: no link into v7/2 while V72_READY is false`, into2.slice(0, 4).join(' | '));
    ok(/v7\/2[^.]{0,80}in build/i.test(text), `${pg.key}: says v7/2 is in build`);

    /* 5. links */
    const appLinks = [...new Set(all.filter((h) => h.split('#')[0] === pg.app))];
    ok(appLinks.length >= (pg.key === 'overview' ? 13 : 40), `${pg.key}: links into v7/1`, `${appLinks.length} distinct`);
    const bad = []; for (const h of appLinks) { const route = h.slice(pg.app.length); if (!route) continue; if (!/^#\//.test(route)) { bad.push(`${h}: not an app route`); continue; } const p = routeProblem(route); if (p) bad.push(`${h}: ${p}`); }
    ok(!bad.length, `${pg.key}: every app route it links is a real v7/1 page`, bad.slice(0, 5).join(' | '));
    const ids = new Set([...whole.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...new Set(all.filter((h) => h[0] === '#' && h.length > 1).map((h) => h.slice(1)))];
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
      const want = [['group-first-review', 'From the first review of Alex\'s packs'], ['group-reviewing-v7-1', 'From reviewing v7/1'], ['group-designing-v7-2', 'From designing v7/2']];
      const at = want.map(([id]) => doc.indexOf(`id="${id}"`));
      ok(at.every((i) => i >= 0) && at.every((i, k) => !k || i > at[k - 1]) && doc.indexOf('id="readings"') > at[2] && doc.indexOf('id="dd-glance-h"') < at[0], 'challenges: at a glance, then the three groups in order, then the readings');
      want.forEach(([id, title]) => { const n = CARDS.filter((d) => ({ 'group-first-review': 'First review', 'group-reviewing-v7-1': 'Reviewing v7/1', 'group-designing-v7-2': 'Designing v7/2' })[id] === (d.arose || 'First review')).length; ok(T(doc).includes(`${title} · ${n}`), `challenges: "${title} · ${n}"`); });
      const first = doc.slice(at[0], at[1]);
      ok(CARDS.slice(0, 21).every((d) => first.includes(`id="${d.id}"`)) && !CARDS.slice(21).some((d) => first.includes(`id="${d.id}"`)), 'challenges: D1–D21 sit under the first review, the later cards after it');
      ok(T(doc).includes(`Readings v7/2 takes where Alex's drafts are silent · ${READINGS.length}`) && READINGS.every((x) => doc.includes(`id="reading-${x.n}"`)), `challenges: the ${READINGS.length} readings, each anchored`);
      ok((doc.match(/<tr><td data-label="Card">/g) || []).length === N, 'challenges: the at-a-glance table has a row per card');
      ok(r.html.indexOf('<main class="doc" id="doc">') < r.html.indexOf('id="study"'), 'challenges: the cards are drawn into <main>, the study calls follow');
      const study = r.el('study-list').innerHTML; const SN = (study.match(/<section class="dd-card" id="study-[a-z]+"/g) || []).length;
      ok(SN >= 2 && (study.match(/<span class="dd-id">Study call \d+<\/span>/g) || []).length === SN && /Recommended/.test(study) && /data-study="study-words" data-opt="0"/.test(study) && /data-study="study-markers"/.test(study), 'challenges: the calls about the study, each with options and a call to mark', `${SN} calls`);
      const toc = r.el('toc-cards').innerHTML;
      ok(CARDS.every((d) => toc.includes(`href="#${d.id}"`)) && want.every(([id]) => toc.includes(`href="#${id}"`)), 'challenges: the contents link every group and every card');
      ok(T(r.el('counts').innerHTML) === `${N} challenges · ${READINGS.length} readings v7/2 takes · ${SN} calls about the study`, 'challenges: the counts under the title, counted as challenges like the overview', T(r.el('counts').innerHTML));
      ok(/<a href="index\.html">Both approaches<\/a>/.test(r.html) && /<a href="1\/prototype\.html#\/plants">the prototype<\/a>/.test(r.html) && /<a href="1\/index\.html">its hand-off<\/a>/.test(r.html) && T(r.el('v72-links').innerHTML) === 'in build', 'challenges: links the overview, v7/1\'s prototype and hand-off; v7/2 is "in build" text');
      const how = T(innerOf(r.html, 'how').inner);
      ok(/Copy my answers/.test(how) && /shared with the Decisions pages of both prototypes/.test(how) && /Pick your call/.test(how), 'challenges: "How to answer" says how to pick, copy, and that calls are shared');
      ok(/marker/.test(T(r.html.slice(r.html.indexOf('<p class="sub">'), r.html.indexOf('</p>', r.html.indexOf('<p class="sub">'))))), 'challenges: the lede says each screen\'s marker links here');
      /* deep link */
      const deep = runPage(pg, { hash: '#D15' });
      ok(deep.scrolled.includes('D15'), 'challenges: challenges.html#D15 scrolls to card D15', deep.scrolled.join(','));
      const deepS = runPage(pg, { hash: '#study-markers' });
      ok(deepS.scrolled.includes('study-markers'), 'challenges: a deep link to a study call lands on it');
    }
    if (pg.key === 'overview') {
      const tbl = r.el('ov-table').innerHTML;
      ok(/<th scope="col">Card<\/th><th scope="col">Question<\/th><th scope="col">Severity<\/th><th scope="col">v7\/1 builds<\/th><th scope="col">v7\/2 builds<\/th><th scope="col">Same or differs<\/th><th scope="col">Your call<\/th><th scope="col">Read<\/th>/.test(tbl), 'overview: the table\'s columns');
      const rows = tbl.split('<tr>').slice(2);
      ok(rows.length === N && CARDS.every((d, i) => (rows[i] || '').includes(`href="challenges.html#${d.id}"`)), 'overview: a row per card, each linking its section in the challenges doc');
      ok(CARDS.every((d, i) => (rows[i] || '').includes(d.both === true ? 'sd-same">Same<' : 'sd-diff">Differs<')), 'overview: Same exactly where both prototypes build the same thing');
      ok(CARDS.every((d, i) => T(rows[i] || '').includes(T(G.V7DEC.esc(G.V7DEC.builds(d, '1')))) && T(rows[i] || '').includes(T(G.V7DEC.esc(G.V7DEC.builds(d, '2'))))), 'overview: what each prototype builds, from the card');
      ok(/<a class="p" href="challenges\.html">Read the challenges doc →<\/a>/.test(r.html), 'overview: the challenges doc is its first call to action');
      ok(/<a class="btn p" href="1\/prototype\.html#\/plants">Open the prototype<\/a><a class="btn s" href="1\/index\.html">Read the hand-off<\/a>/.test(r.html), 'overview: v7/1 opens the prototype and the hand-off');
      ok(/In build/.test(T(innerOf(r.html, 'v72-state').inner)) && !/<a\b/.test(r.el('v72-go').innerHTML), 'overview: v7/2 is "In build", with no link');
      ok(/What is the same in both/.test(r.html), 'overview: what is the same in both');
      const story = innerOf(r.html, 'story-rows').inner;
      const chs = UI.chapters();
      const sRows = [...story.matchAll(/<tr><td>(\d+)<\/td><td><a href="1\/prototype\.html(#[^"]*)">([^<]+)<\/a><\/td><td id="v72-ch-\d+">([^<]+)<\/td><\/tr>/g)];
      ok(sRows.length === 12 && sRows.every((m, i) => +m[1] === i + 1 && chs[i] && m[2] === chs[i].href && smoke.decode(m[3]) === chs[i].title), 'overview: the twelve chapters match v7/1\'s story (title and link)', sRows.map((m) => m[1] + ' ' + m[2]).join(', '));
      ok(T(r.el('ov-more').innerHTML).includes(`${READINGS.length} readings`), 'overview: points to the readings in the challenges doc');
    }
    if (pg.key === 'v7/1 hand-off') {
      const list = r.el('dec-list').innerHTML; const glance = r.el('dec-table').innerHTML;
      ok(CARDS.every((d) => (list.match(new RegExp(`<section class="dd-card" id="${d.id}"`, 'g')) || []).length === 1), 'v7/1 hand-off: every card renders once, anchored #Dn');
      ok((glance.match(/<tr><td data-label="Card">/g) || []).length === N && (list.match(/You are here/g) || []).length === N, 'v7/1 hand-off: the at-a-glance table and "You are here" on v7/1');
      ok(/<p class="ver">This is v7\/1, the recommended approach\. <a href="\.\.\/index\.html">Both approaches<\/a> · <a href="\.\.\/challenges\.html">Challenges doc<\/a>\. v7\/2, [^<]*in build\.<\/p>/.test(r.html), 'v7/1 hand-off: the top block names v7/1, links both approaches and the challenges doc, and names v7/2 as in build');
      ok(/href="\.\.\/challenges\.html">Read every challenge in the challenges doc/.test(r.html), 'v7/1 hand-off: its decisions section links the challenges doc');
      ok(r.el('dec-contract').innerHTML.includes('<table class="dsum">'), 'v7/1 hand-off: "Changes the cards ask for" still draws');
      ok(T(r.el('dec-n').innerHTML) === String(N), 'v7/1 hand-off: the decisions tile counts every card', T(r.el('dec-n').innerHTML));
      const deep = runPage(pg, { hash: '#D7' });
      ok(deep.scrolled.includes('D7'), 'v7/1 hand-off: index.html#D7 lands on its card');
    }

    /* storage: calls made elsewhere show; blocked storage still renders */
    const s = runPage(pg, { store: WEEK });
    const so = s.rendered();
    ok(!s.threw && /Option 2/.test(T(so)) && /Something else|Note only/.test(T(so)), `${pg.key}: calls stored in this browser show`, s.threw && s.threw.message);
    const b = runPage(pg, { blocked: true });
    ok(!b.threw && b.rendered().length > out.length * 0.9, `${pg.key}: renders with storage blocked`, b.threw && b.threw.message);

    /* 4. with v7/2 ready, the same pages link it */
    const y = runPage(pg, { ready: true });
    const yl = hrefs(y.whole()).filter((h) => pg.v2.test(h));
    ok(!y.threw && yl.length >= (pg.key === 'v7/1 hand-off' ? 20 : 12), `${pg.key}: once V72_READY is true it links v7/2 (the flag alone decides)`, `${yl.length} links`);
    if (HAS72) {
      const app2 = pg.top ? '2/prototype.html' : '../2/prototype.html'; const doc2 = pg.top ? '2/index.html' : '../2/index.html';
      const into = [...new Set(yl.filter((h) => h.split('#')[0] === app2).map((h) => h.slice(app2.length)).filter((h) => /^#\//.test(h)))];
      const got = routes72(into); const bad2 = Object.keys(got).filter((h) => got[h]).map((h) => `${h}: ${got[h]}`);
      ok(!bad2.length && Object.keys(got).length >= into.length, `${pg.key}: every v7/2 route it links lands on a real v7/2 page`, bad2.slice(0, 5).join(' | '));
      const cardsIn2 = yl.filter((h) => h.split('#')[0] === doc2 && h.includes('#')).map((h) => h.split('#')[1]);
      ok(fs.existsSync(path.join(V72, 'index.html')) && cardsIn2.every((a) => /^D\d+$/.test(a) ? !!G.V7DEC.byId(a) : true), `${pg.key}: v7/2's hand-off exists and every card it links into it is a real card`);
    }
  }

  ok(HAS72 ? G.V7DEC.V72_READY === true : G.V7DEC.V72_READY === false, 'V72_READY is true exactly when v7/2\'s prototype exists', `v7/2 ${HAS72 ? 'exists' : 'is missing'}, V72_READY ${G.V7DEC.V72_READY}`);

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
  ok(v7lines.length === 4 && v7lines.some((l) => /^- `v7\/` /.test(l)) && v7lines.some((l) => /^- `v7\/challenges\.html` /.test(l)) && v7lines.some((l) => /^- `v7\/1\/` /.test(l) && /prototype\.html/.test(l) && /index\.html/.test(l)) && v7lines.some((l) => /^- `v7\/2\/` — v7\/2 \(Alex's model as drafted\) — in build/.test(l)), 'README: the overview, the challenges doc, v7/1 and "v7/2 … in build"', v7lines.map((l) => l.slice(0, 40)).join(' | '));
  clean(v7lines.join('\n'), 'README\'s v7 lines');
  clean(read(__filename), 'this test file');
  /* every other file that ships under site/v7: scripts, styles, tests and pages, comments included. Allowed: the tests' own
     pattern lists; the workbook's quoted lab weights and lab steps; object7.js's local lookup table; v6's notes in
     app.js and data.js that name its spec document (no section or line pointers). Written so this file passes too. */
  const walk = (d) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
  let swept = 0;
  for (const f of walk(V7)) {
    if (f === __filename || !/\.(js|css|html|json|md|txt|svg)$/i.test(f)) continue;
    const bad = []; swept++;
    read(f).split('\n').forEach((l, i) => {
      if (/^\s*\[['"][^'"]+['"],\s*(\/|new RegExp)|\bconst (PRON|SCRUB|STRIP|BANNED|IDS|HASHED|JUNK)\s*=/.test(l)) return;
      let t = l.replace(/lab weights "?W\d\\?\/W\d"?|"W[1]" in a lab step|\(W[12]\)|W[2] − W[1]|\bW[2](?=\s*[=\[])/g, ' ');
      if (/[\\/](app|data)\.js$/.test(f)) t = t.replace(/\bP[R]D\b/g, ' ');
      const h = scrubHits(t); if (h.length) bad.push(`${i + 1}: ${h[0]}`);
    });
    ok(!bad.length, `${path.relative(SITE, f)}: nothing internal in the source`, bad.slice(0, 3).join(' | '));
  }
  ok(swept >= 30, 'the public sweep reads every file under site/v7', `${swept} files`);

  finish();
})().catch((e) => { ok(false, 'the test runs', e.stack); finish(); });

function finish() {
  const lines = [`docs test · ${PAGES.length} pages · ${N} cards · ${READINGS.length} readings`];
  if (FAIL.length) { lines.push(`FAILURES (${FAIL.length}):`); (VERBOSE ? FAIL : FAIL.slice(0, 30)).forEach((f) => lines.push('  ✗ ' + f)); if (!VERBOSE && FAIL.length > 30) lines.push(`  … ${FAIL.length - 30} more (use -v)`); }
  lines.push(`${FAIL.length ? 'RESULT: FAIL' : 'RESULT: PASS'} · ${CHECKS} checks · ${FAIL.length} failures`);
  console.log(lines.join('\n'));
  process.exit(FAIL.length ? 1 : 0);
}
