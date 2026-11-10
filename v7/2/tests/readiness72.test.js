#!/usr/bin/env node
/* v7/2 · tests/readiness72.test.js — headless test of core72-commission.js: Trigger status actions, the bindings pass, the one
   checklist (Readiness, the go-live confirmation, Coverage), trial firings as stored records, people and routing, last service
   dates and first due dates, go live, return to Commissioning, the cadence count-from choice and Coverage.
   Node only, no dependencies. Expected numbers are the story's; where one comes from the sample readings it is also checked
   against the function that counts it, so a change in the readings fails in one place.
   Runs in parts, each in its own process (one load per process):
     main      the v7/2 stack as it stands (tests/load72.js)
     --alone   core7.js and this file only (the structure, library and ledger files skipped): the fallbacks
     --v71     v7/1's own core, for the trial rates v7/2 must keep
     --fresh   a second boot from empty storage, for byte-equal state
   Checks that need a file that is not loaded are listed as skipped, never as passed.
   Usage: TZ=Asia/Calcutta node tests/readiness72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SELF = __filename;
const MODE = process.argv.find((a) => /^--(alone|v71|fresh)$/.test(a)) || 'main';
const VERBOSE = process.argv.includes('-v');
const DAY = 864e5, MIN = 6e4;
const T = (s) => Date.parse(s + ':00+05:30');
const KEYS = ['digitalpaani', 'vedanta', 'manesar', 'bawal'];
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail: detail == null ? undefined : String(detail).slice(0, 400) }); if (!ok) fails++; }
function skip(group, name, why) { results.push({ group, name, ok: true, skipped: why }); }
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb === undefined ? `threw: ${e.message}` : fb; } };
const emit = (o) => process.stdout.write('@@' + JSON.stringify(o) + '\n');
function child(args, env) {
  const r = spawnSync(process.execPath, [SELF, ...args], { encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { TZ: 'Asia/Calcutta' }, env || {}) });
  const line = String(r.stdout || '').split(/\r?\n/).filter((l) => l.startsWith('@@'))[0];
  if (!line) return { error: `${args.join(' ')} exited ${r.status}: ${String(r.stderr || r.stdout || '').slice(0, 600)}` };
  try { return JSON.parse(line.slice(2)); } catch (e) { return { error: 'bad output: ' + line.slice(0, 200) }; }
}

/* ════════════════════════════════════ --v71: v7/1's own core, as reference ═══════════════════════════════════════════ */
if (MODE === '--v71') {
  const g = global; g.window = g; g.V7_NO_V6_SHELL = true; g.addEventListener = () => {}; g.removeEventListener = () => {};
  const store = new Map(); g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
  const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {}, innerHTML: '' });
  g.document = { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el() }; g.location = { hash: '#/plants', href: 'http://localhost/prototype.html#/plants' }; g.scrollTo = () => {};
  const A71 = path.join(__dirname, '..', '..', '1', 'assets');
  for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'core7.js']) vm.runInThisContext(fs.readFileSync(path.join(A71, f), 'utf8'), { filename: f });
  const V = g.V7; V.boot();
  const rate = (id) => { const s = V.trialStats('vedanta', id); return s ? s.perDay : null; };
  emit({ a_3d: rate('a_3d'), a_3r: rate('a_3r') });
  process.exit(0);
}

/* ── words: Alex's don't-use list and the v7/1 words that must not survive, over the copy this file writes ──────────────── */
const BANNED = [/\bmachines?\b/i, /\bassets?\b/i, /\bwidgets?\b/i, /\bestates?\b/i, /\bportfolio\b/i, /\bcustom\b/i, /\bdetach(ed)?\b/i, /\bfork(ed|s)?\b/i,
  /\bdiverg(e|ed|es|ing|ence)\b/i, /\bstale\b/i, /\bdrift\b/i, /\balerts?\b/i, /\balerting\b/i, /(?<!false )\balarms?\b/i, /\binsights?\b/i, /\bschedules?\b/i,
  /\bSCADA\b/i, /\bdatabase\b/i, /\bthe form\b/i, /\bhold time\b/i, /\bdebounce\b/i, /\bprocedures?\b/i, /\bworkflows?\b/i, /\bSOPs?\b/i, /\bremediation\b/i,
  /\bSite Admin\b/i, /\bSME\b/i, /\bSupervisor\b/i, /\bonboarding\b/i, /\bshadow\b/i, /\btest alert\b/i, /\bdry run\b/i, /\bdetect\b/i, /\bpriority\b/i,
  /(?<!criticality )\btier\b/i, /\bCritical\b|\bEssential\b|\bStandard\b/, /(?<!limit |no )\brules?\b/i, /\bsurvey type\b/i,
  /Changed here/i, /Library changed since/i, /Differences from the library/i, /From the library/i, /No limits yet/i, /What SCADA found/i, /What the library brings/i,
  /Where it lands/i, /Not for this plant/i, /On trial/i, /Mostly short/i, /Tuned for this plant/i, /For now, until/i, /Reason not recorded/i, /Not in the library/i,
  /Back to the library value/, /Suggest for the library/i, /Who is told/i, /User Center/i, /Phone view/i, /Review due/i, /no call, no hooter/i, /told to the Leads/i,
  /(?<!Persistence · )must hold for/, /(?<!Clearing · )must clear for/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Invalid Date/, /\$\{/];
const badWords = (texts) => texts.filter((t) => typeof t === 'string' && BANNED.some((re) => re.test(t)));
function commissionTexts(V, seedSeq) {
  const out = []; const push = (x) => { if (typeof x === 'string') out.push(x); };
  KEYS.forEach((k) => {
    const cl = V.checklist(k); [...cl.blockers, ...cl.gaps].forEach((x) => { push(x.text); push(x.linkText); push(x.coverageText); push(x.short); });
    Object.values(cl.tracks).forEach((t) => { push(t.title); t.steps.forEach((s) => { push(s.label); push(s.text); if (s.action) push(s.action.label); }); });
    push(cl.buttonLabel); push(cl.foot); push(cl.readyText); push(cl.emptyText); push(cl.whyNot); if (cl.trial) push(cl.trial.text);
    const pv = V.goLivePreview(k); pv.lines.forEach((l) => { push(l.text); push(l.sub); }); push(pv.trial.text); push(pv.gapsText); push(pv.title);
    const bp = V.bindingsPass(k); push(bp.waitingText); push(bp.proposedText); bp.groups.forEach((g) => { push(g.head); g.items.forEach((r) => { push(r.line); push(r.readsText); push(r.statusLabel); push(r.name); r.values.forEach((v) => push(v.text)); }); });
    bp.needs.forEach((n) => push(n.text)); [bp.bulk.draftsLabel, bp.bulk.activateLabel, bp.bulk.note, bp.bulk.disabledTitle].forEach(push);
    const ro = V.routing(k); ro.ladder.forEach((l) => push(l.text)); push(ro.clocksText); push(ro.banner); push(ro.offConfirm); push(ro.sub);
    V.people(k).forEach((p) => { push(p.verifiedText); push(p.channelText); push(p.grantLabel); push(p.sampleConfirm); }); push(V.reachability(k).text);
    const sd = V.serviceDates(k); push(sd.counterText); push(sd.sub); push(sd.foot); push(sd.liveText); sd.rows.forEach((r) => push(r.preview.text));
    const cv = V.coverage(k); push(cv.window.label); push(cv.triggers.closedText); push(cv.triggers.draftsText); push(cv.blindSpots.text); cv.gaps.forEach((g) => push(g.text)); push(cv.returnCard.text);
    if (V.state(k) === 'live') V.returnPreview(k).lines.forEach((l) => push(l.text));
    V.trialTable(k).forEach((x) => { push(x.name); push(x.chip); });
    V.alerts(k).forEach((a) => { const ts = V.trialStats(k, a.id); if (ts) { push(ts.text); push(ts.title); push(ts.banner); ts.rows.forEach((r) => { push(r.startText); push(r.endText); push(r.lengthText); push(r.chip); push(r.peakText); }); } });
  });
  /* the lines this file writes: every line after the seed, and its two seed lines at Vedanta */
  V.activity({}).filter((a) => a.seq > seedSeq || /^(Bindings pass|Last service dates)/.test(a.text)).forEach((a) => push(a.text));
  return out;
}

/* ════════════════════════════════════ the checks (main and --alone run the same body) ═════════════════════════════════ */
const L = require('./load72.js'); const V = L.V7; const __ = V.__;
const has = (n) => typeof V[n] === 'function';
const HAS = { structure: has('identify') && has('structureDone'), library: has('zoneInfo') && has('bindingProposals'), ledger: has('setOverride') && has('deviationCounts'), commission: !!V.__commission };
const needs = (group, name, list, fn) => { const miss = list.filter((x) => !HAS[x]); if (miss.length) { skip(group, name, `needs the ${miss.join(' and ')} file`); return; } try { fn(); } catch (e) { check(group, name, false, `threw: ${e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e}`); } };
const P = (k) => __.PS(k);
const nodeId = (k, tag) => (__.dOf(k).equipment.find((e) => e.tag === tag) || {}).id;
const nodeIds = (k, ...tags) => tags.map((t) => nodeId(k, t));
const latestAct = (k) => (V.activity({ plant: k, limit: 1 })[0] || {}).text || '';
const BLOCKER_IDS = ['operator', 'lead', 'untyped', 'unclassified', 'drafts']; const GAP_IDS = ['nolimits', 'noisy', 'nopm', 'nodiag'];
const idsOk = () => KEYS.every((k) => { const cl = V.checklist(k); return cl.blockers.every((b) => BLOCKER_IDS.includes(b.id)) && cl.gaps.every((g) => GAP_IDS.includes(g.id)); });
const beats = []; const beat = (label) => beats.push({ label, ok: idsOk() });
/* DigitalPaani's structure pass, finished as chapter 2 finishes it */
function finishDpStructure() {
  const k = 'digitalpaani'; const up = (t) => [nodeId(k, t)];
  V.acceptStructure(k, { all: true });
  V.notPart(k, nodeIds(k, 'ITP-1', 'ITP-2', 'FWTP-1', 'FWTP-2'), {});
  V.place(k, nodeIds(k, 'UFFP-1', 'UFFP-2', 'UFBV-1'), up('UF-1'), {}); V.place(k, nodeIds(k, 'UFFP-3', 'UFFP-4', 'UFBV-2'), up('UF-2'), {});
  V.place(k, nodeIds(k, 'RFP-1', 'RFP-2'), nodeIds(k, 'MBBR-1', 'MBBR-4'), {}); V.place(k, nodeIds(k, 'FFP-1', 'FFP-2'), up('MGF'), {});
  V.place(k, nodeIds(k, 'SPFP-1', 'SPFP-2'), up('SLP'), {}); return V.notPart(k, nodeIds(k, 'PDT', 'PDP', 'SCP-1', 'SCP-2'), {});
}

check('load', 'v7/2 loads with the commissioning file and boots', !!V && L.errors.length === 0 && L.loaded.includes('core72-commission.js'), L.errors.map((e) => `${e.file}: ${e.error.slice(0, 200)}`).join(' | ') || L.loaded.join(','));
check('load', 'the commissioning API is on window.V7', ['setAlertState', 'activate', 'leaveInactive', 'activatePreview', 'trialFirings', 'trialStats', 'trialTable', 'isNoisy', 'bindingsPass', 'decide', 'acceptAllFor', 'undoDecision', 'allBoundPreview', 'checklist', 'goLivePreview', 'goLive', 'goLiveTasks', 'firstDueAt', 'returnPreview', 'returnToCommissioning', 'cadenceDueNow', 'dueAfter', 'people', 'reachability', 'addPerson', 'updatePerson', 'removePreview', 'removePerson', 'sendCode', 'confirmCode', 'routing', 'setRouting', 'serviceDates', 'setServiceDate', 'coverage'].every(has));
check('load', 'the firstDue and dueAfterChange hooks are this file\'s', __.HOOKS.firstDue === V.firstDueAt && __.HOOKS.dueAfterChange === V.dueAfter);

/* ── the seed: people, routing, service dates, go-lives, Activity ─────────────────────────────────────────────────────── */
{
  const vp = V.people('vedanta'); const by = (n) => vp.find((p) => p.name === n) || {};
  check('seed', 'Vedanta roster: Mohan Das Operator +91 90000 10001 SMS verified; Priya Nair Lead +91 90000 10002 not verified, no code; Arjun Mehta Lead +91 90000 10003 WhatsApp verified',
    by('Mohan Das').number === '+91 90000 10001' && by('Mohan Das').channelText === 'SMS' && by('Mohan Das').reachable && by('Priya Nair').number === '+91 90000 10002' && !by('Priya Nair').reachable && by('Priya Nair').phone.codeSentAt === null && by('Priya Nair').verifiedText === 'Not verified' && by('Arjun Mehta').number === '+91 90000 10003' && by('Arjun Mehta').channelText === 'WhatsApp' && by('Arjun Mehta').reachable && V.fmt(by('Arjun Mehta').phone.verifiedAt) === 'Fri 23 Oct, 10:05', JSON.stringify(vp.map((p) => [p.name, p.number, p.verifiedText])));
  const mp = V.people('manesar');
  check('seed', 'Manesar: Dheeraj Kumar … Sunny Verma on +91 90000 20001 … 20006, all verified; Amit Rao a Client viewer with no number; grants People Admin and Technical Admin',
    mp.filter((p) => p.role !== 'regular').every((p, i) => p.number === `+91 90000 ${20001 + i}` && p.reachable) && mp.find((p) => p.name === 'Amit Rao').number === null && mp.find((p) => p.id === 'p4').grantLabel === 'People Admin · Manesar STP' && mp.find((p) => p.id === 'p5').grantLabel === 'Technical Admin · Manesar STP', JSON.stringify(mp.map((p) => [p.id, p.number, p.grantLabel])));
  const bp = V.people('bawal');
  check('seed', 'Bawal: Asha Verma, Imran Shaikh (Operators), Rohit Jain (Lead, Technical Admin), +91 90000 30001 … 30003, all verified', bp.length === 3 && bp.every((p, i) => p.number === `+91 90000 ${30001 + i}` && p.reachable) && bp[2].grantLabel === 'Technical Admin · Bawal WTP' && bp.filter((p) => p.role === 'l1').length === 2);
  check('seed', 'DigitalPaani has nobody on its roster; every plant\'s hooter is on', V.people('digitalpaani').length === 0 && KEYS.every((k) => P(k).routing.hooter === true && V.routing(k).hooter));
  check('seed', 'go-lives: Manesar and Bawal at their since dates; the Commissioning plants none', P('manesar').goLives.length === 1 && P('manesar').goLives[0].at === T('2026-09-01T09:00') && P('bawal').goLives[0].at === T('2026-07-15T09:00') && P('vedanta').goLives.length === 0 && P('digitalpaani').goLives.length === 0);
  const va = V.activity({ plant: 'vedanta' }).map((a) => `${V.fmt(a.at)} · ${a.who} · ${a.text}`);
  check('seed', 'Vedanta Activity 10:55: "Bindings pass: accepted 85 and started the trial (12 raise Issues, 73 create Tasks). MLSS low · SBR-1 left undecided while the biology settles. Commissioning: nothing is sent."',
    va.includes('Fri 23 Oct, 10:55 · Satyadev Singh · Bindings pass: accepted 85 and started the trial (12 raise Issues, 73 create Tasks). MLSS low · SBR-1 left undecided while the biology settles. Commissioning: nothing is sent.') && !va.some((t) => /What the library brings|Alerts go On trial/.test(t)), va.join(' || '));
  check('seed', 'Vedanta Activity 11:40: "Last service dates entered for BL-1, BL-2 (Mon 19 Oct) and P-1, P-2 (Tue 20 Oct)"; no "Issue opened" line', va.includes('Fri 23 Oct, 11:40 · Satyadev Singh · Last service dates entered for BL-1, BL-2 (Mon 19 Oct) and P-1, P-2 (Tue 20 Oct)') && !va.some((t) => /Issue opened/.test(t)));
}

/* ── V72-31, V72-25 · the bindings pass ───────────────────────────────────────────────────────────────────────────────── */
{
  const c = V.bindingsPass('vedanta').counts; const sum = c.undecided + c.drafts + c.active + c.inactive + c.rejected + c.cantResolve + c.needs;
  check('bindings', 'V72-31 · Vedanta at seed: all 96, undecided 1, needs 10, active 85; undecided + drafts + active + inactive + rejected + can\'t resolve + needs = all', c.all === 96 && c.undecided === 1 && c.needs === 10 && c.active === 85 && sum === c.all, JSON.stringify(c));
  check('bindings', 'every plant\'s categories add up to All (Needs included)', KEYS.every((k) => { const x = V.bindingsPass(k).counts; return x.undecided + x.drafts + x.active + x.inactive + x.rejected + x.cantResolve + x.needs === x.all; }));
  const und = V.bindingsPass('vedanta', { show: 'undecided' }); const row = und.rows[0] || {};
  check('bindings', 'the one undecided row: "MLSS low · Issue → SBR-1", "reads MLSS-SBR-1", Minor < 2,000 mg/L, persistence from the library, Undecided, Accept · Change · Reject',
    und.rows.length === 1 && row.pid === 'v_sbr|alert|MLSS low' && row.line === 'MLSS low · Issue → SBR-1' && row.readsText === 'reads MLSS-SBR-1' && row.values.some((v) => /^Minor < 2,000 mg\/L$/.test(v.text)) && row.values.some((v) => /^Persistence \d+ min$/.test(v.text)) && row.statusLabel === 'Undecided' && row.actions.join(',') === 'accept,change,reject', JSON.stringify(row).slice(0, 300));
  check('bindings', 'the bulk bar counts undecided resolvable rows: "Accept 1 as drafts" · "Accept 1 and start trial"', und.bulk.count === 1 && und.bulk.draftsLabel === 'Accept 1 as drafts' && und.bulk.activateLabel === 'Accept 1 and start trial');
  check('bindings', 'Needs equipment or sensors: one line per piece of equipment and reading, never a row to decide', V.bindingsPass('vedanta').needs.length > 0 && V.bindingsPass('vedanta').needs.every((n) => /has no .+ sensor: unlocks \d+ templates? \(.+\) · Add sensor in the survey$|: .+ reads a connection: not in this phase$/.test(n.text)) && !V.bindingsPass('vedanta').groups.some((g) => g.items.some((r) => r.status === 'needs')));
  needs('bindings', 'V72-25 · DigitalPaani\'s pass waits for the structure pass; open, its groups follow the structure in flow order, "Outside any unit process" last', ['structure'], () => {
    const w = V.bindingsPass('digitalpaani'); const cl = V.checklist('digitalpaani');
    check('bindings', 'V72-25 · before the structure pass is confirmed: not open, the waiting sentence, no rows; the Bindings track waits', !w.open && w.waitingText === 'The bindings pass opens when the structure pass is confirmed. The library then proposes Triggers for each unit process and piece of equipment.' && w.rows.length === 0 && cl.tracks.bindings.steps[0].text === 'Waiting for structure pass →' && cl.tracks.bindings.steps.every((s) => s.mark === 'waiting'));
    V.reset(); const last = finishDpStructure(); const bp = V.bindingsPass('digitalpaani'); const gs = V.bindingGroups('digitalpaani');
    const order = bp.groups.map((g) => g.label); const want = gs.map((g) => g.title).filter((t) => order.includes(t));
    const ordered = order.filter((t) => t !== 'The plant');
    check('bindings', 'V72-25 · once the structure pass is confirmed the pass is open; groups in the structure\'s flow order, "The plant" then "Outside any unit process" last', last.ok && V.structureDone('digitalpaani') && bp.open && JSON.stringify(ordered) === JSON.stringify(want) && order[order.length - 1] === 'Outside any unit process' && order[order.length - 2] === 'The plant', `${order.slice(0, 3).join(' | ')} … ${order.slice(-3).join(' | ')}`);
    if (HAS.library) { const kc = new Set((V.bindingProposals('digitalpaani') || []).map((r) => r.pid)); check('bindings', 'V72-25 · rows come from the library file\'s binding proposals', bp.rows.filter((r) => r.status !== 'needs').every((r) => kc.has(r.pid))); }
    else skip('bindings', 'V72-25 · rows come from the library file\'s binding proposals', 'needs the library file');
    beat('DigitalPaani structure confirmed');
  });
}

/* ── V72-34, V72-33 · DigitalPaani at seed ────────────────────────────────────────────────────────────────────────────── */
V.reset();
needs('checklist', 'V72-34 · DigitalPaani at seed', ['structure'], () => {
  const cl = V.checklist('digitalpaani'); const ids = cl.blockers.map((b) => b.id); const un = cl.blockers.find((b) => b.id === 'unclassified'); const np = cl.gaps.find((g) => g.id === 'nopm');
  check('checklist', 'V72-34 · DigitalPaani at seed: blockers operator, lead, unclassified (20), no drafts; gap nopm 66; no nolimits; can\'t go live; "Go live · 3 blockers left"',
    ids.join(',') === 'operator,lead,unclassified' && un.count === 20 && un.text === '20 pieces of equipment are unclassified: RFP-1, RFP-2, FFP-1 and 17 more' && un.link === '#/p/digitalpaani/review/structure?show=unclassified' && np && np.count === 66 && !cl.gaps.some((g) => g.id === 'nolimits') && !cl.canGoLive && cl.buttonLabel === 'Go live · 3 blockers left' && cl.foot === 'Go live needs Full Admin', `${ids} · ${cl.buttonLabel} · ${cl.gaps.map((g) => `${g.id}:${g.count}`)}`);
  check('checklist', 'the blocker and gap sentences: "No Operator with a verified phone: nobody would be notified", "No Lead …", "66 pieces of equipment without a maintenance programme: a planning gap, not a safety failure"',
    cl.blockers[0].text === 'No Operator with a verified phone: nobody would be notified' && cl.blockers[1].text === 'No Lead with a verified phone: nobody would be notified' && np.text === '66 pieces of equipment without a maintenance programme: a planning gap, not a safety failure');
  const st = cl.tracks.structure.steps; const pe = cl.tracks.people.steps;
  check('checklist', 'three tracks Structure · Bindings · People; Structure "Plant graph built · 66 pieces of equipment · 38 sensors", "76 to review · 20 unclassified"; Design parameters waits; People "No people yet"',
    Object.values(cl.tracks).map((t) => t.title).join(',') === 'Structure,Bindings,People' && st.some((s) => s.label === 'Plant graph built' && s.text === '66 pieces of equipment · 38 sensors') && st.some((s) => s.label === 'Structure pass' && s.text === '76 to review · 20 unclassified' && s.mark === 'current') && st.some((s) => s.id === 'params' && s.mark === 'waiting' && s.text === 'Waiting for bindings') && pe[0].text === 'No people yet' && pe[0].mark === 'attention' && pe[1].text === 'No Operator or Lead with a verified phone' && pe[2].text === 'Optional · sets first PM due dates', st.map((s) => `${s.label}: ${s.text}`).join(' | '));
  check('checklist', 'every step is marked done, current, waiting or attention', KEYS.every((k) => Object.values(V.checklist(k).tracks).every((t) => t.steps.every((s) => ['done', 'current', 'waiting', 'attention'].includes(s.mark)))));
});
{
  const vc = V.checklist('vedanta');
  check('checklist', 'Vedanta at seed: one blocker "1 draft is undecided: MLSS low · SBR-1" (Decide → the undecided rows); "Go live · 1 blocker left"', vc.blockers.length === 1 && vc.blockers[0].id === 'drafts' && vc.blockers[0].text === '1 draft is undecided: MLSS low · SBR-1' && vc.blockers[0].link === '#/p/vedanta/review/bindings?show=undecided' && vc.buttonLabel === 'Go live · 1 blocker left' && !vc.canGoLive, vc.blockers.map((b) => b.text).join(' | '));
  const g = (id) => vc.gaps.find((x) => x.id === id);
  check('checklist', 'Vedanta gaps: noisy "1 Trigger is noisy in trial: Level high · EQ-1 (12.8 a day)", nodiag "1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1", nolimits (one reading), no nopm',
    g('noisy') && g('noisy').text === '1 Trigger is noisy in trial: Level high · EQ-1 (12.8 a day)' && g('nodiag') && g('nodiag').text === '1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1' && g('nolimits') && g('nolimits').count === (has('limitGaps') ? V.limitGaps('vedanta').length : 1) && g('nolimits').count === 1 && !g('nopm'), vc.gaps.map((x) => x.text).join(' | '));
  check('checklist', 'Vedanta trial banner "Day 6 of trial · 12 Triggers active · 112 trial firings so far · 1 Trigger noisy" (Review them → Triggers sorted by trial firings)', vc.trial && vc.trial.text === 'Day 6 of trial · 12 Triggers active · 112 trial firings so far · 1 Trigger noisy' && vc.trial.firings === P('vedanta').trialLog.length && vc.trial.link === '#/p/vedanta/triggers?sort=trial' && vc.trial.linkText === 'Review them', vc.trial && vc.trial.text);
  const bs = vc.tracks.bindings.steps; const ps = vc.tracks.people.steps;
  check('checklist', 'Vedanta tracks: "96 proposed Fri 23 Oct", "1 draft undecided" (current), "Day 6 · 1 Trigger fires more than 10 times a day" (Tune); People "3 people · 1 Operator · 2 Leads", "1 Operator and 1 Lead with verified phones", "Entered for 4 of 11 pieces of equipment"',
    bs[0].text === '96 proposed Fri 23 Oct' && bs[2].text === '1 draft undecided' && bs[2].mark === 'current' && bs[3].text === 'Day 6 · 1 Trigger fires more than 10 times a day' && bs[3].action.label === 'Tune' && ps[0].text === '3 people · 1 Operator · 2 Leads' && ps[1].text === '1 Operator and 1 Lead with verified phones' && ps[2].text === 'Entered for 4 of 11 pieces of equipment', [...bs, ...ps].map((s) => s.text).join(' | '));
  check('checklist', 'V72-33 · at seed every blocker and gap id is one of Alex\'s', idsOk());
  check('checklist', 'Live plants have no blockers and can\'t go live; their chip and button say so', ['manesar', 'bawal'].every((k) => { const c = V.checklist(k); return c.blockers.length === 0 && !c.canGoLive && c.blockersChip === null; }));
}

/* ── V72-43, V72-55 · trial firings ───────────────────────────────────────────────────────────────────────────────────── */
{
  const a = V.trialStats('vedanta', 'a_3d'); const d = V.trialStats('vedanta', 'a_3r');
  check('trial', 'V72-43 · Level high · EQ-1: 76 firings (= the stored records), 12.8 a day, noisy, median 45 min, peak 88%', a.count === 76 && a.count === V.trialFirings('vedanta', 'a_3d').length && a.perDay.toFixed(1) === '12.8' && a.noisy && a.medianMin === 45 && a.peak === 88 && a.text === 'Fired 76 times in 5.9 days · median 45 min · peak 88%' && a.noisyChip === 'Noisy · more than 10 a day', a.text);
  check('trial', 'V72-43 · DO low · SBR-1: 35 firings, 5.9 a day, not noisy, median 30 min, peak 1.58 mg/L; neither carries "mostlyShort"', d.count === 35 && d.perDay.toFixed(1) === '5.9' && !d.noisy && d.medianMin === 30 && d.peak === 1.58 && d.text === 'Fired 35 times in 5.9 days · median 30 min · peak 1.58 mg/L' && !('mostlyShort' in a) && !('mostlyShort' in d) && d.noisyChip === null, d.text);
  if (MODE === 'main') { const ref = child(['--v71']); check('trial', 'V72-43 · the rates equal v7/1\'s', !ref.error && Math.abs(ref.a_3d - a.perDay) < 1e-9 && Math.abs(ref.a_3r - d.perDay) < 1e-9, ref.error || `${ref.a_3d} / ${ref.a_3r}`); }
  const f = V.trialFirings('vedanta', 'a_3f');
  check('trial', 'V72-55 · pH low · EQ-1 has exactly one record: Wed 28 Oct 15:10–16:10, Emergency, peak 3.7, limit 4', f.length === 1 && f[0].start === T('2026-10-28T15:10') && f[0].end === T('2026-10-28T16:10') && f[0].band === 'emergency' && f[0].peak === 3.7 && f[0].limit === 4, JSON.stringify(f[0]));
  const s3f = V.trialStats('vedanta', 'a_3f'); const r = s3f.rows[0];
  check('trial', 'its trial card: "Fired once in 5.9 days · median 60 min · peak pH 3.7"; the row Wed 28 Oct, 15:10 · 16:10 · Emergency · pH 3.7 · 60 min with "Emergency · nobody was told"', s3f.text === 'Fired once in 5.9 days · median 60 min · peak pH 3.7' && r.startText === 'Wed 28 Oct, 15:10' && r.endText === 'Wed 28 Oct, 16:10' && r.bandLabel === 'Emergency' && r.peakText === 'pH 3.7' && r.lengthText === '60 min' && r.chip === 'Emergency · nobody was told' && s3f.banner === 'Commissioning: nothing is sent. Firings below are trials only.', `${s3f.text} · ${JSON.stringify(r)}`);
  const run = V.trialStats('vedanta', 'a_3d').rows.slice(-1)[0];
  check('trial', 'the last Level high row still runs: "still past the limit"', run.running && run.endText === 'still past the limit' && run.startText === 'Thu 29 Oct, 08:25');
  const tt = V.trialTable('vedanta');
  check('trial', 'the Triggers sorted by trial firings a day: Level high · EQ-1 12.8 (Noisy · more than 10 a day), DO low · SBR-1 5.9, pH low · EQ-1 0.2, every other 0.0', tt[0].name === 'Level high · EQ-1' && tt[0].perDayText === '12.8' && tt[0].chip === 'Noisy · more than 10 a day' && tt[1].name === 'DO low · SBR-1' && tt[1].perDayText === '5.9' && !tt[1].chip && tt[2].name === 'pH low · EQ-1' && tt[2].perDayText === '0.2' && tt.slice(3).every((x) => x.perDayText === '0.0'), tt.slice(0, 4).map((x) => `${x.name} ${x.perDayText}`).join(', '));
  check('trial', 'a Live plant has no trial window: trialStats is null at Manesar', V.alerts('manesar').every((x) => V.trialStats('manesar', x.id) === null));
  check('trial', 'isNoisy: Level high · EQ-1 is noisy in trial, DO low · SBR-1 is not; nothing at Manesar is', V.isNoisy('vedanta', 'a_3d') && !V.isNoisy('vedanta', 'a_3r') && V.alerts('manesar').every((x) => !V.isNoisy('manesar', x.id)));
}

/* ── V72-59, V72-44 · stored records outlive tuning ──────────────────────────────────────────────────────────────────── */
needs('trial', 'V72-59 · lowering pH low · EQ-1\'s Emergency limit leaves its trial firing in place', ['ledger'], () => {
  V.reset(); const before = JSON.stringify(V.trialFirings('vedanta', 'a_3f'));
  const r = V.setZone('vedanta', 'v_eq1_PH', 'below', 'emergency', 3.5, { reason: 'tuning', note: 'Checking the trial firing stays' });
  check('trial', 'V72-59 · Emergency below pH 3.5 saved; trialFirings(a_3f) unchanged (one record, Emergency, Wed 28 Oct 15:10)', r.ok && JSON.stringify(V.trialFirings('vedanta', 'a_3f')) === before && V.trialStats('vedanta', 'a_3f').count === 1, r.error);
});
needs('trial', 'V72-44 · the noisy mark stays after tuning and clears as the average falls', ['ledger'], () => {
  V.reset(); const r = V.setZone('vedanta', 'v_eq1_LVL', 'above', 'caution', 87, { reason: 'tuning', note: 'Level swings with the batch pumps; 85% is reached on every fill' });
  const gap = () => V.checklist('vedanta').gaps.find((g) => g.id === 'noisy');
  check('trial', 'V72-44 · after Caution 85 → 87 with a reason: still 76 trial firings and the noisy gap stays', r.ok && V.trialStats('vedanta', 'a_3d').count === 76 && !!gap(), r.error);
  V.advance(1440); const s1 = V.trialStats('vedanta', 'a_3d');
  check('trial', '+1 day (Fri 30 Oct, 09:00): no new firing, still noisy at 11.0 a day', s1.count === 76 && s1.perDay.toFixed(1) === '11.0' && !!gap(), `${s1.count} · ${s1.perDay}`);
  V.advance(T('2026-10-31T01:30') - V.now() > 0 ? Math.round((T('2026-10-31T01:30') - V.now()) / MIN) : 0); const s2 = V.trialStats('vedanta', 'a_3d');
  check('trial', 'V72-44 · at Sat 31 Oct 01:30 with no new firings the noisy gap is gone', V.fmt(V.now()) === 'Sat 31 Oct, 01:30' && s2.count === 76 && !s2.noisy && !gap(), `${V.fmt(V.now())} · ${s2.perDay}`);
  beat('Vedanta tuned and +1.7 days');
});

/* ── V72-29, V72-30 · deciding bindings ───────────────────────────────────────────────────────────────────────────────── */
V.reset();
{
  const r0 = V.leaveInactive('vedanta', 'a_3t', { reason: '' });
  check('status', 'V72-30 · Leave inactive without a reason: "Say why it stays inactive."', !r0.ok && r0.error === 'Say why it stays inactive.');
  const r1 = V.leaveInactive('vedanta', 'a_3t', { reason: 'No MLSS probe fitted until December' });
  const c = V.bindingsPass('vedanta').counts; const cl = V.checklist('vedanta');
  check('status', 'V72-30 · with a reason MLSS low · SBR-1 is inactive, no longer in the drafts blocker, and counted "left inactive on purpose"', r1.ok && V.alertState('vedanta', 'a_3t') === 'inactive' && P('vedanta').alerts.a_3t.reason === 'No MLSS probe fitted until December' && !cl.blockers.length && cl.canGoLive && c.inactive === 1 && cl.tracks.bindings.steps[2].text === '86 accepted · 85 active · 1 left inactive on purpose' && latestAct('vedanta') === 'Left MLSS low · SBR-1 inactive: No MLSS probe fitted until December', `${cl.tracks.bindings.steps[2].text} · ${latestAct('vedanta')}`);
  check('status', 'an inactive Trigger comes back with Activate; Draft is never a way back', V.setAlertState('vedanta', 'a_3t', 'draft').ok === false && V.activate('vedanta', 'a_3t').ok && V.triggerPhase('vedanta', 'a_3t') === 'trial');
  V.reset();
  const rj = V.decide('vedanta', 'v_sbr|alert|MLSS low', 'reject', {});
  check('status', 'Reject needs a reason: "Say why it doesn\'t fit this plant."', !rj.ok && rj.error === 'Say why it doesn\'t fit this plant.');
  const rj2 = V.decide('vedanta', 'v_sbr|alert|MLSS low', 'reject', { reason: 'MLSS is still building up' });
  check('status', 'rejected: inactive, decided "rejected", counted Rejected, no longer blocking', rj2.ok && V.alertState('vedanta', 'a_3t') === 'inactive' && P('vedanta').alerts.a_3t.decided === 'rejected' && V.bindingsPass('vedanta').counts.rejected === 1 && V.checklist('vedanta').canGoLive);
  V.reset();
  const ac = V.decide('vedanta', 'v_sbr|alert|MLSS low', 'accept', { activate: false });
  check('status', 'Accept as a draft: Draft · never fires, still blocking go-live (an accepted draft is undecided for Alex\'s list)', ac.ok && V.alertState('vedanta', 'a_3t') === 'draft' && P('vedanta').alerts.a_3t.decided === 'accepted' && V.bindingsPass('vedanta').counts.drafts === 1 && V.checklist('vedanta').blockers[0].id === 'drafts' && V.bindingsPass('vedanta', { show: 'draft' }).rows[0].actions.join(',') === 'activate,leaveInactive');
  const av = V.activate('vedanta', 'v_sbr|alert|MLSS low');
  check('status', 'Activate: "MLSS low · SBR-1 is active: it records trial firings. Nothing is sent until go-live."; phase trial', av.ok && av.phase === 'trial' && av.toast === 'MLSS low · SBR-1 is active: it records trial firings. Nothing is sent until go-live.', av.toast);
  V.reset();
  const ab = V.acceptAllFor('vedanta', { status: 'undecided' }, { activate: true });
  const c7 = V.checklist('vedanta');
  check('status', 'Chapter 7 · "Accept 1 and start trial": the toast, Active · trial, 0 blockers, "13 Triggers active", "86 accepted · 86 active · 0 left inactive on purpose"',
    ab.ok && ab.count === 1 && ab.toast === 'Accepted 1 and started the trial: 1 Trigger now records trial firings. Commissioning · nothing is sent.' && V.triggerPhase('vedanta', 'a_3t') === 'trial' && V.bindingsPass('vedanta').rows.find((r) => r.alertId === 'a_3t').statusLabel === 'Active · trial' && c7.blockers.length === 0 && c7.canGoLive && c7.buttonLabel === 'Go live' && c7.trial.text === 'Day 6 of trial · 13 Triggers active · 112 trial firings so far · 1 Trigger noisy' && c7.tracks.bindings.steps[2].text === '86 accepted · 86 active · 0 left inactive on purpose', `${ab.toast} · ${c7.trial.text}`);
  const ud = V.undoDecision('vedanta', ab.batchId);
  check('status', 'Undo puts the decision back while nothing else moved: MLSS low · SBR-1 is an undecided draft again and blocks', ud.ok && V.alertState('vedanta', 'a_3t') === 'draft' && P('vedanta').alerts.a_3t.decided === null && V.checklist('vedanta').blockers[0].id === 'drafts', ud.error);
  beat('Vedanta decisions');
}
needs('bindings', 'V72-29 · accept as drafts, accept and start trial, can\'t-resolve rows and Needs rows', ['structure'], () => {
  V.reset(); finishDpStructure(); const k = 'digitalpaani';
  const c0 = V.bindingsPass(k).counts; const d0 = V.checklist(k).blockers.find((b) => b.id === 'drafts');
  const r = V.acceptAllFor(k, { status: 'undecided' }, { activate: false }); const c1 = V.bindingsPass(k).counts; const d1 = V.checklist(k).blockers.find((b) => b.id === 'drafts');
  check('bindings', 'V72-29 · accept as drafts: every accepted row is a draft, nothing active, the drafts blocker unchanged; can\'t-resolve rows skipped and counted; Needs never count',
    r.ok && r.count === c0.undecided && r.skipped === c0.cantResolve && c1.drafts === c0.undecided && c1.active === 0 && c1.undecided === 0 && d0 && d1 && d1.count === d0.count && d0.count === c0.undecided + c0.cantResolve && c1.needs === c0.needs && Object.values(P(k).alerts).every((x) => x.state !== 'active'), `${JSON.stringify(c0)} → ${JSON.stringify(c1)} · ${d0 && d0.count}/${d1 && d1.count}`);
  check('bindings', 'the Activity line: "Bindings pass: accepted {n} as drafts (… raise Issues, … create Tasks). Drafts never fire."', /^Bindings pass: accepted \d+ as drafts \(\d+ raises? Issues, \d+ creates? Tasks\)\. Drafts never fire\.$/.test(latestAct(k)), latestAct(k));
  V.reset(); finishDpStructure(); const ca = V.bindingsPass(k).counts;
  const ra = V.acceptAllFor(k, { status: 'undecided' }, { activate: true }); const cb = V.bindingsPass(k).counts;
  const active = new Set(__.dOf(k).alerts.filter((a) => V.alertState(k, a.id) === 'active').map((a) => a.id)); const n0 = P(k).trialLog.length;
  check('bindings', 'V72-29 · accept and start trial: every accepted row active; the toast counts the Triggers that now record trial firings', ra.ok && cb.active === ca.undecided && ra.skipped === ca.cantResolve && ra.toast === `Accepted ${ra.count} and started the trial: ${ra.alerts} Trigger${ra.alerts === 1 ? '' : 's'} now record${ra.alerts === 1 ? 's' : ''} trial firings. Commissioning · nothing is sent.` && active.size === ra.alerts, ra.toast);
  const adv = V.advance(60); const recs = P(k).trialLog.slice(n0);
  check('bindings', 'V72-29 · advance(60) adds trial records only for active Triggers, and opens no Issue', recs.every((x) => active.has(x.alertId)) && !adv.opened.some((o) => o.plant === k) && V.issues(k).length === 0, `${recs.length} records`);
  const left = V.checklist(k).blockers.find((b) => b.id === 'drafts');
  check('bindings', 'V72-29 · rows that can\'t resolve stay in the drafts blocker until each is decided', cb.cantResolve ? !!left && left.count === cb.cantResolve : !left, left && left.text);
  beat('DigitalPaani bindings accepted');
});

/* ── V72-35, V72-37 · people at DigitalPaani; Go live with nothing bound ──────────────────────────────────────────────── */
V.reset();
{
  const k = 'digitalpaani';
  const e1 = V.addPerson(k, { name: '', role: 'l1', phone: '+91 90000 40001' });
  check('people', 'V72-37 · Add a person without a name: "Give the person\'s name."', !e1.ok && e1.error === 'Give the person\'s name.');
  check('people', 'validation: "Pick a role."; an Operator needs a number; a number needs 10 digits', V.addPerson(k, { name: 'X', role: 'boss' }).error === 'Pick a role.' && V.addPerson(k, { name: 'X', role: 'Operator' }).error === 'An Operator, Lead or Senior Lead needs a phone number to be reached.' && V.addPerson(k, { name: 'X', role: 'l1', phone: '12345' }).error === 'Give a phone number with at least 10 digits.');
  const a = V.addPerson(k, { name: 'Ravi Kumar', role: 'Operator', phone: '+91 90000 40001', channel: 'WhatsApp' });
  const pr = V.people(k).find((p) => p.id === a.id);
  check('people', 'V72-37 · a valid Operator starts not verified and unreachable; id from its own counter; "Added Ravi Kumar (Operator). Send a code so they can verify their phone."', a.ok && /^pp_\d+$/.test(a.id) && pr && !pr.phone.verified && !pr.reachable && pr.verifiedText === 'Not verified' && a.toast === 'Added Ravi Kumar (Operator). Send a code so they can verify their phone.' && latestAct(k) === 'Added Ravi Kumar (Operator) to the roster', a.toast);
  check('people', 'confirming before a code is sent is refused', !V.confirmCode(k, a.id).ok);
  const sc = V.sendCode(k, a.id); const ps = V.people(k).find((p) => p.id === a.id);
  check('people', 'V72-37 · Send code stamps codeSentAt: "Code sent 09:00 · waiting", with the labelled sample button', sc.ok && ps.phone.codeSentAt === V.now() && ps.verifiedText === 'Code sent 09:00 · waiting' && ps.sampleConfirm === '(sample) Ravi Kumar enters the code' && latestAct(k) === 'Sent a code to Ravi Kumar\'s phone');
  const cc = V.confirmCode(k, a.id);
  check('people', 'V72-37 · the sample confirm verifies the phone and clears the operator blocker; Reachability names the missing Lead', cc.ok && V.people(k).find((p) => p.id === a.id).verifiedText === 'Verified' && !V.checklist(k).blockers.some((b) => b.id === 'operator') && V.checklist(k).blockers.some((b) => b.id === 'lead') && V.reachability(k).text === 'No Lead with a verified phone: nobody would be notified at Lead level. This blocks go-live.' && latestAct(k) === 'Ravi Kumar\'s phone verified', V.reachability(k).text);
  const b = V.addPerson(k, { name: 'Neha Sharma', role: 'Lead', phone: '+91 90000 40002', channel: 'WhatsApp' }); V.sendCode(k, b.id); V.confirmCode(k, b.id);
  const cl = V.checklist(k);
  check('people', 'Chapter 4 · with Neha Sharma verified: "1 Operator and 1 Lead can be reached: their phones are verified."; People track "2 people · 1 Operator · 1 Lead"', V.reachability(k).text === '1 Operator and 1 Lead can be reached: their phones are verified.' && cl.tracks.people.steps[0].text === '2 people · 1 Operator · 1 Lead' && cl.tracks.people.steps[1].text === '1 Operator and 1 Lead with verified phones' && !cl.blockers.some((x) => x.id === 'operator' || x.id === 'lead'));
  needs('checklist', 'V72-35 · Go live enabled with no Trigger and the bindings pass not open', ['structure'], () => {
    const un = V.structurePass(k).unclassified.map((x) => x.eqId); const r = V.notPart(k, un, {}); const c2 = V.checklist(k);
    check('checklist', 'V72-35 · with an Operator and a Lead verified and the 20 unclassified marked not part: can go live, with no Trigger and the bindings pass not open', r.ok && c2.canGoLive && c2.blockers.length === 0 && c2.buttonLabel === 'Go live' && __.dOf(k).alerts.length === 0 && !V.bindingsPass(k).open && !V.structureDone(k), c2.blockers.map((x) => x.id).join(','));
    const pv = V.goLivePreview(k);
    check('checklist', 'its go-live confirmation says "Trial: no Trigger was active" and "No scheduled Tasks yet: nothing falls due today."', pv.trial.text === 'Trial: no Trigger was active' && pv.tasks.text === 'No scheduled Tasks yet: nothing falls due today.' && pv.canGoLive);
    beat('DigitalPaani people and unclassified');
  });
}

/* ── V72-38, V72-39 · removing and changing people ───────────────────────────────────────────────────────────────────── */
V.reset();
{
  const rp = V.removePreview('vedanta', 'pv3');
  check('people', 'V72-38 · removing Arjun Mehta leaves no Lead with a verified phone (Priya Nair is not verified): "Vedanta ETP would have no Lead with a verified phone: go-live would be blocked."', rp.leavesNoLead && !rp.leavesNoOperator && rp.text === 'Vedanta ETP would have no Lead with a verified phone: go-live would be blocked.' && rp.title === 'Remove Arjun Mehta from Vedanta ETP\'s roster?', rp.text);
  check('people', 'removing Priya Nair changes nobody else', V.removePreview('vedanta', 'pv2').text === 'Nobody else changes.');
  const rr = V.removePerson('vedanta', 'pv3');
  check('people', 'V72-38 · after removing Arjun Mehta Vedanta has the lead blocker', rr.ok && V.checklist('vedanta').blockers.some((b) => b.id === 'lead') && latestAct('vedanta') === 'Removed Arjun Mehta from the roster');
  V.reset();
  const up = V.updatePerson('vedanta', 'pv3', { phone: '+91 90000 10099' });
  check('people', 'V72-39 · a new number resets verification; Arjun Mehta was the only reachable Lead, so the lead blocker returns', up.ok && !V.people('vedanta').find((p) => p.id === 'pv3').phone.verified && V.checklist('vedanta').blockers.some((b) => b.id === 'lead') && up.toast === 'Saved Arjun Mehta. Changing the number means verifying it again.' && latestAct('vedanta') === 'Changed Arjun Mehta: phone +91 90000 10003 → +91 90000 10099', latestAct('vedanta'));
  const rl = V.removePreview('manesar', 'p6');
  check('people', 'on a Live plant the remove preview speaks of who would be told', rl.text === 'Nobody else changes.' && V.updatePerson('manesar', 'p4', { grant: 'Full Admin' }).ok && V.people('manesar').find((p) => p.id === 'p4').grantLabel === 'Full Admin · Manesar STP');
}

/* ── V72-41 · routing and the hooter ──────────────────────────────────────────────────────────────────────────────────── */
V.reset();
{
  const ro = V.routing('vedanta');
  check('routing', 'the ladder in v7/2\'s words, counted from the roster (Vedanta: 3 for an Emergency); start by / fix by follow the severity; the Commissioning banner',
    ro.ladder.map((l) => l.text).join(' | ') === 'Emergency: calls every Operator, Lead and Senior Lead, a full-screen warning in the app, and the hooter | Major: Operators and Leads by WhatsApp or SMS, with a full-screen warning in the app | Minor: Operators by WhatsApp or SMS; Leads in the app | Caution: Operators and Leads in the app and the morning email' && ro.ladder[0].count === 3 && ro.clocksText === 'Start by / fix by follow the severity: Emergency 1 h / 4 h · Major 8 h / 24 h · Minor 24 h / 72 h · Caution: none.' && ro.banner === 'Commissioning: nothing is sent. This is who will be told from go-live.' && V.routing('manesar').banner === null, ro.ladder.map((l) => l.text).join(' | '));
  const sr = V.setRouting('manesar', { hooter: false });
  check('routing', 'V72-41 · switching the hooter off writes "Hooter switched off at Manesar STP"; the Emergency line ends "(the hooter is off)"', sr.ok && sr.changed && latestAct('manesar') === 'Hooter switched off at Manesar STP' && V.activity({ plant: 'manesar', limit: 1 })[0].kind === 'people' && /\(the hooter is off\)$/.test(V.routing('manesar').ladder[0].text) && P('manesar').routing.hooter === false, V.routing('manesar').ladder[0].text);
  /* a real Emergency on a Manesar Trigger that is not frozen: its sensor's Zones pulled under the reading */
  let iss = null;
  if (HAS.ledger) { const r = V.setLimits('manesar', 'at1_mlss', 'above', { caution: 1, minor: 2, major: 3, emergency: 4 }, { reason: 'tuning', note: 'Test: force an Emergency' }); if (r.ok) { V.advance(30); iss = V.issues('manesar').find((i) => i.alertId === 'a_mlss_hi' && i.band === 'emergency') || null; } }
  if (!iss) { const terms = __.termsFor('manesar', 'a_flood'); iss = __.openAlertIssue('manesar', __.alertRaw('manesar', 'a_flood'), { start: V.now(), end: null, band: 'emergency', firstBand: 'emergency', peak: 1, limit: 1, steps: [] }, terms, V.now(), { quiet: true }); }
  check('routing', 'V72-41 · a Manesar Emergency Issue opened afterwards calls the Operators and Leads and has no hooter entry', iss && iss.told.some((x) => x.how === 'phone call') && !iss.told.some((x) => x.how === 'hooter'), iss && iss.told.map((x) => x.how).join(','));
  check('routing', 'the go-live and activate sentences say the hooter is switched off', /including Emergency calls \(the hooter is switched off at this plant\)\.$/.test(V.activatePreview('manesar', 'a_mlss_hi').lines[0]));
}

/* ── V72-61 … V72-65, V72-67, V72-69 · last service dates, go live ───────────────────────────────────────────────────── */
V.reset();
{
  const sd = V.serviceDates('vedanta'); const row = (t) => sd.rows.find((r) => r.tag === t) || {};
  check('dates', 'V72-61 · Vedanta: 11 pieces of equipment with a PM Task, 4 entered; BL-1, BL-2 Mon 19 Oct; P-1, P-2 Tue 20 Oct', sd.total === 11 && sd.entered === 4 && row('BL-1').dateText === 'Mon 19 Oct' && row('BL-2').dateText === 'Mon 19 Oct' && row('P-1').dateText === 'Tue 20 Oct' && row('P-2').dateText === 'Tue 20 Oct' && sd.rows.map((r) => r.tag).join(',') === 'P-1,P-2,EQ-1,MX-1,AN-1,BL-1,BL-2,TS-1,FP-1,SP-1,V-7', sd.rows.map((r) => `${r.tag}:${r.dateText}`).join(','));
  check('dates', 'Chapter 7 · "Entered for 4 of 11 pieces of equipment · If you went live now, 51 of 73 scheduled Tasks would fall due on go-live day."; BL-1 "9" PM Tasks, "1 on go-live day, 8 later · earliest Fri 13 Nov"', sd.counterText === 'Entered for 4 of 11 pieces of equipment · If you went live now, 51 of 73 scheduled Tasks would fall due on go-live day.' && row('BL-1').pmTasks === 9 && row('BL-1').preview.text === '1 on go-live day, 8 later · earliest Fri 13 Nov', `${sd.counterText} · ${row('BL-1').preview.text}`);
  const c1 = V.setServiceDate('vedanta', 'v_bl1', null); const sd2 = V.serviceDates('vedanta');
  check('dates', 'clearing BL-1\'s date: "All 9 on go-live day" and 59 of 73', c1.ok && sd2.rows.find((r) => r.tag === 'BL-1').preview.text === 'All 9 on go-live day' && sd2.dueTodayIfNow === 59 && latestAct('vedanta') === 'Last service date for BL-1 cleared');
  const s1 = V.setServiceDate('vedanta', 'v_bl1', '2026-10-19');
  check('dates', 'putting it back: "Last service for BL-1 set to Mon 19 Oct: 8 of its 9 PM Tasks now count from it."', s1.ok && s1.toast === 'Last service for BL-1 set to Mon 19 Oct: 8 of its 9 PM Tasks now count from it.' && latestAct('vedanta') === 'Last service date for BL-1 set to Mon 19 Oct', s1.toast);
  check('dates', 'V72-65 · refusals: a future date, DT-1 with no PM Task, a Live plant', V.setServiceDate('vedanta', 'v_bl1', '2026-11-01').error === 'A last service date can\'t be in the future.' && V.setServiceDate('vedanta', 'v_dt1', '2026-10-01').error === 'DT-1 has no PM Task.' && V.setServiceDate('manesar', 'bl1', '2026-10-01').error === 'Manesar STP is Live: PM Tasks count from their last completion.' && V.setServiceDate('vedanta', 'v_bl1', '19/10/2026').error === 'Pick a date.');
  V.reset(); V.acceptAllFor('vedanta', { status: 'undecided' }, { activate: true });
  const pv = V.goLivePreview('vedanta'); const g = V.goLiveTasks('vedanta');
  check('golive', 'V72-62 · after the MLSS decision: scheduled 73, due today 51, from dates 22, 4 of 11 dated, about 59 a day (= the go-live rows)', pv.tasks.scheduled === 73 && pv.tasks.dueToday === 51 && pv.tasks.fromDates === 22 && pv.tasks.eqDated === 4 && pv.tasks.eqWithPM === 11 && Math.round(pv.tasks.perDay) === 59 && g.rows.length === 73 && g.rows.filter((r) => r.due <= V.now()).length === 51 && Math.abs(pv.tasks.perDayExact - V.tasksPerDay('vedanta')) < 1e-9, JSON.stringify(pv.tasks));
  check('golive', 'the go-live lines, loudest first, and the computed Tasks sub-line', pv.title === 'Go live: Vedanta ETP' && pv.lines.map((l) => l.text).join(' | ') === 'Triggers create Issues and notify the plant\'s people, including Emergency calls and the hooter | Scheduled Tasks start. First due dates come from the service dates you entered, otherwise today. | Metrics and PM compliance start counting today | Changing structure will need a reason' && pv.lines[0].loud && !pv.lines[1].loud && pv.lines[1].sub === '51 of 73 scheduled Tasks fall due today. Service dates were entered for 4 of 11 pieces of equipment; 22 Tasks count from them. After today, about 59 Tasks a day.', pv.lines[1].sub);
  check('golive', 'the trial line "Trial: 3 Triggers fired · 1 fired more than 10 times a day" and the gaps line "3 gaps remain · 1 noisy Trigger · 1 reading without limits · 1 Issue Trigger without a diagnostic flow"', pv.trial.text === 'Trial: 3 Triggers fired · 1 fired more than 10 times a day' && pv.trial.linkText === 'Review them' && pv.gapsText === '3 gaps remain · 1 noisy Trigger · 1 reading without limits · 1 Issue Trigger without a diagnostic flow' && pv.gaps.length === V.checklist('vedanta').gaps.length, `${pv.trial.text} · ${pv.gapsText}`);
  const clr = __.dryRun('vedanta', () => { ['v_bl1', 'v_bl2', 'v_p1', 'v_p2'].forEach((id) => V.setServiceDate('vedanta', id, null)); return V.goLivePreview('vedanta').tasks; });
  check('golive', 'V72-64 · with every service date cleared all 73 fall due today: "All 73 scheduled Tasks fall due today: no service dates were entered. After today, about 59 Tasks a day."', clr.dueToday === 73 && clr.text === 'All 73 scheduled Tasks fall due today: no service dates were entered. After today, about 59 Tasks a day.', clr.text);
  const before = V.alerts('vedanta').map((a) => `${a.id}:${a.state}`).join(','); const runId = P('vedanta').trialOpen.a_3d; const nT = P('vedanta').trialLog.length;
  const gl = V.goLive('vedanta'); const PV = P('vedanta'); const t0 = V.now();
  const sch = (name) => __.dOf('vedanta').schedules.find((s) => s.subject.id === 'v_bl1' && s.name === name);
  const st = (name) => PV.tasks[(sch(name) || {}).id] || {};
  check('golive', 'V72-63 · after go-live exactly 51 Task states are due at go-live', gl.ok && Object.values(PV.tasks).filter((x) => x.due === t0).length === 51 && gl.dueToday === 51, gl.error);
  check('golive', 'V72-63 · BL-1: belt tension and alignment check due Wed 18 Nov 00:00; oiling due at go-live (service-passed); bearing service Fri 13 Nov by its meter',
    st('Preventive maintenance - Blower belt tension and alignment check').due === T('2026-11-18T00:00') && st('Preventive maintenance - Oiling and Lubrication of Blowers').due === t0 && st('Preventive maintenance - Oiling and Lubrication of Blowers').firstDue === 'service-passed' && V.fmtDay(st('Bearing service').due) === 'Fri 13 Nov' && st('Bearing service').firstDue === 'service', `${V.fmt(st('Bearing service').due)}`);
  check('golive', 'V72-67 · no Trigger changed its status; trialOpen is empty; the running Level high record ended at go-live; the trial is kept as history', V.alerts('vedanta').map((a) => `${a.id}:${a.state}`).join(',') === before && Object.keys(PV.trialOpen).length === 0 && PV.trialLog.find((r) => r.id === runId).end === t0 && PV.trialLog.length === nT && PV.commissioningSince === null && V.trialStats('vedanta', 'a_3d').history && V.trialStats('vedanta', 'a_3d').title === 'Trial before go-live' && V.trialStats('vedanta', 'a_3d').count === 76);
  check('golive', 'the toast and Activity: "Vedanta ETP is Live. Issues and notifications started at 09:00."; "Went live: 13 Triggers now create Issues and notify people, including Emergency calls and the hooter. 51 of 73 scheduled Tasks due today."', gl.toast === 'Vedanta ETP is Live. Issues and notifications started at 09:00.' && latestAct('vedanta') === 'Went live: 13 Triggers now create Issues and notify people, including Emergency calls and the hooter. 51 of 73 scheduled Tasks due today.' && V.activity({ plant: 'vedanta', limit: 1 })[0].kind === 'golive', latestAct('vedanta'));
  const cv = V.coverage('vedanta');
  check('golive', 'Coverage right after go-live: "Issues since go-live" 0, Active 13, false alarms "—" (none closed yet), no noisiest, the fresh go-live banner', cv.window.label === 'Issues since go-live' && cv.triggers.issues === 0 && cv.triggers.active === 13 && cv.triggers.falseAlarmText === '—' && cv.triggers.closedText === 'none closed yet' && cv.triggers.noisiest === null && cv.freshText === 'Vedanta ETP went live Thu 29 Oct, 09:00. Counts start at go-live.');
  check('golive', 'V72-69 · right after go-live there is no noisy gap (on a Live plant noisy counts Issues)', !V.checklist('vedanta').gaps.some((x) => x.id === 'noisy'));
  check('golive', 'go live again is refused: "Vedanta ETP is already Live."', V.goLive('vedanta').error === 'Vedanta ETP is already Live.');
  const nRec = PV.trialLog.length; const adv = V.advance(1440);
  const lv = __.issues ? V.issues('vedanta').filter((i) => i.alertId === 'a_3d').length : 0; const ng = V.checklist('vedanta').gaps.find((x) => x.id === 'noisy');
  check('golive', 'V72-67 · after go-live firings open Issues and write no trial record', adv.opened.some((o) => o.plant === 'vedanta') && PV.trialLog.length === nRec && !adv.trial.some((x) => x.plant === 'vedanta'), adv.summary);
  check('golive', 'V72-69 · after advance(1440) the noisy gap names Level high · EQ-1 with its Issues since go-live a day', !!ng && ng.items[0].alertId === 'a_3d' && ng.items[0].issues === lv && ng.items[0].perDay === Math.round(lv / Math.max(1, (V.now() - t0) / DAY) * 10) / 10 && ng.text === `1 Trigger is noisy: Level high · EQ-1 (${ng.items[0].perDayText} Issues a day)` && lv > 10, ng && ng.text);
  const cv2 = V.coverage('vedanta');
  check('golive', 'Coverage a day later: Issues since go-live and Noisiest from the Issues (computed)', cv2.triggers.issues === V.issues('vedanta').length && cv2.triggers.noisiest && cv2.triggers.noisiest.name === 'Level high · EQ-1');
  if (HAS.ledger) {
    const r = V.setLimits('vedanta', 'v_eq1_PH', 'below', { minor: 9.9, major: 9.8, emergency: 9.7 }, { reason: 'tuning', note: 'Test: force an Emergency' }); V.advance(30);
    const em = V.issues('vedanta').find((i) => i.alertId === 'a_3f' && i.band === 'emergency');
    check('golive', 'V72-67 · an Emergency Issue after go-live calls the Operators and Leads and sounds the hooter', r.ok && em && em.told.some((x) => x.how === 'phone call') && em.told.some((x) => x.how === 'hooter'), em && em.told.map((x) => x.how).join(','));
  } else skip('golive', 'V72-67 · an Emergency Issue after go-live calls the Operators and Leads and sounds the hooter', 'needs the ledger file');
  beat('Vedanta live and +1 day');
}

/* ── V72-83, V72-85 … V72-89 · Live plants: drafts, return, Coverage ─────────────────────────────────────────────────── */
V.reset();
{
  const cv = V.coverage('manesar');
  check('coverage', 'V72-88 · Manesar at seed: active 6, drafts 80, Issues (last 7 days) 3, closed 2, false alarms 1 (50%), noisiest DO low · AT-2; the Blind spots placeholder; gaps = [nopm (4)]',
    cv.triggers.active === 6 && cv.triggers.drafts === 80 && cv.window.label === 'Issues, last 7 days' && cv.triggers.issues === 3 && cv.triggers.closed === 2 && cv.triggers.falseAlarms === 1 && cv.triggers.falseAlarmShare === 0.5 && cv.triggers.falseAlarmText === '50%' && cv.triggers.closedText === '1 of 2 closed' && cv.triggers.noisiest && cv.triggers.noisiest.name === 'DO low · AT-2' && cv.blindSpots.placeholder && cv.blindSpots.text === 'Arrives with Diagnostics: what must be known per unit process, how often, and what isn\'t covered.' && cv.gaps.length === 1 && cv.gaps[0].id === 'nopm' && cv.gaps[0].count === 4 && cv.gaps[0].text === '4 pieces of equipment without a maintenance programme' && cv.triggers.draftsText === 'Drafts in the review queue: 80', JSON.stringify(cv.triggers));
  if (HAS.ledger) { const dc = V.deviations({ plant: 'manesar' }).counts; check('coverage', 'Deviations here equal the ledger\'s counts for the plant (overrides, base moved, past review)', cv.deviations.overrides === dc.overrides && cv.deviations.baseMoved === dc.basemoved && cv.deviations.pastReview === dc.pastreview && cv.deviations.overrides === 14 && cv.deviations.pastReview === 1, JSON.stringify(cv.deviations)); }
  else skip('coverage', 'Deviations here equal the ledger\'s counts for the plant', 'needs the ledger file');
  const bw = V.coverage('bawal');
  check('coverage', 'V72-89 · Bawal at seed: one gap, nodiag naming Chemical tank low · DT-1; Issues, last 7 days 0; Noisiest none', bw.gaps.length === 1 && bw.gaps[0].id === 'nodiag' && bw.gaps[0].text === '1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1' && bw.triggers.issues === 0 && bw.triggers.noisiest === null, bw.gaps.map((g) => g.text).join(' | '));
  check('coverage', 'V72-36 · at seed every plant\'s checklist gaps equal its go-live preview gaps (Commissioning) or its Coverage gaps (Live), id for id and count for count', KEYS.every((k) => { const a = V.checklist(k).gaps.map((g) => `${g.id}:${g.count}`).join(','); const b = (V.state(k) === 'live' ? V.coverage(k).gaps : V.goLivePreview(k).gaps).map((g) => `${g.id}:${g.count}`).join(','); return a === b; }));
  const rp = V.returnPreview('manesar');
  check('coverage', 'V72-85 · returnPreview(manesar) at seed: 6 active Triggers, 1 open Issue (DO low · AT-2), 9 upcoming Tasks, 3 in the next 7 days, 1 already due, 80 drafts after',
    rp.activeTriggers === 6 && rp.openIssues.length === 1 && rp.openIssues[0].title === 'DO low · AT-2' && rp.tasksUpcoming === 9 && rp.tasksDueNext7 === 3 && rp.tasksOpen === 1 && rp.draftsAfter === 80 && V.state('manesar') === 'live', JSON.stringify({ ...rp, lines: undefined, blockersAfter: undefined }));
  check('coverage', 'its lines: loud first and last, with the computed counts', rp.lines[0].loud && rp.lines[0].text === '6 active Triggers record trial firings only, at every severity, Emergencies included. Nobody is told: no Issues, no WhatsApp, no calls, no hooter.' && rp.lines[1].text === '1 open Issue stays open and is worked as normal, with its reminders and escalations: DO low · AT-2.' && rp.lines[2].text === 'Scheduled Tasks stop: 9 upcoming Tasks won\'t come due (3 were due in the next 7 days). 1 Task already due stays open.' && rp.lines[5].text === 'To go live again, every draft must be decided: 80 are waiting.' && rp.lines[5].loud && rp.note === 'Needs a reason. Global Admin, Full Admin or Technical Admin can return a plant.', rp.lines.map((l) => l.text).join(' | '));
  const ap = V.activatePreview('manesar', 'eq1|alert|Level high');
  check('coverage', 'the Activate confirmation on a Live plant: creates Issues and notifies, "It gets no trial first", Return the plant to Commissioning…, the band lines, no "would have fired"',
    ap.live && ap.title === 'Activate Level high · EQ-1?' && /creates Issues and notifies the plant's people/.test(ap.lines[0]) && /^It gets no trial first/.test(ap.lines[1]) && ap.buttons.includes('Return the plant to Commissioning…') && ap.bandLines.length >= 1 && ap.bandLines.every((t) => /^(Caution|Minor|Major|Emergency): /.test(t)) && !JSON.stringify(ap).includes('would have fired'), JSON.stringify(ap).slice(0, 300));
  const d1 = V.decide('manesar', 'eq1|alert|Level high', 'accept', { activate: false }); const id = d1.alertId;
  check('coverage', 'V72-83 · accepting a Manesar proposal without activating makes a draft (Draft · never fires)', d1.ok && id && V.alertState('manesar', id) === 'draft' && V.bindingsPass('manesar').rows.find((r) => r.alertId === id).statusLabel === 'Draft · never fires', d1.error);
  const a1 = V.activate('manesar', id);
  check('coverage', 'V72-83 · Activate makes it active with phase live, no trial (trialStats null): "Level high · EQ-1 is active at Manesar STP. It creates Issues from now on."', a1.ok && a1.phase === 'live' && V.trialStats('manesar', id) === null && a1.toast === 'Level high · EQ-1 is active at Manesar STP. It creates Issues from now on.' && latestAct('manesar') === 'Activated Level high · EQ-1: it creates Issues and notifies people from now on', a1.toast);
  if (HAS.ledger) {
    const off = V.setAlertState('manesar', 'a_mlss_hi', 'inactive', { reason: 'tuning', note: 'Probe out for cleaning this week' });
    const rec = V.S.overrides.find((o) => o.plant === 'manesar' && o.target.kind === 'enabled' && o.target.alertId === 'a_mlss_hi' && o.status === 'active');
    check('coverage', 'active → inactive on a Live plant is an override of "enabled" with one of the five reasons', off.ok && V.alertState('manesar', 'a_mlss_hi') === 'inactive' && !!rec && rec.reason === 'tuning' && !V.setAlertState('manesar', 'a_bl1_trip', 'inactive', { reason: 'because' }).ok, off.error);
    const on = V.activate('manesar', 'a_mlss_hi');
    check('coverage', 'activating it again ends that override', on.ok && V.alertState('manesar', 'a_mlss_hi') === 'active' && rec.status !== 'active', on.error);
  } else skip('coverage', 'active → inactive on a Live plant is an override of "enabled"', 'needs the ledger file');
  V.reset();
  const n0 = V.returnToCommissioning('manesar', '');
  check('coverage', 'V72-86 · Return without a reason: "Say why the plant goes back to Commissioning."; a Commissioning plant is refused', !n0.ok && n0.error === 'Say why the plant goes back to Commissioning.' && V.returnToCommissioning('vedanta', 'x').error === 'Vedanta ETP is already in Commissioning.');
  const iss0 = V.issue('manesar', 'is_2z'); const log0 = iss0.log.length;
  const rt = V.returnToCommissioning('manesar', 'Aeration grid retrofit, two weeks.'); const M = ['a_do_at2', 'a_mlss_hi', 'a_bl1_amps', 'a_bl1_trip', 'a_flood', 'a_blanket'];
  const dr = V.checklist('manesar').blockers.find((b) => b.id === 'drafts');
  check('coverage', 'V72-86 · with a reason Manesar is in Commissioning; its six Triggers are active with phase trial; the open Issue stays open; the drafts blocker counts 80; the toast', rt.ok && V.state('manesar') === 'commissioning' && M.every((x) => V.alertState('manesar', x) === 'active' && V.triggerPhase('manesar', x) === 'trial') && V.issue('manesar', 'is_2z').status !== 'closed' && dr && dr.count === 80 && rt.toast === 'Manesar STP is back in Commissioning. Triggers record trial firings only; nothing is sent, Emergencies included.' && latestAct('manesar') === 'Returned to Commissioning: Aeration grid retrofit, two weeks. Triggers record trial firings only, Emergencies included: nothing is sent. Scheduled Tasks stop; metrics stop counting.', latestAct('manesar'));
  check('coverage', 'after the return the upcoming Tasks wait for go-live; the one already due stays due', Object.values(P('manesar').tasks).filter((x) => x.status === 'waiting' && x.due === null).length === 9 && Object.values(P('manesar').tasks).filter((x) => x.status === 'due').length === 1);
  {
    const tl = V.tasks('manesar'); const open = tl.filter((x) => x.status === 'due'); const waiting = tl.filter((x) => x.status === 'waiting');
    const r = open.length ? __.dryRun('manesar', () => ({ s: V.startTask('manesar', open[0].id), d: V.doneTask('manesar', open[0].id), after: V.task('manesar', open[0].id).status, w: V.startTask('manesar', waiting[0].id) })) : null;
    check('coverage', 'the Tasks list shows the Task already due as due and the rest as waiting; it can still be started and done (then it waits for go-live), a waiting one cannot start',
      open.length === 1 && waiting.length === tl.length - 1 && r && r.s.ok && r.d.ok && r.after === 'waiting' && !r.w.ok && r.w.error === 'Tasks start when the plant goes live.', r && JSON.stringify({ s: r.s.ok, d: r.d.ok, after: r.after, w: r.w.error }));
  }
  const nM =P('manesar').trialLog.length; const adv = V.advance(1440); const iss1 = V.issue('manesar', 'is_2z');
  const recsDo = P('manesar').trialLog.slice(nM).filter((x) => x.alertId === 'a_do_at2');
  check('coverage', 'V72-86 · advance(1440) after the return opens no new Manesar Issue; other Triggers write trial records', !adv.opened.some((o) => o.plant === 'manesar') && P('manesar').trialLog.length >= nM, adv.summary);
  check('coverage', 'V72-87 · the Trigger whose Issue is still open logs its firing on that Issue and writes no trial record while it is open', iss1.status !== 'closed' && iss1.log.length > log0 && iss1.log.slice(log0).some((l) => /^(Fired again|Stepped up|Back inside)/.test(l.text)) && recsDo.length === 0, iss1.log.slice(log0).map((l) => l.text).join(' | '));
  beat('Manesar returned and +1 day');
}

/* ── V72-102 · cadence changes: where counting starts ──────────────────────────────────────────────────────────────── */
V.reset();
needs('cadence', 'V72-102 · cadence changes from a unit-process template', ['structure'], () => {
  const id = 'tpl_up_mbr_quarterly-cip'; const ev = { n: 2, unit: 'month' };
  const sv = V.cadenceDueNow(id, ev, 'service'); const pb = V.cadenceDueNow(id, ev, 'publish');
  const ts = (x) => ((x.plants.find((p) => p.key === 'manesar') || { tasks: [] }).tasks.find((t) => t.scheduleId === 's_mbr_cip')) || null;
  const a = ts(sv), b = ts(pb);
  check('cadence', 'V72-102 · "Count from the last service": Manesar MBR-1\'s Quarterly CIP is due now, anchored on its last completion Thu 20 Aug; dueNow 1', a && a.dueNow && a.anchorFrom === 'done' && V.fmtDay(a.anchor) === 'Thu 20 Aug' && sv.dueNow === 1 && sv.labels.service === 'Count from the last service: 1 due now' && sv.text === '1 Task becomes due now across 1 plant', JSON.stringify(a));
  check('cadence', 'V72-102 · "Count from the publish date": first due publish + 2 months, later than before (Wed 18 Nov); dueNow 0; "first due in 2 months"', b && !b.dueNow && b.newDue === V.now() + 60 * DAY && b.oldDue > V.now() && V.fmtDay(b.oldDue) === 'Wed 18 Nov' && b.later && pb.dueNow === 0 && pb.labels.publish === 'Count from the publish date: first due in 2 months', JSON.stringify(b));
  const sc = __.schedRaw('manesar', 's_mbr_cip'); const st = P('manesar').tasks.s_mbr_cip; const scNew = { ...JSON.parse(JSON.stringify(sc)), every: ev };
  const h1 = V.dueAfter('manesar', scNew, sc, st, V.now(), { countFrom: 'service' }); const h2 = V.dueAfter('manesar', scNew, sc, st, V.now(), { countFrom: 'publish' }); const h3 = V.dueAfter('manesar', scNew, sc, st, V.now(), {});
  check('cadence', 'the dueAfterChange hook applies the same rule the preview shows; without a count-from it keeps core7\'s rule', h1.due === a.newDue && h2.due === b.newDue && h3.due === __.dueAfterChange('manesar', scNew, sc, st, V.now()).due);
  check('cadence', 'a template nothing follows reaches no plant', V.cadenceDueNow('tpl_SUB_PMP_nothing-here', ev, 'service').plants.length === 0);
});

/* ── words, beats, determinism ────────────────────────────────────────────────────────────────────────────────────── */
{
  V.reset(); const seedSeq = V.S.aseq; const k = 'digitalpaani'; V.addPerson(k, { name: 'Ravi Kumar', role: 'l1', phone: '+91 90000 40001' }); V.setRouting('bawal', { hooter: false });
  V.acceptAllFor('vedanta', { status: 'undecided' }, { activate: true }); V.goLive('vedanta'); V.returnToCommissioning('manesar', 'Retrofit');
  const words = badWords(commissionTexts(V, seedSeq));
  check('words', 'no don\'t-use word in what this file writes (checklists, previews, pass, people, routing, dates, Coverage, trial cards, Activity)', words.length === 0, words.slice(0, 6).join(' || '));
  check('checklist', 'V72-33 · after every beat above, blocker ids ⊆ {operator, lead, untyped, unclassified, drafts} and gap ids ⊆ {nolimits, noisy, nopm, nodiag}', beats.every((b) => b.ok) && idsOk(), beats.filter((b) => !b.ok).map((b) => b.label).join(', ') || `${beats.length} beats`);
  V.reset();
}
const STATE = () => sha(JSON.stringify([KEYS.map((k) => [__.dOf(k).people, P(k).serviceDates, P(k).goLives, P(k).routing]), V.activity({}).map((a) => a.text), KEYS.map((k) => V.checklist(k)), KEYS.map((k) => V.coverage(k))]));
if (MODE === '--fresh') { emit({ state: STATE() }); process.exit(0); }
if (MODE === 'main') {
  V.reset(); const here = STATE(); V.reset();
  check('determinism', 'Reset restores this file\'s state exactly', STATE() === here);
  const f1 = child(['--fresh']); const f2 = child(['--fresh']);
  check('determinism', 'two boots from empty storage, in two processes, give byte-equal people, dates, go-lives, Activity, checklists and Coverage', !f1.error && f1.state === f2.state && f1.state === here, f1.error || `${f1.state} ${f2.state} ${here}`);
}

/* ════════════════════════════════════ report ═══════════════════════════════════════════════════════════════════════ */
if (MODE === '--alone') { emit({ results, loaded: L.loaded }); process.exit(0); }
const others = ['core72-structure.js', 'core72-library.js', 'core72-ledger.js'].filter((f) => L.loaded.includes(f));
if (others.length) {
  const al = child(['--alone'], { LOAD72_SKIP: others.join(',') });
  check('alone', 'core7 and this file alone: the fallbacks hold', !al.error && al.loaded && !al.loaded.some((f) => others.includes(f)), al.error);
  (al.results || []).forEach((r) => { if (r.skipped) results.push({ ...r, group: `alone · ${r.group}` }); else check(`alone · ${r.group}`, r.name, r.ok, r.detail); });
}
const groups = [...new Set(results.map((r) => r.group))]; const skipped = results.filter((r) => r.skipped);
groups.forEach((g) => { const rs = results.filter((r) => r.group === g); const bad = rs.filter((r) => !r.ok); const sk = rs.filter((r) => r.skipped); console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(26)} ${rs.length - bad.length - sk.length}/${rs.length - sk.length}${sk.length ? ` (${sk.length} skipped)` : ''}`); (VERBOSE ? rs : bad).forEach((r) => console.log(`       ${r.skipped ? '-' : r.ok ? '✓' : '✗'} ${r.name}${r.skipped ? `  [skipped: ${r.skipped}]` : ''}${!r.ok && r.detail ? `  [${r.detail}]` : ''}`)); });
console.log(`\nreadiness72 · ${results.length - skipped.length} checks, ${skipped.length} skipped · loaded: ${L.loaded.filter((f) => /^core7/.test(f)).join(', ')}`);
console.log(`RESULT: ${fails ? `FAIL · ${fails} failing` : 'PASS'}`);
process.exit(fails ? 1 : 0);
