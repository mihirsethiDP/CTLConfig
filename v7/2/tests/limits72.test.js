#!/usr/bin/env node
/* v7/2 · tests/limits72.test.js — headless test of the library file's limit rules, design parameters and Zones: constant flags,
   derived limits (motor current from the motor rating, level from the tank height), the resolution order, limit gaps, the
   design-parameter editor and its preview, hand tests with no Zones, and the Readings tab on Live plants only. It also checks
   that the Trigger terms the engine reads are the ones v7/1's engine read at the story's start (like for like).
   Node only, no dependencies; loads the whole v7/2 stack through tests/load72.js.
   Usage: TZ=Asia/Calcutta node tests/limits72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const VERBOSE = process.argv.includes('-v');
const KEYS = ['digitalpaani', 'vedanta', 'manesar', 'bawal'];
const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail: detail == null ? undefined : String(detail) }); if (!ok) fails++; }
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb === undefined ? `threw: ${e.message}` : fb; } };
const J = (x) => JSON.stringify(x);

const t0 = Date.now();
const L = require('./load72.js'); const V = L.V7; const __ = V && V.__;
check('load', 'the v7/2 stack loads and boots with the library file', !!V && L.loaded.includes('core72-library.js') && !L.errors.length, L.errors.map((e) => `${e.file}: ${e.error.slice(0, 200)}`).join(' | ') || L.loaded.join(','));
if (!V || !L.loaded.includes('core72-library.js')) { report(); }
const BANDS = ['caution', 'minor', 'major', 'emergency'];
const nodeId = (k, tag) => (__.dOf(k).equipment.find((e) => e.tag === tag) || {}).id;
const sensorId = (k, tag) => (__.dOf(k).sensors.find((s) => s.tag === tag) || {}).id;
const z = (k, sid, dir) => V.zoneInfo(k, sid, dir);
const vals = (zi, bands) => (bands || ['caution', 'minor', 'major']).map((b) => zi.perBand[b].value);
const resolved = (zi, bands) => (bands || ['caution', 'minor', 'major']).map((b) => zi.perBand[b].resolved);
const actLast = (k) => (V.activity({ plant: k, limit: 1 })[0] || {}).text;
const stateHash = () => J(V.S);

/* ── 1. like for like: the engine reads v7/1's terms at the story's start ── */
{
  const diffs = [];
  KEYS.forEach((k) => __.dOf(k).alerts.forEach((a) => { const mine = __.termsFor(k, a.id); const old = __.termsOf(k, a.id); if (J(mine.bands) !== J(old.bands) || mine.hold !== old.hold || mine.clear !== old.clear || mine.dir !== old.dir) diffs.push(`${k}:${a.id}`); }));
  check('terms', 'every Trigger at every plant runs on the bands, persistence and clearing v7/1 gave it (Alex\'s limit rules resolve to the same numbers)', diffs.length === 0, diffs.join(', '));
  const t = __.termsFor('manesar', 'a_bl1_amps');
  check('terms', 'the terms hook returns the full shape the engine needs', ['alertId', 'sensorId', 'dir', 'unit', 'kind', 'incl', 'bands', 'hold', 'clear', 'gate'].every((x) => x in t) && t.templateId === 'tpl_BLW_motor-current-high', Object.keys(t).join(','));
  const P = __.PS('vedanta'); const per = {}; P.trialLog.forEach((r) => { per[r.alertId] = (per[r.alertId] || 0) + 1; });
  check('terms', 'so Vedanta\'s trial is the same: 112 records (Level high · EQ-1 76, DO low · SBR-1 35, pH low · EQ-1 1); the shared counter untouched', P.trialLog.length === 112 && per.a_3d === 76 && per.a_3r === 35 && per.a_3f === 1 && V.S.seq === 202, `${J(per)} seq ${V.S.seq}`);
}

/* ── 2. constant flags (V72-3) ── */
{
  const SD = V.SIZE_DEPENDENT; const bad = []; let flagged = 0; let exprFlag = 0;
  V.templates({ kind: 'trigger' }).forEach((t) => BANDS.forEach((b) => { const r = t.rules[b]; const want = !!r && r.rule.kind === 'const' && SD.includes(t.reading); const got = V.constantFlag(t.id, b); if (got !== want) bad.push(`${t.id}:${b}`); if (got) flagged++; if (got && r && r.rule.kind === 'expr') exprFlag++; }));
  check('flags', 'V72-3 · constantFlag is true on a band exactly when its limit rule is a constant on a size-dependent reading', bad.length === 0 && flagged > 0, bad.slice(0, 6).join(', '));
  check('flags', 'V72-3 · it is true for the Agitator\'s motor current and the Dosing Tank\'s chemical level, never on an expression band', V.constantFlag('tpl_OS_TANK_AG_motor-current-high', 'minor') && V.constantFlag('tpl_DOS_TANK_chemical-tank-low', 'caution') && V.constantFlag('tpl_DOS_TANK_chemical-tank-low', 'minor') && exprFlag === 0 && !V.constantFlag('tpl_BLW_motor-current-high') && !V.constantFlag('tpl_up_equalisation_level-high'));
  const ag = V.zoneInfo('vedanta', 'v_mx1_AMP', 'above');
  check('flags', 'Vedanta\'s Agitator: Minor above 24 A from "Library · Motor current high v1", flagged', ag.bands.minor === 24 && ag.perBand.minor.chipText === 'Library · Motor current high v1' && ag.constantFlag.minor === true, ag.perBand.minor.chipText);
}

/* ── 3. derived limits (V72-4, V72-5, V72-6) ── */
{
  const bl = z('manesar', 'bl1_amps', 'above');
  check('derived', 'V72-4 · Manesar AMP-BL1 resolves 40.0 / 42.0 / 46.0 A from the 22 kW motor', J(resolved(bl)) === J([40, 42, 46]) && ['caution', 'minor', 'major'].every((b) => bl.perBand[b].rule.kind === 'expr' && bl.perBand[b].rule.param === 'fullLoadCurrent'), J(resolved(bl)));
  check('derived', 'V72-4 · and is 44 / 48 / none in force, by Override', J(vals(bl)) === J([44, 48, null]) && ['caution', 'minor', 'major'].every((b) => bl.perBand[b].source === 'override'), J(vals(bl)));
  const recs = V.S.overrides.filter((o) => o.plant === 'manesar' && o.target.kind === 'zone' && o.target.sensorId === 'bl1_amps' && o.status === 'active');
  check('derived', 'V72-4 · its three records carry baseSource derived', recs.length === 3 && recs.every((o) => o.baseSource === 'derived'), recs.map((o) => o.baseSource).join(','));
  const vb = z('vedanta', 'v_bl1_AMP', 'above'); const vp = z('vedanta', 'v_p1_AMP', 'above'); const bw = z('bawal', 'sc_p1_AMP', 'above');
  const der = (zi) => ['caution', 'minor', 'major'].every((b) => zi.perBand[b].source === 'derived' && zi.perBand[b].chip.tone === 'der');
  check('derived', 'V72-5 · Vedanta BL-1 20.0 / 21.0 / 23.0 A, P-1 6.7 / 7.0 / 7.7 A; Bawal RW-1 10.0 / 10.5 / 11.5 A; all Derived', J(vals(vb)) === J([20, 21, 23]) && J(vals(vp)) === J([6.7, 7, 7.7]) && J(vals(bw)) === J([10, 10.5, 11.5]) && der(vb) && der(vp) && der(bw), `${J(vals(vb))} ${J(vals(vp))} ${J(vals(bw))}`);
  check('derived', 'its chip: "Derived · 105% of full-load current (20.0 A, 11 kW motor)"', vb.perBand.minor.chipText === 'Derived · 105% of full-load current (20.0 A, 11 kW motor)', vb.perBand.minor.chipText);
  const le = z('manesar', 'eq1_lvl', 'above'); const lv = z('vedanta', 'v_eq1_LVL', 'above');
  check('derived', 'V72-6 · Manesar LVL-EQ1: Caution 85 (3.4 m), Major 95 (3.8 m), Derived · 85% of tank height (4.0 m)', le.bands.caution === 85 && le.perBand.caution.metres === 3.4 && le.bands.major === 95 && le.perBand.major.metres === 3.8 && le.perBand.caution.chipText === 'Derived · 85% of tank height (4.0 m)', `${le.bands.caution}/${le.perBand.caution.metres} ${le.bands.major}/${le.perBand.major.metres} ${le.perBand.caution.chipText}`);
  check('derived', 'V72-6 · Vedanta LVL-EQ-1: 85 / 95 with 3.8 / 4.3 m from the person-entered 4.5 m', lv.bands.caution === 85 && lv.perBand.caution.metres === 3.8 && lv.bands.major === 95 && lv.perBand.major.metres === 4.3 && lv.perBand.caution.chipText === 'Derived · 85% of tank height (4.5 m)', `${lv.perBand.caution.metres} ${lv.perBand.major.metres} ${lv.perBand.caution.chipText}`);
  const ent = V.designParams('vedanta', { kind: 'up', id: 'v_eq1' }).find((r) => r.key === 'tankHeight');
  check('derived', 'the 4.5 m is a person entry on EQ-1 (by Satyadev Singh, Fri 23 Oct 2026 10:40), used by the level limits', ent && ent.value === 4.5 && ent.source === 'person' && ent.by === 'Satyadev Singh' && V.fmt(ent.at) === 'Fri 23 Oct, 10:40' && ent.usedByText === 'Level limits on LVL-EQ-1', ent && J([ent.value, ent.source, ent.by, ent.usedByText]));
  const vl = V.activity({ plant: 'vedanta' }).find((a) => /^Design parameter on EQ-1/.test(a.text));
  check('derived', 'Vedanta Activity, Fri 23 Oct 10:40: "Design parameter on EQ-1: tank height none → 4.5 m (1 reading resolved): Read off the drawing …"', vl && vl.text === 'Design parameter on EQ-1: tank height none → 4.5 m (1 reading resolved): Read off the drawing during the bindings pass: the plant graph has no height for EQ-1' && V.fmt(vl.at) === 'Fri 23 Oct, 10:40' && vl.who === 'Satyadev Singh', vl && vl.text);
  const fl = V.conditionOf('manesar', 'w_intake');
  check('derived', 'the Blower\'s Clean intake filter resolves 38.0 / 34.0 A from BL-1\'s 40.0 A, and Manesar keeps its 42 / 38 A as overrides', fl.perField.doWhen.resolved === 38 && fl.perField.doneWhen.resolved === 34 && fl.doWhen === 42 && fl.doneWhen === 38 && fl.perField.doWhen.overrideId && fl.perField.doneWhen.overrideId, J([fl.perField.doWhen.resolved, fl.perField.doneWhen.resolved, fl.doWhen, fl.doneWhen]));
  const v3 = V.conditionOf('vedanta', 'w_3z');
  check('derived', 'Vedanta\'s BL-1 job follows the rule: 19.0 / 17.0 A, Derived', v3 && v3.doWhen === 19 && v3.doneWhen === 17 && v3.perField.doWhen.source === 'derived', v3 && J([v3.doWhen, v3.doneWhen, v3.perField.doWhen.chipText]));
}

/* ── 4. gaps (V72-26) and the design-parameter editor (V72-27, V72-28) ── */
{
  const dp = 'digitalpaani';
  check('gaps', 'V72-26 · before DigitalPaani\'s structure pass is confirmed nothing is listed: its bindings are not proposed yet', V.limitGaps(dp).length === 0);
  if (typeof V.checklist === 'function') { const cl = safe(() => V.checklist(dp), null); check('gaps', 'V72-26 · and its checklist has no nolimits gap', cl && !(cl.gaps || []).some((g) => g.id === 'nolimits'), cl && J((cl.gaps || []).map((g) => g.id))); }
  const zc = z(dp, sensorId(dp, 'LVL-CCT'), 'above');
  check('gaps', 'the zone already shows "Gap · needs tank height (CCT)" with nothing in force', BANDS.every((b) => zc.bands[b] == null) && zc.perBand.caution.chipText === 'Gap · needs tank height (CCT)' && zc.perBand.caution.needs.param === 'tankHeight', zc.perBand.caution.chipText);
  const others = ['vedanta', 'manesar', 'bawal'].map((k) => V.limitGaps(k));
  check('gaps', 'V72-26 · no other plant has a parameter gap at seed; Vedanta\'s one gap is a reading with no rule (TEMP-AN-1)', others.every((g) => !g.some((x) => x.why === 'param')) && others[0].length === 1 && others[0][0].why === 'norule' && others[0][0].tag === 'TEMP-AN-1' && others[1].length === 0 && others[2].length === 0, J(others.map((g) => g.map((x) => `${x.tag}/${x.why}`))));
  /* confirm the structure pass: accept every proposal and mark the rest not part of any unit process */
  const acc = V.acceptStructure(dp, { all: true }); const un = V.structurePass(dp).unclassified.map((x) => x.eqId); const np = V.notPart(dp, un, {});
  check('gaps', 'the structure pass confirmed through the structure file', acc.ok && np.ok && V.structureDone(dp), `${acc.ok} ${np.ok} ${V.structureDone(dp)}`);
  const g = V.limitGaps(dp);
  check('gaps', 'V72-26 · then limitGaps lists LVL-CCT, LVL-TWT and LVL-UFWT, each needing the tank height', J(g.map((x) => x.tag)) === J(['LVL-CCT', 'LVL-TWT', 'LVL-UFWT']) && g.every((x) => x.why === 'param' && x.param === 'tankHeight' && /\/details\?f=dp\.tankHeight$/.test(x.link)), J(g.map((x) => `${x.tag}/${x.why}/${x.param}`)));
  if (typeof V.checklist === 'function') { const cl = safe(() => V.checklist(dp), null); const nl = cl && (cl.gaps || []).find((x) => x.id === 'nolimits'); check('gaps', 'the checklist now has the nolimits gap with the same count', nl && (nl.count === 3 || (nl.items || []).length === 3), nl && J(nl)); }
  const cct = nodeId(dp, 'CCT'); const lid = sensorId(dp, 'LVL-CCT');
  const pv = V.designParamPreview(dp, { kind: 'up', id: cct }, 'tankHeight', 3.5);
  check('params', 'V72-27 · the preview before saving: "LVL-CCT: Caution none → 85% (3.0 m) · Major none → 95% (3.3 m)" and "1 gap resolved"', pv.ok && pv.lines.includes('LVL-CCT: Caution none → 85% (3.0 m) · Major none → 95% (3.3 m)') && pv.lines.includes('1 gap resolved') && pv.gapsCleared === 1, J(pv.lines));
  const h0 = stateHash();
  check('params', 'the preview changes nothing', stateHash() === h0);
  const r = V.setDesignParam(dp, { kind: 'up', id: cct }, 'tankHeight', 3.5, {});
  const zc2 = z(dp, lid, 'above');
  check('params', 'V72-27 · setDesignParam 3.5 m on CCT resolves LVL-CCT to 85 (3.0 m) / 95 (3.3 m) and clears its gap', r.ok && zc2.bands.caution === 85 && zc2.perBand.caution.metres === 3 && zc2.bands.major === 95 && zc2.perBand.major.metres === 3.3 && V.limitGaps(dp).length === 2, r.error || J([zc2.bands.caution, zc2.perBand.caution.metres, zc2.bands.major, zc2.perBand.major.metres]));
  check('params', 'toast "Tank height 3.5 m saved on CCT · 1 reading re-resolved" and Activity "Design parameter on CCT: tank height none → 3.5 m (1 reading resolved)"', r.toast === 'Tank height 3.5 m saved on CCT · 1 reading re-resolved' && actLast(dp) === 'Design parameter on CCT: tank height none → 3.5 m (1 reading resolved)', `${r.toast} | ${actLast(dp)}`);
  check('params', 'the shared counter is untouched; the Undo token comes from the undo counter', V.S.seq === 202 && /^u_\d+$/.test(r.token), `${V.S.seq} ${r.token}`);
  const u = V.undoDesignParam(dp, r.token);
  check('params', 'V72-27 · Undo restores the gap', u.ok && V.limitGaps(dp).length === 3 && z(dp, lid, 'above').bands.caution == null && !V.canUndoDesignParam(dp, r.token), u.error);
  const n0 = V.setDesignParam('manesar', { kind: 'eq', id: 'bl1' }, 'motorRating', 18.5, {});
  check('params', 'V72-28 · replacing a survey value without a note fails "Say why this differs from the survey."', !n0.ok && n0.error === 'Say why this differs from the survey.', n0.error);
  const bad = [V.setDesignParam(dp, { kind: 'up', id: cct }, 'tankHeight', 25, {}), V.setDesignParam(dp, { kind: 'up', id: cct }, 'tankHeight', -1, {}), V.setDesignParam('manesar', { kind: 'eq', id: 'bl1' }, 'fullLoadCurrent', 30, { note: 'x' })];
  check('params', 'a tank height over 20 m, a negative number and the derived full-load current are refused', bad.every((x) => !x.ok) && bad[0].error === 'Tank height must be 20 m or less.' && bad[1].error === 'Give a positive number.' && /set the motor rating instead/.test(bad[2].error), bad.map((x) => x.error).join(' | '));
  const rows = V.designParams('manesar', { kind: 'eq', id: 'bl1' });
  check('params', 'BL-1\'s Design parameters: motor rating 22 kW (Survey), full-load current 40.0 A (Derived), each used by AMP-BL1 and the intake-filter job', rows[0].key === 'motorRating' && rows[0].valueText === '22 kW' && rows[0].chipText === 'Survey' && rows[1].key === 'fullLoadCurrent' && rows[1].valueText === '40.0 A' && rows[1].chipText === 'Derived · from the 22 kW motor at 415 V' && /AMP-BL1/.test(rows[0].usedByText) && /Clean intake filter on BL-1/.test(rows[0].usedByText), J(rows.map((x) => [x.key, x.valueText, x.chipText, x.usedByText])));
  const pr = V.designParams('manesar', { kind: 'plant' });
  check('params', 'the plant\'s Details: rated flow and the discharge consent limits, each "Used by no limit rule yet"', pr.length === 4 && pr[0].label === 'Rated flow' && pr.every((x) => x.usedByText === 'Used by no limit rule yet' && x.value == null));
  V.reset();
}

/* ── 5. the BL-1 motor-rating preview (V72-103) ── */
{
  const before = stateHash();
  const pv = V.designParamPreview('manesar', { kind: 'eq', id: 'bl1' }, 'motorRating', 18.5);
  const amp = pv.overrides.filter((o) => o.sensorId === 'bl1_amps').map((o) => [o.band, o.keeps, o.baseFrom, o.baseTo]);
  const job = pv.overrides.filter((o) => o.workId === 'w_intake').map((o) => [o.which, o.keeps, o.baseFrom, o.baseTo]);
  check('preview', 'V72-103 · AMP-BL1 keeps 44 A (and 48 A, none) with base moved 40.0 → 33.6, 42.0 → 35.3, 46.0 → 38.6 A', J(amp) === J([['caution', 44, 40, 33.6], ['minor', 48, 42, 35.3], ['major', null, 46, 38.6]]), J(amp));
  check('preview', 'V72-103 · Clean intake filter keeps 42 / 38 A with base moved 38.0 → 31.9 and 34.0 → 28.6 A', J(job) === J([['doWhen', 42, 38, 31.9], ['doneWhen', 38, 34, 28.6]]), J(job));
  check('preview', 'its lines: "AMP-BL1 keeps 44 A (Override): base moved 40.0 → 33.6 A …", "Clean intake filter on BL-1 keeps 42 A / 38 A (Override): base moved 38.0 → 31.9 A / 34.0 → 28.6 A", "Motor current high · BL-1 follows AMP-BL1"', /^AMP-BL1 keeps 44 A \(Override\): base moved 40\.0 → 33\.6 A/.test(pv.lines[0]) && pv.lines.includes('Clean intake filter on BL-1 keeps 42 A / 38 A (Override): base moved 38.0 → 31.9 A / 34.0 → 28.6 A') && pv.lines.includes('Motor current high · BL-1 follows AMP-BL1'), J(pv.lines));
  check('preview', 'V72-103 · Cancel changes nothing', stateHash() === before);
  const ok = V.setDesignParam('manesar', { kind: 'eq', id: 'bl1' }, 'motorRating', 18.5, { note: 'The motor was swapped for a smaller one' });
  const bl = z('manesar', 'bl1_amps', 'above'); const o1 = V.S.overrides.find((o) => o.plant === 'manesar' && o.target.kind === 'zone' && o.target.sensorId === 'bl1_amps' && o.target.band === 'caution');
  check('preview', 'saved with a note: the plant keeps 44 A and its override shows Base moved', ok.ok && bl.bands.caution === 44 && bl.perBand.caution.resolved === 33.6 && V.ovState(o1) === 'basemoved' && /^Design parameter on BL-1: motor rating 22 → 18\.5 kW \(1 reading re-resolved\): The motor was swapped/.test(actLast('manesar')), `${ok.error || ''} ${actLast('manesar')}`);
  V.reset();
}

/* ── 6. hand tests have no Zones (V72-90); the Readings tab (V72-91) ── */
{
  const ERR = 'Hand-test results stay in the task record: they have no sensor, so no Zones.';
  const a = V.setLimits('manesar', 'm:s_do_cal', 'below', { minor: 2 }, { reason: 'tuning', note: 'x' });
  const b = V.setZone('manesar', 'm:s_do_cal', 'below', 'minor', 2, { reason: 'tuning', note: 'x' });
  check('readings', 'V72-90 · setLimits and setZone on a hand-test id fail with the hand-test sentence; so does zoneCheck', !a.ok && a.error === ERR && !b.ok && b.error === ERR && V.zoneCheck('manesar', 'm:s_do_cal', 'below', {}) === ERR && V.zoneInfo('manesar', 'm:s_do_cal') === null, `${a.error} | ${b.error}`);
  const rv = V.readingsTab('vedanta'); const rm = V.readingsTab('manesar');
  const ids = [...rv.groups, ...rm.groups].flatMap((g) => g.rows.map((r) => r.id));
  check('readings', 'V72-91 · readingsTab: not available at Vedanta (Commissioning), available at Manesar (Live); no row has a manual id', rv.available === false && rm.available === true && ids.length > 0 && ids.every((id) => !String(id).startsWith('m:')) && KEYS.every((k) => V.readings(k).every((r) => !String(r.id).startsWith('m:'))));
  const at2 = rm.groups.find((g) => g.tag === 'AT-2'); const bl1 = rm.groups.find((g) => g.tag === 'BL-1'); const doR = at2 && at2.rows.find((r) => r.tag === 'DO-AT2');
  check('readings', 'grouped by equipment with the unit processes each takes part in: BL-1 "In AT-1, AT-2"; DO-AT2 "Minor below 2.0 mg/L · Major below 1.0 mg/L · Emergency below 0.5 mg/L" with "1 · Edit on sensor"', bl1 && bl1.upsText === 'In AT-1, AT-2' && doR && doR.limitsText === 'Minor below 2.0 mg/L · Major below 1.0 mg/L · Emergency below 0.5 mg/L' && doR.triggerText === '1 · Edit on sensor' && doR.href === '#/p/manesar/sensor/at2_do', doR && J([bl1 && bl1.upsText, doR.limitsText, doR.triggerText]));
  const cdu = rm.groups.find((g) => g.tag === 'CDU-1'); const tl = cdu && cdu.rows.find((r) => r.tag === 'TLVL-CDU');
  check('readings', 'a reading with no rule carries "Gap · no rule" beside its overrides (CDU-1 chemical level)', tl && tl.chips.some((c) => c.text === 'Gap · no rule') && tl.chips.some((c) => /^Override · Migrated/.test(c.text)), tl && J(tl.chips.map((c) => c.text)));
}

/* ── 7. the resolution order (V72-101): Forced → Override → Derived → Library or pinned → Gap ── */
{
  V.reset();
  const ma = z('manesar', 'bl1_amps', 'above').perBand.caution;
  check('order', 'V72-101 · Override beats Derived: AMP-BL1 Caution 44 in force over the derived 40.0', ma.source === 'override' && ma.value === 44 && ma.resolved === 40, J([ma.source, ma.value, ma.resolved]));
  const rec = V.S.overrides.find((o) => o.id === ma.overrideId); const rv = V.revert(rec.id);
  const ma2 = z('manesar', 'bl1_amps', 'above').perBand.caution;
  check('order', 'V72-101 · without it Derived is in force (40.0 A)', rv.ok && ma2.source === 'derived' && ma2.value === 40, rv.error || J([ma2.source, ma2.value]));
  const lib = z('vedanta', 'v_dt1_LVL', 'below').perBand.caution; const gap = z('digitalpaani', sensorId('digitalpaani', 'LVL-TWT'), 'above').perBand.caution; const none = z('vedanta', 'v_an1_TEMP', 'above').perBand.caution;
  check('order', 'V72-101 · a constant is Library; a rule with no parameter is a Gap; a reading with no template is "Gap · no rule"', lib.source === 'library' && lib.value === 25 && gap.source === 'gap' && gap.value == null && none.source === 'none' && none.chipText === 'Gap · no rule', J([lib.source, gap.source, none.source]));
  V.reset();
  const tid = 'tpl_BLW_motor-current-high';
  const pn = V.pin('vedanta', tid, { reason: 'Vedanta\'s blowers are old; keep the current limits until the overhaul' });
  V.editTemplate(tid, { band: 'caution', rule: { kind: 'expr', factor: 0.95, param: 'fullLoadCurrent' } });
  const pm = V.publishTemplate(tid, { note: 'Warn earlier on every blower' });
  const vc = z('vedanta', 'v_bl1_AMP', 'above').perBand.caution; const mc = z('manesar', 'bl1_amps', 'above').perBand.caution;
  check('order', 'V72-101 · a pinned plant stays on its version: Vedanta BL-1 Caution 20.0 A "Pinned to v1 · v2 changes this to 19.0 A"; Manesar\'s base moves to 38.0', pn.ok && pm.ok && vc.source === 'pinned' && vc.value === 20 && vc.pinnedNext === 19 && vc.chipText === 'Pinned to v1 · v2 changes this to 19.0 A' && mc.resolved === 38, `${pn.error || ''}${pm.error || ''} ${J([vc.source, vc.value, vc.pinnedNext, vc.chipText, mc.resolved])}`);
  const so = V.setZone('vedanta', 'v_bl1_AMP', 'above', 'emergency', 25, { reason: 'tuning', note: 'Warn before the breaker trips' });
  const oe = z('vedanta', 'v_bl1_AMP', 'above').perBand.emergency;
  check('order', 'V72-101 · Override beats Library or pinned (an Emergency band of Vedanta\'s own)', so.ok && oe.source === 'override' && oe.value === 25, so.error || J([oe.source, oe.value]));
  V.editTemplate(tid, { band: 'emergency', rule: { kind: 'const', value: 50 } });
  const dv = V.templateDraft(tid); const pf = V.publishTemplate(tid, { kind: 'forced', note: 'A ceiling for every blower', reason: 'Motor protection standard' });
  const fe = z('vedanta', 'v_bl1_AMP', 'above').perBand.emergency;
  check('order', 'V72-101 · Forced beats Override, pinned plants included: Emergency 50 A in force, the override kept and suspended', dv.suggestedKind === 'forced' && pf.ok && fe.source === 'forced' && fe.value === 50 && fe.suspended === true && fe.chipText === 'Forced by library · Motor current high v3' && V.S.overrides.find((o) => o.id === so.id).status === 'active', `${pf.error || ''} ${J([fe.source, fe.value, fe.suspended, fe.chipText])}`);
  V.reset();
}

/* ── 8. the shapes the ledger reads ── */
{
  const zi = z('manesar', 'at1_mlss', 'below'); const pb = zi.perBand.minor;
  check('shapes', 'zoneInfo carries templateId, templateVersion and, per band, resolved, rule, needs and metres; every chip from the one formatter', zi.templateId === 'tpl_up_activated-sludge_mlss-low' && zi.templateVersion === 1 && pb.resolved === 2000 && pb.rule.kind === 'const' && 'needs' in pb && 'metres' in pb && BANDS.every((b) => zi.perBand[b].chip && typeof zi.perBand[b].chip.text === 'string' && zi.perBand[b].chipText === zi.perBand[b].chip.text), J(pb));
  const tm = V.timingOf('manesar', 'a_mlss_hi', 'hold'); const cd = V.cadenceOf('manesar', 's_bl1_pm');
  check('shapes', 'timingOf and cadenceOf give the value in force and the resolved base (MLSS high · AT-1 persistence 30 over 5; Bearing service every 6 months)', tm.value === 30 && tm.resolved === 5 && tm.source === 'override' && cd.resolved && cd.resolved.n === 6 && cd.resolved.unit === 'month' && cd.chipText === 'Library · Bearing service v1', J([tm.value, tm.resolved, cd.chipText]));
  const su = V.cadenceOf('manesar', 's_hypo');
  check('shapes', 'a single-use Task\'s cadence chip: "Library · Chemical refill v1" with "Single-use · Manesar STP only"', su.chip.text === 'Library · Chemical refill v1' && su.chip.extra && su.chip.extra[0].text === 'Single-use · Manesar STP only', J(su.chip));
  const cal = V.cadenceOf('manesar', 's_do_cal'); const frm = V.cadenceOf('vedanta', 's_5b');
  check('shapes', 'a probe calibration follows its type monthly; a Task the survey adds is "Derived · from the survey: Screw Pump"', cal.resolved.n === 1 && cal.resolved.unit === 'month' && /^Library · Activated sludge v1$/.test(cal.chipText) && frm && frm.chipText === 'Derived · from the survey: Screw Pump', `${cal.chipText} | ${frm && frm.chipText}`);
  const tn = ['a_do_at2', 'a_mlss_hi', 'a_flood', 'a_blanket'].map((id) => V.triggerName('manesar', id));
  check('shapes', 'Trigger names: "{template} · {subject tag}"', J(tn) === J(['DO low · AT-2', 'MLSS high · AT-1', 'Sump flooding · EQ-1', 'Sludge blanket high · SC-1']), J(tn));
}

report();
function report() {
  const groups = [...new Set(results.map((r) => r.group))];
  console.log(`limits72.test · ${results.length - fails}/${results.length} pass · ${Date.now() - t0} ms`);
  for (const g of groups) {
    const rs = results.filter((r) => r.group === g); const bad = rs.filter((r) => !r.ok);
    console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(12)} ${rs.length - bad.length}/${rs.length}`);
    rs.filter((r) => !r.ok || VERBOSE).forEach((r) => console.log(`       ${r.ok ? '·' : '✗'} ${r.name}${r.detail != null ? `  [${String(r.detail).slice(0, 400)}]` : ''}`));
  }
  console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
  process.exit(fails ? 1 : 0);
}
