#!/usr/bin/env node
/* v7/2 · object7.test.js — the object pages through the router and their handlers (node, no dependencies).
   Loads the v7/2 prototype through tests/load72.js, then checks object7's pages against the core functions that compute
   them: the unit-process and equipment pages, the sensor page's Zones, the Trigger page (frozen, waiting, trial, status,
   pins, the structure flag, a Task's and a condition Task's Trigger page), the Equipment Card, the design-parameter sheet
   and the library type pages. Every route renders for every plant twice (before and after a day passes) with no error,
   no junk and none of the words v7/2 never shows. The override form is checked through ledger7 when it is loaded and
   through object7's own small form with ledger7 hidden.
   Usage: TZ=Asia/Calcutta node tests/object7.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./load72.js');

const VERBOSE = process.argv.includes('-v');
const W = L.window; const V = L.V7; const UI = L.V7UI; const O = W.V7OBJ;
const results = []; let fails = 0;
function ok(name, cond, detail) { results.push({ name, pass: !!cond, detail }); if (!cond) fails++; }
function section(t) { results.push({ section: t }); }

/* ── helpers ───────────────────────────────────────────────────────────────────────────────────────────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', rarr: '→', times: '×', rsaquo: '›' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m));
const MARK = /<aside class="dec-mark"[\s\S]*?<\/aside>/g;
function text(html) { return decode(String(html || '').replace(MARK, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim(); }
const ERRORS = []; const cerr = console.error; console.error = (...a) => { ERRORS.push(a.map(String).join(' ').slice(0, 300)); };
function render(hash) { return L.render(hash.startsWith('#') ? hash : '#/' + hash) || ''; }
const failedPage = (html) => /This page could not be shown/.test(html);
const el = (attrs) => ({ getAttribute: (k) => { k = String(k).replace(/^data-/, ''); return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; }, value: attrs.value, checked: attrs.checked });
const act = (name, attrs) => { const fn = UI._handlers[name]; if (!fn) throw new Error('no handler ' + name); return fn(el(attrs || {}), {}); };
const last = () => UI._last || {};
const has = (s, sub) => String(s).includes(sub);
const noInputs = (html) => !/<(input|select|textarea)\b/i.test(String(html).replace(MARK, ''));
const J = (x) => JSON.stringify(x);

/* the words v7/2 never puts on a screen (outside verbatim workbook and library data) */
const BANNED = [
  ['machine', /\bmachines?\b/i], ['asset', /\bassets?\b/i], ['widget', /\bwidgets?\b/i], ['estate', /\bestates?\b/i], ['portfolio', /\bportfolio\b/i],
  ['custom', /\bcustom\b/i], ['detach', /\bdetach(ed)?\b/i], ['fork', /\bfork(ed|s)?\b/i], ['diverge', /\bdiverg(e|ed|es|ing|ence)\b/i], ['stale', /\bstale\b/i],
  ['drift', /\bdrift\b/i], ['alert', /\balerts?\b/i], ['alerting', /\balerting\b/i], ['alarm', /(?<!false )\balarms?\b/i], ['insight', /\binsights?\b/i],
  ['schedule', /\bschedules?\b/i], ['SCADA', /\bSCADA\b/i], ['database', /\bdatabase\b/i], ['the form', /\bSCADA form\b|\bthe form\b/i], ['hold time', /\bhold time\b/i],
  ['debounce', /\bdebounce\b/i], ['observation frequency', /\bobservation frequency\b/i], ['procedure', /\bprocedures?\b/i], ['workflow', /\bworkflows?\b/i],
  ['SOP', /\bSOPs?\b/i], ['remediation', /\bremediation\b/i], ['Site Admin', /\bSite Admin\b/i], ['SME', /\bSME\b/i], ['Supervisor', /\bSupervisor\b/i],
  ['onboarding', /\bonboarding\b/i], ['shadow', /\bshadow\b/i], ['test alert', /\btest alert\b/i], ['dry run', /\bdry run\b/i], ['detect', /\bdetect\b/i],
  ['priority', /\bpriority\b/i], ['tier', /(?<!criticality )\btier\b/i], ['Critical', /\bCritical\b|\bEssential\b|\bStandard\b/], ['rule', /(?<!limit |no )\brules?\b/i],
  ['survey type', /\bsurvey type\b/i], ['unit operation', /\bunit operations?\b/i], ['stage word', /\b(functional|process) stages?\b/i], ['sub-asset', /\bsub-assets?\b/i],
  ['Changed here', /Changed here/i], ['Library changed since', /Library changed since/i], ['Differences from the library', /Differences from the library/i],
  ['From the library', /From the library/i], ['No limits yet', /No limits yet/i], ['What the library brings', /What the library brings/i], ['Where it lands', /Where it lands/i],
  ['Not for this plant', /Not for this plant/i], ['On trial', /On trial/i], ['Mostly short', /Mostly short/i], ['Tuned for this plant', /Tuned for this plant/i],
  ['For now, until', /For now, until/i], ['Reason not recorded', /Reason not recorded/i], ['Not in the library', /Not in the library/i],
  ['Back to the library value', /Back to the library value/], ['Suggest for the library', /Suggest for the library/i], ['Who is told', /Who is told/i],
  ['User Center', /User Center/i], ['Phone view', /Phone view/i], ['Review due', /Review due/i], ['no call, no hooter', /no call, no hooter/i], ['told to the Leads', /told to the Leads/i],
  ['must hold for', /(?<!Persistence · )must hold for/i], ['must clear for', /(?<!Clearing · )must clear for/i],
];
const IDS = [/\b(CM|C|O)-\d{1,2}\b/, /(?<![-\w])E[1-5]\b/, /(?<![-\w])W\d{1,2}[a-d]?\b/, /(?<![-\w])P[1-6]\b/, /(?<![-\w])S[1-8]\b/, /\bV7-\d+\b/, /\bV72-\d+\b/, /\bPRD\b/, /§\s*\d/, /\bAC-?\d+\b/, /Amity/, /Noida/, /\.md\b/, /\.html\b/, /dp_intel/, /(?<![-\w])D\d{1,2}\b/];
const JUNK = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Invalid Date/, /\$\{/];
/* verbatim data text (workbook, catalogue, readings) is exempt, as in the smoke run */
const CORPUS = (() => {
  const seen = new Set(); const parts = [];
  const walk = (x, d) => { if (x == null || d > 8) return; if (typeof x === 'string') { if (x.length > 3) parts.push(x.replace(/\s+/g, ' ')); return; } if (typeof x !== 'object' || seen.has(x)) return; seen.add(x); if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1)); else Object.keys(x).forEach((k) => walk(x[k], d + 1)); };
  ['ISSUES', 'ISSUE_TASKS', 'SEED', 'CATALOGUE', 'READINGS', 'PLANT_PROFILES', 'NEXT_PHASE_FLOWS', 'NEXT_PHASE_CAUSES', 'RCA_MAPS', 'FORM_RULES', 'SCADA_FORM', 'DB_PALETTE'].forEach((g) => walk(W[g], 0));
  return parts.join('\n');
})();
const isData = (t, i, len) => { const left = t.slice(Math.max(0, i - 16), i + len).trim(); const right = t.slice(i, i + len + 16).trim(); return (left.length > len + 3 && CORPUS.includes(left)) || (right.length > len + 3 && CORPUS.includes(right)) || CORPUS.includes(t.slice(Math.max(0, i - 6), i + len + 6)); };
function scan(html) {
  const t = text(html); const out = [];
  const each = (re, cb) => { const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); let m; let n = 0; while ((m = g.exec(t)) && n++ < 50) { cb(m); if (!m[0]) g.lastIndex++; } };
  BANNED.forEach(([w, re]) => each(re, (m) => { if (!isData(t, m.index, m[0].length)) out.push(`${w}: …${t.slice(Math.max(0, m.index - 40), m.index + 40)}…`); }));
  IDS.forEach((re) => each(re, (m) => { if (!isData(t, m.index, m[0].length)) out.push(`id ${m[0]}: …${t.slice(Math.max(0, m.index - 40), m.index + 40)}…`); }));
  JUNK.forEach((re) => { const m = re.exec(t); if (m) out.push(`junk ${m[0]}: …${t.slice(Math.max(0, m.index - 40), m.index + 40)}…`); });
  return out;
}
const PAGES = []; // every page this test renders, scanned at the end
function page(hash) { const h = render(hash); PAGES.push({ hash, html: h }); return h; }
const TONES = ['lib', 'der', 'ovr', 'moved', 'susp', 'forced', 'pin', 'prop', 'gap', 'frozen', 'next', 'single', 'review'];

/* ════ 1 · loads and routes ════════════════════════════════════════════════════════════════════════════════ */
section('loads and routes');
ok('object7.js loads with the v7/2 stack', L.loaded.includes('object7.js') && !L.errors.some((e) => e.file === 'object7.js'), J(L.errors.map((e) => e.file)));
ok('V7OBJ exports render, zonesEditor, designParamsBlock, openDesignParam, openCadence', O && ['render', 'zonesEditor', 'designParamsBlock', 'openDesignParam', 'openCadence', 'closeOverride'].every((k) => typeof O[k] === 'function'));
const PATTERNS = ['p/:plant/eq/:id/:tab?', 'p/:plant/eq/:id/phone', 'p/:plant/eq/:id/card', 'p/:plant/up/:id/:tab?', 'p/:plant/up/:id/phone', 'p/:plant/sensor/:id', 'p/:plant/trigger/:id', 'p/:plant/alert/:id'];
const routes = UI.routes().map((r) => r.pattern || r);
ok('every object7 route is registered', PATTERNS.every((p) => routes.includes(p)), PATTERNS.filter((p) => !routes.includes(p)).join(', '));
['obj:ov', 'obj:report', 'obj:cadence', 'obj:activate', 'obj:leave', 'obj:pin', 'obj:unpin', 'obj:flagok', 'dp:edit', 'dp:save', 'rs:open', 'rs:do'].forEach((n) => ok(`handler ${n} is registered`, typeof UI._handlers[n] === 'function'));

/* ════ 2 · the unit-process page (AT-2) and the equipment page (BL-1) ══════════════════════════════════════ */
section('unit process and equipment');
{
  const u = V.unitProcess('manesar', 'at2');
  const h = page('p/manesar/up/at2'); const t = text(h);
  ok('AT-2: title, "Unit process", "Type: Activated sludge v1 ↗" linking to its unit-process type, "Stage: Secondary"', has(t, `${u.tag} · ${u.name}`) && has(t, 'Unit process') && has(t, `Type: ${u.typeName} v1 ↗`) && has(h, 'href="#/library/up-types/activated-sludge"') && has(t, `Stage: ${u.stageLabel}`), t.slice(0, 300));
  ok('AT-2: "Criticality tier B" with its source chip', has(t, u.tierSource.label) && has(t, u.tierSource.chip.text));
  ok('AT-2: the plant state chip reads "Live since Tue 1 Sep"', has(t, 'Live since ' + UI.fmtDay(V.plant('manesar').since)));
  ok('AT-2: crumbs run through the stage', /All Plants › Manesar STP › Secondary › AT-2/.test(t));
  ok('AT-2: tabs Readings · Issues · Tasks · Details', ['Readings', 'Issues', 'Tasks', 'Details'].every((x) => new RegExp(`role="tab"[^>]*>${x}`).test(h)));
  ok('AT-2: the Participants card lists BL-1 and BL-2, each "Also in AT-1"', /Participants/.test(t) && has(t, 'BL-1') && has(t, 'BL-2') && (t.match(/Also in AT-1/g) || []).length >= 2, t.slice(t.indexOf('Participants'), t.indexOf('Participants') + 300));
  /* the same card when structure7 is not loaded: object7's own */
  const S0 = W.V7STRUCT; W.V7STRUCT = undefined;
  const t2 = text(render('p/manesar/up/at2')); W.V7STRUCT = S0;
  ok('AT-2 without structure7: object7\'s own Participants card names BL-1, BL-2 and "Also in AT-1"', /Participants/.test(t2) && has(t2, 'BL-1') && has(t2, 'BL-2') && (t2.match(/Also in AT-1/g) || []).length >= 2 && has(t2, 'Control group: Air Blowers'));
  const r = page('p/manesar/up/at2'); const tr = text(r);
  const g = V.readingsTab('manesar').groups.find((x) => x.nodeId === 'at2');
  ok('AT-2 Readings: "Reading · Now · Limits · Source · Triggers", each row as the core reads it, "{n} · Edit on sensor"', /Reading Now Limits Source Triggers/.test(tr) && g.rows.filter((x) => !x.nextPhase).every((x) => has(tr, x.limitsText) && has(tr, x.triggerText) && x.chips.every((c) => has(tr, c.text))), g.rows.map((x) => x.triggerText).join(' | '));
  ok('AT-2 Readings: no limit input; every sensor links to its page', noInputs(r) && g.rows.every((x) => has(r, `href="#/p/manesar/sensor/${x.sensorId}"`)));
  const iss = V.issues('manesar', { upId: 'at2', includeShared: true }); const shared = iss.filter((i) => i.shared);
  const ti = text(page('p/manesar/up/at2/issues'));
  ok('the core lists BL-1\'s Issues on AT-2 as shared', shared.length > 0 && shared.every((i) => i.sharedVia === 'bl1'), J(shared.map((i) => i.id)));
  ok('AT-2 Issues tab: "Filed here" and "On its participants" with "Shared · on BL-1"', /Filed here/.test(ti) && /On its participants/.test(ti) && (ti.match(/Shared · on BL-1/g) || []).length === Math.min(shared.length, 15));
  const tt = text(page('p/manesar/up/at2/tasks')); const tasks = V.tasks('manesar', { upId: 'at2' });
  const partTasks = u.participants.reduce((s, p) => s + V.tasks('manesar', { eqId: p.eqId }).length, 0);
  ok('AT-2 Tasks: its own Tasks with cadence and chip, and the participants line', tasks.every((x) => has(tt, x.name) && has(tt, V.cadenceOf('manesar', x.scheduleIds[0]).chip.text)) && has(tt, `Work on its participants is filed on each of them: ${partTasks} Task${partTasks === 1 ? '' : 's'} on BL-1, BL-2`), tt.slice(-300));
  const hd = page('p/manesar/up/at2/details'); const td = text(hd);
  ok('AT-2 Details: Unit process · From the survey · Design parameters · Criticality tier · Structure changes', ['Unit process', 'From the survey', 'Design parameters', 'Criticality tier', 'Structure changes'].every((x) => has(td, x)) && has(td, 'Correct the survey, then re-run identification.'));
  ok('AT-2 Details: the type cannot change once the structure is confirmed, and says why', /Changing a unit process's type re-proposes its bindings, which this study doesn't do\./.test(td) && /disabled[^>]*>Change it in the structure pass|Change it in the structure pass<\/button>/.test(hd));
}
{
  const e = V.eq('manesar', 'bl1');
  const h = page('p/manesar/eq/bl1'); const t = text(h);
  ok('BL-1: "Participates in: AT-1, AT-2" (links) and "Control group: Air Blowers"', /Participates in: AT-1\s*,\s*AT-2/.test(t) && has(h, 'href="#/p/manesar/up/at1"') && has(t, 'Control group: Air Blowers'), t.slice(0, 400));
  ok('BL-1: "Criticality tier A" with its chip; the type links to the library', has(t, e.tierSource.label) && has(h, 'href="#/library/eq-types/BLW"'));
  ok('BL-1 Readings: no limit input; "Edit on sensor"', noInputs(h) && /Edit on sensor/.test(t));
  const td = text(page('p/manesar/eq/bl1/details'));
  ok('BL-1 Details: "Participates in" with AT-1 and AT-2, the survey card and the design parameters', /Participates in/.test(td) && has(td, 'AT-1') && has(td, 'AT-2') && has(td, 'The survey is the only source of equipment and sensors. Correct the survey, then re-run identification.') && /Motor rating/.test(td));
  const tk = text(page('p/manesar/eq/bl1/tasks'));
  ok('BL-1 Tasks: the condition Task and "Work on AT-1 and AT-2 is filed on those unit processes."', has(tk, V.conditionOf('manesar', 'w_intake').text) && has(tk, 'Work on AT-1 and AT-2 is filed on those unit processes.'), tk.slice(-300));
  const ha = page('p/manesar/eq/at2'); const ta = text(ha);
  ok('an anchor id under eq/ renders the unit-process page', has(ta, 'Unit process') && has(ta, 'Type: Activated sludge v1 ↗') && /role="tab"/.test(ha));
  const hb = page('p/manesar/up/bl1');
  ok('an equipment id under up/ renders the equipment page', /Participates in: AT-1/.test(text(hb)));
}

/* ════ 3 · drawn versus stored: on Details, never a Readiness gap ═══════════════════════════════════════════ */
section('drawn versus stored');
{
  const sc = V.nodes('digitalpaani').find((n) => n.tag === 'SC'); const u = V.unitProcess('digitalpaani', sc.id);
  const td = text(page(`p/digitalpaani/up/${sc.id}/details`));
  ok('SC\'s Details show the drawn-versus-stored fact', u.drawnFact && has(td, u.drawnFact), u.drawnFact);
  const cl = V.checklist('digitalpaani'); const ids = cl.gaps.map((g) => g.id).concat(cl.blockers.map((b) => b.id));
  ok('the fact is no Readiness blocker or gap', ids.every((x) => ['operator', 'lead', 'untyped', 'unclassified', 'drafts', 'nolimits', 'noisy', 'nopm', 'nodiag'].includes(x)) && !/Drawn in the plant graph/.test(J(cl)));
  const home = render('#/p/digitalpaani');
  ok('the Readiness page does not show it', !/Drawn in the plant graph/.test(text(home)));
  ok('SC\'s Details offer no type change once out of the pass; while the pass is open they link to it', /Change it in the structure pass/.test(td));
}

/* ════ 4 · the sensor page and its Zones ═══════════════════════════════════════════════════════════════════ */
section('sensor page');
{
  const h = page('p/vedanta/sensor/v_eq1_LVL?f=zone.above.caution'); const t = text(h);
  const z = V.zoneInfo('vedanta', 'v_eq1_LVL', 'above'); const al = V.alert('vedanta', 'a_3d');
  ok('banner "Limits for this reading live here. 1 Trigger follows this sensor: Level high · EQ-1."', has(t, `Limits for this reading live here. 1 Trigger follows this sensor: ${al.name} .`) || has(t, `Limits for this reading live here. 1 Trigger follows this sensor: ${al.name}.`), t.slice(0, 500));
  ok('chips: the reading, "Now …" with "Sample readings", the valid range, "Commissioning · nothing is sent"', /Now \S+/.test(t) && has(t, 'Sample readings') && /Valid range/.test(t) && has(t, 'Commissioning · nothing is sent'));
  ok('Zones: "Rises above" with every band as the core resolves it, value and chip', has(t, 'Rises above') && ['caution', 'minor', 'major', 'emergency'].every((b) => has(t, z.perBand[b].valueText) && has(t, z.perBand[b].chip.text)), ['caution', 'major'].map((b) => z.perBand[b].valueText + ' ' + z.perBand[b].chip.text).join(' | '));
  ok('"Emergency fires on the first reading (fixed)"', has(t, 'Emergency fires on the first reading (fixed)'));
  ok('?f=zone.above.caution marks that row is-target', /class="o-zr is-target"[^>]*data-f="zone\.above\.caution"/.test(h));
  ok('a Derived band offers Override and "Edit the design parameter"', /Override/.test(t) && has(t, 'Edit the design parameter') && has(h, '#/p/vedanta/up/v_eq1/details?f=dp.tankHeight'));
  ok('"Triggers that follow this sensor" lists Level high · EQ-1, its status and "Follows sensor"', /Triggers that follow this sensor/.test(t) && has(t, 'Active · trial') && has(t, 'Follows sensor'));
  ok('no input on the sensor page until a form opens', noInputs(h));
}
{
  const h = page('p/manesar/sensor/at1_mlss'); const t = text(h); const p = V.zoneInfo('manesar', 'at1_mlss', 'below').perBand.minor;
  ok('MLSS-AT1 "Falls below" Minor: the Migrated override chip with "Library: 2,000 mg/L" under it', has(t, 'Falls below') && has(t, p.chip.text) && has(t, p.chip.small), `${p.chip.text} · ${p.chip.small}`);
  ok('an overridden band offers Edit, Revert and Extend', /Edit/.test(t) && /Revert/.test(t) && /Extend/.test(t));
  const gap = V.sensors('digitalpaani').find((s) => /LVL-CCT/.test(s.tag));
  const hg = page(`p/digitalpaani/sensor/${gap.id}`); const tg = text(hg); const zg = V.zoneInfo('digitalpaani', gap.id, 'above').perBand.caution;
  ok('LVL-CCT: "Gap · needs tank height (CCT)" with Add parameter', has(tg, zg.chip.text) && /Add parameter/.test(tg), zg.chip.text);
  const hm = page('p/vedanta/sensor/m:v_sbr_MLSS');
  ok('a hand-test id has no sensor page: "Hand-test results stay in the task record: they have no sensor, so no Zones."', has(text(hm), 'Hand-test results stay in the task record: they have no sensor, so no Zones.'));
}

/* ════ 5 · the override form's preview: trial at a Commissioning plant, last 7 days on a Live one ══════════ */
section('override preview');
function previewChecks(label, open, setValue, getHtml) {
  /* Vedanta LVL-EQ-1 Caution 87: "Trial so far: would have fired {n} times instead of {m}." */
  const tgt = { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' };
  const ts = V.trialStats('vedanta', 'a_3d'); const bands = Object.assign({}, V.zoneInfo('vedanta', 'v_eq1_LVL', 'above').bands, { caution: 87 });
  const pl = V.previewLimits('vedanta', 'v_eq1_LVL', 'above', bands, { from: ts.since, to: V.now() });
  getHtml('p/vedanta/sensor/v_eq1_LVL'); open('vedanta', tgt); setValue('vedanta', tgt, 87);
  const t = text(getHtml('p/vedanta/sensor/v_eq1_LVL'));
  const line = `Trial so far: would have fired ${pl.count} ${pl.count === 1 ? 'time' : 'times'} instead of ${ts.count}.`;
  ok(`${label}: Commissioning preview reads "${line}" (n from previewLimits over the trial, m the trial count)`, has(t, line) && ts.count === 76 && has(t, 'Why does this plant differ?'), t.slice(t.indexOf('If you save'), t.indexOf('If you save') + 200));
  /* Manesar DO-AT2 Minor 1.5: "Last 7 days: would have fired {count} times (now {countNow})." */
  const t2 = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' };
  const pl2 = V.previewLimits('manesar', 'at2_do', 'below', Object.assign({}, V.zoneInfo('manesar', 'at2_do', 'below').bands, { minor: 1.5 }));
  getHtml('p/manesar/sensor/at2_do'); open('manesar', t2); setValue('manesar', t2, 1.5);
  const tt = text(getHtml('p/manesar/sensor/at2_do'));
  const line2 = `Last 7 days: would have fired ${pl2.count} ${pl2.count === 1 ? 'time' : 'times'} (now ${pl2.countNow}).`;
  ok(`${label}: Live preview reads "${line2}" (= previewLimits) and names the frozen Trigger`, has(tt, line2) && /frozen/.test(tt) && /Close it as a false alarm/.test(tt), tt.slice(tt.indexOf('If you save'), tt.indexOf('If you save') + 300));
}
{
  const LG = W.V7LEDGER;
  if (LG && typeof LG.formFor === 'function') {
    previewChecks('with ledger7',
      (key, t) => act('ov:open', { plant: key, target: J(t) }),
      (key, t, v) => { const st = Object.values(LG._forms || {}).find((x) => x.key === key && x.t && x.t.sensorId === t.sensorId && x.t.band === t.band); if (st) st.raw = String(v); },
      (h) => page(h));
    Object.keys(LG._forms || {}).forEach((k) => delete LG._forms[k]);
  } else ok('ledger7 is not loaded: the form is checked through object7\'s own', true);
  /* object7's own form, used when ledger7 is not loaded */
  W.V7LEDGER = undefined;
  previewChecks('object7\'s own form',
    (key, t) => act('obj:ov', { plant: key, target: J(t) }),
    (key, t, v) => { O._test.fsOf(key, t).value = v; },
    (h) => page(h));
  /* reason first: no reason → the ledger's "Choose why this plant differs." and nothing saved */
  const t3 = { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' };
  render('p/vedanta/sensor/v_eq1_LVL'); act('obj:ov', { plant: 'vedanta', target: J(t3) }); const st = O._test.fsOf('vedanta', t3); st.value = 87; st.reason = null;
  O._test.saveFallback(st.id);
  ok('object7\'s form: Save without a reason refuses with "Choose why this plant differs."', st.err === 'Choose why this plant differs.' && V.zoneInfo('vedanta', 'v_eq1_LVL', 'above').perBand.caution.source === 'derived');
  st.reason = 'physical'; const hp = text(render('p/vedanta/sensor/v_eq1_LVL'));
  ok('object7\'s form: Physical on a Derived band offers "Set the design parameter" and "Override anyway"', has(hp, 'Set the design parameter') && has(hp, 'Override anyway'));
  act('obj:ovclose');
  ok('closing the form leaves no input on the page', noInputs(render('p/vedanta/sensor/v_eq1_LVL')));
  W.V7LEDGER = LG;
}

/* ════ 6 · the Trigger page ═════════════════════════════════════════════════════════════════════════════════ */
section('Trigger page');
{
  const al = V.alert('vedanta', 'a_3d'); const ts = V.trialStats('vedanta', 'a_3d');
  const h = page('p/vedanta/trigger/a_3d'); const t = text(h);
  ok('Level high · EQ-1: chips Issue · "Template: Level high v1 ↗" · "Subject: EQ-1" · "Active · trial"', has(t, 'Issue') && has(t, `Template: ${al.templateName} v${al.templateVersion} ↗`) && has(t, `Subject: ${al.subject.tag}`) && has(t, 'Active · trial') && has(h, `href="#/library/templates/${al.templateId}"`));
  ok('the Commissioning banner: "Commissioning: nothing is sent. Firings below are trials only."', has(t, 'Commissioning: nothing is sent. Firings below are trials only.'));
  ok(`trial card: "${ts.text}" with "${ts.noisyChip}"`, has(t, ts.title) && has(t, ts.text) && has(t, ts.noisyChip));
  ok('trial card: the last row reads "still past the limit"', /still past the limit/.test(t.slice(t.lastIndexOf('Start End Band Peak Length'))) && ts.rows[ts.rows.length - 1].running);
  ok('trial card: a bar per day and the 10-a-day line', /class="o-days"/.test(h) && has(t, '10 a day'));
  const all = text(page('p/vedanta/trigger/a_3d?all=1'));
  ok('"Show all" lists every trial firing', (all.match(/Caution \d/g) || []).length >= ts.rows.length - 1 && has(t, `Show all ${ts.rows.length}`));
  const tb = V.triggerBands('vedanta', 'a_3d');
  ok('bands: "Follows sensor LVL-EQ-1 · …" for every band, linking to the band on the sensor page', ['caution', 'minor', 'major', 'emergency'].every((b) => has(t, tb.bands[b].chip.text)) && has(h, 'href="#/p/vedanta/sensor/v_eq1_LVL?f=zone.above.caution"'));
  ok('bands: "Override for this Trigger only", "Edit on sensor" and the footnote; no limit input', /Override for this Trigger only/.test(t) && /Edit on sensor/.test(t) && has(t, 'Limits are edited on the sensor. Override for this Trigger only is the exception, and needs a reason.') && noInputs(h));
  ok('"Persistence · must hold for", "Clearing · must clear for" and "Emergency band: fires on the first reading (fixed)"', has(t, `Persistence · must hold for ${al.hold.valueText}`) && has(t, `Clearing · must clear for ${al.clear.valueText}`) && has(t, 'Emergency band: fires on the first reading (fixed)'));
  ok('"Enabled · On" and "Start by / fix by follow the severity", read-only', has(t, 'Enabled · On') && has(t, 'Start by / fix by follow the severity'));
  ok('the version box offers "Pin this plant to v1"', has(t, `Pin this plant to v${al.templateVersion}`));
}
{
  const ts = V.trialStats('vedanta', 'a_3f'); const h = page('p/vedanta/trigger/a_3f'); const t = text(h);
  const row = ts.rows[0]; const em = V.zoneInfo('vedanta', 'v_eq1_PH', 'below').perBand.emergency;
  ok('pH low · EQ-1: one trial row Start · End · Band · Peak · Length with "Emergency · nobody was told"', ts.count === 1 && has(t, `${row.startText} ${row.endText} Emergency ${row.peakText} ${row.lengthText} Emergency · nobody was told`), t.slice(t.indexOf('Start End'), t.indexOf('Start End') + 160));
  ok('its Emergency band follows the Physical override, "Library: no rule" beneath', has(t, `Follows sensor PH-EQ-1 · ${em.chip.text}`) && has(t, 'Library: no rule'));
  const o = V.overrides({ plant: 'vedanta' }).find((x) => x.target && x.target.sensorId === 'v_eq1_PH' && x.target.band === 'emergency');
  ok('the record is Physical, base "no rule", review by 23 Oct 2027', o && o.reason === 'physical' && o.base == null && o.reviewByText === '23 Oct 2027', o && `${o.reason} · ${o.base} · ${o.reviewByText}`);
}
{
  const al = V.alert('manesar', 'a_do_at2'); const h = page('p/manesar/trigger/a_do_at2'); const t = text(h);
  ok('DO low · AT-2: "1 open Issue · this Trigger\'s terms are frozen until it closes. Changes on DO-AT2 and in the library show here as Base moved until you resync it."', has(t, '1 open Issue · this Trigger\'s terms are frozen until it closes. Changes on DO-AT2 and in the library show here as Base moved until you resync it.'));
  ok('its own settings show "Override · frozen", disabled', /disabled[^>]*>Override · frozen|Override · frozen<\/button>/.test(h) && (h.match(/Override · frozen/g) || []).length >= 5);
  ok('while frozen it cannot be set inactive either: its open Issue would have nothing to clear it', !/Set inactive…/.test(t) && /Enabled · On/.test(t));
  ok('"Frozen while 1 Issue is open" on its bands; no Commissioning banner on a Live plant', has(t, 'Frozen while 1 Issue is open') && !has(t, 'Commissioning: nothing is sent'));
  const cv = V.coverage('manesar').perTrigger.find((r) => r.alertId === 'a_do_at2');
  ok('Live stats from Coverage: Issues, a day, closed as false alarm, median time to close', has(t, cv.window ? cv.window.label : 'Issues, last 7 days') && has(t, `${Math.round(cv.falseAlarmShare * 100)}%`) && has(t, 'median time to close'));
  ok('"Issues it opened" lists the open Issue', has(t, `Issues it opened: ${V.issues('manesar', {}).filter((i) => i.alertId === 'a_do_at2').length}`));
  ok('the Persistence chip and the clearing override chip', has(t, al.hold.chip.text) && has(t, al.clear.chip.text) && has(t, al.clear.chip.small));
}
{
  const t = text(page('p/manesar/trigger/a_blanket')); const al = V.alert('manesar', 'a_blanket');
  ok('Sludge blanket high · SC-1: persistence "Base moved" with "Library changed 5 → 15 min since you overrode it"', al.hold.chip.text === 'Base moved' && has(t, 'Base moved') && has(t, al.hold.chip.sub), al.hold.chip.sub);
  ok('a base-moved value offers Keep and Adopt the library value', /Keep/.test(t) && /Adopt/.test(t));
  const ov = V.overrideById(al.hold.overrideId); const oc = V.chipFor({ src: 'override', reason: ov.reason, author: ov.author, at: ov.at, reviewBy: ov.reviewBy, expires: ov.expires, baseText: ov.baseText, baseSource: ov.baseSource });
  ok('a base-moved value keeps its own override chip (reason, who, when) before "Base moved"', has(t, oc.text) && t.indexOf(oc.text) < t.indexOf(al.hold.chip.sub), oc.text);
  ok('?f=tier marks the criticality tier row; ?f=persistence the persistence row', /class="o-field is-target" id="f-tier"/.test(render('p/manesar/eq/sp1/details?f=tier')) && /class="o-field is-target" id="f-persistence"/.test(render('p/manesar/trigger/a_blanket?f=persistence')));
  const ha = render('p/manesar/alert/a_blanket');
  ok('p/:plant/alert/:id renders the Trigger page', has(text(ha), 'Sludge blanket high · SC-1') && /pg-trig/.test(ha));
}
{
  const h = page('p/manesar/trigger/s_hypo'); const t = text(h); const c = V.cadenceOf('manesar', 's_hypo');
  ok('a Task\'s Trigger page: "How often · every week" with its chip and "Single-use · Manesar STP only", [Override]', has(t, `How often · ${c.everyText}`) && has(t, c.chip.text) && has(t, 'Single-use · Manesar STP only') && /Override/.test(t));
  ok('a Task\'s Trigger page links to the Task', has(h, 'href="#/p/manesar/task/s_hypo"'));
  const co = V.conditionOf('manesar', 'w_intake'); const tc = text(page('p/manesar/trigger/w_intake?f=condition.doWhen'));
  ok('a condition Task\'s Trigger page: do when and done when, each with its chip', has(tc, co.perField.doWhen.valueText) && has(tc, co.perField.doneWhen.valueText) && has(tc, co.perField.doWhen.chip.text) && has(tc, co.perField.doWhen.chip.small) && has(tc, co.perField.doneWhen.chip.small));
  ok('?f=condition.doWhen marks that row', /class="o-field is-target" id="f-condition.doWhen"/.test(render('p/manesar/trigger/w_intake?f=condition.doWhen')));
  ok('?f=clearing marks the clearing row', /class="o-field is-target" id="f-clearing"/.test(render('p/manesar/trigger/a_do_at2?f=clearing')));
  ok('a Trigger id that is not at the plant shows "Not found"', /Not found/.test(text(render('p/manesar/trigger/nope'))));
}

/* ════ 7 · status, pins, the structure flag ═════════════════════════════════════════════════════════════════ */
section('status, pins, structure flag');
{
  const h = page('p/vedanta/trigger/a_3t'); const t = text(h);
  ok('MLSS low · SBR-1 (draft): "Draft · never fires", "Activate" and "Leave inactive"', has(t, 'Draft · never fires') && /data-act="obj:activate"/.test(h) && /data-act="obj:leave"/.test(h));
  const P0 = W.V7PLANT; W.V7PLANT = undefined;
  act('obj:leave', { plant: 'vedanta', alert: 'a_3t' });
  ok('Leave inactive opens a modal asking why', last().modal && /Leave .* inactive\?/.test(last().modal.title));
  O._test.inputs.reason = ''; act('obj:leaveok', { plant: 'vedanta', alert: 'a_3t' });
  ok('with no reason: "Say why it stays inactive."', last().toast === 'Say why it stays inactive.' && V.alert('vedanta', 'a_3t').state === 'draft', last().toast);
  delete O._test.inputs.reason;
  act('obj:activate', { plant: 'vedanta', alert: 'a_3t' });
  const pv = V.activatePreview('vedanta', 'a_3t');
  ok('Activate opens the core\'s preview: its title and lines', last().modal && last().modal.title === pv.title && pv.lines.every((l) => has(text(last().modal.body), l)));
  act('obj:activateok', { plant: 'vedanta', alert: 'a_3t' }); W.V7PLANT = P0;
  ok('Activate makes it active, phase trial', V.alertState('vedanta', 'a_3t') === 'active' && V.triggerPhase('vedanta', 'a_3t') === 'trial');
  ok('its page now reads "Active · trial" with a trial card', has(text(render('p/vedanta/trigger/a_3t')), 'Active · trial'));
}
{
  const L0 = W.V7LIB; W.V7LIB = undefined;
  act('obj:pin', { plant: 'manesar', tpl: 'tpl_BLW_motor-current-high', v: '1' });
  ok('Pin opens "Pin this plant to v1" asking "Why should this plant stay on v1?"', last().modal && last().modal.title === 'Pin this plant to v1' && has(last().modal.body, 'Why should this plant stay on v1?'));
  O._test.inputs['pin.reason'] = ''; act('obj:pinok', { plant: 'manesar', tpl: 'tpl_BLW_motor-current-high' });
  ok('Pin with no reason is refused', /Say why/.test(last().toast || '') && !V.pins({ plant: 'manesar' }).length, last().toast);
  O._test.inputs['pin.reason'] = 'Trial of the new motor rating first'; act('obj:pinok', { plant: 'manesar', tpl: 'tpl_BLW_motor-current-high' });
  const t = text(render('p/manesar/trigger/a_bl1_amps'));
  ok('pinned: "Pinned to v1" and "Unpin · follows v1" on the Trigger page', V.pins({ plant: 'manesar' }).length === 1 && has(t, 'Pinned to v1') && has(t, 'Unpin · follows v1'));
  act('obj:unpin', { plant: 'manesar', tpl: 'tpl_BLW_motor-current-high' }); delete O._test.inputs['pin.reason']; W.V7LIB = L0;
  ok('Unpin ends the pin', !V.pins({ plant: 'manesar' }).length);
}
{
  const r = V.place('manesar', ['bs1'], ['eq1'], { note: 'The screen sits in EQ-1\'s inlet channel' });
  const t = text(render('p/manesar/trigger/a_flood')); const f = V.structureFlag('manesar', 'a_flood');
  ok('a structure change on a Live plant: the flagged Trigger shows its line and "Mark as checked"', r.ok && f && has(t, f.line) && /Mark as checked/.test(t), f && f.line);
  act('obj:flagok', { plant: 'manesar', alert: 'a_flood' });
  ok('Mark as checked clears the flag', !V.structureFlag('manesar', 'a_flood') && !/Structure changed/.test(text(render('p/manesar/trigger/a_flood'))));
}

/* ════ 8 · the Equipment Card ═══════════════════════════════════════════════════════════════════════════════ */
section('Equipment Card');
{
  const h = page('p/manesar/eq/bl1/phone'); const t = text(h);
  ok('BL-1\'s Card: no input outside sheets', noInputs(h));
  ok('BL-1\'s Card: sensor tiles with value, "Sample readings", a band bar, "Edit on sensor" and "Open the sensor page"', /Edit on sensor/.test(t) && /Open the sensor page/.test(t) && has(t, 'Sample readings') && /class="bb/.test(h) && has(h, 'href="#/p/manesar/sensor/bl1_amps?f=zone.above.'));
  ok('BL-1\'s Card: Task tiles with the cadence chip and "Change how often"; links to the equipment page', has(t, 'Change how often') && has(t, V.cadenceOf('manesar', 's_bl1_pm').chip.text) && /Open the equipment page/.test(t));
  const hu = page('p/manesar/up/at2/phone');
  ok('AT-2\'s Card (a unit process): no input, "Edit on sensor"', noInputs(hu) && /Edit on sensor/.test(text(hu)) && /Open the unit-process page/.test(text(hu)));
  ok('/card is the same Card', /Equipment Card/.test(text(render('p/manesar/eq/bl1/card'))) && noInputs(render('p/manesar/eq/bl1/card')));
  ok('the equipment page links to its Card', has(render('p/manesar/eq/bl1'), 'href="#/p/manesar/eq/bl1/phone"'));
  /* "Change how often" opens the cadence form in a sheet */
  act('obj:cadence', { plant: 'manesar', schedule: 's_bl1_pm' });
  ok('"Change how often" opens the override form for the cadence in a sheet', last().sheet && /Why does this plant differ\?/.test(text(last().sheet.body || '')), last().sheet && last().sheet.title);
  const LG = W.V7LEDGER; if (LG && LG._forms) Object.keys(LG._forms).forEach((k) => delete LG._forms[k]);
  W.V7LEDGER = undefined; act('obj:cadence', { plant: 'manesar', schedule: 's_bl1_pm' });
  ok('without ledger7, the same sheet carries object7\'s form with the reasons', last().sheet && /How often/.test(last().sheet.title) && /Physical/.test(text(last().sheet.body)) && /Tuning/.test(text(last().sheet.body)));
  act('obj:ovclose'); W.V7LEDGER = LG; UI.closeSheet(true);
}

/* ════ 9 · design parameters ═══════════════════════════════════════════════════════════════════════════════ */
section('design parameters');
{
  const cct = V.nodes('digitalpaani').find((n) => n.tag === 'CCT');
  const ref = { kind: 'up', id: cct.id };
  const td = text(page(`p/digitalpaani/up/${cct.id}/details?f=dp.tankHeight`));
  ok('CCT Details: "Design parameters" with Tank height "Gap · needs a value" and Add', /Design parameters/.test(td) && has(td, 'Gap · needs a value') && /Add/.test(td));
  ok('?f=dp.tankHeight marks its row', /o-dprow is-target/.test(render(`p/digitalpaani/up/${cct.id}/details?f=dp.tankHeight`)));
  act('dp:edit', { plant: 'digitalpaani', kind: 'up', id: cct.id, param: 'tankHeight' });
  ok('[Add] opens the sheet "Tank height · CCT"', last().sheet && last().sheet.title === 'Tank height · CCT', last().sheet && last().sheet.title);
  const DP = O._test.getDP(); DP.value = '3.5';
  const pv = V.designParamPreview('digitalpaani', ref, 'tankHeight', 3.5); const body = text(O._test.dpBody(DP));
  ok('"If you save" shows the core\'s lines', pv.lines.length && pv.lines.every((l) => has(body, l)), pv.lines.join(' | '));
  act('dp:save');
  const z = V.zoneInfo('digitalpaani', `${cct.id}_LVL`, 'above');
  ok('Save: toast "Tank height 3.5 m saved on CCT · …" with Undo; LVL-CCT resolves Derived', /^Tank height 3\.5 m saved on CCT/.test(last().toast || '') && typeof last().undo === 'function' && z.perBand.caution.source === 'derived', last().toast);
  last().undo();
  ok('Undo restores the gap', V.zoneInfo('digitalpaani', `${cct.id}_LVL`, 'above').perBand.caution.source === 'gap');
  act('dp:edit', { plant: 'manesar', id: 'bl1', param: 'motorRating' }); const D2 = O._test.getDP(); D2.value = '18.5';
  const pv2 = V.designParamPreview('manesar', { kind: 'eq', id: 'bl1' }, 'motorRating', 18.5);
  ok('BL-1 motor rating 22 → 18.5 kW: the preview lists the core\'s lines', pv2.lines.every((l) => has(text(O._test.dpBody(D2)), l)));
  act('dp:save');
  ok('replacing a survey value with no note: "Say why this differs from the survey."', D2.err === 'Say why this differs from the survey.' && V.designParams('manesar', { kind: 'eq', id: 'bl1' }).find((r) => r.key === 'motorRating').value === 22);
  UI.closeSheet(true);
  const pt = O.designParamsBlock('manesar', { kind: 'plant' });
  ok('designParamsBlock for the plant lists Rated flow and the consent limits', /Rated flow/.test(text(pt)) && /Discharge consent limits/.test(text(pt)));
}

/* ════ 10 · the library type pages ══════════════════════════════════════════════════════════════════════════ */
section('library type pages');
{
  const lt = V.libType('BLW'); const t = text(O.render({ mode: 'eqType', code: 'BLW', tab: 'readings' }));
  const motor = lt.readings.find((r) => r.name === 'Motor current').dirs[0];
  ok('Blower: "Equipment type · v1" and "Motor current high v1" with its limit rules', has(t, 'Equipment type · v1') && has(t, motor.title) && has(t, motor.rulesText));
  ok('Blower: every "Resolves at" line as the core writes it', /Resolves at:/.test(t) && motor.resolvesAt.every((x) => has(t, x.text)), motor.resolvesAt.map((x) => x.text).join(' | '));
  const m = V.libType('MBBR'); const hm = O.render({ mode: 'eqType', code: 'MBBR' });
  ok('MBBR: the banner and a link to Moving bed bioreactor', has(text(hm), m.banner) && has(hm, 'href="#/library/up-types/mbbr"'));
  const ag = text(O.render({ mode: 'eqType', code: 'OS_TANK_AG' }));
  ok('Agitator: "Motor current high v1", the chip and "This scales with the plant. Use a design parameter?"', has(ag, 'Motor current high v1') && has(ag, 'Library · Motor current high v1') && has(ag, 'This scales with the plant. Use a design parameter?'));
  const up = V.upTypeView('mbbr'); const tu = text(O.render({ mode: 'upType', id: 'mbbr', tab: 'tasks' }));
  ok('Moving bed bioreactor: "Unit-process type · v1" and every Task template', has(tu, 'Unit-process type · v1') && up.schedules.every((s) => has(tu, s.name)) && has(tu, `${up.schedules.length} Task templates`));
  const ti = text(O.render({ mode: 'upType', id: 'mbbr', tab: 'issues' }));
  ok('Moving bed bioreactor: its Issue types', up.issues.every((i) => has(ti, i.name)));
  ok('older mode names still render (type → eqType)', has(text(O.render({ mode: 'type', code: 'BLW' })), 'Equipment type · v1'));
  ok('a plant type renders its rounds', /Plant type · v1/.test(text(O.render({ mode: 'plantType', id: 'STP' }))));
  ok('an unknown code renders "Not found"', /Not found/.test(text(O.render({ mode: 'eqType', code: 'NOPE' }))));
}

/* ════ 11 · resync after the Issue closes (chapter 8's override, then +1 hour and Verify) ════════════════════ */
section('resync');
{
  V.setZone('manesar', 'at2_do', 'below', 'minor', 1.5, { reason: 'tuning', note: 'Short dips below 2.0 recover on their own; 1.5 is where the operators act' });
  const tb = V.triggerBands('manesar', 'a_do_at2').bands.minor; const tf = text(render('p/manesar/trigger/a_do_at2'));
  ok('frozen: Minor keeps its held value with "Frozen while 1 Issue is open" and the sensor\'s new value', has(tf, tb.overlayText) && has(tf, tb.nowText), `${tb.overlayText} · ${tb.nowText}`);
  V.advance(60); V.verify('manesar', 'is_2z', true);
  const h = render('p/manesar/trigger/a_do_at2'); const t = text(h);
  ok('closed with its terms moved: the waiting banner and [Resync with the sensor]', V.heldOf('manesar', 'a_do_at2').waiting && has(t, 'Base moved · this Trigger is still on the terms it was frozen on.') && /data-act="rs:open"/.test(h));
  ok('its own settings read "Resync first"', /Resync first/.test(t));
  const rp = V.resyncPreview('manesar', 'a_do_at2');
  act('rs:open', { plant: 'manesar', alert: 'a_do_at2' });
  ok(`the resync modal "${rp.title}" lists the core's lines and "${rp.lastDaysText}"`, last().modal && last().modal.title === rp.title && rp.lines.every((l) => has(text(last().modal.body), l)) && has(text(last().modal.body), rp.lastDaysText));
  const r0 = V.resyncPreview('manesar', 'a_do_at2');
  act('rs:do', { plant: 'manesar', alert: 'a_do_at2' });
  ok('[Resync]: the core\'s toast; the Trigger follows DO-AT2 again', r0.ok && /^Resynced DO low · AT-2/.test(last().toast || '') && !V.heldOf('manesar', 'a_do_at2').waiting && V.triggerTerms('manesar', 'a_do_at2').bands.minor === 1.5, last().toast);
}

/* ════ 12 · every route for every plant, twice ═════════════════════════════════════════════════════════════ */
section('every route, twice');
function sweep(label) {
  const routesDone = []; let bad = [];
  V.plants().forEach((p) => {
    const k = p.key;
    const ups = V.unitProcesses(k, {}).slice(0, 8); const eqs = V.equipment(k).slice(0, 6);
    const sens = V.sensors(k).slice(0, 8); const als = V.alerts(k, {}).slice(0, 8); const sch = V.schedules(k).slice(0, 3);
    const hashes = [];
    ups.forEach((u) => ['', '/issues', '/tasks', '/details', '/phone'].forEach((tab) => hashes.push(`p/${k}/up/${u.id}${tab}`)));
    eqs.forEach((e) => ['', '/issues', '/tasks', '/details', '/phone'].forEach((tab) => hashes.push(`p/${k}/eq/${e.id}${tab}`)));
    sens.forEach((s) => hashes.push(`p/${k}/sensor/${s.id}`));
    als.forEach((a) => hashes.push(`p/${k}/trigger/${a.id}`));
    sch.forEach((s) => hashes.push(`p/${k}/trigger/${s.id}`));
    O._test.conditionWorks(k).forEach((c) => hashes.push(`p/${k}/trigger/${c.workId}`));
    hashes.forEach((hs) => {
      const h = page(hs); routesDone.push(hs);
      if (!h || failedPage(h)) bad.push(`${hs}: did not render`);
      if (p.state === 'commissioning' && !has(text(h), 'Commissioning · nothing is sent')) bad.push(`${hs}: no "Commissioning · nothing is sent"`);
      if (p.state === 'live' && has(text(h), 'Commissioning · nothing is sent')) bad.push(`${hs}: says Commissioning on a Live plant`);
    });
  });
  ['BLW', 'PMP', 'MBBR', 'OS_TANK', 'OS_TANK_DF', 'OS_TANK_AG', 'DOS_TANK', 'CLARIFIER'].forEach((c) => ['readings', 'issues', 'tasks', 'details'].forEach((tab) => { const h = O.render({ mode: 'eqType', code: c, tab }); PAGES.push({ hash: `eqType ${c} ${tab}`, html: h }); if (!h || failedPage(h)) bad.push(`eqType ${c}`); }));
  V.upTypes().forEach((u) => ['readings', 'details'].forEach((tab) => { const h = O.render({ mode: 'upType', id: u.id, tab }); PAGES.push({ hash: `upType ${u.id} ${tab}`, html: h }); if (!h || failedPage(h)) bad.push(`upType ${u.id}`); }));
  ok(`${label}: ${routesDone.length} object pages render, each with the plant's state chip`, !bad.length, bad.slice(0, 6).join(' | '));
}
sweep('at the seed');
V.advance(1440);
sweep('a day later');

/* ════ 13 · words, chips, numbers ══════════════════════════════════════════════════════════════════════════ */
section('words and chips');
{
  const hits = []; PAGES.forEach((p) => scan(p.html).forEach((x) => hits.push(`${p.hash}: ${x}`)));
  const uniq = [...new Set(hits.map((h) => h.replace(/^[^:]+: /, '')))];
  ok(`no banned word, internal id or junk on ${PAGES.length} rendered pages`, !hits.length, uniq.slice(0, 6).join(' || '));
  const moved = []; const otherAmber = [];
  PAGES.forEach((p) => {
    (p.html.match(/<(span|a) class="chip chip-moved[^"]*"[^>]*>([^<]*)</g) || []).forEach((m) => { if (!/>Base moved</.test(m)) moved.push(`${p.hash}: ${m}`); });
    if (/class="chip chip-(warn|libchanged)\b/.test(p.html)) otherAmber.push(p.hash);
  });
  ok('"Base moved" is the only text on an amber-fill chip; no other amber chip on an object page', !moved.length && !otherAmber.length, moved.concat(otherAmber).slice(0, 4).join(' | '));
  /* every Zones row carries a source chip of the value-source vocabulary, visible without hover */
  const rowsWithout = [];
  PAGES.filter((p) => /pg-sensor/.test(p.html)).forEach((p) => {
    (p.html.match(/<tr class="o-zr[\s\S]*?<\/tr>/g) || []).forEach((row) => { if (!new RegExp(`class="chip chip-(${TONES.join('|')})\\b`).test(row)) rowsWithout.push(`${p.hash}: ${text(row).slice(0, 80)}`); });
  });
  ok('every Zones row carries a source chip (Library, Derived, Override, Base moved, Gap …)', !rowsWithout.length, rowsWithout.slice(0, 4).join(' | '));
  ok('no error was logged while rendering', !ERRORS.length, ERRORS.slice(0, 3).join(' | '));
}

/* ════ 14 · the files are clean for a public repository ════════════════════════════════════════════════════ */
section('public files');
{
  const files = ['assets/object7.js', 'assets/object7.css', 'tests/object7.test.js'].map((f) => [f, fs.readFileSync(path.join(__dirname, '..', f), 'utf8')]);
  const pats = [/§\s*\d/, /\bR\d{1,2}\b(?! ?[A-Z])/, /\bAnnex\b/i, /\bBuilder\s+[A-Z]/, /\bUI-[A-Z]\b/, /\bK-[A-D]\b/, /\bK1\b/, /scratchpad/i, /\b(CM|C|O)-\d{1,2}\b/, /\bwireframe\b/i, /\bcontract\b/i, /Amity|Noida/, /\b(he|him|his|she|her)\b/i];
  const hits = [];
  files.forEach(([f, src]) => pats.forEach((re) => { const lines = src.split('\n'); lines.forEach((ln, i) => { if (re.test(ln.replace(/\/(?:[^/\n\\]|\\.)+\/[gimsuy]*/g, ''))) hits.push(`${f}:${i + 1} ${re}`); }); }));
  ok('no section pointers, builder ids, internal paths, internal ids or gendered pronouns in object7\'s files', !hits.length, hits.slice(0, 6).join(' | '));
  const STORY = ['40.0', '42.0', '46.0', '33.6', '35.3', '38.6', '31.9', '28.6', '20.0 / 21.0', '12.8', '5.9 days', '5.9 a day', '76 times', '112 trial', '2,200', '2,500', '51 of 73', '28.8', '44 / 48', '(3.4 m)', '(3.8 m)', '(4.3 m)'];
  const src = files[0][1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  ok('no story number is typed into object7.js', !STORY.some((n) => src.includes(n)), STORY.filter((n) => src.includes(n)).join(', '));
}

/* ── report ────────────────────────────────────────────────────────────────────────────────────────────── */
console.error = cerr;
let n = 0;
results.forEach((r) => {
  if (r.section) { if (VERBOSE) console.log(`\n${r.section}`); return; }
  n++;
  if (!r.pass || VERBOSE) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${!r.pass && r.detail ? `\n       ${String(r.detail).slice(0, 600)}` : ''}`);
});
console.log(`object7.test · ${n - fails}/${n} passed${L.missing.length ? ` · not loaded: ${L.missing.join(', ')}` : ''}`);
console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
process.exit(fails ? 1 : 0);
