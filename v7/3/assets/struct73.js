/* v7/3 · struct73.js — the plant's structure on screen (card D1): stages, unit processes with the equipment that takes part in
   them, control groups (duty/standby sets), and equipment not placed yet. A new plant's structure is proposed from the plant graph
   and confirmed once. The library gains unit-process types and control-group types (card D7: a control group's type houses the
   changeover work, one task for the set).
   Routes: #/p/:plant/structure · #/library-structure. Exposes window.V7STRUCT73 {chips, filedOptions, libraryCard, homeLine}.
   ACTIONS: st:confirm st:place */
(function () {
  'use strict';
  const W = window; const UI = W.V7UI; if (!UI) return;
  const V = () => W.V7; const { esc, card, btn, chip, note, empty, plural } = UI;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = encodeURIComponent;
  const S = (key) => (V() && V().structure ? V().structure(key) : { ups: [], cgs: [], unplaced: [] });
  const PS = (key) => { const s = V() && V().S; return s && s.plants ? s.plants[key] : null; };
  const eqHref = (key, id) => `#/p/${enc(key)}/eq/${enc(id)}`;
  const eqOf = (key, id) => { try { return V().eq(key, id); } catch (e) { return null; } };
  const tagOf = (key, id) => { const e = eqOf(key, id); return e ? e.tag : id; };
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);

  /* a new plant's proposal is confirmed once; hand placements are kept beside it */
  const confirmed = (key) => { const st = S(key); const p = PS(key); return st.state === 'confirmed' || !!(p && p.structureOk); };
  const placedOf = (key) => { const p = PS(key); return (p && p.placed) || {}; };
  const unplaced = (key) => arr(S(key).unplaced).filter((id) => placedOf(key)[id] == null);
  function membersOf(key, u) {
    const extra = Object.entries(placedOf(key)).filter(([, up]) => up === u.id).map(([eqId]) => ({ eqId, tag: tagOf(key, eqId), role: 'Placed by hand' }));
    return arr(u.members).concat(extra);
  }
  function upsOfEq(key, eqId) {
    const st = S(key); const own = st.ups.find((u) => u.id === eqId); if (own) return [own];
    const hand = placedOf(key)[eqId];
    return st.ups.filter((u) => arr(u.members).some((m) => m.eqId === eqId) || u.id === hand);
  }
  /* where condition-based work raised by this equipment's reading can be filed */
  function filedOptions(key, eqId) {
    return [{ id: '', label: 'the plant' }].concat(upsOfEq(key, eqId).map((u) => ({ id: u.id, label: `${u.tag} (${u.typeName})` })));
  }
  /* chips for an equipment page: what it is in the structure */
  function chips(key, eqId) {
    const st = S(key); const out = []; const own = st.ups.find((u) => u.id === eqId);
    if (own) out.push(chip(`Unit process · ${own.typeName}`, { tone: 'info', href: `#/p/${enc(key)}/structure`, title: `${own.stageLabel} stage. ${own.why}` }));
    else { const ups = upsOfEq(key, eqId); if (ups.length) out.push(chip(`Takes part in ${ups.map((u) => u.tag).join(', ')}`, { tone: 'muted', href: `#/p/${enc(key)}/structure`, title: 'The unit processes this equipment serves' })); else if (arr(st.unplaced).includes(eqId)) out.push(chip('Not placed in a unit process yet', { tone: 'warn', href: `#/p/${enc(key)}/structure` })); }
    const cg = st.cgs.find((c) => c.memberIds.includes(eqId)); if (cg) out.push(chip(`Control group · ${cg.name}`, { tone: 'muted', href: `#/p/${enc(key)}/structure`, title: 'Runs as a duty/standby set with ' + cg.memberIds.filter((x) => x !== eqId).map((x) => tagOf(key, x)).join(', ') }));
    return out;
  }
  /* one line for the plant's Home: the structure and whether it is confirmed */
  function homeLine(key) {
    const st = S(key); if (!st.ups.length) return '';
    const left = unplaced(key).length; const ok = confirmed(key);
    return card({ title: 'Structure', sub: `${plural(st.ups.length, 'unit process', 'unit processes')} · ${plural(st.cgs.length, 'control group')}${left ? ` · ${left} not placed yet` : ''}`, body: ok ? '<p class="muted">Confirmed. Work that belongs to a treatment step is filed on its unit process.</p>' : '<p>Proposed from the plant graph. Look it over and confirm it.</p>', actions: [btn(ok ? 'Open the structure' : 'Review the structure', { href: `#/p/${enc(key)}/structure`, kind: ok ? 'secondary' : 'primary', small: true })], tone: ok ? null : 'warn' });
  }

  function upCard(key, u) {
    const ms = membersOf(key, u); const tasks = (() => { try { return V().tasks(key, { eqId: u.id }).length; } catch (e) { return 0; } })();
    const mem = ms.length ? `<ul class="st-mem">${ms.map((m) => `<li><a class="mono" href="${esc(eqHref(key, m.eqId))}">${esc(m.tag)}</a><span class="muted">${esc(m.role || '')}</span></li>`).join('')}</ul>` : '<p class="muted small">No other equipment takes part in it.</p>';
    return `<article class="st-up"><header><a class="st-up-t" href="${esc(eqHref(key, u.id))}"><span class="mono">${esc(u.tag)}</span> ${esc(u.name || '')}</a><span class="st-up-k">${esc(u.typeName)}</span></header><p class="st-why">${esc(u.why || '')}</p>${mem}<footer class="muted small">${plural(tasks, 'task')} filed here</footer></article>`;
  }
  function structurePage(params) {
    const key = params.plant; const P = W.V7PLANT; const st = S(key); const ok = confirmed(key); const left = unplaced(key);
    const stages = arr(W.V7_STAGES).map((sg) => ({ sg, ups: st.ups.filter((u) => (u.stage || null) === sg.key) })).filter((x) => x.ups.length);
    const lead = `<p class="lead">A <b>unit process</b> is one treatment step: a basin or reactor and the equipment that serves it. A <b>control group</b> is a duty/standby set that runs as one. Both come from the plant graph.</p>`;
    const ban = !st.ups.length ? '' : ok ? note(`Structure confirmed${left.length ? `, with ${plural(left.length, 'piece')} of equipment still to place` : ''}.`, 'ok')
      : `<div class="banner tone-warn"><div class="banner-t">Proposed from the plant graph: <b>${plural(st.ups.length, 'unit process', 'unit processes')}</b>, <b>${plural(st.cgs.length, 'control group')}</b>${left.length ? `, and ${plural(left.length, 'piece')} of equipment no rule placed` : ''}. Confirm it to carry on; you can still place equipment afterwards.</div><div class="banner-a">${btn('Confirm the structure', { act: 'st:confirm', data: { plant: key }, kind: 'primary' })}</div></div>`;
    const body = [lead, ban];
    stages.forEach((x) => body.push(`<section class="st-stage"><h3 class="st-stage-h">${esc(x.sg.label)} <span class="muted">· ${x.ups.length}</span></h3><div class="st-ups">${x.ups.map((u) => upCard(key, u)).join('')}</div></section>`));
    if (st.cgs.length) body.push(card({ title: 'Control groups', sub: 'A duty/standby set runs as one, so its changeover is one task for the set, not one per piece of equipment.', body: `<ul class="st-cgs">${st.cgs.map((c) => `<li><b>${esc(c.name)}</b><span>${c.memberIds.map((id) => `<a class="mono" href="${esc(eqHref(key, id))}">${esc(tagOf(key, id))}</a>`).join(' ')}</span>${arr(c.feeds).length ? `<span class="muted small">serves ${esc(c.feeds.map((id) => tagOf(key, id)).join(', '))}</span>` : ''}</li>`).join('')}</ul>` }));
    if (left.length) {
      const opts = st.ups.map((u) => `<option value="${esc(u.id)}">${esc(u.tag)} · ${esc(u.typeName)}</option>`).join('');
      body.push(card({ title: `${plural(left.length, 'piece')} of equipment not placed yet`, sub: 'No rule could tell which unit process these serve. Place each one, or leave it on the plant.', tone: 'warn', body: `<ul class="st-left">${left.map((id) => { const e = eqOf(key, id) || {}; return `<li><span><a class="mono" href="${esc(eqHref(key, id))}">${esc(e.tag || id)}</a> ${esc(e.name || '')} <span class="muted">· ${esc(e.typeName || '')}</span></span><select data-act="st:place" data-plant="${esc(key)}" data-eq="${esc(id)}" aria-label="Place ${esc(e.tag || id)}"><option value="">Place in…</option>${opts}<option value="__plant">Leave on the plant</option></select></li>`; }).join('')}</ul>` }));
    }
    if (!st.ups.length) body.push(empty('No structure yet: the plant graph has no basins or reactors to build it from.'));
    const html = body.join('');
    if (P && typeof P.frame === 'function') return P.frame(key, 'structure', html);
    return UI.page({ title: 'Structure', body: html });
  }

  /* the library's two structure types */
  function libraryCard() {
    const n = arr(W.V7_UP_TYPES).length;
    return card({ title: 'Unit processes and control groups', sub: `${n} unit-process types (one treatment step each) and the control-group types that house changeover work.`, actions: [btn('Open', { href: '#/library-structure', small: true })], tone: 'quiet' });
  }
  function libStructurePage() {
    const types = arr(W.V7_UP_TYPES); const used = {}; Object.entries(W.V7_STRUCTURE || {}).forEach(([k, st]) => arr(st.ups).forEach((u) => { (used[u.typeId] = used[u.typeId] || []).push(k); }));
    const pname = (k) => { try { return V().plant(k).name; } catch (e) { return k; } };
    const eqCode = {}; try { arr(V().libTypes()).forEach((t) => { eqCode[t.code] = t.typeName; }); } catch (e) { /* ignore */ }
    const byStage = arr(W.V7_STAGES).map((sg) => ({ sg, ts: types.filter((t) => (t.stage || null) === sg.key) })).filter((x) => x.ts.length);
    const upHtml = byStage.map((x) => `<h3 class="st-stage-h">${esc(x.sg.label)} <span class="muted">· ${x.ts.length}</span></h3>` + UI.table({ cols: [{ label: 'Unit-process type', key: 'n' }, { label: 'Carries what this equipment type carries', key: 'c' }, { label: 'Used at', key: 'u' }], rows: x.ts.map((t) => { const us = [...new Set(used[t.id] || [])]; return { n: `<b>${esc(t.name)}</b>`, c: t.contentFrom ? `<a href="#/library/${esc(enc(t.contentFrom))}">${esc(eqCode[t.contentFrom] || t.contentFrom)}</a>` : '—', u: us.length ? esc(us.map(pname).join(', ')) : '<span class="muted">Not used yet</span>' }; }) })).join('');
    const kinds = {}; Object.entries(W.V7_STRUCTURE || {}).forEach(([k, st]) => arr(st.cgs).forEach((c) => { const kk = c.kind || 'set'; (kinds[kk] = kinds[kk] || { n: 0, plants: new Set() }); kinds[kk].n++; kinds[kk].plants.add(k); }));
    const CG = { blower: ['Blower set', 'Routine work - Blower duty / standby changeover'], pump: ['Pump set', 'Duty / standby changeover'] };
    const cgRows = Object.keys(kinds).map((k) => ({ n: `<b>${esc((CG[k] || [k.charAt(0).toUpperCase() + k.slice(1) + ' set'])[0])}</b>`, w: esc((CG[k] || [null, 'Duty / standby changeover'])[1]), u: `${plural(kinds[k].n, 'group')} at ${esc([...kinds[k].plants].map(pname).join(', '))}` }));
    return UI.page({
      crumbs: [{ label: 'Library', href: '#/library' }, { label: 'Unit processes and control groups' }], title: 'Unit processes and control groups',
      sub: 'The two library types that sit above equipment. A plant gets them from its plant graph; nothing is drawn twice.',
      body: card({ title: `Unit-process types · ${types.length}`, sub: 'One treatment step each. Each starts with the readings, alerts, tasks and issues of the equipment type it is built around.', body: upHtml })
        + card({ title: 'Control-group types', sub: 'A duty/standby set that runs as one. Its changeover work is housed here: one task for the set at each plant.', body: cgRows.length ? UI.table({ cols: [{ label: 'Control-group type', key: 'n' }, { label: 'Work it houses', key: 'w' }, { label: 'Used at', key: 'u' }], rows: cgRows }) : empty('No control groups yet.') }),
      cls: 'pg-libstruct',
    });
  }

  UI.on('st:confirm', (el) => { const key = ga(el, 'plant'); const p = PS(key); if (!p) return false; p.structureOk = V().now(); try { V().log(key, `Structure confirmed: ${plural(S(key).ups.length, 'unit process', 'unit processes')} and ${plural(S(key).cgs.length, 'control group')}, as proposed from the plant graph`, 'config'); } catch (e) { /* ignore */ } UI.toast('Structure confirmed.'); return undefined; });
  UI.on('st:place', (el) => { const key = ga(el, 'plant'); const p = PS(key); const v = el.value; if (!p || !v) return false; p.placed = p.placed || {}; p.placed[ga(el, 'eq')] = v === '__plant' ? '' : v; const u = S(key).ups.find((x) => x.id === v); try { V().log(key, `${tagOf(key, ga(el, 'eq'))} ${u ? `placed in ${u.tag}` : 'left on the plant'}`, 'config'); } catch (e) { /* ignore */ } return undefined; });

  UI.route('p/:plant/structure', structurePage);
  UI.route('library-structure', libStructurePage);
  W.V7STRUCT73 = { chips, filedOptions, libraryCard, homeLine, confirmed, unplaced, upsOfEq };
}());
