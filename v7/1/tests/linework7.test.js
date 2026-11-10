/* linework7.test.js — condition-based work in v7/1: a task a line on an equipment alert raises, filed at the plant.
   Seeded lines at Manesar, history, the 24h advance raising BL-1's task instead of an issue, done → waiting, a deeper line still
   opening an issue, setting/removing a task on a line, and a line that raises a task protected from removal.
   Run: node tests/linework7.test.js [-v]   (TZ=Asia/Calcutta) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ASSETS = path.join(__dirname, '..', 'assets');
const ORDER = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'core7.js'];
const VERBOSE = process.argv.includes('-v');
const g = global; g.window = g; g.V7_NO_V6_SHELL = true; g.addEventListener = () => {}; g.removeEventListener = () => {};
const store = new Map();
g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {}, innerHTML: '' });
g.document = { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), onkeydown: null };
g.location = { hash: '#/plants', href: 'http://localhost/prototype.html#/plants' }; g.scrollTo = () => {}; g.Blob = g.Blob || function Blob() {}; if (!g.URL) g.URL = {};
for (const f of ORDER) vm.runInThisContext(fs.readFileSync(path.join(ASSETS, f), 'utf8'), { filename: f });
const V = g.V7; V.boot();

const results = [];
function check(area, name, ok, detail) { results.push({ area, name, ok: !!ok, detail }); if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} [${area}] ${name}${detail ? ' — ' + detail : ''}`); }
const lineTasks = (k) => V.tasks(k).filter((t) => t.kind === 'line');

/* ── 1. seeded: two lines at Manesar, filed at the plant ─────────────────────────────────────── */
const lw = V.lineWork('manesar');
check('seed', 'Manesar has two lines that raise work: BL-1 Caution, AT-1 MLSS Minor', lw.length === 2 && lw.some((x) => x.sensorId === 'bl1_amps' && x.band === 'caution') && lw.some((x) => x.sensorId === 'at1_mlss' && x.band === 'minor'), lw.map((x) => x.whenText).join(' | '));
check('seed', 'the line is read live: "When BL-1 Motor current rises above 44 A (Caution)"', lw.some((x) => x.whenText === 'When BL-1 Motor current rises above 44 A (Caution)'));
const lt = lineTasks('manesar');
check('seed', 'they are tasks of the plant: Condition-based work, no equipment', lt.length === 2 && lt.every((t) => t.plantLevel && t.workType === 'condition' && !t.eqIds.length && t.perDay === 0));
check('seed', 'not on BL-1 or AT-1: equipment carries no condition-based work', !V.tasks('manesar', { eqId: 'bl1' }).some((t) => t.kind === 'line') && !V.tasks('manesar', { eqId: 'at1' }).some((t) => t.kind === 'line'));
check('seed', 'each waits for its reading, with one done in the last 30 days', lt.every((t) => t.status === 'armed' && t.statusLabel === 'Waiting for the reading' && t.history.length === 1 && t.lastDone));
check('seed', 'Activity shows the raise and who did it', V.activity({ plant: 'manesar' }).some((a) => /^Task raised: Clean the blower intake filters, BL-1 Motor current/.test(a.text)) && V.activity({ plant: 'manesar' }).some((a) => a.text === 'Task done: Clean the blower intake filters' && a.who !== 'Automatic'));
check('seed', 'a line that raises a task opened no issue in the history', !V.issues('manesar').some((i) => i.title === 'Motor current high — BL-1' || i.title === 'MLSS high — AT-1'));
check('seed', 'the story\'s ids stay as they were (Vedanta a_3d, a_3f, is_5m)', !!V.alert('vedanta', 'a_3d') && !!V.alert('vedanta', 'a_3f') && !!V.issue('vedanta', 'is_5m'));
check('seed', 'Vedanta (Commissioning) has none: its tasks start at go live', !lineTasks('vedanta').length);

/* ── 2. setting and removing ─────────────────────────────────────────────────────────────────── */
const bad = V.setLineWork('manesar', 'at2_do', 'below', 'caution', { name: 'Check the diffusers' });
check('set', 'a line that is not set cannot raise work', !bad.ok && /no Caution line below/.test(bad.error), bad.error);
const add = V.setLineWork('manesar', 'at2_do', 'below', 'minor', { name: 'Check the diffusers' });
check('set', 'a set line takes a task; Activity says it raises it instead of an issue', add.ok && V.lineWork('manesar', { sensorId: 'at2_do' }).length === 1 && /now raises the task "Check the diffusers" at the plant instead of an issue/.test(V.activity({ plant: 'manesar', limit: 1 })[0].text));
const ren = V.setLineWork('manesar', 'at2_do', 'below', 'minor', { name: 'Check the diffusers and the air header' });
check('set', 'renaming keeps the one task', ren.ok && V.lineWork('manesar', { sensorId: 'at2_do' }).length === 1 && V.lineWork('manesar', { sensorId: 'at2_do' })[0].name === 'Check the diffusers and the air header');
const guard = V.setLimits('manesar', 'at2_do', 'below', { minor: null, major: 1, emergency: 0.5 }, { reason: 'tuned', note: 'test' });
check('set', 'a line that raises a task cannot be removed under it', !guard.ok && /raises the task/.test(guard.error), guard.error);
const off = V.setLineWork('manesar', 'at2_do', 'below', 'minor', { name: null });
check('set', 'taking the task off: the line opens an issue again', off.ok && !V.lineWork('manesar', { sensorId: 'at2_do' }).length);
check('set', 'nothing to do while it waits: done is refused', !V.doneTask('manesar', 'lw_bl1_filter').ok);

/* ── 3. the clock: BL-1's Caution line raises the task, not an issue ─────────────────────────── */
const adv = V.advance(24 * 60);
const raised = adv.tasksDue.find((x) => x.id === 'lw_bl1_filter');
check('advance', 'BL-1 at Caution on Thu 29 Oct raises "Clean the blower intake filters"', raised && V.fmt(raised.due) === 'Thu 29 Oct, 14:25', raised && V.fmt(raised.due));
check('advance', 'and opens no BL-1 issue', !adv.opened.some((o) => o.title === 'Motor current high — BL-1'));
const t1 = V.task('manesar', 'lw_bl1_filter');
check('advance', 'the plant\'s task is Due, with what raised it', t1.status === 'due' && t1.raisedBy && t1.raisedBy.band === 'caution' && t1.raisedBy.value > 44, t1 && JSON.stringify(t1.raisedBy));
check('advance', 'Activity: "Task raised: … (Caution line)"', V.activity({ plant: 'manesar' }).some((a) => /^Task raised: Clean the blower intake filters, BL-1 Motor current .* \(Caution line\)$/.test(a.text) && V.fmt(a.at) === 'Thu 29 Oct, 14:25'));
const done = V.doneTask('manesar', 'lw_bl1_filter');
check('done', 'done → waiting for the reading again, kept in its history', done.ok && done.task.status === 'armed' && done.task.history.length === 2 && done.task.lastDone === V.now());

/* ── 4. a deeper line still opens the issue ───────────────────────────────────────────────────── */
V.setLimits('manesar', 'bl1_amps', 'above', { caution: 37, minor: 38.5 }, { reason: 'fornow', until: '2026-11-20', note: 'test: bring the lines to the reading' });
const adv2 = V.advance(6 * 60);
check('deeper', 'past the Minor line the issue opens as before; the Caution line raises the task again', adv2.opened.some((o) => o.title === 'Motor current high — BL-1' && o.band === 'minor') && adv2.tasksDue.some((x) => x.id === 'lw_bl1_filter'), adv2.opened.map((o) => o.title + ' ' + o.band).join('; '));

const fails = results.filter((r) => !r.ok).length;
console.log(`linework7 · ${results.length - fails}/${results.length} checks pass · RESULT: ${fails ? 'FAIL' : 'PASS'}`);
process.exitCode = fails ? 1 : 0;
