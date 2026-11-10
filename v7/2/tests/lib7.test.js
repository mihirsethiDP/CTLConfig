#!/usr/bin/env node
/* v7/2 · lib7.test.js — headless test for the library pages (lib7.js). Node only, no dependencies.
   Loads the whole v7/2 app through tests/load72.js, then:
     1. the library home and every list: counts equal templates(), upTypes(), libTypes(), conditions(), flows(), rootCauses()
        and the plant types; every route renders without an error;
     2. chapter 1 of the story: Blower's Motor current card with its limit rules and "Resolves at" lines, the banner on every
        type that is a unit process in the plant graph, Moving bed bioreactor's Tasks and Issue types, the Agitator's constant
        flag, and DO low's template page with the Downstream table before any edit;
     3. chapter 10 through the registered action handlers: the MLSS low edit, its Downstream lines and totals, the suggested
        kind, a publish refused without a note, the publish and its toast and Activity; a Forced try (only choice, a reason
        needed, discarded); a cadence change with the count-from choice; the editor in a sheet;
     4. Promote ("Make it the library default" fills the template and its publish marks the override Promoted), a tier promote
        on a type page, Merge into a type, pins (a reason needed; Unpin), lifting a Forced change;
     5. on every page: no banned word, no ID, no junk, and every library link lands on a real library object.
   Usage: TZ=Asia/Calcutta node tests/lib7.test.js [-v] */
'use strict';
const L = require('./load72.js');

const VERBOSE = process.argv.includes('-v');
const W = L.window; const V = L.V7; const UI = L.V7UI; const C = L.CTL;
let pass = 0; const fails = []; const warns = [];
function ok(cond, msg, extra) { if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + msg); } else { fails.push(msg + (extra ? '  ← ' + extra : '')); console.log('  FAIL ' + msg + (extra ? '  ← ' + String(extra).slice(0, 400) : '')); } }
function warn(msg) { warns.push(msg); if (VERBOSE) console.log('  warn ' + msg); }
if (!V || !UI || !W.V7LIB) { console.log('lib7 test: the app did not load', L.missing, L.errors.map((e) => e.file)); process.exit(1); }
const LIB = W.V7LIB;
console.log(`lib7 test · loaded ${L.loaded.length} assets${L.missing.length ? ' · missing: ' + L.missing.join(', ') : ''}${L.errors.length ? ' · failed: ' + L.errors.map((e) => e.file).join(', ') : ''}`);

/* ── words on screen: the v7/2 list, with verbatim library and workbook text exempt ───────────────────────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', rarr: '→', hellip: '…', times: '×', rsaquo: '›' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m));
const MARKS = /<aside class="dec-mark"[\s\S]*?<\/aside>/g;
function text(html) { return decode(String(html || '').replace(MARKS, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
const CI = (list) => list.map((x) => (typeof x === 'string' ? new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : x));
const BANNED = [
  /\bmachines?\b/i, /\bassets?\b/i, /\bwidgets?\b/i, /\bestates?\b/i, /\bportfolio\b/i, /\bcustom\b/i, /\bdetach(ed)?\b/i, /\bfork(ed|s)?\b/i,
  /\bdiverg(e|ed|es|ing|ence)\b/i, /\bstale\b/i, /\bdrift\b/i, /\balerts?\b/i, /\balerting\b/i, /(?<!false )\balarms?\b/i, /\binsights?\b/i, /\bschedules?\b/i,
  /\bSCADA\b/i, /\bdatabase\b/i, /\bthe form\b/i, /\bhold time\b/i, /\bdebounce\b/i, /\bobservation frequency\b/i, /\bprocedures?\b/i, /\bworkflows?\b/i,
  /\bSOPs?\b/i, /\bremediation\b/i, /\bSite Admin\b/i, /\bSME\b/i, /\bSupervisor\b/i, /\bonboarding\b/i, /\bshadow\b/i, /\btest alert\b/i, /\bdry run\b/i,
  /\bdetect\b/i, /\bpriority\b/i, /(?<!criticality )\btier\b/i, /\bCritical\b|\bEssential\b|\bStandard\b/, /(?<!limit |no )\brules?\b/i, /\bsurvey type\b/i,
  /\bunit operations?\b/i, /\b(functional|process) stages?\b/i, /\bsub-assets?\b/i,
  ...CI(['Changed here', 'Library changed since', 'Differences from the library', 'From the library', 'From the SCADA form', 'No limits yet', 'What SCADA found',
    'What the library brings', 'Where it lands', 'Not for this plant', 'On trial', 'Mostly short', 'Tuned for this plant', 'For now, until', 'Reason not recorded',
    'Not in the library', 'Suggest for the library', 'Who is told', 'User Center', 'Phone view', 'Review due', 'no call, no hooter', 'told to the Leads']),
  /Back to the library value/, /(?<!Persistence · )must hold for/i, /(?<!Clearing · )must clear for/i,
];
const IDS = [/\b(CM|C|O)-\d{1,2}\b/, /(?<![-\w])E[1-5]\b/, /(?<![-\w])W\d{1,2}[a-d]?\b/, /(?<![-\w])P[1-6]\b/, /(?<![-\w])S[1-8]\b/, /\bV7-\d+\b/, /\bV72-\d+\b/,
  /\bPRD\b/, /§\s*\d/, /\bAC-?\d+\b/, /\.md\b/, /\.html\b/, /(?<![-\w])D\d{1,2}\b/];   /* the smoke run adds the internal names */
const JUNK = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Invalid Date/, /\$\{/];
/* verbatim library and workbook text (names of types, readings, Issue types, flows, root causes, Tasks) */
const corpus = (() => {
  const parts = []; const seen = new Set();
  const walk = (x, d) => { if (x == null || d > 9) return; if (typeof x === 'string') { if (x.length > 3) parts.push(x.replace(/\s+/g, ' ')); return; } if (typeof x !== 'object' || seen.has(x)) return; seen.add(x); if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1)); else Object.keys(x).forEach((k) => walk(x[k], d + 1)); };
  ['ISSUES', 'ISSUE_TASKS', 'SEED', 'CATALOGUE', 'READINGS', 'PLANT_PROFILES', 'NEXT_PHASE_FLOWS', 'NEXT_PHASE_CAUSES', 'RCA_MAPS', 'FORM_RULES', 'DB_PALETTE'].forEach((g) => walk(W[g], 0));
  if (C && C.S && C.S.lib) { walk(C.S.lib.flows, 0); walk(C.S.lib.causes, 0); walk(C.S.lib.standardSets, 0); }
  return parts.join('\n');
})();
function isData(t, i, len) {
  const left = t.slice(Math.max(0, i - 16), i + len).trim(); const right = t.slice(i, i + len + 16).trim();
  return (left.length > len + 3 && corpus.includes(left)) || (right.length > len + 3 && corpus.includes(right)) || corpus.includes(t.slice(Math.max(0, i - 6), i + len + 6));
}
function scan(html) {
  const t = text(html); const out = [];
  const look = (re, kind, data) => { const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); let m; while ((m = g.exec(t))) { if (!data || !isData(t, m.index, m[0].length)) { out.push(`${kind} "${m[0]}" in …${t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)}…`); return; } if (!m[0]) g.lastIndex++; } };
  BANNED.forEach((re) => look(re, 'banned', true)); IDS.forEach((re) => look(re, 'id', true)); JUNK.forEach((re) => look(re, 'junk', false));
  return out;
}

/* ── rendering, links and handlers ──────────────────────────────────────────────────────────────────────── */
const libRoutes = new Set(['library', 'library/eq-types', 'library/eq-types/:code/:tab?', 'library/up-types', 'library/up-types/:id/:tab?', 'library/templates', 'library/templates/:id',
  'library/plant-types', 'library/plant-types/:id/:tab?', 'library/conditions/:id?', 'library/flows/:id?', 'library/root-causes/:id?', 'library/:code/:tab?']);
function realLibObject(m) {
  const p = m.params || {};
  switch (m.pattern) {
    case 'library/eq-types/:code/:tab?': return !!V.libType(p.code);
    case 'library/up-types/:id/:tab?': return !!V.upTypeView(p.id);
    case 'library/templates/:id': return !!V.template(p.id);
    case 'library/plant-types/:id/:tab?': return !!V.plantTypeView(p.id);
    case 'library/conditions/:id?': return !p.id || !!V.condition(p.id);
    case 'library/flows/:id?': return !p.id || !!V.flow(p.id);
    case 'library/root-causes/:id?': return !p.id || !!V.rootCause(p.id);
    case 'library/:code/:tab?': return !!V.libType(p.code);
    default: return true;
  }
}
function hrefsOf(html) { const out = new Set(); const re = /\s(?:href|data-href)\s*=\s*"([^"]*)"/g; let m; while ((m = re.exec(String(html || '')))) { const v = decode(m[1]); if (v[0] === '#') out.add(v); } return [...out]; }
const pages = [];
function render(hash, o) {
  const h = L.render(hash);
  pages.push([hash, h]);
  ok(typeof h === 'string' && h.length > 200 && !/This page could not be shown/.test(h), `renders: ${hash}`);
  const bad = scan(h); ok(!bad.length, `words on screen: ${hash}`, bad.join(' | '));
  if (!(o && o.noLinks)) hrefsOf(h).forEach((href) => {
    const m = UI.match(href);
    if (/^#\/library\b/.test(href)) ok(!!m && libRoutes.has(m.pattern) && realLibObject(m), `link lands on a library page: ${href} (on ${hash})`);
    else if (!m) warn(`no route for ${href} on ${hash}`);
  });
  return h;
}
function el(attrs, extra) { return Object.assign({ getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null), hasAttribute: (k) => Object.prototype.hasOwnProperty.call(attrs, k), closest: () => null, type: 'text', tagName: 'INPUT' }, extra || {}); }
const act = (name, attrs, extra) => { const fn = UI._handlers[name]; if (!fn) throw new Error('no handler ' + name); return fn(el(attrs || {}, extra)); };
const lastToast = () => String((UI._last && UI._last.toast) || '');
const lastModal = () => (UI._last && UI._last.modal) || {};
function confirmLast() { const m = lastModal(); const id = /data-id="(c\d+)"/.exec(m.foot || ''); if (!id) throw new Error('no confirm open'); return UI._handlers['ui:confirm'](el({ 'data-id': id[1] })); }
const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;
const has = (t, s) => t.indexOf(s) >= 0;
const allActivity = () => V.activity({}).filter((a) => !a.plant);
const plantActivity = (k) => V.activity({ plant: k });

/* ── 0. routes and acts ─────────────────────────────────────────────────────────────────────────────────── */
{
  const pats = UI.routes().map((r) => r.pattern);
  libRoutes.forEach((p) => ok(pats.filter((x) => x === p).length === 1, `route registered once: ${p}`));
  ok(!pats.includes('differences') || L.loaded.includes('ledger7.js'), 'the library registers no Differences page of its own');
  ['lib:q', 'lib:q-clear', 'lib:owner', 'tpl:mode', 'tpl:param', 'tpl:field', 'tpl:save', 'tpl:sheet', 'tpl:pubkind', 'tpl:pubfield', 'tpl:countfrom', 'tpl:publish', 'tpl:discard',
    'tpl:lift', 'tpl:lift-field', 'tpl:lift-save', 'tpl:typepub', 'pin:open', 'pin:field', 'pin:save', 'pin:unpin'].forEach((a) => ok(typeof UI._handlers[a] === 'function', `act handled: ${a}`));
  ok(!Object.keys(UI._handlers).some((a) => /^lib:(revert|keep|suggest|publish|discard)/.test(a)), "v7/1's Differences and type-publish acts are gone");
}

/* ── 1. the library home and the lists ──────────────────────────────────────────────────────────────────── */
{
  const tpls = V.templates({}); const fl = V.flows();
  const h = render('#/library'); const t = text(h);
  ok(has(t, `Plant types ${V.plantTypes().length}`), 'home: Plant types count', t.slice(0, 300));
  ok(has(t, `Unit-process types ${V.upTypes().length}`), 'home: Unit-process types count');
  ok(has(t, `Equipment types ${V.libTypes().length}`), 'home: Equipment types count');
  ok(has(t, `Templates ${tpls.length} (${tpls.filter((x) => x.kind === 'trigger').length} Trigger · ${tpls.filter((x) => x.kind === 'task').length} Task)`), 'home: Templates count with Trigger and Task');
  ok(has(t, `Conditions ${V.conditions().length}`), 'home: Conditions count');
  ok(has(t, `Flows ${fl.length}`), 'home: Flows count');
  ok(has(t, `Root causes ${V.rootCauses().length}`), 'home: Root causes count');
  ok(/^Library The shared definitions every plant follows\./.test(t), 'home: title and sub');
  ok(!/class="card[^"]*lb-drafts/.test(h), 'home: no Drafts strip at seed');
  ok(!/next phase/i.test(t), "home: v7/1's next-phase box is gone");
  act('lib:q', { 'data-scope': 'home' }, { value: 'blower' });
  const hs = render('#/library'); const ts = text(hs);
  ok(has(ts, 'Search results') && has(ts, 'Blower') && /href="#\/library\/eq-types\/BLW"/.test(hs), 'home search finds the Blower type');
  act('lib:q-clear', { 'data-scope': 'home' }); ok(!has(text(render('#/library')), 'Search results'), 'home search clears');
}
{
  const types = V.libTypes(); const h = render('#/library/eq-types');
  ok((h.match(/data-href="#\/library\/eq-types\/[^"]+"/g) || []).length === types.length, 'equipment types: one row per type', types.length);
  ok((text(h).match(/A unit process sits on it/g) || []).length === types.filter((x) => x.anchor).length + 1, 'equipment types: every anchor type is marked (and the filter chip)');
  ok(types.filter((x) => x.anchor).length + types.filter((x) => !x.anchor).length === types.length, 'anchor and equipment types partition the list');
  const ha = render('#/library/eq-types?show=anchor');
  ok((ha.match(/data-href="#\/library\/eq-types\/[^"]+"/g) || []).length === types.filter((x) => x.anchor).length, 'equipment types: the anchor filter');
  act('lib:q', { 'data-scope': 'eq' }, { value: 'blower' }); const hq = render('#/library/eq-types');
  ok(/>Blower</.test(hq) && !/>Agitator</.test(hq), 'equipment types: search narrows the list'); act('lib:q-clear', { 'data-scope': 'eq' });
}
{
  const ups = V.upTypes(); const h = render('#/library/up-types'); const t = text(h);
  ok((h.match(/data-href="#\/library\/up-types\/[^"]+"/g) || []).length === ups.length, 'unit-process types: one row per type', ups.length);
  const mb = ups.find((u) => u.id === 'mbbr');
  ok(mb && has(t, `${mb.name} · ${mb.stageLabel} · ${mb.plants.map((p) => `${p.name} ${p.count}`).join(' · ')}`), 'unit-process types: "Moving bed bioreactor · Secondary · DigitalPaani 5" from the core', mb && mb.plants);
  const stages = [...new Set(ups.map((u) => u.stageLabel))]; ok(stages.every((s) => /<h2>/.test(h) && h.indexOf(`<h2>${s}</h2>`) >= 0), 'unit-process types: grouped by stage');
}
{
  const all = V.templates({}); const h = render('#/library/templates');
  const rows = (x) => (x.match(/<tr class="is-link[^"]*" data-href="#\/library\/templates\/[^"]+"/g) || []).length;
  ok(rows(h) === all.length, 'templates: one row per template', `${rows(h)} vs ${all.length}`);
  ok(rows(render('#/library/templates?kind=trigger')) === all.filter((x) => x.kind === 'trigger').length, 'templates: kind filter Trigger');
  ok(rows(render('#/library/templates?kind=single')) === all.filter((x) => x.singleUse).length, 'templates: kind filter Single-use');
  const own = V.templates({ owner: 'up:activated-sludge' });
  ok(rows(render('#/library/templates?owner=up%3Aactivated-sludge')) === own.length && own.length > 0, 'templates: owner filter');
  act('lib:owner', { 'data-kind': 'task' }, { value: 'eq:BLW' }); ok(/^#\/library\/templates\?kind=task&owner=eq%3ABLW$/.test(W.location.hash), 'templates: the owner select goes to its filter', W.location.hash);
  act('lib:q', { 'data-scope': 'tpl' }, { value: 'mlss' }); const hq = render('#/library/templates');
  ok(rows(hq) === all.filter((x) => [x.name, x.ownerName, x.reading || ''].some((s) => String(s).toLowerCase().includes('mlss'))).length && rows(hq) > 0, 'templates: search');
  act('lib:q-clear', { 'data-scope': 'tpl' });
}
{
  const h = render('#/library/plant-types'); const pts = V.plantTypes();
  ok(pts.every((p) => has(text(h), p.name) && h.indexOf(`#/library/plant-types/${p.id}`) >= 0), 'plant types: each listed');
  pts.forEach((p) => {
    ['tasks', 'types', 'plants'].forEach((tab) => render(`#/library/plant-types/${p.id}/${tab}`));
    const ht = text(render(`#/library/plant-types/${p.id}`));
    ok(has(ht, p.chipText) && p.templates.every((x) => has(ht, x.name)), `plant type ${p.name}: chip and every round template`);
  });
}
{
  const conds = V.conditions(); const h = render('#/library/conditions'); const t = text(h);
  ok(has(t, "A Condition is a reusable test on a reading. Its threshold is set by each template's limit rule; edit it on the template."), 'conditions: the sub line');
  ok(conds.every((c) => has(t, c.title) && has(t, c.usedByText)), 'conditions: each with "Used by"');
  conds.slice(0, 4).forEach((c) => { const hd = text(render(`#/library/conditions/${c.id}`)); ok(c.uses.every((u) => has(hd, u.ruleText)), `condition ${c.title}: every use`); });
  ok(/No such condition/.test(render('#/library/conditions/nope', { noLinks: true })), 'conditions: unknown id');
}
{
  const fl = V.flows(); const h = render('#/library/flows'); const t = text(h);
  ok(has(t, 'Diagnostic flows') && has(t, 'Action flows') && (h.match(/data-href="#\/library\/flows\/[^"]+"/g) || []).length === fl.length, 'flows: both kinds, one row per flow');
  const f = V.flow('f_lowdo'); const hd = text(render('#/library/flows/f_lowdo'));
  ok(f.steps.every((s) => has(hd, s.text)) && has(hd, `Version ${f.version}`) && has(hd, 'Diagnostic flow'), 'flow page: every step, version and kind');
  const act1 = fl.find((x) => x.kind !== 'diagnostic'); render(`#/library/flows/${act1.id}`);
  act('lib:q', { 'data-scope': 'flow' }, { value: 'low do' }); ok((render('#/library/flows').match(/data-href="#\/library\/flows\//g) || []).length === fl.filter((x) => x.name.toLowerCase().includes('low do')).length, 'flows: search'); act('lib:q-clear', { 'data-scope': 'flow' });
}
{
  const rc = V.rootCauses(); const h = render('#/library/root-causes');
  ok((h.match(/data-href="#\/library\/root-causes\/[^"]+"/g) || []).length === rc.length, 'root causes: one row per cause');
  const c = V.rootCause('c_intake') || V.rootCause(rc[0].id); const hd = text(render(`#/library/root-causes/${c.id}`));
  ok(has(hd, c.name) && (!c.fix || has(hd, V.flow(c.fix).name)), 'root cause page: name and its fix');
}

/* ── 2. chapter 1 · the library ─────────────────────────────────────────────────────────────────────────── */
function typeChecks(label, html, view, kind) {
  const t = text(html);
  ok(has(t, view.chipText || `${kind === 'up' ? 'Unit-process' : 'Equipment'} type · v${view.version}`), `${label}: version chip`);
  ok(['Readings', 'Issues', 'Tasks', 'Details'].every((x) => new RegExp(`role="tab"[^>]*>${x}<`).test(html) || new RegExp(`>${x}</a>`).test(html)), `${label}: tabs Readings · Issues · Tasks · Details`);
  return t;
}
function blowerChecks(label, html) {
  const blw = V.libType('BLW'); const t = typeChecks(label, html, blw, 'eq');
  const mc = blw.readings.find((r) => r.name === 'Motor current'); const d = mc.dirs[0];
  ok(has(t, d.title) && d.title === 'Motor current high v1', `${label}: the "Motor current high v1" card`, d.title);
  ok(has(t, d.rulesText), `${label}: limit rules "${d.rulesText}"`);
  ok(has(t, 'Resolves at:') && d.resolvesAt.length > 0 && d.resolvesAt.every((x) => has(t, x.text)), `${label}: every "Resolves at" line`, d.resolvesAt.map((x) => x.text).join(' | '));
  ok(d.resolvesAt.some((x) => x.kind === 'override') && d.resolvesAt.some((x) => x.kind === 'needs'), `${label}: a plant that keeps its own value and a plant that needs the sensor`);
}
{
  const h = render('#/library/eq-types/BLW'); const t = text(h);
  ok(/<h1>Blower<\/h1>/.test(h), 'Blower: header');
  if (LIB._state.last.type === 'lib7') blowerChecks('Blower', h);
  else { ok(has(t, 'Equipment type · v') && /class="lb-aside"/.test(h), 'Blower (object page): version chip and the library aside'); warn('Blower page rendered by object7: chapter 1 card text checked on the fallback page below'); }
  blowerChecks('Blower (the library page itself)', LIB._typeFallback('eqType', V.libType('BLW'), 'readings', LIB.downstreamAside({ kind: 'eqType', code: 'BLW' }), {}));
  ['issues', 'tasks', 'details'].forEach((tab) => render(`#/library/eq-types/BLW/${tab}`));
  const ht = text(render('#/library/eq-types/BLW/tasks')); ok(V.libType('BLW').schedules.every((s) => has(ht, s.name)), 'Blower Tasks tab: every Task template');
}
{
  /* every type that is a unit process in the plant graph shows the banner with links to its unit-process types */
  const anchors = V.libTypes().filter((x) => x.anchor);
  anchors.forEach((a) => {
    const lt = V.libType(a.code); const h = render(`#/library/eq-types/${a.code}`); const t = text(h);
    const bannerOk = has(t, `Every ${lt.typeName} in the plant graph is a unit process. Its readings, Triggers, Tasks and Issues are on the unit-process type:`)
      && lt.movedToTypes.length > 0 && lt.movedToTypes.every((m) => h.indexOf(`href="#/library/up-types/${m.id}"`) >= 0 && has(t, m.name));
    ok(bannerOk, `anchor ${lt.typeName}: banner with links to ${lt.movedToTypes.map((m) => m.name).join(', ')}`);
  });
  const fb = LIB._typeFallback('eqType', V.libType('MBBR'), 'readings', '', {});
  ok(has(text(fb), 'Every MBBR in the plant graph is a unit process.') && /href="#\/library\/up-types\/mbbr"/.test(fb), 'MBBR (the library page itself): the banner and its link');
}
{
  /* Moving bed bioreactor carries the same Task templates and Issue types v7/1 shows on MBBR */
  const mbbrName = V.libType('MBBR').typeName;
  const set = C.S.lib.standardSets.find((s) => s.type === mbbrName && !s.upType);
  const up = V.upTypeView('mbbr');
  ok(up.schedules.length === set.schedules.length && up.schedules.length > 0, 'Moving bed bioreactor: as many Task templates as the MBBR set', `${up.schedules.length} vs ${set.schedules.length}`);
  ok(up.issues.length === V.issueTypes(mbbrName).length && up.issues.length > 0, 'Moving bed bioreactor: the same Issue types as MBBR', `${up.issues.length}`);
  const ht = text(render('#/library/up-types/mbbr/tasks'));
  ok(set.schedules.every((s) => has(ht, s.name)), "Moving bed bioreactor Tasks tab: every one of MBBR's Tasks");
  const hi = text(render('#/library/up-types/mbbr/issues'));
  ok(V.issueTypes(mbbrName).every((i) => has(hi, i.name)), "Moving bed bioreactor Issues tab: every one of MBBR's Issue types");
  const hd = render('#/library/up-types/mbbr/details'); typeChecks('Moving bed bioreactor', hd, up, 'up');
  ['readings'].forEach((tab) => render(`#/library/up-types/mbbr/${tab}`));
  const fbd = text(LIB._typeFallback('upType', up, 'details', '', {}));
  ok(has(fbd, 'Identified from') && has(fbd, 'Expected participants') && has(fbd, `Content first copied from ${up.contentFromName}`), 'unit-process type Details: identified from, participants, content first copied from');
  V.upTypes().forEach((u) => render(`#/library/up-types/${u.id}`));
}
{
  const ag = V.libType('OS_TANK_AG'); const d = ag.readings.find((r) => r.name === 'Motor current').dirs[0];
  const check = (label, html) => { const t = text(html); ok(has(t, d.title) && has(t, d.rulesText) && has(t, d.chip.text) && has(t, 'This scales with the plant. Use a design parameter?') && has(t, 'Use a design parameter'), `${label}: "${d.rulesText}", "${d.chip.text}" and the constant flag`); };
  const h = render('#/library/eq-types/OS_TANK_AG');
  if (LIB._state.last.type === 'lib7') check('Agitator', h); else ok(has(text(h), 'Equipment type · v'), 'Agitator (object page): version chip');
  check('Agitator (the library page itself)', LIB._typeFallback('eqType', ag, 'readings', '', {}));
}
const DO = 'tpl_up_activated-sludge_do-low'; const MLSS = 'tpl_up_activated-sludge_mlss-low';
{
  const tv = V.template(DO); const h = render(`#/library/templates/${DO}`); const t = text(h);
  ok(/<h1>DO low<\/h1>/.test(h) && has(t, 'Trigger template · v1') && has(t, `Listed under: ${tv.ownerName}`) && has(t, 'Outcome: Issue') && has(t, `Subject: unit process (${tv.ownerName})`), 'DO low: header and chips');
  ok(['minor', 'major', 'emergency'].every((b) => has(t, tv.rules[b].text)), 'DO low: a constant limit rule per band', ['minor', 'major', 'emergency'].map((b) => tv.rules[b].text).join(' · '));
  ok(has(t, 'Persistence · must hold for') && has(t, 'Clearing · must clear for') && has(t, 'Emergency band: fires on the first reading (fixed)'), 'DO low: persistence and clearing labels');
  ok(/Field<\/th><th[^>]*>Follow<\/th><th[^>]*>Override<\/th><th[^>]*>Pinned<\/th><th[^>]*>Frozen/.test(h), 'DO low: Downstream table Field · Follow · Override · Pinned · Frozen');
  const before = V.downstream(DO).before;
  ok(before.perField.every((f) => f.frozenText.every((x) => has(t, x))) && has(t, 'DO low · AT-2 (1 open Issue)'), 'DO low: Frozen names "DO low · AT-2 (1 open Issue)"');
  ok(has(t, before.sub), 'DO low: "Who follows each field" across the plants');
  ok(has(t, 'Diagnostic flow:') && has(t, V.flow(tv.flowId).name), 'DO low: its diagnostic flow');
  ok(tv.uses.filter((u) => u.kind === 'zone').every((u) => has(t, u.tag)), 'DO low: where it is used');
  /* every template renders (three per owner, as the smoke run samples them) */
  const byOwner = {}; V.templates({}).forEach((x) => { (byOwner[x.ownerKey] = byOwner[x.ownerKey] || []).push(x); });
  Object.keys(byOwner).forEach((k) => byOwner[k].slice(0, 3).forEach((x) => render(x.href)));
  ok(/No such template/.test(render('#/library/templates/nope', { noLinks: true })), 'templates: unknown id');
}
{
  /* the older links */
  ok(/<h1>Diffuser Tank<\/h1>/.test(render('#/library/OS_TANK_DF')) && /<h1>Blower<\/h1>/.test(render('#/library/BLW/tasks')), 'alias: library/:code opens the equipment type');
  ok(/The shared definitions every plant follows/.test(render('#/library/NOPE')), 'alias: an unknown code opens the library home');
  ok(/No such equipment type/.test(render('#/library/eq-types/NOPE', { noLinks: true })) && /No such unit-process type/.test(render('#/library/up-types/nope', { noLinks: true })), 'unknown types: not-found pages');
}

/* ── 3. chapter 10 · a library change ───────────────────────────────────────────────────────────────────── */
{
  const t0 = text(render(`#/library/templates/${MLSS}`));
  ok(has(t0, 'Downstream') && has(t0, V.downstream(MLSS).before.sub), 'MLSS low: Downstream before editing');
  const allBefore = allActivity().length; const manBefore = plantActivity('manesar').length;
  /* Minor rule Constant 2000 → 2200 */
  act('tpl:field', { 'data-id': MLSS, 'data-band': 'minor', 'data-key': 'value' }, { value: String(V.template(MLSS).rules.minor.rule.value + 200) });
  const rs = act('tpl:save', { 'data-id': MLSS });
  const dv = V.templateDraft(MLSS);
  ok(rs === undefined && dv && dv.diffs.length === 1 && dv.diffs[0].band === 'minor' && dv.diffs[0].to.value === V.template(MLSS).rules.minor.rule.value + 200, 'MLSS low: the editor saves a draft with the new Minor rule', lastToast());
  ok(/^Saved to the draft of MLSS low v2\./.test(lastToast()), 'MLSS low: the save toast', lastToast());
  const ds = V.downstream(MLSS); const h = render(`#/library/templates/${MLSS}`); const t = text(h);
  ok(ds.fields.length === 1 && has(t, ds.fields[0].heading), `Downstream heading "${ds.fields[0].heading}"`);
  ds.fields.forEach((f) => f.groups.forEach((g) => { ok(has(t, g.head), `Downstream group "${g.head}"`); g.items.forEach((it) => ok(has(t, it), `Downstream line "${it}"`)); }));
  ok(ds.totals.update === 1 && ds.totals.baseMoved === 1 && ds.totals.clears === 0 && ds.totals.pinned === 0 && ds.totals.frozen === 0, 'Downstream totals: update 1 · base moved 1 · clears 0 · pinned 0 · frozen 0', JSON.stringify(ds.totals));
  ok(ds.resolves.every((r) => has(t, r.text)), 'Downstream: "Resolves to … at every plant (a constant)"', ds.resolves.map((r) => r.text).join(' | '));
  ok(ds.lines.every((l) => has(t, l)) && (!ds.twice || has(t, 'A plant appears twice when its instances differ.')), 'Downstream: its closing lines');
  ok(has(t, 'Version: Minor (suggested)') && ds.suggestedKind === 'minor' && JSON.stringify(ds.allowedKinds) === JSON.stringify(['minor', 'major']), 'Version: Minor (suggested), Minor or Major allowed');
  ok(/value="patch"[^>]*disabled/.test(h) && /value="forced"[^>]*disabled/.test(h) && !/value="minor"[^>]*disabled/.test(h) && !/value="major"[^>]*disabled/.test(h), 'kind radios: Patch and Forced disabled');
  ok(/title="This change is Minor: a smaller kind would hide it\."/.test(h), 'kind radios: the disabled Patch says why');
  ok(has(t, ds.publishLabel) && ds.publishLabel === `Publish v2 to ${plural(ds.totals.reach, 'plant')}`, `the button "${ds.publishLabel}"`);
  ok(has(t, 'Draft v2: not published'), 'the draft banner');
  const hh = text(render('#/library')); ok(has(hh, 'Drafts') && has(hh, 'MLSS low · draft v2'), 'home: the Drafts strip names the draft');
  /* a different kind recomputes the button */
  act('tpl:pubkind', { 'data-id': MLSS }, { value: 'major' }); const hm = text(render(`#/library/templates/${MLSS}`));
  const dm = V.downstream(MLSS, { kind: 'major' }); ok(has(hm, dm.publishLabel) && dm.fields[0].groups.every((g) => has(hm, g.head)), 'Major chosen: Downstream and the button follow the kind');
  act('tpl:pubkind', { 'data-id': MLSS }, { value: 'minor' });
  /* publish without a note is refused */
  const r0 = act('tpl:publish', { 'data-id': MLSS });
  ok(r0 === false && lastToast() === 'Write a change note.' && V.tplVersion(MLSS) === 1, 'publish refused without a change note', lastToast());
  act('tpl:pubfield', { 'data-id': MLSS, 'data-name': 'note' }, { value: 'Plants run well down to the new value; the old one opened Issues too late' });
  ok(/Plants run well down/.test(render(`#/library/templates/${MLSS}`)), 'the typed note survives a re-render');
  const r1 = act('tpl:publish', { 'data-id': MLSS });
  ok(r1 === undefined && V.tplVersion(MLSS) === 2 && !V.templateDraft(MLSS), 'publish: v2, the draft is gone');
  const expectToast = [`Published MLSS low v2 to ${plural(ds.totals.reach, 'plant')}`, ds.totals.baseMovedValues ? `${ds.totals.baseMovedValues} base moved` : ''].filter(Boolean).join(' · ');
  ok(lastToast() === expectToast, `the toast "${expectToast}"`, lastToast());
  ok(allActivity().length === allBefore + 1 && /^Published MLSS low v2 \(Minor\): /.test(allActivity()[0].text), 'All Plants Activity gains one line', allActivity()[0] && allActivity()[0].text);
  ok(plantActivity('manesar').length === manBefore, "Manesar's Activity gains none");
  const ht = text(render(`#/library/templates/${MLSS}`));
  ok(has(ht, 'Trigger template · v2') && V.template(MLSS).history.every((x) => has(ht, x.text)), 'after publish: v2 and the version history');
  const hc = text(render('#/library/up-types/activated-sludge'));
  ok(V.libChanges({}).filter((c) => c.owner && c.owner.id === 'activated-sludge').every((c) => has(hc, `${c.name} v${c.v}`)), 'type page: the version history names the publish');
  ok(has(hc, 'Overrides at plants:'), 'type page: "Overrides at plants" line');
}
{
  /* Forced try: Emergency 0.5 → 0.8 with the Issue still open */
  const em = V.template(DO).rules.emergency.rule.value;
  act('tpl:field', { 'data-id': DO, 'data-band': 'emergency', 'data-key': 'value' }, { value: String(Math.round((em + 0.3) * 10) / 10) });
  act('tpl:save', { 'data-id': DO });
  const ds = V.downstream(DO); const h = render(`#/library/templates/${DO}`); const t = text(h);
  ok(ds.suggestedKind === 'forced' && JSON.stringify(ds.allowedKinds) === JSON.stringify(['forced']) && has(t, 'Version: Forced (suggested)'), 'Forced: suggested and the only choice');
  ok(['patch', 'minor', 'major'].every((k) => new RegExp(`value="${k}"[^>]*disabled`).test(h)) && !/value="forced"[^>]*disabled/.test(h), 'Forced: every other kind disabled');
  ok(has(t, 'Why is this forced?'), 'Forced: asks why');
  ds.fields.forEach((f) => f.groups.forEach((g) => { ok(has(t, g.head), `Forced Downstream group "${g.head}"`); g.items.forEach((it) => ok(has(t, it), `Forced Downstream line "${it}"`)); }));
  ok(ds.fields[0].groups.some((g) => g.key === 'frozen') && ds.fields[0].groups.some((g) => g.key === 'suspended'), 'Forced at seed: the frozen Trigger is skipped and the override is suspended');
  ok(ds.lines.every((l) => has(t, l)) && ds.lines.some((l) => /^Plant admins are told at /.test(l)), 'Forced: "Plant admins are told at …"');
  act('tpl:pubfield', { 'data-id': DO, 'data-name': 'note' }, { value: 'A deeper floor for the blowers' });
  const r = act('tpl:publish', { 'data-id': DO });
  ok(r === false && lastToast() === 'A forced change needs a reason.' && V.tplVersion(DO) === 1, 'Forced: refused without a reason', lastToast());
  act('tpl:discard', { 'data-id': DO });
  ok(lastModal().title === 'Discard the draft?' && /Discard the draft of DO low v2\? Nothing has reached any plant\./.test(lastModal().body || ''), 'Discard asks first, with the core sentence');
  confirmLast();
  ok(!V.templateDraft(DO) && /^Draft discarded\. DO low stays at v1/.test(lastToast()), 'Discard: the draft is gone', lastToast());
}
{
  /* a cadence change: the count-from choice */
  const pm = V.libType('BLW').schedules.find((s) => s.workType === 'pm' && s.basis === 'calendar' && s.every && s.every.n);
  ok(!!pm, 'a calendar PM Task template on Blower');
  if (pm) {
    act('tpl:field', { 'data-id': pm.id, 'data-key': 'everyN' }, { value: String(pm.every.n + 1) });
    act('tpl:save', { 'data-id': pm.id });
    const dv = V.templateDraft(pm.id); ok(dv && dv.diffs.some((x) => x.field === 'every'), 'cadence: saved to the draft');
    const ds = V.downstream(pm.id); const t = text(render(`#/library/templates/${pm.id}`));
    ok(ds.dueNow && ds.dueNow.service && has(t, ds.dueNow.service.text) && has(t, ds.dueNow.service.labels.service) && has(t, ds.dueNow.service.labels.publish), 'cadence: "{n} Tasks become due now" with both count-from choices', ds.dueNow && ds.dueNow.service && ds.dueNow.service.text);
    act('tpl:countfrom', { 'data-id': pm.id }, { value: 'publish' }); const hp = render(`#/library/templates/${pm.id}`);
    ok(/value="publish" checked/.test(hp), 'cadence: "Count from the publish date" chosen');
    ok(has(text(render('#/library/eq-types/BLW/tasks')), `${pm.name} · draft v${pm.v + 1}`), 'type page: the draft and its Downstream sit in the aside');
    act('tpl:discard', { 'data-id': pm.id }); confirmLast(); ok(!V.templateDraft(pm.id), 'cadence: discarded');
  }
}
{
  /* the same editor in a sheet: "Use a design parameter" on the Agitator's constant */
  const id = 'tpl_OS_TANK_AG_motor-current-high';
  act('tpl:sheet', { 'data-id': id, 'data-band': 'minor', 'data-mode': 'expr' });
  const sh = (UI._last && UI._last.sheet) || {};
  ok(/Motor current high · Trigger template · v1/.test(sh.title || '') && /<option value="expr" selected>/.test(sh.body || '') && /<option value="fullLoadCurrent" selected>/.test(sh.body || ''), 'sheet: the template editor, Minor switched to a share of full-load current', sh.title);
  act('tpl:field', { 'data-id': id, 'data-band': 'minor', 'data-key': 'factor', 'data-sheet': '1' }, { value: '105' });
  act('tpl:save', { 'data-id': id, 'data-sheet': '1' });
  const dv = V.templateDraft(id);
  ok(dv && dv.rules && dv.rules.minor && dv.rules.minor.kind === 'expr' && dv.rules.minor.param === 'fullLoadCurrent' && Math.abs(dv.rules.minor.factor - 1.05) < 1e-9, 'sheet: saved as 105% of full-load current', JSON.stringify(dv && dv.rules));
  const h = render('#/library/eq-types/OS_TANK_AG'); const t = text(h);
  ok(has(t, 'Motor current high · draft v2') && has(t, V.downstream(id).publishLabel), 'type page aside: Downstream + Publish for the draft');
  act('tpl:discard', { 'data-id': id }); confirmLast(); ok(!V.templateDraft(id), 'sheet draft discarded');
  /* a bad value is refused with the reason */
  act('tpl:field', { 'data-id': MLSS, 'data-band': 'minor', 'data-key': 'value' }, { value: 'abc' });
  ok(act('tpl:save', { 'data-id': MLSS }) === false && /Minor: Give the limit as a number\./.test(lastToast()), 'editor: a non-number is refused', lastToast());
  act('tpl:mode', { 'data-id': MLSS, 'data-band': 'minor' }, { value: 'const' });
  render(`#/library/templates/${MLSS}`);
  act('tpl:field', { 'data-id': MLSS, 'data-band': 'minor', 'data-key': 'value' }, { value: String(V.template(MLSS).rules.minor.rule.value) });
  ok(act('tpl:save', { 'data-id': MLSS }) === false && /Nothing changed yet/.test(lastToast()), 'editor: the same value changes nothing', lastToast());
}

/* ── 4. promote, merge, pins, lift ──────────────────────────────────────────────────────────────────────── */
{
  /* promoting a value whose library rule is a share of a design parameter keeps the parameter: the share is the one that gives
     the plant's value there, so every other plant still scales with its own motor (v7/2: BL-1's Major zone at 50 A on a derived
     46.0 A; the intake-filter job that was the example is no longer on equipment) */
  const TPL = 'tpl_BLW_motor-current-high';
  V.setZone('manesar', 'bl1_amps', 'above', 'major', 50, { reason: 'tuning', note: 'The new impeller draws more at full duty' });
  const cw = V.overrides({}).find((o) => o.kind === 'zone' && o.templateId === TPL && o.target.band === 'major' && o.value === 50);
  ok(!!cw, 'an override on a derived threshold');
  if (cw) {
    const pr = V.promote(cw.id, { as: 'default' }); const t = text(render(pr.href));
    const dv = V.templateDraft(TPL); const r0 = dv && dv.rules && dv.rules.major; const r = r0 && (r0.rule || r0);
    const b0 = V.template(TPL).body.rules.major; const f0 = (b0 && (b0.rule || b0)).factor;
    ok(r && r.kind === 'expr' && r.param === 'fullLoadCurrent' && Math.abs((r.factor / f0) * cw.currentBase - cw.value) < 0.05, 'promote on a derived threshold: the draft keeps a share of full-load current that gives the plant its value', JSON.stringify(r));
    ok(has(t, V.overrideById(cw.id).promoteBanner), 'promote on a derived threshold: its banner');
    act('tpl:discard', { 'data-id': TPL }); confirmLast(); ok(!V.templateDraft(TPL), 'derived promote discarded');
  }
  /* a promote that would break the band order at some plant is not filled in: the page says why */
  const amp = V.overrides({}).find((o) => o.kind === 'zone' && o.templateId === 'tpl_BLW_motor-current-high' && o.target.band === 'caution' && o.value != null);
  if (amp) {
    const pr = V.promote(amp.id, { as: 'default' }); const h = render(pr.href); const t = text(h);
    ok(!V.templateDraft('tpl_BLW_motor-current-high') && /class="note note-bad"/.test(h) && has(t, V.overrideById(amp.id).promoteBanner), 'promote that breaks a band order: no draft, the reason shown', t.slice(t.indexOf('Promoting'), t.indexOf('Promoting') + 260));
  }
}
{
  /* "Make it the library default": DO-AT2 Minor 1.5 (Tuning) fills DO low's draft */
  const zr = V.setZone('manesar', 'at2_do', 'below', 'minor', 1.5, { reason: 'tuning', note: 'Short dips below 2.0 recover on their own; 1.5 is where the operators act' });
  ok(zr && zr.ok, 'an override to promote', zr && zr.error);
  const ov = V.overrideById(zr.id); const pr = V.promote(zr.id, { as: 'default' });
  ok(pr && pr.ok && pr.href === `#/library/templates/${DO}?promote=${zr.id}`, 'Promote → the template page', pr && pr.href);
  const h = render(pr.href); const t = text(h);
  ok(has(t, ov.promoteBanner), `promote banner "${ov.promoteBanner}"`);
  const dv = V.templateDraft(DO);
  ok(dv && dv.promoteFrom === zr.id && dv.rules && dv.rules.minor && dv.rules.minor.value === 1.5, 'the draft carries the override value and where it came from', JSON.stringify(dv && dv.rules));
  render(pr.href); ok(JSON.stringify(V.templateDraft(DO).rules) === JSON.stringify(dv.rules), 'a second render changes nothing');
  ok(has(t, V.downstream(DO).publishLabel), 'promote: Downstream and Publish are there');
  act('tpl:pubfield', { 'data-id': DO, 'data-name': 'note' }, { value: "Manesar's operators act at this value" });
  act('tpl:publish', { 'data-id': DO });
  const st = V.overrideById(zr.id).status;
  ok(V.tplVersion(DO) === 2 && st === 'promoted', 'publishing the promoted draft ends the override as Promoted', st);
  ok(W.location.hash === `#/library/templates/${DO}`, 'after publish the page drops ?promote=');
  ok(!V.templateDraft(DO) && !/Promoting/.test(text(render(pr.href))), 'the promoted override is not promoted again');
}
{
  /* a criticality tier promote on a type page */
  const tier = V.overrides({}).find((o) => o.kind === 'tier');
  ok(!!tier, 'a criticality tier override');
  if (tier) {
    const pr = V.promote(tier.id, { as: 'default' }); ok(pr && pr.ok && /^#\/library\/(eq|up)-types\//.test(pr.href) && /\?promote=/.test(pr.href), 'tier Promote → the type page', pr && pr.href);
    const typeKey = /eq-types\/([^?]+)/.test(pr.href) ? `eq:${/eq-types\/([^?]+)/.exec(pr.href)[1]}` : `up:${/up-types\/([^?]+)/.exec(pr.href)[1]}`;
    const v0 = V.typeVersion(typeKey);
    const t = text(render(pr.href));
    ok(has(t, V.overrideById(tier.id).promoteBanner) && has(t, 'Promote a criticality tier') && has(t, 'Default criticality tier'), 'tier promote: banner and its card');
    ok(act('tpl:typepub', { 'data-type': typeKey, 'data-ov': tier.id }) === false && lastToast() === 'Write a change note.', 'tier promote: a note is needed');
    act('tpl:pubfield', { 'data-tier': tier.id, 'data-name': 'note' }, { value: 'This plant knows the pump best' });
    act('tpl:typepub', { 'data-type': typeKey, 'data-ov': tier.id });
    ok(V.typeVersion(typeKey) === v0 + 1 && V.overrideById(tier.id).status === 'promoted', 'tier promote: the type gets a new version and the override is Promoted', lastToast());
    const rec = V.overrideById(tier.id); const tg = rec && rec.target; const ti = tg && tg.eqId && typeKey.startsWith('eq:') ? V.tierInfo(rec.plant, tg.eqId) : null;
    if (ti) ok(ti.libValue === rec.value, 'tier promote: the published default is the library base at the plant now', `${ti.libValue} · ${rec.value}`);
  }
}
{
  /* Merge a single-use template into its type */
  const su = V.singleUse({})[0]; ok(!!su, 'a single-use template');
  if (su) {
    const mh = V.mergeSingleUse(su.id); ok(mh && mh.ok, 'Merge → the template page', mh && mh.href);
    const t = text(render(mh.href));
    ok(has(t, su.mergeBanner) && has(t, `Single-use · ${su.plantName}`), 'merge banner and the single-use chip', su.mergeBanner);
    const dv = V.templateDraft(su.id); ok(dv && dv.merge && dv.suggestedKind === 'major', 'the merge draft suggests Major');
    act('tpl:discard', { 'data-id': su.id }); confirmLast();
    ok(!V.templateDraft(su.id) && W.location.hash === `#/library/templates/${su.id}`, 'merge discarded; the page drops ?merge=');
  }
}
{
  /* pins: a reason is needed; Unpin */
  const v = V.tplVersion(MLSS);
  const b0 = LIB.pinButton('manesar', MLSS); ok(new RegExp(`Pin this plant to v${v}`).test(b0) && /data-act="pin:open"/.test(b0), 'pin button: "Pin this plant to v{n}"');
  act('pin:open', { 'data-plant': 'manesar', 'data-tpl': MLSS });
  ok(lastModal().title === `Why should this plant stay on v${v}?`, 'pin: the modal asks why', lastModal().title);
  ok(act('pin:save') === false && lastToast() === `Say why this plant should stay on v${v}.` && !V.pins({ plant: 'manesar' }).length, 'pin: refused without a reason', lastToast());
  act('pin:field', { 'data-name': 'reason' }, { value: 'The new limit is still being checked at this plant' });
  act('pin:save');
  ok(V.pins({ plant: 'manesar' }).some((p) => p.templateId === MLSS && p.v === v), 'pin: saved', lastToast());
  const b1 = LIB.pinButton('manesar', MLSS); ok(new RegExp(`Pinned to v${v}`).test(b1) && new RegExp(`Unpin · follows v${v}`).test(b1), 'pin button: the pin chip and Unpin');
  const t = text(render(`#/library/templates/${MLSS}`)); ok(has(t, 'Pinned at plants') && has(t, 'The new limit is still being checked'), 'template page: Pinned at plants');
  act('pin:unpin', { 'data-plant': 'manesar', 'data-tpl': MLSS }); ok(/^Unpin MLSS low at /.test(lastModal().title || ''), 'unpin asks first');
  confirmLast(); ok(!V.pins({ plant: 'manesar' }).length, 'unpinned', lastToast());
}
{
  /* a Forced change in force, then lifted */
  const em = V.template(DO).rules.emergency.rule.value;
  act('tpl:field', { 'data-id': DO, 'data-band': 'emergency', 'data-key': 'value' }, { value: String(Math.round((em + 0.3) * 10) / 10) });
  act('tpl:save', { 'data-id': DO });
  act('tpl:pubfield', { 'data-id': DO, 'data-name': 'note' }, { value: 'A deeper floor for the blowers' });
  act('tpl:pubfield', { 'data-id': DO, 'data-name': 'reason' }, { value: 'The consent now asks for it' });
  act('tpl:publish', { 'data-id': DO });
  ok(V.template(DO).forced, 'Forced: published and in force', lastToast());
  const t = text(render(`#/library/templates/${DO}`)); ok(has(t, 'Forced by library · DO low') && has(t, 'Lift the Forced change'), 'template page: the Forced card');
  act('tpl:lift', { 'data-id': DO }); ok(/^Lift the Forced change on DO low\?/.test(lastModal().title || ''), 'lift asks why');
  ok(act('tpl:lift-save', { 'data-id': DO }) === false && /Say why/.test(lastToast()), 'lift: a reason is needed');
  act('tpl:lift-field', {}, { value: 'The consent change was withdrawn' }); act('tpl:lift-save', { 'data-id': DO });
  ok(!V.template(DO).forced && /^Forced change lifted/.test(lastToast()), 'lifted', lastToast());
}

/* ── 5. after a day, every page still renders; a summary ─────────────────────────────────────────────────── */
{
  V.advance(1440);
  ['#/library', '#/library/eq-types/BLW', `#/library/templates/${DO}`, `#/library/templates/${MLSS}`, '#/library/up-types/activated-sludge', '#/library/plant-types/ETP/plants'].forEach((r) => render(r));
}
const softs = (UI._soft || []).filter((x) => /^lib7:/.test(x));
ok(!softs.length, 'no caught errors in lib7 calls', softs.slice(0, 5).join(' | '));
console.log(`lib7 test · ${pass} passed, ${fails.length} failed · ${pages.length} pages rendered${warns.length ? ` · ${warns.length} notes` : ''}`);
if (VERBOSE && warns.length) warns.slice(0, 20).forEach((w) => console.log('  note ' + w));
if (fails.length) { console.log('FAILURES:\n  ' + fails.join('\n  ')); process.exit(1); }
process.exit(0);
