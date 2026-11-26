/* v7/9 · uplib79.js — the sensors on pipes that take part in each type, as readings of that type.
   27 Nov. A flow meter, a pressure gauge or an analyser on a pipe is not on any piece of equipment, but it takes part in the unit
   process the pipe belongs to. The library names them per type, so alerts across the unit process, calculated values, condition-based
   tasks and calibration can be written with them before any plant exists. Each plant then puts its own sensor tags to them.
   28 Nov (decided): a sensor on a pipe takes limits and times directly, like a sensor on equipment. So a pipe sensor is a reading of
   its type with its own limits sheet; the limits a type had "waiting" for its pipes are now real limits; and a plant's pipe sensor
   is an ordinary reading that carries "On a pipe". A condition across the unit process is for what needs more than one sensor.
   window.V7UPLIB = { pipes(code) → [{ name, note }], isPipe(code, reading), added } */
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

  /* 28 Nov: every type's pipe sensors become readings of the type, and the limits it had waiting for them become its limits */
  const sets = (W.SEED && W.SEED.standardSets) || []; const PIPES = {};
  const lim = (name, sensorKind, direction, limits) => ({ name, sensorKind, direction, limits, pipe: true });
  /* starter limits for pipe sensors of unit-process types: a first draft, to confirm */
  const START = {
    activated_sludge: [lim('Air header pressure low', 'Line pressure', 'below', { minor: 0.3, major: 0.2 })], sbr: [lim('Air header pressure low', 'Line pressure', 'below', { minor: 0.3, major: 0.2 })],
    cass: [lim('Air header pressure low', 'Line pressure', 'below', { minor: 0.3, major: 0.2 })], mbbr: [lim('Air header pressure low', 'Line pressure', 'below', { minor: 0.3, major: 0.2 })],
    equalization: [lim('Discharge pressure high', 'Discharge pressure', 'above', { minor: 4, major: 5 })], collection: [lim('Discharge pressure high', 'Discharge pressure', 'above', { minor: 4, major: 5 })],
    filter_feed: [lim('Discharge pressure high', 'Discharge pressure', 'above', { minor: 4, major: 5 })],
    media_filtration: [lim('Pressure drop high', 'Differential pressure', 'above', { minor: 0.8, major: 1.2 })],
    mbr: [lim('Trans-membrane pressure high', 'Trans-membrane pressure', 'above', { minor: 0.4, major: 0.6 })], membrane_filtration: [lim('Trans-membrane pressure high', 'Trans-membrane pressure', 'above', { minor: 0.4, major: 0.6 })],
    microfiltration: [lim('Trans-membrane pressure high', 'Trans-membrane pressure', 'above', { minor: 0.6, major: 0.8 })], ultrafiltration: [lim('Trans-membrane pressure high', 'Trans-membrane pressure', 'above', { minor: 0.6, major: 0.8 })],
    nanofiltration: [lim('Permeate conductivity high', 'Permeate conductivity', 'above', { minor: 300, major: 500 })], ro_desalination: [lim('Permeate conductivity high', 'Permeate conductivity', 'above', { minor: 300, major: 500 })],
    treated_water: [lim('Residual chlorine low', 'Residual chlorine', 'below', { minor: 0.2 })],
    dissolved_air_flotation: [lim('Saturator pressure low', 'Line pressure', 'below', { minor: 4, major: 3.5 })], daf_thickening: [lim('Saturator pressure low', 'Line pressure', 'below', { minor: 4, major: 3.5 })],
    softening: [lim('Outlet hardness high', 'Outlet hardness', 'above', { minor: 50, major: 100 })], cooling: [lim('Cooling water hot', 'Cooling water temperature', 'above', { minor: 35, major: 40 })],
  };
  let promoted = 0; let limits = 0;
  Object.keys(BY).forEach((code) => { const c = BY[code]; const np = c && c.nextPhase; if (!np || !Array.isArray(c.sensors)) return;
    const list = (np.readings || []).filter((x) => R[x.name]); PIPES[code] = list.map((x) => ({ name: x.name, note: x.note || 'on a pipe' }));
    list.forEach((x) => { const r = R[x.name]; if (c.sensors.some((s) => s.name === x.name)) return; c.sensors.push({ name: x.name, tag: r.tag, unit: r.unit, kind: r.kind, valid: (r.valid || [0, 1]).slice(), direction: r.direction || null, reading: r.valid ? (r.valid[0] + r.valid[1]) / 2 : 0, pipe: true, note: x.note || 'on a pipe' }); promoted++; });
    np.readings = (np.readings || []).filter((x) => !R[x.name]);
    const st = sets.find((t) => t.type === c.type); if (!st) return; const has = (k, d) => st.alerts.some((a) => a.sensorKind === k && a.direction === d);
    const keep = []; (np.alerts || []).forEach((a) => { if (a.limits && a.direction && c.sensors.some((s) => s.name === a.reading) && !has(a.reading, a.direction)) { st.alerts.push({ name: a.name, sensorKind: a.reading, direction: a.direction, limits: { ...a.limits }, pipe: true, ...(a.flow ? { flow: a.flow } : {}), ...(a.cause ? { cause: a.cause } : {}) }); limits++; } else if (!(a.limits && a.direction && has(a.reading, a.direction))) keep.push(a); }); np.alerts = keep;
    (START[code] || []).forEach((a) => { if (c.sensors.some((s) => s.name === a.sensorKind) && !has(a.sensorKind, a.direction) && !st.alerts.some((y) => y.name === a.name)) { st.alerts.push({ ...a, limits: { ...a.limits } }); limits++; } }); });
  /* the sample plants: a sensor marked as waiting on a pipe is an ordinary reading that sits on a pipe */
  (function walk(o, d) { if (!o || typeof o !== 'object' || d > 6) return; if (Array.isArray(o)) { o.forEach((x) => walk(x, d + 1)); return; } if (o.nextPhase === true && typeof o.on === 'string' && R[o.name] && R[o.name].where === 'connection') { o.onPipe = true; delete o.nextPhase; } Object.keys(o).forEach((k) => { if (k !== 'standardSets' && k !== 'flows' && k !== 'causes') walk(o[k], d + 1); }); })(W.SEED, 0);
  const pipes = (code) => (PIPES[code] || []).slice();
  const isPipe = (code, reading) => (PIPES[code] || []).some((x) => x.name === reading);
  W.V7UPLIB = { pipes, isPipe, added: n, promoted, limits };
})();
