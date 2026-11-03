/* v7/2 · ledger7.js · window.V7LEDGER — the override form (the one editor of a plant value), the Deviations pages and the
   override modals.
   Loads after ui7.js (window.V7UI), plant7.js (window.V7PLANT, for the plant frame) and the ledger in window.V7. Reads V7
   lazily and defensively: every call goes through safe(), so a missing core function degrades a page instead of blanking it.
   Every number and every sentence about a value comes from the ledger and the library (overridePreview, physicalPath,
   reasonsFor, overrideDefaults, deviations, the decorated records); this file only lays them out.

   ROUTES
     #/deviations[?show=&reason=&plant=&template=&eq=]          every plant's deviations, grouped by library field
     #/p/:plant/deviations[?show=&reason=&template=&eq=]        one plant's, inside V7PLANT.frame(key, 'deviations', body)
     #/differences, #/p/:plant/differences                      v7/1's links: the same pages
     show = overrides (default) · basemoved · pastreview · suspended · triggerlimit · pinned · singleuse · structure · history

   API (window.V7LEDGER)
     overrideForm(key, target, {inSheet, inModal}) → html   the form for one value; calling it opens it. Targets: zone {sensorId,
                                                   dir, band} · triggerLimit {alertId, band} · persistence|clearing {alertId} ·
                                                   enabled {alertId|scheduleId} · cadence|runhours {scheduleId} · condition
                                                   {workId, which} · tier {eqId}
     fieldActions(key, target, {sheet}) → html    the field row's buttons by state (Override · Edit/Revert/Extend · Keep/Adopt ·
                                                   Set/Add parameter · Open the sensor/Override for this Trigger only · the
                                                   disabled "Override · frozen" / "Resync first"); empty while the form is open
     formFor(key, target, opts) → html            the form while it is open, else ''   (render it under the field row)
     isOpen(key, target) · open(key, target, opts) · close(key, target) · openSheet(key, target) (the form in a sheet)
     onClose(fn)                                  fn({key, target, saved}) after a save or a cancel
     deviationsBody(key|null, query, baseHref) → html · deviationsPage(params) · plantDeviationsPage(params)
     modals: revertModal(id) · extendModal(id) · movedModal(id, 'keep'|'adopt') · promoteModal(id) · mergeModal(suId) ·
             openAction('revert'|'extend'|'keep'|'adopt'|'promote', id) → true when it opened one (also openRevert(id) …)
   ACTIONS (data-act; the shell persists and re-renders after each unless the handler returns false)
     ov:open · ov:sheet (data-plant, data-target) · ov:value · ov:reason · ov:note · ov:date · ov:trait (data-fk) · ov:anyway ·
     ov:variant · ov:cancel · ov:save
     dev:revert · dev:extend · dev:keep · dev:adopt · dev:promote (data-id) · dev:variant (data-group) · dev:keep-single ·
     dev:merge (data-id) · dev:unpin (data-plant, data-template) · dev:filter (a select) · dev:m-* (the open modal's fields
     and buttons) */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const U = W.V7UI;
  if (!U) { if (W.console) console.warn('ledger7.js needs ui7.js (window.V7UI) loaded first'); return; }
  const V = () => W.V7 || null;
  const { esc, chip, btn, link, page, section, card, empty, note, plural } = U;

  /* ── small helpers ─────────────────────────────────────────────────────────────────────────────────────── */
  function soft(e) { try { if (Array.isArray(U._soft)) { U._soft.push('ledger7: ' + String(e && e.message || e)); if (U._soft.length > 200) U._soft.shift(); } } catch (x) { /* ignore */ } }
  function safe(fn, fb) { try { const v = fn(); return v === undefined || v === null ? fb : v; } catch (e) { soft(e); return fb; } }
  function call(name, ...args) { const v = V(); return v && typeof v[name] === 'function' ? safe(() => v[name](...args), null) : null; }
  const has = (name) => { const v = V(); return !!v && typeof v[name] === 'function'; };
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = encodeURIComponent;
  const DAY = 86400000;
  const BANDS = ['caution', 'minor', 'major', 'emergency'];
  const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const UNITS = ['hour', 'day', 'week', 'month', 'year'];
  const TRIGGER_OWN = ['triggerLimit', 'persistence', 'clearing'];
  function now() { return safe(() => V().now(), null) || Date.UTC(2026, 9, 29, 3, 30); }
  /* 'YYYY-MM-DD' in IST, as date inputs want it (the core reads such a date as 06:00 IST) */
  function dateIn(ms) { return ms == null ? '' : new Date(+ms + 330 * 60000).toISOString().slice(0, 10); }
  const dget = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);
  function qs(o) { const s = Object.keys(o).filter((k) => o[k] != null && o[k] !== '').map((k) => `${k}=${enc(o[k])}`).join('&'); return s ? '?' + s : ''; }
  function plantsList() { return arr(call('plants')); }
  function plantOf(key) { return plantsList().find((p) => p.key === key) || null; }
  function plantName(key) { const p = plantOf(key); return p ? p.name : String(key || ''); }
  function labels(kind) { const v = V(); return (v && v.LABELS && v.LABELS[kind]) || {}; }
  const LED = () => { const v = V(); return (v && v.LEDGER) || {}; };
  function reasonLabel(r) { return labels('reason')[r] || r; }
  /* a chip object ({text, tone, sub, small, extra}) as html: the pill, then its muted sub line and its small line */
  function chipHtml(c, o) {
    if (!c || !c.text) return '';
    if (typeof U.chipHtml === 'function' && !o) { const h = safe(() => U.chipHtml(c), ''); if (h) return h; }
    const extra = arr(c.extra).map((x) => (x && x.text ? ' ' + chip(x.text, { tone: x.tone }) : '')).join('');
    const sub = c.sub && !(o && o.noSub) ? `<span class="lg-sub">${esc(c.sub)}</span>` : '';
    const small = c.small && !(o && o.noSmall) ? `<span class="lg-small">${esc(c.small)}</span>` : '';
    return `<span class="lg-chip">${chip(c.text, { tone: c.tone })}${extra}${sub}${small}</span>`;
  }

  try { U.addCss('assets/ledger7.css?v=1'); } catch (e) { /* no DOM */ }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     TARGETS
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const KIND_V2 = { limit: 'zone', hold: 'persistence', clear: 'clearing', onoff: 'enabled' };
  function normT(t0) {
    if (!t0 || typeof t0 !== 'object') return null;
    const kind = KIND_V2[t0.kind] || t0.kind; const t = { kind };
    if (kind === 'zone') { if (!t0.sensorId || !BANDS.includes(t0.band)) return null; t.sensorId = t0.sensorId; t.dir = t0.dir || null; t.band = t0.band; }
    else if (kind === 'triggerLimit') { if (!t0.alertId || !BANDS.includes(t0.band)) return null; t.alertId = t0.alertId; t.band = t0.band; if (t0.dir) t.dir = t0.dir; }
    else if (kind === 'persistence' || kind === 'clearing') { if (!t0.alertId) return null; t.alertId = t0.alertId; }
    else if (kind === 'enabled') { if (t0.alertId) t.alertId = t0.alertId; else if (t0.scheduleId) t.scheduleId = t0.scheduleId; else return null; }
    else if (kind === 'cadence' || kind === 'runhours') { if (!t0.scheduleId) return null; t.scheduleId = t0.scheduleId; }
    else if (kind === 'condition') { if (!t0.workId || (t0.which !== 'doWhen' && t0.which !== 'doneWhen')) return null; t.workId = t0.workId; t.which = t0.which; }
    else if (kind === 'tier') { if (!t0.eqId) return null; t.eqId = t0.eqId; }
    else return null;
    return t;
  }
  function sameT(a0, b0) {
    const a = normT(a0); const b = normT(b0); if (!a || !b || a.kind !== b.kind) return false;
    if (a.kind === 'zone') return a.sensorId === b.sensorId && a.band === b.band && (!a.dir || !b.dir || a.dir === b.dir);
    if (a.kind === 'triggerLimit') return a.alertId === b.alertId && a.band === b.band;
    if (a.kind === 'condition') return a.workId === b.workId && a.which === b.which;
    if (a.kind === 'tier') return a.eqId === b.eqId;
    if (a.kind === 'enabled') return (!!a.alertId && a.alertId === b.alertId) || (!!a.scheduleId && a.scheduleId === b.scheduleId);
    if (a.kind === 'cadence' || a.kind === 'runhours') return a.scheduleId === b.scheduleId;
    return a.alertId === b.alertId;
  }
  /* one stable key per plant value: what the form's state and its element are known by */
  function fkOf(key, t) {
    const id = t.sensorId || t.alertId || t.scheduleId || t.workId || t.eqId || '';
    return `${key}~${t.kind}~${id}~${t.kind === 'zone' ? t.dir || '' : ''}~${t.band || t.which || ''}`.replace(/[^A-Za-z0-9_~-]/g, '_');
  }
  /* a zone named without its direction takes the sensor's main one, so one value always has one key */
  function resolveT(key, t0) {
    const t = normT(t0); if (!t) return null;
    if (t.kind === 'zone' && !t.dir) { const zi = call('zoneInfo', key, t.sensorId); if (zi && zi.dir) t.dir = zi.dir; }
    return t;
  }
  const tAttr = (t) => JSON.stringify(t);
  function tFrom(el, key) { try { return resolveT(key, JSON.parse(dget(el, 'target') || 'null')); } catch (e) { return null; } }

  /* the override in force on a value (suspended ones included), as the ledger decorates it */
  function recFor(key, t) {
    const list = arr(call('overrides', { plant: key, state: 'all' }));
    return list.find((o) => o && o.status === 'active' && o.target && sameT(o.target, t)) || null;
  }

  /* ── what a value is now, its base and its words (the library's resolvers; the ledger's own reader when it has one) ── */
  function fieldInfo(key, t) {
    const v = V();
    if (v && typeof v.overrideField === 'function') { const r = safe(() => v.overrideField(key, t), null); if (r && r.ok !== false) return Object.assign({ rec: recFor(key, t) }, r); }
    const out = { ok: true, kind: t.kind, unit: '', value: null, base: null, baseText: 'no rule', baseWord: 'library', gap: false, needs: null, source: null, chip: null, rec: recFor(key, t), what: '', frozen: false, waiting: false, nextPhase: false, templateId: null };
    const held = (alertId) => { const h = call('heldOf', key, alertId) || {}; out.frozen = !!h.frozen; out.waiting = !!h.waiting; };
    const trig = (alertId) => call('triggerName', key, alertId) || alertId;
    if (t.kind === 'zone') {
      const zi = call('zoneInfo', key, t.sensorId, t.dir); if (!zi) return { ok: false };
      const pb = (zi.perBand || {})[t.band] || {};
      Object.assign(out, { unit: zi.unit || '', value: pb.value != null ? pb.value : null, base: pb.resolved != null ? pb.resolved : null, source: pb.source || null, chip: pb.chip || null, needs: pb.needs || null, nextPhase: !!zi.nextPhase, templateId: zi.templateId || null, tag: zi.tag, sensorKind: zi.kind, followers: arr(zi.triggers) });
      out.gap = out.base == null; out.baseText = out.gap ? 'no rule' : pb.resolvedText || String(out.base);
      out.baseWord = pb.rule && pb.rule.kind === 'expr' ? 'derived' : 'library';
      out.what = `${zi.tag || t.sensorId} · ${BAND_LABEL[t.band]} zone`;
    } else if (t.kind === 'triggerLimit') {
      const tb = call('triggerBands', key, t.alertId); if (!tb) return { ok: false };
      const bb = (tb.bands || {})[t.band] || {};
      Object.assign(out, { unit: tb.unit || '', value: bb.value != null ? bb.value : bb.zoneNow, base: bb.zoneNow != null ? bb.zoneNow : null, baseText: bb.zoneNowText || 'no value', baseWord: 'sensor', chip: bb.chip || null, sensorHref: bb.href || null, frozen: !!tb.frozen, waiting: !!tb.waiting });
      if (out.rec) out.value = out.rec.value;
      out.what = `${trig(t.alertId)} · ${BAND_LABEL[t.band]} band`;
    } else if (t.kind === 'persistence' || t.kind === 'clearing') {
      const ti = call('timingOf', key, t.alertId, t.kind === 'persistence' ? 'hold' : 'clear'); if (!ti) return { ok: false };
      Object.assign(out, { unit: 'min', value: ti.value != null ? ti.value : null, base: ti.resolved != null ? ti.resolved : null, chip: ti.chip || null, source: ti.source || null, templateId: ti.templateId || null });
      out.gap = out.base == null; out.baseText = out.gap ? 'no value' : `${out.base} min`; held(t.alertId);
      out.what = `${trig(t.alertId)} · ${t.kind}`;
    } else if (t.kind === 'cadence') {
      const ci = call('cadenceOf', key, t.scheduleId); if (!ci) return { ok: false };
      Object.assign(out, { value: ci.value || null, base: ci.resolved || null, chip: ci.chip || null, source: ci.source || null, templateId: ci.templateId || null });
      out.gap = !out.base; out.baseText = out.base ? (call('everyText', out.base) || `every ${out.base.n} ${out.base.unit}`) : 'no value';
      out.baseWord = ci.source === 'derived' || ci.baseFrom === 'form' ? 'derived' : 'library';
      out.what = `${schedName(key, t.scheduleId)} · cadence`;
    } else if (t.kind === 'runhours') {
      const ri = call('sourceOf', key, t); if (!ri) return { ok: false };
      Object.assign(out, { unit: 'run-hours', value: ri.value != null ? ri.value : null, base: ri.libValue != null ? ri.libValue : null });
      out.gap = out.base == null; out.baseText = out.gap ? 'no value' : `every ${out.base} run-hours`;
      out.what = `${schedName(key, t.scheduleId)} · run-hours`;
    } else if (t.kind === 'condition') {
      const co = call('conditionOf', key, t.workId); if (!co) return { ok: false };
      const pf = (co.perField || {})[t.which] || {};
      Object.assign(out, { unit: co.unit || '', value: pf.value != null ? pf.value : null, base: pf.resolved != null ? pf.resolved : null, chip: pf.chip || null, source: pf.src || pf.source || null, needs: pf.needs || null, templateId: co.templateId || null });
      out.gap = out.base == null; out.baseText = out.gap ? 'no rule' : pf.resolvedText || String(out.base);
      out.baseWord = (pf.rule && pf.rule.kind === 'expr') || pf.baseSource === 'derived' ? 'derived' : 'library';
      out.what = `${co.name}${co.tag ? ` on ${co.tag}` : ''} · ${t.which === 'doWhen' ? 'do when' : 'done when'}`;
    } else if (t.kind === 'tier') {
      const ti = call('tierInfo', key, t.eqId); if (!ti) return { ok: false };
      Object.assign(out, { value: ti.value || null, base: ti.base || null, chip: ti.chip && typeof ti.chip === 'object' ? ti.chip : null, source: ti.src || null });
      out.gap = !out.base; out.baseText = out.base || 'no value'; out.baseWord = ti.baseSource === 'derived' ? 'derived' : 'library';
      const e = call('eq', key, t.eqId); out.what = `${(e && e.tag) || t.eqId} · criticality tier`;
    } else if (t.kind === 'enabled') {
      const on = t.alertId ? call('alertState', key, t.alertId) !== 'inactive' : (arr(call('schedules', key)).find((s) => s.id === t.scheduleId) || {}).status !== 'off';
      Object.assign(out, { value: on, base: true, baseText: 'On' });
      out.what = `${t.alertId ? trig(t.alertId) : schedName(key, t.scheduleId)} · enabled`;
    } else return { ok: false };
    if (out.rec && out.rec.what) out.what = out.rec.what;
    return out;
  }
  function schedName(key, id) { const s = arr(call('schedules', key)).find((x) => x.id === id); return s ? `${s.name}${s.eqTag ? ` on ${s.eqTag}` : ''}` : id; }
  /* the template a value comes from (zone, Trigger, Task), for a variant request when the ledger has nothing to log it on */
  function ownerOf(key, t, inf) {
    let tid = inf && inf.templateId;
    if (!tid && t.alertId) { const tp = call('templateOf', key, t.alertId); tid = tp ? tp.id : null; }
    const tp = tid ? call('template', tid) : null; const o = tp && tp.owner; if (!o) return null;
    const code = o.code || o.id || null; const kind = o.kind || 'eqType';
    return { ownerCode: code, typeKey: kind === 'upType' ? `up:${code}` : kind === 'plantType' ? `plant:${code}` : `eq:${code}`, ownerName: o.typeName || o.name || code };
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     THE OVERRIDE FORM
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const FORMS = {};                       // fk → the open form's state
  const CLOSERS = [];
  function stateOf(fk) { return FORMS[fk] || null; }
  function inputKind(t) { return t.kind === 'cadence' ? 'cadence' : t.kind === 'tier' ? 'tier' : t.kind === 'enabled' ? 'enabled' : t.kind === 'persistence' || t.kind === 'clearing' || t.kind === 'runhours' ? 'whole' : 'number'; }
  function newState(key, t, o) {
    const inf = fieldInfo(key, t); const ik = inputKind(t);
    const st = { key, t, fk: fkOf(key, t), mode: o && o.inSheet ? 'sheet' : o && o.inModal ? 'modal' : 'inline', reason: '', note: '', reviewBy: '', expires: '', trait: '', anyway: false, err: null, field: null, unit: 'week', raw: '' };
    const v = inf.ok ? inf.value : null;
    if (ik === 'cadence') { st.raw = v && v.n != null ? String(v.n) : ''; st.unit = v && v.unit ? v.unit : 'week'; }
    else if (ik === 'enabled') st.raw = v === false ? 'on' : 'off';
    else if (ik === 'tier') st.raw = v || 'B';
    else st.raw = v == null || Number.isNaN(+v) ? '' : String(v);
    return st;
  }
  function open(key, t0, o) {
    const t = resolveT(key, t0); if (!t) return null; const fk = fkOf(key, t);
    if (!FORMS[fk]) FORMS[fk] = newState(key, t, o); else if (o && (o.inSheet || o.inModal)) FORMS[fk].mode = o.inSheet ? 'sheet' : 'modal';
    return FORMS[fk];
  }
  function isOpen(key, t0) { const t = resolveT(key, t0); return !!t && !!FORMS[fkOf(key, t)]; }
  function close(key, t0, saved) {
    const t = resolveT(key, t0); if (!t) return; const fk = fkOf(key, t); const st = FORMS[fk]; delete FORMS[fk];
    if (st) CLOSERS.forEach((fn) => { try { fn({ key, target: t, saved: !!saved }); } catch (e) { soft(e); } });
    /* a page that keeps its own open row (the object pages) closes it too, so Cancel and Save end the row there as well */
    if (st && st.mode === 'inline') { const O = W.V7OBJ; if (O && typeof O.closeOverride === 'function') safe(() => O.closeOverride(), null); }
    try { if (W.dispatchEvent && typeof W.CustomEvent === 'function') W.dispatchEvent(new W.CustomEvent('v7ledger:close', { detail: { key, target: t, saved: !!saved } })); } catch (e) { /* ignore */ }
  }
  function onClose(fn) { if (typeof fn === 'function') CLOSERS.push(fn); }

  function valueOf(st) {
    const ik = inputKind(st.t); const raw = String(st.raw == null ? '' : st.raw).trim();
    if (ik === 'cadence') return { n: raw === '' ? NaN : Math.round(+raw), unit: st.unit };
    if (ik === 'tier') return raw;
    if (ik === 'enabled') return raw === 'on';
    if (raw === '') return null;
    return Number.isFinite(+raw) ? +raw : NaN;
  }
  function valueOk(st) {
    const v = valueOf(st); const ik = inputKind(st.t);
    if (ik === 'cadence') return Number.isFinite(v.n) && v.n >= 1;
    if (ik === 'tier' || ik === 'enabled') return true;
    if (v === null) return st.t.kind === 'zone' || st.t.kind === 'triggerLimit';
    return Number.isFinite(v);
  }

  /* the value input row: "[value] {unit} · library {base}" */
  function inputRow(st, inf) {
    const ik = inputKind(st.t); const id = `ovf-${st.fk}`; const d = `data-fk="${esc(st.fk)}"`;
    let input;
    if (ik === 'cadence') {
      input = `<span class="ovf-k">Every</span><input type="number" min="1" step="1" inputmode="numeric" id="${id}-v" data-act="ov:value" data-live ${d} data-part="n" value="${esc(st.raw)}" aria-label="How many">`
        + `<select id="${id}-u" data-act="ov:value" ${d} data-part="unit" aria-label="Unit">${UNITS.map((u) => `<option value="${u}"${st.unit === u ? ' selected' : ''}>${u}s</option>`).join('')}</select>`;
    } else if (ik === 'tier') {
      input = `<select id="${id}-v" data-act="ov:value" ${d} aria-label="Criticality tier">${['A', 'B', 'C'].map((x) => `<option value="${x}"${st.raw === x ? ' selected' : ''}>Criticality tier ${x}</option>`).join('')}</select>`;
    } else if (ik === 'enabled') {
      input = `<select id="${id}-v" data-act="ov:value" ${d} aria-label="Enabled">${[['on', 'On'], ['off', 'Off']].map(([k, l]) => `<option value="${k}"${st.raw === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    } else {
      const whole = ik === 'whole';
      input = `<input type="number" ${whole ? 'min="0" step="1" inputmode="numeric"' : 'step="any" inputmode="decimal"'} id="${id}-v" data-act="ov:value" data-live ${d} value="${esc(st.raw)}" placeholder="${st.t.kind === 'zone' || st.t.kind === 'triggerLimit' ? 'No value' : ''}" aria-label="Value">`
        + (inf.unit ? `<span class="ovf-u">${esc(inf.unit)}</span>` : '');
    }
    const base = st.t.kind === 'enabled' ? '' : inf.gap && inf.baseWord !== 'sensor' ? '· no rule' : `· ${inf.baseWord} ${inf.baseText}`;
    return `<div class="ovf-in">${input}${base ? `<span class="ovf-base">${esc(base)}</span>` : ''}</div>`;
  }
  function reasonsBlock(st) {
    const offered = arr(call('reasonsFor', st.key, st.t)); const list = offered.length ? offered : arr(LED().REASONS);
    const lab = labels('reasonOption');
    const opts = list.map((r) => ({ value: r, label: lab[r] || reasonLabel(r) }));
    return `<div class="ovf-why"><h4 class="ovf-h">Why does this plant differ?</h4>${U.radios({ name: `ovr-${st.fk}`, value: st.reason, options: opts, act: 'ov:reason', data: { fk: st.fk } })}</div>`;
  }
  /* the chosen reason's own path; returns {html, rest} where rest says whether the note, dates and Save show yet */
  function pathBlock(st, inf) {
    const r = st.reason; const d = { fk: st.fk };
    if (r === 'physical') {
      const pp = call('physicalPath', st.key, st.t) || { kind: 'none', text: '' };
      if (st.anyway) return { html: '', rest: true };
      const acts = (pp.kind === 'param' && pp.href ? btn(pp.primary || 'Set the design parameter', { href: pp.href, kind: 'primary', small: true }) : '') + btn(pp.secondary || 'Override anyway', { act: 'ov:anyway', data: d, small: true });
      return { html: `<div class="ovf-path"><p>${esc(pp.text || '')}</p><div class="ovf-pa">${acts}</div></div>`, rest: false };
    }
    if (r === 'structural') {
      if (st.anyway) return { html: `<div class="ovf-path ovf-path-q">${traitField(st)}</div>`, rest: true };
      return { html: `<div class="ovf-path"><p>Request a library variant for this trait?</p>${traitField(st)}<div class="ovf-pa">${btn('Request a variant', { act: 'ov:variant', data: d, kind: 'primary', small: true })}${btn('Override for now', { act: 'ov:anyway', data: d, small: true })}</div></div>`, rest: false };
    }
    if (r === 'regulatory' && st.t.kind === 'zone') return { html: `<div class="ovf-path ovf-path-q"><p>Record the consent limit as a design parameter. ${link('Add design parameter', `#/p/${enc(st.key)}/details`)}</p></div>`, rest: true };
    return { html: '', rest: !!r };
  }
  function traitField(st) {
    return U.field({ label: 'Trait', html: `<input type="text" id="ovf-${esc(st.fk)}-t" data-act="ov:trait" data-live data-fk="${esc(st.fk)}" value="${esc(st.trait)}" placeholder="For example: low-load design">` });
  }
  function noteDates(st) {
    const d = `data-fk="${esc(st.fk)}"`; const tl = st.t.kind === 'triggerLimit';
    const noteHtml = U.field({ label: 'Note', hint: tl ? 'Required.' : 'Required for Tuning and Regulatory or client.', html: `<textarea id="ovf-${esc(st.fk)}-n" rows="3" data-act="ov:note" data-live ${d}>${esc(st.note)}</textarea>` });
    const def = call('overrideDefaults', st.reason) || {};
    if (st.reason === 'temporary') {
      const max = def.expiresMax != null ? def.expiresMax : now() + 30 * DAY;
      return noteHtml + U.field({ label: 'Expires on', html: `<input type="date" id="ovf-${esc(st.fk)}-x" data-act="ov:date" data-live data-which="expires" ${d} min="${esc(dateIn(now() + DAY))}" max="${esc(dateIn(max))}" value="${esc(st.expires)}">` });
    }
    const rb = st.reviewBy || dateIn(def.reviewBy);
    return noteHtml + U.field({ label: 'Review by', hint: 'Defaults: Tuning 90 days, others 1 year.', html: `<input type="date" id="ovf-${esc(st.fk)}-r" data-act="ov:date" data-live data-which="reviewBy" ${d} min="${esc(dateIn(now() + DAY))}" value="${esc(rb)}">` });
  }
  /* "If you save": the ledger's own lines for this value (Trigger names, the replay or trial count, frozen Triggers) */
  function previewInner(st) {
    if (!valueOk(st)) return '<h4 class="ovf-h">If you save</h4>';
    const p = call('overridePreview', st.key, st.t, valueOf(st));
    if (!p || p.ok === false) return '<h4 class="ovf-h">If you save</h4>';
    const lines = arr(p.lines).map((l) => `<p>${esc(l)}</p>`).join('');
    const frozen = arr(p.frozenLines).map((f) => `<p class="ovf-fz">${esc(f.text)}${f.href ? ` ${link(f.linkText || 'Close it as a false alarm', f.href)}` : ''}</p>`).join('');
    const tag = p.mode ? ` ${U.sampleTag()}` : '';
    return `<h4 class="ovf-h">If you save${tag}</h4>${lines}${frozen}`;
  }
  function formHtml(st) {
    const inf = fieldInfo(st.key, st.t);
    if (!inf.ok) return `<div class="ovf" data-ovf="${esc(st.fk)}">${note('This value could not be found.', 'warn')}</div>`;
    const path = pathBlock(st, inf); const rest = path.rest && st.reason;
    const cancel = btn('Cancel', { act: 'ov:cancel', data: { fk: st.fk }, kind: 'ghost' });
    const save = !st.reason || rest ? btn('Save override', { act: 'ov:save', data: { fk: st.fk }, kind: 'primary' }) : '';
    const err = `<p class="field-e ovf-err" role="alert">${st.err ? esc(st.err) : ''}</p>`;
    return `<div class="ovf${st.mode !== 'inline' ? ' ovf-boxed' : ''}" data-ovf="${esc(st.fk)}" id="ovf-${esc(st.fk)}" role="group" aria-label="${esc(`Override ${inf.what}`)}">`
      + inputRow(st, inf) + reasonsBlock(st) + path.html + (rest ? noteDates(st) : '')
      + `<div class="ovf-prev" aria-live="polite">${previewInner(st)}</div>${err}<div class="ovf-a">${cancel}${save}</div></div>`;
  }
  function overrideForm(key, t0, o) {
    const t = resolveT(key, t0); if (!t) return '';
    const st = open(key, t, o); return st ? formHtml(st) : '';
  }
  function formFor(key, t0, o) { const t = resolveT(key, t0); if (!t) return ''; const st = FORMS[fkOf(key, t)]; if (!st) return ''; if (o && (o.inSheet || o.inModal)) st.mode = o.inSheet ? 'sheet' : 'modal'; return formHtml(st); }
  function openSheet(key, t0) {
    const t = resolveT(key, t0); if (!t) return null; const st = open(key, t, { inSheet: true }); if (!st) return null;
    const inf = fieldInfo(key, t);
    return U.openSheet({ title: inf.what || 'Override', sub: plantName(key), body: formHtml(st), onClose: () => { delete FORMS[st.fk]; } });
  }

  /* repaint one open form where it sits (page, sheet or modal) without redrawing the page */
  let prevTimer = null;
  function formEl(fk) { try { return typeof document !== 'undefined' && document.querySelector ? document.querySelector(`[data-ovf="${fk}"]`) : null; } catch (e) { return null; } }
  function repaint(st, focusSel) {
    const el = formEl(st.fk); if (!el) return false;
    try { el.outerHTML = formHtml(st); } catch (e) { soft(e); return false; }
    if (focusSel) { try { const f = document.querySelector(`[data-ovf="${st.fk}"] ${focusSel}`); if (f && f.focus) f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    return true;
  }
  function repaintPreview(st) {
    const run = () => { const el = formEl(st.fk); const box = el && el.querySelector ? el.querySelector('.ovf-prev') : null; if (box) box.innerHTML = previewInner(st); };
    if (formEl(st.fk) && typeof setTimeout === 'function') { clearTimeout(prevTimer); prevTimer = setTimeout(run, 140); }
  }
  function closeContainer(st) { if (st.mode === 'sheet') U.closeSheet(true); else if (st.mode === 'modal') U.closeModal(true); }
  function savedToast(id) {
    const r = call('overrideById', id); if (!r) return '';
    const word = r.baseSource === 'derived' ? 'derived' : r.baseSource === 'sensor' ? 'sensor' : 'library';
    const bt = r.kind === 'triggerLimit' ? r.currentBaseText : r.baseText;
    const base = !bt || bt === 'no rule' || r.baseSource === 'gap' ? `${word}: no rule` : `${word} ${bt}`;
    const tail = r.reason === 'temporary' ? `${r.reasonLabel} · expires ${r.expiresText}` : `${r.reasonLabel} · review by ${r.reviewByText}`;
    return `Override saved: ${r.what} ${r.valueText} (${base}) · ${tail}.`;
  }
  function variantToast(req) { return req ? `Variant requested for ${req.ownerName}: "${req.trait}". Nothing changes at this plant.` : ''; }

  const FS = (el) => stateOf(dget(el, 'fk'));
  U.on('ov:open', (el) => {
    const key = dget(el, 'plant'); const t = tFrom(el, key); if (!key || !t) return false;
    if (dget(el, 'sheet') === '1') { openSheet(key, t); return false; }
    open(key, t); return undefined;
  });
  U.on('ov:sheet', (el) => { const key = dget(el, 'plant'); const t = tFrom(el, key); if (key && t) openSheet(key, t); return false; });
  U.on('ov:value', (el) => {
    const st = FS(el); if (!st) return false;
    if (dget(el, 'part') === 'unit') st.unit = String(el.value || 'week'); else st.raw = String(el.value == null ? '' : el.value);
    st.err = null; repaintPreview(st); return false;
  });
  U.on('ov:reason', (el) => {
    const st = FS(el); if (!st) return false;
    const r = String(el.value || ''); if (r !== st.reason) { st.reason = r; st.anyway = false; st.err = null; }
    repaint(st, 'input[type="radio"]:checked'); return false;
  });
  U.on('ov:note', (el) => { const st = FS(el); if (st) st.note = String(el.value || ''); return false; });
  U.on('ov:trait', (el) => { const st = FS(el); if (st) st.trait = String(el.value || ''); return false; });
  U.on('ov:date', (el) => { const st = FS(el); if (!st) return false; const w = dget(el, 'which'); if (w === 'expires') st.expires = String(el.value || ''); else st.reviewBy = String(el.value || ''); return false; });
  U.on('ov:anyway', (el) => { const st = FS(el); if (!st) return false; st.anyway = true; st.err = null; repaint(st, 'textarea'); return false; });
  U.on('ov:cancel', (el) => { const st = FS(el); if (!st) return false; closeContainer(st); close(st.key, st.t, false); return undefined; });
  U.on('ov:variant', (el) => {
    const st = FS(el); if (!st) return false;
    const r = call('setOverride', st.key, st.t, valueOf(st), { reason: 'structural', trait: st.trait, note: st.note, variantOnly: true }) || { ok: false, error: 'That did not work.' };
    let req = null;
    if (r.ok && r.variantRequestId) req = arr(call('variantRequests')).find((x) => x.id === r.variantRequestId) || null;
    else if (r.ok) {
      /* the value equals the library's: the ledger logs nothing, so the request goes straight to the library */
      const inf = fieldInfo(st.key, st.t); const ow = ownerOf(st.key, st.t, inf);
      const rv = call('requestVariant', Object.assign({ plant: st.key, trait: st.trait, note: st.note, fromOverride: null, fromText: inf.what }, ow || {})) || { ok: false };
      if (!rv.ok) { st.err = rv.error || 'That did not work.'; repaint(st); return false; }
      req = rv.request || null; if (rv.toast) { closeContainer(st); close(st.key, st.t, false); U.toast(rv.toast); return undefined; }
    } else { st.err = r.error || 'That did not work.'; repaint(st); return false; }
    closeContainer(st); close(st.key, st.t, false); U.toast(variantToast(req)); return undefined;
  });
  U.on('ov:save', (el) => {
    const st = FS(el); if (!st) return false;
    const def = call('overrideDefaults', st.reason) || {};
    const opts = { reason: st.reason || null, note: st.note, trait: st.reason === 'structural' ? st.trait : undefined };
    if (st.reason === 'temporary') opts.expires = st.expires || null;
    else if (st.reviewBy && st.reviewBy !== dateIn(def.reviewBy)) opts.reviewBy = st.reviewBy;
    const r = call('setOverride', st.key, st.t, valueOf(st), opts) || { ok: false, error: 'That did not save.' };
    if (!r.ok) { st.err = r.error || 'That did not save.'; st.field = r.field || null; repaint(st); return false; }
    closeContainer(st); close(st.key, st.t, true);
    if (r.ended) { const rec = call('overrideById', r.id); U.toast(rec ? `Set ${rec.what} back to the library value ${rec.currentBaseText}.` : 'Saved.'); return undefined; }
    if (!r.id) { U.toast('Nothing changed.'); return undefined; }
    let msg = savedToast(r.id);
    if (r.variantRequestId) { const req = arr(call('variantRequests')).find((x) => x.id === r.variantRequestId); if (req) msg += ` ${variantToast(req)}`; }
    U.toast(msg || 'Saved.'); return undefined;
  });

  /* ── the field row before the form opens: its buttons by state ──────────────────────────────────────────── */
  function openBtn(key, t, label, o) { return btn(label, { act: 'ov:open', data: { plant: key, target: tAttr(t), sheet: o && o.sheet ? '1' : null }, kind: o && o.kind, small: true }); }
  function devBtn(id, label, act, o) { return btn(label, { act: `dev:${act}`, data: { id }, kind: o && o.primary ? 'primary' : 'secondary', small: true, disabled: o && o.disabled, title: o && o.title }); }
  function fieldActions(key, t0, o) {
    const t = resolveT(key, t0); if (!t) return '';
    if (isOpen(key, t) && !(o && o.sheet)) return '';
    const inf = fieldInfo(key, t); if (!inf.ok || inf.nextPhase) return '';
    const own = TRIGGER_OWN.includes(t.kind);
    const lock = own && inf.frozen ? 'Override · frozen' : own && inf.waiting ? 'Resync first' : null;
    const wrap = (html) => (html ? `<span class="lg-acts">${html}</span>` : '');
    const rec = inf.rec;
    if (lock) return wrap(btn(lock, { disabled: true, small: true, title: lock === 'Resync first' ? 'Resync this Trigger first: it is still on the terms it was frozen on.' : 'This Trigger is frozen while its Issue is open.' }) + (t.kind === 'triggerLimit' && inf.sensorHref && !rec ? ' ' + link('Open the sensor', inf.sensorHref) : ''));
    if (rec) {
      if (rec.state === 'suspended') return '';
      if (rec.state === 'basemoved') return wrap(devBtn(rec.id, 'Keep', 'keep') + devBtn(rec.id, 'Adopt the library value', 'adopt', { primary: true }));
      return wrap(openBtn(key, t, 'Edit', o) + devBtn(rec.id, 'Revert', 'revert') + devBtn(rec.id, 'Extend', 'extend', { primary: rec.state === 'pastreview' }));
    }
    if (t.kind === 'triggerLimit') return wrap((inf.sensorHref ? link('Open the sensor', inf.sensorHref) + ' ' : '') + openBtn(key, t, 'Override for this Trigger only', o));
    if (inf.source === 'forced') return '';
    if (inf.source === 'pinned') { const f = arr(inf.followers)[0]; return f ? wrap(link('Unpin', `#/p/${enc(key)}/trigger/${enc(f.alertId)}`)) : ''; }
    if (inf.gap) {
      const pp = inf.needs ? call('physicalPath', key, t) : null;
      return wrap((pp && pp.kind === 'param' && pp.href ? btn('Add parameter', { href: pp.href, kind: 'primary', small: true }) : '') + openBtn(key, t, 'Set', o));
    }
    let extra = '';
    if (inf.baseWord === 'derived' && t.kind === 'zone') { const pp = call('physicalPath', key, t); if (pp && pp.kind === 'param' && pp.href) extra = ' ' + link('Edit the design parameter', pp.href); }
    return wrap(openBtn(key, t, 'Override', o) + extra);
  }

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     MODALS (Revert · Extend · Base moved · Promote · Request a library variant · Merge)
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  let MS = null;                          // the open modal's state
  const cancelBtn = () => btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' });
  const okBtn = (label, what, o) => btn(label, { act: 'dev:m-ok', data: { what, id: o && o.id }, kind: (o && o.kind) || 'primary' });
  const errLine = () => `<p class="field-e" role="alert">${MS && MS.err ? esc(MS.err) : ''}</p>`;
  const rec = (id) => call('overrideById', id);
  function showModal(o) { return U.modal(Object.assign({ wide: false }, o, { body: `<div class="dvm">${o.body || ''}</div>` })); }
  function frozenLinesFor(r) {
    if (!r || !r.target) return '';
    const p = call('overridePreview', r.plant, r.target, r.currentBase);
    return arr(p && p.frozenLines).map((f) => `<p class="ovf-fz">${esc(f.text)}${f.href ? ` ${link(f.linkText || 'Close it as a false alarm', f.href)}` : ''}</p>`).join('');
  }
  function revertModal(id) {
    const r = rec(id); const pv = call('revertPreview', id); if (!r || !pv) { U.toast('This override has already ended.'); return null; }
    if (!MS || MS.id !== id || MS.kind !== 'revert') MS = { kind: 'revert', id, err: null };
    let body = `<p>${esc(pv.text)}</p>`; let foot = cancelBtn();
    if (pv.needsAll) { body += `<p class="dvm-warn">${esc(pv.allText || pv.error || '')}</p>`; if (pv.ok !== false) foot += okBtn(pv.allButton || 'Revert all', 'revert-all', { id }); }
    else foot += okBtn('Revert', 'revert', { id });
    body += frozenLinesFor(r);
    return showModal({ title: pv.title, sub: r.what, body: body + errLine(), foot });
  }
  function extendModal(id) {
    const r = rec(id); if (!r || r.status !== 'active') { U.toast('This override has already ended.'); return null; }
    const temp = r.reason === 'temporary'; const days = (LED().REVIEW_DAYS || {})[r.reason] || 365;
    if (!MS || MS.id !== id || MS.kind !== 'extend') MS = { kind: 'extend', id, err: null, note: '', date: temp ? dateIn((call('overrideDefaults', 'temporary') || {}).expiresMax) : dateIn(now() + days * DAY), dateDefault: true };
    const dateField = temp
      ? U.field({ label: 'New expiry (30 days from today at most)', html: `<input type="date" data-act="dev:m-date" data-live min="${esc(dateIn(now() + DAY))}" max="${esc(dateIn((call('overrideDefaults', 'temporary') || {}).expiresMax))}" value="${esc(MS.date)}">` })
      : U.field({ label: 'Review by', html: `<input type="date" data-act="dev:m-date" data-live min="${esc(dateIn(now() + DAY))}" value="${esc(MS.date)}">` });
    const body = `<p>${esc(`${r.what}: ${r.valueText} · ${r.reasonLabel}.`)}</p>${dateField}${U.field({ label: 'Note', hint: 'Required.', html: `<textarea rows="3" data-act="dev:m-note" data-live>${esc(MS.note)}</textarea>` })}${errLine()}`;
    return showModal({ title: 'Extend the review', sub: plantName(r.plant), body, foot: cancelBtn() + okBtn('Extend', 'extend', { id }) });
  }
  function movedModal(id, how) {
    const r = rec(id); if (!r || r.state !== 'basemoved') { U.toast('The library value has not moved for this override.'); return null; }
    if (!MS || MS.id !== id || MS.kind !== 'moved') MS = { kind: 'moved', id, err: null, note: '', how: how || 'adopt' };
    const body = `<p>${esc(r.movedQuestion || '')}</p>${U.field({ label: 'Note', hint: 'Why keep this value?', html: `<textarea rows="3" data-act="dev:m-note" data-live>${esc(MS.note)}</textarea>` })}${errLine()}`;
    return showModal({ title: 'Base moved', sub: r.what, body, foot: cancelBtn() + okBtn(r.adoptLabel || 'Adopt the library value', 'adopt', { id, kind: MS.how === 'adopt' ? 'primary' : 'secondary' }) + okBtn(r.keepLabel || 'Keep', 'keep', { id, kind: MS.how === 'keep' ? 'primary' : 'secondary' }) });
  }
  function promoteModal(id) {
    const r = rec(id); if (!r || r.status !== 'active') { U.toast('This override has already ended.'); return null; }
    const pa = arr(r.actions).find((a) => a.id === 'promote'); if (!pa) { U.toast('This override is not promoted.'); return null; }
    const variantOnly = !!pa.variantOnly;
    if (!MS || MS.id !== id || MS.kind !== 'promote') MS = { kind: 'promote', id, err: null, as: variantOnly ? 'variant' : 'default', trait: '', note: '' };
    const owner = r.templateName || r.ownerName || 'the library';
    const opts = [];
    if (!variantOnly) opts.push({ value: 'default', label: 'Make it the library default', sub: `Opens ${owner} in the library with ${r.valueText} filled in. Downstream shows every plant it reaches before you publish.` });
    opts.push({ value: 'variant', label: 'Make it a variant by trait', sub: `Logs a variant request on ${r.ownerName || owner}; nothing changes until someone builds it.` });
    const why = variantOnly ? (safe(() => V().promote(id, { as: 'default' }), {}) || {}).error : null;
    const trait = MS.as === 'variant' ? U.field({ label: 'Trait', html: `<input type="text" data-act="dev:m-trait" data-live value="${esc(MS.trait)}" placeholder="For example: low-load design">` }) + U.field({ label: 'Note', html: `<textarea rows="2" data-act="dev:m-note" data-live>${esc(MS.note)}</textarea>` }) : '';
    const body = `<p>${esc(r.promoteText || '')}</p>${why ? `<p class="dvm-quiet">${esc(why)}</p>` : ''}${U.radios({ name: 'dvm-as', value: MS.as, options: opts, act: 'dev:m-as' })}${trait}${errLine()}`;
    return showModal({ title: 'Promote this override?', sub: plantName(r.plant), body, foot: cancelBtn() + okBtn('Continue', 'promote', { id }) });
  }
  function variantModal(groupKey, scope) {
    const d = call('deviations', scope ? { plant: scope } : {}) || {}; const g = arr(d.groups).find((x) => x.key === groupKey);
    if (!g || !g.variant) { U.toast('No two plants share this value now.'); return null; }
    if (!MS || MS.kind !== 'variant' || MS.group !== groupKey) MS = { kind: 'variant', group: groupKey, scope, err: null, trait: '', note: '' };
    const what = [g.templateName, g.fieldLabel].filter(Boolean).join(' · ');
    const body = `<p>${esc(`${g.variant.plants} plants override ${what} to ${g.variant.valueText}. Name the trait they share.`)}</p>`
      + U.field({ label: 'Trait', html: `<input type="text" data-act="dev:m-trait" data-live value="${esc(MS.trait)}" placeholder="For example: low-load design">` })
      + U.field({ label: 'Note', html: `<textarea rows="2" data-act="dev:m-note" data-live>${esc(MS.note)}</textarea>` }) + errLine();
    return showModal({ title: 'Request a library variant', sub: g.ownerName || '', body, foot: cancelBtn() + okBtn('Request', 'variant') });
  }
  function mergeModal(suId) {
    const su = arr(call('singleUse', {})).find((x) => x.id === suId); if (!su) { U.toast('That single-use template is gone.'); return null; }
    MS = { kind: 'merge', id: suId, err: null };
    return showModal({ title: su.mergeTitle, sub: su.plantName, body: `<p>${esc(su.mergeBody)}</p>${errLine()}`, foot: cancelBtn() + okBtn('Open the library', 'merge', { id: suId }) });
  }
  function reopen() {
    if (!MS) return;
    if (MS.kind === 'revert') revertModal(MS.id); else if (MS.kind === 'extend') extendModal(MS.id); else if (MS.kind === 'moved') movedModal(MS.id, MS.how);
    else if (MS.kind === 'promote') promoteModal(MS.id); else if (MS.kind === 'variant') variantModal(MS.group, MS.scope); else if (MS.kind === 'merge') mergeModal(MS.id);
  }
  function done(toastText) { MS = null; U.closeModal(true); if (toastText) U.toast(toastText); return undefined; }
  function fail(r) { if (MS) MS.err = (r && r.error) || 'That did not work.'; reopen(); return false; }

  /* the object pages' row buttons open these same modals: openAction('revert'|'extend'|'keep'|'adopt'|'promote', id) */
  function openAction(kind, id) {
    MS = null;
    if (kind === 'revert') revertModal(id); else if (kind === 'extend') extendModal(id); else if (kind === 'keep' || kind === 'adopt') movedModal(id, kind);
    else if (kind === 'promote') promoteModal(id); else return false;
    return true;
  }
  U.on('dev:revert', (el) => { MS = null; revertModal(dget(el, 'id')); return false; });
  U.on('dev:extend', (el) => { MS = null; extendModal(dget(el, 'id')); return false; });
  U.on('dev:keep', (el) => { MS = null; movedModal(dget(el, 'id'), 'keep'); return false; });
  U.on('dev:adopt', (el) => { MS = null; movedModal(dget(el, 'id'), 'adopt'); return false; });
  U.on('dev:promote', (el) => { MS = null; promoteModal(dget(el, 'id')); return false; });
  U.on('dev:variant', (el) => { MS = null; variantModal(dget(el, 'group'), dget(el, 'scope') || null); return false; });
  U.on('dev:merge', (el) => { MS = null; mergeModal(dget(el, 'id')); return false; });
  U.on('dev:keep-single', (el) => { const r = call('keepSingleUse', dget(el, 'id')) || {}; U.toast(r.ok ? r.toast : r.error || 'That did not work.'); return undefined; });
  U.on('dev:unpin', (el) => { const r = call('unpin', dget(el, 'plant'), dget(el, 'template')) || {}; U.toast(r.ok ? r.toast || '' : r.error || 'That did not work.'); return undefined; });
  U.on('dev:m-note', (el) => { if (MS) MS.note = String(el.value || ''); return false; });
  U.on('dev:m-trait', (el) => { if (MS) MS.trait = String(el.value || ''); return false; });
  U.on('dev:m-date', (el) => { if (MS) { MS.date = String(el.value || ''); MS.dateDefault = false; } return false; });
  U.on('dev:m-as', (el) => { if (MS) { MS.as = String(el.value || 'default'); MS.err = null; reopen(); } return false; });
  U.on('dev:m-ok', (el) => {
    if (!MS) { U.closeModal(true); return false; }
    const what = dget(el, 'what'); const id = MS.id; let r;
    if (what === 'revert') { r = call('revert', id, {}) || {}; return r.ok ? done(r.toast) : fail(r); }
    if (what === 'revert-all') { const o = rec(id); r = call('revertAll', id) || {}; return r.ok ? done(o ? `Reverted every overridden band on ${String(o.what || '').split(' · ')[0]}.` : '') : fail(r); }
    if (what === 'extend') {
      const o = rec(id); const opts = { note: MS.note };
      if (!MS.dateDefault || (o && o.reason === 'temporary')) { if (o && o.reason === 'temporary') opts.expires = MS.date; else opts.reviewBy = MS.date; }
      r = call('extend', id, opts) || {}; return r.ok ? done(r.toast) : fail(r);
    }
    if (what === 'adopt') { r = call('adopt', id) || {}; return r.ok ? done(r.toast) : fail(r); }
    if (what === 'keep') { r = call('keep', id, { note: MS.note }) || {}; return r.ok ? done(r.toast) : fail(r); }
    if (what === 'promote') {
      if (MS.as === 'variant') { r = call('promote', id, { as: 'variant', trait: MS.trait, note: MS.note }) || {}; if (!r.ok) return fail(r); const req = arr(call('variantRequests')).find((x) => x.id === r.requestId); return done(variantToast(req)); }
      r = call('promote', id, { as: 'default' }) || {}; if (!r.ok || !r.href) return fail(r);
      MS = null; U.closeModal(true); U.go(r.href); return false;
    }
    if (what === 'variant') {
      const d = call('deviations', MS.scope ? { plant: MS.scope } : {}) || {}; const g = arr(d.groups).find((x) => x.key === MS.group);
      if (!g) return fail({ error: 'No two plants share this value now.' });
      r = call('requestVariant', { plant: MS.scope || null, ownerCode: g.ownerCode, typeKey: g.typeKey, ownerName: g.ownerName, trait: MS.trait, note: MS.note, fromOverride: null, fromText: `${[g.templateName, g.fieldLabel].filter(Boolean).join(' · ')} ${g.variant ? g.variant.valueText : ''}`.trim() }) || {};
      return r.ok ? done(r.toast) : fail(r);
    }
    if (what === 'merge') { r = call('mergeSingleUse', id) || {}; if (!r.ok || !r.href) return fail(r); MS = null; U.closeModal(true); U.go(r.href); return false; }
    U.closeModal(true); return false;
  });

  /* ════════════════════════════════════════════════════════════════════════════════════════════════════════
     DEVIATIONS  #/deviations  and  #/p/:plant/deviations
     ════════════════════════════════════════════════════════════════════════════════════════════════════════ */
  const SHOWS = ['overrides', 'basemoved', 'pastreview', 'suspended', 'triggerlimit', 'pinned', 'singleuse', 'structure', 'history'];
  const ROW_SHOWS = ['overrides', 'basemoved', 'pastreview', 'suspended'];
  function countChips(c, show, base, q) {
    const href = (s) => base + qs(Object.assign({}, q, { show: s === 'overrides' ? null : s }));
    const item = (s, label, tone) => `<a class="dv-c${tone ? ' dv-c-' + tone : ''}${show === s ? ' on' : ''}" href="${esc(href(s))}"${show === s ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
    const parts = [
      item('overrides', plural(c.overrides || 0, 'override')),
      item('basemoved', `${c.basemoved || 0} base moved`, 'moved'),
      item('pastreview', `${c.pastreview || 0} past review`, 'review'),
      item('triggerlimit', plural(c.triggerlimit || 0, 'Trigger limit override')),
      item('pinned', `${c.pinned || 0} pinned`),
      item('singleuse', plural(c.singleuse || 0, 'single-use template')),
    ];
    if (c.suspended) parts.push(item('suspended', `${c.suspended} suspended`, 'susp'));
    parts.push(item('structure', plural(c.structure || 0, 'structure change')));
    return `<nav class="dv-cs" aria-label="Deviations">${parts.join('')}${item('history', `History · ${c.history || 0}`, 'quiet')}</nav>`;
  }
  function filterRow(d, scope, base, q) {
    const sel = (param, anyLabel, opts) => `<select class="dv-sel" data-act="dev:filter" data-param="${param}" data-base="${esc(base)}" data-q="${esc(JSON.stringify(q))}" aria-label="${esc(anyLabel.replace(/: any$/, ''))}"><option value="">${esc(anyLabel)}</option>${opts.map((o) => `<option value="${esc(o.key)}"${String(q[param] || '') === String(o.key) ? ' selected' : ''}>${esc(`${o.label || o.name || o.key} (${o.count || 0})`)}</option>`).join('')}</select>`;
    const reasons = arr(d.reasons).filter((r) => r.count || q.reason === r.key || r.key !== 'migrated');
    const parts = [sel('reason', 'Reason: any', reasons)];
    if (!scope) parts.push(sel('plant', 'Plant: any', arr(d.plants)));
    parts.push(sel('template', 'Template: any', arr(d.templates)));
    return `<div class="dv-f">${parts.join('')}</div>`;
  }
  function actionsHtml(r) {
    if (r.status !== 'active') return '';
    if (r.state === 'suspended') return `<span class="lg-sub">${esc((r.chip && r.chip.sub) || '')}</span>`;
    return `<span class="lg-acts">${arr(r.actions).map((a) => devBtn(r.id, a.label, a.id, { primary: a.primary })).join('')}</span>`;
  }
  function stateChipHtml(r) {
    const sc = r.stateChip; return sc && sc.text ? ' ' + chip(sc.text, { tone: sc.tone }) : '';
  }
  function rowTr(r, scope) {
    const first = scope
      ? `<a href="${esc(r.href || '#')}">${esc(r.what)}</a>${stateChipHtml(r)}`
      : `<a href="${esc(r.href || '#')}">${esc(r.plantName)}</a>${stateChipHtml(r)}<span class="lg-sub">${esc(r.what)}</span>`;
    const why = `${esc(r.reasonNote)}${r.migratedLine ? `<span class="lg-sub">${esc(r.migratedLine)}</span>` : ''}${r.historyLine ? `<span class="lg-sub">${esc(r.historyLine)}</span>` : ''}`;
    const cls = r.state === 'basemoved' ? 'dv-moved' : r.state === 'pastreview' ? 'dv-review' : r.state === 'suspended' ? 'dv-susp' : r.status !== 'active' ? 'dv-ended' : '';
    return `<tr${cls ? ` class="${cls}"` : ''} data-ov="${esc(r.id)}"><td data-label="${scope ? 'What' : 'Plant'}">${first}</td><td data-label="Value · base" class="dv-v">${esc(r.valueBase)}</td><td data-label="Reason · note">${why}</td><td data-label="Age" class="dv-age">${esc(r.ageText)}</td><td data-label="" class="dv-act">${actionsHtml(r)}</td></tr>`;
  }
  function rowsTable(rows, scope) {
    return `<div class="t-wrap"><table class="t t-stack dv-t"><thead><tr><th>${scope ? 'What' : 'Plant'}</th><th>Value · base</th><th>Reason · note</th><th>Age</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map((r) => rowTr(r, scope)).join('')}</tbody></table></div>`;
  }
  function groupHtml(g, scope) {
    const vline = g.variant ? `<div class="dv-var"><p>${esc(g.variant.text)}</p>${btn(g.variant.button || 'Request a library variant', { act: 'dev:variant', data: { group: g.key, scope: scope || null }, small: true })}</div>` : '';
    return `<section class="dv-g${g.hasBaseMoved ? ' dv-g-moved' : ''}"><h3 class="dv-gh">${esc(g.header)}</h3>${rowsTable(arr(g.rows), scope)}${vline}</section>`;
  }
  function sectionBlock(title, sub, inner, id) { return `<section class="dv-sec"${id ? ` id="${id}"` : ''}><div class="dv-sh"><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${inner}</section>`; }
  function triggerLimitSec(d, scope) { return sectionBlock('Trigger limit overrides', 'Each one is a candidate for a library variant.', rowsTable(arr(d.triggerLimit), scope), 'dv-tl'); }
  function pinnedSec(d) {
    const list = arr(d.pinned);
    const inner = list.length ? `<ul class="dv-l">${list.map((p) => `<li><span>${esc(p.text)}</span><span class="lg-acts">${btn('Unpin', { act: 'dev:unpin', data: { plant: p.plant, template: p.templateId }, small: true })}</span></li>`).join('')}</ul>` : empty('No plant is pinned.');
    return sectionBlock('Pinned', '', inner, 'dv-pin');
  }
  function singleUseSec(d) {
    const list = arr(d.singleUse);
    const inner = `<ul class="dv-l">${list.map((s) => `<li><div class="dv-li"><span>${esc(s.text)}</span>${s.chip ? `<span class="dv-chips">${chipHtml(s.chip)}</span>` : ''}${s.keptText ? `<span class="lg-sub">${esc(s.keptText)}</span>` : ''}</div><span class="lg-acts">${s.keptAt ? '' : btn('Keep single-use', { act: 'dev:keep-single', data: { id: s.id }, small: true })}${btn(s.mergeLabel, { act: 'dev:merge', data: { id: s.id }, small: true })}</span></li>`).join('')}</ul>`;
    return sectionBlock('Single-use templates', 'A need at one plant becomes a library template used at that plant only. Keep it single-use, or merge it into the library for every plant of its type.', inner, 'dv-su');
  }
  function structureSec(d, scope) {
    const list = arr(d.structure);
    const inner = `<ul class="dv-l">${list.map((s) => {
      const sc = s.stateChip && s.stateChip.text ? ' ' + chip(s.stateChip.text, { tone: s.stateChip.tone }) : ['reverted', 'expired', 'promoted', 'cleared'].includes(s.state) ? ' ' + chip(s.stateLabel, { tone: 'lib' }) : '';
      const bits = [s.stateText, s.note ? `"${s.note}"` : '', s.authorText, s.ageText].filter(Boolean);
      return `<li data-ov="${esc(s.id)}"><div class="dv-li"><span class="dv-st">${scope ? '' : `${esc(s.plantName)} · `}<a href="${esc(s.href || '#')}">${esc(s.label)}</a>${sc}</span><span class="lg-sub">${esc(bits.join(' · '))}</span></div><span class="lg-acts">${s.href ? btn(arr(s.actions)[0] ? s.actions[0].label : 'Open on the structure page', { href: s.href, small: true }) : ''}</span></li>`;
    }).join('')}</ul>`;
    return sectionBlock('Structure changes', 'Membership and type changes from the structure pass and the drawing. Each keeps its note.', inner, 'dv-struct');
  }
  function historySec(d, scope) { return sectionBlock('History', 'Reverted, expired, promoted and cleared overrides. Each keeps its note.', rowsTable(arr(d.history), scope), 'dv-hist'); }

  function deviationsBody(key, query, baseHref) {
    const q0 = query || {}; const show = SHOWS.includes(q0.show) ? q0.show : 'overrides';
    const base = baseHref || (key ? `#/p/${enc(key)}/deviations` : '#/deviations');
    const q = {}; ['reason', 'plant', 'template', 'eq'].forEach((k) => { if (q0[k]) q[k] = q0[k]; }); if (key) delete q.plant;
    const opts = { show }; if (key) opts.plant = key; if (q.plant) opts.plantFilter = q.plant; if (q.reason) opts.reason = q.reason; if (q.template) opts.template = q.template; if (q.eq) opts.eqId = q.eq;
    const d = call('deviations', opts); if (!d) return empty('Deviations are not available in this build.');
    const scoped = key ? null : q.plant || null;
    const c = d.counts || {};
    const head = countChips(c, show, base, Object.assign({}, q)) + filterRow(d, key, base, Object.assign({}, q, show !== 'overrides' ? { show } : {}));
    const showAll = btn('Show all', { href: base, small: true });
    let only = '';
    if (q.eq) { const e = call('eq', key || q.plant || '', q.eq); only = `<p class="dv-only">${esc(`Only ${(e && e.tag) || q.eq}`)} · ${link('Show all', base + qs(Object.assign({}, q, { eq: null, show: show === 'overrides' ? null : show })))}</p>`; }
    if (d.empty && !Object.keys(q).length) return `<div class="dv">${head}${empty(d.empty)}</div>`;
    const filtered = !!(q.reason || q.template || q.eq || q.plant);
    let body = '';
    if (ROW_SHOWS.includes(show)) {
      const groups = arr(d.groups);
      body += groups.map((g) => groupHtml(g, key)).join('');
      if (show === 'overrides') {
        if (arr(d.triggerLimit).length) body += triggerLimitSec(d, key);
        if (!filtered) {
          if (arr(d.singleUse).length) body += singleUseSec(d);
          if (arr(d.pinned).length) body += pinnedSec(d);
          if (arr(d.structure).length) body += structureSec(d, key);
        }
      }
      if (!body) body = empty(d.filtered || 'Nothing here with this filter.', showAll);
    } else if (show === 'triggerlimit') body = arr(d.triggerLimit).length ? triggerLimitSec(d, key) : empty('Nothing here with this filter.', showAll);
    else if (show === 'pinned') body = pinnedSec(d);
    else if (show === 'singleuse') body = arr(d.singleUse).length && !q.reason ? singleUseSec(d) : empty('Nothing here with this filter.', showAll);
    else if (show === 'structure') body = arr(d.structure).length && !q.reason ? structureSec(d, key) : empty('Nothing here with this filter.', showAll);
    else if (show === 'history') body = arr(d.history).length ? historySec(d, key) : empty('Nothing here with this filter.', showAll);
    return `<div class="dv">${head}${only}${body}</div>`;
  }
  function deviationsPage(params) {
    const q = (params && params._q) || {}; const d = call('deviations', {}) || {};
    return page({ crumbs: [{ label: 'Deviations · All Plants' }], title: 'Deviations', sub: d.sub || '', body: deviationsBody(null, q, '#/deviations'), cls: 'pg-dev' });
  }
  function plantDeviationsPage(params) {
    const key = params && params.plant; const p = plantOf(key);
    if (!p) return page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', body: empty('This plant is not in the prototype.', btn('All Plants', { href: '#/plants' })) });
    const d = call('deviations', { plant: key }) || {};
    const body = section('Deviations', deviationsBody(key, (params && params._q) || {}, `#/p/${enc(key)}/deviations`), { sub: d.sub || '' });
    const P = W.V7PLANT;
    if (P && typeof P.frame === 'function') { const out = safe(() => P.frame(key, 'deviations', body, { cls: 'pg-dev' }), null); if (out) return String(out); }
    return page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name }], title: p.name, chips: [chip(p.type || '', { mono: true })], body, cls: 'pg-dev' });
  }
  U.on('dev:filter', (el) => {
    const param = dget(el, 'param'); const base = dget(el, 'base') || '#/deviations'; let q = {};
    try { q = JSON.parse(dget(el, 'q') || '{}') || {}; } catch (e) { q = {}; }
    const v = String(el.value || ''); if (v) q[param] = v; else delete q[param];
    U.go(base + qs(q)); return false;
  });

  U.route('deviations', deviationsPage);
  U.route('p/:plant/deviations', plantDeviationsPage);
  /* v7/1's links keep working: the same pages under the old names */
  U.route('differences', deviationsPage);
  U.route('p/:plant/differences', plantDeviationsPage);

  W.V7LEDGER = {
    overrideForm, fieldActions, formFor, isOpen, open, close, openSheet, onClose, fieldInfo,
    deviationsBody, deviationsPage, plantDeviationsPage,
    revertModal, extendModal, movedModal, promoteModal, variantModal, mergeModal, openAction,
    openRevert: (id) => openAction('revert', id), openExtend: (id) => openAction('extend', id), openKeep: (id) => openAction('keep', id),
    openAdopt: (id) => openAction('adopt', id), openPromote: (id) => openAction('promote', id),
    _forms: FORMS, _modal: () => MS, _fk: fkOf,
  };
}());
