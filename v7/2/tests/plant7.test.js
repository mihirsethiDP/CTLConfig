#!/usr/bin/env node
/* v7/2 · tests/plant7.test.js — the plant pages (plant7.js, window.V7PLANT): the frame and its tabs, Readiness, Coverage, the
   bindings pass, People, Last service dates, and the go-live, return, activate, leave-inactive and reject dialogs. Pages are
   rendered for every plant; the story's Readiness, Safety, Go live and Coverage beats are walked through the registered
   handlers (the clicks a presenter makes), and every number on screen is compared with the core function that computes it.
   Node only, no dependencies.   Usage: TZ=Asia/Calcutta node tests/plant7.test.js [-v]     Exit code 0 = pass. */
'use strict';
const VERBOSE = process.argv.includes('-v');
const L = require('./load72.js');
const V = L.V7; const U = L.V7UI; const W = L.window; const P = W.V7PLANT;
const __ = V && V.__;

let n = 0; const bad = []; const skipped = [];
function ok(cond, name, info) { n++; if (!cond) bad.push(name + (info !== undefined ? '  → ' + String(info).slice(0, 400) : '')); else if (VERBOSE) console.log('  ok ' + name); }
const has = (f) => !!V && typeof V[f] === 'function';
const DP = 'digitalpaani', VED = 'vedanta', MAN = 'manesar', BAW = 'bawal'; const PLANTS = [DP, VED, MAN, BAW];

/* ── reading pages ───────────────────────────────────────────────────────────────────────────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', rarr: '→', rsaquo: '›' };
const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] != null ? ENT[e.toLowerCase()] : m));
const noMarks = (h) => String(h == null ? '' : h).replace(/<aside class="dec-mark"[\s\S]*?<\/aside>/g, ' ');
const vis = (h) => decode(noMarks(h).replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const page = (hash) => L.render(hash);
const J = (x) => JSON.stringify(x);
/* the words a v7/2 screen may not use, the IDs it may not show and junk */
const BANNED = [
  ['machine', /\bmachines?\b/i],
  ['asset', /\bassets?\b/i],
  ['widget', /\bwidgets?\b/i],
  ['estate', /\bestates?\b/i],
  ['custom', /\bcustom\b/i],
  ['diverge', /\bdiverg(e|ed|es|ing|ence)\b/i],
  ['stale', /\bstale\b/i],
  ['drift', /\bdrift\b/i],
  ['alert', /\balerts?\b|\balerting\b/i],
  ['alarm', /(?<!false )\balarms?\b/i],
  ['schedule', /\bschedules?\b/i],
  ['the survey tool name', /\bSCADA\b/i],
  ['database', /\bdatabase\b/i],
  ['the form', /\bthe form\b/i],
  ['hold time', /\bhold time\b|\bdebounce\b/i],
  ['procedure', /\bprocedures?\b|\bworkflows?\b|\bSOPs?\b|\bremediation\b/i],
  ['old role names', /\bSite Admin\b|\bSME\b|\bSupervisor\b/i],
  ['other words', /\bonboarding\b|\bshadow\b|\btest alert\b|\bdry run\b|\bdetect\b|\bpriority\b|\binsights?\b|\bportfolio\b/i],
  ['bare tier', /(?<!criticality )\btier\b/i],
  ['old criticality', /\bCritical\b|\bEssential\b|\bStandard\b/],
  ['rule', /(?<!limit |no )\brules?\b/i],
  ['old stage words', /\bsurvey type\b|\bunit operations?\b|\b(functional|process) stages?\b|\bsub-assets?\b/i],
  ['v7/1 words', /Changed here|Library changed since|Differences from the library|From the library|No limits yet|What the library brings|Where it lands|Not for this plant|On trial|Mostly short|Tuned for this plant|For now, until|Reason not recorded|Not in the library|Suggest for the library|Who is told|User Center|Phone view|Review due|no call, no hooter|told to the Leads/i],
  ['old library button', /Back to the library value/],
  ['bare must hold', /(?<!Persistence · )must hold for|(?<!Clearing · )must clear for/i],
  ['an internal id', /\b(CM|C|O)-\d{1,2}\b|(?<![-\w])E[1-5]\b|(?<![-\w])W\d{1,2}[a-d]?\b|(?<![-\w])P[1-6]\b|(?<![-\w])S[1-8]\b|\bV72?-\d+\b|\bAC-?\d+\b|(?<![-\w])D\d{1,2}\b/],
  ['junk', /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\$\{/],
];
/* names and text from the plant data and the workbook are exempt, as on every v7 screen */
const corpus = (() => {
  const seen = new Set(); const parts = [];
  const walk = (x, d) => { if (x == null || d > 8) return; if (typeof x === 'string') { if (x.length > 3) parts.push(x.replace(/\s+/g, ' ')); return; } if (typeof x !== 'object' || seen.has(x)) return; seen.add(x); if (Array.isArray(x)) x.forEach((y) => walk(y, d + 1)); else Object.keys(x).forEach((k) => walk(x[k], d + 1)); };
  ['SEED', 'CATALOGUE', 'READINGS', 'PLANT_PROFILES', 'NEXT_PHASE_FLOWS', 'NEXT_PHASE_CAUSES', 'FORM_RULES', 'SCADA_FORM', 'DB_PALETTE', 'SCADA_LAYOUTS', 'ISSUES', 'ISSUE_TASKS'].forEach((g) => walk(W[g], 0));
  return parts.join('\n');
})();
const fromData = (t, i, len) => { const l = t.slice(Math.max(0, i - 16), i + len).trim(); const r = t.slice(i, i + len + 16).trim(); return (l.length > len + 3 && corpus.includes(l)) || (r.length > len + 3 && corpus.includes(r)); };
function wordHits(html) {
  const t = vis(html); const out = [];
  BANNED.forEach(([w, re]) => { const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'); let m; while ((m = g.exec(t))) { if (!fromData(t, m.index, m[0].length)) { out.push(`${w}: "${m[0]}" in …${t.slice(Math.max(0, m.index - 40), m.index + 40)}…`); break; } if (!m[0]) g.lastIndex++; } });
  return out;
}
function clean(hash) {
  const html = page(hash) || '';
  ok(!!html && !/could not be shown|could not be worked out|could not be read/.test(vis(html)), `${hash} renders every part`, (vis(html).match(/.{60}could not.{80}/) || [])[0]);
  const hits = wordHits(html); ok(!hits.length, `${hash}: Alex's words only, no internal id, no junk`, hits.slice(0, 2).join(' | '));
  ok(!/&amp;(amp|#39|quot|lt|gt);/.test(html), `${hash}: nothing escaped twice`);
  return html;
}
/* ── clicking: a fake element carries a button's data-* attributes; its dialog holds the typed fields ─────────── */
function fakeEl(data, fields) {
  const inputs = {}; const marks = [];
  Object.keys(fields || {}).forEach((k) => { inputs[k] = { value: fields[k], classList: { add: (c) => marks.push(c), remove() {} }, closest: () => null, parentNode: null, focus() {} }; });
  const box = { querySelector: (sel) => { const m = /\[name="([^"]+)"\]/.exec(sel) || /#p7-([\w-]+)/.exec(sel); return m && inputs[m[1]] ? inputs[m[1]] : null; } };
  return { getAttribute: (k) => (k.startsWith('data-') && data[k.slice(5)] != null ? String(data[k.slice(5)]) : null), closest: (sel) => (sel === '.modal' || sel === '.sheet' ? box : null), value: data.value != null ? String(data.value) : '', marks };
}
const HANDLERS = U && U._handlers ? U._handlers : {};
function act(name, data, fields) { const fn = HANDLERS[name]; ok(typeof fn === 'function', `handler ${name} is registered`); return fn ? fn(fakeEl(data || {}, fields)) : undefined; }
const attrsOf = (s) => { const o = {}; const re = /\s([\w-]+)="([^"]*)"/g; let m; while ((m = re.exec(s))) o[m[1]] = decode(m[2]); return o; };
/* the buttons and links on a page that carry a data-act: {act, data, label, disabled} */
function actsOf(html) {
  const out = []; const re = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g; let m;
  while ((m = re.exec(noMarks(html)))) { const a = attrsOf(m[2]); if (!a['data-act']) continue; const data = {}; Object.keys(a).forEach((k) => { if (k.startsWith('data-') && k !== 'data-act') data[k.slice(5)] = a[k]; }); out.push({ act: a['data-act'], data, label: vis(m[3]), disabled: /\sdisabled\b/.test(m[2]), title: a.title || '' }); }
  return out;
}
function click(html, label, opts) {
  const all = actsOf(html).filter((b) => (label instanceof RegExp ? label.test(b.label) : b.label === label) && (!opts || !opts.where || Object.keys(opts.where).every((k) => b.data[k] === opts.where[k])));
  ok(all.length > 0, `there is a "${label}" button to press`, actsOf(html).map((b) => b.label).slice(0, 30).join(' | '));
  if (!all.length) return undefined;
  ok(!all[0].disabled, `"${label}" is enabled`);
  return act(all[0].act, all[0].data, opts && opts.fields);
}
/* what the dialogs and toasts showed */
const TOASTS = [];
if (U) { const real = U.toast; U.toast = (t, o) => { TOASTS.push({ text: String(t), o: o || {} }); return real(t, o); }; }
const lastToast = () => (TOASTS.length ? TOASTS[TOASTS.length - 1] : { text: '', o: {} });
const lastModal = () => (U && U._last && U._last.modal) || {};
const lastSheet = () => (U && U._last && U._last.sheet) || {};
const modalHtml = () => `<h2>${lastModal().title || ''}</h2>${lastModal().body || ''}${lastModal().foot || ''}`;
const sheetHtml = () => `<h2>${lastSheet().title || ''}</h2>${lastSheet().body || ''}${lastSheet().foot || ''}`;
const nodeId = (k, tag) => ((__ && __.dOf(k) ? __.dOf(k).equipment : []).find((e) => e.tag === tag) || {}).id;
const nodeIds = (k, ...tags) => tags.map((t) => nodeId(k, t));
const latest = (k) => ((V.activity({ plant: k, limit: 1 }) || [])[0] || {}).text || '';
const stepsOf = (html) => { const out = []; const re = /<li class="p7-step is-([a-z]+)"><span class="p7-mark"[^>]*>([^<]*)<\/span>([\s\S]*?)<\/li>/g; let m; while ((m = re.exec(html))) out.push({ mark: m[1], glyph: m[2], text: vis(m[3]) }); return out; };
const cardTitles = (html, cls) => { const out = []; const re = new RegExp(`<section class="card[^"]*${cls}[^"]*"[^>]*>\\s*<header class="card-h"><div class="card-hl"><h2 class="card-t">([\\s\\S]*?)</h2>`, 'g'); let m; while ((m = re.exec(html))) out.push(vis(m[1])); return out; };

/* ════════ loading and routes ════════ */
ok(!!V && !!U, 'v7/2 loads: core and the shell', L.errors.map((e) => `${e.file}: ${e.error.slice(0, 120)}`).join(' | '));
ok(!L.errors.some((e) => e.file === 'plant7.js'), 'plant7.js loads without an error');
ok(!!P && typeof P.frame === 'function' && typeof P.tabs === 'function' && typeof P.stateChip === 'function', 'window.V7PLANT: frame, tabs, stateChip');
if (!V || !U || !P) { finish(); }
V.reset();
const mine = new Set(Object.values(P.pages));
const myRoutes = U.routes().filter((r) => mine.has(r.raw) || mine.has(r.fn)).map((r) => r.pattern).sort();
ok(J(myRoutes) === J(['p/:plant', 'p/:plant/library', 'p/:plant/people', 'p/:plant/people/service-dates', 'p/:plant/review/bindings']), 'plant7 registers exactly its five routes (the old library address leads to the bindings pass)', J(myRoutes));
const myActs = Object.keys(HANDLERS).filter((k) => /^(plant|bind|trig|ppl|sd):/.test(k));
ok(myActs.length >= 25 && !Object.keys(HANDLERS).some((k) => /^p7:/.test(k)), 'actions use the plant:, bind:, trig:, ppl: and sd: prefixes, none of v7/1\'s p7: names', myActs.join(' '));

/* ════════ the frame ════════ */
{
  const fr = P.frame(VED, 'tasks', '<p>x</p>'); const tabs = (fr.match(/<nav class="tabs"[\s\S]*?<\/nav>/) || [''])[0];
  ok(vis(tabs) === 'Readiness Structure Triggers Issues Tasks People Deviations Activity', 'a Commissioning plant\'s tabs: Readiness · Structure · Triggers · Issues · Tasks · People · Deviations · Activity', vis(tabs));
  ok(/<a class="tab on" href="#\/p\/vedanta\/tasks"/.test(fr), 'the frame marks the active tab');
  ok(/Commissioning · nothing is sent/.test(vis(fr)) && /Sample plant/.test(vis(fr)) && /All Plants/.test(vis(fr)) && /Vedanta ETP/.test(vis(fr)), 'chips: type, "Commissioning · nothing is sent", "Sample plant"; crumbs All Plants › Vedanta ETP');
  ok(/href="#\/p\/vedanta\/details"[^>]*>Plant details</.test(fr), 'the header link "Plant details" opens the plant details');
  ok(!/blocker/.test(vis(fr)), 'the blockers chip is on the home only');
  const live = P.frame(MAN, 'differences', ''); const lt = vis((live.match(/<nav class="tabs"[\s\S]*?<\/nav>/) || [''])[0]);
  ok(/^Coverage Readings Structure Triggers Issues( \d+)? Tasks People Deviations Activity$/.test(lt), 'a Live plant\'s tabs: Coverage · Readings · Structure · Triggers · Issues · Tasks · People · Deviations · Activity', lt);
  ok(/<a class="tab on" href="#\/p\/manesar\/deviations"/.test(live), 'the old "differences" tab id lights Deviations');
  ok(vis(live).includes(`Live since ${V.fmtDay(V.plant(MAN).since)}`) && !/Commissioning · nothing is sent/.test(vis(live)), 'a Live plant reads "Live since {date}" and never "Commissioning · nothing is sent"', vis(live).slice(0, 160));
  const dp = P.frame(DP, 'home', ''); const un = V.plant(DP).unclassified;
  ok(/Real plant graph/.test(vis(dp)) && !/Sample plant/.test(vis(dp)), 'DigitalPaani is tagged "Real plant graph"');
  ok(un > 0 && new RegExp(`<span class="p7-tab-bad"[^>]*>${un}</span>`).test(dp), 'the Structure tab carries the unclassified count in red', un);
  const chipRe = /<span class="chip chip-(bad|muted) p7-blockers">([^<]*)<\/span>/;
  ok((chipRe.exec(page('#/p/digitalpaani')) || [])[2] === V.checklist(DP).blockersChip.text && (chipRe.exec(page('#/p/digitalpaani')) || [])[1] === 'bad', 'on Readiness the header shows "{n} blockers" in red', V.checklist(DP).blockersChip.text);
  ok(!chipRe.test(page('#/p/digitalpaani/review/bindings')) && !chipRe.test(page('#/p/digitalpaani/people')) && !chipRe.test(dp), 'only Readiness itself carries the blockers chip');
  ok(/No such plant/.test(vis(page('#/p/nowhere'))) && /No such plant/.test(vis(P.frame('nowhere', 'home', ''))), 'an unknown plant gets "No such plant"');
}

/* ════════ every page for every plant ════════ */
for (const k of PLANTS) {
  const hs = [`#/p/${k}`, `#/p/${k}/people`, `#/p/${k}/people/service-dates`, `#/p/${k}/review/bindings`, `#/p/${k}/library`];
  ['undecided', 'cantresolve', 'draft', 'needs', 'blocked'].forEach((s) => hs.push(`#/p/${k}/review/bindings?show=${s}`));
  hs.forEach((h) => {
    const html = clean(h);
    if (V.state(k) === 'commissioning') ok(vis(html).includes('Commissioning · nothing is sent'), `${h} carries "Commissioning · nothing is sent"`);
    else ok(!vis(html).includes('Commissioning · nothing is sent'), `${h} (Live) does not say "Commissioning · nothing is sent"`);
    ok(!/<input[^>]*(name|id|aria-label)="[^"]*(start|fix)[^"]*"/i.test(html), `${h}: no input for start-by or fix-by`);
  });
  const home = page(`#/p/${k}`);
  ok(!/Drawn in the plant graph as|stored in the survey as/.test(vis(home)), `${k}: the drawn-versus-stored type difference is never a Readiness or Coverage item`);
}
ok(vis(page('#/p/vedanta/library')) === vis(page('#/p/vedanta/review/bindings')), 'the old library address shows the bindings pass');

/* ════════ start by and fix by follow the severity: no page offers an input for them ════════ */
{
  const fieldRe = /<(input|select|textarea)\b[^>]*(name|id|aria-label|placeholder|data-field)="[^"]*(start.?by|fix.?by|startBy|fixBy|sla)[^"]*"/i;
  const hs = ['#/plants'];
  for (const k of PLANTS) {
    hs.push(`#/p/${k}/triggers`, `#/p/${k}/issues`, `#/p/${k}/tasks`);
    const al = (V.alerts(k) || []).slice(0, 4); if (k === VED) al.push({ id: 'a_3f' });
    al.forEach((a) => hs.push(`#/p/${k}/trigger/${a.id}`));
    (V.issues(k) || []).slice(0, 2).forEach((i) => hs.push(`#/p/${k}/issue/${i.id}`));
    (V.tasks(k) || []).slice(0, 1).forEach((t) => hs.push(`#/p/${k}/task/${t.id}`));
  }
  hs.push('#/p/manesar/sensor/at2_do');
  const hits = hs.filter((h) => fieldRe.test(page(h) || ''));
  ok(hs.length > 20 && !hits.length, `no page renders an input for start-by or fix-by (${hs.length} pages: Trigger, Issue, Task and list pages)`, hits.join(' '));
  const tp = vis(page('#/p/manesar/trigger/a_do_at2'));
  ok(/Start by \/ fix by follow the severity/.test(tp), 'the Trigger page says start by / fix by follow the severity, read only');
}

/* ════════ the drawn-versus-stored type: a fact on the node's Details, never a Readiness item ════════ */
{
  const sc = nodeId(DP, 'SC'); const fact = 'Drawn in the plant graph as Screen Chamber Tank; stored in the survey as Open Skeleton Tank.';
  ok(!!sc && vis(page(`#/p/digitalpaani/up/${sc}/details`)).includes(fact), 'SC\'s Details carry the fact "Drawn in the plant graph as Screen Chamber Tank; stored in the survey as Open Skeleton Tank."');
  const cl = V.checklist(DP);
  ok(!/Drawn in the plant graph|stored in the survey as/.test(J(cl.blockers.concat(cl.gaps))), 'it is neither a blocker nor a gap at DigitalPaani');
}

/* ════════ Readiness at DigitalPaani (the start of chapters 2 and 4) ════════ */
{
  const h = page('#/p/digitalpaani'); const cl = V.checklist(DP);
  ok(J(cardTitles(h, 'p7-track')) === J(['Structure', 'Bindings', 'People']), 'exactly three track cards: Structure, Bindings, People', J(cardTitles(h, 'p7-track')));
  const steps = stepsOf(h); const want = ['structure', 'bindings', 'people'].reduce((a, t) => a + cl.tracks[t].steps.length, 0);
  ok(steps.length === want && steps.every((s) => ({ done: '✓', current: '●', waiting: '○', attention: '!' })[s.mark] === s.glyph), 'every step is marked ✓ ● ○ or !, one per checklist step', J(steps.map((s) => s.mark + s.glyph)));
  ['structure', 'bindings', 'people'].forEach((t) => cl.tracks[t].steps.forEach((s) => ok(vis(h).includes(`${s.label} ${s.text}`.trim()), `step "${s.label} · ${s.text}" shows as written`)));
  ok(steps.filter((s) => s.mark === 'waiting').every((s) => /Waiting for|Starts when|Optional|Entered for/.test(s.text)), 'waiting steps say what they wait for', J(steps.filter((s) => s.mark === 'waiting').map((s) => s.text)));
  ok(/href="#\/p\/digitalpaani\/review\/structure">Waiting for structure pass →</.test(h), '"Waiting for structure pass →" leads to the structure pass');
  ok(vis(h).includes('Plant graph built 66 pieces of equipment · 38 sensors') && vis(h).includes('Structure pass 76 to review · 20 unclassified'), 'the Structure track reads "66 pieces of equipment · 38 sensors" and "76 to review · 20 unclassified"');
  ok(!/class="p7-trial"/.test(h), 'no trial banner before any Trigger is active');
  const order = cl.blockers.map((b) => b.text).concat(cl.gaps.map((g) => g.text)); const t = vis(h); const at = order.map((x) => t.indexOf(x));
  ok(at.every((i) => i >= 0) && at.every((i, j) => !j || i > at[j - 1]), 'Before go-live lists every blocker, then every gap, as the checklist says', J(order));
  ok((h.match(/p7-tag-bad">Blocker</g) || []).length === cl.blockers.length && (h.match(/p7-tag-gap">Gap</g) || []).length === cl.gaps.length, 'each blocker carries "Blocker", each gap "Gap"');
  ok(cl.blockers.every((b) => h.includes(`href="${b.link}">${b.linkText}<`)), 'each blocker has its one link', J(cl.blockers.map((b) => [b.link, b.linkText])));
  ok(/Go live needs Full Admin/.test(t) && new RegExp(`<button[^>]*disabled[^>]*title="${cl.firstBlocker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>${cl.buttonLabel}</button>`).test(h) && cl.buttonLabel === 'Go live · 3 blockers left', '"Go live needs Full Admin" and the disabled "Go live · 3 blockers left", titled with the first blocker', cl.buttonLabel);
  const before = U._last.modal; act('plant:golive', { plant: DP });
  ok(U._last.modal === before && /^Go live is blocked: /.test(lastToast().text), 'Go live while blocked opens nothing and says why', lastToast().text);
}

/* ════════ Vedanta: the trial banner, the Structure track, one blocker (chapters 5 and 7) ════════ */
{
  const h = page('#/p/vedanta'); const cl = V.checklist(VED);
  ok(vis(h).includes(cl.trial.text) && /Day 6 of trial · 12 Triggers active · 112 trial firings so far · 1 Trigger noisy/.test(cl.trial.text) && /href="#\/p\/vedanta\/triggers\?sort=trial">Review them</.test(h), 'the trial banner "Day 6 of trial · 12 Triggers active · 112 trial firings so far · 1 Trigger noisy" with "Review them"', cl.trial.text);
  ok(vis(h).includes('Structure pass Confirmed Fri 23 Oct, 10:25 · 4 placed by hand · 1 not part of any unit process'), 'the Structure track reads "Confirmed Fri 23 Oct, 10:25 · 4 placed by hand · 1 not part of any unit process"');
  ok(vis(h).includes('1 draft is undecided: MLSS low · SBR-1') && /href="#\/p\/vedanta\/review\/bindings\?show=undecided">Decide</.test(h), 'the blocker "1 draft is undecided: MLSS low · SBR-1" with "Decide"');
  ok(vis(h).includes('1 blocker') && vis(h).includes('Go live · 1 blocker left'), '"1 blocker" and "Go live · 1 blocker left"');
  cl.gaps.forEach((g) => ok(vis(h).includes(g.text), `the gap "${g.text}" shows`));
}

/* ════════ chapter 6: People › Routing at Vedanta ════════ */
{
  const h = clean('#/p/vedanta/people'); const ro = V.routing(VED); const rc = V.reachability(VED);
  ok(vis(h).includes('Commissioning: nothing is sent. This is who will be told from go-live.') && ro.banner === 'Commissioning: nothing is sent. This is who will be told from go-live.', 'Routing opens with "Commissioning: nothing is sent. This is who will be told from go-live."');
  ro.ladder.forEach((l) => ok(vis(h).includes(`${l.text} ${l.countText}`), `the ladder row "${l.label}" ends with its count (${l.countText})`));
  ok(ro.ladder[0].countText === '3 people', 'the Emergency row reaches 3 people at Vedanta', ro.ladder[0].countText);
  ok(vis(h).includes(rc.text), 'the reachability line', rc.text);
  const priya = (h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Priya Nair[\s\S]*?<\/tr>/) || [''])[0];
  ok(/Not verified/.test(vis(priya)) && /Send code/.test(vis(priya)), 'Priya Nair still reads "Not verified" with "Send code"');
  ok(vis(h).includes(ro.clocksText) && vis(h).includes('No Trigger sets its own.'), 'start by / fix by follow the severity, read only');
  ok(/href="#\/p\/vedanta\/people\/service-dates">Last service dates</.test(h), 'a link to Last service dates (Commissioning only)');
}

/* ════════ chapter 7: Go live at Vedanta, through the clicks ════════ */
{
  /* the optional last service dates */
  let h = clean('#/p/vedanta/people/service-dates'); let sd = V.serviceDates(VED);
  ok(vis(h).includes(sd.counterText) && sd.counterText === 'Entered for 4 of 11 pieces of equipment · If you went live now, 51 of 73 scheduled Tasks would fall due on go-live day.', 'the counter "Entered for 4 of 11 pieces of equipment · If you went live now, 51 of 73 …"', sd.counterText);
  const bl1 = sd.rows.find((r) => r.tag === 'BL-1'); const row = (h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*>BL-1<[\s\S]*?<\/tr>/) || [''])[0];
  ok(bl1 && vis(row).includes(`${bl1.pmTasks}`) && vis(row).includes(bl1.dateText) && vis(row).includes(bl1.preview.text) && bl1.preview.text === '1 on go-live day, 8 later · earliest Fri 13 Nov', 'BL-1: its PM Tasks, "Mon 19 Oct" and "1 on go-live day, 8 later · earliest Fri 13 Nov"', vis(row));
  ok(new RegExp(`<input type="date"[^>]*value="${bl1.iso}"[^>]*max="${sd.max}"[^>]*data-act="sd:set"[^>]*data-eq="${bl1.eqId}"`).test(h), 'the date field holds the date, can\'t go past today and saves on change');
  ok(vis(h).includes(sd.foot), 'the footnote about Tasks with no service date');
  click(h, 'Clear', { where: { eq: bl1.eqId } }); sd = V.serviceDates(VED); h = page('#/p/vedanta/people/service-dates');
  ok(sd.rows.find((r) => r.tag === 'BL-1').preview.text === 'All 9 on go-live day' && vis(h).includes(sd.counterText) && /59 of 73/.test(sd.counterText), 'Clear: BL-1 reads "All 9 on go-live day" and the counter "… 59 of 73 …"', sd.counterText);
  act('sd:set', { plant: VED, eq: bl1.eqId, value: '2099-01-01' });
  ok(lastToast().text === 'A last service date can\'t be in the future.', 'a future date is refused', lastToast().text);
  act('sd:set', { plant: VED, eq: bl1.eqId, value: bl1.iso });
  ok(V.serviceDates(VED).counterText === 'Entered for 4 of 11 pieces of equipment · If you went live now, 51 of 73 scheduled Tasks would fall due on go-live day.' && /^Last service for BL-1 set to Mon 19 Oct: 8 of its 9 PM Tasks now count from it\.$/.test(lastToast().text), 'put back: "Last service for BL-1 set to Mon 19 Oct: 8 of its 9 PM Tasks now count from it."', lastToast().text);

  /* Decide → the undecided draft → Accept 1 and start trial */
  h = clean('#/p/vedanta/review/bindings?show=undecided'); const bp = V.bindingsPass(VED, { show: 'undecided' }); const r = bp.rows[0];
  ok(/Structure pass ✓/.test(vis(h)) && vis(h).includes(`Bindings pass · ${V.bindingsPass(VED).counts.all}`), 'the pass tabs: "Structure pass ✓" · "Bindings pass · {all}"');
  const c = V.bindingsPass(VED).counts;
  ok(['All', 'Undecided', 'Can\'t resolve', 'Needs equipment or sensors'].every((l, i) => vis(h).includes(`${l} ${[c.all, c.undecided, c.cantResolve, c.needs][i]}`)), 'the filter chips "All · Undecided · Can\'t resolve · Needs equipment or sensors" with their counts', J(c));
  const tr = (h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*MLSS low · Issue → SBR-1[\s\S]*?<\/tr>/) || [''])[0];
  ok(r && r.line === 'MLSS low · Issue → SBR-1' && /MLSS low · Issue → SBR-1 reads MLSS-SBR-1/.test(vis(tr)) && /Minor < 2,000 mg\/L Library ·/.test(vis(tr)) && /Persistence 5 min Library ·/.test(vis(tr)) && /Undecided/.test(vis(tr)), 'the row "MLSS low · Issue → SBR-1 · reads MLSS-SBR-1 | Minor < 2,000 mg/L (Library) · Persistence 5 min (Library) | Undecided"', vis(tr));
  ok(/Accept/.test(vis(tr)) && /Change/.test(vis(tr)) && /Reject/.test(vis(tr)), 'an undecided row offers Accept · Change · Reject');
  ok(vis(h).includes(bp.bulk.draftsLabel) && vis(h).includes(bp.bulk.activateLabel) && bp.bulk.activateLabel === 'Accept 1 and start trial', 'the bulk bar "Accept 1 as drafts" · "Accept 1 and start trial"');
  ok(/<tr class="is-target"/.test(page('#/p/vedanta/review/bindings?f=v_sbr|alert|MLSS low')), '?f=<binding> highlights that row');
  click(h, 'Accept 1 and start trial');
  ok(lastToast().text === 'Accepted 1 and started the trial: 1 Trigger now records trial firings. Commissioning · nothing is sent.' && typeof lastToast().o.undo === 'function', 'the toast "Accepted 1 and started the trial: 1 Trigger now records trial firings. Commissioning · nothing is sent." with Undo', lastToast().text);
  ok(/Active · trial/.test(vis((page('#/p/vedanta/review/bindings').match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*MLSS low · Issue → SBR-1[\s\S]*?<\/tr>/) || [''])[0])), 'the row now reads "Active · trial"');

  /* Readiness: nothing blocks */
  h = page('#/p/vedanta'); const cl = V.checklist(VED);
  ok(cl.canGoLive && vis(h).includes('0 blockers') && vis(h).includes(cl.trial.text) && /13 Triggers active/.test(cl.trial.text), 'Readiness: "0 blockers", banner "… 13 Triggers active …"', cl.trial.text);
  ok(vis(h).includes('No blockers. Gaps don\'t stop go-live.') && /<button[^>]*data-act="plant:golive"[^>]*>Go live<\/button>/.test(h), '"No blockers. Gaps don\'t stop go-live." with "Go live" enabled');
  ok(vis(h).includes('87 accepted · 87 active · 0 left inactive on purpose'), 'the Bindings card: "87 accepted · 87 active · 0 left inactive on purpose"');

  /* the go-live confirmation */
  click(h, 'Go live'); const m = lastModal(); const pv = V.goLivePreview(VED); const mh = modalHtml();
  const lis = (m.body.match(/<ol class="p7-changes">([\s\S]*?)<\/ol>/) || ['', ''])[1].match(/<li[\s\S]*?<\/li>/g) || [];
  ok(m.title === 'Go live: Vedanta ETP' && /From now on:/.test(vis(m.body)), 'the dialog "Go live: Vedanta ETP" · "From now on:"');
  ok(lis.length === 4 && J(lis.map((li) => vis(li.replace(/<div class="p7-sub">[\s\S]*?<\/div>/, '')))) === J(['Triggers create Issues and notify the plant\'s people, including Emergency calls and the hooter', 'Scheduled Tasks start. First due dates come from the service dates you entered, otherwise today.', 'Metrics and PM compliance start counting today', 'Changing structure will need a reason']), 'the four lines in order, word for word', J(lis.map(vis)));
  ok(/^<li class="p7-loud">/.test(lis[0]) && !lis.slice(1).some((li) => /p7-loud/.test(li)), 'the first line is loud, the others not');
  ok(vis(lis[1]).includes(pv.lines[1].sub) && pv.lines[1].sub === '51 of 73 scheduled Tasks fall due today. Service dates were entered for 4 of 11 pieces of equipment; 22 Tasks count from them. After today, about 59 Tasks a day.', 'the computed Tasks sub-line under line 2', pv.lines[1].sub);
  ok(vis(mh).includes('Trial: 3 Triggers fired · 1 fired more than 10 times a day · Review them') && pv.trial.text === 'Trial: 3 Triggers fired · 1 fired more than 10 times a day', '"Trial: 3 Triggers fired · 1 fired more than 10 times a day · Review them"');
  const g = V.checklist(VED).gaps.length;
  ok(vis(mh).includes(`${g} gaps remain`) && vis(mh).includes(pv.gapsText) && pv.gaps.every((x) => vis(mh).includes(x.text)), `"{n} gaps remain · …" with n = the checklist's gaps (${g}), and List holds each sentence`, pv.gapsText);
  ok(/data-act="ui:close"[^>]*>Not yet</.test(m.foot) && /data-act="plant:golive-confirm"[^>]*>Go live</.test(m.foot), 'buttons "Not yet" and "Go live"');
  const go = actsOf(mh).find((b) => b.act === 'plant:golive-confirm'); act(go.act, go.data);
  ok(V.state(VED) === 'live' && lastToast().text === `Vedanta ETP is Live. Issues and notifications started at ${V.fmtTime(V.now())}.`, 'the toast "Vedanta ETP is Live. Issues and notifications started at {HH:MM}."', lastToast().text);
  h = clean('#/p/vedanta'); const cv = V.coverage(VED);
  ok(/<a class="tab on" href="#\/p\/vedanta"[^>]*>Coverage</.test(h) && vis(h).includes(`Live since ${V.fmtDay(V.now())}`), 'the home is now Coverage, "Live since {today}"');
  ok(vis(h).includes(`${cv.triggers.issues} Issues since go-live`) && cv.triggers.issues === 0 && vis(h).includes(`${cv.triggers.active} Active`) && cv.triggers.active === 13, 'Coverage: "Issues since go-live" 0, Active 13', J(cv.triggers));
  ok(cv.freshText && vis(h).includes(cv.freshText), 'the fresh go-live banner', cv.freshText);
  ok(/^Went live: 13 Triggers now create Issues/.test(latest(VED)), 'the newest Activity line starts "Went live: 13 Triggers now create Issues"', latest(VED));
}

/* ════════ chapter 9: Coverage at Manesar and Bawal ════════ */
V.reset();
{
  let h = clean('#/p/manesar'); const cv = V.coverage(MAN); const t = cv.triggers; const tx = vis(h);
  ok(tx.includes(`${t.active} Active`) && t.active === 6 && tx.includes(`${t.issues} ${cv.window.label}`) && cv.window.label === 'Issues, last 7 days' && t.issues === 3, 'Triggers: Active 6 · Issues, last 7 days 3', J(t));
  ok(tx.includes(`${t.falseAlarmText} Closed as false alarm ${t.closedText}`) && t.falseAlarmText === '50%' && t.closedText === '1 of 2 closed', '"Closed as false alarm" 50% with "1 of 2 closed"');
  ok(tx.includes(`${t.noisiest.name} Noisiest`) && t.noisiest.name === 'DO low · AT-2' && h.includes(`href="#/p/manesar/trigger/${t.noisiest.alertId}"`), 'Noisiest: DO low · AT-2, a link to its Trigger');
  ok(tx.includes('Drafts in the review queue: 80 Open the bindings pass') && h.includes(`href="${t.draftsLink}"`), '"Drafts in the review queue: 80" with "Open the bindings pass"');
  if (has('deviations')) { const dc = V.deviations({ plant: MAN }).counts; ok(tx.includes(`${dc.overrides} Overrides ${dc.basemoved} Base moved ${dc.pastreview} Past review`), 'Deviations here: Overrides · Base moved · Past review equal the ledger\'s counts', J(dc)); } else skipped.push('Deviations here vs the ledger (no ledger file)');
  ok(/href="#\/p\/manesar\/deviations"[^>]*>Open deviations</.test(h), '"Open deviations"');
  ok(tx.includes('Blind spots Arrives with Diagnostics: what must be known per unit process, how often, and what isn\'t covered.'), 'Blind spots shows the placeholder sentence word for word');
  ok(J(cv.gaps.map((g) => g.id)) === J(['nopm']) && tx.includes('Gaps the plant runs with Gap 4 pieces of equipment without a maintenance programme'), 'gaps: only "4 pieces of equipment without a maintenance programme"', J(cv.gaps.map((g) => g.text)));
  ok(tx.includes(cv.returnCard.text) && /data-act="plant:return"[^>]*>Return to Commissioning…</.test(h), 'the quiet Return card with "Return to Commissioning…"');
  ok(/Sample readings/.test(tx), 'the Triggers card carries "Sample readings"');

  /* a draft on a Live plant, and Activate without a trial */
  h = clean('#/p/manesar/review/bindings?show=undecided');
  const lv = (h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Level high · Issue → EQ-1[\s\S]*?<\/tr>/) || [''])[0];
  ok(/reads LVL-EQ1/.test(vis(lv)), 'the row "Level high · Issue → EQ-1 · reads LVL-EQ1"');
  ok(vis(h).includes('Accept 80 and activate'), 'on a Live plant the bulk bar reads "Accept {n} and activate"');
  click(h, 'Accept', { where: { pid: 'eq1|alert|Level high' } });
  const row = () => V.bindingsPass(MAN).rows.find((x) => x.pid === 'eq1|alert|Level high');
  ok(row().status === 'draft' && /Drafts never fire/.test(lastToast().text), 'Accept on a Live plant makes a draft: "Draft · never fires"', `${row().statusLabel} · ${lastToast().text}`);
  h = page('#/p/manesar/review/bindings?show=draft'); const dr = (h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Level high · Issue → EQ-1[\s\S]*?<\/tr>/) || [''])[0];
  ok(/Draft · never fires/.test(vis(dr)) && /Activate/.test(vis(dr)) && /Leave inactive/.test(vis(dr)), 'the draft row reads "Draft · never fires" with Activate and Leave inactive', vis(dr));
  click(h, 'Activate'); const mh = modalHtml();
  ok(lastModal().title === 'Activate Level high · EQ-1?' && /creates Issues and notifies the plant's people/.test(vis(mh)) && /It gets no trial first/.test(vis(mh)) && /Return the plant to Commissioning…/.test(vis(mh)) && !/would have fired/.test(vis(mh)), 'the Activate dialog: "creates Issues and notifies the plant\'s people", "It gets no trial first", "Return the plant to Commissioning…", no "would have fired"', vis(mh).slice(0, 300));
  const ap = V.activatePreview(MAN, row().alertId); ok(ap.bandLines.length > 0 && ap.bandLines.every((l) => vis(mh).includes(l)), 'who its bands reach, from the routing ladder', J(ap.bandLines));
  act('ui:close', { what: 'modal' });
  ok(V.alertState(MAN, row().alertId) === 'draft', '"Not yet": it stays a draft');
  /* the bulk bar on a Live plant asks first */
  const before = V.bindingsPass(MAN).counts.undecided; click(page('#/p/manesar/review/bindings?show=undecided'), /^Accept \d+ and activate$/);
  ok(/^Accept and activate \d+ Triggers\?$/.test(lastModal().title || '') && V.bindingsPass(MAN).counts.undecided === before, 'on a Live plant "Accept {n} and activate" opens the Activate dialog first and changes nothing yet', lastModal().title);
  act('ui:close', { what: 'modal' });
  /* Undo from the toast */
  click(page('#/p/manesar/review/bindings?show=undecided'), 'Accept', { where: { pid: 'eq1|alert|pH high' } });
  const undo = lastToast().o.undo; ok(typeof undo === 'function' && V.bindingsPass(MAN).rows.find((x) => x.pid === 'eq1|alert|pH high').status === 'draft', 'a decision\'s toast offers Undo');
  if (undo) { undo(); ok(V.bindingsPass(MAN).rows.find((x) => x.pid === 'eq1|alert|pH high').status === 'undecided', 'Undo puts the binding back to undecided'); }

  /* Return to Commissioning: the computed lines, refused without a reason */
  click(page('#/p/manesar'), 'Return to Commissioning…'); const rp = V.returnPreview(MAN); const rh = modalHtml();
  ok(lastModal().title === 'Return Manesar STP to Commissioning?' && rp.lines.every((l) => vis(rh).includes(l.text)), 'the Return dialog lists its computed lines', J(rp.lines.map((l) => l.text)));
  ok(rp.lines[0].text === '6 active Triggers record trial firings only, at every severity, Emergencies included. Nobody is told: no Issues, no WhatsApp, no calls, no hooter.' && /class="p7-loud"/.test(lastModal().body), 'its first line, loud: "6 active Triggers record trial firings only, …"');
  ok(vis(rh).includes('1 open Issue stays open and is worked as normal, with its reminders and escalations: DO low · AT-2.') && vis(rh).includes('Scheduled Tasks stop: 9 upcoming Tasks won\'t come due (3 were due in the next 7 days). 1 Task already due stays open.') && /To go live again, every draft must be decided: \d+ are waiting\./.test(vis(rh)), 'the open Issue, the Tasks that stop and the drafts that must be decided');
  ok(/<textarea[^>]*name="reason"[^>]*placeholder="For example: aeration grid retrofit, two weeks"/.test(rh) && /Not yet/.test(lastModal().foot) && /data-act="plant:return-confirm"/.test(lastModal().foot), 'the reason field and "Not yet" · "Return to Commissioning"');
  act('plant:return-confirm', { plant: MAN }, { reason: '  ' });
  ok(V.state(MAN) === 'live' && lastToast().text === 'Say why the plant goes back to Commissioning.', 'Return is refused without a reason: "Say why the plant goes back to Commissioning."', lastToast().text);
  act('ui:close', { what: 'modal' });

  /* Bawal: quiet */
  h = clean('#/p/bawal'); const cb = V.coverage(BAW);
  ok(J(cb.gaps.map((g) => g.id)) === J(['nodiag']) && vis(h).includes('1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1'), 'Bawal\'s only gap: "1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1"');
  ok(vis(h).includes(`${cb.triggers.issues} ${cb.window.label}`) && vis(h).includes('— Noisiest') === !cb.triggers.noisiest, 'Bawal\'s Issues and Noisiest from Coverage', J(cb.triggers));
}

/* ════════ People at Manesar: routing, the hooter, the clocks ════════ */
{
  let h = clean('#/p/manesar/people'); const ro = V.routing(MAN);
  ok(vis(h).includes('Start by / fix by follow the severity: Emergency 1 h / 4 h · Major 8 h / 24 h · Minor 24 h / 72 h'), 'Manesar\'s People reads "Start by / fix by follow the severity: Emergency 1 h / 4 h · Major 8 h / 24 h · Minor 24 h / 72 h"');
  ok(!/Commissioning: nothing is sent/.test(vis(h)) && !/people\/service-dates/.test(h), 'a Live plant\'s Routing has no Commissioning banner and no Last service dates link');
  V.people(MAN).forEach((x) => ok(vis(h).includes(x.name) && vis(h).includes(x.roleLabel), `the roster lists ${x.name} (${x.roleLabel})`));
  ok(ro.hooter === true && /<button[^>]*class="btn btn-primary btn-sm on"[^>]*data-act="ppl:hooter"[^>]*data-on="1"[^>]*>On</.test(h), 'the hooter shows On');
  click(h, 'Off');
  ok(V.routing(MAN).hooter === true && vis(modalHtml()).includes(ro.offConfirm), 'switching the hooter off asks first, with the consequence', ro.offConfirm);
  const so = actsOf(modalHtml()).find((b) => b.act === 'ppl:hooter-confirm'); act(so.act, so.data);
  ok(V.routing(MAN).hooter === false && lastToast().text === 'Hooter switched off at Manesar STP.' && /^Hooter switched off at Manesar STP/.test(latest(MAN)), '"Switch off": "Hooter switched off at Manesar STP"', lastToast().text);
  h = page('#/p/manesar/people');
  ok(/Emergency: calls every Operator, Lead and Senior Lead, and a full-screen warning in the app \(the hooter is off\)/.test(vis(h)), 'the Emergency row now ends "(the hooter is off)"');
  click(h, 'On');
  ok(V.routing(MAN).hooter === true && lastToast().text === 'Hooter switched on at Manesar STP.', 'switching it back on needs no question', lastToast().text);
}

/* ════════ reject, leave inactive on a Live plant, remove a person ════════ */
{
  const pid = 'eq1|alert|pH high';
  click(page('#/p/manesar/review/bindings?show=undecided'), 'Reject', { where: { pid } });
  ok(lastModal().title === 'Reject pH high for EQ-1?' && /The library keeps it; this plant won't\. A re-run won't propose it again\./.test(vis(lastModal().body)), 'Reject asks "Reject pH high for EQ-1?" and says the library keeps it', lastModal().title);
  act('trig:reject-confirm', { plant: MAN, pid }, { reason: '' });
  ok(lastToast().text === 'Say why it doesn\'t fit this plant.' && V.bindingsPass(MAN).rows.find((x) => x.pid === pid).status === 'undecided', 'Reject without a reason is refused: "Say why it doesn\'t fit this plant."', lastToast().text);
  act('trig:reject-confirm', { plant: MAN, pid }, { reason: 'The EQ tank is dosed upstream; pH is watched on AT-1' });
  ok(V.bindingsPass(MAN).rows.find((x) => x.pid === pid).status === 'rejected' && /^Rejected pH high · EQ-1/.test(lastToast().text), 'with a reason it is rejected', lastToast().text);
  /* an active Trigger on a Live plant is set inactive with one of the five reasons */
  act('trig:inactive', { plant: MAN, id: 'a_bl1_trip' }); const lm = modalHtml();
  ok(/^Set .+ inactive\?$/.test(lastModal().title || '') && /is Live: setting .+ inactive is an override of this plant's value, with a reason\./.test(vis(lm)), 'an active Trigger on a Live plant: "Set {name} inactive?", an override with a reason', lastModal().title);
  ok(['Physical', 'Regulatory or client', 'Structural', 'Tuning', 'Temporary'].every((x) => vis(lm).includes(x)) && !/Migrated/.test(vis(lm)), 'it offers the five reasons, never Migrated');
  const LG = W.V7LEDGER; const tgt = { kind: 'enabled', alertId: 'a_bl1_trip' };
  if (LG && typeof LG.overrideForm === 'function') {
    ok(/Why does this plant differ\?/.test(vis(lm)) && (typeof LG.isOpen !== 'function' || LG.isOpen(MAN, tgt)), 'the dialog holds the one override form, reason first');
    act('ui:close', { what: 'modal' });
    ok(typeof LG.isOpen !== 'function' || !LG.isOpen(MAN, tgt), 'closing the dialog closes the override form too');
  }
  /* without the override form the dialog asks for the reason itself */
  W.V7LEDGER = undefined;
  act('trig:inactive', { plant: MAN, id: 'a_bl1_trip' }); const fm = modalHtml();
  ok(['Physical', 'Regulatory or client', 'Structural', 'Tuning', 'Temporary'].every((x) => vis(fm).includes(x)) && /Why does this plant differ\?/.test(vis(fm)), 'without the override form: the five reasons, asked first');
  act('trig:inactive-confirm', { plant: MAN, id: 'a_bl1_trip', live: 1 }, { why: '', note: '' });
  ok(V.alertState(MAN, 'a_bl1_trip') === 'active' && lastToast().text === 'Choose why this plant differs.', 'without a reason it stays active: "Choose why this plant differs."', lastToast().text);
  act('trig:inactive-confirm', { plant: MAN, id: 'a_bl1_trip', live: 1 }, { why: 'tuning', note: 'The trip relay is being replaced; the panel lamp covers it' });
  ok(V.alertState(MAN, 'a_bl1_trip') === 'inactive', 'with Tuning and a note it is inactive', lastToast().text);
  W.V7LEDGER = LG;
  act('ui:close', { what: 'modal' });
  /* remove a person */
  act('ppl:remove', { plant: VED, id: 'pv3' });
  ok(lastModal().title === 'Remove Arjun Mehta from Vedanta ETP\'s roster?' && vis(lastModal().body) === 'Vedanta ETP would have no Lead with a verified phone: go-live would be blocked.', 'Remove: "Remove Arjun Mehta from Vedanta ETP\'s roster?" and what it leaves behind', vis(lastModal().body));
  act('ppl:remove-confirm', { plant: VED, id: 'pv3' });
  ok(!V.people(VED).some((x) => x.id === 'pv3') && V.checklist(VED).blockers.some((b) => b.id === 'lead') && vis(page('#/p/vedanta')).includes('No Lead with a verified phone: nobody would be notified'), 'after Remove, Readiness has the Lead blocker');
}

/* ════════ Commissioning: Activate straight away, Leave inactive with a reason ════════ */
V.reset();
{
  click(page('#/p/vedanta/review/bindings?show=undecided'), 'Accept 1 as drafts');
  ok(/^Accepted 1 as drafts\. Drafts never fire\.$/.test(lastToast().text) && V.bindingsPass(VED).counts.drafts === 1 && V.checklist(VED).blockers.some((b) => b.id === 'drafts'), '"Accept 1 as drafts": a draft, still blocking go-live', lastToast().text);
  const h = page('#/p/vedanta/review/bindings?show=draft'); const modalsBefore = U._last.modal;
  click(h, 'Activate');
  ok(U._last.modal === modalsBefore && lastToast().text === 'MLSS low · SBR-1 is active: it records trial firings. Nothing is sent until go-live.' && V.alertState(VED, 'a_3t') === 'active', 'Activate at a Commissioning plant needs no dialog: "MLSS low · SBR-1 is active: it records trial firings. Nothing is sent until go-live."', lastToast().text);
}
V.reset();
{
  click(page('#/p/vedanta/review/bindings?show=undecided'), 'Accept 1 as drafts');
  click(page('#/p/vedanta/review/bindings?show=draft'), 'Leave inactive');
  ok(lastModal().title === 'Leave MLSS low · SBR-1 inactive?' && vis(lastModal().body).includes('It stays at this plant but never fires. It no longer blocks go-live.') && /placeholder="For example: no MLSS probe fitted until December"/.test(lastModal().body), '"Leave MLSS low · SBR-1 inactive?" with its reason field', lastModal().title);
  const ok1 = actsOf(modalHtml()).find((b) => b.act === 'trig:inactive-confirm');
  act(ok1.act, ok1.data, { reason: '' });
  ok(lastToast().text === 'Say why it stays inactive.' && V.alertState(VED, 'a_3t') === 'draft', 'without a reason: "Say why it stays inactive."', lastToast().text);
  act(ok1.act, ok1.data, { reason: 'No MLSS probe fitted until December' });
  ok(V.alertState(VED, 'a_3t') === 'inactive' && V.checklist(VED).canGoLive && /stays inactive/.test(lastToast().text), 'with a reason it is inactive and no longer blocks', lastToast().text);
}

/* ════════ chapters 2 to 4 at DigitalPaani: the pass opens, people are added, Go live is enabled ════════ */
V.reset();
const HAS_STRUCT = has('structurePass') && has('acceptStructure') && has('place') && has('notPart') && has('changeUpType');
if (!HAS_STRUCT) skipped.push('chapters 2 to 4 at DigitalPaani (the structure file is not loaded)');
else {
  ok(/Bindings pass · waiting/.test(vis(page('#/p/digitalpaani/review/bindings'))) && /The bindings pass opens when the structure pass is confirmed\./.test(vis(page('#/p/digitalpaani/review/bindings'))), 'before the structure pass: "Bindings pass · waiting" and why');
  /* chapter 2, through the core (the structure pass page is another module's) */
  V.changeUpType(DP, nodeId(DP, 'SC'), 'screening', {}); V.acceptStructure(DP, { all: true });
  V.notPart(DP, nodeIds(DP, 'ITP-1', 'ITP-2', 'FWTP-1', 'FWTP-2'), {});
  V.place(DP, nodeIds(DP, 'UFFP-1', 'UFFP-2', 'UFBV-1'), [nodeId(DP, 'UF-1')], {}); V.place(DP, nodeIds(DP, 'UFFP-3', 'UFFP-4', 'UFBV-2'), [nodeId(DP, 'UF-2')], {});
  V.place(DP, nodeIds(DP, 'RFP-1', 'RFP-2'), nodeIds(DP, 'MBBR-1', 'MBBR-4'), {}); V.place(DP, nodeIds(DP, 'FFP-1', 'FFP-2'), [nodeId(DP, 'MGF')], {});
  V.place(DP, nodeIds(DP, 'SPFP-1', 'SPFP-2'), [nodeId(DP, 'SLP')], {}); V.notPart(DP, nodeIds(DP, 'PDT', 'PDP', 'SCP-1', 'SCP-2'), {});
  ok(V.structureDone(DP), 'chapter 2 confirms the structure pass');
  let h = clean('#/p/digitalpaani/review/bindings'); let bp = V.bindingsPass(DP);
  ok(/Structure pass ✓/.test(vis(h)) && vis(h).includes(`Bindings pass · ${bp.counts.all}`), 'the pass tabs read "Structure pass ✓" · "Bindings pass · {all}"');
  const heads = cardTitles(h, 'p7-bgroup'); ok(J(heads) === J(bp.groups.map((g) => g.head)), 'groups follow the structure in flow order, as the core lists them', J(heads.slice(0, 4)));
  ok(!bp.groups.some((g) => g.id === 'outside') || heads[heads.length - 1].startsWith('Outside any unit process'), '"Outside any unit process" comes last');
  ok(vis(h).includes(`Can't resolve ${bp.counts.cantResolve}`) && bp.counts.cantResolve > 0, 'the "Can\'t resolve" chip counts its rows', bp.counts.cantResolve);
  if (bp.bulk.note) ok(vis(h).includes(bp.bulk.note), 'the bulk bar says what it leaves out', bp.bulk.note);
  const lh = (h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Level high · Issue → EQTT-2[\s\S]*?<\/tr>/) || [''])[0];
  if (has('zoneInfo')) ok(/reads LVL-EQTT-2/.test(vis(lh)) && /Caution > 85% \(3\.4 m\) Derived · 85% of tank height \(4\.0 m\)/.test(vis(lh)) && /Persistence 5 min Library ·/.test(vis(lh)), 'the row "Level high · Issue → EQTT-2" with "Caution > 85% (3.4 m)" and "Derived · 85% of tank height (4.0 m)"', vis(lh));
  const cr = clean('#/p/digitalpaani/review/bindings?show=cantresolve'); const crRows = V.bindingsPass(DP, { show: 'cantresolve' }).rows;
  crRows.forEach((r) => {
    ok(vis(cr).includes(`Can't resolve: ${r.cantResolve.text}`), `"Can't resolve: ${r.cantResolve.text}"`);
    if (r.cantResolve.param) ok(new RegExp(`<button[^>]*data-act="dp:edit"[^>]*data-plant="digitalpaani"[^>]*data-node="${r.eqId}"[^>]*data-param="${r.cantResolve.param}"[^>]*>Add parameter<`).test(cr), `[Add parameter] on ${r.tag} opens the design-parameter editor for ${r.cantResolve.param}`);
  });
  ok((cr.match(/>Accept as draft</g) || []).length === crRows.length, 'each row that can\'t resolve offers only "Accept as draft"');
  if (has('setDesignParam')) V.setDesignParam(DP, { kind: 'up', id: nodeId(DP, 'CCT') }, 'tankHeight', 3.5, {});
  /* chapter 3: accept and start the trial */
  bp = V.bindingsPass(DP); click(page('#/p/digitalpaani/review/bindings'), bp.bulk.activateLabel);
  ok(/^Accepted \d+ and started the trial: \d+ Triggers? now records? trial firings\. Commissioning · nothing is sent\.$/.test(lastToast().text), 'the toast "Accepted {k} and started the trial: {t} Triggers now record trial firings. Commissioning · nothing is sent."', lastToast().text);
  /* chapter 4: people added and verified on the People tab */
  h = clean('#/p/digitalpaani/people');
  ok(vis(h).includes('No one is on DigitalPaani\'s roster yet. Add at least one Operator and one Lead, each with a phone they verify.'), 'the empty roster says what is needed');
  click(h, 'Add a person', { where: { plant: DP } }); let sh = sheetHtml();
  ok(lastSheet().title === 'Add a person' && ['Name', 'Role', 'Operator', 'Lead', 'Senior Lead', 'Client viewer', 'Phone', 'They verify it themselves with a code.', 'Channel', 'WhatsApp', 'SMS', 'Admin grant at this plant', 'None', 'People Admin', 'Technical Admin', 'Full Admin'].every((x) => vis(sh).includes(x)), 'the "Add a person" sheet: Name, Role, Phone, Channel, Admin grant', vis(sh).slice(0, 300));
  const save = actsOf(sh).find((b) => b.act === 'ppl:save');
  act(save.act, save.data, { name: '', role: 'l1', phone: '+91 90000 40001', channel: 'wa', grant: '' });
  ok(V.people(DP).length === 0 && vis(sheetHtml()).includes('Give the person\'s name.'), 'Save without a name keeps the sheet open: "Give the person\'s name."');
  act(save.act, save.data, { name: 'Ravi Kumar', role: 'l1', phone: '+91 90000 40001', channel: 'wa', grant: '' });
  const ravi = V.people(DP).find((x) => x.name === 'Ravi Kumar');
  ok(ravi && lastToast().text === 'Added Ravi Kumar (Operator). Send a code so they can verify their phone.', 'Save: "Added Ravi Kumar (Operator). Send a code so they can verify their phone."', lastToast().text);
  const rowOf = (hh, name) => vis((hh.match(new RegExp(`<tr[^>]*>(?:(?!</tr>)[\\s\\S])*${name}[\\s\\S]*?</tr>`)) || [''])[0]);
  h = page('#/p/digitalpaani/people'); ok(/Not verified Send code/.test(rowOf(h, 'Ravi Kumar')), 'the row reads "Not verified" with "Send code"');
  click(h, 'Send code', { where: { id: ravi.id } }); h = page('#/p/digitalpaani/people');
  ok(rowOf(h, 'Ravi Kumar').includes(`Code sent ${V.fmtTime(V.now())} · waiting`) && rowOf(h, 'Ravi Kumar').includes('(sample) Ravi Kumar enters the code'), '"Code sent {HH:MM} · waiting" with the labelled sample button', rowOf(h, 'Ravi Kumar'));
  click(h, '(sample) Ravi Kumar enters the code'); h = page('#/p/digitalpaani/people');
  ok(/Verified/.test(rowOf(h, 'Ravi Kumar')) && vis(h).includes('No Lead with a verified phone: nobody would be notified at Lead level. This blocks go-live.'), '"Verified"; Reachability: "No Lead with a verified phone: nobody would be notified at Lead level. This blocks go-live."');
  click(h, 'Add a person', { where: { plant: DP } }); act('ppl:save', { plant: DP, id: '' }, { name: 'Neha Sharma', role: 'l3', phone: '+91 90000 40002', channel: 'wa', grant: '' });
  const neha = V.people(DP).find((x) => x.name === 'Neha Sharma');
  click(page('#/p/digitalpaani/people'), 'Send code', { where: { id: neha.id } }); click(page('#/p/digitalpaani/people'), '(sample) Neha Sharma enters the code');
  h = page('#/p/digitalpaani/people');
  ok(vis(h).includes('1 Operator and 1 Lead can be reached: their phones are verified.'), '"1 Operator and 1 Lead can be reached: their phones are verified."');
  click(h, 'Edit', { where: { id: neha.id } }); sh = sheetHtml();
  ok(lastSheet().title === 'Edit Neha Sharma' && vis(sh).includes('Changing the number means verifying it again.') && /value="Neha Sharma"/.test(sh), 'Edit opens the sheet filled in, with "Changing the number means verifying it again."');
  act('ui:close', { what: 'sheet' });
  h = page('#/p/digitalpaani');
  ok(vis(h).includes('Roster 2 people · 1 Operator · 1 Lead') && vis(h).includes('Reachability 1 Operator and 1 Lead with verified phones'), 'the People card: "2 people · 1 Operator · 1 Lead" and "1 Operator and 1 Lead with verified phones"');
  let cl = V.checklist(DP);
  ok(J(cl.blockers.map((b) => b.id)) === J(['drafts']) && vis(h).includes(cl.blockers[0].text), 'one blocker left: the drafts that can\'t resolve', J(cl.blockers.map((b) => b.text)));
  /* the drafts that can't resolve: Accept as draft, then Leave inactive with a reason */
  const why = 'No tank height yet: the survey team measures it next week';
  V.bindingsPass(DP, { show: 'cantresolve' }).rows.forEach((r) => {
    click(page('#/p/digitalpaani/review/bindings?show=cantresolve'), 'Accept as draft', { where: { pid: r.pid } });
    const d = page('#/p/digitalpaani/review/bindings?show=draft'); click(d, 'Leave inactive', { where: { id: r.alertId || V.bindingsPass(DP).rows.find((x) => x.pid === r.pid).alertId || r.pid } });
    ok(lastModal().title === `Leave ${r.name} inactive?`, `"Leave ${r.name} inactive?"`, lastModal().title);
    const c1 = actsOf(modalHtml()).find((b) => b.act === 'trig:inactive-confirm'); act(c1.act, c1.data, { reason: why });
  });
  cl = V.checklist(DP); h = page('#/p/digitalpaani');
  ok(cl.canGoLive && vis(h).includes('0 blockers') && vis(h).includes('No blockers. Gaps don\'t stop go-live.') && /<button[^>]*data-act="plant:golive"[^>]*>Go live<\/button>/.test(h), '"0 blockers"; "No blockers. Gaps don\'t stop go-live." with "Go live" enabled', J(cl.blockers.map((b) => b.text)));
  if (has('limitGaps')) ok(cl.gaps.some((g) => g.id === 'nolimits') && vis(h).includes(cl.gaps.find((g) => g.id === 'nolimits').text), 'the gap for readings with no limits shows', J(cl.gaps.map((g) => g.text)));
  click(h, 'Go live');
  ok(vis(modalHtml()).includes(V.goLivePreview(DP).trial.text) && /^Trial: no Trigger (fired|was active)$/.test(V.goLivePreview(DP).trial.text), 'the go-live dialog reads "Trial: no Trigger fired" (the trial is minutes old)', V.goLivePreview(DP).trial.text);
  act('ui:close', { what: 'modal' });
  ok(V.state(DP) === 'commissioning', '"Not yet" leaves DigitalPaani in Commissioning');
}

/* ════════ a Live plant set back: Readiness again ════════ */
V.reset();
{
  const r = V.returnToCommissioning(MAN, 'Aeration grid retrofit, two weeks'); const h = clean('#/p/manesar'); const cl = V.checklist(MAN);
  ok(r.ok && /<a class="tab on" href="#\/p\/manesar"[^>]*>Readiness</.test(h) && J(cardTitles(h, 'p7-track')) === J(['Structure', 'Bindings', 'People']) && vis(h).includes(cl.blockersChip.text), 'returned to Commissioning, Manesar\'s home is Readiness again with its blockers', cl.blockersChip.text);
  ok(cl.blockers.some((b) => b.id === 'drafts') && vis(h).includes(cl.blockers.find((b) => b.id === 'drafts').text), 'its drafts now block go-live', J(cl.blockers.map((b) => b.text)));
}

finish();
function finish() {
  console.log(`plant7 test · ${n} checks · ${bad.length} failures${skipped.length ? ` · skipped: ${skipped.join('; ')}` : ''}`);
  bad.forEach((b) => console.log('  ✗ ' + b));
  console.log(bad.length ? 'RESULT: FAIL' : 'RESULT: PASS');
  process.exit(bad.length ? 1 : 0);
}
