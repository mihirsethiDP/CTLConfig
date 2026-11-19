/* v7/7 and v7/8 · ovx78.js — shared pieces for the 19 Nov modules (criticality, severity, calibration).
   1. A dialog or a sheet closes when the page under it changes (the browser's Back, a link behind it).
   2. window.V7OVX — a plant's own timeline or calibration is a deviation like any other: it has a reason, a review date,
      it is listed under Deviations, and "Back to the library value" there sends it back.
        register(kind, { base(key, target) → text, what(key, target) → { what, eqId?, tag?, typeName? }, back(key, target) })
        record(key, target, valueText, baseText, why) · end(key, target, note) · find(key, target)
        whyHtml() · readWhy() → { ok, opts } | { ok: false, error }
   3. window.V7PEND — a library change to a timeline or to calibration waits, like a draft, until it is published.
        stage(kind, args, text) · get(kind, idKey) · list() · discard(id | null) · publish(note)
        kinds register { id(args), check(args) → error | null, apply(args) → { ok }, lands(args) → text }
   4. Shipped examples (alerts across readings, calculated values) are marked as starter content until the library edits them. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };

  /* ── 2 · deviations ─────────────────────────────────────────────────────────────────────────────────────── */
  const kinds = {}; const same = (a, b) => JSON.stringify(a) === JSON.stringify(b); const trim = (x) => (typeof x === 'string' ? x.replace(/.s*$/, '') : x);
  const find = (key, t) => arr(safe(() => V().S.overrides, [])).find((o) => o.plant === key && !o.endedAt && o.target && same(o.target, t)) || null;
  function record(key, t, value, base, why) {
    const X = V()._ov; if (!X) return null; const cur = find(key, t); const opts = why || { reason: 'unrecorded', note: '', reviewBy: null, author: null };
    if (cur) { if (cur.value === trim(value) && !why) return cur; X.end(cur, 'Changed again'); }
    return X.add(key, t, trim(value), trim(base), opts);
  }
  function end(key, t, note) { const X = V()._ov; const cur = find(key, t); if (X && cur) X.end(cur, note || 'Back to the library value'); }
  const isoDay = (ms) => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
  function whyHtml() {
    const now = safe(() => V().now(), Date.now());
    return `<div class="ox-why"><p class="ox-why-h">Why this plant differs from the library</p><div class="ox-why-r"><label><input type="radio" name="ox-reason" value="tuned" checked> Tuned for this plant</label><label><input type="radio" name="ox-reason" value="fornow"> For now, until <input type="date" id="ox-until" min="${isoDay(now + 86400000)}" value="${isoDay(now + 30 * 86400000)}" aria-label="Until which date"></label></div><textarea id="ox-note" rows="2" placeholder="What you saw that makes this plant different" aria-label="A short note"></textarea><p class="ox-why-n">It is listed under Deviations with this reason. A tuned value comes up for review in six months.</p></div>`;
  }
  function readWhy() {
    if (typeof document === 'undefined') return { ok: true, opts: null };
    const r = document.querySelector('input[name="ox-reason"]:checked'); const note = document.getElementById('ox-note'); const until = document.getElementById('ox-until'); if (!r || !note) return { ok: true, opts: null };
    const text = String(note.value || '').trim(); if (!text) return { ok: false, error: 'Write a short note: what you saw that makes this plant different.' };
    if (r.value === 'fornow') { const ms = until && /^\d{4}-\d\d-\d\d$/.test(until.value) ? Date.parse(`${until.value}T06:00:00+05:30`) : NaN; if (!isFinite(ms) || ms <= safe(() => V().now(), Date.now())) return { ok: false, error: 'Pick the date it goes back to the library (after today).' }; return { ok: true, opts: { reason: 'fornow', note: text, until: ms } }; }
    return { ok: true, opts: { reason: 'tuned', note: text } };
  }
  W.V7OVX = { kinds, register: (k, impl) => { kinds[k] = { ...impl, base: (key, t) => trim(impl.base(key, t)) }; }, find, record, end, whyHtml, readWhy };

  /* ── 3 · library changes that wait to be published ─────────────────────────────────────────────────────── */
  const pk = {}; const store = () => { const L = V().S.lib; if (!Array.isArray(L.pending)) L.pending = []; return L.pending; };
  const list = () => store().filter((p) => pk[p.kind]).map((p) => ({ ...p, lands: safe(() => pk[p.kind].lands(p.args), '') }));
  const get = (kind, idKey) => store().find((p) => p.id === `${kind}:${idKey}`) || null;
  function stage(kind, args, text) {
    const K = pk[kind]; if (!K) return { ok: false, error: 'This cannot be staged.' }; const err = K.check(args); if (err) return { ok: false, error: err };
    const id = `${kind}:${K.id(args)}`; const S = store(); const i = S.findIndex((p) => p.id === id); const item = { id, kind, args, text, at: safe(() => V().now(), null) };
    if (K.same && K.same(args)) { if (i >= 0) S.splice(i, 1); if (V().persist) V().persist(); return { ok: true, same: true }; }
    if (i >= 0) S[i] = item; else S.push(item); if (V().persist) V().persist(); return { ok: true };
  }
  function discard(id) { const S = store(); if (id == null) S.length = 0; else { const i = S.findIndex((p) => p.id === id); if (i >= 0) S.splice(i, 1); } if (V().persist) V().persist(); return { ok: true }; }
  function publish(note) {
    const S = store(); if (!S.length) return { ok: false, error: 'Nothing is waiting.' }; if (!String(note || '').trim()) return { ok: false, error: 'Write a change note first: it is kept in Activity.' };
    const done = []; const failed = [];
    S.slice().forEach((p) => { const K = pk[p.kind]; const r = K ? safe(() => K.apply(p.args), { ok: false, error: 'It could not be applied.' }) : { ok: false }; if (r && r.ok) done.push(p); else failed.push({ p, error: (r && r.error) || 'It could not be applied.' }); });
    done.forEach((p) => { const i = S.findIndex((x) => x.id === p.id); if (i >= 0) S.splice(i, 1); });
    if (done.length) V().log(null, `Library: ${done.length} ${done.length === 1 ? 'change' : 'changes'} to timelines and calibration published. ${String(note).trim()}`, 'library');
    if (V().persist) V().persist(); return { ok: !failed.length, count: done.length, error: failed.length ? `${failed.length} could not be published: ${failed[0].error}` : null };
  }
  W.V7PEND = { register: (k, impl) => { pk[k] = impl; }, list, get, stage, discard, publish };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || typeof document === 'undefined' || !W.addEventListener) return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip;
  /* 1 · a dialog closes when the page under it changes */
  const path = () => String(location.hash || '').split('?')[0]; const at = { modal: null, sheet: null };
  ['modal', 'openSheet', 'confirm'].forEach((fn) => { const f0 = U[fn]; if (typeof f0 !== 'function') return; U[fn] = function () { const r = f0.apply(this, arguments); at[fn === 'openSheet' ? 'sheet' : 'modal'] = path(); return r; }; });
  W.addEventListener('hashchange', () => { try { const p = path(); if (at.modal != null && at.modal !== p && document.querySelector('.modal')) { at.modal = null; U.closeModal(true); } if (at.sheet != null && at.sheet !== p && document.querySelector('.sheet') && U.closeSheet) { at.sheet = null; U.closeSheet(true); } } catch (e) { /* the page still works */ } });

  /* 3 · the card on the Library page */
  let NOTE = '';
  function pendCard() {
    const ps = list(); if (!ps.length) return '';
    const rows = ps.map((p) => `<li class="pd-row"><div class="pd-m"><b>${esc(p.text)}</b>${p.lands ? `<span class="pd-l">${esc(p.lands)}</span>` : ''}</div>${btn('Discard', { act: 'pd:discard', data: { id: p.id }, small: true, kind: 'ghost', title: 'Drop this change. The library keeps what it has' })}</li>`).join('');
    return `<section class="card pd-card" id="pd-card"><header class="card-h"><div class="card-hl"><h2 class="card-t">${ps.length} library ${ps.length === 1 ? 'change' : 'changes'} waiting to be published</h2><p class="card-s">Changes to timelines and calibration. No plant sees them until you publish, the same as a type's draft.</p></div><div class="card-a">${chip('Not published', { tone: 'warn' })}</div></header><div class="pd-b"><ul class="pd-rows">${rows}</ul><label class="pd-note"><span>Change note</span><textarea id="pd-note" rows="2" placeholder="What changed and why. Each plant reads it in Activity.">${esc(NOTE)}</textarea></label><div class="pd-f">${ps.length > 1 ? btn('Discard all', { act: 'pd:discard', data: { id: '' }, kind: 'ghost' }) : ''}${btn(`Publish ${ps.length === 1 ? 'the change' : `the ${ps.length} changes`}`, { act: 'pd:publish', kind: 'primary' })}</div></div></section>`;
  }
  W.V7PEND.chip = () => chip('Waiting to publish', { tone: 'warn', title: 'Saved, but no plant has it yet. Publish it from the Library page' });
  W.V7PEND.saved = (r) => (r.same ? 'That is what the library already has, so nothing is waiting.' : 'Saved. It waits with the other library changes until you publish it.');
  document.addEventListener('input', (ev) => { if (ev.target && ev.target.id === 'pd-note') NOTE = ev.target.value; }, true);
  U.on('pd:discard', (el) => { const id = el.getAttribute('data-id'); discard(id || null); U.toast(id ? 'Dropped. The library keeps what it has.' : 'All of them dropped.'); return undefined; });
  U.on('pd:publish', () => { const n = document.getElementById('pd-note'); const r = publish(n ? n.value : NOTE); if (r.count) NOTE = ''; U.toast(r.ok ? `Published ${r.count} ${r.count === 1 ? 'change' : 'changes'}. Plants that follow the library have ${r.count === 1 ? 'it' : 'them'} now.` : r.error); return r.count ? undefined : false; });

  if (U.afterRender) U.afterRender((main, p0) => {
    try {
      if (!main) return; const p = String(p0 || location.hash).replace(/^#?\/?/, '').split('?')[0];
      if (p === 'library') setTimeout(() => { try { if (main.querySelector('#pd-card')) return; const html = pendCard(); const body = main.querySelector('.pg-main'); if (html && body) body.insertAdjacentHTML('afterbegin', html); } catch (e) { /* the page still shows without it */ } }, 0);
      /* 4 · shipped examples are starter content */
      if (p === 'library' || /^library\/[^/]+(\/(readings|overview))?$/.test(p)) {
        const L = V().S.lib; const mark = (box, shipped) => { if (!box || !shipped || box.querySelector('.ox-starter')) return; const h = box.querySelector('header .ov-n') || box.querySelector('header h3'); if (h) h.insertAdjacentHTML('afterend', `<span class="ox-starter">${chip('Starter examples', { tone: 'muted', title: 'Shipped as examples. Not reviewed with operations yet' })}</span>`); };
        Array.prototype.slice.call(main.querySelectorAll('.ua-box')).forEach((box) => { if (!box.querySelector('.ua-row, li')) return; const isDyn = box.classList.contains('dy-box'); const code = box.getAttribute('data-code') || (/^library\/([^/]+)/.exec(p) || [])[1] || (/control group/i.test(box.textContent.slice(0, 80)) ? '@group' : /the plant|calculated/i.test(box.textContent.slice(0, 80)) ? null : null);
          const key = code ? decodeURIComponent(code) : (box.closest('.dy-lv') && /control group/i.test(box.closest('.dy-lv').textContent.slice(0, 40)) ? '@group' : box.closest('.dy-lv') ? '@plant' : null); if (!key) return;
          mark(box, isDyn ? !(L.dyn && L.dyn[key]) : !(L.upAlerts && L.upAlerts[key])); });
      }
    } catch (e) { /* the page still shows without it */ }
  });
})();
