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
    people: 'p7:people-sample p7:usercenter work:usercenter',
    tech: 'p7:lib-accept p7:lib-accept-all p7:lib-accept-eq p7:lib-accept-group p7:lib-accept-type p7:lib-reject p7:lib-reject-confirm p7:lib-reject-group p7:lib-reject-group-confirm p7:limits '
      + 'obj:scada p7:scada-fix obj:astate obj:aoff obj:tier obj:tiersave lib:keep lib:keep-save lib:revert lib:revert-all lib:suggest lib:suggest-send obj:suggest obj:sgsave work:suggest work:cadence work:cadence-save work:lastdone',
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
  function whyNot(set) { if (set === 'setup') return 'This plant is still being set up, and setting a plant up is the Global Admin\'s. A Technical Admin changes its alerts, limits and tasks once it is live.'; const s = setById[set]; return `${title()} cannot do this. It needs "${s ? s.label : set}": ${orList(holders(set))}.`; }

  /* ── what is on screen for them: configuration is there for the Global Admin only ── */
  const TECH_TOO = /^p\/[^/]+\/(readings|differences|activity|alert\/[^/]+)$|^p\/[^/]+\/eq\/[^/]+\/details$/; const PEOPLE_TOO = /^users$/;
  const OPEN = /^(plants|personas)$|^p\/[^/]+$|^p\/[^/]+\/(issues|issue\/[^/]+|tasks|task\/[^/]+|equipment)$|^p\/[^/]+\/eq\/[^/]+(\/(readings|issues|tasks|phone))?$/;
  /* three ways of seeing: 'global' everything · 'tech' the plant with its alerts, limits and deviations · 'plant' the plant's work only */
  function level() { return isGlobal() ? 'global' : can('tech') ? 'tech' : 'plant'; }
  function plantKey(path) { const m = /^p\/([^/]+)/.exec(pathOf(path)); return m ? m[1] : null; }
  function stateOf(key) { try { return W.V7.state(key); } catch (e) { return null; } }
  function pathOf(href) { return String(href || '').replace(/^#\/?/, '').split('?')[0].replace(/\/$/, '') || 'plants'; }
  /* a plant still being set up is the Global Admin's: a Technical Admin gets its issues, tasks and equipment, and changes nothing yet */
  function sees(path) { const p = pathOf(path); return isGlobal() || OPEN.test(p) || (can('tech') && TECH_TOO.test(p) && stateOf(plantKey(p)) !== 'commissioning') || (can('people') && PEOPLE_TOO.test(p)); }
  function setupHere() { return !isGlobal() && stateOf(plantKey(typeof location !== 'undefined' ? location.hash : '')) === 'commissioning'; }
  function settingUp(path) { const m = /^p\/([^/]+)$/.exec(pathOf(path)); if (!m || level() !== 'tech') return null; return stateOf(m[1]) === 'commissioning' ? m[1] : null; }

  /* ── the plant's own screens, for people who do not configure ── */
  function arr(x) { return Array.isArray(x) ? x : []; }
  function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function tabsHtml(key, active) {
    const b = '#/p/' + key; let open = 0; try { open = arr(W.V7.issues(key, { status: 'open' })).length; } catch (e) { open = 0; }
    const items = (level() === 'tech' ? [] : [['home', 'Home', '']]).concat([['issues', 'Issues', '/issues'], ['tasks', 'Tasks', '/tasks'], ['equipment', 'Equipment', '/equipment']]);
    return '<nav class="tabs pz-tabs" role="tablist">' + items.map(([id, label, suf]) => '<a class="tab' + (id === active ? ' on' : '') + '" href="' + esc(b + suf) + '" role="tab"' + (id === active ? ' aria-selected="true"' : '') + '>' + esc(label) + (id === 'issues' && open ? '<span class="tab-n">' + open + '</span>' : '') + '</a>').join('') + '</nav>';
  }
  function activeOf(path) { const m = /^p\/[^/]+\/([a-z]+)/.exec(pathOf(path)); const a = m ? m[1] : 'home'; return a === 'issue' ? 'issues' : a === 'task' ? 'tasks' : a === 'eq' ? 'equipment' : a; }
  function ownTabs(main, path) {
    const pg = main.querySelector('.pg-plant'); const key = plantKey(path); if (!pg || !key || pg.querySelector('.pz-tabs')) return;
    if (level() === 'tech' && stateOf(key) !== 'commissioning') return;          /* a live plant's own tabs do for a Technical Admin */
    const ph = pg.querySelector('.ph'); if (!ph) return; const d = document.createElement('div'); d.innerHTML = tabsHtml(key, activeOf(path)); pg.insertBefore(d.firstChild, ph.nextSibling);
  }
  function roleHome(key) {
    const v = W.V7; let P = {}; let open = []; let due = [];
    try { P = v.plant(key) || {}; open = arr(v.issues(key, { status: 'open' })); due = arr(v.tasks(key)).filter((t) => t.status === 'due'); } catch (e) { /* an empty page still renders */ }
    const b = '#/p/' + key; const setup = P.state === 'commissioning';
    const li = (href, text, tail) => '<li><a href="' + esc(href) + '">' + esc(text) + '</a>' + (tail || '') + '</li>';
    const body = tabsHtml(key, 'home')
      + (setup ? U.note('This plant is still being set up. Until it goes live nothing is sent to anyone, except an Emergency, which reaches the Leads.', 'quiet') : '')
      + U.card({ title: open.length ? pl(open.length, 'open issue') : 'No open issues', body: open.length ? '<ul class="pz-list">' + open.map((i) => li(b + '/issue/' + i.id, i.title, ' ' + U.sev(i.band) + ' <span class="muted">opened ' + esc(U.fmt(i.opened)) + '</span>')).join('') + '</ul>' : '', actions: [U.btn('All issues', { href: b + '/issues', kind: 'ghost', small: true })] })
      + U.card({ title: due.length ? pl(due.length, 'task') + ' due now' : 'No task is due now', body: due.length ? '<ul class="pz-list">' + due.map((t) => li(b + '/task/' + t.id, t.line || t.name, t.everyText ? ' <span class="muted">' + esc(t.everyText) + '</span>' : '')).join('') + '</ul>' : '', actions: [U.btn('All tasks', { href: b + '/tasks', kind: 'ghost', small: true })] })
      + U.card({ title: 'Equipment', sub: pl(P.equipmentCount || 0, 'piece') + ' of equipment, with its readings, issues and tasks.', actions: [U.btn('Open', { href: b + '/equipment', kind: 'ghost', small: true })] });
    return '<div class="pg pg-role">' + U.page({ crumbs: [{ label: can('portfolio') ? 'All your plants' : 'Your plants', href: '#/plants' }, { label: P.name || key }], title: P.name || key, chips: [U.chip(setup ? 'Being set up' : 'Live', { tone: setup ? 'warn' : 'ok' })], sub: (P.type || '') + (P.capacity ? ' · ' + P.capacity : ''), body }) + '</div>';
  }
  function yourPlants() {
    const v = W.V7; const wide = can('portfolio'); let list = []; try { list = arr(v.plants()); } catch (e) { list = []; }
    const cards = list.map((p) => {
      let P = p; let due = 0; try { P = v.plant(p.key) || p; due = arr(v.tasks(p.key)).filter((t) => t.status === 'due').length; } catch (e) { /* keep the short record */ }
      const setup = p.state === 'commissioning'; const b = '#/p/' + p.key;
      const sub = (p.type || '') + ' · ' + (setup ? 'Being set up' : 'Live') + (wide ? ' · ' + (P.openIssues ? pl(P.openIssues, 'open issue') : 'no open issues') + ' · ' + (due ? pl(due, 'task') + ' due' : 'no task due') : '');
      return U.card({ title: p.name, sub, actions: [U.btn('Open', { href: b, kind: 'primary', small: true }), U.btn('Issues', { href: b + '/issues', kind: 'ghost', small: true }), U.btn('Tasks', { href: b + '/tasks', kind: 'ghost', small: true })], cls: 'p7-compact' });
    });
    const how = wide ? 'This role sees all its plants at once, with what is open at each.' : 'This role opens one plant at a time: the list says only which plants it has.';
    return U.page({ title: wide ? 'All your plants' : 'Your plants', sub: how, body: '<div class="pz-plants">' + cards.join('') + '</div>' + U.note('A person sees only the plants they are assigned to. In this prototype everyone is assigned to all four.', 'quiet') });
  }
  function notHere(path) {
    const key = settingUp(path); const who = title();
    if (key) {
      let name = key; try { name = (W.V7.plant(key) || {}).name || key; } catch (e) { /* keep the key */ }
      return U.page({ title: name, sub: 'This plant is still being set up.', body: U.note(`Setting a plant up is configuration, and configuration is the Global Admin's alone. This screen is not there for ${who}. They still have the plant's issues, tasks and equipment.`, 'quiet')
        + `<p class="pz-go">${U.btn('Issues', { href: `#/p/${key}/issues`, kind: 'primary' })}${U.btn('Tasks', { href: `#/p/${key}/tasks` })}${U.btn('Equipment', { href: `#/p/${key}/equipment` })}</p>` });
    }
    return U.page({ title: 'Not there for this person', sub: `Viewing as ${who}.`, body: U.note('This screen is configuration, and configuration is the Global Admin\'s alone. Everyone else gets the plant, its issues, tasks and equipment. A Technical Admin also gets the plant\'s limits and deviations.', 'quiet')
      + `<p class="pz-go">${U.btn(level() === 'plant' ? (can('portfolio') ? 'All your plants' : 'Your plants') : 'All Plants', { href: '#/plants', kind: 'primary' })}${U.btn('Compare roles and grants', { href: '#/personas' })}</p>` });
  }

  /* ── locking and hiding ── */
  function hasDom() { return typeof document !== 'undefined' && !!document && !!document.body && typeof document.querySelectorAll === 'function'; }
  const CFG_WORDS = /^(Assumed|Follows the library|Plant[’']s own value|Not in the library|From the Visualization|Changed here|Library changed since|[Ff]rom the library|Real Visualization)$/;
  /* sentences that name where a setting came from, said without it */
  const PLAIN = [[/ · from the library/g, ''], [/Readings from the Visualization/g, 'Readings'], [/ of \d+ database types, as read from the Visualization\./g, '.'], [/Newest first\. A false alarm counts in Coverage\./g, 'Newest first.'],
    [/ Assumed for now; the plant team agrees it later\./g, ''], [/Problems the library knows for/g, 'Known problems for'], [/From the workbook: how each one is found/g, 'How each one is found'], [/The library lists no problems for (.+) yet\./g, 'None listed for $1 yet.'],
    [/The Visualization sends no readings for (.+)\./g, 'No readings on $1.'], [/Limits live on the reading; every alert on it follows them\./g, 'Each reading with its limits.'],
    [/^Commissioning$/g, 'Being set up'], [/Commissioning since/g, 'Being set up since'], [/, day \d+ of the trial\./g, '.'], [/During Commissioning no alert opens one/g, 'While the plant is being set up no alert opens one']];
  function plainWords(main) {
    if (!main || typeof document.createTreeWalker !== 'function') return; const w = document.createTreeWalker(main, 4, null); let n = w.nextNode();
    while (n) { let t = n.nodeValue; if (t && /library|Visualization|Coverage|Assumed|workbook|Limits live|Commissioning|of the trial/.test(t)) { PLAIN.forEach(([re, to]) => { t = t.replace(re, to); }); if (t !== n.nodeValue) n.nodeValue = t; } n = w.nextNode(); }
  }
  function lock(root) {
    if (!hasDom()) return;
    const list = (root || document.body).querySelectorAll('[data-act]');
    for (let i = 0; i < list.length; i++) {
      const el = list[i]; const set = setOf(el.getAttribute('data-act'), el);
      if (!set || el.getAttribute('data-locked')) continue;
      const early = set === 'tech' && can('tech') && setupHere();
      if (can(set) && !early) continue;
      el.setAttribute('data-locked', early ? 'setup' : set); el.setAttribute('aria-disabled', 'true'); el.setAttribute('title', whyNot(early ? 'setup' : set));
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName || '')) el.disabled = true;
      /* a button for configuring is not there for someone who does not configure; work they are not allowed stays, locked, with the reason */
      if (set !== 'work' && set !== 'approve' && set !== 'readplant') {
        if (el.classList.contains('btn')) {
          el.setAttribute('data-gone', '1');
          /* a card that exists only for that button goes with it */
          const card = el.closest('section.card, section.sec'); const h = card && card.querySelector('h2'); if (h && h.textContent.trim() === el.textContent.replace(/…$/, '').trim()) card.setAttribute('data-gone', '1');
        }
        else if (el.disabled) { const dd = el.closest('dd'); const dt = dd && dd.previousElementSibling; if (dd && dt && dt.tagName === 'DT') { dd.setAttribute('data-gone', '1'); dt.setAttribute('data-gone', '1'); } }
      }
    }
    const lv = level(); document.body.setAttribute('data-view', lv);
    const links = document.body.querySelectorAll('a[href^="#/"]');
    for (let i = 0; i < links.length; i++) {
      const a = links[i]; const href = a.getAttribute('href');
      if (sees(href) && !(lv === 'plant' && /[?&]show=diffs/.test(href))) { a.removeAttribute('data-nosee'); continue; }
      a.setAttribute('data-nosee', a.classList.contains('btn') || a.classList.contains('tab') || a.classList.contains('filter') || a.closest('.tb') ? 'hide' : 'text');
    }
    if (lv !== 'plant') return;
    /* what only says where a setting came from, or that set-up is unfinished, means nothing to someone who does not configure */
    const bits = document.body.querySelectorAll('main .chip, main .p7-sub, main .inc, main .tab-flag, main .wk-setup, main .o-hint');
    plainWords(document.querySelector('main'));
    const mine = can('portfolio') ? 'All your plants' : 'Your plants'; const back = document.body.querySelectorAll('#tbNav a[href="#/plants"], main .crumbs a[href="#/plants"]');
    for (let i = 0; i < back.length; i++) if (back[i].textContent !== mine) back[i].textContent = mine;
    for (let i = 0; i < bits.length; i++) { const e = bits[i]; if (e.matches('.inc, .tab-flag, .chip-lib, .chip-changed, .wk-setup, .o-hint') || CFG_WORDS.test((e.textContent || '').trim())) e.setAttribute('data-cfg', '1'); }
    const ths = document.body.querySelectorAll('main table thead th');
    for (let i = 0; i < ths.length; i++) {
      const th = ths[i]; if ((th.textContent || '').trim() !== 'Deviations') continue; th.setAttribute('data-cfg', '1');
      const ix = Array.prototype.indexOf.call(th.parentNode.children, th); const rows = th.closest('table').querySelectorAll('tbody tr');
      for (let r = 0; r < rows.length; r++) { const td = rows[r].children[ix]; if (td) td.setAttribute('data-cfg', '1'); }
    }
  }
  function strip(main) {
    if (!main || !hasDom()) return; const old = main.querySelector('.pz-strip'); if (old) old.remove();
    if (isAll()) return;
    const mine = sets(); const yes = SETS.filter((s) => !s.info && mine.indexOf(s.id) >= 0).map((s) => s.label.toLowerCase());
    const d = document.createElement('div'); d.className = 'pz-strip'; d.setAttribute('role', 'status');
    const tail = level() === 'global' ? '' : level() === 'tech' ? ' Set-up, structure, libraries, flows and go live are the Global Admin\'s: not there.' : ' Configuration is the Global Admin\'s: not there.';
    d.innerHTML = `<span><b>Viewing as ${esc(title())}.</b> Can: ${esc(yes.join('; '))}.${esc(tail)}</span>`
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
      + '<h2 class="pz-h">The screens each one gets</h2><div class="pz-scroll"><table class="pz-t pz-s"><thead><tr><th scope="col">Who</th><th scope="col">Screens</th></tr></thead><tbody>'
      + '<tr><th scope="row">Any role, no grant<span class="pz-what">Operator, Lead, Senior Lead, Regular Non-op, Senior Non-op</span></th><td>Their plants. For each plant: Home (open issues and tasks due), Issues, Tasks, and Equipment with its readings, issues and tasks. Nothing about where a setting came from.</td></tr>'
      + '<tr><th scope="row">With People Admin</th><td>The same, and the User Center.</td></tr>'
      + '<tr><th scope="row">With Technical Admin or Full Site Admin</th><td>All Plants with how each is doing. For each live plant: how the alerts are doing, each alert, Readings with their limits, Deviations, the details of a piece of equipment, and Activity. A plant still being set up: its issues, tasks and equipment only.</td></tr>'
      + '<tr><th scope="row">With Global Admin</th><td>Everything: setting a plant up, its structure, Alerts &amp; Tasks, go live, the libraries, flows and the Visualization.</td></tr></tbody></table></div>'
      + `<h2 class="pz-h">The five roles</h2><div class="pz-cards">${ROLES.map((r, i) => card(cols[i], r.who, r.also)).join('')}</div>`
      + `<h2 class="pz-h">The four admin grants</h2><div class="pz-cards">${grants.map((g, i) => card(cols[ROLES.length + i], g.who)).join('')}</div>`
      + `<h2 class="pz-h">What this prototype leaves out</h2><ul class="pz-out"><li><b>Licensed modules.</b> A permission works at a plant only where the plant is licensed for its module. Alert and task rules belong to Issue Resolution; sensors and limits belong to IoT. Here every plant has every module.</li>`
      + `<li><b>Exceptions for one person.</b> A permission added or removed for one person at one plant, with a written reason.</li>`
      + `<li><b>The three exception permissions.</b> Remote control of equipment, viewing as another user, and the sensor health dashboard are never part of a role.</li></ul>`;
    return U.page({ title: 'Roles and grants', sub: 'Who can do what in the configuration, from the roles model: five roles, four admin grants, nothing else.', actions: [v ? U.btn('Back to all access', { act: 'persona:all', kind: 'ghost' }) : ''], body });
  }
  U.route('personas', page);

  /* ── wiring ── */
  U.afterRender((main, path) => {
    if (main) {
      const p = pathOf(path); const lv = level();
      if (!sees(p) || settingUp(p)) main.innerHTML = notHere(p);
      else if (lv === 'plant' && p === 'plants') main.innerHTML = yourPlants();
      else if (lv === 'plant' && /^p\/[^/]+$/.test(p)) main.innerHTML = roleHome(plantKey(p));
      else if (lv !== 'global') ownTabs(main, p);
    }
    strip(main); lock(); syncPicker();
  });
  if (hasDom()) {
    /* a locked control says what it needs, in place of doing nothing */
    document.addEventListener('click', (ev) => {
      const t = ev.target && ev.target.closest ? ev.target.closest('[data-locked]') : null; if (!t) return;
      ev.preventDefault(); ev.stopPropagation(); U.toast(whyNot(t.getAttribute('data-locked')));
    }, true);
    /* the side panel is for deciding what the library proposes: someone who does not configure goes straight to the equipment's page */
    document.addEventListener('click', (ev) => {
      if (level() !== 'plant' || ev.ctrlKey || ev.metaKey || ev.shiftKey || !ev.target || !ev.target.closest) return;
      if (ev.target.closest('button, input, select, textarea, label, summary')) return;
      const t = ev.target.closest('a[href], [data-href]'); const href = t ? (t.getAttribute('href') || t.getAttribute('data-href')) : '';
      if (!/^#\/p\/[^/]+\/eq\/[^/]+$/.test(href || '')) return;
      ev.preventDefault(); ev.stopImmediatePropagation(); U.go(href);
    }, true);
    /* a row that would open a screen that is not there does nothing */
    document.addEventListener('click', (ev) => {
      const r = ev.target && ev.target.closest ? ev.target.closest('[data-href]') : null; if (!r || sees(r.getAttribute('data-href'))) return;
      if (ev.target.closest('a,button')) return; ev.preventDefault(); ev.stopPropagation();
    }, true);
    /* sheets, dialogs and the side panel are added outside a render: lock what arrives */
    if (typeof W.MutationObserver === 'function') { let due = false; new W.MutationObserver(() => { if (due) return; due = true; Promise.resolve().then(() => { due = false; lock(); }); }).observe(document.body, { childList: true, subtree: true }); }
  }

  W.V7PERSONA = { SETS, ROLES, GRANTS, setOf, read, save, isAll, can, sees, title, pickerHtml, whyNot, _need: NEED };
}());
