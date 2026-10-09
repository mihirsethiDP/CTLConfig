/* v2. The fix-flow and root-cause library. Loaded after data.js and catalogue.js; replaces SEED.flows
   and SEED.causes and binds flows to the library's standard sets, so every plant inherits them.
   v2 holds no diagnostic flows: an alert runs a generic fix flow (the first thing to try), and the
   cause is recorded when the record closes. A fix flow is written once per type and read per plant:
   a step can mention a connection ({{standby}}, {{discharge}}) and is skipped where the plant has none.

   Two flow kinds (PRD §7.1): a DIAGNOSTIC flow asks questions until it reaches a root cause on a
   subject; an ACTION flow is the numbered sequence that does the work — what a task runs, and what a
   cause nominates as its fix. A root cause is estate-wide vocabulary scoped by unit process and
   equipment TYPE, never a machine (PRD §7.4). A scheduled task carries a preassigned cause: the
   failure the work prevents (PRD §5.9, tasks-list spec).

   Sources: the handoff's procedure fixtures (Low DO, Backwash, Clear bar screen, MBR CIP, pH
   correction, Blower inspection, Turbidity diagnostic, Daily logbook round), its root-cause library
   and tree-editor specs, the PPM addendum, and standard STP/ETP/WTP operating practice. */
(function () {
  'use strict';
  /* ── 1. Root causes ──────────────────────────────────────────────────────────────────────────
     stage: unit-process profile id, or null with anyStage. types: the equipment types it can be
     diagnosed on (empty = the unit process as a whole). fix: the action flow that resolves it.
     sensorFault: closes the record as a sensor fault, never counted as a plant failure. */
  const RC = (id, name, stage, types, fix, extra) => Object.assign({ id, name, stage, type: types[0] || null, types, fix: fix || null }, extra || {});
  const CAUSES = [
    /* inlet works */
    RC('c_screen', 'Bar screen choked', 'inlet', ['Mechanical bar screen'], 'f_screen'),
    RC('c_rake_drive', 'Rake drive fault or chain jammed', 'inlet', ['Mechanical bar screen'], 'f_screen_drive'),
    RC('c_grit_full', 'Grit chamber full', 'inlet', ['Grit chamber'], 'f_grit_remove'),
    RC('c_surge', 'Hydraulic surge at the inlet', 'inlet', [], 'f_surge_mgmt'),
    RC('c_rag_wrap', 'Rags wrapped on the impeller', 'inlet', ['Submersible pump', 'Mixer', 'Progressive cavity pump'], 'f_pump_lift'),
    RC('c_pump_seal', 'Mechanical seal failure', 'inlet', ['Submersible pump', 'Progressive cavity pump'], 'f_pump_lift'),
    RC('c_pump_airlock', 'Air lock or lost prime', 'inlet', ['Submersible pump'], 'f_pump_prime'),
    RC('c_level_switch', 'Level float stuck', 'inlet', ['Submersible pump', 'Equalisation tank'], 'f_float_check'),
    /* balancing */
    RC('c_flood_inflow', 'Inflow exceeds transfer capacity', 'bal', [], 'f_surge_mgmt'),
    RC('c_mixer_off', 'Agitator stopped, tank stratified', 'bal', ['Mixer', 'Equalisation tank'], 'f_mixer_restart'),
    RC('c_ph_shock', 'Acid or alkali shock load from upstream', 'bal', [], 'f_ph_corr'),
    /* biological */
    RC('c_blower_off', 'Duty blower off', 'bio', ['Centrifugal blower'], 'f_blower_changeover'),
    RC('c_intake', 'Intake filter blocked', 'bio', ['Centrifugal blower', 'Air compressor'], 'f_blower'),
    RC('c_belt', 'Belt slipping or worn', 'bio', ['Centrifugal blower'], 'f_blower_pm'),
    RC('c_bearing_wear', 'Bearing wear', 'bio', ['Centrifugal blower', 'Submersible pump', 'Progressive cavity pump', 'Mixer', 'Screw press', 'DAF unit', 'Air compressor', 'Circular clarifier'], 'f_blower_pm'),
    RC('c_trip', 'Motor overload trip', 'bio', ['Centrifugal blower', 'Submersible pump', 'Mixer', 'Screw press', 'Progressive cavity pump'], 'f_motor_trip'),
    RC('c_diffuser', 'Diffuser fouling', 'bio', ['Aeration basin', 'MBBR reactor'], 'f_diffuser_clean'),
    RC('c_bulking', 'Filamentous sludge bulking', 'bio', [], 'f_bulking_control'),
    RC('c_underaer', 'Under-aeration: load exceeds blower capacity', 'bio', [], 'f_blower_step_up'),
    RC('c_overload', 'Organic shock load', 'bio', [], 'f_shock_load'),
    RC('c_toxic', 'Toxic inhibition, nitrification lost', 'bio', [], 'f_shock_load'),
    RC('c_mlss_high', 'Insufficient sludge wasting', 'bio', [], 'f_sludge'),
    RC('c_mlss_low', 'Biomass washout, wasting too high', 'bio', [], 'f_sludge_reduce'),
    RC('c_foam', 'Nocardia foaming', 'bio', [], 'f_foam_control'),
    RC('c_temp_high', 'High mixed-liquor temperature from influent', 'bio', [], null),
    RC('c_media_loss', 'MBBR media carried over or retention screen blocked', 'bio', ['MBBR reactor'], 'f_mbbr_media'),
    RC('c_anaerobic_souring', 'Digester souring, alkalinity lost', 'bio', ['Anaerobic tank'], 'f_digester_alk'),
    /* separation */
    RC('c_fouling', 'Membrane fouling', 'sep', ['Membrane bioreactor skid'], 'f_cip'),
    RC('c_seal', 'Membrane seal or fibre breach', 'sep', ['Membrane bioreactor skid'], null),
    RC('c_blanket', 'Return sludge rate too low', 'sep', ['Circular clarifier', 'Tube settler'], 'f_ras_adjust'),
    RC('c_scraper', 'Scraper drive stalled', 'sep', ['Circular clarifier'], 'f_scraper_pm'),
    RC('c_denit_float', 'Denitrification lifting sludge', 'sep', ['Circular clarifier', 'Tube settler'], 'f_ras_adjust'),
    RC('c_tube_clog', 'Tube settler modules clogged', 'sep', ['Tube settler'], 'f_tube_clean'),
    RC('c_daf_saturator', 'DAF saturator or air injection failed', 'sep', ['DAF unit'], 'f_daf_pm'),
    RC('c_weir_uneven', 'Weir out of level, short-circuiting', 'sep', ['Circular clarifier'], null),
    /* filtration */
    RC('c_media_choked', 'Filter media choked, backwash overdue', 'filt', ['Multigrade filter'], 'f_backwash'),
    RC('c_mudball', 'Mud balls or media loss', 'filt', ['Multigrade filter'], 'f_media_inspect'),
    RC('c_backwash_valve', 'Backwash valves not sequencing', 'filt', ['Multigrade filter', 'Ultrafiltration skid'], 'f_valve_check'),
    RC('c_uf_fouling', 'UF membrane fouling', 'filt', ['Ultrafiltration skid'], 'f_uf_cip'),
    RC('c_uf_fibre', 'UF fibre breakage', 'filt', ['Ultrafiltration skid'], null),
    RC('c_ro_scaling', 'RO scaling, antiscalant under-dosed', 'filt', ['RO skid'], 'f_ro_cip'),
    RC('c_ro_biofoul', 'RO biofouling', 'filt', ['RO skid'], 'f_ro_cip'),
    RC('c_cartridge', 'Cartridge filter exhausted', 'filt', ['Cartridge filter', 'RO skid'], 'f_cartridge_replace'),
    RC('c_softener_exhaust', 'Softener resin exhausted', 'filt', ['Softener'], 'f_softener_regen'),
    RC('c_feed_pump', 'Feed pump under-delivering', 'filt', ['Submersible pump', 'Ultrafiltration skid'], 'f_pump_lift'),
    /* disinfection */
    RC('c_hypo_empty', 'Hypo tank empty', 'dis', ['Hypochlorite dosing unit'], 'f_hypo_refill'),
    RC('c_hypo_degraded', 'Hypo strength degraded by heat or age', 'dis', ['Hypochlorite dosing unit'], 'f_hypo_refill'),
    RC('c_dosing_pump', 'Dosing pump lost prime or diaphragm failed', 'dis', ['Hypochlorite dosing unit'], 'f_dosing_pump_service'),
    RC('c_cl_demand', 'Chlorine demand up: ammonia or organics in the outlet', 'dis', [], 'f_dose_adjust'),
    RC('c_uv_lamp', 'UV lamp at end of life or sleeve fouled', 'dis', ['UV unit'], 'f_uv_lamp'),
    RC('c_ozone_trip', 'Ozonator tripped on dew point', 'dis', ['Ozonator'], 'f_ozone_reset'),
    RC('c_tonner_empty', 'Chlorine tonner empty', 'dis', ['Gas chlorinator'], 'f_tonner_change'),
    /* sludge handling */
    RC('c_poly_dose', 'Polymer dose wrong, poor flocculation', 'sludge', ['Screw press', 'Filter press'], 'f_poly_jar_test'),
    RC('c_screen_blind', 'Press screen blinded', 'sludge', ['Screw press'], 'f_press_wash'),
    RC('c_cloth', 'Filter cloth blinded or torn', 'sludge', ['Filter press'], 'f_cloth_change'),
    RC('c_stator', 'Pump stator worn', 'sludge', ['Progressive cavity pump'], 'f_pc_pump_pm'),
    RC('c_sludge_thin', 'Feed sludge too thin', 'sludge', [], 'f_sludge'),
    RC('c_sludge_hold', 'Sludge held too long before dewatering', 'sludge', [], 'f_sludge'),
    /* utilities */
    RC('c_mcc_trip', 'Incomer trip or phase loss', 'util', ['Control panel (MCC)'], 'f_mcc_reset'),
    RC('c_compressor_leak', 'Air leak, compressor cannot hold pressure', 'util', ['Air compressor'], 'f_compressor_pm'),
    RC('c_ct_scale', 'Cooling tower fill scaled', 'util', ['Cooling tower'], 'f_ct_clean'),
    /* any stage */
    RC('c_probe', 'Probe drift — needs calibration', null, [], null, { anyStage: true, sensorFault: true }),
    RC('c_probe_fouled', 'Probe fouled — needs cleaning', null, [], 'f_probe_clean', { anyStage: true, sensorFault: true }),
    RC('c_power', 'Power failure or DG changeover', null, [], 'f_power_restore', { anyStage: true }),
    RC('c_valve_closed', 'Isolation valve left closed', null, [], 'f_valve_check', { anyStage: true }),
    RC('c_dosing_empty', 'Chemical tank empty', null, ['Dosing tank'], 'f_chem_refill', { anyStage: true }),
    RC('c_no_fault', 'No fault found, reading verified normal', null, [], null, { anyStage: true, noFault: true }),
  ];

  /* ── 2. Action flows ─────────────────────────────────────────────────────────────────────────
     A compact line per step: plain text = instruction · '!' photo required · '*' photo optional ·
     '^' a Lead signs this step · '?' a yes/no the operator records · '#Kind|' a reading bound to the
     machine's reading of that kind at inheritance · '#|' a number typed by hand · '~N|' a wait of N min.
     use: pm · fix · round · calibration · condition  (how the Flows page groups them). */
  /* v2: '@conn ' before a step = only where the machine has that connection bound; '#conn.Kind|' = a reading on that connection; {{conn}} in any text = the connected thing's tag(s) at this plant. */
  const parseStep = (s, i) => { const st = { id: i + 1, type: 'instruction', text: s }; const only = s.match(/^@(\w+)\s+(.*)$/); if (only) { st.only = only[1]; s = only[2]; st.text = s; } const m = s.match(/^([!*^?#~])(.*)$/); if (!m) return st; const rest = m[2]; if (m[1] === '!') { st.text = rest; st.photo = 'required'; } else if (m[1] === '*') { st.text = rest; st.photo = 'optional'; } else if (m[1] === '^') { st.text = rest; st.approve = true; } else if (m[1] === '?') { st.type = 'question'; st.text = rest; } else if (m[1] === '#') { st.type = 'reading'; const [kind, text] = rest.split('|'); if (kind && kind.includes('.')) { const [on, k] = kind.split('.'); st.on = on; st.sensorKind = k || null; } else st.sensorKind = kind || null; st.text = text; } else if (m[1] === '~') { st.type = 'wait'; const [n, text] = rest.split('|'); st.minutes = +n; st.text = text; } return st; };
  const A = (id, name, forTypes, use, steps, extra) => Object.assign({ id, name, kind: 'action', forTypes, forType: forTypes[0] || null, forStage: null, use, version: 1, status: 'published', steps: steps.map(parseStep) }, extra || {});
  const ACTION = [
    /* blowers and aeration */
    A('f_blower', 'Blower inspection and intake filter clean', ['Centrifugal blower'], 'fix', ['!Stop the blower and lock out at the MCC', 'Remove and inspect the intake filter', '?Is the filter element clean?', 'Clean with compressed air, or fit the spare element', 'Check belt tension by hand: 10 mm deflection, no glazing', '#Motor current|Restart and record the motor current', '!Remove the lock-out and confirm the blower is running'], { version: 3 }),
    A('f_blower_pm', 'Blower bearing and belt service', ['Centrifugal blower'], 'pm', ['!Isolate at the MCC, lock out, hang the tag', 'Grease both bearings: 2 pumps each, wipe the excess', 'Check belt tension and alignment; replace a cracked or glazed belt', 'Check the coupling and the anti-vibration mounts', 'Clean the intake filter and the silencer', '#Line pressure|Restart and record the discharge pressure', '^Hand back to service; the Lead signs off']),
    A('f_blower_changeover', 'Blower changeover, duty to standby', ['Centrifugal blower'], 'fix', ['@standby Confirm the standby ({{standby}}) is in AUTO and its discharge valve is open', '@standby Start {{standby}} from the panel and watch it come up to pressure', '~5|Let the header pressure settle', '#header.Line pressure|Record the pressure on {{header}} with the standby running', 'Stop {{self}} and raise a repair issue if it did not start by itself']),
    A('f_blower_step_up', 'Raise aeration one step and re-read DO', ['Aeration basin', 'MBBR reactor'], 'fix', ['Raise the blower output one step at the panel, or open the header valve one turn', '~20|Let the basin respond', '#Dissolved oxygen|Re-read DO at the probe location', '?Is DO back above 2 mg/L?', 'If not, start the standby blower and tell the Lead: the load may exceed capacity']),
    A('f_motor_trip', 'Overload trip: inspect and reset', ['Centrifugal blower', 'Submersible pump', 'Mixer', 'Screw press', 'Progressive cavity pump'], 'fix', ['!Lock out at the MCC before touching the machine', 'Turn the shaft by hand; it must move freely without a grinding noise', 'Check the motor for heat, smell and water ingress', '?Did the shaft turn freely and the motor look sound?', 'Reset the overload relay once only; a second trip is a repair, not a reset', '#Motor current|Restart and record the current for two minutes']),
    A('f_diffuser_clean', 'Diffuser inspection and acid clean', ['Aeration basin', 'MBBR reactor'], 'pm', ['Drop the basin level or isolate the grid to be inspected', '!Photograph the bubble pattern before cleaning', 'Inspect diffuser membranes for tearing, bulging and scale', 'Dose formic acid into the air line per the manufacturer card; keep air on', '~30|Let the acid work through the membranes', '!Return to level and photograph the bubble pattern after cleaning', '^Record membranes replaced; the Lead signs off']),
    A('f_bulking_control', 'Filamentous bulking control', ['Aeration basin'], 'fix', ['Take a 1 L sample and run the SV30 test', '#|Record the SV30 settled volume (mL/L)', 'Check F:M: reduce wasting if MLSS is low, raise it if high', 'Dose hypochlorite to the return sludge line at 2 to 3 kg Cl₂ per tonne MLSS per day; never to the basin', '~1440|Hold the dose for one day', '#|Re-run SV30 and record the settled volume', '^The Lead decides whether to continue or stop']),
    A('f_shock_load', 'Shock load response', ['Aeration basin'], 'fix', ['Divert or hold the inflow in the equalisation tank where possible', 'Start the standby blower; run both until DO recovers', 'Stop sludge wasting for 24 hours', '#Dissolved oxygen|Record DO every 2 hours until it holds above 2 mg/L', '^Tell the Lead and the client; they decide on sampling the source']),
    A('f_foam_control', 'Foam control: skim and antifoam', ['Aeration basin'], 'fix', ['!Photograph the foam colour and depth', 'Skim the foam to the scum pit; do not return it to the basin', 'Spray antifoam at the foaming corner only, as per the dosing card', 'Raise wasting for three days to bring the sludge age down']),
    A('f_sludge', 'Sludge wasting', ['Progressive cavity pump', 'Aeration basin'], 'round', ['Check the sludge holding tank has room', 'Open the WAS valve and start the pump', '~20|Run for 20 minutes', '#Run hours|Record the pump run hours', 'Close the valve and log the volume wasted']),
    A('f_sludge_reduce', 'Reduce wasting and rebuild MLSS', ['Aeration basin'], 'fix', ['Halve the daily wasting time for one week', '#MLSS|Record MLSS daily', 'Return to normal wasting when MLSS is back in band']),
    A('f_mbbr_media', 'MBBR media retention screen clear', ['MBBR reactor'], 'pm', ['!Lock out the blower and photograph the screen', 'Clear media and rags from the retention screen by hand', 'Check media is circulating evenly across the tank', 'Restart aeration and confirm the rolling pattern']),
    A('f_digester_alk', 'Digester alkalinity correction', ['Anaerobic tank'], 'fix', ['Reduce the feed rate by half', 'Dose sodium bicarbonate per the dosing card', '~720|Let the digester recover', '#pH|Record pH and resume feed when above 6.8']),
    A('f_desludge', 'Digester desludging', ['Anaerobic tank'], 'pm', ['Confirm the sludge tanker or drying bed has capacity', '!Open the bottom drain and photograph the sludge consistency', '~60|Drain to the marked level', 'Close the drain and flush the line', '^Log the volume removed; the Lead signs off']),
    /* separation */
    A('f_cip', 'MBR clean in place', ['Membrane bioreactor skid'], 'pm', ['Isolate the skid and drain the membrane tank', '!Prepare 500 ppm hypochlorite solution; gloves and goggles on', 'Backpulse the solution into the modules', '~60|Soak for 60 minutes', 'Drain to the EQ tank and rinse with permeate', '#Permeability|Record permeability after the clean', '^Return to service; the Lead signs off'], { version: 2 }),
    A('f_ras_adjust', 'Return sludge rate adjustment', ['Circular clarifier', 'Tube settler'], 'fix', ['#Sludge blanket|Record the blanket depth now', 'Raise the RAS pump rate one step, or start the second RAS pump', '~120|Let the blanket respond', '#Sludge blanket|Re-read the blanket depth', '?Is the blanket back below 1 m?']),
    A('f_scraper_pm', 'Clarifier scraper drive service', ['Circular clarifier'], 'pm', ['!Lock out the scraper drive', 'Check gearbox oil level and top up', 'Grease the centre bearing and the drive chain', 'Inspect the scraper blades and the squeegees for wear', '^Restart and confirm one full revolution without binding']),
    A('f_tube_clean', 'Tube settler module cleaning', ['Tube settler'], 'pm', ['Lower the water level below the tube modules', '!Photograph the modules before cleaning', 'Hose the modules from above until the tubes run clear', 'Check modules for sagging or broken tubes', 'Refill slowly and confirm even flow over the launders']),
    A('f_daf_pm', 'DAF saturator and scraper service', ['DAF unit'], 'pm', ['!Lock out the recycle pump and the scraper', 'Drain and inspect the saturator vessel; clear scale from the injection nozzle', 'Check the air regulator and the pressure gauge', 'Grease the scraper drive and check the flights', '#Motor current|Restart and record the scraper current']),
    /* filtration */
    A('f_backwash', 'Backwash filter', ['Multigrade filter'], 'condition', ['Close the inlet valve', 'Open the backwash valve and start the backwash pump', '~8|Backwash for 8 minutes', 'Rinse to drain for 4 minutes', '#Differential pressure|Record the differential pressure after rinse', '*Return the filter to service'], { version: 3 }),
    A('f_media_inspect', 'Filter media inspection and top-up', ['Multigrade filter'], 'pm', ['Drain the filter to 10 cm above the media', '!Photograph the media surface: cracks, mud balls, uneven bed', 'Rake the top 5 cm and remove mud balls', 'Top up media to the marked level if it has dropped', 'Run two backwashes before returning to service']),
    A('f_valve_check', 'Valve line-up check', [], 'fix', ['Walk the line from source to destination and check every valve position against the P&ID card', '!Photograph any valve found in the wrong position', 'Set each valve correctly and confirm flow', 'Log who last operated the valve, if known']),
    A('f_uf_cip', 'UF chemically enhanced backwash', ['Ultrafiltration skid'], 'pm', ['Isolate the skid and run a normal backwash', '!Prepare the hypochlorite solution; gloves and goggles on', 'Backwash the solution into the modules and close the valves', '~30|Soak for 30 minutes', 'Flush to drain until residual chlorine is below 0.2 mg/L', '#Recovery|Return to production and record the recovery', '^The Lead signs off']),
    A('f_ro_cip', 'RO membrane clean in place', ['RO skid'], 'pm', ['Shut down and flush with permeate', 'Prepare the low-pH clean (citric) to the card strength', 'Circulate for 30 minutes, then soak', '~60|Soak for one hour', 'Flush, then repeat with the high-pH clean if biofouling is suspected', '#Recovery|Return to service and record the recovery', '^The Lead signs off']),
    A('f_cartridge_replace', 'Cartridge replacement', ['Cartridge filter', 'RO skid'], 'pm', ['Isolate the housing and vent the pressure', '!Open the housing and photograph the old cartridges', 'Fit new cartridges; check the O-ring seats', '#Differential pressure|Return to service and record the differential pressure']),
    A('f_softener_regen', 'Softener regeneration', ['Softener'], 'condition', ['Check brine tank salt level; top up to the mark', 'Start the regeneration cycle from the controller', '~90|Let the cycle complete', 'Rinse until the outlet runs clear of brine', '#|Record outlet hardness (ppm as CaCO₃)', 'Reset the throughput counter']),
    /* disinfection */
    A('f_hypo_refill', 'Hypo tank refill', ['Hypochlorite dosing unit'], 'round', ['!Gloves, goggles and apron on; have water to hand', 'Check the drum date; hypo older than 30 days has lost strength', 'Transfer with the drum pump, never by pouring', '#Hypo tank level|Record the tank level after filling', 'Rinse the pump and store the drum out of the sun']),
    A('f_dosing_pump_service', 'Dosing pump service', ['Hypochlorite dosing unit'], 'pm', ['!Isolate the suction and discharge valves; depressurise', 'Replace the diaphragm and the suction and discharge valve balls', 'Clean the foot valve and the strainer', 'Re-prime and check for leaks at the head', '#Residual chlorine|Return to service and record the outlet residual']),
    A('f_dose_adjust', 'Chlorine dose adjustment with DPD check', ['Hypochlorite dosing unit', 'Gas chlorinator'], 'fix', ['#Residual chlorine|Record the outlet residual from the probe', '#|Test the outlet with the DPD kit and record the result (mg/L)', 'Raise the stroke or the feed rate one step', '~30|Let the contact tank turn over', '#|Re-test with the DPD kit and record']),
    A('f_uv_lamp', 'UV lamp and sleeve replacement', ['UV unit'], 'pm', ['!Switch off, lock out and let the lamps cool for 10 minutes', 'Withdraw the lamp and the quartz sleeve', 'Clean the sleeve with the descaler, or replace it if etched', 'Fit the new lamp with gloves; never touch the glass', 'Reset the lamp-hours counter', '^Restart and confirm the intensity reading']),
    A('f_ozone_reset', 'Ozonator reset and air dryer check', ['Ozonator'], 'fix', ['Check the air dryer dew point and drain the moisture trap', 'Reset the dew-point trip', 'Restart and watch the ozone output for five minutes', 'If it trips again, raise a repair issue']),
    A('f_ozone_pm', 'Ozonator generator service', ['Ozonator'], 'pm', ['!Lock out the generator and the oxygen or air supply', 'Replace the air dryer desiccant and the filters', 'Check the cooling water flow and the dielectric cells', '^Restart and confirm output; the Lead signs off']),
    A('f_tonner_change', 'Chlorine tonner change', ['Gas chlorinator'], 'round', ['!Two people, canister masks on, ammonia bottle ready for leak check', 'Close the tonner valve and let the chlorinator draw the line down', 'Disconnect the yoke and cap the empty tonner', 'Connect the full tonner with a new lead gasket', '!Open the valve a quarter turn and leak-check with the ammonia bottle', '#Residual chlorine|Return to service and record the outlet residual', '^The Lead signs off']),
    A('f_chem_refill', 'Chemical tank refill', ['Dosing tank'], 'round', ['!Gloves and goggles on; check the chemical label matches the tank', 'Fill to the mark; never mix chemicals in one tank', '#Hypo tank level|Record the tank level after filling', 'Prime the dosing pump and check for leaks']),
    A('f_ph_corr', 'pH correction dosing', ['Equalisation tank'], 'fix', ['Confirm the dosing pump is primed', '#pH|Read pH at the equalisation tank', 'Adjust the dosing rate one increment', '~15|Let the tank mix before re-reading', '#pH|Re-read pH and confirm it is trending back'], { version: 2 }),
    A('f_mixer_restart', 'Agitator restart and inspection', ['Mixer', 'Equalisation tank'], 'fix', ['!Lock out and check the propeller for rags', 'Turn the shaft by hand', 'Reset and restart from the panel', '#Motor current|Record the current for two minutes']),
    /* inlet works */
    A('f_screen', 'Clear bar screen', ['Mechanical bar screen'], 'fix', ['Stop the rake and lock out', '!Rake screenings by hand into the skip', '#Level differential|Record the level differential after clearing', 'Restart the rake and confirm free travel'], { version: 2 }),
    A('f_screen_inspect', 'Rake and screen inspection', ['Mechanical bar screen'], 'round', ['?Is the rake cycling and discharging into the skip?', '*Check the bar spacing for lodged debris', '#Level differential|Record the level differential', 'Empty the screenings skip if more than half full']),
    A('f_screen_drive', 'Screen rake drive service', ['Mechanical bar screen'], 'pm', ['!Lock out the rake drive', 'Check chain tension and sprocket wear; grease the chain', 'Check the limit switches and the torque trip', 'Inspect the rake teeth and the wiper', '^Restart and confirm three full cycles']),
    A('f_grit_remove', 'Grit removal', ['Grit chamber'], 'round', ['Isolate the chamber and drain to the grit level', '!Remove grit to the skip; photograph the fill level', 'Hose down and return to service']),
    A('f_surge_mgmt', 'Hydraulic surge management', ['Equalisation tank'], 'fix', ['Open the bypass to the equalisation tank, or throttle the inlet gate', 'Start the standby transfer pump', '#Level|Record the tank level every 30 minutes until it falls', 'Tell the Lead if the level is still rising after two hours']),
    A('f_pump_lift', 'Pump lift and inspect', ['Submersible pump', 'Progressive cavity pump'], 'pm', ['!Isolate at the MCC, lock out, and close the delivery valve', 'Lift the pump on the guide rails; two people', '!Clear rags from the impeller and photograph the impeller and the volute', 'Check the cable gland and the seal chamber oil for water', 'Grease or replace the seal per the card', 'Lower the pump and confirm it seats on the pedestal', '#Motor current|Restart and record the current']),
    A('f_pump_prime', 'Pump priming and air release', ['Submersible pump'], 'fix', ['@standby Start the standby ({{standby}}) so the plant keeps flowing', 'Stop {{self}}', 'Open the air release valve on {{discharge}} until water runs', '@suction Check the level in {{suction}} is above the pump', 'Restart and confirm delivery', '#Motor current|Record the running current']),
    A('f_float_check', 'Level float check', ['Submersible pump', 'Equalisation tank'], 'fix', ['Lift the float and confirm the pump starts', 'Clear rags from the float cable', '!Photograph the float position at the correct level']),
    A('f_pc_pump_pm', 'PC pump stator and rotor check', ['Progressive cavity pump'], 'pm', ['!Isolate, lock out and drain the pump casing', 'Open the stator housing and check the stator for swelling and wear', 'Check the rotor and the coupling rod joints', 'Reassemble and grease the joints', '#Run hours|Restart and record the run hours']),
    /* sludge */
    A('f_poly_jar_test', 'Polymer dose jar test', ['Screw press', 'Filter press'], 'fix', ['Take 1 L of feed sludge in a jar', 'Add polymer in steps and stir; note the dose where flocs form and water clears', '#|Record the best dose (kg polymer per tonne dry solids)', 'Set the polymer pump to the new dose', '*Photograph the cake at the new dose']),
    A('f_press_wash', 'Screw press screen wash', ['Screw press'], 'pm', ['!Stop the press and lock out', 'Run the screen wash cycle twice', 'Open the covers and hose the screen until the slots run clear', 'Check the screw flights for wear', '^Restart and confirm cake forming']),
    A('f_cloth_change', 'Filter press cloth inspection and change', ['Filter press'], 'pm', ['!Depressurise the hydraulic ram and lock out', 'Open the plates and inspect each cloth for blinding and tears', 'Hose blinded cloths; replace torn ones', 'Check the plate alignment and the ram seals', '^Close up and run one cycle; the Lead signs off']),
    /* utilities */
    A('f_mcc_reset', 'MCC incomer inspection and reset', ['Control panel (MCC)'], 'fix', ['!Check all three phases on the incomer meter and photograph', 'Check the earth-fault and overload indications', 'Reset once only after the cause is known', 'Restart machines in order: pumps, blowers, dosing']),
    A('f_mcc_thermal', 'MCC thermal and tightness inspection', ['Control panel (MCC)'], 'pm', ['!Thermal-image every busbar joint and breaker under load; photograph hot spots', 'Isolate, lock out and torque-check the joints found warm', 'Clean the panel filters and check the cooling fans', 'Check the earth bonding and the door interlocks', '^Close up; the Lead signs off']),
    A('f_compressor_pm', 'Compressor service', ['Air compressor'], 'pm', ['!Isolate, lock out and vent the receiver', 'Change the oil and the oil filter; clean the intake filter', 'Drain the receiver and the moisture traps', 'Check belts and the safety valve', '#Line pressure|Restart and record the line pressure']),
    A('f_ct_clean', 'Cooling tower fill and basin clean', ['Cooling tower'], 'pm', ['!Lock out the fan and the circulation pump', 'Drain the basin and remove sludge and scale', 'Hose the fill from above; replace collapsed fill', 'Check the fan belt and the gearbox oil', 'Refill, restart and confirm even water distribution']),
    A('f_power_restore', 'Power restore and DG changeover check', [], 'fix', ['Confirm the DG has taken load, or the mains is back', 'Restart machines in order: pumps, blowers, dosing', '#|Record the outage duration (minutes)', 'Check every alert that paused during the outage has cleared']),
    A('f_probe_clean', 'Probe cleaning', [], 'pm', ['Lift the probe and rinse with clean water', '*Wipe the sensing face with a soft cloth; photograph any damage', 'Return to position and wait five minutes', '#|Compare with a handheld reading and record the difference']),
    /* calibration */
    A('f_do_cal', 'DO probe calibration', ['Aeration basin', 'MBBR reactor'], 'calibration', ['Lift the probe, rinse and dry the membrane', 'Hold in water-saturated air for 10 minutes', '#|Record the saturation reading (% or mg/L) before adjustment', 'Set the span to saturation on the transmitter', '#|Record the reading after adjustment and return the probe']),
    A('f_ph_cal', 'pH probe two-point calibration', ['Equalisation tank', 'Anaerobic tank'], 'calibration', ['Rinse the probe and place it in pH 7 buffer', '#|Record the reading in pH 7 buffer before adjustment', 'Set the zero, rinse, and place in pH 4 or pH 10 buffer', '#|Record the reading in the second buffer and set the slope', 'Replace the probe if the slope is below 85%']),
    A('f_turb_cal', 'Turbidity meter calibration', ['Membrane bioreactor skid', 'Ultrafiltration skid'], 'calibration', ['Clean the cuvette or flow cell', '#|Record the reading in the formazin standard before adjustment', 'Set the span to the standard value', '#|Record the reading after adjustment']),
    A('f_probe_cal', 'Probe calibration against reference', [], 'calibration', ['Clean the probe and take a reference sample', '#|Record the reference instrument reading', 'Adjust the transmitter to match the reference', '#|Record the reading after adjustment']),
    /* rounds */
    A('f_logbook', 'Daily logbook round', [], 'round', ['Collect the logbook tablet and check the handover notes', '#|Inlet works: record the totaliser flow (m³)', '?Bar screen: is the rake running and the channel clear?', '#Level|Equalisation tank: record the level', '#Dissolved oxygen|Aeration: record dissolved oxygen', 'Fill the settling cone to 1 litre', '~30|Let the sludge settle; carry on with the round', '#|Record the settled volume, SV30 (mL/L)', '#Sludge blanket|Clarifier: record the sludge blanket depth', '#Residual chlorine|Outlet: record residual chlorine', '!Outlet: take the sample and photograph it against the label', '*Record anything unusual: noise, smell, leaks'], { version: 4 }),
    A('f_sv30', 'SV30 settling test', ['Aeration basin'], 'round', ['Fill the settling cone to 1 litre from the aeration tank', '~30|Let the sludge settle', '#|Record the settled volume (mL/L)', '?Is the supernatant clear?']),
    A('f_frc_round', 'Outlet residual chlorine check', ['Hypochlorite dosing unit', 'Gas chlorinator'], 'round', ['#|Test the outlet with the DPD kit and record (mg/L)', '#Residual chlorine|Record the probe reading at the same time', '?Do the two agree within 0.1 mg/L?']),
    A('f_inlet_round', 'Screenings and grit check', ['Mechanical bar screen', 'Grit chamber'], 'round', ['?Is the rake cycling and the channel clear?', '#|Record the screenings bins removed since the last round', '*Check the grit chamber fill and photograph if above the mark']),
    A('f_sample', 'Compliance sample', [], 'round', ['Rinse the sample bottle three times with the outlet water', '!Fill, cap and photograph the bottle against the label with the time', 'Store in the cool box and hand to the courier before noon', '^Log the sample id; the Lead signs off']),
    A('f_hooter_test', 'Hooter function test', [], 'round', ['Tell everyone on site a test is about to run', 'Trigger the hooter from the panel test button', '?Was it heard at the furthest point of the plant?', '^Log the test; the Lead signs off']),
    A('f_housekeeping', 'Weekly housekeeping round', [], 'round', ['Walk every unit process; clear rags, spills and growth from walkways', '*Photograph anything left unsafe', 'Check every guard and handrail is in place', 'Check the chemical store: labels, bunds, eyewash']),
    A('f_eq_clean', 'Equalisation tank cleaning', ['Equalisation tank'], 'pm', ['Pump the tank down during low inflow', '!Wash down the walls and remove grit from the floor; photograph before and after', 'Check the float switches and the mixer propeller', 'Return to service']),
    A('f_tank_clean', 'Tank cleaning', ['Process tank', 'Dosing tank'], 'pm', ['Isolate and drain the tank', '!Wash down and remove sediment; photograph the floor', 'Check the level sensor and the drain valve', 'Refill and return to service']),
    A('f_gearbox_pm', 'Gearbox and bearing service', ['Mixer'], 'pm', ['!Lock out the drive', 'Check gearbox oil level and top up', 'Grease the bearings', '#Motor current|Restart and record the current']),
    /* v2: fix flows that read the plant through its connections */
    A('f_pump_dryrun', 'Low discharge pressure: dry run or blocked line', ['Submersible pump', 'Progressive cavity pump'], 'fix', ['@suction Check the level in {{suction}}: is there water above the pump?', '?Is the pump running and drawing current?', 'Open the discharge valve fully and check the non-return valve on {{discharge}}', '@standby Start the standby ({{standby}}) if the line must stay pressurised', '!Stop the pump and lock out if it is running dry', '#discharge.Line pressure|Record the pressure on {{discharge}} after the change', 'Raise a repair issue if the pressure did not recover']),
    A('f_pump_stop', 'Suction tank empty: stop the pump', ['Submersible pump', 'Progressive cavity pump'], 'fix', ['!Stop the pump before it runs dry', 'Check the level float in {{suction}} by hand', '@standby Confirm the standby ({{standby}}) is also stopped', 'Restart when the level is back above the stop float', '#suction.Level|Record the level in {{suction}}']),
    A('f_blower_header', 'Header pressure high: find the restriction', ['Centrifugal blower'], 'fix', ['Check every drop valve on {{header}} is open to {{basins}}', '?Is bubbling even across the basins?', 'Open the blow-off valve one turn to relieve the header', '@standby Stop the standby ({{standby}}) if both are running into one header', 'Inspect the diffuser lines for a closed isolation valve', '#header.Line pressure|Record the pressure on {{header}} after the change']),
    A('f_uf_fix', 'Low permeate: check feed and backwash', ['Ultrafiltration skid', 'RO skid'], 'fix', ['#feed.Line pressure|Record the feed pressure on {{feed}}', '?Is the feed pump running?', 'Run a manual backwash and a forward flush', '#permeate.Flow|Record the permeate flow on {{permeate}} after the flush', 'If still low, bring the CIP forward and tell the Lead']),
    A('f_integrity_test', 'Membrane integrity test', ['Membrane bioreactor skid', 'Ultrafiltration skid', 'RO skid'], 'fix', ['Isolate the skid and drain the permeate side', 'Pressurise the feed side with air to the test pressure on the card', '~5|Hold and watch the decay', '#|Record the pressure decay (bar over 5 min)', '?Is the decay inside the limit on the card?', 'Pin the leaking module or fibre and plug it per the manufacturer card', '^Return to service; the Lead signs off']),
    A('f_weir_level', 'Level the weir and stop the short-circuit', ['Circular clarifier', 'Tube settler'], 'fix', ['!Photograph the overflow along the full weir length', 'Find the low side: where flow is heaviest', 'Loosen the plates and re-level with a water level, 2 mm end to end', 'Clear algae and scale from the notches', '!Photograph the overflow after levelling']),
    A('f_mbr_fix', 'Permeate falling: relax and check', ['Membrane bioreactor skid'], 'fix', ['Stop permeation and relax the membranes', '~10|Let the membranes relax', 'Check the air scour is on and even across the tank', '#permeate.Flow|Record the permeate flow on {{permeate}} after relaxation', 'If still low, bring the CIP forward and tell the Lead']),
  ];

  /* ── 3. (v2) No diagnostic flows. The cause is recorded when the record closes; see CAUSES. ── */

  /* ── 4. Bind to the library: which flow an inherited alert opens, which flow a schedule runs,
     and which cause a scheduled task logs against (the failure the work prevents). ─────────── */
  const BIND = {
    'Centrifugal blower': { alerts: { 'Line pressure high': { flow: 'f_blower_press' }, 'Motor current high': { flow: 'f_blower_current' }, 'Blower tripped': { flow: 'f_blower_trip' } }, schedules: { 'Bearing service': { flow: 'f_blower_pm', cause: 'c_bearing_wear' }, 'Clean intake filter': { flow: 'f_blower', cause: 'c_intake' } } },
    'Aeration basin': { alerts: { 'DO low': { flow: 'f_lowdo' }, 'MLSS out of band': { flow: 'f_mlss' }, 'Temperature high': { cause: 'c_temp_high' } }, schedules: { 'DO probe calibration': { flow: 'f_do_cal' } } },
    'MBBR reactor': { alerts: { 'DO low': { flow: 'f_mbbr' } }, schedules: { 'Media and diffuser inspection': { flow: 'f_mbbr_media', cause: 'c_media_loss' } } },
    'Anaerobic tank': { alerts: { 'pH low': { flow: 'f_anaerobic' } }, schedules: { 'Desludging': { flow: 'f_desludge' } } },
    'Equalisation tank': { alerts: { 'Level high': { flow: 'f_eq_level' }, 'pH out of band': { flow: 'f_ph' }, 'Sump flooding': { flow: 'f_sump_flood' } }, schedules: { 'Tank cleaning': { flow: 'f_eq_clean' } } },
    'Process tank': { alerts: { 'Level high': { flow: 'f_eq_level' } }, schedules: { 'Tank cleaning': { flow: 'f_tank_clean' } } },
    'Mechanical bar screen': { alerts: { 'Screen differential high': { flow: 'f_screen_dh' } }, schedules: { 'Weekly rake and screen inspection': { flow: 'f_screen_inspect', cause: 'c_rake_drive' } } },
    'Grit chamber': { alerts: {}, schedules: { 'Grit removal': { flow: 'f_grit_remove', cause: 'c_grit_full' } } },
    'Circular clarifier': { alerts: { 'Sludge blanket high': { flow: 'f_blanket' } }, schedules: { 'Scraper drive service': { flow: 'f_scraper_pm', cause: 'c_scraper' } } },
    'Tube settler': { alerts: { 'Sludge blanket high': { flow: 'f_blanket' } }, schedules: { 'Tube module cleaning': { flow: 'f_tube_clean', cause: 'c_tube_clog' } } },
    'Membrane bioreactor skid': { alerts: { 'Permeability falling': { flow: 'f_turb' }, 'Outlet turbidity high': { flow: 'f_turb' } }, schedules: { 'Quarterly CIP': { flow: 'f_cip', cause: 'c_fouling' } } },
    'DAF unit': { alerts: { 'Motor current high': { flow: 'f_daf' } }, schedules: { 'Saturator and scraper service': { flow: 'f_daf_pm', cause: 'c_daf_saturator' } } },
    'Multigrade filter': { alerts: { 'Backwash not keeping up': { flow: 'f_mgf_dp' } }, schedules: { 'Backwash when pressure builds': { flow: 'f_backwash', cause: 'c_media_choked' } } },
    'Ultrafiltration skid': { alerts: { 'Recovery low': { flow: 'f_uf' }, 'Inlet pressure high': { flow: 'f_uf' } }, schedules: { 'Quarterly CIP': { flow: 'f_uf_cip', cause: 'c_uf_fouling' } } },
    'RO skid': { alerts: { 'Recovery low': { flow: 'f_ro' }, 'Inlet pressure high': { flow: 'f_ro' } }, schedules: { 'Membrane CIP': { flow: 'f_ro_cip', cause: 'c_ro_scaling' } } },
    'Softener': { alerts: {}, schedules: { 'Regenerate softener': { flow: 'f_softener_regen', cause: 'c_softener_exhaust' } } },
    'Cartridge filter': { alerts: { 'Cartridge choked': { cause: 'c_cartridge' } }, schedules: { 'Cartridge replacement': { flow: 'f_cartridge_replace', cause: 'c_cartridge' } } },
    'Hypochlorite dosing unit': { alerts: { 'Residual chlorine low': { flow: 'f_frc' }, 'Hypo tank low': { cause: 'c_hypo_empty' } }, schedules: { 'Dosing pump service': { flow: 'f_dosing_pump_service', cause: 'c_dosing_pump' }, 'Hypo tank refill': { flow: 'f_hypo_refill', cause: 'c_hypo_empty' } } },
    'Dosing tank': { alerts: { 'Chemical tank low': { cause: 'c_dosing_empty' } }, schedules: { 'Chemical refill': { flow: 'f_chem_refill', cause: 'c_dosing_empty' } } },
    'UV unit': { alerts: { 'UV lamp fault': { flow: 'f_uv' } }, schedules: { 'Lamp and sleeve replacement': { flow: 'f_uv_lamp', cause: 'c_uv_lamp' } } },
    'Ozonator': { alerts: { 'Ozonator tripped': { cause: 'c_ozone_trip' } }, schedules: { 'Generator service': { flow: 'f_ozone_pm' } } },
    'Gas chlorinator': { alerts: { 'Residual chlorine low': { flow: 'f_gas_frc' } }, schedules: { 'Tonner change': { flow: 'f_tonner_change', cause: 'c_tonner_empty' } } },
    'Progressive cavity pump': { alerts: {}, schedules: { 'Stator and rotor check': { flow: 'f_pc_pump_pm', cause: 'c_stator' } } },
    'Submersible pump': { alerts: { 'Motor current high': { flow: 'f_pump_fail' } }, schedules: { 'Bearing and seal service': { flow: 'f_pump_lift', cause: 'c_pump_seal' } } },
    'Mixer': { alerts: { 'Motor current high': { flow: 'f_rotating_current' } }, schedules: { 'Gearbox and bearing service': { flow: 'f_gearbox_pm', cause: 'c_bearing_wear' } } },
    'Screw press': { alerts: { 'Motor current high': { flow: 'f_rotating_current' } }, schedules: { 'Screw and screen service': { flow: 'f_press_wash', cause: 'c_screen_blind' } } },
    'Filter press': { alerts: {}, schedules: { 'Hydraulic and cloth inspection': { flow: 'f_cloth_change', cause: 'c_cloth' } } },
    'Air compressor': { alerts: { 'Air pressure low': { flow: 'f_compressor' } }, schedules: { 'Compressor service': { flow: 'f_compressor_pm', cause: 'c_compressor_leak' } } },
    'Cooling tower': { alerts: { 'Outlet temperature high': { flow: 'f_ct' } }, schedules: { 'Fill and fan service': { flow: 'f_ct_clean', cause: 'c_ct_scale' } } },
    'Control panel (MCC)': { alerts: { 'Incomer tripped': { cause: 'c_mcc_trip' } }, schedules: { 'Thermal and tightness inspection': { flow: 'f_mcc_thermal' } } },
  };
  /* v2: the diagnostic each alert used to open becomes the generic fix flow it runs. */
  const FIX_FOR = { f_blower_press: 'f_blower', f_blower_current: 'f_blower', f_blower_trip: 'f_motor_trip', f_lowdo: 'f_blower_step_up', f_mlss: 'f_sludge', f_mbbr: 'f_blower_step_up', f_anaerobic: 'f_digester_alk', f_eq_level: 'f_surge_mgmt', f_ph: 'f_ph_corr', f_sump_flood: 'f_surge_mgmt', f_screen_dh: 'f_screen', f_blanket: 'f_ras_adjust', f_turb: 'f_mbr_fix', f_daf: 'f_motor_trip', f_mgf_dp: 'f_backwash', f_uf: 'f_uf_fix', f_ro: 'f_uf_fix', f_frc: 'f_dose_adjust', f_gas_frc: 'f_dose_adjust', f_uv: 'f_uv_lamp', f_press: 'f_press_wash', f_compressor: 'f_compressor_pm', f_ct: 'f_ct_clean', f_pump_fail: 'f_pump_prime', f_rotating_current: 'f_motor_trip', f_foam: 'f_foam_control', f_odour: null, f_effluent: null };
  Object.values(BIND).forEach((b) => Object.values(b.alerts).forEach((x) => { if (x.flow && x.flow in FIX_FOR) x.flow = FIX_FOR[x.flow]; }));
  window.FIX_FOR_DIAG = FIX_FOR;
  /* Which calibration flow a probe gets, by what it reads. */
  window.CAL_FLOWS = { 'Dissolved oxygen': 'f_do_cal', 'pH': 'f_ph_cal', 'Outlet turbidity': 'f_turb_cal' };
  window.CAL_FLOW_DEFAULT = 'f_probe_cal';

  /* ── 5. Install ─────────────────────────────────────────────────────────────────────────── */
  const SEED = window.SEED;
  SEED.flows = [...ACTION];
  SEED.causes = CAUSES;
  /* v2: causes that had no fix flow get the generic one. */
  SEED.causes.forEach((c) => { if (!c.fix && !c.sensorFault && !c.noFault) c.fix = { c_seal: 'f_integrity_test', c_uf_fibre: 'f_integrity_test', c_weir_uneven: 'f_weir_level', c_temp_high: 'f_shock_load' }[c.id] || c.fix; });
  /* Two alerts the library did not have: the screen's differential and the sump flood contact. */
  const scr = SEED.standardSets.find((t) => t.type === 'Mechanical bar screen'); if (scr && !scr.alerts.length) scr.alerts.push({ name: 'Screen differential high', sensorKind: 'Level differential', direction: 'above', limits: { minor: 150, major: 300 } });
  const eqt = SEED.standardSets.find((t) => t.type === 'Equalisation tank'); if (eqt && !eqt.alerts.some((a) => a.name === 'Sump flooding')) eqt.alerts.push({ name: 'Sump flooding', sensorKind: 'Sump flood switch', direction: 'above', limits: { emergency: 1 } });
  SEED.standardSets.forEach((t) => { const b = BIND[t.type]; if (!b) return; t.alerts.forEach((a) => { const x = b.alerts[a.name]; if (x) { if (x.flow) a.flow = x.flow; if (x.cause) a.cause = x.cause; } }); t.schedules.forEach((s) => { const x = b.schedules[s.name]; if (x) { if (x.flow) s.flow = x.flow; if (x.cause) s.cause = x.cause; } }); });
  /* Unit-process and plant rounds run a flow too. */
  const UPF = { 'Screenings and grit check': 'f_inlet_round', 'SV30 settling test': 'f_sv30', 'Outlet residual chlorine check': 'f_frc_round', 'Sludge wasting': 'f_sludge' };
  window.UP_PROFILES.forEach((p) => p.rounds.forEach((r2) => { if (UPF[r2.name]) r2.flow = UPF[r2.name]; }));
  const PF = { 'Daily logbook round': 'f_logbook', 'Monthly compliance sample': 'f_sample', 'Weekly bacteriological sample': 'f_sample', 'Hooter function test': 'f_hooter_test', 'Weekly housekeeping round': 'f_housekeeping' };
  Object.values(window.PLANT_PROFILES).forEach((p) => p.rounds.forEach((r2) => { if (PF[r2.name]) r2.flow = PF[r2.name]; }));
  /* Expected time and parts, for the month's plan. */
  const HOURS = { 'Bearing service': [4, '2 bearings 6206, 1 belt B48, grease'], 'Bearing and seal service': [5, 'mechanical seal, seal oil'], 'Quarterly CIP': [6, '25 kg hypochlorite'], 'Membrane CIP': [6, 'citric acid 10 kg, hypochlorite 10 kg'], 'Scraper drive service': [3, 'gear oil 2 L, grease'], 'Tube module cleaning': [4, ''], 'Media and diffuser inspection': [4, ''], 'Tank cleaning': [6, ''], 'Dosing pump service': [2, 'diaphragm, valve balls'], 'Lamp and sleeve replacement': [2, 'UV lamp, quartz sleeve'], 'Cartridge replacement': [1, 'cartridges 5 µm × 4'], 'Screw and screen service': [3, ''], 'Hydraulic and cloth inspection': [5, 'filter cloths as found'], 'Stator and rotor check': [3, 'stator if swollen'], 'Gearbox and bearing service': [3, 'gear oil 1 L, grease'], 'Compressor service': [3, 'oil 2 L, oil filter, intake filter'], 'Fill and fan service': [6, 'fan belt'], 'Thermal and tightness inspection': [4, ''], 'Generator service': [3, 'desiccant, filters'], 'Desludging': [6, ''], 'Saturator and scraper service': [3, 'grease'], 'Weekly rake and screen inspection': [0.5, ''], 'Grit removal': [1, ''], 'Weekly backwash': [1, ''], 'Hypo tank refill': [0.5, '200 L hypochlorite'], 'Chemical refill': [0.5, ''], 'Tonner change': [1.5, 'lead gasket'], 'Daily logbook round': [1, ''], 'Monthly compliance sample': [1, 'sample bottles'], 'Hooter function test': [0.25, ''], 'Weekly housekeeping round': [1.5, ''], 'SV30 settling test': [0.75, ''], 'Outlet residual chlorine check': [0.25, 'DPD tablets'], 'Sludge wasting': [0.5, ''], 'Screenings and grit check': [0.25, ''] };
  const withHours = (s) => { const h = HOURS[s.name]; if (h) { s.hours = h[0]; if (h[1]) s.parts = h[1]; } };
  SEED.standardSets.forEach((t) => t.schedules.forEach(withHours)); window.UP_PROFILES.forEach((p) => p.rounds.forEach(withHours)); Object.values(window.PLANT_PROFILES).forEach((p) => p.rounds.forEach(withHours));
  SEED.schedules.forEach(withHours); SEED.schedules.forEach((s) => { if (s.workType === 'calibration' && !s.hours) s.hours = 1; });
  /* The sample plant's own records point at the richer library. */
  SEED.schedules.forEach((s) => { if (s.name === 'Bearing service') { s.flow = 'f_blower_pm'; s.cause = 'c_bearing_wear'; } if (s.name === 'Quarterly CIP') s.cause = 'c_fouling'; if (s.name === 'Weekly backwash') s.cause = 'c_media_choked'; if (s.name === 'Monthly compliance sample') s.flow = 'f_sample'; if (s.name === 'Hooter function test') s.flow = 'f_hooter_test'; if (s.name === 'Sludge wasting') s.flow = 'f_sludge'; });
  SEED.conditionWork.forEach((w) => { if (w.name === 'Backwash when pressure builds') w.cause = 'c_media_choked'; if (w.name === 'Clean intake filter') w.cause = 'c_intake'; });
  SEED.alerts.forEach((a) => { if (a.flow && a.flow in FIX_FOR) a.flow = FIX_FOR[a.flow]; }); SEED.standardSets.forEach((t) => t.alerts.forEach((a) => { if (a.flow && a.flow in FIX_FOR) a.flow = FIX_FOR[a.flow]; }));
  SEED.alerts.forEach((a) => { if (a.name.startsWith('Line pressure high')) a.flow = 'f_blower'; if (a.name.startsWith('Sludge blanket high')) a.flow = 'f_ras_adjust'; if (a.name.startsWith('Residual chlorine low')) a.flow = 'f_dose_adjust'; if (a.name.startsWith('Backwash not keeping up')) a.flow = 'f_backwash'; if (a.name.startsWith('Sump flooding')) a.flow = 'f_surge_mgmt'; if (a.name.startsWith('MLSS high')) a.flow = 'f_sludge'; });
  /* Reading steps in the sample plant's flows bind to its real sensors where the kind matches. */
  const bindOn = { f_logbook: null };
  SEED.flows.forEach((f) => f.steps.forEach((st) => { if (st.type !== 'reading' || st.sensor || !st.sensorKind) return; const home = bindOn[f.id]; const s = SEED.sensors.find((x) => x.name === st.sensorKind && (!home || x.on === 'eq:' + home)); if (s && f.id === 'f_logbook') st.sensor = s.id; }));
})();
