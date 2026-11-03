#!/usr/bin/env node
/* v7/2 · tests/core7.test.js — headless test of core7.js: the engine, Trigger status, stored trial firings, who is told, Tasks
   on one subject, the seed's ids, determinism, saving and the seams the other core files build on. Node only, no dependencies.
   Runs in parts, each in its own process (one load per process):
     main      the whole v7/2 stack through tests/load72.js: the outcomes that must hold whatever the other core files add
     --core    core7.js alone (LOAD72_UPTO=core7.js): v7/1's mechanics kept intact, and every seam (hooks, seed hooks,
               decorators, late binding, activity helpers, the internal handle)
     --v71     v7/1's own core, for the ids, names, states and Tasks-a-day figure v7/2 must keep
     --fresh   a second boot from empty storage (byte-equal state)
     --reload  a boot from a saved store (LOAD72_STORE): restores from the ctl72 keys
   Usage: TZ=Asia/Calcutta node tests/core7.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SELF = __filename;
const MODE = process.argv.find((a) => /^--(core|v71|fresh|reload)$/.test(a)) || 'main';
const VERBOSE = process.argv.includes('-v');
const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
const T = (s) => Date.parse(s + ':00+05:30');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const KEYS = ['digitalpaani', 'vedanta', 'manesar', 'bawal'];
const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail: detail == null ? undefined : String(detail) }); if (!ok) fails++; }
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb === undefined ? `threw: ${e.message}` : fb; } };
function child(args, env) {
  const r = spawnSync(process.execPath, [SELF, ...args], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { TZ: 'Asia/Calcutta' }, env || {}) });
  const line = String(r.stdout || '').split(/\r?\n/).filter((l) => l.startsWith('@@'))[0];
  if (!line) return { error: `${args.join(' ')} exited ${r.status}: ${String(r.stderr || r.stdout || '').slice(0, 600)}` };
  try { return JSON.parse(line.slice(2)); } catch (e) { return { error: 'bad output: ' + line.slice(0, 200) }; }
}
const emit = (o) => process.stdout.write('@@' + JSON.stringify(o) + '\n');

/* ── words core7 writes itself (engine, Issues, who is told, the clock): none of Alex's don't-use words ─────────────────── */
const WORDS = [/\balerts?\b/i, /\balerting\b/i, /(?<!false )\balarms?\b/i, /\bSCADA\b/, /(?<!Persistence · )must hold for/, /(?<!Clearing · )must clear for/, /\bOn trial\b/, /no call, no hooter/, /User Center/, /\bschedules?\b/i, /Who is told/];
function engineTexts(V) {
  const out = [];
  KEYS.forEach((k) => {
    V.issues(k).forEach((i) => { out.push(i.title); (i.log || []).forEach((l) => out.push(l.text)); (i.told || []).forEach((t) => out.push(t.how)); const it = V.issueTerms(k, i.id); if (it) { out.push(it.text); if (it.changedText) out.push(it.changedText); } out.push(V.__.toldText(i)); });
    V.alerts(k).forEach((a) => { out.push(a.stateLabel); out.push(a.chipText); });
  });
  out.push(V.__.toldText({ told: [] }));
  Object.values(V.LABELS.alertState).forEach((x) => out.push(x)); Object.values(V.LABELS.triggerChip).forEach((x) => out.push(x));
  return out.filter((x) => typeof x === 'string');
}
const badWords = (texts) => texts.filter((t) => WORDS.some((re) => re.test(t)));

/* ════════════════════════════════════ --v71: v7/1's own core, as reference ════════════════════════════════════════════ */
if (MODE === '--v71') {
  const g = global; g.window = g; g.V7_NO_V6_SHELL = true; g.addEventListener = () => {}; g.removeEventListener = () => {};
  const store = new Map(); g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
  const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {}, innerHTML: '' });
  g.document = { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el() }; g.location = { hash: '#/plants', href: 'http://localhost/prototype.html#/plants' }; g.scrollTo = () => {};
  const A71 = path.join(__dirname, '..', '..', '1', 'assets');
  for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'core7.js']) vm.runInThisContext(fs.readFileSync(path.join(A71, f), 'utf8'), { filename: f });
  const V = g.V7, C = g.CTL; V.boot();
  const plants = {};
  KEYS.forEach((k) => { const d = C.S.plants[k].d; plants[k] = { alerts: d.alerts.map((a) => [a.id, a.name]), eq: d.equipment.map((e) => [e.id, e.tag]), sensors: d.sensors.map((s) => [s.id, s.name]), schedules: d.schedules.map((s) => [s.id, s.name]), issues: V.issues(k).map((i) => [i.id, i.title]), states: Object.fromEntries(d.alerts.map((a) => [a.id, V.alertState(k, a.id)])) }; });
  emit({ seq: V.S.seq, plants, each: V.tasksPerDay('vedanta', { each: true }), overrideIds: V.S.overrides.map((o) => o.id) });
  process.exit(0);
}

/* ════════════════════════════════════ --fresh / --reload: another boot ═════════════════════════════════════════════════ */
if (MODE === '--fresh' || MODE === '--reload') {
  const L = require('./load72.js'); const V = L.V7;
  const P = V.__.PS('vedanta');
  emit({ sha: sha(JSON.stringify(V.S)), now: V.fmt(V.now()), seq: V.S.seq, tseq: V.S.tseq, trial: P.trialLog.length, open: V.issues('manesar', { status: 'open' }).map((i) => i.id), vedanta: V.state('vedanta'), states: KEYS.map((k) => V.alerts(k).map((a) => `${a.id}:${a.state}`).join(',')).join('|'), overrides: V.S.overrides.length, keys: [...L.store.keys()].sort(), errors: L.errors.map((e) => e.file) });
  process.exit(0);
}

/* ════════════════════════════════════ --core: core7.js alone ═══════════════════════════════════════════════════════════ */
if (MODE === '--core') {
  const L = require('./load72.js'); const V = L.V7; const C = L.CTL; const store = L.store; const __ = V.__;
  check('load', 'core7.js alone loads and boots', L.errors.length === 0 && L.loaded[L.loaded.length - 1] === 'core7.js', L.errors.map((e) => e.error.slice(0, 200)).join(' | ') || L.loaded.join(','));

  /* ── 1. the story's start: v7/1's outcomes, in v7/2's states ── */
  check('start', 'clock reads Thu 29 Oct, 09:00', V.fmt(V.now()) === 'Thu 29 Oct, 09:00', V.fmt(V.now()));
  const pl = V.plants();
  check('start', 'four plants: DigitalPaani, Vedanta (Commissioning), Manesar, Bawal (Live)', pl.map((p) => `${p.key}:${p.state}`).join(',') === 'digitalpaani:commissioning,vedanta:commissioning,manesar:live,bawal:live', pl.map((p) => `${p.key}:${p.state}`).join(','));
  check('start', 'since: DP 29 Oct 08:30, Vedanta 23 Oct 10:00, Manesar 1 Sep, Bawal 15 Jul', V.fmt(pl[0].since) === 'Thu 29 Oct, 08:30' && V.fmt(pl[1].since) === 'Fri 23 Oct, 10:00' && V.fmtDate(pl[2].since) === '1 Sep 2026' && V.fmtDate(pl[3].since) === '15 Jul 2026');
  check('start', 'Commissioning plants know when Commissioning began; Live plants do not', V.plant('vedanta').commissioningSince === T('2026-10-23T10:00') && V.plant('digitalpaani').commissioningSince === T('2026-10-29T08:30') && V.plant('manesar').commissioningSince === null);
  const dpc = V.checklist('digitalpaani'); const dps = V.scadaReview('digitalpaani');
  check('DigitalPaani', "v7/1's checklist is intact under core7 alone", ['scada', 'library', 'alerts', 'operator', 'lead'].every((id) => dpc.blockers.some((b) => b.id === id)) && !dpc.canGoLive, dpc.blockers.map((b) => b.id).join(','));
  check('DigitalPaani', 'nothing reviewed: no Trigger, no Issue, no trial firing', dps.groups.every((g) => !g.accepted) && V.alerts('digitalpaani').length === 0 && V.issues('digitalpaani').length === 0 && __.PS('digitalpaani').trialLog.length === 0);
  check('DigitalPaani', 'drawn type differs from stored: SC and the two EQT tanks', dps.typeDiffers.length === 3 && dps.typeDiffers.some((x) => x.tag === 'SC' && x.drawn === 'Screen Chamber Tank' && x.stored === 'Open Skeleton Tank'));

  const vA = V.alerts('vedanta'); const byName = (n) => vA.find((a) => a.name === n);
  const doA = byName('DO low — SBR-1'), lvA = byName('Level high — EQ-1'), phA = byName('pH low — EQ-1');
  const doS = V.trialStats('vedanta', doA.id), lvS = V.trialStats('vedanta', lvA.id);
  check('Vedanta', 'trial window: day 6 (5.9 days so far)', doS && doS.days > 5.8 && doS.days < 6 && V.fmt(doS.since) === 'Fri 23 Oct, 10:55', doS && doS.days.toFixed(3));
  check('Vedanta', 'DO low — SBR-1: 35 trial firings, 5.9 a day, not noisy, median 30 min, peak 1.58; no "mostly short"', doS.count === 35 && doS.perDay.toFixed(1) === '5.9' && !doS.noisy && doS.medianMin === 30 && doS.peak === 1.58 && !('mostlyShort' in doS), JSON.stringify({ ...doS, firings: undefined }));
  check('Vedanta', 'Level high — EQ-1: 76 trial firings, 12.8 a day, noisy, median 45 min, peak 88%', lvS.count === 76 && lvS.perDay.toFixed(1) === '12.8' && lvS.noisy && lvS.medianMin === 45 && lvS.peak === 88 && V.isNoisy('vedanta', lvA.id), JSON.stringify({ ...lvS, firings: undefined }));
  const motors = vA.filter((a) => a.sensorName === 'Motor current' && a.state === 'active');
  check('Vedanta', 'motor currents quiet', motors.length >= 3 && motors.every((a) => V.trialStats('vedanta', a.id).count === 0));
  check('Vedanta', 'no Issue: the pH Emergency is a trial firing only', V.issues('vedanta').length === 0 && V.trialStats('vedanta', phA.id).count === 1 && V.trialStats('vedanta', phA.id).emergencies === 1);
  check('Vedanta', 'Emergency limit is a recorded change at the plant (v7/1 ledger under core7 alone)', V.limitsOf('vedanta', phA.sensorId, 'below').perBand.emergency.value === 4 && V.overrides({ plant: 'vedanta' }).some((o) => o.target.sensorId === phA.sensorId));
  const vc = V.checklist('vedanta');
  check('Vedanta', "v7/1's checklist: the one blocker is the undecided MLSS low on SBR-1", vc.blockers.length === 1 && vc.blockers[0].id === 'library' && /MLSS low/.test(vc.blockers[0].text), vc.blockers.map((b) => b.text).join(' | '));
  check('Vedanta', 'its noisy gap counts stored trial firings', vc.gaps.some((g) => g.id === 'noisy' && g.count === 1));

  const mOpen = V.issues('manesar', { status: 'open' }); const doI = mOpen[0];
  check('Manesar', 'one open Issue: DO low · AT-2 at Major since 07:40, limit 1.0', mOpen.length === 1 && doI.id === 'is_2z' && doI.title === 'DO low · AT-2' && doI.band === 'major' && V.fmt(doI.opened) === 'Thu 29 Oct, 07:40' && doI.terms.limit === 1, mOpen.map((i) => `${i.id} ${i.title}`).join('; '));
  check('Manesar', 'its diagnosis was started at 07:50 by Dheeraj Kumar, who was told', doI.status === 'diagnosing' && doI.diag.path[0].by === 'Dheeraj Kumar' && V.fmt(doI.diag.path[0].at) === 'Thu 29 Oct, 07:50' && doI.told.some((t) => t.who === 'Dheeraj Kumar'));
  check('Manesar', 'its subject is its equipment by default (the issueSubject hook decides once loaded)', doI.subject && doI.subject.kind === 'eq' && doI.subject.id === 'at2', JSON.stringify(doI.subject));
  check('Manesar', 'its Opened under line uses persistence and clearing', V.issueTerms('manesar', doI.id).text === 'Opened under: Major < 1.0 mg/L · persistence 0 min · clearing 15 min', V.issueTerms('manesar', doI.id).text);
  const mOv = V.overrides({ plant: 'manesar' });
  check('Manesar', "v7/1's imported differences are intact (the ledger file migrates them)", mOv.length > 0 && mOv.some((o) => o.reason === 'unrecorded') && mOv.some((o) => o.reason === 'notinlib'), `${mOv.length}`);
  const blk = mOv.find((o) => o.target.kind === 'hold' && o.target.alertId === 'a_blanket');
  check('Manesar', 'the Clarifier publish of 20 Oct still happens in the seed (Library changed since on Sludge blanket high)', blk && blk.state === 'libchanged' && V.libVersion('CLARIFIER') === 2);
  const blC = V.limitsOf('manesar', 'bl1_amps', 'above').perBand.caution;
  check('Manesar', 'BL-1 current: the plant value 44 A over the derived 40 A', blC.value === 44 && blC.baseValue === 40, JSON.stringify(blC));
  check('Manesar', 'the hooter is on at every plant by default', KEYS.every((k) => __.PS(k).routing && __.PS(k).routing.hooter === true));
  check('Bawal', 'quiet: Live, no open Issue', V.state('bawal') === 'live' && V.issues('bawal', { status: 'open' }).length === 0);

  /* ── 2. Trigger status ── */
  check('status', 'every Trigger is draft, active or inactive; phase trial at a Commissioning plant, live at a Live one', KEYS.every((k) => V.alerts(k).every((a) => ['draft', 'active', 'inactive'].includes(a.state) && a.phase === V.triggerPhase(k, a.id) && (a.state !== 'active' || a.phase === (V.state(k) === 'live' ? 'live' : 'trial')))));
  check('status', 'labels: Draft · Active · Inactive; chips "Draft · never fires", "Active · trial", "Active", "Inactive"', JSON.stringify(V.LABELS.alertState) === JSON.stringify({ draft: 'Draft', active: 'Active', inactive: 'Inactive' }) && JSON.stringify(V.LABELS.triggerChip) === JSON.stringify({ draft: 'Draft · never fires', trial: 'Active · trial', live: 'Active', inactive: 'Inactive' }));
  const t3t = __.PS('vedanta').alerts.a_3t; const t3d = __.PS('vedanta').alerts.a_3d;
  check('status', 'MLSS low · SBR-1 is an undecided draft; Level high · EQ-1 active since 10:55, accepted', t3t.state === 'draft' && t3t.decided === null && t3d.state === 'active' && V.fmt(t3d.activeSince) === 'Fri 23 Oct, 10:55' && t3d.decided === 'accepted' && !('trialSince' in t3d) && !('trialUntil' in t3d), JSON.stringify({ t3t, t3d }));
  check('status', 'setAlertState moves draft → active, refuses active → draft', V.setAlertState('vedanta', 'a_3t', 'active').ok && V.alertState('vedanta', 'a_3t') === 'active' && V.triggerPhase('vedanta', 'a_3t') === 'trial' && !V.setAlertState('vedanta', 'a_3t', 'draft').ok && V.setAlertState('vedanta', 'a_3t', 'inactive', { reason: 'Biology still settling' }).ok && V.alertState('vedanta', 'a_3t') === 'inactive');
  V.reset();

  /* ── 3. the firing rule, on synthetic terms ── */
  const terms = { dir: 'above', unit: '', kind: 'number', incl: false, bands: { caution: 10, minor: null, major: 20, emergency: 30 }, hold: 30, clear: 15, gate: null };
  const run = (vals, tm) => { const tr = __.newTracker(); return vals.map((v, i) => { const ev = __.trackStep(tr, i * 15 * MIN, v, tm || terms, true); return ev ? `${i}:${ev.type}${ev.band ? ':' + ev.band : ev.f ? ':' + ev.f.band : ''}` : null; }).filter(Boolean); };
  check('engine', 'a firing starts once the reading has been past a band for its persistence', run([11, 11, 11, 5, 5]).join(' ') === '2:start:caution 4:end:caution', run([11, 11, 11, 5, 5]).join(' '));
  check('engine', 'Emergency fires on the first reading, whatever the persistence', run([31, 5, 5]).join(' ') === '0:start:emergency 2:end:emergency', run([31, 5, 5]).join(' '));
  check('engine', 'a deeper band in the same excursion is a step up; it ends after the clearing time', run([11, 11, 11, 21, 31, 5, 5]).join(' ') === '2:start:caution 3:up:major 4:up:emergency 6:end:emergency', run([11, 11, 11, 21, 31, 5, 5]).join(' '));
  const s1 = JSON.stringify(V.S);
  const r1 = V.replay('vedanta', 'a_3d', { from: V.now() - 7 * DAY, to: V.now() }); const r2 = V.replay('vedanta', 'a_3d', { from: V.now() - 7 * DAY, to: V.now(), limits: { caution: 90, major: 95 } });
  check('engine', 'replay and series are pure (state unchanged), and candidate limits fire less', JSON.stringify(V.S) === s1 && r1.count > 50 && r2.count === 0 && JSON.stringify(V.series('manesar', 'at2_do', V.now() - DAY, V.now())) === JSON.stringify(V.series('manesar', 'at2_do', V.now() - DAY, V.now())), `${r1.count} → ${r2.count}`);
  const ser = V.series('manesar', 'at2_do', T('2026-10-29T07:00'), T('2026-10-29T08:00'));
  check('engine', 'polls every 15 min at :10/:25/:40/:55; the AT-2 DO crash at 07:40', ser.map((p) => V.fmt(p.t).slice(-5)).join(',') === '07:10,07:25,07:40,07:55' && ser[1].v >= 2 && ser[2].v < 1);
  const pvL = V.previewLimits('vedanta', 'v_eq1_LVL', 'above', { caution: 87, major: 95 }); const ts3d = V.trialStats('vedanta', 'a_3d');
  const pvT = V.previewLimits('vedanta', 'v_eq1_LVL', 'above', { caution: 87, major: 95 }, { from: ts3d.since, to: V.now() });
  check('engine', 'previewLimits takes {from, to}: over the trial window it replays exactly that window', pvT.from === ts3d.since && pvT.to === V.now() && Math.abs(pvT.days - ts3d.days) < 1e-9 && pvT.countNow === ts3d.count && pvL.days === 7 && pvT.count === V.replay('vedanta', 'a_3d', { from: ts3d.since, to: V.now(), limits: { caution: 87, major: 95 } }).count, `trial: ${pvT.count} instead of ${pvT.countNow} (stored ${ts3d.count}); 7 days: ${pvL.count} (now ${pvL.countNow})`);

  /* ── 4. trial records are stored: tuning never rewrites them ── */
  const okL = V.setLimits('vedanta', 'v_eq1_LVL', 'above', { caution: 90, major: 95 }, { reason: 'tuned', note: 'The tank fills to 88% on every cycle by design' });
  check('trial', 'a limit change leaves the recorded trial firings in place; the noisy mark stays', okL.ok && V.trialStats('vedanta', 'a_3d').count === 76 && V.isNoisy('vedanta', 'a_3d') && V.checklist('vedanta').gaps.some((g) => g.id === 'noisy'), okL.error);
  const fornow = V.setAlertTiming('manesar', 'a_do_at2', { hold: 15 }, { reason: 'fornow', until: '2026-10-30', note: 'DO probe being cleaned' });
  const nTrial0 = __.PS('vedanta').trialLog.length;
  const adv = V.advance(24 * 60);
  const mOpened = adv.opened.filter((o) => o.plant === 'manesar');
  check('advance', 'clock moves to Fri 30 Oct, 09:00', V.fmt(V.now()) === 'Fri 30 Oct, 09:00', adv.summary);
  check('advance', 'Manesar opens Issues named "{template} · {tag}": Motor current high · BL-1 at Caution, Sludge blanket high · SC-1', mOpened.some((o) => o.title === 'Motor current high · BL-1' && o.band === 'caution') && mOpened.some((o) => o.title === 'Sludge blanket high · SC-1'), mOpened.map((o) => `${o.title} ${o.band}`).join('; '));
  check('advance', 'the unstarted blanket Issue closes by its reading; the DO Issue started at 07:50 stays open', adv.closed.some((c) => c.title === 'Sludge blanket high · SC-1') && V.issue('manesar', 'is_2z').status === 'diagnosing');
  const vNew = __.PS('vedanta').trialLog.slice(nTrial0);
  check('advance', 'Vedanta: no Issue, nobody told; new trial records (DO low), none for Level high at its tuned 90%', !adv.opened.some((o) => o.plant === 'vedanta') && V.issues('vedanta').length === 0 && vNew.length === adv.trial.filter((t) => t.plant === 'vedanta').length && vNew.some((r) => r.alertId === 'a_3r') && !vNew.some((r) => r.alertId === 'a_3d' && r.start > T('2026-10-29T09:00')), `${vNew.length} new records`);
  check('advance', 'the summary names trial firings, Issues and the expired change; Live Tasks fall due', new RegExp(`${adv.trial.length} trial firings`).test(adv.summary) && /Issues? opened/.test(adv.summary) && /1 override expired/.test(adv.summary) && adv.tasksDue.length > 0 && !('trialEnded' in adv) && fornow.ok, adv.summary);

  /* ── 5. who is told ── */
  const ml = __.tellList('manesar', 'emergency', false, V.now());
  check('told', 'Emergency on a Live plant: calls, a full-screen warning in the app, and the hooter while it is on', ml.some((x) => x.how === 'phone call') && ml.some((x) => x.how === 'full-screen warning') && ml.some((x) => x.how === 'hooter') && !ml.some((x) => /alarm/.test(x.how)));
  __.PS('manesar').routing.hooter = false;
  check('told', 'with the hooter off, no hooter entry', !__.tellList('manesar', 'emergency', false, V.now()).some((x) => x.how === 'hooter'));
  __.PS('manesar').routing.hooter = true;
  check('told', 'nobody reachable reads "Nobody could be told: no Operator or Lead with a verified phone on the People tab"', __.toldText({ told: [], band: 'major' }) === 'Nobody could be told: no Operator or Lead with a verified phone on the People tab');
  const emTold = __.toldText({ band: 'emergency', told: __.tellList('manesar', 'emergency', false, V.now()) });
  check('told', 'a told line reads in plain words and never ends "no call, no hooter"', /^Told called .*; a full-screen warning in the app for .*; the plant hooter$/.test(emTold), emTold);

  /* ── 6. live operation: v7/1's diagnosis → cause → fix → verify, with v7/2's words ── */
  const st2 = V.diagStep('manesar', 'is_2z'); const ans = V.answer('manesar', 'is_2z', st2.id, 'No'); const di = V.issue('manesar', 'is_2z');
  check('issue', 'root cause Intake filter blocked: Caused by BL-1 (the causeCandidates default)', ans.ok && di.diag.causeId === 'c_intake' && di.causedBy === 'bl1' && di.log.some((l) => l.text === 'Caused by BL-1 (Blower)'), di.log.slice(-2).map((l) => l.text).join(' | '));
  V.startFix('manesar', 'is_2z'); const ff = V.flowOf(V.issue('manesar', 'is_2z').fix.flowId); ff.steps.forEach((s) => V.fixStep('manesar', 'is_2z', s.id, s.type === 'question' ? 'No' : undefined));
  V.verify('manesar', 'is_2z', true);
  check('issue', 'fix steps done, verified → closed', V.issue('manesar', 'is_2z').status === 'closed' && V.issue('manesar', 'is_2z').closedHow === 'fixed');
  const bl = V.issues('manesar', { status: 'open' }).find((i) => i.title === 'Motor current high · BL-1');
  const blT = bl && V.issueTerms('manesar', bl.id);
  check('issue', 'terms in words: "Opened under: Caution > 44 A · persistence 5 min · clearing …"', blT && /^Opened under: Caution > 44 A · persistence 5 min · clearing \d+ min$/.test(blT.text) && !blT.changed, blT && blT.text);
  V.setLimits('manesar', 'bl1_amps', 'above', { caution: 46, minor: 48 }, { reason: 'tuned', note: 'New impeller draws more' });
  check('issue', 'a later change: "Opened under the old limit 44 A (now 46 A)"', bl && V.issueTerms('manesar', bl.id).changedText === 'Opened under the old limit 44 A (now 46 A)', bl && V.issueTerms('manesar', bl.id).changedText);
  const rep = V.report('manesar', 'bs1', 'i_bs_rake');
  check('issue', 'a reported problem at a Live plant opens with its diagnostic and tells people', rep.ok && rep.issue.diag.flowId === 'd_bs_rake' && rep.issue.told.length > 0 && rep.issue.subject.id === 'bs1');
  const repV = V.report('vedanta', 'v_bl1', (V.issueTypes('Blower')[0] || {}).id);
  check('issue', 'a reported problem at a Commissioning plant tells nobody', repV.ok && repV.issue.told.length === 0, repV.error);
  check('issue', 'no Issue type is marked "to confirm"', V.issueTypes().every((i) => i.homeToConfirm === false));

  /* ── 7. Tasks: one per subject ── */
  check('tasks', 'no set-level groups at any plant; every Task is single, on one subject, with no "to confirm" or "shared"', KEYS.every((k) => V.taskGroups(k).length === 0 && V.tasks(k).every((t) => t.kind === 'single' && t.eqIds.length <= 1 && !('toConfirm' in t) && !('shared' in t))));
  check('tasks', 'one Tasks-a-day figure ({each} gives the same)', KEYS.every((k) => V.tasksPerDay(k) === V.tasksPerDay(k, { each: true })));

  /* ── 8. go live: no Trigger changes status, the trial ends ── */
  V.reset();
  const blocked = V.goLive('vedanta');
  check('go live', 'refused while blocked (v7/1 checklist under core7 alone)', !blocked.ok && /MLSS low/.test(blocked.error), blocked.error);
  V.decide('vedanta', 'v_sbr|alert|MLSS low', 'reject', { reason: 'MLSS is still building up' });
  check('go live', 'rejecting a binding leaves its Trigger inactive and decided', V.alertState('vedanta', 'a_3t') === 'inactive' && __.PS('vedanta').alerts.a_3t.decided === 'rejected');
  const before = V.alerts('vedanta').map((a) => `${a.id}:${a.state}`).join(',');
  const running = __.PS('vedanta').trialOpen.a_3d; const nT = __.PS('vedanta').trialLog.length;
  const gl = V.goLive('vedanta'); const PV = __.PS('vedanta');
  check('go live', 'Live; no Trigger changed its status; phases are live now', gl.ok && V.state('vedanta') === 'live' && V.alerts('vedanta').map((a) => `${a.id}:${a.state}`).join(',') === before && V.alerts('vedanta').filter((a) => a.state === 'active').every((a) => a.phase === 'live'), gl.error);
  check('go live', 'the running Level high trial record ended at go-live; nothing is running; Commissioning is over', running && PV.trialLog.find((r) => r.id === running).end === V.now() && Object.keys(PV.trialOpen).length === 0 && PV.commissioningSince === null && PV.trialLog.length === nT && V.trialStats('vedanta', 'a_3d') === null);
  const vts = V.tasks('vedanta'); const uniq = new Set(vts.map((t) => Math.round(t.due / HOUR)));
  check('go live', 'first due dates from the firstDue default (spread over each cadence)', vts.length > 0 && vts.every((t) => t.due >= V.now()) && uniq.size > vts.length / 3 && vts.every((t) => ['spread', 'meter'].includes(PV.tasks[t.id].firstDue)), `${vts.length} Tasks, ${uniq.size} distinct hours`);
  const a2 = V.advance(1440);
  check('go live', 'after go-live a firing opens an Issue and writes no trial record', a2.opened.some((o) => o.plant === 'vedanta') && PV.trialLog.length === nT && !a2.trial.some((t) => t.plant === 'vedanta'), a2.summary);
  check('go live', 'Return to Commissioning needs a reason, keeps statuses, starts a new trial window', !V.returnToCommissioning('bawal', '').ok && V.returnToCommissioning('bawal', 'Recommissioning the UF').ok && V.state('bawal') === 'commissioning' && V.alerts('bawal').every((a) => a.state === 'active' && a.phase === 'trial') && __.PS('bawal').commissioningSince === V.now());
  const a3 = V.advance(1440);
  check('go live', 'after a return, firings are trial records again: no new Issue at Bawal', !a3.opened.some((o) => o.plant === 'bawal'));

  /* ── 9. the library: edit → Where it lands → publish (v7/1's, kept for the library file to replace) ── */
  V.reset();
  V.setLimits('manesar', 'at2_do', 'below', { minor: 2.2, major: 1, emergency: 0.5 }, { reason: 'tuned', note: 'AT-2 runs a higher load' });
  V.editLib('OS_TANK_DF', { reading: 'Dissolved oxygen', dir: 'below', bands: { minor: 1.8, major: 1, emergency: 0.5 } });
  const wl = V.whereItLands('OS_TANK_DF'); const pub = V.publish('OS_TANK_DF', { note: 'Diffuser tanks settle at a lower DO without harm' });
  check('library', "v7/1's publish still works under core7 alone: AT-1 follows 2.0 → 1.8, AT-2 keeps its own", wl && wl.totals.plants === 1 && pub.ok && V.libVersion('OS_TANK_DF') === 2 && V.limitsOf('manesar', 'at1_do', 'below').bands.minor === 1.8 && V.limitsOf('manesar', 'at2_do', 'below').bands.minor === 2.2, wl && wl.text);
  check('library', '56 database types with plant counts', V.libTypes().length === 56);

  /* ── 10. seams ── */
  V.reset();
  const src = fs.readFileSync(path.join(L.ASSETS, 'core7.js'), 'utf8');
  const top = []; src.split(/\r?\n/).forEach((l) => { let m = /^ {2}function ([A-Za-z_$][\w$]*)\s*\(/.exec(l); if (m) top.push(m[1]); m = /^ {2}const ([A-Za-z_$][\w$]*)\s*=\s*(\(|async|function|[A-Za-z_$][\w$]*\s*=>)/.exec(l); if (m) top.push(m[1]); });
  const missingNames = top.filter((n) => !['api', '__'].includes(n) && !(n in __));
  check('seams', `V7.__ holds every top-level function of core7.js by its own name (${top.length})`, top.length > 250 && missingNames.length === 0, missingNames.join(', '));
  check('seams', 'V7.__ also holds S (a getter), PS, ME, LABELS, T, DAY, HOUR, MIN, nextId, counterId, addActivity, addActivityAt, replaceActivity, touch, persist, cached, dryRun, hook, callHook, onSeed, decorate',
    __.S === V.S && ['PS', 'nextId', 'counterId', 'addActivity', 'addActivityAt', 'replaceActivity', 'touch', 'persist', 'cached', 'dryRun', 'hook', 'callHook', 'onSeed', 'decorate', 'T', 'seeding'].every((n) => typeof __[n] === 'function') && __.ME === 'Satyadev Singh' && __.LABELS === V.LABELS && __.DAY === DAY && __.HOUR === HOUR && __.MIN === MIN && __.T('2026-10-29T09:00') === V.NOW0);
  check('seams', 'nodes(key) lists every plant-graph node (v7/1\'s equipment list)', V.nodes('digitalpaani').length === C.S.plants.digitalpaani.d.equipment.length && V.nodes('digitalpaani').length === V.equipment('digitalpaani').length);
  /* hooks */
  check('seams', 'callHook runs the default when nothing is registered', __.callHook('nosuch', (a, b) => a + b, 2, 3) === 5 && __.callHook('nosuch', null) === undefined);
  __.hook('terms', (k, id, o) => { const t = __.termsOf(k, id, o); return id === 'a_3d' && !(o && o.limits) ? { ...t, bands: { ...t.bands, caution: 99 } } : t; });
  const rT = V.replay('vedanta', 'a_3d', { from: V.now() - DAY, to: V.now() });
  __.hook('terms', null);
  check('seams', "the 'terms' hook decides every replay; hook(name, null) removes it", rT.count === 0 && rT.terms.bands.caution === 99 && V.replay('vedanta', 'a_3d', { from: V.now() - DAY, to: V.now() }).count > 0);
  /* seed hooks, subject, opened/closed during a reset */
  const seen = []; let spy = false; let opened = 0, closed = 0;
  __.onSeed('before', (S) => { if (!spy) return; seen.push(`before:${Object.keys(S.plants).length}:${__.PS('vedanta').trialLog.length}:${S.activity.length}`); });
  __.onSeed('after', (S) => { if (!spy) return; seen.push(`after1:${__.PS('vedanta').trialLog.length}:${__.seeding()}`); });
  __.onSeed('after', () => { if (!spy) return; seen.push('after2'); });
  __.hook('issueSubject', (k, a) => (spy ? { kind: 'test', id: a.subject.id } : { kind: 'eq', id: a.subject.id }));
  __.hook('issueOpened', () => { if (spy) opened++; });
  __.hook('issueClosed', () => { if (spy) closed++; });
  spy = true; const reseed = JSON.stringify(V.reset()); spy = false;
  const alertIss = KEYS.flatMap((k) => V.issues(k).filter((i) => i.alertId != null));
  check('seams', "onSeed: 'before' once the plants exist and before any story step; 'after' after every v7/1 step, in registration order", seen.join(' ') === 'before:4:0:0 after1:112:false after2', seen.join(' '));
  check('seams', "the 'issueSubject' hook gives every Trigger's Issue its subject", alertIss.length > 0 && alertIss.every((i) => i.subject && i.subject.kind === 'test'), JSON.stringify(V.issue('manesar', 'is_2z').subject));
  check('seams', "'issueOpened' runs for every Trigger Issue the seed opens; 'issueClosed' for every one it closes (by the reading or by a person)", opened === alertIss.length && closed === alertIss.filter((i) => i.status === 'closed').length, `opened ${opened}/${alertIss.length}, closed ${closed}/${alertIss.filter((i) => i.status === 'closed').length}`);
  __.hook('issueSubject', null); __.hook('issueOpened', null); __.hook('issueClosed', null);
  V.reset(); const plain = JSON.stringify(V.S);
  /* late binding: replaced public names are used after the seed, never during it */
  const own = {}; ['publish', 'whereItLands', 'decide', 'setLimits', 'checklist', 'libTypes'].forEach((n) => { own[n] = V[n]; V[n] = () => { throw new Error(`replaced ${n} called`); }; });
  const seededWhileReplaced = safe(() => JSON.stringify(V.reset()));
  check('seams', 'the v7/1 seed steps keep core7\'s own functions even when the public ones are replaced (the seed is byte-equal)', seededWhileReplaced === plain, typeof seededWhileReplaced === 'string' && seededWhileReplaced.startsWith('threw') ? seededWhileReplaced : 'differs');
  V.checklist = () => ({ canGoLive: false, whyNot: 'Blocked by the replaced checklist', gaps: [], blockers: [] });
  const glr = V.goLive('vedanta'); const cov = safe(() => V.coverage('manesar').gaps.length);
  let libT = null; V.libTypes = () => [{ code: 'BLW', plants: [{ key: 'x' }] }]; libT = V.libType('BLW').plants;
  Object.keys(own).forEach((n) => { V[n] = own[n]; });
  check('seams', "after the seed, core7's own calls go to the replaced public names (goLive → checklist, coverage → checklist, libType → libTypes)", !glr.ok && glr.error === 'Blocked by the replaced checklist' && cov === 0 && libT.length === 1 && libT[0].key === 'x', `${glr.error} · ${cov}`);
  V.reset();
  check('seams', 'a reset after the swaps gives the same seed again', JSON.stringify(V.S) === plain);
  /* decorators */
  ['eq', 'sensor', 'alert', 'issue', 'task', 'plant'].forEach((k) => __.decorate(k, (v, key) => { v.decoratedBy = `${k}:${key}`; return v; }));
  __.touch();
  const decOk = V.eq('manesar', 'bl1').decoratedBy === 'eq:manesar' && V.equipment('manesar')[0].decoratedBy === 'eq:manesar' && V.sensors('manesar')[0].decoratedBy === 'sensor:manesar' && V.alert('manesar', 'a_do_at2').decoratedBy === 'alert:manesar' && V.issue('manesar', 'is_2z').decoratedBy === 'issue:manesar' && V.issues('manesar')[0].decoratedBy === 'issue:manesar' && V.tasks('manesar')[0].decoratedBy === 'task:manesar' && V.plant('manesar').decoratedBy === 'plant:manesar';
  check('seams', 'decorate(kind, fn) passes every eq, sensor, alert, issue, task and plant view through fn', decOk);
  check('seams', 'an issue view is a copy once issue decorators exist: the stored record is untouched', !('decoratedBy' in __.PS('manesar').issues.find((i) => i.id === 'is_2z')) && JSON.stringify(V.S).indexOf('decoratedBy') < 0);
  /* cause candidates, first due, due after change, advance boundaries */
  __.hook('causeCandidates', (k, iss, c) => [{ eqId: 'bl2', text: `Caused by BL-2 (picked for ${c.name})` }]);
  const sq = V.diagStep('manesar', 'is_2z'); V.answer('manesar', 'is_2z', sq.id, 'No'); __.hook('causeCandidates', null);
  check('seams', "'causeCandidates' decides who a root cause is Caused by (first of a list wins)", V.issue('manesar', 'is_2z').causedBy === 'bl2' && V.issue('manesar', 'is_2z').log.some((l) => l.text === 'Caused by BL-2 (picked for Intake filter blocked)'));
  V.decide('vedanta', 'v_sbr|alert|MLSS low', 'accept', {});
  const fdCalls = []; __.hook('firstDue', (k, sc, st, at) => { fdCalls.push(sc.id); return { due: at + DAY, why: 'test' }; });
  const gl2 = V.goLive('vedanta'); __.hook('firstDue', null);
  check('seams', "'firstDue' sets every scheduled Task's first due date at go-live", gl2.ok && fdCalls.length === V.tasks('vedanta').length && V.tasks('vedanta').every((t) => t.due === V.now() + DAY && __.PS('vedanta').tasks[t.id].firstDue === 'test'), `${fdCalls.length} calls, ${V.tasks('vedanta').length} Tasks`);
  const sch = V.tasks('manesar').find((t) => t.every && t.every.unit === 'month' && !t.meter); let dueArgs = null;
  __.hook('dueAfterChange', (k, scNew, scOld, st, at, opts) => { dueArgs = { k, n: scNew.every.n, old: scOld.every.n }; return { due: at + 2 * DAY, calDue: null }; });
  const sc1 = V.setCadence('manesar', sch.id, { n: sch.every.n + 1, unit: 'month' }, { reason: 'tuned', note: 'Seam check' }); __.hook('dueAfterChange', null);
  check('seams', "'dueAfterChange' sets a Task's next due date after its cadence changes", sc1.ok && dueArgs && dueArgs.n === sch.every.n + 1 && V.task('manesar', sch.id).due === V.now() + 2 * DAY, JSON.stringify(dueArgs));
  const t0 = V.now(); const atCalls = []; __.hook('advanceBoundaries', (from, to) => [from + 7 * DAY, to + 1, from - 1]); __.hook('advanceAt', (t, out) => { atCalls.push(t - t0); out.expired.push('x_' + atCalls.length); });
  const a7 = V.advance(7 * 1440); __.hook('advanceBoundaries', null); __.hook('advanceAt', null);
  check('seams', "'advanceBoundaries' splits a move (a boundary equal to its end counts) and 'advanceAt' runs at the start and at each boundary", JSON.stringify(atCalls) === JSON.stringify([0, 7 * DAY]) && a7.expired.length === 2 && /2 overrides expired/.test(a7.summary), `${JSON.stringify(atCalls)} · ${a7.summary}`);
  /* activity helpers, counters, dry runs */
  V.reset();
  const nA = V.S.activity.length; const e1 = __.addActivity({ at: T('2026-10-29T08:31'), plant: 'digitalpaani', who: null, text: 'Seam line', kind: 'structure', undo: 'u_1' });
  const e2 = __.addActivityAt(T('2026-10-29T08:32'), 'digitalpaani', 'Rohit Jain', 'Seam line two', 'people');
  const lst = V.activity({ plant: 'digitalpaani' });
  check('seams', 'addActivity takes an entry (extra fields kept and returned by activity()) or v7/1\'s arguments; addActivityAt names who', V.S.activity.length === nA + 2 && e1.who === 'Automatic' && e1.undo === 'u_1' && e2.who === 'Rohit Jain' && e2.kind === 'people' && lst.some((x) => x.text === 'Seam line' && x.undo === 'u_1' && x.kind === 'structure'));
  const nRep = __.replaceActivity('digitalpaani', (x) => /^SCADA read: /.test(x.text), { text: 'Plant graph read', kind: 'structure' });
  const nGone = __.replaceActivity('digitalpaani', (x) => /^Seam line/.test(x.text), null);
  const dpAct = V.activity({ plant: 'digitalpaani' });
  check('seams', 'replaceActivity rewrites a line in place (time, who and order kept) and removes lines; it says how many matched', nRep === 1 && nGone === 2 && dpAct.some((x) => x.text === 'Plant graph read' && x.kind === 'structure' && x.who === 'Automatic' && x.at === T('2026-10-29T08:30')) && !dpAct.some((x) => /^SCADA read|^Seam line/.test(x.text)), `${nRep}/${nGone}`);
  const seq0 = V.S.seq;
  check('seams', "counterId draws from a file's own counter, never v7/1's shared one", __.counterId('sseq', 'so') === 'so_1' && __.counterId('sseq', 'so') === 'so_2' && __.counterId('pseq', 'pp') === 'pp_1' && V.S.seq === seq0 && V.S.tseq === 112);
  V.reset(); V.S.extra = { n: 1 }; const beforeDry = JSON.stringify(V.S);
  const dr = __.dryRun('vedanta', () => { V.S.extra.n = 2; V.S.added = 1; V.S.tseq = 999; V.decide('vedanta', 'v_sbr|alert|MLSS low', 'accept', {}); __.addActivity(V.now(), 'vedanta', 'x', 'config'); return V.alertState('vedanta', 'a_3t'); });
  check('seams', 'dryRun puts every part of the state back, the other files\' state included', dr === 'active' && JSON.stringify(V.S) === beforeDry && V.alertState('vedanta', 'a_3t') === 'draft');
  delete V.S.extra;
  /* library key */
  V.reset();
  const serBefore = JSON.stringify(V.series('manesar', 'at2_do', V.now() - 3 * DAY, V.now()));
  /* a faithful clone, as the structure file makes them: same content under the unit-process type's name */
  const cloneAs = (from, name, id) => { const lib = C.S.lib.standardSets; const cl = JSON.parse(JSON.stringify(lib.find((t) => t.type === from))); cl.type = name; cl.upType = id; cl.contentFromName = from; lib.push(cl); return cl; };
  spy = true; let cloneMade = false;
  __.onSeed('before', () => { if (!spy) return; cloneAs('Diffuser Tank', 'Activated sludge', 'activated-sludge'); cloneAs('MBBR', 'Moving bed bioreactor', 'mbbr'); C.S.plants.manesar.d.equipment.find((e) => e.id === 'at2').libType = 'Activated sludge'; cloneMade = true; });
  V.reset(); spy = false;
  check('libKey', 'with a unit-process type on a node the seed still draws exactly as v7/1 (ids, ledger, Issues unchanged)', cloneMade && V.S.seq === JSON.parse(plain).seq && V.S.overrides.length === JSON.parse(plain).overrides.length && V.issue('manesar', 'is_2z') && V.issue('manesar', 'is_2z').title === 'DO low · AT-2');
  check('libKey', 'the sample readings do not move (the shipped library has no unit-process types; the node\'s own type is used)', JSON.stringify(V.series('manesar', 'at2_do', V.now() - 3 * DAY, V.now())) === serBefore);
  const asSet = C.S.lib.standardSets.find((t) => t.type === 'Activated sludge'); const asDo = asSet.alerts.find((x) => x.sensorKind === 'Dissolved oxygen' && x.direction === 'below'); asDo.limits = { ...asDo.limits, minor: 2.5 }; __.touch();
  const at2 = V.limitsOf('manesar', 'at2_do', 'below');
  check('libKey', "a node with a libType reads that type's standard set; its neighbour of the same database type does not", at2.perBand.minor.libValue === 2.5 && V.limitsOf('manesar', 'at1_do', 'below').perBand.minor.libValue === 2, JSON.stringify(at2.perBand.minor));
  check('libKey', "a unit-process type's Issue types are its content-from type's (Moving bed bioreactor = MBBR's 15)", V.issueTypes('Moving bed bioreactor').length === 15 && JSON.stringify(V.issueTypes('Moving bed bioreactor')) === JSON.stringify(V.issueTypes('MBBR')));
  V.reset();

  /* ── 11. words core7 writes itself ── */
  V.advance(1440);
  const texts = engineTexts(V); const bw = badWords(texts);
  check('words', `no don't-use words in ${texts.length} strings the engine and Issues write`, bw.length === 0, bw.slice(0, 5).join(' || '));
  emit({ results });
  process.exit(0);
}

/* ════════════════════════════════════ main: the whole v7/2 stack ═══════════════════════════════════════════════════════ */
const t0 = Date.now();
const L = require('./load72.js');
const V = L.V7; const C = L.CTL; const store = L.store; const __ = V.__;
const loadMs = Date.now() - t0;
check('load', 'v7/2 loads in prototype.html\'s order and boots', !!V && L.errors.length === 0, L.errors.map((e) => `${e.file}: ${e.error.slice(0, 160)}`).join(' | '));
const v71 = child(['--v71']);
check('load', "v7/1's core loads as the reference", !v71.error, v71.error);
const R = v71.plants || {};

/* ── the start ── */
check('start', 'clock reads Thu 29 Oct, 09:00; Vedanta and DigitalPaani Commissioning, Manesar and Bawal Live', V.fmt(V.now()) === 'Thu 29 Oct, 09:00' && V.plants().map((p) => `${p.key}:${p.state}`).join(',') === 'digitalpaani:commissioning,vedanta:commissioning,manesar:live,bawal:live');

/* ── Vedanta: trial records, no Issue ── */
const PV = __.PS('vedanta'); const recs = PV.trialLog || [];
check('Vedanta', 'no Issue at seed', V.issues('vedanta').length === 0, V.issues('vedanta').map((i) => i.id).join(','));
const per = {}; recs.forEach((r) => { per[r.alertId] = (per[r.alertId] || 0) + 1; });
check('Vedanta', '112 stored trial records: Level high · EQ-1 76, DO low · SBR-1 35, pH low · EQ-1 1, every other Trigger 0', recs.length === 112 && per.a_3d === 76 && per.a_3r === 35 && per.a_3f === 1 && Object.keys(per).length === 3, JSON.stringify(per));
const phR = recs.find((r) => r.alertId === 'a_3f');
check('Vedanta', 'the pH one is Emergency, Wed 28 Oct 15:10–16:10, peak 3.7, limit 4.0', phR && phR.band === 'emergency' && phR.firstBand === 'emergency' && V.fmt(phR.start) === 'Wed 28 Oct, 15:10' && V.fmt(phR.end) === 'Wed 28 Oct, 16:10' && phR.peak === 3.7 && phR.limit === 4, phR && JSON.stringify(phR));
check('Vedanta', 'every Level high record is Caution; every DO low record Minor', recs.filter((r) => r.alertId === 'a_3d').every((r) => r.band === 'caution') && recs.filter((r) => r.alertId === 'a_3r').every((r) => r.band === 'minor'));
const run3d = PV.trialOpen && PV.trialOpen.a_3d ? recs.find((r) => r.id === PV.trialOpen.a_3d) : null;
check('Vedanta', 'the last Level high firing started Thu 29 Oct 08:25 and is still running', run3d && V.fmt(run3d.start) === 'Thu 29 Oct, 08:25' && run3d.end == null && Object.keys(PV.trialOpen).length === 1, run3d && V.fmt(run3d.start));
check('Vedanta', "records carry their own ids (tf_1 … tf_112, the file's own counter) and the terms they fired under", recs.every((r, i) => r.id === `tf_${i + 1}` && r.terms && r.terms.bands && r.terms.dir) && V.S.tseq === 112);
const vTrial = Object.keys((R.vedanta || {}).states || {}).filter((id) => R.vedanta.states[id] === 'trial');
check('Vedanta', "every Trigger v7/1 has On trial is active with phase trial; MLSS low · SBR-1 is a draft", vTrial.length === 12 && vTrial.every((id) => V.alertState('vedanta', id) === 'active' && V.triggerPhase('vedanta', id) === 'trial') && V.alertState('vedanta', 'a_3t') === 'draft', `${vTrial.length}: ${vTrial.join(' ')}`);
const M6 = ['a_do_at2', 'a_mlss_hi', 'a_bl1_amps', 'a_bl1_trip', 'a_flood', 'a_blanket'];
check('Manesar', "the six Triggers are active and live", M6.every((id) => V.alertState('manesar', id) === 'active' && V.triggerPhase('manesar', id) === 'live'), M6.map((id) => `${id}:${V.alertState('manesar', id)}/${V.triggerPhase('manesar', id)}`).join(' '));
check('Bawal', "every Trigger v7/1 has On is active and live", ['a_u', 'a_x', 'a_1a', 'a_1e'].every((id) => R.bawal && R.bawal.states[id] === 'on' && V.alertState('bawal', id) === 'active' && V.triggerPhase('bawal', id) === 'live'));

/* ── ids keep v7/1's values, and the Issue v7/1 drew for Vedanta is burnt ── */
const raw = (k) => C.S.plants[k].d;
const sameIds = (k, field, list, nameOf) => { const mine = new Map(raw(k)[field].map((x) => [x.id, nameOf(x)])); const miss = list.filter(([id, nm]) => mine.get(id) !== nm); return miss; };
const idMiss = [];
KEYS.forEach((k) => { if (!R[k]) return; idMiss.push(...sameIds(k, 'alerts', R[k].alerts, (a) => a.name).map((x) => `${k} alert ${x[0]}`)); idMiss.push(...sameIds(k, 'equipment', R[k].eq, (e) => e.tag).map((x) => `${k} eq ${x[0]}`)); idMiss.push(...sameIds(k, 'sensors', R[k].sensors, (s) => s.name).map((x) => `${k} sensor ${x[0]}`)); idMiss.push(...sameIds(k, 'schedules', R[k].schedules, (s) => s.name).map((x) => `${k} schedule ${x[0]}`)); });
check('ids', "every alert, equipment, sensor and schedule id of v7/1's seed exists with the same name (DigitalPaani's survey ids included)", idMiss.length === 0 && KEYS.every((k) => R[k]), idMiss.slice(0, 8).join(', '));
const named = { vedanta: ['a_35', 'a_39', 'a_3d', 'a_3e', 'a_3f', 'a_3i', 'a_3k', 'a_3o', 'a_3r', 'a_3s', 'a_3t', 'a_3x', 'a_4p'], manesar: M6, bawal: ['a_u', 'a_x', 'a_1a', 'a_1e'] };
check('ids', 'the named Trigger ids exist: Vedanta 13, Manesar 6, Bawal 4', Object.entries(named).every(([k, ids]) => ids.every((id) => raw(k).alerts.some((a) => a.id === id))) && raw('vedanta').alerts.find((a) => a.id === 'a_3d').name === 'Level high — EQ-1' && raw('vedanta').alerts.find((a) => a.id === 'a_3r').name === 'DO low — SBR-1' && raw('vedanta').alerts.find((a) => a.id === 'a_3f').name === 'pH low — EQ-1' && raw('vedanta').alerts.find((a) => a.id === 'a_3t').name === 'MLSS low — SBR-1');
const issueIds = (k) => __.PS(k).issues.map((i) => i.id).sort().join(' ');
check('ids', "Manesar's and Bawal's Issue ids are v7/1's (is_2z open: DO low · AT-2); v7/1's Vedanta Issue is_5m does not exist", R.manesar && issueIds('manesar') === R.manesar.issues.map((x) => x[0]).sort().join(' ') && issueIds('bawal') === R.bawal.issues.map((x) => x[0]).sort().join(' ') && R.vedanta.issues.length === 1 && R.vedanta.issues[0][0] === 'is_5m' && !__.PS('vedanta').issues.length && V.issue('manesar', 'is_2z') && V.issue('manesar', 'is_2z').status !== 'closed' && /^DO low · AT-2$/.test(V.issue('manesar', 'is_2z').title), `${issueIds('manesar')}`);
check('ids', "the shared counter ends the seed where v7/1's does: the is_5m draw is burnt and no file draws from it", V.S.seq === v71.seq, `${V.S.seq} vs ${v71.seq}`);

/* ── no Issue in Commissioning when time moves ── */
const snapStart = JSON.stringify(V.S);
const nRec = recs.length; const vToldBefore = JSON.stringify(__.PS('vedanta').issues.map((i) => i.told));
const adv = V.advance(1440);
check('advance', 'advance(1440): no Vedanta Issue, no told entry for Vedanta; its trial log grows', !adv.opened.some((o) => o.plant === 'vedanta') && V.issues('vedanta').length === 0 && JSON.stringify(__.PS('vedanta').issues.map((i) => i.told)) === vToldBefore && __.PS('vedanta').trialLog.length > nRec && adv.trial.filter((t) => t.plant === 'vedanta').length === __.PS('vedanta').trialLog.length - nRec, adv.summary);
check('advance', 'the summary names the trial firings; no Live trial ends any more', new RegExp(`${adv.trial.length} trial firings`).test(adv.summary) && !('trialEnded' in adv), adv.summary);

/* ── Tasks on one subject ── */
check('tasks', 'taskGroups is empty for every plant', KEYS.every((k) => Array.isArray(V.taskGroups(k)) && V.taskGroups(k).length === 0));
V.reset();
const tpd = V.tasksPerDay('vedanta');
check('tasks', "tasksPerDay('vedanta') equals {each:true} and v7/1's \"each\" figure (59.0 ± 0.05)", tpd === V.tasksPerDay('vedanta', { each: true }) && Math.abs(tpd - v71.each) < 0.05 && Math.abs(tpd - 59) < 0.05, `${tpd} vs v7/1 ${v71.each}`);
check('tasks', 'no Task view carries toConfirm or shared', KEYS.every((k) => V.tasks(k).every((t) => !('toConfirm' in t) && !('shared' in t))));

/* ── who is told: the hooter flag ── */
const flood = raw('manesar').alerts.find((a) => a.id === 'a_flood');
const openEm = () => { const terms = __.termsFor('manesar', 'a_flood'); const f = { start: V.now(), end: null, band: 'emergency', firstBand: 'emergency', peak: 1, limit: terms.bands.emergency != null ? terms.bands.emergency : 1, steps: [] }; return __.openAlertIssue('manesar', flood, f, terms, V.now(), {}); };
const emOn = openEm();
check('told', 'a Manesar Emergency Issue tells by phone call and a full-screen warning in the app, and calls the hooter while it is on', emOn.told.some((t) => t.how === 'phone call') && emOn.told.some((t) => t.how === 'full-screen warning') && emOn.told.some((t) => t.how === 'hooter') && !emOn.told.some((t) => /alarm/.test(t.how)), emOn.told.map((t) => t.how).join(','));
V.reset();
const setR = typeof V.setRouting === 'function' ? V.setRouting('manesar', { hooter: false }) : ((__.PS('manesar').routing.hooter = false), { ok: true });
const emOff = openEm();
check('told', 'with the hooter switched off, an Emergency Issue opened afterwards has no hooter entry', setR && setR.ok !== false && __.PS('manesar').routing.hooter === false && emOff.told.length > 0 && !emOff.told.some((t) => t.how === 'hooter'), emOff.told.map((t) => t.how).join(','));
V.reset();

/* ── words core7 writes itself ── */
const texts = engineTexts(V); const bw = badWords(texts);
check('words', `no don't-use words in ${texts.length} strings the engine and Issues write`, bw.length === 0, bw.slice(0, 5).join(' || '));

/* ── determinism ── */
const seedJson = JSON.stringify(V.S);
check('determinism', 'Reset restores the seed exactly (byte-equal state after time moved)', seedJson === snapStart);
const fresh1 = child(['--fresh']); const fresh2 = child(['--fresh']);
check('determinism', 'two boots from empty storage, in two processes, give byte-equal state', !fresh1.error && fresh1.sha === fresh2.sha && fresh1.sha === sha(seedJson), fresh1.error || `${fresh1.sha} ${fresh2.sha} ${sha(seedJson)}`);
check('determinism', 'no random ids: every id comes from a counter', !/_pre[0-9a-z]+"/.test(seedJson) && V.S.seq > 0);

/* ── saving under the ctl72 keys ── */
V.advance(60); V.persist();
const keys = [...store.keys()].sort();
check('persist', 'v7/2 writes ctl72.estate.v1 and ctl72.overlay.v1, and no v7/1 key', keys.includes('ctl72.estate.v1') && keys.includes('ctl72.overlay.v1') && keys.every((k) => k.startsWith('ctl72.') || k === 'ctl7.decisions'), keys.join(','));
const ov = JSON.parse(store.get('ctl72.overlay.v1'));
check('persist', 'the saved story is v72-story-3 and the estate carries the same stamp', ov.story === 'v72-story-3' && JSON.parse(store.get('ctl72.estate.v1')).stamp === `v72-story-3:${ov.saves}`);
const tmp = path.join(os.tmpdir(), `core72-test-${process.pid}.json`); fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(store)));
const rel = child(['--reload'], { LOAD72_STORE: tmp }); try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
const here = { now: V.fmt(V.now()), seq: V.S.seq, tseq: V.S.tseq, trial: __.PS('vedanta').trialLog.length, open: V.issues('manesar', { status: 'open' }).map((i) => i.id), states: KEYS.map((k) => V.alerts(k).map((a) => `${a.id}:${a.state}`).join(',')).join('|'), overrides: V.S.overrides.length };
check('persist', 'a reload restores the story from the ctl72 keys (clock, counters, trial log, Issues, states, ledger)', !rel.error && rel.now === here.now && rel.now === 'Thu 29 Oct, 10:00' && rel.seq === here.seq && rel.tseq === here.tseq && rel.trial === here.trial && JSON.stringify(rel.open) === JSON.stringify(here.open) && rel.states === here.states && rel.overrides === here.overrides && rel.sha === sha(JSON.stringify(V.S)), rel.error || JSON.stringify({ ...rel, states: undefined }));
const ov2 = JSON.parse(store.get('ctl72.overlay.v1')); ov2.story = 'v72-story-0'; store.set('ctl72.overlay.v1', JSON.stringify(ov2)); V.boot();
check('persist', 'a saved story with another version reseeds both stores', V.fmt(V.now()) === 'Thu 29 Oct, 09:00' && JSON.parse(store.get('ctl72.overlay.v1')).story === 'v72-story-3' && JSON.parse(store.get('ctl72.estate.v1')).stamp === `v72-story-3:${JSON.parse(store.get('ctl72.overlay.v1')).saves}` && JSON.stringify(V.S).length === seedJson.length);
V.advance(60); V.persist();
const ov3 = JSON.parse(store.get('ctl72.overlay.v1')); ov3.saves += 1; store.set('ctl72.overlay.v1', JSON.stringify(ov3)); V.boot();
check('persist', 'a save whose estate stamp does not match reseeds both stores', V.fmt(V.now()) === 'Thu 29 Oct, 09:00' && JSON.stringify(V.S) === seedJson);
store.set('ctl72.overlay.v1', '{"v":0}'); V.boot();
check('persist', 'a broken save reseeds (the story start)', V.fmt(V.now()) === 'Thu 29 Oct, 09:00' && V.state('vedanta') === 'commissioning');

/* ── core7 alone ── */
const core = child(['--core'], { LOAD72_UPTO: 'core7.js' });
if (core.error) check('core7 alone', 'the core-only run finished', false, core.error);
else core.results.forEach((r) => { results.push({ ...r, group: `core · ${r.group}` }); if (!r.ok) fails++; });

/* ── report ── */
const groups = [...new Set(results.map((r) => r.group))];
console.log(`core7.test · ${results.length - fails}/${results.length} pass · load + boot ${loadMs} ms · total ${Date.now() - t0} ms · loaded ${L.loaded.length} files${L.missing.length ? ` (not written yet: ${L.missing.join(', ')})` : ''}`);
for (const g of groups) {
  const rs = results.filter((r) => r.group === g); const bad = rs.filter((r) => !r.ok);
  console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(24)} ${rs.length - bad.length}/${rs.length}`);
  rs.filter((r) => !r.ok || VERBOSE).forEach((r) => console.log(`       ${r.ok ? '·' : '✗'} ${r.name}${r.detail != null ? `  [${String(r.detail).slice(0, 260)}]` : ''}`));
}
console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
process.exit(fails ? 1 : 0);
