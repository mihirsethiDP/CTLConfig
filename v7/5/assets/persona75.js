/* v7/5 · persona75.js — window.V7PERSONA: look at the configuration as one persona.
   A picker in the top bar chooses who you are. Everything stays visible; what that persona may not change is locked, and a
   click on it says who can. #/personas compares them: who each one is, what they can change, and what reaches them.
   The persona is a way of looking, kept in this browser ('ctl75.persona'); it is not part of a plant's saved state.
   Loads after ui7.js. One table (ACTS) says which ability each action on screen needs; an action not listed is open to all.
   A person can hold a level at the plant (Operator, Lead, Senior Lead) and an admin grant together; each is shown on its own. */
(function () {
  'use strict';
  const W = window; const U = W.V7UI; if (!U) return;
  const esc = U.esc; const KEY = 'ctl75.persona';

  /* what a persona can be able to do, in the order shown */
  const CAPS = [
    { id: 'work', label: 'Work issues and tasks', what: 'Report a problem, answer the diagnostic, do the fix, close an issue, do a task.' },
    { id: 'setup', label: 'Set up what was read', what: 'Accept the equipment read from the Visualization. Add, change or remove unit processes and control groups, and move equipment between them.' },
    { id: 'alerts', label: 'Alerts, limits and tasks at a plant', what: 'Accept or leave out what the library proposes. Turn an alert on or off. Change the limits on a reading, how long it must hold, how often a task comes round, the work level, and an equipment\'s criticality. Keep or undo a deviation.' },
    { id: 'people', label: 'People at a plant', what: 'Who is at the plant, their level, and how each is reached.' },
    { id: 'golive', label: 'Go live', what: 'Take a plant live, or return it to set-up.' },
    { id: 'library', label: 'The libraries and flows', what: 'Change an equipment type or unit process type for every plant, publish it, and edit flows.' },
  ];
  const PERSONAS = [
    { id: 'all', name: 'All access', group: '', who: 'No persona. Everything in the prototype is on, as before.', caps: CAPS.map((c) => c.id), gets: '' },
    { id: 'operator', name: 'Operator', group: 'At the plant', who: 'Runs the plant on shift, mostly from the phone.', caps: ['work'],
      gets: 'Told when an issue opens at their plant, at the severities their own settings cover, and when a task is due. An Emergency always reaches them.' },
    { id: 'lead', name: 'Lead', group: 'At the plant', who: 'The senior operator or supervisor in charge of the plant.', caps: ['work'],
      gets: 'Emergency and Major when the issue opens. Minor once it has not been started in time. Approvals waiting for them, and work that is overdue.',
      also: 'In the product a Lead also approves work and can change a team member\'s notification settings. Neither is built in this prototype.' },
    { id: 'senior', name: 'Senior Lead', group: 'At the plant', who: 'A service engineer, manager or head, usually across several plants. A plant may have none.', caps: ['work'],
      gets: 'Emergency and Major only, by default. Approvals only once they are long overdue.' },
    { id: 'client', name: 'Client viewer', group: 'At the plant', who: 'The client\'s contact. Looks, and does not act.', caps: [],
      gets: 'Informed when an approval has been waiting far too long.' },
    { id: 'people', name: 'People Admin', group: 'Admins', who: 'Decides who is at the plant, their level, and how each is reached.', caps: ['people'],
      gets: 'Told when an issue has nobody at the plant to cover it.' },
    { id: 'technical', name: 'Technical Admin', group: 'Admins', who: 'Decides what the plant watches and what work it raises.', caps: ['setup', 'alerts'],
      gets: 'Told, with the Lead, when a sensor is reading wrong.' },
    { id: 'site', name: 'Full Site Admin', group: 'Admins', who: 'Both admin jobs at one plant: the people and the technical set-up.', caps: ['setup', 'alerts', 'people'],
      gets: 'What a People Admin and a Technical Admin are told.' },
    { id: 'global', name: 'Global Admin', group: 'Admins', who: 'Looks after the libraries for every plant, and takes a plant live.', caps: ['setup', 'alerts', 'people', 'golive', 'library'],
      gets: 'Nothing by role. Can act as a Full Site Admin at any plant.' },
  ];
  const byId = {}; PERSONAS.forEach((p) => { byId[p.id] = p; });
  const capById = {}; CAPS.forEach((c) => { capById[c.id] = c; });

  /* which ability each action needs */
  const ACTS = {
    work: 'work:answer work:cause-go work:causes work:close-go work:closenote work:false work:false-go work:fixstep work:reading work:report work:report-eq work:report-go work:report-pick work:return work:startfix work:taskdone work:taskstep work:verify obj:report obj:rsave',
    setup: 'p7:scada-accept p7:scada-accept-all st:confirm st:place st:up-new st:up-edit st:up-add st:up-save st:up-remove st:cg-new st:cg-edit st:cg-save st:cg-remove',
    alerts: 'p7:lib-accept p7:lib-accept-all p7:lib-accept-eq p7:lib-accept-group p7:lib-accept-type p7:lib-reject p7:lib-reject-confirm p7:lib-reject-group p7:lib-reject-group-confirm p7:limits p7:worklevel p7:worklevel-keep obj:astate obj:aoff obj:tier obj:tiersave lib:keep lib:keep-save lib:revert lib:revert-all lib:suggest lib:suggest-send obj:suggest obj:sgsave work:suggest work:cadence work:cadence-save work:lastdone',
    people: 'p7:people-sample',
    golive: 'p7:golive p7:golive-confirm p7:return p7:return-confirm',
    library: 'lib:field lib:discard lib:publish fl:new fl:edit fl:add fl:del fl:move fl:set fl:save fl:discard work:cadence-lib',
  };
  const NEED = {}; Object.keys(ACTS).forEach((cap) => ACTS[cap].split(' ').forEach((a) => { NEED[a] = cap; }));
  const BY_MODE = { 'obj:limits': 1, 'obj:timing': 1, 'obj:cadence': 1 };   /* the same editor serves a plant and a library type */
  function capOf(act, el) {
    if (BY_MODE[act]) return el && el.getAttribute && el.getAttribute('data-mode') === 'type' ? 'library' : 'alerts';
    return NEED[act] || null;
  }

  function currentId() { let v = null; try { v = W.localStorage.getItem(KEY); } catch (e) { v = null; } return byId[v] ? v : 'all'; }
  function current() { return byId[currentId()]; }
  function can(cap) { return !cap || current().caps.indexOf(cap) >= 0; }
  function holders(cap) { return PERSONAS.filter((p) => p.id !== 'all' && p.caps.indexOf(cap) >= 0).map((p) => p.name); }
  function orList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]; }
  function whyNot(cap) { const c = capById[cap]; return `${current().name} cannot do this. It needs: ${c ? c.label.toLowerCase() : cap}, which ${orList(holders(cap))} can do.`; }
  function set(id) { try { W.localStorage.setItem(KEY, byId[id] ? id : 'all'); } catch (e) { /* kept for this visit only */ } }

  /* ── locking what the persona may not change ── */
  function hasDom() { return typeof document !== 'undefined' && !!document && !!document.body && typeof document.querySelectorAll === 'function'; }
  function lock(root) {
    if (!hasDom()) return;
    const list = (root || document.body).querySelectorAll('[data-act]');
    for (let i = 0; i < list.length; i++) {
      const el = list[i]; const cap = capOf(el.getAttribute('data-act'), el);
      if (!cap || can(cap)) continue;
      if (el.getAttribute('data-locked')) continue;
      el.setAttribute('data-locked', cap); el.setAttribute('aria-disabled', 'true'); el.setAttribute('title', whyNot(cap));
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName || '')) el.disabled = true;
    }
  }
  function strip(main) {
    if (!main || !hasDom()) return; const p = current(); const old = main.querySelector('.pz-strip'); if (old) old.remove();
    if (p.id === 'all') return;
    const yes = CAPS.filter((c) => p.caps.indexOf(c.id) >= 0).map((c) => c.label.toLowerCase());
    const d = document.createElement('div'); d.className = 'pz-strip'; d.setAttribute('role', 'status');
    d.innerHTML = `<span><b>Viewing as ${esc(p.name)}.</b> ${yes.length ? `Can change: ${esc(yes.join('; '))}. Everything else is read-only.` : 'Can see everything and change nothing.'}</span>`
      + `<span class="pz-strip-a"><a href="#/personas">Compare personas</a><button type="button" class="pz-link" data-act="persona:set" data-id="all">Back to all access</button></span>`;
    main.insertBefore(d, main.firstChild);
  }

  /* ── the picker in the top bar ── */
  function pickerHtml() {
    const cur = currentId(); const groups = ['', 'At the plant', 'Admins'];
    const opts = groups.map((g) => { const o = PERSONAS.filter((p) => p.group === g).map((p) => `<option value="${esc(p.id)}"${p.id === cur ? ' selected' : ''}>${esc(p.name)}</option>`).join(''); return g ? `<optgroup label="${esc(g)}">${o}</optgroup>` : o; }).join('');
    return `<label class="tb-persona" title="Look at the configuration as one persona. What that persona may not change is locked."><span>Viewing as</span><select id="tbPersona" data-act="persona:pick" aria-label="Viewing as">${opts}</select></label>`;
  }
  function syncPicker() { if (!hasDom()) return; const s = document.getElementById('tbPersona'); if (s) s.value = currentId(); document.body.setAttribute('data-persona', currentId()); }
  function choose(id) { set(id); syncPicker(); const p = current(); U.toast(p.id === 'all' ? 'All access: nothing is locked.' : `Viewing as ${p.name}. What they may not change is locked.`); }
  U.on('persona:pick', (el) => { choose(el.value); });
  U.on('persona:set', (el) => { choose(el.getAttribute('data-id')); });

  /* ── #/personas ── */
  function page() {
    const cur = currentId(); const list = PERSONAS.filter((p) => p.id !== 'all');
    const head = `<tr><th scope="col">What they can do</th>${list.map((p) => `<th scope="col"${p.id === cur ? ' class="on"' : ''}>${esc(p.name)}</th>`).join('')}</tr>`;
    const rows = [`<tr><th scope="row">See every screen<span class="pz-what">Plants, equipment, alerts, tasks, libraries, flows, activity.</span></th>${list.map((p) => `<td${p.id === cur ? ' class="on"' : ''}><span class="pz-y" aria-label="Yes">✓</span></td>`).join('')}</tr>`]
      .concat(CAPS.map((c) => `<tr><th scope="row">${esc(c.label)}<span class="pz-what">${esc(c.what)}</span></th>${list.map((p) => `<td${p.id === cur ? ' class="on"' : ''}>${p.caps.indexOf(c.id) >= 0 ? '<span class="pz-y" aria-label="Yes">✓</span>' : '<span class="pz-n" aria-label="No">–</span>'}</td>`).join('')}</tr>`));
    const grp = (g) => `<h2 class="pz-h">${esc(g)}</h2><div class="pz-cards">${list.filter((p) => p.group === g).map((p) => {
      const yes = CAPS.filter((c) => p.caps.indexOf(c.id) >= 0);
      return `<section class="pz-card${p.id === cur ? ' on' : ''}"><header><h3>${esc(p.name)}</h3>${p.id === cur ? U.chip('Viewing as', { tone: 'ok' }) : U.btn('View as', { act: 'persona:set', data: { id: p.id }, kind: 'ghost', small: true })}</header>`
        + `<p class="pz-who">${esc(p.who)}</p>`
        + `<dl><dt>Can change</dt><dd>${yes.length ? `<ul>${yes.map((c) => `<li>${esc(c.label)}</li>`).join('')}</ul>` : 'Nothing. Every screen is read-only.'}</dd>`
        + `<dt>What reaches them</dt><dd>${esc(p.gets)}</dd>${p.also ? `<dt>Not in this prototype</dt><dd>${esc(p.also)}</dd>` : ''}</dl></section>`;
    }).join('')}</div>`;
    const body = U.note('Pick a persona here or in the top bar, then walk the prototype. Everything stays visible; what that persona may not change is locked, and a click on it says who can. A person can hold a level at the plant and an admin grant together: each is shown on its own.', 'quiet')
      + `<div class="pz-scroll"><table class="pz-t"><thead>${head}</thead><tbody>${rows.join('')}</tbody></table></div>` + grp('At the plant') + grp('Admins');
    return U.page({ title: 'Personas', sub: 'Who uses the configuration, what each one can change, and what reaches them.', actions: [cur === 'all' ? '' : U.btn('Back to all access', { act: 'persona:set', data: { id: 'all' }, kind: 'ghost' })], body });
  }
  U.route('personas', page);

  /* ── wiring ── */
  U.afterRender((main) => { strip(main); lock(); syncPicker(); });
  if (hasDom()) {
    /* a locked control says who can, in place of doing nothing */
    document.addEventListener('click', (ev) => {
      const t = ev.target && ev.target.closest ? ev.target.closest('[data-locked]') : null; if (!t) return;
      ev.preventDefault(); ev.stopPropagation(); U.toast(whyNot(t.getAttribute('data-locked')));
    }, true);
    /* sheets, dialogs and the side panel are added outside a render: lock what arrives */
    if (typeof W.MutationObserver === 'function') { let due = false; new W.MutationObserver(() => { if (due) return; due = true; Promise.resolve().then(() => { due = false; lock(); }); }).observe(document.body, { childList: true, subtree: true }); }
  }

  W.V7PERSONA = { PERSONAS, CAPS, capOf, current, currentId, can, set, pickerHtml, whyNot, _need: NEED };
}());
