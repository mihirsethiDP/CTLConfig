#!/usr/bin/env node
/* v7 · tests/decisions7.test.js — headless checks for assets/decisions7.js and this folder's hand-off doc index.html.
   The same file runs in site/v7/1 and site/v7/2 (it reads which one it is in); the other prototype is asked its questions
   in a child process (site/v7/tests/apps.js). Node only, no dependencies.
   Usage: node tests/decisions7.test.js [-v]          CTL_V72_ROUTES=1 also renders every v7/2 page the cards link
   1. The cards: D1…Dn in order (the 21 from the first review, then any that arose later), every field present, one
      recommended option each, D1–D21's question, severity and recommended option pinned, they/them in prose, no
      "ids" or "evidence" fields, no internal references in any text (STRIP: Alex's document IDs, wireframe IDs, file
      names and paths, internal document and code names, the second real plant's name), every v7/1 link a v7/1 route
      that lands on a real v7/1 page.
   1b. The newer fields, wherever a card carries them (all optional): short, arose, the option each prototype builds,
      both, the one-line summaries, paired links, and `where` (router syntax, real v7/1 screens, every link's route
      covered); window.V7_READINGS when present. Fixtures that break each rule prove the checks fire.
   1c. The v7/2 side: every v7/2 link and every v7/2 `where` pattern is a route v7/2 registers, naming objects v7/2 has;
      with V7DEC.V72_READY true (or CTL_V72_ROUTES=1) each link also lands on a real v7/2 page and each pattern is
      registered there.
   2. Standalone load (a fresh context with no app): window.V7_DECISIONS and window.V7DEC exist, no routes, no throw.
   3. The app's views (this folder's assets, in prototype.html's order, as this prototype): routes registered, list (every
      filter) and every card page render as strings, no junk, every in-app link is this prototype's route, the page's own
      words are clean (a banned word may appear only inside the cards' quoted text), no rendered page or copied text
      matches STRIP.
   4. Your call: pick, note, other, clear, the copied text format, and the browser-storage key.
   5. index.html (v7/1's or v7/2's hand-off): loads only decisions7.js; its renderer fills the cards with every card, "You
      are here" on this prototype; neither its output nor the doc's own text matches a STRIP pattern; every link into
      either prototype is that prototype's route on real objects; every in-page anchor exists; acceptance criteria are
      numbered without gaps in their chapter groups; v7/2 is linked from v7/1's doc only once it is published.
   Exit 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const VERBOSE = process.argv.includes('-v');
const HERE = path.basename(ROOT) === '2' ? '2' : '1';                 // which prototype this folder holds
const APPS = require(path.resolve(ROOT, '..', 'tests', 'apps.js'));  // the v7/2 route table and the other prototype, asked in a child process
const smoke = require('./smoke.js');                 // exports the stub DOM and the word checkers (does not run when required)
smoke.installDom();
global.V7_VARIANT = HERE; global.V7_NO_V6_SHELL = true;

const FAIL = []; const NOTES = []; let CHECKS = 0;
function ok(cond, what, extra) { CHECKS++; if (!cond) FAIL.push(what + (extra ? `  — ${extra}` : '')); return !!cond; }
function note(s) { NOTES.push(s); }

/* STRIP: the site is public, so no card text and no rendered page may name Alex's internals. Kept: Alex's name, the
   cards' own D1…D21, v7's V7-n, v6's V6-37, plant names from v7's own sample plants and on-screen words. */
const STRIP = [
  ['an Alex decision, conflict or open-question ID', /\b(CM|C|O)-\d/],
  ['a commissioning-memo exception ID', /\bE[1-5]\b/],
  ['a wireframe ID', /\bW\d[a-z]?\b/],
  ['a scenario or screen ID', /\bS\d\b/],
  ['a pattern ID', /\bP[12]\b/],
  ['a limits-memo row', /\bmemo D\d\b/],
  ['an Equipment Card decision ID', /\bD-\d{3}\b/],
  ['a file name', /\.md\b/],
  ['a file path', /\b(cms1|ctl2|canonical|CloseTheLoop5|open-threads)\b/],
  ['the second real plant', new RegExp([[65, 109, 105, 116, 121], [78, 111, 105, 100, 97]].map((c) => String.fromCharCode(...c)).join('|'))],   // built at run time: this public file never spells the name
  ['an internal document pointer', /\bPRD\b|Brief v\d|\bpack [12]\b|\bStage [13]\b|§\s*\d/],
  ['an internal code name', /dp_intel|ControlUnit|PROCESS_STAGE_MAP/],
  ['a memo option letter', /\boption [CD]\b/],
];
function stripHits(text) {
  const t = String(text == null ? '' : text); const out = [];
  for (const [what, re] of STRIP) { const m = t.match(re); if (m) out.push(`${what} "${m[0]}": …${t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30).replace(/\s+/g, ' ')}…`); }
  return out;
}
function noStrip(text, where) { const h = stripHits(text); ok(!h.length, `${where} names no internal references`, h.join(' | ')); }

/* the prototype's routes */
const PATTERNS = ['plants', 'activity/:plant?', 'p/:plant/activity', 'p/:plant', 'p/:plant/scada', 'p/:plant/library', 'p/:plant/equipment',
  'p/:plant/readings', 'p/:plant/tasks', 'p/:plant/eq/:id/:tab?', 'p/:plant/eq/:id/phone', 'p/:plant/alert/:id', 'library', 'library/:code/:tab?',
  'differences', 'p/:plant/differences', 'p/:plant/issues', 'p/:plant/issue/:id', 'p/:plant/task/:id', 'decisions', 'decisions/:id'];
const TABS = new Set(['readings', 'issues', 'tasks', 'details']);
function matchPattern(hash) {
  const p = String(hash).replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
  const parts = p.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
  let best = null;
  for (const pat of PATTERNS) {
    const segs = pat.split('/'); const params = {}; let lit = 0; let okk = true;
    const need = segs.filter((s) => !/\?$/.test(s)).length;
    if (parts.length < need || parts.length > segs.length) continue;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]; const v = parts[i];
      if (s[0] === ':') { if (v == null) { if (!/\?$/.test(s)) okk = false; continue; } params[s.slice(1).replace(/\?$/, '')] = v; }
      else if (s !== v) { okk = false; break; } else lit++;
    }
    if (okk && (!best || lit > best.lit)) best = { pattern: pat, params, lit };
  }
  return best;
}

/* 1 + 3 + 5 need the app's data: load every asset that exists, in prototype.html's order */
function scriptOrder() {
  const html = fs.readFileSync(path.join(ROOT, 'prototype.html'), 'utf8');
  const out = []; const re = /<script[^>]*\bsrc\s*=\s*["']assets\/([^"'?]+)/gi; let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}
const ORDER = scriptOrder(); const LOADED = []; const MISSING = [];
const quiet = console.warn; console.warn = () => {};
for (const f of ORDER) {
  const file = path.join(ASSETS, f);
  if (!fs.existsSync(file)) { MISSING.push(f); continue; }
  try { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); LOADED.push(f); } catch (e) { ok(false, `load ${f}`, e.message); }
}
console.warn = quiet;
const W = global; const V = W.V7; const UI = W.V7UI; const DEC = W.V7DEC; const CARDS = W.V7_DECISIONS;
if (V && V.boot) { try { V.boot(); } catch (e) { ok(false, 'V7.boot()', e.message); } }
ok(Array.isArray(CARDS), 'window.V7_DECISIONS is an array');
ok(DEC && typeof DEC.prose === 'function', 'window.V7DEC is defined');
if (!Array.isArray(CARDS) || !DEC) return finish();

const PLANTS = new Set((V && V.plants ? V.plants() : []).map((p) => p.key));
const CODES = new Set((V && V.libTypes ? V.libTypes() : (W.CATALOGUE || [])).map((t) => t.code));

/* the other prototype's answers. In site/v7/2 the app loaded above is v7/2's, which no longer opens some of v7/1's issues
   (Vedanta's Emergency during the trial), so v7/1's links and screens are asked of v7/1's own app; in site/v7/1, v7/2's
   links and patterns are asked of v7/2's. Each is asked once, in a child process with its own globals. */
const READY = DEC.V72_READY === true;
const STRICT72 = READY || process.env.CTL_V72_ROUTES === '1';
const OTHER = { ids: new Map(), routes: new Map() };
function askOther(which, ids, hashes, full) {
  const todoI = ids.filter((q) => !OTHER.ids.has(which + APPS.idKey(q))); const todoH = hashes.filter((h) => !OTHER.routes.has(which + h));
  if (!todoI.length && !todoH.length) return;
  const r = APPS.probe(which, { full: !!full, ids: todoI, hashes: todoH });
  ok(r.loaded && !(r.errors || []).length, `v7/${which}'s app loads to answer for the ${which === '1' ? 'v7/1' : 'v7/2'} side of the cards`, (r.errors || []).join(' | '));
  todoI.forEach((q) => OTHER.ids.set(which + APPS.idKey(q), r.ids[APPS.idKey(q)] === true));
  todoH.forEach((h) => OTHER.routes.set(which + h, r.routes[h] || { pattern: null, problem: 'not answered' }));
}
function idQuery(pt) {
  const segs = pt.split('/').filter((x) => !/^:.*\?$/.test(x));
  if (segs.some((x) => x[0] === ':')) return null;
  const m = matchPattern('#/' + segs.join('/')); if (!m) return null;
  const kind = /eq\/:id/.test(m.pattern) ? 'eq' : /alert\/:id/.test(m.pattern) ? 'alert' : /issue\/:id/.test(m.pattern) ? 'issue' : '';
  return kind ? { kind, plant: m.params.plant, id: m.params.id } : null;
}
if (HERE === '2' && Array.isArray(CARDS)) {
  const qs = []; const hs = [];
  CARDS.forEach((d) => {
    (d.links || []).forEach((l) => { if (l && typeof l.href === 'string') { hs.push(l.href); const m = matchPattern(l.href); if (m) { const q = idQuery(String(l.href).replace(/^#\//, '').split('?')[0]); if (q) qs.push(q); } } });
    ((d.where && d.where['1']) || []).forEach((pt) => { if (typeof pt === 'string') { const q = idQuery(pt); if (q) qs.push(q); } });
  });
  askOther('1', qs, [...new Set(hs)], true);
}
function hasOn71(kind, plant, id, local) {
  if (HERE === '1') return local();
  const q = { kind, plant, id }; askOther('1', [q], [], true);
  return OTHER.ids.get('1' + APPS.idKey(q)) === true;
}
function idsResolve(hash, where) {
  const m = matchPattern(hash);
  if (!ok(!!m, `link is a v7/1 route: ${hash}`, where)) return;
  const p = m.params;
  if (p.plant != null && PLANTS.size) ok(PLANTS.has(p.plant), `plant "${p.plant}" exists`, `${where}: ${hash}`);
  if (/eq\/:id/.test(m.pattern) && V) ok(hasOn71('eq', p.plant, p.id, () => !!V.eq(p.plant, p.id)), `equipment ${p.plant}/${p.id} exists in v7/1`, `${where}: ${hash}`);
  if (/alert\/:id/.test(m.pattern) && V) ok(hasOn71('alert', p.plant, p.id, () => (V.alerts(p.plant, {}) || []).some((a) => a.id === p.id)), `alert ${p.plant}/${p.id} exists in v7/1`, `${where}: ${hash}`);
  if (/issue\/:id/.test(m.pattern) && V) ok(hasOn71('issue', p.plant, p.id, () => !!V.issue(p.plant, p.id)), `issue ${p.plant}/${p.id} exists in v7/1`, `${where}: ${hash}`);
  if (p.code != null && CODES.size) ok(CODES.has(p.code), `library type ${p.code} exists`, `${where}: ${hash}`);
  if (p.tab != null) ok(TABS.has(p.tab), `tab "${p.tab}" is Readings · Issues · Tasks · Details`, `${where}: ${hash}`);
  if (m.pattern === 'decisions/:id') ok(!!DEC.byId(p.id), `decision ${p.id} exists`, `${where}: ${hash}`);
  if (HERE === '1' && UI && UI.match) {
    const mm = UI.match(hash);
    if (mm) ok(mm.pattern === m.pattern || (m.pattern === 'p/:plant/eq/:id/phone' && /eq/.test(mm.pattern)), `the app routes ${hash} to ${m.pattern}`, `got ${mm.pattern}`);
    else note(`not routed yet (module missing?): ${hash}`);
  } else if (HERE === '2') {
    askOther('1', [], [hash], true); const r = OTHER.routes.get('1' + hash) || {};
    ok(!r.problem && (r.pattern === m.pattern || (m.pattern === 'p/:plant/eq/:id/phone' && /eq/.test(r.pattern || ''))), `v7/1 routes ${hash} to ${m.pattern} and lands on a real page`, `${r.pattern || 'no route'} ${r.problem || ''} · ${where}`);
  }
}
/* the v7/2 side: a link or a pattern is one of v7/2's routes, on objects v7/2 has (asked of v7/2's core when this
   folder is v7/1's); with v7/2 published (or CTL_V72_ROUTES=1) it must also be registered and land on a real page */
function problems72(hash) {
  const m = APPS.matchRoute(APPS.V72_ROUTES, hash); const o = APPS.objectsOf72(m);
  return { m, qs: o.qs, problem: m ? o.problem : 'is not a v7/2 route' };
}
function on72(qs) {
  if (HERE === '2') return qs.map((q) => [q, APPS.exists(V, '2', q)]);
  askOther('2', qs, [], false); return qs.map((q) => [q, OTHER.ids.get('2' + APPS.idKey(q)) === true]);
}
function route72(hash) {
  if (HERE === '2' && UI && UI.match) {
    const mm = UI.match(hash); let problem = '';
    if (!mm) problem = 'no route';
    else { try { if (APPS.NOTFOUND.test(smoke.visibleText(UI.renderPath(hash)).slice(0, 300))) problem = 'lands on a "not found" page'; } catch (e) { problem = 'throws ' + e.message; } }
    return { pattern: mm ? mm.pattern : null, problem };
  }
  askOther('2', [], [hash], true); return OTHER.routes.get('2' + hash) || { pattern: null, problem: 'not answered' };
}

/* ── 1. the cards ─────────────────────────────────────────────────────────────────────────────────────── */
const SEV = ['Decide before building further', 'Shapes v7', 'Small'];
const N = CARDS.length;
const idN = (id) => { const m = /^D(\d+)$/.exec(String(id)); return m ? +m[1] : 0; };
ok(N >= 21, 'the 21 cards from the first review, then any that arose later', `got ${N}`);
ok(CARDS.map((d) => d.id).join() === Array.from({ length: N }, (_, i) => 'D' + (i + 1)).join(), `ids D1…D${N} in order`);
const STR = ['id', 'title', 'severity', 'alexSays', 'v6Today', 'mihirsDirection', 'recommendation', 'v7Does', 'tellAlex'];
const PRON = /\b(he|him|his|she|her|hers|himself|herself)\b/i;
CARDS.forEach((d) => {
  STR.forEach((k) => ok(typeof d[k] === 'string' && d[k].trim().length > 0, `${d.id}.${k} is text`));
  ok(SEV.includes(d.severity), `${d.id} severity is one of the three`, d.severity);
  ok(/\?$/.test(d.title.trim()), `${d.id} title is a question`);
  ok(Array.isArray(d.options) && d.options.length >= 2 && d.options.every((o) => o.label && o.consequence), `${d.id} has at least two options with consequences`);
  ok(d.options.filter((o) => o.recommended).length === 1, `${d.id} marks exactly one option recommended`);
  ok(!('ids' in d) && !('evidence' in d), `${d.id} carries no "ids" or "evidence" field`, Object.keys(d).join());
  ok(Array.isArray(d.links) && d.links.length > 0, `${d.id} has links into the prototype`);
  STR.concat(['options', 'links']).forEach((k) => {
    const v = k === 'options' ? (d.options || []).map((o) => o.label + '\n' + o.consequence).join('\n') : k === 'links' ? (d.links || []).map((l) => l.label).join('\n') : d[k];
    noStrip(v, `${d.id}.${k}`);
  });
  const text = JSON.stringify(d);
  const pm = text.match(PRON); ok(!pm, `${d.id} uses they/them`, pm && text.slice(Math.max(0, pm.index - 50), pm.index + 20));
  (d.links || []).forEach((l) => { ok(typeof l.href === 'string' && l.href.startsWith('#/') && l.label, `${d.id} link has a label and an in-app href`, l.href); idsResolve(l.href, `${d.id} link "${l.label}"`); });
});
const sc = SEV.map((s) => CARDS.filter((d) => idN(d.id) <= 21 && d.severity === s).length);
ok(sc.join() === '3,16,2', 'first-review severity counts 3 · 16 · 2 (D1, D2 and D5 decide first)', sc.join());
/* D1–D21 are the first review's cards, pinned as Mihir reviewed them: the question, the severity and the recommended
   option. Merges add fields and later cards (D22…, each saying when it arose); they never change these. */
const SEVK = { F: 'Decide before building further', S: 'Shapes v7', M: 'Small' };
const FIRST_REVIEW = [
  ['D1', 'F', 0, "Add a treatment-step level above equipment now, or keep each tank as the home for its own readings, issues and tasks?"],
  ['D2', 'F', 2, "Should the plant home become Readiness (a stored Commissioning → Live state fed by one checklist) instead of the nine setup steps?"],
  ['D3', 'S', 1, "Should a real Emergency during Commissioning reach the plant's Leads, or nobody until Live?"],
  ['D4', 'S', 2, "Which plant should carry each part of v7's story, when the one real SCADA layout only has run status and level?"],
  ['D5', 'F', 0, "Where should trial-firing counts and the 'last 7 days' preview get their readings, and which engine counts them?"],
  ['D6', 'S', 1, "When a plant changes a library value, which reasons can it give, and where should a sensor fault or a library error go instead?"],
  ['D7', 'S', 2, "Should work written for a set of equipment (all the blowers, every basin) be one task, or one per equipment?"],
  ['D8', 'S', 3, "Should a new alert on a Live plant get its own trial, rather than sending the whole plant back to Commissioning?"],
  ['D9', 'M', 0, "Should v7 keep the word SCADA and send every correction back to SCADA, showing stored-vs-drawn type mismatches as gaps?"],
  ['D10', 'S', 1, "Should the phone Equipment Card be the equipment page in a phone layout, or its own view that shares the one editor?"],
  ['D11', 'S', 1, "When a library change reaches the plants, should the plants whose values change be told, and how?"],
  ['D12', 'S', 1, "Should hand-test readings get limits and a plant Readings list, so that a test result past its limit prompts a report?"],
  ['D13', 'S', 0, "Should the console only read people from the User Center, and drop the per-alert start-by and fix-by fields?"],
  ['D14', 'S', 2, "Which words go on screen where Alex's word list and v6's disagree?"],
  ['D15', 'S', 2, "Should an open issue lock its alert, or finish on the terms it opened under while changes apply at once?"],
  ['D16', 'S', 1, "Where should an issue sit, and how does it name the equipment that caused it?"],
  ['D17', 'S', 1, "What carries a library version, and can a plant stay on an older one?"],
  ['D18', 'S', 1, "Which limits should scale with equipment size, and should each value's source be worked out or stored?"],
  ['D19', 'S', 1, "How should a task's first due date be set at go-live, and what becomes due when the library changes a cadence?"],
  ['D20', 'S', 0, "Should sludge pumps get their own work now? If so, should it come from SCADA's pipes or from Alex's drawing editor?"],
  ['D21', 'M', 2, "What makes a trial alert \"noisy\": more than 10 firings a day, or short firings just past its limit?"],
];
FIRST_REVIEW.forEach(([id, sev, rec, title]) => {
  const d = CARDS.find((x) => x.id === id);
  if (!ok(!!d, `${id} is still there`)) return;
  ok(d.title === title, `${id}: the question is unchanged`, d.title);
  ok(d.severity === SEVK[sev], `${id}: the severity is unchanged`, d.severity);
  ok(DEC.recommendedIndex(d) === rec, `${id}: the recommended option is unchanged (option ${rec + 1})`, `got ${DEC.recommendedIndex(d)}`);
});
ok(CARDS.slice(21).every((d) => d.arose && d.arose !== 'First review'), 'every card after D21 says it arose later', CARDS.slice(21).map((d) => `${d.id}: ${d.arose}`).join(', '));
if (CARDS.some((d) => 'both' in d)) { const b = CARDS.filter((d) => idN(d.id) <= 21 && d.both === true).map((d) => d.id).join(); ok(b === 'D4,D5', 'among D1–D21, only D4 and D5 are built the same in both prototypes', b); }

/* ── 1b. the newer fields ──────────────────────────────────────────────────────────────────────────────────────
   All optional: a card without them renders as before. Each rule is checked wherever a card carries the field, so the
   card content can be merged in one go; bad fixtures (copies, never the live cards) prove each rule fires. */
const ARISE = ['First review', 'Reviewing v7/1', 'Designing v7/2', 'Building v7/2'];
const NEWTEXT = ['short', 'v71Short', 'v72Short', 'v72Does'];
const words = (t) => String(t).trim().split(/\s+/).filter(Boolean).length;
const pathOf = (h) => String(h == null ? '' : h).replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
/* a `where` pattern in the router's syntax: no "#/", no empty segment, ":x?" only as the last segment */
function patternProblem(pt) {
  if (typeof pt !== 'string' || !pt.trim()) return 'is not text';
  if (/^[#/]/.test(pt) || /\/$/.test(pt) || /\s/.test(pt)) return 'has "#", a leading or trailing "/" or a space';
  const segs = pt.split('/');
  if (segs.some((x) => !x)) return 'has an empty segment';
  if (segs.some((x, i) => /\?$/.test(x) && (x[0] !== ':' || i !== segs.length - 1))) return 'has an optional segment that is not the last parameter';
  if (segs.every((x) => x[0] === ':')) return 'matches every page of its length (no literal segment)';
  return '';
}
/* a v7/1 pattern points at a real screen: the sample path (parameters filled, an optional one left out) is a contract
   route, and its literal plant, type, equipment, alert and issue ids exist */
function screenProblem(pt) {
  const segs = pt.split('/').filter((x) => !/^:.*\?$/.test(x));
  const holes = segs.some((x) => x[0] === ':');
  const sample = segs.map((x) => (x[0] === ':' ? '\u0001' : x)).join('/');
  const m = matchPattern('#/' + sample);
  if (!m) return 'is not a v7/1 screen';
  const p = m.params; const lit = (v) => v != null && v !== '\u0001';
  if (lit(p.plant) && PLANTS.size && !PLANTS.has(p.plant)) return `names plant "${p.plant}", which does not exist`;
  if (lit(p.code) && CODES.size && !CODES.has(p.code)) return `names library type "${p.code}", which does not exist`;
  if (lit(p.tab) && !TABS.has(p.tab)) return `names tab "${p.tab}"`;
  if (!holes && V) {
    if (/eq\/:id/.test(m.pattern) && !hasOn71('eq', p.plant, p.id, () => !!V.eq(p.plant, p.id))) return `names equipment ${p.plant}/${p.id}, which does not exist`;
    if (/alert\/:id/.test(m.pattern) && !hasOn71('alert', p.plant, p.id, () => (V.alerts(p.plant, {}) || []).some((a) => a.id === p.id))) return `names alert ${p.plant}/${p.id}, which does not exist`;
    if (/issue\/:id/.test(m.pattern) && !hasOn71('issue', p.plant, p.id, () => !!V.issue(p.plant, p.id))) return `names issue ${p.plant}/${p.id}, which does not exist`;
  }
  if (m.pattern === 'decisions' || m.pattern === 'decisions/:id') return 'is a Decisions page (the strip never shows there)';
  return '';
}
/* every problem with the newer fields of one card; [] when it carries none or all are right */
function newFieldProblems(d) {
  const out = []; const bad = (k, why) => out.push(`${d.id}.${k} ${why}`);
  const nOpt = (d.options || []).length; const isIdx = (i) => Number.isInteger(i) && i >= 0 && i < nOpt;
  if ('short' in d) {
    if (typeof d.short !== 'string' || !d.short.trim()) bad('short', 'is not text');
    else {
      if (d.short.length > 48) bad('short', `is ${d.short.length} characters (48 at most)`);
      if (words(d.short) < 2 || words(d.short) > 6) bad('short', `is ${words(d.short)} words (2 to 6)`);
      if (/\?\s*$/.test(d.short)) bad('short', 'is a question (it names the card; the title asks)');
    }
  }
  if ('arose' in d && !ARISE.includes(d.arose)) bad('arose', `is "${d.arose}", not one of ${ARISE.join(' | ')}`);
  if (idN(d.id) <= 21 && 'arose' in d && d.arose !== 'First review') bad('arose', 'is not "First review" on a card from the first review');
  if (idN(d.id) > 21 && (!('arose' in d) || d.arose === 'First review')) bad('arose', 'must say when a newer card arose (Reviewing v7/1 or Designing v7/2)');
  ['v71Option', 'v72Option'].forEach((k) => { if (k in d && d[k] !== null && !isIdx(d[k])) bad(k, `is ${JSON.stringify(d[k])}, not an option index or null`); });
  ['v71Short', 'v72Short'].forEach((k) => {
    if (!(k in d)) return;
    if (typeof d[k] !== 'string' || !d[k].trim()) bad(k, 'is not text');
    else if (d[k].length > 140) bad(k, `is ${d[k].length} characters (140 at most)`);
  });
  if ('v72Does' in d && (typeof d.v72Does !== 'string' || !d.v72Does.trim())) bad('v72Does', 'is not text');
  if ('both' in d) {
    if (typeof d.both !== 'boolean') bad('both', 'is not true or false');
    else if (d.both && !(isIdx(d.v71Option) && d.v71Option === d.v72Option)) bad('both', 'is true but the two prototypes build different options');
  }
  const ls = Array.isArray(d.links) ? d.links : [];
  const paired = ls.some((l) => l && (l.href72 != null || l.label72 != null));
  if (paired) ls.forEach((l, i) => {
    if (typeof l.href72 !== 'string' || !/^#\//.test(l.href72)) bad(`links[${i}].href72`, 'is missing or not an in-app route ("#/…")');
    if (typeof l.label72 !== 'string' || !l.label72.trim()) bad(`links[${i}].label72`, 'is missing');
  });
  if ('where' in d) {
    const w = d.where;
    if (!w || typeof w !== 'object' || Array.isArray(w)) bad('where', 'is not {"1": [...], "2": [...]}');
    else {
      Object.keys(w).forEach((k) => { if (k !== '1' && k !== '2') bad('where', `has key "${k}" (only "1" and "2")`); });
      ['1', '2'].forEach((k) => {
        if (!(k in w)) return;
        if (!Array.isArray(w[k])) { bad(`where.${k}`, 'is not a list'); return; }
        w[k].forEach((pt) => { const pr = patternProblem(pt); if (pr) bad(`where.${k}`, `pattern "${pt}" ${pr}`); else if (k === '1') { const sp = screenProblem(pt); if (sp) bad('where.1', `pattern "${pt}" ${sp}`); } });
      });
      const covered = (k, h) => Array.isArray(w[k]) && w[k].some((pt) => typeof pt === 'string' && DEC.matchRoute(pt, pathOf(h)));
      ls.forEach((l, i) => {
        if (l && l.href && !covered('1', l.href)) bad(`links[${i}].href`, `"${l.href}" is not covered by where.1`);
        if (l && l.href72 && !covered('2', l.href72)) bad(`links[${i}].href72`, `"${l.href72}" is not covered by where.2`);
      });
    }
  }
  return out;
}
function readingProblems(rs) {
  if (rs == null) return [];
  if (!Array.isArray(rs)) return ['V7_READINGS is not a list'];
  const out = [];
  rs.forEach((r, i) => {
    const at = `reading ${r && r.n != null ? r.n : i + 1}`;
    if (!r || typeof r !== 'object') { out.push(`${at} is not an object`); return; }
    if (!(typeof r.n === 'number' || (typeof r.n === 'string' && r.n.trim()))) out.push(`${at}: n is missing`);
    ['title', 'drafts', 'reading', 'why'].forEach((k) => { if (typeof r[k] !== 'string' || !r[k].trim()) out.push(`${at}: ${k} is not text`); });
    if (r.card != null && !DEC.byId(String(r.card))) out.push(`${at}: card "${r.card}" does not exist`);
    if (typeof r.confirm !== 'boolean') out.push(`${at}: confirm is not true or false`);
    ['title', 'drafts', 'reading', 'why'].forEach((k) => { const h = stripHits(r[k]); if (h.length) out.push(`${at}.${k} names an internal reference: ${h[0]}`); });
    const pm = JSON.stringify(r).match(PRON); if (pm) out.push(`${at} does not use they/them ("${pm[0]}")`);
  });
  return out;
}
CARDS.forEach((d) => {
  const pr = newFieldProblems(d); ok(!pr.length, `${d.id}: the newer fields it carries are well formed`, pr.join(' | '));
  NEWTEXT.forEach((k) => { if (k in d) noStrip(d[k], `${d.id}.${k}`); });
  if (Array.isArray(d.links)) noStrip(d.links.map((l) => (l && l.label72) || '').join('\n'), `${d.id}.links (v7/2 labels)`);
});
{ const pr = readingProblems(W.V7_READINGS); ok(!pr.length, 'window.V7_READINGS, when present, is well formed', pr.join(' | ')); }

/* ── 1c. the v7/2 side of every card ─────────────────────────────────────────────────────────────────────────────
   Every href72 is a v7/2 route on objects v7/2 has; every where['2'] pattern's sample path is a v7/2 route, and its
   literal ids exist. With v7/2 published (or CTL_V72_ROUTES=1): each href72 lands on a real page in v7/2, each pattern's
   sample path is registered there, and each card's href72 screen carries that card's marker in v7/2. */
{
  const links72 = []; const pats72 = [];
  CARDS.forEach((d) => {
    (d.links || []).forEach((l, i) => { if (l && typeof l.href72 === 'string') links72.push([d, `links[${i}]`, l.href72]); });
    ((d.where && d.where['2']) || []).forEach((pt) => { if (typeof pt === 'string' && !patternProblem(pt)) pats72.push([d, pt]); });
  });
  const sampleOf = (pt) => '#/' + pt.split('/').filter((x) => !/^:.*\?$/.test(x)).map((x) => (x[0] === ':' ? '__any__' : x)).join('/');
  const items = links72.map(([d, k, h]) => [d, k, h, problems72(h)]).concat(pats72.map(([d, pt]) => [d, `where.2 "${pt}"`, sampleOf(pt), problems72(sampleOf(pt))]));
  const bad = items.filter((x) => x[3].problem).map(([d, k, h, p]) => `${d.id}.${k} ${h}: ${p.problem}`);
  ok(links72.length >= 50 && !bad.length, `every v7/2 link and pattern (${links72.length} links, ${pats72.length} patterns) is a route v7/2 registers`, bad.slice(0, 6).join(' | '));
  const qs = []; items.forEach(([, , , p]) => p.qs.forEach((q) => { if (q.id !== '__any__' && q.plant !== '__any__') qs.push(q); }));
  const missing = on72(qs).filter(([, has]) => !has).map(([q]) => `${q.kind} ${q.plant ? q.plant + '/' : ''}${q.id}`);
  ok(!missing.length, 'every object a v7/2 link or pattern names exists in v7/2', [...new Set(missing)].slice(0, 6).join(' | '));
  const owners = [...new Set(items.map(([, , , p]) => p.m && p.m.owner).filter(Boolean))];
  ok(owners.every((f) => /^(ui7|plant7|lists7|structure7|object7|lib7|ledger7|work7|decisions7)\.js$/.test(f)), 'every v7/2 route the cards use belongs to one of v7/2\'s screen files', owners.join(', '));
  if (STRICT72) {
    const lost = links72.map(([d, k, h]) => [d, k, h, route72(h)]).filter(([, , h, r]) => r.problem || r.pattern !== problems72(h).m.pattern).map(([d, k, h, r]) => `${d.id}.${k} ${h}: ${r.problem || `routed to ${r.pattern}`}`);
    ok(!lost.length, 'every v7/2 link lands on its page in v7/2', lost.slice(0, 6).join(' | '));
    const unreg = pats72.map(([d, pt]) => [d, pt, route72(sampleOf(pt))]).filter(([d, pt, r]) => r.pattern !== problems72(sampleOf(pt)).m.pattern).map(([d, pt, r]) => `${d.id} "${pt}": ${r.pattern || 'no route'}`);
    ok(!unreg.length, 'every v7/2 pattern is registered in v7/2', unreg.slice(0, 6).join(' | '));
    const pathOf72 = (h) => String(h).replace(/^#\/?/, '').split('?')[0].replace(/\/+$/, '');
    const unmarked = links72.filter(([d, , h]) => !DEC.markersFor('2', pathOf72(h)).some((x) => x.id === d.id)).map(([d, k, h]) => `${d.id}.${k} ${h}`);
    ok(!unmarked.length, 'every card\'s v7/2 link opens a screen whose strip names the card', unmarked.slice(0, 6).join(' | '));
  } else {
    note(`v7/2's side checked by route and object (${links72.length} links, ${pats72.length} patterns); set CTL_V72_ROUTES=1 to land on each page in v7/2`);
  }
}
/* a marker means "this screen shows the consequence": note any common v7/1 screen that would carry more than 3 */
{
  const screens = ['plants', 'library', 'differences', 'activity'];
  PLANTS.forEach((p) => ['', '/equipment', '/readings', '/issues', '/tasks', '/library', '/scada', '/differences', '/activity'].forEach((t) => screens.push(`p/${p}${t}`)));
  CODES.forEach((c) => screens.push(`library/${c}`));
  CARDS.forEach((d) => (d.links || []).forEach((l) => { if (l && l.href) screens.push(pathOf(l.href)); }));
  const crowded = [...new Set(screens)].map((p) => [p, DEC.markersFor('1', p).length]).filter(([, n]) => n > 3);
  if (crowded.length) note(`screens with more than 3 decision markers (the rest go under "+n more"): ${crowded.map(([p, n]) => `${p} (${n})`).join(', ')}`);
}
/* one screen, one strip (live cards): in v7/1 a tabbed page opens on its Readings tab, so the bare path and /readings
   are one screen; in v7/2 an alias (a v7/1 path v7/2 renders in place) is read as the page it renders */
{
  { const odd = [];
    CODES.forEach((c) => { if (DEC.markersFor('1', `library/${c}`).map((d) => d.id).join() !== DEC.markersFor('1', `library/${c}/readings`).map((d) => d.id).join()) odd.push(`library/${c}`); });
    PLANTS.forEach((k) => ((V && V.equipment ? V.equipment(k) : []) || []).forEach((e) => { const p = `p/${k}/eq/${e.id}`; if (DEC.markersFor('1', p).map((d) => d.id).join() !== DEC.markersFor('1', p + '/readings').map((d) => d.id).join()) odd.push(p); }));
    ok(!odd.length, 'v7/1: a type or equipment page carries the same strip on its bare path and on /readings (live cards)', odd.slice(0, 6).join(', ')); }
  const ALIAS = [['p/vedanta/alert/a_3f', 'p/vedanta/trigger/a_3f'], ['p/digitalpaani/library', 'p/digitalpaani/review/bindings'], ['p/digitalpaani/scada', 'p/digitalpaani/review/structure'],
    ['p/digitalpaani/equipment', 'p/digitalpaani/structure'], ['p/manesar/differences', 'p/manesar/deviations'], ['differences', 'deviations'], ['p/manesar/eq/bl1/card', 'p/manesar/eq/bl1/phone'],
    ['library/BLW', 'library/eq-types/BLW'], ['library/BLW/tasks', 'library/eq-types/BLW/tasks'], ['p/manesar/alert/a_do_at2', 'p/manesar/trigger/a_do_at2']];
  { const live = ALIAS.filter(([a, c]) => DEC.markersFor('2', a).map((d) => d.id).join() !== DEC.markersFor('2', c).map((d) => d.id).join());
    ok(!live.length, 'v7/2: every alias path carries the same strip as the page it renders (live cards)', live.map(([a]) => a).join(', ')); }
}
/* the rules fire: copies of a card with each field broken (the live cards are never touched) */
{
  const base = JSON.parse(JSON.stringify(DEC.byId('D15')));
  const good = Object.assign(JSON.parse(JSON.stringify(base)), {
    short: 'Freeze while an issue is open', arose: 'First review', v71Option: 2, v71Short: 'No freeze.', v72Option: 0, v72Short: 'Freeze.', v72Does: 'Freeze as drafted.', both: false,
    links: [{ label: 'Manesar issues', href: '#/p/manesar/issues', label72: 'The Trigger page', href72: '#/p/manesar/trigger/a_do_at2' }, { label: 'The alert', href: '#/p/manesar/alert/a_do_at2?f=1', label72: 'Deviations', href72: '#/p/manesar/deviations' }],
    where: { 1: ['p/manesar/issues', 'p/:plant/alert/:id', 'library/:code/:tab?'], 2: ['p/:plant/trigger/:id', 'p/:plant/deviations'] } });
  ok(!newFieldProblems(good).length, 'a well-formed card passes the newer-field rules', newFieldProblems(good).join(' | '));
  ok(!newFieldProblems(base).length, 'a card with none of the newer fields passes (they are optional)');
  const fires = (what, patch, re) => {
    const c = Object.assign(JSON.parse(JSON.stringify(good)), typeof patch === 'function' ? patch(JSON.parse(JSON.stringify(good))) : patch);
    const pr = newFieldProblems(c); ok(pr.some((x) => re.test(x)), `the rules catch ${what}`, pr.join(' | ') || 'no problem found');
  };
  fires('a short name over 48 characters', { short: 'A name that runs on well past the forty-eight characters allowed' }, /short is \d+ characters/);
  fires('a one-word short name', { short: 'Freeze' }, /short is 1 words/);
  fires('an unknown "arose"', { arose: 'Later' }, /arose is "Later"/);
  fires('a newer card that does not say when it arose', { id: 'D22', arose: 'First review' }, /must say when a newer card arose/);
  fires('an option index out of range', { v72Option: 7 }, /v72Option is 7/);
  fires('a summary over 140 characters', { v71Short: 'x'.repeat(141) }, /v71Short is 141 characters/);
  fires('"both" on different options', { both: true }, /both is true but/);
  fires('a v7/2 link with no label', (c) => ({ links: c.links.map((l, i) => (i ? l : Object.assign(l, { label72: '' }))) }), /links\[0\]\.label72 is missing/);
  fires('a link route no pattern covers', { where: { 1: ['p/manesar/issues'], 2: ['p/:plant/trigger/:id', 'p/:plant/deviations'] } }, /links\[1\]\.href "#\/p\/manesar\/alert\/a_do_at2\?f=1" is not covered by where\.1/);
  fires('a v7/2 link route no pattern covers', { where: { 1: good.where[1], 2: ['p/:plant/trigger/:id'] } }, /href72 "#\/p\/manesar\/deviations" is not covered by where\.2/);
  fires('a pattern written as a link', { where: { 1: ['#/p/manesar/issues'].concat(good.where[1]), 2: good.where[2] } }, /pattern "#\/p\/manesar\/issues" has "#"/);
  fires('a pattern with no literal segment', { where: { 1: [':x'].concat(good.where[1]), 2: good.where[2] } }, /no literal segment/);
  fires('a pattern on a plant that does not exist', { where: { 1: ['p/nowhere/issues'].concat(good.where[1]), 2: good.where[2] } }, /plant "nowhere"/);
  fires('a pattern on a screen v7/1 does not have', { where: { 1: ['p/:plant/trigger/:id'].concat(good.where[1]), 2: good.where[2] } }, /is not a v7\/1 screen/);
  fires('a pattern on a Decisions page', { where: { 1: ['decisions/:id'].concat(good.where[1]), 2: good.where[2] } }, /Decisions page/);
  fires('a where key other than 1 and 2', { where: Object.assign({ 3: [] }, good.where) }, /has key "3"/);
  const pron = String.fromCharCode(104, 101);              // built at run time, so this public file never uses the word itself
  const rp = readingProblems([{ n: 1, title: 'T', drafts: 'D', reading: 'R', why: 'W', card: 'D99', confirm: 'yes' }, { title: '', drafts: `The drafts say ${pron} would`, reading: 'R', why: 'W', card: null, confirm: false }]);
  ok(rp.some((x) => /card "D99" does not exist/.test(x)) && rp.some((x) => /confirm is not true or false/.test(x)) && rp.some((x) => /title is not text/.test(x)) && rp.some((x) => /n is missing/.test(x)) && rp.some((x) => /they\/them/.test(x)), 'the reading rules fire', rp.join(' | '));
  ok(!readingProblems([{ n: 1, title: 'T', drafts: 'D', reading: 'R', why: 'W', card: 'D15', confirm: true }]).length && !readingProblems(undefined).length, 'a well-formed reading, or none, passes');
}

/* ── 2. standalone load (index.html loads only this file) ─────────────────────────────────────────────── */
(() => {
  const store = new Map();
  const ctx = { console, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) } };
  ctx.window = ctx; ctx.globalThis = ctx;
  try {
    vm.runInNewContext(fs.readFileSync(path.join(ASSETS, 'decisions7.js'), 'utf8'), ctx, { filename: 'decisions7.js (standalone)' });
    ok(Array.isArray(ctx.V7_DECISIONS) && ctx.V7_DECISIONS.length === N, `standalone: all ${N} cards`);
    ok(ctx.V7DEC && typeof ctx.V7DEC.prose === 'function' && typeof ctx.V7DEC.answersText === 'function', 'standalone: V7DEC helpers');
    ok(ctx.V7DEC.render.list() === '', 'standalone: no app views registered');
    const r = ctx.V7DEC.setAnswer('D1', { opt: 0 }); ok(r.ok && store.has('ctl7.decisions'), 'standalone: a call is saved under ctl7.decisions');
  } catch (e) { ok(false, 'standalone load does not throw', e.message); }
  const ctx2 = { console }; ctx2.window = ctx2;             // storage that throws
  ctx2.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  try {
    vm.runInNewContext(fs.readFileSync(path.join(ASSETS, 'decisions7.js'), 'utf8'), ctx2);
    ok(ctx2.V7DEC.setAnswer('D2', { opt: 2 }).ok && ctx2.V7DEC.answerOf('D2').opt === 2, 'storage blocked: calls still work for the visit');
  } catch (e) { ok(false, 'blocked storage does not throw', e.message); }
})();

/* ── 3. the app's views ───────────────────────────────────────────────────────────────────────────────── */
const CORPUS = CARDS.map((d) => [d.title, d.short, d.alexSays, d.v6Today, d.mihirsDirection, d.recommendation, d.v7Does, d.tellAlex, d.v71Short, d.v72Short, d.v72Does]
  .concat(d.options.map((o) => o.label + ' ' + o.consequence), d.links.map((l) => l.label + '\n' + (l.label72 || ''))).join('\n')).join('\n').replace(/\s+/g, ' ');
function isCardText(text, i, len) {
  for (const w of [48, 32, 20, 12]) {
    const a = text.slice(Math.max(0, i - w), i + len).trim(); const b = text.slice(i, i + len + w).trim();
    if ((a.length > len + 3 && CORPUS.includes(a)) || (b.length > len + 3 && CORPUS.includes(b))) return true;
  }
  return false;
}
/* the cards' own text, quoted on the Decisions pages and in the strip: a banned word there is data, not the page's words.
   The corpus is read when the page is checked, so fixture text counts too; given as separate strings (where this folder's
   smoke.js supports it), one whole card string that covers the word on the page is enough. */
function decData(src) {
  const D0 = src || W; const names = ['V7_DECISIONS', 'V7_READINGS']; const pick = { V7_DECISIONS: D0.V7_DECISIONS, V7_READINGS: D0.V7_READINGS };
  const list = smoke.corpusOf(pick, names, true);
  const test = smoke.isDataIn(smoke.corpusOf(pick, names), Array.isArray(list) ? list : null);
  return (text, i, len) => isCardText(text, i, len) || test(text, i, len);
}
function checkPage(html, where) {
  if (!ok(typeof html === 'string' && html.length > 0, `${where} renders an html string`)) return;
  noStrip(smoke.decode(html), `${where} (text and attributes)`);
  ok(!/class="dec-ids"|class="dec-ev"|>Evidence</.test(html), `${where} shows no ID chips and no Evidence fold`);
  for (const f of smoke.scan(html, { ids: false, isData: decData() })) {
    if (f.kind === 'data-word') continue;                 // a banned word inside a card's quoted text: allowed on this page
    ok(false, `${where}: "${f.word}" in the page's own words`, f.ctx);
  }
  for (const href of smoke.links(html)) {
    if (!href.startsWith('#/')) { ok(href === '#' ? false : true, `${where}: link ${href}`); continue; }
    ok(HERE === '1' ? !!matchPattern(href) : !problems72(href).problem, `${where}: link ${href} is a v7/${HERE} route`);
  }
}
if (UI) {
  const routes = UI.routes().map((r) => r.pattern);
  ok(routes.includes('decisions') && routes.includes('decisions/:id'), 'routes decisions and decisions/:id are registered', routes.filter((r) => /dec/.test(r)).join());
  const m1 = UI.match('#/decisions/D3'); ok(m1 && m1.pattern === 'decisions/:id', '#/decisions/D3 routes to the card page');
  ['', '?show=open', '?show=answered', '?show=differs', '?show=nonsense'].forEach((q) => { let h; try { h = UI.renderPath('#/decisions' + q); } catch (e) { ok(false, `#/decisions${q} throws`, e.message); } checkPage(h, '#/decisions' + q); });
  CARDS.forEach((d) => { let h; try { h = UI.renderPath('#/decisions/' + d.id); } catch (e) { ok(false, `#/decisions/${d.id} throws`, e.message); } checkPage(h, '#/decisions/' + d.id); ok(h && h.includes(DEC.esc(d.title)), `#/decisions/${d.id} shows its question`); });
  const none = UI.renderPath('#/decisions/D99'); ok(/No such decision/.test(none), '#/decisions/D99 says there is no such decision');
  const list = UI.renderPath('#/decisions');
  ok((list.match(/<details class="dec" /g) || []).length === N, `the list shows all ${N} cards, collapsible`);
  const lv = smoke.visibleText(list); const sn = SEV.map((s) => CARDS.filter((d) => d.severity === s).length);
  ok(SEV.every((s, i) => !sn[i] || lv.includes(`${s} · ${sn[i]}`)), 'the list is grouped by severity with counts', sn.join(','));
  ok((list.match(/>Recommended</g) || []).length === N, 'each card marks its recommended option');
  ok(/data-act="dec:copy"/.test(list), 'the list has Copy my answers');
  ['dec:pick', 'dec:note', 'dec:clear', 'dec:copy', 'dec:copyalex', 'dec:copyone', 'dec:openall', 'dec:closeall'].forEach((a) => ok(!!(UI._handlers && UI._handlers[a]), `handler ${a} is registered`));
  if (UI.chapters) { try { UI.chapters().forEach((c) => c.decisions.forEach((x) => ok(!!DEC.byId(x.id) && !!UI.match(x.href), `story chapter ${c.n} links ${x.id}`))); } catch (e) { ok(false, 'story chapters', e.message); } }
} else note('ui7.js not loaded: app views not checked');

/* ── 4. your call ─────────────────────────────────────────────────────────────────────────────────────── */
(() => {
  ['D1', 'D2', 'D3', 'D21'].forEach((id) => DEC.clearAnswer(id));
  ok(DEC.answersText() === '' || !/D3 —/.test(DEC.answersText()), 'nothing to copy for cleared cards');
  DEC.setAnswer('D3', { opt: '1' });
  ok(DEC.answerOf('D3') && DEC.answerOf('D3').opt === 1, 'a picked option is stored as a number');
  ok(!DEC.differs(DEC.byId('D3')), 'D3 option 2 is the recommended one, so it does not differ');
  DEC.setAnswer('D3', { note: 'with a toast for the commissioning admin' });
  DEC.setAnswer('D21', { opt: 'other', note: 'try 5 a day' });
  ok(DEC.differs(DEC.byId('D21')), '"Something else" differs from the recommendation');
  DEC.setAnswer('D2', { note: 'ask Alex first' });
  ok(!DEC.answerOf('D2') && DEC.noteOf('D2') === 'ask Alex first', 'a note without a call is kept');
  const t = DEC.answersText();
  ok(t.includes(`D3 — ${DEC.byId('D3').title}: ${DEC.byId('D3').options[1].label} (with a toast for the commissioning admin)`), 'copied line: "D3 — <title>: <chosen option> (note)"', t.split('\n')[2]);
  ok(t.includes(`D21 — ${DEC.byId('D21').title}: Something else (try 5 a day)`), 'copied line for Something else');
  ok(t.includes(`D2 — ${DEC.byId('D2').title}: no call yet (ask Alex first)`), 'copied line for a note without a call');
  ok(/Not answered yet: D1, D4/.test(t), 'copied text lists what is not answered yet');
  let raw = null; try { raw = JSON.parse(W.localStorage.getItem('ctl7.decisions')); } catch (e) { /* ignore */ }
  ok(raw && raw.v === 1 && raw.answers.D3 && raw.answers.D3.opt === 1, 'calls persist in browser storage ctl7.decisions');
  ok(DEC.setAnswer('D3', { opt: 99 }).ok && DEC.answerOf('D3') === null && DEC.noteOf('D3'), 'an option that does not exist is not kept as a call');
  ok(/Notes for Alex/.test(DEC.alexText()) && DEC.alexText().includes(DEC.byId('D21').tellAlex), 'the notes for Alex include every card');
  noStrip(DEC.alexText(), 'the copied notes for Alex');
  noStrip(t, 'the copied answers');
  if (UI) {
    const h = UI.renderPath('#/decisions?show=differs'); ok(/dec-D21/.test(h) && !/id="dec-D3"/.test(h), 'filter "Differs from the recommendation" shows D21 and not D3');
    const c = UI.renderPath('#/decisions/D21'); ok(/id="dec-D21-ox"[^>]*checked/.test(c), 'the card page shows the saved call checked');
  }
  ['D1', 'D2', 'D3', 'D21'].forEach((id) => DEC.clearAnswer(id));
  ok(!DEC.answerOf('D21') && !DEC.noteOf('D2'), 'Clear my call removes the call and the note');
})();

/* ── 5. index.html: this folder's hand-off doc ─────────────────────────────────────────────────────────────────── */
(() => {
  const file = path.join(ROOT, 'index.html');
  if (!ok(fs.existsSync(file), 'index.html exists')) return;
  const html = fs.readFileSync(file, 'utf8');
  const srcs = [...html.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  ok(srcs.length === 1 && /^assets\/decisions7\.js(\?v=\d+)?$/.test(srcs[0]), 'index.html loads only assets/decisions7.js', srcs.join(', '));
  ok(/fonts\.googleapis\.com\/css2\?family=Figtree[^"]*IBM\+Plex\+Mono/.test(html), 'Figtree and IBM Plex Mono from Google Fonts');
  const SECTIONS = HERE === '1' ? ['what', 'walk', 'adopts', 'differs', 'words', 'decisions', 'simulated', 'ac', 'run', 'open'] : ['what', 'model', 'walk', 'decisions', 'silent', 'comparison', 'words', 'simulated', 'ac', 'run'];
  SECTIONS.forEach((id) => ok(html.includes(`id="${id}"`), `section #${id}`));
  if (HERE === '2') {
    const h2 = [...html.matchAll(/<h2 id="([a-z-]+)"><span class="n">(\d+)<\/span>/g)].map((m) => m[1]);
    ok(h2.join() === SECTIONS.join(), 'v7/2\'s hand-off has its ten sections in order', h2.join(', '));
  }
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  ok(inline.length === 1, 'one inline renderer');
  // run the renderer against the standalone file in a fresh context with a tiny DOM
  const els = {}; const get = (id) => (els[id] = els[id] || { id, innerHTML: '', scrollIntoView() {} });
  const ctx = { console, location: { hash: '' }, localStorage: { getItem: () => null, setItem() {} }, document: { getElementById: (id) => (/^dec-|^D\d+$|^read-/.test(id) ? get(id) : null) } };
  ctx.window = ctx;
  try {
    vm.runInNewContext(fs.readFileSync(path.join(ASSETS, 'decisions7.js'), 'utf8'), ctx);
    vm.runInNewContext(inline[0], ctx, { filename: 'index.html inline renderer' });
  } catch (e) { ok(false, 'the inline renderer runs', e.message); return; }
  const SLOTS = HERE === '1' ? ['dec-contract', 'dec-table', 'dec-list', 'dec-ids'] : ['dec-readings', 'dec-table', 'dec-list'];
  const out = SLOTS.map((id) => (els[id] || {}).innerHTML || '');
  ok(out.slice(0, 3).every((x) => x.length > 100), `the renderer fills its slots (${SLOTS.slice(0, 3).join(', ')})`);
  ok((out[2].match(/<section class="dd-card" id="D\d+"/g) || []).length === N, `the doc shows all ${N} cards, each anchored #Dn (V7DEC.renderDoc)`);
  ok((out[1].match(/<tr><td data-label="Card">/g) || []).length === N, `the doc's at-a-glance table has ${N} rows`);
  const cols = out[2].split(`class="dk-col dk-col-${HERE}"`).slice(1);
  ok(cols.length === N && cols.every((c) => c.split(/class="dk-col dk-col-\d"/)[0].includes('>You are here<')) && /class="dd-picks"/.test(out[2]), `the doc's cards mark v7/${HERE} "You are here" and carry the your-call chips`);
  ok(new RegExp(`window\\.V7_PAGE = 'doc'; window\\.V7_VARIANT = '${HERE}';`).test(inline[0]), `the doc says it is v7/${HERE}'s hand-off doc (V7_PAGE, V7_VARIANT)`);
  if (HERE === '1') {
    ok(/This is v7\/1, the recommended approach\./.test(html) && /<a href="\.\.\/index\.html">Both approaches<\/a>/.test(html) && /<a href="\.\.\/challenges\.html">Challenges doc<\/a>/.test(html), 'the top block names v7/1 and links both approaches and the challenges doc');
    if (!READY) ok(!/href="(\.\.\/)?2\//.test(html + out.join('')), 'no link into v7/2 while it is in build');
    else ok(/href="\.\.\/2\/prototype\.html#\//.test(out.join('')), 'v7/2 is published: the cards link into it');
    ok((out[0].match(/<tr><td><a class="dref"/g) || []).length >= 10, 'the doc lists the contract changes the cards ask for', `${(out[0].match(/<tr><td>/g) || []).length} rows`);
    ok(out[3] === '' && !/id="(dec-ids|ids)"/.test(html), 'the doc has no table of Alex\'s IDs');
  } else {
    ok(/This is v7\/2, Alex's model as drafted\./.test(html) && /<a href="\.\.\/index\.html">Both approaches<\/a>/.test(html) && /<a href="\.\.\/challenges\.html">Challenges doc<\/a>/.test(html) && /<a href="\.\.\/1\/index\.html">Read v7\/1<\/a>/.test(html), 'the top block names v7/2 and links both approaches, the challenges doc and v7/1');
    ok(/id="readings"/.test(out[0]) && (W.V7_READINGS || []).every((r) => out[0].includes(`id="reading-${r.n}"`)), 'section 5 lists every reading the file holds, each anchored');
    ok(/href="\.\.\/1\/prototype\.html#\/[^"]*" target="v7-1"/.test(out[2]), 'the cards link v7/1 in its own window');
  }
  ok(/href="\.\.\/challenges\.html">Read every challenge in the challenges doc/.test(html), 'the decisions section links the challenges doc');
  out.forEach((x, i) => noStrip(smoke.decode(x), `index.html renderer slot ${SLOTS[i]}`));
  // the doc's own prose too (the workbook's lab weights "W1/W2" are quoted data, not a wireframe ID)
  noStrip(smoke.decode(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')).replace(/the lab weights W1\/W2/g, 'the lab weights'), 'index.html\'s own text');
  const all = html.replace(/<script[\s\S]*?<\/script>/gi, '') + out.join('');
  const own = [...new Set([...all.matchAll(/href="prototype\.html(#[^"]*)"/g)].map((m) => smoke.decode(m[1])))];
  ok(own.length > 30, 'the doc links into its own prototype', `${own.length} distinct links`);
  if (HERE === '1') own.forEach((h) => idsResolve(h, 'index.html'));
  else {
    const st = own.map((h) => [h, problems72(h)]);
    const bad = st.filter(([, p]) => p.problem).map(([h, p]) => `${h}: ${p.problem}`);
    ok(!bad.length, 'every link into v7/2 is one of v7/2\'s routes', bad.slice(0, 6).join(' | '));
    const qs = []; st.forEach(([, p]) => p.qs.forEach((q) => qs.push(q)));
    const missing = on72(qs).filter(([, has]) => !has).map(([q]) => `${q.kind} ${q.id}`);
    ok(!missing.length, 'every object the doc links in v7/2 exists', [...new Set(missing)].slice(0, 6).join(' | '));
    if (STRICT72) { const lost = own.map((h) => [h, route72(h)]).filter(([, r]) => r.problem).map(([h, r]) => `${h}: ${r.problem}`); ok(!lost.length, 'every link into v7/2 lands on a real v7/2 page', lost.slice(0, 6).join(' | ')); }
    const to1 = [...new Set([...all.matchAll(/href="\.\.\/1\/prototype\.html(#[^"]*)"/g)].map((m) => smoke.decode(m[1])))];
    ok(to1.length >= 20, 'the doc links into v7/1', `${to1.length} distinct links`);
    to1.forEach((h) => idsResolve(h, 'index.html (into v7/1)'));
  }
  const anchors = new Set([...all.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  [...new Set([...all.matchAll(/href="#([^"/][^"]*)"/g)].map((m) => m[1]))].forEach((a) => ok(anchors.has(a), `in-page anchor #${a} exists`));
  const P = HERE === '1' ? 'V7' : 'V72';
  const ac = [...html.matchAll(new RegExp(`<td>${P}-(\\d+)</td>`, 'g'))].map((m) => +m[1]);
  ok(ac.length >= 40 && ac.every((n, i) => n === i + 1), `acceptance criteria ${P}-1… are sequential`, `${ac.length}: ${ac.slice(-3).join(',')}`);
  const acSec = html.slice(html.indexOf('id="ac"'), html.indexOf('id="run"'));
  const chs = [...acSec.matchAll(/<h3>(\d+) · /g)].map((m) => +m[1]);
  ok(chs.join() === '1,2,3,4,5,6,7,8,9,10,11,12', 'acceptance criteria are grouped by the 12 chapters', chs.join());
  if (HERE === '2') ok(ac.length === 148 && /<h3>Across the app<\/h3>/.test(acSec) && acSec.indexOf('<h3>Across the app</h3>') > acSec.indexOf('<h3>12 · '), 'then "Across the app", up to V72-148');
  const vis = smoke.visibleText(html.replace(/<script[\s\S]*?<\/script>/gi, ''));
  const pm = vis.match(PRON); ok(!pm, 'the doc uses they/them', pm && vis.slice(Math.max(0, pm.index - 60), pm.index + 20));
  for (const j of [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/]) ok(!j.test(out.join('')), `the rendered doc has no "${j.source}"`);
})();

/* ── 6. the two prototypes, the decisions strip and the document view ──────────────────────────────────────
   Temporary fixture fields on a few cards (restored at the end); the live cards are never written. */
(() => {
  const T = smoke.visibleText;
  const touched = new Map();
  const fx = (id, fields) => { const d = DEC.byId(id); if (!touched.has(id)) touched.set(id, JSON.parse(JSON.stringify(d))); Object.assign(d, fields); return d; };
  const restore = () => touched.forEach((orig, id) => { const d = DEC.byId(id); Object.keys(d).forEach((k) => { delete d[k]; }); Object.assign(d, orig); });
  const flags = { v: W.V7_VARIANT, p: W.V7_PAGE, r: DEC.V72_READY };
  const setFlags = (v, p) => { W.V7_VARIANT = v; W.V7_PAGE = p; };
  const FX = ['D3', 'D4', 'D5', 'D9', 'D15', 'D21', 'D1'];
  const HAD_WHERE = new Set(CARDS.filter((d) => 'where' in d).map((d) => d.id));
  const NEWER = ['short', 'arose', 'v71Option', 'v71Short', 'v72Option', 'v72Short', 'v72Does', 'both', 'where'];
  try {
    /* a clean baseline: once the cards carry the newer fields, they are set aside here (restored at the end), so the
       expectations below test the mechanism, not the content */
    CARDS.forEach((d) => {
      if (!NEWER.some((k) => k in d) && !(d.links || []).some((l) => l && (l.href72 != null || l.label72 != null))) return;
      fx(d.id, {}); NEWER.forEach((k) => { delete d[k]; });
      d.links = (d.links || []).map((l) => { const c = Object.assign({}, l); delete c.label72; delete c.href72; return c; });
    });
    /* the API */
    ['variant', 'page', 'hrefFor', 'targetFor', 'challengesHref', 'docHref', 'linksFor', 'markersFor', 'markerHtml', 'renderDoc', 'docHtml', 'twoHtml', 'matchRoute', 'v71Index', 'v72Index', 'hasPair', 'shortOf', 'aroseOf', 'builds', 'onExternalChange']
      .forEach((f) => ok(typeof DEC[f] === 'function', `V7DEC.${f} is a function`));
    { const d2 = path.resolve(ROOT, '..', '2'); const pub = fs.existsSync(path.join(d2, 'prototype.html')) && fs.existsSync(path.join(d2, 'index.html')) && /window\.V7_VARIANT = '2';/.test(fs.readFileSync(path.join(d2, 'index.html'), 'utf8'));
      ok(typeof DEC.V72_READY === 'boolean' && (DEC.V72_READY === false || pub), 'V72_READY is false until v7/2 is published, and true only once its prototype and hand-off exist', `V72_READY ${DEC.V72_READY}`); }
    ok(DEC.PUBLIC === true, 'PUBLIC: no card carries ids');
    ok(CARDS.every((d) => !DEC.hasPair(d) || (DEC.v71Index(d) === null || Number.isInteger(DEC.v71Index(d)))), 'v71Index is an index or null on every card');

    /* readers */
    setFlags(undefined, undefined); ok(DEC.variant() === '1' && DEC.page() === 'app', 'defaults: variant 1, page app');
    setFlags('2', 'doc'); ok(DEC.variant() === '2' && DEC.page() === 'doc', 'reads V7_VARIANT and V7_PAGE');
    setFlags('x', 'nonsense'); ok(DEC.variant() === '1' && DEC.page() === 'app', 'unknown values fall back to 1 and app');

    /* where a link goes from each kind of page */
    const R = '#/p/manesar/issues';
    const table = [
      ['1', 'app', R, '../2/prototype.html' + R, null, 'v7-2', '../challenges.html#D15', 'index.html#D3', '../2/index.html#D3'],
      ['2', 'app', '../1/prototype.html' + R, R, 'v7-1', null, '../challenges.html#D15', '../1/index.html#D3', 'index.html#D3'],
      ['1', 'doc', 'prototype.html' + R, '../2/prototype.html' + R, null, 'v7-2', '../challenges.html#D15', '#D3', '../2/index.html#D3'],
      ['1', 'overview', '1/prototype.html' + R, '2/prototype.html' + R, 'v7-1', 'v7-2', 'challenges.html#D15', '1/index.html#D3', '2/index.html#D3'],
      ['1', 'challenges', '1/prototype.html' + R, '2/prototype.html' + R, 'v7-1', 'v7-2', 'challenges.html#D15', '1/index.html#D3', '2/index.html#D3'],
    ];
    table.forEach(([v, p, h1, h2, t1, t2, ch, d1, d2]) => {
      setFlags(v, p);
      const got = [DEC.hrefFor('1', R), DEC.hrefFor('2', R), DEC.targetFor('1'), DEC.targetFor('2'), DEC.challengesHref('D15'), DEC.docHref('1', 'D3'), DEC.docHref('2', 'D3')];
      ok(JSON.stringify(got) === JSON.stringify([h1, h2, t1, t2, ch, d1, d2]), `links from a ${p} page of v7/${v}`, JSON.stringify(got));
    });
    setFlags('1', 'app');
    ok(DEC.hrefFor('1', 'p/manesar') === '#/p/manesar' && DEC.hrefFor(1, '/p/manesar') === '#/p/manesar', 'hrefFor accepts a route without "#/"');
    ok(DEC.challengesHref() === '../challenges.html', 'challengesHref() without an id is the doc itself');

    /* route patterns: the router's rules */
    const M = DEC.matchRoute;
    ok(M('p/:plant/alert/:id', 'p/manesar/alert/a_do_at2') && M('p/:plant/alert/:id', '#/p/manesar/alert/a_do_at2?f=1'), 'a pattern matches a path, with or without "#/" and a query');
    ok(!M('p/:plant/alert/:id', 'p/manesar/alert') && !M('p/:plant/alert/:id', 'p/manesar/alert/a/b'), 'a pattern needs exactly its segments');
    ok(M('library/:code/:tab?', 'library/BLW') && M('library/:code/:tab?', 'library/BLW/tasks') && !M('library/:code/:tab?', 'library'), 'a trailing optional segment');
    ok(!M('p/manesar/alert/a_do_at2', 'p/vedanta/alert/a_do_at2') && !M('p/vedanta', 'p/vedanta/issues') && M('p/vedanta', 'p/vedanta'), 'literal segments match exactly');
    /* v7/2 renders v7/1's paths in place under their old names: each is read as the page it renders */
    const CP = DEC.canonicalPath;
    const ALIAS = [['p/vedanta/alert/a_3f', 'p/vedanta/trigger/a_3f'], ['p/digitalpaani/library', 'p/digitalpaani/review/bindings'], ['p/digitalpaani/scada', 'p/digitalpaani/review/structure'],
      ['p/digitalpaani/equipment', 'p/digitalpaani/structure'], ['p/manesar/differences', 'p/manesar/deviations'], ['differences', 'deviations'], ['p/manesar/eq/bl1/card', 'p/manesar/eq/bl1/phone'],
      ['library/BLW', 'library/eq-types/BLW'], ['library/BLW/tasks', 'library/eq-types/BLW/tasks']];
    ok(ALIAS.every(([a, c]) => CP('2', a) === c && CP('2', '#/' + a + '?x=1') === c), 'canonicalPath: each v7/2 alias names the page it renders', ALIAS.filter(([a, c]) => CP('2', a) !== c).map(([a]) => a + ' → ' + CP('2', a)).join(', '));
    ok(['library/templates/tpl_x', 'library/eq-types/BLW', 'library/up-types/mbbr/tasks', 'p/manesar/trigger/a_do_at2', 'p/manesar/review'].every((p) => CP('2', p) === p) && CP('1', 'p/vedanta/alert/a_3f') === 'p/vedanta/alert/a_3f', 'canonicalPath: the library\'s own sections, v7/2\'s own pages and every v7/1 path stay as they are');


    /* fixtures */
    const d15 = fx('D15', { short: 'Freeze while an issue is open', arose: 'Designing v7/2', v71Option: 2, v71Short: 'Open issues keep the terms they opened under.', v72Option: 0, v72Short: 'The limits are frozen while an issue is open.', v72Does: 'A second prototype paragraph.\n\n- one\n- two', both: false,
      links: DEC.byId('D15').links.map((l) => Object.assign({}, l, { label72: l.label + ' in the second prototype', href72: l.href })),
      where: { 1: ['p/manesar/alert/a_do_at2', 'p/manesar/issues'], 2: ['p/:plant/trigger/:id'] } });
    fx('D3', { where: { 1: ['p/:plant/alert/:id'] } });
    fx('D5', { where: { 1: ['p/:plant/alert/:id'] }, both: true, v71Option: 0, v72Option: 0, v71Short: 'Sample readings drive the trial in both.' });
    fx('D4', { both: true, v71Option: 2, v72Option: 2 });
    fx('D9', { where: { 1: ['p/:plant/alert/:id'] } });
    fx('D21', { where: { 1: ['p/manesar/alert/:id'] } });
    FX.forEach((id) => DEC.clearAnswer(id));

    const ids = (v, p) => DEC.markersFor(v, p).map((d) => d.id).join(',');
    ok(ids('1', '#/p/manesar/alert/a_do_at2?f=zone') === 'D5,D3,D15,D9,D21', 'markersFor: every matching card, by severity then id', ids('1', 'p/manesar/alert/a_do_at2'));
    ok(ids('1', 'p/vedanta/alert/x') === 'D5,D3,D9', 'markersFor: a literal pattern stays on its own plant', ids('1', 'p/vedanta/alert/x'));
    ok(ids('1', 'p/manesar/alert') === '' && ids('1', 'p/nowhere/at/all') === '', 'markersFor: nothing where nothing matches');
    ok(ids('2', 'p/manesar/issues') === '' && ids('1', 'p/manesar/issues') === 'D15' && ids('2', 'p/manesar/trigger/a_do_at2') === 'D15' && ids('1', 'p/manesar/trigger/a_do_at2') === '', 'markersFor: each prototype has its own patterns');
    ok(ids('2', 'p/manesar/alert/a_do_at2') === 'D15', 'markersFor: in v7/2 an alias (a v7/1 path v7/2 renders in place) carries the strip of the page it renders');
    fx('D1', { where: { 1: ['decisions', 'decisions/:id', ':x'] } });
    ok(ids('1', 'decisions') === '' && ids('1', '#/decisions/D15') === '' && DEC.markerHtml('1', 'decisions/D1') === '', 'no strip on the Decisions pages, whatever the patterns say');
    ok(ids('1', 'plants') === 'D1', 'a one-segment pattern still works elsewhere');
    DEC.byId('D1').where = undefined; delete DEC.byId('D1').where;

    /* the strip */
    ok(DEC.markerHtml('1', 'p/nowhere') === '', 'markerHtml is empty where no card applies');
    const s = DEC.markerHtml('1', 'p/manesar/alert/a_do_at2'); const st = T(s);
    ok(/^<aside class="dec-mark" aria-label="Decisions on this screen">/.test(s) && /<\/aside>$/.test(s), 'the strip is one <aside> named "Decisions on this screen"');
    ok((s.match(/<details class="dm"/g) || []).length === 5 && (s.match(/<details class="dm dm-more"/g) || []).length === 1 && /\+2 more/.test(st), 'five cards: three inline, two under "+2 more"');
    const more = s.indexOf('dm-more');
    ok(['D5', 'D3', 'D15'].every((id) => s.indexOf(`|${id}"`) < more) && ['D9', 'D21'].every((id) => s.indexOf(`|${id}"`) > more), 'the first three by severity stay inline');
    ok(st.includes('D15 · Freeze while an issue is open · No call yet') && !/· Open\b/.test(st), 'summary "D15 · {short} · No call yet" when no call is made (never the issue status "Open")', st.slice(0, 300));
    ok(st.includes('v7/1 builds: Open issues keep the terms they opened under.') && st.includes('v7/2 builds: The limits are frozen while an issue is open.'), 'expanded: what each prototype builds');
    ok(st.includes(DEC.byId('D15').title), 'expanded: the question');
    ok(/Same in both: Sample readings drive the trial in both\./.test(st) && !/v7\/2 builds: Sample readings/.test(st), 'a card built the same in both says "Same in both"');
    ok(s.includes('<a href="#/decisions/D15" aria-label="Open card D15">Open the card</a>') && s.includes('<a href="../challenges.html#D15" target="_blank" rel="noopener" aria-label="Read D15 in the challenges doc (opens a new tab)">Read in the challenges doc</a>'), 'links: the card in this app, the challenges doc in a new tab, each named for its card');
    ok(!/class="chip|tone-|chip-|sev-|class="banner|class="note/.test(s), 'the strip uses none of the app\'s chip, severity, banner or note styles');
    { const css = fs.readFileSync(path.join(ASSETS, 'decisions7.css'), 'utf8'); const rule = (css.match(/\.dec-mark\s*\{[^}]*\}/) || [''])[0];
      ok(rule && !/dashed/.test(rule) && /border-left:\s*3px solid/.test(rule), 'the strip has a look of its own: a solid left rule, never the dashed border the app uses for "not built yet"', rule); }
    const sw = smoke.scan(s, { ids: false, marks: true, isData: decData() }).filter((f) => f.kind !== 'data-word'); ok(!sw.length, 'the strip\'s own words are clean', JSON.stringify(sw));
    ok(smoke.scan('<p>x</p>' + s).every((f) => f.kind !== 'id'), 'smoke.scan leaves the strip out of the page\'s own words');
    DEC.setAnswer('D15', { opt: 1 });
    ok(T(DEC.markerHtml('1', 'p/manesar/alert/a_do_at2')).includes('D15 · Freeze while an issue is open · Your call: Option 2'), 'summary carries the reader\'s call once made');
    ok(DEC.markerHtml('2', 'p/manesar/trigger/a_do_at2').includes('href="../2/prototype.html#/decisions/D15"'), 'a strip for the other prototype links its own card page');
    ok(DEC.shortOf(DEC.byId('D3')).length <= 49 && DEC.shortOf(d15) === 'Freeze while an issue is open', 'shortOf: the short name, else the question cut to a few words');

    /* the card pages: the two prototypes, built chips, arose, the challenges doc */
    const det = () => DEC.render.detail({ id: 'D15', _q: {} });
    if (UI) {
      DEC.V72_READY = false; setFlags('1', 'app');
      let h = det();
      checkPage(h, '#/decisions/D15 (fixture)');
      ok(/The two prototypes/.test(h) && /What v7\/1 does \(recommended approach\)/.test(T(h)) && /What v7\/2 does \(Alex's model\)/.test(T(h)), 'the card page shows "The two prototypes", v7/1 first');
      ok(h.indexOf('dk-col-1') < h.indexOf('dk-col-2'), 'v7/1\'s column comes first');
      ok((h.match(/>You are here</g) || []).length === 1 && h.indexOf('>You are here<') > h.indexOf('dk-col-1') && h.indexOf('>You are here<') < h.indexOf('dk-col-2'), '"You are here" on v7/1\'s column');
      ok(/v7\/2 is in build/.test(T(h)) && !/href="\.\.\/2\//.test(h) && !/href="[^"]*2\/prototype\.html/.test(h), 'V72_READY false: no link into v7/2, "v7/2 is in build" instead');
      ok(DEC.byId('D15').links.every((l) => h.includes(`href="${DEC.esc(l.href)}"`)), 'See it in v7/1: every v7/1 place is a link in this app');
      const rows = h.split('<label class="radio dec-opt').slice(1);
      ok(/Built in v7\/1/.test(rows[2]) && !/Built in v7\/1/.test(rows[0] + rows[1]) && /Built in v7\/2/.test(rows[0]) && !/Built in v7\/2/.test(rows[1] + rows[2]), 'chips: Built in v7/1 on option 3, Built in v7/2 on option 1');
      ok(/Arose: Designing v7\/2/.test(T(h)) && !/Arose:/.test(T(DEC.render.detail({ id: 'D3', _q: {} }))), 'an "Arose" line only for cards not from the first review');
      ok(h.includes('href="../challenges.html#D15" target="_blank" rel="noopener"') && /Read in the challenges doc/.test(T(h)), 'the card page links its section in the challenges doc');
      ok(!/Built in v7/.test(DEC.render.detail({ id: 'D7', _q: {} })) && /What v7 does now/.test(DEC.render.detail({ id: 'D7', _q: {} })), 'a card without the new fields renders as before');
      DEC.V72_READY = true; h = det();
      ok(/href="\.\.\/2\/prototype\.html#\/p\/manesar\/[^"]*" target="v7-2"/.test(h) && /\(opens v7\/2\)/.test(T(h)) && !/v7\/2 is in build/.test(T(h)), 'V72_READY true: v7/2 places link into v7/2 in its own window');
      DEC.V72_READY = false; setFlags('2', 'app'); h = det();
      ok(h.indexOf('>You are here<') > h.indexOf('dk-col-2') && /href="\.\.\/1\/prototype\.html#\/p\/manesar\/[^"]*" target="v7-1"/.test(h) && !/v7\/2 is in build/.test(T(h)), 'inside v7/2: "You are here" moves, v7/1 places open v7/1, v7/2 places are links');
      setFlags('1', 'app');
      const list = DEC.render.list({ _q: {} }); const lt = T(list);
      checkPage(list, '#/decisions (fixture)');
      ok(lt.includes(`v7/2: Option 1, ${DEC.byId('D15').options[0].label}`) && lt.includes('v7/2: same as v7/1'), 'closed cards name what v7/2 builds, or "same as v7/1"');
      ok(/Your calls are shared with v7\/2 in this browser/.test(lt), 'the list\'s sub-line names both prototypes once cards carry them');
      ok(list.includes('href="../challenges.html" target="_blank"'), 'the list links the challenges doc');
      ok(DEC.counts().same === 2, 'counts().same counts the cards built the same in both');
      const plantsHtml = UI.renderPath('#/p/manesar/issues'); const at = plantsHtml.indexOf('<aside class="dec-mark"');
      const tabsAt = plantsHtml.indexOf('<nav class="tabs"');
      ok(at > plantsHtml.indexOf('</header>') && (tabsAt < 0 || at < tabsAt) && (plantsHtml.match(/<aside class="dec-mark"/g) || []).length === 1, 'in the app the strip sits under the page header, before the tabs');
      ok(!/dec-mark/.test(UI.renderPath('#/p/vedanta/issues')) && !/dec-mark/.test(UI.renderPath('#/decisions/D15')), 'and nowhere a card does not name');
    }

    /* Copy my answers includes every card */
    const at = DEC.answersText();
    ok(CARDS.every((d) => new RegExp(`\\b${d.id}\\b`).test(at)), 'Copy my answers names every card (a call, or in "Not answered yet")');
  } catch (e) { ok(false, 'section 6 runs', e.stack); }
  finally {
    restore(); FX.forEach((id) => DEC.clearAnswer(id));
    setFlags(flags.v, flags.p); DEC.V72_READY = flags.r;
  }
  ok([...touched].every(([id, orig]) => JSON.stringify(DEC.byId(id)) === JSON.stringify(orig)) && CARDS.every((d) => ('where' in d) === HAD_WHERE.has(d.id)), 'fixtures restored: the live cards are as they were');

  /* the document view, standalone: a fresh context with no app, no document, a bare element */
  const SRC = fs.readFileSync(path.join(ASSETS, 'decisions7.js'), 'utf8');
  const fresh = (o) => {
    const store = (o && o.store) || new Map();
    const c = { console, localStorage: o && o.blocked ? { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } : { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) } };
    c.window = c; c.globalThis = c; Object.assign(c, (o && o.globals) || {});
    vm.runInNewContext(SRC, c, { filename: 'decisions7.js (doc)' });
    return { c, store };
  };
  const bare = () => ({ innerHTML: '', on: {}, addEventListener(t, f) { this.on[t] = f; } });
  const click = (el, id, opt) => el.on.click({ target: { closest: () => ({ getAttribute: (k) => ({ 'data-dd-pick': id, 'data-opt': String(opt) })[k] }) } });
  const pairUp = (c) => {
    const d = c.V7_DECISIONS.find((x) => x.id === 'D15');
    Object.assign(d, { short: 'Freeze while an issue is open', v71Option: 2, v71Short: 'Open issues keep their terms.', v72Option: 0, v72Short: 'Frozen while open.', v72Does: 'Second prototype prose.', links: d.links.map((l) => Object.assign({}, l, { label72: 'Second: ' + l.label, href72: l.href })) });
    c.V7_DECISIONS.push(Object.assign(JSON.parse(JSON.stringify(c.V7_DECISIONS[2])), { id: 'D' + (c.V7_DECISIONS.length + 1), short: 'A newer question', arose: 'Designing v7/2' }));
    c.V7_READINGS = [{ n: 1, title: 'Which value wins when two drafts disagree', drafts: 'One draft says a; another says b.', reading: 'v7/2 takes a.', why: 'It keeps one place to edit each value.', card: 'D15', confirm: true },
      { n: 2, title: 'A silent spot', drafts: 'The drafts say nothing.', reading: 'v7/2 shows nothing.', why: 'Nothing changes silently.', card: null, confirm: false }];
  };
  try {
    const { c, store } = fresh({ globals: { V7_PAGE: 'challenges' } }); pairUp(c);
    c.V7DEC.V72_READY = false;                              // the mechanism with v7/2 unpublished, whatever the file says today
    const el = bare(); const html = c.V7DEC.renderDoc(el, { mode: 'challenges' });
    ok(typeof html === 'string' && el.innerHTML === html && html.length > 5000, 'renderDoc fills a bare element with no document and no app');
    ok((html.match(/<section class="dd-card" id="D\d+"/g) || []).length === N + 1, 'one <section id="Dn"> per card', (html.match(/<section class="dd-card" id="D\d+"/g) || []).length);
    ok((html.match(/<tr><td data-label="Card">/g) || []).length === N + 1 && /<th scope="col">v7\/1 builds<\/th><th scope="col">v7\/2 builds<\/th>/.test(html), 'the at-a-glance table: a row per card, what each prototype builds');
    ok(new RegExp(`From designing v7/2 · ${CARDS.filter((d) => d.arose === 'Designing v7/2').length + 1}`).test(T(html)) && new RegExp(`From the first review of Alex's packs · ${CARDS.filter((d) => (d.arose || 'First review') === 'First review').length}`).test(T(html)) && /Arose: Designing v7\/2/.test(T(html)), 'cards are grouped by when they arose');
    ok(/<div class="dd-group" id="group-first-review">/.test(html) && /<div class="dd-group" id="group-designing-v7-2">/.test(html), 'each group carries an anchor for the docs\' contents');
    ok(/Readings v7\/2 takes where Alex's drafts are silent · 2/.test(T(html)), 'the readings heading names what they are, with the count');
    ok(/id="readings"/.test(html) && /Mihir to confirm/.test(T(html)) && /Decided on card <a class="dd-ref" href="#D15">D15<\/a>/.test(html) && /id="reading-2"/.test(html), 'the readings section, each linking its card');
    ok(/href="1\/prototype\.html#\/p\/manesar\/[^"]*" target="v7-1"/.test(html) && /v7\/2 is in build/.test(T(html)) && !/2\/prototype\.html/.test(html), 'from site/v7/: v7/1 places link into 1/prototype.html; v7/2 is in build');
    ok(/<details class="dd-fold"><summary>What Alex&#39;s pack says<\/summary>/.test(html) && /What to tell Alex/.test(html) && /Built in v7\/1/.test(html) && /Recommended/.test(html), 'background folds, built chips and the recommended option');
    ok(!/You are here/.test(html), 'no "You are here" on a page that belongs to neither prototype');
    for (const j of [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/]) ok(!j.test(T(html)), `the document view has no "${j.source}"`);
    noStrip(smoke.decode(html), 'the document view');
    const own = smoke.scan(html, { ids: false, isData: decData(c) }).filter((f) => f.kind !== 'data-word');
    ok(!own.length, 'the document view\'s own words are clean', JSON.stringify(own));
    ok(typeof el.on.click === 'function', 'renderDoc binds its your-call chips');
    click(el, 'D15', 1);
    let raw = null; try { raw = JSON.parse(store.get('ctl7.decisions')); } catch (e) { /* none */ }
    ok(raw && raw.v === 1 && raw.answers.D15 && raw.answers.D15.opt === 1, 'a your-call chip writes ctl7.decisions, the key both prototypes read');
    const again = c.V7DEC.renderDoc(bare(), { mode: 'challenges' });
    ok(/data-dd-pick="D15" data-opt="1" aria-pressed="true"/.test(again) && /data-dd-call="D15"><span class="dk-chip dk-c-call"[^>]*>Option 2</.test(again), 'the doc shows the call once made');
    click(el, 'D15', 1); raw = JSON.parse(store.get('ctl7.decisions'));
    ok(!raw.answers.D15, 'a second click on the same chip takes the call back');
    /* the same calls in the app: a fresh context reading the same storage sees them */
    click(el, 'D3', 'other');
    const { c: c2 } = fresh({ store }); ok(c2.V7DEC.answerOf('D3') && c2.V7DEC.answerOf('D3').opt === 'other', 'calls are shared under ctl7.decisions');
    /* three slots */
    const g = bare(); const k = bare(); const r = bare();
    const parts = c.V7DEC.renderDoc({ glance: g, cards: k, readings: r, mode: 'overview' });
    ok(g.innerHTML.includes('dd-table') && k.innerHTML.includes('dd-card') && r.innerHTML.includes('id="readings"') && parts && parts.glance, 'renderDoc({glance, cards, readings}) fills each slot');
    /* a hand-off doc in v7/1 */
    const { c: c3 } = fresh({ globals: { V7_PAGE: 'doc', V7_VARIANT: '1' } }); pairUp(c3);
    const dh = c3.V7DEC.renderDoc(bare(), { mode: 'doc' });
    ok(/You are here/.test(dh) && /href="prototype\.html#\/p\/manesar\//.test(dh), 'in a v7/1 doc: "You are here" on v7/1, places open prototype.html');
    /* no V7_PAGE: the mode decides the links */
    const { c: c4 } = fresh(); const ch = c4.V7DEC.renderDoc(bare(), { mode: 'challenges' });
    ok(/href="1\/prototype\.html#\//.test(ch) && c4.V7DEC.page() === 'challenges', 'without V7_PAGE the mode decides where links go');
    /* blocked storage */
    const { c: c5 } = fresh({ blocked: true }); const el5 = bare(); let threw = null;
    try { c5.V7DEC.renderDoc(el5, { mode: 'challenges' }); click(el5, 'D2', 2); } catch (e) { threw = e; }
    ok(!threw && c5.V7DEC.answerOf('D2') && c5.V7DEC.answerOf('D2').opt === 2, 'storage blocked: the doc renders and a call holds for the visit', threw && threw.message);
    /* a document without its stylesheet gets it, next to the script */
    const head = { kids: [], appendChild(x) { this.kids.push(x); } };
    const docStub = { head, currentScript: null, querySelectorAll: () => [], createElement: () => ({}), getElementById: () => null, addEventListener() {} };
    const { c: c6 } = fresh({ globals: { document: docStub } }); c6.V7DEC.renderDoc(bare(), { mode: 'challenges' });
    ok(head.kids.length === 1 && head.kids[0].href === 'assets/decisions7.css?v=3' && head.kids[0].rel === 'stylesheet', 'a doc without decisions7.css gets it linked', JSON.stringify(head.kids));
    /* another tab changed the calls */
    let storageFn = null; let hits = 0;
    const { c: c7, store: s7 } = fresh({ globals: { addEventListener: (t, f) => { if (t === 'storage') storageFn = f; } } });
    c7.V7DEC.onExternalChange(() => { hits++; });
    c7.V7DEC.answerOf('D9');
    s7.set('ctl7.decisions', JSON.stringify({ v: 1, answers: { D9: { opt: 0, note: '', at: '' } } }));
    storageFn({ key: 'ctl7.other' }); storageFn({ key: 'ctl7.decisions' });
    ok(hits === 1 && c7.V7DEC.answerOf('D9') && c7.V7DEC.answerOf('D9').opt === 0, 'onExternalChange: another tab\'s call shows, other keys are ignored');
  } catch (e) { ok(false, 'the standalone document view runs', e.stack); }
})();

/* ── 7. v7/2's numbers in the cards and readings (site/v7/2 only): each one equals v7/2's engine at the start of the
   story — the facts the cards quote, plus the few the later cards and the readings quote. Last, because it resets. ── */
if (HERE === '2' && V && typeof V.reset === 'function') (() => {
  let F = null; try { F = APPS.values72(V); } catch (e) { ok(false, 'v7/2\'s numbers are worked out', e.message); return; }
  const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const word = (n) => WORDS[+n] || String(n);
  const S = (f, fb) => { try { return f(); } catch (e) { return fb; } };
  const card = (id) => DEC.byId(id) || {}; const reading = (n) => (W.V7_READINGS || []).find((r) => r && r.n === n) || {};
  const zoneText = (k, s, dir, b) => S(() => V.zoneInfo(k, s, dir).perBand[b].valueText, null);
  const ov = S(() => V.overrides({ plant: 'manesar' }), []) || [];
  const ovOf = (re) => ov.find((o) => re.test(`${o.what}`)) || {};
  const [clears, clearsAt] = String(F.noisyClears || '').split(', ');
  const tiers = (k, ids) => ids.map((id) => S(() => V.tierInfo(k, id), null));
  const dpRaised = S(() => V.equipment('digitalpaani').map((e) => [e, V.tierInfo('digitalpaani', e.id)]).filter(([, t]) => t && t.src === 'derived' && t.value !== t.libValue), []);
  const raisedBy = (re, from, to) => dpRaised.filter(([e, t]) => re.test(e.tag) && t.libValue === from && t.value === to).length;
  const bw = tiers('bawal', ['sc_v1', 'sc_dt1', 'sc_cav']);
  const migr = ovOf(/AMP-BL1 · Caution/);
  const EXPECT = [
    ['D1', 'v72Does', `proposes ${F.dpUnitProcesses} unit processes and ${F.dpControlGroups} control groups and leaves ${F.dpUnclassified} pieces of equipment unclassified`],
    ['D1', 'v72Does', `beside the ${F.eqTypes} equipment types`],
    ['D3', 'v72Does', `on ${F.emergencyAt} is one more trial firing on pH low · EQ-1, with a peak of ${F.emergencyPeak}`],
    ['D4', 'v72Does', `day ${F.trialDay} of its trial`],
    ['D5', 'v72Does', `"Fired ${F.lvlCount} times in ${F.lvlDays} days · median ${F.lvlMedian} min · peak ${F.lvlPeak}"`],
    ['D6', 'v72Does', `"Override · Tuning · you · ${F.today} · review by ${F.tunedReview}"`],
    ['D7', 'v72Does', `about ${F.vedTasksPerDay} Tasks a day at Vedanta`],
    ['D7', 'v72Does', `DigitalPaani would run about ${F.dpTasksPerDay} Tasks a day once Live`],
    ['D18', 'v72Does', `"${zoneText('manesar', 'eq1_lvl', 'above', 'caution')}"`],
    ['D18', 'v72Does', `as for ${word(F.dpHeightGaps)} tanks at DigitalPaani`],
    ['D19', 'v72Does', `("Entered for ${F.vedLastService} of ${F.vedEq} pieces of equipment" at Vedanta)`],
    ['D19', 'v72Does', `so ${F.vedDueOnGoLive} scheduled Tasks would fall due on Vedanta's go-live day`],
    ['D21', 'v72Does', `Level high · EQ-1 (${F.lvlPerDay} a day) is noisy`],
    ['D21', 'v72Does', `DO low · SBR-1 (${F.doPerDay} a day,`],
    ['D24', 'v72Does', `'Fired ${F.lvlCount} times in ${F.lvlDays} days'`],
    ['D24', 'v72Does', `'Trial so far: would have fired ${F.lvlTuned} times instead of ${F.lvlCount}'`],
    ['D24', 'v72Does', `about ${clearsAt} on ${clears}`],
    ['D24', 'v72Does', `Wed 28 Oct's Emergency on pH low · EQ-1`],
    ['D25', 'v72Does', `set ${S(() => migr.atText, '?')}, review by ${S(() => migr.reviewByText, '?')}, author not recorded`],
    ['D25', 'v72Does', `AMP-BL1's Caution ${ovOf(/AMP-BL1 · Caution/).valueText} (base ${ovOf(/AMP-BL1 · Caution/).baseText}), Minor ${ovOf(/AMP-BL1 · Minor/).valueText} (base ${ovOf(/AMP-BL1 · Minor/).baseText}) and Major ${ovOf(/AMP-BL1 · Major/).valueText === 'no value' ? 'none' : ovOf(/AMP-BL1 · Major/).valueText} (base ${ovOf(/AMP-BL1 · Major/).baseText})`],
    ['D25', 'v72Does', `do-when ${ovOf(/do when/).valueText} (base ${ovOf(/do when/).baseText}) and done-when ${ovOf(/done when/).valueText} (base ${ovOf(/done when/).baseText})`],
    ['D25', 'options', `Five of Manesar's ${F.migrated} migrated values`],
    ['D26', 'v72Does', `raises V-1 from ${S(() => bw[0].libValue, '?')} to ${S(() => bw[0].value, '?')} (it serves MGF-1) and DT-1 and CV-1 from ${S(() => bw[1].libValue, '?')} to ${S(() => bw[1].value, '?')} (UF-1)`],
    ['D26', 'v72Does', `raises the ${word(raisedBy(/^UFBP-/, 'B', 'A'))} UF backwash pumps from B to A and ${word(raisedBy(/^UF(F|P|BO)V-/, 'C', 'A'))} UF valves from C to A`],
    ['D26', 'options', `(${dpRaised.length} at DigitalPaani, ${bw.filter((t) => t && t.src === 'derived' && t.value !== t.libValue).length} at Bawal)`],
    ['R8', 'reading', `${F.dpUnclassified} of DigitalPaani's ${F.dpEquipment} pieces of equipment and ${F.bawalByRules} of Bawal's ${F.bawalEq}`],
    ['R14', 'reading', `'${zoneText('manesar', 'eq1_lvl', 'above', 'caution')}'`],
    ['R18', 'reading', `so it falls on ${F.migratedReview.replace(/^\w+ /, '')}`],
    ['R24', 'reading', `${F.vedDueOnGoLive} of Vedanta's ${F.vedScheduled} scheduled Tasks`],
    ['R35', 'reading', `keeps ${String(ovOf(/do when/).valueText).replace(/ A$/, '')} / ${ovOf(/done when/).valueText} as two Migrated overrides against a worked-out ${String(ovOf(/do when/).baseText).replace(/ A$/, '')} / ${ovOf(/done when/).baseText}`],
  ];
  const textOf = (who, field) => {
    if (/^R\d+$/.test(who)) { const r = reading(+who.slice(1)); return [r.title, r.drafts, r.reading, r.why].join('\n'); }
    const d = card(who); return field === 'options' ? (d.options || []).map((o) => o.label + ' ' + o.consequence).join('\n') : String(d[field] || '');
  };
  const miss = EXPECT.filter(([who, field, want]) => !textOf(who, field).replace(/\s+/g, ' ').includes(want)).map(([who, field, want]) => `${who}.${field} should say "${want}"`);
  ok(!miss.length, `v7/2's numbers in the cards and readings equal v7/2's engine (${EXPECT.length} places)`, miss.slice(0, 4).join(' | '));
  /* "almost two days" (D24) and "under two days later" (D21): how long the tuned Trigger stays noisy, from the engine */
  S(() => {
    const ts = V.trialStats('vedanta', 'a_3d'); const days = (ts.since + (ts.count / 10) * 864e5 - V.now()) / 864e5;
    const d24 = [card('D24').tellAlex].concat((card('D24').options || []).map((o) => o.consequence)).join(' ');
    ok(days >= 1.5 && days < 2 && /almost two more days/.test(d24) && /almost two days/.test(d24) && /under two days later/.test(card('D21').v72Does), 'the noisy mark outlasts a fix by almost two days, as D21 and D24 say', `${days.toFixed(2)} days`);
  }, null);
  /* every fact the cards quote appears in some card's v7/2 text */
  const facts = require('./facts72.js').KEYS; const all72 = CARDS.map((d) => [d.v72Short, d.v72Does].join('\n')).join('\n');
  const unquoted = facts.filter((k) => F[k] == null || !all72.includes(String(F[k])));
  ok(!unquoted.length, 'every fact the cards quote is in a card\'s v7/2 text', unquoted.map((k) => `${k} (${F[k]})`).join(', '));
  /* the Forced try card D23 quotes: Downstream lists the frozen Trigger, which keeps its Emergency limit */
  S(() => {
    const id = 'tpl_up_activated-sludge_do-low';
    V.editTemplate(id, { band: 'emergency', rule: { kind: 'const', value: 0.8 } });
    const ds = V.downstream(id); const fz = (ds.fields || []).flatMap((f) => f.groups || []).find((g) => g.key === 'frozen') || {};
    const held = V.heldOf('manesar', 'a_do_at2'); const em = held && held.terms && held.terms.bands ? held.terms.bands.emergency : null;
    V.discardTemplateDraft(id);
    ok(textOf('D23', 'v72Does').includes(`'${fz.head}' with '${(fz.items || []).map((x) => x.text || x).join('')}', which keeps ${em}`), 'D23\'s Forced try reads as v7/2\'s Downstream does', `${fz.head} · ${(fz.items || []).map((x) => x.text || x).join(' ; ')} · keeps ${em}`);
  }, null);
  V.reset();
})();

finish();
function finish() {
  const lines = [];
  lines.push(`decisions7 test · ${LOADED.length}/${ORDER.length} assets loaded${MISSING.length ? ' · missing: ' + MISSING.join(', ') : ''}`);
  if (NOTES.length) lines.push(`notes (${NOTES.length}): ` + (VERBOSE ? '\n  ' + NOTES.join('\n  ') : [...new Set(NOTES)].slice(0, 4).join(' | ') + (NOTES.length > 4 ? ' …' : '')));
  if (FAIL.length) { lines.push(`FAILURES (${FAIL.length}):`); (VERBOSE ? FAIL : FAIL.slice(0, 30)).forEach((f) => lines.push('  ✗ ' + f)); if (!VERBOSE && FAIL.length > 30) lines.push(`  … ${FAIL.length - 30} more (use -v)`); }
  lines.push(`${FAIL.length ? 'RESULT: FAIL' : 'RESULT: PASS'} · ${CHECKS} checks · ${FAIL.length} failures`);
  console.log(lines.join('\n'));
  process.exit(FAIL.length ? 1 : 0);
}
