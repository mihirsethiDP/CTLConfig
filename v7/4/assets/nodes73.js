/* v7/3 · nodes73.js — the node taxonomy, read into the library.
   Two libraries:
     · Equipment      — a machine or a tank on its own: the database's equipment types, plus the types the taxonomy adds
                        (Mixer, Surface aerator, and a tank or machine type for every unit-process node that had none).
     · Unit processes — one treatment step: 53 types, each keyed by its stored value (treated_water, mbbr, …) and carrying
                        its own readings, alerts and tasks.
   Some nodes are both. A treated water tank is a tank (equipment) and the body of the Treated water step (unit process).
   The rule that picks the library for such a node:
     · other equipment takes part in it (pumps, blowers, dosing, valves)  → the unit-process library
     · it stands on its own                                              → the equipment library, for that tank or machine
   An equipment node is never a unit process: a pump stays a pump.
   Exposes window.V7NODES { EQ, UP, GROUPS, readCode, atomic, plan, apply, about, upByKey, eqTypeOf }.
   Extends, at load: DB_PALETTE / DB_BY_CODE, CATALOGUE(+_BY_CODE,_BY_TYPE), SEED.standardSets, the flows, root causes, issues
   and tasks that name a base type, V7_UP_TYPES, V7_STAGES, every plant's structure, and window.detectDbType. */
(function () {
  'use strict';
  const W = window; if (!W.CATALOGUE || !W.DB_PALETTE || !W.SEED) return;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const R = W.READINGS;

  /* ── 1. Sub-type axes: (key, label, required, several, [[code, stored value, label, existing codes that set it]…]) ── */
  const AX = (key, label, required, many, values, note) => ({ key, label, required: !!required, many: !!many, ...(note ? { note } : {}), values: values.map(([code, stored, name, existing]) => ({ code, stored, name, existing: existing || [] })) });
  const SERVICE = [['INFL', 'influent', 'Influent'], ['TRANSFER', 'transfer', 'Transfer'], ['FEED', 'feed', 'Feed'], ['BOOST', 'booster', 'Booster', ['BT_PMP']], ['PERM', 'permeate', 'Permeate'],
    ['RAS', 'return_sludge', 'Return sludge'], ['RECIRC', 'recirculation', 'Recirculation'], ['MLR', 'internal_recirculation', 'Internal recirculation'], ['WAS', 'wasting', 'Wasting'], ['DECANT', 'decanting', 'Decanting'],
    ['SCUM', 'scum', 'Scum'], ['DRAIN', 'drain', 'Drain'], ['BYPASS', 'bypass', 'Bypass'], ['DOSING', 'dosing', 'Dosing'], ['BACKWASH', 'backwash', 'Backwash'], ['REGEN', 'regeneration', 'Regeneration'],
    ['EFFL', 'effluent', 'Effluent'], ['HIPRESS', 'high_pressure', 'High pressure']];
  const VALVE_SERVICE = SERVICE.filter((s) => !['MLR', 'SCUM', 'HIPRESS'].includes(s[0])).map((s) => [s[0], s[1], s[2]]);
  const CHEMICAL = [['NAOCL', 'sodium_hypochlorite', 'Sodium hypochlorite'], ['CAOCL', 'calcium_hypochlorite', 'Calcium hypochlorite'], ['CL2', 'chlorine', 'Chlorine'], ['FECL3', 'ferric_chloride', 'Ferric chloride'],
    ['FESO4', 'ferrous_sulfate', 'Ferrous sulfate'], ['HCL', 'hydrochloric_acid', 'Hydrochloric acid'], ['H2SO4', 'sulfuric_acid', 'Sulfuric acid'], ['CITRIC', 'citric_acid', 'Citric acid'], ['NAOH', 'caustic_soda', 'Caustic soda'],
    ['LIME', 'lime', 'Lime'], ['ALUM', 'alum', 'Alum'], ['PAC', 'polyaluminium_chloride', 'Polyaluminium chloride'], ['POLY', 'polymer', 'Polymer'], ['ANTISCAL', 'antiscalant', 'Antiscalant'],
    ['SMBS', 'sodium_metabisulfite', 'Sodium metabisulfite'], ['H2O2', 'hydrogen_peroxide', 'Hydrogen peroxide'], ['KMNO4', 'potassium_permanganate', 'Potassium permanganate'], ['UREA', 'urea', 'Urea'],
    ['DAP', 'diammonium_phosphate', 'Diammonium phosphate'], ['ANTIFOAM', 'antifoam', 'Antifoam'], ['MEOH', 'methanol', 'Methanol'], ['NAAC', 'sodium_acetate', 'Sodium acetate'], ['NACL', 'sodium_chloride', 'Sodium chloride']];
  const FINENESS = AX('fineness', 'Fineness', true, false, [['COARSE', 'coarse', 'Coarse (6 mm and over)'], ['FINE', 'fine', 'Fine (1.5 to 6 mm)'], ['MICRO', 'micro', 'Micro (under 1.5 mm)']]);
  const SURFACE = AX('surface', 'Surface', false, false, [['BAR', 'bar', 'Bar'], ['MESH', 'mesh', 'Mesh'], ['PERF', 'perforated_plate', 'Perforated plate'], ['WEDGE', 'wedge_wire', 'Wedge wire']]);
  const SCREEN_MECH = AX('mechanism', 'Mechanism', true, false, [['RAKE', 'rake', 'Rake'], ['DRUM', 'rotary_drum', 'Rotary drum', ['ROTARY_DRUM']], ['STEP', 'step', 'Step'], ['SCREW', 'screw', 'Screw'], ['BAND', 'band', 'Band'], ['CHAIN', 'chain', 'Chain']]);
  const has = (v, axis, code) => arr(v[axis]).includes(code);

  /* ── 2. Equipment node types: 8 core types and 4 that take part in a process. lib(values) → the library type a code reads to ── */
  const EQ = [
    { code: 'PMP', name: 'Pump', stored: 'pump', group: 'Mechanical', existing: ['PMP', 'D_PMP', 'SUB_PMP', 'BT_PMP'],
      axes: [
        AX('mechanism', 'Mechanism', true, false, [['CENT', 'centrifugal', 'Centrifugal', ['SUB_PMP', 'BT_PMP']], ['PROG-CAV', 'progressive_cavity', 'Progressive cavity'], ['ARCH-SCREW', 'archimedean_screw', 'Archimedean screw'], ['DIAPH', 'diaphragm', 'Diaphragm', ['D_PMP']], ['PERI', 'peristaltic', 'Peristaltic'], ['AIRLIFT', 'air_lift', 'Air lift'], ['VERT-TURB', 'vertical_turbine', 'Vertical turbine']]),
        AX('installation', 'Installation', false, false, [['SURF', 'surface', 'Surface', ['D_PMP']], ['SUBM', 'submersible', 'Submersible', ['SUB_PMP']]]),
        AX('drive', 'Drive', false, false, [['ELEC', 'electric', 'Electric'], ['AIR-OP', 'air_operated', 'Air operated']]),
        AX('stages', 'Stages', false, false, [['MULTI', 'multistage', 'Multistage', ['BT_PMP']], ['SINGLE', 'single', 'Single stage']]),
        AX('impeller', 'Impeller', false, false, [['CUTTER', 'cutter', 'Cutter'], ['NON-CUT', 'non_cutter', 'Non-cutter']], 'Centrifugal pumps only'),
        AX('service', 'Service', true, true, SERVICE)],
      example: ['PMP_CENT_SUBM_CUTTER_INFL', 'a submersible centrifugal cutter pump on raw sewage lift'],
      lib: (v) => (has(v, 'mechanism', 'DIAPH') || has(v, 'mechanism', 'PERI') || has(v, 'service', 'DOSING') ? 'D_PMP' : has(v, 'installation', 'SUBM') ? 'SUB_PMP' : has(v, 'stages', 'MULTI') || has(v, 'service', 'BOOST') || has(v, 'service', 'HIPRESS') ? 'BT_PMP' : 'PMP') },
    { code: 'BLW', name: 'Blower', stored: 'blower', group: 'Mechanical', existing: ['BLW', 'M_BLW'],
      axes: [AX('construction', 'Construction', true, false, [['TWIN-LOBE', 'twin_rotary_lobe', 'Twin rotary lobe'], ['TRI-LOBE', 'tri_rotary_lobe', 'Tri rotary lobe'], ['SCREW', 'screw', 'Screw'], ['CENT', 'centrifugal', 'Centrifugal'], ['MULTI-CENT', 'multistage_centrifugal', 'Multistage centrifugal'], ['TURBO', 'turbo', 'Turbo'], ['MINI', 'mini_blower', 'Mini blower', ['M_BLW']], ['AXIAL', 'axial', 'Axial']])],
      example: ['BLW_TWIN-LOBE', 'a twin-lobe blower'], lib: (v) => (has(v, 'construction', 'MINI') ? 'M_BLW' : 'BLW') },
    { code: 'AIR_COMPRESSURE', name: 'Air compressor', stored: 'air_compressor', group: 'Mechanical', existing: ['AIR_COMPRESSURE'], axes: [], lib: () => 'AIR_COMPRESSURE' },
    { code: 'MIXER', name: 'Mixer', stored: 'mixer', group: 'Mechanical', existing: ['FLASH_MIXER', 'STATIC_MIXER'],
      axes: [AX('construction', 'Construction', true, false, [['SUBM', 'submersible', 'Submersible'], ['PADDLE', 'paddle', 'Paddle'], ['TURBINE', 'turbine', 'Turbine'], ['PROP', 'propeller', 'Propeller'], ['STATIC', 'static', 'Static', ['STATIC_MIXER']]]),
        AX('service', 'Service', false, false, [['FLASH', 'flash', 'Flash', ['FLASH_MIXER']], ['STD', 'standard', 'Standard']], 'Agitator, flash mixer and flocculation nodes only')],
      example: ['MIXER_TURBINE_FLASH', 'a turbine flash mixer'], lib: (v) => (has(v, 'construction', 'STATIC') ? 'STATIC_MIXER' : has(v, 'service', 'FLASH') ? 'FLASH_MIXER' : 'MIXER') },
    { code: 'SURF-AER', name: 'Surface aerator', stored: 'surface_aerator', group: 'Mechanical', existing: [],
      axes: [AX('mounting', 'Mounting', true, false, [['FIXED', 'fixed', 'Fixed'], ['FLOAT', 'floating', 'Floating']])], example: ['SURF-AER_FLOAT', 'a floating surface aerator'], lib: () => 'SURF-AER' },
    { code: 'VALVE', name: 'Valve', stored: 'valve', group: 'Mechanical', existing: ['VALVE_2', 'VALVE_3'],
      axes: [
        AX('type', 'Type', false, false, [['GATE', 'gate', 'Gate'], ['KNIFE-GATE', 'knife_gate', 'Knife gate'], ['NEEDLE', 'needle', 'Needle'], ['SLUICE', 'sluice_gate', 'Sluice gate'], ['BFLY', 'butterfly', 'Butterfly'], ['BALL', 'ball', 'Ball'], ['PLUG', 'plug', 'Plug'], ['CHECK', 'check', 'Check']]),
        AX('actuation', 'Actuation', true, false, [['AUTO', 'automatic', 'Automatic'], ['MANUAL', 'manual', 'Manual']]),
        AX('mechanism', 'Mechanism', false, false, [['PNEU', 'pneumatic', 'Pneumatic'], ['HAND', 'manual', 'Manual'], ['SOLENOID', 'solenoid', 'Solenoid'], ['MOTORIZED', 'motorized', 'Motorized']]),
        AX('ports', 'Ports', true, false, [['2-WAY', '2', 'Two way', ['VALVE_2']], ['3-WAY', '3', 'Three way', ['VALVE_3']]]),
        AX('service', 'Service', true, false, VALVE_SERVICE)],
      example: ['VALVE_BFLY_MANUAL_2-WAY_RAS', 'a manual two-way butterfly valve on the return sludge line'], lib: (v) => (has(v, 'ports', '3-WAY') ? 'VALVE_3' : 'VALVE_2') },
    { code: 'MOTOR', name: 'Motor', stored: 'motor', group: 'Drives', existing: ['MOTOR'], axes: [], lib: () => 'MOTOR' },
    { code: 'TANK', name: 'Tank', stored: 'tank', group: 'Containment', existing: ['OS_TANK', 'OS_TANK_DF', 'OS_TANK_AG', 'OS_TANK_SP', 'TANK', 'TANK_2', 'CP_TANK', 'OP_TANK', 'OVERHEAD_T', 'DOS_TANK'],
      axes: [
        AX('form', 'Form', true, false, [['OPEN-SURF', 'open_surface', 'Open surface', ['OS_TANK']], ['CLOSED-PROC', 'closed_process', 'Closed process', ['CP_TANK']], ['OPEN-PROC', 'open_process', 'Open process', ['OP_TANK']], ['OVERHEAD', 'overhead', 'Overhead', ['OVERHEAD_T']]]),
        AX('service', 'Service', true, false, [['DOSING', 'dosing', 'Dosing', ['DOS_TANK']], ['BACKWASH', 'backwash', 'Backwash'], ['CIP', 'clean_in_place', 'Clean in place'], ['CEB', 'chemically_enhanced_backwash', 'Chemically enhanced backwash'], ['AGITATOR', 'agitator', 'Agitator', ['OS_TANK_AG']], ['BRINE', 'brine', 'Brine'], ['SUMP', 'sump', 'Sump', ['OS_TANK_SP']]], 'Tanks that are not unit processes'),
        AX('chemical', 'Chemical', false, true, CHEMICAL, 'Dosing tanks only')],
      example: ['TANK_OPEN-SURF_DOSING_NAOCL-SMBS', 'an open-surface dosing tank for sodium hypochlorite and SMBS'],
      lib: (v) => (has(v, 'service', 'DOSING') ? 'DOS_TANK' : has(v, 'service', 'AGITATOR') ? 'OS_TANK_AG' : has(v, 'service', 'SUMP') ? 'OS_TANK_SP' : has(v, 'form', 'OPEN-SURF') ? 'OS_TANK' : has(v, 'form', 'CLOSED-PROC') ? 'CP_TANK' : has(v, 'form', 'OPEN-PROC') ? 'OP_TANK' : has(v, 'form', 'OVERHEAD') ? 'OVERHEAD_T' : 'TANK') },
    { code: 'GAS_TONNER', name: 'Chlorine gas tonner', stored: 'gas_tonner', group: 'Takes part in a process', existing: ['GAS_TONNER'], axes: [], lib: () => 'GAS_TONNER' },
    { code: 'OZONATOR', name: 'Ozonator', stored: 'ozonator', group: 'Takes part in a process', existing: ['OZONATOR'], axes: [], lib: () => 'OZONATOR' },
    { code: 'CAVITATOR', name: 'Cavitator', stored: 'cavitator', group: 'Takes part in a process', existing: ['CAVITATOR'], axes: [], lib: () => 'CAVITATOR' },
    { code: 'CARTRIDGE_FILTER', name: 'Cartridge filter', stored: 'cartridge_filter', group: 'Takes part in a process', existing: ['CARTRIDGE_FILTER'], axes: [], lib: () => 'CARTRIDGE_FILTER' },
  ].map((t) => ({ ...t, kind: 'equipment' }));

  /* ── 3. Unit-process types: (group, name, stored value, tank?, code, existing codes, label words,
        the equipment type the node is on its own, axes, its name in the taxonomy when that differs) ── */
  const GROUPS = [['preliminary', 'Preliminary'], ['primary', 'Primary'], ['secondary', 'Secondary'], ['tertiary', 'Tertiary'], ['zld', 'Zero liquid discharge'], ['utility', 'Utility'],
    ['flowpath', 'Flow-path tanks'], ['sludge', 'Sludge handling'], ['other', 'Catch-all']].map(([key, label]) => ({ key, label }));
  const P = (group, name, stored, tank, code, existing, labels, eq, axes, sub) => ({ kind: 'process', group, name, stored, tank: !!tank, code, existing: existing || [], labels: labels || [], eq, axes: axes || [], ...(sub ? { sub } : {}) });
  const UP = [
    P('preliminary', 'Screening (manual)', 'screening', 0, 'OS_TANK_SC', ['OS_TANK_SC'], [], 'OS_TANK_SC', [FINENESS, SURFACE]),
    P('preliminary', 'Mechanical screening', 'mechanical_screening', 0, 'MECHANICAL_SCREEN', ['MECHANICAL_SCREEN'], [], 'MECHANICAL_SCREEN', [FINENESS, SURFACE, SCREEN_MECH]),
    P('preliminary', 'Rotary drum screening', 'rotary_drum_screening', 0, 'ROTARY_DRUM', ['ROTARY_DRUM'], [], 'ROTARY_DRUM', [FINENESS, SURFACE, SCREEN_MECH]),
    P('preliminary', 'Grit removal', 'grit_removal', 0, 'GRIT', ['GRIT_CHAMBER', 'GRIT_CLASSIFIER', 'VTG_CHAMBER'], [], 'GRIT_CHAMBER'),
    P('preliminary', 'Oil and grease removal', 'oil_grease_removal', 1, 'SH_TANK', ['SH_TANK'], ['oil', 'grease', 'trap'], 'SH_TANK'),
    P('preliminary', 'Hydrocyclone separation', 'hydrocyclone_separation', 0, 'HYDROCYCLONE', ['HYDROCYCLONE'], [], 'HYDROCYCLONE'),
    P('primary', 'Flash mixing', 'flash_mixing', 0, 'FLASH-MIX', [], [], 'FLASH_MIXER'),
    P('primary', 'Flocculation process', 'flocculation', 0, 'FLOCCULATION', ['FLOCCULATION'], [], 'FLOCCULATION', [], 'Flocculation'),
    P('primary', 'Dissolved air flotation', 'dissolved_air_flotation', 0, 'DAF', ['DAF'], [], 'DAF'),
    P('primary', 'Tube settling', 'tube_settling', 1, 'T_SETTLER', ['T_SETTLER'], [], 'T_SETTLER'),
    P('secondary', 'Anoxic treatment', 'anoxic_treatment', 1, 'ANX-TANK', [], ['anoxic'], 'ANX-TANK'),
    P('secondary', 'Activated sludge', 'activated_sludge', 1, 'AER-TANK', [], ['aeration'], 'AER-TANK'),
    P('secondary', 'Membrane bioreactor', 'mbr', 1, 'MBR', ['MBR'], [], 'MBR'),
    P('secondary', 'Moving bed biofilm reactor', 'mbbr', 1, 'MBBR', ['MBBR'], [], 'MBBR', [AX('media', 'Carrier media', false, false, [], 'Values not defined yet')]),
    P('secondary', 'Sequencing batch reactor', 'sbr', 1, 'SBR_TANK', ['SBR_TANK'], ['sbr'], 'SBR_TANK'),
    P('secondary', 'Cyclic activated sludge system', 'cass', 1, 'CASS_BASIN', ['CASS_BASIN'], [], 'CASS_BASIN'),
    P('secondary', 'SABRE treatment', 'sabre', 1, 'SABRE', ['BIG_SABRE', 'MINI_SABRE'], [], 'BIG_SABRE', [AX('size', 'Size', true, false, [['BIG_SABRE', 'big', 'Big', ['BIG_SABRE']], ['MINI_SABRE', 'mini', 'Mini', ['MINI_SABRE']]], 'The two codes are kept whole: SABRE is never drawn on its own')], 'SABRE'),
    P('secondary', 'Membrane filtration (generic)', 'membrane_filtration', 0, 'MEMBRANE', [], [], 'MEMBRANE'),
    P('secondary', 'Cascade aeration', 'cascade_aeration', 0, 'CASCADE_AREATOR', ['CASCADE_AREATOR'], [], 'CASCADE_AREATOR'),
    P('secondary', 'Anaerobic treatment', 'anaerobic_treatment', 1, 'ANAEROBIC', [], [], 'ANAEROBIC', [AX('reactor', 'Reactor type', false, false, [], 'Values not defined yet')]),
    P('tertiary', 'Media filtration', 'media_filtration', 1, 'MF', ['ACF_MGF'], [], 'ACF_MGF', [AX('media', 'Media', true, false, [['PSF', 'sand', 'Sand'], ['ANTHRA', 'anthracite', 'Anthracite'], ['ACF', 'granular_activated_carbon', 'Granular activated carbon', ['ACF_MGF']], ['MGF', 'multigrade_media', 'Multigrade media', ['ACF_MGF']]], 'The existing code cannot tell an activated carbon filter from a multigrade filter')]),
    P('tertiary', 'Microfiltration', 'microfiltration', 0, 'MF-MEM', [], [], 'MF-MEM'),
    P('tertiary', 'Ultrafiltration', 'ultrafiltration', 0, 'UF_MEM', ['UF_MEM'], [], 'UF_MEM'),
    P('tertiary', 'Nanofiltration', 'nanofiltration', 0, 'NF-MEM', [], [], 'NF-MEM'),
    P('tertiary', 'Reverse osmosis', 'ro_desalination', 0, 'RO', ['RO'], [], 'RO'),
    P('tertiary', 'UV disinfection', 'uv_disinfection', 0, 'UV', ['UV'], [], 'UV'),
    P('tertiary', 'Chlorination', 'chlorination', 0, 'CCT', [], [], 'CCT', [AX('source', 'Chlorine source', true, false, [['GAS', 'gas', 'Chlorine gas'], ['NAOCL', 'sodium_hypochlorite', 'Sodium hypochlorite'], ['CAOCL', 'calcium_hypochlorite', 'Calcium hypochlorite']])]),
    P('tertiary', 'Dechlorination', 'dechlorination', 0, 'DECHLOR', [], [], 'DECHLOR'),
    P('tertiary', 'Softening', 'softening', 0, 'SOFTNER', ['SOFTNER'], [], 'SOFTNER', [AX('softener', 'Softener type', false, false, [], 'Values not defined yet')]),
    P('zld', 'Brine concentration', 'brine_concentration', 0, 'QUADSON_EVAPORATOR', ['QUADSON_EVAPORATOR'], [], 'QUADSON_EVAPORATOR', [AX('evaporator', 'Evaporator type', false, false, [], 'Values not defined yet')]),
    P('utility', 'Cooling', 'cooling', 0, 'COOLING_TOWER', ['COOLING_TOWER'], [], 'COOLING_TOWER'),
    P('flowpath', 'Collection', 'collection', 1, 'COL-TANK', [], ['collection'], 'COL-TANK', [], 'Collection tank'),
    P('flowpath', 'Sludge holding', 'sludge_holding', 1, 'SLH-TANK', [], ['sludge holding'], 'SLH-TANK', [], 'Sludge holding tank'),
    P('flowpath', 'Treated water', 'treated_water', 1, 'TW-TANK', [], ['treated water', 'soft water'], 'TW-TANK', [AX('enduse', 'End use', false, true, [['FLUSH', 'flushing', 'Flushing'], ['IRRIG', 'irrigation', 'Irrigation'], ['DOMESTIC', 'domestic', 'Domestic']], 'The list of end uses is not complete yet')], 'Treated water tank'),
    P('flowpath', 'Equalization', 'equalization', 1, 'EQ-TANK', [], ['equalization', 'equalisation', 'eqt'], 'EQ-TANK', [], 'Equalization tank'),
    P('flowpath', 'Filter feed', 'filter_feed', 1, 'FF-TANK', [], ['filter feed'], 'FF-TANK', [], 'Filter feed tank'),
    P('flowpath', 'Filtered water', 'filtered_water', 1, 'FW-TANK', [], ['filtered water'], 'FW-TANK', [], 'Filtered water tank'),
    P('flowpath', 'Recirculation holding', 'recirculation_holding', 1, 'RC-TANK', [], ['recirculation', 're-circulation'], 'RC-TANK', [], 'Recirculation holding tank'),
    P('sludge', 'Clarification', 'clarification', 0, 'CLARIFIER', ['CLARIFIER'], [], 'CLARIFIER'),
    P('sludge', 'Gravity thickening', 'gravity_thickening', 0, 'GRAV-THICK', [], [], 'GRAV-THICK'),
    P('sludge', 'DAF thickening', 'daf_thickening', 0, 'DAF-THICK', [], [], 'DAF-THICK'),
    P('sludge', 'Gravity belt thickening', 'gravity_belt_thickening', 0, 'GBT', [], [], 'GBT'),
    P('sludge', 'Rotary drum thickening', 'rotary_drum_thickening', 0, 'RDT', [], [], 'RDT'),
    P('sludge', 'Centrifuge thickening', 'centrifuge_thickening', 0, 'CENT-THICK', [], [], 'CENT-THICK'),
    P('sludge', 'Belt filter press dewatering', 'belt_filter_press_dewatering', 0, 'F_PRESS', ['F_PRESS'], [], 'F_PRESS', [], 'Belt filter press'),
    P('sludge', 'Plate-and-frame filtration', 'plate_frame_filtration', 0, 'PF-PRESS', [], [], 'PF-PRESS', [], 'Plate-and-frame filter press'),
    P('sludge', 'Centrifuge dewatering', 'centrifuge_dewatering', 0, 'DECANTER', [], [], 'DECANTER', [], 'Centrifuge (decanter) dewatering'),
    P('sludge', 'Screw press dewatering', 'screw_press_dewatering', 0, 'SC_PRESS', ['SC_PRESS'], [], 'SC_PRESS', [], 'Screw press'),
    P('sludge', 'Sludge digestion', 'sludge_digestion', 0, 'ANAEROBIC_TANK', ['ANAEROBIC_TANK'], [], 'ANAEROBIC_TANK'),
    P('sludge', 'Thermal drying', 'thermal_drying', 0, 'THERMAL-DRYER', [], [], 'THERMAL-DRYER'),
    P('sludge', 'Solar drying', 'solar_drying', 0, 'SOLAR-DRYER', [], [], 'SOLAR-DRYER'),
    P('sludge', 'Sludge drying beds', 'sludge_drying_bed', 0, 'DRYING-BED', [], [], 'DRYING-BED'),
    P('other', 'Unspecified', 'unspecified', 0, 'OTHER', [], [], 'OTHER'),
  ];
  const SUBGROUP = { clarification: 'Thickening', gravity_thickening: 'Thickening', daf_thickening: 'Thickening', gravity_belt_thickening: 'Thickening', rotary_drum_thickening: 'Thickening', centrifuge_thickening: 'Thickening',
    belt_filter_press_dewatering: 'Dewatering', plate_frame_filtration: 'Dewatering', centrifuge_dewatering: 'Dewatering', screw_press_dewatering: 'Dewatering', sludge_digestion: 'Digestion', thermal_drying: 'Drying', solar_drying: 'Drying', sludge_drying_bed: 'Drying' };
  const upByKey = {}; UP.forEach((p) => { upByKey[p.stored] = p; p.groupLabel = GROUPS.find((g) => g.key === p.group).label; if (SUBGROUP[p.stored]) p.subgroup = SUBGROUP[p.stored]; });
  const upByExisting = {}; UP.forEach((p) => p.existing.forEach((c) => { upByExisting[c] = p; }));

  /* ── 4. Library content. Readings, alerts and tasks use the library's own vocabulary (window.READINGS). ── */
  const S = (name, o) => { const r = R[name], x = o || {}; const s = { name, tag: r.tag, unit: r.unit, kind: r.kind, valid: (x.valid || r.valid).slice(), direction: 'direction' in x ? x.direction : r.direction, reading: 'reading' in x ? x.reading : name === 'Run status' ? 1 : r.kind === 'meter' ? 120 : 0 }; if (r.expr) s.expr = r.expr; return s; };
  const AL = (n, sensorKind, direction, limits, extra) => ({ name: n, sensorKind, direction, limits, ...(extra || {}) });
  const IF_DRAWN = { ifDrawn: true };
  const PM = (n, every, unit, meterHours) => ({ name: n, workType: 'pm', basis: meterHours ? 'either' : 'calendar', every: { n: every, unit }, ...(meterHours ? { meterHours } : {}) });
  const RT = (n, every, unit) => ({ name: n, workType: 'routine', basis: 'calendar', every: { n: every, unit } });
  const CAL = (n, every, unit) => ({ name: n, workType: 'calibration', basis: 'calendar', every: { n: every, unit } });
  const NR = (name, note) => ({ name, note: note || (R[name] || {}).note });
  const NA = (name, reading, note, direction, limits) => ({ name, reading, note, direction, ...(limits ? { limits } : {}) });
  const NP = (readings, alerts, work) => ({ readings: readings || [], alerts: alerts || [], work: work || [] });
  const LEVEL_HIGH = () => AL('Level high', 'Level', 'above', { caution: 85, major: 95 });
  const LEVEL_LOW = (n) => AL(n || 'Level low', 'Level', 'below', { caution: 20, minor: 10 });
  const TRIP = (n) => AL(n, 'Trip contact', 'above', { major: 1 });
  const GUESS = 'New type, content guessed: ';

  /* new equipment types: (code, name, archetype, criticality, expects, tag prefix, readings, alerts, tasks, to confirm, next phase, content copied from) */
  const E = (code, name, archetype, tier, expects, prefix, sensors, alerts, tasks, confirm, np, from) => ({ code, name, archetype, tier, expects, prefix, sensors, alerts, tasks, confirm: GUESS + confirm, nextPhase: np || NP(), ...(from ? { from } : {}) });
  const TANK_CLEAN = () => PM('Tank cleaning', 6, 'month');
  const CENTRIFUGE = (what) => [[S('Run status'), S('Trip contact'), S('Motor current', { reading: 28 }), S('Vibration', { reading: 2.5 }), S('Run hours', { reading: 300 })],
    [TRIP('Centrifuge tripped'), AL('Vibration high', 'Vibration', 'above', { minor: 7, major: 11 }, { gate: 'Run status' })], [PM('Bearing, bowl and scroll service', 6, 'month', 2000)],
    `a ${what} with run, trip, current, vibration and run-hours readings, a Major alert on a trip, vibration limits at 7 and 11 mm/s while it runs, and a bearing, bowl and scroll service every 6 months or 2000 run-hours.`];
  const NEW_EQ = [
    E('MIXER', 'Mixer', 'rotating', 'C', ['mechanical PM'], 'MX', [S('Run status'), S('Motor current', { valid: [0, 30], reading: 6 })], [AL('Motor current high', 'Motor current', 'above', { minor: 24 })], [PM('Gearbox and bearing service', 6, 'month')], 'a driven mixer with run and current readings, a current limit at 24 A (no motor rating to work it out from) and a gearbox and bearing service every 6 months.'),
    E('SURF-AER', 'Surface aerator', 'rotating', 'B', ['mechanical PM'], 'SA', [S('Run status'), S('Trip contact'), S('Motor current', { reading: 22 }), S('Run hours', { reading: 120 })], [AL('Motor current high', 'Motor current', 'above', { caution: 40, minor: 45 }), AL('Aerator tripped', 'Trip contact', 'above', { emergency: 1 })], [PM('Gearbox oil and bearing service', 6, 'month', 4000), RT('Impeller and mooring check', 1, 'month')], 'run, trip, current and run-hours readings, an Emergency alert on a trip (the basin loses its air), and a gearbox service every 6 months or 4000 run-hours.'),
    E('COL-TANK', 'Collection tank', 'vessel', 'C', ['cleaning'], 'CT', [S('Level', { reading: 55 }), S('Sump flood switch')], [LEVEL_HIGH(), AL('Sump flooding', 'Sump flood switch', 'above', { emergency: 1 }, IF_DRAWN)], [TANK_CLEAN()], 'a level reading with high limits at 85% and 95%, a flood switch where one is drawn, and a clean every 6 months.'),
    E('SLH-TANK', 'Sludge holding tank', 'vessel', 'C', ['desludging'], 'SHT', [S('Level', { reading: 50 })], [LEVEL_HIGH()], [PM('Tank desludging and cleaning', 6, 'month')], 'a level reading with high limits at 85% and 95%, and a desludge and clean every 6 months.'),
    E('TW-TANK', 'Treated water tank', 'vessel', 'C', ['cleaning'], 'TWT', [S('Level', { reading: 60 })], [LEVEL_HIGH(), LEVEL_LOW('Treated water running low')], [TANK_CLEAN()], 'a level reading with high limits at 85% and 95%, low limits at 20% and 10% (the users downstream run dry), and a clean every 6 months.'),
    E('EQ-TANK', 'Equalization tank', 'vessel', 'C', ['cleaning'], 'EQT', [S('Level', { reading: 58 }), S('pH', { reading: 7.3 })], [LEVEL_HIGH(), AL('pH high', 'pH', 'above', { minor: 8.5, major: 9.5 }, IF_DRAWN), AL('pH low', 'pH', 'below', { minor: 6.0, major: 5.5 }, IF_DRAWN)], [TANK_CLEAN()], 'the open tank’s level and pH limits, and a clean every 6 months.'),
    E('FF-TANK', 'Filter feed tank', 'vessel', 'C', ['cleaning'], 'FFT', [S('Level', { reading: 55 })], [LEVEL_HIGH(), LEVEL_LOW('Filter feed running low')], [TANK_CLEAN()], 'a level reading with high limits at 85% and 95%, low limits at 20% and 10% (the feed pumps run dry), and a clean every 6 months.'),
    E('FW-TANK', 'Filtered water tank', 'vessel', 'C', ['cleaning'], 'FWT', [S('Level', { reading: 60 })], [LEVEL_HIGH(), LEVEL_LOW('Filtered water running low')], [TANK_CLEAN()], 'a level reading with high limits at 85% and 95%, low limits at 20% and 10% (no water left for a backwash), and a clean every 6 months.'),
    E('RC-TANK', 'Recirculation holding tank', 'vessel', 'C', ['cleaning'], 'RCT', [S('Level', { reading: 50 })], [LEVEL_HIGH()], [TANK_CLEAN()], 'a level reading with high limits at 85% and 95%, and a clean every 6 months.'),
    E('ANX-TANK', 'Anoxic tank', 'vessel', 'B', ['inspection'], 'ANX', [S('Dissolved oxygen', { direction: 'above', reading: 0.2 }), S('ORP', { direction: 'above', reading: -80 })], [AL('DO high', 'Dissolved oxygen', 'above', { minor: 0.5, major: 1.0 }), AL('ORP high', 'ORP', 'above', { minor: 50 }, IF_DRAWN)], [PM('Mixer and tank inspection', 6, 'month')], 'oxygen is the bad way here: DO high at 0.5 mg/L (Minor) and 1.0 mg/L (Major), ORP high at +50 mV where a probe is drawn, and an inspection every 6 months.'),
    E('AER-TANK', 'Aeration tank', 'vessel', 'B', [], 'AT', null, null, null, 'the same content as the Diffuser Tank: DO, MLSS and temperature limits and a daily SV30 test.', null, 'OS_TANK_DF'),
    E('MEMBRANE', 'Membrane unit', 'membrane', 'A', ['CIP'], 'MEM', [], [], [PM('Quarterly CIP', 3, 'month')], 'a membrane cleaned in place every 3 months; its pressure is read on the lines.', NP([NR('Trans-membrane pressure')])),
    E('ANAEROBIC', 'Anaerobic reactor', 'vessel', 'B', ['desludging'], 'ANR', [S('pH', { direction: 'below', reading: 7.0 }), S('Temperature', { reading: 31 })], [AL('pH low', 'pH', 'below', { minor: 6.5, major: 6.0 })], [PM('Desludging', 6, 'month')], 'the Anaerobic Tank’s pH limits (low at 6.5 and 6.0) and a desludge every 6 months.'),
    E('MF-MEM', 'Microfiltration membrane', 'membrane', 'A', ['CIP'], 'MF', null, null, null, 'the same content as the UF Membrane.', null, 'UF_MEM'),
    E('NF-MEM', 'Nanofiltration membrane', 'membrane', 'A', ['CIP'], 'NF', null, null, null, 'the same content as RO.', null, 'RO'),
    E('CCT', 'Chlorine contact tank', 'vessel', 'B', ['cleaning'], 'CCT', [S('Level', { reading: 60 })], [LEVEL_HIGH()], [TANK_CLEAN()], 'a level reading with high limits at 85% and 95% and a clean every 6 months; the chlorine left is read in the water leaving it.', NP([NR('Residual chlorine')], [NA('Residual chlorine low', 'Residual chlorine', 'measured in the water leaving the tank, a connection', 'below', { minor: 0.2 })])),
    E('DECHLOR', 'Dechlorination unit', 'dosing', 'B', ['pump PM'], 'DCL', [S('Run status')], [], [CAL('Calibration of dose rate', 3, 'month')], 'a dosing unit with a run status and a dose-rate calibration every 3 months; the chlorine left is read in the water leaving it.', NP([NR('Residual chlorine')], [NA('Residual chlorine high', 'Residual chlorine', 'measured in the water leaving the unit, a connection', 'above', { minor: 0.1 })])),
    E('GRAV-THICK', 'Gravity thickener', 'rotating', 'B', ['mechanical PM'], 'GT', [S('Sludge blanket', { reading: 1.2 }), S('Run status')], [AL('Sludge blanket high', 'Sludge blanket', 'above', { minor: 2.5 })], [PM('Scraper drive service', 6, 'month')], 'a scraper thickener like a clarifier: a sludge blanket limit at 2.5 m and a drive service every 6 months.'),
    E('DAF-THICK', 'DAF thickener', 'rotating', 'B', ['mechanical PM'], 'DT', null, null, null, 'the same content as Dissolved Air Floatation.', null, 'DAF'),
    E('GBT', 'Gravity belt thickener', 'rotating', 'B', ['mechanical PM'], 'GBT', [S('Run status'), S('Trip contact'), S('Run hours', { reading: 200 })], [TRIP('Belt drive tripped')], [PM('Belt, roller and bearing service', 6, 'month', 500), RT('Belt wash check', 1, 'week')], 'run, trip and run-hours readings, a Major alert on a trip, and a belt and roller service every 6 months or 500 run-hours.'),
    E('RDT', 'Rotary drum thickener', 'rotating', 'B', ['mechanical PM'], 'RDT', [S('Run status'), S('Trip contact'), S('Run hours', { reading: 200 })], [TRIP('Drum drive tripped')], [PM('Drum, screen and bearing service', 6, 'month', 500)], 'run, trip and run-hours readings, a Major alert on a trip, and a drum service every 6 months or 500 run-hours.'),
    E('CENT-THICK', 'Thickening centrifuge', 'rotating', 'B', ['mechanical PM'], 'TC', ...CENTRIFUGE('thickening centrifuge')),
    E('PF-PRESS', 'Plate-and-frame filter press', 'rotating', 'B', ['mechanical PM', 'cloth replacement'], 'PFP', null, null, null, 'the same content as the Filter Press.', null, 'F_PRESS'),
    E('DECANTER', 'Decanter centrifuge', 'rotating', 'B', ['mechanical PM'], 'DC', ...CENTRIFUGE('decanter centrifuge')),
    E('THERMAL-DRYER', 'Thermal dryer', 'rotating', 'B', ['mechanical PM'], 'TD', [S('Run status'), S('Trip contact'), S('Run hours', { reading: 400 })], [TRIP('Dryer tripped')], [PM('Burner, drive and seal service', 6, 'month', 2000)], 'run, trip and run-hours readings, a Major alert on a trip, and a service every 6 months or 2000 run-hours.'),
    E('SOLAR-DRYER', 'Solar dryer', 'fixed', 'C', ['inspection'], 'SD', [], [], [PM('Cover and ventilation check', 3, 'month')], 'a covered drying hall checked every 3 months.'),
    E('DRYING-BED', 'Sludge drying bed', 'fixed', 'C', ['cleaning'], 'SDB', [], [], [PM('Sand layer top-up and underdrain check', 6, 'month')], 'a sand bed topped up and its underdrain checked every 6 months.'),
    E('OTHER', 'Other equipment', 'fixed', 'C', ['inspection'], 'X', [], [], [RT('Inspection', 1, 'month')], 'the catch-all for a node no type fits: a monthly inspection and nothing else.'),
  ];

  /* what a unit process adds to the node's own content: the routine work of the step, and the readings the step is run by */
  const ADD = {
    screening: { tasks: [RT('Rake the screen and clear screenings', 1, 'day'), RT('Screenings disposal', 1, 'week')] },
    mechanical_screening: { tasks: [PM('Rake, chain and drive service', 3, 'month'), RT('Screenings bin emptying', 1, 'day')] },
    rotary_drum_screening: { tasks: [PM('Drum, spray nozzle and drive service', 3, 'month'), RT('Screenings bin emptying', 1, 'day')] },
    grit_removal: { tasks: [PM('Chamber and classifier inspection', 3, 'month')] },
    oil_grease_removal: { tasks: [RT('Skimmed oil disposal', 1, 'month')] },
    hydrocyclone_separation: { tasks: [RT('Underflow check', 1, 'week')] },
    flash_mixing: { sensors: [S('pH', { reading: 7.2 })], alerts: [AL('pH high', 'pH', 'above', { minor: 8.5, major: 9.5 }, IF_DRAWN), AL('pH low', 'pH', 'below', { minor: 6.0, major: 5.5 }, IF_DRAWN)], tasks: [RT('Jar test and dose check', 1, 'week')] },
    flocculation: { tasks: [RT('Floc formation check', 1, 'day')] },
    dissolved_air_flotation: { tasks: [RT('Float skimming and scum check', 1, 'day'), PM('Saturator pressure and nozzle check', 3, 'month')] },
    tube_settling: { tasks: [RT('Sludge draw-off', 1, 'day')] },
    anoxic_treatment: { tasks: [RT('Nitrate recycle check', 1, 'week')] },
    activated_sludge: { tasks: [RT('Sludge wasting', 1, 'day'), PM('Diffuser inspection and cleaning', 6, 'month')] },
    mbr: { sensors: [S('Dissolved oxygen', { reading: 2.2 }), S('MLSS', { reading: 8500 })], alerts: [AL('DO low', 'Dissolved oxygen', 'below', { minor: 2.0, major: 1.0 }, IF_DRAWN), AL('MLSS high', 'MLSS', 'above', { minor: 11000 }, IF_DRAWN)], tasks: [RT('Maintenance clean', 1, 'week'), RT('Sludge wasting', 1, 'day')] },
    mbbr: { tasks: [RT('Media movement check', 1, 'day'), RT('SV30 settling test', 1, 'week')] },
    sbr: { tasks: [RT('Decanter and cycle check', 1, 'week'), RT('Sludge wasting', 1, 'day')] },
    cass: { tasks: [RT('Decanter and cycle check', 1, 'week'), RT('Sludge wasting', 1, 'day')] },
    sabre: { tasks: [RT('Process check', 1, 'week')] },
    membrane_filtration: { tasks: [RT('Integrity check', 1, 'month')] },
    cascade_aeration: { sensors: [S('Dissolved oxygen', { reading: 5 })], alerts: [AL('DO low', 'Dissolved oxygen', 'below', { minor: 4.0 }, IF_DRAWN)], tasks: [] },
    anaerobic_treatment: { tasks: [RT('Gas line and flare check', 1, 'week'), RT('Alkalinity and volatile acids sample', 1, 'week')] },
    media_filtration: { tasks: [PM('Media level check and top-up', 12, 'month')] },
    microfiltration: { tasks: [RT('Integrity check', 1, 'month')] },
    ultrafiltration: { tasks: [RT('Chemically enhanced backwash', 1, 'week'), RT('Integrity check', 1, 'month')] },
    nanofiltration: { tasks: [RT('Antiscalant dose check', 1, 'week')] },
    ro_desalination: { tasks: [RT('Antiscalant dose check', 1, 'week'), RT('Normalised performance log', 1, 'week')] },
    uv_disinfection: { tasks: [PM('Quartz sleeve cleaning', 1, 'month')] },
    chlorination: { tasks: [RT('Residual chlorine check', 1, 'day')] },
    dechlorination: { tasks: [RT('Residual chlorine check', 1, 'day')] },
    softening: { tasks: [RT('Outlet hardness test', 1, 'day')] },
    brine_concentration: { tasks: [RT('Concentrate blowdown check', 1, 'day')] },
    cooling: { tasks: [RT('Blowdown and water chemistry check', 1, 'week')] },
    collection: { tasks: [RT('Floating matter removal', 1, 'week')] },
    sludge_holding: { tasks: [RT('Sludge level and transfer check', 1, 'day')] },
    treated_water: { tasks: [RT('Treated water quality sample', 1, 'day')] },
    equalization: { tasks: [RT('Mixing and air check', 1, 'day')] },
    filter_feed: { tasks: [RT('Feed pump suction check', 1, 'week')] },
    filtered_water: { tasks: [RT('Backwash water reserve check', 1, 'week')] },
    recirculation_holding: { tasks: [RT('Recirculation line check', 1, 'week')] },
    clarification: { tasks: [RT('Sludge return and wasting check', 1, 'day'), RT('Weir and scum cleaning', 1, 'week')] },
    gravity_thickening: { tasks: [RT('Thickened sludge draw-off', 1, 'day')] },
    daf_thickening: { tasks: [RT('Float skimming check', 1, 'day')] },
    gravity_belt_thickening: { tasks: [RT('Polymer dose check', 1, 'day')] },
    rotary_drum_thickening: { tasks: [RT('Polymer dose check', 1, 'day')] },
    centrifuge_thickening: { tasks: [RT('Polymer dose check', 1, 'day')] },
    belt_filter_press_dewatering: { tasks: [RT('Polymer dose check', 1, 'day'), RT('Cake disposal', 1, 'day')] },
    plate_frame_filtration: { tasks: [RT('Cake discharge and cloth wash', 1, 'day')] },
    centrifuge_dewatering: { tasks: [RT('Polymer dose check', 1, 'day'), RT('Cake disposal', 1, 'day')] },
    screw_press_dewatering: { tasks: [RT('Polymer dose check', 1, 'day'), RT('Cake disposal', 1, 'day')] },
    sludge_digestion: { tasks: [RT('Gas line and flare check', 1, 'week')] },
    thermal_drying: { tasks: [RT('Dried sludge disposal', 1, 'week')] },
    solar_drying: { tasks: [RT('Sludge turning round', 1, 'day'), RT('Dried sludge disposal', 1, 'week')] },
    sludge_drying_bed: { tasks: [RT('Dried sludge removal', 2, 'week')] },
    unspecified: { tasks: [] },
  };

  /* ── 5. Register the types with the library the console already reads ── */
  const setOf = (typeName) => W.SEED.standardSets.find((t) => t.type === typeName) || null;
  const SHARES = {};   /* base type name → the new type names that share its flows, root causes, issues and tasks */
  function register(code, name, cat, set, extra) {
    if (W.CATALOGUE_BY_CODE[code] || W.CATALOGUE_BY_TYPE[name]) return false;
    const row = { code, name, category: 'equipment', kind: 'equipment', questions: 0, ...(extra && extra.library === 'process' ? { process: true } : {}) };
    W.DB_PALETTE.push(row); W.DB_BY_CODE[code] = row;
    const c = { ...cat, code, type: name, ...(extra || {}) }; W.CATALOGUE.push(c); W.CATALOGUE_BY_CODE[code] = c; W.CATALOGUE_BY_TYPE[name] = c;
    W.SEED.standardSets.push({ id: 't_' + code.toLowerCase().replace(/[^a-z0-9]+/g, '_'), type: name, usedAt: 0, alerts: set.alerts, schedules: set.schedules });
    return true;
  }
  const baseParts = (baseCode) => { const b = W.CATALOGUE_BY_CODE[baseCode]; const s = setOf(b.type) || { alerts: [], schedules: [] }; return { b, cat: clone(b), alerts: clone(s.alerts), schedules: clone(s.schedules) }; };
  NEW_EQ.forEach((e) => {
    if (e.from) {
      const p = baseParts(e.from); const cat = p.cat; cat.prefix = e.prefix; cat.confirm = e.confirm;
      if (register(e.code, e.name, cat, { alerts: p.alerts, schedules: p.schedules }, { addedBy: 'taxonomy', copiedFrom: e.from })) (SHARES[p.b.type] = SHARES[p.b.type] || []).push(e.name);
    } else register(e.code, e.name, { archetype: e.archetype, tier: e.tier, expects: e.expects, prefix: e.prefix, sensors: e.sensors, nextPhase: e.nextPhase, confirm: e.confirm }, { alerts: e.alerts, schedules: e.tasks }, { addedBy: 'taxonomy' });
  });
  UP.forEach((p) => {
    const base = baseParts(p.eq); const add = ADD[p.stored] || {}; const cat = base.cat;
    arr(add.sensors).forEach((s) => { if (!cat.sensors.some((x) => x.name === s.name)) cat.sensors.push(s); });
    const alerts = base.alerts.concat(arr(add.alerts).filter((a) => !base.alerts.some((x) => x.name === a.name)));
    const schedules = base.schedules.concat(arr(add.tasks).filter((t) => !base.schedules.some((x) => x.name === t.name)));
    cat.confirm = `A first draft for this unit process: what the ${base.b.type} carries on its own${arr(add.tasks).length ? `, plus the routine work of the step (${arr(add.tasks).map((t) => t.name).join(', ')})` : ''}. Confirm it.`;
    delete cat.copiedFrom;
    if (register(p.stored, p.name, cat, { alerts, schedules }, { library: 'process', family: p.groupLabel, group: p.group, node: p.eq, addedBy: 'taxonomy' })) (SHARES[base.b.type] = SHARES[base.b.type] || []).push(p.name);
  });
  /* a flow, a root cause, an issue or a task written for a base type also serves the types built on it */
  const share = (list) => { if (!Array.isArray(list)) return; Object.keys(SHARES).forEach((b) => { if (list.includes(b)) SHARES[b].forEach((n) => { if (!list.includes(n)) list.push(n); }); }); };
  for (let pass = 0; pass < 2; pass++) {   /* twice: a type copied from a copied type (Aeration tank, then Activated sludge) */
    arr(W.SEED.flows).forEach((f) => share(f.forTypes)); arr(W.SEED.causes).forEach((c) => share(c.types));
    arr(W.ISSUES).forEach((i) => share(i.homeTypes)); arr(W.ISSUE_TASKS).forEach((t) => share(t.types));
  }

  /* ── 6. Reading a code. The longest known type code first, then one segment per axis; several values share a segment with "-". ── */
  const TYPES = EQ.concat(UP).slice().sort((a, b) => b.code.length - a.code.length);
  function readCode(raw) {
    const code = String(raw == null ? '' : raw).trim(); if (!code) return null;
    const t = TYPES.find((x) => code === x.code || code.startsWith(x.code + '_')); if (!t) return null;
    const rest = code === t.code ? [] : code.slice(t.code.length + 1).split('_').filter(Boolean);
    const values = {}; const unknown = [];
    rest.forEach((seg) => {
      let ax = t.axes.find((a) => a.values.some((v) => v.code === seg));
      if (ax) { (values[ax.key] = values[ax.key] || []).push(seg); return; }
      const parts = seg.split('-'); ax = t.axes.find((a) => a.many && parts.every((p) => a.values.some((v) => v.code === p)));
      if (ax) values[ax.key] = (values[ax.key] || []).concat(parts); else unknown.push(seg);
    });
    const missing = t.axes.filter((a) => a.required && a.values.length && !values[a.key]).map((a) => a.label);
    const words = t.axes.filter((a) => values[a.key]).map((a) => ({ axis: a.label, values: values[a.key].map((c) => (a.values.find((v) => v.code === c) || {}).name || c) }));
    return { code, kind: t.kind, type: t, values, words, unknown, missing, lib: t.kind === 'equipment' ? t.lib(values) : t.eq };
  }

  /* ── 7. Is this node the body of a unit process? ── */
  const GENERIC_TANK = ['OS_TANK', 'OS_TANK_DF', 'TANK', 'TANK_2', 'CP_TANK', 'OP_TANK', 'OVERHEAD_T'];
  const LABEL_RULES = [['sludge_holding', ['sludge holding']], ['filter_feed', ['filter feed']], ['filtered_water', ['filtered water']], ['treated_water', ['treated water', 'soft water']],
    ['equalization', ['equalization', 'equalisation', 'eqt']], ['collection', ['collection']], ['recirculation_holding', ['recirculation', 're-circulation']], ['anoxic_treatment', ['anoxic']],
    ['activated_sludge', ['aeration']], ['sbr', ['sbr']], ['oil_grease_removal', ['oil', 'grease', 'trap']]];
  const OLD_TYPE = { screening: 'screening', grit: 'grit_removal', 'oil-grease': 'oil_grease_removal', sump: 'collection', equalisation: 'equalization', 'flash-mixing': 'flash_mixing', flocculation: 'flocculation',
    daf: 'dissolved_air_flotation', 'activated-sludge': 'activated_sludge', sbr: 'sbr', cass: 'cass', mbbr: 'mbbr', anaerobic: 'anaerobic_treatment', mbr: 'mbr', clarification: 'clarification', 'tube-settling': 'tube_settling',
    'media-filtration': 'media_filtration', uf: 'ultrafiltration', ro: 'ro_desalination', softening: 'softening', cascade: 'cascade_aeration', uv: 'uv_disinfection', 'chlorine-contact': 'chlorination',
    'sludge-holding': 'sludge_holding', storage: 'treated_water', cooling: 'cooling' };
  const byCode = (code) => { if (!code) return null; if (upByExisting[code]) return { p: upByExisting[code], read: null }; if (W.DB_BY_CODE[code]) return null; const r = readCode(code); return r && r.kind === 'process' ? { p: r.type, read: r } : null; };
  /* → { p (the unit-process type), eq (the equipment type it is on its own), via, why, read } or null */
  function atomic(node, up) {
    if (!node) return null; const stored = node.equipmentType || node.code; const drawn = node.code; const label = String(node.label || '').toLowerCase();
    const dbName = (c) => (W.DB_BY_CODE[c] ? W.DB_BY_CODE[c].name : c);
    const own = (p, c) => (c && W.CATALOGUE_BY_CODE[c] && !W.CATALOGUE_BY_CODE[c].library && !GENERIC_TANK.includes(c) ? c : p.eq);
    if (upByKey[stored]) return { p: upByKey[stored], eq: upByKey[stored].eq, via: 'stored', why: 'Stored on the node as this unit process' };
    if (!GENERIC_TANK.includes(stored)) { const s = byCode(stored); if (s) return { p: s.p, eq: own(s.p, stored), via: 'code', why: `Its type, ${dbName(own(s.p, stored))}, is the centre of this step`, read: s.read }; }
    const tank = GENERIC_TANK.includes(stored) || GENERIC_TANK.includes(drawn);
    const rule = tank ? LABEL_RULES.find(([, words]) => words.some((w) => label.includes(w))) : null;
    if (rule) { const p = upByKey[rule[0]]; const w = rule[1].find((x) => label.includes(x)); return { p, eq: p.eq, via: 'label', why: `A tank whose name says “${w}”` }; }
    if (drawn !== stored && !GENERIC_TANK.includes(drawn)) { const d = byCode(drawn); if (d) return { p: d.p, eq: own(d.p, drawn), via: 'drawn', why: `Drawn as ${dbName(own(d.p, drawn))}, the centre of this step`, read: d.read }; }
    if (up && upByKey[up.typeId]) { const p = upByKey[up.typeId]; return { p, eq: tank ? p.eq : own(p, stored), via: 'position', why: up.why || 'Its place in the Visualization' }; }
    return null;
  }

  /* ── 8. Which library each such node is offered ── */
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
  function plan(model, struct) {
    if (!model) return []; const eqs = arr(model.equipment); const byId = {}; eqs.forEach((e) => { byId[e.id] = e; });
    const ups = {}; arr(struct && struct.ups).forEach((u) => { ups[u.id] = u; });
    const found = {}; eqs.forEach((e) => { const a = atomic(e, ups[e.id]); if (a) found[e.id] = a; });
    const near = {}; arr(model.links).forEach((l) => { const a = Array.isArray(l) ? l[0] : l && (l.from || l.source); const b = Array.isArray(l) ? l[1] : l && (l.to || l.target); if (!byId[a] || !byId[b] || a === b) return; (near[a] = near[a] || new Set()).add(b); (near[b] = near[b] || new Set()).add(a); });
    return eqs.filter((e) => found[e.id]).map((e) => {
      const a = found[e.id]; const u = ups[e.id];
      const members = u ? arr(u.members).filter((m) => byId[m.eqId]).map((m) => ({ eqId: m.eqId, tag: m.tag || byId[m.eqId].tag, role: m.role || '' }))
        : [...(near[e.id] || [])].filter((id) => !found[id]).map((id) => ({ eqId: id, tag: byId[id].tag, role: 'Piped to it' }));
      const proc = members.length > 0; const eqType = (W.CATALOGUE_BY_CODE[a.eq] || {}).type || a.eq;
      return { eqId: e.id, tag: e.tag, label: e.label, process: a.p.stored, processName: a.p.name, eq: a.eq, eqName: eqType, via: a.via, why: a.why, members, library: proc ? 'process' : 'equipment', code: proc ? a.p.stored : a.eq,
        typeName: proc ? a.p.name : eqType, reason: proc ? `${plural(members.length, 'piece')} of equipment ${members.length === 1 ? 'takes' : 'take'} part in it` : 'No other equipment takes part in it', ...(a.read ? { values: a.read.values, words: a.read.words } : {}) };
    });
  }
  /* writes the offer on each node (node.offer), and brings the plant's structure in line: one unit process per such node */
  function apply(model, struct) {
    if (!model) return []; const offers = plan(model, struct); const by = {}; offers.forEach((o) => { by[o.eqId] = o; });
    arr(model.equipment).forEach((e) => { const o = by[e.id]; if (o) e.offer = { code: o.code, library: o.library, process: o.process, eq: o.eq, via: o.via, why: o.why, reason: o.reason, members: o.members.length, ...(o.words ? { words: o.words } : {}) }; else delete e.offer; });
    if (struct) {
      offers.forEach((o) => {
        const p = upByKey[o.process]; let u = arr(struct.ups).find((x) => x.id === o.eqId);
        if (!u) { u = { id: o.eqId, tag: o.tag, name: o.label, why: o.why, members: o.members.map((m) => ({ eqId: m.eqId, tag: m.tag, role: m.role })) }; struct.ups.push(u); if (struct.state === 'none') struct.state = 'open'; }
        else if (u.typeId !== p.stored) u.why = o.why;
        u.typeId = p.stored; u.typeName = p.name; u.stage = p.group; u.stageLabel = p.groupLabel;
      });
      const placed = new Set(); arr(struct.ups).forEach((u) => { placed.add(u.id); arr(u.members).forEach((m) => placed.add(m.eqId)); });
      struct.unplaced = arr(struct.unplaced).filter((id) => !placed.has(id));
    }
    return offers;
  }

  /* ── 9. The structure the console already has, moved onto the 53 types ── */
  W.V7_STAGES = GROUPS.map((g) => ({ key: g.key, label: g.label })).concat([{ key: null, label: 'No stage' }]);
  W.V7_UP_TYPES = UP.map((p) => ({ id: p.stored, name: p.name, stage: p.group, code: p.code, node: p.eq, tank: p.tank, ...(p.subgroup ? { subgroup: p.subgroup } : {}) }));
  Object.values(W.V7_STRUCTURE || {}).forEach((st) => arr(st.ups).forEach((u) => { const p = upByKey[OLD_TYPE[u.typeId]] || upByKey[u.typeId]; if (!p) return; u.typeId = p.stored; u.typeName = p.name; u.stage = p.group; u.stageLabel = p.groupLabel; }));

  /* ── 10. Detection: an offered library wins; a new-style code is read to the library type it stands for ── */
  const det0 = W.detectDbType;
  W.detectDbType = function (node) {
    if (node && node.offer && W.CATALOGUE_BY_CODE[node.offer.code]) { const r = det0({ ...node, equipmentType: node.offer.code }); r.offer = node.offer; return r; }
    const stored = node && (node.equipmentType || node.code);
    if (stored && !W.DB_BY_CODE[stored]) { const p = readCode(stored); if (p && W.CATALOGUE_BY_CODE[p.lib]) { const r = det0({ ...node, equipmentType: p.lib }); r.read = { type: p.type.name, words: p.words, unknown: p.unknown, missing: p.missing }; return r; } }
    return det0(node);
  };

  /* the plant being set up gets the rule; the sample plants keep the types their records were made with */
  const PLANT = 'digitalpaani';
  if (W.SCADA_SAMPLES && W.SCADA_SAMPLES[PLANT]) apply(W.SCADA_SAMPLES[PLANT], W.V7_STRUCTURE && W.V7_STRUCTURE[PLANT]);

  /* ── 11. What a library page says about a type ── */
  const eqTypeOf = (code) => EQ.find((t) => t.code === code || t.existing.includes(code)) || null;
  function about(code) {
    const cat = W.CATALOGUE_BY_CODE[code]; if (!cat) return null;
    if (cat.library === 'process') { const p = upByKey[code]; return { library: 'process', name: cat.type, p, group: p.groupLabel, subgroup: p.subgroup || null, code: p.code, existing: p.existing, labels: p.labels, axes: p.axes, tank: p.tank, node: { code: p.eq, name: (W.CATALOGUE_BY_CODE[p.eq] || {}).type || p.eq }, sub: p.sub || null }; }
    const procs = UP.filter((p) => p.eq === code || p.existing.includes(code)); const t = eqTypeOf(code);
    const sets = t ? t.axes.map((a) => ({ axis: a.label, values: a.values.filter((v) => v.existing.includes(code)).map((v) => v.name) })).filter((x) => x.values.length) : [];
    return { library: 'equipment', name: cat.type, t, sets, processes: procs.map((p) => ({ key: p.stored, name: p.name })), added: cat.addedBy === 'taxonomy', copiedFrom: cat.copiedFrom ? (W.CATALOGUE_BY_CODE[cat.copiedFrom] || {}).type : null };
  }

  W.V7NODES = { EQ, UP, GROUPS, PLANT, readCode, atomic, plan, apply, about, upByKey, eqTypeOf, GENERIC_TANK, LABEL_RULES };
}());
