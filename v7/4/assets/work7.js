/* v7 · work7.js · window.V7WORK — issues and tasks being worked.

   Loads after core7.js (window.V7) and ui7.js (window.V7UI); before decisions7.js. Reads V7 defensively (call()), never edits it.

   ROUTES
     p/:plant/issues        Issues at a plant: what needs attention first, then open, then closed; filters (?show=open|closed|false|
                            commissioning|reported, ?eq=<eqId>); Commissioning ones marked; "Report a problem".
     p/:plant/issue/:id     One issue. Main column, in the order the work happens: Diagnosis (a step-by-step runner over the diagnostic:
                            answer buttons, a number for a reading step; "I know the reason") → Root cause ("Caused by BL-1" when the
                            cause sits on other equipment) → Fix (numbered steps with ticks; a step that names a general task links to it
                            and comes back) → Verify ("Do the readings show it worked?" yes → closed, no → back to the diagnosis).
                            Aside: what fired and the terms it opened under ("Opened under the old limit …" when the alert moved since),
                            who was told, what happened. "Close as a false alarm" asks why (it counts in Coverage).
     p/:plant/task/:id      One task: a plant task (schedule or set-level group, as V7.task) or, from a fix step, a general task from
                            the library that this plant does not schedule (its steps, read-only). On which equipment, how often with its
                            source chip ("Change how often" with a reason), next due, last done (editable date), steps with ticks, done →
                            next due. ?from=<issueId>&step=<stepId> shows "Done: back to the issue" (ticks that fix step).

   EXPORTS  window.V7WORK = { issuesPage, issuePage, taskPage, openReport(key, eqId?), reportButton(key, eqId?, opts), issueList(key, opts),
            issueItem(key, issue, opts), statusChip(issue), toldSummary(issue), hrefIssue(key,id), hrefTask(key,id,query) }
            Any page can open "Report a problem" with a button: data-act="work:report" data-plant="<key>" [data-eq="<eqId>"].
            issueList(key, {eqId, limit, empty}) renders an equipment's issues (its own and the ones it caused) for the object page.
   CSS      assets/work7.css (added at load through V7UI.addCss). */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const U = W.V7UI;
  if (!U) { if (W.console) console.error('work7.js needs ui7.js (window.V7UI) loaded first'); return; }
  const V = () => W.V7 || null;
  const SOFT = Array.isArray(U._soft) ? U._soft : [];

  /* ── small helpers ─────────────────────────────────────────────────────────────────────────────────────── */
  function call(fn, fb) { try { const v = fn(); return v === undefined || v === null ? fb : v; } catch (e) { SOFT.push('work7: ' + String(e && e.message || e)); if (SOFT.length > 200) SOFT.shift(); return fb; } }
  const esc = U.esc;
  const H = (html) => ({ html: String(html == null ? '' : html) });
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = encodeURIComponent;
  const MIN = 60000; const DAY = 1440 * MIN;
  const BAND = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const RANK = { caution: 1, minor: 2, major: 3, emergency: 4 };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
  const joinWords = (list) => { const l = arr(list).filter(Boolean); return l.length <= 1 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`; };
  const clean = (s) => String(s == null ? '' : s).replace(/[.\s]+$/, '');
  const flowName = (f) => clean(String(f && f.name || '').replace(/^Fix:\s*/i, '').replace(/^(Cleaning|Preventive maintenance|Routine check|Routine work|Manual testing|Calibration)\s*-\s*/i, ''));

  const now = () => call(() => V().now(), Date.UTC(2026, 9, 29, 3, 30));
  const fmt = (ms) => (ms == null ? '—' : U.fmt(ms));
  const fmtDay = (ms) => (ms == null ? '—' : U.fmtDay(ms));
  const fmtTime = (ms) => call(() => V().fmtTime(ms), U.fmt(ms).split(', ').pop());
  const dur = (ms) => call(() => V().fmtDur(Math.max(0, ms) / MIN), `${Math.round(Math.max(0, ms) / MIN)} min`);
  const openFor = (ms) => (ms < MIN ? 'just opened' : `open for ${dur(ms)}`);
  const val = (v, unit, kind) => call(() => V().fmtVal(v, unit, kind), U.num(v, unit));
  const isoDay = (ms) => (ms == null ? '' : new Date(ms + 330 * MIN).toISOString().slice(0, 10));

  /* links (every one resolves to a registered route) */
  const base = (key) => `#/p/${enc(key)}`;
  const hrefIssue = (key, id) => `${base(key)}/issue/${enc(id)}`;
  const hrefIssues = (key, q) => `${base(key)}/issues${q ? '?' + q : ''}`;
  const hrefTask = (key, id, q) => `${base(key)}/task/${enc(id)}${q ? '?' + q : ''}`;
  const hrefEq = (key, eqId, tab) => `${base(key)}/eq/${enc(eqId)}${tab ? '/' + tab : ''}`;
  const hrefAlert = (key, id) => `${base(key)}/alert/${enc(id)}`;
  const libCode = (typeName) => { const c = (W.CATALOGUE_BY_TYPE && W.CATALOGUE_BY_TYPE[typeName]) || arr(W.CATALOGUE).find((x) => x.type === typeName); return c ? c.code : null; };

  /* reads */
  const plantOf = (key) => arr(call(() => V().plants(), [])).find((p) => p && p.key === key) || null;
  const isLive = (key) => call(() => V().state(key), '') === 'live';
  const eqOf = (key, id) => (id ? call(() => V().eq(key, id), null) : null);
  const tagOf = (key, id) => { const e = eqOf(key, id); return e ? e.tag : id || ''; };
  const sensorOf = (key, id) => (id ? arr(call(() => V().sensors(key), [])).find((s) => s.id === id) || null : null);
  const alertOf = (key, id) => (id ? call(() => V().alert(key, id), null) : null);
  const flowOf = (id) => (id ? call(() => V().flowOf(id), null) : null);
  const causeOf = (id) => (id ? call(() => V().causeOf(id), null) : null);
  const issueOf = (key, id) => call(() => V().issue(key, id), null);
  const latestOf = (key, sensorId) => (sensorId ? call(() => V().latest(key, sensorId), null) : null);
  const issueType = (id) => (id ? arr(W.ISSUES).find((i) => i.id === id) || null : null);

  /* how a problem is found, in plain words */
  const FOUND = { sensor: 'a reading', visual: 'a visual check', manual: 'a lab or manual test' };
  const foundText = (kinds) => { const k = arr(kinds).map((x) => FOUND[x]).filter(Boolean); return k.length ? `Found by ${joinWords([...new Set(k)]).replace(/ and /, ' or ')}` : ''; };
  const homeChip = () => U.chip('Where it belongs: assumed', { tone: 'warn', title: 'Which equipment this problem belongs to is still to be confirmed. It stays where the workbook put it for now.' });

  /* the plant page frame (plant7), or a plain one with the same tabs */
  const TABS = [['home', 'Home', ''], ['equipment', 'Equipment', '/equipment'], ['readings', 'Readings', '/readings'], ['issues', 'Issues', '/issues'], ['tasks', 'Tasks', '/tasks'], ['differences', 'Deviations', '/differences'], ['activity', 'Activity', '/activity']];
  function plantChips(p) { return [U.chip(p.type || '', { mono: true }), U.stateChip(p.state), p.sample === false ? U.chip('Real Visualization', { tone: 'info' }) : U.chip('Sample plant', { tone: 'muted' })]; }
  function frame(key, active, body) {
    const F = W.V7PLANT && W.V7PLANT.frame;
    if (typeof F === 'function') { const out = call(() => F(key, active, body), null); if (out) return out; }
    const p = plantOf(key) || { name: key, type: '', state: '' };
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name }], title: p.name, chips: plantChips(p), tabs: TABS.map(([id, label, s]) => ({ id, label, href: base(key) + s })), active, body });
  }
  function noPlant() { return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', body: U.empty('This plant is not in the prototype.', U.btn('All Plants', { href: '#/plants' })) }); }
  function notFound(key, what, back, backLabel) {
    const p = plantOf(key);
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p ? p.name : key, href: base(key) }, { label: 'Not found' }], title: `No such ${what}`, body: U.empty(`This ${what} is not at ${p ? p.name : 'this plant'}. Resetting the story clears what was opened after the start.`, U.btn(backLabel, { href: back })) });
  }

  /* ── issues: status, rows, who was told ────────────────────────────────────────────────────────────────── */
  const STATUS = { open: ['Open · not started', 'warn'], diagnosing: ['Diagnosing', 'info'], fixing: ['Fixing', 'info'], verifying: ['Verifying', 'info'] };
  const DOING = { open: 'not started yet', diagnosing: 'being diagnosed', fixing: 'being fixed', verifying: 'waiting to be verified' };
  function closedLabel(iss) {
    if (iss.falseAlarm || iss.closedHow === 'false alarm') return 'Closed · false alarm';
    if (iss.closedHow === 'reading') return 'Closed by the reading';
    if (iss.closedHow === 'sensor fault') return 'Closed · sensor fault';
    return 'Closed';
  }
  function statusChip(iss) {
    if (!iss) return '';
    if (iss.status === 'closed') return U.chip(closedLabel(iss), { tone: iss.falseAlarm ? 'muted' : 'ok' });
    const s = STATUS[iss.status] || [cap(iss.status), 'info'];
    return U.chip(s[0], { tone: s[1] });
  }
  function issueChips(key, iss, opts) {
    const o = opts || {}; const out = [U.sev(iss.band), statusChip(iss)];
    if (iss.commissioning) out.push(U.chip('Commissioning', { tone: 'info', title: 'Opened during the Commissioning trial: told to the Leads only, with no call and no hooter, and kept out of the counts' }));
    if (iss.causedBy) out.push(U.chip(o.eqId && o.eqId === iss.causedBy && iss.eqId !== o.eqId ? `Caused here · about ${tagOf(key, iss.eqId)}` : `Caused by ${tagOf(key, iss.causedBy)}`, { tone: 'warn' }));
    if (iss.reported) out.push(U.chip('Reported', { tone: 'muted', title: 'Reported by a person, not opened by an alert' }));
    if (iss.homeToConfirm) out.push(homeChip());
    return out;
  }
  function issueItem(key, iss, opts) {
    const e = eqOf(key, iss.eqId); const where = e ? e.tag : 'The plant'; const t = now();
    let sub;
    if (iss.status !== 'closed') sub = `${where} · opened ${fmt(iss.opened)} · ${openFor(t - iss.opened)}, ${DOING[iss.status] || 'open'}`;
    else {
      const c = causeOf(iss.diag && iss.diag.causeId);
      const why = iss.falseAlarm ? 'false alarm' : c ? c.name : iss.closedHow === 'reading' ? 'the reading came back' : '';
      sub = `${where} · ${fmt(iss.opened)} to ${fmt(iss.closed)} (${dur(iss.closed - iss.opened)})${why ? ' · ' + why : ''}`;
    }
    const tone = iss.status === 'closed' ? '' : (RANK[iss.band] || 0) >= 3 ? 'bad' : 'warn';
    return { title: iss.title, href: hrefIssue(key, iss.id), chips: issueChips(key, iss, opts), sub, tone };
  }
  function issueList(key, opts) {
    const o = opts || {}; let list = arr(call(() => V().issues(key, o.eqId ? { eqId: o.eqId } : {}), []));
    if (o.status) list = list.filter((i) => (o.status === 'open' ? i.status !== 'closed' : i.status === o.status));
    if (!list.length) return U.empty(o.empty || 'No issues here.');
    const shown = o.limit ? list.slice(0, o.limit) : list;
    return U.list(shown.map((i) => issueItem(key, i, o)), { cls: 'wk-issues' }) + (o.limit && list.length > o.limit ? `<p class="wk-more">${U.link(`All ${list.length} issues`, hrefIssues(key, o.eqId ? 'eq=' + enc(o.eqId) : ''))}</p>` : '');
  }

  /* who was told: a summary line from the record itself, then one line per person */
  function toldGroups(told) {
    const m = new Map();
    arr(told).forEach((x) => { const k = `${x.who}|${x.role || ''}`; if (!m.has(k)) m.set(k, { who: x.who, role: x.role, hows: [], times: [] }); const g = m.get(k); if (!g.hows.includes(x.how)) g.hows.push(x.how); if (x.at != null && !g.times.includes(x.at)) g.times.push(x.at); });
    return [...m.values()].map((g) => Object.assign(g, { hows: g.hows.sort((x, y) => howRank(x) - howRank(y)) }));
  }
  const HOW_ORDER = ['phone call', 'WhatsApp', 'SMS', 'full-screen alarm', 'in the app', 'morning email', 'hooter'];
  const howRank = (h) => { const i = HOW_ORDER.indexOf(h); return i < 0 ? 50 : i; };
  const HOW = { 'phone call': 'a phone call', 'full-screen alarm': 'the full-screen alarm', 'in the app': 'the app', 'morning email': 'the morning email', hooter: 'the hooter' };
  function toldSummary(iss) {
    const told = arr(iss && iss.told); if (!told.length) return 'Nobody was told: there was nobody to tell in the User Center.';
    const hows = [...new Set(told.map((x) => x.how))].sort((x, y) => howRank(x) - howRank(y));
    if (iss.commissioning) {
      const ch = hows.filter((h) => h !== 'in the app' && h !== 'hooter' && h !== 'phone call' && h !== 'full-screen alarm');
      return `${ch.length ? `${joinWords(ch)} and the app` : 'The app'} to the Leads; no call, no hooter`;
    }
    const people = toldGroups(told.filter((x) => x.how !== 'hooter'));
    const roles = {}; people.forEach((p) => { const r = p.role || 'Person'; roles[r] = (roles[r] || 0) + 1; });
    const who = joinWords(Object.keys(roles).map((r) => plural(roles[r], r)));
    const ways = joinWords(hows.filter((h) => h !== 'hooter').map((h) => HOW[h] || h));
    return `${who ? who + ': ' : ''}${cap(ways)}${hows.includes('hooter') ? ', and the plant hooter' : ''}`;
  }

  /* ── issues list page ──────────────────────────────────────────────────────────────────────────────────── */
  function reportButton(key, eqId, o) {
    o = o || {};
    return U.btn(o.label || 'Report a problem', { act: 'work:report', data: { plant: key, eq: eqId || null }, kind: o.kind || 'secondary', small: !!o.small, title: 'Open an issue for something a person saw, with its diagnostic' });
  }
  /* v7/3: what can open an issue at this plant, as it is set up — every alert on the equipment with its state, the alerts the
     library proposes that nobody has decided, and the ones that cannot be used because the Visualization sends no such reading.
     One row per alert and equipment type. This is what the Issues tab shows while a plant is being set up. */
  function issueSetup(key, eqF) {
    const v = V(); const live = call(() => v.state(key), '') === 'live';
    const alerts = arr(call(() => v.alerts(key), [])).filter((a) => !a.nextPhase && (!eqF || a.eqId === eqF));
    const props = arr(call(() => v.libraryReview(key), [])).flatMap((r) => arr(r.proposals)).filter((p) => p.kind === 'alert' && !p.decided && (!eqF || p.eqId === eqF));
    const waiting = props.filter((p) => !p.blockedBy); const blocked = props.filter((p) => p.blockedBy);
    const sub = live ? 'Every alert below opens an issue when its reading crosses a limit.' : 'What will open an issue once the plant is Live. Until then nothing opens: alerts On trial only count trial firings.';
    const libBtn = waiting.length ? U.btn(`Decide the ${waiting.length} proposed`, { href: `${base(key)}/library`, kind: 'primary', small: true }) : '';
    if (!alerts.length && !props.length) return U.section('Issues this plant can raise', U.empty('Nothing here can open an issue yet. Alerts arrive from the library for each piece of equipment that sends a reading.'), { sub, cls: 'wk-setup' });
    const typeOf = (eqId) => { const e = call(() => v.eq(key, eqId), null); return (e && e.type) || ''; };
    const G = {}; const order = [];
    const add = (name, type, item) => { const k = name + '|' + type; if (!G[k]) { G[k] = { name, type, items: [] }; order.push(G[k]); } G[k].items.push(item); };
    alerts.forEach((a) => add(String(a.name).replace(/\s+\u2014\s+.*$/, ''), typeOf(a.eqId), { state: a.state, tag: a.eqTag, eqId: a.eqId, href: hrefAlert(key, a.id), when: call(() => v.limitsText(a.bands, a.dir, a.unit, a.kind), ''), then: a.flowName ? `Diagnostic flow: ${flowName({ name: a.flowName })}` : 'No diagnostic flow yet' }));
    waiting.forEach((p) => add(p.name, p.typeName || typeOf(p.eqId), { state: 'proposed', tag: p.tag, eqId: p.eqId, href: hrefEq(key, p.eqId), when: p.detail || '', then: 'The diagnostic flow the library gives it', soft: true }));
    blocked.forEach((p) => add(p.name, p.typeName || typeOf(p.eqId), { state: 'blocked', tag: p.tag, eqId: p.eqId, href: hrefEq(key, p.eqId), why: p.blockedBy }));
    const LABEL = { proposed: 'Proposed', draft: 'Draft', trial: 'On trial', on: 'On', off: 'Off', blocked: 'Can\u2019t be used yet' }; const TONE = { proposed: 'warn', blocked: 'muted', on: 'ok', off: 'muted' }; const SEQ = ['proposed', 'draft', 'trial', 'on', 'off', 'blocked'];
    const uniq = (xs) => [...new Set(xs.filter(Boolean))];
    const usable = order.filter((g) => g.items.some((i) => i.state !== 'blocked')); const dead = order.filter((g) => g.items.every((i) => i.state === 'blocked'));
    const rank = (g) => (g.items.some((i) => i.state === 'proposed') ? 0 : 1);
    usable.sort((a, b) => rank(a) - rank(b) || a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const tagLinks = (items0, n) => { const seen = new Set(); const items = items0.filter((i) => (seen.has(i.tag) ? false : seen.add(i.tag))); return tagLinksOf(items, n); };
    const tagLinksOf = (items, n) => items.slice(0, n).map((i) => `<a class="mono" href="${esc(i.href)}">${esc(i.tag)}</a>`).join(' ') + (items.length > n ? ` <span class="muted">and ${items.length - n} more</span>` : '');
    const rows = usable.map((g) => {
      const act = g.items.filter((i) => i.state !== 'blocked'); const whens = uniq(act.map((i) => i.when)); const firm = act.filter((i) => !i.soft); const thens = uniq((firm.length ? firm : act).map((i) => i.then));
      return { n: `<b>${esc(g.name)}</b><div class="muted small">${esc(g.type)}</div>`, e: tagLinks(act, 6),
        s: SEQ.filter((s) => g.items.some((i) => i.state === s)).map((s) => { const c = g.items.filter((i) => i.state === s).length; return U.chip(`${LABEL[s]}${g.items.length > 1 ? ' \u00b7 ' + c : ''}`, { tone: TONE[s] || '' }); }).join(' '),
        w: whens.length === 1 ? esc(whens[0]) : whens.length ? '<span class="muted">Set on each piece of equipment</span>' : '<span class="muted">No limits yet</span>', t: thens.length === 1 ? esc(thens[0]) : '<span class="muted">Set on each alert</span>' };
    });
    const table = rows.length ? U.table({ cols: [{ label: 'Issue', key: 'n' }, { label: 'Equipment', key: 'e' }, { label: 'State', key: 's' }, { label: 'Opens when', key: 'w' }, { label: 'Then', key: 't' }], rows, cls: 'wk-setup-t' }) : U.empty('No alert here can be used yet: the Visualization sends none of the readings they need.');
    const nSet = alerts.length; const bits = [nSet ? `${plural(nSet, 'alert')} set up` : '', waiting.length ? `${waiting.length} proposed, waiting for a decision` : '', blocked.length ? `${blocked.length} can\u2019t be used yet` : ''].filter(Boolean);
    const why = {}; blocked.forEach((p) => { (why[p.blockedBy] = why[p.blockedBy] || []).push(p); });
    const deadHtml = blocked.length ? `<details class="wk-setup-more"><summary>${blocked.length} can\u2019t be used yet, and why</summary>${Object.keys(why).map((k) => { const names = uniq(why[k].map((p) => p.name)); return `<p><b>${esc(k)}</b> \u00b7 ${plural(why[k].length, 'alert')} on ${plural(uniq(why[k].map((p) => p.eqId)).length, 'piece')} of equipment<br><span class="muted">${esc(names.slice(0, 8).join(', '))}${names.length > 8 ? ` and ${names.length - 8} more` : ''}</span></p>`; }).join('')}<p class="muted small">Add the sensor in the Visualization and read it again, and these arrive as proposed.</p></details>` : '';
    return U.section('Issues this plant can raise', `<p class="wk-setup-sum">${esc(bits.join(' \u00b7 '))}</p>${table}${deadHtml}`, { sub, actions: [libBtn], cls: 'wk-setup' });
  }
  function issuesPage(params) {
    const key = params.plant; const p = plantOf(key); if (!p) return noPlant();
    const q = params._q || {};
    const eqF = q.eq && eqOf(key, q.eq) ? q.eq : null;
    let all = arr(call(() => V().issues(key, {}), []));
    if (eqF) all = all.filter((i) => i.eqId === eqF || i.causedBy === eqF);
    const open = all.filter((i) => i.status !== 'closed'); const closed = all.filter((i) => i.status === 'closed');
    const groups = { open, closed, false: closed.filter((i) => i.falseAlarm), commissioning: all.filter((i) => i.commissioning), reported: all.filter((i) => i.reported) };
    const show = groups[q.show] ? q.show : 'all';
    const qs = (s) => [s !== 'all' ? 'show=' + s : '', eqF ? 'eq=' + enc(eqF) : ''].filter(Boolean).join('&');
    const fl = [{ label: 'Everything', href: hrefIssues(key, qs('all')), on: show === 'all', count: all.length }, { label: 'Open', href: hrefIssues(key, qs('open')), on: show === 'open', count: open.length }, { label: 'Closed', href: hrefIssues(key, qs('closed')), on: show === 'closed', count: closed.length }];
    if (groups.false.length || show === 'false') fl.push({ label: 'False alarms', href: hrefIssues(key, qs('false')), on: show === 'false', count: groups.false.length });
    if (groups.commissioning.length || show === 'commissioning') fl.push({ label: 'Commissioning', href: hrefIssues(key, qs('commissioning')), on: show === 'commissioning', count: groups.commissioning.length });
    if (groups.reported.length || show === 'reported') fl.push({ label: 'Reported', href: hrefIssues(key, qs('reported')), on: show === 'reported', count: groups.reported.length });
    let filtersHtml = U.filters(fl);
    if (eqF) filtersHtml += `<p class="wk-only">Only ${esc(tagOf(key, eqF))}, and the issues it caused · ${U.link('Show every issue', hrefIssues(key, show !== 'all' ? 'show=' + show : ''))}</p>`;

    // attention first
    // attention first: open issues lead the list itself; with nothing open, say so (and why, during Commissioning)
    let lead = '';
    if (open.length) {
      if (show !== 'all' && show !== 'open') { const top = open[0]; lead = `<p class="lead has-att"><b>${esc(plural(open.length, 'open issue'))}.</b> ${open.length > 1 ? 'The most serious: ' : ''}${U.link(top.title, hrefIssue(key, top.id))} at ${esc(BAND[top.band] || top.band)}, ${esc(DOING[top.status] || 'open')}.</p>`; }
    } else if (p.state === 'commissioning') {
      lead = `<p class="lead">Nothing is open. During Commissioning, alerts On trial only count trial firings, Emergencies included.</p>`;
    } else lead = `<p class="lead">Nothing is open${closed.length ? `. The last one closed ${esc(fmt(closed[0].closed))}` : ''}.</p>`;

    let body;
    if (!all.length) {
      const none = eqF ? `No issues on ${tagOf(key, eqF)}.` : p.state === 'commissioning' ? 'No issues yet.' : 'No issues yet. Move the story clock on to see alerts open them.';
      return frame(key, 'issues', `<div class="wk">${U.section('Issues', '', { sub: p.state === 'commissioning' ? 'An issue is what opens once the plant is Live. During Commissioning no alert opens one; a person can report a problem at any time.' : 'An issue is what opens when an alert fires, or when a person reports a problem.', actions: [reportButton(key, eqF, { kind: 'primary' })] })}${eqF ? filtersHtml : ''}${p.state === 'commissioning' ? issueSetup(key, eqF) + `<p class="p7-quietline">No issue has opened or been reported at this plant.</p>` : `<div class="wk-list">${U.empty(none)}</div>` + issueSetup(key, eqF)}</div>`);
    }
    const listOf = (list, empty, limit) => {
      if (!list.length) return U.empty(empty);
      const lim = limit && q.n !== 'all' ? limit : 0; const shown = lim ? list.slice(0, lim) : list;
      return U.list(shown.map((i) => issueItem(key, i, { eqId: eqF })), { cls: 'wk-issues' }) + (lim && list.length > lim ? `<p class="wk-more">${U.link(`Show all ${list.length}`, hrefIssues(key, [qs(show), 'n=all'].filter(Boolean).join('&')))}</p>` : '');
    };
    if (show === 'all') {
      body = (open.length ? U.section(`Open · ${open.length}`, listOf(open, ''), { sub: open.length > 1 ? 'The most serious first.' : '' }) : '')
        + (closed.length || !open.length ? U.section(`Closed · ${closed.length}`, listOf(closed, p.state === 'commissioning' ? 'No issues yet.' : 'No issues yet. Move the story clock on to see alerts open them.', 25), { sub: closed.length ? 'Newest first. A false alarm counts in Coverage.' : '' }) : '');
    } else {
      const EMPTY = { open: 'Nothing is open.', closed: 'Nothing has closed yet.', false: 'No false alarms.', commissioning: 'No issues opened during Commissioning.', reported: 'Nothing has been reported by a person.' };
      body = listOf(groups[show], EMPTY[show], show === 'closed' || show === 'false' ? 25 : 0);
    }
    const head = U.section('Issues', '', { sub: p.state === 'commissioning' ? 'An issue is what opens once the plant is Live. During Commissioning no alert opens one; a person can report a problem at any time.' : 'An issue is what opens when an alert fires, or when a person reports a problem.', actions: [reportButton(key, eqF, { kind: 'primary' })] });
    return frame(key, 'issues', `<div class="wk">${head}${lead}${filtersHtml}<div class="wk-list">${body}</div>${issueSetup(key, eqF)}</div>`);
  }

  /* ── one issue ─────────────────────────────────────────────────────────────────────────────────────────── */
  function step(n, title, state, body, o) {
    o = o || {};
    const mark = `<span class="wk-n" aria-hidden="true">${state === 'done' ? '✓' : state === 'skip' ? '–' : n}</span>`;
    const sr = state === 'done' ? 'done' : state === 'skip' ? 'skipped' : state === 'now' ? 'now' : 'later';
    return `<section class="wk-st is-${state}${o.tone ? ' tone-' + o.tone : ''}" aria-label="${esc(`${title}: ${sr}`)}">${mark}<div class="wk-sb"><header class="wk-sh"><h2>${esc(title)}</h2>${o.sub ? `<p>${o.sub}</p>` : ''}</header>${body ? `<div class="wk-bd">${body}</div>` : ''}${o.foot ? `<footer class="wk-sf">${o.foot}</footer>` : ''}</div></section>`;
  }
  const dataOf = (key, iss, more) => Object.assign({ plant: key, id: iss.id }, more || {});

  function pathHtml(flow, path) {
    if (!path.length) return '';
    /* v7: an answer given by someone else (the Operator who started it) says who and when */
    return `<ol class="wk-path">${path.map((p) => { const st = flow ? flow.steps.find((x) => String(x.id) === String(p.stepId)) : null; const a = typeof p.answer === 'number' ? U.num(p.answer) : p.answer; const by = p.by ? ` <span class="muted small">· ${esc(p.by)}${p.at != null ? `, ${esc(fmtTime(p.at))}` : ''}</span>` : ''; return `<li><span>${esc(st ? st.text : 'A step')}${by}</span><b>${esc(a)}</b></li>`; }).join('')}</ol>`;
  }
  /* the reading a diagnostic reading step asks for, on this equipment first, else anywhere at the plant */
  function readingFor(key, iss, st) {
    const kind = st.sensorKind; if (!kind) return null;
    const all = arr(call(() => V().sensors(key), [])).filter((s) => !s.nextPhase && s.name === kind);
    return all.find((s) => s.eqId === iss.eqId) || all[0] || null;
  }
  function diagCard(key, iss, flow) {
    const path = arr(iss.diag && iss.diag.path); const closed = iss.status === 'closed'; const c = causeOf(iss.diag && iss.diag.causeId);
    const sub = flow ? `${esc(flowName(flow))} · from the library` : '';
    if (c) {
      const how = path.length ? pathHtml(flow, path) : `<p class="muted">${iss.sensorFault && !flow ? 'Reported as a sensor fault, so there was nothing to diagnose.' : 'Skipped: the reason was known.'}</p>`;
      return step(1, 'Diagnosis', 'done', how, { sub: `${sub ? sub + ' · ' : ''}found the root cause` });
    }
    if (closed) return step(1, 'Diagnosis', path.length ? 'done' : 'skip', path.length ? pathHtml(flow, path) : '<p class="muted">Not diagnosed before it closed.</p>', { sub });
    const cur = call(() => V().diagStep(key, iss.id), null);
    const causes = arr(call(() => V().causesFor(key, iss.id), []));
    const know = causes.length ? U.btn('I know the reason', { act: 'work:causes', data: dataOf(key, iss), kind: 'ghost', small: true }) : '';
    if (iss.diag && iss.diag.open) {
      const body = pathHtml(flow, path) + `<p class="wk-q">${esc(clean(iss.diag.open))}.</p><p class="muted small">The diagnostic has no more questions. Pick the root cause if you found it, or close the issue with a note of what you found.</p>`;
      const foot = (causes.length ? U.btn('Pick the root cause', { act: 'work:causes', data: dataOf(key, iss), kind: 'primary' }) : '') + U.btn('Close with a note', { act: 'work:closenote', data: dataOf(key, iss), kind: causes.length ? 'ghost' : 'primary' });
      return step(1, 'Diagnosis', 'now', body, { sub, foot });
    }
    if (!cur) {
      const body = `<p>No diagnostic is written for this problem yet.</p>${causes.length ? '<p class="muted small">Its root causes are known: pick the one you found.</p>' : '<p class="muted small">Close it with a note of what you found and did.</p>'}`;
      const foot = (causes.length ? U.btn('Pick the root cause', { act: 'work:causes', data: dataOf(key, iss), kind: 'primary' }) : '') + U.btn('Close with a note', { act: 'work:closenote', data: dataOf(key, iss), kind: causes.length ? 'ghost' : 'primary' });
      return step(1, 'Diagnosis', 'now', body, { sub, foot });
    }
    const n = path.length + 1; const total = flow ? flow.steps.length : 0;
    let ask;
    if (cur.type === 'reading') {
      const s = readingFor(key, iss, cur); const lt = s ? latestOf(key, s.id) : null; const unit = s ? s.unit : '';
      const hint = s && lt && lt.v != null ? `Latest ${s.name} on ${s.eqTag || 'the plant'}: ${val(lt.v, s.unit, s.kind)} (sample readings). Check it, or type what you measured.` : 'Type what you measured.';
      ask = `<form class="wk-read" data-act="work:reading" data-plant="${esc(key)}" data-id="${esc(iss.id)}" data-step="${esc(cur.id)}"><label for="wk-reading">${esc(clean(cur.text))}</label>`
        + `<div class="wk-read-in"><input id="wk-reading" name="v" type="number" step="any" inputmode="decimal" required${lt && lt.v != null ? ` value="${esc(Math.round(lt.v * 100) / 100)}"` : ''}>${unit ? `<span class="wk-unit">${esc(unit)}</span>` : ''}${U.btn('Record', { submit: true, kind: 'primary' })}</div>`
        + `<p class="field-h">${esc(hint)}</p></form>`;
    } else if (cur.answers && Object.keys(cur.answers).length) {
      const keys = Object.keys(cur.answers);
      ask = `<p class="wk-q">${esc(cur.text)}</p><div class="wk-ans">${keys.map((k) => U.btn(k, { act: 'work:answer', data: dataOf(key, iss, { step: cur.id, answer: k }) })).join('')}</div>`;
    } else {
      ask = `<p class="wk-q">${esc(cur.text)}</p><div class="wk-ans">${U.btn('Done', { act: 'work:answer', data: dataOf(key, iss, { step: cur.id, answer: 'Done' }) })}</div>`;
    }
    const body = `<p class="wk-qn">Question ${n}${total ? ` of up to ${total}` : ''}</p>${ask}${path.length ? `<details class="wk-so"><summary>Answered so far · ${path.length}</summary>${pathHtml(flow, path)}</details>` : ''}`;
    return step(1, 'Diagnosis', 'now', body, { sub, foot: know });
  }

  function causedByHtml(key, iss) {
    if (!iss.causedBy) return '';
    const e = eqOf(key, iss.causedBy); const own = eqOf(key, iss.eqId);
    return `<p class="wk-cb">${U.chip(`Caused by ${e ? e.tag : iss.causedBy}`, { tone: 'warn' })} The root cause sits on ${e ? U.link(`${e.tag} (${e.type})`, hrefEq(key, e.id, 'issues')) : 'other equipment'}, so this issue also shows on its Issues tab. It stays about ${own ? esc(own.tag) : 'the equipment'}, where the reading fired.</p>`;
  }
  function calibrationTask(key, iss) {
    if (!iss.sensorId) return null;
    return arr(call(() => V().tasks(key, { eqId: iss.eqId }), [])).find((t) => t.workType === 'calibration') || null;
  }
  function causeCard(key, iss, sensor) {
    const c = causeOf(iss.diag && iss.diag.causeId); const closed = iss.status === 'closed';
    if (!c) return step(2, 'Root cause', closed ? 'skip' : 'next', closed ? '<p class="muted">No root cause was recorded.</p>' : '', { sub: closed ? '' : 'The diagnosis lands on it, or pick it if you know it.' });
    const ff = call(() => V().fixFlowFor(c.id, sensor ? sensor.name : null), null);
    const started = iss.fix && (iss.fix.flowId || iss.status === 'verifying' || closed);
    const chips = [c.sensorFault ? U.chip('Sensor fault', { tone: 'info', title: 'The reading was wrong, not the process: the fix is the probe' }) : '', c.noFault ? U.chip('Nothing wrong', { tone: 'ok' }) : ''].filter(Boolean).join(' ');
    let body = `<p class="wk-cause">${esc(clean(c.name))}${chips ? ' ' + chips : ''}</p>${causedByHtml(key, iss)}`;
    if (c.sensorFault) {
      const ct = calibrationTask(key, iss);
      body += `<p class="muted small">A sensor fault: the fix is the probe's calibration${sensor ? ` (${esc(sensor.name)})` : ''}.${ct ? ` The calibration task here: ${U.link(ct.name, hrefTask(key, ct.id))}.` : ''}</p>`;
    }
    if (started) return step(2, 'Root cause', 'done', body, {});
    body += `<p class="muted small">${ff ? `The fix: ${esc(flowName(ff))} · ${esc(plural(ff.steps.length, 'step'))}.` : 'No fix steps are written for this root cause: do what is needed, then check the readings.'}</p>`;
    const foot = U.btn('Start the fix', { act: 'work:startfix', data: dataOf(key, iss), kind: 'primary' }) + U.btn('Choose a different root cause', { act: 'work:causes', data: dataOf(key, iss), kind: 'ghost', small: true });
    return step(2, 'Root cause', 'now', body, { foot });
  }

  /* a fix or task step that names a general task (or a workbook problem) links to it */
  function linkLines(key, iss, st, from) {
    const lt = call(() => V().linkedTask(st), null); if (!lt) return '';
    return arr(lt.all && lt.all.length ? lt.all : [lt]).map((x) => {
      if (x.kind === 'task') {
        const tid = call(() => V().taskForGeneral(key, x.id, (iss && (iss.causedBy || iss.eqId)) || null), null) || x.id;
        const q = from ? `from=${enc(from.issueId)}&step=${enc(from.stepId)}` : '';
        return `<p class="wk-link">${U.link(`Open the task: ${cleanTaskName(x.name)}`, hrefTask(key, tid, q))}<span class="muted small"> · ${esc(plural(arr(x.steps).length, 'step'))}${tid === x.id ? ' · not scheduled here' : ''}</span></p>`;
      }
      if (x.kind === 'issue') {
        const it = issueType(x.id); const code = it ? libCode(arr(it.homeTypes)[0]) : null;
        return `<p class="wk-link">${code ? U.link(`See the problem: ${x.name}`, `#/library/${enc(code)}/issues`) : esc(`See the problem: ${x.name}`)}<span class="muted small"> · in the library</span></p>`;
      }
      return '';
    }).join('');
  }
  const cleanTaskName = (n) => String(n || '').replace(/^(Cleaning|Preventive maintenance|Routine check|Routine work|Manual testing|Calibration)\s*-\s*/i, (m) => '') || n;
  function stepChips(st, f) {
    const full = f ? f.steps.find((x) => String(x.id) === String(st.id)) || st : st; const out = [];
    if (full.type === 'reading') out.push(U.chip('Record a reading', { tone: 'muted' }));
    if (full.type === 'wait') out.push(U.chip(full.minutes ? `Wait ${full.minutes} min` : 'Wait', { tone: 'muted' }));
    if (full.photo === 'required') out.push(U.chip('Photo', { tone: 'muted', title: 'A photo is taken on the phone' }));
    if (full.approve && !/signs? off/i.test(String(full.text || st.text || ''))) out.push(U.chip('The Lead signs off', { tone: 'muted' }));   /* v7: not when the step already says it */
    return out.join(' ');
  }
  function checklist(steps, opt) {
    // opt: {done:[ids], act, data(step) → data, disabled, links(step) → html, chips(step) → html, answers:{stepId: 'Yes'|'No'}}
    const done = arr(opt.done).map(String);
    return `<ol class="wk-check">${steps.map((st, i) => {
      const on = done.includes(String(st.id)); const id = `wk-c-${opt.prefix || 's'}-${i}`;
      /* v7: a question step is answered, not ticked: Yes / No, and the answer stays on the step */
      if (opt.answers && st.type === 'question') {
        const ans = opt.answers[st.id] || null; const chips = opt.chips ? opt.chips(st) : ''; const links = opt.links ? opt.links(st) : '';
        const yn = ['Yes', 'No'].map((a) => (opt.disabled ? (ans === a ? `<b>${a}</b>` : '') : `<button type="button" class="btn btn-sm ${ans === a ? 'btn-primary' : 'btn-ghost'}" aria-pressed="${ans === a ? 'true' : 'false'}" data-act="${esc(opt.act)}"${Object.entries(opt.data(st)).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')} data-answer="${a}">${a}</button>`)).join(' ');
        return `<li class="wk-qs${on ? ' on' : ''}"><span class="wk-qa" aria-hidden="true">${on ? '✓' : ''}</span><div><span class="wk-i">${i + 1}</span><span class="wk-tx">${esc(st.text)}${chips ? ` <span class="wk-ch">${chips}</span>` : ''}</span><div class="wk-yn" role="group" aria-label="${esc(st.text)}">${yn}</div></div>${links ? `<div class="wk-lk">${links}</div>` : ''}</li>`;
      }
      const input = `<input type="checkbox" id="${id}"${on ? ' checked' : ''}${opt.disabled ? ' disabled' : ` data-act="${esc(opt.act)}"${Object.entries(opt.data(st)).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}`}>`;
      const chips = opt.chips ? opt.chips(st) : ''; const links = opt.links ? opt.links(st) : '';
      return `<li class="${on ? 'on' : ''}">${input}<label for="${id}"><span class="wk-i">${i + 1}</span><span class="wk-tx">${esc(st.text)}${chips ? ` <span class="wk-ch">${chips}</span>` : ''}</span></label>${links ? `<div class="wk-lk">${links}</div>` : ''}</li>`;
    }).join('')}</ol>`;
  }
  function fixCard(key, iss, sensor) {
    const c = causeOf(iss.diag && iss.diag.causeId); const closed = iss.status === 'closed';
    const fid = iss.fix && iss.fix.flowId; const f = flowOf(fid);
    if (!f) {
      if (closed) return step(3, 'Fix', 'skip', '<p class="muted">No fix steps were followed.</p>', {});
      if (c && iss.status === 'verifying') return step(3, 'Fix', 'done', '<p class="muted">No fix steps are written for this root cause.</p>', {});
      return step(3, 'Fix', 'next', '', { sub: c ? 'The steps show when you start the fix.' : 'The fix steps come with the root cause.' });
    }
    const done = arr(iss.fix.done); const all = f.steps.length; const n = f.steps.filter((s) => done.map(String).includes(String(s.id))).length;
    const list = checklist(f.steps, { prefix: 'fix', done, answers: (iss.fix && iss.fix.answers) || {}, act: 'work:fixstep', disabled: closed, data: (st) => ({ plant: key, id: iss.id, step: st.id }), chips: (st) => stepChips(st, f), links: (st) => linkLines(key, iss, st, closed ? null : { issueId: iss.id, stepId: st.id }) });
    if (iss.status === 'fixing') {
      const sub = `${esc(flowName(f))} · ${n} of ${all} done ${U.progress(n, all)}`;
      return step(3, 'Fix', 'now', list + '<p class="muted small">Tick each step as it is done, and answer each question. When every step is done, check the readings.</p>', { sub });
    }
    return step(3, 'Fix', 'done', `<details class="wk-so"><summary>${esc(flowName(f))} · ${n === all ? (all === 1 ? 'its one step done' : `all ${all} steps done`) : `${n} of ${all} steps done`}</summary>${list}</details>`, {});
  }
  function readingNow(key, iss, sensor) {
    if (!sensor) return '';
    const lt = latestOf(key, sensor.id); if (!lt || lt.v == null) return '';
    // the issue's own terms (rule 10); a reported issue has none, so the reading's limits now
    const lim = iss.terms ? null : call(() => V().limitsOf(key, sensor.id), null);
    const tm = iss.terms || (lim ? { dir: lim.dir, bands: lim.bands } : {}); const bands = tm.bands || {};
    if (!iss.terms && !Object.values(bands).some((x) => x != null)) return `<div class="wk-now"><p>${esc(`Now ${val(lt.v, sensor.unit, sensor.kind)} at ${fmtTime(lt.t)}`)} ${U.sampleTag()}</p></div>`;
    const inBand = sensor.kind === 'status' ? null : U.bandOf(lt.v, tm.dir, bands);
    const words = `Now ${val(lt.v, sensor.unit, sensor.kind)} at ${fmtTime(lt.t)}${inBand ? `: still in ${BAND[inBand]}` : sensor.kind === 'status' ? '' : ': inside the limits'}`;
    const bar = sensor.kind === 'status' ? '' : U.bandBar({ dir: tm.dir, bands, value: lt.v, valid: sensor.valid, unit: sensor.unit });
    return `<div class="wk-now"><p>${esc(words)} ${U.sampleTag()}</p>${bar}</div>`;
  }
  function closedText(iss) {
    const c = causeOf(iss.diag && iss.diag.causeId);
    if (iss.falseAlarm) { const l = arr(iss.log).slice().reverse().find((x) => /false alarm/i.test(x.text)); const why = l ? String(l.text).replace(/^.*?false alarm[^:]*:\s*/i, '') : ''; return `Closed as a false alarm${why ? ': ' + clean(why) : ''}. It counts in Coverage's false alarms.`; }
    if (iss.closedHow === 'reading') return `Closed by the reading: it came back inside the limits before anyone started it.`;
    if (iss.closedHow === 'sensor fault') return `Closed as a sensor fault${c ? ` (${c.name})` : ''}.`;
    return `Closed${c ? `: ${c.name}` : ''}.`;
  }
  function verifyCard(key, iss, sensor) {
    const closed = iss.status === 'closed';
    if (closed) return step(4, 'Verify and close', 'done', `<p>${esc(closedLabel(iss))} ${esc(fmt(iss.closed))}${iss.closedBy ? ' by ' + esc(iss.closedBy) : ''}.</p>`, {});
    /* v7: attention goes to the diagnosis; "Close as a false alarm" is a quiet second choice here, not the page's first button */
    const falseLink = `<p class="muted small wk-false">Not a real problem? ${U.btn('Close as a false alarm', { act: 'work:false', data: dataOf(key, iss), kind: 'ghost', small: true, title: 'It was not a real problem: say why. It counts in Coverage.' })}</p>`;
    if (iss.status !== 'verifying') return step(4, 'Verify and close', 'next', falseLink, { sub: 'Check the readings once the fix is done.' });
    const q = sensor ? 'Do the readings show it worked?' : 'Is the problem gone?';
    const lt = sensor ? latestOf(key, sensor.id) : null; const still = lt && lt.v != null && sensor.kind !== 'status' && iss.terms ? U.bandOf(lt.v, iss.terms.dir, iss.terms.bands || {}) : null;
    /* v7: show the consequence: closing now records it as fixed while the reading is still in a band, or when the reading came back
       on its own before the fix was done (the last fix step, else the root cause, is the moment the fix happened) */
    const fixAt = arr(iss.log).filter((x) => /^(Done: |All fix steps done|Root cause|Fix started)/.test(String(x.text)) || /\? (Yes|No)$/.test(String(x.text))).reduce((m, x) => Math.max(m, +x.at || 0), 0) || null;
    const before = !still && iss.cleared != null && fixAt != null && iss.cleared < fixAt;
    const body = `<p class="wk-q">${esc(q)}</p>${readingNow(key, iss, sensor)}${still ? `<p class="muted small">The reading has not come back yet: it is still in ${esc(BAND[still] || still)}. Move time on (+1 hour) to watch it. Closing now records the fix as worked while the reading is still in ${esc(BAND[still] || still)}.</p>` : ''}${before ? `<p class="small wk-before"><b>The reading came back at ${esc(fmtTime(iss.cleared))}${fmtDay(iss.cleared) !== fmtDay(now()) ? `, ${esc(fmtDay(iss.cleared))}` : ''}, before the fix.</b> Close it, but it may not have been the fix: the record will say the readings show it worked.</p>` : ''}${falseLink}`;
    const foot = U.btn('Yes: close the issue', { act: 'work:verify', data: dataOf(key, iss, { ok: 1 }), kind: 'primary' }) + U.btn('No: back to the diagnosis', { act: 'work:verify', data: dataOf(key, iss, { ok: 0 }) });
    return step(4, 'Verify and close', 'now', body, { foot });
  }

  /* aside */
  function whatCard(key, iss, sensor) {
    const e = eqOf(key, iss.eqId);
    if (iss.alertId) {
      const a = alertOf(key, iss.alertId); const tm = iss.terms || {}; const terms = call(() => V().issueTerms(key, iss.id), null);
      const peakLabel = sensor && sensor.kind === 'status' ? 'Reading' : tm.dir === 'below' ? 'Lowest' : 'Highest';
      const rows = [
        ['Alert', a ? H(`${U.link(a.name, hrefAlert(key, a.id))} ${U.stateChip(a.state)}`) : iss.title],
        ['Reading', sensor ? H(`${esc(sensor.name)}${sensor.tag ? ` <span class="mono muted">${esc(sensor.tag)}</span>` : ''}${e ? ` on ${U.link(e.tag, hrefEq(key, e.id))}` : ''}`) : '—'],
        ['Band', H(U.sev(iss.band))],
        [peakLabel, iss.peak != null ? H(`${esc(val(iss.peak, tm.unit || (sensor && sensor.unit), sensor && sensor.kind))} ${U.sampleTag()}`) : '—'],
      ];
      if (iss.cleared && iss.status !== 'closed') rows.push(['Back inside', fmt(iss.cleared)]);
      let body = U.kv(rows);
      if (terms) {
        body += `<div class="wk-terms"><p>${esc(terms.text)}.</p></div>`;
        body += terms.changed ? U.note(`${terms.changedText}. This issue keeps the terms it opened under until it closes; the new limit applies to the next one.`, 'warn') : '<p class="muted small">It steps up and clears by these terms, even if the alert\'s limits change while it is open.</p>';
      }
      return U.card({ title: 'What fired', body, cls: 'wk-aside' });
    }
    const it = issueType(iss.issueTypeId); const rep = arr(iss.log)[0];
    const by = rep ? (String(rep.text).match(/^Reported by (.+?)(?: on |:)/) || [])[1] : null;
    const rows = [['Problem', iss.title], ['On', e ? H(U.link(`${e.tag} · ${e.type}`, hrefEq(key, e.id))) : 'The plant'], ['Reported', `${fmt(rep ? rep.at : iss.opened)}${by ? ' by ' + by : ''}`]];
    if (it) { const f = foundText([...new Set(arr(it.detection).map((d) => d.kind))]); if (f) rows.push(['Usually', f.replace(/^Found/, 'found')]); }
    if (iss.sensorId) { const s = sensor; if (s) rows.push(['Reading', `${s.name}${s.tag ? ' · ' + s.tag : ''}`]); }
    let body = U.kv(rows);
    if (iss.homeToConfirm) body += `<p class="mt">${homeChip()} <span class="muted small">Found by a report or a lab test; which equipment it belongs to is still to be confirmed.</span></p>`;
    return U.card({ title: iss.sensorFault ? 'What was reported: a sensor fault' : 'What was reported', body, cls: 'wk-aside' });
  }
  function toldCard(iss) {
    const groups = toldGroups(arr(iss.told).filter((x) => x.how !== 'hooter'));
    const hooter = arr(iss.told).some((x) => x.how === 'hooter');
    const rows = groups.map((g) => `<li><div><b>${esc(g.who)}</b>${g.role ? ` <span class="muted">· ${esc(g.role)}</span>` : ''}</div><div class="muted small">${esc(cap(joinWords(g.hows.map((h) => HOW[h] || h))))} · ${esc(g.times.map((t) => fmtTime(t)).join(', '))}</div></li>`).join('') + (hooter ? '<li><div><b>The plant hooter</b></div></li>' : '');
    const body = `<p class="wk-told-s">${esc(toldSummary(iss))}.</p>${rows ? `<ul class="wk-told">${rows}</ul>` : ''}<p class="muted small">From the User Center. ${U.btn('Edit in the User Center', { act: 'work:usercenter', kind: 'ghost', small: true })}</p>`;
    return U.card({ title: 'Who was told', body, cls: 'wk-aside' });
  }
  function logCard(iss) {
    const log = arr(iss.log); if (!log.length) return '';
    let day = ''; const items = log.map((l) => { const d = fmtDay(l.at); const head = d !== day ? `<li class="wk-day">${esc(d)}</li>` : ''; day = d; return `${head}<li><span class="mono">${esc(fmtTime(l.at))}</span><span>${esc(l.text)}</span></li>`; }).join('');
    return U.card({ title: 'What happened', body: `<ol class="wk-log">${items}</ol>`, cls: 'wk-aside' });
  }

  function issuePage(params) {
    const key = params.plant; const p = plantOf(key); if (!p) return noPlant();
    const iss = issueOf(key, params.id);
    if (!iss) return notFound(key, 'issue', hrefIssues(key), 'All issues here');
    const e = eqOf(key, iss.eqId); const sensor = sensorOf(key, iss.sensorId);
    const flow = flowOf(iss.diag && iss.diag.flowId);
    const closed = iss.status === 'closed';
    const sub = `${e ? `${e.tag} · ${e.type}` : 'The plant'} · opened ${fmt(iss.opened)}${closed ? ` · closed ${fmt(iss.closed)}` : ` · ${openFor(now() - iss.opened)}`}`;
    let banner = '';
    if (closed) banner = U.banner(`${closedText(iss)} Took ${dur(iss.closed - iss.opened)}.`, { tone: iss.falseAlarm ? 'info' : 'ok' });
    else if (iss.commissioning) banner = U.banner('Opened during the Commissioning trial. On a new plant nothing is sent, Emergencies included. It stays out of the counts.', { tone: 'info' });
    const terms = !closed && iss.alertId ? call(() => V().issueTerms(key, iss.id), null) : null;
    if (!closed && terms && terms.changed) banner += U.banner(`${terms.changedText}. It keeps those terms until it closes.`, { tone: 'warn' });
    const main = `<div class="wk-flow">${diagCard(key, iss, flow)}${causeCard(key, iss, sensor)}${fixCard(key, iss, sensor)}${verifyCard(key, iss, sensor)}</div>`;
    const aside = whatCard(key, iss, sensor) + toldCard(iss) + logCard(iss);
    const actions = [];   /* v7: "Close as a false alarm" sits in the Verify and close step */
    return U.page({
      crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }, { label: 'Issues', href: hrefIssues(key) }, { label: iss.title }],
      title: iss.title, sub, chips: issueChips(key, iss).concat(iss.alertId ? [U.sampleTag()] : []), actions, banner, body: main, aside, cls: 'wk wk-issue',
    });
  }

  /* ── modals: report a problem, root causes, false alarm, close with a note ─────────────────────────────── */
  let REPORT = { key: null, eqId: null };
  function reportBody(key, eqId, err) {
    const p = plantOf(key) || {}; const eqs = arr(call(() => V().equipment(key), []));
    const byType = {}; eqs.forEach((e) => { (byType[e.type] = byType[e.type] || []).push(e); });
    const types = Object.keys(byType).sort();
    const countFor = (t) => arr(call(() => V().issueTypes(t), [])).length;
    const opts = types.map((t) => `<optgroup label="${esc(t)}${countFor(t) ? ` · ${plural(countFor(t), 'problem')} in the library` : ''}">${byType[t].map((e) => `<option value="${esc(e.id)}"${e.id === eqId ? ' selected' : ''}>${esc(e.tag)}${e.name && e.name !== e.tag ? ' · ' + esc(e.name) : ''}</option>`).join('')}</optgroup>`).join('');
    let html = U.field({ label: 'Which equipment?', html: `<select name="wk-eq" data-act="work:report-eq" data-plant="${esc(key)}"><option value=""${eqId ? '' : ' selected'}>Choose the equipment…</option>${opts}</select>` });
    const e = eqId ? eqs.find((x) => x.id === eqId) : null;
    if (!e) return html + `<p class="muted small">Pick the equipment first: the problems come from its type in the library.</p>`;
    const its = arr(call(() => V().issueTypes(e.type), []));
    const sens = arr(call(() => V().sensors(key, e.id), [])).filter((s) => !s.nextPhase);
    const options = its.map((it) => ({ value: it.id, label: it.name, sub: [foundText(it.foundBy), it.causes ? `${plural(it.causes, 'root cause')} to check, one question each` : '', it.homeToConfirm ? 'where it belongs: assumed' : ''].filter(Boolean).join(' · ') }));
    if (sens.length) options.push({ value: '__sensor', label: 'A reading looks wrong', sub: 'A sensor fault: the fix is the probe\'s calibration' });
    if (!options.length) return html + U.note(`The library has no problems written for ${e.type} yet, and ${e.tag} has no readings from the Visualization. Tell the Lead directly.`, 'quiet');
    html += its.length ? '' : U.note(`The library has no problems written for ${e.type} yet. A reading that looks wrong can still be reported.`, 'quiet');
    const onlySensor = !its.length;
    html += U.field({ label: `What is wrong with ${e.tag}?`, html: U.radios({ name: 'wk-it', options, value: onlySensor ? '__sensor' : '', act: 'work:report-pick' }) });
    if (sens.length) html += `<div class="wk-rf-sensor"${onlySensor ? '' : ' hidden'}>${U.field({ label: 'Which reading looks wrong?', html: `<select name="wk-sensor">${sens.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}${s.tag ? ' · ' + esc(s.tag) : ''}</option>`).join('')}</select>` })}</div>`;
    if (p.state === 'live') {
      html += `<div class="wk-rf-band"${onlySensor ? ' hidden' : ''}>` + U.field({ label: 'How serious is it?', html: U.radios({ name: 'wk-band', value: 'minor', options: [
        { value: 'minor', label: 'Minor', sub: 'Operators by WhatsApp; Leads in the app' },
        { value: 'major', label: 'Major', sub: 'Operators and Leads by WhatsApp, with the full-screen alarm' },
        { value: 'emergency', label: 'Emergency', sub: 'Calls to everyone, the full-screen alarm and the hooter' },
      ] }) }) + '</div>';
    } else html += U.note('During Commissioning a reported problem is told to the Leads in the app only: no calls, no hooter.', 'quiet');
    if (err) html += U.note(err, 'bad');
    return html;
  }
  const reportSub = (key, e) => `${(plantOf(key) || {}).name || ''}${e ? ' · ' + e.tag : ''}: it opens an issue with its diagnostic`;
  const reportFoot = (key, eqId) => U.btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + U.btn('Open the issue', { act: 'work:report-go', data: { plant: key }, kind: 'primary', disabled: !(eqId && eqOf(key, eqId)) });
  function openReport(key, eqId, err) {
    if (!plantOf(key)) { U.toast('That plant is not in the prototype.'); return; }
    REPORT = { key, eqId: eqId || null };
    const e = eqId ? eqOf(key, eqId) : null;
    U.modal({ title: 'Report a problem', sub: reportSub(key, e), body: reportBody(key, eqId, err), wide: true, foot: reportFoot(key, eqId) });
  }

  function causesModal(key, issueId) {
    const iss = issueOf(key, issueId); if (!iss) return;
    const e = eqOf(key, iss.eqId);
    const cs = arr(call(() => V().causesFor(key, issueId), []));
    const options = cs.map((c) => {
      const elsewhere = e && c.types.length && !c.types.includes(e.type);
      return { value: c.id, label: c.name, sub: [c.sensorFault ? 'Sensor fault: the fix is the probe' : '', elsewhere ? `Sits on a ${c.types.slice(0, 2).join(' or ')}: the issue will say "Caused by"` : '', c.fixFlowId ? 'Has fix steps' : 'No fix steps written'].filter(Boolean).join(' · ') };
    });
    U.modal({ title: 'Which root cause is it?', sub: `${iss.title}: the root causes its diagnostic can land on`, wide: true,
      body: options.length ? U.radios({ name: 'wk-cause', label: 'Root cause', options, value: iss.diag && iss.diag.causeId || '' }) : U.empty('No root causes are written for this problem.'),
      foot: U.btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + (options.length ? U.btn('This is the root cause', { act: 'work:cause-go', data: { plant: key, id: issueId }, kind: 'primary' }) : '') });
  }
  const FALSE_WHY = ['The reading came back by itself', 'The sensor was being cleaned or calibrated', 'Planned work on the equipment', 'The limit is too tight for this plant', 'Something else'];
  function falseModal(key, issueId, err) {
    const iss = issueOf(key, issueId); if (!iss) return;
    const body = U.field({ label: 'Why was it a false alarm?', html: U.radios({ name: 'wk-why', value: '', options: FALSE_WHY.map((w) => ({ value: w, label: w, sub: w === 'The limit is too tight for this plant' && iss.alertId ? 'Then change the limits on the alert, with a reason' : '' })) }) })
      + U.field({ label: 'Note', hint: 'Needed for "Something else"; helps the Lead either way.', html: '<textarea name="wk-note" rows="3" placeholder="What you saw"></textarea>' })
      + '<p class="muted small">It closes now and counts as a false alarm in Coverage, where noisy alerts show up.</p>' + (err ? U.note(err, 'bad') : '');
    U.modal({ title: 'Close as a false alarm', sub: iss.title, body,
      foot: U.btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + U.btn('Close as a false alarm', { act: 'work:false-go', data: { plant: key, id: issueId }, kind: 'primary' }) });
  }
  function closeNoteModal(key, issueId, err) {
    const iss = issueOf(key, issueId); if (!iss) return;
    U.modal({ title: 'Close with a note', sub: iss.title,
      body: U.field({ label: 'What did you find and do?', html: '<textarea name="wk-note" rows="4"></textarea>' }) + (err ? U.note(err, 'bad') : ''),
      foot: U.btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + U.btn('Close the issue', { act: 'work:close-go', data: { plant: key, id: issueId }, kind: 'primary' }) });
  }

  /* ── one task ──────────────────────────────────────────────────────────────────────────────────────────── */
  const TASK_TONE = { due: 'warn', doing: 'info', upcoming: 'muted', waiting: 'muted' };
  function fromBanner(key, q) {
    const iss = q.from ? issueOf(key, q.from) : null; if (!iss) return '';
    const f = flowOf(iss.fix && iss.fix.flowId); const st = f && q.step != null ? f.steps.find((x) => String(x.id) === String(q.step)) : null;
    const idx = st ? f.steps.indexOf(st) + 1 : null; const ticked = st && arr(iss.fix.done).map(String).includes(String(st.id));
    const text = `Part of the fix for "${iss.title}"${idx ? `, step ${idx}` : ''}.${ticked ? ' That step is already ticked.' : ''}`;
    const canTick = st && !ticked && iss.status === 'fixing';
    const action = (canTick ? U.btn('Done: back to the issue', { act: 'work:return', data: { plant: key, id: iss.id, step: st.id }, kind: 'primary' }) : '') + U.btn(canTick ? 'Back without ticking it' : 'Back to the issue', { href: hrefIssue(key, iss.id), kind: canTick ? 'ghost' : 'secondary' });
    return U.banner(text, { tone: 'info', action });
  }
  function generalTaskPage(key, p, gt, q) {
    const f = flowOf(gt.flow); const steps = f ? f.steps : [];
    const rows = [['For', arr(gt.types).join(', ') || (arr(gt.plantTypes).length ? `${arr(gt.plantTypes).join(', ')} plants` : '—')], ['How often in the library', String(gt.frequency || '—').split('\n')[0]], ['Kind of work', gt.actionType || '—']];
    const body = U.card({ title: 'Steps', sub: plural(steps.length, 'step'), body: steps.length ? `<ol class="wk-plain">${steps.map((s) => `<li><span>${esc(s.text)}</span> ${stepChips(s, f)}</li>`).join('')}</ol>` : U.empty('No steps are written for this task.') })
      + U.card({ title: 'About this task', body: U.kv(rows) + U.note(`${p.name} does not schedule this task, so it has no due date here. Its steps are shown so a fix can follow them.`, 'quiet') });
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }, { label: 'Tasks', href: base(key) + '/tasks' }, { label: cleanTaskName(gt.name) }],
      title: cleanTaskName(gt.name), sub: 'A general task from the library', chips: [U.chip('Follows the library', { tone: 'lib' })], banner: fromBanner(key, q), body, cls: 'wk wk-task' });
  }
  function whereHtml(key, t) {
    if (t.plantLevel || !t.eqIds.length) return 'The plant';
    const links = t.eqIds.map((id) => { const e = eqOf(key, id); return e ? U.link(e.tag, hrefEq(key, id, 'tasks')) : esc(id); }).join(', ');
    if (t.kind === 'group') return H(`${t.shared ? esc(cap(t.shared)) + ': ' : ''}${links}${t.toConfirm ? ` ${U.chip('Assumed', { tone: 'warn', title: 'One task per type at the plant, with a line per equipment: still to be confirmed' })}` : ''}`);
    const e = eqOf(key, t.eqIds[0]);
    return H(`${links}${e ? ` <span class="muted">· ${esc(e.type)}</span>` : ''}`);
  }
  function taskPage(params) {
    const key = params.plant; const p = plantOf(key); if (!p) return noPlant();
    const q = params._q || {};
    const t = call(() => V().task(key, params.id), null);
    if (!t) { const gt = arr(W.ISSUE_TASKS).find((x) => x.id === params.id); if (gt) return generalTaskPage(key, p, gt, q); return notFound(key, 'task', base(key) + '/tasks', 'All tasks here'); }
    const live = p.state === 'live'; const f = flowOf(t.flowId); const steps = arr(t.steps);
    const src = t.source || null; const canChange = !!(t.every && t.every.n);
    const lastIso = isoDay(t.lastDone); const today = isoDay(now());
    const mt = t.meter || null;   /* v7: run-hours work is left out of the go-live spread: it falls due by its hour meter */
    const nextDue = !live ? (mt && mt.at != null ? `At go live: when its hour meter reaches ${mt.at} h (about ${Math.max(1, Math.round((mt.at - mt.now) / Math.max(0.1, mt.rateDay || 20)))} days of running)` : 'At go live, spread across its interval so day one is not a pile-up') : t.due == null ? '—' : H(`${esc(fmt(t.due))}${t.overdue ? ' ' + U.chip('Overdue', { tone: 'bad' }) : ''}`);
    const rows = [
      ['On', whereHtml(key, t)],
      ['How often', H(`${esc(t.everyText || '—')} ${src ? U.sourceChip(srcText(src)) : ''}${t.runHours && t.runHours.overrideId && t.basis === 'either' ? ` <span class="muted small">run-hours:</span> ${U.sourceChip(t.runHours)}` : ''}${canChange ? ' ' + U.btn('Change', W.V7OBJ && W.V7OBJ.openCadence ? { act: 'obj:cadence', data: { plant: key, task: t.id }, kind: 'ghost', small: true } : { act: 'work:cadence', data: { plant: key, id: t.id }, kind: 'ghost', small: true }) : ''}`)],
      ['Next due', nextDue],
      ['Last done', H(`<input type="date" class="wk-date" name="wk-last" aria-label="Last done" value="${esc(lastIso)}" max="${esc(today)}" data-act="work:lastdone" data-plant="${esc(key)}" data-id="${esc(t.id)}"><span class="field-h wk-dh">${live ? 'Optional. Next due counts from it.' : 'Optional. At go live the first due date counts from it.'}</span>`)],
    ];
    /* v7: condition-based work: a line on an equipment reading raises it at the plant; it has no interval and no last-done date to set */
    if (t.kind === 'line') {
      const w = t.from || {}; const rd = w.eqId ? `<a href="${esc(base(key) + '/eq/' + encodeURIComponent(w.eqId))}">${esc(w.eqTag)} ${esc(w.reading)}</a>` : esc(w.reading || '');
      rows.length = 0;
      rows.push(['On', t.filed && t.filed.id ? H(`<a href="${esc(base(key) + '/eq/' + encodeURIComponent(t.filed.id))}">${esc(t.filed.tag)}</a>`) : 'The plant'], ['Raised when', H(`${rd} ${esc(w.dir === 'below' ? 'falls below' : 'rises above')} its ${esc(w.bandLabel || '')} line, now ${esc(w.limitText || '—')}. That line opens no issue; the next line out does.`)]);
      if (w.why) rows.push(['Why', w.why]);
      rows.push(['Now', !live ? 'Raised once the plant is live' : t.status === 'due' || t.status === 'doing' ? H(`Raised ${esc(fmt(t.raisedAt || t.due))}${t.raisedBy ? `, at ${esc(call(() => V().fmtVal(t.raisedBy.value, w.unit || '', w.kind), String(t.raisedBy.value)))}` : ''}${t.overdue ? ' ' + U.chip('Overdue', { tone: 'bad' }) : ''}`) : 'Waiting for the reading to cross the line']);
      rows.push(['Last done', t.lastDone ? fmt(t.lastDone) : 'Not yet']);
      if (live && w.eqId) rows.push(['The line', H(U.btn('Change the line', { act: 'obj:limits', data: { plant: key, sensor: w.sensorId, dir: w.dir }, kind: 'ghost', small: true }))]);
    }
    if (t.statutory) rows.push(['Required by law', 'Yes']);
    /* v7: run-hours work is counted by its hour meter (it only counts while the equipment runs), from the last service or go live */
    if (t.basis === 'meter' || t.basis === 'either') rows.push(['Run hours', t.meter ? (live ? `Counted by its hour meter: ${Math.max(0, Math.round(t.meter.left))} run-hours to go (meter at ${Math.round(t.meter.now)} h, due at ${Math.round(t.meter.at)} h; about ${t.meter.rateDay} h a day)` : 'Counted by its hour meter from go live') : (live ? 'Counted by its hour meter since go live' : 'Counted by its hour meter once the plant is live')]);
    const n = steps.filter((s) => arr(t.done).map(String).includes(String(s.id))).length;
    let stepsBody;
    if (!steps.length) stepsBody = U.empty('No steps are written for this task.');
    else stepsBody = checklist(steps, { prefix: 'task', done: t.done, act: 'work:taskstep', disabled: !live, data: (st) => ({ plant: key, id: t.id, step: st.id }), chips: (st) => stepChips(st, f), links: (st) => linkLines(key, null, st, null) });
    const doneBtn = live && !(t.kind === 'line' && t.status !== 'due' && t.status !== 'doing') ? U.btn(t.status === 'upcoming' ? 'Mark it done now' : 'Mark the task done', { act: 'work:taskdone', data: { plant: key, id: t.id }, kind: 'primary' }) : '';
    const stepsCard = U.card({ title: 'Steps', sub: steps.length ? `${n} of ${steps.length} ticked` : '', body: stepsBody + (live ? '' : U.note('Tasks start when the plant goes live. Until then the steps are here to read.', 'quiet')), foot: doneBtn || null });
    const hist = arr(t.history).slice(-5).reverse();
    const histCard = hist.length ? U.card({ title: 'Done before', body: `<ul class="wk-hist">${hist.map((h) => `<li><span>${esc(fmt(h.done))}</span>${h.late ? U.chip('late', { tone: 'warn' }) : U.chip('on time', { tone: 'ok' })}</li>`).join('')}</ul>` }) : '';
    const chips = [W.V7FLAG73 ? W.V7FLAG73.chip(W.V7FLAG73.task(key, t)) : '', U.chip(t.workLabel || 'Task', { tone: 'muted' }), U.chip(t.statusLabel || cap(t.status), { tone: TASK_TONE[t.status] || 'muted' })];
    const lead = live && (t.status === 'due' || t.overdue) ? `<p class="lead has-att">${t.overdue ? 'Overdue' : 'Due now'}: ${t.kind === 'line' ? 'raised' : 'it was due'} ${esc(fmt(t.due))}.</p>` : '';
    const body = lead + (W.V7HELP73 ? W.V7HELP73.task(key, t.id, { open: true, cls: 'hp-card' }) : '') + U.card({ title: 'About this task', body: U.kv(rows) }) + stepsCard + histCard;
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }, { label: 'Tasks', href: base(key) + '/tasks' }, { label: cleanTaskName(t.name) }],
      title: cleanTaskName(t.name), sub: cleanTaskName(t.line || ''), chips, banner: fromBanner(key, q), body, cls: 'wk wk-task' });
  }

  /* a cadence's source with its values in words (the chip's tooltip shows the library value) */
  function srcText(src) { const ev = (x) => (x && typeof x === 'object' ? call(() => V().everyText(x), '') : x); return Object.assign({}, src, { libValue: ev(src.libValue), base: ev(src.base) }); }
  /* how often: the sheet (a change from the library needs a reason, rule 7) */
  const UNITS = ['hour', 'day', 'week', 'month', 'year'];
  function cadenceBody(key, id, err, vals) {
    const t = call(() => V().task(key, id), null); if (!t) return U.empty('No such task.');
    const src = t.source || {}; const lib = src.libValue; const ev = (vals && vals.every) || t.every || { n: 1, unit: 'week' };
    const libText = lib ? call(() => V().everyText(lib), '') : '';
    let html = `<p>${esc(cleanTaskName(t.line || t.name))}: ${esc(t.everyText)} ${U.sourceChip(srcText(src))}${lib && src.chip !== 'lib' ? ` <span class="muted small">Library: ${esc(libText)}</span>` : ''}</p>`;
    html += U.field({ label: 'How often', html: `<div class="wk-every"><span>Every</span><input type="number" name="wk-n" min="1" step="1" value="${esc(ev.n)}"><select name="wk-unit" aria-label="Unit">${UNITS.map((u) => `<option value="${u}"${u === ev.unit ? ' selected' : ''}>${u}${ev.n === 1 ? '' : 's'}</option>`).join('')}</select></div>` });
    if (src.notInLib || !lib) html += U.note('The library has no value for this task, so no reason is needed.', 'quiet');
    else {
      html += U.field({ label: 'Why it differs from the library', hint: 'Not needed if you set it back to the library value.', html: U.radios({ name: 'wk-reason', value: (vals && vals.reason) || '', options: [{ value: 'tuned', label: 'Tuned for this plant', sub: 'Review in 6 months' }, { value: 'fornow', label: 'For now, until …', sub: 'Goes back to the library on the date below' }] }) });
      html += U.field({ label: 'Until (for "For now")', html: `<input type="date" name="wk-until" min="${esc(isoDay(now() + DAY))}" value="${esc((vals && vals.until) || '')}">` });
      html += U.field({ label: 'Note', hint: 'What makes this plant different.', html: `<textarea name="wk-note" rows="3">${esc((vals && vals.note) || '')}</textarea>` });
      if (t.typeName) html += `<p class="muted small">The library is wrong for every plant? ${U.btn('Suggest a library change', { act: 'work:suggest', data: { plant: key, id }, kind: 'ghost', small: true })} (uses the note)</p>`;
    }
    if (err) html += U.note(err, 'bad');
    return html;
  }
  function cadenceFoot(key, id) {
    const t = call(() => V().task(key, id), null); const src = (t && t.source) || {};
    const back = src.overrideId && src.libValue ? U.btn('Back to the library value', { act: 'work:cadence-lib', data: { plant: key, id } }) : '';
    return U.btn('Cancel', { act: 'ui:close', data: { what: 'sheet' }, kind: 'ghost' }) + back + U.btn('Save', { act: 'work:cadence-save', data: { plant: key, id }, kind: 'primary' });
  }

  /* ── events ────────────────────────────────────────────────────────────────────────────────────────────── */
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);
  const rootOf = (el, sel) => (el && el.closest ? el.closest(sel) : null) || (typeof document !== 'undefined' && document.querySelector ? document.querySelector(sel) : null);
  const valIn = (root, name) => { if (!root || !root.querySelector) return ''; const r = root.querySelector(`input[name="${name}"]:checked`); if (r) return r.value; const x = root.querySelector(`[name="${name}"]`); return x && x.type !== 'radio' ? x.value : ''; };
  const fail = (r) => { U.toast((r && r.error) || 'That did not work.'); return false; };

  U.on('work:report', (el) => { openReport(ga(el, 'plant'), ga(el, 'eq')); return false; });
  U.on('work:report-eq', (el) => {
    const key = ga(el, 'plant') || REPORT.key; const eqId = el.value || null; const box = el.closest ? el.closest('.modal') : null;
    const b = box && box.querySelector('.modal-b'); const f = box && box.querySelector('.modal-f'); const s = box && box.querySelector('.modal-s');
    if (!b || !f) { openReport(key, eqId); return false; }
    REPORT = { key, eqId };                                         // in place: no flash, the select keeps focus
    b.innerHTML = reportBody(key, eqId); f.innerHTML = reportFoot(key, eqId);
    if (s) { const e = eqOf(key, eqId); s.textContent = reportSub(key, e); }
    const sel = b.querySelector('select[name="wk-eq"]'); if (sel && sel.focus) sel.focus();
    return false;
  });
  U.on('work:report-pick', (el) => {
    const box = el.closest ? el.closest('.modal') : null; if (!box) return false; const sensor = el.value === '__sensor';
    box.querySelectorAll('.wk-rf-sensor').forEach((x) => { x.hidden = !sensor; }); box.querySelectorAll('.wk-rf-band').forEach((x) => { x.hidden = sensor; });
    return false;
  });
  U.on('work:report-go', (el) => {
    const key = ga(el, 'plant') || REPORT.key; const root = rootOf(el, '.modal');
    const eqId = valIn(root, 'wk-eq') || REPORT.eqId; const it = valIn(root, 'wk-it'); const band = valIn(root, 'wk-band') || 'minor';
    if (!eqId) { openReport(key, null, 'Pick the equipment first.'); return false; }
    if (!it) { openReport(key, eqId, 'Pick what is wrong.'); return false; }
    let r;
    if (it === '__sensor') r = call(() => V().reportSensorFault(key, valIn(root, 'wk-sensor')), { ok: false });
    else r = call(() => V().report(key, eqId, it, { band }), { ok: false });
    if (!r || !r.ok) { openReport(key, eqId, (r && r.error) || 'The issue could not be opened.'); return false; }
    U.closeModal(true);
    U.toast(r.already ? 'That sensor fault is already open: here it is.' : `Issue opened on ${tagOf(key, eqId)}: ${r.issue ? r.issue.title : 'the problem'}. ${it === '__sensor' ? 'Its root cause is the sensor: start the fix.' : 'Its diagnostic is ready.'}`);
    U.go(hrefIssue(key, r.id)); return false;
  });
  U.on('work:answer', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id');
    const r = call(() => V().answer(key, id, ga(el, 'step'), ga(el, 'answer')), { ok: false });
    if (!r.ok) return fail(r);
    afterAnswer(key, id, r);
  });
  U.on('work:reading', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const v = valIn(el, 'v');
    if (v === '' || !isFinite(+v)) { U.toast('Type the reading as a number.'); return false; }
    const r = call(() => V().answer(key, id, ga(el, 'step'), +v), { ok: false });
    if (!r.ok) return fail(r);
    afterAnswer(key, id, r);
  });
  function afterAnswer(key, id, r) {
    if (r.causeId) { const c = causeOf(r.causeId); U.toast(`Root cause found: ${c ? clean(c.name) : 'see below'}${r.causedBy ? `, on ${tagOf(key, r.causedBy)}` : ''}. Start the fix.`); }
    else if (r.open) U.toast('The diagnostic ends here: pick the root cause, or close with a note.');
  }
  U.on('work:causes', (el) => { causesModal(ga(el, 'plant'), ga(el, 'id')); return false; });
  U.on('work:cause-go', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const c = valIn(rootOf(el, '.modal'), 'wk-cause');
    if (!c) { U.toast('Pick a root cause.'); return false; }
    const r = call(() => V().chooseCause(key, id, c), { ok: false }); if (!r.ok) return fail(r);
    U.closeModal(true); const cc = causeOf(c);
    U.toast(`Root cause: ${cc ? clean(cc.name) : c}${r.causedBy ? `, on ${tagOf(key, r.causedBy)}` : ''}. Start the fix.`);
  });
  U.on('work:startfix', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id');
    const r = call(() => V().startFix(key, id), { ok: false }); if (!r.ok) return fail(r);
    const f = flowOf(r.flowId); U.toast(f ? `Fix started: ${flowName(f)}. Tick each step as it is done.` : 'No fix steps for this root cause: check the readings, then verify.');
  });
  U.on('work:fixstep', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id');
    const r = call(() => V().fixStep(key, id, ga(el, 'step'), ga(el, 'answer') || undefined), { ok: false }); if (!r.ok) return fail(r);
    if (r.status === 'verifying') U.toast('Every fix step is done: now check the readings.');
  });
  U.on('work:return', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const iss = issueOf(key, id);
    if (iss && iss.status === 'fixing' && !arr(iss.fix.done).map(String).includes(String(ga(el, 'step')))) {
      const r = call(() => V().fixStep(key, id, ga(el, 'step'), ga(el, 'answer') || undefined), { ok: false }); if (!r.ok) return fail(r);
      U.toast(r.status === 'verifying' ? 'Step ticked. Every fix step is done: now check the readings.' : 'Step ticked: back to the fix.');
    }
    U.go(hrefIssue(key, id)); return false;
  });
  U.on('work:verify', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const ok = ga(el, 'ok') === '1';
    const r = call(() => V().verify(key, id, ok), { ok: false }); if (!r.ok) return fail(r);
    U.toast(ok ? 'Verified and closed.' : 'Back to the diagnosis: it starts again from the first question.');
  });
  U.on('work:false', (el) => { falseModal(ga(el, 'plant'), ga(el, 'id')); return false; });
  U.on('work:false-go', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const root = rootOf(el, '.modal');
    const why = valIn(root, 'wk-why'); const note = String(valIn(root, 'wk-note') || '').trim();
    if (!why) { falseModal(key, id, 'Say why it was a false alarm.'); return false; }
    if (why === 'Something else' && !note) { falseModal(key, id, 'Write a note for "Something else".'); return false; }
    const text = why === 'Something else' ? note : note ? `${why} (${note})` : why;
    const r = call(() => V().close(key, id, { falseAlarm: true, note: text }), { ok: false });
    if (!r.ok) { falseModal(key, id, r.error); return false; }
    U.closeModal(true);
    const iss = issueOf(key, id);
    U.toast(why === 'The limit is too tight for this plant' && iss && iss.alertId ? 'Closed as a false alarm. If the limit is too tight, change it on the alert, with a reason.' : 'Closed as a false alarm. It counts in Coverage.');
  });
  U.on('work:closenote', (el) => { closeNoteModal(ga(el, 'plant'), ga(el, 'id')); return false; });
  U.on('work:close-go', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const note = String(valIn(rootOf(el, '.modal'), 'wk-note') || '').trim();
    if (!note) { closeNoteModal(key, id, 'Write what you found and did.'); return false; }
    const r = call(() => V().close(key, id, { note }), { ok: false }); if (!r.ok) { closeNoteModal(key, id, r.error); return false; }
    U.closeModal(true); U.toast('Closed with your note.');
  });
  U.on('work:usercenter', () => { U.toast('People and how they are told are kept in the User Center, outside this prototype.'); return false; });

  U.on('work:taskstep', (el) => { const r = call(() => V().doTaskStep(ga(el, 'plant'), ga(el, 'id'), ga(el, 'step')), { ok: false }); if (!r.ok) return fail(r); });
  U.on('work:taskdone', (el) => {
    const key = ga(el, 'plant'); const r = call(() => V().doneTask(key, ga(el, 'id')), { ok: false }); if (!r.ok) return fail(r);
    U.toast(`Done. Next due ${r.task && r.task.due ? fmt(r.task.due) : 'on its interval'}.`);
  });
  U.on('work:lastdone', (el) => {
    const key = ga(el, 'plant'); const v = el.value;
    if (!v) { U.toast('Pick a date.'); return false; }
    const r = call(() => V().setLastDone(key, ga(el, 'id'), v), { ok: false }); if (!r.ok) return fail(r);
    U.toast(`Last done set to ${fmtDay(Date.parse(v + 'T06:00:00+05:30'))}${r.task && r.task.due && isLive(key) ? `; next due ${fmt(r.task.due)}` : ''}.`);
  });
  U.on('work:cadence', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const t = call(() => V().task(key, id), null); if (!t) return false;
    if (W.V7OBJ && typeof W.V7OBJ.openCadence === 'function' && !W.V7WORK_OWN_CADENCE) { W.V7OBJ.openCadence({ plant: key, taskId: t.id }); return false; }   /* v7: one editor */
    U.openSheet({ title: 'Change how often', sub: cleanTaskName(t.name), body: cadenceBody(key, id), foot: cadenceFoot(key, id) });
    return false;
  });
  function cadenceVals(el) { const root = rootOf(el, '.sheet'); return { every: { n: +valIn(root, 'wk-n'), unit: valIn(root, 'wk-unit') }, reason: valIn(root, 'wk-reason'), until: valIn(root, 'wk-until'), note: String(valIn(root, 'wk-note') || '').trim() }; }
  U.on('work:cadence-save', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const v = cadenceVals(el);
    const r = call(() => V().setCadence(key, id, v.every, { reason: v.reason || undefined, note: v.note, until: v.until || undefined }), { ok: false, error: 'That did not save.' });
    if (!r.ok) { U.refreshSheet({ body: cadenceBody(key, id, r.error, v) }); return false; }
    U.closeSheet(true);
    const t = call(() => V().task(key, id), null);
    U.toast(r.results && r.results.some((x) => x.changed) ? `Now ${t ? t.everyText : 'changed'}${t && t.source ? ` · ${t.source.chipText}` : ''}.` : 'No change: it was already that.');
  });
  U.on('work:cadence-lib', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const t = call(() => V().task(key, id), null);
    const lib = t && t.source && t.source.libValue; if (!lib) return false;
    const r = call(() => V().setCadence(key, id, lib, {}), { ok: false }); if (!r.ok) { U.refreshSheet({ body: cadenceBody(key, id, r.error) }); return false; }
    U.closeSheet(true); U.toast(`Back to the library value: ${call(() => V().everyText(lib), '')}.`);
  });
  U.on('work:suggest', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const t = call(() => V().task(key, id), null); if (!t) return false;
    const v = cadenceVals(el);
    if (!v.note) { U.refreshSheet({ body: cadenceBody(key, id, 'Write the note first: it becomes the suggestion.', v) }); return false; }
    const r = call(() => V().suggest({ typeName: t.typeName, text: `${t.name}: ${v.note}`, plant: key }), { ok: false });
    if (!r.ok) { U.refreshSheet({ body: cadenceBody(key, id, r.error, v) }); return false; }
    U.toast(`Suggestion logged for ${t.typeName}: it shows on the type page and in Activity.`); return false;
  });

  /* ── routes, css, exports ──────────────────────────────────────────────────────────────────────────────── */
  U.route('p/:plant/issues', issuesPage);
  U.route('p/:plant/issue/:id', issuePage);
  U.route('p/:plant/task/:id', taskPage);
  if (typeof U.addCss === 'function') U.addCss('assets/work7.css?v=1');

  W.V7WORK = { issuesPage, issuePage, taskPage, openReport, report: openReport /* integrator: contract name */, reportButton, issueList, issueItem, issueChips, statusChip, toldSummary, hrefIssue, hrefTask, _cadenceBody: cadenceBody, _reportBody: reportBody };
}());
