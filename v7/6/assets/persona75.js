/* v7/5 · persona75.js — window.V7PERSONA: look at the configuration as one person.
   The model is the single-role one of the User Center: a person has exactly ONE role, the same at every plant, and at most ONE
   admin grant. A role or a grant is a fixed list of permission sets; nothing else gives access.
     roles   Operator = work + plant view · Lead = + approvals · Senior Lead = + oversight + all their plants
             Regular Non-op = plant view · Senior Non-op = plant view + all their plants
     grants  People Admin = people · Technical Admin = plant configuration · Full Site Admin = both · Global Admin = everything
   Two pickers in the top bar choose the role and the grant. Configuration is the Global Admin's alone: setting a plant up, its
   structure, the libraries, flows and go live are not there for anyone else. Everyone gets the plant, its issues, tasks and
   equipment; on those screens a Technical Admin can also change alerts, limits and tasks. What a person may not change is
   locked, and a click on it says what it needs. #/personas compares them.
   Not modelled here: a plant's licensed modules (which cap every permission), per-person exceptions with a reason, and the three
   exception permissions (remote control, view as another user, the sensor health dashboard).
   The choice is a way of looking, kept in this browser ('ctl76.persona'); it is not part of a plant's saved state.
   Loads after ui7.js. ACTS says which permission set each action on screen needs; an action not listed is open to all. */
(function () {
  'use strict';
  const W = window; const U = W.V7UI; if (!U) return;
  const esc = U.esc; const KEY = 'ctl76.persona';

  /* the permission sets this prototype has something for, in the order shown */
  const SETS = [
    { id: 'readplant', label: 'See the plant and do everyday work', what: 'The plant, its issue log, its equipment and task history. Do routine tasks and enter readings.' },
    { id: 'work', label: 'Work an issue', what: 'Raise an issue, run the diagnostic, submit the root cause, do the fix.' },
    { id: 'approve', label: 'Approve and close', what: 'Confirm a fix worked and close the issue, close with a note, close as a false alarm.' },
    { id: 'portfolio', label: 'See all their plants at once', what: 'The multi-plant view. It gives no extra plants and no power to manage.', info: true },
    { id: 'people', label: 'People', what: 'Who is at a plant, their role, and how each is reached. People are managed in the User Center; this prototype only lists them.' },
    { id: 'tech', label: 'Alerts, limits and tasks at a plant', what: 'Turn an alert on or off. Change the limits on a reading, how long it must hold, how often a task comes round, and an equipment\'s criticality. Accept or leave out what the library proposes for a piece of equipment. Keep or undo a deviation.' },
    { id: 'templates', label: 'Configuration', what: 'Set a plant up from what was read, change its structure, choose its work level and take it live. Change the libraries and flows that every plant shares.' },
  ];
  const ROLES = [
    { id: 'operator', name: 'Operator', level: 'L1', who: 'Operates the plant and owns the issues they pick up.', sets: ['readplant', 'work'] },
    { id: 'lead', name: 'Lead', level: 'L3', who: 'Supervises others and unblocks them: approvals and closure are the Lead\'s.', sets: ['readplant', 'work', 'approve'] },
    { id: 'senior', name: 'Senior Lead', level: 'L4', who: 'A Lead across several plants.', sets: ['readplant', 'work', 'approve', 'portfolio'], also: 'Also a co-signer when an issue is force-closed. Force-close is not in this prototype.' },
    { id: 'nonop', name: 'Regular Non-op', level: '', who: 'Does not operate the plant. Sees it and does the everyday work.', sets: ['readplant'] },
    { id: 'seniornonop', name: 'Senior Non-op', level: '', who: 'A non-op who sees all their plants at once.', sets: ['readplant', 'portfolio'] },
  ];
  const GRANTS = [
    { id: 'none', name: 'No admin grant', who: '', sets: [] },
    { id: 'people', name: 'People Admin', who: 'Manages the people: users, rosters, roles and grants.', sets: ['people'] },
    { id: 'technical', name: 'Technical Admin', who: 'Looks after a plant\'s rules, schedules, sensors and thresholds once it is set up.', sets: ['tech'] },
    { id: 'site', name: 'Full Site Admin', who: 'Both admin jobs at a plant: the people, and its alerts, limits and tasks.', sets: ['people', 'tech'] },
    { id: 'global', name: 'Global Admin', who: 'DigitalPaani staff. The only one who configures. Holds every permission at every plant; no check ever says no.', sets: SETS.map((s) => s.id) },
  ];
  const roleById = {}; ROLES.forEach((r) => { roleById[r.id] = r; });
  const grantById = {}; GRANTS.forEach((g) => { grantById[g.id] = g; });
  const setById = {}; SETS.forEach((s) => { setById[s.id] = s; });

  /* which permission set each action needs */
  const ACTS = {
    readplant: 'work:taskstep work:taskdone work:reading',
    work: 'work:report work:report-eq work:report-go work:report-pick work:answer work:causes work:cause-go work:startfix work:fixstep work:return obj:report obj:rsave',
    approve: 'work:verify work:closenote work:close-go work:false work:false-go',
    people: 'p7:people-sample',
    tech: 'p7:lib-accept p7:lib-accept-all p7:lib-accept-eq p7:lib-accept-group p7:lib-accept-type p7:lib-reject p7:lib-reject-confirm p7:lib-reject-group p7:lib-reject-group-confirm p7:limits '
      + 'obj:astate obj:aoff obj:tier obj:tiersave lib:keep lib:keep-save lib:revert lib:revert-all lib:suggest lib:suggest-send obj:suggest obj:sgsave work:suggest work:cadence work:cadence-save work:lastdone',
    templates: 'p7:scada-accept p7:scada-accept-all st:confirm st:place st:up-new st:up-edit st:up-add st:up-save st:up-remove st:cg-new st:cg-edit st:cg-save st:cg-remove p7:worklevel p7:worklevel-keep '
      + 'lib:field lib:discard lib:publish fl:new fl:edit fl:add fl:del fl:move fl:set fl:save fl:discard work:cadence-lib p7:golive p7:golive-confirm p7:return p7:return-confirm',
  };
  const NEED = {}; Object.keys(ACTS).forEach((s) => ACTS[s].split(' ').forEach((a) => { NEED[a] = s; }));
  const BY_MODE = { 'obj:limits': 1, 'obj:timing': 1, 'obj:cadence': 1 };   /* the same editor serves a plant and a library type */
  function setOf(act, el) {
    if (BY_MODE[act]) return el && el.getAttribute && el.getAttribute('data-mode') === 'type' ? 'templates' : 'tech';
    return NEED[act] || null;
  }

  /* ── who you are looking as ── */
  function read() {
    let v = null; try { v = JSON.parse(W.localStorage.getItem(KEY) || 'null'); } catch (e) { v = null; }
    if (!v || !roleById[v.role]) return null;
    return { role: v.role, grant: grantById[v.grant] ? v.grant : 'none' };
  }
  function save(v) { try { if (v) W.localStorage.setItem(KEY, JSON.stringify(v)); else W.localStorage.removeItem(KEY); } catch (e) { /* kept for this visit only */ } }
  function isAll() { return !read(); }
  function sets() { const v = read(); if (!v) return SETS.map((s) => s.id); if (v.grant === 'global') return SETS.map((s) => s.id); return roleById[v.role].sets.concat(grantById[v.grant].sets); }
  function can(set) { return !set || sets().indexOf(set) >= 0; }
  function isGlobal() { const v = read(); return !v || v.grant === 'global'; }
  function title() { const v = read(); if (!v) return 'All access'; return roleById[v.role].name + (v.grant !== 'none' ? ' + ' + grantById[v.grant].name : ''); }
  function orList(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1]; }
  function holders(set) { return ROLES.filter((r) => r.sets.indexOf(set) >= 0).map((r) => 'a ' + r.name).concat(GRANTS.filter((g) => g.id !== 'none' && g.sets.indexOf(set) >= 0).map((g) => 'a ' + g.name)); }
  function whyNot(set) { const s = setById[set]; return `${title()} cannot do this. It needs "${s ? s.label : set}": ${orList(holders(set))}.`; }

  /* ── what is on screen for them: configuration is there for the Global Admin only ── */
  const TECH_TOO = /^p\/[^/]+\/(readings|differences)$/; const PEOPLE_TOO = /^users$/;
  const OPEN = /^(plants|personas)$|^p\/[^/]+$|^p\/[^/]+\/(issues|issue\/[^/]+|tasks|task\/[^/]+|equipment|eq\/.+|alert\/[^/]+|activity)$/;
  function pathOf(href) { return String(href || '').replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '') || 'plants'; }
  function sees(path) { const p = pathOf(path); return isGlobal() || OPEN.test(p) || (can('tech') && TECH_TOO.test(p)) || (can('people') && PEOPLE_TOO.test(p)); }
  function settingUp(path) { const m = /^p\/([^/]+)$/.exec(pathOf(path)); if (!m || isGlobal()) return null; const v = W.V7; let st = null; try { st = v && v.state ? v.state(m[1]) : null; } catch (e) { st = null; } return st === 'commissioning' ? m[1] : null; }
  function notHere(path) {
    const key = settingUp(path); const who = title();
    if (key) {
      let name = key; try { name = (W.V7.plant(key) || {}).name || key; } catch (e) { /* keep the key */ }
      return U.page({ title: name, sub: 'This plant is still being set up.', body: U.note(`Setting a plant up is configuration, and configuration is the Global Admin's alone. This screen is not there for ${who}. They still have the plant's issues, tasks and equipment.`, 'quiet')
        + `<p class="pz-go">${U.btn('Issues', { href: `#/p/${key}/issues`, kind: 'primary' })}${U.btn('Tasks', { href: `#/p/${key}/tasks` })}${U.btn('Equipment', { href: `#/p/${key}/equipment` })}</p>` });
    }
    return U.page({ title: 'Not there for this person', sub: `Viewing as ${who}.`, body: U.note('This screen is configuration, and configuration is the Global Admin\'s alone. Everyone else gets the plant, its issues, tasks and equipment. A Technical Admin also gets the plant\'s limits and deviations.', 'quiet')
      + `<p class="pz-go">${U.btn('All Plants', { href: '#/plants', kind: 'primary' })}${U.btn('Compare roles and grants', { href: '#/personas' })}</p>` });
  }

  /* ── locking and hiding ── */
  function hasDom() { return typeof document !== 'undefined' && !!document && !!document.body && typeof document.querySelectorAll === 'function'; }
  function lock(root) {
    if (!hasDom()) return;
    const list = (root || document.body).querySelectorAll('[data-act]');
    for (let i = 0; i < list.length; i++) {
      const el = list[i]; const set = setOf(el.getAttribute('data-act'), el);
      if (!set || can(set) || el.getAttribute('data-locked')) continue;
      el.setAttribute('data-locked', set); el.setAttribute('aria-disabled', 'true'); el.setAttribute('title', whyNot(set));
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName || '')) el.disabled = true;
    }
    const links = document.body.querySelectorAll('a[href^="#/"]');
    for (let i = 0; i < links.length; i++) { const a = links[i]; if (sees(a.getAttribute('href'))) a.removeAttribute('data-nosee'); else a.setAttribute('data-nosee', '1'); }
  }
  function strip(main) {
    if (!main || !hasDom()) return; const old = main.querySelector('.pz-strip'); if (old) old.remove();
    if (isAll()) return;
    const mine = sets(); const yes = SETS.filter((s) => !s.info && mine.indexOf(s.id) >= 0).map((s) => s.label.toLowerCase());
    const d = document.createElement('div'); d.className = 'pz-strip'; d.setAttribute('role', 'status');
    d.innerHTML = `<span><b>Viewing as ${esc(title())}.</b> Can: ${esc(yes.join('; '))}.${isGlobal() ? '' : ' Configuration is for the Global Admin, so it is not there.'}</span>`
      + `<span class="pz-strip-a"><a href="#/personas">Compare</a><button type="button" class="pz-link" data-act="persona:all">Back to all access</button></span>`;
    main.insertBefore(d, main.firstChild);
  }

  /* ── the two pickers in the top bar ── */
  function pickerHtml() {
    const v = read();
    const ro = `<option value="all"${v ? '' : ' selected'}>All access</option>` + ROLES.map((r) => `<option value="${esc(r.id)}"${v && v.role === r.id ? ' selected' : ''}>${esc(r.name)}</option>`).join('');
    const go = GRANTS.map((g) => `<option value="${esc(g.id)}"${v && v.grant === g.id ? ' selected' : ''}>${esc(g.id === 'none' ? 'No grant' : g.name)}</option>`).join('');
    return `<span class="tb-persona" title="Look at the configuration as one person: one role, and at most one admin grant."><span>Viewing as</span>`
      + `<select id="tbRole" data-act="persona:role" aria-label="Role">${ro}</select><select id="tbGrant" data-act="persona:grant" aria-label="Admin grant"${v ? '' : ' disabled'}>${go}</select></span>`;
  }
  function syncPicker() {
    if (!hasDom()) return; const v = read(); const r = document.getElementById('tbRole'); const g = document.getElementById('tbGrant');
    if (r) r.value = v ? v.role : 'all'; if (g) { g.value = v ? v.grant : 'none'; g.disabled = !v; }
    document.body.setAttribute('data-persona', v ? 'on' : 'all');
  }
  function say() { U.toast(isAll() ? 'All access: nothing is locked or hidden.' : `Viewing as ${title()}.`); }
  function choose(v) { save(v); syncPicker(); say(); }
  U.on('persona:role', (el) => { const cur = read(); choose(el.value === 'all' || !roleById[el.value] ? null : { role: el.value, grant: cur ? cur.grant : 'none' }); });
  U.on('persona:grant', (el) => { const cur = read() || { role: 'nonop' }; choose({ role: cur.role, grant: el.value }); });
  U.on('persona:all', () => { choose(null); });
  /* from the comparison page: a role keeps the grant; a grant keeps the role, or starts from the role that adds least */
  U.on('persona:set', (el) => { const cur = read(); const role = el.getAttribute('data-role'); const grant = el.getAttribute('data-grant'); choose(role ? { role, grant: cur ? cur.grant : 'none' } : { role: cur ? cur.role : 'nonop', grant }); });

  /* ── #/personas ── */
  function page() {
    const v = read(); const grants = GRANTS.filter((g) => g.id !== 'none');
    const cols = ROLES.map((r) => ({ kind: 'role', id: r.id, name: r.name, sets: r.sets, on: !!v && v.role === r.id }))
      .concat(grants.map((g) => ({ kind: 'grant', id: g.id, name: g.name, sets: g.sets, on: !!v && v.grant === g.id })));
    const head = `<tr><th scope="col" rowspan="2">What it gives</th><th scope="colgroup" colspan="${ROLES.length}" class="pz-g">Role: every person has exactly one</th><th scope="colgroup" colspan="${grants.length}" class="pz-g">Admin grant: none, or one</th></tr>`
      + `<tr>${cols.map((c) => `<th scope="col"${c.on ? ' class="on"' : ''}>${esc(c.name)}</th>`).join('')}</tr>`;
    const rows = SETS.map((s) => `<tr><th scope="row">${esc(s.label)}<span class="pz-what">${esc(s.what)}</span></th>${cols.map((c) => `<td${c.on ? ' class="on"' : ''}>${c.sets.indexOf(s.id) >= 0 ? '<span class="pz-y" aria-label="Yes">✓</span>' : '<span class="pz-n" aria-label="No">–</span>'}</td>`).join('')}</tr>`);
    const card = (c, who, also) => {
      const yes = SETS.filter((s) => c.sets.indexOf(s.id) >= 0);
      return `<section class="pz-card${c.on ? ' on' : ''}"><header><h3>${esc(c.name)}</h3>${c.on ? U.chip('Viewing as', { tone: 'ok' }) : U.btn('View as', { act: 'persona:set', data: c.kind === 'role' ? { role: c.id } : { grant: c.id }, kind: 'ghost', small: true })}</header>`
        + `<p class="pz-who">${esc(who)}</p><dl><dt>${c.kind === 'role' ? 'Gives' : 'Adds to the role'}</dt><dd><ul>${yes.map((s) => `<li>${esc(s.label)}</li>`).join('')}</ul></dd>${also ? `<dt>Not in this prototype</dt><dd>${esc(also)}</dd>` : ''}</dl></section>`;
    };
    const body = U.note('A person has one role, the same at every plant, and at most one admin grant. Pick both in the top bar or here, then walk the prototype. Configuration is for the Global Admin only, so it is not there for anyone else. On the screens a person does get, what they may not change is locked: a click on it says what it needs.', 'quiet')
      + `<div class="pz-scroll"><table class="pz-t"><thead>${head}</thead><tbody>${rows.join('')}</tbody></table></div>`
      + `<h2 class="pz-h">The five roles</h2><div class="pz-cards">${ROLES.map((r, i) => card(cols[i], r.who, r.also)).join('')}</div>`
      + `<h2 class="pz-h">The four admin grants</h2><div class="pz-cards">${grants.map((g, i) => card(cols[ROLES.length + i], g.who)).join('')}</div>`
      + `<h2 class="pz-h">What this prototype leaves out</h2><ul class="pz-out"><li><b>Licensed modules.</b> A permission works at a plant only where the plant is licensed for its module. Alert and task rules belong to Issue Resolution; sensors and limits belong to IoT. Here every plant has every module.</li>`
      + `<li><b>Exceptions for one person.</b> A permission added or removed for one person at one plant, with a written reason.</li>`
      + `<li><b>The three exception permissions.</b> Remote control of equipment, viewing as another user, and the sensor health dashboard are never part of a role.</li></ul>`;
    return U.page({ title: 'Roles and grants', sub: 'Who can do what in the configuration, from the roles model: five roles, four admin grants, nothing else.', actions: [v ? U.btn('Back to all access', { act: 'persona:all', kind: 'ghost' }) : ''], body });
  }
  U.route('personas', page);

  /* ── wiring ── */
  U.afterRender((main, path) => { if (main && !sees(path)) main.innerHTML = notHere(path); else if (main && settingUp(path)) main.innerHTML = notHere(path); strip(main); lock(); syncPicker(); });
  if (hasDom()) {
    /* a locked control says what it needs, in place of doing nothing */
    document.addEventListener('click', (ev) => {
      const t = ev.target && ev.target.closest ? ev.target.closest('[data-locked]') : null; if (!t) return;
      ev.preventDefault(); ev.stopPropagation(); U.toast(whyNot(t.getAttribute('data-locked')));
    }, true);
    /* sheets, dialogs and the side panel are added outside a render: lock what arrives */
    if (typeof W.MutationObserver === 'function') { let due = false; new W.MutationObserver(() => { if (due) return; due = true; Promise.resolve().then(() => { due = false; lock(); }); }).observe(document.body, { childList: true, subtree: true }); }
  }

  W.V7PERSONA = { SETS, ROLES, GRANTS, setOf, read, save, isAll, can, sees, title, pickerHtml, whyNot, _need: NEED };
}());
