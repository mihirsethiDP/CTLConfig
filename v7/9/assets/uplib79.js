/* v7/9 · uplib79.js — the sensors on pipes that take part in each unit-process type.
   27 Nov. A flow meter, a pressure gauge or an analyser on a pipe is not on any piece of equipment, but it takes part in the unit
   process the pipe belongs to. The library names them per type, so alerts across the unit process, calculated values, condition-based
   tasks and calibration can be written with them before any plant exists. Each plant then puts its own sensor tags to them.
   window.V7UPLIB = { pipes(code) → [{ name, note }], all() } */
(function () {
  'use strict';
  const W = window; const BY = W.CATALOGUE_BY_CODE || {}; const R = W.READINGS || {};
  const AIR = [['Line pressure', 'on the air header'], ['Flow', 'on the return sludge line']];
  const OUT = [['Flow', 'on the outlet line'], ['Discharge pressure', 'on the transfer pump\'s discharge']];
  const P = {
    screening: [['Flow', 'in the inlet channel']], mechanical_screening: [['Flow', 'in the inlet channel']], rotary_drum_screening: [['Flow', 'in the inlet channel']],
    grit_removal: [['Flow', 'in the inlet channel']], oil_grease_removal: [['Flow', 'on the inlet line']], hydrocyclone_separation: [['Flow', 'on the feed line']],
    flash_mixing: [['Flow', 'on the feed line']], flocculation: [['Flow', 'on the feed line']],
    dissolved_air_flotation: [['Line pressure', 'on the saturator'], ['Flow', 'on the feed line'], ['Outlet turbidity', 'in the water leaving the unit']],
    tube_settling: [['Outlet turbidity', 'in the water leaving the settler'], ['Flow', 'on the sludge line']],
    anoxic_treatment: [['Flow', 'on the internal recycle line']],
    activated_sludge: AIR.concat([['Online ammonia', 'in the water leaving the tank']]), sbr: [['Line pressure', 'on the air header'], ['Flow', 'on the decant line']], cass: [['Line pressure', 'on the air header'], ['Flow', 'on the decant line']],
    mbbr: [['Line pressure', 'on the air header'], ['Flow', 'on the feed line'], ['Online COD', 'in the water entering and leaving the reactor'], ['Online ammonia', 'in the water leaving the reactor']],
    mbr: [['Flow', 'on the permeate line'], ['Line pressure', 'on the air scour header']], membrane_filtration: [['Flow', 'on the permeate line']],
    cascade_aeration: [['Flow', 'on the inlet line']], anaerobic_treatment: [['Flow', 'on the feed line']], sludge_digestion: [['Flow', 'on the feed line']],
    media_filtration: [['Flow', 'on the filter outlet'], ['Outlet turbidity', 'in the filtered water'], ['Inlet pressure', 'before the filter'], ['Line pressure', 'after the filter']],
    microfiltration: [['Flow', 'on the permeate line'], ['Outlet turbidity', 'in the permeate']],
    ultrafiltration: [['Flow', 'on the permeate line'], ['Outlet turbidity', 'in the permeate'], ['Line pressure', 'on the permeate line']],
    nanofiltration: [['Differential pressure', 'across the membrane array'], ['Flow', 'on the permeate line']], ro_desalination: [['Differential pressure', 'across the membrane array'], ['Flow', 'on the permeate line']],
    uv_disinfection: [['Flow', 'through the UV channel'], ['Outlet turbidity', 'in the water entering the UV']],
    chlorination: [['Flow', 'on the outlet line']], dechlorination: [['Flow', 'on the outlet line']], softening: [['Flow', 'on the outlet line']], cooling: [['Flow', 'on the circulation line']],
    collection: OUT, equalization: OUT, filter_feed: OUT, filtered_water: [['Flow', 'on the outlet line']], recirculation_holding: [['Flow', 'on the outlet line']], sludge_holding: [['Flow', 'on the sludge transfer line']],
    treated_water: [['Flow', 'on the reuse line'], ['Residual chlorine', 'in the water going out']],
    clarification: [['Flow', 'on the return sludge line']], gravity_thickening: [['Flow', 'on the underflow line']], daf_thickening: [['Line pressure', 'on the saturator']],
    centrifuge_thickening: [['Flow', 'on the feed line']], centrifuge_dewatering: [['Flow', 'on the feed line']],
  };
  let n = 0;
  Object.keys(P).forEach((code) => { const c = BY[code]; if (!c) return; c.nextPhase = c.nextPhase || { readings: [], alerts: [], work: [] }; c.nextPhase.readings = c.nextPhase.readings || [];
    P[code].forEach(([name, note]) => { if (!R[name] || c.nextPhase.readings.some((x) => x.name === name)) return; c.nextPhase.readings.push({ name, note }); n++; }); });
  const pipes = (code) => { const c = BY[code]; return c && c.nextPhase ? (c.nextPhase.readings || []).map((x) => ({ name: x.name, note: x.note || '' })) : []; };
  W.V7UPLIB = { pipes, added: n };
})();
