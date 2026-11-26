/* v7/7 and v7/8 · upalert78.js — alerts across a unit process.
   An equipment type stands for one piece of equipment with its own identity, so its alerts read only what sits on it.
   A unit process is a treatment step: a tank, the equipment that serves it and the pipes between them. Its alerts are written
   against kinds of reading, wherever in the step the sensor sits, on equipment or on a pipe. One alert may club several
   kinds of reading together, and it leads to one piece of work: an issue with its diagnostic, a task, or a calibration.

   In the library (Global Admin):  alerts(code) · saveAlert(code, alert) · removeAlert(code, id)
     alert = { id, name, match: 'all' | 'any', when: [{ reading, dir: 'above' | 'below', limit, of: 'any' | 'all' }], band, hold,
               starts: { kind: 'issue' | 'task' | 'calibration', flowId } }
   At a plant (when it inherits):  offers(key) → one line per unit process and alert:
     { pid, upId, upTag, upName, typeName, alert, conds: [{ reading, dir, limit, of, unit, kind, found: [sensor], use: [sensorId] }],
       missing: [reading], skipped, state: null | 'applied' | 'left', own, now: { fires, parts } }
     decide(key, pid, 'applied' | 'left' | null) · edit(key, pid, { name, match, when: [{ reading, dir, limit, of, use }], band, hold })
     scope(key, upId) → every sensor in the unit process, on equipment or on a pipe
   A kind of reading nothing in the unit process sends is named, and an alert that cannot work without it is skipped and flagged.
   This prototype works out whether an applied alert would fire on the latest readings; it does not open the issue or the task. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const C = () => W.CTL;
  const BANDS = ['caution', 'minor', 'major', 'emergency']; const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const arr = (x) => (Array.isArray(x) ? x : []); const clone = (x) => JSON.parse(JSON.stringify(x));
  /* two levels with no library type of their own: every control group, and the plant as a whole */
  const PSEUDO = { '@group': { type: 'Control group', library: 'process', sk: 'group', sensors: [] }, '@plant': { type: 'The plant', library: 'process', sk: 'plant', sensors: [] } };
  const cat = (code) => PSEUDO[code] || (W.CATALOGUE_BY_CODE && W.CATALOGUE_BY_CODE[code]) || null;
  const RD = (n) => (W.READINGS || {})[n] || null;
  const flows = () => arr(C() && C().S && C().S.lib ? C().S.lib.flows : []);
  const flowById = (id) => (id ? flows().find((f) => f.id === id) || null : null);
  const isCal = (f) => f.kind !== 'diagnostic' && (f.use === 'calibration' || /calibrat/i.test(f.name || ''));
  const flowFits = (kind, f) => !!f && (kind === 'issue' ? f.kind === 'diagnostic' : kind === 'calibration' ? isCal(f) : f.kind !== 'diagnostic' && f.use !== 'fix');
  const w = (reading, dir, limit, of) => ({ reading, dir, limit, of: of || 'any' });
  const A = (id, name, match, when, band, hold, kind, flowId) => ({ id, name, match, when, band, hold, starts: { kind, flowId: flowId || null } });
  /* what the library ships with: a first draft, to confirm.
     27 Nov: enriched now that a sensor on a pipe takes part in its unit process. Most conditions below read a flow meter, a pressure
     gauge or an analyser on a pipe together with a reading on the equipment. Three outcomes: an issue, a task, a calibration. */
  const ON = (reading, of) => w(reading, 'above', null, of); const OFF = (reading, of) => w(reading, 'below', null, of);
  const AERATED = [
    A('ua_lowdo_air', 'Low DO while a blower is drawing current', 'all', [w('Dissolved oxygen', 'below', 1.5), w('Motor current', 'above', 5)], 'major', 10, 'issue', 'f_lowdo'),
    A('ua_header', 'Air header pressure low with DO falling', 'all', [w('Line pressure', 'below', 0.3), w('Dissolved oxygen', 'below', 2)], 'major', 10, 'issue', 'f_lowdo'),
    A('ua_do_drift', 'DO reads high while MLSS is low', 'all', [w('Dissolved oxygen', 'above', 4), w('MLSS', 'below', 2000)], 'minor', 30, 'calibration', 'f_do_cal'),
    A('ua_ras', 'Return flow low with MLSS falling', 'all', [w('Flow', 'below', 10), w('MLSS', 'below', 2500)], 'minor', 30, 'issue', 'f_mlss'),
  ];
  const AIR_MORE = [
    A('ua_diffuser', 'Air header pressure high with DO low', 'all', [w('Line pressure', 'above', 0.7), w('Dissolved oxygen', 'below', 1.5)], 'minor', 30, 'task', 'f_diffuser_clean'),
    A('ua_waste', 'MLSS high with DO falling', 'all', [w('MLSS', 'above', 4500), w('Dissolved oxygen', 'below', 2)], 'minor', 60, 'task', 'f_sludge'),
  ];
  /* a tank that is pumped out: the pump, the level and the flow meter on its outlet say more together than each alone */
  const PUMPED = [
    A('ua_noflow', 'A pump runs but nothing flows out', 'all', [ON('Run status'), w('Flow', 'below', 1)], 'major', 5, 'issue', 'f_pump_fail'),
    A('ua_dry', 'Level low while a pump is still running', 'all', [w('Level', 'below', 15), ON('Run status')], 'major', 5, 'issue', 'f_pump_fail'),
    A('ua_full', 'Level high while no pump runs', 'all', [w('Level', 'above', 85), OFF('Run status', 'all')], 'major', 10, 'issue', 'f_pump_fail'),
  ];
  const MEMBRANE = [
    A('ua_m_cip', 'Trans-membrane pressure high with recovery falling', 'all', [w('Trans-membrane pressure', 'above', 0.6), w('Recovery', 'below', 80)], 'major', 20, 'task', 'f_uf_cip'),
    A('ua_m_breach', 'Outlet turbidity high with trans-membrane pressure low', 'all', [w('Outlet turbidity', 'above', 2), w('Trans-membrane pressure', 'below', 0.1)], 'major', 10, 'issue', null),
    A('ua_m_feed', 'Inlet pressure low with the feed pump running', 'all', [w('Inlet pressure', 'below', 0.5), ON('Run status')], 'major', 5, 'issue', 'f_pump_fail'),
  ];
  const SALT = [
    A('ua_ro_scale', 'Permeate conductivity rising with recovery high', 'all', [w('Permeate conductivity', 'above', 300), w('Recovery', 'above', 80)], 'major', 30, 'issue', null),
    A('ua_ro_cip', 'Pressure drop high with permeate flow falling', 'all', [w('Differential pressure', 'above', 1.5), w('Flow', 'below', 5)], 'major', 30, 'task', 'f_ro_cip'),
    A('ua_ro_cart', 'Feed pressure low with the pump running', 'all', [w('Inlet pressure', 'below', 6), ON('Run status')], 'minor', 15, 'task', 'f_cartridge_replace'),
  ];
  const PRESS = [A('ua_cloth', 'Feed pressure high while the press runs', 'all', [w('Inlet pressure', 'above', 8), ON('Run status')], 'minor', 15, 'task', 'f_cloth_change')];
  const SPIN = [
    A('ua_cf_vib', 'Vibration high while running under load', 'all', [w('Vibration', 'above', 7), w('Motor current', 'above', 20)], 'major', 5, 'issue', null),
    A('ua_cf_empty', 'Running with no feed', 'all', [ON('Run status'), w('Flow', 'below', 0.5)], 'minor', 15, 'issue', null),
  ];
  const DIGEST = [
    A('ua_dg_cold', 'pH falling while the digester is cold', 'all', [w('pH', 'below', 6.8), w('Temperature', 'below', 30)], 'major', 60, 'issue', 'f_anaerobic'),
    A('ua_dg_feed', 'pH low while the feed continues', 'all', [w('pH', 'below', 6.8), w('Flow', 'above', 1)], 'major', 30, 'issue', 'f_anaerobic'),
  ];
  const BLANKET = A('ua_blanket', 'Sludge blanket rising', 'all', [w('Sludge blanket', 'above', 1.2)], 'minor', 30, 'issue', 'f_blanket');
  const SHIPPED = {
    /* preliminary */
    screening: [
      A('ua_sc_rake', 'Level difference across the screen high', 'all', [w('Level differential', 'above', 150)], 'minor', 10, 'task', 'f_task_bs_raking'),
      A('ua_sc_over', 'Level difference very high with flow still coming', 'all', [w('Level differential', 'above', 250), w('Flow', 'above', 5)], 'major', 5, 'issue', 'd_bs_overflow'),
      A('ua_sc_odour', 'H2S high while the flow is low', 'all', [w('H2S', 'above', 10), w('Flow', 'below', 2)], 'minor', 30, 'issue', 'd_bs_odour')],
    mechanical_screening: [
      A('ua_ms_stop', 'Level difference high while the screen is stopped', 'all', [w('Level differential', 'above', 150), OFF('Run status')], 'major', 5, 'issue', 'd_bs_rake'),
      A('ua_ms_run', 'Level difference stays high while the screen runs', 'all', [w('Level differential', 'above', 150), ON('Run status')], 'major', 15, 'issue', 'd_bs_overflow'),
      A('ua_ms_idle', 'Screen runs with no level difference', 'all', [ON('Run status'), w('Level differential', 'below', 10)], 'minor', 120, 'task', 'f_task_bs_function'),
      A('ua_sc_odour', 'H2S high while the flow is low', 'all', [w('H2S', 'above', 10), w('Flow', 'below', 2)], 'minor', 30, 'issue', 'd_bs_odour')],
    rotary_drum_screening: [
      A('ua_rd_stop', 'Level difference high while the drum is stopped', 'all', [w('Level differential', 'above', 150), OFF('Run status')], 'major', 5, 'issue', 'f_screen_trip'),
      A('ua_rd_run', 'Level difference stays high while the drum runs', 'all', [w('Level differential', 'above', 150), ON('Run status')], 'minor', 15, 'task', 'f_screen_inspect')],
    oil_grease_removal: [A('ua_og_full', 'Level high with flow still coming', 'all', [w('Level', 'above', 85), w('Flow', 'above', 5)], 'major', 10, 'issue', 'f_eq_level')],
    hydrocyclone_separation: [A('ua_hc_wear', 'Inlet pressure low with flow coming', 'all', [w('Inlet pressure', 'below', 0.8), w('Flow', 'above', 5)], 'minor', 15, 'task', 'f_cyclone_check')],
    /* primary */
    flash_mixing: [
      A('ua_fm_stop', 'Water flowing with the mixer stopped', 'all', [w('Flow', 'above', 5), OFF('Run status')], 'major', 5, 'issue', 'f_rotating_current'),
      A('ua_fm_dose', 'pH low while the dosing flow runs', 'all', [w('pH', 'below', 6), w('Flow', 'above', 5)], 'minor', 15, 'calibration', 'f_dose_cal')],
    flocculation: [A('ua_fl_stop', 'Water flowing with the flocculator stopped', 'all', [w('Flow', 'above', 5), OFF('Run status')], 'major', 5, 'issue', 'f_rotating_current')],
    dissolved_air_flotation: [
      A('ua_daf_air', 'Saturator pressure low while the unit runs', 'all', [w('Line pressure', 'below', 3.5), ON('Run status')], 'major', 10, 'issue', 'f_daf'),
      A('ua_daf_carry', 'Outlet turbidity high with saturator pressure low', 'all', [w('Outlet turbidity', 'above', 30), w('Line pressure', 'below', 3.5)], 'major', 15, 'issue', 'f_daf'),
      A('ua_daf_pm', 'Outlet turbidity high with saturator pressure normal', 'all', [w('Outlet turbidity', 'above', 30), w('Line pressure', 'above', 4)], 'minor', 30, 'task', 'f_daf_pm')],
    tube_settling: [BLANKET,
      A('ua_ts_pump', 'Blanket rising with the sludge pump stopped', 'all', [w('Sludge blanket', 'above', 1), OFF('Run status', 'all')], 'major', 15, 'issue', 'd_ts_pump'),
      A('ua_ts_carry', 'Outlet turbidity high with the blanket high', 'all', [w('Outlet turbidity', 'above', 20), w('Sludge blanket', 'above', 1.2)], 'major', 15, 'issue', 'd_ts_overflow'),
      A('ua_ts_line', 'Sludge pump runs with no sludge flow', 'all', [ON('Run status'), w('Flow', 'below', 1)], 'minor', 10, 'issue', 'd_ts_line'),
      A('ua_ts_clean', 'Outlet turbidity rising with the blanket normal', 'all', [w('Outlet turbidity', 'above', 15), w('Sludge blanket', 'below', 0.8)], 'minor', 60, 'task', 'f_tube_clean')],
    /* secondary */
    anoxic_treatment: [A('ua_ax_air', 'DO and ORP both high in the anoxic tank', 'all', [w('Dissolved oxygen', 'above', 0.5), w('ORP', 'above', 50)], 'minor', 30, 'issue', null)],
    activated_sludge: AERATED.concat(AIR_MORE, [A('ua_as_nh3', 'Outlet ammonia high while DO is low', 'all', [w('Online ammonia', 'above', 10), w('Dissolved oxygen', 'below', 1.5)], 'major', 30, 'issue', 'f_lowdo')]),
    sbr: AERATED.slice(0, 3).concat(AIR_MORE), cass: AERATED.slice(0, 3).concat(AIR_MORE),
    mbbr: [A('ua_mbbr_air', 'Low DO with a blower running', 'all', [w('Dissolved oxygen', 'below', 2), w('Run status', 'above', null)], 'major', 10, 'issue', 'f_mbbr'),
      A('ua_mbbr_noair', 'No blower running', 'all', [w('Run status', 'below', null, 'all')], 'emergency', 5, 'issue', 'f_blower_trip'),
      A('ua_mb_header', 'Air header pressure low with DO falling', 'all', [w('Line pressure', 'below', 0.3), w('Dissolved oxygen', 'below', 2)], 'major', 10, 'issue', 'd_mb_low_do'),
      A('ua_mb_uneven', 'Air header pressure high with DO low', 'all', [w('Line pressure', 'above', 0.7), w('Dissolved oxygen', 'below', 2)], 'minor', 30, 'issue', 'd_mb_uneven_air'),
      A('ua_mb_cod', 'Outlet COD high while DO is low', 'all', [w('Online COD', 'above', 250), w('Dissolved oxygen', 'below', 2)], 'major', 30, 'issue', 'd_mb_bod'),
      A('ua_mb_nh3', 'Outlet ammonia high while pH is low', 'all', [w('Online ammonia', 'above', 10), w('pH', 'below', 6.5)], 'major', 30, 'issue', 'd_mb_ammonia'),
      A('ua_mb_under', 'DO high while the feed flow is low', 'all', [w('Dissolved oxygen', 'above', 5), w('Flow', 'below', 5)], 'minor', 30, 'issue', 'd_mb_high_do'),
      A('ua_mb_sieve', 'Tank level high with the feed still flowing', 'all', [w('Level', 'above', 90), w('Flow', 'above', 5)], 'minor', 15, 'task', 'f_task_mb_sieve_clean'),
      A('ua_mb_probe', 'DO reads high with no blower running', 'all', [w('Dissolved oxygen', 'above', 5.5), OFF('Run status', 'all')], 'minor', 30, 'calibration', 'f_task_mb_sensor_cal'),
      { id: 'ua_mb_removal', name: 'COD removal low', match: 'all', when: [{ reading: 'COD removed', calc: 'dy_mb_removal', cunit: '%', dir: 'below', limit: 70, of: 'any' }], band: 'major', hold: 60, starts: { kind: 'issue', flowId: 'd_mb_bod' } }],
    mbr: [A('ua_mbr_foul', 'Permeability falling with turbidity rising', 'all', [w('Permeability', 'below', 80), w('Outlet turbidity', 'above', 5)], 'major', 20, 'issue', null),
      A('ua_mbr_cip', 'Trans-membrane pressure high with permeate flow falling', 'all', [w('Trans-membrane pressure', 'above', 0.4), w('Flow', 'below', 5)], 'major', 15, 'task', 'f_cip'),
      A('ua_mbr_scour', 'Air scour pressure low while filtering', 'all', [w('Line pressure', 'below', 0.2), w('Flow', 'above', 5)], 'major', 10, 'issue', null),
      A('ua_mbr_breach', 'Outlet turbidity high with trans-membrane pressure low', 'all', [w('Outlet turbidity', 'above', 2), w('Trans-membrane pressure', 'below', 0.1)], 'major', 10, 'issue', null),
      A('ua_mbr_solids', 'DO low with MLSS high', 'all', [w('Dissolved oxygen', 'below', 1), w('MLSS', 'above', 10000)], 'major', 20, 'issue', 'f_mlss')],
    membrane_filtration: [A('ua_m_cip', 'Trans-membrane pressure high with flow falling', 'all', [w('Trans-membrane pressure', 'above', 0.6), w('Flow', 'below', 5)], 'major', 20, 'task', 'f_uf_cip')],
    cascade_aeration: [A('ua_ca_clean', 'DO low with water flowing', 'all', [w('Dissolved oxygen', 'below', 4), w('Flow', 'above', 1)], 'minor', 60, 'task', 'f_cascade_clean')],
    anaerobic_treatment: DIGEST,
    /* tertiary */
    /* 26 Nov: no "pH out of range" on Equalization. pH high or low is one reading on both sides, and that is the reading's own limits
       (Equalization has pH high and pH low). The same kind twice belongs here only where a step holds several sensors of it. */
    media_filtration: [A('ua_mf_choke', 'Filter choking', 'all', [w('Differential pressure', 'above', 0.8)], 'minor', 15, 'task', 'f_backwash'),
      A('ua_mf_media', 'Outlet turbidity high with pressure drop low', 'all', [w('Outlet turbidity', 'above', 5), w('Differential pressure', 'below', 0.2)], 'major', 15, 'task', 'f_media_inspect'),
      A('ua_mf_block', 'Pressure drop high with flow low', 'all', [w('Differential pressure', 'above', 1), w('Flow', 'below', 5)], 'major', 10, 'issue', null),
      { id: 'ua_mf_gauges', name: 'Filter choking, by its two gauges', match: 'all', when: [{ reading: 'Pressure drop across the filter', calc: 'dy_mf_drop', cunit: 'bar', dir: 'above', limit: 0.8, of: 'any' }], band: 'minor', hold: 15, starts: { kind: 'task', flowId: 'f_backwash' } }],
    microfiltration: MEMBRANE,
    ultrafiltration: [A('ua_uf_foul', 'Inlet pressure high with recovery falling', 'all', [w('Inlet pressure', 'above', 3), w('Recovery', 'below', 75)], 'minor', 20, 'task', 'f_backwash')].concat(MEMBRANE),
    nanofiltration: SALT, ro_desalination: SALT,
    uv_disinfection: [
      A('ua_uv_off', 'Water flowing with the UV off', 'all', [w('Flow', 'above', 1), OFF('Run status')], 'major', 5, 'issue', 'f_uv'),
      A('ua_uv_sleeve', 'UV intensity low with turbidity normal', 'all', [w('UV intensity', 'below', 70), w('Outlet turbidity', 'below', 5)], 'minor', 30, 'task', 'f_uv_lamp'),
      A('ua_uv_dirty', 'UV intensity low with turbidity high', 'all', [w('UV intensity', 'below', 70), w('Outlet turbidity', 'above', 10)], 'major', 15, 'issue', 'f_uv')],
    chlorination: [
      A('ua_cl_low', 'Residual chlorine low with water flowing', 'all', [w('Residual chlorine', 'below', 0.2), w('Flow', 'above', 1)], 'major', 15, 'issue', null),
      A('ua_cl_over', 'Residual chlorine high while the flow is low', 'all', [w('Residual chlorine', 'above', 2), w('Flow', 'below', 5)], 'minor', 15, 'calibration', 'f_dose_cal')],
    dechlorination: [
      A('ua_dc_stop', 'Residual chlorine high with the doser stopped', 'all', [w('Residual chlorine', 'above', 0.1), OFF('Run status')], 'major', 5, 'issue', null),
      A('ua_dc_dose', 'Residual chlorine high with the doser running', 'all', [w('Residual chlorine', 'above', 0.1), ON('Run status')], 'minor', 15, 'calibration', 'f_dose_cal')],
    softening: [A('ua_sf_hard', 'Outlet hardness high with water flowing', 'all', [w('Outlet hardness', 'above', 50), w('Flow', 'above', 1)], 'minor', 15, 'task', 'f_brine_topup')],
    cooling: [
      A('ua_ct_hot', 'Cooling water hot while the tower runs', 'all', [w('Cooling water temperature', 'above', 38), ON('Run status')], 'minor', 30, 'task', 'f_ct_clean'),
      A('ua_ct_stop', 'Cooling water hot with the tower stopped', 'all', [w('Cooling water temperature', 'above', 38), OFF('Run status')], 'major', 10, 'issue', null)],
    /* tanks along the flow path */
    equalization: [A('ua_eq_level', 'Level high while no pump draws current', 'all', [w('Level', 'above', 85), w('Motor current', 'below', 1, 'all')], 'major', 10, 'issue', 'f_eq_level'),
      PUMPED[0], PUMPED[1],
      A('ua_eq_block', 'Discharge pressure high with flow low', 'all', [w('Discharge pressure', 'above', 4), w('Flow', 'below', 5)], 'major', 10, 'issue', 'f_pump_fail'),
      A('ua_eq_acid', 'Low pH being sent forward', 'all', [w('pH', 'below', 6), w('Flow', 'above', 5)], 'major', 10, 'issue', 'f_ph'),
      A('ua_eq_alk', 'High pH being sent forward', 'all', [w('pH', 'above', 9), w('Flow', 'above', 5)], 'major', 10, 'issue', 'f_ph')],
    collection: PUMPED.concat([A('ua_co_flood', 'Flood switch on while a pump runs', 'all', [ON('Sump flood switch'), ON('Run status')], 'emergency', 0, 'issue', 'f_sump_flood')]),
    filter_feed: PUMPED, filtered_water: PUMPED.slice(0, 2), recirculation_holding: PUMPED, sludge_holding: PUMPED,
    treated_water: PUMPED.slice(0, 2).concat([A('ua_tw_frc', 'Residual chlorine low in the water going out', 'all', [w('Residual chlorine', 'below', 0.2), w('Flow', 'above', 1)], 'major', 15, 'task', 'f_frc_round')]),
    /* sludge */
    clarification: [BLANKET,
      A('ua_cl_scraper', 'Blanket rising with the scraper stopped', 'all', [w('Sludge blanket', 'above', 1), OFF('Run status')], 'major', 10, 'issue', 'f_blanket'),
      A('ua_cl_carry', 'Outlet turbidity high with the blanket high', 'all', [w('Outlet turbidity', 'above', 20), w('Sludge blanket', 'above', 1.2)], 'major', 15, 'issue', 'f_blanket'),
      A('ua_cl_ras', 'Blanket rising with return flow low', 'all', [w('Sludge blanket', 'above', 1), w('Flow', 'below', 10)], 'major', 20, 'issue', 'f_blanket'),
      A('ua_cl_waste', 'Blanket high with return flow normal', 'all', [w('Sludge blanket', 'above', 1.2), w('Flow', 'above', 10)], 'minor', 30, 'task', 'f_sludge')],
    gravity_thickening: [A('ua_gt_scraper', 'Blanket high with the scraper stopped', 'all', [w('Sludge blanket', 'above', 1.5), OFF('Run status')], 'major', 15, 'issue', null)],
    daf_thickening: [A('ua_daf_air', 'Saturator pressure low while the unit runs', 'all', [w('Line pressure', 'below', 3.5), ON('Run status')], 'major', 10, 'issue', 'f_daf')],
    belt_filter_press_dewatering: PRESS, plate_frame_filtration: PRESS,
    centrifuge_thickening: SPIN, centrifuge_dewatering: SPIN,
    screw_press_dewatering: [
      A('ua_sp_wash', 'Motor current high with feed flow normal', 'all', [w('Motor current', 'above', 12), w('Flow', 'above', 1)], 'minor', 15, 'task', 'f_press_wash'),
      A('ua_sp_empty', 'Press runs with no feed', 'all', [ON('Run status'), w('Flow', 'below', 0.5)], 'minor', 10, 'issue', 'f_press')],
    sludge_digestion: DIGEST,
    /* every control group: a duty and standby set */
    '@group': [
      A('ua_cg_none', 'Every one of the set is stopped', 'all', [OFF('Run status', 'all')], 'major', 5, 'issue', null),
      A('ua_cg_both', 'Every one of the set is running', 'all', [ON('Run status', 'all')], 'minor', 30, 'issue', null)],
    /* 27 Nov: the whole plant watches every flooding sensor it has, wherever it sits */
    '@plant': [A('ua_pl_flood', 'Flooding sensor', 'all', [w('Sump flood switch', 'above', null, 'any')], 'emergency', 0, 'issue', 'f_sump_flood'),
      { id: 'ua_pl_balance', name: 'Much less water leaves than comes in', match: 'all', when: [{ reading: 'Treated share of the inflow', calc: 'dy_share', cunit: '%', dir: 'below', limit: 70, of: 'any' }], band: 'minor', hold: 120, starts: { kind: 'issue', flowId: null } }],
  };
  const isProcess = (code) => { const c = cat(code); return !!c && c.library === 'process'; };
  /* an equipment type reads only what sits on it: its own readings, never a pipe's */
  const ownReadings = (code) => arr((cat(code) || {}).sensors).filter((s) => s.kind !== 'meter' && RD(s.name) && RD(s.name).kind !== 'meter').map((s) => s.name);
  function libStore() { const L = V().S.lib; if (!L.upAlerts || typeof L.upAlerts !== 'object') L.upAlerts = {}; return L.upAlerts; }
  function alerts(code) { const st = libStore(); const list = clone(st[code] || arr(SHIPPED[code]).map((a) => ({ ...a, starts: { kind: a.starts.kind, flowId: flowById(a.starts.flowId) ? a.starts.flowId : null } })));
    if (list.some((a) => a.when.some((c) => c.calc))) { const ds = calcsOf(code); list.forEach((a) => a.when.forEach((c) => { const d = c.calc ? ds.find((q) => q.id === c.calc) : null; if (d) { c.reading = d.name; c.cunit = d.unit || ''; } })); }
    return list; }
  const calcsOf = (code) => (W.V7DYN && W.V7DYN.defs ? arr(W.V7DYN.defs(code)) : []);
  const isNum = (r) => { const R = RD(r); return !!R && R.kind !== 'status' && R.kind !== 'meter'; };
  function clean(x, readingsOk, eqType, calcs) {
    const name = String((x && x.name) || '').trim(); if (!name) return { error: 'Give the alert a name.' };
    const when = arr(x.when).map((c) => ({ reading: c.reading, dir: c.dir === 'below' ? 'below' : 'above', limit: c.limit === '' || c.limit == null ? null : Number(c.limit), of: c.of === 'all' ? 'all' : 'any', ...(Array.isArray(c.use) ? { use: c.use.slice() } : {}), ...(c.calc ? { calc: c.calc } : {}) }));
    if (!when.length) return { error: 'Add at least one reading for it to watch.' };
    for (const c of when) {
      if (c.calc) { const d = arr(calcs).find((q) => q.id === c.calc); if (!d) return { error: 'That calculated value is not on this type any more. Choose another.' }; c.reading = d.name; c.cunit = d.unit || ''; c.of = 'any'; delete c.use; if (!Number.isFinite(c.limit)) return { error: `Give ${d.name} a limit.` }; continue; }
      const R = RD(c.reading); if (!R) return { error: 'Choose a kind of reading on every line.' };
      if (readingsOk && !readingsOk(c.reading)) return { error: eqType ? `${eqType} does not have ${c.reading}. An equipment type reads only what sits on it.` : `Nothing here sends ${c.reading}.` };
      if (R.kind === 'meter') return { error: `${c.reading} only counts up: it takes no limit.` };
      if (R.kind === 'status') c.limit = null; else if (!Number.isFinite(c.limit)) return { error: `Give ${c.reading} a limit.` };
      else if (R.valid && (c.limit < R.valid[0] || c.limit > R.valid[1])) return { error: `${c.reading} reads between ${R.valid[0]} and ${R.valid[1]}${R.unit ? ' ' + R.unit : ''}. ${c.limit} is outside that.` };
    }
    const band = BANDS.includes(x.band) ? x.band : 'minor'; const hold = Math.max(0, Math.round(Number(x.hold) || 0));
    return { name, when, match: x.match === 'any' ? 'any' : 'all', band, hold };
  }
  function saveAlert(code, x) {
    const c = cat(code); if (!c) return { ok: false, error: 'No such type.' }; const proc = isProcess(code); const mine = proc ? null : ownReadings(code);
    const k = clean(x, proc ? null : (r) => mine.includes(r), proc ? null : c.type, calcsOf(code)); if (k.error) return { ok: false, error: k.error };
    const kind = ['issue', 'task', 'calibration'].includes(x.starts && x.starts.kind) ? x.starts.kind : 'issue'; const f = x.starts && x.starts.flowId ? flowById(x.starts.flowId) : null;
    if (x.starts && x.starts.flowId && !flowFits(kind, f)) return { ok: false, error: kind === 'issue' ? 'An issue starts a diagnostic flow. Choose one of those.' : kind === 'calibration' ? 'Choose a calibration flow.' : 'A task follows a task flow. Choose one of those.' };
    if (kind !== 'issue' && !f) return { ok: false, error: kind === 'task' ? 'Choose the flow the task follows.' : 'Choose the calibration flow.' };
    if (kind !== 'issue' && k.band === 'emergency') return { ok: false, error: 'An Emergency always opens an issue.' };
    const list = alerts(code); const i = x.id ? list.findIndex((a) => a.id === x.id) : -1;
    if (list.some((a, j) => j !== i && a.name.toLowerCase() === k.name.toLowerCase())) return { ok: false, error: `${c.type} already has an alert called ${k.name}.` };
    const al = { id: i >= 0 ? list[i].id : 'ua_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: k.name, match: k.match, when: k.when.map((q) => ({ reading: q.reading, dir: q.dir, limit: q.limit, of: q.of, ...(q.calc ? { calc: q.calc, cunit: q.cunit } : {}) })), band: k.band, hold: k.hold, starts: { kind, flowId: f ? f.id : null } };
    if (i >= 0) list[i] = al; else list.push(al); libStore()[code] = list;
    V().log(null, `${c.type}: ${i >= 0 ? 'changed' : 'added'} the alert "${al.name}" (${sentence(al, null)})`, 'library'); return { ok: true, alert: al };
  }
  function removeAlert(code, id) {
    const c = cat(code); const list = alerts(code); const i = list.findIndex((a) => a.id === id); if (!c || i < 0) return { ok: false, error: 'No such alert.' };
    const at = arr(V().plants()).find((p) => Object.keys(plantStore(p.key)).some((pid) => pid.split('|')[1] === id && plantStore(p.key)[pid].state === 'applied' && subjTypes(p.key, pid.split('|')[0]).includes(code)));
    if (at) return { ok: false, error: `${at.name} has applied it. Leave it out there first.` };
    const [al] = list.splice(i, 1); libStore()[code] = list; V().log(null, `${c.type}: removed the alert "${al.name}"`, 'library'); return { ok: true };
  }

  /* ── at a plant ─────────────────────────────────────────────────────────────────────────────────────── */
  function plantStore(key) { const P = V().S.plants[key]; if (!P) return {}; if (!P.upAlerts || typeof P.upAlerts !== 'object') P.upAlerts = {}; return P.upAlerts; }
  /* v7/9: alerts written at one plant, for that plant only. The library is not changed. They sit beside the library's, on the same place. */
  function ownStore(key) { const P = V().S.plants[key]; if (!P) return {}; if (!P.ownAlerts || typeof P.ownAlerts !== 'object') P.ownAlerts = {}; return P.ownAlerts; }
  const ownOf = (key, subjId) => arr(ownStore(key)[subjId]).map((a) => ({ ...clone(a), plantOwn: true }));
  const calcsAt = (key, subjId, typeId) => (W.V7DYN && W.V7DYN.defsAt ? arr(W.V7DYN.defsAt(key, subjId, typeId)) : calcsOf(typeId));
  const ups = (key) => { try { return arr(V().structure(key).ups); } catch (e) { return []; } };
  const upOf = (key, upId) => ups(key).find((u) => u.id === upId) || null;
  const eqsOf = (key) => { try { return arr(V().equipment(key)); } catch (e) { return []; } };
  const subjTypes = (key, id) => { const u = upOf(key, id); const e = eqsOf(key).find((x) => x.id === id); return [u && u.typeId, e && e.code, cgs(key).some((c) => c.id === id) && '@group', id === '@plant' && '@plant'].filter(Boolean); };
  /* one piece of equipment: the sensors on it, never one on a pipe */
  function scopeEq(key, eqId) { let ss = []; try { ss = arr(V().sensors(key)); } catch (e) { ss = []; }
    return ss.filter((s) => s.eqId === eqId && !s.nextPhase && (RD(s.name) || {}).where !== 'connection').map((s) => ({ id: s.id, name: s.name, tag: s.tag, eqTag: s.eqTag, unit: s.unit, kind: s.kind, onPipe: false, where: '', v: s.latest ? s.latest.v : null })); }
  const cgs = (key) => { try { return arr(V().structure(key).cgs); } catch (e) { return []; } };
  const sMap = (s) => ({ id: s.id, name: s.name, tag: s.tag, eqTag: s.eqTag, unit: s.unit, kind: s.kind, onPipe: !!s.nextPhase || (RD(s.name) || {}).where === 'connection', where: s.nextPhaseNote || '', v: s.latest ? s.latest.v : null });
  /* the sensors a level may read: only the ones inside it. sk: undefined = unit process, 'eq', 'group', 'plant' */
  function scopeAny(key, id, sk) { if (sk === 'eq') return scopeEq(key, id); if (!sk) return scope(key, id); let ss = []; try { ss = arr(V().sensors(key)); } catch (e) { ss = []; } if (sk === 'plant') return ss.map(sMap); const c = cgs(key).find((x) => x.id === id); return c ? ss.filter((x) => c.memberIds.includes(x.eqId)).map(sMap) : []; }
  function subjects(key) {
    const es = eqsOf(key); const out = ups(key).map((u) => ({ id: u.id, tag: u.tag, name: u.name, typeId: u.typeId, typeName: u.typeName, sk: undefined }));
    es.forEach((e) => { if (e.code && !isProcess(e.code)) out.push({ id: e.id, tag: e.tag, name: e.name, typeId: e.code, typeName: e.typeName, sk: 'eq' }); });
    cgs(key).forEach((c) => out.push({ id: c.id, tag: c.name, name: arr(c.memberIds).map((m) => (es.find((e) => e.id === m) || {}).tag || m).join(', '), typeId: '@group', typeName: 'Control group', sk: 'group' }));
    const P = arr(V().plants()).find((p) => p.key === key); out.push({ id: '@plant', tag: P ? P.name : 'The plant', name: 'the whole plant', typeId: '@plant', typeName: 'The plant', sk: 'plant' }); return out;
  }
  function scope(key, upId) {
    const u = upOf(key, upId); if (!u) return []; const ids = [u.id].concat(arr(u.members).map((m) => m.eqId)); let ss = []; try { ss = arr(V().sensors(key)); } catch (e) { ss = []; }
    return ss.filter((s) => ids.includes(s.eqId)).map((s) => ({ id: s.id, name: s.name, tag: s.tag, eqTag: s.eqTag, unit: s.unit, kind: s.kind, onPipe: !!s.nextPhase || (RD(s.name) || {}).where === 'connection', where: s.nextPhaseNote || '', v: s.latest ? s.latest.v : null }));
  }
  const passes = (v, c) => (v == null ? false : (RD(c.reading) || {}).kind === 'status' ? (c.dir === 'below' ? +v === 0 : +v === 1) : c.dir === 'below' ? v < c.limit : v > c.limit);
  function offerOf(key, u, al, sc) {
    const pid = `${u.id}|${al.id}`; const rec = plantStore(key)[pid] || null; const own = al.plantOwn ? al : rec && rec.own ? rec.own : null; const use = own || al;
    const picks = (rec && rec.pick) || {};
    const conds = arr(use.when).map((c, i) => {
      if (c.calc) { const d = W.V7DYN && W.V7DYN.offer ? W.V7DYN.offer(key, `${u.id}|${c.calc}`) : null; const okD = !!d && !d.missing.length; const nm = d ? d.def.name : c.reading;
        return { reading: nm, calc: c.calc, dir: c.dir, limit: c.limit, of: 'any', unit: d ? d.def.unit || '' : c.cunit || '', kind: 'calc', found: okD ? [{ id: 'calc', name: nm, tag: nm, eqTag: '', unit: d.def.unit || '', onPipe: false, where: '', v: d.value }] : [], use: ['calc'], pick: null, choose: okD && d.choose, dyn: d }; }
      const R = RD(c.reading) || {}; const found = sc.filter((s) => s.name === c.reading); const pk = own ? null : picks[i] || null; const set = pk && typeof pk === 'object' && Array.isArray(pk.ids) ? found.filter((s) => pk.ids.includes(s.id)) : null; const some = set && set.length ? set : null;
      const one = !some && typeof pk === 'string' ? found.find((s) => s.id === pk) || null : null; const rule = pk === 'any' || pk === 'all' ? pk : null;
      const picked = some || (one ? [one] : Array.isArray(c.use) ? found.filter((s) => c.use.includes(s.id)) : found);
      return { reading: c.reading, dir: c.dir, limit: c.limit, of: some ? (pk.of === 'all' ? 'all' : 'any') : rule || (one ? 'any' : c.of || 'any'), unit: R.unit || '', kind: R.kind || '', found, use: (picked.length ? picked : found).map((s) => s.id), pick: some ? 'set' : one ? one.id : rule, chosen: !!(some || one || rule), choose: found.length > 1 && !own && !one && !rule && !some }; });
    const missing = [...new Set(conds.filter((c) => !c.found.length).map((c) => c.reading))]; const live = conds.filter((c) => c.found.length);
    const match = use.match === 'any' ? 'any' : 'all'; const skipped = match === 'all' ? missing.length > 0 : live.length === 0;
    const parts = conds.map((c) => { const vs = c.found.filter((s) => c.use.includes(s.id)); const hit = vs.filter((s) => passes(s.v, c)); return { reading: c.reading, ok: vs.length ? (c.of === 'all' ? hit.length === vs.length : hit.length > 0) : false, n: vs.length }; });
    const usable = parts.filter((p) => p.n); const fires = !skipped && usable.length > 0 && (match === 'all' ? usable.every((p) => p.ok) : usable.some((p) => p.ok));
    return { pid, upId: u.id, upTag: u.tag, upName: u.name, typeId: u.typeId, typeName: u.typeName, alert: al, name: use.name || al.name, match, band: use.band || al.band, hold: use.hold != null ? use.hold : al.hold, starts: al.starts, conds, missing, skipped, state: rec ? rec.state : null, own: !!own && !al.plantOwn, mine: !!al.plantOwn, why: al.why || '', onPipe: conds.some((c) => c.found.some((s) => s.onPipe && c.use.includes(s.id))), choose: !skipped && conds.some((c) => c.choose), now: { fires, parts } };
  }
  function offers(key, o) {
    const out = []; ups(key).forEach((u) => { if (o && o.upId && o.upId !== u.id) return; const list = alerts(u.typeId).concat(ownOf(key, u.id)); if (!list.length) return; const sc = scope(key, u.id); list.forEach((al) => out.push(offerOf(key, u, al, sc))); });
    eqsOf(key).forEach((e) => { if (o && o.upId && o.upId !== e.id) return; if (!e.code || isProcess(e.code)) return; const list = alerts(e.code).concat(ownOf(key, e.id)); if (!list.length) return; const sc = scopeEq(key, e.id); const u = { id: e.id, tag: e.tag, name: e.name, typeId: e.code, typeName: e.typeName }; list.forEach((al) => out.push({ ...offerOf(key, u, al, sc), eq: true, sk: 'eq' })); });
    subjects(key).filter((u) => u.sk === 'group' || u.sk === 'plant').forEach((u) => { if (o && o.upId && o.upId !== u.id) return; const list = alerts(u.typeId).concat(ownOf(key, u.id)); if (!list.length) return; const sc = scopeAny(key, u.id, u.sk); list.forEach((al) => out.push({ ...offerOf(key, u, al, sc), sk: u.sk })); });
    return out;
  }
  const offer = (key, pid) => offers(key, { upId: String(pid).split('|')[0] }).find((x) => x.pid === pid) || null;
  function decide(key, pid, state) {
    const of = offer(key, pid); if (!of) return { ok: false, error: 'No such alert here.' }; const st = plantStore(key);
    if (state === 'applied' && of.skipped) return { ok: false, error: `It cannot work here: nothing in ${of.upTag} sends ${of.missing.join(' or ')}.` };
    if (state === 'applied' && of.choose) return { ok: false, error: `Tick the sensors to read for ${[...new Set(of.conds.filter((c) => c.choose).map((c) => c.reading))].join(' and ')} first.` };
    const rec = st[pid] || (st[pid] = {}); if (state == null) { if (rec.own || rec.pick) delete rec.state; else delete st[pid]; } else { rec.state = state; rec.at = V().now ? V().now() : Date.now(); }
    if (state === 'applied' && W.V7DYN) of.conds.filter((c) => c.dyn && c.dyn.pid && c.dyn.state !== 'on').forEach((c) => { try { W.V7DYN.use(key, c.dyn.pid, 'on'); } catch (e) { /* it stays as it was */ } });
    const live = (() => { try { return V().state(key) === 'live'; } catch (e) { return false; } })();
    V().log(key, state === 'applied' ? `Applied the ${of.eq ? 'alert' : 'unit-process alert'} "${of.name}" on ${of.upTag}: ${live ? 'it is On, and opens an issue when its condition holds' : 'it starts when the plant goes live'}` : state === 'left' ? `Left out the ${of.eq ? 'alert' : 'unit-process alert'} "${of.name}" on ${of.upTag}` : `Set the ${of.eq ? 'alert' : 'unit-process alert'} "${of.name}" on ${of.upTag} back to undecided`, 'config');
    return { ok: true };
  }
  function edit(key, pid, x) {
    const of = offer(key, pid); if (!of) return { ok: false, error: 'No such alert here.' }; const sc = scopeAny(key, of.upId, of.sk); const st = plantStore(key);
    if (x == null) { const rec = st[pid]; if (rec) { delete rec.own; if (!rec.state && !rec.pick) delete st[pid]; } V().log(key, `${of.upTag}: the alert "${of.alert.name}" follows the library again`, 'config'); return { ok: true }; }
    const k = clean({ ...x, name: x.name || of.name }, (r) => sc.some((s) => s.name === r), of.eq ? of.typeName : null, calcsAt(key, of.upId, of.typeId)); if (k.error) return { ok: false, error: k.error };
    if (of.starts.kind !== 'issue' && k.band === 'emergency') return { ok: false, error: 'An Emergency always opens an issue.' };
    for (const c of k.when) { if (c.use) { c.use = c.use.filter((id) => sc.some((s) => s.id === id && s.name === c.reading)); if (!c.use.length) return { ok: false, error: `Tick at least one ${c.reading} sensor.` }; } }
    const rec = st[pid] || (st[pid] = {}); rec.own = { name: k.name, match: k.match, when: k.when, band: k.band, hold: k.hold };
    V().log(key, `${of.upTag}: changed the alert "${k.name}" for this plant (${sentence(rec.own, null)})`, 'config'); return { ok: true };
  }
  function pick(key, pid, i, val) {
    const of = offer(key, pid); if (!of) return { ok: false, error: 'No such alert here.' }; const c = of.conds[+i]; if (!c || c.calc) return { ok: false, error: 'No such reading on this alert.' };
    if (val && val !== 'any' && val !== 'all' && !c.found.some((s) => s.id === val)) return { ok: false, error: `That is not a ${c.reading} sensor in ${of.upTag}.` };
    const st = plantStore(key); const rec = st[pid] || (st[pid] = {}); rec.pick = rec.pick || {}; if (val) rec.pick[+i] = val; else delete rec.pick[+i];
    const sn = c.found.find((x) => x.id === val); V().log(key, `${of.upTag}: "${of.name}" reads ${c.reading} from ${sn ? sn.tag : val === 'all' ? 'every sensor of that kind' : val === 'any' ? 'any one sensor of that kind' : 'a sensor still to be chosen'}`, 'config'); return { ok: true };
  }
  /* 27 Nov: some of the sensors of a purpose, ticked one by one. With several ticked, it fires on any one of them or only on every one. */
  function pickSet(key, pid, i, ids, rule) {
    const of = offer(key, pid); if (!of) return { ok: false, error: 'No such alert here.' }; const c = of.conds[+i]; if (!c || c.calc) return { ok: false, error: 'No such reading on this alert.' };
    const use = arr(ids).filter((id) => c.found.some((s) => s.id === id)); const st = plantStore(key); const rec = st[pid] || (st[pid] = {}); rec.pick = rec.pick || {};
    if (!use.length) { delete rec.pick[+i]; if (!Object.keys(rec.pick).length) delete rec.pick; if (!rec.state && !rec.own && !rec.pick) delete st[pid]; V().log(key, `${of.upTag}: "${of.name}" has no ${c.reading} sensor chosen`, 'config'); return { ok: true, none: true }; }
    const lib0 = (arr(of.alert.when)[+i] || {}).of; rule = rule === 'all' || rule === 'any' ? rule : lib0 === 'all' ? 'all' : 'any'; rec.pick[+i] = { ids: use, of: rule }; const tags = c.found.filter((s) => use.includes(s.id)).map((s) => s.tag);
    V().log(key, `${of.upTag}: "${of.name}" reads ${c.reading} from ${tags.length > 1 ? (rule === 'all' ? 'every one of ' : 'any one of ') : ''}${tags.join(', ')}`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  const fmtLim = (c) => { const R = c.calc ? { unit: c.unit != null ? c.unit : c.cunit || '' } : RD(c.reading) || {}; return R.kind === 'status' ? (c.dir === 'below' ? 'is OFF' : 'is ON') : `is ${c.dir === 'below' ? 'below' : 'above'} ${c.limit}${R.unit ? ' ' + R.unit : ''}`; };
  function sentence(al, of) {
    return arr(of ? of.conds : al.when).map((c) => { const tags = of && !c.calc ? c.found.filter((s) => c.use.includes(s.id)).map((s) => s.tag) : []; return `${c.reading}${tags.length ? ` (${c.of === 'all' && tags.length > 1 ? 'every one of ' : ''}${tags.join(', ')})` : !of && c.of === 'all' ? ' on every sensor' : ''} ${fmtLim(c)}`; }).join((of ? of.match : al.match) === 'any' ? ' or ' : ' and ');
  }
  /* an applied alert at a Live plant opens an issue when its condition holds. One at a time: it does not open again until the
     condition has cleared once. A task as the outcome is not raised here yet. */
  /* v7/9: where a plant may put an alert of its own: any place that has a reading to watch */
  const ownPlaces = (key) => subjects(key).filter((u) => scopeAny(key, u.id, u.sk).some((s) => RD(s.name) && RD(s.name).kind !== 'meter'));
  function saveOwn(key, subjId, x) {
    const u = subjects(key).find((q) => q.id === subjId); if (!u) return { ok: false, error: 'Choose where it sits.' }; const sc = scopeAny(key, u.id, u.sk);
    const k = clean(x, (r) => sc.some((q) => q.name === r), null, calcsAt(key, u.id, u.typeId)); if (k.error) return { ok: false, error: k.error };
    const kind = ['issue', 'task', 'calibration'].includes(x.starts && x.starts.kind) ? x.starts.kind : 'issue'; const f = x.starts && x.starts.flowId ? flowById(x.starts.flowId) : null;
    if (x.starts && x.starts.flowId && !flowFits(kind, f)) return { ok: false, error: kind === 'issue' ? 'An issue starts a diagnostic flow. Choose one of those.' : kind === 'calibration' ? 'Choose a calibration flow.' : 'A task follows a task flow. Choose one of those.' };
    if (kind !== 'issue' && !f) return { ok: false, error: kind === 'task' ? 'Choose the flow the task follows.' : 'Choose the calibration flow.' };
    if (kind !== 'issue' && k.band === 'emergency') return { ok: false, error: 'An Emergency always opens an issue.' };
    for (const c of k.when) { if (c.calc) continue; const found = sc.filter((q) => q.name === c.reading); c.use = (Array.isArray(c.use) ? c.use : found.map((q) => q.id)).filter((id) => found.some((q) => q.id === id)); if (!c.use.length) return { ok: false, error: `Tick at least one ${c.reading} sensor.` }; }
    const st = ownStore(key); const list = arr(st[subjId]); const i = x.id ? list.findIndex((a) => a.id === x.id) : -1;
    const why = String(x.why || '').trim(); if (i < 0 && !why) return { ok: false, error: 'Say why this plant needs it.' };
    if (offers(key, { upId: subjId }).some((o) => o.alert.id !== (i >= 0 ? list[i].id : null) && String(o.name).toLowerCase() === k.name.toLowerCase())) return { ok: false, error: `${u.tag} already has an alert called ${k.name}.` };
    const al = { id: i >= 0 ? list[i].id : 'po_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: k.name, match: k.match, when: k.when.map((q) => ({ reading: q.reading, dir: q.dir, limit: q.limit, of: q.of, ...(q.use ? { use: q.use } : {}), ...(q.calc ? { calc: q.calc, cunit: q.cunit } : {}) })), band: k.band, hold: k.hold, starts: { kind, flowId: f ? f.id : null }, why: why || (i >= 0 ? list[i].why || '' : '') };
    if (i >= 0) list[i] = al; else list.push(al); st[subjId] = list; const pid = `${subjId}|${al.id}`;
    if (i < 0) { plantStore(key)[pid] = { state: 'applied', at: V().now ? V().now() : Date.now() }; }
    const of = offer(key, pid); if (of && of.state === 'applied' && W.V7DYN) of.conds.filter((c) => c.dyn && c.dyn.pid && c.dyn.state !== 'on').forEach((c) => { try { W.V7DYN.use(key, c.dyn.pid, 'on'); } catch (e) { /* it stays as it was */ } });
    V().log(key, `${u.tag}: ${i >= 0 ? 'changed' : 'added'} an alert for this plant only, "${al.name}" (${sentence(al, null)})${i < 0 ? `. Why: ${why}` : ''}`, 'config'); if (V().persist) V().persist(); return { ok: true, pid, alert: al };
  }
  function removeOwn(key, pid) {
    const subjId = String(pid).split('|')[0]; const id = String(pid).split('|')[1]; const st = ownStore(key); const list = arr(st[subjId]); const i = list.findIndex((a) => a.id === id); if (i < 0) return { ok: false, error: 'No such alert here.' };
    if (openIssue(key, pid)) return { ok: false, error: 'Its issue is open. Close the issue first.' };
    const [al] = list.splice(i, 1); if (list.length) st[subjId] = list; else delete st[subjId]; delete plantStore(key)[pid];
    V().log(key, `Removed the alert "${al.name}", which was at this plant only`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  const isLive = (key) => { try { return V().state(key) === 'live'; } catch (e) { return false; } };
  const openIssue = (key, pid) => { const P = V().S.plants[key]; return P && Array.isArray(P.issues) ? P.issues.find((i) => i.uaPid === pid && i.status !== 'closed') || null : null; };
  function run(key) {
    if (!isLive(key)) return 0; const P = V().S.plants[key]; if (!P || !Array.isArray(P.issues)) return 0; const st = plantStore(key); let n = 0;
    offers(key).filter((o) => o.state === 'applied' && !o.skipped && !(o.starts && o.starts.kind === 'task')).forEach((o) => {
      const rec = st[o.pid]; if (!rec) return; if (!o.now || !o.now.fires) { if (rec.armed === false) rec.armed = true; return; }
      if (rec.armed === false || openIssue(key, o.pid)) return;
      const t = V().now(); const eqs = arr((() => { try { return V().equipment(key); } catch (e) { return []; } })()); const s0 = arr(o.conds).map((c) => arr(c.found)[0]).find(Boolean);
      const eqId = eqs.some((e) => e.id === o.upId) ? o.upId : s0 && s0.eqId && eqs.some((e) => e.id === s0.eqId) ? s0.eqId : null; const fl = o.starts && o.starts.flowId ? flowById(o.starts.flowId) : null;
      const iss = { id: `is_ua${P.issues.filter((i) => i.uaPid).length + 1}_${String(o.pid).replace(/[^\w]/g, '').slice(-12)}`, plant: key, alertId: null, issueTypeId: null, title: `${o.name} · ${o.upTag}`, eqId, sensorId: null, band: o.band, peak: null, opened: t, closed: null, cleared: null, status: 'open', terms: null, commissioning: false,
        told: typeof V().tellList === 'function' ? V().tellList(key, o.band, false, t) : [], diag: { flowId: fl ? fl.id || o.starts.flowId : null, path: [], causeId: null }, fix: { flowId: null, done: [] }, causedBy: null, falseAlarm: false, closedHow: null, reported: false, uaPid: o.pid,
        log: [{ at: t, text: `Opened by the alert across readings "${o.name}" on ${o.upTag}: ${sentence(null, o)}, for ${o.hold} min` }] };
      P.issues.unshift(iss); rec.armed = false; n++; V().log(key, `Issue opened: ${o.name} on ${o.upTag} at ${o.band.charAt(0).toUpperCase() + o.band.slice(1)}, by an alert across readings`, 'issue');
    });
    if (n) { if (V().touch) V().touch(); if (V().persist) V().persist(); } return n;
  }
  const issLink = (key, o) => { const i = o.state === 'applied' ? openIssue(key, o.pid) : null; return i ? ` · <a href="#/p/${encodeURIComponent(key)}/issue/${encodeURIComponent(i.id)}">Its issue is open →</a>` : ''; };
  W.V7UPALERT = { saveOwn, removeOwn, ownPlaces, run, isLive, alerts, saveAlert, removeAlert, offers, offer, decide, edit, pick, pickSet, subjects, scopeAny, typeOf: cat, scope, sentence, isProcess, flowFits, libBox: () => '', plantCard: () => '' };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip; const enc = encodeURIComponent;
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b || a + 's'}`;
  const KIND = { issue: 'Opens an issue', task: 'Raises a task', calibration: 'Raises a calibration' };
  const startsHtml = (st) => { const f = flowById(st.flowId); return `${esc(KIND[st.kind])}${f ? `: <a href="#/flows/${esc(enc(f.id))}">${esc(f.name)}</a>` : st.kind === 'issue' ? ' <span class="ua-0">with no diagnostic flow yet</span>' : ''}`; };
  const condHtml = (c, of) => { const tags = of && !c.calc ? c.found.filter((s) => c.use.includes(s.id)) : []; return `<span class="ua-c${of && !c.found.length ? ' is-miss' : ''}"><b>${esc(c.reading)}</b>${c.calc ? ' <span class="ua-of" title="A number worked out on the fly from readings">calculated</span>' : ''}${tags.length ? ` <span class="ua-tags">${tags.map((s) => `<span class="ua-tag${s.onPipe ? ' is-pipe' : ''}" title="${esc(s.onPipe ? `On a pipe${s.where ? ': ' + s.where : ''}, by ${s.eqTag}` : `On ${s.eqTag}`)}">${esc(s.tag)}</span>`).join('')}</span>${c.of === 'all' && tags.length > 1 ? ' <span class="ua-of">every one</span>' : ''}` : !of && c.of === 'all' ? ' <span class="ua-of">on every sensor</span>' : ''} ${esc(fmtLim(c))}</span>`; };
  /* how many kinds of reading an alert watches: two lines on the same kind are one reading, not two */
  const kindsOf = (a) => new Set(arr(a.when).map((c) => (c.calc ? 'calc:' + c.calc : c.reading))).size;
  const whenHtml = (conds, match, of) => conds.map((c) => condHtml(c, of)).join(`<span class="ua-j">${match === 'any' ? 'or' : 'and'}</span>`);

  /* the library: what a unit-process type watches across its readings */
  function libBox(lt, o) {
    if (!lt || !cat(lt.code)) return ''; const proc = isProcess(lt.code); const ps = cat(lt.code).sk || null; const list = alerts(lt.code); if (!proc && !ownReadings(lt.code).length) return '';
    const rows = list.map((a) => `<li class="ua-row"><div class="ua-main"><div class="ua-t"><b>${esc(a.name)}</b> ${U.sev(a.band)}${kindsOf(a) > 1 ? ` ${chip(plural(kindsOf(a), 'reading') + ' together', { tone: 'info', title: 'Several kinds of reading fire one alert' })}` : a.when.length > 1 && !a.when[0].calc ? ` ${chip(`Several ${a.when[0].reading} sensors`, { tone: 'muted', title: `Every line reads ${a.when[0].reading}. It is for a step that holds more than one ${a.when[0].reading} sensor: each plant chooses the sensor for each line` })}` : ''}</div><div class="ua-w">When ${whenHtml(a.when, a.match, null)}, for ${esc(a.hold)} min</div><div class="ua-s">${startsHtml(a.starts)}</div></div><div class="ua-acts">${btn('Edit', { act: 'ua:lib-open', data: { code: lt.code, id: a.id }, small: true })}${btn('Copy', { act: 'ua:lib-open', data: { code: lt.code, id: a.id, copy: 1 }, small: true, kind: 'ghost', title: 'Start another alert from the same readings. It opens its own issue' })}${btn('Remove', { act: 'ua:lib-remove', data: { code: lt.code, id: a.id }, small: true, kind: 'ghost' })}</div></li>`).join('');
    return `<section class="ov-box ua-box${o && o.solo ? ' ua-solo' : ''}"><header><h3>${ps === 'group' ? 'Alerts across a control group' : ps === 'plant' ? 'Alerts across the plant' : proc ? 'Alerts across the unit process' : 'More alerts on these readings'}</h3><span class="ov-n">${list.length}</span><span class="ov-hb">${btn(proc ? 'Add an alert' : 'Add another alert', { act: 'ua:lib-open', data: { code: lt.code }, small: true, kind: proc && !list.length ? 'primary' : 'secondary', title: proc ? 'On one kind of reading, or several together' : 'On a reading that already has limits, or on several readings of this equipment together' })}</span></header><div class="ov-b"><p class="ov-sub ua-lead">${ps === 'group' ? 'Written with sensor purposes on the members of a control group, such as a duty and standby set. Every control group at a plant is offered them, and reads only its own members.' : ps === 'plant' ? 'Written with sensor purposes anywhere at the plant. Where a plant has several sensors of a purpose, the person setting it up ticks the ones it reads.' : proc ? 'Written with sensor purposes, wherever in the step the sensor sits: on the tank, on the equipment that serves it, or on a pipe. Each plant is offered the ones its sensors can serve, and puts its own sensor tags to each purpose. Two alerts may watch the same kinds of reading: each opens its own issue, task or calibration. High and low on one reading are the limits of that reading, not an alert here, unless the step holds several sensors of that kind.' : 'The limits on a reading make one alert each way. Add one here when the same reading should open a different issue, on its own or together with another reading on the same equipment.'}</p>${rows ? `<ul class="ua-rows">${rows}</ul>` : `<p class="ov-none">${proc ? 'None yet. Add one on a kind of reading, or on several together.' : 'None yet.'}</p>`}</div></section>`;
  }
  W.V7UPALERT.libBox = libBox;

  /* the editor: one form for the library and for a plant */
  let ED = null;
  const flowOpts = (kind, cur) => `<option value="">${kind === 'issue' ? 'No diagnostic flow yet' : 'Choose…'}</option>` + flows().filter((f) => flowFits(kind, f) && f.name).sort((a, b) => a.name.localeCompare(b.name)).map((f) => `<option value="${esc(f.id)}"${cur === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('');
  function readEd() {
    if (!ED) return; const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; };
    const nm = g('ua-name'); if (nm != null) ED.name = nm; ED.match = g('ua-match') || ED.match; ED.band = g('ua-band') || ED.band; const h = g('ua-hold'); if (h != null) ED.hold = h;
    if (ED.lib || ED.mine) { ED.starts.kind = g('ua-kind') || ED.starts.kind; const f = g('ua-flow'); ED.starts.flowId = f || null; } if (ED.mine) { const y = g('ua-why'); if (y != null) ED.why = y; }
    ED.when.forEach((c, i) => { const r = g(`ua-r${i}`); if (r != null) { if (r.indexOf('calc:') === 0) { const d = (ED.lib ? calcsOf(ED.code) : calcsAt(ED.key, ED.upId, ED.typeId)).find((q) => q.id === r.slice(5)); if (d) { c.calc = d.id; c.reading = d.name; c.cunit = d.unit || ''; } } else { delete c.calc; delete c.cunit; c.reading = r; } } c.dir = g(`ua-d${i}`) || c.dir; const l = g(`ua-l${i}`); if (l != null) c.limit = l; c.of = g(`ua-o${i}`) || c.of;
      if (!ED.lib) { const boxes = [...document.querySelectorAll(`[data-ua-use="${i}"]`)]; if (boxes.length) c.use = boxes.filter((b) => b.checked).map((b) => b.value); } });
  }
  function drawEd() {
    const E = ED; const sc = E.lib ? null : scopeAny(E.key, E.upId, E.sk); const names = E.lib ? (isProcess(E.code) ? Object.keys(W.READINGS || {}).filter((n) => RD(n).kind !== 'meter') : ownReadings(E.code)) : [...new Set(sc.map((s) => s.name))].filter((n) => RD(n) && RD(n).kind !== 'meter');
    const grp = (lab, ns) => (ns.length ? `<optgroup label="${lab}">${ns.map((n) => `<option value="${esc(n)}">${esc(n)}${RD(n).unit ? ` (${esc(RD(n).unit)})` : ''}</option>`).join('')}</optgroup>` : '');
    const calcs = E.lib ? calcsOf(E.code) : calcsAt(E.key, E.upId, E.typeId);
    const rOpts = (cur) => { const eqN = names.filter((n) => RD(n).where !== 'connection'); const pN = names.filter((n) => RD(n).where === 'connection'); return (grp('Usually on equipment', eqN) + grp('Usually on a pipe', pN) + (calcs.length ? `<optgroup label="Calculated values">${calcs.map((d) => `<option value="calc:${esc(d.id)}">${esc(d.name)}${d.unit ? ` (${esc(d.unit)})` : ''}</option>`).join('')}</optgroup>` : '')).replace(`value="${esc(cur)}"`, `value="${esc(cur)}" selected`); };
    const rows = E.when.map((c, i) => {
      const R = c.calc ? { unit: c.cunit || '' } : RD(c.reading) || {}; const status = R.kind === 'status'; const found = sc ? sc.filter((s) => s.name === c.reading) : [];
      const use = Array.isArray(c.use) ? c.use : found.map((s) => s.id);
      return `<div class="ua-er"><div class="ua-er1"><select id="ua-r${i}" data-act="ua:row-set" aria-label="Sensor purpose">${rOpts(c.calc ? 'calc:' + c.calc : c.reading)}</select><select id="ua-d${i}" aria-label="Condition">${status ? `<option value="above"${c.dir !== 'below' ? ' selected' : ''}>is ON</option><option value="below"${c.dir === 'below' ? ' selected' : ''}>is OFF</option>` : `<option value="above"${c.dir !== 'below' ? ' selected' : ''}>rises above</option><option value="below"${c.dir === 'below' ? ' selected' : ''}>falls below</option>`}</select>${status ? '' : `<span class="ua-lim"><input type="number" step="any" id="ua-l${i}" value="${esc(c.limit == null ? '' : c.limit)}" aria-label="Limit"><span>${esc(R.unit || '')}</span></span>`}${E.when.length > 1 ? btn('Remove', { act: 'ua:row-del', data: { i }, small: true, kind: 'ghost' }) : ''}</div>`
        + (c.calc ? `<div class="ua-use">A calculated value: a number worked out on the fly from readings. ${sc ? 'Its sensors are chosen on the alert\'s row.' : 'Each plant chooses the sensors it is worked out from.'}</div>` : sc ? (found.length ? `<div class="ua-use"><span class="ua-use-l">Sensor tags</span>${found.map((s) => `<label title="${esc(s.onPipe ? 'On a pipe by ' + s.eqTag : 'On ' + s.eqTag)}"><input type="checkbox" data-ua-use="${i}" value="${esc(s.id)}"${use.includes(s.id) ? ' checked' : ''}> ${esc(s.tag)}${s.onPipe ? ' <span class="ua-pp">pipe</span>' : ''}</label>`).join('')}${found.length > 1 ? `<select id="ua-o${i}" aria-label="How many must pass"><option value="any"${c.of !== 'all' ? ' selected' : ''}>any one of them</option><option value="all"${c.of === 'all' ? ' selected' : ''}>every one of them</option></select>` : ''}</div>` : `<div class="ua-use is-miss">Nothing in ${esc(E.upTag)} sends ${esc(c.reading)}. Choose another reading or remove this line.</div>`)
          : `<div class="ua-use"><select id="ua-o${i}" aria-label="Where there are several sensors"><option value="any"${c.of !== 'all' ? ' selected' : ''}>When there are several sensors: any one of them</option><option value="all"${c.of === 'all' ? ' selected' : ''}>When there are several sensors: every one of them</option></select></div>`) + '</div>';
    }).join(`<div class="ua-ej">${E.when.length > 1 ? `<select id="ua-match" aria-label="How the readings combine"><option value="all"${E.match !== 'any' ? ' selected' : ''}>and</option><option value="any"${E.match === 'any' ? ' selected' : ''}>or</option></select>` : ''}</div>`);
    const dup = E.when.map((c) => c.reading).find((r, i, a) => !E.when[i].calc && a.indexOf(r) !== i && !E.when[a.indexOf(r)].calc) || null;
    const dupN = dup && sc ? sc.filter((s) => s.name === dup).length : 0;
    const sameNote = !dup || E.eq || (E.lib && !isProcess(E.code)) ? '' : E.lib ? `<p class="la-n ua-same">More than one line reads ${esc(dup)}. High and low limits on one reading belong on the reading itself, under its limits. Keep the lines here when a step can hold more than one ${esc(dup)} sensor, such as one at the inlet and one in the tank: each plant then chooses the sensor for each line.</p>` : dupN < 2 ? `<p class="la-n ua-same">More than one line reads ${esc(dup)}, and ${esc(E.upTag)} has one ${esc(dup)} sensor. That is the reading's own high and low limits: set them on the reading instead.</p>` : '';
    const lvl = (u) => (u.sk === 'eq' ? 'Equipment' : u.sk === 'group' ? 'Control groups' : u.sk === 'plant' ? 'The whole plant' : 'Unit processes');
    const whereF = E.mine && E.isNew ? (() => { const ps = ownPlaces(E.key); if (!ps.some((u) => u.id === E.upId)) { const u0 = subjects(E.key).find((u) => u.id === E.upId); if (u0) ps.push(u0); } return U.field({ label: 'Where it sits', hint: 'It reads only the sensors inside this place.', html: `<select id="ua-where" data-act="ua:where">${['Unit processes', 'Equipment', 'Control groups', 'The whole plant'].map((L) => { const xs = ps.filter((u) => lvl(u) === L); return xs.length ? `<optgroup label="${L}">${xs.map((u) => `<option value="${esc(u.id)}"${u.id === E.upId ? ' selected' : ''}>${esc(u.tag)}${u.sk === 'plant' ? '' : ' · ' + esc(u.sk === 'group' ? u.name : u.typeName || u.name)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>` }); })() : '';
    const mineF = E.mine ? U.field({ label: 'Why this plant needs it', hint: E.isNew ? 'Kept with the alert and written to Activity.' : '', html: `<input type="text" id="ua-why" value="${esc(E.why || '')}" placeholder="For example: the client asks to be told when both pumps run together">` }) + '<p class="la-n">It exists at this plant only. The library is not changed, and no other plant is offered it.</p>' : '';
    const body = whereF + U.field({ label: E.starts.kind !== 'issue' ? 'Name of the condition' : 'Name', hint: E.starts.kind !== 'issue' ? 'What the condition is called. The task it raises takes the name of its flow.' : 'What people see when it fires. It is also the name of the issue it opens.', html: `<input type="text" id="ua-name" value="${esc(E.name || '')}" placeholder="For example: Low DO while a blower is running">` })
      + `<div class="field"><span class="field-l">Fires when</span><p class="field-h ua-how">${E.lib ? 'Written with sensor purposes, not with tags. Each plant puts its own sensor tags to each purpose.' : `Written with the sensor tags in ${esc(E.upTag)}: choose a purpose, then tick the tags it reads.`}</p><div class="ua-ed">${rows}</div>${sameNote}<div class="ua-add">${btn(E.lib ? 'Add another sensor purpose' : 'Add another sensor', { act: 'ua:row-add', small: true, kind: 'secondary', title: E.lib ? 'Club another sensor purpose into the same alert' : `Any sensor found in ${E.upTag}` })}</div></div>`
      + `<div class="la-2">${U.field({ label: 'Severity', html: `<select id="ua-band">${BANDS.map((b) => `<option value="${b}"${E.band === b ? ' selected' : ''}>${BAND_LABEL[b]}</option>`).join('')}</select>` })}${U.field({ label: 'Must hold for (minutes)', html: `<input type="number" min="0" step="1" id="ua-hold" value="${esc(E.hold)}">` })}</div>`
      + (E.lib || E.mine ? `<div class="la-2">${U.field({ label: 'What it leads to', html: `<select id="ua-kind" data-act="ua:row-set">${Object.keys(KIND).map((k) => `<option value="${k}"${E.starts.kind === k ? ' selected' : ''}>${KIND[k]}</option>`).join('')}</select>` })}${U.field({ label: E.starts.kind === 'issue' ? 'Diagnostic flow' : E.starts.kind === 'task' ? 'Task flow' : 'Calibration flow', html: `<select id="ua-flow" data-act="ua:row-set">${flowOpts(E.starts.kind, E.starts.flowId)}</select>` })}</div>${E.starts.kind !== 'issue' ? `<p class="la-n ua-tname">${flowById(E.starts.flowId) ? `The ${E.starts.kind === 'calibration' ? 'calibration' : 'task'} it raises is called <b>${esc(flowById(E.starts.flowId).name)}</b>: a task takes the name its flow carries.` : `Choose the flow. The ${E.starts.kind === 'calibration' ? 'calibration' : 'task'} takes its name from it.`} It is listed with the condition-based tasks.</p>` : ''}${E.lib && W.V7LIBFLOW && W.V7LIBFLOW.newFlow ? `<p class="ua-newflow">None of these fits? ${btn(E.starts.kind === 'issue' ? 'Write a new diagnostic flow' : E.starts.kind === 'task' ? 'Write a new task flow' : 'Write a new calibration flow', { act: 'ua:flow-new', small: true, kind: 'secondary', title: 'Write it here. Once saved you are back on this form with it chosen' })}</p>` : ''}${mineF}<p class="la-n"${E.mine ? ' hidden' : ''}>${isProcess(E.code) ? 'Each plant with this unit process is offered it when its sensors can serve it, and a person there applies it or leaves it out. A kind of reading the plant does not send is named, and the alert is skipped.' : 'Each plant is offered it for every piece of equipment of this type, and a person there applies it or leaves it out. It reads only what sits on the equipment. Another alert may watch the same reading and open a different issue.'}</p>`
        : `<p class="la-n">${startsHtml(E.starts)}. This changes the alert at ${esc(E.upTag)} only; the library keeps its own.</p>`);
    U.modal({ title: E.lib ? (E.starts.kind !== 'issue' ? (E.id ? `Edit a condition-based task of ${E.typeName}` : `Add a condition-based task to ${E.typeName}`) : E.id ? `Edit an alert of ${E.typeName}` : `Add an alert to ${E.typeName}`) : E.mine && E.isNew ? (E.starts.kind !== 'issue' ? 'Add a condition-based task for this plant only' : 'Add an alert for this plant only') : `${E.upTag}: ${E.title}`, wide: true, body,
      foot: (!E.lib && E.own ? btn('Back to the library\'s', { act: 'ua:reset', data: { plant: E.key, pid: E.pid }, kind: 'ghost' }) : '') + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.lib ? (E.id ? 'Save' : 'Add to the type') : 'Save for this plant', { act: 'ua:save', kind: 'primary' }) });
  }
  U.on('ua:lib-open', (el) => { const code = el.getAttribute('data-code'); const id = el.getAttribute('data-id'); const c = cat(code); if (!c) return false; if (!isProcess(code) && !ownReadings(code).length) { U.toast('Add a reading first: an alert watches a reading.'); return false; } const a = id ? alerts(code).find((x) => x.id === id) : null;
    ED = a ? { lib: true, code, typeName: c.type, ...clone(a) } : { lib: true, code, typeName: c.type, id: null, name: '', match: 'all', when: [w(arr(c.sensors).filter((s) => s.kind !== 'meter').map((s) => s.name)[0] || 'Level', 'above', '')], band: 'minor', hold: 10, starts: { kind: 'issue', flowId: null } }; if (a && el.getAttribute('data-copy')) { ED.id = null; ED.name = ''; } if (!a && ['task', 'calibration'].includes(el.getAttribute('data-starts'))) { ED.starts = { kind: el.getAttribute('data-starts'), flowId: null }; ED.name = el.getAttribute('data-name') || ''; } drawEd(); return false; });
  U.on('ua:edit', (el) => { const key = el.getAttribute('data-plant'); const of = offer(key, el.getAttribute('data-pid')); if (!of) return false;
    ED = { lib: false, eq: !!of.eq, sk: of.sk, typeId: of.typeId, key, pid: of.pid, upId: of.upId, upTag: of.upTag, title: of.name, own: of.own, mine: !!of.mine, id: of.alert.id, why: of.why || '', name: of.name, match: of.match, band: of.band, hold: of.hold, starts: of.starts, when: of.conds.map((c) => (c.calc ? { reading: c.reading, calc: c.calc, cunit: c.unit, dir: c.dir, limit: c.limit, of: 'any' } : { reading: c.reading, dir: c.dir, limit: c.limit, of: c.of, use: c.use.slice() })) }; drawEd(); return false; });
  U.on('ua:flow-new', () => { readEd(); if (!ED || !ED.lib) return false; const keep = ED; const LF = W.V7LIBFLOW; U.closeModal(true);
    LF.returning((id) => { ED = keep; if (id) ED.starts.flowId = id; drawEd(); });
    LF.newFlow(keep.starts.kind === 'issue' ? 'diagnostic' : keep.starts.kind === 'calibration' ? 'calibration' : 'task', [keep.typeName]); return false; });
  U.on('ua:row-add', () => { readEd(); if (!ED) return false; const sc = ED.lib ? null : scopeAny(ED.key, ED.upId, ED.sk); const pool = (sc ? [...new Set(sc.map((s) => s.name))] : isProcess(ED.code) ? Object.keys(W.READINGS || {}) : ownReadings(ED.code)).filter((n) => RD(n) && RD(n).kind !== 'meter'); const next = pool.find((n) => !ED.when.some((c) => c.reading === n)) || pool[0]; if (!next) { U.toast('There is no other reading to add.'); return false; } ED.when.push({ reading: next, dir: (RD(next).direction === 'below') ? 'below' : 'above', limit: '', of: 'any' }); drawEd(); return false; });
  U.on('ua:row-del', (el) => { readEd(); if (!ED) return false; ED.when.splice(+el.getAttribute('data-i'), 1); drawEd(); return false; });
  U.on('ua:row-set', (el) => { if (!ED) return false; const before = ED.when.map((c) => c.reading); const k0 = ED.starts.kind; readEd(); ED.when.forEach((c, i) => { if (c.reading !== before[i]) { delete c.use; c.limit = ''; } }); if ((ED.lib || ED.mine) && ED.starts.kind !== k0) ED.starts.flowId = null; drawEd(); const f = document.getElementById(el.id); if (f) f.focus(); return false; });
  U.on('ua:save', () => { readEd(); if (!ED) return false; const r = ED.lib ? saveAlert(ED.code, ED) : ED.mine ? saveOwn(ED.key, ED.upId, ED) : edit(ED.key, ED.pid, ED); if (!r.ok) { U.toast(r.error); return false; } const lib = ED.lib; const mine = ED.mine; const isNew = ED.isNew; const k9 = ED.key; ED = null; U.closeModal(true); U.toast(lib ? 'Saved. Plants with this type are offered it.' : mine && isNew ? (isLive(k9) ? 'Added for this plant only. It is On.' : 'Added for this plant only. It starts when the plant goes live.') : 'Saved for this plant.'); return undefined; });
  const firstWhen = (key, u) => { const n = [...new Set(scopeAny(key, u.id, u.sk).map((q) => q.name))].find((q) => RD(q) && RD(q).kind !== 'meter'); return { reading: n, dir: RD(n) && RD(n).direction === 'below' ? 'below' : 'above', limit: '', of: 'any' }; };
  U.on('ua:own-open', (el) => { const key = el.getAttribute('data-plant'); const st9 = el.getAttribute('data-starts'); const ps = ownPlaces(key); if (!ps.length) { U.toast('Nothing here sends a reading yet. Read the plant in first.'); return false; } const sj = el.getAttribute('data-subj'); const cid = el.getAttribute('data-calc'); const u = (sj && subjects(key).find((q) => q.id === sj)) || ps[0]; const d = cid ? calcsAt(key, u.id, u.typeId).find((q) => q.id === cid) : null;
    ED = { lib: false, mine: true, isNew: true, key, sk: u.sk, typeId: u.typeId, upId: u.id, upTag: u.tag, pid: null, title: '', own: false, id: null, why: '', name: '', match: 'all', band: 'minor', hold: 10, starts: { kind: ['task', 'calibration'].includes(st9) ? st9 : 'issue', flowId: null }, when: [d ? { reading: d.name, calc: d.id, cunit: d.unit || '', dir: 'above', limit: '', of: 'any' } : firstWhen(key, u)] }; drawEd(); return false; });
  U.on('ua:where', (el) => { if (!ED || !ED.mine) return false; readEd(); const u = ownPlaces(ED.key).find((q) => q.id === el.value); if (!u) return false; Object.assign(ED, { sk: u.sk, typeId: u.typeId, upId: u.id, upTag: u.tag, when: [firstWhen(ED.key, u)] }); drawEd(); return false; });
  U.on('ua:own-remove', (el) => { const r = removeOwn(el.getAttribute('data-plant'), el.getAttribute('data-pid')); U.toast(r.ok ? 'Removed. It was at this plant only.' : r.error); return undefined; });
  U.on('ua:reset', (el) => { const r = edit(el.getAttribute('data-plant'), el.getAttribute('data-pid'), null); ED = null; U.closeModal(true); U.toast(r.ok ? 'It follows the library again.' : r.error); return undefined; });
  U.on('ua:lib-remove', (el) => { const r = removeAlert(el.getAttribute('data-code'), el.getAttribute('data-id')); U.toast(r.ok ? 'Removed from the type.' : r.error); return undefined; });
  U.on('ua:decide', (el) => { const st = el.getAttribute('data-state'); const r = decide(el.getAttribute('data-plant'), el.getAttribute('data-pid'), st === 'none' ? null : st); const n = r.ok && st === 'applied' ? run(el.getAttribute('data-plant')) : 0; const o9 = r.ok && st === 'applied' ? offer(el.getAttribute('data-plant'), el.getAttribute('data-pid')) : null; const tk9 = !!(o9 && o9.starts && o9.starts.kind !== 'issue'); U.toast(r.ok ? (st === 'applied' ? (tk9 && isLive(el.getAttribute('data-plant')) ? (o9.now && o9.now.fires ? 'Applied. Its condition holds now. This prototype shows that; it does not raise the task yet.' : 'Applied. It is On. This prototype shows when its condition holds; it does not raise the task yet.') : n ? 'Applied. Its condition holds now, so an issue is open.' : isLive(el.getAttribute('data-plant')) ? 'Applied. It is On.' : 'Applied. It starts when the plant goes live.') : st === 'left' ? 'Left out.' : 'Undecided again.') : r.error); return undefined; });
  U.on('ua:pick-t', (el) => { const box = el.closest('.ua-pickset'); if (!box) return false; const ids = [...box.querySelectorAll('input[type="checkbox"]')].filter((b) => b.checked).map((b) => b.value); const sel = box.querySelector('select[data-rule]'); const r = pickSet(el.getAttribute('data-plant'), el.getAttribute('data-pid'), el.getAttribute('data-i'), ids, sel ? sel.value : null); if (!r.ok) U.toast(r.error); return undefined; });
  U.on('ua:pick-all', (el) => { const of = offer(el.getAttribute('data-plant'), el.getAttribute('data-pid')); const c = of && of.conds[+el.getAttribute('data-i')]; if (!c) return false; const r = pickSet(el.getAttribute('data-plant'), el.getAttribute('data-pid'), el.getAttribute('data-i'), c.found.map((x) => x.id), c.of === 'all' ? 'all' : 'any'); if (!r.ok) U.toast(r.error); return undefined; });
  U.on('ua:pick', (el) => { const r = pick(el.getAttribute('data-plant'), el.getAttribute('data-pid'), el.getAttribute('data-i'), el.value); if (!r.ok) U.toast(r.error); return undefined; });
  U.on('ua:apply-all', (el) => { const key = el.getAttribute('data-plant'); const open = offers(key).filter((o) => !o.skipped && !o.state); const todo = open.filter((o) => !o.choose); todo.forEach((o) => decide(key, o.pid, 'applied')); U.toast(`${plural(todo.length, 'alert')} applied. Each is On trial first.${open.length > todo.length ? ` ${open.length - todo.length} still need their sensors ticked.` : ''}`); return undefined; });

  /* the plant: what its unit processes are offered */
  const mkRow = (key) => (o) => {
      const d = (state, label, kind, title) => btn(label, { act: 'ua:decide', data: { plant: key, pid: o.pid, state }, small: true, kind, title });
      const acts = o.skipped ? '' : o.state ? d('none', 'Undo', 'ghost', 'Back to undecided') : d('applied', 'Apply', 'primary', 'At a live plant it is On at once and opens an issue when its condition holds. At a plant being set up it starts at go live') + d('left', 'Leave out', 'ghost');
      const st = o.skipped ? chip('Skipped', { tone: 'warn' }) : o.state === 'applied' ? chip(isLive(key) ? 'Applied · On' : 'Applied · starts at go live', { tone: 'ok' }) : o.state === 'left' ? chip('Left out', { tone: 'muted' }) : o.choose ? chip('Tick its sensors', { tone: 'warn', title: 'Several sensors of the same purpose sit here. Tick the ones this alert reads' }) : chip('To decide', { tone: 'info' });
      const miss = o.missing.length ? `<div class="ua-miss">${o.skipped ? 'Skipped' : 'Watching less'}: nothing in ${esc(o.upTag)} sends ${esc(o.missing.join(' or '))}. ${o.skipped ? 'Add the sensor in the Visualization and read again, or edit the alert to use what is here.' : 'It works on the readings that are here.'}</div>` : '';
      const calcPick = (c) => (c.dyn && !c.dyn.missing.length ? `<span class="ua-calc"><b>${esc(c.reading)}</b> = ${esc(W.V7DYN.words(c.dyn.def, c.dyn))}${c.dyn.value != null ? ` <span class="dy-now">${esc(c.dyn.value)}${c.dyn.def.unit ? ' ' + esc(c.dyn.def.unit) : ''} now</span>` : ''}</span>` + c.dyn.inputs.map((q, j) => (q.found.length > 1 ? `<label class="ua-pick${q.choose ? ' is-todo' : ''}"><span><b>${q.letter}</b> ${esc(q.label || q.reading)} from</span><select data-act="dy:pick" data-plant="${esc(key)}" data-pid="${esc(c.dyn.pid)}" data-i="${j}" aria-label="Which ${esc(q.reading)} sensor for ${q.letter}"><option value="">Choose the sensor…</option>${q.found.map((x) => `<option value="${esc(x.id)}"${q.pick === x.id ? ' selected' : ''}>${esc(x.tag)}${x.onPipe ? ' (pipe)' : ''}${x.eqTag ? ' · ' + esc(x.eqTag) : ''}</option>`).join('')}</select></label>` : '')).join('') : '');
      /* 27 Nov: where a purpose has several sensors here, tick the ones this alert reads: one, a few, or all of them */
      const picksHtml = o.skipped ? '' : o.conds.map((c, i) => { if (c.calc) return calcPick(c); if (o.own || o.mine || c.found.length < 2) return ''; const on = (x) => c.chosen && c.use.includes(x.id); const nOn = c.chosen ? c.use.length : 0;
        return `<div class="ua-pick ua-pickset${c.choose ? ' is-todo' : ''}" role="group" aria-label="Which ${esc(c.reading)} sensors this alert reads"><span class="ua-pick-l">${esc(c.reading)} from</span><span class="ua-pick-b">${c.found.map((x) => `<label class="ua-pk${on(x) ? ' is-on' : ''}" title="${esc(x.onPipe ? `On a pipe${x.where ? ': ' + x.where : ''}, by ${x.eqTag}` : `On ${x.eqTag}`)}"><input type="checkbox" data-act="ua:pick-t" data-plant="${esc(key)}" data-pid="${esc(o.pid)}" data-i="${i}" value="${esc(x.id)}"${on(x) ? ' checked' : ''}><span class="mono">${esc(x.tag)}</span>${x.onPipe ? '<span class="ua-pp">pipe</span>' : ''}</label>`).join('')}</span>`
          + `<span class="ua-pick-r">${nOn > 1 ? `<select data-act="ua:pick-t" data-plant="${esc(key)}" data-pid="${esc(o.pid)}" data-i="${i}" data-rule="1" aria-label="How many of the ticked sensors must pass"><option value="any"${c.of !== 'all' ? ' selected' : ''}>any one of the ${nOn} ticked</option><option value="all"${c.of === 'all' ? ' selected' : ''}>every one of the ${nOn} ticked</option></select>` : ''}${nOn < c.found.length ? `<button type="button" class="ua-pick-all" data-act="ua:pick-all" data-plant="${esc(key)}" data-pid="${esc(o.pid)}" data-i="${i}">Tick all ${c.found.length}</button>` : ''}${c.choose ? '<span class="ua-pick-h">Tick the sensors it reads</span>' : ''}</span></div>`; }).join('');
      const now = o.skipped ? '' : `<span class="ua-now${o.now.fires ? ' is-on' : ''}" title="Worked out on the latest readings">${o.now.fires ? 'Would fire now' : 'Quiet now'}</span>`;
      return `<li class="ua-row${o.skipped ? ' is-skip' : ''}" data-kind="${o.starts && o.starts.kind !== 'issue' ? 'condition' : 'across'}"><div class="ua-main"><div class="ua-t"><b>${esc(o.name)}</b> ${U.sev(o.band)} ${st}${o.own ? ` ${chip('Changed here', { tone: 'warn', title: 'This plant edited the alert; the library keeps its own' })}` : ''}${o.mine ? ` ${chip('This plant only', { tone: 'info', title: 'Added at this plant. The library does not have it' })}` : ''}${o.onPipe ? ` ${chip('Reads a pipe', { tone: 'muted', title: 'At least one of its sensors sits on a pipe, not on equipment' })}` : ''}</div><div class="ua-w">When ${whenHtml(o.conds, o.match, o)}, for ${esc(o.hold)} min ${now}</div>${picksHtml ? `<div class="ua-picks">${picksHtml}</div>` : ''}<div class="ua-s">${startsHtml(o.starts)}${issLink(key, o)}</div>${miss}</div><div class="ua-acts">${acts}${btn('Edit', { act: 'ua:edit', data: { plant: key, pid: o.pid }, small: true, title: o.eq ? 'Change its limits, choose its sensors, or add another reading from this equipment' : 'Change its limits, choose its sensors, or add another reading from this unit process' })}${o.mine ? btn('Remove', { act: 'ua:own-remove', data: { plant: key, pid: o.pid }, small: true, kind: 'ghost', title: 'It is at this plant only, so removing it changes nothing elsewhere' }) : ''}</div></li>`;
  };
  /* 27 Nov: the alerts of one place (a unit process, a piece of equipment, a control group, the plant), for the page to list where that place is.
     Those that raise a task or a calibration are that place's condition-based tasks; the rest open an issue. show: undecided · decided · blocked · all */
  function block(key, subjId, show) {
    const all = offers(key, { upId: subjId }); const row = mkRow(key);
    const vis = all.filter((o) => (show === 'undecided' ? !o.skipped && !o.state : show === 'decided' ? !!o.state : show === 'blocked' ? o.skipped : true));
    const al = vis.filter((o) => !o.starts || o.starts.kind === 'issue'); const tk = vis.filter((o) => o.starts && o.starts.kind !== 'issue');
    return { n: vis.length, total: all.length, und: all.filter((o) => !o.skipped && !o.state).length, skipped: all.filter((o) => o.skipped).length, alerts: al.length, tasks: tk.length, alertsHtml: al.length ? `<ul class="ua-rows">${al.map(row).join('')}</ul>` : '', tasksHtml: tk.length ? `<ul class="ua-rows">${tk.map(row).join('')}</ul>` : '' };
  }
  W.V7UPALERT.block = block;
  function plantCard(key) {
    const all = offers(key); if (!all.length) return '';
    const open = all.filter((o) => !o.skipped && !o.state); const skipped = all.filter((o) => o.skipped); const applied = all.filter((o) => o.state === 'applied');
    const byUp = []; all.forEach((o) => { let g = byUp.find((x) => x.id === o.upId); if (!g) byUp.push(g = { id: o.upId, tag: o.upTag, name: o.upName, typeName: o.typeName, typeId: o.typeId, rows: [] }); g.rows.push(o); });
    const row = mkRow(key);
    const cnt = (rows) => ({ und: rows.filter((o) => !o.skipped && !o.state).length, pick: rows.filter((o) => !o.skipped && !o.state && o.choose).length, skip: rows.filter((o) => o.skipped).length, less: rows.filter((o) => !o.skipped && o.missing.length).length, on: rows.filter((o) => o.state === 'applied').length, left: rows.filter((o) => o.state === 'left').length, fire: rows.filter((o) => !o.skipped && o.state !== 'left' && o.now && o.now.fires).length });
    const flags = (c) => [c.und ? chip(`${c.und} to decide`, { tone: 'info' }) : '', c.pick ? chip(`${c.pick} ${c.pick === 1 ? 'needs' : 'need'} sensors ticked`, { tone: 'warn', title: 'Several sensors of the same purpose sit here. Tick the ones the alert reads' }) : '', c.skip ? chip(`${c.skip} skipped: a reading is missing`, { tone: 'warn', title: 'Nothing here sends a reading the alert needs' }) : '', c.less ? chip(`${c.less} watching less`, { tone: 'muted', title: 'A reading is missing, and the alert works on the readings that are here' }) : '', c.fire ? chip(`${c.fire} would fire now`, { tone: 'bad', title: 'Worked out on the latest readings' }) : '', c.on ? chip(`${c.on} applied`, { tone: 'ok' }) : '', c.left ? chip(`${c.left} left out`, { tone: 'muted' }) : '', !c.und && !c.skip ? chip('All decided', { tone: 'ok' }) : ''].filter(Boolean).join(' ');
    const T = cnt(all); const levels = all.some((o) => o.sk); const title = levels ? 'Alerts across readings' : 'Alerts across a unit process';
    const line = `${levels ? 'From the library, at up to four levels: a piece of equipment, a unit process, a control group, the whole plant.' : 'From the unit-process library: each watches kinds of reading across a step, on equipment or on a pipe.'} ${plural(byUp.length, 'place')} here, ${plural(all.length, 'alert')}. Open to decide them.`;
    const one = byUp.length === 1;
    const group = (g) => { const id = `${key}:${g.id}`; return `<details class="ua-up ua-acc" data-g="${esc(id)}"${(id in OPENG ? OPENG[id] : one) ? ' open' : ''}><summary class="ua-uph"><span class="ua-upn"><b>${esc(g.tag)}</b> ${esc(g.name)} ${g.typeId[0] === '@' ? `<span class="ua-upt">${esc(g.typeName)}</span>` : `<a class="ua-upt" href="#/library/${esc(enc(g.typeId))}">${esc(g.typeName)}</a>`}</span><span class="ua-flags">${flags(cnt(g.rows))}</span></summary><ul class="ua-rows">${g.rows.map(row).join('')}</ul></details>`; };
    return `<details class="card p7-fold ua-card" id="ua-card"${OPENC ? ' open' : ''}><summary class="p7-fold-s"><span class="p7-fold-m"><span class="p7-fold-t">${title}</span><span class="p7-fold-d">${esc(line)}</span><span class="ua-flags ua-flags-c">${flags(T)}</span></span><span class="p7-fold-r">${open.length > 1 ? btn(`Apply all ${open.length}`, { act: 'ua:apply-all', data: { plant: key }, small: true, kind: 'secondary' }) : ''}</span></summary><div class="ua-body">${[['Unit processes', (g) => !g.rows[0].sk], ['Equipment', (g) => g.rows[0].sk === 'eq'], ['Control groups', (g) => g.rows[0].sk === 'group'], ['The whole plant', (g) => g.rows[0].sk === 'plant']].map(([t, f]) => { const gs = byUp.filter(f); return gs.length ? `<p class="ua-kind">${t}</p>${gs.map(group).join('')}` : ''; }).join('')}</div></details>`;
  }
  let OPENC = false; const OPENG = {};
  document.addEventListener('toggle', (ev) => { const d = ev.target; if (!d || !d.getAttribute) return; if (d.id === 'ua-card') OPENC = d.open; else if (d.classList && d.classList.contains('ua-acc')) OPENG[d.getAttribute('data-g')] = d.open; }, true);
  W.V7UPALERT.plantCard = plantCard;
  if (U.afterRender) U.afterRender((main, path) => { try { const m = /^#?\/?p\/([^/?]+)(\/(library|issues))?(\?|$)/.exec(String(path || location.hash).replace(/^#\//, '')); if (m && run(decodeURIComponent(m[1])) && U.render) { /* shown on the next screen */ } } catch (e) { /* nothing opens */ } });
  (function clock() { const v = V(); const a0 = v && v.advance; if (typeof a0 !== 'function' || a0._ua) return; v.advance = function () { const r = a0.apply(this, arguments); try { arr(v.plants()).forEach((p) => run(p.key)); } catch (e) { /* nothing opens */ } return r; }; v.advance._ua = true; })();
  if (U.afterRender) U.afterRender((main, path) => { try { const m = /^#?\/?p\/([^/?]+)\/library/.exec(String(path || location.hash).replace(/^#\//, '')); if (!m || !main || main.querySelector('#ua-card') || main.querySelector('[data-ua-in]')) return; const html = plantCard(decodeURIComponent(m[1])); if (!html) return; let first = main.querySelector('.card'); if (first && first.previousElementSibling && /p7-sec-h/.test(first.previousElementSibling.className || '')) first = first.previousElementSibling; if (first) first.insertAdjacentHTML('beforebegin', html); else main.insertAdjacentHTML('beforeend', html); } catch (e) { /* the page still shows without it */ } });
})();
