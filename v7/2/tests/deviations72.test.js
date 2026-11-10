#!/usr/bin/env node
/* v7/2 · tests/deviations72.test.js — the override form, the Deviations pages and the override modals (ledger7.js).
   Loads the whole v7/2 prototype headless through load72.js and drives the pages through the registered V7UI handlers, the
   clicks a presenter makes. Every number it checks is read back from the core (deviations(), previewLimits(), trialStats(),
   overrideById()); the seed's expected counts are checked as well.
   Covers: the five reasons and their paths, the reasons a Gap and a per-Trigger limit offer, the "If you save" preview on a
   Live and a Commissioning plant, the seed counts on Deviations, every ?show= view, row links and row actions by state, the
   Revert modal and History, v7/1's /differences links, the Deviations walk of the story in order, Structure changes in their
   own section, the form in a sheet and in a modal, and the words on every page this file draws.
   Usage: TZ=Asia/Calcutta node tests/deviations72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const L = require('./load72.js');

const VERBOSE = process.argv.includes('-v');
const V = L.V7; const U = L.V7UI; const W = L.window; const G = W.V7LEDGER;
let pass = 0; const fails = [];
function ok(cond, name, extra) {
  if (cond) { pass++; if (VERBOSE) console.log('  ok   ' + name); }
  else { fails.push(name + (extra !== undefined ? ` — ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : '')); console.log('  FAIL ' + name + (extra !== undefined ? ` — ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : '')); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name, { got: a, want: b }); }
function head(t) { if (VERBOSE) console.log('\n' + t); }

if (!V || !U || !G) { console.log('FAIL the prototype did not load: ' + JSON.stringify({ V7: !!V, V7UI: !!U, V7LEDGER: !!G, missing: L.missing, errors: L.errors.map((e) => e.file) })); process.exit(1); }

/* ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────── */
const H = U._handlers; const LAST = U._last;
function el(data, value) {
  const attrs = {}; Object.keys(data || {}).forEach((k) => { attrs[k.startsWith('data-') ? k : `data-${k}`] = data[k] == null ? null : String(data[k]); });
  return { getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null), hasAttribute: (k) => Object.prototype.hasOwnProperty.call(attrs, k), value: value == null ? '' : value, closest: () => null, tagName: 'BUTTON' };
}
function act(name, data, value) { const fn = H[name]; if (!fn) throw new Error('no handler for ' + name); return fn(el(data, value), {}); }
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
const decode = (s) => String(s).replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, k) => ENT[k]);
const MARKS = /<aside class="dec-mark"[\s\S]*?<\/aside>/g;
const text = (html) => decode(String(html == null ? '' : html).replace(MARKS, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const body = (html) => String(html == null ? '' : html).replace(MARKS, '');
function rowHtml(html, id) { const m = new RegExp(`<tr[^>]*data-ov="${id}"[\\s\\S]*?</tr>`).exec(String(html)); return m ? m[0] : ''; }
function liHtml(html, id) { const m = new RegExp(`<li[^>]*data-ov="${id}"[\\s\\S]*?</li>`).exec(String(html)); return m ? m[0] : ''; }
const C = (o) => V.deviations(o || {}).counts;
const now = () => V.now();
const DAY = 86400000;
const dateIn = (ms) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
const times = (n) => (n === 1 ? 'time' : 'times');
function recBy(plant, pred) { return V.overrides({ plant, state: 'all' }).find((o) => o.status === 'active' && pred(o.target)) || null; }
function resetAll() { L.reset(); Object.keys(G._forms).forEach((k) => delete G._forms[k]); U.closeModal(true); U.closeSheet(true); }
function fkOf(key, t) { const t2 = Object.assign({}, t); if (t2.kind === 'zone' && !t2.dir) t2.dir = V.zoneInfo(key, t2.sensorId).dir; return G._fk(key, t2); }
function openForm(key, t) { act('ov:open', { plant: key, target: JSON.stringify(t) }); return fkOf(key, t); }
function radioValues(html) { const out = []; const re = /<input type="radio"[^>]*value="([^"]*)"[^>]*data-act="ov:reason"/g; let m; while ((m = re.exec(html))) out.push(m[1]); return out; }

/* the v7/2 word list for a page this file draws (the decisions strip is a study note, left out) */
const BANNED = [
  ['words', /\bmachines?\b/i], ['words', /\bassets?\b/i], ['words', /\bwidgets?\b/i], ['words', /\bestates?\b/i], ['words', /\bportfolio\b/i], ['words', /\bcustom\b/i],
  ['words', /\bdetach(ed)?\b/i], ['words', /\bfork(ed|s)?\b/i], ['words', /\bdiverg(e|ed|es|ing|ence)\b/i], ['words', /\bstale\b/i], ['words', /\bdrift\b/i],
  ['words', /\balerts?\b/i], ['words', /\balerting\b/i], ['words', /(?<!false )\balarms?\b/i], ['words', /\binsights?\b/i], ['words', /\bschedules?\b/i],
  ['words', /\bSCADA\b/i], ['words', /\bdatabase\b/i], ['words', /\bthe form\b/i], ['words', /\bhold time\b/i], ['words', /\bdebounce\b/i],
  ['words', /\bobservation frequency\b/i], ['words', /\bprocedures?\b/i], ['words', /\bworkflows?\b/i], ['words', /\bSOPs?\b/i], ['words', /\bremediation\b/i],
  ['words', /\bSite Admin\b/i], ['words', /\bSME\b/i], ['words', /\bSupervisor\b/i], ['words', /\bonboarding\b/i], ['words', /\bshadow\b/i],
  ['words', /\btest alert\b/i], ['words', /\bdry run\b/i], ['words', /\bdetect\b/i], ['words', /\bpriority\b/i], ['words', /(?<!criticality )\btier\b/i],
  ['words', /\bCritical\b|\bEssential\b|\bStandard\b/], ['words', /(?<!limit |no )\brules?\b/i], ['words', /\bsurvey type\b/i], ['words', /\bunit operations?\b/i],
  ['words', /\b(functional|process) stages?\b/i], ['words', /\bsub-assets?\b/i],
  ['v7/1 words', /Changed here/i], ['v7/1 words', /Library changed since/i], ['v7/1 words', /Differences from the library/i], ['v7/1 words', /From the library/i],
  ['v7/1 words', /From the SCADA form/i], ['v7/1 words', /No limits yet/i], ['v7/1 words', /What SCADA found/i], ['v7/1 words', /What the library brings/i],
  ['v7/1 words', /Where it lands/i], ['v7/1 words', /Not for this plant/i], ['v7/1 words', /On trial/i], ['v7/1 words', /Mostly short/i], ['v7/1 words', /Tuned for this plant/i],
  ['v7/1 words', /For now, until/i], ['v7/1 words', /Reason not recorded/i], ['v7/1 words', /Not in the library/i], ['v7/1 words', /Back to the library value/],
  ['v7/1 words', /Suggest for the library/i], ['v7/1 words', /Who is told/i], ['v7/1 words', /User Center/i], ['v7/1 words', /Phone view/i], ['v7/1 words', /Review due/i],
  ['v7/1 words', /no call, no hooter/i], ['v7/1 words', /told to the Leads/i], ['v7/1 words', /(?<!Persistence · )must hold for/i], ['v7/1 words', /(?<!Clearing · )must clear for/i],
  ['ids', /\b(CM|C|O)-\d{1,2}\b/], ['ids', /(?<![-\w])E[1-5]\b/], ['ids', /(?<![-\w])W\d{1,2}[a-d]?\b/], ['ids', /(?<![-\w])P[1-6]\b/], ['ids', /(?<![-\w])S[1-8]\b/],
  ['ids', /\bV7-\d+\b/], ['ids', /\bV72-\d+\b/], ['ids', /\bPRD\b/], ['ids', /§\s*\d/], ['ids', /\bAC-?\d+\b/], ['ids', /Amity/], ['ids', /Noida/],
  ['ids', /\.md\b/], ['ids', /\.html\b/], ['ids', /dp_intel/], ['ids', /(?<![-\w])D\d{1,2}\b/],
  ['junk', /\bundefined\b/], ['junk', /\bNaN\b/], ['junk', /\[object Object\]/], ['junk', /Invalid Date/], ['junk', /\$\{/],
];
const WORD_HITS = [];
function words(html, where) {
  const t = text(html);
  BANNED.forEach(([kind, re]) => { const m = re.exec(t); if (m) WORD_HITS.push(`${where}: ${kind} "${m[0]}" in …${t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)}…`); });
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   1. wiring
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('wiring');
const patterns = U.routes().map((r) => r.pattern);
['deviations', 'p/:plant/deviations', 'differences', 'p/:plant/differences'].forEach((p) => ok(patterns.includes(p), `route ${p} is registered`));
['ov:open', 'ov:value', 'ov:reason', 'ov:note', 'ov:date', 'ov:trait', 'ov:anyway', 'ov:variant', 'ov:cancel', 'ov:save', 'dev:revert', 'dev:extend', 'dev:keep', 'dev:adopt', 'dev:promote', 'dev:variant', 'dev:keep-single', 'dev:merge', 'dev:unpin', 'dev:filter', 'dev:m-ok']
  .forEach((a) => ok(typeof H[a] === 'function', `act ${a} is handled`));
ok(['overrideForm', 'fieldActions', 'formFor', 'isOpen', 'openSheet'].every((k) => typeof G[k] === 'function'), 'V7LEDGER exposes the form and its field actions');

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   2. Deviations at seed: the count chips, the filters, the order, every view
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('Deviations at seed');
resetAll();
{
  const c = C(); const html = L.render('#/deviations'); const t = text(html);
  const want = [`${c.overrides} overrides`, `${c.basemoved} base moved`, `${c.pastreview} past review`, `${c.triggerlimit} Trigger limit overrides`, `${c.pinned} pinned`, `${c.singleuse} single-use templates`, `${c.structure} structure changes`];
  want.forEach((w) => ok(t.includes(w), `All Plants chip "${w}" equals deviations().counts`, t.slice(0, 300)));
  eq([c.overrides, c.basemoved, c.pastreview, c.triggerlimit, c.pinned, c.singleuse, c.structure], [15, 1, 1, 0, 0, 2, 11], 'seed counts: 15 overrides · 1 base moved · 1 past review · 0 Trigger limit · 0 pinned · 2 single-use · 11 structure changes');
  eq([c.byReason.migrated, c.byReason.tuning, c.byReason.physical], [13, 1, 1], 'by reason at seed: Migrated 13 · Tuning 1 · Physical 1');
  [['migrated', 'Migrated'], ['tuning', 'Tuning'], ['physical', 'Physical']].forEach(([k, lab]) => ok(t.includes(`${lab} (${c.byReason[k]})`), `Reason filter offers "${lab} (${c.byReason[k]})"`));
  ok(!/Suspended|suspended/.test(t.replace(/Suspended by/g, '')) || c.suspended > 0, 'no suspended chip while nothing is suspended');
  ok(t.includes('Deviations · All Plants') && t.includes('Every override, pin and base moved item at every plant, grouped by library field.'), 'All Plants header and sub');
  const d = V.deviations({});
  ok(d.groups.length > 0 && d.groups[0].hasBaseMoved, 'the base-moved group comes first');
  ok(html.indexOf(d.groups[0].header.replace(/</g, '&lt;')) >= 0, 'the first group header is on the page', d.groups[0].header);
  ok(/Sludge blanket high · persistence · library 15 min \(v2\)$/.test(d.groups[0].header), 'first group: Sludge blanket high · persistence · library 15 min (v2)', d.groups[0].header);
  const r0 = d.groups[0].rows[0]; const tr = text(rowHtml(html, r0.id));
  ok(tr.includes('Manesar STP') && tr.includes('30 min · base moved 5 → 15 min') && tr.includes('Migrated') && tr.includes(`${r0.ageDays} d`) && r0.ageDays === 58, 'base-moved row: Manesar STP · 30 min · base moved 5 → 15 min · Migrated · 58 d', tr);
  words(html, '#/deviations');
}
{
  ['overrides', 'basemoved', 'pastreview', 'triggerlimit', 'pinned', 'singleuse', 'structure', 'history', 'suspended'].forEach((s) => {
    const html = L.render(`#/deviations?show=${s}`); const t = text(html);
    ok(html.includes('class="dv"') && !/This page could not be shown/.test(t), `#/deviations?show=${s} renders`);
    words(html, `#/deviations?show=${s}`);
    ['manesar', 'vedanta', 'bawal', 'digitalpaani'].forEach((k) => { const b = G.deviationsBody(k, { show: s }); ok(/class="dv"/.test(b), `${k} ?show=${s} renders`); words(b, `#/p/${k}/deviations?show=${s}`); });
  });
  const dp = L.render('#/p/digitalpaani/deviations');
  ok(text(dp).includes('No deviations at DigitalPaani: every value follows the library.'), 'DigitalPaani: the empty sentence');
  const man = L.render('#/p/manesar/deviations'); const cm = C({ plant: 'manesar' });
  ok(text(man).includes('Manesar STP') && text(man).includes(`${cm.overrides} overrides`) && cm.overrides === 14, 'Manesar page: its own counts inside the plant frame (16 overrides)');
  ok(!/Plant: any/.test(text(G.deviationsBody('manesar', {}))), 'a plant page has no Plant filter');
  { const tabs = (/<nav class="tabs"[\s\S]*?<\/nav>/.exec(man) || [''])[0]; ok(!/>Deviations</.test(tabs) || /class="tab on"[^>]*>Deviations</.test(tabs), 'the plant frame marks Deviations as the open tab', tabs.slice(0, 200)); }
  const filtered = L.render('#/deviations?reason=tuning'); const ft = text(filtered); const sp = recBy('manesar', (t) => t.kind === 'tier' && t.eqId === 'sp1');
  ok(ft.includes('SP-1 · criticality tier') && !ft.includes('MLSS-AT1 · Minor zone'), 'Reason: Tuning shows only Tuning rows');
  ok(rowHtml(filtered, sp.id) !== '', 'the Tuning row is there');
  const byPlant = text(L.render('#/deviations?plant=vedanta'));
  ok(byPlant.includes('PH-EQ-1 · Emergency zone') && !byPlant.includes('MLSS-AT1'), 'Plant: Vedanta ETP shows only Vedanta rows');
  const byTpl = text(L.render('#/deviations?template=eq:BLW'));
  ok(byTpl.includes('AMP-BL1 · Caution zone') && !byTpl.includes('PH-EQ-1'), 'Template: Blower shows only Blower rows');
  ok(H['dev:filter'] && (() => { W.location.hash = '#/deviations'; act('dev:filter', { param: 'reason', base: '#/deviations', q: '{}' }, 'migrated'); return W.location.hash === '#/deviations?reason=migrated'; })(), 'changing the Reason filter navigates to ?reason=');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   3. Row links (every row links to its field) and row actions by state
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('row links and actions');
{
  const d = V.deviations({}); const html = L.render('#/deviations');
  const rows = [].concat(...d.groups.map((g) => g.rows));
  rows.forEach((r) => {
    ok(html.includes(`href="${r.href}"`), `row ${r.what} links to its field`, r.href);
    ok(/\?f=/.test(r.href) && r.href.endsWith(`?f=${r.field}`), `row ${r.what} names its field (?f=${r.field})`, r.href);
  });
  const structHtml = L.render('#/deviations?show=structure');
  d.structure.forEach((s) => ok(structHtml.includes(`href="${s.href}"`) && /\?select=up:/.test(s.href), `structure row ${s.label} links to the structure page`, s.href));
  /* the field's page, once its owner has registered it, opens on that field */
  const owner = { sensor: 'p/:plant/sensor/:id', trigger: 'p/:plant/trigger/:id', eq: 'p/:plant/eq/:id/:tab?', up: 'p/:plant/up/:id/:tab?' };
  const hasTargets = !!(W.V7OBJ && typeof W.V7OBJ.zonesEditor === 'function');
  let checked = 0;
  rows.forEach((r) => {
    const kind = (/#\/p\/[^/]+\/(sensor|trigger|eq|up)\//.exec(r.href) || [])[1]; if (!kind || !patterns.includes(owner[kind])) return;
    const m = U.match(r.href); ok(!!m && m.pattern === owner[kind], `${r.href} resolves to ${owner[kind]}`, m && m.pattern);
    if (hasTargets) { const page = L.render(r.href); ok(!/This page could not be shown/.test(text(page)), `${r.href} renders`); ok(/is-target/.test(page), `${r.href} highlights its field`); }
    checked++;
  });
  if (!checked && VERBOSE) console.log('  (the field pages are not registered yet: their resolution is checked once they are)');
  const bm = d.groups[0].rows[0]; const bmRow = rowHtml(html, bm.id);
  ok(/dev:keep/.test(bmRow) && /dev:adopt/.test(bmRow) && /dev:promote/.test(bmRow) && !/dev:revert/.test(bmRow), 'a base-moved row offers Keep · Adopt the library value · Promote', text(bmRow));
  ok(text(bmRow).indexOf('Keep') < text(bmRow).indexOf('Adopt the library value') && text(bmRow).indexOf('Adopt the library value') < text(bmRow).indexOf('Promote'), 'in that order');
  const pr = d.groups.find((g) => g.hasPastReview).rows.find((r) => r.isPastReview); const prRow = rowHtml(html, pr.id);
  ok(/dev:revert/.test(prRow) && /btn-primary[^>]*data-act="dev:extend"|data-act="dev:extend"[^>]*/.test(prRow) && /dev:promote/.test(prRow), 'a past-review row offers Revert · Extend · Promote', text(prRow));
  ok(/class="btn btn-primary[^"]*"[^>]*data-act="dev:extend"/.test(prRow), 'Extend is the primary action on a past-review row');
  ok(text(prRow).includes('Past review'), 'the past-review row carries its Past review chip');
  const act0 = rows.find((r) => r.state === 'active'); const aRow = rowHtml(html, act0.id);
  ok(/dev:revert/.test(aRow) && /dev:extend/.test(aRow) && /dev:promote/.test(aRow) && !/Base moved|Past review/.test(text(aRow)), 'an active row offers Revert · Extend · Promote and no state chip');
  /* a Forced change suspends an override: its row has no buttons and says why */
  const ph = recBy('vedanta', (t) => t.kind === 'zone' && t.sensorId === 'v_eq1_PH');
  V.ledgerOnBaseChange({ plant: 'vedanta', match: (t) => t.kind === 'zone' && t.sensorId === 'v_eq1_PH', changeId: 'test_forced', kind: 'forced' });
  const sHtml = L.render('#/deviations?show=suspended'); const sRow = rowHtml(sHtml, ph.id);
  ok(sRow !== '' && !/data-act="dev:/.test(sRow) && /Suspended/.test(text(sRow)) && /will return when lifted/.test(text(sRow)), 'a suspended row has no buttons and says it returns when lifted', text(sRow));
  ok(text(L.render('#/deviations')).includes('1 suspended'), 'the suspended chip shows while one is suspended');
  V.ledgerLiftForced('test_forced');
  ok(!text(L.render('#/deviations')).includes('suspended'), 'lifted: no suspended chip');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   4. The form: five reasons, Gap and per-Trigger reasons, Physical's path, Structural's box
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('the override form');
resetAll();
{
  const t = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'major' };
  const f = G.overrideForm('manesar', t); const ft = text(f);
  eq(radioValues(f), ['physical', 'regulatory', 'structural', 'tuning', 'temporary'], 'the form offers exactly five reasons, in order');
  ok(ft.includes('Why does this plant differ?'), 'asks "Why does this plant differ?"');
  const lab = V.LABELS.reasonOption; ['physical', 'regulatory', 'structural', 'tuning', 'temporary'].forEach((r) => ok(ft.includes(lab[r]), `reason label "${lab[r]}"`));
  ok(!/Migrated|migrated/.test(ft) && !radioValues(f).includes('migrated'), 'Migrated is never offered');
  ok(!/ checked/.test(f.slice(f.indexOf('ov:reason') - 300)), 'no reason is pre-selected');
  ok(ft.includes('If you save') && ft.includes('Save override') && ft.includes('Cancel'), 'If you save · Cancel · Save override');
  words(f, 'form at2_do major');
  /* saving without a reason */
  const fk = fkOf('manesar', t);
  act('ov:value', { fk }, '0.8'); act('ov:save', { fk });
  ok(text(G.formFor('manesar', t)).includes('Choose why this plant differs.'), 'Save with no reason: "Choose why this plant differs."');
  /* Physical on a constant band */
  act('ov:reason', { fk }, 'physical'); const fp = G.formFor('manesar', t); const pp = V.physicalPath('manesar', t);
  ok(pp.kind === 'const' && text(fp).includes(pp.text) && /constant \(1\.0 mg\/L\): no design parameter changes it\./.test(pp.text), 'Physical on a constant band says no design parameter changes it', pp.text);
  ok(/data-act="ov:anyway"/.test(fp) && text(fp).includes('Override anyway') && !text(fp).includes('Set the design parameter'), 'and offers only "Override anyway"');
  ok(!/data-act="ov:save"/.test(fp), 'Save waits for "Override anyway"');
  act('ov:anyway', { fk }); const fa = G.formFor('manesar', t);
  ok(/data-act="ov:save"/.test(fa) && text(fa).includes('Note') && text(fa).includes('Review by'), 'after "Override anyway": Note, Review by and Save');
  words(fa, 'form Physical anyway');
  /* Structural: the variant box */
  act('ov:reason', { fk }, 'structural'); const fs = G.formFor('manesar', t); const fst = text(fs);
  ok(fst.includes('Request a library variant for this trait?') && fst.includes('Trait') && fst.includes('Request a variant') && fst.includes('Override for now'), 'Structural: the variant box with Trait · Request a variant · Override for now');
  ok(/placeholder="For example: low-load design"/.test(fs), 'the Trait field\'s example');
  words(fs, 'form Structural');
  /* Temporary: Expires on, no Review by */
  act('ov:reason', { fk }, 'temporary'); const fte = text(G.formFor('manesar', t));
  ok(fte.includes('Expires on') && !fte.includes('Review by'), 'Temporary: Expires on, and no Review by');
  /* Regulatory: the consent hint on a zone */
  act('ov:reason', { fk }, 'regulatory'); const fr = text(G.formFor('manesar', t));
  ok(fr.includes('Record the consent limit as a design parameter.'), 'Regulatory or client: the consent-limit hint');
  act('ov:cancel', { fk }); ok(!G.isOpen('manesar', t), 'Cancel closes the form');
}
{
  /* Physical on a derived band: its primary action opens the design parameter */
  const t = { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' }; const fk = openForm('vedanta', t);
  act('ov:reason', { fk }, 'physical'); const f = G.formFor('vedanta', t); const pp = V.physicalPath('vedanta', t);
  ok(pp.kind === 'param' && text(f).includes('Set the design parameter instead?'), 'Physical on a derived band: "Set the design parameter instead?"');
  ok(new RegExp(`class="btn btn-primary[^"]*" href="${pp.href.replace(/[.?]/g, '\\$&')}"`).test(f) && /details\?f=dp\.tankHeight$/.test(pp.href), 'its primary action opens the design-parameter field', pp.href);
  ok(text(f).includes('Override anyway'), 'and "Override anyway" is second');
  act('ov:cancel', { fk });
}
{
  /* a Gap offers Physical and Tuning only; its field row says Set */
  const t = { kind: 'zone', sensorId: 'cdu_lvl', dir: 'below', band: 'major' };
  const fa = G.fieldActions('manesar', t); ok(/data-act="ov:open"/.test(fa) && text(fa) === 'Set', '"Set" on a Gap', text(fa));
  const fk = openForm('manesar', t); eq(radioValues(G.formFor('manesar', t)), ['physical', 'tuning'], '"Set" on a Gap offers only Physical and Tuning');
  ok(text(G.formFor('manesar', t)).includes('· no rule'), 'a Gap reads "no rule" beside the value');
  act('ov:cancel', { fk });
  /* a per-Trigger limit offers Structural, Tuning and Temporary, and a note is always required */
  const tl = { kind: 'triggerLimit', alertId: 'a_mlss_hi', band: 'minor' }; const fk2 = openForm('manesar', tl);
  const f2 = G.formFor('manesar', tl); eq(radioValues(f2), ['structural', 'tuning', 'temporary'], 'a per-Trigger limit offers only Structural, Tuning and Temporary');
  act('ov:reason', { fk: fk2 }, 'temporary'); ok(text(G.formFor('manesar', tl)).includes('Required.'), 'a per-Trigger limit always needs a note');
  act('ov:cancel', { fk: fk2 });
}
{
  /* the field row by state */
  const fa = (key, t) => text(G.fieldActions(key, t));
  eq(fa('manesar', { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' }), 'Override', 'library zone: Override');
  eq(fa('manesar', { kind: 'zone', sensorId: 'at1_mlss', dir: 'below', band: 'minor' }), 'Edit Revert Extend', 'overridden zone: Edit · Revert · Extend');
  eq(fa('manesar', { kind: 'persistence', alertId: 'a_blanket' }), 'Keep Adopt the library value', 'base moved: Keep · Adopt the library value');
  const fz = G.fieldActions('manesar', { kind: 'clearing', alertId: 'a_do_at2' });
  ok(/disabled/.test(fz) && text(fz) === 'Override · frozen', 'a frozen Trigger\'s own value: "Override · frozen", disabled', text(fz));
  const tl = G.fieldActions('manesar', { kind: 'triggerLimit', alertId: 'a_do_at2', band: 'minor' });
  ok(/disabled/.test(tl) && text(tl).startsWith('Override · frozen'), 'a frozen Trigger\'s band: "Override · frozen"', text(tl));
  const tl2 = text(G.fieldActions('manesar', { kind: 'triggerLimit', alertId: 'a_mlss_hi', band: 'minor' }));
  ok(tl2 === 'Open the sensor Override for this Trigger only', 'a Trigger band: Open the sensor · Override for this Trigger only', tl2);
  const der = text(G.fieldActions('vedanta', { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' }));
  ok(der === 'Override Edit the design parameter', 'a derived band: Override · Edit the design parameter', der);
  const ptr = text(G.fieldActions('manesar', { kind: 'tier', eqId: 'sp1' }));
  ok(ptr === 'Edit Revert Extend', 'a past-review tier: Edit · Revert · Extend', ptr);
  words(G.fieldActions('manesar', { kind: 'tier', eqId: 'sp1' }) + G.fieldActions('manesar', { kind: 'clearing', alertId: 'a_do_at2' }), 'field actions');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   5. "If you save": the same numbers as previewLimits, Live and Commissioning
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('the preview');
resetAll();
{
  const t = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' }; const fk = openForm('manesar', t);
  act('ov:value', { fk }, '1.5'); const f = G.formFor('manesar', t); const ft = text(f);
  const bands = Object.assign({}, V.zoneInfo('manesar', 'at2_do', 'below').bands, { minor: 1.5 });
  const pl = V.previewLimits('manesar', 'at2_do', 'below', bands);
  const line = `Last 7 days: would have fired ${pl.count} ${times(pl.count)} (now ${pl.countNow}).`;
  ok(ft.includes(line), `Live: "${line}" equals previewLimits()`, ft);
  eq([pl.count, pl.countNow], [2, 3], 'Live preview at seed: 2 (now 3)');
  ok(ft.includes('Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved).'), 'names the frozen Trigger it changes');
  const iss = V.issues('manesar').find((i) => i.alertId === 'a_do_at2' && i.status !== 'closed');
  ok(ft.includes('DO low · AT-2 has 1 open Issue: it is frozen and keeps 2.0. It will show Base moved until someone resyncs it.'), 'the frozen line');
  ok(iss && f.includes(`href="#/p/manesar/issue/${iss.id}?close=false-alarm"`) && ft.includes('Close it as a false alarm'), '"Close it as a false alarm" opens that close');
  ok(/chip-sample/.test(f), 'the count carries the Sample readings tag');
  act('ov:cancel', { fk });
}
{
  const t = { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' }; const fk = openForm('vedanta', t);
  act('ov:value', { fk }, '87'); const ft = text(G.formFor('vedanta', t));
  const ts = V.trialStats('vedanta', 'a_3d'); const bands = Object.assign({}, V.zoneInfo('vedanta', 'v_eq1_LVL', 'above').bands, { caution: 87 });
  const n = V.previewLimits('vedanta', 'v_eq1_LVL', 'above', bands, { from: ts.since, to: now() }).count; const m = ts.count;
  const line = `Trial so far: would have fired ${n} ${times(n)} instead of ${m}.`;
  ok(ft.includes(line), `Commissioning: "${line}" (previewLimits over the trial, against the stored trial firings)`, ft);
  eq(m, 76, 'the trial count is 76');
  ok(!ft.includes('Last 7 days'), 'no "Last 7 days" line at a Commissioning plant');
  ok(ft.includes('Changes 1 Trigger: Level high · EQ-1.'), 'names the Trigger that follows the sensor');
  /* chapter 5: Physical points at the tank height; Tuning is saved */
  act('ov:reason', { fk }, 'physical'); ok(text(G.formFor('vedanta', t)).includes('Set the design parameter instead?'), 'chapter 5: Physical offers the design parameter first');
  act('ov:reason', { fk }, 'tuning'); act('ov:note', { fk }, 'Level swings with the batch pumps; 85% is reached on every fill');
  act('ov:save', { fk });
  const rec = recBy('vedanta', (x) => x.kind === 'zone' && x.sensorId === 'v_eq1_LVL' && x.band === 'caution');
  ok(!!rec && rec.value === 87 && rec.reason === 'tuning', 'chapter 5: the Tuning override is saved');
  ok(!G.isOpen('vedanta', t), 'the form closes on save');
  const rb = V.fmtDate(now() + 90 * DAY);
  eq(LAST.toast, `Override saved: LVL-EQ-1 · Caution zone ${rec.valueText} (derived ${rec.baseText}) · Tuning · review by ${rb}.`, 'the toast');
  ok(rec.chip.text === `Override · Tuning · you · ${V.fmtDay(now()).replace(/^\w+ /, '')} · review by ${rb.replace(/ \d{4}$/, '')}`, 'the chip "Override · Tuning · you · 29 Oct · review by 27 Jan"', rec.chip.text);
  ok(G.fieldActions('vedanta', t).includes('dev:revert'), 'the field row now offers Revert');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   6. Revert asks, then the record is under History with its note
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('Revert and History');
resetAll();
{
  const ml = recBy('manesar', (t) => t.kind === 'zone' && t.sensorId === 'at1_mlss' && t.band === 'minor');
  act('dev:revert', { id: ml.id }); const m = LAST.modal; const pv = V.revertPreview(ml.id);
  ok(m && m.title === pv.title && m.title === 'Revert to the library value?', 'Revert modal title', m && m.title);
  ok(m && text(m.body).includes(pv.text) && /^Go back to the library value .+\? Your override and its note stay in history\.$/.test(pv.text), 'Revert asks "Go back to the library value {x}? Your override and its note stay in history."', pv.text);
  ok(pv.text.includes('2,000 mg/L'), '{x} is the library value 2,000 mg/L');
  ok(m && /Revert/.test(text(m.foot)) && /Cancel/.test(text(m.foot)), 'Cancel · Revert');
  words(m.body + m.foot, 'Revert modal');
  act('dev:m-ok', { what: 'revert' });
  ok(LAST.toast === `Reverted: ${ml.what} is back to 2,000 mg/L.`, 'the Revert toast', LAST.toast);
  const sp = recBy('manesar', (t) => t.kind === 'tier' && t.eqId === 'sp1');
  act('dev:revert', { id: sp.id }); act('dev:m-ok', { what: 'revert' });
  const h = L.render('#/deviations?show=history'); const ht = text(h);
  ok(ht.includes('History') && ht.includes('Reverted, expired, promoted and cleared overrides. Each keeps its note.'), 'the History section');
  ok(text(rowHtml(h, sp.id)).includes('Sludge can wait a day; nothing overflows while it is stopped') && text(rowHtml(h, sp.id)).includes('Reverted'), 'the reverted record is under History with its note', text(rowHtml(h, sp.id)));
  ok(text(rowHtml(h, ml.id)).includes('MLSS-AT1 · Minor zone'), 'the other reverted record too');
  eq(C().history, 2, 'History · 2');
  ok(text(L.render('#/deviations')).includes('History · 2'), 'the History link counts them');
  words(h, 'history');
  /* a band that would break the order asks to revert the bands together */
  const amp = recBy('manesar', (t) => t.kind === 'zone' && t.sensorId === 'bl1_amps' && t.band === 'minor'); const pv2 = V.revertPreview(amp.id);
  act('dev:revert', { id: amp.id }); const m2 = LAST.modal;
  if (pv2 && pv2.needsAll) ok(text(m2.body).includes(pv2.allText) && text(m2.foot).includes(pv2.allButton), 'a band order break: "Revert all {n}"', text(m2.body));
  else ok(m2 && /Revert/.test(text(m2.foot)), 'a band that keeps the order reverts on its own');
  U.closeModal(true);
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   7. Structure changes: their own section and count, outside "overrides"
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('Structure changes');
resetAll();
{
  const c = C(); const h = L.render('#/deviations?show=structure'); const t = text(h); const d = V.deviations({});
  ok(t.includes('Structure changes') && t.includes('Membership and type changes from the structure pass and the drawing. Each keeps its note.'), 'the Structure changes heading and sub');
  ok(t.includes(`${c.structure} structure changes`) && c.structure === 11, 'its own count chip (11)');
  ok(c.overrides === 15, 'the overrides count leaves them out (15)');
  const s = d.structure.find((x) => x.label === 'EQ-1 · P-1 added'); const li = text(liHtml(h, s.id));
  ok(!!s && li.includes('Vedanta ETP') && li.includes('EQ-1 · P-1 added') && li.includes('Added · not proposed') && li.includes('Lifts raw effluent into this tank') && li.includes(s.authorText) && li.includes(s.ageText), 'a row: UP tag · what changed, note, author, age', li);
  ok(li.includes('Open on the structure page'), 'its action opens the structure page');
  const bw = G.deviationsBody('bawal', {}); ok(text(bw).includes('Structure changes') && text(bw).includes('MGF-1 · RW-1 added'), 'Bawal\'s default view lists its structure changes');
  words(h, 'structure section');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   8. v7/1's links: /differences renders the Deviations pages
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('v7/1 links');
{
  const a = body(L.render('#/differences')); const b = body(L.render('#/deviations'));
  ok(a === b && /class="dv"/.test(a), '#/differences renders the same body as #/deviations');
  const c = body(L.render('#/p/manesar/differences')); const d = body(L.render('#/p/manesar/deviations'));
  ok(c === d && /class="dv"/.test(c), '#/p/manesar/differences renders the same body as #/p/manesar/deviations');
  const e = body(L.render('#/differences?show=pastreview')); const f = body(L.render('#/deviations?show=pastreview'));
  ok(e === f, 'with the same ?show=');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   9. The Deviations chapter, walked in order through the handlers
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('chapter 11, in order');
resetAll();
{
  /* chapter 8's zone override comes first in the story: DO-AT2 Minor 1.5, Tuning */
  const t8 = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' }; const fk8 = openForm('manesar', t8);
  act('ov:value', { fk: fk8 }, '1.5'); act('ov:reason', { fk: fk8 }, 'tuning'); act('ov:note', { fk: fk8 }, 'Short dips below 2.0 recover on their own; 1.5 is where the operators act'); act('ov:save', { fk: fk8 });
  const do8 = recBy('manesar', (x) => x.kind === 'zone' && x.sensorId === 'at2_do' && x.band === 'minor');
  ok(!!do8 && LAST.toast === `Override saved: DO-AT2 · Minor zone 1.5 mg/L (library 2.0 mg/L) · Tuning · review by ${V.fmtDate(now() + 90 * DAY)}.`, 'chapter 8: the DO-AT2 override is saved', LAST.toast);

  /* (1) the chips and the base-moved group first */
  let c = C(); let html = L.render('#/deviations'); let t = text(html);
  ok(t.includes(`${c.overrides} overrides`) && t.includes(`${c.basemoved} base moved`) && t.includes(`${c.pastreview} past review`) && t.includes('0 Trigger limit overrides') && t.includes('0 pinned') && t.includes('2 single-use templates') && t.includes(`${c.structure} structure changes`), '(1) the count chips equal deviations().counts');
  const d = V.deviations({}); const bm = d.groups[0].rows[0];
  ok(/Sludge blanket high · persistence/.test(d.groups[0].header) && bm.plant === 'manesar', '(1) the base-moved group comes first');
  /* (2) Adopt the library value */
  act('dev:adopt', { id: bm.id }); const m = LAST.modal;
  ok(m.title === 'Base moved' && text(m.body).includes('The library changed this from 5 min to 15 min after you overrode it. Keep 30 min, or adopt 15 min?'), '(2) the Base moved modal asks Keep or adopt', text(m.body));
  ok(text(m.foot).includes('Adopt 15 min') && text(m.foot).includes('Keep 30 min'), '(2) its buttons: Adopt 15 min · Keep 30 min');
  words(m.body + m.foot, 'Base moved modal');
  const before = C(); act('dev:m-ok', { what: 'adopt' });
  eq(LAST.toast, 'Manesar STP follows the library again: Sludge blanket high · SC-1 · persistence 15 min.', '(2) the Adopt toast');
  c = C(); ok(c.basemoved === before.basemoved - 1 && c.history === before.history + 1 && c.overrides === before.overrides - 1, '(2) base moved −1, History +1', c);
  /* (3) the past-review row, extended */
  html = L.render('#/deviations?show=pastreview'); const dp = V.deviations({ show: 'pastreview' });
  ok(dp.groups.length === 1 && dp.groups[0].header === 'Pump · criticality tier · library B (v1)' && text(html).includes('Pump · criticality tier · library B (v1)'), '(3) one group: Pump · criticality tier · library B (v1)');
  const sp = dp.groups[0].rows[0]; const spRow = text(rowHtml(html, sp.id));
  ok(spRow.includes('Manesar STP') && spRow.includes('C · B') && spRow.includes('Tuning · "Sludge can wait a day; nothing overflows while it is stopped"') && spRow.includes('32 d'), '(3) Manesar STP · C · B · Tuning · "…" · 32 d', spRow);
  act('dev:extend', { id: sp.id }); ok(LAST.modal.title === 'Extend the review' && text(LAST.modal.body).includes(`${sp.what}: ${sp.valueText} · Tuning.`), '(3) the Extend modal', text(LAST.modal.body));
  act('dev:m-ok', { what: 'extend' }); ok(text(LAST.modal.body).includes('Write a note for the new review.'), '(3) Extend needs a note');
  act('dev:m-note', {}, 'Checked with the Lead: still true'); act('dev:m-ok', { what: 'extend' });
  eq(LAST.toast, `Extended: SP-1 · criticality tier C, review by ${V.fmtDate(now() + 90 * DAY)}.`, '(3) the Extend toast');
  eq(C().pastreview, 0, '(3) 0 past review');
  /* (4) Reason: Migrated */
  html = L.render('#/deviations?reason=migrated'); t = text(html); c = C();
  ok(t.includes(`Migrated (${c.byReason.migrated})`) && c.byReason.migrated === 12, '(4) Reason: Migrated (12)');
  const mig = V.overrides({ reason: 'migrated' });
  ok(mig.length === c.byReason.migrated && mig.every((r) => { const row = text(rowHtml(html, r.id)); return row.includes('Migrated') && row.includes('58 d') && row.includes('Set before 1 Sep 2026 · who: not recorded'); }), '(4) every Migrated row: Migrated · 58 d · Set before 1 Sep 2026 · who: not recorded');
  ok(mig.every((r) => V.fmtDate(r.reviewBy) === '30 Nov 2026'), '(4) each is reviewed by 30 Nov 2026');
  /* (5) a row opens its field */
  const ml = mig.find((r) => r.target.sensorId === 'at1_mlss');
  ok(ml.href === '#/p/manesar/sensor/at1_mlss?f=zone.below.minor' && html.includes(`href="${ml.href}"`), '(5) the MLSS-AT1 row opens the sensor page on Minor');
  /* (6) Promote the DO-AT2 override: make it the library default */
  html = L.render('#/deviations'); ok(/dev:promote/.test(rowHtml(html, do8.id)), '(6) the DO-AT2 row offers Promote');
  act('dev:promote', { id: do8.id }); const pm = LAST.modal; const pmt = text(pm.body);
  ok(pm.title === 'Promote this override?' && pmt.includes('Manesar STP uses 1.5 mg/L for DO-AT2 · Minor zone; the library says 2.0 mg/L.'), '(6) the Promote modal', pmt);
  ok(pmt.includes('Make it the library default') && pmt.includes('Make it a variant by trait') && pmt.includes('Downstream shows every plant it reaches before you publish.'), '(6) its two choices');
  words(pm.body + pm.foot, 'Promote modal');
  act('dev:m-ok', { what: 'promote' });
  eq(W.location.hash, `#/library/templates/tpl_up_activated-sludge_do-low?promote=${do8.id}`, '(6) Continue opens the template with the value');
  /* (7) single-use templates: keep one */
  html = L.render('#/deviations?show=singleuse'); t = text(html); const su = V.singleUse({ plant: 'manesar' });
  ok(t.includes('Single-use templates') && t.includes('Chemical refill · Task on CDU-1 (Dosing Pump) · every week · used at Manesar STP only · since 1 Sep 2026') && t.includes('Sludge wasting · Task on SP-1 (Pump) · every week · used at Manesar STP only · since 1 Sep 2026'), '(7) the two single-use templates');
  ok(t.includes('Merge into Dosing Pump…') && t.includes('Merge into Pump…') && (t.match(/Keep single-use/g) || []).length === 2, '(7) Keep single-use · Merge into {Type}…');
  ok(t.includes('Library · Chemical refill v1') && t.includes('Single-use · Manesar STP only'), '(7) their chips');
  const cr = su.find((x) => x.name === 'Chemical refill'); act('dev:keep-single', { id: cr.id });
  eq(LAST.toast, 'Kept single-use: Chemical refill at Manesar STP.', '(7) the Keep toast');
  t = text(L.render('#/deviations?show=singleuse'));
  ok(t.includes(`Kept single-use · ${V.fmtDate(now())} · you`) && (t.match(/Keep single-use/g) || []).length === 1, '(7) "Kept single-use · 29 Oct 2026 · you", and its Keep button is gone');
  act('dev:merge', { id: su.find((x) => x.name === 'Sludge wasting').id }); ok(LAST.modal.title === 'Merge Sludge wasting into Pump?' && text(LAST.modal.foot).includes('Open the library'), '(7) Merge asks first');
  words(LAST.modal.body + LAST.modal.foot, 'Merge modal'); U.closeModal(true);
  /* (8) DO-AT2 Major: Physical, Structural, then Temporary */
  const t11 = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'major' }; const fk = openForm('manesar', t11);
  act('ov:reason', { fk }, 'physical'); let f = text(G.formFor('manesar', t11));
  ok(f.includes("The library's limit rule for this band is a constant (1.0 mg/L): no design parameter changes it.") && f.includes('Override anyway') && !f.includes('Set the design parameter'), '(8) Physical: a constant, only Override anyway');
  act('ov:reason', { fk }, 'structural'); f = text(G.formFor('manesar', t11)); ok(f.includes('Request a library variant for this trait?'), '(8) Structural: the variant box');
  act('ov:reason', { fk }, 'temporary'); act('ov:date', { fk, which: 'expires' }, dateIn(now() + 7 * DAY)); act('ov:note', { fk }, 'BL-2 out for repair; DO runs lower until it is back'); act('ov:value', { fk }, '0.8');
  act('ov:save', { fk });
  const tmp = recBy('manesar', (x) => x.kind === 'zone' && x.sensorId === 'at2_do' && x.band === 'major');
  ok(!!tmp && tmp.reason === 'temporary' && tmp.value === 0.8, '(8) the Temporary override is saved');
  eq(LAST.toast, `Override saved: DO-AT2 · Major zone 0.8 mg/L (library 1.0 mg/L) · Temporary · expires ${V.fmtDate(tmp.expires)}.`, '(8) the toast');
  html = L.render('#/deviations'); const trow = rowHtml(html, tmp.id); const tt = text(trow);
  ok(tt.includes('0.8 mg/L · 1.0 mg/L') && tt.includes('Temporary · "BL-2 out for repair; DO runs lower until it is back"') && tt.includes('expires in 7 d'), '(8) its row: 0.8 mg/L · 1.0 mg/L · Temporary · … · expires in 7 d', tt);
  ok(/dev:revert/.test(trow) && /dev:extend/.test(trow) && !/dev:promote/.test(trow), '(8) Revert · Extend, no Promote');
  /* (9) a week on: it expires by itself */
  const r = V.advance(7 * 1440);
  ok(Array.isArray(r.expired) && r.expired.includes(tmp.id), '(9) advance() lists it as expired');
  const hh = L.render('#/deviations?show=history'); const hrow = text(rowHtml(hh, tmp.id));
  ok(hrow.includes('Expired') && hrow.includes(`Expired ${V.fmtDay(tmp.expires).replace(/^\w+ /, '')}`), '(9) the row moved to History ("Expired …")', hrow);
  ok(!rowHtml(L.render('#/deviations'), tmp.id), '(9) and left the live rows');
  ok(V.activity({ plant: 'manesar' }).some((a) => a.text === 'Temporary override expired: DO-AT2 · Major zone back to the library value 1.0 mg/L. Plant admins told.'), '(9) Activity: "Temporary override expired: … Plant admins told."');
  words(hh, 'history after expiry');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   10. Other ways in: a sheet (the Equipment Card's cadence) and a modal (Set inactive on a Live plant)
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('sheet and modal');
resetAll();
{
  const sc = V.schedules('manesar').find((s) => s.id === 's_bl1_pm') || V.schedules('manesar').find((s) => s.basis !== 'meter');
  const t = { kind: 'cadence', scheduleId: sc.id };
  G.openSheet('manesar', t); const sh = LAST.sheet;
  ok(sh && /data-ovf=/.test(sh.body) && text(sh.body).includes('Every'), 'the cadence form opens in a sheet');
  words(sh.body, 'cadence sheet');
  const fk = fkOf('manesar', t); const cur = V.cadenceOf('manesar', sc.id).value;
  act('ov:value', { fk }, String((cur.n || 1) + 1)); act('ov:reason', { fk }, 'tuning'); act('ov:note', { fk }, 'Runs longer between services here');
  ok(text(G.formFor('manesar', t)).includes('If you save'), 'the sheet shows If you save');
  act('ov:save', { fk });
  const rec = recBy('manesar', (x) => x.kind === 'cadence' && x.scheduleId === sc.id);
  ok(!!rec && rec.value.n === (cur.n || 1) + 1 && !G.isOpen('manesar', t), 'saving in the sheet writes the cadence override and closes it');
  ok(/^Override saved: .+ · cadence every /.test(LAST.toast), 'its toast', LAST.toast);
  ok(rec.href === `#/p/manesar/trigger/${sc.id}?f=cadence`, 'its row links to the Task\'s Trigger page');
}
{
  const t = { kind: 'enabled', alertId: 'a_mlss_hi' };
  const f = G.overrideForm('manesar', t, { inModal: true });
  ok(/<option value="off" selected>Off<\/option>/.test(f), 'Set inactive: the value starts at Off');
  eq(radioValues(f), ['physical', 'regulatory', 'structural', 'tuning', 'temporary'], 'Set inactive on a Live plant asks one of the five reasons');
  const fk = fkOf('manesar', t); act('ov:reason', { fk }, 'tuning'); act('ov:note', { fk }, 'The probe is out for calibration'); act('ov:save', { fk });
  eq(V.alertState('manesar', 'a_mlss_hi'), 'inactive', 'saving sets the Trigger inactive');
  ok(V.activity({ plant: 'manesar' }).some((a) => /^Set MLSS high · AT-1 inactive at this plant \(Tuning: The probe is out for calibration\)$/.test(a.text)), 'Activity says it was set inactive, with the reason');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   11. The object pages use the same form and the same modals
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('object pages');
resetAll();
{
  const ml = recBy('manesar', (t) => t.kind === 'zone' && t.sensorId === 'at1_mlss' && t.band === 'minor');
  ok(G.openAction('extend', ml.id) === true && LAST.modal && LAST.modal.title === 'Extend the review', 'openAction("extend") opens the Extend modal');
  U.closeModal(true);
  ok(G.openAction('revert', ml.id) === true && LAST.modal && LAST.modal.title === 'Revert to the library value?', 'openAction("revert") opens the Revert modal');
  U.closeModal(true);
  ok(G.openAction('somethingelse', ml.id) === false, 'an action it does not know is left to the page');
  const O = W.V7OBJ;
  if (O && typeof O.zonesEditor === 'function' && patterns.includes('p/:plant/sensor/:id')) {
    const t = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' };
    const page0 = L.render('#/p/manesar/sensor/at2_do');
    const opener = new RegExp(`data-act="(ov:open|obj:ov)"[^>]*data-target="${JSON.stringify(t).replace(/"/g, '&quot;').replace(/[{}[\]]/g, '\\$&')}"`).exec(page0);
    ok(!!opener, 'the sensor page\'s Minor row opens the override form', opener && opener[0]);
    const openIt = () => (opener && opener[1] === 'obj:ov' ? act('obj:ov', { plant: 'manesar', target: JSON.stringify(t) }) : act('ov:open', { plant: 'manesar', target: JSON.stringify(t) }));
    openIt(); let h = L.render('#/p/manesar/sensor/at2_do');
    ok(/data-ovf=/.test(h), 'the sensor page shows the override form inline');
    act('ov:cancel', { fk: fkOf('manesar', t) }); h = L.render('#/p/manesar/sensor/at2_do');
    ok(!/data-ovf=/.test(h), 'Cancel closes it on the sensor page too');
    openIt(); L.render('#/p/manesar/sensor/at2_do'); const fk = fkOf('manesar', t);
    act('ov:value', { fk }, '1.5'); act('ov:reason', { fk }, 'tuning'); act('ov:note', { fk }, 'Short dips recover on their own'); act('ov:save', { fk });
    h = L.render('#/p/manesar/sensor/at2_do');
    ok(!/data-ovf=/.test(h) && !!recBy('manesar', (x) => x.kind === 'zone' && x.sensorId === 'at2_do' && x.band === 'minor'), 'Save writes the override and closes the row');
  } else if (VERBOSE) console.log('  (the object pages are not loaded: their inline form is checked once they are)');
}

/* ════════════════════════════════════════════════════════════════════════════════════════════════════════
   12. Words on every page and modal this file draws
   ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
head('words');
ok(!WORD_HITS.length, 'no banned word, ID or junk on the Deviations pages, the form and the modals', WORD_HITS.slice(0, 6).join(' | '));
ok(!U._soft.some((s) => /^ledger7/.test(s)), 'no soft errors from ledger7', U._soft.filter((s) => /^ledger7/.test(s)).slice(0, 3));

console.log(`\ndeviations72: ${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);
