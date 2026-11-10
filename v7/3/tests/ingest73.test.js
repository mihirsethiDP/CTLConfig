/* v7/3 · tests/ingest73.test.js — the two plant-graph readers, checked on the core with no browser:
   reader 1 (equipment and its types), reader 2 (sensors on that equipment, from the same file or a separate list), and loading
   the result as the plant being set up so the flow runs on it.
   Usage: TZ=Asia/Calcutta node tests/ingest73.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const A = path.join(__dirname, '..', 'assets'); const VERBOSE = process.argv.includes('-v');
const g = global; g.window = g; g.V7_NO_V6_SHELL = true; g.addEventListener = () => {}; g.removeEventListener = () => {};
const store = new Map();
g.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
const el = () => ({ classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, removeAttribute() {}, addEventListener() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], style: {}, dataset: {}, innerHTML: '' });
g.document = { querySelector: () => null, querySelectorAll: () => [], createElement: el, body: el(), onkeydown: null };
g.location = { hash: '#/plants', href: 'http://localhost/prototype.html#/plants' }; g.scrollTo = () => {}; g.Blob = g.Blob || function Blob() {}; if (!g.URL) g.URL = {};
for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'structure73.js', 'ingest73.js', 'core7.js', 'calls73.js', 'decisions7.js']) vm.runInThisContext(fs.readFileSync(path.join(A, f), 'utf8'), { filename: f });
const V = g.V7; const IN = g.V7INGEST; V.boot();
const results = [];
function check(area, name, ok, detail) { results.push(!!ok); if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} [${area}] ${name}${detail ? ' — ' + detail : ''}`); }
const DP = 'digitalpaani';
const before = { eq: V.equipment(DP).length, sn: V.sensors(DP).length, ups: V.structure(DP).ups.length };

/* reader 1 on the real export */
const text = IN.sampleText(); const doc = JSON.parse(text);
const eq = IN.equipment(doc);
check('equipment', 'the real export: the same equipment the console reads, each with a database type', eq.ok && eq.rows.length === before.eq && eq.unknown.length === 0 && eq.rows.every((r) => r.known && r.typeName), `${eq.rows && eq.rows.length} vs ${before.eq}`);
check('equipment', 'a node drawn as one shape but stored as another type is read as the stored type', eq.rows.some((r) => r.label === 'Screen Chamber' && r.dbType === 'OS_TANK' && r.code === 'OS_TANK_SC' && r.drawnAs));
check('equipment', 'types are counted, and every row sits in one', eq.types.reduce((n, t) => n + t.count, 0) === eq.rows.length && eq.types.length > 5);
check('equipment', 'pipes, widgets and drawing items are counted apart from equipment', eq.other.widgets === 38 && eq.other.pipes > 0 && eq.other.links > 0 && eq.other.drawing > 0, JSON.stringify(eq.other));
check('equipment', 'not JSON, and JSON with no drawing, are refused in plain words', !IN.parse('{oops').ok && !IN.equipment({ hello: 1 }).ok && !IN.equipment({ layout: { cells: [] } }).ok && !IN.sensors(doc, null).ok);

/* reader 2 on the real export */
const sn = IN.sensors(doc, eq);
check('sensors', 'the real export: the same sensors the console reads, each on equipment from reader 1', sn.ok && sn.rows.length === before.sn && sn.rows.every((s) => eq.rows.some((r) => r.id === s.eqId)), `${sn.rows && sn.rows.length} vs ${before.sn}`);
check('sensors', 'a Switch widget reads Run status and a Level widget reads Level', sn.rows.every((s) => (s.widget === 'SWITCH_SENSOR' ? s.reads === 'Run status' : s.widget === 'LEVEL_SENSOR' ? s.reads === 'Level' : true)) && sn.unknown.length === 0);
check('sensors', 'equipment with and without a sensor adds up', sn.withS + sn.bare.length === eq.rows.length && sn.unlinked.length === 0 && sn.stray.length === 0);

/* a changed export: a new node of a type the database lacks, one retyped, a new sensor, a widget linked to nothing */
const d2 = JSON.parse(text); const cells = d2.layout.cells;
const pump = cells.find((c) => c.type === 'PMP'); const tank = cells.find((c) => c.type === 'TANK' || c.type === 'TANK_2' || c.type === 'OS_TANK');
cells.push({ type: 'LASER_DRYER', id: 'cell-new-1', equipmentId: 'eq-new-1', attrs: { label: { text: 'Sludge Dryer - 1' } } });
cells.push({ type: 'BLW', id: 'cell-new-2', attrs: { label: { text: 'Test Blower - 9' } } });
cells.push({ type: 'NUMBER_SENSOR', id: 'w-new-1', attrs: { label: { text: 'Motor current' } } }, { type: 'standard.Link', id: 'l-new-1', source: { id: 'w-new-1' }, target: { id: 'cell-new-2' } });
cells.push({ type: 'NUMBER_SENSOR', id: 'w-new-2', attrs: { label: { text: 'Mystery' } } }, { type: 'standard.Link', id: 'l-new-2', source: { id: pump.id }, target: { id: 'w-new-2' } });
cells.push({ type: 'LEVEL_SENSOR', id: 'w-new-3', attrs: { label: { text: 'Level' } } });
const zone = cells.find((c) => c.type === 'ZONE');
cells.push({ type: 'SWITCH_SENSOR', id: 'w-new-4', attrs: { label: { text: 'ON/OFF' } } }, { type: 'standard.Link', id: 'l-new-4', source: { id: 'w-new-4' }, target: { id: zone.id } });
const eq2 = IN.equipment(d2); const sn2 = IN.sensors(eq2.src, eq2);
check('changed', 'two more pieces of equipment; the unknown type code is listed as not in the database', eq2.ok && eq2.rows.length === before.eq + 2 && eq2.unknown.length === 1 && eq2.unknown[0].code === 'LASER_DRYER' && eq2.unknown[0].count === 1);
check('changed', 'a node with no equipment id is read under its drawing id, and said so', eq2.rows.some((r) => r.id === 'cell-new-2' && r.typeName && r.known) && eq2.notes.some((n) => /no equipment id/.test(n)));
check('changed', 'a Number widget labelled Motor current is read as Motor current on the new blower', sn2.rows.some((s) => s.eqId === 'cell-new-2' && s.reads === 'Motor current' && s.tag === 'AMP' && s.how === 'label'));
check('changed', 'a widget that does not say what it measures still lands on its pump, marked', sn2.rows.some((s) => s.eqId === pump.equipmentId && !s.reads) && sn2.unknown.length === 1);
check('changed', 'a widget linked to nothing, and one linked to a boundary, are left out and named', sn2.unlinked.length === 1 && sn2.stray.length === 1 && sn2.rows.length === before.sn + 2, `${sn2.unlinked.length}/${sn2.stray.length}/${sn2.rows.length}`);
check('changed', 'the tank used here is real', !!tank);

/* reader 2 from a separate list */
const first = eq.rows[0]; const second = eq.rows.find((r) => r.id !== first.id);
const list = [{ equipmentId: first.id, widget: 'NUMBER_SENSOR', code: 'AMP', reading: 6.2 }, { equipmentTag: second.tag.toLowerCase(), widget: 'NUMBER_SENSOR', measures: 'pH' }, { equipmentLabel: first.label, widget: 'SWITCH_SENSOR' }, { equipmentTag: 'NOPE-1', widget: 'LEVEL_SENSOR' }];
const sn3 = IN.sensors(list, eq);
check('list', 'a separate sensor list is matched by id, tag or name; a row naming no equipment is left out', sn3.ok && sn3.fromList && sn3.rows.length === 3 && sn3.stray.length === 1 && sn3.per[first.id].length === 2 && sn3.per[second.id][0].reads === 'pH' && sn3.per[first.id][0].reading === 6.2);
check('list', 'JSON that is neither a drawing nor a list is refused', !IN.sensors({ a: 1 }, eq).ok);

/* load the changed export and run the console on it */
const used = IN.use(JSON.stringify(d2), '', { name: 'Test Plant' }); V.reset();
check('load', 'the plant being set up now has the changed equipment and sensors', used.ok && V.equipment(DP).length === before.eq + 2 && V.sensors(DP).length === before.sn + 2 && V.plantName(DP) === 'Test Plant', `${V.equipment(DP).length}/${V.sensors(DP).length}/${V.plantName(DP)}`);
check('load', 'the new blower is a blower with a motor-current reading; the unknown type came in with nothing', !!V.eq(DP, 'cell-new-2') && V.sensors(DP).some((s) => String(s.id).startsWith('cell-new-2') && s.name === 'Motor current') && !!V.eq(DP, 'eq-new-1'));
check('load', 'the structure keeps what still exists and lists the new equipment as not placed', V.structure(DP).ups.length === before.ups && V.structure(DP).unplaced.includes('cell-new-2') && V.structure(DP).unplaced.includes('eq-new-1'));
check('load', 'the other plants are untouched and the flow still runs: library review, tasks, checklist', V.equipment('manesar').length > 0 && Array.isArray(V.libraryReview(DP)) && V.libraryReview(DP).length > 0 && Array.isArray(V.tasks(DP)) && !!V.checklist(DP));
check('load', 'it is kept: applying it again after a reload gives the same plant', IN.applyKept() === true && g.SCADA_SAMPLES[DP].equipment.length === before.eq + 2 && !!IN.kept());
/* a much smaller plant: three nodes */
const tiny = { layout: { cells: [{ type: 'PMP', id: 'a', equipmentId: 'pa', attrs: { label: { text: 'Feed Pump - 1' } } }, { type: 'PMP', id: 'b', equipmentId: 'pb', attrs: { label: { text: 'Feed Pump - 2' } } }, { type: 'TANK', id: 'c', equipmentId: 'tc', attrs: { label: { text: 'Raw Water Tank' } } }, { type: 'LEVEL_SENSOR', id: 'w', level: 40, attrs: { label: { text: 'Level' } } }, { type: 'standard.Link', id: 'l', source: { id: 'w' }, target: { id: 'c' } }, { type: 'Pipe', id: 'p', source: { id: 'c' }, target: { id: 'a' } }] } };
const u2 = IN.use(JSON.stringify(tiny), JSON.stringify([{ equipmentTag: 'FP-1', widget: 'NUMBER_SENSOR', code: 'AMP' }]), {}); let threw = null; try { V.reset(); } catch (e) { threw = e; }
check('load', 'a three-node plant with a separate sensor list loads and runs', u2.ok && !threw && V.equipment(DP).length === 3 && V.sensors(DP).length === 1 && V.structure(DP).ups.length === 0 && V.structure(DP).unplaced.length === 3 && !!V.checklist(DP), threw ? String(threw.stack || threw).slice(0, 300) : `${V.equipment(DP).length}/${V.sensors(DP).length}`);
IN.clear(); V.reset();
check('load', 'clearing goes back to the built-in plant graph', !IN.kept() && V.equipment(DP).length === before.eq && V.sensors(DP).length === before.sn && V.structure(DP).ups.length === before.ups && V.plantName(DP) === 'DigitalPaani');

const bad = results.filter((x) => !x).length;
console.log(`ingest73: ${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
