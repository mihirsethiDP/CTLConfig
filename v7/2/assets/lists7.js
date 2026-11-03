/* v7/2 · lists7.js · window.V7LISTS — the plant's lists: Triggers, Readings, Tasks, and the plant's own details.

   Loads after core7.js and the core72 files (window.V7), ui7.js (window.V7UI) and plant7.js (window.V7PLANT). Pure string
   renderers registered with V7UI.route. Every number on these pages comes from a core function; the page only formats it.
   Calls into other page modules (V7PLANT.frame, V7STRUCT.subjectChip, V7OBJ.designParamsBlock) are looked up when a page
   renders and each has a plain fallback, so a missing or failing module never blanks a list.

   ROUTES
     p/:plant/triggers   Every Trigger at the plant. Commissioning: Trigger · Subject · Reads · Status · Bands · Trial firings / day.
                         Live: … · Issues, last 7 days (or since go-live) · A day · Closed as false alarm · Median time to close.
                         The Triggers that create Tasks follow in their own table.
                         query: ?sort=trial (noisiest first) · ?show=draft (drafts and undecided proposals only)
     p/:plant/readings   Live plants only: every reading the plant graph sends, by equipment, with its limits (read-only;
                         "Edit on sensor"). A Commissioning plant shows where its readings are instead.
     p/:plant/tasks      Tasks by subject: on unit processes (stage and flow order), on equipment, on the plant; one Tasks-a-day
                         number. query: ?show=due (Live: due now)
     p/:plant/details    The plant's own details and its design parameters.          query: ?f=dp.<key> highlights a parameter

   API (window.V7LISTS)
     pages.{triggers, readings, tasks, details}(params) → html (the route functions)
     bodies.{triggers, readings, tasks, details}(key, query) → the page body inside the plant frame (for tests)
     triggerRows(key, query) → {live, show, sort, issue:[row], task:[row], counts} · taskSections(key, query) → [{id, title, groups}]

   ACTIONS (data-act)  none of its own: every edit lives on the sensor, Trigger, Task or bindings-pass page these rows link to.

   STYLES  assets/lists7.css (linked by prototype.html; added here when it is not). Uses v7.css tokens only. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const U = W.V7UI;
  if (!U) { if (W.console) console.error('lists7.js needs ui7.js (window.V7UI) loaded first'); return; }
  const V = () => W.V7 || null;
  const { esc, chip, btn, card, empty, note, table, filters } = U;

  /* ── helpers ──────────────────────────────────────────────────────────────────────────────────────────── */
  const arr = (x) => (Array.isArray(x) ? x : []);
  const enc = (s) => encodeURIComponent(String(s));
  const isNum = (x) => typeof x === 'number' && isFinite(x);
  const cap = (s) => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const pl = (n, one, many) => U.plural(n, one, many);
  const base = (key) => `#/p/${enc(key)}`;
  const H = (html) => ({ html: String(html) });   /* already-escaped html for the V7UI builders */
  const BANDS = ['caution', 'minor', 'major', 'emergency'];
  const BAND_LABEL = { caution: 'Caution', minor: 'Minor', major: 'Major', emergency: 'Emergency' };
  const SOFT = [];
  function call(fn, fb) {
    try { const r = fn(); return r == null ? fb : r; }
    catch (e) { SOFT.push(String(e && e.message || e)); if (SOFT.length > 100) SOFT.shift(); if (W.console) console.error('[lists7]', e && e.message ? e.message : e); return fb; }
  }
  /* one block of a page: if it fails, say so in place and keep the rest of the page */
  function part(label, fn) {
    try { return fn() || ''; } catch (e) { if (W.console) console.error('[lists7] ' + label, e); return note(`${label} could not be shown: ${e && e.message ? e.message : e}`, 'bad'); }
  }
  const mapBy = (xs, k) => { const m = {}; arr(xs).forEach((x) => { if (x && x[k] != null) m[x[k]] = x; }); return m; };
  function rate(x) { if (U.rate) return U.rate(x); if (!isNum(x) || x === 0) return '0'; return x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100); }
  function pct(x) { return isNum(x) ? `${Math.round(x * 100)}%` : '—'; }
  function minutes(m) { if (!isNum(m)) return '—'; if (U.dur) return U.dur(m); const v = V(); return v && v.fmtDur ? v.fmtDur(m) : `${Math.round(m)} min`; }
  const fmt = (ms) => (ms == null ? '—' : U.fmt(ms));
  const fmtDay = (ms) => (ms == null ? '—' : U.fmtDay(ms));
  const muted = (t) => `<span class="muted">${esc(t)}</span>`;
  const sub = (html) => `<div class="l7-sub">${html}</div>`;
  const plantOf = (key) => { const v = V(); return key && v && v.plant ? call(() => v.plant(key), null) : null; };
  const isLive = (p) => !!p && p.state === 'live';

  /* a source chip from a core chip object {text, tone, sub, small, extra}: always visible, its sub and small lines under it */
  function srcChip(c) {
    if (!c) return '';
    if (typeof c === 'string') return chip(c, { tone: 'lib' });
    const extra = arr(c.extra).map((x) => (x && x.text ? chip(x.text, { tone: x.tone }) : '')).filter(Boolean).join(' ');
    return chip(c.text || '', { tone: c.tone }) + (extra ? ' ' + extra : '') + (c.sub ? sub(esc(c.sub)) : '') + (c.small ? sub(esc(c.small)) : '');
  }
  /* Trigger status: Draft · never fires · Active · trial · Active · Inactive (one value; "trial" only at a Commissioning plant) */
  const PHASE_CLS = { draft: 'draft', trial: 'trial', live: 'on', inactive: 'off' };
  const PHASE_TEXT = { draft: 'Draft · never fires', trial: 'Active · trial', live: 'Active', inactive: 'Inactive' };
  function phaseText(phase) { const v = V(); const L = v && v.LABELS && v.LABELS.triggerChip; return (L && L[phase]) || PHASE_TEXT[phase] || cap(phase); }
  function statusChip(phase, text) { return `<span class="chip st st-${PHASE_CLS[phase] || 'off'}">${esc(text || phaseText(phase))}</span>`; }
  /* "AT-2 · unit process" / "BL-1 · equipment" / "The plant": structure7's chip when it is there */
  function subjectChip(key, s) {
    const S = W.V7STRUCT;
    if (S && typeof S.subjectChip === 'function' && s) { const h = call(() => S.subjectChip(key, s), null); if (typeof h === 'string' && h) return h; }
    if (!s) return muted('—');
    const text = s.kind === 'plant' ? 'The plant' : `${s.tag || ''} · ${s.kind === 'up' ? 'unit process' : 'equipment'}`;
    return chip(text, { href: s.href || null, cls: 'l7-subj' });
  }
  function subjectFor(key, eqId) {
    const v = V(); if (!v) return null;
    const s = v.subjectOf ? call(() => v.subjectOf(key, eqId || 'plant'), null) : null;
    if (s) return s;
    if (!eqId) return { kind: 'plant', text: 'The plant', href: base(key) };
    const e = v.eq ? call(() => v.eq(key, eqId), null) : null;
    return e ? { kind: 'eq', id: e.id, tag: e.tag, typeName: e.typeName || e.type, href: `${base(key)}/eq/${enc(e.id)}` } : null;
  }

  /* ── the plant frame ──────────────────────────────────────────────────────────────────────────────────── */
  function notFound(key) {
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: 'Not found' }], title: 'No such plant', sub: key ? `There is no plant "${key}" in the prototype.` : '', body: empty('This plant is not in the prototype.', btn('All Plants', { href: '#/plants', kind: 'primary' })) });
  }
  /* plant7's frame (tabs, chips, crumbs); this one only when plant7 is missing or fails */
  function ownFrame(key, active, body, o) {
    const p = plantOf(key); if (!p) return notFound(key);
    const live = isLive(p);
    const T = (live ? [['home', 'Coverage', ''], ['readings', 'Readings', '/readings']] : [['home', 'Readiness', '']])
      .concat([['structure', 'Structure', '/structure'], ['triggers', 'Triggers', '/triggers'], ['issues', 'Issues', '/issues'], ['tasks', 'Tasks', '/tasks'], ['people', 'People', '/people'], ['deviations', 'Deviations', '/deviations'], ['activity', 'Activity', '/activity']]);
    const chips = [chip(p.type || '—', { mono: true }), chip(live ? `Live since ${fmtDay(p.since)}` : 'Commissioning · nothing is sent', { tone: live ? 'ok' : 'info', cls: 'st' }),
      p.sample === false ? chip('Real plant graph', { tone: 'info' }) : chip('Sample plant', { tone: 'muted' })];
    return U.page({ crumbs: [{ label: 'All Plants', href: '#/plants' }, { label: p.name, href: base(key) }].concat(arr(o && o.crumbs)), title: p.name, chips,
      actions: [U.link('Plant details', `${base(key)}/details`)], tabs: T.map(([id, label, suf]) => ({ id, label, href: base(key) + suf })), active, body, cls: 'pg-plant' });
  }
  function frame(key, active, body, opts) {
    const P = W.V7PLANT;
    if (P && typeof P.frame === 'function') {
      try { const h = P.frame(key, active, body, opts || {}); if (typeof h === 'string' && h) return h; } catch (e) { SOFT.push('V7PLANT.frame: ' + String(e && e.message || e)); if (W.console) console.error('[lists7] V7PLANT.frame', e); }
    }
    return ownFrame(key, active, body, opts || {});
  }
  function guard(params, fn) {
    const key = params && params.plant;
    if (!plantOf(key)) return notFound(key);
    return fn(key, (params && params._q) || {});
  }

  /* ── order: unit processes in stage and flow order; equipment after the first unit process it takes part in ─────── */
  function orderOf(key) {
    const v = V(); const st = v && v.structure ? call(() => v.structure(key), null) : null;
    const upRank = {}; let i = 0;
    arr(st && st.stages).forEach((s) => arr(s.upIds).forEach((id) => { if (upRank[id] == null) upRank[id] = i++; }));
    arr(st && st.ups).forEach((u) => { if (upRank[u.id] == null) upRank[u.id] = i++; });
    const eqIds = arr(st && st.equipment).map((e) => e.eqId);
    if (!eqIds.length && v && v.equipment) arr(call(() => v.equipment(key), [])).forEach((e) => eqIds.push(e.id));
    const eqRank = {}; const firstUp = {};
    eqIds.forEach((id, k) => {
      const m = v && v.membershipOf ? call(() => v.membershipOf(key, id), null) : null;
      const ranks = arr(m && m.participatesIn).map((x) => upRank[x.upId]).filter(isNum);
      const f = ranks.length ? Math.min(...ranks) : null; firstUp[id] = f;
      eqRank[id] = (f != null ? f * 1000 + 500 : 900000) + k;
    });
    const rank = (s) => {
      if (!s) return 999999;
      if (s.kind === 'plant') return 990000;
      if (s.kind === 'up') return upRank[s.id] != null ? upRank[s.id] * 1000 : 800000;
      return eqRank[s.id] != null ? eqRank[s.id] : 950000;
    };
    return { rank, upRank, eqRank, firstUp, structure: st };
  }

  /* ── Triggers ─────────────────────────────────────────────────────────────────────────────────────────── */
  function bandsCell(key, a, tb) {
    const bs = (tb && tb.bands) || null;
    const sym = a.kind === 'status' ? 'when' : a.dir === 'below' ? '<' : '>';
    const vals = BANDS.map((b) => {
      const x = bs && bs[b]; const val = x ? x.value : a.bands ? a.bands[b] : null;
      if (val == null) return null;
      return `${BAND_LABEL[b]} ${sym} ${(x && x.valueText) || U.num(val, a.unit)}`;
    }).filter(Boolean);
    let label = 'Follows sensor'; let tone = 'lib'; let overlay = null;
    if (a.frozen || (tb && tb.frozen)) { label = 'Frozen'; tone = 'frozen'; overlay = bs ? (BANDS.map((b) => bs[b] && bs[b].overlayText).find(Boolean) || null) : null; }
    else if (a.waiting || (tb && tb.waiting)) { label = 'Base moved · waits for a resync'; tone = 'moved'; }
    else if (bs && BANDS.some((b) => bs[b] && (bs[b].overrideId || bs[b].follows === false))) { label = 'Overridden for this Trigger'; tone = 'ovr'; }
    let gap = null;
    if (!vals.length && bs) { const z = BANDS.map((b) => bs[b] && bs[b].zone && bs[b].zone.chip).find((c) => c && c.tone === 'gap'); if (z) gap = z; }
    return { label, tone, overlay, values: vals.join(' · '), gap };
  }
  function issueRows(key, live, ord) {
    const v = V();
    const as = arr(call(() => v.alerts(key, {}), []));
    const tt = live ? {} : mapBy(call(() => v.trialTable(key), []), 'alertId');
    const cov = live ? call(() => v.coverage(key), null) : null;
    const per = mapBy(cov && cov.perTrigger, 'alertId');
    return as.map((a, i) => {
      const phase = a.phase || (a.state === 'active' ? (live ? 'live' : 'trial') : a.state);
      const tb = v.triggerBands ? call(() => v.triggerBands(key, a.id), null) : null;
      const t = tt[a.id] || null; const p = per[a.id] || null;
      return {
        kind: 'issue', id: a.id, name: a.name, href: `${base(key)}/trigger/${enc(a.id)}`, subject: a.subject || subjectFor(key, a.eqId), order: i,
        reads: a.sensorId ? { tag: a.sensorTag || a.sensorName, name: a.sensorName, href: `${base(key)}/sensor/${enc(a.sensorId)}` } : null,
        phase, statusText: a.chipText || phaseText(phase), bands: bandsCell(key, a, tb),
        trial: t ? { perDay: t.perDay, perDayText: t.count ? t.perDayText : '0', count: t.count, noisy: !!t.noisy, chip: t.chip || null } : null,
        live: p ? { issues: p.issues, perDay: p.perDay, perDayText: p.perDayText, noisy: !!p.noisy, chip: p.chip || null, share: p.falseAlarmShare, median: p.medianCloseMin } : null,
        flag: a.structureFlag || null, pinnedTo: a.pinnedTo || null, rejected: a.decided === 'rejected', reason: a.reason || null,
        rank: ord.rank(a.subject),
      };
    });
  }
  function taskTriggerRows(key, live, ord, pass) {
    const v = V();
    const passBySched = {}; arr(pass && pass.rows).forEach((r) => { if (r && r.scheduleId) passBySched[r.scheduleId] = r; });
    const taskBySched = {}; arr(call(() => v.tasks(key), [])).forEach((t) => arr(t.scheduleIds).forEach((id) => { taskBySched[id] = t; }));
    const out = [];
    arr(call(() => v.schedules(key), [])).forEach((s, i) => {
      if (!['active', 'draft', 'off'].includes(s.status)) return;
      const pr = passBySched[s.id] || null; if (pr && pr.status === 'rejected') return;
      const phase = s.status === 'active' ? (live ? 'live' : 'trial') : s.status === 'draft' ? 'draft' : 'inactive';
      const cad = v.cadenceOf ? call(() => v.cadenceOf(key, s.id), null) : null;
      const subject = (taskBySched[s.id] && taskBySched[s.id].subject) || (pr && pr.subject) || subjectFor(key, s.eqId);
      out.push({ kind: 'task', id: s.id, name: s.name, href: `${base(key)}/trigger/${enc(s.id)}`, subject, order: i, phase, statusText: phaseText(phase),
        cadence: { text: cap(s.everyText || (cad && cad.everyText) || ''), chip: cad ? cad.chip : null, work: s.workLabel || '' }, rank: ord.rank(subject) });
    });
    arr(pass && pass.rows).filter((r) => r && r.kind === 'condition' && r.workId && ['active', 'draft', 'inactive'].includes(r.status)).forEach((r, i) => {
      const c = v.conditionOf ? call(() => v.conditionOf(key, r.workId), null) : null;
      const phase = r.status === 'active' ? (live ? 'live' : 'trial') : r.status;
      const f = c && c.perField ? c.perField.doWhen : null;
      out.push({ kind: 'condition', id: r.workId, name: r.name, href: `${base(key)}/trigger/${enc(r.workId)}`, subject: r.subject || subjectFor(key, r.eqId), order: 10000 + i, phase, statusText: phaseText(phase),
        cadence: { text: (c && c.text) || '', chip: f ? f.chip : null, work: '' }, rank: ord.rank(r.subject) });
    });
    return out;
  }
  /* proposals the bindings pass has not turned into Triggers yet (undecided or can't resolve): listed with ?show=draft */
  function proposalRows(key, pass, ord, have) {
    return arr(pass && pass.rows).filter((r) => r && ['undecided', 'cantResolve'].includes(r.status)).filter((r) => !have.has(`${r.outcome === 'task' ? 'task' : 'issue'}|${r.name}|${(r.subject && r.subject.tag) || ''}`)).map((r, i) => {
      const show = r.status === 'cantResolve' ? 'cantresolve' : 'undecided';
      const vals = arr(r.values).filter((x) => x && x.band).map((x) => x.text);
      return {
        kind: r.outcome === 'task' ? 'task' : 'issue', proposal: true, id: r.pid, name: r.name, href: `${base(key)}/review/bindings?show=${show}&f=${enc(r.pid)}`, subject: r.subject || null, order: 20000 + i,
        reads: r.reads ? { tag: r.reads.tag, name: null, href: r.reads.sensorId ? `${base(key)}/sensor/${enc(r.reads.sensorId)}` : null } : null,
        phase: 'draft', statusText: r.statusLabel || cap(r.status), why: r.cantResolve && r.cantResolve.text ? `Can't resolve: ${r.cantResolve.text}` : null,
        bands: { label: 'Proposed', tone: 'prop', values: vals.join(' · '), gap: null },
        cadence: { text: cap(arr(r.values).map((x) => x && x.text).filter(Boolean).join(' · ')), chip: arr(r.values)[0] ? r.values[0].chip : null, work: '' },
        rank: ord.rank(r.subject),
      };
    });
  }
  const drafty = (r) => r.proposal || r.phase === 'draft';
  function triggerRows(key, q) {
    const v = V(); const p = plantOf(key); const live = isLive(p); q = q || {};
    const show = q.show === 'draft' ? 'draft' : 'all';
    const sort = q.sort === 'trial' || q.sort === 'issues' || q.sort === 'noisy' ? 'noisy' : 'subject';
    const ord = orderOf(key);
    const pass = v && v.bindingsPass ? call(() => v.bindingsPass(key, { show: 'all' }), null) : null;
    const issue = issueRows(key, live, ord);
    const task = taskTriggerRows(key, live, ord, pass);
    const have = new Set(issue.map((r) => `issue|${r.name}|${(r.subject && r.subject.tag) || ''}`).concat(task.map((r) => `task|${r.name}|${(r.subject && r.subject.tag) || ''}`)));
    const props = proposalRows(key, pass, ord, have);
    const bySubject = (a, b) => a.rank - b.rank || String(a.name).localeCompare(String(b.name)) || a.order - b.order;
    const noisyFirst = live
      ? (a, b) => ((b.live ? b.live.issues : -1) - (a.live ? a.live.issues : -1)) || bySubject(a, b)
      : (a, b) => ((b.trial ? b.trial.perDay : -1) - (a.trial ? a.trial.perDay : -1)) || bySubject(a, b);
    const cmp = sort === 'noisy' ? noisyFirst : bySubject;
    const draftsAll = issue.filter(drafty).length + task.filter(drafty).length + props.length;
    const pick = (rows, extra) => (show === 'draft' ? rows.filter(drafty).concat(extra) : rows).sort(cmp);
    return {
      key, live, show, sort, plant: p, pass,
      issue: pick(issue, props.filter((r) => r.kind === 'issue')),
      task: pick(task, props.filter((r) => r.kind === 'task')).sort(bySubject),
      counts: { issue: issue.length, task: task.length, drafts: draftsAll, active: issue.filter((r) => r.phase === 'trial' || r.phase === 'live').length },
    };
  }
  function nameCell(r) {
    const chips = [];
    if (r.flag) chips.push(chip('Structure changed', { tone: 'warn', title: r.flag.line || r.flag.text || '' }));
    if (r.pinnedTo != null) chips.push(chip(`Pinned to v${r.pinnedTo}`, { tone: 'pin' }));
    const lines = [];
    if (r.rejected) lines.push(esc(r.reason ? `Rejected in the bindings pass: ${r.reason}` : 'Rejected in the bindings pass'));
    if (r.why) lines.push(esc(r.why));
    return H(`<a href="${esc(r.href)}">${esc(r.name)}</a>${chips.length ? ` <span class="l7-chips">${chips.join(' ')}</span>` : ''}${lines.map((l) => sub(l)).join('')}`);
  }
  function readsCell(r) {
    if (!r.reads) return H(muted('—'));
    const t = r.reads.href ? `<a class="mono" href="${esc(r.reads.href)}">${esc(r.reads.tag)}</a>` : `<span class="mono">${esc(r.reads.tag)}</span>`;
    return H(t + (r.reads.name ? sub(esc(r.reads.name)) : ''));
  }
  function bandsHtml(r) {
    const b = r.bands || {};
    const vals = b.values ? sub(esc(b.values)) : b.gap ? sub(chip(b.gap.text, { tone: b.gap.tone })) : '';
    return H(chip(b.label, { tone: b.tone, title: b.overlay || '' }) + (b.overlay ? sub(esc(b.overlay)) : '') + vals);
  }
  function noisyChip(text) { return text ? ' ' + chip(text, { tone: 'warn' }) : ''; }
  function issueTable(key, R) {
    const cols = [
      { label: 'Trigger', render: nameCell },
      { label: 'Subject', render: (r) => H(subjectChip(key, r.subject)) },
      { label: 'Reads', render: readsCell },
      { label: 'Status', render: (r) => H(statusChip(r.phase, r.statusText)) },
      { label: 'Bands', render: bandsHtml },
    ];
    if (!R.live) {
      cols.push({ label: 'Trial firings / day', cls: 'l7-num', render: (r) => (r.trial ? H(`<span class="mono">${esc(r.trial.perDayText)}</span>${noisyChip(r.trial.noisy ? r.trial.chip : null)}`) : H(muted('—'))) });
    } else {
      const cov = call(() => V().coverage(key), null); const wl = (cov && cov.window && cov.window.label) || 'Issues, last 7 days';
      const noisyText = (cov && cov.triggers && cov.triggers.noisyChip) || 'Noisy · more than 10 a day';
      cols.push(
        { label: wl, cls: 'l7-num', render: (r) => (r.live ? H(`<span class="mono">${esc(r.live.issues)}</span>`) : H(muted('—'))) },
        { label: 'A day', cls: 'l7-num', render: (r) => (r.live ? H(`<span class="mono">${esc(r.live.perDayText != null ? r.live.perDayText : rate(r.live.perDay))}</span>${noisyChip(r.live.noisy ? r.live.chip || noisyText : null)}`) : H(muted('—'))) },
        { label: 'Closed as false alarm', cls: 'l7-num', render: (r) => (r.live ? H(`<span class="mono">${esc(pct(r.live.share))}</span>`) : H(muted('—'))) },
        { label: 'Median time to close', cls: 'l7-num', render: (r) => (r.live ? H(`<span class="mono">${esc(minutes(r.live.median))}</span>`) : H(muted('—'))) },
      );
    }
    return table({ cols, rows: R.issue.map((r) => Object.assign({ _href: r.href, _cls: r.phase === 'inactive' ? 'l7-quiet' : '' }, r)), cls: 'l7-trig' });
  }
  function taskTriggerTable(key, rows) {
    return table({
      cols: [
        { label: 'Trigger', render: nameCell },
        { label: 'Subject', render: (r) => H(subjectChip(key, r.subject)) },
        { label: 'Cadence', render: (r) => H(`${esc(r.cadence.text || '—')}${r.cadence.chip ? ' ' + srcChip(r.cadence.chip) : ''}${r.cadence.work ? sub(esc(r.cadence.work)) : ''}`) },
        { label: 'Status', render: (r) => H(statusChip(r.phase, r.statusText)) },
      ],
      rows: rows.map((r) => Object.assign({ _href: r.href, _cls: r.phase === 'inactive' ? 'l7-quiet' : '' }, r)), cls: 'l7-trig',
    });
  }
  function triggersBody(key, q) {
    const v = V(); const R = triggerRows(key, q); const b = base(key); const p = R.plant || {};
    const parts = [];
    /* the lead: the trial so far (Commissioning) or the window's Issues (Live), all from the core */
    if (!R.live) {
      const tr = call(() => v.checklist(key).trial, null);
      parts.push(`<p class="lead l7-lead">${tr && tr.text ? `<b>${esc(tr.text)}.</b> ` : ''}While ${esc(p.name || '')} is in Commissioning, active Triggers record trial firings only, at every severity: nothing is sent.</p>`);
    } else {
      const cov = call(() => v.coverage(key), null); const ct = (cov && cov.triggers) || {};
      const bits = [isNum(ct.active) ? `${pl(ct.active, 'Trigger')} active` : '', cov && cov.window ? `${cov.window.label}: ${isNum(ct.issues) ? ct.issues : 0}` : ''].filter(Boolean);
      parts.push(`<p class="lead l7-lead">${bits.length ? `<b>${esc(bits.join(' · '))}.</b> ` : ''}Each active Trigger creates Issues and notifies the plant's people.${ct.draftsText && ct.drafts ? ` ${esc(ct.draftsText)} · <a href="${esc(ct.draftsLink || `${b}/review/bindings`)}">${esc(ct.draftsLinkText || 'Open the bindings pass')}</a>` : ''}</p>`);
    }
    const total = R.counts.issue + R.counts.task;
    const tools = `<div class="l7-tools">${filters([
      { label: 'All', href: `${b}/triggers`, on: R.show === 'all' && R.sort === 'subject', count: total },
      { label: 'Noisiest first', href: `${b}/triggers?sort=trial`, on: R.show === 'all' && R.sort === 'noisy' },
      { label: 'Drafts and undecided', href: `${b}/triggers?show=draft`, on: R.show === 'draft', count: R.counts.drafts },
    ].filter((f) => f.on || f.label !== 'Drafts and undecided' || f.count))}</div>`;
    /* nothing accepted yet: say where the Triggers come from (the proposals stay listable under ?show=draft) */
    if (!total && (R.show === 'all' || !R.counts.drafts)) {
      const pass = R.pass || {}; const c = pass.counts || {};
      const open = !!pass.open; const waiting = (c.undecided || 0) + (c.cantResolve || 0);
      const text = open ? `No Triggers yet. ${pl(waiting, 'proposal')} ${waiting === 1 ? 'waits' : 'wait'} in the bindings pass.` : (pass.waitingText || 'No Triggers yet. They come from the bindings pass.');
      if (R.counts.drafts) parts.push(tools);
      parts.push(empty(text, open ? btn('Open the bindings pass', { href: `${b}/review/bindings`, kind: 'primary' }) : btn('Open the structure pass', { href: `${b}/review/structure`, kind: 'primary' })));
      return parts.join('');
    }
    parts.push(tools);
    const sample = chip('Sample readings', { tone: 'sample', title: 'Readings here are generated samples, not from the plant' });
    if (R.issue.length || R.show === 'all') {
      parts.push(card({ title: 'Triggers that raise Issues', sub: R.show === 'draft' ? 'Drafts never fire. Undecided proposals open in the bindings pass.' : (R.live ? 'Bands follow the sensor\'s Zones unless a Trigger is overridden, frozen or waiting for a resync.' : 'Trial firings a day count from when each Trigger became active, never less than one day.'),
        actions: [sample], body: R.issue.length ? issueTable(key, R) : empty('No Trigger raises Issues here yet.'), cls: 'l7-card' }));
    }
    if (R.task.length) {
      const open = R.show === 'draft';
      parts.push(`<details class="l7-more"${open ? ' open' : ''}><summary><span class="l7-sum-t">Triggers that create Tasks</span> <span class="l7-sum-n">${esc(R.task.length)}</span><span class="l7-sum-s">Each makes Tasks on its own unit process, piece of equipment or the plant. Cadence is changed on the Task's Trigger page.</span></summary>${taskTriggerTable(key, R.task)}</details>`);
    }
    if (R.show === 'draft' && !R.issue.length && !R.task.length) parts.push(empty('No drafts and nothing undecided.', btn('All Triggers', { href: `${b}/triggers` })));
    return parts.join('');
  }
  function triggersPage(params) { return guard(params, (key, q) => frame(key, 'triggers', `<div class="l7">${part('The Triggers', () => triggersBody(key, q))}</div>`, {})); }

  /* ── Readings (Live plants only) ──────────────────────────────────────────────────────────────────────── */
  function readingsInfo(key) {
    const v = V(); const p = plantOf(key);
    const rt = v && v.readingsTab ? call(() => v.readingsTab(key), null) : null;
    return { rt, available: rt ? !!rt.available : isLive(p), plant: p };
  }
  function readingsBody(key) {
    const b = base(key); const I = readingsInfo(key);
    if (!I.available) {
      return empty('The Readings tab opens when the plant goes Live. During Commissioning, readings are on each unit process and equipment page.', btn('Structure', { href: `${b}/structure`, kind: 'primary' }));
    }
    const groups = arr(I.rt && I.rt.groups);
    const v = V(); const st = v && v.structure ? call(() => v.structure(key), null) : null;
    const upType = {}; arr(st && st.ups).forEach((u) => { upType[u.id] = u.typeName; });
    const blocks = groups.map((g) => {
      const href = g.kind === 'up' ? `${b}/up/${enc(g.nodeId)}` : `${b}/eq/${enc(g.nodeId)}`;
      const where = g.kind === 'up' ? ['Unit process', upType[g.nodeId]].filter(Boolean).join(' · ') : g.upsText || 'Outside any unit process';
      const rows = arr(g.rows).map((r) => {
        const seen = new Set(); const chips = arr(r.chips).filter((c) => c && c.text && !seen.has(c.text) && seen.add(c.text));
        return {
          _href: r.href, _cls: r.nextPhase ? 'l7-quiet' : '',
          name: H(`<a href="${esc(r.href)}">${esc(r.name)}</a>${r.tag ? sub(`<span class="mono">${esc(r.tag)}</span>`) : ''}`),
          now: H(r.nowText && r.nowText !== '—' ? `<span class="mono">${esc(r.nowText)}</span>` : muted('—')),
          limits: H(r.limitsText ? esc(r.limitsText) : muted('—')),
          src: H(chips.length ? chips.map((c) => srcChip(c)).join(' ') : muted('—')),
          trig: H(r.nextPhase ? muted('—') : `<span class="mono">${esc(isNum(r.triggers) ? r.triggers : 0)}</span> · <a href="${esc(r.href)}">Edit on sensor</a>`),
        };
      });
      return `<section class="l7-group"><div class="l7-gh"><h3><a href="${esc(href)}"><span class="mono">${esc(g.tag)}</span>${g.name ? ` · ${esc(g.name)}` : ''}</a></h3><span class="muted">${esc(where)}</span></div>${table({ cols: [{ label: 'Reading', key: 'name' }, { label: 'Now', key: 'now', cls: 'nowrap' }, { label: 'Limits', key: 'limits' }, { label: 'Source', key: 'src' }, { label: 'Triggers', key: 'trig' }], rows, cls: 'l7-readt' })}</section>`;
    }).join('');
    const sample = chip('Sample readings', { tone: 'sample', title: 'Readings here are generated samples, not from the plant' });
    return card({ title: 'Readings', sub: 'Every reading the plant graph sends, by equipment. Limits are edited on each sensor.', actions: [sample], body: blocks || empty('The plant graph sends no readings here.'), cls: 'l7-card' })
      + `<p class="l7-foot">Hand tests and lab results keep their numbers in the task record: they have no limits. <a href="${esc(b)}/tasks">See Tasks.</a></p>`;
  }
  function readingsPage(params) { return guard(params, (key) => frame(key, 'readings', `<div class="l7">${part('The readings', () => readingsBody(key))}</div>`, {})); }

  /* ── Tasks ────────────────────────────────────────────────────────────────────────────────────────────── */
  function taskSections(key, q) {
    const v = V(); const p = plantOf(key); const live = isLive(p); q = q || {};
    const ord = orderOf(key);
    let ts = arr(call(() => v.tasks(key), []));
    const all = ts.length;
    const dueNow = ts.filter((t) => t.status === 'due' || t.status === 'doing' || t.overdue);
    const show = live && q.show === 'due' ? 'due' : 'all';
    if (show === 'due') ts = dueNow;
    const first = !live && v.goLiveTasks ? mapBy(arr((call(() => v.goLiveTasks(key), {}) || {}).rows), 'taskId') : {};
    const rows = ts.map((t, i) => {
      const subject = t.subject || (t.plantLevel ? subjectFor(key, null) : subjectFor(key, arr(t.eqIds)[0]));
      const cad = v.cadenceOf && arr(t.scheduleIds)[0] ? call(() => v.cadenceOf(key, t.scheduleIds[0]), null) : null;
      return { t, subject, cad, first: first[t.id] || null, order: i, rank: ord.rank(subject) };
    });
    const groupsOf = (list) => {
      const m = new Map();
      list.sort((a, b) => a.rank - b.rank || a.order - b.order).forEach((r) => { const k = r.subject ? `${r.subject.kind}:${r.subject.id || ''}` : 'none'; if (!m.has(k)) m.set(k, { subject: r.subject, rows: [] }); m.get(k).rows.push(r); });
      return [...m.values()];
    };
    const kindOf = (r) => (r.subject ? r.subject.kind : 'plant');
    const sections = [
      { id: 'up', title: 'On unit processes', groups: groupsOf(rows.filter((r) => kindOf(r) === 'up')) },
      { id: 'eq', title: 'On equipment', groups: groupsOf(rows.filter((r) => kindOf(r) === 'eq')) },
      { id: 'plant', title: 'On the plant', groups: groupsOf(rows.filter((r) => kindOf(r) !== 'up' && kindOf(r) !== 'eq')) },
    ].filter((s) => s.groups.length);
    return { live, show, all, dueNow: dueNow.length, sections, perDay: call(() => v.tasksPerDay(key), 0), ord, plant: p };
  }
  const TASK_TONE = { due: 'warn', doing: 'info', upcoming: 'muted', waiting: 'muted' };
  function dueCell(r, live) {
    const t = r.t;
    if (t.status === 'due' || t.status === 'doing' || (live && t.due != null)) {
      if (t.due == null) return H(muted('—'));
      return H(`<span class="${t.overdue ? 'tx-bad' : t.status === 'due' ? 'tx-warn' : ''}">${esc(fmt(t.due))}</span>${t.overdue ? sub('<span class="tx-bad">Overdue</span>') : ''}`);
    }
    if (live) return H(muted('—'));
    const f = r.first;
    if (!f) return H(muted('At go-live'));
    if (f.why === 'service') return H(`${esc(fmtDay(f.due))}${sub('from its last service')}`);
    return H('Go-live day');
  }
  function taskTable(key, rows, live) {
    return table({
      cols: [
        { label: 'Task', render: (r) => H(`<a href="${esc(`${base(key)}/task/${enc(r.t.id)}`)}">${esc(r.t.name)}</a>${r.t.workLabel ? sub(esc(r.t.workLabel)) : ''}`) },
        { label: 'Cadence', render: (r) => H(`${esc(cap(r.t.everyText || (r.cad && r.cad.everyText) || ''))}${r.cad && r.cad.chip ? ' ' + srcChip(r.cad.chip) : ''}`) },
        { label: 'Next due', cls: 'nowrap', render: (r) => dueCell(r, live) },
        { label: 'Status', render: (r) => H(chip(r.t.statusLabel || cap(r.t.status || ''), { tone: r.t.overdue ? 'bad' : TASK_TONE[r.t.status] || 'muted' })) },
      ],
      rows: rows.map((r) => ({ _href: `${base(key)}/task/${enc(r.t.id)}`, t: r.t, cad: r.cad, first: r.first })), cls: 'l7-taskt',
    });
  }
  function groupHead(key, g, ord) {
    const s = g.subject;
    if (!s || s.kind === 'plant') return '';
    const v = V();
    let where = '';
    if (s.kind === 'up') where = [s.typeName, s.stageLabel].filter(Boolean).join(' · ');
    else {
      const m = v && v.membershipOf ? call(() => v.membershipOf(key, s.id), null) : null;
      const ins = arr(m && m.participatesIn).map((x) => x.tag).filter(Boolean);
      where = [s.typeName, ins.length ? `In ${ins.join(', ')}` : 'Outside any unit process'].filter(Boolean).join(' · ');
    }
    return `<div class="l7-gh"><h3><a href="${esc(s.href || '#')}"><span class="mono">${esc(s.tag || '')}</span>${s.name ? ` · ${esc(s.name)}` : ''}</a></h3>${where ? `<span class="muted">${esc(where)}</span>` : ''}</div>`;
  }
  function tasksBody(key, q) {
    const b = base(key); const R = taskSections(key, q); const p = R.plant || {};
    if (!R.all) {
      const v = V(); const pass = v && v.bindingsPass ? call(() => v.bindingsPass(key), null) : null;
      return empty('No Tasks yet. Every Task comes from a Trigger accepted in the bindings pass, and sits on its own unit process, piece of equipment or the plant.',
        pass && pass.open ? btn('Open the bindings pass', { href: `${b}/review/bindings`, kind: 'primary' }) : btn('Open the structure pass', { href: `${b}/review/structure`, kind: 'primary' }));
    }
    const n = rate(R.perDay);
    const one = n === '1';
    const head = R.live ? `${n} ${one ? 'Task' : 'Tasks'} a day` : `${n} ${one ? 'Task' : 'Tasks'} a day once the plant goes live, each on its own unit process, piece of equipment or the plant`;
    const parts = [`<p class="lead l7-lead"><b>${esc(head)}.</b>${R.live ? '' : ` Next due shows when each Task would first fall due if ${esc(p.name || 'the plant')} went live now: from the last service date entered for its equipment, otherwise go-live day.`}</p>`];
    if (R.live && (R.dueNow || R.show === 'due')) parts.push(`<div class="l7-tools">${filters([{ label: 'All', href: `${b}/tasks`, on: R.show === 'all', count: R.all }, { label: 'Due now', href: `${b}/tasks?show=due`, on: R.show === 'due', count: R.dueNow }])}</div>`);
    R.sections.forEach((s) => {
      const count = s.groups.reduce((k, g) => k + g.rows.length, 0);
      const body = s.groups.map((g) => `<section class="l7-group">${groupHead(key, g, R.ord)}${taskTable(key, g.rows, R.live)}</section>`).join('');
      parts.push(card({ title: s.title, sub: pl(count, 'Task'), body, cls: `l7-card l7-tasks-${s.id}` }));
    });
    if (!R.sections.length) parts.push(empty('Nothing is due now.', btn('All Tasks', { href: `${b}/tasks` })));
    return parts.join('');
  }
  function tasksPage(params) { return guard(params, (key, q) => frame(key, 'tasks', `<div class="l7">${part('The Tasks', () => tasksBody(key, q))}</div>`, {})); }

  /* ── Plant details ────────────────────────────────────────────────────────────────────────────────────── */
  function designParamsFallback(key, q) {
    const v = V(); const rows = arr(v && v.designParams ? call(() => v.designParams(key, { kind: 'plant' }), []) : []);
    const target = q && q.f ? String(q.f) : '';
    if (!rows.length) return empty('No design parameters are asked for the plant.');
    return table({
      cols: [
        { label: 'Parameter', render: (r) => H(esc(r.label)) },
        { label: 'Value', render: (r) => H(r.value != null ? `<span class="mono">${esc(r.valueText)}</span>` : muted('—')) },
        { label: 'Source', render: (r) => H(srcChip(r.chip)) },
        { label: 'Used by', render: (r) => H(esc(r.usedByText || '—')) },
        { label: '', render: (r) => H(r.editable === false ? '' : btn(r.action || 'Edit', { act: 'dp:edit', data: { plant: key, kind: 'plant', id: key, param: r.key, field: r.field }, small: true, kind: 'ghost' })) },
      ],
      rows: rows.map((r) => Object.assign({ _cls: target && (target === r.field || target === `dp.${r.key}`) ? 'is-target' : '' }, r)),
    });
  }
  function detailsBody(key, q) {
    const v = V(); const p = plantOf(key) || {}; const b = base(key); const live = isLive(p);
    const pt = arr(v && v.plantTypes ? call(() => v.plantTypes(), []) : []).find((t) => t && (t.id === p.type || t.name === p.type)) || null;
    const typeHtml = `<span class="mono">${esc(p.type || '—')}</span>${pt ? ' ' + chip(`${pt.chipText || `Plant type · v${pt.version}`} ↗`, { tone: 'lib', href: `#/library/plant-types/${enc(pt.id)}` }) : ''}`;
    const stateHtml = live ? esc(`Live since ${fmtDay(p.since)}`) : esc(`Commissioning since ${fmt(p.commissioningSince != null ? p.commissioningSince : p.since)}`);
    const structure = [isNum(p.upCount) ? pl(p.upCount, 'unit process', 'unit processes') : '', isNum(p.equipmentCount) ? pl(p.equipmentCount, 'piece of equipment', 'pieces of equipment') : '', isNum(p.cgCount) ? pl(p.cgCount, 'control group') : ''].filter(Boolean).join(' · ');
    const kv = U.kv([
      ['Plant type', H(typeHtml)],
      ['State', H(stateHtml)],
      p.capacity ? ['Capacity', H(esc(p.capacity))] : null,
      ['Plant graph', H(p.sample === false ? chip('Real plant graph', { tone: 'info' }) : chip('Sample plant', { tone: 'muted' }))],
      ['Readings', H(chip('Sample readings', { tone: 'sample', title: 'Readings here are generated samples, not from the plant' }))],
      structure ? ['Structure', H(`${esc(structure)} · <a href="${esc(b)}/structure">Structure</a>`)] : null,
    ].filter(Boolean));
    const O = W.V7OBJ;
    let dp = '';
    if (O && typeof O.designParamsBlock === 'function') {
      const h = call(() => O.designParamsBlock(key, { kind: 'plant', id: key }, { target: q && q.f ? String(q.f) : null }), null);
      if (typeof h === 'string' && h) dp = h;
    }
    const dpCard = dp ? `<div class="l7-dp">${dp}</div>` : card({ title: 'Design parameters', body: designParamsFallback(key, q), cls: 'l7-card l7-dp' });
    return card({ title: 'Plant details', body: kv, cls: 'l7-card' }) + dpCard;
  }
  function detailsPage(params) { return guard(params, (key, q) => frame(key, 'details', `<div class="l7">${part('The plant details', () => detailsBody(key, q))}</div>`, { crumbs: [{ label: 'Plant details' }] })); }

  /* ── wiring ───────────────────────────────────────────────────────────────────────────────────────────── */
  U.route('p/:plant/triggers', triggersPage);
  U.route('p/:plant/readings', readingsPage);
  U.route('p/:plant/tasks', tasksPage);
  U.route('p/:plant/details', detailsPage);
  /* a ?f= target on these pages is scrolled into view once the page is drawn */
  if (U.afterRender) U.afterRender((main) => { try { const el = main && main.querySelector ? main.querySelector('.l7 .is-target') : null; if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); } catch (e) { /* nothing to scroll */ } });
  if (typeof document !== 'undefined' && document && document.head && U.addCss) U.addCss('assets/lists7.css?v=1');

  W.V7LISTS = {
    pages: { triggers: triggersPage, readings: readingsPage, tasks: tasksPage, details: detailsPage },
    bodies: { triggers: triggersBody, readings: readingsBody, tasks: tasksBody, details: detailsBody },
    triggerRows, taskSections, readingsInfo,
    _soft: SOFT,
  };
}());
