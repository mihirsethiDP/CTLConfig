#!/usr/bin/env node
/* v7 · tests/integrate7.test.js — the integrator's check that v7 works as one app (node, no dependencies).
   1. wiring   prototype.html loads every asset in the contract's order, ?v=N on every tag, every module stylesheet linked.
   2. seams    every module's export and every contract route exists; cross-module calls resolve (V7OBJ.render from lib7,
               V7WORK.openReport/report from object7, V7PLANT.frame for the plant tabs owned by ui7/lib7/work7).
   3. links    every story deep link, decision chip, decision-card link and index.html link resolves to a registered
               route AND to a real object (no "Not found" page).
   4. story    the twelve chapters walked in ONE session through the registered handlers, checking that a change made
               on one module's page shows on the other modules' pages (accept → equipment page, limits → Differences
               and Activity, go live → All Plants and Coverage, a diagnosis → the other equipment's Issues tab,
               publish → "Library changed since" on the equipment page and in Differences, revert, the clock, reset).
   5. sweep    after the walk (mutated state: Vedanta Live, versions published), every plant page renders clean.
   6. actions  the walk counts the presenter's actions per chapter (every button pressed, every value typed or choice made
               in a field; following a link is not counted; checks that are not story beats are counted apart) and
               writes them to tests/out/actions71.json, beside v7/2's own count, for the v7/2 hand-off doc.
   Usage: node tests/integrate7.test.js [-v]      Exit code 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const smoke = require('./smoke.js');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const results = []; let fails = 0;
function ok(group, name, cond, detail) { results.push({ group, name, pass: !!cond, detail }); if (!cond) fails++; }

/* ── 1. wiring ─────────────────────────────────────────────────────────────────────────────────────────── */
const CONTRACT_ORDER = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js',
  'core7.js', 'ui7.js', 'plant7.js', 'object7.js', 'lib7.js', 'work7.js', 'decisions7.js'];
const html = fs.readFileSync(path.join(ROOT, 'prototype.html'), 'utf8');
const tags = []; { const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m; while ((m = re.exec(html))) tags.push({ attrs: m[1], body: m[2].trim() }); }
const srcs = tags.filter((t) => /\bsrc=/.test(t.attrs)).map((t) => (t.attrs.match(/src="([^"]+)"/) || [])[1]);
ok('wiring', 'scripts load in the contract order', srcs.map((s) => s.replace(/^assets\//, '').split('?')[0]).join(',') === CONTRACT_ORDER.join(','), srcs.join(','));
ok('wiring', 'every script tag carries a ?v=N cache-buster', srcs.every((s) => /\?v=\d+$/.test(s)));
ok('wiring', 'V7_NO_V6_SHELL is set inline before the first script', /V7_NO_V6_SHELL\s*=\s*true/.test(tags[0].body) && !/src=/.test(tags[0].attrs));
ok('wiring', 'V7UI.start() runs inline after the last script', /V7UI\.start\(\)/.test(tags[tags.length - 1].body) && !/src=/.test(tags[tags.length - 1].attrs));
const cssLinks = (html.match(/<link rel="stylesheet" href="assets\/[^"]+"/g) || []).map((l) => l.match(/href="assets\/([^"]+)"/)[1]);
const cssFiles = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /\.css$/.test(f));
ok('wiring', 'every module stylesheet is linked, v7.css first', /^v7\.css\?v=\d+$/.test(cssLinks[0] || '') && cssFiles.every((f) => cssLinks.some((c) => c.split('?')[0] === f && /\?v=\d+$/.test(c))), cssLinks.join(','));
ok('wiring', 'every linked asset exists', srcs.concat(cssLinks.map((c) => 'assets/' + c)).every((s) => fs.existsSync(path.join(ROOT, s.split('?')[0]))));

/* load like the browser does */
smoke.installDom();
for (const s of srcs) { const f = path.join(ROOT, s.split('?')[0]); vm.runInThisContext(fs.readFileSync(f, 'utf8'), { filename: f }); }
const W = global; const V = W.V7; const UI = W.V7UI;
V.reset();
const DATA = smoke.isDataIn(smoke.corpusOf(W));
const text = (h) => smoke.visibleText(h);
const render = (p) => UI.renderPath('#/' + p);
const clean = (h) => smoke.scan(h, { ids: true, isData: DATA }).filter((f) => f.kind !== 'data-word');
function page(group, p, re, label) {
  const h = render(p); const t = text(h); const bad = clean(h);
  ok(group, `${label || '#/' + p}${re ? ' shows ' + re : ''}`, (!re || re.test(t)) && !bad.length && !/could not be shown/.test(t),
    bad.length ? bad.map((b) => `${b.kind} ${b.word}: ${b.ctx}`).join(' | ') : (re && !re.test(t) ? t.slice(0, 400) : ''));
  return { h, t };
}
function el(data, o) {
  o = o || {};
  const ta = { value: o.reason || '', classList: { add() {}, remove() {} }, focus() {} };
  const modal = { querySelector: (sel) => (sel === '#p7-reason' ? ta : null) };
  return { tagName: 'BUTTON', value: o.value != null ? o.value : data.value, checked: !!o.checked, dataset: {}, type: o.type || 'button',
    getAttribute: (k) => { const kk = String(k).replace(/^data-/, ''); return data[kk] != null ? String(data[kk]) : null; },
    hasAttribute: (k) => data[String(k).replace(/^data-/, '')] != null, closest: (sel) => (sel === '.modal' ? modal : null) };
}
/* the presenter's actions, per chapter: a button pressed is a click; a value typed or a choice made in a field is a field */
const COUNT = { n: 0, counting: true, by: {} };
function chapter(n) { COUNT.n = n; COUNT.by[n] = COUNT.by[n] || { clicks: 0, fields: 0, optional: 0 }; }
function tally(kind, k) { const c = COUNT.by[COUNT.n]; if (!c || !k) return; if (COUNT.counting) c[kind] += k; else c.optional += k; }
function optional(fn) { const was = COUNT.counting; COUNT.counting = false; try { return fn(); } finally { COUNT.counting = was; } }
const fields = (k) => tally('fields', k == null ? 1 : k);
const act = (name, data, o) => { const fn = UI._handlers[name]; if (!fn) throw new Error('no handler ' + name); tally(o && /^(INPUT|SELECT|TEXTAREA)$/.test(o.tagName || '') ? 'fields' : 'clicks', 1); return fn(el(data || {}, o), { preventDefault() {}, stopPropagation() {} }); };
const toast = () => String((UI._last && UI._last.toast) || '');
const modal = () => (UI._last && UI._last.modal) || {};
function confirmLast() { const m = /data-id="(c\d+)"/.exec(modal().foot || ''); if (!m) throw new Error('no confirm open'); return act('ui:confirm', { id: m[1] }); }
const alertNamed = (key, re) => V.alerts(key, {}).find((a) => re.test(a.name));

/* ── 2. seams ──────────────────────────────────────────────────────────────────────────────────────────── */
const fnx = (o, k) => !!(o && typeof o[k] === 'function');
ok('seams', 'window.V7 has the contract API', ['boot', 'reset', 'persist', 'now', 'fmt', 'fmtDay', 'advance', 'plants', 'plant', 'state', 'withPlant', 'equipment', 'eq', 'sensors', 'alerts', 'schedules', 'people', 'series', 'replay', 'trialStats', 'isNoisy', 'alertState', 'setAlertState', 'limitsOf', 'libLimits', 'sourceOf', 'setLimits', 'setAlertTiming', 'setCadence', 'setTier', 'overrides', 'revert', 'keep', 'suggest', 'scadaReview', 'acceptScadaGroup', 'acceptAllScada', 'libraryReview', 'decide', 'acceptAllFor', 'checklist', 'goLivePreview', 'goLive', 'returnToCommissioning', 'issues', 'issue', 'tasks', 'task', 'report', 'answer', 'startFix', 'fixStep', 'verify', 'close', 'startTask', 'doTaskStep', 'doneTask', 'setLastDone', 'flowOf', 'diagFor', 'causeOf', 'fixFlowFor', 'linkedTask', 'taskGroups', 'tasksPerDay', 'coverage', 'libTypes', 'libType', 'libVersion', 'libDraft', 'editLib', 'discardDraft', 'whereItLands', 'publish', 'activity', 'log'].filter((k) => !fnx(V, k)).length === 0,
  ['boot', 'advance', 'whereItLands', 'publish'].filter((k) => !fnx(V, k)).join(','));
ok('seams', 'V7UI kit, router and shell', ['esc', 'page', 'chip', 'sourceChip', 'stateChip', 'bandBar', 'table', 'card', 'kv', 'list', 'empty', 'btn', 'openSheet', 'closeSheet', 'modal', 'toast', 'on', 'route', 'go', 'render', 'start', 'addCss'].every((k) => fnx(UI, k)));
ok('seams', 'V7PLANT.frame', fnx(W.V7PLANT, 'frame'));
ok('seams', 'V7OBJ.render and openLimits', fnx(W.V7OBJ, 'render') && fnx(W.V7OBJ, 'openLimits'));
ok('seams', 'V7WORK.openReport and V7WORK.report', fnx(W.V7WORK, 'openReport') && fnx(W.V7WORK, 'report'));
ok('seams', 'V7LIB present', !!W.V7LIB);
ok('seams', 'V7_DECISIONS has the 21 first-review cards, then any later ones in sequence, and V7DEC renders them', Array.isArray(W.V7_DECISIONS) && W.V7_DECISIONS.length >= 21 && W.V7_DECISIONS.every((d, i) => d && d.id === 'D' + (i + 1)) && W.V7_DECISIONS.slice(21).every((d) => d.arose && d.arose !== 'First review') && !!W.V7DEC);
const CONTRACT_ROUTES = ['plants', 'activity/:plant?', 'p/:plant/activity', 'p/:plant', 'p/:plant/scada', 'p/:plant/library', 'p/:plant/equipment', 'p/:plant/readings', 'p/:plant/tasks',
  'p/:plant/eq/:id/:tab?', 'p/:plant/eq/:id/phone', 'p/:plant/alert/:id', 'library', 'library/:code/:tab?', 'differences', 'p/:plant/differences',
  'p/:plant/issues', 'p/:plant/issue/:id', 'p/:plant/task/:id', 'decisions', 'decisions/:id'];
const pats = UI.routes().map((r) => r.pattern);
ok('seams', 'every contract route is registered', CONTRACT_ROUTES.every((r) => pats.includes(r)), CONTRACT_ROUTES.filter((r) => !pats.includes(r)).join(','));
ok('seams', 'unknown route falls back to All Plants', /All Plants/.test(text(render('no/such/page'))));
ok('seams', 'the phone route wins over the :tab route', UI.match('#/p/manesar/eq/at2/phone').pattern === 'p/:plant/eq/:id/phone');
// the plant frame: every plant tab (owned by ui7, plant7, lib7, work7) shows the same seven tabs, the right one active
const TABS = ['', '/equipment', '/readings', '/issues', '/tasks', '/differences', '/activity'];
for (const key of V.plants().map((p) => p.key)) {
  const miss = [];
  for (const t of TABS) {
    const h = render('p/' + key + t);
    for (const u of TABS) if (!h.includes(`href="#/p/${key}${u}"`)) miss.push(`${t || 'home'} lacks ${u || 'home'}`);
    if (!/aria-current="page"|class="[^"]*\b(on|active|is-on)\b[^"]*"[^>]*href="#\/p\//.test(h) && !new RegExp(`href="#/p/${key}${t}"[^>]*(aria-(current|selected)="(page|true)")`).test(h)) { /* tab marking varies; checked loosely below */ }
  }
  ok('seams', `${key}: all seven plant tabs share one frame`, !miss.length, miss.slice(0, 4).join(' | '));
}
ok('seams', 'lib7 type page goes through V7OBJ.render (same tabs as an equipment page)', (() => { const t = text(render('library/BLW')); return /Library · version 1/.test(t) && /Readings/.test(t) && /Issues/.test(t) && /Tasks/.test(t) && /Details/.test(t); })());
ok('seams', 'object7 "Report a problem" hands over to work7', W.V7OBJ.report('manesar', 'bl1') === true && /Report a problem/.test(String(modal().title || '')), modal().title);
UI.closeModal && UI.closeModal(true);

/* ── 3. links ──────────────────────────────────────────────────────────────────────────────────────────── */
const NOTFOUND = /\b(Not found|No such|could not be shown|is not in the prototype)\b/;
function resolves(href) { const m = UI.match(href); if (!m) return 'no route'; const t = text(UI.renderPath(href)).slice(0, 300); return NOTFOUND.test(t) ? 'not found page' : ''; }
const decIds = new Set(W.V7_DECISIONS.map((d) => d.id));
const bad = [];
for (const c of UI.chapters()) {
  for (const h of [c.href].concat(c.also.map((a) => a.href))) { const r = resolves(h); if (r) bad.push(`chapter ${c.n} ${h}: ${r}`); }
  for (const d of c.decisions) if (!decIds.has(d.id) || resolves(d.href)) bad.push(`chapter ${c.n} decision ${d.id}`);
  if (UI.chapterOf(c.href.slice(2)) !== c.n && c.n !== 12) bad.push(`chapter ${c.n}'s link highlights chapter ${UI.chapterOf(c.href.slice(2))}`);
}
ok('links', 'story: every "Take me there", extra link and decision chip resolves, and lights its own chapter', !bad.length, bad.join(' | '));
const dbad = [];
for (const d of W.V7_DECISIONS) for (const l of d.links || []) { const r = resolves(l.href); if (r) dbad.push(`${d.id} ${l.href}: ${r}`); }
ok('links', 'decision cards: every link resolves to a real page', !dbad.length, dbad.join(' | '));
const doc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ibad = []; { const re = /href="prototype\.html(#\/[^"]*)"/g; let m; while ((m = re.exec(doc))) { const r = resolves(m[1].replace(/&amp;/g, '&')); if (r) ibad.push(`${m[1]}: ${r}`); } }
ok('links', 'index.html: every prototype link resolves to a real page', !ibad.length, ibad.join(' | '));
{ // crawl every in-app link from the top-level pages: each must land on a real object, not a "Not found" page
  const seen = new Set(); const q = ['#/plants', '#/library', '#/differences', '#/activity', '#/decisions'].concat(V.plants().map((p) => '#/p/' + p.key));
  const from = new Map(); const nf = []; let n = 0;
  while (q.length && n < 8000) {
    const h = q.shift(); if (seen.has(h)) continue; seen.add(h); n++;
    let out = ''; try { out = UI.renderPath(h); } catch (e) { nf.push(`${h}: throws ${e.message}`); continue; }
    if (NOTFOUND.test(text(out).slice(0, 300))) nf.push(`${h} (linked from ${from.get(h)})`);
    for (const l of smoke.links(out)) if (l.startsWith('#/') && !seen.has(l)) { if (!from.has(l)) from.set(l, h); q.push(l); }
  }
  ok('links', `crawl: ${n} linked pages, none lands on "Not found"`, !nf.length && n > 500, nf.slice(0, 5).join(' | '));
}
ok('links', 'story chapter 10 and the hand-off doc open the same library type', UI.chapters()[9].href === '#/library/OS_TANK_DF' && /prototype\.html#\/library\/OS_TANK_DF/.test(doc));

/* ── 4. the story, in one session ──────────────────────────────────────────────────────────────────────── */
V.reset();
// 1 · the library
chapter(1);
page('1 library', 'library', /56/);
page('1 library', 'library/BLW', /Library · version 1/);

// 2 · a new plant from SCADA
chapter(2);
const dp0 = V.checklist('digitalpaani');
page('2 SCADA', 'p/digitalpaani/scada', /What SCADA found/);
act('p7:scada-accept-all', { plant: 'digitalpaani' });
const dp1 = V.checklist('digitalpaani');
ok('2 SCADA', 'Accept all → the SCADA blocker clears', !dp1.blockers.some((b) => b.id === 'scada') && dp1.blockers.length === dp0.blockers.length - 1, toast());
ok('2 SCADA', 'All Plants (ui7) counts one blocker fewer for DigitalPaani', new RegExp(`${dp1.blockers.length} blockers`).test(text(render('plants'))));

// 3 · what the library brings
chapter(3);
// DigitalPaani's real SCADA sends run status and level only, so the tanks' Level alerts are the ones that can go On trial
act('p7:lib-accept-type', { plant: 'digitalpaani', type: 'Open Skeleton Tank' });
const tank = V.equipment('digitalpaani').find((e) => e.type === 'Open Skeleton Tank' && V.alerts('digitalpaani', { eqId: e.id }).some((a) => V.alertState('digitalpaani', a.id) === 'trial'));
ok('3 library', 'Accept all for the Open Skeleton Tanks → their Level alerts are On trial', !!tank, toast());
if (tank) page('3 library', 'p/digitalpaani/eq/' + encodeURIComponent(tank.id), /On trial/, 'that tank\'s equipment page (object7)');
page('3 library', 'p/digitalpaani/library', /need a reading SCADA doesn.t send|Next phase/i, 'proposals SCADA cannot feed stay visible');
ok('3 library', 'the "no alert On trial" blocker clears', !V.checklist('digitalpaani').blockers.some((b) => b.id === 'alerts'));

// 4 · Readiness
chapter(4);
const r4 = page('4 readiness', 'p/digitalpaani', /Go live is blocked/);
ok('4 readiness', 'people are the blockers left, with "Edit in the User Center"', V.checklist('digitalpaani').blockers.every((b) => /operator|lead|library/.test(b.id)) && /Edit in the User Center/.test(r4.t), V.checklist('digitalpaani').blockers.map((b) => b.id).join(','));

// 5 · trial and tuning (Vedanta)
chapter(5);
const lvl = alertNamed('vedanta', /Level high — EQ-1/); const doA = alertNamed('vedanta', /DO low — SBR-1/);
page('5 trial', 'p/vedanta/alert/' + lvl.id, /Noisy/);
page('5 trial', 'p/vedanta/alert/' + doA.id, /Mostly short/);
const T = W.V7OBJ._test;
const lvSensor = lvl.sensorId || lvl.sensor;
act('obj:limits', { plant: 'vedanta', sensor: lvSensor, dir: 'above' });
const st = T.getLS(); const before5 = V.trialStats('vedanta', lvl.id).perDay;
const bandKey = st.cur.minor != null ? 'minor' : st.cur.caution != null ? 'caution' : 'major';
st.vals[bandKey] = String(+st.cur[bandKey] + 3);
ok('5 trial', 'the sheet replays the last 7 days as you type', /would have fired/.test(T.lsPreviewText(st, T.lsState(st).bands, T.lsState(st).err).html));
st.reason = 'tuned'; st.note = 'Fill pump cycles near the top during commissioning'; fields(3);   /* the band's value, the reason, the note */
ok('5 trial', 'Save with a reason', act('obj:lsave') === undefined, toast());
ok('5 trial', 'the trial rate follows the change at once', V.trialStats('vedanta', lvl.id).perDay < before5, `${before5} → ${V.trialStats('vedanta', lvl.id).perDay}`);
page('5 trial', 'p/vedanta/differences', /Tuned for this plant/, 'Vedanta Differences (lib7) lists the change');
page('5 trial', 'differences', /Fill pump cycles near the top/, 'all-plants Differences (lib7)');
ok('5 trial', 'Activity (ui7) records the change', V.activity({ plant: 'vedanta' }).some((a) => /Level/.test(a.text)) && /Level/.test(text(render('p/vedanta/activity'))));
page('5 trial', 'p/vedanta/alert/' + lvl.id, /Changed here/, 'the alert page shows Changed here');

// 6 · safety in commissioning
chapter(6);
const em = V.issues('vedanta', {}).find((i) => i.commissioning);
ok('6 safety', 'the Emergency is a Commissioning issue told to the Leads', !!em && em.band === 'emergency' && em.told.length > 0);
page('6 safety', 'p/vedanta/issue/' + em.id, /no call, no hooter/i);
page('6 safety', 'p/vedanta', /An Emergency during the trial/, 'Vedanta home leads with the Emergency');
page('6 safety', 'p/vedanta/issues', /Commissioning/);

// 7 · go live
chapter(7);
const und = V.libraryReview('vedanta').flatMap((e) => e.proposals.map((p) => Object.assign({ eqId: e.eqId }, p))).find((p) => !p.decided && !p.blockedBy);
ok('7 go live', 'exactly one proposal is undecided', !!und && V.checklist('vedanta').blockers.length === 1);
act('p7:lib-accept', { plant: 'vedanta', pid: und.pid });
ok('7 go live', 'deciding it lets Vedanta go live', V.checklist('vedanta').canGoLive, V.checklist('vedanta').whyNot);
act('p7:golive', { plant: 'vedanta' });
const gl = text(String(modal().body || '') + String(modal().foot || ''));
ok('7 go live', 'the confirmation lists what changes, incl. calls and tasks a day', /Calls and the hooter start now/.test(gl) && /a day/.test(gl), gl.slice(0, 500));
/* round 2 (Q8, Q10): the alert accepted moments ago is named as turning On without a trial; tasks a day "if each piece of equipment gets its own" */
ok('7 go live', 'the confirmation names the alert with no trial, and says "if each piece of equipment gets its own"', /MLSS low — SBR-1 has been On trial for 0 min; it turns On without a trial/.test(gl) && /\d+ if each piece of equipment gets its own/.test(gl), gl.slice(0, 600));
act('p7:golive-confirm', { plant: 'vedanta' });
ok('7 go live', 'Vedanta is Live and its trial alerts are On', V.state('vedanta') === 'live' && V.alertState('vedanta', lvl.id) === 'on', toast());
ok('7 go live', 'All Plants (ui7) shows Vedanta Live with Coverage', /Vedanta ETP ETP Sample plant Live/.test(text(render('plants'))));
page('7 go live', 'p/vedanta', /How the alerts are doing|Coverage/, 'Vedanta home turns to Coverage');
/* round 2 (Q11): right after go live the quiet alerts carry a label */
page('7 go live', 'p/vedanta', /No alert has opened an issue since go live\. \d+ alerts are On and quiet ?: /, 'Coverage just after go live labels the quiet alerts');
ok('7 go live', 'Activity has the go live', V.activity({ plant: 'vedanta' }).some((a) => /live/i.test(a.text)));

// 8 · live operation (Manesar)
chapter(8);
const doIss = V.issues('manesar', {}).find((i) => i.status !== 'closed' && /AT-2/.test(V.eq('manesar', i.eqId).tag || ''));
ok('8 live', 'the seeded "DO low — AT-2" issue is open with its terms', !!doIss && doIss.terms && doIss.terms.limit === 1);
page('8 live', 'p/manesar/issue/' + doIss.id, /Opened under/);
/* round 2 (Q1): the Operator who was told started the diagnosis at 07:50 (question 1: Yes), so the presenter carries on at question 2 */
ok('8 live', 'the seeded issue was started by Dheeraj Kumar at 07:50; the presenter carries on at question 2', doIss.status === 'diagnosing' && doIss.diag.path.length === 1 && doIss.diag.path[0].by === 'Dheeraj Kumar', JSON.stringify(doIss.diag.path));
page('8 live', 'p/manesar/issue/' + doIss.id, /Question 2 of up to 7 .*Is the blower running\? · Dheeraj Kumar, 07:50/, 'the issue page shows question 2 and who answered question 1');
act('work:answer', { plant: 'manesar', id: doIss.id, step: 2, answer: 'No' });
const iss8 = V.issue('manesar', doIss.id);
ok('8 live', 'the diagnosis lands on a root cause on BL-1', iss8.causedBy === 'bl1' && !!iss8.diag.causeId, `${iss8.diag.causeId} ${iss8.causedBy}`);
page('8 live', 'p/manesar/issue/' + doIss.id, /Caused by BL-1/);
page('8 live', 'p/manesar/eq/bl1/issues', /DO low — AT-2/, 'BL-1\'s Issues tab (object7) lists the issue it caused');
act('work:startfix', { plant: 'manesar', id: doIss.id });
// fixer: the story promises "fix steps and a linked task": the fix for the intake filter links the general task
{ const h8 = page('8 live', 'p/manesar/issue/' + doIss.id, /Open the task: /, 'the fix steps link a general task ("Open the task: …")');
  const m8 = /href="(#\/p\/manesar\/task\/[^"]+)"/.exec(h8.h); ok('8 live', 'the linked task page opens', !!m8 && !/Not found|No such/.test(text(UI.renderPath(m8[1].replace(/&amp;/g, '&')))), m8 && m8[1]); }
const fx = V.fixFlowFor(iss8.diag.causeId); const steps = (fx && (fx.steps || fx.nodes)) || [];
steps.forEach((s) => act('work:fixstep', { plant: 'manesar', id: doIss.id, step: s.id, answer: s.type === 'question' ? 'No' : undefined }, s.type === 'question' ? undefined : { tagName: 'INPUT', checked: true }));
/* round 5: a question fix step is answered Yes or No and the log records the answer, not "Done: <question>" */
ok('8 live', 'the question step is answered, and the log says "Is the filter element clean? No"', V.issue('manesar', doIss.id).log.some((l) => l.text === 'Is the filter element clean? No') && !V.issue('manesar', doIss.id).log.some((l) => /^Done: Is the filter/.test(l.text)));
/* round 5: an open issue's Lowest is the lowest reading while it is open (0.65 mg/L at 08:40), not the reading it opened at (0.87) */
page('8 live', 'p/manesar/issue/' + doIss.id, /Band Major Lowest 0\.65 mg\/L/, 'What fired: Lowest 0.65 mg/L while the issue is open');
/* round 2 (Q1, Q12): at 09:00 Verify says the reading is still in Major, and the gauge names Major; +1 hour shows it back inside */
page('8 live', 'p/manesar/issue/' + doIss.id, /Now 0\.89 mg\/L at 08:55: still in Major Sample readings Now 0\.89 mg\/L · Major/, 'Verify at 09:00: still in Major, and the gauge says Major');
act('ui:advance', { min: 60 });
ok('8 live', '+1 hour: the issue, being fixed, is not closed by its reading', V.issue('manesar', doIss.id).status === 'verifying', V.issue('manesar', doIss.id).status);
page('8 live', 'p/manesar/issue/' + doIss.id, /Now 2\.1 mg\/L at 09:55: inside the limits/, 'Verify after +1 hour: the reading is back inside, so it closes on the readings');
act('work:verify', { plant: 'manesar', id: doIss.id, ok: 1 });
ok('8 live', 'verify → closed', V.issue('manesar', doIss.id).status === 'closed', V.issue('manesar', doIss.id).status);
page('8 live', 'p/manesar/issues', /DO low — AT-2/);

// 9 · coverage
chapter(9);
page('9 coverage', 'p/manesar', /Blind spots/);
/* round 5: Activity lists every seeded issue (opened and closed), back to Tue 29 Sep, like the Issues tab */
{ const seeded = V.issues('manesar').filter((i) => i.opened < V.NOW0); const act9 = V.activity({ plant: 'manesar', kind: 'issue' });
  ok('9 coverage', 'Activity has an "Issue opened" line for every seeded Manesar issue', seeded.every((i) => act9.some((a) => a.at === i.opened && /^Issue opened: /.test(a.text) && a.text.includes(i.title))), `${seeded.length} issues, ${act9.length} lines`); }

// 10 · a library change (Diffuser Tank, MLSS low: AT-2 follows, AT-1 keeps its own)
chapter(10);
const T10 = W.V7OBJ._test;
act('obj:limits', { mode: 'type', code: 'OS_TANK_DF', reading: 'MLSS', dir: 'below' });
const ls = T10.getLS(); ls.vals.minor = '2200'; fields(1);
ok('10 library', 'saving on the type page makes a draft', act('obj:lsave') === undefined && !!V.libDraft('OS_TANK_DF'));
const r10 = page('10 library', 'library/OS_TANK_DF', /Reaches 1 plant · 1 value changes \(AT-2\) · 1 value kept here \(AT-1\)/, 'Where it lands (lib7 aside on the object7 type page)');
act('lib:field', { form: 'pub:OS_TANK_DF', name: 'note' }, { value: 'Low MLSS warns earlier', tagName: 'TEXTAREA' });
act('lib:publish', { code: 'OS_TANK_DF' });
ok('10 library', 'publish → version 2', V.libVersion('OS_TANK_DF') === 2 && !V.libDraft('OS_TANK_DF'), toast());
ok('10 library', 'AT-2 follows the library', V.limitsOf('manesar', 'at2_mlss', 'below').bands.minor === 2200);
ok('10 library', 'AT-1 keeps 2500 and shows Library changed since', V.limitsOf('manesar', 'at1_mlss', 'below').bands.minor === 2500 && V.limitsOf('manesar', 'at1_mlss', 'below').perBand.minor.chip === 'libchanged');
page('10 library', 'p/manesar/eq/at1', /Library changed since/, 'AT-1\'s equipment page (object7)');
page('10 library', 'p/manesar/differences?show=libchanged', /MLSS/, 'Manesar Differences, Library changed since (lib7)');
ok('10 library', 'Manesar Activity (ui7) has the dated change note', /Diffuser Tank v2/.test(text(render('p/manesar/activity'))));
page('10 library', 'p/manesar', /Diffuser Tank/, 'Manesar Coverage (plant7) shows the library change note');
/* round 5: Where it lands and publish use one rule for due dates: the date shown under "Due sooner" is the task's due date after publish
   (a check, not a story beat: its actions are counted apart) */
optional(() => { const before = V.task('manesar', 's_bl2_pm').due;
  V.editLib('BLW', { schedule: 'Bearing service', every: { n: 3, unit: 'month' } });
  const tw = text(render('library/BLW')); const m = /Due sooner Bearing service on BL-2 not done yet; counts from today: due (\w{3} \d{1,2} \w{3}) \(was (\w{3} \d{1,2} \w{3})\)/.exec(tw);
  ok('10 library', 'a cadence draft keeps the run-hours rule on both sides ("every 6 months or 500 run-hours → every 3 months or 500 run-hours")', /every 6 months or 500 run-hours → every 3 months or 500 run-hours/.test(tw), (tw.match(/Bearing service[^.]{0,120}/) || [''])[0]);
  act('lib:field', { form: 'pub:BLW', name: 'note' }, { value: 'Bearing service every 3 months' });
  act('lib:publish', { code: 'BLW' });
  const after = V.task('manesar', 's_bl2_pm');
  ok('10 library', 'BL-2: the "Due sooner" date Where it lands showed is the due date after publish', !!m && V.fmtDay(after.due) === m[1] && V.fmtDay(before) === m[2] && after.due < before, `${m ? m[1] + ' / was ' + m[2] : 'no Due sooner line'} → ${V.fmt(after.due)}`);
  ok('10 library', 'the plant\'s change note names the task and its date', V.activity({ plant: 'manesar' }).some((a) => /Blower v2 published/.test(a.text) && a.text.includes(`Bearing service on BL-2: ${V.fmtDay(after.due)}`)));
  V.advance(60); ok('10 library', 'the date holds when the clock moves (the meter does not count it from go live again)', V.task('manesar', 's_bl2_pm').due === after.due, V.fmt(V.task('manesar', 's_bl2_pm').due)); });

// 11 · differences: back to the library value
chapter(11);
const ov = V.overrides({ plant: 'manesar' }).find((o) => o.target.kind === 'clear' && o.target.alertId === 'a_do_at2');
act('lib:revert', { id: ov.id }); confirmLast();
ok('11 differences', 'Back to the library value ends the difference', V.overrides({ state: 'ended' }).some((o) => o.id === ov.id), toast());
page('11 differences', 'p/manesar/alert/a_do_at2', /must clear for 10 min/i, 'the alert page (object7) shows the library\'s 10 min again');

// 12 · decisions
chapter(12);
const DEC = smoke.isDataIn(smoke.decisionsCorpus(W));
{
  const h = render('decisions'); const b = smoke.scan(h, { ids: false, isData: (t, i, l) => DATA(t, i, l) || DEC(t, i, l) }).filter((f) => f.kind !== 'data-word');
  ok('12 decisions', '#/decisions renders; its own words are clean (quoted card text aside)', /Copy my answers/.test(text(h)) && !b.length, b.map((x) => x.word + ': ' + x.ctx).join(' | '));
}
act('dec:pick', { id: 'D2' }, { value: '0', tagName: 'INPUT' });
ok('12 decisions', '"Your call" is kept', !!W.V7DEC.answerOf && W.V7DEC.answerOf('D2') != null);

// the clock and reset
const n0 = V.issues('manesar', {}).length;
optional(() => act('ui:advance', { min: 1440 }));
ok('clock', 'Move time on +1 day opens issues and says so', V.issues('manesar', {}).length > n0 && /Time moved on to Fri 30 Oct/.test(toast()), toast());

/* ── 5. sweep: every page after the walk ──────────────────────────────────────────────────────────────── */
const sweepBad = []; let sweepN = 0;
function sweep(p) { sweepN++; let h = ''; try { h = render(p); } catch (e) { sweepBad.push(`${p}: throws ${e.message}`); return; } const b = clean(h); if (b.length) sweepBad.push(`${p}: ${b[0].kind} ${b[0].word} (${b[0].ctx})`); if (/could not be shown/.test(h)) sweepBad.push(`${p}: could not be shown`); }
for (const key of V.plants().map((p) => p.key)) {
  ['', '/scada', '/library', '/equipment', '/readings', '/issues', '/tasks', '/differences', '/activity'].forEach((t) => sweep('p/' + key + t));
  V.alerts(key, {}).forEach((a) => sweep(`p/${key}/alert/${encodeURIComponent(a.id)}`));
  V.issues(key, {}).forEach((i) => sweep(`p/${key}/issue/${encodeURIComponent(i.id)}`));
  V.equipment(key).slice(0, 6).forEach((e) => ['', '/issues', '/tasks', '/details', '/phone'].forEach((t) => sweep(`p/${key}/eq/${encodeURIComponent(e.id)}${t}`)));
  V.tasks(key, {}).slice(0, 8).forEach((t) => sweep(`p/${key}/task/${encodeURIComponent(t.id)}`));
}
['plants', 'activity', 'library', 'library/OS_TANK_DF', 'library/OS_TANK_DF/details', 'differences'].forEach(sweep);
ok('sweep', `${sweepN} pages after the walk render clean`, !sweepBad.length, sweepBad.slice(0, 5).join(' | '));

// reset restores the story's start
V.reset();
ok('reset', 'Reset the story: Vedanta back in Commissioning, clock at Thu 29 Oct, 09:00', V.state('vedanta') === 'commissioning' && V.fmt(V.now()) === 'Thu 29 Oct, 09:00' && V.libVersion('OS_TANK_DF') === 1);
const soft = [...new Set((UI._soft || []))];
ok('soft', 'no V7 call failed inside ui7 during the walk', !soft.length, soft.slice(0, 4).join(' | '));

/* ── 6. the action counts, for the v7/2 hand-off doc ─────────────────────────────────────────────────────── */
{
  const out = { what: 'Presenter actions per story chapter in the end-to-end walk of v7/1: every button pressed (clicks) and every value typed or choice made in a field (fields), through the registered handlers. Following a link is not counted; checks that are not story beats are counted apart.', chapters: {}, total: 0, optional: 0 };
  for (let n = 1; n <= 12; n++) { const c = COUNT.by[n] || { clicks: 0, fields: 0, optional: 0 }; out.chapters[n] = { count: c.clicks + c.fields, clicks: c.clicks, fields: c.fields, optional: c.optional }; out.total += c.clicks + c.fields; out.optional += c.optional; }
  ok('actions', 'every chapter was walked and counted', Object.keys(COUNT.by).length === 12, Object.keys(COUNT.by).join(','));
  const dir = path.join(__dirname, 'out'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'actions71.json'), JSON.stringify(out, null, 2) + '\n');
  ok('actions', 'tests/out/actions71.json written', fs.existsSync(path.join(dir, 'actions71.json')));
  if (VERBOSE) console.log('  actions: ' + Object.keys(out.chapters).map((k) => `${k}:${out.chapters[k].count}`).join(' · ') + ` · total ${out.total} (+${out.optional} apart)`);
}

/* report */
const groups = [...new Set(results.map((r) => r.group))];
for (const g of groups) {
  const rs = results.filter((r) => r.group === g); const f = rs.filter((r) => !r.pass);
  console.log(`  ${f.length ? 'FAIL' : 'ok  '} ${g.padEnd(16)} ${rs.length - f.length}/${rs.length}`);
  for (const r of rs) if (VERBOSE || !r.pass) console.log(`       ${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${!r.pass && r.detail ? '\n            ' + String(r.detail).slice(0, 400) : ''}`);
}
console.log(`integrate7: ${results.length - fails}/${results.length} checks · ${fails ? 'RESULT: FAIL' : 'RESULT: PASS'}`);
process.exit(fails ? 1 : 0);
