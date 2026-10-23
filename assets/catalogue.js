/* The library (three levels) and sample SCADA models. Loaded after data.js.
   SCADA owns the plant: zones, equipment, sensor widgets, connections, and the form filled in for each
   thing drawn (SCADA_FORM). The library owns what each equipment type, unit process and plant type
   inherits, and what it reads from the form (FORM_RULES). The console detects, inherits, asks for review. */

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
  /* Anoxic: no air on purpose; ORP climbing means oxygen is getting in and denitrification stops. */
  { type: 'Anoxic tank', archetype: 'vessel', tier: 'B', expects: ['inspection'], prefix: 'AX', sensors: [
    { name: 'ORP', tag: 'ORP', unit: 'mV', kind: 'analytical', valid: [-500, 500], direction: 'below', reading: -120 },
    { name: 'Level', tag: 'LVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'above', reading: 62 } ] },
  { type: 'Equalisation tank', archetype: 'vessel', tier: 'C', expects: ['cleaning'], prefix: 'EQ', sensors: [
    { name: 'Level', tag: 'LVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'above', reading: 58 },
    { name: 'Sump flood switch', tag: 'FLOOD', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 0 },
    { name: 'pH', tag: 'PH', unit: 'pH', kind: 'analytical', valid: [1, 14], direction: 'above', reading: 7.3 } ] },
  { type: 'Process tank', archetype: 'vessel', tier: 'C', expects: ['cleaning'], prefix: 'T', sensors: [
    { name: 'Level', tag: 'LVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'above', reading: 55 } ] },
  { type: 'Sludge holding tank', archetype: 'vessel', tier: 'C', expects: ['desludging'], prefix: 'SH', sensors: [
    { name: 'Level', tag: 'LVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'above', reading: 48 } ] },
  { type: 'Chlorine contact tank', archetype: 'vessel', tier: 'B', expects: ['cleaning'], prefix: 'CCT', sensors: [
    { name: 'Residual chlorine', tag: 'FRC', unit: 'mg/L', kind: 'analytical', valid: [0, 10], direction: 'below', reading: 0.6 },
    { name: 'Level', tag: 'LVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'above', reading: 70 } ] },
  { type: 'Oil and grease trap', archetype: 'vessel', tier: 'C', expects: ['desludging'], prefix: 'OG', sensors: [
    { name: 'Level', tag: 'LVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'above', reading: 40 } ] },
  { type: 'Mechanical bar screen', archetype: 'fixed', tier: 'B', expects: ['inspection'], prefix: 'BS', sensors: [
    { name: 'Level differential', tag: 'DH', unit: 'mm', kind: 'process', valid: [0, 500], direction: 'above', reading: 40 } ] },
  { type: 'Grit chamber', archetype: 'fixed', tier: 'C', expects: ['desludging'], prefix: 'GC', sensors: [] },
  { type: 'Cascade aerator', archetype: 'fixed', tier: 'C', expects: ['cleaning'], prefix: 'CA', sensors: [] },
  { type: 'Static mixer', archetype: 'fixed', tier: 'C', expects: ['inspection'], prefix: 'SM', sensors: [] },
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
  /* Dosing pump: any metering pump that is not the hypo unit (poly, lime, antiscalant). No alert until a flow reading exists. */
  { type: 'Dosing pump', archetype: 'dosing', tier: 'B', expects: ['pump PM'], prefix: 'DP', sensors: [
    { name: 'Run status', tag: 'RUN', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 1 },
    { name: 'Speed', tag: 'SPD', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 78 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 300 } ] },
  { type: 'Dosing tank', archetype: 'vessel', tier: 'B', expects: ['refill'], prefix: 'DT', sensors: [
    { name: 'Hypo tank level', tag: 'TLVL', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 60 } ] },
  { type: 'UV unit', archetype: 'fixed', tier: 'A', expects: ['lamp replacement'], prefix: 'UV', sensors: [
    { name: 'Lamp fault', tag: 'TRIP', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 0 } ] },
  { type: 'Ozonator', archetype: 'dosing', tier: 'B', expects: ['pump PM'], prefix: 'OZ', sensors: [
    { name: 'Trip contact', tag: 'TRIP', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 0 } ] },
  { type: 'Gas chlorinator', archetype: 'dosing', tier: 'A', expects: ['tonner change'], prefix: 'CL', sensors: [
    { name: 'Residual chlorine', tag: 'FRC', unit: 'mg/L', kind: 'analytical', valid: [0, 10], direction: 'below', reading: 0.4 } ] },
  { type: 'Progressive cavity pump', archetype: 'rotating', tier: 'C', expects: ['mechanical PM'], prefix: 'SP', sensors: [
    { name: 'Speed', tag: 'SPD', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 78 },
    { name: 'Discharge pressure', tag: 'DPRESS', unit: 'bar', kind: 'process', valid: [0, 25], direction: 'below', reading: 3.2 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 40 } ] },
  /* Centrifugal: pump and motor on separate shafts joined by a coupling. Monobloc: the impeller sits on the motor shaft, no coupling.
     Multistage: several impellers in series for high head (the form's High Pressure Vertical / Horizontal). Speed is read when a
     VFD drives the pump; Discharge pressure when a gauge is wired in. */
  { type: 'Centrifugal pump', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'P', sensors: [
    { name: 'Run status', tag: 'RUN', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 1 },
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 60], direction: 'above', reading: 18 },
    { name: 'Discharge pressure', tag: 'DPRESS', unit: 'bar', kind: 'process', valid: [0, 25], direction: 'below', reading: 3.8 },
    { name: 'Speed', tag: 'SPD', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 78 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 60 } ] },
  { type: 'Monobloc pump', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'P', sensors: [
    { name: 'Run status', tag: 'RUN', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 1 },
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 40], direction: 'above', reading: 12 },
    { name: 'Discharge pressure', tag: 'DPRESS', unit: 'bar', kind: 'process', valid: [0, 25], direction: 'below', reading: 2.6 },
    { name: 'Speed', tag: 'SPD', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 78 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 60 } ] },
  { type: 'Multistage pump', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'P', sensors: [
    { name: 'Run status', tag: 'RUN', unit: '', kind: 'status', valid: [0, 1], direction: 'above', reading: 1 },
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 80], direction: 'above', reading: 42 },
    { name: 'Discharge pressure', tag: 'DPRESS', unit: 'bar', kind: 'process', valid: [0, 25], direction: 'below', reading: 8.5 },
    { name: 'Speed', tag: 'SPD', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 78 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 60 } ] },
  { type: 'Submersible pump', archetype: 'rotating', tier: 'B', expects: ['mechanical PM'], prefix: 'P', sensors: [
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 40], direction: 'above', reading: 14 },
    { name: 'Speed', tag: 'SPD', unit: '%', kind: 'process', valid: [0, 100], direction: 'below', reading: 78 },
    { name: 'Run hours', tag: 'HRS', unit: 'h', kind: 'meter', valid: [0, 999999], direction: null, reading: 60 } ] },
  { type: 'Mixer', archetype: 'rotating', tier: 'C', expects: ['mechanical PM'], prefix: 'MX', sensors: [
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 30], direction: 'above', reading: 6 } ] },
  { type: 'Flocculator', archetype: 'rotating', tier: 'C', expects: ['mechanical PM'], prefix: 'FL', sensors: [
    { name: 'Motor current', tag: 'AMP', unit: 'A', kind: 'process', valid: [0, 30], direction: 'above', reading: 5 } ] },
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
   machine; 'device' is DigitalPaani hardware; 'structure' and 'plant' carry nothing.
   D_PMP maps to Dosing pump; a form rule keeps a pump whose label says hypo or chlorine a Hypochlorite dosing unit. */
window.SCADA_PALETTE = [
  ['PLANT_EQUIPMENT', 'Plant', 'plant', null], ['ZONE', 'Zone', 'zone', null], ['JOINS', 'Joint', 'structure', null], ['BUILDING', 'Building', 'structure', null],
  ['BLW', 'Blower', 'equipment', 'Centrifugal blower'], ['M_BLW', 'Mini Blower', 'equipment', 'Centrifugal blower'],
  ['SBR_TANK', 'SBR', 'equipment', 'Aeration basin'], ['CASS_BASIN', 'Cass Basin', 'equipment', 'Aeration basin'], ['OS_TANK_DF', 'Diffuser Tank', 'equipment', 'Aeration basin'], ['CASCADE_AREATOR', 'Cascade Aerator', 'equipment', 'Cascade aerator'],
  ['MBBR', 'MBBR', 'equipment', 'MBBR reactor'], ['ANAEROBIC_TANK', 'Anaerobic tank', 'equipment', 'Anaerobic tank'], ['MBR', 'MBR', 'equipment', 'Membrane bioreactor skid'],
  ['OS_TANK', 'Open Skeleton Tank', 'equipment', 'Equalisation tank'], ['OS_TANK_SP', 'Submersible Tank', 'equipment', 'Equalisation tank'],
  ['CP_TANK', 'Closed Process Tank', 'equipment', 'Process tank'], ['OP_TANK', 'Open Process Tank', 'equipment', 'Process tank'], ['TANK', 'Tank', 'equipment', 'Process tank'], ['TANK_2', 'Tank 2', 'equipment', 'Process tank'], ['OVERHEAD_T', 'Overhead Tank', 'equipment', 'Process tank'], ['SH_TANK', 'Oil & Grease Tank', 'equipment', 'Oil and grease trap'], ['VTG_CHAMBER', 'Vtg Chamber', 'equipment', 'Process tank'], ['QUADSON_EVAPORATOR', 'Quadson evaporator', 'equipment', 'Process tank'],
  ['MECHANICAL_SCREEN', 'Mechanical Screen', 'equipment', 'Mechanical bar screen'], ['OS_TANK_SC', 'Screen Chamber Tank', 'equipment', 'Mechanical bar screen'], ['ROTARY_DRUM', 'Rotary Drum', 'equipment', 'Mechanical bar screen'],
  ['GRIT_CHAMBER', 'Grit Chamber', 'equipment', 'Grit chamber'], ['GRIT_CLASSIFIER', 'Grit Classifier', 'equipment', 'Grit chamber'], ['HYDROCYCLONE', 'Hydro Cyclone', 'equipment', 'Grit chamber'],
  ['CLARIFIER', 'Clarifier Tank', 'equipment', 'Circular clarifier'], ['T_SETTLER', 'Tube settler', 'equipment', 'Tube settler'], ['DAF', 'Dissolved Air Floatation', 'equipment', 'DAF unit'],
  ['ACF_MGF', 'ACF/MGF', 'equipment', 'Multigrade filter'], ['CARTRIDGE_FILTER', 'Cartridge Filter', 'equipment', 'Cartridge filter'], ['UF_MEM', 'UF Membrane', 'equipment', 'Ultrafiltration skid'], ['RO', 'RO', 'equipment', 'RO skid'], ['SOFTNER', 'Softner', 'equipment', 'Softener'],
  ['D_PMP', 'Dosing Pump', 'equipment', 'Dosing pump'], ['DOS_TANK', 'Dosing Tank', 'equipment', 'Dosing tank'], ['UV', 'UV', 'equipment', 'UV unit'], ['OZONATOR', 'Ozonator', 'equipment', 'Ozonator'], ['GAS_TONNER', 'Gas Tonner', 'equipment', 'Gas chlorinator'],
  ['PMP', 'Pump', 'equipment', null], ['SUB_PMP', 'Submersible Pump', 'equipment', 'Submersible pump'], ['BT_PMP', 'Booster Pump', 'equipment', 'Centrifugal pump'],
  ['OS_TANK_AG', 'Agitator', 'equipment', 'Mixer'], ['FLASH_MIXER', 'Flash Mixer', 'equipment', 'Mixer'], ['FLOCCULATION', 'Flocculation', 'equipment', 'Flocculator'], ['STATIC_MIXER', 'Static Mixer', 'equipment', 'Static mixer'],
  ['SC_PRESS', 'Screw Press', 'equipment', 'Screw press'], ['F_PRESS', 'Filter Press', 'equipment', 'Filter press'],
  ['COOLING_TOWER', 'Cooling Tower', 'equipment', 'Cooling tower'], ['AIR_COMPRESSURE', 'Air Compressor', 'equipment', 'Air compressor'], ['CAVITATOR', 'Cavitator', 'equipment', null],
  ['MOTOR', 'Motor', 'part', null], ['VALVE_2', 'Two way Valve', 'part', null], ['VALVE_3', 'Three way Valve', 'part', null],
  ['MINI_SABRE', 'Small Sabre', 'device', null], ['BIG_SABRE', 'Sabre', 'device', null], ['BIO_HEALTH_TRACKER', 'Bio Health Tracker', 'device', null],
].map(([code, name, kind, type]) => ({ code, name, kind, type }));
window.SCADA_TYPE_MAP = {}; window.SCADA_PALETTE.forEach((p) => { if (p.kind === 'equipment' && p.type) window.SCADA_TYPE_MAP[p.code] = p.type; });
window.SCADA_KIND = {}; window.SCADA_PALETTE.forEach((p) => { window.SCADA_KIND[p.code] = p.kind; });
/* A drawing code that covers more than one library type: the drawing cannot say which, so the console asks for each machine
   and never remembers one answer for the code. A SCADA model that knows the type says so with the machine's own type, and a
   form that carries the pump's Type answers for it (FORM_RULES): the console asks only when Type is absent. */
window.SCADA_ASK = { PMP: ['Monobloc pump', 'Centrifugal pump'] };

/* SCADA sensor widgets → readings. The widget says how it is drawn; the label says what it measures. */
window.SCADA_WIDGETS = { LEVEL_SENSOR: 'Level widget', NUMBER_SENSOR: 'Number widget', 'chart.knob': 'Gauge', SWITCH_SENSOR: 'Switch' };
window.SCADA_SENSOR_MAP = { DO: 'Dissolved oxygen', MLSS: 'MLSS', TEMP: 'Temperature', PRESS: 'Line pressure', AMP: 'Motor current', TRIP: 'Trip contact', HRS: 'Run hours', LVL: 'Level', FLOOD: 'Sump flood switch', PH: 'pH', DH: 'Level differential', BLK: 'Sludge blanket', PERM: 'Permeability', TURB: 'Outlet turbidity', TMP: 'Trans-membrane pressure', DP: 'Differential pressure', REC: 'Recovery', PIN: 'Inlet pressure', FRC: 'Residual chlorine', TLVL: 'Hypo tank level', THR: 'Throughput', SPD: 'Speed', DPRESS: 'Discharge pressure', ORP: 'ORP' };

/* ── 2b. The SCADA equipment form, as data: what SCADA asks when a thing is drawn ───────────
   "Equipment questions by node type": 350 questions over 81 node types. One list per node type that asks more than a
   Name; the 37 name-only types are listed below. Question text is SCADA's own (two fixes: 'Breath' → 'Breadth', and the
   second 'MOC' on OS_TANK / CS_TANK is 'MOC (diffuser material)'). A question marked proposed is not in SCADA yet: the
   Service dropdown proposed on pumps and tanks, so the library can read what a machine does instead of asking. */
window.SCADA_FORM = (function () {
  const Q = (q, input, req, options, def) => ({ q, input, req: !!req, ...(options ? { options } : {}), ...(def != null ? { default: def } : {}) });
  const YN = ['Yes', 'No'];
  const MOC = ['Reinforced Concrete', 'Precast Concrete', 'Lined Concrete', 'Mild Steel (MS) with Epoxy Coating', 'Stainless Steel (SS 304/316)', 'Galvanized Steel', 'Fiber-Reinforced Plastic (FRP)', 'High-Density Polyethylene (HDPE)', 'PVC (Polyvinyl Chloride)', 'SDPE (Structured Density Polyethylene)'];
  const DIFF = [Q('Diffusers Type', 'dropdown', false, ['Disc Diffusers', 'Tube Diffusers', 'Panel Diffusers', 'Dome Diffusers', 'Orifice Pipe Diffusers']), Q('MOC (diffuser material)', 'dropdown', false, ['Membrane Diffusers', 'Ceramic Diffusers', 'Plastic Diffusers']), Q('Installation & Layout', 'dropdown', false, ['Fixed Grid System', 'Retrievable System', 'Modular Diffuser Arrangement'])];
  const REMOTE = Q('Add remote control functionality?', 'checkbox', false, ['Remote Control']);
  const SERVICE_TANK = { ...Q('Service', 'dropdown', false, ['Collection', 'Equalisation', 'Anoxic', 'Aeration', 'Filter feed / CCT', 'Treated water', 'Flushing', 'Soft water', 'Sludge holding', 'Chlorine contact', 'Overhead', 'Other']), proposed: true };
  const SERVICE_PUMP = { ...Q('Service', 'dropdown', false, ['Collection', 'EQT transfer', 'Sludge recirculation', 'Sludge wasting', 'Filter feed', 'UF feed', 'UF backwash', 'Softener feed', 'Soft water transfer', 'Flushing', 'Irrigation', 'Sump pit', 'Bypass', 'Other']), proposed: true };
  const NAME = Q('Name', 'text', true);
  const TANK8 = [NAME, Q('Description', 'text'), Q('Shape', 'dropdown', false, ['cuboid', 'cylindrical']), Q('Radius', 'text'), Q('Width', 'not set'), Q('Height', 'not set'), Q('Length', 'not set'), Q('Material of construction (MOC)', 'dropdown', false, MOC)];
  const OS10 = [NAME, Q('Color', 'autocomplete', true, null, 'Blue'), Q('Is Over Flow Process', 'radio', true, YN, 'No'), Q('Description', 'text'), Q('Shape', 'dropdown', false, ['Cylindrical', 'Cuboid']), Q('Radius', 'number'), Q('Width', 'number'), Q('Length', 'number'), Q('Depth / Height', 'number'), Q('MOC', 'dropdown', false, MOC)];
  const WIDGET = [NAME, Q('Choose Sensor', 'api_autocomplete', true, ['Loaded from /visualization/plantSensorsList'])];
  const PUMP_MOTOR = [Q('Motor Make', 'text'), Q('Motor Model', 'text'), Q('Motor Company', 'text', false, YN)];
  return {
    /* tanks and basins */
    TANK: [...TANK8, SERVICE_TANK], TANK_2: [...TANK8, SERVICE_TANK], OP_TANK: [...TANK8, SERVICE_TANK], CP_TANK: [...TANK8, SERVICE_TANK], CLARIFIER: TANK8,
    OH_TANK: [NAME, Q('Description', 'text'), Q('Shape', 'dropdown', false, ['Cylindrical', 'Cuboid']), Q('Radius', 'text'), Q('Height', 'text'), Q('Width', 'text'), Q('Length', 'text'), Q('MOC', 'text'), Q('Stilts Height (TANK FRAME HEIGHT)', 'text'), SERVICE_TANK],
    OS_TANK_SC: [...OS10, SERVICE_TANK], OS_TANK_SP: [...OS10, SERVICE_TANK], OS_TANK_DF: [...OS10, SERVICE_TANK],
    OS_TANK: [...OS10, ...DIFF, SERVICE_TANK],
    OS_TANK_AG: [NAME, REMOTE],
    CS_TANK: [NAME, Q('Color', 'dropdown', true, ['Blue', 'Yellow', 'Black']), Q('Screen Chamber', 'text', true), Q('Diffuser', 'radio', true, YN), Q('Submersible Pump', 'radio', true, YN), Q('Is Over Flow Process', 'radio', true, YN), Q('Description', 'text'), Q('Shape', 'dropdown', false, ['Cylindrical', 'Cuboid']), Q('Radius', 'number'), Q('Width', 'number'), Q('Length', 'number'), Q('Depth / Height', 'number'), Q('MOC', 'dropdown', false, MOC), ...DIFF, SERVICE_TANK],
    SH_TANK: [NAME, Q('Length', 'text'), Q('Breadth', 'text'), Q('Height', 'text'), Q('Number of partition', 'number'), Q('Oil separator is present (T type structure)', 'radio', false, YN), Q('Type of skimmer', 'radio', false, ['Horizontal', 'Vertical']), Q('Belt size', 'text'), Q('Skimmer details (KW)', 'text'), Q('Skimmer details (Make)', 'text'), Q('Skimmer details (Model)', 'text'), Q('Skimmer details (RPM)', 'text')],
    DOS_TANK: [NAME, Q('Shape', 'text', true), Q('Dimension', 'text', true), Q('Volume', 'text', true), Q('Agitator', 'radio', true, YN), Q('MOC', 'text', true), Q('Drain valve', 'text', true, YN)],
    /* pumps and blowers */
    PMP: [NAME, Q('Type', 'dropdown', true, ['MonoBlock', 'High Pressure Vertical', 'High Pressure Horizontal', 'Screw Pump', 'Centrifugal Pump'], 'Centrifugal Pump'), Q('Maximum Head', 'text'), Q('Minimum Head', 'text'), Q('VFD', 'boolean', true, YN), Q('Installation Date', 'date'), ...PUMP_MOTOR, Q('Motor Rating', 'text'), REMOTE, SERVICE_PUMP],
    D_PMP: [NAME, Q('Maximum Head', 'text'), Q('Minimum Head', 'text'), Q('Minimum Head (duplicate)', 'text'), Q('VFD', 'text'), Q('Installation Date', 'date'), Q('Manufacturing Date', 'date'), ...PUMP_MOTOR, REMOTE, Q('Motor Rating', 'text')],
    SUB_PMP: [NAME, Q('Type', 'dropdown', true, ['Cutter Type', 'Non-Cutter Type'], 'Cutter Type'), Q('Maximum Head', 'text'), Q('Motor Model', 'text'), Q('Motor Make', 'text'), Q('Motor Rating', 'text'), Q('Motor Company', 'text'), Q('VFD', 'dropdown', false, YN), Q('Minimum Head', 'text'), Q('Manufacturing Date', 'text'), Q('Installation Date', 'text'), REMOTE, SERVICE_PUMP],
    BLW: [NAME, Q('RPM', 'text'), Q('Motor Rating(KW)', 'text'), Q('Motor Make', 'text'), Q('Motor Model', 'text'), Q('Model Company', 'text'), Q('Capacity', 'text'), Q('Installation Date', 'text'), Q('Manufacturing Date', 'text'), REMOTE],
    /* valves and zones */
    VALVE_2: [NAME, Q('Size', 'text', true), Q('Type of Valve', 'dropdown', true, ['Solenoid', 'Motorised', 'pneumatic']), REMOTE],
    VALVE_3: [NAME, Q('Type', 'dropdown', true, ['Manual', 'Motorized', 'Actuator', 'Solenoid']), { ...REMOTE, disabled: true }],
    ZONE: [NAME, Q('Type of Zone', 'dropdown', true, ['Inlet', 'Outlet']), Q('Resolution', 'dropdown', false, [])],
    /* treatment units */
    SC_PRESS: [NAME, Q('Design Capacity', 'number'), Q('KW rating', 'number'), Q('Make', 'text'), Q('Model', 'text'), Q('Solid content', 'text'), Q('Agitator present and RPM', 'text'), Q('RPM', 'text'), Q('Cleaning in auto mode', 'radio', false, YN), Q('Poly dosing system', 'radio', false, YN), Q('Feed pump', 'text')],
    F_PRESS: [NAME, Q('Design flow rate', 'text', true), Q('Plate size', 'text', true), Q('Number of plates', 'text', true), Q('Poly dosing', 'radio', true, YN), Q('Air line provision', 'radio', true, YN)],
    SOFTNER: [NAME, Q('Dia', 'text', true), Q('Height', 'text', true), Q('Design flow rate', 'text', true), Q('OBR', 'text', true), Q('Multiport valve size/header size', 'text', true), Q('Brine tank and its volume', 'text', true), Q('Mixing in brine tank (If agitator- KW)', 'text', true), Q('Mixing in brine tank (If agitator- RPM)', 'text', true), Q('Auto valves', 'radio', true, YN)],
    ACF_MGF: [NAME, Q('Diameter', 'text'), Q('Height', 'text'), Q('MOC', 'text'), Q('Surface loading rate', 'text'), Q('Design flow rate', 'text'), Q('Auto valves', 'radio', false, YN), Q('Frontal size', 'text')],
    OZONATOR: [NAME, Q('Model', 'text', true), Q('Make', 'text', true), Q('Capacity', 'text', true), Q('Pump Details', 'text', true)],
    MBBR: [NAME, Q('Media quantity present', 'text', true), Q('Fill fraction', 'text', true), Q('Length', 'text', true), Q('Breadth', 'text', true), Q('Height', 'text', true), Q('Media surface area', 'text', true), Q('Effective surface area', 'text', true), Q('BOD loading rate', 'text', true), Q('Air line present in riser', 'radio', true, YN), Q('Size of cut is riser', 'text', true), Q('Type of diffusers', 'text', true)],
    MBR: [NAME, Q('Make', 'text', true), Q('Model', 'text', true), Q('Number of cassettes', 'text', true), Q('Number of modules', 'text', true), Q('Surface area of each membrane', 'text', true), Q('Design flux', 'text', true), Q('Design TMP', 'text', true), Q('Design MLSS', 'text', true), Q('Dimensions (lbh)', 'text', true), Q('Module size', 'text', true), Q('Type of diffusers', 'text', true)],
    T_SETTLER: [NAME, Q('Length', 'text', true), Q('Breadth', 'text', true), Q('Height', 'text', true), Q('Sedimentation velocity', 'text', true), Q('Volume', 'text', true), Q('Inclination angle', 'text', true), Q('Surface loading rate', 'text', true)],
    UF_MEM: [NAME, Q('Make', 'text'), Q('Model', 'text'), Q('Dead end or cross flow type', 'dropdown', false, ['Dead end', 'cross flow']), Q('Number of membranes', 'text'), Q('Type of membrane', 'text', false, ['Hollow Fibre', 'Spiral', 'Ceramic']), Q('Backwash cycle (in minutes)', 'text')],
    /* sensor widgets: the widget is bound to one of the plant's sensors */
    LEVEL_SENSOR: WIDGET, 'chart.knob': WIDGET, SWITCH_SENSOR: WIDGET, NUMBER_SENSOR: WIDGET, TABLE_WIDGET: WIDGET,
    /* pipes, summarised: every kind asks a name, its two ends (a machine level or an HN / HM point) and a colour */
    'PIPE_*': [NAME, Q('Source Equipment or point', 'autocomplete', true), Q('Target Equipment or point', 'autocomplete', true), Q('Source Level (0-100)', 'text', true, null, '0'), Q('Target Level (0-100)', 'text', true, null, '0'), Q('Pipe Color', 'autocomplete', true, null, 'Blue')],
  };
})();
/* Node types that ask only for a Name: they map by their code alone. */
window.SCADA_FORM_NAME_ONLY = ['GAUGE_SENSOR', 'JOINS', 'MOTOR', 'ASSET_EQUIPMENT', 'FLASH_MIXER', 'FLOCCULATION', 'GRIT_CHAMBER', 'UV', 'ROTARY_DRUM', 'SIREN', 'PLANT_EQUIPMENT', 'LABEL_WIDGET', 'DAF', 'SBR_TANK', 'BUILDING', 'CASCADE_AREATOR', 'COOLING_TOWER', 'BIG_SABRE', 'MINI_SABRE', 'CAVITATOR', 'BT_PMP', 'M_BLW', 'HYDROCYCLONE', 'GAS_TONNER', 'OVERHEAD_T', 'AIR_COMPRESSURE', 'STATIC_MIXER', 'VTG_CHAMBER', 'CARTRIDGE_FILTER', 'GRIT_CLASSIFIER', 'RO', 'MECHANICAL_SCREEN', 'CASS_BASIN', 'GROUP', 'QUADSON_EVAPORATOR', 'ANAEROBIC_TANK', 'BIO_HEALTH_TRACKER'];
/* Display names for node types the palette response does not carry. */
window.SCADA_FORM_NAMES = { OH_TANK: 'Overhead tank (form only)', CS_TANK: 'Combined screen tank (form only)', LEVEL_SENSOR: 'Level Sensor', 'chart.knob': 'Gauge', SWITCH_SENSOR: 'Switch', NUMBER_SENSOR: 'Number Widget', TABLE_WIDGET: 'Table Widget', LABEL_WIDGET: 'Label Widget', GAUGE_SENSOR: 'Gauge Sensor', 'PIPE_*': 'Pipes (every kind)', SIREN: 'Siren', GROUP: 'Group', ASSET_EQUIPMENT: 'Saved template' };

/* ── 2c. What the library reads from the form (FORM_RULES) ─────────────────────────────────
   One list per node type; each rule reads one question (q) and says what it is to the library (reads):
   · 'type'     the library type, from a map of answers (or from the label when the question is absent)
   · 'expects'  a reading the type now expects (sensor) with an alert that waits for it; flags the machine (field)
   · 'limits'   limits for a reading (sensorKind): the answer converts (derive: 'fla' kW → full-load amps, or a plain number),
                is kept on the machine (key, raw), and the limits are factors of it (factors, per direction)
   · 'schedule' a schedule added to the type's set (schedule; everyBy / partsBy tune it by other answers), or one of
                the set's own schedules adjusted (adjust: doWhen / doneWhen factors, set, partsNote)
   · 'flag'     a fact kept on the machine (field): a Yes/No (on) or the answer itself
   · 'derived'  a number kept on the machine (key); derive 'volume' reads Shape and the dimensions
   says: the short line the Library page shows. when: the answer that fires the rule (a string, 'Yes', or a regex). */
window.FORM_RULES = (function () {
  const R_VOL = { q: 'Shape', reads: 'derived', derive: 'volume', key: 'volume', uses: ['Radius', 'Width', 'Length', 'Depth / Height', 'Height', 'Breadth'], says: 'Shape and size → volume' };
  const R_SERVICE_TANK = { q: 'Service', reads: 'type', proposed: true, map: { Equalisation: 'Equalisation tank', Aeration: 'Aeration basin', Anoxic: 'Anoxic tank', 'Sludge holding': 'Sludge holding tank', 'Chlorine contact': 'Chlorine contact tank', 'Treated water': 'Process tank', Flushing: 'Process tank', 'Soft water': 'Process tank', Overhead: 'Process tank', Collection: 'Process tank', 'Filter feed': 'Process tank', 'Filter feed / CCT': 'Process tank' }, says: 'Service → which tank' };
  const R_SERVICE_KEEP = { q: 'Service', reads: 'flag', field: 'service', proposed: true, says: 'Service → kept on the machine' };
  const R_SERVICE_PUMP = { q: 'Service', reads: 'flag', field: 'service', proposed: true, says: 'Service → what the pump does' };
  const R_REMOTE = { q: 'Add remote control functionality?', reads: 'flag', field: 'remote', on: true, says: 'Remote control → chip' };
  const R_OVERFLOW = { q: 'Is Over Flow Process', reads: 'flag', field: 'overflow', on: true, says: 'Overflow → chip' };
  const R_VFD = { q: 'VFD', reads: 'expects', when: 'Yes', sensor: 'Speed', field: 'vfd', alert: { name: 'Running below minimum speed', sensorKind: 'Speed', direction: 'below', limits: { caution: 30, minor: 20 } }, says: 'VFD → expects a speed reading' };
  const R_KW = (q) => ({ q, reads: 'limits', derive: 'fla', key: 'fla', raw: 'kw', sensorKind: 'Motor current', direction: 'above', factors: { caution: 1, minor: 1.05, major: 1.15 }, why: '{v} kW motor', says: 'Motor rating → current limits' });
  const R_HEAD = { q: 'Maximum Head', reads: 'limits', derive: 'number', key: 'maxHead', per: 10.2, sensorKind: 'Discharge pressure', direction: 'below', factors: { minor: 0.6, major: 0.4 }, why: '{v} m maximum head', says: 'Maximum head → discharge pressure limits' };
  const R_DIFF = (q) => ({ q, reads: 'schedule', schedule: { name: 'Diffuser cleaning', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' }, hours: 4, parts: 'diffuser membranes if torn', flow: 'f_diffuser_clean', cause: 'c_diffuser' }, everyBy: [[/ceramic|plastic/i, { n: 12, unit: 'month' }]], partsBy: [['Installation & Layout', /retrievable/i, 'retrievable: no need to drain']], says: 'Diffuser material → cleaning cadence' });
  const POLY = { name: 'Poly tank refill', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' }, hours: 0.5, parts: 'polymer 25 kg', flow: 'f_poly_refill', cause: 'c_poly_dose' };
  const R_AUTO = (name, note) => ({ q: 'Auto valves', reads: 'schedule', when: 'Yes', adjust: name, set: { performedBy: 'auto', note }, says: 'Auto valves → confirm, not do' });
  const TANK = [R_VOL, R_SERVICE_TANK, R_SERVICE_KEEP];
  const OS = [R_VOL, R_OVERFLOW, R_SERVICE_TANK, R_SERVICE_KEEP];
  return {
    TANK, TANK_2: TANK, OP_TANK: TANK, CP_TANK: TANK, OH_TANK: TANK, CLARIFIER: [R_VOL],
    OS_TANK_SC: OS, OS_TANK_SP: OS,
    /* a Diffuser Tank's form has no diffuser questions today; the rule reads them when SCADA adds them (the Manesar sample carries them) */
    OS_TANK_DF: [...OS, R_DIFF('MOC (diffuser material)')], OS_TANK: [...OS, R_DIFF('MOC (diffuser material)')], CS_TANK: [...OS, R_DIFF('MOC (diffuser material)')],
    OS_TANK_AG: [R_REMOTE],
    SH_TANK: [{ ...R_VOL, q: 'Length' }],
    DOS_TANK: [{ q: 'Volume', reads: 'derived', derive: 'number', key: 'volume', says: 'Volume → kept' }],
    T_SETTLER: [{ q: 'Volume', reads: 'derived', derive: 'number', key: 'volume', says: 'Volume → kept' }],
    PMP: [{ q: 'Type', reads: 'type', map: { MonoBlock: 'Monobloc pump', 'Centrifugal Pump': 'Centrifugal pump', 'High Pressure Vertical': 'Multistage pump', 'High Pressure Horizontal': 'Multistage pump', 'Screw Pump': 'Progressive cavity pump' }, says: 'Type → which pump' }, R_SERVICE_PUMP, R_VFD, R_KW('Motor Rating'), R_HEAD, R_REMOTE],
    SUB_PMP: [{ q: 'Type', reads: 'schedule', when: /^cutter/i, schedule: { name: 'Cutter and impeller check', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' }, hours: 2, parts: 'cutter ring if worn', flow: 'f_pump_lift', cause: 'c_cutter_worn' }, says: 'Type → cutter check when it is a cutter pump' }, R_SERVICE_PUMP, R_VFD, R_KW('Motor Rating'), R_HEAD, R_REMOTE],
    /* a dosing pump whose label says hypo or chlorine is the hypochlorite unit, so its residual-chlorine alerts keep working */
    D_PMP: [{ q: null, reads: 'type', label: /hypo|chlor|naocl/i, type: 'Hypochlorite dosing unit', says: 'Label says hypo or chlorine → hypochlorite dosing unit' }, R_VFD, R_KW('Motor Rating'), R_HEAD, R_REMOTE],
    BLW: [R_KW('Motor Rating(KW)'), { q: 'RPM', reads: 'derived', derive: 'number', key: 'rpm', says: 'RPM → kept' }, R_REMOTE],
    VALVE_2: [{ q: 'Type of Valve', reads: 'flag', field: 'valveType', says: 'Type of valve → noted on the part' }, R_REMOTE],
    VALVE_3: [{ q: 'Type', reads: 'flag', field: 'valveType', says: 'Type → noted on the part' }, R_REMOTE],
    SC_PRESS: [R_KW('KW rating'), { q: 'Cleaning in auto mode', reads: 'schedule', when: 'Yes', adjust: 'Screw and screen service', set: { performedBy: 'auto', note: 'confirm the auto wash' }, says: 'Auto cleaning → confirm the wash, not do it' }, { q: 'Poly dosing system', reads: 'schedule', when: 'Yes', schedule: POLY, says: 'Poly dosing → weekly poly refill' }],
    F_PRESS: [{ q: 'Poly dosing', reads: 'schedule', when: 'Yes', schedule: POLY, says: 'Poly dosing → weekly poly refill' }, { q: 'Number of plates', reads: 'derived', derive: 'number', key: 'plates', adjust: 'Hydraulic and cloth inspection', partsNote: '{v} plates', says: 'Number of plates → parts note' }],
    SOFTNER: [{ q: 'OBR', reads: 'schedule', adjust: 'Regenerate softener', doWhen: 1, doneWhen: 0.05, says: 'OBR → regeneration point' }, R_AUTO('Regenerate softener', 'valves sequence themselves; the task is to confirm')],
    ACF_MGF: [R_AUTO('Backwash when pressure builds', 'valves sequence themselves; the task is to confirm')],
    UF_MEM: [{ q: 'Backwash cycle (in minutes)', reads: 'derived', derive: 'number', key: 'backwashMin', schedule: { name: 'Backwash cycle check', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'day' }, hours: 0.25 }, says: 'Backwash cycle → daily cycle check' }],
    MBR: [{ q: 'Design TMP', reads: 'limits', derive: 'number', key: 'designTmp', sensorKind: 'Trans-membrane pressure', direction: 'above', factors: { minor: 0.85, major: 1 }, why: 'design TMP {v} bar', says: 'Design TMP → pressure limits' }, { q: 'Design flux', reads: 'derived', derive: 'number', key: 'designFlux', says: 'Design flux → kept' }, R_DIFF('Type of diffusers')],
    MBBR: [{ q: 'Fill fraction', reads: 'derived', derive: 'number', key: 'fillFraction', says: 'Fill fraction → kept' }, { q: 'Media quantity present', reads: 'derived', derive: 'number', key: 'mediaQty', schedule: { name: 'Media loss check', workType: 'pm', basis: 'calendar', every: { n: 1, unit: 'month' }, hours: 1, flow: 'f_mbbr_media', cause: 'c_media_loss' }, says: 'Media quantity → monthly media loss check' }, R_DIFF('Type of diffusers')],
  };
})();

/* ── 3. Unit process profiles: detected from SCADA zone names, or from the types inside ─────
   sensors: readings the unit process expects somewhere in it [{ name, where: 'pipe' | 'machine' | 'any', note }]
     (a flow meter on the inlet pipe; a vibration sensor on any blower). alerts: about the unit process as a whole
     [{ name, sensorKind, direction, limits, flow, cause }], ok when a reading named sensorKind exists on any machine
     in it. Both are empty for now: the skeleton is here, a later pass fills it. */
window.UP_PROFILES = [
  { id: 'inlet', name: 'Inlet Works', keywords: ['inlet', 'screen', 'grit', 'intake', 'collection', 'raw'], expectsTypes: ['Mechanical bar screen', 'Grit chamber'], rounds: [{ name: 'Screenings and grit check', every: { n: 1, unit: 'day' } }], groups: [{ type: 'Submersible pump', name: 'Raw water pump group' }], criticality: [{ type: 'Submersible pump', soleUnit: 'A', withStandby: 'B' }], sensors: [], alerts: [] },
  { id: 'bal', name: 'Balancing', keywords: ['equal', 'balanc', 'eq tank', 'sump', 'neutral', 'oil'], expectsTypes: ['Equalisation tank', 'Submersible pump', 'Mixer', 'Oil and grease trap'], rounds: [], groups: [{ type: 'Submersible pump', name: 'Transfer pump group' }, { type: 'Centrifugal pump', name: 'Transfer pump group' }], criticality: [{ type: 'Submersible pump', soleUnit: 'A', withStandby: 'B' }], sensors: [], alerts: [] },
  { id: 'bio', name: 'Biological', keywords: ['aeration', 'aer', 'bio', 'sbr', 'basin', 'reactor', 'mbbr', 'anaerobic', 'cass', 'anoxic'], expectsTypes: ['Aeration basin', 'MBBR reactor', 'Anaerobic tank', 'Anoxic tank', 'Centrifugal blower'], rounds: [{ name: 'SV30 settling test', every: { n: 1, unit: 'day' } }], groups: [{ type: 'Centrifugal blower', name: 'Blower group' }], criticality: [{ type: 'Centrifugal blower', soleUnit: 'A', withStandby: 'B' }], sensors: [], alerts: [] },
  { id: 'sep', name: 'Separation', keywords: ['clarif', 'settl', 'mbr', 'separation', 'secondary', 'daf', 'flotation', 'floatation'], expectsTypes: ['Circular clarifier', 'Tube settler', 'Membrane bioreactor skid', 'DAF unit'], rounds: [], groups: [], sensors: [], alerts: [] },
  { id: 'filt', name: 'Filtration', keywords: ['filter', 'filtration', 'mgf', 'acf', 'uf', 'ro', 'tertiary', 'soft', 'cartridge'], expectsTypes: ['Multigrade filter', 'Ultrafiltration skid', 'RO skid', 'Softener', 'Cartridge filter'], rounds: [], groups: [{ type: 'Submersible pump', name: 'Filter feed pump group' }, { type: 'Monobloc pump', name: 'Filter feed pump group' }, { type: 'Centrifugal pump', name: 'Filter feed pump group' }], sensors: [], alerts: [] },
  { id: 'dis', name: 'Disinfection', keywords: ['chlor', 'disinf', 'hypo', 'uv', 'dosing', 'ozon'], expectsTypes: ['Hypochlorite dosing unit', 'Dosing tank', 'Chlorine contact tank', 'UV unit', 'Ozonator', 'Gas chlorinator'], rounds: [{ name: 'Outlet residual chlorine check', every: { n: 1, unit: 'day' } }], groups: [], sensors: [], alerts: [] },
  { id: 'sludge', name: 'Sludge handling', keywords: ['sludge', 'dewater', 'centrifuge', 'press', 'thicken'], expectsTypes: ['Progressive cavity pump', 'Sludge holding tank', 'Screw press', 'Filter press'], rounds: [{ name: 'Sludge wasting', every: { n: 1, unit: 'week' } }], groups: [], sensors: [], alerts: [] },
  { id: 'util', name: 'Utilities', keywords: ['mcc', 'panel', 'electrical', 'plc', 'compressor', 'cooling', 'utility'], expectsTypes: ['Control panel (MCC)', 'Air compressor', 'Cooling tower'], rounds: [], groups: [], sensors: [], alerts: [] },
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
  { id: 't_cfpump', type: 'Centrifugal pump', usedAt: 0, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { caution: 40, minor: 45 } }], schedules: [{ name: 'Coupling alignment and gland check', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } }, { name: 'Bearing and seal service', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 4000 }] },
  { id: 't_mbpump', type: 'Monobloc pump', usedAt: 0, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { caution: 28, minor: 32 } }], schedules: [{ name: 'Mechanical seal and bearing check', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 3000 }] },
  { id: 't_mspump', type: 'Multistage pump', usedAt: 0, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { caution: 60, minor: 68 } }, { name: 'Discharge pressure low', sensorKind: 'Discharge pressure', direction: 'below', limits: { minor: 5, major: 3 } }], schedules: [{ name: 'Bearing and seal service', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 4000 }, { name: 'Stage wear check', workType: 'pm', basis: 'calendar', every: { n: 12, unit: 'month' } }] },
  { id: 't_subpump', type: 'Submersible pump', usedAt: 38, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { caution: 28, minor: 32 } }], schedules: [{ name: 'Bearing and seal service', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 600 }] },
  { id: 't_dpump', type: 'Dosing pump', usedAt: 0, alerts: [], schedules: [{ name: 'Diaphragm and check-valve service', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }, { name: 'Calibration of dose rate', workType: 'calibration', basis: 'calendar', every: { n: 3, unit: 'month' } }] },
  { id: 't_mcc', type: 'Control panel (MCC)', usedAt: 29, alerts: [{ name: 'Incomer tripped', sensorKind: 'Incomer trip', direction: 'above', limits: { emergency: 1 } }], schedules: [{ name: 'Thermal and tightness inspection', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } }] },
  { id: 't_mbbr', type: 'MBBR reactor', usedAt: 14, alerts: [{ name: 'DO low', sensorKind: 'Dissolved oxygen', direction: 'below', limits: { minor: 2.0, major: 1.0 }, flow: 'f_lowdo', scope: 'unitProcess' }], schedules: [{ name: 'Media and diffuser inspection', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_anaer', type: 'Anaerobic tank', usedAt: 7, alerts: [{ name: 'pH low', sensorKind: 'pH', direction: 'below', limits: { minor: 6.5, major: 6.0 } }], schedules: [{ name: 'Desludging', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  /* ORP above 0 mV in the anoxic zone: too much oxygen for denitrification */
  { id: 't_anoxic', type: 'Anoxic tank', usedAt: 0, alerts: [{ name: 'ORP high', sensorKind: 'ORP', direction: 'above', limits: { minor: 0, major: 50 } }], schedules: [{ name: 'Mixer and probe check', workType: 'pm', basis: 'calendar', every: { n: 1, unit: 'month' } }] },
  { id: 't_ptank', type: 'Process tank', usedAt: 41, alerts: [{ name: 'Level high', sensorKind: 'Level', direction: 'above', limits: { caution: 85, major: 95 } }], schedules: [{ name: 'Tank cleaning', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_sht', type: 'Sludge holding tank', usedAt: 0, alerts: [{ name: 'Level high', sensorKind: 'Level', direction: 'above', limits: { caution: 85, major: 95 } }], schedules: [{ name: 'Desludging to the press', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' } }] },
  { id: 't_cct', type: 'Chlorine contact tank', usedAt: 0, alerts: [{ name: 'Residual chlorine low', sensorKind: 'Residual chlorine', direction: 'below', limits: { minor: 0.5, major: 0.2 } }], schedules: [{ name: 'Tank cleaning', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_ogt', type: 'Oil and grease trap', usedAt: 0, alerts: [{ name: 'Level high', sensorKind: 'Level', direction: 'above', limits: { caution: 85, major: 95 } }], schedules: [{ name: 'Skimmer belt and scraper check', workType: 'pm', basis: 'calendar', every: { n: 1, unit: 'month' } }, { name: 'Oil removal round', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' } }, { name: 'Desludging', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } }] },
  { id: 't_grit', type: 'Grit chamber', usedAt: 22, alerts: [], schedules: [{ name: 'Grit removal', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' } }] },
  { id: 't_cascade', type: 'Cascade aerator', usedAt: 0, alerts: [], schedules: [{ name: 'Steps cleaning', workType: 'pm', basis: 'calendar', every: { n: 1, unit: 'month' } }] },
  { id: 't_smixer', type: 'Static mixer', usedAt: 0, alerts: [], schedules: [{ name: 'Element inspection', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_tube', type: 'Tube settler', usedAt: 12, alerts: [{ name: 'Sludge blanket high', sensorKind: 'Sludge blanket', direction: 'above', limits: { minor: 1.0 } }], schedules: [{ name: 'Tube module cleaning', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } }] },
  { id: 't_ro', type: 'RO skid', usedAt: 16, alerts: [{ name: 'Recovery low', sensorKind: 'Recovery', direction: 'below', limits: { minor: 65, major: 55 } }, { name: 'Inlet pressure high', sensorKind: 'Inlet pressure', direction: 'above', limits: { minor: 14 } }], schedules: [{ name: 'Membrane CIP', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } }] },
  { id: 't_soft', type: 'Softener', usedAt: 20, alerts: [], schedules: [{ name: 'Regenerate softener', workType: 'condition', sensorKind: 'Throughput', doWhen: 12000, doneWhen: 500 }] },
  { id: 't_cart', type: 'Cartridge filter', usedAt: 18, alerts: [{ name: 'Cartridge choked', sensorKind: 'Differential pressure', direction: 'above', limits: { minor: 1.0 } }], schedules: [{ name: 'Cartridge replacement', workType: 'pm', basis: 'calendar', every: { n: 1, unit: 'month' } }] },
  { id: 't_dtank', type: 'Dosing tank', usedAt: 33, alerts: [{ name: 'Chemical tank low', sensorKind: 'Hypo tank level', direction: 'below', limits: { caution: 25, minor: 10 } }], schedules: [{ name: 'Chemical refill', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' } }] },
  { id: 't_uv', type: 'UV unit', usedAt: 9, alerts: [{ name: 'UV lamp fault', sensorKind: 'Lamp fault', direction: 'above', limits: { major: 1 } }], schedules: [{ name: 'Lamp and sleeve replacement', workType: 'pm', basis: 'calendar', every: { n: 12, unit: 'month' } }] },
  { id: 't_oz', type: 'Ozonator', usedAt: 4, alerts: [{ name: 'Ozonator tripped', sensorKind: 'Trip contact', direction: 'above', limits: { major: 1 } }], schedules: [{ name: 'Generator service', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_gascl', type: 'Gas chlorinator', usedAt: 6, alerts: [{ name: 'Residual chlorine low', sensorKind: 'Residual chlorine', direction: 'below', limits: { minor: 0.2 } }], schedules: [{ name: 'Tonner change', workType: 'routine', basis: 'calendar', every: { n: 2, unit: 'week' } }] },
  { id: 't_mixer', type: 'Mixer', usedAt: 25, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { minor: 24 } }], schedules: [{ name: 'Gearbox and bearing service', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
  { id: 't_floc', type: 'Flocculator', usedAt: 0, alerts: [{ name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { minor: 24 } }], schedules: [{ name: 'Gearbox and paddle check', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } }] },
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
   bound to it, links are the pipes and headers, form is what was typed into its SCADA form
   (question → answer; only the answered questions). Parts (valves, motors) and devices (Sabre) come
   through too; the console leaves them where they are. */
window.SCADA_SAMPLES = {
  bawal: { name: 'Bawal WTP', type: 'WTP', capacity: '1.2 MLD', drawn: '2026-10-03', zones: [
      { id: 'z1', name: 'Intake and screening' }, { id: 'z2', name: 'Filtration' }, { id: 'z3', name: 'Chlorination' } ],
    equipment: [
      { id: 'sc_bs1', tag: 'BS-1', label: 'Mechanical Screen', scadaType: 'MECHANICAL_SCREEN', zone: 'z1', sensors: [{ tag: 'DH', widget: 'NUMBER_SENSOR', reading: 35 }] },
      { id: 'sc_p1', tag: 'RW-1', label: 'Raw water pump 1', scadaType: 'SUB_PMP', zone: 'z1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 15 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 2200 }], form: { 'Type': 'Non-Cutter Type', 'VFD': 'No', 'Motor Rating': '5.5', 'Add remote control functionality?': 'Yes' } },
      { id: 'sc_p2', tag: 'RW-2', label: 'Raw water pump 2', scadaType: 'SUB_PMP', zone: 'z1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 900 }], form: { 'Type': 'Non-Cutter Type', 'VFD': 'No', 'Motor Rating': '5.5' } },
      { id: 'sc_v1', tag: 'V-1', label: 'Two way Valve', scadaType: 'VALVE_2', zone: 'z1', sensors: [], form: { 'Size': '100 mm', 'Type of Valve': 'Motorised', 'Add remote control functionality?': 'Yes' } },
      { id: 'sc_mgf1', tag: 'MGF-1', label: 'ACF/MGF', scadaType: 'ACF_MGF', zone: 'z2', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.7 }], form: { 'Diameter': '1.6', 'Height': '2.2', 'Auto valves': 'Yes' } },
      { id: 'sc_sf1', tag: 'SF-1', label: 'Softner', scadaType: 'SOFTNER', zone: 'z2', sensors: [{ tag: 'THR', widget: 'NUMBER_SENSOR', reading: 4200 }], form: { 'Dia': '1.2', 'Height': '2.4', 'Design flow rate': '25', 'OBR': '12000', 'Auto valves': 'Yes' } },
      { id: 'sc_uf1', tag: 'UF-1', label: 'UF Membrane', scadaType: 'UF_MEM', zone: 'z2', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 82 }, { tag: 'PIN', widget: 'chart.knob', reading: 1.9 }], form: { 'Type of membrane': 'Hollow Fibre', 'Backwash cycle (in minutes)': '30' } },
      { id: 'sc_sabre', tag: 'SABRE-1', label: 'Sabre', scadaType: 'BIG_SABRE', zone: 'z2', sensors: [] },
      { id: 'sc_dp1', tag: 'DP-1', label: 'Hypo dosing pump', scadaType: 'D_PMP', zone: 'z3', sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.6 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 400 }], form: { 'Motor Rating': '0.37' } },
      { id: 'sc_dt1', tag: 'DT-1', label: 'Hypo dosing tank', scadaType: 'DOS_TANK', zone: 'z3', sensors: [{ tag: 'TLVL', widget: 'LEVEL_SENSOR', reading: 70 }], form: { 'Shape': 'Cylindrical', 'Volume': '500', 'Agitator': 'No' } },
      { id: 'sc_cav', tag: 'CV-1', label: 'Cavitator', scadaType: 'CAVITATOR', zone: 'z3', sensors: [{ tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }] } ],
    links: [['sc_bs1', 'sc_p1'], ['sc_bs1', 'sc_p2'], ['sc_p1', 'sc_mgf1'], ['sc_p2', 'sc_mgf1'], ['sc_mgf1', 'sc_sf1'], ['sc_sf1', 'sc_uf1'], ['sc_uf1', 'sc_cav'], ['sc_cav', 'sc_dt1'], ['sc_dp1', 'sc_dt1']] },
  /* Manesar is the sample plant in data.js; its SCADA model uses the same ids so the two agree. Its forms reach the
     plant's machines when the library first looks at them (a plant seeded without forms reads the model's). */
  manesar: { name: 'Manesar STP', type: 'STP', capacity: '2.5 MLD', drawn: '2026-09-12', zones: [
      { id: 'inlet', name: 'Inlet works' }, { id: 'bal', name: 'Equalisation' }, { id: 'bio', name: 'Aeration' }, { id: 'sep', name: 'Secondary clarification and MBR' }, { id: 'filt', name: 'Tertiary filtration' }, { id: 'dis', name: 'Chlorination' }, { id: 'sludge', name: 'Sludge' } ],
    equipment: [
      { id: 'bs1', tag: 'BS-1', label: 'Mechanical Screen', scadaType: 'MECHANICAL_SCREEN', zone: 'inlet', sensors: [{ tag: 'DH', widget: 'NUMBER_SENSOR', reading: 40 }] },
      { id: 'eq1', tag: 'EQ-1', label: 'Equalization tank', scadaType: 'OS_TANK', zone: 'bal', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 61 }, { tag: 'FLOOD', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'PH', widget: 'NUMBER_SENSOR', reading: 7.4 }], form: { 'Is Over Flow Process': 'Yes', 'Shape': 'Cuboid', 'Length': '10', 'Width': '8', 'Depth / Height': '4' } },
      { id: 'at1', tag: 'AT-1', label: 'Aeration tank 1', scadaType: 'OS_TANK_DF', zone: 'bio', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 2.3 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 2650 }], form: { 'Shape': 'Cuboid', 'Length': '12', 'Width': '6', 'Depth / Height': '4.5', 'Diffusers Type': 'Disc Diffusers', 'MOC (diffuser material)': 'Membrane Diffusers', 'Installation & Layout': 'Retrievable System' } },
      { id: 'at2', tag: 'AT-2', label: 'Aeration tank 2', scadaType: 'OS_TANK_DF', zone: 'bio', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 1.8 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 3400 }, { tag: 'TEMP', widget: 'NUMBER_SENSOR', reading: 29.4 }], form: { 'Shape': 'Cuboid', 'Length': '12', 'Width': '6', 'Depth / Height': '4.5', 'Diffusers Type': 'Disc Diffusers', 'MOC (diffuser material)': 'Membrane Diffusers', 'Installation & Layout': 'Retrievable System' } },
      { id: 'bl1', tag: 'BL-1', label: 'Blower 1', scadaType: 'BLW', zone: 'bio', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.58 }, { tag: 'AMP', widget: 'chart.knob', reading: 38.2 }, { tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 18240 }], form: { 'Motor Rating(KW)': '15', 'RPM': '2900' } },
      { id: 'bl2', tag: 'BL-2', label: 'Blower 2', scadaType: 'BLW', zone: 'bio', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 4120 }], form: { 'Motor Rating(KW)': '15', 'RPM': '2900' } },
      { id: 'cl1', tag: 'SC-1', label: 'Clarifier Tank', scadaType: 'CLARIFIER', zone: 'sep', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.7 }] },
      { id: 'mbr1', tag: 'MBR-1', label: 'MBR', scadaType: 'MBR', zone: 'sep', sensors: [{ tag: 'PERM', widget: 'NUMBER_SENSOR', reading: 112 }, { tag: 'TURB', widget: 'NUMBER_SENSOR', reading: 0.6 }], form: { 'Design flux': '20', 'Design TMP': '0.5', 'Type of diffusers': 'Membrane' } },
      { id: 'mgf1', tag: 'MGF-1', label: 'ACF/MGF', scadaType: 'ACF_MGF', zone: 'filt', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.9 }] },
      { id: 'uf1', tag: 'UF-1', label: 'UF Membrane', scadaType: 'UF_MEM', zone: 'filt', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 78 }, { tag: 'PIN', widget: 'chart.knob', reading: 2.1 }] },
      { id: 'cdu', tag: 'CDU-1', label: 'Hypo dosing pump', scadaType: 'D_PMP', zone: 'dis', sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.5 }, { tag: 'TLVL', widget: 'LEVEL_SENSOR', reading: 42 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 1200 }] },
      { id: 'sp1', tag: 'SP-1', label: 'Sludge pump', scadaType: 'PMP', type: 'Progressive cavity pump', zone: 'sludge', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 310 }], form: { 'Type': 'Screw Pump', 'VFD': 'No' } } ],
    links: [['bs1', 'eq1'], ['eq1', 'at1'], ['eq1', 'at2'], ['bl1', 'at1'], ['bl1', 'at2'], ['bl2', 'at1'], ['bl2', 'at2'], ['at1', 'cl1'], ['at2', 'cl1'], ['cl1', 'mbr1'], ['mbr1', 'mgf1'], ['mgf1', 'uf1'], ['uf1', 'cdu'], ['cl1', 'sp1']] },
};
/* Vedanta ETP: an effluent plant with a collection sump, neutralisation, an anaerobic stage,
   an SBR, a tube settler and a filter press. Connected and detected; nothing inherited yet. */
window.SCADA_SAMPLES.vedanta = { name: 'Vedanta ETP', type: 'ETP', capacity: '200 KLD', drawn: '2026-10-01', zones: [
    { id: 'v1', name: 'Collection sump' }, { id: 'v2', name: 'Equalisation and neutralisation' }, { id: 'v3', name: 'Anaerobic' }, { id: 'v4', name: 'SBR' }, { id: 'v5', name: 'Tube settler' }, { id: 'v6', name: 'Sludge dewatering' } ],
  equipment: [
    { id: 'v_p1', tag: 'P-1', label: 'Sump pump 1', scadaType: 'SUB_PMP', zone: 'v1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 11 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 3100 }], form: { 'Type': 'Cutter Type', 'Motor Rating': '3.7' } },
    { id: 'v_p2', tag: 'P-2', label: 'Sump pump 2', scadaType: 'SUB_PMP', zone: 'v1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 1200 }], form: { 'Type': 'Cutter Type', 'Motor Rating': '3.7' } },
    { id: 'v_eq1', tag: 'EQ-1', label: 'Equalisation tank', scadaType: 'OS_TANK', zone: 'v2', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 48 }, { tag: 'PH', widget: 'NUMBER_SENSOR', reading: 6.1 }] },
    { id: 'v_mx1', tag: 'MX-1', label: 'Agitator', scadaType: 'OS_TANK_AG', zone: 'v2', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 5 }], form: { 'Add remote control functionality?': 'Yes' } },
    { id: 'v_dt1', tag: 'DT-1', label: 'Lime dosing tank', scadaType: 'DOS_TANK', zone: 'v2', sensors: [{ tag: 'TLVL', widget: 'LEVEL_SENSOR', reading: 35 }] },
    { id: 'v_an1', tag: 'AN-1', label: 'Anaerobic tank', scadaType: 'ANAEROBIC_TANK', zone: 'v3', sensors: [{ tag: 'PH', widget: 'NUMBER_SENSOR', reading: 6.9 }, { tag: 'TEMP', widget: 'NUMBER_SENSOR', reading: 33 }] },
    { id: 'v_sbr', tag: 'SBR-1', label: 'SBR', scadaType: 'SBR_TANK', zone: 'v4', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 1.6 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 3800 }] },
    { id: 'v_bl1', tag: 'BL-1', label: 'Blower 1', scadaType: 'BLW', zone: 'v4', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.52 }, { tag: 'AMP', widget: 'chart.knob', reading: 29 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 9800 }], form: { 'Motor Rating(KW)': '11' } },
    { id: 'v_bl2', tag: 'BL-2', label: 'Blower 2', scadaType: 'BLW', zone: 'v4', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 2400 }], form: { 'Motor Rating(KW)': '11' } },
    { id: 'v_ts1', tag: 'TS-1', label: 'Tube settler', scadaType: 'T_SETTLER', zone: 'v5', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.9 }] },
    { id: 'v_fp1', tag: 'FP-1', label: 'Filter press', scadaType: 'F_PRESS', zone: 'v6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 410 }], form: { 'Design flow rate': '2 m³/h', 'Plate size': '800 mm', 'Number of plates': '24', 'Poly dosing': 'Yes', 'Air line provision': 'No' } },
    { id: 'v_sp1', tag: 'SP-1', label: 'Sludge pump', scadaType: 'PMP', type: 'Progressive cavity pump', zone: 'v6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 520 }], form: { 'Type': 'Screw Pump', 'VFD': 'No' } },
    { id: 'v_v1', tag: 'V-7', label: 'Three way Valve', scadaType: 'VALVE_3', zone: 'v2', sensors: [], form: { 'Type': 'Manual' } } ],
  links: [['v_p1', 'v_eq1'], ['v_p2', 'v_eq1'], ['v_dt1', 'v_eq1'], ['v_eq1', 'v_an1'], ['v_an1', 'v_sbr'], ['v_bl1', 'v_sbr'], ['v_bl2', 'v_sbr'], ['v_sbr', 'v_ts1'], ['v_ts1', 'v_sp1'], ['v_sp1', 'v_fp1']] };
/* What SCADA hands over later, when an engineer draws something new: a third blower on the
   Manesar aeration header, a third raw-water pump at Bawal, a second filter press at Vedanta. */
window.SCADA_DELTAS = {
  vedanta: { what: 'FP-2, a second filter press', equipment: [{ id: 'v_fp2', tag: 'FP-2', label: 'Filter press 2', scadaType: 'F_PRESS', zone: 'v6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }], form: { 'Number of plates': '24', 'Poly dosing': 'Yes' } }], links: [['v_sp1', 'v_fp2']] },
  manesar: { what: 'BL-3, a third blower on the aeration header', equipment: [{ id: 'bl3', tag: 'BL-3', label: 'Blower 3', scadaType: 'BLW', zone: 'bio', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.57 }, { tag: 'AMP', widget: 'chart.knob', reading: 36 }, { tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 12 }], form: { 'Motor Rating(KW)': '15', 'RPM': '2900' } }], links: [['bl3', 'at1'], ['bl3', 'at2']] },
  bawal: { what: 'RW-3, a third raw-water pump', equipment: [{ id: 'sc_p3', tag: 'RW-3', label: 'Raw water pump 3', scadaType: 'SUB_PMP', zone: 'z1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }], form: { 'Type': 'Non-Cutter Type', 'VFD': 'Yes', 'Motor Rating': '5.5' } }], links: [['sc_bs1', 'sc_p3'], ['sc_p3', 'sc_mgf1']] },
};

/* ── 7. A real SCADA layout → the model above ───────────────────────────────────────────────
   A layout is the drawing itself (assets/layout-*.js): elements for machines, joints, inlet and outlet points
   and sensor widgets, and two kinds of link. A Pipe carries flow from its source to its target; a dashed
   standard.Link binds a sensor widget to the machine it reads. The console keeps the machines, follows pipes
   through joints and valves to find which machine feeds which, and hangs each widget on its machine.
   What a real layout does not carry, the console fills in, and the Connect step says so:
   · tags: the drawing has none, so a machine's tag comes from its label (Reactor Feed Pump - 1 → RFP-1);
   · zones: the drawing's ZONE cells are inlet and outlet points, not process areas, so machines are grouped
     by the words in their labels, in flow order (LAYOUT_ZONES); step 3 shows how each stage was found;
   · widget codes: an ON/OFF widget is the machine's run status (RUN), a Level widget its level (LVL);
   · tank types: the drawing code says what a tank looks like (a diffuser tank has air diffusers), not what it is for. An
     equalisation tank is often aerated to keep solids moving, so a tank's name decides first (LAYOUT_TYPE_RULES);
   · pump types: a PMP is drawn the same whether it is a monobloc or a centrifugal pump, and the export carries no pump type,
     so each pump is asked in step 3 (SCADA_ASK) unless its form says which (LAYOUT_FORMS);
   · forms: the layout export carries no form answers, so LAYOUT_FORMS stands in for a few machines. */
window.LAYOUT_ZONES = [
  ['inlet', 'Inlet and screening', /screen chamber|bar screen|\binlet\b/i],
  ['eq', 'Oil and grease, equalisation', /\boil\b|grease|\beqt\b|equali|sump pit|reactor feed/i],
  ['bio', 'MBBR reactors', /mbbr|aeration/i],
  ['sep', 'Tube settlers', /settler|clarifier|re-?circulation/i],
  ['cl', 'Chlorination', /chlorine/i],
  ['filt', 'Pressure filtration', /filter feed|\bmgf\b|\bacf\b/i],
  ['uv', 'UV disinfection', /\buv\b/i],
  ['tw', 'Treated water storage and reuse', /treated water|irrigation|flushing/i],
  ['uf', 'Ultrafiltration', /\buf\b|hypo/i],
  ['sludge', 'Sludge handling', /sludge|screw press|poly|centrifuge/i],
];
window.LAYOUT_TYPE_RULES = [
  { codes: ['OS_TANK', 'OS_TANK_DF', 'OS_TANK_SP', 'TANK', 'OP_TANK', 'CP_TANK'], test: /\beqt\b|equali|balanc/i, type: 'Equalisation tank' },
  { codes: ['OS_TANK', 'OS_TANK_DF', 'OS_TANK_SP', 'TANK', 'OP_TANK', 'CP_TANK'], test: /aerat|\bsbr\b/i, type: 'Aeration basin' },
  { codes: ['OS_TANK', 'OS_TANK_SP', 'TANK', 'OP_TANK', 'CP_TANK'], test: /./, type: 'Process tank' },
];
window.LAYOUT_WIDGET_CODES = { SWITCH_SENSOR: 'RUN', LEVEL_SENSOR: 'LVL' };
window.SCADA_SENSOR_MAP.RUN = 'Run status';
/* A STAND-IN: the layout export carries no form answers, so these are attached by label (or tag) until the equipment
   records are exported with the drawing. Two filter-feed pumps say MonoBlock (so they no longer ask), one UF feed pump
   says Centrifugal with a VFD, and both EQT tanks carry their size and diffusers. Every other pump still asks. */
window.LAYOUT_FORMS = {
  'Filter Feed Pump - 1': { 'Type': 'MonoBlock', 'VFD': 'No', 'Motor Rating': '3.7' },
  'Filter Feed Pump - 2': { 'Type': 'MonoBlock', 'VFD': 'No', 'Motor Rating': '3.7' },
  'UF Feed Pump - 1': { 'Type': 'Centrifugal Pump', 'VFD': 'Yes', 'Motor Rating': '5.5', 'Maximum Head': '40' },
  'EQT Tank - 1': { 'Shape': 'Cuboid', 'Length': '9', 'Width': '6', 'Depth / Height': '4', 'Diffusers Type': 'Tube Diffusers', 'MOC (diffuser material)': 'Membrane Diffusers' },
  'EQT Tank - 2': { 'Shape': 'Cuboid', 'Length': '9', 'Width': '6', 'Depth / Height': '4', 'Diffusers Type': 'Tube Diffusers', 'MOC (diffuser material)': 'Membrane Diffusers' },
};
window.scadaFromLayout = function (doc, meta) {
  const cells = (doc.layout || doc).cells || [];
  const text = (c) => String((c.attrs && c.attrs.label && c.attrs.label.text) || '').replace(/\s+/g, ' ').trim();
  const els = cells.filter((c) => c.type !== 'Pipe' && c.type !== 'standard.Link'); const byCell = {}; els.forEach((c) => { byCell[c.id] = c; });
  const kindOf = (c) => (window.SCADA_WIDGETS[c.type] ? 'widget' : window.SCADA_KIND[c.type] || 'equipment');
  const used = new Set(), prefixOf = {};
  const tagFor = (label) => {
    const m = label.match(/^(.*?)[\s-]*(\d+)$/); const stem = (m ? m[1] : label).trim().toLowerCase(); const words = (m ? m[1] : label).split(/[\s&/,-]+/).filter(Boolean);
    let ab = words.length === 1 ? words[0].toUpperCase().slice(0, 5) : words.map((w) => (/^[A-Z]{2,4}$/.test(w) ? w : w[0].toUpperCase())).join('');
    if (ab.length > 6) ab = words.map((w) => w[0].toUpperCase()).join('');
    /* two different names never share a prefix: Sump Pit is SP, Sludge Pit SLP, Screw Press SCP-1 */
    if (prefixOf[ab] && prefixOf[ab] !== stem && words.length > 1) ab = words[0].slice(0, 2).toUpperCase() + words.slice(1).map((w) => w[0].toUpperCase()).join('');
    const ab0 = ab; for (let k = 2; prefixOf[ab] && prefixOf[ab] !== stem; k++) ab = ab0 + k;
    prefixOf[ab] = stem;
    let tag = m ? `${ab}-${m[2]}` : ab; const base = tag; for (let k = 2; used.has(tag); k++) tag = `${base}.${k}`; used.add(tag); return tag;
  };
  const typeFor = (c) => { const r = window.LAYOUT_TYPE_RULES.find((x) => x.codes.includes(c.type) && x.test.test(text(c))); return r ? { type: r.type } : {}; };
  const zoneFor = (label) => { const z = window.LAYOUT_ZONES.find(([, , re]) => re.test(label)); return z ? z[0] : 'other'; };
  const equipment = els.filter((c) => ['equipment', 'part', 'device'].includes(kindOf(c))).map((c) => ({ id: c.equipmentId, cell: c.id, tag: tagFor(text(c)), label: text(c), scadaType: c.type, zone: 'z_' + zoneFor(text(c)), sensors: [], ...typeFor(c) }));
  equipment.forEach((e) => { const f = (window.LAYOUT_FORMS || {})[e.label] || (window.LAYOUT_FORMS || {})[e.tag]; if (f) e.form = JSON.parse(JSON.stringify(f)); });
  const eqByCell = {}; equipment.forEach((e) => { eqByCell[e.cell] = e; });
  cells.filter((c) => c.type === 'standard.Link').forEach((l) => { const w = byCell[l.source && l.source.id], e = eqByCell[l.target && l.target.id]; if (!w || !e || kindOf(w) !== 'widget') return; const num = (e.label.match(/(\d+)$/) || [])[1]; e.sensors.push({ tag: window.LAYOUT_WIDGET_CODES[w.type] || w.type, widget: w.type, reading: w.type === 'LEVEL_SENSOR' ? (w.level ?? 0) : (num && +num % 2 === 0 ? 0 : 1) }); });
  const out = {}; cells.filter((c) => c.type === 'Pipe').forEach((p) => { const s = p.source && p.source.id, t = p.target && p.target.id; if (s && t) (out[s] = out[s] || []).push(t); });
  const isMachine = (c) => !!c && kindOf(c) === 'equipment'; const passes = (c) => !!c && (kindOf(c) === 'structure' || kindOf(c) === 'part');
  const links = [], seen = new Set();
  els.filter(isMachine).forEach((m) => { const stack = [...(out[m.id] || [])], vis = new Set([m.id]); while (stack.length) { const id = stack.pop(); if (vis.has(id)) continue; vis.add(id); const c = byCell[id]; if (isMachine(c)) { const k = `${m.equipmentId}>${c.equipmentId}`; if (!seen.has(k)) { seen.add(k); links.push([m.equipmentId, c.equipmentId]); } } else if (passes(c)) stack.push(...(out[id] || [])); } });
  const zoneIds = new Set(equipment.map((e) => e.zone));
  const zones = [...window.LAYOUT_ZONES.map(([id, name]) => ({ id: 'z_' + id, name })), { id: 'z_other', name: 'Other machines' }].filter((z) => zoneIds.has(z.id));
  const plantCell = els.find((c) => c.type === 'PLANT_EQUIPMENT');
  return { name: meta.name, type: meta.type, capacity: meta.capacity || '', drawn: String(doc.updatedAt || '').slice(0, 10), zones, equipment, links,
    fromLayout: { version: doc.version, cells: cells.length, site: plantCell ? text(plantCell) : null, boundaries: els.filter((c) => kindOf(c) === 'zone').map((c) => text(c)), widgets: els.filter((c) => kindOf(c) === 'widget').length } };
};
/* DigitalPaani: the real export of an MBBR sewage plant with tertiary filtration, UF and water reuse. */
if (window.SCADA_LAYOUTS && window.SCADA_LAYOUTS.digitalpaani) window.SCADA_SAMPLES.digitalpaani = window.scadaFromLayout(window.SCADA_LAYOUTS.digitalpaani, { name: 'DigitalPaani', type: 'STP' });
