#!/usr/bin/env node
/* v7/2 · tests/overrides72.test.js — headless test of core72-ledger.js: the override record, the five reasons, review dates,
   the one writer and its wrappers, Revert · Adopt · Keep · Extend · Promote, Temporary expiry, library changes reaching the
   ledger, single-use templates, the Deviations model, the chip formatter, field links and the migration of v7/1's seed.
   Node only, no dependencies. Records are found by their target, never by their id (except the ids the seed fixes).
   Runs in parts, each in its own process (one load per process):
     main      the v7/2 stack as it stands (tests/load72.js), checks that hold whichever other core files are loaded
     --alone   core7.js and this file only (the other core files skipped): the ledger's own fallbacks
     --fresh   a second boot from empty storage, for byte-equal ledger state
   Usage: TZ=Asia/Calcutta node tests/overrides72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SELF = __filename;
const MODE = process.argv.find((a) => /^--(alone|fresh)$/.test(a)) || 'main';
const VERBOSE = process.argv.includes('-v');
const DAY = 864e5, MIN = 6e4;
const T = (s) => Date.parse(s + ':00+05:30');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 16);
const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail: detail == null ? undefined : String(detail).slice(0, 400) }); if (!ok) fails++; }
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb === undefined ? `threw: ${e.message}` : fb; } };
const emit = (o) => process.stdout.write('@@' + JSON.stringify(o) + '\n');
function child(args, env) {
  const r = spawnSync(process.execPath, [SELF, ...args], { encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { TZ: 'Asia/Calcutta' }, env || {}) });
  const line = String(r.stdout || '').split(/\r?\n/).filter((l) => l.startsWith('@@'))[0];
  if (!line) return { error: `${args.join(' ')} exited ${r.status}: ${String(r.stderr || r.stdout || '').slice(0, 600)}` };
  try { return JSON.parse(line.slice(2)); } catch (e) { return { error: 'bad output: ' + line.slice(0, 200) }; }
}

/* Alex's don't-use words and v7/1 words that must not survive, for the words this file writes (case-insensitive unless the
   phrase is a v7/1 label: "back to the library value" in running text is the v7/2 copy, the v7/1 button was capitalised) */
const BANNED = [/\bmachines?\b/i, /\bassets?\b/i, /\bwidgets?\b/i, /\bestates?\b/i, /\bportfolio\b/i, /\bcustom\b/i, /\bdetach(ed)?\b/i, /\bfork(ed|s)?\b/i,
  /\bdiverg(e|ed|es|ing|ence)\b/i, /\bstale\b/i, /\bdrift\b/i, /\balerts?\b/i, /\balerting\b/i, /(?<!false )\balarms?\b/i, /\binsights?\b/i, /\bschedules?\b/i,
  /\bSCADA\b/i, /\bdatabase\b/i, /\bthe form\b/i, /\bhold time\b/i, /\bdebounce\b/i, /\bprocedures?\b/i, /\bworkflows?\b/i, /\bSOPs?\b/i, /\bremediation\b/i,
  /\bSite Admin\b/i, /\bSupervisor\b/i, /\bonboarding\b/i, /\bshadow\b/i, /\bdry run\b/i, /\bdetect\b/i, /\bpriority\b/i, /(?<!criticality )\btier\b/i,
  /\bCritical\b|\bEssential\b|\bStandard\b/, /(?<!limit |no )\brules?\b/i, /Changed here/i, /Library changed since/i, /From the library/i, /No limits yet/i,
  /Not for this plant/i, /On trial/i, /Tuned for this plant/i, /For now, until/i, /Reason not recorded/i, /Not in the library/i, /Back to the library value/,
  /Suggest for the library/i, /Review due/i, /(?<!Persistence · )must hold for/, /(?<!Clearing · )must clear for/, /\bundefined\b/, /\bNaN\b/, /\[object Object\]/,
  /Invalid Date/, /\$\{/];
const badWords = (texts) => texts.filter((t) => typeof t === 'string' && BANNED.some((re) => re.test(t)));
function ledgerTexts(V) {
  const out = []; const push = (x) => { if (typeof x === 'string') out.push(x); };
  const dv = V.deviations();
  dv.groups.forEach((g) => { push(g.header); if (g.variant) push(g.variant.text); g.rows.forEach((r) => rowTexts(r, push)); });
  [...dv.triggerLimit, ...dv.history].forEach((r) => rowTexts(r, push));
  dv.structure.forEach((r) => { push(r.label); push(r.stateText); push(r.ageText); });
  dv.singleUse.forEach((x) => { push(x.text); push(x.keptText); push(x.mergeLabel); push(x.chip.text); (x.chip.extra || []).forEach((c) => push(c.text)); });
  push(dv.sub); push(dv.empty); push(dv.filtered);
  ['digitalpaani', 'vedanta', 'manesar', 'bawal'].forEach((k) => { const d = V.deviations({ plant: k }); push(d.sub); push(d.empty); });
  V.activity({}).filter((a) => a.ledger).forEach((a) => push(a.text));
  Object.values(V.LABELS.reason).forEach(push); Object.values(V.LABELS.reasonOption).forEach(push); Object.values(V.LABELS.overrideState).forEach(push);
  return out;
}
function rowTexts(r, push) { ['what', 'valueText', 'baseText', 'currentBaseText', 'reasonLabel', 'reasonNote', 'ageText', 'reviewByText', 'authorText', 'valueBase', 'migratedLine', 'historyLine', 'header', 'stateLabel'].forEach((k) => push(r[k])); push(r.chip.text); push(r.chip.sub); push(r.chip.small); if (r.stateChip) push(r.stateChip.text); r.actions.forEach((a) => push(a.label)); }

/* ════════════════════════════════════ --fresh: another boot ═════════════════════════════════════════════════════════ */
if (MODE === '--fresh') {
  const L = require('./load72.js'); const V = L.V7;
  emit({ ov: sha(JSON.stringify(V.S.overrides)), dev: sha(JSON.stringify(V.deviations())), lib: sha(JSON.stringify([V.S.lib.variantRequests, V.S.lib.singleUseKept, V.S.lib.singleUse || null])) });
  process.exit(0);
}

const L = require('./load72.js'); const V = L.V7; const __ = V.__; const LG = V.__ledger;
const has = (n) => typeof V[n] === 'function';
const HAS_STRUCTURE = has('identify'); const HAS_LIBRARY = has('zoneInfo') && has('templates');
const now = () => V.now();
const recOf = (key, pred) => V.S.overrides.find((o) => o.plant === key && pred(o.target, o)) || null;
const recLive = (key, pred) => V.S.overrides.find((o) => o.plant === key && (o.status == null || o.status === 'active') && !o.endedAt && pred(o.target, o)) || null;
const dec = (key, pred) => V.overrides({ plant: key, state: 'all' }).find((o) => pred(o.target, o)) || null;
const zoneT = (sid, band) => (t) => t.kind === 'zone' && t.sensorId === sid && t.band === band;
const actText = (key) => V.activity({ plant: key }).map((a) => a.text);
const latestAct = (key) => (V.activity({ plant: key, limit: 1 })[0] || {}).text || '';
/* the seed's Sludge blanket persistence shows Base moved once the library file has rewritten the 20 Oct publish onto the
   unit-process template (or while no unit-process type exists): until then the moved base is not there to see */
const BLANKET_MOVED = HAS_LIBRARY || !HAS_STRUCTURE;

check('load', 'v7/2 loads with the ledger file and boots', !!V && L.errors.length === 0 && L.loaded.includes('core72-ledger.js'), L.errors.map((e) => `${e.file}: ${e.error.slice(0, 200)}`).join(' | ') || L.loaded.join(','));
check('load', 'the ledger API is on window.V7; v7/1\'s suggest and suggestions are gone',
  ['setOverride', 'checkOverride', 'overrideDefaults', 'setLimits', 'setZone', 'setTriggerLimit', 'revertTriggerLimit', 'setAlertTiming', 'setCadence', 'setRunHours', 'setCondition', 'setTier', 'setEnabled', 'revert', 'revertPreview', 'revertAll', 'adopt', 'keep', 'extend', 'promote', 'promoted', 'requestVariant', 'variantRequests', 'singleUse', 'keepSingleUse', 'mergeSingleUse', 'ledgerOnBaseChange', 'ledgerLiftForced', 'ovState', 'overrides', 'deviations', 'deviationCounts', 'fieldId', 'fieldHref', 'chipFor', 'reasonsFor', 'physicalPath', 'overridePreview'].every(has) && !('suggest' in V) && !('suggestions' in V));

/* ── 1. the seed: v7/1's differences in Alex's records ─────────────────────────────────────────────────────────── */
{
  const dv = V.deviations(); const c = dv.counts;
  check('seed', 'All Plants: 15 overrides · 1 past review · 0 Trigger limit overrides · 0 pinned · 2 single-use templates', c.overrides === 15 && c.pastreview === 1 && c.triggerlimit === 0 && c.pinned === 0 && c.singleuse === 2 && c.suspended === 0 && c.history === 0, JSON.stringify(c));
  check('seed', 'by reason: Migrated 13 · Tuning 1 · Physical 1 (Migrated is never one of the five offered)', c.byReason.migrated === 13 && c.byReason.tuning === 1 && c.byReason.physical === 1 && c.byReason.regulatory === 0 && c.byReason.structural === 0 && c.byReason.temporary === 0, JSON.stringify(c.byReason));
  const moved = V.overrides({}).filter((o) => o.isBaseMoved).length;
  check('seed', `base moved counts the values whose library base moved (${BLANKET_MOVED ? 'the Sludge blanket persistence: 1' : 'none until the library file rewrites the 20 Oct publish'})`, c.basemoved === moved && c.basemoved === (BLANKET_MOVED ? 1 : 0), `${c.basemoved} vs ${moved}`);
  const sLive = V.S.overrides.filter((o) => ['member', 'uptype', 'cg'].includes(o.target.kind) && !o.endedAt && (o.status == null || o.status === 'active')).length;
  check('seed', `structure changes are counted on their own${HAS_STRUCTURE ? ' (11: Vedanta 4, Manesar 2, Bawal 5)' : ''}, never as overrides`, c.structure === sLive && (!HAS_STRUCTURE || c.structure === 11) && !dv.groups.some((g) => g.rows.some((r) => ['member', 'uptype', 'cg'].includes(r.kind))), `${c.structure} vs ${sLive}`);
  const per = (k) => V.deviations({ plant: k }).counts;
  check('seed', 'per plant: Manesar 14 · 1 past review · 2 single-use; Vedanta 1; DigitalPaani and Bawal 0', per('manesar').overrides === 14 && per('manesar').pastreview === 1 && per('manesar').singleuse === 2 && per('vedanta').overrides === 1 && per('vedanta').pastreview === 0 && per('digitalpaani').overrides === 0 && per('bawal').overrides === 0, ['manesar', 'vedanta', 'digitalpaani', 'bawal'].map((k) => `${k}:${per(k).overrides}`).join(' '));
  check('seed', 'every record is in v7/2\'s shape: no v7/1 kind or reason is left', !V.S.overrides.some((o) => ['limit', 'hold', 'clear', 'onoff', 'reading', 'alert'].includes(o.target.kind) || ['tuned', 'fornow', 'unrecorded', 'notinlib'].includes(o.reason) || 'until' in o));
  check('seed', 'the migration draws no id from the shared counter: v7/1\'s ids are kept, the split CDU-1 record takes _b, new ones are ovm_', V.S.overrides.filter((o) => !['member', 'uptype', 'cg'].includes(o.target.kind)).every((o) => /^ov_[0-9a-z]+(_b)?$|^ovm_/.test(o.id)) && !V.S.oseq && !V.S.vseq);
  const mig = V.overrides({ plant: 'manesar', reason: 'migrated' });
  check('seed', 'every Manesar Migrated value: set 1 Sep 2026 09:00, review by 30 Nov 2026 09:00, who not recorded, 58 d old, no note', mig.length === 13 && mig.every((o) => o.at === T('2026-09-01T09:00') && o.reviewBy === T('2026-11-30T09:00') && o.author === null && o.authorText === 'not recorded' && o.ageText === '58 d' && o.note === '' && o.migratedLine === 'Set before 1 Sep 2026 · who: not recorded' && o.reviewByText === '30 Nov 2026'), mig.map((o) => `${o.id}:${o.ageText}`).join(' '));
  const chipM = mig.find((o) => o.target.kind === 'zone' && o.target.sensorId === 'at1_mlss');
  check('seed', 'a Migrated chip: "Override · Migrated · not recorded · 1 Sep · review by 30 Nov" with "Library: 2,000 mg/L"', chipM && chipM.chip.text === 'Override · Migrated · not recorded · 1 Sep · review by 30 Nov' && chipM.chip.small === 'Library: 2,000 mg/L' && chipM.chip.tone === 'ovr' && chipM.valueBase === '2,500 mg/L · 2,000 mg/L', chipM && JSON.stringify(chipM.chip));
  const blC = ['caution', 'minor', 'major'].map((b) => dec('manesar', zoneT('bl1_amps', b)));
  check('seed', 'AMP-BL1: three Migrated zone records over a Derived base (44 · 40.0, 48 · 42.0, no value · 46.0 A), each base equal to what the derivation gives now', blC.every((o) => o && o.baseSource === 'derived' && o.base === o.currentBase && o.state === 'active') && blC.map((o) => `${o.valueText} · ${o.baseText}`).join(' | ') === '44 A · 40.0 A | 48 A · 42.0 A | no value · 46.0 A', blC.map((o) => o && `${o.valueText} · ${o.baseText} ${o.baseSource}`).join(' | '));
  const cdu = ['caution', 'minor'].map((b) => recOf('manesar', zoneT('cdu_lvl', b)));
  check('seed', 'CDU-1 chemical tank level: v7/1\'s one record over a reading the library has no limit rule for becomes two zone records on a Gap base', cdu.every((o) => o && o.base === null && o.baseSource === 'gap' && o.reason === 'migrated') && cdu[0].value === 25 && cdu[1].value === 10 && cdu[0].id + '_b' === cdu[1].id && !recOf('manesar', zoneT('cdu_lvl', 'major')), cdu.map((o) => o && `${o.id}:${o.value}`).join(' '));
  const intake = ['doWhen', 'doneWhen'].map((w) => recOf('manesar', (t) => t.kind === 'condition' && t.workId === 'w_intake' && t.which === w));
  /* v7/2: no condition-based work on equipment — Manesar's intake-filter job (two Migrated values) is now a Task BL-1's Caution line raises at the plant */
  check('seed', 'no Migrated record for an intake-filter job on equipment: BL-1\'s Caution line raises it at the plant', intake.every((o) => !o) && V.lineWork('manesar', { sensorId: 'bl1_amps' }).length === 1);
  if (false) check('seed', 'Clean intake filter on BL-1 (gone)', intake.every(Boolean) && intake[0].id === 'ovm_manesar_w_intake_doWhen' && intake[1].id === 'ovm_manesar_w_intake_doneWhen' && intake[0].value === 42 && intake[1].value === 38 && intake[0].base === 38 && intake[1].base === 34 && intake.every((o) => o.baseSource === 'derived' && o.reason === 'migrated'), intake.map((o) => o && `${o.id} ${o.value}/${o.base} ${o.baseSource}`).join(' | '));
  const dIntake = dec('manesar', (t) => t.kind === 'condition' && t.workId === 'w_intake' && t.which === 'doWhen');
  if (false) check('seed', 'its row (gone)', dIntake && dIntake.valueBase === '42 A · 38.0 A' && dIntake.href === '#/p/manesar/trigger/w_intake?f=condition.doWhen' && dIntake.what === 'Clean intake filter on BL-1 · do when', dIntake && `${dIntake.valueBase} ${dIntake.href}`);
  /* no silent difference: every tunable value v6 holds in place at a Live plant is the value in force in v7/2 */
  const silent = [];
  ['manesar', 'bawal'].forEach((k) => {
    const d = __.dOf(k);
    d.sensors.filter((s) => !s.nextPhase && s.kind !== 'meter' && __.homeOf(k, s)).forEach((s) => {
      const inPlace = {}; if (s.direction && __.hasAny(s.limits)) inPlace[s.direction] = __.norm4(s.limits);
      d.alerts.filter((a) => a.sensor === s.id && a.limits === 'custom' && a.custom).forEach((a) => { inPlace[a.direction] = __.norm4(a.custom); });
      Object.keys(inPlace).forEach((dir) => ['caution', 'minor', 'major', 'emergency'].forEach((b) => { const i = LG.info(k, { kind: 'zone', sensorId: s.id, dir, band: b }); if (i.ok && !__.same(inPlace[dir][b], i.value)) silent.push(`${k} ${s.tag} ${dir} ${b}: ${inPlace[dir][b]} vs ${i.value}`); }));
    });
    d.alerts.filter((a) => !(__.sensorRaw(k, a.sensor) || {}).nextPhase).forEach((a) => {
      const h = LG.info(k, { kind: 'persistence', alertId: a.id }); if (a.holdMin != null && h.ok && h.value != null && !__.same(a.holdMin, h.value)) silent.push(`${k} ${a.id} persistence ${a.holdMin} vs ${h.value}`);
      const cl = LG.info(k, { kind: 'clearing', alertId: a.id }); if (a.closes && a.closes.mode === 'sensor' && a.closes.holdMin != null && cl.ok && cl.value != null && !__.same(a.closes.holdMin, cl.value)) silent.push(`${k} ${a.id} clearing ${a.closes.holdMin} vs ${cl.value}`);
    });
    d.schedules.filter((sc) => sc.basis !== 'meter').forEach((sc) => { const i = LG.info(k, { kind: 'cadence', scheduleId: sc.id }); const cur = __.C.cadenceOf(sc); if (i.ok && i.value && cur && (cur.n !== i.value.n || cur.unit !== i.value.unit)) silent.push(`${k} ${sc.id} cadence`); });
    d.schedules.filter((sc) => sc.meter && sc.meter.hours != null).forEach((sc) => { const i = LG.info(k, { kind: 'runhours', scheduleId: sc.id }); if (i.ok && i.value != null && !__.same(sc.meter.hours, i.value)) silent.push(`${k} ${sc.id} run-hours ${sc.meter.hours} vs ${i.value}`); });
    (d.conditionWork || []).forEach((w) => ['doWhen', 'doneWhen'].forEach((which) => { const i = LG.info(k, { kind: 'condition', workId: w.id, which }); if (w[which] != null && i.ok && !__.same(w[which], i.value)) silent.push(`${k} ${w.id} ${which} ${w[which]} vs ${i.value}`); }));
  });
  check('seed', 'no silent difference at Manesar and Bawal: zones, persistence, clearing, cadence, run-hours and job thresholds held in place equal the values in force', silent.length === 0, silent.slice(0, 6).join(' | '));
  const tierSilent = [];
  ['manesar', 'bawal'].forEach((k) => __.dOf(k).equipment.forEach((e) => { const i = LG.info(k, { kind: 'tier', eqId: e.id }); if (i.ok && i.value && e.tier !== i.value) tierSilent.push(`${k} ${e.tag} ${e.tier} vs ${i.value}`); }));
  check('seed', 'criticality tiers held in place equal the tiers in force (a tier follows its unit processes; only SP-1 is overridden)', tierSilent.length === 0, tierSilent.slice(0, 6).join(' | '));
  const ph = dec('vedanta', zoneT('v_eq1_PH', 'emergency'));
  check('seed', 'Vedanta\'s pH Emergency: Physical, base "no rule", set by Satyadev Singh Fri 23 Oct 11:30, review by 23 Oct 2027, note kept verbatim', ph && ph.reason === 'physical' && ph.base === null && ph.baseSource === 'gap' && ph.baseText === 'no rule' && ph.value === 4 && ph.author === 'Satyadev Singh' && ph.at === T('2026-10-23T11:30') && ph.reviewBy === T('2027-10-23T11:30') && ph.reviewByText === '23 Oct 2027' && ph.note === 'Acid from the pickling line can reach EQ-1; the Leads must know at once' && ph.ageText === '5 d' && ph.chip.small === 'Library: no rule', ph && JSON.stringify({ r: ph.reason, b: ph.base, rb: ph.reviewByText, small: ph.chip.small }));
  const sp = dec('manesar', (t) => t.kind === 'tier' && t.eqId === 'sp1');
  check('seed', 'SP-1 criticality tier C over B: Tuning by Sunny Verma on 26 Sep, review by 26 Oct 2026, so Past review, 32 d old', sp && sp.value === 'C' && sp.base === 'B' && sp.reason === 'tuning' && sp.author === 'Sunny Verma' && sp.at === T('2026-09-26T14:30') && sp.reviewBy === T('2026-10-26T09:00') && sp.state === 'pastreview' && sp.isPastReview && sp.ageText === '32 d' && sp.note === 'Sludge can wait a day; nothing overflows while it is stopped', sp && `${sp.state} ${sp.ageText}`);
  const spG = dv.groups.find((g) => g.rows.some((r) => r.id === (sp && sp.id)));
  check('seed', 'its group "Pump · criticality tier · library B (v1)"; row "C · B", Revert · Extend (the primary) · Promote', spG && spG.header === 'Pump · criticality tier · library B (v1)' && sp.valueBase === 'C · B' && sp.actions.map((a) => `${a.label}${a.primary ? '*' : ''}`).join(',') === 'Revert,Extend*,Promote' && sp.stateChip && sp.stateChip.text === 'Past review', spG && spG.header);
  const blk = dec('manesar', (t) => t.kind === 'persistence' && t.alertId === 'a_blanket');
  check('seed', 'Sludge blanket high · SC-1 persistence 30 min keeps the base it left, 5 min (v1)', blk && blk.value === 30 && blk.base === 5 && blk.baseVersion === 1 && blk.what === 'Sludge blanket high · SC-1 · persistence', blk && `${blk.value}/${blk.base} v${blk.baseVersion}`);
  if (BLANKET_MOVED) {
    check('seed', 'it shows Base moved: "Library changed 5 → 15 min since you overrode it", row "30 min · base moved 5 → 15 min", Keep · Adopt the library value · Promote, and its group comes first', blk.movedQuestion === 'The library changed this from 5 min to 15 min after you overrode it. Keep 30 min, or adopt 15 min?' && blk.adoptLabel === 'Adopt 15 min' && blk.keepLabel === 'Keep 30 min' && blk.state === 'basemoved' && blk.currentBase === 15 && blk.chip.text === 'Base moved' && blk.chip.tone === 'moved' && blk.chip.sub === 'Library changed 5 → 15 min since you overrode it' && blk.valueBase === '30 min · base moved 5 → 15 min' && blk.actions.map((a) => a.label).join(',') === 'Keep,Adopt the library value,Promote' && dv.groups[0].rows.some((r) => r.id === blk.id), `${blk.state} · ${blk.chip.sub} · ${blk.valueBase} · first ${dv.groups[0].header}`);
    if (HAS_STRUCTURE && HAS_LIBRARY) check('seed', 'that group reads "Secondary clarification · Sludge blanket high · persistence · library 15 min (v2)"', dv.groups[0].header === 'Secondary clarification · Sludge blanket high · persistence · library 15 min (v2)', dv.groups[0].header);
  }
  const su = V.singleUse({ plant: 'manesar' });
  const chem = su.find((x) => x.name === 'Chemical refill'); const slw = su.find((x) => x.name === 'Sludge wasting');
  check('seed', 'two single-use templates, not overrides: Chemical refill on CDU-1 (Dosing Pump) and Sludge wasting on SP-1 (Pump), every week, since 1 Sep 2026', su.length === 2 && chem && slw && chem.id === 'tpl_single_manesar_s_hypo' && slw.id === 'tpl_single_manesar_w_sludge' && chem.tag === 'CDU-1' && chem.typeName === 'Dosing Pump' && slw.tag === 'SP-1' && slw.typeName === 'Pump' && chem.text === 'Chemical refill · Task on CDU-1 (Dosing Pump) · every week · used at Manesar STP only · since 1 Sep 2026' && !V.S.overrides.some((o) => o.target.scheduleId === 's_hypo' || o.target.scheduleId === 'w_sludge'), su.map((x) => x.text).join(' | '));
  check('seed', 'their chip reads "Library · Chemical refill v1" with a second chip "Single-use · Manesar STP only"', chem && chem.chip.text === 'Library · Chemical refill v1' && chem.chip.extra && chem.chip.extra[0].text === 'Single-use · Manesar STP only' && chem.chip.extra[0].tone === 'single', chem && JSON.stringify(chem.chip));
  if (has('cadenceOf')) { const cs = safe(() => V.cadenceOf('manesar', 's_hypo'), null); const js = JSON.stringify(cs && cs.chip); check('seed', 'the library file\'s cadence source for the Chemical refill Task says the same', /Library · Chemical refill v1/.test(js) && /Single-use · Manesar STP only/.test(js), js); }
  const mA = V.activity({ plant: 'manesar' });
  const migLine = mA.find((a) => /^Migrated to the library model/.test(a.text));
  check('seed', 'Manesar Activity, Tue 1 Sep 09:00 by "—": "Migrated to the library model: 13 values became overrides (Migrated, review by 30 Nov 2026); 2 plant-only Tasks became single-use templates"', migLine && migLine.text === 'Migrated to the library model: 13 values became overrides (Migrated, review by 30 Nov 2026); 2 plant-only Tasks became single-use templates' && migLine.at === T('2026-09-01T09:00') && migLine.who === '—', migLine && `${migLine.text} · ${migLine.who}`);
  check('seed', 'SP-1\'s line: "Overrode criticality tier of SP-1: B → C · Tuning · Sludge can wait a day; nothing overflows while it is stopped"', mA.some((a) => a.text === 'Overrode criticality tier of SP-1: B → C · Tuning · Sludge can wait a day; nothing overflows while it is stopped' && a.who === 'Sunny Verma'));
  const vA = V.activity({ plant: 'vedanta' });
  check('seed', 'Vedanta 11:30: "Overrode PH-EQ-1 Emergency zone: none → pH 4.0 (Physical: Acid from the pickling line can reach EQ-1; the Leads must know at once)"', vA.some((a) => a.text === 'Overrode PH-EQ-1 Emergency zone: none → pH 4.0 (Physical: Acid from the pickling line can reach EQ-1; the Leads must know at once)' && a.at === T('2026-10-23T11:30')), vA.filter((a) => /PH-EQ-1|pH/.test(a.text)).map((a) => a.text).join(' | '));
  const words = badWords(ledgerTexts(V));
  check('words', `no don't-use word in what the ledger writes at seed (rows, chips, groups, Activity, labels)`, words.length === 0, words.slice(0, 5).join(' || '));
  check('seed', 'DigitalPaani has nothing: "No deviations at DigitalPaani: every value follows the library."', V.deviations({ plant: 'digitalpaani' }).empty === 'No deviations at DigitalPaani: every value follows the library.' && V.deviations({ plant: 'digitalpaani' }).groups.length === 0);
  const dcM = V.deviationCounts('manesar');
  check('seed', 'deviationCounts(Manesar): 14 overrides, 1 past review, 2 single-use, 1 frozen (DO low · AT-2 has an open Issue)', dcM.overrides === 14 && dcM.pastReview === 1 && dcM.singleUse === 2 && dcM.frozen === 1 && dcM.triggerLimit === 0 && dcM.waitingResync === 0 && dcM.baseMoved === (BLANKET_MOVED ? 1 : 0), JSON.stringify(dcM));
  const mig1 = V.deviations({ reason: 'migrated' }); const nRows = mig1.groups.reduce((n, g) => n + g.rows.length, 0);
  check('seed', 'the Reason filter: Migrated lists the 13 Migrated rows and nothing else', nRows === 13 && mig1.groups.every((g) => g.rows.every((r) => r.reason === 'migrated')) && mig1.reasons.find((r) => r.key === 'migrated').count === 13);
  const pr = V.deviations({ show: 'pastreview' });
  check('seed', 'show=pastreview lists SP-1 only; show=basemoved lists the moved rows only', pr.groups.length === 1 && pr.groups[0].rows.length === 1 && pr.groups[0].rows[0].target.eqId === 'sp1' && V.deviations({ show: 'basemoved' }).groups.reduce((n, g) => n + g.rows.length, 0) === V.deviations().counts.basemoved);
}

/* ── 2. the five reasons, review dates and the checks ──────────────────────────────────────────────────────────── */
{
  check('reasons', 'five reasons offered, in this order; Migrated is not one of them', JSON.stringify(V.LEDGER.REASONS) === JSON.stringify(['physical', 'regulatory', 'structural', 'tuning', 'temporary']) && JSON.stringify(Object.keys(V.LABELS.reasonOption)) === JSON.stringify(V.LEDGER.REASONS) && !V.LEDGER.REASONS.includes('migrated'));
  check('reasons', 'labels: Physical · Regulatory or client · Structural · Tuning · Temporary · Migrated; the form\'s options say where Physical and Structural lead',
    ['Physical', 'Regulatory or client', 'Structural', 'Tuning', 'Temporary', 'Migrated'].join('|') === ['physical', 'regulatory', 'structural', 'tuning', 'temporary', 'migrated'].map((r) => V.LABELS.reason[r]).join('|') && V.LABELS.reasonOption.physical === 'Physical: this plant is built differently → set a design parameter instead' && V.LABELS.reasonOption.structural === 'Structural: this kind always differs → request a library variant' && V.LABELS.reasonOption.temporary === 'Temporary (needs an expiry)');
  const n0 = now(); const df = (r) => V.overrideDefaults(r, { at: n0 });
  check('reasons', 'review by: Tuning + 90 days; Physical, Regulatory or client, Structural + 365 days; Temporary has its expiry (at most 30 days)', df('tuning').reviewBy === n0 + 90 * DAY && df('physical').reviewBy === n0 + 365 * DAY && df('regulatory').reviewBy === n0 + 365 * DAY && df('structural').reviewBy === n0 + 365 * DAY && df('temporary').reviewBy === null && df('temporary').expiresMax === n0 + 30 * DAY && df('temporary').reviewByEditable === false && df('tuning').reviewByText === '27 Jan 2027');
  const z = { kind: 'zone', sensorId: 'at1_do', dir: 'below', band: 'minor' };
  const ck = (opts, t) => V.checkOverride('manesar', t || z, 1.8, opts);
  const e1 = ck({}), e2 = ck({ reason: 'migrated' }), e3 = ck({ reason: 'tuning' }), e4 = ck({ reason: 'regulatory', note: ' ' }), e5 = ck({ reason: 'physical' });
  check('reasons', 'no reason → "Choose why this plant differs." (Migrated too); Tuning and Regulatory or client need a note; Physical does not', e1 && e1.field === 'reason' && e1.error === 'Choose why this plant differs.' && e2 && e2.error === 'Choose why this plant differs.' && e3 && e3.field === 'note' && e3.error === 'Write a note: Tuning needs one.' && e4 && e4.error === 'Write a note: Regulatory or client needs one.' && e5 === null, [e1, e2, e3, e4, e5].map((x) => x && x.error).join(' | '));
  const t1 = ck({ reason: 'temporary', note: 'x' }), t2 = ck({ reason: 'temporary', expires: n0 + 31 * DAY }), t3 = ck({ reason: 'temporary', expires: n0 - MIN }), t4 = ck({ reason: 'temporary', expires: n0 + 7 * DAY }), t5 = ck({ reason: 'temporary', expires: '2026-11-28' });
  check('reasons', 'Temporary without an expiry, in the past or beyond 30 days → "Pick an expiry date, 30 days from today at most."; 7 days or a date 30 days out is fine', [t1, t2, t3].every((x) => x && x.field === 'expires' && x.error === 'Pick an expiry date, 30 days from today at most.') && t4 === null && t5 === null, [t1, t2, t3, t4, t5].map((x) => x && x.error).join(' | '));
  const r1 = ck({ reason: 'tuning', note: 'x', reviewBy: n0 - DAY });
  check('reasons', 'a review date that is not after today → "Pick a review date after today."', r1 && r1.field === 'reviewBy' && r1.error === 'Pick a review date after today.');
  const gapT = { kind: 'zone', sensorId: 'v_eq1_PH', dir: 'below', band: 'emergency' };
  check('reasons', 'a Gap (a band with nothing to resolve) offers Physical and Tuning only', JSON.stringify(V.reasonsFor('vedanta', gapT)) === JSON.stringify(['physical', 'tuning']) && V.checkOverride('vedanta', gapT, 3.5, { reason: 'structural' }).error === 'Choose one of the reasons offered here.' && V.checkOverride('vedanta', gapT, 3.5, { reason: 'tuning', note: 'x' }) === null);
  const tl = { kind: 'triggerLimit', alertId: 'a_bl1_amps', band: 'caution' };
  check('reasons', 'a per-Trigger limit offers Structural, Tuning and Temporary only, and always needs a note', JSON.stringify(V.reasonsFor('manesar', tl)) === JSON.stringify(['structural', 'tuning', 'temporary']) && V.checkOverride('manesar', tl, 45, { reason: 'physical', note: 'x' }).error === 'Choose one of the reasons offered here.' && V.checkOverride('manesar', tl, 45, { reason: 'structural' }).error === 'Write a note: Structural needs one.' && V.checkOverride('manesar', tl, 45, { reason: 'temporary', expires: n0 + DAY }).error === 'Write a note: Temporary needs one.');
  const em = V.checkOverride('manesar', { kind: 'persistence', alertId: 'a_flood' }, 5, { reason: 'tuning', note: 'x' });
  check('reasons', 'persistence on a Trigger whose only band is Emergency is refused', em && em.error === "This Trigger has only an Emergency band, which fires on the first reading: its persistence can't be overridden.", em && em.error);
  const before = JSON.stringify(V.S.overrides); const nr = V.setZone('manesar', 'at1_do', 'below', 'minor', 1.8, {});
  check('reasons', 'saving without a reason fails and saves nothing', !nr.ok && nr.needsReason && nr.error === 'Choose why this plant differs.' && JSON.stringify(V.S.overrides) === before, nr.error);
  const pp = V.physicalPath('manesar', { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'major' });
  check('reasons', 'Physical on a constant band: "The library\'s limit rule for this band is a constant (1.0 mg/L): no design parameter changes it." and only Override anyway', pp.kind === 'const' && pp.text === "The library's limit rule for this band is a constant (1.0 mg/L): no design parameter changes it." && pp.secondary === 'Override anyway' && !pp.primary, pp.text);
  const pd = V.physicalPath('manesar', { kind: 'zone', sensorId: 'bl1_amps', dir: 'above', band: 'caution' });
  check('reasons', 'Physical on a derived band leads to the design parameter on the equipment\'s Details', pd.kind === 'param' && pd.primary === 'Set the design parameter' && /^#\/p\/manesar\/eq\/bl1\/details\?f=dp\.[A-Za-z]+$/.test(pd.href), pd.href);
}

/* ── 3. the one writer ─────────────────────────────────────────────────────────────────────────────────────────── */
V.reset();
{
  const seq0 = V.S.seq; const n0 = now();
  const r = V.setZone('manesar', 'at1_do', 'below', 'minor', 1.8, { reason: 'tuning', note: 'Probe reads low against the handheld' });
  const o = dec('manesar', zoneT('at1_do', 'minor'));
  check('write', 'setZone writes one zone record: base 2.0 from the library, Tuning, you, review by now + 90 days, its own counter', r.ok && o && o.id === r.id && /^ovr_\d+$/.test(r.id) && V.S.seq === seq0 && o.base === 2 && o.baseSource === 'library' && o.reason === 'tuning' && o.author === V.__.ME && o.reviewBy === n0 + 90 * DAY && o.status === 'active' && o.field === 'zone.below.minor', r.error || JSON.stringify(o && { id: o.id, base: o.base }));
  check('write', 'its chip: "Override · Tuning · you · 29 Oct · review by 27 Jan", small "Library: 2.0 mg/L"', o && o.chip.text === 'Override · Tuning · you · 29 Oct · review by 27 Jan' && o.chip.small === 'Library: 2.0 mg/L', o && JSON.stringify(o.chip));
  check('write', 'the value applies (the zone reads 1.8) and v6\'s sensor mirrors it', V.limitsOf('manesar', 'at1_do', 'below').bands.minor === 1.8 && __.sensorRaw('manesar', 'at1_do').limits.minor === 1.8);
  check('write', 'Activity: "Overrode DO-AT1 Minor zone: 2.0 mg/L → 1.8 mg/L (Tuning: Probe reads low against the handheld)"', latestAct('manesar') === 'Overrode DO-AT1 Minor zone: 2.0 mg/L → 1.8 mg/L (Tuning: Probe reads low against the handheld)', latestAct('manesar'));
  const r2 = V.setZone('manesar', 'at1_do', 'below', 'minor', 1.7, { reason: 'physical' });
  const o2 = recOf('manesar', zoneT('at1_do', 'minor'));
  check('write', 'saving again updates the same record and keeps the earlier value in its history', r2.ok && r2.id === r.id && o2.value === 1.7 && o2.reason === 'physical' && o2.reviewBy === n0 + 365 * DAY && o2.history.length === 1 && /^Was 1\.8 mg\/L · Tuning/.test(o2.history[0].text), r2.error || (o2 && JSON.stringify(o2.history)));
  const r3 = V.setZone('manesar', 'at1_do', 'below', 'minor', 2.0, {});
  check('write', 'the library value again ends it with no reason asked ("Set back to the library value"), and it moves to History', r3.ok && r3.ended && o2.status === 'reverted' && o2.endedNote === 'Set back to the library value' && V.limitsOf('manesar', 'at1_do', 'below').bands.minor === 2 && latestAct('manesar') === 'Set DO-AT1 · Minor zone back to the library value 2.0 mg/L' && V.deviations().history.some((h) => h.id === r.id), latestAct('manesar'));
  const ord = V.setZone('manesar', 'at1_do', 'below', 'minor', 0.8, { reason: 'tuning', note: 'x' });
  check('write', 'band order is checked on the whole zone: Minor 0.8 below Major 1.0 is refused', !ord.ok && /must be lower than/.test(ord.error), ord.error);
  const mk = ['manesar', 'bawal', 'vedanta', 'digitalpaani'].find((k) => __.dOf(k).schedules.some((sc) => sc.workType === 'test'));
  const man = mk ? __.dOf(mk).schedules.find((sc) => sc.workType === 'test') : null;
  const mz = man ? V.setZone(mk, `m:${man.id}`, 'above', 'minor', 5, { reason: 'tuning', note: 'x' }) : null; const ml = man ? V.setLimits(mk, `m:${man.id}`, 'above', { minor: 5 }, { reason: 'tuning', note: 'x' }) : null;
  check('write', 'hand tests have no Zones: "Hand-test results stay in the task record: they have no sensor, so no Zones."', !!man && !mz.ok && mz.error === 'Hand-test results stay in the task record: they have no sensor, so no Zones.' && !ml.ok && ml.error === mz.error, man ? mz.error : 'no hand test found at any plant');
  const np = V.setZone('manesar', 'mbr_turb', 'above', 'minor', 5, { reason: 'tuning', note: 'x' });
  check('write', 'a reading on a connection is next phase and takes no override', !np.ok && np.error === 'Outlet turbidity is read on a connection: next phase.', np.error);
  /* setLimits keeps v7/1's signature: one record per changed band */
  const lim = V.setLimits('manesar', 'at2_do', 'below', { ...V.limitsOf('manesar', 'at2_do', 'below').bands, minor: 1.5 }, { reason: 'tuning', note: 'Short dips below 2.0 recover on their own; 1.5 is where the operators act' });
  const o3 = recOf('manesar', zoneT('at2_do', 'minor'));
  check('write', 'setLimits (v7/1\'s signature) writes one zone record per changed band; DO-AT2 Minor 1.5 over 2.0', lim.ok && lim.overrides.length === 1 && o3 && o3.value === 1.5 && o3.base === 2 && lim.changed.length === 1 && lim.changed[0].band === 'minor', lim.error || JSON.stringify(lim));
  V.reset();
  const fz = V.setZone('manesar', 'at2_do', 'below', 'minor', 1.5, { reason: 'tuning', note: 'Short dips below 2.0 recover on their own; 1.5 is where the operators act' });
  check('write', 'a zone on the sensor of a frozen Trigger is saved; the result names the frozen Trigger', fz.ok && fz.frozen.length === 1 && fz.frozen[0].alertId === 'a_do_at2' && fz.frozen[0].open === 1 && /^DO low · AT-2$/.test(fz.frozen[0].name), JSON.stringify(fz.frozen));
}

/* ── 4. what saving would do ───────────────────────────────────────────────────────────────────────────────────── */
V.reset();
{
  const bands = { ...V.limitsOf('manesar', 'at2_do', 'below').bands, minor: 1.5 };
  const pv = V.overridePreview('manesar', { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' }, 1.5);
  const pl = V.previewLimits('manesar', 'at2_do', 'below', bands);
  check('preview', 'Live: "Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved)." and "Last 7 days: would have fired {n} times (now {m})." with n and m from previewLimits', pv.ok && pv.lines[0] === 'Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved).' && pv.mode === 'live' && pv.count === pl.count && pv.countNow === pl.countNow && pv.lines[1] === `Last 7 days: would have fired ${pl.count} ${pl.count === 1 ? 'time' : 'times'} (now ${pl.countNow}).`, `${pv.lines.join(' / ')} · previewLimits ${pl.count}/${pl.countNow}`);
  const fl = pv.frozenLines[0];
  check('preview', 'the frozen line: "DO low · AT-2 has 1 open Issue: it is frozen and keeps 2.0. It will show Base moved until someone resyncs it." with "Close it as a false alarm"', fl && fl.text === 'DO low · AT-2 has 1 open Issue: it is frozen and keeps 2.0. It will show Base moved until someone resyncs it.' && fl.linkText === 'Close it as a false alarm' && fl.href === '#/p/manesar/issue/is_2z?close=false-alarm', fl && `${fl.text} ${fl.href}`);
  const ts = V.trialStats('vedanta', 'a_3d');
  const vb = { ...V.limitsOf('vedanta', 'v_eq1_LVL', 'above').bands, caution: 87 };
  const vp = V.overridePreview('vedanta', { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' }, 87);
  const vl = V.previewLimits('vedanta', 'v_eq1_LVL', 'above', vb, { from: ts.since, to: now() });
  check('preview', 'Commissioning with a trial window: "Trial so far: would have fired {n} times instead of {m}." with n from previewLimits over the trial and m the stored trial firings (76)', vp.ok && vp.mode === 'trial' && vp.count === vl.count && vp.countNow === ts.count && ts.count === 76 && vp.lines.includes(`Trial so far: would have fired ${vl.count} ${vl.count === 1 ? 'time' : 'times'} instead of 76.`), `${vp.lines.join(' / ')} · previewLimits ${vl.count}`);
  check('preview', 'a reading no Trigger follows: "No Trigger follows this sensor yet: nothing would fire."', V.overridePreview('manesar', { kind: 'zone', sensorId: 'at1_do', dir: 'below', band: 'minor' }, 1.8).lines[0] === 'No Trigger follows this sensor yet: nothing would fire.');
  const hp = V.overridePreview('manesar', { kind: 'persistence', alertId: 'a_bl1_amps' }, 30); const hr = V.replay('manesar', 'a_bl1_amps', { hold: 30 }); const hn = V.replay('manesar', 'a_bl1_amps', {});
  check('preview', 'persistence: the same line for that Trigger alone, from replay', hp.ok && hp.count === hr.count && hp.countNow === hn.count && hp.lines[0] === `Last 7 days: would have fired ${hr.count} ${hr.count === 1 ? 'time' : 'times'} (now ${hn.count}).`, hp.lines.join(' / '));
}

/* ── 5. a per-Trigger limit, persistence and clearing, the freeze ──────────────────────────────────────────────── */
V.reset();
{
  const before = V.limitsOf('manesar', 'bl1_amps', 'above').bands.caution;
  const r = V.setTriggerLimit('manesar', 'a_bl1_amps', 'caution', 45, { reason: 'tuning', note: 'This blower runs warm after its overhaul' });
  const o = dec('manesar', (t) => t.kind === 'triggerLimit' && t.alertId === 'a_bl1_amps');
  check('trigger', 'a per-Trigger limit changes that Trigger\'s band only: the zone keeps 44 A, the Trigger fires at 45 A', r.ok && o && V.limitsOf('manesar', 'bl1_amps', 'above').bands.caution === before && before === 44 && __.termsFor('manesar', 'a_bl1_amps').bands.caution === 45 && o.base === 44 && o.baseSource === 'sensor', r.error || (o && `${o.base} ${__.termsFor('manesar', 'a_bl1_amps').bands.caution}`));
  const dv = V.deviations();
  check('trigger', 'it counts under Trigger limit overrides, in its own section, not in the groups', dv.counts.triggerlimit === 1 && dv.triggerLimit.length === 1 && dv.triggerLimit[0].what === 'Motor current high · BL-1 · Caution band' && !dv.groups.some((g) => g.rows.some((x) => x.kind === 'triggerLimit')) && o.href === '#/p/manesar/trigger/a_bl1_amps?f=band.caution', dv.triggerLimit.map((x) => x.what).join(','));
  check('trigger', 'Activity: "Overrode Caution for Motor current high · BL-1 only: 44 A → 45 A (Tuning: …)"', latestAct('manesar') === 'Overrode Caution for Motor current high · BL-1 only: 44 A → 45 A (Tuning: This blower runs warm after its overhaul)', latestAct('manesar'));
  const rv = V.revertTriggerLimit('manesar', 'a_bl1_amps', 'caution');
  check('trigger', 'revertTriggerLimit: the Trigger follows the sensor again', rv.ok && __.termsFor('manesar', 'a_bl1_amps').bands.caution === 44 && V.deviations().counts.triggerlimit === 0);
  const tm = V.setAlertTiming('manesar', 'a_bl1_amps', { hold: 10 }, { reason: 'tuning', note: 'Start-up surges last a few minutes' });
  const p = dec('manesar', (t) => t.kind === 'persistence' && t.alertId === 'a_bl1_amps');
  check('trigger', 'setAlertTiming writes a persistence record (base 5 min) and the Trigger runs on it', tm.ok && p && p.value === 10 && p.base === 5 && __.termsFor('manesar', 'a_bl1_amps').hold === 10 && latestAct('manesar') === 'Overrode persistence on Motor current high · BL-1: 5 → 10 min (Tuning: Start-up surges last a few minutes)', latestAct('manesar'));
  const f1 = V.setTriggerLimit('manesar', 'a_do_at2', 'minor', 1.8, { reason: 'tuning', note: 'x' }); const f2 = V.setAlertTiming('manesar', 'a_do_at2', { hold: 5 }, { reason: 'tuning', note: 'x' });
  check('trigger', 'a frozen Trigger refuses its own settings: code "frozen", "This Trigger is frozen while its Issue is open."', !f1.ok && f1.code === 'frozen' && f1.error === 'This Trigger is frozen while its Issue is open.' && !f2.ok && f2.code === 'frozen', `${f1.code} ${f1.error}`);
  const clr = recOf('manesar', (t) => t.kind === 'clearing' && t.alertId === 'a_do_at2'); const fr = V.revert(clr.id);
  check('trigger', 'its Migrated clearing cannot be reverted while the Issue is open either', !fr.ok && fr.code === 'frozen' && clr.status === 'active');
  const em = V.setAlertTiming('manesar', 'a_flood', { hold: 5 }, { reason: 'tuning', note: 'x' });
  check('trigger', 'persistence on an Emergency-only Trigger is refused through the wrapper too', !em.ok && /only an Emergency band/.test(em.error));
}

/* ── 6. Temporary: expires by itself; Extend ───────────────────────────────────────────────────────────────────── */
V.reset();
{
  const n0 = now(); const exp = n0 + 7 * DAY;
  const r = V.setZone('manesar', 'at2_do', 'below', 'major', 0.8, { reason: 'temporary', expires: exp, note: 'BL-2 out for repair; DO runs lower until it is back' });
  const o = dec('manesar', zoneT('at2_do', 'major'));
  check('temporary', 'a Temporary override: expires in 7 days, review by = its expiry, no Promote', r.ok && o && o.expires === exp && o.reviewBy === exp && o.ageText === 'expires in 7 d' && o.chip.text === 'Override · Temporary · you · 29 Oct · expires 5 Nov' && o.actions.map((a) => a.label).join(',') === 'Revert,Extend' && o.valueBase === '0.8 mg/L · 1.0 mg/L', r.error || (o && `${o.ageText} ${o.chip.text} ${o.actions.map((a) => a.label)}`));
  const x1 = V.extend(o.id, { expires: n0 + 31 * DAY, note: 'Longer repair' }); const x2 = V.extend(o.id, { expires: n0 + 10 * DAY });
  check('temporary', 'Extend needs a note; a Temporary one refuses an expiry more than 30 days out', !x1.ok && x1.error === 'Pick an expiry date, 30 days from today at most.' && !x2.ok && x2.error === 'Write a note for the new review.' && recOf('manesar', zoneT('at2_do', 'major')).expires === exp);
  const adv = V.advance(7 * 24 * 60); const after = recOf('manesar', zoneT('at2_do', 'major'));
  check('temporary', '"+1 week" expires it on its date: back to the library value 1.0 mg/L; the move lists it; the summary says "1 override expired"', adv.expired.includes(o.id) && after.status === 'expired' && after.endedAt === exp && after.endedNote === 'Expired: back to the library value 1.0 mg/L' && V.limitsOf('manesar', 'at2_do', 'below').bands.major === 1 && /1 override expired/.test(adv.summary), `${adv.summary} · ${after.status} ${after.endedNote}`);
  const line = V.activity({ plant: 'manesar' }).find((a) => /^Temporary override expired/.test(a.text));
  check('temporary', 'Activity: "Temporary override expired: DO-AT2 · Major zone back to the library value 1.0 mg/L. Plant admins told."', line && line.text === 'Temporary override expired: DO-AT2 · Major zone back to the library value 1.0 mg/L. Plant admins told.' && line.at === exp && line.who === '—', line && line.text);
  const vt = V.setZone('vedanta', 'v_sbr_DO', 'below', 'minor', 1.8, { reason: 'temporary', expires: now() + DAY, note: 'Aerator belt being changed' });
  V.advance(24 * 60);
  const vline = V.activity({ plant: 'vedanta' }).find((a) => /^Temporary override expired/.test(a.text));
  check('temporary', 'at a Commissioning plant nothing is sent: "Temporary override expired: DO-SBR-1 · Minor zone back to the library value 2.0 mg/L. Commissioning: nothing is sent."', vt.ok && vline && vline.text === 'Temporary override expired: DO-SBR-1 · Minor zone back to the library value 2.0 mg/L. Commissioning: nothing is sent.', vt.error || (vline && vline.text));
  const h = V.deviations().history.find((x) => x.id === o.id);
  check('temporary', 'it moves to History: "Expired 5 Nov: Expired: back to the library value 1.0 mg/L"', h && h.state === 'expired' && h.historyLine === 'Expired 5 Nov: Expired: back to the library value 1.0 mg/L' && h.stateChip.text === 'Expired', h && h.historyLine);
}

/* ── 7. Revert, Revert all, Adopt, Keep, Extend ────────────────────────────────────────────────────────────────── */
V.reset();
{
  const minor = recOf('manesar', zoneT('bl1_amps', 'minor'));
  const pv = V.revertPreview(minor.id); const rv = V.revert(minor.id);
  check('revert', 'Minor alone would sit under Caution 44 A: revertPreview says Revert all 3 together, revert refuses', pv.needsAll && pv.ok && pv.bands.length === 3 && pv.allButton === 'Revert all 3' && pv.allText === 'Revert every overridden band on AMP-BL1 together: Caution 44 A → 40.0 A, Minor 48 A → 42.0 A, Major no value → 46.0 A' && pv.title === 'Revert to the derived value?' && pv.text === 'Go back to the derived value 42.0 A? Your override and its note stay in history.' && !rv.ok && rv.needsAll, `${pv.allText} · ${pv.text} · ${rv.error}`);
  const ra = V.revertAll(minor.id);
  check('revert', 'Revert all: AMP-BL1 back to 40 / 42 / 46 A, three records in History', ra.ok && ra.count === 3 && JSON.stringify(['caution', 'minor', 'major'].map((b) => V.limitsOf('manesar', 'bl1_amps', 'above').bands[b])) === JSON.stringify([40, 42, 46]) && V.deviations().history.length === 3 && latestAct('manesar') === 'Reverted every overridden band on AMP-BL1: Caution 44 A → 40.0 A, Minor 48 A → 42.0 A, Major no value → 46.0 A', latestAct('manesar'));
  const clr = recOf('manesar', (t) => t.kind === 'clearing' && t.alertId === 'a_bl1_amps');
  const pc = V.revertPreview(clr.id); const rc = V.revert(clr.id, { note: 'Clears too early on the blower' });
  check('revert', 'Revert asks "Go back to the library value 10 min? Your override and its note stay in history."; the record keeps its note in History', pc.text === 'Go back to the library value 10 min? Your override and its note stay in history.' && pc.title === 'Revert to the library value?' && rc.ok && rc.toast === 'Reverted: Motor current high · BL-1 · clearing is back to 10 min.' && clr.status === 'reverted' && clr.endedNote === 'Reverted to the library value 10 min' && latestAct('manesar') === 'Reverted Motor current high · BL-1 · clearing: 5 min → 10 min (library)' && __.termsFor('manesar', 'a_bl1_amps').clear === 10, `${pc.text} · ${latestAct('manesar')}`);
  const hr = V.deviations().history.find((x) => x.id === clr.id);
  check('revert', 'History row: "Reverted 29 Oct by you: Reverted to the library value 10 min"', hr && hr.historyLine === 'Reverted 29 Oct by you: Reverted to the library value 10 min' && hr.actions.length === 0, hr && hr.historyLine);
  /* a base that moved: the stored base differs from what the library gives now */
  const ml = recOf('manesar', zoneT('at1_mlss', 'minor')); ml.base = 1800; __.touch();
  const mv = dec('manesar', zoneT('at1_mlss', 'minor'));
  check('basemoved', 'Base moved: chip "Base moved" (the only amber fill) with "Library changed 1,800 → 2,000 since you overrode it"; Keep · Adopt the library value · Promote', mv.movedQuestion === 'The library changed this from 1,800 mg/L to 2,000 mg/L after you overrode it. Keep 2,500 mg/L, or adopt 2,000 mg/L?' && mv.state === 'basemoved' && mv.chip.text === 'Base moved' && mv.chip.tone === 'moved' && mv.chip.sub === 'Library changed 1,800 → 2,000 since you overrode it' && mv.actions.map((a) => `${a.label}${a.primary ? '*' : ''}`).join(',') === 'Keep,Adopt the library value*,Promote' && mv.valueBase === '2,500 mg/L · base moved 1,800 → 2,000 mg/L' && V.ovState(ml) === 'basemoved', `${mv.state} ${mv.chip.sub} ${mv.valueBase}`);
  const k0 = V.keep(ml.id, {}); const rb0 = ml.reviewBy;
  const k1 = V.keep(ml.id, { note: 'AT-1 carries a heavier load than AT-2' });
  check('basemoved', 'Keep needs a new note ("Write a note: why keep this value?"); then the base is the library\'s again, the review date unchanged, the state cleared', !k0.ok && k0.error === 'Write a note: why keep this value?' && k1.ok && ml.base === 2000 && ml.reviewBy === rb0 && V.ovState(ml) === 'active' && ml.note === 'AT-1 carries a heavier load than AT-2' && latestAct('manesar') === 'Kept the override on MLSS-AT1 · Minor zone at 2,500 mg/L; the library is now 2,000 mg/L (AT-1 carries a heavier load than AT-2)', latestAct('manesar'));
  const hold = recOf('manesar', (t) => t.kind === 'persistence' && t.alertId === 'a_mlss_hi'); hold.base = 3; __.touch();
  const ad = V.adopt(hold.id);
  check('basemoved', 'Adopt the library value: the record ends as reverted and the Trigger follows 5 min; toast "Manesar STP follows the library again: MLSS high · AT-1 · persistence 5 min."', ad.ok && hold.status === 'reverted' && hold.endedNote === 'Adopted the library value 5 min' && ad.toast === 'Manesar STP follows the library again: MLSS high · AT-1 · persistence 5 min.' && __.termsFor('manesar', 'a_mlss_hi').hold === 5 && latestAct('manesar') === 'Adopted the library value for MLSS high · AT-1 · persistence: 30 min → 5 min', ad.error || ad.toast);
  check('basemoved', 'Keep and Adopt are for a moved base only', !V.keep(recOf('manesar', zoneT('at1_do', 'emergency')).id, { note: 'x' }).ok && !V.adopt(recOf('manesar', zoneT('at1_do', 'emergency')).id).ok);
  if (BLANKET_MOVED) {
    const blk = recOf('manesar', (t) => t.kind === 'persistence' && t.alertId === 'a_blanket'); const ab = V.adopt(blk.id);
    check('basemoved', 'the seed\'s Sludge blanket: "Manesar STP follows the library again: Sludge blanket high · SC-1 · persistence 15 min."', ab.ok && ab.toast === 'Manesar STP follows the library again: Sludge blanket high · SC-1 · persistence 15 min.', ab.toast || ab.error);
  }
  const sp = recOf('manesar', (t) => t.kind === 'tier' && t.eqId === 'sp1');
  const e0 = V.extend(sp.id, {}); const e1 = V.extend(sp.id, { note: 'Checked with the Lead: still true' });
  check('extend', 'Extend on the past-review SP-1: needs a note; then review by 27 Jan 2027 (Tuning, 90 days) and 0 past review; the reason stays', !e0.ok && e0.error === 'Write a note for the new review.' && e1.ok && sp.reviewBy === now() + 90 * DAY && V.deviations().counts.pastreview === 0 && sp.reason === 'tuning' && e1.toast === 'Extended: SP-1 · criticality tier C, review by 27 Jan 2027.' && latestAct('manesar') === 'Extended the override on SP-1 · criticality tier: review by 27 Jan 2027 (Checked with the Lead: still true)', e1.toast);
}

/* ── 8. Promote, variant requests, Structural ─────────────────────────────────────────────────────────────────── */
V.reset();
{
  const ml = dec('manesar', zoneT('at1_mlss', 'minor'));
  const pd = V.promote(ml.id, { as: 'default' });
  check('promote', '"Make it the library default" opens the template page with ?promote=', pd.ok && ml.templateId && pd.href === `#/library/templates/${ml.templateId}?promote=${ml.id}` && (!HAS_STRUCTURE || ml.templateId === 'tpl_up_activated-sludge_mlss-low'), pd.href || pd.error);
  const pt = V.promote(recOf('manesar', (t) => t.kind === 'tier' && t.eqId === 'sp1').id, { as: 'default' });
  check('promote', 'a criticality tier opens its equipment type with ?promote=', pt.ok && /^#\/library\/eq-types\/PMP\?promote=ov_/.test(pt.href), pt.href);
  const v0 = V.promote(ml.id, { as: 'variant' }); const v1 = V.promote(ml.id, { as: 'variant', trait: 'high-load basins', note: 'AT-1 takes the first flush' });
  const vr = V.variantRequests();
  check('promote', '"Make it a variant by trait" needs the trait, then logs a variant request on the owner', !v0.ok && v0.error === 'Name the trait that makes this kind differ.' && v1.ok && vr.length === 1 && vr[0].trait === 'high-load basins' && vr[0].fromOverride === ml.id && vr[0].plant === 'manesar' && /^vr_\d+$/.test(vr[0].id) && V.variantRequests(vr[0].ownerCode).length === 1, v1.error || JSON.stringify(vr[0]));
  const pm = V.promoted(ml.id, 'lc_test');
  check('promote', 'once the promoting draft is published the override is Promoted, with a line in Activity', pm.ok && recLive('manesar', zoneT('at1_mlss', 'minor')) === null && V.S.overrides.find((o) => o.id === ml.id).status === 'promoted' && /^Promoted to the library \(/.test(V.S.overrides.find((o) => o.id === ml.id).endedNote) && /^Promoted Manesar STP's override to the library: MLSS-AT1 · Minor zone 2,500 mg\/L \(/.test(V.activity({ limit: 1 })[0].text), V.activity({ limit: 1 })[0].text);
  V.setZone('manesar', 'at2_do', 'below', 'minor', 1.5, { reason: 'tuning', note: 'Short dips below 2.0 recover on their own; 1.5 is where the operators act' });
  const d8 = dec('manesar', zoneT('at2_do', 'minor'));
  check('promote', 'the template page\'s banner: "Promoting Manesar STP\'s override: DO-AT2 · Minor zone 1.5 mg/L (library 2.0 mg/L). Check Downstream, then publish."', d8 && d8.promoteBanner === "Promoting Manesar STP's override: DO-AT2 · Minor zone 1.5 mg/L (library 2.0 mg/L). Check Downstream, then publish." && V.overrideById(d8.id).id === d8.id && d8.promoteText === 'Manesar STP uses 1.5 mg/L for DO-AT2 · Minor zone; the library says 2.0 mg/L.', d8 && d8.promoteBanner);
  const cduR = dec('manesar', zoneT('cdu_lvl', 'caution')); const cduP = V.promote(cduR.id, { as: 'default' });
  check('promote', 'a value the library has no limit rule for (CDU-1 tank level) can only become a variant request: Promote is marked variant-only and the default is refused', cduR.actions.find((a) => a.id === 'promote').variantOnly === true && !cduP.ok && cduP.variantOnly && cduP.error === 'The library has no limit rule for this value, so there is no default to change: request a library variant instead.' && ml.actions.find((a) => a.id === 'promote').variantOnly === false, cduP.error);
  const tmp = V.setZone('manesar', 'at1_do', 'below', 'minor', 1.8, { reason: 'temporary', expires: now() + 3 * DAY, note: 'Probe swap' });
  check('promote', 'a Temporary override is not promoted', tmp.ok && !V.promote(tmp.id, { as: 'default' }).ok);
  /* Structural: request a variant and save nothing, or override for now and log the request with it */
  const nOv = V.S.overrides.length;
  const sv = V.setOverride('manesar', { kind: 'zone', sensorId: 'at2_mlss', dir: 'above', band: 'minor' }, 5000, { reason: 'structural', variantOnly: true, trait: 'membrane-backed basins', note: 'Runs a higher MLSS by design' });
  check('structural', 'Structural\'s "Request a variant" logs a variant request (library page and Activity) and saves no override', sv.ok && sv.saved === false && sv.variantRequestId && V.S.overrides.length === nOv && V.variantRequests().some((r) => r.id === sv.variantRequestId && r.trait === 'membrane-backed basins') && /^Requested a library variant of .+: "membrane-backed basins" \(Runs a higher MLSS by design\)$/.test(V.activity({ limit: 1 })[0].text), sv.error || V.activity({ limit: 1 })[0].text);
  const so = V.setOverride('manesar', { kind: 'zone', sensorId: 'at2_mlss', dir: 'above', band: 'minor' }, 5000, { reason: 'structural', trait: 'membrane-backed basins' });
  const sr = recOf('manesar', zoneT('at2_mlss', 'minor'));
  check('structural', '"Override for now" saves a Structural override (1 year review) and links the request it logs', so.ok && sr && sr.reason === 'structural' && sr.reviewBy === now() + 365 * DAY && sr.variantRequest === so.variantRequestId && !!so.variantRequestId);
}

/* ── 9. the other values: tier, cadence, job thresholds, enabled ──────────────────────────────────────────────── */
V.reset();
{
  const bl = __.eqRaw('manesar', 'bl1'); const t0 = V.tierInfo('manesar', 'bl1').value; const to = t0 === 'A' ? 'B' : 'A';
  const tr = V.setTier('manesar', 'bl1', to, { reason: 'tuning', note: 'A standby blower can carry AT-2' });
  check('values', 'setTier writes a tier record over the tier in force and v6 mirrors it', tr.ok && recOf('manesar', (t) => t.kind === 'tier' && t.eqId === 'bl1').base === t0 && bl.tier === to && V.tierInfo('manesar', 'bl1').value === to && latestAct('manesar') === `Overrode criticality tier of BL-1: ${t0} → ${to} (Tuning: A standby blower can carry AT-2)`, tr.error || latestAct('manesar'));
  check('values', 'a tier must be A, B or C', V.setTier('manesar', 'bl1', 'X', { reason: 'tuning', note: 'x' }).error === 'Pick a criticality tier: A, B or C.');
  V.setTier('manesar', 'bl1', t0, {});
  check('values', 'back to the tier in force ends it', !recLive('manesar', (t) => t.kind === 'tier' && t.eqId === 'bl1') && bl.tier === t0);
  const sc = __.dOf('manesar').schedules.find((x) => x.basis === 'calendar' && x.subject.kind === 'eq' && !LG.singleUseFor('manesar', x.id) && LG.info('manesar', { kind: 'cadence', scheduleId: x.id }).base && x.every.unit === 'month');
  const base = sc && LG.info('manesar', { kind: 'cadence', scheduleId: sc.id }).base;
  const cr = sc ? V.setCadence('manesar', sc.id, { n: base.n + 1, unit: base.unit }, { reason: 'tuning', note: 'Low duty here' }) : { ok: false, error: 'no calendar Task' };
  const co = sc && recOf('manesar', (t) => t.kind === 'cadence' && t.scheduleId === sc.id);
  check('values', 'setCadence writes a cadence record; the Task runs on it; its field is the Task\'s Trigger page', cr.ok && co && co.base.n === base.n && sc.every.n === base.n + 1 && V.fieldHref(co) === `#/p/manesar/trigger/${sc.id}?f=cadence` && /^Overrode cadence of .+ on .+: every \d* ?months? → every \d+ months \(Tuning: Low duty here\)$/.test(latestAct('manesar')), cr.error || latestAct('manesar'));
  check('values', 'a cadence needs a number and a unit', V.setCadence('manesar', sc.id, { n: 0, unit: 'month' }, { reason: 'tuning', note: 'x' }).error === 'Give the cadence: a number and hour, day, week, month or year.');
  /* v7/2: no condition-based work on equipment — Manesar's intake-filter job (two Migrated values) is now a Task BL-1's Caution line raises at the plant */
  const c1 = V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: 'Clean the blower intake filters', filedAt: 'at1' });
  const lw1 = V.lineWork('manesar', { sensorId: 'bl1_amps' })[0];
  check('values', 'a line\'s Task moves from the plant to AT-1 (a unit process BL-1 takes part in) and its Task follows', !HAS_STRUCTURE || c1.ok && lw1.filed.kind === 'up' && lw1.filed.id === 'at1' && V.task('manesar', lw1.id).upId === 'at1', c1.error || JSON.stringify(lw1 && lw1.filed));
  const c2 = V.setLineWork('manesar', 'bl1_amps', 'above', 'caution', { name: 'x', filedAt: 'bl1' });
  check('values', 'a line\'s Task is never filed on equipment', !HAS_STRUCTURE || !c2.ok && /unit process/.test(c2.error), c2.error);
  const en = V.setEnabled('bawal', 'a_1a', false, { reason: 'tuning', note: 'The day tank is being replaced; level reads nothing' });
  const er = recOf('bawal', (t) => t.kind === 'enabled' && t.alertId === 'a_1a');
  check('values', 'setEnabled off on a Live plant: an enabled record, the Trigger is inactive', en.ok && er && er.value === false && er.base === true && V.alertState('bawal', 'a_1a') === 'inactive' && V.fieldHref(er) === '#/p/bawal/trigger/a_1a?f=enabled' && latestAct('bawal') === 'Set Chemical tank low · DT-1 inactive at this plant (Tuning: The day tank is being replaced; level reads nothing)', en.error || latestAct('bawal'));
  V.revert(er.id);
  check('values', 'reverting it makes the Trigger active again', er.status === 'reverted' && V.alertState('bawal', 'a_1a') === 'active');
}

/* ── 10. library changes reach the ledger ─────────────────────────────────────────────────────────────────────── */
V.reset();
{
  const ml = recOf('manesar', zoneT('at1_mlss', 'minor')); const doe = recOf('manesar', zoneT('at1_do', 'emergency'));
  let via = 'library file';
  if (has('editTemplate') && has('publishTemplate')) {
    const tid = dec('manesar', zoneT('at1_mlss', 'minor')).templateId;
    safe(() => V.editTemplate(tid, { band: 'minor', rule: { kind: 'const', value: 2500 } }));
    safe(() => V.publishTemplate(tid, { kind: 'minor', note: 'Basins run well at a higher floor' }));
  } else {
    via = 'the ledger hook';
    const set = __.setOf(__.libKey(__.eqRaw('manesar', 'at1'))); const la = set.alerts.find((a) => a.sensorKind === 'MLSS' && a.direction === 'below'); la.limits = { ...la.limits, minor: 2500 }; __.touch();
    V.ledgerOnBaseChange({ kind: 'minor', match: (t) => t.kind === 'zone' && (t.sensorId === 'at1_mlss' || t.sensorId === 'at1_do'), owner: 'MLSS low', version: 2, changeId: 'lc_t' });
  }
  check('library', `a Minor change whose new value equals an override's value ends that override as Cleared (through ${via})`, ml.status === 'cleared' && /^Cleared by .+ v2: the library now uses 2,500 mg\/L$/.test(ml.endedNote) && doe.status === 'active' && V.deviations().history.some((h) => h.id === ml.id && h.state === 'cleared'), `${ml.status} ${ml.endedNote}`);
  V.reset();
  const doe2 = recOf('manesar', zoneT('at1_do', 'emergency'));
  const fs = V.ledgerOnBaseChange({ kind: 'forced', changeId: 'lc_forced', match: (t) => t.kind === 'zone' && t.band === 'emergency' && t.sensorId === 'at1_do' });
  const d2 = dec('manesar', zoneT('at1_do', 'emergency'));
  check('library', 'a Forced change suspends the override: kept, not applied, chip "Suspended", no actions, counted as suspended', fs.suspended.includes(doe2.id) && doe2.status === 'active' && d2.state === 'suspended' && d2.chip.text === 'Suspended' && d2.chip.tone === 'susp' && /^Forced by library · .+ · your override is kept and will return when lifted$/.test(d2.chip.sub) && d2.actions.length === 0 && V.deviations().counts.suspended === 1 && !V.promote(doe2.id, { as: 'default' }).ok, JSON.stringify(d2.chip));
  const lf = V.ledgerLiftForced('lc_forced');
  check('library', 'lifting the Forced change brings the override back', lf.lifted.includes(doe2.id) && !doe2.suspendedBy && V.ovState(doe2) === 'active' && V.deviations().counts.suspended === 0);
  const mj = V.ledgerOnBaseChange({ kind: 'major', match: () => true });
  check('library', 'a Major change leaves the ledger as it is (the override is carried into the new draft)', mj.cleared.length === 0 && mj.suspended.length === 0 && V.deviations().counts.overrides === 15);
}

/* ── 11. Deviations: the variant line, single-use, counts that grow ───────────────────────────────────────────── */
V.reset();
{
  const r = V.setAlertTiming('vedanta', 'a_3x', { clear: 5 }, { reason: 'tuning', note: 'The blower settles within five minutes' });
  const g = V.deviations().groups.find((x) => x.rows.some((y) => y.plant === 'vedanta' && y.target.alertId === 'a_3x'));
  check('deviations', 'two plants overriding one field to the same value: "2 plants override this value the same way. Consider a library variant?"', r.ok && g && g.rows.length === 2 && g.variant && g.variant.plants === 2 && g.variant.text === '2 plants override this value the same way. Consider a library variant?' && g.variant.valueText === '5 min', g && JSON.stringify(g.variant));
  const ks = V.keepSingleUse('tpl_single_manesar_s_hypo'); const su = V.singleUse({ plant: 'manesar' }).find((x) => x.id === 'tpl_single_manesar_s_hypo');
  check('deviations', 'Keep single-use: "Kept single-use · 29 Oct 2026 · you", toast "Kept single-use: Chemical refill at Manesar STP."', ks.ok && ks.toast === 'Kept single-use: Chemical refill at Manesar STP.' && su.keptText === 'Kept single-use · 29 Oct 2026 · you' && latestAct('manesar') === 'Kept Chemical refill single-use at Manesar STP', su && su.keptText);
  check('deviations', 'Merge into its type opens the library with ?merge=1', V.mergeSingleUse('tpl_single_manesar_w_sludge').href === '#/library/templates/tpl_single_manesar_w_sludge?merge=1' && V.singleUse({}).find((x) => x.id === 'tpl_single_manesar_w_sludge').mergeLabel === 'Merge into Pump…');
  const s0 = V.deviations().counts.structure; const o0 = V.deviations().counts.overrides;
  if (has('place')) {
    const nd = V.nodes('digitalpaani'); const uffp = nd.find((e) => e.tag === 'UFFP-1'); const uf1 = nd.find((e) => e.tag === 'UF-1');
    const pr = uffp && uf1 ? V.place('digitalpaani', uffp.id, [uf1.id], {}) : { ok: false };
    check('deviations', 'the structure-changes count equals deviations().counts.structure and grows by one per structure override saved', pr.ok && V.deviations().counts.structure === s0 + 1 && V.deviations().counts.overrides === o0 && V.deviations({ plant: 'digitalpaani' }).structure.length === 1 && V.deviations({ plant: 'digitalpaani' }).counts.overrides === 0, pr.error || V.deviations().counts.structure);
  } else {
    V.S.overrides.push({ id: 'so_test', plant: 'digitalpaani', target: { kind: 'member', upId: 'x', eqId: 'y', op: 'add' }, value: true, base: 'not proposed', reason: 'structure', note: '', author: V.__.ME, at: now(), reviewBy: now() + 365 * DAY, endedAt: null }); __.touch();
    check('deviations', 'the structure-changes count equals deviations().counts.structure and grows by one per structure override saved', V.deviations().counts.structure === s0 + 1 && V.deviations().counts.overrides === o0);
  }
  const vs = V.deviations({ plant: 'vedanta' });
  check('deviations', 'a structure change row says what, with its note, who and age; it links to the structure page', !HAS_STRUCTURE || (vs.structure.length === 4 && vs.structure.every((x) => /^#\/p\/vedanta\/structure\?select=up:/.test(x.href) && x.stateText === 'Added · not proposed' && x.authorText === 'you' && x.ageText === '5 d') && vs.structure.some((x) => x.label === 'EQ-1 · P-1 added' && x.note === 'Lifts raw effluent into this tank')), vs.structure.map((x) => `${x.label} ${x.note}`).join(' | '));
  const sub = V.deviations().sub; const psub = V.deviations({ plant: 'manesar' }).sub;
  check('deviations', 'page words: "Every override, pin and base moved item at every plant, grouped by library field." (and at {Plant})', sub === 'Every override, pin and base moved item at every plant, grouped by library field.' && psub === 'Every override, pin and base moved item at Manesar STP, grouped by library field.');
}

/* ── 12. chips and links ──────────────────────────────────────────────────────────────────────────────────────── */
{
  const at = T('2026-10-29T09:00'), rb = T('2027-01-27T09:00');
  const C = (src) => V.chipFor(src);
  const rows = [
    [C({ src: 'library', template: 'Motor current high', v: 1 }), 'Library · Motor current high v1', 'lib'],
    [C({ src: 'derived', ruleText: '85% of tank height', paramText: '4.0 m' }), 'Derived · 85% of tank height (4.0 m)', 'der'],
    [C({ src: 'derived', derived: { ruleText: 'highest of UF-1' } }), 'Derived · highest of UF-1', 'der'],
    [C({ src: 'override', reason: 'tuning', author: V.__.ME, at, reviewBy: rb, baseText: '85%', baseSource: 'derived' }), 'Override · Tuning · you · 29 Oct · review by 27 Jan', 'ovr'],
    [C({ src: 'override', reason: 'temporary', author: 'Sunny Verma', at, expires: T('2026-11-05T09:00'), reviewBy: T('2026-11-05T09:00'), baseText: '1.0 mg/L' }), 'Override · Temporary · Sunny Verma · 29 Oct · expires 5 Nov', 'ovr'],
    [C({ src: 'basemoved', old: '2,000', new: '2,200' }), 'Base moved', 'moved'],
    [C({ src: 'suspended', template: 'DO low', v: 2 }), 'Suspended', 'susp'],
    [C({ src: 'forced', template: 'DO low', v: 2 }), 'Forced by library · DO low v2', 'forced'],
    [C({ src: 'pinned', v: 1, latest: 2, x: '2,200 mg/L' }), 'Pinned to v1 · v2 changes this to 2,200 mg/L', 'pin'],
    [C({ src: 'pinned', v: 2, latest: 2 }), 'Pinned to v2', 'pin'],
    [C({ src: 'proposed' }), 'Proposed', 'prop'],
    [C({ src: 'followsSensor', tag: 'DO-AT2', zoneText: 'Library · DO low v1' }), 'Follows sensor DO-AT2 · Library · DO low v1', 'lib'],
    [C({ src: 'triggerOverride', reason: 'structural', sensorValueText: '44 A' }), 'Overridden for this Trigger · Structural', 'ovr'],
    [C({ src: 'gap', paramLabel: 'tank height', tag: 'CCT' }), 'Gap · needs tank height (CCT)', 'gap'],
    [C({ src: 'gap' }), 'Gap · no rule', 'gap'],
    [C({ src: 'frozen', n: 1 }), 'Frozen while 1 Issue is open', 'frozen'],
    [C({ src: 'frozen', n: 2 }), 'Frozen while 2 Issues are open', 'frozen'],
    [C({ src: 'held' }), 'Base moved · waits for a resync', 'moved'],
    [C({ src: 'next' }), 'Next phase', 'next'],
    [C({ src: 'single', plant: 'manesar' }), 'Single-use · Manesar STP only', 'single'],
  ];
  const bad = rows.filter(([c, text, tone]) => c.text !== text || c.tone !== tone);
  check('chips', `chipFor: the text and tone of every source (${rows.length} cases)`, bad.length === 0, bad.map(([c, t]) => `${c.text} ≠ ${t}`).join(' | '));
  check('chips', 'sub and small lines: override "Derived: 85%"; base moved "Library changed 2,000 → 2,200 since you overrode it"; suspended "Forced by library · DO low v2 · …"; no rule "No value · this reading raises nothing"; per-Trigger "Sensor: 44 A"',
    rows[3][0].small === 'Derived: 85%' && rows[5][0].sub === 'Library changed 2,000 → 2,200 since you overrode it' && rows[6][0].sub === 'Forced by library · DO low v2 · your override is kept and will return when lifted' && rows[14][0].sub === 'No value · this reading raises nothing' && rows[12][0].small === 'Sensor: 44 A' && C({ src: 'override', reason: 'migrated', author: null, at, reviewBy: rb, baseSource: 'gap' }).small === 'Library: no rule');
  check('chips', 'only Base moved and its resync wait use the amber fill', rows.filter(([c]) => c.tone === 'moved').every(([c]) => c.text.startsWith('Base moved')));
  check('chips', 'aliases kept for forked pages: form → Derived, changed → Override, libchanged → Base moved, none → Gap', C({ src: 'form', ruleText: 'x' }).tone === 'der' && C({ src: 'changed', reason: 'tuning', at, reviewBy: rb }).tone === 'ovr' && C({ src: 'libchanged', old: '1', new: '2' }).tone === 'moved' && C({ src: 'none' }).text === 'Gap · no rule');
  const words = badWords(rows.map(([c]) => [c.text, c.sub, c.small]).flat().filter(Boolean));
  check('chips', 'no chip text uses a don\'t-use word', words.length === 0, words.join(' | '));
  const H = (key, target) => V.fieldHref({ plant: key, target });
  const links = [
    [H('manesar', { kind: 'zone', sensorId: 'at1_mlss', dir: 'below', band: 'minor' }), '#/p/manesar/sensor/at1_mlss?f=zone.below.minor'],
    [H('manesar', { kind: 'triggerLimit', alertId: 'a_bl1_amps', dir: 'above', band: 'caution' }), '#/p/manesar/trigger/a_bl1_amps?f=band.caution'],
    [H('manesar', { kind: 'persistence', alertId: 'a_blanket' }), '#/p/manesar/trigger/a_blanket?f=persistence'],
    [H('manesar', { kind: 'clearing', alertId: 'a_blanket' }), '#/p/manesar/trigger/a_blanket?f=clearing'],
    [H('manesar', { kind: 'enabled', alertId: 'a_flood' }), '#/p/manesar/trigger/a_flood?f=enabled'],
    [H('manesar', { kind: 'cadence', scheduleId: 's_hypo' }), '#/p/manesar/trigger/s_hypo?f=cadence'],
    [H('manesar', { kind: 'runhours', scheduleId: 's_x' }), '#/p/manesar/trigger/s_x?f=runhours'],
    [H('manesar', { kind: 'condition', workId: 'w_intake', which: 'doneWhen' }), '#/p/manesar/trigger/w_intake?f=condition.doneWhen'],
    [H('manesar', { kind: 'tier', eqId: 'sp1' }), '#/p/manesar/eq/sp1/details?f=tier'],
    [H('vedanta', { kind: 'member', upId: 'v_eq1', eqId: 'v_p1', op: 'add' }), '#/p/vedanta/structure?select=up:v_eq1'],
  ];
  const badL = links.filter(([a, b]) => a !== b);
  check('links', 'fieldHref: zones to the sensor page, Trigger and Task fields to the Trigger page (never the Task page), tiers to Details, structure to the structure page', badL.length === 0, badL.map(([a, b]) => `${a} ≠ ${b}`).join(' | '));
  if (HAS_STRUCTURE) check('links', 'a unit process\'s tier links to the unit-process page', H('manesar', { kind: 'tier', eqId: 'at2' }) === '#/p/manesar/up/at2/details?f=tier', H('manesar', { kind: 'tier', eqId: 'at2' }));
  const ids = [[{ kind: 'zone', sensorId: 's', dir: 'below', band: 'minor' }, 'zone.below.minor'], [{ kind: 'triggerLimit', alertId: 'a', band: 'caution' }, 'band.caution'], [{ kind: 'persistence', alertId: 'a' }, 'persistence'], [{ kind: 'clearing', alertId: 'a' }, 'clearing'], [{ kind: 'enabled', alertId: 'a' }, 'enabled'], [{ kind: 'cadence', scheduleId: 'x' }, 'cadence'], [{ kind: 'runhours', scheduleId: 'x' }, 'runhours'], [{ kind: 'condition', workId: 'w', which: 'doneWhen' }, 'condition.doneWhen'], [{ kind: 'tier', eqId: 'e' }, 'tier'], [{ kind: 'limit', sensorId: 's', dir: 'above', band: 'major' }, 'zone.above.major'], [{ kind: 'hold', alertId: 'a' }, 'persistence']];
  check('links', 'fieldId: zone.{dir}.{band}, band.{band}, persistence, clearing, enabled, cadence, runhours, condition.{which}, tier (v7/1\'s kind names read the same)', ids.every(([t, id]) => V.fieldId(t) === id), ids.map(([t]) => V.fieldId(t)).join(','));
}

/* ── 13. words, determinism ───────────────────────────────────────────────────────────────────────────────────── */
{
  const words = badWords(ledgerTexts(V));
  check('words', `no don't-use word in what the ledger writes after the actions above`, words.length === 0, words.slice(0, 5).join(' || '));
  V.reset(); const a = JSON.stringify(V.deviations()); const o1 = JSON.stringify(V.S.overrides);
  V.reset(); const b = JSON.stringify(V.deviations());
  check('determinism', 'Reset gives the same ledger and the same Deviations model, byte for byte', a === b && JSON.stringify(V.S.overrides) === o1);
  const f1 = child(['--fresh']); const f2 = child(['--fresh']);
  check('determinism', 'two boots from empty storage, in two processes, give byte-equal ledger state', !f1.error && f1.ov === f2.ov && f1.dev === f2.dev && f1.lib === f2.lib && f1.ov === sha(o1) && f1.dev === sha(a), f1.error || `${f1.ov} ${f2.ov} ${sha(o1)}`);
}

/* ════════════════════════════════════ --alone: core7 and the ledger only ════════════════════════════════════════════ */
if (MODE === '--alone') {
  const c = V.deviations().counts;
  emit({ results, loaded: L.loaded, counts: c });
  process.exit(0);
}
if (MODE === 'main') {
  const others = ['core72-structure.js', 'core72-library.js', 'core72-commission.js'].filter((f) => L.loaded.includes(f));
  if (others.length) {
    const al = child(['--alone'], { LOAD72_SKIP: others.join(',') });
    check('alone', 'core7 and the ledger alone: the ledger works on core7\'s own resolvers', !al.error && al.loaded && !al.loaded.some((f) => others.includes(f)), al.error);
    (al.results || []).forEach((r) => check(`alone · ${r.group}`, r.name, r.ok, r.detail));
  }
  const groups = {}; results.forEach((r) => { (groups[r.group] = groups[r.group] || []).push(r); });
  Object.keys(groups).forEach((g) => { const rs = groups[g]; const bad = rs.filter((r) => !r.ok); console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(24)} ${rs.length - bad.length}/${rs.length}`); (VERBOSE ? rs : bad).forEach((r) => console.log(`       ${r.ok ? '✓' : '✗'} ${r.name}${!r.ok && r.detail ? `  [${r.detail}]` : ''}`)); });
  console.log(`\noverrides72 · ${results.length} checks · loaded: ${L.loaded.filter((f) => /^core7/.test(f)).join(', ')}${BLANKET_MOVED ? '' : ' · the seed\'s moved Sludge blanket base waits for the library file'}`);
  console.log(`RESULT: ${fails ? `FAIL · ${fails} failing` : 'PASS'}`);
  process.exit(fails ? 1 : 0);
}
