#!/usr/bin/env node
/* v7/2 · tests/story72.core.test.js — the twelve chapters walked in order from "Reset the story", through core functions only
   (no page is rendered): every number the story quotes is checked against the function that computes it, and the quoted copy
   the core writes is checked word for word. The clock stays at Thu 29 Oct, 09:00 until chapter 8's "+1 hour" and chapter
   11's "+1 week"; optional beats that would change the walk run inside a dry run, and optional time moves are left to
   readiness72. A beat that needs a core file that is not loaded is listed as skipped, never as passed.
   Node only, no dependencies.   Usage: TZ=Asia/Calcutta node tests/story72.core.test.js [-v]     Exit code 0 = pass. */
'use strict';
const VERBOSE = process.argv.includes('-v');
const DAY = 864e5, MIN = 6e4;
const T = (s) => Date.parse(s + ':00+05:30');
const results = []; let fails = 0;
const check = (ch, name, ok, detail) => { results.push({ ch, name, ok: !!ok, detail: detail == null ? undefined : String(detail).slice(0, 500) }); if (!ok) fails++; };
const L = require('./load72.js'); const V = L.V7; const __ = V.__;
const has = (n) => typeof V[n] === 'function';
const HAS = { structure: has('identify') && has('structurePass'), library: has('zoneInfo') && has('templates') && has('downstream'), ledger: has('setOverride') && has('deviations'), commission: has('bindingsPass') && has('goLivePreview') };
function beat(ch, title, needs, fn) {
  const miss = needs.filter((x) => !HAS[x]); if (miss.length) { results.push({ ch, name: title, ok: true, skipped: `needs the ${miss.join(' and ')} file` }); return; }
  try { fn(); } catch (e) { check(ch, `${title} (ran without an error)`, false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); }
}
const J = (x) => JSON.stringify(x);
const P = (k) => __.PS(k);
const nodeId = (k, tag) => (__.dOf(k).equipment.find((e) => e.tag === tag) || {}).id;
const nodeIds = (k, ...tags) => tags.map((t) => nodeId(k, t));
const step = (k, track, id) => (V.checklist(k).tracks[track].steps.find((s) => s.id === id) || {});
const latest = (k) => (V.activity({ plant: k, limit: 1 })[0] || {}).text || '';
const nAct = (k) => V.activity({ plant: k }).length;
const DP = 'digitalpaani', VED = 'vedanta', MAN = 'manesar', BAW = 'bawal';

check(0, 'v7/2 loads and boots; the walk starts from "Reset the story" at Thu 29 Oct, 09:00', !!V && L.errors.length === 0 && HAS.commission, L.errors.map((e) => e.error.slice(0, 160)).join(' | '));
V.reset();
check(0, 'the clock reads Thu 29 Oct, 09:00', V.fmt(V.now()) === 'Thu 29 Oct, 09:00');

/* ════════ Chapter 1 · The library ════════ */
beat(1, 'the library home: unit-process types, equipment types, templates, conditions, flows, root causes', ['structure', 'library'], () => {
  const tp = V.templates({}); const trig = tp.filter((t) => t.kind === 'trigger').length; const task = tp.filter((t) => t.kind === 'task').length;
  check(1, '"Unit-process types 27 · Equipment types 56 · Templates {n} ({t} Trigger · {k} Task)" from the functions', V.upTypes().length === 27 && V.libTypes().length === 56 && tp.length > 0 && trig > 0 && task > 0 && trig + task === tp.length, `${V.upTypes().length} · ${V.libTypes().length} · ${tp.length} (${trig} · ${task})`);
  check(1, 'Conditions, Flows and Root causes are listed', (V.conditions() || []).length > 0 && (V.flows() || []).length > 0 && (V.rootCauses() || []).length > 0);
  check(1, '"Plant types 3"', (V.plantTypes() || []).length === 3);
});
beat(1, 'Blower\'s Motor current card and its Resolves at lines', ['library'], () => {
  const lt = V.libType('BLW'); const card = (lt.readings || []).find((r) => r.name === 'Motor current'); const d = card && card.dirs[0]; const ra = d ? d.resolvesAt.map((x) => x.text) : [];
  check(1, 'header chip "Equipment type · v1"; card "Motor current high v1" with "Caution above 100% · Minor above 105% · Major above 115% of full-load current"', lt.chipText === 'Equipment type · v1' && d && d.title === 'Motor current high v1' && d.rulesText === 'Caution above 100% · Minor above 105% · Major above 115% of full-load current', d && d.rulesText);
  check(1, 'Resolves at: Manesar BL-1 40.0 / 42.0 / 46.0 A from 22 kW; keeps its own 44 / 48 A / none (Override); Vedanta BL-1 20.0 / 21.0 / 23.0 A from 11 kW; DigitalPaani needs a Motor current sensor', ra.includes('Manesar STP · BL-1: 40.0 / 42.0 / 46.0 A (22 kW motor)') && ra.includes('Manesar STP · BL-1 keeps its own 44 / 48 A / none (Override)') && ra.includes('Vedanta ETP · BL-1: 20.0 / 21.0 / 23.0 A (11 kW motor)') && ra.some((x) => /^DigitalPaani: needs a Motor current sensor/.test(x)), J(ra));
  check(1, 'the MBBR banner: "Every MBBR in the plant graph is a unit process. Its readings, Triggers, Tasks and Issues are on the unit-process type: Moving bed bioreactor."', V.libType('MBBR').banner === 'Every MBBR in the plant graph is a unit process. Its readings, Triggers, Tasks and Issues are on the unit-process type: Moving bed bioreactor.', V.libType('MBBR').banner);
  const ag = ((V.libType('OS_TANK_AG').readings || []).find((r) => r.name === 'Motor current') || { dirs: [] }).dirs[0] || {};
  check(1, 'Agitator: "Motor current high v1" Minor above 24 A, chip "Library · Motor current high v1", the flag "This scales with the plant. Use a design parameter?"', ag.title === 'Motor current high v1' && ag.rulesText === 'Minor above 24 A' && ag.chip && ag.chip.text === 'Library · Motor current high v1' && ag.flagText === 'This scales with the plant. Use a design parameter?', J(ag).slice(0, 200));
});
beat(1, 'Blower · Motor current high resolves at each plant', ['library'], () => {
  const z = V.zoneInfo(MAN, 'bl1_amps', 'above'); const res = ['caution', 'minor', 'major'].map((b) => z.perBand[b].resolved);
  check(1, 'Manesar BL-1 resolves 40.0 / 42.0 / 46.0 A from 22 kW and keeps its own 44 / 48 A / none (Override)', J(res) === J([40, 42, 46]) && z.bands.caution === 44 && z.bands.minor === 48 && z.bands.major == null, `${J(res)} · ${J(z.bands)}`);
  const zv = V.zoneInfo(VED, 'v_bl1_AMP', 'above');
  check(1, 'Vedanta BL-1 resolves 20.0 / 21.0 / 23.0 A from 11 kW', J(['caution', 'minor', 'major'].map((b) => zv.bands[b])) === J([20, 21, 23]), J(zv.bands));
  check(1, 'Blower is "Equipment type · v1"', V.libType('BLW') && V.libType('BLW').version === 1);
});
beat(1, 'MBBR is a unit process: its content sits on Moving bed bioreactor', ['structure'], () => {
  const u = V.upType('mbbr');
  check(1, 'the MBBR banner points to Moving bed bioreactor, which carries the 29 Task templates and 15 Issue types v7/1 shows on MBBR', J(V.upTypesForCode('MBBR')) === J(['mbbr']) && u.name === 'Moving bed bioreactor' && u.schedules === 29 && u.issues === 15, `${u.schedules} · ${u.issues}`);
});
beat(1, 'Agitator · Motor current high is a constant on a size-dependent reading', ['library'], () => {
  check(1, '"This scales with the plant. Use a design parameter?" is flagged on tpl_OS_TANK_AG_motor-current-high', !!V.constantFlag('tpl_OS_TANK_AG_motor-current-high', 'minor'));
});
beat(1, 'Activated sludge · DO low: constant rules and a frozen Downstream entry', ['library'], () => {
  const t = V.template('tpl_up_activated-sludge_do-low'); const r0 = t.rules || (t.body && t.body.rules) || {};
  const r = Object.fromEntries(Object.entries(r0).map(([b, x]) => [b, x && x.rule ? x.rule : x]));   /* a rule, or {rule, text, flag} */
  check(1, '"Trigger template · v1", Minor below 2.0 · Major below 1.0 · Emergency below 0.5 mg/L, all constants', (t.v || 1) === 1 && ['minor', 'major', 'emergency'].every((b) => r[b] && r[b].kind === 'const') && r.minor.value === 2 && r.major.value === 1 && r.emergency.value === 0.5, J(r0));
  const ds = V.downstream('tpl_up_activated-sludge_do-low', {});
  check(1, 'Downstream before editing names DO low · AT-2 under Frozen (1 open Issue)', /DO low · AT-2/.test(J(ds.before || ds)) && J(ds.before || ds).includes('a_do_at2') && ds.before.perField.some((f) => (f.frozenText || []).includes('DO low · AT-2 (1 open Issue)')), J(ds.before).slice(0, 300));
});

/* ════════ Chapter 2 · A new plant from the survey (DigitalPaani) ════════ */
beat(2, 'Readiness, the Structure track and the blockers at the start', ['structure'], () => {
  check(2, '"Plant graph built · 66 pieces of equipment · 38 sensors"', step(DP, 'structure', 'graph').text === '66 pieces of equipment · 38 sensors', step(DP, 'structure', 'graph').text);
  check(2, '"Identification run · 21 of them are unit processes · 11 control groups"', step(DP, 'structure', 'ident').text === '21 of them are unit processes · 11 control groups', step(DP, 'structure', 'ident').text);
  check(2, '"Structure pass · 76 to review · 20 unclassified"', step(DP, 'structure', 'pass').text === '76 to review · 20 unclassified' && step(DP, 'structure', 'pass').mark === 'current');
  const b = V.checklist(DP).blockers.find((x) => x.id === 'unclassified');
  check(2, 'blocker "20 pieces of equipment are unclassified: RFP-1, RFP-2, FFP-1 and 17 more"', b && b.text === '20 pieces of equipment are unclassified: RFP-1, RFP-2, FFP-1 and 17 more', b && b.text);
});
beat(2, 'the structure pass: chips, the first unit process, a changed type, accept all', ['structure'], () => {
  const sp = V.structurePass(DP); const g = sp.groups.find((x) => x.upId);
  check(2, 'chips "All 76 · Unclassified 20 · Shared 15 · Control groups 11"', sp.counts.all === 76 && sp.counts.unclassified === 20 && sp.counts.shared === 15 && sp.counts.cgs === 11, J(sp.counts));
  check(2, 'first unit-process group "SC · Collection sump (Proposed)", why "Nothing upstream but the plant inlet"', g.title === 'SC · Collection sump' && g.stateLabel === 'Proposed' && g.why === 'Nothing upstream but the plant inlet', `${g.title} · ${g.stateLabel} · ${g.why}`);
  check(2, 'Change type on SC: "Drawn in the plant graph as Screen Chamber Tank; stored in the survey as Open Skeleton Tank."', V.unitProcess(DP, nodeId(DP, 'SC')).drawnFact === 'Drawn in the plant graph as Screen Chamber Tank; stored in the survey as Open Skeleton Tank.', V.unitProcess(DP, nodeId(DP, 'SC')).drawnFact);
  const ct = V.changeUpType(DP, nodeId(DP, 'SC'), 'screening', {}); const lines = (ct.preview && ct.preview.lines) || [];
  check(2, 'Change type SC → Screening: the consequence lines, then "SC is now Screening"', ct.ok && lines[0] === 'Screening brings 14 Task templates and 6 Issue types; 1 Trigger template needs a sensor SC doesn\'t have (H2S).' && lines[1] === 'Collection sump brings 1 Task template; 4 Trigger templates need sensors SC doesn\'t have.' && lines[2] === 'About 28.8 more Tasks a day once Live.' && ct.toast === 'SC is now Screening', lines.join(' | '));
  check(2, 'the primary button counts "Accept all 55 that are proposed"', V.structurePass(DP).counts.proposed === 55);
  const as = V.acceptStructure(DP, { all: true });
  check(2, 'Accept all → "Accepted 55"; 20 left, all unclassified', as.ok && as.toast === 'Accepted 55' && V.structurePass(DP).counts.unclassified === 20 && V.structurePass(DP).counts.toReview === 20, as.toast);
  check(2, 'one control group over both UF trains, accepted in bulk: UF Backwash Pumps with UFBP-1, UFBP-2, UFBP-3, UFBP-4', /UF Backwash Pumps\W+UFBP-1, UFBP-2, UFBP-3, UFBP-4/.test(J(V.structurePass(DP))));
});
beat(2, 'placing what no rule placed, and finishing the pass', ['structure'], () => {
  const n1 = V.notPart(DP, nodeIds(DP, 'ITP-1', 'ITP-2', 'FWTP-1', 'FWTP-2'), {});
  check(2, 'ITP-1, ITP-2, FWTP-1, FWTP-2 not part of any unit process → 16 left', n1.ok && V.structurePass(DP).counts.unclassified === 16);
  const p1 = V.place(DP, nodeIds(DP, 'UFFP-1', 'UFFP-2', 'UFBV-1'), [nodeId(DP, 'UF-1')], {}); const pl = (p1.preview && p1.preview.lines) || [];
  check(2, 'UFFP-1, UFFP-2, UFBV-1 into UF-1: "Criticality tier for UFFP-1: B → A · … UFFP-2: B → A · … UFBV-1: C → A" → 13 left', p1.ok && ['Criticality tier for UFFP-1: B → A', 'Criticality tier for UFFP-2: B → A', 'Criticality tier for UFBV-1: C → A'].every((x) => pl.includes(x)) && V.structurePass(DP).counts.unclassified === 13, pl.join(' · '));
  V.place(DP, nodeIds(DP, 'UFFP-3', 'UFFP-4', 'UFBV-2'), [nodeId(DP, 'UF-2')], {}); V.place(DP, nodeIds(DP, 'RFP-1', 'RFP-2'), nodeIds(DP, 'MBBR-1', 'MBBR-4'), {});
  V.place(DP, nodeIds(DP, 'FFP-1', 'FFP-2'), [nodeId(DP, 'MGF')], {}); V.place(DP, nodeIds(DP, 'SPFP-1', 'SPFP-2'), [nodeId(DP, 'SLP')], {});
  const last = V.notPart(DP, nodeIds(DP, 'PDT', 'PDP', 'SCP-1', 'SCP-2'), {});
  check(2, 'the last decision: "Structure confirmed: 21 unit processes, 11 control groups. The bindings pass is open"', last.ok && last.confirmed && last.toast === 'Structure confirmed: 21 unit processes, 11 control groups. The bindings pass is open' && V.structureDone(DP), last.toast);
  check(2, 'the Structure track: "Confirmed Thu 29 Oct, 09:00 · 12 placed by hand · 1 type changed · 8 not part of any unit process"', step(DP, 'structure', 'pass').text === 'Confirmed Thu 29 Oct, 09:00 · 12 placed by hand · 1 type changed · 8 not part of any unit process' && step(DP, 'structure', 'pass').mark === 'done', step(DP, 'structure', 'pass').text);
  check(2, 'no unclassified blocker is left', !V.checklist(DP).blockers.some((b) => b.id === 'unclassified'));
});
beat(2, 'membership on the drawing (optional, read only here)', ['structure'], () => {
  const d = V.drawing(DP);
  check(2, 'the drawing has every plant-graph node, 21 of them unit processes', d && d.nodes.length === 66 && d.nodes.filter((n) => n.kind === 'up').length === 21);
  const tags = (V.unitProcess(DP, nodeId(DP, 'MBBR-1')).participants || []).map((p) => p.tag);
  check(2, 'MBBR-1 outlines MBBRAB-1/2/3, SRCP-1, SRCP-2 and RFP-1', ['MBBRAB-1', 'MBBRAB-2', 'MBBRAB-3', 'SRCP-1', 'SRCP-2', 'RFP-1'].every((t) => tags.includes(t)), tags.join(', '));
  const ts1 = nodeId(DP, 'TS-1');
  check(2, 'TS-1 has no participants', (V.unitProcess(DP, ts1).participants || []).length === 0);
  const em = __.dryRun(DP, () => V.editMembers(DP, ['SRCP-1', 'SRCP-2'].map((t) => ({ op: 'add', upId: ts1, eqId: nodeId(DP, t) })), {}));
  check(2, 'adding SRCP-1 and SRCP-2 to TS-1: "No Trigger depends on this · criticality tiers unchanged" → "Saved · SRCP-1, SRCP-2 added to TS-1" (in a dry run)', em.ok && em.preview && em.preview.text === 'No Trigger depends on this · criticality tiers unchanged' && em.toast === 'Saved · SRCP-1, SRCP-2 added to TS-1' && !!em.token, `${em.preview && em.preview.text} · ${em.toast || em.error}`);
});

/* ════════ Chapter 3 · The bindings pass (DigitalPaani) ════════ */
let bulkN = 0, bulkT = 0;
beat(3, 'the bindings pass opens with its filters and bulk bar', ['structure'], () => {
  const bp = V.bindingsPass(DP); const c = bp.counts;
  check(3, 'open since chapter 2; "All {a} · Undecided {u} · Can\'t resolve {c} · Needs equipment or sensors {n}" add up', bp.open && c.all === c.undecided + c.drafts + c.active + c.inactive + c.rejected + c.cantResolve + c.needs && c.undecided > 0 && c.needs > 0, J(c));
  check(3, 'bulk "Accept {k} as drafts" · "Accept {k} and start trial", k = the undecided resolvable rows', bp.bulk.count === c.undecided && bp.bulk.draftsLabel === `Accept ${c.undecided} as drafts` && bp.bulk.activateLabel === `Accept ${c.undecided} and start trial`);
  check(3, 'next-phase templates sit apart, in the Needs list', bp.needs.some((n) => n.nextPhase) && !bp.groups.some((g) => g.items.some((r) => r.nextPhase)));
  if (HAS.library) check(3, 'Can\'t resolve 3 (CCT, TWT, UFWT), each "Can\'t resolve: needs tank height ({tag})"', c.cantResolve === 3 && J(V.bindingsPass(DP, { show: 'cantresolve' }).rows.map((r) => r.cantResolve && r.cantResolve.text).sort()) === J(['needs tank height (CCT)', 'needs tank height (TWT)', 'needs tank height (UFWT)']), J(V.bindingsPass(DP, { show: 'cantresolve' }).rows.map((r) => r.cantResolve)));
  if (HAS.library) check(3, 'the bulk bar says "The counts leave out the 3 that can\'t resolve."', bp.bulk.note === 'The counts leave out the 3 that can\'t resolve.');
});
beat(3, 'a Level high row with derived values', ['structure', 'library'], () => {
  const r = V.bindingsPass(DP).rows.find((x) => x.line === 'Level high · Issue → EQTT-2') || {}; const t = J(r.values);
  check(3, '"Level high · Issue → EQTT-2 · reads LVL-EQTT-2": "Caution > 85% (3.4 m) · Major > 95% (3.8 m)", "Derived · 85% of tank height (4.0 m)", "Persistence 5 min (Library)"', r.readsText === 'reads LVL-EQTT-2' && t.includes('Caution > 85% (3.4 m)') && t.includes('Major > 95% (3.8 m)') && t.includes('Derived · 85% of tank height (4.0 m)') && r.values.some((v) => v.text === 'Persistence 5 min' && /^Library/.test(v.source || '')), t.slice(0, 400));
});
beat(3, 'Add parameter on CCT', ['structure', 'library'], () => {
  const ref = { kind: 'up', id: nodeId(DP, 'CCT') }; const pv = V.designParamPreview(DP, ref, 'tankHeight', 3.5);
  check(3, 'the preview "LVL-CCT: Caution none → 85% (3.0 m) · Major none → 95% (3.3 m) · 1 gap resolved"', J(pv).includes('LVL-CCT: Caution none → 85% (3.0 m) · Major none → 95% (3.3 m) · 1 gap resolved'), J(pv).slice(0, 300));
  const r = V.setDesignParam(DP, ref, 'tankHeight', 3.5, {});
  check(3, 'Save: "Tank height 3.5 m saved on CCT · 1 reading re-resolved"; Can\'t resolve 2', r.ok && /^Tank height 3\.5 m saved on CCT · 1 reading re-resolved/.test(r.toast || '') && V.bindingsPass(DP).counts.cantResolve === 2, r.toast || r.error);
});
beat(3, 'Accept and start the trial', ['structure'], () => {
  const before = V.bindingsPass(DP).counts; const r = V.acceptAllFor(DP, { status: 'undecided' }, { activate: true }); bulkN = r.count; bulkT = r.alerts;
  check(3, `the toast "Accepted {k} and started the trial: {t} Triggers now record trial firings. Commissioning · nothing is sent."`, r.ok && r.count === before.undecided && r.toast === `Accepted ${r.count} and started the trial: ${r.alerts} Trigger${r.alerts === 1 ? '' : 's'} now record${r.alerts === 1 ? 's' : ''} trial firings. Commissioning · nothing is sent.`, r.toast);
  check(3, 'the accepted Trigger rows read "Active · trial"', V.bindingsPass(DP).rows.filter((x) => x.outcome === 'issue' && x.status === 'active').length === r.alerts && V.bindingsPass(DP).rows.filter((x) => x.outcome === 'issue' && x.status === 'active').every((x) => x.statusLabel === 'Active · trial'));
  if (HAS.library) { const g = V.checklist(DP).gaps.find((x) => x.id === 'nolimits'); check(3, 'Readiness gap "2 readings have no limits: they raise nothing (tank height missing on TWT, UFWT)"', g && g.text === '2 readings have no limits: they raise nothing (tank height missing on TWT, UFWT)', g && g.text); }
});

/* ════════ Chapter 4 · Readiness (DigitalPaani) ════════ */
beat(4, 'Readiness with the trial minutes old and nobody on the roster', ['structure'], () => {
  const cl = V.checklist(DP); const ids = cl.blockers.map((b) => b.id); const cr = V.bindingsPass(DP).counts.cantResolve;
  check(4, 'blockers: no Operator, no Lead, and the drafts that can\'t resolve ("2 drafts are undecided" with the library file)', ids.slice(0, 2).join(',') === 'operator,lead' && (cr ? ids[2] === 'drafts' && cl.blockers[2].count === cr && cl.blockers[2].text === `${cr} drafts are undecided` : ids.length === 2), cl.blockers.map((b) => b.text).join(' | '));
  check(4, 'the chip "{n} blockers" and the disabled "Go live · {n} blockers left" with "Go live needs Full Admin"', cl.blockersChip.text === `${ids.length} blocker${ids.length === 1 ? '' : 's'}` && cl.buttonLabel === `Go live · ${ids.length} blocker${ids.length === 1 ? '' : 's'} left` && !cl.canGoLive && cl.foot === 'Go live needs Full Admin');
  check(4, 'Structure ✓, Bindings "Day 1 · …", People "! No people yet"', step(DP, 'structure', 'pass').mark === 'done' && /^Day 1 · /.test(step(DP, 'bindings', 'trial').text) && step(DP, 'people', 'roster').text === 'No people yet' && step(DP, 'people', 'roster').mark === 'attention', step(DP, 'bindings', 'trial').text);
  const np = cl.gaps.find((g) => g.id === 'nopm');
  check(4, 'a planning gap for equipment without a maintenance programme, when any is left', !np || np.text === `${np.count} piece${np.count === 1 ? '' : 's'} of equipment without a maintenance programme: a planning gap, not a safety failure`);
});
beat(4, 'people added and verified in the console', [], () => {
  const a = V.addPerson(DP, { name: 'Ravi Kumar', role: 'Operator', phone: '+91 90000 40001', channel: 'WhatsApp' });
  const row = () => V.people(DP).find((p) => p.id === a.id);
  check(4, 'Ravi Kumar, Operator, "+91 90000 40001", WhatsApp → "Not verified"', a.ok && row().verifiedText === 'Not verified');
  V.sendCode(DP, a.id);
  check(4, '"Send code" → "Code sent 09:00 · waiting" and "(sample) Ravi Kumar enters the code"', row().verifiedText === 'Code sent 09:00 · waiting' && row().sampleConfirm === '(sample) Ravi Kumar enters the code');
  V.confirmCode(DP, a.id);
  check(4, '"Verified"; Reachability: "No Lead with a verified phone: nobody would be notified at Lead level. This blocks go-live."', row().verifiedText === 'Verified' && V.reachability(DP).text === 'No Lead with a verified phone: nobody would be notified at Lead level. This blocks go-live.');
  const b = V.addPerson(DP, { name: 'Neha Sharma', role: 'Lead', phone: '+91 90000 40002', channel: 'WhatsApp' }); V.sendCode(DP, b.id); V.confirmCode(DP, b.id);
  check(4, 'Neha Sharma, Lead: "1 Operator and 1 Lead can be reached: their phones are verified."; the two People blockers clear', V.reachability(DP).text === '1 Operator and 1 Lead can be reached: their phones are verified.' && !V.checklist(DP).blockers.some((x) => x.id === 'operator' || x.id === 'lead'));
});
beat(4, 'the drafts that can\'t resolve are left inactive, and Go live is enabled', ['structure'], () => {
  const why = 'No tank height yet: the survey team measures it next week';
  V.bindingsPass(DP, { show: 'cantresolve' }).rows.forEach((r) => { V.decide(DP, r.pid, 'accept', { activate: false }); V.leaveInactive(DP, r.pid, { reason: why }); });
  const cl = V.checklist(DP); const pv = V.goLivePreview(DP);
  check(4, '"0 blockers"; "No blockers. Gaps don\'t stop go-live." with "Go live" enabled', cl.blockers.length === 0 && cl.blockersChip.text === '0 blockers' && cl.readyText === 'No blockers. Gaps don\'t stop go-live.' && cl.canGoLive && cl.buttonLabel === 'Go live', cl.blockers.map((b) => b.text).join(' | '));
  check(4, 'the go-live confirmation reads "Trial: no Trigger fired" (the trial is minutes old); "Not yet" leaves the plant in Commissioning', pv.trial.text === (bulkT ? 'Trial: no Trigger fired' : 'Trial: no Trigger was active') && V.state(DP) === 'commissioning', pv.trial.text);
});

/* ════════ Chapter 5 · Trial and tuning (Vedanta) ════════ */
beat(5, 'the trial banner, the noisy gap and the Triggers by trial firings a day', [], () => {
  const cl = V.checklist(VED);
  check(5, 'banner "Day 6 of trial · 12 Triggers active · 112 trial firings so far · 1 Trigger noisy" with "Review them"', cl.trial.text === 'Day 6 of trial · 12 Triggers active · 112 trial firings so far · 1 Trigger noisy' && cl.trial.linkText === 'Review them', cl.trial.text);
  check(5, 'gap "1 Trigger is noisy in trial: Level high · EQ-1 (12.8 a day)"', cl.gaps.some((g) => g.text === '1 Trigger is noisy in trial: Level high · EQ-1 (12.8 a day)'));
  const tt = V.trialTable(VED);
  check(5, 'sorted by trial firings a day: Level high · EQ-1 12.8 ("Noisy · more than 10 a day"), DO low · SBR-1 5.9, pH low · EQ-1 0.2, others 0', tt[0].name === 'Level high · EQ-1' && tt[0].perDayText === '12.8' && tt[0].chip === 'Noisy · more than 10 a day' && tt[1].name === 'DO low · SBR-1' && tt[1].perDayText === '5.9' && tt[2].name === 'pH low · EQ-1' && tt[2].perDayText === '0.2' && tt.slice(3).every((x) => x.count === 0), tt.slice(0, 3).map((x) => `${x.name} ${x.perDayText}`).join(', '));
});
beat(5, 'the trial cards of Level high · EQ-1 and DO low · SBR-1', [], () => {
  const a = V.trialStats(VED, 'a_3d'); const d = V.trialStats(VED, 'a_3r');
  check(5, '"Fired 76 times in 5.9 days · median 45 min · peak 88%" with the noisy chip; the last row "still past the limit"', a.text === 'Fired 76 times in 5.9 days · median 45 min · peak 88%' && a.noisyChip === 'Noisy · more than 10 a day' && a.rows[a.rows.length - 1].endText === 'still past the limit' && a.banner === 'Commissioning: nothing is sent. Firings below are trials only.', a.text);
  check(5, '"Fired 35 times in 5.9 days · median 30 min · peak 1.58 mg/L", no chip, no "mostly short" anywhere', d.text === 'Fired 35 times in 5.9 days · median 30 min · peak 1.58 mg/L' && d.noisyChip === null && !/mostly ?short/i.test(J(d)) && !/mostly ?short/i.test(J(a)), d.text);
  if (HAS.library) { const tb = V.triggerBands(VED, 'a_3d'); check(5, 'its bands "Follows sensor LVL-EQ-1 · Derived · 85% of tank height (4.5 m)"', J(tb).includes('Follows sensor LVL-EQ-1') && J(tb).includes('Derived · 85% of tank height (4.5 m)'), J(tb).slice(0, 300)); }
});
beat(5, 'five reasons, reason first, on LVL-EQ-1\'s Caution zone', ['ledger'], () => {
  const tgt = { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' };
  check(5, 'the form offers Physical, Regulatory or client, Structural, Tuning, Temporary', J(V.reasonsFor(VED, tgt)) === J(['physical', 'regulatory', 'structural', 'tuning', 'temporary']));
  if (HAS.library || V.physicalPath(VED, tgt).kind === 'param') { const pp = V.physicalPath(VED, tgt); check(5, 'Physical → "Set the design parameter instead?" with "Set the design parameter" and "Override anyway"', pp.text === 'Set the design parameter instead?' && pp.primary === 'Set the design parameter' && pp.secondary === 'Override anyway', J(pp)); }
  const ts = V.trialStats(VED, 'a_3d'); const pl = V.previewLimits(VED, 'v_eq1_LVL', 'above', { ...V.limitsOf(VED, 'v_eq1_LVL', 'above').bands, caution: 87 }, { from: ts.since, to: V.now() });
  const op = V.overridePreview(VED, tgt, 87);
  check(5, '"If you save": "Changes 1 Trigger: Level high · EQ-1." · "Trial so far: would have fired 0 times instead of 76." (n from the replay over the trial, m = the stored firings)', op.lines[0] === 'Changes 1 Trigger: Level high · EQ-1.' && op.lines[1] === `Trial so far: would have fired ${pl.count} times instead of ${ts.count}.` && pl.count === 0 && ts.count === 76, op.lines.join(' | '));
  const r = V.setZone(VED, 'v_eq1_LVL', 'above', 'caution', 87, { reason: 'tuning', note: 'Level swings with the batch pumps; 85% is reached on every fill' });
  const row = V.overrides({ plant: VED }).find((o) => o.target.kind === 'zone' && o.target.sensorId === 'v_eq1_LVL' && o.target.band === 'caution');
  check(5, '[Save override] → chip "Override · Tuning · you · 29 Oct · review by 27 Jan"', r.ok && row && row.chip.text === 'Override · Tuning · you · 29 Oct · review by 27 Jan', row && row.chip.text);
  check(5, 'Readiness: the noisy gap is still there (stored trial firings)', V.trialStats(VED, 'a_3d').count === 76 && V.checklist(VED).gaps.some((g) => g.id === 'noisy'));
});

/* ════════ Chapter 6 · Safety in commissioning (Vedanta) ════════ */
beat(6, 'the pH Emergency is one trial firing; nobody was told; no Issue exists', [], () => {
  const s = V.trialStats(VED, 'a_3f'); const r = s.rows[0] || {};
  check(6, 'trial card "Fired once in 5.9 days · median 60 min · peak pH 3.7" under the Commissioning banner', s.text === 'Fired once in 5.9 days · median 60 min · peak pH 3.7' && s.banner === 'Commissioning: nothing is sent. Firings below are trials only.', s.text);
  check(6, 'one row: "Wed 28 Oct, 15:10" · "Wed 28 Oct, 16:10" · "Emergency" · "pH 3.7" · "60 min" · "Emergency · nobody was told"', s.rows.length === 1 && r.startText === 'Wed 28 Oct, 15:10' && r.endText === 'Wed 28 Oct, 16:10' && r.bandLabel === 'Emergency' && r.peakText === 'pH 3.7' && r.lengthText === '60 min' && r.chip === 'Emergency · nobody was told', J(r));
  check(6, 'no Issue exists at Vedanta', V.issues(VED).length === 0);
  const ro = V.routing(VED); const priya = V.people(VED).find((p) => p.name === 'Priya Nair');
  check(6, 'People › Routing: "Commissioning: nothing is sent. This is who will be told from go-live."; Priya Nair still "Not verified"', ro.banner === 'Commissioning: nothing is sent. This is who will be told from go-live.' && ro.ladder[0].count === 3 && priya.verifiedText === 'Not verified');
});
beat(6, 'the Emergency band\'s chip is the Physical override', ['ledger'], () => {
  const o = V.overrides({ plant: VED }).find((x) => x.target.kind === 'zone' && x.target.sensorId === 'v_eq1_PH' && x.target.band === 'emergency');
  check(6, '"Override · Physical · …" with "Library: no rule"', o && /^Override · Physical · /.test(o.chip.text) && o.chip.small === 'Library: no rule', o && J(o.chip));
});

/* ════════ Chapter 7 · Go live (Vedanta) ════════ */
beat(7, 'one undecided draft blocks', [], () => {
  const cl = V.checklist(VED);
  check(7, '"1 blocker": "1 draft is undecided: MLSS low · SBR-1" [Decide]; "Go live · 1 blocker left" disabled', cl.blockers.length === 1 && cl.blockersChip.text === '1 blocker' && cl.blockers[0].text === '1 draft is undecided: MLSS low · SBR-1' && cl.blockers[0].linkText === 'Decide' && cl.buttonLabel === 'Go live · 1 blocker left' && !cl.canGoLive);
});
beat(7, 'last service dates (optional, read only)', [], () => {
  const sd = V.serviceDates(VED); const bl = sd.rows.find((r) => r.tag === 'BL-1');
  check(7, '"Entered for 4 of 11 pieces of equipment · If you went live now, 51 of 73 scheduled Tasks would fall due on go-live day."', sd.counterText === 'Entered for 4 of 11 pieces of equipment · If you went live now, 51 of 73 scheduled Tasks would fall due on go-live day.', sd.counterText);
  check(7, 'BL-1: "9" PM Tasks, "Mon 19 Oct", "1 on go-live day, 8 later · earliest Fri 13 Nov"', bl.pmTasks === 9 && bl.dateText === 'Mon 19 Oct' && bl.preview.text === '1 on go-live day, 8 later · earliest Fri 13 Nov');
});
beat(7, 'Decide → "Accept 1 and start trial"', [], () => {
  const und = V.bindingsPass(VED, { show: 'undecided' }); const r = und.rows[0] || {};
  check(7, 'row "MLSS low · Issue → SBR-1 · reads MLSS-SBR-1 | Minor < 2,000 mg/L (Library) · Persistence 5 min (Library) | Undecided"', und.counts.undecided === 1 && r.line === 'MLSS low · Issue → SBR-1' && r.readsText === 'reads MLSS-SBR-1' && r.values.some((v) => v.text === 'Minor < 2,000 mg/L' && /^Library/.test(v.source || '')) && r.values.some((v) => v.text === 'Persistence 5 min' && /^Library/.test(v.source || '')) && r.statusLabel === 'Undecided', J(r.values));
  const ac = V.acceptAllFor(VED, { status: 'undecided' }, { activate: true });
  check(7, 'toast "Accepted 1 and started the trial: 1 Trigger now records trial firings. Commissioning · nothing is sent."; the row "Active · trial"', ac.toast === 'Accepted 1 and started the trial: 1 Trigger now records trial firings. Commissioning · nothing is sent.' && V.bindingsPass(VED).rows.find((x) => x.pid === 'v_sbr|alert|MLSS low').statusLabel === 'Active · trial', ac.toast);
  const cl = V.checklist(VED);
  check(7, 'Readiness: "0 blockers", banner "Day 6 of trial · 13 Triggers active · 112 trial firings so far · 1 Trigger noisy"', cl.blockers.length === 0 && cl.blockersChip.text === '0 blockers' && cl.trial.text === 'Day 6 of trial · 13 Triggers active · 112 trial firings so far · 1 Trigger noisy' && cl.canGoLive, cl.trial.text);
});
beat(7, 'the go-live confirmation, loudest first, and going live', [], () => {
  const pv = V.goLivePreview(VED); const g = V.goLiveTasks(VED);
  check(7, '"Go live: Vedanta ETP" · "From now on:" and the four lines in order, the first loud', pv.title === 'Go live: Vedanta ETP' && pv.head === 'From now on:' && pv.lines.map((l) => l.text).join(' | ') === 'Triggers create Issues and notify the plant\'s people, including Emergency calls and the hooter | Scheduled Tasks start. First due dates come from the service dates you entered, otherwise today. | Metrics and PM compliance start counting today | Changing structure will need a reason' && pv.lines[0].loud);
  check(7, 'the Tasks sub-line "51 of 73 scheduled Tasks fall due today. Service dates were entered for 4 of 11 pieces of equipment; 22 Tasks count from them. After today, about 59 Tasks a day." (= the go-live rows)', pv.lines[1].sub === '51 of 73 scheduled Tasks fall due today. Service dates were entered for 4 of 11 pieces of equipment; 22 Tasks count from them. After today, about 59 Tasks a day.' && g.dueToday === 51 && g.scheduled === 73 && g.fromDates === 22 && Math.round(V.tasksPerDay(VED)) === 59, pv.lines[1].sub);
  check(7, '"Trial: 3 Triggers fired · 1 fired more than 10 times a day · Review them"', pv.trial.text === 'Trial: 3 Triggers fired · 1 fired more than 10 times a day' && pv.trial.linkText === 'Review them');
  check(7, '"{g} gaps remain · …" with g = the checklist\'s gaps', pv.gapsText === `${pv.gaps.length} gaps remain · ${pv.gaps.map((x) => x.short).join(' · ')}` && pv.gaps.length === V.checklist(VED).gaps.length && pv.gaps.length === 3, pv.gapsText);
  const r = V.goLive(VED); const cv = V.coverage(VED);
  check(7, 'toast "Vedanta ETP is Live. Issues and notifications started at 09:00."; home is Coverage; "Live since" now', r.ok && r.toast === 'Vedanta ETP is Live. Issues and notifications started at 09:00.' && V.state(VED) === 'live' && V.plant(VED).since === V.now(), r.toast || r.error);
  check(7, 'Coverage: "Issues since go-live" 0, Active 13; Activity "Went live: 13 Triggers now create Issues …"', cv.window.label === 'Issues since go-live' && cv.triggers.issues === 0 && cv.triggers.active === 13 && /^Went live: 13 Triggers now create Issues/.test(latest(VED)), latest(VED));
});

/* ════════ Chapter 8 · Live operation (Manesar) ════════ */
beat(8, 'the open Issue on AT-2', [], () => {
  const it = V.issueTerms(MAN, 'is_2z'); const iss = V.issue(MAN, 'is_2z');
  check(8, '"Opened under: Major < 1.0 mg/L · persistence 0 min · clearing 15 min"; question 1 answered Yes by Dheeraj Kumar at 07:50', it.text === 'Opened under: Major < 1.0 mg/L · persistence 0 min · clearing 15 min' && iss.diag.path[0].answer === 'Yes' && iss.diag.path[0].by === 'Dheeraj Kumar' && V.fmt(iss.diag.path[0].at) === 'Thu 29 Oct, 07:50', it.text);
  if (HAS.structure) check(8, 'its subject is the unit process AT-2', iss.subject && iss.subject.kind === 'up' && iss.subject.id === 'at2', J(iss.subject));
  if (HAS.library) check(8, 'the Trigger is frozen while the Issue is open', V.isFrozen(MAN, 'a_do_at2') && V.heldOf(MAN, 'a_do_at2').frozen);
});
beat(8, 'diagnosis to BL-1 and the fix', ['structure'], () => {
  const q = V.diagStep(MAN, 'is_2z'); const r = V.answer(MAN, 'is_2z', q.id, 'No'); const iss = V.issue(MAN, 'is_2z');
  check(8, 'question 2 No → root cause "Intake filter blocked" on BL-1: "Caused by BL-1 (Blower; takes part in AT-2)"', r.ok && iss.causedBy === 'bl1' && iss.log.some((l) => l.text === 'Caused by BL-1 (Blower; takes part in AT-2)') && /Intake filter blocked/.test(J(iss.log)), iss.log.slice(-3).map((l) => l.text).join(' | '));
  const sf = V.startFix(MAN, 'is_2z');
  check(8, 'Start the fix: the Issue is being fixed', sf.ok && ['fixing', 'verifying'].includes(V.issue(MAN, 'is_2z').status));
});
beat(8, 'a zone override on DO-AT2 while the Trigger is frozen', ['ledger'], () => {
  const tgt = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' };
  const pl = V.previewLimits(MAN, 'at2_do', 'below', { ...V.limitsOf(MAN, 'at2_do', 'below').bands, minor: 1.5 }); const op = V.overridePreview(MAN, tgt, 1.5);
  check(8, '"Last 7 days: would have fired 2 times (now 3)." (= previewLimits)', op.lines.includes(`Last 7 days: would have fired ${pl.count} times (now ${pl.countNow}).`) && pl.count === 2 && pl.countNow === 3, op.lines.join(' | '));
  if (HAS.library || op.frozenLines.length) check(8, '"Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved)." and the frozen line with "Close it as a false alarm"', op.lines[0] === 'Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved).' && op.frozenLines[0].text === 'DO low · AT-2 has 1 open Issue: it is frozen and keeps 2.0. It will show Base moved until someone resyncs it.' && op.frozenLines[0].linkText === 'Close it as a false alarm', J(op.frozenLines));
  const r = V.setZone(MAN, 'at2_do', 'below', 'minor', 1.5, { reason: 'tuning', note: 'Short dips below 2.0 recover on their own; 1.5 is where the operators act' });
  check(8, '[Save override]: DO-AT2 now 1.5 (Override · Tuning)', r.ok && V.limitsOf(MAN, 'at2_do', 'below').bands.minor === 1.5, r.error);
  if (HAS.library) check(8, 'the Trigger keeps 2.0 while frozen', V.triggerTerms(MAN, 'a_do_at2').bands.minor === 2);
  if (HAS.library) { const m = V.triggerBands(MAN, 'a_do_at2').bands.minor; check(8, 'Trigger page: Minor still 2.0 with "Frozen while 1 Issue is open" and "DO-AT2 now 1.5 (Override · Tuning)"', m.valueText === '2.0 mg/L' && m.overlayText === 'Frozen while 1 Issue is open' && m.nowText === 'DO-AT2 now 1.5 (Override · Tuning)', J({ v: m.valueText, o: m.overlayText, n: m.nowText })); }
});
beat(8, '+1 hour, Verify, closed', [], () => {
  V.advance(60); const v = V.verify(MAN, 'is_2z', true);
  check(8, 'Verify "Yes" closes the Issue at Thu 29 Oct, 10:00', v.ok && V.issue(MAN, 'is_2z').status === 'closed' && V.fmt(V.now()) === 'Thu 29 Oct, 10:00');
  if (HAS.library) check(8, 'the Trigger waits for a resync (its terms moved while it was frozen)', V.heldOf(MAN, 'a_do_at2').waiting && !V.heldOf(MAN, 'a_do_at2').frozen);
  if (HAS.library) { const m = V.triggerBands(MAN, 'a_do_at2').bands.minor; check(8, 'Minor shows "Base moved · waits for a resync" with "Resync with the sensor" next', m.valueText === '2.0 mg/L' && m.overlayText === 'Base moved · waits for a resync', m.overlayText); }
});
beat(8, 'a structure change on a Live plant (optional; in a dry run)', ['structure'], () => {
  const r = __.dryRun(MAN, () => { const a = V.place(MAN, ['bs1'], ['eq1'], {}); const b = V.place(MAN, ['bs1'], ['eq1'], { note: 'The screen sits in EQ-1\'s inlet channel' }); const f = V.structureFlag(MAN, 'a_flood'); return { a, b, f }; });
  check(8, '"Give a reason: this plant is Live." without a reason; with one, BS-1 is placed and Sump flooding · EQ-1 is flagged "Structure changed …"', !r.a.ok && r.a.error === 'Give a reason: this plant is Live.' && r.b.ok && r.f && /Structure changed/.test(J(r.f)), J(r.f).slice(0, 200));
  check(8, 'preview "1 Trigger re-checked: Sump flooding · EQ-1"; toast "BS-1 placed in EQ-1"; the flag "Structure changed {when}: BS-1 placed in EQ-1. Nothing in this Trigger\'s terms changed."', r.b.preview && /^1 Trigger re-checked: Sump flooding · EQ-1\b/.test(r.b.preview.text) && r.b.toast === 'BS-1 placed in EQ-1' && !!r.b.token && r.f.line === `Structure changed ${V.fmt(V.now())}: BS-1 placed in EQ-1. Nothing in this Trigger's terms changed.`, `${r.b.preview && r.b.preview.text} · ${r.b.toast} · ${r.f.line}`);
});

/* ════════ Chapter 9 · Coverage (Manesar, Bawal) ════════ */
beat(9, 'Manesar\'s Coverage', [], () => {
  const cv = V.coverage(MAN); const t = cv.triggers;
  check(9, 'Triggers: Active 6, "Issues, last 7 days", "Closed as false alarm" with "{a} of {b} closed", Noisiest DO low · AT-2', t.active === 6 && cv.window.label === 'Issues, last 7 days' && t.issues === 3 && t.closedText === `${t.falseAlarms} of ${t.closed} closed` && t.falseAlarmText === `${Math.round((t.falseAlarms / t.closed) * 100)}%` && t.noisiest.name === 'DO low · AT-2', J(t));
  check(9, '"Drafts in the review queue: 80" with "Open the bindings pass"', t.draftsText === 'Drafts in the review queue: 80' && t.draftsLinkText === 'Open the bindings pass');
  check(9, 'Blind spots "Arrives with Diagnostics: what must be known per unit process, how often, and what isn\'t covered."; gaps "4 pieces of equipment without a maintenance programme"', cv.blindSpots.text === 'Arrives with Diagnostics: what must be known per unit process, how often, and what isn\'t covered.' && cv.gaps.map((g) => g.text).join(' | ') === '4 pieces of equipment without a maintenance programme');
  if (HAS.ledger) { const dc = V.deviations({ plant: MAN }).counts; check(9, 'Deviations here: Overrides · Base moved · Past review equal the ledger', cv.deviations.overrides === dc.overrides && cv.deviations.baseMoved === dc.basemoved && cv.deviations.pastReview === dc.pastreview); }
});
beat(9, 'a draft on a Live plant, and Activate without a trial', [], () => {
  const r = V.decide(MAN, 'eq1|alert|Level high', 'accept', { activate: false }); const row = V.bindingsPass(MAN).rows.find((x) => x.pid === 'eq1|alert|Level high');
  check(9, 'row "Level high · Issue → EQ-1 · reads LVL-EQ1" → Accept → "Draft · never fires"', r.ok && row.line === 'Level high · Issue → EQ-1' && row.readsText === 'reads LVL-EQ1' && row.statusLabel === 'Draft · never fires', `${row.line} · ${row.readsText} · ${row.statusLabel}`);
  const ap = V.activatePreview(MAN, r.alertId);
  check(9, 'Activate: "Activate Level high · EQ-1?", "… creates Issues and notifies the plant\'s people …", "It gets no trial first: a Live plant has none. …", the band lines', ap.title === 'Activate Level high · EQ-1?' && ap.lines[0] === 'Manesar STP is Live. From now on this Trigger creates Issues and notifies the plant\'s people, including Emergency calls and the hooter.' && ap.lines[1] === 'It gets no trial first: a Live plant has none. To see trial firings before anyone is told, the whole plant returns to Commissioning.' && ap.bandLines.length > 0 && !J(ap).includes('would have fired'), J(ap.bandLines));
  check(9, '"Not yet": it stays a draft', V.alertState(MAN, r.alertId) === 'draft');
});
beat(9, 'Return to Commissioning…, read and left', [], () => {
  const rp = V.returnPreview(MAN); const up = V.tasks(MAN).filter((x) => x.status === 'upcoming'); const soon = up.filter((x) => x.due <= V.now() + 7 * DAY).length; const open = V.tasks(MAN).filter((x) => x.status === 'due' || x.status === 'doing').length;
  check(9, '"6 active Triggers record trial firings only, at every severity, Emergencies included. …" first and loud', rp.lines[0].loud && rp.lines[0].text === '6 active Triggers record trial firings only, at every severity, Emergencies included. Nobody is told: no Issues, no WhatsApp, no calls, no hooter.');
  check(9, 'the open-Issue line only when one is open (DO low · AT-2 closed in chapter 8)', rp.openIssues.length === 0 && !rp.lines.some((l) => /open Issue/.test(l.text)));
  check(9, '"Scheduled Tasks stop: {n} upcoming Tasks won\'t come due ({m} were due in the next 7 days)." (computed)', rp.lines.some((l) => l.text.startsWith(`Scheduled Tasks stop: ${up.length} upcoming Task${up.length === 1 ? '' : 's'} won't come due (${soon} ${soon === 1 ? 'was' : 'were'} due in the next 7 days).${open ? ` ${open === 1 ? '1 Task already due stays open' : `${open} Tasks already due stay open`}.` : ''}`)), rp.lines.map((l) => l.text).join(' | '));
  check(9, '"To go live again, every draft must be decided: 80 are waiting." (loud); "Not yet" leaves Manesar Live', rp.lines.some((l) => l.loud && l.text === 'To go live again, every draft must be decided: 80 are waiting.') && V.state(MAN) === 'live');
});
beat(9, 'the Readings tab on Live plants only', ['library'], () => {
  check(9, 'readingsTab: available at Manesar, not at DigitalPaani (Commissioning)', V.readingsTab(MAN).available === true && V.readingsTab(DP).available === false);
});
beat(9, 'Bawal', [], () => {
  const cv = V.coverage(BAW);
  check(9, 'gap "1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1"', cv.gaps.length === 1 && cv.gaps[0].text === '1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1');
});

/* ════════ Chapter 10 · A library change ════════ */
beat(10, 'MLSS low: Minor 2,000 → 2,200 mg/L', ['library'], () => {
  const id = 'tpl_up_activated-sludge_mlss-low'; const allBefore = V.activity({}).filter((a) => !a.plant).length; const manBefore = nAct(MAN);
  const e = V.editTemplate(id, { band: 'minor', rule: { kind: 'const', value: 2200 } }); const dr = V.templateDraft(id); const ds = V.downstream(id, { kind: 'minor' });
  check(10, 'the draft suggests Minor (allowed Minor, Major); Downstream: 1 plant will update, 1 base moved, 0 clears, 0 pinned, 0 frozen', e.ok && dr.suggestedKind === 'minor' && J(dr.allowedKinds) === J(['minor', 'major']) && ds.totals.update === 1 && ds.totals.baseMoved === 1 && ds.totals.clears === 0 && ds.totals.pinned === 0 && ds.totals.frozen === 0, J(ds.totals));
  const f0 = (ds.fields || [])[0] || { groups: [] }; const grp = (head) => f0.groups.find((g) => g.head === head) || { items: [] }; const items = (g) => g.items.map((x) => x.text || x);
  check(10, 'Downstream: "Minor below: 2,000 → 2,200 mg/L"; "1 plant will update" → "Manesar STP · MLSS-AT2: 2,000 → 2,200 mg/L"; "1 plant will show base moved" → "Manesar STP · MLSS-AT1 keeps 2,500 (Override · Migrated)"; "0 pinned · hold at v1"',
    f0.heading === 'Minor below: 2,000 → 2,200 mg/L' && J(items(grp('1 plant will update'))) === J(['Manesar STP · MLSS-AT2: 2,000 → 2,200 mg/L']) && J(items(grp('1 plant will show base moved'))) === J(['Manesar STP · MLSS-AT1 keeps 2,500 (Override · Migrated)']) && f0.groups.some((g) => g.head === '0 pinned · hold at v1'), J(f0).slice(0, 400));
  check(10, '"Resolves to 2,200 mg/L at every plant (a constant)"; "A plant appears twice when its instances differ."; "Version: Minor (suggested)", Patch refused; "Publish v2 to 1 plant"',
    (ds.resolves || []).some((r) => r.text === 'Resolves to 2,200 mg/L at every plant (a constant)') && ds.lines.includes('A plant appears twice when its instances differ.') && ds.versionText === 'Version: Minor (suggested)' && !dr.allowedKinds.includes('patch') && ds.publishLabel === 'Publish v2 to 1 plant', `${ds.versionText} · ${ds.publishLabel}`);
  const pb = V.publishTemplate(id, { kind: 'minor', note: 'Plants run well down to 2,200; 2,000 opened Issues too late' });
  check(10, 'toast "Published MLSS low v2 to 1 plant · 1 base moved"', pb.toast === 'Published MLSS low v2 to 1 plant · 1 base moved', pb.toast);
  check(10, 'Publish → v2; one All Plants Activity line; nothing in Manesar\'s Activity', pb.ok && (pb.v === 2 || V.tplVersion(id) === 2) && V.activity({}).filter((a) => !a.plant).length === allBefore + 1 && /^Published MLSS low v2 \(Minor\)/.test(V.activity({ limit: 1 })[0].text) && nAct(MAN) === manBefore, pb.error || V.activity({ limit: 1 })[0].text);
  if (HAS.ledger) { const o = V.S.overrides.find((x) => x.plant === MAN && x.target.kind === 'zone' && x.target.sensorId === 'at1_mlss' && x.target.band === 'minor'); const c = V.zoneInfo(MAN, 'at1_mlss', 'below').perBand.minor.chip; check(10, 'MLSS-AT1 Minor shows Base moved: "Library changed 2,000 → 2,200 since you overrode it"', o && V.ovState(o) === 'basemoved' && c.text === 'Base moved' && c.sub === 'Library changed 2,000 → 2,200 since you overrode it', o && `${V.ovState(o)} · ${J(c)}`); }
});
beat(10, 'a Forced try on DO low (read, then discarded)', ['library'], () => {
  const id = 'tpl_up_activated-sludge_do-low'; V.editTemplate(id, { band: 'emergency', rule: { kind: 'const', value: 0.8 } }); const dr = V.templateDraft(id); const ds = V.downstream(id, { kind: 'forced' });
  check(10, '"Version: Forced (suggested)" is the only choice; Downstream reaches Manesar and suspends DO-AT1\'s override', dr.suggestedKind === 'forced' && J(dr.allowedKinds) === J(['forced']) && ds.totals.suspended >= 1, J(ds.totals));
  const fg = ((ds.fields || [])[0] || { groups: [] }).groups; const it = (head) => ((fg.find((g) => g.head === head) || { items: [] }).items || []).map((x) => x.text || x);
  check(10, 'the Issue closed in chapter 8, so the held Trigger is reached: "Manesar STP · DO-AT2: 0.5 → 0.8 mg/L" and "Manesar STP · DO low · AT-2: Emergency 0.5 → 0.8 mg/L · its other terms still wait for a resync"; no frozen group',
    J(it('1 plant will update')) === J(['Manesar STP · DO-AT2: 0.5 → 0.8 mg/L', 'Manesar STP · DO low · AT-2: Emergency 0.5 → 0.8 mg/L · its other terms still wait for a resync']) && !fg.some((g) => /frozen/.test(g.head)), J(fg).slice(0, 400));
  check(10, '"1 override suspended: kept, not applied; they return when lifted" → "Manesar STP · DO-AT1"; "Plant admins are told at Manesar STP."; a reason is required; "Publish v2 to 1 plant"',
    J(it('1 override suspended: kept, not applied; they return when lifted')) === J(['Manesar STP · DO-AT1']) && ds.lines.includes('Plant admins are told at Manesar STP.') && ds.needsReason === true && ds.versionText === 'Version: Forced (suggested)' && ds.publishLabel === 'Publish v2 to 1 plant', ds.lines.join(' | '));
  V.discardTemplateDraft(id);
  check(10, '[Discard draft] leaves DO low at v1', !V.templateDraft(id) && (V.tplVersion(id) || 1) === 1);
});
beat(10, 'a cadence change previews where counting starts (optional)', [], () => {
  const c = V.cadenceDueNow('tpl_BLW_bearing-service', { n: 3, unit: 'month' }, 'service'); const n = c.plants.reduce((s, p) => s + p.tasks.filter((x) => x.dueNow).length, 0);
  check(10, '"{n} Tasks become due now across {p} plants" and the two count-from choices, computed', c.dueNow === n && c.text === `${n} Task${n === 1 ? '' : 's'} become${n === 1 ? 's' : ''} due now across ${c.plantsWithDueNow} plant${c.plantsWithDueNow === 1 ? '' : 's'}` && /^Count from the last service: \d+ due now$/.test(c.labels.service) && c.labels.publish === 'Count from the publish date: first due in 3 months', `${c.text} · ${J(c.labels)}`);
});
beat(10, 'Resync DO low · AT-2', ['library'], () => {
  const rp = V.resyncPreview(MAN, 'a_do_at2'); const r = V.resync(MAN, 'a_do_at2');
  check(10, '"Last 7 days with these terms: would have fired 2 times (now 3)." then [Resync]: it follows DO-AT2 again', rp.ok && rp.lastDays && rp.lastDays.count === 2 && rp.lastDays.countNow === 3 && J(rp.diffs).includes('1.5') && r.ok && !V.heldOf(MAN, 'a_do_at2').waiting && V.triggerTerms(MAN, 'a_do_at2').bands.minor === 1.5, J(rp).slice(0, 300));
  check(10, 'modal "Resync DO low · AT-2?" with "Minor below 2.0 → 1.5 mg/L (Override · Tuning)" and "Last 7 days with these terms: would have fired 2 times (now 3)."; toast "Resynced DO low · AT-2 · now follows DO-AT2"', rp.title === 'Resync DO low · AT-2?' && rp.lines.includes('Minor below 2.0 → 1.5 mg/L (Override · Tuning)') && rp.lastDaysText === 'Last 7 days with these terms: would have fired 2 times (now 3).' && r.toast === 'Resynced DO low · AT-2 · now follows DO-AT2', `${rp.title} · ${r.toast}`);
});
beat(10, 'a design parameter moves a derived base (optional; preview only)', ['library'], () => {
  const ref = { kind: 'eq', id: 'bl1' }; const pk = (V.designParams(MAN, ref).find((x) => x.label === 'Motor rating') || {}).key; const pv = pk ? V.designParamPreview(MAN, ref, pk, 18.5) : null; const ls = (pv && pv.lines) || [];
  check(10, 'BL-1 motor rating 22 → 18.5 kW: "AMP-BL1 keeps 44 A (Override): base moved 40.0 → 33.6 A" (Minor 42.0 → 35.3, Major 46.0 → 38.6); "Clean intake filter on BL-1 keeps 42 A / 38 A (Override): base moved 38.0 → 31.9 A / 34.0 → 28.6 A"; "Motor current high · BL-1 follows AMP-BL1"',
    /^AMP-BL1 keeps 44 A \(Override\): base moved 40\.0 → 33\.6 A\b/.test(ls[0] || '') && /42\.0 → 35\.3 A/.test(ls[0]) && /46\.0 → 38\.6 A/.test(ls[0]) && ls.includes('Clean intake filter on BL-1 keeps 42 A / 38 A (Override): base moved 38.0 → 31.9 A / 34.0 → 28.6 A') && ls.includes('Motor current high · BL-1 follows AMP-BL1'), ls.join(' | '));
});

/* ════════ Chapter 11 · Deviations ════════ */
beat(11, 'Deviations: the counts and base-moved groups first', ['ledger'], () => {
  const d = V.deviations(); const c = d.counts;
  check(11, '"0 Trigger limit overrides · 0 pinned · 2 single-use templates"; overrides, base moved, past review and structure changes counted', c.triggerlimit === 0 && c.pinned === 0 && c.singleuse === 2 && c.overrides > 0 && c.basemoved >= 1 && c.pastreview === 1 && c.structure > 0, J(c));
  const g = d.groups.find((x) => /Sludge blanket high · persistence/.test(x.header));
  check(11, '"Secondary clarification · Sludge blanket high · persistence · library 15 min (v2)" with Manesar\'s "30 min · base moved 5 → 15 min"', g && g.header === 'Secondary clarification · Sludge blanket high · persistence · library 15 min (v2)' && /^30 min · base moved 5 → 15 min/.test(g.rows[0].valueBase), g && `${g.header} :: ${g.rows[0].valueBase}`);
  if (HAS.library) check(11, '"Activated sludge · MLSS low · Minor zone · library < 2,200 mg/L (v2)" comes first (chapter 10)', d.groups[0].header === 'Activated sludge · MLSS low · Minor zone · library < 2,200 mg/L (v2)', d.groups[0].header);
});
beat(11, 'Adopt, Extend, Promote, Keep single-use', ['ledger'], () => {
  const bl = V.S.overrides.find((o) => o.plant === MAN && o.target.kind === 'persistence' && o.target.alertId === 'a_blanket' && o.status === 'active'); const bv = V.overrideById(bl.id);
  if (HAS.library) check(11, 'its actions Keep · Adopt the library value · Promote; Adopt asks "The library changed this from 5 min to 15 min after you overrode it. Keep 30 min, or adopt 15 min?" with "Adopt 15 min"', bv.movedQuestion === 'The library changed this from 5 min to 15 min after you overrode it. Keep 30 min, or adopt 15 min?' && bv.adoptLabel === 'Adopt 15 min' && bv.keepLabel === 'Keep 30 min' && J(bv.actions.map((x) => x.label)) === J(['Keep', 'Adopt the library value', 'Promote']), `${bv.movedQuestion} · ${bv.adoptLabel}`);
  const a = V.adopt(bl.id);
  check(11, 'Adopt → "Manesar STP follows the library again: Sludge blanket high · SC-1 · persistence 15 min."', a.ok && a.toast === 'Manesar STP follows the library again: Sludge blanket high · SC-1 · persistence 15 min.', a.toast || a.error);
  const sp = V.S.overrides.find((o) => o.plant === MAN && o.target.kind === 'tier' && o.target.eqId === 'sp1' && o.status === 'active');
  check(11, '"1 past review" → the group "Pump · criticality tier · library B (v1)"', V.deviations().groups.some((g) => g.header === 'Pump · criticality tier · library B (v1)' && g.rows.some((r) => r.id === sp.id && r.state === 'pastreview')));
  const x = V.extend(sp.id, { note: 'Checked with the Lead: still true' });
  check(11, 'Extend the past-review tier with a note → "0 past review"', x.ok && V.deviations().counts.pastreview === 0, x.error);
  const mig = V.overrides({ plant: MAN }).filter((o) => o.reason === 'migrated');
  check(11, 'Reason: Migrated rows are set 1 Sep 2026 by "not recorded", review by 30 Nov 2026', mig.length > 0 && mig.every((o) => o.at === T('2026-09-01T09:00') && o.authorText === 'not recorded' && o.reviewBy === T('2026-11-30T09:00')) && V.deviations().counts.byReason.migrated === mig.length, `${mig.length}`);
  check(11, 'each Migrated row reads "Set before 1 Sep 2026 · who: not recorded"', mig.every((o) => V.overrideById(o.id).migratedLine === 'Set before 1 Sep 2026 · who: not recorded'));
  const dz = V.S.overrides.find((o) => o.plant === MAN && o.target.kind === 'zone' && o.target.sensorId === 'at2_do' && o.target.band === 'minor' && o.status === 'active'); const pr = V.promote(dz.id, { as: 'default' });
  check(11, 'Promote → "Make it the library default" opens the template page; banner "Promoting Manesar STP\'s override: DO-AT2 · Minor zone 1.5 mg/L (library 2.0 mg/L). Check Downstream, then publish."', pr.ok && /^#\/library\/templates\/tpl_up_activated-sludge_do-low\?promote=/.test(pr.href) && V.overrideById(dz.id).promoteBanner === 'Promoting Manesar STP\'s override: DO-AT2 · Minor zone 1.5 mg/L (library 2.0 mg/L). Check Downstream, then publish.', `${pr.href} · ${V.overrideById(dz.id).promoteBanner}`);
  const k = V.keepSingleUse('tpl_single_manesar_s_hypo'); const su = V.singleUse({ plant: MAN }).find((s) => s.id === 'tpl_single_manesar_s_hypo');
  check(11, '"Chemical refill · Task on CDU-1 (Dosing Pump) · every week · used at Manesar STP only · since 1 Sep 2026" → Keep single-use → "Kept single-use · 29 Oct 2026 · you"', k.ok && /^Chemical refill · Task on CDU-1 \(Dosing Pump\) · every week · used at Manesar STP only · since 1 Sep 2026/.test(su.text) && su.keptText === 'Kept single-use · 29 Oct 2026 · you', `${su.text} · ${su.keptText}`);
});
beat(11, 'DO-AT2 Major: Physical, then Temporary, which expires after +1 week', ['ledger'], () => {
  const tgt = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'major' }; const pp = V.physicalPath(MAN, tgt);
  check(11, 'Physical: "The library\'s limit rule for this band is a constant (1.0 mg/L): no design parameter changes it." (only "Override anyway")', pp.kind === 'const' && pp.text === 'The library\'s limit rule for this band is a constant (1.0 mg/L): no design parameter changes it.' && pp.secondary === 'Override anyway' && !pp.primary, J(pp));
  const exp = V.now() + 7 * DAY; const r = V.setZone(MAN, 'at2_do', 'below', 'major', 0.8, { reason: 'temporary', expires: exp, note: 'BL-2 out for repair; DO runs lower until it is back' });
  check(11, 'Temporary 0.8, expires on now + 7 days: the row reads "expires in 7 d" (Revert · Extend, no Promote)', r.ok && V.overrides({ plant: MAN }).some((o) => o.target.kind === 'zone' && o.target.sensorId === 'at2_do' && o.target.band === 'major' && o.reason === 'temporary' && o.expires === exp), r.error);
  const tr = V.overrides({ plant: MAN }).find((o) => o.target.kind === 'zone' && o.target.sensorId === 'at2_do' && o.target.band === 'major' && o.reason === 'temporary'); const trv = tr ? V.overrideById(tr.id) : {};
  check(11, 'the row: "0.8 mg/L · 1.0 mg/L · Temporary · … · expires in 7 d" with Revert and Extend, no Promote', trv.valueBase === '0.8 mg/L · 1.0 mg/L' && /^Temporary · /.test(trv.reasonNote) && trv.ageText === 'expires in 7 d' && J((trv.actions || []).map((x) => x.label)) === J(['Revert', 'Extend']), `${trv.valueBase} · ${trv.ageText} · ${J((trv.actions || []).map((x) => x.label))}`);
  const adv = V.advance(7 * 1440);
  check(11, '"+1 week": the toast includes "1 override expired"; Activity "Temporary override expired: DO-AT2 · Major zone back to the library value 1.0 mg/L. Plant admins told."', /1 override expired/.test(adv.summary) && V.activity({ plant: MAN }).some((a) => a.text === 'Temporary override expired: DO-AT2 · Major zone back to the library value 1.0 mg/L. Plant admins told.'), adv.summary);
  const hx = tr ? V.overrideById(tr.id) : {};
  check(11, 'the row moves to History ("Expired …")', hx.state === 'expired' && /^Expired /.test(hx.historyLine || '') && (V.deviations().history || []).some((h) => h.id === tr.id), hx.historyLine);
});

/* ════════ Chapter 12 · Decisions ════════ */
results.push({ ch: 12, name: 'the Decisions page is the shared decision file, not a core function', ok: true, skipped: 'checked by the decision file\'s own tests' });

/* ════════ report ════════ */
const chs = [...new Set(results.map((r) => r.ch))]; const skipped = results.filter((r) => r.skipped);
chs.forEach((ch) => { const rs = results.filter((r) => r.ch === ch); const bad = rs.filter((r) => !r.ok); const sk = rs.filter((r) => r.skipped); console.log(`  ${bad.length ? 'FAIL' : 'ok  '} chapter ${String(ch).padEnd(3)} ${rs.length - bad.length - sk.length}/${rs.length - sk.length}${sk.length ? ` (${sk.length} skipped)` : ''}`); (VERBOSE ? rs : bad).forEach((r) => console.log(`       ${r.skipped ? '-' : r.ok ? '✓' : '✗'} ${r.name}${r.skipped ? `  [skipped: ${r.skipped}]` : ''}${!r.ok && r.detail ? `  [${r.detail}]` : ''}`)); });
console.log(`\nstory72.core · ${results.length - skipped.length} checks, ${skipped.length} skipped · loaded: ${L.loaded.filter((f) => /^core7/.test(f)).join(', ')}`);
console.log(`RESULT: ${fails ? `FAIL · ${fails} failing` : 'PASS'}`);
process.exit(fails ? 1 : 0);
