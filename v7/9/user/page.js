/* v7/9 · user/page.js — the review page around the phone: the live phone, what drives each screen, and every screen at a glance. */
(function () {
  'use strict';
  const W = window; const U = W.USER; const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CON = '../prototype.html#'; const plural = (n, a, b) => `${n} ${n === 1 ? a : b || a + 's'}`;
  const link = (label, route) => `<a href="${CON}${route}">${esc(label)}</a>`;
  const followers = [];

  /* which console setting stands behind the screen the live phone shows */
  function drives(I) {
    const r = I.route(); const lead = I.S.role === 'lead' && r[0] === 'home'; const P = '/p/' + U.KEY;
    const D = {
      home: ['The plant, at a glance', [['The unit processes and the equipment in each', 'Structure', P + '/structure'], ['The criticality beside each: its unit process, lowered where the step keeps running without the equipment', 'Equipment', P + '/equipment'], ['What is open and what is due: the alerts and tasks the plant accepted', 'Alerts & Tasks', P + '/library']]],
      lead: ['What the Lead is told, and when', [['A late task: reminder times set per criticality', 'Criticality timelines', P + '/library'], ['An issue nobody has started: times and who is told, set per severity', 'Severity timelines', P + '/library'], ['The library holds the starting values; a plant may keep its own', 'Library', '/library']]],
      up: ['One unit process', [['Its equipment and the sensors that take part in it, on equipment or on a pipe', 'Structure', P + '/structure'], ['The readings and their limits', 'Readings', P + '/readings'], ['Its criticality, from its library type', 'Alerts & Tasks', P + '/library']]],
      search: ['Search', [['Finds the plant, its unit processes and its equipment as the console placed them', 'Structure', P + '/structure']]],
      tasks: ['Tasks', [['Each line is a task the plant accepted from the library, with its kind and how often', 'Alerts & Tasks', P + '/library'], ['A task on a condition comes from an alert that raises a task', 'Alerts & Tasks', P + '/library'], ['The reminder when one runs late follows the equipment\'s criticality', 'Criticality timelines', P + '/library']]],
      task: ['A task and its flow', [['The steps are the flow linked to the task in the library', 'Flows', '/flows'], ['A step is an instruction, a reading to enter, a yes or no check or a wait, and may ask for a photo', 'Flows', '/flows'], ['The words in other languages are kept with the flow', 'Languages', '/languages']]],
      issues: ['Issues', [['An issue opens when an accepted alert fires: a reading past a limit, or several readings together', 'Alerts & Tasks', P + '/library'], ['Its severity is the limit that was crossed', 'Readings', P + '/readings'], ['A person can also report a known problem of the equipment\'s type', 'Library', '/library']]],
      issue: ['An issue, its cause and its fix', [['What fired: the limits and the hold time set on the reading', 'Readings', P + '/readings'], ['Who is told and when: the severity timeline', 'Severity timelines', P + '/library'], ['The causes to pick from, and the fix flow each one opens', 'Flows', '/flows'], ['A fix step can point at a task of the library', 'Flows', '/flows']]],
      report: ['Report a problem', [['The known problems listed for the equipment\'s type', 'Library', '/library']]],
      lang: ['Language', [['The four languages of the operator\'s text, each a draft until someone marks it read', 'Languages', '/languages']]],
    };
    const d = D[lead ? 'lead' : r[0]] || D.home;
    return `<h3>${esc(d[0])}</h3><ul>${d[1].map((x) => `<li>${esc(x[0])}. <span class="pg-where">Set in ${link(x[1], x[2])}</span></li>`).join('')}</ul>`;
  }

  function start() {
    const root = $('#us-root');
    if (!W.V7 || !U) { root.innerHTML = '<p class="pg-fail">The console\'s data did not load, so there is nothing to show. Open this page from the same site as the prototype.</p>'; return; }
    try { W.V7.boot(); } catch (e) { /* the set-up it has is used */ }
    const VM = U.vm = U.build();
    if (!VM.ok || !VM.ups || !VM.ups.length) { root.innerHTML = '<p class="pg-fail">The plant has not been read into the console yet, so there is nothing to show. Open the prototype, read the plant in, and come back.</p>'; return; }
    const PR = U.presets(VM); const c = VM.counts; const live = VM.plant.state === 'live';
    /* what this page is showing, said plainly */
    $('#us-state').innerHTML = `<p><b>${esc(VM.plant.name)} is ${live ? 'Live' : 'still being set up'} in the console.</b> ${live ? 'These screens are drawn from its accepted set-up.' : 'Nothing is sent to anyone until go live, so these screens show what its people will get on the day it goes live.'} `
      + (c.tasksAccepted ? `The task lists use the ${plural(c.tasksAccepted, 'task line')} accepted so far, out of ${c.tasks} the library drafts.` : `No task is accepted yet, so the task lists use all ${plural(c.tasks, 'task line')} the library drafts for the plant.`)
      + ` The issues are made from its alerts: ${c.alerts} on a reading${c.alertsAccepted ? ` (${c.alertsAccepted} accepted)` : ''} and ${c.across} across readings${c.acrossApplied ? ` (${c.acrossApplied} applied)` : ''}. Accept or leave out lines in the console and this page follows.`
      + `</p><p><b>Sample values.</b> Due times, the reading that fires, how long ago an issue opened and who is on it are made up for the walk-through: this page runs no clock and no sensors. Everything else is read from the set-up: the unit processes, the equipment and its criticality, the tasks and their steps, the limits, who is told and when, the causes and their fix flows.</p>`;

    /* the live phone */
    const liveEl = $('#us-live'); const drv = $('#us-drives');
    const I = U.mount(liveEl, PR.today(), { onDraw: (inst) => { drv.innerHTML = drives(inst); document.querySelectorAll('[data-role]').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === inst.S.role))); }, onLang: syncLang });
    function syncLang() { const sel = $('#us-lang'); if (sel) sel.value = U.globalLang(); followers.forEach((f) => { if (!f.S.lang) f.draw(); }); }
    const sel = $('#us-lang'); sel.innerHTML = U.LANGS.map((l) => `<option value="${l.id}">${esc(l.own)}${l.own === l.name ? '' : ' · ' + esc(l.name)}</option>`).join(''); sel.value = U.globalLang();
    sel.addEventListener('change', () => { try { W.V7LANG.set(sel.value); } catch (e) { /* stays as it was */ } I.draw(); syncLang(); });
    document.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-role], [data-jump], [data-reset]'); if (!b) return;
      if (b.hasAttribute('data-role')) { const s = PR.today(); s.role = b.getAttribute('data-role'); I.set(s); return; }
      if (b.hasAttribute('data-reset')) { I.set(PR.today()); return; }
      const k = b.getAttribute('data-jump'); if (PR[k]) { I.set(PR[k]()); if (b.closest('.pg-group')) $('#live').scrollIntoView({ block: 'start' }); }
    });

    /* every screen at a glance: each frame is the same app, started at one state */
    const fr = (cap, key, lang) => ({ cap, key, lang });
    const G = [
      ['s-today', '1 · Today at the plant', 'What the Operator opens the app to: what needs them now, then the plant as its unit processes in flow order. Search finds a unit process or a piece of equipment. Report raises a known problem by hand.', 'today',
        [fr('Overview', 'today'), fr('A unit process: its equipment, its sensors, what is open and due', 'up'), fr('Search: a match plus one level below it', 'search'), fr('Report a problem', 'report')]],
      ['s-task', '2 · A task and its flow', 'Tasks are listed time first, each with its kind, where it is and the criticality of that equipment. Opening one shows its steps; Start walks them one at a time.', 'taskStart',
        [fr('Tasks today', 'tasks'), fr('Before starting', 'taskStart'), fr('An instruction', 'taskStep'), fr('A wait, or a yes or no check', 'taskWait'), fr('A reading to enter', 'taskReading'), fr('A photo', 'taskPhoto'), fr('Done', 'taskDone')]],
      ['s-issue', '3 · An alert becomes an issue', 'An accepted alert that fires opens an issue with the severity of the limit that was crossed. The issue says what fired, who was told, and what happens if nobody starts.', 'issueOpen',
        [fr('Issues, worst first', 'issues'), fr('What fired, who was told', 'issueOpen'), fr('What did you find? The causes to pick from', 'issueCauses')]],
      ['s-fix', '4 · The fix flow', 'Picking a cause opens its fix flow: the same step-by-step screen as a task. A fix step can be a task of its own. The last step checks it worked, then the issue closes.', 'fixStep',
        [fr('First fix step', 'fixStep'), fr('A reading or a photo inside the fix', 'fixReading'), fr('A fix step that is a task of its own', 'fixLink'), fr('Check it worked', 'verify'), fr('Closed', 'closed')]],
      ['s-lead', '5 · What the Lead sees', 'The Lead is told when a task runs late or an issue is not started. How late, and who is told next, follows the equipment\'s criticality for a task and the issue\'s severity for an issue.', 'lead',
        [fr('Late tasks and issues nobody has started', 'lead')]],
      ['s-lang', '6 · Language', 'Every screen can be read in English, Hindi, Marathi or Tamil. The words of the screen are always translated. Names and steps from the set-up are translated where the console holds a translation, and shown in English, marked, where it does not yet.', 'lang',
        [fr('English', 'taskStep', 'en'), fr('Hindi', 'taskStep', 'hi'), fr('Marathi', 'taskStep', 'mr'), fr('Tamil', 'taskStep', 'ta'), fr('Choosing the language', 'lang')]],
    ];
    $('#us-gallery').innerHTML = G.map(([id, title, lede, jump, frames]) => { const fs = frames.filter((f) => PR[f.key]);
      return `<section class="pg-group" id="${id}"><header><h2>${esc(title)}</h2><p>${esc(lede)}</p><button type="button" class="pg-btn" data-jump="${jump}">Show it in the live phone ↑</button></header><div class="pg-frames">${fs.map((f, i) => `<figure class="pg-fr"><figcaption>${esc(f.cap)}</figcaption><div class="us-ph"><div class="us-app" data-g="${id}:${i}"></div></div></figure>`).join('')}</div></section>`; }).join('');
    G.forEach(([id, , , , frames]) => frames.filter((f) => PR[f.key]).forEach((f, i) => { const el = document.querySelector(`[data-g="${id}:${i}"]`); const s = PR[f.key](); if (f.lang) s.lang = f.lang; const inst = U.mount(el, s, { fixedLang: !!f.lang }); followers.push(inst); }));
    document.querySelectorAll('[data-jump]').forEach((b) => { if (!PR[b.getAttribute('data-jump')]) b.hidden = true; });
    $('#us-loaded').textContent = `Read from ${W.US_LOAD ? W.US_LOAD.from : 'the console'}${W.US_LOAD && W.US_LOAD.missing.length ? `; ${W.US_LOAD.missing.length} file(s) did not load` : ''}.`;
    /* the set-up changed in the console (another tab): offer to draw again */
    W.addEventListener('storage', (ev) => { if (!ev.key || ev.key === 'ctl79.lang') { I.draw(); syncLang(); return; } const n = $('#us-changed'); if (n) n.hidden = false; });
    W.USER.live = I;
  }
  start();
})();
