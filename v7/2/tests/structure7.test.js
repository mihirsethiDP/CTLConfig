#!/usr/bin/env node
/* v7/2 · tests/structure7.test.js — the Structure page (list and drawing), the structure pass, the control-group page and the
   structure modals, rendered headless and driven through their registered handlers (the clicks a presenter makes).
   Every number the pages show is compared with the core function that computes it; nothing here types a story number.
   Covers V72-19 (the drawing renders inside its own scrolling frame) and V72-22 (the unclassified card first, its bulk bar,
   participants outlined dashed while proposed and solid once confirmed), plus chapter 2's beats, a Live placement, Undo and
   the components the object, list and work pages use. Node only, no dependencies.
   Usage: TZ=Asia/Calcutta node tests/structure7.test.js [-v]     Exit code 0 = pass. */
'use strict';
const VERBOSE = process.argv.includes('-v');
const results = []; let fails = 0;
function check(group, name, ok, detail) { results.push({ group, name, ok: !!ok, detail: detail == null ? undefined : String(detail).slice(0, 600) }); if (!ok) fails++; }
function report() {
  const groups = [...new Set(results.map((r) => r.group))];
  console.log(`structure7 · ${results.length} checks`);
  groups.forEach((g) => {
    const rs = results.filter((r) => r.group === g); const bad = rs.filter((r) => !r.ok);
    console.log(`  ${bad.length ? 'FAIL' : 'ok  '} ${g} (${rs.length - bad.length}/${rs.length})`);
    rs.forEach((r) => { if (!r.ok || VERBOSE) console.log(`       ${r.ok ? '✓' : '✗'} ${r.name}${!r.ok && r.detail ? `\n           ${r.detail}` : ''}`); });
  });
  console.log(fails ? `RESULT: FAIL · ${fails} failing` : 'RESULT: PASS');
  process.exit(fails ? 1 : 0);
}

const L = require('./load72.js'); const V = L.V7; const U = L.V7UI; const VST = L.window.V7STRUCT;
check('load', 'structure7.js loads after the core and the UI kit, and the story boots', !!V && !!U && !!VST && L.loaded.includes('structure7.js') && !L.errors.some((e) => e.file === 'structure7.js' || e.file === 'boot'), L.errors.map((e) => `${e.file}: ${e.error.slice(0, 160)}`).join(' | '));
if (!V || !U || !VST) report();

/* ── helpers ─────────────────────────────────────────────────────────────────────────────────────────── */
const DP = 'digitalpaani', VED = 'vedanta', MAN = 'manesar', BAW = 'bawal';
const KEYS = [DP, VED, MAN, BAW];
const J = (x) => JSON.stringify(x);
const nodeId = (k, tag) => { const n = V.nodes(k).find((e) => e.tag === tag); if (!n) throw new Error(`no ${tag} at ${k}`); return n.id; };
const ids = (k, ...tags) => tags.map((t) => nodeId(k, t));
const decode = (s) => String(s).replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const STRIP = /<aside class="dec-mark"[\s\S]*?<\/aside>/g;            /* the decisions strip is a study note, not the page's words */
const text = (html) => decode(String(html || '').replace(STRIP, ' ').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').replace(/ ([,.;:])(?=\s|$)/g, '$1').trim();
const render = (h) => L.render(h) || '';
const lastToast = () => (U._last && U._last.toast) || '';
const md = () => VST._md();
const mdHtml = () => VST._mdHtml() || { title: '', body: '', foot: '' };
function fake(data, extra) {
  return Object.assign({ getAttribute: (k) => { const m = /^data-(.+)$/.exec(k); if (!m) return null; const v = data[m[1]]; return v == null ? null : String(v); }, closest: () => null }, extra || {});
}
function act(name, data, extra, ev) { const fn = U._handlers[name]; if (!fn) throw new Error(`no handler for ${name}`); return fn(fake(data || {}, extra), ev || {}); }
const count = (html, re) => (String(html).match(re) || []).length;
const nodeClass = (html, id) => { const m = new RegExp(`<g class="([^"]*)" data-act="st:node" data-plant="[^"]*" data-id="${id}"`).exec(html); return m ? m[1] : ''; };
const unclassifiedN = (k) => V.structurePass(k).counts.unclassified;
/* Alex's don't-use words, the v7/1 words that must not survive, IDs and junk (the v7/2 banned list), checked on visible text */
const BANNED = [
  ['machine', /\bmachines?\b/i],
  ['asset', /\bassets?\b/i],
  ['widget', /\bwidgets?\b/i],
  ['estate', /\bestates?\b/i],
  ['portfolio', /\bportfolio\b/i],
  ['custom', /\bcustom\b/i],
  ['detach', /\bdetach(ed)?\b/i],
  ['fork', /\bfork(ed|s)?\b/i],
  ['diverge', /\bdiverg(e|ed|es|ing|ence)\b/i],
  ['stale', /\bstale\b/i],
  ['drift', /\bdrift\b/i],
  ['alert', /\balerts?\b/i],
  ['alerting', /\balerting\b/i],
  ['alarm', /(?<!false )\balarms?\b/i],
  ['insight', /\binsights?\b/i],
  ['schedule', /\bschedules?\b/i],
  ['SCADA', /\bSCADA\b/i],
  ['database', /\bdatabase\b/i],
  ['the form', /\bSCADA form\b|\bthe form\b/i],
  ['hold time', /\bhold time\b/i],
  ['debounce', /\bdebounce\b/i],
  ['observation frequency', /\bobservation frequency\b/i],
  ['procedure', /\bprocedures?\b/i],
  ['workflow', /\bworkflows?\b/i],
  ['SOP', /\bSOPs?\b/i],
  ['remediation', /\bremediation\b/i],
  ['Site Admin', /\bSite Admin\b/i],
  ['SME', /\bSME\b/i],
  ['Supervisor', /\bSupervisor\b/i],
  ['onboarding', /\bonboarding\b/i],
  ['shadow', /\bshadow\b/i],
  ['test alert', /\btest alert\b/i],
  ['dry run', /\bdry run\b/i],
  ['detect', /\bdetect\b/i],
  ['priority', /\bpriority\b/i],
  ['bare tier', /(?<!criticality )\btier\b/i],
  ['Critical words', /\bCritical\b|\bEssential\b|\bStandard\b/],
  ['bare rule', /(?<!limit |no )\brules?\b/i],
  ['survey type', /\bsurvey type\b/i],
  ['unit operation', /\bunit operations?\b/i],
  ['process stage', /\b(functional|process) stages?\b/i],
  ['sub-asset', /\bsub-assets?\b/i],
  ['v7/1 word', /Changed here|Library changed since|Differences from the library|From the library|From the SCADA form|No limits yet|What SCADA found|What the library brings|Where it lands|Not for this plant|On trial|Mostly short|Tuned for this plant|For now, until|Reason not recorded|Not in the library|Back to the library value|Suggest for the library|Who is told|User Center|Phone view|Review due|no call, no hooter|told to the Leads/i],
  ['must hold for', /(?<!Persistence · )must hold for/i],
  ['must clear for', /(?<!Clearing · )must clear for/i],
  ['an ID', /\b(CM|C|O)-\d{1,2}\b|(?<![-\w])E[1-5]\b|(?<![-\w])W\d{1,2}[a-d]?\b|(?<![-\w])P[1-6]\b|(?<![-\w])S[1-8]\b|\bV7-\d+\b|\bV72-\d+\b|\bPRD\b|§\s*\d|\bAC-?\d+\b|Amity|Noida|\.md\b|\.html\b|dp_intel|(?<![-\w])D\d{1,2}\b/],
  ['junk', /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\$\{/],
];
const wordsOf = (t) => BANNED.filter(([, re]) => re.test(t)).map(([w, re]) => `${w}: …${t.slice(Math.max(0, t.search(re) - 40), t.search(re) + 30)}…`);
/* data text (survey names and types, identification's reasons) is the plant graph's, not the page's: the checks read the page's own words */
const dataTexts = (() => { const out = new Set(); KEYS.forEach((k) => { V.nodes(k).forEach((n) => { [n.name, n.typeName, n.tag].forEach((x) => x && out.add(String(x))); }); }); return [...out].sort((a, b) => b.length - a.length); })();
const pageWords = (html) => { let t = text(html); dataTexts.forEach((d) => { if (d.length > 3) t = t.split(d).join(' '); }); return t; };

V.reset(); VST._reset();

/* ══════════ 1. routes and actions are registered once, by this module ══════════ */
{
  const pats = U.routes().map((r) => r.pattern);
  const mine = ['p/:plant/structure/:view?', 'p/:plant/review/structure', 'p/:plant/cg/:id', 'p/:plant/equipment', 'p/:plant/scada', 'p/:plant/review'];
  check('wiring', 'the six structure routes are registered, each once', mine.every((p) => pats.filter((x) => x === p).length === 1), mine.filter((p) => pats.filter((x) => x === p).length !== 1).join(', '));
  const acts = ['st:accept', 'st:accept-up', 'st:accept-cgs', 'st:accept-all', 'st:reject', 'st:type', 'st:place', 'st:notpart', 'st:tick', 'st:bulk-place', 'st:bulk-notpart', 'st:rerun', 'st:undo', 'st:stage', 'st:node', 'st:zoom', 'st:remove', 'st:putback', 'st:pend-save', 'st:add-eq', 'st:cg-make', 'st:cg-add', 'st:cg-remove', 'st:note', 'st:dlg-up', 'st:dlg-eq', 'st:dlg-type', 'st:dlg-save'];
  check('wiring', 'every st: action used on the pages has a handler', acts.every((a) => typeof U._handlers[a] === 'function'), acts.filter((a) => typeof U._handlers[a] !== 'function').join(', '));
  const used = new Set();
  [`#/p/${DP}/structure`, `#/p/${DP}/structure/drawing`, `#/p/${DP}/review/structure`, `#/p/${VED}/cg/cg_bl-1`, `#/p/${MAN}/structure`].forEach((h) => { (render(h).match(/data-act="st:[a-z-]+"/g) || []).forEach((m) => used.add(m.slice(10, -1))); });
  check('wiring', 'every st: action the pages carry is handled', [...used].every((a) => typeof U._handlers[a] === 'function'), [...used].filter((a) => typeof U._handlers[a] !== 'function').join(', '));
}

/* ══════════ 2. the drawing at the start (V72-19, V72-22) ══════════ */
const MBBR1 = nodeId(DP, 'MBBR-1');
{
  const dr = V.drawing(DP);
  const html = render(`#/p/${DP}/structure/drawing`);
  const svg = (/<svg class="st-svg[^>]*>/.exec(html) || [''])[0];
  check('drawing', 'V72-19 · the drawing draws every node of drawing() (66 here, 21 of them unit processes) and every pipe', count(html, /<g class="st-n /g) === dr.nodes.length && count(html, /<g class="st-n st-n-up/g) === dr.nodes.filter((n) => n.kind === 'up').length && count(html, /<line class="st-pipe/g) === dr.links.length && dr.nodes.length === 66, `${count(html, /<g class="st-n /g)} nodes · ${count(html, /<g class="st-n st-n-up/g)} unit processes · ${count(html, /<line class="st-pipe/g)} pipes`);
  check('drawing', 'V72-19 · viewBox "-330 -814 7922 2125" at zoom 0.25, inside its own scrolling frame', svg.includes(`viewBox="${dr.viewBox.join(' ')}"`) && dr.viewBox.join(' ') === '-330 -814 7922 2125' && svg.includes(`width="${Math.round(dr.viewBox[2] * dr.zoom)}"`) && /<div class="st-frame"[^>]*>\s*<svg class="st-svg/.test(html), svg.slice(0, 160));
  check('drawing', 'the toolbar has "Fit · − · +" and the Drawing · List toggle', /data-act="st:zoom"[^>]*data-z="fit"/.test(html) && />−</.test(html) && />\+</.test(html) && />Drawing</.test(html) && />List</.test(html));
  check('drawing', 'unclassified equipment is outlined while nothing is selected', nodeClass(html, nodeId(DP, 'RFP-1')).includes('is-unclassified'), nodeClass(html, nodeId(DP, 'RFP-1')));
  const sel = render(`#/p/${DP}/structure/drawing?select=up:${MBBR1}`);
  const ab = nodeClass(sel, nodeId(DP, 'MBBRAB-1'));
  check('drawing', 'V72-22 · selecting MBBR-1 outlines its participants dashed while proposed, tags the shared ones and dims the rest', nodeClass(sel, MBBR1).includes('is-sel') && ab.includes('is-p-proposed') && ab.includes('is-shared') && nodeClass(sel, nodeId(DP, 'SRCP-1')).includes('is-p-proposed') && nodeClass(sel, nodeId(DP, 'ESAB-1')).includes('is-dim') && nodeClass(sel, nodeId(DP, 'TS-1')).includes('is-dim'), `${ab} · ${nodeClass(sel, nodeId(DP, 'ESAB-1'))}`);
  const u = V.unitProcess(DP, MBBR1);
  const t = text(sel);
  check('drawing', 'the side panel names MBBR-1 and lists its participants by role', t.includes(`MBBR-1 · ${u.typeName}`) && u.participants.every((p) => t.includes(p.tag)) && t.includes('Blowers:') && t.includes('Recirculation:'));
  const narrow = L.window.innerWidth; L.window.innerWidth = 400;
  const ph = render(`#/p/${DP}/structure/drawing?select=up:${MBBR1}`);
  L.window.innerWidth = narrow;
  check('drawing', 'at phone width the drawing route opens the list view', !/<svg class="st-svg/.test(ph) && text(ph).includes('The drawing needs a wider screen') && text(ph).includes('Unclassified · no rule placed these'));
  const before = render(`#/p/${DP}/structure/drawing`);
  act('st:zoom', { plant: DP, z: 'in' });
  const zin = render(`#/p/${DP}/structure/drawing`);
  act('st:zoom', { plant: DP, z: 'fit' });
  const zfit = render(`#/p/${DP}/structure/drawing`);
  VST._reset();
  check('drawing', 'zoom in makes the drawing larger; Fit makes it fill the frame', (/width="(\d+)"/.exec(zin) || [])[1] > (/width="(\d+)"/.exec(before.slice(before.indexOf('st-svg'))) || [])[1] && /class="st-svg is-fit"/.test(zfit));
  const stg = render(`#/p/${DP}/structure/drawing?stage=sludge`);
  const slp = nodeId(DP, 'SLP');
  check('drawing', 'a chosen stage keeps that stage lit and dims the rest', !nodeClass(stg, slp).includes('is-dim') && nodeClass(stg, MBBR1).includes('is-dim'));
}

/* ══════════ 3. the Structure list at DigitalPaani (V72-22) ══════════ */
{
  const html = render(`#/p/${DP}/structure`);
  const t = text(html); const s = V.structure(DP);
  const iU = t.indexOf(`Unclassified · no rule placed these (${s.counts.unclassified})`); const iS = t.indexOf(V.structure(DP).stages[0].label + ' ');
  check('list', 'V72-22 · the Structure list shows the unclassified card first, with its count from structure()', iU > 0 && (iS < 0 || iU < t.indexOf(`${V.unitProcesses(DP)[0].tag} · `)) && s.counts.unclassified === 20, `${iU} · ${iS}`);
  check('list', 'V72-22 · each unclassified row has Place in… and Not part of any unit process, plus a tick box', count(html, /data-act="st:place"/g) >= s.counts.unclassified && count(html, /data-act="st:notpart"/g) >= s.counts.unclassified && count(html, /data-act="st:tick"/g) === s.counts.unclassified);
  const first = V.structurePass(DP).unclassified.slice(0, 3).map((x) => x.tag);
  check('list', 'unclassified rows follow the plant graph (RFP-1, RFP-2, FFP-1 first), each with identification\'s reason', t.indexOf(first[0]) < t.indexOf(first[1]) && t.indexOf(first[1]) < t.indexOf(first[2]) && t.includes('Fed by EQTT-1, EQTT-2; feeds MBBR-1, MBBR-4. No rule matches.'), first.join(', '));
  act('st:tick', { plant: DP, eq: nodeId(DP, 'ITP-1') }, { checked: true }); act('st:tick', { plant: DP, eq: nodeId(DP, 'ITP-2') }, { checked: true });
  const bulk = render(`#/p/${DP}/structure`);
  check('list', 'V72-22 · ticking rows shows the bulk bar: "2 selected · Place in… · Not part of any unit process"', /<div class="st-bulk"/.test(bulk) && text(bulk).includes('2 selected Place in… Not part of any unit process') && /data-act="st:bulk-place"/.test(bulk) && /data-act="st:bulk-notpart"/.test(bulk));
  act('st:tick-none', { plant: DP });
  check('list', 'Clear empties the selection', !/<div class="st-bulk"/.test(render(`#/p/${DP}/structure`)));
  const stages = s.stages.map((x) => x.label);
  check('list', 'one section per stage, in the order structure() gives', stages.every((l, i) => i === 0 || t.indexOf(`${stages[i - 1]} `) < t.indexOf(`${l} `)), stages.join(' · '));
  const sc = V.unitProcess(DP, nodeId(DP, 'SC'));
  check('list', 'a unit-process row reads "{tag} · {type}" with its state, criticality tier and readings', t.includes(`${sc.tag} · ${sc.typeName} ${sc.typeStateLabel} Criticality tier ${sc.tier}`) && t.includes('Readings: Level') && t.includes('No sensors'));
  const fc = { shared: s.counts.sharedEquipment, unclassified: s.counts.unclassified };
  check('list', 'the filter chips count from structure(): Shared {n} · Unclassified {n} · Changed underneath {n} · Proposed {n}', t.includes(`Shared ${fc.shared}`) && t.includes(`Unclassified ${fc.unclassified}`) && t.includes(`Changed underneath ${V.structureChanges({ plant: DP }).filter((x) => x.underneath).length}`) && t.includes(`Proposed ${s.counts.proposed}`));
  check('list', 'the control groups and the foot line', t.includes(`Control groups (${V.controlGroups(DP).length})`) && t.includes('UF Backwash Pumps') && t.includes('Missing a basin? Correct the survey, then re-run identification.'));
  const sh = text(render(`#/p/${DP}/structure?show=shared`));
  check('list', '?show=shared keeps only shared participants (MBBRAB-1 stays, the unclassified card goes)', sh.includes('MBBRAB-1') && !sh.includes('Unclassified · no rule placed these'));
  const st2 = text(render(`#/p/${DP}/structure?stage=secondary`));
  check('list', '?stage=secondary lists the secondary unit processes only', st2.includes('MBBR-1 · ') && !st2.includes('SC · Collection sump') && !st2.includes('UF-1 · '));
  act('st:rerun', { plant: DP });
  check('list', 'Re-run identification: "Identification re-run: nothing changed in the plant graph. Your … decisions and … edits are kept."', /^Identification re-run: nothing changed in the plant graph\. Your \d+ decisions? and \d+ edits? are kept\.$/.test(lastToast()), lastToast());
  V.reset(); VST._reset();
}

/* ══════════ 4. the structure pass at DigitalPaani: chapter 2 through the handlers ══════════ */
const SC = nodeId(DP, 'SC');
{
  const sp = V.structurePass(DP); const c = sp.counts;
  const html = render(`#/p/${DP}/review/structure`); const t = text(html);
  check('pass', 'the pass tabs: "Structure pass · {to review}" and "Bindings pass · waiting" (disabled)', t.includes(`Structure pass · ${c.toReview}`) && t.includes('Bindings pass · waiting') && /st-tab-off[^>]*aria-disabled="true"/.test(html) && c.toReview === 76);
  check('pass', 'chips "All 76 · Unclassified 20 · Shared 15 · Control groups 11" from structurePass()', t.includes(`All ${c.all} Unclassified ${c.unclassified} Shared ${c.shared} Control groups ${c.cgs}`) && c.all === 76 && c.unclassified === 20 && c.shared === 15 && c.cgs === 11);
  check('pass', 'the primary button "Accept all {n} that are proposed" and "Open on drawing"', t.includes(`Accept all ${c.proposed} that are proposed`) && t.includes('Open on drawing') && t.includes('Re-run identification'));
  const g = sp.groups.find((x) => x.upId);
  check('pass', 'the first unit-process group "SC · Collection sump (Proposed)" with its reason and Change type', t.includes(`${g.title} Proposed Stage: ${g.stageLabel} ${g.why}`) && g.title === 'SC · Collection sump' && new RegExp(`data-act="st:type"[^>]*data-up="${SC}"`).test(html), g.title);
  check('pass', 'the intro and the foot', t.includes('The survey wrote the plant graph and identification proposed this structure.') && t.includes('Sensors move with the plant graph: correct the survey, then re-run identification.'));
  const un = text(render(`#/p/${DP}/review/structure?show=unclassified`));
  check('pass', '?show=unclassified lists only the unclassified', un.includes('Unclassified · no rule placed these') && !un.includes('SC · Collection sump'));

  /* Reject a proposal, then Undo (the walk goes on from the seed) */
  const cgRow = sp.groups.find((x) => x.key === 'cgs').rows.find((r) => /^UF Backwash Pumps/.test(r.title));
  act('st:reject', { plant: DP, row: cgRow.rowId });
  check('pass', 'Reject opens a modal with the consequence before saving', md() && md().kind === 'reject' && text(mdHtml().body).includes('If you save') && text(mdHtml().body).includes(cgRow.title));
  act('st:dlg-save');
  const rej = VST._state().last;
  check('pass', 'Reject saves with a toast and Undo', /rejected$/.test(lastToast()) && !!rej && V.structurePass(DP).counts.proposed === c.proposed - 1, lastToast());
  act('st:undo', { plant: DP, token: rej.token });
  check('pass', 'Undo brings the proposal back', /^Undone: /.test(lastToast()) && V.structurePass(DP).counts.proposed === c.proposed, lastToast());

  /* Change type: SC → Screening */
  act('st:type', { plant: DP, up: SC });
  const m0 = mdHtml(); const u = V.unitProcess(DP, SC);
  check('pass', 'Change type opens "Change the type of SC" with the drawn-versus-stored fact', md() && md().kind === 'type' && m0.title === 'Change the type of SC' && text(m0.body).includes(u.drawnFact) && u.drawnFact === 'Drawn in the plant graph as Screen Chamber Tank; stored in the survey as Open Skeleton Tank.', m0.title);
  check('pass', 'the type list marks the proposed one; nothing is saved before a pick', text(m0.body).includes('Collection sump (proposed)') && /disabled/.test(m0.foot) && text(m0.body).includes('Pick a type to see what it brings.'));
  act('st:dlg-type', { type: 'screening' }, { value: 'screening' });
  const m1 = mdHtml(); const pv = V.membershipPreview(DP, [{ op: 'type', upId: SC, typeId: 'screening' }]);
  check('pass', 'picking Screening shows the consequence lines from membershipPreview, before saving', pv.lines.length >= 3 && pv.lines.every((l) => text(m1.body).includes(l)) && text(m1.foot).includes('Change to Screening') && !/disabled/.test(m1.foot), pv.lines.join(' | '));
  check('pass', '…which read "Screening brings 14 Task templates and 6 Issue types; …" and "About … more Tasks a day once Live."', /^Screening brings \d+ Task templates and \d+ Issue types; 1 Trigger template needs a sensor SC doesn't have \(H2S\)\.$/.test(pv.lines[0]) && /^About [\d.]+ more Tasks a day once Live\.$/.test(pv.lines[2]), pv.lines[0]);
  act('st:dlg-save');
  check('pass', 'Change to Screening: toast "SC is now Screening" with Undo; the type is Screening', lastToast() === 'SC is now Screening' && V.unitProcess(DP, SC).typeName === 'Screening' && !!VST._state().last, lastToast());
  const c2 = V.structurePass(DP).counts;
  const t2 = text(render(`#/p/${DP}/review/structure`));
  check('pass', 'the primary button now counts one fewer: "Accept all {n} that are proposed"', t2.includes(`Accept all ${c2.proposed} that are proposed`) && c2.proposed === c.proposed - 1, c2.proposed);

  /* Accept all */
  act('st:accept-all', { plant: DP });
  const c3 = V.structurePass(DP).counts;
  check('pass', '"Accepted {n}" with Undo; only the unclassified are left', lastToast() === `Accepted ${c2.proposed}` && c3.proposed === 0 && c3.toReview === c3.unclassified && c3.unclassified === 20, lastToast());
  const t3 = text(render(`#/p/${DP}/review/structure`));
  check('pass', 'the UF Backwash Pumps control group (both UF trains) now reads Confirmed', /UF Backwash Pumps · UFBP-1, UFBP-2, UFBP-3, UFBP-4 Confirmed/.test(t3) && t3.includes('Accept all that are proposed'));
  const sel = render(`#/p/${DP}/structure/drawing?select=up:${MBBR1}`);
  check('pass', 'V72-22 · on the drawing, MBBR-1\'s participants are now outlined solid (Confirmed)', nodeClass(sel, nodeId(DP, 'MBBRAB-1')).includes('is-p-confirmed') && !nodeClass(sel, nodeId(DP, 'MBBRAB-1')).includes('is-p-proposed'));

  /* not part, in bulk */
  ids(DP, 'ITP-1', 'ITP-2', 'FWTP-1', 'FWTP-2').forEach((id) => act('st:tick', { plant: DP, eq: id }, { checked: true }));
  act('st:bulk-notpart', { plant: DP });
  check('pass', 'ITP-1, ITP-2, FWTP-1, FWTP-2 → Not part of any unit process: 16 left', unclassifiedN(DP) === 16 && /marked not part of any unit process$/.test(lastToast()) && VST._state().tick[DP].size === 0, `${unclassifiedN(DP)} · ${lastToast()}`);
  check('pass', 'the Structure list counts 16 in the unclassified card and lists the four under "Outside any unit process"', text(render(`#/p/${DP}/structure`)).includes('Unclassified · no rule placed these (16)') && text(render(`#/p/${DP}/structure`)).includes('Outside any unit process (4)'));

  /* Place in…, in bulk */
  const uf = ids(DP, 'UFFP-1', 'UFFP-2', 'UFBV-1'); const UF1 = nodeId(DP, 'UF-1');
  uf.forEach((id) => act('st:tick', { plant: DP, eq: id }, { checked: true }));
  act('st:bulk-place', { plant: DP });
  const p0 = mdHtml();
  check('pass', 'Place in… opens "Place UFFP-1, UFFP-2 and UFBV-1 in a unit process" with "Next to it" and "All unit processes"', p0.title === 'Place UFFP-1, UFFP-2 and UFBV-1 in a unit process' && text(p0.body).includes('Next to it') && text(p0.body).includes('All unit processes') && /disabled/.test(p0.foot), p0.title);
  const nearPart = p0.body.slice(0, p0.body.indexOf('All unit processes'));
  check('pass', '"Next to it" offers UF-1 (on the same pipes, through valves and one pump)', nearPart.includes(`data-up="${UF1}"`));
  act('st:dlg-up', { up: UF1 }, { checked: true });
  const p1 = mdHtml(); const ppv = V.membershipPreview(DP, uf.map((e) => ({ op: 'add', upId: UF1, eqId: e })));
  check('pass', 'the preview "Criticality tier for UFFP-1: B → A · … UFFP-2: B → A · … UFBV-1: C → A" comes from membershipPreview', ppv.lines.every((l) => text(p1.body).includes(l)) && ['UFFP-1', 'UFFP-2', 'UFBV-1'].every((tg) => ppv.lines.some((l) => l.startsWith(`Criticality tier for ${tg}: `))) && text(p1.foot).includes('Place in UF-1'), ppv.lines.join(' | '));
  act('st:dlg-save');
  const placed = VST._state().last;
  check('pass', '"UFFP-1, UFFP-2 and UFBV-1 placed in UF-1" with Undo: 13 left; UFFP-1 is criticality tier A, Derived', lastToast() === 'UFFP-1, UFFP-2 and UFBV-1 placed in UF-1' && unclassifiedN(DP) === 13 && V.tierInfo(DP, uf[0]).value === 'A' && V.tierInfo(DP, uf[0]).chip.tone === 'der', lastToast());
  act('st:undo', { plant: DP, token: placed.token });
  check('pass', 'Undo puts the three back: 16 unclassified', unclassifiedN(DP) === 16 && /^Undone: /.test(lastToast()), lastToast());
  check('pass', 'an action already undone offers no second Undo', !V.canUndo(DP, placed.token));
  act('st:place', { plant: DP, eq: uf[0] }); act('st:dlg-up', { up: UF1 }, { checked: true }); act('st:dlg-save');
  act('st:place', { plant: DP, eq: uf[1] }); act('st:dlg-up', { up: UF1 }, { checked: true }); act('st:dlg-save');
  act('st:place', { plant: DP, eq: uf[2] }); act('st:dlg-up', { up: UF1 }, { checked: true }); act('st:dlg-save');
  check('pass', 'placed again one by one from the row buttons: 13 left', unclassifiedN(DP) === 13);

  /* finish the pass */
  const placeAll = (tags, upTags) => { const e = ids(DP, ...tags); e.forEach((id) => act('st:tick', { plant: DP, eq: id }, { checked: true })); act('st:bulk-place', { plant: DP }); ids(DP, ...upTags).forEach((u2) => act('st:dlg-up', { up: u2 }, { checked: true })); act('st:dlg-save'); };
  placeAll(['UFFP-3', 'UFFP-4', 'UFBV-2'], ['UF-2']);
  placeAll(['RFP-1', 'RFP-2'], ['MBBR-1', 'MBBR-4']);
  placeAll(['FFP-1', 'FFP-2'], ['MGF']);
  placeAll(['SPFP-1', 'SPFP-2'], ['SLP']);
  check('pass', 'four more placements: 4 left', unclassifiedN(DP) === 4, unclassifiedN(DP));
  ids(DP, 'PDT', 'PDP', 'SCP-1', 'SCP-2').forEach((id) => act('st:tick', { plant: DP, eq: id }, { checked: true }));
  act('st:bulk-notpart', { plant: DP });
  check('pass', 'the last decision: "Structure confirmed: 21 unit processes, 11 control groups. The bindings pass is open"', lastToast() === 'Structure confirmed: 21 unit processes, 11 control groups. The bindings pass is open' && V.structureDone(DP), lastToast());
  const done = render(`#/p/${DP}/review/structure`); const td = text(done);
  const bp = typeof V.bindingsPass === 'function' ? V.bindingsPass(DP) : null;
  check('pass', 'the tabs read "Structure pass ✓" and "Bindings pass · {all}", linked to the bindings pass', td.includes('Structure pass ✓') && (!bp || td.includes(`Bindings pass · ${bp.counts.all}`)) && done.includes(`href="#/p/${DP}/review/bindings"`));
  check('pass', 'the banner "✓ Structure confirmed Thu 29 Oct, 09:00 · …" from structurePass(), with Undo while it applies', td.includes(`✓ ${V.structurePass(DP).banner}`) && /^Structure confirmed Thu 29 Oct, 09:00 · /.test(V.structurePass(DP).banner) && /data-act="st:undo"/.test(done), V.structurePass(DP).banner);
  const rv = render(`#/p/${DP}/review`);
  const hasBindings = U.routes().some((r) => r.pattern === 'p/:plant/review/bindings');
  check('pass', '#/p/:plant/review opens the bindings pass once the structure pass is confirmed', hasBindings ? !text(rv).includes('The survey wrote the plant graph and identification proposed this structure') : text(rv).includes('Structure pass ✓'));
  const sel2 = render(`#/p/${DP}/structure/drawing?select=up:${MBBR1}`);
  const rf = nodeClass(sel2, nodeId(DP, 'RFP-1'));
  check('pass', 'on the drawing RFP-1 is now in MBBR-1, solid with the "Added" tag', rf.includes('is-p-added') && new RegExp(`data-id="${nodeId(DP, 'RFP-1')}"[\\s\\S]*?<text class="st-tag"[^>]*>Added`).test(sel2), rf);
}

/* ══════════ 5. membership on the drawing: TS-1 and the sludge recirculation pumps ══════════ */
{
  const TS1 = nodeId(DP, 'TS-1'); const sr = ids(DP, 'SRCP-1', 'SRCP-2');
  let html = render(`#/p/${DP}/structure/drawing?select=up:${TS1}`);
  check('drawing', 'TS-1 selected: the panel says "No participants" and links to its Tasks', text(html).includes('No participants') && html.includes(`#/p/${DP}/up/${TS1}/tasks`));
  act('st:node', { plant: DP, id: sr[0], kind: 'eq' }, null, { shiftKey: true });
  act('st:node', { plant: DP, id: sr[1], kind: 'eq' }, null, { ctrlKey: true });
  html = render(`#/p/${DP}/structure/drawing?select=up:${TS1}`);
  const pv = V.membershipPreview(DP, sr.map((e) => ({ op: 'add', upId: TS1, eqId: e })));
  check('drawing', 'Shift-click and Ctrl-click SRCP-1 and SRCP-2: "Adding: SRCP-1, SRCP-2", tagged "Adding" on the drawing', text(html).includes('Adding: SRCP-1, SRCP-2') && nodeClass(html, sr[0]).includes('is-adding'), nodeClass(html, sr[0]));
  check('drawing', 'the preview before saving: "No Trigger depends on this · criticality tiers unchanged" (from membershipPreview)', pv.text === 'No Trigger depends on this · criticality tiers unchanged' && pv.lines.every((l) => text(html).includes(l)) && text(html).includes('Changes to save: SRCP-1, SRCP-2 added to TS-1'), pv.text);
  act('st:pend-save', { plant: DP });
  check('drawing', 'Save: toast "Saved · SRCP-1, SRCP-2 added to TS-1" with Undo; TS-1 now has both', lastToast() === 'Saved · SRCP-1, SRCP-2 added to TS-1' && V.unitProcess(DP, TS1).participants.length === 2 && !!VST._state().last, lastToast());
  const sel = render(`#/p/${DP}/structure/drawing?select=eq:${sr[0]}`);
  const m = V.membershipOf(DP, sr[0]);
  check('drawing', 'selecting SRCP-1: "Takes part in MBBR-1, MBBR-2, MBBR-3, TS-1 · Control group: …"', text(sel).includes(`Takes part in ${m.participatesIn.map((x) => x.tag).join(', ')} · Control group: ${m.controlGroups.map((x) => x.name).join(', ')}`) && m.participatesIn.map((x) => x.tag).includes('TS-1'), m.participatesIn.map((x) => x.tag).join(', '));
  act('st:node', { plant: DP, id: sr[0], kind: 'eq' }, null, { shiftKey: true });
  check('drawing', 'clicking an already selected unit process\'s piece of equipment with Shift takes it out (pending remove)', VST._state().pend[DP].ops.length === 0);
  act('st:undo', { plant: DP, token: VST._state().last.token });
  check('drawing', 'Undo takes SRCP-1 and SRCP-2 out of TS-1 again', V.unitProcess(DP, TS1).participants.length === 0);
  /* a plain click selects; a second plain click on the same node clears the selection */
  render(`#/p/${DP}/structure/drawing`);
  act('st:node', { plant: DP, id: TS1, kind: 'up' }, null, {});
  check('drawing', 'a click on a unit process selects it (?select=up:…)', String(L.window.location.hash).includes(`select=up:${TS1}`), L.window.location.hash);
  render(L.window.location.hash);
  act('st:node', { plant: DP, id: TS1, kind: 'up' }, null, {});
  check('drawing', 'a second click clears the selection', !String(L.window.location.hash).includes('select='), L.window.location.hash);
  /* a control group from the drawing: select a pump no control group holds, ⌘-click its partner */
  const ffp = ids(DP, 'ITP-1', 'ITP-2');
  render(`#/p/${DP}/structure/drawing?select=eq:${ffp[0]}`);
  act('st:node', { plant: DP, id: ffp[1], kind: 'eq' }, null, { metaKey: true });
  const sel3 = render(`#/p/${DP}/structure/drawing?select=eq:${ffp[0]}`);
  check('drawing', 'with a pump selected, ⌘-click another pump: "For a control group: ITP-1, ITP-2" and Make control group', V.controlGroups(DP).every((c) => !c.memberIds.includes(ffp[0])) && text(sel3).includes('For a control group: ITP-1, ITP-2') && new RegExp(`data-act="st:cg-make"[^>]*data-eqs="${ffp.join(',')}"`).test(sel3));
  act('st:cg-make', { plant: DP, eqs: ffp.join(',') });
  check('drawing', 'Make control group opens with both picked', md() && md().kind === 'cgMake' && md().eqIds.size === 2 && !/disabled/.test(mdHtml().foot));
  act('st:dlg-save');
  const made = V.controlGroups(DP).find((c) => c.memberIds.join() === ffp.slice().sort().join() || (c.memberIds.includes(ffp[0]) && c.memberIds.includes(ffp[1])));
  check('drawing', '"Control group made: {name}" with Undo, and it is listed', /^Control group made: /.test(lastToast()) && !!made, lastToast());
  act('st:undo', { plant: DP, token: VST._state().last.token });
  check('drawing', 'Undo removes it again', !V.controlGroups(DP).some((c) => c.memberIds.includes(ffp[0])));
}

/* ══════════ 6. a Live plant: a reason first, then the flag (Manesar, BS-1 → EQ-1) ══════════ */
{
  const t = text(render(`#/p/${MAN}/structure`));
  check('live', 'Manesar\'s Structure list: "Outside any unit process (1)" with BS-1 and its note', t.includes('Outside any unit process (1)') && t.includes('BS-1') && t.includes('Sits in the inlet channel; the plant graph has no screening unit'));
  act('st:place', { plant: MAN, eq: 'bs1' });
  const m0 = mdHtml();
  check('live', 'Place in… on a Live plant asks "Reason (required on a Live plant)"; the button stays disabled', m0.title === 'Place BS-1 in a unit process' && text(m0.body).includes('Reason (required on a Live plant)') && /disabled/.test(m0.foot));
  act('st:dlg-up', { up: 'eq1' }, { checked: true });
  const m1 = mdHtml(); const pv = V.membershipPreview(MAN, [{ op: 'add', upId: 'eq1', eqId: 'bs1' }]);
  check('live', 'choosing EQ-1 shows "1 Trigger re-checked: Sump flooding · EQ-1"; still disabled without a reason', pv.lines[0] === '1 Trigger re-checked: Sump flooding · EQ-1' && text(m1.body).includes(pv.lines[0]) && /disabled/.test(m1.foot) && text(m1.foot).includes('Place in EQ-1'), pv.lines[0]);
  act('st:dlg-save');
  check('live', 'saving without a reason is refused: "Give a reason: this plant is Live." and nothing changes', !!md() && md().error === 'Give a reason: this plant is Live.' && text(mdHtml().body).includes('Give a reason: this plant is Live.') && V.membershipOf(MAN, 'bs1').placement === 'notpart', md() && md().error);
  act('st:note', { scope: 'dlg', plant: MAN }, { value: 'The screen sits in EQ-1\'s inlet channel' });
  check('live', 'with a reason the button is enabled', !/disabled/.test(mdHtml().foot));
  act('st:dlg-save');
  const f = V.structureFlag(MAN, 'a_flood');
  check('live', '"BS-1 placed in EQ-1" with Undo; Sump flooding · EQ-1 is flagged "Structure changed …"', lastToast() === 'BS-1 placed in EQ-1' && V.membershipOf(MAN, 'bs1').placement === 'placed' && !!f && /^Structure changed /.test(f.line), `${lastToast()} · ${f && f.line}`);
  /* a pending edit on a Live plant needs the reason too */
  render(`#/p/${MAN}/structure/drawing?select=up:at2`);
  act('st:remove', { plant: MAN, up: 'at2', eq: 'bl2' });
  const bar = render(`#/p/${MAN}/structure?select=up:at2`);
  check('live', 'taking BL-2 out of AT-2 waits in "Changes to save" with the reason field and a disabled Save', text(bar).includes('Changes to save: BL-2 removed from AT-2') && text(bar).includes('Reason (required on a Live plant)') && /data-act="st:pend-save"[^>]*disabled/.test(bar));
  act('st:pend-save', { plant: MAN });
  check('live', 'Save without a reason is refused and the change stays pending', lastToast() === 'Give a reason: this plant is Live.' && VST._state().pend[MAN].ops.length === 1);
  act('st:pend-cancel', { plant: MAN });
  check('live', 'Cancel drops the pending change', VST._state().pend[MAN].ops.length === 0 && V.unitProcess(MAN, 'at2').participants.length === 2);
  const tp = text(render(`#/p/${MAN}/review/structure`));
  check('live', 'Manesar\'s structure pass is confirmed: "Structure pass ✓" and the banner', tp.includes('Structure pass ✓') && tp.includes(`✓ ${V.structurePass(MAN).banner}`));
}

/* ══════════ 7. the control-group page ══════════ */
{
  const c = V.controlGroup(VED, 'cg_bl-1');
  const html = render(`#/p/${VED}/cg/cg_bl-1`); const t = text(html);
  check('cg', 'crumbs "All Plants › Vedanta ETP › Structure › Blowers", chips "Control group" and its state', t.startsWith(`All Plants › ${V.plant(VED).name} › Structure › ${c.name}`) && t.includes(`Control group ${c.stateLabel}`));
  check('cg', 'the members table: Tag · Equipment type · Running · Participates in', ['Tag', 'Equipment type', 'Running', 'Participates in'].every((h) => html.includes(`>${h}</th>`)) && c.members.every((m) => t.includes(m.tag)));
  check('cg', 'feeds, the setpoint sentence and the work its members carry (each line from controlGroup().memberWork)', t.includes(`Feeds: ${c.feedsTags.join(', ')}`) && t.includes(c.setpointText) && c.memberWork.length > 0 && c.memberWork.every((w) => t.includes(w.text)) && t.includes('on each of 2 members'));
  check('cg', 'no Tasks on the group: "Tasks are filed on each member, never on the group." and no Task link', t.includes('Tasks are filed on each member, never on the group.') && !/#\/p\/[^"]+\/task\//.test(html) && !('tasks' in c));
  check('cg', 'Edit in the structure list (a sample plant has no drawing)', html.includes(`#/p/${VED}/structure?select=cg:cg_bl-1`) && t.includes('Edit in the structure list'));
  const dpc = V.controlGroups(DP).find((x) => x.warnings.length);
  if (dpc) check('cg', 'a control group whose members feed different places says so', text(render(`#/p/${DP}/cg/${dpc.id}`)).includes(dpc.warnings[0]));
  check('cg', 'an unknown control group says so', text(render(`#/p/${VED}/cg/cg_nope`)).includes('There is no such control group at this plant.'));
}

/* ══════════ 8. sample plants, aliases, every route on every plant ══════════ */
{
  const v = render(`#/p/${VED}/structure`);
  check('routes', 'a sample plant shows Drawing disabled with "The sample plants have no drawing"', /<span class="st-seg-b is-off" aria-disabled="true" title="The sample plants have no drawing">Drawing<\/span>/.test(v));
  const vd = render(`#/p/${VED}/structure/drawing`);
  check('routes', 'a sample plant\'s drawing route shows the list, with a quiet note', !/<svg class="st-svg/.test(vd) && text(vd).includes('The sample plants have no drawing. The list below holds the same structure.') && text(vd).includes('EQ-1 · Equalisation'));
  check('routes', '#/p/:plant/equipment renders the Structure list', text(render(`#/p/${BAW}/equipment`)).includes(`Structure ${V.plant(BAW).type}`) || text(render(`#/p/${BAW}/equipment`)).includes('MGF-1 · Media filtration'));
  check('routes', '#/p/:plant/scada renders the structure pass', text(render(`#/p/${BAW}/scada`)).includes('Structure pass ✓') && text(render(`#/p/${BAW}/scada`)).includes('The survey wrote the plant graph'));
  const bad = []; const words = [];
  for (const k of KEYS) {
    const s = V.structure(k);
    const hs = [`#/p/${k}/structure`, `#/p/${k}/structure/list`, `#/p/${k}/structure/drawing`, `#/p/${k}/review/structure`, `#/p/${k}/review/structure?show=unclassified`, `#/p/${k}/review/structure?show=shared`, `#/p/${k}/review/structure?show=cgs`, `#/p/${k}/review`, `#/p/${k}/equipment`, `#/p/${k}/scada`,
      `#/p/${k}/structure?show=shared`, `#/p/${k}/structure?show=unclassified`, `#/p/${k}/structure?show=underneath`, `#/p/${k}/structure?show=proposed`, `#/p/${k}/structure?stage=none`]
      .concat(s.ups.slice(0, 3).map((u) => `#/p/${k}/structure?select=up:${u.id}`)).concat(s.cgs.map((c) => `#/p/${k}/cg/${c.id}`)).concat(s.equipment.slice(0, 3).map((e) => `#/p/${k}/structure/drawing?select=eq:${e.eqId}`));
    for (const h of hs) {
      const html = render(h);
      if (!html || /This page could not be shown/.test(html) || /could not be shown/.test(text(html))) bad.push(h);
      if (/review\/bindings$|\/review$/.test(h) && !/review\/structure/.test(h) && V.structureDone(k)) continue;   /* the bindings pass is another module's page */
      const w = wordsOf(pageWords(html)); if (w.length) words.push(`${h}: ${w[0]}`);
    }
  }
  check('routes', 'every structure route renders for every plant and sampled object without a failure', !bad.length, bad.join(' | '));
  check('routes', 'no banned word, ID or junk on any of them (the plant graph\'s own names aside)', !words.length, words.slice(0, 4).join(' | '));
}

/* ══════════ 9. the components the object, list and work pages use ══════════ */
{
  const pc = VST.participantsCard(MAN, 'at2'); const t = text(pc);
  check('components', 'participantsCard(manesar, at2): BL-1 and BL-2 as Blowers, "Also in AT-1", the control group and AT-2\'s sensors', t.includes('Participants') && t.includes('BL-1') && t.includes('BL-2') && t.includes('Also in AT-1') && t.includes('Control group: Air Blowers') && t.includes('Sensors: DO-AT2'), t);
  check('components', 'it ends with "Edit in the structure list" (a sample plant)', pc.includes(`#/p/${MAN}/structure?select=up:at2`) && t.includes('Edit in the structure list'));
  const dc = text(VST.participantsCard(DP, MBBR1));
  check('components', 'at DigitalPaani it ends with "Edit on drawing"', dc.includes('Edit on drawing'));
  const pq = VST.participatesCard(MAN, 'bl1'); const tq = text(pq);
  check('components', 'participatesCard(manesar, bl1): "Unit process · Role · State · Why" with AT-1 and AT-2', ['Unit process', 'Role', 'State', 'Why'].every((h) => pq.includes(`>${h}</th>`)) && tq.includes('AT-1 · Activated sludge') && tq.includes('AT-2 · Activated sludge') && tq.includes('Upstream blowers always participate') && tq.includes('Control group: Air Blowers'), tq);
  const ch = VST.participatesChips(MAN, 'bl1').map(text);
  check('components', 'participatesChips(manesar, bl1): "Participates in: AT-1, AT-2" and "Control group: Air Blowers"', ch[0] === 'Participates in: AT-1, AT-2' && ch.includes('Control group: Air Blowers'), J(ch));
  check('components', 'an unclassified piece of equipment reads "Unclassified"; one set aside reads "Not part of any unit process"', text(VST.participatesChips(DP, nodeId(DP, 'ITP-1'))[0] || '') === 'Not part of any unit process' && (V.structureDone(DP) || text(VST.participatesChips(DP, nodeId(DP, 'RFP-1'))[0] || '') === 'Unclassified'));
  check('components', 'subjectChip: "AT-2 · unit process" · "BL-1 · equipment" · "The plant"', text(VST.subjectChip(MAN, { kind: 'up', id: 'at2' })) === 'AT-2 · unit process' && text(VST.subjectChip(MAN, 'bl1')) === 'BL-1 · equipment' && text(VST.subjectChip(MAN, { kind: 'plant' })) === 'The plant' && VST.subjectChip(MAN, { kind: 'up', id: 'at2' }).includes(`href="#/p/${MAN}/up/at2"`));
  const sc1 = VST.stageCrumb(MAN, 'at2'); const sc2 = VST.stageCrumb(MAN, 'bl1');
  check('components', 'stageCrumb: a unit process\'s stage, and a piece of equipment\'s first unit process\'s stage', sc1 && sc1.label === 'Secondary' && sc1.href === `#/p/${MAN}/structure?stage=secondary` && sc2 && sc2.label === 'Secondary', J([sc1, sc2]));
  const ns = V.unitProcesses(MAN).find((u) => !u.stage);
  if (ns) check('components', 'stageCrumb for "No stage" links to the Structure page', VST.stageCrumb(MAN, ns.id).href === `#/p/${MAN}/structure`);
  check('components', 'passTabs is a pair of tabs', /st-passtabs/.test(VST.passTabs(MAN, 'structure')) && text(VST.passTabs(MAN, 'structure')).startsWith('Structure pass ✓'));
}

/* ══════════ 10. Add equipment… and the reasons on a Commissioning plant ══════════ */
{
  V.reset(); VST._reset();
  const MGF = nodeId(DP, 'MGF'); const ffp = ids(DP, 'FFP-1', 'FFP-2');
  act('st:add-eq', { plant: DP, up: MGF });
  const a0 = mdHtml();
  check('add', 'Add equipment… on MGF lists "Next to it" (FFP-1, FFP-2 feed it) and "All equipment"', a0.title === 'Add equipment to MGF' && text(a0.body).includes('Next to it') && a0.body.slice(0, a0.body.indexOf('All equipment')).includes(`data-eq="${ffp[0]}"`) && !text(a0.body).includes('Reason (required on a Live plant)'));
  ffp.forEach((e) => act('st:dlg-eq', { eq: e }, { checked: true }));
  const pv = V.membershipPreview(DP, ffp.map((e) => ({ op: 'add', upId: MGF, eqId: e })));
  check('add', 'the preview lines come from membershipPreview', pv.lines.every((l) => text(mdHtml().body).includes(l)) && text(mdHtml().foot).includes('Add to MGF'));
  act('st:dlg-save');
  check('add', '"Saved · FFP-1, FFP-2 added to MGF" with Undo; 18 left', lastToast() === 'Saved · FFP-1, FFP-2 added to MGF' && unclassifiedN(DP) === 18, lastToast());
  V.reset(); VST._reset();
  check('add', 'Reset the story brings the seed back', unclassifiedN(DP) === 20 && V.structurePass(DP).counts.proposed === 56);
}

report();
