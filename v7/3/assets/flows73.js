/* v7/3 · flows73.js — Flows and Diagnostic flows: see them, try them, and set them up.
   Two kinds, in plain words:
   - a Diagnostic flow finds the root cause of an issue by asking questions; each answer leads to the next question or to a
     root cause, and each root cause names the fix flow that puts it right;
   - a Flow is the ordered steps of a job: a fix, a routine round, preventive maintenance, a calibration or a manual test.
   Routes: #/flows (the two lists) · #/flows/:id (one flow: its steps, "Try it", and Edit).
   Edits are a draft kept in memory until "Save changes"; saving writes the library's flow (and any root cause changed with
   it), adds an Activity line and persists. Every issue and task that uses the flow follows it from then on.
   ACTIONS (V7UI.on): fl:search fl:new fl:edit fl:set fl:add fl:del fl:move fl:ans fl:cause fl:save fl:discard fl:try fl:retry */
(function () {
  'use strict';
  const W = window; const UI = W.V7UI; if (!UI) return;
  const V = () => W.V7; const C = () => W.CTL;
  const { esc, card, btn, chip, filters, note, empty, plural } = UI;
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = encodeURIComponent;
  const lib = () => (C() && C().S && C().S.lib) || { flows: (W.SEED && W.SEED.flows) || [], causes: (W.SEED && W.SEED.causes) || [] };
  const flows = () => arr(lib().flows); const causes = () => arr(lib().causes);
  const flowById = (id) => flows().find((f) => f.id === id) || null;
  const causeById = (id) => (DRAFT && DRAFT.causes[id]) || causes().find((c) => c.id === id) || null;
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const USE = { diagnostic: 'Diagnostic', fix: 'Fix', pm: 'Preventive maintenance', round: 'Routine round', calibration: 'Calibration', test: 'Manual test' };
  const STEP = { instruction: 'Do this', question: 'Ask yes or no', reading: 'Record a reading', wait: 'Wait' };
  const isDiag = (f) => f && f.kind === 'diagnostic';

  let DRAFT = null;          // {id, flow, causes:{id:cause}, isNew}
  let TRY = null;            // {id, path:[{q, a}], at:{t:'step'|'cause'|'open'|'end', id}}
  const SEARCH = { q: '', all: false };

  /* ── what uses a flow ─────────────────────────────────────────────────────────────────────────────── */
  function usedBy(f) {
    if (isDiag(f)) {
      const iss = arr(W.ISSUES).filter((i) => i.flow === f.id).map((i) => i.name);
      const al = []; arr(lib().standardSets || (W.SEED && W.SEED.standardSets)).forEach((s) => arr(s.alerts).forEach((a) => { if (a.flow === f.id) al.push(`${a.name} on ${s.type}`); }));
      return { n: iss.length + al.length, lines: iss.map((x) => `Issue: ${x}`).concat(al.map((x) => `Alert: ${x}`)) };
    }
    const cs = causes().filter((c) => c.fix === f.id).map((c) => `Root cause: ${c.name}`);
    const ts = arr(W.ISSUE_TASKS).filter((t) => t.flow === f.id).map((t) => `Task: ${t.name}`);
    return { n: cs.length + ts.length, lines: cs.concat(ts) };
  }
  const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  /* ── the list ─────────────────────────────────────────────────────────────────────────────────────── */
  function listPage(params) {
    const q = (params && params._q) || {}; const kind = ['diagnostic', 'fix', 'task'].includes(q.kind) ? q.kind : 'diagnostic';
    const all = flows(); const inKind = (f, k) => (k === 'diagnostic' ? isDiag(f) : k === 'fix' ? f.use === 'fix' : !isDiag(f) && f.use !== 'fix');
    const s = SEARCH.q.trim().toLowerCase();
    const rows0 = all.filter((f) => inKind(f, kind) && (!s || `${f.name} ${arr(f.forTypes).join(' ')}`.toLowerCase().includes(s)));
    if (SEARCH.inc && W.V7FLAG73) rows0.splice(0, rows0.length, ...rows0.filter((f) => W.V7FLAG73.flow(f).length));
    const rows = SEARCH.all || s || SEARCH.inc ? rows0 : rows0.slice(0, 40);
    const tabs = filters([
      { label: 'Diagnostic flows', href: '#/flows?kind=diagnostic', on: kind === 'diagnostic', count: all.filter((f) => inKind(f, 'diagnostic')).length },
      { label: 'Fix flows', href: '#/flows?kind=fix', on: kind === 'fix', count: all.filter((f) => inKind(f, 'fix')).length },
      { label: 'Task flows', href: '#/flows?kind=task', on: kind === 'task', count: all.filter((f) => inKind(f, 'task')).length },
    ]);
    const what = kind === 'diagnostic' ? 'A diagnostic flow asks questions until it lands on a root cause. The root cause names the fix flow that puts it right.'
      : kind === 'fix' ? 'A fix flow is the steps that put one root cause right. A diagnostic flow sends people here.'
        : 'A task flow is the steps of a routine round, preventive maintenance, a calibration or a manual test.';
    const how = `<ol class="fl-how"><li><b>An issue opens</b><span>from an alert, or someone reports a problem</span></li><li><b>Diagnostic flow</b><span>questions, one at a time</span></li><li><b>Root cause</b><span>where the questions land</span></li><li><b>Fix flow</b><span>the steps that put it right</span></li></ol>`;
    const nInc = W.V7FLAG73 ? all.filter((f) => inKind(f, kind) && W.V7FLAG73.flow(f).length).length : 0;
    const incBtn = nInc ? btn(SEARCH.inc ? 'Show all' : `Show the ${nInc} incomplete`, { act: 'fl:search', data: { inc: SEARCH.inc ? '0' : '1' }, small: true, kind: SEARCH.inc ? 'secondary' : 'ghost' }) : '';
    const search = `<input type="search" class="fl-search" placeholder="Search by name or equipment type" aria-label="Search flows" value="${esc(SEARCH.q)}" data-act="fl:search" data-live>`;
    const table = rows.length ? UI.table({
      cols: [{ label: 'Flow', key: 'name' }, { label: 'For', key: 'for' }, { label: kind === 'diagnostic' ? 'Questions' : 'Steps', key: 'n', cls: 'nowrap' }, { label: 'Used by', key: 'used' }],
      rows: rows.map((f) => { const u = usedBy(f); return { _href: `#/flows/${enc(f.id)}`, name: `<a href="#/flows/${esc(enc(f.id))}">${esc(f.name)}</a> ${W.V7FLAG73 ? W.V7FLAG73.chip(W.V7FLAG73.flow(f), { small: true }) : ''}${isDiag(f) ? '' : `<div class="muted small">${esc(USE[f.use] || 'Flow')}</div>`}`, for: esc(short(arr(f.forTypes).join(', ') || 'Any equipment', 60)), n: String(arr(f.steps).length), used: u.n ? `<span title="${esc(u.lines.slice(0, 12).join('\n'))}">${esc(short(u.lines[0], 54))}${u.n > 1 ? ` <span class="muted">+${u.n - 1}</span>` : ''}</span>` : '<span class="muted">Not used yet</span>' }; }),
    }) : empty('No flow matches.');
    const more = !SEARCH.all && !s && rows0.length > rows.length ? `<p class="fl-more">${btn(`Show all ${rows0.length}`, { act: 'fl:search', data: { all: '1' }, small: true, kind: 'ghost' })}</p>` : '';
    return UI.page({
      title: 'Flows', sub: 'The questions that find a root cause, and the steps that put it right. Open one to see it, try it, or change it.',
      body: how + tabs + card({ title: kind === 'diagnostic' ? 'Diagnostic flows' : kind === 'fix' ? 'Fix flows' : 'Task flows', sub: what, body: `<div class="fl-bar">${search}${incBtn}</div>${table}${more}`, actions: [btn(kind === 'diagnostic' ? 'New diagnostic flow' : 'New flow', { act: 'fl:new', data: { kind }, kind: 'primary' })] }),
      cls: 'pg-flows',
    });
  }

  /* ── one flow: read ───────────────────────────────────────────────────────────────────────────────── */
  const stepNo = (f, id) => { const i = arr(f.steps).findIndex((s) => String(s.id) === String(id)); return i < 0 ? null : i + 1; };
  function outcomeHtml(f, a) {
    if (!a || a.t === 'open') return '<span class="fl-out fl-open">Not known yet</span>';
    if (a.t === 'step') { const n = stepNo(f, a.id); return n ? `<span class="fl-out fl-next">Question ${n}</span>` : '<span class="fl-out fl-bad">A question that was removed</span>'; }
    const c = causeById(a.id); const fx = c && c.fix ? flowById(c.fix) : null;
    return `<span class="fl-out fl-cause"><b>Root cause</b> ${esc(c ? c.name : 'not found')}</span>${fx ? `<a class="fl-fix" href="#/flows/${esc(enc(fx.id))}">Fix: ${esc(fx.name)} →</a>` : '<span class="fl-fix muted">No fix flow yet</span>'}`;
  }
  function problems(f) {
    const out = []; const steps = arr(f.steps);
    if (!steps.length) { out.push('It has no steps yet.'); return out; }
    if (!isDiag(f)) { steps.forEach((s, i) => { if (!String(s.text || '').trim()) out.push(`Step ${i + 1} has no text.`); }); return out; }
    const reach = new Set([String(steps[0].id)]); let grew = true;
    while (grew) { grew = false; steps.forEach((s) => { if (!reach.has(String(s.id))) return; Object.values(s.answers || {}).forEach((a) => { if (a && a.t === 'step' && !reach.has(String(a.id)) && stepNo(f, a.id)) { reach.add(String(a.id)); grew = true; } }); }); }
    steps.forEach((s, i) => {
      if (!String(s.text || '').trim()) out.push(`Question ${i + 1} has no text.`);
      if (!reach.has(String(s.id))) out.push(`Question ${i + 1} is never reached: no answer leads to it.`);
      Object.entries(s.answers || {}).forEach(([k, a]) => { if (!a || a.t === 'open') out.push(`Question ${i + 1}, "${k}": not known yet.`); else if (a.t === 'step' && !stepNo(f, a.id)) out.push(`Question ${i + 1}, "${k}" leads to a question that was removed.`); else if (a.t === 'cause' && !causeById(a.id)) out.push(`Question ${i + 1}, "${k}" names a root cause that is not in the library.`); });
    });
    return out;
  }
  function readSteps(f) {
    const steps = arr(f.steps);
    if (!steps.length) return empty('No steps yet. Choose Edit to add the first one.');
    if (isDiag(f)) return `<ol class="fl-qs">${steps.map((s, i) => `<li class="fl-q"><div class="fl-q-t"><span class="fl-n">${i + 1}</span><span>${esc(s.text || '')}</span></div><div class="fl-as">${Object.entries(s.answers || {}).map(([k, a]) => `<div class="fl-a"><span class="fl-ak">${esc(k)}</span><span class="fl-arrow" aria-hidden="true">→</span>${outcomeHtml(f, a)}</div>`).join('')}</div></li>`).join('')}</ol>`;
    return `<ol class="fl-steps">${steps.map((s, i) => `<li class="fl-s"><span class="fl-n">${i + 1}</span><div><div>${esc(s.text || '')}</div><div class="fl-meta">${chip(STEP[s.type] || 'Step', { tone: 'muted' })}${s.photo ? chip(s.photo === 'required' ? 'Photo required' : 'Photo optional', { tone: 'muted' }) : ''}${s.sensorKind ? chip(`Reads ${s.sensorKind}`, { tone: 'muted' }) : ''}${s.link && s.link.kind === 'task' ? chip('Opens a task', { tone: 'info' }) : ''}</div></div></li>`).join('')}</ol>`;
  }
  /* "Try it": walk a diagnostic flow by answering */
  function tryHtml(f) {
    const steps = arr(f.steps); if (!isDiag(f) || !steps.length) return '';
    if (!TRY || TRY.id !== f.id) TRY = { id: f.id, path: [], at: { t: 'step', id: steps[0].id } };
    const trail = TRY.path.length ? `<ol class="fl-trail">${TRY.path.map((p) => `<li>${esc(p.q)} <b>${esc(p.a)}</b></li>`).join('')}</ol>` : '';
    let now;
    if (TRY.at.t === 'step') {
      const s = steps.find((x) => String(x.id) === String(TRY.at.id));
      now = s ? `<p class="fl-ask">${esc(s.text || '')}</p><div class="fl-btns">${Object.keys(s.answers || {}).map((k) => btn(k, { act: 'fl:try', data: { id: f.id, step: s.id, ans: k }, kind: 'secondary' })).join('')}</div>` : '<p class="muted">That question was removed.</p>';
    } else if (TRY.at.t === 'cause') {
      const c = causeById(TRY.at.id); const fx = c && c.fix ? flowById(c.fix) : null;
      now = `<div class="fl-land"><span class="fl-land-k">Root cause</span><b>${esc(c ? c.name : 'not found')}</b>${fx ? `<a href="#/flows/${esc(enc(fx.id))}">Next: ${esc(fx.name)} →</a>` : '<span class="muted">No fix flow yet</span>'}</div>`;
    } else now = '<div class="fl-land"><span class="fl-land-k">Not known yet</span><b>This answer leads nowhere yet.</b><span class="muted">The person is asked to say what they found.</span></div>';
    return card({ title: 'Try it', sub: 'Answer as an operator would. Nothing is saved.', body: trail + now, actions: TRY.path.length ? [btn('Start again', { act: 'fl:retry', data: { id: f.id }, small: true, kind: 'ghost' })] : [], cls: 'fl-try' });
  }
  function flowPage(params) {
    const id = params.id; const editing = DRAFT && DRAFT.id === id; const f = editing ? DRAFT.flow : flowById(id);
    if (!f) return UI.page({ crumbs: [{ label: 'Flows', href: '#/flows' }, { label: 'Not found' }], title: 'No such flow', body: empty('This flow is not in the library.', btn('All flows', { href: '#/flows' })) });
    const u = usedBy(f); const pr = problems(f);
    const kindWord = isDiag(f) ? 'Diagnostic flow' : `${USE[f.use] || 'Task'} flow`;
    const usedCard = card({ title: 'Used by', body: u.n ? `<ul class="fl-used">${u.lines.slice(0, 8).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${u.n > 8 ? `<p class="muted small">and ${u.n - 8} more</p>` : ''}` : '<p class="muted">Nothing uses it yet.</p>', tone: 'quiet' });
    const probs = pr.length ? note(`<b>${plural(pr.length, 'thing')} to finish:</b><ul class="fl-probs">${pr.slice(0, 6).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${pr.length > 6 ? `<p class="small">and ${pr.length - 6} more</p>` : ''}`, 'warn') : '';
    const body = editing
      ? `${editHtml(f)}${probs}<div class="fl-savebar">${btn('Save changes', { act: 'fl:save', kind: 'primary' })}${btn('Discard', { act: 'fl:discard', kind: 'ghost' })}<span class="muted small">Everything that uses this flow follows it once saved.</span></div>`
      : `${W.V7HELP73 ? W.V7HELP73.flow(f, u) : ''}<div class="fl-cols"><div>${card({ title: isDiag(f) ? plural(arr(f.steps).length, 'question') : plural(arr(f.steps).length, 'step'), sub: isDiag(f) ? 'Asked one at a time. Each answer leads to the next question or to a root cause.' : 'Done in this order.', body: readSteps(f), actions: [btn('Edit', { act: 'fl:edit', data: { id: f.id }, kind: 'primary' })] })}${probs}</div><div>${tryHtml(f)}${usedCard}</div></div>`;
    return UI.page({
      crumbs: [{ label: 'Flows', href: `#/flows?kind=${isDiag(f) ? 'diagnostic' : f.use === 'fix' ? 'fix' : 'task'}` }, { label: f.name || 'New flow' }],
      title: f.name || 'New flow', chips: [W.V7FLAG73 ? W.V7FLAG73.chip(W.V7FLAG73.flow(f)) : '', chip(kindWord, { tone: 'muted' }), editing ? chip('Editing: not saved yet', { tone: 'warn' }) : chip(`Version ${f.version || 1}`, { tone: 'muted' })],
      sub: `For ${arr(f.forTypes).join(', ') || 'any equipment'}`, body, cls: 'pg-flows pg-flow',
    });
  }

  /* ── one flow: edit ───────────────────────────────────────────────────────────────────────────────── */
  const inp = (step, f, value, o) => `<input type="text" data-act="fl:set" data-step="${esc(step)}" data-f="${esc(f)}" value="${esc(value == null ? '' : value)}" placeholder="${esc((o && o.ph) || '')}" aria-label="${esc((o && o.label) || f)}"${o && o.cls ? ` class="${o.cls}"` : ''}>`;
  const sel = (attrs, opts, cur) => `<select ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const rowBtns = (i, n, sid) => `<span class="fl-rb">${btn('↑', { act: 'fl:move', data: { step: sid, by: '-1' }, small: true, kind: 'ghost', title: 'Move up', disabled: i === 0 })}${btn('↓', { act: 'fl:move', data: { step: sid, by: '1' }, small: true, kind: 'ghost', title: 'Move down', disabled: i === n - 1 })}${btn('Remove', { act: 'fl:del', data: { step: sid }, small: true, kind: 'ghost' })}</span>`;
  function causeOptions(f) {
    const types = arr(f.forTypes); const inFlow = new Set(arr(f.steps).flatMap((s) => Object.values(s.answers || {}).filter((a) => a && a.t === 'cause').map((a) => a.id)));
    const all = causes().concat(Object.values(DRAFT ? DRAFT.causes : {}).filter((c) => !causes().some((x) => x.id === c.id)));
    const near = all.filter((c) => inFlow.has(c.id) || arr(c.types).some((t) => types.includes(t)));
    return (near.length ? near : all).map((c) => [c.id, short((DRAFT && DRAFT.causes[c.id] ? DRAFT.causes[c.id] : c).name, 80)]);
  }
  function answerEdit(f, s, k) {
    const a = (s.answers || {})[k] || { t: 'open' }; const steps = arr(f.steps);
    const to = a.t === 'step' ? `step:${a.id}` : a.t === 'cause' ? 'cause' : 'open';
    const opts = steps.filter((x) => x.id !== s.id).map((x) => [`step:${x.id}`, `Go to question ${stepNo(f, x.id)}: ${short(x.text || 'no text yet', 44)}`]).concat([['cause', 'Land on a root cause'], ['open', 'Not known yet']]);
    let extra = '';
    if (a.t === 'cause') {
      const c = causeById(a.id); const fixes = flows().filter((x) => x.use === 'fix'); const types = arr(f.forTypes);
      const nearFix = fixes.filter((x) => (c && x.id === c.fix) || arr(x.forTypes).some((t) => types.includes(t)));
      extra = `<div class="fl-ce">${sel(`data-act="fl:cause" data-step="${esc(s.id)}" data-ans="${esc(k)}" data-f="pick" aria-label="Root cause"`, causeOptions(f).concat([['__new', '＋ A new root cause…']]), a.id)}`
        + (c ? `<input type="text" data-act="fl:cause" data-cause="${esc(c.id)}" data-f="name" value="${esc(c.name)}" aria-label="Root cause name">`
          + sel(`data-act="fl:cause" data-cause="${esc(c.id)}" data-f="fix" aria-label="Fix flow"`, [['', 'No fix flow yet']].concat((nearFix.length ? nearFix : fixes).map((x) => [x.id, `Fix: ${short(x.name, 60)}`])), c.fix || '') : '') + '</div>';
    }
    return `<div class="fl-ae"><span class="fl-ak">If ${esc(k)}</span>${sel(`data-act="fl:ans" data-step="${esc(s.id)}" data-ans="${esc(k)}" aria-label="If ${esc(k)}"`, opts, to)}${extra}</div>`;
  }
  function editHtml(f) {
    const steps = arr(f.steps); const n = steps.length;
    const meta = card({ title: 'About this flow', body: `<div class="fl-meta-e"><label>Name<input type="text" data-act="fl:set" data-f="name" value="${esc(f.name || '')}" placeholder="${isDiag(f) ? 'For example: Low DO diagnostic' : 'For example: Clean the intake filter'}"></label><label>For which equipment types <span class="muted">(comma separated)</span><input type="text" data-act="fl:set" data-f="forTypes" value="${esc(arr(f.forTypes).join(', '))}" placeholder="Blower, Mini Blower"></label>${isDiag(f) ? '' : `<label>What it is${sel('data-act="fl:set" data-f="use"', Object.entries(USE).filter(([k]) => k !== 'diagnostic'), f.use || 'fix')}</label>`}</div>` });
    let rows;
    if (isDiag(f)) {
      rows = steps.map((s, i) => { const ks = Object.keys(s.answers || {}); const yn = ks.includes('Above') ? 'ab' : 'yn';
        return `<li class="fl-qe"><div class="fl-qe-h"><span class="fl-n">${i + 1}</span>${inp(s.id, 'text', s.text, { ph: 'Ask one thing a person can check on site', label: `Question ${i + 1}`, cls: 'fl-qt' })}${rowBtns(i, n, s.id)}</div>`
          + `<div class="fl-qe-b"><label class="fl-yn">Answers ${sel(`data-act="fl:set" data-step="${esc(s.id)}" data-f="answers"`, [['yn', 'Yes or No'], ['ab', 'Above or Below']], yn)}</label>${ks.map((k) => answerEdit(f, s, k)).join('')}</div></li>`; }).join('');
    } else {
      rows = steps.map((s, i) => `<li class="fl-se"><span class="fl-n">${i + 1}</span><div class="fl-se-b">${inp(s.id, 'text', s.text, { ph: 'One action, in plain words', label: `Step ${i + 1}`, cls: 'fl-qt' })}<div class="fl-se-o">${sel(`data-act="fl:set" data-step="${esc(s.id)}" data-f="type" aria-label="Kind of step"`, Object.entries(STEP), s.type || 'instruction')}${sel(`data-act="fl:set" data-step="${esc(s.id)}" data-f="photo" aria-label="Photo"`, [['', 'No photo'], ['optional', 'Photo optional'], ['required', 'Photo required']], s.photo || '')}${s.type === 'reading' ? inp(s.id, 'sensorKind', s.sensorKind, { ph: 'Which reading, e.g. Motor current', label: 'Reading' }) : ''}${rowBtns(i, n, s.id)}</div></div></li>`).join('');
    }
    return meta + card({ title: isDiag(f) ? 'Questions' : 'Steps', sub: isDiag(f) ? 'Each answer goes to another question, or lands on a root cause with its fix flow.' : 'Each step is one action. Add a photo or a reading where proof is needed.', body: (n ? `<ol class="fl-edit">${rows}</ol>` : empty(isDiag(f) ? 'No questions yet.' : 'No steps yet.')) + `<div class="fl-add">${btn(isDiag(f) ? 'Add a question' : 'Add a step', { act: 'fl:add', kind: 'secondary' })}</div>` });
  }

  /* ── actions ──────────────────────────────────────────────────────────────────────────────────────── */
  const dstep = (el) => (DRAFT ? arr(DRAFT.flow.steps).find((s) => String(s.id) === String(ga(el, 'step'))) : null);
  const nextId = (f) => arr(f.steps).reduce((m, s) => Math.max(m, +s.id || 0), 0) + 1;
  const blankStep = (f) => (isDiag(f) ? { id: nextId(f), type: 'question', text: '', answers: { Yes: { t: 'open' }, No: { t: 'open' } } } : { id: nextId(f), type: 'instruction', text: '' });
  UI.on('fl:search', (el) => { if (ga(el, 'inc')) SEARCH.inc = ga(el, 'inc') === '1'; else if (ga(el, 'all')) SEARCH.all = true; else { SEARCH.q = el.value || ''; } UI.render(); return false; });
  UI.on('fl:new', (el) => {
    const diag = ga(el, 'kind') === 'diagnostic'; const id = `f_new_${Date.now().toString(36)}`;
    const f = { id, name: '', kind: diag ? 'diagnostic' : 'action', forTypes: [], forStage: null, use: diag ? 'diagnostic' : ga(el, 'kind') === 'fix' ? 'fix' : 'round', version: 0, status: 'draft', steps: [] };
    f.steps.push(blankStep(f)); DRAFT = { id, flow: f, causes: {}, isNew: true }; lib().flows.push(clone({ ...f, steps: [] }));
    UI.go(`#/flows/${enc(id)}`); return false;
  });
  UI.on('fl:edit', (el) => { const f = flowById(ga(el, 'id')); if (!f) return false; DRAFT = { id: f.id, flow: clone(f), causes: {}, isNew: false }; return undefined; });
  UI.on('fl:discard', () => { if (!DRAFT) return false; const d = DRAFT; DRAFT = null; if (d.isNew) { const i = lib().flows.findIndex((f) => f.id === d.id); if (i >= 0) lib().flows.splice(i, 1); UI.go('#/flows'); return false; } return undefined; });
  UI.on('fl:add', () => { if (!DRAFT) return false; DRAFT.flow.steps.push(blankStep(DRAFT.flow)); return undefined; });
  UI.on('fl:del', (el) => {
    if (!DRAFT) return false; const f = DRAFT.flow; const sid = ga(el, 'step');
    f.steps = arr(f.steps).filter((s) => String(s.id) !== String(sid));
    f.steps.forEach((s) => Object.keys(s.answers || {}).forEach((k) => { const a = s.answers[k]; if (a && a.t === 'step' && String(a.id) === String(sid)) s.answers[k] = { t: 'open' }; }));
    return undefined;
  });
  UI.on('fl:move', (el) => { if (!DRAFT) return false; const st = DRAFT.flow.steps; const i = st.findIndex((s) => String(s.id) === String(ga(el, 'step'))); const j = i + (+ga(el, 'by') || 0); if (i < 0 || j < 0 || j >= st.length) return false; const [x] = st.splice(i, 1); st.splice(j, 0, x); return undefined; });
  UI.on('fl:set', (el) => {
    if (!DRAFT) return false; const f = DRAFT.flow; const k = ga(el, 'f'); const v = el.value;
    if (!ga(el, 'step')) { if (k === 'name') f.name = v; else if (k === 'forTypes') f.forTypes = String(v).split(',').map((x) => x.trim()).filter(Boolean); else if (k === 'use') f.use = v; return undefined; }
    const s = dstep(el); if (!s) return false;
    if (k === 'answers') { const old = Object.values(s.answers || {}); const ks = v === 'ab' ? ['Above', 'Below'] : ['Yes', 'No']; s.answers = { [ks[0]]: old[0] || { t: 'open' }, [ks[1]]: old[1] || { t: 'open' } }; }
    else if (k === 'type') { s.type = v; if (v !== 'reading') delete s.sensorKind; }
    else if (k === 'photo') { if (v) s.photo = v; else delete s.photo; }
    else s[k] = v;
    return undefined;
  });
  UI.on('fl:ans', (el) => {
    const s = dstep(el); if (!s) return false; const k = ga(el, 'ans'); const v = el.value;
    if (v === 'open') s.answers[k] = { t: 'open' };
    else if (v === 'cause') { const first = causeOptions(DRAFT.flow)[0]; s.answers[k] = { t: 'cause', id: first ? first[0] : newCause() }; }
    else s.answers[k] = { t: 'step', id: +v.slice(5) || v.slice(5) };
    return undefined;
  });
  function newCause() { const id = `c_new_${Date.now().toString(36)}${Object.keys(DRAFT.causes).length}`; DRAFT.causes[id] = { id, name: 'New root cause', types: arr(DRAFT.flow.forTypes).slice(), fix: null, isNew: true }; return id; }
  UI.on('fl:cause', (el) => {
    if (!DRAFT) return false; const k = ga(el, 'f');
    if (k === 'pick') { const s = dstep(el); if (!s) return false; s.answers[ga(el, 'ans')] = { t: 'cause', id: el.value === '__new' ? newCause() : el.value }; return undefined; }
    const id = ga(el, 'cause'); const c = DRAFT.causes[id] || (DRAFT.causes[id] = clone(causes().find((x) => x.id === id) || { id, name: '', types: [], fix: null }));
    if (k === 'name') c.name = el.value; else if (k === 'fix') c.fix = el.value || null;
    return undefined;
  });
  UI.on('fl:save', () => {
    if (!DRAFT) return false; const d = DRAFT; const f = d.flow;
    if (!String(f.name || '').trim()) { UI.toast('Give the flow a name first.'); return false; }
    f.version = (f.version || 0) + 1; f.status = 'published';
    const i = lib().flows.findIndex((x) => x.id === f.id); if (i >= 0) lib().flows[i] = f; else lib().flows.push(f);
    Object.values(d.causes).forEach((c) => { const cc = { ...c }; delete cc.isNew; const j = lib().causes.findIndex((x) => x.id === c.id); if (j >= 0) lib().causes[j] = cc; else lib().causes.push(cc); });
    DRAFT = null; TRY = null;
    try { V().log(null, `${d.isNew ? 'Added' : 'Changed'} the ${isDiag(f) ? 'diagnostic flow' : 'flow'} ${f.name}: ${plural(arr(f.steps).length, isDiag(f) ? 'question' : 'step')}, version ${f.version}`, 'library'); } catch (e) { /* the log is optional */ }
    const left = problems(f).length;
    UI.toast(`Saved ${f.name}, version ${f.version}.${left ? ` ${plural(left, 'thing')} still to finish.` : ''}`);
    return undefined;
  });
  UI.on('fl:try', (el) => {
    const f = (DRAFT && DRAFT.id === ga(el, 'id') ? DRAFT.flow : flowById(ga(el, 'id'))); if (!f || !TRY) return false;
    const s = arr(f.steps).find((x) => String(x.id) === String(ga(el, 'step'))); const k = ga(el, 'ans'); const a = s && (s.answers || {})[k]; if (!s) return false;
    TRY.path.push({ q: s.text, a: k }); TRY.at = !a || a.t === 'open' ? { t: 'open' } : { t: a.t, id: a.id };
    return undefined;
  });
  UI.on('fl:retry', () => { TRY = null; return undefined; });

  UI.route('flows', listPage);
  UI.route('flows/:id', flowPage);
  W.V7FLOWS = { listPage, flowPage, problems, usedBy, _draft: () => DRAFT };
}());
