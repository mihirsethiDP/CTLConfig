/* v7/7 and v7/8 · crit78.js — criticality, and what it sets.
   Three labels sit side by side and none is worked out from another:
     a unit process has a criticality · a piece of equipment has a criticality · an issue has a severity.
   Criticality sets one thing: when a task or a check that is due and not done is reminded, and who is told next.
   That timeline is set once per criticality in the library, and a plant may keep its own.

   window.V7CRIT:
     lib(tier) → { remind, repeat, lead, senior }   hours after the task was due
     setLib(tier, vals)
     plant(key, tier) → { remind, repeat, lead, senior, own }      setPlant(key, tier, vals | null)
     upTier(key, upId) → { tier, lib, own }                         setUpTier(key, upId, tier | null)
     upsOfEq(key, eqId) → the unit processes a piece of equipment takes part in
     sentence(vals) · trail(key, { eqId, band, name, what })
   This prototype stores and shows the timelines; the reminders it plays back still use the earlier fixed rule. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7;
  const TIERS = ['A', 'B', 'C']; const LABEL = { A: 'Critical', B: 'Essential', C: 'Standard' }; const TONE = { A: 'warn', B: 'info', C: 'muted' };
  const DEF = { A: { remind: 1, repeat: 2, lead: 4, senior: 8 }, B: { remind: 4, repeat: 8, lead: 24, senior: 48 }, C: { remind: 24, repeat: 24, lead: 72, senior: 168 } };
  const FIELDS = [['remind', 'First reminder after'], ['repeat', 'Then remind every'], ['lead', 'Tell the Lead after'], ['senior', 'Tell the Senior Lead after']];
  const arr = (x) => (Array.isArray(x) ? x : []);
  const cat = (code) => (W.CATALOGUE_BY_CODE && W.CATALOGUE_BY_CODE[code]) || null;
  const fmt = (h) => { h = +h; if (h >= 48 && h % 24 === 0) return `${h / 24} days`; if (h === 24) return '1 day'; if (h < 1) return `${Math.round(h * 60)} min`; return `${h} ${h === 1 ? 'hour' : 'hours'}`; };
  function libStore() { const L = V().S.lib; if (!L.critTimes || typeof L.critTimes !== 'object') L.critTimes = {}; return L.critTimes; }
  function plantRec(key) { return V().S.plants[key] || null; }
  function plantStore(key) { const P = plantRec(key); if (!P) return {}; if (!P.critTimes || typeof P.critTimes !== 'object') P.critTimes = {}; return P.critTimes; }
  const lib = (tier) => ({ ...DEF[tier], ...(libStore()[tier] || {}) });
  function plant(key, tier) { const o = plantStore(key)[tier]; return o ? { ...o, own: true } : { ...lib(tier), own: false }; }
  function clean(x) {
    const out = {};
    for (const [k, label] of FIELDS) { const v = Number(x && x[k]); if (!(x && x[k] !== '' && x[k] != null) || !Number.isFinite(v) || v <= 0) return { error: `${label}: give a number of hours above 0.` }; if (v > 24 * 60) return { error: `${label}: 60 days is the most.` }; out[k] = Math.round(v * 100) / 100; }
    if (out.lead < out.remind) return { error: 'The Lead is told after the first reminder, not before it.' };
    if (out.senior < out.lead) return { error: 'The Senior Lead is told after the Lead, not before.' };
    return out;
  }
  const sentence = (t) => `Reminder ${fmt(t.remind)} after it is due, then every ${+t.repeat === 24 ? 'day' : +t.repeat === 1 ? 'hour' : fmt(t.repeat)}. Lead told after ${fmt(t.lead)}, Senior Lead after ${fmt(t.senior)}.`;
  const same = (a, b) => FIELDS.every(([k]) => +a[k] === +b[k]);
  function setLib(tier, x) {
    if (!TIERS.includes(tier)) return { ok: false, error: 'No such criticality.' }; const k = clean(x); if (k.error) return { ok: false, error: k.error };
    if (same(k, DEF[tier])) delete libStore()[tier]; else libStore()[tier] = k;
    V().log(null, `Criticality timeline, ${LABEL[tier]}: ${sentence(k)} Every plant that follows the library has it now`, 'library'); if (V().persist) V().persist(); return { ok: true };
  }
  function setPlant(key, tier, x) {
    if (!plantRec(key)) return { ok: false, error: 'No such plant.' }; if (!TIERS.includes(tier)) return { ok: false, error: 'No such criticality.' }; const st = plantStore(key);
    if (x == null) { delete st[tier]; V().log(key, `Criticality timeline, ${LABEL[tier]}: follows the library again`, 'config'); if (V().persist) V().persist(); return { ok: true }; }
    const k = clean(x); if (k.error) return { ok: false, error: k.error };
    if (same(k, lib(tier))) delete st[tier]; else st[tier] = k;
    V().log(key, `Criticality timeline, ${LABEL[tier]}, for this plant: ${sentence(k)}`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  /* unit processes */
  const ups = (key) => { try { return arr(V().structure(key).ups); } catch (e) { return []; } };
  function upStore(key) { const P = plantRec(key); if (!P) return {}; if (!P.upTier || typeof P.upTier !== 'object') P.upTier = {}; return P.upTier; }
  function upTier(key, upId) { const u = ups(key).find((x) => x.id === upId); if (!u) return null; const l = (cat(u.typeId) || {}).tier || 'B'; const o = upStore(key)[upId]; return { tier: o || l, lib: l, own: !!o && o !== l }; }
  function setUpTier(key, upId, tier) {
    const u = ups(key).find((x) => x.id === upId); if (!u) return { ok: false, error: 'No such unit process here.' }; const cur = upTier(key, upId);
    if (tier == null || tier === cur.lib) delete upStore(key)[upId]; else if (!TIERS.includes(tier)) return { ok: false, error: 'Pick a criticality: Critical, Essential or Standard.' }; else upStore(key)[upId] = tier;
    const now = upTier(key, upId); if (now.tier !== cur.tier) V().log(key, `Criticality of the unit process ${u.tag}: ${LABEL[cur.tier]} → ${LABEL[now.tier]}${now.own ? '' : ' (as its library type)'}. Its equipment keeps its own criticality`, 'config');
    if (V().persist) V().persist(); return { ok: true };
  }
  const upsOfEq = (key, eqId) => ups(key).filter((u) => u.id === eqId || arr(u.members).some((m) => m.eqId === eqId));
  W.V7CRIT = { TIERS, LABEL, DEF, lib, setLib, plant, setPlant, upTier, setUpTier, upsOfEq, sentence, fmt, trail: () => '', sheetNote: () => '' };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip; const enc = encodeURIComponent;
  const lv = (tier, title) => chip(LABEL[tier] || tier, { tone: TONE[tier] || 'muted', title: title || '' });
  const eqs = (key) => { try { return arr(V().equipment(key)); } catch (e) { return []; } };

  /* the three labels, side by side */
  function trail(key, o) {
    o = o || {}; const e = o.eqId ? eqs(key).find((x) => x.id === o.eqId) : null; if (!e) return '';
    const us = upsOfEq(key, e.id); const parts = [];
    if (us.length) { const u = us[0]; const t = upTier(key, u.id); parts.push(`<span class="ct-st"><span class="ct-k">Unit process</span><span class="ct-v"><b>${esc(u.tag)}</b> <button type="button" class="ct-chipb" data-act="ct:up-open" data-plant="${esc(key)}" data-up="${esc(u.id)}" title="The unit process has its own criticality. Click to change it.">${lv(t.tier)}</button>${us.length > 1 ? ` <span class="ct-more" title="${esc(us.slice(1).map((x) => x.tag).join(', '))}">+${us.length - 1}</span>` : ''}</span></span>`); }
    else parts.push('<span class="ct-st"><span class="ct-k">Unit process</span><span class="ct-v ct-none">Not part of one</span></span>');
    parts.push(`<span class="ct-st"><span class="ct-k">Equipment</span><span class="ct-v"><b>${esc(e.tag)}</b> ${lv(e.tier, 'How much the plant depends on this equipment')}</span></span>`);
    if (o.band) parts.push(`<span class="ct-st"><span class="ct-k">${esc(o.what || 'Issue')}</span><span class="ct-v"><b>${esc(o.name || '')}</b> ${o.upTo ? '<span class="ct-upto">up to</span> ' : ''}${U.sev(o.band)}</span></span>`);
    return `<div class="ct-trail" id="ct-trail" role="group" aria-label="Criticality and severity">${parts.join('<span class="ct-sep" aria-hidden="true">›</span>')}<span class="ct-note">Three separate labels. Criticality sets the reminders on late tasks; severity sets who an issue tells.</span></div>`;
  }
  W.V7CRIT.trail = trail;

  /* the timelines: one card for the library, one for a plant */
  function rowsHtml(key) {
    const counts = {}; if (key) eqs(key).forEach((e) => { counts[e.tier] = (counts[e.tier] || 0) + 1; });
    return TIERS.map((t) => { const v = key ? plant(key, t) : lib(t); const n = counts[t] || 0;
      return `<li class="ct-row"><div class="ct-rl">${lv(t)}${key ? `<span class="ct-n">${n} ${n === 1 ? 'piece' : 'pieces'} of equipment</span>` : ''}</div><div class="ct-rm">${esc(sentence(v))}</div><div class="ct-ra">${key ? (v.own ? chip('Changed here', { tone: 'warn', title: 'This plant keeps its own timeline; the library keeps its own' }) : chip('Follows the library', { tone: 'muted' })) : ''}${btn('Edit', { act: key ? 'ct:open' : 'ct:lib-open', data: key ? { plant: key, tier: t } : { tier: t }, small: true, title: `Change the ${LABEL[t]} timeline${key ? ' for this plant' : ' in the library'}` })}</div></li>`; }).join('');
  }
  let OPEN = false; let OPEN2 = false; const short = (get) => TIERS.map((t) => `${LABEL[t]} after ${fmt(get(t).remind)}`).join(' · ');
  const fold = (title, line, inner) => `<details class="card p7-fold ct-card" id="ct-card"${OPEN ? ' open' : ''}><summary class="p7-fold-s"><span class="p7-fold-m"><span class="p7-fold-t">${esc(title)}</span><span class="p7-fold-d">${esc(line)}</span></span></summary><div class="ct-body">${inner}</div></details>`;
  function libCard() {
    return fold('Criticality timelines', `A late task or check is first reminded: ${short(lib)}. Open to see who is told next, and to change it.`, `<p class="ct-lead">When a task or a check is due and nobody has done it: when it is reminded, and who is told next. Set once for each criticality. Every plant follows it unless it keeps its own.</p><ul class="ct-rows">${rowsHtml(null)}</ul>`);
  }
  function plantCard(key) {
    const us = ups(key); const own = TIERS.filter((t) => plant(key, t).own).length;
    const upRows = us.map((u) => { const t = upTier(key, u.id); return `<li><span class="ct-ut"><b>${esc(u.tag)}</b> ${esc(u.name)}</span><button type="button" class="ct-chipb" data-act="ct:up-open" data-plant="${esc(key)}" data-up="${esc(u.id)}" title="Click to change it">${lv(t.tier)}</button>${t.own ? chip('Changed here', { tone: 'warn' }) : ''}</li>`; }).join('');
    return fold('Criticality timelines', `A late task or check is first reminded: ${short((t) => plant(key, t))}. ${own ? `${own} changed for this plant` : 'As the library'}. Open to change it, or the criticality of a unit process.`, `<p class="ct-lead">When a task or a check is due and nobody has done it: when it is reminded, and who is told next. Inherited from the library, one per criticality. This plant may keep its own.</p><ul class="ct-rows">${rowsHtml(key)}</ul>${us.length ? `<details class="ct-ups"${OPEN2 ? ' open' : ''}><summary>Criticality of the ${us.length} unit ${us.length === 1 ? 'process' : 'processes'}</summary><p class="ct-upn">A unit process has its own criticality. It does not change the criticality of its equipment.</p><ul class="ct-upl">${upRows}</ul></details>` : ''}`);
  }
  W.V7CRIT.sheetNote = (k0) => { const key = k0 || decodeURIComponent((/^#\/p\/([^/?]+)/.exec(location.hash || '') || [])[1] || ''); return `<ul class="ct-mini">${TIERS.map((t) => `<li><b>${esc(LABEL[t])}</b> ${esc(sentence(key && plantRec(key) ? plant(key, t) : lib(t)))}</li>`).join('')}</ul>`; };

  let ED = null;
  function drawEd() {
    const E = ED; const f = ([k, label]) => U.field({ label: `${label} (hours)`, html: `<input type="number" min="0.25" step="0.25" id="ct-${k}" value="${esc(E.vals[k])}">` });
    U.modal({ title: `${LABEL[E.tier]}: when a task is late${E.key ? ', at this plant' : ''}`,
      body: `<p class="la-n">Hours are counted from when the task or the check was due. 24 is a day.</p><div class="la-2">${f(FIELDS[0])}${f(FIELDS[1])}</div><div class="la-2">${f(FIELDS[2])}${f(FIELDS[3])}</div><p class="la-n">${E.key ? 'This changes the timeline at this plant only. The library keeps its own.' : 'Every plant that follows the library has it at once. A plant that keeps its own timeline is left alone.'}</p>`,
      foot: (E.key && E.own ? btn('Back to the library\'s', { act: 'ct:reset', kind: 'ghost' }) : '') + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.key ? 'Save for this plant' : 'Save', { act: E.key ? 'ct:save' : 'ct:lib-save', kind: 'primary' }) });
  }
  const opener = (el) => { const key = el.getAttribute('data-plant') || null; const tier = el.getAttribute('data-tier'); if (!TIERS.includes(tier)) return false; const v = key ? plant(key, tier) : lib(tier); ED = { key, tier, own: !!v.own, vals: { remind: v.remind, repeat: v.repeat, lead: v.lead, senior: v.senior } }; drawEd(); return false; };
  U.on('ct:open', opener); U.on('ct:lib-open', opener);
  const saver = () => { if (!ED) return false; const x = {}; FIELDS.forEach(([k]) => { const e = document.getElementById('ct-' + k); x[k] = e ? e.value : ''; }); const r = ED.key ? setPlant(ED.key, ED.tier, x) : setLib(ED.tier, x); if (!r.ok) { U.toast(r.error); return false; } const key = ED.key; ED = null; U.closeModal(true); U.toast(key ? 'Saved for this plant.' : 'Saved. Plants that follow the library have it now.'); return undefined; };
  U.on('ct:save', saver); U.on('ct:lib-save', saver);
  U.on('ct:reset', () => { if (!ED || !ED.key) return false; const r = setPlant(ED.key, ED.tier, null); ED = null; U.closeModal(true); U.toast(r.ok ? 'It follows the library again.' : r.error); return undefined; });
  let UE = null;
  U.on('ct:up-open', (el) => { const key = el.getAttribute('data-plant'); const upId = el.getAttribute('data-up'); const u = ups(key).find((x) => x.id === upId); const t = upTier(key, upId); if (!u || !t) return false; UE = { key, upId };
    U.modal({ title: `Criticality of ${u.tag}`, body: U.field({ label: 'How much the plant depends on this unit process', hint: `Its library type, ${u.typeName}, is ${LABEL[t.lib]}.`, html: `<select id="ct-up">${TIERS.map((x) => `<option value="${x}"${x === t.tier ? ' selected' : ''}>${LABEL[x]}${x === t.lib ? ' (as the library)' : ''}</option>`).join('')}</select>` }) + '<p class="la-n">This is the unit process\'s own label. Each piece of equipment in it keeps its own criticality, and each issue its own severity.</p>',
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Save', { act: 'ct:up-save', kind: 'primary' }) }); return false; });
  U.on('ct:up-save', () => { if (!UE) return false; const e = document.getElementById('ct-up'); const r = setUpTier(UE.key, UE.upId, e ? e.value : null); UE = null; U.closeModal(true); U.toast(r.ok ? 'Saved.' : r.error); return undefined; });

  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.id === 'ct-card') OPEN = d.open; else if (d && d.classList && d.classList.contains('ct-ups')) OPEN2 = d.open; }, true);
  if (U.afterRender) U.afterRender((main, path) => {
    try {
      if (!main) return; const p = String(path || location.hash).replace(/^#?\/?/, '').split('?')[0]; let m;
      if (p === 'library') { if (main.querySelector('#ct-card')) return; const body = main.querySelector('.pg-main'); if (body) body.insertAdjacentHTML('afterbegin', libCard()); return; }
      if ((m = /^p\/([^/]+)\/library$/.exec(p))) { if (main.querySelector('#ct-card')) return; const body = main.querySelector('.pg-main'); if (body) body.insertAdjacentHTML('afterbegin', plantCard(decodeURIComponent(m[1]))); return; }
      if (main.querySelector('#ct-trail')) return; let html = '';
      if ((m = /^p\/([^/]+)\/eq\/([^/]+)(\/(?!phone)[^/]*)?$/.exec(p))) html = trail(decodeURIComponent(m[1]), { eqId: decodeURIComponent(m[2]) });
      else if ((m = /^p\/([^/]+)\/alert\/([^/]+)$/.exec(p))) { const key = decodeURIComponent(m[1]); const al = V().alert(key, decodeURIComponent(m[2])); if (al && al.eqId) { const bs = ['emergency', 'major', 'minor', 'caution'].filter((b) => al.bands && al.bands[b] != null); html = trail(key, { eqId: al.eqId, band: bs[0] || al.entryBand, upTo: bs.length > 1, name: al.sensorName ? `${al.sensorName} ${al.dir === 'below' ? 'low' : 'high'}` : al.name, what: 'Alert' }); } }
      else if ((m = /^p\/([^/]+)\/issue\/([^/]+)$/.exec(p))) { const key = decodeURIComponent(m[1]); const id = decodeURIComponent(m[2]); const is = arr(V().issues(key, {})).find((i) => i.id === id); if (is && is.eqId) html = trail(key, { eqId: is.eqId, band: is.band, name: is.title, what: 'Issue' }); }
      if (!html) return; const head = main.querySelector('.ph'); if (head) head.insertAdjacentHTML('afterend', html);
    } catch (e) { /* the page still shows without it */ }
  });
})();
