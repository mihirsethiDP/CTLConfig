#!/usr/bin/env node
/* v7 · lib7.test.js — headless test for lib7.js (builder B5). Node only, no dependencies.
   Loads every asset in prototype.html's order with smoke.js's stub DOM (object7.js is replaced by a stub V7OBJ when it
   is missing, so the type page wrapper is still exercised), boots V7, then walks chapter 10 and 11 of the story:
   library list → type page → draft → Where it lands → publish (normal and safety) → Differences (all plants and one plant)
   → back to the library / keep / suggest, through the registered action handlers. Every rendered page is scanned with
   smoke.js's checker (banned words, IDs, junk). Usage: node tests/lib7.test.js [-v] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const smoke = require('./smoke.js');

const VERBOSE = process.argv.includes('-v');
const ROOT = path.resolve(__dirname, '..');
const A = path.join(ROOT, 'assets');
const ORDER = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'core7.js', 'ui7.js', 'plant7.js', 'object7.js', 'lib7.js'];

smoke.installDom();
const W = global;
const loaded = []; const stubbed = [];
for (const f of ORDER) {
  const file = path.join(A, f);
  if (!fs.existsSync(file)) {
    if (f === 'object7.js') {
      stubbed.push(f);
      W.V7OBJ = { calls: [], render(o) { this.calls.push(o); return W.V7UI.page({ crumbs: [{ label: 'Library', href: '#/library' }, { label: o.code }], title: 'Type ' + o.code, tabs: [], body: '<p>stub body</p>', aside: o.aside }); } };
    } else stubbed.push(f);
    continue;
  }
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
  loaded.push(f);
}
const V = W.V7; const UI = W.V7UI; const L = W.V7LIB;
// integrator: verbatim library/workbook text (e.g. "rotating machine") is a warning in smoke.js, so filter it the same way here
const isData = smoke.isDataIn ? smoke.isDataIn(smoke.corpusOf(W)) : null;
V.boot();

let pass = 0; const fails = [];
function ok(cond, msg, extra) { if (cond) { pass++; if (VERBOSE) console.log('  ok  ' + msg); } else { fails.push(msg + (extra ? '  ← ' + extra : '')); console.log('  FAIL ' + msg + (extra ? '  ← ' + extra : '')); } }
const text = (html) => smoke.visibleText(html);
const pages = [];
function render(p) {
  const html = UI.renderPath('#/' + p);
  pages.push([p, html]);
  const bad = smoke.scan(html, { ids: true, isData }).filter((f) => f.kind !== 'data-word');
  ok(!bad.length, `words on screen: #/${p}`, bad.map((b) => `${b.kind} "${b.word}" in …${b.ctx}…`).join(' | '));
  ok(!/This page could not be shown/.test(html), `renders without error: #/${p}`);
  return html;
}
function el(attrs, extra) { return Object.assign({ getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null), closest: () => null, type: 'text' }, extra || {}); }
const act = (name, attrs, extra) => { const fn = UI._handlers[name]; if (!fn) throw new Error('no handler ' + name); return fn(el(attrs || {}, extra)); };
const rowsOf = (html) => (html.match(/<tr[^>]*data-href="#\/library\/[^"]+"/g) || []).length;
const lastToast = () => (UI._last && UI._last.toast) || '';
function confirmLast() { const m = UI._last.modal; const id = m && /data-id="(c\d+)"/.exec(m.foot || ''); if (!id) throw new Error('no confirm open'); return UI._handlers['ui:confirm'](el({ 'data-id': id[1] })); }

console.log(`lib7 test · loaded ${loaded.length} assets${stubbed.length ? ' · stubbed/missing: ' + stubbed.join(', ') : ''}`);

/* ── 1. the library list ─────────────────────────────────────────────────────────────────────────────── */
let h = render('library');
const types = V.libTypes();
ok(types.length === 56, 'V7 has 56 types', types.length);
ok(rowsOf(h) === 56, 'library lists all 56 types as rows');
ok(/Tanks and basins/.test(h) && /Pumps, blowers and drives/.test(h), 'grouped by family');
ok(/Grouping equipment into treatment steps, and readings on pipes between equipment — next phase\./.test(text(h)), 'next-phase box (rule 1)');
ok(/Open Skeleton Tank/.test(h) && /3 plants · 10 equipment/.test(text(h)), 'plant counts shown');
ok(/Published lately/.test(h) && /Clarifier Tank · version 2/.test(text(h)), 'seeded Clarifier v2 shows as published');
h = render('library?show=used');
ok(rowsOf(h) === types.filter((t) => t.plantCount).length, 'filter: used at a plant');
act('lib:search', {}, { value: 'blower' });
h = render('library');
ok(/>Blower</.test(h) && !/>Open Skeleton Tank</.test(h), 'search narrows the list');
act('lib:search', {}, { value: 'zzzz' }); h = render('library');
ok(/No type matches/.test(h) && /lib:search-clear/.test(h), 'search with no match offers to clear');
act('lib:search-clear'); h = render('library');
ok(rowsOf(h) === 56, 'search cleared');

/* ── 2. the type page without a draft ─────────────────────────────────────────────────────────────────── */
h = render('library/OS_TANK');
if (W.V7OBJ.calls) { const c = W.V7OBJ.calls[W.V7OBJ.calls.length - 1]; ok(c && c.mode === 'type' && c.code === 'OS_TANK' && c.tab === 'readings' && /Library · version 1/.test(c.aside), 'calls V7OBJ.render({mode:type, code, tab, aside})'); }
ok(/Library · version 1/.test(text(h)) && /it becomes a draft/.test(text(h)), 'aside without a draft explains how to start one');
ok(/Used at/.test(h) && /#\/p\/manesar\/equipment/.test(h), 'aside lists the plants using it');
h = render('library/OS_TANK/tasks');
if (W.V7OBJ.calls) ok(W.V7OBJ.calls[W.V7OBJ.calls.length - 1].tab === 'tasks', 'tab passes through');
h = render('library/NOPE');
ok(/No such equipment type/.test(h), 'unknown code: not found page');
h = render('library/CLARIFIER');
ok(/Published versions/.test(h) && /Version 2/.test(h), 'type aside lists published versions');
ok(/changed at plants/.test(text(h)) && /differences\?type=CLARIFIER/.test(h), 'type aside links to its differences');
/* a failing object page degrades to the read-only type page, with the same aside */
{ const O = W.V7OBJ; W.V7OBJ = { render() { throw new Error('boom'); } }; const ce = console.error; console.error = () => {}; const x = UI.renderPath('#/library/BLW'); console.error = ce; W.V7OBJ = O;
  ok(/Motor current/.test(x) && /Library · version 1/.test(x) && !/could not be shown/.test(x), 'V7OBJ.render throwing → read-only type page'); }
/* the fallback page renders on its own too (when object7.js is missing) */
const fb = L._fallbackType(V.libType('BLW'), 'readings', L.aside('BLW'));
ok(/Motor current/.test(fb) && /class="bb/.test(fb) && /Next phase: connections/.test(fb), 'fallback type page: readings with band bars and the next-phase box');
['issues', 'tasks', 'details'].forEach((tb) => { const x = L._fallbackType(V.libType('BLW'), tb, ''); ok(smoke.scan(x, { isData }).filter((f) => f.kind !== 'data-word').length === 0 && x.length > 200, 'fallback tab ' + tb); });

/* ── 3. a normal draft: Where it lands, publish ───────────────────────────────────────────────────────── */
let r = V.editLib('OS_TANK', { reading: 'Level', dir: 'above', bands: { caution: 80, minor: null, major: 95, emergency: null } });
ok(r.ok, 'editLib makes a draft');
h = render('library/OS_TANK');
const th = text(h);
ok(/Draft · version 2/.test(th) && /Level above: Caution 85% → 80%/.test(th), 'aside shows the draft and its change');
ok(/Where it lands/.test(th) && /Reaches 3 plants · 6 values change/.test(th), 'Where it lands totals line (true counts)', th.match(/Reaches[^.]*/) && th.match(/Reaches[^A-Z]*/)[0]);
ok(/EQ-1 · Level Caution above 85% → 80%/.test(th), 'per plant: from → to');
ok(/Plants that changed a value keep it/.test(th), 'normal kind line');
ok(/Not used at Bawal WTP/.test(th), 'plants not using the type are named');
ok(/Publish version 2 to 3 plants/.test(th) && /data-act="lib:publish"/.test(h), 'one primary Publish button');
h = render('library');
ok(/A draft is not published yet/.test(text(h)) && /Reaches 3 plants/.test(text(h)), 'library list leads with the draft');
let res = act('lib:publish', { 'data-code': 'OS_TANK' });
ok(res === false && /change note/.test(lastToast()) && V.libVersion('OS_TANK') === 1, 'publish refuses without a note');
act('lib:field', { 'data-form': 'pub:OS_TANK', 'data-name': 'note' }, { value: 'Earlier warning before the tank tops out' });
h = render('library/OS_TANK');
ok(/Earlier warning before the tank tops out/.test(h), 'typed note survives a re-render');
res = act('lib:publish', { 'data-code': 'OS_TANK' });
ok(res === undefined && V.libVersion('OS_TANK') === 2 && !V.libDraft('OS_TANK'), 'publish → version 2, draft gone', lastToast());
ok(/Published Open Skeleton Tank version 2: 6 values change at DigitalPaani, Vedanta ETP and Manesar STP/.test(lastToast()), 'toast says what happened (values, with the plants named)', lastToast());
ok(V.activity({ plant: 'manesar' }).some((a) => /Open Skeleton Tank v2 published/.test(a.text)), 'Manesar Activity has the dated note');
h = render('library/OS_TANK');
ok(/Library · version 2/.test(text(h)) && /Earlier warning before the tank tops out/.test(text(h)), 'after publish the aside shows the new version and its note');

/* ── 4. a draft that reaches a plant that changed it (keeps its own value) ─────────────────────────────── */
r = V.editLib('CLARIFIER', { alert: 'Sludge blanket high', hold: 20 });
ok(r.ok, 'editLib alert timing');
h = render('library/CLARIFIER'); const tc = text(h);
ok(/keeps its own value and will show Library changed since/.test(tc) || /Nothing changes here/.test(tc), 'changed-here plants keep their value', (tc.match(/Where it lands.{0,300}/) || [''])[0]);
act('ui:close'); act('lib:discard', { 'data-code': 'CLARIFIER' }); confirmLast();
ok(!V.libDraft('CLARIFIER') && /Draft discarded/.test(lastToast()), 'discard the draft (with a confirm)');

/* ── 4b. round 2 (Q2, Q3, Q4): the library moves to the value a plant kept (Diffuser Tank, MLSS low 2000 → 2500) ── */
h = render('library/OS_TANK_DF');
ok(/At the plants: 1 reading follows the library · 1 changed at Manesar STP\./.test(text(h)), 'type page counts changed readings per plant, with no "here"', (text(h).match(/At the plants[^.]*\./) || [''])[0]);
r = V.editLib('OS_TANK_DF', { reading: 'MLSS', dir: 'below', bands: { minor: 2500 } });
h = render('library/OS_TANK_DF'); const tsame = text(h);
ok(r.ok && /1 value kept here, now the same as the library \(AT-1\)/.test(tsame) && /keeps its own 2500 mg\/L — now the same as the library/.test(tsame) && !/will show Library changed since/.test(tsame), 'Where it lands: AT-1 keeps 2500 mg/L, now the same as the library (no Library changed since)', (tsame.match(/Where it lands.{0,500}/) || [''])[0]);
act('lib:field', { 'data-form': 'pub:OS_TANK_DF', 'data-name': 'note' }, { value: 'Low MLSS warns at 2500 mg/L' });
act('lib:publish', { 'data-code': 'OS_TANK_DF' });
ok(V.libVersion('OS_TANK_DF') === 2 && /1 value changes at Manesar STP; 1 value there keeps its own, now the same as the library/.test(lastToast()), 'publish toast counts values, not plants', lastToast());
const at1 = V.overrides({ plant: 'manesar' }).find((o) => o.target.sensorId === 'at1_mlss');
h = render('p/manesar/differences'); const tdif = text(h);
ok(at1 && at1.state === 'same' && /AT-1 · MLSS \(MLSS-AT1\) · Minor below Now the same as the library Here 2500 mg\/L Library 2500 mg\/L Now the same as the library \(it was 2000 mg\/L when this was changed\): going back changes nothing/.test(tdif), 'Differences: "Now the same as the library", not Library changed since', (tdif.match(/AT-1 · MLSS.{0,260}/) || [''])[0]);
ok(!V.overrides({ plant: 'manesar', state: 'libchanged' }).some((o) => o.id === at1.id) && L.counts('manesar').libchanged === V.overrides({ plant: 'manesar', state: 'libchanged' }).length, 'it is not counted under Library changed since');
h = render('p/manesar/eq/at1');
ok(/Minor below 2500 mg\/L now the same as the library/.test(text(h)), 'AT-1\'s equipment page says it plainly too', (text(h).match(/Falls below.{0,160}/) || [''])[0]);
act('lib:revert', { 'data-id': at1.id });
ok(/now the same as/.test(UI._last.modal.body) && /the value does not change/.test(UI._last.modal.body), 'Back to the library value says nothing changes');
confirmLast();
ok(V.overrides({ state: 'ended' }).some((o) => o.id === at1.id) && V.limitsOf('manesar', 'at1_mlss', 'below').bands.minor === 2500 && V.limitsOf('manesar', 'at1_mlss', 'below').perBand.minor.chip === 'lib', 'going back ends the difference; AT-1 stays at 2500, From the library');

/* ── 5. a safety change: needs a reason, ends the plant's own value ───────────────────────────────────── */
r = V.editLib('OS_TANK', { reading: 'pH', dir: 'below', bands: { caution: null, minor: 6, major: 5.5, emergency: 4.5 } });
ok(r.ok, 'safety draft');
h = render('library/OS_TANK'); const ts = text(h);
ok(/Safety change — it changes an Emergency limit/.test(ts) && /Why this safety change/.test(ts), 'safety kind line and reason field');
ok(/pH 4\.0 → pH 4\.5/.test(ts) && /its own value ends/.test(ts), 'Vedanta\'s own Emergency value is shown as ending');
act('lib:field', { 'data-form': 'pub:OS_TANK', 'data-name': 'note' }, { value: 'Emergency pH at 4.5 everywhere' });
res = act('lib:publish', { 'data-code': 'OS_TANK' });
ok(res === false && /needs a reason/.test(lastToast()), 'safety publish refuses without a reason');
act('lib:field', { 'data-form': 'pub:OS_TANK', 'data-name': 'reason' }, { value: 'Acid spills reach equalisation tanks at more than one site' });
act('lib:publish', { 'data-code': 'OS_TANK' });
ok(V.libVersion('OS_TANK') === 3, 'safety change published as version 3', lastToast());
const ended = V.overrides({ state: 'ended' });
ok(ended.some((o) => o.plant === 'vedanta' && /safety change/i.test(o.endedNote || '')), 'Vedanta\'s change ended with a note');

/* ── 6. Differences: all plants, one plant, filters ─────────────────────────────────────────────────── */
h = render('differences'); const td = text(h);
const live = V.overrides({});
ok(live.length > 0 && (h.match(/class="dif[ "]/g) || []).length === live.length, 'all-plants page lists every live difference', `${(h.match(/class="dif[ "]/g) || []).length} vs ${live.length}`);
ok(/Manesar STP/.test(td) && /Bawal WTP/.test(td), 'grouped by plant');
ok(/Library changed since/.test(td) && /The library was 5 min when this was changed/.test(td), 'library-changed row shows the base it was changed from');
ok(/Reason not recorded \(changed before reasons were kept\)/.test(td), 'unrecorded reason');
ok(/Not in the library/.test(td) && /Suggest for the library/.test(td), 'not-in-library rows offer Suggest');
const first = (h.match(/<li class="dif[^"]*">[\s\S]*?<\/li>/) || [''])[0];
ok(/Library changed since|Review due/.test(text(first)), 'attention first: the first row needs attention', text(first).slice(0, 80));
['libchanged', 'review', 'unrecorded', 'notinlib', 'ended'].forEach((s) => {
  const x = render('differences?show=' + s); const n = (x.match(/<li class="dif[ "]/g) || []).length; const c = L.counts(null)[s];
  ok(n === c, `filter ${s}: ${c} rows`, `${n}`);
});
h = render('differences?type=BLW');
ok(/Only/.test(h) && (h.match(/<li class="dif[ "]/g) || []).length === live.filter((o) => o.typeCode === 'BLW').length, 'type filter');
h = render('p/manesar/differences');
ok((h.match(/<li class="dif[ "]/g) || []).length === V.overrides({ plant: 'manesar' }).length, 'Manesar page lists its own differences');
ok(/Differences from the library/.test(h), 'plant page section title');
h = render('p/digitalpaani/differences');
ok(/uses the library's values everywhere/.test(text(h)), 'a plant with none says so');
render('p/nowhere/differences');

/* ── 7. actions on a difference ─────────────────────────────────────────────────────────────────────── */
const mov = live.find((o) => o.state === 'libchanged');
ok(!!mov, 'there is a Library changed since difference');
if (mov) {
  act('lib:revert', { 'data-id': mov.id });
  ok(/Back to the library value\?/.test(UI._last.modal.title) && /goes from/.test(UI._last.modal.body), 'revert asks first, stating from → to');
  confirmLast();
  ok(V.overrides({ state: 'ended' }).some((o) => o.id === mov.id), 'revert ends the difference', lastToast());
  ok(/is back to the library value/.test(lastToast()), 'revert toast');
}
const unrec = V.overrides({}).find((o) => o.reason === 'unrecorded');
act('lib:keep', { 'data-id': unrec.id });
ok(/Keep this plant's value/.test(UI._last.modal.title) && /Tuned for this plant/.test(UI._last.modal.body) && /For now, until a date/.test(UI._last.modal.body), 'keep dialog offers the two reasons');
ok(smoke.scan(UI._last.modal.body, { isData }).filter((f) => f.kind !== 'data-word').length === 0, 'keep dialog words');
res = act('lib:keep-save', { 'data-id': unrec.id });
ok(res === false && /Write a note/.test(lastToast()), 'keep needs a note for an unrecorded change');
act('lib:field', { 'data-form': 'keep', 'data-name': 'note' }, { value: 'The probe sits low in this tank' });
act('lib:field', { 'data-form': 'keep', 'data-name': 'reviewBy', 'data-kind': 'tuned' }, { value: '2027-03-01' });
act('lib:keep-save', { 'data-id': unrec.id });
const kept = V.overrides({ state: 'all' }).find((o) => o.id === unrec.id);
ok(kept && kept.reason === 'tuned' && kept.note === 'The probe sits low in this tank' && /Mon 1 Mar/.test(kept.reviewByText), 'keep → tuned with note and review date', kept && `${kept.reason} ${kept.reviewByText}`);
const other = V.overrides({}).find((o) => o.reason === 'unrecorded');
act('lib:keep', { 'data-id': other.id });
act('lib:field', { 'data-form': 'keep', 'data-name': 'note' }, { value: 'Until the new diffusers are in' });
act('lib:field', { 'data-form': 'keep', 'data-name': 'until', 'data-kind': 'fornow' }, { value: '2026-11-30' });
act('lib:keep-save', { 'data-id': other.id });
const fn = V.overrides({ state: 'all' }).find((o) => o.id === other.id);
ok(fn && fn.reason === 'fornow' && fn.until != null, 'keep "for now, until" sets the date it goes back', fn && fn.reasonLabel);
act('lib:field', { 'data-form': 'keep', 'data-name': 'until', 'data-kind': 'fornow' }, { value: '2026-01-01' });
const nil = V.overrides({}).find((o) => o.reason === 'notinlib' && o.typeName);
const before = V.suggestions().length;
act('lib:suggest', { 'data-id': nil.id });
ok(/Suggest for the library/.test(UI._last.modal.title) && /Should every/.test(UI._last.modal.body), 'suggest dialog with a drafted text');
act('lib:suggest-send', { 'data-id': nil.id });
ok(V.suggestions().length === before + 1 && /Suggested for the library/.test(lastToast()), 'suggestion logged', lastToast());
h = render('library');
ok(/suggestion from a plant/.test(text(h)), 'library list shows the suggestion');
h = render(`library/${nil.typeCode}`);
ok(/A suggestion from a plant/.test(text(h)), 'type aside shows the suggestion');
ok(V.activity({}).some((a) => /Suggested a library change/.test(a.text)), 'suggestion in Activity');

/* ── 8. after the clock moves ─────────────────────────────────────────────────────────────────────────── */
V.advance(1440);
['library', 'library/BLW', 'differences', 'differences?show=review', 'p/manesar/differences', 'p/vedanta/differences', 'p/bawal/differences'].forEach(render);

/* ── 9. every type page renders ───────────────────────────────────────────────────────────────────────── */
let typeFails = 0;
types.forEach((t) => { const x = UI.renderPath('#/library/' + t.code); const bad = smoke.scan(x, { isData }).filter((f) => f.kind !== 'data-word'); if (bad.length || /could not be shown/.test(x)) { typeFails++; if (VERBOSE) console.log('   ', t.code, bad.map((b) => b.word).join(',')); } });
ok(typeFails === 0, 'all 56 type pages render clean', typeFails + ' failed');
const soft = (UI._soft || []).filter((s) => /^lib7/.test(s) && !/boom/.test(s));
ok(!soft.length, 'no soft errors from lib7', soft.slice(0, 3).join(' | '));

console.log(`\nlib7: ${pass} passed, ${fails.length} failed · ${pages.length} pages rendered`);
if (fails.length) { console.log(fails.map((f) => ' - ' + f).join('\n')); process.exit(1); }
process.exit(0);
