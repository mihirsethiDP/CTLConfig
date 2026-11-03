/* v7/2 · ui7.js · window.V7UI — UI kit, router, shell, story panel, All Plants, Activity.

   Loads after the core files (window.V7) and before the page modules. Reads V7 lazily and defensively: every call into
   V7 goes through safe(), so a missing or failing core function degrades the page instead of blanking it (the
   smoke harness lists those as soft errors).

   KIT (pure string builders; text is escaped unless it already contains markup, so chip()/link() html can be passed)
     esc(s) · txt(s) (escape plain text, pass html through) · h(tag, attrs, innerHtml)
     page({crumbs:[{label,href}], title, sub, chips:[html], actions:[html], tabs:[{id,label,href,count}], active, body, aside, banner})
     chip(text,{tone, title, href, mono})   value-source tones: lib der ovr moved susp forced pin prop gap frozen next single
       review; older names still work (form → der, changed → ovr, libchanged → moved, none → gap); other tones: ok warn bad
       info sample muted. "Base moved" (moved) is the only chip with an amber fill.
     sourceChip(x) renders where a value comes from, always visible: x is a chip {text, tone, sub, small, extra}, a value
       record carrying one as x.chip, a record V7.chipFor understands, a tone word or a chip text. The sub line and the
       small line ("Library: 2.0 mg/L") show under the chip, never only on hover. chipHtml(chip) is the same for a chip.
     stateChip(state, {since, plant, phase, short}) → "Commissioning · nothing is sent" · "Live since Tue 1 Sep" ·
       "Draft · never fires" · "Active · trial" (active at a Commissioning plant, or phase 'trial') · "Active" · "Inactive"
     sampleTag() · sev(band) · bandName(band) · BANDS
     bandBar({dir:'above'|'below', bands:{caution,minor,major,emergency}, value, valid:[min,max], unit, compact})
     bandOf(value, dir, bands) → deepest band crossed or null
     table({cols:[{label,key,cls,render(row)}], rows, empty, cls, scroll})   rows: objects (or arrays); row._href (or row.href) makes it a link
                                                                             cells are html-or-text (see txt)
     card({title, sub, body, actions:[html], tone:'bad'|'warn'|'ok'|'info'|'quiet', id, cls, foot})
     section(title, body, {sub, actions}) · kv([[k,v]]) · list(items) (items: html or {title, sub, href, right, chips, tone})
     empty(text, actionHtml) · note(text, tone) · banner(text,{tone, action}) · stats([{value,label,tone}])
     filters([{label, href|act, data, on, count}]) · progress(done,total) · field({label, hint, html}) · radios({name, options:[{value,label,sub}], value, act})
     btn(label,{href, act, data, kind:'primary'|'secondary'|'ghost'|'danger', disabled, title, small, id})
     link(label, href, {target, cls, title}) adds a quiet " (opens v7/1)" when the link goes to the other prototype
     phone(innerHtml, {caption}) · num(v, unit) · plural(n, one, many) · fmt(ms) · fmtDay(ms) · plantName(key)
   DOM (stateful; no-ops when there is no document)
     openSheet({title, sub, body, foot, onBind(el), onClose, wide}) · refreshSheet({title?, sub?, body?, foot?}) · closeSheet() · sheetEl()
     modal({title, sub, body, foot, onBind(el), onClose, wide}) · closeModal() · confirm({title, body, ok, kind, onOk})
     toast(text, {undo: fn, ms}) · an Undo button while the toast shows (10 s when it can undo) · copy(text) → Promise<boolean> · addCss(href)
   EVENTS  buttons carry data-act="name" + data-*; modules register V7UI.on('name', (el, ev) => …). The shell delegates
     clicks (and change events; input events too when the field has data-live) and then persists and re-renders the
     page, unless the handler returns false. Forms with data-act are handled on submit. Rows with data-href navigate.
     Built-in actions: ui:close (data-what=sheet|modal), ui:story, ui:clock, ui:advance (data-min), ui:reset, ui:confirm,
     undo:activity (data-plant, data-token: Undo on an Activity line).
   ROUTER  route(pattern, renderFn) e.g. 'p/:plant/eq/:id/:tab?' → renderFn(params) returns an html string.
     params also carry _q (query object from '?a=b') and _path. The most literal match wins. Unknown → All Plants.
     Every routed page gets window.V7DEC.markerHtml(V7_VARIANT, _path) (the decisions strip) right after its page
     header, before the tabs; an alias route gets the strip of the page it renders. route().fn is that wrapper,
     route().raw the module's own renderFn.
     go(hash) · render() · current() → {path, params, pattern} · match(path) · routes() · renderPath(path) · afterRender(fn)
   SHELL   start() boots V7, builds the top bar + story panel and renders. chromeHtml() returns that html (for tests).
     The top bar carries a badge naming this prototype ("v7/2 · Alex's model as drafted", to the v7 overview) and the
     link "Same place in v7/1 →", which opens the current chapter's moment in v7/1 in the window named v7-1.
   STORY   chapters() → the 12 chapters with live deep links and their v7/1 compare links; chapterOf(path) → 1…12 or 0;
     samePlaceHref(path) → the v7/1 link the top bar shows on that page.
   PAGES   #/plants (default), #/activity/:plant?, #/p/:plant/activity.                                                   */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const V = () => W.V7 || null;

  /* ── small helpers ─────────────────────────────────────────────────────────────────────────────────────── */
  const SOFT = [];                                  // caught errors from V7 calls (smoke reports them)
  function safe(fn, fb) {
    try { const v = fn(); return v === undefined || v === null ? fb : v; }
    catch (e) { SOFT.push(String(e && e.message || e)); if (SOFT.length > 200) SOFT.shift(); return fb; }
  }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return s == null ? '' : String(s).replace(/[&<>"']/g, (c) => ESC[c]); }
  const TAG_RE = /<\/?[a-z][a-z0-9-]*(\s[^<>]*)?\/?>/i;
  function txt(s) {
    if (s == null || s === false) return '';
    if (typeof s === 'object') { if ('html' in s) return String(s.html); if ('text' in s) return esc(s.text); }
    s = String(s);
    return TAG_RE.test(s) ? s : esc(s);
  }
  function plain(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function attr(name, v) { return v == null || v === false || v === '' ? '' : v === true ? ` ${name}` : ` ${name}="${esc(v)}"`; }
  function kebab(k) { return String(k).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(); }
  function dataAttrs(data) { return data ? Object.keys(data).filter((k) => data[k] != null).map((k) => attr('data-' + kebab(k), String(data[k]))).join('') : ''; }
  function isNum(v) { return v !== null && v !== '' && v !== undefined && !isNaN(+v) && isFinite(+v); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function plural(n, one, many) { n = +n || 0; return `${n} ${n === 1 ? one : (many || one + 's')}`; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function num(v, unit) {
    if (!isNum(v)) return '—';
    v = +v; const a = Math.abs(v); let s;
    if (a >= 10000) s = Math.round(v).toLocaleString('en-IN');
    else if (a >= 100) s = String(Math.round(v));
    else if (a >= 10) s = String(Math.round(v * 10) / 10);
    else { const r2 = Math.round(v * 100) / 100; s = Math.abs(Math.round(r2 * 10) - r2 * 10) < 1e-9 ? r2.toFixed(1) : String(r2); }
    if (!unit) return s;
    if (unit === 'pH') return 'pH ' + s;   /* v7: pH reads "pH 7.01" everywhere, as core's fmtVal writes it */
    return unit === '%' ? s + '%' : s + ' ' + unit;
  }
  /* v7: a range end or a gauge's end tick: whole numbers stay whole ("0", "12,000"), like the limits beside them; the rest as num() */
  function numEnd(v, unit) {
    if (!isNum(v)) return '—'; v = +v; if (!Number.isInteger(v)) return num(v, unit);
    const s = Math.abs(v) >= 10000 ? v.toLocaleString('en-IN') : String(v);
    return !unit ? s : unit === 'pH' ? 'pH ' + s : unit === '%' ? s + '%' : s + ' ' + unit;
  }
  /* v7: one rate formatter and one duration formatter for every screen (Coverage, the alert page, All Plants):
     a rate keeps 1 decimal at 1 a day or more and 2 below ("0.33", "6.1", "13"); a duration is "1 h 49 min" (core's fmtDur) */
  function rate(x) { if (!isNum(x) || +x === 0) return '0'; x = +x; return x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100); }
  function dur(min) { if (!isNum(min)) return '—'; const v = W.V7; return v && v.fmtDur ? v.fmtDur(+min) : `${Math.round(+min)} min`; }
  /* v7: survey answers in plain words with units ("Motor rating 3.7 kW", "Length 9 m"), the same on every page */
  const FORM_Q = {
    'is over flow process': ['Overflow process'], 'shape': ['Shape'], 'length': ['Length', 'm'], 'width': ['Width', 'm'], 'depth / height': ['Depth', 'm'],
    'diffusers type': ['Diffusers'], 'type of diffusers': ['Diffusers'], 'moc (diffuser material)': ['Diffuser material'], 'installation & layout': ['Installation'],
    'motor rating(kw)': ['Motor rating', 'kW'], 'motor rating': ['Motor rating', 'kW'], 'rpm': ['Speed', 'rpm'], 'design flux': ['Design flux', 'L/m²/h'], 'design tmp': ['Design TMP', 'bar'],
    'type': ['Type'], 'vfd': ['VFD'], 'add remote control functionality?': ['Remote control'], 'size': ['Size', 'mm'], 'type of valve': ['Valve'], 'diameter': ['Diameter', 'm'],
    'height': ['Height', 'm'], 'auto valves': ['Auto valves'], 'dia': ['Diameter', 'm'], 'design flow rate': ['Design flow', 'm³/h'], 'obr': ['OBR'], 'type of membrane': ['Membrane'],
    'backwash cycle (in minutes)': ['Backwash cycle', 'min'], 'volume': ['Volume', 'm³'], 'agitator': ['Agitator'], 'plate size': ['Plate size', 'mm'], 'number of plates': ['Plates'],
    'poly dosing': ['Poly dosing'], 'air line provision': ['Air line'], 'maximum head': ['Maximum head', 'm'],
  };
  function formAnswer(q, v) {
    const k = String(q || '').trim().toLowerCase(); let m = FORM_Q[k];
    if (!m) { const unitIn = /\(([^)]+)\)\s*$/.exec(String(q)); const lab = String(q).replace(/\s*\([^)]*\)\s*$/, '').replace(/\?$/, '').trim(); const u = unitIn ? unitIn[1].replace(/^in\s+/i, '').replace(/^kw$/i, 'kW').replace(/^minutes$/i, 'min') : null; m = [lab.charAt(0).toUpperCase() + lab.slice(1).toLowerCase().replace(/\b(vfd|tmp|rpm|obr|moc)\b/g, (x) => x.toUpperCase()), u]; }
    const val = String(v == null ? '' : v).trim(); const bare = /^-?\d+(\.\d+)?$/.test(val);
    return `${m[0]} ${bare && m[1] ? `${val} ${m[1]}` : val}`;
  }
  function formAnswers(form) { if (!form || typeof form !== 'object') return []; return Object.keys(form).filter((q) => form[q] != null && form[q] !== '').map((q) => formAnswer(q, form[q])); }

  /* dates: V7's clock text when present, else the same format computed in IST */
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  function ist(ms) { return new Date(+ms + 330 * 60000); }
  function ownFmt(ms) { const d = ist(ms); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
  function ownDay(ms) { const d = ist(ms); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; }
  function ownTime(ms) { const d = ist(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
  function toMs(t) { if (t == null) return null; if (typeof t === 'number') return t; const n = Date.parse(t); return isNaN(n) ? null : n; }
  function fmt(ms) { ms = toMs(ms); if (ms == null) return '—'; const v = V(); return safe(() => v && v.fmt && v.fmt(ms), null) || ownFmt(ms); }
  function fmtDay(ms) { ms = toMs(ms); if (ms == null) return '—'; const v = V(); return safe(() => v && v.fmtDay && v.fmtDay(ms), null) || ownDay(ms); }
  function now() { const v = V(); return safe(() => v && v.now && v.now(), null) || Date.UTC(2026, 9, 29, 3, 30); }

  function plants() { const v = V(); return arr(safe(() => v && v.plants(), [])); }
  function plantOf(key) { return plants().find((p) => p.key === key) || null; }
  function plantName(key) { const p = plantOf(key); return p ? p.name : (key ? cap(key) : ''); }

  /* ── kit ───────────────────────────────────────────────────────────────────────────────────────────────── */
  const VOID = /^(br|hr|img|input|meta|link|col|wbr)$/i;
  function h(tag, attrs, inner) {
    const a = Object.keys(attrs || {}).map((k) => (k === 'data' && attrs[k] && typeof attrs[k] === 'object') ? dataAttrs(attrs[k]) : attr(k, attrs[k])).join('');
    if (VOID.test(tag)) return `<${tag}${a}>`;
    return `<${tag}${a}>${inner == null ? '' : Array.isArray(inner) ? inner.join('') : inner}</${tag}>`;
  }
  /* which prototype this is, and the other one: a link into the other one opens in its own named window and says so */
  const VERSIONS = { 1: ['v7/1', 'Recommended approach'], 2: ['v7/2', 'Alex\'s model as drafted'] };
  function variantNow() { return String(W.V7_VARIANT) === '1' ? '1' : '2'; }
  function otherVariant() { return variantNow() === '2' ? '1' : '2'; }
  function crossesTo(href, target) {
    const m = /^(?:\.\.\/)(1|2)\//.exec(String(href || '')) || /^v7-(1|2)$/.exec(String(target || ''));
    return m && m[1] !== variantNow() ? m[1] : null;
  }
  function link(label, href, o) {
    o = o || {};
    const to = crossesTo(href, o.target);
    const target = o.target || (to ? `v7-${to}` : null);
    return `<a href="${esc(href)}"${attr('class', o.cls)}${attr('title', o.title)}${attr('target', target)}>${txt(label)}${to && !o.bare ? `<span class="xv"> (opens ${esc(VERSIONS[to][0])})</span>` : ''}</a>`;
  }

  /* tones a chip can take; the older names stay usable so a page written for them still renders */
  const TONE_ALIAS = { form: 'der', changed: 'ovr', libchanged: 'moved', none: 'gap', library: 'lib', derived: 'der', override: 'ovr', basemoved: 'moved', suspended: 'susp', pinned: 'pin', proposed: 'prop', triggerOverride: 'ovr', followsSensor: 'lib', pastreview: 'review' };
  function toneOf(t) { if (!t) return t; return TONE_ALIAS[t] || TONE_ALIAS[String(t).toLowerCase()] || t; }
  function chip(text, o) {
    o = o || {};
    const tone = toneOf(o.tone);
    const cls = 'chip' + (tone ? ' chip-' + tone : '') + (o.mono ? ' mono' : '') + (o.cls ? ' ' + o.cls : '');
    if (o.href) return `<a class="${cls}" href="${esc(o.href)}"${attr('title', o.title)}>${txt(text)}</a>`;
    return `<span class="${cls}"${attr('title', o.title)}>${txt(text)}</span>`;
  }
  function sampleTag(text) { return chip(text || 'Sample readings', { tone: 'sample', title: 'Readings here are generated samples, not from the plant' }); }

  /* where a value comes from: the chip text names the source in words, so nothing about it hides in a hover title */
  const SRC_LABEL = {
    lib: 'Library', der: 'Derived', ovr: 'Override', moved: 'Base moved', susp: 'Suspended', forced: 'Forced by library', pin: 'Pinned',
    prop: 'Proposed', gap: 'Gap · no rule', frozen: 'Frozen', next: 'Next phase', single: 'Single-use', review: 'Past review',
  };
  const TEXT_TONE = [
    [/^Library ·/, 'lib'], [/^Follows sensor/, 'lib'], [/^Derived ·/, 'der'], [/^Override ·/, 'ovr'], [/^Overridden for this Trigger/, 'ovr'],
    [/^Base moved/, 'moved'], [/^Suspended/, 'susp'], [/^Forced by library/, 'forced'], [/^Pinned/, 'pin'], [/^Proposed/, 'prop'],
    [/^Gap ·/, 'gap'], [/^Frozen/, 'frozen'], [/^Next phase/, 'next'], [/^Single-use/, 'single'], [/^Past review/, 'review'],
  ];
  function toneFromText(s) { const t = String(s || '').trim(); const hit = TEXT_TONE.find(([re]) => re.test(t)); return hit ? hit[1] : null; }
  function isTone(x) { const t = toneOf(String(x || '')); return !!SRC_LABEL[t]; }
  function chipHtml(c, o) {
    if (c == null || c === '') return '';
    if (typeof c === 'string') { if (isTone(c)) { const t = toneOf(c); return chip(SRC_LABEL[t], { tone: t }); } return chip(c, { tone: toneFromText(c) || 'lib' }); }
    const tone = toneOf(c.tone) || toneFromText(c.text) || 'lib';
    const main = chip(c.text != null && c.text !== '' ? c.text : (SRC_LABEL[tone] || ''), { tone, title: o && o.title });
    const extra = arr(c.extra).map((x) => chipHtml(x)).filter(Boolean).join(' ');
    const sub = c.sub ? `<span class="src-sub">${txt(c.sub)}</span>` : '';
    const small = c.small ? `<small class="src-small">${txt(c.small)}</small>` : '';
    if (!sub && !small && !extra) return main;
    return `<span class="src"><span class="src-c">${main}${extra ? ' ' + extra : ''}</span>${sub}${small}</span>`;
  }
  function sourceChip(pb) {
    if (pb == null) return chipHtml({ text: SRC_LABEL.gap, tone: 'gap', sub: 'No value · this reading raises nothing' });
    if (typeof pb === 'string') return chipHtml(pb);
    if (pb.chip && typeof pb.chip === 'object') return chipHtml(pb.chip);
    if (typeof pb.text === 'string' && (pb.tone || toneFromText(pb.text))) return chipHtml(pb);
    if (typeof pb.chip === 'string' || pb.chipText) {
      const tone = isTone(pb.chip) ? toneOf(pb.chip) : (toneFromText(pb.chipText) || toneFromText(pb.chip) || 'lib');
      return chipHtml({ text: pb.chipText || (isTone(pb.chip) ? SRC_LABEL[tone] : pb.chip), tone, sub: pb.sub, small: pb.small });
    }
    const v = V();
    if ((pb.src || pb.source) && v && typeof v.chipFor === 'function') { const c = safe(() => v.chipFor(pb), null); if (c && c.text) return chipHtml(c); }
    return pb.value == null ? sourceChip(null) : chipHtml({ text: SRC_LABEL.lib, tone: 'lib' });
  }

  /* plant and Trigger states. A Trigger that is active at a Commissioning plant records trial firings only: "Active · trial" */
  const ST_TONE = { commissioning: 'comm', live: 'live', draft: 'draft', trial: 'trial', active: 'on', inactive: 'off' };
  const ST_ALIAS = { 'on trial': 'trial', ontrial: 'trial', 'active · trial': 'trial', 'active trial': 'trial', on: 'active', off: 'inactive', enabled: 'active', disabled: 'inactive' };
  function stateLabel(k, o) {
    const v = V(); const L = (v && v.LABELS && v.LABELS.triggerChip) || {};
    if (k === 'commissioning') return o.short ? 'Commissioning' : 'Commissioning · nothing is sent';
    if (k === 'live') { const since = toMs(o.since != null ? o.since : (o.plant && plantOf(o.plant) ? plantOf(o.plant).since : null)); return since != null && !o.short ? `Live since ${fmtDay(since)}` : 'Live'; }
    if (k === 'draft') return L.draft || 'Draft · never fires';
    if (k === 'trial') return L.trial || 'Active · trial';
    if (k === 'active') return L.live || 'Active';
    if (k === 'inactive') return L.inactive || 'Inactive';
    return cap(k || 'Unknown');
  }
  function stateChip(state, o) {
    o = o || {};
    let k = String(state || '').toLowerCase().replace(/_/g, ' ').trim(); k = ST_ALIAS[k] || k;
    if (k === 'active' && (o.phase === 'trial' || (o.plant && (plantOf(o.plant) || {}).state === 'commissioning'))) k = 'trial';
    const tone = ST_TONE[k] || 'off';
    return `<span class="chip st st-${tone}"${attr('title', o.title)}>${esc(stateLabel(k, o))}</span>`;
  }

  const BANDS = ['caution', 'minor', 'major', 'emergency'];
  const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency', ok: 'Inside limits' };
  function bandName(b) { return BAND_LABEL[String(b || '').toLowerCase()] || cap(b); }
  function sev(b) { const k = String(b || '').toLowerCase(); return `<span class="sev sev-${esc(k)}">${esc(bandName(k))}</span>`; }
  function bandOf(value, dir, bands) {
    if (!isNum(value) || !bands) return null;
    let hit = null;
    for (const b of BANDS) {
      const t = bands[b]; if (!isNum(t)) continue;
      if (dir === 'below' ? +value < +t : +value > +t) hit = b;
    }
    return hit;
  }

  /* The band bar: valid range as the track, a coloured region per band, the current value as a marker. */
  function bandBar(o) {
    o = o || {};
    const dir = o.dir === 'below' ? 'below' : o.dir === 'above' ? 'above' : null;
    const bands = o.bands || {};
    const unit = o.unit || '';
    const set = BANDS.filter((b) => isNum(bands[b])).map((b) => ({ b, t: +bands[b] }));
    const val = isNum(o.value) ? +o.value : null;
    const pts = set.map((x) => x.t).concat(val != null ? [val] : []);
    let lo; let hi;
    const valid = Array.isArray(o.valid) ? o.valid : null;
    if (valid && isNum(valid[0]) && isNum(valid[1]) && +valid[1] > +valid[0]) { lo = +valid[0]; hi = +valid[1]; }
    else if (pts.length) {
      const mn = Math.min(...pts); const mx = Math.max(...pts); const span = (mx - mn) || Math.abs(mx) || 1;
      lo = mn >= 0 ? Math.max(0, mn - span * 0.4) : mn - span * 0.4; hi = mx + span * 0.4;
    } else { lo = 0; hi = 1; }
    if (pts.length) { lo = Math.min(lo, ...pts); hi = Math.max(hi, ...pts); }
    if (hi <= lo) hi = lo + 1;
    const pos = (v) => clamp(((v - lo) / (hi - lo)) * 100, 0, 100);
    const regs = [];
    if (dir && set.length) {
      if (dir === 'above') {
        regs.push({ b: 'ok', a: lo, z: set[0].t });
        set.forEach((x, i) => regs.push({ b: x.b, a: x.t, z: i + 1 < set.length ? set[i + 1].t : hi }));
      } else {
        regs.push({ b: 'ok', a: set[0].t, z: hi });
        set.forEach((x, i) => regs.push({ b: x.b, a: i + 1 < set.length ? set[i + 1].t : lo, z: x.t }));
      }
    } else regs.push({ b: 'ok', a: lo, z: hi });
    const compact = !!(o.compact || o.mini);
    const where = val != null ? (bandOf(val, dir, bands) || 'ok') : null;
    /* v7: when the reading sits in a band, the gauge names that band on its marker ("Now 0.89 mg/L · Major") and no other band
       label shows, so a wider neighbouring region ("Minor") is never read as the band the reading is in */
    const inBand = !!(where && where !== 'ok');
    const regHtml = regs.map((r) => {
      const l = pos(Math.min(r.a, r.z)); const w = pos(Math.max(r.a, r.z)) - l;
      if (r.z < r.a || w <= 0) return '';
      const lab = !compact && !inBand && r.b !== 'ok' && w >= 11 ? `<i>${esc(bandName(r.b))}</i>` : '';
      return `<span class="bb-reg bb-${r.b}" style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%" title="${esc(bandName(r.b))}">${lab}</span>`;
    }).join('');
    let mark = '';
    if (val != null) {
      const p = pos(val); const al = p < 12 ? ' al-l' : p > 88 ? ' al-r' : '';
      mark = `<span class="bb-mark bb-at-${where}" style="left:${p.toFixed(2)}%">${compact ? '' : `<b class="${al.trim()}">Now ${esc(num(val, unit))}${inBand ? ` · ${esc(bandName(where))}` : ''}</b>`}</span>`;
    }
    let ticks = ''; let two = false;
    if (!compact) {
      // thresholds first (two rows when they crowd), then the range ends only where they fit on the first row
      const wOf = (s) => Math.max(5, s.length * 1.7);
      const tk = set.map((x) => ({ p: pos(x.t), s: num(x.t) })).sort((a, b) => a.p - b.p);
      const rows = [[], []]; const fits = (row, t) => row.every((o) => Math.abs(o.p - t.p) >= (wOf(o.s) + wOf(t.s)) / 2);
      tk.forEach((t) => { if (fits(rows[0], t)) rows[0].push(t); else rows[1].push(t); });
      [{ p: 0, s: numEnd(lo), end: true }, { p: 100, s: numEnd(hi), end: true }].forEach((t) => { if (fits(rows[0], t)) rows[0].push(t); });
      const tickHtml = (t, r2) => `<span class="bb-tick${t.end ? ' end' : ''}${r2 ? ' r2' : ''}${t.p < 4 ? ' al-l' : t.p > 96 ? ' al-r' : ''}" style="left:${t.p.toFixed(2)}%">${esc(t.s)}</span>`;
      two = rows[1].length > 0;
      ticks = `<div class="bb-ticks${two ? ' two' : ''}">${rows[0].map((t) => tickHtml(t, false)).join('')}${rows[1].map((t) => tickHtml(t, true)).join('')}</div>`;
    }
    const words = set.length ? `${dir === 'below' ? 'Falls below' : dir === 'above' ? 'Rises above' : 'Limits'}: ${set.map((x) => `${bandName(x.b)} ${num(x.t)}`).join(', ')}${unit ? ' ' + unit : ''}` : 'No limit for this reading';
    const label = `${words}.${val != null ? ` Now ${num(val, unit)}${where && where !== 'ok' ? `, in ${bandName(where)}` : ', inside the limits'}.` : ''}`;
    return `<div class="bb${compact ? ' bb-sm' : ''}${val != null && !compact ? ' has-val' : ''}${two ? ' bb-2' : ''}" role="img" aria-label="${esc(label)}"${compact ? attr('title', label) : ''}><div class="bb-track"><div class="bb-fill">${regHtml}</div>${mark}</div>${ticks}</div>`;
  }

  function cellHtml(v) {
    if (v == null || v === '') return '<span class="muted">—</span>';
    if (typeof v === 'number') return esc(isFinite(v) ? String(v) : '—');
    return txt(v);
  }
  function table(o) {
    o = o || {};
    const cols = arr(o.cols); const rows = arr(o.rows);
    if (!rows.length) return o.empty === false ? '' : empty(o.empty || 'Nothing here yet.');
    const head = cols.map((c) => `<th${attr('class', c.cls)}>${txt(c.label)}</th>`).join('');
    const hrefIsData = cols.some((c) => c.key === 'href');
    const body = rows.map((r) => {
      const href = r && !Array.isArray(r) ? (r._href || (!hrefIsData && typeof r.href === 'string' ? r.href : null)) : null;
      const tds = cols.map((c, i) => {
        const v = typeof c.render === 'function' ? c.render(r) : Array.isArray(r) ? r[i] : (r ? r[c.key] : null);
        return `<td${attr('class', c.cls)}${attr('data-label', plain(c.label))}>${cellHtml(v)}</td>`;
      }).join('');
      const cls = [href ? 'is-link' : '', r && r._cls ? r._cls : ''].filter(Boolean).join(' ');
      return `<tr${attr('class', cls)}${href ? attr('data-href', href) : ''}>${tds}</tr>`;
    }).join('');
    return `<div class="t-wrap"><table class="t${o.scroll ? '' : ' t-stack'}${o.cls ? ' ' + o.cls : ''}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function card(o) {
    o = o || {};
    const acts = arr(o.actions).filter(Boolean).join('');
    const head = (o.title || o.sub || acts) ? `<header class="card-h"><div class="card-hl">${o.title ? `<h2 class="card-t">${txt(o.title)}</h2>` : ''}${o.sub ? `<p class="card-s">${txt(o.sub)}</p>` : ''}</div>${acts ? `<div class="card-a">${acts}</div>` : ''}</header>` : '';
    return `<section class="card${o.tone ? ' tone-' + o.tone : ''}${o.cls ? ' ' + o.cls : ''}"${attr('id', o.id)}>${head}${o.body ? `<div class="card-b">${o.body}</div>` : ''}${o.foot ? `<footer class="card-f">${o.foot}</footer>` : ''}</section>`;
  }
  function section(title, body, o) {
    o = o || {};
    const acts = arr(o.actions).filter(Boolean).join('');
    return `<section class="sec${o.cls ? ' ' + o.cls : ''}"${attr('id', o.id)}><div class="sec-h"><div><h2>${txt(title)}</h2>${o.sub ? `<p>${txt(o.sub)}</p>` : ''}</div>${acts ? `<div class="sec-a">${acts}</div>` : ''}</div>${body || ''}</section>`;
  }
  function kv(pairs) {
    const rows = arr(pairs).filter((p) => p && p.length);
    if (!rows.length) return '';
    return `<dl class="kv">${rows.map((p) => `<div class="kv-r"><dt>${txt(p[0])}</dt><dd>${cellHtml(p[1])}</dd></div>`).join('')}</dl>`;
  }
  function list(items, o) {
    const its = arr(items).filter((x) => x != null && x !== '');
    if (!its.length) return '';
    return `<ul class="rows${o && o.cls ? ' ' + o.cls : ''}">${its.map((it) => {
      if (typeof it !== 'object') return `<li class="row"><div class="row-main">${txt(it)}</div></li>`;
      const href = it.href;
      const title = href ? `<a href="${esc(href)}">${txt(it.title)}</a>` : txt(it.title);
      const chips = arr(it.chips).filter(Boolean).join(' ');
      return `<li class="row${it.tone ? ' tone-' + it.tone : ''}${href ? ' is-link' : ''}"${href ? attr('data-href', href) : ''}><div class="row-main"><div class="row-t">${title}${chips ? ` <span class="row-c">${chips}</span>` : ''}</div>${it.sub ? `<div class="row-s">${txt(it.sub)}</div>` : ''}</div>${it.right ? `<div class="row-r">${txt(it.right)}</div>` : ''}</li>`;
    }).join('')}</ul>`;
  }
  function empty(text, action) { return `<div class="empty"><p>${txt(text || 'Nothing here yet.')}</p>${action ? `<div class="empty-a">${action}</div>` : ''}</div>`; }
  function note(text, tone) { return `<div class="note note-${esc(tone || 'info')}">${txt(text)}</div>`; }
  function banner(text, o) { o = o || {}; return `<div class="banner tone-${esc(o.tone || 'info')}"><div class="banner-t">${txt(text)}</div>${o.action ? `<div class="banner-a">${o.action}</div>` : ''}</div>`; }
  function stats(items) {
    const its = arr(items).filter(Boolean);
    if (!its.length) return '';
    return `<div class="stats">${its.map((s) => `<div class="stat${s.tone ? ' tone-' + s.tone : ''}"><b>${txt(s.value)}</b><span>${txt(s.label)}</span></div>`).join('')}</div>`;
  }
  function filters(items) {
    return `<nav class="filters">${arr(items).map((i) => {
      const n = i.count != null ? ` <span class="filter-n">${esc(i.count)}</span>` : '';
      if (i.href) return `<a class="filter${i.on ? ' on' : ''}" href="${esc(i.href)}"${i.on ? ' aria-current="true"' : ''}>${txt(i.label)}${n}</a>`;
      return `<button type="button" class="filter${i.on ? ' on' : ''}" aria-pressed="${i.on ? 'true' : 'false'}"${attr('data-act', i.act)}${dataAttrs(i.data)}>${txt(i.label)}${n}</button>`;   /* v7: the chosen one is announced, not only styled */
    }).join('')}</nav>`;
  }
  function progress(done, total) {
    const d = +done || 0; const t = +total || 0; const p = t ? Math.round((d / t) * 100) : 0;
    return `<span class="prog" role="img" aria-label="${d} of ${t} done"><i style="width:${p}%"></i></span>`;
  }
  /* v7: the label is tied to its control, so clicking it focuses the field and a screen reader names it: o.for, else the first
     text control's own id, else an id given to it here; a group of radios is named by the label instead */
  function field(o) {
    o = o || {}; let html = o.html || ''; let forId = o.for || null;
    if (o.label && !forId) {
      const plain = String(o.label).replace(/<[^>]*>/g, '');
      if (/role="radiogroup"/.test(html) && !/role="radiogroup"[^>]*aria-label=/.test(html)) html = html.replace('role="radiogroup"', `role="radiogroup" aria-label="${esc(plain)}"`);
      else {
        const m = /<(textarea|input|select)\b([^>]*)>/i.exec(html);
        if (m && !/\btype="(radio|checkbox|hidden|button|submit)"/i.test(m[2])) {
          const idm = /\bid="([^"]+)"/.exec(m[2]);
          if (idm) forId = idm[1]; else { forId = `fld-${++SEQ}`; html = `${html.slice(0, m.index)}<${m[1]} id="${forId}"${html.slice(m.index + 1 + m[1].length)}`; }
        }
      }
    }
    return `<div class="field${o.cls ? ' ' + o.cls : ''}">${o.label ? `<label class="field-l"${attr('for', forId)}>${txt(o.label)}</label>` : ''}${html}${o.hint ? `<p class="field-h">${txt(o.hint)}</p>` : ''}${o.error ? `<p class="field-e">${txt(o.error)}</p>` : ''}</div>`;
  }
  function radios(o) {
    o = o || {};
    const name = o.name || 'r' + (++SEQ);
    return `<div class="radios" role="radiogroup"${attr('aria-label', o.label)}>${arr(o.options).map((op) => `<label class="radio${String(op.value) === String(o.value) ? ' on' : ''}"><input type="radio" name="${esc(name)}" value="${esc(op.value)}"${String(op.value) === String(o.value) ? ' checked' : ''}${attr('data-act', o.act)}${dataAttrs(o.data)}><span><b>${txt(op.label)}</b>${op.sub ? `<small>${txt(op.sub)}</small>` : ''}</span></label>`).join('')}</div>`;
  }
  function btn(label, o) {
    o = o || {};
    const kind = o.kind || 'secondary';
    const cls = `btn btn-${kind}${o.small ? ' btn-sm' : ''}${o.cls ? ' ' + o.cls : ''}`;
    if (o.href && !o.disabled) return `<a class="${cls}" href="${esc(o.href)}"${attr('title', o.title)}${attr('id', o.id)}>${txt(label)}</a>`;
    return `<button type="${o.submit ? 'submit' : 'button'}" class="${cls}"${attr('id', o.id)}${attr('data-act', o.act)}${dataAttrs(o.data)}${o.disabled ? ' disabled aria-disabled="true"' : ''}${attr('title', o.title)}>${txt(label)}</button>`;
  }
  function phone(inner, o) {
    o = o || {};
    return `<div class="phone-wrap"><div class="phone"><div class="phone-bar"><span>${esc(ownTime(now()))}</span><i></i></div><div class="phone-scr">${inner || ''}</div></div>${o.caption ? `<p class="phone-cap">${txt(o.caption)}</p>` : ''}</div>`;
  }

  function page(o) {
    o = o || {};
    const crumbs = arr(o.crumbs).filter(Boolean);
    const cr = crumbs.length ? `<nav class="crumbs" aria-label="You are here">${crumbs.map((c, i) => (c.href && i < crumbs.length - 1 ? `<a href="${esc(c.href)}">${txt(c.label)}</a>` : `<span>${txt(c.label)}</span>`)).join('<span class="sep" aria-hidden="true">›</span>')}</nav>` : '';
    const chips = arr(o.chips).filter(Boolean).join(' ');
    const acts = arr(o.actions).filter(Boolean).join('');
    const head = `<header class="ph"><div class="ph-main"><div class="ph-title"><h1>${txt(o.title || '')}</h1>${chips ? `<div class="ph-chips">${chips}</div>` : ''}</div>${o.sub ? `<p class="ph-sub">${txt(o.sub)}</p>` : ''}</div>${acts ? `<div class="ph-actions">${acts}</div>` : ''}</header>`;
    const tabs = arr(o.tabs).filter(Boolean);
    const tb = tabs.length ? `<nav class="tabs" role="tablist">${tabs.map((t) => `<a class="tab${t.id === o.active ? ' on' : ''}" href="${esc(t.href || '#')}" role="tab"${t.id === o.active ? ' aria-selected="true"' : ''}>${txt(t.label)}${t.count != null && t.count !== '' ? `<span class="tab-n">${esc(t.count)}</span>` : ''}</a>`).join('')}</nav>` : '';
    const body = o.aside ? `<div class="pg-body has-aside"><div class="pg-main">${o.body || ''}</div><aside class="pg-aside">${o.aside}</aside></div>` : `<div class="pg-body"><div class="pg-main">${o.body || ''}</div></div>`;
    return `<div class="pg${o.cls ? ' ' + o.cls : ''}">${cr}${head}${o.banner || ''}${tb}${body}</div>`;
  }

  /* ── DOM: sheets, modals, toasts ───────────────────────────────────────────────────────────────────────── */
  let SEQ = 0;
  const LAST = { sheet: null, modal: null, toast: null };
  function hasDom() { return typeof document !== 'undefined' && !!document && typeof document.createElement === 'function' && !!document.body && typeof document.body.appendChild === 'function'; }
  function q(sel, root) { return hasDom() ? (root || document).querySelector(sel) : null; }
  function raf(fn) { if (typeof W.requestAnimationFrame === 'function') W.requestAnimationFrame(fn); else setTimeout(fn, 16); }
  function frameHtml(kind, o) {
    return `<header class="${kind}-h"><div class="${kind}-hl"><h2 class="${kind}-t">${txt(o.title || '')}</h2>${o.sub ? `<p class="${kind}-s">${txt(o.sub)}</p>` : ''}</div><button type="button" class="x" data-act="ui:close" data-what="${kind}" aria-label="Close">×</button></header><div class="${kind}-b">${o.body || ''}</div>${o.foot ? `<footer class="${kind}-f">${o.foot}</footer>` : ''}`;
  }
  function focusFirst(el) {
    try { const f = el.querySelector('input:not([type=hidden]):not([disabled]),select,textarea,button:not(.x)'); if (f && f.focus) f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  let SHEET = null; let MODAL = null;
  function openSheet(o) {
    o = o || {};
    closeSheet(true); LAST.sheet = o;
    if (!hasDom()) return null;
    const scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.setAttribute('data-act', 'ui:close'); scrim.setAttribute('data-what', 'sheet');
    const el = document.createElement('aside'); el.className = 'sheet' + (o.wide ? ' sheet-wide' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', plain(o.title) || 'Sheet');
    el.innerHTML = frameHtml('sheet', o);
    document.body.appendChild(scrim); document.body.appendChild(el);
    if (document.body.classList) document.body.classList.add('has-sheet');
    SHEET = { o, el, scrim, prev: document.activeElement };
    raf(() => { if (el.classList) el.classList.add('open'); if (scrim.classList) scrim.classList.add('open'); });
    if (o.onBind) { try { o.onBind(el); } catch (e) { console.error(e); } }
    focusFirst(el);
    return el;
  }
  function refreshSheet(parts) {
    if (!SHEET) return null;
    Object.assign(SHEET.o, parts || {});
    const sc = q('.sheet-b', SHEET.el); const top = sc ? sc.scrollTop : 0;
    SHEET.el.innerHTML = frameHtml('sheet', SHEET.o);
    const sc2 = q('.sheet-b', SHEET.el); if (sc2) sc2.scrollTop = top;
    if (SHEET.o.onBind) { try { SHEET.o.onBind(SHEET.el); } catch (e) { console.error(e); } }
    return SHEET.el;
  }
  function closeSheet(silent) {
    if (!SHEET) return;
    const s = SHEET; SHEET = null;
    try { s.el.remove(); s.scrim.remove(); } catch (e) { /* ignore */ }
    if (hasDom() && document.body.classList) document.body.classList.remove('has-sheet');
    if (s.o.onClose && !silent) { try { s.o.onClose(); } catch (e) { console.error(e); } }
    try { if (s.prev && s.prev.focus && document.contains && document.contains(s.prev)) s.prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function sheetEl() { return SHEET ? SHEET.el : null; }
  function modal(o) {
    o = o || {};
    closeModal(true); LAST.modal = o;
    if (!hasDom()) return null;
    const wrap = document.createElement('div'); wrap.className = 'modal-wrap'; wrap.setAttribute('data-act', 'ui:close'); wrap.setAttribute('data-what', 'modal');
    wrap.innerHTML = `<div class="modal${o.wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(plain(o.title) || 'Dialog')}">${frameHtml('modal', o)}</div>`;
    document.body.appendChild(wrap);
    MODAL = { o, el: wrap, prev: document.activeElement };
    raf(() => { if (wrap.classList) wrap.classList.add('open'); });
    const box = q('.modal', wrap);
    if (o.onBind) { try { o.onBind(box || wrap); } catch (e) { console.error(e); } }
    if (box) focusFirst(box);
    return box || wrap;
  }
  function closeModal(silent) {
    if (!MODAL) return;
    const m = MODAL; MODAL = null;
    try { m.el.remove(); } catch (e) { /* ignore */ }
    if (m.o.onClose && !silent) { try { m.o.onClose(); } catch (e) { console.error(e); } }
    try { if (m.prev && m.prev.focus && document.contains && document.contains(m.prev)) m.prev.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  const CONFIRMS = {};
  function confirm(o) {
    o = o || {};
    const id = 'c' + (++SEQ); CONFIRMS[id] = o.onOk;
    const body = o.body ? (TAG_RE.test(o.body) ? o.body : `<p>${esc(o.body)}</p>`) : '';
    return modal({ title: o.title || 'Are you sure?', body, foot: btn(o.cancel || 'Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(o.ok || 'Confirm', { act: 'ui:confirm', data: { id }, kind: o.kind || 'primary' }) });
  }
  /* a toast that can undo keeps its Undo button for 10 s; after that, Undo stays on the Activity line while it still applies */
  const UNDO_MS = 10000;
  let toastT = null;
  function runUndo(fn) {
    let r;
    try { r = fn(); } catch (e) { console.error(e); r = { ok: false, error: e && e.message ? e.message : String(e) }; }
    LAST.undo = null;
    persist();
    const msg = r && typeof r === 'object' ? (r.toast || (r.ok === false ? r.error : '')) : (typeof r === 'string' ? r : '');
    if (msg) toast(msg);
    render();
    return r;
  }
  function toast(text, o) {
    o = o || {}; LAST.toast = plain(text);
    const undoNow = typeof o.undo === 'function' ? () => runUndo(o.undo) : null;   // the same as pressing the toast's Undo
    LAST.undo = undoNow;
    if (!hasDom()) return null;
    const old = q('#v7toast'); if (old) old.remove();
    const el = document.createElement('div'); el.className = 'toast'; el.id = 'v7toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<span>${txt(text)}</span>${o.undo ? '<button type="button" class="toast-u">Undo</button>' : ''}<button type="button" class="toast-x" aria-label="Dismiss">×</button>`;
    document.body.appendChild(el);
    const u = q('.toast-u', el); if (u) u.onclick = () => { el.remove(); runUndo(o.undo); };
    const x = q('.toast-x', el); if (x) x.onclick = () => el.remove();
    raf(() => { if (el.classList) el.classList.add('open'); });
    clearTimeout(toastT); toastT = setTimeout(() => { try { el.remove(); } catch (e) { /* ignore */ } if (LAST.undo === undoNow) LAST.undo = null; }, o.ms || (o.undo ? UNDO_MS : 5600));
    return el;
  }
  function copy(text) {
    const s = String(text == null ? '' : text);
    const fallback = () => {
      if (!hasDom()) return false;
      try {
        const ta = document.createElement('textarea'); ta.value = s; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); const ok = document.execCommand && document.execCommand('copy'); ta.remove(); return !!ok;
      } catch (e) { return false; }
    };
    try {
      if (W.navigator && W.navigator.clipboard && W.navigator.clipboard.writeText) return W.navigator.clipboard.writeText(s).then(() => true, () => fallback());
    } catch (e) { /* fall through */ }
    return Promise.resolve(fallback());
  }
  const CSS_DONE = {};
  function addCss(href) {
    if (!href || CSS_DONE[href] || !hasDom() || !document.head) return;
    CSS_DONE[href] = true;
    // prototype.html already links every module stylesheet: skip one that is linked (compared without ?v=)
    const bare = String(href).split('?')[0];
    try { const ls = document.querySelectorAll('link[rel="stylesheet"]'); for (let i = 0; i < ls.length; i++) if (String(ls[i].getAttribute('href') || '').split('?')[0] === bare) return; } catch (e) { /* add it */ }
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }

  /* ── events ────────────────────────────────────────────────────────────────────────────────────────────── */
  const HANDLERS = {};
  function on(name, fn) { if (name && typeof fn === 'function') HANDLERS[name] = fn; }
  function persist() { const v = V(); safe(() => v && v.persist && v.persist(), null); }
  function isField(el) { return !!el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName || ''); }
  function runAct(el, ev) {
    const name = el.getAttribute('data-act');
    const fn = HANDLERS[name];
    if (!fn) { console.warn('V7UI: no handler for', name); return; }
    const before = W.location ? W.location.hash : '';
    let r;
    try { r = fn(el, ev); } catch (e) { console.error(e); toast('That did not work: ' + (e && e.message ? e.message : e)); }
    if (r === false) return;
    persist();
    if (W.location && W.location.hash !== before) return;          // hashchange renders
    render();
  }
  function closeMenus() { if (!hasDom()) return; const m = q('.tb-clock.open'); if (m) { m.classList.remove('open'); const b = q('.clock', m); if (b) b.setAttribute('aria-expanded', 'false'); } }
  function onClick(ev) {
    const t = ev.target && ev.target.closest ? ev.target : (ev.target && ev.target.parentElement) || null;
    if (!t) return;
    if (!t.closest('.tb-clock')) closeMenus();
    const actEl = t.closest('[data-act]');
    if (actEl && !isField(actEl) && actEl.tagName !== 'FORM') {
      if (actEl.disabled || actEl.getAttribute('aria-disabled') === 'true') { ev.preventDefault(); return; }
      if ((actEl.classList.contains('modal-wrap') || actEl.classList.contains('scrim')) && ev.target !== actEl) return;
      ev.preventDefault();
      runAct(actEl, ev);
      return;
    }
    if (t.closest('.story a[href]') && (W.innerWidth || 1280) < 900) setStory(false, true);   // phone: the drawer gets out of the way
    const row = t.closest('[data-href]');
    if (row && !t.closest('a,button,input,select,textarea,label,summary')) { ev.preventDefault(); go(row.getAttribute('data-href')); }
  }
  function onField(ev) {
    const el = ev.target;
    if (!isField(el) || !el.hasAttribute('data-act')) return;
    if (ev.type === 'input' && !el.hasAttribute('data-live')) return;
    if (ev.type === 'change' && el.hasAttribute('data-live') && /^(text|number|search|date|email|tel)$/i.test(el.type || '') && el.tagName !== 'SELECT') return;
    runAct(el, ev);
  }
  function onSubmit(ev) { const f = ev.target && ev.target.closest && ev.target.closest('form[data-act]'); if (f) { ev.preventDefault(); runAct(f, ev); } }
  function onKey(ev) {
    if (ev.key !== 'Escape') return;
    if (q('.tb-clock.open')) { closeMenus(); return; }
    if (MODAL) { closeModal(); return; }
    if (SHEET) { closeSheet(); return; }
    if (hasDom() && document.body.classList.contains('story-open') && W.innerWidth < 900) setStory(false);
  }

  on('ui:close', (el) => { const w = el.getAttribute('data-what'); if (w === 'sheet') closeSheet(); else if (w === 'modal') closeModal(); else if (MODAL) closeModal(); else closeSheet(); return false; });
  on('ui:confirm', (el) => { const fn = CONFIRMS[el.getAttribute('data-id')]; delete CONFIRMS[el.getAttribute('data-id')]; closeModal(true); if (fn) return fn(); return undefined; });
  on('ui:story', () => { setStory(!storyOpen()); return false; });
  on('ui:clock', (el) => { const box = el.closest('.tb-clock'); if (box) { const open = !box.classList.contains('open'); box.classList.toggle('open', open); el.setAttribute('aria-expanded', String(open)); } return false; });
  on('ui:advance', (el) => { closeMenus(); advance(+el.getAttribute('data-min') || 60); });
  /* the story's start, in words worked out from the core: the clock it starts at and the trial day Vedanta ETP is on then */
  function storyStart() { const v = V(); const t = safe(() => v && v.NOW0, null); return isNum(t) ? +t : null; }
  function trialDayAt(key, t) {
    const v = V(); const t0 = safe(() => v && v.trialStart && v.trialStart(key), null);
    if (!isNum(t0) || !isNum(t) || +t < +t0) return null;
    return Math.floor((+t - +t0) / DAY) + 1;
  }
  function resetText() {
    const ps = plants(); const by = (k) => plantOf(k);
    const dp = by('digitalpaani'); const ved = by('vedanta');
    const day = trialDayAt('vedanta', now());
    const live = ps.filter((p) => p.state === 'live').map((p) => p.name);
    const bits = [];
    if (dp) bits.push(`${dp.name}'s plant graph just read`);
    if (ved) bits.push(day != null ? `${ved.name} on day ${day} of trial` : `${ved.name} in its trial`);
    if (live.length) bits.push(`${live.join(' and ')} Live`);
    return bits.length ? bits.join(', ') + '.' : 'The story is back at its start.';
  }
  on('ui:reset', () => {
    closeMenus();
    const t0 = storyStart();
    confirm({
      title: 'Reset the story?',
      body: `Every plant goes back to ${t0 != null ? fmt(t0) : 'the start of the story'}: DigitalPaani's plant graph just read, Vedanta ETP in its trial, Manesar STP and Bawal WTP Live. Everything you changed here is cleared. Your calls on the Decisions page are kept, and v7/1 keeps its own story.`,
      ok: 'Reset the story', kind: 'danger',
      onOk: () => {
        const v = V(); safe(() => v && (v.reset ? v.reset() : v.boot && v.boot()), null);
        persist(); paintStory();
        toast(resetText());
        go('#/plants'); return false;
      },
    });
    return false;
  });
  on('ui:act-more', () => { ACT_LIMIT += 200; });
  /* Undo on an Activity line: a structure action while nothing later touched the same rows, or a design parameter */
  function undoKind(key, token) {
    const v = V(); if (!v || !key || !token) return null;
    if (typeof v.canUndo === 'function' && typeof v.undoStructure === 'function' && safe(() => v.canUndo(key, token), false) === true) return 'structure';
    if (typeof v.canUndoDesignParam === 'function' && typeof v.undoDesignParam === 'function' && safe(() => v.canUndoDesignParam(key, token), false) === true) return 'param';
    return null;
  }
  function undoEntry(key, token) {
    const v = V(); const k = undoKind(key, token);
    if (k === 'structure') return v.undoStructure(key, token);
    if (k === 'param') return v.undoDesignParam(key, token);
    return { ok: false, error: 'This can no longer be undone: something later changed the same rows.' };
  }
  on('undo:activity', (el) => { const key = el.getAttribute('data-plant'); const token = el.getAttribute('data-token'); runUndo(() => undoEntry(key, token)); return false; });

  /* what happened while the clock moved, in plain words */
  function advanceText(r) {
    const n = (x) => arr(x).length;
    const parts = [];
    if (n(r.opened)) {
      const where = [...new Set(arr(r.opened).map((i) => i && i.plant).filter(Boolean))].map(plantName);
      parts.push(`${plural(n(r.opened), 'Issue')} opened${where.length ? ' at ' + where.join(', ') : ''}`);
    }
    if (n(r.closed)) parts.push(`${n(r.closed)} closed`);
    if (n(r.trial)) parts.push(plural(n(r.trial), 'trial firing'));
    if (n(r.expired)) parts.push(`${plural(n(r.expired), 'override')} expired`);
    if (n(r.tasksDue)) parts.push(`${plural(n(r.tasksDue), 'Task')} due`);
    return `Time moved on to ${fmt(now())}. ${parts.length ? parts.join(' · ') + '.' : 'Nothing new happened.'}`;
  }
  function advance(min) {
    const v = V();
    if (!v || !v.advance) { toast('The clock cannot move in this build.'); return null; }
    const r = safe(() => v.advance(min), {}) || {};
    const text = advanceText(r);
    toast(text, { ms: 7000 });
    paintStory();
    return text;
  }

  /* ── router ────────────────────────────────────────────────────────────────────────────────────────────── */
  const ROUTES = [];
  function normPattern(p) { return String(p || '').replace(/^#/, '').replace(/^\/+/, '').replace(/\/+$/, ''); }
  function compile(p) { return normPattern(p).split('/').filter(Boolean).map((s) => (s[0] === ':' ? { param: s.slice(1).replace(/\?$/, ''), opt: /\?$/.test(s) } : { lit: s })); }
  /* v7: the decisions strip. decisions7.js (window.V7DEC) knows which decision cards show their consequence on which
     screen; every routed page carries that quiet strip right under its page header, before the tabs. Guarded: without
     V7DEC, on a throw or on a non-string there is no strip and the page renders as before. */
  function marksFor(path) {
    const D = W.V7DEC;
    if (!D || typeof D.markerHtml !== 'function') return '';
    try { const m = D.markerHtml(W.V7_VARIANT == null ? '1' : String(W.V7_VARIANT), path || ''); return typeof m === 'string' ? m : ''; }
    catch (e) { SOFT.push('V7DEC.markerHtml: ' + String(e && e.message || e)); if (SOFT.length > 200) SOFT.shift(); return ''; }
  }
  function withMarks(html, path) {
    if (typeof html !== 'string' || !html) return html;
    const m = marksFor(path); if (!m) return html;
    const i = html.indexOf('<header class="ph">'); const j = i < 0 ? -1 : html.indexOf('</header>', i);
    if (j >= 0) return html.slice(0, j + 9) + m + html.slice(j + 9);
    const pg = /^\s*<div class="pg[^"]*">/.exec(html);
    return pg ? html.slice(0, pg[0].length) + m + html.slice(pg[0].length) : m + html;
  }
  function route(pattern, fn) {
    if (typeof fn !== 'function') return;
    const pat = normPattern(pattern); const segs = compile(pat);
    const routed = (params) => withMarks(fn(params), params && params._path != null ? String(params._path) : '');
    const r = { pattern: pat, segs, fn: routed, raw: fn, lits: segs.filter((s) => s.lit).length, opts: segs.filter((s) => s.opt).length };
    const i = ROUTES.findIndex((x) => x.pattern === pat);
    if (i >= 0) { ROUTES[i] = Object.assign(r, { order: ROUTES[i].order }); } else { r.order = ROUTES.length; ROUTES.push(r); }
  }
  function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function matchSegs(segs, parts, i, j, out) {
    if (i === segs.length) return j === parts.length ? out : null;
    const s = segs[i];
    if (s.lit) return parts[j] === s.lit ? matchSegs(segs, parts, i + 1, j + 1, out) : null;
    if (j < parts.length) { const o = Object.assign({}, out); o[s.param] = dec(parts[j]); const r = matchSegs(segs, parts, i + 1, j + 1, o); if (r) return r; }
    if (s.opt) return matchSegs(segs, parts, i + 1, j, out);
    return null;
  }
  function parseQuery(qs) {
    const o = {};
    String(qs || '').split('&').filter(Boolean).forEach((kvp) => { const i = kvp.indexOf('='); const k = dec(i < 0 ? kvp : kvp.slice(0, i)); o[k] = i < 0 ? '' : dec(kvp.slice(i + 1).replace(/\+/g, ' ')); });
    return o;
  }
  function splitPath(full) {
    const s = String(full || '').replace(/^#/, '').replace(/^\/+/, '');
    const i = s.indexOf('?');
    const p = (i < 0 ? s : s.slice(0, i)).replace(/\/+$/, '');
    return { path: p, query: i < 0 ? '' : s.slice(i + 1) };
  }
  function match(full) {
    const sp = splitPath(full);
    const parts = sp.path ? sp.path.split('/') : [];
    let best = null;
    for (const r of ROUTES) {
      const params = matchSegs(r.segs, parts, 0, 0, {});
      if (!params) continue;
      const score = r.lits * 1000 - r.opts * 10 - r.order * 0.001;
      if (!best || score > best.score) best = { route: r, params, score };
    }
    if (!best) return null;
    best.params._q = parseQuery(sp.query); best.params._path = sp.path;
    return { route: best.route, pattern: best.route.pattern, params: best.params };
  }
  function errorPage(e, path) {
    console.error(e);
    return page({ crumbs: [{ label: 'All Plants', href: '#/plants' }], title: 'This page could not be shown', sub: 'Something in the prototype failed while drawing it. The rest of the app still works.', body: note(`${esc(path || '')} · ${esc(e && e.message ? e.message : e)}`, 'bad') + `<p class="mt">${link('Back to All Plants', '#/plants')}</p>` });
  }
  function renderPath(full) {
    const m = match(full);
    if (!m) return plantsPage({ _q: {}, _path: 'plants' });
    try { const out = m.route.fn(m.params); return out == null ? '' : String(out); } catch (e) { return errorPage(e, splitPath(full).path); }
  }
  function hashNow() { return W.location ? String(W.location.hash || '') : ''; }
  function current() { const m = match(hashNow()); const sp = splitPath(hashNow()); return { path: sp.path, query: sp.query, params: m ? m.params : {}, pattern: m ? m.pattern : null }; }
  function go(hash) {
    let hs = String(hash == null ? '' : hash).trim();
    if (!hs) hs = '#/plants';
    if (hs[0] !== '#') hs = '#' + (hs[0] === '/' ? '' : '/') + hs;
    if (hs.indexOf('#/') !== 0) hs = '#/' + hs.slice(1);
    if (!W.location) return;
    if (W.location.hash === hs) render(); else W.location.hash = hs;
  }
  function routes() { return ROUTES.slice(); }

  /* ── shell ─────────────────────────────────────────────────────────────────────────────────────────────── */
  const NAV = [['All Plants', '#/plants', /^(plants|p)$/], ['Library', '#/library', /^library$/], ['Deviations', '#/deviations', /^(deviations|differences)$/], ['Activity', '#/activity', /^activity$/], ['Decisions', '#/decisions', /^decisions$/]];
  function navHtml(path) {
    const first = String(path || '').split('/')[0] || 'plants';
    return NAV.map(([label, href, re]) => {
      const onNow = re.test(first);
      return `<a href="${href}"${onNow ? ' class="on" aria-current="page"' : ''}>${esc(label)}</a>`;
    }).join('');
  }
  /* the badge names this prototype and opens the v7 overview; "Same place in v7/1 →" opens this page's chapter in v7/1 */
  function versionBadge() {
    const v = VERSIONS[variantNow()];
    return `<a class="tb-ver" href="../index.html" title="Both approaches side by side"><b>${esc(v[0])}</b><span> · ${esc(v[1])}</span></a>`;
  }
  function samePlaceLink(path) {
    const o = VERSIONS[otherVariant()][0];
    return `<a class="tb-same" id="tbSame" href="${esc(samePlaceHref(path))}" target="v7-${otherVariant()}" title="Opens the same moment in ${esc(o)}, the recommended approach"><span class="tb-same-l">Same place in </span>${esc(o)} →</a>`;
  }
  function topbarHtml(path) {
    const advances = [[60, '+1 hour'], [360, '+6 hours'], [1440, '+1 day'], [10080, '+1 week']];
    return `<header class="tb"><a class="tb-brand" href="#/plants">CloseTheLoop<span> · Configuration</span></a>${versionBadge()}${samePlaceLink(path)}`
      + `<nav class="tb-nav" id="tbNav" aria-label="Main">${navHtml(path)}</nav>`
      + `<div class="tb-right"><div class="tb-clock"><button type="button" class="clock" data-act="ui:clock" aria-haspopup="true" aria-expanded="false" title="The story clock: one clock for every plant"><span class="clock-k">Story clock</span><b id="clockNow">${esc(fmt(now()))}</b><span class="caret" aria-hidden="true">▾</span></button>`
      + `<div class="menu" role="menu"><p class="menu-h">Move time on</p>${advances.map(([m, l]) => `<button type="button" role="menuitem" data-act="ui:advance" data-min="${m}">${esc(l)}</button>`).join('')}<p class="menu-n">Readings, trial firings, Issues and Tasks move with the clock.</p><hr><button type="button" role="menuitem" data-act="ui:reset">Reset the story</button></div></div>`
      + `<button type="button" class="tb-btn tb-story" data-act="ui:story" aria-pressed="false" aria-controls="story">Story</button>`
      + `<button type="button" class="tb-btn tb-reset" data-act="ui:reset">Reset the story</button></div></header>`;
  }

  /* ── story panel ───────────────────────────────────────────────────────────────────────────────────────── */
  /* a chip names its card the way the card and the decisions strip do (the card's short name); these names stand in only
     when decisions7.js is not loaded */
  const DEC_LABEL = {
    D1: 'Unit processes in the spine', D2: 'Readiness as drawn', D3: 'Nothing sent until Live', D4: 'Which plant tells which part',
    D5: 'Sample readings and replay', D6: 'Five reasons for an override', D7: 'Tasks per equipment', D8: 'Drafts on a Live plant',
    D9: 'Survey and plant graph', D10: 'Sensor pages and the Equipment Card', D11: 'Who a library change reaches', D12: 'Readings tab on Live plants',
    D13: 'People in the console', D14: 'Words on screen', D15: 'Frozen while an Issue is open', D16: 'What a Trigger is about',
    D17: 'Versions, kinds and pins', D18: 'Limit rules and design parameters', D19: 'First due dates', D20: 'Membership on the drawing',
    D21: 'When a Trigger is noisy', D22: 'Shared Tasks on the review', D23: 'Forced changes and open Issues', D24: 'Trial firings kept or recounted',
    D25: 'Old library numbers at a plant', D26: 'Criticality tier from the structure', D27: 'Achievements from v6',
  };
  function decCard(id) { const D = W.V7DEC; return D && typeof D.byId === 'function' ? safe(() => D.byId(id), null) : null; }
  function decLabel(id) { const D = W.V7DEC; const d = decCard(id); const s = d && typeof D.shortOf === 'function' ? safe(() => D.shortOf(d), '') : ''; return s || DEC_LABEL[id] || id; }
  function decTitle(id) { const d = decCard(id) || arr(W.V7_DECISIONS).find((x) => x && x.id === id); return d ? plain(d.title) : DEC_LABEL[id] || ''; }
  function decCount() { const D = W.V7DEC; const n = D && typeof D.list === 'function' ? arr(safe(() => D.list(), [])).length : arr(W.V7_DECISIONS).length; return n || null; }
  function alertsOf(key) { const v = V(); return arr(safe(() => v.alerts(key, {}), [])); }
  function issuesOf(key) { const v = V(); return arr(safe(() => v.issues(key, {}), [])); }
  function libCode(name, fb) {
    const v = V();
    const t = arr(safe(() => v.libTypes(), [])).find((x) => (x.typeName || x.type || x.name) === name);
    if (t && t.code) return t.code;
    const c = arr(W.CATALOGUE).find((x) => x.type === name);
    return c ? c.code : fb;
  }
  function alertOf(key, id) { const v = V(); return safe(() => v.alert(key, id), null); }
  function trigHref(key, id, fb) { return alertOf(key, id) ? `#/p/${encodeURIComponent(key)}/trigger/${encodeURIComponent(id)}` : fb; }
  function trigName(key, id, fb) { const v = V(); const n = safe(() => v.triggerName(key, id), null); return (typeof n === 'string' && n.trim()) ? n : ((alertOf(key, id) || {}).name || fb); }
  function sensorTag(key, id) { const v = V(); const s = arr(safe(() => v.sensors(key), [])).find((x) => x && x.id === id); return s ? (s.tag || s.name || null) : null; }
  function tplHref(id) { const v = V(); return safe(() => v.template(id), null) ? `#/library/templates/${encodeURIComponent(id)}` : null; }
  function trialOf(key, id) { const v = V(); return safe(() => v.trialStats(key, id), null); }
  function hasEmergencyTrial(key, id) { const t = trialOf(key, id); return !!(t && (+t.emergencies > 0 || arr(t.firings).some((f) => f && f.band === 'emergency'))); }
  function plantHasEmergencyTrial(key) { return alertsOf(key).some((a) => a && hasEmergencyTrial(key, a.id)); }
  function stateOf(key) { const p = plantOf(key); return p ? p.state : null; }

  /* the story's moving parts, each read from the core on its own: a value that is missing is null, and every sentence
     that uses one has a version without it, so the panel never shows a hole */
  const STORY_IDS = { lvl: 'a_3d', doSbr: 'a_3r', ph: 'a_3f', lvlSensor: 'v_eq1_LVL', manDO: 'a_do_at2', mlssLow: 'tpl_up_activated-sludge_mlss-low', doLow: 'tpl_up_activated-sludge_do-low', mlssAt1: 'at1_mlss', at2: 'at2' };
  function baseCtx() {
    return {
      blower: `#/library/eq-types/${encodeURIComponent(libCode('Blower', 'BLW'))}`,
      lvlName: 'Level high · EQ-1', doName: 'DO low · SBR-1', phName: 'pH low · EQ-1', manDOName: 'DO low · AT-2', manSubject: 'AT-2',
    };
  }
  function ctx() {
    const v = V(); const I = STORY_IDS; const c = baseCtx();
    const lvl = trialOf('vedanta', I.lvl);
    const ph = trialOf('vedanta', I.ph);
    const em = ph ? arr(ph.firings).find((f) => f && f.band === 'emergency') : null;
    const open = issuesOf('manesar').find((i) => i && i.status !== 'closed' && (i.alertId || i.triggerId) === I.manDO) || null;
    const diag = open && open.diag ? arr(open.diag.path)[0] : null;
    const st = safe(() => v.structure('digitalpaani'), null); const sc = st && st.counts;
    const cl = stateOf('vedanta') === 'commissioning' ? safe(() => v.checklist('vedanta'), null) : null;
    const drafts = cl ? arr(cl.blockers).find((b) => b && b.id === 'drafts') : null;
    const tpl = safe(() => v.template(I.mlssLow), null);
    const mr = tpl && tpl.rules && tpl.rules.minor; const minor = mr && mr.rule ? mr.rule : mr;
    const at1 = safe(() => v.zoneInfo('manesar', I.mlssAt1, 'below'), null);
    const at1m = at1 && at1.perBand ? at1.perBand.minor : null;
    const people = safe(() => v.people('digitalpaani'), null);
    return Object.assign(c, {
      eqTypes: arr(safe(() => v.libTypes(), [])).length || null,
      doLowTpl: tplHref(I.doLow),
      dpUps: sc && isNum(sc.ups) ? +sc.ups : null,
      dpCgs: sc && isNum(sc.cgs) ? +sc.cgs : null,
      dpPeople: Array.isArray(people) ? people.length : null,
      vedState: stateOf('vedanta'),
      trialDay: trialDayAt('vedanta', now()),
      lvl: trigHref('vedanta', I.lvl, '#/p/vedanta/triggers'), lvlName: trigName('vedanta', I.lvl, c.lvlName),
      lvlPerDay: lvl && isNum(lvl.perDay) ? (lvl.perDayText || rate(lvl.perDay)) : null, lvlNoisy: lvl ? !!lvl.noisy : null,
      doV: trigHref('vedanta', I.doSbr, null), doName: trigName('vedanta', I.doSbr, c.doName),
      lvlTag: sensorTag('vedanta', I.lvlSensor),
      ph: trigHref('vedanta', I.ph, '#/p/vedanta/triggers'), phName: trigName('vedanta', I.ph, c.phName),
      emergencyAt: em && isNum(em.start) ? fmt(em.start) : null,
      vedDrafts: drafts ? (isNum(drafts.count) ? +drafts.count : arr(drafts.items).length) : (cl ? 0 : null),
      manIssue: open ? `#/p/manesar/issue/${encodeURIComponent(open.id)}` : trigHref('manesar', I.manDO, '#/p/manesar/issues'),
      manDO: trigHref('manesar', I.manDO, '#/p/manesar'), manDOName: trigName('manesar', I.manDO, c.manDOName),
      manSubject: (open && open.subject && open.subject.tag) || c.manSubject,
      manOpenedAt: open && isNum(open.opened) ? ownTime(open.opened) : null,
      manDiagAt: diag && isNum(diag.at) ? ownTime(diag.at) : null, manDiagBy: diag && diag.by ? String(diag.by) : null,
      tplV: tpl && isNum(tpl.v) ? +tpl.v : null,
      tplMinor: minor && minor.kind === 'const' && isNum(minor.value) ? String(+minor.value) : null,
      at1Minor: at1m && at1m.source === 'override' && isNum(at1m.value) ? String(+at1m.value) : null,
      decisions: decCount(),
    });
  }
  /* the twelve chapters: two sentences each, where to go, the same moment in v7/1 (cmp, a v7/1 route) and the cards */
  const STORY = [
    { n: 1, title: 'The library', dec: ['D1', 'D10', 'D17', 'D14'], cmp: '#/library',
      text: (c) => [`The library holds ${c.eqTypes ? `${c.eqTypes} equipment types` : 'the equipment types'} under the names the survey uses, the unit-process types, and the templates: the library form of a Trigger or a Task, with a limit rule for each band.`,
        'A type page is laid out like the object it describes, plus Downstream and Publish: one editor everywhere.'],
      go: () => '#/library', also: (c) => [{ label: 'An equipment type: Blower', href: c.blower }, { label: 'A template: DO low', href: c.doLowTpl }] },
    { n: 2, title: 'A new plant from the survey', dec: ['D1', 'D9', 'D20', 'D4', 'D26'], cmp: '#/p/digitalpaani/scada',
      text: (c) => ['DigitalPaani\'s plant graph was built from its real survey this morning, and the plant is in Commissioning: nothing is sent.',
        `The structure pass proposes ${c.dpUps != null && c.dpCgs != null ? `${plural(c.dpUps, 'unit process', 'unit processes')} and ${plural(c.dpCgs, 'control group')}` : 'its unit processes and control groups'}, each with a plain reason: accept them in bulk, place what no rule placed, and open the drawing to change who participates in what.`],
      go: () => '#/p/digitalpaani/review/structure', also: () => [{ label: 'The drawing', href: '#/p/digitalpaani/structure/drawing' }] },
    { n: 3, title: 'The bindings pass', dec: ['D8', 'D18', 'D16', 'D22'], cmp: '#/p/digitalpaani/library',
      text: () => ['Once the structure is confirmed, the library binds its templates to DigitalPaani\'s unit processes and equipment, and each proposed Trigger and Task shows its values and where they come from.',
        'Accept them as drafts, or accept them and start the trial; templates that need a sensor the plant graph does not have wait in their own group.'],
      go: () => '#/p/digitalpaani/review/bindings' },
    { n: 4, title: 'Readiness', dec: ['D2', 'D13', 'D19'], cmp: '#/p/digitalpaani',
      text: (c) => ['Three tracks run side by side, Structure, Bindings and People, with blockers first and gaps after, each linked to the field that fixes it; Alex\'s list has no rule that a Trigger must exist, so a plant with nothing bound would be cleared the same way.',
        c.dpPeople ? 'People are added on DigitalPaani\'s People tab, with a code sent to each phone, and Go live stays disabled until a reachable Operator and Lead exist.'
          : 'Nobody is on DigitalPaani\'s roster yet: people are added on the plant\'s People tab, with a code sent to each phone, and Go live stays disabled until a reachable Operator and Lead exist.'],
      go: () => '#/p/digitalpaani', also: () => [{ label: 'People at DigitalPaani', href: '#/p/digitalpaani/people' }] },
    { n: 5, title: 'Trial and tuning', dec: ['D5', 'D21', 'D6', 'D10', 'D24'], cmp: '#/p/vedanta/alert/a_3d',
      text: (c) => {
        const noisy = c.lvlPerDay == null ? `${c.lvlName} fires more than 10 times a day, so it is noisy.`
          : c.lvlNoisy ? `${c.lvlName} averages ${c.lvlPerDay} trial firings a day, more than 10, so it is noisy.`
            : `${c.lvlName} averages ${c.lvlPerDay} trial firings a day, 10 or fewer, so it is not noisy.`;
        const s1 = c.vedState === 'live' ? 'Vedanta ETP is Live now; during its trial every active Trigger recorded trial firings from sample readings, and those records stay.'
          : `${c.trialDay != null ? `Vedanta ETP is on day ${c.trialDay} of its trial` : 'Vedanta ETP is in its trial'}, and every active Trigger records trial firings from sample readings; ${noisy}`;
        return [s1, 'Limits are edited only on the sensor, under Zones: the reason comes first, five to choose from, and the preview counts what the trial so far would have fired; trial firings are stored records, so the noisy mark stays after tuning until the average falls.'];
      },
      go: (c) => c.lvl,
      also: (c) => [{ label: c.doName, href: c.doV }, c.lvlTag ? { label: `${c.lvlTag}: its zones`, href: `#/p/vedanta/sensor/${encodeURIComponent(STORY_IDS.lvlSensor)}?f=zone.above.caution` } : null, { label: 'Triggers by trial firings', href: '#/p/vedanta/triggers?sort=trial' }] },
    { n: 6, title: 'Safety in commissioning', dec: ['D3', 'D8'], cmp: '#/p/vedanta/issue/is_5m',
      text: (c) => ['During Commissioning every severity records trial firings only, Emergency included: nothing is sent, so no WhatsApp, SMS or call, no hooter and nothing in the operator app.',
        `${c.emergencyAt ? `On ${c.emergencyAt}` : 'During the trial'} EQ-1's pH reached the Emergency band; here that is one more trial firing on ${c.phName}, nobody was told and no Issue opened, the price of a fully quiet trial.`],
      go: (c) => c.ph, also: () => [{ label: 'Issues at Vedanta ETP', href: '#/p/vedanta/issues' }, { label: 'Routing at Vedanta ETP', href: '#/p/vedanta/people' }] },
    { n: 7, title: 'Go live', dec: ['D2', 'D3', 'D7', 'D19'], cmp: '#/p/vedanta',
      text: (c) => [c.vedState === 'live' ? 'Vedanta ETP is Live: Coverage is its home now, and its counts start at go-live.'
        : c.vedDrafts == null ? 'Vedanta ETP still has a draft undecided, so Go live is blocked until it is decided.'
          : c.vedDrafts > 0 ? `Vedanta ETP still has ${c.vedDrafts === 1 ? 'one draft' : `${c.vedDrafts} drafts`} undecided, so Go live is blocked until ${c.vedDrafts === 1 ? 'it is' : 'they are'} decided.`
            : 'Every draft at Vedanta ETP is decided, so no draft blocks Go live.',
      'The confirmation states what changes, loudest first: Triggers create Issues and notify the plant\'s people, Emergency calls and the hooter included; scheduled Tasks start, counted from the last service dates entered, otherwise due today; metrics start; structure changes need a reason.'],
      go: () => '#/p/vedanta', also: () => [{ label: 'The undecided draft', href: '#/p/vedanta/review/bindings?show=undecided' }, { label: 'Last service dates', href: '#/p/vedanta/people/service-dates' }] },
    { n: 8, title: 'Live operation', dec: ['D15', 'D16', 'D13', 'D20'], cmp: '#/p/manesar/issue/is_2z',
      text: (c) => {
        const who = c.manDiagBy ? `${c.manDiagBy}, the Operator who was told,` : 'the Operator who was told';
        const s1 = c.manOpenedAt
          ? `Manesar STP is Live: ${c.manDOName} opened an Issue on the unit process ${c.manSubject} at ${c.manOpenedAt}${c.manDiagAt ? `, and ${who} started its diagnostic flow at ${c.manDiagAt}` : ''}; carry on at question 2 and answer No, and the diagnosis names BL-1's intake filter and a fix step opens its Task.`
          : `Manesar STP is Live: ${c.manDOName} opens its Issues on the unit process ${c.manSubject}, and the diagnosis names BL-1's intake filter when the blower discharge reads low, with a fix step that opens its Task.`;
        return [s1, 'While the Issue is open the Trigger\'s terms are frozen: a change to DO-AT2\'s zones skips it, and after Verify closes the Issue the Trigger shows Base moved until someone resyncs it.'];
      },
      go: (c) => c.manIssue,
      also: (c) => [{ label: `The Trigger: ${c.manDOName}`, href: c.manDO }, { label: `The unit process ${c.manSubject}`, href: `#/p/manesar/up/${encodeURIComponent(STORY_IDS.at2)}` }, { label: 'Structure at Manesar STP', href: '#/p/manesar/structure' }] },
    { n: 9, title: 'Coverage', dec: ['D2', 'D11', 'D12', 'D8', 'D27'], cmp: '#/p/manesar',
      text: () => ['On a Live plant Readiness becomes Coverage: how the Triggers are doing, the plant\'s deviations, and the gaps it runs with.',
        'The Readings tab lists every sensor reading with its zones, on Live plants only; blind spots wait for the diagnostics work, as drawn.'],
      go: () => '#/p/manesar', also: () => [{ label: 'Readings at Manesar', href: '#/p/manesar/readings' }, { label: 'Bawal WTP', href: '#/p/bawal' }] },
    { n: 10, title: 'A library change', dec: ['D11', 'D17', 'D18', 'D19', 'D23'], cmp: '#/library/OS_TANK_DF',
      text: (c) => ['Library changes are made on the template or type page, and Downstream shows where they land before you publish: plants that follow, plants that override and will show Base moved, plants pinned to an older version, and Triggers frozen by an open Issue.',
        c.tplV != null && c.tplV > 1
          ? `MLSS low is at v${c.tplV} now: Manesar's AT-2 followed it at once${c.at1Minor != null ? `, AT-1 kept its ${c.at1Minor} mg/L and shows Base moved` : ''}, and the plants were not told.`
          : `Try the MLSS low template: change the Minor limit rule${c.tplMinor != null ? ` from ${c.tplMinor}` : ''} to 2200 mg/L; Manesar's AT-2 follows, AT-1 keeps ${c.at1Minor != null ? `its ${c.at1Minor} mg/L` : 'its own value'} and will show Base moved, and the plants are not told.`],
      go: () => `#/library/templates/${encodeURIComponent(STORY_IDS.mlssLow)}`, also: (c) => [{ label: 'Blower: a cadence change', href: `${c.blower}/tasks` }] },
    { n: 11, title: 'Deviations', dec: ['D6', 'D11', 'D14', 'D25'], cmp: '#/differences',
      text: () => ['Every override is listed with its reason, note, author, the library value it started from and its review date, grouped by library field; the counts on top are filters.',
        'Revert, Extend or Promote each one; Manesar\'s older values came across with the reason Migrated and a 90-day review.'],
      go: () => '#/deviations', also: () => [{ label: 'Manesar STP only', href: '#/p/manesar/deviations' }] },
    { n: 12, title: 'Decisions', dec: ['D1', 'D2', 'D5'], cmp: '#/decisions',
      text: (c) => [`The same ${c.decisions ? `${c.decisions} questions` : 'questions'} as v7/1: each card says what v7/1 does, the recommended approach, and what v7/2 does, Alex's model, with links to the same place in both.`,
        'A call made here shows in v7/1 too; copy your answers to send them.'],
      go: () => '#/decisions' },
  ];
  const HOLE = /\bundefined\b|\bNaN\b|\bnull\b|\[object /;
  function okText(t) { return Array.isArray(t) && t.length === 2 && t.every((x) => typeof x === 'string' && x.trim() && !HOLE.test(x)); }
  const CMP_TITLE = 'Opens the same moment in v7/1, the recommended approach';
  function chapters() {
    const c = safe(() => ctx(), null) || baseCtx();
    return STORY.map((s) => {
      let text = safe(() => s.text(c), null);
      if (!okText(text)) text = safe(() => s.text(baseCtx()), null);
      if (!okText(text)) text = [s.title + '.', ''];
      const href = safe(() => s.go(c), null) || safe(() => s.go(baseCtx()), null) || '#/plants';
      const also = arr(safe(() => (s.also ? s.also(c) : []), [])).filter((a) => a && a.href && typeof a.label === 'string' && a.label.trim() && !HOLE.test(a.label));
      const other = otherVariant();
      return {
        n: s.n, title: s.title, text: text.slice(), href, also, cmp: s.cmp,
        compare: { href: `../${other}/prototype.html${s.cmp}`, target: `v7-${other}`, label: `Compare with ${VERSIONS[other][0]} →`, title: CMP_TITLE },
        decisions: s.dec.map((id) => ({ id, label: decLabel(id), href: `#/decisions/${id}`, title: decTitle(id) })),
      };
    });
  }
  /* which chapter a page belongs to (0 = none); every chapter's own "Take me there" lights its own number */
  function chapterOf(full) {
    const seg = splitPath(full).path.split('/').map(dec);
    const top = seg[0] || 'plants';
    if (top === 'library') {
      if (seg[1] === 'templates' && seg[2] === STORY_IDS.mlssLow) return 10;
      if (seg[1] === 'eq-types' && seg[2] === libCode('Blower', 'BLW') && seg[3] === 'tasks') return 10;
      return 1;
    }
    if (top === 'deviations' || top === 'differences') return 11;
    if (top === 'decisions') return 12;
    if (top !== 'p' || !seg[1]) return 0;
    const key = seg[1]; const sub = seg[2] || ''; const id = seg[3] || '';
    const st = stateOf(key); if (!st) return 0;
    const live = st === 'live';
    const home = live ? 9 : key === 'vedanta' ? 7 : 4;
    const bindings = live ? 9 : key === 'vedanta' ? 7 : 3;
    const v = V();
    switch (sub) {
      case '': return home;
      case 'people': return live ? 0 : home;
      case 'review':
        if (id === 'bindings') return bindings;
        if (id === 'structure') return live ? 0 : 2;
        return safe(() => v.structureDone(key), false) ? bindings : (live ? 0 : 2);
      case 'scada': return live ? 0 : 2;
      case 'library': return bindings;
      case 'structure': case 'equipment': case 'cg': return live ? 8 : 2;
      case 'trigger': case 'alert': if (!id) return 0; if (live) return 8; return hasEmergencyTrial(key, id) ? 6 : 5;
      case 'triggers': return live ? 9 : 5;
      case 'sensor': return live ? 8 : 5;
      case 'up': case 'eq': return live ? 8 : key === 'vedanta' ? 5 : 2;
      case 'issue': case 'task': return live ? 8 : 5;
      case 'issues': return live ? 8 : plantHasEmergencyTrial(key) ? 6 : 0;
      case 'readings': return 9;
      case 'deviations': case 'differences': return 11;
      default: return 0;
    }
  }
  /* the top bar's "Same place in v7/1 →": the v7/1 moment of this page's chapter, else All Plants */
  function samePlaceHref(path) {
    const n = chapterOf(path || ''); const s = STORY.find((x) => x.n === n);
    return `../${otherVariant()}/prototype.html${s ? s.cmp : '#/plants'}`;
  }
  function storyHtml(path) {
    const cur = chapterOf(path || '');
    const chs = chapters();
    const t0 = storyStart();
    return `<div class="story-h"><div><h2>The story</h2><p>Twelve chapters, start to finish: the same moments as v7/1, in Alex's model.${t0 != null ? ` The clock starts at ${esc(fmt(t0))}.` : ''}</p></div><button type="button" class="x" data-act="ui:story" aria-label="Close the story">×</button></div>`
      + `<ol class="chs">${chs.map((c) => `<li class="ch${c.n === cur ? ' on' : ''}" data-ch="${c.n}"><span class="ch-n">${c.n}</span><div class="ch-b"><h3>${esc(c.title)}</h3>${c.text.filter(Boolean).map((t) => `<p>${esc(t)}</p>`).join('')}`
        + `<p class="ch-go"><a class="ch-link" href="${esc(c.href)}">Take me there →</a>${c.also.map((a) => `<a class="ch-also" href="${esc(a.href)}">${esc(a.label)}</a>`).join('')}</p>`
        + `<p class="ch-cmp"><a class="ch-cmp-l" href="${esc(c.compare.href)}" target="${esc(c.compare.target)}" title="${esc(c.compare.title)}">${esc(c.compare.label)}</a></p>`
        + `<p class="ch-dec"><span class="ch-dec-k">Decisions</span>${c.decisions.map((d) => `<a class="chip chip-dec" href="${esc(d.href)}" title="${esc(d.title)}">${esc(d.label)}</a>`).join('')}</p></div></li>`).join('')}</ol>`
      + `<div class="story-f"><p>Sample plants run on sample readings, generated the same way every time. Reset the story to start again; v7/1 keeps its own story.</p><button type="button" class="tb-btn" data-act="ui:reset">Reset the story</button></div>`;
  }
  function storyOpen() { return hasDom() && document.body.classList.contains('story-open'); }
  const STORY_KEY = 'ctl72.story';
  function setStory(open, transient) {
    if (!hasDom()) return;
    document.body.classList.toggle('story-open', !!open);
    const b = q('.tb-story'); if (b) b.setAttribute('aria-pressed', String(!!open));
    if (!transient && (W.innerWidth || 1280) >= 900) { try { W.localStorage.setItem(STORY_KEY, open ? '1' : '0'); } catch (e) { /* ignore */ } }
    if (open) highlightStory(splitPath(hashNow()).path, true);
  }
  /* the panel's sentences follow the core (the trial day, the drafts left, the open Issue), so it is repainted when they
     change; its scroll position is kept */
  let STORY_HTML = '';
  function paintStory() {
    const el = q('#story'); if (!el) return;
    const html = storyHtml('');
    if (html === STORY_HTML) return;
    STORY_HTML = html;
    const top = el.scrollTop;
    el.innerHTML = html;
    try { el.scrollTop = top; } catch (e) { /* ignore */ }
    highlightStory(splitPath(hashNow()).path, false, true);
  }
  let LAST_CH = -1;
  function highlightStory(path, force, quiet) {
    const el = q('#story'); if (!el) return;
    const cur = chapterOf(path);
    const lis = el.querySelectorAll('.ch');
    let onEl = null;
    for (let i = 0; i < lis.length; i++) { const li = lis[i]; const yes = +li.getAttribute('data-ch') === cur; li.classList.toggle('on', yes); if (yes) onEl = li; }
    if (!quiet && onEl && (force || cur !== LAST_CH) && storyOpen()) {
      try { const top = onEl.offsetTop - 64; if (top < el.scrollTop || onEl.offsetTop + onEl.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTo({ top, behavior: 'smooth' }); } catch (e) { /* ignore */ }
    }
    if (!quiet) LAST_CH = cur;
  }
  function chromeHtml(path) { return topbarHtml(path || '') + `<aside class="story" id="story" aria-label="The story">${storyHtml(path || '')}</aside>`; }

  /* ── pages: All Plants ─────────────────────────────────────────────────────────────────────────────────── */
  const DAY = 864e5;
  function openIssues(key) { return issuesOf(key).filter((i) => i && i.status !== 'closed'); }
  /* deviations at a plant: every override (base moved and past review included), pin and single-use template; structure
     changes are counted on their own */
  function deviationsOf(key) {
    const v = V(); const c = safe(() => v.deviationCounts(key), null);
    if (!c) return { n: null, structure: null };
    const n = (isNum(c.overrides) ? +c.overrides : 0) + (isNum(c.pinned) ? +c.pinned : 0) + (isNum(c.singleUse) ? +c.singleUse : 0);
    return { n, structure: isNum(c.structure) ? +c.structure : 0 };
  }
  function plantSummary(p) {
    const v = V();
    const pv = safe(() => v.plant(p.key), null) || p;
    const s = { p, pv, open: openIssues(p.key).length, dev: deviationsOf(p.key) };
    if (p.state === 'commissioning') {
      const cl = safe(() => v.checklist(p.key), null) || {};
      s.blockers = arr(cl.blockers).length; s.gaps = arr(cl.gaps).length;
    } else {
      const c = safe(() => v.coverage(p.key), null) || {};
      const t = c.triggers || {};
      s.issues = isNum(t.issues) ? +t.issues : null;
      const w = c.window || {};
      s.window = /since go-live/i.test(String(w.label || '')) ? 'since go-live' : isNum(w.days) ? `in the last ${Math.round(+w.days)} days` : 'lately';
    }
    s.score = (s.blockers || 0) * 100 + (p.state === 'commissioning' ? 50 : 0) + s.open * 10;
    return s;
  }
  function sinceText(p) {
    if (p.state === 'live') return '';
    const pv = safe(() => V().plant(p.key), null) || {};
    const since = toMs(pv.commissioningSince != null ? pv.commissioningSince : p.since);
    if (since == null) return '';
    /* the trial's day counts from the first Trigger made active (the core's trialStart), not from the start of Commissioning */
    const day = trialDayAt(p.key, now());
    return day == null ? `Since ${fmt(since)} · trial not started` : `Since ${fmt(since)} · day ${day} of trial`;
  }
  function statusHtml(s) {
    if (s.p.state === 'commissioning') {
      const head = s.blockers ? '<span class="tx-bad">Go live is blocked</span>' : '<span class="tx-ok">Nothing blocks go-live</span>';
      const bits = [plural(s.blockers || 0, 'blocker'), plural(s.gaps || 0, 'gap')];
      return `<span class="cap">Readiness</span>${head}<span class="muted"> · ${bits.join(' · ')}</span>`;
    }
    const head = s.open ? `<span class="tx-warn">${plural(s.open, 'open Issue')}</span>` : '<span class="tx-ok">No open Issues</span>';
    const recent = s.issues != null ? `${plural(s.issues, 'Issue')} ${s.window}` : '';
    return `<span class="cap">Coverage</span>${head}${recent ? `<span class="muted"> · ${recent}</span>` : ''}`;
  }
  function plantsPage() {
    const ps = plants();
    if (!ps.length) return page({ title: 'All Plants', body: empty('No plants loaded. The core of the prototype did not start.') });
    const sums = ps.map(plantSummary).sort((a, b) => b.score - a.score);
    const comm = ps.filter((p) => p.state === 'commissioning').length; const live = ps.filter((p) => p.state === 'live').length;
    const attention = sums.filter((s) => s.blockers || s.open);
    const lead = attention.length
      ? attention.map((s) => `<a href="#/p/${esc(encodeURIComponent(s.p.key))}">${esc(s.p.name)}</a>: ${s.blockers ? `${plural(s.blockers, 'blocker')} before it can go live` : plural(s.open, 'open Issue')}`).join(' · ')
      : 'Nothing needs attention right now.';
    const rows = sums.map((s) => {
      const p = s.p; const pv = s.pv || {}; const key = encodeURIComponent(p.key); const href = `#/p/${key}`;
      const real = p.realLayout === true || p.sample === false;
      const tag = real ? chip('Real plant graph', { tone: 'info' }) : chip('Sample plant', { tone: 'muted' });
      const ups = isNum(pv.upCount) ? +pv.upCount : null; const eqs = isNum(pv.equipmentCount) ? +pv.equipmentCount : null;
      const shape = ups != null && eqs != null ? `${plural(ups, 'unit process', 'unit processes')} · ${plural(eqs, 'piece', 'pieces')} of equipment` : '';
      const dev = s.dev || {};
      return `<li class="prow is-link" data-href="${esc(href)}">`
        + `<div class="prow-name"><a href="${esc(href)}">${esc(p.name)}</a><div class="prow-tags">${chip(p.type || '—', { mono: true })} ${tag}</div>${shape ? `<span class="muted small prow-shape">${esc(shape)}</span>` : ''}</div>`
        + `<div class="prow-state">${stateChip(p.state, { since: p.since })}${sinceText(p) ? `<span class="muted small">${esc(sinceText(p))}</span>` : ''}</div>`
        + `<div class="prow-status">${statusHtml(s)}</div>`
        + `<div class="prow-diff"><a href="#/p/${esc(key)}/deviations">${dev.n != null ? plural(dev.n, 'deviation') : 'Deviations'}</a>${dev.structure ? `<span class="muted small">${esc(plural(dev.structure, 'structure change'))}</span>` : ''}</div>`
        + '<span class="prow-go" aria-hidden="true">›</span></li>';
    }).join('');
    const samples = ps.filter((p) => !(p.realLayout === true || p.sample === false)).map((p) => p.name);
    const reals = ps.filter((p) => p.realLayout === true || p.sample === false).map((p) => p.name);
    const foot = [samples.length ? `${samples.join(', ').replace(/, ([^,]*)$/, ' and $1')} ${samples.length === 1 ? 'is a sample plant' : 'are sample plants'}.` : '', reals.length ? `${reals.join(' and ')}'s plant graph is real; its readings are samples too.` : ''].filter(Boolean).join(' ');
    const body = `<p class="lead${attention.length ? ' has-att' : ''}">${lead}</p>`
      + `<div class="plist"><div class="prow prow-head" aria-hidden="true"><span>Plant</span><span>State</span><span>Readiness or Coverage</span><span>Deviations</span><span></span></div><ul>${rows}</ul></div>`
      + `<p class="foot-note">${esc(foot)}</p>`;
    return page({ title: 'All Plants', sub: `${plural(ps.length, 'plant')} · ${comm} in Commissioning · ${live} Live. The ones that need attention come first.`, chips: [sampleTag()], body, cls: 'pg-plants' });
  }

  /* ── pages: Activity ───────────────────────────────────────────────────────────────────────────────────── */
  let ACT_LIMIT = 150; let ACT_PATH = '';
  const KIND = [     // [id, filter label, row label, chip tone, what the core's kind looks like]
    ['config', 'Changes', 'Change', 'muted', /config|change|limit|override|revert|keep|tier|hold|clear|setting|param|ledger/],
    ['structure', 'Structure', 'Structure', 'muted', /structure|scada|review|identif|member/],
    ['people', 'People', 'People', 'muted', /people|person|phone|roster|routing|verif/],
    ['library', 'Library', 'Library', 'info', /lib|publish|template|pin|draft/],
    ['golive', 'Go live', 'Plant state', 'ok', /golive|go.?live|\blive\b|commission|state/],
    ['issue', 'Issues', 'Issue', 'warn', /issue|fir(e|ing)|emergenc|close|diagnos|fix|verify|report|trial/],
    ['task', 'Tasks', 'Task', 'muted', /task|schedul|due|cadence/],
  ];
  function kindOf(k) {
    const s = String(k || '').toLowerCase();
    for (const [id, label, one, tone] of KIND) if (s === id) return { id, label, one, tone };
    for (const [id, label, one, tone, re] of KIND) if (re.test(s)) return { id, label, one, tone };
    return { id: 'other', label: 'Other', one: 'Note', tone: 'muted' };
  }
  function activityBody(key, query, base) {
    const v = V();
    let rows = arr(safe(() => v.activity(key ? { plant: key } : {}), [])).filter(Boolean);
    if (key) rows = rows.filter((r) => r.plant === key);              // a plant's Activity holds that plant's lines only
    rows = rows.slice().sort((a, b) => (toMs(b.at) || 0) - (toMs(a.at) || 0) || (+b.seq || 0) - (+a.seq || 0));
    const kinds = {}; rows.forEach((r) => { const k = kindOf(r.kind); kinds[k.id] = kinds[k.id] || { label: k.label, n: 0 }; kinds[k.id].n++; });
    const want = query && query.kind && kinds[query.kind] ? query.kind : 'all';
    const shown = want === 'all' ? rows : rows.filter((r) => kindOf(r.kind).id === want);
    const kindChips = Object.keys(kinds).length > 1 ? filters([{ label: 'Everything', href: base, on: want === 'all', count: rows.length }].concat(KIND.concat([['other', 'Other', 'Note']]).filter(([id]) => kinds[id]).map(([id]) => ({ label: kinds[id].label, href: `${base}?kind=${id}`, on: want === id, count: kinds[id].n })))) : '';
    if (!shown.length) return kindChips + empty(key ? 'Nothing has happened at this plant yet.' : 'Nothing has happened yet.');
    let day = ''; let out = '';
    shown.slice(0, ACT_LIMIT).forEach((r) => {
      const ms = toMs(r.at); const d = ms != null ? fmtDay(ms) : '';
      if (d !== day) { if (day) out += '</ul>'; day = d; out += `<h3 class="aday">${esc(d || 'Undated')}</h3><ul class="alist">`; }
      const k = kindOf(r.kind);
      const where = key ? '' : r.plant ? `<a href="#/p/${esc(encodeURIComponent(r.plant))}">${esc(plantName(r.plant))}</a>` : 'All plants';
      const meta = [where, r.who ? esc(r.who) : ''].filter(Boolean).join(' · ');
      const undo = r.undoToken && r.plant && undoKind(r.plant, r.undoToken) ? btn('Undo', { act: 'undo:activity', data: { plant: r.plant, token: r.undoToken }, small: true, kind: 'ghost', cls: 'arow-u', title: 'Undo this while nothing later changed the same rows' }) : '';
      out += `<li class="arow"><span class="arow-t mono">${ms != null ? esc(ownTime(ms)) : ''}</span><div class="arow-m"><div class="arow-x">${txt(r.text || '')}</div>${meta ? `<div class="arow-s">${meta}</div>` : ''}</div>${undo}${chip(k.one, { tone: k.tone })}</li>`;
    });
    if (day) out += '</ul>';
    const more = shown.length > ACT_LIMIT ? `<p class="mt">${btn(`Show ${Math.min(200, shown.length - ACT_LIMIT)} more of ${shown.length - ACT_LIMIT}`, { act: 'ui:act-more' })}</p>` : '';
    return kindChips + `<div class="alog">${out}</div>` + more;
  }
  function resetLimitFor(path) { if (path !== ACT_PATH) { ACT_PATH = path; ACT_LIMIT = 150; } }
  function activityPage(params) {
    const key = params && params.plant && plantOf(params.plant) ? params.plant : null;
    resetLimitFor('activity/' + (key || ''));
    const ps = plants();
    const base = key ? `#/activity/${encodeURIComponent(key)}` : '#/activity';
    const plantChips = filters([{ label: 'All plants', href: '#/activity', on: !key }].concat(ps.map((p) => ({ label: p.name, href: `#/activity/${encodeURIComponent(p.key)}`, on: key === p.key }))));
    return page({
      title: 'Activity',
      sub: 'Changes, structure and people edits, library publishes, go-lives and Issues, newest first. Times are on the story clock (IST).',
      body: plantChips + activityBody(key, params && params._q, base),
      cls: 'pg-activity',
    });
  }
  /* the plant tabs, as the plant frame draws them, for when plant7.js is not loaded */
  function plantTabs(key) {
    const b = `#/p/${encodeURIComponent(key)}`; const live = stateOf(key) === 'live';
    const first = live ? [['home', 'Coverage', b], ['readings', 'Readings', b + '/readings']] : [['home', 'Readiness', b]];
    return first.concat([['structure', 'Structure', b + '/structure'], ['triggers', 'Triggers', b + '/triggers'], ['issues', 'Issues', b + '/issues'], ['tasks', 'Tasks', b + '/tasks'], ['people', 'People', b + '/people'], ['deviations', 'Deviations', b + '/deviations'], ['activity', 'Activity', b + '/activity']]).map(([id, label, href]) => ({ id, label, href }));
  }
  function plantActivityPage(params) {
    const key = params.plant; const p = plantOf(key);
    if (!p) return page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', body: empty('This plant is not in the prototype.', btn('All Plants', { href: '#/plants' })) });
    resetLimitFor('p/' + key + '/activity');
    const base = `#/p/${encodeURIComponent(key)}/activity`;
    const body = section('Activity', activityBody(key, params._q, base), { sub: 'Everything that changed at this plant, newest first.' });
    const P = W.V7PLANT;
    if (P && typeof P.frame === 'function') { const out = safe(() => P.frame(key, 'activity', body), null); if (typeof out === 'string' && out) return out; }
    const real = p.realLayout === true || p.sample === false;
    return page({
      crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name }], title: p.name,
      chips: [chip(p.type || '', { mono: true }), stateChip(p.state, { since: p.since }), real ? chip('Real plant graph', { tone: 'info' }) : chip('Sample plant', { tone: 'muted' })],
      tabs: plantTabs(key), active: 'activity', body,
    });
  }
  route('plants', plantsPage);
  route('activity/:plant?', activityPage);
  route('p/:plant/activity', plantActivityPage);

  /* ── render loop ───────────────────────────────────────────────────────────────────────────────────────── */
  let STARTED = false; let MAIN = null; let LAST_PATH = null; const AFTER = [];
  function afterRender(fn) { if (typeof fn === 'function') AFTER.push(fn); }
  function captureFocus() {
    const a = hasDom() ? document.activeElement : null;
    if (!a || !MAIN || !MAIN.contains(a) || a === MAIN) return null;
    let sel = null;
    if (a.id) sel = '#' + (W.CSS && W.CSS.escape ? W.CSS.escape(a.id) : a.id);
    else if (a.getAttribute && a.getAttribute('data-act')) sel = `[data-act="${a.getAttribute('data-act')}"]${a.name ? `[name="${a.name}"]` : ''}`;
    else if (a.name) sel = `[name="${a.name}"]`;
    if (!sel) return null;
    let s0 = null; let s1 = null; try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) { /* ignore */ }
    return { sel, s0, s1 };
  }
  function restoreFocus(f) {
    if (!f || !MAIN) return;
    try { const el = MAIN.querySelector(f.sel); if (!el) return; el.focus({ preventScroll: true }); if (f.s0 != null && el.setSelectionRange) el.setSelectionRange(f.s0, f.s1); } catch (e) { /* ignore */ }
  }
  function render() {
    if (!STARTED || !hasDom() || !MAIN) return;
    const sp = splitPath(hashNow());
    const key = sp.path + '?' + sp.query;
    const changed = key !== LAST_PATH;
    const f = changed ? null : captureFocus();
    MAIN.innerHTML = renderPath(hashNow());
    const nav = q('#tbNav'); if (nav) nav.innerHTML = navHtml(sp.path);
    const ck = q('#clockNow'); if (ck) ck.textContent = fmt(now());
    const same = q('#tbSame'); if (same) same.setAttribute('href', samePlaceHref(sp.path));
    paintStory();
    highlightStory(sp.path, false);
    if (changed) { try { W.scrollTo(0, 0); } catch (e) { /* ignore */ } } else restoreFocus(f);
    LAST_PATH = key;
    AFTER.forEach((fn) => { try { fn(MAIN, sp.path); } catch (e) { console.error(e); } });
  }
  function start(opts) {
    if (STARTED) { render(); return; }
    const v = V();
    if (v && v.boot && !(opts && opts.noBoot)) safe(() => v.boot(), null);
    if (!hasDom()) return;
    STARTED = true;
    const root = q('#app') || document.body;
    const path = splitPath(hashNow()).path;
    STORY_HTML = storyHtml('');
    root.innerHTML = topbarHtml(path) + `<div class="layout"><main class="main" id="main" tabindex="-1"></main><aside class="story" id="story" aria-label="The story">${STORY_HTML}</aside></div>`;
    MAIN = q('#main');
    let open = null;
    const wide = (W.innerWidth || 1280) >= 900;                     // on a phone the drawer starts closed
    try { const s = W.localStorage.getItem(STORY_KEY); if (wide && (s === '1' || s === '0')) open = s === '1'; } catch (e) { /* ignore */ }
    if (open == null) open = (W.innerWidth || 1280) >= 1100;
    document.body.classList.toggle('story-open', open);
    const sb = q('.tb-story'); if (sb) sb.setAttribute('aria-pressed', String(open));
    document.addEventListener('click', onClick);
    document.addEventListener('change', onField);
    document.addEventListener('input', onField);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKey);
    W.addEventListener('hashchange', render);
    const hs = hashNow();
    if (!hs || hs === '#' || hs === '#/') { try { W.history.replaceState(null, '', '#/plants'); } catch (e) { W.location.hash = '#/plants'; } }
    render();
    highlightStory(splitPath(hashNow()).path, true);
  }

  W.V7UI = {
    // kit
    esc, txt, plain, h, page, chip, chipHtml, sourceChip, stateChip, sampleTag, sev, bandName, BANDS, bandOf, bandBar, table, card, section, kv, list, empty,
    note, banner, stats, filters, progress, field, radios, btn, link, phone, num, numEnd, rate, dur, formAnswers, plural, fmt, fmtDay, plantName, isNum,
    // dom
    openSheet, refreshSheet, closeSheet, sheetEl, modal, closeModal, confirm, toast, copy, addCss,
    // events + router + shell
    on, route, go, render, current, match, routes, renderPath, afterRender, start, advance,
    chapters, chapterOf, chromeHtml, storyHtml, samePlaceHref, VERSIONS,
    // test hooks
    _soft: SOFT, _last: LAST, _handlers: HANDLERS, _pages: { plantsPage, activityPage, plantActivityPage },
    _story: { ctx, baseCtx, STORY_IDS, DEC_LABEL, STORY_KEY, resetText, advanceText, undoKind },
  };
}());
