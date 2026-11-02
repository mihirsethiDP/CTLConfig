#!/usr/bin/env node
/* v7 · object7.test.js — headless checks for B4's object page, limits sheet, value sheets and alert page (node, no deps).
   Loads every asset in prototype.html order with smoke.js's stub DOM, boots the story, then checks the story moments on the
   pages B4 owns and drives the sheets through their state functions (the stub DOM has no querySelector, so the sheet's live
   DOM updates are exercised through lsState / vsState instead). Prints a compact report; exit 1 on any failure.
   Usage: node tests/object7.test.js [-v] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const smoke = require('./smoke.js');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
smoke.installDom();
const ORDER = (() => {
  const html = fs.readFileSync(path.join(ROOT, 'prototype.html'), 'utf8'); const re = /<script[^>]*\bsrc\s*=\s*["']assets\/([^"'?]+)/gi; const out = []; let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
})();
for (const f of ORDER) { const p = path.join(ROOT, 'assets', f); if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p }); }
const W = global; const V = W.V7; const UI = W.V7UI; const O = W.V7OBJ; const T = O._test;
V.reset();

const results = []; let fails = 0;
function ok(name, cond, detail) { results.push({ name, pass: !!cond, detail }); if (!cond) fails++; }
const text = (html) => smoke.visibleText(html);
const render = (p) => UI.renderPath('#/' + p);
function noBanned(name, html) {
  const f = smoke.scan(html, { ids: true }).filter((x) => x.kind !== 'data-word');
  ok(`${name}: no banned words or junk on screen`, !f.length, f.map((x) => `${x.word}: ${x.ctx}`).join(' | '));
}
const el = (attrs) => ({ getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k.replace(/^data-/, '')) ? attrs[k.replace(/^data-/, '')] : null) });
const act = (name, attrs) => UI._handlers[name](el(attrs || {}), {});
const alertNamed = (key, re) => V.alerts(key, {}).find((a) => re.test(a.name));

/* 1 · Vedanta SBR-1: the equipment page during the trial */
{
  const html = render('p/vedanta/eq/v_sbr'); const t = text(html);
  ok('SBR-1 page renders with its four tabs', /Readings/.test(t) && /Issues/.test(t) && /Tasks/.test(t) && /Details/.test(t) && /SBR-1/.test(t));
  ok('SBR-1 shows DO low On trial with its trial rate', /DO low — SBR-1/.test(t) && /On trial/.test(t) && /trial firings a day/.test(t));
  ok('SBR-1 DO low reads "Mostly short", not noisy', /Mostly short/.test(t));
  ok('SBR-1 shows the Sample readings tag and a band bar', /Sample readings/.test(t) && /class="bb[ "]/.test(html));
  ok('SBR-1 flags the undecided MLSS low proposal', /not decided/.test(t));
  noBanned('SBR-1 readings', html);
  for (const tab of ['issues', 'tasks', 'details', 'phone']) noBanned('SBR-1 ' + tab, render('p/vedanta/eq/v_sbr/' + tab));
}

/* 2 · Vedanta alert pages: noisy level, mostly-short DO, the Emergency */
{
  const lvl = alertNamed('vedanta', /Level high — EQ-1/); const dO = alertNamed('vedanta', /DO low — SBR-1/);
  const tl = text(render('p/vedanta/alert/' + lvl.id));
  const ts = V.trialStats('vedanta', lvl.id);
  ok('Level high — EQ-1 page marks it Noisy (> 10 a day)', ts && ts.noisy && /Noisy/.test(tl), ts && ts.perDay);
  ok('Level page has per-day bars and the 10-a-day line', /10 a day/.test(tl) && /trial firings a day/.test(tl));
  ok('Level page says nothing is sent during Commissioning', /nothing is sent/i.test(tl) && /no call and no hooter/.test(tl));
  ok('Level page shows "Start by / fix by follow the severity"', /Start by \/ fix by follow the severity/.test(tl));
  const td = text(render('p/vedanta/alert/' + dO.id));
  ok('DO low — SBR-1 page says "Mostly short", not noisy', /Mostly short/.test(td) && !/Noisy:/.test(td));
  const em = V.issues('vedanta', {}).find((i) => i.commissioning);
  const te = text(render('p/vedanta/alert/' + em.alertId));
  ok('pH alert lists the Commissioning Emergency, told to the Leads with no call', /Commissioning/.test(te) && /no call, no hooter/.test(te));
  ok('All-firings link works (?all=1)', /Show the latest 12|Started/.test(text(render('p/vedanta/alert/' + lvl.id + '?all=1'))));
}

/* 3 · Manesar: open issue banner, SCADA form source, differences */
{
  const t = text(render('p/manesar/eq/at2'));
  ok('AT-2 leads with its open issue', /DO low — AT-2 is open/.test(t) && /Open the issue/.test(t));
  const tb = text(render('p/manesar/eq/bl1'));
  ok('BL-1 motor current shows Changed here with its base', /Changed here/.test(tb) && /(library|SCADA form) /.test(tb));
  const tdd = text(render('p/manesar/eq/bl1/details'));
  ok('BL-1 details list its differences with the reason', /Differences from the library/.test(tdd) && /Not recorded/.test(tdd));
  const al = alertNamed('manesar', /DO low — AT-2/); const ta = text(render('p/manesar/alert/' + al.id));
  ok('Live alert page shows results and the issues it opened', /issues a day/.test(ta) && /closed as false alarms/.test(ta) && /it opened/.test(ta));
  /* round 2 (Q9): Results names its window, and the list says it is all time, so the two counts never seem to disagree */
  { const mR = /Last (\d+) days\. .*?(\d+) issues in that time (\d+) issues? it opened, all time(?: (\d+) of them in the last \d+ days)?/.exec(ta);
    ok('Results and "issues it opened" each name their window, and agree', !!mR && (mR[2] === mR[3] || mR[4] === mR[2]), (ta.match(/Results.{0,260}/) || [''])[0]); }
}

/* 4 · DigitalPaani: real layout, nothing decided */
{
  const esab = V.equipment('digitalpaani').find((e) => e.tag === 'ESAB-1');
  const t = text(render('p/digitalpaani/eq/' + encodeURIComponent(esab.id)));
  ok('ESAB-1 asks for its proposals to be decided', /not decided yet/.test(t) && /Decide them/.test(t));
  const sc = V.equipment('digitalpaani').find((e) => e.typeDiffers);
  const ts = text(render('p/digitalpaani/eq/' + encodeURIComponent(sc.id)));
  ok('A drawn-differently tank says fix it in SCADA', /Drawn as/.test(ts) && /SCADA/.test(ts));
  ok('A tank with no readings explains what waits for them', /SCADA sends no readings/.test(ts));
}

/* 5 · Phone view */
{
  const html = render('p/manesar/eq/at2/phone'); const t = text(html);
  ok('Phone view shows the one thing to do first (the open issue)', /class="phone"/.test(html) && /Open the issue/.test(t) && /Report a problem/.test(t));
  const r = text(render('p/manesar/eq/at2/phone?r=at2_do'));
  ok('Phone reading screen: read-only limits, Change limits opens the same sheet', /Change limits/.test(r) && /read-only/.test(r) && /24 hours ago/.test(r));
}

/* 6 · The type page */
{
  const html = O.render({ mode: 'type', code: 'OS_TANK', tab: 'readings', aside: '<p>ASIDE</p>' }); const t = text(html);
  ok('Type page uses the same tabs and shows Library · version', /Library · version 1/.test(t) && /Readings/.test(t) && /Details/.test(t) && /ASIDE/.test(t));
  ok('Type page says where the reading sits at the plants', /At the plants:/.test(t));
  for (const tab of ['issues', 'tasks', 'details']) noBanned('OS_TANK ' + tab, O.render({ mode: 'type', code: 'OS_TANK', tab }));
}

/* 7 · The limits sheet at a plant: live replay, reason, save → ledger + chip */
{
  const st = T.lsFromInstance('vedanta', 'v_sbr_DO', 'below'); T.setLS(st);
  ok('Limits sheet loads the library values', st && st.cur.minor === 2 && st.base.minor === 2);
  st.vals.minor = '1.8';
  const v = T.lsState(st);
  ok('Typing 1.8 marks Minor "Changed here" and asks why', /Changed here/.test(v.view.minor.chip) && v.needsWhy && /Library 2\.0/.test(v.view.minor.ref));
  const p = T.lsPreviewText(st, v.bands, v.err);
  ok('Live "Last 7 days" replay counts fewer firings', /would have fired <b>\d+<\/b>/.test(p.html) && p.tone === 'ok', p.html);
  st.vals.major = '1.9';
  ok('Band order is checked as you type', /must be lower than Minor/.test(T.lsState(st).err || ''));
  st.vals.major = '1';
  O.openLimits({ plant: 'vedanta', sensorId: 'v_sbr_DO', dir: 'below' });
  const st2 = T.getLS(); st2.vals.minor = '1.8';
  ok('Saving without a reason is refused', T.saveLimits() === false);
  st2.reason = 'tuned'; st2.note = 'SBR cycle ends dip DO briefly; 1.8 stops the end-of-cycle firings';
  const r = T.saveLimits();
  const lim = V.limitsOf('vedanta', 'v_sbr_DO', 'below');
  const ov = V.overrides({ plant: 'vedanta' }).find((o) => o.target.sensorId === 'v_sbr_DO' && o.target.band === 'minor');
  ok('Save writes the ledger and the chip says Changed here', r === undefined && lim.bands.minor === 1.8 && lim.perBand.minor.chip === 'changed' && ov && ov.reason === 'tuned');
  ok('The trial rate follows the change at once', V.trialStats('vedanta', alertNamed('vedanta', /DO low — SBR-1/).id).perDay < 5.9);
  const st3 = T.lsFromInstance('vedanta', 'v_sbr_DO', 'below');
  ok('Reopening prefills the reason and offers "Back to the library value"', st3.reason === 'tuned' && /1\.8 stops/.test(st3.note) && T.lsState(st3).view.minor.back);
  noBanned('SBR-1 after the change', render('p/vedanta/eq/v_sbr'));
}

/* 8 · Redirects: suggest a library change, report a sensor fault */
{
  O.openLimits({ plant: 'manesar', sensorId: 'at2_do', dir: 'below' }); const st = T.getLS(); st.vals.minor = '1.5'; st.note = 'Probe reads low';
  const before = V.suggestions().length;
  act('obj:redirect', { what: 'lib' });
  ok('"The library is wrong" logs a suggestion, not a change', V.suggestions().length === before + 1 && V.limitsOf('manesar', 'at2_do', 'below').bands.minor === 2);
  O.openLimits({ plant: 'manesar', sensorId: 'at2_do', dir: 'below' });
  const n0 = V.issues('manesar', {}).length;
  act('obj:redirect', { what: 'fault' });
  const f = V.issues('manesar', {}).find((i) => i.sensorFault && i.sensorId === 'at2_do');
  ok('"The sensor reads wrong" opens a sensor-fault issue', V.issues('manesar', {}).length === n0 + 1 && !!f);
}

/* 9 · The limits sheet on a type: draft, safety, Where it lands, preview over the plants */
{
  const st = T.lsFromType('OS_TANK', 'Level', 'above'); T.setLS(st);
  st.vals.major = '90';
  const v = T.lsState(st); const p = T.lsPreviewText(st, v.bands, v.err);
  ok('Type sheet: changed band reads "In the draft"', /In the draft/.test(v.view.major.chip) && !v.needsWhy);
  ok('Type sheet: the replay counts over the plants that use it', /Last 7 days at \d+ plants?/.test(p.html), p.html);
  O.openLimits({ mode: 'type', code: 'OS_TANK', reading: 'Level', dir: 'above' }); T.getLS().vals.major = '90';
  const r = T.saveLimits();
  const wil = V.whereItLands('OS_TANK');
  ok('Saving makes a draft that Where it lands can read', r === undefined && V.libDraft('OS_TANK') && wil && wil.plants.length > 0);
  const t = text(O.render({ mode: 'type', code: 'OS_TANK', tab: 'readings' }));
  ok('The type page shows the draft and the old value', /Draft · 1 change/.test(t) && /was 95%/.test(t));
  const st2 = T.lsFromType('BLW', 'Trip contact', 'above'); st2.vals.emergency = '';
  ok('An Emergency change on a type is a safety change', T.lsState(st2).safetyChange);
  V.discardDraft('OS_TANK');
}

/* 10 · Must hold for / must clear for, how often, criticality */
{
  const lvl = alertNamed('vedanta', /Level high — EQ-1/);
  O.openTiming({ plant: 'vedanta', alertId: lvl.id }); const vs = T.getVS(); vs.vals.hold = '45';
  const v = T.vsState(vs); const p = T.timingPreview(vs);
  ok('Timing sheet: a longer hold asks why and replays fewer firings', v.needsWhy && /would have fired <b>\d+<\/b>/.test(p.html) && p.tone === 'ok', p.html);
  vs.reason = 'fornow'; vs.until = '2026-11-20'; vs.note = 'Fill pump cycling during commissioning';
  ok('Saving with For now, until … works', T.saveTiming() === undefined && V.alert('vedanta', lvl.id).hold.value === 45 && V.alert('vedanta', lvl.id).hold.chip === 'changed');
  const tk = V.tasks('manesar', { eqId: 'bl1' }).find((x) => x.every && x.every.n);
  O.openCadence({ plant: 'manesar', taskId: tk.id }); const vc = T.getVS(); vc.vals.n = '3';
  ok('Cadence sheet asks why for a non-library interval', T.vsState(vc).needsWhy);
  vc.reason = 'tuned'; vc.note = 'Dusty site';
  ok('Cadence saves as a change here', T.saveCadence() === undefined && V.task('manesar', tk.id).every.n === 3);
  O.openCadence({ mode: 'type', code: 'BLW', schedule: 'Bearing service' }); const vt = T.getVS(); vt.vals.n = '4';
  ok('Cadence on a type goes to the draft', T.saveCadence() === undefined && V.libDraft('BLW') && V.libDraft('BLW').diffs.some((d) => d.kind === 'cadence'));
  V.discardDraft('BLW');
  O.openTier('vedanta', 'v_sbr'); const vr = T.getVS(); vr.vals.tier = 'A';
  ok('Criticality change without a note is refused', T.saveTier() === false);
  vr.note = 'The only biological step: if it stops, nothing downstream works';
  ok('Criticality change with a note is kept', T.saveTier() === undefined && V.eq('vedanta', 'v_sbr').tier === 'A');
}

/* 11 · Alert state: the undecided proposal decided from the alert page unblocks Go live */
{
  const mlss = alertNamed('vedanta', /MLSS low — SBR-1/);
  const tA = text(render('p/vedanta/alert/' + mlss.id));
  ok('Draft alert page offers "Accept: put it On trial"', /Accept: put it On trial/.test(tA) && /Not for this plant/.test(tA));
  const prop = V.libraryReview('vedanta').find((r) => r.eqId === 'v_sbr').proposals.find((p) => p.name === 'MLSS low');
  const before = V.checklist('vedanta').blockers.length;
  act('obj:astate', { plant: 'vedanta', alert: mlss.id, to: 'trial', pid: prop.pid });
  ok('Accepting from the alert page decides the proposal (On trial, one blocker fewer)', V.alertState('vedanta', mlss.id) === 'trial' && V.checklist('vedanta').blockers.length === before - 1);
  const lvl = alertNamed('vedanta', /Level high — EQ-1/);
  const r = V.setAlertState('vedanta', lvl.id, 'on');
  ok('On is refused while Commissioning (core) and the page shows Turn on disabled', !r.ok && /disabled/.test(render('p/vedanta/alert/' + lvl.id).match(/Turn on[^<]*<|<button[^>]*disabled[^>]*>Turn on/)[0] || ''));
}

/* 12 · Report a problem hands over to B6 when it is there */
{
  ok('Report a problem uses V7WORK.openReport when present', O.report('vedanta', 'v_sbr') === true && !!(W.V7WORK && W.V7WORK.openReport));
  ok('Unknown equipment and alert render a calm not-found page', /Not found/.test(text(render('p/vedanta/eq/nope'))) && /Not found/.test(text(render('p/vedanta/alert/nope'))));
}

/* report */
const soft = [...new Set((UI._soft || []).filter((s) => /object7/.test(s)))];
ok('No soft errors caught inside object7', !soft.length, soft.join(' | '));
for (const r of results) if (VERBOSE || !r.pass) console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${!r.pass && r.detail != null ? '  → ' + String(r.detail).slice(0, 300) : ''}`);
console.log(`object7: ${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
