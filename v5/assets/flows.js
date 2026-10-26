/* The flows and root-cause library, for the database's equipment types. Loaded after data.js and catalogue.js; replaces
   SEED.flows and SEED.causes and binds flows to the library's standard sets, so every plant inherits them.

   Two flow kinds (PRD §7.1): a DIAGNOSTIC flow asks questions until it reaches a root cause on a subject; an ACTION flow is
   the numbered sequence that does the work — what a task runs, and what a cause nominates as its fix. A flow is written for
   database equipment types (forTypes), or for the plant as a whole (forStage 'plant'). A root cause is estate-wide vocabulary
   for equipment types (types), the plant (plant: true) or any equipment (anyType: true), never one machine (PRD §7.4).
   A scheduled task carries a preassigned cause: the failure the work prevents (PRD §5.9).

   Every flow here reads only what is on the equipment: a reading step bound to a machine's reading names an on-equipment
   reading; a pipe gauge or a lab test is typed by hand. Diagnostics for alerts that wait for connections are kept apart in
   NEXT_PHASE_FLOWS (not installed): f_blower_press, f_turb, f_screen_dh, f_mgf_dp, f_uf, f_ro, f_frc, f_gas_frc,
   f_compressor, f_ct, the turbidity calibration f_turb_cal, and the dose adjustment f_dose_adjust they lead to; with them the
   two plant-wide diagnostics, f_odour and f_effluent, which only a plant alert (on the plant's inlet or outlet) could open.
   The causes only those diagnostics reach are kept apart too, in NEXT_PHASE_CAUSES. Nothing installed is out of reach: every
   installed cause is reached by an installed diagnostic or named by a library item. Dropped with their v1 types or splits:
   f_orp, f_sht_level, f_anoxic_check, f_recycle_adjust, f_sludge_transfer, f_blower_changeover, f_stage_wear; merged:
   f_surface_pump_pm and f_monobloc_pm into f_pump_pm, f_dosing_pump_service into f_dosing_pump_pm, f_hypo_refill into
   f_chem_refill. The plant rounds type every number by hand. */
(function () {
  'use strict';
  /* database equipment types, by the families the flows are written for */
  const AER = ['Diffuser Tank', 'SBR', 'Cass Basin'];
  const TANKS = ['Tank', 'Tank 2', 'Open Process Tank', 'Closed Process Tank', 'Overhead Tank'];
  const OPEN = ['Open Skeleton Tank', 'Submersible Tank'];
  const SCREENS = ['Mechanical Screen', 'Rotary Drum', 'Screen Chamber Tank'];
  const DRIVES = ['Mechanical Screen', 'Rotary Drum'];
  const BLOWERS = ['Blower', 'Mini Blower'];
  const PUMPS = ['Pump', 'Submersible Pump', 'Booster Pump'];
  const MIXERS = ['Agitator', 'Flash Mixer', 'Flocculation'];
  const SETTLE = ['Clarifier Tank', 'Tube settler'];
  const PRESSES = ['Screw Press', 'Filter Press'];
  const DEVICES = ['Sabre', 'Small Sabre', 'Bio Health Tracker'];
  const VALVES = ['Two way Valve', 'Three way Valve'];
  const ROTATING = [...BLOWERS, ...PUMPS, ...MIXERS, ...DRIVES, 'Motor', 'Screw Press', 'Dissolved Air Floatation', 'Air Compressor', 'Grit Classifier', 'Cavitator', 'Clarifier Tank', 'Cooling Tower'];

  /* ── 1. Root causes ──────────────────────────────────────────────────────────────────────────
     types: the equipment types it can be diagnosed on. plant: it can also be about the plant as a whole. anyType: any
     equipment can land on it. fix: the action flow that resolves it. sensorFault: closes the record as a sensor fault,
     never counted as a plant failure. noFault: nothing was wrong. */
  const RC = (id, name, types, fix, extra) => Object.assign({ id, name, types, fix: fix || null }, extra || {});
  const PLANT = { plant: true }, ANY = { anyType: true };
  const CAUSES = [
    /* screens, grit and the inlet */
    RC('c_screen', 'Screen choked', SCREENS, 'f_screen'),
    RC('c_rake_drive', 'Screen drive fault or chain jammed', DRIVES, 'f_screen_drive'),
    RC('c_grit_full', 'Grit chamber full', ['Grit Chamber'], 'f_grit_remove'),
    /* pumps: every pump type can land on the generic pump causes */
    RC('c_rag_wrap', 'Rags wrapped on the impeller', [...PUMPS, ...MIXERS], 'f_pump_lift'),
    RC('c_pump_seal', 'Mechanical seal failure', PUMPS, 'f_pump_lift'),
    RC('c_pump_airlock', 'Air lock or lost prime', PUMPS, 'f_pump_prime'),
    RC('c_cutter_worn', 'Cutter ring worn, rags passing', ['Submersible Pump'], 'f_pump_lift'),
    RC('c_level_switch', 'Level float stuck', ['Submersible Pump', ...OPEN], 'f_float_check'),
    RC('c_stator', 'Pump stator worn', ['Pump'], 'f_pc_pump_pm'),
    /* tanks */
    RC('c_flood_inflow', 'Inflow more than the pumps can take away', [...OPEN, ...TANKS, 'Oil & Grease Tank'], 'f_surge_mgmt'),
    RC('c_mixer_off', 'Agitator stopped, tank stratified', [...MIXERS, 'Open Skeleton Tank'], 'f_mixer_restart'),
    RC('c_ph_shock', 'Acid or alkali shock load from upstream', ['Open Skeleton Tank'], 'f_ph_corr'),
    RC('c_skimmer', 'Skimmer belt slipping or torn', ['Oil & Grease Tank'], 'f_ogt_pm'),
    RC('c_grease_full', 'Grease trap full, oil carrying over', ['Oil & Grease Tank'], 'f_ogt_desludge'),
    /* blowers, motors and aeration */
    RC('c_blower_off', 'Blower not running', [...BLOWERS, ...AER, 'MBBR'], 'f_motor_trip'),
    RC('c_intake', 'Intake filter blocked', [...BLOWERS, 'Air Compressor'], 'f_blower'),
    RC('c_belt', 'Belt slipping or worn', BLOWERS, 'f_blower_pm'),
    RC('c_bearing_wear', 'Bearing wear', ROTATING, 'f_motor_pm'),
    RC('c_trip', 'Motor overload trip', [...BLOWERS, ...PUMPS, ...MIXERS, ...DRIVES, 'Motor', 'Screw Press', 'Cavitator'], 'f_motor_trip'),
    RC('c_diffuser', 'Diffuser fouling', [...AER, 'MBBR', 'MBR', 'Open Skeleton Tank'], 'f_diffuser_clean'),
    RC('c_bulking', 'Filamentous sludge bulking', [...AER, ...SETTLE], 'f_bulking_control'),
    RC('c_underaer', 'Under-aeration: load more than the blowers can give', [...AER, 'MBBR'], 'f_blower_step_up', PLANT),
    RC('c_overload', 'Organic shock load', [...AER, 'MBBR', 'Anaerobic Tank'], 'f_shock_load', PLANT),
    RC('c_mlss_high', 'Too little sludge wasted', [...AER, 'Clarifier Tank'], 'f_sludge'),
    RC('c_mlss_low', 'Biomass washout, too much sludge wasted', AER, 'f_sludge_reduce', PLANT),
    RC('c_foam', 'Nocardia foaming', [...AER, 'MBBR'], 'f_foam_control'),
    RC('c_temp_high', 'High mixed-liquor temperature from the inflow', AER, null),
    RC('c_media_loss', 'MBBR media carried over or retention screen blocked', ['MBBR'], 'f_mbbr_media'),
    RC('c_anaerobic_souring', 'Digester souring, alkalinity lost', ['Anaerobic Tank'], 'f_digester_alk'),
    /* settling, flotation and membranes */
    RC('c_fouling', 'Membrane fouling', ['MBR'], 'f_cip'),
    RC('c_blanket', 'Return sludge rate too low', SETTLE, 'f_ras_adjust', PLANT),
    RC('c_scraper', 'Scraper drive stalled', ['Clarifier Tank'], 'f_scraper_pm'),
    RC('c_denit_float', 'Denitrification lifting sludge', SETTLE, 'f_ras_adjust'),
    RC('c_tube_clog', 'Tube settler modules clogged', ['Tube settler'], 'f_tube_clean'),
    RC('c_daf_saturator', 'DAF saturator or air injection failed', ['Dissolved Air Floatation'], 'f_daf_pm'),
    /* filters */
    RC('c_media_choked', 'Filter media choked, backwash overdue', ['ACF/MGF'], 'f_backwash'),
    RC('c_uf_fouling', 'UF membrane fouling', ['UF Membrane'], 'f_uf_cip'),
    RC('c_ro_scaling', 'RO scaling, antiscalant under-dosed', ['RO'], 'f_ro_cip'),
    RC('c_cartridge', 'Cartridge filter exhausted', ['Cartridge Filter', 'RO'], 'f_cartridge_replace'),
    RC('c_softener_exhaust', 'Softener resin exhausted', ['Softner'], 'f_softener_regen'),
    /* dosing and disinfection */
    RC('c_dosing_pump', 'Dosing pump lost prime or diaphragm failed', ['Dosing Pump'], 'f_dosing_pump_pm'),
    RC('c_dose_drift', 'Dosing pump stroke drifted off its setting', ['Dosing Pump'], 'f_dose_cal'),
    RC('c_uv_lamp', 'UV lamp at end of life or sleeve fouled', ['UV'], 'f_uv_lamp'),
    RC('c_ozone_trip', 'Ozonator tripped on dew point', ['Ozonator'], 'f_ozone_reset'),
    RC('c_tonner_empty', 'Chlorine tonner empty', ['Gas Tonner'], 'f_tonner_change'),
    RC('c_cl_leak', 'Chlorine leak at the tonner valve or yoke', ['Gas Tonner'], 'f_cl_leak'),
    /* sludge */
    RC('c_poly_dose', 'Polymer dose wrong, poor flocculation', PRESSES, 'f_poly_jar_test'),
    RC('c_screen_blind', 'Press screen blinded', ['Screw Press'], 'f_press_wash'),
    RC('c_cloth', 'Filter cloth blinded or torn', ['Filter Press'], 'f_cloth_change'),
    RC('c_sludge_thin', 'Feed sludge too thin', PRESSES, 'f_sludge'),
    /* utilities and the newer types */
    RC('c_compressor_leak', 'Air leak, compressor cannot hold pressure', ['Air Compressor'], 'f_compressor_pm'),
    RC('c_ct_scale', 'Cooling tower fill scaled', ['Cooling Tower'], 'f_ct_clean'),
    RC('c_valve_stuck', 'Valve stuck or not seating', VALVES, 'f_valve_stroke'),
    RC('c_cyclone_wear', 'Cyclone apex or liner worn', ['Hydro Cyclone'], 'f_cyclone_check'),
    RC('c_evaporator_scale', 'Evaporator heating surface scaled', ['QUADSON EVAPORATOR'], 'f_evaporator_clean'),
    /* any equipment */
    RC('c_mcc_trip', 'Incomer trip or phase loss at the MCC', [], 'f_mcc_reset', ANY),
    RC('c_probe', 'Probe drift — needs calibration', [], null, { anyType: true, sensorFault: true }),
    RC('c_probe_fouled', 'Probe fouled — needs cleaning', [], 'f_probe_clean', { anyType: true, sensorFault: true }),
    RC('c_power', 'Power failure or DG changeover', [], 'f_power_restore', ANY),
    RC('c_valve_closed', 'Isolation valve left closed', [], 'f_valve_check', ANY),
    RC('c_dosing_empty', 'Chemical tank empty', ['Dosing Tank', 'Dosing Pump'], 'f_chem_refill', ANY),
    RC('c_no_fault', 'No fault found, reading verified normal', [], null, { anyType: true, noFault: true }),
  ];
  /* Next phase: causes only the next-phase diagnostics reach (an outlet, a line or a pressure across two connections shows
     them). Not installed; kept with NEXT_PHASE_FLOWS. */
  const NEXT_CAUSES = [
    RC('c_surge', 'Hydraulic surge at the inlet', [...OPEN, 'Screen Chamber Tank'], 'f_surge_mgmt', PLANT),
    RC('c_toxic', 'Toxic inhibition, nitrification lost', [...AER, 'MBBR'], 'f_shock_load', PLANT),
    RC('c_seal', 'Membrane seal or fibre breach', ['MBR'], null),
    RC('c_weir_uneven', 'Weir out of level, short-circuiting', ['Clarifier Tank'], null),
    RC('c_mudball', 'Mud balls or media loss', ['ACF/MGF'], 'f_media_inspect'),
    RC('c_backwash_valve', 'Backwash valves not sequencing', ['ACF/MGF', 'UF Membrane', ...VALVES], 'f_valve_check'),
    RC('c_uf_fibre', 'UF fibre breakage', ['UF Membrane'], null),
    RC('c_ro_biofoul', 'RO biofouling', ['RO'], 'f_ro_cip'),
    RC('c_feed_pump', 'Feed pump under-delivering', ['Pump', 'Submersible Pump', 'UF Membrane'], 'f_pump_lift'),
    RC('c_hypo_degraded', 'Hypochlorite strength lost to heat or age', ['Dosing Pump', 'Dosing Tank'], 'f_chem_refill'),
    RC('c_cl_demand', 'Chlorine demand up: ammonia or organics in the outlet', ['Dosing Pump', 'Gas Tonner'], 'f_dose_adjust', PLANT),
    RC('c_sludge_hold', 'Sludge held too long before dewatering', PRESSES, 'f_sludge', PLANT),
  ];
  window.NEXT_PHASE_CAUSES = NEXT_CAUSES;

  /* ── 2. Action flows ─────────────────────────────────────────────────────────────────────────
     A compact line per step: plain text = instruction · '!' photo required · '*' photo optional ·
     '^' a Lead signs this step · '?' a yes/no the operator records · '#Kind|' a reading bound to the
     machine's reading of that kind at inheritance (on-equipment readings only) · '#|' a number typed by hand ·
     '~N|' a wait of N min. use: pm · fix · round · calibration (how the Flows page groups them). */
  const parseStep = (s, i) => { const st = { id: i + 1, type: 'instruction', text: s }; const m = s.match(/^([!*^?#~])(.*)$/); if (!m) return st; const rest = m[2]; if (m[1] === '!') { st.text = rest; st.photo = 'required'; } else if (m[1] === '*') { st.text = rest; st.photo = 'optional'; } else if (m[1] === '^') { st.text = rest; st.approve = true; } else if (m[1] === '?') { st.type = 'question'; st.text = rest; } else if (m[1] === '#') { st.type = 'reading'; const [kind, text] = rest.split('|'); st.sensorKind = kind || null; st.text = text; } else if (m[1] === '~') { st.type = 'wait'; const [n, text] = rest.split('|'); st.minutes = +n; st.text = text; } return st; };
  const A = (id, name, forTypes, use, steps, extra) => Object.assign({ id, name, kind: 'action', forTypes, forStage: null, use, version: 1, status: 'published', steps: steps.map(parseStep) }, extra || {});
  const P = { forStage: 'plant' };
  const ACTION = [
    /* blowers and aeration */
    A('f_blower', 'Blower inspection and intake filter clean', BLOWERS, 'fix', ['!Stop the blower and lock out at the MCC', 'Remove and inspect the intake filter', '?Is the filter element clean?', 'Clean with compressed air, or fit the spare element', 'Check belt tension by hand: 10 mm deflection, no glazing', '#Motor current|Restart and record the motor current', '!Remove the lock-out and confirm the blower is running'], { version: 3 }),
    A('f_blower_pm', 'Blower bearing and belt service', BLOWERS, 'pm', ['!Isolate at the MCC, lock out, hang the tag', 'Grease both bearings: 2 pumps each, wipe the excess', 'Check belt tension and alignment; replace a cracked or glazed belt', 'Check the coupling and the anti-vibration mounts', 'Clean the intake filter and the silencer', '#|Restart and record the discharge pressure from the gauge on the blower (bar)', '^Hand back to service; the Lead signs off'], { version: 2 }),
    A('f_blower_step_up', 'Raise aeration one step and re-read DO', [...AER, 'MBBR'], 'fix', ['Raise the blower output one step at the panel, or open the header valve one turn', '~20|Let the basin respond', '#Dissolved oxygen|Re-read DO at the probe location', '?Is DO back above 2 mg/L?', 'If not, start another blower if one is free and tell the Lead: the load may be more than the blowers can give'], { version: 2 }),
    A('f_motor_trip', 'Overload trip: inspect and reset', [...BLOWERS, ...PUMPS, ...MIXERS, ...DRIVES, 'Motor', 'Screw Press', 'Cavitator'], 'fix', ['!Lock out at the MCC before touching the machine', 'Turn the shaft by hand; it must move freely without a grinding noise', 'Check the motor for heat, smell and water ingress', '?Did the shaft turn freely and the motor look sound?', 'Reset the overload relay once only; a second trip is a repair, not a reset', '#Motor current|Restart and record the current for two minutes']),
    A('f_diffuser_clean', 'Diffuser inspection and acid clean', [...AER, 'MBBR', 'MBR', 'Open Skeleton Tank'], 'pm', ['Drop the tank level or isolate the grid to be inspected', '!Photograph the bubble pattern before cleaning', 'Inspect diffuser membranes for tearing, bulging and scale', 'Dose formic acid into the air line per the manufacturer card; keep air on', '~30|Let the acid work through the membranes', '!Return to level and photograph the bubble pattern after cleaning', '^Record membranes replaced; the Lead signs off']),
    A('f_bulking_control', 'Filamentous bulking control', AER, 'fix', ['Take a 1 L sample and run the SV30 test', '#|Record the SV30 settled volume (mL/L)', 'Check F:M: reduce wasting if MLSS is low, raise it if high', 'Dose hypochlorite to the return sludge line at 2 to 3 kg Cl₂ per tonne MLSS per day; never to the basin', '~1440|Hold the dose for one day', '#|Re-run SV30 and record the settled volume', '^The Lead decides whether to continue or stop']),
    A('f_shock_load', 'Shock load response', [...AER, 'MBBR'], 'fix', ['Divert or hold the inflow in the equalisation tank where possible', 'Start every free blower and run them until DO recovers', 'Stop sludge wasting for 24 hours', '#Dissolved oxygen|Record DO every 2 hours until it holds above 2 mg/L', '^Tell the Lead and the client; they decide on sampling the source'], { version: 2 }),
    A('f_foam_control', 'Foam control: skim and antifoam', [...AER, 'MBBR'], 'fix', ['!Photograph the foam colour and depth', 'Skim the foam to the scum pit; do not return it to the basin', 'Spray antifoam at the foaming corner only, as per the dosing card', 'Raise wasting for three days to bring the sludge age down']),
    A('f_sludge', 'Sludge wasting', ['Pump', ...AER, 'Clarifier Tank'], 'round', ['Check the sludge holding tank has room', 'Open the WAS valve and start the pump', '~20|Run for 20 minutes', '#Run hours|Record the pump run hours', 'Close the valve and log the volume wasted']),
    A('f_sludge_reduce', 'Reduce wasting and rebuild MLSS', AER, 'fix', ['Halve the daily wasting time for one week', '#MLSS|Record MLSS daily', 'Return to normal wasting when MLSS is back in band']),
    A('f_mbbr_media', 'MBBR media retention screen clear', ['MBBR'], 'pm', ['!Lock out the blower and photograph the screen', 'Clear media and rags from the retention screen by hand', 'Check media is circulating evenly across the tank', 'Restart aeration and confirm the rolling pattern']),
    A('f_digester_alk', 'Digester alkalinity correction', ['Anaerobic Tank'], 'fix', ['Reduce the feed rate by half', 'Dose sodium bicarbonate per the dosing card', '~720|Let the digester recover', '#pH|Record pH and resume feed when above 6.8']),
    A('f_desludge', 'Digester desludging', ['Anaerobic Tank'], 'pm', ['Confirm the sludge tanker or drying bed has capacity', '!Open the bottom drain and photograph the sludge consistency', '~60|Drain to the marked level', 'Close the drain and flush the line', '^Log the volume removed; the Lead signs off']),
    A('f_sv30', 'SV30 settling test', AER, 'round', ['Fill the settling cone to 1 litre from the aeration tank', '~30|Let the sludge settle', '#|Record the settled volume (mL/L)', '?Is the water above the sludge clear?']),
    /* settling, flotation and membranes */
    A('f_cip', 'MBR clean in place', ['MBR'], 'pm', ['Isolate the skid and drain the membrane tank', '!Prepare 500 ppm hypochlorite solution; gloves and goggles on', 'Backpulse the solution into the modules', '~60|Soak for 60 minutes', 'Drain to the EQ tank and rinse with permeate', '#|Record permeability after the clean (LMH/bar)', '^Return to service; the Lead signs off'], { version: 3 }),
    A('f_ras_adjust', 'Return sludge rate adjustment', SETTLE, 'fix', ['#Sludge blanket|Record the blanket depth now', 'Raise the RAS pump rate one step, or start the second RAS pump', '~120|Let the blanket respond', '#Sludge blanket|Re-read the blanket depth', '?Is the blanket back below 1 m?']),
    A('f_scraper_pm', 'Clarifier scraper drive service', ['Clarifier Tank'], 'pm', ['!Lock out the scraper drive', 'Check gearbox oil level and top up', 'Grease the centre bearing and the drive chain', 'Inspect the scraper blades and the squeegees for wear', '^Restart and confirm one full revolution without binding']),
    A('f_tube_clean', 'Tube settler module cleaning', ['Tube settler'], 'pm', ['Lower the water level below the tube modules', '!Photograph the modules before cleaning', 'Hose the modules from above until the tubes run clear', 'Check modules for sagging or broken tubes', 'Refill slowly and confirm even flow over the launders']),
    A('f_daf_pm', 'DAF saturator and scraper service', ['Dissolved Air Floatation'], 'pm', ['!Lock out the recycle pump and the scraper', 'Drain and inspect the saturator vessel; clear scale from the injection nozzle', 'Check the air regulator and the pressure gauge', 'Grease the scraper drive and check the flights', '#Motor current|Restart and record the scraper current']),
    A('f_uf_cip', 'UF chemically enhanced backwash', ['UF Membrane'], 'pm', ['Isolate the skid and run a normal backwash', '!Prepare the hypochlorite solution; gloves and goggles on', 'Backwash the solution into the modules and close the valves', '~30|Soak for 30 minutes', 'Flush to drain until residual chlorine is below 0.2 mg/L', '#|Return to production and record the recovery (%)', '^The Lead signs off'], { version: 2 }),
    A('f_ro_cip', 'RO membrane clean in place', ['RO'], 'pm', ['Shut down and flush with permeate', 'Prepare the low-pH clean (citric) to the card strength', 'Circulate for 30 minutes, then soak', '~60|Soak for one hour', 'Flush, then repeat with the high-pH clean if biofouling is suspected', '#|Return to service and record the recovery (%)', '^The Lead signs off'], { version: 2 }),
    /* filters */
    A('f_backwash', 'Backwash filter', ['ACF/MGF'], 'round', ['Close the inlet valve', 'Open the backwash valve and start the backwash pump', '~8|Backwash for 8 minutes', 'Rinse to drain for 4 minutes', '#|Record the pressure difference across the filter from its gauges after rinse (bar)', '*Return the filter to service'], { version: 4 }),
    A('f_media_inspect', 'Filter media inspection and top-up', ['ACF/MGF'], 'pm', ['Drain the filter to 10 cm above the media', '!Photograph the media surface: cracks, mud balls, uneven bed', 'Rake the top 5 cm and remove mud balls', 'Top up media to the marked level if it has dropped', 'Run two backwashes before returning to service']),
    A('f_valve_check', 'Valve line-up check', [], 'fix', ['Walk the line from source to destination and check every valve position against the P&ID card', '!Photograph any valve found in the wrong position', 'Set each valve correctly and confirm flow', 'Log who last operated the valve, if known']),
    A('f_cartridge_replace', 'Cartridge replacement', ['Cartridge Filter', 'RO'], 'pm', ['Isolate the housing and vent the pressure', '!Open the housing and photograph the old cartridges', 'Fit new cartridges; check the O-ring seats', '#|Return to service and record the pressure difference across the housing (bar)'], { version: 2 }),
    A('f_softener_regen', 'Softener regeneration', ['Softner'], 'fix', ['Check brine tank salt level; top up to the mark', 'Start the regeneration cycle from the controller', '~90|Let the cycle complete', 'Rinse until the outlet runs clear of brine', '#|Record outlet hardness (ppm as CaCO₃)', 'Reset the throughput counter']),
    A('f_brine_topup', 'Brine tank salt top-up', ['Softner'], 'round', ['Check the salt level in the brine tank against the mark', 'Top up with softener salt to the mark; break any salt bridge with a rod', '?Is there water at the bottom of the brine tank, under the salt?', '#|Record the salt added (kg)']),
    /* dosing and disinfection */
    A('f_dosing_pump_pm', 'Dosing pump diaphragm and check-valve service', ['Dosing Pump'], 'pm', ['!Isolate the suction and discharge valves; depressurise and drain the head', 'Replace the diaphragm and the suction and discharge valve balls', 'Clean the foot valve, the strainer and the injection quill', 'Re-prime against a full tank and check for leaks at the head', '#|Run a drawdown test and record the dose rate (L/h)']),
    A('f_dose_cal', 'Dose rate calibration by drawdown', ['Dosing Pump'], 'calibration', ['Fill the calibration column and open it to the pump suction', '~2|Run the pump for two minutes at its normal stroke', '#|Record the volume drawn down and the dose rate it gives (L/h)', 'Set the stroke to bring the rate back to the dosing card', '#|Repeat the drawdown and record the rate after adjustment']),
    A('f_chem_refill', 'Chemical tank refill', ['Dosing Tank', 'Dosing Pump'], 'round', ['!Gloves, goggles and apron on; check the chemical label matches the tank', 'For hypochlorite, check the drum date: older than 30 days has lost strength', 'Transfer with the drum pump, never by pouring; never mix chemicals in one tank', '#|Record the tank level after filling (%)', 'Prime the dosing pump and check for leaks'], { version: 2 }),
    A('f_poly_refill', 'Poly tank make-up', PRESSES, 'round', ['!Gloves and goggles on; check the polymer grade matches the dosing card', 'Fill the make-up tank to the mark and start the agitator', 'Add polymer slowly into the vortex; never in one lump', '~30|Let it age before dosing', '*Photograph the solution: no fish-eyes, no lumps']),
    A('f_uv_lamp', 'UV lamp and sleeve replacement', ['UV'], 'pm', ['!Switch off, lock out and let the lamps cool for 10 minutes', 'Withdraw the lamp and the quartz sleeve', 'Clean the sleeve with the descaler, or replace it if etched', 'Fit the new lamp with gloves; never touch the glass', 'Reset the lamp-hours counter', '#UV intensity|Restart and record the intensity reading', '^The Lead signs off']),
    A('f_ozone_reset', 'Ozonator reset and air dryer check', ['Ozonator'], 'fix', ['Check the air dryer dew point and drain the moisture trap', 'Reset the dew-point trip', 'Restart and watch the ozone output for five minutes', 'If it trips again, raise a repair issue']),
    A('f_ozone_pm', 'Ozonator generator service', ['Ozonator'], 'pm', ['!Lock out the generator and the oxygen or air supply', 'Replace the air dryer desiccant and the filters', 'Check the cooling water flow and the dielectric cells', '^Restart and confirm output; the Lead signs off']),
    A('f_tonner_change', 'Chlorine tonner change', ['Gas Tonner'], 'round', ['!Two people, canister masks on, ammonia bottle ready for leak check', 'Close the tonner valve and let the chlorinator draw the line down', 'Disconnect the yoke and cap the empty tonner', 'Connect the full tonner with a new lead gasket', '!Open the valve a quarter turn and leak-check with the ammonia bottle', '#Tonner net weight|Record the net weight of the new tonner on the scale', '^The Lead signs off'], { version: 2 }),
    A('f_cl_leak', 'Chlorine leak response', ['Gas Tonner'], 'fix', ['!Canister mask on before going in; keep everyone else out and upwind', 'Close the tonner valve, with a second person standing by outside', '?Has the leak alarm cleared since the valve was closed?', 'Find the leak with the ammonia bottle: white smoke shows the point', 'Replace the lead gasket or reseat the yoke; never hammer a tonner valve', '^Tell the Lead; the Lead signs off before chlorination restarts']),
    A('f_ph_corr', 'pH correction dosing', ['Open Skeleton Tank'], 'fix', ['Confirm the dosing pump is primed', '#pH|Read pH at the tank', 'Adjust the dosing rate one increment', '~15|Let the tank mix before re-reading', '#pH|Re-read pH and confirm it is trending back'], { version: 2 }),
    A('f_mixer_restart', 'Agitator restart and inspection', [...MIXERS, 'Open Skeleton Tank'], 'fix', ['!Lock out and check the propeller for rags', 'Turn the shaft by hand', 'Reset and restart from the panel', '#Motor current|Record the current for two minutes']),
    /* screens, grit and the inlet */
    A('f_screen', 'Clear the screen', SCREENS, 'fix', ['Stop the rake or the drum and lock out', '!Rake screenings by hand into the skip', '?Is the water level the same on both sides of the screen after clearing?', 'Restart and confirm free travel'], { version: 3 }),
    A('f_screen_inspect', 'Screen inspection', SCREENS, 'round', ['?Is the rake or the drum cycling and discharging into the skip?', '*Check the bar spacing or the drum mesh for lodged debris', '?Is the water level the same on both sides of the screen?', 'Empty the screenings skip if more than half full'], { version: 2 }),
    A('f_screen_drive', 'Screen drive service', DRIVES, 'pm', ['!Lock out the screen drive', 'Check chain tension and sprocket wear; grease the chain', 'Check the limit switches and the torque trip', 'Inspect the rake teeth, the drum brushes and the wiper', '^Restart and confirm three full cycles']),
    A('f_grit_remove', 'Grit removal', ['Grit Chamber'], 'round', ['Isolate the chamber and drain to the grit level', '!Remove grit to the skip; photograph the fill level', 'Hose down and return to service']),
    A('f_inlet_round', 'Screenings and grit check', [...SCREENS, 'Grit Chamber'], 'round', ['?Is the rake cycling and the channel clear?', '#|Record the screenings bins removed since the last round', '*Check the grit chamber fill and photograph if above the mark']),
    A('f_surge_mgmt', 'Hydraulic surge management', OPEN, 'fix', ['Open the bypass to the equalisation tank, or throttle the inlet gate', 'Start a second transfer pump if one is free', '#Level|Record the tank level every 30 minutes until it falls', 'Tell the Lead if the level is still rising after two hours'], { version: 2 }),
    /* pumps */
    A('f_pump_lift', 'Pump lift and inspect', ['Submersible Pump'], 'pm', ['!Isolate at the MCC, lock out, and close the delivery valve', 'Lift the pump on the guide rails; two people', '!Clear rags from the impeller and photograph the impeller and the volute', 'Check the cable gland and the seal chamber oil for water', 'Grease or replace the seal per the card', 'Lower the pump and confirm it seats on the pedestal', '#Motor current|Restart and record the current']),
    A('f_pump_prime', 'Pump priming and air release', PUMPS, 'fix', ['Stop the pump', 'Open the air release valve on the delivery until water runs', 'Restart and confirm delivery at the outfall', '#Motor current|Record the running current']),
    A('f_float_check', 'Level float check', ['Submersible Pump', ...OPEN], 'fix', ['Lift the float and confirm the pump starts', 'Clear rags from the float cable', '!Photograph the float position at the correct level']),
    A('f_pump_pm', 'Pump seal, bearing and coupling check', ['Pump', 'Booster Pump'], 'pm', ['!Isolate at the MCC, lock out, and close the suction and delivery valves', 'Check the gland or mechanical seal: a steady drip means a seal change', 'Grease the bearings; turn the shaft by hand and listen for roughness', 'If the pump has a coupling, check its alignment with a straight edge and replace worn rubber inserts', 'Check the foundation bolts and the base plate for looseness', '#Motor current|Open the valves, restart and record the running current', '^Hand back to service; the Lead signs off']),
    A('f_pc_pump_pm', 'Screw pump stator and rotor check', ['Pump'], 'pm', ['!Isolate, lock out and drain the pump casing', 'Open the stator housing and check the stator for swelling and wear', 'Check the rotor and the coupling rod joints', 'Reassemble and grease the joints', '#Run hours|Restart and record the run hours']),
    A('f_motor_pm', 'Motor insulation and bearing check', ROTATING, 'pm', ['!Isolate at the MCC, lock out, and hang the tag', 'Turn the shaft by hand: it must move freely, without grinding', 'Grease the motor bearings; wipe the excess', '#|Measure insulation resistance with the megger and record it (MΩ)', 'Clean the cooling fins and the fan cover', '#Motor current|Restart and record the running current']),
    /* oil and grease tank */
    A('f_ogt_round', 'Oil removal round', ['Oil & Grease Tank'], 'round', ['Run the skimmer and watch the belt: oil must wipe off into the trough', 'Drain the oil trough into the waste-oil drum', '*Photograph the surface: no sheen left behind', '#|Record the oil removed (L)']),
    A('f_ogt_pm', 'Skimmer belt and scraper check', ['Oil & Grease Tank'], 'pm', ['!Lock out the skimmer drive', 'Check the belt for fraying and the wiper blades for wear; replace as found', 'Check the drive gearbox oil and the belt tension', 'Check the baffles and the T-separator are in place', '^Restart and confirm the belt tracks straight']),
    A('f_ogt_desludge', 'Grease trap desludging', ['Oil & Grease Tank'], 'pm', ['Confirm the tanker or the sludge pit has capacity', '!Drain the trap and photograph the sludge depth', 'Remove the settled sludge and the grease crust from each partition', 'Hose down and refill', '^Log the volume removed; the Lead signs off']),
    /* fixed units, mixers and grit */
    A('f_cascade_clean', 'Cascade aerator steps cleaning', ['Cascade Aerator'], 'pm', ['Divert or stop the feed for the duration', '!Photograph the steps: algae, slime and scale', 'Brush and hose every step and the collection channel', 'Check the weir edges are level and unbroken', 'Return the feed and confirm an even sheet of water over every step']),
    A('f_static_mixer', 'Static mixer element inspection', ['Static Mixer'], 'pm', ['!Isolate and drain the line', 'Open the mixer and inspect the elements for scale, rags and erosion', 'Clean or replace the elements; check the dosing quill is clear', 'Close up with a new gasket and return to service']),
    A('f_floc_pm', 'Flocculator gearbox and paddle check', ['Flocculation'], 'pm', ['!Lock out the drive', 'Check gearbox oil level and top up; grease the shaft bearings', 'Lower the tank and inspect the paddles and the shaft for wear and bent arms', '#Motor current|Restart and record the current', '^The Lead signs off']),
    A('f_gearbox_pm', 'Gearbox and bearing service', ['Agitator', 'Flash Mixer'], 'pm', ['!Lock out the drive', 'Check gearbox oil level and top up', 'Grease the bearings', '#Motor current|Restart and record the current']),
    A('f_classifier_pm', 'Classifier screw and gearbox check', ['Grit Classifier'], 'pm', ['!Lock out the classifier drive', 'Check gearbox oil level and top up', 'Inspect the screw flights and the trough liner for wear', 'Grease the bottom bearing', 'Restart and confirm grit is discharging into the skip']),
    A('f_cyclone_check', 'Cyclone apex and liner check', ['Hydro Cyclone'], 'pm', ['Isolate the feed and drain the cyclone', '!Open the apex and photograph the apex insert and the liner', 'Replace the apex insert if it is worn oval or chipped', 'Clear any blockage from the overflow and the underflow', 'Return the feed and confirm a steady spray from the underflow']),
    A('f_cavitator_pm', 'Cavitator service', ['Cavitator'], 'pm', ['!Lock out the cavitator and its feed pump', 'Open the cavitation chamber and inspect the nozzles or the orifice plate for wear and scale', 'Clean or replace the nozzles as found', 'Check the seals and the gauge on the unit', '#Run hours|Restart and record the run hours']),
    /* sludge */
    A('f_poly_jar_test', 'Polymer dose jar test', PRESSES, 'fix', ['Take 1 L of feed sludge in a jar', 'Add polymer in steps and stir; note the dose where flocs form and water clears', '#|Record the best dose (kg polymer per tonne dry solids)', 'Set the polymer pump to the new dose', '*Photograph the cake at the new dose']),
    A('f_press_wash', 'Screw press screen wash', ['Screw Press'], 'pm', ['!Stop the press and lock out', 'Run the screen wash cycle twice', 'Open the covers and hose the screen until the slots run clear', 'Check the screw flights for wear', '^Restart and confirm cake forming']),
    A('f_cloth_change', 'Filter press cloth inspection and change', ['Filter Press'], 'pm', ['!Depressurise the hydraulic ram and lock out', 'Open the plates and inspect each cloth for blinding and tears', 'Hose blinded cloths; replace torn ones', 'Check the plate alignment and the ram seals', '^Close up and run one cycle; the Lead signs off']),
    /* tanks */
    A('f_eq_clean', 'Open tank cleaning', OPEN, 'pm', ['Pump the tank down during low inflow', '!Wash down the walls and remove grit from the floor; photograph before and after', 'Check the float switches and the mixer propeller', 'Return to service']),
    A('f_tank_clean', 'Tank cleaning', [...TANKS, 'Dosing Tank', 'Vtg Chamber'], 'pm', ['Isolate and drain the tank', '!Wash down and remove sediment; photograph the floor', 'Check the level sensor and the drain valve', 'Refill and return to service']),
    A('f_evaporator_clean', 'Evaporator descaling and inspection', ['QUADSON EVAPORATOR'], 'pm', ['!Shut down, isolate the heat supply and let it cool', 'Drain the evaporator and open the inspection covers', '!Photograph the heating surface: scale and fouling', 'Descale with the chemical on the dosing card; rinse until neutral', 'Check the gaskets and the vent line', '^Restart and confirm the evaporation rate; the Lead signs off']),
    /* valves and devices */
    A('f_valve_stroke', 'Valve stroke and seal check', VALVES, 'pm', ['Tell the operator at the panel before moving the valve', 'Stroke the valve fully open and fully closed, by hand or from the panel', '?Did it travel the full way without sticking?', 'Check the gland and the body joints for leaks', '*Photograph the position indicator after returning the valve to its normal position']),
    A('f_device_check', 'Device clean and check', DEVICES, 'round', ['Check the device is reporting on the dashboard', 'Wipe the sensing face or window with a soft cloth and clean water', 'Check the cable, the mounting and the enclosure for damage or water', '*Photograph the device after cleaning']),
    /* utilities */
    A('f_mcc_reset', 'MCC incomer inspection and reset', [], 'fix', ['!Check all three phases on the incomer meter and photograph', 'Check the earth-fault and overload indications', 'Reset once only after the cause is known', 'Restart machines in order: pumps, blowers, dosing']),
    A('f_mcc_thermal', 'MCC thermal and tightness inspection', [], 'pm', ['!Thermal-image every busbar joint and breaker under load; photograph hot spots', 'Isolate, lock out and torque-check the joints found warm', 'Clean the panel filters and check the cooling fans', 'Check the earth bonding and the door interlocks', '^Close up; the Lead signs off'], P),
    A('f_compressor_pm', 'Compressor service', ['Air Compressor'], 'pm', ['!Isolate, lock out and vent the receiver', 'Change the oil and the oil filter; clean the intake filter', 'Drain the receiver and the moisture traps', 'Check belts and the safety valve', '#|Restart and record the receiver pressure from its gauge (bar)'], { version: 2 }),
    A('f_ct_clean', 'Cooling tower fill and basin clean', ['Cooling Tower'], 'pm', ['!Lock out the fan and the circulation pump', 'Drain the basin and remove sludge and scale', 'Hose the fill from above; replace collapsed fill', 'Check the fan belt and the gearbox oil', 'Refill, restart and confirm even water distribution']),
    A('f_power_restore', 'Power restore and DG changeover check', [], 'fix', ['Confirm the DG has taken load, or the mains is back', 'Restart machines in order: pumps, blowers, dosing', '#|Record the outage duration (minutes)', 'Check every alert that paused during the outage has cleared']),
    A('f_probe_clean', 'Probe cleaning', [], 'pm', ['Lift the probe and rinse with clean water', '*Wipe the sensing face with a soft cloth; photograph any damage', 'Return to position and wait five minutes', '#|Compare with a handheld reading and record the difference']),
    /* calibration */
    A('f_do_cal', 'DO probe calibration', [...AER, 'MBBR'], 'calibration', ['Lift the probe, rinse and dry the membrane', 'Hold in water-saturated air for 10 minutes', '#|Record the saturation reading (% or mg/L) before adjustment', 'Set the span to saturation on the transmitter', '#|Record the reading after adjustment and return the probe']),
    A('f_ph_cal', 'pH probe two-point calibration', ['Open Skeleton Tank', 'Anaerobic Tank'], 'calibration', ['Rinse the probe and place it in pH 7 buffer', '#|Record the reading in pH 7 buffer before adjustment', 'Set the zero, rinse, and place in pH 4 or pH 10 buffer', '#|Record the reading in the second buffer and set the slope', 'Replace the probe if the slope is below 85%']),
    A('f_probe_cal', 'Probe calibration against reference', [], 'calibration', ['Clean the probe and take a reference sample', '#|Record the reference instrument reading', 'Adjust the transmitter to match the reference', '#|Record the reading after adjustment']),
    /* plant rounds */
    A('f_logbook', 'Daily logbook round', [], 'round', ['Collect the logbook tablet and check the handover notes', '#|Inlet: record the totaliser reading (m³)', '?Is everything that should be running on, with nothing tripped at the panel?', '?Is every tank at its usual level, with nothing overflowing?', '?Are the chemical tanks above their refill marks?', '#|Outlet: record the totaliser reading (m³)', '#|Outlet: test pH with the kit and record', '#|Outlet: test residual chlorine with the DPD kit and record (mg/L)', '!Outlet: take the sample and photograph it against the label', '*Record anything unusual: noise, smell, leaks'], { version: 6, forStage: 'plant' }),
    A('f_logbook_wtp', 'Water plant daily logbook round', [], 'round', ['Collect the logbook tablet and check the handover notes', '#|Raw water: record the totaliser reading (m³)', '#|Raw water: test turbidity with the hand-held meter and record (NTU)', '?Is everything that should be running on, with nothing tripped at the panel?', '?Is every tank at its usual level, with nothing overflowing?', '?Are the chemical tanks above their refill marks?', '#|Treated water: record the totaliser reading (m³)', '#|Treated water: test residual chlorine with the DPD kit and record (mg/L)', '#|Treated water: test pH with the kit and record', '*Record anything unusual: noise, smell, leaks'], { forStage: 'plant' }),
    A('f_frc_round', 'Outlet residual chlorine check', [], 'round', ['#|Test the outlet with the DPD kit and record (mg/L)', '#|Record the outlet chlorine meter reading at the same time, if there is one (mg/L)', '?Do the two agree within 0.1 mg/L?'], { version: 2, forStage: 'plant' }),
    A('f_sample', 'Compliance sample', [], 'round', ['Rinse the sample bottle three times with the outlet water', '!Fill, cap and photograph the bottle against the label with the time', 'Store in the cool box and hand to the courier before noon', '^Log the sample id; the Lead signs off'], P),
    A('f_hooter_test', 'Hooter function test', [], 'round', ['Tell everyone on site a test is about to run', 'Trigger the hooter from the panel test button', '?Was it heard at the furthest point of the plant?', '^Log the test; the Lead signs off'], P),
    A('f_housekeeping', 'Weekly housekeeping round', [], 'round', ['Walk the whole plant; clear rags, spills and growth from walkways', '*Photograph anything left unsafe', 'Check every guard and handrail is in place', 'Check the chemical store: labels, bunds, eyewash'], { version: 2, forStage: 'plant' }),
  ];

  /* ── 3. Diagnostic flows ─────────────────────────────────────────────────────────────────────
     q(id, text, yes, no) · r(id, text, kind, split, above, below): a destination is a step number or a cause id. A reading
     step names an on-equipment reading; a pipe gauge is a question the operator answers by looking. */
  const dest = (x) => typeof x === 'number' ? { t: 'step', id: x } : x ? { t: 'cause', id: x } : { t: 'open' };
  const q = (id, text, yes, no, photo) => ({ id, type: 'question', text, photo: photo || undefined, answers: { Yes: dest(yes), No: dest(no) } });
  const r = (id, text, kind, split, above, below) => ({ id, type: 'reading', text, sensorKind: kind, split, answers: { Above: dest(above), Below: dest(below) } });
  const Dg = (id, name, forTypes, steps, extra) => Object.assign({ id, name, kind: 'diagnostic', forTypes, forStage: null, use: 'diagnostic', version: 1, status: 'published', steps }, extra || {});
  const DIAG = [
    Dg('f_lowdo', 'Low DO diagnostic', AER, [
      q(1, 'Is the blower running?', 2, 'c_blower_off'),
      q(2, 'Does the gauge on the blower discharge read above 0.45 bar?', 3, 'c_intake'),
      q(3, 'Is bubbling even across the basin?', 4, 'c_diffuser', 'optional'),
      q(4, 'Is there thick brown foam on the surface?', 'c_foam', 5),
      q(5, 'Does the SV30 settle below 400 mL/L?', 6, 'c_bulking'),
      q(6, 'Does a handheld DO meter agree with the probe?', 7, 'c_probe'),
      r(7, 'Read MLSS', 'MLSS', 4500, 'c_mlss_high', 'c_underaer') ], { version: 6 }),
    Dg('f_mbbr', 'MBBR low DO diagnostic', ['MBBR'], [
      q(1, 'Is the media rolling evenly across the tank?', 2, 'c_media_loss'),
      q(2, 'Is the blower running?', 3, 'c_blower_off'),
      q(3, 'Does a handheld DO meter agree with the probe?', 'c_diffuser', 'c_probe') ], { version: 2 }),
    Dg('f_blower_current', 'Blower motor current high', BLOWERS, [
      q(1, 'Is the intake filter clean?', 2, 'c_intake'),
      q(2, 'Does the gauge on the blower discharge read above 0.65 bar?', 'c_diffuser', 3),
      q(3, 'Is the bearing hot or noisy?', 'c_bearing_wear', 'c_belt') ], { version: 2 }),
    Dg('f_blower_trip', 'Motor tripped', [...BLOWERS, 'Motor', 'Cavitator'], [
      q(1, 'Is the MCC incomer healthy on all three phases?', 2, 'c_mcc_trip'),
      q(2, 'Has the overload relay tripped?', 3, 'c_power'),
      q(3, 'Was the motor hot or the bearing noisy before the trip?', 'c_bearing_wear', 'c_trip') ], { version: 2 }),
    Dg('f_rotating_current', 'Motor current high on a rotating machine', [...MIXERS, ...PUMPS, 'Screw Press', 'Dissolved Air Floatation'], [
      q(1, 'Are rags or debris wrapped on the shaft or impeller?', 'c_rag_wrap', 2, 'optional'),
      q(2, 'Is the bearing hot or noisy?', 'c_bearing_wear', 3),
      q(3, 'Does a clamp meter agree with the panel reading?', 'c_trip', 'c_probe') ]),
    Dg('f_pump_fail', 'Pump not delivering', PUMPS, [
      q(1, 'Is the pump running at the panel?', 2, 4),
      r(2, 'Read the motor current', 'Motor current', 10, 3, 'c_pump_airlock'),
      q(3, 'Is the delivery valve open?', 'c_rag_wrap', 'c_valve_closed'),
      q(4, 'Is the MCC incomer healthy?', 'c_level_switch', 'c_mcc_trip') ]),
    Dg('f_screen_trip', 'Screen drive tripped', DRIVES, [
      q(1, 'Is the rake or the drum jammed with debris?', 'c_screen', 2, 'optional'),
      q(2, 'Is the MCC incomer healthy?', 3, 'c_mcc_trip'),
      q(3, 'After lock-out, does the drive turn freely by hand?', 'c_trip', 'c_rake_drive') ]),
    Dg('f_blanket', 'Sludge blanket high', SETTLE, [
      q(1, 'Is the scraper turning?', 2, 'c_scraper'),
      q(2, 'Is the RAS pump running at its normal rate?', 3, 'c_blanket'),
      q(3, 'Are floating clumps with gas bubbles on the surface?', 'c_denit_float', 4, 'optional'),
      q(4, 'Does the SV30 settle above 400 mL/L?', 'c_bulking', 'c_mlss_high') ]),
    Dg('f_eq_level', 'Tank level high', [...TANKS, ...OPEN, 'Oil & Grease Tank'], [
      q(1, 'Are the transfer pumps running?', 2, 'c_level_switch'),
      q(2, 'Is inflow unusually high: rain, or a batch discharge?', 'c_flood_inflow', 3),
      q(3, 'Is the delivery valve open?', 'c_rag_wrap', 'c_valve_closed') ]),
    Dg('f_sump_flood', 'Sump flooding', OPEN, [
      q(1, 'Are the pumps running?', 'c_flood_inflow', 2),
      q(2, 'Is the MCC incomer healthy?', 'c_level_switch', 'c_mcc_trip') ]),
    Dg('f_ph', 'pH high or low', ['Open Skeleton Tank'], [
      q(1, 'Is the agitator running?', 2, 'c_mixer_off'),
      q(2, 'Is the neutralisation chemical tank above 10%?', 3, 'c_dosing_empty'),
      q(3, 'Does a handheld meter agree with the probe?', 'c_ph_shock', 'c_probe') ]),
    Dg('f_mlss', 'MLSS high or low', AER, [
      q(1, 'Does the SV30 settle above 400 mL/L?', 'c_bulking', 2),
      q(2, 'Is MLSS above the target band?', 'c_mlss_high', 'c_mlss_low') ]),
    Dg('f_foam', 'Foaming on the basin', [...AER, 'MBBR'], [
      q(1, 'Is the foam thick, brown and greasy?', 'c_foam', 2, 'required'),
      q(2, 'Is it white and billowing?', 'c_mlss_low', 'c_overload') ]),
    Dg('f_anaerobic', 'Digester pH low', ['Anaerobic Tank'], [
      q(1, 'Was the feed rate raised in the last week?', 'c_overload', 2),
      q(2, 'Is alkalinity below 1000 mg/L on the kit?', 'c_anaerobic_souring', 'c_probe') ]),
    Dg('f_uv', 'UV lamp fault or intensity low', ['UV'], [
      q(1, 'Are the lamp hours past the rated life?', 'c_uv_lamp', 2),
      q(2, 'Is the sleeve visibly fouled?', 'c_uv_lamp', 'c_power', 'optional') ], { version: 2 }),
    Dg('f_press', 'Poor cake or press overflowing', ['Screw Press'], [
      q(1, 'Do flocs form in the jar test?', 2, 'c_poly_dose'),
      q(2, 'Are the screen slots blinded?', 'c_screen_blind', 3, 'optional'),
      q(3, 'Is the feed sludge thin, below 1% solids?', 'c_sludge_thin', 'c_poly_dose') ]),
    Dg('f_daf', 'DAF scum carry-over', ['Dissolved Air Floatation'], [
      q(1, 'Is the saturator pressure normal?', 2, 'c_daf_saturator'),
      q(2, 'Do flocs form in the jar test?', 'c_bearing_wear', 'c_poly_dose') ]),
  ];

  /* ── 4. Next phase: the diagnostics for alerts that read a connection, kept for when connections are in the library, with
     the plant-wide diagnostics and the flows only they lead to. Not installed; the equipment types' nextPhase alerts name them. */
  const NEXT = [
    Dg('f_blower_press', 'Blower line pressure high', BLOWERS, [
      q(1, 'Is the discharge valve and the header valve fully open?', 2, 'c_valve_closed'),
      q(2, 'Is bubbling even across the basin?', 3, 'c_diffuser'),
      q(3, 'Does the gauge on the blower agree with the SCADA reading?', 'c_diffuser', 'c_probe') ]),
    Dg('f_turb', 'MBR turbidity and permeability diagnostic', ['MBR'], [
      q(1, 'Is the permeate visibly cloudy in a clean jar?', 2, 4, 'required'),
      q(2, 'Is only one train cloudy?', 3, 'c_fouling'),
      q(3, 'Isolate that train. Does the seal face show damage?', 'c_seal', 'c_fouling', 'required'),
      r(4, 'Read the trans-membrane pressure', 'Trans-membrane pressure', 0.4, 'c_fouling', 'c_probe') ], { version: 3 }),
    Dg('f_screen_dh', 'Screen differential high', SCREENS, [
      q(1, 'Is the rake running?', 3, 2),
      q(2, 'Has the rake drive tripped?', 'c_rake_drive', 'c_power'),
      q(3, 'Is the skip full, or the rake not discharging?', 'c_screen', 4),
      q(4, 'Is the channel overflowing from a surge?', 'c_surge', 'c_probe') ]),
    Dg('f_mgf_dp', 'Filter differential pressure high', ['ACF/MGF'], [
      q(1, 'Was the last backwash done on schedule?', 2, 'c_media_choked'),
      q(2, 'Do the backwash valves sequence correctly?', 3, 'c_backwash_valve'),
      q(3, 'Is the media surface cracked, or are there mud balls?', 'c_mudball', 'c_media_choked', 'optional') ]),
    Dg('f_uf', 'UF recovery low or pressure high', ['UF Membrane'], [
      q(1, 'Is the backwash or CEB running on its cycle?', 2, 'c_backwash_valve'),
      q(2, 'Did the last integrity test pass?', 3, 'c_uf_fibre'),
      r(3, 'Read the inlet pressure', 'Inlet pressure', 3.0, 'c_uf_fouling', 'c_feed_pump') ]),
    Dg('f_ro', 'RO recovery low', ['RO'], [
      q(1, 'Is the antiscalant tank above 10%?', 2, 'c_dosing_empty'),
      q(2, 'Is the pressure drop across the RO banks high?', 3, 'c_cartridge'),
      q(3, 'Has feed hardness or conductivity gone up?', 'c_ro_scaling', 'c_ro_biofoul') ]),
    Dg('f_frc', 'Residual chlorine low', ['Dosing Pump'], [
      q(1, 'Is the hypo tank above 10%?', 2, 'c_dosing_empty'),
      q(2, 'Is the dosing pump stroking?', 3, 'c_dosing_pump'),
      q(3, 'Is the hypo older than 30 days, or stored in the sun?', 'c_hypo_degraded', 4),
      q(4, 'Does the DPD kit agree with the probe?', 'c_cl_demand', 'c_probe') ]),
    Dg('f_gas_frc', 'Residual chlorine low, gas chlorination', ['Gas Tonner'], [
      q(1, 'Is the tonner above 10% on the scale?', 2, 'c_tonner_empty'),
      q(2, 'Is the ejector water pressure normal?', 3, 'c_valve_closed'),
      q(3, 'Does the DPD kit agree with the probe?', 'c_cl_demand', 'c_probe') ]),
    Dg('f_compressor', 'Air pressure low', ['Air Compressor'], [
      q(1, 'Is the compressor running?', 2, 'c_mcc_trip'),
      q(2, 'Can you hear an air leak?', 'c_compressor_leak', 3),
      q(3, 'Is the intake filter clogged?', 'c_intake', 'c_bearing_wear') ]),
    Dg('f_ct', 'Cooling tower outlet temperature high', ['Cooling Tower'], [
      q(1, 'Is the fan running?', 2, 'c_mcc_trip'),
      q(2, 'Is the fill scaled or blocked?', 'c_ct_scale', 'c_valve_closed', 'optional') ]),
    A('f_turb_cal', 'Turbidity meter calibration', ['MBR', 'UF Membrane'], 'calibration', ['Clean the cuvette or flow cell', '#|Record the reading in the formazin standard before adjustment', 'Set the span to the standard value', '#|Record the reading after adjustment']),
    A('f_dose_adjust', 'Chlorine dose adjustment with DPD check', ['Dosing Pump', 'Gas Tonner'], 'fix', ['#|Test the outlet with the DPD kit and record the result (mg/L)', 'Raise the stroke or the feed rate one step', '~30|Let the contact tank turn over', '#|Re-test with the DPD kit and record'], { version: 2 }),
    /* plant-wide: an odour complaint or a high outlet BOD is a plant alert, on the inlet or the outlet */
    Dg('f_odour', 'Odour complaint', [], [
      q(1, 'Is there a septic smell at the inlet or the equalisation tank?', 'c_mixer_off', 2),
      q(2, 'Is aeration DO below 1 mg/L?', 'c_underaer', 3),
      q(3, 'Has sludge been held more than three days?', 'c_sludge_hold', 'c_no_fault') ], { forStage: 'plant' }),
    Dg('f_effluent', 'Outlet BOD or COD high', [], [
      q(1, 'Is aeration DO holding above 2 mg/L?', 2, 'c_underaer'),
      q(2, 'Is MLSS in band?', 3, 'c_mlss_low'),
      q(3, 'Is the clarifier blanket below 1 m?', 4, 'c_blanket'),
      q(4, 'Does the water spill evenly over the whole clarifier weir?', 5, 'c_weir_uneven'),
      q(5, 'Has the influent load gone up: an industrial discharge, a tanker?', 'c_overload', 'c_toxic') ], { version: 2, forStage: 'plant' }),
  ];
  window.NEXT_PHASE_FLOWS = NEXT;

  /* ── 5. Bind to the library: which flow an inherited alert opens, which flow a schedule runs, and which cause a scheduled
     task logs against (the failure the work prevents). Keyed by database type name, then by item name. ─────────── */
  const TANK_BIND = { alerts: { 'Level high': { flow: 'f_eq_level' } }, schedules: { 'Tank cleaning': { flow: 'f_tank_clean' } } };
  const AER_BIND = { alerts: { 'DO low': { flow: 'f_lowdo' }, 'MLSS high': { flow: 'f_mlss' }, 'MLSS low': { flow: 'f_mlss' }, 'Temperature high': { cause: 'c_temp_high' } }, schedules: { 'SV30 settling test': { flow: 'f_sv30', cause: 'c_bulking' } } };
  const SCREEN_BIND = { alerts: { 'Screen drive tripped': { flow: 'f_screen_trip', cause: 'c_rake_drive' } }, schedules: { 'Weekly screen inspection': { flow: 'f_screen_inspect', cause: 'c_rake_drive' } } };
  const PUMP_BIND = { alerts: { 'Motor current high': { flow: 'f_rotating_current' } }, schedules: { 'Bearing and seal service': { flow: 'f_pump_pm', cause: 'c_bearing_wear' } } };
  const VALVE_BIND = { alerts: {}, schedules: { 'Valve stroke check': { flow: 'f_valve_stroke', cause: 'c_valve_stuck' } } };
  const DEVICE_BIND = { alerts: {}, schedules: { 'Device clean and check': { flow: 'f_device_check' } } };
  const CURRENT = { 'Motor current high': { flow: 'f_rotating_current' } };
  const BIND = {
    'Tank': TANK_BIND, 'Tank 2': TANK_BIND, 'Open Process Tank': TANK_BIND, 'Closed Process Tank': TANK_BIND, 'Overhead Tank': TANK_BIND,
    'Clarifier Tank': { alerts: { 'Sludge blanket high': { flow: 'f_blanket' } }, schedules: { 'Scraper drive service': { flow: 'f_scraper_pm', cause: 'c_scraper' } } },
    'Open Skeleton Tank': { alerts: { 'Level high': { flow: 'f_eq_level' }, 'pH high': { flow: 'f_ph' }, 'pH low': { flow: 'f_ph' }, 'Sump flooding': { flow: 'f_sump_flood' } }, schedules: { 'Tank cleaning': { flow: 'f_eq_clean' } } },
    'Submersible Tank': { alerts: { 'Level high': { flow: 'f_eq_level' }, 'Sump flooding': { flow: 'f_sump_flood' } }, schedules: { 'Tank cleaning': { flow: 'f_eq_clean' } } },
    'Screen Chamber Tank': { alerts: {}, schedules: { 'Weekly screen inspection': { flow: 'f_screen_inspect', cause: 'c_screen' } } },
    'Diffuser Tank': AER_BIND, 'SBR': AER_BIND, 'Cass Basin': AER_BIND,
    'Agitator': { alerts: CURRENT, schedules: { 'Gearbox and bearing service': { flow: 'f_gearbox_pm', cause: 'c_bearing_wear' } } },
    'Oil & Grease Tank': { alerts: { 'Level high': { flow: 'f_eq_level' } }, schedules: { 'Skimmer belt and scraper check': { flow: 'f_ogt_pm', cause: 'c_skimmer' }, 'Oil removal round': { flow: 'f_ogt_round', cause: 'c_grease_full' }, 'Desludging': { flow: 'f_ogt_desludge', cause: 'c_grease_full' } } },
    'Dosing Tank': { alerts: { 'Chemical tank low': { cause: 'c_dosing_empty' } }, schedules: { 'Chemical refill': { flow: 'f_chem_refill', cause: 'c_dosing_empty' } } },
    'Anaerobic Tank': { alerts: { 'pH low': { flow: 'f_anaerobic' } }, schedules: { 'Desludging': { flow: 'f_desludge' } } },
    'Pump': PUMP_BIND, 'Booster Pump': PUMP_BIND,
    'Submersible Pump': { alerts: CURRENT, schedules: { 'Bearing and seal service': { flow: 'f_pump_lift', cause: 'c_pump_seal' } } },
    'Dosing Pump': { alerts: {}, schedules: { 'Dosing pump service': { flow: 'f_dosing_pump_pm', cause: 'c_dosing_pump' }, 'Calibration of dose rate': { flow: 'f_dose_cal', cause: 'c_dose_drift' } } },
    'Blower': { alerts: { 'Motor current high': { flow: 'f_blower_current' }, 'Blower tripped': { flow: 'f_blower_trip', cause: 'c_trip' } }, schedules: { 'Bearing service': { flow: 'f_blower_pm', cause: 'c_bearing_wear' }, 'Clean intake filter': { flow: 'f_blower', cause: 'c_intake' } } },
    'Mini Blower': { alerts: { 'Blower tripped': { flow: 'f_blower_trip', cause: 'c_trip' } }, schedules: { 'Bearing service': { flow: 'f_blower_pm', cause: 'c_bearing_wear' }, 'Clean intake filter': { flow: 'f_blower', cause: 'c_intake' } } },
    'Motor': { alerts: { 'Motor tripped': { flow: 'f_blower_trip', cause: 'c_trip' } }, schedules: { 'Motor insulation and bearing check': { flow: 'f_motor_pm', cause: 'c_bearing_wear' } } },
    'Air Compressor': { alerts: {}, schedules: { 'Compressor service': { flow: 'f_compressor_pm', cause: 'c_compressor_leak' } } },
    'Two way Valve': VALVE_BIND, 'Three way Valve': VALVE_BIND,
    'Screw Press': { alerts: CURRENT, schedules: { 'Screw and screen service': { flow: 'f_press_wash', cause: 'c_screen_blind' } } },
    'Filter Press': { alerts: {}, schedules: { 'Hydraulic and cloth inspection': { flow: 'f_cloth_change', cause: 'c_cloth' } } },
    'Softner': { alerts: {}, schedules: { 'Brine tank salt top-up': { flow: 'f_brine_topup', cause: 'c_softener_exhaust' } } },
    'ACF/MGF': { alerts: {}, schedules: { 'Weekly backwash': { flow: 'f_backwash', cause: 'c_media_choked' } } },
    'Ozonator': { alerts: { 'Ozonator tripped': { cause: 'c_ozone_trip' } }, schedules: { 'Generator service': { flow: 'f_ozone_pm' } } },
    'MBBR': { alerts: { 'DO low': { flow: 'f_mbbr' } }, schedules: { 'Media and diffuser inspection': { flow: 'f_mbbr_media', cause: 'c_media_loss' } } },
    'MBR': { alerts: {}, schedules: { 'Quarterly CIP': { flow: 'f_cip', cause: 'c_fouling' } } },
    'Tube settler': { alerts: { 'Sludge blanket high': { flow: 'f_blanket' } }, schedules: { 'Tube module cleaning': { flow: 'f_tube_clean', cause: 'c_tube_clog' } } },
    'UF Membrane': { alerts: {}, schedules: { 'Quarterly CIP': { flow: 'f_uf_cip', cause: 'c_uf_fouling' } } },
    'RO': { alerts: {}, schedules: { 'Membrane CIP': { flow: 'f_ro_cip', cause: 'c_ro_scaling' } } },
    'UV': { alerts: { 'UV lamp fault': { flow: 'f_uv' }, 'UV intensity low': { flow: 'f_uv' } }, schedules: { 'Lamp and sleeve replacement': { flow: 'f_uv_lamp', cause: 'c_uv_lamp' } } },
    'Dissolved Air Floatation': { alerts: CURRENT, schedules: { 'Saturator and scraper service': { flow: 'f_daf_pm', cause: 'c_daf_saturator' } } },
    'Flash Mixer': { alerts: CURRENT, schedules: { 'Gearbox and bearing service': { flow: 'f_gearbox_pm', cause: 'c_bearing_wear' } } },
    'Flocculation': { alerts: CURRENT, schedules: { 'Gearbox and paddle check': { flow: 'f_floc_pm', cause: 'c_bearing_wear' } } },
    'Static Mixer': { alerts: {}, schedules: { 'Element inspection': { flow: 'f_static_mixer' } } },
    'Rotary Drum': SCREEN_BIND, 'Mechanical Screen': SCREEN_BIND,
    'Grit Chamber': { alerts: {}, schedules: { 'Grit removal': { flow: 'f_grit_remove', cause: 'c_grit_full' } } },
    'Grit Classifier': { alerts: {}, schedules: { 'Classifier screw and gearbox check': { flow: 'f_classifier_pm', cause: 'c_bearing_wear' } } },
    'Cartridge Filter': { alerts: {}, schedules: { 'Cartridge replacement': { flow: 'f_cartridge_replace', cause: 'c_cartridge' } } },
    'Cascade Aerator': { alerts: {}, schedules: { 'Steps cleaning': { flow: 'f_cascade_clean' } } },
    'Cooling Tower': { alerts: {}, schedules: { 'Fill and fan service': { flow: 'f_ct_clean', cause: 'c_ct_scale' } } },
    'Hydro Cyclone': { alerts: {}, schedules: { 'Cyclone apex and liner check': { flow: 'f_cyclone_check', cause: 'c_cyclone_wear' } } },
    'Cavitator': { alerts: { 'Cavitator tripped': { flow: 'f_blower_trip', cause: 'c_trip' } }, schedules: { 'Cavitator service': { flow: 'f_cavitator_pm' } } },
    'Gas Tonner': { alerts: { 'Tonner nearly empty': { cause: 'c_tonner_empty' }, 'Chlorine leak': { flow: 'f_cl_leak', cause: 'c_cl_leak' } }, schedules: { 'Tonner change': { flow: 'f_tonner_change', cause: 'c_tonner_empty' } } },
    'Vtg Chamber': { alerts: {}, schedules: { 'Chamber cleaning': { flow: 'f_tank_clean' } } },
    'Sabre': DEVICE_BIND, 'Small Sabre': DEVICE_BIND, 'Bio Health Tracker': DEVICE_BIND,
    'QUADSON EVAPORATOR': { alerts: {}, schedules: { 'Evaporator descaling and inspection': { flow: 'f_evaporator_clean', cause: 'c_evaporator_scale' } } },
  };
  window.FLOW_BIND = BIND;
  /* Which calibration flow a probe gets, by what it reads. */
  window.CAL_FLOWS = { 'Dissolved oxygen': 'f_do_cal', 'pH': 'f_ph_cal' };
  window.CAL_FLOW_DEFAULT = 'f_probe_cal';

  /* ── 6. Install ─────────────────────────────────────────────────────────────────────────── */
  const SEED = window.SEED;
  SEED.flows = [...DIAG, ...ACTION];
  SEED.causes = CAUSES;
  SEED.standardSets.forEach((t) => { const b = BIND[t.type]; if (!b) return; t.alerts.forEach((a) => { const x = b.alerts[a.name]; if (x) { if (x.flow) a.flow = x.flow; if (x.cause) a.cause = x.cause; } }); t.schedules.forEach((s) => { const x = b.schedules[s.name]; if (x) { if (x.flow) s.flow = x.flow; if (x.cause) s.cause = x.cause; } }); });
  /* Plant rounds run a flow too. */
  const PF = { 'Daily logbook round': 'f_logbook', 'Monthly compliance sample': 'f_sample', 'Weekly bacteriological sample': 'f_sample', 'Hooter function test': 'f_hooter_test', 'Weekly housekeeping round': 'f_housekeeping' };
  Object.values(window.PLANT_PROFILES).forEach((p) => p.rounds.forEach((r2) => { if (!r2.flow && PF[r2.name]) r2.flow = PF[r2.name]; }));
  /* Expected time and parts, for the month's plan. */
  const HOURS = {
    /* tanks and basins */
    'Tank cleaning': [6, ''], 'Chamber cleaning': [4, ''], 'Scraper drive service': [3, 'gear oil 2 L, grease'], 'SV30 settling test': [0.75, ''], 'Desludging': [6, ''], 'Skimmer belt and scraper check': [1, 'skimmer belt if frayed'], 'Oil removal round': [0.5, ''], 'Chemical refill': [0.5, ''],
    /* pumps, blowers, motors, valves */
    'Bearing and seal service': [5, 'mechanical seal, seal oil'], 'Dosing pump service': [2, 'diaphragm, valve balls'], 'Calibration of dose rate': [0.5, ''], 'Bearing service': [4, '2 bearings 6206, 1 belt B48, grease'], 'Clean intake filter': [0.5, 'spare filter element'], 'Motor insulation and bearing check': [2, 'grease'], 'Compressor service': [3, 'oil 2 L, oil filter, intake filter'], 'Valve stroke check': [0.5, ''],
    /* treatment units */
    'Screw and screen service': [3, ''], 'Hydraulic and cloth inspection': [5, 'filter cloths as found'], 'Brine tank salt top-up': [0.5, 'softener salt 50 kg'], 'Weekly backwash': [1, ''], 'Generator service': [3, 'desiccant, filters'], 'Media and diffuser inspection': [4, ''], 'Quarterly CIP': [6, '25 kg hypochlorite'], 'Tube module cleaning': [4, ''], 'Membrane CIP': [6, 'citric acid 10 kg, hypochlorite 10 kg'], 'Lamp and sleeve replacement': [2, 'UV lamp, quartz sleeve'], 'Saturator and scraper service': [3, 'grease'], 'Gearbox and bearing service': [3, 'gear oil 1 L, grease'], 'Gearbox and paddle check': [3, 'gear oil 1 L, grease'], 'Element inspection': [2, 'gasket'],
    'Weekly screen inspection': [0.5, ''], 'Grit removal': [1, ''], 'Classifier screw and gearbox check': [2, 'gear oil 1 L'], 'Cartridge replacement': [1, 'cartridges 5 µm × 4'], 'Steps cleaning': [2, ''], 'Fill and fan service': [6, 'fan belt'], 'Cyclone apex and liner check': [1.5, 'apex insert if worn'], 'Cavitator service': [2, ''], 'Tonner change': [1.5, 'lead gasket'], 'Device clean and check': [0.5, ''], 'Evaporator descaling and inspection': [6, 'descaling chemical'],
    /* plant rounds */
    'Daily logbook round': [1, ''], 'Monthly compliance sample': [1, 'sample bottles'], 'Weekly bacteriological sample': [1, 'sterile sample bottles'], 'Hooter function test': [0.25, ''], 'Weekly housekeeping round': [1.5, ''] };
  window.FLOW_HOURS = HOURS;
  const withHours = (s) => { const h = HOURS[s.name]; if (h) { s.hours = h[0]; if (h[1]) s.parts = h[1]; } };
  SEED.standardSets.forEach((t) => t.schedules.forEach(withHours)); Object.values(window.PLANT_PROFILES).forEach((p) => p.rounds.forEach(withHours));
  /* The sample plant's own records (data.js) point at the library where their names match. */
  const SS = SEED.schedules || [], CW = SEED.conditionWork || [], AA = SEED.alerts || [];
  SS.forEach(withHours); SS.forEach((s) => { if (s.workType === 'calibration' && !s.hours) s.hours = 1; });
  SS.forEach((s) => { if (s.name === 'Bearing service') { s.flow = 'f_blower_pm'; s.cause = 'c_bearing_wear'; } if (s.name === 'Quarterly CIP' && !s.cause) s.cause = 'c_fouling'; if (s.name === 'Weekly backwash') s.cause = 'c_media_choked'; if (s.name === 'Monthly compliance sample') s.flow = 'f_sample'; if (s.name === 'Hooter function test') s.flow = 'f_hooter_test'; if (s.name === 'Sludge wasting') s.flow = 'f_sludge'; });
  CW.forEach((w) => { if (w.name === 'Clean intake filter') w.cause = 'c_intake'; });
  AA.forEach((a) => { const n = String(a.name || ''); if (n.startsWith('Sludge blanket high')) a.flow = 'f_blanket'; if (n.startsWith('Sump flooding')) a.flow = 'f_sump_flood'; if (n.startsWith('MLSS high')) a.flow = 'f_mlss'; if (n.startsWith('Blower tripped')) a.flow = 'f_blower_trip'; });
})();
