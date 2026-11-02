#!/usr/bin/env node
/* v7 · tests/ui7.test.js — unit checks for ui7.js (kit, router, shell, story, All Plants, Activity).
   Uses the real core7.js when it exists, else tests/ui7.stub.js. Run: node tests/ui7.test.js  (exit 1 on failure) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { installDom, scan, visibleText, links } = require('./smoke.js');

const ASSETS = path.resolve(__dirname, '..', 'assets');
installDom();
const V6 = ['data.js', 'layout-digitalpaani.js', 'catalogue.js', 'flows.js', 'rca.js', 'app.js', 'runtime.js'];
for (const f of V6) vm.runInThisContext(fs.readFileSync(path.join(ASSETS, f), 'utf8'), { filename: f });
const realCore = fs.existsSync(path.join(ASSETS, 'core7.js'));
const coreFile = realCore ? path.join(ASSETS, 'core7.js') : path.join(__dirname, 'ui7.stub.js');
vm.runInThisContext(fs.readFileSync(coreFile, 'utf8'), { filename: coreFile });
vm.runInThisContext(fs.readFileSync(path.join(ASSETS, 'ui7.js'), 'utf8'), { filename: 'ui7.js' });
const U = global.V7UI; const V7 = global.V7;
V7.boot();

let n = 0; const bad = [];
function ok(cond, name, info) { n++; if (!cond) bad.push(name + (info !== undefined ? '  → ' + String(info).slice(0, 300) : '')); }
function eq(a, b, name) { ok(a === b, name, `${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
const vis = (h) => visibleText(h);

/* kit: escaping */
eq(U.esc('<b>"x" & \'y\''), '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;', 'esc escapes');
eq(U.txt('Oil & Grease Tank'), 'Oil &amp; Grease Tank', 'txt escapes plain text');
eq(U.txt('<span class="chip">x</span>'), '<span class="chip">x</span>', 'txt passes markup');
eq(U.txt('< 2.0 mg/L'), '&lt; 2.0 mg/L', 'txt escapes a lone <');
eq(U.h('a', { href: '#/x', data: { fooBar: 1 }, disabled: true }, 'hi'), '<a href="#/x" data-foo-bar="1" disabled>hi</a>', 'h builds attrs');
/* numbers */
eq(U.num(2, 'mg/L'), '2.0 mg/L', 'num 2.0 mg/L'); eq(U.num(42, 'A'), '42 A', 'num 42 A'); eq(U.num(0.25), '0.25', 'num 0.25');
eq(U.num(85, '%'), '85%', 'num %'); eq(U.num(4500, 'mg/L'), '4500 mg/L', 'num 4500'); eq(U.num(null), '—', 'num null'); eq(U.num(6.5), '6.5', 'num 6.5');
/* chips */
ok(/chip-lib/.test(U.sourceChip({ value: 2, chip: 'lib' })) && /From the library/.test(U.sourceChip({ value: 2, chip: 'lib' })), 'sourceChip lib');
ok(/chip-form/.test(U.sourceChip({ value: 40, chip: 'form', chipText: 'From the SCADA form: 22 kW motor' })) && /22 kW motor/.test(U.sourceChip({ value: 40, chip: 'form', chipText: 'From the SCADA form: 22 kW motor' })), 'sourceChip form keeps its text');
ok(/chip-libchanged/.test(U.sourceChip({ value: 1.5, chipText: 'Library changed since', libValue: 2, base: 1.8 })), 'sourceChip by text');
ok(/Library value 2; it was 1.8/.test(U.sourceChip({ value: 1.5, chip: 'changed', libValue: 2, base: 1.8 })), 'sourceChip changed carries library value');
ok(/No limits yet/.test(U.sourceChip(null)) && /chip-none/.test(U.sourceChip({ value: null })), 'sourceChip none');
ok(/Next phase/.test(U.sourceChip({ chip: 'next' })), 'sourceChip next');
[['commissioning', 'Commissioning'], ['live', 'Live'], ['draft', 'Draft'], ['trial', 'On trial'], ['on', 'On'], ['off', 'Off'], ['On trial', 'On trial']].forEach(([s, t]) => eq(vis(U.stateChip(s)), t, 'stateChip ' + s));
eq(vis(U.sampleTag()), 'Sample readings', 'sample tag text');
/* band bar */
const bbBelow = U.bandBar({ dir: 'below', bands: { caution: null, minor: 2, major: 1, emergency: 0.5 }, value: 1.8, valid: [0, 10], unit: 'mg/L' });
ok(/bb-minor/.test(bbBelow) && /bb-major/.test(bbBelow) && /bb-emergency/.test(bbBelow) && !/bb-caution/.test(bbBelow), 'bandBar below: set bands only');
ok(/Now 1.8 mg\/L/.test(vis(bbBelow)), 'bandBar shows current value', vis(bbBelow));
ok(/in Minor/.test(bbBelow), 'bandBar knows the value is in Minor');
ok(/left:0\.00%;width:5\.00%" title="Emergency"/.test(bbBelow), 'bandBar below: emergency region from 0 to 0.5', bbBelow.match(/bb-emergency"[^>]*/));
const bbAbove = U.bandBar({ dir: 'above', bands: { caution: 85, major: 95 }, value: 70, valid: [0, 100], unit: '%' });
ok(/left:85\.00%;width:10\.00%" title="Caution"/.test(bbAbove) && /left:95\.00%;width:5\.00%" title="Major"/.test(bbAbove), 'bandBar above regions', bbAbove);
ok(/inside the limits/.test(bbAbove), 'bandBar above: inside the limits');
ok(/bb-sm/.test(U.bandBar({ dir: 'above', bands: { minor: 48 }, value: 49, compact: true })) && !/Now/.test(vis(U.bandBar({ dir: 'above', bands: { minor: 48 }, value: 49, compact: true }))), 'bandBar compact has no labels');
ok(/No limits yet/.test(U.bandBar({ value: 3 })), 'bandBar without limits');
ok(U.bandBar({ dir: 'above', bands: { caution: 40, minor: 42, major: 46 }, value: 49, unit: 'A' }).includes('bb-at-major'), 'bandBar marker coloured by band (no valid range given)');
eq(U.bandOf(0.4, 'below', { minor: 2, major: 1, emergency: 0.5 }), 'emergency', 'bandOf deepest below');
eq(U.bandOf(43, 'above', { caution: 40, minor: 42, major: 46 }), 'minor', 'bandOf above');
eq(U.bandOf(39, 'above', { caution: 40 }), null, 'bandOf inside');
/* table / list / card / page */
const tb = U.table({ cols: [{ label: 'Tag', key: 'tag' }, { label: 'Type', key: 'type' }], rows: [{ tag: 'BL-1', type: 'Oil & Grease Tank', _href: '#/p/manesar/eq/bl1' }] });
ok(/data-href="#\/p\/manesar\/eq\/bl1"/.test(tb) && /Oil &amp; Grease Tank/.test(tb) && /data-label="Type"/.test(tb), 'table rows, escaping, link');
ok(/class="empty"/.test(U.table({ cols: [], rows: [], empty: 'None yet.' })) && /None yet/.test(U.table({ cols: [], rows: [], empty: 'None yet.' })), 'table empty');
const pg = U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Manesar STP' }], title: 'Manesar STP', chips: [U.stateChip('live')], tabs: [{ id: 'home', label: 'Home', href: '#/p/manesar' }, { id: 'issues', label: 'Issues', href: '#/p/manesar/issues', count: 3 }], active: 'issues', body: '<p>x</p>', aside: '<p>y</p>' });
ok(/class="tab on" href="#\/p\/manesar\/issues"/.test(pg) && /tab-n">3/.test(pg) && /has-aside/.test(pg), 'page tabs, counts, aside');
ok(/<span>Manesar STP<\/span><\/nav>/.test(pg), 'page: last crumb is plain text');
ok(/tone-bad/.test(U.card({ title: 'Blockers', body: 'x', tone: 'bad' })), 'card tone');
ok(/data-href="#\/x"/.test(U.list([{ title: 'A', href: '#/x', sub: 'b' }])), 'list item link');
ok(/disabled aria-disabled="true"/.test(U.btn('Go live', { act: 'golive', disabled: true, kind: 'primary', title: 'Go live is blocked' })), 'btn disabled');
ok(/data-act="decide" data-pid="p1"/.test(U.btn('Accept', { act: 'decide', data: { pid: 'p1' } })), 'btn data attrs');
ok(/<a class="btn btn-secondary" href="#\/x">/.test(U.btn('Open', { href: '#/x' })), 'btn link');
ok(/class="phone"/.test(U.phone('<p>x</p>')), 'phone frame');

/* router */
const hits = [];
U.route('t/:plant/eq/:id/:tab?', (p) => { hits.push(['tab', p]); return 'tab'; });
U.route('t/:plant/eq/:id/phone', (p) => { hits.push(['phone', p]); return 'phone'; });
eq(U.renderPath('#/t/manesar/eq/bl1/phone'), 'phone', 'router: literal beats param');
eq(U.renderPath('#/t/manesar/eq/bl1/issues'), 'tab', 'router: param tab');
eq(U.renderPath('t/manesar/eq/bl1'), 'tab', 'router: optional omitted');
eq(hits[2][1].tab, undefined, 'router: optional param absent');
U.renderPath('#/t/manesar/eq/a%20b?x=1&y=two%20words');
eq(hits[3][1].id, 'a b', 'router: decodes params'); eq(hits[3][1]._q.y, 'two words', 'router: query');
ok(/All Plants/.test(vis(U.renderPath('#/nowhere/at/all'))), 'router: unknown → All Plants');
U.route('t/boom', () => { throw new Error('kaboom'); });
ok(/could not be shown/.test(U.renderPath('#/t/boom')), 'router: a throwing page shows an error card');
eq(U.match('#/activity').pattern, 'activity/:plant?', 'own route activity');
eq(U.match('#/p/manesar/activity').pattern, 'p/:plant/activity', 'own route plant activity');

/* All Plants */
const plants = U.renderPath('#/plants'); const pv = vis(plants);
ok(/All Plants/.test(pv) && /DigitalPaani/.test(pv) && /Manesar STP/.test(pv) && /Bawal WTP/.test(pv) && /Vedanta ETP/.test(pv), 'All Plants lists the four plants');
ok(pv.indexOf('DigitalPaani') < pv.indexOf('Bawal WTP'), 'All Plants: attention first (DigitalPaani before Bawal)');
ok(/Go live is blocked/.test(pv) && /Real SCADA layout/.test(pv) && /Sample plant/.test(pv) && /Sample readings/.test(pv), 'All Plants: readiness, tags, sample tag');
ok(/Live since Tue 1 Sep/.test(pv), 'All Plants: Live since date', pv.match(/Live since[^·]*/));
ok(/day 6 of trial/.test(pv), 'All Plants: Vedanta day 6 of trial');
ok(/Coverage/.test(pv) && /issues a day/.test(pv) && !/firings a day/.test(pv), 'All Plants: coverage summary on live plants (issues a day)');
ok(links(plants).includes('#/p/manesar/differences'), 'All Plants links to plant differences');
/* Activity */
const act = U.renderPath('#/activity'); const av = vis(act);
ok(/Activity/.test(av) && /All plants/.test(av) && (V7.activity({}).length ? /Thu 29 Oct|Wed 28 Oct|Fri 23 Oct/.test(av) : /Nothing has happened/.test(av)), 'Activity page lists rows by day');
const actM = U.renderPath('#/activity/manesar');
ok(!/DigitalPaani: /.test(vis(actM)) && /class="filter on" href="#\/activity\/manesar"/.test(actM), 'Activity filter by plant');
const pa = U.renderPath('#/p/vedanta/activity');
ok(/Vedanta ETP/.test(vis(pa)) && /Activity/.test(vis(pa)), 'plant activity renders inside a plant frame');
const kinds = (actM.match(/href="#\/activity\/manesar\?kind=([a-z]+)"/g) || []);
if (kinds.length) { const k = kinds[0].match(/kind=([a-z]+)/)[1]; ok(/class="filter on"/.test(U.renderPath('#/activity/manesar?kind=' + k)), 'Activity kind filter'); }

/* story */
const ch = U.chapters();
eq(ch.length, 12, 'story has 12 chapters');
ok(ch.every((c) => c.title && c.text.length >= 2 && c.href && c.href.startsWith('#/') && c.decisions.length), 'every chapter has text, a link and decisions');
const decIds = [].concat(...ch.map((c) => c.decisions.map((d) => d.id)));
eq([...new Set(decIds)].sort((a, b) => +a.slice(1) - +b.slice(1)).join(), Array.from({ length: 27 }, (_, i) => 'D' + (i + 1)).join(), 'story chips cover every card: the first review\'s D1–D21 and the later D22–D27, each in the chapter where it comes up');
ok(ch.every((c) => c.decisions.every((d) => typeof d.label === 'string' && d.label.trim())), 'every chip has a name, even without decisions7.js');
ok(ch.every((c) => c.decisions.every((d) => /^#\/decisions\/D\d+$/.test(d.href))), 'decision chips link to #/decisions/Dn');
const chrome = U.chromeHtml('p/vedanta');
const chromeIssues = scan(chrome);
ok(!chromeIssues.length, 'story + top bar: no banned words or IDs on screen', JSON.stringify(chromeIssues));
ok(/Story clock/.test(vis(chrome)) && /Thu 29 Oct, 09:00/.test(vis(chrome)) && /\+1 week/.test(vis(chrome)) && /Reset the story/.test(vis(chrome)), 'top bar: clock, move time on, reset');
['All Plants', 'Library', 'Differences', 'Activity', 'Decisions'].forEach((t) => ok(vis(chrome).includes(t), 'nav has ' + t));
eq(U.chapterOf('library'), 1, 'chapterOf library'); eq(U.chapterOf('p/digitalpaani/scada'), 2, 'chapterOf scada'); eq(U.chapterOf('p/digitalpaani/library'), 3, 'chapterOf library review');
eq(U.chapterOf('p/digitalpaani'), 4, 'chapterOf readiness'); eq(U.chapterOf('p/vedanta/alert/x'), 5, 'chapterOf trial alert'); eq(U.chapterOf('p/vedanta'), 7, 'chapterOf go live');
eq(U.chapterOf('p/manesar/issues'), 8, 'chapterOf live issues'); eq(U.chapterOf('p/manesar'), 9, 'chapterOf coverage'); eq(U.chapterOf('differences'), 11, 'chapterOf differences'); eq(U.chapterOf('decisions/D3'), 12, 'chapterOf decisions');
const em = V7.issues('vedanta', {}).find((i) => i.commissioning);
if (em) eq(U.chapterOf('p/vedanta/issue/' + em.id), 6, 'chapterOf the commissioning Emergency');
/* own pages: words */
for (const p of ['#/plants', '#/activity', '#/activity/manesar', '#/p/manesar/activity', '#/p/digitalpaani/activity']) { const f = scan(U.renderPath(p)); ok(!f.length, 'no banned words on ' + p, JSON.stringify(f)); }
/* advance + toast text (headless) */
const before = V7.now();
U.advance(60);
ok(V7.now() - before === 3600e3, 'advance moves the clock an hour');
ok(/^Time moved on to /.test(U._last.toast || ''), 'advance toasts what happened', U._last.toast);
/* sheet/modal/confirm headless: return values and record */
U.openSheet({ title: 'Change limits', body: '<p>x</p>' }); eq(U._last.sheet.title, 'Change limits', 'openSheet records its options headless');
U.toast('Saved.'); eq(U._last.toast, 'Saved.', 'toast text');
ok(typeof U.on === 'function' && typeof U._handlers['ui:advance'] === 'function', 'built-in handlers registered');

/* the version badge in the top bar */
ok(/<a class="tb-ver" href="\.\.\/index\.html"[^>]*><b>v7\/1<\/b><span> · Recommended approach<\/span><\/a>/.test(U.chromeHtml('plants')) && vis(U.chromeHtml('plants')).includes('v7/1 · Recommended approach'), 'top bar: badge "v7/1 · Recommended approach" links to the v7 overview');
global.V7_VARIANT = '2'; ok(vis(U.chromeHtml('plants')).includes('v7/2 · Alex\'s model'), 'top bar: the badge follows V7_VARIANT'); delete global.V7_VARIANT;

/* the decisions strip: ui7 puts V7DEC.markerHtml(V7_VARIANT, path) under the page header of every routed page */
ok(!global.V7DEC && !/dec-mark/.test(U.renderPath('#/p/manesar/activity')), 'no V7DEC: no strip, the page renders as before');
const seenMarks = [];
global.V7DEC = { markerHtml: (v, p) => { seenMarks.push([v, p]); return p === 'p/manesar/activity' ? '<aside class="dec-mark" aria-label="Decisions on this screen">STRIP</aside>' : ''; } };
const pmk = U.renderPath('#/p/manesar/activity?kind=config');
const iStrip = pmk.indexOf('<aside class="dec-mark"'); const iHead = pmk.indexOf('</header>'); const iTabs = pmk.indexOf('<nav class="tabs"');
ok(iHead > 0 && iStrip > iHead && iTabs > iStrip && pmk.indexOf('<div class="pg') < iStrip, 'strip: inside .pg, right after the page header, before the tabs', `${iHead} ${iStrip} ${iTabs}`);
eq((pmk.match(/dec-mark/g) || []).length, 1, 'strip: once');
ok(seenMarks.some(([v, p]) => v === '1' && p === 'p/manesar/activity'), 'markerHtml gets variant 1 by default and the path without "#/" or the query', JSON.stringify(seenMarks));
ok(!/dec-mark/.test(U.renderPath('#/p/vedanta/activity')) && !/dec-mark/.test(U.renderPath('#/plants')) && !/dec-mark/.test(U.renderPath('#/activity')), 'strip: only where markerHtml gives one');
global.V7_VARIANT = '2'; seenMarks.length = 0; U.renderPath('#/p/manesar/activity'); ok(seenMarks.length && seenMarks.every(([v]) => v === '2'), 'markerHtml gets V7_VARIANT'); delete global.V7_VARIANT;
ok(U.match('#/p/manesar/activity').route.raw === U._pages.plantActivityPage, 'route().raw keeps the module\'s own renderFn');
global.V7DEC = { markerHtml: () => { throw new Error('boom'); } };
const pthrow = U.renderPath('#/p/manesar/activity');
ok(/Activity/.test(vis(pthrow)) && !/dec-mark/.test(pthrow) && !/could not be shown/.test(pthrow), 'a throwing markerHtml: the page renders, without a strip');
global.V7DEC = { markerHtml: () => ({ html: 'x' }) }; ok(!/dec-mark|object Object/.test(U.renderPath('#/p/manesar/activity')), 'a markerHtml that returns no string: no strip');
global.V7DEC = { markerHtml: () => '<aside class="dec-mark">S</aside>' };
U.route('t/bare', () => '<div class="pg pg-x"><p>bare</p></div>');
eq(U.renderPath('#/t/bare'), '<div class="pg pg-x"><aside class="dec-mark">S</aside><p>bare</p></div>', 'a page without a header: the strip goes first inside .pg');
delete global.V7DEC;
/* with the real decisions7.js and temporary fixture fields on one card */
vm.runInThisContext(fs.readFileSync(path.join(ASSETS, 'decisions7.js'), 'utf8'), { filename: 'decisions7.js' });
const fxCard = global.V7DEC.byId('D15');
const liveMarks = (global.V7_DECISIONS || []).map((d) => [d, 'where' in d, d.where, 'short' in d, d.short]);   // put back after
ok(!!fxCard, 'the D15 card exists (the fixture below is temporary)');
if (fxCard) {
  liveMarks.forEach(([d]) => { delete d.where; });                     // the live cards' own patterns sit out the fixture
  Object.assign(fxCard, { short: 'Freeze while an issue is open', where: { 1: ['p/:plant/activity'], 2: ['p/manesar/activity'] } });
  try {
    const real = U.renderPath('#/p/manesar/activity'); const rv = vis(real);
    ok(/Decisions on this screen/.test(rv) && rv.includes('D15 · Freeze while an issue is open · No call yet') && real.includes('<a href="#/decisions/D15" aria-label="Open card D15">Open the card</a>'), 'with decisions7.js: the strip names the card and links it', rv.slice(0, 200));
    const chips = U.chapters().map((c) => c.decisions).reduce((a, b) => a.concat(b), []);
    ok(chips.every((x) => x.label === global.V7DEC.shortOf(global.V7DEC.byId(x.id))), 'with decisions7.js: a story chip names its card as the strip does (the card\'s short name)', chips.filter((x) => x.label !== global.V7DEC.shortOf(global.V7DEC.byId(x.id))).map((x) => x.id + ' ' + x.label).join(', '));
    ok(real.indexOf('<aside class="dec-mark"') > real.indexOf('</header>') && real.indexOf('<aside class="dec-mark"') < real.indexOf('<nav class="tabs"'), 'with decisions7.js: placed under the header');
    ok(/dec-mark/.test(U.renderPath('#/p/vedanta/activity')) && !/dec-mark/.test(U.renderPath('#/plants')) && !/dec-mark/.test(U.renderPath('#/decisions/D15')), 'with decisions7.js: on matching screens only, never on a Decisions page');
    ok(scan(real).every((f) => f.kind !== 'id'), 'the strip\'s card ids are not counted as the page\'s own words');
    fxCard.where = { 2: ['p/manesar/activity'] };
    ok(!/dec-mark/.test(U.renderPath('#/p/manesar/activity')), 'v7/1 reads only the card\'s v7/1 patterns');
  } finally { liveMarks.forEach(([d, hw, w, hs, s]) => { if (hw) d.where = w; else delete d.where; if (hs) d.short = s; else delete d.short; }); }
}

console.log(`ui7.test · core: ${realCore ? 'core7.js' : 'stub'} · ${n - bad.length}/${n} passed`);
if (bad.length) { console.log(bad.map((b) => '  FAIL ' + b).join('\n')); process.exit(1); }
process.exit(0);
