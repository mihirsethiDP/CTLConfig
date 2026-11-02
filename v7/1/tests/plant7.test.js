#!/usr/bin/env node
/* v7 · tests/plant7.test.js — checks for plant7.js (window.V7PLANT): frame, Readiness, Coverage, What SCADA found,
   What the library brings, Equipment, Readings, Tasks, and the actions behind them (accept, not for this plant, go live,
   return to Commissioning). Node only, no dependencies. Run: node tests/plant7.test.js  (exit 1 on failure) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { installDom, scan, visibleText } = require('./smoke.js');

const ASSETS = path.resolve(__dirname, '..', 'assets');
installDom();
for (const f of ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js', 'core7.js', 'ui7.js', 'plant7.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ASSETS, f), 'utf8'), { filename: f });
}
const U = global.V7UI; const V7 = global.V7; const P = global.V7PLANT;
V7.reset();

let n = 0; const bad = [];
function ok(cond, name, info) { n++; if (!cond) bad.push(name + (info !== undefined ? '  → ' + String(info).slice(0, 300) : '')); }
const vis = (h) => visibleText(h);
const page = (hash) => U.renderPath(hash);
function clean(hash) {
  const html = page(hash); const found = scan(html).filter((f) => f.kind !== 'data-word');
  ok(!found.length, `no banned words, IDs or junk on ${hash}`, JSON.stringify(found.slice(0, 2)));
  ok(!/&amp;(amp|#39|quot|lt|gt);/.test(html), `nothing escaped twice on ${hash}`, (html.match(/.{40}&amp;(amp|#39|quot|lt|gt);.{20}/) || [])[0]);
  return html;
}
/* a fake element for a data-act handler: data-* attributes, and a modal with a #p7-reason textarea */
function el(data, reason) {
  const ta = { value: reason || '', classList: { add() {}, remove() {} }, parentNode: null, focus() {} };
  const modal = { querySelector: (sel) => (sel === '#p7-reason' ? ta : null) };
  return { getAttribute: (k) => (k.startsWith('data-') ? (data[k.slice(5)] != null ? String(data[k.slice(5)]) : null) : null), closest: (sel) => (sel === '.modal' ? modal : null), value: data.value };
}
const H = U._handlers;
const act = (name, data, reason) => { const fn = H[name]; ok(typeof fn === 'function', `handler ${name} is registered`); return fn ? fn(el(data, reason)) : undefined; };

/* module shape and routes */
ok(P && typeof P.frame === 'function', 'V7PLANT.frame exists');
const pats = U.routes().map((r) => r.pattern);
['p/:plant', 'p/:plant/scada', 'p/:plant/library', 'p/:plant/equipment', 'p/:plant/readings', 'p/:plant/tasks'].forEach((p) => ok(pats.includes(p), `route ${p} registered`));
ok(P.typePlural('Blower', 5) === 'Blowers' && P.typePlural('ACF/MGF', 2) === 'ACF/MGF' && P.typePlural('MBBR', 5) === 'MBBR' && P.typePlural('Screw Press', 2) === 'Screw Presses' && P.typePlural('Pump', 1) === 'Pump', 'type names stay as stored; only a plain plural');

/* frame */
const fr = P.frame('vedanta', 'tasks', '<p>x</p>');
ok(/Home/.test(vis(fr)) && /Equipment/.test(vis(fr)) && /Readings/.test(vis(fr)) && /Issues/.test(vis(fr)) && /Tasks/.test(vis(fr)) && /Differences/.test(vis(fr)) && /Activity/.test(vis(fr)), 'frame has the seven tabs');
ok(/class="tab on"[^>]*href="#\/p\/vedanta\/tasks"|href="#\/p\/vedanta\/tasks"[^>]*class="tab on"|<a class="tab on" href="#\/p\/vedanta\/tasks"/.test(fr), 'frame marks the active tab');
ok(/All Plants/.test(vis(fr)) && /Vedanta ETP/.test(vis(fr)) && /Sample plant/.test(vis(fr)) && /Commissioning/.test(vis(fr)), 'frame crumbs and chips');
ok(/day 6 of the trial/.test(vis(fr)), 'Vedanta is on day 6 of the trial', vis(fr).slice(0, 300));
ok(/Real SCADA layout/.test(vis(P.frame('digitalpaani', 'home', ''))), 'DigitalPaani is marked as the real SCADA layout');
ok(/No such plant/.test(vis(page('#/p/nowhere'))) && /No such plant/.test(vis(P.frame('nowhere', 'home', ''))), 'unknown plant');

/* Readiness: DigitalPaani (nothing reviewed) */
let h = clean('#/p/digitalpaani');
ok(/What SCADA found/.test(vis(h)) && /What the library brings/.test(vis(h)) && /Who is told/.test(vis(h)), 'three track cards');
ok(/Blocks go live/.test(vis(h)) && /Gaps: they don't block/.test(vis(h)), 'blockers then gaps');
ok(vis(h).indexOf('Blocks go live') < vis(h).indexOf("Gaps: they don't block"), 'blockers come before gaps');
ok(/<button[^>]*disabled[^>]*>Go live<\/button>/.test(h) && /Go live is blocked by \d+ things\. First: accept what SCADA found \(13 types\)/.test(vis(h)), 'Go live disabled, with the reason');
ok(/href="#\/p\/digitalpaani\/scada"/.test(h) && /href="#\/p\/digitalpaani\/library"/.test(h), 'review links on Home');
ok(/Edit in the User Center/.test(vis(h)), 'people are edited in the User Center');

/* Readiness: Vedanta (one undecided proposal, trial running, Emergency issue) */
h = clean('#/p/vedanta');
ok(/An Emergency during the trial opened an issue/.test(vis(h)) && /no call, no hooter/.test(vis(h)), 'the commissioning Emergency is shown first, with who was told');
ok(/One library proposal is not decided: MLSS low on SBR-1/.test(vis(h)), 'the one blocker names the proposal');
ok(/library\?eq=/.test(h), 'the blocker links straight to that equipment');
ok(/Level high — EQ-1 is noisy/.test(vis(h)), 'the noisy gap');
ok(/The trial so far/.test(vis(h)) && /Noisy/.test(vis(h)) && /Mostly short/.test(vis(h)) && /Sample readings/.test(vis(h)), 'trial table: noisy, mostly short, sample readings');
ok(vis(h).indexOf('Level high — EQ-1 Level') < vis(h).indexOf('DO low — SBR-1 Dissolved'), 'noisiest alert first in the trial table');

/* What the library brings: the undecided one is open, with its Accept */
h = clean('#/p/vedanta/library');
ok(/MLSS low/.test(vis(h)) && /data-act="p7:lib-accept"[^>]*data-pid="[^"]*MLSS low"/.test(h), 'the undecided proposal has Accept');
ok(/<details class="p7-grp p7-eq" open>/.test(h), 'the equipment with the one undecided proposal is open');
ok(/From the library/.test(vis(h)), 'limits carry a source chip');
h = clean('#/p/vedanta/library?show=blocked');
ok(/is-blocked/.test(h) && /(Next phase|SCADA doesn't send)/.test(vis(h)), 'blocked proposals are listed, greyed');
h = clean('#/p/digitalpaani/library');
ok(/Accept all for 22 Pumps/.test(vis(h)) && /Accept all for 5 Blowers/.test(vis(h)), 'accept a whole type at once');

/* accept it → Go live opens → go live → Coverage */
const pid = (V7.libraryReview('vedanta').find((r) => r.tag === 'SBR-1').proposals.find((p) => p.name === 'MLSS low') || {}).pid;
act('p7:lib-accept', { plant: 'vedanta', pid });
ok(V7.alertState('vedanta', V7.alerts('vedanta').find((a) => a.name === 'MLSS low — SBR-1').id) === 'trial', 'accepted alert goes On trial');
ok(/Nothing blocks go live now/.test(U._last.toast || ''), 'the toast says go live is open now', U._last.toast);
h = page('#/p/vedanta');
ok(/data-act="p7:golive"/.test(h) && !/<button[^>]*disabled[^>]*>Go live<\/button>/.test(h), 'Go live is enabled');
act('p7:golive', { plant: 'vedanta' });
const m = U._last.modal || {};
ok(/Go live: Vedanta ETP/.test(m.title || ''), 'go-live confirmation opens', m.title);
['Alerts reach people: 13 alerts go from On trial to On', 'Calls and the hooter start now', 'Tasks start:', 'First due dates are spread', 'Counts and metrics start today', 'Changes to structure need a reason'].forEach((t) => ok(vis(m.body || '').includes(t), `confirmation lists: ${t}`, vis(m.body || '').slice(0, 400)));
ok(/\d+ if each piece of equipment gets its own/.test(vis(m.body || '')) && !/if every /.test(vis(m.body || '')), 'tasks a day both ways, "if each piece of equipment gets its own"', vis(m.body || '').slice(0, 400));
act('p7:golive-confirm', { plant: 'vedanta' });
ok(V7.state('vedanta') === 'live', 'Vedanta is Live');
h = clean('#/p/vedanta');
ok(/How the alerts are doing/.test(vis(h)) && /went live/.test(vis(h)), 'Home becomes Coverage, with a one-time note');
/* return to Commissioning needs a reason */
ok(act('p7:return-confirm', { plant: 'vedanta' }, '') === false && V7.state('vedanta') === 'live', 'no reason, no return');
act('p7:return-confirm', { plant: 'vedanta' }, 'Aeration grid rebuild');
ok(V7.state('vedanta') === 'commissioning', 'returned to Commissioning with a reason');

/* Coverage: Manesar */
h = clean('#/p/manesar');
ok(/One open issue/.test(vis(h)) && /DO low — AT-2/.test(vis(h)), 'open issue first');
ok(/issues a day from alerts/.test(vis(h)) && /closed as false alarms/.test(vis(h)) && /median time to close/.test(vis(h)), 'fire rate, false alarms, time to close');
ok(/Blind spots/.test(vis(h)) && /Library changes that reached this plant/.test(vis(h)) && /Clarifier Tank · version 2/.test(vis(h)), 'blind spots and library change notes');
ok(/differences from the library/.test(vis(h)) && /reason not recorded/.test(vis(h)), 'differences summary');
ok(/Return to Commissioning/.test(vis(h)) && /Emergencies are still sent to the Leads/.test(vis(h)), 'return to Commissioning says Emergencies keep being sent');
clean('#/p/bawal');

/* What SCADA found */
h = clean('#/p/digitalpaani/scada');
ok(/drawn as one type and stored as another/.test(vis(h)) && /Drawn as Diffuser Tank/.test(vis(h)), 'drawn ≠ stored list');
ok(/Accept all 13 types/.test(vis(h)), 'accept all types');
ok(/Oil &amp; Grease Tank/.test(h) && !/Oil &amp;amp; Grease/.test(h), 'type names escaped once');
act('p7:scada-accept', { plant: 'digitalpaani', type: 'Blower' });
ok(V7.scadaReview('digitalpaani').groups.find((g) => g.typeName === 'Blower').accepted, 'accept one type');
act('p7:scada-accept-all', { plant: 'digitalpaani' });
ok(V7.scadaReview('digitalpaani').groups.every((g) => g.accepted), 'accept all types');
ok(/Everything SCADA found is accepted/.test(vis(page('#/p/digitalpaani/scada'))), 'all accepted note');

/* Not for this plant needs a reason */
const tc = V7.libraryReview('digitalpaani').find((r) => r.tag === 'SC').proposals.find((p) => p.name === 'Tank cleaning');
ok(act('p7:lib-reject-confirm', { plant: 'digitalpaani', pid: tc.pid }, '') === false, 'no reason, nothing decided');
act('p7:lib-reject-confirm', { plant: 'digitalpaani', pid: tc.pid }, 'Not fitted at this plant');
ok(V7.libraryReview('digitalpaani').find((r) => r.tag === 'SC').proposals.find((p) => p.name === 'Tank cleaning').decided === 'rejected', 'left out with a reason');
act('p7:lib-accept-type', { plant: 'digitalpaani', type: 'Pump' });
ok(V7.libraryReview('digitalpaani').filter((r) => r.typeName === 'Pump').every((r) => r.proposals.every((p) => p.blockedBy || p.decided)), 'accept all for a type');

/* Equipment, Readings, Tasks */
h = clean('#/p/manesar/equipment');
ok(/Diffuser Tank/.test(vis(h)) && /AT-2/.test(vis(h)) && /1 open/.test(vis(h)), 'equipment list by type with open issues');
ok(/href="#\/p\/manesar\/eq\/at2"/.test(h), 'rows link to the equipment page');
clean('#/p/manesar/equipment?show=diffs');
h = clean('#/p/vedanta/readings?show=nolimits');
ok(/Temperature/.test(vis(h)) && !/Dissolved oxygen/.test(vis(h)), 'readings filter: no limits yet');
h = clean('#/p/vedanta/readings');
ok(/Manual/.test(vis(h)) && /every 8 hours/.test(vis(h)) && /Lab/.test(vis(h)), 'manual and lab readings with their interval');
ok(/bb bb-sm/.test(h) && /Sample readings/.test(vis(h)), 'mini band bars and the sample tag');
ok(/Next phase/.test(vis(h)), 'next-phase readings shown quietly');
h = clean('#/p/manesar/tasks');
ok(/tasks a day/.test(vis(h)) && /due now/.test(vis(h)) && /to confirm/.test(vis(h)), 'tasks: per day, due now, to confirm');
ok(/href="#\/p\/manesar\/task\//.test(h), 'tasks link to their pages');
h = clean('#/p/vedanta/tasks');
ok(/Shared task for 2 Blowers/.test(vis(h)), 'set-level task line', vis(h).slice(0, 600));
V7.reset();
ok(/No tasks yet/.test(vis(page('#/p/digitalpaani/tasks'))), 'no tasks before the library is accepted');

/* every page of every plant renders after the clock moves on a day */
V7.advance(1440);
['digitalpaani', 'vedanta', 'manesar', 'bawal'].forEach((k) => ['', '/scada', '/library', '/library?show=all', '/equipment', '/readings', '/tasks'].forEach((s) => clean(`#/p/${k}${s}`)));
V7.reset();

console.log(`plant7: ${n - bad.length}/${n} checks passed`);
if (bad.length) { bad.forEach((b) => console.log('  FAIL ' + b)); process.exit(1); }
