/* v7 · tests/ui7.stub.js — a small stand-in for window.V7 (core7.js), used ONLY by tests/ui7.test.js and by
   `node tests/smoke.js --stub` while core7.js does not exist yet. Loads after v6's layer (uses CTL for equipment).
   Shapes follow core7.js; numbers follow the story loosely. Not loaded by prototype.html. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const CTL = W.CTL;
  const BASE = Date.UTC(2026, 9, 29, 3, 30);            // Thu 29 Oct 2026 09:00 IST
  const H = 36e5; const DAY = 24 * H;
  let S = null;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  const ist = (ms) => new Date(ms + 330 * 60000);
  function fmtDay(ms) { const d = ist(ms); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; }
  function fmt(ms) { const d = ist(ms); return `${fmtDay(ms)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
  function eqOf(key) {
    if (!CTL) return [];
    let out = [];
    try { CTL.withPlant(key, () => { out = CTL.D().equipment.map((e) => ({ id: e.id, tag: e.tag, name: e.name, type: e.type, code: e.code, dbType: e.dbType })); }); } catch (e) { out = []; }
    return out;
  }
  function seed() {
    if (CTL && CTL.seedEstate) { try { CTL.seedEstate(); } catch (e) { /* ignore */ } }
    S = {
      now: BASE,
      plants: [
        { key: 'digitalpaani', name: 'DigitalPaani', type: 'STP', state: 'commissioning', since: BASE - 30 * 60000, sample: false },
        { key: 'vedanta', name: 'Vedanta ETP', type: 'ETP', state: 'commissioning', since: Date.UTC(2026, 9, 23, 4, 30), sample: true },
        { key: 'manesar', name: 'Manesar STP', type: 'STP', state: 'live', since: Date.UTC(2026, 8, 1, 3, 30), sample: true },
        { key: 'bawal', name: 'Bawal WTP', type: 'WTP', state: 'live', since: Date.UTC(2026, 6, 15, 3, 30), sample: true },
      ],
      alerts: {
        vedanta: [{ id: 'al_v1', name: 'Level high — EQ-1', state: 'trial' }, { id: 'al_v2', name: 'DO low — SBR-1', state: 'trial' }, { id: 'al_v3', name: 'pH high — PH-EQ-1', state: 'trial' }],
        manesar: [{ id: 'al_m1', name: 'DO low — AT-2', state: 'on' }, { id: 'al_m2', name: 'MLSS high — AT-1', state: 'on' }],
        bawal: [{ id: 'al_b1', name: 'Motor current high — RW-1', state: 'on' }], digitalpaani: [],
      },
      issues: {
        vedanta: [{ id: 'is_1', plant: 'vedanta', alertId: 'al_v3', eqId: 'v_eq1', band: 'emergency', status: 'open', opened: BASE - 18 * H, commissioning: true, told: [], log: [] }],
        manesar: [{ id: 'is_2', plant: 'manesar', alertId: 'al_m1', eqId: 'at2', band: 'major', status: 'open', opened: BASE - 80 * 60000, commissioning: false, told: [], log: [] }],
        bawal: [], digitalpaani: [],
      },
      activity: [
        { at: BASE - 30 * 60000, plant: 'digitalpaani', who: 'Satyadev Singh', text: 'Read from SCADA: 66 pieces of equipment of 13 database types.', kind: 'scada' },
        { at: BASE - 80 * 60000, plant: 'manesar', who: 'System', text: 'DO low — AT-2 opened at Major (limit 1.0 mg/L).', kind: 'issue' },
        { at: BASE - 18 * H, plant: 'vedanta', who: 'System', text: 'pH high — PH-EQ-1 opened at Emergency. Leads told by WhatsApp and in the app.', kind: 'issue' },
        { at: Date.UTC(2026, 9, 23, 4, 30), plant: 'vedanta', who: 'Satyadev Singh', text: 'Accepted what SCADA found.', kind: 'review' },
        { at: Date.UTC(2026, 9, 23, 5, 0), plant: 'vedanta', who: 'Satyadev Singh', text: 'Accepted the library proposals for 12 of 13 equipment. Alerts are On trial.', kind: 'review' },
      ],
      overrides: [
        { id: 'ov1', plant: 'manesar', state: 'ok', reason: 'unrecorded', what: 'DO — AT-2 · Minor' },
        { id: 'ov2', plant: 'manesar', state: 'review', reason: 'unrecorded', what: 'Motor current — BL-1 · Minor' },
        { id: 'ov3', plant: 'manesar', state: 'ok', reason: 'notinlib', what: 'MLSS high — AT-1' },
        { id: 'ov4', plant: 'bawal', state: 'ended', reason: 'fornow', what: 'Level — DT-1' },
      ],
      drafts: {},
    };
  }
  const API = {
    S: null,
    boot() { if (!S) seed(); API.S = S; },
    reset() { seed(); API.S = S; },
    persist() {},
    now() { return S.now; },
    fmt, fmtDay,
    advance(min) {
      S.now += min * 60000;
      const opened = min >= 360 ? [{ id: 'is_n' + S.now, plant: 'manesar' }] : [];
      opened.forEach((i) => { S.issues.manesar.push({ id: i.id, plant: 'manesar', alertId: 'al_m2', eqId: 'at1', band: 'minor', status: 'open', opened: S.now, told: [], log: [] }); S.activity.push({ at: S.now, plant: 'manesar', who: 'System', text: 'MLSS high — AT-1 opened at Minor.', kind: 'issue' }); });
      return { opened, closed: [], trial: Array.from({ length: Math.round(min / 120) }, (_, i) => ({ i })), tasksDue: min >= 1440 ? [{ plant: 'manesar' }] : [] };
    },
    plants() { return S.plants.map((p) => Object.assign({}, p)); },
    plant(key) { return S.plants.find((p) => p.key === key) || null; },
    state(key) { const p = API.plant(key); return p ? p.state : null; },
    withPlant(key, fn) { return CTL ? CTL.withPlant(key, fn) : fn(); },
    equipment(key) { return eqOf(key); },
    eq(key, id) { return eqOf(key).find((e) => e.id === id) || null; },
    sensors() { return []; },
    alerts(key) { return (S.alerts[key] || []).slice(); },
    schedules() { return []; },
    people(key) { return key === 'digitalpaani' ? [] : [{ id: 'p1', name: 'Operator', role: 'l1', reachable: true }]; },
    issues(key, o) { let l = (S.issues[key] || []).slice(); if (o && o.status) l = l.filter((i) => i.status === o.status); return l; },
    issue(key, id) { return (S.issues[key] || []).find((i) => i.id === id) || null; },
    tasks() { return []; },
    task() { return null; },
    checklist(key) {
      const p = API.plant(key);
      if (key === 'digitalpaani') return { state: p.state, tracks: {}, blockers: [{ id: 'b1', text: 'What SCADA found is not accepted yet', link: '#/p/digitalpaani/scada' }, { id: 'b2', text: 'No library proposals decided', link: '#/p/digitalpaani/library' }, { id: 'b3', text: 'Nobody reachable in the User Center', link: '#/p/digitalpaani' }], gaps: [{ id: 'g1', text: '3 drawn types differ from stored types', link: '#/p/digitalpaani/scada', count: 3 }, { id: 'g2', text: 'Readings with no limits', link: '#/p/digitalpaani/readings', count: 12 }], canGoLive: false, whyNot: '3 blockers' };
      if (key === 'vedanta') return { state: p.state, tracks: {}, blockers: [{ id: 'b4', text: 'One library proposal is undecided', link: '#/p/vedanta/library' }], gaps: [{ id: 'g3', text: 'Level high — EQ-1 is noisy', link: '#/p/vedanta/alert/al_v1', count: 1 }], canGoLive: false, whyNot: 'One library proposal is undecided' };
      return { state: p ? p.state : 'live', tracks: {}, blockers: [], gaps: [{ id: 'g5', text: 'Equipment with no maintenance task', link: '#/p/' + key + '/tasks', count: 2 }], canGoLive: true, whyNot: '' };
    },
    coverage(key) { return { alerts: (S.alerts[key] || []).map((a, i) => ({ alertId: a.id, firesPerDay: 0.4 + i * 0.7, falseAlarmShare: 0.1, medianCloseH: 5 })), blindSpots: [], gaps: API.checklist(key).gaps, notes: [] }; },
    overrides(o) { return S.overrides.filter((x) => !o || !o.plant || x.plant === o.plant); },
    activity(o) { return S.activity.filter((r) => !o || !o.plant || r.plant === o.plant); },
    log(plant, text, kind) { S.activity.push({ at: S.now, plant, who: 'Satyadev Singh', text, kind }); },
    libTypes() { return (W.CATALOGUE || []).map((c) => ({ code: c.code, type: c.type, plants: c.type === 'Open Skeleton Tank' || c.type === 'Blower' ? 3 : 0 })); },
    libType(code) { return (W.CATALOGUE || []).find((c) => c.code === code) || null; },
    libDraft(code) { return S.drafts[code] || null; },
  };
  W.V7 = API;
}());
