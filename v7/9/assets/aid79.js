/* v7/9 · aid79.js — what a flow is, said in a line and drawn, wherever an alert or a task names one.
   27 Nov. Three small things that close gaps in the configuration:
   1. Every flow named beside an alert or a task (in the library, and on a plant's Alerts & Tasks) carries a button that opens a short
      description and a picture of its steps, in place. Nobody has to leave the page to learn what "MBBR low DO diagnostic" is.
   2. A task takes the name its flow carries: where a form asks for a task's flow, choosing one fills the name and locks it.
   3. A library type lists its condition-based tasks on the Tasks tab: tasks raised when a condition holds, not on a date.
   window.V7FLOWAID = { describe(flow) → text, html(flow) → the picture, flowFor(key, pid) → flow id for a proposal } */
(function () {
  'use strict';
  const W = window; const V = () => W.V7; const C = () => W.CTL; const arr = (x) => (Array.isArray(x) ? x : []);
  const safe = (fn, d) => { try { const r = fn(); return r == null ? d : r; } catch (e) { return d; } };
  const flows = () => arr(safe(() => C().S.lib.flows, []));
  const flowById = (id) => (id ? flows().find((f) => f.id === id) || null : null);
  const causes = () => arr(safe(() => C().S.lib.causes, []));
  const causeName = (id) => { const c = causes().find((x) => x.id === id); return c ? c.name || c.title || 'a root cause' : 'a root cause'; };
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b || a + 's'}`;
  const kindWord = (f) => (f.kind === 'diagnostic' ? 'Diagnostic' : f.use === 'calibration' || /calibrat/i.test(f.name || '') ? 'Calibration steps' : f.use === 'fix' ? 'Fix steps' : 'Task steps');
  const clip = (t, n) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '') + '…' : s; };
  function describe(f) {
    if (!f) return ''; const st = arr(f.steps);
    if (f.kind === 'diagnostic') {
      const cs = new Set(); let reads = 0; st.forEach((x) => { if (x.type === 'reading') reads++; Object.values(x.answers || {}).forEach((a) => { if (a && a.t === 'cause') cs.add(a.id); }); });
      return `${plural(st.length, 'question')} that lead to ${plural(cs.size, 'root cause')}. The person answers one at a time, and each answer picks the next question${reads ? `. ${reads === 1 ? 'One asks' : reads + ' ask'} for a reading` : ''}.`;
    }
    const reads = st.filter((x) => x.type === 'reading').length; const photos = st.filter((x) => x.photo).length;
    return `${plural(st.length, 'step')}, done in order and ticked one by one${reads ? `. ${reads === 1 ? 'One asks' : reads + ' ask'} for a reading` : ''}${photos ? `. ${photos === 1 ? 'One asks' : photos + ' ask'} for a photo` : ''}.`;
  }
  W.V7FLOWAID = { describe, html: () => '', flowFor: () => null };

  const U = W.V7UI; if (!U || !U.on || typeof document === 'undefined') return;
  const esc = U.esc; const btn = U.btn; const enc = encodeURIComponent;
  const MAX = 6;
  /* the picture: the steps top to bottom, joined by a line. A diagnostic shows where each answer leads. */
  function html(f) {
    if (!f) return ''; const st = arr(f.steps); const diag = f.kind === 'diagnostic'; const idx = {}; st.forEach((x, i) => { idx[x.id] = i + 1; });
    const ans = (x) => Object.keys(x.answers || {}).map((k) => { const a = x.answers[k] || {}; const to = a.t === 'cause' ? `<span class="fa-to is-cause" title="${esc(causeName(a.id))}">${esc(clip(causeName(a.id), 34))}</span>` : a.t === 'step' ? `<span class="fa-to">question ${esc(idx[a.id] || a.id)}</span>` : `<span class="fa-to">${esc(a.t || 'next')}</span>`; return `<span class="fa-a"><b>${esc(k)}</b><span aria-hidden="true">→</span>${to}</span>`; }).join('');
    const li = (x, i) => `<li class="fa-st${x.type === 'reading' ? ' is-read' : ''}"><span class="fa-n" aria-hidden="true">${i + 1}</span><span class="fa-x"><span class="fa-t">${esc(clip(x.text, 92))}</span>${x.type === 'reading' ? '<span class="fa-ty">a reading</span>' : ''}${x.photo ? '<span class="fa-ty">a photo</span>' : ''}${diag ? `<span class="fa-as">${ans(x)}</span>` : ''}</span></li>`;
    const more = st.length > MAX ? `<li class="fa-st fa-more"><span class="fa-n" aria-hidden="true">…</span><span class="fa-x"><span class="fa-t">${plural(st.length - MAX, diag ? 'more question' : 'more step')}</span></span></li>` : '';
    return `<div class="fa-box"><p class="fa-h"><span class="fa-k">${esc(kindWord(f))}</span><b>${esc(f.name)}</b></p><p class="fa-d">${esc(describe(f))}</p>${st.length ? `<ol class="fa-chain${diag ? ' is-diag' : ''}">${st.slice(0, MAX).map(li).join('')}${more}</ol>` : '<p class="fa-d">Its steps are not written yet.</p>'}<p class="fa-f"><a href="#/flows/${esc(enc(f.id))}">Open the whole flow →</a></p></div>`;
  }
  W.V7FLOWAID.html = html;
  const aidBtn = (f, label) => `<button type="button" class="fa-b" data-act="fa:open" data-flow="${esc(f.id)}" aria-expanded="false" title="What this flow is, in a line and a picture">${label || 'What it is'}</button>`;
  U.on('fa:open', (el) => {
    const host = el.closest('.fa-line, .ua-s, .lf, .ua-row, li, td, p, div') || el.parentNode; let pop = host.nextElementSibling && host.nextElementSibling.classList.contains('fa-pop') ? host.nextElementSibling : null;
    if (pop) { pop.remove(); el.setAttribute('aria-expanded', 'false'); return false; }
    const f = flowById(el.getAttribute('data-flow')); if (!f) return false;
    pop = document.createElement('div'); pop.className = 'fa-pop'; pop.innerHTML = html(f); host.insertAdjacentElement('afterend', pop); el.setAttribute('aria-expanded', 'true'); return false;
  });

  /* the flow behind a line a plant is offered: its type's task flow, its alert's diagnostic, or the plant round's flow */
  const memo = {};
  function flowFor(key, pid) {
    const k = `${key}|${pid}`; if (k in memo) return memo[k];
    const parts = String(pid).split('|'); const eqId = parts[0]; const kind = parts[1]; const name = parts.slice(2).join('|'); let id = null;
    if (eqId === 'plant' || /Calibration of flow meter, level sensors and pressure gauges/i.test(name)) { const d = safe(() => V().plant(key), null); const pt = (d && d.type) || 'STP'; const prof = (W.PLANT_PROFILES || {})[pt] || (W.PLANT_PROFILES || {}).STP; const r = prof ? arr(prof.rounds).find((x) => x.name === name) : null; id = r && r.flow ? r.flow : null; }
    else { const e = safe(() => V().eq(key, eqId), null); const code = e ? e.code || e.dbType : null; const lt = code ? safe(() => V().libType(code), null) : null;
      if (kind === 'alert') { const a = lt ? arr(lt.alerts).find((x) => x.name === name) : null; id = a ? a.flowId || null : null; }
      else if (code && W.V7LIBFLOW) { let f = safe(() => W.V7LIBFLOW.flowOf('task', code, name), null); if (!f) { const u = arr(safe(() => V().structure(key).ups, [])).find((x) => x.id === eqId); if (u) f = safe(() => W.V7LIBFLOW.flowOf('task', u.typeId, name), null); } id = f ? f.id : null; } }
    memo[k] = id && flowById(id) ? id : null; return memo[k];
  }
  W.V7FLOWAID.flowFor = flowFor;
  const line = (f, what) => `<div class="fa-line"><span class="fa-ll">${what}</span> <b>${esc(f.name)}</b> <span class="fa-lc">${esc(plural(arr(f.steps).length, f.kind === 'diagnostic' ? 'question' : 'step'))}</span> ${aidBtn(f)}</div>`;
  function decorate(main, path) {
    const each = (sel, fn) => Array.prototype.forEach.call(main.querySelectorAll(sel), fn);
    /* beside every flow an alert across readings names */
    each('.ua-s', (s) => { if (s.querySelector('.fa-b')) return; const a = s.querySelector('a[href^="#/flows/"]'); if (!a) return; const f = flowById(decodeURIComponent(a.getAttribute('href').replace('#/flows/', '').split('?')[0])); if (f) a.insertAdjacentHTML('afterend', ' ' + aidBtn(f)); });
    /* beside every flow a library type lists for a problem or a task */
    each('.lf', (s) => { if (s.querySelector('.fa-b')) return; const v = s.querySelector('[data-act="lf:view"][data-id]'); if (!v) return; const f = flowById(v.getAttribute('data-id')); if (f) { const c = s.querySelector('.lf-c') || v; c.insertAdjacentHTML('afterend', ' ' + aidBtn(f)); } });
    /* on a plant's Alerts & Tasks: each line says which flow it starts or follows */
    const m = /^p\/([^/?]+)\/library/.exec(path); if (!m) return; const key = decodeURIComponent(m[1]);
    each('details.p7-shared', (d) => { const b = d.querySelector(':scope > .p7-grp-b'); if (!b || b.querySelector(':scope > .fa-line')) return; const one = d.querySelector('[data-pid]'); if (!one) return; const id = flowFor(key, one.getAttribute('data-pid')); const f = flowById(id); if (f) b.insertAdjacentHTML('afterbegin', line(f, 'Follows the flow')); });
    each('.p7-prop', (p) => { if (p.closest('details.p7-shared') || p.querySelector('.fa-line')) return; const one = p.querySelector('[data-pid]'); const mm = p.querySelector('.p7-prop-m'); if (!one || !mm) return; const pid = one.getAttribute('data-pid'); const f = flowById(flowFor(key, pid)); if (!f) return; const hp = mm.querySelector('.hp'); const h = line(f, String(pid).split('|')[1] === 'alert' ? 'Its issue starts' : 'Follows the flow'); if (hp) hp.insertAdjacentHTML('beforebegin', h); else mm.insertAdjacentHTML('beforeend', h); });
  }

  /* a library type's condition-based tasks, on its Tasks tab */
  function condBox(code) {
    const UA = W.V7UPALERT; if (!UA || !UA.alerts || !UA.typeOf(code)) return ''; const list = arr(UA.alerts(code)).filter((a) => a.starts && a.starts.kind !== 'issue'); const proc = UA.isProcess(code);
    const rows = list.map((a) => { const f = flowById(a.starts.flowId); return `<li class="ua-row"><div class="ua-main"><div class="ua-t"><b>${esc(f ? f.name : a.name)}</b> ${U.chip(a.starts.kind === 'calibration' ? 'Calibration' : 'Condition-based task', { tone: 'info' })} ${U.sev(a.band)}</div><div class="ua-w">Raised when ${esc(UA.sentence(a, null))}, for ${esc(a.hold)} min <span class="muted">· the condition is called "${esc(a.name)}"</span></div>${f ? `<div class="ua-s">Follows the flow: <a href="#/flows/${esc(enc(f.id))}">${esc(f.name)}</a></div>` : ''}</div><div class="ua-acts">${btn('Edit', { act: 'ua:lib-open', data: { code, id: a.id }, small: true })}${btn('Remove', { act: 'ua:lib-remove', data: { code, id: a.id }, small: true, kind: 'ghost' })}</div></li>`; }).join('');
    return `<section class="ov-box ua-box fa-cond" id="fa-cond"><header><h3>Condition-based tasks</h3><span class="ov-n">${list.length}</span><span class="ov-hb">${btn('Add a condition-based task', { act: 'ua:lib-open', data: { code, starts: 'task' }, small: true, kind: 'secondary', title: 'A task raised when a condition holds, not on a date' })}</span></header><div class="ov-b"><p class="ov-sub ua-lead">Tasks that come when a condition holds, not on a date: a reading past a limit, several readings together, or a calculated value. ${proc ? 'The condition is written with sensor purposes anywhere in the step, on equipment or on a pipe.' : 'The condition reads only what sits on this equipment.'} Each takes its name from the flow it follows, and each plant is offered it like any other task of the type.</p>${rows ? `<ul class="ua-rows">${rows}</ul>` : '<p class="ov-none">None yet.</p>'}</div></section>`;
  }
  function libTasks(main, code) {
    if (main.querySelector('#fa-cond')) return; const host = main.querySelector('.pg-main') || main; const cards = host.querySelectorAll('section.card, div.card'); const last = cards[cards.length - 1]; const h = condBox(code); if (!h) return;
    if (last) last.insertAdjacentHTML('afterend', h); else host.insertAdjacentHTML('beforeend', h);
    /* a manual test says where it is not offered */
    const lab = safe(() => V().manualTestSensor, null); if (typeof lab !== 'function') return;
    Array.prototype.forEach.call(main.querySelectorAll('td[data-label="Task"]'), (td) => { if (td.querySelector('.fa-skip')) return; const k = td.querySelector('.muted.small'); const b = td.querySelector('b'); if (!k || !b || !/^Manual testing$/i.test(k.textContent.trim())) return; const p = lab(b.textContent); if (p) k.insertAdjacentHTML('afterend', `<div class="fa-skip">Not offered at a plant where a sensor in the unit process reads ${esc(p)}: the sensor already gives the reading.</div>`); });
  }
  if (U.afterRender) U.afterRender((main, p0) => {
    try { if (!main) return; const path = String(p0 || location.hash).replace(/^#?\/?/, '').split('?')[0]; Object.keys(memo).forEach((k) => delete memo[k]);
      const lt = /^library\/([^/]+)\/tasks$/.exec(path); if (lt) libTasks(main, decodeURIComponent(lt[1]));
      if (/^library(\/|$)/.test(path) || /^p\/[^/]+\/library$/.test(path)) setTimeout(() => { try { decorate(main, path); } catch (e) { /* the page shows without the helpers */ } }, 30);
    } catch (e) { /* the page shows without the helpers */ }
  });

  /* a task takes the name its flow carries */
  const PAIRS = [['#la-tflow', () => document.getElementById('la-tname')], ['#ow-flow', () => document.getElementById('ow-name')]];
  function nameFromFlow(sel) {
    if (!sel || !sel.matches) return; let inp = null; const pr = PAIRS.find(([q]) => sel.matches(q)); if (pr) inp = pr[1]();
    else if (sel.hasAttribute('data-tflow')) { const b = sel.getAttribute('data-tflow'); const row = sel.closest('.o-trig-t') || document; inp = row.querySelector(`input[data-taskname="${b}"]`); }
    if (!inp) return; const f = flowById(sel.value);
    if (f) { if (inp.value !== f.name) { inp.value = f.name; inp.dispatchEvent(new Event('input', { bubbles: true })); } inp.readOnly = true; inp.classList.add('is-fromflow'); inp.title = 'A task takes the name its flow carries. Choose no flow to type a name.'; }
    else if (inp.classList.contains('is-fromflow')) { inp.readOnly = false; inp.classList.remove('is-fromflow'); inp.title = ''; }
  }
  document.addEventListener('change', (ev) => { const t = ev.target; if (t && t.tagName === 'SELECT' && (t.id === 'la-tflow' || t.id === 'ow-flow' || t.hasAttribute('data-tflow'))) nameFromFlow(t); }, true);
  document.addEventListener('focusin', (ev) => { const t = ev.target; if (!t || t.tagName !== 'INPUT') return; let sel = null; if (t.id === 'la-tname') sel = document.getElementById('la-tflow'); else if (t.id === 'ow-name') sel = document.getElementById('ow-flow'); else if (t.hasAttribute && t.hasAttribute('data-taskname')) { const row = t.closest('.o-trig-t'); sel = row ? row.querySelector(`select[data-tflow="${t.getAttribute('data-taskname')}"]`) : null; } if (sel && sel.value) nameFromFlow(sel); }, true);
})();
