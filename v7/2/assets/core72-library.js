/* core72-library.js — the library of v7/2 (CloseTheLoop configuration, Alex's model as drafted): templates with their own
   versions, limit rules over design parameters, sensor Zones and Trigger terms, the freeze while an Issue is open, Downstream
   and the four publish kinds, pins, and the plant Readings tab.
   Loads after core7.js and core72-structure.js, before core72-ledger.js and core72-commission.js (each optional: without the
   structure file every node keeps its own type; without the ledger file chips use the plain words below). Never touches the
   DOM; runs headless in node. Adds to window.V7 and replaces v7/1's limitsOf, sourceOf, readings, libTypes, libType and
   libVersion; v7/1's libDraft, editLib, discardDraft, whereItLands, publish and libLimits throw (use the template functions).

   ─── The library (in V7.S.lib) ──────────────────────────────────────────────────────────────────────────────────────────
   tpl {id: TemplateBody} · tplHistory {id: [{v, at, by, kind, note, reason, diffs, body}]} · drafts {id: Draft} (template ids;
   core7's own drafts are keyed by type code and never clash) · typeVersions {'eq:CODE'|'up:id'|'plant:STP': n} (missing = 1) ·
   typeFields · forced {id: {v, changeId, bands:{emergency}, reason, at, by, liftedAt}} · changes [LibChange] (newest first) ·
   majorDrafts [{id, plant, templateId, v, fromV, alertIds, scheduleIds, carried, at, status}].
   Elsewhere in V7.S: pins [{id, plant, templateId, v, reason, note, by, at, endedAt}] · majorHolds [{plant, templateId, v,
   draftId}] · params {plant: {nodeId|'plant': {paramKey: {value, unit, by, at, note, surveyValue}}}} (person entries only;
   survey answers stay in the survey) · held {plant: {alertId: {since, issueIds, terms:{dir, bands, hold, clear}, templateId,
   templateVersion, released, movedAt}}} · paramUndo [{token, plant, nodeId, param, prev, next, at}].
   TemplateBody: {id, kind 'trigger'|'task', name, v, owner {kind 'eqType', code, typeName} | {kind 'upType', id, typeName} |
   {kind 'plantType', id, typeName}, subject 'eq'|'up'|'plant', reading, dir, outcome, rules {caution, minor, major, emergency:
   Rule|null}, hold, clear, workType, every, basis, meterHours, condition {reading, op, doWhen: Rule, doneWhen: Rule}|null,
   flowId, issueTypeId, statutory, desc, singleUse {plant, from, since}|null}. Rule: {kind 'const', value} | {kind 'expr',
   factor, param 'tankHeight'|'fullLoadCurrent'|'tankVolume'|'motorRating'}.
   Ids: tpl_<CODE>_<slug> (equipment types without a unit process on them), tpl_up_<upTypeId>_<slug>, tpl_PLANT_<STP|ETP|WTP>
   _<slug>, tpl_single_<plant>_<scheduleId>. Nothing here draws from v7/1's shared id counter.

   ─── API (window.V7) ─────────────────────────────────────────────────────────────────────────────────────────────────────
   Templates: templates({owner, kind, q}) · template(id) · tplVersion(id) · tplBodyAt(key, id) · versionAt(key, id) ·
              templateOf(key, alertId) · ruleText(rule, unit) · constantFlag(id, band) · triggerName(key, alertId) ·
              addSingleUse(key, schedule, {since})
   Parameters: PARAMS · designParams(key, objRef) · designParamPreview(key, objRef, param, value) · setDesignParam(key, objRef,
              param, value, {note}) · undoDesignParam(key, token) · canUndoDesignParam(key, token) · resolveRule(key, rule,
              sensor, nodeId) · designParamsMissing(key)
   Values:    zoneInfo(key, sensorId, dir, {draft}) (limitsOf is its alias) · zoneCheck(key, sensorId, dir, bands) ·
              triggerTerms(key, alertId, opts) (the 'terms' hook) · triggerBands(key, alertId) · timingOf(key, alertId, which)
              · cadenceOf(key, scheduleId) · conditionOf(key, workId) · sourceOf(key, target) · limitGaps(key) · syncZone(key,
              sensorId) · readings(key, {eqId, upId}) · readingsTab(key) · bindingProposals(key)
   Freeze:    holdTrigger · releaseHeld · isFrozen(key, alertId) · heldOf(key, alertId) · markMoved(key, target) ·
              resyncPreview(key, alertId) · resync(key, alertId)
   Publish:   editTemplate(id, change, {promoteFrom, merge}) · templateDraft(id) · discardTemplateDraft(id) · downstream(id,
              {kind, countFrom}) · publishTemplate(id, {kind, note, reason, countFrom}) · editTypeField · publishTypeField ·
              pin(key, id, {reason, note}) · unpin(key, id) · pins({plant}) · liftForced(id, {reason}) · majorDrafts(key) ·
              acceptMajorDraft(key, id) · libChanges({templateId})
   Library:   libTypes() · libType(code) · upTypeView(id) · plantTypes() · plantTypeView(id) · conditions() · condition(id) ·
              flows() · flow(id) · rootCauses() · rootCause(id) · typeVersion(typeKey) · resolvesAt(templateId)
   Hooks:     seed 'before' (templates, Vedanta's person-entered tank height), seed 'after' (template ids on Triggers and
              Tasks, the 20 Oct publish as a template version), 'terms', 'issueOpened', 'issueClosed'; decorates alert views. */
(function () {
  'use strict';
  const V = window.V7;
  if (!V || !V.__) return;
  const _ = V.__;
  const C = window.CTL;
  const { T, DAY, MIN, BANDS, BAND_LABEL, ORDER, ME } = _;
  const S = () => _.S;

  /* ── constants ─────────────────────────────────────────────────────────────────────────────── */
  /* the types whose survey asks a tank height (their Level high band is a share of it) and whose survey asks a motor rating */
  const HEIGHT_CODES = ['TANK', 'TANK_2', 'OP_TANK', 'CP_TANK', 'OS_TANK', 'OS_TANK_SP', 'SH_TANK'];
  const MOTOR_CODES = ['PMP', 'SUB_PMP', 'BLW', 'SC_PRESS'];
  /* the Blower's intake-filter job starts at 95% of full-load current and is done below 85% */
  const INTAKE = { code: 'BLW', name: 'Clean intake filter', doWhen: 0.95, doneWhen: 0.85 };
  /* readings whose right limit depends on the size of the plant: a constant there carries a flag */
  const SIZE_DEPENDENT = ['Level', 'Motor current', 'Run hours', 'Flow', 'Pressure', 'Line pressure', 'Inlet pressure', 'Discharge pressure', 'Differential pressure', 'Level differential'];
  const PARAMS = {
    tankHeight: { label: 'Tank height', unit: 'm', survey: ['Depth / Height', 'Height'], max: 20 },
    tankLength: { label: 'Length', unit: 'm', survey: ['Length'] },
    tankWidth: { label: 'Width', unit: 'm', survey: ['Width', 'Breadth', 'Breath'] },
    tankVolume: { label: 'Tank volume', unit: 'm³', survey: ['Volume'], derive: 'volume' },
    motorRating: { label: 'Motor rating', unit: 'kW', survey: ['Motor Rating', 'Motor Rating(KW)', 'KW rating'], max: 1000 },
    fullLoadCurrent: { label: 'Full-load current', unit: 'A', derive: 'fla', from: 'motorRating' },
  };
  const PLANT_PARAMS = {
    ratedFlow: { label: 'Rated flow', unit: 'm³/day', group: 'Rated flow' },
    consentBod: { label: 'BOD', unit: 'mg/L', group: 'Discharge consent limits' },
    consentCod: { label: 'COD', unit: 'mg/L', group: 'Discharge consent limits' },
    consentTss: { label: 'TSS', unit: 'mg/L', group: 'Discharge consent limits' },
  };
  const PARAM_WORD = { tankHeight: 'tank height', tankLength: 'length', tankWidth: 'width', tankVolume: 'tank volume', motorRating: 'motor rating', fullLoadCurrent: 'full-load current' };
  const KINDS = ['patch', 'minor', 'major', 'forced'];
  const KIND_LABEL = { patch: 'Patch', minor: 'Minor', major: 'Major', forced: 'Forced' };
  const PLANT_TYPES = ['STP', 'ETP', 'WTP'];
  const MANUAL_ERR = 'Hand-test results stay in the task record: they have no sensor, so no Zones.';
  const SEED_PUBLISH = { templateId: 'tpl_up_clarification_sludge-blanket-high', at: '2026-10-20T11:00', by: 'Satyadev Singh', hold: 15, note: 'Blanket readings bounce while the scraper passes; 15 min stops false starts' };
  const SEED_PERSON = { plant: 'vedanta', nodeId: 'v_eq1', param: 'tankHeight', value: 4.5, at: '2026-10-23T10:40', by: 'Satyadev Singh', note: 'Read off the drawing during the bindings pass: the plant graph has no height for EQ-1' };

  /* ── small helpers ─────────────────────────────────────────────────────────────────────────── */
  const safe = (fn, fb) => { try { const r = fn(); return r === undefined ? fb : r; } catch (e) { return fb; } };
  const fnOf = (name) => (typeof V[name] === 'function' ? V[name] : null);
  const now = () => _.now();
  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const cached = (k, fn) => _.cached(k, fn);
  const touch = () => _.touch();
  const plantName = (k) => _.plantName(k);
  const plural = (n, w, ws) => _.plural(n, w, ws);
  const r1 = (x) => Math.round(x * 10) / 10;
  const rnd = (x, dp) => _.round(x, dp);
  const same = (a, b) => _.same(a, b);
  const norm4 = (x) => _.norm4(x);
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const dMon = (ms) => { if (ms == null) return '—'; const p = _.parts(ms); return `${p.day} ${p.mon}`; };
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  const dirWord = (dir) => (dir === 'below' ? 'below' : 'above');
  const cmpOf = (dir) => (dir === 'below' ? '<' : '>');
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const joinAnd = (xs) => _.joinAnd(xs);
  const L = () => S().lib;
  const PS = (key) => _.PS(key);
  const dOf = (key) => _.dOf(key);
  const live = (key) => !!PS(key) && PS(key).state === 'live';
  /* numbers: v7/1's rounding with thousands grouped ("2,500"); a derived ampere or metre value keeps one decimal ("40.0 A") */
  function numText(v, oneDp) {
    if (v == null || Number.isNaN(+v)) return '';
    let s = oneDp ? (Math.round(+v * 10) / 10).toFixed(1) : _.fmtNum(+v);
    const m = /^(-?)(\d+)(\.\d+)?$/.exec(s); if (m && m[2].length > 3) s = m[1] + m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (m[3] || '');
    return s;
  }
  function unitText(v, unit, kind, oneDp) {
    if (v == null) return 'no value'; if (kind === 'status') return v >= 0.5 ? 'ON' : 'OFF';
    const n = numText(v, oneDp); if (!unit) return n; if (unit === '%') return `${n}%`; if (unit === 'pH') return `pH ${n}`; return `${n} ${unit}`;
  }
  /* "2,000 → 2,200 mg/L": the unit once, at the end */
  function pairNum(from, to, unit, kind, oneDp) {
    const a = from == null ? 'none' : unit === 'pH' ? `pH ${numText(from, oneDp)}` : numText(from, oneDp);
    return `${a} → ${to == null ? 'none' : unitText(to, unit, kind, oneDp)}`;
  }
  const oneDpUnit = (unit) => unit === 'A' || unit === 'm';
  /* a size or rating as typed: 8 m, 22 kW, 3.7 kW (never 8.0) */
  const plainNum = (v) => (v == null ? '' : Number.isInteger(+v) ? String(+v) : numText(+v));
  const lowerParam = (pk) => PARAM_WORD[pk] || (PARAMS[pk] ? PARAMS[pk].label.toLowerCase() : pk);
  const act = (at, plant, text, kind, who) => _.addActivity({ at, plant: plant || null, text, kind: kind || 'config', who, library: true });

  /* one chip formatter (the ledger's, once it is loaded); the same words otherwise */
  function chipOf(src) {
    const f = fnOf('chipFor'); if (f) { const c = safe(() => f(src), null); if (c && c.text) return c; }
    const s = src || {}; const tv = (n, v) => `${n || 'the library'} v${v || 1}`;
    switch (s.src) {
      case 'library': return { text: `Library · ${tv(s.template, s.v)}`, tone: 'lib', sub: null, small: null, extra: s.singleUse ? [{ text: `Single-use · ${plantName(s.singleUse.plant)} only`, tone: 'single' }] : undefined };
      case 'derived': return { text: `Derived · ${s.ruleText || 'from a design parameter'}${s.paramText ? ` (${s.paramText})` : ''}`, tone: 'der', sub: null, small: null };
      case 'override': return { text: `Override · ${cap(String(s.reason || ''))} · ${s.author == null ? 'not recorded' : s.author === ME ? 'you' : s.author} · ${dMon(s.at)} · review by ${dMon(s.reviewBy)}`, tone: 'ovr', sub: null, small: s.baseText != null ? `Library: ${s.baseText}` : null };
      case 'basemoved': return { text: 'Base moved', tone: 'moved', sub: `Library changed ${s.old} → ${s.new} since you overrode it`, small: null };
      case 'forced': return { text: `Forced by library · ${tv(s.template, s.v)}`, tone: 'forced', sub: null, small: null };
      case 'pinned': return { text: s.latest != null && s.latest !== s.v ? `Pinned to v${s.v} · v${s.latest} changes this to ${s.x}` : `Pinned to v${s.v}`, tone: 'pin', sub: null, small: null };
      case 'gap': return s.paramLabel ? { text: `Gap · needs ${s.paramLabel}${s.tag ? ` (${s.tag})` : ''}`, tone: 'gap', sub: null, small: null } : { text: 'Gap · no rule', tone: 'gap', sub: 'No value · this reading raises nothing', small: null };
      case 'followsSensor': return { text: `Follows sensor ${s.tag}${s.zoneText ? ` · ${s.zoneText}` : ''}`, tone: 'lib', sub: null, small: null };
      case 'triggerOverride': return { text: `Overridden for this Trigger · ${cap(String(s.reason || ''))}`, tone: 'ovr', sub: null, small: s.sensorValueText != null ? `Sensor: ${s.sensorValueText}` : null };
      case 'frozen': return { text: `Frozen while ${s.n || 1} ${(s.n || 1) === 1 ? 'Issue is' : 'Issues are'} open`, tone: 'frozen', sub: null, small: null };
      case 'held': return { text: 'Base moved · waits for a resync', tone: 'moved', sub: null, small: null };
      case 'next': return { text: 'Next phase', tone: 'next', sub: null, small: null };
      default: return { text: String(s.text || ''), tone: s.tone || 'lib', sub: null, small: null };
    }
  }
  const reasonLabel = (r) => { const R = { tuned: 'tuning', fornow: 'temporary', unrecorded: 'migrated', notinlib: 'migrated' }; const k = R[r] || r; const lab = V.LABELS && V.LABELS.reason ? V.LABELS.reason[k] : null; return typeof lab === 'string' ? lab : cap(String(k || '')); };

  /* ── the library's types and the owner of a node's content ─────────────────────────────────── */
  const sets = () => (C && C.S && C.S.lib ? C.S.lib.standardSets : []);
  const eqSet = (typeName) => sets().find((x) => x.type === typeName && !x.upType) || null;
  const upSet = (id) => sets().find((x) => x.upType === id) || null;
  const setOfOwner = (o) => (!o ? null : o.kind === 'upType' ? upSet(o.id) : o.kind === 'eqType' ? eqSet(o.typeName) : null);
  const anchorCodes = () => (Array.isArray(V.ANCHOR_CODES) ? V.ANCHOR_CODES : []);
  const isAnchor = (code) => anchorCodes().includes(code);
  const upTypeList = () => (Array.isArray(V.UP_TYPES) ? V.UP_TYPES : []);
  const upTypeById = (id) => upTypeList().find((u) => u.id === id) || null;
  const catByCode = (code) => _.catByCode(code);
  const ownerKey = (o) => (!o ? '' : o.kind === 'upType' ? `up:${o.id}` : o.kind === 'plantType' ? `plant:${o.id}` : `eq:${o.code}`);
  const ownerName = (o) => (!o ? '' : o.typeName || o.id || o.code || '');
  /* the library owner whose templates a node carries: its unit-process type, else its equipment type (a type with a unit
     process on it carries no content of its own) */
  function ownerOfNode(key, e) {
    if (!e) return null; const lk = _.libKey(e); const set = _.setOf(lk);
    if (set && set.upType) return { kind: 'upType', id: set.upType, typeName: lk };
    const code = _.codeOfType(lk); if (!code || isAnchor(code)) return null;
    return { kind: 'eqType', code, typeName: lk };
  }
  const sameOwner = (a, b) => !!a && !!b && ownerKey(a) === ownerKey(b);
  const typeVersion = (typeKey) => { const tv = S() && L() && L().typeVersions; return (tv && tv[typeKey]) || 1; };
  const isUpNode = (key, id) => !!safe(() => fnOf('isUp') && V.isUp(key, id), false);
  const nodeRoute = (key, id) => (isUpNode(key, id) ? 'up' : 'eq');

  /* ── templates: built from the shipped library at the story's start ────────────────────────── */
  const tplRaw = (id) => (id && S() && L() && L().tpl ? L().tpl[id] || null : null);
  const ruleConst = (v) => (v == null || !Number.isFinite(+v) ? null : { kind: 'const', value: +v });
  function motorFactors(code) { const r = ((window.FORM_RULES || {})[code] || []).find((x) => x.reads === 'limits' && x.sensorKind === 'Motor current'); return r && r.factors ? r.factors : { caution: 1, minor: 1.05, major: 1.15 }; }
  function rulesFor(owner, contentCode, a) {
    const lim = a.limits || {}; const out = {}; BANDS.forEach((b) => { out[b] = ruleConst(lim[b]); });
    if (a.sensorKind === 'Level' && a.direction === 'above' && HEIGHT_CODES.includes(contentCode)) BANDS.forEach((b) => { if (lim[b] != null) out[b] = { kind: 'expr', factor: rnd(lim[b] / 100, 4), param: 'tankHeight' }; });
    if (a.sensorKind === 'Motor current' && a.direction === 'above' && owner.kind === 'eqType' && MOTOR_CODES.includes(owner.code)) { const f = motorFactors(owner.code); BANDS.forEach((b) => { out[b] = f[b] != null ? { kind: 'expr', factor: f[b], param: 'fullLoadCurrent' } : null; }); }
    return out;
  }
  function trigBody(id, owner, subject, contentCode, a) {
    const emerg = !!(a.limits && a.limits.emergency != null);
    return { id, kind: 'trigger', name: a.name, v: 1, owner: { ...owner }, subject, contentFrom: contentCode, reading: a.sensorKind, dir: a.direction, outcome: 'Issue', rules: rulesFor(owner, contentCode, a), hold: a.hold != null ? a.hold : emerg ? 0 : 5, clear: a.clear != null ? a.clear : 10, flowId: a.flow || null, issueTypeId: a.issue || null, causeId: a.cause || null, gate: a.gate || null, ifDrawn: a.ifDrawn != null ? clone(a.ifDrawn) : null, statutory: false, desc: a.note || '', singleUse: null };
  }
  function condRules(owner, x) {
    const intake = owner.kind === 'eqType' && owner.code === INTAKE.code && x.name === INTAKE.name;
    const dw = Number.isFinite(+x.doWhen) ? +x.doWhen : null; const dn = Number.isFinite(+x.doneWhen) ? +x.doneWhen : null;
    return { reading: x.sensorKind || null, op: dw != null && dn != null && dw < dn ? 'below' : 'above', doWhen: intake ? { kind: 'expr', factor: INTAKE.doWhen, param: 'fullLoadCurrent' } : ruleConst(dw), doneWhen: intake ? { kind: 'expr', factor: INTAKE.doneWhen, param: 'fullLoadCurrent' } : ruleConst(dn) };
  }
  function taskBody(id, owner, subject, contentCode, x) {
    return { id, kind: 'task', name: x.name, v: 1, owner: { ...owner }, subject, contentFrom: contentCode, outcome: 'Task', workType: x.workType, every: x.every && x.every.n ? { ...x.every } : null, basis: x.basis || 'calendar', meterHours: x.meterHours != null ? x.meterHours : null, condition: x.workType === 'condition' ? condRules(owner, x) : null, generalTaskId: x.task || null, flowId: x.flow || null, hours: x.hours != null ? x.hours : null, parts: x.parts || '', label: x.label || null, lab: !!x.lab, ifDrawn: x.ifDrawn != null ? clone(x.ifDrawn) : null, statutory: !!x.statutory, verify: !!x.verify, desc: x.note || '', singleUse: null };
  }
  function buildTemplates() {
    const lib = L(); lib.tpl = {}; lib.tplHistory = {}; const used = new Set();
    const idFor = (prefix, name) => { const base = `${prefix}_${slug(name)}`; let id = base; let n = 2; while (used.has(id)) id = `${base}-${n++}`; used.add(id); return id; };
    const put = (body) => { lib.tpl[body.id] = body; lib.tplHistory[body.id] = [{ v: 1, at: null, by: null, kind: null, note: '', reason: null, diffs: [], body: clone(body) }]; };
    const addSet = (set, owner, prefix, contentCode, subject) => {
      set.alerts.forEach((a) => put(trigBody(idFor(prefix, a.name), owner, subject, contentCode, a)));
      set.schedules.filter((x) => x.workType !== 'condition').forEach((x) => put(taskBody(idFor(prefix, x.name), owner, subject, contentCode, x)));   /* v7/2: no condition-based work on equipment types */
    };
    (window.CATALOGUE || []).forEach((cat) => { if (isAnchor(cat.code)) return; const set = eqSet(cat.type); if (set) addSet(set, { kind: 'eqType', code: cat.code, typeName: cat.type }, `tpl_${cat.code}`, cat.code, 'eq'); });
    upTypeList().forEach((u) => { const set = upSet(u.id); if (set) addSet(set, { kind: 'upType', id: u.id, typeName: u.name }, `tpl_up_${u.id}`, u.contentFrom, 'up'); });
    PLANT_TYPES.forEach((pt) => {
      const prof = (window.PLANT_PROFILES || {})[pt]; if (!prof) return; const owner = { kind: 'plantType', id: pt, typeName: pt };
      (prof.rounds || []).forEach((r) => { const ev = C.cadenceOf(r); put(taskBody(idFor(`tpl_PLANT_${pt}`, r.name), owner, 'plant', null, { ...r, every: ev && ev.n ? ev : r.every, basis: r.basis || 'calendar' })); });
    });
    touch();
  }
  function byOwner() {
    return cached('kc:byowner', () => { const m = {}; Object.keys(L().tpl || {}).forEach((id) => { const t = L().tpl[id]; const k = ownerKey(t.owner); (m[k] || (m[k] = [])).push(id); }); return m; });
  }
  const tplsOf = (owner) => (owner ? (byOwner()[ownerKey(owner)] || []).map(tplRaw).filter(Boolean) : []);
  /* a single-use template: what one plant needs that no library type has (a plant-only Task, after the migration) */
  function addSingleUse(key, sc, opts) {
    if (!sc || !S()) return null; const id = `tpl_single_${key}_${sc.id}`;
    if (tplRaw(id)) { sc.templateId = id; return id; }
    const e = sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(key, sc.subject.id) : null;
    const owner = ownerOfNode(key, e) || (e ? { kind: 'eqType', code: _.codeOfType(e.type), typeName: e.type } : { kind: 'plantType', id: dOf(key).plant.type, typeName: dOf(key).plant.type });
    const ev = C.cadenceOf(sc);
    const body = taskBody(id, owner, owner.kind === 'upType' ? 'up' : owner.kind === 'plantType' ? 'plant' : 'eq', null, { name: sc.name, workType: sc.workType, every: sc.every && sc.every.n ? sc.every : ev, basis: sc.basis || 'calendar', meterHours: sc.meter ? sc.meter.hours : null, task: sc.task, flow: sc.flow, hours: sc.hours, parts: sc.parts });
    const since = opts && opts.since != null ? opts.since : now();
    body.singleUse = { plant: key, from: sc.id, since };
    L().tpl[id] = body; L().tplHistory[id] = [{ v: 1, at: since, by: null, kind: null, note: '', reason: null, diffs: [], body: clone(body) }];
    sc.templateId = id; touch(); return id;
  }

  /* ── which template a Trigger, Task or job follows; the version a plant runs ──────────────── */
  function templateIdOfAlert(key, a) {
    if (!a) return null;
    return cached(`kc:ta:${key}:${a.id}`, () => {
      if (a.templateId && tplRaw(a.templateId)) return a.templateId;
      const e = _.alertEq(key, a) || _.homeOf(key, _.sensorRaw(key, a.sensor)); const s = _.sensorRaw(key, a.sensor); if (!s) return null;
      const dir = _.alertDir(key, a); const cands = tplsOf(ownerOfNode(key, e)).filter((t) => t.kind === 'trigger' && t.reading === s.name && t.dir === dir);
      const named = cands.find((t) => a.name === t.name || String(a.name).startsWith(`${t.name} `));
      return (named || cands[0] || {}).id || null;
    });
  }
  function templateIdOfSchedule(key, sc) {
    if (!sc) return null;
    return cached(`kc:ts:${key}:${sc.id}`, () => {
      if (sc.templateId && tplRaw(sc.templateId)) return sc.templateId;
      const su = tplRaw(`tpl_single_${key}_${sc.id}`); if (su) return su.id;
      if (!sc.subject || sc.subject.kind !== 'eq') { const pt = dOf(key).plant.type; const t = tplsOf({ kind: 'plantType', id: pt }).find((x) => x.name === sc.name); return t ? t.id : null; }
      const e = _.eqRaw(key, sc.subject.id); const t = tplsOf(ownerOfNode(key, e)).find((x) => x.kind === 'task' && x.name === sc.name && x.workType !== 'condition');
      return t ? t.id : null;
    });
  }
  function templateIdOfWork(key, w) {
    if (!w) return null;
    return cached(`kc:tw:${key}:${w.id}`, () => {
      if (w.templateId && tplRaw(w.templateId)) return w.templateId;
      const e = w.subject ? _.eqRaw(key, w.subject.id) : null; const t = tplsOf(ownerOfNode(key, e)).find((x) => x.kind === 'task' && x.workType === 'condition' && x.name === w.name);
      return t ? t.id : null;
    });
  }
  const activePin = (key, id) => (S() && S().pins ? S().pins.find((p) => p.plant === key && p.templateId === id && !p.endedAt) || null : null);
  const majorHoldOf = (key, id) => (S() && S().majorHolds ? S().majorHolds.find((m) => m.plant === key && m.templateId === id) || null : null);
  function versionAt(key, id) { const cur = tplRaw(id); if (!cur) return null; const p = activePin(key, id); if (p) return p.v; const m = majorHoldOf(key, id); if (m) return m.v; return cur.v; }
  function bodyAt(id, v) { const cur = tplRaw(id); if (!cur) return null; if (v == null || v === cur.v) return cur; const h = ((L().tplHistory || {})[id] || []).find((x) => x.v === v); return h ? h.body : cur; }
  /* the template body a plant runs: the pinned version, else the version a Major change holds it on, else the current one (a
     Forced change in force lays its Emergency band over any of them, in zoneInfo and triggerTerms) */
  const tplBodyAt = (key, id) => bodyAt(id, versionAt(key, id));
  function forcedOf(id) { const f = id && S() && L() && L().forced ? L().forced[id] : null; return f && !f.liftedAt ? f : null; }
  /* the body a plant runs with a Forced change in force laid over its Emergency band (what the template page shows for a plant) */
  function tplBodyAtPlant(key, id) { const b = tplBodyAt(key, id); const fo = forcedOf(id); if (!b || !fo || !fo.bands || fo.bands.emergency === undefined) return b; const fr = fo.bands.emergency; return { ...b, rules: { ...b.rules, emergency: fr == null ? null : typeof fr === 'object' ? { ...fr } : { kind: 'const', value: fr } }, forcedV: fo.v }; }
  function templateOf(key, alertId) { const a = _.alertRaw(key, alertId); const id = templateIdOfAlert(key, a); return id ? tplView(tplRaw(id)) : null; }

  /* ── design parameters ─────────────────────────────────────────────────────────────────────── */
  const formNum = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.+-]/g, '')); return Number.isFinite(n) ? n : null; };
  const fla = (kw) => (typeof C.fullLoadAmps === 'function' ? C.fullLoadAmps(kw) : r1(kw * 1000 / (Math.sqrt(3) * 415 * 0.85 * 0.9)));
  function formOf(key, e) { if (!e) return null; _.withPlant(key, () => C.ensureForm(e)); return e.form || null; }
  function surveyParam(key, e, pk) {
    const def = PARAMS[pk]; if (!def || !def.survey || !e) return null; const f = formOf(key, e); if (!f) return null;
    for (const q of def.survey) { if (f[q] == null || f[q] === '') continue; const n = formNum(f[q]); if (n != null) return { value: n, q }; }
    return null;
  }
  const personParams = (key, nid) => { const P = S() && S().params; return (P && P[key] && P[key][nid]) || {}; };
  function paramValue(key, nid, pk) {
    if (!nid) return null;
    return cached(`kc:pv:${key}:${nid}:${pk}`, () => {
      const def = PARAMS[pk] || PLANT_PARAMS[pk]; if (!def) return null;
      const ent = personParams(key, nid)[pk]; const e = nid === 'plant' ? null : _.eqRaw(key, nid); const sv = e ? surveyParam(key, e, pk) : null;
      if (ent && ent.value != null) return { value: ent.value, source: 'person', by: ent.by, at: ent.at, note: ent.note || '', surveyValue: sv ? sv.value : null, q: sv ? sv.q : null };
      if (sv) return { value: sv.value, source: 'survey', q: sv.q, surveyValue: sv.value };
      if (def.derive === 'fla') { const kw = paramValue(key, nid, 'motorRating'); if (kw && kw.value != null) return { value: fla(kw.value), source: 'derived', from: 'motorRating', kw: kw.value, how: `from the ${plainNum(kw.value)} kW motor at 415 V` }; }
      if (def.derive === 'volume' && e) {
        const h = paramValue(key, nid, 'tankHeight'), l = paramValue(key, nid, 'tankLength'), w = paramValue(key, nid, 'tankWidth');
        if (h && l && w) return { value: Math.round(l.value * w.value * h.value), source: 'derived', how: `${plainNum(l.value)} × ${plainNum(w.value)} × ${h.value.toFixed(1)} m` };
        const f = formOf(key, e) || {}; const rad = formNum(f.Radius); if (h && rad != null) return { value: Math.round(Math.PI * rad * rad * h.value), source: 'derived', how: `a cylinder of radius ${numText(rad)} m, ${h.value.toFixed(1)} m high` };
      }
      return null;
    });
  }
  function ruleText(rule, unit, kind) {
    if (!rule) return 'no rule';
    if (rule.kind === 'const') return unitText(rule.value, unit, kind);
    return `${numText(rnd(rule.factor * 100, 2))}% of ${lowerParam(rule.param)}`;
  }
  /* a limit rule worked out at one node: a constant as written; a share of a design parameter (a tank-height rule on a % level
     sensor stays a %, with the metres shown); a missing parameter is a Gap */
  function resolveRule(key, rule, sensor, nodeId) {
    if (!rule) return null; const unit = sensor ? sensor.unit : ''; const kind = sensor ? sensor.kind : null; const rt = ruleText(rule, unit, kind);
    if (rule.kind === 'const') return { value: rule.value, source: 'library', ruleText: rt, rule };
    const pk = rule.param; const e = nodeId && nodeId !== 'plant' ? _.eqRaw(key, nodeId) : null; const pv = nodeId ? paramValue(key, nodeId, pk) : null;
    if (!pv || pv.value == null) { const need = pk === 'fullLoadCurrent' ? 'motorRating' : pk; return { value: null, source: 'gap', ruleText: rt, rule, needs: { param: need, label: lowerParam(need), eqId: nodeId, nodeId, tag: e ? e.tag : null } }; }
    if (pk === 'tankHeight' && unit === '%') return { value: rnd(rule.factor * 100, 4), metres: r1(rule.factor * pv.value), source: 'derived', ruleText: rt, paramText: `${pv.value.toFixed(1)} m`, rule, param: pk, paramValue: pv.value };
    if (pk === 'fullLoadCurrent') { const F = r1(pv.value); return { value: r1(rule.factor * F), source: 'derived', ruleText: rt, paramText: `${F.toFixed(1)} A, ${plainNum(pv.kw)} kW motor`, rule, param: pk, paramValue: F }; }
    const def = PARAMS[pk] || {}; return { value: r1(rule.factor * pv.value), source: 'derived', ruleText: rt, paramText: `${plainNum(pv.value)} ${def.unit || ''}`.trim(), rule, param: pk, paramValue: pv.value };
  }
  function constantFlagOf(t, band) { if (!t || t.kind !== 'trigger') return false; const r = t.rules ? t.rules[band] : null; return !!r && r.kind === 'const' && SIZE_DEPENDENT.includes(t.reading); }
  const constantFlag = (id, band) => { const t = tplRaw(id); if (!t) return false; return band ? constantFlagOf(t, band) : BANDS.some((b) => constantFlagOf(t, b)); };

  /* ── the plant's records on a value (v7/1's kind names read as the ledger's: the seed's engine runs see both) ── */
  const KIND_V2 = { limit: 'zone', hold: 'persistence', clear: 'clearing', onoff: 'enabled' };
  const kindOf = (t) => (t ? KIND_V2[t.kind] || t.kind : null);
  const recKept = (o) => (o.status ? o.status === 'active' : !o.endedAt);
  const recInForce = (o) => recKept(o) && !o.suspendedBy && !(o.expires != null && o.expires <= now());
  const findRecs = (key, pred, withSuspended) => (S() ? S().overrides.filter((o) => o.plant === key && o.target && (withSuspended ? recKept(o) : recInForce(o)) && pred(o.target, o)) : []);
  const zoneRec = (key, sid, dir, b, withSusp) => findRecs(key, (t) => kindOf(t) === 'zone' && t.sensorId === sid && (!t.dir || t.dir === dir) && t.band === b, withSusp)[0] || null;
  const readingRec = (key, sid, dir) => findRecs(key, (t) => t.kind === 'reading' && t.sensorId === sid && t.dir === dir)[0] || null;
  const trigLimitRecs = (key, alertId) => findRecs(key, (t) => t.kind === 'triggerLimit' && t.alertId === alertId);
  const timingRec = (key, alertId, kind) => findRecs(key, (t) => kindOf(t) === kind && t.alertId === alertId)[0] || null;
  const isRejected = (key, a) => { const st = PS(key) && PS(key).alerts[a.id]; return !!st && st.decided === 'rejected'; };
  const recChipSrc = (o, baseText) => ({ src: 'override', reason: o.reason, author: o.author, at: o.at, reviewBy: o.reviewBy, expires: o.expires, baseText, baseSource: o.baseSource });

  /* ── Zones: a sensor's limits, band by band, first match wins: Forced → Override → Derived → Library (or pinned) → Gap ── */
  function proposedTemplateId(key, e, reading, dir) { const t = tplsOf(ownerOfNode(key, e)).find((x) => x.kind === 'trigger' && x.reading === reading && x.dir === dir); return t ? t.id : null; }
  /* the template a sensor's zone in one direction follows: the one its Trigger is bound to, else the one its node's type proposes */
  function zoneTemplateId(key, s, dir, e) {
    const bound = dOf(key).alerts.filter((a) => a.sensor === s.id && _.alertDir(key, a) === dir);
    for (const a of bound) { if (isRejected(key, a)) continue; const tid = templateIdOfAlert(key, a); if (tid) return tid; }
    if (bound.length && bound.every((a) => isRejected(key, a))) return null;
    return proposedTemplateId(key, e, s.name, dir);
  }
  function zoneDirs(key, s) {
    const set = new Set(); const e = _.homeOf(key, s);
    tplsOf(ownerOfNode(key, e)).forEach((t) => { if (t.kind === 'trigger' && t.reading === s.name) set.add(t.dir); });
    dOf(key).alerts.forEach((a) => { if (a.sensor === s.id) set.add(_.alertDir(key, a)); });
    findRecs(key, (t) => t.sensorId === s.id && !!t.dir).forEach((o) => set.add(o.target.dir));
    return ['above', 'below'].filter((x) => set.has(x));
  }
  function applyDraft(body, dr) {
    if (!dr) return body; const b = clone(body);
    if (dr.rules) Object.keys(dr.rules).forEach((band) => { b.rules[band] = dr.rules[band] ? { ...dr.rules[band] } : null; });
    ['hold', 'clear', 'desc', 'statutory', 'runHours'].forEach((k) => { if (dr[k] !== undefined) b[k === 'runHours' ? 'meterHours' : k] = dr[k]; });
    if (dr.every !== undefined) b.every = dr.every ? { ...dr.every } : null;
    if (dr.condition && b.condition) { if (dr.condition.doWhen !== undefined) b.condition.doWhen = dr.condition.doWhen; if (dr.condition.doneWhen !== undefined) b.condition.doneWhen = dr.condition.doneWhen; }
    if (dr.merge) b.singleUse = null;
    return b;
  }
  function zoneInfo(key, sensorId, dir0, opts) {
    if (sensorId == null || String(sensorId).startsWith('m:') || !PS(key) || !dOf(key)) return null;
    const s = _.sensorRaw(key, sensorId); if (!s) return null;
    const dir = dir0 || _.primaryDir(key, sensorId); const draft = !!(opts && opts.draft);
    return cached(`kc:zone:${key}:${sensorId}:${dir}:${draft ? 1 : 0}`, () => zoneRaw(key, s, dir, draft));
  }
  function zoneRaw(key, s, dir, draft) {
    const e = _.homeOf(key, s); const nodeId = e ? e.id : null;
    const out = { sensorId: s.id, tag: s.tag, name: s.name, dir, unit: s.unit, kind: s.kind, nextPhase: !!s.nextPhase, nodeId, nodeTag: e ? e.tag : null, templateId: null, templateName: null, templateVersion: null, currentVersion: null, bound: false, proposed: false, pinnedTo: null, forced: null, bands: norm4(null), perBand: {}, triggers: [], constantFlag: {}, sample: true };
    if (s.nextPhase) { const c = chipOf({ src: 'next' }); BANDS.forEach((b) => { out.perBand[b] = { band: b, value: null, valueText: '—', source: 'next', chipKey: 'next', chip: c, chipText: c.text, tone: c.tone, rule: null, ruleText: null, resolved: null, libValue: null, baseValue: null, base: null, overrideId: null, needs: null }; out.constantFlag[b] = false; }); return out; }
    const tid = zoneTemplateId(key, s, dir, e); const cur = tid ? tplRaw(tid) : null;
    let body = tid ? tplBodyAt(key, tid) : null; if (draft && tid && L().drafts && L().drafts[tid]) body = applyDraft(cur, L().drafts[tid]);
    const pin = tid ? activePin(key, tid) : null; const fo = tid ? forcedOf(tid) : null; const rrec = readingRec(key, s.id, dir);
    const bound = dOf(key).alerts.some((a) => a.sensor === s.id && _.alertDir(key, a) === dir && !isRejected(key, a));
    Object.assign(out, { templateId: tid, templateName: cur ? cur.name : null, templateVersion: tid ? versionAt(key, tid) : null, currentVersion: cur ? cur.v : null, bound: !!tid && bound, proposed: !!tid && !bound, pinnedTo: pin ? pin.v : null, forced: fo ? { v: fo.v, changeId: fo.changeId } : null });
    BANDS.forEach((b) => {
      const rule = body && body.rules ? body.rules[b] || null : null; const res = rule ? resolveRule(key, rule, s, nodeId) : null;
      const resolved = res ? res.value : null;
      const rec = rrec ? null : zoneRec(key, s.id, dir, b); const kept = rrec ? null : zoneRec(key, s.id, dir, b, true);
      const forcedRule = fo && b === 'emergency' && fo.bands && fo.bands.emergency !== undefined ? fo.bands.emergency : undefined;
      const forcedV = forcedRule === undefined ? undefined : forcedRule && typeof forcedRule === 'object' ? (resolveRule(key, forcedRule, s, nodeId) || {}).value : forcedRule;
      let value; let source;
      if (forcedV !== undefined) { value = forcedV == null ? null : forcedV; source = 'forced'; }
      else if (rrec) { value = rrec.value && rrec.value[b] != null ? rrec.value[b] : null; source = 'override'; }
      else if (rec) { value = rec.value; source = 'override'; }
      else if (!body) { value = null; source = 'none'; }
      else if (!rule) { value = null; source = 'library'; }
      else if (res.source === 'gap') { value = null; source = 'gap'; }
      else { value = resolved; source = pin && cur && pin.v !== cur.v ? 'pinned' : res.source; }
      const oneDp = !!res && res.source === 'derived' && oneDpUnit(s.unit);
      const valueText = value == null ? 'none' : source === 'derived' && res && res.metres != null ? `${unitText(value, s.unit, s.kind)} (${res.metres.toFixed(1)} m)` : unitText(value, s.unit, s.kind, source === 'derived' && oneDpUnit(s.unit));
      const resolvedText = resolved == null ? (res && res.source === 'gap' ? 'no value' : 'no rule') : res.metres != null ? `${unitText(resolved, s.unit, s.kind)} (${res.metres.toFixed(1)} m)` : unitText(resolved, s.unit, s.kind, oneDp);
      const theRec = rec || rrec;
      const baseMoved = !!rec && rec.base !== undefined && !same(rec.base, resolved) && !(rec.base == null && resolved == null);
      let pinnedNext = null; let pinnedOneDp = false;
      if (pin && cur && pin.v !== cur.v) { const nr = cur.rules ? cur.rules[b] : null; const nres = nr ? resolveRule(key, nr, s, nodeId) : null; pinnedNext = nres ? nres.value : null; pinnedOneDp = !!nres && nres.source === 'derived' && oneDpUnit(s.unit); }
      let chipKey; let c;
      if (source === 'forced') { chipKey = 'forced'; c = chipOf({ src: 'forced', template: cur ? cur.name : '', v: fo.v }); }
      else if (source === 'override') { chipKey = baseMoved ? 'baseMoved' : 'override'; c = baseMoved ? chipOf({ src: 'basemoved', old: rec.base == null ? 'no value' : numText(rec.base, oneDp), new: resolved == null ? 'no value' : numText(resolved, oneDp) }) : chipOf(recChipSrc(theRec, resolved == null ? (res && res.source === 'gap' ? 'no value' : 'no rule') : resolvedText)); }
      else if (source === 'pinned') { chipKey = 'pinned'; c = chipOf({ src: 'pinned', v: pin.v, latest: cur.v, x: pinnedNext == null ? 'no value' : unitText(pinnedNext, s.unit, s.kind, pinnedOneDp) }); }
      else if (source === 'derived') { chipKey = 'derived'; c = chipOf({ src: 'derived', ruleText: res.ruleText, paramText: res.paramText }); }
      else if (source === 'library') { chipKey = 'library'; c = chipOf({ src: 'library', template: body.name, v: versionAt(key, tid) }); }
      else if (source === 'gap') { chipKey = 'gap'; c = chipOf({ src: 'gap', paramLabel: res.needs.label, tag: res.needs.tag }); }
      else { chipKey = 'none'; c = chipOf({ src: 'gap' }); }
      out.perBand[b] = { band: b, value, valueText, source, chipKey, chip: c, chipText: c.text, tone: c.tone, rule, ruleText: res ? res.ruleText : null, resolved, resolvedText, metres: res && res.metres != null ? res.metres : null, paramText: res ? res.paramText || null : null,
        base: theRec && theRec.base !== undefined ? theRec.base : null, baseSource: theRec ? theRec.baseSource || null : null, overrideId: theRec ? theRec.id : null, overrideReason: theRec ? theRec.reason : null,
        suspended: !!(kept && kept.suspendedBy), suspendedId: kept && kept.suspendedBy ? kept.id : null, baseMoved, pinnedTo: pin && cur && pin.v !== cur.v ? pin.v : null, pinnedNext,
        needs: res && res.needs ? res.needs : null, forced: source === 'forced', libValue: resolved, baseValue: resolved, constantFlag: !!body && constantFlagOf(body, b) };
      out.bands[b] = value; out.constantFlag[b] = out.perBand[b].constantFlag;
    });
    out.triggers = dOf(key).alerts.filter((a) => a.sensor === s.id && _.alertDir(key, a) === dir).map((a) => { const h = heldRaw(key, a.id); const open = openIssueIds(key, a.id).length; return { alertId: a.id, name: triggerName(key, a.id), state: V.alertState(key, a.id), follows: !trigLimitRecs(key, a.id).length, frozen: !!h && open > 0, held: !!h && !open, open }; });
    return out;
  }
  const limitsOf = (key, sensorId, dir) => zoneInfo(key, sensorId, dir);
  function zoneCheck(key, sensorId, dir, bands) {
    if (String(sensorId).startsWith('m:')) return MANUAL_ERR;
    const s = _.sensorRaw(key, sensorId); if (!s) return 'No such sensor.';
    if (s.nextPhase) return `${s.name} is read on a connection: next phase.`;
    if (s.kind === 'meter') return `${s.name} is a counter: it has no Zones.`;
    return _.validateBands(norm4(bands || {}), dir || _.primaryDir(key, sensorId), s);
  }
  /* v6's in-place limits follow the zones in force (the v6 layer and the forked pages still read them) */
  function syncZone(key, sensorId) {
    const s = _.sensorRaw(key, sensorId); if (!s || s.nextPhase || String(sensorId).startsWith('m:')) return; const d = dOf(key); touch();
    ['above', 'below'].forEach((dir) => {
      const z = zoneInfo(key, sensorId, dir); if (!z) return; const eff = { ...z.bands };
      const ad = d.alerts.filter((a) => a.sensor === sensorId && _.alertDir(key, a) === dir);
      ad.filter((a) => a.limits === 'custom').forEach((a) => { a.custom = { ...eff }; });
      if (ad.some((a) => a.limits === 'sensor') || s.direction === dir) { s.limits = { ...eff }; s.direction = dir; s.source = BANDS.some((b) => z.perBand[b].overrideId) ? 'custom' : BANDS.some((b) => z.perBand[b].source === 'derived') ? 'form' : 'library'; }
    });
    touch();
  }

  /* ── persistence, clearing, cadence and job thresholds ─────────────────────────────────────── */
  function timingOf(key, alertId, which0) {
    const which = which0 === 'persistence' ? 'hold' : which0 === 'clearing' ? 'clear' : which0;
    if (which !== 'hold' && which !== 'clear') return null;
    return cached(`kc:tm:${key}:${alertId}:${which}`, () => {
      const a = _.alertRaw(key, alertId); if (!a) return null; const tid = templateIdOfAlert(key, a); const body = tid ? tplBodyAt(key, tid) : null; const cur = tid ? tplRaw(tid) : null;
      const rec = timingRec(key, alertId, which === 'hold' ? 'persistence' : 'clearing'); const pin = tid ? activePin(key, tid) : null;
      const inPlace = which === 'hold' ? (a.holdMin != null ? a.holdMin : 5) : (a.closes && a.closes.holdMin != null ? a.closes.holdMin : 10);
      const resolved = body && body[which] != null ? body[which] : null;
      const source = rec ? 'override' : body ? (pin && cur && pin.v !== cur.v ? 'pinned' : 'library') : 'gap';
      const value = rec ? rec.value : resolved != null ? resolved : inPlace;
      const baseMoved = !!rec && rec.base !== undefined && !same(rec.base, resolved);
      const c = source === 'override' ? (baseMoved ? chipOf({ src: 'basemoved', old: rec.base == null ? 'no value' : String(rec.base), new: resolved == null ? 'no value' : `${resolved} min` }) : chipOf(recChipSrc(rec, resolved == null ? 'no value' : `${resolved} min`)))
        : source === 'pinned' ? chipOf({ src: 'pinned', v: pin.v, latest: cur.v, x: `${cur[which]} min` }) : source === 'library' ? chipOf({ src: 'library', template: body.name, v: versionAt(key, tid) }) : chipOf({ src: 'gap' });
      return { which, value, valueText: value == null ? 'no value' : `${value} min`, source, chipKey: rec ? (baseMoved ? 'baseMoved' : 'override') : source, chip: c, chipText: c.text, tone: c.tone, resolved, libValue: resolved, baseValue: resolved, base: rec && rec.base !== undefined ? rec.base : null, baseSource: rec ? rec.baseSource || null : null, overrideId: rec ? rec.id : null, baseMoved, templateId: tid, templateVersion: tid ? versionAt(key, tid) : null };
    });
  }
  /* a Task's answer in the survey that adds it ("Derived · from the survey: Screw Pump") */
  function surveyAnswerFor(key, sc) {
    const e = sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(key, sc.subject.id) : null; if (!e) return null; const f = formOf(key, e); if (!f) return null;
    const rules = (window.FORM_RULES || {})[e.dbType] || (window.FORM_RULES || {})[e.code] || [];
    const r = rules.find((x) => x.schedule && x.schedule.name === sc.name); if (!r || f[r.q] == null) return null; const v = String(f[r.q]).trim();
    return /^(yes|no)$/i.test(v) || formNum(v) != null && /^[0-9.\s]+$/.test(v) ? `${r.q} ${v}` : v;
  }
  function cadenceOf(key, scheduleId) {
    return cached(`kc:cad:${key}:${scheduleId}`, () => {
      const sc = _.schedRaw(key, scheduleId); if (!sc) return null;
      const rec = findRecs(key, (t) => t.kind === 'cadence' && t.scheduleId === scheduleId)[0] || null;
      const tid = templateIdOfSchedule(key, sc); const cur = tid ? tplRaw(tid) : null; const body = tid ? tplBodyAt(key, tid) : null; const pin = tid ? activePin(key, tid) : null;
      const e = sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(key, sc.subject.id) : null;
      let resolved = null; let source = 'gap'; let c = null; let derivedText = null;
      if (body) { resolved = C.cadenceOf(body); source = pin && cur && pin.v !== cur.v ? 'pinned' : 'library'; c = source === 'pinned' ? chipOf({ src: 'pinned', v: pin.v, latest: cur.v, x: _.everyText(C.cadenceOf(cur)) }) : chipOf({ src: 'library', template: body.name, v: versionAt(key, tid), singleUse: body.singleUse ? { plant: body.singleUse.plant } : null }); }
      else {
        const fv = _.formEveryForSched(key, sc);
        if (fv) { resolved = fv; source = 'derived'; const ans = surveyAnswerFor(key, sc); derivedText = `from the survey: ${ans || 'an answer'}`; c = chipOf({ src: 'derived', ruleText: derivedText }); }
        else if (sc.workType === 'calibration' && sc.probe) { resolved = { n: 1, unit: 'month' }; source = 'library'; const tn = e ? _.libKey(e) : dOf(key).plant.type; const ow = ownerOfNode(key, e); c = chipOf({ src: 'library', template: tn, v: ow ? typeVersion(ownerKey(ow)) : 1 }); }
        else c = chipOf({ src: 'gap' });
      }
      const value = rec ? rec.value : resolved || C.cadenceOf(sc);
      const baseMoved = !!rec && rec.base !== undefined && !_.sameEvery(rec.base, resolved);
      if (rec) c = baseMoved ? chipOf({ src: 'basemoved', old: _.everyText(rec.base), new: _.everyText(resolved) }) : chipOf(recChipSrc(rec, resolved ? _.everyText(resolved) : 'no value'));
      return { value, everyText: _.everyWith(sc, value), source: rec ? 'override' : source, chipKey: rec ? (baseMoved ? 'baseMoved' : 'override') : source, chip: c, chipText: c.text, tone: c.tone, resolved, libValue: resolved, baseValue: resolved, base: rec && rec.base !== undefined ? rec.base : null, baseSource: rec ? rec.baseSource || null : null, baseFrom: source === 'derived' ? 'form' : 'lib', derivedText, overrideId: rec ? rec.id : null, baseMoved, templateId: tid, templateVersion: tid ? versionAt(key, tid) : null, singleUse: body && body.singleUse ? { ...body.singleUse } : null };
    });
  }
  function conditionOf(key, workId) {
    return cached(`kc:cond:${key}:${workId}`, () => {
      const w = (dOf(key).conditionWork || []).find((x) => x.id === workId); if (!w) return null;
      const e = w.subject ? _.eqRaw(key, w.subject.id) : null; const s = _.sensorRaw(key, w.sensor) || null;
      const tid = templateIdOfWork(key, w); const body = tid ? tplBodyAt(key, tid) : null; const cond = body && body.condition ? body.condition : null;
      const out = { workId, name: w.name, nodeId: e ? e.id : null, tag: e ? e.tag : null, reading: s ? s.name : cond ? cond.reading : null, sensorId: w.sensor || null, unit: s ? s.unit : '', op: cond ? cond.op : 'above', templateId: tid, templateVersion: tid ? versionAt(key, tid) : null, perField: {} };
      ['doWhen', 'doneWhen'].forEach((which) => {
        const rule = cond ? cond[which] : null; const res = rule ? resolveRule(key, rule, s, e ? e.id : null) : null; const resolved = res ? res.value : null;
        const rec = findRecs(key, (t) => t.kind === 'condition' && t.workId === workId && t.which === which)[0] || null;
        const src = res ? res.source : 'gap'; const value = rec ? rec.value : resolved != null ? resolved : w[which] != null ? +w[which] : null;
        const oneDp = src === 'derived' && oneDpUnit(out.unit); const baseMoved = !!rec && rec.base !== undefined && !same(rec.base, resolved);
        const c = rec ? (baseMoved ? chipOf({ src: 'basemoved', old: numText(rec.base, oneDp), new: numText(resolved, oneDp) }) : chipOf(recChipSrc(rec, resolved == null ? 'no value' : unitText(resolved, out.unit, null, oneDp)))) : src === 'derived' ? chipOf({ src: 'derived', ruleText: res.ruleText, paramText: res.paramText }) : src === 'library' ? chipOf({ src: 'library', template: body.name, v: versionAt(key, tid) }) : src === 'gap' && res && res.needs ? chipOf({ src: 'gap', paramLabel: res.needs.label, tag: res.needs.tag }) : chipOf({ src: 'gap' });
        out.perField[which] = { which, value, valueText: unitText(value, out.unit, null, oneDp && !rec), resolved, resolvedText: resolved == null ? 'no value' : unitText(resolved, out.unit, null, oneDp), libValue: resolved, base: rec && rec.base !== undefined ? rec.base : null, baseSource: rec ? rec.baseSource || null : src === 'gap' ? 'gap' : src, src: rec ? 'override' : src, source: rec ? 'override' : src, rule, ruleText: res ? res.ruleText : null, chip: c, chipText: c.text, tone: c.tone, overrideId: rec ? rec.id : null, baseMoved, needs: res && res.needs ? res.needs : null };
        out[which] = value;
      });
      out.text = `Do when ${out.reading || 'the reading'} ${out.op} ${out.perField.doWhen.valueText} · done when ${out.op === 'above' ? 'below' : 'above'} ${out.perField.doneWhen.valueText}`;
      return out;
    });
  }
  /* the effective job thresholds go back into v6's job fields */
  function syncWork(key, workId) { const w = (dOf(key).conditionWork || []).find((x) => x.id === workId); if (!w) return; touch(); const co = conditionOf(key, workId); if (co) ['doWhen', 'doneWhen'].forEach((k) => { if (co[k] != null) w[k] = co[k]; }); touch(); }
  function sourceOf(key, target) {
    const t = target || {}; const k = kindOf(t);
    if (k === 'zone') { const z = zoneInfo(key, t.sensorId, t.dir); return z ? z.perBand[t.band] : null; }
    if (t.kind === 'reading') return zoneInfo(key, t.sensorId, t.dir);
    if (k === 'persistence') return timingOf(key, t.alertId, 'hold');
    if (k === 'clearing') return timingOf(key, t.alertId, 'clear');
    if (k === 'cadence') return cadenceOf(key, t.scheduleId);
    if (k === 'condition') { const co = conditionOf(key, t.workId); return co ? co.perField[t.which] : null; }
    if (k === 'triggerLimit') { const tb = triggerBands(key, t.alertId); return tb ? tb.bands[t.band] : null; }
    if (k === 'tier') return fnOf('tierInfo') ? V.tierInfo(key, t.eqId) : _.tierInfo(key, t.eqId);
    if (k === 'runhours') return _.runHoursInfo(key, t.scheduleId);
    if (k === 'enabled') { const off = findRecs(key, (x) => kindOf(x) === 'enabled' && ((t.alertId && x.alertId === t.alertId) || (t.scheduleId && x.scheduleId === t.scheduleId)))[0]; return { value: !off, chip: off ? chipOf(recChipSrc(off, 'On')) : { text: 'Library', tone: 'lib', sub: null, small: null }, overrideId: off ? off.id : null }; }
    return null;
  }

  /* ── Trigger terms (the engine, replays, previews and Issues read them here) ───────────────── */
  const heldRaw = (key, alertId) => (S() && S().held && S().held[key] ? S().held[key][alertId] || null : null);
  const openIssueIds = (key, alertId) => (PS(key) ? PS(key).issues.filter((i) => i.alertId === alertId && i.status !== 'closed').map((i) => i.id) : []);
  function forcedBandsFor(key, alertId, h) {
    if (!h || openIssueIds(key, alertId).length) return {};
    const tid = h.templateId || templateIdOfAlert(key, _.alertRaw(key, alertId)); const fo = forcedOf(tid); if (!fo || !fo.bands || fo.bands.emergency === undefined) return {};
    const a = _.alertRaw(key, alertId); const s = _.sensorRaw(key, a.sensor); const e = _.homeOf(key, s);
    const fr = fo.bands.emergency; const v = fr && typeof fr === 'object' ? (resolveRule(key, fr, s, e ? e.id : null) || {}).value : fr;
    return { emergency: v == null ? null : v };
  }
  function triggerTerms(key, alertId, opts) {
    const a = _.alertRaw(key, alertId); if (!a) return null; const s = _.sensorRaw(key, a.sensor); if (!s) return null;
    const o = opts || {}; const dir = _.alertDir(key, a); const h = o.live ? null : heldRaw(key, alertId); const tid = templateIdOfAlert(key, a);
    let bands; let hold; let clear; let forcedBands = [];
    if (h) {
      bands = { ...norm4(h.terms.bands) }; hold = h.terms.hold; clear = h.terms.clear;
      const fb = forcedBandsFor(key, alertId, h); Object.keys(fb).forEach((b) => { if (!same(bands[b], fb[b])) forcedBands.push(b); bands[b] = fb[b]; });
      if (Object.keys(fb).length) forcedBands = Object.keys(fb);
    } else {
      const z = zoneInfo(key, a.sensor, dir); bands = z ? { ...z.bands } : norm4(null);
      trigLimitRecs(key, alertId).forEach((r) => { bands[r.target.band] = r.value; });
      hold = (timingOf(key, alertId, 'hold') || {}).value; clear = (timingOf(key, alertId, 'clear') || {}).value;
    }
    if (o.limits) bands = norm4(o.limits); if (o.hold != null) hold = +o.hold; if (o.clear != null) clear = +o.clear;
    return { alertId, sensorId: a.sensor, dir: h && h.terms.dir ? h.terms.dir : dir, unit: s.unit, kind: s.kind, incl: s.kind === 'status', bands, hold, clear, gate: a.gate && a.gate.sensor ? { sensorId: a.gate.sensor, op: a.gate.op, value: a.gate.value } : null, held: !!h, forcedBands, templateId: tid, templateVersion: h ? h.templateVersion : tid ? versionAt(key, tid) : null };
  }
  /* the bands a Trigger page shows: what it runs on, where each band comes from, and what its sensor says now */
  function triggerBands(key, alertId) {
    const a = _.alertRaw(key, alertId); if (!a) return null; const s = _.sensorRaw(key, a.sensor) || {}; const dir = _.alertDir(key, a);
    const z = zoneInfo(key, a.sensor, dir); const h = heldRaw(key, alertId); const open = openIssueIds(key, alertId).length; const tm = triggerTerms(key, alertId);
    const own = {}; trigLimitRecs(key, alertId).forEach((r) => { own[r.target.band] = r; });
    const out = { alertId, sensorId: a.sensor, sensorTag: s.tag, dir, unit: s.unit, held: !!h, frozen: !!h && open > 0, waiting: !!h && !open, open, bands: {} };
    BANDS.forEach((b) => {
      const pb = z ? z.perBand[b] : null; const r = own[b] || null; const zoneNow = r ? r.value : pb ? pb.value : null; const v = tm.bands[b];
      const oneDp = !!pb && pb.source === 'derived' && oneDpUnit(s.unit);
      const zc = pb ? pb.chip : chipOf({ src: 'gap' });
      let c = r ? chipOf({ src: 'triggerOverride', reason: r.reason, sensorValueText: pb && pb.value != null ? unitText(pb.value, s.unit, s.kind, oneDp) : 'no value' }) : chipOf({ src: 'followsSensor', tag: s.tag, zoneText: zc.text });
      const moved = !!h && !same(v, zoneNow);
      const overlay = h ? (open ? chipOf({ src: 'frozen', n: open }) : moved ? chipOf({ src: 'held' }) : null) : null;
      out.bands[b] = { band: b, value: v, valueText: v == null ? 'none' : unitText(v, s.unit, s.kind, oneDp), chip: c, chipText: c.text, overlay, overlayText: overlay ? overlay.text : null, zone: pb, zoneNow, zoneNowText: zoneNow == null ? 'none' : unitText(zoneNow, s.unit, s.kind, oneDp), heldValue: h ? v : null, moved, follows: !r, overrideId: r ? r.id : null, href: `#/p/${key}/sensor/${a.sensor}?f=zone.${dir}.${b}`,
        nowText: moved ? `${s.tag} now ${zoneNow == null ? 'none' : numText(zoneNow, oneDp)} (${shortSource(pb, r)})` : null };
    });
    return out;
  }
  /* a value's source in a few words, for lines such as "DO-AT2 now 1.5 (Override · Tuning)" */
  function shortSource(pb, own) {
    if (own) return `Overridden for this Trigger · ${reasonLabel(own.reason)}`; if (!pb) return 'no rule';
    if (pb.source === 'override') return `Override · ${reasonLabel(pb.overrideReason)}`; if (pb.source === 'derived') return 'Derived'; if (pb.source === 'forced') return 'Forced'; if (pb.source === 'pinned') return `Pinned to v${pb.pinnedTo}`;
    return pb.chipText || 'Library';
  }
  function triggerName(key, alertId) {
    const a = _.alertRaw(key, alertId); if (!a) return '';
    const own = String(a.name || '').replace(/ — /g, ' · ');
    const tid = templateIdOfAlert(key, a); const t = tid ? tplRaw(tid) : null; const node = _.alertEq(key, a) || _.homeOf(key, _.sensorRaw(key, a.sensor));
    return t && node ? `${t.name} · ${node.tag}` : own;
  }

  /* ── the freeze: an open Issue holds its Trigger's terms; a Trigger whose terms moved waits for a resync ── */
  function holdTrigger(key, alertId, issue) {
    if (!S() || !alertId) return null; const H = S().held || (S().held = {}); const P = H[key] || (H[key] = {});
    const ex = P[alertId];
    if (ex) { if (issue && !ex.issueIds.includes(issue.id)) ex.issueIds.push(issue.id); ex.released = null; touch(); return ex; }
    const tm = issue && issue.terms && issue.terms.bands ? issue.terms : triggerTerms(key, alertId, { live: true });
    const tid = templateIdOfAlert(key, _.alertRaw(key, alertId));
    P[alertId] = { since: issue ? issue.opened : now(), issueIds: issue ? [issue.id] : [], terms: { dir: tm.dir, bands: norm4(tm.bands), hold: tm.hold, clear: tm.clear }, templateId: tid, templateVersion: tid ? versionAt(key, tid) : null, released: null, movedAt: null };
    touch(); return P[alertId];
  }
  function heldDiffs(key, alertId, h) {
    const a = _.alertRaw(key, alertId); const s = _.sensorRaw(key, a.sensor) || {}; const liveT = triggerTerms(key, alertId, { live: true }); const out = [];
    const z = zoneInfo(key, a.sensor, _.alertDir(key, a)); const own = {}; trigLimitRecs(key, alertId).forEach((r) => { own[r.target.band] = r; });
    BANDS.forEach((b) => {
      const from = h.terms.bands[b]; const to = liveT.bands[b]; if (same(from, to)) return;
      const pb = z ? z.perBand[b] : null; const oneDp = !!pb && pb.source === 'derived' && oneDpUnit(s.unit);
      const srcText = shortSource(pb, own[b]);
      const pair = pairNum(from, to, s.unit, s.kind, oneDp);
      out.push({ what: 'band', band: b, from, to, source: srcText, text: `${BAND_LABEL[b]} ${dirWord(h.terms.dir)} ${pair}`, line: `${BAND_LABEL[b]} ${dirWord(h.terms.dir)} ${pair} (${srcText})` });
    });
    if (!same(h.terms.hold, liveT.hold)) out.push({ what: 'hold', from: h.terms.hold, to: liveT.hold, text: `persistence ${h.terms.hold} → ${liveT.hold} min`, line: `persistence ${h.terms.hold} → ${liveT.hold} min` });
    if (!same(h.terms.clear, liveT.clear)) out.push({ what: 'clear', from: h.terms.clear, to: liveT.clear, text: `clearing ${h.terms.clear} → ${liveT.clear} min`, line: `clearing ${h.terms.clear} → ${liveT.clear} min` });
    const tid = h.templateId || liveT.templateId; const vNow = tid ? versionAt(key, tid) : null;
    if (tid && h.templateVersion != null && vNow != null && vNow !== h.templateVersion) out.push({ what: 'version', from: h.templateVersion, to: vNow, text: `Template v${h.templateVersion} → v${vNow}`, line: `Template v${h.templateVersion} → v${vNow}` });
    return out;
  }
  function releaseHeld(key, alertId, at) {
    const h = heldRaw(key, alertId); if (!h) return null;
    if (openIssueIds(key, alertId).length) return h;
    touch(); const diffs = heldDiffs(key, alertId, h);
    if (!diffs.length) { delete S().held[key][alertId]; if (!Object.keys(S().held[key]).length) delete S().held[key]; touch(); return null; }
    h.released = at != null ? at : now(); if (h.movedAt == null) h.movedAt = h.released; touch(); return h;
  }
  const isFrozen = (key, alertId) => !!heldRaw(key, alertId) && openIssueIds(key, alertId).length > 0;
  function heldOf(key, alertId) {
    const h = heldRaw(key, alertId); const open = openIssueIds(key, alertId);
    if (!h) return { held: false, frozen: false, waiting: false, openIssueIds: open, since: null, terms: null, diffs: [], forcedBands: [], templateVersion: null, currentVersion: null };
    const tid = h.templateId || templateIdOfAlert(key, _.alertRaw(key, alertId)); const fb = Object.keys(forcedBandsFor(key, alertId, h));
    return { held: true, frozen: open.length > 0, waiting: !open.length, openIssueIds: open, since: h.since, released: h.released, movedAt: h.movedAt, terms: clone(h.terms), diffs: heldDiffs(key, alertId, h), forcedBands: fb, templateId: tid, templateVersion: h.templateVersion, currentVersion: tid ? versionAt(key, tid) : null };
  }
  /* what a change touches among held Triggers: they learn that their base moved (they keep their terms) */
  function heldAffected(key, t) {
    const H = S() && S().held && S().held[key]; if (!H) return []; const ids = Object.keys(H); const tt = t || {}; const k = kindOf(tt);
    if (k === 'zone' || tt.kind === 'reading' || tt.kind === 'sensor') return ids.filter((id) => { const a = _.alertRaw(key, id); return a && a.sensor === tt.sensorId && (!tt.dir || _.alertDir(key, a) === tt.dir); });
    if (tt.alertId) return ids.filter((id) => id === tt.alertId);
    if (tt.kind === 'template') return ids.filter((id) => (H[id].templateId || templateIdOfAlert(key, _.alertRaw(key, id))) === tt.templateId);
    if (tt.kind === 'param') { const sids = new Set(tt.sensorIds || []); return ids.filter((id) => { const a = _.alertRaw(key, id); return a && sids.has(a.sensor); }); }
    return [];
  }
  function markMoved(key, t) { const ids = heldAffected(key, t); ids.forEach((id) => { const h = heldRaw(key, id); if (h && h.movedAt == null) h.movedAt = now(); }); if (ids.length) touch(); return ids; }
  function lastDays(key, alertId, terms) {
    const to = now(); const from = to - 7 * DAY;
    const n = safe(() => V.replay(key, alertId, { from, to, limits: terms.bands, hold: terms.hold, clear: terms.clear }), null); const m = safe(() => V.replay(key, alertId, { from, to }), null);
    return { count: n ? n.count : 0, countNow: m ? m.count : 0, from, to, sample: true };
  }
  function resyncPreview(key, alertId) {
    const a = _.alertRaw(key, alertId); if (!a) return { ok: false, error: 'No such Trigger.' };
    const h = heldRaw(key, alertId); const name = triggerName(key, alertId);
    if (!h) return { ok: false, error: `${name} already follows its sensor.` };
    if (openIssueIds(key, alertId).length) return { ok: false, error: 'Resync after the Issue closes.' };
    const liveT = triggerTerms(key, alertId, { live: true }); const diffs = heldDiffs(key, alertId, h); const ld = lastDays(key, alertId, liveT);
    return { ok: true, title: `Resync ${name}?`, diffs, lines: diffs.map((x) => x.line), lastDays: ld, lastDaysText: `Last 7 days with these terms: would have fired ${ld.count} ${ld.count === 1 ? 'time' : 'times'} (now ${ld.countNow}).` };
  }
  function resync(key, alertId) {
    const pv = resyncPreview(key, alertId); if (!pv.ok) return pv;
    const a = _.alertRaw(key, alertId); const s = _.sensorRaw(key, a.sensor) || {}; const name = triggerName(key, alertId); const tid = templateIdOfAlert(key, a);
    delete S().held[key][alertId]; if (!Object.keys(S().held[key]).length) delete S().held[key];
    const P = PS(key); if (P && P.eng) P.eng[alertId] = _.newTracker();
    touch(); const t = tid ? tplRaw(tid) : null; const v = tid ? versionAt(key, tid) : null;
    const bits = pv.diffs.filter((x) => x.what !== 'version').map((x) => x.text);
    act(now(), key, `Resynced ${name} with ${s.tag || s.name}: ${bits.length ? bits.join(', ') : 'nothing else changed'}; now on ${t ? `${t.name} v${v}` : 'its template'}`, 'config');
    touch(); _.persist(); return { ok: true, toast: `Resynced ${name} · now follows ${s.tag || s.name}`, diffs: pv.diffs };
  }

  /* ── design parameters: the table on Details, the preview before saving, the one writer ────── */
  const nodeIdOf = (objRef) => (!objRef ? null : typeof objRef === 'string' ? objRef : objRef.kind === 'plant' ? 'plant' : objRef.id || null);
  function nodeSensors(key, nid) { return dOf(key).sensors.filter((s) => s.on === `eq:${nid}` && !s.nextPhase && s.kind !== 'meter' && s.kind !== 'status'); }
  /* the parameters the templates on a node use, with the readings that use them */
  function paramUse(key, nid) {
    const out = {}; const add = (pk, x) => { (out[pk] || (out[pk] = [])).push(x); };
    nodeSensors(key, nid).forEach((s) => zoneDirs(key, s).forEach((dir) => { const z = zoneInfo(key, s.id, dir); if (!z) return; BANDS.forEach((b) => { const r = z.perBand[b].rule; if (r && r.kind === 'expr') { const x = { sensorId: s.id, tag: s.tag, dir, band: b, templateId: z.templateId, text: `${s.name} limits on ${s.tag}` }; add(r.param, x); if (r.param === 'fullLoadCurrent') add('motorRating', x); } }); }));
    (dOf(key).conditionWork || []).filter((w) => w.subject && w.subject.id === nid).forEach((w) => { const co = conditionOf(key, w.id); if (!co) return; ['doWhen', 'doneWhen'].forEach((k) => { const r = co.perField[k].rule; if (r && r.kind === 'expr') { const x = { workId: w.id, which: k, text: `${w.name} on ${co.tag}` }; add(r.param, x); if (r.param === 'fullLoadCurrent') add('motorRating', x); } }); });
    return out;
  }
  function paramRow(key, nid, pk, def, use) {
    const pv = paramValue(key, nid, pk); const e = nid === 'plant' ? null : _.eqRaw(key, nid); const ub = use[pk] || [];
    const source = pv ? pv.source : 'gap';
    const chipText = source === 'survey' ? 'Survey' : source === 'person' ? `Person · ${pv.by === ME ? 'you' : pv.by || 'not recorded'} · ${dMon(pv.at)}` : source === 'derived' ? `Derived · ${pv.how}` : 'Gap · needs a value';
    const oneDp = def.unit === 'A' || (pk === 'tankHeight' && pv && pv.source !== 'person');
    const valueText = pv && pv.value != null ? `${pk === 'tankHeight' ? pv.value.toFixed(1) : def.unit === 'A' ? numText(pv.value, true) : plainNum(pv.value)} ${def.unit}` : '—';
    const texts = [...new Set(ub.map((x) => x.text))];
    return { key: pk, label: def.group && def.group !== def.label ? `${def.group} · ${def.label}` : def.label, unit: def.unit, value: pv ? pv.value : null, valueText, source, chip: { text: chipText, tone: source === 'derived' ? 'der' : source === 'gap' ? 'gap' : source === 'person' ? 'ovr' : 'lib' }, chipText, surveyValue: pv && pv.surveyValue != null ? pv.surveyValue : null, surveyText: pv && pv.surveyValue != null ? `The survey says ${plainNum(pv.surveyValue)} ${def.unit}` : null, by: pv ? pv.by || null : null, at: pv ? pv.at || null : null, note: pv ? pv.note || '' : '', usedBy: ub, usedByText: nid === 'plant' ? 'Used by no limit rule yet' : texts.length ? texts.join(', ') : '—', editable: !def.derive || pk === 'tankVolume', action: pv && pv.value != null ? 'Edit' : 'Add', field: `dp.${pk}`, tag: e ? e.tag : null, oneDp };
  }
  function designParams(key, objRef) {
    const nid = nodeIdOf(objRef); if (!nid || !PS(key)) return [];
    return cached(`kc:dps:${key}:${nid}`, () => {
      if (nid === 'plant') return Object.keys(PLANT_PARAMS).map((pk) => paramRow(key, nid, pk, PLANT_PARAMS[pk], {}));
      const e = _.eqRaw(key, nid); if (!e) return []; const use = paramUse(key, nid); const rows = [];
      Object.keys(PARAMS).forEach((pk) => { const pv = paramValue(key, nid, pk); if (!pv && !(use[pk] || []).length) return; rows.push(paramRow(key, nid, pk, PARAMS[pk], use)); });
      const mapped = new Set(Object.values(PARAMS).flatMap((d) => d.survey || []));
      const f = formOf(key, e) || {}; Object.keys(f).forEach((q) => { if (mapped.has(q)) return; const n = formNum(f[q]); if (n == null || !/^[\s0-9.]+[a-zA-Z³/ ]*$/.test(String(f[q]))) return; rows.push({ key: `survey:${q}`, label: q, unit: '', value: n, valueText: String(f[q]), source: 'survey', chip: { text: 'Survey', tone: 'lib' }, chipText: 'Survey', surveyValue: n, surveyText: null, usedBy: [], usedByText: '—', editable: false, action: null, field: null, tag: e.tag }); });
      return rows;
    });
  }
  function paramCheck(key, nid, pk, value) {
    const def = PARAMS[pk] || PLANT_PARAMS[pk]; if (!def) return 'No such design parameter.';
    if (pk === 'fullLoadCurrent') return 'Full-load current is worked out from the motor rating: set the motor rating instead.';
    if (nid !== 'plant' && !_.eqRaw(key, nid)) return 'No such equipment.';
    if (value == null || value === '') return null;
    const n = +value; if (!Number.isFinite(n) || n <= 0) return 'Give a positive number.';
    if (def.max != null && n > def.max) return `${def.label} must be ${numText(def.max)} ${def.unit} or less.`;
    return null;
  }
  function writeParam(key, nid, pk, value, meta) {
    const P = S().params || (S().params = {}); const pp = P[key] || (P[key] = {}); const node = pp[nid] || (pp[nid] = {});
    if (value == null || value === '') delete node[pk];
    else { const def = PARAMS[pk] || PLANT_PARAMS[pk]; const e = nid === 'plant' ? null : _.eqRaw(key, nid); const sv = e ? surveyParam(key, e, pk) : null; node[pk] = { value: +value, unit: def.unit, by: meta.by, at: meta.at, note: meta.note || '', surveyValue: sv ? sv.value : null }; }
    if (!Object.keys(node).length) delete pp[nid]; if (!Object.keys(pp).length) delete P[key]; touch();
  }
  /* everything on a node that a parameter can move: each zone band's base and value, and each job threshold */
  function snapNode(key, nid) {
    const zones = {}; const works = {};
    if (nid !== 'plant') {
      nodeSensors(key, nid).forEach((s) => zoneDirs(key, s).forEach((dir) => { const z = zoneInfo(key, s.id, dir); if (!z) return; zones[`${s.id}|${dir}`] = { sensorId: s.id, tag: s.tag, name: s.name, unit: s.unit, kind: s.kind, dir, any: BANDS.some((b) => z.bands[b] != null), bands: Object.fromEntries(BANDS.map((b) => [b, { resolved: z.perBand[b].resolved, metres: z.perBand[b].metres, value: z.perBand[b].value, overrideId: z.perBand[b].overrideId, source: z.perBand[b].source, derived: z.perBand[b].source === 'derived' || (z.perBand[b].rule && z.perBand[b].rule.kind === 'expr') }])) }; }));
      (dOf(key).conditionWork || []).filter((w) => w.subject && w.subject.id === nid).forEach((w) => { const co = conditionOf(key, w.id); if (co) works[w.id] = { workId: w.id, name: w.name, tag: co.tag, unit: co.unit, fields: Object.fromEntries(['doWhen', 'doneWhen'].map((k) => [k, { resolved: co.perField[k].resolved, value: co.perField[k].value, overrideId: co.perField[k].overrideId }])) }; });
    }
    return { zones, works };
  }
  function diffNode(key, nid, before, after) {
    const zones = []; const overrides = []; const conds = []; let gapsCleared = 0; let gapsMade = 0; const changedSensors = new Set(); const lines = [];
    Object.keys(after.zones).forEach((k) => {
      const A = before.zones[k] || { any: false, bands: {} }; const B = after.zones[k]; const oneDp = oneDpUnit(B.unit); const bits = []; const ovBits = [];
      BANDS.forEach((b) => {
        const x = A.bands[b] || {}; const y = B.bands[b] || {}; if (same(x.resolved, y.resolved)) return; changedSensors.add(B.sensorId);
        const tx = (v, m) => (v == null ? 'none' : m != null ? `${unitText(v, B.unit, B.kind)} (${m.toFixed(1)} m)` : unitText(v, B.unit, B.kind, oneDp));
        if (y.overrideId) { const rec = S().overrides.find((o) => o.id === y.overrideId); overrides.push({ ovId: y.overrideId, sensorId: B.sensorId, tag: B.tag, dir: B.dir, band: b, what: `${B.tag} · ${BAND_LABEL[b]} zone`, keeps: rec ? rec.value : y.value, keepsText: rec && rec.value != null ? unitText(rec.value, B.unit, B.kind) : 'no value', baseFrom: x.resolved, baseTo: y.resolved, baseFromText: numText(x.resolved, oneDp), baseToText: unitText(y.resolved, B.unit, B.kind, oneDp) }); ovBits.push(overrides[overrides.length - 1]); }
        else { zones.push({ sensorId: B.sensorId, tag: B.tag, dir: B.dir, band: b, from: x.resolved, to: y.resolved, fromText: tx(x.resolved, x.metres), toText: tx(y.resolved, y.metres) }); bits.push(`${BAND_LABEL[b]} ${tx(x.resolved, x.metres)} → ${tx(y.resolved, y.metres)}`); }
      });
      if (bits.length) lines.push(`${B.tag}: ${bits.join(' · ')}`);
      if (ovBits.length) lines.push(ovBits.map((o, i) => (i === 0 ? `${o.tag} keeps ${o.keepsText} (Override): base moved ${o.baseFromText} → ${o.baseToText}` : `${BAND_LABEL[o.band]} keeps ${o.keepsText}: base moved ${o.baseFromText} → ${o.baseToText}`)).join(' · '));
      if (!A.any && B.any) gapsCleared++; if (A.any && !B.any) gapsMade++;
    });
    Object.keys(after.works).forEach((k) => {
      const A = before.works[k]; const B = after.works[k]; if (!A) return; const ch = ['doWhen', 'doneWhen'].filter((f) => !same(A.fields[f].resolved, B.fields[f].resolved)); if (!ch.length) return;
      const ov = ch.filter((f) => B.fields[f].overrideId);
      ch.forEach((f) => { const x = A.fields[f]; const y = B.fields[f]; const rec = y.overrideId ? S().overrides.find((o) => o.id === y.overrideId) : null; const item = { workId: B.workId, which: f, from: x.resolved, to: y.resolved, ovId: y.overrideId || null, keeps: rec ? rec.value : null }; conds.push(item); if (rec) overrides.push({ ovId: rec.id, workId: B.workId, which: f, what: `${B.name} on ${B.tag} · ${f === 'doWhen' ? 'do when' : 'done when'}`, keeps: rec.value, keepsText: unitText(rec.value, B.unit), baseFrom: x.resolved, baseTo: y.resolved, baseFromText: numText(x.resolved, true), baseToText: unitText(y.resolved, B.unit, null, true) }); });
      if (ov.length === ch.length) lines.push(`${B.name} on ${B.tag} keeps ${ch.map((f) => unitText(A.fields[f].value, B.unit)).join(' / ')} (Override): base moved ${ch.map((f) => `${numText(A.fields[f].resolved, true)} → ${unitText(B.fields[f].resolved, B.unit, null, true)}`).join(' / ')}`);
      else lines.push(`${B.name} on ${B.tag}: ${ch.map((f) => `${f === 'doWhen' ? 'do when' : 'done when'} ${numText(A.fields[f].resolved, true)} → ${unitText(B.fields[f].resolved, B.unit, null, true)}`).join(' · ')}`);
    });
    const triggers = [];
    dOf(key).alerts.filter((a) => changedSensors.has(a.sensor)).forEach((a) => { const h = heldRaw(key, a.id); const s = _.sensorRaw(key, a.sensor) || {}; const nm = triggerName(key, a.id); triggers.push({ alertId: a.id, name: nm, frozen: !!h, follows: !h }); lines.push(h ? `${nm}: frozen, will show Base moved` : `${nm} follows ${s.tag}`); });
    if (gapsCleared) lines.push(`${plural(gapsCleared, 'gap')} resolved`); if (gapsMade) lines.push(`${plural(gapsMade, 'gap')} made: ${gapsMade === 1 ? 'a reading' : 'readings'} will raise nothing`);
    return { zones, overrides, conditions: conds, gapsCleared, gapsMade, triggers, changedSensors: [...changedSensors], reResolved: changedSensors.size, lines, text: lines.join(' · ') };
  }
  function designParamPreview(key, objRef, pk, value) {
    const nid = nodeIdOf(objRef); const err = paramCheck(key, nid, pk, value); if (err) return { ok: false, error: err };
    const before = snapNode(key, nid);
    const after = _.dryRun(key, () => { writeParam(key, nid, pk, value, { by: ME, at: now(), note: '' }); touch(); return snapNode(key, nid); });
    touch(); return { ok: true, ...diffNode(key, nid, before, after), sample: false };
  }
  function setDesignParam(key, objRef, pk, value, opts) {
    const o = opts || {}; const nid = nodeIdOf(objRef); const err = paramCheck(key, nid, pk, value); if (err) return { ok: false, error: err, field: 'value' };
    const def = PARAMS[pk] || PLANT_PARAMS[pk]; const e = nid === 'plant' ? null : _.eqRaw(key, nid); const sv = e ? surveyParam(key, e, pk) : null;
    const cleared = value == null || value === ''; const pv0 = paramValue(key, nid, pk);
    if (!cleared && sv && !same(+value, sv.value) && !String(o.note || '').trim()) return { ok: false, error: 'Say why this differs from the survey.', field: 'note' };
    if (!cleared && pv0 && same(+value, pv0.value) && pv0.source === 'person') return { ok: true, changed: false };
    const pre = designParamPreview(key, objRef, pk, value);
    const prev = clone(personParams(key, nid)[pk] || null); const t = now();
    writeParam(key, nid, pk, value, { by: ME, at: t, note: String(o.note || '').trim() });
    afterParamChange(key, nid, pre);
    const pv1 = paramValue(key, nid, pk); const tag = e ? e.tag : plantName(key);
    const fromT = pv0 && pv0.value != null ? `${pk === 'tankHeight' ? pv0.value.toFixed(1) : plainNum(pv0.value)} ${def.unit}` : 'none'; const toT = pv1 && pv1.value != null ? `${pk === 'tankHeight' ? pv1.value.toFixed(1) : plainNum(pv1.value)} ${def.unit}` : 'none';
    const fromN = pv0 && pv0.value != null ? (pk === 'tankHeight' ? pv0.value.toFixed(1) : plainNum(pv0.value)) : 'none';
    const tail = pre.gapsCleared ? ` (${plural(pre.gapsCleared, 'reading')} resolved)` : pre.reResolved ? ` (${plural(pre.reResolved, 'reading')} re-resolved)` : '';
    act(t, key, `Design parameter on ${tag}: ${lowerParam(pk) || def.label.toLowerCase()} ${fromN === 'none' ? 'none' : fromN} → ${toT}${tail}${o.note ? `: ${String(o.note).trim()}` : ''}`, 'config');
    const token = _.counterId('useq', 'u'); const U = S().paramUndo || (S().paramUndo = []);
    U.push({ token, plant: key, nodeId: nid, param: pk, prev, next: clone(personParams(key, nid)[pk] || null), at: t }); while (U.length > 20) U.shift();
    touch(); _.persist();
    return { ok: true, changed: true, preview: pre, token, from: fromT, to: toT, toast: `${def.label} ${toT} saved on ${tag}${pre.reResolved ? ` · ${plural(pre.reResolved, 'reading')} re-resolved` : ''}` };
  }
  /* after a parameter moved: overrides that now equal their base clear, held Triggers learn their base moved, v6 follows */
  function afterParamChange(key, nid, pre) {
    const sids = new Set(pre && pre.changedSensors ? pre.changedSensors : []); const wids = new Set(pre && pre.conditions ? pre.conditions.map((x) => x.workId) : []);
    touch();
    const f = fnOf('ledgerOnBaseChange'); if (f && (sids.size || wids.size)) safe(() => f({ plant: key, kind: 'derived', match: (t) => (kindOf(t) === 'zone' && sids.has(t.sensorId)) || (t.kind === 'condition' && wids.has(t.workId)), owner: 'a design parameter', changeId: null }));
    markMoved(key, { kind: 'param', nodeId: nid, sensorIds: [...sids] });
    sids.forEach((sid) => syncZone(key, sid)); wids.forEach((wid) => syncWork(key, wid));
    touch();
  }
  function canUndoDesignParam(key, token) {
    const U = (S() && S().paramUndo) || []; const u = U.find((x) => x.token === token && x.plant === key); if (!u) return false;
    const cur = personParams(key, u.nodeId)[u.param] || null; return JSON.stringify(cur) === JSON.stringify(u.next);
  }
  function undoDesignParam(key, token) {
    if (!canUndoDesignParam(key, token)) return { ok: false, error: 'This change can no longer be undone.' };
    const U = S().paramUndo; const i = U.findIndex((x) => x.token === token); const u = U[i]; const def = PARAMS[u.param] || PLANT_PARAMS[u.param];
    const pre = designParamPreview(key, u.nodeId, u.param, u.prev ? u.prev.value : null);
    const P = S().params || (S().params = {}); const pp = P[key] || (P[key] = {}); const node = pp[u.nodeId] || (pp[u.nodeId] = {});
    if (u.prev) node[u.param] = clone(u.prev); else delete node[u.param]; if (!Object.keys(node).length) delete pp[u.nodeId]; if (!Object.keys(pp).length) delete P[key];
    U.splice(i, 1); afterParamChange(key, u.nodeId, pre.ok ? pre : null);
    const e = u.nodeId === 'plant' ? null : _.eqRaw(key, u.nodeId);
    act(now(), key, `Undone: design parameter on ${e ? e.tag : plantName(key)}: ${lowerParam(u.param)} back to ${u.prev ? `${plainNum(u.prev.value)} ${def.unit}` : 'the survey value'}`, 'config');
    touch(); _.persist(); return { ok: true, toast: `Undone: ${def.label} on ${e ? e.tag : plantName(key)}` };
  }

  /* ── gaps and readings ─────────────────────────────────────────────────────────────────────── */
  /* readings whose zones resolve to nothing in any band once overrides are laid over; listed once the plant's bindings are
     proposed (its structure pass confirmed) or it is Live */
  function limitGaps(key) {
    return cached(`kc:gaps:${key}`, () => {
      const P = PS(key); const d = dOf(key); if (!P || !d) return [];
      const proposed = P.state === 'live' || (fnOf('structureDone') ? !!safe(() => V.structureDone(key), false) : true); if (!proposed) return [];
      const out = [];
      d.sensors.forEach((s) => {
        if (s.nextPhase || s.kind === 'status' || s.kind === 'meter') return; const e = _.homeOf(key, s); if (!e) return;
        let any = false; let needs = null;
        zoneDirs(key, s).forEach((dir) => { const z = zoneInfo(key, s.id, dir); if (!z) return; BANDS.forEach((b) => { const pb = z.perBand[b]; if (pb.value != null) any = true; if (!needs && pb.needs) needs = pb.needs; }); });
        if (any) return; const route = nodeRoute(key, e.id);
        out.push(needs ? { sensorId: s.id, tag: s.tag, name: s.name, nodeId: e.id, nodeTag: e.tag, eqId: e.id, eqTag: e.tag, why: 'param', param: needs.param, label: needs.label, text: `needs ${needs.label} (${e.tag})`, link: `#/p/${key}/${route}/${e.id}/details?f=dp.${needs.param}` }
          : { sensorId: s.id, tag: s.tag, name: s.name, nodeId: e.id, nodeTag: e.tag, eqId: e.id, eqTag: e.tag, why: 'norule', param: null, label: null, text: 'no rule', link: `#/p/${key}/sensor/${s.id}` });
      });
      return out;
    });
  }
  const designParamsMissing = (key) => limitGaps(key).filter((g) => g.why === 'param');
  function upsOf(key, nid) {
    if (!nid) return []; if (isUpNode(key, nid)) { const e = _.eqRaw(key, nid); return [{ id: nid, tag: e ? e.tag : nid }]; }
    const m = fnOf('membershipOf') ? safe(() => V.membershipOf(key, nid), null) : null; return m && m.participatesIn ? m.participatesIn.map((x) => ({ id: x.upId, tag: x.tag })) : [];
  }
  const bandsText = (bands, dir, unit, kind) => BANDS.filter((b) => bands && bands[b] != null).map((b) => `${BAND_LABEL[b]} ${dirWord(dir)} ${unitText(bands[b], unit, kind)}`).join(' · ');
  /* plant-graph sensors only: hand tests keep their numbers in the task record */
  function readings(key, opts) {
    const o = opts || {}; const nid = o.upId || o.eqId || null;
    const list = safe(() => V.sensors(key, nid || undefined), []) || [];
    return list.filter((s) => !String(s.id).startsWith('m:')).map((s) => {
      const dirs = s.kind === 'meter' || s.nextPhase ? [] : zoneDirs(key, _.sensorRaw(key, s.id));
      const zs = dirs.map((dir) => zoneInfo(key, s.id, dir)).filter(Boolean);
      return { ...s, sensorId: s.id, nodeId: s.eqId, ups: upsOf(key, s.eqId), triggers: (s.alertIds || []).length, zoneText: zs.map((z) => bandsText(z.bands, z.dir, s.unit, s.kind)).filter(Boolean).join(' · ') };
    });
  }
  function readingsTab(key) {
    return cached(`kc:rtab:${key}`, () => {
      const P = PS(key); const d = dOf(key); if (!P || !d) return null; const groups = [];
      d.equipment.forEach((e) => {
        const ss = d.sensors.filter((s) => s.on === `eq:${e.id}`); if (!ss.length) return; const ups = upsOf(key, e.id);
        const rows = ss.map((s) => {
          const dirs = s.kind === 'meter' || s.nextPhase ? [] : zoneDirs(key, s); const zs = dirs.map((dir) => zoneInfo(key, s.id, dir)).filter(Boolean);
          const chips = []; const seen = new Set(); zs.forEach((z) => BANDS.forEach((b) => { const pb = z.perBand[b]; if (pb.value == null && pb.source !== 'gap' && pb.source !== 'none') return; if (seen.has(pb.chipText)) return; seen.add(pb.chipText); chips.push(pb.chip); }));
          if (s.nextPhase && !chips.length) chips.push(chipOf({ src: 'next' }));
          const l = s.nextPhase || s.kind === 'meter' ? null : _.latest(key, s.id); const n = d.alerts.filter((a) => a.sensor === s.id).length;
          return { sensorId: s.id, id: s.id, tag: s.tag, name: s.name, unit: s.unit, kind: s.kind, nextPhase: !!s.nextPhase, latest: l, nowText: l ? unitText(l.v, s.unit, s.kind) : '—', dirs: zs.map((z) => ({ dir: z.dir, bands: { ...z.bands }, text: bandsText(z.bands, z.dir, s.unit, s.kind) })), limitsText: zs.map((z) => bandsText(z.bands, z.dir, s.unit, s.kind)).filter(Boolean).join(' · '), chips, triggers: n, triggerText: `${n} · Edit on sensor`, href: `#/p/${key}/sensor/${s.id}`, sample: true };
        });
        groups.push({ nodeId: e.id, tag: e.tag, name: e.name, kind: isUpNode(key, e.id) ? 'up' : 'eq', ups, upsText: ups.length ? `In ${ups.map((u) => u.tag).join(', ')}` : '', rows });
      });
      return { available: P.state === 'live', plant: key, groups, rows: groups.reduce((n, g) => n + g.rows.length, 0), sample: true };
    });
  }
  /* each proposal of the bindings pass with its template, version, values and source chips (the pass itself is the
     commissioning file's) */
  function bindingProposals(key) {
    return cached(`kc:bp:${key}`, () => {
      const rows = safe(() => _.libraryReview(key), []) || []; const out = [];
      rows.forEach((r) => r.proposals.forEach((p) => {
        const e = r.eqId === 'plant' ? null : _.eqRaw(key, r.eqId); const subj = r.eqId === 'plant' ? { kind: 'plant', id: key, tag: null } : { kind: nodeRoute(key, r.eqId), id: r.eqId, tag: r.tag };
        const v = { pid: p.pid, kind: p.kind, outcome: p.kind === 'alert' ? 'Issue' : 'Task', name: p.name, eqId: r.eqId, tag: p.tag, subject: subj, templateId: null, v: null, reads: null, values: [], valuesText: '', timing: null, cadence: null, resolve: 'ok', needs: null, blockedBy: null, blockedText: p.blockedBy || null, nextPhase: !!p.nextPhase, decided: p.decided || null, detail: p.detail || '' };
        if (p.blockedBy) v.blockedBy = p.nextPhase ? { kind: 'nextPhase' } : { kind: 'needsSensor', reading: p.reading || ((/^No (.+?) sensor/.exec(p.blockedBy) || [])[1]) || null, text: p.blockedBy };
        if (p.kind === 'alert' && e) {
          const s = p.sensorId ? _.sensorRaw(key, p.sensorId) : null; const dir = p.dir || 'above';
          v.templateId = s ? (zoneInfo(key, s.id, dir) || {}).templateId || proposedTemplateId(key, e, p.reading, dir) : proposedTemplateId(key, e, p.reading, dir);
          if (s && !p.blockedBy) {
            const z = zoneInfo(key, s.id, dir); v.reads = { sensorId: s.id, tag: s.tag }; v.dir = dir;
            BANDS.forEach((b) => { const pb = z.perBand[b]; if (pb.value == null) return; v.values.push({ band: b, value: pb.value, metres: pb.metres, text: pb.value == null ? `${BAND_LABEL[b]}: no value` : `${BAND_LABEL[b]} ${cmpOf(dir)} ${pb.valueText}`, sourceLabel: pb.source === 'derived' ? 'Derived' : pb.source === 'override' ? 'Override' : pb.source === 'gap' || pb.source === 'none' ? 'Gap' : 'Library', chip: pb.chip, chipText: pb.chipText }); });
            const resolved = BANDS.some((b) => z.perBand[b].value != null); const needs = BANDS.map((b) => z.perBand[b].needs).find(Boolean) || null;
            if (!resolved) { v.resolve = 'gap'; v.needs = needs; v.cantResolveText = needs ? `Can't resolve: needs ${needs.label} (${needs.tag})` : "Can't resolve: no rule"; }
            v.valuesText = v.resolve === 'gap' ? v.cantResolveText : v.values.map((x) => x.text).join(' · ');
            const a = dOf(key).alerts.find((x) => x.sensor === s.id && _.alertDir(key, x) === dir);
            const tb = v.templateId ? tplBodyAt(key, v.templateId) : null; const hold = a ? timingOf(key, a.id, 'hold') : null;
            const hv = hold ? hold.value : tb ? tb.hold : null; const hc = hold ? hold.chip : tb ? chipOf({ src: 'library', template: tb.name, v: versionAt(key, v.templateId) }) : null;
            const clr = a ? timingOf(key, a.id, 'clear') : null;
            v.timing = { hold: hv, clear: clr ? clr.value : tb ? tb.clear : null, chip: hc, chipText: hc ? hc.text : null, text: hv != null ? `Persistence ${hv} min` : '', sourceLabel: hold && hold.overrideId ? 'Override' : 'Library' };
          }
        } else if (p.kind !== 'alert') {
          const tl = e ? tplsOf(ownerOfNode(key, e)) : tplsOf({ kind: 'plantType', id: dOf(key).plant.type });
          const t = tl.find((x) => x.kind === 'task' && x.name === p.name); v.templateId = t ? t.id : null;
          v.cadence = { every: p.every || (t ? C.cadenceOf(t) : null), everyText: p.everyText || (t ? C.every(t) : ''), chip: t ? chipOf({ src: 'library', template: t.name, v: versionAt(key, t.id) }) : chipOf({ src: 'derived', ruleText: 'from the survey' }) };
          v.cadence.chipText = v.cadence.chip.text; v.cadence.text = cap(v.cadence.everyText || _.everyText(v.cadence.every));
        }
        v.v = v.templateId ? versionAt(key, v.templateId) : null;
        out.push(v);
      }));
      return out;
    });
  }

  /* ── template views ────────────────────────────────────────────────────────────────────────── */
  /* a card's one line of rules: when every band is a share of the same design parameter, the parameter is named once at the end
     ("Caution above 100% · Minor above 105% · Major above 115% of full-load current"); otherwise each band says its own rule */
  function rulesLine(t, unit) {
    const bs = BANDS.filter((b) => t.rules && t.rules[b]); const rs = bs.map((b) => t.rules[b]);
    const one = rs.length > 1 && rs.every((r) => r.kind !== 'const' && r.param && r.param === rs[0].param);
    return bs.map((b, i) => `${BAND_LABEL[b]} ${dirWord(t.dir)} ${one ? `${numText(rnd(rs[i].factor * 100, 2))}%${i === bs.length - 1 ? ` of ${lowerParam(rs[i].param)}` : ''}` : ruleText(rs[i], unit)}`).join(' · ');
  }
  function rulesView(t, unit) { const out = {}; BANDS.forEach((b) => { const r = t.rules ? t.rules[b] : null; out[b] = r ? { rule: { ...r }, text: ruleText(r, unit), flag: constantFlagOf(t, b) } : null; }); return out; }
  const readingUnit = (reading) => ((C.readingOf && C.readingOf(reading)) || {}).unit || '';
  function tplView(t) {
    if (!t) return null; const unit = t.kind === 'trigger' ? readingUnit(t.reading) : t.condition ? readingUnit(t.condition.reading) : '';
    const ev = t.kind === 'task' ? C.cadenceOf(t) : null;
    return { id: t.id, kind: t.kind, name: t.name, v: t.v, owner: { ...t.owner }, ownerKey: ownerKey(t.owner), ownerName: ownerName(t.owner), subject: t.subject, subjectLabel: t.subject === 'up' ? 'unit process' : t.subject === 'plant' ? 'plant' : 'equipment', reading: t.reading || null, dir: t.dir || null, dirWord: t.dir ? (t.dir === 'below' ? 'falls below' : 'rises above') : null, outcome: t.outcome, unit,
      rules: t.kind === 'trigger' ? rulesView(t, unit) : null, hold: t.hold != null ? t.hold : null, clear: t.clear != null ? t.clear : null, workType: t.workType || null, every: ev, everyText: t.kind === 'task' ? C.every(t) : null, basis: t.basis || null, meterHours: t.meterHours != null ? t.meterHours : null,
      condition: t.condition ? { reading: t.condition.reading, op: t.condition.op, doWhen: t.condition.doWhen ? { rule: { ...t.condition.doWhen }, text: ruleText(t.condition.doWhen, unit) } : null, doneWhen: t.condition.doneWhen ? { rule: { ...t.condition.doneWhen }, text: ruleText(t.condition.doneWhen, unit) } : null } : null,
      flowId: t.flowId || null, issueTypeId: t.issueTypeId || null, generalTaskId: t.generalTaskId || null, statutory: !!t.statutory, desc: t.desc || '', singleUse: t.singleUse ? { ...t.singleUse } : null,
      flagged: t.kind === 'trigger' && BANDS.some((b) => constantFlagOf(t, b)), draft: !!(L().drafts && L().drafts[t.id]), forced: !!forcedOf(t.id), href: `#/library/templates/${t.id}`, chipText: `${t.kind === 'trigger' ? 'Trigger' : 'Task'} template · v${t.v}` };
  }
  function templates(opts) {
    const o = opts || {}; const q = String(o.q || '').trim().toLowerCase();
    return cached(`kc:tpls:${JSON.stringify(o)}`, () => Object.keys((S() && L().tpl) || {}).map((id) => tplView(L().tpl[id])).filter((t) => {
      if (o.kind && t.kind !== o.kind) return false;
      if (o.owner) { const ow = String(o.owner); if (![t.ownerKey, t.owner.code, t.owner.id, t.ownerName].includes(ow)) return false; }
      if (q && ![t.name, t.ownerName, t.reading || ''].some((x) => String(x).toLowerCase().includes(q))) return false;
      return true;
    }));
  }
  const tplVersion = (id) => { const t = tplRaw(id); return t ? t.v : null; };
  function historyText(h) { if (h.v === 1 && !h.kind) return `v1 · ${h.at != null ? `${_.fmtDate(h.at)} · ` : ''}first version`; return `v${h.v} · ${h.at != null ? _.fmtDate(h.at) : '—'} · ${KIND_LABEL[h.kind] || cap(String(h.kind || ''))}${(h.diffs || []).length ? ` · ${h.diffs.map((x) => x.text).join('; ')}` : ''}${h.note ? ` · ${h.note}` : ''}`; }
  function template(id) {
    const t = tplRaw(id); if (!t) return null;
    return { ...tplView(t), body: clone(t), history: ((L().tplHistory || {})[id] || []).map((h) => ({ v: h.v, at: h.at, by: h.by, kind: h.kind, note: h.note, reason: h.reason, diffs: (h.diffs || []).slice(), text: historyText(h) })), uses: usesOf(id), draftView: L().drafts && L().drafts[id] ? templateDraft(id) : null,
      listedUnder: { text: `Listed under: ${ownerName(t.owner)}`, href: t.owner.kind === 'upType' ? `#/library/up-types/${t.owner.id}` : t.owner.kind === 'plantType' ? `#/library/plant-types/${t.owner.id}` : `#/library/eq-types/${t.owner.code}` }, pins: (S().pins || []).filter((p) => p.templateId === id && !p.endedAt).map((p) => ({ ...p })) };
  }

  /* ── where a template is used: zones, Triggers, Tasks and jobs at every plant ──────────────── */
  function instancesOf(id) {
    return cached(`kc:inst:${id}`, () => {
      const t = tplRaw(id); const out = { zones: [], triggers: [], schedules: [], works: [] }; if (!t) return out;
      ORDER.forEach((key) => {
        const d = dOf(key); if (!d || !PS(key)) return;
        if (t.kind === 'trigger') {
          d.sensors.forEach((s) => { if (s.nextPhase || s.kind === 'meter' || s.name !== t.reading) return; const e = _.homeOf(key, s); if (!e) return; const z = zoneInfo(key, s.id, t.dir); if (z && z.templateId === id) out.zones.push({ plant: key, sensorId: s.id, tag: s.tag, dir: t.dir, nodeId: e.id, nodeTag: e.tag, bound: z.bound }); });
          d.alerts.forEach((a) => { if (templateIdOfAlert(key, a) === id) out.triggers.push({ plant: key, alertId: a.id, name: triggerName(key, a.id), sensorId: a.sensor, state: V.alertState(key, a.id) }); });
        } else if (t.workType === 'condition') {
          (d.conditionWork || []).forEach((w) => { if (templateIdOfWork(key, w) === id) { const e = w.subject ? _.eqRaw(key, w.subject.id) : null; out.works.push({ plant: key, workId: w.id, name: w.name, tag: e ? e.tag : '' }); } });
        } else {
          d.schedules.forEach((sc) => { if (sc.status === 'off' || templateIdOfSchedule(key, sc) !== id) return; const e = sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(key, sc.subject.id) : null; out.schedules.push({ plant: key, scheduleId: sc.id, name: sc.name, tag: e ? e.tag : null, status: sc.status }); });
        }
      });
      return out;
    });
  }
  function usesOf(id) { const I = instancesOf(id); return [...I.zones.map((x) => ({ kind: 'zone', ...x, plantName: plantName(x.plant) })), ...I.triggers.map((x) => ({ kind: 'trigger', ...x, plantName: plantName(x.plant) })), ...I.schedules.map((x) => ({ kind: 'schedule', ...x, plantName: plantName(x.plant) })), ...I.works.map((x) => ({ kind: 'work', ...x, plantName: plantName(x.plant) }))]; }

  /* ── editing a template: a draft, its diffs, the kind it suggests ──────────────────────────── */
  const KEEP_FIELDS = ['hold', 'clear', 'every', 'runHours', 'desc', 'statutory'];
  function ruleOf(x) { if (x == null) return null; if (typeof x === 'number' || (typeof x === 'string' && x !== '')) return Number.isFinite(+x) ? { kind: 'const', value: +x } : undefined; if (x.kind === 'const') return Number.isFinite(+x.value) ? { kind: 'const', value: +x.value } : undefined; if (x.kind === 'expr') return Number.isFinite(+x.factor) && +x.factor > 0 && PARAMS[x.param] ? { kind: 'expr', factor: +x.factor, param: x.param } : undefined; return undefined; }
  const sameRule = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);
  function editTemplate(id, change, opts) {
    const t = tplRaw(id); if (!t) return { ok: false, error: 'No such template.' }; const c = change || {}; const o = opts || {};
    const dr = clone((L().drafts || {})[id]) || { templateId: id, base: t.v, at: now(), by: ME };
    if (c.band !== undefined) {
      if (t.kind !== 'trigger' || !BANDS.includes(c.band)) return { ok: false, error: 'Pick a band of a Trigger template.' };
      const r = c.rule !== undefined ? ruleOf(c.rule) : c.value !== undefined ? ruleOf(c.value) : undefined; if (r === undefined) return { ok: false, error: 'Give the limit rule: a number, or a share of a design parameter.' };
      dr.rules = dr.rules || {}; if (sameRule(r, t.rules[c.band])) delete dr.rules[c.band]; else dr.rules[c.band] = r; if (!Object.keys(dr.rules).length) delete dr.rules;
    }
    ['hold', 'clear'].forEach((k) => { if (c[k] === undefined) return; const n = Math.round(+c[k]); if (!Number.isFinite(n) || n < 0 || n > 1440) { dr.error = `${k === 'hold' ? 'Persistence' : 'Clearing'}: give whole minutes between 0 and 1440.`; return; } if (same(n, t[k])) delete dr[k]; else dr[k] = n; });
    if (dr.error) return { ok: false, error: dr.error };
    if (c.every !== undefined) { const ev = c.every && c.every.n ? { n: Math.round(+c.every.n), unit: c.every.unit } : null; if (!ev || !(ev.n >= 1) || !C.UNIT_HOURS[ev.unit]) return { ok: false, error: 'Give the cadence: a number and hour, day, week, month or year.' }; if (_.sameEvery(ev, t.every)) delete dr.every; else dr.every = ev; }
    if (c.runHours !== undefined) { const n = Math.round(+c.runHours); if (!Number.isFinite(n) || n < 1) return { ok: false, error: 'Give the run-hours as a whole number, 1 or more.' }; if (same(n, t.meterHours)) delete dr.runHours; else dr.runHours = n; }
    if (c.condition !== undefined) {
      if (!t.condition) return { ok: false, error: 'This template has no do-when and done-when thresholds.' }; dr.condition = dr.condition || {};
      for (const k of ['doWhen', 'doneWhen']) { if (c.condition[k] === undefined) continue; const r = ruleOf(c.condition[k]); if (!r) return { ok: false, error: 'Give the threshold: a number, or a share of a design parameter.' }; if (sameRule(r, t.condition[k])) delete dr.condition[k]; else dr.condition[k] = r; }
      if (!Object.keys(dr.condition).length) delete dr.condition;
    }
    if (c.desc !== undefined) { if (String(c.desc) === String(t.desc || '')) delete dr.desc; else dr.desc = String(c.desc); }
    if (c.statutory !== undefined) { if (!!c.statutory === !!t.statutory) delete dr.statutory; else dr.statutory = !!c.statutory; }
    if (o.promoteFrom) dr.promoteFrom = o.promoteFrom; if (o.merge) dr.merge = true;
    /* the band order holds at every plant that resolves the rule; constants within what the reading can read */
    if (t.kind === 'trigger' && dr.rules) {
      const nb = applyDraft(t, dr); let err = null;
      instancesOf(id).zones.some((z) => { const s = _.sensorRaw(z.plant, z.sensorId); const vals = {}; BANDS.forEach((b) => { const r = nb.rules[b]; const res = r ? resolveRule(z.plant, r, s, z.nodeId) : null; vals[b] = res ? res.value : null; }); const e = _.validateBands(vals, t.dir, s); if (e) err = `${plantName(z.plant)} · ${z.tag}: ${e}`; return !!err; });
      if (!err) { const vals = {}; BANDS.forEach((b) => { const r = nb.rules[b]; vals[b] = r && r.kind === 'const' ? r.value : null; }); const rd = (C.readingOf && C.readingOf(t.reading)) || null; const e2 = _.validateBands(vals, t.dir, rd && rd.valid ? { kind: rd.kind, valid: rd.valid, unit: rd.unit, name: t.reading } : null); if (e2) err = e2; }
      if (err) return { ok: false, error: err };
    }
    const meaningful = Object.keys(dr).some((k) => ['rules', 'condition', 'merge', ...KEEP_FIELDS].includes(k));
    if (!meaningful) { if (L().drafts) delete L().drafts[id]; touch(); _.persist(); return { ok: true, draft: null }; }
    dr.at = now(); dr.by = ME; L().drafts = L().drafts || {}; L().drafts[id] = dr; touch(); _.persist();
    return { ok: true, draft: templateDraft(id) };
  }
  function bandPair(from, to, unit) {
    if (from && to && from.kind === 'const' && to.kind === 'const') return pairNum(from.value, to.value, unit);
    return `${from ? ruleText(from, unit) : 'no band'} → ${to ? ruleText(to, unit) : 'no band'}`;
  }
  function draftDiffs(t, dr) {
    const out = []; if (!dr) return out; const unit = t.kind === 'trigger' ? readingUnit(t.reading) : t.condition ? readingUnit(t.condition.reading) : '';
    if (dr.rules) BANDS.forEach((b) => { if (!(b in dr.rules)) return; const from = t.rules[b] || null; const to = dr.rules[b] || null; const lab = `${BAND_LABEL[b]} ${dirWord(t.dir)}`; const pair = bandPair(from, to, unit); out.push({ field: 'band', band: b, from, to, label: lab, text: `${lab} ${pair}`, heading: `${lab}: ${pair}`, addRemove: !from !== !to }); });
    if (dr.hold !== undefined) out.push({ field: 'hold', from: t.hold, to: dr.hold, label: 'Persistence · must hold for', text: `persistence ${t.hold} → ${dr.hold} min`, heading: `Persistence · must hold for: ${t.hold} → ${dr.hold} min` });
    if (dr.clear !== undefined) out.push({ field: 'clear', from: t.clear, to: dr.clear, label: 'Clearing · must clear for', text: `clearing ${t.clear} → ${dr.clear} min`, heading: `Clearing · must clear for: ${t.clear} → ${dr.clear} min` });
    if (dr.every !== undefined) { const a = C.every(t); const b2 = C.every({ ...t, every: dr.every }); out.push({ field: 'every', from: t.every, to: dr.every, label: 'Cadence', text: `cadence ${a} → ${b2}`, heading: `Cadence: ${a} → ${b2}` }); }
    if (dr.runHours !== undefined) out.push({ field: 'runHours', from: t.meterHours, to: dr.runHours, label: 'Run-hours', text: `run-hours ${t.meterHours == null ? 'none' : t.meterHours} → ${dr.runHours}`, heading: `Run-hours: ${t.meterHours == null ? 'none' : t.meterHours} → ${dr.runHours}` });
    if (dr.condition) ['doWhen', 'doneWhen'].forEach((k) => { if (!(k in dr.condition)) return; const lab = k === 'doWhen' ? 'Do when' : 'Done when'; const pair = bandPair(t.condition[k], dr.condition[k], unit); out.push({ field: 'condition', which: k, from: t.condition[k], to: dr.condition[k], label: lab, text: `${lab.toLowerCase()} ${pair}`, heading: `${lab}: ${pair}` }); });
    if (dr.desc !== undefined) out.push({ field: 'desc', from: t.desc || '', to: dr.desc, label: 'Wording', text: 'wording', heading: 'Wording changed' });
    if (dr.statutory !== undefined) out.push({ field: 'statutory', from: !!t.statutory, to: dr.statutory, label: 'Statutory', text: dr.statutory ? 'marked statutory' : 'no longer statutory', heading: dr.statutory ? 'Marked statutory' : 'No longer statutory' });
    if (dr.merge) out.push({ field: 'merge', label: 'Merge', text: `merged into ${ownerName(t.owner)}`, heading: `Merged into ${ownerName(t.owner)}: every plant with one gets it as a draft` });
    return out;
  }
  function suggestedKindOf(t, dr, diffs) {
    if (diffs.some((x) => x.field === 'band' && x.band === 'emergency') || (dr && dr.statutory) || (t.statutory && diffs.some((x) => x.field !== 'desc'))) return 'forced';
    if (diffs.some((x) => x.field === 'band' && x.addRemove) || (dr && dr.merge)) return 'major';
    if (diffs.some((x) => ['band', 'hold', 'clear', 'every', 'runHours', 'condition'].includes(x.field))) return 'minor';
    return 'patch';
  }
  const allowedKindsOf = (sug) => (sug === 'forced' ? ['forced'] : KINDS.slice(KINDS.indexOf(sug), 3));
  function templateDraft(id) {
    const t = tplRaw(id); const dr = t && L().drafts ? L().drafts[id] : null; if (!dr) return null;
    const diffs = draftDiffs(t, dr); const sug = suggestedKindOf(t, dr, diffs);
    return { ...clone(dr), templateId: id, name: t.name, v: t.v, diffs, suggestedKind: sug, suggestedLabel: `Version: ${KIND_LABEL[sug]} (suggested)`, allowedKinds: allowedKindsOf(sug), nextVersion: t.v + 1, body: applyDraft(t, dr) };
  }
  function discardTemplateDraft(id) { if (!L().drafts || !L().drafts[id]) return { ok: true, already: true }; delete L().drafts[id]; touch(); _.persist(); return { ok: true }; }

  /* ── Downstream: who each field reaches before a change is published ───────────────────────── */
  const plantsIn = (list) => [...new Set(list.map((x) => x.plant))];
  function frozenWhy(key, alertId) { const n = openIssueIds(key, alertId).length; return n ? `${plural(n, 'open Issue')}` : 'waits for a resync'; }
  function fieldsOf(t) {
    if (t.kind === 'trigger') return [...BANDS.filter((b) => t.rules[b]).map((b) => ({ field: `band.${b}`, band: b, label: BAND_LABEL[b] })), { field: 'hold', label: 'Persistence · must hold for' }, { field: 'clear', label: 'Clearing · must clear for' }];
    if (t.condition) return [{ field: 'doWhen', label: 'Do when' }, { field: 'doneWhen', label: 'Done when' }];
    return [{ field: 'every', label: 'Cadence' }, ...(t.meterHours != null ? [{ field: 'runHours', label: 'Run-hours' }] : [])];
  }
  /* the table before any edit: per field, the plants that follow, override and pin it, and the Triggers frozen on it */
  function downstreamBefore(id) {
    const t = tplRaw(id); const I = instancesOf(id); const rows = [];
    fieldsOf(t).forEach((f) => {
      const follow = []; const override = []; const pinned = []; const frozen = [];
      const heldTrig = I.triggers.filter((x) => heldRaw(x.plant, x.alertId));
      if (f.band) {
        I.zones.forEach((z) => { if (activePin(z.plant, id)) pinned.push(z); else if (zoneRec(z.plant, z.sensorId, z.dir, f.band) || readingRec(z.plant, z.sensorId, z.dir)) override.push(z); else follow.push(z); });
        heldTrig.forEach((x) => frozen.push({ plant: x.plant, alertId: x.alertId, name: x.name, why: frozenWhy(x.plant, x.alertId) }));
      } else if (f.field === 'hold' || f.field === 'clear') {
        I.triggers.forEach((x) => { if (heldRaw(x.plant, x.alertId)) frozen.push({ plant: x.plant, alertId: x.alertId, name: x.name, why: frozenWhy(x.plant, x.alertId) }); else if (activePin(x.plant, id)) pinned.push(x); else if (timingRec(x.plant, x.alertId, f.field === 'hold' ? 'persistence' : 'clearing')) override.push(x); else follow.push(x); });
      } else if (f.field === 'doWhen' || f.field === 'doneWhen') {
        I.works.forEach((w) => { if (activePin(w.plant, id)) pinned.push(w); else if (findRecs(w.plant, (x) => x.kind === 'condition' && x.workId === w.workId && x.which === f.field).length) override.push(w); else follow.push(w); });
      } else {
        I.schedules.forEach((x) => { if (activePin(x.plant, id)) pinned.push(x); else if (findRecs(x.plant, (y) => (f.field === 'every' ? y.kind === 'cadence' : y.kind === 'runhours') && y.scheduleId === x.scheduleId).length) override.push(x); else follow.push(x); });
      }
      rows.push({ field: f.field, label: f.label, follow: plantsIn(follow), override: plantsIn(override), pinned: plantsIn(pinned), frozen, counts: { follow: plantsIn(follow).length, override: plantsIn(override).length, pinned: plantsIn(pinned).length, frozen: frozen.length }, frozenText: frozen.map((x) => `${x.name} (${x.why})`) });
    });
    return { perField: rows, head: ['Field', 'Follow', 'Override', 'Pinned', 'Frozen'], sub: `Who follows each field, across the ${ORDER.filter((k) => PS(k)).length} plants.` };
  }
  const CLASS_ORDER = ['pinned', 'frozen', 'held', 'suspended', 'clears', 'baseMoved', 'gap', 'newDraft', 'update', 'none'];
  function downstream(id, opts) {
    const t = tplRaw(id); if (!t) return null; const o = opts || {};
    const dv = templateDraft(id);
    return cached(`kc:ds:${id}:${JSON.stringify(o)}:${dv ? JSON.stringify(dv.diffs.map((x) => [x.field, x.band, x.which, x.to])) : ''}`, () => {
      const before = downstreamBefore(id);
      const base = { templateId: id, name: t.name, v: t.v, nextVersion: t.v + 1, before, plants: [], fields: [], totals: { update: 0, baseMoved: 0, clears: 0, pinned: 0, frozen: 0, held: 0, gaps: 0, suspended: 0, drafts: 0, reach: 0 }, resolves: [], dueNow: null, twice: false, text: '', lines: [] };
      if (!dv) return { ...base, kind: null, suggestedKind: null, allowedKinds: [], needsReason: false, draft: null };
      const kind = o.kind && KINDS.includes(o.kind) ? o.kind : dv.suggestedKind; const nb = dv.body; const I = instancesOf(id); const insts = [];
      const plantRec = (plant) => { let p = base.plants.find((x) => x.key === plant); if (!p) { p = { key: plant, name: plantName(plant), state: PS(plant).state, instances: [] }; base.plants.push(p); } return p; };
      const boundAt = (plant) => I.triggers.some((x) => x.plant === plant) || I.schedules.some((x) => x.plant === plant);
      const unitOfT = t.kind === 'trigger' ? readingUnit(t.reading) : '';
      dv.diffs.forEach((df) => {
        const field = { field: df.field, band: df.band || null, which: df.which || null, label: df.label, heading: df.heading, diff: df, classes: {} }; CLASS_ORDER.forEach((c) => { field.classes[c] = []; });
        const push = (cls, inst) => { const x = { ...inst, field: df.field, band: df.band || null, outcome: cls }; field.classes[cls].push(x); insts.push(x); plantRec(inst.plant).instances.push(x); };
        if (df.field === 'band') {
          const b = df.band;
          I.zones.forEach((z) => {
            const s = _.sensorRaw(z.plant, z.sensorId); const zi = zoneInfo(z.plant, z.sensorId, z.dir); const pb = zi.perBand[b]; const oneDp = pb.source === 'derived' && oneDpUnit(s.unit);
            const res = nb.rules[b] ? resolveRule(z.plant, nb.rules[b], s, z.nodeId) : null; const to = res ? res.value : null; const from = pb.resolved;
            const rec = zoneRec(z.plant, z.sensorId, z.dir, b); const kept = zoneRec(z.plant, z.sensorId, z.dir, b, true);
            const inst = { plant: z.plant, kind: 'zone', sensorId: z.sensorId, tag: z.tag, from, to, fromText: numText(from, oneDp), toText: to == null ? 'no value' : res && res.metres != null ? `${unitText(to, s.unit, s.kind)} (${res.metres.toFixed(1)} m)` : unitText(to, s.unit, s.kind, res && res.source === 'derived' && oneDpUnit(s.unit)), link: `#/p/${z.plant}/sensor/${z.sensorId}?f=zone.${z.dir}.${b}`, why: z.bound ? null : 'not bound yet: proposed in the bindings pass' };
            if (activePin(z.plant, id) && kind !== 'forced') return push('pinned', { ...inst, line: `${plantName(z.plant)} · ${z.tag}` });
            if (kind === 'forced' && b === 'emergency' && kept) return push('suspended', { ...inst, overrideId: kept.id, line: `${plantName(z.plant)} · ${z.tag}` });
            if (rec) { const keepsText = rec.value == null ? 'no value' : numText(rec.value); if (same(from, to)) return push('none', inst); if (kind === 'minor' && same(rec.value, to)) return push('clears', { ...inst, overrideId: rec.id, keeps: rec.value, keepsText, line: `${plantName(z.plant)} · ${z.tag} keeps ${keepsText}: it equals the new value` }); return push('baseMoved', { ...inst, overrideId: rec.id, keeps: rec.value, keepsText, line: `${plantName(z.plant)} · ${z.tag} keeps ${keepsText} (Override · ${reasonLabel(rec.reason)})` }); }
            if (res && res.source === 'gap') return push('gap', { ...inst, needs: res.needs, line: `${plantName(z.plant)} · ${z.tag}: no ${res.needs.label}` });
            if (kind === 'major' && boundAt(z.plant)) return push('newDraft', { ...inst, line: `${plantName(z.plant)} · ${z.tag}: ${inst.fromText} → ${inst.toText}, as a new draft` });
            if (!same(from, to)) return push('update', { ...inst, line: `${plantName(z.plant)} · ${z.tag}: ${from == null ? 'none' : inst.fromText} → ${inst.toText}` });
            return push('none', inst);
          });
          I.triggers.forEach((x) => {
            const h = heldRaw(x.plant, x.alertId); if (!h) return; if (activePin(x.plant, id) && kind !== 'forced') return;
            const s = _.sensorRaw(x.plant, x.sensorId) || {}; const open = openIssueIds(x.plant, x.alertId).length; const hv = h.terms.bands[b];
            const inst = { plant: x.plant, kind: 'trigger', alertId: x.alertId, tag: x.name, name: x.name, from: hv, link: `#/p/${x.plant}/trigger/${x.alertId}` };
            if (open) return push('frozen', { ...inst, why: `${plural(open, 'open Issue')}`, keeps: hv, line: `${plantName(x.plant)} · ${x.name}` });
            if (kind === 'forced' && b === 'emergency') { const res = nb.rules[b] ? resolveRule(x.plant, nb.rules[b], s, _.homeOf(x.plant, s) ? _.homeOf(x.plant, s).id : null) : null; const to = res ? res.value : null; return push('update', { ...inst, to, why: 'its other terms still wait for a resync', line: `${plantName(x.plant)} · ${x.name}: Emergency ${pairNum(hv, to, s.unit, s.kind)} · its other terms still wait for a resync` }); }
            return push('held', { ...inst, why: 'waits for a resync', line: `${plantName(x.plant)} · ${x.name}` });
          });
          if (nb.rules[b] && nb.rules[b].kind === 'const') base.resolves.push({ band: b, constant: true, value: nb.rules[b].value, text: `Resolves to ${unitText(nb.rules[b].value, unitOfT)} at every plant (a constant)` });
          else if (nb.rules[b]) I.zones.forEach((z) => { const s = _.sensorRaw(z.plant, z.sensorId); const res = resolveRule(z.plant, nb.rules[b], s, z.nodeId); base.resolves.push({ band: b, constant: false, plant: z.plant, plantName: plantName(z.plant), tag: z.tag, value: res.value, metres: res.metres != null ? res.metres : null, from: res.paramText || (res.needs ? `no ${res.needs.label}` : ''), text: `${plantName(z.plant)} · ${z.tag} | ${res.value == null ? 'no value' : res.metres != null ? `${unitText(res.value, s.unit)} (${res.metres.toFixed(1)} m)` : unitText(res.value, s.unit, s.kind, oneDpUnit(s.unit))} | ${res.paramText ? `${lowerParam(res.param)} ${res.paramText}` : res.needs ? `no ${res.needs.label}` : ''}` }); });
        } else if (df.field === 'hold' || df.field === 'clear') {
          I.triggers.forEach((x) => {
            const tm = timingOf(x.plant, x.alertId, df.field); const from = tm ? tm.resolved : null; const to = df.to; const h = heldRaw(x.plant, x.alertId);
            const inst = { plant: x.plant, kind: 'trigger', alertId: x.alertId, tag: x.name, name: x.name, from, to, fromText: String(from), toText: `${to} min`, link: `#/p/${x.plant}/trigger/${x.alertId}?f=${df.field === 'hold' ? 'persistence' : 'clearing'}` };
            if (activePin(x.plant, id)) return push('pinned', { ...inst, line: `${plantName(x.plant)} · ${x.name}` });
            if (h) { const open = openIssueIds(x.plant, x.alertId).length; return push(open ? 'frozen' : 'held', { ...inst, why: open ? `${plural(open, 'open Issue')}` : 'waits for a resync', line: `${plantName(x.plant)} · ${x.name}` }); }
            const rec = timingRec(x.plant, x.alertId, df.field === 'hold' ? 'persistence' : 'clearing');
            if (rec) { if (same(from, to)) return push('none', inst); if (kind === 'minor' && same(rec.value, to)) return push('clears', { ...inst, overrideId: rec.id, keeps: rec.value, keepsText: `${rec.value} min`, line: `${plantName(x.plant)} · ${x.name} keeps ${rec.value} min: it equals the new value` }); return push('baseMoved', { ...inst, overrideId: rec.id, keeps: rec.value, keepsText: `${rec.value} min`, line: `${plantName(x.plant)} · ${x.name} keeps ${rec.value} min (Override · ${reasonLabel(rec.reason)})` }); }
            if (kind === 'major') return push('newDraft', { ...inst, line: `${plantName(x.plant)} · ${x.name}: ${from} → ${to} min, as a new draft` });
            if (!same(from, to)) return push('update', { ...inst, line: `${plantName(x.plant)} · ${x.name}: ${from} → ${to} min` });
            return push('none', inst);
          });
        } else if (df.field === 'every' || df.field === 'runHours') {
          I.schedules.forEach((x) => {
            const ci = cadenceOf(x.plant, x.scheduleId); const sc = _.schedRaw(x.plant, x.scheduleId); const what = `${x.name}${x.tag ? ` on ${x.tag}` : ''}`;
            const fromT = df.field === 'every' ? _.everyWith(sc, ci ? ci.resolved : null) : `every ${df.from} run-hours`; const toT = df.field === 'every' ? _.everyWith(sc, df.to) : `every ${df.to} run-hours`;
            const inst = { plant: x.plant, kind: 'schedule', scheduleId: x.scheduleId, tag: x.tag, name: x.name, from: df.from, to: df.to, fromText: fromT, toText: toT, link: `#/p/${x.plant}/trigger/${x.scheduleId}?f=cadence` };
            if (activePin(x.plant, id)) return push('pinned', { ...inst, line: `${plantName(x.plant)} · ${what}` });
            const rec = findRecs(x.plant, (y) => (df.field === 'every' ? y.kind === 'cadence' : y.kind === 'runhours') && y.scheduleId === x.scheduleId)[0];
            if (rec) { const vt = df.field === 'every' ? _.everyText(rec.value) : `every ${rec.value} run-hours`; if (kind === 'minor' && (df.field === 'every' ? _.sameEvery(rec.value, df.to) : same(rec.value, df.to))) return push('clears', { ...inst, overrideId: rec.id, keeps: rec.value, keepsText: vt, line: `${plantName(x.plant)} · ${what} keeps ${vt}: it equals the new value` }); return push('baseMoved', { ...inst, overrideId: rec.id, keeps: rec.value, keepsText: vt, line: `${plantName(x.plant)} · ${what} keeps ${vt} (Override · ${reasonLabel(rec.reason)})` }); }
            if (kind === 'major') return push('newDraft', { ...inst, line: `${plantName(x.plant)} · ${what}: ${fromT} → ${toT}, as a new draft` });
            if (fromT !== toT) return push('update', { ...inst, line: `${plantName(x.plant)} · ${what}: ${fromT} → ${toT}` });
            return push('none', inst);
          });
          if (df.field === 'every' && fnOf('cadenceDueNow')) { const sv = safe(() => V.cadenceDueNow(id, df.to, 'service'), null); const pb = safe(() => V.cadenceDueNow(id, df.to, 'publish'), null); base.dueNow = { service: sv, publish: pb, countFrom: o.countFrom || 'service' }; }
        } else if (df.field === 'condition') {
          I.works.forEach((w) => {
            const co = conditionOf(w.plant, w.workId); const pf = co ? co.perField[df.which] : null; const wr = (dOf(w.plant).conditionWork || []).find((x) => x.id === w.workId); const s = wr ? _.sensorRaw(w.plant, wr.sensor) : null; const e = wr && wr.subject ? _.eqRaw(w.plant, wr.subject.id) : null;
            const res = df.to ? resolveRule(w.plant, df.to, s, e ? e.id : null) : null; const from = pf ? pf.resolved : null; const to = res ? res.value : null; const unit = co ? co.unit : '';
            const inst = { plant: w.plant, kind: 'work', workId: w.workId, tag: w.tag, name: w.name, from, to, fromText: numText(from, true), toText: unitText(to, unit, null, true), link: `#/p/${w.plant}/trigger/${w.workId}?f=condition.${df.which}` };
            if (activePin(w.plant, id)) return push('pinned', { ...inst, line: `${plantName(w.plant)} · ${w.name} on ${w.tag}` });
            const rec = findRecs(w.plant, (x) => x.kind === 'condition' && x.workId === w.workId && x.which === df.which)[0];
            if (rec) { if (same(from, to)) return push('none', inst); if (kind === 'minor' && same(rec.value, to)) return push('clears', { ...inst, overrideId: rec.id, keeps: rec.value, keepsText: unitText(rec.value, unit), line: `${plantName(w.plant)} · ${w.name} on ${w.tag} keeps ${unitText(rec.value, unit)}: it equals the new value` }); return push('baseMoved', { ...inst, overrideId: rec.id, keeps: rec.value, keepsText: unitText(rec.value, unit), line: `${plantName(w.plant)} · ${w.name} on ${w.tag} keeps ${unitText(rec.value, unit)} (Override · ${reasonLabel(rec.reason)})` }); }
            if (res && res.source === 'gap') return push('gap', { ...inst, needs: res.needs, line: `${plantName(w.plant)} · ${w.tag}: no ${res.needs.label}` });
            if (!same(from, to)) return push('update', { ...inst, line: `${plantName(w.plant)} · ${w.name} on ${w.tag}: ${inst.fromText} → ${inst.toText}` });
            return push('none', inst);
          });
        }
        const C2 = field.classes; const toTxt = df.field === 'band' ? (df.to && df.to.kind === 'const' ? unitText(df.to.value, unitOfT) : df.to ? ruleText(df.to, unitOfT) : 'no value') : df.field === 'hold' || df.field === 'clear' ? `${df.to} min` : '';
        field.counts = { update: plantsIn(C2.update).length, baseMoved: plantsIn(C2.baseMoved).length, clears: C2.clears.length, pinned: plantsIn(C2.pinned).length, frozen: C2.frozen.length, held: C2.held.length, suspended: C2.suspended.length, gaps: C2.gap.length, drafts: plantsIn(C2.newDraft).length };
        field.groups = [
          C2.update.length ? { key: 'update', head: `${plural(field.counts.update, 'plant')} will update`, items: C2.update.map((x) => x.line), why: C2.update.map((x) => x.why || null) } : null,
          C2.baseMoved.length ? { key: 'baseMoved', head: `${plural(field.counts.baseMoved, 'plant')} will show base moved`, items: C2.baseMoved.map((x) => x.line) } : null,
          C2.clears.length ? { key: 'clears', head: `${C2.clears.length} of them already equal${C2.clears.length === 1 ? 's' : ''} ${toTxt}: it will clear`, items: C2.clears.map((x) => x.line) } : null,
          { key: 'pinned', head: `${field.counts.pinned} pinned · hold at v${t.v}`, items: C2.pinned.map((x) => x.line) },
          C2.frozen.length ? { key: 'frozen', head: `${C2.frozen.length} frozen · wait for open Issues`, items: C2.frozen.map((x) => x.line) } : null,
          C2.held.length ? { key: 'held', head: `${C2.held.length} held · wait for a resync`, items: C2.held.map((x) => x.line) } : null,
          C2.suspended.length ? { key: 'suspended', head: `${plural(C2.suspended.length, 'override')} suspended: kept, not applied; they return when lifted`, items: C2.suspended.map((x) => x.line) } : null,
          C2.gap.length ? { key: 'gap', head: `${C2.gap.length} can't resolve: they inherit a gap`, items: C2.gap.map((x) => x.line) } : null,
          C2.newDraft.length ? { key: 'newDraft', head: `${plural(field.counts.drafts, 'plant')} get${field.counts.drafts === 1 ? 's' : ''} a new draft in the review queue; overrides are carried into it.`, items: C2.newDraft.map((x) => x.line) } : null,
        ].filter(Boolean);
        base.fields.push(field);
      });
      const by = (cls) => insts.filter((x) => x.outcome === cls);
      const reachSet = new Set([...plantsIn(by('update')), ...plantsIn(by('suspended')), ...plantsIn(by('newDraft')), ...(kind === 'forced' ? plantsIn(by('pinned')) : [])]);
      base.totals = { update: plantsIn(by('update')).length, baseMoved: plantsIn(by('baseMoved')).length, baseMovedValues: by('baseMoved').length, clears: by('clears').length, pinned: plantsIn(by('pinned')).length, frozen: by('frozen').length, held: by('held').length, gaps: by('gap').length, suspended: by('suspended').length, drafts: plantsIn(by('newDraft')).length, reach: reachSet.size };
      base.reached = [...reachSet];
      base.twice = base.plants.some((p) => new Set(p.instances.filter((x) => x.outcome !== 'none').map((x) => x.outcome)).size > 1);
      const told = kind === 'forced' ? base.reached.filter((k) => live(k)) : []; const quiet = kind === 'forced' ? base.reached.filter((k) => !live(k)) : [];
      base.adminsTold = told; base.notTold = quiet;
      if (kind === 'forced') { if (told.length) base.lines.push(`Plant admins are told at ${joinAnd(told.map(plantName))}.`); if (quiet.length) base.lines.push(`${joinAnd(quiet.map(plantName))}: Commissioning, nothing is sent.`); }
      if (base.twice) base.lines.push('A plant appears twice when its instances differ.');
      base.text = [`${plural(base.totals.reach, 'plant')} reached`, base.totals.baseMovedValues ? `${base.totals.baseMovedValues} base moved` : '', base.totals.frozen ? `${base.totals.frozen} frozen skipped` : '', base.totals.held ? `${base.totals.held} held` : ''].filter(Boolean).join(' · ');
      return { ...base, kind, suggestedKind: dv.suggestedKind, allowedKinds: dv.allowedKinds, needsReason: kind === 'forced', draft: dv, versionText: `Version: ${KIND_LABEL[dv.suggestedKind]} (suggested)`, kindTitles: Object.fromEntries(KINDS.map((k) => [k, dv.allowedKinds.includes(k) ? null : k === 'forced' ? 'Forced is only for a change to the Emergency band or a statutory template.' : `This change is ${KIND_LABEL[dv.suggestedKind]}: a smaller kind would hide it.`])), publishLabel: `Publish v${t.v + 1} to ${plural(base.totals.reach, 'plant')}`, discardText: `Discard the draft of ${t.name} v${t.v + 1}? Nothing has reached any plant.` };
    });
  }

  /* ── publishing ────────────────────────────────────────────────────────────────────────────── */
  const ownerSetOf = (t) => (t.owner.kind === 'plantType' ? null : setOfOwner(t.owner));
  /* the new value goes into the owner's v6 set too, so v6's helpers (binding a new Trigger, for one) read the same library */
  function writeV6(t) {
    const set = ownerSetOf(t); if (!set || t.singleUse) return;
    if (t.kind === 'trigger') {
      const ta = set.alerts.find((a) => a.name === t.name); if (!ta) return; const lim = { ...(ta.limits || {}) };
      BANDS.forEach((b) => { const r = t.rules[b]; if (!r) delete lim[b]; else if (r.kind === 'const') lim[b] = r.value; else if (r.param === 'tankHeight') lim[b] = rnd(r.factor * 100, 4); });
      ta.limits = lim; ta.hold = t.hold; ta.clear = t.clear;
    } else {
      const ts = set.schedules.find((x) => x.name === t.name); if (!ts) return;
      if (t.every) ts.every = { ...t.every }; if (t.meterHours != null) ts.meterHours = t.meterHours;
      if (t.condition) ['doWhen', 'doneWhen'].forEach((k) => { const r = t.condition[k]; if (r && r.kind === 'const') ts[k] = r.value; });
    }
  }
  function adminsOf(key) {
    const ppl = (dOf(key) || { people: [] }).people || []; const admins = ppl.filter((p) => p.grant && p.grant !== 'none').map((p) => p.name);
    if (admins.length) return admins; return ppl.filter((p) => p.role === 'l3' || p.role === 'l4').map((p) => p.name);
  }
  function publishTemplate(id, opts) {
    const o = opts || {}; const t = tplRaw(id); if (!t) return { ok: false, error: 'No such template.' };
    const dv = templateDraft(id); if (!dv) return { ok: false, error: 'Nothing to publish: there is no draft.' };
    if (!String(o.note || '').trim()) return { ok: false, error: 'Write a change note.', field: 'note' };
    const kind = o.kind || dv.suggestedKind;
    if (!KINDS.includes(kind) || !dv.allowedKinds.includes(kind)) return { ok: false, error: `This change is ${KIND_LABEL[dv.suggestedKind]}: it can't be published as ${KIND_LABEL[kind] || kind}.`, field: 'kind' };
    if (kind === 'forced' && !String(o.reason || '').trim()) return { ok: false, error: 'A forced change needs a reason.', field: 'reason' };
    const ds = downstream(id, { kind, countFrom: o.countFrom }); const at = now(); const note = String(o.note).trim(); const reason = kind === 'forced' ? String(o.reason).trim() : null;
    const oldV = t.v; const nb = { ...clone(dv.body), v: oldV + 1 }; const changeId = _.counterId('cseq', 'pub');
    /* a Major change keeps every plant with a bound Trigger or Task on its old version until it accepts the new draft */
    const holds = [];
    if (kind === 'major') {
      ds.reached.forEach((plant) => {
        if (activePin(plant, id)) return; const I = instancesOf(id); const alertIds = I.triggers.filter((x) => x.plant === plant).map((x) => x.alertId); const scheduleIds = I.schedules.filter((x) => x.plant === plant).map((x) => x.scheduleId);
        if (!alertIds.length && !scheduleIds.length) return;
        const carried = (S().overrides || []).filter((r) => r.plant === plant && recKept(r) && ((r.target.sensorId && I.zones.some((z) => z.plant === plant && z.sensorId === r.target.sensorId)) || alertIds.includes(r.target.alertId) || scheduleIds.includes(r.target.scheduleId))).map((r) => r.id);
        const draftId = _.counterId('mseq', 'md');
        holds.push({ plant, templateId: id, v: versionAt(plant, id), draftId });
        (L().majorDrafts || (L().majorDrafts = [])).push({ id: draftId, plant, templateId: id, name: t.name, v: nb.v, fromV: versionAt(plant, id), alertIds, scheduleIds, carried, at, status: 'open', changeId });
      });
      (S().majorHolds || (S().majorHolds = [])).push(...holds);
    }
    if (dv.merge) nb.singleUse = null;
    L().tpl[id] = nb; (L().tplHistory[id] || (L().tplHistory[id] = [])).push({ v: nb.v, at, by: ME, kind, note, reason, diffs: dv.diffs.map((x) => ({ field: x.field, band: x.band || null, which: x.which || null, from: x.from, to: x.to, text: x.text })), body: clone(nb) });
    delete L().drafts[id]; writeV6(nb); touch();
    const instances = instancesOf(id);
    const zoneMatch = (bands) => (target) => (kindOf(target) === 'zone' && bands.includes(target.band) && instances.zones.some((z) => z.sensorId === target.sensorId)) || (target.kind === 'triggerLimit' && bands.includes(target.band) && instances.triggers.some((x) => x.alertId === target.alertId));
    const reached = { follow: ds.reached.slice(), baseMoved: [], cleared: [], suspended: [], pinned: ds.plants.filter((p) => p.instances.some((x) => x.outcome === 'pinned')).map((p) => p.key), frozen: [], drafts: holds.map((h) => ({ plant: h.plant, draftId: h.draftId })), gaps: [] };
    ds.plants.forEach((p) => p.instances.forEach((x) => { if (x.outcome === 'baseMoved' && x.overrideId) reached.baseMoved.push(x.overrideId); if (x.outcome === 'frozen' || x.outcome === 'held') reached.frozen.push({ plant: p.key, alertId: x.alertId }); if (x.outcome === 'gap') reached.gaps.push({ plant: p.key, sensorId: x.sensorId }); }));
    const ledger = fnOf('ledgerOnBaseChange');
    const changedBands = dv.diffs.filter((x) => x.field === 'band').map((x) => x.band);
    /* the override a promote came from ends as Promoted below, so the publish never clears it first */
    const notPromoting = (rec) => !(dv.promoteFrom && rec && rec.id === dv.promoteFrom);
    const targetsMatch = (target) => zoneMatch(changedBands)(target) || ((kindOf(target) === 'persistence' && dv.diffs.some((x) => x.field === 'hold')) || (kindOf(target) === 'clearing' && dv.diffs.some((x) => x.field === 'clear'))) && instances.triggers.some((x) => x.alertId === target.alertId) || (target.kind === 'cadence' && dv.diffs.some((x) => x.field === 'every') && instances.schedules.some((x) => x.scheduleId === target.scheduleId)) || (target.kind === 'runhours' && dv.diffs.some((x) => x.field === 'runHours') && instances.schedules.some((x) => x.scheduleId === target.scheduleId)) || (target.kind === 'condition' && dv.diffs.some((x) => x.field === 'condition' && x.which === target.which) && instances.works.some((w) => w.workId === target.workId));
    if (ledger && (kind === 'minor' || kind === 'forced')) {
      ORDER.forEach((plant) => {
        if (!PS(plant)) return; const pinned = !!activePin(plant, id);
        if (kind === 'minor' && !pinned) { const r = safe(() => ledger({ plant, kind: 'minor', changeId, owner: t.name, version: nb.v, match: (target, rec) => notPromoting(rec) && targetsMatch(target) }), null); if (r && r.cleared) reached.cleared.push(...r.cleared); }
        if (kind === 'forced') {
          const r = safe(() => ledger({ plant, kind: 'forced', changeId, owner: t.name, version: nb.v, match: zoneMatch(['emergency']) }), null); if (r && r.suspended) reached.suspended.push(...r.suspended);
          if (!pinned) { const r2 = safe(() => ledger({ plant, kind: 'minor', changeId, owner: t.name, version: nb.v, match: (target, rec) => notPromoting(rec) && targetsMatch(target) && !(kindOf(target) === 'zone' && target.band === 'emergency') }), null); if (r2 && r2.cleared) reached.cleared.push(...r2.cleared); }
        }
      });
    }
    if (ledger && kind === 'major') safe(() => ledger({ kind: 'major', changeId, owner: t.name, version: nb.v, match: () => false }));
    if (kind === 'forced') { const er = nb.rules ? nb.rules.emergency : null; L().forced = L().forced || {}; L().forced[id] = { v: nb.v, changeId, bands: { emergency: !er ? null : er.kind === 'const' ? er.value : { ...er } }, reason, at, by: ME, liftedAt: null }; }
    touch();
    /* following plants change at once with no note; held Triggers learn their base moved; v6's fields follow */
    ORDER.forEach((plant) => { if (PS(plant)) markMoved(plant, { kind: 'template', templateId: id }); });
    instances.zones.forEach((z) => syncZone(z.plant, z.sensorId));
    instances.works.forEach((w) => syncWork(w.plant, w.workId));
    instances.triggers.forEach((x) => { if (!heldRaw(x.plant, x.alertId)) { const a = _.alertRaw(x.plant, x.alertId); const tm = triggerTerms(x.plant, x.alertId); if (a && tm) { a.holdMin = tm.hold; if (a.closes && a.closes.mode === 'sensor') a.closes.holdMin = tm.clear; } } });
    if (dv.diffs.some((x) => x.field === 'every' || x.field === 'runHours')) instances.schedules.forEach((x) => {
      if (activePin(x.plant, id) || majorHoldOf(x.plant, id)) return; const sc = _.schedRaw(x.plant, x.scheduleId); if (!sc) return;
      if (findRecs(x.plant, (y) => (y.kind === 'cadence' || y.kind === 'runhours') && y.scheduleId === x.scheduleId).length) return;
      const scOld = clone(sc); if (nb.every) sc.every = { ...nb.every }; if (nb.meterHours != null && sc.meter) sc.meter.hours = nb.meterHours; touch();
      const P = PS(x.plant); if (!P || P.state !== 'live') return; const tid2 = _.taskIdOfSchedule(x.plant, sc.id); const st = tid2 ? P.tasks[tid2] : null; if (!st || st.status === 'due' || st.status === 'doing') return;
      const r = safe(() => _.dueAfter(x.plant, sc, scOld, st, at, { countFrom: o.countFrom || 'service' }), null); if (r && r.due != null) { st.due = r.due; if (r.calDue != null) st.calDue = r.calDue; if (st.status === 'upcoming' && st.due <= at) st.status = 'due'; }
    });
    const diffText = dv.diffs.map((x) => x.text).join('; ');
    const change = { id: changeId, templateId: id, name: t.name, owner: { ...t.owner }, typeName: ownerName(t.owner), v: nb.v, version: nb.v, at, by: ME, who: ME, kind, note, reason, diffs: dv.diffs.map((x) => ({ field: x.field, band: x.band || null, which: x.which || null, from: x.from, to: x.to, text: x.text })), reached, plants: [], countFrom: o.countFrom || null, text: diffText };
    L().changes.unshift(change);
    act(at, null, `Published ${t.name} v${nb.v} (${KIND_LABEL[kind]}): ${diffText}. ${note}`, 'library', ME);
    if (kind === 'forced') {
      const emDiff = dv.diffs.find((x) => x.field === 'band' && x.band === 'emergency'); const u = readingUnit(t.reading);
      const fromTo = emDiff ? bandPair(emDiff.from, emDiff.to, u) : 'changed';
      ds.reached.forEach((plant) => {
        const susp = reached.suspended.map((rid) => S().overrides.find((r) => r.id === rid)).filter((r) => r && r.plant === plant); const tags = [...new Set(susp.map((r) => (_.sensorRaw(plant, r.target.sensorId) || {}).tag).filter(Boolean))];
        const tell = live(plant) ? `Plant admins told: ${joinAnd(adminsOf(plant)) || 'nobody yet'}.` : 'Commissioning: nothing is sent.';
        act(at, plant, `Forced library change: ${t.name} v${nb.v}, Emergency ${dirWord(t.dir)} ${fromTo}. ${tags.length ? `Your override on ${joinAnd(tags)} is suspended and returns when the change is lifted. ` : ''}${tell} Reason: ${reason}`, 'library', ME);
      });
    }
    if (dv.promoteFrom && fnOf('promoted')) safe(() => V.promoted(dv.promoteFrom, changeId));
    touch(); _.persist();
    const bm = ds.totals.baseMovedValues || 0; const fz = ds.totals.frozen || 0;
    return { ok: true, v: nb.v, version: nb.v, change, landed: ds, toast: [`Published ${t.name} v${nb.v} to ${plural(ds.totals.reach, 'plant')}`, bm ? `${bm} base moved` : '', fz ? `${fz} frozen skipped` : ''].filter(Boolean).join(' · ') };
  }
  const libChanges = (opts) => { const o = opts || {}; return (S() && L().changes ? L().changes : []).filter((c) => (!o.templateId || c.templateId === o.templateId) && (!o.owner || ownerKey(c.owner) === o.owner)).map((c) => ({ ...c })); };
  function liftForced(idOrChange, opts) {
    const F = (S() && L().forced) || {}; const id = F[idOrChange] ? idOrChange : Object.keys(F).find((k) => F[k].changeId === idOrChange);
    const fo = id ? F[id] : null; if (!fo || fo.liftedAt) { const f = fnOf('ledgerLiftForced'); if (f && idOrChange) safe(() => f(idOrChange)); return { ok: false, error: 'No Forced change in force.' }; }
    fo.liftedAt = now(); fo.liftReason = (opts && opts.reason) || null; const f = fnOf('ledgerLiftForced'); const r = f ? safe(() => f(fo.changeId), { lifted: [] }) : { lifted: [] };
    const t = tplRaw(id); touch(); instancesOf(id).zones.forEach((z) => syncZone(z.plant, z.sensorId));
    act(now(), null, `Lifted the Forced change on ${t ? t.name : id} v${fo.v}${fo.liftReason ? `: ${fo.liftReason}` : ''}. Suspended overrides apply again`, 'library', ME);
    touch(); _.persist(); return { ok: true, lifted: (r && r.lifted) || [] };
  }
  function editTypeField(typeKey, change) { const c = change || {}; const TD = L().typeDrafts || (L().typeDrafts = {}); const dr = TD[typeKey] || { base: typeVersion(typeKey), at: now() }; if (c.defaultTier !== undefined) { if (!['A', 'B', 'C'].includes(c.defaultTier)) return { ok: false, error: 'Pick a criticality tier: A, B or C.' }; dr.defaultTier = c.defaultTier; } if (c.promoteFrom) dr.promoteFrom = c.promoteFrom; dr.at = now(); TD[typeKey] = dr; touch(); _.persist(); return { ok: true, draft: { ...dr } }; }
  function publishTypeField(typeKey, opts) {
    const TD = L().typeDrafts || {}; const dr = TD[typeKey]; if (!dr) return { ok: false, error: 'Nothing to publish: there is no draft.' };
    if (!String((opts && opts.note) || '').trim()) return { ok: false, error: 'Write a change note.', field: 'note' };
    const v = typeVersion(typeKey) + 1; L().typeVersions = L().typeVersions || {}; L().typeVersions[typeKey] = v;
    const TF = L().typeFields || (L().typeFields = {}); TF[typeKey] = { ...(TF[typeKey] || {}), ...(dr.defaultTier ? { defaultTier: dr.defaultTier } : {}) };
    delete TD[typeKey]; const changeId = _.counterId('cseq', 'pub'); const code = typeKey.split(':')[1]; const name = typeKey.startsWith('eq:') ? ((catByCode(code) || {}).type || code) : ((upTypeById(code) || {}).name || code);
    const text = dr.defaultTier ? `default criticality tier → ${dr.defaultTier}` : 'type fields';
    L().changes.unshift({ id: changeId, templateId: null, typeKey, name, owner: typeKey.startsWith('eq:') ? { kind: 'eqType', code, typeName: name } : { kind: 'upType', id: code, typeName: name }, typeName: name, v, version: v, at: now(), by: ME, who: ME, kind: 'minor', note: String(opts.note).trim(), reason: null, diffs: [{ field: 'tier', text }], reached: {}, plants: [], text });
    act(now(), null, `Published ${name} v${v} (Minor): ${text}. ${String(opts.note).trim()}`, 'library', ME);
    /* a new default tier moves every derived base of that type: an override equal to it clears, the others show Base moved, and
       the override a promote came from ends as Promoted below */
    if (typeKey.startsWith('eq:') && dr.defaultTier) {
      touch(); const ledger = fnOf('ledgerOnBaseChange');
      const ofType = (plant, eqId) => ((_.catByType((_.eqRaw(plant, eqId) || {}).type) || {}).code === code);
      if (ledger) safe(() => ledger({ kind: 'minor', changeId, owner: name, version: v, match: (target, rec) => target.kind === 'tier' && !!rec && rec.id !== dr.promoteFrom && ofType(rec.plant, target.eqId) }));
      if (typeof _.syncTiers === 'function') ORDER.forEach((plant) => { if (PS(plant)) safe(() => _.syncTiers(plant)); });
    }
    if (dr.promoteFrom && fnOf('promoted')) safe(() => V.promoted(dr.promoteFrom, changeId));
    touch(); _.persist(); return { ok: true, v, changeId };
  }
  const typeDefaultTier = (code) => { const TF = S() && L().typeFields; const x = TF ? TF[`eq:${code}`] : null; return x && x.defaultTier ? x.defaultTier : ((catByCode(code) || {}).tier || null); };

  /* ── pins and Major drafts ─────────────────────────────────────────────────────────────────── */
  function pin(key, id, opts) {
    const t = tplRaw(id); if (!t) return { ok: false, error: 'No such template.' }; if (!PS(key)) return { ok: false, error: 'No such plant.' };
    const o = opts || {}; const reason = String(o.reason || '').trim();
    if (!reason) return { ok: false, error: `Say why this plant should stay on v${t.v}.`, field: 'reason' };
    const ex = activePin(key, id); if (ex) return { ok: false, error: `Already pinned to v${ex.v}.` };
    const p = { id: _.counterId('pinseq', 'pin'), plant: key, templateId: id, v: versionAt(key, id), reason, note: String(o.note || '').trim(), by: ME, at: now(), endedAt: null };
    (S().pins || (S().pins = [])).push(p); touch();
    act(now(), key, `Pinned ${t.name} to v${p.v}: ${reason}`, 'config'); touch(); _.persist();
    return { ok: true, pin: { ...p }, toast: `${plantName(key)} stays on ${t.name} v${p.v}` };
  }
  function unpin(key, id) {
    const p = activePin(key, id); if (!p) return { ok: true, already: true }; const t = tplRaw(id);
    p.endedAt = now(); touch(); markMoved(key, { kind: 'template', templateId: id }); instancesOf(id).zones.filter((z) => z.plant === key).forEach((z) => syncZone(key, z.sensorId));
    act(now(), key, `Unpinned ${t ? t.name : id}: follows v${t ? t.v : ''}`, 'config'); touch(); _.persist();
    return { ok: true, toast: `${plantName(key)} follows ${t ? `${t.name} v${t.v}` : 'the library'} again` };
  }
  const pins = (opts) => { const o = opts || {}; return (S() && S().pins ? S().pins : []).filter((p) => !p.endedAt && (!o.plant || p.plant === o.plant)).map((p) => { const t = tplRaw(p.templateId); return { ...p, templateName: t ? t.name : p.templateId, latest: t ? t.v : p.v, plantName: plantName(p.plant), chip: chipOf({ src: 'pinned', v: p.v, latest: t ? t.v : p.v, x: '' }) }; }); };
  const majorDrafts = (key) => ((S() && L().majorDrafts) || []).filter((m) => m.status === 'open' && (!key || m.plant === key)).map((m) => ({ ...m, plantName: plantName(m.plant), text: `${m.name}: v${m.fromV} → v${m.v}`, href: `#/library/templates/${m.templateId}` }));
  function acceptMajorDraft(key, draftId) {
    const m = ((S() && L().majorDrafts) || []).find((x) => x.id === draftId && x.plant === key && x.status === 'open'); if (!m) return { ok: false, error: 'No such draft.' };
    S().majorHolds = (S().majorHolds || []).filter((h) => !(h.plant === key && h.templateId === m.templateId)); m.status = 'accepted'; m.acceptedAt = now(); touch();
    markMoved(key, { kind: 'template', templateId: m.templateId }); instancesOf(m.templateId).zones.filter((z) => z.plant === key).forEach((z) => syncZone(key, z.sensorId));
    act(now(), key, `Accepted ${m.name} v${m.v} (was v${m.fromV})`, 'config'); touch(); _.persist();
    return { ok: true, toast: `${plantName(key)} is on ${m.name} v${m.v}` };
  }

  /* ── library pages: types, conditions, flows and root causes ───────────────────────────────── */
  const nodesOfOwner = (key, owner) => (dOf(key) ? dOf(key).equipment.filter((e) => sameOwner(ownerOfNode(key, e), owner)) : []);
  /* "Resolves at": what each template resolves to at each plant, who keeps their own, and where a sensor is missing */
  function resolvesAt(id) {
    const t = tplRaw(id); if (!t || t.kind !== 'trigger') return [];
    return cached(`kc:ra:${id}`, () => {
      const out = [];
      ORDER.forEach((key) => {
        if (!PS(key)) return; const nodes = nodesOfOwner(key, t.owner); if (!nodes.length) return; const missing = []; const gaps = [];
        nodes.forEach((e) => {
          const s = dOf(key).sensors.find((x) => x.on === `eq:${e.id}` && x.name === t.reading && !x.nextPhase); if (!s) { missing.push(e); return; }
          const z = zoneInfo(key, s.id, t.dir); if (!z || z.templateId !== id) return; const bandsT = BANDS.filter((b) => t.rules[b]);
          const res = bandsT.map((b) => z.perBand[b]); const der = res.find((pb) => pb.source === 'derived' || (pb.rule && pb.rule.kind === 'expr'));
          const vals = (pick) => { const vs = bandsT.map((b) => pick(z.perBand[b])); const lastNum = vs.map((x) => x != null).lastIndexOf(true); return vs.map((v, i) => (v == null ? 'none' : i === lastNum ? unitText(v, s.unit, s.kind, oneDpUnit(s.unit) && !!der) : (s.unit === 'pH' ? 'pH ' : '') + numText(v, oneDpUnit(s.unit) && !!der))).join(' / '); };
          if (res.every((pb) => pb.resolved == null) && res.some((pb) => pb.needs)) gaps.push(e);
          else out.push({ plant: key, kind: 'values', tag: e.tag, text: `${plantName(key)} · ${e.tag}: ${vals((pb) => pb.resolved)}${der && der.paramText ? ` (${der.param === 'fullLoadCurrent' || (der.rule && der.rule.param === 'fullLoadCurrent') ? `${(der.paramText.split(', ')[1] || der.paramText)}` : `tank height ${der.paramText}`})` : ''}` });
          if (res.some((pb) => pb.overrideId)) out.push({ plant: key, kind: 'override', tag: e.tag, text: `${plantName(key)} · ${e.tag} keeps its own ${(() => { const vs = bandsT.map((b) => z.perBand[b].value); const lastNum = vs.map((x) => x != null).lastIndexOf(true); return vs.map((v, i) => (v == null ? 'none' : i === lastNum ? unitText(v, s.unit, s.kind) : numText(v))).join(' / '); })()} (Override)` });
        });
        if (gaps.length) { const pk = (zoneInfo(key, dOf(key).sensors.find((x) => x.on === `eq:${gaps[0].id}` && x.name === t.reading).id, t.dir).perBand[BANDS.find((b) => t.rules[b])] || {}).needs; out.push({ plant: key, kind: 'gap', tags: gaps.map((e) => e.tag), text: `${plantName(key)} · ${gaps.map((e) => e.tag).join(', ')}: can't resolve, no ${pk ? pk.label : 'parameter'}` }); }
        if (missing.length) out.push({ plant: key, kind: 'needs', count: missing.length, text: `${plantName(key)}: needs a ${t.reading} sensor (${missing.length} ${_.noun(missing[0].type, missing.length)})` });
      });
      return out;
    });
  }
  function readingCards(owner, sensorsList) {
    const tl = tplsOf(owner).filter((t) => t.kind === 'trigger'); const names = [...new Set([...(sensorsList || []).map((s) => s.name), ...tl.map((t) => t.reading)])];
    return names.map((name) => { const cs = (sensorsList || []).find((s) => s.name === name) || {}; const ts = tl.filter((t) => t.reading === name); const unit = cs.unit || readingUnit(name);
      return { name, tag: cs.tag || null, unit, kind: cs.kind || null, valid: cs.valid || null, dirs: ts.map((t) => ({ dir: t.dir, dirWord: t.dir === 'below' ? 'falls below' : 'rises above', templateId: t.id, templateName: t.name, v: t.v, title: `${t.name} v${t.v}`, rules: rulesView(t, unit), rulesText: rulesLine(t, unit), flagged: BANDS.some((b) => constantFlagOf(t, b)), flagText: BANDS.some((b) => constantFlagOf(t, b)) ? 'This scales with the plant. Use a design parameter?' : null, chip: chipOf({ src: 'library', template: t.name, v: t.v }), resolvesAt: resolvesAt(t.id) })) }; });
  }
  function libTypes() {
    return cached('kc:libtypes', () => (window.CATALOGUE || []).map((cat) => {
      const anchor = isAnchor(cat.code); const owner = { kind: 'eqType', code: cat.code, typeName: cat.type }; const tl = anchor ? [] : tplsOf(owner);
      const per = ORDER.filter((k) => dOf(k)).map((k) => ({ key: k, name: plantName(k), count: dOf(k).equipment.filter((e) => e.type === cat.type).length })).filter((x) => x.count);
      return { code: cat.code, typeName: cat.type, typeKey: `eq:${cat.code}`, family: _.familyOf(cat), archetype: cat.archetype, tier: typeDefaultTier(cat.code), version: typeVersion(`eq:${cat.code}`), anchor, movedTo: anchor && fnOf('upTypesForCode') ? safe(() => V.upTypesForCode(cat.code), []) : [], draft: tl.some((t) => L().drafts && L().drafts[t.id]), plants: per, plantCount: per.length, equipmentCount: per.reduce((n, x) => n + x.count, 0), readings: cat.sensors.length, alerts: tl.filter((t) => t.kind === 'trigger').length, tasks: tl.filter((t) => t.kind === 'task').length, templates: tl.map((t) => t.id), issues: anchor ? 0 : V.issueTypes(cat.type).length, generalTasks: anchor ? 0 : (C.tasksOf ? C.tasksOf(cat.type).length : 0), nextPhase: ((cat.nextPhase || {}).readings || []).length + ((cat.nextPhase || {}).alerts || []).length, flags: tl.filter((t) => BANDS.some((b) => constantFlagOf(t, b))).length, paramsExpected: [...new Set(tl.flatMap((t) => [...(t.rules ? BANDS.map((b) => t.rules[b]) : []), ...(t.condition ? [t.condition.doWhen, t.condition.doneWhen] : [])].filter((r) => r && r.kind === 'expr').map((r) => r.param)))], suggestions: 0 };
    }));
  }
  function libType(code) {
    const cat = catByCode(code); if (!cat) return null; const sum = libTypes().find((x) => x.code === code) || {}; const anchor = !!sum.anchor; const owner = { kind: 'eqType', code, typeName: cat.type }; const tl = anchor ? [] : tplsOf(owner);
    const moved = (sum.movedTo || []).map((id) => { const u = upTypeById(id); return { id, name: u ? u.name : id, href: `#/library/up-types/${id}` }; });
    return { ...sum, typeName: cat.type, banner: anchor ? `Every ${cat.type} in the plant graph is a unit process. Its readings, Triggers, Tasks and Issues are on the unit-process type: ${moved.map((m) => m.name).join(', ')}.` : null, movedToTypes: moved,
      readings: anchor ? [] : readingCards(owner, cat.sensors), alerts: tl.filter((t) => t.kind === 'trigger').map(tplView), schedules: tl.filter((t) => t.kind === 'task').map(tplView), issues: anchor ? [] : V.issueTypes(cat.type), generalTasks: anchor || !C.tasksOf ? [] : C.tasksOf(cat.type).map((x) => ({ id: x.id, name: x.name, workType: x.workType, frequency: x.frequency, flowId: x.flow })), nextPhase: cat.nextPhase || { readings: [], alerts: [], work: [] },
      changes: libChanges({}).filter((c) => (c.templateId && tl.some((t) => t.id === c.templateId)) || c.typeKey === `eq:${code}`), suggestions: [], confirm: cat.confirm || null, details: { params: sum.paramsExpected, defaultTier: typeDefaultTier(code) }, chipText: `Equipment type · v${sum.version}` };
  }
  function upTypeView(id) {
    const base = fnOf('upType') ? safe(() => V.upType(id), null) : null; const u = upTypeById(id); if (!base && !u) return null; const owner = { kind: 'upType', id, typeName: (base || u).name };
    const tl = tplsOf(owner); const cat = u ? catByCode(u.contentFrom) : null;
    return { ...(base || { id, name: u.name }), typeKey: `up:${id}`, version: typeVersion(`up:${id}`), templates: tl.map(tplView), readings: readingCards(owner, cat ? cat.sensors : []), alerts: tl.filter((t) => t.kind === 'trigger').map(tplView), schedules: tl.filter((t) => t.kind === 'task').map(tplView), issues: V.issueTypes(owner.typeName), changes: libChanges({}).filter((c) => (c.templateId && tl.some((t) => t.id === c.templateId)) || c.typeKey === `up:${id}`), chipText: `Unit-process type · v${typeVersion(`up:${id}`)}` };
  }
  function plantTypeView(id) {
    if (!PLANT_TYPES.includes(id)) return null; const owner = { kind: 'plantType', id, typeName: id }; const tl = tplsOf(owner);
    const plantsL = ORDER.filter((k) => dOf(k) && dOf(k).plant.type === id).map((k) => ({ key: k, name: plantName(k) }));
    const upIds = new Set(); const codes = new Set(); plantsL.forEach((p) => dOf(p.key).equipment.forEach((e) => { const o = ownerOfNode(p.key, e); if (o && o.kind === 'upType') upIds.add(o.id); else if (o) codes.add(o.code); }));
    return { id, name: id, typeKey: `plant:${id}`, version: typeVersion(`plant:${id}`), chipText: `Plant type · v${typeVersion(`plant:${id}`)}`, templates: tl.map(tplView), plants: plantsL, upTypes: [...upIds], eqTypes: [...codes] };
  }
  const plantTypes = () => PLANT_TYPES.map(plantTypeView);
  function conditions() {
    return cached('kc:conds', () => {
      const m = new Map(); const add = (reading, dir, use) => { const id = slug(`${reading}-${dir === 'below' ? 'below' : 'above'}`); if (!m.has(id)) m.set(id, { id, reading, op: dir === 'below' ? 'below' : 'above', opText: dir === 'below' ? 'falls below' : 'rises above', uses: [] }); m.get(id).uses.push(use); };
      Object.values(L().tpl || {}).forEach((t) => {
        if (t.kind === 'trigger') BANDS.forEach((b) => { if (t.rules[b]) add(t.reading, t.dir, { templateId: t.id, templateName: t.name, ownerName: ownerName(t.owner), band: b, ruleText: ruleText(t.rules[b], readingUnit(t.reading)), text: `${t.name} ${BAND_LABEL[b]}: ${ruleText(t.rules[b], readingUnit(t.reading))}` }); });
        else if (t.condition && t.condition.reading) ['doWhen', 'doneWhen'].forEach((k) => { const r = t.condition[k]; if (r) add(t.condition.reading, t.condition.op, { templateId: t.id, templateName: t.name, ownerName: ownerName(t.owner), field: k, ruleText: ruleText(r, readingUnit(t.condition.reading)), text: `${t.name} ${k === 'doWhen' ? 'do when' : 'done when'}: ${ruleText(r, readingUnit(t.condition.reading))}` }); });
      });
      return [...m.values()].map((c) => ({ ...c, title: `${c.reading} · ${c.opText}`, usedBy: new Set(c.uses.map((u) => u.templateId)).size, usedByText: `Used by ${plural(new Set(c.uses.map((u) => u.templateId)).size, 'template')}` }));
    });
  }
  const condition = (id) => conditions().find((c) => c.id === id) || null;
  const flows = () => cached('kc:flows', () => ((C.S && C.S.lib && C.S.lib.flows) || []).map((f) => ({ id: f.id, name: f.name, kind: f.kind || null, steps: (f.steps || []).length, version: f.version || null })));
  const flow = (id) => { const f = ((C.S && C.S.lib && C.S.lib.flows) || []).find((x) => x.id === id); return f ? clone(f) : null; };
  const rootCauses = () => cached('kc:causes', () => ((C.S && C.S.lib && C.S.lib.causes) || []).map((c) => ({ id: c.id, name: c.name, types: (c.types || []).slice(), fixFlowId: c.fix || null, sensorFault: !!c.sensorFault })));
  const rootCause = (id) => { const c = ((C.S && C.S.lib && C.S.lib.causes) || []).find((x) => x.id === id); return c ? clone(c) : null; };

  /* ── the seed ──────────────────────────────────────────────────────────────────────────────── */
  /* before v7/1's seed steps: the templates exist (built from the library and its unit-process copies) and Vedanta's
     person-entered tank height is in place, so the trial the seed records runs on Alex's limit rules */
  let seedPersonResolved = 0;
  _.onSeed('before', () => {
    const s = S(); const lib = s.lib;
    lib.typeVersions = {}; lib.tpl = {}; lib.tplHistory = {}; lib.typeDrafts = {}; lib.typeFields = {}; lib.forced = {}; lib.majorDrafts = [];
    if (!lib.drafts) lib.drafts = {}; if (!Array.isArray(lib.changes)) lib.changes = []; if (!Array.isArray(lib.variantRequests)) lib.variantRequests = [];
    s.pins = []; s.majorHolds = []; s.params = {}; s.held = {}; s.paramUndo = [];
    buildTemplates();
    const sp = SEED_PERSON; const e = _.eqRaw(sp.plant, sp.nodeId);
    if (e) {
      const count = () => nodeSensors(sp.plant, sp.nodeId).filter((x) => zoneDirs(sp.plant, x).some((dir) => { const z = zoneInfo(sp.plant, x.id, dir); return z && BANDS.some((b) => z.bands[b] != null); })).length;
      touch(); const before = count();
      writeParam(sp.plant, sp.nodeId, sp.param, sp.value, { by: sp.by, at: T(sp.at), note: sp.note }); touch();
      seedPersonResolved = Math.max(0, count() - before);
    }
    touch();
  });
  /* after them: every Trigger, Task and job names its template; the 20 Oct library change is a template version */
  _.onSeed('after', () => {
    const s = S(); const lib = s.lib;
    ORDER.forEach((key) => {
      const d = dOf(key); if (!d) return;
      d.alerts.forEach((a) => { const id = templateIdOfAlert(key, a); if (id) a.templateId = id; });
      d.schedules.forEach((sc) => { const id = templateIdOfSchedule(key, sc); if (id) sc.templateId = id; });
      (d.conditionWork || []).forEach((w) => { const id = templateIdOfWork(key, w); if (id) w.templateId = id; });
    });
    touch();
    const sp = SEED_PUBLISH; const cur = tplRaw(sp.templateId);
    if (cur && cur.v === 1) {
      const at = T(sp.at); const v1 = clone(cur); const v2 = { ...clone(cur), v: 2, hold: sp.hold };
      const diffs = [{ field: 'hold', band: null, which: null, from: v1.hold, to: sp.hold, text: `persistence ${v1.hold} → ${sp.hold} min` }];
      lib.tpl[sp.templateId] = v2; lib.tplHistory[sp.templateId] = [{ v: 1, at: null, by: null, kind: null, note: '', reason: null, diffs: [], body: v1 }, { v: 2, at, by: sp.by, kind: 'minor', note: sp.note, reason: null, diffs, body: clone(v2) }];
      writeV6(v2); touch();
      const inst = instancesOf(sp.templateId); const moved = []; inst.triggers.forEach((x) => { const r = timingRec(x.plant, x.alertId, 'persistence'); if (r) moved.push(r.id); });
      const i = lib.changes.findIndex((c) => c.code === 'CLARIFIER'); const id = i >= 0 ? lib.changes[i].id : _.counterId('cseq', 'pub');
      const change = { id, templateId: sp.templateId, name: cur.name, owner: { ...cur.owner }, typeName: ownerName(cur.owner), v: 2, version: 2, at, by: sp.by, who: sp.by, kind: 'minor', note: sp.note, reason: null, diffs, reached: { follow: plantsIn(inst.triggers), baseMoved: moved, cleared: [], suspended: [], pinned: [], frozen: [], drafts: [], gaps: [] }, plants: [], countFrom: null, text: diffs[0].text };
      if (i >= 0) lib.changes.splice(i, 1, change); else lib.changes.unshift(change);
      lib.versions = {};
      const text = `Published ${cur.name} v2 (Minor): ${diffs[0].text}. ${sp.note}`;
      if (!_.replaceActivity(null, (x) => /^Published Clarifier Tank v2\b/.test(x.text), { text, kind: 'library', who: sp.by, at, library: true })) act(at, null, text, 'library', sp.by);
      _.replaceActivity('*', (x) => !!x.plant && /Clarifier Tank v2/.test(x.text), null);
    }
    const P = SEED_PERSON; const ent = personParams(P.plant, P.nodeId)[P.param]; const e = _.eqRaw(P.plant, P.nodeId);
    if (ent && e) _.addActivityAt(T(P.at), P.plant, P.by, `Design parameter on ${e.tag}: ${lowerParam(P.param)} none → ${ent.value.toFixed(1)} ${PARAMS[P.param].unit}${seedPersonResolved ? ` (${plural(seedPersonResolved, 'reading')} resolved)` : ''}: ${P.note}`, 'config');
    touch();
  });

  /* ── hooks ─────────────────────────────────────────────────────────────────────────────────── */
  _.hook('terms', triggerTerms);
  const prevOpened = _.HOOKS.issueOpened; const prevClosed = _.HOOKS.issueClosed;
  _.hook('issueOpened', (key, iss) => { if (prevOpened) prevOpened(key, iss); if (iss && iss.alertId != null) holdTrigger(key, iss.alertId, iss); });
  _.hook('issueClosed', (key, iss, at) => { if (prevClosed) prevClosed(key, iss, at); if (iss && iss.alertId != null) releaseHeld(key, iss.alertId, at); });
  /* a Trigger's view: its name, template, the terms it runs on, and whether it is held */
  _.decorate('alert', (v, key) => {
    const a = _.alertRaw(key, v.id); if (!a) return v;
    const tid = templateIdOfAlert(key, a); const t = tid ? tplRaw(tid) : null; const tm = triggerTerms(key, v.id); const h = heldRaw(key, v.id); const open = openIssueIds(key, v.id).length; const p = tid ? activePin(key, tid) : null;
    return { ...v, name: triggerName(key, v.id), dataName: a.name, templateId: tid, templateName: t ? t.name : null, templateVersion: tid ? (h && h.templateVersion != null ? h.templateVersion : versionAt(key, tid)) : null, templateCurrent: t ? t.v : null, bands: tm ? { ...tm.bands } : v.bands, entryBand: tm ? BANDS.find((b) => tm.bands[b] != null) || null : v.entryBand, hold: timingOf(key, v.id, 'hold') || v.hold, clear: timingOf(key, v.id, 'clear') || v.clear, held: !!h, frozen: !!h && open > 0, waiting: !!h && !open, pinnedTo: p ? p.v : null };
  });

  /* ── v7/1's library functions are gone in v7/2 ─────────────────────────────────────────────── */
  const gone = () => { throw new Error('v7/2: use the template functions'); };

  /* ── exports ───────────────────────────────────────────────────────────────────────────────── */
  Object.assign(V, {
    PARAMS: clone(PARAMS), PLANT_PARAMS: clone(PLANT_PARAMS), SIZE_DEPENDENT: SIZE_DEPENDENT.slice(), PUBLISH_KINDS: KINDS.slice(), KIND_LABEL: { ...KIND_LABEL },
    templates, template, tplVersion, tplBodyAt: tplBodyAtPlant, versionAt, templateOf, ruleText, constantFlag, triggerName, addSingleUse,
    designParams, designParamPreview, setDesignParam, undoDesignParam, canUndoDesignParam, resolveRule, designParamsMissing,
    zoneInfo, limitsOf, zoneCheck, triggerTerms, triggerBands, timingOf, cadenceOf, conditionOf, sourceOf, limitGaps, syncZone, readings, readingsTab, bindingProposals,
    holdTrigger, releaseHeld, isFrozen, heldOf, markMoved, resyncPreview, resync,
    editTemplate, templateDraft, discardTemplateDraft, downstream, publishTemplate, editTypeField, publishTypeField, typeDefaultTier,
    pin, unpin, pins, liftForced, majorDrafts, acceptMajorDraft, libChanges,
    libTypes, libType, upTypeView, plantTypes, plantTypeView, conditions, condition, flows, flow, rootCauses, rootCause, typeVersion, resolvesAt,
    libVersion: (code) => typeVersion(`eq:${code}`),
    libDraft: gone, editLib: gone, discardDraft: gone, whereItLands: gone, publish: gone, libLimits: gone,
  });
  /* this file's internals, for the tests (never for page code) */
  V.__library = { buildTemplates, ownerOfNode, ownerKey, templateIdOfAlert, templateIdOfSchedule, templateIdOfWork, instancesOf, paramValue, zoneDirs, heldRaw, openIssueIds, forcedOf, activePin, majorHoldOf, downstreamBefore, applyDraft, slug, numText, unitText, HEIGHT_CODES, MOTOR_CODES, INTAKE, MANUAL_ERR, SEED_PUBLISH, SEED_PERSON };
})();
