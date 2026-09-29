/* Fixture data for the CloseTheLoop configuration proposal.
   One plant, realistic but small. Every object here maps onto the approved
   PRD data model (see the "Under the hood" page); the UI vocabulary differs
   on purpose. */

window.SEED = {
  plant: {
    id: 'manesar', name: 'Manesar STP', code: 'DP-SITE-014', capacity: '2.5 MLD',
    quietHours: { from: '22:00', to: '06:00', on: true },
    hooter: { on: true, seconds: 60 },
    modules: ['core', 'ops', 'tasks', 'data', 'analytics', 'iot'],
  },

  stages: [
    { id: 'inlet', name: 'Inlet Works' },
    { id: 'bal', name: 'Balancing' },
    { id: 'bio', name: 'Biological' },
    { id: 'sep', name: 'Separation' },
    { id: 'filt', name: 'Filtration' },
    { id: 'dis', name: 'Disinfection' },
    { id: 'sludge', name: 'Sludge handling' },
  ],

  groups: [
    { id: 'blowers', name: 'Blower group', stage: 'bio', members: ['bl1', 'bl2'], note: 'Duty / standby pair on one header' },
  ],

  /* archetype: rotating · vessel · fixed · membrane · dosing · panel
     expects: what the archetype says a maintenance programme should contain */
  equipment: [
    { id: 'bs1', name: 'Bar Screen', tag: 'BS-1', stage: 'inlet', type: 'Mechanical bar screen', archetype: 'fixed', tier: 'B', status: 'running', expects: ['inspection'] },
    { id: 'eq1', name: 'Equalization Tank', tag: 'EQ-1', stage: 'bal', type: 'Equalisation tank', archetype: 'vessel', tier: 'C', status: 'running', expects: ['cleaning'] },
    { id: 'at1', name: 'Aeration Tank 1', tag: 'AT-1', stage: 'bio', type: 'Aeration basin', archetype: 'vessel', tier: 'B', status: 'running', expects: [] },
    { id: 'at2', name: 'Aeration Tank 2', tag: 'AT-2', stage: 'bio', type: 'Aeration basin', archetype: 'vessel', tier: 'B', status: 'running', expects: [] },
    { id: 'bl1', name: 'Air Blower 1', tag: 'BL-1', stage: 'bio', group: 'blowers', type: 'Centrifugal blower', archetype: 'rotating', tier: 'A', duty: 'lead', status: 'running', expects: ['mechanical PM'], meter: 'bl1_hrs' },
    { id: 'bl2', name: 'Air Blower 2', tag: 'BL-2', stage: 'bio', group: 'blowers', type: 'Centrifugal blower', archetype: 'rotating', tier: 'B', duty: 'standby', standbyOf: 'bl1', status: 'stopped', expects: ['mechanical PM'], meter: 'bl2_hrs' },
    { id: 'cl1', name: 'Secondary Clarifier 1', tag: 'SC-1', stage: 'sep', type: 'Circular clarifier', archetype: 'rotating', tier: 'B', status: 'running', expects: ['mechanical PM'] },
    { id: 'mbr1', name: 'MBR Skid 1', tag: 'MBR-1', stage: 'sep', type: 'Membrane bioreactor skid', archetype: 'membrane', tier: 'A', status: 'running', expects: ['CIP'] },
    { id: 'mgf1', name: 'Multigrade Filter 1', tag: 'MGF-1', stage: 'filt', type: 'Multigrade filter', archetype: 'vessel', tier: 'B', status: 'running', expects: ['backwash'] },
    { id: 'uf1', name: 'UF Skid 1', tag: 'UF-1', stage: 'filt', type: 'Ultrafiltration skid', archetype: 'membrane', tier: 'A', status: 'running', expects: ['CIP'], cycles: true },
    { id: 'cdu', name: 'Chlorine Dosing Unit', tag: 'CDU-1', stage: 'dis', type: 'Hypochlorite dosing unit', archetype: 'dosing', tier: 'A', status: 'running', expects: ['pump PM', 'refill'] },
    { id: 'sp1', name: 'Sludge Pump 1', tag: 'SP-1', stage: 'sludge', type: 'Progressive cavity pump', archetype: 'rotating', tier: 'C', status: 'running', expects: ['mechanical PM'] },
  ],

  /* on: 'eq:<id>' — the machine the instrument sits on.
     kind: analytical (a probe that drifts and needs calibration) · process · status (boolean) · meter (monotonic)
     limits: thresholds by severity in `direction`; null = no limit at that tier */
  sensors: [
    { id: 'at2_do', name: 'Dissolved oxygen', tag: 'DO-AT2', unit: 'mg/L', on: 'eq:at2', kind: 'analytical', valid: [0, 6], reading: 1.8, state: 'live', direction: 'below', limits: { caution: null, minor: 2.0, major: 1.0, emergency: 0.5 }, setpoint: { value: 2.0, tag: 'AERATION.DO_02_SP' }, calibration: { every: 'monthly', by: 'vendor', vendor: 'Advance Analytik', contractEnd: '2027-03-31' } },
    { id: 'at2_mlss', name: 'MLSS', tag: 'MLSS-AT2', unit: 'mg/L', on: 'eq:at2', kind: 'analytical', valid: [0, 12000], reading: 3400, state: 'live', direction: 'above', limits: { caution: null, minor: 4500, major: null, emergency: null } },
    { id: 'at2_temp', name: 'Temperature', tag: 'TEMP-AT2', unit: '°C', on: 'eq:at2', kind: 'process', valid: [0, 60], reading: 29.4, state: 'live', direction: 'above', limits: { caution: 35, minor: 38, major: null, emergency: null } },
    { id: 'at1_do', name: 'Dissolved oxygen', tag: 'DO-AT1', unit: 'mg/L', on: 'eq:at1', kind: 'analytical', valid: [0, 6], reading: 2.3, state: 'live', direction: 'below', limits: { caution: null, minor: 2.0, major: 1.0, emergency: null } },
    { id: 'at1_mlss', name: 'MLSS', tag: 'MLSS-AT1', unit: 'mg/L', on: 'eq:at1', kind: 'analytical', valid: [0, 12000], reading: 2650, state: 'stale', direction: 'below', limits: { caution: null, minor: 2500, major: null, emergency: null } },
    { id: 'bl1_press', name: 'Line pressure', tag: 'PRESS-BL1', unit: 'bar', on: 'eq:bl1', kind: 'process', valid: [0, 1.2], reading: 0.58, state: 'live', direction: 'above', limits: { caution: null, minor: 0.65, major: 0.85, emergency: null } },
    { id: 'bl1_amps', name: 'Motor current', tag: 'AMP-BL1', unit: 'A', on: 'eq:bl1', kind: 'process', valid: [0, 60], reading: 38.2, state: 'live', direction: 'above', limits: { caution: 44, minor: 48, major: null, emergency: null } },
    { id: 'bl1_trip', name: 'Trip contact', tag: 'TRIP-BL1', unit: '', on: 'eq:bl1', kind: 'status', valid: [0, 1], reading: 0, state: 'live', direction: 'above', limits: { caution: null, minor: null, major: null, emergency: 1 } },
    { id: 'bl1_hrs', name: 'Run hours', tag: 'HRS-BL1', unit: 'h', on: 'eq:bl1', kind: 'meter', valid: [0, 999999], reading: 18240, state: 'live', direction: null, limits: null },
    { id: 'bl2_press', name: 'Line pressure', tag: 'PRESS-BL2', unit: 'bar', on: 'eq:bl2', kind: 'process', valid: [0, 1.2], reading: 0.0, state: 'live', direction: 'above', limits: { caution: null, minor: 0.65, major: 0.85, emergency: null } },
    { id: 'bl2_hrs', name: 'Run hours', tag: 'HRS-BL2', unit: 'h', on: 'eq:bl2', kind: 'meter', valid: [0, 999999], reading: 4120, state: 'live', direction: null, limits: null },
    { id: 'eq1_lvl', name: 'Level', tag: 'LVL-EQ1', unit: '%', on: 'eq:eq1', kind: 'process', valid: [0, 100], reading: 61, state: 'live', direction: 'above', limits: { caution: 85, minor: null, major: 95, emergency: null }, setpoint: { value: 90, tag: 'BALANCING.LEVEL_01_SP' } },
    { id: 'eq1_flood', name: 'Sump flood switch', tag: 'FLOOD-EQ1', unit: '', on: 'eq:eq1', kind: 'status', valid: [0, 1], reading: 0, state: 'live', direction: 'above', limits: { caution: null, minor: null, major: null, emergency: 1 } },
    { id: 'eq1_ph', name: 'pH', tag: 'PH-EQ1', unit: 'pH', on: 'eq:eq1', kind: 'analytical', valid: [1, 14], reading: 7.4, state: 'live', direction: 'above', limits: { caution: null, minor: 8.5, major: 9.5, emergency: null } },
    { id: 'cl1_blanket', name: 'Sludge blanket', tag: 'BLK-SC1', unit: 'm', on: 'eq:cl1', kind: 'analytical', valid: [0, 4], reading: 0.7, state: 'live', direction: 'above', limits: { caution: null, minor: 1.2, major: null, emergency: null } },
    { id: 'mbr_perm', name: 'Permeability', tag: 'PERM-MBR1', unit: 'LMH/bar', on: 'eq:mbr1', kind: 'process', valid: [0, 400], reading: 112, state: 'live', direction: 'below', limits: { caution: null, minor: 80, major: 50, emergency: null } },
    { id: 'mbr_turb', name: 'Outlet turbidity', tag: 'TURB-MBR1', unit: 'NTU', on: 'eq:mbr1', kind: 'analytical', valid: [0, 100], reading: 0.6, state: 'live', direction: 'above', limits: { caution: null, minor: null, major: null, emergency: null } },
    { id: 'mgf_dp', name: 'Differential pressure', tag: 'DP-MGF1', unit: 'bar', on: 'eq:mgf1', kind: 'process', valid: [0, 3], reading: 0.9, state: 'live', direction: 'above', limits: { caution: null, minor: 1.8, major: null, emergency: null } },
    { id: 'uf_rec', name: 'Recovery', tag: 'REC-UF1', unit: '%', on: 'eq:uf1', kind: 'computed', expr: 'PERM_FLOW / FEED_FLOW × 100', valid: [0, 100], reading: 78, state: 'live', direction: 'below', limits: { caution: null, minor: 72, major: 65, emergency: null } },
    { id: 'uf_inlet', name: 'Inlet pressure', tag: 'PIN-UF1', unit: 'bar', on: 'eq:uf1', kind: 'process', valid: [0, 6], reading: 2.1, state: 'live', direction: 'above', limits: { caution: null, minor: 3.2, major: null, emergency: null } },
    { id: 'cdu_frc', name: 'Residual chlorine', tag: 'FRC-OUT', unit: 'mg/L', on: 'eq:cdu', kind: 'analytical', valid: [0, 10], reading: 0.5, state: 'live', direction: 'below', limits: { caution: null, minor: 0.2, major: null, emergency: null }, setpoint: { value: 0.5, tag: 'DISINFECTION.FRC_01_SP' } },
    { id: 'cdu_lvl', name: 'Hypo tank level', tag: 'LVL-CDU', unit: '%', on: 'eq:cdu', kind: 'process', valid: [0, 100], reading: 42, state: 'live', direction: 'below', limits: { caution: 25, minor: 10, major: null, emergency: null } },
  ],

  /* An alert = the PRD's Trigger with outcome 'issue'. limits: 'sensor' means the
     bands are the sensor's limits (inheritsSensorZones), 'custom' means this alert
     carries its own. closes.mode 'sensor' = resolution condition, 'operator' = manual. */
  alerts: [
    { id: 'a_do_bio', name: 'DO low — Biological', subject: { kind: 'stage', id: 'bio' }, sensor: 'at2_do', limits: 'sensor', holdMin: 0, closes: { mode: 'sensor', back: 2.2, holdMin: 15 }, flow: 'f_lowdo', verify: false, status: 'active', open: 0, template: 'aeration' },
    { id: 'a_mlss_hi', name: 'MLSS high — AT-1', subject: { kind: 'eq', id: 'at1' }, sensor: 'at1_mlss', limits: 'custom', custom: { caution: null, minor: 4500, major: null, emergency: null }, direction: 'above', holdMin: 30, closes: { mode: 'sensor', back: 4200, holdMin: 30 }, flow: null, verify: false, status: 'active', open: 0 },
    { id: 'a_bl1_press', name: 'Line pressure high — BL-1', subject: { kind: 'eq', id: 'bl1' }, sensor: 'bl1_press', limits: 'sensor', holdMin: 5, closes: { mode: 'sensor', back: 0.6, holdMin: 5 }, flow: 'f_blower', verify: false, status: 'active', open: 1, template: 'blower' },
    { id: 'a_bl1_trip', name: 'Blower tripped — BL-1', subject: { kind: 'eq', id: 'bl1' }, sensor: 'bl1_trip', limits: 'sensor', holdMin: 0, closes: { mode: 'operator' }, flow: null, cause: 'c_trip', verify: true, status: 'active', open: 0, template: 'blower' },
    { id: 'a_flood', name: 'Sump flooding — EQ-1', subject: { kind: 'eq', id: 'eq1' }, sensor: 'eq1_flood', limits: 'sensor', holdMin: 0, closes: { mode: 'operator' }, flow: null, verify: true, status: 'active', open: 0 },
    { id: 'a_mbr_perm', name: 'Permeability falling — MBR-1', subject: { kind: 'eq', id: 'mbr1' }, sensor: 'mbr_perm', limits: 'sensor', holdMin: 60, closes: { mode: 'sensor', back: 90, holdMin: 60 }, flow: 'f_turb', verify: false, status: 'active', open: 0, template: 'membrane' },
    { id: 'a_blanket', name: 'Sludge blanket high — SC-1', subject: { kind: 'eq', id: 'cl1' }, sensor: 'cl1_blanket', limits: 'sensor', holdMin: 30, closes: { mode: 'sensor', back: 0.8, holdMin: 30 }, flow: null, verify: false, status: 'active', open: 0, pairOf: 'w_sludge' },
    { id: 'a_frc', name: 'Residual chlorine low', subject: { kind: 'eq', id: 'cdu' }, sensor: 'cdu_frc', limits: 'sensor', holdMin: 10, closes: { mode: 'sensor', back: 0.3, holdMin: 10 }, flow: null, verify: false, status: 'active', open: 0, clocks: { response: 4, deadline: 12 } },
    { id: 'a_uf_rec', name: 'Recovery low — UF-1', subject: { kind: 'eq', id: 'uf1' }, sensor: 'uf_rec', limits: 'sensor', holdMin: 15, closes: { mode: 'sensor', back: 75, holdMin: 30 }, flow: null, verify: false, status: 'active', open: 0, cycle: { id: 'uf_bw', only: 'Production' } },
    { id: 'a_mgf_dp', name: 'Backwash not keeping up — MGF-1', subject: { kind: 'eq', id: 'mgf1' }, sensor: 'mgf_dp', limits: 'sensor', holdMin: 10, closes: { mode: 'sensor', back: 1.0, holdMin: 10 }, flow: null, verify: false, status: 'active', open: 0, pairOf: 'w_backwash' },
    { id: 'a_turb', name: 'Outlet turbidity high — MBR-1', subject: { kind: 'eq', id: 'mbr1' }, sensor: 'mbr_turb', limits: 'custom', custom: { caution: null, minor: 5, major: 10, emergency: null }, direction: 'above', holdMin: 10, closes: { mode: 'sensor', back: 3, holdMin: 20 }, flow: 'f_turb', verify: false, status: 'draft', open: 0 },
  ],

  /* A schedule = Trigger with outcome 'task', triggerType 'schedule', workType. */
  schedules: [
    { id: 's_backwash', name: 'Weekly backwash', subject: { kind: 'eq', id: 'mgf1' }, workType: 'routine', flow: 'f_backwash', basis: 'calendar', every: { n: 1, unit: 'week' }, anchor: 'fixed', nextDue: '2026-10-01', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 0 },
    { id: 's_bl1_pm', name: 'Bearing service', subject: { kind: 'eq', id: 'bl1' }, workType: 'pm', flow: 'f_blower', basis: 'either', every: { n: 6, unit: 'month' }, meter: { tag: 'bl1_hrs', hours: 500, last: 17980 }, anchor: 'last', nextDue: '2026-11-14', performedBy: 'in_house', statutory: false, verify: true, status: 'active', open: 0, template: 'blower' },
    { id: 's_bl2_pm', name: 'Bearing service', subject: { kind: 'eq', id: 'bl2' }, workType: 'pm', flow: 'f_blower', basis: 'either', every: { n: 6, unit: 'month' }, meter: { tag: 'bl2_hrs', hours: 500, last: 3900 }, anchor: 'last', nextDue: '2027-01-08', performedBy: 'in_house', statutory: false, verify: true, status: 'active', open: 0, template: 'blower' },
    { id: 's_mbr_cip', name: 'Quarterly CIP', subject: { kind: 'eq', id: 'mbr1' }, workType: 'pm', flow: 'f_cip', basis: 'calendar', every: { n: 3, unit: 'month' }, anchor: 'last', nextDue: '2026-10-12', performedBy: 'in_house', statutory: false, verify: true, status: 'active', open: 1, template: 'membrane' },
    { id: 's_do_cal', name: 'DO probe calibration', subject: { kind: 'eq', id: 'at2' }, workType: 'calibration', probe: 'at2_do', flow: null, basis: 'calendar', every: { n: 1, unit: 'month' }, anchor: 'fixed', nextDue: '2026-10-01', performedBy: 'vendor', vendor: 'Advance Analytik', statutory: false, verify: false, status: 'active', open: 0 },
    { id: 's_logbook', name: 'Daily logbook round', subject: { kind: 'plant' }, workType: 'routine', flow: 'f_logbook', basis: 'calendar', every: { n: 1, unit: 'day' }, anchor: 'fixed', nextDue: '2026-09-30', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 1 },
    { id: 's_sample', name: 'Monthly compliance sample', subject: { kind: 'plant' }, workType: 'routine', flow: null, basis: 'calendar', every: { n: 1, unit: 'month' }, anchor: 'fixed', nextDue: '2026-10-05', performedBy: 'in_house', statutory: true, verify: true, status: 'active', open: 0 },
    { id: 's_hooter', name: 'Hooter function test', subject: { kind: 'plant' }, workType: 'routine', flow: null, basis: 'calendar', every: { n: 3, unit: 'month' }, anchor: 'fixed', nextDue: '2026-12-01', performedBy: 'in_house', statutory: false, verify: true, status: 'active', open: 0 },
    { id: 's_hypo', name: 'Hypo tank refill', subject: { kind: 'eq', id: 'cdu' }, workType: 'routine', flow: null, basis: 'calendar', every: { n: 1, unit: 'week' }, anchor: 'fixed', nextDue: '2026-10-02', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 0 },
    { id: 'w_sludge', name: 'Sludge wasting', subject: { kind: 'eq', id: 'sp1' }, workType: 'routine', flow: null, basis: 'calendar', every: { n: 1, unit: 'week' }, anchor: 'fixed', nextDue: '2026-10-03', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 0, pairOf: 'a_blanket' },
  ],

  /* Condition-based work = Trigger with outcome 'task', triggerType 'alert' (routine): fires on a
     rising edge, re-arms on the opposite threshold, optionally pairs with an alert above a worse threshold. */
  conditionWork: [
    { id: 'w_backwash', name: 'Backwash when pressure builds', subject: { kind: 'eq', id: 'mgf1' }, sensor: 'mgf_dp', doWhen: 1.2, doneWhen: 1.0, flow: 'f_backwash', escalate: { at: 1.8, severity: 'minor', alert: 'a_mgf_dp' }, status: 'active', open: 0 },
    { id: 'w_intake', name: 'Clean intake filter', subject: { kind: 'eq', id: 'bl1' }, sensor: 'bl1_amps', doWhen: 44, doneWhen: 40, flow: 'f_blower', escalate: null, status: 'active', open: 0 },
  ],

  milestones: [
    { id: 'm1', name: 'DO held above 2.5 mg/L for 24 hours', on: 'at2_do', status: 'active', count: 14 },
    { id: 'm2', name: 'Zero overdue tasks this week', on: null, status: 'active', count: 6 },
    { id: 'm3', name: '90 days without an Emergency', on: null, status: 'active', count: 1 },
  ],

  cycles: [
    { id: 'uf_bw', name: 'UF backwash cycle', eq: 'uf1', phases: [
      { name: 'Production', kind: 'time', minutes: 30 }, { name: 'Top drain', kind: 'sensor', minutes: 2 },
      { name: 'Air scour', kind: 'time', minutes: 3 }, { name: 'Bottom backwash', kind: 'sensor', minutes: 5 }, { name: 'Forward flush', kind: 'time', minutes: 2 } ] },
  ],

  /* kind: diagnostic (asks until it reaches a cause) · action (does the work) */
  flows: [
    { id: 'f_lowdo', name: 'Low DO diagnostic', kind: 'diagnostic', forType: 'Aeration basin', version: 4, status: 'published', steps: [
      { id: 1, type: 'question', text: 'Is the duty blower running?', answers: { Yes: { t: 'step', id: 2 }, No: { t: 'cause', id: 'c_blower_off' } } },
      { id: 2, type: 'reading', text: 'Read the blower line pressure', sensor: 'bl1_press', split: 0.45, answers: { Above: { t: 'step', id: 3 }, Below: { t: 'cause', id: 'c_intake' } } },
      { id: 3, type: 'question', text: 'Is bubbling even across the basin?', answers: { Yes: { t: 'step', id: 4 }, No: { t: 'cause', id: 'c_diffuser' } } },
      { id: 4, type: 'question', text: 'Does the SV30 settle below 400 mL/L?', answers: { Yes: { t: 'step', id: 5 }, No: { t: 'cause', id: 'c_bulking' } } },
      { id: 5, type: 'question', text: 'Does a handheld DO meter agree with the probe?', answers: { Yes: { t: 'cause', id: 'c_underaer' }, No: { t: 'cause', id: 'c_probe' } } },
    ] },
    { id: 'f_turb', name: 'Turbidity diagnostic', kind: 'diagnostic', forType: 'Membrane bioreactor skid', version: 2, status: 'published', steps: [
      { id: 1, type: 'question', text: 'Is there foam on the membrane tank?', answers: { Yes: { t: 'step', id: 2 }, No: { t: 'cause', id: 'c_seal' } } },
      { id: 2, type: 'reading', text: 'Read the trans-membrane pressure', sensor: 'mbr_perm', split: 80, answers: { Above: { t: 'open' }, Below: { t: 'cause', id: 'c_fouling' } } },
    ] },
    { id: 'f_blower', name: 'Blower inspection', kind: 'action', forType: 'Centrifugal blower', version: 3, status: 'published', steps: [
      { id: 1, type: 'instruction', text: 'Stop the blower and lock out the MCC', photo: 'required' },
      { id: 2, type: 'instruction', text: 'Remove and inspect the intake filter' },
      { id: 3, type: 'question', text: 'Is the filter element clean?' },
      { id: 4, type: 'instruction', text: 'Grease both bearings (2 pumps each)' },
      { id: 5, type: 'reading', text: 'Record the motor current after restart', sensor: 'bl1_amps' },
      { id: 6, type: 'instruction', text: 'Remove lock-out and confirm the blower is running', photo: 'live' },
    ] },
    { id: 'f_backwash', name: 'Backwash filter', kind: 'action', forType: 'Multigrade filter', version: 3, status: 'published', steps: [
      { id: 1, type: 'instruction', text: 'Close the inlet valve' },
      { id: 2, type: 'instruction', text: 'Open the backwash valve and start the backwash pump' },
      { id: 3, type: 'wait', text: 'Backwash for 8 minutes', minutes: 8 },
      { id: 4, type: 'instruction', text: 'Rinse to drain for 4 minutes' },
      { id: 5, type: 'reading', text: 'Record the differential pressure after rinse', sensor: 'mgf_dp' },
      { id: 6, type: 'instruction', text: 'Return the filter to service', photo: 'optional' },
    ] },
    { id: 'f_cip', name: 'MBR clean in place', kind: 'action', forType: 'Membrane bioreactor skid', version: 2, status: 'published', steps: [
      { id: 1, type: 'instruction', text: 'Isolate the skid and drain the membrane tank' },
      { id: 2, type: 'instruction', text: 'Prepare 500 ppm hypochlorite solution', photo: 'required' },
      { id: 3, type: 'wait', text: 'Soak for 60 minutes', minutes: 60 },
      { id: 4, type: 'instruction', text: 'Rinse and return to service' },
      { id: 5, type: 'reading', text: 'Record permeability after the clean', sensor: 'mbr_perm' },
    ] },
    { id: 'f_screen', name: 'Clear bar screen', kind: 'action', forType: 'Mechanical bar screen', version: 1, status: 'published', steps: [
      { id: 1, type: 'instruction', text: 'Stop the rake and lock out' },
      { id: 2, type: 'instruction', text: 'Rake screenings by hand into the skip', photo: 'required' },
      { id: 3, type: 'instruction', text: 'Restart the rake' },
    ] },
    { id: 'f_logbook', name: 'Daily logbook round', kind: 'action', forType: null, version: 3, status: 'published', steps: [
      { id: 1, type: 'instruction', text: 'Collect the logbook tablet and check the handover notes' },
      { id: 2, type: 'reading', text: 'Inlet works — record the totaliser flow', sensor: null },
      { id: 3, type: 'question', text: 'Bar screen — is the rake running?' },
      { id: 4, type: 'reading', text: 'Equalization tank — record the level', sensor: 'eq1_lvl' },
      { id: 5, type: 'reading', text: 'Aeration Tank 2 — record dissolved oxygen', sensor: 'at2_do' },
      { id: 6, type: 'instruction', text: 'Fill the settling cone to 1 litre' },
      { id: 7, type: 'wait', text: 'Let the sludge settle', minutes: 30 },
      { id: 8, type: 'reading', text: 'Record the settled volume (SV30)', sensor: null },
    ] },
    { id: 'f_sludge', name: 'Sludge wasting', kind: 'action', forType: 'Progressive cavity pump', version: 1, status: 'draft', steps: [
      { id: 1, type: 'instruction', text: 'Open the WAS valve and start the pump' },
      { id: 2, type: 'wait', text: 'Run for 20 minutes', minutes: 20 },
    ] },
  ],

  causes: [
    { id: 'c_blower_off', name: 'Duty blower off', stage: 'bio', type: 'Centrifugal blower', fix: 'f_blower' },
    { id: 'c_intake', name: 'Blower intake filter blocked', stage: 'bio', type: 'Centrifugal blower', fix: 'f_blower' },
    { id: 'c_diffuser', name: 'Diffuser fouling', stage: 'bio', type: 'Aeration basin', fix: null },
    { id: 'c_bulking', name: 'Sludge bulking', stage: 'bio', type: null, fix: null },
    { id: 'c_underaer', name: 'Under-aeration', stage: 'bio', type: null, fix: null },
    { id: 'c_probe', name: 'Probe drift — needs calibration', stage: null, type: null, fix: null, sensorFault: true },
    { id: 'c_fouling', name: 'Membrane fouling', stage: 'sep', type: 'Membrane bioreactor skid', fix: 'f_cip' },
    { id: 'c_seal', name: 'Membrane seal breach', stage: 'sep', type: 'Membrane bioreactor skid', fix: null },
    { id: 'c_screen', name: 'Bar screen choked', stage: 'inlet', type: 'Mechanical bar screen', fix: 'f_screen' },
    { id: 'c_trip', name: 'Motor overload trip', stage: 'bio', type: 'Centrifugal blower', fix: 'f_blower' },
  ],

  /* role: l1 Operator · l3 Lead · l4 Senior Lead · regular Client viewer. grant: people · tech · fullsite · global */
  people: [
    { id: 'p1', name: 'Dheeraj Kumar', role: 'l1', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00' },
    { id: 'p2', name: 'Nagesh Patil', role: 'l1', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00' },
    { id: 'p3', name: 'Devid Toppo', role: 'l1', phone: { verified: true, channel: 'sms' }, major: 'now', quiet: 'off' },
    { id: 'p4', name: 'Kishore Reddy', role: 'l3', grant: 'people', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '23:00–05:00' },
    { id: 'p5', name: 'Swadesh Singh', role: 'l3', grant: 'tech', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00' },
    { id: 'p6', name: 'Sunny Verma', role: 'l4', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00', plants: 6 },
    { id: 'p7', name: 'Amit Rao', role: 'regular', phone: { verified: false, channel: null }, major: 'email', quiet: 'off', company: 'Client' },
  ],

  /* Global "standard sets" — a Trigger template names an equipment TYPE and sensor KINDS; a site
     binds it to one machine and its tags. Limits here are the estate defaults. */
  standardSets: [
    { id: 't_blower', type: 'Centrifugal blower', usedAt: 31, alerts: [
        { name: 'Line pressure high', sensorKind: 'Line pressure', direction: 'above', limits: { minor: 0.65, major: 0.85 }, flow: 'f_blower' },
        { name: 'Motor current high', sensorKind: 'Motor current', direction: 'above', limits: { caution: 44, minor: 48 } },
        { name: 'Blower tripped', sensorKind: 'Trip contact', direction: 'above', limits: { emergency: 1 }, cause: 'c_trip' },
      ], schedules: [
        { name: 'Bearing service', workType: 'pm', basis: 'either', every: { n: 6, unit: 'month' }, meterHours: 500, flow: 'f_blower' },
        { name: 'Clean intake filter', workType: 'condition', sensorKind: 'Motor current', doWhen: 44, doneWhen: 40, flow: 'f_blower' },
      ] },
    { id: 't_aeration', type: 'Aeration basin', usedAt: 27, alerts: [
        { name: 'DO low', sensorKind: 'Dissolved oxygen', direction: 'below', limits: { minor: 2.0, major: 1.0, emergency: 0.5 }, flow: 'f_lowdo' },
        { name: 'MLSS out of band', sensorKind: 'MLSS', direction: 'above', limits: { minor: 4500 } },
      ], schedules: [
        { name: 'DO probe calibration', workType: 'calibration', basis: 'calendar', every: { n: 1, unit: 'month' } },
      ] },
    { id: 't_membrane', type: 'Membrane bioreactor skid', usedAt: 9, alerts: [
        { name: 'Permeability falling', sensorKind: 'Permeability', direction: 'below', limits: { minor: 80, major: 50 }, flow: 'f_turb' },
        { name: 'Outlet turbidity high', sensorKind: 'Outlet turbidity', direction: 'above', limits: { minor: 5, major: 10 }, flow: 'f_turb' },
      ], schedules: [
        { name: 'Quarterly CIP', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' }, flow: 'f_cip' },
      ] },
    { id: 't_dosing', type: 'Hypochlorite dosing unit', usedAt: 22, alerts: [
        { name: 'Residual chlorine low', sensorKind: 'Residual chlorine', direction: 'below', limits: { minor: 0.2 } },
        { name: 'Hypo tank low', sensorKind: 'Hypo tank level', direction: 'below', limits: { caution: 25, minor: 10 } },
      ], schedules: [
        { name: 'Dosing pump service', workType: 'pm', basis: 'calendar', every: { n: 3, unit: 'month' } },
        { name: 'Hypo tank refill', workType: 'routine', basis: 'calendar', every: { n: 1, unit: 'week' } },
      ] },
    { id: 't_pcpump', type: 'Progressive cavity pump', usedAt: 40, alerts: [], schedules: [
        { name: 'Stator and rotor check', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } },
      ] },
    { id: 't_clarifier', type: 'Circular clarifier', usedAt: 18, alerts: [
        { name: 'Sludge blanket high', sensorKind: 'Sludge blanket', direction: 'above', limits: { minor: 1.2 } },
      ], schedules: [
        { name: 'Scraper drive service', workType: 'pm', basis: 'calendar', every: { n: 6, unit: 'month' } },
      ] },
  ],

  audit: [
    { ts: '2026-09-29 11:42', who: 'Swadesh Singh', what: 'Changed limits on Dissolved oxygen (DO-AT2)', detail: 'Major 1.2 → 1.0 mg/L · 1 alert follows this sensor' },
    { ts: '2026-09-28 17:05', who: 'Kishore Reddy', what: 'Changed Bearing service on BL-2 from the equipment card', detail: 'Every 6 months → every 6 months or 500 run-hours · applies from the next occurrence' },
    { ts: '2026-09-28 09:20', who: 'Swadesh Singh', what: 'Activated alert Recovery low — UF-1', detail: 'Only during the Production phase of the UF backwash cycle' },
    { ts: '2026-09-27 16:48', who: 'Kishore Reddy', what: 'Added Devid Toppo as Operator', detail: 'Phone verified by SMS' },
    { ts: '2026-09-27 10:02', who: 'Swadesh Singh', what: 'Published Blower inspection v3', detail: '2 schedules and 1 alert run it' },
    { ts: '2026-09-26 14:30', who: 'Sunny Verma', what: 'Overrode criticality on Air Blower 2', detail: 'A → B: standby of BL-1. Rises to A while BL-1 is unavailable' },
  ],
};
