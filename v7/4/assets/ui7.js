/* v7 · ui7.js · window.V7UI — UI kit, router, shell, story panel, All Plants, Activity.

   Loads after core7.js (window.V7) and before the page modules. Reads V7 lazily and defensively: every call into
   V7 goes through safe(), so a missing or failing core function degrades the page instead of blanking it (the
   smoke harness lists those as soft errors).

   KIT (pure string builders; text is escaped unless it already contains markup, so chip()/link() html can be passed)
     esc(s) · txt(s) (escape plain text, pass html through) · h(tag, attrs, innerHtml)
     page({crumbs:[{label,href}], title, sub, chips:[html], actions:[html], tabs:[{id,label,href,count}], active, body, aside, banner})
     chip(text,{tone:'lib'|'form'|'changed'|'libchanged'|'none'|'next'|'ok'|'warn'|'bad'|'info'|'sample'|'muted', title, href, mono})
     sourceChip(perBand) · stateChip(state) · sampleTag() · sev(band) · bandName(band) · BANDS
     bandBar({dir:'above'|'below', bands:{caution,minor,major,emergency}, value, valid:[min,max], unit, compact})
     bandOf(value, dir, bands) → deepest band crossed or null
     table({cols:[{label,key,cls,render(row)}], rows, empty, cls, scroll})   rows: objects (or arrays); row._href (or row.href) makes it a link
                                                                             cells are html-or-text (see txt)
     card({title, sub, body, actions:[html], tone:'bad'|'warn'|'ok'|'info'|'quiet', id, cls, foot})
     section(title, body, {sub, actions}) · kv([[k,v]]) · list(items) (items: html or {title, sub, href, right, chips, tone})
     empty(text, actionHtml) · note(text, tone) · banner(text,{tone, action}) · stats([{value,label,tone}])
     filters([{label, href|act, data, on, count}]) · progress(done,total) · field({label, hint, html}) · radios({name, options:[{value,label,sub}], value, act})
     btn(label,{href, act, data, kind:'primary'|'secondary'|'ghost'|'danger', disabled, title, small, id})
     link(label, href) · phone(innerHtml, {caption}) · num(v, unit) · plural(n, one, many) · fmt(ms) · fmtDay(ms) · plantName(key)
   DOM (stateful; no-ops when there is no document)
     openSheet({title, sub, body, foot, onBind(el), onClose, wide}) · refreshSheet({title?, sub?, body?, foot?}) · closeSheet() · sheetEl()
     modal({title, sub, body, foot, onBind(el), onClose, wide}) · closeModal() · confirm({title, body, ok, kind, onOk})
     toast(text, {undo, ms}) · copy(text) → Promise<boolean> · addCss(href)
   EVENTS  buttons carry data-act="name" + data-*; modules register V7UI.on('name', (el, ev) => …). The shell delegates
     clicks (and change events; input events too when the field has data-live) and then persists and re-renders the
     page, unless the handler returns false. Forms with data-act are handled on submit. Rows with data-href navigate.
     Built-in actions: ui:close (data-what=sheet|modal), ui:story, ui:clock, ui:advance (data-min), ui:reset, ui:confirm.
   ROUTER  route(pattern, renderFn) e.g. 'p/:plant/eq/:id/:tab?' → renderFn(params) returns an html string.
     params also carry _q (query object from '?a=b') and _path. The most literal match wins. Unknown → All Plants.
     Every routed page gets window.V7DEC.markerHtml(V7_VARIANT, _path) (the decisions strip) right after its page
     header, before the tabs; route().fn is that wrapper, route().raw the module's own renderFn.
     go(hash) · render() · current() → {path, params, pattern} · match(path) · routes() · renderPath(path) · afterRender(fn)
   SHELL   start() boots V7, builds the top bar + story panel and renders. chromeHtml() returns that html (for tests).
     The top bar carries a badge naming this prototype ("v7/1 · Recommended approach") that links to the v7 overview, and,
     once v7/2 is published (V7DEC.V72_READY), "Same place in v7/2 →" for the current page's chapter.
   STORY   chapters() → the 12 chapters with live deep links, each with cmp72 (the same moment in v7/2) and, once v7/2 is
          published, compare72 {href, target, label}; chapterOf(path) → 1…12 or 0.
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
  /* v7: Visualization answer in plain words with units ("Motor rating 3.7 kW", "Length 9 m"), the same on every page */
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
  function link(label, href, o) { return `<a href="${esc(href)}"${attr('class', o && o.cls)}${attr('title', o && o.title)}>${txt(label)}</a>`; }

  function chip(text, o) {
    o = o || {};
    const cls = 'chip' + (o.tone ? ' chip-' + o.tone : '') + (o.mono ? ' mono' : '') + (o.cls ? ' ' + o.cls : '');
    if (o.href) return `<a class="${cls}" href="${esc(o.href)}"${attr('title', o.title)}>${txt(text)}</a>`;
    return `<span class="${cls}"${attr('title', o.title)}>${txt(text)}</span>`;
  }
  /* v7/4: a word the product uses, with what it means on hover or focus, instead of a paragraph */
  const TERMS = { 'unit process': 'One treatment step: a tank or reactor and the equipment that serves it.', 'unit processes': 'One treatment step each: a tank or reactor and the equipment that serves it.', 'control group': 'A duty/standby set that runs as one.', 'control groups': 'Duty/standby sets that each run as one.', deviation: 'A value this plant changed away from the library.', deviations: 'Values a plant changed away from the library.', criticality: 'How much the plant depends on this equipment.', 'On trial': 'The alert runs and its firings are counted, but nobody is told.' };
  function term(word, shown) { const t = TERMS[word] || TERMS[String(word).toLowerCase()]; return t ? `<abbr class="term" tabindex="0" title="${esc(t)}">${esc(shown || word)}</abbr>` : esc(shown || word); }
  function sampleTag(text) { return chip(text || 'Sample readings', { tone: 'sample', title: 'Readings here are generated samples, not from the Visualization' }); }

  const SRC = {
    lib: ['Follows the library', 'lib'], form: ['From the Visualization', 'form'], changed: ['Plant’s own value', 'changed'],
    libchanged: ['Library changed since', 'libchanged'], none: ['No limits yet', 'none'], next: ['Next phase', 'next'],
    notinlib: ['Not in the library', 'changed'],   /* v7: a task neither the library nor the Visualization has, with no difference recorded */
  };
  const SRC_ALIAS = { library: 'lib', fromlibrary: 'lib', scada: 'form', override: 'changed', here: 'changed', moved: 'libchanged', gap: 'none', nolimits: 'none', nextphase: 'next' };
  function srcKind(x) {
    if (!x) return null;
    const k = String(x).toLowerCase(); const kk = k.replace(/[^a-z]/g, '');
    if (SRC[kk]) return kk; if (SRC_ALIAS[kk]) return SRC_ALIAS[kk];
    if (/library changed/.test(k)) return 'libchanged';
    if (/not in the library/.test(k)) return 'notinlib';
    if (/from the library/.test(k)) return 'lib';
    if (/scada form/.test(k)) return 'form';
    if (/changed here/.test(k)) return 'changed';
    if (/no limits/.test(k)) return 'none';
    if (/next phase/.test(k)) return 'next';
    return null;
  }
  function sourceChip(pb) {
    if (pb == null) return chip(SRC.none[0], { tone: 'none' });
    if (typeof pb === 'string') { const k = srcKind(pb) || 'lib'; return chip(pb, { tone: SRC[k][1] }); }
    const k = srcKind(pb.chip) || srcKind(pb.chipText) || (pb.value == null ? 'none' : 'lib');
    const text = pb.chipText || SRC[k][0];
    let title = '';
    if ((k === 'changed' || k === 'libchanged') && pb.libValue != null) {
      title = `Library value ${pb.libValue}` + (pb.base != null && String(pb.base) !== String(pb.libValue) ? `; it was ${pb.base} when this was changed` : '');
    }
    return chip(text, { tone: SRC[k][1], title });
  }

  const ST = {
    commissioning: ['Commissioning', 'comm'], live: ['Live', 'live'], draft: ['Draft', 'draft'], trial: ['On trial', 'trial'],
    'on trial': ['On trial', 'trial'], ontrial: ['On trial', 'trial'], on: ['On', 'on'], active: ['On', 'on'], off: ['Off', 'off'],
  };
  function stateChip(state, o) {
    const k = String(state || '').toLowerCase().replace(/_/g, ' ').trim();
    const v = ST[k] || [cap(state || 'Unknown'), 'off'];
    return `<span class="chip st st-${v[1]}"${attr('title', o && o.title)}>${esc(v[0])}</span>`;
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

  /* v7: the threshold bar — the product's threshold-setting control (range min and max, a coloured bar, a handle per line with its value
     under it), with v7's four lines on each side. o: {active:'above'|'below'|'both', sides:{above:{band:value},below:{…}} (only the sides
     the reading has), range:[lo,hi] (scale only), value, unit, kind, step, tasks:{band:name} or {'dir:band':name} (lines that raise a
     task), otherLabel, editOther, hint, valueButtons (each value a button that calls onPick: no typed input on the bar)}. With one side active its value inputs carry data-band (the limits sheet reads them like any input);
     with both, data-zone="dir.band". tbHtml renders it; tbSync(root,o) moves regions and handles in place (inputs keep focus while you
     type or drag); tbBind(root,{get, onValue(band,value,dir), onRange(lo,hi), onEnd(band,dir)}) wires the drag, the arrow keys and the
     range boxes. */
  const TB_ICON = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M8 1.6 15 14H1z" fill="currentColor"/><path d="M8 6v3.6M8 11.4v.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const TB_PEN = '<svg class="thb-pen" viewBox="0 0 16 16" width="11" height="11" aria-hidden="true"><path d="M2 11.6V14h2.4l7.1-7.1-2.4-2.4zM13.7 4.7a.8.8 0 0 0 0-1.1l-1.3-1.3a.8.8 0 0 0-1.1 0l-1 1 2.4 2.4z" fill="currentColor"/></svg>';
  const tbSidesOn = (o) => (o.active === 'both' ? ['below', 'above'].filter((d) => (o.sides || {})[d]) : [o.active]);
  const tbTask = (o, dir, b) => { const t = o.tasks || {}; return o.active === 'both' ? t[`${dir}:${b}`] : t[b]; };
  function tbRegions(o) {
    const lo = +o.range[0], hi = +o.range[1]; const regs = []; const S = o.sides || {}; const on = tbSidesOn(o);
    const side = (dir) => (S[dir] ? BANDS.filter((b) => isNum(S[dir][b])).map((b) => ({ b, t: +S[dir][b], dir })) : []);
    const below = side('below'), above = side('above');
    // below: deepest band at the bottom of the scale; each band runs from its own line down to the next deeper one
    below.forEach((x, i) => regs.push({ b: x.b, dir: 'below', off: !on.includes('below'), a: i + 1 < below.length ? below[i + 1].t : lo, z: x.t }));
    above.forEach((x, i) => regs.push({ b: x.b, dir: 'above', off: !on.includes('above'), a: x.t, z: i + 1 < above.length ? above[i + 1].t : hi }));
    regs.push({ b: 'ok', dir: null, off: false, a: below.length ? below[0].t : lo, z: above.length ? above[0].t : hi });
    return regs;
  }
  const tbRegHtml = (o) => tbRegions(o).map((r, i) => `<span class="thb-reg thb-${r.b}${r.off ? ' thb-off' : ''}" data-reg="${i}"></span>`).join('');
  function tbPos(o, v) { const lo = +o.range[0], hi = +o.range[1]; return clamp(((v - lo) / ((hi - lo) || 1)) * 100, 0, 100); }
  /* handles closer than one label's width go down a row (as many rows as it takes); gap is that width as % of the track */
  function tbRows(o, gap) {
    const g = isNum(gap) ? +gap : 28; const hs = [];
    tbSidesOn(o).forEach((dir) => { const S = (o.sides || {})[dir] || {}; BANDS.filter((b) => isNum(S[b])).forEach((b) => hs.push({ b, dir, k: `${dir}:${b}`, v: +S[b], p: tbPos(o, +S[b]) })); });
    hs.sort((x, y) => x.p - y.p);
    const ends = []; hs.forEach((h) => { let r = 0; while (ends[r] != null && h.p - ends[r] < g) r++; ends[r] = h.p; h.row = r; });
    return hs;
  }
  function tbHandle(o, h) {
    const unit = o.unit || ''; const both = o.active === 'both'; const name = both ? `${bandName(h.b)} ${h.dir === 'below' ? 'low' : 'high'}` : bandName(h.b);
    const inp = both ? `data-zone="${h.dir}.${h.b}"` : `data-band="${h.b}"`; const task = tbTask(o, h.dir, h.b);
    return `<div class="thb-h thb-h-${h.b}" data-h="${h.k}">`
      + `<span class="thb-stem"></span><span class="thb-pin" role="slider" tabindex="0" aria-label="${esc(name)} line" aria-valuemin="${esc(o.range[0])}" aria-valuemax="${esc(o.range[1])}" aria-valuenow="${esc(h.v)}">${TB_ICON}</span>`
      + `<span class="thb-lab">${esc(name)}</span>`
      + (o.valueButtons ? `<button type="button" class="thb-val thb-valb" ${inp} aria-label="${esc('Change the ' + name + ' line')}"><span class="thb-v">${esc(h.v)}</span><span class="thb-u">${esc(unit)}</span>${TB_PEN}</button>`
        : `<label class="thb-val"><input type="number" step="any" inputmode="decimal" ${inp} value="${esc(h.v)}" aria-label="${esc(name)} limit"><span class="thb-u">${esc(unit)}</span>${TB_PEN}</label>`)
      + (task ? `<span class="thb-task" title="${esc('Raises the task: ' + task)}">raises a task</span>` : '') + '</div>';
  }
  function tbHtml(o) {
    const unit = o.unit || '';
    const handles = tbRows(o).map((h) => tbHandle(o, h)).join('');
    const now = isNum(o.value) ? `<span class="thb-now" data-now><b>Now ${esc(num(o.value, unit))}</b></span>` : '';
    const keys = ['ok', ...BANDS].map((b) => `<span class="thb-key"><i class="thb-${b}"></i>${esc(b === 'ok' ? 'Safe' : bandName(b))}</span>`).join('');
    const other = o.otherLabel ? `<span class="thb-other"><i class="thb-key-off"></i>${esc(o.otherLabel)}${o.editOther ? ' ' + o.editOther : ''}</span>` : '';
    return `<div class="thb" data-active="${esc(o.active)}">`
      + `<div class="thb-range"><label class="thb-box"><span>Range min</span><input type="number" step="any" class="thb-lo" value="${esc(o.range[0])}" aria-label="Range min"></label>`
      + `<p class="thb-hint">${esc(o.hint || 'Drag a line, or type its value. The range only sets the scale; it is not saved.')}</p>`
      + `<label class="thb-box"><span>Range max</span><input type="number" step="any" class="thb-hi" value="${esc(o.range[1])}" aria-label="Range max"></label></div>`
      + `<div class="thb-bar"><div class="thb-track">${tbRegHtml(o)}</div>${now}<div class="thb-hs">${handles}</div></div>`
      + `<div class="thb-legend">${keys}${other}</div></div>`;
  }
  function tbSync(root, o) {
    if (!root || !root.querySelector) return;
    const regs = tbRegions(o);
    if (root.querySelectorAll('.thb-reg').length !== regs.length) { const t = root.querySelector('.thb-track'); if (t) t.innerHTML = tbRegHtml(o); }
    root.querySelectorAll('.thb-reg').forEach((el, i) => { const r = regs[i]; if (!r) return; const l = tbPos(o, Math.min(r.a, r.z)); const w = r.z < r.a ? 0 : tbPos(o, Math.max(r.a, r.z)) - l; el.style.left = l.toFixed(2) + '%'; el.style.width = Math.max(0, w).toFixed(2) + '%'; el.classList.toggle('thb-off', !!r.off); });
    const tr = root.querySelector('.thb-track'); const tw = tr && tr.getBoundingClientRect ? tr.getBoundingClientRect().width : 0;
    const rows = tbRows(o, tw > 0 ? (112 / tw) * 100 : 28); const depth = rows.reduce((m, h) => Math.max(m, h.row), 0);
    const hsBox = root.querySelector('.thb-hs'); if (hsBox) hsBox.style.height = (92 + depth * 82) + 'px';
    rows.forEach((h) => {
      const el = root.querySelector(`.thb-h[data-h="${h.k}"]`); if (!el) return;
      el.style.left = h.p.toFixed(2) + '%'; el.style.setProperty('--row', String(h.row)); el.classList.toggle('al-l', h.p < 8); el.classList.toggle('al-r', h.p > 92);
      let tk = el.querySelector('.thb-task'); const want = tbTask(o, h.dir, h.b);
      if (want && !tk) { el.insertAdjacentHTML('beforeend', '<span class="thb-task">raises a task</span>'); tk = el.querySelector('.thb-task'); }
      if (tk) { if (want) tk.title = 'Raises the task: ' + want; else tk.remove(); }
      const pin = el.querySelector('.thb-pin'); if (pin) pin.setAttribute('aria-valuenow', String(h.v));
      const inp = el.querySelector('input'); if (inp && document.activeElement !== inp && String(inp.value) !== String(h.v)) inp.value = h.v;
      const vb = el.querySelector('.thb-v'); if (vb && vb.textContent !== String(h.v)) vb.textContent = String(h.v);
    });
    const nw = root.querySelector('[data-now]'); if (nw && isNum(o.value)) nw.style.left = tbPos(o, +o.value).toFixed(2) + '%';
  }
  function tbStep(o) { const span = Math.abs(+o.range[1] - +o.range[0]) || 1; if (isNum(o.step)) return +o.step; const raw = span / 200; const p = Math.pow(10, Math.floor(Math.log10(raw))); return [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw) || p; }
  function tbSnap(o, v) { const st = tbStep(o); const d = Math.max(0, -Math.floor(Math.log10(st) + 1e-9)); return +((Math.round(v / st) * st).toFixed(d)); }
  /* a line stays between its neighbours on its side (each band goes further out) */
  function tbClampLine(o, b, v, dir) {
    const side = dir || (o.active === 'both' ? 'above' : o.active);
    const S = (o.sides || {})[side] || {}; const set = BANDS.filter((x) => isNum(S[x]) || x === b); const i = set.indexOf(b); const st = tbStep(o);
    const prev = i > 0 ? +S[set[i - 1]] : null; const next = i + 1 < set.length ? +S[set[i + 1]] : null;
    const lo = +o.range[0], hi = +o.range[1]; let x = clamp(v, Math.min(lo, hi), Math.max(lo, hi));
    if (side === 'above') { if (prev != null) x = Math.max(x, prev + st); if (next != null) x = Math.min(x, next - st); }
    else { if (prev != null) x = Math.min(x, prev - st); if (next != null) x = Math.max(x, next + st); }
    return tbSnap(o, x);
  }
  function tbBind(root, h) {
    if (!root || root._tbBound || typeof root.addEventListener !== 'function') return; root._tbBound = true;
    let drag = null;
    const keyOf = (el) => { const hd = el && el.closest ? el.closest('.thb-h') : null; if (!hd) return null; const k = String(hd.getAttribute('data-h') || ''); const i = k.indexOf(':'); return { hd, dir: k.slice(0, i), b: k.slice(i + 1) }; };
    const valueAt = (o, clientX) => { const tr = root.querySelector('.thb-track'); const r = tr.getBoundingClientRect(); const f = clamp((clientX - r.left) / (r.width || 1), 0, 1); return +o.range[0] + f * (+o.range[1] - +o.range[0]); };
    root.addEventListener('pointerdown', (ev) => { const t = ev.target.closest && ev.target.closest('.thb-pin, .thb-stem, .thb-lab'); if (!t) return; const k = keyOf(t); if (!k) return; drag = k; k.hd.classList.add('is-drag'); try { t.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } ev.preventDefault(); });
    root.addEventListener('pointermove', (ev) => { if (!drag) return; const o = h.get(); h.onValue(drag.b, tbClampLine(o, drag.b, valueAt(o, ev.clientX), drag.dir), drag.dir); });
    const end = () => { if (!drag) return; const d = drag; d.hd.classList.remove('is-drag'); drag = null; if (h.onEnd) h.onEnd(d.b, d.dir); };
    root.addEventListener('pointerup', end); root.addEventListener('pointercancel', end);
    root.addEventListener('click', (ev) => { const bt = ev.target.closest && ev.target.closest('.thb-valb'); if (!bt || !h.onPick) return; const k = keyOf(bt); if (k) h.onPick(k.b, k.dir); });
    root.addEventListener('keydown', (ev) => {
      const pin = ev.target.closest && ev.target.closest('.thb-pin'); if (!pin) return; const k = keyOf(pin); if (!k) return; const o = h.get();
      const S = (o.sides || {})[k.dir] || {}; const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[ev.key]; if (!step) return;
      ev.preventDefault(); h.onValue(k.b, tbClampLine(o, k.b, +S[k.b] + step * tbStep(o), k.dir), k.dir); if (h.onEnd) h.onEnd(k.b, k.dir);
    });
    root.addEventListener('change', (ev) => {
      const t = ev.target; if (!t || !t.classList) return;
      if (t.classList.contains('thb-lo') || t.classList.contains('thb-hi')) { const lo = root.querySelector('.thb-lo'), hi = root.querySelector('.thb-hi'); if (h.onRange && isNum(lo.value) && isNum(hi.value) && +hi.value > +lo.value) h.onRange(+lo.value, +hi.value); return; }
      const z = t.getAttribute && t.getAttribute('data-zone'); if (z && h.onTyped) { const [dir, b] = z.split('.'); if (isNum(t.value)) h.onTyped(b, +t.value, dir); }
    });
  }
  /* the scale a threshold bar starts on: what the reading can read, else around its lines and its value */
  function tbRange(valid, vals, value) {
    if (Array.isArray(valid) && isNum(valid[0]) && isNum(valid[1]) && +valid[1] > +valid[0]) return [+valid[0], +valid[1]];
    const pts = vals.filter(isNum).map(Number).concat(isNum(value) ? [+value] : []);
    if (!pts.length) return [0, 100];
    const mn = Math.min(...pts), mx = Math.max(...pts), span = (mx - mn) || Math.abs(mx) || 1;
    const nice = (x, up) => { const p = Math.pow(10, Math.floor(Math.log10(Math.abs(span)) || 0)); return (up ? Math.ceil(x / p) : Math.floor(x / p)) * p; };
    return [mn >= 0 ? Math.max(0, nice(mn - span * 0.5, false)) : nice(mn - span * 0.5, false), nice(mx + span * 0.5, true)];
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
    const words = set.length ? `${dir === 'below' ? 'Falls below' : dir === 'above' ? 'Rises above' : 'Limits'}: ${set.map((x) => `${bandName(x.b)} ${num(x.t)}`).join(', ')}${unit ? ' ' + unit : ''}` : 'No limits yet';
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
    const tb = tabs.length ? `<nav class="tabs" role="tablist">${tabs.map((t) => `<a class="tab${t.id === o.active ? ' on' : ''}" href="${esc(t.href || '#')}" role="tab"${t.id === o.active ? ' aria-selected="true"' : ''}>${txt(t.label)}${t.count != null && t.count !== '' ? `<span class="tab-n">${esc(t.count)}</span>` : ''}${t.flag ? `<span class="tab-flag" title="${esc('Incomplete: ' + t.flag)}" aria-label="${esc('Incomplete: ' + t.flag)}">!</span>` : ''}</a>`).join('')}</nav>` : '';
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
  let toastT = null;
  function toast(text, o) {
    o = o || {}; LAST.toast = plain(text);
    if (!hasDom()) return null;
    const old = q('#v7toast'); if (old) old.remove();
    const el = document.createElement('div'); el.className = 'toast'; el.id = 'v7toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<span>${txt(text)}</span>${o.undo ? '<button type="button" class="toast-u">Undo</button>' : ''}<button type="button" class="toast-x" aria-label="Dismiss">×</button>`;
    document.body.appendChild(el);
    const u = q('.toast-u', el); if (u) u.onclick = () => { try { o.undo(); } catch (e) { console.error(e); } el.remove(); persist(); render(); };
    const x = q('.toast-x', el); if (x) x.onclick = () => el.remove();
    raf(() => { if (el.classList) el.classList.add('open'); });
    clearTimeout(toastT); toastT = setTimeout(() => { try { el.remove(); } catch (e) { /* ignore */ } }, o.ms || 5600);
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
    // integrator: prototype.html links every module stylesheet; skip one already linked (compared without ?v=)
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
  /* v7/4: the notes for reviewers (decisions on a screen, the story, version links) are off the working screens unless Review is on */
  function reviewOn() { try { return W.localStorage.getItem('ctl74.review') === '1'; } catch (e) { return false; } }
  function setReview(on) { if (!hasDom()) return; document.body.classList.toggle('rv-on', !!on); const b = q('.tb-review'); if (b) b.setAttribute('aria-pressed', String(!!on)); try { W.localStorage.setItem('ctl74.review', on ? '1' : '0'); } catch (e) { /* ignore */ } if (!on) setStory(false, true); }
  on('ui:review', () => { setReview(!document.body.classList.contains('rv-on')); return false; });
  on('ui:clock', (el) => { const box = el.closest('.tb-clock'); if (box) { const open = !box.classList.contains('open'); box.classList.toggle('open', open); el.setAttribute('aria-expanded', String(open)); } return false; });
  on('ui:advance', (el) => { closeMenus(); advance(+el.getAttribute('data-min') || 60); });
  on('ui:reset', () => {
    closeMenus();
    confirm({
      title: 'Reset the story?',
      body: 'Every plant goes back to Thu 29 Oct, 09:00: DigitalPaani just read from the Visualization, Vedanta ETP on day 6 of its trial, Manesar STP and Bawal WTP Live. Everything you changed is cleared. Your calls on the Decisions page are kept.',
      ok: 'Reset the story', kind: 'danger',
      onOk: () => {
        const v = V(); safe(() => v && (v.reset ? v.reset() : v.boot && v.boot()), null);
        persist(); paintStory();
        toast('The story is back at its start: ' + fmt(now()) + '.');
        go('#/plants'); return false;
      },
    });
    return false;
  });
  on('ui:act-more', () => { ACT_LIMIT += 200; });

  function advance(min) {
    const v = V();
    if (!v || !v.advance) { toast('The clock cannot move in this build.'); return; }
    const r = safe(() => v.advance(min), {}) || {};
    const n = (x) => arr(x).length;
    const parts = [];
    if (n(r.opened)) {
      const where = [...new Set(arr(r.opened).map((i) => i && i.plant).filter(Boolean))].map(plantName);
      parts.push(`${plural(n(r.opened), 'issue')} opened${where.length ? ' at ' + where.join(', ') : ''}`);
    }
    if (n(r.closed)) parts.push(`${n(r.closed)} closed`);
    if (n(r.trial)) parts.push(plural(n(r.trial), 'trial firing'));
    if (n(r.tasksDue)) parts.push(`${plural(n(r.tasksDue), 'task')} due`);
    toast(`Time moved on to ${fmt(now())}. ${parts.length ? parts.join(' · ') + '.' : 'Nothing new happened.'}`, { ms: 7000 });
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
    try { const v0 = V(); if (v0 && v0.autoSetup) arr(v0.plants()).forEach((p) => { if (p.state === 'commissioning') v0.autoSetup(p.key); }); } catch (e) { /* the page still renders */ }
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
  const NAV = [['All Plants', '#/plants', /^(plants|p)$/], ['Library', '#/library', /^library$/], ['Flows', '#/flows', /^flows$/], ['Visualization', '#/visualization', /^(visualization|ingest)$/], ['User Center', '#/users', /^users$/], ['Activity', '#/activity', /^activity$/], ['Decisions', '#/decisions', /^decisions$/]];
  function navHtml(path) {
    const first = String(path || '').split('/')[0] || 'plants';
    const diffs = /^p\/[^/]+\/differences/.test(path || '');
    const acts = /^p\/[^/]+\/activity/.test(path || '');
    return NAV.map(([label, href, re]) => {
      let onNow = re.test(first);
      if (label === 'All Plants' && (diffs || acts)) onNow = true;
      const fl = label === 'Flows' && W.V7FLAG73 ? W.V7FLAG73.flowsCount() : 0;
      return `<a href="${href}"${onNow ? ' class="on" aria-current="page"' : ''}>${esc(label)}${fl ? `<span class="tab-flag" title="${fl} flows are incomplete" aria-label="${fl} flows are incomplete">!</span>` : ''}</a>`;
    }).join('');
  }
  /* v7: which of the two prototypes this is, linking to the v7 overview that sets them side by side */
  const VERSIONS = { 1: ['v7/1', 'Recommended approach'], 2: ['v7/2', 'Alex\'s model'], 3: ['v7/4', 'Decided build · two libraries'] };
  function versionBadge() {
    const v = VERSIONS[W.V7_BUILD === '3' ? 3 : String(W.V7_VARIANT) === '2' ? 2 : 1];
    return `<a class="tb-ver" href="../index.html" title="The v7 overview: both approaches side by side"><b>${esc(v[0])}</b><span> · ${esc(v[1])}</span></a>`;
  }
  /* the same moment in v7/2, Alex's model as drafted: shown only once v7/2 is published, and opened in its own window */
  function v72Ready() { const D = W.V7DEC; return !!(D && D.V72_READY === true); }
  function v72Href(route) {
    const r = route || '#/plants'; const D = W.V7DEC;
    const h = D && typeof D.hrefFor === 'function' ? safe(() => D.hrefFor('2', r), '') : '';
    return typeof h === 'string' && h ? h : `../2/prototype.html${r}`;
  }
  function samePlace72(path) { const n = chapterOf(path || ''); return v72Href(CMP72[n] || '#/plants'); }
  function samePlaceHtml(path) {
    if (!v72Ready()) return '';
    return `<a class="tb-ver tb-same" id="tbSame" href="${esc(samePlace72(path))}" target="v7-2" title="Opens the same moment in v7/2, Alex's model as drafted"><span>Same place in </span><b>v7/2</b> →</a>`;
  }
  function topbarHtml(path) {
    return `<header class="tb"><a class="tb-brand" href="#/plants">CloseTheLoop<span> · Configuration</span></a>${versionBadge()}${samePlaceHtml(path)}`
      + `<nav class="tb-nav" id="tbNav" aria-label="Main">${navHtml(path)}</nav>`
      + `<div class="tb-right"><button type="button" class="tb-btn tb-review" data-act="ui:review" aria-pressed="false" title="Show or hide the notes for reviewers: decisions on each screen, the story, and the version links">Review</button>`
      + `<button type="button" class="tb-btn tb-story" data-act="ui:story" aria-pressed="false" aria-controls="story">Story</button>`
      + `<button type="button" class="tb-btn tb-reset" data-act="ui:reset">Reset the story</button></div></header>`;
  }

  /* ── story panel ───────────────────────────────────────────────────────────────────────────────────────── */
  const DEC_LABEL = {
    D1: 'Tanks hold their own readings', D2: 'Readiness and one checklist', D3: 'What is sent during commissioning', D4: 'Which plant tells which part',
    D5: 'Sample readings and replay', D6: 'How a plant keeps a change', D7: 'One task per type', D8: 'A trial for each alert',
    D9: 'The Visualization is the only source', D10: 'One editor, phone and console', D11: 'Who a library change reaches', D12: 'Manual and lab readings',
    D13: 'Who is told, and how fast', D14: 'Words on screen', D15: 'Open issues keep their terms', D16: 'What an issue is about',
    D17: 'Library versions', D18: 'Where limits come from', D19: 'First due dates', D20: 'Sludge pumps and the pipes', D21: 'When an alert is noisy',
    D22: 'Shared tasks on the review', D23: 'Safety changes and open issues', D24: 'Trial firings kept or recounted', D25: 'Old library numbers at a plant',
    D26: 'Criticality from what it serves', D27: 'Achievements from v6',
  };
  /* a chip names its card the way the card does (its short name), so the panel and the strip agree; DEC_LABEL stands in
     only when decisions7.js is not loaded */
  function decLabel(id) { const D = W.V7DEC; const d = D && typeof D.byId === 'function' ? safe(() => D.byId(id), null) : null; return d && typeof D.shortOf === 'function' ? safe(() => D.shortOf(d), '') || DEC_LABEL[id] || id : DEC_LABEL[id] || id; }
  function decTitle(id) { const d = arr(W.V7_DECISIONS).find((x) => x && x.id === id); return d ? plain(d.title) : DEC_LABEL[id] || ''; }
  function alertsOf(key) { const v = V(); return arr(safe(() => v.alerts(key, {}), [])); }
  function findAlert(key, re1, re2) { return alertsOf(key).find((a) => re1.test(a.name || '') && (!re2 || re2.test(a.name || ''))) || null; }
  function issuesOf(key) { const v = V(); return arr(safe(() => v.issues(key, {}), [])); }
  function libCode(name, fb) {
    const v = V();
    const t = arr(safe(() => v.libTypes(), [])).find((x) => (x.type || x.name || x.typeName) === name);
    if (t && t.code) return t.code;
    const c = arr(W.CATALOGUE).find((x) => x.type === name);
    return c ? c.code : fb;
  }
  function ctx() {
    const lvl = findAlert('vedanta', /level high/i, /EQ-1/);
    const doV = findAlert('vedanta', /DO low/i, /SBR-1/);
    const emerg = issuesOf('vedanta').find((i) => i && i.commissioning) || null;
    const mAlerts = alertsOf('manesar');
    const mDO = issuesOf('manesar').find((i) => i && i.status !== 'closed' && /DO low/i.test(((mAlerts.find((a) => a.id === i.alertId) || {}).name) || i.title || '')) || null;
    return {
      vedLevel: lvl ? `#/p/vedanta/alert/${encodeURIComponent(lvl.id)}` : '#/p/vedanta',
      vedDO: doV ? `#/p/vedanta/alert/${encodeURIComponent(doV.id)}` : null,
      vedEmerg: emerg ? `#/p/vedanta/issue/${encodeURIComponent(emerg.id)}` : '#/p/vedanta/alert/a_3f',
      manDO: mDO ? `#/p/manesar/issue/${encodeURIComponent(mDO.id)}` : '#/p/manesar/issues',
      blower: `#/library/${encodeURIComponent(libCode('Blower', 'BLW'))}`,
      tank: `#/library/${encodeURIComponent(libCode('Open Skeleton Tank', 'OS_TANK'))}`,
      tankPlants: (arr(safe(() => V().libTypes(), [])).find((x) => x.code === libCode('Open Skeleton Tank', 'OS_TANK')) || {}).plantCount || 0,
      diffuser: `#/library/${encodeURIComponent(libCode('Diffuser Tank', 'OS_TANK_DF'))}`,   // integrator: the doc and the decision cards use Diffuser Tank
    };
  }
  const STORY = [
    { n: 1, title: 'The library', dec: ['D10', 'D17', 'D1', 'D14'],
      text: ['Two libraries. Equipment types: a pump, a valve, or a tank on its own. Unit-process types: one treatment step, for a tank or reactor that has other equipment taking part in it. Each type has its readings, limits, alerts and tasks.', 'A type page is laid out exactly like an equipment page, so limits, issues and tasks read the same way everywhere.'],
      go: () => '#/library', also: (c) => [{ label: 'A type page: Blower', href: c.blower }] },
    { n: 2, title: 'A new plant from the Visualization', dec: ['D9', 'D4', 'D20', 'D26'],
      text: ['DigitalPaani was read from its real Visualization this morning and is in Commissioning.', '"What the Visualization has" groups its equipment by database type for you to accept. Its Structure tab then proposes the unit processes (one treatment step each) and the control groups (duty/standby sets) for you to confirm, and lists the equipment no rule could place.'],
      go: () => '#/p/digitalpaani/scada', also: () => [{ label: 'The proposed structure', href: '#/p/digitalpaani/structure' }] },
    { n: 3, title: 'What the library brings', dec: ['D8', 'D18', 'D22'],
      text: ['For each piece of equipment the library proposes alerts and tasks, each limit with a chip saying where it comes from.', 'Accept a whole type at once. Accepted alerts go On trial, so nothing reaches anyone yet. Proposals that need a reading the Visualization does not send stay visible, greyed.'],
      go: () => '#/p/digitalpaani/library' },
    { n: 4, title: 'Readiness', dec: ['D2', 'D13', 'D9'],
      text: ['One checklist decides what blocks going live and what is only a gap. Blockers come first, gaps after, each linked to where it is fixed.', 'Go live stays disabled and says why. People are read from the User Center; they are not edited here.'],
      go: () => '#/p/digitalpaani' },
    { n: 5, title: 'Trial and tuning', dec: ['D5', 'D21', 'D6', 'D24'],
      text: ['Vedanta ETP is on day 6 of its trial. Each alert counts its trial firings a day from sample readings.', '"Level high — EQ-1" fires often enough to be marked noisy. "DO low — SBR-1" fires often too, but mostly briefly and near its limit, so it is not. Open its limits: drag a range on the bar, say what each range triggers, and say why. The trial card keeps every firing as it happened and replays the trial with the new limits.'],
      go: (c) => c.vedLevel, also: (c) => (c.vedDO ? [{ label: 'DO low — SBR-1', href: c.vedDO }] : []) },
    { n: 6, title: 'Safety in commissioning', dec: ['D3'],
      text: ['Every band only records trial firings, Emergency included; nothing is sent.', 'Yesterday afternoon a pH excursion reached Emergency on EQ-1. On a new plant that is kept as a trial firing too: no issue opened and nobody was told. A plant that was Live and is back in Commissioning keeps its Emergencies real.'],
      go: (c) => c.vedEmerg },
    { n: 7, title: 'Go live', dec: ['D2', 'D3', 'D7', 'D19'],
      text: ['Vedanta ETP still has one library proposal undecided, so Go live is blocked until it is decided.', 'The confirmation then lists exactly what changes: alerts turn On, calls and the hooter start, and tasks begin, with their count a day and first due dates spread out.'],
      go: () => '#/p/vedanta', also: () => [{ label: 'The undecided proposal', href: '#/p/vedanta/library' }] },
    { n: 8, title: 'Live operation', dec: ['D15', 'D16'],
      text: ['Manesar STP is Live with "DO low — AT-2" open since 07:40. Dheeraj Kumar, the Operator who was told, started its diagnosis at 07:50, so you carry on at question 2, "Does the gauge on the blower discharge read above 0.45 bar?". Answer No (the gauge reads low): the root cause is then BL-1\'s intake filter, so the issue says "Caused by BL-1", and a fix step links a task.', 'Verify still shows Major: move time on +1 hour and the reading is back inside, so you close it on the readings. Move time on further and more issues open, each stating the terms it opened under.'],
      go: (c) => c.manDO },
    { n: 9, title: 'Coverage', dec: ['D2', 'D11', 'D12', 'D27'],
      text: ['On a Live plant, Home becomes Coverage: how often each alert fires, how many were false alarms, and how long issues take to close.', 'Blind spots are issues only a person can find, shown with or without a task that looks for them.'],
      go: () => '#/p/manesar' },
    { n: 10, title: 'A library change', dec: ['D11', 'D17', 'D19', 'D23'],
      text: ['Edit a limit on a type and the draft shows where it lands, counted over the four plants: values that change, plants that keep their own, open issues that keep their terms, tasks that would fall due.', 'Try MLSS low on Diffuser Tank: on MLSS, use Change limits under "Falls below" and change Minor from 2000 to 2200 mg/L. Manesar\'s AT-2 follows the library; AT-1 keeps its own 2500 mg/L. Publishing writes a dated note to each plant it reaches (here Manesar), and AT-1 then shows "Library changed since".'],
      go: (c) => c.diffuser, also: (c) => [{ label: `Open Skeleton Tank${c.tankPlants ? ': used at ' + plural(c.tankPlants, 'plant') : ''}`, href: c.tank }] },
    { n: 11, title: 'Deviations from the library', dec: ['D6', 'D11', 'D25'],
      text: ['Every value a plant changed is listed with its reason, who changed it, the library value it started from and when to review it.', 'Send it back to the library, keep it, or suggest it for the library. Manesar\'s older changes say their reason was not recorded.'],
      go: () => '#/differences', also: () => [{ label: 'Manesar STP only', href: '#/p/manesar/differences' }] },
    { n: 12, title: 'Decisions', dec: ['D1', 'D2', 'D5'],
      text: ['The open questions for Mihir, each with its options, a recommendation and what this prototype does today.', 'Mark your call on each, then copy your answers to send.'],
      go: () => '#/decisions' },
  ];
  /* each chapter's moment in v7/2 (its own routes), for "Compare with v7/2 →" and "Same place in v7/2 →" */
  const CMP72 = { 1: '#/library', 2: '#/p/digitalpaani/review/structure', 3: '#/p/digitalpaani/review/bindings', 4: '#/p/digitalpaani', 5: '#/p/vedanta/trigger/a_3d',
    6: '#/p/vedanta/trigger/a_3f', 7: '#/p/vedanta', 8: '#/p/manesar/trigger/a_do_at2', 9: '#/p/manesar', 10: '#/library/templates/tpl_up_activated-sludge_mlss-low', 11: '#/deviations', 12: '#/decisions' };
  function chapters() {
    const c = ctx(); const ready = v72Ready();
    return STORY.map((s) => ({
      n: s.n, title: s.title, text: s.text.slice(), href: s.go(c) || '#/plants', also: s.also ? s.also(c).filter((a) => a && a.href) : [],
      cmp72: CMP72[s.n], compare72: ready ? { href: v72Href(CMP72[s.n]), target: 'v7-2', label: 'Compare with v7/2', title: "Opens the same moment in v7/2, Alex's model as drafted" } : null,
      decisions: s.dec.map((id) => ({ id, label: decLabel(id), href: `#/decisions/${id}`, title: decTitle(id) })),
    }));
  }
  function stateOf(key) { const p = plantOf(key); return p ? p.state : null; }
  function chapterOf(full) {
    const seg = splitPath(full).path.split('/');
    const top = seg[0] || 'plants';
    if (top === 'library') return seg.length >= 2 && (seg[1] === libCode('Diffuser Tank', 'OS_TANK_DF') || seg[1] === libCode('Open Skeleton Tank', 'OS_TANK')) ? 10 : 1;   // never calls libDraft: it may create one
    if (top === 'differences') return 11;
    if (top === 'decisions') return 12;
    if (top !== 'p' || !seg[1]) return 0;
    const key = seg[1]; const sub = seg[2] || ''; const live = stateOf(key) === 'live';
    if (sub === 'differences') return 11;
    if (sub === 'activity') return 0;
    if (sub === 'scada') return 2;
    if (sub === 'library') return live ? 0 : key === 'vedanta' ? 7 : 3;
    if (sub === 'alert') return live ? 8 : 5;
    if (sub === 'eq') return live ? 8 : key === 'vedanta' ? 5 : 3;
    if (sub === 'issue') { if (live) return 8; const v = V(); const i = safe(() => v.issue(key, seg[3]), null); return i && i.commissioning ? 6 : 5; }
    if (sub === 'issues' && !live) { const v = V(); if (arr(safe(() => v.issues(key, {}), [])).some((i) => i && i.commissioning)) return 6; }   /* v7: where the Commissioning Emergency sits */
    if (sub === 'issues' || sub === 'task' || sub === 'tasks') return live ? 8 : 4;
    if (sub === '' || sub === 'equipment' || sub === 'readings') return live ? 9 : key === 'vedanta' ? 7 : 4;
    return 0;
  }
  function storyHtml(path) {
    const cur = chapterOf(path || '');
    const chs = chapters();
    return `<div class="story-h"><div><h2>The story</h2><p>Twelve chapters, start to finish.</p></div><button type="button" class="x" data-act="ui:story" aria-label="Close the story">×</button></div>`
      + `<ol class="chs">${chs.map((c) => `<li class="ch${c.n === cur ? ' on' : ''}" data-ch="${c.n}"><span class="ch-n">${c.n}</span><div class="ch-b"><h3>${esc(c.title)}</h3>${c.text.map((t) => `<p>${esc(t)}</p>`).join('')}`
        + `<p class="ch-go"><a class="ch-link" href="${esc(c.href)}">Take me there →</a>${c.also.map((a) => `<a class="ch-also" href="${esc(a.href)}">${esc(a.label)}</a>`).join('')}`
        + `${c.compare72 ? `<a class="ch-also ch-cmp" href="${esc(c.compare72.href)}" target="${esc(c.compare72.target)}" title="${esc(c.compare72.title)}">${esc(c.compare72.label)} →</a>` : ''}</p>`
        + `<p class="ch-dec"><span class="ch-dec-k">Decisions</span>${c.decisions.map((d) => `<a class="chip chip-dec" href="${esc(d.href)}" title="${esc(d.title)}">${esc(d.label)}</a>`).join('')}</p></div></li>`).join('')}</ol>`
      + `<div class="story-f"><p>Sample plants run on sample readings, generated the same way every time. Reset the story to start again.</p><button type="button" class="tb-btn" data-act="ui:reset">Reset the story</button></div>`;
  }
  function storyOpen() { return hasDom() && document.body.classList.contains('story-open'); }
  function setStory(open, transient) {
    if (!hasDom()) return;
    document.body.classList.toggle('story-open', !!open);
    const b = q('.tb-story'); if (b) b.setAttribute('aria-pressed', String(!!open));
    if (!transient && (W.innerWidth || 1280) >= 900) { try { W.localStorage.setItem('ctl74.story', open ? '1' : '0'); } catch (e) { /* ignore */ } }
    if (open) highlightStory(splitPath(hashNow()).path, true);
  }
  function paintStory() { const el = q('#story'); if (el) el.innerHTML = storyHtml(splitPath(hashNow()).path); }
  let LAST_CH = -1;
  function highlightStory(path, force) {
    const el = q('#story'); if (!el) return;
    const cur = chapterOf(path);
    const lis = el.querySelectorAll('.ch');
    let onEl = null;
    for (let i = 0; i < lis.length; i++) { const li = lis[i]; const yes = +li.getAttribute('data-ch') === cur; li.classList.toggle('on', yes); if (yes) onEl = li; }
    if (onEl && (force || cur !== LAST_CH) && storyOpen()) {
      try { const top = onEl.offsetTop - 64; if (top < el.scrollTop || onEl.offsetTop + onEl.offsetHeight > el.scrollTop + el.clientHeight) el.scrollTo({ top, behavior: 'smooth' }); } catch (e) { /* ignore */ }
    }
    LAST_CH = cur;
  }
  function chromeHtml(path) { return topbarHtml(path || '') + `<aside class="story" id="story" aria-label="The story">${storyHtml(path || '')}</aside>`; }

  /* ── pages: All Plants ─────────────────────────────────────────────────────────────────────────────────── */
  const DAY = 864e5;
  function openIssues(key) { return issuesOf(key).filter((i) => i && i.status !== 'closed'); }
  function coverageOf(key) {
    const v = V(); const c = safe(() => v.coverage(key), null);
    const rows = Array.isArray(c) ? c : arr(c && (c.alerts || c.perAlert || c.rows));
    const fires = rows.reduce((s, r) => s + (isNum(r && r.firesPerDay) ? +r.firesPerDay : 0), 0);
    return { rows, fires, raw: c };
  }
  function differencesOf(key) { const v = V(); return arr(safe(() => v.overrides({ plant: key }), [])).filter((o) => !/end/i.test(String(o && o.state || ''))); }
  function plantSummary(p) {
    const v = V();
    const s = { p, open: openIssues(p.key).length, diffs: differencesOf(p.key).length };
    if (p.state === 'commissioning') {
      const cl = safe(() => v.checklist(p.key), null) || {};
      s.blockers = arr(cl.blockers).length; s.gaps = arr(cl.gaps).length; s.canGoLive = !!cl.canGoLive && !s.blockers; s.whyNot = cl.whyNot || '';
    } else { s.cov = coverageOf(p.key); }
    s.score = (s.blockers || 0) * 100 + (p.state === 'commissioning' ? 50 : 0) + s.open * 10;
    return s;
  }
  function sinceText(p) {
    const since = toMs(p.since);
    if (since == null) return '';
    if (p.state === 'live') return `Live since ${fmtDay(since)}`;
    /* v7: the trial's day counts from the first alert On trial (core's trialStart), not from the start of Commissioning */
    const v = V(); const ts = safe(() => v.trialStart(p.key), null);
    if (ts == null) return `Since ${fmt(since)} · trial not started`;
    const day = Math.floor((now() - ts) / DAY) + 1;
    return `Since ${fmt(since)} · day ${day} of trial`;
  }
  function statusHtml(s) {
    if (s.p.state === 'commissioning') {
      const head = s.blockers ? `<span class="tx-bad">Go live is blocked</span>` : `<span class="tx-ok">Ready to go live</span>`;
      const bits = [s.blockers ? plural(s.blockers, 'blocker') : '', plural(s.gaps || 0, 'gap')].filter(Boolean);
      if (s.open) bits.push(plural(s.open, 'open issue'));
      return `<span class="cap">Readiness</span>${head}<span class="muted"> · ${bits.join(' · ')}</span>`;
    }
    /* v7: on a Live plant a firing opens an issue: "issues a day", the same number as Coverage */
    const tot = s.cov && s.cov.raw && s.cov.raw.totals; const per = tot && isNum(tot.firesPerDay) ? +tot.firesPerDay : s.cov ? s.cov.fires : 0;
    const fires = s.cov && s.cov.rows.length ? `${rate(per)} ${per === 1 ? 'issue' : 'issues'} a day` : '';
    const head = s.open ? `<span class="tx-warn">${plural(s.open, 'open issue')}</span>` : '<span class="tx-ok">No open issues</span>';
    return `<span class="cap">Coverage</span>${head}${fires ? `<span class="muted"> · ${fires}</span>` : ''}`;
  }
  function plantsPage() {
    const ps = plants();
    if (!ps.length) return page({ title: 'All Plants', body: empty('No plants loaded. The core of the prototype did not start.') });
    const sums = ps.map(plantSummary).sort((a, b) => b.score - a.score);
    const comm = ps.filter((p) => p.state === 'commissioning').length; const live = ps.filter((p) => p.state === 'live').length;
    const attention = sums.filter((s) => s.blockers || s.open);
    const lead = attention.length
      ? attention.map((s) => `<a href="#/p/${esc(encodeURIComponent(s.p.key))}">${esc(s.p.name)}</a>: ${s.blockers ? `${plural(s.blockers, 'blocker')} before it can go live` : plural(s.open, 'open issue')}`).join(' · ')
      : 'Nothing needs attention right now.';
    const rows = sums.map((s) => {
      const p = s.p; const href = `#/p/${encodeURIComponent(p.key)}`;
      const tag = p.sample === false ? chip('Real Visualization', { tone: 'info' }) : chip('Sample plant', { tone: 'muted' });
      return `<li class="prow is-link" data-href="${esc(href)}">`
        + `<div class="prow-name"><a href="${esc(href)}">${esc(p.name)}</a><div class="prow-tags">${chip(p.type || '—', { mono: true })} ${tag}</div></div>`
        + `<div class="prow-state">${stateChip(p.state)}<span class="muted small">${esc(sinceText(p))}</span></div>`
        + `<div class="prow-status">${statusHtml(s)}</div>`
        + `<div class="prow-diff"><a href="#/p/${esc(encodeURIComponent(p.key))}/differences">${s.diffs ? plural(s.diffs, 'deviation') : 'No deviations'}</a><span class="muted small">from the library</span></div>`
        + `<span class="prow-go" aria-hidden="true">›</span></li>`;
    }).join('');
    const body = `<p class="lead${attention.length ? ' has-att' : ''}">${lead}</p>`
      + `<div class="plist"><div class="prow prow-head" aria-hidden="true"><span>Plant</span><span>State</span><span>Readiness or Coverage</span><span>Deviations</span><span></span></div><ul>${rows}</ul></div>`
      + `<p class="foot-note">Manesar STP, Bawal WTP and Vedanta ETP are sample plants. DigitalPaani's layout is its real Visualization; its readings are samples too. Counts of firings come from sample readings.</p>`;
    return page({ title: 'All Plants', sub: `${plural(ps.length, 'plant')} · ${comm} in Commissioning · ${live} Live. The ones that need attention come first.`, chips: [sampleTag()], body, cls: 'pg-plants' });
  }

  /* ── pages: Activity ───────────────────────────────────────────────────────────────────────────────────── */
  let ACT_LIMIT = 150; let ACT_PATH = '';
  const KIND = [     // [id, filter label, row label, what the core's kind looks like]
    ['trial', 'Trial', 'Trial', /trial/],
    ['issue', 'Issues', 'Issue', /issue|fir(e|ing)|emergenc|close|diagnos|fix|verify|report/],
    ['task', 'Tasks', 'Task', /task|schedul|due|cadence/],
    ['library', 'Alerts & Tasks', 'Library', /lib|publish|suggest|draft/],
    ['state', 'Plant state', 'Plant state', /live|commission|state|go.?live/],
    ['review', 'Reviews', 'Review', /scada|review|accept|decide|propos|reject/],
    ['change', 'Changes', 'Change', /config|change|limit|override|revert|keep|tier|hold|clear|alert|setting/],
  ];
  function kindOf(k) {
    const s = String(k || '').toLowerCase();
    for (const [id, label, one, re] of KIND) if (s === id || re.test(s)) return { id, label, one };
    return { id: 'other', label: 'Other', one: 'Note' };
  }
  function activityBody(key, query, base) {
    const v = V();
    let rows = arr(safe(() => v.activity(key ? { plant: key } : {}), [])).filter(Boolean);
    if (key) rows = rows.filter((r) => !r.plant || r.plant === key);
    rows = rows.slice().sort((a, b) => (toMs(b.at) || 0) - (toMs(a.at) || 0));
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
      const where = !key && r.plant ? `<a href="#/p/${esc(encodeURIComponent(r.plant))}">${esc(plantName(r.plant))}</a>` : '';
      const meta = [where, r.who ? esc(r.who) : ''].filter(Boolean).join(' · ');
      out += `<li class="arow"><span class="arow-t mono">${ms != null ? esc(ownTime(ms)) : ''}</span><div class="arow-m"><div class="arow-x">${txt(r.text || '')}</div>${meta ? `<div class="arow-s">${meta}</div>` : ''}</div>${chip(k.one, { tone: k.id === 'issue' ? 'warn' : k.id === 'library' ? 'info' : k.id === 'state' ? 'ok' : 'muted' })}</li>`;
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
      sub: 'Changes, reviews, library publishes, go-lives and issues, newest first. Times are in IST.',
      body: plantChips + activityBody(key, params && params._q, base),
      cls: 'pg-activity',
    });
  }
  function plantTabs(key) {
    const b = `#/p/${encodeURIComponent(key)}`;
    return [['home', 'Home', b], ['equipment', 'Equipment', b + '/equipment'], ['readings', 'Readings', b + '/readings'], ['issues', 'Issues', b + '/issues'], ['tasks', 'Tasks', b + '/tasks'], ['differences', 'Deviations', b + '/differences'], ['activity', 'Activity', b + '/activity']].map(([id, label, href]) => ({ id, label, href }));
  }
  function plantActivityPage(params) {
    const key = params.plant; const p = plantOf(key);
    if (!p) return page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', body: empty('This plant is not in the prototype.', btn('All Plants', { href: '#/plants' })) });
    resetLimitFor('p/' + key + '/activity');
    const base = `#/p/${encodeURIComponent(key)}/activity`;
    const body = section('Activity', activityBody(key, params._q, base), { sub: 'Everything that changed at this plant, newest first.' });
    const P = W.V7PLANT;
    if (P && typeof P.frame === 'function') { const out = safe(() => P.frame(key, 'activity', body), null); if (out) return out; }
    return page({
      crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name }], title: p.name,
      chips: [chip(p.type || '', { mono: true }), stateChip(p.state), p.sample === false ? chip('Real Visualization', { tone: 'info' }) : chip('Sample plant', { tone: 'muted' })],
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
    const same = q('#tbSame'); if (same) same.setAttribute('href', samePlace72(sp.path));
    const ck = q('#clockNow'); if (ck) ck.textContent = fmt(now());
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
    root.innerHTML = topbarHtml(path) + `<div class="layout"><main class="main" id="main" tabindex="-1"></main><aside class="story" id="story" aria-label="The story">${storyHtml(path)}</aside></div>`;
    MAIN = q('#main');
    let open = null;
    const wide = (W.innerWidth || 1280) >= 900;                     // on a phone the drawer starts closed
    try { const s = W.localStorage.getItem('ctl74.story'); if (wide && (s === '1' || s === '0')) open = s === '1'; } catch (e) { /* ignore */ }
    if (open == null) open = (W.innerWidth || 1280) >= 1100;
    const rv = reviewOn(); document.body.classList.toggle('rv-on', rv); const rb = q('.tb-review'); if (rb) rb.setAttribute('aria-pressed', String(rv)); if (!rv) open = false;
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
    esc, txt, plain, h, page, chip, sourceChip, stateChip, sampleTag, sev, bandName, BANDS, bandOf, bandBar, tbHtml, tbSync, tbBind, tbRange, tbClampLine, table, card, section, kv, list, empty,
    note, banner, stats, filters, progress, field, radios, btn, link, phone, num, numEnd, rate, dur, formAnswers, plural, fmt, fmtDay, plantName, isNum,
    // dom
    term, openSheet, refreshSheet, closeSheet, sheetEl, modal, closeModal, confirm, toast, copy, addCss,
    // events + router + shell
    on, route, go, render, current, match, routes, renderPath, afterRender, start, advance,
    chapters, chapterOf, chromeHtml, storyHtml,
    // test hooks
    _soft: SOFT, _last: LAST, _handlers: HANDLERS, _pages: { plantsPage, activityPage, plantActivityPage },
  };
}());
