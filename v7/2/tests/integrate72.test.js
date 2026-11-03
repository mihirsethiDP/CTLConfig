#!/usr/bin/env node
/* v7/2 · tests/integrate72.test.js — v7/2 works as one app, and the story walks end to end through the clicks a presenter
   makes. Node only, no dependencies; loads the whole prototype through load72.js, in prototype.html's order.
   1. wiring   prototype.html loads every asset in order with ?v=N on every tag and links every stylesheet; every route is
               registered exactly once, by the module that owns it; every act a page carries has a handler, and each act
               prefix belongs to one module; a crawl of the in-app links finds no dead link.
   2. story    the twelve chapters walked in order in ONE session from "Reset the story", through the registered V7UI
               handlers: each page the walk touches is rendered and the numbers it quotes are compared with the core
               functions that compute them (nothing here types a story number).
   3. sweep    after the walk (DigitalPaani and Vedanta moved on, a library version published, the clock a week on), every
               plant's pages render clean.
   4. actions  the walk counts the presenter's actions per chapter (every click, choice and typed field; following a link
               is not counted; optional beats are counted apart) and writes them to tests/out/actions72.json for the
               v7/2 hand-off doc. v7/1's integrate7.test.js writes the same count for v7/1.
   Usage: TZ=Asia/Calcutta node tests/integrate72.test.js [-v]     Exit code 0 = pass. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERBOSE = process.argv.includes('-v');
const results = []; let fails = 0;
function ok(group, name, cond, detail) { results.push({ group, name, pass: !!cond, detail }); if (!cond) fails++; return !!cond; }

const L = require('./load72.js');
const smoke = require('./smoke.js');
const APPS = require(path.join(ROOT, '..', 'tests', 'apps.js'));
const V = L.V7; const U = L.V7UI; const W = L.window;
ok('load', 'every v7/2 asset loads and the story boots', !!V && !!U && !L.missing.length && !L.errors.length, `missing: ${L.missing.join(', ')} · errors: ${L.errors.map((e) => e.file + ': ' + String(e.error).split('\n')[0]).join(' | ')}`);
if (!V || !U) { report(); }

/* ── helpers ───────────────────────────────────────────────────────────────────────────────────────────────── */
const J = (x) => JSON.stringify(x);
const DP = 'digitalpaani', VED = 'vedanta', MAN = 'manesar', BAW = 'bawal';
const DAY = 864e5;
const DATA = smoke.isDataIn(smoke.corpusOf(W), smoke.corpusOf(W, null, true));
const DEC = smoke.isDataIn(smoke.decisionsCorpus(W), smoke.decisionsCorpus(W, true));
const text = (h) => smoke.visibleText(smoke.withoutMarks(h));
const has = (t, s) => String(t).indexOf(s) >= 0;
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
const lastToast = () => String((U._last && U._last.toast) || '');
const lastModal = () => (U._last && U._last.modal) || {};
const lastSheet = () => (U._last && U._last.sheet) || {};
const modalHtml = () => `<h2>${lastModal().title || ''}</h2>${lastModal().body || ''}${lastModal().foot || ''}`;
const sheetHtml = () => `<h2>${lastSheet().title || ''}</h2>${lastSheet().body || ''}${lastSheet().foot || ''}`;
const nodeId = (k, tag) => { const n = V.nodes(k).find((e) => e.tag === tag); if (!n) throw new Error(`no ${tag} at ${k}`); return n.id; };
const ids = (k, ...tags) => tags.map((t) => nodeId(k, t));
const decode = smoke.decode;

/* every act and every link a rendered page or dialog carries, for the wiring checks */
const SEEN_ACTS = new Map(); const SEEN_LINKS = new Map();
function harvest(html, where) {
  for (const m of String(html || '').matchAll(/\sdata-act="([^"]+)"/g)) if (!SEEN_ACTS.has(m[1])) SEEN_ACTS.set(m[1], where);
  for (const l of smoke.links(html)) if (!SEEN_LINKS.has(l)) SEEN_LINKS.set(l, where);
}
/* render a page: no throw, no "could not be shown", no banned word, internal id or junk in the page's own words */
function render(hash) { W.location.hash = hash; const h = U.renderPath(hash); harvest(h, hash); return h; }
function page(group, hash, label) {
  let h = ''; try { h = render(hash); } catch (e) { ok(group, `${label || hash} renders`, false, e.stack); return { h: '', t: '' }; }
  const isDec = /^#\/decisions/.test(hash);
  const bad = smoke.scan(h, { ids: true, decisions: isDec, isData: isDec ? (t, i, n) => DATA(t, i, n) || DEC(t, i, n) : DATA }).filter((f) => f.kind !== 'data-word');
  const t = text(h);
  ok(group, `${label || hash} renders clean`, !bad.length && !/could not be shown|could not be worked out/.test(t), bad.map((b) => `${b.kind} ${b.word}: ${b.ctx}`).join(' | ') || (t.match(/.{60}could not.{60}/) || [''])[0]);
  return { h, t };
}
function dialog(group, html, label) {
  harvest(html, label);
  const bad = smoke.scan(html, { ids: true, isData: DATA }).filter((f) => f.kind !== 'data-word');
  ok(group, `${label}: Alex's words only, no internal id, no junk`, !bad.length, bad.map((b) => `${b.kind} ${b.word}: ${b.ctx}`).join(' | '));
  return text(html);
}

/* ── the presenter's actions: every click, choice and typed field, per chapter ─────────────────────────────── */
const COUNT = { n: 0, counting: true, by: {} };
const T0 = Date.now(); const TRACE = !!process.env.INT72_TRACE; function mark(l) { if (TRACE) process.stderr.write(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${l}\n`); }
function chapter(n) { mark('chapter ' + n); COUNT.n = n; COUNT.by[n] = COUNT.by[n] || { clicks: 0, fields: 0, optional: 0 }; }
function tally(kind, k) { const c = COUNT.by[COUNT.n]; if (!c || !k) return; if (COUNT.counting) c[kind] += k; else c.optional += k; }
function optional(fn) { const was = COUNT.counting; COUNT.counting = false; try { return fn(); } finally { COUNT.counting = was; } }
const typed = (k) => tally('fields', k == null ? 1 : k);

/* a fake element: a button's data-* attributes, its value or checked state, and the dialog it sits in, which answers
   querySelector for the fields a person typed (fields: {name: value}) */
function fake(data, o) {
  o = o || {}; const fields = o.fields || {};
  const field = (v) => ({ value: String(v), checked: true, type: 'text', classList: { add() {}, remove() {}, contains: () => false }, closest: () => null, parentNode: null, focus() {}, getAttribute: () => null });
  const box = {
    querySelector(sel) {
      let m = /\[name="([^"]+)"\]:checked/.exec(sel);
      if (m) return fields[m[1]] != null && fields[m[1]] !== '' ? field(fields[m[1]]) : null;
      m = /\[name="([^"]+)"\]/.exec(sel) || /^#p7-([\w-]+)$/.exec(sel);
      if (m && fields[m[1]] != null) return field(fields[m[1]]);
      return null;
    },
    querySelectorAll() { return []; }, getAttribute: () => null,
  };
  const inBox = (sel) => /\.modal|\.sheet|form/.test(String(sel));
  return {
    tagName: o.tagName || 'BUTTON', type: o.type || 'button', name: o.name || '',
    value: o.value != null ? String(o.value) : data.value != null ? String(data.value) : '',
    checked: o.checked != null ? !!o.checked : true, disabled: false, dataset: Object.assign({}, data),
    getAttribute: (k) => { const kk = String(k).replace(/^data-/, ''); return String(k).startsWith('data-') && data[kk] != null ? String(data[kk]) : null; },
    hasAttribute: (k) => String(k).startsWith('data-') && data[String(k).replace(/^data-/, '')] != null,
    closest: (sel) => (o.fields && inBox(sel) ? box : null),
    querySelector: box.querySelector, classList: { add() {}, remove() {}, contains: () => false, toggle() {} }, setAttribute() {}, removeAttribute() {}, focus() {},
  };
}
/* act(name, data, o): one registered handler, as a click on a button (or a change on a field: o.tagName INPUT, SELECT or
   TEXTAREA) runs it. o.fields are typed into its dialog first; each one the person changes from the dialog's own default
   (o.defaults) counts as an action of its own */
const isFieldTag = (t) => /^(INPUT|SELECT|TEXTAREA)$/.test(String(t || ''));
function act(name, data, o) {
  const fn = U._handlers[name];
  if (!ok('handlers', `the walk's act ${name} has a handler`, typeof fn === 'function')) return undefined;
  tally(o && isFieldTag(o.tagName) ? 'fields' : 'clicks', 1);
  if (o && o.fields) { const d = o.defaults || {}; typed(Object.keys(o.fields).filter((k) => o.fields[k] != null && String(o.fields[k]).trim() !== '' && String(o.fields[k]) !== String(d[k] == null ? '' : d[k])).length); }
  return fn(fake(data || {}, o), Object.assign({ preventDefault() {}, stopPropagation() {} }, (o && o.ev) || {}));
}
/* the buttons, links and fields on a page that carry a data-act: {act, data, label, disabled} */
const attrsOf = (s) => { const o = {}; const re = /\s([\w-]+)="([^"]*)"/g; let m; while ((m = re.exec(s))) o[m[1]] = decode(m[2]); return o; };
function actsOf(html) {
  const out = []; const src = smoke.withoutMarks(html);
  const re = /<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/g; let m;
  while ((m = re.exec(src))) {
    const a = attrsOf(m[2]); if (!a['data-act']) continue;
    const data = {}; Object.keys(a).forEach((k) => { if (k.startsWith('data-') && k !== 'data-act') data[k.slice(5)] = a[k]; });
    out.push({ act: a['data-act'], data, label: text(m[3]), disabled: /\sdisabled\b/.test(m[2]) || a['aria-disabled'] === 'true', title: a.title || '' });
  }
  return out;
}
/* click(group, html, label, opts): press the button with that label on the page (or dialog), as a presenter would */
function click(group, html, label, opts) {
  opts = opts || {};
  const all = actsOf(html).filter((b) => (label instanceof RegExp ? label.test(b.label) : b.label === label) && (!opts.where || Object.keys(opts.where).every((k) => b.data[k] === String(opts.where[k]))));
  if (!ok(group, `there is a "${label}" button to press${opts.where ? ' (' + J(opts.where) + ')' : ''}`, all.length > 0, actsOf(html).map((b) => b.label).filter(Boolean).slice(0, 40).join(' | '))) return undefined;
  ok(group, `"${label}" is enabled`, !all[0].disabled, all[0].title);
  return act(all[0].act, all[0].data, opts.fields ? Object.assign({ defaults: defaultsOf(html) }, opts) : opts);
}
/* what a dialog's fields hold before anyone types: input values and the checked radio of each name */
function defaultsOf(html) {
  const out = {}; const re = /<(input|textarea|select)\b([^>]*)>([\s\S]*?<\/textarea>)?/g; let m;
  while ((m = re.exec(String(html || '')))) {
    const a = attrsOf(m[2]); if (!a.name) continue;
    if (a.type === 'radio' || a.type === 'checkbox') { if (/\schecked\b/.test(m[2])) out[a.name] = a.value || ''; else if (!(a.name in out)) out[a.name] = ''; }
    else if (m[1] === 'textarea') out[a.name] = decode(String(m[3] || '').replace(/<\/textarea>$/, ''));
    else out[a.name] = a.value || '';
  }
  return out;
}
/* the field on a page with a data-act (inputs, selects, textareas): {act, data, name, type, value} */
function fieldsOf(html) {
  const out = []; const re = /<(input|select|textarea)\b([^>]*)>/g; let m;
  while ((m = re.exec(smoke.withoutMarks(html)))) {
    const a = attrsOf(m[2]); if (!a['data-act']) continue;
    const data = {}; Object.keys(a).forEach((k) => { if (k.startsWith('data-') && k !== 'data-act') data[k.slice(5)] = a[k]; });
    out.push({ tag: m[1], act: a['data-act'], data, name: a.name || '', type: a.type || '', value: a.value != null ? a.value : '' });
  }
  return out;
}
/* type into (or choose) a field the page carries: the first with that act whose data match */
function field(group, html, actName, where, value, label) {
  const f = fieldsOf(html).find((x) => x.act === actName && (!where || Object.keys(where).every((k) => (k === 'value' ? x.value : x.data[k]) === String(where[k]))));
  if (!ok(group, `${label || actName}: the field is on the page${where ? ' (' + J(where) + ')' : ''}`, !!f, fieldsOf(html).map((x) => `${x.act} ${J(x.data)} ${x.value}`).slice(0, 12).join(' | '))) return undefined;
  return act(f.act, f.data, { value, tagName: f.tag.toUpperCase(), type: f.type, name: f.name });
}
const TOASTS = [];
{ const real = U.toast; U.toast = (t, o) => { TOASTS.push({ text: String(t), o: o || {} }); return real(t, o); }; }
const toastObj = () => TOASTS[TOASTS.length - 1] || { text: '', o: {} };
const latest = (k) => ((V.activity({ plant: k, limit: 1 }) || [])[0] || {}).text || '';
const allActivity = () => V.activity({}).filter((a) => !a.plant);

/* ══════════ 1. wiring ══════════ */
{
  const G = 'wiring';
  const html = fs.readFileSync(path.join(ROOT, 'prototype.html'), 'utf8');
  const tags = []; { const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m; while ((m = re.exec(html))) tags.push({ attrs: m[1], body: m[2].trim() }); }
  const srcs = tags.filter((t) => /\bsrc=/.test(t.attrs)).map((t) => (t.attrs.match(/src="([^"]+)"/) || [])[1]);
  ok(G, 'scripts load in the order the core and the pages need (data, CTL, the core files, ui7, the page modules, decisions7)', J(srcs.map((s) => s.replace(/^assets\//, '').split('?')[0])) === J(L.ORDER), srcs.join(','));
  ok(G, 'every script tag carries a ?v=N cache-buster', srcs.every((s) => /\?v=\d+$/.test(s)));
  ok(G, 'V7_NO_V6_SHELL and V7_VARIANT = \'2\' are set inline before the first script', /V7_NO_V6_SHELL\s*=\s*true/.test(tags[0].body) && /V7_VARIANT\s*=\s*'2'/.test(tags[0].body) && !/src=/.test(tags[0].attrs));
  ok(G, 'V7UI.start() runs inline after the last script, so every hook is registered before the seed', /V7UI\.start\(\)/.test(tags[tags.length - 1].body) && !/src=/.test(tags[tags.length - 1].attrs));
  ok(G, 'nothing boots V7 at load time: only V7UI.start() does', !tags.some((t) => /V7\.boot\(\)/.test(t.body)));
  const css = (html.match(/<link rel="stylesheet" href="assets\/[^"]+"/g) || []).map((l) => l.match(/href="assets\/([^"]+)"/)[1]);
  const CSS_ORDER = ['v7.css', 'plant7.css', 'lists7.css', 'structure7.css', 'object7.css', 'lib7.css', 'ledger7.css', 'work7.css', 'decisions7.css'];
  ok(G, 'every stylesheet is linked, in order, each with ?v=N', J(css.map((c) => c.split('?')[0])) === J(CSS_ORDER) && css.every((c) => /\?v=\d+$/.test(c)), css.join(','));
  const cssFiles = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /\.css$/.test(f));
  ok(G, 'no stylesheet in assets is left unlinked', cssFiles.every((f) => CSS_ORDER.includes(f)), cssFiles.filter((f) => !CSS_ORDER.includes(f)).join(','));
  const jsFiles = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /\.js$/.test(f));
  ok(G, 'no script in assets is left unloaded', jsFiles.every((f) => L.ORDER.includes(f)), jsFiles.filter((f) => !L.ORDER.includes(f)).join(','));
  ok(G, 'every linked asset exists', srcs.concat(css.map((c) => 'assets/' + c)).every((s) => fs.existsSync(path.join(ROOT, s.split('?')[0]))));
  ok(G, 'title and description', /<title>CloseTheLoop Configuration v7\/2<\/title>/.test(html) && html.includes('<meta name="description" content="CloseTheLoop configuration, v7/2: Alex\'s model built as drafted, end to end, to compare with v7/1.">'));
  ok(G, 'the decision file is the same file in both prototypes', fs.readFileSync(path.join(ROOT, 'assets', 'decisions7.js'), 'utf8') === fs.readFileSync(path.join(ROOT, '..', '1', 'assets', 'decisions7.js'), 'utf8') && fs.readFileSync(path.join(ROOT, 'assets', 'decisions7.css'), 'utf8') === fs.readFileSync(path.join(ROOT, '..', '1', 'assets', 'decisions7.css'), 'utf8'));

  /* routes: exactly the planned ones, each once, each owned by the module that registers it */
  const pats = U.routes().map((r) => r.pattern);
  const want = APPS.V72_ROUTES.map((r) => r.pattern);
  ok(G, `every route is registered (${want.length}) and no other`, want.every((p) => pats.includes(p)) && pats.every((p) => want.includes(p)), `missing: ${want.filter((p) => !pats.includes(p)).join(', ')} · extra: ${pats.filter((p) => !want.includes(p)).join(', ')}`);
  ok(G, 'no route is registered twice', pats.length === new Set(pats).size, pats.filter((p, i) => pats.indexOf(p) !== i).join(', '));
  const src = {}; L.ORDER.forEach((f) => { src[f] = fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8'); });
  const regs = (f) => [...src[f].matchAll(/\bon\(\s*'([a-z0-9]+:[a-z0-9-]+)'/g)].map((m) => m[1]);
  const routeRegs = (f) => [...src[f].matchAll(/\broute\(\s*'([^']+)'/g)].map((m) => m[1]);
  const wrongRoute = APPS.V72_ROUTES.filter((r) => !routeRegs(r.owner).includes(r.pattern)).map((r) => `${r.pattern} (${r.owner})`);
  ok(G, 'each route is registered by the module that owns it', !wrongRoute.length, wrongRoute.join(', '));
  const PREFIX = { 'ui7.js': ['ui', 'story', 'undo'], 'plant7.js': ['plant', 'bind', 'trig', 'ppl', 'sd'], 'lists7.js': ['list'], 'structure7.js': ['st'], 'object7.js': ['obj', 'dp', 'rs'],
    'lib7.js': ['lib', 'tpl', 'pin'], 'ledger7.js': ['ov', 'dev'], 'work7.js': ['work'], 'decisions7.js': ['dec'] };
  const wrongPrefix = []; const twice = [];
  const owners = {};
  Object.keys(PREFIX).forEach((f) => regs(f).forEach((a) => { const p = a.split(':')[0]; if (!PREFIX[f].includes(p)) wrongPrefix.push(`${a} in ${f}`); (owners[a] = owners[a] || new Set()).add(f); }));
  L.ORDER.filter((f) => !PREFIX[f]).forEach((f) => regs(f).forEach((a) => wrongPrefix.push(`${a} in ${f}`)));
  Object.keys(owners).forEach((a) => { if (owners[a].size > 1) twice.push(`${a}: ${[...owners[a]].join(', ')}`); });
  ok(G, 'every act prefix belongs to one module (ui story undo · plant bind trig ppl sd · list · st · obj dp rs · lib tpl pin · ov dev · work · dec)', !wrongPrefix.length, wrongPrefix.join(', '));
  ok(G, 'no act is registered by two modules', !twice.length, twice.join(' | '));
  ok(G, 'every act a module registers is live in the shell', Object.keys(owners).every((a) => typeof U._handlers[a] === 'function'), Object.keys(owners).filter((a) => typeof U._handlers[a] !== 'function').join(', '));
}

mark('wiring done');
/* ══════════ 2. the story, walked in order, through the handlers ══════════ */
V.reset(); U.closeModal && U.closeModal(true); U.closeSheet && U.closeSheet(true);
const W2 = { V7STRUCT: W.V7STRUCT, V7LEDGER: W.V7LEDGER, V7OBJ: W.V7OBJ, V7WORK: W.V7WORK, V7PLANT: W.V7PLANT, V7LIB: W.V7LIB };
ok('load', 'the page modules export what the walk reads (V7STRUCT, V7LEDGER, V7OBJ, V7WORK, V7PLANT, V7LIB)', Object.values(W2).every(Boolean), Object.keys(W2).filter((k) => !W2[k]).join(', '));
const chapterHrefs = U.chapters().map((c) => c.href);

/* ── chapter 1 · the library ───────────────────────────────────────────────────────────────────────────── */
chapter(1);
{
  const G = '1 library';
  ok(G, '"Take me there" is #/library', chapterHrefs[0] === '#/library');
  const tpls = V.templates({});
  const { h, t } = page(G, '#/library');
  const tiles = [`Plant types ${V.plantTypes().length}`, `Unit-process types ${V.upTypes().length}`, `Equipment types ${V.libTypes().length}`,
    `Templates ${tpls.length} (${tpls.filter((x) => x.kind === 'trigger').length} Trigger · ${tpls.filter((x) => x.kind === 'task').length} Task)`,
    `Conditions ${V.conditions().length}`, `Flows ${V.flows().length}`, `Root causes ${V.rootCauses().length}`];
  ok(G, `the seven collections with their counts from the core: ${tiles.join(' · ')}`, tiles.every((x) => has(t, x)) && V.plantTypes().length === 3 && V.upTypes().length === 27 && V.libTypes().length === 56, tiles.filter((x) => !has(t, x)).join(' | '));
  ok(G, 'no Drafts strip at the start', !/lb-drafts/.test(h) && !has(t, 'Drafts'));
  const bl = page(G, '#/library/eq-types/BLW'); const lt = V.libType('BLW');
  const motor = lt.readings.find((r) => r.name === 'Motor current').dirs[0];
  ok(G, 'Blower: "Equipment type · v1", tabs Readings · Issues · Tasks · Details', /<h1>Blower<\/h1>/.test(bl.h) && has(bl.t, 'Equipment type · v1') && ['Readings', 'Issues', 'Tasks', 'Details'].every((x) => has(bl.t, x)));
  ok(G, `Blower: "${motor.title}" with "${motor.rulesText}"`, motor.title === 'Motor current high v1' && motor.rulesText === 'Caution above 100% · Minor above 105% · Major above 115% of full-load current' && has(bl.t, motor.title) && has(bl.t, motor.rulesText));
  const ra = motor.resolvesAt.map((x) => x.text);
  ok(G, 'Blower: every "Resolves at" line as the core writes it (Manesar 40.0 / 42.0 / 46.0 A, its own 44 / 48 A, Vedanta 20.0 / 21.0 / 23.0 A, DigitalPaani needs a sensor)', ra.length >= 4 && ra.every((x) => has(bl.t, x)) && ra.some((x) => /40\.0 \/ 42\.0 \/ 46\.0 A/.test(x)) && ra.some((x) => /20\.0 \/ 21\.0 \/ 23\.0 A/.test(x)) && ra.some((x) => /DigitalPaani/.test(x)), ra.join(' | '));
  const mb = page(G, '#/library/eq-types/MBBR'); const mbt = V.libType('MBBR');
  ok(G, 'MBBR: "Every MBBR in the plant graph is a unit process. …" linking Moving bed bioreactor', has(mb.t, mbt.banner) && /^Every MBBR in the plant graph is a unit process\./.test(mbt.banner) && mb.h.includes('href="#/library/up-types/mbbr"'), mbt.banner);
  const up = V.upTypeView('mbbr'); const mt = page(G, '#/library/up-types/mbbr/tasks');
  ok(G, `Moving bed bioreactor: its ${up.schedules.length} Task templates and ${up.issues.length} Issue types, as v7/1 shows on MBBR`, up.schedules.every((s) => has(mt.t, s.name)) && up.schedules.length === 29 && up.issues.length === 15, `${up.schedules.length} · ${up.issues.length}`);
  const ag = page(G, '#/library/eq-types/OS_TANK_AG');
  ok(G, 'Agitator: "Motor current high v1", "Library · Motor current high v1" and "This scales with the plant. Use a design parameter?"', has(ag.t, 'Motor current high v1') && has(ag.t, 'Library · Motor current high v1') && has(ag.t, 'This scales with the plant. Use a design parameter?'));
  const DOLOW = 'tpl_up_activated-sludge_do-low';
  const dl = page(G, `#/library/templates/${DOLOW}`); const tv = V.template(DOLOW);
  ok(G, 'DO low: "Trigger template · v1", Minor below 2.0 · Major below 1.0 · Emergency below 0.5 mg/L, Persistence and Clearing', has(dl.t, 'Trigger template · v1') && tv.rules.minor.rule.value === 2 && tv.rules.major.rule.value === 1 && tv.rules.emergency.rule.value === 0.5 && has(dl.t, 'Persistence · must hold for') && has(dl.t, 'Clearing · must clear for'));
  ok(G, 'DO low: Downstream "Field · Follow · Override · Pinned · Frozen" whose Frozen names "DO low · AT-2 (1 open Issue)"', ['Field', 'Follow', 'Override', 'Pinned', 'Frozen'].every((x) => has(dl.t, x)) && has(dl.t, 'DO low · AT-2 (1 open Issue)'));
}

/* ── chapter 2 · a new plant from the survey (DigitalPaani) ────────────────────────────────────────────── */
chapter(2);
const SC = nodeId(DP, 'SC'); const MBBR1 = nodeId(DP, 'MBBR-1'); const VST = W.V7STRUCT;
{
  const G = '2 survey';
  ok(G, '"Take me there" is the structure pass', chapterHrefs[1] === `#/p/${DP}/review/structure`);
  const r = page(G, `#/p/${DP}`); const cl = V.checklist(DP); const sc = V.structure(DP).counts;
  ok(G, `Readiness, Structure track: "Plant graph built · ${sc.nodes} pieces of equipment · ${sc.sensors} sensors"`, has(r.t, `Plant graph built ${sc.nodes} pieces of equipment · ${sc.sensors} sensors`) && sc.nodes === 66 && sc.sensors === 38);
  ok(G, `"Identification run · ${sc.ups} of them are unit processes · ${sc.cgs} control groups"`, has(r.t, `Identification run ${sc.ups} of them are unit processes · ${sc.cgs} control groups`) && sc.ups === 21 && sc.cgs === 11);
  const sp0 = V.structurePass(DP).counts;
  ok(G, `"Structure pass · ${sp0.toReview} to review · ${sp0.unclassified} unclassified"`, has(r.t, `Structure pass ${sp0.toReview} to review · ${sp0.unclassified} unclassified`) && sp0.toReview === 76 && sp0.unclassified === 20);
  const un = cl.blockers.find((b) => b.id === 'unclassified');
  ok(G, 'the blocker "20 pieces of equipment are unclassified: RFP-1, RFP-2, FFP-1 and 17 more"', !!un && un.text === '20 pieces of equipment are unclassified: RFP-1, RFP-2, FFP-1 and 17 more' && has(r.t, un.text));
  ok(G, '[Review] leads to the structure pass', r.h.includes(`href="#/p/${DP}/review/structure"`));
  let p = page(G, `#/p/${DP}/review/structure`); const c = V.structurePass(DP).counts;
  ok(G, `chips "All ${c.all} · Unclassified ${c.unclassified} · Shared ${c.shared} · Control groups ${c.cgs}"`, has(p.t, `All ${c.all} Unclassified ${c.unclassified} Shared ${c.shared} Control groups ${c.cgs}`) && c.all === 76 && c.shared === 15 && c.cgs === 11);
  const g0 = V.structurePass(DP).groups.find((x) => x.upId);
  ok(G, 'the first unit-process group "SC · Collection sump (Proposed)", why "Nothing upstream but the plant inlet"', g0.title === 'SC · Collection sump' && has(p.t, `${g0.title} Proposed`) && has(p.t, 'Nothing upstream but the plant inlet'), g0.title);
  /* (3) Change type on SC → Screening */
  click(G, p.h, /^Change type/, { where: { up: SC } });
  const u = V.unitProcess(DP, SC); let mt = dialog(G, VST._mdHtml().body + VST._mdHtml().foot, 'Change type');
  ok(G, 'the fact line "Drawn in the plant graph as Screen Chamber Tank; stored in the survey as Open Skeleton Tank."', u.drawnFact === 'Drawn in the plant graph as Screen Chamber Tank; stored in the survey as Open Skeleton Tank.' && has(mt, u.drawnFact));
  act('st:dlg-type', { type: 'screening' }, { value: 'screening', tagName: 'INPUT', type: 'radio' });
  const pv = V.membershipPreview(DP, [{ op: 'type', upId: SC, typeId: 'screening' }]); mt = dialog(G, VST._mdHtml().body + VST._mdHtml().foot, 'Change type, Screening picked');
  ok(G, 'the consequence before saving: "Screening brings … Task templates and … Issue types; 1 Trigger template needs a sensor SC doesn\'t have (H2S). Collection sump brings …. About … more Tasks a day once Live."', pv.lines.length >= 3 && pv.lines.every((l) => has(mt, l)) && /^Screening brings \d+ Task templates and \d+ Issue types; 1 Trigger template needs a sensor SC doesn't have \(H2S\)\.$/.test(pv.lines[0]) && /^Collection sump brings/.test(pv.lines[1]) && /^About [\d.]+ more Tasks a day once Live\.$/.test(pv.lines[2]), pv.lines.join(' | '));
  act('st:dlg-save');
  ok(G, 'toast "SC is now Screening" with Undo', lastToast() === 'SC is now Screening' && V.unitProcess(DP, SC).typeName === 'Screening');
  const c2 = V.structurePass(DP).counts; p = page(G, `#/p/${DP}/review/structure`);
  ok(G, `the primary button "Accept all ${c2.proposed} that are proposed"`, has(p.t, `Accept all ${c2.proposed} that are proposed`) && c2.proposed === 55, c2.proposed);
  /* (4) Accept all */
  click(G, p.h, `Accept all ${c2.proposed} that are proposed`);
  const c3 = V.structurePass(DP).counts;
  ok(G, `toast "Accepted ${c2.proposed}"; ${c3.unclassified} left, all unclassified`, lastToast() === `Accepted ${c2.proposed}` && c3.proposed === 0 && c3.toReview === c3.unclassified && c3.unclassified === 20, lastToast());
  p = page(G, `#/p/${DP}/review/structure`);
  ok(G, '"UF Backwash Pumps: UFBP-1, UFBP-2, UFBP-3, UFBP-4", one group over both UF trains, accepted in bulk', /UF Backwash Pumps · UFBP-1, UFBP-2, UFBP-3, UFBP-4 Confirmed/.test(p.t));
  /* (5) not part, and Place in… UF-1 */
  ids(DP, 'ITP-1', 'ITP-2', 'FWTP-1', 'FWTP-2').forEach((id) => act('st:tick', { plant: DP, eq: id }, { checked: true, tagName: 'INPUT', type: 'checkbox' }));
  p = page(G, `#/p/${DP}/review/structure`);
  click(G, p.h, 'Not part of any unit process', { where: { plant: DP } });
  ok(G, 'ITP-1, ITP-2, FWTP-1, FWTP-2 → Not part of any unit process: 16 left', V.structurePass(DP).counts.unclassified === 16, V.structurePass(DP).counts.unclassified);
  const UF1 = nodeId(DP, 'UF-1');
  ids(DP, 'UFFP-1', 'UFFP-2', 'UFBV-1').forEach((id) => act('st:tick', { plant: DP, eq: id }, { checked: true, tagName: 'INPUT', type: 'checkbox' }));
  p = page(G, `#/p/${DP}/review/structure`);
  click(G, p.h, /^Place in…$/, { where: { plant: DP } });
  act('st:dlg-up', { up: UF1 }, { checked: true, tagName: 'INPUT', type: 'checkbox' });
  const ppv = V.membershipPreview(DP, ids(DP, 'UFFP-1', 'UFFP-2', 'UFBV-1').map((e) => ({ op: 'add', upId: UF1, eqId: e })));
  mt = dialog(G, VST._mdHtml().body + VST._mdHtml().foot, 'Place in UF-1');
  ok(G, 'preview "Criticality tier for UFFP-1: B → A · Criticality tier for UFFP-2: B → A · Criticality tier for UFBV-1: C → A"', ppv.lines.every((l) => has(mt, l)) && ['UFFP-1: B → A', 'UFFP-2: B → A', 'UFBV-1: C → A'].every((x) => ppv.lines.some((l) => l === `Criticality tier for ${x}`)), ppv.lines.join(' | '));
  act('st:dlg-save');
  ok(G, '13 left', V.structurePass(DP).counts.unclassified === 13);
  /* (6) finish the pass */
  const placeAll = (tags, upTags) => {
    ids(DP, ...tags).forEach((id) => act('st:tick', { plant: DP, eq: id }, { checked: true, tagName: 'INPUT', type: 'checkbox' }));
    click(G, render(`#/p/${DP}/review/structure`), /^Place in…$/, { where: { plant: DP } });
    ids(DP, ...upTags).forEach((u2) => act('st:dlg-up', { up: u2 }, { checked: true, tagName: 'INPUT', type: 'checkbox' })); act('st:dlg-save');
  };
  placeAll(['UFFP-3', 'UFFP-4', 'UFBV-2'], ['UF-2']); placeAll(['RFP-1', 'RFP-2'], ['MBBR-1', 'MBBR-4']); placeAll(['FFP-1', 'FFP-2'], ['MGF']); placeAll(['SPFP-1', 'SPFP-2'], ['SLP']);
  ok(G, 'four more placements: 4 left', V.structurePass(DP).counts.unclassified === 4, V.structurePass(DP).counts.unclassified);
  ids(DP, 'PDT', 'PDP', 'SCP-1', 'SCP-2').forEach((id) => act('st:tick', { plant: DP, eq: id }, { checked: true, tagName: 'INPUT', type: 'checkbox' }));
  click(G, render(`#/p/${DP}/review/structure`), 'Not part of any unit process', { where: { plant: DP } });
  ok(G, 'toast "Structure confirmed: 21 unit processes, 11 control groups. The bindings pass is open" with Undo', lastToast() === 'Structure confirmed: 21 unit processes, 11 control groups. The bindings pass is open' && V.structureDone(DP), lastToast());
  const r2 = page(G, `#/p/${DP}`); const step = V.checklist(DP).tracks.structure.steps.find((s) => /Structure pass/.test(s.label));
  ok(G, 'the Structure track reads "Confirmed Thu 29 Oct, 09:00 · 12 placed by hand · 1 type changed · 8 not part of any unit process"', !!step && step.text === `Confirmed ${V.fmt(V.now())} · 12 placed by hand · 1 type changed · 8 not part of any unit process` && has(r2.t, step.text), step && step.text);
  ok(G, 'All Plants counts DigitalPaani\'s blockers as the checklist does', has(text(render('#/plants')), V.checklist(DP).blockersChip ? V.checklist(DP).blockersChip.text : `${V.checklist(DP).blockers.length} blockers`));
  /* (7) optional: membership on the drawing */
  optional(() => {
    const sel = page(G, `#/p/${DP}/structure/drawing?select=up:${MBBR1}`);
    const cls = (id) => (new RegExp(`<g class="([^"]*)" data-act="st:node" data-plant="[^"]*" data-id="${id}"`).exec(sel.h) || [])[1] || '';
    ok(G, 'the drawing, MBBR-1 selected: MBBRAB-1/2/3 shared, SRCP-1, SRCP-2 and RFP-1 (Added) outlined solid', ['MBBRAB-1', 'MBBRAB-2', 'MBBRAB-3'].every((x) => /is-p-confirmed/.test(cls(nodeId(DP, x))) && /is-shared/.test(cls(nodeId(DP, x)))) && /is-p-added/.test(cls(nodeId(DP, 'RFP-1'))) && ['SRCP-1', 'SRCP-2'].every((x) => /is-p-(confirmed|added)/.test(cls(nodeId(DP, x)))), ['MBBRAB-1', 'RFP-1', 'SRCP-1'].map((x) => cls(nodeId(DP, x))).join(' | '));
    const TS1 = nodeId(DP, 'TS-1'); const tsp = page(G, `#/p/${DP}/structure/drawing?select=up:${TS1}`);
    ok(G, 'TS-1: "No participants", with a link to its Tasks', has(tsp.t, 'No participants') && tsp.h.includes(`#/p/${DP}/up/${TS1}/tasks`));
    const sr = ids(DP, 'SRCP-1', 'SRCP-2');
    render(`#/p/${DP}/structure/drawing?select=up:${TS1}`);
    act('st:node', { plant: DP, id: sr[0], kind: 'eq' }, { ev: { shiftKey: true } }); act('st:node', { plant: DP, id: sr[1], kind: 'eq' }, { ev: { shiftKey: true } });
    const ad = page(G, `#/p/${DP}/structure/drawing?select=up:${TS1}`); const mpv = V.membershipPreview(DP, sr.map((e) => ({ op: 'add', upId: TS1, eqId: e })));
    ok(G, '"Adding: SRCP-1, SRCP-2" → "No Trigger depends on this · criticality tiers unchanged"', has(ad.t, 'Adding: SRCP-1, SRCP-2') && mpv.text === 'No Trigger depends on this · criticality tiers unchanged' && mpv.lines.every((l) => has(ad.t, l)), mpv.text);
    act('st:pend-save', { plant: DP });
    ok(G, 'toast "Saved · SRCP-1, SRCP-2 added to TS-1" with Undo', lastToast() === 'Saved · SRCP-1, SRCP-2 added to TS-1' && V.unitProcess(DP, TS1).participants.length === 2, lastToast());
    /* an optional beat leaves the walk as it found it: Undo */
    act('st:undo', { plant: DP, token: VST._state().last.token });
    ok(G, 'Undo takes SRCP-1 and SRCP-2 out of TS-1 again', V.unitProcess(DP, TS1).participants.length === 0);
  });
}

/* ── chapter 3 · the bindings pass (DigitalPaani) ──────────────────────────────────────────────────────── */
chapter(3);
{
  const G = '3 bindings';
  ok(G, '"Take me there" is the bindings pass', chapterHrefs[2] === `#/p/${DP}/review/bindings`);
  let p = page(G, `#/p/${DP}/review/bindings`); let bp = V.bindingsPass(DP); const c = bp.counts;
  ok(G, `chips "All ${c.all} · Undecided ${c.undecided} · Can't resolve ${c.cantResolve} · Needs equipment or sensors ${c.needs}"`, ['All', 'Undecided', 'Can\'t resolve', 'Needs equipment or sensors'].every((l, i) => has(p.t, `${l} ${[c.all, c.undecided, c.cantResolve, c.needs][i]}`)) && c.cantResolve === 3, J(c));
  ok(G, `bulk "${bp.bulk.draftsLabel}" · "${bp.bulk.activateLabel}"`, has(p.t, bp.bulk.draftsLabel) && has(p.t, bp.bulk.activateLabel) && /^Accept \d+ as drafts$/.test(bp.bulk.draftsLabel) && /^Accept \d+ and start trial$/.test(bp.bulk.activateLabel));
  const lh = (p.h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*Level high · Issue → EQTT-2[\s\S]*?<\/tr>/) || [''])[0];
  ok(G, 'row "Level high · Issue → EQTT-2 · reads LVL-EQTT-2": "Caution > 85% (3.4 m) · Major > 95% (3.8 m)", "Derived · 85% of tank height (4.0 m)", "Persistence 5 min (Library)"', /reads LVL-EQTT-2/.test(text(lh)) && /Caution > 85% \(3\.4 m\)/.test(text(lh)) && /Major > 95% \(3\.8 m\)/.test(text(lh)) && /Derived · 85% of tank height \(4\.0 m\)/.test(text(lh)) && /Persistence 5 min Library/.test(text(lh)), text(lh));
  const cr = page(G, `#/p/${DP}/review/bindings?show=cantresolve`); const crRows = V.bindingsPass(DP, { show: 'cantresolve' }).rows;
  ok(G, 'Can\'t resolve 3: CCT, TWT and UFWT, each "Can\'t resolve: needs tank height ({tag})" with [Add parameter] and [Accept as draft]', J(crRows.map((x) => x.tag).sort()) === J(['CCT', 'TWT', 'UFWT']) && crRows.every((x) => has(cr.t, `Can't resolve: ${x.cantResolve.text}`) && x.cantResolve.text === `needs tank height (${x.tag})`) && (cr.h.match(/>Add parameter</g) || []).length === 3 && (cr.h.match(/>Accept as draft</g) || []).length === 3);
  /* (4) Add parameter on CCT */
  const CCT = nodeId(DP, 'CCT'); const kBefore = +(/^Accept (\d+) and start trial$/.exec(bp.bulk.activateLabel) || [])[1];
  click(G, cr.h, 'Add parameter', { where: { id: CCT } });
  ok(G, 'the sheet "Tank height · CCT"', lastSheet().title === 'Tank height · CCT', lastSheet().title);
  const D = W.V7OBJ._test.getDP(); D.value = '3.5'; typed(1);
  const dpv = V.designParamPreview(DP, { kind: 'up', id: CCT }, 'tankHeight', 3.5); const dt = dialog(G, W.V7OBJ._test.dpBody(D), 'Tank height sheet');
  ok(G, 'preview "LVL-CCT: Caution none → 85% (3.0 m) · Major none → 95% (3.3 m) · 1 gap resolved"', dpv.lines.every((l) => has(dt, l)) && dpv.lines.some((l) => /LVL-CCT: Caution none → 85% \(3\.0 m\) · Major none → 95% \(3\.3 m\)/.test(l)) && /1 gap resolved/.test(dpv.lines.join(' ')), dpv.lines.join(' | '));
  click(G, sheetHtml(), 'Save');
  ok(G, 'toast "Tank height 3.5 m saved on CCT · 1 reading re-resolved" with Undo; Can\'t resolve 2', /^Tank height 3\.5 m saved on CCT · 1 reading re-resolved/.test(lastToast()) && typeof toastObj().o.undo === 'function' && V.bindingsPass(DP).counts.cantResolve === 2, lastToast());
  bp = V.bindingsPass(DP); const k = +(/^Accept (\d+) and start trial$/.exec(bp.bulk.activateLabel) || [])[1];
  ok(G, `the bulk count grew by one (${kBefore} → ${k})`, k === kBefore + 1 && has(text(render(`#/p/${DP}/review/bindings`)), bp.bulk.activateLabel), `${kBefore} → ${bp.bulk.activateLabel}`);
  const issueTriggersBefore = V.alerts(DP, {}).filter((a) => V.alertState(DP, a.id) === 'active').length;
  /* (5) Accept k and start the trial */
  p = page(G, `#/p/${DP}/review/bindings`);
  click(G, p.h, bp.bulk.activateLabel);
  const m = /^Accepted (\d+) and started the trial: (\d+) Triggers? now records? trial firings\. Commissioning · nothing is sent\.$/.exec(lastToast());
  ok(G, `toast "Accepted ${k} and started the trial: {t} Triggers now record trial firings. Commissioning · nothing is sent."`, !!m && +m[1] === k && +m[2] === V.alerts(DP, {}).filter((a) => V.alertState(DP, a.id) === 'active').length - issueTriggersBefore, `${lastToast()} · active Issue Triggers ${issueTriggersBefore} → ${V.alerts(DP, {}).filter((a) => V.alertState(DP, a.id) === 'active').length}`);
  p = page(G, `#/p/${DP}/review/bindings`);
  ok(G, 'accepted rows read "Active · trial"', has(p.t, 'Active · trial'));
  const r = page(G, `#/p/${DP}`); const gap = V.checklist(DP).gaps.find((x) => x.id === 'nolimits');
  ok(G, 'Readiness shows the gap "2 readings have no limits: they raise nothing (tank height missing on TWT, UFWT)"', !!gap && gap.text === '2 readings have no limits: they raise nothing (tank height missing on TWT, UFWT)' && has(r.t, gap.text), gap && gap.text);
  /* the library files sludge-pump Tasks on Tube settling while the sludge recirculation pumps sit in the MBBRs: once bound,
     TS-1's Tasks tab lists them although no pump takes part in TS-1 (before the bindings pass it reads "No Tasks") */
  const TS1 = nodeId(DP, 'TS-1'); const ts1 = page(G, `#/p/${DP}/up/${TS1}/tasks`);
  ok(G, 'TS-1 has no participants, yet its Tasks tab lists the sludge-pump Tasks the library files on Tube settling', V.unitProcess(DP, TS1).participants.length === 0 && /Sludge pump/.test(ts1.t), ts1.t.slice(0, 300));
}

/* ── chapter 4 · Readiness (DigitalPaani) ──────────────────────────────────────────────────────────────── */
chapter(4);
{
  const G = '4 readiness';
  let r = page(G, `#/p/${DP}`); let cl = V.checklist(DP);
  ok(G, `chips "STP · Commissioning · nothing is sent · Real plant graph · ${cl.blockersChip.text}"`, has(r.t, 'STP Commissioning · nothing is sent Real plant graph') && has(r.t, cl.blockersChip.text) && cl.blockers.length === 3, cl.blockersChip.text);
  const tr = V.checklist(DP).tracks;
  const dpStep = tr.structure.steps.find((s) => /Design parameters/.test(s.label));
  ok(G, 'Structure: every step ✓ but Design parameters, which needs attention for the two tank heights the gap names; Bindings "Day 1 · …"; People "! No people yet"', tr.structure.steps.every((s) => s === dpStep || s.mark === 'done') && !!dpStep && dpStep.mark === 'attention' && /TWT/.test(dpStep.text) && /UFWT/.test(dpStep.text) &&tr.bindings.steps.some((s) => /^Day 1 · /.test(s.text)) && tr.people.steps.some((s) => s.mark === 'attention' && s.text === 'No people yet'), J(['structure', 'bindings', 'people'].map((k) => tr[k].steps.map((s) => s.mark + ' ' + s.label + ': ' + s.text))));
  ok(G, 'the blockers "No Operator with a verified phone…", "No Lead with a verified phone…", "2 drafts are undecided"', J(cl.blockers.map((b) => b.text)) === J(['No Operator with a verified phone: nobody would be notified', 'No Lead with a verified phone: nobody would be notified', '2 drafts are undecided']) && cl.blockers.every((b) => has(r.t, b.text)), J(cl.blockers.map((b) => b.text)));
  const nopm = cl.gaps.find((g) => g.id === 'nopm');
  ok(G, 'the gaps include the 2 readings with no limits and the pieces of equipment without a maintenance programme', cl.gaps.some((g) => g.id === 'nolimits') && (!nopm || /pieces of equipment without a maintenance programme: a planning gap, not a safety failure$/.test(nopm.text)) && cl.gaps.every((g) => has(r.t, g.text)));
  ok(G, 'footer "Go live needs Full Admin" and the disabled "Go live · 3 blockers left"', has(r.t, 'Go live needs Full Admin') && cl.buttonLabel === 'Go live · 3 blockers left' && new RegExp(`<button[^>]*disabled[^>]*>${esc(cl.buttonLabel)}</button>`).test(r.h));
  /* (2) People › Add a person: Ravi Kumar, Operator */
  let pp = page(G, `#/p/${DP}/people`);
  click(G, pp.h, 'Add a person', { where: { plant: DP } });
  dialog(G, sheetHtml(), 'Add a person sheet');
  click(G, sheetHtml(), 'Save', { fields: { name: 'Ravi Kumar', role: 'l1', phone: '+91 90000 40001', channel: 'wa', grant: '' } });
  const ravi = V.people(DP).find((x) => x.name === 'Ravi Kumar');
  const rowOf = (hh, name) => text((hh.match(new RegExp(`<tr[^>]*>(?:(?!</tr>)[\\s\\S])*${name}[\\s\\S]*?</tr>`)) || [''])[0]);
  pp = page(G, `#/p/${DP}/people`);
  ok(G, 'Ravi Kumar, Operator, "+91 90000 40001", WhatsApp → "Not verified" with "Send code"', !!ravi && ravi.role === 'l1' && /Not verified/.test(rowOf(pp.h, 'Ravi Kumar')) && /Send code/.test(rowOf(pp.h, 'Ravi Kumar')), rowOf(pp.h, 'Ravi Kumar'));
  click(G, pp.h, 'Send code', { where: { id: ravi.id } }); pp = page(G, `#/p/${DP}/people`);
  ok(G, '"Code sent 09:00 · waiting" with "(sample) Ravi Kumar enters the code"', rowOf(pp.h, 'Ravi Kumar').includes(`Code sent ${V.fmtTime(V.now())} · waiting`) && rowOf(pp.h, 'Ravi Kumar').includes('(sample) Ravi Kumar enters the code'));
  click(G, pp.h, '(sample) Ravi Kumar enters the code'); pp = page(G, `#/p/${DP}/people`);
  ok(G, 'Ravi Kumar: "Verified"', /Verified/.test(rowOf(pp.h, 'Ravi Kumar')) && !/Not verified/.test(rowOf(pp.h, 'Ravi Kumar')));
  /* (3) Neha Sharma, Lead */
  click(G, pp.h, 'Add a person', { where: { plant: DP } });
  click(G, sheetHtml(), 'Save', { fields: { name: 'Neha Sharma', role: 'l3', phone: '+91 90000 40002', channel: 'wa', grant: '' } });
  const neha = V.people(DP).find((x) => x.name === 'Neha Sharma');
  click(G, render(`#/p/${DP}/people`), 'Send code', { where: { id: neha.id } });
  click(G, render(`#/p/${DP}/people`), '(sample) Neha Sharma enters the code');
  pp = page(G, `#/p/${DP}/people`);
  ok(G, '"1 Operator and 1 Lead can be reached: their phones are verified."', V.reachability(DP).text === '1 Operator and 1 Lead can be reached: their phones are verified.' && has(pp.t, V.reachability(DP).text), V.reachability(DP).text);
  /* (4) one blocker left: the two can't-resolve drafts; Accept as draft, then Leave inactive with a reason */
  cl = V.checklist(DP);
  ok(G, 'back on Readiness one blocker is left: the drafts', J(cl.blockers.map((b) => b.id)) === J(['drafts']) && has(text(render(`#/p/${DP}`)), cl.blockers[0].text), J(cl.blockers.map((b) => b.text)));
  const why = 'No tank height yet: the survey team measures it next week';
  V.bindingsPass(DP, { show: 'cantresolve' }).rows.forEach((row) => {
    click(G, render(`#/p/${DP}/review/bindings?show=cantresolve`), 'Accept as draft', { where: { pid: row.pid } });
    const aid = (V.bindingsPass(DP).rows.find((x) => x.pid === row.pid) || {}).alertId;
    click(G, render(`#/p/${DP}/review/bindings?show=draft`), 'Leave inactive', { where: { id: aid } });
    ok(G, `"Leave ${row.name} inactive?"`, lastModal().title === `Leave ${row.name} inactive?`, lastModal().title);
    dialog(G, modalHtml(), 'Leave inactive dialog');
    click(G, modalHtml(), /^Leave inactive$/, { fields: { reason: why } });
    ok(G, `${row.name} is inactive with the reason`, V.alertState(DP, aid) === 'inactive', V.alertState(DP, aid));
  });
  cl = V.checklist(DP); r = page(G, `#/p/${DP}`);
  ok(G, '"0 blockers", "No blockers. Gaps don\'t stop go-live." and "Go live" enabled', cl.canGoLive && has(r.t, '0 blockers') && has(r.t, 'No blockers. Gaps don\'t stop go-live.') && /<button[^>]*data-act="plant:golive"[^>]*>Go live<\/button>/.test(r.h), J(cl.blockers.map((b) => b.text)));
  click(G, r.h, 'Go live');
  const gp = V.goLivePreview(DP); const gt = dialog(G, modalHtml(), 'Go live: DigitalPaani');
  ok(G, 'open it and read it: "Trial: no Trigger fired" (the trial is minutes old)', /^Trial: no Trigger fired$/.test(gp.trial.text) && has(gt, gp.trial.text), gp.trial.text);
  click(G, modalHtml(), 'Not yet');
  ok(G, '"Not yet": DigitalPaani stays in Commissioning', V.state(DP) === 'commissioning' && !lastModal().open);
}

/* ── chapter 5 · trial and tuning (Vedanta) ────────────────────────────────────────────────────────────── */
chapter(5);
const LG = W.V7LEDGER;
{
  const G = '5 trial';
  ok(G, '"Take me there" is Level high · EQ-1', chapterHrefs[4] === `#/p/${VED}/trigger/a_3d`);
  const r = page(G, `#/p/${VED}`); const cl = V.checklist(VED);
  ok(G, `banner "${cl.trial.text}" with "Review them"`, cl.trial.text === 'Day 6 of trial · 12 Triggers active · 112 trial firings so far · 1 Trigger noisy' && has(r.t, cl.trial.text) && r.h.includes(`href="#/p/${VED}/triggers?sort=trial">Review them<`), cl.trial.text);
  const noisy = cl.gaps.find((g) => g.id === 'noisy');
  ok(G, 'the gap "1 Trigger is noisy in trial: Level high · EQ-1 (12.8 a day)"', !!noisy && noisy.text === `1 Trigger is noisy in trial: Level high · EQ-1 (${V.trialStats(VED, 'a_3d').perDay.toFixed(1)} a day)` && /\(12\.8 a day\)$/.test(noisy.text) && has(r.t, noisy.text), noisy && noisy.text);
  const tl = page(G, `#/p/${VED}/triggers?sort=trial`); const tt = V.trialTable(VED);
  ok(G, 'sorted by trial firings: Level high · EQ-1 12.8 ("Noisy · more than 10 a day"), DO low · SBR-1 5.9, pH low · EQ-1 0.2', tt[0].name === 'Level high · EQ-1' && tt[1].name === 'DO low · SBR-1' && tt[2].name === 'pH low · EQ-1' && tl.t.indexOf('Level high · EQ-1') < tl.t.indexOf('DO low · SBR-1') && tl.t.indexOf('DO low · SBR-1') < tl.t.indexOf('pH low · EQ-1') && has(tl.t, 'Noisy · more than 10 a day') && [tt[0], tt[1], tt[2]].every((x) => has(tl.t, x.perDayText)), tt.slice(0, 3).map((x) => `${x.name} ${x.perDayText}`).join(' | '));
  const lv = page(G, `#/p/${VED}/trigger/a_3d`); const ts = V.trialStats(VED, 'a_3d');
  ok(G, 'Level high · EQ-1: "Commissioning: nothing is sent. Firings below are trials only."', has(lv.t, 'Commissioning: nothing is sent. Firings below are trials only.'));
  ok(G, `the trial card "${ts.text}" with the noisy chip; the last row "still past the limit"`, ts.text === `Fired ${ts.count} times in ${ts.days.toFixed(1)} days · median ${ts.medianMin} min · peak 88%` && ts.count === 76 && has(lv.t, ts.text) && has(lv.t, 'Noisy · more than 10 a day') && has(lv.t, 'still past the limit'), ts.text);
  const bands = V.triggerBands(VED, 'a_3d').bands;
  ok(G, 'its bands: "Follows sensor LVL-EQ-1 · Derived · 85% of tank height (4.5 m)"', has(lv.t, 'Follows sensor LVL-EQ-1 · Derived · 85% of tank height (4.5 m)') && !!bands.caution, J(bands.caution && bands.caution.chip));
  const dl = page(G, `#/p/${VED}/trigger/a_3r`); const ds = V.trialStats(VED, 'a_3r');
  ok(G, `DO low · SBR-1: "${ds.text}", no chip, no "mostly short" anywhere`, ds.text === `Fired ${ds.count} times in ${ds.days.toFixed(1)} days · median ${ds.medianMin} min · peak 1.58 mg/L` && ds.count === 35 && has(dl.t, ds.text) && !has(dl.t, 'Noisy · more than 10 a day') && !/mostly short/i.test(dl.t), ds.text);
  /* (5) the source link → the sensor page's Zones, [Override] on Caution */
  ok(G, 'Level high\'s band links to its sensor page, Caution highlighted', lv.h.includes(`href="#/p/${VED}/sensor/v_eq1_LVL?f=zone.above.caution"`));
  let s = page(G, `#/p/${VED}/sensor/v_eq1_LVL?f=zone.above.caution`);
  const t5 = { kind: 'zone', sensorId: 'v_eq1_LVL', dir: 'above', band: 'caution' };
  click(G, s.h, 'Override', { where: { target: J(t5) } });
  s = page(G, `#/p/${VED}/sensor/v_eq1_LVL?f=zone.above.caution`);
  const fk = LG._fk(VED, t5);
  ok(G, '"Why does this plant differ?" with five reasons, none chosen', has(s.t, 'Why does this plant differ?') && J(fieldsOf(s.h).filter((x) => x.act === 'ov:reason' && x.data.fk === fk).map((x) => x.value)) === J(['physical', 'regulatory', 'structural', 'tuning', 'temporary']));
  field(G, s.h, 'ov:reason', { fk, value: 'physical' }, 'physical', 'Physical');
  s = page(G, `#/p/${VED}/sensor/v_eq1_LVL?f=zone.above.caution`);
  ok(G, 'Physical: "Set the design parameter instead?" with [Set the design parameter] and [Override anyway]', has(s.t, 'Set the design parameter instead?') && has(s.t, 'Set the design parameter') && has(s.t, 'Override anyway'));
  field(G, s.h, 'ov:reason', { fk, value: 'tuning' }, 'tuning', 'Tuning');
  s = page(G, `#/p/${VED}/sensor/v_eq1_LVL?f=zone.above.caution`);
  field(G, s.h, 'ov:value', { fk }, '87', 'the value');
  field(G, s.h, 'ov:note', { fk }, 'Level swings with the batch pumps; 85% is reached on every fill', 'the note');
  s = page(G, `#/p/${VED}/sensor/v_eq1_LVL?f=zone.above.caution`);
  const bands87 = Object.assign({}, V.zoneInfo(VED, 'v_eq1_LVL', 'above').bands, { caution: 87 });
  const n87 = V.previewLimits(VED, 'v_eq1_LVL', 'above', bands87, { from: ts.since, to: V.now() }).count;
  ok(G, `"If you save": "Changes 1 Trigger: Level high · EQ-1." · "Trial so far: would have fired ${n87} times instead of ${ts.count}." (previewLimits over the trial)`, has(s.t, 'Changes 1 Trigger: Level high · EQ-1.') && has(s.t, `Trial so far: would have fired ${n87} ${n87 === 1 ? 'time' : 'times'} instead of ${ts.count}.`) && !has(s.t, 'Last 7 days'), (s.t.match(/If you save.{0,240}/) || [''])[0]);
  click(G, s.h, 'Save override', { where: { fk } });
  const rec = V.overrides({ plant: VED }).find((o) => o.target.kind === 'zone' && o.target.sensorId === 'v_eq1_LVL' && o.target.band === 'caution' && o.status === 'active');
  const rb = V.fmtDate(V.now() + 90 * DAY);
  ok(G, 'the chip "Override · Tuning · you · 29 Oct · review by 27 Jan"', !!rec && rec.value === 87 && rec.chip.text === `Override · Tuning · you · ${V.fmtDay(V.now()).replace(/^\w+ /, '')} · review by ${rb.replace(/ \d{4}$/, '')}` && rec.chip.text === 'Override · Tuning · you · 29 Oct · review by 27 Jan' && has(text(render(`#/p/${VED}/sensor/v_eq1_LVL`)), rec.chip.text), rec && rec.chip.text);
  /* (6) the noisy mark stays: trial firings are stored records */
  const r6 = page(G, `#/p/${VED}`); const n6 = V.checklist(VED).gaps.find((g) => g.id === 'noisy');
  ok(G, 'Readiness: the noisy gap is still there (stored firings), and the trial card still counts 76', !!n6 && has(r6.t, n6.text) && V.trialStats(VED, 'a_3d').count === ts.count);
}

/* ── chapter 6 · safety in commissioning (Vedanta) ─────────────────────────────────────────────────────── */
chapter(6);
{
  const G = '6 safety';
  ok(G, '"Take me there" is pH low · EQ-1', chapterHrefs[5] === `#/p/${VED}/trigger/a_3f`);
  const p = page(G, `#/p/${VED}/trigger/a_3f`); const ts = V.trialStats(VED, 'a_3f'); const em = ts.firings.find((f) => f.band === 'emergency');
  ok(G, 'the Commissioning banner', has(p.t, 'Commissioning: nothing is sent. Firings below are trials only.'));
  ok(G, `the trial card "${ts.text}"`, ts.text === 'Fired once in 5.9 days · median 60 min · peak pH 3.7' && has(p.t, ts.text), ts.text);
  const row = (ts.rows || [])[0] || {};
  ok(G, `one row: Start "${V.fmt(em.start)}" · End "${V.fmt(em.end)}" · Emergency · peak pH 3.7 · 60 min, chip "Emergency · nobody was told"`, ts.rows.length === 1 && V.fmt(em.start) === 'Wed 28 Oct, 15:10' && V.fmt(em.end) === 'Wed 28 Oct, 16:10' && has(p.t, row.startText) && has(p.t, row.endText) && has(p.t, row.peakText) && has(p.t, row.lengthText) && (row.chip && row.chip.text || row.chip) === 'Emergency · nobody was told' && has(p.t, row.chip && row.chip.text || row.chip), J(row));
  const z = V.zoneInfo(VED, 'v_eq1_PH', 'below').perBand.emergency;
  ok(G, 'the Emergency band\'s chip is the Physical override, base "Library: no rule"', z.source === 'override' && /^Override · Physical · /.test(z.chip.text) && z.chip.small === 'Library: no rule' && has(text(render(`#/p/${VED}/sensor/v_eq1_PH`)), z.chip.text), J(z.chip));
  const is = page(G, `#/p/${VED}/issues`);
  ok(G, '"No Issues. While Vedanta ETP is in Commissioning, Triggers record trial firings only, at every severity: nothing is sent." + "See the trial firings"', V.issues(VED, {}).length === 0 && has(is.t, 'No Issues. While Vedanta ETP is in Commissioning, Triggers record trial firings only, at every severity: nothing is sent.') && has(is.t, 'See the trial firings'));
  const pe = page(G, `#/p/${VED}/people`);
  ok(G, 'People › Routing: "Commissioning: nothing is sent. This is who will be told from go-live."; Priya Nair still "Not verified"', has(pe.t, 'Commissioning: nothing is sent. This is who will be told from go-live.') && /Priya Nair[\s\S]{0,200}Not verified/.test(pe.t));
}

/* ── chapter 7 · go live (Vedanta) ─────────────────────────────────────────────────────────────────────── */
chapter(7);
{
  const G = '7 go live';
  let r = page(G, `#/p/${VED}`); let cl = V.checklist(VED);
  ok(G, '"1 blocker": "1 draft is undecided: MLSS low · SBR-1" with [Decide]; "Go live · 1 blocker left" disabled', has(r.t, '1 blocker') && cl.blockers.length === 1 && cl.blockers[0].text === '1 draft is undecided: MLSS low · SBR-1' && has(r.t, cl.blockers[0].text) && cl.buttonLabel === 'Go live · 1 blocker left' && new RegExp(`<button[^>]*disabled[^>]*>${esc(cl.buttonLabel)}</button>`).test(r.h));
  optional(() => {
    const sd = page(G, `#/p/${VED}/people/service-dates`); const s = V.serviceDates(VED); const bl1 = s.rows.find((x) => x.tag === 'BL-1');
    ok(G, `"Enter dates": "${s.counterText}"`, s.counterText === 'Entered for 4 of 11 pieces of equipment · If you went live now, 51 of 73 scheduled Tasks would fall due on go-live day.' && has(sd.t, s.counterText), s.counterText);
    ok(G, 'BL-1: 9 PM Tasks, "Mon 19 Oct", "1 on go-live day, 8 later · earliest Fri 13 Nov"', !!bl1 && bl1.pmTasks === 9 && bl1.dateText === 'Mon 19 Oct' && bl1.preview.text === '1 on go-live day, 8 later · earliest Fri 13 Nov' && has(sd.t, bl1.preview.text), J(bl1 && bl1.preview));
  });
  ok(G, '[Decide] opens the bindings pass on the undecided row', r.h.includes(`href="#/p/${VED}/review/bindings?show=undecided">Decide<`));
  let b = page(G, `#/p/${VED}/review/bindings?show=undecided`); const bp = V.bindingsPass(VED, { show: 'undecided' });
  const tr = text((b.h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*MLSS low · Issue → SBR-1[\s\S]*?<\/tr>/) || [''])[0]);
  ok(G, 'row "MLSS low · Issue → SBR-1 · reads MLSS-SBR-1 | Minor < 2,000 mg/L (Library) · Persistence 5 min (Library) | Undecided"', V.bindingsPass(VED).counts.undecided === 1 && /reads MLSS-SBR-1/.test(tr) && /Minor < 2,000 mg\/L Library/.test(tr) && /Persistence 5 min Library/.test(tr) && /Undecided/.test(tr), tr);
  click(G, b.h, bp.bulk.activateLabel);
  ok(G, 'toast "Accepted 1 and started the trial: 1 Trigger now records trial firings. Commissioning · nothing is sent."', lastToast() === 'Accepted 1 and started the trial: 1 Trigger now records trial firings. Commissioning · nothing is sent.', lastToast());
  b = page(G, `#/p/${VED}/review/bindings`);
  ok(G, 'the row reads "Active · trial"', /Active · trial/.test(text((b.h.match(/<tr[^>]*>(?:(?!<\/tr>)[\s\S])*MLSS low · Issue → SBR-1[\s\S]*?<\/tr>/) || [''])[0])));
  r = page(G, `#/p/${VED}`); cl = V.checklist(VED);
  ok(G, `Readiness: "0 blockers", banner "${cl.trial.text}"`, cl.canGoLive && has(r.t, '0 blockers') && /^Day 6 of trial · 13 Triggers active · /.test(cl.trial.text) && has(r.t, cl.trial.text), cl.trial.text);
  click(G, r.h, 'Go live');
  const pv = V.goLivePreview(VED); const m = lastModal(); const gt = dialog(G, modalHtml(), 'Go live: Vedanta ETP');
  const lis = (m.body.match(/<ol class="p7-changes">([\s\S]*?)<\/ol>/) || ['', ''])[1].match(/<li[\s\S]*?<\/li>/g) || [];
  ok(G, 'the modal "Go live: Vedanta ETP" · "From now on:" with four lines, the first loud', m.title === 'Go live: Vedanta ETP' && has(gt, 'From now on:') && lis.length === 4 && /^<li class="p7-loud">/.test(lis[0]) && has(text(lis[0]), 'Triggers create Issues and notify the plant\'s people, including Emergency calls and the hooter') && has(text(lis[3]), 'Changing structure will need a reason'));
  ok(G, `the Tasks sub-line "${pv.lines[1].sub}"`, pv.lines[1].sub === `${pv.tasks.dueToday} of ${pv.tasks.scheduled} scheduled Tasks fall due today. Service dates were entered for ${pv.lastService.entered} of ${pv.lastService.total} pieces of equipment; ${pv.tasks.fromDates} Tasks count from them. After today, about ${pv.tasksPerDay} Tasks a day.` && pv.tasks.dueToday === 51 && pv.tasksPerDay === 59 && has(gt, pv.lines[1].sub), pv.lines[1].sub);
  ok(G, `"${pv.trial.text} · Review them" and "{g} gaps remain"`, pv.trial.text === 'Trial: 3 Triggers fired · 1 fired more than 10 times a day' && has(gt, `${pv.trial.text} · Review them`) && has(gt, `${V.checklist(VED).gaps.length} gaps remain`), (gt.match(/Trial:.{0,200}/) || [''])[0]);
  click(G, modalHtml(), 'Go live');
  ok(G, `toast "Vedanta ETP is Live. Issues and notifications started at ${V.fmtTime(V.now())}."; home = Coverage; "Live since …"`, V.state(VED) === 'live' && lastToast() === `Vedanta ETP is Live. Issues and notifications started at ${V.fmtTime(V.now())}.` && /<a class="tab on" href="#\/p\/vedanta"[^>]*>Coverage</.test(render(`#/p/${VED}`)) && has(text(render(`#/p/${VED}`)), `Live since ${V.fmtDay(V.now())}`), lastToast());
  ok(G, 'All Plants shows Vedanta ETP Live', /Vedanta ETP[\s\S]{0,80}Live/.test(text(render('#/plants'))));
}

/* ── chapter 8 · live operation (Manesar) ──────────────────────────────────────────────────────────────── */
chapter(8);
{
  const G = '8 live';
  const iss0 = V.issues(MAN, {}).find((i) => i.alertId === 'a_do_at2' && i.status !== 'closed');
  ok(G, '"Take me there" is the open Issue on DO low · AT-2', !!iss0 && chapterHrefs[7] === `#/p/${MAN}/issue/${iss0.id}` && iss0.id === 'is_2z', chapterHrefs[7]);
  const ID = iss0.id;
  let p = page(G, `#/p/${MAN}/issue/${ID}`);
  ok(G, 'crumbs "All Plants › Manesar STP › Secondary › AT-2"; "Subject: AT-2 · Activated sludge"', has(p.t, 'All Plants › Manesar STP › Secondary › AT-2') && has(p.t, 'Subject: AT-2 · Activated sludge'));
  ok(G, `"${V.issueTerms(MAN, ID).text}"`, V.issueTerms(MAN, ID).text === 'Opened under: Major < 1.0 mg/L · persistence 0 min · clearing 15 min' && has(p.t, V.issueTerms(MAN, ID).text));
  ok(G, 'the frozen line', has(p.t, 'This Trigger is frozen while this Issue is open: changes on DO-AT2 show as Base moved on the Trigger until someone resyncs it.'));
  const flow = V.flowOf(iss0.diag.flowId);
  ok(G, 'question 1 answered Yes by Dheeraj Kumar at 07:50', iss0.diag.path.length === 1 && iss0.diag.path[0].by === 'Dheeraj Kumar' && V.fmtTime(iss0.diag.path[0].at) === '07:50' && has(p.t, `Is the blower running? · Dheeraj Kumar, 07:50 Yes`));
  /* (2) question 2: No */
  click(G, p.h, 'No', { where: { step: flow.steps[1].id } });
  let iss = V.issue(MAN, ID); const cause = V.causeOf(iss.diag.causeId);
  p = page(G, `#/p/${MAN}/issue/${ID}`);
  ok(G, 'root cause "Intake filter blocked" on BL-1: "Caused by BL-1", log "Caused by BL-1 (Blower; takes part in AT-2)"', !!cause && /Intake filter blocked/.test(cause.name) && iss.causedBy === 'bl1' && has(p.t, 'Caused by BL-1') && iss.log.some((l) => l.text === 'Caused by BL-1 (Blower; takes part in AT-2)') && has(p.t, 'Caused by BL-1 (Blower; takes part in AT-2)'));
  /* (3) the fix: the step naming a general Task opens "Blower suction filter cleaning" and returns */
  click(G, p.h, 'Start the fix');
  iss = V.issue(MAN, ID); const fix = V.flowOf(iss.fix.flowId);
  p = page(G, `#/p/${MAN}/issue/${ID}`);
  const lk = (p.h.match(/href="(#\/p\/manesar\/task\/[^"]+)"/) || [])[1] || '';
  ok(G, 'a fix step links "Open the Task: Blower suction filter cleaning"', iss.status === 'fixing' && has(p.t, 'Open the Task: Blower suction filter cleaning') && !!lk, lk);
  const back = decode(lk); const tk = page(G, back);
  ok(G, 'the Task page says it is part of the fix, with "Done: back to the Issue"', has(tk.t, 'Done: back to the Issue') && has(tk.t, 'Part of the fix for "DO low · AT-2"'));
  click(G, tk.h, 'Done: back to the Issue');
  iss = V.issue(MAN, ID);
  ok(G, '…which ticks that step and returns to the Issue', W.location.hash === `#/p/${MAN}/issue/${ID}` && iss.fix.done.length === 1, `${W.location.hash} ${J(iss.fix.done)}`);
  p = page(G, `#/p/${MAN}/issue/${ID}`);
  fix.steps.filter((s) => !iss.fix.done.map(String).includes(String(s.id))).forEach((s) => {
    const h = render(`#/p/${MAN}/issue/${ID}`);
    const b = s.type === 'question' ? actsOf(h).find((x) => x.act === 'work:fixstep' && x.data.step === String(s.id) && x.data.answer === 'No') : fieldsOf(h).find((x) => x.act === 'work:fixstep' && x.data.step === String(s.id));
    if (ok(G, `fix step ${fix.steps.indexOf(s) + 1} has its ${s.type === 'question' ? 'Yes / No' : 'tick box'}`, !!b)) act(b.act, b.data, { checked: true, tagName: s.type === 'question' ? 'BUTTON' : 'INPUT', type: s.type === 'question' ? 'button' : 'checkbox' });
  });
  ok(G, 'every fix step done: Verify', V.issue(MAN, ID).status === 'verifying', V.issue(MAN, ID).status);
  /* (4) the Trigger: frozen */
  const tg = page(G, `#/p/${MAN}/trigger/a_do_at2`);
  ok(G, 'the Trigger page: "1 open Issue · this Trigger\'s terms are frozen until it closes. …"; Persistence and Clearing "Override · frozen"', has(tg.t, '1 open Issue · this Trigger\'s terms are frozen until it closes. Changes on DO-AT2 and in the library show here as Base moved until you resync it.') && (tg.t.match(/Override · frozen/g) || []).length >= 2);
  ok(G, 'Minor\'s source link opens the sensor page on Minor', tg.h.includes(`href="#/p/${MAN}/sensor/at2_do?f=zone.below.minor"`));
  /* (5) a zone override that skips the frozen Trigger */
  const t8 = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'minor' }; const fk = LG._fk(MAN, t8);
  let s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.minor`);
  click(G, s.h, 'Override', { where: { target: J(t8) } });
  s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.minor`);
  field(G, s.h, 'ov:reason', { fk, value: 'tuning' }, 'tuning', 'Tuning');
  s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.minor`);
  field(G, s.h, 'ov:note', { fk }, 'Short dips below 2.0 recover on their own; 1.5 is where the operators act', 'the note');
  field(G, s.h, 'ov:value', { fk }, '1.5', 'the value');
  s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.minor`);
  const pl = V.previewLimits(MAN, 'at2_do', 'below', Object.assign({}, V.zoneInfo(MAN, 'at2_do', 'below').bands, { minor: 1.5 }));
  ok(G, `"If you save": "Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved)." · "Last 7 days: would have fired ${pl.count} times (now ${pl.countNow})." (previewLimits) and the frozen line with "Close it as a false alarm"`, has(s.t, 'Changes 1 Trigger: DO low · AT-2 (frozen: it will show Base moved).') && has(s.t, `Last 7 days: would have fired ${pl.count} ${pl.count === 1 ? 'time' : 'times'} (now ${pl.countNow}).`) && pl.count === 2 && pl.countNow === 3 && has(s.t, 'DO low · AT-2 has 1 open Issue: it is frozen and keeps 2.0. It will show Base moved until someone resyncs it.') && has(s.t, 'Close it as a false alarm'), (s.t.match(/If you save.{0,300}/) || [''])[0]);
  click(G, s.h, 'Save override', { where: { fk } });
  const tb = V.triggerBands(MAN, 'a_do_at2').bands.minor; const tg2 = page(G, `#/p/${MAN}/trigger/a_do_at2`);
  ok(G, 'the Trigger: Minor still 2.0 with "Frozen while 1 Issue is open" and "DO-AT2 now 1.5 (Override · Tuning)"', has(tg2.t, 'Frozen while 1 Issue is open') && tb.nowText === 'DO-AT2 now 1.5 (Override · Tuning)' && has(tg2.t, tb.nowText) && V.triggerTerms(MAN, 'a_do_at2').bands.minor === 2, tb.nowText);
  /* (6) +1 hour, Verify Yes → closed; the Trigger waits for a resync */
  act('ui:advance', { min: 60 });
  p = page(G, `#/p/${MAN}/issue/${ID}`);
  click(G, p.h, 'Yes: close the Issue');
  ok(G, '+1 hour, Verify "Yes" → closed', V.issue(MAN, ID).status === 'closed', V.issue(MAN, ID).status);
  const tg3 = page(G, `#/p/${MAN}/trigger/a_do_at2`);
  ok(G, 'the Trigger: "Base moved · this Trigger is still on the terms it was frozen on. DO-AT2 or the library changed since. [Resync with the sensor]"', V.heldOf(MAN, 'a_do_at2').waiting && has(tg3.t, 'Base moved · this Trigger is still on the terms it was frozen on. DO-AT2 or the library changed since.') && has(tg3.t, 'Resync with the sensor'));
  /* (7) optional: a structure change on a Live plant */
  optional(() => {
    const st = page(G, `#/p/${MAN}/structure`);
    ok(G, '"Outside any unit process (1)" with BS-1', has(st.t, 'Outside any unit process (1)') && has(st.t, 'BS-1'));
    click(G, st.h, /^Place in…$/, { where: { eq: 'bs1' } });
    act('st:dlg-up', { up: 'eq1' }, { checked: true, tagName: 'INPUT', type: 'checkbox' });
    const md = dialog(G, VST._mdHtml().body + VST._mdHtml().foot, 'Place BS-1');
    ok(G, '"Reason (required on a Live plant)", [Place in EQ-1] disabled until filled; preview "1 Trigger re-checked: Sump flooding · EQ-1"', has(md, 'Reason (required on a Live plant)') && /disabled/.test(VST._mdHtml().foot) && has(md, '1 Trigger re-checked: Sump flooding · EQ-1'));
    act('st:note', { scope: 'dlg', plant: MAN }, { tagName: 'TEXTAREA', value: 'The screen sits in EQ-1\'s inlet channel' });
    act('st:dlg-save');
    const f = V.structureFlag(MAN, 'a_flood'); const fl = page(G, `#/p/${MAN}/trigger/a_flood`);
    ok(G, 'toast "BS-1 placed in EQ-1"; Sump flooding shows "Structure changed …" with [Mark as checked]', lastToast() === 'BS-1 placed in EQ-1' && !!f && /^Structure changed /.test(f.line) && has(fl.t, 'Nothing in this Trigger\'s terms changed.') && has(fl.t, 'Mark as checked'), `${lastToast()} · ${f && f.line}`);
    act('st:undo', { plant: MAN, token: VST._state().last.token });
    ok(G, 'Undo: BS-1 is outside any unit process again', V.membershipOf(MAN, 'bs1').placement === 'notpart');
  });
}

/* ── chapter 9 · Coverage (Manesar, Bawal) ─────────────────────────────────────────────────────────────── */
chapter(9);
{
  const G = '9 coverage';
  let h = page(G, `#/p/${MAN}`); const cv = V.coverage(MAN); const t = cv.triggers;
  const tabs = text((h.h.match(/<nav class="tabs"[\s\S]*?<\/nav>/) || [''])[0]);
  ok(G, 'tabs "Coverage · Readings · Structure · Triggers · Issues · Tasks · People · Deviations · Activity"', /^Coverage Readings Structure Triggers Issues( \d+)? Tasks People Deviations Activity$/.test(tabs), tabs);
  ok(G, `Triggers card: Active ${t.active} · "${cv.window.label}" ${t.issues} · "Closed as false alarm" with "${t.closedText}" · Noisiest ${t.noisiest ? t.noisiest.name : '—'}`, t.active === 6 && has(h.t, `${t.active} Active`) && has(h.t, `${t.issues} ${cv.window.label}`) && has(h.t, `Closed as false alarm ${t.closedText}`) && (!t.noisiest || has(h.t, `${t.noisiest.name} Noisiest`)), J(t));
  ok(G, `"Drafts in the review queue: ${t.drafts}" with "Open the bindings pass"`, t.drafts === 80 && has(h.t, `Drafts in the review queue: ${t.drafts} Open the bindings pass`));
  const dc = V.deviations({ plant: MAN }).counts;
  ok(G, 'Deviations here: Overrides · Base moved · Past review from the ledger, "Open deviations"', has(h.t, `${dc.overrides} Overrides ${dc.basemoved} Base moved ${dc.pastreview} Past review`) && has(h.t, 'Open deviations'), J(dc));
  ok(G, 'Blind spots: "Arrives with Diagnostics: what must be known per unit process, how often, and what isn\'t covered."; "Gaps the plant runs with"', has(h.t, 'Arrives with Diagnostics: what must be known per unit process, how often, and what isn\'t covered.') && has(h.t, 'Gaps the plant runs with'));
  /* (2) a draft on a Live plant: Accept → Draft · never fires → Activate → the dialog → Not yet */
  let b = page(G, `#/p/${MAN}/review/bindings?show=undecided`);
  ok(G, 'row "Level high · Issue → EQ-1 · reads LVL-EQ1"', /Level high · Issue → EQ-1[\s\S]{0,40}reads LVL-EQ1/.test(b.t));
  click(G, b.h, 'Accept', { where: { pid: 'eq1|alert|Level high' } });
  const row = () => V.bindingsPass(MAN).rows.find((x) => x.pid === 'eq1|alert|Level high');
  ok(G, '→ "Draft · never fires"', row().status === 'draft' && /Draft · never fires/.test(text(render(`#/p/${MAN}/review/bindings?show=draft`))));
  b = page(G, `#/p/${MAN}/review/bindings?show=draft`);
  click(G, b.h, 'Activate', { where: { id: row().alertId } });
  const ap = V.activatePreview(MAN, row().alertId); const at = dialog(G, modalHtml(), 'Activate dialog');
  ok(G, 'modal "Activate Level high · EQ-1?": "… creates Issues and notifies the plant\'s people …", "It gets no trial first: a Live plant has none. …", the band lines; no "would have fired"', lastModal().title === 'Activate Level high · EQ-1?' && /creates Issues and notifies the plant's people/.test(at) && /It gets no trial first: a Live plant has none\./.test(at) && ap.bandLines.length > 0 && ap.bandLines.every((l) => has(at, l)) && !/would have fired/.test(at), lastModal().title);
  click(G, modalHtml(), 'Not yet');
  ok(G, '"Not yet": it stays a draft', V.alertState(MAN, row().alertId) === 'draft');
  /* (3) Return to Commissioning… → its computed lines → Not yet */
  h = page(G, `#/p/${MAN}`);
  click(G, h.h, 'Return to Commissioning…');
  const rp = V.returnPreview(MAN); const rt = dialog(G, modalHtml(), 'Return dialog');
  ok(G, 'the Return dialog lists its computed lines ("6 active Triggers record trial firings only …", "Scheduled Tasks stop: …", "To go live again, every draft must be decided: … are waiting.")', rp.lines.every((l) => has(rt, l.text)) && /^6 active Triggers record trial firings only/.test(rp.lines[0].text) && rp.lines.some((l) => /^Scheduled Tasks stop: \d+ upcoming Tasks won't come due/.test(l.text)) && rp.lines.some((l) => /^To go live again, every draft must be decided: \d+ are waiting\.$/.test(l.text)), J(rp.lines.map((l) => l.text)));
  ok(G, 'no open-Issue line now that chapter 8 closed it', !rp.lines.some((l) => /open Issue stays open/.test(l.text)));
  click(G, modalHtml(), 'Not yet');
  ok(G, '"Not yet": Manesar stays Live', V.state(MAN) === 'live');
  /* (4) Readings (Live only) */
  const rd = page(G, `#/p/${MAN}/readings`); const tab = V.readingsTab(MAN);
  ok(G, 'Readings: every plant-graph reading by equipment, "Reading · Now · Limits · Source · Triggers", the hand-test footer', tab.available && ['Reading', 'Now', 'Limits', 'Source', 'Triggers'].every((x) => has(rd.t, x)) && tab.groups.every((g) => has(rd.t, g.tag)) && has(rd.t, 'Hand tests and lab results keep their numbers in the task record: they have no limits. See Tasks.'));
  /* (5) Bawal */
  const bw = page(G, `#/p/${BAW}`); const g = V.coverage(BAW).gaps;
  ok(G, 'Bawal: the gap "1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1"', g.length === 1 && g[0].text === '1 Issue Trigger without a diagnostic flow: Chemical tank low · DT-1' && has(bw.t, g[0].text), J(g.map((x) => x.text)));
}

/* ── chapter 10 · a library change ─────────────────────────────────────────────────────────────────────── */
chapter(10);
{
  const G = '10 library';
  const MLSS = 'tpl_up_activated-sludge_mlss-low'; const DOLOW = 'tpl_up_activated-sludge_do-low';
  ok(G, '"Take me there" is MLSS low', chapterHrefs[9] === `#/library/templates/${MLSS}`);
  let p = page(G, `#/library/templates/${MLSS}`);
  ok(G, 'Downstream before editing', has(p.t, 'Downstream') && has(p.t, V.downstream(MLSS).before.sub));
  /* (2) Minor rule Constant 2000 → 2200 */
  field(G, p.h, 'tpl:field', { id: MLSS, band: 'minor', key: 'value' }, '2200', 'Minor limit rule');
  p = page(G, `#/library/templates/${MLSS}`);
  click(G, p.h, /^Save to the draft|^Save draft|^Save$/, { where: { id: MLSS } });
  const ds = V.downstream(MLSS); p = page(G, `#/library/templates/${MLSS}`);
  const lines = ds.fields.flatMap((f) => [f.heading].concat(f.groups.flatMap((gg) => [gg.head].concat(gg.items))));
  ok(G, 'Downstream: "Minor below: 2,000 → 2,200 mg/L"; "1 plant will update" → "Manesar STP · MLSS-AT2: 2,000 → 2,200 mg/L"; "1 plant will show base moved" → "Manesar STP · MLSS-AT1 keeps 2,500 (Override · Migrated)"', lines.every((x) => has(p.t, x)) && lines.includes('Minor below: 2,000 → 2,200 mg/L') && lines.includes('1 plant will update') && lines.includes('Manesar STP · MLSS-AT2: 2,000 → 2,200 mg/L') && lines.includes('1 plant will show base moved') && lines.includes('Manesar STP · MLSS-AT1 keeps 2,500 (Override · Migrated)'), lines.join(' | '));
  ok(G, '"0 pinned · hold at v1"; "Resolves to 2,200 mg/L at every plant (a constant)"; "A plant appears twice when its instances differ."', has(p.t, '0 pinned · hold at v1') && ds.resolves.some((r) => r.text === 'Resolves to 2,200 mg/L at every plant (a constant)') && ds.resolves.every((r) => has(p.t, r.text)) && has(p.t, 'A plant appears twice when its instances differ.'));
  ok(G, `"Version: Minor (suggested)" with Patch disabled; "${ds.publishLabel}"`, has(p.t, 'Version: Minor (suggested)') && /value="patch"[^>]*disabled/.test(p.h) && ds.publishLabel === 'Publish v2 to 1 plant' && has(p.t, ds.publishLabel));
  /* (3) the change note, Publish */
  field(G, p.h, 'tpl:pubfield', { id: MLSS, name: 'note' }, 'Plants run well down to 2,200; 2,000 opened Issues too late', 'change note');
  const allBefore = allActivity().length; const manBefore = V.activity({ plant: MAN }).length;
  click(G, render(`#/library/templates/${MLSS}`), ds.publishLabel, { where: { id: MLSS } });
  ok(G, 'toast "Published MLSS low v2 to 1 plant · 1 base moved"', lastToast() === 'Published MLSS low v2 to 1 plant · 1 base moved' && V.tplVersion(MLSS) === 2, lastToast());
  ok(G, 'All Plants Activity gets one line; Manesar\'s Activity none', allActivity().length === allBefore + 1 && V.activity({ plant: MAN }).length === manBefore);
  const z = V.zoneInfo(MAN, 'at1_mlss', 'below').perBand.minor;
  ok(G, 'MLSS-AT1 Minor shows "Base moved" with "Library changed 2,000 → 2,200 since you overrode it"', z.chip.text === 'Base moved' && z.chip.sub === 'Library changed 2,000 → 2,200 since you overrode it' && has(text(render(`#/p/${MAN}/sensor/at1_mlss`)), z.chip.sub), J(z.chip));
  /* (4) optional: a Forced try on DO low's Emergency band, discarded */
  optional(() => {
    let d = page(G, `#/library/templates/${DOLOW}`);
    field(G, d.h, 'tpl:field', { id: DOLOW, band: 'emergency', key: 'value' }, '0.8', 'Emergency limit rule');
    click(G, render(`#/library/templates/${DOLOW}`), /^Save to the draft|^Save draft|^Save$/, { where: { id: DOLOW } });
    const dd = V.downstream(DOLOW); d = page(G, `#/library/templates/${DOLOW}`);
    const ll = dd.fields.flatMap((f) => f.groups.flatMap((gg) => [gg.head].concat(gg.items)));
    ok(G, 'Forced: "Version: Forced (suggested)", "Why is this forced?"; "Manesar STP · DO-AT2: 0.5 → 0.8 mg/L" and the waiting Trigger reached on its Emergency band; DO-AT1 suspended', dd.suggestedKind === 'forced' && has(d.t, 'Version: Forced (suggested)') && has(d.t, 'Why is this forced?') && ll.includes('Manesar STP · DO-AT2: 0.5 → 0.8 mg/L') && ll.includes('Manesar STP · DO low · AT-2: Emergency 0.5 → 0.8 mg/L · its other terms still wait for a resync') && ll.includes('Manesar STP · DO-AT1') && has(d.t, 'Plant admins are told at Manesar STP.') && dd.publishLabel === 'Publish v2 to 1 plant', ll.join(' | '));
    click(G, d.h, 'Discard draft', { where: { id: DOLOW } }); click(G, modalHtml(), 'Discard draft');
    ok(G, 'Discard draft: DO low stays at v1', !V.templateDraft(DOLOW) && V.tplVersion(DOLOW) === 1);
  });
  /* (5) optional: a cadence change on a Blower PM template, discarded */
  optional(() => {
    const pm = V.templates({ owner: 'eq:BLW', kind: 'task' }).find((x) => x.every && x.every.unit && !x.runHours) || V.templates({ owner: 'eq:BLW', kind: 'task' })[0];
    let d = page(G, `#/library/templates/${pm.id}`);
    field(G, d.h, 'tpl:field', { id: pm.id, key: 'everyN' }, String(pm.every.n + 1), 'cadence');
    click(G, render(`#/library/templates/${pm.id}`), /^Save to the draft|^Save draft|^Save$/, { where: { id: pm.id } });
    const dd = V.downstream(pm.id, { countFrom: 'service' }); d = page(G, `#/library/templates/${pm.id}`);
    ok(G, 'cadence: Downstream offers "Count from the last service: {n} due now" / "Count from the publish date: first due in {interval}"', /Count from the last service: \d+ due now/.test(d.t) && /Count from the publish date: first due in /.test(d.t), J(dd.dueNow));
    click(G, d.h, 'Discard draft', { where: { id: pm.id } }); click(G, modalHtml(), 'Discard draft');
  });
  /* (6) finish: Resync DO low · AT-2 */
  const tg = page(G, `#/p/${MAN}/trigger/a_do_at2`);
  click(G, tg.h, 'Resync with the sensor');
  const rp = V.resyncPreview(MAN, 'a_do_at2'); const rt = dialog(G, modalHtml(), 'Resync dialog');
  ok(G, `modal "Resync DO low · AT-2?" with "Minor below 2.0 → 1.5 mg/L (Override · Tuning)" and "${rp.lastDaysText}"`, lastModal().title === 'Resync DO low · AT-2?' && rp.lines.includes('Minor below 2.0 → 1.5 mg/L (Override · Tuning)') && rp.lines.every((l) => has(rt, l)) && /^Last 7 days with these terms: would have fired \d+ times? \(now \d+\)\.$/.test(rp.lastDaysText) && has(rt, rp.lastDaysText), J(rp.lines));
  click(G, modalHtml(), 'Resync');
  ok(G, 'toast "Resynced DO low · AT-2 · now follows DO-AT2"', /^Resynced DO low · AT-2 · now follows DO-AT2/.test(lastToast()) && !V.heldOf(MAN, 'a_do_at2').waiting && V.triggerTerms(MAN, 'a_do_at2').bands.minor === 1.5, lastToast());
  /* (7) optional: a derived value moves (BL-1's motor rating), cancelled */
  optional(() => {
    const d = page(G, `#/p/${MAN}/eq/bl1/details`);
    click(G, d.h, /^(Edit|Change)$/, { where: { param: 'motorRating' } });
    const D = W.V7OBJ._test.getDP(); D.value = '18.5'; D.note = 'Nameplate checked: the motor was swapped for an 18.5 kW one';
    const pv = V.designParamPreview(MAN, { kind: 'eq', id: 'bl1' }, 'motorRating', 18.5); const dt = dialog(G, W.V7OBJ._test.dpBody(D), 'Motor rating sheet');
    ok(G, 'preview "AMP-BL1 keeps 44 A (Override): base moved 40.0 → 33.6 A" (Minor 42.0 → 35.3, Major 46.0 → 38.6), the intake filter\'s thresholds, "Motor current high · BL-1 follows AMP-BL1"', pv.lines.every((l) => has(dt, l)) && /AMP-BL1 keeps 44 A \(Override\): base moved 40\.0 → 33\.6 A/.test(pv.lines.join(' ')) && /Clean intake filter on BL-1 keeps 42 A \/ 38 A \(Override\)/.test(pv.lines.join(' ')) && /Motor current high · BL-1 follows AMP-BL1/.test(pv.lines.join(' ')), pv.lines.join(' | '));
    click(G, sheetHtml(), 'Cancel');
    ok(G, 'Cancel: BL-1 keeps 22 kW', V.designParams(MAN, { kind: 'eq', id: 'bl1' }).find((r) => r.key === 'motorRating').value === 22);
  });
}

/* ── chapter 11 · Deviations ───────────────────────────────────────────────────────────────────────────── */
chapter(11);
{
  const G = '11 deviations';
  ok(G, '"Take me there" is #/deviations', chapterHrefs[10] === '#/deviations');
  let p = page(G, '#/deviations'); let c = V.deviations({}).counts;
  ok(G, `chips "${c.overrides} overrides · ${c.basemoved} base moved · ${c.pastreview} past review · 0 Trigger limit overrides · 0 pinned · 2 single-use templates · ${c.structure} structure changes" from deviations().counts`, [`${c.overrides} overrides`, `${c.basemoved} base moved`, `${c.pastreview} past review`, '0 Trigger limit overrides', '0 pinned', '2 single-use templates', `${c.structure} structure changes`].every((x) => has(p.t, x)) && c.basemoved === 2, J(c));
  const d = V.deviations({});
  ok(G, 'base-moved groups first: "Activated sludge · MLSS low · Minor zone · library < 2,200 mg/L (v2)" then "Secondary clarification · Sludge blanket high · persistence · library 15 min (v2)"', d.groups[0].header === 'Activated sludge · MLSS low · Minor zone · library < 2,200 mg/L (v2)' && d.groups[1].header === 'Secondary clarification · Sludge blanket high · persistence · library 15 min (v2)' && p.t.indexOf(d.groups[0].header) < p.t.indexOf(d.groups[1].header), d.groups.slice(0, 2).map((x) => x.header).join(' | '));
  const bm = d.groups[1].rows[0];
  const bmRow = text((p.h.match(new RegExp(`<tr[^>]*data-ov="${bm.id}"[\\s\\S]*?</tr>`)) || [''])[0]);
  ok(G, 'the Manesar STP row "30 min · base moved 5 → 15 min · Migrated · 58 d" (Keep · Adopt the library value · Promote)', /30 min/.test(bmRow) && /base moved 5 → 15 min/.test(bmRow) && /Migrated/.test(bmRow) && /58 d/.test(bmRow) && /Keep/.test(bmRow) && /Adopt the library value/.test(bmRow) && /Promote/.test(bmRow), bmRow);
  /* (2) Adopt */
  click(G, p.h, 'Adopt the library value', { where: { id: bm.id } });
  ok(G, 'modal "The library changed this from 5 min to 15 min after you overrode it. Keep 30 min, or adopt 15 min?"', has(dialog(G, modalHtml(), 'Base moved dialog'), 'The library changed this from 5 min to 15 min after you overrode it. Keep 30 min, or adopt 15 min?'));
  const before = V.deviations({}).counts;
  click(G, modalHtml(), 'Adopt 15 min');
  c = V.deviations({}).counts;
  ok(G, 'toast "Manesar STP follows the library again: Sludge blanket high · SC-1 · persistence 15 min."; History +1', lastToast() === 'Manesar STP follows the library again: Sludge blanket high · SC-1 · persistence 15 min.' && c.history === before.history + 1, lastToast());
  /* (3) 1 past review → Extend */
  p = page(G, '#/deviations?show=pastreview'); const pr = V.deviations({ show: 'pastreview' });
  const sp = pr.groups[0].rows[0]; const spRow = text((p.h.match(new RegExp(`<tr[^>]*data-ov="${sp.id}"[\\s\\S]*?</tr>`)) || [''])[0]);
  ok(G, '"Pump · criticality tier · library B (v1)": "Manesar STP · C · B · Tuning · "Sludge can wait a day; nothing overflows while it is stopped" · 32 d"', pr.groups[0].header === 'Pump · criticality tier · library B (v1)' && /Manesar STP/.test(spRow) && /C · B/.test(spRow) && /Tuning · "Sludge can wait a day; nothing overflows while it is stopped"/.test(spRow) && /32 d/.test(spRow), spRow);
  click(G, p.h, 'Extend', { where: { id: sp.id } });
  field(G, modalHtml(), 'dev:m-note', null, 'Checked with the Lead: still true', 'Extend note');
  click(G, modalHtml(), 'Extend');
  ok(G, '"0 past review"', V.deviations({}).counts.pastreview === 0 && has(text(render('#/deviations')), '0 past review'));
  /* (4) Reason: Migrated */
  p = page(G, '#/deviations?reason=migrated'); c = V.deviations({}).counts; const mig = V.overrides({ reason: 'migrated' });
  ok(G, `"Reason: Migrated (${c.byReason.migrated})": rows "… · Migrated · 58 d" with "Set before 1 Sep 2026 · who: not recorded", review by 30 Nov 2026`, has(p.t, `Migrated (${c.byReason.migrated})`) && c.byReason.migrated === 14 && mig.every((o) => V.fmtDate(o.reviewBy) === '30 Nov 2026') && (p.t.match(/Set before 1 Sep 2026 · who: not recorded/g) || []).length >= mig.length, c.byReason.migrated);
  /* (5) a row → MLSS-AT1's sensor page, Minor highlighted */
  const ml = mig.find((o) => o.target.sensorId === 'at1_mlss');
  ok(G, 'a row opens MLSS-AT1\'s sensor page with Minor highlighted', ml.href === '#/p/manesar/sensor/at1_mlss?f=zone.below.minor' && p.h.includes(`href="${ml.href}"`) && /is-target/.test(render(ml.href)));
  const zc = V.zoneInfo(MAN, 'at1_mlss', 'below').perBand.minor;
  ok(G, 'its chip after chapter 10\'s publish is "Base moved" (the Migrated chip "Override · Migrated · not recorded · 1 Sep · review by 30 Nov" shows on every other Migrated row)', zc.chip.text === 'Base moved' && mig.filter((o) => o.id !== ml.id && !o.baseMoved).every((o) => o.chip.text === 'Override · Migrated · not recorded · 1 Sep · review by 30 Nov'), J(zc.chip));
  /* (6) Promote the DO-AT2 override */
  const do8 = V.overrides({ plant: MAN }).find((o) => o.target.kind === 'zone' && o.target.sensorId === 'at2_do' && o.target.band === 'minor' && o.status === 'active');
  p = page(G, '#/deviations');
  click(G, p.h, 'Promote', { where: { id: do8.id } });
  dialog(G, modalHtml(), 'Promote dialog');
  click(G, modalHtml(), /^Continue|^Make it the library default/);
  const tp = page(G, W.location.hash);
  ok(G, 'the template page: "Promoting Manesar STP\'s override: DO-AT2 · Minor zone 1.5 mg/L (library 2.0 mg/L). Check Downstream, then publish."', W.location.hash === `#/library/templates/tpl_up_activated-sludge_do-low?promote=${do8.id}` && has(tp.t, 'Promoting Manesar STP\'s override: DO-AT2 · Minor zone 1.5 mg/L (library 2.0 mg/L). Check Downstream, then publish.'), W.location.hash);
  /* (7) single-use templates: keep one */
  p = page(G, '#/deviations?show=singleuse');
  ok(G, '"Chemical refill · Task on CDU-1 (Dosing Pump) · every week · used at Manesar STP only · since 1 Sep 2026" and "Sludge wasting · Task on SP-1 (Pump) · …"', has(p.t, 'Chemical refill · Task on CDU-1 (Dosing Pump) · every week · used at Manesar STP only · since 1 Sep 2026') && has(p.t, 'Sludge wasting · Task on SP-1 (Pump) ·'));
  const cr = V.singleUse({ plant: MAN }).find((x) => x.name === 'Chemical refill');
  click(G, p.h, 'Keep single-use', { where: { id: cr.id } });
  ok(G, '"Kept single-use · 29 Oct 2026 · you"', has(text(render('#/deviations?show=singleuse')), `Kept single-use · ${V.fmtDate(V.now())} · you`));
  /* (8) DO-AT2 Major: Physical, Structural, then Temporary */
  const t11 = { kind: 'zone', sensorId: 'at2_do', dir: 'below', band: 'major' }; const fk = LG._fk(MAN, t11);
  let s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.major`);
  click(G, s.h, 'Override', { where: { target: J(t11) } });
  s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.major`);
  field(G, s.h, 'ov:reason', { fk, value: 'physical' }, 'physical', 'Physical');
  s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.major`);
  ok(G, 'Physical: "The library\'s limit rule for this band is a constant (1.0 mg/L): no design parameter changes it." — only "Override anyway"', has(s.t, 'The library\'s limit rule for this band is a constant (1.0 mg/L): no design parameter changes it.') && has(s.t, 'Override anyway') && !has(s.t, 'Set the design parameter'));
  field(G, s.h, 'ov:reason', { fk, value: 'structural' }, 'structural', 'Structural');
  s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.major`);
  ok(G, 'Structural: the variant box', has(s.t, 'Request a library variant for this trait?'));
  field(G, s.h, 'ov:reason', { fk, value: 'temporary' }, 'temporary', 'Temporary');
  s = page(G, `#/p/${MAN}/sensor/at2_do?f=zone.below.major`);
  const exp = new Date(V.now() + 7 * DAY + 330 * 60000).toISOString().slice(0, 10);
  field(G, s.h, 'ov:date', { fk, which: 'expires' }, exp, 'Expires on');
  field(G, s.h, 'ov:note', { fk }, 'BL-2 out for repair; DO runs lower until it is back', 'the note');
  field(G, s.h, 'ov:value', { fk }, '0.8', 'the value');
  click(G, render(`#/p/${MAN}/sensor/at2_do?f=zone.below.major`), 'Save override', { where: { fk } });
  const tmp = V.overrides({ plant: MAN }).find((o) => o.target.kind === 'zone' && o.target.sensorId === 'at2_do' && o.target.band === 'major' && o.status === 'active');
  p = page(G, '#/deviations'); const trow = (p.h.match(new RegExp(`<tr[^>]*data-ov="${tmp && tmp.id}"[\\s\\S]*?</tr>`)) || [''])[0];
  ok(G, 'the row "0.8 mg/L · 1.0 mg/L · Temporary · … · expires in 7 d" (Revert · Extend, no Promote)', !!tmp && tmp.reason === 'temporary' && /0\.8 mg\/L · 1\.0 mg\/L/.test(text(trow)) && /Temporary/.test(text(trow)) && /expires in 7 d/.test(text(trow)) && /dev:revert/.test(trow) && /dev:extend/.test(trow) && !/dev:promote/.test(trow), text(trow));
  /* (9) +1 week: it expires by itself */
  act('ui:advance', { min: 10080 });
  ok(G, 'the toast includes "1 override expired"', /1 override expired/.test(lastToast()), lastToast());
  const hh = page(G, '#/deviations?show=history');
  ok(G, 'the row moves to History ("Expired …")', /Expired/.test(text((hh.h.match(new RegExp(`<tr[^>]*data-ov="${tmp && tmp.id}"[\\s\\S]*?</tr>`)) || [''])[0])));
  ok(G, 'Activity "Temporary override expired: DO-AT2 · Major zone back to the library value 1.0 mg/L. Plant admins told."', V.activity({ plant: MAN }).some((a) => a.text === 'Temporary override expired: DO-AT2 · Major zone back to the library value 1.0 mg/L. Plant admins told.') && has(text(render(`#/p/${MAN}/activity`)), 'Temporary override expired: DO-AT2 · Major zone back to the library value 1.0 mg/L. Plant admins told.'));
}

/* ── chapter 12 · decisions ────────────────────────────────────────────────────────────────────────────── */
chapter(12);
{
  const G = '12 decisions';
  const p = page(G, '#/decisions'); const cards = W.V7_DECISIONS;
  ok(G, `#/decisions lists every card (${cards.length})`, cards.every((d) => p.h.includes(`id="${d.id}"`) || p.h.includes(`#/decisions/${d.id}"`) || has(p.t, d.id)));
  const d3 = page(G, '#/decisions/D3');
  ok(G, 'D3: "What v7/1 does (recommended approach)" and "What v7/2 does (Alex\'s model)", "You are here" on v7/2\'s; "See it in v7/1" opens window v7-1', has(d3.t, 'What v7/1 does (recommended approach)') && has(d3.t, 'What v7/2 does (Alex\'s model)') && has(d3.t, 'You are here') && /href="\.\.\/1\/prototype\.html#\/[^"]*"[^>]*target="v7-1"/.test(d3.h) && has(d3.t, 'See it in v7/1'));
  const before = W.V7DEC.answerOf('D3');
  const pick = fieldsOf(d3.h).find((x) => x.act === 'dec:pick') || actsOf(d3.h).find((x) => x.act === 'dec:pick');
  if (ok(G, 'D3 offers its options to pick', !!pick)) act('dec:pick', Object.assign({ id: 'D3' }, pick.data), { value: '0', tagName: pick.tag ? pick.tag.toUpperCase() : 'BUTTON', type: pick.type || 'button' });
  ok(G, '"Your call" is kept under ctl7.decisions', !!W.V7DEC.answerOf('D3') && /"D3"/.test(String(L.store.get('ctl7.decisions') || '')), J(W.V7DEC.answerOf('D3')));
  if (before) W.V7DEC.setAnswer('D3', before); else W.V7DEC.clearAnswer('D3');
}

mark('walk done');
/* ══════════ the walk's pages carried only handled acts ══════════ */
{
  const unhandled = [...SEEN_ACTS.keys()].filter((a) => typeof U._handlers[a] !== 'function');
  ok('wiring', `every act on the ${SEEN_ACTS.size ? 'pages and dialogs the walk opened' : 'pages'} has a handler (${SEEN_ACTS.size} acts)`, !unhandled.length && SEEN_ACTS.size > 50, unhandled.map((a) => `${a} (on ${SEEN_ACTS.get(a)})`).join(' | '));
}

mark('acts');
/* ══════════ 3. sweep: every plant's pages after the walk ══════════ */
{
  const bad = []; let n = 0;
  const sweep = (h) => {
    n++; let html = '';
    try { html = render(h); } catch (e) { bad.push(`${h}: throws ${e.message}`); return; }
    const b = smoke.scan(html, { ids: true, isData: DATA }).filter((f) => f.kind !== 'data-word');
    if (b.length) bad.push(`${h}: ${b[0].kind} ${b[0].word} (${b[0].ctx})`);
    if (/could not be shown/.test(html)) bad.push(`${h}: could not be shown`);
  };
  for (const p of V.plants()) {
    const k = p.key;
    ['', '/structure', '/review/structure', '/review/bindings', '/triggers', '/readings', '/issues', '/tasks', '/people', '/deviations', '/activity', '/details'].forEach((t) => sweep(`#/p/${k}${t}`));
    V.alerts(k, {}).slice(0, 12).forEach((a) => sweep(`#/p/${k}/trigger/${encodeURIComponent(a.id)}`));
    V.issues(k, {}).slice(0, 8).forEach((i) => sweep(`#/p/${k}/issue/${encodeURIComponent(i.id)}`));
    V.unitProcesses(k).slice(0, 4).forEach((u) => ['', '/issues', '/tasks', '/details'].forEach((t) => sweep(`#/p/${k}/up/${encodeURIComponent(u.id)}${t}`)));
    V.equipment(k).slice(0, 4).forEach((e) => ['', '/issues', '/tasks', '/details', '/phone'].forEach((t) => sweep(`#/p/${k}/eq/${encodeURIComponent(e.id)}${t}`)));
    V.sensors(k).slice(0, 4).forEach((s) => sweep(`#/p/${k}/sensor/${encodeURIComponent(s.id)}`));
    V.tasks(k, {}).slice(0, 6).forEach((t) => sweep(`#/p/${k}/task/${encodeURIComponent(t.id)}`));
  }
  ['#/plants', '#/activity', '#/library', '#/library/templates/tpl_up_activated-sludge_mlss-low', '#/library/up-types/activated-sludge', '#/deviations', '#/deviations?show=history'].forEach(sweep);
  ok('sweep', `${n} pages after the walk render clean`, !bad.length && n > 150, bad.slice(0, 6).join(' | '));
}

mark('sweep done');
/* ══════════ no dead link: every in-app link the walk saw, and a crawl from the top pages ══════════ */
{
  const NOTFOUND = APPS.NOTFOUND;
  const dead = []; const checked = new Set();
  const check = (h, from) => {
    if (checked.has(h)) return; checked.add(h);
    const m = U.match(h);
    const a = APPS.matchRoute(APPS.V72_ROUTES, h);
    if (!m || !a) { dead.push(`${h} (from ${from}): no route`); return; }
    const o = APPS.objectsOf72(a);
    if (o.problem) { dead.push(`${h} (from ${from}): ${o.problem}`); return; }
    const general = (q) => q.kind === 'task' && /General Task/.test(text(U.renderPath(h)));
    const miss = o.qs.filter((q) => !APPS.exists(V, '2', q) && !general(q));
    if (miss.length) { dead.push(`${h} (from ${from}): no ${miss.map((q) => q.kind + ' ' + q.id).join(', ')}`); return; }
    let out = ''; try { out = U.renderPath(h); } catch (e) { dead.push(`${h} (from ${from}): throws ${e.message}`); return; }
    if (NOTFOUND.test(text(out).slice(0, 300))) dead.push(`${h} (from ${from}): lands on a "not found" page`);
    return out;
  };
  [...SEEN_LINKS.entries()].forEach(([h, from]) => check(h, from));
  const walked = checked.size;
  /* a bounded crawl after a fresh reset: the top pages and every link they lead to, at most 25 pages per route */
  V.reset();
  const per = new Map(); const q = ['#/plants', '#/library', '#/deviations', '#/activity', '#/decisions'].concat(V.plants().map((p) => `#/p/${p.key}`)); const from = new Map(); const seen = new Set();
  let n = 0;
  while (q.length && n < 4000) {
    const h = q.shift(); if (seen.has(h)) continue; seen.add(h);
    const pat = (U.match(h) || {}).pattern || '?'; const c = per.get(pat) || 0; if (c >= 25) continue; per.set(pat, c + 1); n++;
    const before = checked.has(h); checked.delete(h);
    const out = check(h, from.get(h) || 'the top pages');
    if (before) checked.add(h);
    if (!out) continue;
    for (const l of smoke.links(out)) if (l.startsWith('#/') && !seen.has(l)) { if (!from.has(l)) from.set(l, h); q.push(l); }
  }
  ok('links', `no dead link: ${walked} links the walk's pages carried, and a crawl of ${n} pages from the top`, !dead.length && n > 400, dead.slice(0, 6).join(' | '));
}

mark('links done');
/* ══════════ reset restores the story's start ══════════ */
V.reset();
ok('reset', 'Reset the story: DigitalPaani back to its unconfirmed structure, Vedanta in Commissioning, MLSS low at v1, the clock at Thu 29 Oct, 09:00', V.state(VED) === 'commissioning' && !V.structureDone(DP) && V.tplVersion('tpl_up_activated-sludge_mlss-low') === 1 && V.fmt(V.now()) === 'Thu 29 Oct, 09:00' && V.issues(MAN, {}).some((i) => i.id === 'is_2z' && i.status !== 'closed') && !V.people(DP).length);
const soft = [...new Set(U._soft || [])];
ok('soft', 'no V7 call failed inside the shell during the walk', !soft.length, soft.slice(0, 4).join(' | '));

/* ══════════ 4. the action counts ══════════ */
{
  const out = { what: 'Presenter actions per story chapter in the end-to-end walk of v7/2: every button pressed (clicks) and every value typed or choice made in a field (fields), through the registered handlers. Following a link is not counted; a field left at its default is not counted; optional beats are counted apart.', chapters: {}, total: 0, optional: 0 };
  for (let n = 1; n <= 12; n++) { const c = COUNT.by[n] || { clicks: 0, fields: 0, optional: 0 }; out.chapters[n] = { count: c.clicks + c.fields, clicks: c.clicks, fields: c.fields, optional: c.optional }; out.total += c.clicks + c.fields; out.optional += c.optional; }
  ok('actions', 'every chapter was walked and counted', Object.keys(COUNT.by).length === 12, Object.keys(COUNT.by).join(','));
  const dir = path.join(__dirname, 'out'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'actions72.json'), JSON.stringify(out, null, 2) + '\n');
  ok('actions', 'tests/out/actions72.json written', fs.existsSync(path.join(dir, 'actions72.json')));
  if (VERBOSE) console.log('  actions: ' + Object.keys(out.chapters).map((k) => `${k}:${out.chapters[k].count}`).join(' · ') + ` · total ${out.total} (+${out.optional} optional)`);
}

report();
function report() {
  const groups = [...new Set(results.map((r) => r.group))];
  for (const g of groups) {
    const rs = results.filter((r) => r.group === g); const f = rs.filter((r) => !r.pass);
    console.log(`  ${f.length ? 'FAIL' : 'ok  '} ${g.padEnd(16)} ${rs.length - f.length}/${rs.length}`);
    for (const r of rs) if (VERBOSE || !r.pass) console.log(`       ${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${!r.pass && r.detail ? '\n            ' + String(r.detail).slice(0, 500) : ''}`);
  }
  console.log(`integrate72: ${results.length - fails}/${results.length} checks · ${fails ? 'RESULT: FAIL' : 'RESULT: PASS'}`);
  process.exit(fails ? 1 : 0);
}
