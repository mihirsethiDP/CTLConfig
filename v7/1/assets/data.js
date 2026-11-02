/* Fixture data for the CloseTheLoop configuration proposal.
   One plant, realistic but small. Every object here maps onto the approved
   PRD data model (see the "Under the hood" page); the UI vocabulary differs
   on purpose. v5: a plant is its machines and the plant as a whole, nothing in between. Each machine carries the
   database equipment type it was drawn as (code) and the type stored on it (dbType); its library type is the database's
   name. A reading on a connection (a pipe, or across two of them) arrives marked nextPhase and is never alerted on. */

window.SEED = {
  plant: {
    id: 'manesar', name: 'Manesar STP', code: 'DP-SITE-014', type: 'STP', capacity: '2.5 MLD',
    quietHours: { from: '22:00', to: '06:00', on: true },
    hooter: { on: true, seconds: 60 },
    modules: ['core', 'ops', 'tasks', 'data', 'analytics', 'iot'],
  },

  /* code: the database equipment type the node was drawn with; dbType: the type stored on it (it wins); type: its name in the database.
     archetype: rotating · vessel · fixed · membrane · dosing · valve · device
     expects: what the type says a maintenance programme should contain */
  equipment: [
    { id: 'bs1', name: 'Bar Screen', tag: 'BS-1', code: 'MECHANICAL_SCREEN', dbType: 'MECHANICAL_SCREEN', type: 'Mechanical Screen', archetype: 'fixed', tier: 'B', status: 'running', expects: ['inspection'] },
    { id: 'eq1', name: 'Equalization Tank', tag: 'EQ-1', code: 'OS_TANK', dbType: 'OS_TANK', type: 'Open Skeleton Tank', archetype: 'vessel', tier: 'C', status: 'running', expects: ['cleaning'] },
    { id: 'at1', name: 'Aeration Tank 1', tag: 'AT-1', code: 'OS_TANK_DF', dbType: 'OS_TANK_DF', type: 'Diffuser Tank', archetype: 'vessel', tier: 'B', status: 'running', expects: [] },
    { id: 'at2', name: 'Aeration Tank 2', tag: 'AT-2', code: 'OS_TANK_DF', dbType: 'OS_TANK_DF', type: 'Diffuser Tank', archetype: 'vessel', tier: 'B', status: 'running', expects: [] },
    { id: 'bl1', name: 'Air Blower 1', tag: 'BL-1', code: 'BLW', dbType: 'BLW', type: 'Blower', archetype: 'rotating', tier: 'A', status: 'running', expects: ['mechanical PM'], meter: 'bl1_hrs' },
    { id: 'bl2', name: 'Air Blower 2', tag: 'BL-2', code: 'BLW', dbType: 'BLW', type: 'Blower', archetype: 'rotating', tier: 'A', status: 'stopped', expects: ['mechanical PM'], meter: 'bl2_hrs' },
    { id: 'cl1', name: 'Secondary Clarifier 1', tag: 'SC-1', code: 'CLARIFIER', dbType: 'CLARIFIER', type: 'Clarifier Tank', archetype: 'rotating', tier: 'B', status: 'running', expects: ['mechanical PM'] },
    { id: 'mbr1', name: 'MBR Skid 1', tag: 'MBR-1', code: 'MBR', dbType: 'MBR', type: 'MBR', archetype: 'membrane', tier: 'A', status: 'running', expects: ['CIP'] },
    { id: 'mgf1', name: 'Multigrade Filter 1', tag: 'MGF-1', code: 'ACF_MGF', dbType: 'ACF_MGF', type: 'ACF/MGF', archetype: 'vessel', tier: 'B', status: 'running', expects: ['backwash'] },
    { id: 'uf1', name: 'UF Skid 1', tag: 'UF-1', code: 'UF_MEM', dbType: 'UF_MEM', type: 'UF Membrane', archetype: 'membrane', tier: 'A', status: 'running', expects: ['CIP'], cycles: true },
    { id: 'cdu', name: 'Chlorine Dosing Unit', tag: 'CDU-1', code: 'D_PMP', dbType: 'D_PMP', type: 'Dosing Pump', archetype: 'dosing', tier: 'A', status: 'running', expects: ['pump PM'], meter: 'cdu_hrs' },
    { id: 'sp1', name: 'Sludge Pump 1', tag: 'SP-1', code: 'PMP', dbType: 'PMP', type: 'Pump', archetype: 'rotating', tier: 'C', tierReason: 'Sludge can wait a day; nothing overflows while it is stopped', status: 'running', expects: ['mechanical PM'], meter: 'sp1_hrs' },
  ],

  /* on: 'eq:<id>' — the machine the instrument sits on.
     kind: analytical (a probe that drifts and needs calibration) · process · status (boolean) · meter (monotonic)
     limits: thresholds by severity in `direction`; null = no limit at that tier
     nextPhase: the widget reads a connection (a pipe, or across two of them). It arrives from SCADA, takes no limits and raises
     nothing until connections join the library. source 'custom': this plant's own, not from the library (the hypo tank's level
     is drawn on the dosing unit here; the library keeps a chemical tank's level on the Dosing Tank). */
  sensors: [
    { id: 'bs1_dh', name: 'Level differential', tag: 'DH-BS1', unit: 'mm', on: 'eq:bs1', kind: 'process', valid: [0, 500], reading: 40, state: 'live', direction: 'above', limits: null, nextPhase: true },
    { id: 'at2_do', name: 'Dissolved oxygen', tag: 'DO-AT2', unit: 'mg/L', on: 'eq:at2', kind: 'analytical', valid: [0, 6], reading: 1.8, state: 'live', direction: 'below', limits: { caution: null, minor: 2.0, major: 1.0, emergency: 0.5 }, setpoint: { value: 2.0, tag: 'AERATION.DO_02_SP' }, calibration: { every: 'monthly', by: 'vendor', vendor: 'Advance Analytik', contractEnd: '2027-03-31' } },
    { id: 'at2_mlss', name: 'MLSS', tag: 'MLSS-AT2', unit: 'mg/L', on: 'eq:at2', kind: 'analytical', valid: [0, 12000], reading: 3400, state: 'live', direction: 'above', limits: { caution: null, minor: 4500, major: null, emergency: null } },
    { id: 'at2_temp', name: 'Temperature', tag: 'TEMP-AT2', unit: '°C', on: 'eq:at2', kind: 'process', valid: [0, 60], reading: 29.4, state: 'live', direction: 'above', limits: { caution: 35, minor: 38, major: null, emergency: null } },
    { id: 'at1_do', name: 'Dissolved oxygen', tag: 'DO-AT1', unit: 'mg/L', on: 'eq:at1', kind: 'analytical', valid: [0, 6], reading: 2.3, state: 'live', direction: 'below', limits: { caution: null, minor: 2.0, major: 1.0, emergency: null } },
    { id: 'at1_mlss', name: 'MLSS', tag: 'MLSS-AT1', unit: 'mg/L', on: 'eq:at1', kind: 'analytical', valid: [0, 12000], reading: 2650, state: 'stale', direction: 'below', limits: { caution: null, minor: 2500, major: null, emergency: null } },
    { id: 'bl1_press', name: 'Line pressure', tag: 'PRESS-BL1', unit: 'bar', on: 'eq:bl1', kind: 'process', valid: [0, 1.2], reading: 0.58, state: 'live', direction: 'above', limits: null, nextPhase: true },
    { id: 'bl1_amps', name: 'Motor current', tag: 'AMP-BL1', unit: 'A', on: 'eq:bl1', kind: 'process', valid: [0, 60], reading: 38.2, state: 'live', direction: 'above', limits: { caution: 44, minor: 48, major: null, emergency: null } },
    { id: 'bl1_trip', name: 'Trip contact', tag: 'TRIP-BL1', unit: '', on: 'eq:bl1', kind: 'status', valid: [0, 1], reading: 0, state: 'live', direction: 'above', limits: { caution: null, minor: null, major: null, emergency: 1 } },
    { id: 'bl1_hrs', name: 'Run hours', tag: 'HRS-BL1', unit: 'h', on: 'eq:bl1', kind: 'meter', valid: [0, 999999], reading: 18240, state: 'live', direction: null, limits: null },
    { id: 'bl2_press', name: 'Line pressure', tag: 'PRESS-BL2', unit: 'bar', on: 'eq:bl2', kind: 'process', valid: [0, 1.2], reading: 0.0, state: 'live', direction: 'above', limits: null, nextPhase: true },
    { id: 'bl2_hrs', name: 'Run hours', tag: 'HRS-BL2', unit: 'h', on: 'eq:bl2', kind: 'meter', valid: [0, 999999], reading: 4120, state: 'live', direction: null, limits: null },
    { id: 'eq1_lvl', name: 'Level', tag: 'LVL-EQ1', unit: '%', on: 'eq:eq1', kind: 'process', valid: [0, 100], reading: 61, state: 'live', direction: 'above', limits: { caution: 85, minor: null, major: 95, emergency: null }, setpoint: { value: 90, tag: 'BALANCING.LEVEL_01_SP' } },
    { id: 'eq1_flood', name: 'Sump flood switch', tag: 'FLOOD-EQ1', unit: '', on: 'eq:eq1', kind: 'status', valid: [0, 1], reading: 0, state: 'live', direction: 'above', limits: { caution: null, minor: null, major: null, emergency: 1 } },
    { id: 'eq1_ph', name: 'pH', tag: 'PH-EQ1', unit: 'pH', on: 'eq:eq1', kind: 'analytical', valid: [1, 14], reading: 7.4, state: 'live', direction: 'above', limits: { caution: null, minor: 8.5, major: 9.5, emergency: null } },
    { id: 'cl1_blanket', name: 'Sludge blanket', tag: 'BLK-SC1', unit: 'm', on: 'eq:cl1', kind: 'analytical', valid: [0, 4], reading: 0.7, state: 'live', direction: 'above', limits: { caution: null, minor: 1.2, major: null, emergency: null } },
    { id: 'mbr_perm', name: 'Permeability', tag: 'PERM-MBR1', unit: 'LMH/bar', on: 'eq:mbr1', kind: 'process', valid: [0, 400], reading: 112, state: 'live', direction: 'below', limits: null, nextPhase: true },
    { id: 'mbr_turb', name: 'Outlet turbidity', tag: 'TURB-MBR1', unit: 'NTU', on: 'eq:mbr1', kind: 'analytical', valid: [0, 100], reading: 0.6, state: 'live', direction: 'above', limits: null, nextPhase: true },
    { id: 'mgf_dp', name: 'Differential pressure', tag: 'DP-MGF1', unit: 'bar', on: 'eq:mgf1', kind: 'process', valid: [0, 3], reading: 0.9, state: 'live', direction: 'above', limits: null, nextPhase: true },
    { id: 'uf_rec', name: 'Recovery', tag: 'REC-UF1', unit: '%', on: 'eq:uf1', kind: 'computed', expr: 'PERM_FLOW / FEED_FLOW × 100', valid: [0, 100], reading: 78, state: 'live', direction: 'below', limits: null, nextPhase: true },
    { id: 'uf_inlet', name: 'Inlet pressure', tag: 'PIN-UF1', unit: 'bar', on: 'eq:uf1', kind: 'process', valid: [0, 6], reading: 2.1, state: 'live', direction: 'above', limits: null, nextPhase: true },
    { id: 'cdu_frc', name: 'Residual chlorine', tag: 'FRC-OUT', unit: 'mg/L', on: 'eq:cdu', kind: 'analytical', valid: [0, 10], reading: 0.5, state: 'live', direction: 'below', limits: null, nextPhase: true, setpoint: { value: 0.5, tag: 'DISINFECTION.FRC_01_SP' } },
    { id: 'cdu_lvl', name: 'Chemical tank level', tag: 'TLVL-CDU', unit: '%', on: 'eq:cdu', kind: 'process', valid: [0, 100], reading: 42, state: 'live', direction: 'below', limits: { caution: 25, minor: 10, major: null, emergency: null }, source: 'custom' },
    { id: 'cdu_hrs', name: 'Run hours', tag: 'HRS-CDU', unit: 'h', on: 'eq:cdu', kind: 'meter', valid: [0, 999999], reading: 1200, state: 'live', direction: null, limits: null },
    { id: 'sp1_hrs', name: 'Run hours', tag: 'HRS-SP1', unit: 'h', on: 'eq:sp1', kind: 'meter', valid: [0, 999999], reading: 310, state: 'live', direction: null, limits: null },
  ],

  /* An alert = the PRD's Trigger with outcome 'issue', always on a machine and always on a reading on the equipment.
     limits: 'sensor' means the alert follows the sensor's own limits, 'custom' means this alert carries its own (with its
     direction). closes.mode 'sensor' = resolution condition, 'operator' = manual. */
  alerts: [
    { id: 'a_do_at2', name: 'DO low — AT-2', subject: { kind: 'eq', id: 'at2' }, sensor: 'at2_do', limits: 'sensor', holdMin: 0, closes: { mode: 'sensor', back: 2.2, holdMin: 15 }, flow: 'f_lowdo', verify: false, status: 'active', open: 0, template: 't_os_tank_df' },
    { id: 'a_mlss_hi', name: 'MLSS high — AT-1', subject: { kind: 'eq', id: 'at1' }, sensor: 'at1_mlss', limits: 'custom', custom: { caution: null, minor: 4500, major: null, emergency: null }, direction: 'above', holdMin: 30, closes: { mode: 'sensor', back: 4200, holdMin: 30 }, flow: null, verify: false, status: 'active', open: 0 },
    { id: 'a_bl1_amps', name: 'Motor current high — BL-1', subject: { kind: 'eq', id: 'bl1' }, sensor: 'bl1_amps', limits: 'sensor', holdMin: 5, closes: { mode: 'sensor', back: 42, holdMin: 5 }, flow: 'f_blower_current', verify: false, status: 'active', open: 1, template: 't_blw' },
    { id: 'a_bl1_trip', name: 'Blower tripped — BL-1', subject: { kind: 'eq', id: 'bl1' }, sensor: 'bl1_trip', limits: 'sensor', holdMin: 0, closes: { mode: 'operator' }, flow: null, cause: 'c_trip', verify: true, status: 'active', open: 0, template: 't_blw' },
    { id: 'a_flood', name: 'Sump flooding — EQ-1', subject: { kind: 'eq', id: 'eq1' }, sensor: 'eq1_flood', limits: 'sensor', holdMin: 0, closes: { mode: 'operator' }, flow: null, verify: true, status: 'active', open: 0 },
    { id: 'a_blanket', name: 'Sludge blanket high — SC-1', subject: { kind: 'eq', id: 'cl1' }, sensor: 'cl1_blanket', limits: 'sensor', holdMin: 30, closes: { mode: 'sensor', back: 0.8, holdMin: 30 }, flow: null, verify: false, status: 'active', open: 0 },
  ],

  /* A schedule = Trigger with outcome 'task', triggerType 'schedule', workType. On a machine or on the plant. */
  schedules: [
    { id: 's_backwash', name: 'Weekly backwash', subject: { kind: 'eq', id: 'mgf1' }, workType: 'routine', flow: 'f_backwash', basis: 'calendar', every: { n: 1, unit: 'week' }, anchor: 'fixed', nextDue: '2026-10-01', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 0, template: 't_acf_mgf' },
    { id: 's_bl1_pm', name: 'Bearing service', subject: { kind: 'eq', id: 'bl1' }, workType: 'pm', flow: 'f_blower', basis: 'either', every: { n: 6, unit: 'month' }, meter: { tag: 'bl1_hrs', hours: 500, last: 17980 }, anchor: 'last', nextDue: '2026-11-14', performedBy: 'in_house', statutory: false, verify: true, status: 'active', open: 0, template: 't_blw' },
    { id: 's_bl2_pm', name: 'Bearing service', subject: { kind: 'eq', id: 'bl2' }, workType: 'pm', flow: 'f_blower', basis: 'either', every: { n: 6, unit: 'month' }, meter: { tag: 'bl2_hrs', hours: 500, last: 3900 }, anchor: 'last', nextDue: '2027-01-08', performedBy: 'in_house', statutory: false, verify: true, status: 'active', open: 0, template: 't_blw' },
    { id: 's_mbr_cip', name: 'Quarterly CIP', subject: { kind: 'eq', id: 'mbr1' }, workType: 'pm', flow: 'f_cip', basis: 'calendar', every: { n: 3, unit: 'month' }, anchor: 'last', nextDue: '2026-10-12', performedBy: 'in_house', statutory: false, verify: true, status: 'active', open: 1, template: 't_mbr' },
    { id: 's_do_cal', name: 'DO probe calibration', subject: { kind: 'eq', id: 'at2' }, workType: 'calibration', probe: 'at2_do', flow: null, basis: 'calendar', every: { n: 1, unit: 'month' }, anchor: 'fixed', nextDue: '2026-10-01', performedBy: 'vendor', vendor: 'Advance Analytik', statutory: false, verify: false, status: 'active', open: 0 },
    { id: 's_logbook', name: 'Daily logbook round', subject: { kind: 'plant' }, workType: 'routine', flow: 'f_logbook', basis: 'calendar', every: { n: 1, unit: 'day' }, anchor: 'fixed', nextDue: '2026-09-30', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 1 },
    { id: 's_sample', name: 'Monthly compliance sample', subject: { kind: 'plant' }, workType: 'routine', flow: null, basis: 'calendar', every: { n: 1, unit: 'month' }, anchor: 'fixed', nextDue: '2026-10-05', performedBy: 'in_house', statutory: true, verify: true, status: 'active', open: 0 },
    { id: 's_hooter', name: 'Hooter function test', subject: { kind: 'plant' }, workType: 'routine', flow: null, basis: 'calendar', every: { n: 3, unit: 'month' }, anchor: 'fixed', nextDue: '2026-12-01', performedBy: 'in_house', statutory: false, verify: true, status: 'active', open: 0 },
    { id: 's_hypo', name: 'Chemical refill', subject: { kind: 'eq', id: 'cdu' }, workType: 'routine', flow: null, basis: 'calendar', every: { n: 1, unit: 'week' }, anchor: 'fixed', nextDue: '2026-10-02', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 0 },
    { id: 'w_sludge', name: 'Sludge wasting', subject: { kind: 'eq', id: 'sp1' }, workType: 'routine', flow: null, basis: 'calendar', every: { n: 1, unit: 'week' }, anchor: 'fixed', nextDue: '2026-10-03', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 0 },
  ],

  /* Condition-based work = Trigger with outcome 'task', triggerType 'alert' (routine): fires on a rising edge of a reading on
     the equipment and re-arms on the opposite threshold; escalate, when set, also raises an issue above a worse threshold.
     The intake filter job starts below the current alert (44 A on BL-1, a 22 kW blower with 40 A full load). */
  conditionWork: [
    { id: 'w_intake', name: 'Clean intake filter', subject: { kind: 'eq', id: 'bl1' }, sensor: 'bl1_amps', doWhen: 42, doneWhen: 38, flow: 'f_blower', escalate: null, status: 'active', open: 0, template: 't_blw' },
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

  /* flows.js installs the library's flows (diagnostic and action) and root causes, for every plant. */
  flows: [],
  causes: [],

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

  /* The library's standard sets (one per database equipment type) live in catalogue.js, which sets SEED.standardSets. */
  standardSets: [],

  audit: [
    { ts: '2026-09-29 11:42', who: 'Swadesh Singh', what: 'Changed limits on Dissolved oxygen (DO-AT2)', detail: 'Major 1.2 → 1.0 mg/L · 1 alert follows this sensor' },
    { ts: '2026-09-28 17:05', who: 'Kishore Reddy', what: 'Changed Bearing service on BL-2 from the equipment card', detail: 'Every 6 months → every 6 months or 500 run-hours · applies from the next occurrence' },
    { ts: '2026-09-28 09:20', who: 'Swadesh Singh', what: 'Activated alert Sump flooding — EQ-1', detail: 'Emergency at once; a Lead verifies the close' },
    { ts: '2026-09-27 16:48', who: 'Kishore Reddy', what: 'Added Devid Toppo as Operator', detail: 'Phone verified by SMS' },
    { ts: '2026-09-27 10:02', who: 'Swadesh Singh', what: 'Published Blower inspection v3', detail: 'The intake filter job on BL-1 runs it' },
    { ts: '2026-09-26 14:30', who: 'Sunny Verma', what: 'Overrode criticality on Sludge Pump 1', detail: 'B → C: sludge can wait a day; nothing overflows while it is stopped' },
  ],
};
