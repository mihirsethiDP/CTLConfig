/* v7/7 and v7/8 · crit78.js — criticality, and what it sets.
   A piece of equipment shows ONE criticality, and it is worked out:
     the criticality of the unit process it takes part in, lowered by its role in that step
       the step stops without it: the same · the step keeps running without it (a standby takes over, or it runs at reduced capacity): one lower.
     Until a person says otherwise the step is taken to stop without it: a standby is never assumed.
     Equipment in no unit process keeps its type's criticality. A criticality set by hand at the plant wins, and is a deviation.
     An issue has a severity; that is a separate label and is never folded in.
   Criticality sets one thing: when a task or a check that is due and not done is reminded, and who is told next.
   That timeline is set once per criticality in the library, and a plant may keep its own.

   window.V7CRIT:
     lib(tier) → { remind, repeat, lead, senior }   hours after the task was due
     setLib(tier, vals)
     plant(key, tier) → { remind, repeat, lead, senior, own }      setPlant(key, tier, vals | null)
     upTier(key, upId) → { tier, lib, own }                         setUpTier(key, upId, tier | null)
     upsOfEq(key, eqId) → the unit processes a piece of equipment takes part in
     role(key, eqId) → { role, own, why }      setRole(key, eqId, role | null)
     derived(key, eqId) → { tier, from: 'hand' | 'worked' | 'type', typeTier, up, upTier, role, why }
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
  const CT = (tier) => ({ kind: 'crittime', tier });
  function setPlant(key, tier, x, why) {
    if (!plantRec(key)) return { ok: false, error: 'No such plant.' }; if (!TIERS.includes(tier)) return { ok: false, error: 'No such criticality.' }; const st = plantStore(key);
    if (x == null) { delete st[tier]; if (W.V7OVX) W.V7OVX.end(key, CT(tier)); V().log(key, `Criticality timeline, ${LABEL[tier]}: follows the library again`, 'config'); if (V().persist) V().persist(); return { ok: true }; }
    const k = clean(x); if (k.error) return { ok: false, error: k.error };
    if (same(k, lib(tier))) delete st[tier]; else st[tier] = k;
    if (W.V7OVX) { if (st[tier]) W.V7OVX.record(key, CT(tier), sentence(k), sentence(lib(tier)), why); else W.V7OVX.end(key, CT(tier), 'Now the same as the library'); }
    V().log(key, `Criticality timeline, ${LABEL[tier]}, for this plant: ${sentence(k)}`, 'config'); if (V().persist) V().persist(); return { ok: true };
  }
  /* unit processes */
  const ups = (key) => { try { return arr(V().structure(key).ups); } catch (e) { return []; } };
  function upStore(key) { const P = plantRec(key); if (!P) return {}; if (!P.upTier || typeof P.upTier !== 'object') P.upTier = {}; return P.upTier; }
  function upTier(key, upId) { const u = ups(key).find((x) => x.id === upId); if (!u) return null; const l = (cat(u.typeId) || {}).tier || 'B'; const o = upStore(key)[upId]; return { tier: o || l, lib: l, own: !!o && o !== l }; }
  function setUpTier(key, upId, tier) {
    const u = ups(key).find((x) => x.id === upId); if (!u) return { ok: false, error: 'No such unit process here.' }; const cur = upTier(key, upId);
    if (tier == null || tier === cur.lib) delete upStore(key)[upId]; else if (!TIERS.includes(tier)) return { ok: false, error: 'Pick a criticality: Critical, Essential or Standard.' }; else upStore(key)[upId] = tier;
    const now = upTier(key, upId); if (now.tier !== cur.tier) V().log(key, `Criticality of the unit process ${u.tag}: ${LABEL[cur.tier]} → ${LABEL[now.tier]}${now.own ? '' : ' (as its library type)'}. The criticality of its equipment is worked out again`, 'config'); if (V().touch) V().touch();
    if (V().persist) V().persist(); return { ok: true };
  }
  const upsOfEq = (key, eqId) => ups(key).filter((u) => u.id === eqId || arr(u.members).some((m) => m.eqId === eqId));
  /* the role of a piece of equipment in its step, and the one criticality worked out from it */
  const ROLES = ['stops', 'standby']; const DROP = { stops: 0, standby: 1 };
  const ROLE_LABEL = { stops: 'The step stops without it', standby: 'The step keeps running without it' }; const ROLE_LONG = { stops: 'The step stops without it', standby: 'The step keeps running: a standby takes over, or it runs at reduced capacity' };
  const ROLE_WHY = { stops: 'the step stops without it', standby: 'the step keeps running without it' };
  const cgsOf = (key) => { try { return arr(V().structure(key).cgs); } catch (e) { return []; } };
  function roleStore(key) { const P = plantRec(key); if (!P) return {}; if (!P.eqRole || typeof P.eqRole !== 'object') P.eqRole = {}; return P.eqRole; }
  function roleIn(key, eqId, us, cgs) {
    const o0 = roleStore(key)[eqId]; const o = o0 === 'degraded' ? 'standby' : o0; if (ROLES.includes(o)) return { role: o, own: true, why: 'set here' };
    const g = cgs.find((c) => arr(c.memberIds).length > 1 && arr(c.memberIds).includes(eqId)); if (g) return { role: 'stops', own: false, group: g.name, why: `it is one of ${arr(g.memberIds).length} in ${g.name}, and nobody has confirmed that the step keeps running without it` };
    return { role: 'stops', own: false, why: us.some((u) => u.id === eqId) ? 'it is the step itself' : 'nobody has said that something stands in for it' };
  }
  const role = (key, eqId) => roleIn(key, eqId, upsOfEq(key, eqId), cgsOf(key));
  function setRole(key, eqId, r) {
    if (!plantRec(key)) return { ok: false, error: 'No such plant.' }; const e = RAW.eq ? RAW.eq(key, eqId) : null; if (!e) return { ok: false, error: 'No such equipment here.' };
    if (r != null && !ROLES.includes(r)) return { ok: false, error: 'Pick what happens to the step without this equipment.' };
    const was = derived(key, eqId); const st = roleStore(key); delete st[eqId]; if (r != null && r !== role(key, eqId).role) st[eqId] = r;
    const now = derived(key, eqId); V().log(key, `${e.tag}: ${ROLE_LABEL[now.role || 'stops'].toLowerCase()}${now.tier !== was.tier ? `. Its criticality goes from ${LABEL[was.tier]} to ${LABEL[now.tier]}` : ''}`, 'config'); if (V().touch) V().touch(); if (V().persist) V().persist(); return { ok: true };
  }
  const RAW = {};
  function work(key, e, usAll, cgs) {
    const ti = e.tierSource || {}; const typeTier = TIERS.includes(e.typeTier) ? e.typeTier : e.tier;
    if (ti.chip && ti.chip !== 'lib') return { tier: typeTier, from: 'hand', typeTier, up: null, upTier: null, role: null, why: ti.chip === 'form' ? 'from the Visualization' : 'set by hand at this plant' };
    const us = usAll.filter((u) => u.id === e.id || arr(u.members).some((m) => m.eqId === e.id)); if (!us.length) return { tier: typeTier, from: 'type', typeTier, up: null, upTier: null, role: null, why: `from its type, ${e.typeName}; it is in no unit process` };
    const r = roleIn(key, e.id, us, cgs); let best = null;
    us.forEach((u) => { const t = upTier(key, u.id); if (!t) return; const i = Math.min(2, TIERS.indexOf(t.tier) + DROP[r.role]); if (!best || i < best.i) best = { i, u, t: t.tier }; });
    if (!best) return { tier: typeTier, from: 'type', typeTier, up: null, upTier: null, role: null, why: `from its type, ${e.typeName}` };
    return { tier: TIERS[best.i], from: 'worked', typeTier, up: best.u, upTier: best.t, role: r.role, roleOwn: r.own, roleWhy: r.why, why: best.u.id === e.id && r.role === 'stops' ? `it is the unit process ${best.u.tag}, which is ${LABEL[best.t]}` : `${best.u.tag} is ${LABEL[best.t]}, and ${ROLE_WHY[r.role]}` };
  }
  function derived(key, eqId) { const e = RAW.eq ? RAW.eq(key, eqId) : null; if (!e) return null; return work(key, e, ups(key), cgsOf(key)); }
  /* every screen reads equipment through these two, so every screen shows the one worked-out criticality */
  (function wrap() {
    const v = V(); if (!v || typeof v.equipment !== 'function' || v.equipment._ct) return; let busy = false;
    const dress = (key, e, us, cgs) => { if (!e || e._ct) return e; const d = work(key, { ...e, typeTier: e.tier }, us, cgs); return { ...e, typeTier: e.tier, tier: d.tier, tierLabel: e.tierLabel != null ? LABEL[d.tier] : e.tierLabel, tierWhy: d.from === 'worked' ? `worked out from ${d.up.tag}` : null, tierFrom: d.from, _ct: true }; };
    const e0 = v.equipment; const q0 = v.eq; RAW.equipment = (key) => e0.call(v, key); RAW.eq = (key, id) => (typeof q0 === 'function' ? q0.call(v, key, id) : arr(e0.call(v, key)).find((x) => x.id === id) || null);
    v.equipment = function (key) { const out = e0.apply(this, arguments); if (busy || !Array.isArray(out)) return out; busy = true; try { const us = ups(key); const cgs = cgsOf(key); return out.map((e) => dress(key, e, us, cgs)); } catch (err) { return out; } finally { busy = false; } };
    v.equipment._ct = true;
    if (typeof q0 === 'function') v.eq = function (key) { const e = q0.apply(this, arguments); if (busy || !e) return e; busy = true; try { return dress(key, e, ups(key), cgsOf(key)); } catch (err) { return e; } finally { busy = false; } };
  })();
  /* equipment in a set whose role nobody has confirmed: it is rated as if the step stops without it */
  function toConfirm(key) { const cgs = cgsOf(key).filter((c) => arr(c.memberIds).length > 1); if (!cgs.length) return []; const rs = roleStore(key); const us = ups(key); const out = [];
    (RAW.equipment ? arr(RAW.equipment(key)) : []).forEach((e) => { const g = cgs.find((c) => c.memberIds.includes(e.id)); if (!g || rs[e.id] || (e.tierSource && e.tierSource.chip && e.tierSource.chip !== 'lib') || !us.some((u) => u.id === e.id || arr(u.members).some((m) => m.eqId === e.id))) return; out.push({ id: e.id, tag: e.tag, name: e.name, group: g.name }); }); return out; }
  (function gap() { const v = V(); const c0 = v && v.checklist; if (typeof c0 !== 'function' || c0._ct) return;
    v.checklist = function (key) { const cl = c0.apply(this, arguments); try { const xs = toConfirm(key); if (cl && Array.isArray(cl.gaps) && xs.length && !cl.gaps.some((g) => g.id === 'roles')) cl.gaps = cl.gaps.concat([{ id: 'roles', text: `${xs.length} ${xs.length === 1 ? 'piece' : 'pieces'} of equipment in a set with no confirmed role: rated as if the step stops without ${xs.length === 1 ? 'it' : 'each one'}`, link: `#/p/${key}/library`, count: xs.length, items: xs.map((e) => ({ eqId: e.id, tag: e.tag })) }]); } catch (e) { /* the checklist stays as it was */ } return cl; }; v.checklist._ct = true; })();
  if (W.V7OVX) W.V7OVX.register('crittime', { base: (key, t) => sentence(lib(t.tier)), what: (key, t) => ({ what: `Late tasks on ${LABEL[t.tier]} equipment · reminders` }), back: (key, t) => { delete plantStore(key)[t.tier]; } });
  const landsText = (has) => { const ps = arr((() => { try { return V().plants(); } catch (e) { return []; } })()); const own = ps.filter((p) => has(p.key)).length; return `Once published: ${ps.length - own} ${ps.length - own === 1 ? 'plant follows' : 'plants follow'} it${own ? `, ${own} ${own === 1 ? 'keeps its' : 'keep their'} own` : ''}.`; };
  if (W.V7PEND) W.V7PEND.register('crit', { id: (a) => a[0], check: (a) => (TIERS.includes(a[0]) ? clean(a[1]).error || null : 'No such criticality.'), same: (a) => { const k = clean(a[1]); return !k.error && same(k, lib(a[0])); }, apply: (a) => setLib(a[0], a[1]), lands: (a) => landsText((key) => !!plantStore(key)[a[0]]) });
  W.V7CRIT = { TIERS, LABEL, DEF, ROLES, ROLE_LABEL, toConfirm, lib, setLib, plant, setPlant, upTier, setUpTier, upsOfEq, role, setRole, derived, sentence, fmt, trail: () => '', sheetNote: () => '' };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip; const enc = encodeURIComponent;
  const lv = (tier, title) => chip(LABEL[tier] || tier, { tone: TONE[tier] || 'muted', title: title || '' });
  const eqs = (key) => { try { return arr(V().equipment(key)); } catch (e) { return []; } };

  /* one criticality, why it is that, and one way in to change what it is worked out from */
  function trail(key, o) {
    o = o || {}; const d = o.eqId ? derived(key, o.eqId) : null; const e = d ? eqs(key).find((x) => x.id === o.eqId) : null; if (!e) return '';
    const how = d.from === 'worked' ? `Worked out: ${d.why}.` : d.from === 'hand' ? `${d.why.charAt(0).toUpperCase()}${d.why.slice(1)}.` : `${d.why.charAt(0).toUpperCase()}${d.why.slice(1)}.`;
    const sevBit = o.band ? `<span class="ct-sep" aria-hidden="true">·</span><span class="ct-st"><span class="ct-k">Severity of this ${esc((o.what || 'Issue').toLowerCase())}</span><span class="ct-v">${o.upTo ? '<span class="ct-upto">up to</span> ' : ''}${U.sev(o.band)}</span></span>` : '';
    return `<div class="ct-trail ct-one" id="ct-trail" role="group" aria-label="Criticality"><span class="ct-st"><span class="ct-k">Criticality of ${esc(e.tag)}</span><span class="ct-v">${lv(d.tier)} <span class="ct-why">${esc(how)}</span></span></span>${sevBit}<span class="ct-go">${btn('How it is worked out', { act: 'ct:why', data: { plant: key, eq: e.id }, small: true, kind: 'ghost', title: 'See what the criticality comes from, and change it' })}</span>${o.band ? '<span class="ct-note">Criticality sets the reminders on late tasks. Severity sets who an issue tells, and how fast.</span>' : ''}</div>`;
  }
  W.V7CRIT.trail = trail;

  /* the timelines: one card for the library, one for a plant */
  function rowsHtml(key) {
    const counts = {}; if (key) eqs(key).forEach((e) => { counts[e.tier] = (counts[e.tier] || 0) + 1; });
    return TIERS.map((t) => { const v = key ? plant(key, t) : lib(t); const n = counts[t] || 0;
      return `<li class="ct-row"><div class="ct-rl">${lv(t)}${key ? `<span class="ct-n">${n} ${n === 1 ? 'piece' : 'pieces'} of equipment</span>` : ''}</div><div class="ct-rm">${esc(sentence(v))}${!key && W.V7PEND && W.V7PEND.get('crit', t) ? `<div class="pd-next">${W.V7PEND.chip()} ${esc(sentence(W.V7PEND.get('crit', t).args[1]))}</div>` : ''}</div><div class="ct-ra">${key ? (v.own ? chip('Changed here', { tone: 'warn', title: 'This plant keeps its own timeline; the library keeps its own' }) : chip('Follows the library', { tone: 'muted' })) : ''}${!key && !libStore()[t] ? chip('Starter value', { tone: 'muted', title: 'Shipped as a first guess. Not reviewed with operations yet' }) : ''}${btn('Edit', { act: key ? 'ct:open' : 'ct:lib-open', data: key ? { plant: key, tier: t } : { tier: t }, small: true, title: `Change the ${LABEL[t]} timeline${key ? ' for this plant' : ' in the library'}` })}</div></li>`; }).join('');
  }
  let OPEN = false; let OPEN2 = false; const short = (get) => TIERS.map((t) => `${LABEL[t]} after ${fmt(get(t).remind)}`).join(' · ');
  const fold = (title, line, inner) => `<details class="card p7-fold ct-card" id="ct-card"${OPEN ? ' open' : ''}><summary class="p7-fold-s"><span class="p7-fold-m"><span class="p7-fold-t">${esc(title)}</span><span class="p7-fold-d">${esc(line)}</span></span></summary><div class="ct-body">${inner}</div></details>`;
  function libCard() {
    return fold('Criticality timelines', `A late task or check is first reminded: ${short(lib)}. Open to see who is told next, and to change it.`, `<p class="ct-lead">When a task or a check is due and nobody has done it: when it is reminded, and who is told next. Set once for each criticality. Every plant follows it unless it keeps its own.</p><ul class="ct-rows">${rowsHtml(null)}</ul>`);
  }
  function plantCard(key) {
    const us = ups(key); const own = TIERS.filter((t) => plant(key, t).own).length; const conf = toConfirm(key);
    const upRows = us.map((u) => { const t = upTier(key, u.id); return `<li><span class="ct-ut"><b>${esc(u.tag)}</b> ${esc(u.name)}</span><button type="button" class="ct-chipb" data-act="ct:up-open" data-plant="${esc(key)}" data-up="${esc(u.id)}" title="Click to change it">${lv(t.tier)}</button>${t.own ? chip('Changed here', { tone: 'warn' }) : ''}</li>`; }).join('');
    return fold('Criticality timelines', `A late task or check is first reminded: ${short((t) => plant(key, t))}. ${own ? `${own} changed for this plant` : 'As the library'}. Open to change it, or the criticality of a unit process.`, `<p class="ct-lead">When a task or a check is due and nobody has done it: when it is reminded, and who is told next. Inherited from the library, one per criticality. This plant may keep its own. The count is equipment by its worked-out criticality.</p><ul class="ct-rows">${rowsHtml(key)}</ul>${us.length ? `<details class="ct-ups"${OPEN2 ? ' open' : ''}><summary>Criticality of the ${us.length} unit ${us.length === 1 ? 'process' : 'processes'}</summary><p class="ct-upn">Set the criticality of a unit process here. The criticality of each piece of equipment in it is worked out from this and from the equipment's role in the step.</p><ul class="ct-upl">${upRows}</ul></details>` : ''}${conf.length ? `<details class="ct-ups ct-conf"${OPEN2 ? ' open' : ''}><summary>${conf.length} ${conf.length === 1 ? 'piece' : 'pieces'} of equipment in a set with no confirmed role</summary><p class="ct-upn">Each is rated as if the step stops without it. Confirm it once at onboarding: say whether the step keeps running without it.</p><ul class="ct-upl">${conf.map((e) => `<li><span class="ct-ut"><b>${esc(e.tag)}</b> ${esc(e.name)} <span class="ct-n">${esc(e.group)}</span></span>${btn('Confirm', { act: 'ct:why', data: { plant: key, eq: e.id }, small: true })}</li>`).join('')}</ul></details>` : ''}`);
  }
  W.V7CRIT.sheetNote = (k0) => { const key = k0 || decodeURIComponent((/^#\/p\/([^/?]+)/.exec(location.hash || '') || [])[1] || ''); return `<ul class="ct-mini">${TIERS.map((t) => `<li><b>${esc(LABEL[t])}</b> ${esc(sentence(key && plantRec(key) ? plant(key, t) : lib(t)))}</li>`).join('')}</ul>`; };

  let ED = null;
  function drawEd() {
    const E = ED; const f = ([k, label]) => U.field({ label: `${label} (hours)`, html: `<input type="number" min="0.25" step="0.25" id="ct-${k}" value="${esc(E.vals[k])}">` });
    U.modal({ title: `${LABEL[E.tier]}: when a task is late${E.key ? ', at this plant' : ''}`,
      body: `<p class="la-n">Hours are counted from when the task or the check was due. 24 is a day.</p><div class="la-2">${f(FIELDS[0])}${f(FIELDS[1])}</div><div class="la-2">${f(FIELDS[2])}${f(FIELDS[3])}</div><p class="la-n">${E.key ? 'This changes the timeline at this plant only. The library keeps its own.' : 'It waits with the other library changes until you publish it. Then every plant that follows the library has it; a plant that keeps its own timeline is left alone.'}</p>${E.key && W.V7OVX ? W.V7OVX.whyHtml() : ''}`,
      foot: (E.key && E.own ? btn('Back to the library\'s', { act: 'ct:reset', kind: 'ghost' }) : '') + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.key ? 'Save for this plant' : 'Save', { act: E.key ? 'ct:save' : 'ct:lib-save', kind: 'primary' }) });
  }
  const opener = (el) => { const key = el.getAttribute('data-plant') || null; const tier = el.getAttribute('data-tier'); if (!TIERS.includes(tier)) return false; const pv = !key && W.V7PEND ? W.V7PEND.get('crit', tier) : null; const v = key ? plant(key, tier) : pv ? pv.args[1] : lib(tier); ED = { key, tier, own: !!v.own, vals: { remind: v.remind, repeat: v.repeat, lead: v.lead, senior: v.senior } }; drawEd(); return false; };
  U.on('ct:open', opener); U.on('ct:lib-open', opener);
  const saver = () => { if (!ED) return false; const x = {}; FIELDS.forEach(([k]) => { const e = document.getElementById('ct-' + k); x[k] = e ? e.value : ''; }); let why = null; if (ED.key && W.V7OVX) { const w = W.V7OVX.readWhy(); if (!w.ok) { U.toast(w.error); return false; } why = w.opts; } const kk = clean(x); const stg = !ED.key && !!W.V7PEND && !kk.error; const r = ED.key ? setPlant(ED.key, ED.tier, x, why) : stg ? W.V7PEND.stage('crit', [ED.tier, kk], `Criticality timeline, ${LABEL[ED.tier]}: ${sentence(kk)}`) : setLib(ED.tier, x); if (!r.ok) { U.toast(r.error); return false; } const key = ED.key; ED = null; U.closeModal(true); U.toast(key ? 'Saved for this plant. It is listed under Deviations.' : stg ? W.V7PEND.saved(r) : 'Saved. Plants that follow the library have it now.'); return undefined; };
  U.on('ct:save', saver); U.on('ct:lib-save', saver);
  U.on('ct:reset', () => { if (!ED || !ED.key) return false; const r = setPlant(ED.key, ED.tier, null); ED = null; U.closeModal(true); U.toast(r.ok ? 'It follows the library again.' : r.error); return undefined; });
  let UE = null;
  U.on('ct:up-open', (el) => { const key = el.getAttribute('data-plant'); const upId = el.getAttribute('data-up'); const u = ups(key).find((x) => x.id === upId); const t = upTier(key, upId); if (!u || !t) return false; UE = { key, upId };
    U.modal({ title: `Criticality of ${u.tag}`, body: U.field({ label: 'How much the plant depends on this unit process', hint: `Its library type, ${u.typeName}, is ${LABEL[t.lib]}.`, html: `<select id="ct-up">${TIERS.map((x) => `<option value="${x}"${x === t.tier ? ' selected' : ''}>${LABEL[x]}${x === t.lib ? ' (as the library)' : ''}</option>`).join('')}</select>` }) + '<p class="la-n">The criticality of each piece of equipment in this step is worked out from it: the same when the step stops without the equipment, one lower when the step keeps running without it. A criticality set by hand is left alone.</p>',
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Save', { act: 'ct:up-save', kind: 'primary' }) }); return false; });
  U.on('ct:up-save', () => { if (!UE) return false; const e = document.getElementById('ct-up'); const r = setUpTier(UE.key, UE.upId, e ? e.value : null); UE = null; U.closeModal(true); U.toast(r.ok ? 'Saved.' : r.error); return undefined; });

  let WE = null;
  U.on('ct:why', (el) => { const key = el.getAttribute('data-plant'); const eqId = el.getAttribute('data-eq'); const d = derived(key, eqId); const e = eqs(key).find((x) => x.id === eqId); if (!d || !e) return false; WE = { key, eqId };
    const rule = `<ul class="ct-mini"><li><b>${esc(ROLE_LABEL.stops)}</b> the same as the unit process.</li><li><b>${esc(ROLE_LABEL.standby)}</b> one lower. A standby takes over, or the step runs at reduced capacity.</li></ul>`;
    const hand = btn('Set it by hand instead', { act: 'obj:tier', data: { plant: key, eq: eqId }, kind: 'ghost', title: 'Give this equipment a criticality of its own, with a reason. It is listed under Deviations' });
    if (d.from !== 'worked') { U.modal({ title: `Criticality of ${e.tag}: ${LABEL[d.tier]}`, body: `<p class="la-n">${d.from === 'hand' ? 'This one was set by hand at this plant, so nothing is worked out for it. Open the criticality sheet to change it or to go back.' : `${esc(e.tag)} is in no unit process, so it keeps the criticality of its type, ${esc(e.typeName)}. Place it in a unit process under Structure and its criticality is worked out from that step.`}</p>${rule}`, foot: btn('Close', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(d.from === 'hand' ? 'Open the criticality sheet' : 'Set it by hand', { act: 'obj:tier', data: { plant: key, eq: eqId }, kind: 'primary' }) }); return false; }
    const r = role(key, eqId); WE.upId = d.up.id; const ut = upTier(key, d.up.id);
    U.modal({ title: `Criticality of ${e.tag}: ${LABEL[d.tier]}`,
      body: `<p class="la-n">Worked out from two things. Change either and the criticality follows.</p>`
        + U.field({ label: `1. How much the plant depends on ${d.up.tag} (${d.up.typeName})`, hint: `Its library type is ${LABEL[ut.lib]}. This changes every piece of equipment in the step.`, html: `<select id="ct-wup">${TIERS.map((x) => `<option value="${x}"${x === ut.tier ? ' selected' : ''}>${LABEL[x]}${x === ut.lib ? ' (as the library)' : ''}</option>`).join('')}</select>` })
        + U.field({ label: `2. What happens to the step without ${e.tag}`, hint: r.own ? 'Set here.' : `Not confirmed yet: ${r.why}. Until someone confirms it, the step is taken to stop without it.`, html: `<select id="ct-wrole">${ROLES.map((x) => `<option value="${x}"${x === r.role ? ' selected' : ''}>${ROLE_LONG[x]}</option>`).join('')}</select>` })
        + rule + `<p class="la-n">Its type, ${esc(e.typeName)}, is ${LABEL[d.typeTier]} in the library. That is used only for equipment that is in no unit process.</p>`,
      foot: hand + btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Save', { act: 'ct:why-save', kind: 'primary' }) }); return false; });
  U.on('ct:why-save', () => { if (!WE) return false; const g = (id) => { const x = document.getElementById(id); return x ? x.value : null; }; const a = setUpTier(WE.key, WE.upId, g('ct-wup')); const b = a.ok ? setRole(WE.key, WE.eqId, g('ct-wrole')) : a; const d = b.ok ? derived(WE.key, WE.eqId) : null; WE = null; U.closeModal(true); U.toast(b.ok ? `Saved. Its criticality is ${LABEL[d.tier]}.` : b.error); return undefined; });

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
