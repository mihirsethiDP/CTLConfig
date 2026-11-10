#!/usr/bin/env node
/* v7 · tests/core7.test.js — headless test of core7.js (window.V7). Node only, no dependencies.
   Loads v6's layer and core7.js in prototype.html's order with a stub window/localStorage, boots the story, and checks the story's
   outcomes, determinism, the engine, the ledger and source chips, go live, the library (Where it lands → publish), advance(24h),
   a full diagnosis → fix → verify → close, persistence across a reload (a child process), and the words in core7's own text.
   Usage: node tests/core7.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const { spawnSync } = require('child_process');

const ASSETS = path.join(__dirname, '..', 'assets');
const ORDER = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'core7.js'];
const VERBOSE = process.argv.includes('-v');

function loadAll(preload) {
  const g = global; g.window = g; g.V7_NO_V6_SHELL = true;
  g.addEventListener = () => {}; g.removeEventListener = () => {};
  const store = new Map(Object.entries(preload || {}));
  g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), _store: store };
  const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {}, innerHTML: '' });
  g.document = { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), onkeydown: null };
  g.location = { hash: '#/plants', href: 'http://localhost/prototype.html#/plants' };
  g.scrollTo = () => {}; g.Blob = g.Blob || function Blob() {}; if (!g.URL) g.URL = {};
  for (const f of ORDER) vm.runInThisContext(fs.readFileSync(path.join(ASSETS, f), 'utf8'), { filename: f });
  return { V: g.V7, C: g.CTL, store };
}

/* ── child mode: a "reload" that must restore the saved story ───────────────────────────────── */
if (process.argv[2] === '--child') {
  const saved = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const { V } = loadAll(saved);
  V.boot();
  const out = { now: V.fmt(V.now()), open: V.issues('manesar', { status: 'open' }).map((i) => i.id), ov: V.overrides().length, seq: V.S.seq, state: V.state('vedanta'), lib: V.libVersion('OS_TANK_DF') };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail }); if (!ok) fails++; }
const timing = {};
const time = (label, fn) => { const t = Date.now(); const r = fn(); timing[label] = Date.now() - t; return r; };

const { V, C, store } = loadAll();
time('boot', () => V.boot());
const DAY = 864e5, MIN = 6e4;
const T = (s) => Date.parse(s + ':00+05:30');

/* ── 1. the story's start ───────────────────────────────────────────────────────────────────── */
check('start', 'clock reads Thu 29 Oct, 09:00', V.fmt(V.now()) === 'Thu 29 Oct, 09:00', V.fmt(V.now()));
const pl = V.plants();
check('start', 'four plants: DigitalPaani, Vedanta (Commissioning), Manesar, Bawal (Live)', pl.length === 4 && pl.map((p) => `${p.key}:${p.state}`).join(',') === 'digitalpaani:commissioning,vedanta:commissioning,manesar:live,bawal:live', pl.map((p) => `${p.key}:${p.state}`).join(','));
check('start', 'since: DP 29 Oct 08:30, Vedanta 23 Oct 10:00, Manesar 1 Sep, Bawal 15 Jul', V.fmt(pl[0].since) === 'Thu 29 Oct, 08:30' && V.fmt(pl[1].since) === 'Fri 23 Oct, 10:00' && V.fmtDate(pl[2].since) === '1 Sep 2026' && V.fmtDate(pl[3].since) === '15 Jul 2026', pl.map((p) => V.fmt(p.since)).join(' | '));
check('start', 'sample flags (DP is the real layout)', !pl[0].sample && pl[0].realLayout && pl[1].sample && pl[2].sample && pl[3].sample);

/* DigitalPaani */
const dpc = V.checklist('digitalpaani'); const dps = V.scadaReview('digitalpaani');
check('DigitalPaani', 'blockers: SCADA found, library, no alert, no Operator, no Lead', ['scada', 'library', 'alerts', 'operator', 'lead'].every((id) => dpc.blockers.some((b) => b.id === id)) && !dpc.canGoLive, dpc.blockers.map((b) => b.id).join(','));
check('DigitalPaani', 'nothing reviewed: no type accepted, no proposal decided, no alerts, no issues', dps.groups.every((g) => !g.accepted) && V.libraryReview('digitalpaani').every((r) => r.proposals.every((p) => !p.decided)) && V.alerts('digitalpaani').length === 0 && V.issues('digitalpaani').length === 0);
const sc = dps.typeDiffers.find((x) => x.tag === 'SC');
check('DigitalPaani', 'drawn type differs from stored: SC + EQT tanks', dps.typeDiffers.length === 3 && sc && sc.drawn === 'Screen Chamber Tank' && sc.stored === 'Open Skeleton Tank' && dps.typeDiffers.filter((x) => /^EQTT/.test(x.tag)).length === 2, dps.typeDiffers.map((x) => `${x.tag}: ${x.drawn} → ${x.stored}`).join('; '));
check('DigitalPaani', 'gap lists the drawn/stored difference', dpc.gaps.some((g) => g.id === 'drawn' && g.count === 3));

/* Vedanta */
const vAlerts = V.alerts('vedanta'); const byName = (n) => vAlerts.find((a) => a.name === n);
const doA = byName('DO low — SBR-1'), lvA = byName('Level high — EQ-1'), phA = byName('pH low — EQ-1');
const doS = V.trialStats('vedanta', doA.id), lvS = V.trialStats('vedanta', lvA.id);
check('Vedanta', 'trial: day 6 (5.9 days so far)', doS.trialDays > 5.8 && doS.trialDays < 6, doS.trialDays.toFixed(2));
check('Vedanta', 'DO low — SBR-1 ≈ 6 trial firings a day, mostly short, not noisy', doS.perDay >= 5 && doS.perDay <= 7 && doS.mostlyShort && !doS.noisy, `${doS.count} firings · ${doS.perDay.toFixed(1)}/day · ${Math.round(doS.shortShare * 100)}% short`);
check('Vedanta', 'Level high — EQ-1 11–14 a day: noisy', lvS.perDay >= 11 && lvS.perDay <= 14 && lvS.noisy && V.isNoisy('vedanta', lvA.id), `${lvS.count} firings · ${lvS.perDay.toFixed(1)}/day`);
const motorCounts = vAlerts.filter((a) => a.sensorName === 'Motor current' && a.state === 'trial').map((a) => V.trialStats('vedanta', a.id).count);
check('Vedanta', 'motor currents quiet', motorCounts.length >= 3 && motorCounts.every((n) => n === 0), motorCounts.join(','));
const em = V.issues('vedanta');
const emI = em[0];
check('Vedanta', 'one Emergency issue: pH low — EQ-1, Wed 28 Oct 15:10, Commissioning', em.length === 1 && emI.title === 'pH low — EQ-1' && emI.band === 'emergency' && V.fmt(emI.opened) === 'Wed 28 Oct, 15:10' && emI.commissioning === true && emI.status === 'open', em.map((i) => `${i.title} ${i.band} ${V.fmt(i.opened)}`).join('; '));
check('Vedanta', 'told the Leads by WhatsApp and in the app; no call, no hooter', emI.told.length > 0 && emI.told.every((t) => /Lead/.test(t.role)) && emI.told.some((t) => t.how === 'WhatsApp') && emI.told.some((t) => t.how === 'in the app') && !emI.told.some((t) => /call|hooter|alarm/.test(t.how)), emI.told.map((t) => `${t.who}: ${t.how}`).join(', '));
check('Vedanta', 'Emergency limit is a recorded change (Tuned for this plant)', V.limitsOf('vedanta', phA.sensorId, 'below').perBand.emergency.chip === 'changed' && V.overrides({ plant: 'vedanta' }).some((o) => o.reason === 'tuned'));
const vc = V.checklist('vedanta');
check('Vedanta', 'the only blocker is the undecided proposal (MLSS low — SBR-1)', vc.blockers.length === 1 && vc.blockers[0].id === 'library' && /MLSS low/.test(vc.blockers[0].text) && !vc.canGoLive && vc.whyNot === 'Go live is blocked by 1 thing: decide MLSS low on SBR-1', vc.blockers.map((b) => b.text).join(' | '));
check('Vedanta', 'roster has a reachable Operator and Lead', V.people('vedanta').some((p) => p.role === 'l1' && p.reachable) && V.people('vedanta').some((p) => p.role === 'l3' && p.reachable));

/* Manesar */
const mOpen = V.issues('manesar', { status: 'open' }); const doI = mOpen[0];
check('Manesar', 'one open issue: DO low — AT-2 at Major since 07:40, limit 1.0', mOpen.length === 1 && doI.title === 'DO low — AT-2' && doI.band === 'major' && V.fmt(doI.opened) === 'Thu 29 Oct, 07:40' && doI.terms.limit === 1 && doI.terms.band === 'major', mOpen.map((i) => `${i.title} ${i.band} ${V.fmt(i.opened)} ${JSON.stringify(i.terms)}`).join('; '));
/* round 2 (Q1): the Operator who was told started the diagnosis at 07:50, so the reading coming back cannot close it as unstarted */
const seededStep = doI.diag.path[0];
check('Manesar', 'its diagnosis was started at 07:50 by Dheeraj Kumar, who was told ("Is the blower running?" Yes)', doI.status === 'diagnosing' && doI.diag.path.length === 1 && seededStep.by === 'Dheeraj Kumar' && seededStep.answer === 'Yes' && V.fmt(seededStep.at) === 'Thu 29 Oct, 07:50' && doI.told.some((t) => t.who === 'Dheeraj Kumar') && doI.log.some((l) => /^Diagnosis started by Dheeraj Kumar/.test(l.text)), `${doI.status} · ${JSON.stringify(doI.diag.path)}`);
const mOv = V.overrides({ plant: 'manesar' });
check('Manesar', 'differences from the library imported (> 0), reason not recorded', mOv.length > 0 && mOv.some((o) => o.reason === 'unrecorded' && o.reasonLabel === 'Not recorded (changed before reasons were kept)'), `${mOv.length} differences`);
check('Manesar', 'something not in the library, with nothing to compare', mOv.some((o) => o.reason === 'notinlib' && o.libValue === 'Not in the library'));
const blk = mOv.find((o) => o.target.kind === 'hold' && o.target.alertId === 'a_blanket');
check('Manesar', 'Library changed since (Clarifier Tank v2, 20 Oct) and Review due (SP-1 criticality) at the start', blk && blk.state === 'libchanged' && blk.baseValue === '5 min' && blk.libValue === '15 min' && V.libVersion('CLARIFIER') === 2 && mOv.some((o) => o.target.kind === 'tier' && o.state === 'review'), blk && `${blk.what}: ${blk.plantValue}, base ${blk.baseValue}, library now ${blk.libValue}`);
const blCaution = V.limitsOf('manesar', 'bl1_amps', 'above').perBand.caution;
check('Manesar', 'BL-1 current: precedence change here → SCADA form (22 kW → 40 A) → library', blCaution.value === 44 && blCaution.chip === 'changed' && blCaution.baseValue === 40 && blCaution.formValue === 40, JSON.stringify(blCaution));
const at2 = V.limitsOf('manesar', 'at2_do', 'below');
check('Manesar', 'AT-2 DO follows the library (matched by reading and direction)', at2.perBand.minor.chip === 'lib' && at2.bands.minor === 2 && at2.bands.emergency === 0.5);
check('Manesar', 'MLSS on AT-1: one limit per direction (MLSS high follows, low is a change here)', V.limitsOf('manesar', 'at1_mlss', 'above').perBand.minor.chip === 'lib' && V.limitsOf('manesar', 'at1_mlss', 'below').perBand.minor.chip === 'changed');
const mc = V.coverage('manesar');
check('Manesar', 'Coverage from 30 days of sample history: fire rate, false alarms, time to close', mc.totals.firesPerDay > 0 && mc.totals.falseAlarmShare > 0 && mc.totals.medianCloseH > 0 && mc.blindSpots.length > 0, JSON.stringify(mc.totals));
check('Bawal', 'quiet: Live, no open issue', V.state('bawal') === 'live' && V.issues('bawal', { status: 'open' }).length === 0 && V.checklist('bawal').blockers.length === 0);

/* ── 2. determinism and purity ──────────────────────────────────────────────────────────────── */
const snap = () => JSON.stringify(V.S);
const s1 = snap();
const r1 = V.replay('vedanta', lvA.id, { from: V.now() - 7 * DAY, to: V.now() }); const r2 = V.replay('vedanta', lvA.id, { from: V.now() - 7 * DAY, to: V.now(), limits: { caution: 90, major: 95 } });
check('determinism', 'replay and series are pure (state unchanged)', snap() === s1 && JSON.stringify(V.series('manesar', 'at2_do', V.now() - DAY, V.now())) === JSON.stringify(V.series('manesar', 'at2_do', V.now() - DAY, V.now())));
check('determinism', 'replay with candidate limits fires less (Caution 90: 0)', r1.count > 50 && r2.count === 0, `${r1.count} → ${r2.count}`);
const ser = V.series('manesar', 'at2_do', T('2026-10-29T07:00'), T('2026-10-29T08:00'));
check('determinism', 'polls every 15 min at :10/:25/:40/:55; DO crash at 07:40', ser.map((p) => V.fmt(p.t).slice(-5)).join(',') === '07:10,07:25,07:40,07:55' && ser[1].v >= 2 && ser[2].v < 1, ser.map((p) => `${V.fmt(p.t).slice(-5)}=${p.v}`).join(' '));
/* round 2 (Q1): AT-2 DO stays under 1.0 until 09:40, then climbs back (1.6 at 09:40, inside from 09:55), so +1 hour after a 09:00 fix shows it inside */
const rec = V.series('manesar', 'at2_do', T('2026-10-29T08:55'), T('2026-10-29T11:00'));
check('determinism', 'AT-2 DO: under 1.0 until 09:25, 1.6 at 09:40, inside from 09:55', rec.filter((p) => p.t <= T('2026-10-29T09:25')).every((p) => p.v < 1) && rec.find((p) => p.t === T('2026-10-29T09:40')).v === 1.6 && rec.filter((p) => p.t >= T('2026-10-29T09:55')).every((p) => p.v >= 2), rec.map((p) => `${V.fmt(p.t).slice(-5)}=${p.v}`).join(' '));
time('reset', () => V.reset());
check('determinism', 'Reset the story gives the same state (ids from a seeded counter)', snap() === s1, `${s1.length} bytes`);
check('determinism', 'no random ids', !/_[a-z0-9]{5,}\d"/.test(JSON.stringify(C.D().alerts.map((a) => a.id))) && V.S.seq > 0);

/* ── 3. a limit change: the ledger and the source chips ─────────────────────────────────────── */
const lv = V.alerts('vedanta').find((a) => a.name === 'Level high — EQ-1');
const pv = V.previewLimits('vedanta', lv.sensorId, 'above', { caution: 90, major: 95 });
check('limits', 'last 7 days preview: would have fired N (now M)', pv.countNow > 60 && pv.count === 0, `with 90: ${pv.count}, now: ${pv.countNow}`);
const bad = V.setLimits('vedanta', lv.sensorId, 'above', { caution: 96, major: 95 }, { reason: 'tuned', note: 'x' });
check('limits', 'band order is checked', !bad.ok && /higher/.test(bad.error), bad.error);
const noWhy = V.setLimits('vedanta', lv.sensorId, 'above', { caution: 90, major: 95 }, {});
check('limits', 'leaving the library needs a reason and a note', !noWhy.ok && noWhy.needsReason, noWhy.error);
const okL = V.setLimits('vedanta', lv.sensorId, 'above', { caution: 90, major: 95 }, { reason: 'tuned', note: 'The tank fills to 88% on every cycle by design' });
const ovL = V.overrides({ plant: 'vedanta' }).find((o) => okL.overrides.includes(o.id));
const cB = V.limitsOf('vedanta', lv.sensorId, 'above').perBand;
check('limits', 'ledger entry with reason, author, base, review date', okL.ok && ovL && ovL.reason === 'tuned' && ovL.author === 'Satyadev Singh' && ovL.base === 85 && ovL.value === 90 && ovL.reviewBy > V.now() && ovL.state === 'ok', ovL && `${ovL.what}: ${ovL.plantValue} (library ${ovL.libValue}) · review by ${ovL.reviewByText}`);
check('limits', 'chips: Caution "Changed here", Major "From the library"', cB.caution.chip === 'changed' && cB.caution.chipText === 'Changed here' && cB.major.chip === 'lib' && cB.major.chipText === 'From the library');
check('limits', 'v6 in-place value written too', C.S.plants.vedanta.d.sensors.find((s) => s.id === lv.sensorId).limits.caution === 90);
check('limits', 'the alert is no longer noisy', !V.isNoisy('vedanta', lv.id) && !V.checklist('vedanta').gaps.some((g) => g.id === 'noisy'));
const fornow = V.setAlertTiming('manesar', 'a_do_at2', { hold: 15 }, { reason: 'fornow', until: '2026-10-30', note: 'DO probe being cleaned' });
check('limits', '"For now, until …" on must hold for', fornow.ok && V.sourceOf('manesar', { kind: 'hold', alertId: 'a_do_at2' }).chip === 'changed' && V.sourceOf('manesar', { kind: 'hold', alertId: 'a_do_at2' }).value === 15);
const back = V.setLimits('vedanta', lv.sensorId, 'above', { caution: 85, major: 95 }, {});
check('limits', 'back to the library value ends the change, no reason needed', back.ok && V.limitsOf('vedanta', lv.sensorId, 'above').perBand.caution.chip === 'lib' && V.overrides({ plant: 'vedanta', state: 'ended' }).some((o) => o.id === ovL.id));
V.setLimits('vedanta', lv.sensorId, 'above', { caution: 90, major: 95 }, { reason: 'tuned', note: 'The tank fills to 88% on every cycle by design' });

/* ── 4. advance(24h): Manesar opens issues from the series; the For now change ends on its date ─ */
/* v7: BL-1's Caution line raises "Clean the blower intake filters" at the plant (tests/linework7.test.js follows that); this walk
   follows the issue the line opens once it no longer raises the task */
const lwOff = V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: null });
check('advance', 'a line that raised a task opens an issue again once the task is taken off it', lwOff.ok && lwOff.changed && !V.lineWork('manesar').some((x) => x.sensorId === 'bl1_amps') && /opens an issue again/.test(V.activity({ plant: 'manesar', limit: 1 })[0].text));
const adv = time('advance 24h', () => V.advance(24 * 60));
check('advance', 'clock moves to Fri 30 Oct, 09:00', V.fmt(V.now()) === 'Fri 30 Oct, 09:00', adv.summary);
const mOpened = adv.opened.filter((o) => o.plant === 'manesar');
check('advance', 'Manesar opens issues: Motor current high — BL-1 (Caution), Sludge blanket high — SC-1', mOpened.some((o) => o.title === 'Motor current high — BL-1' && o.band === 'caution') && mOpened.some((o) => o.title === 'Sludge blanket high — SC-1'), mOpened.map((o) => `${o.title} ${o.band} ${V.fmt(o.opened)}`).join('; '));
check('advance', 'unstarted issue closes by its reading (blanket); the DO issue, started at 07:50, stays open though its reading is back', adv.closed.some((c) => c.title === 'Sludge blanket high — SC-1') && V.issue('manesar', doI.id).status === 'diagnosing' && !adv.closed.some((c) => c.id === doI.id));
check('advance', 'Vedanta trial firings keep coming (DO; Level is quiet at its tuned 90%)', adv.trial.filter((t) => t.plant === 'vedanta' && /^DO low/.test(t.name)).length >= 4 && !adv.trial.some((t) => /^Level high/.test(t.name)), `${adv.trial.length} trial firings`);
check('advance', 'Live tasks fall due; "For now" change back to the library on its date', adv.tasksDue.length > 0 && adv.expired.length === 1 && V.sourceOf('manesar', { kind: 'hold', alertId: 'a_do_at2' }).chip === 'lib', `${adv.tasksDue.length} tasks due`);
check('advance', 'activity is stamped with the one story clock', V.activity({ plant: 'manesar', limit: 1 })[0].at <= V.now() && V.activity({ plant: 'manesar' }).some((a) => V.fmt(a.at) === 'Thu 29 Oct, 14:25'));

/* ── 5. live operation: diagnosis → root cause (caused by BL-1) → fix → verify → close ──────── */
let st = V.diagStep('manesar', doI.id);
/* round 2 (Q1): question 1 ("Is the blower running?" Yes) was answered by the Operator at 07:50; the presenter carries on at question 2 */
check('issue', 'diagnostic: Low DO carries on at question 2 (the discharge gauge) after "Is the blower running?" Yes', st && /gauge on the blower discharge/.test(st.text) && /blower running/.test(V.flowOf(V.issue('manesar', doI.id).diag.flowId).steps[0].text) && !V.answer('manesar', doI.id, 1, 'Yes').ok, st && st.text);
const ans = V.answer('manesar', doI.id, st.id, 'No');
const di = V.issue('manesar', doI.id);
check('issue', 'root cause Intake filter blocked: Caused by BL-1', ans.ok && di.diag.causeId === 'c_intake' && di.causedBy === 'bl1' && di.status === 'diagnosing', `${di.diag.causeId} · caused by ${di.causedBy}`);
check('issue', "BL-1's Issues list it", V.issues('manesar', { eqId: 'bl1' }).some((i) => i.id === doI.id));
V.startFix('manesar', doI.id); const ff = V.flowOf(V.issue('manesar', doI.id).fix.flowId);
ff.steps.forEach((s) => V.fixStep('manesar', doI.id, s.id, s.type === 'question' ? 'No' : undefined));   /* round 5: a question step takes Yes or No */
check('issue', 'fix steps done → verifying', V.issue('manesar', doI.id).status === 'verifying', `${ff.name}: ${ff.steps.length} steps`);
V.verify('manesar', doI.id, true);
check('issue', 'verified → closed', V.issue('manesar', doI.id).status === 'closed' && V.issue('manesar', doI.id).closedHow === 'fixed');
const bl = V.issues('manesar', { status: 'open' }).find((i) => i.title === 'Motor current high — BL-1');
let s2 = V.diagStep('manesar', bl.id); V.answer('manesar', bl.id, s2.id, 'No'); s2 = V.diagStep('manesar', bl.id); V.answer('manesar', bl.id, s2.id, 'Yes');
V.startFix('manesar', bl.id); const bf = V.flowOf(V.issue('manesar', bl.id).fix.flowId); const lt = V.linkedTask({ flowId: bf.id, stepId: bf.steps[0].id });
check('issue', 'a fix step links the general task (Blower suction filter cleaning)', lt && lt.id === 't_mb_suction_filter' && lt.steps.length === 5, lt && lt.name);
V.verify('manesar', bl.id, false);
check('issue', 'not verified → back to diagnosis', V.issue('manesar', bl.id).status === 'diagnosing' && !V.issue('manesar', bl.id).diag.causeId);
check('issue', 'false alarm needs a why', !V.close('manesar', bl.id, { falseAlarm: true }).ok && V.close('manesar', bl.id, { falseAlarm: true, note: 'Filter was cleaned this morning' }).ok && V.issue('manesar', bl.id).falseAlarm);
const blTerms = V.issueTerms('manesar', bl.id);
check('issue', 'terms in words: "Opened under: Caution above 44 A, must hold for 5 min"', blTerms && /^Opened under: Caution above 44 A, must hold for 5 min/.test(blTerms.text) && !blTerms.changed, blTerms && blTerms.text);
V.setLimits('manesar', 'bl1_amps', 'above', { caution: 46, minor: 48 }, { reason: 'tuned', note: 'New impeller draws more' });
check('issue', 'a later limit change: "Opened under the old limit 44 A"', V.issueTerms('manesar', bl.id).changedText === 'Opened under the old limit 44 A (now 46 A)' && V.issue('manesar', bl.id).terms.limit === 44, V.issueTerms('manesar', bl.id).changedText);
const man = V.readings('vedanta').find((r) => r.kind === 'manual');
const manSet = man && V.setLimits('vedanta', man.id, 'above', { minor: 20 }, { note: 'Outlet turbidity target' });
check('issue', 'a manual reading takes limits on the same sheet (Not in the library)', man && man.expected && manSet.ok && V.limitsOf('vedanta', man.id, 'above').bands.minor === 20 && V.overrides({ plant: 'vedanta', reason: 'notinlib' }).some((o) => o.target.sensorId === man.id), man && `${man.name} · ${man.expected}`);
const sf = V.reportSensorFault('manesar', 'at2_do', { note: 'Handheld meter reads 2.6' }); const sfFix = sf.ok && V.startFix('manesar', sf.id);
check('issue', 'the sensor reads wrong: sensor-fault issue whose fix is the probe calibration', sf.ok && sf.issue.sensorFault && sf.issue.diag.causeId === 'c_probe' && sfFix.ok && sfFix.flowId === 'f_do_cal' && sf.calibrationTaskId, sf.ok && `${sf.issue.title} → ${sfFix.flowId} · task ${sf.calibrationTaskId}`);
check('issue', 'causes an issue can land on (for "I know the reason")', V.causesFor('manesar', doI.id).some((c) => c.id === 'c_intake') && V.causesFor('manesar', doI.id).some((c) => c.sensorFault));
const rep = V.report('manesar', 'bs1', 'i_bs_rake');
check('issue', 'report a problem opens the issue with its diagnostic', rep.ok && rep.issue.diag.flowId === 'd_bs_rake' && V.diagStep('manesar', rep.id) && rep.issue.told.length > 0);
const emNow = V.issue('vedanta', emI.id);
check('issue', 'the Commissioning Emergency stays open until a person closes it', emNow.status === 'open' && emNow.cleared != null);

/* ── 6. go live (Vedanta) ───────────────────────────────────────────────────────────────────── */
const blockedGo = V.goLive('vedanta');
check('go live', 'Go live refused with the reason while blocked', !blockedGo.ok && /MLSS low/.test(blockedGo.error), blockedGo.error);
const dec = V.decide('vedanta', vc.blockers[0].items[0].pid, 'reject', { reason: 'MLSS is still building up' });
const prev = V.goLivePreview('vedanta');
check('go live', 'preview lists exactly what changes (alerts On, calls and hooter, tasks a day both ways)', dec.ok && V.checklist('vedanta').canGoLive && prev.alertsOn >= 10 && prev.changes.includes('Calls and the hooter start now') && prev.tasksPerDayIfEach >= prev.tasksPerDay && prev.changes.some((c) => /^Tasks start: \d+ a day/.test(c)), prev.changes.join(' | '));
check('go live', 'rejecting a proposal is a difference with its reason', V.overrides({ plant: 'vedanta' }).some((o) => o.target.kind === 'onoff' && o.note === 'MLSS is still building up'));
const gl = V.goLive('vedanta'); const vts = V.tasks('vedanta');
const dues = vts.map((t) => t.due); const uniq = new Set(dues.map((d) => Math.round(d / 36e5)));
check('go live', 'Live: On trial → On; first due dates spread over each interval', gl.ok && V.state('vedanta') === 'live' && V.alerts('vedanta').filter((a) => a.state === 'trial').length === 0 && V.alerts('vedanta').filter((a) => a.state === 'on').length === prev.alertsOn && dues.every((d) => d >= V.now()) && uniq.size > vts.length / 3, `${vts.length} tasks, ${uniq.size} distinct due hours`);
check('go live', 'groups: one task per type with a line per equipment, to confirm', V.taskGroups('vedanta').some((g) => g.eqIds.length === 2 && g.toConfirm && /· 2 blowers$/.test(g.line)), (V.taskGroups('vedanta').find((g) => g.eqIds.length === 2) || {}).line);
const tk = vts[0]; V.startTask('vedanta', tk.id); const dn = V.doneTask('vedanta', tk.id);
check('go live', 'a task done moves its next due date on', dn.ok && dn.task.lastDone === V.now() && dn.task.due > V.now());
check('go live', 'Return to Commissioning needs a reason', !V.returnToCommissioning('bawal', '').ok);

/* ── 7. the library: edit → Where it lands → publish ────────────────────────────────────────── */
V.setLimits('manesar', 'at2_do', 'below', { minor: 2.2, major: 1, emergency: 0.5 }, { reason: 'tuned', note: 'AT-2 runs a higher load' });
const ed = V.editLib('OS_TANK_DF', { reading: 'Dissolved oxygen', dir: 'below', bands: { minor: 1.8, major: 1, emergency: 0.5 } });
const wl = V.whereItLands('OS_TANK_DF'); const wm = wl.plants.find((p) => p.key === 'manesar');
check('library', 'a draft, a normal change', ed.ok && V.libDraft('OS_TANK_DF').diffs.length === 1 && wl.kind === 'normal' && !wl.needsReason);
check('library', 'Where it lands: AT-1 follows (2.0 → 1.8), AT-2 keeps its own value (true counts)', wm && wm.follows.some((f) => /AT-1/.test(f.what) && f.from === '2.0 mg/L' && f.to === '1.8 mg/L') && wm.changedHere.some((c) => /AT-2/.test(c.what) && c.plantValue === '2.2 mg/L') && wl.totals.plants === 1 && wl.totals.keep === 1, wl.text);
check('library', 'publish needs a change note', !V.publish('OS_TANK_DF', {}).ok);
const pub = V.publish('OS_TANK_DF', { note: 'Diffuser tanks settle at a lower DO without harm' });
const at2ov = V.overrides({ plant: 'manesar' }).find((o) => o.target.sensorId === 'at2_do' && o.target.band === 'minor');
check('library', 'published v2; followers change; changed-here shows "Library changed since"', pub.ok && V.libVersion('OS_TANK_DF') === 2 && V.limitsOf('manesar', 'at1_do', 'below').bands.minor === 1.8 && at2ov && at2ov.state === 'libchanged' && V.limitsOf('manesar', 'at2_do', 'below').perBand.minor.chip === 'libchanged', at2ov && `${at2ov.what}: ${at2ov.plantValue} · library ${at2ov.libValue} · base ${at2ov.baseValue}`);
check('library', 'a dated change note in the plant Activity and Coverage', V.activity({ plant: 'manesar', kind: 'library' }).length > 0 && V.coverage('manesar').changes.some((c) => c.version === 2));
check('library', 'Keep acknowledges the library change', V.keep(at2ov.id, { reviewBy: '2027-03-01' }).ok && V.overrides({ plant: 'manesar' }).find((o) => o.id === at2ov.id).state === 'ok');
V.editLib('OS_TANK_DF', { reading: 'Dissolved oxygen', dir: 'below', bands: { minor: 1.8, major: 1, emergency: 0.7 } });
const ws = V.whereItLands('OS_TANK_DF');
check('library', 'an Emergency-band change is a safety change and needs a reason', ws.kind === 'safety' && ws.needsReason && !V.publish('OS_TANK_DF', { note: 'n' }).ok);
const pub2 = V.publish('OS_TANK_DF', { note: 'Earlier Emergency for deep DO sags', reason: 'Two near-misses this quarter' });
const endedEm = V.overrides({ plant: 'manesar', state: 'ended' }).find((o) => o.target.sensorId === 'at1_do' && o.target.band === 'emergency');
check('library', 'safety change reaches the plants that changed it: their change is ended with a note', pub2.ok && endedEm && /safety change/.test(endedEm.endedNote) && V.limitsOf('manesar', 'at1_do', 'below').bands.emergency === 0.7, endedEm && endedEm.endedNote);
const sg = V.suggest(V.overrides({ plant: 'manesar', reason: 'notinlib' })[0].id);
check('library', 'Suggest for the library logs a suggestion on the type', sg.ok && V.suggestions().length === 1);
check('library', '56 database types with plant counts', V.libTypes().length === 56 && V.libTypes().find((t) => t.code === 'BLW').plantCount === 3 && V.libTypes().find((t) => t.code === 'BLW').equipmentCount === 9, JSON.stringify(V.libTypes().find((t) => t.code === 'BLW').plants));

/* ── 8. persistence: a reload restores the same story ───────────────────────────────────────── */
V.persist();
const tmp = path.join(os.tmpdir(), `core7-test-${process.pid}.json`); fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(store)));
const child = spawnSync(process.execPath, [__filename, '--child', tmp], { encoding: 'utf8', timeout: 120000 }); try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
let rest = null; try { rest = JSON.parse(child.stdout); } catch (e) { rest = null; }
check('persist', 'a reload restores clock, issues, ledger, ids, states and library versions', rest && rest.now === V.fmt(V.now()) && JSON.stringify(rest.open) === JSON.stringify(V.issues('manesar', { status: 'open' }).map((i) => i.id)) && rest.ov === V.overrides().length && rest.seq === V.S.seq && rest.state === 'live' && rest.lib === 3, rest ? JSON.stringify(rest) : (child.stderr || '').slice(0, 300));
const keys = [...store.keys()];
check('persist', 'two stores: ctl7.estate.v1 and ctl7.overlay.v1', keys.includes('ctl7.estate.v1') && keys.includes('ctl7.overlay.v1'));
const ovl = JSON.parse(store.get('ctl7.overlay.v1')); ovl.saves += 1; store.set('ctl7.overlay.v1', JSON.stringify(ovl)); V.boot();
check('persist', 'a half-written save (stamps differ) reseeds both', V.fmt(V.now()) === 'Thu 29 Oct, 09:00' && V.libVersion('OS_TANK_DF') === 1);
V.advance(60); V.persist();
store.set('ctl7.overlay.v1', '{"v":0}'); V.boot();
check('persist', 'a mismatched store reseeds both (the story start)', V.fmt(V.now()) === 'Thu 29 Oct, 09:00' && V.state('vedanta') === 'commissioning');

/* ── 9. words: core7's own text never uses the banned words ─────────────────────────────────── */
const BANNED = /\b(machines?|custom|widgets?|estates?|trigger(s|ed)?|zones?|bindings?|persistence|derived|unit process(es)?|control groups?|stag(e|es|ed)|diverg(e|ed|ence)|stale)\b/i;
V.advance(60);
const texts = [];
const pushT = (v) => { if (typeof v === 'string') texts.push(v); };
['digitalpaani', 'vedanta', 'manesar', 'bawal'].forEach((k) => {
  const cl = V.checklist(k); cl.blockers.forEach((b) => pushT(b.text)); cl.gaps.forEach((g) => pushT(g.text)); pushT(cl.whyNot); Object.values(cl.tracks).forEach((t) => { pushT(t.label); pushT(t.next); });
  V.goLivePreview(k).changes.forEach(pushT);
  V.activity({ plant: k }).forEach((a) => pushT(a.text));
  V.issues(k).forEach((i) => { i.log.forEach((l) => pushT(l.text)); i.told.forEach((t) => pushT(t.how)); });
  V.overrides({ plant: k, state: 'all' }).forEach((o) => { pushT(o.what); pushT(o.plantValue); pushT(o.libValue); pushT(o.reasonLabel); pushT(o.stateLabel); pushT(o.endedNote); });
  V.libraryReview(k).forEach((r) => r.proposals.forEach((p) => { pushT(p.detail); pushT(p.blockedBy); }));
  V.tasks(k).forEach((t) => { pushT(t.line); pushT(t.shared); pushT(t.statusLabel); });
  V.alerts(k).forEach((a) => { pushT(a.stateLabel); pushT(a.hold.chipText); pushT(a.clockText); });
  V.sensors(k).forEach((s) => { pushT(s.nextPhaseNote); s.dirs.forEach((d) => Object.values(V.limitsOf(k, s.id, d).perBand).forEach((b) => pushT(b.chipText))); });
});
V.editLib('BLW', { reading: 'Motor current', dir: 'above', bands: { caution: 42, minor: 48 } }); const wb = V.whereItLands('BLW'); pushT(wb.text); pushT(wb.kindText); wb.plants.forEach((p) => [...p.follows, ...p.changedHere, ...p.fromForm].forEach((x) => { pushT(x.what); pushT(x.why); }));
const badWords = texts.filter((t) => BANNED.test(t));
check('words', `no banned words in ${texts.length} strings core7 writes`, badWords.length === 0, badWords.slice(0, 5).join(' || '));
check('words', 'Where it lands: motor currents from the SCADA form keep their value', wb.plants.some((p) => p.fromForm.length > 0), wb.text);

/* ── report ─────────────────────────────────────────────────────────────────────────────────── */
const groups = [...new Set(results.map((r) => r.group))];
console.log(`core7.test · ${results.length - fails}/${results.length} pass · boot ${timing.boot} ms · reset ${timing.reset} ms · advance(24h) ${timing['advance 24h']} ms`);
for (const g of groups) {
  const rs = results.filter((r) => r.group === g); const bad2 = rs.filter((r) => !r.ok);
  console.log(`  ${bad2.length ? 'FAIL' : 'ok  '} ${g.padEnd(13)} ${rs.length - bad2.length}/${rs.length}`);
  rs.filter((r) => !r.ok || VERBOSE).forEach((r) => console.log(`       ${r.ok ? '·' : '✗'} ${r.name}${r.detail != null ? `  [${String(r.detail).slice(0, 220)}]` : ''}`));
}
console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
process.exit(fails ? 1 : 0);
