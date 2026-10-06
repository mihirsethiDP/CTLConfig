/* CloseTheLoop · Configuration — proposal prototype, v3 (from-scratch builder).
   Core: state, helpers, derived facts, router, shell, guide panel, states, export.
   Views live in views.js, sheets in sheets.js. Everything is in memory. */
window.CTL = (function () {
  'use strict';
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const S = {
    d: null, mode: 'sample', persona: 'tech', model: false, guide: true, sheet: null,
    node: 'plant', treeFilter: '', openSec: null, skipped: new Set(), visited: new Set(), failNext: false, loadedRoutes: new Set(),
    plants: {}, plant: null, lib: null, scada: null, scadaSel: null, op: {}, flowQ: '', flowUse: 'all',
  };
  try { const g = localStorage.getItem('ctl.guide'); if (g !== null) S.guide = g === '1'; } catch (e) { /* private mode */ }

  /* ── helpers ─────────────────────────────────────────────────── */
  const $ = (q, r = document) => r.querySelector(q);
  const $$ = (q, r = document) => Array.from(r.querySelectorAll(q));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 7);
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : (ws || w + 's')}`;
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
  const SEVS = ['caution', 'minor', 'major', 'emergency'];
  const SEV_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const SEV_CLOCK = { emergency: [1, 4], major: [8, 24], minor: [24, 72], caution: [null, null] };
  const TIER_LABEL = { A: 'Critical', B: 'Essential', C: 'Standard' };
  const TIER_SHARE = { A: 0.10, B: 0.20, C: 0.30 };
  const ROLE_LABEL = { l1: 'Operator', l3: 'Lead', l4: 'Senior Lead', regular: 'Client viewer' };
  const GRANT_LABEL = { people: 'People Admin', tech: 'Technical Admin', fullsite: 'Full Site Admin', global: 'Global Admin' };
  const WT_LABEL = { routine: 'Routine check', pm: 'Preventive maintenance', calibration: 'Calibration', condition: 'Condition-based work' };
  const PERSONA = {
    tech: { label: 'Technical Admin', who: 'Swadesh Singh', can: { equipment: true, flows: true, people: false, site: false, standards: false } },
    people: { label: 'People Admin', who: 'Kishore Reddy', can: { equipment: false, flows: false, people: true, site: true, standards: false } },
    lead: { label: 'Lead (L3)', who: 'Kishore Reddy', can: { equipment: false, flows: false, people: false, site: false, standards: false } },
    global: { label: 'Global Admin', who: 'Satyadev Singh', can: { equipment: true, flows: true, people: true, site: true, standards: true } },
  };
  const can = (k) => PERSONA[S.persona].can[k];

  const D = () => S.d;
  const eq = (id) => D().equipment.find((e) => e.id === id);
  const stage = (id) => D().stages.find((s) => s.id === id);
  const group = (id) => D().groups.find((g) => g.id === id);
  const sensor = (id) => D().sensors.find((s) => s.id === id);
  const flow = (id) => D().flows.find((f) => f.id === id);
  const cause = (id) => D().causes.find((c) => c.id === id);
  const alertById = (id) => D().alerts.find((a) => a.id === id);
  /* Flows are written for a TYPE (or a unit process, or the plant); a record on a subject picks the ones that fit. */
  const flowTypes = (f) => f.forTypes || (f.forType ? [f.forType] : []);
  const flowFits = (f, sub) => { if (!sub) return false; if (sub.kind === 'eq') { const e = eq(sub.id); return !!e && flowTypes(f).includes(e.type); } if (sub.kind === 'stage') { const st = stage(sub.id); return !!st && !!st.profile && f.forStage === st.profile; } if (sub.kind === 'group') { const g = group(sub.id); return !!g && g.members.some((m) => flowTypes(f).includes(eq(m).type)); } return f.forStage === 'plant'; };
  const flowScope = (f) => { const t = flowTypes(f); const parts = t.slice(); if (f.forStage === 'plant') parts.push('the whole plant'); else if (f.forStage) { const p = window.UP_PROFILES.find((x) => x.id === f.forStage); if (p) parts.push(p.name + ' (unit process)'); } return parts.join(' · ') || 'any machine'; };
  const diagFor = (a) => { const s = sensor(a.sensor); const home = s ? sensorHome(s) : null; const fits = D().flows.filter((f) => f.kind === 'diagnostic' && f.status === 'published' && (flowFits(f, a.subject) || (a.subject.kind !== 'eq' && home && flowTypes(f).includes(home.type)))); if (!fits.length) return null; const sn = s ? s.name.toLowerCase() : ''; const score = (f) => (sn && f.name.toLowerCase().includes(sn) ? 2 : 0) + (f.steps.some((st) => st.sensorKind && s && st.sensorKind === s.name) ? 1 : 0); return fits.slice().sort((x, y) => score(y) - score(x))[0]; };
  const causeTypes = (c) => c.types || (c.type ? [c.type] : []);
  /* The cause picker, narrowest band first (PRD §7.4): the machine's type, then its unit process, then any-stage causes. */
  const causesFor = (sub) => { const d = D(); const list = d.causes.filter((c) => !c.sensorFault && !c.noFault); if (!sub) return list; const e = sub.kind === 'eq' ? eq(sub.id) : null; const st = sub.kind === 'eq' ? stage(e.stage) : sub.kind === 'stage' ? stage(sub.id) : null; const prof = st ? st.profile : null; const band = (c) => (e && causeTypes(c).includes(e.type)) ? 0 : (prof && c.stage === prof && (!e || !causeTypes(c).length)) ? 1 : c.anyStage ? 2 : (prof && c.stage === prof) ? 1 : 3; return list.map((c) => ({ c, b: band(c) })).filter((x) => x.b < 3 || sub.kind === 'plant').sort((x, y) => x.b - y.b).map((x) => x.c); };
  const schedById = (id) => D().schedules.find((s) => s.id === id);
  const workById = (id) => D().conditionWork.find((w) => w.id === id);
  const catalogue = (type) => window.CATALOGUE.find((c) => c.type === type);
  const subjectName = (sub) => sub.kind === 'plant' ? (D().plant.name || 'the plant') : sub.kind === 'stage' ? stage(sub.id).name : sub.kind === 'group' ? group(sub.id).name : eq(sub.id).name;
  const subjectTier = (sub) => sub.kind === 'eq' ? eq(sub.id).tier : 'B';
  const subjectKey = (sub) => sub.kind === 'plant' ? 'plant' : `${sub.kind}:${sub.id}`;
  const parseNode = (key) => key === 'plant' ? { kind: 'plant' } : { kind: key.split(':')[0], id: key.split(':')[1] };
  const sensorHome = (s) => eq(s.on.slice(3));
  const sensorsOf = (sub) => sub.kind === 'eq' ? D().sensors.filter((s) => s.on === 'eq:' + sub.id)
    : sub.kind === 'group' ? D().sensors.filter((s) => group(sub.id).members.includes(s.on.slice(3)))
    : sub.kind === 'stage' ? D().sensors.filter((s) => sensorHome(s).stage === sub.id) : D().sensors.slice();
  const limitsOfAlert = (a) => { const s = sensor(a.sensor); return { lim: a.limits === 'custom' ? a.custom : (s.limits || {}), dir: a.limits === 'custom' ? a.direction : (s.direction || 'below'), s }; };
  const entrySeverity = (lim) => SEVS.find((k) => lim && lim[k] != null) || null;
  const deepestSeverity = (lim) => SEVS.slice().reverse().find((k) => lim && lim[k] != null) || null;
  const limitsText = (lim, dir, unit) => SEVS.filter((k) => lim && lim[k] != null).map((k) => `${SEV_LABEL[k]} ${dir === 'below' ? '<' : '>'} ${lim[k]}${unit ? ' ' + unit : ''}`).join(' · ');
  const fmtLimits = (lim, dir, unit) => { const p = SEVS.filter((k) => lim && lim[k] != null).map((k) => `<span class="l ${k}">${SEV_LABEL[k]} ${dir === 'below' ? '<' : '>'} ${lim[k]}${unit ? ' ' + unit : ''}</span>`); return p.length ? `<span class="limits">${p.join('')}</span>` : '<span class="limits"><span class="none">no limits yet</span></span>'; };
  const every = (sch) => { const mh = sch.meter ? sch.meter.hours : sch.meterHours; const cal = `every ${sch.every.n === 1 ? '' : sch.every.n + ' '}${sch.every.unit}${sch.every.n > 1 ? 's' : ''}`; if (sch.basis === 'meter') return `every ${mh} run-hours`; if (sch.basis === 'either') return `${cal} or ${mh} run-hours`; return cal; };
  const closeDefault = (s, dir, entry) => { if (!s || s.kind === 'status' || entry == null) return entry; const step = (s.valid[1] - s.valid[0]) * 0.05; const raw = dir === 'below' ? entry + step : entry - step; const p = step < 0.1 ? 1000 : step < 1 ? 100 : step < 10 ? 10 : 1; return Math.round(raw * p) / p; };
  const intervalHours = (sch) => sch.every.n * ({ day: 24, week: 168, month: 720, year: 8760 }[sch.every.unit] || 24);
  const taskClocks = (sch, tier) => { if (sch.statutory) return { deadline: 0, start: 0 }; const h = intervalHours(sch); const deadline = sch.tolerance != null ? sch.tolerance * 24 : Math.max(2, h * TIER_SHARE[tier]); return { deadline, start: Math.max(1, deadline / 2) }; };
  const fmtH = (h) => h == null ? '—' : h === 0 ? 'at once' : h >= 48 ? `${Math.round(h / 24 * 10) / 10} days` : h >= 24 ? `${Math.round(h / 24 * 10) / 10} day` : `${Math.round(h * 10) / 10} h`;
  const suggestedLimits = (s) => { for (const t of D().standardSets) { const a = t.alerts.find((x) => x.sensorKind === s.name); if (a) return { lim: { caution: a.limits.caution ?? null, minor: a.limits.minor ?? null, major: a.limits.major ?? null, emergency: a.limits.emergency ?? null }, dir: a.direction, from: t.usedAt }; } return null; };
  const nextTag = (prefix) => { const n = D().equipment.filter((e) => e.tag.startsWith(prefix + '-')).length + 1; return `${prefix}-${n}`; };

  /* roster → who is told (Notifications Brief §4) */
  const people = () => D().people;
  const byRole = (r) => people().filter((p) => p.role === r);
  const ops = () => byRole('l1'), leads = () => byRole('l3'), seniors = () => byRole('l4');
  const seniorOrLeads = () => seniors().length ? seniors() : leads();
  const siteAdmins = () => people().filter((p) => p.grant === 'people' || p.grant === 'fullsite');
  const first = (list) => list.map((p) => p.name.split(' ')[0]).join(', ') || 'nobody';
  const roleWord = (list, w) => list.length ? `${list.length === 1 ? 'the ' + w : plural(list.length, w)} (${first(list)})` : `no ${w}`;
  function issueLadder(sev, clocks) {
    const [resp, dead] = clocks || SEV_CLOCK[sev];
    const O = roleWord(ops(), 'Operator'), L = roleWord(leads(), 'Lead'), SL = seniors().length ? roleWord(seniors(), 'Senior Lead') : L + ' again';
    if (sev === 'emergency') return [['Now', `everyone at the plant — phone call, hooter, full-screen alarm`], [`Not started in ${fmtH(resp)}`, `${L} and ${roleWord(seniors(), 'Senior Lead')} again`], [`Not fixed in ${fmtH(dead)}`, `everyone again · Site Admin by email`]];
    if (sev === 'major') return [['Now', `${O} and ${L} — WhatsApp and full-screen alarm`], [`Not started in ${fmtH(resp)}`, L], [`Not fixed in ${fmtH(dead)}`, `${SL} · Site Admin and client by email`]];
    if (sev === 'minor') return [['Now', `${O} — WhatsApp · ${L} in the app`], [`Not started in ${fmtH(resp)}`, L], [`Not fixed in ${fmtH(dead)}`, `${SL} · Site Admin and client by email`]];
    return [['Now', `${O} and ${L} — in the app and the morning email`], ['Later', 'nothing more. Caution never reminds.']];
  }
  const ladderSummary = (sev, clocks) => { const l = issueLadder(sev, clocks); return sev === 'caution' ? 'In the app only, never reminds' : `${cap(l[0][1].split(' — ')[0])} now · ${l[1][0].toLowerCase()}: ${l[1][1].split(' (')[0]}`; };
  function taskLadder(sch, tier) { const c = taskClocks(sch, tier); const loud = tier === 'A' || sch.statutory; const O = roleWord(ops(), 'Operator'), L = roleWord(leads(), 'Lead'); return [['When due', `${O} — in the app and the morning email`], [`Not started in ${fmtH(c.start)}`, loud ? `${O} — WhatsApp` : `${O} — in the app`], [`Overdue after ${fmtH(c.deadline)}`, `${O} and ${L} — WhatsApp${loud ? ' · ' + roleWord(seniors(), 'Senior Lead') : ''}`], ['Twice overdue', `everyone · Site Admin by email`]]; }
  const toldBlock = (rows) => `<div class="told">${rows.map(([w, p]) => `<div class="r"><div class="w">${esc(w)}</div><div class="p">${esc(p)}</div></div>`).join('')}</div>`;

  /* readiness: the nine builder steps */
  const STEP_IDS = ['scada', 'people', 'detect', 'inherit', 'alerts', 'escalation', 'maintenance', 'flows', 'review'];
  const STEP_TITLE = { scada: 'Connect SCADA', people: 'People who can be reached', detect: 'What SCADA found', inherit: 'Inherit from the library', alerts: 'Limits and alerts', escalation: 'Escalation and overrides', maintenance: 'Maintenance and tasks', flows: 'Workflows', review: 'Review and go live' };

  /* ── SCADA → plant: import, detect, inherit ──────────────────────────────── */
  const detectProfile = (zoneName) => { const z = zoneName.toLowerCase(); return window.UP_PROFILES.find((p) => p.keywords.some((k) => z.includes(k))) || null; };
  const profileForType = (type) => window.UP_PROFILES.find((p) => p.expectsTypes.includes(type)) || null;
  const profileById = (id) => id ? window.UP_PROFILES.find((p) => p.id === id) || null : null;
  const palette = (code) => window.SCADA_PALETTE.find((p) => p.code === code) || null;
  const scadaKind = (code) => (window.SCADA_KIND[code]) || 'equipment';
  const fmtTime = (iso) => { const t = new Date(iso); return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
  function importScada(key) {
    const sc = clone(window.SCADA_SAMPLES[key]); S.scada = { key, model: sc, syncedAt: new Date().toISOString(), skipped: [], staged: false, applied: false };
    const d = D(); d.plant = { id: key, name: sc.name, code: `DP-SITE-${key === 'manesar' ? '014' : '021'}`, type: sc.type, capacity: sc.capacity, quietHours: { from: '22:00', to: '06:00', on: true }, hooter: { on: true, seconds: 60 }, modules: d.plant.modules, scada: true };
    d.stages = sc.zones.map((z) => ({ id: z.id, name: z.name, scadaZone: z.name, profile: null }));
    d.groups = []; d.equipment = []; d.sensors = []; d.alerts = []; d.schedules = []; d.conditionWork = []; d.milestones = []; d.cycles = []; d.audit = [];
    sc.equipment.forEach((se) => addScadaEquipment(se, false));
    d.stages.forEach((st) => { let p = detectProfile(st.scadaZone); if (!p) { const t = d.equipment.find((e) => e.stage === st.id && profileForType(e.type)); p = t ? profileForType(t.type) : null; } st.profile = p ? p.id : null; const dup = p && d.stages.some((o) => o !== st && o.profile === p.id); st.name = p ? (dup ? `${p.name} · ${st.scadaZone}` : p.name) : st.scadaZone; st.detectedBy = p ? (detectProfile(st.scadaZone) ? 'name' : 'types') : null; });
    detectGroups(); S.node = 'plant'; S.scadaSel = null;
    audit(`Connected SCADA for ${sc.name}`, `${sc.zones.length} zones · ${d.equipment.length} machines · ${d.sensors.length} sensors · ${S.scada.skipped.length} parts and devices left in SCADA`);
  }
  function addScadaEquipment(se, log) {
    const d = D(); const kind = scadaKind(se.scadaType); const pal = palette(se.scadaType);
    if (kind !== 'equipment') { S.scada.skipped.push({ id: se.id, tag: se.tag, label: se.label, code: se.scadaType, kind, zone: se.zone }); return null; }
    const type = window.SCADA_TYPE_MAP[se.scadaType] || null; const cat = type ? catalogue(type) : null;
    const e = { id: se.id, name: se.label, tag: se.tag, stage: se.zone, type: type || `${pal ? pal.name : se.scadaType} (not in the library)`, scadaType: se.scadaType, unmapped: !type, archetype: cat ? cat.archetype : 'unknown', tier: cat ? cat.tier : 'B', status: 'running', expects: cat ? cat.expects.slice() : [], cycles: !!(cat && cat.cycles) };
    if (cat && cat.sensors.some((s) => s.kind === 'meter') && se.sensors.some((s) => s.tag === 'HRS')) e.meter = `${se.id}_HRS`;
    d.equipment.push(e);
    se.sensors.forEach((ss) => { const nm = window.SCADA_SENSOR_MAP[ss.tag] || ss.tag; const def = cat && cat.sensors.find((x) => x.name === nm); d.sensors.push({ id: `${se.id}_${ss.tag}`, name: nm, tag: `${ss.tag}-${se.tag}`, scadaTag: ss.tag, widget: ss.widget, unit: def ? def.unit : '', on: 'eq:' + se.id, kind: def ? def.kind : (ss.widget === 'SWITCH_SENSOR' ? 'status' : 'process'), expr: def ? def.expr : undefined, valid: def ? def.valid.slice() : (ss.widget === 'SWITCH_SENSOR' ? [0, 1] : [0, 1000]), reading: ss.reading, state: 'live', direction: def ? def.direction : 'above', limits: null, fromScada: true }); });
    if (e.status === 'running' && se.sensors.some((s) => (s.tag === 'AMP' || s.tag === 'PRESS') && s.reading === 0)) e.status = 'stopped';
    if (log) audit(`SCADA added ${e.name} (${e.tag})`, `${type || 'type not in the library yet'} · ${se.sensors.length} sensors`);
    return e;
  }
  /* Resolve a machine's library type: once per SCADA code, for every plant. */
  function mapType(e, type) {
    const d = D(); const cat = catalogue(type); if (!cat) return; const was = e.type;
    e.type = type; e.unmapped = false; e.archetype = cat.archetype; if (!e.tierReason) e.tier = cat.tier; e.expects = cat.expects.slice(); e.cycles = !!cat.cycles;
    d.sensors.filter((s) => s.on === 'eq:' + e.id).forEach((s) => { const def = cat.sensors.find((x) => x.name === s.name); if (def && s.fromScada) { s.unit = def.unit; s.kind = def.kind; s.valid = def.valid.slice(); if (!s.limits) s.direction = def.direction; } });
    if (cat.sensors.some((s) => s.kind === 'meter') && d.sensors.some((s) => s.on === 'eq:' + e.id && s.name === 'Run hours')) e.meter = `${e.id}_HRS`;
    if (e.scadaType) { window.SCADA_TYPE_MAP[e.scadaType] = type; const p = palette(e.scadaType); if (p) p.type = type; else window.SCADA_PALETTE.push({ code: e.scadaType, name: e.scadaType, kind: 'equipment', type }); }
    let also = 0; d.equipment.filter((x) => x.id !== e.id && x.unmapped && x.scadaType === e.scadaType).forEach((x) => { mapType(x, type); also++; });
    d.stages.forEach((st) => { if (!st.profile) { const t = d.equipment.find((x) => x.stage === st.id && profileForType(x.type)); if (t) { const p = profileForType(t.type); st.profile = p.id; st.name = p.name; st.detectedBy = 'types'; } } });
    detectGroups(); return { was, also };
  }
  function leaveInScada(e) { const d = D(); d.equipment = d.equipment.filter((x) => x.id !== e.id); d.sensors = d.sensors.filter((s) => s.on !== 'eq:' + e.id); d.alerts = d.alerts.filter((a) => !!sensor(a.sensor)); d.schedules = d.schedules.filter((s) => !(s.subject.kind === 'eq' && s.subject.id === e.id)); d.conditionWork = d.conditionWork.filter((w) => w.subject.id !== e.id); if (S.scada) S.scada.skipped.push({ id: e.id, tag: e.tag, label: e.name, code: e.scadaType, kind: 'ignored', zone: e.stage }); detectGroups(); }
  function detectGroups() {
    const d = D(); const old = d.groups.slice(); d.groups = [];
    d.stages.forEach((st) => { const prof = profileById(st.profile); if (!prof) return; prof.groups.forEach((gr) => { const members = d.equipment.filter((e) => e.stage === st.id && e.type === gr.type); members.forEach((e) => { delete e.duty; delete e.standbyOf; delete e.group; }); const rule = (prof.criticality || []).find((c) => c.type === gr.type); if (members.length >= 2 && !members.some((m) => m.noGroup)) { const prev = old.find((g) => g.stage === st.id && g.members.some((m) => members.some((x) => x.id === m))); const g = { id: prev ? prev.id : `g_${st.id}_${gr.type.replace(/\W+/g, '')}`, name: prev ? prev.name : gr.name, stage: st.id, members: members.map((m) => m.id), note: 'Detected from SCADA: same type, same zone, shared header' }; d.groups.push(g); members.forEach((m, i) => { m.group = g.id; m.duty = i === 0 ? 'lead' : 'standby'; if (i > 0) m.standbyOf = members[0].id; if (rule && !m.tierReason) m.tier = i === 0 ? rule.soleUnit : rule.withStandby; }); } else if (rule) members.forEach((m) => { if (!m.tierReason) m.tier = rule.soleUnit; }); }); });
  }
  /* The demo stands in for an engineer drawing something new in SCADA; "Read SCADA again" brings it in. */
  function stageDelta() { if (!S.scada || S.scada.applied) return null; S.scada.staged = true; return window.SCADA_DELTAS[S.scada.key]; }
  function applyDelta() {
    if (!S.scada) return []; S.scada.syncedAt = new Date().toISOString(); if (!S.scada.staged) return [];
    const delta = window.SCADA_DELTAS[S.scada.key]; const added = [];
    delta.equipment.forEach((se) => { if (eq(se.id)) return; S.scada.model.equipment.push(clone(se)); const e = addScadaEquipment(se, true); if (e) added.push(e); });
    delta.links.forEach((l) => { if (!S.scada.model.links.some((x) => x[0] === l[0] && x[1] === l[1])) S.scada.model.links.push(l); });
    detectGroups(); S.scada.staged = false; S.scada.applied = true; return added;
  }
  const inheritance = (e) => { const t = D().standardSets.find((x) => x.type === e.type); const sens = sensorsOf({ kind: 'eq', id: e.id }); return t ? { set: t, alerts: t.alerts.map((a) => ({ ...a, ok: !!sens.find((s) => s.name === a.sensorKind) })), schedules: t.schedules.map((s) => ({ ...s, ok: s.workType !== 'condition' || !!sens.find((x) => x.name === s.sensorKind) })) } : null; };
  function inheritEquipment(e, opts) {
    const d = D(), inh = inheritance(e); if (!inh) return { active: 0, draft: 0, why: ['no library entry for this type'] };
    const sens = sensorsOf({ kind: 'eq', id: e.id }); let active = 0, draft = 0; const why = [];
    if (!(opts && opts.only === 'schedules')) inh.alerts.forEach((ta) => { const s = sens.find((x) => x.name === ta.sensorKind); if (!s) { why.push(`${ta.name}: needs a ${ta.sensorKind} sensor`); return; } if (d.alerts.some((a) => a.sensor === s.id)) return; const has = s.limits && SEVS.some((k) => s.limits[k] != null); const lim = has ? s.limits : { caution: ta.limits.caution ?? null, minor: ta.limits.minor ?? null, major: ta.limits.major ?? null, emergency: ta.limits.emergency ?? null }; if (!has) { s.limits = { ...lim }; s.direction = ta.direction; s.source = 'library'; } const entry = entrySeverity(lim); const subject = ta.scope === 'unitProcess' ? { kind: 'stage', id: e.stage } : { kind: 'eq', id: e.id }; d.alerts.push({ id: uid('a'), name: `${ta.name} — ${ta.scope === 'unitProcess' ? stage(e.stage).name : e.tag}`, subject, sensor: s.id, limits: 'sensor', holdMin: lim.emergency != null ? 0 : 5, closes: s.kind === 'status' ? { mode: 'operator' } : { mode: 'sensor', back: closeDefault(s, ta.direction, lim[entry]), holdMin: 10 }, flow: ta.flow && flow(ta.flow) ? ta.flow : null, cause: ta.cause || null, verify: lim.emergency != null, status: entry ? 'active' : 'draft', open: 0, source: 'library', template: inh.set.id }); if (entry) active++; else { draft++; why.push(`${ta.name}: no limits`); } });
    if (!(opts && opts.only === 'alerts')) inh.schedules.forEach((ts) => { if (d.schedules.some((s) => s.subject.id === e.id && s.name === ts.name) || d.conditionWork.some((w) => w.subject.id === e.id && w.name === ts.name)) return; if (ts.workType === 'condition') { const s = sens.find((x) => x.name === ts.sensorKind); if (!s) { why.push(`${ts.name}: needs a ${ts.sensorKind} sensor`); return; } d.conditionWork.push({ id: uid('w'), name: ts.name, subject: { kind: 'eq', id: e.id }, sensor: s.id, doWhen: ts.doWhen, doneWhen: ts.doneWhen, flow: ts.flow && flow(ts.flow) ? ts.flow : null, cause: ts.cause && cause(ts.cause) ? ts.cause : null, escalate: null, status: 'active', open: 0, source: 'library' }); active++; return; } const meter = sens.find((x) => x.kind === 'meter'); d.schedules.push({ id: uid('s'), name: ts.name, subject: { kind: 'eq', id: e.id }, workType: ts.workType, probe: ts.workType === 'calibration' ? (sens.find((x) => x.kind === 'analytical') || {}).id || null : null, flow: ts.flow && flow(ts.flow) ? ts.flow : null, cause: ts.cause && cause(ts.cause) ? ts.cause : null, basis: ts.meterHours && meter ? 'either' : 'calendar', every: { ...ts.every }, meter: ts.meterHours && meter ? { tag: meter.id, hours: ts.meterHours, last: meter.reading } : null, anchor: ts.workType === 'pm' ? 'last' : 'fixed', nextDue: '2026-11-02', performedBy: 'in_house', statutory: false, verify: ts.workType === 'pm', status: 'active', open: 0, source: 'library', template: inh.set.id, hours: ts.hours || null, parts: ts.parts || '' }); active++; });
    if (!(opts && opts.only === 'alerts')) sens.filter((s) => s.kind === 'analytical' && !d.schedules.some((x) => x.workType === 'calibration' && x.probe === s.id)).forEach((s) => { const cf = (window.CAL_FLOWS || {})[s.name] || window.CAL_FLOW_DEFAULT; d.schedules.push({ id: uid('s'), name: `${s.name} calibration`, subject: { kind: 'eq', id: e.id }, workType: 'calibration', probe: s.id, flow: cf && flow(cf) ? cf : null, cause: 'c_probe', basis: 'calendar', every: { n: 1, unit: 'month' }, anchor: 'fixed', nextDue: '2026-11-02', hours: 1, performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 0, source: 'library' }); active++; });
    return { active, draft, why };
  }
  function inheritUnitProcess(st) { const d = D(), prof = st.profile && window.UP_PROFILES.find((p) => p.id === st.profile); if (!prof) return 0; let n = 0; prof.rounds.forEach((r) => { if (d.schedules.some((s) => s.subject.kind === 'stage' && s.subject.id === st.id && s.name === r.name)) return; d.schedules.push({ id: uid('s'), name: r.name, subject: { kind: 'stage', id: st.id }, workType: 'routine', probe: null, flow: r.flow && flow(r.flow) ? r.flow : null, basis: 'calendar', every: { ...r.every }, meter: null, anchor: 'fixed', nextDue: '2026-10-06', performedBy: 'in_house', statutory: false, verify: false, status: 'active', open: 0, source: 'library', hours: r.hours || null }); n++; }); return n; }
  function inheritPlant() { const d = D(), prof = window.PLANT_PROFILES[d.plant.type] || window.PLANT_PROFILES.STP; let n = 0; prof.rounds.forEach((r) => { if (d.schedules.some((s) => s.subject.kind === 'plant' && s.name === r.name)) return; d.schedules.push({ id: uid('s'), name: r.name, subject: { kind: 'plant' }, workType: r.workType, probe: null, flow: r.flow && flow(r.flow) ? r.flow : null, basis: 'calendar', every: { ...r.every }, meter: null, anchor: 'fixed', nextDue: '2026-10-06', performedBy: 'in_house', statutory: !!r.statutory, verify: !!r.verify, status: 'active', open: 0, source: 'library', hours: r.hours || null, parts: r.parts || '' }); n++; }); prof.milestones.forEach((m) => { if (d.milestones.some((x) => x.name === m)) return; d.milestones.push({ id: uid('m'), name: m, on: null, status: 'active', count: 0, source: 'library' }); n++; }); return n; }
  const plantProfile = () => window.PLANT_PROFILES[D().plant.type] || window.PLANT_PROFILES.STP;
  const plantRoundDone = (r) => D().schedules.some((s) => s.subject.kind === 'plant' && s.name === r.name);
  const upRoundDone = (st, r) => D().schedules.some((s) => s.subject.kind === 'stage' && s.subject.id === st.id && s.name === r.name);
  /* What a machine still has to inherit, item by item, with the reason when it cannot. */
  const eqInheritItems = (e) => { const d = D(), inh = inheritance(e); if (!inh) return null; const sens = sensorsOf({ kind: 'eq', id: e.id }); const items = [];
    inh.alerts.forEach((a) => { const done = d.alerts.some((x) => sensorHome(sensor(x.sensor)).id === e.id && sensor(x.sensor).name === a.sensorKind); items.push({ kind: 'alert', name: a.name, done, ok: a.ok, why: a.ok ? '' : `needs a ${a.sensorKind} reading from SCADA` }); });
    inh.schedules.forEach((s) => { const done = d.schedules.some((x) => x.subject.id === e.id && x.name === s.name) || d.conditionWork.some((w) => w.subject.id === e.id && w.name === s.name); items.push({ kind: s.workType === 'condition' ? 'work' : 'schedule', name: s.name, done, ok: s.ok, why: s.ok ? '' : `needs a ${s.sensorKind} reading from SCADA` }); });
    sens.filter((s) => s.kind === 'analytical').forEach((s) => { const done = d.schedules.some((x) => x.workType === 'calibration' && x.probe === s.id); items.push({ kind: 'schedule', name: `${s.name} calibration`, done, ok: true, why: '' }); });
    return { set: inh.set, items, pending: items.filter((i) => i.ok && !i.done).length, blocked: items.filter((i) => !i.ok).length }; };
  const inheritStatus = () => { const d = D(); const prof = plantProfile(); const plantPending = d.plant.name ? prof.rounds.filter((r) => !plantRoundDone(r)).length + prof.milestones.filter((m) => !d.milestones.some((x) => x.name === m)).length : 0; const upPending = d.stages.filter((st) => { const p = profileById(st.profile); return p && p.rounds.some((r) => !upRoundDone(st, r)); }).length; const eqPending = d.equipment.filter((e) => { const it = eqInheritItems(e); return it && it.pending > 0; }); return { plantPending, upPending, eqPending }; };
  const customCount = () => { const d = D(); return d.alerts.filter((a) => a.source === 'custom').length + d.schedules.filter((s) => s.source === 'custom').length + d.conditionWork.filter((w) => w.source === 'custom').length + d.sensors.filter((s) => s.source === 'custom').length; };
  /* A library edit reaches every following item at this plant; Custom ones are left alone. */
  function propagateSet(t) { const d = D(); let sensors = 0, schedules = 0, custom = 0; const eqs = d.equipment.filter((e) => e.type === t.type);
    eqs.forEach((e) => { t.alerts.forEach((ta) => { const s = d.sensors.find((x) => x.on === 'eq:' + e.id && x.name === ta.sensorKind); if (!s) return; if (s.source === 'custom') { custom++; return; } if (d.alerts.some((a) => a.sensor === s.id) || s.source === 'library') { s.limits = { caution: ta.limits.caution ?? null, minor: ta.limits.minor ?? null, major: ta.limits.major ?? null, emergency: ta.limits.emergency ?? null }; s.direction = ta.direction; s.source = 'library'; sensors++; } });
      t.schedules.forEach((ts) => { if (ts.workType === 'condition') { const w = d.conditionWork.find((x) => x.subject.id === e.id && x.name === ts.name); if (!w) return; if (w.source === 'custom') { custom++; return; } w.doWhen = ts.doWhen; w.doneWhen = ts.doneWhen; schedules++; return; } const sc = d.schedules.find((x) => x.subject.id === e.id && x.name === ts.name); if (!sc) return; if (sc.source === 'custom') { custom++; return; } sc.every = { ...ts.every }; if (sc.meter && ts.meterHours) sc.meter.hours = ts.meterHours; schedules++; }); });
    return { plants: eqs.length ? 1 : 0, sensors, schedules, custom }; }
  function gaps() {
    const d = D();
    const isProcess = (s) => s.kind !== 'meter' && s.kind !== 'status';
    const sensorsNoLimits = d.sensors.filter((s) => isProcess(s) && !(s.limits && SEVS.some((k) => s.limits[k] != null)));
    const hasProgramme = (e) => d.schedules.some((s) => s.subject.kind === 'eq' && s.subject.id === e.id && s.workType !== 'calibration') || d.conditionWork.some((w) => w.subject.id === e.id);
    const eqNeedingPM = d.equipment.filter((e) => e.expects.length && !hasProgramme(e));
    const probesNoCal = d.sensors.filter((s) => s.kind === 'analytical' && !d.schedules.some((x) => x.workType === 'calibration' && x.probe === s.id));
    const eqNoAlerts = d.equipment.filter((e) => { const inh = inheritance(e); return inh && inh.alerts.some((a) => a.ok) && !d.alerts.some((a) => sensorHome(sensor(a.sensor)).id === e.id); });
    const causesNoFix = d.causes.filter((c) => !c.fix && !c.sensorFault && !c.noFault);
    const alertsNoFlow = d.alerts.filter((a) => !a.flow && !a.cause && !!diagFor(a));
    const drafts = [...d.alerts.filter((a) => a.status === 'draft'), ...d.schedules.filter((s) => s.status === 'draft'), ...d.conditionWork.filter((w) => w.status === 'draft')];
    const reachOps = ops().filter((p) => p.phone.verified), reachLeads = leads().filter((p) => p.phone.verified);
    const majorNow = ops().some((p) => p.major === 'now') && leads().some((p) => p.major === 'now');
    const routingOk = reachOps.length > 0 && reachLeads.length > 0 && majorNow;
    const routingWhy = !ops().length ? 'No Operator on the roster yet.' : !leads().length ? 'No Lead on the roster yet.' : !reachOps.length ? 'No Operator has a verified phone.' : !reachLeads.length ? 'No Lead has a verified phone.' : !majorNow ? 'Nobody at the plant has Major set to Now.' : '';
    const plantOk = !!(d.plant.name && d.stages.length);
    const eqNoSensors = d.equipment.filter((e) => !d.sensors.some((s) => s.on === 'eq:' + e.id));
    const unmapped = d.equipment.filter((e) => e.unmapped); const stagesUnmapped = d.stages.filter((s) => s.scadaZone && !s.profile);
    const inh = plantOk ? inheritStatus() : { plantPending: 0, upPending: 0, eqPending: [] };
    const inheritPending = inh.plantPending + inh.upPending + inh.eqPending.length;
    const steps = [
      { id: 'scada', done: plantOk && !!S.scada, count: plantOk && S.scada ? 0 : 1 },
      { id: 'people', done: routingOk, count: routingOk ? 0 : 1 },
      { id: 'detect', done: plantOk && !unmapped.length && !stagesUnmapped.length && S.visited.has('detect'), count: unmapped.length + stagesUnmapped.length || (plantOk && S.visited.has('detect') ? 0 : 1) },
      { id: 'inherit', done: plantOk && !inheritPending && S.visited.has('inherit'), count: inheritPending || (plantOk && S.visited.has('inherit') ? 0 : 1) },
      { id: 'alerts', done: d.sensors.length > 0 && !sensorsNoLimits.length, count: sensorsNoLimits.length || (d.sensors.length ? 0 : 1) },
      { id: 'escalation', done: S.visited.has('escalation') && routingOk, count: S.visited.has('escalation') ? 0 : 1 },
      { id: 'maintenance', done: d.equipment.length > 0 && !eqNeedingPM.length && !probesNoCal.length, count: eqNeedingPM.length + probesNoCal.length || (d.equipment.length ? 0 : 1) },
      { id: 'flows', done: !causesNoFix.length && !alertsNoFlow.length, count: causesNoFix.length + alertsNoFlow.length },
      { id: 'review', done: S.visited.has('review') && !drafts.length && plantOk && routingOk, count: drafts.length || (S.visited.has('review') ? 0 : 1) },
    ].map((st) => ({ ...st, title: STEP_TITLE[st.id], skipped: S.skipped.has(st.id) }));
    const doneCount = steps.filter((s) => s.done || s.skipped).length;
    return { sensorsNoLimits, eqNeedingPM, probesNoCal, eqNoAlerts, eqNoSensors, unmapped, stagesUnmapped, inherit: inh, inheritPending, causesNoFix, alertsNoFlow, drafts, routingOk, routingWhy, reachOps, reachLeads, plantOk, steps, doneCount, allDone: doneCount === steps.length };
  }
  const nodeStatus = (sub) => { const g = gaps(); const eqs = sub.kind === 'eq' ? [eq(sub.id)] : sub.kind === 'group' ? group(sub.id).members.map(eq) : sub.kind === 'stage' ? D().equipment.filter((e) => e.stage === sub.id) : D().equipment; const missing = eqs.some((e) => g.eqNeedingPM.includes(e) || g.eqNoAlerts.includes(e) || g.eqNoSensors.includes(e) || g.sensorsNoLimits.some((s) => s.on === 'eq:' + e.id) || g.probesNoCal.some((s) => s.on === 'eq:' + e.id)); const has = D().alerts.some((a) => eqs.some((e) => subjectKey(a.subject) === 'eq:' + e.id) || subjectKey(a.subject) === subjectKey(sub)) || D().schedules.some((s) => subjectKey(s.subject) === subjectKey(sub) || eqs.some((e) => subjectKey(s.subject) === 'eq:' + e.id)); return missing ? 'gap' : has ? 'ok' : 'none'; };

  /* ── feedback: toast, modal, audit, saving simulation ────────── */
  let toastT;
  function toast(msg, undo) { $('#toast')?.remove(); const el = document.createElement('div'); el.className = 'toast'; el.id = 'toast'; el.innerHTML = `<span>${msg}</span>${undo ? '<span class="u">Undo</span>' : ''}`; if (undo) el.querySelector('.u').onclick = () => { undo(); el.remove(); render(); }; document.body.appendChild(el); clearTimeout(toastT); toastT = setTimeout(() => el.remove(), 6500); }
  function audit(what, detail) { const n = new Date(); const ts = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')} ${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; D().audit.unshift({ ts, who: PERSONA[S.persona].who, what, detail: detail || '' }); }
  function modal(title, body, actions) { $('#modal')?.remove(); const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.innerHTML = `<div class="box"><div class="h">${esc(title)}</div><div class="b">${body}</div><div class="ft">${actions.map((a, i) => `<button class="btn ${a.primary ? 'primary' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`; document.body.appendChild(m); $$('.ft button', m).forEach((b) => b.onclick = () => { const a = actions[+b.dataset.i]; const keep = a.fn && a.fn(m); if (!keep) m.remove(); }); return m; }
  function save(fn) { return new Promise((res, rej) => setTimeout(() => { if (S.failNext) { S.failNext = false; rej(new Error('network')); } else { fn(); res(); } }, 500)); }

  /* ── guide panel ─────────────────────────────────────────────── */
  const GUIDE = {
    'setup': { t: 'Set up a plant', w: 'Nine steps. SCADA hands over the plant (1), you add people (2), the console says what it detected (3) and what the library gives each level (4). Steps 5 to 8 are review; 9 switches it on.', y: 'Nothing is drawn twice. SCADA already knows the machines and how they connect; the library already knows what each kind of machine, unit process and plant needs.', s: 'Steps 5 to 8 can be skipped and come back on the home page.' },
    'setup/scada': { t: 'Step 1 · Connect SCADA', w: 'Pick the plant in SCADA. The console reads its zones, every machine with its SCADA type, every sensor widget, and the pipes and headers between them. Click a machine in the drawing to see what came through.', y: 'The plant is drawn once, in SCADA. This console never asks you to draw it again; it reads it, and reads it again whenever SCADA changes. Valves, motors and DigitalPaani devices stay in the drawing: they belong to a machine, they are not one.', s: 'Cannot be skipped. Nothing exists until SCADA says so.' },
    'setup/people': { t: 'Step 2 · People', w: 'Add the people who work here with one role each. At least one Operator and one Lead must verify a phone.', y: 'Who is told is looked up from this roster the moment something fires. SCADA knows machines, not people, so this is the one thing you add by hand.', s: 'Cannot be skipped. Alerts would reach nobody.' },
    'setup/detect': { t: 'Step 3 · What SCADA found', w: 'Zones became unit processes; SCADA types became library types; parallel machines of one type on one header became duty/standby groups. Anything the library does not recognise asks you once.', y: 'Detection is what turns a drawing into something that can inherit. One wrong type here is one wrong set of alerts, so this is the step to read slowly.', s: 'Cannot be skipped while anything is unmapped; an unmapped machine inherits nothing.' },
    'setup/inherit': { t: 'Step 4 · Inherit from the library', w: 'Three counts say how much is inherited at each level. Then the plant\'s items, the unit processes as one line each, and one machine at a time with what its type gives: ✓ inherited, + offered, – blocked because SCADA has no such reading. Inherit each, or everything at once.', y: 'The library is where the estate\'s experience lives. A plant that follows it gets every improvement; a plant that edits an item keeps its own version, marked Custom.', s: 'Skip and add everything by hand in steps 5, 7 and 8.' },
    'setup/alerts': { t: 'Step 5 · Limits and alerts', w: 'Three counts say how much is watched. Then one machine at a time: its readings with their limits (Use suggested, or set by hand), the alerts on it, and what the library still offers with an Add button. Pick a unit process to see the alerts about it as a whole.', y: 'The limit crossed decides the severity, and severity decides who is told and how loudly. This step is the sensor-based half of escalation; step 6 is the time-based half.', s: 'A reading without limits raises nothing. Skip and it stays quiet until you come back. "Use everything the library suggests" fills every gap in one click.' },
    'setup/escalation': { t: 'Step 6 · Escalation and overrides', w: 'Pick an alert: the timeline shows who is told at open, when nobody starts, when it is not fixed, and what happens if the reading gets worse. The box under it holds everything you may change for that alert. Then the same for a schedule, criticality per machine, and the two site defaults.', y: 'Who sits on each rung is fixed by role so every plant behaves the same. What you can move: the two clocks on an alert, a Lead\'s check, the hold time, on/off, the grace on a schedule, a machine\'s criticality, quiet hours and the hooter.', s: 'Read it once. It is marked done when you have. The defaults are the Notifications Brief\'s.' },
    'setup/maintenance': { t: 'Step 7 · Maintenance and tasks', w: 'Three counts at the top say how complete the programme is. Then one machine at a time: what its type expects, what it has, and what the library still offers, with an Add button. Then the rounds, then one line for everything.', y: 'Reminders and deadlines come from the machine\'s criticality and the cadence; nothing to type. Coverage is a count, never a red card: a missing programme is a planning gap, not a safety failure.', s: 'Skip and the plant still alerts. "Add everything the library suggests" fills every gap in one click.' },
    'setup/flows': { t: 'Step 8 · Workflows', w: 'Three counts say how much runs a flow. Then one machine at a time: what each alert opens, what each schedule runs and the cause it logs against, and what fixes each cause a diagnosis can land on, each as a dropdown that saves as you choose. Flows written for this type come first.', y: 'A diagnosis without a fix tells the operator what is wrong and nothing about what to do. A cause\'s fix is shared by every plant; an alert\'s or schedule\'s flow is this plant\'s.', s: 'Without a flow the operator closes with a photo or note. It works; it teaches nothing. "Attach everything the library suggests" fills the gaps it can.' },
    'setup/review': { t: 'Step 9 · Review and go live', w: 'Three counts, then a checklist in step order: red lines must change before the plant is live, amber ones are gaps it can run with, and each links to its step. Activate the drafts that pass, one or all. Then take the record.', y: 'Nothing fires until it is active. The download is the PRD-shaped record of everything you set, the same document an engineer loads into the real system.', s: '' },
    'equipment': { t: 'Equipment', w: 'Pick a machine, a stage or the plant on the left. Everything about it is on one page, one section open at a time.', y: 'Admins think per machine. Each alert and schedule lives on the thing it is about.', s: 'An amber dot means something is missing on that machine. Grey means nothing is set up yet.' },
    'flows': { t: 'Flows and causes', w: 'A diagnostic flow asks questions until it reaches a cause. An action flow is the numbered steps that do the work: a fix, a service, a round, a calibration. Both are written for a machine type or a unit process and inherited with it.', y: 'Alerts open diagnostic flows. Schedules run action flows and log against the cause the work prevents. A cause names its fix, so a diagnosis always leads somewhere.', s: 'A flow nothing runs is fine while you write it; the list says so. A cause with no fix tells the operator what is wrong and nothing about what to do.' },
    'flows/causes': { t: 'Root causes', w: 'One estate-wide word for each failure, scoped to a unit process and, where it is a machine\'s fault, an equipment type. Never a machine: which machine is decided when someone diagnoses it.', y: 'Thirty plants using one word is what makes "what goes wrong" countable. A cause with a fix turns a diagnosis into instructions.', s: 'A cause nothing reaches is dead vocabulary: harmless, but it still shows in every picker.' },
    'people': { t: 'People & alerts', w: 'Who holds which role, whether they can be reached, and the two site defaults.', y: 'This is the whole routing configuration. There is no chain to draw and no recipients to type.', s: 'Removing the last reachable Operator or Lead is refused.' },
    'activity': { t: 'Activity', w: 'Everything that changed who gets woken up, with before and after.', y: 'Kept 24 months.', s: '' },
    'standards': { t: 'Library', w: 'Three levels: plant types, unit processes, equipment types. Each says what a thing of that kind inherits the moment SCADA adds it.', y: 'Edit here and every plant that follows the entry gets the change; items a plant edited stay Custom and are left alone.', s: '' },
    'library': { t: 'Library', w: 'Three levels: plant types, unit processes, equipment types. Each says what a thing of that kind inherits the moment SCADA adds it.', y: 'Edit here and every plant that follows the entry gets the change; items a plant edited stay Custom and are left alone.', s: '' },
    'operator': { t: 'Operator app', w: 'What the configuration becomes on a phone. Fire an alert or make a task due on the right, advance the clock, and watch who is told. Work a record: start, follow the flow, conclude, fix, close. Open a machine for its card.', y: 'Nothing here is configured; it is all consequence. If the card says the wrong thing, the fix is upstream, in the library or on the machine.', s: '' },
    'estate': { t: 'Estate', w: 'Every plant, how far its setup is, what is open, how much of it follows the library. Switch plants from the top bar.', y: 'The library is one object the whole estate points at. An edit lands on every following plant at once; this page is where you see it land.', s: '' },
    'maintenance': { t: 'Maintenance', w: 'Coverage, compliance counted by due occurrences, the month ahead, vendor contracts, and the warnings the PRD asks for: a cadence nobody meets, a meter that went quiet, a leg that never fires.', y: 'A count against a total, never a green or red card: this answers "is the programme complete", not "will an alert reach a human".', s: '' },
    'sheet/computed': { t: 'Computed reading', w: 'A number made from other readings: recovery from two flows, a ratio, a difference. Tags in braces; the preview uses the readings as they are now.', y: 'A computed reading is an ordinary row on the readings table: limits, alerts and calibration apply to it like any other.', s: '' },
    'sheet/maint': { t: 'Maintenance mode', w: 'Say why, for how long, and which alerts to pause. Alerts are suppressed, not deleted, and resume when the machine is brought back online.', y: 'A machine that is deliberately off must not wake anyone up. The Lead is told, and a tier A machine tells them loudly.', s: '' },
    'sheet/report': { t: 'Report a problem', w: 'What an operator saw, in their words, with a severity. Opens an issue on this machine with no flow; the operator can still name the cause.', y: 'Reporting is never a trigger. It is how the plant learns about what no sensor sees.', s: '' },
    'sheet/libtype': { t: 'Equipment type', w: 'The sensors this type usually has, the alerts and limits it inherits, and the schedules it needs.', y: 'Changing a limit here re-thresholds every following plant\'s sensors of this kind. Custom ones are left alone.', s: '' },
    'sheet/alert/1': { t: 'Which reading?', w: 'Pick the sensor that shows the problem. The name fills itself in.', y: 'One alert watches one reading. Two directions or two sensors are two alerts.', s: '' },
    'sheet/alert/2': { t: 'When is it a problem?', w: 'The sensor\'s own limits are pre-filled. Change them only if this alert should differ from the sensor.', y: 'Each tier you fill in is a step up in who is told and how loudly. Blank tiers are skipped.', s: 'Leave "More options" alone unless a reading flaps or a planned shutdown raises it.' },
    'sheet/alert/3': { t: 'What happens next?', w: 'Say what closes it and what the operator should do.', y: 'A sensor closing it is honest; an operator closing it is honest when no sensor can see the fix. A clock is never honest.', s: 'No flow is fine: the operator gets a simple open → done issue.' },
    'sheet/alert/4': { t: 'Review', w: 'Read the sentence, check who is told, try a reading, then activate.', y: 'Nothing fires until you activate. A draft is safe to leave overnight.', s: '' },
    'sheet/schedule/1': { t: 'What work?', w: 'Routine check, preventive maintenance or calibration, and the steps the operator follows.', y: 'The kind decides the chip on the card and whether it counts toward maintenance coverage.', s: '' },
    'sheet/schedule/2': { t: 'How often?', w: 'A calendar, run-hours, or whichever comes first. From the last completion for wear-out work; fixed dates for rounds and statutory work.', y: 'Reminders come from this cadence and the machine\'s criticality. Nothing to type.', s: '' },
    'sheet/schedule/3': { t: 'Review', w: 'Check how urgent it is and who is told, then activate.', y: 'Planned work is quiet by design and gets louder only as it gets late.', s: '' },
    'sheet/work/1': { t: 'Which reading and job?', w: 'The plant asks for a job when a reading crosses a line: a backwash, a filter clean.', y: 'This is the process working, not failing, so it is a task, not an alert.', s: '' },
    'sheet/work/2': { t: 'When?', w: 'Two numbers: when to do it, and what the sensor reads when it is done.', y: 'The gap between them stops a reading resting on the line from asking on every poll.', s: 'Optionally raise an issue above a worse threshold, for when the job stops keeping up.' },
    'sheet/work/3': { t: 'Review', w: 'Check and activate.', y: '', s: '' },
    'sheet/sensor': { t: 'Sensor limits', w: 'Direction, then a threshold per tier. Blank tiers are skipped.', y: 'Every alert that follows this sensor changes with it. The change is audited.', s: '' },
    'sheet/sensornew': { t: 'Add a sensor', w: 'Name, tag, unit and the range the instrument can physically read.', y: 'Anything outside the valid range is a sensor fault, never an alert.', s: '' },
    'sheet/equipment': { t: 'A machine', w: 'Pick the type first: it fills in the sensors, the archetype and a suggested criticality. Then the tag and, if it has one, its duty partner.', y: 'Criticality sets how early a late task gets loud and how far it reaches. A standby counts one tier lower while its duty unit runs.', s: '' },
    'sheet/standard': { t: 'Standard set', w: 'Untick anything that does not apply here, then add.', y: 'Everything lands bound to this machine and its tags.', s: 'Rows without the sensor they need are disabled with the reason.' },
    'sheet/flow': { t: 'Flow', w: 'Add steps in order. A question routes on its answer; a reading binds to a tag.', y: 'A conclusion names a cause, and the cause names its fix.', s: '' },
    'sheet/cause': { t: 'Cause', w: 'One estate-wide word for one failure, and what fixes it.', y: 'Thirty plants using one word is what makes "what goes wrong" countable.', s: '' },
    'sheet/person': { t: 'Person', w: 'One role, optionally one admin grant. They verify their own phone.', y: 'A role describes the person, not the plant.', s: '' },
  };
  function guideKey() { if (S.sheet) return S.sheet.step && GUIDE[`sheet/${S.sheet.kind}/${S.sheet.step}`] ? `sheet/${S.sheet.kind}/${S.sheet.step}` : `sheet/${S.sheet.kind}`; const r = route(); return (r.view === 'setup' || r.view === 'flows') && r.rest[0] && GUIDE[`${r.view}/${r.rest[0]}`] ? `${r.view}/${r.rest[0]}` : r.view === 'setup' && r.rest[0] ? `setup/${r.rest[0]}` : r.view; }
  function renderGuide() {
    const key = guideKey(); const g = GUIDE[key] || GUIDE[key.split('/')[0]] || GUIDE.setup;
    const el = $('#guide'); el.classList.toggle('open', S.guide); document.body.classList.toggle('guide-open', S.guide);
    $('#guideBtn').setAttribute('aria-pressed', S.guide);
    el.innerHTML = `<div class="gh"><span class="eyebrow">Help</span><button class="x" id="guideClose" aria-label="Close help">×</button></div>
      <h3>${esc(g.t)}</h3><p>${esc(g.w)}</p>${g.y ? `<p class="why"><b>Why.</b> ${esc(g.y)}</p>` : ''}${g.s ? `<p class="skip"><b>If you skip.</b> ${esc(g.s)}</p>` : ''}
      <div class="gdemo"><div class="eyebrow">Try the hard cases</div>
        <label class="toggle"><input type="checkbox" id="failToggle" ${S.failNext ? 'checked' : ''}> <span>Make the next save fail</span></label>
        <button class="btn sm" id="newPlantBtn" style="margin:6px 0">Add a new plant from SCADA</button>
        <label class="toggle"><input type="checkbox" id="modelToggle" ${S.model ? 'checked' : ''}> <span>Show the model underneath</span></label>
      </div>`;
    $('#guideClose').onclick = () => setGuide(false);
    $('#failToggle').onchange = (e) => { S.failNext = e.target.checked; };
    $('#modelToggle').onchange = (e) => { S.model = e.target.checked; document.body.classList.toggle('show-model', S.model); };
    $('#newPlantBtn').onclick = () => { newPlant(); location.hash = '#/setup/scada'; render(); toast('A new plant. Connect SCADA in step 1; the help panel explains each step. Switch plants from the top bar.'); };
  }
  function setGuide(on) { S.guide = on; try { localStorage.setItem('ctl.guide', on ? '1' : '0'); } catch (e) { /* ignore */ } renderGuide(); }
  /* ── the estate: several plants, one shared library, saved on this device ─────────────────
     Each plant keeps its own data and SCADA link; the library (standard sets, flows, causes) is one
     object every plant's data points at, so an edit anywhere is seen everywhere. */
  const PLANT_FIELDS = ['d', 'scada', 'mode', 'visited', 'skipped', 'node', 'openSec', 'scadaSel', 'treeFilter'];
  const freshRt = () => ({ records: [], messages: [], offset: 0 });
  const normaliseLib = (lib) => { lib.flows.forEach((f) => { if (!f.forTypes) f.forTypes = f.forType ? [f.forType] : []; if (!f.use) f.use = f.kind === 'diagnostic' ? 'diagnostic' : 'fix'; }); lib.causes.forEach((c) => { if (!c.types) c.types = c.type ? [c.type] : []; }); return lib; };
  const linkLib = (d) => { d.standardSets = S.lib.standardSets; d.flows = S.lib.flows; d.causes = S.lib.causes; return d; };
  const blankPlant = () => { const d = clone(window.SEED); d.plant = { id: 'new', name: '', code: '', type: null, capacity: '', quietHours: { from: '22:00', to: '06:00', on: true }, hooter: { on: true, seconds: 60 }, modules: d.plant.modules }; d.stages = []; d.groups = []; d.equipment = []; d.sensors = []; d.alerts = []; d.schedules = []; d.conditionWork = []; d.milestones = []; d.cycles = []; d.people = []; d.audit = []; d.rt = freshRt(); return linkLib(d); };
  const samplePlant = () => { const d = clone(window.SEED); d.rt = freshRt(); return linkLib(d); };
  function stash() { if (!S.plant || !S.plants[S.plant]) return; const p = S.plants[S.plant]; PLANT_FIELDS.forEach((k) => { p[k] = S[k]; }); }
  function loadPlant(key) { const p = S.plants[key]; if (!p) return; S.plant = key; PLANT_FIELDS.forEach((k) => { S[k] = p[k]; }); S.sheet = null; S.openSec = null; }
  function switchPlant(key) { stash(); loadPlant(key); }
  function withPlant(key, fn) { if (key === S.plant || !S.plants[key]) return fn(); const cur = S.plant, sh = S.sheet, os = S.openSec; stash(); loadPlant(key); try { return fn(); } finally { stash(); loadPlant(cur); S.sheet = sh; S.openSec = os; } }
  function addPlant(key, mode) { stash(); S.plants[key] = { key, d: mode === 'new' ? blankPlant() : samplePlant(), scada: null, mode, visited: new Set(), skipped: new Set(), node: 'plant', openSec: null, scadaSel: null, treeFilter: '' }; loadPlant(key); return S.plants[key]; }
  function removePlant(key) { stash(); delete S.plants[key]; const next = Object.keys(S.plants)[0]; if (next) loadPlant(next); else { addPlant('new1', 'new'); } }
  function newPlant() { const n = Object.keys(S.plants).filter((k) => k.startsWith('new')).length + 1; addPlant('new' + n, 'new'); return 'new' + n; }
  const plantList = () => Object.values(S.plants).map((p) => ({ key: p.key, name: p.d.plant.name || 'New plant', type: p.d.plant.type }));
  /* deterministic past occurrences, so compliance and the calendar have something to say */
  function seedHistory() { const d = D(); const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
    const step = { day: 1, week: 7, month: 30, year: 365 };
    d.schedules.forEach((sc) => { if (sc.history) return; const rnd = hash(sc.name + (sc.subject.id || 'plant')); const days = (sc.every.n || 1) * (step[sc.every.unit] || 7); const h = []; const n = sc.every.unit === 'day' ? 14 : 6; for (let i = n; i >= 1; i--) { const t = new Date(Date.parse(sc.nextDue + 'T06:00:00+05:30') - i * days * 86400000); const lateRun = sc.name === 'Hypo tank refill' || sc.name === 'Tube module cleaning'; const late = lateRun ? (i <= 3) : rnd() < 0.12; const done = sc.statutory ? true : rnd() < 0.95; h.push({ due: t.toISOString().slice(0, 10), done, late, leg: sc.basis === 'either' ? (sc.name === 'Bearing service' && sc.subject.id === 'bl2' ? 'calendar' : (rnd() < 0.7 ? 'calendar' : 'meter')) : sc.basis }); } sc.history = h; }); }
  function seedManesar() { addPlant('manesar', 'sample'); const model = clone(window.SCADA_SAMPLES.manesar); S.scada = { key: 'manesar', model, syncedAt: new Date(Date.now() - 23 * 60000).toISOString(), sample: true, skipped: [], staged: false, applied: false }; S.visited.add('detect'); S.visited.add('inherit'); S.d.stages.forEach((st) => { const z = model.zones.find((x) => x.id === st.id); const p = detectProfile(st.name); st.profile = p ? p.id : null; st.scadaZone = z ? z.name : st.name; st.detectedBy = 'name'; }); S.d.equipment.forEach((e) => { const se = model.equipment.find((x) => x.id === e.id); if (se) e.scadaType = se.scadaType; }); S.d.sensors.forEach((s) => { s.fromScada = true; const se = model.equipment.find((x) => x.id === s.on.slice(3)); const ss = se && se.sensors.find((x) => (window.SCADA_SENSOR_MAP[x.tag] || x.tag) === s.name); if (ss) { s.scadaTag = ss.tag; s.widget = ss.widget; } }); S.d.plant.scada = true; S.d.plant.type = 'STP'; [...S.d.alerts, ...S.d.schedules, ...S.d.conditionWork].forEach((x) => { if (x.template) x.source = 'library'; }); seedHistory(); if (window.CTL_RT) window.CTL_RT.seedRuntime('manesar'); }
  function seedBawal() { addPlant('bawal', 'new'); importScada('bawal'); const cv = eq('sc_cav'); if (cv) mapType(cv, 'Ozonator'); D().people.push({ id: 'pb1', name: 'Asha Verma', role: 'l1', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00' }, { id: 'pb2', name: 'Imran Shaikh', role: 'l1', phone: { verified: true, channel: 'sms' }, major: 'now', quiet: 'off' }, { id: 'pb3', name: 'Rohit Jain', role: 'l3', grant: 'tech', phone: { verified: true, channel: 'wa' }, major: 'now', quiet: '22:00–06:00' }); inheritPlant(); D().stages.forEach((st) => inheritUnitProcess(st)); D().equipment.forEach((e) => inheritEquipment(e)); D().alerts.forEach((a) => { if (!a.flow && !a.cause) { const f = diagFor(a); if (f) a.flow = f.id; } if (a.status === 'draft' && entrySeverity(limitsOfAlert(a).lim)) a.status = 'active'; }); STEP_IDS.forEach((s) => S.visited.add(s)); S.mode = 'sample'; D().audit = [{ ts: '2026-10-03 16:20', who: 'Rohit Jain', what: 'Inherited everything from the library', detail: '25 items active' }, { ts: '2026-10-03 16:05', who: 'Rohit Jain', what: 'CV-1 (CAVITATOR) is an Ozonator', detail: 'remembered for every plant' }, { ts: '2026-10-03 15:50', who: 'Rohit Jain', what: 'Connected SCADA for Bawal WTP', detail: '3 zones · 8 machines · 12 sensors' }]; S.scada.syncedAt = new Date(Date.now() - 2 * 3600000).toISOString(); seedHistory(); if (window.CTL_RT) window.CTL_RT.seedRuntime('bawal'); }
  function seedVedanta() { addPlant('vedanta', 'new'); importScada('vedanta'); D().people.push({ id: 'pv1', name: 'Mohan Das', role: 'l1', phone: { verified: true, channel: 'sms' }, major: 'now', quiet: 'off' }, { id: 'pv2', name: 'Priya Nair', role: 'l3', phone: { verified: false, channel: null }, major: 'now', quiet: '22:00–06:00' }); S.visited.add('detect'); S.mode = 'sample'; D().audit = [{ ts: '2026-10-04 11:10', who: 'Swadesh Singh', what: 'Connected SCADA for Vedanta ETP', detail: '6 zones · 10 machines · 15 sensors' }]; S.scada.syncedAt = new Date(Date.now() - 26 * 3600000).toISOString(); seedHistory(); if (window.CTL_RT) window.CTL_RT.seedRuntime('vedanta'); }
  function seedEstate() { S.lib = normaliseLib({ standardSets: clone(window.SEED.standardSets), flows: clone(window.SEED.flows), causes: clone(window.SEED.causes) }); S.plants = {}; S.plant = null; seedBawal(); seedVedanta(); seedManesar(); S.sheet = null; }
  function resetData() { clearStore(); seedEstate(); }
  /* saved on this device: the estate survives a reload; Reset data wipes it */
  const STORE = 'ctl.estate.v5'; let persistT;
  function persist() { clearTimeout(persistT); persistT = setTimeout(() => { try { stash(); const strip = (d) => { const o = { ...d }; delete o.standardSets; delete o.flows; delete o.causes; return o; }; const out = { v: 5, plant: S.plant, persona: S.persona, lib: S.lib, plants: Object.fromEntries(Object.entries(S.plants).map(([k, p]) => [k, { ...p, d: strip(p.d), visited: [...p.visited], skipped: [...p.skipped] }])) }; localStorage.setItem(STORE, JSON.stringify(out)); } catch (e) { /* private mode or full */ } }, 250); }
  function restore() { try { const raw = localStorage.getItem(STORE); if (!raw) return false; const o = JSON.parse(raw); if (o.v !== 5 || !o.plants || !o.lib || !Object.keys(o.plants).length) return false; S.lib = normaliseLib(o.lib); S.plants = {}; Object.values(o.plants).forEach((p) => { p.visited = new Set(p.visited || []); p.skipped = new Set(p.skipped || []); p.d = linkLib(p.d); if (!p.d.rt) p.d.rt = freshRt(); S.plants[p.key] = p; }); S.persona = o.persona || 'tech'; loadPlant(o.plant && S.plants[o.plant] ? o.plant : Object.keys(S.plants)[0]); return true; } catch (e) { return false; } }
  function clearStore() { try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ } }

  /* ── export: the configuration in the PRD's shape ────────────── */
  function exportConfig() {
    const d = D(); const cond = (s, op, v) => ({ id: uid('cond'), name: `${s.name} ${op} ${v}`, sensorId: s.tag, operator: op, threshold: v, unit: s.unit });
    const conditions = []; const triggers = [];
    d.alerts.forEach((a) => { const { lim, dir, s } = limitsOfAlert(a); const bands = SEVS.filter((k) => lim[k] != null).map((k) => { const c = cond(s, dir === 'below' ? '<' : '>', lim[k]); conditions.push(c); return { conditionId: c.id, severity: { caution: 'low', minor: 'high', major: 'critical', emergency: 'emergency' }[k] }; }); let res = null; if (a.closes.mode === 'sensor') { res = cond(s, dir === 'below' ? '>' : '<', a.closes.back); res.durationMinutes = a.closes.holdMin; conditions.push(res); } let gate = null; if (a.gate && a.gate.sensor && sensor(a.gate.sensor)) { const gs = sensor(a.gate.sensor); gate = gs.kind === 'status' ? cond(gs, '==', a.gate.op === 'on' ? 1 : 0) : cond(gs, a.gate.op === 'above' ? '>' : '<', a.gate.value); conditions.push(gate); } triggers.push({ id: a.id, ruleName: a.name, status: a.status === 'off' ? 'inactive' : a.status, outcome: 'issue', triggerType: 'alert', subject: a.subject.kind === 'eq' ? { kind: 'equipment', id: a.subject.id } : a.subject.kind === 'stage' ? { kind: 'unitProcess', id: a.subject.id } : a.subject, triggerConfig: { observationConditionId: bands[0] && bands[0].conditionId, observationPolls: a.holdMin ? Math.max(1, a.holdMin) : 1, resolutionPolls: a.closes.holdMin || 1, gateConditionId: gate ? gate.id : null }, severityBands: bands, inheritsSensorZones: a.limits === 'sensor', resolutionType: a.closes.mode === 'sensor' ? 'condition' : 'manual', resolutionConditionId: res && res.id, procedureTreeId: a.flow || null, knownCauseId: a.cause || null, requiresSupervisorVerification: !!a.verify, clocksOverride: a.clocks || null, cycleBound: a.cycle || null }); });
    d.schedules.forEach((sc) => triggers.push({ id: sc.id, ruleName: sc.name, status: sc.status, outcome: 'task', triggerType: 'schedule', subject: sc.subject.kind === 'eq' ? { kind: 'equipment', id: sc.subject.id } : sc.subject.kind === 'stage' ? { kind: 'unitProcess', id: sc.subject.id } : sc.subject, triggerConfig: { recurrence: sc.every.unit === 'day' && sc.every.n === 1 ? 'daily' : sc.every.unit === 'week' && sc.every.n === 1 ? 'weekly' : sc.every.unit === 'month' && sc.every.n === 1 ? 'monthly' : 'custom', recurrenceRule: `FREQ=${{ day: 'DAILY', week: 'WEEKLY', month: 'MONTHLY', year: 'YEARLY' }[sc.every.unit]};INTERVAL=${sc.every.n}`, startAt: sc.nextDue, scope: 'site', workType: sc.workType === 'pm' ? 'preventive_maintenance' : sc.workType === 'calibration' ? 'calibration' : 'routine_check', dueBasis: sc.basis, meterTagId: sc.meter ? sensor(sc.meter.tag).tag : null, meterIntervalHours: sc.meter ? sc.meter.hours : null, meterMinIntervalDays: 30, performedBy: sc.performedBy, toleranceDays: sc.tolerance ?? null, calendarAnchor: sc.anchor === 'last' ? 'from_last_service' : 'fixed' }, statutory: !!sc.statutory, displaySensorId: sc.probe ? sensor(sc.probe).tag : null, procedureTreeId: sc.flow || null, preassignedRootCauseId: sc.cause || null, requiresSupervisorVerification: !!sc.verify }));
    d.conditionWork.forEach((w) => { const s = sensor(w.sensor); const fire = cond(s, '>', w.doWhen), rearm = cond(s, '<', w.doneWhen); conditions.push(fire, rearm); triggers.push({ id: w.id, ruleName: w.name, status: w.status, outcome: 'task', triggerType: 'alert', subject: { kind: 'equipment', id: w.subject.id }, triggerConfig: { observationConditionId: fire.id, observationPolls: 1 }, rearmConditionId: rearm.id, clearanceCheckMinutes: 15, chronicIgnoreThreshold: 5, promotionPairOf: w.escalate ? w.escalate.alert : null, procedureTreeId: w.flow || null, preassignedRootCauseId: w.cause || null }); });
    d.milestones.forEach((m) => triggers.push({ id: m.id, ruleName: m.name, status: 'active', outcome: 'achievement', triggerType: m.on ? 'alert' : 'schedule' }));
    return {
      exportedAt: new Date().toISOString(), plant: { name: d.plant.name, type: d.plant.type || null, capacity: d.plant.capacity, siteDefaults: { quietHours: d.plant.quietHours, hooter: d.plant.hooter } },
      scada: S.scada ? { source: S.scada.key, lastRead: S.scada.syncedAt, leftInScada: S.scada.skipped.map((x) => ({ tag: x.tag, scadaType: x.code, kind: x.kind })) } : null,
      unitProcesses: d.stages.map((st) => ({ id: st.id, name: st.name, scadaZone: st.scadaZone || null, profileId: st.profile || null })), groups: d.groups,
      equipment: d.equipment.map((e) => ({ id: e.id, name: e.name, tag: e.tag, unitProcessId: e.stage, groupId: e.group || null, scadaType: e.scadaType || null, type: e.type, archetype: e.archetype, criticalityTier: e.tier, criticalityOverrideReason: e.tierReason || null, duty: e.duty || null, standbyOf: e.standbyOf || null, expectsProgramme: e.expects })),
      sensors: d.sensors.map((s) => ({ id: s.id, tag: s.tag, name: s.name, unit: s.unit, equipmentId: s.on.slice(3), scadaWidget: s.widget || null, manualEntry: !!s.manual, kind: s.kind, expression: s.expr || null, validMin: s.valid[0], validMax: s.valid[1], defaultZones: s.limits ? { direction: s.direction, zones: SEVS.filter((k) => s.limits[k] != null).map((k) => ({ severity: k, threshold: s.limits[k] })) } : null, zonesSource: s.source || null, maintenanceContract: s.calibration ? { maintainer: s.calibration.by, vendorName: s.calibration.vendor || null, contractEndDate: s.calibration.contractEnd || null } : null, setpoint: s.setpoint || null })),
      roster: d.people.map((p) => ({ id: p.id, name: p.name, role: p.role, grant: p.grant || null, phoneVerified: p.phone.verified, channel: p.phone.channel })),
      signalConditions: conditions, triggers,
      procedures: d.flows.map((f) => ({ id: f.id, name: f.name, treeType: f.kind === 'diagnostic' ? 'branching' : 'linear', equipmentTypes: flowTypes(f), unitProcessProfile: f.forStage || null, use: f.use || null, version: f.version, status: f.status, steps: f.steps })),
      rootCauses: d.causes.map((c) => ({ id: c.id, name: c.name, unitProcessProfile: c.stage || null, anyStage: !!c.anyStage, equipmentTypes: causeTypes(c), remediationTreeId: c.fix || null, sensorFault: !!c.sensorFault })),
      cycles: d.cycles,
    };
  }
  function download(name, obj) { const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

  /* ── router and shell ────────────────────────────────────────── */
  function route() { const h = location.hash.replace(/^#\/?/, '') || 'setup'; const [view, ...rest] = h.split('/'); return { view, rest }; }
  window.addEventListener('hashchange', () => { S.sheet = null; render(); });
  function renderNav() {
    const { view } = route(); const g = gaps(); const RT = window.CTL_RT;
    const dot = (k) => k === 'err' ? '<span class="dot err"></span>' : k === 'gap' ? '<span class="dot"></span>' : '';
    const openIssues = RT ? RT.openRecords().filter((r) => r.kind === 'issue').length : 0; const warn = RT ? RT.planningWarnings().length : 0;
    const groups = [
      ['Configure', [['setup', g.allDone ? 'Plant' : 'Set up the plant', g.routingOk ? (g.allDone ? '' : 'gap') : 'err'], ['equipment', 'Equipment', (g.sensorsNoLimits.length + g.eqNeedingPM.length + g.probesNoCal.length + g.eqNoAlerts.length + g.eqNoSensors.length) ? 'gap' : ''], ['flows', 'Flows', g.causesNoFix.length ? 'gap' : ''], ['library', 'Library', ''], ['people', 'People & alerts', g.routingOk ? '' : 'err']]],
      ['Run', [['maintenance', 'Maintenance', warn ? 'gap' : ''], ['operator', 'Operator app', openIssues ? 'gap' : '']]],
      ['Estate', [['estate', 'Estate', ''], ['activity', 'Activity', '']]],
    ];
    $('#nav').innerHTML = groups.map(([gn, items]) => `<div class="eyebrow">${gn}</div>${items.map(([r, l, k]) => `<a class="item ${view === r ? 'active' : ''}" href="#/${r}">${l}${dot(k)}</a>`).join('')}`).join('') + `<div class="foot">Signed in as <b>${esc(PERSONA[S.persona].who)}</b><br>${esc(PERSONA[S.persona].label)}<div style="margin-top:8px"><a href="index.html">← Read the proposal</a></div></div>`;
    $('#persona').value = S.persona;
    $('#crumb').innerHTML = `<select id="plantSel" title="Switch plant">${plantList().map((p) => `<option value="${p.key}" ${p.key === S.plant ? 'selected' : ''}>${esc(p.name)}${p.type ? ' · ' + esc(p.type) : ''}</option>`).join('')}<option value="__new">＋ New plant from SCADA</option></select>`;
    $('#plantSel').onchange = (e) => { if (e.target.value === '__new') { newPlant(); location.hash = '#/setup/scada'; render(); toast('A new plant. Connect SCADA in step 1.'); return; } switchPlant(e.target.value); S.loadedRoutes = new Set(); render(); toast(`Now on <b>${esc(D().plant.name || 'the new plant')}</b>.`); };
  }
  function render() {
    document.body.classList.toggle('show-model', S.model); renderNav(); persist();
    const { view, rest } = route(); const V = window.CTL_VIEWS;
    const fn = V[view] || V.setup; const main = $('#main');
    if (!S.loadedRoutes.has(view)) { S.loadedRoutes.add(view); main.innerHTML = skeleton(); setTimeout(() => { main.innerHTML = fn(rest); V.wire(view, rest); }, 350); }
    else { main.innerHTML = fn(rest); V.wire(view, rest); }
    renderSheet(); renderGuide(); window.scrollTo({ top: 0 });
  }
  const skeleton = () => `<div class="skel"><div class="sk h"></div><div class="sk"></div><div class="sk"></div><div class="sk w"></div></div>`;
  function openSheet(sheet) { S.sheet = { step: 1, ...sheet }; renderSheet(); renderGuide(); }
  function closeSheet() { S.sheet = null; renderSheet(); renderGuide(); }
  function renderSheet() { $('#sheet')?.remove(); $('#scrim')?.remove(); if (!S.sheet) return; const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.id = 'scrim'; scrim.onclick = closeSheet; const el = document.createElement('div'); el.className = 'sheet'; el.id = 'sheet'; document.body.appendChild(scrim); document.body.appendChild(el); window.CTL_SHEETS[S.sheet.kind](el); $('.x', el)?.addEventListener('click', closeSheet); document.onkeydown = (e) => { if (e.key === 'Escape') closeSheet(); }; }
  const sheetFrame = (el, title, sub, body, foot, rail) => { el.innerHTML = `<div class="sh"><div style="flex:1"><h2>${title}</h2><div class="sub">${sub}</div></div><button class="x" aria-label="Close">×</button></div>${rail ? `<div class="rail">${rail}</div>` : ''}<div class="sb">${body}</div><div class="sf">${foot}</div>`; };
  const stepRail = (steps, cur) => steps.map((s, i) => `<button class="rs ${i + 1 === cur ? 'cur' : ''} ${i + 1 < cur ? 'done' : ''}" data-step="${i + 1}"><span class="n">${i + 1 < cur ? '✓' : i + 1}</span>${esc(s)}</button>`).join('');
  const segWire = (el, id, cb) => $$(`#${id} button`, el).forEach((b) => b.onclick = () => { $$(`#${id} button`, el).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); cb && cb(b.dataset.v); });
  const segVal = (el, id) => $(`#${id} button[aria-pressed=true]`, el)?.dataset.v;
  const failedBanner = (retryId, draftId) => `<div class="note err" style="margin-bottom:14px"><span><b>Nothing was saved.</b> The network did not answer. Your changes are still here. <button class="btn sm" id="${retryId}" style="margin-left:8px">Try again</button> ${draftId ? `<button class="btn sm ghost" id="${draftId}">Keep as a draft on this device</button>` : ''}</span></div>`;

  function boot() {
    $('#persona').onchange = (e) => { S.persona = e.target.value; S.sheet = null; render(); };
    $('#reset').onclick = () => { resetData(); S.loadedRoutes = new Set(); location.hash = '#/setup'; render(); toast('Reset. The estate is back to its starting state: Manesar STP, Bawal WTP, Vedanta ETP.'); };
    $('#guideBtn').onclick = () => setGuide(!S.guide);
    if (!restore()) seedEstate(); render();
  }

  return { S, $, $$, esc, uid, plural, cap, SEVS, SEV_LABEL, SEV_CLOCK, TIER_LABEL, TIER_SHARE, ROLE_LABEL, GRANT_LABEL, WT_LABEL, PERSONA, STEP_IDS, STEP_TITLE, can, D, eq, stage, group, sensor, flow, cause, alertById, schedById, workById, catalogue, subjectName, subjectTier, subjectKey, parseNode, sensorHome, sensorsOf, limitsOfAlert, entrySeverity, deepestSeverity, limitsText, fmtLimits, every, closeDefault, taskClocks, fmtH, suggestedLimits, nextTag, people, ops, leads, seniors, seniorOrLeads, siteAdmins, first, issueLadder, ladderSummary, taskLadder, toldBlock, gaps, nodeStatus, toast, audit, modal, save, openSheet, closeSheet, sheetFrame, stepRail, segWire, segVal, failedBanner, render, renderGuide, clone, boot, route, exportConfig, download, resetData, importScada, applyDelta, stageDelta, detectGroups, detectProfile, profileForType, profileById, palette, scadaKind, fmtTime, mapType, leaveInScada, inheritance, inheritEquipment, inheritUnitProcess, inheritPlant, inheritStatus, eqInheritItems, plantProfile, plantRoundDone, upRoundDone, customCount, propagateSet, flowTypes, flowFits, flowScope, diagFor, causeTypes, causesFor, switchPlant, withPlant, addPlant, newPlant, removePlant, plantList, seedEstate, persist, clearStore };
})();
