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
for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'structure73.js', 'core7.js', 'calls73.js', 'decisions7.js']) vm.runInThisContext(fs.readFileSync(path.join(A, f), 'utf8'), { filename: f });
const V = g.V7; V.boot();
const results = [];
function check(area, name, ok, detail) { results.push(!!ok); if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} [${area}] ${name}${detail ? ' — ' + detail : ''}`); }

/* D1: structure */
const dp = V.structure('digitalpaani'); const ma = V.structure('manesar');
check('D1', 'DigitalPaani: 21 unit processes, 11 control groups and 20 pieces not placed, proposed', dp.ups.length === 21 && dp.cgs.length === 11 && dp.unplaced.length === 20 && dp.state !== 'confirmed', `${dp.ups.length}/${dp.cgs.length}/${dp.unplaced.length} ${dp.state}`);
check('D1', 'Manesar: 7 unit processes, confirmed; AT-1 is Activated sludge with BL-1 and BL-2 taking part', ma.ups.length === 7 && ma.state === 'confirmed' && V.unitProcess('manesar', 'at1').typeName === 'Activated sludge' && V.unitProcess('manesar', 'at1').members.map((m) => m.tag).join() === 'BL-1,BL-2');
check('D1', 'every unit process and member is a piece of equipment the plant has', ['digitalpaani', 'vedanta', 'manesar', 'bawal'].every((k) => V.structure(k).ups.every((u) => V.eq(k, u.id) && u.members.every((m) => V.eq(k, m.eqId))) && V.structure(k).cgs.every((c) => c.memberIds.every((id) => V.eq(k, id)))));
check('D1', 'the library has 27 unit-process types', (g.V7_UP_TYPES || []).length === 27);

/* D7: one changeover task per control group */
const cg = V.tasks('vedanta').filter((t) => t.cg);
check('D7', 'Vedanta: the blower changeover is one task for the control group Blowers, not marked "to confirm"', cg.length === 1 && cg[0].line === 'Routine work - Blower duty / standby changeover · Blowers' && cg[0].eqIds.length === 2 && !cg[0].toConfirm, cg.map((t) => t.line).join(' | '));

/* D3: nothing sent on a new plant */
check('D3', 'Vedanta (a new plant): its pH Emergency on Wed 28 Oct opened no issue and is kept as a trial firing', V.issues('vedanta').length === 0 && V.trialStats('vedanta', 'a_3f').recorded.firings.some((f) => f.band === 'emergency' && V.fmt(f.start) === 'Wed 28 Oct, 15:10'));
check('D3', 'Manesar (Live) still opens issues', V.issues('manesar').length > 0);

/* D28: where condition-based work is filed */
const lw = V.lineWork('manesar');
check('D28', 'BL-1\'s Caution range triggers a task at the plant; AT-1\'s MLSS range one at AT-1', lw.find((w) => w.sensorId === 'bl1_amps').filed.kind === 'plant' && lw.find((w) => w.sensorId === 'at1_mlss').filed.id === 'at1');
check('D28', 'AT-1\'s tasks list it; BL-1\'s do not', V.tasks('manesar', { eqId: 'at1' }).some((t) => t.id === 'lw_at1_sludge') && !V.tasks('manesar', { eqId: 'bl1' }).some((t) => t.kind === 'line'));
const mv = V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: 'Clean the blower intake filters', filedAt: 'at2' });
check('D28', 'a task can move to a unit process the equipment serves, never onto equipment', mv.ok && V.task('manesar', 'lw_bl1_filter').upId === 'at2' && !V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: 'x', filedAt: 'bl1' }).ok);
const adv = V.advance(24 * 60);
check('D28', 'BL-1 crossing 44 A raises the task and opens no BL-1 issue', adv.tasksDue.some((x) => x.id === 'lw_bl1_filter') && !adv.opened.some((o) => /BL-1/.test(o.title)));

/* D11: a safety change never replaces a plant's own value */
V.reset();
const before = V.limitsOf('vedanta', 'v_eq1_PH', 'below').perBand.emergency;
const ed = V.editLib('OS_TANK', { reading: 'pH', dir: 'below', bands: { minor: 6.0, major: 5.5, emergency: 4.5 } });
const wl = ed.ok ? V.whereItLands('OS_TANK') : null; const pub = ed.ok ? V.publish('OS_TANK', { note: 'Test', reason: 'Test' }) : { ok: false };
const after = V.limitsOf('vedanta', 'v_eq1_PH', 'below').perBand.emergency;
check('D11', 'Vedanta\'s own Emergency limit on EQ-1 pH (4.0) survives a library safety change', before.value === 4 && pub.ok && after.value === 4 && after.overrideId === before.overrideId && !!wl, `${before.value} → ${after.value} ${pub.error || ''}`);

/* the calls file */
const made = g.V7_CALLS_MADE; const cards = g.V7_DECISIONS;
check('calls', '28 of the 29 cards carry a call that names one of their options; D10 is parked', Object.keys(made).length === 28 && !made.D10 && Object.entries(made).every(([id, m]) => { const d = cards.find((c) => c.id === id); return d && (m.opt === 'other' || (Number.isInteger(m.opt) && m.opt >= 0 && m.opt < d.options.length)) && m.by && m.atText; }));
check('calls', 'the decisions file shows them as decided', g.V7DEC.answerOf('D1').made === true && g.V7DEC.answerOf('D1').opt === 2 && g.V7DEC.answerOf('D10') === null);
check('calls', 'every card has a build state for the hand-off page, or builds as v7/1 does', Object.keys(g.V7_BUILT73).every((id) => cards.some((c) => c.id === id) && ['Built', 'Partly built', 'Not built yet', 'Parked'].includes(g.V7_BUILT73[id][0])));

const fails = results.filter((x) => !x).length;
console.log(`v73.test · ${results.length - fails}/${results.length} checks pass · RESULT: ${fails ? 'FAIL' : 'PASS'}`);
process.exitCode = fails ? 1 : 0;
