/* v7/2 · tests/linework72.test.js — condition-based work in v7/2: a Task a line on an Issue Trigger raises, filed at a unit
   process or the plant, never on equipment. Seeded lines at Manesar (BL-1's Caution line at the plant, since BL-1 serves AT-1 and
   AT-2; AT-1's MLSS line at AT-1), no equipment-level condition jobs left, the 24h move raising BL-1's Task instead of an Issue,
   done → waiting, filing rules, the pages that show it.
   Usage: TZ=Asia/Calcutta node tests/linework72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const L = require('./load72');
const V = L.V7; const VERBOSE = process.argv.includes('-v');
const results = [];
function check(area, name, ok, detail) { results.push({ area, name, ok: !!ok }); if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} [${area}] ${name}${detail ? ' — ' + detail : ''}`); }
const text = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');

/* ── 1. seeded ─────────────────────────────────────────────────────────────────────────────────────── */
const lw = V.lineWork('manesar');
check('seed', 'Manesar: BL-1\'s Caution line raises "Clean the blower intake filters" at the plant; AT-1\'s MLSS line raises "Waste extra sludge" at AT-1', lw.length === 2 && lw.some((w) => w.sensorId === 'bl1_amps' && w.band === 'caution' && w.filed.kind === 'plant') && lw.some((w) => w.sensorId === 'at1_mlss' && w.band === 'minor' && w.filed.kind === 'up' && w.filed.id === 'at1'), lw.map((w) => `${w.whenText} → ${w.filed.text}`).join(' | '));
const lt = V.tasks('manesar').filter((t) => t.kind === 'line');
check('seed', 'their Tasks: Condition-based work, waiting for the reading, each done once in the last 30 days', lt.length === 2 && lt.every((t) => t.workLabel === 'Condition-based work' && t.status === 'armed' && t.statusLabel === 'Waiting for the reading' && t.history.length === 1 && t.perDay === 0));
check('seed', 'on their subjects: the plant, and AT-1 (a unit process); never on equipment', lt.find((t) => t.id === 'lw_bl1_filter').subject.kind === 'plant' && lt.find((t) => t.id === 'lw_at1_sludge').upId === 'at1' && !V.tasks('manesar', { eqId: 'bl1' }).some((t) => t.kind === 'line'));
check('seed', 'no condition Task on equipment is left: the Blower type has no intake-filter job and Manesar\'s w_intake is gone', !V.templates({}).some((t) => t.condition) && !V.conditionOf('manesar', 'w_intake'));
check('seed', 'a line that raises a Task opened no Issue in the history', !V.issues('manesar').some((i) => i.title === 'Motor current high · BL-1' || i.title === 'MLSS high · AT-1'));

/* ── 2. filing ─────────────────────────────────────────────────────────────────────────────────────── */
const toUp = V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: 'Clean the blower intake filters', filedAt: 'at2' });
check('filing', 'a line\'s Task can move to a unit process the equipment takes part in (AT-2)', toUp.ok && V.task('manesar', 'lw_bl1_filter').upId === 'at2' && /now raises "Clean the blower intake filters" at AT-2/.test(V.activity({ plant: 'manesar', limit: 1 })[0].text));
const onEq = V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: 'x', filedAt: 'bl1' });
check('filing', 'never on equipment', !onEq.ok && /never on equipment/.test(onEq.error), onEq.error);
V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: 'Clean the blower intake filters', filedAt: null });
check('filing', 'back to the plant', V.lineWork('manesar', { sensorId: 'bl1_amps' })[0].filed.kind === 'plant');

/* ── 3. the clock ──────────────────────────────────────────────────────────────────────────────────── */
const adv = V.advance(24 * 60);
const raised = adv.tasksDue.find((x) => x.id === 'lw_bl1_filter');
check('advance', 'BL-1 at Caution on Thu 29 Oct raises the Task (14:25) and opens no BL-1 Issue', raised && V.fmt(raised.due) === 'Thu 29 Oct, 14:25' && !adv.opened.some((o) => o.title === 'Motor current high · BL-1'), raised && V.fmt(raised.due));
const t1 = V.task('manesar', 'lw_bl1_filter');
check('advance', 'the Task is Due with what raised it; done puts it back to waiting', t1.status === 'due' && t1.raisedBy && t1.raisedBy.band === 'caution' && V.doneTask('manesar', 'lw_bl1_filter').task.status === 'armed');

/* ── 4. pages ──────────────────────────────────────────────────────────────────────────────────────── */
if (L.render) {
  const ts = text(L.render('#/p/manesar/task/lw_at1_sludge'));
  check('pages', 'the Task page: on AT-1, raised when AT-1 MLSS rises above its Minor line', ts.includes('Raised when') && ts.includes('AT-1 MLSS') && ts.includes('Minor line, now 4500 mg/L'), ts.slice(0, 300));
  const up = text(L.render('#/p/manesar/up/at1/tasks'));
  check('pages', 'AT-1\'s Tasks tab lists it with the line that raises it', up.includes('Waste extra sludge') && up.includes('When AT-1 MLSS rises above 4500 mg/L (Minor)') && up.includes('Raised by a line'), up.slice(0, 300));
  const tg = text(L.render('#/p/manesar/trigger/a_bl1_amps'));
  check('pages', 'the Trigger page shows what its Caution line raises', tg.includes('raises the Task Clean the blower intake filters at the plant'), tg.slice(0, 200));
}

const fails = results.filter((r) => !r.ok).length;
console.log(`linework72 · ${results.length - fails}/${results.length} checks pass · RESULT: ${fails ? 'FAIL' : 'PASS'}`);
process.exitCode = fails ? 1 : 0;
