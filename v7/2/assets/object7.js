/* v7/2 · object7.js · window.V7OBJ — the object pages, laid out one way for a plant and for the library.
   Loads after the core files (window.V7) and ui7.js (window.V7UI); every call into another module is guarded, so a page
   still renders when that module is missing (structure7, ledger7, lib7, plant7 and work7 are used when they are there).

   PAGES (V7OBJ.render({mode, plant, id, code, tab, aside, banner, q}) → html; tabs Readings · Issues · Tasks · Details)
     mode 'up'        a unit process at a plant: the basin node itself, with its type, stage, participants and Tasks
     mode 'eq'        a piece of equipment at a plant: the unit processes it takes part in, its control groups
     mode 'eqType'    an equipment type in the library (the 29 types a unit process sits on show a banner instead)
     mode 'upType'    a unit-process type in the library
     mode 'plantType' a plant type in the library (tabs Tasks · Types offered · Plants)
     ('instance' and 'type' are older names for 'eq' and 'eqType'.)
   ROUTES
     p/:plant/eq/:id/:tab?   p/:plant/up/:id/:tab?   (an id of the other kind renders the right page and fixes the hash)
     p/:plant/eq/:id/phone   p/:plant/up/:id/phone   the Equipment Card (alias p/:plant/eq/:id/card)
     p/:plant/sensor/:id     the sensor page: its Zones are the only place a plant's limits change
     p/:plant/trigger/:id    the Trigger page (an Issue Trigger, a scheduled Task's Trigger or a condition Task's Trigger);
                             alias p/:plant/alert/:id
     Every page reads ?f=<field> (zone.below.minor, band.minor, persistence, clearing, enabled, cadence, runhours,
     condition.doWhen, tier, dp.tankHeight), marks that field with the class is-target and scrolls to it.
   PARTS OTHER MODULES USE
     zonesEditor(key, sensorId) · designParamsBlock(key, {kind:'eq'|'up'|'plant', id}) · openDesignParam(key, ref, param)
     openCadence({plant, scheduleId|taskId}) · openOverride(key, target) · closeOverride()
   EDITING
     A plant value changes only through the override form: V7LEDGER.overrideForm(key, target, {inSheet}) when ledger7 is
     loaded, else a small form here over the same core calls (reasonsFor, physicalPath, overridePreview, setOverride).
     The form opens inline under its row; a save writes Activity, and the row closes on the next render.
   ACTIONS  obj:* (rows, status, pins, report, the Equipment Card), dp:* (design parameters; dp:edit takes data-plant,
     data-kind, data-id, data-param), rs:* (resync).                                                                     */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const UI = W.V7UI;
  if (!UI) { W.V7OBJ = { render: () => '', zonesEditor: () => '', designParamsBlock: () => '' }; return; }
  const V = () => W.V7 || null;
  const { esc, chip, sev, bandName, bandBar, card, section, kv, list, empty, note, banner, stats, btn, plural } = UI;

  const BANDS = ['caution', 'minor', 'major', 'emergency'];
  const RANK = { caution: 1, minor: 2, major: 3, emergency: 4 };
  const MIN = 60000; const HOUR = 60 * MIN; const DAY = 24 * HOUR;
  const TABS = [['readings', 'Readings'], ['issues', 'Issues'], ['tasks', 'Tasks'], ['details', 'Details']];
  const UNITS = ['hour', 'day', 'week', 'month', 'year'];
  const SURVEY_LINE = 'The survey is the only source of equipment and sensors. Correct the survey, then re-run identification.';
  const LIMITS_FOOT = 'Limits are edited on the sensor. Override for this Trigger only is the exception, and needs a reason.';

  /* ── helpers ─────────────────────────────────────────────────────────────────────────────────────────── */
  const SOFT = Array.isArray(UI._soft) ? UI._soft : [];
  function safe(fn, fb) {
    try { const v = fn(); return v === undefined || v === null ? fb : v; }
    catch (e) { SOFT.push('object7: ' + String(e && e.message || e)); if (SOFT.length > 200) SOFT.shift(); return fb; }
  }
  const arr = (x) => (Array.isArray(x) ? x : []);
  const H = (s) => ({ html: String(s == null ? '' : s) });
  const enc = encodeURIComponent;
  const num = (x) => (x === null || x === undefined || x === '' ? null : (isFinite(+x) ? +x : null));
  const cap = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const now = () => safe(() => V().now(), Date.UTC(2026, 9, 29, 3, 30));
  const fmt = (ms) => UI.fmt(ms);
  const fmtDay = (ms) => UI.fmtDay(ms);
  const fn = (name) => { const v = V(); return v && typeof v[name] === 'function' ? v[name] : null; };
  const call = (name, ...args) => { const f = fn(name); return f ? safe(() => f(...args), null) : null; };
  const a = (href, label) => `<a href="${esc(href)}">${esc(label)}</a>`;
  const isoDay = (ms) => new Date(+ms + 330 * MIN).toISOString().slice(0, 10);
  const fromIso = (s) => (s ? Date.parse(String(s) + 'T09:00:00+05:30') : null);
  function fv(v, unit, kind) {
    if (num(v) == null) return 'none';
    const r = safe(() => V().fmtVal(+v, unit || '', kind), null);
    return r != null ? r : UI.num(v, unit);
  }
  const STRUCT = () => W.V7STRUCT || null;
  const LEDGER = () => W.V7LEDGER || null;
  const LIB = () => W.V7LIB || null;
  /* a function another page module exports, tried by its likely names */
  function modFn(mod, names) { if (!mod) return null; for (const n of names) if (typeof mod[n] === 'function') return mod[n]; return null; }

  /* ── hrefs ───────────────────────────────────────────────────────────────────────────────────────────── */
  const pHref = (k, sub) => `#/p/${enc(k)}${sub ? '/' + sub : ''}`;
  const nodeHref = (k, id, up, tab, f) => `#/p/${enc(k)}/${up ? 'up' : 'eq'}/${enc(id)}${tab && tab !== 'readings' ? '/' + tab : ''}${f ? '?f=' + f : ''}`;
  const cardHref = (k, id, up) => `#/p/${enc(k)}/${up ? 'up' : 'eq'}/${enc(id)}/phone`;
  const sensorHref = (k, id, f) => `#/p/${enc(k)}/sensor/${enc(id)}${f ? '?f=' + f : ''}`;
  const trigHref = (k, id, f) => `#/p/${enc(k)}/trigger/${enc(id)}${f ? '?f=' + f : ''}`;
  const issueHref = (k, id) => `#/p/${enc(k)}/issue/${enc(id)}`;
  const taskHref = (k, id) => `#/p/${enc(k)}/task/${enc(id)}`;
  const tplHref = (id) => `#/library/templates/${enc(id)}`;
  const eqTypeHref = (code, tab) => `#/library/eq-types/${enc(code)}${tab && tab !== 'readings' ? '/' + tab : ''}`;
  const upTypeHref = (id, tab) => `#/library/up-types/${enc(id)}${tab && tab !== 'readings' ? '/' + tab : ''}`;
  const plantTypeHref = (id, tab) => `#/library/plant-types/${enc(id)}${tab && tab !== 'tasks' ? '/' + tab : ''}`;

  /* ── the core, read defensively ──────────────────────────────────────────────────────────────────────── */
  const plantOf = (key) => call('plant', key) || arr(call('plants')).find((p) => p.key === key) || null;
  const nodeOf = (key, id) => call('eq', key, id);
  const isUpId = (key, id) => !!call('isUp', key, id);
  const upOf = (key, id) => call('unitProcess', key, id);
  const sensorOf = (key, id) => arr(call('sensors', key)).find((s) => s.id === id) || null;
  const alertOf = (key, id) => call('alert', key, id);
  const scheduleOf = (key, id) => arr(call('schedules', key)).find((s) => s.id === id) || null;
  const plantName = (key) => (plantOf(key) || {}).name || UI.plantName(key);
  /* the condition Tasks (a Task done when a reading says so) at a node: from the library's condition templates */
  function conditionWorks(key, nodeId) {
    const out = [];
    arr(call('templates', {})).filter((t) => t && t.condition).forEach((t) => {
      const full = call('template', t.id) || {};
      arr(full.uses).filter((u) => u.kind === 'work' && u.plant === key).forEach((u) => {
        const co = call('conditionOf', key, u.workId);
        if (co && (!nodeId || co.nodeId === nodeId) && !out.some((x) => x.workId === u.workId)) out.push(co);
      });
    });
    return out;
  }
  function readingsGroup(key, nodeId) {
    const rt = call('readingsTab', key);
    return rt ? arr(rt.groups).find((g) => g.nodeId === nodeId) || null : null;
  }
  const overrideView = (id) => (id ? call('overrideById', id) : null);
  function sigNow() {
    const v = V(); if (!v) return '';
    const acts = arr(safe(() => v.activity(), []));
    const top = acts.reduce((m, x) => Math.max(m, +x.seq || 0), 0);
    return `${top}:${acts.length}:${v.S && v.S.overrides ? v.S.overrides.length : 0}`;
  }

  /* ── chips ───────────────────────────────────────────────────────────────────────────────────────────── */
  function srcChip(c, o) {
    if (!c) return '';
    if (typeof UI.chipHtml === 'function') return UI.chipHtml(c, o);
    if (typeof c === 'string') return chip(c, { tone: 'lib' });
    const main = chip(c.text, { tone: c.tone || 'lib' });
    const extra = arr(c.extra).map((x) => chip(x.text, { tone: x.tone })).join(' ');
    return `<span class="src"><span class="src-c">${main}${extra ? ' ' + extra : ''}</span>${c.sub ? `<span class="src-sub">${esc(c.sub)}</span>` : ''}${c.small ? `<small class="src-small">${esc(c.small)}</small>` : ''}</span>`;
  }
  function linkChip(c, href) {
    if (!c) return '';
    return `<a class="o-chiplink" href="${esc(href)}">${srcChip(c)}</a>`;
  }
  function plantChip(key) {
    const P = plantOf(key); if (!P) return '';
    return UI.stateChip(P.state, { plant: key, since: P.since });
  }
  function statusChip(key, al) { return UI.stateChip(al.state, { plant: key, phase: al.phase }); }
  /* a value's chip; an override whose base moved shows its own chip (reason, who, when) and then "Base moved" */
  function valueChips(c, ovId) {
    const o = ovId ? overrideView(ovId) : null;
    if (o && o.state === 'basemoved' && c && (c.tone === 'moved' || c.text === 'Base moved')) {
      const oc = call('chipFor', { src: 'override', reason: o.reason, author: o.author, at: o.at, reviewBy: o.reviewBy, expires: o.expires, baseText: o.baseText, baseSource: o.baseSource });
      return (oc && oc.text ? srcChip(oc) + ' ' : '') + srcChip(c);
    }
    return srcChip(c) + pastReviewChip(ovId);
  }
  function pastReviewChip(ovId) { const o = overrideView(ovId); return o && o.state === 'pastreview' ? ' ' + chip('Past review', { tone: 'review' }) : ''; }
  function subjectChip(key, subject) {
    if (!subject) return '';
    const S = STRUCT(); const f = modFn(S, ['subjectChip']);
    if (f) { const h = safe(() => f(key, subject), ''); if (h) return h; }
    const label = subject.kind === 'plant' ? 'The plant' : `${subject.tag} · ${subject.kind === 'up' ? 'unit process' : 'equipment'}`;
    return chip(label, { tone: 'muted', href: subject.href || undefined });
  }
  const isTarget = (q, fid) => !!(q && q.f && String(q.f) === fid);
  const tgtCls = (q, fid) => (isTarget(q, fid) ? ' is-target' : '');

  /* ── the override form: one per field, opened inline under its row ───────────────────────────────────── */
  let OPEN = null;          // {key, fid, target, sig, path}
  const fidOf = (t) => call('fieldId', t) || [t.kind, t.dir, t.band, t.which].filter(Boolean).join('.');
  function curPath() { const c = safe(() => UI.current(), null); return c ? c.path : ''; }
  function openOverride(key, target) { OPEN = { key, target, fid: fidOf(target), sig: sigNow(), path: curPath() }; return OPEN; }
  function closeOverride() { OPEN = null; }
  function isOpen(key, fid) {
    if (!OPEN || OPEN.key !== key || OPEN.fid !== fid) return false;
    if (OPEN.sig !== sigNow()) { OPEN = null; return false; }      // a save happened: the form is done
    return true;
  }
  /* the form under a row while it is open (ledger7 keeps its own open state; without it, this file's) */
  function rowForm(key, target, o) {
    const f = modFn(LEDGER(), ['formFor']);
    if (f) return safe(() => f(key, target, o), '');
    return isOpen(key, fidOf(target)) ? fallbackForm(key, target, o) : '';
  }
  /* the row's buttons by state: ledger7's when it is loaded, else this file's */
  function rowActions(key, st, target, o) {
    const f = modFn(LEDGER(), ['fieldActions']);
    if (f) return safe(() => f(key, target), '');
    return valueActions(key, st, target, o);
  }
  /* a button that opens the override form for a target, with a label of the page's own */
  function openBtnFor(key, target, label, o) {
    const L = LEDGER();
    if (L && typeof L.isOpen === 'function' && safe(() => L.isOpen(key, target), false)) return '';
    return btn(label, { act: L && typeof L.open === 'function' ? 'ov:open' : 'obj:ov', data: { plant: key, target: JSON.stringify(target) }, small: true, kind: (o && o.kind) || 'secondary' });
  }

  /* the small form used when ledger7 is not loaded: the same core calls, reason first */
  const FS = {};
  const fsKey = (key, t) => `${key}|${fidOf(t)}`;
  function currentOf(key, t) {
    if (t.kind === 'zone') { const z = call('zoneInfo', key, t.sensorId, t.dir); return z && z.perBand[t.band] ? z.perBand[t.band].value : null; }
    if (t.kind === 'triggerLimit') { const tb = call('triggerBands', key, t.alertId); return tb && tb.bands[t.band] ? tb.bands[t.band].value : null; }
    if (t.kind === 'persistence' || t.kind === 'clearing') { const al = alertOf(key, t.alertId); const x = al && (t.kind === 'persistence' ? al.hold : al.clear); return x ? x.value : null; }
    if (t.kind === 'enabled') { const al = t.alertId ? alertOf(key, t.alertId) : scheduleOf(key, t.scheduleId); return al ? al.state === 'active' : true; }
    if (t.kind === 'cadence') { const c = call('cadenceOf', key, t.scheduleId); return c ? c.value : null; }
    if (t.kind === 'runhours') { const tk = call('task', key, t.scheduleId); return tk && tk.runHours ? tk.runHours.value : null; }
    if (t.kind === 'condition') { const c = call('conditionOf', key, t.workId); return c && c.perField[t.which] ? c.perField[t.which].value : null; }
    if (t.kind === 'tier') { const ti = call('tierInfo', key, t.eqId); return ti ? ti.value : null; }
    return null;
  }
  function fsOf(key, t) {
    const id = fsKey(key, t);
    if (!FS[id]) {
      const cur = currentOf(key, t);
      FS[id] = { id, key, target: t, reason: null, value: cur, note: '', reviewBy: '', expires: '', anyway: false, trait: '', err: null };
    }
    return FS[id];
  }
  function valueFromForm(st) {
    const t = st.target; const v = st.value;
    if (t.kind === 'cadence') return v && v.n ? { n: Math.round(+v.n), unit: v.unit } : null;
    if (t.kind === 'enabled') return v === true || v === 'true' || v === 'on';
    if (t.kind === 'tier') return v || null;
    return v === '' || v == null ? null : (isFinite(+v) ? +v : v);
  }
  function inputHtml(st) {
    const t = st.target; const v = st.value;
    if (t.kind === 'cadence') {
      const ev = v || { n: '', unit: 'month' };
      return `<span class="o-row2"><span>Every</span><input type="number" min="1" step="1" data-ovf="n" value="${esc(ev.n)}" aria-label="How many"><select data-ovf="unit" aria-label="Unit">${UNITS.map((u) => `<option value="${u}"${ev.unit === u ? ' selected' : ''}>${u}s</option>`).join('')}</select></span>`;
    }
    if (t.kind === 'enabled') return `<select data-ovf="value" aria-label="Enabled"><option value="true"${v ? ' selected' : ''}>On</option><option value="false"${!v ? ' selected' : ''}>Off</option></select>`;
    if (t.kind === 'tier') return `<select data-ovf="value" aria-label="Criticality tier">${['A', 'B', 'C'].map((x) => `<option value="${x}"${v === x ? ' selected' : ''}>Criticality tier ${x}</option>`).join('')}</select>`;
    const unit = t.kind === 'persistence' || t.kind === 'clearing' ? 'min' : t.kind === 'runhours' ? 'run-hours' : (unitOf(st.key, t) || '');
    return `<input type="number" step="any" inputmode="decimal" data-ovf="value" value="${esc(v == null ? '' : v)}" aria-label="Value">${unit ? `<span class="o-unit">${esc(unit)}</span>` : ''}`;
  }
  function unitOf(key, t) {
    if (t.kind === 'zone') { const s = sensorOf(key, t.sensorId); return s ? s.unit : ''; }
    if (t.kind === 'triggerLimit') { const al = alertOf(key, t.alertId); return al ? al.unit : ''; }
    if (t.kind === 'condition') { const c = call('conditionOf', key, t.workId); return c ? c.unit : ''; }
    return '';
  }
  function fallbackInner(st) {
    const key = st.key; const t = st.target;
    const reasons = arr(call('reasonsFor', key, t));
    const labels = (V() && V().LABELS && V().LABELS.reasonOption) || {};
    const radios = reasons.map((r) => `<label class="radio${st.reason === r ? ' on' : ''}"><input type="radio" name="ovr-${esc(st.id)}" value="${esc(r)}" data-ovf="reason"${st.reason === r ? ' checked' : ''}><span><b>${esc(labels[r] || cap(r))}</b></span></label>`).join('');
    let path = ''; let more = !!st.reason;
    if (st.reason === 'physical') {
      const pp = call('physicalPath', key, t) || {};
      const prim = pp.kind === 'param' && pp.href ? btn(pp.primary || 'Set the design parameter', { href: pp.href, kind: 'primary', small: true }) : '';
      path = `<div class="o-ovf-box"><p>${esc(pp.text || '')}</p><div class="o-ovf-btns">${prim}${st.anyway ? '' : btn(pp.secondary || 'Override anyway', { act: 'obj:ovanyway', data: { fs: st.id }, small: true })}</div></div>`;
      more = st.anyway;
    } else if (st.reason === 'regulatory' && t.kind === 'zone') {
      path = `<p class="o-hint">Record the consent limit as a design parameter.</p>`;
    } else if (st.reason === 'structural') {
      path = `<div class="o-ovf-box"><p>Request a library variant for this trait?</p>${UI.field({ label: 'Trait', html: `<input type="text" data-ovf="trait" value="${esc(st.trait)}" placeholder="For example: low-load design">` })}<div class="o-ovf-btns">${btn('Request a variant', { act: 'obj:ovvariant', data: { fs: st.id }, small: true, kind: 'primary' })}${st.anyway ? '' : btn('Override for now', { act: 'obj:ovanyway', data: { fs: st.id }, small: true })}</div></div>`;
      more = st.anyway;
    }
    const noteHint = t.kind === 'triggerLimit' ? 'Required.' : 'Required for Tuning and Regulatory or client.';
    const dates = st.reason === 'temporary'
      ? UI.field({ label: 'Expires on', html: `<input type="date" data-ovf="expires" min="${esc(isoDay(now() + DAY))}" max="${esc(isoDay(now() + 30 * DAY))}" value="${esc(st.expires)}">` })
      : UI.field({ label: 'Review by', hint: 'Defaults: Tuning 90 days, others 1 year.', html: `<input type="date" data-ovf="reviewBy" value="${esc(st.reviewBy || defaultReview(st))}">` });
    const moreHtml = more ? UI.field({ label: 'Note', hint: noteHint, html: `<textarea rows="2" data-ovf="note">${esc(st.note)}</textarea>` }) + dates : '';
    return `<div class="o-ovf-in">${inputHtml(st)}<span class="o-ovf-base">${esc(baseLine(st))}</span></div>`
      + `<div class="o-ovf-why"><h4>Why does this plant differ?</h4><div class="radios" role="radiogroup" aria-label="Why does this plant differ?">${radios}</div></div>`
      + path + moreHtml
      + `<div class="o-ovf-prev" aria-live="polite">${previewHtml(st)}</div>`
      + `<p class="field-e o-ovf-err" role="alert">${esc(st.err || '')}</p>`
      + `<div class="o-ovf-btns">${btn('Cancel', { act: 'obj:ovclose', kind: 'ghost', small: true })}${btn('Save override', { act: 'obj:ovsave', data: { fs: st.id }, kind: 'primary', small: true })}</div>`;
  }
  function defaultReview(st) { const d = st.reason ? call('overrideDefaults', st.reason, {}) : null; return d && d.reviewBy ? isoDay(d.reviewBy) : ''; }
  function baseLine(st) {
    const t = st.target; const key = st.key;
    if (t.kind === 'zone') { const z = call('zoneInfo', key, t.sensorId, t.dir); const p = z && z.perBand[t.band]; if (!p) return ''; return p.source === 'gap' || p.resolvedText === 'no rule' ? '· no rule' : `· ${p.source === 'derived' || p.baseSource === 'derived' ? 'derived' : 'library'} ${p.resolvedText}`; }
    if (t.kind === 'persistence' || t.kind === 'clearing') { const al = alertOf(key, t.alertId); const x = al && (t.kind === 'persistence' ? al.hold : al.clear); return x && x.resolved != null ? `· library ${x.resolved} min` : ''; }
    if (t.kind === 'condition') { const c = call('conditionOf', key, t.workId); const p = c && c.perField[t.which]; return p ? `· ${p.baseSource === 'derived' ? 'derived' : 'library'} ${p.resolvedText}` : ''; }
    if (t.kind === 'tier') { const ti = call('tierInfo', key, t.eqId); return ti ? `· ${ti.baseSource === 'derived' || ti.src === 'derived' ? 'derived' : 'library'} Criticality tier ${ti.base || ti.libValue || ''}` : ''; }
    if (t.kind === 'cadence') { const c = call('cadenceOf', key, t.scheduleId); return c && c.libValue ? `· library ${c.libValue.n} ${c.libValue.unit}${c.libValue.n === 1 ? '' : 's'}` : ''; }
    return '';
  }
  function previewHtml(st) {
    if (st.target.kind === 'tier' || st.target.kind === 'enabled') return '';
    const v = valueFromForm(st);
    const pv = call('overridePreview', st.key, st.target, v);
    if (!pv || pv.ok === false) return '';
    const lines = arr(pv.lines).map((l) => `<li>${esc(l)}</li>`);
    arr(pv.frozenLines).forEach((f) => lines.push(`<li>${esc(f.text)} ${f.href ? a(f.href, f.linkText || 'Close it as a false alarm') : ''}</li>`));
    if (!lines.length) return '';
    return `<h4>If you save</h4><ul class="o-prev-l">${lines.join('')}</ul>${pv.count != null ? UI.sampleTag() : ''}`;
  }
  function fallbackForm(key, target, o) {
    const st = fsOf(key, target);
    return `<div class="o-ovf${o && o.inSheet ? ' in-sheet' : ''}" data-fs="${esc(st.id)}">${fallbackInner(st)}</div>`;
  }
  function fsUpdateFromEl(el) {
    const box = el && el.closest ? el.closest('.o-ovf') : null; if (!box) return null;
    const st = FS[box.getAttribute('data-fs')]; if (!st) return null;
    const k = el.getAttribute('data-ovf');
    if (k === 'reason') { if (el.checked) { st.reason = el.value; st.anyway = false; st.reviewBy = ''; } }
    else if (k === 'n' || k === 'unit') { st.value = Object.assign({}, st.value || {}, { [k]: el.value }); }
    else if (k) st[k] = el.value;
    return { st, box };
  }
  function bindForms() {
    if (typeof document === 'undefined' || !document || typeof document.addEventListener !== 'function' || bindForms.done) return;
    bindForms.done = true;
    const h = (ev) => {
      const t = ev.target; if (!t || !t.getAttribute || !t.getAttribute('data-ovf')) return;
      const r = fsUpdateFromEl(t); if (!r) return;
      const k = t.getAttribute('data-ovf');
      if (ev.type === 'input' && k !== 'reason') { const p = r.box.querySelector('.o-ovf-prev'); if (p) p.innerHTML = previewHtml(r.st); return; }
      if (ev.type === 'change' && (k === 'reason' || t.tagName === 'SELECT')) r.box.innerHTML = fallbackInner(r.st);
      else { const p = r.box.querySelector('.o-ovf-prev'); if (p) p.innerHTML = previewHtml(r.st); }
    };
    document.addEventListener('input', h); document.addEventListener('change', h);
  }
  function saveFallback(id) {
    const st = FS[id]; if (!st) return false;
    if (!st.reason) { st.err = 'Choose why this plant differs.'; return undefined; }
    if ((st.reason === 'physical' || st.reason === 'structural') && !st.anyway) { st.err = st.reason === 'physical' ? 'Set the design parameter, or choose Override anyway.' : 'Request a variant, or choose Override for now.'; return undefined; }
    const opts = { reason: st.reason, note: st.note, trait: st.trait || undefined };
    if (st.reason === 'temporary') opts.expires = fromIso(st.expires); else if (st.reviewBy) opts.reviewBy = fromIso(st.reviewBy);
    const r = call('setOverride', st.key, st.target, valueFromForm(st), opts);
    if (!r || r.ok === false) { st.err = (r && r.error) || 'That did not save.'; return undefined; }
    delete FS[id]; OPEN = null;
    const o = r.id ? overrideView(r.id) : null;
    let text = 'Saved.';
    if (r.ended) text = 'Back to the base value: the override ended.';
    else if (o) text = `Override saved: ${o.what} ${o.valueText} (${String(o.libText || o.baseText || '').replace(/\s*\(v\d+\)$/, '')}) · ${o.reasonLabel} · ${o.expiresText && o.expiresText !== 'null' ? `expires ${o.expiresText}` : `review by ${o.reviewByText}`}.`;
    if (UI.sheetEl && UI.sheetEl() && UI.sheetEl().querySelector && UI.sheetEl().querySelector('.o-ovf')) UI.closeSheet();
    UI.toast(text);
    return undefined;
  }

  /* ── field rows: a value, its chip, and the actions its state allows ─────────────────────────────────── */
  function ovButtons(key, ovId, target, o) {
    o = o || {};
    const ov = overrideView(ovId); const fid = fidOf(target);
    const tj = JSON.stringify(target);
    if (ov && ov.state === 'basemoved') {
      return btn('Keep', { act: 'obj:keep', data: { plant: key, ov: ovId }, small: true })
        + btn(ov.adoptLabel || 'Adopt the library value', { act: 'obj:adopt', data: { plant: key, ov: ovId }, small: true, kind: 'primary' });
    }
    return (o.noEdit ? '' : btn(isOpen(key, fid) ? 'Close' : 'Edit', { act: isOpen(key, fid) ? 'obj:ovclose' : 'obj:ov', data: { plant: key, target: tj }, small: true }))
      + btn('Revert', { act: 'obj:revert', data: { plant: key, ov: ovId }, small: true, kind: 'ghost' })
      + btn('Extend', { act: 'obj:extend', data: { plant: key, ov: ovId }, small: true, kind: 'ghost' });
  }
  function overrideBtn(key, target, label, o) {
    o = o || {};
    const open = isOpen(key, fidOf(target));
    if (o.disabled) return btn(o.disabled, { disabled: true, small: true, title: o.title });
    return btn(open ? 'Close' : label || 'Override', { act: open ? 'obj:ovclose' : 'obj:ov', data: { plant: key, target: JSON.stringify(target) }, small: true, kind: o.kind || (open ? 'ghost' : 'secondary') });
  }
  /* the actions for a zone band or any value with {source, overrideId, needs, suspended, forced, pinnedTo} */
  function valueActions(key, st, target, o) {
    o = o || {};
    if (!st) return '';
    if (o.held) return btn(o.held, { disabled: true, small: true });
    if (st.forced || st.suspended) return '';
    if (st.pinnedTo) return o.pinHref ? btn('Unpin', { href: o.pinHref, small: true, kind: 'ghost', title: 'Unpin on the Trigger page' }) : '';
    if (st.overrideId) return ovButtons(key, st.overrideId, target);
    if (st.source === 'gap' && st.needs) {
      const n = st.needs;
      return btn('Add parameter', { act: 'dp:edit', data: { plant: key, kind: isUpId(key, n.nodeId || n.eqId) ? 'up' : 'eq', id: n.nodeId || n.eqId, param: n.param }, small: true, kind: 'primary' })
        + overrideBtn(key, target, 'Set a value', { kind: 'ghost' });
    }
    if (st.source === 'gap') return overrideBtn(key, target, 'Set a value');
    let out = overrideBtn(key, target, o.label || 'Override');
    if (st.source === 'derived' && target.kind === 'zone') {
      const pp = call('physicalPath', key, target);
      if (pp && pp.kind === 'param' && pp.href) out += ' ' + `<a class="o-dplink" href="${esc(pp.href)}">Edit the design parameter</a>`;
    }
    return out;
  }
  function formRow(key, target, cols, o) {
    const f = rowForm(key, target, o); if (!f) return '';
    return `<tr class="o-ovrow"><td colspan="${cols}">${f}</td></tr>`;
  }

  /* ── page frame bits ─────────────────────────────────────────────────────────────────────────────────── */
  function notFound(crumbs, text, back) {
    return UI.page({ crumbs, title: 'Not found', body: empty(text, back ? btn(back.label, { href: back.href }) : ''), cls: 'pg-obj' });
  }
  function stageCrumb(key, nodeId) {
    const f = modFn(STRUCT(), ['stageCrumb']);
    if (f) { const c = safe(() => f(key, nodeId), null); if (c && typeof c === 'object' && c.label) return { label: c.label, href: c.href }; }
    const u = upOf(key, nodeId);
    const firstUp = u || (() => { const e = nodeOf(key, nodeId); const p = e && arr(e.participatesIn)[0]; return p ? upOf(key, p.upId) : null; })();
    if (!firstUp) return { label: 'Structure', href: pHref(key, 'structure') };
    return { label: firstUp.stageLabel || 'No stage', href: firstUp.stage ? `${pHref(key, 'structure')}?stage=${enc(firstUp.stage)}` : pHref(key, 'structure') };
  }
  function crumbsFor(key, nodeId, extra) {
    const P = plantOf(key); const n = nodeOf(key, nodeId);
    const out = [{ label: 'All Plants', href: '#/plants' }, { label: P ? P.name : key, href: pHref(key) }];
    if (n) { out.push(stageCrumb(key, nodeId)); out.push({ label: n.tag, href: nodeHref(key, n.id, isUpId(key, n.id)) }); }
    return out.concat(arr(extra));
  }

  /* ════ the object page ═══════════════════════════════════════════════════════════════════════════════════ */
  function render(o) {
    o = o || {};
    const mode = o.mode === 'type' ? 'eqType' : o.mode === 'instance' ? 'eq' : o.mode;
    if (mode === 'eqType') return eqTypePage(o.code || o.id, o.tab, o);
    if (mode === 'upType') return upTypePage(o.id || o.code, o.tab, o);
    if (mode === 'plantType') return plantTypePage(o.id || o.code, o.tab, o);
    const id = o.id || o.eqId; const key = o.plant || o.key;
    if (mode === 'up' || isUpId(key, id)) return upPage(key, id, o.tab, o);
    return eqPage(key, id, o.tab, o);
  }
  function tabsFor(key, id, up, counts) {
    return TABS.map(([t, label]) => ({ id: t, label, href: nodeHref(key, id, up, t), count: counts[t] ? counts[t] : '' }));
  }
  function plantMissing(key) {
    return notFound([{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], 'This plant is not in the prototype.', { label: 'All Plants', href: '#/plants' });
  }
  function nodeMissing(key, P) {
    return notFound([{ label: 'All Plants', href: '#/plants' }, { label: P.name, href: pHref(key) }, { label: 'Not found' }], 'This is not in the plant graph. ' + SURVEY_LINE, { label: 'Structure', href: pHref(key, 'structure') });
  }

  /* unit process */
  function upPage(key, id, tab, o) {
    o = o || {}; const q = o.q || {};
    const P = plantOf(key); if (!P) return plantMissing(key);
    const u = upOf(key, id); if (!u) return nodeMissing(key, P);
    tab = TABS.some((t) => t[0] === tab) ? tab : 'readings';
    const e = nodeOf(key, id) || {};
    const issues = arr(call('issues', key, { upId: id, includeShared: true }));
    const tasks = arr(call('tasks', key, { upId: id }));
    const grp = readingsGroup(key, id);
    const counts = { readings: grp ? arr(grp.rows).filter((r) => !r.nextPhase).length : 0, issues: issues.filter((i) => i.status !== 'closed').length, tasks: tasks.length };
    let body = '';
    if (tab === 'readings') body = readingsTab(key, P, id, grp, true);
    else if (tab === 'issues') body = upIssuesTab(key, P, u, issues);
    else if (tab === 'tasks') body = upTasksTab(key, P, u, tasks);
    else body = upDetailsTab(key, P, u, e, q);
    const tier = u.tierSource || e.tierSource || {};
    const ver = call('upTypeView', u.typeId) || call('upType', u.typeId) || {};
    return UI.page({
      crumbs: crumbsFor(key, id).slice(0, -1).concat([{ label: u.tag }]),
      title: H(`<span class="o-tag">${esc(u.tag)}</span> · ${esc(u.name)}`),
      chips: [
        chip('Unit process', { tone: 'info' }),
        chip(`Type: ${u.typeName} v${ver.version || 1} ↗`, { href: upTypeHref(u.typeId), title: 'Its unit-process type in the library' }),
        chip(`Stage: ${u.stageLabel || 'No stage'}`, { tone: 'muted' }),
        chip(tier.label || `Criticality tier ${u.tier}`) + ' ' + srcChip(tier.chip),
        chip(u.typeStateLabel || 'Confirmed', { tone: u.typeState === 'proposed' ? 'prop' : 'muted' }),
        plantChip(key),
      ],
      sub: `${u.typeName} · ${u.why || ''}`,
      actions: [btn('Equipment Card', { href: cardHref(key, id, true), kind: 'ghost', title: 'The same unit process as an operator carries it' }), btn('Report a problem', { act: 'obj:report', data: { plant: key, id } })],
      banner: (o.banner || '') + openIssueBanner(key, issues.filter((i) => !i.shared)),
      tabs: tabsFor(key, id, true, counts), active: tab,
      body, aside: o.aside != null ? o.aside : participantsAside(key, u), cls: 'pg-obj pg-up',
    });
  }
  function participantsAside(key, u) {
    const f = modFn(STRUCT(), ['participantsCard']);
    if (f) { const h = safe(() => f(key, u.id), ''); if (h) return h; }
    const groups = {};
    arr(u.participants).forEach((p) => { (groups[p.roleLabel || 'Other'] = groups[p.roleLabel || 'Other'] || []).push(p); });
    const rows = Object.keys(groups).map((role) => `<div class="o-pt-g"><h4>${esc(role)}</h4><ul>${groups[role].map((p) => `<li>${a(nodeHref(key, p.eqId, false), p.tag)} ${chip(p.stateLabel || '', { tone: p.state === 'proposed' ? 'prop' : 'muted' })}${arr(p.alsoIn).length ? ' ' + arr(p.alsoIn).map((x) => chip(`Also in ${x.tag}`, { tone: 'muted', href: nodeHref(key, x.upId, true) })).join(' ') : ''}</li>`).join('')}</ul></div>`).join('');
    const cgs = arr(u.cgIds).map((cg) => { const c = call('controlGroup', key, cg); return c ? chip(`Control group: ${c.name}`, { tone: 'muted', href: `${pHref(key, 'cg')}/${enc(cg)}` }) : ''; }).filter(Boolean).join(' ');
    const sensors = arr(u.sensorIds).map((sid) => { const s = sensorOf(key, sid); return s ? a(sensorHref(key, sid), s.tag) : ''; }).filter(Boolean).join(', ');
    const editBtn = (plantOf(key) || {}).realLayout ? btn('Edit on drawing', { href: `${pHref(key, 'structure')}/drawing?select=up:${enc(u.id)}`, small: true, kind: 'ghost' }) : btn('Edit in the structure list', { href: `${pHref(key, 'structure')}?select=up:${enc(u.id)}`, small: true, kind: 'ghost' });
    return card({
      title: 'Participants', cls: 'o-pt',
      body: (rows || '<p class="muted">No participants</p>') + (cgs ? `<p class="o-pt-cg">${cgs}</p>` : '') + (sensors ? `<p class="o-hint">Sensors: ${sensors}</p>` : ''),
      actions: [editBtn],
    });
  }
  function openIssueBanner(key, issues) {
    const open = arr(issues).filter((i) => i.status !== 'closed').sort((x, y) => (RANK[y.band] || 0) - (RANK[x.band] || 0) || y.opened - x.opened);
    if (!open.length) return '';
    const i = open[0];
    return banner(H(`<b>${esc(i.title)}</b> is open: ${esc(bandName(i.band))}, opened ${esc(fmt(i.opened))}${open.length > 1 ? ` · ${esc(plural(open.length - 1, 'more open'))}` : ''}.`), { tone: RANK[i.band] >= 3 ? 'bad' : 'info', action: btn('Open the Issue', { href: issueHref(key, i.id), small: true }) });
  }

  /* equipment */
  function eqPage(key, id, tab, o) {
    o = o || {}; const q = o.q || {};
    const P = plantOf(key); if (!P) return plantMissing(key);
    const e = nodeOf(key, id); if (!e) return nodeMissing(key, P);
    tab = TABS.some((t) => t[0] === tab) ? tab : 'readings';
    const issues = arr(call('issues', key, { eqId: id }));
    const tasks = arr(call('tasks', key, { eqId: id }));
    const conds = conditionWorks(key, id);
    const grp = readingsGroup(key, id);
    const counts = { readings: grp ? arr(grp.rows).filter((r) => !r.nextPhase).length : 0, issues: issues.filter((i) => i.status !== 'closed').length, tasks: tasks.length + conds.length };
    let body = '';
    if (tab === 'readings') body = readingsTab(key, P, id, grp, false);
    else if (tab === 'issues') body = eqIssuesTab(key, P, e, issues);
    else if (tab === 'tasks') body = eqTasksTab(key, P, e, tasks, conds);
    else body = eqDetailsTab(key, P, e, q);
    const tier = e.tierSource || {};
    const parts = arr(e.participatesIn);
    const partChip = parts.length
      ? `<span class="o-inline">Participates in: ${parts.map((p) => a(nodeHref(key, p.upId, true), p.tag)).join(', ')}</span>`
      : e.placement === 'notpart' ? chip('Not part of any unit process', { tone: 'muted' }) : e.placement === 'unclassified' ? chip('Unclassified', { tone: 'bad', href: `${pHref(key, 'review/structure')}?show=unclassified` }) : '';
    const cgChips = arr(e.controlGroups).map((c) => chip(`Control group: ${c.name}`, { tone: 'muted', href: `${pHref(key, 'cg')}/${enc(c.cgId)}` })).join(' ');
    const lt = e.code ? call('libType', e.code) : null;
    return UI.page({
      crumbs: crumbsFor(key, id).slice(0, -1).concat([{ label: e.tag }]),
      title: H(`<span class="o-tag">${esc(e.tag)}</span> · ${esc(e.name)}`),
      chips: [
        e.code ? chip(`${e.typeName} · Equipment type v${(lt && lt.version) || 1} ↗`, { href: eqTypeHref(e.code), title: 'Its equipment type in the library' }) : chip(e.typeName || 'No type'),
        partChip, cgChips,
        chip(tier.label || `Criticality tier ${e.tier}`) + ' ' + srcChip(tier.chip),
        plantChip(key),
      ],
      sub: `${e.typeName || ''}${e.running === true ? ' · running (sample)' : ''}`,
      actions: [btn('Equipment Card', { href: cardHref(key, id, false), kind: 'ghost', title: 'The same equipment as an operator carries it' }), btn('Report a problem', { act: 'obj:report', data: { plant: key, id } })],
      banner: (o.banner || '') + openIssueBanner(key, issues),
      tabs: tabsFor(key, id, false, counts), active: tab,
      body, aside: o.aside || '', cls: 'pg-obj pg-eq',
    });
  }

  /* Readings: plant-graph sensors with their limits read-only; each opens its sensor page */
  function readingsTab(key, P, nodeId, grp, up) {
    const rows = grp ? arr(grp.rows) : [];
    const live = rows.filter((r) => !r.nextPhase); const next = rows.filter((r) => r.nextPhase);
    let out = '';
    if (live.length) {
      const tr = live.map((r) => ({
        reading: H(`${a(sensorHref(key, r.sensorId || r.id), r.name)} <span class="mono muted">${esc(r.tag || '')}</span>`),
        now: r.nowText || '—',
        limits: H(r.limitsText ? esc(r.limitsText) : `<span class="muted">${esc(noZonesText(r))}</span>`),
        source: H(arr(r.chips).map((c) => srcChip(c)).join(' ') || `<span class="muted">${esc(r.dirs && r.dirs.length ? '' : 'Reads the plant graph')}</span>`),
        triggers: H(`<a href="${esc(sensorHref(key, r.sensorId || r.id))}">${esc(r.triggerText || `${r.triggers || 0} · Edit on sensor`)}</a>`),
      }));
      out += section('Readings', UI.table({ cols: [{ label: 'Reading', key: 'reading' }, { label: 'Now', key: 'now', cls: 'nowrap' }, { label: 'Limits', key: 'limits' }, { label: 'Source', key: 'source' }, { label: 'Triggers', key: 'triggers', cls: 'nowrap' }], rows: tr }),
        { sub: 'Limits live on each sensor\'s Zones. Edit on sensor opens the one place they change.', actions: [UI.sampleTag()] });
    } else {
      out += section('Readings', empty(`The plant graph has no sensor on ${up ? 'this unit process' : 'this equipment'}. Add sensor in the survey.`));
    }
    if (next.length) out += card({ title: H(`Next phase: readings on lines ${chip('Next phase', { tone: 'next' })}`), sub: 'Readings on pipes and lines between equipment come in the next phase. Nothing here raises an Issue yet.', body: `<ul class="o-np">${next.map((r) => `<li><span>${esc(r.name)}</span><span class="mono">${esc(r.tag || '')}</span></li>`).join('')}</ul>`, tone: 'quiet' });
    return out;
  }
  function noZonesText(r) {
    if (r.kind === 'meter') return 'Counts up · no Zones';
    if (r.kind === 'status') return 'Reads ON or OFF · no Zones';
    return 'No Zones';
  }

  /* Issues */
  function issueItem(key, i, here) {
    const st = i.status === 'closed' ? `closed ${fmt(i.closed)}${i.falseAlarm ? ' as a false alarm' : ''}` : ((V() && V().LABELS && V().LABELS.issueStatus && V().LABELS.issueStatus[i.status]) || cap(i.status));
    const chips = [];
    if (i.shared) chips.push(chip(i.sharedText || `Shared · on ${i.subject ? i.subject.tag : ''}`, { tone: 'info' }));
    else if (i.subject && here && i.subject.id !== here) chips.push(subjectChip(key, i.subject));
    if (i.causedBy && i.causedBy !== (i.subject && i.subject.id)) { const c = nodeOf(key, i.causedBy); if (c) chips.push(chip(here === i.causedBy ? 'Caused here' : `Caused by ${c.tag}`, { tone: 'muted' })); }
    return { title: i.title, href: issueHref(key, i.id), sub: `${bandName(i.band)} · opened ${fmt(i.opened)} · ${st}`, chips, tone: i.status === 'closed' ? '' : RANK[i.band] >= 3 ? 'bad' : 'warn' };
  }
  function issueTypesCard(key, subject, types) {
    const items = arr(types).map((t) => {
      const fl = t.flowId ? call('flowOf', t.flowId) : null;
      const found = arr(t.foundBy).map((k) => ({ sensor: 'a sensor', visual: 'a look on the round', manual: 'a hand test' }[k] || k));
      return { title: t.name, sub: [found.length ? 'Found by ' + found.join(' or ') : 'How it is found is not recorded', fl ? `diagnostic flow: ${fl.name}` : 'no diagnostic flow yet'].join(' · ') };
    });
    return card({ title: 'Issue types', sub: `The problems the library writes for ${subject}.`, body: items.length ? list(items) : empty(`The library has no Issue types written for ${subject} yet.`) });
  }
  function reportBtn(key, id) { return btn('Report a problem', { act: 'obj:report', data: { plant: key, id }, kind: 'primary', small: true }); }
  function upIssuesTab(key, P, u, issues) {
    const here = issues.filter((i) => !i.shared); const shared = issues.filter((i) => i.shared);
    const sorted = (xs) => xs.slice().sort((x, y) => (x.status === 'closed') - (y.status === 'closed') || (y.opened - x.opened));
    const comm = P.state === 'commissioning' ? ` While ${P.name} is in Commissioning, Triggers record trial firings only: nothing is sent.` : '';
    let out = card({ title: 'Filed here', sub: `Issues about ${u.tag}, open first.${comm}`, body: here.length ? list(sorted(here).slice(0, 15).map((i) => issueItem(key, i, u.id))) : empty(`No Issues on ${u.tag}.`), actions: [reportBtn(key, u.id)] });
    out += card({ title: 'On its participants', sub: 'Issues filed on equipment that takes part in it. Each stays on its own equipment.', body: shared.length ? list(sorted(shared).slice(0, 15).map((i) => issueItem(key, i, u.id))) : empty('None.') });
    out += issueTypesCard(key, `${u.tag} (${u.typeName})`, call('issueTypesFor', key, { kind: 'up', id: u.id }));
    return out;
  }
  function eqIssuesTab(key, P, e, issues) {
    const sorted = issues.slice().sort((x, y) => (x.status === 'closed') - (y.status === 'closed') || (y.opened - x.opened));
    const comm = P.state === 'commissioning' ? ` While ${P.name} is in Commissioning, Triggers record trial firings only: nothing is sent.` : '';
    let out = card({ title: issues.length ? plural(issues.length, 'Issue') : 'No Issues', sub: `Issues filed on ${e.tag}, and Issues it caused elsewhere.${comm}`, body: issues.length ? list(sorted.slice(0, 15).map((i) => issueItem(key, i, e.id))) : '', actions: [reportBtn(key, e.id)] });
    out += issueTypesCard(key, `${e.tag} (${e.typeName})`, call('issueTypesFor', key, { kind: 'eq', id: e.id }));
    return out;
  }

  /* Tasks */
  function dueCell(t) {
    if (t.due == null) return H(`<span class="muted">${esc(t.statusLabel || 'Not due yet')}</span>`);
    if (t.overdue) return H(`<span class="tx-bad">Overdue since ${esc(fmt(t.due))}</span>`);
    if (t.status === 'due') return H(`<span class="tx-warn">Due ${esc(fmt(t.due))}</span>`);
    return fmt(t.due);
  }
  function cadenceCell(key, t) {
    if (t.kind === 'line') { const w = t.from || {}; return H(`<a href="${esc(sensorHref(key, w.sensorId, `zone.${w.dir}.${w.band}`))}">${esc(w.whenText || '')}</a> ${chip('Raised by a line', { tone: 'muted' })}`); }
    const sid = arr(t.scheduleIds)[0] || t.id;
    const c = call('cadenceOf', key, sid);
    const txt = c ? c.everyText : (t.everyText || '');
    return H(`<a href="${esc(trigHref(key, sid, 'cadence'))}">${esc(cap(txt))}</a> ${c ? srcChip(c.chip) : ''}`);
  }
  function taskRows(key, tasks) {
    return tasks.slice().sort((x, y) => (y.overdue ? 2 : y.status === 'due' ? 1 : 0) - (x.overdue ? 2 : x.status === 'due' ? 1 : 0) || (x.due == null ? 1e15 : x.due) - (y.due == null ? 1e15 : y.due)).map((t) => ({
      task: H(`${a(taskHref(key, t.id), t.name)}<div class="muted small">${esc(t.workLabel || '')}</div>`),
      every: cadenceCell(key, t),
      due: dueCell(t),
      status: t.statusLabel || cap(t.status || ''),
    }));
  }
  const TASK_COLS = [{ label: 'Task', key: 'task' }, { label: 'Cadence', key: 'every' }, { label: 'Next due', key: 'due', cls: 'nowrap' }, { label: 'Status', key: 'status', cls: 'nowrap' }];
  function tasksSub(P) { return P.state === 'commissioning' ? 'Scheduled Tasks start at go-live. Each cadence is edited on its Task\'s Trigger page.' : 'Each cadence is edited on its Task\'s Trigger page.'; }
  function upTasksTab(key, P, u, tasks) {
    let out = card({ title: tasks.length ? plural(tasks.length, 'Task') : 'No Tasks', sub: tasksSub(P), body: tasks.length ? UI.table({ cols: TASK_COLS, rows: taskRows(key, tasks) }) : '' });
    const parts = arr(u.participants);
    if (parts.length) {
      const n = parts.reduce((s, p) => s + arr(call('tasks', key, { eqId: p.eqId })).length, 0);
      out += `<p class="o-hint">Work on its participants is filed on each of them: ${a(pHref(key, 'tasks'), `${plural(n, 'Task')} on ${parts.map((p) => p.tag).join(', ')}`)}</p>`;
    }
    return out;
  }
  function eqTasksTab(key, P, e, tasks, conds) {
    let out = card({ title: tasks.length ? plural(tasks.length, 'Task') : 'No scheduled Tasks', sub: tasksSub(P), body: tasks.length ? UI.table({ cols: TASK_COLS, rows: taskRows(key, tasks) }) : '' });
    /* v7/2: condition-based work is never filed on equipment: say which of its readings raise some, and where it is filed */
    const lw = arr(call('lineWork', key, { eqId: e.id }));
    if (lw.length) out += note(H(`Condition-based work is filed at a unit process or the plant. ${esc(e.tag)}'s readings raise ${lw.map((w) => `${a(taskHref(key, w.id), w.name)} (${esc(w.reading)}, ${esc(w.bandLabel)} line; filed at ${esc(w.filed.text)})`).join(' and ')}.`), 'quiet');
    if (conds.length) out += card({ title: 'Done when a reading says so', sub: 'A condition Task comes due when its reading crosses the do-when value.', body: list(conds.map((c) => ({ title: H(a(trigHref(key, c.workId), c.name)), sub: H(`${esc(c.text)} ${srcChip(c.perField.doWhen.chip)}`) }))) });
    const parts = arr(e.participatesIn);
    if (parts.length) out += `<p class="o-hint">Work on ${esc(parts.map((p) => p.tag).join(' and '))} is filed on ${parts.length === 1 ? 'that unit process' : 'those unit processes'}.</p>`;
    return out;
  }

  /* Details */
  function surveyCard(key, e, drawnFact) {
    const answers = e.form && typeof e.form === 'object'
      ? (typeof UI.formAnswers === 'function' ? UI.formAnswers(e.form) : Object.keys(e.form).map((k) => `${k} ${e.form[k]}`))
      : [];
    const facts = [
      ['Tag', H(`<span class="mono">${esc(e.tag)}</span>`)],
      ['Equipment type in the survey', e.typeName || '—'],
    ];
    if (drawnFact) facts.push(['Drawn in the plant graph', H(`<span>${esc(drawnFact)}</span>`)]);
    facts.push(['Survey answers', answers.length ? answers.join(' · ') : H('<span class="muted">None</span>')]);
    return card({ title: 'From the survey', sub: SURVEY_LINE, body: kv(facts), cls: 'o-survey' });
  }
  function drawnFactOf(e, u) {
    if (u && u.drawnFact) return u.drawnFact;
    if (e && e.typeDiffers && e.drawn && e.stored) return `Drawn in the plant graph as ${e.drawn}; stored in the survey as ${e.stored}.`;
    return null;
  }
  function tierCard(key, nodeId, tier, q) {
    const target = { kind: 'tier', eqId: nodeId }; const fid = 'tier';
    const st = { overrideId: tier.overrideId, source: tier.src };
    const row = `<div class="o-field${tgtCls(q, fid)}" id="f-tier" data-f="tier"><div class="o-field-v"><b>${esc(tier.label || '')}</b> ${valueChips(tier.chip, tier.overrideId)}${tier.src === 'derived' && arr(tier.derivedFrom).length ? `<span class="muted small">from ${esc(arr(tier.derivedFrom).map((u) => (nodeOf(key, u) || {}).tag || u).join(', '))}</span>` : ''}</div><div class="o-field-a">${rowActions(key, st, target)}</div></div>`;
    const form = rowForm(key, target);
    return card({ title: 'Criticality tier', sub: 'How much the plant depends on it: the highest of its type\'s criticality tier and the criticality tiers of the unit processes it takes part in.', body: row + form, id: 'c-tier' });
  }
  function structureChangesCard(key, nodeId, up) {
    const rows = arr(call('structureChanges', { plant: key })).filter((c) => (up ? c.upId === nodeId : c.eqId === nodeId));
    return card({
      title: 'Structure changes', sub: 'Membership and type changes from the structure pass and the drawing. Each keeps its note.',
      body: rows.length ? list(rows.map((c) => ({ title: c.line, sub: [c.detail, c.note ? `"${c.note}"` : '', c.author || 'not recorded', c.at ? fmtDay(c.at) : ''].filter(Boolean).join(' · '), href: c.href, chips: c.underneath ? [chip('Changed underneath', { tone: 'gap' })] : [] }))) : empty('None: it stands as identification proposed it.'),
    });
  }
  function upDetailsTab(key, P, u, e, q) {
    const st = call('structure', key) || {};
    const passOpen = !call('structureDone', key);
    const changeType = passOpen
      ? btn('Change it in the structure pass', { href: pHref(key, 'review/structure'), small: true, kind: 'ghost' })
      : btn('Change it in the structure pass', { disabled: true, small: true, title: 'The structure is confirmed. Changing a unit process\'s type re-proposes its bindings, which this study doesn\'t do.' });
    let out = card({
      title: 'Unit process',
      body: kv([
        ['Type', H(`${a(upTypeHref(u.typeId), u.typeName)} ${chip(u.typeStateLabel || '', { tone: u.typeState === 'proposed' ? 'prop' : 'muted' })}<div class="muted small">${esc(u.why || '')}</div>`)],
        ['Stage', `${u.stageLabel || 'No stage'} (from the type)`],
        ['Identified', `${st.runAt ? fmt(st.runAt) : '—'}${st.confirmedAt ? ` · confirmed ${fmt(st.confirmedAt)}` : ' · not confirmed yet'}`],
      ]) + (passOpen ? '' : `<p class="o-hint">The structure is confirmed. Changing a unit process's type re-proposes its bindings, which this study doesn't do.</p>`),
      actions: [changeType],
    });
    out += surveyCard(key, e, drawnFactOf(e, u));
    out += designParamsBlock(key, { kind: 'up', id: u.id }, { q });
    out += tierCard(key, u.id, u.tierSource || e.tierSource || {}, q);
    out += structureChangesCard(key, u.id, true);
    return out;
  }
  function eqDetailsTab(key, P, e, q) {
    let out = '';
    const f = modFn(STRUCT(), ['participatesCard']);
    const pc = f ? safe(() => f(key, e.id), '') : '';
    if (pc) out += pc;
    else {
      const parts = arr(e.participatesIn);
      const rows = parts.map((p) => ({ up: H(a(nodeHref(key, p.upId, true), p.tag)), role: p.roleLabel || '', state: H(chip(p.stateLabel || '', { tone: p.state === 'proposed' ? 'prop' : 'muted' })), why: p.why || '' }));
      const cgs = arr(e.controlGroups).map((c) => a(`${pHref(key, 'cg')}/${enc(c.cgId)}`, c.name)).join(', ');
      const editBtn = (P || {}).realLayout ? btn('Edit on drawing', { href: `${pHref(key, 'structure')}/drawing?select=eq:${enc(e.id)}`, small: true, kind: 'ghost' }) : btn('Edit in the structure list', { href: `${pHref(key, 'structure')}?select=eq:${enc(e.id)}`, small: true, kind: 'ghost' });
      out += card({
        title: 'Participates in',
        body: (rows.length ? UI.table({ cols: [{ label: 'Unit process', key: 'up' }, { label: 'Role', key: 'role' }, { label: 'State', key: 'state' }, { label: 'Why', key: 'why' }], rows }) : empty(e.placement === 'notpart' ? 'Not part of any unit process.' : e.placement === 'unclassified' ? 'Unclassified: no rule placed it. Place it in the structure pass.' : 'No unit process.'))
          + (cgs ? `<p class="o-hint">Control groups: ${cgs}</p>` : ''),
        actions: [editBtn],
      });
    }
    out += surveyCard(key, e, drawnFactOf(e, null));
    out += designParamsBlock(key, { kind: 'eq', id: e.id }, { q });
    out += tierCard(key, e.id, e.tierSource || call('tierInfo', key, e.id) || {}, q);
    out += structureChangesCard(key, e.id, false);
    return out;
  }

  /* ════ library type pages ════════════════════════════════════════════════════════════════════════════════ */
  function editTplBtn(id) {
    const f = modFn(LIB(), ['editTemplateBtn', 'editTemplateButton']);
    if (f) { const h = safe(() => f(id), ''); if (h) return h; }
    return btn('Edit template', { href: tplHref(id), small: true, kind: 'ghost' });
  }
  function typeReadingCards(readings) {
    const cards = [];
    arr(readings).forEach((r) => {
      const dirs = arr(r.dirs);
      if (!dirs.length) {
        cards.push(`<article class="o-rd tone-quiet"><header class="o-rd-h"><div class="o-rd-hl"><h3 class="o-rd-t">${esc(r.name)}<span class="mono">${esc(r.tag || '')}</span></h3><p class="o-rd-s">${esc(r.kind === 'meter' ? 'Counts up: run-hours Tasks read it. No Zones.' : r.kind === 'status' ? 'Reads ON or OFF. No Zones.' : 'No Trigger template reads it.')}</p></div></header></article>`);
        return;
      }
      dirs.forEach((d) => {
        const res = arr(d.resolvesAt).map((x) => `<li>${esc(x.text)}</li>`).join('');
        const flag = d.flagged && d.flagText ? `<p class="o-flag">${esc(d.flagText)} ${a(tplHref(d.templateId), 'Use a design parameter')}</p>` : '';
        cards.push(`<article class="o-rd"><header class="o-rd-h"><div class="o-rd-hl"><h3 class="o-rd-t">${a(tplHref(d.templateId), d.title || d.templateName)}</h3><p class="o-rd-s">${esc(r.name)} · ${esc(d.dirWord || d.dir)}</p></div><div class="o-rd-a">${srcChip(d.chip)} ${editTplBtn(d.templateId)}</div></header>`
          + `<p class="o-rules">${esc(d.rulesText || 'No limit rule yet')}</p>${flag}`
          + (res ? `<div class="o-res"><h4>Resolves at:</h4><ul>${res}</ul></div>` : '<p class="o-hint">No plant reads it yet.</p>') + '</article>');
      });
    });
    return cards.length ? `<div class="o-rds">${cards.join('')}</div>` : empty('No readings in the library for this type.');
  }
  function typeTasksCard(key, tpls, sub) {
    const rows = arr(tpls).map((t) => ({ task: H(`${a(tplHref(t.id), t.name)}<div class="muted small">${esc(workLabel(t.workType))}</div>`), every: H(`${esc(cap(t.everyText || ''))} ${chip(t.chipText || `Task template · v${t.v}`, { tone: 'lib' })}`), act: H(editTplBtn(t.id)) }));
    return card({ title: rows.length ? plural(rows.length, 'Task template') : 'No Task templates', sub, body: rows.length ? UI.table({ cols: [{ label: 'Task', key: 'task' }, { label: 'Cadence', key: 'every' }, { label: '', key: 'act', cls: 'r' }], rows }) : '' });
  }
  function workLabel(k) { return (V() && V().LABELS && V().LABELS.workType && V().LABELS.workType[k]) || cap(k || ''); }
  function libIssuesCard(subject, issues) {
    const items = arr(issues).map((t) => {
      const fl = t.flowId ? call('flowOf', t.flowId) : null;
      const found = arr(t.foundBy).map((k) => ({ sensor: 'a sensor', visual: 'a look on the round', manual: 'a hand test' }[k] || k));
      return { title: t.name, sub: [found.length ? 'Found by ' + found.join(' or ') : 'How it is found is not recorded', fl ? `diagnostic flow: ${fl.name}` : 'no diagnostic flow yet', plural(t.causes || 0, 'root cause')].join(' · ') };
    });
    return card({ title: 'Issue types', sub: `From the workbook: the problems written for ${subject}.`, body: items.length ? list(items) : empty(`No Issue types are written for ${subject} yet.`) });
  }
  function typeAside(o, owner) {
    if (o && o.aside != null) return o.aside;
    const f = modFn(LIB(), ['downstreamAside']);
    return f ? safe(() => f(owner), '') : '';
  }
  function promoteBanner(o) {
    const id = o && o.q && o.q.promote; if (!id) return '';
    const ov = overrideView(id);
    return ov && ov.promoteBanner ? banner(ov.promoteBanner, { tone: 'info' }) : '';
  }
  function libTabs(base, counts) { return TABS.map(([t, label]) => ({ id: t, label, href: base(t), count: counts[t] ? counts[t] : '' })); }
  function eqTypePage(code, tab, o) {
    const lt = code ? call('libType', code) : null;
    const crumbs0 = [{ label: 'Library', href: '#/library' }, { label: 'Equipment types', href: '#/library/eq-types' }];
    if (!lt) return notFound(crumbs0.concat([{ label: 'Not found' }]), 'This is not one of the library\'s equipment types.', { label: 'Library', href: '#/library' });
    tab = TABS.some((t) => t[0] === tab) ? tab : 'readings';
    const anchorBanner = lt.anchor || lt.banner ? banner(H(`${esc(lt.banner || '')} ${arr(lt.movedToTypes).map((m) => a(m.href || upTypeHref(m.id), m.name)).join(' · ')}`), { tone: 'info' }) : '';
    const counts = { readings: arr(lt.readings).length, issues: arr(lt.issues).length, tasks: arr(lt.schedules).length };
    let body = '';
    if (lt.anchor && tab !== 'details') body = empty(`The content for this type sits on its unit-process ${arr(lt.movedToTypes).length === 1 ? 'type' : 'types'}.`, arr(lt.movedToTypes).map((m) => btn(m.name, { href: m.href || upTypeHref(m.id), small: true })).join(' '));
    else if (tab === 'readings') body = section('Readings and their limit rules', typeReadingCards(lt.readings), { sub: 'A template holds a limit rule per band. Plants that follow it change when it is published.' });
    else if (tab === 'issues') body = libIssuesCard(lt.typeName, lt.issues);
    else if (tab === 'tasks') body = typeTasksCard(null, lt.schedules, 'They reach every plant with this equipment type.');
    else body = typeDetails(lt, { kind: 'eqType', code: lt.code }, !!typeAside(o, { kind: 'eqType', code: lt.code }));
    const used = arr(lt.plants);
    return UI.page({
      crumbs: crumbs0.concat([{ label: lt.typeName }]),
      title: lt.typeName,
      chips: [chip(lt.chipText || `Equipment type · v${lt.version}`, { tone: 'lib' }), lt.family ? chip(lt.family, { tone: 'muted' }) : '', chip(`Used at ${plural(lt.plantCount != null ? lt.plantCount : used.length, 'plant')}`, { tone: 'muted' })],
      sub: used.length ? `At ${used.map((p) => `${p.name} (${p.count})`).join(', ')}` : 'Not used at any plant yet',
      banner: (o && o.banner || '') + promoteBanner(o) + anchorBanner,
      tabs: libTabs((t) => eqTypeHref(lt.code, t), counts), active: tab,
      body, aside: typeAside(o, { kind: 'eqType', code: lt.code }), cls: 'pg-obj pg-type',
    });
  }
  function typeDetails(t, owner, asideHere) {
    const params = arr(t.paramsExpected).map((p) => ((V() && V().PARAMS && V().PARAMS[p] && V().PARAMS[p].label) || p));
    const tierNow = owner.kind === 'eqType' ? (call('typeDefaultTier', t.code) || t.tier) : null;
    const rows = [];
    if (owner.kind === 'eqType') { rows.push(['Equipment type', H(`${esc(t.typeName)} ${chip(t.code, { mono: true })}`)]); rows.push(['Family', t.family || '—']); }
    if (owner.kind === 'upType') {
      rows.push(['Stage', t.stageLabel || 'No stage']);
      rows.push(['Identified from', arr(t.identifiedFrom || t.anchorNames).join(', ') || '—']);
      rows.push(['Expected participants', arr(t.expected).join(', ') || '—']);
      rows.push(['Content first copied from', t.contentFromName || '—']);
    }
    rows.push(['Design parameters this type uses', params.length ? params.join(', ') : 'None']);
    if (tierNow) rows.push(['Default criticality tier', `Criticality tier ${tierNow}`]);
    rows.push(['Version', `v${t.version || 1}`]);
    let out = card({ title: 'About this type', body: kv(rows) });
    if (asideHere) return out;          /* the library's aside carries the overrides line, variant requests and history */
    const code = owner.code || owner.id;
    const ovs = arr(call('overrides', { owner: code })).filter((x) => x.state !== 'reverted');
    const moved = ovs.filter((x) => x.state === 'basemoved').length;
    out += `<p class="o-hint">${a(`#/deviations?template=${enc(code)}`, `Overrides at plants: ${ovs.length} · ${moved} base moved`)}</p>`;
    const vr = arr(call('variantRequests', code));
    out += card({ title: 'Variant requests', sub: 'Requests from plants, newest first. Nothing changes until someone builds a variant and publishes it.', body: vr.length ? list(vr.map((r) => ({ title: `${r.at ? fmtDay(r.at) : ''} · ${r.plantName || UI.plantName(r.plant)} · "${r.trait}"${r.note ? ' · ' + r.note : ''}`, sub: r.fromText ? `From an override: ${r.fromText}` : (r.by || '') }))) : empty('No variant requests.') });
    const ch = arr(t.changes);
    out += card({ title: 'Version history', sub: 'The type\'s own fields. Each template keeps its own versions.', body: ch.length ? list(ch.map((c) => ({ title: c.text || `v${c.v || c.version}`, sub: c.at ? fmtDay(c.at) : '' }))) : empty(`v${t.version || 1}: no changes since.`) });
    return out;
  }
  function upTypePage(id, tab, o) {
    const t = id ? call('upTypeView', id) : null;
    const crumbs0 = [{ label: 'Library', href: '#/library' }, { label: 'Unit-process types', href: '#/library/up-types' }];
    if (!t) return notFound(crumbs0.concat([{ label: 'Not found' }]), 'This is not one of the library\'s unit-process types.', { label: 'Library', href: '#/library' });
    tab = TABS.some((x) => x[0] === tab) ? tab : 'readings';
    const counts = { readings: arr(t.readings).length, issues: arr(t.issues).length, tasks: arr(t.schedules).length };
    let body = '';
    if (tab === 'readings') body = section('Readings and their limit rules', typeReadingCards(t.readings), { sub: 'The Trigger templates of this unit-process type. Plants that follow a template change when it is published.' });
    else if (tab === 'issues') body = libIssuesCard(t.name, t.issues);
    else if (tab === 'tasks') body = typeTasksCard(null, t.schedules, `Filed on each ${t.name} unit process at a plant.`);
    else body = typeDetails(t, { kind: 'upType', id: t.id }, !!typeAside(o, { kind: 'upType', id: t.id }));
    const used = arr(t.plants);
    return UI.page({
      crumbs: crumbs0.concat([{ label: t.name }]),
      title: t.name,
      chips: [chip(t.chipText || `Unit-process type · v${t.version}`, { tone: 'lib' }), chip(`Stage: ${t.stageLabel || 'No stage'}`, { tone: 'muted' })],
      sub: used.length ? `At ${used.map((p) => `${p.name} (${p.count})`).join(', ')}` : 'No plant has one yet',
      banner: (o && o.banner || '') + promoteBanner(o),
      tabs: libTabs((x) => upTypeHref(t.id, x), counts), active: tab,
      body, aside: typeAside(o, { kind: 'upType', id: t.id }), cls: 'pg-obj pg-type',
    });
  }
  const PT_TABS = [['tasks', 'Tasks'], ['types', 'Types offered'], ['plants', 'Plants']];
  function plantTypePage(id, tab, o) {
    const t = id ? call('plantTypeView', id) : null;
    const crumbs0 = [{ label: 'Library', href: '#/library' }, { label: 'Plant types', href: '#/library/plant-types' }];
    if (!t) return notFound(crumbs0.concat([{ label: 'Not found' }]), 'This is not one of the library\'s plant types.', { label: 'Library', href: '#/library' });
    tab = PT_TABS.some((x) => x[0] === tab) ? tab : 'tasks';
    let body = '';
    if (tab === 'tasks') body = typeTasksCard(null, t.templates, 'The plant rounds: each sits on the plant, not on a unit process or equipment.');
    else if (tab === 'types') {
      const ups = arr(t.upTypes).map((x) => { const u = call('upType', x) || { id: x, name: x }; return { title: H(a(upTypeHref(u.id), u.name)) }; });
      const eqs = arr(t.eqTypes).map((x) => { const l = call('libType', x) || { code: x, typeName: x }; return { title: H(a(eqTypeHref(l.code), l.typeName)) }; });
      body = card({ title: 'Unit-process types', body: ups.length ? list(ups) : empty('None yet.') }) + card({ title: 'Equipment types', body: eqs.length ? list(eqs) : empty('None yet.') });
    } else body = card({ title: 'Plants', body: arr(t.plants).length ? list(arr(t.plants).map((p) => ({ title: H(a(pHref(p.key), p.name)) }))) : empty('No plant of this type yet.') });
    return UI.page({
      crumbs: crumbs0.concat([{ label: t.name }]), title: t.name,
      chips: [chip(t.chipText || `Plant type · v${t.version}`, { tone: 'lib' })],
      banner: (o && o.banner) || '',
      tabs: PT_TABS.map(([x, label]) => ({ id: x, label, href: plantTypeHref(t.id, x) })), active: tab,
      body, aside: typeAside(o, { kind: 'plantType', id: t.id }), cls: 'pg-obj pg-type',
    });
  }

  /* ════ design parameters ═════════════════════════════════════════════════════════════════════════════════ */
  function designParamsBlock(key, ref, o) {
    o = o || {}; const q = o.q || (safe(() => UI.current().params._q, {}) || {});
    const rows = arr(call('designParams', key, ref));
    const tr = rows.map((r) => {
      const fid = r.field || `dp.${r.key}`;
      const act = r.editable ? btn(r.action || 'Edit', { act: 'dp:edit', data: { plant: key, kind: ref.kind, id: ref.id || '', param: r.key }, small: true, kind: r.action === 'Add' ? 'primary' : 'secondary' }) : '';
      return { _cls: `o-dprow${tgtCls(q, fid)}`, param: H(`<span id="f-${esc(fid)}">${esc(r.label)}</span>`), value: r.valueText || '—', source: H(srcChip(r.chip)), used: r.usedByText || '—', act: H(act) };
    });
    return card({
      title: 'Design parameters', id: 'c-dp',
      sub: ref.kind === 'plant' ? 'Values for the whole plant. A limit rule can use them.' : 'Values from the survey, a person or worked out from others. Limit rules use them.',
      body: tr.length ? UI.table({ cols: [{ label: 'Parameter', key: 'param' }, { label: 'Value', key: 'value', cls: 'nowrap' }, { label: 'Source', key: 'source' }, { label: 'Used by', key: 'used' }, { label: '', key: 'act', cls: 'r' }], rows: tr }) : empty('No design parameters for this one.'),
    });
  }
  let DP = null;   // the open design-parameter sheet
  function dpTitle(key, ref, row) {
    const tag = ref.kind === 'plant' ? plantName(key) : ((nodeOf(key, ref.id) || {}).tag || row.tag || '');
    return `${row.label} · ${tag}`;
  }
  function dpBody(st) {
    const row = st.row; const pv = st.value !== '' && isFinite(+st.value) ? call('designParamPreview', st.key, st.ref, st.param, +st.value) : null;
    const lines = pv && pv.ok !== false ? arr(pv.lines) : [];
    const needsNote = row.surveyValue != null;
    return UI.field({ label: row.label, html: `<span class="o-row2"><input type="number" step="any" min="0" data-dp="value" value="${esc(st.value)}" aria-label="${esc(row.label)}">${row.unit ? `<span class="o-unit">${esc(row.unit)}</span>` : ''}</span>` })
      + (row.surveyText ? `<p class="o-hint">${esc(row.surveyText)}</p>` : '')
      + UI.field({ label: 'Note', hint: needsNote ? 'Required: say why this differs from the survey.' : 'Optional.', html: `<textarea rows="2" data-dp="note">${esc(st.note)}</textarea>` })
      + `<div class="o-prev o-dp-prev" aria-live="polite">${lines.length ? `<h4>If you save</h4><ul class="o-prev-l">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<span class="muted">Type a value to see what it changes.</span>'}</div>`
      + `<p class="field-e o-dp-err" role="alert">${esc(st.err || '')}</p>`;
  }
  function openDesignParam(key, ref, param) {
    ref = ref || {};
    if (!ref.kind) ref = { kind: ref.id && isUpId(key, ref.id) ? 'up' : ref.id ? 'eq' : 'plant', id: ref.id };
    const row = arr(call('designParams', key, ref)).find((r) => r.key === param);
    if (!row) { UI.toast('That design parameter could not be found.'); return null; }
    DP = { key, ref, param, row, value: row.value == null ? '' : String(row.value), note: '', err: null };
    return UI.openSheet({
      title: dpTitle(key, ref, row), sub: plantName(key), body: dpBody(DP),
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'sheet' }, kind: 'ghost' }) + btn('Save', { act: 'dp:save', kind: 'primary' }),
      onBind: dpBind, onClose: () => { DP = null; },
    });
  }
  function dpBind(el) {
    if (!el || el._oDp || typeof el.addEventListener !== 'function') return;
    el._oDp = true;
    const h = (ev) => {
      const t = ev.target; if (!DP || !t || !t.getAttribute) return; const k = t.getAttribute('data-dp'); if (!k) return;
      DP[k] = t.value; DP.err = null;
      const box = el.querySelector('.o-dp-prev'); if (box && k === 'value') { const tmp = document.createElement('div'); tmp.innerHTML = dpBody(DP); const nb = tmp.querySelector('.o-dp-prev'); if (nb) box.innerHTML = nb.innerHTML; }
    };
    el.addEventListener('input', h); el.addEventListener('change', h);
  }
  function saveDesignParam() {
    const st = DP; if (!st) return false;
    if (st.value === '' || !isFinite(+st.value)) { st.err = 'Give a number.'; UI.refreshSheet({ body: dpBody(st) }); return false; }
    const r = call('setDesignParam', st.key, st.ref, st.param, +st.value, { note: st.note });
    if (!r || r.ok === false) { st.err = (r && r.error) || 'That did not save.'; UI.refreshSheet({ body: dpBody(st) }); return false; }
    const key = st.key; const token = r.token;
    DP = null; UI.closeSheet(true);
    UI.toast(r.toast || 'Saved.', token ? { undo: () => call('undoDesignParam', key, token), ms: 10000 } : {});
    return undefined;
  }

  /* ════ the sensor page and its Zones ═════════════════════════════════════════════════════════════════════ */
  function zoneRows(key, s, z, q) {
    const followers = arr(call('alerts', key, { sensorId: s.id }));
    const pinHref = followers.length ? trigHref(key, followers[0].id) : null;
    return BANDS.map((b) => {
      const p = (z.perBand || {})[b] || {}; const fid = `zone.${z.dir}.${b}`;
      const target = { kind: 'zone', sensorId: s.id, dir: z.dir, band: b };
      const val = p.value == null ? `<span class="muted">${esc(p.valueText || 'none')}</span>` : `<b>${esc(p.valueText)}</b>`;
      const extra = p.constantFlag ? `<div class="o-flag small">This scales with the plant. Use a design parameter?</div>` : '';
      return `<tr class="o-zr${tgtCls(q, fid)}" id="f-${esc(fid)}" data-f="${esc(fid)}"><td data-label="Band">${sev(b)}</td><td data-label="Limit">${val}</td><td data-label="Source">${valueChips(p.chip, p.overrideId)}${extra}</td><td data-label="" class="r o-acts">${rowActions(key, p, target, { pinHref })}</td></tr>`
        + formRow(key, target, 4);
    }).join('');
  }
  /* v7/2: the threshold bar over a sensor's Zones — both sides on one bar. Dragging a line (or typing its value) opens that Zone's
     override form with the new value, so the reason and the save stay where every Zone change is made. ZRANGE keeps a scale you set. */
  const ZRANGE = {};
  function zbSides(key, s) {
    const sides = {}; const L = LEDGER();
    arr(s.dirs).forEach((dir) => {
      const z = call('zoneInfo', key, s.id, dir); if (!z) return; const b0 = {};
      BANDS.forEach((b) => {
        let val = z.bands ? num(z.bands[b]) : null;
        const t = { kind: 'zone', sensorId: s.id, dir, band: b };
        if (L && typeof L.isOpen === 'function' && safe(() => L.isOpen(key, t), false)) { const st = safe(() => L._forms[L._fk(key, t)], null); if (st && st.raw !== '' && isFinite(+st.raw)) val = +st.raw; }
        b0[b] = val;
      });
      sides[dir] = b0;
    });
    return sides;
  }
  function zbOpts(key, s) {
    const sides = zbSides(key, s); const all = []; Object.keys(sides).forEach((d) => BANDS.forEach((b) => all.push(sides[d][b])));
    const rk = `${key}|${s.id}`; const range = ZRANGE[rk] || UI.tbRange(Array.isArray(s.valid) ? s.valid : null, all, s.latest ? num(s.latest.v) : null);
    const tasks = {}; arr(call('lineWork', key, { sensorId: s.id })).forEach((w) => { tasks[`${w.dir}:${w.band}`] = w.name; });
    return { active: 'both', sides, range, value: s.latest ? num(s.latest.v) : null, unit: s.unit, kind: s.kind, tasks, valueButtons: true,
      hint: 'Drag a line, or click its value: that Zone\'s change opens below, where you give the reason and save. The range only sets the scale.' };
  }
  /* hand a dragged or typed value to the Zone's override form, and render so the form shows it */
  function zbHand(key, s, dir, b, v) {
    const L = LEDGER(); const t = { kind: 'zone', sensorId: s.id, dir, band: b };
    if (L && typeof L.open === 'function') { const st = safe(() => L.open(key, t), null); if (st) st.raw = String(v); }
    else { openOverride(key, t); const f = fsOf(key, t); f.value = v; }
    UI.render();
    if (typeof document !== 'undefined' && document.getElementById) { const row = document.getElementById(`f-zone.${dir}.${b}`); if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' }); }
  }
  function zbBind() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    document.querySelectorAll('.o-zbar[data-zbar]').forEach((box) => {
      const [key, sid] = String(box.getAttribute('data-zbar')).split('|'); const s = sensorOf(key, sid); if (!s) return;
      let live = zbOpts(key, s); UI.tbSync(box, live);
      UI.tbBind(box, {
        get: () => live,
        onValue: (b, v, dir) => { live = { ...live, sides: { ...live.sides, [dir]: { ...live.sides[dir], [b]: v } } }; UI.tbSync(box, live); },
        onEnd: (b, dir) => { const v = live.sides[dir] && live.sides[dir][b]; if (v != null) zbHand(key, s, dir, b, v); },
        onPick: (b, dir) => { const v = live.sides[dir] && live.sides[dir][b]; if (v != null) zbHand(key, s, dir, b, v); },
        onRange: (lo, hi) => { ZRANGE[`${key}|${sid}`] = [lo, hi]; live = { ...live, range: [lo, hi] }; UI.tbSync(box, live); },
      });
    });
  }
  if (typeof UI.afterRender === 'function') UI.afterRender(zbBind);

  /* v7/2: what a line raises (condition-based work): under a Trigger's bands, and on the sensor where it is set */
  function lineWorkHtml(key, sensorId, dir) {
    const ws = arr(call('lineWork', key, { sensorId, dir })); if (!ws.length) return '';
    return `<ul class="lw-list">${ws.map((w) => { const t = call('task', key, w.id); return `<li>${sev(w.band)} <span class="lw-does">raises the Task</span> ${a(taskHref(key, w.id), w.name)} <span class="lw-does">at ${esc(w.filed.text)}${t ? ' · ' + esc(t.statusLabel) : ''}, instead of an Issue</span></li>`; }).join('')}</ul>`;
  }
  /* each line set on this sensor, and what it does: opens an Issue, or raises a Task at a unit process (one the equipment takes part in,
     or the unit process the sensor sits on) or the plant. Emergency always opens an Issue. */
  const LW = {};   // drafts of the line form, by key|sensor|dir|band
  function lineWorkWhere(key, s) {
    const node = nodeOf(key, s.eqId); const up = node && isUpId(key, node.id);
    const ups = up ? [{ id: node.id, tag: node.tag }] : arr(safe(() => V().membershipOf(key, s.eqId).participatesIn, [])).map((m) => ({ id: m.upId, tag: m.tag }));
    return ups.concat([{ id: '', tag: 'the plant' }]);
  }
  function lwDraft(key, s, dir, b) {
    const w = arr(call('lineWork', key, { sensorId: s.id, dir })).find((x) => x.band === b) || null; const where = lineWorkWhere(key, s);
    return { does: w ? 'task' : 'issue', name: w ? w.name : '', at: w ? (w.filed.kind === 'up' ? w.filed.id : '') : (where[0] ? where[0].id : '') };
  }
  function lineWorkCard(key, s, dirs) {
    if (s.kind === 'status' || s.kind === 'meter') return '';
    const where = lineWorkWhere(key, s); const rows = [];
    dirs.forEach((dir) => {
      const z = call('zoneInfo', key, s.id, dir); if (!z) return;
      BANDS.filter((b) => z.bands && num(z.bands[b]) != null).forEach((b) => {
        const w = arr(call('lineWork', key, { sensorId: s.id, dir })).find((x) => x.band === b) || null;
        const k = `${key}|${s.id}|${dir}|${b}`;
        const head = `${sev(b)} <span class="muted small">${esc(dir === 'below' ? 'falls below' : 'rises above')} ${esc(fv(z.bands[b], s.unit, s.kind))}</span>`;
        if (b === 'emergency') { rows.push(`<div class="o-lw"><div class="o-lw-k">${head}</div><div class="o-lw-d"><span class="lw-does">Opens an Issue and calls everyone</span></div></div>`); return; }
        /* read-only until Change: no input on the sensor page until a form opens */
        if (!LW[k]) { rows.push(`<div class="o-lw"><div class="o-lw-k">${head}</div><div class="o-lw-d"><span class="lw-does">${w ? `Raises the Task ${a(taskHref(key, w.id), w.name)} at ${esc(w.filed.text)}, instead of an Issue` : 'Opens an Issue'}</span>${btn('Change', { act: 'obj:lwopen', data: { k }, small: true, kind: 'ghost' })}</div></div>`); return; }
        const d = LW[k];
        const sel = `<select data-act="obj:lwset" data-k="${esc(k)}" data-f="does" aria-label="What the ${esc(bandName(b))} line does"><option value="issue"${d.does !== 'task' ? ' selected' : ''}>Opens an Issue</option><option value="task"${d.does === 'task' ? ' selected' : ''}>Raises a Task</option></select>`;
        const more = d.does === 'task' ? `<input type="text" data-act="obj:lwset" data-k="${esc(k)}" data-f="name" value="${esc(d.name)}" placeholder="Name the Task" aria-label="The Task the ${esc(bandName(b))} line raises"> <select data-act="obj:lwset" data-k="${esc(k)}" data-f="at" aria-label="Filed at">${where.map((x) => `<option value="${esc(x.id)}"${x.id === d.at ? ' selected' : ''}>at ${esc(x.tag)}</option>`).join('')}</select>` : '';
        const changed = (d.does === 'task') !== !!w || (w && (d.name.trim() !== w.name || (d.at || '') !== (w.filed.kind === 'up' ? w.filed.id : '')));
        const save = (changed ? btn('Save', { act: 'obj:lwsave', data: { k }, small: true, kind: 'primary' }) : '') + btn('Cancel', { act: 'obj:lwcancel', data: { k }, small: true, kind: 'ghost' });
        rows.push(`<div class="o-lw"><div class="o-lw-k">${head}</div><div class="o-lw-d">${sel}${more}${save}</div></div>`);
      });
    });
    if (!rows.length) return '';
    return card({ title: 'What each line does', sub: 'A line opens an Issue, or raises a Task at a unit process or the plant: that is condition-based work, never filed on equipment. The next line out still opens the Issue.', body: rows.join(''), id: 'c-lines' });
  }
  function zonesEditor(key, sensorId, o) {
    o = o || {}; const q = o.q || (safe(() => UI.current().params._q, {}) || {});
    if (String(sensorId || '').startsWith('m:')) return note('Hand-test results stay in the task record: they have no sensor, so no Zones.', 'quiet');
    const s = sensorOf(key, sensorId); if (!s) return empty('This sensor is not in the plant graph.');
    if (s.nextPhase) return note(H(`${chip('Next phase', { tone: 'next' })} This reading is on a line between equipment. It arrives in the next phase, with its Zones.`), 'quiet');
    const dirs = arr(s.dirs);
    if (!dirs.length) return note(s.kind === 'meter' ? 'It counts up: run-hours Tasks read it. It has no Zones.' : 'It reads ON or OFF. It has no Zones.', 'quiet');
    const v = s.latest ? num(s.latest.v) : null;
    const thb = s.kind === 'status' ? '' : `<div class="o-zbar" data-zbar="${esc(key)}|${esc(s.id)}">${UI.tbHtml(zbOpts(key, s))}</div>`;
    const tables = dirs.map((dir) => {
      const z = call('zoneInfo', key, s.id, dir); if (!z) return '';
      const bar = '';
      return `<div class="o-zone"><h3 class="o-zone-h">${esc(dir === 'below' ? 'Falls below' : 'Rises above')}${z.templateName ? ` <span class="muted small">· ${esc(z.templateName)} v${esc(z.templateVersion || 1)}${z.proposed ? ' (proposed)' : ''}</span>` : ''}</h3>${bar ? `<div class="o-dir-bar">${bar}</div>` : ''}`
        + `<div class="t-wrap"><table class="t t-stack o-zt"><thead><tr><th>Band</th><th>Limit</th><th>Source</th><th class="r"></th></tr></thead><tbody>${zoneRows(key, s, z, q)}</tbody></table></div></div>`;
    }).join('');
    return `<div class="o-zones">${thb}${tables}<p class="o-hint">Emergency fires on the first reading (fixed)</p>${lineWorkCard(key, s, dirs)}</div>`;
  }
  function followRow(key, al) {
    const tb = call('triggerBands', key, al.id) || {};
    const own = BANDS.filter((b) => tb.bands && tb.bands[b] && tb.bands[b].overrideId && !tb.bands[b].follows).map((b) => bandName(b));
    const how = tb.frozen ? 'Frozen' : tb.waiting ? 'Base moved · waits for a resync' : own.length ? `Overridden for this Trigger (${own.join(', ')})` : 'Follows sensor';
    return { name: H(a(trigHref(key, al.id), al.name)), status: H(statusChip(key, al)), how };
  }
  function sensorPage(params) {
    const key = params.plant; const id = params.id; const q = params._q || {};
    const P = plantOf(key); if (!P) return plantMissing(key);
    if (String(id || '').startsWith('m:')) return UI.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: P.name, href: pHref(key) }, { label: 'Hand test' }], title: 'Hand test', chips: [plantChip(key)], body: empty('Hand-test results stay in the task record: they have no sensor, so no Zones.', btn('Tasks', { href: pHref(key, 'tasks') })), cls: 'pg-obj' });
    const s = sensorOf(key, id);
    if (!s) return notFound([{ label: 'All Plants', href: '#/plants' }, { label: P.name, href: pHref(key) }, { label: 'Not found' }], 'This sensor is not in the plant graph. Add sensor in the survey.', { label: 'Structure', href: pHref(key, 'structure') });
    if (OPEN && OPEN.path !== curPath()) OPEN = null;
    const followers = arr(call('alerts', key, { sensorId: id }));
    const names = followers.map((al) => a(trigHref(key, al.id), al.name)).join(', ');
    const bn = followers.length ? H(`Limits for this reading live here. ${esc(plural(followers.length, 'Trigger'))} ${followers.length === 1 ? 'follows' : 'follow'} this sensor: ${names}.`) : 'Limits for this reading live here. No Trigger follows this sensor yet.';
    const v = s.latest ? num(s.latest.v) : null;
    const ends = (x) => (typeof UI.numEnd === 'function' ? UI.numEnd(x, s.unit) : fv(x, s.unit, s.kind));
    const valid = Array.isArray(s.valid) && s.kind !== 'status' && s.kind !== 'meter' ? `Valid range ${ends(s.valid[0])}–${ends(s.valid[1])}` : '';
    const row = arr((readingsGroup(key, s.eqId) || {}).rows).find((r) => (r.sensorId || r.id) === s.id);
    const nowText = row && row.nowText && row.nowText !== '—' ? row.nowText : v == null ? 'no reading' : fv(v, s.unit, s.kind);
    const node = nodeOf(key, s.eqId); const up = node && isUpId(key, node.id);
    const fl = followers.map((al) => followRow(key, al));
    const body = section('Zones', zonesEditor(key, id, { q }), { sub: 'The only place this plant\'s limits for the reading change. Every Trigger on it follows these, unless it is overridden for that Trigger only.' })
      + card({ title: 'Triggers that follow this sensor', body: fl.length ? UI.table({ cols: [{ label: 'Trigger', key: 'name' }, { label: 'Status', key: 'status' }, { label: 'Bands', key: 'how' }], rows: fl }) : empty('No Trigger follows this sensor yet.') });
    return UI.page({
      crumbs: crumbsFor(key, s.eqId).concat([{ label: s.tag }]),
      title: H(`<span class="o-tag">${esc(s.tag)}</span>`),
      chips: [chip(s.name, { tone: 'muted' }), chip(`Now ${nowText}`) + ' ' + UI.sampleTag(), valid ? chip(valid, { tone: 'muted' }) : '', node ? chip(`On ${node.tag}`, { href: nodeHref(key, node.id, up), tone: 'muted' }) : '', plantChip(key)],
      sub: `${s.name} on ${node ? `${node.tag} · ${node.name}` : 'the plant'}`,
      banner: banner(bn, { tone: 'info' }),
      body, cls: 'pg-obj pg-sensor',
    });
  }

  /* ════ the Trigger page ══════════════════════════════════════════════════════════════════════════════════ */
  function heldText(h) { return h && h.frozen ? 'Override · frozen' : h && h.waiting ? 'Resync first' : null; }
  function bandsCard(key, al, q) {
    const tb = call('triggerBands', key, al.id) || { bands: {} };
    const h = call('heldOf', key, al.id) || {};
    const hText = heldText(h);
    const rows = BANDS.map((b) => {
      const bb = tb.bands[b] || {}; const fid = `band.${b}`;
      const target = { kind: 'triggerLimit', alertId: al.id, dir: al.dir, band: b };
      const val = bb.value == null ? `<span class="muted">${esc(bb.valueText || 'none')}</span>` : `<b>${esc(bb.valueText)}</b>`;
      const overlay = bb.overlay ? `<div>${srcChip(bb.overlay)}</div>${bb.nowText ? `<div class="muted small">${esc(bb.nowText)}</div>` : ''}` : '';
      const zoneSmall = bb.zone && bb.zone.chip && bb.zone.chip.small && bb.follows !== false ? `<small class="src-small">${esc(bb.zone.chip.small)}</small>` : '';
      const src = bb.follows === false && bb.overrideId ? srcChip(bb.chip) : `${linkChip(bb.chip, bb.href || sensorHref(key, al.sensorId, `zone.${al.dir}.${b}`))}${zoneSmall}`;
      let act;
      if (LEDGER() && typeof LEDGER().fieldActions === 'function') act = rowActions(key, bb, target);
      else if (hText) act = btn(hText, { disabled: true, small: true });
      else if (bb.overrideId && bb.follows === false) act = ovButtons(key, bb.overrideId, target);
      else act = overrideBtn(key, target, 'Override for this Trigger only', { kind: 'ghost' });
      return `<tr class="o-zr${tgtCls(q, fid)}" id="f-${esc(fid)}" data-f="${esc(fid)}"><td data-label="Band">${sev(b)}</td><td data-label="Limit">${val}${overlay}</td><td data-label="Source">${src}</td><td data-label="" class="r o-acts">${act}</td></tr>` + formRow(key, target, 4);
    }).join('');
    return card({
      title: H(`Bands · ${esc(al.sensorName || 'reading')} <span class="mono muted">${esc(al.sensorTag || '')}</span>`),
      sub: `${al.dir === 'below' ? 'Falls below' : 'Rises above'} its limits. They follow the sensor's Zones.`,
      body: `<div class="t-wrap"><table class="t t-stack o-zt"><thead><tr><th>Band</th><th>Limit</th><th>Source</th><th class="r"></th></tr></thead><tbody>${rows}</tbody></table></div>`
        + `<p class="o-hint">${esc(LIMITS_FOOT)}</p><p class="o-hint">Emergency band: fires on the first reading (fixed)</p>` + lineWorkHtml(key, al.sensorId, al.dir),
      actions: [btn('Edit on sensor', { href: sensorHref(key, al.sensorId), small: true })],
      id: 'c-bands',
    });
  }
  function timingRow(key, al, which, q, hText) {
    const x = which === 'persistence' ? al.hold : al.clear; const target = { kind: which, alertId: al.id };
    const label = which === 'persistence' ? 'Persistence · must hold for' : 'Clearing · must clear for';
    const st = x ? { overrideId: x.overrideId, source: x.source } : {};
    const act = LEDGER() && typeof LEDGER().fieldActions === 'function' ? rowActions(key, st, target) : hText ? btn(hText, { disabled: true, small: true }) : valueActions(key, st, target);
    return `<div class="o-field${tgtCls(q, which)}" id="f-${which}" data-f="${which}"><div class="o-field-l">${esc(label)} <b>${esc(x ? x.valueText : '—')}</b></div><div class="o-field-v">${x ? valueChips(x.chip, x.overrideId) : ''}</div><div class="o-field-a">${act}</div></div>`
      + rowForm(key, target);
  }
  function settingsCard(key, P, al, q) {
    const h = call('heldOf', key, al.id) || {};
    const hText = heldText(h);
    const enabled = al.state === 'active';
    const enRec = arr(call('overrides', { plant: key, kind: 'enabled' })).find((o) => o.target && o.target.alertId === al.id && o.state !== 'reverted');
    let enAct = '';
    /* an open Issue freezes the Trigger: setting it inactive would leave that Issue with nothing to clear it, so it waits too */
    if (enabled && h.frozen) enAct = btn('Override · frozen', { disabled: true, small: true, title: 'This Trigger is frozen while its Issue is open.' });
    else if (P.state === 'live' && enabled) enAct = enRec ? rowActions(key, { overrideId: enRec.id }, { kind: 'enabled', alertId: al.id }) : openBtnFor(key, { kind: 'enabled', alertId: al.id }, 'Set inactive…');
    else if (enabled) enAct = btn('Set inactive…', { act: 'obj:inactive', data: { plant: key, alert: al.id }, small: true });
    else if (al.state === 'inactive') enAct = enRec ? rowActions(key, { overrideId: enRec.id }, { kind: 'enabled', alertId: al.id }) : btn('Activate', { act: 'obj:activate', data: { plant: key, alert: al.id }, small: true });
    const enRow = `<div class="o-field${tgtCls(q, 'enabled')}" id="f-enabled" data-f="enabled"><div class="o-field-l">Enabled · <b>${enabled ? 'On' : 'Off'}</b></div><div class="o-field-v">${statusChip(key, al)}${enRec ? ' ' + srcChip(enRec.chip) : ''}</div><div class="o-field-a">${enAct}</div></div>`
      + rowForm(key, { kind: 'enabled', alertId: al.id });
    const bandsSet = BANDS.filter((b) => al.bands && num(al.bands[b]) != null);
    const clocks = bandsSet.map((b) => `<li>${sev(b)}<span>${esc(clockText(b))}</span></li>`).join('');
    return card({
      title: 'Persistence and clearing',
      sub: 'A firing starts once the reading has been past a limit this long, and ends once it has been back inside this long.',
      body: timingRow(key, al, 'persistence', q, hText) + timingRow(key, al, 'clearing', q, hText)
        + '<p class="o-hint">Emergency band: fires on the first reading (fixed)</p>'
        + enRow
        + (bandsSet.length ? `<div class="o-clock-w"><h4>${esc(al.clockText || 'Start by / fix by follow the severity')}</h4><ul class="o-clock">${clocks}</ul><p class="o-hint">Set by severity for every Trigger; there is nothing to set here.</p></div>` : ''),
      id: 'c-settings',
    });
  }
  function clockText(b) { const t = String(call('sevClock', b) || ''); return cap(t.replace(/^Caution:\s*/, '')); }
  function trialCard(key, al, q) {
    const ts = call('trialStats', key, al.id);
    if (!ts) return '';
    const all = q && q.all === '1';
    const rows = arr(ts.rows);
    const shown = all ? rows : rows.slice(-12);
    const tr = shown.map((r) => ({
      start: r.startText, end: r.running ? H(`<span class="tx-warn">${esc(r.endText)}</span>`) : r.endText, band: H(sev(r.band)), peak: r.peakText, length: r.lengthText,
      chip: H(r.chip ? chip(r.chip, { tone: 'bad' }) : ''),
    }));
    const more = rows.length > 12 ? `<p class="o-hint">${all ? a(trigHref(key, al.id), 'Show the latest 12') : a(`${trigHref(key, al.id)}?all=1`, `Show all ${rows.length}`)}</p>` : '';
    return card({
      title: H(`${esc(ts.title || 'Trial')} ${UI.sampleTag()}`),
      sub: H(`${esc(ts.text || '')}${ts.noisyChip ? ' ' + chip(ts.noisyChip, { tone: 'gap' }) : ''}`),
      body: dayBars(ts) + (tr.length ? UI.table({ cols: [{ label: 'Start', key: 'start', cls: 'nowrap' }, { label: 'End', key: 'end', cls: 'nowrap' }, { label: 'Band', key: 'band' }, { label: 'Peak', key: 'peak', cls: 'nowrap' }, { label: 'Length', key: 'length', cls: 'nowrap' }, { label: '', key: 'chip' }], rows: tr }) : '') + more,
      id: 'c-trial', cls: ts.noisy ? 'o-noisy' : '',
    });
  }
  /* one bar per trial day, from the stored trial firings */
  function dayBars(ts) {
    const from = ts.since; const to = ts.to || now(); if (from == null) return '';
    const days = []; let t = from;
    while (t <= to + 1 && days.length < 40) { const label = fmtDay(t); if (!days.length || days[days.length - 1].label !== label) days.push({ label, n: 0 }); t += HOUR; }
    arr(ts.firings).forEach((f) => { const label = fmtDay(f.start); const d = days.find((x) => x.label === label); if (d) d.n++; });
    if (!days.length) return '';
    const max = Math.max(12, ...days.map((d) => d.n));
    const px = (n) => Math.round((n / max) * 92);
    const bars = days.map((d) => `<div class="o-day${d.n > 10 ? ' noisy' : ''}"><b>${d.n}</b><i style="height:${px(d.n)}px"></i><small>${esc(d.label.replace(/ \w+$/, ''))}</small></div>`).join('');
    return `<div class="o-days" role="img" aria-label="Trial firings per day, against the noisy line at 10 a day">${bars}<div class="o-days-line" style="bottom:${19 + px(10)}px"><span>10 a day</span></div></div>`;
  }
  function liveCard(key, P, al) {
    if (P.state !== 'live' || al.state !== 'active') return '';
    const c = call('coverage', key); const r = c ? arr(c.perTrigger).find((x) => x.alertId === al.id) : null;
    const label = c && c.window ? c.window.label : 'Issues, last 7 days';
    if (!r) return card({ title: H(`${esc(label)} ${UI.sampleTag()}`), body: empty('No Issues from this Trigger in that time.') });
    return card({
      title: H(`${esc(label)} ${UI.sampleTag()}`),
      body: stats([
        { value: String(r.issues), label },
        { value: r.perDayText || String(r.perDay), label: 'a day' },
        { value: r.falseAlarmShare == null ? '—' : `${Math.round(r.falseAlarmShare * 100)}%`, label: 'closed as false alarm' },
        { value: r.medianCloseMin == null ? '—' : (UI.dur ? UI.dur(r.medianCloseMin) : `${r.medianCloseMin} min`), label: 'median time to close' },
      ]) + (r.noisy ? note('Noisy: more than 10 Issues a day.', 'warn') : ''),
    });
  }
  function versionCard(key, al) {
    if (!al.templateId) return '';
    const pins = arr(call('pins', { plant: key })).filter((p) => p.templateId === al.templateId);
    const pinned = pins[0] || null;
    const h = call('heldOf', key, al.id) || {};
    const majors = arr(call('majorDrafts', key)).filter((m) => m.templateId === al.templateId);
    let extra = '';
    if (h.held && al.templateCurrent && al.templateVersion && al.templateCurrent > al.templateVersion) extra = ` · v${al.templateCurrent} is published: this Trigger is frozen, so it's still on v${al.templateVersion}`;
    else if (majors.length) extra = ` · held at v${al.templateVersion} by a Major change: accept its draft in the review queue`;
    const pb = modFn(LIB(), ['pinButton']);
    const libBtn = pb ? safe(() => pb(key, al.templateId), '') : '';
    const action = libBtn || (pinned
      ? btn(`Unpin · follows v${al.templateCurrent || pinned.latest}`, { act: 'obj:unpin', data: { plant: key, tpl: al.templateId }, small: true })
      : btn(`Pin this plant to v${al.templateVersion || 1}`, { act: 'obj:pin', data: { plant: key, tpl: al.templateId, v: al.templateVersion || 1 }, small: true, kind: 'ghost' }));
    return card({
      title: 'Version',
      body: `<p>${a(tplHref(al.templateId), `Template ${al.templateName || ''} v${al.templateVersion || 1}`)}${esc(extra)}</p>${pinned && !libBtn ? `<p class="o-hint">${srcChip(pinned.chip)} ${esc(pinned.reason || '')}</p>` : ''}`,
      actions: [action], tone: 'quiet',
    });
  }
  function issuesOfTrigger(key, al) {
    const recs = arr(call('issues', key, {})).filter((i) => i.alertId === al.id);
    if (!recs.length) return '';
    const sorted = recs.slice().sort((x, y) => (x.status === 'closed') - (y.status === 'closed') || y.opened - x.opened);
    return card({ title: `Issues it opened: ${recs.length}`, sub: recs.length > 10 ? 'The latest 10 shown' : '', body: list(sorted.slice(0, 10).map((i) => issueItem(key, i, null))) });
  }
  function diagCard(al) {
    const fl = al.flowId ? call('flowOf', al.flowId) : null;
    return card({
      title: 'Diagnostic flow', sub: 'Written in the library; read-only here.', tone: 'quiet',
      body: fl ? `<p>${a(`#/library/flows/${enc(fl.id)}`, fl.name)} <span class="muted">· ${esc(plural(arr(fl.steps).length, 'step'))}</span></p>` : empty('No diagnostic flow in the library for this Trigger yet.'),
    });
  }
  function statusCard(key, P, al) {
    if (al.state !== 'draft') return '';
    const live = P.state === 'live';
    return card({
      title: H(`Status ${statusChip(key, al)}`),
      sub: live ? `Accepted, not active. Activating it on ${P.name} creates Issues and notifies people straight away: a Live plant has no trial.` : `Activating it starts recording trial firings. Commissioning: nothing is sent.`,
      actions: [btn('Activate', { act: 'obj:activate', data: { plant: key, alert: al.id }, kind: 'primary', small: true }), btn('Leave inactive', { act: 'obj:leave', data: { plant: key, alert: al.id }, small: true })],
      tone: 'info',
    });
  }
  function triggerPage(params) {
    const key = params.plant; const id = params.id; const q = params._q || {};
    const P = plantOf(key); if (!P) return plantMissing(key);
    if (OPEN && OPEN.path !== curPath()) OPEN = null;
    const al = alertOf(key, id);
    if (!al) {
      const sc = scheduleOf(key, id); if (sc) return taskTriggerPage(key, P, sc, q);
      const co = call('conditionOf', key, id); if (co) return conditionTriggerPage(key, P, co, q);
      return notFound([{ label: 'All Plants', href: '#/plants' }, { label: P.name, href: pHref(key) }, { label: 'Not found' }], 'This Trigger is not at this plant.', { label: 'Triggers', href: pHref(key, 'triggers') });
    }
    const h = call('heldOf', key, id) || {};
    const subject = al.subject || null;
    const bans = [];
    if (h.frozen) {
      const n = arr(h.openIssueIds).length;
      bans.push(banner(H(`${esc(plural(n, 'open Issue'))} · this Trigger's terms are frozen until it closes. Changes on ${esc(al.sensorTag || 'its sensor')} and in the library show here as Base moved until you resync it.`), { tone: 'info', action: arr(h.openIssueIds)[0] ? btn('Open the Issue', { href: issueHref(key, h.openIssueIds[0]), small: true }) : '' }));
    } else if (h.waiting) {
      bans.push(banner(`Base moved · this Trigger is still on the terms it was frozen on. ${al.sensorTag || 'Its sensor'} or the library changed since.`, { tone: 'info', action: btn('Resync with the sensor', { act: 'rs:open', data: { plant: key, alert: id }, small: true, kind: 'primary' }) }));
    }
    if (P.state === 'commissioning') bans.push(banner('Commissioning: nothing is sent. Firings below are trials only.', { tone: 'info' }));
    if (al.structureFlag) bans.push(banner(al.structureFlag.line || `Structure changed ${fmt(al.structureFlag.at)}: ${al.structureFlag.text}. Nothing in this Trigger's terms changed.`, { tone: 'info', action: btn('Mark as checked', { act: 'obj:flagok', data: { plant: key, alert: id }, small: true }) }));
    const parts = [];
    parts.push(statusCard(key, P, al));
    parts.push(trialCard(key, al, q));
    parts.push(liveCard(key, P, al));
    parts.push(bandsCard(key, al, q));
    parts.push(settingsCard(key, P, al, q));
    parts.push(versionCard(key, al));
    parts.push(issuesOfTrigger(key, al));
    parts.push(diagCard(al));
    return UI.page({
      crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: P.name, href: pHref(key) }, { label: 'Triggers', href: pHref(key, 'triggers') }, { label: al.name }],
      title: al.name,
      chips: [
        chip('Issue', { tone: 'muted', title: 'What it opens' }),
        al.templateId ? chip(`Template: ${al.templateName} v${al.templateVersion || 1} ↗`, { href: tplHref(al.templateId), title: 'Its template in the library' }) : chip('No template', { tone: 'muted' }),
        subject ? chip(`Subject: ${subject.tag}`, { href: subject.href, title: subject.text }) : '',
        statusChip(key, al),
        al.pinnedTo ? chip(`Pinned to v${al.pinnedTo}`, { tone: 'pin' }) : '',
        plantChip(key),
      ],
      sub: `Reads ${al.sensorName || 'a reading'}${al.sensorTag ? ` (${al.sensorTag})` : ''}${subject ? ` on ${subject.text}` : ''}, ${al.dir === 'below' ? 'falling below' : 'rising above'} its limits.`,
      banner: bans.join(''),
      body: parts.filter(Boolean).join(''),
      cls: 'pg-obj pg-trig',
    });
  }
  function taskTriggerPage(key, P, sc, q) {
    const c = call('cadenceOf', key, sc.id) || {};
    const tk = call('task', key, sc.taskId || sc.id) || {};
    const node = nodeOf(key, sc.eqId); const up = node && isUpId(key, node.id);
    const name = `${sc.name}${sc.eqTag ? ' · ' + sc.eqTag : ''}`;
    const cadTarget = { kind: 'cadence', scheduleId: sc.id };
    const cadRow = `<div class="o-field${tgtCls(q, 'cadence')}" id="f-cadence" data-f="cadence"><div class="o-field-l">How often · <b>${esc(c.everyText || sc.everyText || '')}</b></div><div class="o-field-v">${valueChips(c.chip, c.overrideId)}</div><div class="o-field-a">${rowActions(key, { overrideId: c.overrideId, source: c.source }, cadTarget)}</div></div>`
      + rowForm(key, cadTarget);
    let rhRow = '';
    if (tk.runHours && (sc.basis === 'either')) {
      const rh = tk.runHours; const ov = rh.overrideId ? overrideView(rh.overrideId) : null; const t2 = { kind: 'runhours', scheduleId: sc.id };
      rhRow = `<div class="o-field${tgtCls(q, 'runhours')}" id="f-runhours" data-f="runhours"><div class="o-field-l">Run-hours · <b>every ${esc(rh.value)} run-hours</b></div><div class="o-field-v">${srcChip(ov ? ov.chip : c.chip)}</div><div class="o-field-a">${rowActions(key, { overrideId: rh.overrideId, source: rh.overrideId ? 'override' : 'library' }, t2)}</div></div>`
        + rowForm(key, t2);
    }
    const facts = kv([
      ['Next due', tk.due != null ? fmt(tk.due) : (tk.statusLabel || (P.state === 'commissioning' ? 'Starts at go-live' : '—'))],
      ['Last service', tk.lastDone ? fmtDay(tk.lastDone) : 'Not recorded'],
      ['Status', tk.statusLabel || cap(tk.status || sc.status || '')],
    ]);
    return UI.page({
      crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: P.name, href: pHref(key) }, { label: 'Triggers', href: pHref(key, 'triggers') }, { label: name }],
      title: name,
      chips: [chip('Task', { tone: 'muted' }), c.templateId ? chip(`Template: ${(call('template', c.templateId) || {}).name || sc.name} v${c.templateVersion || 1} ↗`, { href: tplHref(c.templateId) }) : '', node ? chip(`Subject: ${node.tag}`, { href: nodeHref(key, node.id, up) }) : chip('Subject: the plant', { tone: 'muted' }), UI.stateChip(sc.status === 'active' ? 'active' : sc.status || 'active', { plant: key }), plantChip(key)],
      sub: `${sc.workLabel || 'Task'}${node ? ` on ${node.tag} · ${node.name}` : ' on the plant'}. This page is the one editor of its cadence.`,
      body: card({ title: 'Cadence', body: cadRow + rhRow + `<p class="o-hint">The Task page shows the cadence read-only; the Equipment Card opens this same form in a sheet.</p>`, id: 'c-cadence' })
        + card({ title: 'The Task', body: facts, actions: [btn('Open the Task', { href: taskHref(key, tk.id || sc.taskId || sc.id), small: true })] }),
      cls: 'pg-obj pg-trig',
    });
  }
  function conditionTriggerPage(key, P, co, q) {
    const node = nodeOf(key, co.nodeId); const up = node && isUpId(key, node.id);
    const name = `${co.name} · ${co.tag}`;
    const row = (which, label) => {
      const pf = co.perField[which] || {}; const fid = `condition.${which}`; const t = { kind: 'condition', workId: co.workId, which };
      return `<div class="o-field${tgtCls(q, fid)}" id="f-${fid}" data-f="${fid}"><div class="o-field-l">${esc(label)} <b>${esc(pf.valueText || '—')}</b></div><div class="o-field-v">${valueChips(pf.chip, pf.overrideId)}</div><div class="o-field-a">${rowActions(key, { overrideId: pf.overrideId, source: pf.source, needs: pf.needs }, t)}</div></div>`
        + rowForm(key, t);
    };
    const opWord = co.op === 'below' ? 'below' : 'above'; const back = co.op === 'below' ? 'above' : 'below';
    return UI.page({
      crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: P.name, href: pHref(key) }, { label: 'Triggers', href: pHref(key, 'triggers') }, { label: name }],
      title: name,
      chips: [chip('Task', { tone: 'muted' }), co.templateId ? chip(`Template: ${co.name} v${co.templateVersion || 1} ↗`, { href: tplHref(co.templateId) }) : '', node ? chip(`Subject: ${node.tag}`, { href: nodeHref(key, node.id, up) }) : '', plantChip(key)],
      sub: co.text || '',
      body: card({
        title: 'Do when · done when',
        sub: `A condition Task comes due when ${co.reading || 'its reading'} goes ${opWord} the do-when value, and is done when it is back ${back} the done-when value.`,
        body: row('doWhen', `Do when ${co.reading || 'the reading'} ${opWord}`) + row('doneWhen', `Done when ${back}`) + (co.sensorId ? `<p class="o-hint">${a(sensorHref(key, co.sensorId), 'Open the sensor')}</p>` : ''),
        id: 'c-condition',
      }),
      cls: 'pg-obj pg-trig',
    });
  }

  /* ════ the Equipment Card ════════════════════════════════════════════════════════════════════════════════ */
  function strictestChip(key, s) {
    let best = null;
    arr(s.dirs).forEach((dir) => {
      const z = call('zoneInfo', key, s.id, dir); if (!z) return;
      BANDS.forEach((b) => { const p = z.perBand[b]; if (p && p.value != null && (!best || RANK[b] > RANK[best.b])) best = { b, p, dir, bands: z.bands }; });
    });
    return best;
  }
  function phoneScreen(key, P, node, up) {
    const sensors = arr(call('sensors', key, node.id)).filter((s) => !s.nextPhase);
    const issues = arr(call('issues', key, up ? { upId: node.id } : { eqId: node.id })).filter((i) => i.status !== 'closed');
    const tasks = arr(call('tasks', key, up ? { upId: node.id } : { eqId: node.id }));
    let cta;
    if (issues.length) { const i = issues[0]; cta = `<div class="o-ph-cta tone-${RANK[i.band] >= 3 ? 'bad' : 'warn'}">${sev(i.band)}<h3>${esc(i.title)}</h3><p>Opened ${esc(fmt(i.opened))}</p>${btn('Open the Issue', { href: issueHref(key, i.id), kind: 'primary' })}</div>`; }
    else if (P.state === 'commissioning') cta = `<div class="o-ph-cta"><h3>Commissioning · nothing is sent</h3><p>Nothing reaches this phone until ${esc(P.name)} goes Live.</p></div>`;
    else cta = '<div class="o-ph-cta tone-ok"><h3>All quiet</h3><p>Nothing is open.</p></div>';
    const tiles = sensors.map((s) => {
      const v = s.latest ? num(s.latest.v) : null; const best = s.kind === 'status' || s.kind === 'meter' ? null : strictestChip(key, s);
      const bar = best ? bandBar({ dir: best.dir, bands: best.bands, value: v, valid: Array.isArray(s.valid) ? s.valid : null, unit: s.unit, compact: true }) : '';
      const editF = best ? `zone.${best.dir}.${best.b}` : null;
      return `<li class="o-tile"><div class="o-tile-h"><span>${esc(s.name)}</span><span class="mono muted">${esc(s.tag || '')}</span></div><div class="o-tile-v"><b>${esc(v == null ? 'no reading' : fv(v, s.unit, s.kind))}</b> ${UI.sampleTag()}</div>${bar}${best ? `<div class="o-tile-c">${srcChip(best.p.chip)}</div>` : ''}<div class="o-tile-a">${arr(s.dirs).length ? `${a(sensorHref(key, s.id, editF), 'Edit on sensor')} · ` : ''}${a(sensorHref(key, s.id), 'Open the sensor page')}</div></li>`;
    }).join('');
    const ttiles = tasks.map((t) => {
      const sid = arr(t.scheduleIds)[0] || t.id; const c = call('cadenceOf', key, sid) || {};
      return `<li class="o-tile"><div class="o-tile-h"><span>${a(taskHref(key, t.id), t.name)}</span></div><div class="o-tile-c">${esc(cap(c.everyText || t.everyText || ''))} ${srcChip(c.chip)}</div><div class="o-tile-a">${btn('Change how often', { act: 'obj:cadence', data: { plant: key, schedule: sid }, small: true })}</div></li>`;
    }).join('');
    const tier = node.tierSource || {};
    return `<div class="o-ph-top"><span class="mono">${esc(node.tag)}</span><h2>${esc(node.name)}</h2><p>${esc(up ? (upOf(key, node.id) || {}).typeName || '' : node.typeName || '')} · ${esc(tier.label || '')}</p></div>`
      + cta
      + `<h3 class="o-ph-h">Readings</h3>${tiles ? `<ul class="o-tiles">${tiles}</ul>` : '<p class="muted">No sensor on it in the plant graph.</p>'}`
      + `<h3 class="o-ph-h">Tasks</h3>${ttiles ? `<ul class="o-tiles">${ttiles}</ul>` : '<p class="muted">No Tasks on it.</p>'}`
      + `<div class="o-ph-btns">${btn('Report a problem', { act: 'obj:report', data: { plant: key, id: node.id } })}${btn(up ? 'Open the unit-process page' : 'Open the equipment page', { href: nodeHref(key, node.id, up), kind: 'ghost' })}</div>`;
  }
  function phonePage(params, wantUp) {
    const key = params.plant; const P = plantOf(key); if (!P) return plantMissing(key);
    const node = nodeOf(key, params.id); if (!node) return nodeMissing(key, P);
    const up = isUpId(key, node.id);
    if (up !== !!wantUp) fixHash(`#/p/${enc(key)}/${up ? 'up' : 'eq'}/${enc(node.id)}/phone`);
    const side = `<div class="o-phone-side"><h2>The Equipment Card</h2>`
      + `<p>The same ${up ? 'unit process' : 'equipment'} as an operator carries it: what to do now first, then its readings and Tasks.</p>`
      + `<p>Limits are read-only here. Edit on sensor opens the sensor page, the one place a limit changes. Change how often opens the same cadence form as the Task's Trigger page, in a sheet.</p>`
      + `<p>${btn(up ? 'Open the unit-process page' : 'Open the equipment page', { href: nodeHref(key, node.id, up) })}</p></div>`;
    return UI.page({
      crumbs: crumbsFor(key, node.id).concat([{ label: 'Equipment Card' }]),
      title: H(`<span class="o-tag">${esc(node.tag)}</span> · ${esc(node.name)}`),
      chips: [chip('Equipment Card', { tone: 'muted' }), plantChip(key)],
      sub: 'What an operator sees on a phone.',
      actions: [btn('Full page', { href: nodeHref(key, node.id, up), kind: 'ghost' })],
      body: `<div class="o-phone-lay">${UI.phone(phoneScreen(key, P, node, up), { caption: 'Read-only: every change opens its one editor.' })}${side}</div>`,
      cls: 'pg-obj pg-phone',
    });
  }
  function openCadence(o) {
    o = o || {}; const key = o.plant || o.key;
    let sid = o.scheduleId || o.schedule || null;
    if (!sid && (o.taskId || o.task)) { const t = call('task', key, o.taskId || o.task); sid = t ? arr(t.scheduleIds)[0] || t.id : null; }
    const sc = sid ? scheduleOf(key, sid) : null;
    if (!sc) { UI.toast('That Task has no cadence to change.'); return null; }
    const target = { kind: 'cadence', scheduleId: sid };
    const ls = modFn(LEDGER(), ['openSheet']);
    if (ls) return safe(() => ls(key, target), null);
    const c = call('cadenceOf', key, sid) || {};
    openOverride(key, target);
    const body = `<p class="o-hint">Now ${esc(c.everyText || sc.everyText || '')} ${srcChip(c.chip)}. The same form as the Task's Trigger page.</p>` + fallbackForm(key, target, { inSheet: true });
    return UI.openSheet({ title: `How often · ${sc.name}`, sub: `${sc.eqTag ? sc.eqTag + ' · ' : ''}${plantName(key)}`, body, foot: btn('Close', { act: 'ui:close', data: { what: 'sheet' }, kind: 'ghost' }) });
  }

  /* ════ modals ════════════════════════════════════════════════════════════════════════════════════════════ */
  let MOD = null;
  const q1 = (el, sel) => (el && typeof el.querySelector === 'function' ? el.querySelector(sel) : null);
  const valOf = (sel, fb) => { const e = q1(MOD, sel); return e ? String(e.value || '') : (fb == null ? '' : fb); };
  const TEST = { inputs: {} };   /* tests set field values here: the node stub has no DOM to read */
  const read = (name, sel) => (Object.prototype.hasOwnProperty.call(TEST.inputs, name) ? TEST.inputs[name] : valOf(sel));
  function footer(okLabel, act, data, kind) { return btn('Not yet', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(okLabel, { act, data, kind: kind || 'primary' }); }
  function modalOpen(o) { return UI.modal(Object.assign({}, o, { onBind: (el) => { MOD = el; } })); }

  function openResync(key, id) {
    const rp = call('resyncPreview', key, id);
    if (!rp || rp.ok === false) { UI.toast((rp && rp.error) || 'Resync after the Issue closes.'); return null; }
    const lines = arr(rp.lines).map((l) => `<li>${esc(l)}</li>`).join('');
    return modalOpen({
      title: rp.title || `Resync ${(alertOf(key, id) || {}).name || ''}?`,
      body: `${lines ? `<ul class="o-prev-l">${lines}</ul>` : '<p>Nothing moved: it already follows the sensor.</p>'}${rp.lastDaysText ? `<p class="o-prev">${esc(rp.lastDaysText)} ${UI.sampleTag()}</p>` : ''}`,
      foot: footer('Resync', 'rs:do', { plant: key, alert: id }),
    });
  }
  function openActivate(key, id) {
    const f = modFn(W.V7PLANT, ['openActivate']);
    if (f && safe(() => f(key, id) !== false, false)) return true;
    const pv = call('activatePreview', key, id) || {};
    const body = arr(pv.lines).map((l) => `<p>${esc(l)}</p>`).join('') + (arr(pv.bandLines).length ? `<p><b>${esc(pv.bandsTitle || '')}</b></p><ul class="o-prev-l">${arr(pv.bandLines).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '');
    const ret = pv.live ? btn('Return the plant to Commissioning…', { href: pHref(key), kind: 'ghost' }) : '';
    modalOpen({ title: pv.title || 'Activate?', body, foot: btn('Not yet', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + ret + btn('Activate', { act: 'obj:activateok', data: { plant: key, alert: id }, kind: 'primary' }) });
    return true;
  }
  function openReasonModal(title, intro, act, key, id, okLabel) {
    return modalOpen({ title, body: `<p>${esc(intro)}</p>${UI.field({ label: 'Why', html: '<textarea class="o-why-t" rows="3"></textarea>' })}<p class="field-e o-mod-err" role="alert"></p>`, foot: footer(okLabel, act, { plant: key, alert: id }) });
  }
  function rowAction(kind, key, ovId) {
    const L = LEDGER();
    const generic = modFn(L, ['openAction']);
    if (generic && safe(() => generic(kind, ovId, { plant: key }) !== false, false)) return true;
    const own = modFn(L, ['open' + cap(kind)]);
    if (own && safe(() => own(ovId, { plant: key }) !== false, false)) return true;
    const o = overrideView(ovId); if (!o) { UI.toast('That override could not be found.'); return false; }
    if (kind === 'revert') {
      const rp = call('revertPreview', ovId) || {};
      const allBtn = rp.needsAll && rp.ok !== false ? btn(rp.allButton || 'Revert all', { act: 'obj:revertok', data: { ov: ovId, all: '1' }, kind: 'primary' }) : '';
      modalOpen({
        title: rp.title || 'Revert to the library value?',
        body: `<p>${esc(rp.text || '')}</p>${rp.needsAll ? `<p class="note note-warn">${esc(rp.allText || rp.error || '')}</p>` : ''}${arr(rp.frozen).length ? `<p class="o-hint">${esc(arr(rp.frozen).join(', '))}: frozen while an Issue is open.</p>` : ''}`,
        foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + (rp.needsAll ? allBtn : btn('Revert', { act: 'obj:revertok', data: { ov: ovId }, kind: 'primary' })),
      });
      return true;
    }
    if (kind === 'extend') {
      const temp = o.reason === 'temporary';
      const def = temp ? isoDay(now() + 7 * DAY) : isoDay(now() + (o.reason === 'tuning' || o.reason === 'migrated' ? 90 : 365) * DAY);
      modalOpen({
        title: 'Extend the review',
        body: `<p>${esc(`${o.what}: ${o.valueText} · ${o.reasonLabel}.`)}</p>${UI.field({ label: temp ? 'New expiry (30 days from today at most)' : 'Review by', html: `<input type="date" class="o-ext-d" value="${esc(def)}">` })}${UI.field({ label: 'Note', hint: 'Required.', html: '<textarea class="o-ext-n" rows="2"></textarea>' })}<p class="field-e o-mod-err" role="alert"></p>`,
        foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Extend', { act: 'obj:extendok', data: { ov: ovId, temp: temp ? '1' : '' }, kind: 'primary' }),
      });
      return true;
    }
    /* keep or adopt: the base moved */
    modalOpen({
      title: 'Base moved',
      body: `<p>${esc(o.movedQuestion || '')}</p>${UI.field({ label: 'Note', hint: 'Why keep this value? Required to keep it.', html: '<textarea class="o-keep-n" rows="2"></textarea>' })}<p class="field-e o-mod-err" role="alert"></p>`,
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(o.adoptLabel || 'Adopt the library value', { act: 'obj:adoptok', data: { ov: ovId }, kind: kind === 'adopt' ? 'primary' : 'secondary' }) + btn(o.keepLabel || 'Keep', { act: 'obj:keepok', data: { ov: ovId }, kind: kind === 'keep' ? 'primary' : 'secondary' }),
    });
    return true;
  }
  function modErr(text) { const e = q1(MOD, '.o-mod-err'); if (e) e.textContent = text; UI.toast(text); }
  function openPin(key, tpl, v) {
    const f = modFn(LIB(), ['openPin']);
    if (f && safe(() => f(key, tpl) !== false, false)) return true;
    modalOpen({ title: `Pin this plant to v${v}`, body: UI.field({ label: `Why should this plant stay on v${v}?`, html: '<textarea class="o-pin-r" rows="3"></textarea>' }) + '<p class="field-e o-mod-err" role="alert"></p>', foot: footer('Pin', 'obj:pinok', { plant: key, tpl }) });
    return true;
  }
  function openReport(key, id) {
    const Wk = W.V7WORK; const f = modFn(Wk, ['openReport', 'reportProblem', 'report']);
    if (f && safe(() => { f(key, id); return true; }, false)) return true;
    const ref = { kind: isUpId(key, id) ? 'up' : 'eq', id };
    const types = arr(call('issueTypesFor', key, ref)); const n = nodeOf(key, id) || { tag: id };
    const body = types.length
      ? `<p>What do you see on ${esc(n.tag)}? It opens an Issue with its diagnostic flow.</p>${UI.radios({ name: 'oIssue', options: types.map((t) => ({ value: t.id, label: t.name })) })}`
      : empty(`No Issue types are written for ${n.tag} yet.`);
    modalOpen({ title: `Report a problem · ${n.tag}`, body, foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + (types.length ? btn('Report it', { act: 'obj:reportok', data: { plant: key, id }, kind: 'primary' }) : '') });
    return true;
  }

  /* ════ handlers ══════════════════════════════════════════════════════════════════════════════════════════ */
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null) || null;
  function targetOf(el) { try { return JSON.parse(ga(el, 'target') || 'null'); } catch (e) { return null; } }
  function fixHash(h) { try { if (W.history && W.history.replaceState && W.location && W.location.hash !== h) W.history.replaceState(null, '', h); } catch (e) { /* ignore */ } }

  UI.on('obj:lwopen', (el) => { const k = ga(el, 'k'); if (!k) return false; const [key, sid, dir, b] = k.split('|'); const s = sensorOf(key, sid); if (!s) return false; LW[k] = lwDraft(key, s, dir, b); return undefined; });
  UI.on('obj:lwcancel', (el) => { const k = ga(el, 'k'); if (k) delete LW[k]; return undefined; });
  UI.on('obj:lwset', (el) => {
    const k = ga(el, 'k'); const f = ga(el, 'f'); if (!k || !f) return false; const [key, sid, dir, b] = k.split('|'); const s = sensorOf(key, sid); if (!s) return false;
    const d = LW[k] || lwDraft(key, s, dir, b); d[f] = el.value; LW[k] = d; return undefined;
  });
  UI.on('obj:lwsave', (el) => {
    const k = ga(el, 'k'); const d = LW[k]; if (!k || !d) return false; const [key, sid, dir, b] = k.split('|');
    const r = safe(() => V().setLineWork(key, sid, dir, b, d.does === 'task' ? { name: d.name, filedAt: d.at || null } : { name: null }), null);
    if (!r || !r.ok) { UI.toast((r && r.error) || 'That did not save.'); return false; }
    delete LW[k]; const w = arr(call('lineWork', key, { sensorId: sid, dir })).find((x) => x.band === b);
    UI.toast(w ? `The ${bandName(b)} line now raises "${w.name}" at ${w.filed.text}.` : `The ${bandName(b)} line opens an Issue again.`); return undefined;
  });
  UI.on('obj:ov', (el) => { const t = targetOf(el); const key = ga(el, 'plant'); if (!t || !key) return false; openOverride(key, t); return undefined; });
  UI.on('obj:ovclose', () => { if (OPEN) { const id = fsKey(OPEN.key, OPEN.target); delete FS[id]; } OPEN = null; return undefined; });
  UI.on('obj:ovanyway', (el) => { const st = FS[ga(el, 'fs')]; if (!st) return false; st.anyway = true; st.err = null; return undefined; });
  UI.on('obj:ovvariant', (el) => {
    const st = FS[ga(el, 'fs')]; if (!st) return false;
    const r = call('setOverride', st.key, st.target, valueFromForm(st), { reason: 'structural', trait: st.trait, note: st.note, variantOnly: true });
    if (!r || r.ok === false) { st.err = (r && r.error) || 'Name the trait first.'; return undefined; }
    delete FS[st.id]; OPEN = null; UI.toast(`Variant requested: "${st.trait}". Nothing changes at this plant.`); return undefined;
  });
  UI.on('obj:ovsave', (el) => saveFallback(ga(el, 'fs')));
  UI.on('obj:revert', (el) => { rowAction('revert', ga(el, 'plant'), ga(el, 'ov')); return false; });
  UI.on('obj:extend', (el) => { rowAction('extend', ga(el, 'plant'), ga(el, 'ov')); return false; });
  UI.on('obj:keep', (el) => { rowAction('keep', ga(el, 'plant'), ga(el, 'ov')); return false; });
  UI.on('obj:adopt', (el) => { rowAction('adopt', ga(el, 'plant'), ga(el, 'ov')); return false; });
  UI.on('obj:revertok', (el) => {
    const id = ga(el, 'ov'); const r = ga(el, 'all') ? call('revertAll', id) : call('revert', id, {});
    if (!r || r.ok === false) { modErr((r && r.error) || 'That did not revert.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(r.toast || 'Reverted.'); return undefined;
  });
  UI.on('obj:extendok', (el) => {
    const id = ga(el, 'ov'); const d = fromIso(read('extend.date', '.o-ext-d')); const n = read('extend.note', '.o-ext-n');
    const r = call('extend', id, ga(el, 'temp') ? { expires: d, note: n } : { reviewBy: d, note: n });
    if (!r || r.ok === false) { modErr((r && r.error) || 'That did not extend.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(r.toast || 'Extended.'); return undefined;
  });
  UI.on('obj:keepok', (el) => {
    const r = call('keep', ga(el, 'ov'), { note: read('keep.note', '.o-keep-n') });
    if (!r || r.ok === false) { modErr((r && r.error) || 'Write a note: why keep this value?'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(r.toast || 'Kept.'); return undefined;
  });
  UI.on('obj:adoptok', (el) => {
    const r = call('adopt', ga(el, 'ov'));
    if (!r || r.ok === false) { modErr((r && r.error) || 'That did not change.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(r.toast || 'Adopted.'); return undefined;
  });
  UI.on('obj:activate', (el) => { openActivate(ga(el, 'plant'), ga(el, 'alert')); return false; });
  UI.on('obj:activateok', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'alert');
    const r = call('activate', key, id) || call('setAlertState', key, id, 'active', {});
    if (!r || r.ok === false) { modErr((r && r.error) || 'That did not change.'); return false; }
    UI.closeModal(true); MOD = null; const al = alertOf(key, id);
    UI.toast(r.toast || `${al ? al.name : 'The Trigger'} is ${al && al.phase === 'trial' ? 'active: it records trial firings. Commissioning: nothing is sent.' : 'active.'}`);
    return undefined;
  });
  UI.on('obj:leave', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'alert');
    const f = modFn(W.V7PLANT, ['openLeaveInactive']);
    if (f && safe(() => f(key, id) !== false, false)) return false;
    openReasonModal(`Leave ${(alertOf(key, id) || {}).name || 'it'} inactive?`, 'It stays bound but never fires. Say why it stays inactive; the note is kept.', 'obj:leaveok', key, id, 'Leave inactive');
    return false;
  });
  UI.on('obj:leaveok', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'alert');
    const r = call('leaveInactive', key, id, { reason: read('reason', '.o-why-t') });
    if (!r || r.ok === false) { modErr((r && r.error) || 'Say why it stays inactive.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(r.toast || 'Left inactive.'); return undefined;
  });
  UI.on('obj:inactive', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'alert');
    const f = modFn(W.V7PLANT, ['openSetInactive', 'openLeaveInactive']);
    if (f && safe(() => f(key, id) !== false, false)) return false;
    openReasonModal(`Set ${(alertOf(key, id) || {}).name || 'it'} inactive?`, 'It stops recording trial firings. Say why; the note is kept.', 'obj:inactiveok', key, id, 'Set inactive');
    return false;
  });
  UI.on('obj:inactiveok', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'alert');
    const r = call('setAlertState', key, id, 'inactive', { reason: read('reason', '.o-why-t') });
    if (!r || r.ok === false) { modErr((r && r.error) || 'Say why it stays inactive.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(r.toast || 'Set inactive.'); return undefined;
  });
  UI.on('obj:pin', (el) => { openPin(ga(el, 'plant'), ga(el, 'tpl'), ga(el, 'v') || ''); return false; });
  UI.on('obj:pinok', (el) => {
    const r = call('pin', ga(el, 'plant'), ga(el, 'tpl'), { reason: read('pin.reason', '.o-pin-r') });
    if (!r || r.ok === false) { modErr((r && r.error) || 'Say why this plant should stay on this version.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(r.toast || 'Pinned.'); return undefined;
  });
  UI.on('obj:unpin', (el) => {
    const r = call('unpin', ga(el, 'plant'), ga(el, 'tpl'));
    if (!r || r.ok === false) { UI.toast((r && r.error) || 'That did not unpin.'); return false; }
    UI.toast(r.toast || 'Unpinned.'); return undefined;
  });
  UI.on('obj:flagok', (el) => { const r = call('clearStructureFlag', ga(el, 'plant'), ga(el, 'alert')); UI.toast(r && r.toast ? r.toast : 'Marked as checked.'); return undefined; });
  UI.on('obj:report', (el) => { openReport(ga(el, 'plant'), ga(el, 'id') || ga(el, 'eq')); return false; });
  UI.on('obj:reportok', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id');
    const pick = Object.prototype.hasOwnProperty.call(TEST.inputs, 'issueType') ? TEST.inputs.issueType : (() => { const p = q1(MOD, 'input[name="oIssue"]:checked'); return p ? p.value : ''; })();
    if (!pick) { UI.toast('Pick what you see first.'); return false; }
    const r = call('report', key, { kind: isUpId(key, id) ? 'up' : 'eq', id }, pick);
    if (!r || r.ok === false) { UI.toast((r && r.error) || 'The problem could not be reported.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(`Reported: ${r.issue ? r.issue.title : 'a problem'}. Its diagnostic flow is ready.`);
    if (r.id) UI.go(issueHref(key, r.id));
    return false;
  });
  UI.on('obj:cadence', (el) => { openCadence({ plant: ga(el, 'plant'), scheduleId: ga(el, 'schedule'), taskId: ga(el, 'task') }); return false; });
  UI.on('dp:edit', (el) => {
    const key = ga(el, 'plant') || ga(el, 'key'); const id = ga(el, 'id') || ga(el, 'node') || ga(el, 'node-id') || ga(el, 'eq') || ga(el, 'up') || null;
    const kind = ga(el, 'kind') || (id ? (isUpId(key, id) ? 'up' : 'eq') : 'plant');
    openDesignParam(key, { kind, id: kind === 'plant' ? undefined : id }, ga(el, 'param') || ga(el, 'param-key'));
    return false;
  });
  UI.on('dp:save', () => saveDesignParam());
  UI.on('rs:open', (el) => { openResync(ga(el, 'plant'), ga(el, 'alert')); return false; });
  UI.on('rs:do', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'alert');
    const r = call('resync', key, id);
    if (!r || r.ok === false) { UI.toast((r && r.error) || 'Resync after the Issue closes.'); return false; }
    UI.closeModal(true); MOD = null; UI.toast(r.toast || 'Resynced.'); return undefined;
  });

  /* ════ routes ════════════════════════════════════════════════════════════════════════════════════════════ */
  function eqRoute(params) {
    const key = params.plant; const id = params.id; const tab = params.tab;
    if (OPEN && OPEN.path !== curPath()) OPEN = null;
    if (tab === 'phone' || tab === 'card') return phonePage(params, false);
    if (isUpId(key, id)) { fixHash(`#/p/${enc(key)}/up/${enc(id)}${tab && tab !== 'readings' ? '/' + tab : ''}`); return upPage(key, id, tab, { q: params._q }); }
    return eqPage(key, id, tab, { q: params._q });
  }
  function upRoute(params) {
    const key = params.plant; const id = params.id; const tab = params.tab;
    if (OPEN && OPEN.path !== curPath()) OPEN = null;
    if (tab === 'phone' || tab === 'card') return phonePage(params, true);
    if (plantOf(key) && nodeOf(key, id) && !isUpId(key, id)) { fixHash(`#/p/${enc(key)}/eq/${enc(id)}${tab && tab !== 'readings' ? '/' + tab : ''}`); return eqPage(key, id, tab, { q: params._q }); }
    return upPage(key, id, tab, { q: params._q });
  }
  UI.route('p/:plant/eq/:id/:tab?', eqRoute);
  UI.route('p/:plant/eq/:id/phone', (p) => phonePage(p, false));
  UI.route('p/:plant/eq/:id/card', (p) => phonePage(p, false));
  UI.route('p/:plant/up/:id/:tab?', upRoute);
  UI.route('p/:plant/up/:id/phone', (p) => phonePage(p, true));
  UI.route('p/:plant/sensor/:id', sensorPage);
  UI.route('p/:plant/trigger/:id', triggerPage);
  UI.route('p/:plant/alert/:id', triggerPage);
  /* scroll to the field named by ?f= */
  UI.afterRender(() => {
    bindForms();
    if (typeof document === 'undefined' || !document || typeof document.querySelector !== 'function') return;
    const t = safe(() => document.querySelector('.pg-obj .is-target'), null);
    if (t && typeof t.scrollIntoView === 'function') { try { t.scrollIntoView({ block: 'center' }); } catch (e) { /* ignore */ } }
  });
  if (typeof document !== 'undefined' && document && document.head) UI.addCss('assets/object7.css?v=1');

  W.V7OBJ = {
    render, zonesEditor, designParamsBlock, openDesignParam, openCadence, openOverride, closeOverride, openResync, openReport,
    pages: { eq: eqRoute, up: upRoute, sensor: sensorPage, trigger: triggerPage, phone: phonePage },
    _test: { FS, fsOf, saveFallback, previewHtml, fallbackForm, getOpen: () => OPEN, getDP: () => DP, inputs: TEST.inputs, conditionWorks, saveDesignParam, dpBody },
  };
}());
