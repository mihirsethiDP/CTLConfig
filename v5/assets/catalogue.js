/* The v5 library: the database's equipment types and nothing else. Loaded after data.js and layout-*.js.
   SCADA owns the plant: the nodes drawn from the database palette, the sensor widgets, the pipes, and the form filled in
   for each node (SCADA_FORM). The library owns what each database equipment type and each plant type inherits, and what it
   reads from the form (FORM_RULES). Detection is one rule: a node's type is node.equipmentType || node.code, looked up in
   CATALOGUE by code. Nothing is guessed from labels, nothing asks, and the form never changes a type.
   Alerts and condition-based jobs read only readings ON the equipment. What needs a reading on a pipe (a connection) is kept
   on the type as nextPhase, for the phase that adds connections.

   Where v1's 41 library types went (v1 type → database types; v1 items that read a connection moved to nextPhase):
   · Centrifugal blower → Blower, Mini Blower          · Aeration basin → Diffuser Tank, SBR, Cass Basin
   · MBBR reactor → MBBR                               · Anaerobic tank → Anaerobic Tank
   · Equalisation tank (level, flood switch, pH, cleaning) → Open Skeleton Tank; (level, flood switch) → Submersible Tank
   · Process tank → Tank, Tank 2, Open Process Tank, Closed Process Tank, Overhead Tank
   · Oil and grease trap → Oil & Grease Tank            · Mechanical bar screen → Mechanical Screen, Rotary Drum, Screen Chamber Tank
   · Grit chamber → Grit Chamber                        · Cascade aerator → Cascade Aerator · Static mixer → Static Mixer
   · Circular clarifier → Clarifier Tank                · Tube settler → Tube settler
   · Membrane bioreactor skid → MBR                     · Multigrade filter → ACF/MGF
   · Ultrafiltration skid → UF Membrane                 · RO skid → RO · Softener → Softner · Cartridge filter → Cartridge Filter
   · Hypochlorite dosing unit, Dosing pump → Dosing Pump · Dosing tank → Dosing Tank
   · UV unit → UV · Ozonator → Ozonator · Gas chlorinator → Gas Tonner
   · Centrifugal pump, Monobloc pump, Multistage pump, Progressive cavity pump → Pump (one type; the form's Type is noted, never a split)
   · Submersible pump → Submersible Pump                · Mixer → Agitator, Flash Mixer · Mixer, Flocculator → Flocculation
   · Screw press → Screw Press · Filter press → Filter Press · DAF unit → Dissolved Air Floatation
   · Air compressor → Air Compressor · Cooling tower → Cooling Tower
   · Anoxic tank, Sludge holding tank, Chlorine contact tank, Control panel (MCC): no database type. Their tank level and
     cleaning live on the tank types; ORP, the contact tank's residual chlorine and the MCC's incomer trip are not carried
     (the MCC trip stays as a cause any machine can land on, and its thermal inspection as a plant-wide flow).
   Types v1 never had, given modest content: Booster Pump (v1's centrifugal pump limits), Motor, Two way Valve, Three way Valve,
   Grit Classifier, Hydro Cyclone, Cavitator, Vtg Chamber, QUADSON EVAPORATOR, Sabre, Small Sabre, Bio Health Tracker.
   confirm: one plain line on a type whose content is a reasoned guess the owner must confirm (every type v1 never had, and
   any limit the library made up); the library and detection cards show it as a muted 'to confirm' chip. */

/* ── 1. The database palette: every row of the equipment palette API, with what it is to the library ──────
   kind: 'equipment' (one of the 56 equipment types) · 'drawing' (drawn, not equipment: nothing inherited) ·
   'widget' (a reading on the equipment it is linked to) · 'ignore'. questions: how many the node's form asks. */
window.DB_PALETTE = [
  ['PLANT_EQUIPMENT', 'Plant', 'equipment', 'drawing', 1, 'the plant itself; its label is the site label'],
  ['TANK', 'Tank', 'equipment', 'equipment', 8], ['TANK_2', 'Tank 2', 'equipment', 'equipment', 8], ['OP_TANK', 'Open Process Tank', 'equipment', 'equipment', 8],
  ['CP_TANK', 'Closed Process Tank', 'equipment', 'equipment', 8], ['CLARIFIER', 'Clarifier Tank', 'equipment', 'equipment', 8], ['OS_TANK', 'Open Skeleton Tank', 'equipment', 'equipment', 13],
  ['OS_TANK_SP', 'Submersible Tank', 'equipment', 'equipment', 10], ['OS_TANK_SC', 'Screen Chamber Tank', 'equipment', 'equipment', 10], ['OS_TANK_DF', 'Diffuser Tank', 'equipment', 'equipment', 10],
  ['OS_TANK_AG', 'Agitator', 'equipment', 'equipment', 2], ['SH_TANK', 'Oil & Grease Tank', 'equipment', 'equipment', 12], ['DOS_TANK', 'Dosing Tank', 'equipment', 'equipment', 7],
  ['OVERHEAD_T', 'Overhead Tank', 'equipment', 'equipment', 1], ['ANAEROBIC_TANK', 'Anaerobic Tank', 'equipment', 'equipment', 1], ['SBR_TANK', 'SBR', 'equipment', 'equipment', 1],
  ['CASS_BASIN', 'Cass Basin', 'equipment', 'equipment', 1], ['PMP', 'Pump', 'equipment', 'equipment', 11], ['SUB_PMP', 'Submersible Pump', 'equipment', 'equipment', 12],
  ['D_PMP', 'Dosing Pump', 'equipment', 'equipment', 12], ['BT_PMP', 'Booster Pump', 'equipment', 'equipment', 1], ['BLW', 'Blower', 'equipment', 'equipment', 10],
  ['M_BLW', 'Mini Blower', 'equipment', 'equipment', 1], ['MOTOR', 'Motor', 'equipment', 'equipment', 1], ['AIR_COMPRESSURE', 'Air Compressor', 'equipment', 'equipment', 1],
  ['VALVE_2', 'Two way Valve', 'equipment', 'equipment', 4], ['VALVE_3', 'Three way Valve', 'equipment', 'equipment', 3],
  ['ZONE', 'ZONE', 'equipment', 'drawing', 3, 'an inlet or outlet point of the drawing'], ['JOINS', 'Joint', 'equipment', 'drawing', 1, 'where pipes meet'],
  ['SC_PRESS', 'Screw Press', 'equipment', 'equipment', 11], ['F_PRESS', 'Filter Press', 'equipment', 'equipment', 6], ['SOFTNER', 'Softner', 'equipment', 'equipment', 10],
  ['ACF_MGF', 'ACF/MGF', 'equipment', 'equipment', 8], ['OZONATOR', 'Ozonator', 'equipment', 'equipment', 5], ['MBBR', 'MBBR', 'equipment', 'equipment', 12],
  ['MBR', 'MBR', 'equipment', 'equipment', 12], ['T_SETTLER', 'Tube settler', 'equipment', 'equipment', 8], ['UF_MEM', 'UF Membrane', 'equipment', 'equipment', 7],
  ['RO', 'RO', 'equipment', 'equipment', 1], ['UV', 'UV', 'equipment', 'equipment', 1], ['DAF', 'Dissolved Air Floatation', 'equipment', 'equipment', 1],
  ['FLASH_MIXER', 'Flash Mixer', 'equipment', 'equipment', 1], ['FLOCCULATION', 'Flocculation', 'equipment', 'equipment', 1], ['STATIC_MIXER', 'Static Mixer', 'equipment', 'equipment', 1],
  ['ROTARY_DRUM', 'Rotary Drum', 'equipment', 'equipment', 1], ['GRIT_CHAMBER', 'Grit Chamber', 'equipment', 'equipment', 1], ['GRIT_CLASSIFIER', 'Grit Classifier', 'equipment', 'equipment', 1],
  ['MECHANICAL_SCREEN', 'Mechanical Screen', 'equipment', 'equipment', 1], ['CARTRIDGE_FILTER', 'Cartridge Filter', 'equipment', 'equipment', 1], ['CASCADE_AREATOR', 'Cascade Aerator', 'equipment', 'equipment', 1],
  ['COOLING_TOWER', 'Cooling Tower', 'equipment', 'equipment', 1], ['HYDROCYCLONE', 'Hydro Cyclone', 'equipment', 'equipment', 1], ['CAVITATOR', 'Cavitator', 'equipment', 'equipment', 1],
  ['GAS_TONNER', 'Gas Tonner', 'equipment', 'equipment', 1], ['VTG_CHAMBER', 'Vtg Chamber', 'equipment', 'equipment', 1], ['BIG_SABRE', 'Sabre', 'equipment', 'equipment', 1],
  ['MINI_SABRE', 'Small Sabre', 'equipment', 'equipment', 1], ['QUADSON_EVAPORATOR', 'QUADSON EVAPORATOR', 'equipment', 'equipment', 1], ['BIO_HEALTH_TRACKER', 'Bio Health Tracker', 'equipment', 'equipment', 1],
  ['BUILDING', 'Building', 'equipment', 'drawing', 1, 'a building outline'],
  ['LEVEL_SENSOR', 'Level Sensor', 'widget', 'widget', 2, 'a level reading on the equipment it is linked to'], ['chart.knob', 'Gauge', 'widget', 'widget', 2, 'a reading on the equipment it is linked to'],
  ['SWITCH_SENSOR', 'Switch', 'widget', 'widget', 2, 'an on/off reading on the equipment it is linked to'], ['NUMBER_SENSOR', 'Number Widget', 'widget', 'widget', 2, 'a reading on the equipment it is linked to'],
  ['TABLE_WIDGET', 'Table Widget', 'widget', 'widget', 2, 'readings on the equipment it is linked to'], ['LABEL_WIDGET', 'Label Widget', 'widget', 'ignore', 1, 'a text label'],
  ['ASSET_EQUIPMENT', 'Saved templates', 'template', 'ignore', 1, 'saved drawings (18 in the response, e.g. Lodha, DMF1, Amity Template, Tata Primanti)'],
].map(([code, name, category, kind, questions, note]) => ({ code, name, category, kind, questions, ...(note ? { note } : {}) }));
/* the question file calls the gauge CHART.KNOB; the palette and the drawings call it chart.knob */
window.DB_PALETTE.find((p) => p.code === 'chart.knob').questionCode = 'CHART.KNOB';
window.DB_BY_CODE = {}; window.DB_PALETTE.forEach((p) => { window.DB_BY_CODE[p.code] = p; }); window.DB_BY_CODE['CHART.KNOB'] = window.DB_BY_CODE['chart.knob'];
/* node types the question file has and the palette does not: not equipment types in v5 */
window.DB_QUESTION_ONLY = ['OH_TANK', 'CS_TANK', 'GAUGE_SENSOR', 'GROUP', 'SIREN'];

/* ── 2. Readings: every reading the library, the widget map or a sample uses, and where it sits ─────────────
   where 'equipment': the sensor sits on or in the equipment and measures its own state or what it holds; the library may
   alert on it. where 'connection': it measures the fluid in a pipe, or a difference between two connections; it waits for
   the next phase (note: where it is read). kind: status (on/off) · process · analytical (a probe that drifts) · meter ·
   computed. valid: the range a working sensor reports. direction: which way is bad by default. tag: the widget tag. */
window.READINGS = (function () {
  const E = (tag, unit, kind, valid, direction) => ({ where: 'equipment', tag, unit, kind, valid, direction });
  const C = (tag, unit, kind, valid, direction, note, extra) => ({ where: 'connection', note, tag, unit, kind, valid, direction, ...(extra || {}) });
  return {
    /* on the equipment: its own state */
    'Run status': E('RUN', '', 'status', [0, 1], 'above'),
    'Trip contact': E('TRIP', '', 'status', [0, 1], 'above'),
    'Auto / manual': E('AM', '', 'status', [0, 1], 'above'),
    'Motor current': E('AMP', 'A', 'process', [0, 60], 'above'),
    'Speed': E('SPD', '%', 'process', [0, 100], 'below'),
    'Run hours': E('HRS', 'h', 'meter', [0, 999999], null),
    'Vibration': E('VIB', 'mm/s', 'process', [0, 20], 'above'),
    'Bearing temperature': E('BTEMP', '°C', 'process', [0, 120], 'above'),
    'Winding temperature': E('WTEMP', '°C', 'process', [0, 180], 'above'),
    'Valve position': E('POS', '', 'status', [0, 1], 'above'),
    'Lamp fault': E('LAMP', '', 'status', [0, 1], 'above'),
    'UV intensity': E('UVI', '%', 'process', [0, 100], 'below'),
    /* on the equipment: what it holds */
    'Level': E('LVL', '%', 'process', [0, 100], 'above'),
    'Sump flood switch': E('FLOOD', '', 'status', [0, 1], 'above'),
    'Dissolved oxygen': E('DO', 'mg/L', 'analytical', [0, 6], 'below'),
    'MLSS': E('MLSS', 'mg/L', 'analytical', [0, 12000], 'above'),
    'pH': E('PH', 'pH', 'analytical', [1, 14], 'above'),
    'ORP': E('ORP', 'mV', 'analytical', [-500, 500], 'below'),
    'Temperature': E('TEMP', '°C', 'process', [0, 60], 'above'),
    'Sludge blanket': E('BLK', 'm', 'analytical', [0, 4], 'above'),
    'Chemical tank level': E('TLVL', '%', 'process', [0, 100], 'below'),
    /* net: the scale is tared to read the chlorine left, so a full tonner reads about 900 kg */
    'Tonner net weight': E('WT', 'kg', 'process', [0, 1000], 'below'),
    'Chlorine leak': E('LEAK', '', 'status', [0, 1], 'above'),
    /* on a connection: the next phase */
    'Line pressure': C('PRESS', 'bar', 'process', [0, 12], 'above', 'on the discharge line or header'),
    'Discharge pressure': C('DPRESS', 'bar', 'process', [0, 25], 'below', 'on the discharge line'),
    'Suction pressure': C('SPRESS', 'bar', 'process', [-1, 6], 'below', 'on the suction line'),
    'Inlet pressure': C('PIN', 'bar', 'process', [0, 20], 'above', 'on the feed line'),
    'Flow': C('FLOW', 'm³/h', 'process', [0, 1000], 'below', 'in the pipe, from a flow meter'),
    'Throughput': C('THR', 'm³', 'meter', [0, 999999], null, 'totalled by a flow meter on the outlet line'),
    'Differential pressure': C('DP', 'bar', 'process', [0, 3], 'above', "across the filter's inlet and outlet"),
    'Trans-membrane pressure': C('TMP', 'bar', 'process', [0, 1], 'above', 'across the membrane, feed side to permeate side'),
    'Permeability': C('PERM', 'LMH/bar', 'process', [0, 400], 'below', 'worked out from the permeate flow and the pressure, both on the lines'),
    'Recovery': C('REC', '%', 'computed', [0, 100], 'below', 'permeate flow over feed flow, both on the lines', { expr: 'PERM_FLOW / FEED_FLOW × 100' }),
    'Outlet turbidity': C('TURB', 'NTU', 'analytical', [0, 100], 'above', 'in the outlet water'),
    'Residual chlorine': C('FRC', 'mg/L', 'analytical', [0, 10], 'below', 'in the outlet water, downstream of the dose'),
    'Outlet hardness': C('HARD', 'ppm', 'analytical', [0, 1000], 'above', 'in the outlet water'),
    'Permeate conductivity': C('COND', 'µS/cm', 'analytical', [0, 5000], 'above', 'in the permeate line'),
    'Level differential': C('DH', 'mm', 'process', [0, 500], 'above', 'upstream against downstream of the screen'),
    'Cooling water temperature': C('CWT', '°C', 'process', [0, 80], 'above', 'in the water leaving the tower'),
  };
})();
/* SCADA widget tags → readings (v1's map, extended). The widget says how it is drawn; the tag says what it measures. */
window.SCADA_SENSOR_MAP = {}; Object.entries(window.READINGS).forEach(([name, r]) => { window.SCADA_SENSOR_MAP[r.tag] = name; });
window.SCADA_WIDGETS = { LEVEL_SENSOR: 'Level Sensor', NUMBER_SENSOR: 'Number Widget', 'chart.knob': 'Gauge', SWITCH_SENSOR: 'Switch', TABLE_WIDGET: 'Table Widget' };

/* ── 3. Equipment types: one per database equipment type, under the database's own name ─────────────────────
   archetype, tier (A critical · B essential · C standard: what failing it costs a sewage or water plant), expects (the
   programme it should have), prefix (tag prefix), sensors (ON THE EQUIPMENT ONLY: what such equipment usually carries in
   SCADA), nextPhase (what the type will have once connections are in the library: readings, alerts and work, each with
   where it is read). Optional: tagMap (a widget tag this type reads as another reading: a Cooling Tower's TEMP is the water
   leaving it), confirm (the guess the owner must confirm). */
window.CATALOGUE = (function () {
  const R = window.READINGS;
  const S = (name, o) => { const r = R[name], x = o || {}; const s = { name, tag: r.tag, unit: r.unit, kind: r.kind, valid: (x.valid || r.valid).slice(), direction: 'direction' in x ? x.direction : r.direction, reading: 'reading' in x ? x.reading : name === 'Run status' ? 1 : r.kind === 'meter' ? 120 : 0 }; if (r.expr) s.expr = r.expr; return s; };
  const NR = (name, note) => ({ name, note: note || R[name].note });
  const NA = (name, reading, note, direction, limits, flow, cause) => ({ name, reading, note, direction, ...(limits ? { limits } : {}), ...(flow ? { flow } : {}), ...(cause ? { cause } : {}) });
  const NW = (name, note, reading) => ({ name, note, ...(reading ? { reading } : {}) });
  const NP = (readings, alerts, work) => ({ readings: readings || [], alerts: alerts || [], work: work || [] });
  const T = (code, archetype, tier, expects, prefix, sensors, np, extra) => ({ code, type: window.DB_BY_CODE[code].name, archetype, tier, expects, prefix, sensors, nextPhase: np || NP(), ...(extra || {}) });
  const AER = () => [S('Dissolved oxygen', { reading: 2.1 }), S('MLSS', { reading: 3200 }), S('Temperature', { reading: 29 })];
  const SCREEN_NP = () => NP([NR('Level differential')], [NA('Screen differential high', 'Level differential', 'compares the channel upstream and downstream of the screen: two connections', 'above', { minor: 150, major: 300 }, 'f_screen_dh')]);
  const HEAD = NW('Discharge pressure limits from the Maximum Head answer', "the form's Maximum Head sets them once the discharge line is read", 'Discharge pressure');
  const PUMP_NP = (alerts) => NP([NR('Discharge pressure'), NR('Flow', 'in the delivery line')], alerts, [HEAD]);
  const BLOWER_NP = () => NP([NR('Line pressure', 'on the discharge line')], [NA('Line pressure high', 'Line pressure', 'needs the discharge line, a connection', 'above', { minor: 0.65, major: 0.85 }, 'f_blower_press')]);
  /* the guesses the owner confirms: one line per type */
  const CF = (line) => ({ confirm: line });
  const NEW = 'New type, content guessed: ';
  const MLSS_CF = CF('MLSS limits to confirm: high at 4500 mg/L (Minor, from v1), low at 2000 mg/L (Minor, new).');
  const AMPS_CF = (amps) => CF(`The current limit (Minor at ${amps} A) is a guess: the form has no motor rating to work it out from.`);
  const DEVICE_CF = CF(NEW + 'a sensing device, wiped and checked every month; what it reads arrives as widgets.');
  const VALVE_CF = CF(NEW + 'the valve position is an open or closed contact, and the valve is stroked every 3 months.');
  return [
    /* tanks and basins */
    T('TANK', 'vessel', 'C', ['cleaning'], 'T', [S('Level', { reading: 55 })]),
    T('TANK_2', 'vessel', 'C', ['cleaning'], 'T', [S('Level', { reading: 52 })]),
    T('OP_TANK', 'vessel', 'C', ['cleaning'], 'T', [S('Level', { reading: 60 })]),
    T('CP_TANK', 'vessel', 'C', ['cleaning'], 'T', [S('Level', { reading: 58 })]),
    /* the scraper bridge turns, so it is a rotating machine for maintenance */
    T('CLARIFIER', 'rotating', 'B', ['mechanical PM'], 'SC', [S('Sludge blanket', { reading: 0.7 }), S('Run status')], NP([NR('Outlet turbidity', 'in the water leaving over the weir')])),
    /* the flood switch and the pH probe are not on every open tank: their alerts apply where SCADA draws them */
    T('OS_TANK', 'vessel', 'C', ['cleaning'], 'EQ', [S('Level', { reading: 58 }), S('Sump flood switch'), S('pH', { reading: 7.3 })], null, CF('pH limits to confirm: high at 8.5 (Minor) and 9.5 (Major) from v1, low at 6.0 (Minor) and 5.5 (Major), new.')),
    T('OS_TANK_SP', 'vessel', 'C', ['cleaning'], 'ST', [S('Level', { reading: 50 }), S('Sump flood switch')]),
    T('OS_TANK_SC', 'fixed', 'B', ['inspection'], 'SCR', [], SCREEN_NP()),
    T('OS_TANK_DF', 'vessel', 'B', [], 'AT', AER(), null, MLSS_CF),
    T('OS_TANK_AG', 'rotating', 'C', ['mechanical PM'], 'MX', [S('Run status'), S('Motor current', { valid: [0, 30], reading: 6 })], null, AMPS_CF(24)),
    T('SH_TANK', 'vessel', 'C', ['desludging'], 'OG', [S('Level', { reading: 40 })]),
    /* a dosing tank's level is the chemical left in it: low is the bad way */
    T('DOS_TANK', 'vessel', 'B', ['refill'], 'DT', [S('Level', { direction: 'below', reading: 60 })]),
    T('OVERHEAD_T', 'vessel', 'C', ['cleaning'], 'OHT', [S('Level', { reading: 70 })]),
    T('ANAEROBIC_TANK', 'vessel', 'B', ['desludging'], 'AN', [S('pH', { direction: 'below', reading: 7.0 }), S('Temperature', { reading: 31 })]),
    T('SBR_TANK', 'vessel', 'B', [], 'SBR', AER(), null, MLSS_CF),
    T('CASS_BASIN', 'vessel', 'B', [], 'CB', AER(), null, MLSS_CF),
    /* pumps, blowers, motors and valves. Pump is one type: the form's Type (MonoBlock, Centrifugal, High Pressure, Screw) is noted on
       the machine; Speed is read when a VFD drives it. Discharge pressure and flow are on the pipes. */
    T('PMP', 'rotating', 'B', ['mechanical PM'], 'P', [S('Run status'), S('Motor current', { reading: 18 }), S('Speed', { reading: 78 }), S('Run hours', { reading: 60 })], PUMP_NP([NA('Discharge pressure low', 'Discharge pressure', 'needs the discharge line, a connection', 'below')])),
    T('SUB_PMP', 'rotating', 'B', ['mechanical PM'], 'P', [S('Run status'), S('Motor current', { valid: [0, 40], reading: 14 }), S('Speed', { reading: 78 }), S('Run hours', { reading: 60 })], PUMP_NP(), CF('Bearing and seal service every 6 months or 4000 run-hours, as for Pump; v1 said 600 run-hours, likely a slip.')),
    /* the chemical tank a dosing pump draws from is a Dosing Tank, with its own level and low alert; the chlorine it doses is
       read downstream, in the outlet water */
    T('D_PMP', 'dosing', 'A', ['pump PM'], 'DP', [S('Run status'), S('Speed', { reading: 78 }), S('Run hours', { reading: 300 })],
      NP([NR('Residual chlorine'), NR('Flow', 'on the dosing line'), NR('Discharge pressure')], [NA('Residual chlorine low', 'Residual chlorine', 'measured in the outlet water downstream of the dose, a connection', 'below', { minor: 0.2 }, 'f_frc')], [HEAD])),
    T('BT_PMP', 'rotating', 'C', ['mechanical PM'], 'BP', [S('Run status'), S('Motor current', { reading: 12 }), S('Run hours', { reading: 60 })], NP([NR('Discharge pressure', 'on the delivery header')]), CF(NEW + 'treated as a centrifugal pump, with current limits at 40 A and 45 A (the form has no motor rating) and a bearing and seal service every 6 months or 4000 run-hours.')),
    T('BLW', 'rotating', 'A', ['mechanical PM'], 'BL', [S('Run status'), S('Trip contact'), S('Motor current', { reading: 38 }), S('Run hours', { reading: 120 })], BLOWER_NP()),
    T('M_BLW', 'rotating', 'B', ['mechanical PM'], 'MB', [S('Run status'), S('Trip contact'), S('Motor current', { valid: [0, 20], reading: 8 }), S('Run hours', { reading: 120 })], BLOWER_NP()),
    T('MOTOR', 'rotating', 'C', ['mechanical PM'], 'M', [S('Run status'), S('Trip contact'), S('Motor current', { reading: 15 }), S('Run hours', { reading: 120 })], null, CF(NEW + 'run, trip, current and run-hours readings, a Major alert on a trip, and an insulation and bearing check every 6 months or 4000 run-hours.')),
    T('AIR_COMPRESSURE', 'rotating', 'B', ['mechanical PM'], 'AC', [S('Run status'), S('Run hours', { reading: 800 })], NP([NR('Line pressure', 'on the air line from the receiver')], [NA('Air pressure low', 'Line pressure', 'needs the air line, a connection', 'below', { minor: 5.5, major: 4.5 }, 'f_compressor')])),
    T('VALVE_2', 'valve', 'C', ['inspection'], 'V', [S('Valve position', { reading: 1 })], null, VALVE_CF),
    T('VALVE_3', 'valve', 'C', ['inspection'], 'V', [S('Valve position', { reading: 1 })], null, VALVE_CF),
    /* sludge, filters and membranes */
    T('SC_PRESS', 'rotating', 'B', ['mechanical PM'], 'SCP', [S('Run status'), S('Motor current', { valid: [0, 40], reading: 11 }), S('Run hours', { reading: 300 })], NP([NR('Flow', 'on the sludge feed line')])),
    T('F_PRESS', 'rotating', 'B', ['mechanical PM', 'cloth replacement'], 'FP', [S('Run status'), S('Run hours', { reading: 150 })], NP([NR('Inlet pressure', 'on the sludge feed line; it shows when the press is full')])),
    T('SOFTNER', 'vessel', 'B', ['refill'], 'SF', [], NP([NR('Throughput'), NR('Outlet hardness', 'in the soft water leaving the softener')], [], [
      NW('Regenerate softener', 'starts on the volume treated, read by the flow meter on the outlet line', 'Throughput'),
      NW('Regeneration point from the OBR answer', "the form's OBR sets it once the volume treated is read", 'Throughput'),
      NW('Auto valves: confirm the regeneration, not do it', "the form's Auto valves answer applies once the volume-based regeneration is in the library")])),
    T('ACF_MGF', 'vessel', 'B', ['backwash'], 'MGF', [], NP([NR('Differential pressure')], [NA('Backwash not keeping up', 'Differential pressure', "reads the pressure across the filter's inlet and outlet: two connections", 'above', { minor: 1.8 }, 'f_mgf_dp')], [
      NW('Backwash when pressure builds', "starts when the pressure across the filter's inlet and outlet passes 1.2 bar, done below 1.0", 'Differential pressure'),
      NW('Auto valves: confirm the pressure backwash, not do it', "the form's Auto valves answer applies once the pressure backwash is in the library")])),
    T('OZONATOR', 'dosing', 'B', ['pump PM'], 'OZ', [S('Run status'), S('Trip contact'), S('Run hours', { reading: 900 })], null, CF('Guessed: the trip contact is taken as the air dryer\x27s dew-point trip; confirm what trips the ozonator.')),
    T('MBBR', 'vessel', 'B', ['media inspection'], 'MBBR', [S('Dissolved oxygen', { reading: 2.4 })]),
    T('MBR', 'membrane', 'A', ['CIP'], 'MBR', [], NP([NR('Permeability'), NR('Trans-membrane pressure'), NR('Outlet turbidity', 'in the permeate')], [
      NA('Permeability falling', 'Permeability', 'needs the permeate flow and the pressure, read on the lines', 'below', { minor: 80, major: 50 }, 'f_turb'),
      NA('Outlet turbidity high', 'Outlet turbidity', 'measured in the permeate, a connection', 'above', { minor: 5, major: 10 }, 'f_turb')], [
      NW('Pressure limits from the Design TMP answer', "the form's Design TMP sets them once the pressure across the membrane is read", 'Trans-membrane pressure')])),
    T('T_SETTLER', 'vessel', 'B', ['cleaning'], 'TS', [S('Sludge blanket', { reading: 0.5 })]),
    T('UF_MEM', 'membrane', 'A', ['CIP'], 'UF', [], NP([NR('Inlet pressure'), NR('Trans-membrane pressure'), NR('Recovery')], [
      NA('Recovery low', 'Recovery', 'permeate flow over feed flow, both on the lines', 'below', { minor: 72, major: 65 }, 'f_uf'),
      NA('Inlet pressure high', 'Inlet pressure', 'needs the feed line, a connection', 'above', { minor: 3.2 }, 'f_uf')]), { cycles: true }),
    T('RO', 'membrane', 'A', ['CIP'], 'RO', [], NP([NR('Inlet pressure', 'on the high-pressure feed line'), NR('Recovery'), NR('Permeate conductivity')], [
      NA('Recovery low', 'Recovery', 'permeate flow over feed flow, both on the lines', 'below', { minor: 65, major: 55 }, 'f_ro'),
      NA('Inlet pressure high', 'Inlet pressure', 'needs the high-pressure feed line, a connection', 'above', { minor: 14 }, 'f_ro')])),
    /* the intensity sensor looks into the reactor; about 70% of a new lamp's reading is the usual point to replace */
    T('UV', 'fixed', 'A', ['lamp replacement'], 'UV', [S('Run status'), S('Lamp fault'), S('UV intensity', { reading: 88 }), S('Run hours', { reading: 3400 })], null, CF("UV intensity limits are the usual lamp-replacement point, not the maker's figure: Minor below 70%, Major below 60%, only while the UV runs.")),
    T('DAF', 'rotating', 'B', ['mechanical PM'], 'DAF', [S('Run status'), S('Motor current', { valid: [0, 40], reading: 9 })], null, AMPS_CF(30)),
    T('FLASH_MIXER', 'rotating', 'C', ['mechanical PM'], 'FM', [S('Run status'), S('Motor current', { valid: [0, 30], reading: 6 })], null, AMPS_CF(24)),
    T('FLOCCULATION', 'rotating', 'C', ['mechanical PM'], 'FL', [S('Run status'), S('Motor current', { valid: [0, 30], reading: 5 })], null, AMPS_CF(24)),
    T('STATIC_MIXER', 'fixed', 'C', ['inspection'], 'SM', []),
    /* screens and grit */
    T('ROTARY_DRUM', 'rotating', 'B', ['inspection'], 'RD', [S('Run status'), S('Trip contact')], SCREEN_NP()),
    T('GRIT_CHAMBER', 'fixed', 'C', ['desludging'], 'GC', []),
    T('GRIT_CLASSIFIER', 'rotating', 'C', ['mechanical PM'], 'GCL', [S('Run status')], null, CF(NEW + 'a screw classifier with a run status, and a screw and gearbox check every 3 months.')),
    T('MECHANICAL_SCREEN', 'fixed', 'B', ['inspection'], 'BS', [S('Run status'), S('Trip contact')], SCREEN_NP()),
    T('CARTRIDGE_FILTER', 'fixed', 'C', ['cartridge replacement'], 'CF', [], NP([NR('Differential pressure', "across the housing's inlet and outlet")], [NA('Cartridge choked', 'Differential pressure', "reads the pressure across the housing's inlet and outlet: two connections", 'above', { minor: 1.0 }, null, 'c_cartridge')])),
    T('CASCADE_AREATOR', 'fixed', 'C', ['cleaning'], 'CA', []),
    /* a temperature widget on a cooling tower reads the water leaving it, not the tower */
    T('COOLING_TOWER', 'rotating', 'B', ['mechanical PM', 'cleaning'], 'CT', [S('Run status')], NP([NR('Cooling water temperature')], [NA('Outlet temperature high', 'Cooling water temperature', 'measured in the water leaving the tower, a connection', 'above', { minor: 36, major: 40 }, 'f_ct')]), { tagMap: { TEMP: 'Cooling water temperature' } }),
    T('HYDROCYCLONE', 'fixed', 'C', ['inspection'], 'HC', [], NP([NR('Inlet pressure', 'on the feed line to the cyclone')]), CF(NEW + 'an apex and liner check every 3 months.')),
    T('CAVITATOR', 'rotating', 'B', ['mechanical PM'], 'CV', [S('Run status'), S('Trip contact'), S('Run hours', { reading: 400 })], null, CF(NEW + 'treated as a nozzle or orifice-plate unit with run, trip and run-hours readings, a Major alert on a trip, and a service every 6 months.')),
    /* the tonner sits on a weighing scale tared to the chlorine left; the leak detector hangs beside it */
    T('GAS_TONNER', 'dosing', 'A', ['tonner change'], 'CL', [S('Tonner net weight', { reading: 620 }), S('Chlorine leak')], NP([NR('Residual chlorine')], [NA('Residual chlorine low', 'Residual chlorine', 'measured in the outlet water downstream of the dose, a connection', 'below', { minor: 0.2 }, 'f_gas_frc')]), CF('Guessed: the scale reads the chlorine left (net; a full tonner holds about 900 kg), so Caution at 150 kg and Minor at 90 kg; the leak detector beside the tonner is taken as its reading.')),
    T('VTG_CHAMBER', 'vessel', 'C', ['cleaning'], 'VTG', [], null, CF(NEW + 'a chamber cleaned like a tank every 6 months.')),
    /* DigitalPaani's own devices: kept clean and checked; what they read arrives as widgets */
    T('BIG_SABRE', 'device', 'C', ['inspection'], 'SAB', [], null, DEVICE_CF),
    T('MINI_SABRE', 'device', 'C', ['inspection'], 'SAB', [], null, DEVICE_CF),
    T('QUADSON_EVAPORATOR', 'vessel', 'B', ['cleaning'], 'EVP', [S('Run status')], null, CF(NEW + 'a heated evaporator with a run status, descaled and inspected every 3 months.')),
    T('BIO_HEALTH_TRACKER', 'device', 'C', ['inspection'], 'BHT', [], null, DEVICE_CF),
  ];
})();
window.CATALOGUE_BY_CODE = {}; window.CATALOGUE_BY_TYPE = {}; window.CATALOGUE.forEach((c) => { window.CATALOGUE_BY_CODE[c.code] = c; window.CATALOGUE_BY_TYPE[c.type] = c; });
/* Detection, the one rule: the node's stored equipment type wins over the shape it was drawn with. Returns the library entry,
   or kind 'drawing' / 'widget' / 'ignore' for palette items that are not equipment, or notInDb for a code the database lacks. */
window.detectDbType = function (node) {
  const code = node.code, dbType = node.equipmentType || code, row = window.DB_BY_CODE[dbType];
  if (row && row.kind !== 'equipment') return { code, dbType, kind: row.kind, entry: null };
  const entry = window.CATALOGUE_BY_CODE[dbType] || null, drawn = window.DB_BY_CODE[code];
  return { code, dbType, kind: 'equipment', entry, type: entry ? entry.type : 'not in the database', ...(entry ? {} : { notInDb: true }), ...(dbType !== code ? { drawnAs: drawn ? drawn.name : code } : {}) };
};

/* ── 4. The SCADA equipment form, as data: what SCADA asks when a thing is drawn ───────────
   "Equipment questions by node type": 350 questions over 81 node types. One list per node type that asks more than a
   Name; the 37 name-only types are listed below. Question text is SCADA's own, typos included ('Breath' on the Oil & Grease
   Tank, MBBR and Tube settler forms); one change: the second 'MOC' on OS_TANK / CS_TANK is 'MOC (diffuser material)'. */
window.SCADA_FORM = (function () {
  const Q = (q, input, req, options, def) => ({ q, input, req: !!req, ...(options ? { options } : {}), ...(def != null ? { default: def } : {}) });
  const YN = ['Yes', 'No'];
  const MOC = ['Reinforced Concrete', 'Precast Concrete', 'Lined Concrete', 'Mild Steel (MS) with Epoxy Coating', 'Stainless Steel (SS 304/316)', 'Galvanized Steel', 'Fiber-Reinforced Plastic (FRP)', 'High-Density Polyethylene (HDPE)', 'PVC (Polyvinyl Chloride)', 'SDPE (Structured Density Polyethylene)'];
  const DIFF = [Q('Diffusers Type', 'dropdown', false, ['Disc Diffusers', 'Tube Diffusers', 'Panel Diffusers', 'Dome Diffusers', 'Orifice Pipe Diffusers']), Q('MOC (diffuser material)', 'dropdown', false, ['Membrane Diffusers', 'Ceramic Diffusers', 'Plastic Diffusers']), Q('Installation & Layout', 'dropdown', false, ['Fixed Grid System', 'Retrievable System', 'Modular Diffuser Arrangement'])];
  const REMOTE = Q('Add remote control functionality?', 'checkbox', false, ['Remote Control']);
  const NAME = Q('Name', 'text', true);
  const TANK8 = [NAME, Q('Description', 'text'), Q('Shape', 'dropdown', false, ['cuboid', 'cylindrical']), Q('Radius', 'text'), Q('Width', 'not set'), Q('Height', 'not set'), Q('Length', 'not set'), Q('Material of construction (MOC)', 'dropdown', false, MOC)];
  const OS10 = [NAME, Q('Color', 'autocomplete', true, null, 'Blue'), Q('Is Over Flow Process', 'radio', true, YN, 'No'), Q('Description', 'text'), Q('Shape', 'dropdown', false, ['Cylindrical', 'Cuboid']), Q('Radius', 'number'), Q('Width', 'number'), Q('Length', 'number'), Q('Depth / Height', 'number'), Q('MOC', 'dropdown', false, MOC)];
  const WIDGET = [NAME, Q('Choose Sensor', 'api_autocomplete', true, ['Loaded from /visualization/plantSensorsList'])];
  const PUMP_MOTOR = [Q('Motor Make', 'text'), Q('Motor Model', 'text'), Q('Motor Company', 'text', false, YN)];
  return {
    /* tanks and basins */
    TANK: TANK8, TANK_2: TANK8, OP_TANK: TANK8, CP_TANK: TANK8, CLARIFIER: TANK8,
    OH_TANK: [NAME, Q('Description', 'text'), Q('Shape', 'dropdown', false, ['Cylindrical', 'Cuboid']), Q('Radius', 'text'), Q('Height', 'text'), Q('Width', 'text'), Q('Length', 'text'), Q('MOC', 'text'), Q('Stilts Height (TANK FRAME HEIGHT)', 'text')],
    OS_TANK_SC: OS10, OS_TANK_SP: OS10, OS_TANK_DF: OS10,
    OS_TANK: [...OS10, ...DIFF],
    OS_TANK_AG: [NAME, REMOTE],
    CS_TANK: [NAME, Q('Color', 'dropdown', true, ['Blue', 'Yellow', 'Black']), Q('Screen Chamber', 'text', true), Q('Diffuser', 'radio', true, YN), Q('Submersible Pump', 'radio', true, YN), Q('Is Over Flow Process', 'radio', true, YN), Q('Description', 'text'), Q('Shape', 'dropdown', false, ['Cylindrical', 'Cuboid']), Q('Radius', 'number'), Q('Width', 'number'), Q('Length', 'number'), Q('Depth / Height', 'number'), Q('MOC', 'dropdown', false, MOC), ...DIFF],
    SH_TANK: [NAME, Q('Length', 'text'), Q('Breath', 'text'), Q('Height', 'text'), Q('Number of partition', 'number'), Q('Oil separator is present (T type structure)', 'radio', false, YN), Q('Type of skimmer', 'radio', false, ['Horizontal', 'Vertical']), Q('Belt size', 'text'), Q('Skimmer details (KW)', 'text'), Q('Skimmer details (Make)', 'text'), Q('Skimmer details (Model)', 'text'), Q('Skimmer details (RPM)', 'text')],
    DOS_TANK: [NAME, Q('Shape', 'text', true), Q('Dimension', 'text', true), Q('Volume', 'text', true), Q('Agitator', 'radio', true, YN), Q('MOC', 'text', true), Q('Drain valve', 'text', true, YN)],
    /* pumps and blowers */
    PMP: [NAME, Q('Type', 'dropdown', true, ['MonoBlock', 'High Pressure Vertical', 'High Pressure Horizontal', 'Screw Pump', 'Centrifugal Pump'], 'Centrifugal Pump'), Q('Maximum Head', 'text'), Q('Minimum Head', 'text'), Q('VFD', 'boolean', true, YN), Q('Installation Date', 'date'), ...PUMP_MOTOR, Q('Motor Rating', 'text'), REMOTE],
    D_PMP: [NAME, Q('Maximum Head', 'text'), Q('Minimum Head', 'text'), Q('Minimum Head (duplicate)', 'text'), Q('VFD', 'text'), Q('Installation Date', 'date'), Q('Manufacturing Date', 'date'), ...PUMP_MOTOR, REMOTE, Q('Motor Rating', 'text')],
    SUB_PMP: [NAME, Q('Type', 'dropdown', true, ['Cutter Type', 'Non-Cutter Type'], 'Cutter Type'), Q('Maximum Head', 'text'), Q('Motor Model', 'text'), Q('Motor Make', 'text'), Q('Motor Rating', 'text'), Q('Motor Company', 'text'), Q('VFD', 'dropdown', false, YN), Q('Minimum Head', 'text'), Q('Manufacturing Date', 'text'), Q('Installation Date', 'text'), REMOTE],
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
    MBBR: [NAME, Q('Media quantity present', 'text', true), Q('Fill fraction', 'text', true), Q('Length', 'text', true), Q('Breath', 'text', true), Q('Height', 'text', true), Q('Media surface area', 'text', true), Q('Effective surface area', 'text', true), Q('BOD loading rate', 'text', true), Q('Air line present in riser', 'radio', true, YN), Q('Size of cut is riser', 'text', true), Q('Type of diffusers', 'text', true)],
    MBR: [NAME, Q('Make', 'text', true), Q('Model', 'text', true), Q('Number of cassettes', 'text', true), Q('Number of modules', 'text', true), Q('Surface area of each membrane', 'text', true), Q('Design flux', 'text', true), Q('Design TMP', 'text', true), Q('Design MLSS', 'text', true), Q('Dimensions (lbh)', 'text', true), Q('Module size', 'text', true), Q('Type of diffusers', 'text', true)],
    T_SETTLER: [NAME, Q('Length', 'text', true), Q('Breath', 'text', true), Q('Height', 'text', true), Q('Sedimentation velocity', 'text', true), Q('Volume', 'text', true), Q('Inclination angle', 'text', true), Q('Surface loading rate', 'text', true)],
    UF_MEM: [NAME, Q('Make', 'text'), Q('Model', 'text'), Q('Dead end or cross flow type', 'dropdown', false, ['Dead end', 'cross flow']), Q('Number of membranes', 'text'), Q('Type of membrane', 'text', false, ['Hollow Fibre', 'Spiral', 'Ceramic']), Q('Backwash cycle (in minutes)', 'text')],
    /* sensor widgets: the widget is bound to one of the plant's sensors */
    LEVEL_SENSOR: WIDGET, 'chart.knob': WIDGET, SWITCH_SENSOR: WIDGET, NUMBER_SENSOR: WIDGET, TABLE_WIDGET: WIDGET,
    /* pipes, summarised: every kind asks a name, its two ends (a machine level or an HN / HM point) and a colour */
    'PIPE_*': [NAME, Q('Source Equipment or point', 'autocomplete', true), Q('Target Equipment or point', 'autocomplete', true), Q('Source Level (0-100)', 'text', true, null, '0'), Q('Target Level (0-100)', 'text', true, null, '0'), Q('Pipe Color', 'autocomplete', true, null, 'Blue')],
  };
})();
/* Node types that ask only for a Name. */
window.SCADA_FORM_NAME_ONLY = ['GAUGE_SENSOR', 'JOINS', 'MOTOR', 'ASSET_EQUIPMENT', 'FLASH_MIXER', 'FLOCCULATION', 'GRIT_CHAMBER', 'UV', 'ROTARY_DRUM', 'SIREN', 'PLANT_EQUIPMENT', 'LABEL_WIDGET', 'DAF', 'SBR_TANK', 'BUILDING', 'CASCADE_AREATOR', 'COOLING_TOWER', 'BIG_SABRE', 'MINI_SABRE', 'CAVITATOR', 'BT_PMP', 'M_BLW', 'HYDROCYCLONE', 'GAS_TONNER', 'OVERHEAD_T', 'AIR_COMPRESSURE', 'STATIC_MIXER', 'VTG_CHAMBER', 'CARTRIDGE_FILTER', 'GRIT_CLASSIFIER', 'RO', 'MECHANICAL_SCREEN', 'CASS_BASIN', 'GROUP', 'QUADSON_EVAPORATOR', 'ANAEROBIC_TANK', 'BIO_HEALTH_TRACKER'];
/* Display names for node types the palette response does not carry. The question-file-only codes have none in the database,
   so they are shown by code. */
window.SCADA_FORM_NAMES = { LEVEL_SENSOR: 'Level Sensor', 'chart.knob': 'Gauge', SWITCH_SENSOR: 'Switch', NUMBER_SENSOR: 'Number Widget', TABLE_WIDGET: 'Table Widget', LABEL_WIDGET: 'Label Widget', 'PIPE_*': 'Pipes (every kind)', ASSET_EQUIPMENT: 'Saved template' };
window.DB_QUESTION_ONLY.forEach((c) => { window.SCADA_FORM_NAMES[c] = 'no display name in the database (question file only)'; });

/* ── 5. What the library reads from the form (FORM_RULES) ─────────────────────────────────
   One list per database equipment code; each rule reads one question (q) and says what it is to the library (reads):
   · 'expects'  a reading the type now expects (sensor) with an alert that waits for it; flags the machine (field)
   · 'limits'   limits for an on-equipment reading (sensorKind): the answer converts (derive: 'fla' kW → full-load amps, or a
                plain number), is kept on the machine (key, raw), and the limits are factors of it (factors, per direction)
   · 'schedule' a schedule added to the type's set (schedule; everyBy / partsBy tune it by other answers), or one of the
                set's own schedules adjusted (adjust: set, partsNote, or doWhen / doneWhen as factors of the answer)
   · 'flag'     a fact kept on the machine (field): a Yes/No (on) or the answer itself
   · 'derived'  a number kept on the machine (key); derive 'volume' reads Shape and the dimensions
   says: the short line the Library page shows. when: the answer that fires the rule (a string, 'Yes', or a regex).
   A form answer never changes a type. Answers that set something on a connection (Maximum Head, OBR, Design TMP, auto
   valves on the pressure backwash) are kept in the type's nextPhase.work. */
window.FORM_RULES = (function () {
  const R_VOL = { q: 'Shape', reads: 'derived', derive: 'volume', key: 'volume', uses: ['Radius', 'Width', 'Length', 'Depth / Height', 'Height', 'Breath'], says: 'Shape and size → volume' };
  const R_REMOTE = { q: 'Add remote control functionality?', reads: 'flag', field: 'remote', on: true, says: 'Remote control → chip' };
  const R_OVERFLOW = { q: 'Is Over Flow Process', reads: 'flag', field: 'overflow', on: true, says: 'Overflow → chip' };
  const R_PUMPTYPE = { q: 'Type', reads: 'flag', field: 'pumpType', says: 'Type → noted on the pump' };
  /* a stopped pump reads 0% speed, so the speed alert watches only while the pump runs */
  const R_VFD = { q: 'VFD', reads: 'expects', when: 'Yes', sensor: 'Speed', field: 'vfd', alert: { name: 'Running below minimum speed', sensorKind: 'Speed', direction: 'below', limits: { caution: 30, minor: 20 }, gate: 'Run status' }, says: 'VFD → expects a speed reading, alerted while it runs' };
  const R_KW = (q) => ({ q, reads: 'limits', derive: 'fla', key: 'fla', raw: 'kw', sensorKind: 'Motor current', direction: 'above', factors: { caution: 1, minor: 1.05, major: 1.15 }, why: '{v} kW motor', says: 'Motor rating → current limits' });
  const R_DIFF = (q) => ({ q, reads: 'schedule', schedule: { name: 'Diffuser cleaning', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' }, hours: 4, parts: 'diffuser membranes if torn', flow: 'f_diffuser_clean', cause: 'c_diffuser' }, everyBy: [[/ceramic|plastic/i, { n: 12, unit: 'month' }]], partsBy: [['Installation & Layout', /retrievable/i, 'retrievable: no need to drain']], says: 'Diffuser material → cleaning cadence' });
  const POLY = { name: 'Poly tank refill', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' }, hours: 0.5, parts: 'polymer 25 kg', flow: 'f_poly_refill', cause: 'c_poly_dose' };
  const R_AUTO = (name, note) => ({ q: 'Auto valves', reads: 'schedule', when: 'Yes', adjust: name, set: { performedBy: 'auto', note }, says: 'Auto valves → confirm, not do' });
  const VOL_ONLY = [{ q: 'Volume', reads: 'derived', derive: 'number', key: 'volume', says: 'Volume → kept' }];
  const TANK = [R_VOL];
  const OS = [R_VOL, R_OVERFLOW];
  return {
    TANK, TANK_2: TANK, OP_TANK: TANK, CP_TANK: TANK, CLARIFIER: [R_VOL],
    OS_TANK_SC: OS, OS_TANK_SP: OS,
    /* a Diffuser Tank's form has no diffuser questions today; the rule reads them when SCADA adds them (the Manesar sample carries them) */
    OS_TANK_DF: [...OS, R_DIFF('MOC (diffuser material)')], OS_TANK: [...OS, R_DIFF('MOC (diffuser material)')],
    OS_TANK_AG: [R_REMOTE],
    SH_TANK: [{ ...R_VOL, q: 'Length' }],
    DOS_TANK: VOL_ONLY, T_SETTLER: VOL_ONLY,
    /* the pump's Type is noted, never a split; a screw pump has a stator to check, a cutter pump a cutter */
    PMP: [R_PUMPTYPE, { q: 'Type', reads: 'schedule', when: /screw/i, schedule: { name: 'Stator and rotor check', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' }, hours: 3, parts: 'stator if swollen', flow: 'f_pc_pump_pm', cause: 'c_stator' }, says: 'Type Screw Pump → stator and rotor check' }, R_VFD, R_KW('Motor Rating'), R_REMOTE],
    SUB_PMP: [R_PUMPTYPE, { q: 'Type', reads: 'schedule', when: /^cutter/i, schedule: { name: 'Cutter and impeller check', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' }, hours: 2, parts: 'cutter ring if worn', flow: 'f_pump_lift', cause: 'c_cutter_worn' }, says: 'Type → cutter check when it is a cutter pump' }, R_VFD, R_KW('Motor Rating'), R_REMOTE],
    /* a dosing pump has no current reading to size, so its Motor Rating is not read */
    D_PMP: [R_VFD, R_REMOTE],
    /* the intake filter job starts at 95% of full load and is done below 85% (1.82 A per kW is full load), below the current alert */
    BLW: [R_KW('Motor Rating(KW)'), { q: 'Motor Rating(KW)', reads: 'schedule', adjust: 'Clean intake filter', doWhen: 1.73, doneWhen: 1.55, says: 'Motor rating → intake filter job at 95% and 85% of full load' }, { q: 'RPM', reads: 'derived', derive: 'number', key: 'rpm', says: 'RPM → kept' }, R_REMOTE],
    VALVE_2: [{ q: 'Type of Valve', reads: 'flag', field: 'valveType', says: 'Type of valve → noted on the valve' }, R_REMOTE],
    VALVE_3: [{ q: 'Type', reads: 'flag', field: 'valveType', says: 'Type → noted on the valve' }, R_REMOTE],
    SC_PRESS: [R_KW('KW rating'), { q: 'Cleaning in auto mode', reads: 'schedule', when: 'Yes', adjust: 'Screw and screen service', set: { performedBy: 'auto', note: 'confirm the auto wash' }, says: 'Auto cleaning → confirm the wash, not do it' }, { q: 'Poly dosing system', reads: 'schedule', when: 'Yes', schedule: POLY, says: 'Poly dosing → weekly poly refill' }],
    F_PRESS: [{ q: 'Poly dosing', reads: 'schedule', when: 'Yes', schedule: POLY, says: 'Poly dosing → weekly poly refill' }, { q: 'Number of plates', reads: 'derived', derive: 'number', key: 'plates', adjust: 'Hydraulic and cloth inspection', partsNote: '{v} plates', says: 'Number of plates → parts note' }],
    /* the weekly backwash: with auto valves the filter backwashes itself, so the task is to confirm it ran */
    ACF_MGF: [R_AUTO('Weekly backwash', 'valves sequence themselves; the task is to confirm')],
    UF_MEM: [{ q: 'Backwash cycle (in minutes)', reads: 'derived', derive: 'number', key: 'backwashMin', schedule: { name: 'Backwash cycle check', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'day' }, hours: 0.25 }, says: 'Backwash cycle → daily cycle check' }],
    MBR: [{ q: 'Design flux', reads: 'derived', derive: 'number', key: 'designFlux', says: 'Design flux → kept' }, R_DIFF('Type of diffusers')],
    MBBR: [{ q: 'Fill fraction', reads: 'derived', derive: 'number', key: 'fillFraction', says: 'Fill fraction → kept' }, { q: 'Media quantity present', reads: 'derived', derive: 'number', key: 'mediaQty', schedule: { name: 'Media loss check', workType: 'pm', basis: 'calendar', every: { n: 1, unit: 'month' }, hours: 1, flow: 'f_mbbr_media', cause: 'c_media_loss' }, says: 'Media quantity → monthly media loss check' }, R_DIFF('Type of diffusers')],
  };
})();

/* ── 6. Plant types: what a plant of this type inherits as a whole, and the equipment types such a plant usually has ── */
window.PLANT_PROFILES = {
  STP: { usualTypes: ['Mechanical Screen', 'Screen Chamber Tank', 'Oil & Grease Tank', 'Open Skeleton Tank', 'Submersible Pump', 'Pump', 'Blower', 'Diffuser Tank', 'MBBR', 'Tube settler', 'Clarifier Tank', 'ACF/MGF', 'Dosing Pump', 'Dosing Tank', 'UV', 'Screw Press'],
    rounds: [ { name: 'Daily logbook round', workType: 'routine', every: { n: 1, unit: 'day' }, flow: 'f_logbook' }, { name: 'Monthly compliance sample', workType: 'routine', every: { n: 1, unit: 'month' }, statutory: true, verify: true }, { name: 'Hooter function test', workType: 'routine', every: { n: 3, unit: 'month' }, verify: true }, { name: 'Weekly housekeeping round', workType: 'routine', every: { n: 1, unit: 'week' } } ],
    milestones: ['Zero overdue tasks this week', '90 days without an Emergency'] },
  ETP: { usualTypes: ['Screen Chamber Tank', 'Oil & Grease Tank', 'Open Skeleton Tank', 'Agitator', 'Dosing Pump', 'Dosing Tank', 'Flash Mixer', 'Flocculation', 'Anaerobic Tank', 'SBR', 'Blower', 'Tube settler', 'Submersible Pump', 'Pump', 'Filter Press'],
    rounds: [ { name: 'Daily logbook round', workType: 'routine', every: { n: 1, unit: 'day' }, flow: 'f_logbook' }, { name: 'Monthly compliance sample', workType: 'routine', every: { n: 1, unit: 'month' }, statutory: true, verify: true }, { name: 'Hooter function test', workType: 'routine', every: { n: 3, unit: 'month' }, verify: true } ],
    milestones: ['Zero overdue tasks this week'] },
  WTP: { usualTypes: ['Mechanical Screen', 'Submersible Pump', 'Pump', 'Flash Mixer', 'Flocculation', 'Clarifier Tank', 'ACF/MGF', 'Softner', 'UF Membrane', 'RO', 'Cartridge Filter', 'Dosing Pump', 'Dosing Tank', 'Gas Tonner', 'Overhead Tank'],
    rounds: [ { name: 'Daily logbook round', workType: 'routine', every: { n: 1, unit: 'day' }, flow: 'f_logbook_wtp' }, { name: 'Weekly bacteriological sample', workType: 'routine', every: { n: 1, unit: 'week' }, statutory: true, verify: true }, { name: 'Hooter function test', workType: 'routine', every: { n: 3, unit: 'month' }, verify: true } ],
    milestones: ['30 days of outlet within limits'] },
};

/* ── 7. Standard sets: what each equipment type inherits (alerts on its own readings, schedules by calendar or run hours,
   jobs on its own readings). Every v1 item that read a connection is in the type's nextPhase instead. Limits are v1's where the
   reading carried over; flows, causes, hours and parts are bound by name in flows.js. These replace data.js's list.
   ifDrawn: the alert is part of a machine only when SCADA drew its reading (not a gap when it did not). gate: the alert watches
   only while that status reading is on (a stopped machine reads 0). */
window.SEED.standardSets = (function () {
  const name = (code) => window.DB_BY_CODE[code].name;
  const SET = (code, usedAt, alerts, schedules) => ({ id: 't_' + code.toLowerCase(), type: name(code), usedAt, alerts, schedules });
  const AL = (n, sensorKind, direction, limits, extra) => ({ name: n, sensorKind, direction, limits, ...(extra || {}) });
  const IF_DRAWN = { ifDrawn: true }, WHILE_RUNNING = { gate: 'Run status' };
  const PM = (n, every, unit, meterHours) => ({ name: n, workType: 'pm', basis: meterHours ? 'either' : 'calendar', every: { n: every, unit }, ...(meterHours ? { meterHours } : {}) });
  const RT = (n, every, unit) => ({ name: n, workType: 'routine', basis: 'calendar', every: { n: every, unit } });
  const CAL = (n, every, unit) => ({ name: n, workType: 'calibration', basis: 'calendar', every: { n: every, unit } });
  const COND = (n, sensorKind, doWhen, doneWhen) => ({ name: n, workType: 'condition', sensorKind, doWhen, doneWhen });
  const LEVEL_HIGH = () => AL('Level high', 'Level', 'above', { caution: 85, major: 95 });
  const FLOOD = () => AL('Sump flooding', 'Sump flood switch', 'above', { emergency: 1 }, IF_DRAWN);
  const AER = () => [[AL('DO low', 'Dissolved oxygen', 'below', { minor: 2.0, major: 1.0, emergency: 0.5 }), AL('MLSS high', 'MLSS', 'above', { minor: 4500 }), AL('MLSS low', 'MLSS', 'below', { minor: 2000 }), AL('Temperature high', 'Temperature', 'above', { caution: 35, minor: 38 }, IF_DRAWN)], [RT('SV30 settling test', 1, 'day')]];
  const TANK = () => [[LEVEL_HIGH()], [PM('Tank cleaning', 6, 'month')]];
  const CURRENT = (limits) => AL('Motor current high', 'Motor current', 'above', limits);
  const SCREEN = () => [[AL('Screen drive tripped', 'Trip contact', 'above', { major: 1 })], [RT('Weekly screen inspection', 1, 'week')]];
  const DEVICE = () => [[], [RT('Device clean and check', 1, 'month')]];
  return [
    SET('TANK', 41, ...TANK()), SET('TANK_2', 41, ...TANK()), SET('OP_TANK', 41, ...TANK()), SET('CP_TANK', 41, ...TANK()), SET('OVERHEAD_T', 41, ...TANK()),
    SET('CLARIFIER', 18, [AL('Sludge blanket high', 'Sludge blanket', 'above', { minor: 1.2 })], [PM('Scraper drive service', 6, 'month')]),
    SET('OS_TANK', 24, [LEVEL_HIGH(), AL('pH high', 'pH', 'above', { minor: 8.5, major: 9.5 }, IF_DRAWN), AL('pH low', 'pH', 'below', { minor: 6.0, major: 5.5 }, IF_DRAWN), FLOOD()], [PM('Tank cleaning', 6, 'month')]),
    SET('OS_TANK_SP', 24, [LEVEL_HIGH(), FLOOD()], [PM('Tank cleaning', 6, 'month')]),
    SET('OS_TANK_SC', 33, [], [RT('Weekly screen inspection', 1, 'week')]),
    SET('OS_TANK_DF', 27, ...AER()), SET('SBR_TANK', 27, ...AER()), SET('CASS_BASIN', 27, ...AER()),
    SET('OS_TANK_AG', 25, [CURRENT({ minor: 24 })], [PM('Gearbox and bearing service', 6, 'month')]),
    SET('SH_TANK', 0, [LEVEL_HIGH()], [PM('Skimmer belt and scraper check', 1, 'month'), RT('Oil removal round', 1, 'week'), PM('Desludging', 3, 'month')]),
    SET('DOS_TANK', 33, [AL('Chemical tank low', 'Level', 'below', { caution: 25, minor: 10 })], [RT('Chemical refill', 1, 'week')]),
    SET('ANAEROBIC_TANK', 7, [AL('pH low', 'pH', 'below', { minor: 6.5, major: 6.0 })], [PM('Desludging', 6, 'month')]),
    /* Pump takes v1's centrifugal pump limits; the form's Motor Rating gives a pump its own */
    SET('PMP', 40, [CURRENT({ caution: 40, minor: 45 })], [PM('Bearing and seal service', 6, 'month', 4000)]),
    SET('SUB_PMP', 38, [CURRENT({ caution: 28, minor: 32 })], [PM('Bearing and seal service', 6, 'month', 4000)]),
    /* the chemical left is the Dosing Tank's level, alerted there */
    SET('D_PMP', 22, [], [PM('Dosing pump service', 3, 'month'), CAL('Calibration of dose rate', 3, 'month')]),
    SET('BT_PMP', 0, [CURRENT({ caution: 40, minor: 45 })], [PM('Bearing and seal service', 6, 'month', 4000)]),
    SET('BLW', 31, [CURRENT({ caution: 44, minor: 48 }), AL('Blower tripped', 'Trip contact', 'above', { emergency: 1 })], [PM('Bearing service', 6, 'month', 500), COND('Clean intake filter', 'Motor current', 42, 38)]),
    /* a mini blower's form carries no motor rating, so its current limit is left to the plant and the intake filter goes by the calendar */
    SET('M_BLW', 31, [AL('Blower tripped', 'Trip contact', 'above', { emergency: 1 })], [PM('Bearing service', 6, 'month', 500), PM('Clean intake filter', 1, 'month')]),
    SET('MOTOR', 0, [AL('Motor tripped', 'Trip contact', 'above', { major: 1 })], [PM('Motor insulation and bearing check', 6, 'month', 4000)]),
    SET('AIR_COMPRESSURE', 15, [], [PM('Compressor service', 6, 'month', 1000)]),
    SET('VALVE_2', 0, [], [PM('Valve stroke check', 3, 'month')]), SET('VALVE_3', 0, [], [PM('Valve stroke check', 3, 'month')]),
    SET('SC_PRESS', 11, [CURRENT({ minor: 30 })], [PM('Screw and screen service', 6, 'month', 500)]),
    SET('F_PRESS', 8, [], [PM('Hydraulic and cloth inspection', 6, 'month', 400)]),
    SET('SOFTNER', 20, [], [RT('Brine tank salt top-up', 1, 'week')]),
    SET('ACF_MGF', 19, [], [RT('Weekly backwash', 1, 'week')]),
    SET('OZONATOR', 4, [AL('Ozonator tripped', 'Trip contact', 'above', { major: 1 })], [PM('Generator service', 6, 'month')]),
    SET('MBBR', 14, [AL('DO low', 'Dissolved oxygen', 'below', { minor: 2.0, major: 1.0 })], [PM('Media and diffuser inspection', 6, 'month')]),
    SET('MBR', 9, [], [PM('Quarterly CIP', 3, 'month')]),
    SET('T_SETTLER', 12, [AL('Sludge blanket high', 'Sludge blanket', 'above', { minor: 1.0 })], [PM('Tube module cleaning', 3, 'month')]),
    SET('UF_MEM', 11, [], [PM('Quarterly CIP', 3, 'month')]),
    SET('RO', 16, [], [PM('Membrane CIP', 3, 'month')]),
    SET('UV', 9, [AL('UV lamp fault', 'Lamp fault', 'above', { major: 1 }), AL('UV intensity low', 'UV intensity', 'below', { minor: 70, major: 60 }, WHILE_RUNNING)], [PM('Lamp and sleeve replacement', 12, 'month')]),
    SET('DAF', 5, [CURRENT({ minor: 30 })], [PM('Saturator and scraper service', 6, 'month')]),
    SET('FLASH_MIXER', 25, [CURRENT({ minor: 24 })], [PM('Gearbox and bearing service', 6, 'month')]),
    SET('FLOCCULATION', 0, [CURRENT({ minor: 24 })], [PM('Gearbox and paddle check', 6, 'month')]),
    SET('STATIC_MIXER', 0, [], [PM('Element inspection', 6, 'month')]),
    SET('ROTARY_DRUM', 33, ...SCREEN()), SET('MECHANICAL_SCREEN', 33, ...SCREEN()),
    SET('GRIT_CHAMBER', 22, [], [RT('Grit removal', 1, 'week')]),
    SET('GRIT_CLASSIFIER', 0, [], [PM('Classifier screw and gearbox check', 3, 'month')]),
    SET('CARTRIDGE_FILTER', 18, [], [PM('Cartridge replacement', 1, 'month')]),
    SET('CASCADE_AREATOR', 0, [], [PM('Steps cleaning', 1, 'month')]),
    SET('COOLING_TOWER', 6, [], [PM('Fill and fan service', 6, 'month')]),
    SET('HYDROCYCLONE', 0, [], [PM('Cyclone apex and liner check', 3, 'month')]),
    SET('CAVITATOR', 0, [AL('Cavitator tripped', 'Trip contact', 'above', { major: 1 })], [PM('Cavitator service', 6, 'month')]),
    /* a full tonner holds about 900 kg of chlorine */
    SET('GAS_TONNER', 6, [AL('Tonner nearly empty', 'Tonner net weight', 'below', { caution: 150, minor: 90 }), AL('Chlorine leak', 'Chlorine leak', 'above', { emergency: 1 })], [RT('Tonner change', 2, 'week')]),
    SET('VTG_CHAMBER', 0, [], [PM('Chamber cleaning', 6, 'month')]),
    SET('BIG_SABRE', 0, ...DEVICE()), SET('MINI_SABRE', 0, ...DEVICE()), SET('BIO_HEALTH_TRACKER', 0, ...DEVICE()),
    SET('QUADSON_EVAPORATOR', 0, [], [PM('Evaporator descaling and inspection', 3, 'month')]),
  ];
})();

/* ── 8. Sample SCADA models: what the SCADA view hands over, in its own vocabulary ──────────
   equipment: the nodes drawn from the database's equipment types (valves and devices included). code is the palette code it
   was drawn with; equipmentType, when present, is the type stored on the node (it wins). sensors are the widgets bound to it,
   form is what was typed into its SCADA form (question → answer; only the answered questions). elements: drawn things that
   are not equipment (the plant label, inlet and outlet points, joints). links are the pipes, machine to machine. */
window.SCADA_SAMPLES = {
  bawal: { name: 'Bawal WTP', type: 'WTP', capacity: '1.2 MLD', drawn: '2026-10-03', site: 'Bawal',
    equipment: [
      { id: 'sc_bs1', tag: 'BS-1', label: 'Mechanical Screen', code: 'MECHANICAL_SCREEN', sensors: [{ tag: 'DH', widget: 'NUMBER_SENSOR', reading: 35 }] },
      { id: 'sc_p1', tag: 'RW-1', label: 'Raw water pump 1', code: 'SUB_PMP', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 15 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 2200 }], form: { 'Type': 'Non-Cutter Type', 'VFD': 'No', 'Motor Rating': '5.5', 'Add remote control functionality?': 'Yes' } },
      { id: 'sc_p2', tag: 'RW-2', label: 'Raw water pump 2', code: 'SUB_PMP', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 900 }], form: { 'Type': 'Non-Cutter Type', 'VFD': 'No', 'Motor Rating': '5.5' } },
      { id: 'sc_v1', tag: 'V-1', label: 'Two way Valve', code: 'VALVE_2', sensors: [], form: { 'Size': '100 mm', 'Type of Valve': 'Motorised', 'Add remote control functionality?': 'Yes' } },
      { id: 'sc_mgf1', tag: 'MGF-1', label: 'ACF/MGF', code: 'ACF_MGF', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.7 }], form: { 'Diameter': '1.6', 'Height': '2.2', 'Auto valves': 'Yes' } },
      { id: 'sc_sf1', tag: 'SF-1', label: 'Softner', code: 'SOFTNER', sensors: [{ tag: 'THR', widget: 'NUMBER_SENSOR', reading: 4200 }], form: { 'Dia': '1.2', 'Height': '2.4', 'Design flow rate': '25', 'OBR': '12000', 'Auto valves': 'Yes' } },
      { id: 'sc_uf1', tag: 'UF-1', label: 'UF Membrane', code: 'UF_MEM', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 82 }, { tag: 'PIN', widget: 'chart.knob', reading: 1.9 }], form: { 'Type of membrane': 'Hollow Fibre', 'Backwash cycle (in minutes)': '30' } },
      { id: 'sc_sabre', tag: 'SABRE-1', label: 'Sabre', code: 'BIG_SABRE', sensors: [] },
      { id: 'sc_dp1', tag: 'DP-1', label: 'Hypo dosing pump', code: 'D_PMP', sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.6 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 400 }], form: { 'Motor Rating': '0.37' } },
      { id: 'sc_dt1', tag: 'DT-1', label: 'Hypo dosing tank', code: 'DOS_TANK', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 70 }], form: { 'Shape': 'Cylindrical', 'Volume': '500', 'Agitator': 'No' } },
      { id: 'sc_cav', tag: 'CV-1', label: 'Cavitator', code: 'CAVITATOR', sensors: [{ tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }] } ],
    elements: [],
    links: [['sc_bs1', 'sc_p1'], ['sc_bs1', 'sc_p2'], ['sc_p1', 'sc_v1'], ['sc_p2', 'sc_v1'], ['sc_v1', 'sc_mgf1'], ['sc_mgf1', 'sc_sf1'], ['sc_sf1', 'sc_uf1'], ['sc_uf1', 'sc_cav'], ['sc_cav', 'sc_dt1'], ['sc_dp1', 'sc_dt1']] },
  /* Manesar is the sample plant in data.js; its SCADA model uses the same ids so the two agree. Its forms reach the
     plant's machines when the library first looks at them (a plant seeded without forms reads the model's). */
  manesar: { name: 'Manesar STP', type: 'STP', capacity: '2.5 MLD', drawn: '2026-09-12', site: 'Manesar',
    equipment: [
      { id: 'bs1', tag: 'BS-1', label: 'Mechanical Screen', code: 'MECHANICAL_SCREEN', sensors: [{ tag: 'DH', widget: 'NUMBER_SENSOR', reading: 40 }] },
      { id: 'eq1', tag: 'EQ-1', label: 'Equalization tank', code: 'OS_TANK', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 61 }, { tag: 'FLOOD', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'PH', widget: 'NUMBER_SENSOR', reading: 7.4 }], form: { 'Is Over Flow Process': 'Yes', 'Shape': 'Cuboid', 'Length': '10', 'Width': '8', 'Depth / Height': '4' } },
      { id: 'at1', tag: 'AT-1', label: 'Aeration tank 1', code: 'OS_TANK_DF', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 2.3 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 2650 }], form: { 'Shape': 'Cuboid', 'Length': '12', 'Width': '6', 'Depth / Height': '4.5', 'Diffusers Type': 'Disc Diffusers', 'MOC (diffuser material)': 'Membrane Diffusers', 'Installation & Layout': 'Retrievable System' } },
      { id: 'at2', tag: 'AT-2', label: 'Aeration tank 2', code: 'OS_TANK_DF', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 1.8 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 3400 }, { tag: 'TEMP', widget: 'NUMBER_SENSOR', reading: 29.4 }], form: { 'Shape': 'Cuboid', 'Length': '12', 'Width': '6', 'Depth / Height': '4.5', 'Diffusers Type': 'Disc Diffusers', 'MOC (diffuser material)': 'Membrane Diffusers', 'Installation & Layout': 'Retrievable System' } },
      { id: 'bl1', tag: 'BL-1', label: 'Blower 1', code: 'BLW', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.58 }, { tag: 'AMP', widget: 'chart.knob', reading: 38.2 }, { tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 18240 }], form: { 'Motor Rating(KW)': '22', 'RPM': '2900' } },
      { id: 'bl2', tag: 'BL-2', label: 'Blower 2', code: 'BLW', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 4120 }], form: { 'Motor Rating(KW)': '22', 'RPM': '2900' } },
      { id: 'cl1', tag: 'SC-1', label: 'Clarifier Tank', code: 'CLARIFIER', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.7 }] },
      { id: 'mbr1', tag: 'MBR-1', label: 'MBR', code: 'MBR', sensors: [{ tag: 'PERM', widget: 'NUMBER_SENSOR', reading: 112 }, { tag: 'TURB', widget: 'NUMBER_SENSOR', reading: 0.6 }], form: { 'Design flux': '20', 'Design TMP': '0.5', 'Type of diffusers': 'Membrane' } },
      { id: 'mgf1', tag: 'MGF-1', label: 'ACF/MGF', code: 'ACF_MGF', sensors: [{ tag: 'DP', widget: 'NUMBER_SENSOR', reading: 0.9 }] },
      { id: 'uf1', tag: 'UF-1', label: 'UF Membrane', code: 'UF_MEM', sensors: [{ tag: 'REC', widget: 'NUMBER_SENSOR', reading: 78 }, { tag: 'PIN', widget: 'chart.knob', reading: 2.1 }] },
      { id: 'cdu', tag: 'CDU-1', label: 'Hypo dosing pump', code: 'D_PMP', sensors: [{ tag: 'FRC', widget: 'NUMBER_SENSOR', reading: 0.5 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 1200 }] },
      { id: 'sp1', tag: 'SP-1', label: 'Sludge pump', code: 'PMP', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 310 }], form: { 'Type': 'Screw Pump', 'VFD': 'No' } } ],
    elements: [],
    links: [['bs1', 'eq1'], ['eq1', 'at1'], ['eq1', 'at2'], ['bl1', 'at1'], ['bl1', 'at2'], ['bl2', 'at1'], ['bl2', 'at2'], ['at1', 'cl1'], ['at2', 'cl1'], ['cl1', 'mbr1'], ['mbr1', 'mgf1'], ['mgf1', 'uf1'], ['uf1', 'cdu'], ['cl1', 'sp1']] },
};
/* Vedanta ETP: an effluent plant with a collection sump, neutralisation, an anaerobic tank, an SBR, a tube settler and a
   filter press. Connected and detected; nothing inherited yet. */
window.SCADA_SAMPLES.vedanta = { name: 'Vedanta ETP', type: 'ETP', capacity: '200 KLD', drawn: '2026-10-01', site: 'Vedanta',
  equipment: [
    { id: 'v_p1', tag: 'P-1', label: 'Sump pump 1', code: 'SUB_PMP', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 11 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 3100 }], form: { 'Type': 'Cutter Type', 'Motor Rating': '3.7' } },
    { id: 'v_p2', tag: 'P-2', label: 'Sump pump 2', code: 'SUB_PMP', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 1200 }], form: { 'Type': 'Cutter Type', 'Motor Rating': '3.7' } },
    { id: 'v_eq1', tag: 'EQ-1', label: 'Equalisation tank', code: 'OS_TANK', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 48 }, { tag: 'PH', widget: 'NUMBER_SENSOR', reading: 6.1 }] },
    { id: 'v_mx1', tag: 'MX-1', label: 'Agitator', code: 'OS_TANK_AG', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 5 }], form: { 'Add remote control functionality?': 'Yes' } },
    { id: 'v_dt1', tag: 'DT-1', label: 'Lime dosing tank', code: 'DOS_TANK', sensors: [{ tag: 'LVL', widget: 'LEVEL_SENSOR', reading: 35 }] },
    { id: 'v_an1', tag: 'AN-1', label: 'Anaerobic tank', code: 'ANAEROBIC_TANK', sensors: [{ tag: 'PH', widget: 'NUMBER_SENSOR', reading: 6.9 }, { tag: 'TEMP', widget: 'NUMBER_SENSOR', reading: 33 }] },
    { id: 'v_sbr', tag: 'SBR-1', label: 'SBR', code: 'SBR_TANK', sensors: [{ tag: 'DO', widget: 'NUMBER_SENSOR', reading: 1.6 }, { tag: 'MLSS', widget: 'NUMBER_SENSOR', reading: 3800 }] },
    { id: 'v_bl1', tag: 'BL-1', label: 'Blower 1', code: 'BLW', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.52 }, { tag: 'AMP', widget: 'chart.knob', reading: 29 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 9800 }], form: { 'Motor Rating(KW)': '11' } },
    { id: 'v_bl2', tag: 'BL-2', label: 'Blower 2', code: 'BLW', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 2400 }], form: { 'Motor Rating(KW)': '11' } },
    { id: 'v_ts1', tag: 'TS-1', label: 'Tube settler', code: 'T_SETTLER', sensors: [{ tag: 'BLK', widget: 'NUMBER_SENSOR', reading: 0.9 }] },
    { id: 'v_fp1', tag: 'FP-1', label: 'Filter press', code: 'F_PRESS', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 410 }], form: { 'Design flow rate': '2 m³/h', 'Plate size': '800 mm', 'Number of plates': '24', 'Poly dosing': 'Yes', 'Air line provision': 'No' } },
    { id: 'v_sp1', tag: 'SP-1', label: 'Sludge pump', code: 'PMP', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 520 }], form: { 'Type': 'Screw Pump', 'VFD': 'No' } },
    { id: 'v_v1', tag: 'V-7', label: 'Three way Valve', code: 'VALVE_3', sensors: [], form: { 'Type': 'Manual' } } ],
  elements: [],
  links: [['v_p1', 'v_eq1'], ['v_p2', 'v_eq1'], ['v_dt1', 'v_v1'], ['v_v1', 'v_eq1'], ['v_eq1', 'v_an1'], ['v_an1', 'v_sbr'], ['v_bl1', 'v_sbr'], ['v_bl2', 'v_sbr'], ['v_sbr', 'v_ts1'], ['v_ts1', 'v_sp1'], ['v_sp1', 'v_fp1']] };
/* What SCADA hands over later, when an engineer draws something new: a third blower on the
   Manesar aeration header, a third raw-water pump at Bawal, a second filter press at Vedanta. */
window.SCADA_DELTAS = {
  vedanta: { what: 'FP-2, a second filter press', equipment: [{ id: 'v_fp2', tag: 'FP-2', label: 'Filter press 2', code: 'F_PRESS', sensors: [{ tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }], form: { 'Number of plates': '24', 'Poly dosing': 'Yes' } }], links: [['v_sp1', 'v_fp2']] },
  manesar: { what: 'BL-3, a third blower on the aeration header', equipment: [{ id: 'bl3', tag: 'BL-3', label: 'Blower 3', code: 'BLW', sensors: [{ tag: 'PRESS', widget: 'chart.knob', reading: 0.57 }, { tag: 'AMP', widget: 'chart.knob', reading: 36 }, { tag: 'TRIP', widget: 'SWITCH_SENSOR', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 12 }], form: { 'Motor Rating(KW)': '22', 'RPM': '2900' } }], links: [['bl3', 'at1'], ['bl3', 'at2']] },
  bawal: { what: 'RW-3, a third raw-water pump', equipment: [{ id: 'sc_p3', tag: 'RW-3', label: 'Raw water pump 3', code: 'SUB_PMP', sensors: [{ tag: 'AMP', widget: 'chart.knob', reading: 0 }, { tag: 'HRS', widget: 'NUMBER_SENSOR', reading: 0 }], form: { 'Type': 'Non-Cutter Type', 'VFD': 'Yes', 'Motor Rating': '5.5' } }], links: [['sc_bs1', 'sc_p3'], ['sc_p3', 'sc_v1']] },
};

/* ── 9. A real SCADA layout → the model above ───────────────────────────────────────────────
   A layout is the drawing itself (assets/layout-*.js): cells for equipment, joints, inlet and outlet points and sensor
   widgets, and two kinds of link. A Pipe carries flow from its source to its target; a dashed standard.Link binds a sensor
   widget to the equipment it reads. Every cell drawn from a database equipment type is an equipment node (valves too), with
   the type stored on it (equipmentType) when there is one. Pipes are followed through joints to find which equipment feeds
   which. What a real layout does not carry, the console fills in, and the Connect step says so:
   · tags: the drawing has none, so a machine's tag comes from its label (Reactor Feed Pump - 1 → RFP-1);
   · widget codes: an ON/OFF widget is the machine's run status (RUN), a Level widget its level (LVL);
   · forms: the layout export carries no form answers, so LAYOUT_FORMS stands in for a few machines. */
window.LAYOUT_WIDGET_CODES = { SWITCH_SENSOR: 'RUN', LEVEL_SENSOR: 'LVL' };
/* A STAND-IN: the layout export carries no form answers, so these are attached by label (or tag) until the equipment records
   are exported with the drawing. They give two filter-feed pumps and a UF feed pump their motor answers, and both EQT tanks
   their size and diffusers. A form answer never changes a type. */
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
  /* the palette says what a cell is; a code the database does not know is still equipment (shown as not in the database) */
  const kindOf = (c) => { const p = window.DB_BY_CODE[c.type]; return p ? p.kind : 'equipment'; };
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
  const equipment = els.filter((c) => kindOf(c) === 'equipment').map((c) => ({ id: c.equipmentId, cell: c.id, tag: tagFor(text(c)), label: text(c), code: c.type, ...(c.equipmentType ? { equipmentType: c.equipmentType } : {}), sensors: [] }));
  equipment.forEach((e) => { const f = (window.LAYOUT_FORMS || {})[e.label] || (window.LAYOUT_FORMS || {})[e.tag]; if (f) e.form = JSON.parse(JSON.stringify(f)); });
  const eqByCell = {}; equipment.forEach((e) => { eqByCell[e.cell] = e; });
  /* a dashed link joins a widget and the equipment it reads, drawn either way round */
  cells.filter((c) => c.type === 'standard.Link').forEach((l) => { const a = byCell[l.source && l.source.id], b = byCell[l.target && l.target.id]; const w = a && kindOf(a) === 'widget' ? a : b && kindOf(b) === 'widget' ? b : null; const e = w === a ? eqByCell[b && b.id] : eqByCell[a && a.id]; if (!w || !e) return; const num = (e.label.match(/(\d+)$/) || [])[1]; e.sensors.push({ tag: window.LAYOUT_WIDGET_CODES[w.type] || w.type, widget: w.type, reading: w.type === 'LEVEL_SENSOR' ? (w.level ?? 0) : (num && +num % 2 === 0 ? 0 : 1) }); });
  const elements = els.filter((c) => kindOf(c) === 'drawing').map((c) => ({ id: c.equipmentId || c.id, cell: c.id, code: c.type, label: text(c) }));
  /* pipes, machine to machine: a pipe that reaches a joint carries on through it; anything else ends it */
  const out = {}; cells.filter((c) => c.type === 'Pipe').forEach((p) => { const s = p.source && p.source.id, t = p.target && p.target.id; if (s && t) (out[s] = out[s] || []).push(t); });
  const links = [], seen = new Set();
  equipment.forEach((m) => { const stack = [...(out[m.cell] || [])], vis = new Set([m.cell]); while (stack.length) { const id = stack.pop(); if (vis.has(id)) continue; vis.add(id); const c = byCell[id]; if (!c) continue; if (eqByCell[id]) { const k = `${m.id}>${eqByCell[id].id}`; if (!seen.has(k) && eqByCell[id].id !== m.id) { seen.add(k); links.push([m.id, eqByCell[id].id]); } } else if (c.type === 'JOINS') stack.push(...(out[id] || [])); } });
  const plantCell = els.find((c) => c.type === 'PLANT_EQUIPMENT'); const site = plantCell ? text(plantCell) : null;
  return { name: meta.name, type: meta.type, capacity: meta.capacity || '', drawn: String(doc.updatedAt || '').slice(0, 10), site, equipment, elements, links,
    fromLayout: { version: doc.version, cells: cells.length, site, boundaries: els.filter((c) => c.type === 'ZONE').map((c) => text(c)), widgets: els.filter((c) => kindOf(c) === 'widget').length } };
};
/* DigitalPaani: the real export of an MBBR sewage plant with tertiary filtration, UF and water reuse. */
if (window.SCADA_LAYOUTS && window.SCADA_LAYOUTS.digitalpaani) window.SCADA_SAMPLES.digitalpaani = window.scadaFromLayout(window.SCADA_LAYOUTS.digitalpaani, { name: 'DigitalPaani', type: 'STP' });
