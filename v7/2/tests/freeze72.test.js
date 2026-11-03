#!/usr/bin/env node
/* v7/2 · tests/freeze72.test.js — headless test of the freeze: an open Issue holds its Trigger's terms (bands, persistence,
   clearing, template version); changes skip it and show as Base moved; closing the Issue releases a Trigger whose terms did not
   move and keeps the others waiting for a person to resync; a Forced change skips a Trigger with an open Issue and reaches one
   that only waits for a resync, on the forced band; a new Issue meanwhile opens under the held terms.
   Node only, no dependencies; loads the whole v7/2 stack through tests/load72.js.
   Usage: TZ=Asia/Calcutta node tests/freeze72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const VERBOSE = process.argv.includes('-v');
const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail: detail == null ? undefined : String(detail) }); if (!ok) fails++; }
const J = (x) => JSON.stringify(x);

const t0 = Date.now();
const L = require('./load72.js'); const V = L.V7; const __ = V && V.__;
check('load', 'the v7/2 stack loads and boots with the library file', !!V && L.loaded.includes('core72-library.js') && !L.errors.length, L.errors.map((e) => `${e.file}: ${e.error.slice(0, 200)}`).join(' | '));
if (!V || !L.loaded.includes('core72-library.js')) report();
const K = 'manesar'; const A = 'a_do_at2'; const SID = 'at2_do';
const NOTE = 'Short dips below 2.0 recover on their own; 1.5 is where the operators act';
const bands = (x) => J([x.caution, x.minor, x.major, x.emergency]);
const terms = () => __.termsFor(K, A);
const held = () => (V.S.held && V.S.held[K] ? V.S.held[K][A] : null);
const lastAct = () => (V.activity({ plant: K, limit: 1 })[0] || {}).text;
const tightenMinor = () => V.setZone(K, SID, 'below', 'minor', 1.5, { reason: 'tuning', note: NOTE });

/* ── 1. at the story's start (V72-78) ── */
{
  const h = V.heldOf(K, A);
  check('seed', 'V72-78 · DO low · AT-2 is frozen: its Issue is_2z is open', V.isFrozen(K, A) && h.frozen && !h.waiting && J(h.openIssueIds) === J(['is_2z']), J(h));
  check('seed', 'V72-78 · its held terms: Minor 2.0 · Major 1.0 · Emergency 0.5, persistence 0, clearing 15, template v1', bands(h.terms.bands) === J([null, 2, 1, 0.5]) && h.terms.hold === 0 && h.terms.clear === 15 && h.templateVersion === 1 && h.since === V.issue(K, 'is_2z').opened, J(h.terms));
  check('seed', 'the hold was built by the engine as the Issue opened, and nothing moved since', held() && held().movedAt === null && held().released === null && h.diffs.length === 0);
  const others = Object.keys(V.S.held || {}).flatMap((k) => Object.keys(V.S.held[k]).map((id) => `${k}:${id}`));
  check('seed', 'every closed historic Issue released its hold: DO low · AT-2 is the only held Trigger', J(others) === J(['manesar:a_do_at2']), J(others));
  check('seed', 'nothing is held at a Commissioning plant (no Issues there)', !(V.S.held || {}).vedanta && !(V.S.held || {}).digitalpaani);
  const d = V.deviationCounts(K);
  check('seed', 'Deviations counts it as 1 frozen, 0 waiting for a resync', d.frozen === 1 && d.waitingResync === 0, J(d));
}

/* ── 2. a zone change while frozen (V72-79) ── */
{
  const pvL = typeof V.overridePreview === 'function' ? V.overridePreview(K, { kind: 'zone', sensorId: SID, dir: 'below', band: 'minor' }, 1.5) : null;
  const zb = { ...V.zoneInfo(K, SID, 'below').bands, minor: 1.5 };
  const pl = V.previewLimits(K, SID, 'below', zb, { days: 7 });
  if (pvL) {
    check('frozen', 'V72-79 · the preview names the frozen Trigger: "Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved)."', pvL.lines[0] === 'Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved).', pvL.lines[0]);
    check('frozen', `V72-79 · and reads "Last 7 days: would have fired ${pl.count} times (now ${pl.countNow})." (= previewLimits: 2 and 3)`, pvL.lines[1] === `Last 7 days: would have fired ${pl.count} times (now ${pl.countNow}).` && pl.count === 2 && pl.countNow === 3, `${pvL.lines[1]} · ${pl.count}/${pl.countNow}`);
    check('frozen', 'with the frozen line "DO low · AT-2 has 1 open Issue: it is frozen and keeps 2.0. It will show Base moved until someone resyncs it." and "Close it as a false alarm"', pvL.frozenLines.length === 1 && pvL.frozenLines[0].text === 'DO low · AT-2 has 1 open Issue: it is frozen and keeps 2.0. It will show Base moved until someone resyncs it.' && pvL.frozenLines[0].href === '#/p/manesar/issue/is_2z?close=false-alarm', pvL.frozenLines[0] && pvL.frozenLines[0].text);
  }
  const r = tightenMinor();
  check('frozen', 'V72-79 · the override saves: zoneInfo reads 1.5 while triggerTerms keeps 2.0', r.ok && V.zoneInfo(K, SID, 'below').bands.minor === 1.5 && terms().bands.minor === 2 && terms().held === true, r.error || `${V.zoneInfo(K, SID, 'below').bands.minor} ${terms().bands.minor}`);
  check('frozen', 'the save names the frozen Trigger and stamps its hold: the base moved', r.frozen && r.frozen.length === 1 && r.frozen[0].alertId === A && held().movedAt === V.now(), J(r.frozen));
  const tb = V.triggerBands(K, A).bands.minor;
  check('frozen', 'the Trigger page\'s Minor: 2.0 "Frozen while 1 Issue is open", "DO-AT2 now 1.5 (Override · Tuning)"', tb.valueText === '2.0 mg/L' && tb.overlayText === 'Frozen while 1 Issue is open' && tb.nowText === 'DO-AT2 now 1.5 (Override · Tuning)', J([tb.valueText, tb.overlayText, tb.nowText]));
  const issT = V.issueTerms(K, 'is_2z');
  check('frozen', 'the Issue still reads "Opened under: Major < 1.0 mg/L · persistence 0 min · clearing 15 min" with nothing changed under it', issT.text === 'Opened under: Major < 1.0 mg/L · persistence 0 min · clearing 15 min' && !issT.changed, issT.text);
  /* V72-80: the Trigger's own settings are refused while frozen; resync waits for the Issue to close */
  const st = V.setAlertTiming(K, A, { clear: 10 }, { reason: 'tuning', note: 'Clears faster than the old 15 min' });
  const tl = V.setTriggerLimit(K, A, 'minor', 1.8, { reason: 'tuning', note: 'This basin alone' });
  check('frozen', 'V72-80 · setAlertTiming and setTriggerLimit on the frozen Trigger fail: code frozen, "This Trigger is frozen while its Issue is open."', !st.ok && st.code === 'frozen' && st.error === 'This Trigger is frozen while its Issue is open.' && !tl.ok && tl.code === 'frozen' && tl.error === st.error, `${st.error} | ${tl.error}`);
  const rs = V.resync(K, A); const rp = V.resyncPreview(K, A);
  check('frozen', 'V72-80 · resync fails while an Issue is open: "Resync after the Issue closes."', !rs.ok && rs.error === 'Resync after the Issue closes.' && !rp.ok && rp.error === rs.error, rs.error);
}

/* ── 3. closing: kept when its terms moved, released when not (V72-81) ── */
{
  V.advance(60);
  const c = V.close(K, 'is_2z', { note: 'Back above 2.0 after the filter clean' });
  const h = V.heldOf(K, A);
  check('close', 'V72-81 · closing the Issue after a divergence keeps the hold: waiting for a resync', c.ok && h.held && !h.frozen && h.waiting && h.released === V.now() && terms().bands.minor === 2, J(h));
  check('close', 'its diffs: "Minor below 2.0 → 1.5 mg/L (Override · Tuning)"', J(h.diffs.map((x) => x.line)) === J(['Minor below 2.0 → 1.5 mg/L (Override · Tuning)']), J(h.diffs.map((x) => x.line)));
  const tb = V.triggerBands(K, A).bands.minor;
  check('close', 'the Trigger page: "Base moved · waits for a resync"; Deviations counts 1 waiting, 0 frozen', tb.overlayText === 'Base moved · waits for a resync' && V.deviationCounts(K).waitingResync === 1 && V.deviationCounts(K).frozen === 0, tb.overlayText);
  const t2 = V.setAlertTiming(K, A, { clear: 10 }, { reason: 'tuning', note: 'x' });
  check('close', 'its own settings now say "Resync this Trigger first …" (code resync)', !t2.ok && t2.code === 'resync', t2.error);
  V.reset();
  const c2 = V.close(K, 'is_2z', { note: 'A quick false start' });
  check('close', 'V72-81 · closing without a divergence deletes the hold: the Trigger follows its sensor again', c2.ok && !held() && !V.heldOf(K, A).held && !(V.S.held && V.S.held[K]) && terms().held === false, J(V.S.held));
  V.reset();
}

/* ── 4. resync (V72-82, V72-104) ── */
{
  tightenMinor(); V.advance(60); V.close(K, 'is_2z', { note: 'Back above 2.0 after the filter clean' });
  const live = __.termsFor(K, A, { live: true }); const heldT = terms();
  const n = V.replay(K, A, { from: V.now() - 7 * 864e5, to: V.now(), limits: live.bands, hold: live.hold, clear: live.clear }).count; const m = V.replay(K, A, { from: V.now() - 7 * 864e5, to: V.now() }).count;
  const p = V.resyncPreview(K, A);
  check('resync', 'V72-104 · the resync modal: "Resync DO low · AT-2?" with "Minor below 2.0 → 1.5 mg/L (Override · Tuning)"', p.ok && p.title === 'Resync DO low · AT-2?' && J(p.lines) === J(['Minor below 2.0 → 1.5 mg/L (Override · Tuning)']), J(p));
  check('resync', `V72-104 · and the computed "Last 7 days with these terms: would have fired ${n} times (now ${m})."`, p.lastDaysText === `Last 7 days with these terms: would have fired ${n} ${n === 1 ? 'time' : 'times'} (now ${m}).` && p.lastDays.count === n && p.lastDays.countNow === m && heldT.bands.minor === 2, p.lastDaysText);
  const r = V.resync(K, A);
  const zb = V.zoneInfo(K, SID, 'below').bands; const tm = terms();
  check('resync', 'V72-82 · after resync the Trigger runs on its zones (Minor 1.5) and the current template version', r.ok && !held() && bands(tm.bands) === bands(zb) && tm.bands.minor === 1.5 && tm.templateVersion === V.tplVersion('tpl_up_activated-sludge_do-low') && V.alert(K, A).templateVersion === 1, r.error || J(tm));
  check('resync', 'V72-82 · toast "Resynced DO low · AT-2 · now follows DO-AT2"; Activity "Resynced DO low · AT-2 with DO-AT2: Minor below 2.0 → 1.5 mg/L; now on DO low v1"', r.toast === 'Resynced DO low · AT-2 · now follows DO-AT2' && lastAct() === 'Resynced DO low · AT-2 with DO-AT2: Minor below 2.0 → 1.5 mg/L; now on DO low v1', `${r.toast} | ${lastAct()}`);
  check('resync', 'a Trigger that is not held cannot be resynced', !V.resyncPreview(K, A).ok && !V.resync(K, 'a_mlss_hi').ok);
  V.reset();
}

/* ── 5. a library change while held: skipped while frozen, Base moved after (and a Minor change) ── */
{
  const tid = 'tpl_up_activated-sludge_do-low';
  V.editTemplate(tid, { band: 'minor', rule: { kind: 'const', value: 1.8 } });
  const ds = V.downstream(tid);
  const frozenF = ds.fields[0].classes.frozen.map((x) => x.line);
  check('library', 'a Minor change while the Issue is open lists the Trigger "1 frozen · wait for open Issues" → "Manesar STP · DO low · AT-2"', ds.totals.frozen === 1 && J(frozenF) === J(['Manesar STP · DO low · AT-2']) && ds.fields[0].groups.some((g) => g.head === '1 frozen · wait for open Issues'), J(ds.fields[0].groups.map((g) => g.head)));
  const pub = V.publishTemplate(tid, { note: 'Plants run well down to 1.8' });
  check('library', 'published: the zones move (DO-AT2 Minor 1.8 Library v2), the frozen Trigger keeps 2.0 on v1, its hold stamped', pub.ok && V.zoneInfo(K, SID, 'below').bands.minor === 1.8 && terms().bands.minor === 2 && V.heldOf(K, A).templateVersion === 1 && V.heldOf(K, A).currentVersion === 2 && held().movedAt === V.now() && /1 frozen skipped/.test(pub.toast), pub.error || pub.toast);
  V.close(K, 'is_2z', { note: 'Fixed' });
  const h = V.heldOf(K, A);
  check('library', 'after the close it waits for a resync with "Minor below 2.0 → 1.8 mg/L" and "Template v1 → v2"', h.waiting && h.diffs.map((x) => x.text).join(' | ') === 'Minor below 2.0 → 1.8 mg/L | Template v1 → v2', J(h.diffs.map((x) => x.text)));
  V.reset();
}

/* ── 6. a Forced change: skips the frozen Trigger, reaches the waiting one on its forced band (V72-96, the held part) ── */
{
  const tid = 'tpl_up_activated-sludge_do-low';
  V.editTemplate(tid, { band: 'emergency', rule: { kind: 'const', value: 0.8 } });
  const p1 = V.publishTemplate(tid, { note: 'A higher floor everywhere', reason: 'Low DO killed the biology at two plants' });
  check('forced', 'V72-96 · at the story\'s start (Issue open) the Forced change skips DO low · AT-2: it keeps Emergency 0.5, no forced band', p1.ok && terms().bands.emergency === 0.5 && J(V.heldOf(K, A).forcedBands) === J([]) && V.zoneInfo(K, SID, 'below').bands.emergency === 0.8 && p1.landed.totals.frozen === 1, p1.error || J(terms().bands));
  V.reset();
  tightenMinor(); V.advance(60); V.close(K, 'is_2z', { note: 'Back above 2.0 after the filter clean' });
  V.editTemplate(tid, { band: 'emergency', rule: { kind: 'const', value: 0.8 } });
  const ds = V.downstream(tid); const upd = ds.fields[0].classes.update.map((x) => x.line);
  check('forced', 'Downstream: "Manesar STP · DO low · AT-2: Emergency 0.5 → 0.8 mg/L · its other terms still wait for a resync"', upd.includes('Manesar STP · DO low · AT-2: Emergency 0.5 → 0.8 mg/L · its other terms still wait for a resync') && upd.includes('Manesar STP · DO-AT2: 0.5 → 0.8 mg/L'), J(upd));
  const p2 = V.publishTemplate(tid, { note: 'A higher floor everywhere', reason: 'Low DO killed the biology at two plants' });
  const h = V.heldOf(K, A);
  check('forced', 'V72-96 · once the Issue closed and its terms moved, the Forced change reaches the forced band only: forcedBands = [emergency]', p2.ok && J(h.forcedBands) === J(['emergency']) && terms().bands.emergency === 0.8 && terms().bands.minor === 2 && h.waiting, p2.error || J([h.forcedBands, terms().bands]));
  const lf = V.liftForced(tid, { reason: 'The biology recovered' });
  check('forced', 'V72-96 · liftForced gives the held band back (Emergency 0.5); the other held terms never moved', lf.ok && terms().bands.emergency === 0.5 && terms().bands.minor === 2 && J(V.heldOf(K, A).forcedBands) === J([]), J(terms().bands));
  V.reset();
}

/* ── 7. a new Issue on a Trigger still waiting for a resync opens under the held terms ── */
{
  tightenMinor(); V.advance(60); V.close(K, 'is_2z', { note: 'Back above 2.0 after the filter clean' });
  let opened = null;
  for (let i = 0; i < 10 && !opened; i++) { const r = V.advance(1440); const o = r.opened.find((x) => V.issue(K, x.id) && V.issue(K, x.id).alertId === A); if (o) opened = V.issue(K, o.id); }
  check('reopen', 'a new DO low · AT-2 Issue opens under the held Minor 2.0 (the zone says 1.5) and joins the hold', opened && opened.terms.bands.minor === 2 && opened.terms.limit === 2 && held() && held().issueIds.includes(opened.id) && V.zoneInfo(K, SID, 'below').bands.minor === 1.5, opened ? J(opened.terms) : 'no Issue in 10 days');
  check('reopen', 'after it closes the Trigger still waits for a resync (its terms still differ)', !opened || opened.status !== 'closed' || V.heldOf(K, A).waiting, J(V.heldOf(K, A)));
  V.reset();
}

report();
function report() {
  const groups = [...new Set(results.map((r) => r.group))];
  console.log(`freeze72.test · ${results.length - fails}/${results.length} pass · ${Date.now() - t0} ms`);
  for (const g of groups) {
    const rs = results.filter((r) => r.group === g); const bad = rs.filter((r) => !r.ok);
    console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(12)} ${rs.length - bad.length}/${rs.length}`);
    rs.filter((r) => !r.ok || VERBOSE).forEach((r) => console.log(`       ${r.ok ? '·' : '✗'} ${r.name}${r.detail != null ? `  [${String(r.detail).slice(0, 400)}]` : ''}`));
  }
  console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
  process.exit(fails ? 1 : 0);
}
