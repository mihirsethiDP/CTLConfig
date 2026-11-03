/* core72-ledger.js — the plant-value ledger of v7/2 (CloseTheLoop configuration, Alex's model as drafted).
   One override record per value a plant sets for itself, asked for with one of five reasons; the Deviations model that lists
   every override, pin, base-moved value, single-use template and structure change; the one chip formatter for value sources;
   and the migration that turns v7/1's imported differences into Alex's records after the seed.
   Loads after core7.js, core72-structure.js and core72-library.js (each optional: when the library file is not loaded, the
   bases come from core7's own resolvers). Never touches the DOM; runs headless in node. Adds to window.V7; replaces v7/1's
   setLimits, setAlertTiming, setCadence, setTier, overrides, revert, revertAll, revertPreview and keep, and removes suggest and
   suggestions (a plant asks for a library variant instead).

   ─── The record (in V7.S.overrides) ──────────────────────────────────────────────────────────────────────────────────────
   {id, plant, target, field, value, base, baseSource 'library'|'derived'|'algorithm'|'gap'|'sensor', baseOwner {kind, code,
    name, typeName, typeKey, templateId, templateName, version} | null, baseVersion, reason, note, author (null = not recorded),
    at, reviewBy, expires (Temporary only), status 'active'|'reverted'|'expired'|'promoted'|'cleared', endedAt, endedBy,
    endedNote, suspendedBy (a Forced library change while in force), variantRequest, history [{at, who, text}]}
   Targets: zone {sensorId, dir, band} · triggerLimit {alertId, dir, band} · persistence {alertId} · clearing {alertId} ·
   enabled {alertId}|{scheduleId} · cadence {scheduleId} · runhours {scheduleId} · condition {workId, which: 'doWhen'|'doneWhen'}
   · tier {eqId}. The structure file writes member, uptype and cg records into the same array; this file lists them.
   Reasons: physical · regulatory · structural · tuning · temporary (offered, in that order) and migrated (never offered).
   New records take ids from this file's own counter ('ovr_<n>'); migrated values with no v7/1 record 'ovm_<plant>_<id>_<field>'.

   ─── API (window.V7) ────────────────────────────────────────────────────────────────────────────────────────────────────
   Write:   setOverride(key, target, value, {reason, note, reviewBy, expires, trait, variantOnly}) → {ok, id, changed:[{field,
              from, to}], frozen:[{alertId, name, open}], variantRequestId?, ended?} | {ok:false, error, field, code?}
              (the one writer of plant values; a value equal to its base ends the override with no reason asked)
            checkOverride(key, target, value, opts) → null | {error, field} · overrideDefaults(reason, {at}) → {reviewBy,
              reviewByEditable, expiresMax} · reasonsFor(key, target) → reason keys offered · physicalPath(key, target) →
              {kind 'param'|'const'|'none', text, href?, primary?} · overridePreview(key, target, value) → {lines, triggers,
              count, countNow, mode 'live'|'trial', frozenLines, nextDue?}
            setLimits(key, sensorId, dir, bands, opts) · setZone(key, sensorId, dir, band, value, opts) · setTriggerLimit(key,
              alertId, band, value, opts) · revertTriggerLimit(key, alertId, band) · setAlertTiming(key, alertId, {hold, clear},
              opts) · setCadence(key, taskOrScheduleId, {n, unit, runHours}, opts) · setRunHours(key, scheduleId, hours, opts) ·
              setCondition(key, workId, which, value, opts) · setTier(key, eqId, tier, opts) · setEnabled(key, id, on, opts)
   Act:     revert(id, {note}) · revertPreview(id) · revertAll(id) · adopt(id) · keep(id, {note}) · extend(id, {reviewBy |
              expires, note}) · promote(id, {as: 'default'|'variant', trait, note}) · promoted(id, changeId) · requestVariant(
              {plant, ownerCode, trait, note, fromOverride}) · variantRequests(ownerCode?) · singleUse({plant}) ·
              keepSingleUse(id) · mergeSingleUse(id)
   Library: ledgerOnBaseChange({plant?, match(target, record), changeId, owner, version, kind: 'minor'|'major'|'forced'|
              'derived'}) → {cleared, suspended} · ledgerLiftForced(changeId) (also V7.liftForced when nothing else holds it)
   Read:    ovState(record) · overrides({plant, state, reason, kind, eqId, owner}) · deviations({plant, show, reason,
              plantFilter, template, eqId}) · deviationCounts(key) · fieldId(target) · fieldHref(record) · chipFor(src)
   chipFor(src) → {text, tone, sub, small, extra?}. src.src: library {template|typeName, v, singleUse?:{plant}} · derived
     {ruleText, paramText} · override {reason, author, at, reviewBy, expires, baseText, baseSource} · basemoved {old, new} ·
     suspended {template, v} · forced {template, v} · pinned {v, latest, x} · proposed · followsSensor {tag, zoneText|zone} ·
     triggerOverride {reason, sensorValueText} · gap {paramLabel, tag} (none: "Gap · no rule") · frozen {n} · held · next ·
     single {plant}. Tones: lib der ovr moved susp forced pin prop gap frozen next single (and review for a row state).
   Hooks this file registers: seed 'after' (the migration), 'advanceBoundaries' and 'advanceAt' (Temporary expiries; both
   call whatever an earlier file registered), and 'terms' only when no other file registered it (per-Trigger limits). */
(function () {
  'use strict';
  const V = window.V7;
  if (!V || !V.__) return;
  const _ = V.__;
  const C = window.CTL;
  const { T, DAY, MIN, BANDS, BAND_LABEL, ME, ORDER } = _;
  const LABELS = V.LABELS;
  const S = () => _.S;

  /* ── constants ─────────────────────────────────────────────────────────────────────────────── */
  const REASONS = ['physical', 'regulatory', 'structural', 'tuning', 'temporary'];
  const TRIGGER_LIMIT_REASONS = ['structural', 'tuning', 'temporary'];
  const GAP_REASONS = ['physical', 'tuning'];
  const NOTE_REQUIRED = ['tuning', 'regulatory'];
  const REVIEW_DAYS = { physical: 365, regulatory: 365, structural: 365, tuning: 90, migrated: 90 };
  const TEMP_MAX_DAYS = 30;
  /* migration is dated at the plant's go-live (Alex's drafts give no date); review 90 days later */
  const MIGRATED_AT = { manesar: T('2026-09-01T09:00') };
  const VALUE_KINDS = ['zone', 'triggerLimit', 'persistence', 'clearing', 'enabled', 'cadence', 'runhours', 'condition', 'tier'];
  const STRUCTURE_KINDS = ['member', 'uptype', 'cg'];
  const KIND_V2 = { limit: 'zone', hold: 'persistence', clear: 'clearing', onoff: 'enabled' };
  const REASON_V2 = { tuned: 'tuning', fornow: 'temporary', unrecorded: 'migrated', notinlib: 'migrated' };
  const HISTORY_STATES = ['reverted', 'expired', 'promoted', 'cleared'];
  const MANUAL_ERR = 'Hand-test results stay in the task record: they have no sensor, so no Zones.';
  const FROZEN = { ok: false, code: 'frozen', error: 'This Trigger is frozen while its Issue is open.' };
  const RESYNC = { ok: false, code: 'resync', error: 'Resync this Trigger first: it is still on the terms it was frozen on.' };
  /* the seed's own value with a reason v7/1 called "tuned": a pickling line upstream is how Vedanta's EQ-1 is built */
  const SEED_REASON = [{ plant: 'vedanta', kind: 'zone', sensorId: 'v_eq1_PH', band: 'emergency', reason: 'physical' }];
  /* used only while the library file is not loaded: the Blower's intake-filter job is set from the full-load current */
  const CONDITION_FALLBACK = { 'Clean intake filter': { doWhen: 0.95, doneWhen: 0.85 } };

  /* labels: the v7/2 words; v7/1's keys stay readable (hidden) for core7's own seed steps */
  const withOld = (fresh, old) => { const o = { ...fresh }; Object.keys(old || {}).forEach((k) => { if (!(k in o)) Object.defineProperty(o, k, { value: old[k], enumerable: false, writable: true, configurable: true }); }); return o; };
  LABELS.reason = withOld({ physical: 'Physical', regulatory: 'Regulatory or client', structural: 'Structural', tuning: 'Tuning', temporary: 'Temporary', migrated: 'Migrated', structure: 'Structure change' }, LABELS.reason);
  LABELS.reasonOption = {
    physical: 'Physical: this plant is built differently → set a design parameter instead',
    regulatory: 'Regulatory or client',
    structural: 'Structural: this kind always differs → request a library variant',
    tuning: 'Tuning',
    temporary: 'Temporary (needs an expiry)',
  };
  LABELS.overrideState = withOld({ active: 'Active', basemoved: 'Base moved', pastreview: 'Past review', suspended: 'Suspended', expired: 'Expired', reverted: 'Reverted', promoted: 'Promoted', cleared: 'Cleared', underneath: 'Changed underneath' }, LABELS.overrideState);
  LABELS.tier = { A: 'A', B: 'B', C: 'C' };

  /* ── small helpers ─────────────────────────────────────────────────────────────────────────── */
  const safe = (fn, fb) => { try { const r = fn(); return r === undefined ? fb : r; } catch (e) { return fb; } };
  const fnOf = (name) => (typeof V[name] === 'function' ? V[name] : null);
  const now = () => _.now();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const P = (key) => _.PS(key);
  const d = (key) => _.dOf(key);
  const dMon = (ms) => { if (ms == null) return '—'; const p = _.parts(ms); return `${p.day} ${p.mon}`; };
  const fmtDate = (ms) => _.fmtDate(ms);
  const plural = (n, w, ws) => _.plural(n, w, ws);
  const timesWord = (n) => (n === 1 ? 'time' : 'times');
  const isValueKind = (o) => !!o && !!o.target && VALUE_KINDS.includes(KIND_V2[o.target.kind] || o.target.kind);
  const isStructureKind = (o) => !!o && !!o.target && STRUCTURE_KINDS.includes(o.target.kind);
  const statusOf = (o) => (o.status ? o.status : o.endedAt != null ? 'reverted' : 'active');
  const isLive = (o) => statusOf(o) === 'active';
  const reasonOf = (o) => REASON_V2[o.reason] || o.reason;
  const plantName = (key) => _.plantName(key);
  const youOr = (who) => (who == null ? 'not recorded' : who === ME ? 'you' : who);
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
  const endOfDay = (ms) => T(`${_.isoDay(ms)}T23:59`);
  /* one Activity line from this file (marked, so a reader can tell the ledger's own lines) */
  const act = (at, plant, text, kind, who) => _.addActivity({ at, plant, text, kind: kind || 'config', who, ledger: true });
  const asMs = (x) => { if (x == null || x === '') return null; if (typeof x === 'number') return Number.isFinite(x) ? x : null; return _.toMs(x); };

  /* numbers: v7/1's rounding, with thousands grouped ("2,500"); a derived ampere or metre value keeps one decimal ("40.0 A") */
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
  const oneDpFor = (unit, src) => src === 'derived' && (unit === 'A' || unit === 'm');
  const everyText = (ev) => (ev && ev.n ? _.everyText(ev) : 'no cadence');

  /* ── targets ───────────────────────────────────────────────────────────────────────────────── */
  function normTarget(t0) {
    if (!t0 || typeof t0 !== 'object') return null;
    const kind = KIND_V2[t0.kind] || t0.kind;
    if (kind === 'zone') return t0.sensorId && BANDS.includes(t0.band) ? { kind, sensorId: t0.sensorId, dir: t0.dir || null, band: t0.band } : null;
    if (kind === 'triggerLimit') return t0.alertId && BANDS.includes(t0.band) ? { kind, alertId: t0.alertId, dir: t0.dir || null, band: t0.band } : null;
    if (kind === 'persistence' || kind === 'clearing') return t0.alertId ? { kind, alertId: t0.alertId } : null;
    if (kind === 'enabled') return t0.alertId ? { kind, alertId: t0.alertId } : t0.scheduleId ? { kind, scheduleId: t0.scheduleId } : null;
    if (kind === 'cadence' || kind === 'runhours') return t0.scheduleId ? { kind, scheduleId: t0.scheduleId } : null;
    if (kind === 'condition') return t0.workId && (t0.which === 'doWhen' || t0.which === 'doneWhen') ? { kind, workId: t0.workId, which: t0.which } : null;
    if (kind === 'tier') return t0.eqId ? { kind, eqId: t0.eqId } : null;
    return null;
  }
  function sameTarget(a0, b0) {
    const a = normTarget(a0), b = normTarget(b0); if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'zone') return a.sensorId === b.sensorId && a.band === b.band && (!a.dir || !b.dir || a.dir === b.dir);
    if (a.kind === 'triggerLimit') return a.alertId === b.alertId && a.band === b.band;
    if (a.kind === 'condition') return a.workId === b.workId && a.which === b.which;
    if (a.kind === 'tier') return a.eqId === b.eqId;
    if (a.kind === 'enabled') return (a.alertId && a.alertId === b.alertId) || (a.scheduleId && a.scheduleId === b.scheduleId);
    if (a.kind === 'cadence' || a.kind === 'runhours') return a.scheduleId === b.scheduleId;
    return a.alertId === b.alertId;
  }
  /* the record on a target that is still in force (suspended ones included: they come back when a Forced change is lifted) */
  const findRec = (key, t) => (S() ? S().overrides.find((o) => o.plant === key && isValueKind(o) && isLive(o) && sameTarget(o.target, t)) || null : null);
  function fieldId(target) {
    const t = normTarget(target) || target || {};
    if (t.kind === 'zone') return `zone.${t.dir}.${t.band}`;
    if (t.kind === 'triggerLimit') return `band.${t.band}`;
    if (t.kind === 'condition') return `condition.${t.which}`;
    if (t.kind === 'member') return `participation.${t.upId}`;
    if (t.kind === 'uptype') return 'uptype';
    if (t.kind === 'cg') return `cg.${t.cgId}`;
    return t.kind || '';
  }
  const FIELD_LABEL = { persistence: 'persistence', clearing: 'clearing', enabled: 'enabled', cadence: 'cadence', runhours: 'run-hours', tier: 'criticality tier' };
  function fieldLabel(t) {
    if (t.kind === 'zone') return `${BAND_LABEL[t.band]} zone`;
    if (t.kind === 'triggerLimit') return `${BAND_LABEL[t.band]} band`;
    if (t.kind === 'condition') return t.which === 'doWhen' ? 'do when' : 'done when';
    return FIELD_LABEL[t.kind] || t.kind;
  }

  /* ── what a target is about ────────────────────────────────────────────────────────────────── */
  const isUp = (key, nodeId) => !!safe(() => fnOf('isUp') && V.isUp(key, nodeId), false);
  const nodeTag = (key, id) => { const e = id ? _.eqRaw(key, id) : null; return e ? e.tag : id || ''; };
  function trigName(key, alertId) {
    const own = String((_.alertRaw(key, alertId) || {}).name || '').replace(/ — /g, ' · ');
    const f = fnOf('triggerName'); const r = f ? safe(() => f(key, alertId), null) : null;
    return typeof r === 'string' && r ? r : own;
  }
  function taskName(key, sc) { if (!sc) return ''; const e = sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(key, sc.subject.id) : null; return e ? `${sc.name} on ${e.tag}` : sc.name; }
  const workRaw = (key, id) => { const dd = d(key); return dd ? (dd.conditionWork || []).find((w) => w.id === id) || null : null; };
  /* the node a value sits on (its equipment or unit process), for grouping, links and "All deviations on {tag}" */
  function nodeOf(key, t) {
    if (t.kind === 'zone') { const s = _.sensorRaw(key, t.sensorId); const e = s ? _.homeOf(key, s) : null; return e ? e.id : null; }
    if (t.alertId) { const a = _.alertRaw(key, t.alertId); return a && a.subject ? a.subject.id || null : null; }
    if (t.scheduleId) { const sc = _.schedRaw(key, t.scheduleId); return sc && sc.subject && sc.subject.kind === 'eq' ? sc.subject.id : null; }
    if (t.workId) { const w = workRaw(key, t.workId); return w && w.subject ? w.subject.id : null; }
    if (t.eqId) return t.eqId;
    return null;
  }
  function whatOf(key, t) {
    if (t.kind === 'zone') { const s = _.sensorRaw(key, t.sensorId) || {}; return `${s.tag || s.name || t.sensorId} · ${fieldLabel(t)}`; }
    if (t.alertId) return `${trigName(key, t.alertId)} · ${fieldLabel(t)}`;
    if (t.scheduleId) return `${taskName(key, _.schedRaw(key, t.scheduleId))} · ${fieldLabel(t)}`;
    if (t.workId) { const w = workRaw(key, t.workId); return `${w ? taskName(key, w) : t.workId} · ${fieldLabel(t)}`; }
    if (t.kind === 'tier') return `${nodeTag(key, t.eqId)} · criticality tier`;
    return fieldLabel(t);
  }

  /* ── the library side of a value: owner, template, version (the library file decides; core7's sets otherwise) ── */
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  function ownerFromType(typeName) {
    if (!typeName) return null; const set = _.setOf(typeName);
    if (set && set.upType) return { kind: 'upType', code: set.upType, name: typeName, typeName, typeKey: `up:${set.upType}`, version: 1 };
    const code = _.codeOfType(typeName); const lt = code && fnOf('libType') ? safe(() => V.libType(code), null) : null;
    return { kind: 'eqType', code, name: typeName, typeName, typeKey: code ? `eq:${code}` : null, version: (lt && lt.version) || _.libVersion(code) || 1 };
  }
  function ownerFromTemplate(tpl) {
    if (!tpl || !tpl.owner) return null; const o = tpl.owner; const code = o.code || o.id || null;
    const kind = o.kind || 'eqType'; const typeKey = kind === 'upType' ? `up:${code}` : kind === 'plantType' ? `plant:${code}` : `eq:${code}`;
    return { kind, code, name: o.typeName || o.name || code, typeName: o.typeName || o.name || code, typeKey };
  }
  const tplById = (id) => (id && fnOf('template') ? safe(() => V.template(id), null) : null);
  const tplVersion = (tpl, id) => (tpl && tpl.v) || (id && fnOf('tplVersion') ? safe(() => V.tplVersion(id), null) : null) || 1;
  function predictTplId(owner, name) { if (!owner || !name) return null; return owner.kind === 'upType' ? `tpl_up_${owner.code}_${slug(name)}` : owner.kind === 'plantType' ? `tpl_PLANT_${owner.code}_${slug(name)}` : `tpl_${owner.code}_${slug(name)}`; }
  /* {templateId, templateName, templateVersion, owner} for the Trigger, Task or band a target belongs to */
  function libSideOf(key, t, z) {
    let tpl = null; let tid = null;
    if (t.kind === 'zone' && z && z.templateId) tid = z.templateId;
    else if (t.alertId) { const a = _.alertRaw(key, t.alertId); tid = (a && a.templateId) || null; if (!tid && fnOf('templateOf')) { const r = safe(() => V.templateOf(key, t.alertId), null); tid = r && typeof r === 'object' ? r.id : r || null; if (r && typeof r === 'object') tpl = r; } }
    else if (t.scheduleId) { const sc = _.schedRaw(key, t.scheduleId); tid = (sc && sc.templateId) || null; const su = singleUseFor(key, t.scheduleId); if (!tid && su) tid = su.id; }
    else if (t.workId) { const w = workRaw(key, t.workId); tid = (w && w.templateId) || null; }
    if (!tpl && tid) tpl = tplById(tid);
    if (tpl) return { templateId: tpl.id || tid, templateName: tpl.name, templateVersion: tplVersion(tpl, tid), owner: ownerFromTemplate(tpl) };
    /* core7's library: the node's library type and the entry of the same reading, Task or job */
    const nodeId = nodeOf(key, t); const e = nodeId ? _.eqRaw(key, nodeId) : null; const typeName = e ? _.libKey(e) : null; const owner = ownerFromType(typeName);
    let name = null;
    if (t.kind === 'zone' || t.alertId) {
      const s = t.kind === 'zone' ? _.sensorRaw(key, t.sensorId) : _.sensorRaw(key, (_.alertRaw(key, t.alertId) || {}).sensor);
      const dir = t.kind === 'zone' ? t.dir : t.alertId ? _.alertDir(key, _.alertRaw(key, t.alertId)) : null;
      const la = s && typeName ? _.libAlertFor(typeName, s.name, dir) : null; name = la ? la.name : null;
      if (!name && t.kind === 'zone' && s) name = s.name;
      if (!la && t.kind === 'zone') return { templateId: null, templateName: name, templateVersion: null, owner };
    } else if (t.scheduleId) {
      const sc = _.schedRaw(key, t.scheduleId); const su = singleUseFor(key, t.scheduleId);
      if (su) return { templateId: su.id, templateName: su.name, templateVersion: 1, owner: ownerFromType(su.typeName) || owner, singleUse: su };
      name = sc ? sc.name : null;
      if (sc && sc.subject && sc.subject.kind !== 'eq') { const pt = (d(key) || { plant: {} }).plant.type; return { templateId: predictTplId({ kind: 'plantType', code: pt }, name), templateName: name, templateVersion: 1, owner: { kind: 'plantType', code: pt, name: pt, typeName: pt, typeKey: `plant:${pt}` } }; }
    } else if (t.workId) { const w = workRaw(key, t.workId); name = w ? w.name : null; }
    else if (t.kind === 'tier') { const cat = e ? _.catByType(e.type) : null; const o2 = ownerFromType(e ? (isUp(key, e.id) ? _.libKey(e) : e.type) : null); return { templateId: null, templateName: null, templateVersion: (o2 && o2.version) || 1, owner: o2, catCode: cat ? cat.code : null }; }
    return { templateId: predictTplId(owner, name), templateName: name, templateVersion: (owner && owner.version) || 1, owner };
  }

  /* ── the value at a plant, its base and where the base comes from ─────────────────────────────── */
  function zoneAll(key, sensorId, dir) {
    const s = _.sensorRaw(key, sensorId); if (!s) return null;
    const zi = fnOf('zoneInfo') ? safe(() => V.zoneInfo(key, sensorId, dir), null) : null;
    const out = { unit: s.unit, kind: s.kind, bands: {}, perBand: {}, templateId: null, templateVersion: null };
    if (zi && zi.perBand) {
      out.templateId = zi.templateId || null; out.templateVersion = zi.templateVersion || null;
      BANDS.forEach((b) => {
        const pb = zi.perBand[b] || {};
        const rec = findRec(key, { kind: 'zone', sensorId, dir, band: b }); const base = pickBase(pb, rec && !rec.suspendedBy ? rec : null, _.same);
        const rule = pb.rule || null;
        const src = base == null ? 'gap' : rule ? (rule.kind === 'expr' ? 'derived' : 'library') : pb.source === 'derived' ? 'derived' : 'library';
        out.perBand[b] = { value: pb.value != null ? pb.value : null, base: base != null ? base : null, baseSource: src, rule, ruleConst: !!(rule && rule.kind === 'const'), needs: pb.needs || null, metres: pb.metres != null ? pb.metres : null, ruleText: pb.ruleText || null };
        out.bands[b] = out.perBand[b].value;
      });
      return out;
    }
    const bi = _.bandsInfo(key, sensorId, dir); if (!bi) return null;
    BANDS.forEach((b) => {
      const pb = bi.perBand[b] || {};
      const base = pb.baseValue != null ? pb.baseValue : null;
      const src = pb.formValue != null ? 'derived' : pb.libValue != null ? 'library' : 'gap';
      out.perBand[b] = { value: pb.value != null ? pb.value : null, base, baseSource: src, rule: null, ruleConst: pb.formValue == null && pb.libValue != null, needs: null, metres: null, ruleText: null, fallbackParam: pb.formValue != null ? (s.name === 'Motor current' ? 'motorRating' : 'tankHeight') : null };
      out.bands[b] = out.perBand[b].value;
    });
    return out;
  }
  /* the base a resolver gives for a value: what the library or derivation gives without the plant's override */
  function pickBase(x, inForce, same) {
    if (x.resolved !== undefined) return x.resolved; if (x.baseValue !== undefined) return x.baseValue;
    const overridden = !!x.overrideId || (!!inForce && (same ? same(x.value, inForce.value) : x.value === inForce.value));
    if (overridden) return x.libValue !== undefined ? x.libValue : x.base !== undefined ? x.base : null;
    return x.value;
  }
  function timingBase(key, alertId, which, inForce) {
    const ti = fnOf('timingOf') ? safe(() => V.timingOf(key, alertId, which), null) : null;
    if (ti && typeof ti === 'object') { const b = pickBase(ti, inForce, _.same); return { base: b != null ? b : null, baseSource: b == null ? 'gap' : 'library' }; }
    const t0 = _.timingInfo(key, alertId, which); if (!t0) return { base: null, baseSource: 'gap' };
    return { base: t0.libValue != null ? t0.libValue : null, baseSource: t0.libValue != null ? 'library' : 'gap' };
  }
  function cadenceBase(key, scId, inForce) {
    const su = singleUseFor(key, scId);
    const ci = fnOf('cadenceOf') ? safe(() => V.cadenceOf(key, scId), null) : null;
    if (ci && typeof ci === 'object') { const b = pickBase(ci, inForce, (a, c) => sameVal('cadence', a, c)); return { base: b || null, baseSource: !b ? 'gap' : ci.source === 'derived' || ci.baseFrom === 'form' ? 'derived' : 'library' }; }
    if (su) return { base: su.every ? { ...su.every } : null, baseSource: 'library' };
    const c0 = _.cadenceInfo(key, scId); if (!c0) return { base: null, baseSource: 'gap' };
    return { base: c0.libValue || null, baseSource: !c0.libValue ? 'gap' : c0.baseFrom === 'form' ? 'derived' : 'library' };
  }
  function conditionBase(key, workId, which, inForce) {
    const co = fnOf('conditionOf') ? safe(() => V.conditionOf(key, workId), null) : null;
    const pf = co && co.perField ? co.perField[which] : null;
    if (pf) { const b = pf.resolved !== undefined ? pf.resolved : pickBase({ ...pf, baseValue: undefined, libValue: pf.libValue !== undefined ? pf.libValue : pf.base }, inForce, _.same); const src = pf.baseSource || (pf.src === 'derived' || pf.source === 'derived' ? 'derived' : b == null ? 'gap' : 'library'); return { base: b != null ? b : null, baseSource: b == null ? 'gap' : src, unit: co.unit }; }
    const w = workRaw(key, workId); if (!w) return { base: null, baseSource: 'gap' };
    const e = _.eqRaw(key, w.subject && w.subject.id); const s = _.sensorRaw(key, w.sensor);
    const rule = CONDITION_FALLBACK[w.name];
    if (rule && e) { _.withPlant(key, () => C.ensureForm(e)); const fla = e.derived && e.derived.fla; if (fla != null) return { base: Math.round(rule[which] * fla * 10) / 10, baseSource: 'derived', unit: s ? s.unit : '' }; }
    const set = e ? _.setOf(_.libKey(e)) : null; const ts = set ? set.schedules.find((x) => x.name === w.name && x.workType === 'condition') : null;
    return { base: ts && ts[which] != null ? ts[which] : null, baseSource: ts && ts[which] != null ? 'library' : 'gap', unit: s ? s.unit : '' };
  }
  function tierBase(key, eqId, inForce) {
    const f = fnOf('tierInfo') || _.tierInfo; const ti = safe(() => f(key, eqId), null); if (!ti) return { base: null, baseSource: 'gap' };
    /* the structure file reports the tier without the override as base (the stored one as recordBase) */
    if ('recordBase' in ti) return { base: ti.base || null, baseSource: ti.base ? ti.baseSource || 'library' : 'gap', derivedFrom: ti.derivedFrom || null };
    const overridden = !!ti.overrideId || (!!inForce && ti.value === inForce.value);
    const dv = ti.derivedValue !== undefined ? ti.derivedValue : typeof ti.derived === 'string' ? ti.derived : undefined;
    const b = ti.resolved !== undefined ? ti.resolved : overridden ? (dv !== undefined ? dv : ti.libValue) : ti.value;
    const src = ti.resolvedSource || ((ti.derivedFrom && ti.derivedFrom.length) || (!ti.overrideId && (ti.chip === 'derived' || ti.src === 'derived')) ? 'derived' : 'library');
    return { base: b || null, baseSource: b ? src : 'gap', derivedFrom: ti.derivedFrom || null };
  }
  /* everything about a target at a plant: the value in force, the base it is measured against, and the words for both */
  function info(key, t0) {
    const t = normTarget(t0); if (!t) return { ok: false, error: 'Pick a value to change.' };
    if (!P(key) || !d(key)) return { ok: false, error: 'No such plant.' };
    return _.cached(`lg:info:${key}:${JSON.stringify(t)}`, () => infoRaw(key, t));
  }
  function infoRaw(key, t) {
    if (t.kind === 'zone' && !t.dir && !String(t.sensorId).startsWith('m:')) { const s0 = _.sensorRaw(key, t.sensorId); if (s0 && !s0.nextPhase) t.dir = _.primaryDir(key, t.sensorId); }
    if (t.kind === 'triggerLimit' && !t.dir) { const a0 = _.alertRaw(key, t.alertId); if (a0) t.dir = _.alertDir(key, a0); }
    const rec = findRec(key, t); const inForce = rec && !rec.suspendedBy ? rec : null;
    const out = { ok: true, t, rec, unit: '', kind: null, base: null, baseSource: 'gap', value: null, gap: false, ruleConst: false, rule: null, needs: null, metres: null };
    if (t.kind === 'zone') {
      if (String(t.sensorId).startsWith('m:')) return { ok: false, code: 'manual', error: MANUAL_ERR };
      const s = _.sensorRaw(key, t.sensorId); if (!s) return { ok: false, error: 'No such sensor.' };
      if (s.nextPhase) return { ok: false, code: 'nextphase', error: `${s.name} is read on a connection: next phase.` };
      if (s.kind === 'meter') return { ok: false, error: `${s.name} is a counter: it has no Zones.` };
      t.dir = t.dir || _.primaryDir(key, t.sensorId);
      const z = zoneAll(key, t.sensorId, t.dir); const pb = z.perBand[t.band];
      Object.assign(out, { unit: s.unit, kind: s.kind, base: pb.base, baseSource: pb.baseSource, value: inForce ? inForce.value : pb.value, ruleConst: pb.ruleConst, rule: pb.rule, needs: pb.needs, metres: pb.metres, ruleText: pb.ruleText, fallbackParam: pb.fallbackParam, zone: z, sensor: s, gap: pb.base == null });
      out.lib = libSideOf(key, t, z);
    } else if (t.kind === 'triggerLimit') {
      const a = _.alertRaw(key, t.alertId); if (!a) return { ok: false, error: 'No such Trigger.' };
      const s = _.sensorRaw(key, a.sensor) || {}; t.dir = _.alertDir(key, a);
      const z = zoneAll(key, a.sensor, t.dir); const zv = z ? z.bands[t.band] : null;
      Object.assign(out, { unit: s.unit, kind: s.kind, base: zv != null ? zv : null, baseSource: 'sensor', value: inForce ? inForce.value : zv != null ? zv : null, zone: z, sensor: s, alert: a, gap: false });
      out.lib = libSideOf(key, t);
    } else if (t.kind === 'persistence' || t.kind === 'clearing') {
      const a = _.alertRaw(key, t.alertId); if (!a) return { ok: false, error: 'No such Trigger.' };
      const tb = timingBase(key, t.alertId, t.kind === 'persistence' ? 'hold' : 'clear', inForce);
      Object.assign(out, { unit: 'min', base: tb.base, baseSource: tb.baseSource, value: inForce ? inForce.value : tb.base, alert: a, gap: tb.base == null });
      out.lib = libSideOf(key, t);
    } else if (t.kind === 'enabled') {
      if (t.alertId && !_.alertRaw(key, t.alertId)) return { ok: false, error: 'No such Trigger.' };
      if (t.scheduleId && !_.schedRaw(key, t.scheduleId)) return { ok: false, error: 'No such Task.' };
      Object.assign(out, { base: true, baseSource: 'library', value: inForce ? !!inForce.value : true });
      out.lib = libSideOf(key, t);
    } else if (t.kind === 'cadence') {
      const sc = _.schedRaw(key, t.scheduleId); if (!sc) return { ok: false, error: 'No such Task.' };
      const cb = cadenceBase(key, t.scheduleId, inForce);
      Object.assign(out, { base: cb.base, baseSource: cb.baseSource, value: inForce ? inForce.value : cb.base || _.C.cadenceOf(sc), schedule: sc, gap: !cb.base });
      out.lib = libSideOf(key, t);
    } else if (t.kind === 'runhours') {
      const sc = _.schedRaw(key, t.scheduleId); if (!sc) return { ok: false, error: 'No such Task.' };
      if (!sc.meter) return { ok: false, error: 'This Task does not run on an hour meter.' };
      const ri = _.runHoursInfo(key, t.scheduleId); const b = ri && ri.libValue != null ? ri.libValue : null;
      Object.assign(out, { unit: 'run-hours', base: b, baseSource: b != null ? 'library' : 'gap', value: inForce ? inForce.value : b != null ? b : sc.meter.hours, schedule: sc, gap: b == null });
      out.lib = libSideOf(key, t);
    } else if (t.kind === 'condition') {
      const w = workRaw(key, t.workId); if (!w) return { ok: false, error: 'No such Task.' };
      const cb = conditionBase(key, t.workId, t.which, inForce); const s = _.sensorRaw(key, w.sensor) || {};
      Object.assign(out, { unit: cb.unit != null ? cb.unit : s.unit, kind: s.kind, base: cb.base, baseSource: cb.baseSource, value: inForce ? inForce.value : cb.base, work: w, sensor: s, gap: cb.base == null });
      out.lib = libSideOf(key, t);
    } else if (t.kind === 'tier') {
      const e = _.eqRaw(key, t.eqId); if (!e) return { ok: false, error: 'No such equipment.' };
      const tb = tierBase(key, t.eqId, inForce);
      Object.assign(out, { base: tb.base, baseSource: tb.baseSource, derivedFrom: tb.derivedFrom, value: inForce ? inForce.value : tb.base || e.tier, eq: e, gap: !tb.base });
      out.lib = libSideOf(key, t);
    }
    return out;
  }
  function sameVal(kind, a, b) {
    if (kind === 'cadence') return (!a && !b) || (!!a && !!b && a.n === b.n && a.unit === b.unit);
    if (kind === 'enabled') return !!a === !!b;
    if (typeof a === 'number' || typeof b === 'number') return _.same(a, b);
    return (a == null && b == null) || a === b;
  }
  /* a value in words for its kind ("2,500 mg/L", "15 min", "every week", "C", "Off") */
  function valText(kind, v, ctx, src) {
    const c = ctx || {};
    if (kind === 'zone' || kind === 'triggerLimit' || kind === 'condition') { const tx = unitText(v, c.unit, c.kind, oneDpFor(c.unit, src)); return v != null && c.metres != null && src === 'derived' ? `${tx} (${numText(c.metres)} m)` : tx; }
    if (kind === 'persistence' || kind === 'clearing') return v == null ? 'no value' : `${v} min`;
    if (kind === 'cadence') return everyText(v);
    if (kind === 'runhours') return v == null ? 'no value' : `every ${numText(v)} run-hours`;
    if (kind === 'enabled') return v ? 'On' : 'Off';
    if (kind === 'tier') return v || '—';
    return v == null ? '—' : String(v);
  }
  function baseText(kind, base, src, ctx) { if (base == null && src !== 'sensor') return kind === 'zone' || kind === 'condition' ? 'no rule' : 'no value'; return valText(kind, base, ctx, src); }
  /* "5 → 15 min": the unit once, at the end; zones as bare numbers ("2,000 → 2,200") */
  function pairParts(kind, from, to, ctx, withUnit) {
    if (kind === 'zone' || kind === 'triggerLimit') return [from == null ? 'no value' : numText(from), to == null ? 'no value' : withUnit ? valText(kind, to, ctx) : numText(to)];
    if (kind === 'persistence' || kind === 'clearing') return [from == null ? 'no value' : String(from), to == null ? 'no value' : `${to} min`];
    if (kind === 'condition') { const u = (ctx && ctx.unit) || ''; return [from == null ? 'no value' : numText(from), to == null ? 'no value' : `${numText(to)}${u ? ' ' + u : ''}`]; }
    if (kind === 'runhours') return [from == null ? 'no value' : numText(from), to == null ? 'no value' : `${numText(to)} run-hours`];
    return [valText(kind, from, ctx), valText(kind, to, ctx)];
  }
  const pairText = (kind, from, to, ctx, withUnit) => pairParts(kind, from, to, ctx, withUnit).join(' → ');


  /* ── freeze: a Trigger with an open Issue keeps its terms (the library file holds them; otherwise the open Issue says so) ── */
  function heldOf(key, alertId) {
    const f = fnOf('heldOf'); const h = f ? safe(() => f(key, alertId), null) : null;
    const open = (P(key) ? P(key).issues : []).filter((i) => i.alertId === alertId && i.status !== 'closed');
    if (h && typeof h === 'object') return { frozen: !!h.frozen, waiting: !!h.waiting, openIssueIds: h.openIssueIds || open.map((i) => i.id), terms: h.terms || null };
    return { frozen: open.length > 0, waiting: false, openIssueIds: open.map((i) => i.id), terms: open.length ? open[0].terms : null };
  }
  const TRIGGER_OWN = ['triggerLimit', 'persistence', 'clearing'];
  function frozenRefusal(key, t) {
    if (!TRIGGER_OWN.includes(t.kind)) return null; const h = heldOf(key, t.alertId);
    if (h.frozen) return { ...FROZEN }; if (h.waiting) return { ...RESYNC }; return null;
  }
  /* the Triggers that read a zone (a Trigger with its own limit on that band keeps it) */
  function followers(key, t) {
    if (t.kind !== 'zone') return [];
    return d(key).alerts.filter((a) => a.sensor === t.sensorId && _.alertDir(key, a) === t.dir && !findRec(key, { kind: 'triggerLimit', alertId: a.id, band: t.band }))
      .map((a) => { const h = heldOf(key, a.id); return { alertId: a.id, name: trigName(key, a.id), state: V.alertState(key, a.id), frozen: h.frozen, waiting: h.waiting, open: h.openIssueIds.length, openIssueIds: h.openIssueIds, heldBand: h.terms && h.terms.bands ? h.terms.bands[t.band] : null }; });
  }

  /* ── reasons, defaults and the checks ──────────────────────────────────────────────────────── */
  function overrideDefaults(reason, opts) {
    const at = opts && opts.at != null ? opts.at : now(); const r = REASON_V2[reason] || reason;
    if (r === 'temporary') return { reviewBy: null, reviewByEditable: false, expiresMax: at + TEMP_MAX_DAYS * DAY, expiresMaxText: fmtDate(at + TEMP_MAX_DAYS * DAY) };
    const days = REVIEW_DAYS[r]; const rb = days ? at + days * DAY : null;
    return { reviewBy: rb, reviewByEditable: true, expiresMax: null, reviewByText: rb != null ? fmtDate(rb) : null };
  }
  function reasonsFor(key, target) {
    const t = normTarget(target); if (!t) return REASONS.slice();
    if (t.kind === 'triggerLimit') return TRIGGER_LIMIT_REASONS.slice();
    const inf = info(key, t); if (inf.ok && inf.gap) return GAP_REASONS.slice();
    return REASONS.slice();
  }
  function checkOverride(key, target, value, opts) {
    const o = opts || {}; const t = normTarget(target); if (!t) return { field: 'value', error: 'Pick a value to change.' };
    const reason = o.reason; const allowed = reasonsFor(key, t);
    if (!reason || !REASONS.includes(reason)) return { field: 'reason', error: 'Choose why this plant differs.' };
    if (!allowed.includes(reason)) return { field: 'reason', error: 'Choose one of the reasons offered here.' };
    if ((NOTE_REQUIRED.includes(reason) || t.kind === 'triggerLimit') && !String(o.note || '').trim()) return { field: 'note', error: `Write a note: ${LABELS.reason[reason]} needs one.` };
    if (reason === 'temporary') { const ex = asMs(o.expires); if (ex == null || ex <= now() || ex > endOfDay(now() + TEMP_MAX_DAYS * DAY)) return { field: 'expires', error: 'Pick an expiry date, 30 days from today at most.' }; }
    else if (o.reviewBy != null && o.reviewBy !== '') { const rb = asMs(o.reviewBy); if (rb == null || rb <= now()) return { field: 'reviewBy', error: 'Pick a review date after today.' }; }
    if (t.kind === 'persistence') { const inf = info(key, t); const z = inf.ok && inf.alert ? zoneAll(key, inf.alert.sensor, _.alertDir(key, inf.alert)) : null; if (z && z.bands.emergency != null && BANDS.every((b) => b === 'emergency' || z.bands[b] == null)) return { field: 'value', error: "This Trigger has only an Emergency band, which fires on the first reading: its persistence can't be overridden." }; }
    return null;
  }
  /* the Physical reason's path: a design parameter instead, when one sets this value */
  function physicalPath(key, target) {
    const t = normTarget(target); const inf = t ? info(key, t) : null; if (!inf || !inf.ok) return { kind: 'none', text: 'No design parameter sets this value.' };
    if (t.kind !== 'zone') return { kind: 'none', text: `No design parameter sets ${t.kind === 'tier' ? 'the criticality tier' : fieldLabel(t)}.` };
    const nodeId = nodeOf(key, t); const route = nodeId && isUp(key, nodeId) ? 'up' : 'eq';
    const param0 = (inf.rule && inf.rule.kind === 'expr' && inf.rule.param) || (inf.needs && inf.needs.param) || inf.fallbackParam || null;
    const param = param0 === 'fullLoadCurrent' ? 'motorRating' : param0 === 'tankVolume' ? 'tankHeight' : param0;
    if (param && nodeId) return { kind: 'param', param, text: 'Set the design parameter instead?', primary: 'Set the design parameter', secondary: 'Override anyway', href: `#/p/${key}/${route}/${nodeId}/details?f=dp.${param}` };
    if (inf.base != null) return { kind: 'const', text: `The library's limit rule for this band is a constant (${valText('zone', inf.base, inf)}): no design parameter changes it.`, secondary: 'Override anyway' };
    return { kind: 'none', text: 'No design parameter sets this band.', secondary: 'Override anyway' };
  }
  /* the value itself: a number in range and in band order, minutes, a cadence, a tier */
  function checkValue(key, t, v, inf) {
    if (t.kind === 'zone') {
      if (v != null && !Number.isFinite(+v)) return `${BAND_LABEL[t.band]} must be a number.`;
      const next = { ...inf.zone.bands }; BANDS.forEach((b) => { const r = findRec(key, { kind: 'zone', sensorId: t.sensorId, dir: t.dir, band: b }); if (r && !r.suspendedBy) next[b] = r.value; }); next[t.band] = v == null ? null : +v;
      const zc = fnOf('zoneCheck'); if (zc) { const e = safe(() => zc(key, t.sensorId, t.dir, next), null); if (e) return e; }
      return _.validateBands(next, t.dir, inf.sensor);
    }
    if (t.kind === 'triggerLimit') {
      if (v != null && !Number.isFinite(+v)) return `${BAND_LABEL[t.band]} must be a number.`;
      const next = { ...(inf.zone ? inf.zone.bands : {}) }; BANDS.forEach((b) => { const r = findRec(key, { kind: 'triggerLimit', alertId: t.alertId, band: b }); if (r && !r.suspendedBy) next[b] = r.value; }); next[t.band] = v == null ? null : +v;
      return _.validateBands(next, t.dir, inf.sensor);
    }
    if (t.kind === 'persistence' || t.kind === 'clearing') { const n = +v; if (v == null || !Number.isFinite(n) || n < 0 || n > 1440 || Math.round(n) !== n) return `${cap(fieldLabel(t))}: give whole minutes between 0 and 1440.`; return null; }
    if (t.kind === 'cadence') { if (!v || !(v.n >= 1) || Math.round(v.n) !== v.n || !C.UNIT_HOURS[v.unit]) return 'Give the cadence: a number and hour, day, week, month or year.'; return null; }
    if (t.kind === 'runhours') { const n = +v; if (!Number.isFinite(n) || n < 1 || Math.round(n) !== n) return 'Give the run-hours as a whole number, 1 or more.'; return null; }
    if (t.kind === 'condition') {
      if (v == null || !Number.isFinite(+v)) return 'Give a number.';
      const other = t.which === 'doWhen' ? 'doneWhen' : 'doWhen'; const oi = info(key, { kind: 'condition', workId: t.workId, which: other });
      const ov = oi.ok ? oi.value : null; const base0 = info(key, { kind: 'condition', workId: t.workId, which: 'doWhen' }); const base1 = info(key, { kind: 'condition', workId: t.workId, which: 'doneWhen' });
      const rising = !(base0.ok && base1.ok && base0.base != null && base1.base != null && base0.base < base1.base);
      if (ov != null) { const dw = t.which === 'doWhen' ? +v : ov; const dn = t.which === 'doWhen' ? ov : +v; if (rising ? !(dw > dn) : !(dw < dn)) return rising ? `Do when must be above done when (${unitText(dn, inf.unit, inf.kind)}): the Task starts when the reading rises past it.` : `Do when must be below done when (${unitText(dn, inf.unit, inf.kind)}): the Task starts when the reading falls past it.`; }
      return null;
    }
    if (t.kind === 'tier') return ['A', 'B', 'C'].includes(v) ? null : 'Pick a criticality tier: A, B or C.';
    if (t.kind === 'enabled') return typeof v === 'boolean' ? null : 'Say whether it is on or off.';
    return null;
  }
  const normValue = (t, v) => { if (t.kind === 'cadence') return v && v.n != null ? { n: Math.round(+v.n), unit: v.unit } : null; if (t.kind === 'enabled') return v === 'off' ? false : v === 'on' ? true : !!v; if (t.kind === 'tier') return v; if (v == null || v === '') return null; return +v; };

  /* ── v6's in-place values follow the value in force (core7's mirrors), and held Triggers learn that their base moved ── */
  function mirror(key, t, scOld) {
    const tt = normTarget(t); if (!tt) return; _.touch();
    if (tt.kind === 'zone') { const f = fnOf('syncZone'); if (f) safe(() => f(key, tt.sensorId)); else _.syncSensor(key, tt.sensorId); }
    else if (tt.kind === 'persistence' || tt.kind === 'clearing') _.syncAlert(key, tt.alertId);
    else if (tt.kind === 'cadence') { _.syncSched(key, tt.scheduleId); if (scOld) _.recountTask(key, tt.scheduleId, scOld); }
    else if (tt.kind === 'runhours') { _.syncRunHours(key, tt.scheduleId); if (scOld) _.recountTask(key, tt.scheduleId, scOld); }
    else if (tt.kind === 'tier') _.syncTier(key, tt.eqId);
    else if (tt.kind === 'condition') { const w = workRaw(key, tt.workId); _.touch(); const inf = infoRaw(key, tt); if (w && inf.ok && inf.value != null) w[tt.which] = inf.value; }
    else if (tt.kind === 'enabled') {
      _.touch(); const inf = infoRaw(key, tt);
      if (tt.alertId) { const cur = V.alertState(key, tt.alertId); if (!inf.value && cur === 'active') _.putAlertState(key, tt.alertId, 'inactive'); else if (inf.value && cur === 'inactive') _.putAlertState(key, tt.alertId, 'active'); }
      else { const sc = _.schedRaw(key, tt.scheduleId); if (sc) sc.status = inf.value ? 'active' : 'off'; }
    }
    _.touch();
  }
  const markMoved = (key, t) => { const f = fnOf('markMoved'); if (f) safe(() => f(key, t)); };
  const schedOf = (t) => (t.kind === 'cadence' || t.kind === 'runhours' ? t.scheduleId : null);

  /* ── the one writer ────────────────────────────────────────────────────────────────────────── */
  function newRecord(key, t, value, inf, o, at) {
    const reason = o.reason; const lib = inf.lib || {};
    const expires = reason === 'temporary' ? asMs(o.expires) : null;
    const reviewBy = reason === 'temporary' ? expires : o.reviewBy != null && o.reviewBy !== '' ? asMs(o.reviewBy) : at + (REVIEW_DAYS[reason] || 365) * DAY;
    return { id: _.counterId('oseq', 'ovr'), plant: key, target: { ...t }, field: fieldId(t), value, base: inf.base, baseSource: inf.baseSource, baseOwner: ownerRecord(lib), baseVersion: lib.templateVersion || null, reason, note: String(o.note || '').trim(), author: ME, at, reviewBy, expires, status: 'active', endedAt: null, endedBy: null, endedNote: null, suspendedBy: null, variantRequest: null, history: [] };
  }
  const ownerRecord = (lib) => (lib && (lib.owner || lib.templateId) ? { kind: lib.owner ? lib.owner.kind : null, code: lib.owner ? lib.owner.code : null, name: lib.owner ? lib.owner.name : null, typeName: lib.owner ? lib.owner.typeName : null, typeKey: lib.owner ? lib.owner.typeKey : null, templateId: lib.templateId || null, templateName: lib.templateName || null, version: lib.templateVersion || null } : null);
  function endRec(o, status, note, at, who) { o.status = status; o.endedAt = at != null ? at : now(); o.endedBy = who === undefined ? ME : who; o.endedNote = note; if (!Array.isArray(o.history)) o.history = []; }
  function setLine(key, t, from, to, rec, inf) {
    const why = `(${LABELS.reason[rec.reason]}${rec.note ? `: ${rec.note}` : ''})`; const fv = (v) => (v == null ? 'none' : valText(t.kind, v, inf));
    if (t.kind === 'zone') return `Overrode ${(inf.sensor && (inf.sensor.tag || inf.sensor.name)) || t.sensorId} ${BAND_LABEL[t.band]} zone: ${fv(from)} → ${fv(to)} ${why}`;
    if (t.kind === 'triggerLimit') return `Overrode ${BAND_LABEL[t.band]} for ${trigName(key, t.alertId)} only: ${fv(from)} → ${fv(to)} ${why}`;
    if (t.kind === 'persistence' || t.kind === 'clearing') return `Overrode ${t.kind} on ${trigName(key, t.alertId)}: ${from == null ? 'none' : from} → ${to} min ${why}`;
    if (t.kind === 'cadence') { const sc = _.schedRaw(key, t.scheduleId); return `Overrode cadence of ${taskName(key, sc)}: ${everyText(from)} → ${everyText(to)} ${why}`; }
    if (t.kind === 'runhours') { const sc = _.schedRaw(key, t.scheduleId); return `Overrode run-hours of ${taskName(key, sc)}: ${fv(from)} → ${fv(to)} ${why}`; }
    if (t.kind === 'condition') { const w = workRaw(key, t.workId); return `Overrode ${fieldLabel(t)} on ${taskName(key, w)}: ${fv(from)} → ${fv(to)} ${why}`; }
    if (t.kind === 'tier') return `Overrode criticality tier of ${nodeTag(key, t.eqId)}: ${from || '—'} → ${to} ${why}`;
    if (t.kind === 'enabled') return to ? `Set ${t.alertId ? trigName(key, t.alertId) : taskName(key, _.schedRaw(key, t.scheduleId))} active again ${why}` : `Set ${t.alertId ? trigName(key, t.alertId) : taskName(key, _.schedRaw(key, t.scheduleId))} inactive at this plant ${why}`;
    return `Overrode ${whatOf(key, t)}: ${fv(from)} → ${fv(to)} ${why}`;
  }
  function setOverride(key, target, value0, opts) {
    const o = opts || {}; const t = normTarget(target); if (!t) return { ok: false, error: 'Pick a value to change.', field: 'value' };
    if (!P(key) || !d(key)) return { ok: false, error: 'No such plant.', field: 'value' };
    const inf = info(key, t); if (!inf.ok) return { ok: false, error: inf.error, field: 'value', code: inf.code };
    const value = normValue(t, value0); const verr = checkValue(key, inf.t, value, inf); if (verr) return { ok: false, error: verr, field: 'value' };
    const fz = frozenRefusal(key, inf.t); if (fz) return fz;
    const tt = inf.t; const rec = findRec(key, tt); const at = now(); const from = inf.value;
    const scOld = schedOf(tt) ? clone(_.schedRaw(key, tt.scheduleId)) : null;
    if (sameVal(tt.kind, value, inf.base)) {
      if (!rec) return { ok: true, id: null, changed: [], frozen: [] };
      endRec(rec, 'reverted', 'Set back to the library value', at); rec.history.push({ at, who: ME, text: `Set back to the library value ${baseText(tt.kind, inf.base, inf.baseSource, inf)}` });
      mirror(key, tt, scOld); markMoved(key, tt);
      act(at, key, `Set ${whatOf(key, tt)} back to the library value ${baseText(tt.kind, inf.base, inf.baseSource, inf)}`, 'config');
      _.touch(); _.persist(); return { ok: true, id: rec.id, ended: true, changed: [{ field: fieldId(tt), from, to: inf.base }], frozen: followers(key, tt).filter((f) => f.frozen) };
    }
    if (o.variantOnly) {
      if (o.reason !== 'structural') return { ok: false, field: 'reason', error: 'Only Structural asks for a library variant.' };
      const own = inf.lib && inf.lib.owner; const r = requestVariant({ plant: key, ownerCode: own ? own.code : null, typeKey: own ? own.typeKey : null, ownerName: own ? own.name : null, trait: o.trait, note: o.note, fromOverride: null, fromText: `${whatOf(key, tt)} ${valText(tt.kind, value, inf)}` });
      return r.ok ? { ok: true, saved: false, variantRequestId: r.request.id, changed: [], frozen: [] } : { ok: false, field: 'trait', error: r.error };
    }
    const err = checkOverride(key, tt, value, o); if (err) return { ok: false, error: err.error, field: err.field, needsReason: err.field === 'reason' };
    let id;
    if (rec) {
      rec.history.push({ at, who: ME, text: `Was ${valText(tt.kind, rec.value, inf)} · ${LABELS.reason[reasonOf(rec)] || rec.reason}${rec.note ? ` · ${rec.note}` : ''}` });
      const fresh = newRecord(key, tt, value, inf, o, at);
      Object.assign(rec, { value, base: fresh.base, baseSource: fresh.baseSource, baseOwner: fresh.baseOwner, baseVersion: fresh.baseVersion, reason: fresh.reason, note: fresh.note, author: ME, at, reviewBy: fresh.reviewBy, expires: fresh.expires, field: fresh.field });
      id = rec.id;
    } else { const r = newRecord(key, tt, value, inf, o, at); _.S.overrides.push(r); id = r.id; }
    const stored = _.S.overrides.find((x) => x.id === id);
    let variantRequestId = null;
    if (o.reason === 'structural' && String(o.trait || '').trim()) { const own = inf.lib && inf.lib.owner; const r = requestVariant({ plant: key, ownerCode: own ? own.code : null, typeKey: own ? own.typeKey : null, ownerName: own ? own.name : null, trait: o.trait, note: o.note, fromOverride: id, fromText: `${whatOf(key, tt)} ${valText(tt.kind, value, inf)}`, quiet: false }); if (r.ok) { variantRequestId = r.request.id; stored.variantRequest = variantRequestId; } }
    mirror(key, tt, scOld); markMoved(key, tt);
    act(at, key, setLine(key, tt, from, value, stored, inf), 'config');
    _.touch(); _.persist();
    return { ok: true, id, changed: [{ field: fieldId(tt), from, to: value }], frozen: followers(key, tt).filter((f) => f.frozen).map((f) => ({ alertId: f.alertId, name: f.name, open: f.open })), variantRequestId };
  }

  /* ── the wrappers (each routes to setOverride) ─────────────────────────────────────────────── */
  function setZone(key, sensorId, dir, band, value, opts) { return setOverride(key, { kind: 'zone', sensorId, dir: dir || null, band }, value, opts); }
  function setLimits(key, sensorId, dir, bands, opts) {
    if (String(sensorId).startsWith('m:')) return { ok: false, error: MANUAL_ERR, code: 'manual' };
    const s = _.sensorRaw(key, sensorId); if (!s) return { ok: false, error: 'No such sensor.' };
    if (s.nextPhase) return { ok: false, error: `${s.name} is read on a connection: next phase.`, code: 'nextphase' };
    const D2 = dir || _.primaryDir(key, sensorId); const z = zoneAll(key, sensorId, D2); const next = _.norm4(bands || {});
    const err = _.validateBands(next, D2, s); if (err) return { ok: false, error: err };
    const zc = fnOf('zoneCheck'); if (zc) { const e2 = safe(() => zc(key, sensorId, D2, next), null); if (e2) return { ok: false, error: e2 }; }
    const changed = BANDS.filter((b) => !_.same(next[b], z.bands[b])).map((b) => ({ band: b, from: z.bands[b], to: next[b] }));
    if (!changed.length) return { ok: true, changed: [], overrides: [] };
    const leaving = changed.filter((c) => !_.same(c.to, z.perBand[c.band].base));
    if (leaving.length) { for (const c of leaving) { const e3 = checkOverride(key, { kind: 'zone', sensorId, dir: D2, band: c.band }, c.to, opts); if (e3) return { ok: false, error: e3.error, field: e3.field, needsReason: e3.field === 'reason' }; } }
    /* bands moving back go first, then the rest, each checked against the bands already written */
    const order = changed.slice().sort((a, b) => (_.same(b.to, z.perBand[b.band].base) ? 1 : 0) - (_.same(a.to, z.perBand[a.band].base) ? 1 : 0));
    const ids = []; const snap = clone(_.S.overrides);
    for (const c of order) {
      const r = writeBand(key, sensorId, D2, c.band, c.to, opts, next);
      if (!r.ok) { _.S.overrides.splice(0, _.S.overrides.length, ...snap); mirror(key, { kind: 'zone', sensorId, dir: D2, band: c.band }); return r; }
      if (r.id) ids.push(r.id);
    }
    return { ok: true, changed, overrides: ids };
  }
  /* one band of a multi-band change: the band order is checked on the whole new set, not band by band */
  function writeBand(key, sensorId, dir, band, value, opts, wholeSet) {
    const t = { kind: 'zone', sensorId, dir, band }; const inf = info(key, t); if (!inf.ok) return { ok: false, error: inf.error };
    const rec = findRec(key, t); const at = now(); const from = inf.value; const o = opts || {};
    if (sameVal('zone', value, inf.base)) {
      if (!rec) return { ok: true, id: null };
      endRec(rec, 'reverted', 'Set back to the library value', at); rec.history.push({ at, who: ME, text: `Set back to the library value ${baseText('zone', inf.base, inf.baseSource, inf)}` });
      mirror(key, inf.t); markMoved(key, inf.t); act(at, key, `Set ${whatOf(key, inf.t)} back to the library value ${baseText('zone', inf.base, inf.baseSource, inf)}`, 'config'); _.touch(); _.persist(); return { ok: true, id: rec.id };
    }
    if (!wholeSet) return setOverride(key, t, value, o);
    let id;
    if (rec) { rec.history.push({ at, who: ME, text: `Was ${valText('zone', rec.value, inf)} · ${LABELS.reason[reasonOf(rec)] || rec.reason}${rec.note ? ` · ${rec.note}` : ''}` }); const fresh = newRecord(key, inf.t, value, inf, o, at); Object.assign(rec, { value, base: fresh.base, baseSource: fresh.baseSource, baseOwner: fresh.baseOwner, baseVersion: fresh.baseVersion, reason: fresh.reason, note: fresh.note, author: ME, at, reviewBy: fresh.reviewBy, expires: fresh.expires }); id = rec.id; }
    else { const r = newRecord(key, inf.t, value, inf, o, at); _.S.overrides.push(r); id = r.id; }
    mirror(key, inf.t); markMoved(key, inf.t); act(at, key, setLine(key, inf.t, from, value, _.S.overrides.find((x) => x.id === id), inf), 'config'); _.touch(); _.persist();
    return { ok: true, id };
  }
  function setTriggerLimit(key, alertId, band, value, opts) { return setOverride(key, { kind: 'triggerLimit', alertId, band }, value, opts); }
  function revertTriggerLimit(key, alertId, band) { const r = findRec(key, { kind: 'triggerLimit', alertId, band }); if (!r) return { ok: true, already: true }; return revert(r.id); }
  function setAlertTiming(key, alertId, vals, opts) {
    if (!_.alertRaw(key, alertId)) return { ok: false, error: 'No such Trigger.' }; const v = vals || {}; const results = [];
    for (const [which, kind] of [['hold', 'persistence'], ['clear', 'clearing']]) {
      if (v[which] == null || v[which] === '') continue;
      const r = setOverride(key, { kind, alertId }, v[which], opts); if (!r.ok) return r; results.push(r);
    }
    return { ok: true, results };
  }
  function setRunHours(key, scheduleId, hours, opts) { return setOverride(key, { kind: 'runhours', scheduleId }, hours, opts); }
  function setCadence(key, id, every, opts) {
    const tv = safe(() => V.task(key, id), null); const scIds = tv && tv.scheduleIds ? tv.scheduleIds : _.schedRaw(key, id) ? [id] : [];
    if (!scIds.length) return { ok: false, error: 'No such Task.' };
    const sc0 = _.schedRaw(key, scIds[0]); const meterOnly = !!(sc0 && sc0.meter && sc0.basis === 'meter');
    const rh = every && every.runHours != null && every.runHours !== '' ? +every.runHours : null;
    let ev = every && every.n ? { n: Math.round(+every.n), unit: every.unit } : null;
    if (meterOnly && rh != null) ev = null;
    if (!ev && rh == null) return { ok: false, error: 'Give the cadence: a number and hour, day, week, month or year.' };
    const results = [];
    for (const scId of scIds) {
      if (ev) { const r = setOverride(key, { kind: 'cadence', scheduleId: scId }, ev, opts); if (!r.ok) return r; results.push(r); }
      if (rh != null) { const r = setOverride(key, { kind: 'runhours', scheduleId: scId }, rh, opts); if (!r.ok) return r; results.push(r); }
    }
    return { ok: true, results };
  }
  function setCondition(key, workId, which, value, opts) { return setOverride(key, { kind: 'condition', workId, which }, value, opts); }
  function setTier(key, eqId, tier, opts) { return setOverride(key, { kind: 'tier', eqId }, tier, opts); }
  function setEnabled(key, id, enabled, opts) { const isAlert = !!_.alertRaw(key, id); return setOverride(key, isAlert ? { kind: 'enabled', alertId: id } : { kind: 'enabled', scheduleId: id }, !!enabled, opts); }

  /* ── what saving would do (shown before saving) ────────────────────────────────────────────── */
  function overridePreview(key, target, value0) {
    const t = normTarget(target); const inf = t ? info(key, t) : null; if (!inf || !inf.ok) return { ok: false, error: inf ? inf.error : 'Pick a value to change.' };
    const tt = inf.t; const value = normValue(tt, value0); const PL = P(key); const out = { ok: true, kind: tt.kind, lines: [], triggers: [], frozenLines: [], count: null, countNow: null, mode: null, sample: true };
    const to = now(); const live = PL.state === 'live';
    const countFor = (alertIds, opt) => {
      let n = 0, m = 0, trial = false;
      alertIds.forEach((id) => {
        if (V.alertState(key, id) !== 'active') return;
        const ts = !live ? safe(() => V.trialStats(key, id), null) : null;
        if (ts) { trial = true; n += (V.replay(key, id, { from: ts.since, to, ...opt }) || { count: 0 }).count; m += ts.count; }
        else { n += (V.replay(key, id, { from: to - 7 * DAY, to, ...opt }) || { count: 0 }).count; m += (V.replay(key, id, { from: to - 7 * DAY, to }) || { count: 0 }).count; }
      });
      return { n, m, trial };
    };
    const countLine = (c) => (c.trial ? `Trial so far: would have fired ${c.n} ${timesWord(c.n)} instead of ${c.m}.` : `Last 7 days: would have fired ${c.n} ${timesWord(c.n)} (now ${c.m}).`);
    if (tt.kind === 'zone') {
      const fol = followers(key, tt); out.triggers = fol;
      const names = fol.map((f) => (f.frozen ? `${f.name} (frozen: it will show Base moved)` : f.name));
      out.lines.push(fol.length ? `Changes ${plural(fol.length, 'Trigger')}: ${names.join(', ')}.` : 'No Trigger follows this sensor yet: nothing would fire.');
      const bands = { ...inf.zone.bands }; bands[tt.band] = value;
      const activeF = fol.filter((f) => f.state === 'active');
      if (activeF.length) { const c = countFor(activeF.map((f) => f.alertId), { limits: bands }); out.count = c.n; out.countNow = c.m; out.mode = c.trial ? 'trial' : 'live'; out.lines.push(countLine(c)); }
      fol.filter((f) => f.frozen).forEach((f) => {
        const kept = f.heldBand != null ? f.heldBand : inf.zone.bands[tt.band]; const iss = f.openIssueIds[0];
        out.frozenLines.push({ alertId: f.alertId, issueId: iss, text: `${f.name} has ${plural(f.open, 'open Issue')}: it is frozen and keeps ${kept == null ? 'no value' : numText(kept)}. It will show Base moved until someone resyncs it.`, linkText: 'Close it as a false alarm', href: `#/p/${key}/issue/${iss}?close=false-alarm` });
      });
    } else if (tt.kind === 'triggerLimit' || tt.kind === 'persistence' || tt.kind === 'clearing') {
      const h = heldOf(key, tt.alertId); out.triggers = [{ alertId: tt.alertId, name: trigName(key, tt.alertId), frozen: h.frozen, waiting: h.waiting }];
      let opt;
      if (tt.kind === 'triggerLimit') { const bands = { ...inf.zone.bands }; BANDS.forEach((b) => { const r = findRec(key, { kind: 'triggerLimit', alertId: tt.alertId, band: b }); if (r && !r.suspendedBy) bands[b] = r.value; }); bands[tt.band] = value; opt = { limits: bands }; }
      else opt = tt.kind === 'persistence' ? { hold: value } : { clear: value };
      if (V.alertState(key, tt.alertId) === 'active') { const c = countFor([tt.alertId], opt); out.count = c.n; out.countNow = c.m; out.mode = c.trial ? 'trial' : 'live'; out.lines.push(countLine(c)); }
    } else if (tt.kind === 'cadence' || tt.kind === 'runhours') {
      const tid = safe(() => _.taskIdOfSchedule(key, tt.scheduleId), null); const st = tid && PL.tasks ? PL.tasks[tid] : null;
      if (live && st && st.due != null && value != null && !checkValue(key, tt, value, inf)) {
        const nd = _.dryRun(key, () => { writeRaw(key, tt, value, inf); const s2 = P(key).tasks[tid]; return s2 ? s2.due : null; });
        if (nd != null) { out.nextDue = nd; out.nextDueNow = st.due; out.lines.push(`Next due: ${_.fmt(nd)} (now ${_.fmt(st.due)}).`); }
      }
    }
    return out;
  }
  /* a write with no checks and no Activity, for previews inside a dry run */
  function writeRaw(key, t, value, inf) {
    const scOld = schedOf(t) ? clone(_.schedRaw(key, t.scheduleId)) : null; const rec = findRec(key, t);
    if (rec) rec.value = value; else _.S.overrides.push(newRecord(key, t, value, inf, { reason: 'tuning', note: '' }, now()));
    mirror(key, t, scOld);
  }

  /* ── acting on a record ────────────────────────────────────────────────────────────────────── */
  const recById = (id) => (_.S ? _.S.overrides.find((x) => x.id === id) || null : null);
  /* the bands a reading would have if these zone records went back to their base: null when that order is fine, else why */
  function revertOrderError(key, list) {
    const t0 = normTarget(list[0].target); const z = zoneAll(key, t0.sensorId, t0.dir); if (!z) return null; const s = _.sensorRaw(key, t0.sensorId) || {};
    const next = { ...z.bands }; list.forEach((o) => { next[o.target.band] = z.perBand[o.target.band].base; });
    const vals = BANDS.map((b) => ({ b, v: next[b] })).filter((x) => x.v != null);
    for (let i = 1; i < vals.length; i++) { const a = vals[i - 1], b = vals[i]; if (t0.dir === 'below' ? !(b.v < a.v) : !(b.v > a.v)) return `Revert ${s.name || 'the reading'}'s other overridden bands too: ${BAND_LABEL[b.b]} ${unitText(b.v, s.unit, s.kind)} would sit ${t0.dir === 'below' ? 'above' : 'below'} ${BAND_LABEL[a.b]} ${unitText(a.v, s.unit, s.kind)}`; }
    return null;
  }
  const zoneSiblings = (o) => _.S.overrides.filter((x) => x.plant === o.plant && isLive(x) && (KIND_V2[x.target.kind] || x.target.kind) === 'zone' && x.target.sensorId === o.target.sensorId && x.target.dir === o.target.dir);
  function revertOne(o, note, how) {
    const key = o.plant; const t = normTarget(o.target); const inf = info(key, t); const scOld = schedOf(t) ? clone(_.schedRaw(key, t.scheduleId)) : null;
    const word = inf.baseSource === 'derived' ? 'derived' : 'library'; const bt = baseText(t.kind, inf.base, inf.baseSource, inf);
    endRec(o, 'reverted', how === 'adopt' ? `Adopted the library value ${bt}` : `Reverted to the ${word} value ${bt}`);
    o.history.push({ at: now(), who: ME, text: `${how === 'adopt' ? 'Adopted' : 'Reverted to'} ${bt}${note ? ` · ${note}` : ''}` });
    mirror(key, t, scOld); markMoved(key, t);
    return { inf, bt, word, t };
  }
  function revert(id, opts) {
    const o = recById(id); if (!o || !isValueKind(o)) return { ok: false, error: 'No such override.' }; if (!isLive(o)) return { ok: true, already: true };
    const key = o.plant; const t = normTarget(o.target);
    const fz = frozenRefusal(key, t); if (fz) return fz;
    if (t.kind === 'zone') { const err = revertOrderError(key, [o]); if (err) return { ok: false, error: err, needsAll: true }; }
    const what = whatOf(key, t); const vt = valText(t.kind, o.value, info(key, t));
    const r = revertOne(o, opts && opts.note);
    act(now(), key, `Reverted ${what}: ${vt} → ${r.bt} (${r.word})`, 'config'); _.touch(); _.persist();
    return { ok: true, id, toast: `Reverted: ${what} is back to ${r.bt}.` };
  }
  function revertPreview(id) {
    const o = recById(id); if (!o || !isValueKind(o) || !isLive(o)) return null; const key = o.plant; const t = normTarget(o.target); const inf = info(key, t);
    const word = inf.baseSource === 'derived' ? 'derived' : 'library'; const bt = baseText(t.kind, inf.base, inf.baseSource, inf);
    /* a Gap has no library value to go back to: say what the band will do instead */
    const gap = inf.base == null && inf.baseSource !== 'sensor';
    const base = { title: gap ? 'Revert to the library?' : `Revert to the ${word} value?`, text: gap ? `Go back to the library? It has no rule here, so this ${t.kind === 'condition' ? 'value' : 'band'} will have no limit. Your override and its note stay in history.` : `Go back to the ${word} value ${bt}? Your override and its note stay in history.`, frozen: followers(key, t).filter((f) => f.frozen).map((f) => f.name) };
    if (t.kind !== 'zone') return { ok: true, needsAll: false, ...base };
    const err = revertOrderError(key, [o]); if (!err) return { ok: true, needsAll: false, ...base };
    const list = zoneSiblings(o); const errAll = revertOrderError(key, list); const s = _.sensorRaw(key, t.sensorId) || {};
    const bands = list.map((x) => { const i2 = info(key, x.target); return { band: x.target.band, bandLabel: BAND_LABEL[x.target.band], from: valText('zone', x.value, i2), to: baseText('zone', i2.base, i2.baseSource, i2) }; }).sort((a, b) => _.RANK[a.band] - _.RANK[b.band]);
    return { ok: !errAll, needsAll: true, error: err, allError: errAll || null, bands, allText: `Revert every overridden band on ${s.tag || s.name} together: ${bands.map((b) => `${b.bandLabel} ${b.from} → ${b.to}`).join(', ')}`, allButton: `Revert all ${bands.length}`, ...base };
  }
  function revertAll(id) {
    const o = recById(id); if (!o || !isValueKind(o)) return { ok: false, error: 'No such override.' };
    if ((KIND_V2[o.target.kind] || o.target.kind) !== 'zone') return revert(id);
    const key = o.plant; const list = zoneSiblings(o); if (!list.length) return { ok: true, already: true };
    const err = revertOrderError(key, list); if (err) return { ok: false, error: err };
    const s = _.sensorRaw(key, o.target.sensorId) || {}; const parts = [];
    list.forEach((x) => { const i2 = info(key, x.target); const vt = valText('zone', x.value, i2); const r = revertOne(x); parts.push(`${BAND_LABEL[x.target.band]} ${vt} → ${r.bt}`); });
    act(now(), key, `Reverted every overridden band on ${s.tag || s.name}: ${parts.join(', ')}`, 'config'); _.touch(); _.persist();
    return { ok: true, count: list.length };
  }
  function adopt(id) {
    const o = recById(id); if (!o || !isValueKind(o) || !isLive(o)) return { ok: false, error: 'No such override.' };
    if (ovState(o) !== 'basemoved') return { ok: false, error: 'Adopt is for a value whose library base moved.' };
    const key = o.plant; const t = normTarget(o.target); const fz = frozenRefusal(key, t); if (fz) return fz;
    const inf = info(key, t); const what = whatOf(key, t); const vt = valText(t.kind, o.value, inf); const nt = valText(t.kind, inf.base, inf, inf.baseSource);
    revertOne(o, null, 'adopt');
    act(now(), key, `Adopted the library value for ${what}: ${vt} → ${nt}`, 'config'); _.touch(); _.persist();
    return { ok: true, id, toast: `${plantName(key)} follows the library again: ${what} ${nt}.` };
  }
  function keep(id, opts) {
    const o = recById(id); if (!o || !isValueKind(o) || !isLive(o)) return { ok: false, error: 'No such override.' };
    if (ovState(o) !== 'basemoved') return { ok: false, error: 'Keep is for a value whose library base moved.' };
    const note = String((opts && opts.note) || '').trim(); if (!note) return { ok: false, field: 'note', error: 'Write a note: why keep this value?' };
    const key = o.plant; const t = normTarget(o.target); const inf = info(key, t); const old = o.base;
    o.history.push({ at: now(), who: ME, text: `Kept ${valText(t.kind, o.value, inf)}; base ${pairText(t.kind, old, inf.base, inf)} · was noted "${o.note}"` });
    o.base = inf.base; o.baseSource = inf.baseSource; o.baseVersion = (inf.lib && inf.lib.templateVersion) || o.baseVersion; o.baseOwner = ownerRecord(inf.lib) || o.baseOwner; o.note = note;
    _.touch(); const what = whatOf(key, t); const vt = valText(t.kind, o.value, inf); const nt = valText(t.kind, inf.base, inf, inf.baseSource);
    act(now(), key, `Kept the override on ${what} at ${vt}; the library is now ${nt} (${note})`, 'config'); _.touch(); _.persist();
    return { ok: true, id, toast: `Kept: ${what} ${vt}; the library is now ${nt}.` };
  }
  function extend(id, opts) {
    const o = recById(id); if (!o || !isValueKind(o) || !isLive(o)) return { ok: false, error: 'No such override.' };
    const x = opts || {}; const note = String(x.note || '').trim(); if (!note) return { ok: false, field: 'note', error: 'Write a note for the new review.' };
    const key = o.plant; const t = normTarget(o.target); const r = reasonOf(o); let txt;
    if (r === 'temporary') {
      const ex = asMs(x.expires != null ? x.expires : x.reviewBy); if (ex == null || ex <= now() || ex > endOfDay(now() + TEMP_MAX_DAYS * DAY)) return { ok: false, field: 'expires', error: 'Pick an expiry date, 30 days from today at most.' };
      o.expires = ex; o.reviewBy = ex; txt = `expires ${fmtDate(ex)}`;
    } else {
      const rb = x.reviewBy != null && x.reviewBy !== '' ? asMs(x.reviewBy) : now() + (REVIEW_DAYS[r] || 365) * DAY;
      if (rb == null || rb <= now()) return { ok: false, field: 'reviewBy', error: 'Pick a review date after today.' };
      o.reviewBy = rb; txt = `review by ${fmtDate(rb)}`;
    }
    o.history.push({ at: now(), who: ME, text: `Extended: ${txt} · ${note}` });
    const what = whatOf(key, t); const vt = valText(t.kind, o.value, info(key, t));
    act(now(), key, `Extended the override on ${what}: ${txt} (${note})`, 'config'); _.touch(); _.persist();
    return { ok: true, id, toast: `Extended: ${what} ${vt}, ${txt}.` };
  }
  function promote(id, opts) {
    const o = recById(id); if (!o || !isValueKind(o) || !isLive(o)) return { ok: false, error: 'No such override.' };
    const x = opts || {}; const key = o.plant; const t = normTarget(o.target);
    if (reasonOf(o) === 'temporary') return { ok: false, error: 'A Temporary override ends by itself: it is not promoted.' };
    if (o.suspendedBy) return { ok: false, error: 'This override is suspended by a Forced library change: it can be promoted once the change is lifted.' };
    const inf = info(key, t); const lib = inf.lib || {};
    if (x.as === 'variant') { const own = lib.owner; const r = requestVariant({ plant: key, ownerCode: own ? own.code : null, typeKey: own ? own.typeKey : null, ownerName: own ? own.name : null, trait: x.trait, note: x.note, fromOverride: id, fromText: `${whatOf(key, t)} ${valText(t.kind, o.value, inf)}` }); return r.ok ? { ok: true, requestId: r.request.id } : { ok: false, field: 'trait', error: r.error }; }
    if (t.kind === 'tier') { const e = _.eqRaw(key, t.eqId); const cat = e ? _.catByType(e.type) : null; const up = e && isUp(key, e.id); const upType = up ? (_.setOf(_.libKey(e)) || {}).upType : null; return { ok: true, href: up && upType ? `#/library/up-types/${upType}?promote=${id}` : `#/library/eq-types/${cat ? cat.code : ''}?promote=${id}` }; }
    if (!lib.templateId) return { ok: false, variantOnly: true, error: 'The library has no limit rule for this value, so there is no default to change: request a library variant instead.' };
    return { ok: true, href: `#/library/templates/${lib.templateId}?promote=${id}` };
  }
  function promoted(id, changeId) {
    const o = recById(id); if (!o || !isValueKind(o) || !isLive(o)) return { ok: false, error: 'No such override.' };
    const key = o.plant; const t = normTarget(o.target); const inf = info(key, t);
    const ch = (_.S.lib && Array.isArray(_.S.lib.changes) ? _.S.lib.changes : []).find((c) => c.id === changeId) || null;
    const ownerName = (ch && (ch.name || ch.typeName)) || (inf.lib && (inf.lib.templateName || (inf.lib.owner && inf.lib.owner.name))) || 'the library';
    const v = (ch && (ch.v || ch.version)) || (inf.lib && inf.lib.templateVersion) || 1;
    const vt = valText(t.kind, o.value, inf);
    endRec(o, 'promoted', `Promoted to the library (${ownerName} v${v})`); o.history.push({ at: now(), who: ME, text: `Promoted to the library (${ownerName} v${v})` });
    mirror(key, t, schedOf(t) ? clone(_.schedRaw(key, t.scheduleId)) : null);
    act(now(), key, `Promoted ${plantName(key)}'s override to the library: ${whatOf(key, t)} ${vt} (${ownerName} v${v})`, 'library'); _.touch(); _.persist();
    return { ok: true, id };
  }
  function ensureLib() { const L = _.S.lib || (_.S.lib = {}); if (!Array.isArray(L.variantRequests)) L.variantRequests = []; if (!L.singleUseKept || typeof L.singleUseKept !== 'object') L.singleUseKept = {}; return L; }
  function requestVariant(arg) {
    const a = arg || {}; const trait = String(a.trait || '').trim(); if (!trait) return { ok: false, error: 'Name the trait that makes this kind differ.' };
    const L = ensureLib(); const code = a.ownerCode || null; const typeKey = a.typeKey || (code ? `eq:${code}` : null);
    const ownerName = a.ownerName || (code ? ((_.catByCode(code) || {}).type || safe(() => (V.upType(code) || {}).name, null) || code) : 'the library');
    const req = { id: _.counterId('vseq', 'vr'), at: now(), who: ME, plant: a.plant || null, ownerCode: code, typeKey, ownerName, trait, note: String(a.note || '').trim(), fromOverride: a.fromOverride || null, fromText: a.fromText || null };
    L.variantRequests.push(req);
    act(now(), a.plant || null, `Requested a library variant of ${ownerName}: "${trait}"${req.note ? ` (${req.note})` : ''}`, 'library'); _.touch(); _.persist();
    return { ok: true, request: req, toast: `Variant requested for ${ownerName}: "${trait}". Nothing changes at this plant.` };
  }
  const variantRequests = (ownerCode) => { const L = _.S && _.S.lib; const list = L && Array.isArray(L.variantRequests) ? L.variantRequests : []; return list.filter((r) => !ownerCode || r.ownerCode === ownerCode || r.typeKey === ownerCode).slice().reverse().map((r) => ({ ...r, atText: fmtDate(r.at), plantName: r.plant ? plantName(r.plant) : 'All plants' })); };

  /* ── single-use templates (a need at one plant is a library template used there only) ───────── */
  function singleUseList() { return _.cached('lg:su', singleUseRaw); }
  function singleUseRaw() {
    const tf = fnOf('templates'); const fromLib = tf ? safe(() => tf({}), null) : null;
    if (Array.isArray(fromLib)) return fromLib.filter((x) => x && x.singleUse).map((x) => ({ id: x.id, name: x.name, plant: x.singleUse.plant, scheduleId: x.singleUse.from || x.singleUse.scheduleId || null, every: x.every || null, since: x.singleUse.since != null ? x.singleUse.since : null, ownerCode: x.owner ? x.owner.code || x.owner.id : null, typeName: x.owner ? x.owner.typeName : null }));
    const L = _.S && _.S.lib; return L && Array.isArray(L.singleUse) ? L.singleUse.slice() : [];
  }
  const singleUseFor = (key, scId) => singleUseList().find((x) => x.plant === key && x.scheduleId === scId) || null;
  function singleUse(opts) {
    const o = opts || {}; const L = _.S && _.S.lib; const kept = (L && L.singleUseKept) || {};
    return singleUseList().filter((x) => !o.plant || x.plant === o.plant).map((x) => {
      const sc = x.scheduleId ? _.schedRaw(x.plant, x.scheduleId) : null; const e = sc && sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(x.plant, sc.subject.id) : null;
      const typeName = x.typeName || (e ? e.type : null); const since = x.since != null ? x.since : MIGRATED_AT[x.plant] != null ? MIGRATED_AT[x.plant] : (P(x.plant) || {}).since;
      const every = (sc && _.C.cadenceOf(sc)) || x.every; const valueText = everyText(every); const k = kept[x.id] || null;
      return { id: x.id, plant: x.plant, plantName: plantName(x.plant), kind: 'task', name: x.name, scheduleId: x.scheduleId, eqId: e ? e.id : null, tag: e ? e.tag : null, typeName, ownerCode: x.ownerCode || (typeName ? _.codeOfType(typeName) : null), valueText, since, sinceText: fmtDate(since), keptAt: k ? k.at : null, keptBy: k ? k.by : null, keptText: k ? `Kept single-use · ${fmtDate(k.at)} · ${youOr(k.by)}` : null,
        text: `${x.name} · Task on ${e ? `${e.tag} (${typeName})` : 'the plant'} · ${valueText} · used at ${plantName(x.plant)} only · since ${fmtDate(since)}`, mergeLabel: `Merge into ${typeName || 'its type'}…`,
        mergeBanner: `Merging ${x.name} from ${plantName(x.plant)} into ${typeName || 'its type'}. Check Downstream, then publish.`, mergeTitle: `Merge ${x.name} into ${typeName || 'its type'}?`, mergeBody: `Opens ${typeName || 'its type'} in the library with ${x.name} added. Publishing makes it a library template for every plant with a ${typeName || 'piece of equipment of its type'}; it arrives there as a draft.`, chip: chipFor({ src: 'library', template: x.name, v: 1, singleUse: { plant: x.plant } }) };
    });
  }
  function keepSingleUse(id) {
    const su = singleUse({}).find((x) => x.id === id); if (!su) return { ok: false, error: 'No such single-use template.' };
    const L = ensureLib(); L.singleUseKept[id] = { at: now(), by: ME };
    act(now(), su.plant, `Kept ${su.name} single-use at ${su.plantName}`, 'library'); _.touch(); _.persist();
    return { ok: true, toast: `Kept single-use: ${su.name} at ${su.plantName}.` };
  }
  function mergeSingleUse(id) { const su = singleUse({}).find((x) => x.id === id); if (!su) return { ok: false, error: 'No such single-use template.' }; return { ok: true, href: `#/library/templates/${id}?merge=1` }; }

  /* ── library changes reach the ledger ──────────────────────────────────────────────────────── */
  function ledgerOnBaseChange(arg) {
    const a = arg || {}; const out = { cleared: [], suspended: [] }; if (!_.S) return out;
    const match = typeof a.match === 'function' ? a.match : () => true;
    const list = _.S.overrides.filter((o) => isValueKind(o) && isLive(o) && (!a.plant || o.plant === a.plant) && safe(() => !!match(normTarget(o.target), o), false));
    _.touch();
    if (a.kind === 'minor' || a.kind === 'derived') {
      list.filter((o) => !o.suspendedBy).forEach((o) => {
        const t = normTarget(o.target); const inf = infoRaw(o.plant, t); if (!inf.ok || !sameVal(t.kind, o.value, inf.base)) return;
        const vt = valText(t.kind, inf.base, inf, inf.baseSource); const who = typeof a.owner === 'string' ? a.owner : (a.owner && (a.owner.templateName || a.owner.name || a.owner.typeName)) || (inf.lib && inf.lib.templateName) || 'the library';
        endRec(o, 'cleared', a.kind === 'derived' ? `Cleared: the derived value is now ${vt}` : `Cleared by ${who} v${a.version || (inf.lib && inf.lib.templateVersion) || 1}: the library now uses ${vt}`, now(), null);
        o.history.push({ at: now(), who: '—', text: o.endedNote }); mirror(o.plant, t); out.cleared.push(o.id);
      });
    } else if (a.kind === 'forced') {
      list.forEach((o) => { o.suspendedBy = a.changeId || 'forced'; if (!Array.isArray(o.history)) o.history = []; o.history.push({ at: now(), who: '—', text: 'Suspended by a Forced library change: kept, not applied' }); mirror(o.plant, normTarget(o.target)); out.suspended.push(o.id); });
    }
    _.touch(); return out;
  }
  function ledgerLiftForced(changeId) {
    const out = { lifted: [] }; if (!_.S) return out;
    _.S.overrides.filter((o) => isValueKind(o) && isLive(o) && o.suspendedBy && (changeId == null || o.suspendedBy === changeId)).forEach((o) => { o.suspendedBy = null; o.history.push({ at: now(), who: '—', text: 'The Forced library change was lifted: applied again' }); mirror(o.plant, normTarget(o.target)); out.lifted.push(o.id); });
    _.touch(); _.persist(); return out;
  }

  /* ── Temporary overrides end by themselves ─────────────────────────────────────────────────── */
  function expireTemporary(t, out) {
    if (!_.S) return;
    _.S.overrides.filter((o) => isValueKind(o) && isLive(o) && o.expires != null && o.expires <= t).sort((a, b) => a.expires - b.expires || (a.id < b.id ? -1 : 1)).forEach((o) => {
      const key = o.plant; const tt = normTarget(o.target); const inf = infoRaw(key, tt); const scOld = schedOf(tt) ? clone(_.schedRaw(key, tt.scheduleId)) : null;
      const bt = baseText(tt.kind, inf.base, inf.baseSource, inf);
      endRec(o, 'expired', `Expired: back to the library value ${bt}`, o.expires, null); o.history.push({ at: o.expires, who: '—', text: o.endedNote });
      mirror(key, tt, scOld); markMoved(key, tt);
      const told = (P(key) || {}).state === 'commissioning' ? 'Commissioning: nothing is sent.' : 'Plant admins told.';
      act(o.expires, key, `Temporary override expired: ${whatOf(key, tt)} back to the library value ${bt}. ${told}`, 'config', '—');
      if (out && Array.isArray(out.expired)) out.expired.push(o.id);
    });
    _.touch();
  }

  /* ── reading the ledger ────────────────────────────────────────────────────────────────────── */
  function ovState(o) {
    if (!o) return null; const st = statusOf(o); if (st !== 'active') return st;
    if (o.suspendedBy) return 'suspended';
    if (isStructureKind(o)) {
      // a membership row is signed on its equipment, a type change on its unit process; control groups carry no signature
      const sigId = o.target.kind === 'uptype' ? o.target.upId : o.target.eqId;
      const f = fnOf('linkSigOf'); const cur = f && o.linkSig != null && sigId ? safe(() => f(o.plant, sigId), null) : null;
      if (cur != null && cur !== o.linkSig) return 'underneath';
      return o.reviewBy != null && o.reviewBy <= now() ? 'pastreview' : 'active';
    }
    if (isBaseMoved(o)) return 'basemoved';
    if (o.reviewBy != null && o.reviewBy <= now()) return 'pastreview';
    return 'active';
  }
  /* a resolver may ask a record's state while this file is reading that record's base (the structure file's tier does):
     the inner question is answered without the base, so the two never loop */
  const BUSY = new Set();
  function isBaseMoved(o) {
    if (!isValueKind(o) || !isLive(o) || o.suspendedBy) return false; const t = normTarget(o.target); if (t.kind === 'triggerLimit' || t.kind === 'enabled') return false;
    if (BUSY.has(o.id)) return false;
    BUSY.add(o.id);
    try { const inf = info(o.plant, t); return inf.ok && !sameVal(t.kind, o.base, inf.base); } finally { BUSY.delete(o.id); }
  }
  const isPastReview = (o) => isLive(o) && !o.suspendedBy && o.reviewBy != null && o.reviewBy <= now();
  function actionsFor(o, state, canDefault) {
    if (!isLive(o) || state === 'suspended') return [];
    const temp = reasonOf(o) === 'temporary';
    const prom = { id: 'promote', label: 'Promote', variantOnly: !canDefault };
    if (state === 'basemoved' && !temp) return [{ id: 'keep', label: 'Keep' }, { id: 'adopt', label: 'Adopt the library value', primary: true }, prom];
    const list = [{ id: 'revert', label: 'Revert' }, { id: 'extend', label: 'Extend', primary: state === 'pastreview' }];
    if (!temp) list.push(prom);
    return list;
  }
  function decorate(o) {
    const key = o.plant; const t = normTarget(o.target); const inf = info(key, t); const ok = inf.ok; const lib = (ok && inf.lib) || {};
    const state = ovState(o); const reason = reasonOf(o); const bm = isBaseMoved(o); const pr = isPastReview(o);
    const ctx = ok ? inf : { unit: '', kind: null };
    const valueText = valText(t.kind, o.value, ctx); const bText = baseText(t.kind, o.base, o.baseSource, ctx); const curText = ok ? baseText(t.kind, inf.base, inf.baseSource, ctx) : '—';
    const nodeId = nodeOf(key, t); const node = nodeId ? _.eqRaw(key, nodeId) : null;
    const owner = lib.owner || (o.baseOwner ? { kind: o.baseOwner.kind, code: o.baseOwner.code, name: o.baseOwner.name, typeKey: o.baseOwner.typeKey } : null);
    const ownerName = owner ? owner.name : node ? node.type : '';
    const tplName = t.kind === 'tier' ? null : lib.templateName || (o.baseOwner && o.baseOwner.templateName) || null;
    const ver = lib.templateVersion || (owner && owner.version) || 1;
    const cmp = t.kind === 'zone' ? (t.dir === 'below' ? '< ' : '> ') : '';
    const srcNow = ok ? inf.baseSource : o.baseSource;
    const libText = !ok || inf.base == null ? 'library: no rule' : srcNow === 'derived' ? `derived ${cmp}${curText}` : `library ${cmp}${curText} (v${ver})`;
    const fLabel = fieldLabel(t);
    const header = [ownerName, tplName, fLabel, libText].filter(Boolean).join(' · ');
    const groupKey = `${owner && owner.typeKey ? owner.typeKey : ownerName}|${lib.templateId || tplName || ''}|${fieldId(t)}`;
    const ageDays = o.at != null ? Math.floor((now() - o.at) / DAY) : null;
    const ageText = reason === 'temporary' && o.expires != null ? `expires in ${Math.max(0, Math.ceil((o.expires - now()) / DAY))} d` : ageDays != null ? `${ageDays} d` : '—';
    const ch = (_.S.lib && Array.isArray(_.S.lib.changes) ? _.S.lib.changes : []).find((c) => o.suspendedBy && c.id === o.suspendedBy) || null;
    const chip = state === 'suspended' ? chipFor({ src: 'suspended', template: (ch && ch.name) || tplName || ownerName, v: (ch && (ch.v || ch.version)) || ver })
      : bm ? (() => { const pp = pairParts(t.kind, o.base, inf.base, ctx, false); return chipFor({ src: 'basemoved', old: pp[0], new: pp[1] }); })()
        : chipFor({ src: 'override', reason, author: o.author, at: o.at, reviewBy: o.reviewBy, expires: o.expires, baseText: t.kind === 'triggerLimit' ? curText : bText, baseSource: o.baseSource });
    const stateChip = state === 'basemoved' ? { text: 'Base moved', tone: 'moved' } : state === 'pastreview' ? { text: 'Past review', tone: 'review' } : state === 'suspended' ? { text: 'Suspended', tone: 'susp' } : HISTORY_STATES.includes(state) ? { text: LABELS.overrideState[state], tone: 'lib' } : null;
    const forcedV = state === 'suspended' && ok ? inf.zone && inf.zone.bands ? inf.zone.bands[t.band] : null : null;
    const valueBase = state === 'suspended' ? `${valueText} · suspended: forced ${forcedV == null ? 'no value' : valText(t.kind, forcedV, ctx)}` : bm ? `${valueText} · base moved ${pairText(t.kind, o.base, inf.base, ctx, true)}` : `${valueText} · ${t.kind === 'triggerLimit' ? curText : bText}`;
    const reasonLabel = LABELS.reason[reason] || reason;
    const historyLine = !isLive(o) ? `${LABELS.overrideState[state] || cap(state)} ${dMon(o.endedAt)}${o.endedBy ? ` by ${youOr(o.endedBy)}` : ''}: ${o.endedNote || ''}` : null;
    return {
      ...o, target: { ...t }, kind: t.kind, field: fieldId(t), fieldLabel: fLabel, status: statusOf(o), state, stateLabel: LABELS.overrideState[state] || state, isBaseMoved: bm, isPastReview: pr,
      reason, reasonLabel, what: whatOf(key, t), valueText, baseText: bText, currentBase: ok ? inf.base : null, currentBaseText: curText, currentBaseSource: srcNow,
      ownerName, ownerCode: owner ? owner.code : null, ownerKind: owner ? owner.kind : null, typeKey: owner ? owner.typeKey : null, templateId: lib.templateId || null, templateName: tplName, templateVersion: ver,
      ownerText: tplName ? `${ownerName} · ${tplName} v${ver}` : `${ownerName} v${ver}`, groupKey, header, libText,
      ageDays, ageText, atText: o.at != null ? fmtDate(o.at) : '—', reviewByText: o.reviewBy != null ? fmtDate(o.reviewBy) : '—', expiresText: o.expires != null ? fmtDate(o.expires) : null, authorText: youOr(o.author),
      plantName: plantName(key), eqId: nodeId, tag: node ? node.tag : null, typeName: node ? node.type : null, unit: ctx.unit || '',
      href: fieldHref(o), actions: actionsFor(o, state, t.kind === 'tier' || !!lib.templateId), chip, stateChip, valueBase,
      reasonNote: `${reasonLabel}${o.note ? ` · "${o.note}"` : ''}`,
      movedQuestion: bm ? `The library changed this from ${bText} to ${curText} after you overrode it. Keep ${valueText}, or adopt ${curText}?` : null, adoptLabel: `Adopt ${curText}`, keepLabel: `Keep ${valueText}`,
      promoteBanner: `Promoting ${plantName(key)}'s override: ${whatOf(key, t)} ${valueText} (${srcNow === 'derived' ? 'derived' : 'library'} ${curText}). Check Downstream, then publish.`,
      promoteText: `${plantName(key)} uses ${valueText} for ${whatOf(key, t)}; the library says ${curText}.`, migratedLine: reason === 'migrated' && o.at != null ? `Set before ${fmtDate(o.at)} · who: not recorded` : null, historyLine,
      /* names v7/1's pages read */
      plantValue: valueText, libValue: curText, baseValue: bText, typeCode: node ? _.codeOfType(node.type) : null, baseFrom: srcNow === 'derived' ? 'form' : 'lib', baseLabel: srcNow === 'derived' ? 'Derived' : 'Library', backText: 'Revert', libRaw: ok ? inf.base : null, baseDiffers: bm, sameAsLib: false, untilText: o.expires != null ? fmtDate(o.expires) : null,
    };
  }
  function decorateStructure(o) {
    const key = o.plant; const t = o.target || {}; const st = ovState(o);
    const upView = t.upId && fnOf('unitProcess') ? safe(() => V.unitProcess(key, t.upId), null) : null;
    const upTag = (upView && upView.tag) || nodeTag(key, t.upId); const eqTag = nodeTag(key, t.eqId);
    const typeName = (id) => (id && fnOf('upType') ? (safe(() => V.upType(id), null) || {}).name || id : id || '—');
    let what = '', stateText = '', label = upTag;
    if (t.kind === 'member') { what = `${eqTag} ${t.op === 'remove' ? 'removed' : 'added'}`; stateText = t.op === 'remove' ? 'Removed · was proposed' : 'Added · not proposed'; }
    else if (t.kind === 'uptype') { what = 'type changed'; stateText = `Type: ${typeName(o.value)} · was ${typeName(o.base)}`; }
    else if (t.kind === 'cg') { const cg = t.cgId && fnOf('controlGroup') ? safe(() => V.controlGroup(key, t.cgId), null) : null; label = (cg && cg.name) || t.cgId || 'Control group'; what = t.op === 'make' ? 'control group made' : t.op === 'reject' ? 'control group rejected' : 'control group edited'; stateText = Array.isArray(o.value) ? o.value.map((x) => nodeTag(key, x)).join(', ') : ''; }
    const ageDays = o.at != null ? Math.floor((now() - o.at) / DAY) : null;
    return { ...o, kind: t.kind, state: st, stateLabel: LABELS.overrideState[st] || st, label: `${label} · ${what}`, upTag, eqTag, what, stateText, note: o.note || '', authorText: youOr(o.author), ageDays, ageText: ageDays != null ? `${ageDays} d` : '—', atText: o.at != null ? fmtDate(o.at) : '—', plantName: plantName(key), href: fieldHref(o), stateChip: st === 'underneath' ? { text: 'Changed underneath', tone: 'gap' } : null, actions: [{ id: 'structure', label: 'Open on the structure page' }] };
  }
  function fieldHref(o) {
    if (!o || !o.target) return null; const key = o.plant; const t = o.target; const k = KIND_V2[t.kind] || t.kind; const f = fieldId(t);
    if (k === 'zone') return `#/p/${key}/sensor/${t.sensorId}?f=${f}`;
    if (k === 'triggerLimit' || ((k === 'persistence' || k === 'clearing' || k === 'enabled') && t.alertId)) return `#/p/${key}/trigger/${t.alertId}?f=${f}`;
    if (k === 'cadence' || k === 'runhours' || (k === 'enabled' && t.scheduleId)) return `#/p/${key}/trigger/${t.scheduleId}?f=${f}`;
    if (k === 'condition') return `#/p/${key}/trigger/${t.workId}?f=${f}`;
    if (k === 'tier') return `#/p/${key}/${isUp(key, t.eqId) ? 'up' : 'eq'}/${t.eqId}/details?f=tier`;
    if (k === 'member' || k === 'uptype') return `#/p/${key}/structure?select=up:${t.upId}`;
    if (k === 'cg') return `#/p/${key}/structure?select=cg:${t.cgId}`;
    return null;
  }
  const STATE_ALIAS = { ended: 'history', libchanged: 'basemoved', review: 'pastreview' };
  function overrides(opts) {
    const o = opts || {}; const state = STATE_ALIAS[o.state] || o.state;
    return _.cached(`lg:ov:${JSON.stringify({ ...o, state })}`, () => {
      const all = _.S.overrides.filter((x) => !o.plant || x.plant === o.plant);
      let list;
      if (o.kind === 'structure') list = all.filter(isStructureKind).map(decorateStructure);
      else if (o.kind === 'all') list = [...all.filter(isValueKind).map(decorate), ...all.filter(isStructureKind).map(decorateStructure)];
      else list = all.filter((x) => isValueKind(x) && (!o.kind || (KIND_V2[x.target.kind] || x.target.kind) === o.kind)).map(decorate);
      return list.filter((x) => {
        const live = x.status === 'active' || (x.status == null && !x.endedAt);
        if (state === 'all') { /* every record */ } else if (state === 'history') { if (live) return false; } else if (state === 'basemoved') { if (!x.isBaseMoved) return false; } else if (state === 'pastreview') { if (!live || !(x.isPastReview || x.state === 'pastreview')) return false; } else if (state) { if (x.state !== state) return false; } else if (!live) return false;
        if (o.reason && x.reason !== o.reason) return false;
        if (o.eqId && x.eqId !== o.eqId && x.target.eqId !== o.eqId) return false;
        if (o.owner && x.ownerCode !== o.owner && x.typeKey !== o.owner && x.templateId !== o.owner) return false;
        return true;
      });
    });
  }
  function overrideById(id) { const o = recById(id); if (!o) return null; return isStructureKind(o) ? decorateStructure(o) : isValueKind(o) ? decorate(o) : null; }
  function pinRows(key) {
    const f = fnOf('pins'); const list = f ? safe(() => f(key ? { plant: key } : {}), []) : [];
    return (Array.isArray(list) ? list : []).filter((p) => !p.endedAt).map((p) => { const tpl = tplById(p.templateId); const latest = tplVersion(tpl, p.templateId); return { ...p, plantName: plantName(p.plant), templateName: tpl ? tpl.name : p.templateId, ownerName: tpl && tpl.owner ? tpl.owner.typeName || tpl.owner.code || tpl.owner.id : '', pinnedV: p.v, latestV: latest, text: `${plantName(p.plant)} · ${tpl && tpl.owner ? `${tpl.owner.typeName || tpl.owner.code || tpl.owner.id} · ` : ''}${tpl ? tpl.name : p.templateId} · Pinned to v${p.v}${latest !== p.v ? ` · v${latest} is the latest` : ''}` }; });
  }
  function deviations(opts) {
    const o = opts || {}; const scope = o.plant || null; const show = o.show || 'overrides';
    return _.cached(`lg:dev:${JSON.stringify(o)}`, () => {
      const inScope = (x) => (!scope || x.plant === scope) && (!o.plantFilter || x.plant === o.plantFilter);
      const vals = overrides({ state: 'all' }).filter(inScope);
      const live = vals.filter((x) => x.status === 'active'); const hist = vals.filter((x) => x.status !== 'active');
      const structs = overrides({ kind: 'structure', state: 'all' }).filter(inScope); const structLive = structs.filter((x) => !HISTORY_STATES.includes(x.state));
      const pins = pinRows(scope).filter(inScope); const su = singleUse({ plant: scope || undefined }).filter(inScope);
      const byReason = {}; [...REASONS, 'migrated'].forEach((r) => { byReason[r] = live.filter((x) => x.reason === r).length; });
      const counts = { overrides: live.length, basemoved: live.filter((x) => x.isBaseMoved).length, pastreview: live.filter((x) => x.isPastReview).length, triggerlimit: live.filter((x) => x.kind === 'triggerLimit').length, pinned: pins.length, singleuse: su.length, suspended: live.filter((x) => x.state === 'suspended').length, structure: structLive.length, history: hist.length, byReason };
      const rowOk = (x) => (!o.reason || x.reason === o.reason) && (!o.template || x.groupKey.split('|')[0] === o.template || x.ownerCode === o.template || x.templateId === o.template || x.typeKey === o.template) && (!o.eqId || x.eqId === o.eqId);
      const showOk = show === 'basemoved' ? (x) => x.isBaseMoved : show === 'pastreview' ? (x) => x.isPastReview : show === 'suspended' ? (x) => x.state === 'suspended' : () => true;
      const plantRank = (k) => ORDER.indexOf(k);
      const rowRank = (x) => (x.isBaseMoved ? 0 : x.isPastReview ? 1 : 2);
      const sortRows = (rows) => rows.slice().sort((a, b) => rowRank(a) - rowRank(b) || plantRank(a.plant) - plantRank(b.plant) || String(a.tag || '').localeCompare(String(b.tag || '')) || a.what.localeCompare(b.what));
      const gmap = new Map();
      live.filter((x) => x.kind !== 'triggerLimit').forEach((x) => { if (!gmap.has(x.groupKey)) gmap.set(x.groupKey, []); gmap.get(x.groupKey).push(x); });
      const groups = [];
      gmap.forEach((rows, gk) => {
        const shown = rows.filter((x) => rowOk(x) && showOk(x)); if (!shown.length) return;
        const byVal = new Map(); rows.forEach((x) => { const vk = JSON.stringify(x.value); if (!byVal.has(vk)) byVal.set(vk, { plants: new Set(), valueText: x.valueText }); byVal.get(vk).plants.add(x.plant); });
        let variant = null; byVal.forEach((v) => { if (v.plants.size >= 2 && (!variant || v.plants.size > variant.plants)) variant = { plants: v.plants.size, valueText: v.valueText, text: `${v.plants.size} plants override this value the same way. Consider a library variant?`, button: 'Request a library variant' }; });
        const first = rows[0];
        groups.push({ key: gk, header: first.header, ownerName: first.ownerName, ownerCode: first.ownerCode, typeKey: first.typeKey, templateId: first.templateId, templateName: first.templateName, field: first.field, fieldLabel: first.fieldLabel, rows: sortRows(shown), variant, hasBaseMoved: rows.some((x) => x.isBaseMoved), hasPastReview: rows.some((x) => x.isPastReview) });
      });
      groups.sort((a, b) => (a.hasBaseMoved ? 0 : 1) - (b.hasBaseMoved ? 0 : 1) || (a.hasPastReview ? 0 : 1) - (b.hasPastReview ? 0 : 1) || a.header.localeCompare(b.header));
      const triggerLimit = sortRows(live.filter((x) => x.kind === 'triggerLimit' && rowOk(x)));
      const history = hist.filter(rowOk).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0) || (a.id < b.id ? -1 : 1));
      const structure = structs.slice().sort((a, b) => plantRank(a.plant) - plantRank(b.plant) || (b.at || 0) - (a.at || 0) || (a.id < b.id ? -1 : 1));
      const reasons = [...REASONS, 'migrated'].map((r) => ({ key: r, label: LABELS.reason[r], count: byReason[r] }));
      const tmap = new Map(); live.forEach((x) => { const k = x.groupKey.split('|')[0]; if (!tmap.has(k)) tmap.set(k, { key: k, label: x.ownerName, count: 0 }); tmap.get(k).count++; });
      const templates = [...tmap.values()].sort((a, b) => a.label.localeCompare(b.label));
      const plants = ORDER.filter((k) => P(k)).map((k) => ({ key: k, name: plantName(k), count: live.filter((x) => x.plant === k).length }));
      const nothing = !counts.overrides && !counts.pinned && !counts.singleuse && !counts.structure && !counts.history;
      const empty = nothing ? (scope ? `No deviations at ${plantName(scope)}: every value follows the library.` : 'No deviations: every value at every plant follows the library.') : null;
      const filtered = (show === 'overrides' || show === 'basemoved' || show === 'pastreview' || show === 'suspended') && !groups.length && !nothing ? 'Nothing here with this filter.' : null;
      return { show, plant: scope, title: 'Deviations', sub: scope ? `Every override, pin and base moved item at ${plantName(scope)}, grouped by library field.` : 'Every override, pin and base moved item at every plant, grouped by library field.', counts, groups, triggerLimit, structure, pinned: pins, singleUse: su, history, reasons, templates, plants, empty, filtered };
    });
  }
  function deviationCounts(key) {
    const c = deviations({ plant: key }).counts; let frozen = 0, waiting = 0;
    (d(key) ? d(key).alerts : []).forEach((a) => { const h = heldOf(key, a.id); if (h.frozen) frozen++; else if (h.waiting) waiting++; });
    return { overrides: c.overrides, baseMoved: c.basemoved, pastReview: c.pastreview, triggerLimit: c.triggerlimit, pinned: c.pinned, suspended: c.suspended, singleUse: c.singleuse, structure: c.structure, frozen, waitingResync: waiting };
  }

  /* ── the one chip formatter ────────────────────────────────────────────────────────────────── */
  const SRC_ALIAS = { lib: 'library', der: 'derived', form: 'derived', ovr: 'override', changed: 'override', moved: 'basemoved', libchanged: 'basemoved', baseMoved: 'basemoved', susp: 'suspended', none: 'gap', pin: 'pinned', prop: 'proposed', triggerLimit: 'triggerOverride', single: 'single' };
  function chipFor(src) {
    const s0 = src || {}; let k = typeof s0.src === 'string' ? s0.src : typeof s0.source === 'string' ? s0.source : typeof s0.chip === 'string' ? s0.chip : 'library'; k = SRC_ALIAS[k] || k;
    /* the value-source record keeps some parts nested: read them flat */
    const s = { ...s0 };
    if (s0.derived && typeof s0.derived === 'object') { if (s.ruleText == null) s.ruleText = s0.derived.ruleText; if (s.paramText == null) s.paramText = s0.derived.paramText; }
    if (s0.pinned && typeof s0.pinned === 'object') { if (s.v == null) s.v = s0.pinned.version; if (s.latest == null) s.latest = s0.pinned.latest; if (s.x == null) s.x = s0.pinned.latestValueText; }
    if (s0.gap && typeof s0.gap === 'object') { const nd = s0.gap.needs; if (s.paramLabel == null) s.paramLabel = nd && typeof nd === 'object' ? nd.label : nd; if (s.tag == null) s.tag = s0.gap.tag || (nd && nd.tag); }
    if (s0.frozen && typeof s0.frozen === 'object' && s.n == null) s.n = s0.frozen.open;
    if (s0.owner && typeof s0.owner === 'object') { if (s.typeName == null) s.typeName = s0.owner.name || s0.owner.typeName; if (s.v == null && s.version == null) s.version = s0.owner.version; }
    if (k === 'followsSensor' && s.tag == null) s.tag = s0.sensorTag;
    if (k === 'override' && (s.suspended || s.suspendedBy || s.overrideState === 'suspended')) k = 'suspended'; else if (k === 'override' && (s.baseMoved || s.state === 'basemoved' || s.overrideState === 'basemoved')) k = 'basemoved';
    if (k === 'basemoved' && s.old == null) { const fromRec = 'recordBase' in s0; s.old = fromRec ? s0.recordBase : s0.base; s.new = fromRec ? s0.base : s0.resolved !== undefined ? s0.resolved : s0.libValue; }
    const nTxt = (x) => (typeof x === 'number' ? `${numText(x)}${s.unit && s.unit !== '%' && s.unit !== 'pH' ? ' ' + s.unit : s.unit === '%' ? '%' : ''}` : x);
    if (k === 'basemoved') { s.old = typeof s.old === 'number' ? numText(s.old) : s.old == null ? 'no value' : s.old; s.new = typeof s.new === 'number' ? numText(s.new) : s.new == null ? 'no value' : s.new; }
    if (s.baseText == null && typeof s.base === 'number') s.baseText = nTxt(s.base);
    if (s.v == null && s.pinnedTo != null) s.v = s.pinnedTo; if (s.x == null && s.pinnedNext != null) s.x = nTxt(s.pinnedNext);
    if (s.v == null && s.templateVersion != null) s.v = s.templateVersion;
    if (s.sensorValueText == null && typeof s.sensorValue === 'number') s.sensorValueText = nTxt(s.sensorValue);
    const tv = (name, v) => `${name || 'the library'} v${v || 1}`;
    if (k === 'library') { const out = { text: `Library · ${tv(s.template || s.templateName || s.typeName || (s.owner && s.owner.name), s.v || s.version)}`, tone: 'lib', sub: null, small: null }; if (s.singleUse) out.extra = [chipFor({ src: 'single', plant: s.singleUse.plant, plantName: s.singleUse.plantName })]; return out; }
    if (k === 'derived') return { text: `Derived · ${s.ruleText || 'from a design parameter'}${s.paramText ? ` (${s.paramText})` : ''}`, tone: 'der', sub: null, small: null };
    if (k === 'override') {
      const r = REASON_V2[s.reason] || s.reason; const tail = r === 'temporary' && s.expires != null ? `expires ${dMon(s.expires)}` : `review by ${dMon(s.reviewBy)}`;
      const bt = s.baseText != null ? s.baseText : s.base != null ? String(s.base) : null;
      const small = s.baseSource === 'sensor' ? `Sensor: ${bt}` : bt == null || bt === 'no rule' || s.baseSource === 'gap' ? 'Library: no rule' : `${s.baseSource === 'derived' ? 'Derived' : 'Library'}: ${bt}`;
      return { text: `Override · ${LABELS.reason[r] || r} · ${youOr(s.author)} · ${dMon(s.at)} · ${tail}`, tone: 'ovr', sub: null, small };
    }
    if (k === 'basemoved') return { text: 'Base moved', tone: 'moved', sub: `Library changed ${s.old} → ${s.new} since you overrode it`, small: null };
    if (k === 'suspended') return { text: 'Suspended', tone: 'susp', sub: `Forced by library · ${tv(s.template, s.v)} · your override is kept and will return when lifted`, small: null };
    if (k === 'forced') return { text: `Forced by library · ${tv(s.template, s.v)}`, tone: 'forced', sub: null, small: null };
    if (k === 'pinned') { const p = s.v != null ? s.v : s.pinnedTo; const latest = s.latest; return { text: latest != null && latest !== p ? `Pinned to v${p} · v${latest} changes this to ${s.x != null ? s.x : s.latestValueText}` : `Pinned to v${p}`, tone: 'pin', sub: null, small: null }; }
    if (k === 'proposed') return { text: 'Proposed', tone: 'prop', sub: null, small: null };
    if (k === 'followsSensor') { const zt = s.zoneText || (s.zone ? chipFor(s.zone).text : ''); return { text: `Follows sensor ${s.tag || s.sensorTag}${zt ? ` · ${zt}` : ''}`, tone: 'lib', sub: null, small: null }; }
    if (k === 'triggerOverride') { const r = REASON_V2[s.reason] || s.reason; return { text: `Overridden for this Trigger · ${LABELS.reason[r] || r}`, tone: 'ovr', sub: null, small: s.sensorValueText != null ? `Sensor: ${s.sensorValueText}` : null }; }
    if (k === 'gap') { const lab = s.paramLabel || s.label || (s.needs && s.needs.label) || null; const tag = s.tag || (s.needs && s.needs.tag) || null; return lab ? { text: `Gap · needs ${lab}${tag ? ` (${tag})` : ''}`, tone: 'gap', sub: null, small: null } : { text: 'Gap · no rule', tone: 'gap', sub: 'No value · this reading raises nothing', small: null }; }
    if (k === 'frozen') { const n = s.n != null ? s.n : 1; return { text: `Frozen while ${n} ${n === 1 ? 'Issue is' : 'Issues are'} open`, tone: 'frozen', sub: null, small: null }; }
    if (k === 'held') return { text: 'Base moved · waits for a resync', tone: 'moved', sub: null, small: null };
    if (k === 'next') return { text: 'Next phase', tone: 'next', sub: null, small: null };
    if (k === 'single') return { text: `Single-use · ${s.plantName || (s.plant ? plantName(s.plant) : 'one plant')} only`, tone: 'single', sub: null, small: null };
    return { text: String(s.text || ''), tone: s.tone || 'lib', sub: s.sub || null, small: s.small || null };
  }

  /* ── the migration: v7/1's imported differences become Alex's records (after the seed; draws no shared id) ── */
  function migratePlant(key, at0) {
    const PL = P(key); const dd = d(key); if (!PL || !dd) return { migrated: 0, singleUse: 0 };
    const at = at0 != null ? at0 : MIGRATED_AT[key] != null ? MIGRATED_AT[key] : PL.since; const L = ensureLib();
    const list = _.S.overrides; const out = []; let nSingle = 0;
    const mig = (o, t, extra) => {
      const inf = infoRaw(key, t); const lib = inf.ok ? inf.lib || {} : {};
      const r = REASON_V2[o.reason] || o.reason; const seedR = SEED_REASON.find((x) => x.plant === key && x.kind === t.kind && x.sensorId === t.sensorId && x.band === t.band);
      const reason = seedR ? seedR.reason : r;
      const src = inf.ok ? inf.baseSource : 'gap';
      /* a library base is the one the plant left (it may have moved since, e.g. a later publish); a derived base is what the
         derivation gives now (no parameter changed since the plant went live) */
      const base = extra && 'base' in extra ? extra.base : src === 'derived' || src === 'sensor' ? inf.base : o.base !== undefined ? o.base : inf.base;
      const migrated = reason === 'migrated';
      const recAt = migrated ? at : o.at != null ? o.at : at;
      const reviewBy = migrated ? at + REVIEW_DAYS.migrated * DAY : reason === 'physical' && seedR ? recAt + REVIEW_DAYS.physical * DAY : o.reviewBy != null ? o.reviewBy : recAt + (REVIEW_DAYS[reason] || 365) * DAY;
      const curV = lib.templateVersion || 1;
      const baseVersion = src === 'library' && inf.ok && !sameVal(t.kind, base, inf.base) ? Math.max(1, curV - 1) : curV;
      return { id: (extra && extra.id) || o.id, plant: key, target: t, field: fieldId(t), value: extra && 'value' in extra ? extra.value : o.value, base: base != null ? base : null, baseSource: base == null && src !== 'sensor' ? 'gap' : src, baseOwner: ownerRecord(lib), baseVersion, reason, note: migrated ? '' : o.note || '', author: migrated ? null : o.author != null ? o.author : null, at: recAt, reviewBy, expires: null, status: o.endedAt != null ? 'reverted' : 'active', endedAt: o.endedAt != null ? o.endedAt : null, endedBy: null, endedNote: o.endedNote || null, suspendedBy: null, variantRequest: null, history: [] };
    };
    const next = [];
    list.forEach((o) => {
      if (o.plant !== key || isStructureKind(o) || o.status) { next.push(o); return; }
      const k = KIND_V2[o.target.kind] || o.target.kind;
      if (o.target.kind === 'reading') {
        const v = o.value || {}; const bands = BANDS.filter((b) => v[b] != null);
        bands.forEach((b, j) => next.push(mig(o, { kind: 'zone', sensorId: o.target.sensorId, dir: o.target.dir, band: b }, { id: j === 0 ? o.id : `${o.id}_${String.fromCharCode(97 + j)}`, value: v[b], base: null })));
        return;
      }
      if (k === 'cadence' && o.reason === 'notinlib') {
        const sc = _.schedRaw(key, o.target.scheduleId);
        if (sc) {
          const e = sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(key, sc.subject.id) : null;
          const add = fnOf('addSingleUse');
          if (add) safe(() => add(key, sc, { since: at }));
          else { if (!Array.isArray(L.singleUse)) L.singleUse = []; const id = `tpl_single_${key}_${sc.id}`; if (!L.singleUse.some((x) => x.id === id)) L.singleUse.push({ id, name: sc.name, plant: key, scheduleId: sc.id, every: o.value ? { ...o.value } : _.C.cadenceOf(sc), since: at, ownerCode: e ? _.codeOfType(e.type) : null, typeName: e ? e.type : null }); }
          nSingle++; return;
        }
      }
      if (o.target.kind === 'alert') { next.push(o); return; }
      const t = normTarget(o.target); if (!t) { next.push(o); return; }
      if (t.kind === 'zone' && !t.dir) t.dir = _.primaryDir(key, t.sensorId);
      const extra = t.kind === 'enabled' ? { value: o.value === 'off' ? false : o.value === 'on' ? true : !!o.value, base: true } : null;
      next.push(mig(o, t, extra));
    });
    _.S.overrides = next; _.touch();
    /* a migrated value equal to its new base is dropped: it simply follows the library now */
    _.S.overrides = _.S.overrides.filter((o) => { if (o.plant !== key || !isValueKind(o) || o.status !== 'active' || o.reason !== 'migrated') return true; const inf = infoRaw(key, normTarget(o.target)); return !(inf.ok && sameVal(o.target.kind, o.value, inf.base)); });
    _.touch();
    /* the values v7/1 never imported (a Live plant's job thresholds above all): a stored value that differs from its new base
       becomes a Migrated record; criticality tiers are left to the structure (they follow the unit processes) */
    if (PL.state === 'live') sweep(key, at).forEach((r) => { _.S.overrides.push(r); out.push(r.id); });
    _.touch();
    const n = _.S.overrides.filter((o) => o.plant === key && o.reason === 'migrated' && isLive(o)).length;
    return { migrated: n, singleUse: nSingle, swept: out };
  }
  function sweep(key, at) {
    const dd = d(key); const recs = []; const has = (t) => !!findRec(key, t) || recs.some((r) => sameTarget(r.target, t));
    const add = (t, objectId, field, value, inf) => {
      const lib = inf.lib || {};
      recs.push({ id: `ovm_${key}_${objectId}_${field}`, plant: key, target: t, field: fieldId(t), value, base: inf.base, baseSource: inf.baseSource, baseOwner: ownerRecord(lib), baseVersion: lib.templateVersion || 1, reason: 'migrated', note: '', author: null, at, reviewBy: at + REVIEW_DAYS.migrated * DAY, expires: null, status: 'active', endedAt: null, endedBy: null, endedNote: null, suspendedBy: null, variantRequest: null, history: [] });
    };
    (dd.conditionWork || []).forEach((w) => ['doWhen', 'doneWhen'].forEach((which) => {
      if (w[which] == null) return; const t = { kind: 'condition', workId: w.id, which }; if (has(t)) return;
      _.touch(); const inf = infoRaw(key, t); if (!inf.ok || inf.base == null || sameVal('condition', w[which], inf.base)) return; add(t, w.id, which, w[which], inf);
    }));
    dd.sensors.filter((s) => !s.nextPhase && s.kind !== 'meter' && _.homeOf(key, s)).forEach((s) => {
      const inPlace = {}; if (s.direction && _.hasAny(s.limits)) inPlace[s.direction] = _.norm4(s.limits);
      dd.alerts.filter((a) => a.sensor === s.id && a.limits === 'custom' && a.custom).forEach((a) => { inPlace[a.direction] = _.norm4(a.custom); });
      Object.keys(inPlace).forEach((dir) => BANDS.forEach((b) => {
        const t = { kind: 'zone', sensorId: s.id, dir, band: b }; if (has(t)) return; _.touch(); const inf = infoRaw(key, t);
        if (!inf.ok || sameVal('zone', inPlace[dir][b], inf.base)) return; if (inf.base == null && inPlace[dir][b] == null) return;
        add(t, s.id, `${dir}_${b}`, inPlace[dir][b], inf);
      }));
    });
    dd.alerts.forEach((a) => {
      const s = _.sensorRaw(key, a.sensor); if (!s || s.nextPhase) return;
      [['persistence', a.holdMin], ['clearing', a.closes && a.closes.mode === 'sensor' ? a.closes.holdMin : null]].forEach(([kind, v]) => {
        if (v == null) return; const t = { kind, alertId: a.id }; if (has(t)) return; _.touch(); const inf = infoRaw(key, t);
        if (!inf.ok || inf.base == null || sameVal(kind, v, inf.base)) return; add(t, a.id, kind, v, inf);
      });
    });
    dd.schedules.forEach((sc) => {
      if (singleUseFor(key, sc.id)) return;
      const t = { kind: 'cadence', scheduleId: sc.id }; const cur = _.C.cadenceOf(sc);
      if (cur && cur.n && !has(t)) { _.touch(); const inf = infoRaw(key, t); if (inf.ok && inf.base && !sameVal('cadence', cur, inf.base) && !(sc.basis === 'meter')) add(t, sc.id, 'cadence', { ...cur }, inf); }
      if (sc.meter && sc.meter.hours != null) { const t2 = { kind: 'runhours', scheduleId: sc.id }; if (!has(t2)) { _.touch(); const inf = infoRaw(key, t2); if (inf.ok && inf.base != null && !sameVal('runhours', sc.meter.hours, inf.base)) add(t2, sc.id, 'runhours', sc.meter.hours, inf); } }
    });
    return recs;
  }
  /* v6's audit lines and v7/1's seed lines about plant values, in v7/2's words */
  function rewordSeedLines() {
    const ph = _.S.overrides.find((o) => o.plant === 'vedanta' && o.target.kind === 'zone' && o.target.sensorId === 'v_eq1_PH' && o.target.band === 'emergency');
    if (ph) { const inf = infoRaw('vedanta', normTarget(ph.target)); _.replaceActivity('vedanta', (x) => /^Changed limits on pH \(PH-EQ-1\)/.test(x.text), { ledger: true, text: setLine('vedanta', normTarget(ph.target), null, ph.value, ph, inf), kind: 'config' }); }
    const sp = _.S.overrides.find((o) => o.plant === 'manesar' && o.target.kind === 'tier' && o.target.eqId === 'sp1');
    _.replaceActivity('manesar', (x) => /^Changed criticality of SP-1/.test(x.text), { ledger: true, text: sp ? `Overrode criticality tier of SP-1: ${sp.base} → ${sp.value} · ${LABELS.reason[sp.reason]} · ${sp.note}` : 'Overrode criticality tier of SP-1' });
    _.replaceActivity('manesar', (x) => /^Changed limits on Dissolved oxygen \(DO-AT2\)/.test(x.text), { ledger: true, text: 'Changed DO-AT2 Major zone: 1.2 → 1.0 mg/L · 1 Trigger follows this sensor' });
    _.replaceActivity('manesar', (x) => /^Changed how often Bearing service on BL-2 runs/.test(x.text), { ledger: true, text: 'Changed the cadence of Bearing service on BL-2: every 6 months → every 6 months or 500 run-hours · applies from the next occurrence' });
    _.replaceActivity('manesar', (x) => /^Turned on Sump flooding/.test(x.text), { ledger: true, text: `Activated ${trigName('manesar', 'a_flood')} · Emergency at once; a Lead verifies the close` });
  }
  function seedAfter() {
    ensureLib(); _.touch();
    const res = {}; ORDER.forEach((key) => { res[key] = migratePlant(key); });
    rewordSeedLines();
    ORDER.forEach((key) => {
      const r = res[key]; if (!r || (!r.migrated && !r.singleUse)) return;
      const at = MIGRATED_AT[key] != null ? MIGRATED_AT[key] : (P(key) || {}).since;
      act(at, key, `Migrated to the library model: ${plural(r.migrated, 'value')} became overrides (Migrated, review by ${fmtDate(at + REVIEW_DAYS.migrated * DAY)}); ${plural(r.singleUse, 'plant-only Task')} became single-use templates`, 'config', '—');
    });
    _.touch();
  }

  /* ── hooks ─────────────────────────────────────────────────────────────────────────────────── */
  _.onSeed('after', seedAfter);
  const prevBoundaries = _.HOOKS.advanceBoundaries; const prevAt = _.HOOKS.advanceAt;
  _.hook('advanceBoundaries', (fromT, toT) => {
    const xs = prevBoundaries ? (safe(() => prevBoundaries(fromT, toT), []) || []).slice() : [];
    if (_.S) _.S.overrides.forEach((o) => { if (isValueKind(o) && isLive(o) && o.expires != null && o.expires > fromT && o.expires <= toT) xs.push(o.expires); });
    return xs;
  });
  _.hook('advanceAt', (t, out) => { if (prevAt) prevAt(t, out); expireTemporary(t, out); });
  /* a per-Trigger limit lays over its band; the library file does this itself once loaded (it registers 'terms' first) */
  if (!_.HOOKS.terms) {
    _.hook('terms', (key, alertId, opts) => {
      const tm = _.termsOf(key, alertId, opts); if (!tm || (opts && opts.limits) || !_.S) return tm;
      const own = _.S.overrides.filter((o) => o.plant === key && isLive(o) && !o.suspendedBy && o.target.kind === 'triggerLimit' && o.target.alertId === alertId);
      if (!own.length) return tm; const bands = { ...tm.bands }; own.forEach((o) => { bands[o.target.band] = o.value; }); return { ...tm, bands };
    });
  }

  /* ── exports ───────────────────────────────────────────────────────────────────────────────── */
  Object.assign(V, {
    setOverride, checkOverride, overrideDefaults, reasonsFor, physicalPath, overridePreview,
    setLimits, setZone, setTriggerLimit, revertTriggerLimit, setAlertTiming, setCadence, setRunHours, setCondition, setTier, setEnabled,
    revert, revertPreview, revertAll, adopt, keep, extend, promote, promoted, requestVariant, variantRequests,
    singleUse, keepSingleUse, mergeSingleUse, ledgerOnBaseChange, ledgerLiftForced,
    ovState, overrides, overrideById, deviations, deviationCounts, fieldId, fieldHref, chipFor,
    LEDGER: { REASONS, TRIGGER_LIMIT_REASONS, GAP_REASONS, NOTE_REQUIRED, REVIEW_DAYS, TEMP_MAX_DAYS, MIGRATED_AT },
  });
  if (typeof V.liftForced !== 'function') V.liftForced = ledgerLiftForced;
  delete V.suggest; delete V.suggestions;
  /* this file's internals, for the tests (never for page code) */
  V.__ledger = { info, normTarget, sameTarget, findRec, zoneAll, heldOf, followers, migratePlant, sweep, expireTemporary, isBaseMoved, isPastReview, decorate, decorateStructure, valText, pairText, numText, singleUseList, singleUseFor, conditionBase, libSideOf, rewordSeedLines, MANUAL_ERR, CONDITION_FALLBACK };
})();
