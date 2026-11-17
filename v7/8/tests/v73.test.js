/* v7/3 · tests/v73.test.js — what v7/3 builds on top of v7/1, checked on the core with no browser:
   structure (D1), one changeover task per control group (D7), nothing sent on a new plant (D3), where condition-based work is
   filed (D28), a safety change never replacing a plant's own value (D11), and the calls file agreeing with the cards.
   The screens are covered by tests/smoke.js, which renders every route. v7/1's own story checks stay in v7/1.
   Usage: TZ=Asia/Calcutta node tests/v73.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const A = path.join(__dirname, '..', 'assets'); const VERBOSE = process.argv.includes('-v');
const g = global; g.window = g; g.V7_NO_V6_SHELL = true; g.addEventListener = () => {}; g.removeEventListener = () => {};
const store = new Map();
g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {}, innerHTML: '' });
g.document = { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), onkeydown: null };
g.location = { hash: '#/plants', href: 'http://localhost/prototype.html#/plants' }; g.scrollTo = () => {}; g.Blob = g.Blob || function Blob() {}; if (!g.URL) g.URL = {};
for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'structure73.js', 'nodes73.js', 'core7.js', 'calls73.js', 'decisions7.js']) vm.runInThisContext(fs.readFileSync(path.join(A, f), 'utf8'), { filename: f });
const V = g.V7; V.boot();
const results = [];
function check(area, name, ok, detail) { results.push(!!ok); if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} [${area}] ${name}${detail ? ' — ' + detail : ''}`); }

/* D1: structure */
const dp = V.structure('digitalpaani'); const ma = V.structure('manesar');
check('D1', 'DigitalPaani: 23 unit processes, 11 control groups and 15 pieces not placed, proposed', dp.ups.length === 23 && dp.cgs.length === 11 && dp.unplaced.length === 15 && dp.state !== 'confirmed', `${dp.ups.length}/${dp.cgs.length}/${dp.unplaced.length} ${dp.state}`);
check('D1', 'Manesar: 7 unit processes, confirmed; AT-1 is Activated sludge with BL-1 and BL-2 taking part', ma.ups.length === 7 && ma.state === 'confirmed' && V.unitProcess('manesar', 'at1').typeName === 'Activated sludge' && V.unitProcess('manesar', 'at1').members.map((m) => m.tag).join() === 'BL-1,BL-2');
check('D1', 'every unit process and member is a piece of equipment the plant has', ['digitalpaani', 'vedanta', 'manesar', 'bawal'].every((k) => V.structure(k).ups.every((u) => V.eq(k, u.id) && u.members.every((m) => V.eq(k, m.eqId))) && V.structure(k).cgs.every((c) => c.memberIds.every((id) => V.eq(k, id)))));
check('D1', 'the library has 53 unit-process types, each one used by the structure under its stored value', (g.V7_UP_TYPES || []).length === 53 && ['digitalpaani', 'vedanta', 'manesar', 'bawal'].every((k) => V.structure(k).ups.every((u) => g.V7NODES.upByKey[u.typeId] && u.typeName === g.V7NODES.upByKey[u.typeId].name)));

/* the two libraries: equipment, and unit processes */
const N = g.V7NODES; const lt = V.libTypes(); const byTag = (t) => V.equipment(DP).find((e) => e.tag === t); const DP = 'digitalpaani';
check('libraries', '12 kinds of equipment and 53 unit processes are read in; the library has 84 equipment types and 53 unit-process types', N.EQ.length === 12 && N.UP.length === 53 && lt.filter((t) => t.library === 'process').length === 53 && lt.filter((t) => t.library === 'equipment').length === 84, lt.length + ' types');
check('libraries', 'every unit-process type has a library page with at least one task, and its own equipment type to fall back on', N.UP.every((p) => { const t = V.libType(p.stored); return t && t.library === 'process' && t.typeName === p.name && t.schedules.length >= (p.stored === 'unspecified' ? 0 : 1) && V.libType(p.eq) && V.libType(p.eq).library === 'equipment'; }));
check('libraries', 'no two types share a name', new Set(lt.map((t) => t.typeName)).size === lt.length);
check('libraries', 'a treated water tank on its own gets the equipment library; one with equipment taking part gets the unit-process library', (() => {
  const node = (id, code, label) => ({ id, cell: id, tag: id, label, code, sensors: [] });
  const alone = N.plan({ equipment: [node('a', 'OS_TANK', 'Treated Water Tank'), node('p', 'PMP', 'Feed pump')], links: [] }, null);
  const served = N.plan({ equipment: [node('a', 'OS_TANK', 'Treated Water Tank'), node('p', 'PMP', 'Transfer pump'), node('d', 'D_PMP', 'Hypo dosing pump')], links: [['a', 'p'], ['d', 'a']] }, null);
  return alone.length === 1 && alone[0].library === 'equipment' && alone[0].code === 'TW-TANK' && alone[0].typeName === 'Treated water tank'
    && served.length === 1 && served[0].library === 'process' && served[0].code === 'treated_water' && served[0].typeName === 'Treated water' && served[0].members.length === 2;
})());
check('libraries', 'a pump, a blower or a valve is never a unit process, and two tanks piped together do not take part in each other', (() => {
  const node = (id, code, label) => ({ id, cell: id, tag: id, label, code, sensors: [] });
  const r = N.plan({ equipment: [node('p', 'PMP', 'Aeration blower feed pump'), node('b', 'BLW', 'Blower'), node('v', 'VALVE_2', 'Valve'), node('t1', 'OS_TANK', 'Collection tank'), node('t2', 'MBBR', 'MBBR')], links: [['t1', 't2']] }, null);
  return r.length === 2 && r.every((o) => o.library === 'equipment') && !N.atomic(node('p', 'PMP', 'Aeration pump'));
})());
check('libraries', 'DigitalPaani: MBBR-1 and EQTT-1 follow a unit-process type, TWT and TS-1 an equipment type, and none reads as drawn wrongly', byTag('MBBR-1').typeName === 'Moving bed biofilm reactor' && byTag('MBBR-1').offer.library === 'process' && byTag('EQTT-1').typeName === 'Equalization' && byTag('TWT').typeName === 'Treated water tank' && byTag('TWT').offer.library === 'equipment' && byTag('TS-1').typeName === 'Tube settler' && V.equipment(DP).every((e) => !e.offer || !e.typeDiffers) && V.scadaReview(DP).typeDiffers.length === 0, [byTag('MBBR-1').typeName, byTag('EQTT-1').typeName, byTag('TWT').typeName, V.scadaReview(DP).typeDiffers.length].join(' / '));
check('libraries', 'a unit process carries what its tank carries plus the work of the step, and the flows written for the tank', (() => {
  const up = V.libType('mbbr'); const eq = V.libType('MBBR'); const flows = ((g.CTL && g.CTL.S && g.CTL.S.lib && g.CTL.S.lib.flows) || g.SEED.flows).filter((f) => (f.forTypes || []).includes('MBBR'));
  return eq.schedules.every((s) => up.schedules.some((x) => x.name === s.name)) && up.schedules.some((s) => s.name === 'Media movement check') && up.readings.some((r) => r.name === 'Dissolved oxygen') && flows.length > 0 && flows.every((f) => f.forTypes.includes('Moving bed biofilm reactor'));
})());
check('libraries', 'a full code is read: the longest known type first, then one part per sub-type, several values joined with a hyphen', (() => {
  const a = N.readCode('PMP_CENT_SUBM_CUTTER_INFL'); const b = N.readCode('OS_TANK_SC_COARSE_BAR'); const c = N.readCode('TANK_OPEN-SURF_DOSING_NAOCL-SMBS'); const d = N.readCode('TW-TANK_FLUSH-IRRIG'); const e = N.readCode('VALVE_BFLY_AUTO_PNEU_2-WAY_RAS');
  return a.lib === 'SUB_PMP' && a.values.service.join() === 'INFL' && !a.unknown.length && b.kind === 'process' && b.type.stored === 'screening' && b.values.fineness.join() === 'COARSE' && c.lib === 'DOS_TANK' && c.values.chemical.join() === 'NAOCL,SMBS'
    && d.type.stored === 'treated_water' && d.values.enduse.join() === 'FLUSH,IRRIG' && e.lib === 'VALVE_2' && e.values.mechanism.join() === 'PNEU' && N.readCode('PMP_CENT').missing.join() === 'Service' && N.readCode('NOPE') === null
    && g.detectDbType({ code: 'PMP_CENT_SUBM_CUTTER_INFL' }).type === 'Submersible Pump' && g.detectDbType({ code: 'SURF-AER_FLOAT' }).type === 'Surface aerator';
})());
check('libraries', 'the sample plants keep the types their records were made with', V.equipment('manesar').every((e) => !e.offer) && V.equipment('manesar').some((e) => e.typeName === 'MBR') && V.equipment('vedanta').every((e) => !e.offer));

/* D7: one changeover task per control group */
const cg = V.tasks('vedanta').filter((t) => t.cg);
check('D7', 'Vedanta: the blower changeover came round every few hours, so it is no longer a task: nothing is done more often than once a day', cg.length === 0 && V.tasks('vedanta').every((t) => t.kind === 'line' || t.intervalH >= 24), cg.map((t) => t.line).join(' | '));

/* D3: nothing sent on a new plant */
check('D3', 'Vedanta (a new plant): its pH Emergency on Wed 28 Oct opened no issue and is kept as a trial firing', V.issues('vedanta').length === 0 && V.trialStats('vedanta', 'a_3f').recorded.firings.some((f) => f.band === 'emergency' && V.fmt(f.start) === 'Wed 28 Oct, 15:10'));
check('D3', 'Manesar (Live) still opens issues', V.issues('manesar').length > 0);

/* D28: a task a reading triggers sits on that reading's equipment, like the issue */
const lw = V.lineWork('manesar');
check('D28', 'BL-1\'s Caution range triggers a task on BL-1; AT-1\'s MLSS range one on AT-1', lw.find((w) => w.sensorId === 'bl1_amps').filed.id === 'bl1' && lw.find((w) => w.sensorId === 'at1_mlss').filed.id === 'at1');
check('D28', 'each equipment\'s tasks list its own; neither is a task of the plant', V.tasks('manesar', { eqId: 'at1' }).some((t) => t.id === 'lw_at1_sludge') && V.tasks('manesar', { eqId: 'bl1' }).some((t) => t.id === 'lw_bl1_filter') && V.tasks('manesar').filter((t) => t.kind === 'line').every((t) => !t.plantLevel && t.eqIds.length === 1));
const mv = V.setLineWork('vedanta', 'v_p1_AMP', 'above', 'caution', { name: 'Check the pump strainer' });
check('D28', 'a new one on P-1\'s motor current sits on P-1', mv.ok && V.lineWork('vedanta', { sensorId: 'v_p1_AMP' })[0].filed.tag === 'P-1' && V.tasks('vedanta', { eqId: V.lineWork('vedanta', { sensorId: 'v_p1_AMP' })[0].eqId }).some((t) => t.name === 'Check the pump strainer'), mv.error);
const adv = V.advance(24 * 60);
check('D28', 'BL-1 crossing 44 A raises the task and opens no BL-1 issue', adv.tasksDue.some((x) => x.id === 'lw_bl1_filter') && !adv.opened.some((o) => /BL-1/.test(o.title)));

/* D11: a safety change never replaces a plant's own value */
V.reset();
const before = V.limitsOf('vedanta', 'v_eq1_PH', 'below').perBand.emergency;
const ed = V.editLib('OS_TANK', { reading: 'pH', dir: 'below', bands: { minor: 6.0, major: 5.5, emergency: 4.5 } });
const wl = ed.ok ? V.whereItLands('OS_TANK') : null; const pub = ed.ok ? V.publish('OS_TANK', { note: 'Test', reason: 'Test' }) : { ok: false };
const after = V.limitsOf('vedanta', 'v_eq1_PH', 'below').perBand.emergency;
check('D11', 'Vedanta\'s own Emergency limit on EQ-1 pH (4.0) survives a library safety change', before.value === 4 && pub.ok && after.value === 4 && after.overrideId === before.overrideId && !!wl, `${before.value} → ${after.value} ${pub.error || ''}`);

/* the workflow a range starts */
V.reset();
const otherDiag = g.SEED.flows.find((f) => f.kind === 'diagnostic' && f.id !== V.alert('manesar', 'a_do_at2').flowId).id;
const sf = V.setAlertFlow('manesar', 'a_do_at2', otherDiag); const picked = V.alert('manesar', 'a_do_at2');
check('flows', 'an alert can start another diagnostic flow at this plant; a fix flow is refused', sf.ok && sf.changed && picked.flowId === otherDiag && !V.setAlertFlow('manesar', 'a_do_at2', 'f_blower').ok, JSON.stringify(sf));
const tf = V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: 'Clean the blower intake filters', flowId: 'f_blower' });
check('flows', 'a task a range triggers can carry a flow: its steps show on the task', tf.ok && V.task('manesar', 'lw_bl1_filter').flowId === 'f_blower' && V.task('manesar', 'lw_bl1_filter').steps.length >= 7);

/* the calls file */
const made = g.V7_CALLS_MADE; const cards = g.V7_DECISIONS;
check('calls', '28 of the 29 cards carry a call that names one of their options; D10 is parked', Object.keys(made).length === 28 && !made.D10 && Object.entries(made).every(([id, m]) => { const d = cards.find((c) => c.id === id); return d && (m.opt === 'other' || (Number.isInteger(m.opt) && m.opt >= 0 && m.opt < d.options.length)) && m.by && m.atText; }));
check('calls', 'the decisions file shows them as decided', g.V7DEC.answerOf('D1').made === true && g.V7DEC.answerOf('D1').opt === 2 && g.V7DEC.answerOf('D10') === null);
check('calls', 'every card has a build state for the hand-off page, or builds as v7/1 does', Object.keys(g.V7_BUILT73).every((id) => cards.some((c) => c.id === id) && ['Built', 'Partly built', 'Not built yet', 'Parked'].includes(g.V7_BUILT73[id][0])));

/* v7/4: the work level */
(() => {
  const k = 'vedanta'; const all = V.tasks(k); const w0 = V.workLevel(k);
  check('work level', 'a plant starts at Everything, with nothing left out', w0.level === 3 && w0.leftOut.length === 0 && w0.options[2].tasks === all.length && all.every((t) => t.kind === 'line' || t.intervalH >= 24));
  V.setWorkLevel(k, 1, { keepUnwatched: false }); const w1 = V.workLevel(k); const t1 = V.tasks(k);
  check('work level', 'Essentials keeps every preventive maintenance, calibration, statutory and reading-raised task, and leaves out only routine work', w1.leftOut.length > 0 && all.filter((t) => t.workType === 'pm' || t.workType === 'calibration' || t.statutory || t.kind === 'line').every((t) => t1.some((x) => x.id === t.id)) && w1.leftOut.every((x) => { const t = all.find((y) => y.id === x.id); return t && !['pm', 'calibration'].includes(t.workType) && !t.statutory; }), w1.leftOut.length + ' left out');
  const alertsBefore = V.alerts(k).map((a) => a.id + a.state).join();
  V.setWorkLevel(k, 1, { keepUnwatched: true }); const w2 = V.workLevel(k);
  check('work level', 'with the keep switch on, nothing left out is on equipment that no alert watches', w2.leftOut.every((x) => x.watched) && w2.kept.every((x) => !x.watched) && w2.leftOut.length + w2.kept.length === w1.leftOut.length);
  check('work level', 'the level never changes an alert', V.alerts(k).map((a) => a.id + a.state).join() === alertsBefore);
  V.setWorkLevel(k, 3); check('work level', 'Everything brings every task back', V.tasks(k).length === all.length && V.workLevel(k).leftOut.length === 0);
})();

/* v7/4: the structure changed by hand */
(() => {
  const k = 'digitalpaani'; V.reset(); const st0 = V.structure(k); const u = st0.ups.find((y) => y.members.length === 2); const to = st0.ups.find((y) => y.id !== u.id && !y.members.length); const m = u.members[0].eqId;
  const r = V.setUnitProcess(k, u.id, { typeId: 'screening', moves: [{ eqId: m, to: to.id }] }); const st1 = V.structure(k);
  check('structure by hand', 'a unit process takes a new type, and a piece of equipment moves to another unit process', r.ok && V.unitProcess(k, u.id).typeName === g.V7NODES.upByKey.screening.name && !V.unitProcess(k, u.id).members.some((y) => y.eqId === m) && V.unitProcess(k, to.id).members.some((y) => y.eqId === m));
  check('structure by hand', 'the proposal itself is not touched: Reset brings it back', g.V7_STRUCTURE[k].ups.find((y) => y.id === u.id).members.length === 2 && st1 !== g.V7_STRUCTURE[k]);
  const rm = V.removeUnitProcess(k, to.id); const st2 = V.structure(k);
  check('structure by hand', 'removing a unit process leaves its tank as equipment, listed as not placed', rm.ok && st2.ups.length === st0.ups.length - 1 && st2.unplaced.includes(to.id) && !!V.eq(k, to.id));
  const ad = V.addUnitProcess(k, { eqId: to.id, typeId: 'equalization' });
  check('structure by hand', 'a unit process can be added on a tank that is not one, with a type from the library of 53; never on a pump, a blower or a valve', !V.addUnitProcess(k, { eqId: V.equipment(k).find((e) => /pump/i.test(e.typeName)).id, typeId: 'equalization' }).ok && !V.addUnitProcess(k, { eqId: to.id, typeId: 'not_a_type' }).ok && ad.ok && V.unitProcess(k, to.id).byHand === true && !V.structure(k).unplaced.includes(to.id) && !V.addUnitProcess(k, { eqId: to.id, typeId: 'equalization' }).ok);
  const cg = V.structure(k).cgs[0];
  check('structure by hand', 'a control group needs a name and two pieces that are in no other set; it can be renamed and removed', !V.saveControlGroup(k, null, { name: 'x', memberIds: cg.memberIds }).ok && !V.saveControlGroup(k, cg.id, { name: '', memberIds: cg.memberIds }).ok && V.saveControlGroup(k, cg.id, { name: 'Renamed', memberIds: cg.memberIds }).ok && V.structure(k).cgs[0].name === 'Renamed' && V.removeControlGroup(k, cg.id).ok && !V.structure(k).cgs.some((c) => c.id === cg.id));
  V.reset(); check('structure by hand', 'after Reset the structure is the proposal again', V.structure(k).ups.length === st0.ups.length && V.unitProcess(k, u.id).members.length === 2);
})();

const fails = results.filter((x) => !x).length;
console.log(`v73.test · ${results.length - fails}/${results.length} checks pass · RESULT: ${fails ? 'FAIL' : 'PASS'}`);
process.exitCode = fails ? 1 : 0;
