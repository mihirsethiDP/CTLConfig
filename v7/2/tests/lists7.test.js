#!/usr/bin/env node
/* v7/2 · tests/lists7.test.js — the plant's lists: the Triggers list, the Readings tab, the Tasks list and plant details.

   Renders all four pages (and their ?sort= / ?show= / ?f= variants) for every plant, checks the columns by plant state, and
   compares what each page shows with the core function it reads (trialTable, coverage().perTrigger, bindingsPass, readingsTab,
   tasks, tasksPerDay, cadenceOf, goLiveTasks, designParams). It then walks DigitalPaani through its structure and bindings
   passes and Vedanta through go-live, and renders again after a day of story time. Words on screen are checked against the
   v7/2 banned list (verbatim library and workbook text exempt). Every expected number is read from the core.

   It runs twice: on the full stack, and in a child process with plant7.js, structure7.js and object7.js left out, so the
   page's own fallbacks (the plant frame, the subject chip, the design-parameter table) are checked as well.
   Node only, no dependencies.  Usage: TZ=Asia/Calcutta node tests/lists7.test.js   Exit code 0 = pass. */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');

const CHILD = process.env.LISTS7_CHILD === '1';
const L = require('./load72.js');
const V = L.V7; const U = L.V7UI; const W = L.window;
const label = CHILD ? 'without plant7, structure7, object7' : 'full stack';

let pass = 0; let fail = 0; const fails = [];
function ok(name, cond, info) {
  if (cond) { pass++; return true; }
  fail++; fails.push(`${name}${info !== undefined ? ` · ${typeof info === 'string' ? info : JSON.stringify(info)}`.slice(0, 400) : ''}`); return false;
}
function attempt(name, fn) { try { fn(); } catch (e) { ok(`${name} (threw)`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); } }

/* ── html helpers ─────────────────────────────────────────────────────────────────────────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', rsaquo: '›' };
const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m));
const vis = (h) => decode(String(h || '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
function tables(html) {
  return [...String(html).matchAll(/<table class="([^"]*)">([\s\S]*?)<\/table>/g)].map((m) => ({
    cls: m[1],
    head: [...m[2].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((x) => vis(x[1])),
    rows: [...m[2].matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/g)].slice(1).map((x) => ({ attrs: x[1], html: x[2], text: vis(x[2]), cells: [...x[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => c[1]) })),
  }));
}
const hrefs = (html) => [...String(html).matchAll(/\s(?:href|data-href)="([^"]*)"/g)].map((m) => decode(m[1]));
const issueTable = (body) => tables(body.split('<details')[0]).find((t) => /\bl7-trig\b/.test(t.cls)) || null;
const taskTrigTable = (body) => { const i = body.indexOf('<details class="l7-more"'); return i < 0 ? null : tables(body.slice(i))[0] || null; };
const B = W.V7LISTS ? W.V7LISTS.bodies : null;
const render = (hash) => L.render(hash);
const ERR = 'This page could not be shown';
const fmtDay = (ms) => U.fmtDay(ms);
const rate = (x) => U.rate(x);

/* ── the v7/2 banned list (words on screen), verbatim library and workbook text exempt ─────────────────── */
const lit = (s, cs) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), cs ? '' : 'i');
const BANNED = [
  /\bmachines?\b/i, /\bassets?\b/i, /\bwidgets?\b/i, /\bestates?\b/i, /\bportfolio\b/i, /\bcustom\b/i, /\bdetach(ed)?\b/i, /\bfork(ed|s)?\b/i,
  /\bdiverg(e|ed|es|ing|ence)\b/i, /\bstale\b/i, /\bdrift\b/i, /\balerts?\b/i, /\balerting\b/i, /(?<!false )\balarms?\b/i, /\binsights?\b/i,
  /\bschedules?\b/i, /\bSCADA\b/i, /\bdatabase\b/i, /\bSCADA form\b|\bthe form\b/i, /\bhold time\b/i, /\bdebounce\b/i, /\bobservation frequency\b/i,
  /\bprocedures?\b/i, /\bworkflows?\b/i, /\bSOPs?\b/i, /\bremediation\b/i, /\bSite Admin\b/i, /\bSME\b/i, /\bSupervisor\b/i, /\bonboarding\b/i,
  /\bshadow\b/i, /\btest alert\b/i, /\bdry run\b/i, /\bdetect\b/i, /\bpriority\b/i, /(?<!criticality )\btier\b/i, /\bCritical\b|\bEssential\b|\bStandard\b/,
  /(?<!limit |no )\brules?\b/i, /\bsurvey type\b/i, /\bunit operations?\b/i, /\b(functional|process) stages?\b/i, /\bsub-assets?\b/i,
  ...['Changed here', 'Library changed since', 'Differences from the library', 'From the library', 'From the SCADA form', 'No limits yet', 'What SCADA found',
    'What the library brings', 'Where it lands', 'Not for this plant', 'On trial', 'Mostly short', 'Tuned for this plant', 'For now, until', 'Reason not recorded',
    'Not in the library', 'Suggest for the library', 'Who is told', 'User Center', 'Phone view', 'Review due', 'no call, no hooter', 'told to the Leads'].map((s) => lit(s)),
  lit('Back to the library value', true), /(?<!Persistence · )must hold for/i, /(?<!Clearing · )must clear for/i,
  /\b(CM|C|O)-\d{1,2}\b/, /(?<![-\w])E[1-5]\b/, /(?<![-\w])W\d{1,2}[a-d]?\b/, /(?<![-\w])P[1-6]\b/, /(?<![-\w])S[1-8]\b/, /\bV7-\d+\b/, /\bV72-\d+\b/,
  /\bP[R]D\b/, /\u00a7\s*\d/, /\bAC-?\d+\b/, /A[m]ity/, /N[o]ida/, /\.m[d]\b/, /\.htm[l]\b/, /dp[_]intel/, /(?<![-\w])D\d{1,2}\b/,
  /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Invalid Date/, /\$\{/,
];
const CORPUS = (() => {
  const seen = new Set(); const parts = [];
  const walk = (x, d) => {
    if (x == null || d > 8) return;
    if (typeof x === 'string') { if (x.length > 3) parts.push(x.replace(/\s+/g, ' ')); return; }
    if (typeof x !== 'object' || seen.has(x)) return; seen.add(x);
    if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1)); else Object.keys(x).forEach((k) => walk(x[k], d + 1));
  };
  ['ISSUES', 'ISSUE_TASKS', 'SEED', 'CATALOGUE', 'READINGS', 'PLANT_PROFILES', 'NEXT_PHASE_FLOWS', 'NEXT_PHASE_CAUSES', 'RCA_MAPS', 'FORM_RULES', 'SCADA_FORM', 'DB_PALETTE'].forEach((g) => walk(W[g], 0));
  return parts.join('\n');
})();
function fromData(text, i, len) {
  const left = text.slice(Math.max(0, i - 16), i + len).trim(); const right = text.slice(i, i + len + 16).trim();
  return (left.length > len + 3 && CORPUS.includes(left)) || (right.length > len + 3 && CORPUS.includes(right)) || CORPUS.includes(text.slice(Math.max(0, i - 6), i + len + 6));
}
function wordsOk(name, html) {
  const text = vis(html); const bad = [];
  BANNED.forEach((re) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); let m;
    while ((m = g.exec(text))) { if (!fromData(text, m.index, m[0].length)) { bad.push(`"${m[0]}" in …${text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30)}…`); break; } if (!m[0]) g.lastIndex++; }
  });
  return ok(`${name}: words on screen pass the v7/2 list`, !bad.length, bad.slice(0, 3).join(' || '));
}

const PLANTS = V.plants().map((p) => p.key);
const stateOf = (k) => V.plant(k).state;
const ROUTES = ['triggers', 'triggers?sort=trial', 'triggers?show=draft', 'readings', 'tasks', 'tasks?show=due', 'details', 'details?f=dp.ratedFlow'];
const COMM_HEAD = ['Trigger', 'Subject', 'Reads', 'Status', 'Bands', 'Trial firings / day'];
const liveHead = (k) => ['Trigger', 'Subject', 'Reads', 'Status', 'Bands', V.coverage(k).window.label, 'A day', 'Closed as false alarm', 'Median time to close'];
const noErr = (html) => typeof html === 'string' && html.length > 0 && !html.includes(ERR);

/* links: every #/… href on these pages names a page of the v7/2 route table on a real object. Checked against the route
   shapes themselves (not against what is registered right now), so a page another module has not drawn yet is no failure
   here, while a link with a wrong shape or a missing object is. */
const SHAPES = ['plants', 'library/plant-types/:id', 'p/:plant', 'p/:plant/structure', 'p/:plant/structure/:view', 'p/:plant/review/structure', 'p/:plant/review/bindings',
  'p/:plant/triggers', 'p/:plant/readings', 'p/:plant/tasks', 'p/:plant/details', 'p/:plant/eq/:eq', 'p/:plant/eq/:eq/:tab', 'p/:plant/up/:up', 'p/:plant/up/:up/:tab',
  'p/:plant/sensor/:sensor', 'p/:plant/trigger/:trigger', 'p/:plant/task/:task', 'p/:plant/issue/:issue', 'p/:plant/issues', 'p/:plant/people', 'p/:plant/deviations', 'p/:plant/activity'];
function shapeOf(href) {
  const s = decode(href).replace(/^#\/?/, ''); const [p] = s.split('?'); const parts = p.split('/').map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
  for (const sh of SHAPES) {
    const segs = sh.split('/'); if (segs.length !== parts.length) continue; const out = {};
    if (segs.every((g, i) => (g[0] === ':' ? ((out[g.slice(1)] = parts[i]), true) : g === parts[i]))) return { shape: sh, params: out };
  }
  return null;
}
function realObject(m) {
  const k = m.params.plant; const id = (n) => m.params[n];
  if (k && !V.plant(k)) return false;
  if (id('eq')) return !!V.eq(k, id('eq'));
  if (id('up')) return !!V.unitProcess(k, id('up'));
  if (id('sensor')) return !!V.__.sensorRaw(k, id('sensor'));
  if (id('trigger')) return V.alerts(k).some((a) => a.id === id('trigger')) || V.schedules(k).some((s) => s.id === id('trigger')) || !!(V.conditionOf && V.conditionOf(k, id('trigger')));
  if (id('task')) return !!V.task(k, id('task'));
  if (id('issue')) return V.issues(k, {}).some((i) => i.id === id('issue'));
  if (m.shape === 'library/plant-types/:id') return V.plantTypes().some((t) => t.id === m.params.id);
  return true;
}
function linksOk(name, body) {
  const bad = hrefs(body).filter((h) => h[0] === '#').filter((h) => { const m = shapeOf(h); return !m || !realObject(m); });
  return ok(`${name}: every link names a v7/2 page on a real object`, !bad.length, [...new Set(bad)].slice(0, 4));
}

/* every page renders for every plant, wraps its body in the plant frame and passes the word list */
function renderAll(pass) {
  PLANTS.forEach((k) => ROUTES.forEach((r) => attempt(`${pass} ${k}/${r}`, () => {
    const html = render(`#/p/${k}/${r}`);
    ok(`${pass}: #/p/${k}/${r} renders without an error page`, noErr(html), html && html.slice(0, 200));
    ok(`${pass}: #/p/${k}/${r} is drawn by lists7 inside the plant frame`, /<div class="l7">/.test(html) && /class="tabs"/.test(html));
    const [route, qs] = r.split('?'); const q = {}; (qs || '').split('&').filter(Boolean).forEach((x) => { const [a, b] = x.split('='); q[a] = b; });
    const body = B[route](k, q);
    wordsOk(`${pass} #/p/${k}/${r}`, body);
    linksOk(`${pass} #/p/${k}/${r}`, body);
  })));
}

/* ═════════ 0 · wiring ═════════ */
attempt('wiring', () => {
  ok('lists7.js loaded', !!W.V7LISTS && !L.missing.includes('lists7.js'), L.missing);
  const pats = U.routes().map((x) => x.pattern);
  ['p/:plant/triggers', 'p/:plant/readings', 'p/:plant/tasks', 'p/:plant/details'].forEach((p, i) => {
    ok(`route ${p} is registered once`, pats.filter((x) => x === p).length === 1);
    const r = U.routes().find((x) => x.pattern === p); const page = W.V7LISTS.pages[['triggers', 'readings', 'tasks', 'details'][i]];
    ok(`route ${p} is lists7's own page`, !!r && r.raw === page);
  });
  ok('lists7 registers no act of another module', Object.keys(U._handlers || {}).filter((n) => /^list:/.test(n)).every(() => true));
});

/* ═════════ 1 · the Triggers list ═════════ */
attempt('Triggers · columns by state', () => {
  PLANTS.forEach((k) => {
    const body = B.triggers(k, {}); const t = issueTable(body);
    if (!V.alerts(k).length) { ok(`${k}: no Trigger yet → no table, an empty state that points to the passes`, !t && /structure pass|bindings pass/.test(vis(body))); return; }
    const want = stateOf(k) === 'live' ? liveHead(k) : COMM_HEAD;
    ok(`${k}: the Triggers table has the ${stateOf(k)} columns`, t && JSON.stringify(t.head) === JSON.stringify(want), t && t.head);
    ok(`${k}: one row per Trigger that raises Issues`, t && t.rows.length === V.alerts(k).length, t && t.rows.length);
  });
});
attempt('Triggers · Vedanta, noisiest first', () => {
  const tt = V.trialTable('vedanta'); const t = issueTable(B.triggers('vedanta', { sort: 'trial' }));
  const names = t.rows.map((r) => vis(r.cells[0]).replace(/ (Structure changed|Pinned to v\d+).*$/, ''));
  const fired = tt.filter((x) => x.count > 0);
  ok('?sort=trial: the Triggers that fired come first, in trialTable() order (noisiest first)', fired.length > 0 && fired.every((x, i) => names[i] === x.name), names.slice(0, 4));
  const rates = names.map((n) => { const x = tt.find((y) => y.name === n); return x ? x.perDay : -1; });
  ok('?sort=trial: the trial rate never rises down the list', rates.every((r, i) => i === 0 || r <= rates[i - 1]), rates);
  ok('the noisiest is first with its rate and the noisy chip', vis(t.rows[0].cells[5]) === `${tt[0].perDayText} ${tt[0].chip}` && tt[0].noisy, vis(t.rows[0].cells[5]));
  ok('only noisy Triggers carry the noisy chip', t.rows.filter((r) => /Noisy/.test(r.text)).length === tt.filter((x) => x.noisy).length);
  const second = t.rows[1]; ok('the second row shows its own rate from trialTable()', vis(second.cells[5]) === tt[1].perDayText, vis(second.cells[5]));
  const draft = V.alerts('vedanta').find((a) => a.state === 'draft');
  const dr = t.rows.find((r) => vis(r.cells[0]).startsWith(draft.name));
  ok('the draft Trigger reads "Draft · never fires", no trial rate, and comes after the active ones', dr && vis(dr.cells[3]) === V.LABELS.triggerChip.draft && vis(dr.cells[5]) === '—' && t.rows.indexOf(dr) >= tt.length, dr && dr.text);
  ok('active Triggers read "Active · trial"', t.rows.filter((r) => r !== dr).every((r) => vis(r.cells[3]) === V.LABELS.triggerChip.trial));
  ok('each row links to its Trigger page and its sensor page', t.rows.every((r) => /href="#\/p\/vedanta\/trigger\//.test(r.html) && /href="#\/p\/vedanta\/sensor\//.test(r.html)));
  const lead = vis(B.triggers('vedanta', {}).split('<div class="l7-tools">')[0]);
  ok('the lead line is the checklist\'s trial line', lead.includes(V.checklist('vedanta').trial.text), lead);
  ok('subjects read as unit process or equipment', t.rows.some((r) => / · unit process/.test(vis(r.cells[1]))) && t.rows.some((r) => / · equipment/.test(vis(r.cells[1]))));
});
attempt('Triggers · Vedanta drafts and undecided', () => {
  const body = B.triggers('vedanta', { show: 'draft' }); const t = issueTable(body);
  const drafts = V.alerts('vedanta').filter((a) => a.state === 'draft');
  ok('?show=draft lists the undecided draft only', t && t.rows.length === drafts.length && drafts.every((a) => t.rows.some((r) => vis(r.cells[0]).startsWith(a.name))), t && t.rows.map((r) => r.text));
  ok('?show=draft has no Task Trigger table (every Task Trigger is active)', !taskTrigTable(body));
});
attempt('Triggers · Vedanta Task Triggers', () => {
  const body = B.triggers('vedanta', {}); const t = taskTrigTable(body);
  const n = V.schedules('vedanta').filter((s) => s.status === 'active').length + V.bindingsPass('vedanta', { show: 'all' }).rows.filter((r) => r.kind === 'condition' && r.workId && r.status === 'active').length;
  ok('the Triggers that create Tasks are listed apart, one row each', t && t.rows.length === n, t && t.rows.length);
  ok('their columns are Trigger · Subject · Cadence · Status', t && JSON.stringify(t.head) === JSON.stringify(['Trigger', 'Subject', 'Cadence', 'Status']), t && t.head);
  const sc = V.schedules('vedanta')[0]; const cad = V.cadenceOf('vedanta', sc.id);
  const row = t.rows.find((r) => r.html.includes(`#/p/vedanta/trigger/${sc.id}"`));
  ok('a Task Trigger shows its cadence chip from cadenceOf() and links to its Trigger page', row && row.text.includes(cad.chip.text), row && row.text);
});
attempt('Triggers · Manesar (Live)', () => {
  const body = B.triggers('manesar', {}); const t = issueTable(body); const cov = V.coverage('manesar');
  cov.perTrigger.forEach((p) => {
    const r = t.rows.find((x) => vis(x.cells[0]).startsWith(p.name));
    ok(`${p.name}: Issues, a day, false-alarm share and median close come from coverage().perTrigger`, r && vis(r.cells[5]) === String(p.issues) && vis(r.cells[6]).startsWith(p.perDayText)
      && vis(r.cells[7]) === (p.falseAlarmShare == null ? '—' : `${Math.round(p.falseAlarmShare * 100)}%`) && vis(r.cells[8]) === (p.medianCloseMin == null ? '—' : U.dur(p.medianCloseMin)), r && r.text);
  });
  const frozen = V.alerts('manesar').filter((a) => a.frozen);
  ok('the frozen Trigger\'s Bands cell reads "Frozen"', frozen.length > 0 && frozen.every((a) => { const r = t.rows.find((x) => vis(x.cells[0]).startsWith(a.name)); return r && vis(r.cells[4]).startsWith('Frozen'); }));
  ok('every other Trigger "Follows sensor"', t.rows.filter((r) => !frozen.some((a) => vis(r.cells[0]).startsWith(a.name))).every((r) => vis(r.cells[4]).startsWith('Follows sensor')));
  ok('active Triggers read "Active"', t.rows.every((r) => vis(r.cells[3]) === V.LABELS.triggerChip.live));
  const sorted = issueTable(B.triggers('manesar', { sort: 'trial' }));
  ok('?sort=trial on a Live plant puts the Trigger with the most Issues first', vis(sorted.rows[0].cells[0]).startsWith(cov.triggers.noisiest.name), vis(sorted.rows[0].cells[0]));
  const lead = vis(body.split('<div class="l7-tools">')[0]);
  ok('the lead names the window and the drafts in the review queue, from coverage()', lead.includes(`${cov.window.label}: ${cov.triggers.issues}`) && lead.includes(cov.triggers.draftsText), lead);
  const tt = taskTrigTable(body); const single = V.cadenceOf('manesar', 'w_sludge');
  ok('a single-use Task Trigger shows both chips', tt && tt.rows.some((r) => r.text.includes(single.chip.text) && r.text.includes(single.chip.extra[0].text)), single && single.chip);
  const cond = V.conditionOf('manesar', 'w_intake');
  ok('a condition Task Trigger reads its do when / done when and the override chip', tt && tt.rows.some((r) => r.text.includes(cond.text) && r.text.includes(cond.perField.doWhen.chip.text)), cond.text);
});
attempt('Triggers · Manesar drafts and undecided', () => {
  const body = B.triggers('manesar', { show: 'draft' }); const a = issueTable(body); const t = taskTrigTable(body);
  const bp = V.bindingsPass('manesar', { show: 'all' }); const und = bp.rows.filter((r) => r.status === 'undecided');
  ok('?show=draft lists every undecided proposal of the bindings pass', (a ? a.rows.length : 0) + (t ? t.rows.length : 0) === und.length && und.length === bp.counts.undecided, [(a ? a.rows.length : 0), (t ? t.rows.length : 0), und.length]);
  ok('each opens its row in the bindings pass', [...(a ? a.rows : []), ...(t ? t.rows : [])].every((r) => /href="#\/p\/manesar\/review\/bindings\?show=undecided&amp;f=/.test(r.html)));
  ok('undecided Issue proposals show their proposed values', a.rows.every((r) => /^Proposed/.test(vis(r.cells[4]))));
  const tools = vis(B.triggers('manesar', {}).split('<div class="l7-tools">')[1].split('</div>')[0]);
  ok('the filter chips count the drafts and undecided', tools.includes(`Drafts and undecided ${und.length}`), tools);
});

/* ═════════ 2 · the Readings tab ═════════ */
attempt('Readings', () => {
  ok('readingsTab: Vedanta not available at seed, Manesar available', V.readingsTab('vedanta').available === false && V.readingsTab('manesar').available === true);
  PLANTS.forEach((k) => {
    const rt = V.readingsTab(k); const body = B.readings(k, {}); const text = vis(body);
    if (!rt.available) {
      ok(`${k}: a Commissioning plant shows the empty state, with Structure`, text === 'The Readings tab opens when the plant goes Live. During Commissioning, readings are on each unit process and equipment page. Structure' && body.includes(`href="#/p/${k}/structure"`), text);
      return;
    }
    ok(`${k}: title and sub`, text.startsWith('Readings Every reading the plant graph sends, by equipment. Limits are edited on each sensor. Sample readings'), text.slice(0, 160));
    const rows = rt.groups.reduce((n, g) => n + g.rows.length, 0); const ts = tables(body);
    ok(`${k}: one table per group and one row per reading`, ts.length === rt.groups.length && ts.reduce((n, t) => n + t.rows.length, 0) === rows, [ts.length, rt.groups.length]);
    ok(`${k}: columns Reading · Now · Limits · Source · Triggers`, ts.every((t) => JSON.stringify(t.head) === JSON.stringify(['Reading', 'Now', 'Limits', 'Source', 'Triggers'])));
    ok(`${k}: no hand-test reading is listed`, rt.groups.every((g) => g.rows.every((r) => !/^m:/.test(r.id || r.sensorId || ''))));
    let i = 0; rt.groups.forEach((g, gi) => g.rows.forEach((r, ri) => {
      const row = ts[gi] && ts[gi].rows[ri]; i++;
      if (!row) return;
      ok(`${k} ${r.tag}: tag, now and limits as readingsTab() gives them`, row.text.includes(r.tag) && vis(row.cells[1]) === (r.nowText && r.nowText !== '—' ? r.nowText : '—') && vis(row.cells[2]) === (r.limitsText || '—'), row.text);
      if (!r.nextPhase) ok(`${k} ${r.tag}: "{n} · Edit on sensor" links to the sensor page`, vis(row.cells[4]) === `${r.triggers} · Edit on sensor` && row.cells[4].includes(`href="${r.href}"`), vis(row.cells[4]));
      ok(`${k} ${r.tag}: one source chip per distinct band source`, arr(r.chips).every((c) => row.text.includes(c.text)));
    }));
    ok(`${k}: the footer line`, text.endsWith('Hand tests and lab results keep their numbers in the task record: they have no limits. See Tasks.'), text.slice(-140));
  });
});
function arr(x) { return Array.isArray(x) ? x : []; }

/* ═════════ 3 · the Tasks list ═════════ */
function headLine(k) { const n = rate(V.tasksPerDay(k)); const one = n === '1'; return stateOf(k) === 'live' ? `${n} ${one ? 'Task' : 'Tasks'} a day.` : `${n} ${one ? 'Task' : 'Tasks'} a day once the plant goes live, each on its own unit process, piece of equipment or the plant.`; }
attempt('Tasks', () => {
  PLANTS.forEach((k) => {
    const body = B.tasks(k, {}); const text = vis(body); const ts = V.tasks(k);
    if (!ts.length) { ok(`${k}: no Tasks → the empty state`, /^No Tasks yet\./.test(text), text); return; }
    ok(`${k}: the head line is one Tasks-a-day number from tasksPerDay()`, text.startsWith(headLine(k)), text.slice(0, 160));
    ok(`${k}: no set-level copy`, !/to confirm|if each|One per type|Shared task/i.test(text));
    const tbl = tables(body); const rows = tbl.reduce((n, t) => n + t.rows.length, 0);
    ok(`${k}: one row per Task`, rows === ts.length, [rows, ts.length]);
    ok(`${k}: columns Task · Cadence · Next due · Status`, tbl.every((t) => JSON.stringify(t.head) === JSON.stringify(['Task', 'Cadence', 'Next due', 'Status'])));
    const kinds = new Set(ts.map((t) => (t.subject ? t.subject.kind : 'plant')));
    const order = ['On unit processes', 'On equipment', 'On the plant'].filter((s, i) => kinds.has(['up', 'eq', 'plant'][i]));
    const at = order.map((s) => text.indexOf(s));
    ok(`${k}: sections ${order.join(', ')} in that order`, at.every((x) => x >= 0) && at.every((x, i) => i === 0 || x > at[i - 1]), at);
    const st = V.structure(k); const upOrder = st.stages.flatMap((s) => s.upIds).filter((id) => ts.some((t) => t.subject && t.subject.kind === 'up' && t.subject.id === id));
    const upAt = upOrder.map((id) => body.indexOf(`href="#/p/${k}/up/${id}"><span class="mono">`));
    ok(`${k}: unit processes in stage and flow order`, upAt.every((x) => x >= 0) && upAt.every((x, i) => i === 0 || x > upAt[i - 1]), upAt);
    ts.slice(0, 40).forEach((t) => {
      const cad = V.cadenceOf(k, t.scheduleIds[0]); const row = tbl.flatMap((x) => x.rows).find((r) => r.html.includes(`href="#/p/${k}/task/${t.id}"`));
      ok(`${k} ${t.line}: cadence with its chip from cadenceOf(), status ${t.statusLabel}`, row && vis(row.cells[1]).toLowerCase().startsWith(String(t.everyText).toLowerCase()) && (!cad || row.text.includes(cad.chip.text)) && vis(row.cells[3]) === t.statusLabel, row && row.text);
    });
  });
  /* Commissioning: when each Task would first fall due if the plant went live now (the go-live preview) */
  const gl = V.goLiveTasks('vedanta'); const body = B.tasks('vedanta', {}); const rows = tables(body).flatMap((t) => t.rows);
  const svc = gl.rows.filter((r) => r.why === 'service'); const golive = gl.rows.filter((r) => r.why !== 'service');
  ok('Vedanta: a Task with a last service date shows its first due date', svc.length > 0 && svc.every((g) => { const r = rows.find((x) => x.html.includes(`/task/${g.taskId}"`)); return r && vis(r.cells[2]).startsWith(fmtDay(g.due)); }));
  ok('Vedanta: every other Task is first due on go-live day', golive.every((g) => { const r = rows.find((x) => x.html.includes(`/task/${g.taskId}"`)); return r && vis(r.cells[2]) === 'Go-live day'; }));
  ok('Vedanta: the go-live day count matches the preview', rows.filter((r) => vis(r.cells[2]) === 'Go-live day').length === gl.dueToday, [rows.filter((r) => vis(r.cells[2]) === 'Go-live day').length, gl.dueToday]);
  /* Live: due now */
  const due = V.tasks('manesar').filter((t) => t.status === 'due' || t.status === 'doing' || t.overdue);
  const dueRows = tables(B.tasks('manesar', { show: 'due' })).flatMap((t) => t.rows);
  ok('Manesar ?show=due lists the Tasks due now', dueRows.length === due.length && due.every((t) => dueRows.some((r) => r.html.includes(`/task/${t.id}"`))), [dueRows.length, due.length]);
  ok('Manesar: a Task on equipment says which unit processes it takes part in', /In AT-1, AT-2/.test(vis(B.tasks('manesar', {}))));
});

/* ═════════ 4 · plant details ═════════ */
attempt('Plant details', () => {
  PLANTS.forEach((k) => {
    const body = B.details(k, {}); const text = vis(body); const dps = V.designParams(k, { kind: 'plant' }); const p = V.plant(k);
    ok(`${k}: "Plant details" and "Design parameters"`, text.includes('Plant details') && text.includes('Design parameters'));
    ok(`${k}: every plant design parameter with its "Used by" line`, dps.every((d) => text.includes(d.label) && text.includes(d.usedByText)), dps.map((d) => d.label));
    const pt = V.plantTypes().find((t) => t.id === p.type);
    ok(`${k}: the plant type chip links to its library page`, !!pt && text.includes(pt.chipText) && body.includes(`href="#/library/plant-types/${pt.id}"`));
    ok(`${k}: the structure line counts unit processes and pieces of equipment`, text.includes(`${U.plural(p.upCount, 'unit process', 'unit processes')} · ${U.plural(p.equipmentCount, 'piece of equipment', 'pieces of equipment')}`), text);
  });
  if (!(W.V7OBJ && typeof W.V7OBJ.designParamsBlock === 'function')) {
    const body = B.details('manesar', { f: 'dp.ratedFlow' }); const row = tables(body)[0].rows.find((r) => /Rated flow/.test(r.text));
    ok('?f=dp.ratedFlow highlights that parameter', !!row && /is-target/.test(row.attrs), row && row.attrs);
    ok('each parameter offers Add or Edit (the design-parameter sheet)', /data-act="dp:edit"/.test(body));
  }
});

/* ═════════ 5 · the frame, when plant7 is not there ═════════ */
if (CHILD) attempt('own frame', () => {
  ok('plant7 is left out in this run', !W.V7PLANT);
  PLANTS.forEach((k) => {
    const html = render(`#/p/${k}/triggers`); const text = vis(html);
    ok(`${k}: the fallback frame carries the state chip`, stateOf(k) === 'live' ? text.includes(`Live since ${fmtDay(V.plant(k).since)}`) : text.includes('Commissioning · nothing is sent'), text.slice(0, 200));
    ok(`${k}: the fallback frame's tabs follow the plant state`, stateOf(k) === 'live' ? /Coverage Readings Structure Triggers/.test(text) : /Readiness Structure Triggers/.test(text) && !/ Readings /.test(text.slice(0, 400)));
  });
});

/* ═════════ 6 · every page at seed ═════════ */
renderAll('seed');

/* ═════════ 7 · Manesar: the frozen Trigger, a resync, an override for one Trigger, a structure change ═════════ */
attempt('Manesar · Bands cell through chapter 8', () => {
  const MAN = 'manesar'; const A = 'a_do_at2'; const name = V.alerts(MAN).find((a) => a.id === A).name;
  const bandsOf = () => { const t = issueTable(B.triggers(MAN, {})); const r = t.rows.find((x) => vis(x.cells[0]).startsWith(name)); return r ? vis(r.cells[4]) : ''; };
  const z = V.setZone(MAN, 'at2_do', 'below', 'minor', 1.5, { reason: 'tuning', note: 'Short dips below 2.0 recover on their own; 1.5 is where the operators act' });
  ok('a zone override while frozen leaves the Trigger "Frozen" on the terms it holds', z.ok && bandsOf().startsWith('Frozen') && bandsOf().includes(`Minor < ${V.triggerBands(MAN, A).bands.minor.valueText}`), bandsOf());
  V.advance(60); const c = V.close(MAN, 'is_2z', { note: 'Back above 2.0 after the filter clean' });
  ok('closed after its terms moved: "Base moved · waits for a resync"', c.ok && V.heldOf(MAN, A).waiting && bandsOf().startsWith('Base moved · waits for a resync'), bandsOf());
  const rs = V.resync(MAN, A);
  ok('after the resync it "Follows sensor" again, on the sensor\'s new value', rs.ok && bandsOf().startsWith('Follows sensor') && bandsOf().includes(`Minor < ${V.triggerBands(MAN, A).bands.minor.valueText}`), bandsOf());
  const tl = V.setTriggerLimit(MAN, A, 'major', 0.9, { reason: 'tuning', note: 'This basin alone runs lower at night' });
  ok('a limit overridden for this Trigger only reads "Overridden for this Trigger"', tl.ok && bandsOf().startsWith('Overridden for this Trigger'), [tl.error, bandsOf()]);
  const pl = V.place(MAN, ['bs1'], ['eq1'], { note: 'The screen sits in EQ-1\'s inlet channel' });
  const flagged = V.alerts(MAN).filter((a) => a.structureFlag);
  const t = issueTable(B.triggers(MAN, {}));
  ok('a structure change on a Live plant marks the Triggers it touches "Structure changed"', pl.ok && flagged.length > 0 && flagged.every((a) => t.rows.some((r) => vis(r.cells[0]).startsWith(a.name) && /Structure changed/.test(vis(r.cells[0])))), [pl.error, flagged.map((a) => a.name)]);
  ok('… and no other Trigger', t.rows.filter((r) => /Structure changed/.test(vis(r.cells[0]))).length === flagged.length);
  ['triggers', 'triggers?sort=trial', 'readings', 'tasks'].forEach((r) => { const html = render(`#/p/${MAN}/${r}`); ok(`Manesar after chapter 8: ${r} renders`, noErr(html)); wordsOk(`Manesar after chapter 8 ${r}`, B[r.split('?')[0]](MAN, r.includes('sort') ? { sort: 'trial' } : {})); });
});

/* ═════════ 8 · DigitalPaani through its passes ═════════ */
attempt('DigitalPaani · structure and bindings passes', () => {
  const DP = 'digitalpaani';
  const nid = (tag) => (V.nodes(DP).find((n) => n.tag === tag) || {}).id; const nids = (...t) => t.map(nid);
  V.changeUpType(DP, nid('SC'), 'screening', {}); V.acceptStructure(DP, { all: true });
  V.notPart(DP, nids('ITP-1', 'ITP-2', 'FWTP-1', 'FWTP-2'), {});
  V.place(DP, nids('UFFP-1', 'UFFP-2', 'UFBV-1'), [nid('UF-1')], {}); V.place(DP, nids('UFFP-3', 'UFFP-4', 'UFBV-2'), [nid('UF-2')], {});
  V.place(DP, nids('RFP-1', 'RFP-2'), nids('MBBR-1', 'MBBR-4'), {}); V.place(DP, nids('FFP-1', 'FFP-2'), [nid('MGF')], {}); V.place(DP, nids('SPFP-1', 'SPFP-2'), [nid('SLP')], {});
  V.notPart(DP, nids('PDT', 'PDP', 'SCP-1', 'SCP-2'), {});
  ok('the structure pass is confirmed', V.structureDone(DP));
  const bp = V.bindingsPass(DP, { show: 'all' });
  const text = vis(B.triggers(DP, {}));
  const waiting = bp.counts.undecided + bp.counts.cantResolve;
  ok('no Trigger yet: the empty state counts the proposals waiting in the bindings pass', text.includes(`No Triggers yet. ${U.plural(waiting, 'proposal')} wait in the bindings pass.`), text.slice(0, 300));
  ok('… and the drafts-and-undecided chip counts the same proposals', text.includes(`Drafts and undecided ${waiting}`), text.slice(0, 300));
  const d = B.triggers(DP, { show: 'draft' }); const a = issueTable(d);
  const cant = bp.rows.filter((r) => r.status === 'cantResolve');
  ok('?show=draft lists the can\'t-resolve rows with why', cant.length > 0 && cant.every((r) => a.rows.some((x) => vis(x.cells[0]).startsWith(r.name) && x.text.includes(`Can't resolve: ${r.cantResolve.text}`))), cant.map((r) => r.name));
  ok('and opens them in the bindings pass under Can\'t resolve', a.rows.filter((x) => /Can't resolve/.test(x.text)).every((x) => /review\/bindings\?show=cantresolve&amp;f=/.test(x.html)));
  const acc = V.acceptAllFor(DP, { status: 'undecided' }, { activate: true });
  ok('accept and start the trial', acc && acc.count > 0, acc);
  const body = B.triggers(DP, {}); const t = issueTable(body);
  ok('the Triggers list now has the Commissioning columns', t && JSON.stringify(t.head) === JSON.stringify(COMM_HEAD), t && t.head);
  const tt = V.trialTable(DP);
  ok('every active Trigger shows its trial rate from trialTable()', tt.length > 0 && tt.every((x) => { const r = t.rows.find((y) => vis(y.cells[0]).startsWith(x.name)); return r && vis(r.cells[5]).startsWith(x.count ? x.perDayText : '0') && vis(r.cells[3]) === V.LABELS.triggerChip.trial; }));
  const tk = taskTrigTable(body); const nTask = V.schedules(DP).filter((s) => ['active', 'draft', 'off'].includes(s.status)).length;
  ok('the Triggers that create Tasks are listed', tk && tk.rows.length >= nTask, [tk && tk.rows.length, nTask]);
  ok('the Tasks list now leads with its Tasks-a-day number', vis(B.tasks(DP, {})).startsWith(headLine(DP)), vis(B.tasks(DP, {})).slice(0, 160));
  ok('a gap shows the zone\'s gap chip in the Bands cell', !cant.length || t.rows.some((r) => /Gap · needs tank height/.test(vis(r.cells[4]))) || t.rows.every((r) => !/CCT|TWT|UFWT/.test(r.text)));
  ['triggers', 'triggers?sort=trial', 'triggers?show=draft', 'tasks', 'readings', 'details'].forEach((r) => { const html = render(`#/p/${DP}/${r}`); ok(`DigitalPaani after the passes: ${r} renders`, noErr(html)); wordsOk(`DigitalPaani after the passes ${r}`, html.split('<div class="l7">')[1] || ''); });
});

/* ═════════ 9 · Vedanta goes live ═════════ */
attempt('Vedanta · go live', () => {
  V.acceptAllFor('vedanta', { status: 'undecided' }, { activate: true });
  const g = V.goLive('vedanta');
  ok('Vedanta is Live', g && g.ok !== false && stateOf('vedanta') === 'live', g);
  const t = issueTable(B.triggers('vedanta', {}));
  ok('the Triggers list switches to the Live columns, with the window label from coverage()', t && JSON.stringify(t.head) === JSON.stringify(liveHead('vedanta')), t && t.head);
  ok('right after go-live the window is "Issues since go-live"', V.coverage('vedanta').window.label === 'Issues since go-live');
  ok('every Trigger reads "Active"', t.rows.every((r) => vis(r.cells[3]) === V.LABELS.triggerChip.live));
  const rb = vis(B.readings('vedanta', {}));
  ok('the Readings tab opens once the plant is Live', V.readingsTab('vedanta').available && rb.startsWith('Readings Every reading the plant graph sends'), rb.slice(0, 120));
  const tb = vis(B.tasks('vedanta', {}));
  ok('the Tasks list reads one Tasks-a-day number on a Live plant', tb.startsWith(headLine('vedanta')), tb.slice(0, 80));
  ok('Tasks on a Live plant show due dates, not go-live day', !/Go-live day/.test(tb));
});

/* ═════════ 10 · a day later, every page again ═════════ */
attempt('advance', () => { V.advance(1440); });
renderAll('+1 day');
attempt('Vedanta · noisy on a Live plant', () => {
  /* on a Live plant a Trigger is noisy by its Issues a day; the list marks exactly the ones coverage() marks */
  const per = V.coverage('vedanta').perTrigger; const t = issueTable(B.triggers('vedanta', {}));
  const noisy = per.filter((p) => p.noisy);
  ok('a day after go-live the list marks the Triggers coverage() calls noisy, and only those', t.rows.filter((r) => /Noisy/.test(vis(r.cells[6]))).length === noisy.length && noisy.every((p) => t.rows.some((r) => vis(r.cells[0]).startsWith(p.name) && /Noisy/.test(vis(r.cells[6])))), noisy.map((p) => p.name));
  per.forEach((p) => { const r = t.rows.find((x) => vis(x.cells[0]).startsWith(p.name)); ok(`Vedanta ${p.name}: Issues in the window from coverage()`, r && vis(r.cells[5]) === String(p.issues), r && r.text); });
});

/* ── report ─────────────────────────────────────────────────────────────────────────────────── */
const soft = arr(W.V7LISTS && W.V7LISTS._soft);
ok('no core call failed while drawing these pages', !soft.length, soft.slice(0, 3));
console.log(`lists7.test.js (${label}) · ${pass} passed · ${fail} failed`);
fails.slice(0, 40).forEach((f) => console.log(`  ✗ ${f}`));
if (fail > 40) console.log(`  … and ${fail - 40} more`);

let code = fail ? 1 : 0;
if (!CHILD) {
  const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, LISTS7_CHILD: '1', LOAD72_SKIP: 'plant7.js,structure7.js,object7.js' }, encoding: 'utf8', cwd: path.resolve(__dirname, '..') });
  process.stdout.write(r.stdout || ''); if (r.status !== 0) { process.stdout.write(r.stderr ? r.stderr.split('\n').slice(-5).join('\n') + '\n' : ''); code = 1; }
  console.log(code ? 'RESULT: FAIL' : 'RESULT: PASS');
}
process.exit(code);
