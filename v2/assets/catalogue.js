/* v2. The library (three levels, now with connections) and sample SCADA models with pipes. Loaded after data.js.
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

/* ── 1b. Connections: what a type is joined to, declared once per type ────────────────────────
   v2. An alert on a machine often needs a reading that is not on the machine: the pressure on
   its discharge header, the level in the tank it draws from, the flow on its permeate line. The
   type says which connections matter and what readings it expects to find there; SCADA fills
   them from its pipes and headers; a person confirms or chooses where SCADA is ambiguous.
   kind: 'pipe' (a pipe or header), 'machine' (another machine), 'peer' (duty/standby partner).
   dir: 'in' or 'out' relative to the machine. readings: kinds expected there (for pipes).
   types: machine types expected there. The id is also the word a flow step uses: {{discharge}}. */
window.CONNECTIONS = {
  'Submersible pump': [
    { id: 'suction', name: 'Suction', kind: 'machine', dir: 'in', readings: ['Level'], hint: 'the tank or sump it draws from' },
    { id: 'discharge', name: 'Discharge pipe', kind: 'pipe', dir: 'out', readings: ['Line pressure', 'Flow'], hint: 'its delivery line or header' },
    { id: 'standby', name: 'Standby', kind: 'peer', readings: [], hint: 'the pump that covers it' } ],
  'Progressive cavity pump': [
    { id: 'suction', name: 'Suction', kind: 'machine', dir: 'in', readings: ['Level'], hint: 'the tank it draws from' },
    { id: 'discharge', name: 'Discharge pipe', kind: 'pipe', dir: 'out', readings: ['Line pressure', 'Flow'], hint: 'its delivery line' },
    { id: 'standby', name: 'Standby', kind: 'peer', readings: [], hint: 'the pump that covers it' } ],
  'Centrifugal blower': [
    { id: 'header', name: 'Air header', kind: 'pipe', dir: 'out', readings: ['Line pressure'], hint: 'the header it delivers into' },
    { id: 'basins', name: 'Basins it aerates', kind: 'machine', dir: 'out', readings: ['Dissolved oxygen'], types: ['Aeration basin', 'MBBR reactor'], hint: 'the tanks on the other end of the header' },
    { id: 'standby', name: 'Standby', kind: 'peer', readings: [], hint: 'the blower that covers it' } ],
  'Air compressor': [
    { id: 'header', name: 'Air header', kind: 'pipe', dir: 'out', readings: ['Line pressure'], hint: 'the line it delivers into' },
    { id: 'standby', name: 'Standby', kind: 'peer', readings: [], hint: 'the compressor that covers it' } ],
  'Aeration basin': [
    { id: 'blowers', name: 'Blowers', kind: 'machine', dir: 'in', readings: ['Line pressure', 'Motor current'], types: ['Centrifugal blower'], hint: 'what supplies its air' },
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'the line that fills it' },
    { id: 'next', name: 'Where it drains', kind: 'machine', dir: 'out', readings: [], types: ['Circular clarifier', 'Membrane bioreactor skid', 'Tube settler'], hint: 'the clarifier or membrane after it' } ],
  'MBBR reactor': [
    { id: 'blowers', name: 'Blowers', kind: 'machine', dir: 'in', readings: ['Line pressure'], types: ['Centrifugal blower'], hint: 'what supplies its air' },
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'the line that fills it' } ],
  'Anaerobic tank': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'the line that fills it' },
    { id: 'outlet', name: 'Outlet', kind: 'pipe', dir: 'out', readings: [], hint: 'where it drains' } ],
  'Equalisation tank': [
    { id: 'inlet', name: 'Inlet', kind: 'pipe', dir: 'in', readings: ['Flow', 'pH'], hint: 'the raw inflow' },
    { id: 'pumps', name: 'Transfer pumps', kind: 'machine', dir: 'out', readings: ['Motor current'], types: ['Submersible pump'], hint: 'the pumps that empty it' } ],
  'Process tank': [
    { id: 'inlet', name: 'Inlet', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'the line that fills it' },
    { id: 'outlet', name: 'Outlet', kind: 'pipe', dir: 'out', readings: ['Flow'], hint: 'where it drains' } ],
  'Mechanical bar screen': [
    { id: 'outlet', name: 'Channel after it', kind: 'pipe', dir: 'out', readings: ['Flow'], hint: 'the channel it feeds' } ],
  'Grit chamber': [
    { id: 'inlet', name: 'Inlet', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'the channel into it' } ],
  'Circular clarifier': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'mixed liquor in' },
    { id: 'outlet', name: 'Overflow', kind: 'pipe', dir: 'out', readings: ['Flow', 'Outlet turbidity'], hint: 'clarified water out' },
    { id: 'sludge', name: 'Sludge pump', kind: 'machine', dir: 'out', readings: ['Run hours'], types: ['Progressive cavity pump', 'Submersible pump'], hint: 'what draws its sludge' } ],
  'Tube settler': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'water in' },
    { id: 'outlet', name: 'Overflow', kind: 'pipe', dir: 'out', readings: ['Outlet turbidity'], hint: 'clarified water out' } ],
  'Membrane bioreactor skid': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'the line that feeds the membrane tank' },
    { id: 'permeate', name: 'Permeate line', kind: 'pipe', dir: 'out', readings: ['Flow', 'Outlet turbidity'], hint: 'treated water out' } ],
  'Multigrade filter': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow', 'Line pressure'], hint: 'water in' },
    { id: 'outlet', name: 'Filtered water', kind: 'pipe', dir: 'out', readings: ['Line pressure'], hint: 'water out' } ],
  'Ultrafiltration skid': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow', 'Line pressure'], hint: 'water in' },
    { id: 'permeate', name: 'Permeate line', kind: 'pipe', dir: 'out', readings: ['Flow', 'Outlet turbidity'], hint: 'product water out' } ],
  'RO skid': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow', 'Line pressure'], hint: 'water in' },
    { id: 'permeate', name: 'Permeate line', kind: 'pipe', dir: 'out', readings: ['Flow'], hint: 'product water out' } ],
  'Softener': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'water in' },
    { id: 'outlet', name: 'Outlet', kind: 'pipe', dir: 'out', readings: ['Flow'], hint: 'soft water out' } ],
  'Cartridge filter': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Line pressure'], hint: 'water in' },
    { id: 'outlet', name: 'Outlet', kind: 'pipe', dir: 'out', readings: ['Line pressure'], hint: 'water out' } ],
  'Hypochlorite dosing unit': [
    { id: 'line', name: 'Line it doses', kind: 'pipe', dir: 'out', readings: ['Residual chlorine', 'Flow'], hint: 'the water it treats' },
    { id: 'tank', name: 'Chemical tank', kind: 'machine', dir: 'in', readings: ['Hypo tank level'], types: ['Dosing tank'], hint: 'where it draws hypo from' } ],
  'Gas chlorinator': [
    { id: 'line', name: 'Line it doses', kind: 'pipe', dir: 'out', readings: ['Residual chlorine', 'Flow'], hint: 'the water it treats' } ],
  'Dosing tank': [
    { id: 'pumps', name: 'Dosing pumps', kind: 'machine', dir: 'out', readings: [], types: ['Hypochlorite dosing unit'], hint: 'the pumps that draw from it' } ],
  'UV unit': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow', 'Outlet turbidity'], hint: 'water in' } ],
  'Ozonator': [
    { id: 'line', name: 'Line it doses', kind: 'pipe', dir: 'out', readings: ['Flow'], hint: 'the water it treats' } ],
  'Mixer': [
    { id: 'tank', name: 'Tank it stirs', kind: 'machine', dir: 'in', readings: ['Level', 'pH'], types: ['Equalisation tank', 'Process tank', 'Anaerobic tank'], hint: 'the tank it sits in' } ],
  'Screw press': [
    { id: 'feed', name: 'Sludge pump', kind: 'machine', dir: 'in', readings: ['Run hours'], types: ['Progressive cavity pump', 'Submersible pump'], hint: 'what feeds it sludge' },
    { id: 'standby', name: 'Standby', kind: 'peer', readings: [], hint: 'the press that covers it' } ],
  'Filter press': [
    { id: 'feed', name: 'Sludge pump', kind: 'machine', dir: 'in', readings: ['Run hours'], types: ['Progressive cavity pump', 'Submersible pump'], hint: 'what feeds it sludge' },
    { id: 'standby', name: 'Standby', kind: 'peer', readings: [], hint: 'the press that covers it' } ],
  'DAF unit': [
    { id: 'feed', name: 'Feed', kind: 'pipe', dir: 'in', readings: ['Flow'], hint: 'water in' },
    { id: 'outlet', name: 'Outlet', kind: 'pipe', dir: 'out', readings: ['Outlet turbidity'], hint: 'clarified water out' } ],
};
window.CATALOGUE.forEach((c) => { c.connections = window.CONNECTIONS[c.type] || []; });
/* Readings that live on a pipe or header: the widget says what it measures, this says its range. */
window.PIPE_READINGS = {
  'Line pressure': { unit: 'bar', kind: 'process', valid: [0, 16], direction: 'below' },
  'Flow': { unit: 'm³/h', unitShort: 'm³/h', kind: 'process', valid: [0, 2000], direction: 'below' },
  'Outlet turbidity': { unit: 'NTU', kind: 'analytical', valid: [0, 100], direction: 'above' },
  'Residual chlorine': { unit: 'mg/L', kind: 'analytical', valid: [0, 10], direction: 'below' },
  'pH': { unit: 'pH', kind: 'analytical', valid: [1, 14], direction: 'above' },
  'Level': { unit: '%', kind: 'process', valid: [0, 100], direction: 'above' },
};

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
window.SCADA_SENSOR_MAP = { DO: 'Dissolved oxygen', MLSS: 'MLSS', TEMP: 'Temperature', PRESS: 'Line pressure', AMP: 'Motor current', TRIP: 'Trip contact', HRS: 'Run hours', LVL: 'Level', FLOOD: 'Sump flood switch', PH: 'pH', DH: 'Level differential', BLK: 'Sludge blanket', PERM: 'Permeability', TURB: 'Outlet turbidity', TMP: 'Trans-membrane pressure', DP: 'Differential pressure', REC: 'Recovery', PIN: 'Inlet pressure', FRC: 'Residual chlorine', TLVL: 'Hypo tank level', THR: 'Throughput', FLOW: 'Flow' };

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

/* ── 5b. Alerts that watch a connection, not the machine itself (v2) ─────────────────────────
   `on` names the connection; the reading is found there when the machine inherits. A reading on
   a connection shared by a duty/standby pair raises the alert about the pair, once. */
(() => {
  const add = (type, a) => { const t = window.SEED.standardSets.find((x) => x.type === type); if (t && !t.alerts.some((x) => x.name === a.name)) t.alerts.push(a); };
  add('Submersible pump', { name: 'Discharge pressure low', on: 'discharge', sensorKind: 'Line pressure', direction: 'below', limits: { minor: 1.0, major: 0.5 }, flow: 'f_pump_dryrun' });
  add('Submersible pump', { name: 'Suction tank empty', on: 'suction', sensorKind: 'Level', direction: 'below', limits: { major: 10 }, flow: 'f_pump_stop' });
  add('Progressive cavity pump', { name: 'Discharge pressure low', on: 'discharge', sensorKind: 'Line pressure', direction: 'below', limits: { minor: 1.0 }, flow: 'f_pump_dryrun' });
  add('Centrifugal blower', { name: 'Header pressure high', on: 'header', sensorKind: 'Line pressure', direction: 'above', limits: { minor: 0.7, major: 0.9 }, flow: 'f_blower_header' });
  add('Ultrafiltration skid', { name: 'Permeate flow low', on: 'permeate', sensorKind: 'Flow', direction: 'below', limits: { minor: 30, major: 20 }, flow: 'f_uf_fix' });
  add('Ultrafiltration skid', { name: 'Feed pressure high', on: 'feed', sensorKind: 'Line pressure', direction: 'above', limits: { minor: 3.5 }, flow: 'f_uf_fix' });
  add('Multigrade filter', { name: 'Feed flow low', on: 'feed', sensorKind: 'Flow', direction: 'below', limits: { minor: 40 } });
  add('Membrane bioreactor skid', { name: 'Permeate flow low', on: 'permeate', sensorKind: 'Flow', direction: 'below', limits: { minor: 90, major: 70 }, flow: 'f_mbr_fix' });
  add('Hypochlorite dosing unit', { name: 'Chlorine low at the outlet', on: 'line', sensorKind: 'Residual chlorine', direction: 'below', limits: { minor: 0.2, major: 0.1 }, flow: 'f_dose_adjust' });
})();


/* ── 6. Sample SCADA models: what the SCADA view hands over, in its own vocabulary ──────────
   Each object is one thing drawn in SCADA: scadaType is the palette code, sensors are the widgets
   bound to it. v2: pipes and headers are objects of their own, with the machines they join and the
   widgets bound to them (a pressure transmitter on a discharge header, a flow meter on a permeate
   line). Parts (valves, motors) and devices (Sabre) come through too; the console leaves them. */
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
    pipes: [
      { id: 'pb_su1', tag: 'SU-1', label: 'Suction, P-1', from: ['sc_bs1'], to: ['sc_p1'], sensors: [] },
      { id: 'pb_su2', tag: 'SU-2', label: 'Suction, P-2', from: ['sc_bs1'], to: ['sc_p2'], sensors: [] },
      { id: 'pb_dh', tag: 'DH-1', label: 'Raw water discharge header', from: ['sc_p1', 'sc_p2'], to: ['sc_mgf1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 1.8 }, { tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 52 }] },
      { id: 'pb_ft', tag: 'FT-1', label: 'Filtered water', from: ['sc_mgf1'], to: ['sc_uf1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 1.9 }] },
      { id: 'pb_pm', tag: 'PM-1', label: 'UF permeate', from: ['sc_uf1'], to: ['sc_cav'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 48 }] },
      { id: 'pb_bw', tag: 'BW-1', label: 'UF backwash drain', from: ['sc_uf1'], to: [], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 0 }] },
      { id: 'pb_ct', tag: 'CT-1', label: 'To contact tank', from: ['sc_cav'], to: ['sc_dt1'], sensors: [] },
      { id: 'pb_ds', tag: 'DS-1', label: 'Hypo dosing line', from: ['sc_dp1'], to: ['sc_dt1'], sensors: [] } ] },
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
    pipes: [
      { id: 'pp_in', tag: 'IN-1', label: 'Inlet channel', from: ['bs1'], to: ['eq1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 96 }] },
      { id: 'pp_feed', tag: 'FD-1', label: 'Aeration feed', from: ['eq1'], to: ['at1', 'at2'], sensors: [] },
      { id: 'pp_air', tag: 'AH-1', label: 'Air header', from: ['bl1', 'bl2'], to: ['at1', 'at2'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.56 }] },
      { id: 'pp_ml', tag: 'ML-1', label: 'Mixed liquor to clarifier', from: ['at1', 'at2'], to: ['cl1'], sensors: [] },
      { id: 'pp_cl_mbr', tag: 'CL-1', label: 'Clarified water to MBR', from: ['cl1'], to: ['mbr1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 92 }] },
      { id: 'pp_perm', tag: 'PM-1', label: 'MBR permeate', from: ['mbr1'], to: ['mgf1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 88 }] },
      { id: 'pp_filt', tag: 'FT-1', label: 'Filtered water', from: ['mgf1'], to: ['uf1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 2.0 }] },
      { id: 'pp_uf_perm', tag: 'PM-2', label: 'UF permeate', from: ['uf1'], to: ['cdu'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 84 }, { tag: 'TURB', widget: 'NUMBER_SENSOR', reading: 0.3 }] },
      { id: 'pp_ras', tag: 'RS-1', label: 'Sludge line', from: ['cl1'], to: ['sp1'], sensors: [] },
      { id: 'pp_out', tag: 'OUT-1', label: 'Treated water outlet', from: ['cdu'], to: [], sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.5 }] } ] },
};
/* Vedanta ETP: an effluent plant with a collection sump, neutralisation, an anaerobic stage,
   an SBR, a tube settler and a filter press. Connected and detected; nothing inherited yet.
   Its air header is drawn without a pressure widget, and its sump is not drawn at all. */
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
  pipes: [
    { id: 'pv_dl', tag: 'DL-1', label: 'Pump discharge line', from: ['v_p1', 'v_p2'], to: ['v_eq1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 1.4 }] },
    { id: 'pv_lime', tag: 'LM-1', label: 'Lime dosing line', from: ['v_dt1'], to: ['v_eq1'], sensors: [] },
    { id: 'pv_fd1', tag: 'FD-1', label: 'To anaerobic', from: ['v_eq1'], to: ['v_an1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 7.5 }] },
    { id: 'pv_fd2', tag: 'FD-2', label: 'To SBR', from: ['v_an1'], to: ['v_sbr'], sensors: [] },
    { id: 'pv_air', tag: 'AH-1', label: 'Air header', from: ['v_bl1', 'v_bl2'], to: ['v_sbr'], sensors: [] },
    { id: 'pv_dc', tag: 'DC-1', label: 'Decant to settler', from: ['v_sbr'], to: ['v_ts1'], sensors: [] },
    { id: 'pv_sl1', tag: 'SL-1', label: 'Sludge to pump', from: ['v_ts1'], to: ['v_sp1'], sensors: [] },
    { id: 'pv_sl2', tag: 'SL-2', label: 'Sludge to press', from: ['v_sp1'], to: ['v_fp1'], sensors: [] } ] };
/* Three more sample drawings: an MBBR-based STP, a DAF-and-RO effluent plant, a surface-water WTP.
   Rudrapur arrives fully inherited and live; Pithampur partly inherited; Jhajjar is left for the
   "connect a new plant" demo. Each drawing carries at least one deliberate state: a suction with
   a level reading, an air header without a widget, two outlets the type cannot tell apart. */
window.SCADA_SAMPLES.rudrapur = { name: 'Rudrapur STP', type: 'STP', capacity: '5 MLD', drawn: '2026-09-26', zones: [
    { id: 'r1', name: 'Inlet works' }, { id: 'r2', name: 'Equalisation' }, { id: 'r3', name: 'MBBR' }, { id: 'r4', name: 'Tube settler' }, { id: 'r5', name: 'Tertiary and UV' }, { id: 'r6', name: 'Sludge dewatering' } ],
  equipment: [
    { id: 'r_bs1', tag: 'BS-1', label: 'Mechanical screen', scadaType: 'MECHANICAL_SCREEN', zone: 'r1', sensors: [{ tag: 'DH', widget: 'NUMBER_SENSOR', reading: 55 }] },
    { id: 'r_gc1', tag: 'GC-1', label: 'Grit chamber', scadaType: 'GRIT_CHAMBER', zone: 'r1', sensors: [] },
    { id: 'r_eq1', tag: 'EQ-1', label: 'Equalisation tank', scadaType: 'OS_TANK', zone: 'r2', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 54 }, { tag: 'PH', widget: 'NUMBER_SENSOR', reading: 7.1 }] },
    { id: 'r_p1', tag: 'TP-1', label: 'Transfer pump 1', scadaType: 'SUB_PMP', zone: 'r2', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 18 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 5100 }] },
    { id: 'r_p2', tag: 'TP-2', label: 'Transfer pump 2', scadaType: 'SUB_PMP', zone: 'r2', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 2300 }] },
    { id: 'r_mb1', tag: 'MBBR-1', label: 'MBBR reactor 1', scadaType: 'MBBR', zone: 'r3', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 2.6 }] },
    { id: 'r_mb2', tag: 'MBBR-2', label: 'MBBR reactor 2', scadaType: 'MBBR', zone: 'r3', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 2.2 }] },
    { id: 'r_bl1', tag: 'BL-1', label: 'Blower 1', scadaType: 'BLW', zone: 'r3', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.55 }, { tag: 'AMP', widget: 'chart.knob', reading: 41 }, { tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 14200 }] },
    { id: 'r_bl2', tag: 'BL-2', label: 'Blower 2', scadaType: 'BLW', zone: 'r3', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0 }, { tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 6100 }] },
    { id: 'r_ts1', tag: 'TS-1', label: 'Tube settler', scadaType: 'T_SETTLER', zone: 'r4', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.6 }] },
    { id: 'r_mgf1', tag: 'MGF-1', label: 'Multigrade filter', scadaType: 'ACF_MGF', zone: 'r5', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.6 }] },
    { id: 'r_uv1', tag: 'UV-1', label: 'UV unit', scadaType: 'UV', zone: 'r5', sensors: [{ tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }] },
    { id: 'r_sp1', tag: 'SP-1', label: 'Sludge pump', scadaType: 'PMP', zone: 'r6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 760 }] },
    { id: 'r_scp1', tag: 'SCP-1', label: 'Screw press', scadaType: 'SC_PRESS', zone: 'r6', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 9 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 410 }] },
    { id: 'r_v1', tag: 'V-3', label: 'Two way Valve', scadaType: 'VALVE_2', zone: 'r2', sensors: [] } ],
  pipes: [
    { id: 'pr_in', tag: 'IN-1', label: 'Inlet channel', from: ['r_bs1'], to: ['r_gc1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 205 }] },
    { id: 'pr_gc', tag: 'IN-2', label: 'Degritted channel', from: ['r_gc1'], to: ['r_eq1'], sensors: [] },
    { id: 'pr_su1', tag: 'SU-1', label: 'Suction, TP-1', from: ['r_eq1'], to: ['r_p1'], sensors: [] },
    { id: 'pr_su2', tag: 'SU-2', label: 'Suction, TP-2', from: ['r_eq1'], to: ['r_p2'], sensors: [] },
    { id: 'pr_dh', tag: 'DH-1', label: 'Transfer header', from: ['r_p1', 'r_p2'], to: ['r_mb1', 'r_mb2'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 1.6 }, { tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 198 }] },
    { id: 'pr_air', tag: 'AH-1', label: 'Air header', from: ['r_bl1', 'r_bl2'], to: ['r_mb1', 'r_mb2'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.54 }] },
    { id: 'pr_ml', tag: 'ML-1', label: 'To the settler', from: ['r_mb1', 'r_mb2'], to: ['r_ts1'], sensors: [] },
    { id: 'pr_cl', tag: 'CL-1', label: 'Clarified water', from: ['r_ts1'], to: ['r_mgf1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 190 }] },
    { id: 'pr_ft', tag: 'FT-1', label: 'Filtered water', from: ['r_mgf1'], to: ['r_uv1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 1.4 }, { tag: 'TURB', widget: 'NUMBER_SENSOR', reading: 1.1 }] },
    { id: 'pr_out', tag: 'OUT-1', label: 'Treated water outlet', from: ['r_uv1'], to: [], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 188 }] },
    { id: 'pr_sl1', tag: 'SL-1', label: 'Sludge to pump', from: ['r_ts1'], to: ['r_sp1'], sensors: [] },
    { id: 'pr_sl2', tag: 'SL-2', label: 'Sludge to press', from: ['r_sp1'], to: ['r_scp1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 2.1 }] } ] };
window.SCADA_SAMPLES.pithampur = { name: 'Pithampur ETP', type: 'ETP', capacity: '500 KLD', drawn: '2026-10-06', zones: [
    { id: 'q1', name: 'Collection sump' }, { id: 'q2', name: 'Pre-treatment and DAF' }, { id: 'q3', name: 'Aeration' }, { id: 'q4', name: 'Secondary clarifier' }, { id: 'q5', name: 'Polishing and RO' }, { id: 'q6', name: 'Sludge' } ],
  equipment: [
    { id: 'q_sump', tag: 'CS-1', label: 'Collection sump', scadaType: 'OS_TANK_SP', zone: 'q1', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 44 }, { tag: 'FLOOD', widget: 'SWITCH_SENSOR', reading: 0 }] },
    { id: 'q_p1', tag: 'P-1', label: 'Sump pump 1', scadaType: 'SUB_PMP', zone: 'q1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 9 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 2800 }] },
    { id: 'q_p2', tag: 'P-2', label: 'Sump pump 2', scadaType: 'SUB_PMP', zone: 'q1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 900 }] },
    { id: 'q_fm1', tag: 'FM-1', label: 'Flash mixer', scadaType: 'FLASH_MIXER', zone: 'q2', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 4 }] },
    { id: 'q_ct1', tag: 'CT-1', label: 'Coagulant tank', scadaType: 'DOS_TANK', zone: 'q2', sensors: [{ tag: 'TLVL', widget: 'LEVEL_SENSOR', reading: 62 }] },
    { id: 'q_daf1', tag: 'DAF-1', label: 'DAF unit', scadaType: 'DAF', zone: 'q2', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 12 }] },
    { id: 'q_at1', tag: 'AT-1', label: 'Aeration tank', scadaType: 'OS_TANK_DF', zone: 'q3', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 1.9 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 3100 }] },
    { id: 'q_bl1', tag: 'BL-1', label: 'Blower 1', scadaType: 'BLW', zone: 'q3', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.49 }, { tag: 'AMP', widget: 'chart.knob', reading: 22 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 7700 }] },
    { id: 'q_bl2', tag: 'BL-2', label: 'Blower 2', scadaType: 'BLW', zone: 'q3', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 3100 }] },
    { id: 'q_cl1', tag: 'SC-1', label: 'Secondary clarifier', scadaType: 'CLARIFIER', zone: 'q4', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.8 }] },
    { id: 'q_cf1', tag: 'CF-1', label: 'Cartridge filter', scadaType: 'CARTRIDGE_FILTER', zone: 'q5', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.4 }] },
    { id: 'q_ro1', tag: 'RO-1', label: 'RO skid', scadaType: 'RO', zone: 'q5', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 70 }, { tag: 'PIN', widget: 'chart.knob', reading: 9.8 }] },
    { id: 'q_sp1', tag: 'SP-1', label: 'Sludge pump', scadaType: 'PMP', zone: 'q6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 380 }] },
    { id: 'q_fp1', tag: 'FP-1', label: 'Filter press', scadaType: 'F_PRESS', zone: 'q6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 290 }] } ],
  pipes: [
    { id: 'pq_su1', tag: 'SU-1', label: 'Suction, P-1', from: ['q_sump'], to: ['q_p1'], sensors: [] },
    { id: 'pq_su2', tag: 'SU-2', label: 'Suction, P-2', from: ['q_sump'], to: ['q_p2'], sensors: [] },
    { id: 'pq_dh', tag: 'DH-1', label: 'Pump discharge header', from: ['q_p1', 'q_p2'], to: ['q_fm1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 1.1 }] },
    { id: 'pq_cg', tag: 'CG-1', label: 'Coagulant line', from: ['q_ct1'], to: ['q_fm1'], sensors: [] },
    { id: 'pq_fm', tag: 'FD-1', label: 'To DAF', from: ['q_fm1'], to: ['q_daf1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 21 }] },
    { id: 'pq_daf', tag: 'FD-2', label: 'To aeration', from: ['q_daf1'], to: ['q_at1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 20 }] },
    { id: 'pq_air', tag: 'AH-1', label: 'Air header', from: ['q_bl1', 'q_bl2'], to: ['q_at1'], sensors: [] },
    { id: 'pq_ml', tag: 'ML-1', label: 'Mixed liquor', from: ['q_at1'], to: ['q_cl1'], sensors: [] },
    { id: 'pq_cl', tag: 'CL-1', label: 'Clarified water', from: ['q_cl1'], to: ['q_cf1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 19 }] },
    { id: 'pq_cf', tag: 'FT-1', label: 'Filtered water', from: ['q_cf1'], to: ['q_ro1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 3.1 }] },
    { id: 'pq_perm', tag: 'PM-1', label: 'RO permeate', from: ['q_ro1'], to: [], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 13 }] },
    { id: 'pq_rej', tag: 'RJ-1', label: 'RO reject', from: ['q_ro1'], to: [], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 6 }] },
    { id: 'pq_sl1', tag: 'SL-1', label: 'Sludge to pump', from: ['q_cl1'], to: ['q_sp1'], sensors: [] },
    { id: 'pq_sl2', tag: 'SL-2', label: 'Sludge to press', from: ['q_sp1'], to: ['q_fp1'], sensors: [] } ] };
window.SCADA_SAMPLES.jhajjar = { name: 'Jhajjar WTP', type: 'WTP', capacity: '3 MLD', drawn: '2026-10-08', zones: [
    { id: 'j1', name: 'Intake' }, { id: 'j2', name: 'Clarification' }, { id: 'j3', name: 'Filtration and softening' }, { id: 'j4', name: 'Chlorination' } ],
  equipment: [
    { id: 'j_p1', tag: 'RW-1', label: 'Raw water pump 1', scadaType: 'SUB_PMP', zone: 'j1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 24 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 8800 }] },
    { id: 'j_p2', tag: 'RW-2', label: 'Raw water pump 2', scadaType: 'SUB_PMP', zone: 'j1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 4100 }] },
    { id: 'j_fm1', tag: 'FM-1', label: 'Flash mixer', scadaType: 'FLASH_MIXER', zone: 'j2', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 3 }] },
    { id: 'j_ts1', tag: 'TS-1', label: 'Tube settler', scadaType: 'T_SETTLER', zone: 'j2', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.4 }] },
    { id: 'j_mgf1', tag: 'MGF-1', label: 'Multigrade filter 1', scadaType: 'ACF_MGF', zone: 'j3', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.5 }] },
    { id: 'j_mgf2', tag: 'MGF-2', label: 'Multigrade filter 2', scadaType: 'ACF_MGF', zone: 'j3', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.9 }] },
    { id: 'j_sf1', tag: 'SF-1', label: 'Softener', scadaType: 'SOFTNER', zone: 'j3', sensors: [{ tag: 'THR', widget: 'NUMBER_SENSOR', reading: 6100 }] },
    { id: 'j_cf1', tag: 'CF-1', label: 'Cartridge filter', scadaType: 'CARTRIDGE_FILTER', zone: 'j3', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.3 }] },
    { id: 'j_ro1', tag: 'RO-1', label: 'RO skid', scadaType: 'RO', zone: 'j3', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 74 }, { tag: 'PIN', widget: 'chart.knob', reading: 10.5 }] },
    { id: 'j_dp1', tag: 'DP-1', label: 'Hypo dosing pump', scadaType: 'D_PMP', zone: 'j4', sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.4 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 700 }] },
    { id: 'j_dt1', tag: 'DT-1', label: 'Hypo tank', scadaType: 'DOS_TANK', zone: 'j4', sensors: [{ tag: 'TLVL', widget: 'LEVEL_SENSOR', reading: 51 }] } ],
  pipes: [
    { id: 'pj_dh', tag: 'RW-H', label: 'Raw water header', from: ['j_p1', 'j_p2'], to: ['j_fm1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 2.4 }, { tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 128 }] },
    { id: 'pj_fm', tag: 'FD-1', label: 'To the settler', from: ['j_fm1'], to: ['j_ts1'], sensors: [] },
    { id: 'pj_cl', tag: 'CL-1', label: 'Clarified water', from: ['j_ts1'], to: ['j_mgf1', 'j_mgf2'], sensors: [{ tag: 'TURB', widget: 'NUMBER_SENSOR', reading: 2.8 }] },
    { id: 'pj_ft', tag: 'FT-1', label: 'Filtered water header', from: ['j_mgf1', 'j_mgf2'], to: ['j_sf1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 1.7 }, { tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 124 }] },
    { id: 'pj_sf', tag: 'SW-1', label: 'Soft water', from: ['j_sf1'], to: ['j_cf1'], sensors: [] },
    { id: 'pj_cf', tag: 'SW-2', label: 'To RO', from: ['j_cf1'], to: ['j_ro1'], sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 3.4 }] },
    { id: 'pj_perm', tag: 'PM-1', label: 'RO permeate', from: ['j_ro1'], to: ['j_dp1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 90 }] },
    { id: 'pj_out', tag: 'OUT-1', label: 'Treated water outlet', from: ['j_dp1'], to: [], sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.4 }] },
    { id: 'pj_ds', tag: 'DS-1', label: 'Hypo line', from: ['j_dt1'], to: ['j_dp1'], sensors: [] } ] };
/* Every sample also carries plain links, derived from its pipes, for anything that only needs the graph. */
Object.values(window.SCADA_SAMPLES).forEach((sc) => { sc.links = []; sc.pipes.forEach((p) => p.from.forEach((a) => p.to.forEach((b) => sc.links.push([a, b])))); });
/* What SCADA hands over later, when an engineer draws something new: a third blower on the
   Manesar aeration header, a third raw-water pump at Bawal, a second filter press at Vedanta.
   A pipe with an id that already exists joins it (more machines on the same header). */
window.SCADA_DELTAS = {
  vedanta: { what: 'FP-2, a second filter press', equipment: [{ id: 'v_fp2', tag: 'FP-2', label: 'Filter press 2', scadaType: 'F_PRESS', zone: 'v6', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }] }], pipes: [{ id: 'pv_sl3', tag: 'SL-3', label: 'Sludge to press 2', from: ['v_sp1'], to: ['v_fp2'], sensors: [] }] },
  manesar: { what: 'BL-3, a third blower on the aeration header', equipment: [{ id: 'bl3', tag: 'BL-3', label: 'Blower 3', scadaType: 'BLW', zone: 'bio', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.57 }, { tag: 'AMP', widget: 'chart.knob', reading: 36 }, { tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 12 }] }], pipes: [{ id: 'pp_air', from: ['bl3'] }] },
  rudrapur: { what: 'TP-3, a third transfer pump on the header', equipment: [{ id: 'r_p3', tag: 'TP-3', label: 'Transfer pump 3', scadaType: 'SUB_PMP', zone: 'r2', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }] }], pipes: [{ id: 'pr_su3', tag: 'SU-3', label: 'Suction, TP-3', from: ['r_eq1'], to: ['r_p3'], sensors: [] }, { id: 'pr_dh', from: ['r_p3'] }] },
  pithampur: { what: 'a pressure transmitter on the air header', equipment: [], pipes: [{ id: 'pq_air', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.5 }] }] },
  jhajjar: { what: 'RO-2, a second RO skid', equipment: [{ id: 'j_ro2', tag: 'RO-2', label: 'RO skid 2', scadaType: 'RO', zone: 'j3', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 0 }, { tag: 'PIN', widget: 'chart.knob', reading: 0 }] }], pipes: [{ id: 'pj_cf', to: ['j_ro2'] }, { id: 'pj_perm2', tag: 'PM-2', label: 'RO-2 permeate', from: ['j_ro2'], to: ['j_dp1'], sensors: [{ tag: 'FLOW', widget: 'NUMBER_SENSOR', reading: 0 }] }] },
  bawal: { what: 'P-3, a third raw-water pump', equipment: [{ id: 'sc_p3', tag: 'P-3', label: 'Raw water pump 3', scadaType: 'SUB_PMP', zone: 'z1', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }] }], pipes: [{ id: 'pb_su3', tag: 'SU-3', label: 'Suction, P-3', from: ['sc_bs1'], to: ['sc_p3'], sensors: [] }, { id: 'pb_dh', from: ['sc_p3'] }] },
};
Object.values(window.SCADA_DELTAS).forEach((dl) => { dl.links = []; dl.pipes.forEach((p) => (p.from || []).forEach((a) => (p.to || []).forEach((b) => dl.links.push([a, b])))); });
