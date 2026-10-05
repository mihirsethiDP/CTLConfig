/* The library (three levels) and sample SCADA models. Loaded after data.js.
   SCADA owns the plant: zones, equipment, sensor widgets, connections. The library owns what each
   equipment type, unit process and plant type inherits. The console detects, inherits, asks for review. */

/* ── 1. Equipment types: archetype, suggested tier, expected programme, usual sensors ─────── */
window.CATALOGUE = [
  { type: 'Centrifugal blower', archetype: 'rotating', tier: 'A', expects: ['mechanical PM'], prefix: 'BL', sensors: [
    { name: 'Line pressure', tag: 'PRESS', unit: 'bar', kind: 'process', valid: [0, 1.2], direction: 'above', reading: 0.58 },
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 60], direction: 'above', reading: 38 },
    { name: 'Trip contact', tag: 'TRIP', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 0 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 120 } ] },
  { type: 'Aeration basin', archetype: 'vessel', tier: 'B', expects: [], prefix: 'AT', sensors: [
    { name: 'Dissolved oxygen', tag: 'DO', unit: 'mg/L', kind: 'analytical', valid: [0, 6], direction: 'below', reading: 2.1 },
    { name: 'MLSS', tag: 'MLSS', unit: 'mg/L', kind: 'analytical', valid: [0, 12000], direction: 'above', reading: 3200 },
    { name: 'Temperature', tag: 'TEMP', unit: '°C', kind: 'process', valid: [0, 60], direction: 'above', reading: 29 } ] },
  { type: 'MBBR reactor', archetype: 'vessel', tier: 'B', expects: ['media inspection'], prefix: 'MBBR', sensors: [
    { name: 'Dissolved oxygen', tag: 'DO', unit: 'mg/L', kind: 'analytical', valid: [0, 6], direction: 'below', reading: 2.4 } ] },
  { type: 'Anaerobic tank', archetype: 'vessel', tier: 'B', expects: ['desludging'], prefix: 'AN', sensors: [
    { name: 'pH', tag: 'PH', unit: 'pH', kind: 'analytical', valid: [1, 14], direction: 'below', reading: 7.0 },
    { name: 'Temperature', tag: 'TEMP', unit: '°C', kind: 'process', valid: [0, 60], direction: 'above', reading: 31 } ] },
  { type: 'Equalisation tank', archetype: 'vessel', tier: 'C', expects: ['cleaning'], prefix: 'EQ', sensors: [
    { name: 'Level', tag: 'LVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'above', reading: 58 },
    { name: 'Sump flood switch', tag: 'FLOOD', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 0 },
    { name: 'pH', tag: 'PH', unit: 'pH', kind: 'analytical', valid: [1, 14], direction: 'above', reading: 7.3 } ] },
  { type: 'Process tank', archetype: 'vessel', tier: 'C', expects: ['cleaning'], prefix: 'T', sensors: [
    { name: 'Level', tag: 'LVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'above', reading: 55 } ] },
  { type: 'Mechanical bar screen', archetype: 'fixed', tier: 'B', expects: ['inspection'], prefix: 'BS', sensors: [
    { name: 'Level differential', tag: 'DH', unit: 'mm', kind: 'process', valid: [0, 500], direction: 'above', reading: 40 } ] },
  { type: 'Grit chamber', archetype: 'fixed', tier: 'C', expects: ['desludging'], prefix: 'GC', sensors: [] },
  { type: 'Circular clarifier', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'SC', sensors: [
    { name: 'Sludge blanket', tag: 'BLK', unit: 'm', kind: 'analytical', valid: [0, 4], direction: 'above', reading: 0.7 } ] },
  { type: 'Tube settler', archetype: 'vessel', tier: 'B', expects: ['cleaning'], prefix: 'TS', sensors: [
    { name: 'Sludge blanket', tag: 'BLK', unit: 'm', kind: 'analytical', valid: [0, 4], direction: 'above', reading: 0.5 } ] },
  { type: 'Membrane bioreactor skid', archetype: 'membrane', tier: 'A', expects: ['CIP'], prefix: 'MBR', sensors: [
    { name: 'Permeability', tag: 'PERM', unit: 'LMH/bar', kind: 'process', valid: [0, 400], direction: 'below', reading: 115 },
    { name: 'Outlet turbidity', tag: 'TURB', unit: 'NTU', kind: 'analytical', valid: [0, 100], direction: 'above', reading: 0.6 },
    { name: 'Trans-membrane pressure', tag: 'TMP', unit: 'bar', kind: 'process', valid: [0, 1], direction: 'above', reading: 0.22 } ] },
  { type: 'Multigrade filter', archetype: 'vessel', tier: 'B', expects: ['backwash'], prefix: 'MGF', sensors: [
    { name: 'Differential pressure', tag: 'DP', unit: 'bar', kind: 'process', valid: [0, 3], direction: 'above', reading: 0.8 } ] },
  { type: 'Ultrafiltration skid', archetype: 'membrane', tier: 'A', expects: ['CIP'], prefix: 'UF', cycles: true, sensors: [
    { name: 'Recovery', tag: 'REC', unit: '%', kind: 'computed', expr: 'PERM_FLOW / FEED_FLOW × 100', valid: [0, 100], direction: 'below', reading: 80 },
    { name: 'Inlet pressure', tag: 'PIN', unit: 'bar', kind: 'process', valid: [0, 6], direction: 'above', reading: 2.0 } ] },
  { type: 'RO skid', archetype: 'membrane', tier: 'A', expects: ['CIP'], prefix: 'RO', sensors: [
    { name: 'Recovery', tag: 'REC', unit: '%', kind: 'computed', expr: 'PERM_FLOW / FEED_FLOW × 100', valid: [0, 100], direction: 'below', reading: 72 },
    { name: 'Inlet pressure', tag: 'PIN', unit: 'bar', kind: 'process', valid: [0, 20], direction: 'above', reading: 9.5 } ] },
  { type: 'Softener', archetype: 'vessel', tier: 'B', expects: ['regeneration'], prefix: 'SF', sensors: [
    { name: 'Throughput', tag: 'THR', unit: 'm³', kind: 'meter', valid: [0, 999999], direction: null, reading: 4200 } ] },
  { type: 'Cartridge filter', archetype: 'fixed', tier: 'C', expects: ['cartridge replacement'], prefix: 'CF', sensors: [
    { name: 'Differential pressure', tag: 'DP', unit: 'bar', kind: 'process', valid: [0, 3], direction: 'above', reading: 0.3 } ] },
  { type: 'Hypochlorite dosing unit', archetype: 'dosing', tier: 'A', expects: ['pump PM', 'refill'], prefix: 'CDU', sensors: [
    { name: 'Residual chlorine', tag: 'FRC', unit: 'mg/L', kind: 'analytical', valid: [0, 10], direction: 'below', reading: 0.5 },
    { name: 'Hypo tank level', tag: 'TLVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 55 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 900 } ] },
  { type: 'Dosing tank', archetype: 'vessel', tier: 'B', expects: ['refill'], prefix: 'DT', sensors: [
    { name: 'Hypo tank level', tag: 'TLVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 60 } ] },
  { type: 'UV unit', archetype: 'fixed', tier: 'A', expects: ['lamp replacement'], prefix: 'UV', sensors: [
    { name: 'Lamp fault', tag: 'TRIP', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 0 } ] },
  { type: 'Ozonator', archetype: 'dosing', tier: 'B', expects: ['pump PM'], prefix: 'OZ', sensors: [
    { name: 'Trip contact', tag: 'TRIP', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 0 } ] },
  { type: 'Gas chlorinator', archetype: 'dosing', tier: 'A', expects: ['tonner change'], prefix: 'CL', sensors: [
    { name: 'Residual chlorine', tag: 'FRC', unit: 'mg/L', kind: 'analytical', valid: [0, 10], direction: 'below', reading: 0.4 } ] },
  { type: 'Progressive cavity pump', archetype: 'rotating', tier: 'C', expects: ['mechanical PM'], prefix: 'SP', sensors: [
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 40 } ] },
  { type: 'Submersible pump', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'P', sensors: [
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 40], direction: 'above', reading: 14 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 60 } ] },
  { type: 'Mixer', archetype: 'rotating', tier: 'C', expects: ['mechanical PM'], prefix: 'MX', sensors: [
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 30], direction: 'above', reading: 6 } ] },
  { type: 'Screw press', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'SP', sensors: [
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 40], direction: 'above', reading: 11 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 300 } ] },
  { type: 'Filter press', archetype: 'rotating', tier: 'B', expects: ['mechanical PM', 'cloth replacement'], prefix: 'FP', sensors: [
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 150 } ] },
  { type: 'DAF unit', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'DAF', sensors: [
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 40], direction: 'above', reading: 9 } ] },
  { type: 'Air compressor', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'AC', sensors: [
    { name: 'Line pressure', tag: 'PRESS', unit: 'bar', kind: 'process', valid: [0, 12], direction: 'below', reading: 7.2 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 800 } ] },
  { type: 'Cooling tower', archetype: 'rotating', tier: 'B', expects: ['mechanical PM', 'cleaning'], prefix: 'CT', sensors: [
    { name: 'Temperature', tag: 'TEMP', unit: '°C', kind: 'process', valid: [0, 80], direction: 'above', reading: 31 } ] },
  { type: 'Control panel (MCC)', archetype: 'panel', tier: 'A', expects: ['inspection'], prefix: 'MCC', sensors: [
    { name: 'Incomer trip', tag: 'TRIP', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 0 } ] },
];

/* ── 2. SCADA palette → library. Every type SCADA can draw, and what it is to us. ───────────
   kind 'equipment' maps to a library type; 'zone' becomes a unit process; 'part' belongs to a
   machine; 'device' is DigitalPaani hardware; 'structure' and 'plant' carry nothing. */
window.SCADA_PALETTE = [
  ['PLANT_EQUIPMENT', 'Plant', 'plant', null], ['ZONE', 'Zone', 'zone', null], ['JOINS', 'Joint', 'structure', null], ['BUILDING', 'Building', 'structure', null],
  ['BLW', 'Blower', 'equipment', 'Centrifugal blower'], ['M_BLW', 'Mini Blower', 'equipment', 'Centrifugal blower'],
  ['SBR_TANK', 'SBR', 'equipment', 'Aeration basin'], ['CASS_BASIN', 'Cass Basin', 'equipment', 'Aeration basin'], ['OS_TANK_DF', 'Diffuser Tank', 'equipment', 'Aeration basin'], ['CASCADE_AREATOR', 'Cascade Aerator', 'equipment', 'Aeration basin'],
  ['MBBR', 'MBBR', 'equipment', 'MBBR reactor'], ['ANAEROBIC_TANK', 'Anaerobic tank', 'equipment', 'Anaerobic tank'], ['MBR', 'MBR', 'equipment', 'Membrane bioreactor skid'],
  ['OS_TANK', 'Open Skeleton Tank', 'equipment', 'Equalisation tank'], ['OS_TANK_SP', 'Submersible Tank', 'equipment', 'Equalisation tank'],
  ['CP_TANK', 'Closed Process Tank', 'equipment', 'Process tank'], ['OP_TANK', 'Open Process Tank', 'equipment', 'Process tank'], ['TANK', 'Tank', 'equipment', 'Process tank'], ['TANK_2', 'Tank 2', 'equipment', 'Process tank'], ['OVERHEAD_T', 'Overhead Tank', 'equipment', 'Process tank'], ['SH_TANK', 'Oil & Grease Tank', 'equipment', 'Process tank'], ['VTG_CHAMBER', 'Vtg Chamber', 'equipment', 'Process tank'], ['QUADSON_EVAPORATOR', 'Quadson evaporator', 'equipment', 'Process tank'],
  ['MECHANICAL_SCREEN', 'Mechanical Screen', 'equipment', 'Mechanical bar screen'], ['OS_TANK_SC', 'Screen Chamber Tank', 'equipment', 'Mechanical bar screen'], ['ROTARY_DRUM', 'Rotary Drum', 'equipment', 'Mechanical bar screen'],
  ['GRIT_CHAMBER', 'Grit Chamber', 'equipment', 'Grit chamber'], ['GRIT_CLASSIFIER', 'Grit Classifier', 'equipment', 'Grit chamber'], ['HYDROCYCLONE', 'Hydro Cyclone', 'equipment', 'Grit chamber'],
  ['CLARIFIER', 'Clarifier Tank', 'equipment', 'Circular clarifier'], ['T_SETTLER', 'Tube settler', 'equipment', 'Tube settler'], ['DAF', 'Dissolved Air Floatation', 'equipment', 'DAF unit'],
  ['ACF_MGF', 'ACF/MGF', 'equipment', 'Multigrade filter'], ['CARTRIDGE_FILTER', 'Cartridge Filter', 'equipment', 'Cartridge filter'], ['UF_MEM', 'UF Membrane', 'equipment', 'Ultrafiltration skid'], ['RO', 'RO', 'equipment', 'RO skid'], ['SOFTNER', 'Softner', 'equipment', 'Softener'],
  ['D_PMP', 'Dosing Pump', 'equipment', 'Hypochlorite dosing unit'], ['DOS_TANK', 'Dosing Tank', 'equipment', 'Dosing tank'], ['UV', 'UV', 'equipment', 'UV unit'], ['OZONATOR', 'Ozonator', 'equipment', 'Ozonator'], ['GAS_TONNER', 'Gas Tonner', 'equipment', 'Gas chlorinator'],
  ['PMP', 'Pump', 'equipment', 'Progressive cavity pump'], ['SUB_PMP', 'Submersible Pump', 'equipment', 'Submersible pump'], ['BT_PMP', 'Booster Pump', 'equipment', 'Submersible pump'],
  ['OS_TANK_AG', 'Agitator', 'equipment', 'Mixer'], ['FLASH_MIXER', 'Flash Mixer', 'equipment', 'Mixer'], ['FLOCCULATION', 'Flocculation', 'equipment', 'Mixer'], ['STATIC_MIXER', 'Static Mixer', 'structure', null],
  ['SC_PRESS', 'Screw Press', 'equipment', 'Screw press'], ['F_PRESS', 'Filter Press', 'equipment', 'Filter press'],
  ['COOLING_TOWER', 'Cooling Tower', 'equipment', 'Cooling tower'], ['AIR_COMPRESSURE', 'Air Compressor', 'equipment', 'Air compressor'], ['CAVITATOR', 'Cavitator', 'equipment', null],
  ['MOTOR', 'Motor', 'part', null], ['VALVE_2', 'Two way Valve', 'part', null], ['VALVE_3', 'Three way Valve', 'part', null],
  ['MINI_SABRE', 'Small Sabre', 'device', null], ['BIG_SABRE', 'Sabre', 'device', null], ['BIO_HEALTH_TRACKER', 'Bio Health Tracker', 'device', null],
].map(([code, name, kind, type]) => ({ code, name, kind, type }));
window.SCADA_TYPE_MAP = {}; window.SCADA_PALETTE.forEach((p) => { if (p.kind === 'equipment' && p.type) window.SCADA_TYPE_MAP[p.code] = p.type; });
window.SCADA_KIND = {}; window.SCADA_PALETTE.forEach((p) => { window.SCADA_KIND[p.code] = p.kind; });

/* SCADA sensor widgets → readings. The widget says how it is drawn; the label says what it measures. */
window.SCADA_WIDGETS = { LEVEL_SENSOR: 'Level widget', NUMBER_SENSOR: 'Number widget', 'chart.knob': 'Gauge', SWITCH_SENSOR: 'Switch' };
window.SCADA_SENSOR_MAP = { DO: 'Dissolved oxygen', MLSS: 'MLSS', TEMP: 'Temperature', PRESS: 'Line pressure', AMP: 'Motor current', TRIP: 'Trip contact', HRS: 'Run hours', LVL: 'Level', FLOOD: 'Sump flood switch', PH: 'pH', DH: 'Level differential', BLK: 'Sludge blanket', PERM: 'Permeability', TURB: 'Outlet turbidity', TMP: 'Trans-membrane pressure', DP: 'Differential pressure', REC: 'Recovery', PIN: 'Inlet pressure', FRC: 'Residual chlorine', TLVL: 'Hypo tank level', THR: 'Throughput' };

/* ── 3. Unit process profiles: detected from SCADA zone names, or from the types inside ───── */
window.UP_PROFILES = [
  { id: 'inlet', name: 'Inlet Works', keywords: ['inlet', 'screen', 'grit', 'intake', 'collection', 'raw'], expectsTypes: ['Mechanical bar screen', 'Grit chamber'], rounds: [{ name: 'Screenings and grit check', every: { n: 1, unit: 'day' } }], groups: [{ type: 'Submersible pump', name: 'Raw water pump group' }], criticality: [{ type: 'Submersible pump', soleUnit: 'A', withStandby: 'B' }] },
  { id: 'bal', name: 'Balancing', keywords: ['equal', 'balanc', 'eq tank', 'sump', 'neutral', 'oil'], expectsTypes: ['Equalisation tank', 'Submersible pump', 'Mixer'], rounds: [], groups: [{ type: 'Submersible pump', name: 'Transfer pump group' }], criticality: [{ type: 'Submersible pump', soleUnit: 'A', withStandby: 'B' }] },
  { id: 'bio', name: 'Biological', keywords: ['aeration', 'aer', 'bio', 'sbr', 'basin', 'reactor', 'mbbr', 'anaerobic', 'cass'], expectsTypes: ['Aeration basin', 'MBBR reactor', 'Anaerobic tank', 'Centrifugal blower'], rounds: [{ name: 'SV30 settling test', every: { n: 1, unit: 'day' } }], groups: [{ type: 'Centrifugal blower', name: 'Blower group' }], criticality: [{ type: 'Centrifugal blower', soleUnit: 'A', withStandby: 'B' }] },
  { id: 'sep', name: 'Separation', keywords: ['clarif', 'settl', 'mbr', 'separation', 'secondary', 'daf', 'flotation', 'floatation'], expectsTypes: ['Circular clarifier', 'Tube settler', 'Membrane bioreactor skid', 'DAF unit'], rounds: [], groups: [] },
  { id: 'filt', name: 'Filtration', keywords: ['filter', 'filtration', 'mgf', 'acf', 'uf', 'ro', 'tertiary', 'soft', 'cartridge'], expectsTypes: ['Multigrade filter', 'Ultrafiltration skid', 'RO skid', 'Softener', 'Cartridge filter'], rounds: [], groups: [{ type: 'Submersible pump', name: 'Filter feed pump group' }] },
  { id: 'dis', name: 'Disinfection', keywords: ['chlor', 'disinf', 'hypo', 'uv', 'dosing', 'ozon'], expectsTypes: ['Hypochlorite dosing unit', 'Dosing tank', 'UV unit', 'Ozonator', 'Gas chlorinator'], rounds: [{ name: 'Outlet residual chlorine check', every: { n: 1, unit: 'day' } }], groups: [] },
  { id: 'sludge', name: 'Sludge handling', keywords: ['sludge', 'dewater', 'centrifuge', 'press', 'thicken'], expectsTypes: ['Progressive cavity pump', 'Screw press', 'Filter press'], rounds: [{ name: 'Sludge wasting', every: { n: 1, unit: 'week' } }], groups: [] },
  { id: 'util', name: 'Utilities', keywords: ['mcc', 'panel', 'electrical', 'plc', 'compressor', 'cooling', 'utility'], expectsTypes: ['Control panel (MCC)', 'Air compressor', 'Cooling tower'], rounds: [], groups: [] },
];

/* ── 4. Plant profiles: what a plant of this type inherits as a whole ─────────────────────── */
window.PLANT_PROFILES = {
  STP: { expectsUnitProcesses: ['Inlet Works', 'Balancing', 'Biological', 'Separation', 'Disinfection', 'Sludge handling'],
    rounds: [ { name: 'Daily logbook round', workType: 'routine', every: { n: 1, unit: 'day' }, flow: 'f_logbook' }, { name: 'Monthly compliance sample', workType: 'routine', every: { n: 1, unit: 'month' }, statutory: true, verify: true }, { name: 'Hooter function test', workType: 'routine', every: { n: 3, unit: 'month' }, verify: true }, { name: 'Weekly housekeeping round', workType: 'routine', every: { n: 1, unit: 'week' } } ],
    milestones: ['Zero overdue tasks this week', '90 days without an Emergency'] },
  ETP: { expectsUnitProcesses: ['Inlet Works', 'Balancing', 'Biological', 'Separation', 'Sludge handling'],
    rounds: [ { name: 'Daily logbook round', workType: 'routine', every: { n: 1, unit: 'day' }, flow: 'f_logbook' }, { name: 'Monthly compliance sample', workType: 'routine', every: { n: 1, unit: 'month' }, statutory: true, verify: true }, { name: 'Hooter function test', workType: 'routine', every: { n: 3, unit: 'month' }, verify: true } ],
    milestones: ['Zero overdue tasks this week'] },
  WTP: { expectsUnitProcesses: ['Inlet Works', 'Filtration', 'Disinfection'],
    rounds: [ { name: 'Daily logbook round', workType: 'routine', every: { n: 1, unit: 'day' }, flow: 'f_logbook' }, { name: 'Weekly bacteriological sample', workType: 'routine', every: { n: 1, unit: 'week' }, statutory: true, verify: true }, { name: 'Hooter function test', workType: 'routine', every: { n: 3, unit: 'month' }, verify: true } ],
    milestones: ['30 days of outlet within limits'] },
};

/* ── 5. Standard sets for the new library types (alerts and schedules each type inherits) ──── */
window.SEED.standardSets.push(
  { id: 't_subpump', type: 'Submersible pump', usedAt: 38, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { caution: 28, minor: 32 } }], schedules: [{ name: 'Bearing and seal service', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 600 }] },
  { id: 't_mcc', type: 'Control panel (MCC)', usedAt: 29, alerts: [{ name: 'Incomer tripped', sensorKind: 'Incomer trip', direction: 'above', limits: { emergency: 1 } }], schedules: [{ name: 'Thermal and tightness inspection', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } }] },
  { id: 't_mbbr', type: 'MBBR reactor', usedAt: 14, alerts: [{ name: 'DO low', sensorKind: 'Dissolved oxygen', direction: 'below', limits: { minor: 2.0, major: 1.0 }, flow: 'f_lowdo', scope: 'unitProcess' }], schedules: [{ name: 'Media and diffuser inspection', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_anaer', type: 'Anaerobic tank', usedAt: 7, alerts: [{ name: 'pH low', sensorKind: 'pH', direction: 'below', limits: { minor: 6.5, major: 6.0 } }], schedules: [{ name: 'Desludging', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_ptank', type: 'Process tank', usedAt: 41, alerts: [{ name: 'Level high', sensorKind: 'Level', direction: 'above', limits: { caution: 85, major: 95 } }], schedules: [{ name: 'Tank cleaning', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_grit', type: 'Grit chamber', usedAt: 22, alerts: [], schedules: [{ name: 'Grit removal', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' } }] },
  { id: 't_tube', type: 'Tube settler', usedAt: 12, alerts: [{ name: 'Sludge blanket high', sensorKind: 'Sludge blanket', direction: 'above', limits: { minor: 1.0 } }], schedules: [{ name: 'Tube module cleaning', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } }] },
  { id: 't_ro', type: 'RO skid', usedAt: 16, alerts: [{ name: 'Recovery low', sensorKind: 'Recovery', direction: 'below', limits: { minor: 65, major: 55 } }, { name: 'Inlet pressure high', sensorKind: 'Inlet pressure', direction: 'above', limits: { minor: 14 } }], schedules: [{ name: 'Membrane CIP', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } }] },
  { id: 't_soft', type: 'Softener', usedAt: 20, alerts: [], schedules: [{ name: 'Regenerate softener', workType: 'condition', sensorKind: 'Throughput', doWhen: 12000, doneWhen: 500 }] },
  { id: 't_cart', type: 'Cartridge filter', usedAt: 18, alerts: [{ name: 'Cartridge choked', sensorKind: 'Differential pressure', direction: 'above', limits: { minor: 1.0 } }], schedules: [{ name: 'Cartridge replacement', workType: 'pm', basis: 'calendar', every: { n: 1, unit: 'month' } }] },
  { id: 't_dtank', type: 'Dosing tank', usedAt: 33, alerts: [{ name: 'Chemical tank low', sensorKind: 'Hypo tank level', direction: 'below', limits: { caution: 25, minor: 10 } }], schedules: [{ name: 'Chemical refill', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' } }] },
  { id: 't_uv', type: 'UV unit', usedAt: 9, alerts: [{ name: 'UV lamp fault', sensorKind: 'Lamp fault', direction: 'above', limits: { major: 1 } }], schedules: [{ name: 'Lamp and sleeve replacement', workType: 'pm', basis: 'calendar', every: { n: 12, unit: 'month' } }] },
  { id: 't_oz', type: 'Ozonator', usedAt: 4, alerts: [{ name: 'Ozonator tripped', sensorKind: 'Trip contact', direction: 'above', limits: { major: 1 } }], schedules: [{ name: 'Generator service', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_gascl', type: 'Gas chlorinator', usedAt: 6, alerts: [{ name: 'Residual chlorine low', sensorKind: 'Residual chlorine', direction: 'below', limits: { minor: 0.2 } }], schedules: [{ name: 'Tonner change', workType: 'routine', basis: 'calendar', every: { n: 2, unit: 'week' } }] },
  { id: 't_mixer', type: 'Mixer', usedAt: 25, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { minor: 24 } }], schedules: [{ name: 'Gearbox and bearing service', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_screw', type: 'Screw press', usedAt: 11, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { minor: 30 } }], schedules: [{ name: 'Screw and screen service', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 500 }] },
  { id: 't_fpress', type: 'Filter press', usedAt: 8, alerts: [], schedules: [{ name: 'Hydraulic and cloth inspection', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 400 }] },
  { id: 't_daf', type: 'DAF unit', usedAt: 5, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { minor: 30 } }], schedules: [{ name: 'Saturator and scraper service', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_comp', type: 'Air compressor', usedAt: 15, alerts: [{ name: 'Air pressure low', sensorKind: 'Line pressure', direction: 'below', limits: { minor: 5.5, major: 4.5 } }], schedules: [{ name: 'Compressor service', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 1000 }] },
  { id: 't_ct', type: 'Cooling tower', usedAt: 6, alerts: [{ name: 'Outlet temperature high', sensorKind: 'Temperature', direction: 'above', limits: { minor: 36, major: 40 } }], schedules: [{ name: 'Fill and fan service', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] }
);
/* DO low is a stage-level alert: the basin's probe raises it about the whole unit process. */
window.SEED.standardSets.find((t) => t.type === 'Aeration basin').alerts[0].scope = 'unitProcess';

/* ── 6. Sample SCADA models: what the SCADA view hands over, in its own vocabulary ──────────
   Each object is one thing drawn in SCADA: scadaType is the palette code, sensors are the widgets
   bound to it, links are the pipes and headers. Parts (valves, motors) and devices (Sabre) come
   through too; the console leaves them where they are. */
window.SCADA_SAMPLES = {
  bawal: { name: 'Bawal WTP', type: 'WTP', capacity: '1.2 MLD', drawn: '2026-10-03', zones: [
      { id: 'z1', name: 'Intake and screening' }, { id: 'z2', name: 'Filtration' }, { id: 'z3', name: 'Chlorination' } ],
    equipment: [
      { id: 'sc_bs1', tag: 'BS-1', label: 'Mechanical Screen', scadaType: 'MECHANICAL_SCREEN', zone: 'z1', sensors: [{ tag: 'DH', widget: 'NUMBER_SENSOR', reading: 35 }] },
      { id: 'sc_p1', tag: 'P-1', label: 'Raw water pump 1', scadaType: 'SUB_PMP', zone: 'z1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 15 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 2200 }] },
      { id: 'sc_p2', tag: 'P-2', label: 'Raw water pump 2', scadaType: 'SUB_PMP', zone: 'z1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 900 }] },
      { id: 'sc_v1', tag: 'V-1', label: 'Two way Valve', scadaType: 'VALVE_2', zone: 'z1', sensors: [] },
      { id: 'sc_mgf1', tag: 'MGF-1', label: 'ACF/MGF', scadaType: 'ACF_MGF', zone: 'z2', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.7 }] },
      { id: 'sc_uf1', tag: 'UF-1', label: 'UF Membrane', scadaType: 'UF_MEM', zone: 'z2', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 82 }, { tag: 'PIN', widget: 'chart.knob', reading: 1.9 }] },
      { id: 'sc_sabre', tag: 'SABRE-1', label: 'Sabre', scadaType: 'BIG_SABRE', zone: 'z2', sensors: [] },
      { id: 'sc_dp1', tag: 'DP-1', label: 'Hypo dosing pump', scadaType: 'D_PMP', zone: 'z3', sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.6 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 400 }] },
      { id: 'sc_dt1', tag: 'DT-1', label: 'Hypo dosing tank', scadaType: 'DOS_TANK', zone: 'z3', sensors: [{ tag: 'TLVL', widget: 'LEVEL_SENSOR', reading: 70 }] },
      { id: 'sc_cav', tag: 'CV-1', label: 'Cavitator', scadaType: 'CAVITATOR', zone: 'z3', sensors: [{ tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }] } ],
    links: [['sc_bs1', 'sc_p1'], ['sc_bs1', 'sc_p2'], ['sc_p1', 'sc_mgf1'], ['sc_p2', 'sc_mgf1'], ['sc_mgf1', 'sc_uf1'], ['sc_uf1', 'sc_cav'], ['sc_cav', 'sc_dt1'], ['sc_dp1', 'sc_dt1']] },
  /* Manesar is the sample plant in data.js; its SCADA model uses the same ids so the two agree. */
  manesar: { name: 'Manesar STP', type: 'STP', capacity: '2.5 MLD', drawn: '2026-09-12', zones: [
      { id: 'inlet', name: 'Inlet works' }, { id: 'bal', name: 'Equalisation' }, { id: 'bio', name: 'Aeration' }, { id: 'sep', name: 'Secondary clarification and MBR' }, { id: 'filt', name: 'Tertiary filtration' }, { id: 'dis', name: 'Chlorination' }, { id: 'sludge', name: 'Sludge' } ],
    equipment: [
      { id: 'bs1', tag: 'BS-1', label: 'Mechanical Screen', scadaType: 'MECHANICAL_SCREEN', zone: 'inlet', sensors: [{ tag: 'DH', widget: 'NUMBER_SENSOR', reading: 40 }] },
      { id: 'eq1', tag: 'EQ-1', label: 'Equalization tank', scadaType: 'OS_TANK', zone: 'bal', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 61 }, { tag: 'FLOOD', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'PH', widget: 'NUMBER_SENSOR', reading: 7.4 }] },
      { id: 'at1', tag: 'AT-1', label: 'Aeration tank 1', scadaType: 'OS_TANK_DF', zone: 'bio', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 2.3 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 2650 }] },
      { id: 'at2', tag: 'AT-2', label: 'Aeration tank 2', scadaType: 'OS_TANK_DF', zone: 'bio', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 1.8 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 3400 }, { tag: 'TEMP', widget: 'NUMBER_SENSOR', reading: 29.4 }] },
      { id: 'bl1', tag: 'BL-1', label: 'Blower 1', scadaType: 'BLW', zone: 'bio', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.58 }, { tag: 'AMP', widget: 'chart.knob', reading: 38.2 }, { tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 18240 }] },
      { id: 'bl2', tag: 'BL-2', label: 'Blower 2', scadaType: 'BLW', zone: 'bio', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 4120 }] },
      { id: 'cl1', tag: 'SC-1', label: 'Clarifier Tank', scadaType: 'CLARIFIER', zone: 'sep', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.7 }] },
      { id: 'mbr1', tag: 'MBR-1', label: 'MBR', scadaType: 'MBR', zone: 'sep', sensors: [{ tag: 'PERM', widget: 'NUMBER_SENSOR', reading: 112 }, { tag: 'TURB', widget: 'NUMBER_SENSOR', reading: 0.6 }] },
      { id: 'mgf1', tag: 'MGF-1', label: 'ACF/MGF', scadaType: 'ACF_MGF', zone: 'filt', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.9 }] },
      { id: 'uf1', tag: 'UF-1', label: 'UF Membrane', scadaType: 'UF_MEM', zone: 'filt', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 78 }, { tag: 'PIN', widget: 'chart.knob', reading: 2.1 }] },
      { id: 'cdu', tag: 'CDU-1', label: 'Hypo dosing pump', scadaType: 'D_PMP', zone: 'dis', sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.5 }, { tag: 'TLVL', widget: 'LEVEL_SENSOR', reading: 42 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 1200 }] },
      { id: 'sp1', tag: 'SP-1', label: 'Sludge pump', scadaType: 'PMP', zone: 'sludge', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 310 }] } ],
    links: [['bs1', 'eq1'], ['eq1', 'at1'], ['eq1', 'at2'], ['bl1', 'at1'], ['bl1', 'at2'], ['bl2', 'at1'], ['bl2', 'at2'], ['at1', 'cl1'], ['at2', 'cl1'], ['cl1', 'mbr1'], ['mbr1', 'mgf1'], ['mgf1', 'uf1'], ['uf1', 'cdu'], ['cl1', 'sp1']] },
};
/* Vedanta ETP: an effluent plant with a collection sump, neutralisation, an anaerobic stage,
   an SBR, a tube settler and a filter press. Connected and detected; nothing inherited yet. */
window.SCADA_SAMPLES.vedanta = { name: 'Vedanta ETP', type: 'ETP', capacity: '200 KLD', drawn: '2026-10-01', zones: [
    { id: 'v1', name: 'Collection sump' }, { id: 'v2', name: 'Equalisation and neutralisation' }, { id: 'v3', name: 'Anaerobic' }, { id: 'v4', name: 'SBR' }, { id: 'v5', name: 'Tube settler' }, { id: 'v6', name: 'Sludge dewatering' } ],
  equipment: [
    { id: 'v_p1', tag: 'P-1', label: 'Sump pump 1', scadaType: 'SUB_PMP', zone: 'v1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 11 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 3100 }] },
    { id: 'v_p2', tag: 'P-2', label: 'Sump pump 2', scadaType: 'SUB_PMP', zone: 'v1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 1200 }] },
    { id: 'v_eq1', tag: 'EQ-1', label: 'Equalisation tank', scadaType: 'OS_TANK', zone: 'v2', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 48 }, { tag: 'PH', widget: 'NUMBER_SENSOR', reading: 6.1 }] },
    { id: 'v_mx1', tag: 'MX-1', label: 'Agitator', scadaType: 'OS_TANK_AG', zone: 'v2', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 5 }] },
    { id: 'v_dt1', tag: 'DT-1', label: 'Lime dosing tank', scadaType: 'DOS_TANK', zone: 'v2', sensors: [{ tag: 'TLVL', widget: 'LEVEL_SENSOR', reading: 35 }] },
    { id: 'v_an1', tag: 'AN-1', label: 'Anaerobic tank', scadaType: 'ANAEROBIC_TANK', zone: 'v3', sensors: [{ tag: 'PH', widget: 'NUMBER_SENSOR', reading: 6.9 }, { tag: 'TEMP', widget: 'NUMBER_SENSOR', reading: 33 }] },
    { id: 'v_sbr', tag: 'SBR-1', label: 'SBR', scadaType: 'SBR_TANK', zone: 'v4', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 1.6 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 3800 }] },
    { id: 'v_bl1', tag: 'BL-1', label: 'Blower 1', scadaType: 'BLW', zone: 'v4', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.52 }, { tag: 'AMP', widget: 'chart.knob', reading: 29 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 9800 }] },
    { id: 'v_bl2', tag: 'BL-2', label: 'Blower 2', scadaType: 'BLW', zone: 'v4', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 2400 }] },
    { id: 'v_ts1', tag: 'TS-1', label: 'Tube settler', scadaType: 'T_SETTLER', zone: 'v5', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.9 }] },
    { id: 'v_fp1', tag: 'FP-1', label: 'Filter press', scadaType: 'F_PRESS', zone: 'v6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 410 }] },
    { id: 'v_sp1', tag: 'SP-1', label: 'Sludge pump', scadaType: 'PMP', zone: 'v6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 520 }] },
    { id: 'v_v1', tag: 'V-7', label: 'Three way Valve', scadaType: 'VALVE_3', zone: 'v2', sensors: [] } ],
  links: [['v_p1', 'v_eq1'], ['v_p2', 'v_eq1'], ['v_dt1', 'v_eq1'], ['v_eq1', 'v_an1'], ['v_an1', 'v_sbr'], ['v_bl1', 'v_sbr'], ['v_bl2', 'v_sbr'], ['v_sbr', 'v_ts1'], ['v_ts1', 'v_sp1'], ['v_sp1', 'v_fp1']] };
/* What SCADA hands over later, when an engineer draws something new: a third blower on the
   Manesar aeration header, a third raw-water pump at Bawal, a second filter press at Vedanta. */
window.SCADA_DELTAS = {
  vedanta: { what: 'FP-2, a second filter press', equipment: [{ id: 'v_fp2', tag: 'FP-2', label: 'Filter press 2', scadaType: 'F_PRESS', zone: 'v6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }] }], links: [['v_sp1', 'v_fp2']] },
  manesar: { what: 'BL-3, a third blower on the aeration header', equipment: [{ id: 'bl3', tag: 'BL-3', label: 'Blower 3', scadaType: 'BLW', zone: 'bio', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.57 }, { tag: 'AMP', widget: 'chart.knob', reading: 36 }, { tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 12 }] }], links: [['bl3', 'at1'], ['bl3', 'at2']] },
  bawal: { what: 'P-3, a third raw-water pump', equipment: [{ id: 'sc_p3', tag: 'P-3', label: 'Raw water pump 3', scadaType: 'SUB_PMP', zone: 'z1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }] }], links: [['sc_bs1', 'sc_p3'], ['sc_p3', 'sc_mgf1']] },
};
