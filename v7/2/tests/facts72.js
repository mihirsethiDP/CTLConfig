#!/usr/bin/env node
/* v7/2 · tests/facts72.js — the numbers the decision cards and the story quote, worked out from v7/2's core at the story's start.
   Node only, no dependencies. Run it to print them (exit code 0 when every value is there and well formed); require it to
   compute them from a booted v7/2 (another test compares them with the card text):
     const { KEYS, compute } = require('./facts72.js');  compute(window.V7) → { emergencyAt: 'Wed 28 Oct, 15:10', … }
   Every value is computed at a fresh "Reset the story"; nothing below is typed in.
     emergencyAt    the start of the Emergency trial firing on pH low · EQ-1 (Vedanta)          e.g. "Wed 28 Oct, 15:10"
     emergencyPeak  its peak, with its unit                                                   e.g. "pH 3.7"
     lvlCount       Level high · EQ-1's trial firings (Vedanta)                               a whole number
     lvlDays        its trial days so far, one decimal                                        e.g. "5.9"
     lvlMedian      the median length of its ended firings, in minutes                        a whole number
     lvlPeak        its highest reading over the trial, with its unit                         e.g. "88%"
     lvlPerDay      its trial firings a day, one decimal                                      e.g. "12.8"
     doPerDay       DO low · SBR-1's trial firings a day, one decimal                         e.g. "5.9"
     vedTasksPerDay Vedanta's Tasks a day once Live (one figure, rounded)                     a whole number
     vedDueOnGoLive Vedanta's scheduled Tasks whose first due date is go-live day             a whole number
     vedLastService pieces of equipment at Vedanta with a last service date entered           a whole number
     vedEq          pieces of equipment at Vedanta with at least one PM Task                  a whole number
     dpUnitProcesses · dpControlGroups · dpUnclassified   DigitalPaani's identification       whole numbers
     dpTasksPerDay  DigitalPaani's Tasks a day with every binding accepted (a pure preview)   a whole number
   Usage: TZ=Asia/Calcutta node tests/facts72.js [--json]     Exit code 0 = every fact computed. */
'use strict';

const KEYS = ['emergencyAt', 'emergencyPeak', 'lvlCount', 'lvlDays', 'lvlMedian', 'lvlPeak', 'lvlPerDay', 'doPerDay', 'vedTasksPerDay', 'vedDueOnGoLive', 'vedLastService', 'vedEq', 'dpUnitProcesses', 'dpControlGroups', 'dpUnclassified', 'dpTasksPerDay'];
const one = (x) => (Math.round(x * 10) / 10).toFixed(1);

function compute(V) {
  const out = {}; const errors = {};
  const put = (k, fn) => { try { const v = fn(); if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v)) || v === '' || /undefined|NaN/.test(String(v))) errors[k] = 'no value'; else out[k] = v; } catch (e) { errors[k] = e.message; } };
  V.reset();
  const ph = V.trialStats('vedanta', 'a_3f'); const em = ph ? ph.firings.find((f) => f.band === 'emergency') : null;
  const phSensor = V.__.sensorRaw('vedanta', (V.__.alertRaw('vedanta', 'a_3f') || {}).sensor) || {};
  put('emergencyAt', () => V.fmt(em.start));
  put('emergencyPeak', () => V.fmtVal(em.peak, phSensor.unit, phSensor.kind));
  const lv = V.trialStats('vedanta', 'a_3d'); const lvSensor = V.__.sensorRaw('vedanta', (V.__.alertRaw('vedanta', 'a_3d') || {}).sensor) || {};
  put('lvlCount', () => lv.count);
  put('lvlDays', () => one(lv.days));
  put('lvlMedian', () => lv.medianMin);
  put('lvlPeak', () => V.fmtVal(lv.peak, lvSensor.unit, lvSensor.kind));
  put('lvlPerDay', () => one(lv.perDay));
  put('doPerDay', () => one(V.trialStats('vedanta', 'a_3r').perDay));
  const pv = V.goLivePreview('vedanta');
  put('vedTasksPerDay', () => pv.tasksPerDay);
  put('vedDueOnGoLive', () => pv.tasks.dueToday);
  put('vedLastService', () => pv.lastService.entered);
  put('vedEq', () => pv.lastService.total);
  const sc = typeof V.structure === 'function' ? V.structure('digitalpaani') : null;
  put('dpUnitProcesses', () => sc.counts.ups);
  put('dpControlGroups', () => sc.counts.cgs);
  put('dpUnclassified', () => sc.counts.unclassified);
  put('dpTasksPerDay', () => Math.round(V.allBoundPreview('digitalpaani').tasksPerDay));
  return { facts: out, errors };
}

module.exports = { KEYS, compute };

if (require.main === module) {
  const L = require('./load72.js'); const V = L.V7;
  const { facts, errors } = V ? compute(V) : { facts: {}, errors: { load: 'v7/2 did not load' } };
  const missing = KEYS.filter((k) => !(k in facts));
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify({ V72_FACTS: facts, missing, errors }, null, 2) + '\n');
  else {
    console.log('V72_FACTS (v7/2 at the story\'s start)');
    KEYS.forEach((k) => console.log(`  ${k.padEnd(16)} ${k in facts ? JSON.stringify(facts[k]) : `MISSING (${errors[k] || 'not computed'})`}`));
    console.log(`\nfacts72 · ${KEYS.length - missing.length}/${KEYS.length} computed · loaded: ${L.loaded.filter((f) => /^core7/.test(f)).join(', ')}`);
  }
  console.log(`RESULT: ${missing.length ? `FAIL · missing ${missing.join(', ')}` : 'PASS'}`);
  process.exit(missing.length ? 1 : 0);
}
