/* v7/9 · own79.js — what one plant adds for itself.
   A plant can add an alert, a task and a calculated value that exist at that plant only. The library is not changed in
   any way, and no other plant is offered them. Each asks why the plant needs it, and the answer is written to Activity.

     an alert             upalert78.js   V7UPALERT.saveOwn(key, placeId, alert) · removeOwn(key, pid)
     a calculated value   dyn78.js       V7DYN.saveOwn(key, placeId, def) · removeOwn(key, pid)
     a task               core7.js       V7.saveOwnTask(key, task) · removeOwnTask(key, id) · ownTasks(key)

   This file is the one card on a plant's Alerts & Tasks page that lists all three and adds to them, and the task form.
   window.V7OWN  list(key) → { alerts, tasks, values } */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const UA = () => W.V7UPALERT; const DY = () => W.V7DYN;
  const arr = (x) => (Array.isArray(x) ? x : []);
  function list(key) {
    let alerts = []; let values = []; let tasks = [];
    try { alerts = UA() ? UA().offers(key).filter((o) => o.mine) : []; } catch (e) { alerts = []; }
    try { values = DY() ? DY().offers(key).filter((o) => o.mine) : []; } catch (e) { values = []; }
    try { tasks = V().ownTasks ? V().ownTasks(key) : []; } catch (e) { tasks = []; }
    return { alerts, tasks, values };
  }
  W.V7OWN = { list };

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const chip = U.chip;
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b || a + 's'}`;
  const isLive = (key) => { try { return V().state(key) === 'live'; } catch (e) { return false; } };
  const flows = () => arr(W.CTL && W.CTL.S && W.CTL.S.lib ? W.CTL.S.lib.flows : []);
  const taskFlows = () => flows().filter((f) => f.name && (UA() && UA().flowFits ? UA().flowFits('task', f) : f.kind !== 'diagnostic')).sort((a, b) => a.name.localeCompare(b.name));
  const KINDS = [['pm', 'Preventive maintenance'], ['routine', 'Routine check'], ['work', 'Routine work']];
  const UNITS = [['day', 'days'], ['week', 'weeks'], ['month', 'months'], ['year', 'years']];

  /* the task form */
  let ED = null;
  function readEd() { if (!ED) return; const g = (id) => { const e = document.getElementById(id); return e ? e.value : null; }; [['name', 'ow-name'], ['eqId', 'ow-where'], ['workType', 'ow-kind'], ['n', 'ow-n'], ['unit', 'ow-unit'], ['flowId', 'ow-flow'], ['why', 'ow-why']].forEach(([k, id]) => { const v = g(id); if (v != null) ED[k] = v; }); }
  function drawEd() {
    const E = ED; let eqs = []; try { eqs = arr(V().equipment(E.key)); } catch (e) { eqs = []; }
    const where = E.id ? `<p class="ow-fixed">${esc(E.whereText)}</p>` : `<select id="ow-where"><option value="">The whole plant</option>${eqs.map((e) => `<option value="${esc(e.id)}"${E.eqId === e.id ? ' selected' : ''}>${esc(e.tag)}${e.name && e.name !== e.tag ? ' · ' + esc(e.name) : ''}</option>`).join('')}</select>`;
    const body = U.field({ label: 'Name', hint: 'What the person doing it sees.', html: `<input type="text" id="ow-name" value="${esc(E.name)}" placeholder="For example: Check the client's flow totaliser against the bill">` })
      + `<div class="la-2">${U.field({ label: 'Where', html: where })}${U.field({ label: 'Kind', html: `<select id="ow-kind">${KINDS.map(([k, l]) => `<option value="${k}"${E.workType === k ? ' selected' : ''}>${l}</option>`).join('')}</select>` })}</div>`
      + `<div class="la-2">${U.field({ label: 'How often', hint: 'Daily is the most often.', html: `<span class="cal-often"><span>Every</span><input type="number" min="1" step="1" id="ow-n" value="${esc(E.n)}" aria-label="How many"><select id="ow-unit" aria-label="Days, weeks, months or years">${UNITS.map(([k, l]) => `<option value="${k}"${E.unit === k ? ' selected' : ''}>${l}</option>`).join('')}</select></span>` })}${U.field({ label: 'Steps it follows', hint: 'Optional. A task flow that is already written.', html: `<select id="ow-flow"><option value="">No steps: the name says what to do</option>${taskFlows().map((f) => `<option value="${esc(f.id)}"${E.flowId === f.id ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select>` })}</div>`
      + U.field({ label: 'Why this plant needs it', hint: E.id ? '' : 'Kept with the task and written to Activity.', html: `<input type="text" id="ow-why" value="${esc(E.why || '')}" placeholder="For example: the client's contract asks for it">` })
      + `<p class="la-n">It exists at this plant only. The library is not changed, and no other plant is offered it. ${isLive(E.key) ? 'It starts at once.' : 'It starts when the plant goes live.'} A work level never leaves it out.</p>`;
    U.modal({ title: E.id ? `${E.whereText}: ${E.name}` : 'Add a task for this plant only', wide: true, body, foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn(E.id ? 'Save for this plant' : 'Add for this plant', { act: 'ow:task-save', kind: 'primary' }) });
  }
  U.on('ow:task-open', (el) => { const key = el.getAttribute('data-plant'); const id = el.getAttribute('data-id'); const t = id ? arr(V().ownTasks(key)).find((x) => x.id === id) : null; if (id && !t) return false;
    ED = t ? { key, id: t.id, name: t.name, eqId: t.eqId || '', whereText: t.where, workType: t.workType, n: t.every.n, unit: t.every.unit, flowId: t.flowId || '', why: t.why || '' } : { key, id: null, name: '', eqId: '', whereText: '', workType: 'routine', n: 1, unit: 'month', flowId: '', why: '' }; drawEd(); return false; });
  U.on('ow:task-save', () => { readEd(); if (!ED) return false; const r = V().saveOwnTask(ED.key, { id: ED.id, name: ED.name, eqId: ED.eqId || null, workType: ED.workType, every: { n: Number(ED.n), unit: ED.unit }, flowId: ED.flowId || null, why: ED.why }); if (!r.ok) { U.toast(r.error); return false; }
    const isNew = !ED.id; const k = ED.key; ED = null; U.closeModal(true); U.toast(isNew ? (isLive(k) ? 'Added for this plant only. It has started.' : 'Added for this plant only. It starts when the plant goes live.') : 'Saved for this plant.'); return undefined; });
  U.on('ow:task-remove', (el) => { const r = V().removeOwnTask(el.getAttribute('data-plant'), el.getAttribute('data-id')); U.toast(r.ok ? 'Removed. It was at this plant only.' : r.error); return undefined; });

  /* the card */
  let OPEN = false;
  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d && d.id === 'ow-card') OPEN = d.open; }, true);
  const whyHtml = (w) => (w ? `<div class="ow-why"><span>Why</span> ${esc(w)}</div>` : '');
  function card(key) {
    const L = list(key); const live = isLive(key); const sent = UA() && UA().sentence ? UA().sentence : () => '';
    const places = UA() && UA().ownPlaces ? UA().ownPlaces(key).length : 0; let uaAll = []; try { uaAll = UA() ? UA().offers(key) : []; } catch (e) { uaAll = []; }
    const ws = (o) => (DY() && DY().watchersOf ? DY().watchersOf(uaAll, o) : []);
    const aRow = (o) => `<li class="ua-row"><div class="ua-main"><div class="ua-t"><b>${esc(o.name)}</b> ${U.sev(o.band)} ${o.state === 'applied' ? chip(live ? 'On' : 'Starts at go live', { tone: 'ok' }) : chip('Left out', { tone: 'muted' })}</div><div class="ua-w">${esc(o.upTag)} · when ${esc(sent(null, o))}, for ${esc(o.hold)} min</div>${whyHtml(o.why)}</div><div class="ua-acts">${btn('Edit', { act: 'ua:edit', data: { plant: key, pid: o.pid }, small: true })}${btn('Remove', { act: 'ua:own-remove', data: { plant: key, pid: o.pid }, small: true, kind: 'ghost' })}</div></li>`;
    const tRow = (t) => `<li class="ua-row"><div class="ua-main"><div class="ua-t"><b>${esc(t.name)}</b> ${chip(live ? 'Started' : 'Starts at go live', { tone: 'ok' })}</div><div class="ua-w">${esc(t.where)} · ${esc(t.everyText)} · ${esc(t.workLabel)}</div>${whyHtml(t.why)}</div><div class="ua-acts">${btn('Edit', { act: 'ow:task-open', data: { plant: key, id: t.id }, small: true })}${btn('Remove', { act: 'ow:task-remove', data: { plant: key, id: t.id }, small: true, kind: 'ghost' })}</div></li>`;
    const vRow = (o) => `<li class="ua-row"><div class="ua-main"><div class="ua-t"><b>${esc(o.def.name)}</b>${o.def.unit ? ` <span class="dy-u">in ${esc(o.def.unit)}</span>` : ''} ${ws(o).length ? chip(ws(o).length === 1 ? 'Watched by an alert' : `Watched by ${ws(o).length} alerts`, { tone: 'ok' }) : chip('Not used by anything yet', { tone: 'muted', title: 'It opens an issue only through an alert that watches it' })}</div><div class="ua-w dy-f">${esc(o.tag)} · = ${esc(DY().words(o.def, o))}${o.value != null ? ` <span class="dy-now" title="Worked out on the latest readings">${esc(o.value)}${o.def.unit ? ' ' + esc(o.def.unit) : ''} now</span>` : ''}</div>${ws(o).length ? `<div class="ua-s">Watched by ${ws(o).map((a) => `“${esc(a.name)}” ${U.sev(a.band)}`).join(', ')}</div>` : ''}${whyHtml(o.why)}</div><div class="ua-acts">${btn('Add an alert on this', { act: 'ua:own-open', data: { plant: key, subj: o.subjId, calc: o.def.id }, small: true, kind: ws(o).length ? 'secondary' : 'primary', title: 'Opens the alert form with this value already chosen. The alert is what opens an issue' })}${btn('Edit', { act: 'dy:own-open', data: { plant: key, pid: o.pid }, small: true })}${btn('Remove', { act: 'dy:own-remove', data: { plant: key, pid: o.pid }, small: true, kind: 'ghost' })}</div></li>`;
    const part = (title, lead, n, rows, add) => `<section class="ow-part"><header class="ow-h"><h4>${title}</h4><span class="ov-n">${n}</span><span class="ow-add">${add}</span></header><p class="ow-lead">${lead}</p>${rows ? `<ul class="ua-rows">${rows}</ul>` : '<p class="ov-none">None added here.</p>'}</section>`;
    const total = L.alerts.length + L.tasks.length + L.values.length;
    const line = total ? `Added at this plant and nowhere else: ${plural(L.alerts.length, 'alert')}, ${plural(L.tasks.length, 'task')}, ${plural(L.values.length, 'calculated value')}. The library is not changed.` : 'Nothing added yet. Add an alert, a task or a calculated value that this plant needs and the library does not have. The library is not changed.';
    const inner = part('Alerts', 'On one reading or several together, at a piece of equipment, a unit process, a control group or the whole plant. It may watch a calculated value added at the same place.', L.alerts.length, L.alerts.map(aRow).join(''), places ? btn('Add an alert', { act: 'ua:own-open', data: { plant: key }, small: true, kind: 'secondary' }) : '')
      + part('Tasks', 'On a piece of equipment or the whole plant, with how often it comes round.', L.tasks.length, L.tasks.map(tRow).join(''), btn('Add a task', { act: 'ow:task-open', data: { plant: key }, small: true, kind: 'secondary' }))
      + part('Calculated values', 'A formula over this plant\'s sensors, worked out on the latest readings, such as a difference, a ratio or a share. It opens an issue only through an alert that watches it: press "Add an alert on this" on its row.', L.values.length, L.values.map(vRow).join(''), places ? btn('Add a calculated value', { act: 'dy:own-open', data: { plant: key }, small: true, kind: 'secondary' }) : '');
    return `<details class="card p7-fold ow-card" id="ow-card"${OPEN ? ' open' : ''}><summary class="p7-fold-s"><span class="p7-fold-m"><span class="p7-fold-t">Added for this plant</span><span class="p7-fold-d">${esc(line)}</span></span></summary><div class="ow-body">${inner}</div></details>`;
  }
  W.V7OWN.card = card;
  if (U.afterRender) U.afterRender((main, path) => {
    try { if (!main) return; const m = /^p\/([^/]+)\/library$/.exec(String(path || location.hash).replace(/^#?\/?/, '').split('?')[0]); if (!m || main.querySelector('#ow-card')) return; const body = main.querySelector('.pg-main'); if (!body) return; body.insertAdjacentHTML('beforeend', card(decodeURIComponent(m[1]))); } catch (e) { /* the page still shows without it */ }
  });
})();
