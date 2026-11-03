#!/usr/bin/env node
/* v7/2 · tests/ui7.test.js — unit checks for ui7.js: the kit (chips, state chips, toasts with Undo, links across the two
   prototypes), the router, the top bar, the story panel (12 chapters, their links, compare links, decision chips, numbers
   from the core with fallbacks), All Plants, Activity with Undo, the decisions strip, and the stylesheet's one amber chip.
   Loads the whole v7/2 app through tests/load72.js. Run: TZ=Asia/Calcutta node tests/ui7.test.js  (exit 1 on failure) */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./load72.js');
const { scan, visibleText, links, amberFillRules, cssTokens, chipProblems, ROUTE_PLAN, BANNED } = require('./smoke.js');

const U = L.V7UI; const V7 = L.V7; const W = L.window;
const ASSETS = path.resolve(__dirname, '..', 'assets');
let n = 0; const bad = [];
function ok(cond, name, info) { n++; if (!cond) bad.push(name + (info !== undefined ? '  → ' + String(info).slice(0, 400) : '')); }
function eq(a, b, name) { ok(a === b, name, `${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
const vis = (h) => visibleText(h);
const clean = (html, o) => scan(html, o || {}).filter((f) => f.kind !== 'data-word' && f.kind !== 'quoted');
if (!U || !V7) { console.log('ui7.test · the app did not load: ' + JSON.stringify(L.errors).slice(0, 400)); process.exit(1); }

/* ── kit: escaping, numbers, builders ─────────────────────────────────────────────────────────── */
eq(U.esc('<b>"x" & \'y\''), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;', 'esc escapes');
eq(U.txt('Oil & Grease Tank'), 'Oil &amp; Grease Tank', 'txt escapes plain text');
eq(U.txt('<span class="chip">x</span>'), '<span class="chip">x</span>', 'txt passes markup');
eq(U.txt('< 2.0 mg/L'), '&lt; 2.0 mg/L', 'txt escapes a lone <');
eq(U.h('a', { href: '#/x', data: { fooBar: 1 }, disabled: true }, 'hi'), '<a href="#/x" data-foo-bar="1" disabled>hi</a>', 'h builds attrs');
eq(U.num(2, 'mg/L'), '2.0 mg/L', 'num 2.0 mg/L'); eq(U.num(42, 'A'), '42 A', 'num 42 A'); eq(U.num(0.25), '0.25', 'num 0.25');
eq(U.num(85, '%'), '85%', 'num %'); eq(U.num(null), '—', 'num null'); eq(U.num(3.7, 'pH'), 'pH 3.7', 'num pH');
const tb = U.table({ cols: [{ label: 'Tag', key: 'tag' }, { label: 'Type', key: 'type' }], rows: [{ tag: 'BL-1', type: 'Oil & Grease Tank', _href: '#/p/manesar/eq/bl1' }] });
ok(/data-href="#\/p\/manesar\/eq\/bl1"/.test(tb) && /Oil &amp; Grease Tank/.test(tb) && /data-label="Type"/.test(tb), 'table rows, escaping, link');
const pg = U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Manesar STP' }], title: 'Manesar STP', tabs: [{ id: 'home', label: 'Coverage', href: '#/p/manesar' }, { id: 'issues', label: 'Issues', href: '#/p/manesar/issues', count: 3 }], active: 'issues', body: '<p>x</p>', aside: '<p>y</p>' });
ok(/class="tab on" href="#\/p\/manesar\/issues"/.test(pg) && /tab-n">3/.test(pg) && /has-aside/.test(pg) && /<span>Manesar STP<\/span><\/nav>/.test(pg), 'page: tabs, counts, aside, plain last crumb');
ok(/disabled aria-disabled="true"/.test(U.btn('Go live', { act: 'plant:golive', disabled: true, kind: 'primary' })) && /data-act="bind:decide" data-pid="p1"/.test(U.btn('Accept', { act: 'bind:decide', data: { pid: 'p1' } })), 'btn: disabled and data attributes');
ok(/No limit for this reading/.test(U.bandBar({ value: 3 })) && !/No limits yet/.test(U.bandBar({ value: 3 })), 'a band bar with no limits says so without the old words');

/* ── kit: source chips, always visible ────────────────────────────────────────────────────────── */
const ovr = U.sourceChip({ text: 'Override · Tuning · you · 29 Oct · review by 27 Jan', tone: 'ovr', sub: null, small: 'Derived: 85% (3.8 m)' });
ok(/chip chip-ovr/.test(ovr) && vis(ovr).includes('Override · Tuning · you · 29 Oct · review by 27 Jan') && vis(ovr).includes('Derived: 85% (3.8 m)') && /class="src-small"/.test(ovr), 'sourceChip: an override chip shows its base on a small line, visible');
const mv = U.sourceChip(V7.chipFor({ src: 'basemoved', old: '5 min', new: '15 min' }));
ok(/chip chip-moved/.test(mv) && vis(mv).includes('Base moved') && vis(mv).includes('Library changed 5 min → 15 min since you overrode it') && !/title=/.test(mv), 'sourceChip: Base moved, amber, with its sub line on screen and no hover title');
const su = U.sourceChip({ chip: V7.chipFor({ src: 'library', template: 'Chemical refill', v: 1, singleUse: { plant: 'manesar', plantName: 'Manesar STP' } }) });
ok(/chip-lib/.test(su) && /chip-single/.test(su) && vis(su).includes('Library · Chemical refill v1') && vis(su).includes('Single-use · Manesar STP only'), 'sourceChip: a single-use template shows its second chip');
const der = U.sourceChip('Derived · 85% of tank height (4.0 m)');
ok(/chip-der/.test(der) && vis(der) === 'Derived · 85% of tank height (4.0 m)', 'sourceChip: a chip text picks its tone from its words');
const gap = U.sourceChip(null);
ok(/chip-gap/.test(gap) && vis(gap).includes('Gap · no rule') && vis(gap).includes('No value · this reading raises nothing'), 'sourceChip: no value is a Gap with its line');
[['form', 'der'], ['changed', 'ovr'], ['libchanged', 'moved'], ['none', 'gap']].forEach(([old, tone]) => ok(new RegExp(`chip-${tone}\\b`).test(U.chip('x', { tone: old })) && new RegExp(`chip-${tone}\\b`).test(U.sourceChip(old)), `the older tone ${old} renders as ${tone}`));
['lib', 'der', 'ovr', 'moved', 'susp', 'forced', 'pin', 'prop', 'gap', 'frozen', 'next', 'single', 'review'].forEach((t) => { const h = U.sourceChip(t); ok(new RegExp(`chip-${t}\\b`).test(h) && !clean(h).length && !/Base moved/.test(h) === (t !== 'moved'), `sourceChip("${t}") has its own look and a clean label`, h); });
const z = V7.zoneInfo('manesar', 'bl1_amps', 'above');
const zc = U.sourceChip(z && z.perBand && z.perBand.caution);
ok(vis(zc).includes(z.perBand.caution.chip.text) && (!z.perBand.caution.chip.small || vis(zc).includes(z.perBand.caution.chip.small)), 'sourceChip of a real zone band shows the core\'s chip and its base line', vis(zc));
ok(!chipProblems(ovr + mv + su + der + gap + zc).length, 'the chips pass the smoke test\'s chip checks', JSON.stringify(chipProblems(ovr + mv + su + der + gap + zc)));
ok(chipProblems('<span class="chip chip-moved">Override · x</span><i title="Library · DO low v1">2.0</i>').length === 2, 'the chip checks catch a wrong amber chip and a hover-only source');
/* the stylesheet: Base moved is the only chip with an amber fill */
const css = fs.readFileSync(path.join(ASSETS, 'v7.css'), 'utf8'); const tokens = cssTokens(css);
eq(amberFillRules({ 'v7.css': css }, tokens).map((r) => r.selector).join(', '), '', 'v7.css: no chip but Base moved has an amber fill');
ok(amberFillRules({ 'x.css': '.chip-moved{background:#f4e5bf}' }, tokens).length === 0 && amberFillRules({ 'x.css': '.chip-warn{background:var(--warn-tint)}' }, tokens).length === 1, 'the amber check allows Base moved and catches any other amber chip');
ok(/\.chip-moved, \.chip-libchanged \{ background: #f4e5bf/.test(css), 'v7.css: Base moved is filled amber');

/* ── kit: state chips ─────────────────────────────────────────────────────────────────────────── */
eq(vis(U.stateChip('commissioning')), 'Commissioning · nothing is sent', 'stateChip: Commissioning says nothing is sent');
eq(vis(U.stateChip('live', { since: V7.plant('manesar').since })), 'Live since Tue 1 Sep', 'stateChip: Live since a date');
eq(vis(U.stateChip('live', { plant: 'bawal' })), 'Live since Wed 15 Jul', 'stateChip: Live since, read from the plant');
eq(vis(U.stateChip('draft')), 'Draft · never fires', 'stateChip: Draft');
eq(vis(U.stateChip('trial')), 'Active · trial', 'stateChip: Active · trial');
eq(vis(U.stateChip('active', { plant: 'vedanta' })), 'Active · trial', 'stateChip: active at a Commissioning plant is Active · trial');
eq(vis(U.stateChip('active', { plant: 'manesar' })), 'Active', 'stateChip: active at a Live plant is Active');
eq(vis(U.stateChip('inactive')), 'Inactive', 'stateChip: Inactive');
eq(vis(U.stateChip('on')) + '|' + vis(U.stateChip('off')) + '|' + vis(U.stateChip('On trial')), 'Active|Inactive|Active · trial', 'stateChip: the older state names map to the new words');
ok(/title="Readings here are generated samples, not from the plant"/.test(U.sampleTag()) && vis(U.sampleTag()) === 'Sample readings', 'sample tag and its title');

/* ── kit: links into the other prototype, toasts with Undo ────────────────────────────────────── */
const x1 = U.link('Manesar in v7/1', '../1/prototype.html#/p/manesar');
ok(/target="v7-1"/.test(x1) && vis(x1) === 'Manesar in v7/1 (opens v7/1)' && /class="xv"/.test(x1), 'link: into v7/1 opens its window and says so');
ok(!/opens/.test(U.link('Here', '#/p/manesar')) && !/target=/.test(U.link('Here', '#/p/manesar')), 'link: inside v7/2 stays plain');
let undone = 0; U.toast('Saved · SRCP-1, SRCP-2 added to TS-1', { undo: () => { undone++; return { ok: true, toast: 'Undone.' }; } });
ok(typeof U._last.undo === 'function' && U._last.toast === 'Saved · SRCP-1, SRCP-2 added to TS-1', 'toast: an undoable toast keeps its Undo');
U.toast('Plain'); ok(U._last.undo === null, 'toast: a plain toast has no Undo');

/* ── router ───────────────────────────────────────────────────────────────────────────────────── */
const hits = [];
U.route('t/:plant/eq/:id/:tab?', (p) => { hits.push(['tab', p]); return 'tab'; });
U.route('t/:plant/eq/:id/phone', (p) => { hits.push(['phone', p]); return 'phone'; });
eq(U.renderPath('#/t/manesar/eq/bl1/phone'), 'phone', 'router: literal beats param');
eq(U.renderPath('#/t/manesar/eq/bl1/issues'), 'tab', 'router: param tab');
eq(U.renderPath('t/manesar/eq/bl1'), 'tab', 'router: optional omitted');
U.renderPath('#/t/manesar/eq/a%20b?x=1&y=two%20words');
eq(hits[3][1].id, 'a b', 'router: decodes params'); eq(hits[3][1]._q.y, 'two words', 'router: query');
ok(/All Plants/.test(vis(U.renderPath('#/nowhere/at/all'))), 'router: unknown → All Plants');
U.route('t/boom', () => { throw new Error('kaboom'); });
const realErr = console.error; console.error = () => {};
ok(/could not be shown/.test(U.renderPath('#/t/boom')), 'router: a throwing page shows an error card');
console.error = realErr;
eq(U.match('#/activity').pattern, 'activity/:plant?', 'own route activity'); eq(U.match('#/p/manesar/activity').pattern, 'p/:plant/activity', 'own route plant activity');
eq(U.match('#/plants').pattern, 'plants', 'own route plants');

/* ── top bar ──────────────────────────────────────────────────────────────────────────────────── */
const chrome = U.chromeHtml('p/vedanta/trigger/a_3f'); const cv = vis(chrome);
ok(/<a class="tb-ver" href="\.\.\/index\.html" title="Both approaches side by side"><b>v7\/2<\/b><span> · Alex's model as drafted<\/span><\/a>/.test(chrome.replace(/&#39;/g, '\'')) && cv.includes('v7/2 · Alex\'s model'), 'top bar: badge "v7/2 · Alex\'s model as drafted" to the overview', chrome.slice(0, 400));
const same = /<a class="tb-same" id="tbSame" href="([^"]*)" target="v7-1"[^>]*><span class="tb-same-l">Same place in <\/span>v7\/1 →<\/a>/.exec(chrome);
ok(!!same && same[1] === '../1/prototype.html#/p/vedanta/issue/is_5m' && cv.includes('Same place in v7/1 →'), 'top bar: "Same place in v7/1 →" opens chapter 6\'s v7/1 moment in the window v7-1', same && same[1]);
eq(U.samePlaceHref('p/manesar'), '../1/prototype.html#/p/manesar', 'Same place: Coverage');
eq(U.samePlaceHref('deviations'), '../1/prototype.html#/differences', 'Same place: Deviations');
eq(U.samePlaceHref('p/digitalpaani/review/structure'), '../1/prototype.html#/p/digitalpaani/scada', 'Same place: the structure pass');
eq(U.samePlaceHref('plants'), '../1/prototype.html#/plants', 'Same place: a page in no chapter goes to All Plants');
ok(/@media \(max-width: 600px\) \{\s*\.tb-ver span, \.tb-same-l \{ display: none; \}/.test(css), 'under 600px the badge reads "v7/2" and the link "v7/1 →"');
const navTxt = vis((/<nav class="tb-nav"[\s\S]*?<\/nav>/.exec(chrome) || [''])[0]);
eq(navTxt, 'All Plants Library Deviations Activity Decisions', 'nav: All Plants · Library · Deviations · Activity · Decisions');
ok(/Story clock/.test(cv) && cv.includes(V7.fmt(V7.now())) && /\+1 hour/.test(cv) && /\+6 hours/.test(cv) && /\+1 day/.test(cv) && /\+1 week/.test(cv) && /Reset the story/.test(cv) && /\bStory\b/.test(cv), 'top bar: clock, move time on, Story, Reset');
for (const p of ['plants', 'p/digitalpaani', 'p/vedanta', 'p/manesar/trigger/a_do_at2', 'library', 'deviations', 'decisions']) { const f = clean(U.chromeHtml(p)); ok(!f.length, 'top bar and story: no banned words or ids at #/' + p, JSON.stringify(f)); }

/* ── the story panel ──────────────────────────────────────────────────────────────────────────── */
const TITLES = ['The library', 'A new plant from the survey', 'The bindings pass', 'Readiness', 'Trial and tuning', 'Safety in commissioning', 'Go live', 'Live operation', 'Coverage', 'A library change', 'Deviations', 'Decisions'];
const CMP = ['#/library', '#/p/digitalpaani/scada', '#/p/digitalpaani/library', '#/p/digitalpaani', '#/p/vedanta/alert/a_3d', '#/p/vedanta/issue/is_5m', '#/p/vedanta', '#/p/manesar/issue/is_2z', '#/p/manesar', '#/library/OS_TANK_DF', '#/differences', '#/decisions'];
const ch = U.chapters();
eq(ch.map((c) => c.title).join(' · '), TITLES.join(' · '), 'the story lists 12 chapters with the v7/2 titles');
ok(ch.every((c) => c.text.length === 2 && c.text.every((t) => typeof t === 'string' && t.trim().length > 20 && !/\bundefined\b|\bNaN\b|\bnull\b/.test(t))), 'every chapter has two sentences', JSON.stringify(ch.map((c) => c.text)));
ok(ch.every((c, i) => c.compare.href === '../1/prototype.html' + CMP[i] && c.compare.target === 'v7-1' && c.compare.label === 'Compare with v7/1 →' && c.compare.title === 'Opens the same moment in v7/1, the recommended approach'), 'every chapter compares with the same moment in v7/1, in the window v7-1', JSON.stringify(ch.map((c) => c.compare.href)));
const sh = U.storyHtml('p/vedanta'); const sv = vis(sh);
ok(sv.includes('The story') && sv.includes('Twelve chapters, start to finish: the same moments as v7/1, in Alex\'s model. The clock starts at ' + V7.fmt(V7.NOW0) + '.'), 'story header');
ok(sv.includes('Sample plants run on sample readings, generated the same way every time. Reset the story to start again; v7/1 keeps its own story.'), 'story footer');
eq((sh.match(/>Take me there →</g) || []).length, 12, 'every chapter has "Take me there →"');
eq((sh.match(/target="v7-1"[^>]*>Compare with v7\/1 →</g) || []).length, 12, 'every chapter has "Compare with v7/1 →"');
ok(/<li class="ch on" data-ch="7">/.test(sh), 'the panel lights the chapter of the page (Vedanta home → 7)');
/* every link opens a planned v7/2 route, registered, on a real object; "Take me there" lights its own chapter */
const D = W.V7DEC; const plan = [].concat(...Object.keys(ROUTE_PLAN).map((f) => ROUTE_PLAN[f]));
function realObject(href) {
  const p = href.replace(/^#\/?/, '').split('?')[0].split('/');
  if (p[0] === 'library' && p[1] === 'templates') return !!V7.template(p[2]);
  if (p[0] === 'library' && p[1] === 'eq-types') return !!V7.libType(p[2]);
  if (p[0] !== 'p') return true;
  if (!V7.plant(p[1])) return false;
  if (p[2] === 'trigger') return !!V7.alert(p[1], p[3]);
  if (p[2] === 'sensor') return V7.sensors(p[1]).some((s) => s.id === p[3]);
  if (p[2] === 'up') return !!V7.unitProcess(p[1], p[3]);
  if (p[2] === 'issue') return !!V7.issue(p[1], p[3]);
  return true;
}
ch.forEach((c) => {
  [{ label: 'Take me there', href: c.href }].concat(c.also).forEach((a) => {
    const path0 = a.href.replace(/^#\/?/, '').split('?')[0];
    const planned = plan.find((pt) => D.matchRoute(pt, path0));
    const m = U.match(a.href);
    ok(!!planned && !!m && D.matchRoute(m.pattern, path0) && realObject(a.href), `chapter ${c.n}: "${a.label}" opens a registered v7/2 route on a real object`, `${a.href} planned ${planned} registered ${m && m.pattern}`);
  });
  eq(U.chapterOf(c.href), c.n, `chapter ${c.n}: "Take me there" lights its own chapter`);
});
/* the decision chips cover every card, named as the card names itself, and open its page */
const cards = (W.V7_DECISIONS || []).map((d) => d.id);
const chipIds = [...new Set([].concat(...ch.map((c) => c.decisions.map((d) => d.id))))];
eq(chipIds.slice().sort((a, b) => +a.slice(1) - +b.slice(1)).join(), cards.slice().sort((a, b) => +a.slice(1) - +b.slice(1)).join(), 'the chips across the 12 chapters cover every card in the decision file');
ok(cards.length >= 21, 'the decision file is loaded', cards.length);
ok(ch.every((c) => c.decisions.every((d) => d.href === '#/decisions/' + d.id && d.label === D.shortOf(D.byId(d.id)))), 'each chip opens #/decisions/<id> and names the card by its short name');
[['D26', 2], ['D22', 3], ['D24', 5], ['D27', 9], ['D23', 10], ['D25', 11], ['D20', 8], ['D8', 9]].forEach(([id, k]) => ok(ch[k - 1].decisions.some((d) => d.id === id), `card ${id} shows in chapter ${k}`));
ok(ch.every((c) => c.decisions.every((d) => !clean(`<p>${U.esc(d.label)}</p>`).length)), 'the chip names pass the word list');
ok(Object.keys(U._story.DEC_LABEL).every((id) => !clean(`<p>${U.esc(U._story.DEC_LABEL[id])}</p>`).length), 'the stand-in chip names pass the word list too');
/* numbers come from the core */
const t0 = V7.trialStart('vedanta'); const day = Math.floor((V7.now() - t0) / 864e5) + 1;
ok(ch[4].text[0].includes(`Vedanta ETP is on day ${day} of its trial`), 'chapter 5: the trial day from trialStart', ch[4].text[0]);
const lvl = V7.trialStats('vedanta', 'a_3d');
ok(ch[4].text[0].includes(`averages ${lvl.perDayText} trial firings a day`), 'chapter 5: the noisy rate from trialStats', ch[4].text[0]);
const sc = V7.structure('digitalpaani').counts;
ok(ch[1].text[1].includes(`proposes ${sc.ups} unit processes and ${sc.cgs} control groups`), 'chapter 2: counts from the structure', ch[1].text[1]);
const em = V7.trialStats('vedanta', 'a_3f').firings.find((f) => f.band === 'emergency');
ok(ch[5].text[1].startsWith(`On ${V7.fmt(em.start)} EQ-1's pH reached the Emergency band`), 'chapter 6: the Emergency trial firing\'s start', ch[5].text[1]);
ok(ch[11].text[0].startsWith(`The same ${cards.length} questions as v7/1`), 'chapter 12: the number of cards, counted');
ok(ch[0].text[0].includes(`${V7.libTypes().length} equipment types`), 'chapter 1: the equipment types, counted');
const is2z = V7.issue('manesar', 'is_2z');
ok(ch[7].text[0].includes(`at ${U.fmt(is2z.opened).slice(-5)}`) && ch[7].href === '#/p/manesar/issue/is_2z', 'chapter 8: the open Issue and its time from the core', ch[7].text[0]);
ok(ch[6].text[0] === 'Vedanta ETP still has one draft undecided, so Go live is blocked until it is decided.', 'chapter 7: the drafts left from the checklist', ch[6].text[0]);
/* a value missing: the sentence falls back and never shows a hole */
const saved = {}; const stub = ['trialStats', 'trialStart', 'structure', 'checklist', 'template', 'zoneInfo', 'issues', 'libTypes', 'people', 'triggerName'];
stub.forEach((k) => { saved[k] = V7[k]; V7[k] = () => { throw new Error('missing'); }; });
let fb;
try { fb = U.chapters(); } finally { stub.forEach((k) => { V7[k] = saved[k]; }); }
ok(fb.length === 12 && fb.every((c) => c.text.length === 2 && c.text.every((t) => t.trim() && !/\bundefined\b|\bNaN\b|\bnull\b/.test(t))), 'with the core values missing every chapter still has two clean sentences', JSON.stringify(fb.map((c) => c.text)));
ok(fb[4].text[0].startsWith('Vedanta ETP is in its trial') && fb[1].text[1].includes('proposes its unit processes and control groups') && fb[5].text[1].startsWith('During the trial') && fb[0].text[0].startsWith('The library holds the equipment types'), 'with values missing the fallback sentences show', JSON.stringify([fb[4].text[0], fb[1].text[1], fb[5].text[1]]));
stub.forEach((k) => { V7[k] = () => ({ perDay: NaN, perDayText: 'NaN', counts: { ups: NaN }, firings: [{ band: 'emergency', start: NaN }] }); });
let fb2;
try { fb2 = U.chapters(); } finally { stub.forEach((k) => { V7[k] = saved[k]; }); }
ok(fb2.every((c) => c.text.every((t) => !/\bundefined\b|\bNaN\b|\bnull\b|Invalid Date/.test(t))), 'with odd values from the core no sentence shows NaN', JSON.stringify(fb2.map((c) => c.text)).slice(0, 300));
/* chapterOf */
[['library', 1], ['library/eq-types/BLW', 1], ['library/templates/tpl_up_activated-sludge_do-low', 1], ['library/templates/tpl_up_activated-sludge_mlss-low', 10], ['library/eq-types/BLW/tasks', 10],
  ['p/digitalpaani/review/structure', 2], ['p/digitalpaani/scada', 2], ['p/digitalpaani/structure/drawing', 2], ['p/digitalpaani/review/bindings', 3], ['p/digitalpaani/library', 3],
  ['p/digitalpaani', 4], ['p/digitalpaani/people', 4], ['p/vedanta/trigger/a_3d', 5], ['p/vedanta/alert/a_3d', 5], ['p/vedanta/sensor/v_eq1_LVL', 5], ['p/vedanta/triggers', 5],
  ['p/vedanta/trigger/a_3f', 6], ['p/vedanta/alert/a_3f', 6], ['p/vedanta/issues', 6], ['p/vedanta', 7], ['p/vedanta/review/bindings', 7], ['p/vedanta/people/service-dates', 7],
  ['p/manesar/issue/is_2z', 8], ['p/manesar/trigger/a_do_at2', 8], ['p/manesar/up/at2', 8], ['p/manesar/structure', 8], ['p/manesar/sensor/at2_do', 8],
  ['p/manesar', 9], ['p/manesar/readings', 9], ['p/manesar/review/bindings', 9], ['p/bawal', 9], ['deviations', 11], ['differences', 11], ['p/manesar/deviations', 11],
  ['decisions', 12], ['decisions/D3', 12], ['plants', 0], ['activity', 0], ['p/vedanta/activity', 0]].forEach(([p, k]) => eq(U.chapterOf(p), k, 'chapterOf ' + p));
eq(U._story.STORY_KEY, 'ctl72.story', 'the panel remembers open or closed under ctl72.story');

/* ── All Plants ───────────────────────────────────────────────────────────────────────────────── */
const plants = U.renderPath('#/plants'); const pv = vis(plants);
ok(['DigitalPaani', 'Vedanta ETP', 'Manesar STP', 'Bawal WTP'].every((x) => pv.includes(x)), 'All Plants lists the four plants');
ok(pv.indexOf('DigitalPaani') < pv.indexOf('Bawal WTP') && pv.indexOf('Vedanta ETP') < pv.indexOf('Bawal WTP'), 'All Plants: attention first');
ok(pv.includes('Real plant graph') && pv.includes('Sample plant') && pv.includes('Sample readings'), 'All Plants: tags');
ok(pv.includes('Commissioning · nothing is sent') && pv.includes('Live since Tue 1 Sep') && pv.includes('Live since Wed 15 Jul'), 'All Plants: state chips');
ok(pv.includes(`day ${day} of trial`) && pv.includes('trial not started'), 'All Plants: Vedanta\'s trial day, DigitalPaani\'s trial not started');
['digitalpaani', 'vedanta', 'manesar', 'bawal'].forEach((k) => {
  const p = V7.plant(k); const c = V7.deviationCounts(k); const nDev = c.overrides + c.pinned + c.singleUse;
  ok(pv.includes(`${p.upCount} unit process${p.upCount === 1 ? '' : 'es'} · ${p.equipmentCount} piece${p.equipmentCount === 1 ? '' : 's'} of equipment`), `All Plants: ${p.name}'s unit processes and equipment`);
  ok(pv.includes(`${nDev} deviation${nDev === 1 ? '' : 's'}`) && links(plants).includes(`#/p/${k}/deviations`), `All Plants: ${p.name}'s deviations, linked`);
  if (c.structure) ok(pv.includes(`${c.structure} structure change${c.structure === 1 ? '' : 's'}`), `All Plants: ${p.name}'s structure changes, counted apart`);
});
const mcov = V7.coverage('manesar').triggers;
ok(pv.includes('1 open Issue') && pv.includes(`${mcov.issues} Issues in the last 7 days`), 'All Plants: a Live plant\'s open Issues and Issues in the last 7 days');
ok(pv.includes('3 blockers') && pv.includes('Go live is blocked'), 'All Plants: a Commissioning plant\'s blockers', pv.slice(0, 600));
ok(pv.includes('DigitalPaani\'s plant graph is real; its readings are samples too.'), 'All Plants: footnote');
ok(!clean(plants).length, 'All Plants: no banned words or ids', JSON.stringify(clean(plants)));

/* ── Activity, and Undo while it still applies ────────────────────────────────────────────────── */
const act = U.renderPath('#/activity'); const av = vis(act);
ok(/Activity/.test(av) && /All plants/.test(av) && /Thu 29 Oct|Fri 23 Oct/.test(av), 'Activity lists rows by day, with plant-less lines read "All plants"');
ok(av.includes('Published Sludge blanket high v2 (Minor)'), 'Activity: the library publish is in All Plants');
const actM = vis(U.renderPath('#/p/manesar/activity'));
ok(!actM.includes('Published Sludge blanket high') && actM.includes('Structure confirmed: 7 unit processes'), 'a plant\'s Activity has its own lines only: no library publish at Manesar');
ok(/class="filter on" href="#\/activity\/manesar"/.test(U.renderPath('#/activity/manesar')), 'Activity filter by plant');
const kinds = (U.renderPath('#/activity/vedanta').match(/href="#\/activity\/vedanta\?kind=([a-z]+)"/g) || []).map((x) => x.match(/kind=([a-z]+)/)[1]);
ok(kinds.includes('structure') && kinds.includes('config'), 'Activity: kinds filter (structure, changes)', kinds.join());
ok(/class="filter on"/.test(U.renderPath('#/activity/vedanta?kind=structure')), 'Activity kind filter is on');
for (const p of ['#/activity', '#/activity/manesar', '#/p/manesar/activity', '#/p/digitalpaani/activity', '#/p/vedanta/activity']) { const f = clean(U.renderPath(p)); ok(!f.length, 'no banned words on ' + p, JSON.stringify(f)); }
ok(vis(U.renderPath('#/p/vedanta/activity')).includes('Commissioning · nothing is sent') && !vis(U.renderPath('#/p/manesar/activity')).includes('Commissioning · nothing is sent'), 'a plant\'s Activity carries its state chip');
/* Undo from the toast, then from Activity while nothing later touched the same rows */
const dp = 'digitalpaani';
const uffp1 = V7.nodes(dp).find((x) => x.tag === 'UFFP-1'); const uffp2 = V7.nodes(dp).find((x) => x.tag === 'UFFP-2'); const uf1 = V7.unitProcesses(dp).find((x) => x.tag === 'UF-1');
const unc0 = V7.structure(dp).unclassified.length;
const a1 = V7.place(dp, [uffp1.id], [uf1.id]);
U.toast(a1.toast, { undo: () => V7.undoStructure(dp, a1.token) });
U._last.undo();
eq(V7.structure(dp).unclassified.length, unc0, 'Undo from the toast puts the placement back');
ok(/^Undone/.test(U._last.toast || ''), 'the Undo toast says what was undone', U._last.toast);
const a2 = V7.place(dp, [uffp1.id], [uf1.id]);
const undoBtn = (html, tok) => new RegExp(`data-act="undo:activity"[^>]*data-token="${tok}"`).test(html);
ok(undoBtn(U.renderPath('#/p/digitalpaani/activity'), a2.token) && undoBtn(U.renderPath('#/activity'), a2.token), 'Activity shows Undo on the line while it can be undone');
const a3 = V7.place(dp, [uffp2.id], [uf1.id]);
const actNow = U.renderPath('#/p/digitalpaani/activity');
eq(undoBtn(actNow, a2.token), V7.canUndo(dp, a2.token) === true, 'Activity shows Undo exactly while the core says it can be undone');
ok(undoBtn(actNow, a3.token), 'the latest action can be undone from Activity');
const fakeEl = (attrs) => ({ getAttribute: (k) => (k in attrs ? attrs[k] : null) });
U._handlers['undo:activity'](fakeEl({ 'data-plant': dp, 'data-token': a3.token }));
ok(!V7.structure(dp).unclassified.every((id) => id !== uffp2.id), 'Undo on the Activity line undoes it');
ok(!undoBtn(U.renderPath('#/p/digitalpaani/activity'), a3.token), 'afterwards that Undo is gone');
ok(/Undone/.test(vis(U.renderPath('#/p/digitalpaani/activity'))), 'the undo is written to Activity');
U._handlers['undo:activity'](fakeEl({ 'data-plant': dp, 'data-token': 'u_nope' }));
ok(/can no longer be undone/.test(U._last.toast || ''), 'an Undo that no longer applies says so', U._last.toast);

/* ── the clock and Reset ──────────────────────────────────────────────────────────────────────── */
eq(U._story.advanceText({ opened: [{ plant: 'manesar' }], closed: [1], trial: [1, 2], expired: [1], tasksDue: [1, 2, 3] }).replace(/^Time moved on to [^.]*\. /, ''), '1 Issue opened at Manesar STP · 1 closed · 2 trial firings · 1 override expired · 3 Tasks due.', 'the clock toast in plain words');
eq(U._story.advanceText({ expired: [1, 2] }).replace(/^Time moved on to [^.]*\. /, ''), '2 overrides expired.', 'the clock toast: overrides expired');
V7.reset();
eq(U._story.resetText(), 'DigitalPaani\'s plant graph just read, Vedanta ETP on day 6 of trial, Manesar STP and Bawal WTP Live.', 'Reset the story: the toast');
const before = V7.now(); const txt = U.advance(60);
ok(V7.now() - before === 3600e3 && /^Time moved on to /.test(txt) && U._last.toast === txt, 'advance moves the clock an hour and says what happened', txt);
V7.reset();

/* ── the decisions strip on every routed page ─────────────────────────────────────────────────── */
const realDec = W.V7DEC;
delete W.V7DEC;
ok(!/dec-mark/.test(U.renderPath('#/p/manesar/activity')), 'no decision file: no strip, the page renders as before');
const seenMarks = [];
W.V7DEC = { markerHtml: (v, p) => { seenMarks.push([v, p]); return p === 'p/manesar/activity' ? '<aside class="dec-mark" aria-label="Decisions on this screen">STRIP</aside>' : ''; } };
const pmk = U.renderPath('#/p/manesar/activity?kind=config');
const iStrip = pmk.indexOf('<aside class="dec-mark"'); const iHead = pmk.indexOf('</header>'); const iTabs = pmk.indexOf('<nav class="tabs"');
ok(iHead > 0 && iStrip > iHead && (iTabs < 0 || iTabs > iStrip), 'strip: right after the page header, before the tabs', `${iHead} ${iStrip} ${iTabs}`);
eq((pmk.match(/dec-mark/g) || []).length, 1, 'strip: once');
ok(seenMarks.some(([v, p]) => v === '2' && p === 'p/manesar/activity'), 'markerHtml gets variant 2 and the path without "#/" or the query', JSON.stringify(seenMarks));
W.V7DEC = { markerHtml: () => { throw new Error('boom'); } };
const pthrow = U.renderPath('#/p/manesar/activity');
ok(/Activity/.test(vis(pthrow)) && !/dec-mark/.test(pthrow) && !/could not be shown/.test(pthrow), 'a throwing markerHtml: the page renders, without a strip');
W.V7DEC = realDec;
const liveStrip = U.renderPath('#/p/manesar/activity');
ok(liveStrip.includes(realDec.markerHtml('2', 'p/manesar/activity')) && /D11/.test(vis(realDec.markerHtml('2', 'p/manesar/activity'))), 'with the decision file: the live strip shows on a plant\'s Activity (card D11)');
ok(realDec.markerHtml('2', 'p/vedanta/alert/a_3f') !== '' && /D3/.test(vis(realDec.markerHtml('2', 'p/vedanta/alert/a_3f'))), 'an alias route gets the strip of the page it renders (alert → Trigger page, card D3)');
ok(!/dec-mark/.test(U.renderPath('#/decisions/D3')), 'never on a Decisions page');
ok(U.match('#/p/manesar/activity').route.raw === U._pages.plantActivityPage, 'route().raw keeps the module\'s own renderFn');

/* ── the word list itself ─────────────────────────────────────────────────────────────────────── */
const words = (s) => clean(`<p>${s}</p>`).map((f) => f.word);
ok(words('An alert here').length && words('the SCADA layout').length && words('On trial').length && words('Tier B').length && words('Back to the library value').length, 'the word list catches v7/1 words');
ok(!words('Criticality tier B · limit rule · Gap · no rule · Persistence · must hold for 5 min · Clearing · must clear for 10 min · closed as a false alarm · Set it back to the library value').length, 'the word list lets v7/2\'s own words through');
ok(words('rules').length && words('must hold for 5 min').length && words('D3').length && !clean('<p>D3</p>', { decisions: true }).length, 'bare rules, bare "must hold for" and card ids outside the Decisions page are caught');
ok(BANNED.length > 60, 'the word list is v7/2\'s', BANNED.length);

console.log(`ui7.test · ${n - bad.length}/${n} passed`);
if (bad.length) { console.log(bad.map((b) => '  FAIL ' + b).join('\n')); process.exit(1); }
process.exit(0);
