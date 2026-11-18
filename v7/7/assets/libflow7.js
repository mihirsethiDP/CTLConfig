/* v7 · libflow7.js — which flow a problem or a task uses, chosen on the library type.
   A problem starts a diagnostic flow: the questions that lead to a root cause. A task follows a task flow: its steps.
   Until now the link came with the workbook and could only be read. A Global Admin now picks it where the problem or the task
   is listed, and every place that lists one says which flow it uses, or that it has none.

   window.V7LIBFLOW:
     flowOf(kind, code, key)   → the flow in use, or null.   kind: 'issue' (key = the problem's id) · 'task' (key = the task's name)
     options(kind, code)       → { near: flows written for this type, rest: the others }
     set(kind, code, key, flowId | null)   → { ok, changed, plants }
     missing(code)             → { tasks: [names], issues: [names], n }   what on the type has no flow yet
     slot(kind, code, key)     → the line shown next to a problem or a task: the flow, and the button that changes it
   The choice applies at once, as a change on the Flows page does: plants that follow the library follow it, open work keeps the
   flow it started with. Kept in the saved state (V7.S.lib.flowLinks) and put back when the prototype boots or the story is reset. */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const C = () => W.CTL;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const cat = (code) => (W.CATALOGUE_BY_CODE && W.CATALOGUE_BY_CODE[code]) || null;
  const sets = () => arr(C() && C().S && C().S.lib && C().S.lib.standardSets);
  const flows = () => arr(C() && C().S && C().S.lib ? C().S.lib.flows : (W.SEED || {}).flows);
  const flowById = (id) => (id ? flows().find((f) => f.id === id) || null : null);
  const isDiag = (f) => !!f && f.kind === 'diagnostic';
  const isTaskFlow = (f) => !!f && f.kind !== 'diagnostic' && f.use !== 'fix';
  const fits = (kind, f) => (kind === 'issue' ? isDiag(f) : isTaskFlow(f));
  const ORIG = {}; arr(W.ISSUES).forEach((i) => { ORIG[i.id] = i.flow || null; });      // the problems as shipped
  function links() { const L = V().S.lib; if (!L.flowLinks || typeof L.flowLinks !== 'object') L.flowLinks = { issue: {}, task: {} }; L.flowLinks.issue = L.flowLinks.issue || {}; L.flowLinks.task = L.flowLinks.task || {}; return L.flowLinks; }
  const schedOf = (type, name) => { const st = sets().find((x) => x.type === type); return st ? arr(st.schedules).find((x) => x.name === name) || null : null; };
  const issueOf = (id) => arr(W.ISSUES).find((i) => i.id === id) || null;
  const generalFlow = (x) => { const gt = x && x.task && C().taskById ? C().taskById(x.task) : null; return gt && gt.flow ? gt.flow : null; };

  function flowOf(kind, code, key) {
    if (kind === 'issue') { const i = issueOf(key); return i ? flowById(i.flow) : null; }
    const c = cat(code); const x = c ? schedOf(c.type, key) : null; return x ? flowById(x.flow || generalFlow(x)) : null;
  }
  function options(kind, code) {
    const c = cat(code); const all = flows().filter((f) => fits(kind, f) && f.name).sort((a, b) => a.name.localeCompare(b.name));
    const near = c ? all.filter((f) => arr(f.forTypes).includes(c.type)) : []; return { near, rest: all.filter((f) => !near.includes(f)) };
  }
  /* plants: a task that came from the library and still uses the library's flow follows the new one */
  function follow(type, name, was, to) {
    const P = (C() && C().S && C().S.plants) || {}; const hit = [];
    Object.keys(P).forEach((k) => {
      const d = P[k] && P[k].d; if (!d) return; let n = 0;
      arr(d.schedules).forEach((sc) => { if (sc.name !== name || !sc.subject || sc.subject.kind !== 'eq') return; const e = arr(d.equipment).find((q) => q.id === sc.subject.id); if (!e || e.type !== type || (sc.flow || null) !== was) return; if (to) sc.flow = to; else delete sc.flow; n++; });
      if (n) hit.push(k);
    });
    return hit;
  }
  function sync() {
    const L = links();
    arr(W.ISSUES).forEach((i) => { if (i.id in ORIG && !(i.id in L.issue)) i.flow = ORIG[i.id]; });
    Object.keys(L.issue).forEach((id) => { const i = issueOf(id); if (i) i.flow = L.issue[id] || null; });
    Object.keys(L.task).forEach((k) => { const at = k.indexOf('|'); const x = schedOf(k.slice(0, at), k.slice(at + 1)); if (!x) return; if (L.task[k]) x.flow = L.task[k]; else delete x.flow; });
    CACHE.stamp = null;
  }
  function set(kind, code, key, flowId) {
    const c = cat(code); if (!c) return { ok: false, error: 'No such type.' };
    const f = flowId ? flowById(flowId) : null; if (flowId && !f) return { ok: false, error: 'No such flow.' };
    if (f && !fits(kind, f)) return { ok: false, error: kind === 'issue' ? 'A problem starts a diagnostic flow. Choose one of those.' : 'A task follows a task flow. Choose one of those.' };
    const v = V(); const L = links(); let text; let plants = [];
    if (kind === 'issue') {
      const i = issueOf(key); if (!i || !arr(i.homeTypes).includes(c.type)) return { ok: false, error: `${c.type} does not have that problem.` };
      const was = flowById(i.flow); if ((was ? was.id : null) === (f ? f.id : null)) return { ok: true, changed: false, plants };
      i.flow = f ? f.id : null; L.issue[i.id] = i.flow;
      text = `The problem "${i.name}" ${f ? `now starts the diagnostic flow ${f.name}` : 'starts no diagnostic flow any more'}${was ? ` (was ${was.name})` : ''}`;
    } else if (kind === 'task') {
      const x = schedOf(c.type, key); if (!x) return { ok: false, error: `${c.type} does not have that task.` };
      const was = flowById(x.flow || generalFlow(x)); if ((was ? was.id : null) === (f ? f.id : null)) return { ok: true, changed: false, plants };
      if (!f && generalFlow(x)) return { ok: false, error: 'This task comes from the workbook with its steps. Choose another flow instead of none.' };
      const old = x.flow || null; if (f) x.flow = f.id; else delete x.flow; L.task[`${c.type}|${x.name}`] = f ? f.id : null;
      plants = follow(c.type, x.name, old, f ? f.id : null);
      text = `${c.type}: the task "${x.name}" ${f ? `now follows the flow ${f.name}` : 'has no flow any more'}${was ? ` (was ${was.name})` : ''}`;
    } else return { ok: false, error: 'Choose a problem or a task.' };
    CACHE.stamp = null; v.touch(); v.log(null, text, 'library'); plants.forEach((k) => v.log(k, `Library: ${text}`, 'library')); v.persist();
    return { ok: true, changed: true, plants };
  }
  /* what on a type has no flow yet. Counted once per saved state: the library list asks for every type */
  const CACHE = { stamp: null, by: {} };
  function missing(code) {
    const stamp = String(W.CTL_STAMP || '') + ':' + flows().length; if (CACHE.stamp !== stamp) { CACHE.stamp = stamp; CACHE.by = {}; }
    if (CACHE.by[code]) return CACHE.by[code];
    let lt = null; try { lt = V().libType(code); } catch (e) { lt = null; }
    const tasks = lt ? arr(lt.schedules).filter((x) => !flowOf('task', code, x.name)).map((x) => x.name) : [];
    const issues = lt ? arr(lt.issues).filter((i) => !flowOf('issue', code, i.id)).map((i) => i.name) : [];
    return (CACHE.by[code] = { tasks, issues, n: tasks.length + issues.length });
  }
  W.V7LIBFLOW = { flowOf, options, set, missing, sync, slot: () => '' };
  (function hook() {
    const v = V(); if (!v) return; const wrap = (o, fn) => { const f0 = o && o[fn]; if (typeof f0 !== 'function') return; o[fn] = function () { const r = f0.apply(this, arguments); try { sync(); } catch (e) { /* the library stays as shipped */ } return r; }; };
    wrap(v, 'boot'); wrap(v, 'reset'); wrap(W.V7LIBADD, 'sync');
  })();

  /* ── on the page ───────────────────────────────────────────────────────────────────────────────────────── */
  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const enc = encodeURIComponent;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const NOUN = { issue: 'question', task: 'step' };
  const NONE = { issue: 'No diagnostic flow: the person says what they found', task: 'No flow: the person marks it done' };
  function slot(kind, code, key, o) {
    const f = flowOf(kind, code, key); const data = { kind, code, key };
    if (f) return `<span class="lf">${o && o.bare ? '' : `<span class="lf-k">${kind === 'issue' ? 'Starts' : 'Follows'}</span>`}<button type="button" class="lf-n lf-view" data-act="lf:view" data-id="${esc(f.id)}" title="See its ${NOUN[kind]}s here">${esc(f.name)}</button><span class="lf-c">${esc(plural(arr(f.steps).length, NOUN[kind]))}</span>${btn('Change', { act: 'lf:open', data, small: true, kind: 'ghost', title: 'Choose another flow' })}</span>`;
    return `<span class="lf is-none"><span class="lf-0">${esc(NONE[kind])}</span>${btn('Choose a flow', { act: 'lf:open', data, small: true, kind: 'secondary', title: kind === 'issue' ? 'The questions that lead to a root cause' : 'The steps of this task' })}</span>`;
  }
  W.V7LIBFLOW.slot = slot;
  function preview(kind, id) {
    const f = flowById(id); if (!f) return `<p class="lf-p0">${esc(NONE[kind])}.</p>`;
    const st = arr(f.steps); return `<p class="lf-pk">${esc(plural(st.length, NOUN[kind]))}</p>${st.length ? `<ol class="lf-ps">${st.map((s) => `<li>${esc(s.text || '')}</li>`).join('')}</ol>` : '<p class="lf-p0">Nothing written in it yet.</p>'}`;
  }
  function open(kind, code, key) {
    const c = cat(code); if (!c) return; const item = kind === 'issue' ? issueOf(key) : schedOf(c.type, key); if (!item) return;
    const cur = flowOf(kind, code, key); const o = options(kind, code); const op = (f) => `<option value="${esc(f.id)}"${cur && cur.id === f.id ? ' selected' : ''}>${esc(f.name)}</option>`;
    const canNone = kind === 'issue' || !generalFlow(item);
    const others = kind === 'issue' ? arr(item.homeTypes).filter((t) => t !== c.type) : [];
    const reach = kind === 'issue'
      ? `Applies at once at every plant: issues opened from now on start it. Open issues keep the flow they started with.${others.length ? ` The same problem is listed for ${esc(others.slice(0, 3).join(', '))}${others.length > 3 ? ` and ${others.length - 3} more` : ''}, and follows there too.` : ''}`
      : 'Applies at once at every plant that follows the library for this task. A task already started keeps its steps.';
    U.modal({
      title: `Flow for “${item.name}”`,
      body: U.field({ label: kind === 'issue' ? 'Diagnostic flow it starts' : 'Flow it follows', hint: kind === 'issue' ? 'The questions that lead a person to the root cause.' : 'The steps a person works through.', html: `<select id="lf-sel">${canNone ? '<option value="">None</option>' : ''}${o.near.length ? `<optgroup label="Written for ${esc(c.type)}">${o.near.map(op).join('')}</optgroup>` : ''}<optgroup label="${o.near.length ? 'Other flows' : 'Flows'}">${o.rest.map(op).join('')}</optgroup></select>` })
        + `<div class="lf-prev" id="lf-prev">${preview(kind, cur ? cur.id : (canNone ? '' : (o.near[0] || o.rest[0] || {}).id))}</div>`
        + `<p class="la-n lf-reach">${reach}</p><p class="lf-new">None of these fits? ${btn(kind === 'issue' ? 'Write a new diagnostic flow' : 'Write a new flow', { act: 'lf:new', data: { kind, code, key }, small: true, kind: 'secondary', title: 'Write it here; once saved it is chosen for this ' + (kind === 'issue' ? 'problem' : 'task') })}</p>`,
      foot: btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + btn('Save', { act: 'lf:save', data: { kind, code, key }, kind: 'primary' }),
    });
    const sel = document.getElementById('lf-sel'); const box = document.getElementById('lf-prev'); if (sel && box) sel.addEventListener('change', () => { box.innerHTML = preview(kind, sel.value); });
  }
  /* the quick view: what a plant inherits, read in place. Nothing in the library leaves for the Flows page */
  const STEP = { instruction: 'Do this', question: 'Ask yes or no', reading: 'Record a reading', wait: 'Wait' };
  const USE = { diagnostic: 'Diagnostic flow', fix: 'Fix flow', pm: 'Preventive maintenance flow', round: 'Routine check flow', calibration: 'Calibration flow', test: 'Manual testing flow' };
  const chip = U.chip; const STACK = [];
  function stepsHtml(f) {
    const st = arr(f.steps); if (!st.length) return '<p class="lf-p0">Nothing is written in it yet, so the person says what they found or marks the work done.</p>';
    const no = (id) => { const i = st.findIndex((x) => String(x.id) === String(id)); return i < 0 ? null : i + 1; };
    if (isDiag(f)) return `<ol class="fl-qs">${st.map((q, i) => `<li class="fl-q"><div class="fl-q-t"><span class="fl-n">${i + 1}</span><span>${esc(q.text || '')}</span></div><div class="fl-as">${Object.entries(q.answers || {}).map(([k, a]) => {
      let out;
      if (!a || a.t === 'open') out = '<span class="fl-out fl-open">Ends here: the person says what they found</span>';
      else if (a.t === 'step') out = no(a.id) ? `<span class="fl-out fl-next">Question ${no(a.id)}</span>` : '<span class="fl-out fl-bad">A question that was removed</span>';
      else { let c = null; let fx = null; try { c = V().causeOf(a.id); fx = c ? V().fixFlowFor(c.id) : null; } catch (e) { c = null; } out = `<span class="fl-out fl-cause"><b>Root cause</b> ${esc(c ? c.name : 'not found')}</span>${fx ? `<button type="button" class="fl-fix lf-view" data-act="lf:view" data-id="${esc(fx.id)}" data-from="${esc(f.id)}">Fix: ${esc(fx.name)} →</button>` : '<span class="fl-fix muted">No fix flow yet</span>'}`; }
      return `<div class="fl-a"><span class="fl-ak">${esc(k)}</span><span class="fl-arrow" aria-hidden="true">→</span>${out}</div>`;
    }).join('')}</div></li>`).join('')}</ol>`;
    return `<ol class="fl-steps">${st.map((x, i) => `<li class="fl-s"><span class="fl-n">${i + 1}</span><div><div>${esc(x.text || '')}</div><div class="fl-meta">${chip(STEP[x.type] || 'Step', { tone: 'muted' })}${x.photo ? chip(x.photo === 'required' ? 'Photo required' : 'Photo optional', { tone: 'muted' }) : ''}${x.sensorKind ? chip(`Reads ${x.sensorKind}`, { tone: 'muted' }) : ''}${x.link && x.link.kind === 'task' ? chip('Opens a task', { tone: 'info' }) : ''}</div></div></li>`).join('')}</ol>`;
  }
  function view(id, from) {
    const f = flowById(id); if (!f) { U.toast('That flow is not in the library any more.'); return; }
    if (from === true) { /* going back: the stack is already right */ } else if (from) STACK.push(from); else STACK.length = 0;
    const n = arr(f.steps).length; const diag = isDiag(f); const back = STACK.length ? flowById(STACK[STACK.length - 1]) : null;
    U.openSheet({ title: f.name, sub: `${USE[diag ? 'diagnostic' : f.use] || 'Flow'} · ${plural(n, diag ? 'question' : 'step')}${arr(f.forTypes).length ? ` · for ${arr(f.forTypes).slice(0, 3).join(', ')}${arr(f.forTypes).length > 3 ? ' and more' : ''}` : ''}`,
      body: `<p class="lf-qv-n">${diag ? 'What a person is asked when the issue opens, one question at a time, until an answer lands on a root cause and its fix.' : 'What a person works through in the app, in this order.'} Every plant that follows the library gets it as it is here.</p>${stepsHtml(f)}`,
      foot: (back ? btn(`Back to ${back.name}`, { act: 'lf:view-back', kind: 'ghost' }) : '') + btn('Close', { act: 'ui:close', data: { what: 'sheet' }, kind: 'ghost' }) + btn('Edit', { act: 'lf:edit', data: { id: f.id }, kind: 'secondary', title: diag ? 'Change its questions, here' : 'Change its steps, here' }) });
  }
  W.V7LIBFLOW.view = view;
  U.on('lf:view', (el) => { view(el.getAttribute('data-id'), el.getAttribute('data-from')); return false; });
  U.on('lf:view-back', () => { const id = STACK.pop(); if (id) view(id, true); return false; });
  /* writing and editing a flow without leaving the library: the Flows page's own editor, in the side panel */
  let EDIT = null;          // { id, isNew, attach: { kind, code, key } | null }
  const FL = () => W.V7FLOWS || null;
  function editParts() {
    const d = FL()._draft(); const f = d.flow; const pr = FL().problems(f); const diag = isDiag(f);
    const probs = pr.length ? `<div class="lf-todo"><b>${plural(pr.length, 'thing')} to finish:</b><ul>${pr.slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const lead = EDIT.attach ? `<p class="lf-qv-n">Once saved it is chosen for “${esc(EDIT.attach.name)}” straight away.</p>` : EDIT.isNew ? '' : '<p class="lf-qv-n">Everything that uses this flow follows it once saved, at every plant.</p>';
    return { title: EDIT.isNew ? (diag ? 'New diagnostic flow' : 'New flow') : `Edit: ${f.name || 'flow'}`, sub: diag ? 'Questions that lead to a root cause and its fix' : 'The steps a person works through', wide: true,
      body: `<div class="lf-edit">${lead}${FL().editHtml(f)}${probs}</div>`,
      foot: btn('Cancel', { act: 'lf:edit-cancel', kind: 'ghost' }) + btn(EDIT.isNew ? 'Save the flow' : 'Save changes', { act: 'fl:save', kind: 'primary' }),
      onClose: () => { if (EDIT) { EDIT = null; try { FL().discard(); } catch (e) { /* nothing to discard */ } } } };
  }
  function startEdit(id, attach) {
    const F = FL(); if (!F || !F.edit) { U.toast('The flow editor is not loaded.'); return; }
    if (!F.edit(id)) { U.toast('That flow is not in the library any more.'); return; }
    EDIT = { id, isNew: false, attach: attach || null }; U.openSheet(editParts());
  }
  function startNew(kind, forTypes, attach) {
    const F = FL(); if (!F || !F.begin) { U.toast('The flow editor is not loaded.'); return; }
    const id = F.begin(kind, forTypes); EDIT = { id, isNew: true, attach: attach || null }; U.openSheet(editParts());
  }
  W.V7LIBFLOW.editFlow = startEdit; W.V7LIBFLOW.newFlow = startNew;
  U.on('lf:edit', (el) => { startEdit(el.getAttribute('data-id')); return false; });
  U.on('lf:new', (el) => {
    const kind = el.getAttribute('data-kind'); const code = el.getAttribute('data-code'); const key = el.getAttribute('data-key'); const c = cat(code); if (!c) return false;
    const item = kind === 'issue' ? issueOf(key) : schedOf(c.type, key); U.closeModal(true);
    startNew(kind === 'issue' ? 'diagnostic' : 'task', [c.type], item ? { kind, code, key, name: item.name } : null); return false;
  });
  U.on('lf:edit-cancel', () => { const e = EDIT; EDIT = null; try { FL().discard(); } catch (x) { /* nothing to discard */ } U.closeSheet(true); if (e && !e.isNew && flowById(e.id)) view(e.id); return undefined; });
  if (U.afterRender) U.afterRender(() => {
    if (!EDIT) return; const d = FL() && FL()._draft();
    if (d && d.id === EDIT.id) { if (U.sheetEl()) U.refreshSheet(editParts()); else U.openSheet(editParts()); return; }
    const e = EDIT; EDIT = null; const f = flowById(e.id);           /* the draft is gone: saved, or dropped elsewhere */
    if (!f || !f.name || f.status !== 'published') { U.closeSheet(true); return; }
    if (e.attach) { const r = set(e.attach.kind, e.attach.code, e.attach.key, f.id); if (r.ok) U.toast(`Saved, and chosen for “${e.attach.name}”.`); else U.toast(r.error); }
    view(f.id); if (e.attach) U.render();
  });
  /* any link to one flow, clicked while in the library, opens here instead of leaving for the Flows page */
  document.addEventListener('click', (ev) => {
    if (ev.defaultPrevented || ev.button || !/^#\/library(\/|\?|$)/.test(location.hash || '')) return;
    const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null; const m = a ? /^#\/flows\/([^/?#]+)$/.exec(a.getAttribute('href') || '') : null; if (!m) return;
    ev.preventDefault(); ev.stopPropagation(); view(decodeURIComponent(m[1]));
  }, true);
  U.on('lf:open', (el) => { open(el.getAttribute('data-kind'), el.getAttribute('data-code'), el.getAttribute('data-key')); return false; });
  U.on('lf:save', (el) => {
    const sel = document.getElementById('lf-sel'); const kind = el.getAttribute('data-kind');
    const r = set(kind, el.getAttribute('data-code'), el.getAttribute('data-key'), sel ? sel.value || null : null);
    if (!r.ok) { U.toast(r.error); return false; }
    U.closeModal(true); U.toast(!r.changed ? 'Nothing changed.' : kind === 'issue' ? 'Saved. Issues opened from now on start it.' : `Saved.${r.plants.length ? ` ${plural(r.plants.length, 'plant')} follow${r.plants.length === 1 ? 's' : ''} it.` : ''}`); return undefined;
  });
})();
