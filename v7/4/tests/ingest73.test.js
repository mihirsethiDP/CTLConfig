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
for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'structure73.js', 'nodes73.js', 'purposetags73.js', 'ingest73.js', 'core7.js', 'calls73.js', 'decisions7.js']) vm.runInThisContext(fs.readFileSync(path.join(A, f), 'utf8'), { filename: f });
const V = g.V7; const IN = g.V7INGEST; V.boot();
const results = [];
function check(area, name, ok, detail) { results.push(!!ok); if (VERBOSE || !ok) console.log(`${ok ? '  ok  ' : '  FAIL'} [${area}] ${name}${detail ? ' — ' + detail : ''}`); }
const DP = 'digitalpaani';
const before = { eq: V.equipment(DP).length, sn: V.sensors(DP).length, ups: V.structure(DP).ups.length };

/* reader 1 on the real export */
const text = IN.sampleText(); const doc = JSON.parse(text);
const eq = IN.equipment(doc);
check('equipment', 'the real export: the same equipment the console reads, each with a database type', eq.ok && eq.rows.length === before.eq && eq.unknown.length === 0 && eq.rows.every((r) => r.known && r.typeName), `${eq.rows && eq.rows.length} vs ${before.eq}`);
check('equipment', 'the screen chamber is the centre of a treatment step with nothing taking part, so it gets its own equipment type', eq.rows.some((r) => r.label === 'Screen Chamber' && r.dbType === 'OS_TANK_SC' && r.code === 'OS_TANK_SC' && r.offer && r.offer.library === 'equipment' && !r.drawnAs));
check('equipment', 'each node at the centre of a treatment step says which library it gets and why', eq.offers.length === 23 && eq.offers.filter((o) => o.library === 'process').length === 13 && eq.rows.filter((r) => r.process).length === 13 && eq.offers.every((o) => o.why && o.reason && g.CATALOGUE_BY_CODE[o.code]), `${eq.offers.length} / ${eq.offers.filter((o) => o.library === 'process').length}`);
check('equipment', 'types are counted, and every row sits in one', eq.types.reduce((n, t) => n + t.count, 0) === eq.rows.length && eq.types.length > 5);
check('equipment', 'pipes, widgets and drawing items are counted apart from equipment', eq.other.widgets === 38 && eq.other.pipes > 0 && eq.other.links > 0 && eq.other.drawing > 0, JSON.stringify(eq.other));
check('equipment', 'not JSON, and JSON with no drawing, are refused in plain words', !IN.parse('{oops').ok && !IN.equipment({ hello: 1 }).ok && !IN.equipment({ layout: { cells: [] } }).ok && !IN.sensors(doc, null).ok);

/* the export as the API returns it: wrapped in { results }, with drawing markup, and a valve whose name is only a number */
const wrapped = { results: JSON.parse(text), nestedResult: ['x'] };
wrapped.results.layout.cells.forEach((c) => { if (c.type === 'PMP') { c.markup = [{ tagName: 'svg', children: new Array(200).fill({ tagName: 'path', attributes: { d: 'M0 0' } }) }]; c.ports = { groups: {}, items: [] }; } });
wrapped.results.layout.cells.push({ type: 'VALVE_2', id: 'cell-3456', equipmentId: 'eq-3456', attrs: { label: { text: '3456' } }, ports: { items: [] } });
const eqW = IN.equipment(wrapped); const snW = eqW.ok ? IN.sensors(eqW.src, eqW) : { rows: [] };
check('wrapped', 'an export wrapped in { results: { layout } } is read: one more piece of equipment, the same sensors', eqW.ok && eqW.rows.length === before.eq + 1 && snW.rows.length === before.sn, eqW.error || `${eqW.rows.length}/${snW.rows.length}`);
check('wrapped', 'the valve named "3456" is a Two way Valve tagged 3456', eqW.ok && eqW.rows.some((r) => r.id === 'eq-3456' && r.tag === '3456' && r.typeName === 'Two way Valve'), eqW.ok ? JSON.stringify(eqW.rows.find((r) => r.id === 'eq-3456')) : '');
const usedW = IN.use(JSON.stringify(wrapped), '', {}); V.reset();
check('wrapped', 'it loads, and what is kept has no drawing markup', usedW.ok && V.equipment(DP).length === before.eq + 1 && !!V.eq(DP, 'eq-3456') && !/markup|ports/.test(JSON.stringify(IN.kept())) && JSON.stringify(IN.kept()).length < JSON.stringify(wrapped).length / 2, usedW.error);
IN.clear(); V.reset();

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

/* reader 2 on the equipment collection: sensors under itemDetails.sensors, recognised by abbreviation */
const O = (id) => ({ $oid: id }); const NM = (n) => [{ question: 'Name', answer: n }, { question: 'Color', answer: { name: 'Blue' } }];
const S = (abr, tag, name, cat, extra) => ({ sensorName: name, sensorTag: tag, sensorTypeAbr: abr, category: cat, isEnabled: true, dataInputType: 'auto', _id: O('s' + tag), ...(extra || {}) });
const tankRow = eq.rows.find((r) => r.label === 'Chlorine Contact Tank'); const blwRow = eq.rows.find((r) => r.label === 'MBBR Air Blower - 1'); const scRow = eq.rows.find((r) => r.label === 'Screen Chamber'); const twRow = eq.rows.find((r) => r.label === 'Treated Water Tank');
const recs = [
  { _id: O(tankRow.id), nodeType: 'OS_TANK', equipmentType: 'TANK', isArchived: false, itemDetails: { answer: NM('Chlorine Contact Tank'), sensors: [S('LV_', 'LV_OS_TANK_CCT_1:UPT', 'Chlorine Contact Tank LV', 'Level Transmitters')] } },
  { _id: O(twRow.id), nodeType: 'OS_TANK', isArchived: false, itemDetails: { answer: NM('Treated Water Tank'), sensors: [{ sensorTag: 'LT_OS_TANK_TWT_1:UPT', sensorName: 'Treated Water Tank LT', isEnabled: true }, S('TUR_', 'TUR_OS_TANK_TWT_1:UPT', 'Treated Water Tank TUR', 'Turbidity'), S('PH_', 'PH_OS_TANK_TWT_1:UPT', 'Treated Water Tank PH', 'PH', { isEnabled: false })] } },
  { _id: O(blwRow.id), nodeType: 'BLW', equipmentType: 'PUMP', isArchived: false, itemDetails: { answer: NM('MBBR Air Blower - 1'), sensors: [S('MAN_', 'MAN_BLW_MAB1_1:UPT', 'MBBR Air Blower - 1 MAN', 'Equipment Auto/Manual Status'), S('ONOFF_', 'ONOFF_BLW_MAB1_1:UPT', 'MBBR Air Blower - 1 ONOFF', 'Equipment ON/OFF'), S('TRP_', 'TRP_BLW_MAB1_1:UPT', 'MBBR Air Blower - 1 TRP', 'Equipment Trip Status'), S('DI_MAIN_UND_', 'DI_MAIN_UND_BLW_MAB1_1:UPT', 'Under Maintenance MBBR Air Blower - 1', 'Manual Input', { dataType: 'boolean', dataInputType: 'manual' })] } },
  { _id: O(scRow.id), nodeType: 'OS_TANK_SC', isArchived: false, itemDetails: { answer: NM('Screen Chamber'), sensors: [S('BS25_', 'BS25_OS_TANK_SC_SC_1:UPT', 'Screen Chamber BS25', 'Bar Screen Level'), S('BS100_', 'BS100_OS_TANK_SC_SC_1:UPT', 'Screen Chamber BS100', 'Bar Screen Level')] } },
  { _id: O('pipe-1'), nodeType: 'Pipe', isArchived: false, itemDetails: { answer: NM('J3 to J8'), source: tankRow.id, target: twRow.id, sensors: [S('FR_', 'FR_Pipe_JTJ_1:UPT', 'J3 J8 FR', 'Flow Meters'), S('PR_', 'PR_Pipe_JTJ_1:UPT', 'J6 J8 PR', 'Pressure Transmitters')] } },
  { _id: O('plant-1'), nodeType: 'PLANT_EQUIPMENT', isArchived: false, itemDetails: { answer: NM('Ireo Uptown'), sensors: [S('HTR_', 'HTR_PLANT_EQUIPMENT_IU_1:UPT', 'Ireo Uptown HTR', 'Hooter')] } },
  { _id: O('sw-1'), nodeType: 'SWITCH_SENSOR', isArchived: false, itemDetails: { answer: NM('ON/OFF'), sensors: [{ _id: 'sONOFF_BLW_MAB1_1:UPT', sensorTag: 'ONOFF_BLW_MAB1_1:UPT' }] } },
  { _id: O('gone-1'), nodeType: 'SUB_PMP', isArchived: false, itemDetails: { answer: NM('Sump Pump - 1'), sensors: [S('ONOFF_', 'ONOFF_SUB_PMP_SP1_1:UPT', 'Sump Pump - 1 ONOFF', 'Equipment ON/OFF')] } },
  { _id: O('old-1'), nodeType: 'PMP', isArchived: true, itemDetails: { answer: NM('Old Pump - 9'), sensors: [S('ONOFF_', 'ONOFF_PMP_OLD_1:UPT', 'Old Pump ONOFF', 'Equipment ON/OFF')] } },
];
const snR = IN.sensors(recs, eq); const on = (row) => (snR.per[row.id] || []);
check('records', 'the equipment collection is read: 9 sensors on four pieces of equipment, matched by id', snR.ok && snR.fromRecords && snR.rows.length === 9 && snR.withS === 4, snR.error || String(snR.rows && snR.rows.length));
check('records', 'LV is Level and LT is Level too; both map to the library Level reading', on(tankRow)[0].reads === 'Level' && on(tankRow)[0].tag === 'LVL' && on(tankRow)[0].how === 'abbr' && on(twRow).some((s) => s.abbr === 'LT' && s.reads === 'Level' && s.tag === 'LVL' && s.how === 'tag'));
check('records', 'ONOFF, TRP and MAN are ON/OFF, Trip and Auto Manual, read as Run status, Trip contact and Auto / manual', on(blwRow).filter((s) => s.library).map((s) => s.reads + '>' + s.tag).sort().join() === 'Auto Manual>AM,ON/OFF>RUN,Trip>TRP'.replace('TRP', 'TRIP'), on(blwRow).map((s) => s.reads + '>' + s.tag).join());
check('records', 'an abbreviation the purpose tags lack keeps its own name and is said so', on(blwRow).some((s) => s.abbr === 'DI_MAIN_UND' && !s.known && s.reads === 'Under Maintenance' && s.manual) && snR.notes.some((n) => /DI_MAIN_UND \(1\)/.test(n)));
check('records', 'recognised with no library reading: Bar Screen 25% and 100%, Turbidity is a library reading', on(scRow).map((s) => s.reads).join() === 'Bar Screen 25%,Bar Screen 100%' && on(scRow).every((s) => s.known && !s.library) && on(twRow).some((s) => s.reads === 'Turbidity' && s.tag === 'TURB'));
check('records', 'sensors on pipes wait for the next phase; plant, missing-equipment and switched-off sensors are left out; widgets and archived records are skipped', snR.pipes.length === 2 && snR.stray.length === 2 && snR.notes.some((n) => /1 sensor switched off/.test(n)) && !snR.rows.some((s) => /OLD/.test(s.sensorTag)), snR.pipes.length + '/' + snR.stray.length);
const eqR = IN.equipment(recs); const snRR = IN.sensors(eqR.records, eqR);
check('records', 'the collection alone also gives the equipment: five pieces with their types, and the pipe between two tanks', eqR.ok && eqR.rows.length === 5 && eqR.rows.some((r) => r.label === 'Sump Pump - 1' && r.typeName === 'Submersible Pump') && eqR.other.pipes === 1 && eqR.model.links.length === 1 && snRR.rows.length === 10, eqR.error || (eqR.rows.length + '/' + eqR.model.links.length + '/' + snRR.rows.length));
const usedR = IN.use(text, JSON.stringify(recs), {}); V.reset();
const names = (id) => V.sensors(DP).filter((s) => String(s.id).startsWith(id + '_')).map((s) => s.name).sort().join();
check('records', 'loaded: the blower has Auto / manual, Run status, Trip contact and Under Maintenance; the screen chamber its bar-screen levels', usedR.ok && names(blwRow.id) === 'Auto / manual,Run status,Trip contact,Under Maintenance' && names(scRow.id) === 'Bar Screen 100%,Bar Screen 25%' && V.sensors(DP).length === 9, names(blwRow.id) + ' | ' + names(scRow.id) + ' | ' + V.sensors(DP).length);
check('records', 'what is kept is the small model, not the files, and it reads back the same', IN.applyKept() === true && !IN.kept().eq && JSON.stringify(IN.kept()).length < 60000 && g.SCADA_SAMPLES[DP].equipment.reduce((n, e) => n + e.sensors.length, 0) === 9 && g.SCADA_SENSOR_MAP.BS25 === 'Bar Screen 25%', String(JSON.stringify(IN.kept()).length));
/* a browser with no room left: the Visualization still loads, for this session */
IN.clear(); V.reset(); const set0 = g.localStorage.setItem; g.localStorage.setItem = (k, v) => { if (k === 'ctl74.ingest') throw new Error('QuotaExceededError'); return set0(k, v); };
const usedQ = IN.use(text, JSON.stringify(recs), {}); let threwQ = null; try { V.reset(); } catch (e) { threwQ = e; }
check('records', 'with no room in the browser it loads for this session and says so', usedQ.ok && usedQ.session === true && !threwQ && V.sensors(DP).length === 9 && IN.kept() && IN.kept().session === true && g.localStorage.getItem('ctl74.ingest') == null);
g.localStorage.setItem = set0;
IN.clear(); V.reset();

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
check('load', 'it is kept: applying it again after a reload gives the same plant', IN.applyKept() === true && g.SCADA_SAMPLES[DP].equipment.length === before.eq + 2 && !!IN.kept() && V.structure(DP).unplaced.includes('cell-new-2'));
/* a much smaller plant: three nodes */
const tiny = { layout: { cells: [{ type: 'PMP', id: 'a', equipmentId: 'pa', attrs: { label: { text: 'Feed Pump - 1' } } }, { type: 'PMP', id: 'b', equipmentId: 'pb', attrs: { label: { text: 'Feed Pump - 2' } } }, { type: 'TANK', id: 'c', equipmentId: 'tc', attrs: { label: { text: 'Raw Water Tank' } } }, { type: 'LEVEL_SENSOR', id: 'w', level: 40, attrs: { label: { text: 'Level' } } }, { type: 'standard.Link', id: 'l', source: { id: 'w' }, target: { id: 'c' } }, { type: 'Pipe', id: 'p', source: { id: 'c' }, target: { id: 'a' } }] } };
const u2 = IN.use(JSON.stringify(tiny), JSON.stringify([{ equipmentTag: 'FP-1', widget: 'NUMBER_SENSOR', code: 'AMP' }]), {}); let threw = null; try { V.reset(); } catch (e) { threw = e; }
check('load', 'a three-node plant with a separate sensor list loads and runs', u2.ok && !threw && V.equipment(DP).length === 3 && V.sensors(DP).length === 1 && V.structure(DP).ups.length === 0 && V.structure(DP).unplaced.length === 3 && !!V.checklist(DP), threw ? String(threw.stack || threw).slice(0, 300) : `${V.equipment(DP).length}/${V.sensors(DP).length}`);
IN.clear(); V.reset();
check('load', 'clearing goes back to the built-in Visualization', !IN.kept() && V.equipment(DP).length === before.eq && V.sensors(DP).length === before.sn && V.structure(DP).ups.length === before.ups && V.plantName(DP) === 'DigitalPaani');

const bad = results.filter((x) => !x).length;
console.log(`ingest73: ${results.length - bad}/${results.length} checks passed`);
process.exit(bad ? 1 : 0);
