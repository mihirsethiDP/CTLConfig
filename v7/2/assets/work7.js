/* v7/2 · work7.js · window.V7WORK — Issues and Tasks being worked, in Alex's model.

   Loads after the core files (window.V7) and ui7.js (window.V7UI); before decisions7.js. Reads V7 defensively (call()), never edits it.
   Other modules it uses when they are there: V7PLANT.frame (the plant frame), V7STRUCT.subjectChip and V7STRUCT.stageCrumb (the
   structure page's subject chip and stage crumb); each has a plain fallback here.

   ROUTES
     p/:plant/issues        Issues at a plant: open first, then closed, in a table with a Subject column; filter chips "All · Unit
                            processes · Equipment · The plant" (?show=up|eq|plant; ?show=open|closed|false also work), ?eq=<nodeId>
                            for one node and the Issues it caused; "Report a problem". At a Commissioning plant with no Issues it says
                            why: Triggers record trial firings only, and links to them.
     p/:plant/issue/:id     One Issue. Crumbs through the stage and the subject; "Subject: AT-2 · Activated sludge". Main column, in the
                            order the work happens: Diagnostic flow (a runner over the questions) → Root cause ("Caused by BL-1" and its
                            log line) → Fix (its Action flow; a step naming a general Task links to it and comes back) → Verify ("Do the
                            readings show it worked?"). Aside: what fired with "Opened under: …" and, while its Trigger is held, the
                            frozen line; who was told; what happened. "Close as a false alarm" asks why; ?close=false-alarm opens that
                            close at the top of the page.
     p/:plant/task/:id      One Task: its subject, its cadence with its source chip, read-only, with "Edit on the Task's Trigger page"
                            (the only editor of a cadence); next due; "Last service", read-only; its Action flow with ticks once the
                            plant is Live. A general Task from the library that this plant has no Task for shows its Action flow to
                            read. ?from=<issueId>&step=<stepId> shows "Done: back to the Issue" (ticks that fix step).

   EXPORTS  window.V7WORK = { issuesPage, issuePage, taskPage, openReport(key, subject?), report, reportButton(key, subject?, opts),
            issueList(key, opts), issueItem(key, issue, opts), issueChips, statusChip(issue), toldSummary(issue), subjectChip(key, subject),
            hrefIssue(key,id), hrefTask(key,id,query) }
            Any page can open "Report a problem" with a button: data-act="work:report" data-plant="<key>" [data-subject="up:<id>|eq:<id>|
            plant"] (or data-eq="<nodeId>"). issueList(key, {eqId, upId, includeShared, shared:'only'|'none', status, limit, empty})
            renders a node's Issues for the object pages; Issues filed on a participant carry "Shared · on {tag}".
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
  const MIN = 60000;
  const BAND = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const RANK = { caution: 1, minor: 2, major: 3, emergency: 4 };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
  const joinWords = (list) => { const l = arr(list).filter(Boolean); return l.length <= 1 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`; };
  const clean = (s) => String(s == null ? '' : s).replace(/[.\s]+$/, '');
  const WORK_PREFIX = /^(Cleaning|Preventive maintenance|Routine check|Routine work|Manual testing|Calibration)\s*-\s*/i;
  const flowName = (f) => clean(String(f && f.name || '').replace(/^Fix:\s*/i, '').replace(WORK_PREFIX, ''));
  const cleanTaskName = (n) => String(n || '').replace(WORK_PREFIX, '') || n;

  const now = () => call(() => V().now(), Date.UTC(2026, 9, 29, 3, 30));
  const fmt = (ms) => (ms == null ? '—' : U.fmt(ms));
  const fmtDay = (ms) => (ms == null ? '—' : U.fmtDay(ms));
  const fmtTime = (ms) => call(() => V().fmtTime(ms), U.fmt(ms).split(', ').pop());
  const dur = (ms) => call(() => V().fmtDur(Math.max(0, ms) / MIN), `${Math.round(Math.max(0, ms) / MIN)} min`);
  const openFor = (ms) => (ms < MIN ? 'just opened' : `open for ${dur(ms)}`);
  const val = (v, unit, kind) => call(() => V().fmtVal(v, unit, kind), U.num(v, unit));

  /* links (every one is a registered route) */
  const base = (key) => `#/p/${enc(key)}`;
  const hrefIssue = (key, id) => `${base(key)}/issue/${enc(id)}`;
  const hrefIssues = (key, q) => `${base(key)}/issues${q ? '?' + q : ''}`;
  const hrefTask = (key, id, q) => `${base(key)}/task/${enc(id)}${q ? '?' + q : ''}`;
  const hrefEq = (key, eqId, tab) => `${base(key)}/eq/${enc(eqId)}${tab ? '/' + tab : ''}`;
  const hrefUp = (key, upId, tab) => `${base(key)}/up/${enc(upId)}${tab ? '/' + tab : ''}`;
  const hrefTrigger = (key, id, q) => `${base(key)}/trigger/${enc(id)}${q ? '?' + q : ''}`;
  const hrefSensor = (key, id) => `${base(key)}/sensor/${enc(id)}`;
  const hrefPeople = (key, sub) => `${base(key)}/people${sub ? '/' + sub : ''}`;
  const libCode = (typeName) => { const c = (W.CATALOGUE_BY_TYPE && W.CATALOGUE_BY_TYPE[typeName]) || arr(W.CATALOGUE).find((x) => x.type === typeName); return c ? c.code : null; };

  /* reads */
  const plantOf = (key) => arr(call(() => V().plants(), [])).find((p) => p && p.key === key) || null;
  const isLive = (key) => call(() => V().state(key), '') === 'live';
  const eqOf = (key, id) => (id ? call(() => V().eq(key, id), null) : null);          /* any node: a unit process or a piece of equipment */
  const tagOf = (key, id) => { const e = eqOf(key, id); return e ? e.tag : id || ''; };
  const sensorOf = (key, id) => (id ? arr(call(() => V().sensors(key), [])).find((s) => s.id === id) || null : null);
  const alertOf = (key, id) => (id ? call(() => V().alert(key, id), null) : null);
  const flowOf = (id) => (id ? call(() => V().flowOf(id), null) : null);
  const causeOf = (id) => (id ? call(() => V().causeOf(id), null) : null);
  const issueOf = (key, id) => call(() => V().issue(key, id), null);
  const latestOf = (key, sensorId) => (sensorId ? call(() => V().latest(key, sensorId), null) : null);
  const issueType = (id) => (id ? arr(W.ISSUES).find((i) => i.id === id) || null : null);
  const heldOf = (key, alertId) => (alertId ? call(() => V().heldOf(key, alertId), null) : null);
  const triggerName = (key, alertId) => { const a = alertOf(key, alertId); return call(() => V().triggerName(key, alertId), a ? a.name : alertId); };

  /* what an Issue or Task is about: a unit process, a piece of equipment or the plant */
  function subjectOf(key, ref) {
    const viaCore = call(() => V().subjectOf(key, ref), null); if (viaCore) return viaCore;
    const p = plantOf(key);
    if (ref === 'plant' || (ref && ref.kind === 'plant')) return { kind: 'plant', id: key, tag: null, name: p ? p.name : key, text: 'The plant', href: base(key) };
    const id = ref && typeof ref === 'object' ? ref.id : ref; const e = eqOf(key, id); if (!e) return null;
    return { kind: 'eq', id: e.id, tag: e.tag, name: e.name, typeName: e.type, text: `${e.tag} · ${e.type}`, href: hrefEq(key, e.id) };
  }
  const subjectOfIssue = (key, iss) => (iss && iss.subject && iss.subject.kind ? iss.subject : iss && iss.eqId ? subjectOf(key, iss.eqId) : subjectOf(key, 'plant'));
  const subjKind = (s) => (s && s.kind) || 'plant';
  const subjHref = (key, s) => (!s ? base(key) : s.href || (s.kind === 'up' ? hrefUp(key, s.id) : s.kind === 'eq' ? hrefEq(key, s.id) : base(key)));
  const KIND_WORD = { up: 'unit process', eq: 'equipment' };
  /* "AT-2 · unit process" / "BL-1 · equipment" / "The plant": the structure page's chip when it is loaded */
  function subjectChip(key, s) {
    if (!s) return '';
    const S = W.V7STRUCT; const viaStruct = S && typeof S.subjectChip === 'function' ? call(() => S.subjectChip(key, s), '') : '';
    if (typeof viaStruct === 'string' && viaStruct) return viaStruct;
    const text = s.kind === 'plant' ? 'The plant' : `${s.tag} · ${KIND_WORD[s.kind] || 'equipment'}`;
    return U.chip(text, { tone: 'muted', href: subjHref(key, s), cls: 'wk-subj', title: s.text || '' });
  }

  /* the plant's state chip, on every page of the plant: "Commissioning · nothing is sent" / "Live since Tue 1 Sep" */
  function plantStateChip(p) {
    if (!p) return '';
    const viaUi = call(() => U.stateChip(p.state, { since: p.since, plant: p.key }), '');
    if (p.state === 'commissioning') return /nothing is sent/.test(viaUi) ? viaUi : '<span class="chip st st-comm">Commissioning · nothing is sent</span>';
    if (p.state === 'live') return /Live since/.test(viaUi) ? viaUi : `<span class="chip st st-live">${esc(`Live since ${fmtDay(p.since)}`)}</span>`;
    return viaUi;
  }
  /* a Trigger's status chip: "Draft · never fires" · "Active · trial" · "Active" · "Inactive" */
  const PHASE_CLS = { draft: 'draft', trial: 'trial', live: 'on', inactive: 'off' };
  function triggerChip(key, a) {
    if (!a) return '';
    const phase = a.phase || call(() => V().triggerPhase(key, a.id), a.state === 'active' ? (isLive(key) ? 'live' : 'trial') : a.state);
    const text = a.chipText || call(() => V().LABELS.triggerChip[phase], '') || cap(a.state);
    return `<span class="chip st st-${esc(PHASE_CLS[phase] || 'off')}">${esc(text)}</span>`;
  }
  /* a value's source chip (the core's chip object {text, tone, sub, small, extra}); the sub line is visible, never a hover */
  function chipHtml(c) {
    if (!c) return '';
    if (typeof c === 'string') return U.chip(c, { tone: 'lib' });
    const main = U.chip(c.text || '', { tone: c.tone || 'lib' });
    const extra = arr(c.extra).map((x) => U.chip(x.text || '', { tone: x.tone || 'muted' })).join(' ');
    const sub = c.sub ? ` <span class="wk-chip-sub">${esc(c.sub)}</span>` : '';
    const small = c.small ? ` <span class="wk-chip-sub">${esc(c.small)}</span>` : '';
    return `${main}${extra ? ' ' + extra : ''}${sub}${small}`;
  }

  /* how a problem is found, in plain words */
  const FOUND = { sensor: 'a reading', visual: 'a visual check', manual: 'a lab or manual test' };
  const foundText = (kinds) => { const k = arr(kinds).map((x) => FOUND[x]).filter(Boolean); return k.length ? `Found by ${joinWords([...new Set(k)]).replace(/ and /, ' or ')}` : ''; };

  /* the plant page frame (plant7), or a plain one with the same tabs */
  const TABS_COMM = [['home', 'Readiness', ''], ['structure', 'Structure', '/structure'], ['triggers', 'Triggers', '/triggers'], ['issues', 'Issues', '/issues'], ['tasks', 'Tasks', '/tasks'], ['people', 'People', '/people'], ['deviations', 'Deviations', '/deviations'], ['activity', 'Activity', '/activity']];
  const TABS_LIVE = [['home', 'Coverage', ''], ['readings', 'Readings', '/readings']].concat(TABS_COMM.slice(1));
  function plantChips(p) { return [U.chip(p.type || '', { mono: true }), plantStateChip(p), p.sample === false ? U.chip('Real plant graph', { tone: 'info' }) : U.chip('Sample plant', { tone: 'muted' })]; }
  function frame(key, active, body) {
    const F = W.V7PLANT && W.V7PLANT.frame;
    if (typeof F === 'function') { const out = call(() => F(key, active, body), null); if (out) return out; }
    const p = plantOf(key) || { name: key, type: '', state: '' };
    const tabs = p.state === 'live' ? TABS_LIVE : TABS_COMM;
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name }], title: p.name, chips: plantChips(p), tabs: tabs.map(([id, label, s]) => ({ id, label, href: base(key) + s })), active, body });
  }
  function noPlant() { return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', body: U.empty('This plant is not in the prototype.', U.btn('All Plants', { href: '#/plants' })) }); }
  function notFound(key, what, back, backLabel) {
    const p = plantOf(key);
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p ? p.name : key, href: base(key) }, { label: 'Not found' }], title: `No such ${what}`, chips: [plantStateChip(p)], body: U.empty(`This ${what} is not at ${p ? p.name : 'this plant'}. Resetting the story clears what was opened after the start.`, U.btn(backLabel, { href: back })) });
  }

  /* ── Issues: status, rows, who was told ────────────────────────────────────────────────────────────────── */
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
  /* chips beside an Issue's name: severity, status, then what is worth knowing (o.eqId: the node whose list this is) */
  function issueChips(key, iss, opts) {
    const o = opts || {}; const out = [U.sev(iss.band), statusChip(iss)];
    const s = subjectOfIssue(key, iss);
    if (iss.shared && iss.sharedText) out.push(U.chip(iss.sharedText, { tone: 'muted', title: 'Filed on a participant of this unit process' }));
    if (iss.commissioning) out.push(U.chip('Opened in Commissioning', { tone: 'info', title: 'Opened while the plant was in Commissioning: nothing was sent' }));
    if (iss.causedBy) out.push(U.chip(o.eqId && o.eqId === iss.causedBy && (!s || s.id !== o.eqId) ? `Caused here · about ${s && s.tag ? s.tag : tagOf(key, iss.eqId)}` : `Caused by ${tagOf(key, iss.causedBy)}`, { tone: 'warn' }));
    if (iss.reported) out.push(U.chip('Reported', { tone: 'muted', title: 'Reported by a person, not opened by a Trigger' }));
    return out;
  }
  function whenText(key, iss) {
    if (iss.status !== 'closed') return `Opened ${fmt(iss.opened)} · ${openFor(now() - iss.opened)}, ${DOING[iss.status] || 'open'}`;
    const c = causeOf(iss.diag && iss.diag.causeId);
    const why = iss.falseAlarm ? 'false alarm' : c ? clean(c.name) : iss.closedHow === 'reading' ? 'the reading came back' : '';
    return `${fmt(iss.opened)} to ${fmt(iss.closed)} (${dur(iss.closed - iss.opened)})${why ? ' · ' + why : ''}`;
  }
  function issueItem(key, iss, opts) {
    const s = subjectOfIssue(key, iss);
    const tone = iss.status === 'closed' ? '' : (RANK[iss.band] || 0) >= 3 ? 'bad' : 'warn';
    return { title: iss.title, href: hrefIssue(key, iss.id), chips: issueChips(key, iss, opts), sub: `${s ? s.text : 'The plant'} · ${whenText(key, iss)}`, tone };
  }
  function issuesOf(key, o) {
    const q = {}; ['eqId', 'upId', 'includeShared', 'subject'].forEach((k) => { if (o && o[k] != null) q[k] = o[k]; });
    if (o && o.status) q.status = o.status;
    return arr(call(() => V().issues(key, q), []));
  }
  function issueList(key, opts) {
    const o = opts || {}; let list = issuesOf(key, o);
    if (o.status) list = list.filter((i) => (o.status === 'open' ? i.status !== 'closed' : i.status === o.status));
    if (o.shared === 'only') list = list.filter((i) => i.shared); else if (o.shared === 'none') list = list.filter((i) => !i.shared);
    if (!list.length) return U.empty(o.empty || 'No Issues here.');
    const shown = o.limit ? list.slice(0, o.limit) : list;
    const node = o.eqId || o.upId;
    return U.list(shown.map((i) => issueItem(key, i, o)), { cls: 'wk-issues' }) + (o.limit && list.length > o.limit ? `<p class="wk-more">${U.link(`All ${list.length} Issues`, hrefIssues(key, node ? 'eq=' + enc(node) : ''))}</p>` : '');
  }

  /* who was told: a summary line from the record itself, then one line per person */
  const HOW_ORDER = ['phone call', 'WhatsApp', 'SMS', 'full-screen warning', 'in the app', 'morning email', 'hooter'];
  const howRank = (h) => { const i = HOW_ORDER.indexOf(h); return i < 0 ? 50 : i; };
  const HOW = { 'phone call': 'a phone call', 'full-screen warning': 'a full-screen warning in the app', 'in the app': 'the app', 'morning email': 'the morning email', hooter: 'the hooter' };
  function toldGroups(told) {
    const m = new Map();
    arr(told).forEach((x) => { const k = `${x.who}|${x.role || ''}`; if (!m.has(k)) m.set(k, { who: x.who, role: x.role, hows: [], times: [] }); const g = m.get(k); if (!g.hows.includes(x.how)) g.hows.push(x.how); if (x.at != null && !g.times.includes(x.at)) g.times.push(x.at); });
    return [...m.values()].map((g) => Object.assign(g, { hows: g.hows.sort((x, y) => howRank(x) - howRank(y)) }));
  }
  function toldSummary(iss) {
    const told = arr(iss && iss.told);
    if (!told.length) {
      const p = iss && iss.plant ? plantOf(iss.plant) : null;
      if (iss && iss.commissioning) return `Nothing was sent: ${p ? p.name : 'the plant'} was in Commissioning`;
      return 'Nobody could be told: no Operator or Lead with a verified phone on the People tab';
    }
    const hows = [...new Set(told.map((x) => x.how))].sort((x, y) => howRank(x) - howRank(y));
    const people = toldGroups(told.filter((x) => x.how !== 'hooter'));
    const roles = {}; people.forEach((p) => { const r = p.role || 'Person'; roles[r] = (roles[r] || 0) + 1; });
    const who = joinWords(Object.keys(roles).map((r) => plural(roles[r], r)));
    const ways = joinWords(hows.filter((h) => h !== 'hooter').map((h) => HOW[h] || h));
    return `${who ? who + ': ' : ''}${cap(ways)}${hows.includes('hooter') ? ', and the plant hooter' : ''}`;
  }

  /* ── Issues list page ──────────────────────────────────────────────────────────────────────────────────── */
  const reportData = (key, subject) => ({ plant: key, subject: subject ? normSubj(key, subject) || null : null });
  function reportButton(key, subject, o) {
    o = o || {};
    return U.btn(o.label || 'Report a problem', { act: 'work:report', data: reportData(key, subject), kind: o.kind || 'secondary', small: !!o.small, title: 'Open an Issue for something a person saw, with its diagnostic flow' });
  }
  const SUBJ_LABEL = { up: 'Unit processes', eq: 'Equipment', plant: 'The plant' };
  const STATUS_LABEL = { open: 'Open', closed: 'Closed', false: 'False alarms' };
  function issueTable(key, list, eqF) {
    return U.table({
      cls: 'wk-tbl',
      cols: [
        { label: 'Issue', render: (i) => H(`${U.link(i.title, hrefIssue(key, i.id))}${(() => { const c = issueChips(key, i, { eqId: eqF }).slice(2).join(' '); return c ? ` <span class="wk-rc">${c}</span>` : ''; })()}`) },
        { label: 'Subject', render: (i) => H(subjectChip(key, subjectOfIssue(key, i))) },
        { label: 'Severity', render: (i) => H(U.sev(i.band)) },
        { label: 'Status', render: (i) => H(statusChip(i)) },
        { label: 'When', render: (i) => whenText(key, i) },
      ],
      rows: list.map((i) => Object.assign({}, i, { _href: hrefIssue(key, i.id), _cls: i.status === 'closed' ? '' : (RANK[i.band] || 0) >= 3 ? 'tone-bad' : 'tone-warn' })),
    });
  }
  function issuesPage(params) {
    const key = params.plant; const p = plantOf(key); if (!p) return noPlant();
    const q = params._q || {};
    const eqF = q.eq && eqOf(key, q.eq) ? q.eq : null;
    const all = issuesOf(key, eqF ? { eqId: eqF } : {});
    const comm = p.state === 'commissioning';
    const kindOf = (i) => subjKind(subjectOfIssue(key, i));
    const show = SUBJ_LABEL[q.show] || STATUS_LABEL[q.show] ? q.show : 'all';
    const counts = { up: 0, eq: 0, plant: 0 }; all.forEach((i) => { counts[kindOf(i)] = (counts[kindOf(i)] || 0) + 1; });
    const falseN = all.filter((i) => i.falseAlarm).length;
    const qs = (s) => [s !== 'all' ? 'show=' + s : '', eqF ? 'eq=' + enc(eqF) : ''].filter(Boolean).join('&');
    const fl = [{ label: 'All', href: hrefIssues(key, qs('all')), on: show === 'all', count: all.length }]
      .concat(['up', 'eq', 'plant'].map((k) => ({ label: SUBJ_LABEL[k], href: hrefIssues(key, qs(k)), on: show === k, count: counts[k] || 0 })));
    if (falseN || show === 'false') fl.push({ label: 'False alarms', href: hrefIssues(key, qs('false')), on: show === 'false', count: falseN });
    if (show === 'open' || show === 'closed') fl.push({ label: STATUS_LABEL[show], href: hrefIssues(key, qs(show)), on: true, count: all.filter((i) => (show === 'open' ? i.status !== 'closed' : i.status === 'closed')).length });
    let filtersHtml = U.filters(fl);
    if (eqF) filtersHtml += `<p class="wk-only">Only ${esc(tagOf(key, eqF))}, and the Issues it caused · ${U.link('Show every Issue', hrefIssues(key, show !== 'all' ? 'show=' + show : ''))}</p>`;
    /* Issues a Trigger opened while the plant was Live stay open after a return to Commissioning, on their own ladder */
    const fromLive = comm ? all.filter((i) => i.status !== 'closed' && i.alertId && !i.commissioning).length : 0;
    const commSub = `A person can still report a problem here.${fromLive ? ` ${fromLive === 1 ? '1 Issue' : `${fromLive} Issues`} opened while ${p.name} was Live ${fromLive === 1 ? 'stays open and is' : 'stay open and are'} worked as normal, with ${fromLive === 1 ? 'its' : 'their'} own reminders and escalations.` : ''}`;
    const head = U.section('Issues', '', {
      sub: comm ? commSub : 'An Issue is what opens when a Trigger fires, or when a person reports a problem.',
      actions: [reportButton(key, eqF, { kind: 'primary' })],
    });
    const commLine = `While ${p.name} is in Commissioning, Triggers record trial firings only, at every severity: nothing is sent.`;
    const trialLink = U.link('See the trial firings', `${base(key)}/triggers?sort=trial`);

    if (!all.length) {
      let empty;
      if (eqF) empty = U.empty(`No Issues on ${tagOf(key, eqF)}.`);
      else if (comm) empty = `<div class="empty wk-empty-comm"><p>${esc(`No Issues. ${commLine}`)}</p><div class="empty-a">${trialLink}</div></div>`;
      else empty = U.empty('No Issues yet. Move the story clock on to see Triggers open them.');
      return frame(key, 'issues', `<div class="wk">${head}${eqF ? filtersHtml : ''}<div class="wk-list">${empty}</div></div>`);
    }
    let list = all;
    if (SUBJ_LABEL[show]) list = all.filter((i) => kindOf(i) === show);
    else if (show === 'false') list = all.filter((i) => i.falseAlarm);
    else if (show === 'open') list = all.filter((i) => i.status !== 'closed');
    else if (show === 'closed') list = all.filter((i) => i.status === 'closed');
    const open = list.filter((i) => i.status !== 'closed'); const closed = list.filter((i) => i.status === 'closed');
    const lim = q.n === 'all' ? 0 : 25; const closedShown = lim ? closed.slice(0, lim) : closed;
    const EMPTY = { up: 'No Issues on unit processes.', eq: 'No Issues on equipment.', plant: 'No Issues on the plant itself.', false: 'No false alarms.', open: 'Nothing is open.', closed: 'Nothing has closed yet.' };
    let body = '';
    if (!list.length) body = U.empty(EMPTY[show] || 'No Issues here.');
    else {
      if (open.length) body += U.section(`Open · ${open.length}`, issueTable(key, open, eqF), { sub: open.length > 1 ? 'The most serious first.' : '' });
      else if (show === 'all' || SUBJ_LABEL[show]) body += `<p class="lead">Nothing is open${closed.length ? `. The last one closed ${esc(fmt(closed[0].closed))}` : ''}.</p>`;
      if (closed.length) body += U.section(`Closed · ${closed.length}`, issueTable(key, closedShown, eqF) + (lim && closed.length > lim ? `<p class="wk-more">${U.link(`Show all ${closed.length}`, hrefIssues(key, [qs(show), 'n=all'].filter(Boolean).join('&')))}</p>` : ''), { sub: 'Newest first. A false alarm counts in Coverage.' });
    }
    const note = comm ? `<p class="lead wk-comm">${esc(commLine)} ${trialLink}</p>` : '';
    return frame(key, 'issues', `<div class="wk">${head}${note}${filtersHtml}<div class="wk-list">${body}</div></div>`);
  }

  /* ── one Issue ─────────────────────────────────────────────────────────────────────────────────────────── */
  function step(n, title, state, body, o) {
    o = o || {};
    const mark = `<span class="wk-n" aria-hidden="true">${state === 'done' ? '✓' : state === 'skip' ? '–' : n}</span>`;
    const sr = state === 'done' ? 'done' : state === 'skip' ? 'skipped' : state === 'now' ? 'now' : 'later';
    return `<section class="wk-st is-${state}${o.tone ? ' tone-' + o.tone : ''}" aria-label="${esc(`${title}: ${sr}`)}">${mark}<div class="wk-sb"><header class="wk-sh"><h2>${esc(title)}</h2>${o.sub ? `<p>${o.sub}</p>` : ''}</header>${body ? `<div class="wk-bd">${body}</div>` : ''}${o.foot ? `<footer class="wk-sf">${o.foot}</footer>` : ''}</div></section>`;
  }
  const dataOf = (key, iss, more) => Object.assign({ plant: key, id: iss.id }, more || {});

  function pathHtml(flow, path) {
    if (!path.length) return '';
    /* an answer given by someone else (the Operator who started it) says who and when */
    return `<ol class="wk-path">${path.map((p) => { const st = flow ? flow.steps.find((x) => String(x.id) === String(p.stepId)) : null; const a = typeof p.answer === 'number' ? U.num(p.answer) : p.answer; const by = p.by ? ` <span class="muted small">· ${esc(p.by)}${p.at != null ? `, ${esc(fmtTime(p.at))}` : ''}</span>` : ''; return `<li><span>${esc(st ? st.text : 'A step')}${by}</span><b>${esc(a)}</b></li>`; }).join('')}</ol>`;
  }
  /* the reading a diagnostic reading step asks for: on the Issue's subject first, else anywhere at the plant */
  function readingFor(key, iss, st) {
    const kind = st.sensorKind; if (!kind) return null;
    const all = arr(call(() => V().sensors(key), [])).filter((s) => !s.nextPhase && s.name === kind);
    const sid = (subjectOfIssue(key, iss) || {}).id;
    return all.find((s) => s.eqId === sid || s.eqId === iss.eqId) || all[0] || null;
  }
  function diagCard(key, iss, flow) {
    const T = 'Diagnostic flow';
    const path = arr(iss.diag && iss.diag.path); const closed = iss.status === 'closed'; const c = causeOf(iss.diag && iss.diag.causeId);
    const sub = flow ? `${esc(flowName(flow))} · in the library` : '';
    if (c) {
      const how = path.length ? pathHtml(flow, path) : `<p class="muted">${iss.sensorFault && !flow ? 'Reported as a sensor fault, so there was nothing to diagnose.' : 'Skipped: the reason was known.'}</p>`;
      return step(1, T, 'done', how, { sub: `${sub ? sub + ' · ' : ''}found the root cause` });
    }
    if (closed) return step(1, T, path.length ? 'done' : 'skip', path.length ? pathHtml(flow, path) : '<p class="muted">Not diagnosed before it closed.</p>', { sub });
    const cur = call(() => V().diagStep(key, iss.id), null);
    const causes = arr(call(() => V().causesFor(key, iss.id), []));
    const know = causes.length ? U.btn('I know the reason', { act: 'work:causes', data: dataOf(key, iss), kind: 'ghost', small: true }) : '';
    const closeFoot = () => (causes.length ? U.btn('Pick the root cause', { act: 'work:causes', data: dataOf(key, iss), kind: 'primary' }) : '') + U.btn('Close with a note', { act: 'work:closenote', data: dataOf(key, iss), kind: causes.length ? 'ghost' : 'primary' });
    if (iss.diag && iss.diag.open) {
      const body = pathHtml(flow, path) + `<p class="wk-q">${esc(clean(iss.diag.open))}.</p><p class="muted small">The diagnostic flow has no more questions. Pick the root cause if you found it, or close the Issue with a note of what you found.</p>`;
      return step(1, T, 'now', body, { sub, foot: closeFoot() });
    }
    if (!cur) {
      const body = `<p>No diagnostic flow is written for this Issue yet.</p>${causes.length ? '<p class="muted small">Its root causes are known: pick the one you found.</p>' : '<p class="muted small">Close it with a note of what you found and did.</p>'}`;
      return step(1, T, 'now', body, { sub, foot: closeFoot() });
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
      ask = `<p class="wk-q">${esc(cur.text)}</p><div class="wk-ans">${Object.keys(cur.answers).map((k) => U.btn(k, { act: 'work:answer', data: dataOf(key, iss, { step: cur.id, answer: k }) })).join('')}</div>`;
    } else {
      ask = `<p class="wk-q">${esc(cur.text)}</p><div class="wk-ans">${U.btn('Done', { act: 'work:answer', data: dataOf(key, iss, { step: cur.id, answer: 'Done' }) })}</div>`;
    }
    const body = `<p class="wk-qn">Question ${n}${total ? ` of up to ${total}` : ''}</p>${ask}${path.length ? `<details class="wk-so"><summary>Answered so far · ${path.length}</summary>${pathHtml(flow, path)}</details>` : ''}`;
    return step(1, T, 'now', body, { sub, foot: know });
  }

  /* "Caused by BL-1", with the line the diagnosis logged for it ("Caused by BL-1 (Blower; takes part in AT-2)") */
  function causedByHtml(key, iss) {
    if (!iss.causedBy) return '';
    const e = eqOf(key, iss.causedBy); const s = subjectOfIssue(key, iss);
    const line = arr(iss.log).slice().reverse().find((l) => /^Caused by /.test(String(l.text)));
    const tag = e ? e.tag : iss.causedBy;
    const where = e ? U.link(tag, hrefEq(key, e.id, 'issues')) : esc(tag);
    return `<p class="wk-cb">${U.chip(`Caused by ${tag}`, { tone: 'warn' })}${line ? ` <span class="wk-cbl">${esc(clean(line.text))}</span>` : ''}</p>`
      + `<p class="muted small">This Issue also shows on ${where}'s Issues tab. It stays about ${esc(s && s.tag ? s.tag : 'its subject')}, where ${iss.alertId ? 'the reading fired' : 'it was reported'}.</p>`;
  }
  function calibrationTask(key, iss) {
    if (!iss.sensorId) return null;
    return arr(call(() => V().tasks(key, { eqId: iss.eqId }), [])).find((t) => t.workType === 'calibration') || null;
  }
  function causeCard(key, iss, sensor) {
    const c = causeOf(iss.diag && iss.diag.causeId); const closed = iss.status === 'closed';
    if (!c) return step(2, 'Root cause', closed ? 'skip' : 'next', closed ? '<p class="muted">No root cause was recorded.</p>' : '', { sub: closed ? '' : 'The diagnostic flow lands on it, or pick it if you know it.' });
    const ff = call(() => V().fixFlowFor(c.id, sensor ? sensor.name : null), null);
    const started = iss.fix && (iss.fix.flowId || iss.status === 'verifying' || closed);
    const chips = [c.sensorFault ? U.chip('Sensor fault', { tone: 'info', title: 'The reading was wrong, not the process: the fix is the probe' }) : '', c.noFault ? U.chip('Nothing wrong', { tone: 'ok' }) : ''].filter(Boolean).join(' ');
    let body = `<p class="wk-cause">${esc(clean(c.name))}${chips ? ' ' + chips : ''}</p>${causedByHtml(key, iss)}`;
    if (c.sensorFault) {
      const ct = calibrationTask(key, iss);
      body += `<p class="muted small">A sensor fault: the fix is the probe's calibration${sensor ? ` (${esc(sensor.name)})` : ''}.${ct ? ` The calibration Task here: ${U.link(cleanTaskName(ct.name), hrefTask(key, ct.id))}.` : ''}</p>`;
    }
    if (started) return step(2, 'Root cause', 'done', body, {});
    body += `<p class="muted small">${ff ? `The fix: ${esc(flowName(ff))} · its Action flow has ${esc(plural(ff.steps.length, 'step'))}.` : 'No Action flow is written for this root cause: do what is needed, then check the readings.'}</p>`;
    const foot = U.btn('Start the fix', { act: 'work:startfix', data: dataOf(key, iss), kind: 'primary' }) + U.btn('Choose a different root cause', { act: 'work:causes', data: dataOf(key, iss), kind: 'ghost', small: true });
    return step(2, 'Root cause', 'now', body, { foot });
  }

  /* a fix or Task step that names a general Task (or a workbook Issue) links to it */
  function linkLines(key, iss, st, from) {
    const lt = call(() => V().linkedTask(st), null); if (!lt) return '';
    return arr(lt.all && lt.all.length ? lt.all : [lt]).map((x) => {
      if (x.kind === 'task') {
        const s = iss ? subjectOfIssue(key, iss) : null;
        const tid = call(() => V().taskForGeneral(key, x.id, (iss && (iss.causedBy || (s && s.id) || iss.eqId)) || null), null) || x.id;
        const q = from ? `from=${enc(from.issueId)}&step=${enc(from.stepId)}` : '';
        return `<p class="wk-link">${U.link(`Open the Task: ${cleanTaskName(x.name)}`, hrefTask(key, tid, q))}<span class="muted small"> · ${esc(plural(arr(x.steps).length, 'step'))}${tid === x.id ? ' · not a Task at this plant' : ''}</span></p>`;
      }
      if (x.kind === 'issue') {
        const it = issueType(x.id); const code = it ? libCode(arr(it.homeTypes)[0]) : null;
        return `<p class="wk-link">${code ? U.link(`See it in the library: ${x.name}`, `#/library/eq-types/${enc(code)}/issues`) : esc(`In the library: ${x.name}`)}</p>`;
      }
      return '';
    }).join('');
  }
  function stepChips(st, f) {
    const full = f ? f.steps.find((x) => String(x.id) === String(st.id)) || st : st; const out = [];
    if (full.type === 'reading') out.push(U.chip('Record a reading', { tone: 'muted' }));
    if (full.type === 'wait') out.push(U.chip(full.minutes ? `Wait ${full.minutes} min` : 'Wait', { tone: 'muted' }));
    if (full.photo === 'required') out.push(U.chip('Photo', { tone: 'muted', title: 'A photo is taken on the phone' }));
    if (full.approve && !/signs? off/i.test(String(full.text || st.text || ''))) out.push(U.chip('The Lead signs off', { tone: 'muted' }));   /* not when the step already says it */
    return out.join(' ');
  }
  /* an Action flow with ticks; a question step is answered Yes / No, and the answer stays on the step */
  function tickList(steps, opt) {
    const done = arr(opt.done).map(String);
    return `<ol class="wk-check">${steps.map((st, i) => {
      const on = done.includes(String(st.id)); const id = `wk-c-${opt.prefix || 's'}-${i}`;
      const chips = opt.chips ? opt.chips(st) : ''; const links = opt.links ? opt.links(st) : '';
      const dataA = opt.disabled ? '' : ` data-act="${esc(opt.act)}"${Object.entries(opt.data(st)).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}`;
      if (opt.answers && st.type === 'question') {
        const ans = opt.answers[st.id] || null;
        const yn = ['Yes', 'No'].map((a) => (opt.disabled ? (ans === a ? `<b>${a}</b>` : '') : `<button type="button" class="btn btn-sm ${ans === a ? 'btn-primary' : 'btn-ghost'}" aria-pressed="${ans === a ? 'true' : 'false'}"${dataA} data-answer="${a}">${a}</button>`)).join(' ');
        return `<li class="wk-qs${on ? ' on' : ''}"><span class="wk-qa" aria-hidden="true">${on ? '✓' : ''}</span><div><span class="wk-i">${i + 1}</span><span class="wk-tx">${esc(st.text)}${chips ? ` <span class="wk-ch">${chips}</span>` : ''}</span><div class="wk-yn" role="group" aria-label="${esc(st.text)}">${yn}</div></div>${links ? `<div class="wk-lk">${links}</div>` : ''}</li>`;
      }
      const input = `<input type="checkbox" id="${id}"${on ? ' checked' : ''}${opt.disabled ? ' disabled' : dataA}>`;
      return `<li class="${on ? 'on' : ''}">${input}<label for="${id}"><span class="wk-i">${i + 1}</span><span class="wk-tx">${esc(st.text)}${chips ? ` <span class="wk-ch">${chips}</span>` : ''}</span></label>${links ? `<div class="wk-lk">${links}</div>` : ''}</li>`;
    }).join('')}</ol>`;
  }
  function fixCard(key, iss) {
    const c = causeOf(iss.diag && iss.diag.causeId); const closed = iss.status === 'closed';
    const fid = iss.fix && iss.fix.flowId; const f = flowOf(fid);
    if (!f) {
      if (closed) return step(3, 'Fix', 'skip', '<p class="muted">No Action flow was followed.</p>', {});
      if (c && iss.status === 'verifying') return step(3, 'Fix', 'done', '<p class="muted">No Action flow is written for this root cause.</p>', {});
      return step(3, 'Fix', 'next', '', { sub: c ? 'Its Action flow shows when you start the fix.' : 'The Action flow comes with the root cause.' });
    }
    const done = arr(iss.fix.done); const all = f.steps.length; const n = f.steps.filter((s) => done.map(String).includes(String(s.id))).length;
    const list = tickList(f.steps, { prefix: 'fix', done, answers: (iss.fix && iss.fix.answers) || {}, act: 'work:fixstep', disabled: closed, data: (st) => ({ plant: key, id: iss.id, step: st.id }), chips: (st) => stepChips(st, f), links: (st) => linkLines(key, iss, st, closed ? null : { issueId: iss.id, stepId: st.id }) });
    const head = `<p class="wk-af">Action flow · ${esc(flowName(f))}</p>`;
    if (iss.status === 'fixing') {
      return step(3, 'Fix', 'now', head + list + '<p class="muted small">Tick each step as it is done, and answer each question. When every step is done, verify with the readings.</p>', { sub: `${n} of ${all} done ${U.progress(n, all)}` });
    }
    return step(3, 'Fix', 'done', `<details class="wk-so"><summary>Action flow · ${esc(flowName(f))} · ${n === all ? (all === 1 ? 'its one step done' : `all ${all} steps done`) : `${n} of ${all} steps done`}</summary>${list}</details>`, {});
  }
  function readingNow(key, iss, sensor) {
    if (!sensor) return '';
    const lt = latestOf(key, sensor.id); if (!lt || lt.v == null) return '';
    /* the Issue's own terms; a reported Issue has none, so the sensor's zones now */
    const lim = iss.terms ? null : call(() => V().limitsOf(key, sensor.id, sensor.primaryDir), null);
    const tm = iss.terms || (lim ? { dir: lim.dir || sensor.primaryDir, bands: lim.bands } : {}); const bands = tm.bands || {};
    if (!iss.terms && !Object.values(bands).some((x) => x != null)) return `<div class="wk-now"><p>${esc(`Now ${val(lt.v, sensor.unit, sensor.kind)} at ${fmtTime(lt.t)}`)} ${U.sampleTag()}</p></div>`;
    const inBand = sensor.kind === 'status' ? null : U.bandOf(lt.v, tm.dir, bands);
    const words = `Now ${val(lt.v, sensor.unit, sensor.kind)} at ${fmtTime(lt.t)}${inBand ? `: still in ${BAND[inBand]}` : sensor.kind === 'status' ? '' : ': inside the limits'}`;
    const bar = sensor.kind === 'status' ? '' : U.bandBar({ dir: tm.dir, bands, value: lt.v, valid: sensor.valid, unit: sensor.unit });
    return `<div class="wk-now"><p>${esc(words)} ${U.sampleTag()}</p>${bar}</div>`;
  }
  function closedText(iss) {
    const c = causeOf(iss.diag && iss.diag.causeId);
    if (iss.falseAlarm) { const l = arr(iss.log).slice().reverse().find((x) => /false alarm/i.test(x.text)); const why = l ? String(l.text).replace(/^.*?false alarm[^:]*:\s*/i, '') : ''; return `Closed as a false alarm${why ? ': ' + clean(why) : ''}. It counts in Coverage's false alarms.`; }
    if (iss.closedHow === 'reading') return 'Closed by the reading: it came back inside the limits before anyone started it.';
    if (iss.closedHow === 'sensor fault') return `Closed as a sensor fault${c ? ` (${clean(c.name)})` : ''}.`;
    return `Closed${c ? `: ${clean(c.name)}` : ''}.`;
  }
  const FALSE_WHY = ['The reading came back by itself', 'The sensor was being cleaned or calibrated', 'Planned work on the equipment', 'The limit is too tight for this plant', 'Something else'];
  const falseOptions = (iss) => FALSE_WHY.map((w) => ({ value: w, label: w, sub: w === 'The limit is too tight for this plant' && iss.alertId ? 'Then override the zone on its sensor, with a reason' : '' }));
  const falseNoteField = (note) => U.field({ label: 'Note', hint: 'Needed for "Something else"; helps the Lead either way.', html: `<textarea name="wk-note" rows="3" placeholder="What you saw">${esc(note || '')}</textarea>` });
  const FALSE_COUNTS = 'It closes now and counts in Coverage as closed as a false alarm, where noisy Triggers show up.';
  function verifyCard(key, iss, sensor) {
    const closed = iss.status === 'closed';
    if (closed) return step(4, 'Verify', 'done', `<p>${esc(closedLabel(iss))} ${esc(fmt(iss.closed))}${iss.closedBy ? ' by ' + esc(iss.closedBy) : ''}.</p>`, {});
    /* attention goes to the diagnostic flow; "Close as a false alarm" is a quiet second choice here */
    const falseLink = `<p class="muted small wk-false-l">Not a real problem? ${U.btn('Close as a false alarm', { act: 'work:false', data: dataOf(key, iss), kind: 'ghost', small: true, title: 'It was not a real problem: say why. It counts in Coverage.' })}</p>`;
    if (iss.status !== 'verifying') return step(4, 'Verify', 'next', falseLink, { sub: 'Check the readings once the fix is done.' });
    const q = sensor ? 'Do the readings show it worked?' : 'Is the problem gone?';
    const lt = sensor ? latestOf(key, sensor.id) : null; const still = lt && lt.v != null && sensor.kind !== 'status' && iss.terms ? U.bandOf(lt.v, iss.terms.dir, iss.terms.bands || {}) : null;
    /* the consequence first: closing now records it as fixed while the reading is still in a band, or when the reading came back on
       its own before the fix was done (the last fix step, else the root cause, is the moment the fix happened) */
    const fixAt = arr(iss.log).filter((x) => /^(Done: |All fix steps done|Root cause|Fix started)/.test(String(x.text)) || /\? (Yes|No)$/.test(String(x.text))).reduce((m, x) => Math.max(m, +x.at || 0), 0) || null;
    const before = !still && iss.cleared != null && fixAt != null && iss.cleared < fixAt;
    const body = `<p class="wk-q">${esc(q)}</p>${readingNow(key, iss, sensor)}${still ? `<p class="muted small">The reading has not come back yet: it is still in ${esc(BAND[still] || still)}. Move time on (+1 hour) to watch it. Closing now records the fix as worked while the reading is still in ${esc(BAND[still] || still)}.</p>` : ''}${before ? `<p class="small wk-before"><b>The reading came back at ${esc(fmtTime(iss.cleared))}${fmtDay(iss.cleared) !== fmtDay(now()) ? `, ${esc(fmtDay(iss.cleared))}` : ''}, before the fix.</b> Close it, but it may not have been the fix: the record will say the readings show it worked.</p>` : ''}${falseLink}`;
    const foot = U.btn('Yes: close the Issue', { act: 'work:verify', data: dataOf(key, iss, { ok: 1 }), kind: 'primary' }) + U.btn('No: back to the diagnostic flow', { act: 'work:verify', data: dataOf(key, iss, { ok: 0 }) });
    return step(4, 'Verify', 'now', body, { foot });
  }
  /* ?close=false-alarm: the false-alarm close, open at the top of the page, asking why (the zones preview links here) */
  let FALSE_ERR = null;
  function falseCloseCard(key, iss) {
    const e = FALSE_ERR && FALSE_ERR.key === key && FALSE_ERR.id === iss.id ? FALSE_ERR : null; FALSE_ERR = null;
    const body = `<form class="wk-falseform" data-act="work:false-go" data-plant="${esc(key)}" data-id="${esc(iss.id)}">`
      + U.field({ label: 'Why was it a false alarm?', html: U.radios({ name: 'wk-why', value: e ? e.why : '', options: falseOptions(iss) }) })
      + falseNoteField(e ? e.note : '')
      + `<p class="muted small">${esc(FALSE_COUNTS)}</p>${e ? U.note(e.msg, 'bad') : ''}`
      + `<div class="wk-ff">${U.btn('Cancel', { href: hrefIssue(key, iss.id), kind: 'ghost' })}${U.btn('Close as a false alarm', { submit: true, kind: 'primary' })}</div></form>`;
    return U.card({ title: 'Close as a false alarm', sub: `${iss.title}: say why it was not a real problem.`, body, cls: 'wk-false is-target', id: 'wk-close' });
  }

  /* aside */
  function frozenHtml(key, iss, sensor) {
    if (!iss.alertId) return '';
    const h = heldOf(key, iss.alertId); if (!h || !h.held) return '';
    const tag = sensor ? sensor.tag || sensor.name : 'its sensor';
    if (iss.status !== 'closed' && h.frozen && arr(h.openIssueIds).includes(iss.id)) {
      return `<p class="wk-frozen">This Trigger is frozen while this Issue is open: changes on ${esc(tag)} show as Base moved on the Trigger until someone resyncs it.</p>`;
    }
    /* the Issue whose close left the Trigger waiting: it says so, and where to resync */
    if (iss.status === 'closed' && h.waiting) {
      const latest = issuesOf(key, {}).filter((i) => i.alertId === iss.alertId).sort((a, b) => b.opened - a.opened)[0];
      if (latest && latest.id === iss.id) return `<p class="wk-frozen">Since this Issue closed, ${esc(triggerName(key, iss.alertId))} keeps the terms it was frozen on: it shows Base moved until someone resyncs it. ${U.link('Open the Trigger', hrefTrigger(key, iss.alertId))}</p>`;
    }
    return '';
  }
  function whatCard(key, iss, sensor) {
    const s = subjectOfIssue(key, iss);
    if (iss.alertId) {
      const a = alertOf(key, iss.alertId); const tm = iss.terms || {}; const terms = call(() => V().issueTerms(key, iss.id), null);
      const peakLabel = sensor && sensor.kind === 'status' ? 'Reading' : tm.dir === 'below' ? 'Lowest' : 'Highest';
      const rows = [
        ['Trigger', a ? H(`${U.link(triggerName(key, a.id), hrefTrigger(key, a.id))} ${triggerChip(key, a)}`) : iss.title],
        ['Reading', sensor ? H(`${U.link(`${sensor.name}${sensor.tag ? ' · ' + sensor.tag : ''}`, hrefSensor(key, sensor.id))}${s && s.tag ? ` on ${U.link(s.tag, subjHref(key, s))}` : ''}`) : '—'],
        ['Severity', H(U.sev(iss.band))],
        [peakLabel, iss.peak != null ? H(`${esc(val(iss.peak, tm.unit || (sensor && sensor.unit), sensor && sensor.kind))} ${U.sampleTag()}`) : '—'],
      ];
      if (iss.cleared && iss.status !== 'closed') rows.push(['Back inside', fmt(iss.cleared)]);
      let body = U.kv(rows);
      if (terms) {
        body += `<div class="wk-terms"><p>${esc(terms.text)}</p></div>`;
        body += terms.changed ? U.note(`${terms.changedText}. This Issue keeps the terms it opened under until it closes; the new ones apply to the next one.`, 'warn') : '<p class="muted small">It steps up and clears by these terms while it is open.</p>';
      }
      body += frozenHtml(key, iss, sensor);
      return U.card({ title: 'What fired', body, cls: 'wk-aside' });
    }
    const it = issueType(iss.issueTypeId); const rep = arr(iss.log)[0];
    const by = rep ? (String(rep.text).match(/^Reported by (.+?)(?: on |:)/) || [])[1] : null;
    const rows = [['Problem', iss.title], ['On', s && s.kind !== 'plant' ? H(U.link(s.text, subjHref(key, s))) : 'The plant'], ['Reported', `${fmt(rep ? rep.at : iss.opened)}${by ? ' by ' + by : ''}`]];
    if (it) { const f = foundText([...new Set(arr(it.detection).map((d) => d.kind))]); if (f) rows.push(['Usually', f.replace(/^Found/, 'found')]); }
    if (iss.sensorId && sensor) rows.push(['Reading', H(U.link(`${sensor.name}${sensor.tag ? ' · ' + sensor.tag : ''}`, hrefSensor(key, sensor.id)))]);
    return U.card({ title: iss.sensorFault ? 'What was reported: a sensor fault' : 'What was reported', body: U.kv(rows), cls: 'wk-aside' });
  }
  function toldCard(key, iss) {
    const groups = toldGroups(arr(iss.told).filter((x) => x.how !== 'hooter'));
    const hooter = arr(iss.told).some((x) => x.how === 'hooter');
    const rows = groups.map((g) => `<li><div><b>${esc(g.who)}</b>${g.role ? ` <span class="muted">· ${esc(g.role)}</span>` : ''}</div><div class="muted small">${esc(cap(joinWords(g.hows.map((h) => HOW[h] || h))))} · ${esc(g.times.map((t) => fmtTime(t)).join(', '))}</div></li>`).join('') + (hooter ? '<li><div><b>The plant hooter</b></div></li>' : '');
    const body = `<p class="wk-told-s">${esc(toldSummary(iss))}.</p>${rows ? `<ul class="wk-told">${rows}</ul>` : ''}<p class="muted small">Who is reached comes from the roster and the routing on the plant's ${U.link('People', hrefPeople(key))} tab.</p>`;
    return U.card({ title: 'Who was told', body, cls: 'wk-aside' });
  }
  /* Alex's words for the diagnosis in the log ("Diagnostic flow started by …") */
  const logText = (t) => String(t == null ? '' : t).replace(/^Diagnosis started/, 'Diagnostic flow started');
  function logCard(iss) {
    const log = arr(iss.log); if (!log.length) return '';
    let day = ''; const items = log.map((l) => { const d = fmtDay(l.at); const head = d !== day ? `<li class="wk-day">${esc(d)}</li>` : ''; day = d; return `${head}<li><span class="mono">${esc(fmtTime(l.at))}</span><span>${esc(logText(l.text))}</span></li>`; }).join('');
    return U.card({ title: 'What happened', body: `<ol class="wk-log">${items}</ol>`, cls: 'wk-aside' });
  }
  /* crumbs through the stage and the subject: All Plants › Manesar STP › Secondary › AT-2 */
  function stageCrumb(key, s) {
    const S = W.V7STRUCT;
    if (S && typeof S.stageCrumb === 'function') { const c = call(() => S.stageCrumb(key, s.id), null); if (c && typeof c === 'object' && c.label) return { label: c.label, href: c.href || `${base(key)}/structure` }; }
    let up = s.kind === 'up' ? s : null;
    if (!up) { const e = eqOf(key, s.id); const first = e && arr(e.participatesIn)[0]; up = first ? subjectOf(key, { kind: 'up', id: first.upId || first.id }) : null; }
    if (up && up.stageLabel) return { label: up.stageLabel, href: up.stage ? `${base(key)}/structure?stage=${enc(up.stage)}` : `${base(key)}/structure` };
    return { label: 'Structure', href: `${base(key)}/structure` };
  }
  function subjectCrumbs(key, s) {
    if (!s || s.kind === 'plant') return [{ label: 'Issues', href: hrefIssues(key) }];
    return [stageCrumb(key, s), { label: s.tag, href: subjHref(key, s) }];
  }

  function issuePage(params) {
    const key = params.plant; const p = plantOf(key); if (!p) return noPlant();
    const q = params._q || {};
    const iss = issueOf(key, params.id);
    if (!iss) return notFound(key, 'Issue', hrefIssues(key), 'All Issues here');
    const s = subjectOfIssue(key, iss); const sensor = sensorOf(key, iss.sensorId);
    const flow = flowOf(iss.diag && iss.diag.flowId);
    const closed = iss.status === 'closed';
    const sub = H(`Subject: ${s && s.kind !== 'plant' ? U.link(s.text, subjHref(key, s)) : 'The plant'} · opened ${esc(fmt(iss.opened))}${closed ? ` · closed ${esc(fmt(iss.closed))}` : ` · ${esc(openFor(now() - iss.opened))}`}`);
    let banner = '';
    if (closed) banner = U.banner(`${closedText(iss)} Took ${dur(iss.closed - iss.opened)}.`, { tone: iss.falseAlarm ? 'info' : 'ok' });
    else if (iss.commissioning) banner = U.banner(`Opened while ${p.name} was in Commissioning: nothing was sent. It is worked here like any other Issue.`, { tone: 'info' });
    const terms = !closed && iss.alertId ? call(() => V().issueTerms(key, iss.id), null) : null;
    if (!closed && terms && terms.changed) banner += U.banner(`${terms.changedText}. It keeps those terms until it closes.`, { tone: 'warn' });
    const top = q.close === 'false-alarm' ? (closed ? U.note('This Issue is already closed.', 'quiet') : falseCloseCard(key, iss)) : '';
    const main = `${top}<div class="wk-flow">${diagCard(key, iss, flow)}${causeCard(key, iss, sensor)}${fixCard(key, iss)}${verifyCard(key, iss, sensor)}</div>`;
    const aside = whatCard(key, iss, sensor) + toldCard(key, iss) + logCard(iss);
    const chips = issueChips(key, iss).concat([plantStateChip(p)], iss.alertId ? [U.sampleTag()] : []);
    return U.page({
      crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }].concat(subjectCrumbs(key, s), [{ label: iss.title }]),
      title: iss.title, sub, chips, banner, body: main, aside, cls: 'wk wk-issue',
    });
  }

  /* ── modals: report a problem, root causes, false alarm, close with a note ─────────────────────────────── */
  /* a subject as the report form carries it: 'up:<id>' · 'eq:<id>' · 'plant' · '' */
  function normSubj(key, x) {
    if (x == null || x === '') return '';
    if (x === 'plant' || (typeof x === 'object' && x.kind === 'plant')) return 'plant';
    let id = typeof x === 'object' ? x.id : String(x);
    const m = /^(up|eq):(.+)$/.exec(id); if (m) id = m[2];
    const s = subjectOf(key, id); return s && s.kind !== 'plant' ? `${s.kind}:${s.id}` : '';
  }
  const refOf = (subj) => (subj === 'plant' ? { kind: 'plant' } : /^(up|eq):/.test(subj || '') ? { kind: subj.slice(0, 2), id: subj.slice(3) } : null);
  const STAGE_ORDER = ['preliminary', 'primary', 'secondary', 'tertiary', 'sludge'];
  const stageRank = (st) => { const i = STAGE_ORDER.indexOf(st); return i < 0 ? 99 : i; };
  let REPORT = { key: null, subj: '' };
  /* a subject's Issue types: its unit-process type's or its equipment type's, from the library */
  function typesFor(key, ref) {
    if (!ref || ref.kind === 'plant') return [];
    const viaCore = call(() => V().issueTypesFor(key, ref), null); if (Array.isArray(viaCore)) return viaCore;
    const s = subjectOf(key, ref); return s ? arr(call(() => V().issueTypes(s.typeName), [])) : [];
  }
  function severityField(key) {
    const ladder = arr(call(() => V().routing(key).ladder, []));
    const lineOf = (b, fb) => { const l = ladder.find((x) => x.band === b); return l && l.text ? String(l.text).replace(/^[A-Za-z]+:\s*/, '') : fb; };
    return U.field({ label: 'How serious is it?', html: U.radios({ name: 'wk-band', value: 'minor', options: [
      { value: 'minor', label: 'Minor', sub: lineOf('minor', 'Operators by WhatsApp or SMS; Leads in the app') },
      { value: 'major', label: 'Major', sub: lineOf('major', 'Operators and Leads by WhatsApp or SMS, with a full-screen warning in the app') },
      { value: 'emergency', label: 'Emergency', sub: lineOf('emergency', 'Calls every Operator, Lead and Senior Lead, and a full-screen warning in the app') },
    ] }) });
  }
  function reportBody(key, subj0, err) {
    const p = plantOf(key) || {}; const subj = normSubj(key, subj0);
    const ups = arr(call(() => V().unitProcesses(key), [])).map((u, i) => ({ u, i })).sort((a, b) => stageRank(a.u.stage) - stageRank(b.u.stage) || a.i - b.i).map((x) => x.u);
    const eqs = arr(call(() => V().equipment(key), []));
    const opt = (value, label) => `<option value="${esc(value)}"${value === subj ? ' selected' : ''}>${esc(label)}</option>`;
    const upOpts = ups.map((u) => opt(`up:${u.id}`, `${u.tag} · ${u.typeName || u.type || ''}${u.stageLabel ? ` (${u.stageLabel})` : ''}`)).join('');
    const eqOpts = eqs.map((e) => opt(`eq:${e.id}`, `${e.tag} · ${e.type}`)).join('');
    const select = `<select name="wk-subj" data-act="work:report-subj" data-plant="${esc(key)}"><option value=""${subj ? '' : ' selected'}>Choose what it is about…</option>`
      + (upOpts ? `<optgroup label="Unit processes">${upOpts}</optgroup>` : '') + (eqOpts ? `<optgroup label="Equipment">${eqOpts}</optgroup>` : '')
      + `<optgroup label="The whole plant">${opt('plant', p.name || 'The plant')}</optgroup></select>`;
    let html = U.field({ label: 'What is it about?', html: select });
    if (!subj) return html + '<p class="muted small">Pick what it is about first: the Issue types come from its type in the library.</p>' + (err ? U.note(err, 'bad') : '');
    if (subj === 'plant') return html + U.note('No problems are written for the whole plant yet. Report it on the unit process or equipment where you saw it.', 'quiet') + (err ? U.note(err, 'bad') : '');
    const ref = refOf(subj); const s = subjectOf(key, ref) || {};
    const its = typesFor(key, ref);
    if (!its.length) return html + U.note(`The library has no Issues written for ${s.typeName || 'its type'} yet. Tell the Lead directly.`, 'quiet') + (err ? U.note(err, 'bad') : '');
    const options = its.map((it) => ({ value: it.id, label: it.name, sub: [foundText(it.foundBy), it.causes ? `${plural(it.causes, 'root cause')} to check, one question each` : ''].filter(Boolean).join(' · ') }));
    html += U.field({ label: `What is wrong with ${s.tag}?`, html: U.radios({ name: 'wk-it', options, value: '' }) });
    if (p.state === 'live') html += severityField(key);
    else html += U.note(`${p.name || 'The plant'} is in Commissioning: nothing is sent. The Issue is recorded here, with its diagnostic flow.`, 'quiet');
    if (err) html += U.note(err, 'bad');
    return html;
  }
  const reportable = (key, subj) => { const ref = refOf(subj); return !!ref && ref.kind !== 'plant' && typesFor(key, ref).length > 0; };
  const reportSub = (key, subj) => { const p = plantOf(key) || {}; const s = subj && subj !== 'plant' ? subjectOf(key, refOf(subj)) : null; return `${p.name || ''}${s ? ' · ' + s.tag : ''}: it opens an Issue with its diagnostic flow`; };
  const reportFoot = (key, subj) => U.btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + U.btn('Report it', { act: 'work:report-go', data: { plant: key }, kind: 'primary', disabled: !reportable(key, subj) });
  function openReport(key, subject, err) {
    if (!plantOf(key)) { U.toast('That plant is not in the prototype.'); return; }
    const subj = normSubj(key, subject);
    REPORT = { key, subj };
    U.modal({ title: 'Report a problem', sub: reportSub(key, subj), body: reportBody(key, subj, err), wide: true, foot: reportFoot(key, subj) });
  }

  function causesModal(key, issueId) {
    const iss = issueOf(key, issueId); if (!iss) return;
    const node = eqOf(key, (subjectOfIssue(key, iss) || {}).id || iss.eqId);
    const cs = arr(call(() => V().causesFor(key, issueId), []));
    const options = cs.map((c) => {
      const elsewhere = node && c.types.length && !c.types.includes(node.type);
      return { value: c.id, label: c.name, sub: [c.sensorFault ? 'Sensor fault: the fix is the probe' : '', elsewhere ? `Sits on a ${c.types.slice(0, 2).join(' or ')}: the Issue will say "Caused by"` : '', c.fixFlowId ? 'Has an Action flow' : 'No Action flow written'].filter(Boolean).join(' · ') };
    });
    U.modal({ title: 'Which root cause is it?', sub: `${iss.title}: the root causes its diagnostic flow can land on`, wide: true,
      body: options.length ? U.radios({ name: 'wk-cause', label: 'Root cause', options, value: iss.diag && iss.diag.causeId || '' }) : U.empty('No root causes are written for this Issue.'),
      foot: U.btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + (options.length ? U.btn('This is the root cause', { act: 'work:cause-go', data: { plant: key, id: issueId }, kind: 'primary' }) : '') });
  }
  function falseModal(key, issueId, err, vals) {
    const iss = issueOf(key, issueId); if (!iss) return;
    const v = vals || {};
    const body = U.field({ label: 'Why was it a false alarm?', html: U.radios({ name: 'wk-why', value: v.why || '', options: falseOptions(iss) }) })
      + falseNoteField(v.note) + `<p class="muted small">${esc(FALSE_COUNTS)}</p>` + (err ? U.note(err, 'bad') : '');
    U.modal({ title: 'Close as a false alarm', sub: iss.title, body,
      foot: U.btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + U.btn('Close as a false alarm', { act: 'work:false-go', data: { plant: key, id: issueId }, kind: 'primary' }) });
  }
  function closeNoteModal(key, issueId, err) {
    const iss = issueOf(key, issueId); if (!iss) return;
    U.modal({ title: 'Close with a note', sub: iss.title,
      body: U.field({ label: 'What did you find and do?', html: '<textarea name="wk-note" rows="4"></textarea>' }) + (err ? U.note(err, 'bad') : ''),
      foot: U.btn('Cancel', { act: 'ui:close', data: { what: 'modal' }, kind: 'ghost' }) + U.btn('Close the Issue', { act: 'work:close-go', data: { plant: key, id: issueId }, kind: 'primary' }) });
  }

  /* ── one Task ──────────────────────────────────────────────────────────────────────────────────────────── */
  const TASK_TONE = { due: 'warn', doing: 'info', upcoming: 'muted', waiting: 'muted' };
  function fromBanner(key, q) {
    const iss = q.from ? issueOf(key, q.from) : null; if (!iss) return '';
    const f = flowOf(iss.fix && iss.fix.flowId); const st = f && q.step != null ? f.steps.find((x) => String(x.id) === String(q.step)) : null;
    const idx = st ? f.steps.indexOf(st) + 1 : null; const ticked = st && arr(iss.fix.done).map(String).includes(String(st.id));
    const text = `Part of the fix for "${iss.title}"${idx ? `, step ${idx}` : ''}.${ticked ? ' That step is already ticked.' : ''}`;
    const canTick = st && !ticked && iss.status === 'fixing';
    const action = (canTick ? U.btn('Done: back to the Issue', { act: 'work:return', data: { plant: key, id: iss.id, step: st.id }, kind: 'primary' }) : '') + U.btn(canTick ? 'Back without ticking it' : 'Back to the Issue', { href: hrefIssue(key, iss.id), kind: canTick ? 'ghost' : 'secondary' });
    return U.banner(text, { tone: 'info', action });
  }
  function generalTaskPage(key, p, gt, q) {
    const f = flowOf(gt.flow); const steps = f ? f.steps : [];
    const rows = [['For', arr(gt.types).join(', ') || (arr(gt.plantTypes).length ? `${arr(gt.plantTypes).join(', ')} plants` : '—')], ['Cadence in the library', String(gt.frequency || '—').split('\n')[0]], ['Kind of work', gt.actionType || '—']];
    const body = U.card({ title: 'Action flow', sub: plural(steps.length, 'step'), body: steps.length ? `<ol class="wk-plain">${steps.map((s) => `<li><span>${esc(s.text)}</span> ${stepChips(s, f)}</li>`).join('')}</ol>` : U.empty('No Action flow is written for this Task.') })
      + U.card({ title: 'About this Task', body: U.kv(rows) + U.note(`${p.name} has no Task for this, so it has no due date here. Its Action flow is shown so a fix can follow it.`, 'quiet') });
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }, { label: 'Tasks', href: base(key) + '/tasks' }, { label: cleanTaskName(gt.name) }],
      title: cleanTaskName(gt.name), sub: 'A general Task in the library', chips: [U.chip('General Task', { tone: 'muted' }), plantStateChip(p)], banner: fromBanner(key, q), body, cls: 'wk wk-task' });
  }
  /* before go-live: when the Task would first fall due if the plant went live now (its last service date, else go-live day) */
  function firstDueRow(key, t) { const g = call(() => V().goLiveTasks(key, now()), null); return g ? arr(g.rows).find((r) => r.taskId === t.id) || null : null; }
  function serviceRow(key, eqId) { const sd = eqId ? call(() => V().serviceDates(key), null) : null; return sd ? arr(sd.rows).find((r) => r.eqId === eqId) || null : null; }
  function nextDueHtml(key, t, live, canWork) {
    if (live || canWork) return t.due == null ? '—' : H(`${esc(fmt(t.due))}${t.overdue ? ' ' + U.chip('Overdue', { tone: 'bad' }) : ''}`);
    const r = firstDueRow(key, t);
    if (!r) return 'On go-live day';
    if (r.why === 'service') return `If the plant went live now: first due ${fmt(r.due)}, counted from its ${r.anchorFrom === 'done' ? 'last completion' : 'last service date'}`;
    if (r.why === 'service-passed') return 'On go-live day: its last service date plus its cadence has already passed';
    return 'On go-live day';
  }
  function lastServiceHtml(key, t, live) {
    if (live) return t.lastDone != null ? fmt(t.lastDone) : 'Not done at this plant yet';
    if (t.lastDone != null) return fmtDay(t.lastDone);
    const eqId = t.workType !== 'pm' ? null : t.subject && t.subject.kind !== 'plant' ? t.subject.id : arr(t.eqIds)[0] || null;
    if (!eqId) return H(`— <span class="muted small">No service date: it falls due on go-live day.</span>`);
    const row = serviceRow(key, eqId);
    if (row && row.date != null) return H(`${esc(row.dateText || fmtDay(row.date))} <span class="muted small">· entered for ${esc(row.tag)} under ${U.link('Last service dates', hrefPeople(key, 'service-dates'))}</span>`);
    return H(`Not entered <span class="muted small">· ${U.link('Enter dates', hrefPeople(key, 'service-dates'))}</span>`);
  }
  function taskPage(params) {
    const key = params.plant; const p = plantOf(key); if (!p) return noPlant();
    const q = params._q || {};
    const t = call(() => V().task(key, params.id), null);
    if (!t) { const gt = arr(W.ISSUE_TASKS).find((x) => x.id === params.id); if (gt) return generalTaskPage(key, p, gt, q); return notFound(key, 'Task', base(key) + '/tasks', 'All Tasks here'); }
    const live = p.state === 'live'; const canWork = live || t.status === 'due' || t.status === 'doing';   /* a Task already due when the plant returned to Commissioning can still be done */
    const f = flowOf(t.flowId); const steps = arr(t.steps);
    const s = t.subject || (t.plantLevel || !arr(t.eqIds).length ? subjectOf(key, 'plant') : subjectOf(key, t.eqIds[0]));
    const scId = arr(t.scheduleIds)[0] || t.id;
    const cad = call(() => V().cadenceOf(key, scId), null);
    const target = q.f === 'cadence' ? ' is-target' : '';
    const cadence = H(`<span class="wk-cad${target}" id="f-cadence">${esc((cad && cad.everyText) || t.everyText || '—')} ${chipHtml(cad && cad.chip)}</span> <span class="wk-edit">${U.link('Edit on the Task\'s Trigger page', hrefTrigger(key, scId, 'f=cadence'))}</span>`);
    const rows = [
      ['On', H(s && s.kind !== 'plant' ? `${U.link(s.text, subjHref(key, s))} <span class="muted small">· ${esc(KIND_WORD[s.kind] || 'equipment')}</span>` : 'The plant')],
      ['Cadence', cadence],
      ['Next due', nextDueHtml(key, t, live, canWork)],
      ['Last service', lastServiceHtml(key, t, live)],
    ];
    /* v7/2: condition-based work: a line on an Issue Trigger raises it at a unit process or the plant; it has no cadence and no last service */
    if (t.kind === 'line') {
      const w = t.from || {}; const sh = `${base(key)}/sensor/${encodeURIComponent(w.sensorId)}?f=zone.${w.dir}.${w.band}`;
      rows.length = 0;
      rows.push(['On', H(s && s.kind !== 'plant' ? `${U.link(s.text, subjHref(key, s))} <span class="muted small">· ${esc(KIND_WORD[s.kind] || 'unit process')}</span>` : 'The plant')]);
      rows.push(['Raised when', H(`${U.link(`${w.eqTag} ${w.reading}`, sh)} ${esc(w.dir === 'below' ? 'falls below' : 'rises above')} its ${esc(w.bandLabel || '')} line, now ${esc(w.limitText || '—')}. That line opens no Issue; the next line out does.`)]);
      if (w.why) rows.push(['Why', w.why]);
      rows.push(['Now', !live ? 'Raised once the plant is live' : t.status === 'due' || t.status === 'doing' ? H(`Raised ${esc(fmt(t.raisedAt || t.due))}${t.raisedBy ? `, at ${esc(call(() => V().fmtVal(t.raisedBy.value, w.unit || '', w.kind), String(t.raisedBy.value)))}` : ''}${t.overdue ? ' ' + U.chip('Overdue', { tone: 'bad' }) : ''}`) : 'Waiting for the reading to cross the line']);
      rows.push(['Last done', t.lastDone ? fmt(t.lastDone) : 'Not yet']);
    }
    if (t.statutory) rows.push(['Required by law', 'Yes']);
    /* run-hours work is counted by its hour meter (it only counts while the equipment runs), from the last service or go-live */
    if (t.basis === 'meter' || t.basis === 'either') rows.push(['Run hours', t.meter ? (live ? `Counted by its hour meter: ${Math.max(0, Math.round(t.meter.left))} run-hours to go (meter at ${Math.round(t.meter.now)} h, due at ${Math.round(t.meter.at)} h; about ${t.meter.rateDay} h a day)` : `Counted by its hour meter from go-live: due at ${Math.round(t.meter.at)} h (meter at ${Math.round(t.meter.now)} h)`) : (live ? 'Counted by its hour meter since go-live' : 'Counted by its hour meter once the plant is Live')]);
    const n = steps.filter((x) => arr(t.done).map(String).includes(String(x.id))).length;
    const stepsBody = !steps.length ? U.empty('No Action flow is written for this Task.') : tickList(steps, { prefix: 'task', done: t.done, act: 'work:taskstep', disabled: !canWork, data: (st) => ({ plant: key, id: t.id, step: st.id }), chips: (st) => stepChips(st, f), links: (st) => linkLines(key, null, st, null) });
    const doneBtn = canWork && !(t.kind === 'line' && t.status !== 'due' && t.status !== 'doing') ? U.btn(t.status === 'upcoming' ? 'Mark it done now' : 'Mark the Task done', { act: 'work:taskdone', data: { plant: key, id: t.id }, kind: 'primary' }) : '';
    const stepsCard = U.card({ title: 'Action flow', sub: steps.length ? `${f ? esc(flowName(f)) + ' · ' : ''}${n} of ${steps.length} ticked` : '', body: stepsBody + (canWork ? '' : U.note('Tasks start when the plant goes live. Until then the Action flow is here to read.', 'quiet')), foot: doneBtn || null });
    const hist = arr(t.history).slice(-5).reverse();
    const histCard = hist.length ? U.card({ title: 'Done before', body: `<ul class="wk-hist">${hist.map((h) => `<li><span>${esc(fmt(h.done))}</span>${h.late ? U.chip('late', { tone: 'warn' }) : U.chip('on time', { tone: 'ok' })}</li>`).join('')}</ul>` }) : '';
    const chips = [U.chip(t.workLabel || 'Task', { tone: 'muted' }), U.chip(t.statusLabel || cap(t.status), { tone: TASK_TONE[t.status] || 'muted' }), plantStateChip(p)];
    const lead = canWork && (t.status === 'due' || t.overdue) && t.due != null ? `<p class="lead has-att">${t.overdue ? 'Overdue' : 'Due now'}: ${t.kind === 'line' ? 'raised' : 'it was due'} ${esc(fmt(t.due))}.</p>` : '';
    const body = lead + U.card({ title: 'About this Task', body: U.kv(rows) }) + stepsCard + histCard;
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }, { label: 'Tasks', href: base(key) + '/tasks' }, { label: cleanTaskName(t.name) }],
      title: cleanTaskName(t.name), sub: cleanTaskName(t.line || ''), chips, banner: fromBanner(key, q), body, cls: 'wk wk-task' });
  }

  /* ── events ────────────────────────────────────────────────────────────────────────────────────────────── */
  const ga = (el, k) => (el && el.getAttribute ? el.getAttribute('data-' + k) : null);
  const rootOf = (el, sel) => (el && el.closest ? el.closest(sel) : null) || (typeof document !== 'undefined' && document.querySelector ? document.querySelector(sel) : null);
  const valIn = (root, name) => { if (!root || !root.querySelector) return ''; const r = root.querySelector(`input[name="${name}"]:checked`); if (r) return r.value; const x = root.querySelector(`[name="${name}"]`); return x && x.type !== 'radio' ? x.value : ''; };
  const fail = (r) => { U.toast((r && r.error) || 'That did not work.'); return false; };
  /* after a close: the consequence for a Trigger whose terms moved while it was frozen */
  function waitsLine(key, id) {
    const iss = issueOf(key, id); if (!iss || !iss.alertId) return '';
    const h = heldOf(key, iss.alertId); return h && h.waiting ? ` ${triggerName(key, iss.alertId)} now waits for a resync: its terms moved while it was frozen.` : '';
  }

  U.on('work:report', (el) => { openReport(ga(el, 'plant'), ga(el, 'subject') || ga(el, 'eq')); return false; });
  function reportInPlace(el) {
    const key = ga(el, 'plant') || REPORT.key; const subj = normSubj(key, el.value || ''); const box = el.closest ? el.closest('.modal') : null;
    const b = box && box.querySelector('.modal-b'); const f = box && box.querySelector('.modal-f'); const s = box && box.querySelector('.modal-s');
    if (!b || !f) { openReport(key, subj); return false; }
    REPORT = { key, subj };                                         // in place: no flash, the select keeps focus
    b.innerHTML = reportBody(key, subj); f.innerHTML = reportFoot(key, subj);
    if (s) s.textContent = reportSub(key, subj);
    const sel = b.querySelector('select[name="wk-subj"]'); if (sel && sel.focus) sel.focus();
    return false;
  }
  U.on('work:report-subj', reportInPlace);
  U.on('work:report-go', (el) => {
    const key = ga(el, 'plant') || REPORT.key; const root = rootOf(el, '.modal');
    const sel = root && root.querySelector ? root.querySelector('[name="wk-subj"]') : null;   /* the form's own pick; the remembered one only without a form */
    const subj = normSubj(key, sel ? sel.value : REPORT.subj); const it = valIn(root, 'wk-it'); const band = valIn(root, 'wk-band') || 'minor';
    if (!subj) { openReport(key, '', 'Pick what it is about first.'); return false; }
    if (subj === 'plant') { openReport(key, 'plant', 'No problems are written for the whole plant yet. Report it on the unit process or equipment where you saw it.'); return false; }
    if (!it) { openReport(key, subj, 'Pick what is wrong.'); return false; }
    const r = call(() => V().report(key, refOf(subj), it, { band }), { ok: false });
    if (!r || !r.ok) { openReport(key, subj, (r && r.error) || 'The Issue could not be opened.'); return false; }
    U.closeModal(true);
    const s = subjectOf(key, refOf(subj));
    U.toast(`Issue opened on ${s ? s.tag : 'it'}: ${r.issue ? r.issue.title : 'the problem'}. Its diagnostic flow is ready.`);
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
    else if (r.open) U.toast('The diagnostic flow ends here: pick the root cause, or close with a note.');
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
    const f = flowOf(r.flowId); U.toast(f ? `Fix started: ${flowName(f)}. Tick each step of its Action flow as it is done.` : 'No Action flow for this root cause: check the readings, then verify.');
  });
  U.on('work:fixstep', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id');
    const r = call(() => V().fixStep(key, id, ga(el, 'step'), ga(el, 'answer') || undefined), { ok: false }); if (!r.ok) return fail(r);
    if (r.status === 'verifying') U.toast('Every step is done: now verify with the readings.');
  });
  U.on('work:return', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const iss = issueOf(key, id);
    if (iss && iss.status === 'fixing' && !arr(iss.fix.done).map(String).includes(String(ga(el, 'step')))) {
      const r = call(() => V().fixStep(key, id, ga(el, 'step'), ga(el, 'answer') || undefined), { ok: false }); if (!r.ok) return fail(r);
      U.toast(r.status === 'verifying' ? 'Step ticked. Every step is done: now verify with the readings.' : 'Step ticked: back to the fix.');
    }
    U.go(hrefIssue(key, id)); return false;
  });
  U.on('work:verify', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const ok = ga(el, 'ok') === '1';
    const r = call(() => V().verify(key, id, ok), { ok: false }); if (!r.ok) return fail(r);
    U.toast(ok ? `Verified and closed.${waitsLine(key, id)}` : 'Back to the diagnostic flow: it starts again from the first question.');
  });
  U.on('work:false', (el) => { falseModal(ga(el, 'plant'), ga(el, 'id')); return false; });
  U.on('work:false-go', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const root = rootOf(el, '.modal, .wk-falseform');
    const inline = !!(root && root.classList && root.classList.contains && root.classList.contains('wk-falseform')) || (el && el.tagName === 'FORM');
    const why = valIn(root, 'wk-why'); const note = String(valIn(root, 'wk-note') || '').trim();
    const refuse = (msg) => { if (inline) { FALSE_ERR = { key, id, msg, why, note }; return undefined; } falseModal(key, id, msg, { why, note }); return false; };
    if (!why) return refuse('Say why it was a false alarm.');
    if (why === 'Something else' && !note) return refuse('Write a note for "Something else".');
    const text = why === 'Something else' ? note : note ? `${why} (${note})` : why;
    const r = call(() => V().close(key, id, { falseAlarm: true, note: text }), { ok: false });
    if (!r.ok) return refuse(r.error || 'It could not be closed.');
    U.closeModal(true);
    const iss = issueOf(key, id);
    U.toast(`${why === 'The limit is too tight for this plant' && iss && iss.alertId ? 'Closed as a false alarm. If the limit is too tight, override it on the sensor\'s zones, with a reason.' : 'Closed as a false alarm. It counts in Coverage.'}${waitsLine(key, id)}`);
    if (inline) { U.go(hrefIssue(key, id)); return false; }
    return undefined;
  });
  U.on('work:closenote', (el) => { closeNoteModal(ga(el, 'plant'), ga(el, 'id')); return false; });
  U.on('work:close-go', (el) => {
    const key = ga(el, 'plant'); const id = ga(el, 'id'); const note = String(valIn(rootOf(el, '.modal'), 'wk-note') || '').trim();
    if (!note) { closeNoteModal(key, id, 'Write what you found and did.'); return false; }
    const r = call(() => V().close(key, id, { note }), { ok: false }); if (!r.ok) { closeNoteModal(key, id, r.error); return false; }
    U.closeModal(true); U.toast(`Closed with your note.${waitsLine(key, id)}`);
  });

  U.on('work:taskstep', (el) => { const r = call(() => V().doTaskStep(ga(el, 'plant'), ga(el, 'id'), ga(el, 'step')), { ok: false }); if (!r.ok) return fail(r); });
  U.on('work:taskdone', (el) => {
    const key = ga(el, 'plant'); const r = call(() => V().doneTask(key, ga(el, 'id')), { ok: false }); if (!r.ok) return fail(r);
    U.toast(r.task && r.task.due != null ? `Done. Next due ${fmt(r.task.due)}.` : 'Done. Its next one waits for go-live.');
  });

  /* ── routes, css, exports ──────────────────────────────────────────────────────────────────────────────── */
  U.route('p/:plant/issues', issuesPage);
  U.route('p/:plant/issue/:id', issuePage);
  U.route('p/:plant/task/:id', taskPage);
  if (typeof U.addCss === 'function') U.addCss('assets/work7.css?v=1');

  W.V7WORK = { issuesPage, issuePage, taskPage, openReport, report: openReport, reportButton, issueList, issueItem, issueChips, statusChip, toldSummary, subjectChip, hrefIssue, hrefTask, _reportBody: reportBody };
}());
