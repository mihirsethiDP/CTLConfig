#!/usr/bin/env node
/* v7 · tests/work7.test.js — headless test of work7.js (window.V7WORK), builder B6. Node only, no dependencies.
   Loads every asset in prototype.html's order with smoke.js's stub DOM, boots the story, renders the three work routes for every
   plant, issue and task, and walks the story through the page handlers (fake elements stand in for clicks):
     Manesar "DO low — AT-2": terms → a limit change shows "Opened under the old limit" → diagnosis Yes/No → "Caused by BL-1" →
     fix steps → verify → closed; report a problem on BL-1 → diagnosis → a fix step linked to a general task → the task page →
     "Done: back to the issue"; a sensor fault reported → calibration → closed as a sensor fault; Vedanta's Commissioning
     Emergency → told the Leads, no call, no hooter → closed as a false alarm; tasks at Bawal: tick steps, done → next due,
     last done, how often with a reason and back to the library; Vedanta's tasks wait for go live. Then the clock moves a day.
   Every page is scanned for the banned words (smoke.js's checker) and every link must resolve to a route.
   Usage: node tests/work7.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const smoke = require('./smoke.js');

const ASSETS = path.join(__dirname, '..', 'assets');
const VERBOSE = process.argv.includes('-v');
smoke.installDom();
const order = (() => {
  try { const html = fs.readFileSync(path.join(__dirname, '..', 'prototype.html'), 'utf8'); const out = []; const re = /<script[^>]*\bsrc\s*=\s*["']assets\/([^"'?]+)/gi; let m; while ((m = re.exec(html))) out.push(m[1]); if (out.length) return out; } catch (e) { /* default */ }
  return ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'core7.js', 'ui7.js', 'plant7.js', 'object7.js', 'lib7.js', 'work7.js', 'decisions7.js'];
})();
const loaded = []; const missing = [];
const quiet = console.error; console.error = () => {};
for (const f of order) { const p = path.join(ASSETS, f); if (!fs.existsSync(p)) { missing.push(f); continue; } vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p }); loaded.push(f); }
console.error = quiet;
const W = global; const V = W.V7; const U = W.V7UI; const K = W.V7WORK;
V.boot(); V.reset();

/* verbatim library and workbook text (the same corpus smoke.js uses): a banned word inside it is a data word, not a page bug */
const CORPUS = (() => {
  const seen = new Set(); const parts = [];
  const walk = (x, d) => { if (x == null || d > 8) return; if (typeof x === 'string') { if (x.length > 3) parts.push(x.replace(/\s+/g, ' ')); return; } if (typeof x !== 'object' || seen.has(x)) return; seen.add(x); if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1)); else Object.keys(x).forEach((k) => walk(x[k], d + 1)); };
  ['ISSUES', 'ISSUE_TASKS', 'SEED', 'CATALOGUE', 'READINGS', 'PLANT_PROFILES', 'NEXT_PHASE_FLOWS', 'NEXT_PHASE_CAUSES', 'RCA_MAPS', 'FORM_RULES', 'SCADA_FORM', 'DB_PALETTE'].forEach((g) => walk(W[g], 0));
  return parts.join('\n');
})();
function isData(text, i, len) { const left = text.slice(Math.max(0, i - 16), i + len).trim(); const right = text.slice(i, i + len + 16).trim(); return (left.length > len + 3 && CORPUS.includes(left)) || (right.length > len + 3 && CORPUS.includes(right)) || CORPUS.includes(text.slice(Math.max(0, i - 6), i + len + 6)); }
const results = []; let fails = 0; const warns = [];
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail }); if (!ok) fails++; }
const routeSet = new Set(U.routes().map((r) => r.pattern));
const allPresent = missing.length === 0;
let renders = 0;
function render(hash) {
  renders++;
  W.location.hash = hash;
  const m = U.match(hash); if (!m) throw new Error('no route for ' + hash);
  const html = m.route.fn(m.params);
  for (const f of smoke.scan(html, { isData })) { if (f.kind === 'data-word') { if (VERBOSE) warns.push(`${hash}: data word "${f.word}"`); continue; } check('words', `${hash}: ${f.kind} "${f.word}"`, false, f.ctx); }
  for (const href of smoke.links(html)) {
    if (!href.startsWith('#/')) continue;
    if (!U.match(href)) { if (allPresent) check('links', `${hash} links to ${href}`, false); else if (!warns.includes('dead ' + href)) warns.push('dead ' + href); }
    else if (!allPresent) {
      const pat = U.match(href).pattern; if (pat === 'plants' && !/^#\/plants/.test(href)) warns.push(`${href} only resolves to All Plants (module missing)`);
    }
  }
  return { html, text: smoke.visibleText(html) };
}
const has = (r, s) => r.text.includes(s);
/* a fake element: data-* attributes, a value, and a root (modal/sheet/form) answering querySelector for named fields */
function fakeRoot(fields, radios) {
  const rs = new Set(radios || []);
  return { querySelector(sel) { let m = sel.match(/name="([^"]+)"\]:checked/); if (m) return rs.has(m[1]) && fields[m[1]] != null ? { value: String(fields[m[1]]) } : null; m = sel.match(/\[name="([^"]+)"\]/); if (m && !rs.has(m[1]) && fields[m[1]] != null) return { value: String(fields[m[1]]), type: 'text' }; return null; } };
}
function el(data, o) { o = o || {}; const root = o.root || null; return Object.assign({ getAttribute: (k) => { const kk = k.replace(/^data-/, ''); return data[kk] != null ? String(data[kk]) : null; }, closest: () => root, value: o.value }, root && !o.value ? { querySelector: root.querySelector } : {}); }
const act = (name, data, o) => { const fn = U._handlers[name]; if (!fn) throw new Error('no handler ' + name); return fn(el(data, o), {}); };
const toast = () => (U._last && U._last.toast) || '';

/* ── 1. routes, exports, every page renders ─────────────────────────────────────────────────── */
check('load', `assets loaded (${loaded.length}/${order.length})${missing.length ? ' · missing: ' + missing.join(', ') : ''}`, loaded.includes('work7.js') && !!K);
['p/:plant/issues', 'p/:plant/issue/:id', 'p/:plant/task/:id'].forEach((p) => check('load', `route ${p}`, routeSet.has(p)));
['issuesPage', 'issuePage', 'taskPage', 'openReport', 'reportButton', 'issueList', 'issueItem', 'statusChip', 'toldSummary'].forEach((f) => check('load', `V7WORK.${f}`, typeof K[f] === 'function'));
function renderAll(label) {
  let n = 0; let thrown = 0;
  for (const p of V.plants()) {
    for (const h of [`#/p/${p.key}/issues`, `#/p/${p.key}/issues?show=open`, `#/p/${p.key}/issues?show=closed`, `#/p/${p.key}/issues?show=false`, `#/p/${p.key}/issues?show=all&n=all`]) { try { render(h); n++; } catch (e) { thrown++; check('render', `${label} ${h}`, false, e.stack); } }
    for (const i of V.issues(p.key, {})) { try { render(`#/p/${p.key}/issue/${i.id}`); n++; } catch (e) { thrown++; check('render', `${label} issue ${i.id}`, false, e.stack); } }
    for (const t of V.tasks(p.key, {})) { try { render(`#/p/${p.key}/task/${encodeURIComponent(t.id)}`); n++; } catch (e) { thrown++; check('render', `${label} task ${t.id}`, false, e.stack); } }
  }
  for (const h of ['#/p/manesar/issue/nope', '#/p/manesar/task/nope', '#/p/nowhere/issues', '#/p/manesar/task/t_mb_suction_filter']) { try { render(h); n++; } catch (e) { thrown++; check('render', `${label} ${h}`, false, e.stack); } }
  check('render', `${label}: ${n} pages render without a throw`, thrown === 0);
}
renderAll('start');

/* ── 2. Manesar: the open DO issue, its terms, a limit change, the diagnosis, caused by, fix, verify ─────────────── */
const M = 'manesar';
const doIss = V.issues(M, { status: 'open' }).find((i) => /DO low/.test(i.title));
check('manesar', 'an open "DO low — AT-2" issue at the start', !!doIss);
let r = render(`#/p/${M}/issues`);
/* round 2 (Q1): the seeded DO issue was started by the Operator at 07:50, so it lists as being diagnosed, not "not started" */
check('manesar', 'issues list leads with what is open', /Open · 1 DO low — AT-2 Major Diagnosing/.test(r.text) && has(r, 'being diagnosed') && r.text.indexOf('Open · 1') < r.text.indexOf('Closed · '), r.text.slice(0, 600));
check('manesar', 'issues list offers "Report a problem"', has(r, 'Report a problem'));
r = render(`#/p/${M}/issues?show=false`);
check('manesar', 'False alarms filter lists only false alarms', has(r, 'Closed · false alarm') && !has(r, 'Open · not started'));
r = render(`#/p/${M}/issue/${doIss.id}`);
check('manesar', 'issue page: the terms it opened under', has(r, 'Opened under: Major below 1.0 mg/L, must hold for 0 min'), r.text.slice(0, 600));
check('manesar', 'issue page: who was told (summary + people)', /Operators and \d Leads: WhatsApp/.test(r.text) && has(r, 'Kishore Reddy'));
check('manesar', 'issue page: the diagnosis carries on at question 2, with who answered question 1 and when', has(r, 'Question 2 of up to 7') && has(r, 'Does the gauge on the blower discharge read above 0.45 bar?') && has(r, 'Answered so far · 1') && has(r, 'Is the blower running? · Dheeraj Kumar, 07:50') && /data-answer="Yes"/.test(r.html) && /data-answer="No"/.test(r.html), r.text.slice(0, 900));
check('manesar', 'issue page: "Close as a false alarm" offered', has(r, 'Close as a false alarm'));
// a limit change while open: the issue keeps its terms and says so
const lim = V.limitsOf(M, doIss.sensorId, 'below');
const ch = V.setLimits(M, doIss.sensorId, 'below', { ...lim.bands, major: 1.2 }, { reason: 'tuned', note: 'Test: AT-2 runs low at night' });
r = render(`#/p/${M}/issue/${doIss.id}`);
check('manesar', 'after the alert moved: "Opened under the old limit 1.0 mg/L (now 1.2 mg/L)"', ch.ok && has(r, 'Opened under the old limit 1.0 mg/L (now 1.2 mg/L)'), ch.error || r.text.slice(0, 400));
// diagnosis through the handlers: question 1 was answered Yes at 07:50; No at question 2 → intake filter blocked, on BL-1
act('work:answer', { plant: M, id: doIss.id, step: 1, answer: 'Yes' });
r = render(`#/p/${M}/issue/${doIss.id}`);
check('manesar', 'question 1 cannot be answered again: the page stays at question 2', V.issue(M, doIss.id).diag.path.length === 1 && has(r, 'Does the gauge on the blower discharge read above 0.45 bar?') && has(r, 'Answered so far · 1'));
act('work:answer', { plant: M, id: doIss.id, step: 2, answer: 'No' });
let iss = V.issue(M, doIss.id);
check('manesar', 'answer No → root cause "Intake filter blocked", caused by BL-1', iss.diag.causeId === 'c_intake' && iss.causedBy === 'bl1', `${iss.diag.causeId} ${iss.causedBy}`);
check('manesar', 'toast names the root cause and where it sits', /Root cause found: Intake filter blocked, on BL-1/.test(toast()), toast());
r = render(`#/p/${M}/issue/${doIss.id}`);
check('manesar', 'root cause card: "Caused by BL-1", link to BL-1\'s issues, "Start the fix"', has(r, 'Caused by BL-1') && /href="#\/p\/manesar\/eq\/bl1\/issues"/.test(r.html) && has(r, 'Start the fix'));
r = render(`#/p/${M}/issues?eq=bl1`);
check('manesar', 'BL-1\'s issues include the one it caused', has(r, 'DO low — AT-2') && has(r, 'Caused here · about AT-2'));
act('work:startfix', { plant: M, id: doIss.id });
iss = V.issue(M, doIss.id); const fixFlow = V.flowOf(iss.fix.flowId);
check('manesar', 'Start the fix → fixing with the cause\'s fix steps', iss.status === 'fixing' && !!fixFlow, iss.status);
r = render(`#/p/${M}/issue/${doIss.id}`);
check('manesar', 'fix card: numbered steps with ticks', /data-act="work:fixstep"/.test(r.html) && has(r, `0 of ${fixFlow.steps.length} done`));
fixFlow.steps.forEach((s) => act('work:fixstep', { plant: M, id: doIss.id, step: s.id, answer: s.type === 'question' ? 'No' : undefined }));   /* round 5: a question step takes Yes or No */
iss = V.issue(M, doIss.id);
check('manesar', 'every step ticked → verifying', iss.status === 'verifying' && /check the readings/.test(toast()), iss.status);
r = render(`#/p/${M}/issue/${doIss.id}`);
check('manesar', 'verify card: "Do the readings show it worked?" with the reading now', has(r, 'Do the readings show it worked?') && /Now \d/.test(r.text) && has(r, 'Yes: close the issue'));
act('work:verify', { plant: M, id: doIss.id, ok: 1 });
iss = V.issue(M, doIss.id);
r = render(`#/p/${M}/issue/${doIss.id}`);
check('manesar', 'Yes → closed, the page says how and how long', iss.status === 'closed' && has(r, 'Closed: Intake filter blocked') && /Took \d/.test(r.text) && !has(r, 'Close as a false alarm'));

/* ── 3. report a problem on BL-1 → diagnosis → a fix step linked to a general task → back ─────────────────────── */
U.closeModal(true);
K.openReport(M, 'bl1');
const rb = K._reportBody(M, 'bl1');
check('report', 'the modal lists BL-1\'s workbook problems with how they are found', /Blower tripping/.test(rb) && /Found by a reading or a visual check/.test(smoke.visibleText(rb)), smoke.visibleText(rb).slice(0, 300));
check('report', 'a sensor fault is offered ("A reading looks wrong")', /A reading looks wrong/.test(rb));
check('report', 'Live plant: severity with who is told', /How serious is it\?/.test(rb) && /Calls to everyone/.test(rb));
const rb0 = K._reportBody(M, null);
check('report', 'without equipment: asks which equipment first', /Which equipment\?/.test(rb0) && /Pick the equipment first/.test(rb0));
const before = V.issues(M, {}).length;
act('work:report-go', { plant: M }, { root: fakeRoot({ 'wk-eq': 'bl1', 'wk-it': 'i_mb_blower', 'wk-band': 'minor' }, ['wk-it', 'wk-band']) });
const rep = V.issues(M, {}).find((i) => i.reported && i.issueTypeId === 'i_mb_blower');
check('report', 'Open the issue → a reported issue with its diagnostic, and the page opens', !!rep && V.issues(M, {}).length === before + 1 && rep.diag.flowId === 'd_mb_blower' && W.location.hash === `#/p/${M}/issue/${rep.id}`, W.location.hash);
r = render(`#/p/${M}/issue/${rep.id}`);
check('report', 'reported issue page: what was reported, how it is usually found', has(r, 'What was reported') && has(r, 'Reported') && /Usually found by/.test(r.text));
act('work:answer', { plant: M, id: rep.id, step: 1, answer: 'No' });
act('work:answer', { plant: M, id: rep.id, step: 2, answer: 'Yes' });
act('work:startfix', { plant: M, id: rep.id });
iss = V.issue(M, rep.id);
check('report', 'No, Yes → "Suction filter clogged", fix started', iss.diag.causeId === 'c_mb_blower_2' && iss.status === 'fixing', `${iss.diag.causeId} ${iss.status}`);
r = render(`#/p/${M}/issue/${rep.id}`);
const lk = (r.html.match(/href="(#\/p\/manesar\/task\/[^"]+)"/) || [])[1] || '';
check('report', 'the fix step links to its general task: "Open the task: Blower suction filter cleaning"', has(r, 'Open the task: Blower suction filter cleaning') && /from=/.test(lk) && /step=1/.test(lk), lk);
const back = lk.replace(/&amp;/g, '&');
r = render(back);
check('report', 'the task page (not scheduled at Manesar) shows its steps and "Done: back to the issue"', has(r, 'does not schedule this task') && has(r, 'Done: back to the issue') && has(r, 'Part of the fix for'), r.text.slice(0, 400));
const m2 = U.match(back);
act('work:return', { plant: M, id: rep.id, step: m2.params._q.step });
iss = V.issue(M, rep.id);
check('report', '"Done: back to the issue" ticks that fix step and returns', iss.status === 'verifying' && W.location.hash === `#/p/${M}/issue/${rep.id}`, `${iss.status} ${W.location.hash}`);
act('work:verify', { plant: M, id: rep.id, ok: 0 });
iss = V.issue(M, rep.id);
r = render(`#/p/${M}/issue/${rep.id}`);
check('report', 'No at verify → back to the diagnosis from the first question', iss.status === 'diagnosing' && !iss.diag.causeId && has(r, 'Question 1'));
// "I know the reason"
act('work:cause-go', { plant: M, id: rep.id }, { root: fakeRoot({ 'wk-cause': 'c_mb_blower_3' }, ['wk-cause']) });
iss = V.issue(M, rep.id);
check('report', '"I know the reason" → the picked root cause', iss.diag.causeId === 'c_mb_blower_3');

/* ── 4. a sensor fault: reported, fixed by calibration, closed as a sensor fault ─────────────────────────────── */
act('work:report-go', { plant: M }, { root: fakeRoot({ 'wk-eq': 'at2', 'wk-it': '__sensor', 'wk-sensor': 'at2_do' }, ['wk-it']) });
const sf = V.issues(M, { status: 'open' }).find((i) => i.sensorFault && i.sensorId === 'at2_do');
check('sensor', 'A reading looks wrong → a sensor-fault issue at its root cause', !!sf && sf.diag.causeId === 'c_probe');
r = render(`#/p/${M}/issue/${sf.id}`);
check('sensor', 'page: "Sensor fault" and the probe\'s calibration', has(r, 'Sensor fault') && has(r, 'calibration') && has(r, 'nothing to diagnose'));
act('work:startfix', { plant: M, id: sf.id });
iss = V.issue(M, sf.id); V.flowOf(iss.fix.flowId).steps.forEach((s) => act('work:fixstep', { plant: M, id: sf.id, step: s.id, answer: s.type === 'question' ? 'Yes' : undefined }));
act('work:verify', { plant: M, id: sf.id, ok: 1 });
iss = V.issue(M, sf.id);
check('sensor', 'calibrated, verified → closed as a sensor fault', iss.status === 'closed' && iss.closedHow === 'sensor fault', iss.closedHow);

/* ── 5. Vedanta: the Commissioning Emergency → told the Leads, no call, no hooter → a false alarm ─────────────── */
const VE = 'vedanta';
const em = V.issues(VE, {}).find((i) => i.commissioning);
check('vedanta', 'the Commissioning Emergency issue exists', !!em && em.band === 'emergency');
r = render(`#/p/${VE}/issue/${em.id}`);
check('vedanta', 'who was told: "WhatsApp and the app to the Leads; no call, no hooter"', has(r, 'WhatsApp and the app to the Leads; no call, no hooter'), r.text.slice(0, 800));
check('vedanta', 'Commissioning banner and chip', has(r, 'Opened during the Commissioning trial') && has(r, 'Commissioning'));
r = render(`#/p/${VE}/issues`);
check('vedanta', 'issues list marks it Commissioning', has(r, 'Commissioning') && has(r, 'pH low — EQ-1'));
act('work:false-go', { plant: VE, id: em.id }, { root: fakeRoot({ 'wk-why': '' , 'wk-note': '' }, ['wk-why']) });
check('vedanta', 'false alarm without a reason is refused', V.issue(VE, em.id).status !== 'closed');
act('work:false-go', { plant: VE, id: em.id }, { root: fakeRoot({ 'wk-why': 'The sensor was being cleaned or calibrated', 'wk-note': 'pH probe out for cleaning' }, ['wk-why']) });
iss = V.issue(VE, em.id);
r = render(`#/p/${VE}/issue/${em.id}`);
check('vedanta', 'closed as a false alarm, with why, counted in Coverage', iss.status === 'closed' && iss.falseAlarm && has(r, 'Closed as a false alarm: The sensor was being cleaned or calibrated (pH probe out for cleaning)') && has(r, 'Coverage'), r.text.slice(0, 300));
/* round 5: calendar work is spread at go live; run-hours work falls due by its hour meter (it is left out of the spread) */
const vt = V.tasks(VE, {}).find((t) => !t.meter);
r = render(`#/p/${VE}/task/${encodeURIComponent(vt.id)}`);
check('vedanta', 'a task before go live: starts at go live, first due spread, steps to read', has(r, 'Starts at go live') && has(r, 'spread across its interval') && !/data-act="work:taskstep"/.test(r.html));
const vmt = V.tasks(VE, {}).find((t) => t.meter);
r = render(`#/p/${VE}/task/${encodeURIComponent(vmt.id)}`);
check('vedanta', 'run-hours work before go live: falls due by its hour meter, not spread', has(r, `At go live: when its hour meter reaches ${vmt.meter.at} h`) && !has(r, 'spread across its interval so day one'), r.text.slice(0, 300));
act('work:report-go', { plant: VE }, { root: fakeRoot({ 'wk-eq': (V.equipment(VE).find((e) => V.issueTypes(e.type).length) || {}).id, 'wk-it': (V.issueTypes((V.equipment(VE).find((e) => V.issueTypes(e.type).length) || {}).type)[0] || {}).id }, ['wk-it']) });
const vrep = V.issues(VE, {}).find((i) => i.reported);
check('vedanta', 'a problem reported during Commissioning is told to the Leads in the app only', !!vrep && vrep.commissioning && vrep.told.every((x) => x.how === 'in the app'));

/* ── 6. tasks at Bawal: ticks, done → next due, last done, how often with a reason ─────────────────────────────── */
const B = 'bawal';
const bt = V.tasks(B, {}).find((t) => t.status === 'due' && t.steps.length);
r = render(`#/p/${B}/task/${encodeURIComponent(bt.id)}`);
check('tasks', 'a due task: steps with ticks, "Mark the task done", source chip, last done date', /data-act="work:taskstep"/.test(r.html) && has(r, 'Mark the task done') && /From the library|Changed here/.test(r.text) && /type="date"[^>]*data-act="work:lastdone"/.test(r.html));
act('work:taskstep', { plant: B, id: bt.id, step: bt.steps[0].id });
check('tasks', 'ticking a step marks it and starts the task', V.task(B, bt.id).done.length === 1 && V.task(B, bt.id).status === 'doing');
const due0 = V.task(B, bt.id).due;
act('work:taskdone', { plant: B, id: bt.id });
const bt2 = V.task(B, bt.id);
check('tasks', 'done → next due moves on an interval, toast says when', bt2.due > due0 && bt2.status === 'upcoming' && /Next due/.test(toast()), toast());
act('work:lastdone', { plant: B, id: bt.id }, { value: '2026-10-27' });
check('tasks', 'last done set from the date field', V.fmtDay(V.task(B, bt.id).lastDone) === 'Tue 27 Oct', V.fmtDay(V.task(B, bt.id).lastDone));
const ct = V.tasks(B, {}).find((t) => t.source && t.source.chip === 'lib' && t.every && t.every.n && t.source.libValue);
act('work:cadence', { plant: B, id: ct.id });
const sheetBody = K._cadenceBody(B, ct.id);
check('tasks', 'how-often sheet offers the two reasons and a note', /Tuned for this plant/.test(sheetBody) && /For now, until/.test(sheetBody) && /wk-note/.test(sheetBody));
const n2 = ct.every.n + 1;
act('work:cadence-save', { plant: B, id: ct.id }, { root: fakeRoot({ 'wk-n': n2, 'wk-unit': ct.every.unit, 'wk-reason': '', 'wk-note': '' }, ['wk-reason']) });
check('tasks', 'a change from the library without a reason is refused', V.task(B, ct.id).every.n === ct.every.n);
act('work:cadence-save', { plant: B, id: ct.id }, { root: fakeRoot({ 'wk-n': n2, 'wk-unit': ct.every.unit, 'wk-reason': 'tuned', 'wk-note': 'Heavier load at Bawal' }, ['wk-reason']) });
const ct2 = V.task(B, ct.id);
r = render(`#/p/${B}/task/${encodeURIComponent(ct.id)}`);
check('tasks', 'with "Tuned for this plant" + note → changed, chip "Changed here", in the ledger', ct2.every.n === n2 && ct2.source.chip === 'changed' && has(r, 'Changed here') && V.overrides({ plant: B }).some((o) => o.target.kind === 'cadence'), JSON.stringify(ct2.source));
act('work:cadence-lib', { plant: B, id: ct.id });
check('tasks', '"Back to the library value" ends the change', V.task(B, ct.id).source.chip === 'lib' && V.task(B, ct.id).every.n === ct.every.n);
const grp = V.tasks(VE, {}).find((t) => t.kind === 'group' && t.eqIds.length > 1);
r = grp ? render(`#/p/${VE}/task/${encodeURIComponent(grp.id)}`) : { text: '' };
check('tasks', 'a set-level task (Vedanta): "Shared task for N …" with each equipment, to confirm', !!grp && /Shared task for \d/.test(r.text) && has(r, 'to confirm') && grp.eqIds.every((id) => r.html.includes(`#/p/${VE}/eq/${id}/tasks`)));

/* ── 7. the clock moves a day; every page still renders ─────────────────────────────────────────────────────── */
const adv = V.advance(1440);
renderAll('+1 day');
check('clock', `+1 day: ${adv.opened.length} opened, ${adv.closed.length} closed at all plants; list pages still lead with what is open`, (() => { const o = V.issues(M, { status: 'open' }); const t = render(`#/p/${M}/issues`).text; return o.length ? t.includes(`Open · ${o.length}`) && t.indexOf(`Open · ${o.length}`) < t.indexOf('Closed · ') : t.includes('Nothing is open'); })());

/* ── report ─────────────────────────────────────────────────────────────────────────────────────────────────── */
const groups = [...new Set(results.map((x) => x.group))];
for (const g of groups) {
  const rs = results.filter((x) => x.group === g); const bad = rs.filter((x) => !x.ok);
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(8)} ${rs.length - bad.length}/${rs.length}`);
  for (const x of (VERBOSE ? rs : bad)) console.log(`     ${x.ok ? '✓' : '✗'} ${x.name}${!x.ok && x.detail ? '\n         ' + String(x.detail).slice(0, 500).replace(/\n/g, '\n         ') : ''}`);
}
const uw = [...new Set(warns)];
if (uw.length) { console.log(`warnings (${uw.length}):`); uw.slice(0, VERBOSE ? 200 : 8).forEach((w) => console.log('     ' + w)); }
console.log(`work7: ${results.length - fails}/${results.length} checks pass · ${renders} renders${missing.length ? ' · modules not written yet: ' + missing.join(', ') : ''}`);
process.exit(fails ? 1 : 0);
