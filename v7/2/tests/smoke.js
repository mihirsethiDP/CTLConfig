#!/usr/bin/env node
/* v7/2 smoke harness. Node only, no dependencies.

   Loads every asset in prototype.html's order into one context with a stub DOM, boots V7, then renders every registered
   route for every plant with sampled objects: at most 3 per kind (equipment per type, unit processes per type, control
   groups, sensors per reading, Issue Triggers, Task Triggers, Tasks, Issues, templates per owner, equipment types per
   family, unit-process types per stage, plant types, conditions, flows, root causes), every place the story panel and the
   decision cards link to, and every in-app link found on those pages for the same objects (a bounded crawl, so tabs,
   filters and field focus are covered too). A second pass renders again after the story clock moves on a day, and a
   third renders a sample of every route with the decisions strip on.

   It fails on:
     · a load error, a throw, a non-string result, a route registered by two files, a planned route nobody registered;
     · v7/2's banned words and internal ids in the visible text (tags and attribute values stripped first), and
       "undefined" / "NaN" / "[object Object]" on screen;
     · a dead link: an href "#/…" that matches no route, or names a plant or object that does not exist;
     · a Commissioning plant's page without "Commissioning · nothing is sent", or a Live plant's page with it;
     · a source chip that only shows on hover (a title carrying "Library ·", "Override ·" and the like), a "Base moved"
       chip that says something else, or any chip other than Base moved with an amber fill in the stylesheets;
     · DigitalPaani not tagged "Real plant graph", or no page telling how fixes go back to the survey.
   A banned word or id inside verbatim library or workbook text (ISSUES, flows, causes, catalogue, readings) is a warning
   ("data-word"): the words are in the data itself. The Decisions page and the decisions strip quote the cards, which
   quote both approaches, so a banned word in a card's own text is a warning there ("quoted").

   Every page module is written, so a page module that is still the v7/1 file it was forked from (its code unchanged,
   comments aside) or is missing fails like any other. --lenient reports what such a module's routes show as "pending"
   warnings instead, for a build in progress. The decision file is shared by both prototypes by design and is always
   checked.

   Usage   node tests/smoke.js [options]
     --only=<text>     render only routes whose pattern contains <text> (e.g. --only=trigger)
     --max=<n>         renders per route pattern (default 120)
     --no-crawl        render the sampled params only, do not follow links
     --no-advance      skip the second pass after V7.advance(1440)
     --lenient         a missing page module, or one still v7/1's, gives warnings ("pending") instead of failures
     --strict          the default; kept so older commands still run
     --list            list routes, their owners and sample counts, then exit
     -v, --verbose     print every failure and warning (default: the first 25 of each)
   Exit code 0 = pass, 1 = failures. Requiring this file exports the checkers (visibleText, scan, BANNED, IDS, …). */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const V71_ASSETS = path.resolve(ROOT, '..', '1', 'assets');
const DEFAULT_ORDER = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js',
  'core7.js', 'core72-structure.js', 'core72-library.js', 'core72-ledger.js', 'core72-commission.js',
  'ui7.js', 'plant7.js', 'lists7.js', 'structure7.js', 'object7.js', 'lib7.js', 'ledger7.js', 'work7.js', 'decisions7.js'];

/* ── words on screen ───────────────────────────────────────────────────────────────────────── */
/* Alex's word list wholesale: Trigger, Zones, Binding, Persistence, Derived, Override, Deviation, Base moved, unit process,
   control group and stage are allowed; these are not. Case-insensitive unless the pattern says otherwise. */
const BANNED = [
  // words Alex's list says not to use
  ['machine', /\bmachines?\b/i], ['asset', /\bassets?\b/i], ['widget', /\bwidgets?\b/i], ['estate', /\bestates?\b/i], ['portfolio', /\bportfolio\b/i],
  ['custom', /\bcustom\b/i], ['detach', /\bdetach(ed)?\b/i], ['fork', /\bfork(ed|s)?\b/i], ['diverge', /\bdiverg(e|ed|es|ing|ence)\b/i], ['stale', /\bstale\b/i],
  ['drift', /\bdrift\b/i], ['alert', /\balerts?\b/i], ['alerting', /\balerting\b/i], ['alarm', /(?<!false )\balarms?\b/i], ['insight', /\binsights?\b/i],
  ['schedule', /\bschedules?\b/i], ['SCADA', /\bSCADA\b/i], ['database', /\bdatabase\b/i], ['the form', /\bSCADA form\b|\bthe form\b/i],
  ['hold time', /\bhold time\b/i], ['debounce', /\bdebounce\b/i], ['observation frequency', /\bobservation frequency\b/i], ['procedure', /\bprocedures?\b/i],
  ['workflow', /\bworkflows?\b/i], ['SOP', /\bSOPs?\b/i], ['remediation', /\bremediation\b/i], ['Site Admin', /\bSite Admin\b/i], ['SME', /\bSME\b/i],
  ['Supervisor', /\bSupervisor\b/i], ['onboarding', /\bonboarding\b/i], ['shadow', /\bshadow\b/i], ['test alert', /\btest alert\b/i], ['dry run', /\bdry run\b/i],
  ['detect', /\bdetect\b/i], ['priority', /\bpriority\b/i], ['tier (bare)', /(?<!criticality )\btier\b/i],
  ['Critical / Essential / Standard', /\bCritical\b|\bEssential\b|\bStandard\b/],
  ['rule', /(?<!limit |no )\brules?\b/i], ['survey type', /\bsurvey type\b/i], ['unit operation', /\bunit operations?\b/i],
  ['process stage', /\b(functional|process) stages?\b/i], ['sub-asset', /\bsub-assets?\b/i],
  // v7/1 words that must not survive
  ['Changed here', /\bChanged here\b/i], ['Differences from the library', /\bDifferences from the library\b/i],
  ['Library changed since', /\bLibrary changed since\b/],                // case-sensitive: v7/1's chip; v7/2's resync banner says "… {sensor} or the library changed since."
  ['From the library', /\bFrom the library\b/i], ['From the SCADA form', /\bFrom the SCADA form\b/i], ['No limits yet', /\bNo limits yet\b/i],
  ['What SCADA found', /\bWhat SCADA found\b/i], ['What the library brings', /\bWhat the library brings\b/i], ['Where it lands', /\bWhere it lands\b/i],
  ['Not for this plant', /\bNot for this plant\b/i], ['On trial', /\bOn trial\b/i], ['Mostly short', /\bMostly short\b/i], ['Tuned for this plant', /\bTuned for this plant\b/i],
  ['For now, until', /\bFor now, until\b/i], ['Reason not recorded', /\bReason not recorded\b/i], ['Not in the library', /\bNot in the library\b/i],
  ['Back to the library value', /Back to the library value/],            // case-sensitive: v7/2's own lines say "… back to the library value …"
  ['Suggest for the library', /\bSuggest for the library\b/i], ['Who is told', /\bWho is told\b/i], ['User Center', /\bUser Center\b/i],
  ['Phone view', /\bPhone view\b/i], ['Review due', /\bReview due\b/i], ['no call, no hooter', /\bno call, no hooter\b/i], ['told to the Leads', /\btold to the Leads\b/i],
  ['must hold for', /(?<!Persistence · )must hold for/i], ['must clear for', /(?<!Clearing · )must clear for/i],
  ['read again', /\bthen read (it )?again\b/i],
];
/* internal ids: Alex's decision ids, wireframes, requirement and acceptance numbers, file and document names. Never right
   after a hyphen or a letter, so equipment and sensor tags (AMP-P1, HRS-SP1) pass. Card ids D1…Dn count everywhere except
   the Decisions page. The private names and internal document names are written with a one-letter class ([i], [R], [d])
   so this public file never spells them; the patterns match exactly the same text. */
const IDS = [/\b(CM|C|O)-\d{1,2}\b/, /(?<![-\w])E[1-5]\b/, /(?<![-\w])W\d{1,2}[a-d]?\b/, /(?<![-\w])P[1-6]\b/, /(?<![-\w])S[1-8]\b/,
  /\bV7-\d+\b/, /\bV72-\d+\b/, /\bP[R]D\b/, /§\s*\d/, /\bAC-?\d+\b/, /Am[i]ty/i, /No[i]da/i, /\.m[d]\b/i, /\.html\b/i, /dp_[i]ntel/i];
const DEC_ID = /(?<![-\w])D\d{1,2}\b/;
const JUNK = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Invalid Date/, /\$\{/];

/* who registers which route (one owner per route); a module that is missing or still v7/1's file is "pending" */
const ROUTE_PLAN = {
  'ui7.js': ['plants', 'activity/:plant?', 'p/:plant/activity'],
  'plant7.js': ['p/:plant', 'p/:plant/people', 'p/:plant/people/service-dates', 'p/:plant/review/bindings', 'p/:plant/library'],
  'lists7.js': ['p/:plant/triggers', 'p/:plant/readings', 'p/:plant/tasks', 'p/:plant/details'],
  'structure7.js': ['p/:plant/structure/:view?', 'p/:plant/review/structure', 'p/:plant/cg/:id', 'p/:plant/equipment', 'p/:plant/scada', 'p/:plant/review'],
  'object7.js': ['p/:plant/eq/:id/:tab?', 'p/:plant/eq/:id/phone', 'p/:plant/eq/:id/card', 'p/:plant/up/:id/:tab?', 'p/:plant/up/:id/phone', 'p/:plant/sensor/:id', 'p/:plant/trigger/:id', 'p/:plant/alert/:id'],
  'lib7.js': ['library', 'library/eq-types', 'library/eq-types/:code/:tab?', 'library/up-types', 'library/up-types/:id/:tab?', 'library/templates', 'library/templates/:id',
    'library/plant-types', 'library/plant-types/:id/:tab?', 'library/conditions/:id?', 'library/flows/:id?', 'library/root-causes/:id?', 'library/:code/:tab?'],
  'ledger7.js': ['deviations', 'p/:plant/deviations', 'differences', 'p/:plant/differences'],
  'work7.js': ['p/:plant/issues', 'p/:plant/issue/:id', 'p/:plant/task/:id'],
  'decisions7.js': ['decisions', 'decisions/:id'],
};
const SHARED = new Set(['decisions7.js']);    // the decision file is byte-identical in both prototypes by design

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', rarr: '→', larr: '←', hellip: '…', times: '×', bull: '•', rsaquo: '›', lsaquo: '‹', deg: '°', micro: 'µ', copy: '©' };
function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
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
/* the decisions strip (<aside class="dec-mark">, from decisions7.js) is a study note laid over a screen, not the app's own
   words: it names the decision cards (D1…Dn) and quotes their text. scan() leaves it out unless {marks:true}. */
const MARK_RE = /<aside class="dec-mark"[\s\S]*?<\/aside>/g;
function withoutMarks(html) { return String(html == null ? '' : html).replace(MARK_RE, ' '); }
function markStrips(html) { return String(html == null ? '' : html).match(MARK_RE) || []; }
/* scan(html, {ids, decisions, marks, isData}) → [{kind:'banned'|'id'|'junk'|'data-word', word, ctx}] */
function scan(html, o) {
  o = o || {};
  const text = o.text != null ? o.text : visibleText(o.marks ? html : withoutMarks(html));
  const out = [];
  const all = (re) => { const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); const r = []; let m; while ((m = g.exec(text)) && r.length < 50) { r.push(m); if (!m[0]) g.lastIndex++; } return r; };
  const fromData = (m) => !!(o.isData && o.isData(text, m.index, m[0].length));
  for (const [word, re] of BANNED) {
    const ms = all(re); const ui = ms.find((m) => !fromData(m));
    if (ui) out.push({ kind: 'banned', word, ctx: context(text, ui.index, ui[0].length) });
    else if (ms.length) out.push({ kind: 'data-word', word, ctx: context(text, ms[0].index, ms[0][0].length) });
  }
  if (o.ids !== false) for (const re of IDS.concat(o.decisions ? [] : [DEC_ID])) {
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
/* verbatim data text, to tell UI copy from library and workbook content (and, on the Decisions page, from the cards' text) */
const DATA_GLOBALS = ['ISSUES', 'ISSUE_TASKS', 'SEED', 'CATALOGUE', 'READINGS', 'PLANT_PROFILES', 'NEXT_PHASE_FLOWS', 'NEXT_PHASE_CAUSES', 'RCA_MAPS', 'FORM_RULES', 'SCADA_FORM', 'DB_PALETTE'];
function corpusOf(W, names, asList) {
  const seen = new Set(); const parts = [];
  const walk = (x, d) => {
    if (x == null || d > 8) return;
    if (typeof x === 'string') {
      if (x.length > 3) parts.push(x.replace(/\s+/g, ' '));
      /* as a list, each line of a longer text too, without its list marker: pages show a "- item" line as a list item */
      if (asList && /\n/.test(x)) x.split(/\n+/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/\s+/g, ' ').trim()).filter((l) => l.length > 3).forEach((l) => parts.push(l));
      return;
    }
    if (typeof x !== 'object' || seen.has(x)) return; seen.add(x);
    if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1)); else Object.keys(x).forEach((k) => walk(x[k], d + 1));
  };
  (names || DATA_GLOBALS).forEach((g) => walk(W[g], 0));
  return asList ? parts : parts.join('\n');
}
/* isDataIn(corpus, strings) → (text, index, length) → true when the match sits inside verbatim corpus text: a few characters
   either side are found in the corpus, or (given the corpus as separate strings) one whole corpus string that holds the match
   covers it on the page. Lookups are remembered, since the same data text shows on many pages. */
function isDataIn(corpus, strings) {
  const seen = new Map();
  const inCorpus = (x) => { if (!seen.has(x)) seen.set(x, corpus.includes(x)); return seen.get(x); };
  const list = Array.isArray(strings) ? strings.filter((x) => x && x.length > 3) : null;
  return (text, i, len) => {
    if (!corpus) return false;
    const left = text.slice(Math.max(0, i - 16), i + len).trim(); const right = text.slice(i, i + len + 16).trim();
    if ((left.length > len + 3 && inCorpus(left)) || (right.length > len + 3 && inCorpus(right)) || inCorpus(text.slice(Math.max(0, i - 6), i + len + 6))) return true;
    if (!list) return false;
    const word = text.slice(i, i + len).toLowerCase();
    for (const x of list) {
      if (x.length <= len || !x.toLowerCase().includes(word)) continue;
      let k = text.indexOf(x, Math.max(0, i + len - x.length));
      while (k >= 0 && k <= i) { if (k + x.length >= i + len) return true; k = text.indexOf(x, k + 1); }
    }
    return false;
  };
}
/* decisionsCorpus(W): the decision cards' own text and the readings, which quote both approaches word for word */
function decisionsCorpus(W, asList) { return corpusOf({ V7_DECISIONS: W.V7_DECISIONS, V7_READINGS: W.V7_READINGS }, ['V7_DECISIONS', 'V7_READINGS'], asList); }

/* a v7/2 page module that is still the v7/1 file it was forked from: same code once comments and spacing are set aside */
function codeOf(src) {
  return String(src).replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n').replace(/\s+/g, ' ').trim();
}
function isFork(file, dirs) {
  const d = dirs || { v72: ASSETS, v71: V71_ASSETS };
  if (SHARED.has(file)) return false;
  const a = path.join(d.v72, file); const b = path.join(d.v71, file);
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  try { return codeOf(fs.readFileSync(a, 'utf8')) === codeOf(fs.readFileSync(b, 'utf8')); } catch (e) { return false; }
}

/* "Base moved" is the only chip with an amber fill: every stylesheet rule on a chip (.chip, .chip-*, a state chip .st-*)
   whose background is amber must be the Base moved chip (.chip-moved, or its older name .chip-libchanged) */
const AMBER_OK = /^\.chip-(moved|libchanged)$/;
function hexToHsl(hex) {
  let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255; const g = parseInt(h.slice(2, 4), 16) / 255; const b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2; const dd = mx - mn;
  if (!dd) return { h: 0, s: 0, l };
  const s = dd / (1 - Math.abs(2 * l - 1));
  let hh = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; hh *= 60; if (hh < 0) hh += 360;
  return { h: hh, s, l };
}
function isAmber(hex) { const c = hexToHsl(hex); return !!c && c.h >= 25 && c.h <= 60 && c.s >= 0.35 && c.l >= 0.35 && c.l <= 0.97; }
function cssTokens(src) {
  const t = {}; const re = /:root\s*\{([^}]*)\}/g; let m;
  while ((m = re.exec(src))) m[1].replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (x, k, v) => { t[k] = v.trim(); return x; });
  return t;
}
/* amberFillRules(cssByFile, tokens) → [{file, selector, colour}] for chip rules with an amber fill other than Base moved */
function amberFillRules(cssByFile, tokens) {
  const out = [];
  Object.keys(cssByFile).forEach((file) => {
    const src = String(cssByFile[file]).replace(/\/\*[\s\S]*?\*\//g, ' ');
    const re = /([^{}@]+)\{([^{}]*)\}/g; let m;
    while ((m = re.exec(src))) {
      const sels = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      const bg = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i.exec(m[2]); if (!bg) continue;
      let val = bg[1].trim(); const v = /var\((--[\w-]+)\)/.exec(val); if (v && tokens[v[1]]) val = tokens[v[1]];
      const hex = /#[0-9a-f]{3,6}\b/i.exec(val); if (!hex || !isAmber(hex[0])) continue;
      sels.forEach((sel) => {
        const chipCls = (sel.match(/\.(chip[\w-]*|st-[\w-]+)/g) || []);
        if (!chipCls.length) return;
        const last = chipCls[chipCls.length - 1];
        if (!AMBER_OK.test(last)) out.push({ file, selector: sel, colour: hex[0] });
      });
    }
  });
  return out;
}
/* source-chip checks on one page: a "Base moved" chip says Base moved; no source shows only in a hover title */
const SRC_TITLE = /^(Library ·|Derived ·|Override ·|Base moved|Library value|Library:|Derived:|Forced by library|Suspended|Pinned to)/;
function chipProblems(html, visText) {
  const out = []; const s = withoutMarks(String(html || '')); let m;
  for (const cls of ['chip-moved', 'chip-libchanged']) {
    let at = s.indexOf(cls);
    while (at >= 0) {
      const open = s.lastIndexOf('<', at); const gt = s.indexOf('>', at); const close = s.indexOf('</', gt);
      if (open >= 0 && gt > at && close > gt && /^<(span|a)\b[^>]*\bclass="[^"]*$/.test(s.slice(open, at))) {
        const t = visibleText(s.slice(gt + 1, close));
        if (!/^Base moved/.test(t)) out.push({ kind: 'chip', msg: `an amber "Base moved" chip reads "${t.slice(0, 60)}"` });
      }
      at = s.indexOf(cls, at + cls.length);
    }
  }
  const vis = visText != null ? visText : visibleText(s);
  const reT = /\stitle\s*=\s*"([^"]*)"/g;
  while ((m = reT.exec(s))) { const t = decode(m[1]).trim(); if (SRC_TITLE.test(t) && !vis.includes(t)) out.push({ kind: 'hover', msg: `a value's source shows only on hover: "${t.slice(0, 80)}"` }); }
  return out;
}
module.exports = { visibleText, scan, links, BANNED, IDS, DEC_ID, JUNK, decode, installDom, corpusOf, isDataIn, decisionsCorpus, MARK_RE, withoutMarks, markStrips,
  ROUTE_PLAN, isFork, codeOf, amberFillRules, cssTokens, isAmber, chipProblems, DEFAULT_ORDER };
if (require.main !== module) return;

/* ── arguments ───────────────────────────────────────────────────────────────────────────────────────────── */
const ARGS = { max: 120, crawl: true, advance: true, strict: true, verbose: false, only: '', list: false };
for (const a of process.argv.slice(2)) {
  if (a === '--no-crawl') ARGS.crawl = false;
  else if (a === '--no-advance') ARGS.advance = false;
  else if (a === '--strict') ARGS.strict = true;
  else if (a === '--lenient') ARGS.strict = false;
  else if (a === '-v' || a === '--verbose') ARGS.verbose = true;
  else if (a === '--list') ARGS.list = true;
  else if (a.startsWith('--only=')) ARGS.only = a.slice(7);
  else if (a.startsWith('--max=')) ARGS.max = Math.max(1, +a.slice(6) || 120);
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
  g.location = { hash: '#/plants', href: 'http://localhost/v7/2/prototype.html#/plants', pathname: '/v7/2/prototype.html', search: '', origin: 'http://localhost', host: 'localhost', protocol: 'http:', reload() {}, assign() {}, replace() {} };
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
  g.V7_NO_V6_SHELL = true; g.V7_VARIANT = '2';
}

/* ── run ─────────────────────────────────────────────────────────────────────────────────────────────────── */
const T0 = performance.now();
let pass1 = null; let pass2 = null; let pass3 = null;
const FAIL = []; const WARN = [];
let PENDING = new Set(); let MISSING = new Set();
const warn = (kind, where, msg, extra) => WARN.push({ kind, where, msg, extra });
/* with --lenient, a problem on a page owned by a pending module is a warning until that module is rewritten */
function report(kind, where, msg, extra, owner) {
  if (!ARGS.strict && owner && (PENDING.has(owner) || MISSING.has(owner))) { WARN.push({ kind: 'pending', where, msg: `[${kind}] ${msg}  (${owner} ${MISSING.has(owner) ? 'is not written yet' : 'is still the v7/1 module'})`, extra }); return; }
  FAIL.push({ kind, where, msg, extra, owner });
}
function frame(e) {
  const st = String(e && e.stack || '');
  const line = st.split('\n').find((l) => /[\\/](assets|tests)[\\/][^\\/]+\.js/.test(l));
  const m = line && line.match(/[\\/]((?:assets|tests)[\\/][^\\/:]+\.js):(\d+)/);
  return m ? `${m[1].replace(/\\/g, '/')}:${m[2]}` : '';
}
function errMsg(e) { return `${e && e.name ? e.name + ': ' : ''}${e && e.message ? e.message : String(e)}${frame(e) ? '  (' + frame(e) + ')' : ''}`; }

process.on('uncaughtException', (e) => { FAIL.push({ kind: 'async', where: 'timer or callback', msg: errMsg(e) }); });
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
  return { order: DEFAULT_ORDER, from: 'the built-in list' };
}
const { order: ORDER, from: ORDER_FROM } = scriptOrder();
const missing = []; const loaded = [];
const OWNER = new Map(); const DOUBLE = []; let CURRENT = null;
const normPat = (p) => String(p || '').replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, '');
for (const f of ORDER) {
  const file = path.join(ASSETS, f);
  if (!fs.existsSync(file)) { missing.push(f); continue; }
  CURRENT = f;
  const before = global.V7UI ? new Set(global.V7UI.routes().map((r) => r.pattern)) : new Set();
  try { vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file }); loaded.push(f); }
  catch (e) { FAIL.push({ kind: 'load', where: f, msg: errMsg(e) }); }
  const U = global.V7UI;
  if (U && f === 'ui7.js' && !U.__smokeWrapped) {
    const orig = U.route;
    U.route = function (pattern, fn) {
      const p = normPat(pattern);
      if (OWNER.has(p) && OWNER.get(p) !== CURRENT) DOUBLE.push([p, OWNER.get(p), CURRENT]); else if (!OWNER.has(p)) OWNER.set(p, CURRENT);
      return orig.apply(this, arguments);
    };
    U.__smokeWrapped = true;
  }
  if (U) for (const r of U.routes()) if (!before.has(r.pattern) && !OWNER.has(r.pattern)) OWNER.set(r.pattern, f);
}
CURRENT = null;
MISSING = new Set(Object.keys(ROUTE_PLAN).filter((f) => missing.includes(f) || !fs.existsSync(path.join(ASSETS, f))));
PENDING = new Set(Object.keys(ROUTE_PLAN).filter((f) => !MISSING.has(f) && isFork(f)));
const W = global; const UI = W.V7UI; const V7 = W.V7;
if (missing.length) warn('missing', 'assets', missing.join(', '));
if (!UI) { FAIL.push({ kind: 'load', where: 'ui7.js', msg: 'window.V7UI is not defined' }); finish(); }
if (!V7) FAIL.push({ kind: 'load', where: 'core7.js', msg: 'window.V7 is not defined' });
if (V7 && typeof V7.boot === 'function') { try { V7.boot(); } catch (e) { FAIL.push({ kind: 'boot', where: 'V7.boot()', msg: errMsg(e) }); } }

const CORPUS = corpusOf(W);
const isData = isDataIn(CORPUS);
const DEC_CORPUS = decisionsCorpus(W);
const isDecData = isDataIn(DEC_CORPUS, decisionsCorpus(W, true));
const isDataOnDecisions = (text, i, len) => isData(text, i, len) || isDecData(text, i, len);
const call = (fn, fb) => { try { const v = fn(); return v == null ? fb : v; } catch (e) { return fb; } };
const arr = (x) => (Array.isArray(x) ? x : []);
const has = (name) => !!V7 && typeof V7[name] === 'function';
function plantKeys() { return arr(call(() => V7.plants(), [])).map((p) => p && p.key).filter(Boolean); }
function plantState(key) { const p = arr(call(() => V7.plants(), [])).find((x) => x && x.key === key); return p ? p.state : null; }
const ownerOf = (pattern) => OWNER.get(pattern) || null;

/* ── what each route param names, how to sample it and how to tell that it exists ─────────────────────────── */
const CACHE = new Map();
const memo = (k, fn) => { if (!CACHE.has(k)) CACHE.set(k, fn()); return CACHE.get(k); };
function pick(list, groupOf, per) {
  const groups = new Map(); const out = [];
  for (const x of list) { if (!x || x.id == null) continue; const g = String(groupOf(x) || '?'); if (!groups.has(g)) groups.set(g, 0); if (groups.get(g) < per) { groups.set(g, groups.get(g) + 1); out.push(String(x.id)); } }
  return out;
}
const KIND_OF_LIT = { eq: 'eq', up: 'up', cg: 'cg', sensor: 'sensor', trigger: 'trigger', alert: 'trigger', issue: 'issue', task: 'task', templates: 'template',
  'eq-types': 'eqType', 'up-types': 'upType', 'plant-types': 'plantType', conditions: 'condition', flows: 'flow', 'root-causes': 'rootCause', decisions: 'decision', library: 'libCode', activity: 'plant', p: 'plant' };
function nodeIds(key) { return memo('nodes|' + key, () => new Set(arr(call(() => V7.nodes(key), [])).map((n) => n && String(n.id)))); }
function sensorIds(key) { return memo('sensors|' + key, () => new Set(arr(call(() => V7.sensors(key), [])).map((n) => n && String(n.id)))); }
function scheduleIds(key) { return memo('sched|' + key, () => new Set(arr(call(() => V7.schedules(key, {}), [])).map((n) => n && String(n.id)))); }
const SAMPLE = new Map();     // `${kind}|${plant}` → Set(ids)
function sampleOf(kind, key) {
  const k = `${kind}|${key || ''}`;
  if (SAMPLE.has(k)) return SAMPLE.get(k);
  let ids = [];
  if (kind === 'plant') ids = plantKeys();
  else if (kind === 'eq') ids = pick(arr(call(() => V7.equipment(key), [])), (e) => e.libType || e.type || e.typeName, 3);
  else if (kind === 'up') ids = pick(arr(call(() => V7.unitProcesses(key), [])), (u) => u.typeId || u.typeName, 3);
  else if (kind === 'cg') ids = pick(arr(call(() => V7.controlGroups(key), [])), () => 'cg', 3);
  else if (kind === 'sensor') ids = pick(arr(call(() => V7.sensors(key), [])), (s) => s.name || s.reading, 3);
  else if (kind === 'trigger') ids = pick(arr(call(() => V7.alerts(key, {}), [])), () => 'issue', 3).concat(pick(arr(call(() => V7.schedules(key, {}), [])), () => 'task', 3));
  else if (kind === 'issue') ids = pick(arr(call(() => V7.issues(key, {}), [])).slice().sort((a, b) => (a.status === 'closed') - (b.status === 'closed')), () => 'issue', 3);
  else if (kind === 'task') ids = pick(arr(call(() => V7.tasks(key, {}), [])), () => 'task', 3);
  else if (kind === 'template') ids = pick(arr(call(() => V7.templates({}), [])), (t) => t.ownerKey || (t.owner && `${t.owner.kind}:${t.owner.id || t.owner.code}`), 3);
  else if (kind === 'eqType') ids = pick(arr(call(() => V7.libTypes(), [])).map((t) => ({ ...t, id: t.code })), (t) => `${t.family}|${t.anchor}`, 3);
  else if (kind === 'upType') ids = pick(arr(call(() => V7.upTypes(), [])), (u) => u.stage, 3);
  else if (kind === 'plantType') ids = arr(call(() => V7.plantTypes(), [])).map((t) => t && String(t.id)).filter(Boolean);
  else if (kind === 'condition') ids = pick(arr(call(() => V7.conditions(), [])), () => 'c', 3);
  else if (kind === 'flow') ids = pick(arr(call(() => V7.flows(), [])), () => 'f', 3);
  else if (kind === 'rootCause') ids = pick(arr(call(() => V7.rootCauses(), [])), () => 'r', 3);
  else if (kind === 'decision') ids = arr(W.V7_DECISIONS).map((d) => d && d.id).filter(Boolean);
  else if (kind === 'libCode') { const ts = arr(call(() => V7.libTypes(), [])); const a = ts.find((t) => t.anchor); const b = ts.find((t) => !t.anchor); ids = [a, b].filter(Boolean).map((t) => t.code); }
  const set = new Set(ids); SAMPLE.set(k, set); return set;
}
function addSample(kind, key, id) { sampleOf(kind, key).add(String(id)); }
function exists(kind, key, id) {
  id = String(id);
  return memo(`ex|${kind}|${key}|${id}`, () => exists0(kind, key, id));
}
function exists0(kind, key, id) {
  switch (kind) {
    case 'plant': return plantKeys().includes(id);
    case 'eq': return has('nodes') ? nodeIds(key).has(id) : true;
    case 'up': return has('unitProcess') ? !!call(() => V7.unitProcess(key, id), null) : true;
    case 'cg': return has('controlGroup') ? !!call(() => V7.controlGroup(key, id), null) : true;
    case 'sensor': return has('sensors') ? sensorIds(key).has(id) : true;
    case 'trigger': return !!call(() => V7.alert(key, id), null) || scheduleIds(key).has(id) || (has('conditionOf') && !!call(() => V7.conditionOf(key, id), null));
    case 'issue': return has('issue') ? !!call(() => V7.issue(key, id), null) : true;
    case 'task': return has('task') ? !!call(() => V7.task(key, id), null) : true;
    case 'template': return has('template') ? !!call(() => V7.template(id), null) : true;
    case 'eqType': case 'libCode': return has('libType') ? !!call(() => V7.libType(id), null) : true;
    case 'upType': return has('upType') ? !!call(() => V7.upType(id), null) : true;
    case 'plantType': return has('plantTypes') ? arr(call(() => V7.plantTypes(), [])).some((t) => t && String(t.id) === id) : true;
    case 'condition': return has('conditions') ? arr(call(() => V7.conditions(), [])).some((t) => t && String(t.id) === id) : true;
    case 'flow': return has('flows') ? memo('flowIds', () => new Set(arr(call(() => V7.flows(), [])).map((t) => t && String(t.id)))).has(id) : true;
    case 'rootCause': return has('rootCauses') ? memo('rcIds', () => new Set(arr(call(() => V7.rootCauses(), [])).map((t) => t && String(t.id)))).has(id) : true;
    case 'decision': return !W.V7DEC || !!call(() => W.V7DEC.byId(id), null);
    default: return true;
  }
}
/* the objects a matched route names: [{kind, key, id}] (a library alias's code that names a section is not an object) */
const LIB_SECTIONS = new Set(['eq-types', 'up-types', 'templates', 'plant-types', 'conditions', 'flows', 'root-causes']);
function objectsOf(m) {
  const out = []; const segs = m.route.segs; const key = m.params.plant || m.params.key || null;
  segs.forEach((s, i) => {
    if (s.lit) return;
    const v = m.params[s.param]; if (v == null || v === '') return;
    const prev = i > 0 && segs[i - 1].lit ? segs[i - 1].lit : null;
    const kind = KIND_OF_LIT[prev] || (s.param === 'plant' ? 'plant' : null);
    if (!kind) return;
    if (kind === 'libCode' && LIB_SECTIONS.has(v)) return;
    out.push({ kind, key, id: String(v) });
  });
  return out;
}
/* a link is followed when every object it names was sampled, or is a condition Task's Trigger (there are few) */
function isSampled(m) {
  return objectsOf(m).every((o) => {
    if (o.kind === 'plant' || o.kind === 'decision' || o.kind === 'plantType') return true;
    if (sampleOf(o.kind, o.key).has(o.id)) return true;
    if (o.kind === 'trigger' && !call(() => V7.alert(o.key, o.id), null) && !scheduleIds(o.key).has(o.id) && has('conditionOf') && call(() => V7.conditionOf(o.key, o.id), null)) return true;
    return false;
  });
}
function expand(r) {
  let combos = [{ parts: [], bound: {} }];
  r.segs.forEach((s, i) => {
    const prevLit = i > 0 && r.segs[i - 1].lit ? r.segs[i - 1].lit : null;
    const next = [];
    for (const c of combos) {
      if (s.lit) { next.push({ parts: c.parts.concat(s.lit), bound: c.bound }); continue; }
      if (s.opt) next.push(c);
      const kind = KIND_OF_LIT[prevLit] || (s.param === 'plant' ? 'plant' : null);
      const key = c.bound.plant || null;
      const vals = kind ? [...sampleOf(kind, key)] : [];
      for (const v of vals) next.push({ parts: c.parts.concat(encodeURIComponent(v)), bound: Object.assign({}, c.bound, { [s.param]: v }) });
    }
    combos = next;
  });
  return combos.map((c) => c.parts.join('/'));
}

/* ── rendering and checks ───────────────────────────────────────────────────────────────────────────────── */
const STATS = new Map(); const RENDERED = new Set(); const CHECKED = new Set(); const QUEUE = []; const DEAD = new Map();
let pass = 'start'; let renders = 0; const TIMES = { render: 0, check: 0 };
const SEEN = { realTag: new Set(), fixLine: 0 };
const stat = (pattern) => { if (!STATS.has(pattern)) STATS.set(pattern, { n: 0, fail: 0, ms: 0, slow: '' }); return STATS.get(pattern); };
function planOwner(pathOnly) {
  const D = W.V7DEC;
  for (const f of Object.keys(ROUTE_PLAN)) for (const p of ROUTE_PLAN[f]) if (D && D.matchRoute ? D.matchRoute(p, pathOnly) : false) return f;
  return null;
}
const matchOf = (href) => memo('m|' + href, () => UI.match(href) || null);
function checkLinks(html, where, owner) {
  for (const href of links(html)) {
    if (href === '#' || href === '#/') { warn('link', where, `bare "${href}" link (use data-act or a route)`); continue; }
    if (!href.startsWith('#/')) continue;
    if (CHECKED.has(href + '@' + pass)) continue;
    CHECKED.add(href + '@' + pass);
    const m = matchOf(href);
    if (!m) { if (!DEAD.has(href)) DEAD.set(href, { where, owner, why: 'no route' }); continue; }
    const bad = objectsOf(m).find((o) => !exists(o.kind, o.key, o.id));
    if (bad) { if (!DEAD.has(href)) DEAD.set(href, { where, owner, why: `no ${bad.kind} "${bad.id}"${bad.key ? ' at ' + bad.key : ''}` }); continue; }
    if (!ARGS.crawl || pass !== 'start') continue;
    const p = href.slice(2);
    if (RENDERED.has(p)) continue;
    if (ARGS.only && !m.pattern.includes(ARGS.only)) continue;
    if (!isSampled(m)) continue;
    QUEUE.push(p);
  }
}
function checkHtml(html, where, pattern, owner, vis) {
  const onDecisions = /^decisions/.test(pattern || '');
  if (vis == null) vis = visibleText(withoutMarks(html));
  for (const f of scan(html, { text: vis, decisions: onDecisions, isData: onDecisions ? isDataOnDecisions : isData })) {
    if (f.kind === 'data-word' && onDecisions) { warn('quoted', where, `"${f.word}" quoted in a decision card`, f.ctx); continue; }
    if (f.kind === 'data-word') { warn('data-word', where, `"${f.word}" inside verbatim library or workbook text`, f.ctx); continue; }
    report(f.kind, where, `"${f.word}"`, f.ctx, owner);
  }
  for (const c of chipProblems(html, vis)) report(c.kind, where, c.msg, null, owner);
  checkLinks(html, where, owner);
}
/* a Commissioning plant's pages carry "Commissioning · nothing is sent"; a Live plant's pages never do */
const COMM = 'Commissioning · nothing is sent';
function checkPlantState(html, p, where, owner, vis) {
  const m = /^p\/([^/?]+)/.exec(p); if (!m) return;
  const st = plantState(decodeURIComponent(m[1])); if (!st) return;
  if (vis == null) vis = visibleText(withoutMarks(html));
  if (st === 'commissioning' && !vis.includes(COMM)) report('state', where, `a page of a Commissioning plant without "${COMM}"`, null, owner);
  if (st === 'live' && vis.includes(COMM)) report('state', where, `a page of a Live plant says "${COMM}"`, null, owner);
}
function renderOne(p) {
  if (RENDERED.has(p + '@' + pass)) return;
  RENDERED.add(p + '@' + pass); if (pass === 'start') RENDERED.add(p);
  const m = UI.match('#/' + p);
  if (!m) { warn('route', '#/' + p, 'no route matches'); return; }
  const st = stat(m.pattern);
  if (st.n >= ARGS.max) return;
  st.n++; renders++;
  const owner = ownerOf(m.pattern);
  W.location.hash = '#/' + p; W.location.href = 'http://localhost/v7/2/prototype.html#/' + p;
  const where = '#/' + p + (pass === 'start' ? '' : '  [' + pass + ']');
  consoleErrors.length = 0; capture = true;
  const t = performance.now(); let out; let err = null;
  try { out = m.route.fn(m.params); } catch (e) { err = e; }
  const ms = performance.now() - t; capture = false;
  st.total = (st.total || 0) + ms; TIMES.render += ms;
  if (ms > st.ms) { st.ms = ms; st.slow = p; }
  if (ms > 2500) warn('slow', where, `${Math.round(ms)} ms`);
  consoleErrors.splice(0).forEach((e) => warn('console', where, e));
  if (err) { st.fail++; report('throw', where, errMsg(err), null, owner); return; }
  if (typeof out !== 'string') { st.fail++; report('type', where, `renderFn returned ${out === null ? 'null' : typeof out}, not an html string`, null, owner); return; }
  if (!out.trim()) warn('empty', where, 'rendered an empty string');
  const before = FAIL.length; const tc = performance.now();
  const vis = visibleText(withoutMarks(out));
  checkHtml(out, where, m.pattern, owner, vis);
  checkPlantState(out, p, where, owner, vis);
  checkMarks(out, p, where, m.pattern);
  if (/Real plant graph/.test(vis)) SEEN.realTag.add(p.split('?')[0]);
  if (/Correct the survey, then re-run identification|Fix the survey, then re-run/.test(vis)) SEEN.fixLine++;
  TIMES.check += performance.now() - tc;
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
  for (const variant of (pass === 'start' ? ['1', '2'] : [v])) {
    let m;
    try { m = D.markerHtml(variant, p); } catch (e) { FAIL.push({ kind: 'marks', where, msg: `the decisions strip threw (prototype ${variant}): ${errMsg(e)}` }); continue; }
    if (typeof m !== 'string') { FAIL.push({ kind: 'marks', where, msg: `markerHtml returned ${m === null ? 'null' : typeof m}, not a string` }); continue; }
    if (variant === v) mine = m;
  }
  const strips = markStrips(html);
  if (/^decisions/.test(pattern || '')) { if (strips.length || mine) FAIL.push({ kind: 'marks', where, msg: 'a Decisions page carries the decisions strip' }); return; }
  if (!mine) { if (strips.length) FAIL.push({ kind: 'marks', where, msg: 'the page carries a strip that markerHtml does not give' }); return; }
  if (strips.length !== 1 || strips[0] !== mine) { FAIL.push({ kind: 'marks', where, msg: `${strips.length} strips on the page, want exactly the one markerHtml gives` }); return; }
  MARKS.pages++; if (pass === 'strip') { MARKS.fixture++; if (/class="dm dm-more"/.test(mine)) MARKS.more++; }
  const at = html.indexOf(mine); const head = html.indexOf('<header class="ph">'); const tabs = html.indexOf('<nav class="tabs"');
  if (head >= 0 && at < html.indexOf('</header>', head)) FAIL.push({ kind: 'marks', where, msg: 'the strip sits inside or before the page header' });
  if (tabs >= 0 && at > tabs) FAIL.push({ kind: 'marks', where, msg: 'the strip sits after the tabs' });
  for (const f of scan(mine, { ids: false, marks: true, isData: isDataOnDecisions })) {
    if (f.kind === 'data-word') { warn('quoted', where + ' (decisions strip)', `"${f.word}" quoted in a decision card`, f.ctx); continue; }
    FAIL.push({ kind: f.kind, where: where + ' (decisions strip)', msg: `"${f.word}"`, extra: f.ctx });
  }
}

const ROUTES = UI.routes();
if (ARGS.list) {
  for (const r of ROUTES) console.log(`${r.pattern.padEnd(36)} ${String(ownerOf(r.pattern) || '?').padEnd(16)} ${expand(r).length} sampled`);
  process.exit(0);
}

// every planned route is registered, by its own module, once
for (const f of Object.keys(ROUTE_PLAN)) for (const p of ROUTE_PLAN[f]) {
  if (!OWNER.has(p)) report('route', p, `the route is not registered (${f} should register it)`, null, f);
  else if (OWNER.get(p) !== f) report('route', p, `registered by ${OWNER.get(p)}, but it belongs to ${f}`, null, f);
}
DOUBLE.forEach(([p, a, b]) => FAIL.push({ kind: 'route', where: p, msg: `registered twice: by ${a} and by ${b}` }));

// the stylesheets: Base moved is the only chip with an amber fill
try {
  const css = {}; fs.readdirSync(ASSETS).filter((f) => /\.css$/.test(f)).forEach((f) => { css[f] = fs.readFileSync(path.join(ASSETS, f), 'utf8'); });
  const tokens = cssTokens(css['v7.css'] || '');
  const cssOwner = (f) => f.replace(/\.css$/, '.js');
  amberFillRules(css, tokens).forEach((r) => report('chip', r.file, `"${r.selector}" has an amber fill (${r.colour}); only the Base moved chip may`, null, cssOwner(r.file) === 'v7.js' ? 'ui7.js' : cssOwner(r.file)));
} catch (e) { FAIL.push({ kind: 'throw', where: 'stylesheets', msg: errMsg(e) }); }

// shell chrome (top bar + story panel)
for (const p of ['plants', 'p/digitalpaani', 'p/vedanta', 'p/vedanta/trigger/a_3f', 'p/manesar', 'library', 'deviations', 'decisions']) {
  let html = '';
  try { html = UI.chromeHtml(p); } catch (e) { FAIL.push({ kind: 'throw', where: 'shell ' + p, msg: errMsg(e) }); continue; }
  checkHtml(html, 'shell (top bar + story) at #/' + p, 'shell', 'ui7.js');
  if (typeof UI.samePlaceHref === 'function' && !html.includes(`href="${UI.samePlaceHref(p)}"`)) FAIL.push({ kind: 'shell', where: 'shell at #/' + p, msg: '"Same place in v7/1 →" does not follow the page' });
}
// the story's own links (and the decision cards' v7/2 places) resolve to a real page, and are always rendered
const PINNED = [];
try {
  for (const c of UI.chapters()) for (const h of [c.href].concat(c.also.map((a) => a.href))) PINNED.push([h, 'story chapter ' + c.n]);
  if (W.V7DEC && typeof W.V7DEC.linksFor === 'function') arr(W.V7_DECISIONS).forEach((d) => arr(call(() => W.V7DEC.linksFor(d, '2'), [])).forEach((l) => { if (l && l.route) PINNED.push([l.route, 'card ' + d.id]); }));
} catch (e) { FAIL.push({ kind: 'throw', where: 'story chapters', msg: errMsg(e) }); }
for (const [h, where] of PINNED) {
  const href = h[0] === '#' ? h : '#' + (h[0] === '/' ? '' : '/') + h;
  const m = UI.match(href);
  if (!m) { if (!DEAD.has(href)) DEAD.set(href, { where, owner: where.startsWith('story') ? 'ui7.js' : 'decisions7.js', why: 'no route' }); continue; }
  const bad = objectsOf(m).find((o) => !exists(o.kind, o.key, o.id));
  if (bad) { if (!DEAD.has(href)) DEAD.set(href, { where, owner: where.startsWith('story') ? 'ui7.js' : 'decisions7.js', why: `no ${bad.kind} "${bad.id}"` }); continue; }
  objectsOf(m).forEach((o) => { if (o.kind !== 'plant') addSample(o.kind, o.key, o.id); });
  if (!ARGS.only || m.pattern.includes(ARGS.only)) QUEUE.push(href.slice(2));
}

// pass 1: sampled params, then the crawl
for (const r of ROUTES) { if (ARGS.only && !r.pattern.includes(ARGS.only)) continue; if (/^t\//.test(r.pattern)) continue; for (const p of expand(r)) QUEUE.push(p); }
while (QUEUE.length && renders < 20000) renderOne(QUEUE.shift());
pass1 = { renders, ms: performance.now() - T0 };

// unknown route falls back to All Plants
try { const html = UI.renderPath('#/no/such/page'); if (!/All Plants/.test(visibleText(html))) FAIL.push({ kind: 'router', where: '#/no/such/page', msg: 'an unknown route did not fall back to All Plants' }); } catch (e) { FAIL.push({ kind: 'throw', where: '#/no/such/page', msg: errMsg(e) }); }

// DigitalPaani is tagged "Real plant graph"; fixes go back to the survey
if (!ARGS.only) {
  for (const p of ['plants', 'p/digitalpaani']) if (!SEEN.realTag.has(p)) report('tag', '#/' + p, 'DigitalPaani is not tagged "Real plant graph" here', null, ownerOf(UI.match('#/' + p) ? UI.match('#/' + p).pattern : '') || 'ui7.js');
  if (!SEEN.fixLine) report('words', 'every page', 'no page says how fixes go back to the survey ("Correct the survey, then re-run identification" or "Fix the survey, then re-run")', null, 'object7.js');
}

// pass 2: after the story clock moves on a day
if (ARGS.advance && V7 && typeof V7.advance === 'function') {
  const t2 = performance.now(); const r0 = renders;
  let res = null;
  try { res = V7.advance(1440); } catch (e) { FAIL.push({ kind: 'throw', where: 'V7.advance(1440)', msg: errMsg(e) }); }
  CACHE.clear();
  pass = '+1 day';
  const cap = ARGS.max; ARGS.max = cap * 2;
  for (const r of ROUTES) {
    if (ARGS.only && !r.pattern.includes(ARGS.only)) continue;
    if (/^t\//.test(r.pattern)) continue;
    if (!r.segs.some((s) => !s.lit)) { renderOne(r.pattern); continue; }
    expand(r).slice(0, 150).forEach(renderOne);
  }
  for (const p of ['plants', 'p/digitalpaani', 'p/vedanta', 'p/manesar', 'p/bawal']) try { checkHtml(UI.chromeHtml(p), 'shell [+1 day]', 'shell', 'ui7.js'); } catch (e) { FAIL.push({ kind: 'throw', where: 'shell [+1 day]', msg: errMsg(e) }); }
  ARGS.max = cap;
  pass2 = { renders: renders - r0, ms: performance.now() - t2, res: res ? Object.keys(res).filter((k) => Array.isArray(res[k])).map((k) => `${k} ${res[k].length}`).join(', ') : '' };
}

// pass 3: the decisions strip on a sample of every route (the live cards' own places; a fixture only if no card has any)
if (W.V7DEC && Array.isArray(W.V7_DECISIONS) && W.V7_DECISIONS.length) {
  const cards = W.V7_DECISIONS; const t3 = performance.now(); const r0 = renders;
  const fixture = !cards.some((d) => d && d.where);
  const saved = cards.map((d) => (d && Object.prototype.hasOwnProperty.call(d, 'where') ? { v: d.where } : null));
  if (fixture) {
    cards.forEach((d, k) => {
      if (!d) return;
      const ps = arr(d.links).map((l) => String((l && (l.href72 || l.href)) || '').replace(/^#\/?/, '').split('?')[0]).filter(Boolean);
      d.where = { 1: ps, 2: ps.concat(k % 3 === 0 ? ps.map((x) => x.replace(/^p\/[^/]+/, 'p/:plant')) : []) };
    });
  }
  pass = 'strip'; const cap = ARGS.max; ARGS.max = Infinity;
  try {
    for (const r of ROUTES) {
      if (ARGS.only && !r.pattern.includes(ARGS.only)) continue;
      if (/^t\//.test(r.pattern)) continue;
      if (!r.segs.some((s) => !s.lit)) { renderOne(r.pattern); continue; }
      expand(r).slice(0, 40).forEach(renderOne);
    }
  } finally {
    ARGS.max = cap;
    if (fixture) cards.forEach((d, k) => { if (!d) return; if (saved[k]) d.where = saved[k].v; else delete d.where; });
  }
  pass3 = { renders: renders - r0, ms: performance.now() - t3, fixture };
}

// dead links, grouped by shape (#/p/*/trigger/*) so a missing module reads as one line; a link into a module that is
// missing or still v7/1's, or written by one, is pending
const KEYS = new Set(plantKeys());
const AFTER_ID = new Set(['eq', 'up', 'cg', 'sensor', 'trigger', 'alert', 'issue', 'task', 'templates', 'eq-types', 'up-types', 'plant-types', 'conditions', 'flows', 'root-causes', 'library', 'decisions', 'activity']);
function shape(href) {
  const [p, q] = href.slice(2).split('?');
  const segs = p.split('/').map((s, i, a) => (KEYS.has(s) || (i > 0 && AFTER_ID.has(a[i - 1])) ? '*' : s));
  return '#/' + segs.join('/') + (q ? '?…' : '');
}
const SHAPES = new Map();
DEAD.forEach((d, href) => {
  const target = planOwner(href.slice(2).split('?')[0]);
  const owner = (target && (MISSING.has(target) || PENDING.has(target))) ? target : d.owner;
  const k = shape(href) + '|' + d.why.replace(/"[^"]*"/, '"…"');
  if (!SHAPES.has(k)) SHAPES.set(k, { n: 0, eg: [], where: d.where, owner, why: d.why });
  const s = SHAPES.get(k); s.n++; if (s.eg.length < 2) s.eg.push(href);
});
SHAPES.forEach((s, k) => report('dead-link', s.where, `${k.split('|')[0]}  (${s.n} link${s.n > 1 ? 's' : ''}, e.g. ${s.eg.join(', ')}): ${s.why}`, null, s.owner));
const never = UI.routes().filter((r) => !STATS.has(r.pattern) && !/^t\//.test(r.pattern) && (!ARGS.only || r.pattern.includes(ARGS.only)));
never.forEach((r) => warn('unrendered', r.pattern, 'no sampled value rendered this route'));
const soft = arr(UI._soft);
if (soft.length) warn('soft', 'V7 calls caught by ui7', [...new Set(soft)].slice(0, 6).join(' | '));
finish();

function finish() {
  const out = [];
  const t = (performance.now() - T0) / 1000;
  out.push(`v7/2 smoke · ${loaded.length}/${ORDER.length} assets loaded (order from ${ORDER_FROM})${missing.length ? ' · missing: ' + missing.join(', ') : ''}`);
  if (PENDING.size || MISSING.size) out.push(`pending (${ARGS.strict ? 'counted as failures; --lenient reports them as warnings' : 'reported as warnings, as --lenient asks'}): ${[...PENDING].map((f) => f + ' (still v7/1\'s)').concat([...MISSING].map((f) => f + ' (not written)')).join(', ')}`);
  if (UI) {
    out.push(`time: rendering ${(TIMES.render / 1000).toFixed(1)} s · checking ${(TIMES.check / 1000).toFixed(1)} s`);
    out.push(`routes: ${STATS.size} rendered of ${UI.routes().length} registered · pass 1: ${pass1Text()}${pass2Text()}`);
    if (pass3) out.push(`decisions strip: on ${MARKS.pages - MARKS.fixture} page renders from the live cards · pass 3 (${pass3.fixture ? 'fixture from each card\'s links' : 'the live cards'}): ${pass3.renders} renders, ${MARKS.fixture} with a strip, ${MARKS.more} with "+n more"`);
    const rows = [...STATS.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const w = Math.max(10, ...rows.map(([p]) => p.length));
    rows.forEach(([p, s]) => out.push(`  ${p.padEnd(w)}  ${String(ownerOf(p) || '').padEnd(14)} ${String(s.n).padStart(4)}  ${s.fail ? ('FAIL ' + s.fail).padEnd(9) : 'ok'.padEnd(9)} slowest ${Math.round(s.ms)} ms · total ${Math.round(s.total || 0)} ms`));
  }
  const lim = ARGS.verbose ? Infinity : 25;
  const show = (title, list) => {
    if (!list.length) return;
    const g = new Map(); list.forEach((x) => { g.set(x.kind, (g.get(x.kind) || 0) + 1); });
    const seen = new Map();
    list.forEach((x) => { const key = x.kind + '|' + x.msg + '|' + (x.extra || ''); if (!seen.has(key)) seen.set(key, { x, n: 0 }); seen.get(key).n++; });
    out.push(`${title} (${list.length}, ${seen.size} distinct): ` + [...g.entries()].map(([k, v]) => `${k} ${v}`).join(', '));
    [...seen.values()].slice(0, lim).forEach(({ x, n }) => out.push(`  [${x.kind}] ${x.where}${n > 1 ? `  (+${n - 1} more)` : ''}${x.owner ? `  {${x.owner}}` : ''}\n      ${x.msg}${x.extra ? '\n      ' + x.extra : ''}`));
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
