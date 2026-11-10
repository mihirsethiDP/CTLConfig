#!/usr/bin/env node
/* v7/2 · tests/work7.test.js — headless test of work7.js (window.V7WORK): the Issues list, the Issue page, the Task page and
   Report a problem, in Alex's model. Node only, no dependencies.
   Loads the v7/2 prototype through load72.js, renders the three work routes for every plant, Issue and Task, and walks the
   live-operation chapter through the page handlers (fake elements stand in for clicks):
     Manesar's open "DO low · AT-2": crumbs through the stage and the unit process, "Subject: AT-2 · Activated sludge", the terms it
     opened under, the frozen line (a zone override while it is open leaves it on its terms), question 2 No → "Caused by BL-1" with
     its log line, the fix's Action flow, the step that opens a general Task and comes back, +1 hour, Verify Yes → closed and the
     Trigger waits for a resync; ?close=false-alarm opens the false-alarm close, which asks why.
     Vedanta in Commissioning: no Issues, and the list says why; its Tasks wait for go-live with first due dates from the last
     service dates. Report a problem on a unit process, on equipment and on the whole plant. Tasks on a Live plant: cadence
     read-only with its source chip and the link to the Task's Trigger page; ticks, done → next due. Then the clock moves a day.
   Every page is checked against the v7/2 word list (verbatim library and workbook text exempt) and every link against the
   v7/2 routes.
   Usage: TZ=Asia/Calcutta node tests/work7.test.js [-v]     Exit code 0 = pass. */
'use strict';
const L = require('./load72.js');

const VERBOSE = process.argv.includes('-v');
const W = L.window; const V = L.V7; const U = L.V7UI; const K = W.V7WORK;
const results = []; let fails = 0; const warns = new Set();
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail }); if (!ok) fails++; }
const J = (x) => { try { return JSON.stringify(x); } catch (e) { return String(x); } };

/* ── page text, links and the v7/2 word list ────────────────────────────────────────────────────────────────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', mdash: '—', ndash: '–', rarr: '→', larr: '←', hellip: '…', times: '×', rsaquo: '›', lsaquo: '‹' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(n) ? String.fromCodePoint(n) : m; } return ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m; });
const MARK_RE = /<aside class="dec-mark"[\s\S]*?<\/aside>/g;   /* the decisions strip quotes the cards: not this page's own words */
const visibleText = (html) => decode(String(html || '').replace(MARK_RE, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const linksOf = (html) => { const out = new Set(); const re = /\s(?:href|data-href)\s*=\s*"([^"]*)"/gi; let m; while ((m = re.exec(String(html || '').replace(MARK_RE, ' ')))) { const v = decode(m[1]); if (v[0] === '#') out.add(v); } return [...out]; };
const BANNED72 = [
  /\bmachines?\b/i, /\bassets?\b/i, /\bwidgets?\b/i, /\bestates?\b/i, /\bportfolio\b/i, /\bcustom\b/i, /\bdetach(ed)?\b/i, /\bfork(ed|s)?\b/i,
  /\bdiverg(e|ed|es|ing|ence)\b/i, /\bstale\b/i, /\bdrift\b/i, /\balerts?\b/i, /\balerting\b/i, /(?<!false )\balarms?\b/i, /\binsights?\b/i,
  /\bschedules?\b/i, /\bSCADA\b/i, /\bdatabase\b/i, /\bSCADA form\b|\bthe form\b/i, /\bhold time\b/i, /\bdebounce\b/i, /\bobservation frequency\b/i,
  /\bprocedures?\b/i, /\bworkflows?\b/i, /\bSOPs?\b/i, /\bremediation\b/i, /\bSite Admin\b/i, /\bSME\b/i, /\bSupervisor\b/i, /\bonboarding\b/i,
  /\bshadow\b/i, /\btest alert\b/i, /\bdry run\b/i, /\bdetect\b/i, /\bpriority\b/i, /(?<!criticality )\btier\b/i, /\bCritical\b|\bEssential\b|\bStandard\b/,
  /(?<!limit |no )\brules?\b/i, /\bsurvey type\b/i, /\bunit operations?\b/i, /\b(functional|process) stages?\b/i, /\bsub-assets?\b/i,
  /Changed here/i, /Library changed since/i, /Differences from the library/i, /From the library/i, /From the SCADA form/i, /No limits yet/i,
  /What SCADA found/i, /What the library brings/i, /Where it lands/i, /Not for this plant/i, /On trial/i, /Mostly short/i, /Tuned for this plant/i,
  /For now, until/i, /Reason not recorded/i, /Not in the library/i, /Back to the library value/, /Suggest for the library/i, /Who is told/i,
  /User Center/i, /Phone view/i, /Review due/i, /no call, no hooter/i, /told to the Leads/i, /(?<!Persistence · )must hold for/i, /(?<!Clearing · )must clear for/i,
  /\b(CM|C|O)-\d{1,2}\b/, /(?<![-\w])E[1-5]\b/, /(?<![-\w])W\d{1,2}[a-d]?\b/, /(?<![-\w])P[1-6]\b/, /(?<![-\w])S[1-8]\b/, /\bV7-\d+\b/, /\bV72-\d+\b/,
  /\bAC-?\d+\b/, /\.html\b/, /(?<![-\w])D\d{1,2}\b/,
  ['a document code', /\bPRD\b/],
  ['a section sign', /§\s*\d/],
  ['a private name', /Amity/],
  ['a private place', /Noida/],
  ['a file name', /\.md\b/],
  ['an internal name', /dp_intel/],
  /\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /Invalid Date/, /\$\{/,
].map((x) => (Array.isArray(x) ? x[1] : x));
/* verbatim library and workbook text: a banned word inside it is a data word, not this page's copy */
const CORPUS = (() => {
  const seen = new Set(); const parts = [];
  const walk = (x, d) => { if (x == null || d > 8) return; if (typeof x === 'string') { if (x.length > 3) parts.push(x.replace(/\s+/g, ' ')); return; } if (typeof x !== 'object' || seen.has(x)) return; seen.add(x); if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1)); else Object.keys(x).forEach((k) => walk(x[k], d + 1)); };
  ['ISSUES', 'ISSUE_TASKS', 'SEED', 'CATALOGUE', 'READINGS', 'PLANT_PROFILES', 'NEXT_PHASE_FLOWS', 'NEXT_PHASE_CAUSES', 'RCA_MAPS', 'FORM_RULES', 'SCADA_FORM', 'DB_PALETTE'].forEach((g) => walk(W[g], 0));
  return parts.join('\n');
})();
const isData = (text, i, len) => { const left = text.slice(Math.max(0, i - 16), i + len).trim(); const right = text.slice(i, i + len + 16).trim(); return (left.length > len + 3 && CORPUS.includes(left)) || (right.length > len + 3 && CORPUS.includes(right)) || CORPUS.includes(text.slice(Math.max(0, i - 6), i + len + 6)); };
function wordHits(text) {
  const out = [];
  for (const re of BANNED72) { const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); let m; while ((m = g.exec(text))) { if (!isData(text, m.index, m[0].length)) { out.push(`"${m[0]}" in …${text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 40)}…`); break; } if (!m[0]) g.lastIndex++; } }
  return out;
}

/* the v7/2 routes and the objects they name: a link here must be one of them, on a real object */
const ROUTES = ['plants', 'activity/:plant?', 'p/:plant/activity', 'p/:plant', 'p/:plant/people', 'p/:plant/people/service-dates', 'p/:plant/review/bindings', 'p/:plant/library',
  'p/:plant/triggers', 'p/:plant/readings', 'p/:plant/tasks', 'p/:plant/details', 'p/:plant/structure/:view?', 'p/:plant/review/structure', 'p/:plant/cg/:id', 'p/:plant/equipment',
  'p/:plant/review', 'p/:plant/eq/:id/:tab?', 'p/:plant/up/:id/:tab?', 'p/:plant/sensor/:id', 'p/:plant/trigger/:id', 'library', 'library/eq-types', 'library/eq-types/:code/:tab?',
  'library/up-types', 'library/up-types/:id/:tab?', 'library/templates', 'library/templates/:id', 'library/plant-types', 'library/plant-types/:id/:tab?', 'library/conditions/:id?',
  'library/flows/:id?', 'library/root-causes/:id?', 'deviations', 'p/:plant/deviations', 'p/:plant/issues', 'p/:plant/issue/:id', 'p/:plant/task/:id', 'decisions', 'decisions/:id'];
function routeOf(href) {
  const [path] = href.replace(/^#\//, '').split('?'); const segs = path.split('/').filter(Boolean).map(decodeURIComponent);
  for (const pat of ROUTES) {
    const ps = pat.split('/'); const need = ps.filter((x) => !x.endsWith('?')).length; if (segs.length < need || segs.length > ps.length) continue;
    const params = {}; let ok = true;
    ps.forEach((p, i) => { if (!ok) return; const s = segs[i]; if (p[0] === ':') { if (s != null) params[p.replace(/[:?]/g, '')] = s; } else if (s !== p) ok = false; });
    if (ok) return { pattern: pat, params };
  }
  return null;
}
function objectOk(r) {
  const p = r.params; if (p.plant && !V.plants().some((x) => x.key === p.plant)) return `no plant ${p.plant}`;
  if (r.pattern === 'p/:plant/issue/:id' && !V.issue(p.plant, p.id)) return `no Issue ${p.id}`;
  if (r.pattern === 'p/:plant/task/:id' && !V.task(p.plant, p.id) && !(W.ISSUE_TASKS || []).some((x) => x.id === p.id)) return `no Task ${p.id}`;
  if (r.pattern === 'p/:plant/up/:id/:tab?' && !(V.isUp ? V.isUp(p.plant, p.id) : V.eq(p.plant, p.id))) return `${p.id} is not a unit process`;
  if (r.pattern === 'p/:plant/eq/:id/:tab?' && (!V.eq(p.plant, p.id) || (V.isUp && V.isUp(p.plant, p.id)))) return `${p.id} is not a piece of equipment`;
  if (r.pattern === 'p/:plant/sensor/:id' && !V.sensors(p.plant).some((s) => s.id === p.id)) return `no sensor ${p.id}`;
  if (r.pattern === 'p/:plant/trigger/:id' && !V.alert(p.plant, p.id) && !V.task(p.plant, p.id)) return `no Trigger ${p.id}`;
  if (r.pattern === 'library/eq-types/:code/:tab?' && !(W.CATALOGUE || []).some((c) => c.code === p.code)) return `no equipment type ${p.code}`;
  return '';
}

/* a render: the real page must not throw; its own words and links are checked with a plain frame around the Issues list, so
   the plant frame's words stay the plant page's own test's business */
let renders = 0; let scanned = 0; let linksSeen = 0; const STUB_FRAME = { frame: (k, a, body) => body };
function render(hash, o) {
  renders++; W.location.hash = hash;
  const m = U.match(hash); if (!m) throw new Error('no route for ' + hash);
  const html = m.route.fn(m.params);
  const real = W.V7PLANT; W.V7PLANT = STUB_FRAME; let own;
  try { own = m.route.fn(m.params); } finally { W.V7PLANT = real; }
  if (!(o && o.quiet)) {
    scanned++;
    wordHits(visibleText(own)).forEach((h) => check('words', `${hash}: ${h.slice(0, 40)}`, false, h));
    for (const href of linksOf(own)) {
      const r = routeOf(href); linksSeen++;
      if (!r) { check('links', `${hash} links to ${href}: not a v7/2 route`, false); continue; }
      const bad = objectOk(r); if (bad) check('links', `${hash} links to ${href}: ${bad}`, false);
      if (!U.match(href) || (U.match(href).pattern === 'plants' && r.pattern !== 'plants')) warns.add(`${href} has no page yet (its module is still being written)`);
    }
  }
  return { html, own, text: visibleText(html), ownText: visibleText(own) };
}
const has = (r, s) => r.text.includes(s);
/* a fake element: data-* attributes, a value, and a root (modal or form) answering querySelector for named fields */
function fakeRoot(fields, radios) {
  const rs = new Set(radios || []);
  return { querySelector(sel) { let m = sel.match(/name="([^"]+)"\]:checked/); if (m) return rs.has(m[1]) && fields[m[1]] != null && fields[m[1]] !== '' ? { value: String(fields[m[1]]) } : null; m = sel.match(/\[name="([^"]+)"\]/); if (m && !rs.has(m[1]) && fields[m[1]] != null) return { value: String(fields[m[1]]), type: 'text' }; return null; } };
}
function el(data, o) { o = o || {}; const root = o.root || null; return Object.assign({ tagName: o.tagName || 'BUTTON', getAttribute: (k) => { const kk = k.replace(/^data-/, ''); return data[kk] != null ? String(data[kk]) : null; }, closest: () => root, value: o.value }, root && o.value == null ? { querySelector: root.querySelector } : {}); }
const act = (name, data, o) => { const fn = U._handlers[name]; if (!fn) throw new Error('no handler ' + name); return fn(el(data, o), {}); };
const toast = () => (U._last && U._last.toast) || '';
const modal = () => (U._last && U._last.modal) || {};

/* ── 1. load, routes, exports; every page renders ─────────────────────────────────────────────────────────── */
check('load', `work7.js loaded with the core (${L.loaded.length} files${L.missing.length ? '; not written yet: ' + L.missing.join(', ') : ''})`, L.loaded.includes('work7.js') && !!K && !!V && !L.errors.some((e) => /work7/.test(e.file)), J(L.errors.map((e) => e.file)));
const routeSet = new Set(U.routes().map((r) => r.pattern));
['p/:plant/issues', 'p/:plant/issue/:id', 'p/:plant/task/:id'].forEach((p) => check('load', `route ${p}`, routeSet.has(p)));
['issuesPage', 'issuePage', 'taskPage', 'openReport', 'report', 'reportButton', 'issueList', 'issueItem', 'issueChips', 'statusChip', 'toldSummary', 'subjectChip', 'hrefIssue', 'hrefTask'].forEach((f) => check('load', `V7WORK.${f}`, typeof K[f] === 'function'));
['work:cadence', 'work:cadence-save', 'work:lastdone', 'work:suggest', 'work:usercenter'].forEach((a) => check('load', `no "${a}": the Task page edits no cadence and no last service`, !U._handlers[a]));
function renderAll(label) {
  let n = 0; let thrown = 0;
  const tryR = (h) => { try { render(h); n++; } catch (e) { thrown++; check('render', `${label} ${h}`, false, e.stack); } };
  for (const p of V.plants()) {
    ['', '?show=up', '?show=eq', '?show=plant', '?show=false', '?show=open', '?show=closed', '?n=all'].forEach((q) => tryR(`#/p/${p.key}/issues${q}`));
    for (const i of V.issues(p.key, {})) { tryR(`#/p/${p.key}/issue/${i.id}`); if (i.status !== 'closed') tryR(`#/p/${p.key}/issue/${i.id}?close=false-alarm`); }
    for (const t of V.tasks(p.key, {})) tryR(`#/p/${p.key}/task/${encodeURIComponent(t.id)}`);
  }
  ['#/p/manesar/issue/nope', '#/p/manesar/task/nope', '#/p/nowhere/issues', '#/p/manesar/issues?eq=bl1', '#/p/manesar/task/t_mb_suction_filter'].forEach(tryR);
  check('render', `${label}: ${n} pages render without a throw`, thrown === 0 && n > 50, `${n} pages, ${thrown} threw`);
}
renderAll('start');

const M = 'manesar'; const VE = 'vedanta'; const DP = 'digitalpaani'; const B = 'bawal';
const plantName = (k) => V.plants().find((p) => p.key === k).name;

/* ── 2. Vedanta in Commissioning: no Issues, and the list says why ───────────────────────────────────────── */
let r = render(`#/p/${VE}/issues`);
check('vedanta', 'V72-58: "No Issues. While Vedanta ETP is in Commissioning, Triggers record trial firings only, at every severity: nothing is sent."', V.issues(VE, {}).length === 0 && has(r, 'No Issues. While Vedanta ETP is in Commissioning, Triggers record trial firings only, at every severity: nothing is sent.'), r.ownText.slice(0, 400));
check('vedanta', '"See the trial firings" → the Triggers list sorted by trial firings', has(r, 'See the trial firings') && r.own.includes(`href="#/p/${VE}/triggers?sort=trial"`));
check('vedanta', 'a person can still report a problem', has(r, 'Report a problem') && /data-act="work:report"/.test(r.own));
r = render(`#/p/${DP}/issues`);
check('vedanta', 'DigitalPaani says the same with its own name', has(r, `No Issues. While ${plantName(DP)} is in Commissioning, Triggers record trial firings only, at every severity: nothing is sent.`));
/* its Tasks wait for go-live; a PM Task's first due date counts from its equipment's last service date */
const sd = V.serviceDates(VE); const dated = sd.rows.find((x) => x.date != null); const undated = sd.rows.find((x) => x.date == null);
const gl = V.goLiveTasks(VE, V.now());
const vtD = V.tasks(VE, {}).find((t) => t.workType === 'pm' && t.subject && t.subject.id === dated.eqId && (gl.rows.find((x) => x.taskId === t.id) || {}).why === 'service');
r = render(`#/p/${VE}/task/${encodeURIComponent(vtD.id)}`);
const rowD = gl.rows.find((x) => x.taskId === vtD.id);
check('vedanta', 'a Task before go-live: "Starts at go live", the Commissioning chip, its Action flow to read, nothing to tick', has(r, 'Starts at go live') && has(r, 'Commissioning · nothing is sent') && has(r, 'Tasks start when the plant goes live') && !/data-act="work:taskstep"/.test(r.html) && !/data-act="work:taskdone"/.test(r.html));
check('vedanta', `first due from the last service date: "first due ${V.fmt(rowD.due)}", "Last service ${dated.dateText}"`, has(r, `If the plant went live now: first due ${V.fmt(rowD.due)}, counted from its last service date`) && has(r, `Last service ${dated.dateText}`), r.ownText.slice(0, 600));
if (undated) {
  const vtU = V.tasks(VE, {}).find((t) => t.workType === 'pm' && t.subject && t.subject.id === undated.eqId);
  if (vtU) { r = render(`#/p/${VE}/task/${encodeURIComponent(vtU.id)}`); check('vedanta', 'a PM Task with no service date: due on go-live day; "Not entered" links to Last service dates', has(r, 'Next due On go-live day') && has(r, 'Not entered') && r.own.includes(`href="#/p/${VE}/people/service-dates"`), r.ownText.slice(0, 500)); }
}
const vtR = V.tasks(VE, {}).find((t) => t.workType !== 'pm');
if (vtR) { r = render(`#/p/${VE}/task/${encodeURIComponent(vtR.id)}`); check('vedanta', 'other work has no service date: it falls due on go-live day', has(r, 'No service date: it falls due on go-live day')); }

/* ── 3. Manesar: the open Issue on AT-2 ─────────────────────────────────────────────────────────────────────── */
const doIss = V.issues(M, { status: 'open' }).find((i) => i.alertId === 'a_do_at2');
check('manesar', 'an open Issue "DO low · AT-2" on the unit process AT-2 at the start', !!doIss && doIss.title === 'DO low · AT-2' && doIss.subject && doIss.subject.kind === 'up' && doIss.subject.id === 'at2', J(doIss && doIss.subject));
const ID = doIss.id;
r = render(`#/p/${M}/issues`);
const all = V.issues(M, {}); const kinds = { up: 0, eq: 0, plant: 0 }; all.forEach((i) => { kinds[(i.subject && i.subject.kind) || 'plant']++; });
check('list', 'filter chips "All · Unit processes · Equipment · The plant" with counts from the Issues', has(r, `All ${all.length} Unit processes ${kinds.up} Equipment ${kinds.eq} The plant ${kinds.plant}`), r.ownText.slice(0, 300));
check('list', 'open first: "Open · 1" leads, then "Closed · …"; the row has its subject chip "AT-2 · unit process"', /Open · 1 Issue Subject Severity Status When DO low · AT-2 AT-2 · unit process Major Diagnosing/.test(r.ownText) && r.ownText.indexOf('Open · 1') < r.ownText.indexOf('Closed · '), r.ownText.slice(0, 500));
check('list', 'the row opens the Issue; the subject chip, when it is this file\'s own, opens the unit process', r.own.includes(`data-href="#/p/${M}/issue/${ID}"`) && (!!(W.V7STRUCT && W.V7STRUCT.subjectChip) || r.own.includes(`href="#/p/${M}/up/at2"`)));
r = render(`#/p/${M}/issues?show=eq`);
const eqIss = all.filter((i) => i.subject && i.subject.kind === 'eq');
check('list', '?show=eq lists only Issues on equipment (none at Manesar\'s seed: BL-1\'s Caution firings raise its intake-filter Task)', eqIss.every((i) => r.own.includes(`/issue/${i.id}"`)) && !r.own.includes(`/issue/${ID}"`) && /Equipment \d+/.test(r.ownText));
r = render(`#/p/${M}/issues?show=plant`);
check('list', '?show=plant: none at Manesar, said plainly', has(r, 'No Issues on the plant itself.'));
r = render(`#/p/${M}/issues?show=false`);
check('list', '?show=false lists only false alarms', has(r, 'Closed · false alarm') && !has(r, 'Diagnosing'));

r = render(`#/p/${M}/issue/${ID}`);
const sAT2 = V.sensors(M).find((s) => s.id === doIss.sensorId); const flow0 = V.flowOf(doIss.diag.flowId);
check('issue', 'crumbs through the stage and the subject: "All Plants › Manesar STP › Secondary › AT-2"', r.text.includes('All Plants › Manesar STP › Secondary › AT-2 › DO low · AT-2'), r.text.slice(0, 120));
check('issue', 'the stage crumb opens the Structure page at that stage; the subject crumb the unit process', (!!(W.V7STRUCT && W.V7STRUCT.stageCrumb) || r.own.includes(`href="#/p/${M}/structure?stage=secondary"`)) && r.own.includes(`href="#/p/${M}/up/at2"`));
check('issue', 'V72-76: "Subject: AT-2 · Activated sludge"', has(r, 'Subject: AT-2 · Activated sludge'));
check('issue', `V72-76: "${V.issueTerms(M, ID).text}"`, V.issueTerms(M, ID).text === 'Opened under: Major < 1.0 mg/L · persistence 0 min · clearing 15 min' && has(r, V.issueTerms(M, ID).text));
const FROZEN = `This Trigger is frozen while this Issue is open: changes on ${sAT2.tag} show as Base moved on the Trigger until someone resyncs it.`;
check('issue', 'V72-76: the frozen line while its Trigger is held', V.heldOf(M, 'a_do_at2').frozen && has(r, FROZEN), r.ownText.slice(-1500, -700));
check('issue', 'Live plant chip "Live since Tue 1 Sep"; the Trigger "DO low · AT-2" with its status, linked to its page; the reading to its sensor page', has(r, `Live since ${V.fmtDay(V.plants().find((p) => p.key === M).since)}`) && r.own.includes(`href="#/p/${M}/trigger/a_do_at2"`) && r.own.includes(`href="#/p/${M}/sensor/${sAT2.id}"`) && /Trigger DO low · AT-2 Active/.test(r.text));
check('issue', `question 1 answered Yes by Dheeraj Kumar at 07:50; the runner at question 2 of up to ${flow0.steps.length}`, has(r, `Is the blower running? · Dheeraj Kumar, ${V.fmtTime(doIss.diag.path[0].at)} Yes`) && has(r, `Question 2 of up to ${flow0.steps.length}`) && has(r, flow0.steps[1].text) && /data-answer="No"/.test(r.html));
check('issue', 'the steps read "Diagnostic flow · Root cause · Fix · Verify"', ['Diagnostic flow', 'Root cause', 'Fix', 'Verify'].every((t) => r.html.includes(`<h2>${t}</h2>`)));
const roles = [...new Set(doIss.told.filter((x) => x.how !== 'hooter').map((x) => x.role))];
check('issue', 'who was told, from the record: roles, ways and every person; the roster is on the People tab', roles.every((x) => has(r, x)) && has(r, 'a full-screen warning in the app') && doIss.told.every((x) => x.how === 'hooter' || has(r, x.who)) && r.own.includes(`href="#/p/${M}/people"`) && has(r, K.toldSummary(doIss)));
check('issue', '"Diagnostic flow started by …" in the log (Alex\'s word for the diagnosis)', !doIss.log.some((l) => /^Diagnosis started/.test(l.text)) || (has(r, 'Diagnostic flow started by') && !/\bDiagnosis started\b/.test(r.text)));
check('issue', '"Close as a false alarm" is offered, quietly', has(r, 'Close as a false alarm') && /data-act="work:false"/.test(r.html));

/* ?close=false-alarm: the close asks why first */
r = render(`#/p/${M}/issue/${ID}?close=false-alarm`);
check('false', 'V72-76: ?close=false-alarm opens the false-alarm close at the top, asking why', /class="card wk-false is-target"/.test(r.html) && has(r, 'Why was it a false alarm?') && r.text.indexOf('Why was it a false alarm?') < r.text.indexOf('Diagnostic flow') && ['The reading came back by itself', 'The limit is too tight for this plant', 'Something else'].every((x) => has(r, x)));
check('false', '"Then override the zone on its sensor, with a reason" beside "The limit is too tight for this plant"', has(r, 'Then override the zone on its sensor, with a reason'));
act('work:false-go', { plant: M, id: ID }, { root: fakeRoot({ 'wk-why': '', 'wk-note': '' }, ['wk-why']), tagName: 'FORM' });
r = render(`#/p/${M}/issue/${ID}?close=false-alarm`);
check('false', 'without a reason it is refused, and the form says so', V.issue(M, ID).status !== 'closed' && has(r, 'Say why it was a false alarm.'));
act('work:false-go', { plant: M, id: ID }, { root: fakeRoot({ 'wk-why': 'Something else', 'wk-note': '' }, ['wk-why']), tagName: 'FORM' });
r = render(`#/p/${M}/issue/${ID}?close=false-alarm`);
check('false', '"Something else" needs a note', V.issue(M, ID).status !== 'closed' && has(r, 'Write a note for "Something else".'));

/* a zone override while the Issue is open: the Trigger keeps its terms, the Issue says so */
const zo = V.setZone ? V.setZone(M, sAT2.id, 'below', 'minor', 1.5, { reason: 'tuning', note: 'Short dips below 2.0 recover on their own; 1.5 is where the operators act' }) : { ok: false, error: 'no setZone' };
r = render(`#/p/${M}/issue/${ID}`);
check('issue', 'after a zone override on DO-AT2: still "Opened under …" unchanged and the frozen line', zo.ok && has(r, V.issueTerms(M, ID).text) && !V.issueTerms(M, ID).changed && has(r, FROZEN), zo.error);

/* the diagnostic flow: question 1 again is refused, question 2 No lands on BL-1 */
act('work:answer', { plant: M, id: ID, step: flow0.steps[0].id, answer: 'Yes' });
check('issue', 'question 1 cannot be answered again: it stays at question 2', V.issue(M, ID).diag.path.length === 1);
act('work:answer', { plant: M, id: ID, step: flow0.steps[1].id, answer: 'No' });
let iss = V.issue(M, ID); const cause = V.causeOf(iss.diag.causeId);
check('issue', 'question 2 No → root cause "Intake filter blocked", caused by BL-1', !!cause && /Intake filter blocked/.test(cause.name) && iss.causedBy === 'bl1', `${iss.diag.causeId} ${iss.causedBy}`);
check('issue', 'the toast names the root cause and where it sits', /^Root cause found: Intake filter blocked, on BL-1/.test(toast()), toast());
r = render(`#/p/${M}/issue/${ID}`);
check('issue', '"Caused by BL-1" with its log line "Caused by BL-1 (Blower; takes part in AT-2)"', has(r, 'Caused by BL-1 Caused by BL-1 (Blower; takes part in AT-2)') && iss.log.some((l) => l.text === 'Caused by BL-1 (Blower; takes part in AT-2)'), r.ownText.slice(0, 900));
check('issue', 'BL-1 links to its Issues tab; "Start the fix"', r.own.includes(`href="#/p/${M}/eq/bl1/issues"`) && has(r, 'Start the fix'));
r = render(`#/p/${M}/issues?eq=bl1`);
check('list', 'BL-1\'s Issues include the one it caused: "Caused here · about AT-2"', has(r, 'DO low · AT-2') && has(r, 'Caused here · about AT-2') && has(r, 'Only BL-1, and the Issues it caused'));

/* the fix: its Action flow; the step naming a general Task opens it and comes back */
act('work:startfix', { plant: M, id: ID });
iss = V.issue(M, ID); const fixFlow = V.flowOf(iss.fix.flowId);
check('issue', 'Start the fix → fixing, with the cause\'s Action flow', iss.status === 'fixing' && !!fixFlow && /Fix started: .+Action flow/.test(toast()), toast());
r = render(`#/p/${M}/issue/${ID}`);
check('issue', 'the Fix step: "Action flow · …", numbered steps with ticks, "0 of n done"', has(r, `Action flow · `) && /data-act="work:fixstep"/.test(r.html) && has(r, `0 of ${fixFlow.steps.length} done`));
const linked = fixFlow.steps.find((s) => { const lt = V.linkedTask(s); return lt && lt.kind === 'task'; });
const lk = (r.own.match(/href="(#\/p\/manesar\/task\/[^"]+)"/) || [])[1] || '';
check('issue', 'a fix step links to its general Task: "Open the Task: Blower suction filter cleaning", carrying the Issue and the step', !!linked && has(r, 'Open the Task: Blower suction filter cleaning') && new RegExp(`from=${ID}`).test(lk) && new RegExp(`step=${linked.id}`).test(lk.replace(/&amp;/g, '&')), lk);
const back = decode(lk);
r = render(back);
check('issue', 'the Task page: a general Task this plant has no Task for, its Action flow, "Done: back to the Issue"', has(r, 'General Task') && has(r, `${plantName(M)} has no Task for this`) && has(r, 'Done: back to the Issue') && has(r, `Part of the fix for "DO low · AT-2", step ${fixFlow.steps.indexOf(linked) + 1}.`), r.ownText.slice(0, 500));
act('work:return', { plant: M, id: ID, step: U.match(back).params._q.step });
iss = V.issue(M, ID);
check('issue', '"Done: back to the Issue" ticks that step and returns to the Issue', iss.fix.done.map(String).includes(String(linked.id)) && W.location.hash === `#/p/${M}/issue/${ID}`, `${J(iss.fix.done)} ${W.location.hash}`);
fixFlow.steps.filter((s) => !iss.fix.done.map(String).includes(String(s.id))).forEach((s) => act('work:fixstep', { plant: M, id: ID, step: s.id, answer: s.type === 'question' ? 'No' : undefined }));
iss = V.issue(M, ID);
check('issue', 'every step done → verifying; the toast says to verify with the readings', iss.status === 'verifying' && /verify with the readings/.test(toast()), `${iss.status} · ${toast()}`);
r = render(`#/p/${M}/issue/${ID}`);
check('issue', 'Verify: "Do the readings show it worked?" with the reading now and "Yes: close the Issue"', has(r, 'Do the readings show it worked?') && /Now \d/.test(r.text) && has(r, 'Yes: close the Issue') && has(r, 'No: back to the diagnostic flow'));

/* +1 hour, Verify Yes → closed; the Trigger's terms moved while it was frozen, so it waits for a resync */
V.advance(60);
act('work:verify', { plant: M, id: ID, ok: 1 });
iss = V.issue(M, ID); const h = V.heldOf(M, 'a_do_at2');
check('issue', '+1 hour, Verify Yes → closed', iss.status === 'closed' && V.fmt(iss.closed) === V.fmt(V.now()));
check('issue', 'the toast says the Trigger now waits for a resync', h.waiting && /^Verified and closed\. DO low · AT-2 now waits for a resync/.test(toast()), `${J({ waiting: h.waiting })} ${toast()}`);
r = render(`#/p/${M}/issue/${ID}`);
check('issue', 'the closed Issue: how and how long, no false-alarm close, no frozen line; the Trigger waiting, with a link', has(r, `Closed: ${cause.name.replace(/[.\s]+$/, '')}.`) && /Took \d/.test(r.text) && !has(r, 'Close as a false alarm') && !has(r, FROZEN) && has(r, 'Since this Issue closed, DO low · AT-2 keeps the terms it was frozen on') && r.own.includes(`href="#/p/${M}/trigger/a_do_at2"`), r.ownText.slice(0, 400));
r = render(`#/p/${M}/issue/${ID}?close=false-alarm`);
check('false', '?close=false-alarm on a closed Issue says it is already closed', has(r, 'This Issue is already closed.') && !has(r, 'Why was it a false alarm?'));

/* ── 4. Report a problem: a unit process, equipment, the whole plant ─────────────────────────────────────── */
let rb = K._reportBody(M, null); let rt = visibleText(rb);
const ups = V.unitProcesses(M); const eqs = V.equipment(M);
const optOrder = [...rb.matchAll(/<option value="(up|eq):([^"]+)"/g)].map((m) => m[2]);
const ST = ['preliminary', 'primary', 'secondary', 'tertiary', 'sludge']; const rank = (id) => { const u = ups.find((x) => x.id === id); const i = ST.indexOf(u && u.stage); return i < 0 ? 99 : i; };
const upOpts = optOrder.filter((id) => ups.some((u) => u.id === id));
check('report', 'V72-77: "What is it about?" with optgroups Unit processes, Equipment and The whole plant', /What is it about\?/.test(rt) && /<optgroup label="Unit processes">/.test(rb) && /<optgroup label="Equipment">/.test(rb) && /<optgroup label="The whole plant">/.test(rb) && /<option value="plant"/.test(rb));
check('report', 'V72-77: every unit process (by stage) and every piece of equipment is offered', upOpts.length === ups.length && upOpts.every((id, i) => i === 0 || rank(upOpts[i - 1]) <= rank(id)) && eqs.every((e) => optOrder.includes(e.id)), J(upOpts));
rb = K._reportBody(M, 'plant'); rt = visibleText(rb);
check('report', 'V72-77: the whole plant: "No problems are written for the whole plant yet. Report it on the unit process or equipment where you saw it."', rt.includes('No problems are written for the whole plant yet. Report it on the unit process or equipment where you saw it.') && !/name="wk-it"/.test(rb));
K.openReport(M, 'plant');
check('report', 'the whole plant: "Report it" is disabled', /Report it/.test(modal().foot || '') && /disabled/.test((modal().foot || '').split('Report it')[0].split('<button').pop()));
let before = V.issues(M, {}).length;
act('work:report-go', { plant: M }, { root: fakeRoot({ 'wk-subj': 'plant' }, []) });
check('report', 'reporting on the whole plant is refused with the same sentence', V.issues(M, {}).length === before && /No problems are written for the whole plant yet/.test(visibleText(modal().body || '')));
act('work:report-go', { plant: M }, { root: fakeRoot({ 'wk-subj': '' }, []) });
check('report', 'nothing picked: "Pick what it is about first."', V.issues(M, {}).length === before && /Pick what it is about first\./.test(visibleText(modal().body || '')));
/* a unit process with no Issue types in the library */
const at2T = V.subjectOf(M, { kind: 'up', id: 'at2' });
rb = K._reportBody(M, 'up:at2'); rt = visibleText(rb);
check('report', 'a unit process whose type has no Issue types says so', V.issueTypesFor(M, { kind: 'up', id: 'at2' }).length > 0 || rt.includes(`The library has no Issues written for ${at2T.typeName} yet. Tell the Lead directly.`), rt.slice(0, 300));
/* equipment: BL-1 on a Live plant */
const blTypes = V.issueTypesFor(M, 'bl1');
rb = K._reportBody(M, 'bl1'); rt = visibleText(rb);
check('report', 'equipment: BL-1\'s Issue types, each with how it is found', blTypes.length > 0 && blTypes.every((t) => rt.includes(t.name)) && /Found by /.test(rt) && /<option value="eq:bl1" selected>/.test(rb), rt.slice(0, 300));
const ladder = V.routing(M).ladder;
check('report', 'Live plant: "How serious is it?" with who each severity reaches, from the routing', /How serious is it\?/.test(rt) && ['minor', 'major', 'emergency'].every((b) => rt.includes(ladder.find((l) => l.band === b).text.replace(/^[A-Za-z]+:\s*/, ''))));
before = V.issues(M, {}).length;
act('work:report-go', { plant: M }, { root: fakeRoot({ 'wk-subj': 'eq:bl1', 'wk-it': blTypes[0].id, 'wk-band': 'minor' }, ['wk-it', 'wk-band']) });
const repEq = V.issues(M, {}).find((i) => i.reported && i.subject && i.subject.id === 'bl1');
check('report', '"Report it" on BL-1 → an Issue about the equipment, and its page opens', !!repEq && V.issues(M, {}).length === before + 1 && repEq.subject.kind === 'eq' && W.location.hash === `#/p/${M}/issue/${repEq.id}` && /^Issue opened on BL-1: /.test(toast()), `${W.location.hash} ${toast()}`);
r = render(`#/p/${M}/issue/${repEq.id}`);
check('report', 'the reported Issue: "Subject: BL-1 · Blower", "What was reported", how it is usually found; crumbs through BL-1\'s stage', has(r, 'Subject: BL-1 · Blower') && has(r, 'What was reported') && /Usually found by/.test(r.text) && /All Plants › Manesar STP › \w+ › BL-1 › /.test(r.text), r.text.slice(0, 200));
/* an Issue type written for another subject is refused by the core, and the form says so */
const otherT = (() => { for (const p of V.plants()) for (const u of V.unitProcesses(p.key)) { const ts = V.issueTypesFor(p.key, { kind: 'up', id: u.id }); const t = ts.find((x) => !blTypes.some((y) => y.id === x.id)); if (t) return t; } return null; })();
if (otherT) { before = V.issues(M, {}).length; act('work:report-go', { plant: M }, { root: fakeRoot({ 'wk-subj': 'eq:bl1', 'wk-it': otherT.id }, ['wk-it']) }); check('report', 'an Issue type not written for BL-1 is refused', V.issues(M, {}).length === before && /not one of the problems written for/.test(visibleText(modal().body || '')), visibleText(modal().body || '').slice(-200)); }
/* a unit process with Issue types: the first such one at a Commissioning plant */
const upPick = (() => { for (const k of [VE, DP]) for (const u of V.unitProcesses(k)) { const ts = V.issueTypesFor(k, { kind: 'up', id: u.id }); if (ts.length) return { k, u, ts }; } return null; })();
check('report', 'a unit process with Issue types exists at a Commissioning plant', !!upPick);
if (upPick) {
  const { k, u, ts } = upPick;
  act('work:report', { plant: k, subject: `up:${u.id}` });
  rb = modal().body || ''; rt = visibleText(rb);
  check('report', `unit process ${u.tag} (${u.typeName}): its type's Issue types; no severity in Commissioning, which sends nothing`, ts.every((t) => rt.includes(t.name)) && new RegExp(`<option value="up:${u.id}" selected>`).test(rb) && !/How serious is it\?/.test(rt) && rt.includes(`${plantName(k)} is in Commissioning: nothing is sent.`), rt.slice(0, 300));
  check('report', '"Report it" is enabled once a subject with Issue types is picked', !/disabled/.test((modal().foot || '').split('Report it')[0].split('<button').pop()));
  before = V.issues(k, {}).length;
  act('work:report-go', { plant: k }, { root: fakeRoot({ 'wk-subj': `up:${u.id}`, 'wk-it': ts[0].id }, ['wk-it']) });
  const repUp = V.issues(k, {}).find((i) => i.reported && i.subject && i.subject.id === u.id);
  check('report', `"Report it" on ${u.tag} → an Issue about the unit process, nobody told in Commissioning`, !!repUp && repUp.subject.kind === 'up' && repUp.told.length === 0 && V.issues(k, {}).length === before + 1);
  r = render(`#/p/${k}/issue/${repUp.id}`);
  check('report', 'its page: the subject, "Nothing was sent: … was in Commissioning", the Commissioning chips', has(r, `Subject: ${u.tag} · ${u.typeName}`) && has(r, `Nothing was sent: ${plantName(k)} was in Commissioning`) && has(r, 'Opened in Commissioning') && has(r, 'Commissioning · nothing is sent'), r.ownText.slice(0, 400));
  r = render(`#/p/${k}/issues`);
  check('report', 'the Commissioning list now shows it, still saying why Triggers open none', r.own.includes(`/issue/${repUp.id}"`) && has(r, `While ${plantName(k)} is in Commissioning, Triggers record trial firings only, at every severity: nothing is sent.`) && !has(r, 'No Issues.'));
}
const btn = K.reportButton(M, 'at2');
check('report', 'a page\'s "Report a problem" button carries its subject (data-subject="up:at2")', /data-act="work:report"/.test(btn) && /data-subject="up:at2"/.test(btn));
act('work:report', { plant: M, eq: 'bl1' });
check('report', 'object pages that pass a node id still open it on that subject', modal().title === 'Report a problem' && /<option value="eq:bl1" selected>/.test(modal().body || ''));

/* the false-alarm close at the top of the page, done: closes, and the page drops the query */
act('work:false-go', { plant: M, id: repEq.id }, { root: fakeRoot({ 'wk-why': 'The sensor was being cleaned or calibrated', 'wk-note': 'Probe out for cleaning' }, ['wk-why']), tagName: 'FORM' });
iss = V.issue(M, repEq.id);
r = render(`#/p/${M}/issue/${repEq.id}`);
check('false', 'with a reason it closes as a false alarm, says why, and the page returns to the Issue', iss.status === 'closed' && iss.falseAlarm && W.location.hash === `#/p/${M}/issue/${repEq.id}` && has(r, 'Closed as a false alarm: The sensor was being cleaned or calibrated (Probe out for cleaning)') && /counts in Coverage/.test(toast()), `${iss.status} ${W.location.hash} ${toast()}`);
/* the modal path, from the Verify step's quiet button */
const openOne = V.issues(B, { status: 'open' })[0] || V.issues(M, { status: 'open' })[0];
if (openOne) { const k = openOne.plant || (V.issue(B, openOne.id) ? B : M); act('work:false', { plant: k, id: openOne.id }); check('false', 'the Verify step\'s "Close as a false alarm" opens the same close in a dialog', modal().title === 'Close as a false alarm' && /Why was it a false alarm\?/.test(visibleText(modal().body || ''))); }

/* ── 5. Tasks on a Live plant: cadence read-only, ticks, done → next due ──────────────────────────────────── */
const single = V.tasks(M, {}).find((t) => { const c = V.cadenceOf(M, t.scheduleIds[0]); return c && c.singleUse; });
if (single) {
  const c = V.cadenceOf(M, single.scheduleIds[0]);
  r = render(`#/p/${M}/task/${encodeURIComponent(single.id)}`);
  check('tasks', `a single-use template's Task: "${c.chip.text}" with "${(c.chip.extra || [])[0] && c.chip.extra[0].text}"`, has(r, `Cadence ${c.everyText} ${c.chip.text}`) && (c.chip.extra || []).every((x) => has(r, x.text)), r.ownText.slice(0, 400));
}
const lt = V.tasks(B, {}).find((t) => t.status === 'due' && t.steps.length) || V.tasks(M, {}).find((t) => t.status === 'due' && t.steps.length);
const LK = V.task(B, lt.id) ? B : M;
const cad = V.cadenceOf(LK, lt.scheduleIds[0]);
r = render(`#/p/${LK}/task/${encodeURIComponent(lt.id)}`);
check('tasks', 'cadence read-only with its source chip and "Edit on the Task\'s Trigger page" → the Task\'s Trigger page at its cadence', has(r, `Cadence ${cad.everyText} ${cad.chip.text}`) && has(r, 'Edit on the Task\'s Trigger page') && r.own.includes(`href="#/p/${LK}/trigger/${lt.scheduleIds[0]}?f=cadence"`), r.ownText.slice(0, 500));
check('tasks', 'no input for cadence or last service: "Last service" is read-only', !/name="wk-n"|type="date"|data-act="work:(cadence|lastdone)"/.test(r.html) && has(r, `Last service ${lt.lastDone != null ? V.fmt(lt.lastDone) : 'Not done at this plant yet'}`));
check('tasks', 'the subject, the Action flow with ticks and "Mark the Task done"', has(r, `On ${lt.subject.text}`) && has(r, 'Action flow') && /data-act="work:taskstep"/.test(r.html) && has(r, 'Mark the Task done'));
r = render(`#/p/${LK}/task/${encodeURIComponent(lt.id)}?f=cadence`);
check('tasks', '?f=cadence marks the cadence', /class="wk-cad is-target"/.test(r.html));
act('work:taskstep', { plant: LK, id: lt.id, step: lt.steps[0].id });
check('tasks', 'ticking a step marks it and starts the Task', V.task(LK, lt.id).done.length === 1 && V.task(LK, lt.id).status === 'doing');
const due0 = V.task(LK, lt.id).due;
act('work:taskdone', { plant: LK, id: lt.id });
const lt2 = V.task(LK, lt.id);
check('tasks', 'done → next due moves on by its cadence; the toast says when', lt2.due > due0 && lt2.status === 'upcoming' && toast() === `Done. Next due ${V.fmt(lt2.due)}.`, toast());

/* ── 6. issueList for the object pages: a unit process's own Issues and its participants' ───────────────────── */
const own = K.issueList(M, { upId: 'at2', includeShared: true, shared: 'none' });
const shared = K.issueList(M, { upId: 'at2', includeShared: true, shared: 'only' });
const blIss = V.issues(M, {}).filter((i) => i.subject && i.subject.id === 'bl1');
check('lists', 'issueList(upId): AT-2\'s own Issues; its participants\' carry "Shared · on BL-1"', own.includes(`/issue/${ID}"`) && blIss.length > 0 && blIss.every((i) => shared.includes(`/issue/${i.id}"`)) && visibleText(shared).includes('Shared · on BL-1') && !visibleText(own).includes('Shared · on'));
check('lists', 'issueList(eqId) with nothing: the empty line given', /No Issues on SP-1 here/.test(K.issueList(M, { eqId: 'sp1', status: 'open', empty: 'No Issues on SP-1 here.' })) || V.issues(M, { eqId: 'sp1', status: 'open' }).length > 0);

/* ── 7. the clock moves a day; every page still renders ──────────────────────────────────────────────────── */
const adv = V.advance(1440);
renderAll('+1 day');
check('clock', `+1 day: ${adv.opened.length} opened, ${adv.closed.length} closed; the list still leads with what is open`, (() => { const o = V.issues(M, { status: 'open' }); const t = render(`#/p/${M}/issues`).ownText; return o.length ? t.includes(`Open · ${o.length}`) && t.indexOf(`Open · ${o.length}`) < t.indexOf('Closed · ') : t.includes('Nothing is open'); })());
check('clock', 'Vedanta still opens no Issue from a Trigger', !V.issues(VE, {}).some((i) => i.alertId));

check('words', `every page passes the v7/2 word list (${scanned} pages; verbatim library and workbook text exempt)`, scanned > 100 && !results.some((x) => x.group === 'words' && !x.ok));
check('links', `every link is a v7/2 route on a real object (${linksSeen} links)`, linksSeen > 100 && !results.some((x) => x.group === 'links' && !x.ok));

/* ── report ─────────────────────────────────────────────────────────────────────────────────────────────────── */
const groups = [...new Set(results.map((x) => x.group))];
for (const g of groups) {
  const rs = results.filter((x) => x.group === g); const bad = rs.filter((x) => !x.ok);
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${g.padEnd(8)} ${rs.length - bad.length}/${rs.length}`);
  for (const x of (VERBOSE ? rs : bad)) console.log(`     ${x.ok ? '✓' : '✗'} ${x.name}${!x.ok && x.detail ? '\n         ' + String(x.detail).slice(0, 600).replace(/\n/g, '\n         ') : ''}`);
}
const uw = [...warns];
if (uw.length) { console.log(`notes (${uw.length}):`); uw.slice(0, VERBOSE ? 200 : 6).forEach((w) => console.log('     ' + w)); if (!VERBOSE && uw.length > 6) console.log(`     … ${uw.length - 6} more (-v)`); }
console.log(`work7: ${results.length - fails}/${results.length} checks pass · ${renders} renders${L.missing.length ? ' · not written yet: ' + L.missing.join(', ') : ''}`);
process.exit(fails ? 1 : 0);
