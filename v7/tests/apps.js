/* v7 · tests/apps.js — helpers the cross-version tests share: the v7/2 route table, a route matcher, an "does this object
   exist" check for either prototype, the numbers the v7/2 hand-off doc quotes, and probe(), which runs one prototype
   headless in a child process (its own globals) and answers questions about it. Node only, no dependencies; requiring this
   file runs nothing.

     const A = require('<site/v7>/tests/apps.js');
     A.V72_ROUTES            [{pattern, owner}] — every route v7/2 registers, with the file that registers it
     A.matchRoute(list, h)   → {pattern, params, owner} | null   (literal segments win, as in the router)
     A.exists(V, which, q)   → true | false, q = {kind, plant, id}; kinds: plant, eq, alert, issue, code (v7/1);
                               plant, eq, up, sensor, trigger, issue, task, cg, eqType, upType, template, plantType (v7/2)
     A.values72(V)           → {key: text} the v7/2 hand-off doc writes into <span data-v="key">, worked out at the story's start
     A.probe('1'|'2', {full, ids:[q], hashes:[h], values, chapters})
                             → {loaded, errors, ids:{kind|plant|id: bool}, routes:{h: {pattern, problem}}, values, chapters}
       full: load every script (the app), else the core only (data … the last core file). A route's problem is '' when it
       lands on a real page, else 'no route', 'lands on a "not found" page' or 'throws …'. */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const V7DIR = path.resolve(__dirname, '..');
const NOTFOUND = /\b(Not found|No such|could not be shown|is not in the prototype)\b/;

/* every route v7/2 registers, and who registers it (an alias renders its page in place) */
const V72_ROUTES = [
  ['plants', 'ui7.js'], ['activity/:plant?', 'ui7.js'], ['p/:plant/activity', 'ui7.js'],
  ['p/:plant', 'plant7.js'], ['p/:plant/people', 'plant7.js'], ['p/:plant/people/service-dates', 'plant7.js'], ['p/:plant/review/bindings', 'plant7.js'], ['p/:plant/library', 'plant7.js'],
  ['p/:plant/triggers', 'lists7.js'], ['p/:plant/readings', 'lists7.js'], ['p/:plant/tasks', 'lists7.js'], ['p/:plant/details', 'lists7.js'],
  ['p/:plant/structure/:view?', 'structure7.js'], ['p/:plant/review/structure', 'structure7.js'], ['p/:plant/cg/:id', 'structure7.js'], ['p/:plant/equipment', 'structure7.js'], ['p/:plant/scada', 'structure7.js'], ['p/:plant/review', 'structure7.js'],
  ['p/:plant/eq/:id/:tab?', 'object7.js'], ['p/:plant/eq/:id/phone', 'object7.js'], ['p/:plant/eq/:id/card', 'object7.js'], ['p/:plant/up/:id/:tab?', 'object7.js'], ['p/:plant/up/:id/phone', 'object7.js'],
  ['p/:plant/sensor/:id', 'object7.js'], ['p/:plant/trigger/:id', 'object7.js'], ['p/:plant/alert/:id', 'object7.js'],
  ['library', 'lib7.js'], ['library/eq-types', 'lib7.js'], ['library/eq-types/:code/:tab?', 'lib7.js'], ['library/up-types', 'lib7.js'], ['library/up-types/:id/:tab?', 'lib7.js'],
  ['library/templates', 'lib7.js'], ['library/templates/:id', 'lib7.js'], ['library/plant-types', 'lib7.js'], ['library/plant-types/:id/:tab?', 'lib7.js'],
  ['library/conditions/:id?', 'lib7.js'], ['library/flows/:id?', 'lib7.js'], ['library/root-causes/:id?', 'lib7.js'], ['library/:code/:tab?', 'lib7.js'],
  ['deviations', 'ledger7.js'], ['p/:plant/deviations', 'ledger7.js'], ['differences', 'ledger7.js'], ['p/:plant/differences', 'ledger7.js'],
  ['p/:plant/issues', 'work7.js'], ['p/:plant/issue/:id', 'work7.js'], ['p/:plant/task/:id', 'work7.js'],
  ['decisions', 'decisions7.js'], ['decisions/:id', 'decisions7.js'],
].map(([pattern, owner]) => ({ pattern, owner }));
const OBJECT_TABS = new Set(['readings', 'issues', 'tasks', 'details']);
const STRUCTURE_VIEWS = new Set(['list', 'drawing']);

function partsOf(hash) {
  const p = String(hash == null ? '' : hash).trim().replace(/^#/, '').replace(/^\/+/, '').split('?')[0].replace(/\/+$/, '');
  return p ? p.split('/').map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } }) : [];
}
/* matchRoute(list, '#/p/manesar/trigger/a_do_at2?f=x') → {pattern, params, owner}; the most literal segments win */
function matchRoute(list, hash) {
  const parts = partsOf(hash); let best = null;
  for (const r of list) {
    const segs = r.pattern.split('/'); const params = {}; let lit = 0; let good = true;
    const need = segs.filter((s) => !/\?$/.test(s)).length;
    if (parts.length < need || parts.length > segs.length) continue;
    for (let i = 0; i < segs.length && good; i++) {
      const s = segs[i]; const v = parts[i];
      if (s[0] === ':') { if (v == null) { if (!/\?$/.test(s)) good = false; continue; } params[s.slice(1).replace(/\?$/, '')] = v; }
      else if (s !== v) good = false; else lit++;
    }
    if (good && (!best || lit > best.lit)) best = { pattern: r.pattern, params, owner: r.owner, lit };
  }
  return best;
}
/* the objects a v7/2 route names: [{kind, plant, id}] plus a problem with a tab or view, '' when none */
function objectsOf72(m) {
  if (!m) return { qs: [], problem: 'is not a v7/2 route' };
  const p = m.params; const qs = []; let problem = '';
  if (p.plant != null) qs.push({ kind: 'plant', plant: p.plant, id: p.plant });
  const kindOf = { 'p/:plant/eq/:id/:tab?': 'eq', 'p/:plant/eq/:id/phone': 'eq', 'p/:plant/eq/:id/card': 'eq', 'p/:plant/up/:id/:tab?': 'up', 'p/:plant/up/:id/phone': 'up', 'p/:plant/sensor/:id': 'sensor',
    'p/:plant/trigger/:id': 'trigger', 'p/:plant/alert/:id': 'trigger', 'p/:plant/cg/:id': 'cg', 'p/:plant/issue/:id': 'issue', 'p/:plant/task/:id': 'task',
    'library/eq-types/:code/:tab?': 'eqType', 'library/:code/:tab?': 'eqType', 'library/up-types/:id/:tab?': 'upType', 'library/templates/:id': 'template', 'library/plant-types/:id/:tab?': 'plantType' }[m.pattern];
  if (kindOf) qs.push({ kind: kindOf, plant: p.plant || null, id: p.id != null ? p.id : p.code });
  if (p.tab != null && /eq\/|up\/|eq-types|up-types|library\/:code/.test(m.pattern) && !OBJECT_TABS.has(p.tab)) problem = `names the tab "${p.tab}"`;
  if (p.view != null && !STRUCTURE_VIEWS.has(p.view)) problem = `names the view "${p.view}"`;
  return { qs, problem };
}

/* does the object exist? Runs in whichever process holds the app (V is its window.V7) */
function exists(V, which, q) {
  const S = (f) => { try { return f(); } catch (e) { return null; } };
  if (!V || !q) return false;
  const __ = V.__ || {}; const k = q.kind; const p = q.plant; const id = q.id;
  if (p != null && !S(() => (V.plants() || []).some((x) => x && x.key === p))) return false;
  const any = (list, f) => Array.isArray(list) && list.some(f);
  switch (k) {
    case 'plant': return true;
    case 'eq': return !!S(() => V.eq(p, id));
    case 'alert': return !!S(() => any(V.alerts(p, {}), (a) => a && a.id === id));
    case 'issue': return !!S(() => V.issue(p, id));
    case 'code': return !!S(() => any(V.libTypes(), (t) => t && t.code === id));
    case 'up': return !!S(() => (typeof V.isUp === 'function' ? V.isUp(p, id) : V.unitProcess(p, id)));
    case 'sensor': return !!S(() => (__.sensorRaw ? __.sensorRaw(p, id) : null));
    case 'trigger': return !!S(() => (__.alertRaw && __.alertRaw(p, id)) || (__.schedRaw && __.schedRaw(p, id)) || (__.dOf && any(__.dOf(p).conditionWork, (w) => w && w.id === id)));
    case 'task': return !!S(() => any(V.tasks(p), (t) => t && t.id === id));
    case 'cg': return !!S(() => V.controlGroup(p, id));
    case 'eqType': return !!S(() => any(V.libTypes(), (t) => t && t.code === id));
    case 'upType': return !!S(() => V.upType(id));
    case 'template': return !!S(() => V.template(id));
    case 'plantType': return !!S(() => any(V.plantTypes(), (t) => t && (t.id === id || t.code === id || t.key === id)));
    default: return false;
  }
}

/* the numbers and dates the v7/2 hand-off doc quotes, worked out at the story's start (V = v7/2's window.V7) */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function ist(t) { const d = new Date(t + 330 * 60e3); return { wd: DAYS[d.getUTCDay()], d: d.getUTCDate(), mon: MONTHS[d.getUTCMonth()], y: d.getUTCFullYear(), hh: String(d.getUTCHours()).padStart(2, '0'), mm: String(d.getUTCMinutes()).padStart(2, '0') }; }
const dayYear = (t) => { const x = ist(t); return `${x.wd} ${x.d} ${x.mon} ${x.y}`; };
const dayMon = (t) => { const x = ist(t); return `${x.d} ${x.mon}`; };
function values72(V) {
  const out = {}; const DAY = 864e5;
  const put = (k, f) => { try { const v = f(); if (v !== undefined && v !== null && v !== '' && !/undefined|NaN/.test(String(v))) out[k] = String(v); } catch (e) { /* left out: the doc check names it */ } };
  let facts = {};                                    // compute() starts from a reset story and saves nothing
  try { facts = require(path.join(V7DIR, '2', 'tests', 'facts72.js')).compute(V).facts || {}; } catch (e) { facts = {}; V.reset(); }
  Object.keys(facts).forEach((k) => put(k, () => facts[k]));
  const now = V.now(); const PS = V.__.PS;
  const sd = V.structure('digitalpaani').counts; const ib = V.identify('bawal').counts;
  put('eqTypes', () => V.libTypes().length); put('upTypes', () => V.upTypes().length); put('templates', () => V.templates({}).length);
  put('dpNodes', () => sd.nodes); put('dpSensors', () => sd.sensors); put('dpEquipment', () => sd.equipment); put('dpRows', () => sd.rows); put('dpProposed', () => sd.proposed); put('dpShared', () => sd.sharedRows);
  put('bawalEq', () => ib.equipment); put('bawalByRules', () => ib.unclassified);
  put('screeningTasks', () => (V.upType('screening').templates || []).filter((t) => t.kind === 'task').length);
  put('dpHeightGaps', () => (V.sensors('digitalpaani') || []).filter((s) => { const z = V.zoneInfo('digitalpaani', s.id, 'above'); return z && Object.values(z.perBand || {}).some((b) => b && b.needs && b.needs.param === 'tankHeight'); }).length);
  const cdp = V.checklist('digitalpaani');
  put('dpBlockers', () => cdp.blockers.length); put('dpNopm', () => (cdp.gaps.find((g) => g.id === 'nopm') || {}).count);
  put('trialDay', () => Math.floor((now - V.trialStart('vedanta')) / DAY) + 1);
  const gp = V.goLivePreview('vedanta');
  put('vedActive', () => gp.trial.active); put('vedFirings', () => gp.trial.firings); put('vedFired', () => gp.trial.fired); put('vedScheduled', () => gp.tasks.scheduled); put('vedFromDates', () => gp.tasks.fromDates);
  put('lvlTuned', () => V.overridePreview('vedanta', { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' }, 87).count);
  put('tunedReview', () => dayMon(now + 90 * DAY)); put('today', () => dayMon(now));
  put('noisyClears', () => { const ts = V.trialStats('vedanta', 'a_3d'); return V.fmt(ts.since + (ts.count / 10) * DAY); });
  const p8 = V.overridePreview('manesar', { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' }, 1.5);
  put('ch8Would', () => p8.count); put('ch8Now', () => p8.countNow);
  const cv = V.coverage('manesar').triggers;
  put('manActive', () => cv.active); put('manDrafts', () => cv.drafts); put('manIssues', () => cv.issues); put('manClosed', () => cv.closed); put('manFalse', () => cv.falseAlarms);
  const rp = V.returnPreview('manesar');
  put('retActive', () => rp.activeTriggers); put('retUpcoming', () => rp.tasksUpcoming); put('retDrafts', () => rp.draftsAfter);
  const zb = (s, dir, band) => V.zoneInfo('manesar', s, dir).perBand[band];
  put('mlssLib', () => zb('at2_mlss', 'below', 'minor').valueText); put('mlssAt1', () => zb('at1_mlss', 'below', 'minor').valueText);
  put('blAmps', () => ['caution', 'minor', 'major'].map((b) => zb('bl1_amps', 'above', b).resolvedText.replace(/ A$/, '')).join(' / ') + ' A');
  const dc = V.deviationCounts();
  put('devOverrides', () => dc.overrides); put('devBaseMoved', () => dc.baseMoved); put('devPastReview', () => dc.pastReview); put('devSingleUse', () => dc.singleUse); put('devStructure', () => dc.structure);
  put('migrated', () => V.overrides({}).filter((o) => o && o.reason === 'migrated' && o.status === 'active').length);
  put('dpSince', () => V.fmt(PS('digitalpaani').commissioningSince)); put('vedSince', () => V.fmt(PS('vedanta').commissioningSince));
  put('manSince', () => dayYear(PS('manesar').goLiveAt)); put('bawalSince', () => dayYear(PS('bawal').goLiveAt));
  put('migratedReview', () => dayYear(V.overrides({ plant: 'manesar' }).find((o) => o.reason === 'migrated').reviewBy));
  return out;
}

/* run one prototype in a child process and ask it questions */
function probe(which, req) {
  const w = String(which) === '2' ? '2' : '1'; const dir = path.join(V7DIR, w);
  if (!fs.existsSync(path.join(dir, 'prototype.html'))) return { loaded: false, errors: [`v7/${w} has no prototype.html`], ids: {}, routes: {}, values: null, chapters: null };
  const code = `'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const req = JSON.parse(fs.readFileSync(0, 'utf8')); const D = req.dir; const H = require(req.helper);
const log = console.log; console.log = () => {}; console.warn = () => {};
let V = null, UI = null, render = null; const errors = [];
try {
  if (req.which === '2' && fs.existsSync(path.join(D, 'tests', 'load72.js'))) {
    if (!req.full) process.env.LOAD72_UPTO = 'core72-commission.js';
    const L = require(path.join(D, 'tests', 'load72.js')); V = L.V7; UI = L.V7UI; render = L.render;
    (L.errors || []).forEach((e) => errors.push(e && e.file ? e.file + ': ' + String(e.error).split('\\n')[0] : String(e)));
  } else {
    require(path.join(D, 'tests', 'smoke.js')).installDom();
    const html = fs.readFileSync(path.join(D, 'prototype.html'), 'utf8');
    const order = [...html.matchAll(/<script[^>]*\\bsrc="assets\\/([^"?]+)/g)].map((m) => m[1]);
    for (const f of order) {
      if (!req.full && /^(ui7|plant7|lists7|structure7|object7|lib7|ledger7|work7|decisions7)\\.js$/.test(f)) break;
      const p = path.join(D, 'assets', f); if (!fs.existsSync(p)) continue;
      try { vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p }); } catch (e) { errors.push(f + ': ' + e.message); }
    }
    V = global.V7; UI = global.V7UI || null; render = UI ? (h) => UI.renderPath(h) : null;
    if (V && V.reset) V.reset(); else if (V && V.boot) V.boot();
  }
} catch (e) { errors.push('load: ' + e.message); }
const text = (h) => String(h || '').replace(/<(script|style)\\b[\\s\\S]*?<\\/\\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\\s+/g, ' ').trim();
const out = { loaded: !!V, errors, ids: {}, routes: {}, values: null, chapters: null };
if (V) {
  for (const q of req.ids || []) out.ids[[q.kind, q.plant, q.id].join('|')] = H.exists(V, req.which, q);
  if (req.values) { try { out.values = H.values72(V); } catch (e) { errors.push('values: ' + e.message); } }
  if (req.chapters && UI && typeof UI.chapters === 'function') { try { out.chapters = UI.chapters().map((c) => ({ n: c.n, title: c.title, href: c.href, cmp: c.cmp || c.cmp72 || null, compare: c.compare || null, decisions: (c.decisions || []).map((d) => d.id) })); } catch (e) { errors.push('chapters: ' + e.message); } }
  for (const h of req.hashes || []) {
    let r = { pattern: null, problem: '' };
    try {
      const m = UI && UI.match ? UI.match(h) : null;
      if (!m) r.problem = UI ? 'no route' : 'the app shell did not load';
      else { r.pattern = m.pattern || (m.route && m.route.pattern) || null; try { if (H.NOTFOUND.test(text(render(h)).slice(0, 300))) r.problem = 'lands on a "not found" page'; } catch (e) { r.problem = 'throws ' + e.message; } }
    } catch (e) { r.problem = 'throws ' + e.message; }
    out.routes[h] = r;
  }
}
console.log = log; process.stdout.write(JSON.stringify(out));`;
  const res = cp.spawnSync(process.execPath, ['-e', code], { input: JSON.stringify(Object.assign({}, req, { which: w, dir, helper: __filename })), encoding: 'utf8', maxBuffer: 256 << 20, env: Object.assign({}, process.env, { TZ: 'Asia/Calcutta' }) });
  try { return JSON.parse(res.stdout); } catch (e) { return { loaded: false, errors: [`v7/${w} did not answer: ${String(res.stderr || res.stdout || e.message).slice(0, 400)}`], ids: {}, routes: {}, values: null, chapters: null }; }
}
const idKey = (q) => [q.kind, q.plant, q.id].join('|');

module.exports = { V7DIR, NOTFOUND, V72_ROUTES, matchRoute, objectsOf72, exists, values72, probe, idKey, partsOf };
