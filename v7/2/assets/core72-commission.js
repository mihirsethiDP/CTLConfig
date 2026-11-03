/* core72-commission.js — commissioning in v7/2 (CloseTheLoop configuration, Alex's model as drafted): Trigger status actions,
   the bindings pass, the one checklist behind Readiness, the go-live confirmation and Coverage, trial firings as stored records,
   people and routing edited in the console, last service dates and first due dates, go live, return to Commissioning, Coverage.
   Loads after core7.js, core72-structure.js, core72-library.js and core72-ledger.js (each optional: a missing file's part falls
   back to core7's own data, and the matching step says it is not available yet). Never touches the DOM; runs headless in node.
   Every sentence below is built from the plant's data; nothing here types a story number.

   ─── API (window.V7) ────────────────────────────────────────────────────────────────────────────────────────────────────
   Status:   setAlertState(key, id, state, {reason, note}) · activate(key, alertIdOrPid) · leaveInactive(key, alertIdOrPid, {reason})
             · activatePreview(key, alertIdOrPid | {pids}) → {title, lines, bandsTitle, bandLines, live, buttons}
   Trial:    trialFirings(key, alertId, {from, to}) oldest first · isNoisy(key, alertId) · trialStats(key, alertId) → null | {since, to, days, count, perDay,
             firings, medianMin, peak, emergencies, noisy, sample, history, text, daysText, perDayText, peakText, noisyChip, rows}
             · trialTable(key) → every Issue Trigger's trial rate, noisiest first
   Bindings: bindingsPass(key, {show}) → {open, proposedAt, live, counts, groups, needs, majorDrafts, rows, bulk, …} ·
             decide(key, pid, 'accept'|'reject', {activate, reason}) · acceptAllFor(key, sel, {activate}) · undoDecision(key, batchId)
             · allBoundPreview(key) → what every binding accepted would bring (a pure preview)
   Checklist: checklist(key) → {state, tracks:{structure, bindings, people}, trial, blockers, gaps, canGoLive, buttonLabel, foot, whyNot,
             …} (one generator for Readiness, the go-live confirmation and Coverage)
   Go live:  goLivePreview(key) · goLive(key) · goLiveTasks(key, at) · firstDueAt(key, schedule, state, goLiveAt) (the 'firstDue'
             hook) · returnPreview(key) · returnToCommissioning(key, reason) · cadenceDueNow(templateId, every, countFrom) ·
             dueAfter(key, sc, oldSc, st, at, opts) (the 'dueAfterChange' hook)
   People:   people(key) · reachability(key) · addPerson · updatePerson · removePreview · removePerson · sendCode · confirmCode
             (the prototype's stand-in for the person typing the code) · routing(key) · setRouting(key, {hooter}) ·
             serviceDates(key) · setServiceDate(key, eqId, 'YYYY-MM-DD' | null)
   Coverage: coverage(key) → {state, since, window, triggers, deviations, blindSpots, gaps, perTrigger, sample}
   Every action returns {ok, error?} plus a toast sentence, writes one Activity line and saves. */
(function () {
  'use strict';
  const V = window.V7;
  if (!V || !V.__) return;
  const _ = V.__;
  const C = _.C;
  const { DAY, HOUR, MIN, BANDS, BAND_LABEL, ME, ORDER, LABELS } = _;
  const S = () => _.S;
  const PS = (key) => _.PS(key);
  const dOf = (key) => _.dOf(key);
  const now = () => _.now();
  const T = _.T;
  const cached = (k, fn) => _.cached(`kb:${k}`, fn);
  const plural = (n, w, ws) => _.plural(n, w, ws);
  const fmt = _.fmt, fmtDay = _.fmtDay, fmtDate = _.fmtDate, fmtTime = _.fmtTime;
  const plantName = (key) => _.plantName(key);
  const fnOf = (n) => (typeof V[n] === 'function' ? V[n] : null);
  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const arr = (x) => (Array.isArray(x) ? x : []);
  const joinAnd = (xs) => _.joinAnd(xs);
  const r1 = (x) => Math.round(x * 10) / 10;
  const one = (x) => r1(x).toFixed(1);
  /* "13" for a whole rate, "12.8" otherwise */
  const rateText = (x) => { const v = r1(x); return Number.isInteger(v) ? String(v) : v.toFixed(1); };
  const isoToday = () => _.isoDay(now());
  const dayStart = (iso) => T(`${iso}T00:00`);
  const save = () => { _.touch(); _.persist(); };
  const act = (at, key, text, kind, who) => _.addActivity({ at, plant: key, who, text, kind });

  /* ── words ──────────────────────────────────────────────────────────────────────────────────── */
  const ROLE = { l1: 'Operator', l3: 'Lead', l4: 'Senior Lead', regular: 'Client viewer' };
  const ROLE_PLURAL = { l1: 'Operators', l3: 'Leads', l4: 'Senior Leads', regular: 'Client viewers' };
  const GRANT = { people: 'People Admin', tech: 'Technical Admin', full: 'Full Admin', global: 'Global Admin' };
  const CHANNEL = { wa: 'WhatsApp', sms: 'SMS' };
  const STATUS = { undecided: 'Undecided', cantResolve: "Can't resolve", draft: 'Draft · never fires', active: 'Active', inactive: 'Inactive', rejected: 'Rejected', needs: 'Needs equipment or sensors' };
  LABELS.role = { ...ROLE }; LABELS.grant = { ...GRANT }; LABELS.channel = { ...CHANNEL }; LABELS.bindingStatus = { ...STATUS };
  LABELS.gap = { nolimits: 'Readings without limits', noisy: 'Noisy Triggers', nopm: 'No maintenance programme', nodiag: 'No diagnostic flow' };
  const BLIND_SPOTS = 'Arrives with Diagnostics: what must be known per unit process, how often, and what isn\'t covered.';
  const NOISY_CHIP = 'Noisy · more than 10 a day';
  const WAIT_TEXT = 'The bindings pass opens when the structure pass is confirmed. The library then proposes Triggers for each unit process and piece of equipment.';
  const COMM_BANNER = 'Commissioning: nothing is sent. Firings below are trials only.';
  const CLOCK_HOURS = (b) => (C.SEV_CLOCK || {})[b] || [null, null];

  /* numbers in v7/2's copy carry a thousands comma ("2,000 mg/L") */
  const commas = (s) => String(s).replace(/(^|[^\d.])(\d{4,})(?=(\.\d+)?(\D|$))/g, (m, pre, n) => pre + n.replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  const valText = (v, unit, kind) => commas(_.fmtVal(v, unit, kind));
  const cmpOf = (dir, kind) => (kind === 'status' ? 'when' : dir === 'below' ? '<' : '>');

  /* ── names ──────────────────────────────────────────────────────────────────────────────────── */
  /* a Trigger's name, "{template} · {subject tag}": the library file's helper once loaded, else the data name read with " · " */
  function tName(key, id) {
    const f = fnOf('triggerName'); if (f) { const r = safe(() => f(key, id), null); if (typeof r === 'string' && r) return r; }
    const a = _.alertRaw(key, id); return a ? String(a.name).replace(/ — /g, ' · ') : String(id);
  }
  const tagOf = (key, id) => { const e = id && id !== 'plant' ? _.eqRaw(key, id) : null; return e ? e.tag : id === 'plant' ? plantName(key) : String(id || ''); };
  const taskName = (key, sc) => (sc ? `${sc.name} · ${sc.subject && sc.subject.kind === 'eq' ? tagOf(key, sc.subject.id) : plantName(key)}` : 'the Task');
  const subjectOf = (key, eqId) => { const f = fnOf('subjectOf'); const s = f && eqId && eqId !== 'plant' ? safe(() => f(key, eqId), null) : null; if (s) return s; if (eqId === 'plant' || !eqId) return { kind: 'plant', id: null, tag: plantName(key), text: plantName(key) }; const e = _.eqRaw(key, eqId); return e ? { kind: 'eq', id: e.id, tag: e.tag, text: e.tag, typeName: e.type } : null; };
  const SUBJECT_KIND = { up: 'unitProcess', eq: 'equipment', plant: 'plant' };

  /* ── plant state helpers ────────────────────────────────────────────────────────────────────── */
  const isLive = (key) => !!PS(key) && PS(key).state === 'live';
  const issueTriggers = (key) => (dOf(key) ? dOf(key).alerts : []);
  const activeIssueTriggers = (key) => issueTriggers(key).filter((a) => _.alertState(key, a.id) === 'active');
  const nextPhase = (key, a) => { const s = a ? _.sensorRaw(key, a.sensor) : null; return !!(s && s.nextPhase); };
  const routingOf = (key) => { const P = PS(key); if (P && !P.routing) P.routing = { hooter: true }; return P ? P.routing : { hooter: true }; };
  const hooterOn = (key) => routingOf(key).hooter !== false;

  /* can a Trigger's limits resolve? (every band a Gap → it can't, and it raises nothing) */
  function limitsResolve(key, alertId) {
    const a = _.alertRaw(key, alertId); if (!a) return { ok: false, why: 'no such Trigger' };
    const terms = safe(() => _.termsFor(key, alertId), null); const any = terms && BANDS.some((b) => terms.bands[b] != null);
    if (any) return { ok: true, why: null };
    const zi = fnOf('zoneInfo'); const z = zi && terms ? safe(() => zi(key, a.sensor, terms.dir), null) : null;
    const needs = z && z.perBand ? BANDS.map((b) => z.perBand[b] && z.perBand[b].needs).find(Boolean) : null;
    const why = needs ? `needs ${typeof needs === 'object' ? `${needs.label || needs.param || 'a design parameter'}${needs.tag ? ` (${needs.tag})` : ''}` : needs}` : 'it has no limit rule';
    return { ok: false, why };
  }

  /* ════════════════════ trial firings: stored records ════════════════════ */
  const trialFirings = (key, alertId, opts) => { const o = opts || {}; return _.trialRecs(key, alertId, o.from != null ? o.from : null, o.to != null ? o.to : null).map((r) => ({ ...r, steps: r.steps.slice() })); };
  /* the trial window: the running Commissioning period, or the one that ended at the latest go-live (history on a Live plant) */
  function trialWindowOf(key, alertId) {
    const P = PS(key); const st = P && P.alerts[alertId]; if (!P || !st || st.activeSince == null) return null;
    if (P.state === 'commissioning') { const w = _.trialWindow(key, alertId); return w ? { ...w, history: false } : null; }
    const g = arr(P.goLives).slice().reverse().find((x) => x && x.commissioningSince != null); if (!g) return null;
    if (st.activeSince >= g.at) return null;
    return { since: Math.max(st.activeSince, g.commissioningSince), to: g.at, history: true };
  }
  function trialStats(key, alertId) {
    const w = trialWindowOf(key, alertId); if (!w) return null;
    return cached(`trial:${key}:${alertId}`, () => {
      const a = _.alertRaw(key, alertId); const s = a ? _.sensorRaw(key, a.sensor) || {} : {}; const dir = a ? _.alertDir(key, a) : 'above';
      const firings = _.trialRecs(key, alertId, w.since, w.to).map((r) => ({ ...r, steps: r.steps.slice(), minutes: r.end != null ? Math.round((r.end - r.start) / MIN) : null }));
      const days = Math.max(0, (w.to - w.since) / DAY); const ended = firings.filter((f) => f.end != null);
      const md = _.median(ended.map((f) => f.minutes)); const peak = firings.reduce((p, f) => _.furthest(dir, p, f.peak), null);
      const perDay = firings.length / Math.max(days, 1); const noisy = perDay > 10;
      const daysText = one(days); const peakText = peak == null ? '—' : valText(peak, s.unit, s.kind);
      const head = firings.length === 0 ? `No trial firings in ${daysText} days` : `Fired ${firings.length === 1 ? 'once' : `${firings.length} times`} in ${daysText} days`;
      const text = firings.length ? `${head} · median ${md == null ? '—' : Math.round(md)} min · peak ${peakText}` : head;
      const rows = firings.map((f) => ({ id: f.id, start: f.start, end: f.end, startText: fmt(f.start), endText: f.end == null ? 'still past the limit' : fmt(f.end), band: f.band, bandLabel: BAND_LABEL[f.band] || f.band, peak: f.peak, peakText: valText(f.peak, s.unit, s.kind), minutes: f.minutes, lengthText: f.minutes == null ? 'still past the limit' : `${f.minutes} min`, running: f.end == null, chip: f.band === 'emergency' ? 'Emergency · nobody was told' : null }));
      return { since: w.since, to: w.to, days, count: firings.length, perDay, firings, medianMin: md == null ? null : Math.round(md), peak, emergencies: firings.filter((f) => f.band === 'emergency').length, noisy, sample: true, history: !!w.history, title: w.history ? 'Trial before go-live' : 'Trial', text, daysText, perDayText: one(perDay), peakText, noisyChip: noisy ? NOISY_CHIP : null, rows, banner: w.history ? null : COMM_BANNER };
    });
  }
  /* every Issue Trigger's trial rate at a Commissioning plant, noisiest first (the Triggers list sorted by trial firings a day) */
  function trialTable(key) {
    return issueTriggers(key).filter((a) => _.alertState(key, a.id) === 'active').map((a) => { const ts = trialStats(key, a.id); return { alertId: a.id, name: tName(key, a.id), count: ts ? ts.count : 0, perDay: ts ? ts.perDay : 0, perDayText: one(ts ? ts.perDay : 0), noisy: !!(ts && ts.noisy), chip: ts && ts.noisy ? NOISY_CHIP : null, trial: !!ts }; })
      .sort((x, y) => y.perDay - x.perDay || (x.name < y.name ? -1 : 1));
  }
  /* noisy on a Live plant: more than 10 Issues a day over the last 7 days, never before the latest go-live */
  function liveRate(key, alertId) {
    const P = PS(key); const from = Math.max(P.goLiveAt != null ? P.goLiveAt : P.since, now() - 7 * DAY); const days = Math.max(1, (now() - from) / DAY);
    const n = P.issues.filter((i) => i.alertId === alertId && i.opened >= from && i.opened <= now()).length; return { n, perDay: n / days, days };
  }
  /* noisy: in Commissioning more than 10 trial firings a day over the Trigger's own trial days; on a Live plant more than 10 Issues a day */
  function isNoisy(key, alertId) {
    const P = PS(key); if (!P || _.alertState(key, alertId) !== 'active') return false;
    if (P.state === 'commissioning') { const ts = trialStats(key, alertId); return !!(ts && ts.noisy); }
    return liveRate(key, alertId).perDay > 10;
  }

  /* ════════════════════ the bindings pass ════════════════════ */
  const passOpen = (key) => { const f = fnOf('structureDone'); return f ? !!safe(() => f(key), false) : true; };
  const kcRows = (key) => cached(`kc:${key}`, () => { const f = fnOf('bindingProposals'); const list = f ? safe(() => f(key), null) : null; const m = new Map(); arr(list).forEach((r) => { if (r && r.pid) m.set(r.pid, r); }); return m; });
  const kcChipText = (c) => (c && typeof c === 'object' ? c.text || null : typeof c === 'string' ? c : null);
  const SRC_WORD = { lib: 'Library', form: 'Derived', changed: 'Override', libchanged: 'Base moved', none: 'Gap', next: 'Next phase' };
  /* the values a row shows, from the library file when it is loaded, else from core7's limits and timing */
  function rowValues(key, p, kc) {
    if (kc && Array.isArray(kc.values)) {
      const out = kc.values.map((v) => ({ band: v.band || null, text: commas(v.text || ''), source: kcChipText(v.chip) || v.source || null, chip: v.chip || null }));
      if (kc.timing && kc.timing.hold != null) out.push({ band: null, text: `Persistence ${kc.timing.hold} min`, source: kcChipText(kc.timing.chip) || 'Library', chip: kc.timing.chip || null });
      if (kc.cadence) { const ct = typeof kc.cadence === 'string' ? kc.cadence : kc.cadence.text || _.everyText(kc.cadence); out.push({ band: null, text: ct, source: kcChipText(kc.cadence.chip) || 'Library', chip: kc.cadence.chip || null }); }
      if (out.length) return out;
    }
    if (p.kind === 'alert') {
      const out = []; const bi = p.limits; const s = p.sensorId ? _.sensorRaw(key, p.sensorId) : null;
      if (bi && s) BANDS.forEach((b) => { const pb = bi.perBand[b]; if (pb && pb.value != null) out.push({ band: b, text: `${BAND_LABEL[b]} ${cmpOf(p.dir, s.kind)} ${valText(pb.value, s.unit, s.kind)}`, source: SRC_WORD[pb.chip] || 'Library', chip: null }); });
      const e = _.eqRaw(key, p.eqId); const hold = e && p.reading ? _.libTiming(_.libKey(e), p.reading, p.dir, 'hold') : null;
      if (hold != null) out.push({ band: null, text: `Persistence ${hold} min`, source: 'Library', chip: null });
      return out;
    }
    return [{ band: null, text: _.cap(p.everyText || (p.every ? _.everyText(p.every) : p.detail || '')), source: 'Library', chip: null }];
  }
  /* the status of one proposal: needs · rejected · active · inactive · draft (accepted, never fires) · cantResolve · undecided */
  function statusOf(key, p, it, gap) {
    if (p.blockedBy) return 'needs';
    const P = PS(key); const dec = P.decisions[p.pid] || null;
    if (it && it.type === 'alert') {
      const rec = P.alerts[it.obj.id] || {}; const st = _.alertState(key, it.obj.id); const decided = rec.decided || (dec && dec.decided) || null;
      if (decided === 'rejected') return 'rejected';
      if (st === 'active') return 'active';
      if (st === 'inactive') return 'inactive';
      if (decided === 'accepted') return 'draft';
    } else if (it) {
      const s = it.obj.status; const decided = dec ? dec.decided : s === 'draft' ? null : s === 'off' ? 'rejected' : 'accepted';
      if (decided === 'rejected') return 'rejected';
      if (s === 'active') return 'active';
      if (s === 'off') return 'inactive';
      if (decided === 'accepted') return 'draft';
    } else if (dec && dec.decided === 'rejected') return 'rejected';
    return gap ? 'cantResolve' : 'undecided';
  }
  function needsReading(p) { if (p.reading) return p.reading; const m = /^No (.+?) sensor on /.exec(String(p.blockedBy || '')); return m ? m[1] : 'such a'; }
  const ACTIONS = { undecided: ['accept', 'change', 'reject'], cantResolve: ['acceptDraft'], draft: ['activate', 'leaveInactive'], active: [], inactive: [], rejected: [], needs: [] };
  function buildRow(key, p) {
    const live = isLive(key); const kc = kcRows(key).get(p.pid) || null; const gapLib = !!(kc && kc.resolve === 'gap');
    const kind = p.kind === 'alert' ? 'alert' : p.kind === 'condition' ? 'condition' : 'task';
    const it = p.blockedBy ? null : safe(() => _.findItem(key, p.eqId, kind, p.name), null);
    const alertId = it && it.type === 'alert' ? it.obj.id : null; const scheduleId = it && it.type === 'schedule' ? it.obj.id : null; const workId = it && it.type === 'work' ? it.obj.id : null;
    /* a Trigger binding whose every band is a Gap can't resolve (the library file says; without it, a proposal with no limits) */
    const gapCore = !kc && kind === 'alert' && !p.blockedBy && !!p.limits && !BANDS.some((b) => p.limits.bands && p.limits.bands[b] != null);
    const gap = gapLib || gapCore;
    const status = statusOf(key, p, it, gap);
    const subj = subjectOf(key, p.eqId) || { kind: 'plant', tag: plantName(key) };
    const outcome = kind === 'alert' ? 'issue' : 'task';
    const name = kind === 'alert' ? (alertId ? tName(key, alertId) : `${p.name} · ${p.tag}`) : p.name;
    const reads = p.sensorId ? { sensorId: p.sensorId, tag: (_.sensorRaw(key, p.sensorId) || {}).tag || null } : null;
    const needs = kc && kc.needs ? kc.needs : null;
    const cantResolve = gapCore ? { text: 'it has no limit rule', param: null, on: null, link: null } : gapLib ? { text: needs ? `needs ${typeof needs === 'object' ? `${needs.label || needs.param}${needs.tag ? ` (${needs.tag})` : ''}` : needs}` : 'no limit rule resolves here', param: needs && typeof needs === 'object' ? needs.param || null : null, on: needs && typeof needs === 'object' ? needs.tag || null : null, link: needs && typeof needs === 'object' ? needs.link || null : null } : null;
    const phaseChip = status === 'active' ? (outcome === 'issue' ? LABELS.triggerChip[live ? 'live' : 'trial'] : 'Active') : STATUS[status];
    return {
      pid: p.pid, kind, outcome, template: p.name, name, eqId: p.eqId, tag: p.tag, typeName: p.typeName, alertId, scheduleId, workId,
      subject: subj, subjectKind: SUBJECT_KIND[subj.kind] || 'equipment', subjectId: subj.id || null, subjectTag: subj.tag || p.tag,
      line: `${p.name} · ${outcome === 'issue' ? 'Issue' : 'Task'} → ${p.tag}`, reads, readsText: reads && reads.tag ? `reads ${reads.tag}` : null,
      values: p.blockedBy ? [] : rowValues(key, p, kc), status, statusLabel: phaseChip, decided: status === 'undecided' || status === 'cantResolve' || status === 'needs' ? null : status === 'rejected' ? 'rejected' : 'accepted',
      reason: (PS(key).decisions[p.pid] || {}).reason || (alertId ? (PS(key).alerts[alertId] || {}).reason : null) || null,
      cantResolve, blockedBy: p.blockedBy || null, nextPhase: !!p.nextPhase, needsReading: p.blockedBy && !p.nextPhase ? needsReading(p) : null,
      workType: p.workType || null, every: p.every || null, templateId: kc ? kc.templateId || null : null, version: kc ? kc.v || null : null,
      href: alertId ? `#/p/${key}/trigger/${alertId}` : null, actions: ACTIONS[status] || [], why: kc && kc.why ? kc.why : null,
    };
  }
  function passRows(key) {
    return cached(`rows:${key}`, () => {
      const rows = []; arr(safe(() => _.libraryReview(key), [])).forEach((r) => arr(r.proposals).forEach((p) => rows.push(buildRow(key, p))));
      return rows;
    });
  }
  const rowByPid = (key, pid) => passRows(key).find((r) => r.pid === pid) || null;
  const rowByAlert = (key, alertId) => passRows(key).find((r) => r.alertId === alertId) || null;
  function countRows(rows) {
    const c = { all: rows.length, undecided: 0, drafts: 0, active: 0, inactive: 0, rejected: 0, cantResolve: 0, needs: 0 };
    rows.forEach((r) => { const k = r.status === 'draft' ? 'drafts' : r.status; c[k] = (c[k] || 0) + 1; });
    c.accepted = rows.filter((r) => r.decided === 'accepted').length; c.waiting = c.undecided + c.cantResolve + c.drafts;
    c.issueActive = rows.filter((r) => r.status === 'active' && r.outcome === 'issue').length; c.taskActive = rows.filter((r) => r.status === 'active' && r.outcome === 'task').length;
    return c;
  }
  const SHOW = { all: () => true, undecided: (r) => r.status === 'undecided', cantresolve: (r) => r.status === 'cantResolve', draft: (r) => r.status === 'draft', drafts: (r) => r.status === 'draft', needs: (r) => r.status === 'needs', waiting: (r) => ['undecided', 'cantResolve', 'draft'].includes(r.status) };
  function bindingsPass(key, opts) {
    const P = PS(key); const d = dOf(key); if (!P || !d) return null;
    const show = (opts && (opts.show || opts.filter)) || 'all'; const keep = SHOW[show] || SHOW.all;
    const open = passOpen(key); const live = P.state === 'live';
    const st = S().structure && S().structure[key]; const proposedAt = open ? (st && st.confirmedAt != null ? st.confirmedAt : P.since) : null;
    if (!open) return { plant: key, open: false, waiting: true, waitingText: WAIT_TEXT, proposedAt: null, live, show, counts: countRows([]), groups: [], needs: [], majorDrafts: [], rows: [], bulk: bulkOf(key, [], live) };
    const all = passRows(key); const counts = countRows(all); const rows = all.filter(keep);
    /* groups follow the structure: each unit process's own node, then its participants, in flow order; the plant's rounds; then
       everything outside any unit process */
    const gs = arr(fnOf('bindingGroups') ? safe(() => V.bindingGroups(key), []) : []);
    const byEq = new Map(); gs.forEach((g, i) => arr(g.eqIds).forEach((id) => { if (!byEq.has(id)) byEq.set(id, i); }));
    const groupsRaw = gs.map((g, i) => ({ id: g.upId || 'outside', label: g.title, upId: g.upId || null, order: i, items: [] }));
    const plantG = { id: 'plant', label: 'The plant', upId: null, order: -1, items: [] };
    let outside = groupsRaw.find((g) => g.id === 'outside'); if (!outside) { outside = { id: 'outside', label: 'Outside any unit process', upId: null, order: groupsRaw.length, items: [] }; groupsRaw.push(outside); }
    rows.filter((r) => r.status !== 'needs').forEach((r) => { if (r.eqId === 'plant') plantG.items.push(r); else { const i = byEq.get(r.eqId); (i != null ? groupsRaw[i] : outside).items.push(r); } });
    const ordered = groupsRaw.filter((g) => g.id !== 'outside').concat([plantG, outside]).filter((g) => g.items.length).map((g, i) => ({ ...g, order: i, count: g.items.length, acceptCount: g.items.filter((r) => r.status === 'undecided').length, head: `${g.label} · ${plural(g.items.length, 'template')}` }));
    /* Needs equipment or sensors: one line per piece of equipment and reading */
    const needMap = new Map(); rows.filter((r) => r.status === 'needs').forEach((r) => { const k2 = `${r.eqId}|${r.nextPhase ? 'next:' + r.template : r.needsReading}`; if (!needMap.has(k2)) needMap.set(k2, { eqId: r.eqId, tag: r.tag, reading: r.nextPhase ? null : r.needsReading, nextPhase: r.nextPhase, unlocks: [], pids: [] }); const n = needMap.get(k2); n.unlocks.push(r.template); n.pids.push(r.pid); });
    const needs = [...needMap.values()].map((n) => ({ ...n, text: n.nextPhase ? `${n.tag}: ${n.unlocks[0]} reads a connection: not in this phase` : `${n.tag} has no ${n.reading} sensor: unlocks ${plural(n.unlocks.length, 'template')} (${n.unlocks.join(', ')}) · Add sensor in the survey` }));
    const md = fnOf('majorDrafts'); const majorDrafts = md ? arr(safe(() => md(key), [])) : [];
    return { plant: key, open: true, waiting: false, waitingText: null, proposedAt, proposedText: `${counts.all} proposed ${proposedAt != null ? fmtDay(proposedAt) : ''}`.trim(), live, show, counts, groups: ordered, needs, majorDrafts, rows, bulk: bulkOf(key, rows, live, counts) };
  }
  function bulkOf(key, rows, live, counts) {
    const n = rows.filter((r) => r.status === 'undecided').length; const cr = counts ? counts.cantResolve : 0;
    return { count: n, draftsLabel: `Accept ${n} as drafts`, activateLabel: live ? `Accept ${n} and activate` : `Accept ${n} and start trial`, disabled: n === 0, disabledTitle: n === 0 ? 'Nothing left to accept here.' : null, note: cr ? `The counts leave out the ${cr} that can't resolve.` : null };
  }

  /* ── deciding ───────────────────────────────────────────────────────────────────────────────── */
  function batchStart(key) { const b = { id: _.counterId('bseq', 'b'), plant: key, at: now(), ops: [] }; return b; }
  function snapItem(key, it, pid) {
    const P = PS(key); const op = { pid, dec: P.decisions[pid] ? { ...P.decisions[pid] } : null, alertId: null, alert: null, itemType: it ? it.type : null, itemId: it ? it.obj.id : null, status: it && it.type !== 'alert' ? it.obj.status : null };
    if (it && it.type === 'alert') { op.alertId = it.obj.id; op.alert = P.alerts[it.obj.id] ? { ...P.alerts[it.obj.id] } : null; op.status = it.obj.status; }
    if (it && it.type === 'schedule') op.task = P.tasks[it.obj.id] ? { ...P.tasks[it.obj.id] } : null;
    return op;
  }
  function batchEnd(b) { if (!b.ops.length) return null; const s = S(); s.bindingBatches = arr(s.bindingBatches).concat([b]).slice(-20); return b.id; }
  /* accept one proposal (materialising its equipment's library items, as v7/1 does), optionally activating it */
  function applyAccept(key, row, activate, t, batch) {
    const P = PS(key); _.materialize(key, row.eqId, t); const it = _.findItem(key, row.eqId, row.kind, row.template);
    if (!it) return { ok: false, error: 'The library item could not be found on this equipment.' };
    if (batch) batch.ops.push(snapItem(key, it, row.pid));
    if (it.type === 'alert') {
      const id = it.obj.id;
      if (activate) { const chk = canActivate(key, id); if (!chk.ok) return chk; if (_.alertState(key, id) !== 'active') _.putAlertState(key, id, 'active', t); }
      else if (P.alerts[id]) P.alerts[id].since = t;
      P.alerts[id].decided = 'accepted';
    } else {
      if (activate) { it.obj.status = 'active'; if (it.type === 'schedule' && P.state === 'live') startLiveTask(key, it.obj, t); }
    }
    P.decisions[row.pid] = { decided: 'accepted', at: t, reason: null };
    _.touch();
    return { ok: true, type: it.type, id: it.obj.id, activated: !!activate };
  }
  /* a Task activated on a Live plant: due on the day it starts, as at go-live (or from its last completion) */
  function startLiveTask(key, sc, t) {
    const P = PS(key); _.touch(); const tid = _.taskIdOfSchedule(key, sc.id) || sc.id; const prev = P.tasks[tid] || {};
    const r = firstDueAt(key, sc, prev, t); P.tasks[tid] = { due: r.due, lastDone: prev.lastDone != null ? prev.lastDone : null, status: r.due <= now() ? 'due' : 'upcoming', done: [], history: prev.history || [], startedAt: null, firstDue: r.why };
  }
  function canActivate(key, alertId) {
    const a = _.alertRaw(key, alertId); if (!a) return { ok: false, error: 'No such Trigger.' };
    if (nextPhase(key, a)) return { ok: false, error: `${tName(key, alertId)} reads a connection: it can't be activated.` };
    const lr = limitsResolve(key, alertId); if (!lr.ok) return { ok: false, error: `${tName(key, alertId)} can't resolve its limits yet: ${lr.why}.` };
    return { ok: true };
  }
  const activeLine = (key, name) => (isLive(key) ? `${name} is active at ${plantName(key)}. It creates Issues from now on.` : `${name} is active: it records trial firings. Nothing is sent until go-live.`);
  function decide(key, pid, verdict, opts) {
    const o = opts || {}; const P = PS(key); if (!P || !dOf(key)) return { ok: false, error: 'No such plant.' };
    if (!passOpen(key)) return { ok: false, error: 'The bindings pass opens when the structure pass is confirmed.' };
    const row = rowByPid(key, pid); if (!row) return { ok: false, error: 'No such proposal.' };
    if (row.status === 'needs') return { ok: false, error: row.blockedBy };
    if (verdict !== 'accept' && verdict !== 'reject') return { ok: false, error: 'Accept or reject.' };
    const t = o.at != null ? o.at : now(); const b = batchStart(key);
    if (verdict === 'reject') {
      const why = String(o.reason || o.note || '').trim(); if (!why) return { ok: false, error: 'Say why it doesn\'t fit this plant.', field: 'reason' };
      if (row.status !== 'undecided' && row.status !== 'cantResolve') return { ok: false, error: 'Only an undecided binding can be rejected; set it inactive instead.' };
      _.materialize(key, row.eqId, t); const it = _.findItem(key, row.eqId, row.kind, row.template); if (!it) return { ok: false, error: 'The library item could not be found on this equipment.' };
      b.ops.push(snapItem(key, it, pid));
      if (it.type === 'alert') { _.putAlertState(key, it.obj.id, 'inactive', t); Object.assign(P.alerts[it.obj.id], { decided: 'rejected', reason: why }); } else it.obj.status = 'off';
      P.decisions[pid] = { decided: 'rejected', at: t, reason: why };
      act(t, key, `Rejected ${row.name}: ${why}`, 'config'); const batchId = batchEnd(b); save();
      return { ok: true, pid, decided: 'rejected', status: 'rejected', batchId, toast: `Rejected ${row.name}. A re-run won't propose it again.` };
    }
    if (row.status !== 'undecided' && row.status !== 'cantResolve') return { ok: true, pid, decided: 'accepted', status: row.status, already: true };
    const activate = o.activate !== false;
    if (activate && row.status === 'cantResolve') return { ok: false, error: `${row.name} can't resolve its limits yet: ${row.cantResolve ? row.cantResolve.text : 'it has no limits'}.` };
    const r = applyAccept(key, row, activate, t, b); if (!r.ok) return r;
    const live = P.state === 'live'; const isIssue = row.outcome === 'issue';
    const text = !activate ? `Accepted ${row.name} as a draft: it never fires until it is activated` : isIssue ? (live ? `Accepted and activated ${row.name}: it creates Issues and notifies people from now on` : `Accepted ${row.name} and started its trial: it records trial firings; nothing is sent until go-live`) : `Accepted ${taskName(key, _.schedRaw(key, r.id) || _.dOf(key).conditionWork.find((w) => w.id === r.id))}${live ? ': it is scheduled from today' : ': it starts at go-live'}`;
    if (!o.quiet) act(t, key, text, 'config');
    const batchId = batchEnd(b); _.touch(); if (!o.noSave) _.persist();
    const status = activate ? 'active' : 'draft';
    const toast = !activate ? `Accepted ${row.name} as a draft. Drafts never fire.` : isIssue ? activeLine(key, row.name) : `Accepted ${row.name}.`;
    return { ok: true, pid, decided: 'accepted', status, alertId: r.type === 'alert' ? r.id : null, scheduleId: r.type === 'schedule' ? r.id : null, batchId, toast };
  }
  /* accept many: sel {groupId} | {eqId} | {status:'undecided'} | {pids} | {} (every undecided row); rows that can't resolve are skipped */
  function acceptAllFor(key, sel, opts) {
    const o = sel || {}; const op = opts || {}; const P = PS(key); if (!P || !dOf(key)) return { ok: false, error: 'No such plant.' };
    if (!passOpen(key)) return { ok: false, error: 'The bindings pass opens when the structure pass is confirmed.' };
    const bp = bindingsPass(key); let rows = bp.rows;
    if (o.groupId) { const g = bp.groups.find((x) => x.id === o.groupId || x.upId === o.groupId); rows = g ? g.items : []; }
    else if (o.eqId) rows = rows.filter((r) => r.eqId === o.eqId);
    else if (o.typeName) rows = rows.filter((r) => r.typeName === o.typeName);
    if (Array.isArray(o.pids)) rows = rows.filter((r) => o.pids.includes(r.pid));
    const skipped = rows.filter((r) => r.status === 'cantResolve').length; const todo = rows.filter((r) => r.status === 'undecided');
    const activate = op.activate !== false; const t = op.at != null ? op.at : now(); const b = batchStart(key);
    let n = 0, ni = 0, nt = 0; const errs = [];
    todo.forEach((r) => { const x = applyAccept(key, r, activate, t, b); if (x.ok) { n++; if (r.outcome === 'issue') ni++; else nt++; } else errs.push(`${r.name}: ${x.error}`); });
    const live = P.state === 'live';
    const where = o.groupId ? (bp.groups.find((x) => x.id === o.groupId || x.upId === o.groupId) || {}).label : o.eqId ? tagOf(key, o.eqId) : null;
    if (n && !op.quiet) {
      const parts = `(${ni} raise${ni === 1 ? 's' : ''} Issues, ${nt} create${nt === 1 ? 's' : ''} Tasks)`;
      const text = !activate ? `Bindings pass: accepted ${n}${where ? ` for ${where}` : ''} as drafts ${parts}. Drafts never fire.` : live ? `Bindings pass: accepted and activated ${n}${where ? ` for ${where}` : ''} ${parts}: they create Issues and notify people from now on.` : `Bindings pass: accepted ${n}${where ? ` for ${where}` : ''} and started the trial ${parts}. Commissioning: nothing is sent.`;
      act(t, key, text, 'config');
    }
    const batchId = batchEnd(b); _.touch(); if (!op.noSave) _.persist();
    const toast = !n ? (skipped ? `Nothing accepted: the ${skipped} left can't resolve.` : 'Nothing left to accept here.') : where && !o.status ? `Accepted ${n} for ${where}` : !activate ? `Accepted ${n} as drafts. Drafts never fire.` : live ? `Accepted and activated ${n}: ${plural(ni, 'Trigger')} create${ni === 1 ? 's' : ''} Issues from now on.` : `Accepted ${n} and started the trial: ${plural(ni, 'Trigger')} now record${ni === 1 ? 's' : ''} trial firings. Commissioning · nothing is sent.`;
    return { ok: true, count: n, skipped, activated: activate ? n : 0, alerts: ni, tasks: nt, batchId, toast, errors: errs };
  }
  /* undo one decision batch while the clock has not moved and no later batch touched the same rows */
  function undoDecision(key, batchId) {
    const s = S(); const list = arr(s.bindingBatches); const i = list.findIndex((x) => x.id === batchId && x.plant === key); if (i < 0) return { ok: false, error: 'Nothing to undo.' };
    const b = list[i]; if (b.undone) return { ok: false, error: 'This is already undone.' };
    if (now() !== b.at) return { ok: false, error: 'This can no longer be undone: time has moved on.' };
    const mine = new Set(b.ops.map((x) => x.pid)); if (list.slice(i + 1).some((x) => !x.undone && x.plant === key && x.ops.some((y) => mine.has(y.pid)))) return { ok: false, error: 'This can no longer be undone: a later decision touched the same rows.' };
    const P = PS(key); const d = dOf(key);
    b.ops.slice().reverse().forEach((x) => {
      if (x.dec) P.decisions[x.pid] = x.dec; else delete P.decisions[x.pid];
      if (x.itemType === 'alert') { const a = _.alertRaw(key, x.alertId); if (x.alert) P.alerts[x.alertId] = x.alert; if (a && x.status) a.status = x.status; P.eng[x.alertId] = _.newTracker(); _.endTrialRecord(key, x.alertId, now()); }
      else { const obj = x.itemType === 'schedule' ? _.schedRaw(key, x.itemId) : d.conditionWork.find((w) => w.id === x.itemId); if (obj && x.status) obj.status = x.status; if (x.itemType === 'schedule') { if (x.task) P.tasks[x.itemId] = x.task; else delete P.tasks[x.itemId]; } }
    });
    b.undone = true; act(now(), key, `Undone: ${plural(b.ops.length, 'binding decision')}`, 'config'); save();
    return { ok: true, toast: `Undone: ${plural(b.ops.length, 'binding decision')}` };
  }
  /* what every binding accepted would bring (a pure preview: worked out on the real data, then put back) */
  function allBoundPreview(key) {
    const P = PS(key); if (!P || !dOf(key)) return null;
    return _.dryRun(key, () => {
      const rows = arr(safe(() => _.libraryReview(key), [])); let n = 0;
      rows.forEach((r) => arr(r.proposals).forEach((p) => { if (p.blockedBy || p.decided) return; const ok = safe(() => { _.materialize(key, p.eqId, now()); const kind = p.kind === 'alert' ? 'alert' : p.kind === 'condition' ? 'condition' : 'task'; const it = _.findItem(key, p.eqId, kind, p.name); if (!it) return false; if (it.type === 'alert') _.putAlertState(key, it.obj.id, 'active'); else it.obj.status = 'active'; return true; }, false); if (ok) n++; }));
      _.touch();
      return { accepted: n, tasks: _.buildTasks(key).length, tasksPerDay: _.tasksPerDay(key), issueTriggers: activeIssueTriggers(key).length };
    });
  }

  /* ── Trigger status ─────────────────────────────────────────────────────────────────────────── */
  /* resolve an alert id or a binding pid to {alertId, row, it} */
  function target(key, ref) {
    const s = String(ref || ''); if (s.includes('|')) { const row = rowByPid(key, s); return { row, alertId: row ? row.alertId : null, pid: s }; }
    const row = rowByAlert(key, s); return { row, alertId: _.alertRaw(key, s) ? s : null, pid: row ? row.pid : null };
  }
  function activate(key, ref) {
    const P = PS(key); if (!P) return { ok: false, error: 'No such plant.' };
    const tg = target(key, ref); const t = now();
    if (tg.row && (tg.row.status === 'undecided' || tg.row.status === 'cantResolve')) {
      const r = decide(key, tg.row.pid, 'accept', { activate: true, quiet: true, noSave: true }); if (!r.ok) return r;
      const id = r.alertId; const name = id ? tName(key, id) : tg.row.name;
      act(t, key, id ? activityActivated(key, name) : `Activated ${name}${isLive(key) ? ': it is scheduled from today' : ': it starts at go-live'}`, 'config'); save();
      return { ok: true, alertId: id, scheduleId: r.scheduleId || null, phase: id ? _.triggerPhase(key, id) : 'active', toast: id ? activeLine(key, name) : `${name} is active.` };
    }
    if (tg.row && !tg.alertId) {   /* a Task binding accepted as a draft or left inactive */
      const it = _.findItem(key, tg.row.eqId, tg.row.kind, tg.row.template); if (!it) return { ok: false, error: 'No such Task.' };
      if (it.obj.status === 'active') return { ok: true, scheduleId: it.obj.id, phase: 'active', already: true };
      it.obj.status = 'active'; if (it.type === 'schedule' && P.state === 'live') startLiveTask(key, it.obj, t);
      P.decisions[tg.row.pid] = { ...(P.decisions[tg.row.pid] || {}), decided: 'accepted', at: t };
      act(t, key, `Activated ${tg.row.name}${isLive(key) ? ': it is scheduled from today' : ': it starts at go-live'}`, 'config'); save();
      return { ok: true, scheduleId: it.obj.id, phase: 'active', toast: `${tg.row.name} is active.` };
    }
    const id = tg.alertId; if (!id) return { ok: false, error: 'No such Trigger.' };
    const cur = _.alertState(key, id); if (cur === 'active') return { ok: true, alertId: id, phase: _.triggerPhase(key, id), already: true };
    const chk = canActivate(key, id); if (!chk.ok) return chk;
    /* on a Live plant a Trigger set inactive through an "enabled" override comes back by ending that override */
    const en = S().overrides.find((o) => o.plant === key && o.target && o.target.kind === 'enabled' && o.target.alertId === id && (o.status == null || o.status === 'active') && !o.endedAt);
    if (en && fnOf('setEnabled')) { const r = V.setEnabled(key, id, true, {}); if (!r.ok) return r; }
    if (_.alertState(key, id) !== 'active') _.putAlertState(key, id, 'active', t);
    P.alerts[id].decided = P.alerts[id].decided || 'accepted'; P.alerts[id].reason = null;
    if (tg.pid) P.decisions[tg.pid] = { ...(P.decisions[tg.pid] || {}), decided: 'accepted', at: t };
    const name = tName(key, id); act(t, key, activityActivated(key, name), 'config'); save();
    return { ok: true, alertId: id, phase: _.triggerPhase(key, id), toast: activeLine(key, name) };
  }
  const activityActivated = (key, name) => (isLive(key) ? `Activated ${name}: it creates Issues and notifies people from now on` : `Activated ${name}: it records trial firings; nothing is sent until go-live`);
  function leaveInactive(key, ref, opts) {
    const P = PS(key); if (!P) return { ok: false, error: 'No such plant.' };
    const why = String((opts && (opts.reason || opts.note)) || '').trim(); if (!why) return { ok: false, error: 'Say why it stays inactive.', field: 'reason' };
    const tg = target(key, ref); const t = now();
    if (tg.row && (tg.row.status === 'undecided' || tg.row.status === 'cantResolve')) { const r = decide(key, tg.row.pid, 'accept', { activate: false, quiet: true, noSave: true }); if (!r.ok) return r; tg.alertId = r.alertId || null; }
    if (tg.row && !tg.alertId) {
      const it = _.findItem(key, tg.row.eqId, tg.row.kind, tg.row.template); if (!it) return { ok: false, error: 'No such Task.' };
      it.obj.status = 'off'; P.decisions[tg.row.pid] = { ...(P.decisions[tg.row.pid] || {}), decided: 'accepted', at: t, reason: why };
      act(t, key, `Left ${tg.row.name} inactive: ${why}`, 'config'); save(); return { ok: true, scheduleId: it.obj.id, state: 'inactive', toast: `${tg.row.name} stays inactive.` };
    }
    const id = tg.alertId; if (!id) return { ok: false, error: 'No such Trigger.' };
    const cur = _.alertState(key, id); if (cur === 'active') return setAlertState(key, id, 'inactive', opts);
    if (cur !== 'inactive') _.putAlertState(key, id, 'inactive', t);
    Object.assign(P.alerts[id], { decided: P.alerts[id].decided || 'accepted', reason: why });
    if (tg.pid) P.decisions[tg.pid] = { ...(P.decisions[tg.pid] || {}), decided: 'accepted', at: t, reason: why };
    const name = tName(key, id); act(t, key, `Left ${name} inactive: ${why}`, 'config'); save();
    return { ok: true, alertId: id, state: 'inactive', toast: `${name} stays inactive: it never fires and no longer blocks go-live.` };
  }
  const STATE_AS = { trial: 'active', on: 'active', off: 'inactive' };
  function setAlertState(key, id, state, opts) {
    const o = opts || {}; const a = _.alertRaw(key, id); if (!a) return { ok: false, error: 'No such Trigger.' };
    const cur = _.alertState(key, id); const to = STATE_AS[state] || state;
    if (!LABELS.alertState[to]) return { ok: false, error: 'Pick Draft, Active or Inactive.' };
    if (cur === to) return { ok: true, state: to };
    if (to === 'draft') return { ok: false, error: `A Trigger that is ${LABELS.alertState[cur]} can't go back to Draft.` };
    if (to === 'active') { const r = activate(key, id); return r.ok ? { ...r, state: 'active' } : r; }
    if (cur === 'draft') { const r = leaveInactive(key, id, o); return r.ok ? { ...r, state: 'inactive' } : r; }
    /* active → inactive: on a Live plant it is an override of "enabled" with one of the five reasons */
    const P = PS(key); const t = now();
    if (P.state === 'live' && fnOf('setEnabled')) { const r = V.setEnabled(key, id, false, o); if (!r.ok) return r; if (_.alertState(key, id) !== 'inactive') _.putAlertState(key, id, 'inactive', t); P.alerts[id].reason = String(o.note || '').trim() || null; save(); return { ...r, ok: true, state: 'inactive', toast: `${tName(key, id)} is inactive at ${plantName(key)}.` }; }
    const why = String(o.reason || o.note || '').trim(); if (!why) return { ok: false, error: 'Say why it stays inactive.', field: 'reason' };
    _.putAlertState(key, id, 'inactive', t); P.alerts[id].reason = why;
    act(t, key, `Set ${tName(key, id)} inactive: ${why}`, 'config'); save();
    return { ok: true, state: 'inactive', toast: `${tName(key, id)} is inactive.` };
  }
  /* the Activate confirmation: what activating does here, and who each of its bands reaches */
  function activatePreview(key, ref) {
    const P = PS(key); if (!P) return null; const live = P.state === 'live';
    const refs = ref && typeof ref === 'object' && Array.isArray(ref.pids) ? ref.pids : [ref];
    const rows = refs.map((x) => target(key, x)).filter((x) => x.row || x.alertId);
    const bands = new Set(); rows.forEach((x) => {
      if (x.alertId) { const tm = safe(() => _.termsFor(key, x.alertId), null); if (tm) BANDS.forEach((b) => { if (tm.bands[b] != null) bands.add(b); }); }
      else if (x.row) arr(x.row.values).forEach((v) => { if (v.band) bands.add(v.band); });
    });
    const n = rows.length; const name = n === 1 ? (rows[0].alertId ? tName(key, rows[0].alertId) : rows[0].row.name) : null;
    const ladder = routing(key).ladder; const bandLines = BANDS.slice().reverse().filter((b) => bands.has(b)).reverse().map((b) => (ladder.find((l) => l.band === b) || {}).text).filter(Boolean);
    const loud = hooterOn(key) ? 'including Emergency calls and the hooter' : 'including Emergency calls (the hooter is switched off at this plant)';
    const lines = live
      ? [`${plantName(key)} is Live. From now on ${n === 1 ? 'this Trigger creates' : 'these Triggers create'} Issues and ${n === 1 ? 'notifies' : 'notify'} the plant's people, ${loud}.`, 'It gets no trial first: a Live plant has none. To see trial firings before anyone is told, the whole plant returns to Commissioning.']
      : [`${plantName(key)} is in Commissioning: ${n === 1 ? 'this Trigger records' : 'these Triggers record'} trial firings only. Nothing is sent until go-live.`];
    return { live, count: n, title: n === 1 ? `Activate ${name}?` : `Accept and activate ${n} Triggers?`, lines, bandsTitle: live ? 'Who its bands reach here:' : 'Who its bands will reach from go-live:', bandLines, buttons: live ? ['Not yet', 'Return the plant to Commissioning…', 'Activate'] : ['Not yet', 'Activate'] };
  }

  /* ════════════════════ people, routing ════════════════════ */
  const roleKey = (r) => { const s = String(r || '').trim().toLowerCase(); if (ROLE[s]) return s; const k = Object.keys(ROLE).find((x) => ROLE[x].toLowerCase() === s); return k || (s === 'operator' ? 'l1' : null); };
  const grantKey = (g) => { if (g == null || g === '' || g === 'none') return null; const s = String(g).trim().toLowerCase(); if (s === 'fullsite') return 'full'; if (GRANT[s]) return s; const k = Object.keys(GRANT).find((x) => GRANT[x].toLowerCase() === s); return k || undefined; };
  const chanKey = (c) => { if (c == null || c === '') return null; const s = String(c).trim().toLowerCase(); return s === 'wa' || s === 'whatsapp' ? 'wa' : s === 'sms' ? 'sms' : undefined; };
  const digits = (x) => String(x || '').replace(/\D/g, '').length;
  const rawPeople = (key) => (dOf(key) ? dOf(key).people : []);
  const isVerified = (p) => !!(p.phone && p.phone.verified && p.phone.number);
  function personView(key, p) {
    const ph = p.phone || {}; const verified = isVerified(p); const sent = !verified && ph.codeSentAt != null;
    const chan = verified ? (CHANNEL[ph.channel] || 'in the app') : 'in the app';
    return {
      id: p.id, name: p.name, role: p.role, roleLabel: ROLE[p.role] || p.role, grant: p.grant || null, grantLabel: p.grant && GRANT[p.grant] ? `${GRANT[p.grant]} · ${plantName(key)}` : null,
      phone: { number: ph.number != null ? ph.number : null, verified, channel: ph.channel || null, codeSentAt: ph.codeSentAt != null ? ph.codeSentAt : null, verifiedAt: ph.verifiedAt != null ? ph.verifiedAt : null },
      number: ph.number || null, channel: chan, channelText: verified && CHANNEL[ph.channel] ? CHANNEL[ph.channel] : 'In the app only', reachable: verified && p.role !== 'regular',
      verifiedState: verified ? 'verified' : sent ? 'sent' : ph.number ? 'unverified' : 'none', verifiedText: verified ? 'Verified' : sent ? `Code sent ${fmtTime(ph.codeSentAt)} · waiting` : ph.number ? 'Not verified' : 'No phone',
      sampleConfirm: sent ? `(sample) ${p.name} enters the code` : null, quiet: p.quiet,
    };
  }
  const people = (key) => rawPeople(key).map((p) => personView(key, p));
  function reachability(key) {
    const ppl = people(key); const ops = ppl.filter((p) => p.role === 'l1' && p.reachable).map((p) => p.id); const leads = ppl.filter((p) => (p.role === 'l3' || p.role === 'l4') && p.reachable).map((p) => p.id);
    const missing = [!ops.length ? 'operator' : null, !leads.length ? 'lead' : null].filter(Boolean); const comm = !isLive(key);
    const text = !missing.length ? `${plural(ops.length, 'Operator')} and ${plural(leads.length, 'Lead')} can be reached: their phones are verified.`
      : missing.length === 2 ? `No Operator or Lead with a verified phone: nobody would be notified.${comm ? ' This blocks go-live.' : ''}`
        : missing[0] === 'lead' ? `No Lead with a verified phone: nobody would be notified at Lead level.${comm ? ' This blocks go-live.' : ''}` : `No Operator with a verified phone: nobody would be notified at Operator level.${comm ? ' This blocks go-live.' : ''}`;
    return { operators: ops, leads, ok: !missing.length, missing, text, tone: missing.length ? 'bad' : 'ok' };
  }
  function checkPerson(x) {
    if (!String(x.name || '').trim()) return { error: 'Give the person\'s name.', field: 'name' };
    if (!roleKey(x.role)) return { error: 'Pick a role.', field: 'role' };
    const r = roleKey(x.role); const num = String(x.phone || '').trim();
    if (r !== 'regular' && !num) return { error: 'An Operator, Lead or Senior Lead needs a phone number to be reached.', field: 'phone' };
    if (num && digits(num) < 10) return { error: 'Give a phone number with at least 10 digits.', field: 'phone' };
    if (x.channel !== undefined && chanKey(x.channel) === undefined) return { error: 'Pick WhatsApp or SMS.', field: 'channel' };
    if (x.grant !== undefined && grantKey(x.grant) === undefined) return { error: 'Pick None, People Admin, Technical Admin or Full Admin.', field: 'grant' };
    return null;
  }
  function addPerson(key, x0) {
    const x = x0 || {}; const d = dOf(key); if (!d) return { ok: false, error: 'No such plant.' };
    const bad = checkPerson(x); if (bad) return { ok: false, ...bad };
    const role = roleKey(x.role); const num = String(x.phone || '').trim() || null; const id = _.counterId('pseq', 'pp');
    const p = { id, name: String(x.name).trim(), role, grant: grantKey(x.grant) || null, phone: { number: num, verified: false, channel: num ? chanKey(x.channel) || 'wa' : null, codeSentAt: null, verifiedAt: null }, major: 'now', quiet: 'off' };
    d.people.push(p); act(now(), key, `Added ${p.name} (${ROLE[role]}) to the roster`, 'people'); save();
    return { ok: true, id, person: personView(key, p), toast: num ? `Added ${p.name} (${ROLE[role]}). Send a code so they can verify their phone.` : `Added ${p.name} (${ROLE[role]}).` };
  }
  function updatePerson(key, id, patch) {
    const p = rawPeople(key).find((x) => x.id === id); if (!p) return { ok: false, error: 'No such person.' };
    const q = patch || {}; const next = { name: q.name !== undefined ? q.name : p.name, role: q.role !== undefined ? q.role : p.role, phone: q.phone !== undefined ? q.phone : (p.phone || {}).number || '', channel: q.channel, grant: q.grant };
    const bad = checkPerson(next); if (bad) return { ok: false, ...bad };
    const what = []; const ph = p.phone || (p.phone = { number: null, verified: false, channel: null, codeSentAt: null, verifiedAt: null });
    const nm = String(next.name).trim(); if (nm !== p.name) { what.push(`name ${p.name} → ${nm}`); p.name = nm; }
    const role = roleKey(next.role); if (role !== p.role) { what.push(`role ${ROLE[p.role] || p.role} → ${ROLE[role]}`); p.role = role; }
    const num = String(next.phone || '').trim() || null; let reverify = false;
    if (num !== (ph.number || null)) { what.push(`phone ${ph.number || 'none'} → ${num || 'none'}`); Object.assign(ph, { number: num, verified: false, codeSentAt: null, verifiedAt: null }); reverify = !!num; }
    if (q.channel !== undefined) { const c = chanKey(q.channel); if (c !== (ph.channel || null)) { what.push(`channel ${CHANNEL[ph.channel] || 'none'} → ${CHANNEL[c] || 'none'}`); ph.channel = c; } }
    if (q.grant !== undefined) { const g = grantKey(q.grant); if (g !== (p.grant || null)) { what.push(`admin grant ${GRANT[p.grant] || 'none'} → ${GRANT[g] || 'none'}`); p.grant = g; } }
    if (!what.length) return { ok: true, changed: false, toast: 'Nothing changed.' };
    act(now(), key, `Changed ${p.name}: ${what.join('; ')}`, 'people'); save();
    return { ok: true, changed: true, person: personView(key, p), toast: reverify ? `Saved ${p.name}. Changing the number means verifying it again.` : `Saved ${p.name}.` };
  }
  function removePreview(key, id) {
    const p = rawPeople(key).find((x) => x.id === id); if (!p) return null;
    const before = reachability(key); const others = people(key).filter((x) => x.id !== id);
    const ops = others.filter((x) => x.role === 'l1' && x.reachable).length; const leads = others.filter((x) => (x.role === 'l3' || x.role === 'l4') && x.reachable).length;
    const leavesNoOperator = before.operators.length > 0 && ops === 0; const leavesNoLead = before.leads.length > 0 && leads === 0;
    const who = leavesNoOperator && leavesNoLead ? 'Operator or Lead' : leavesNoOperator ? 'Operator' : 'Lead';
    const text = !leavesNoOperator && !leavesNoLead ? 'Nobody else changes.' : isLive(key) ? `${plantName(key)} would have no ${who} with a verified phone: nobody would be told at ${leavesNoOperator && leavesNoLead ? 'Operator or Lead' : who} level.` : `${plantName(key)} would have no ${who} with a verified phone: go-live would be blocked.`;
    return { leavesNoOperator, leavesNoLead, text, title: `Remove ${p.name} from ${plantName(key)}'s roster?` };
  }
  function removePerson(key, id) {
    const d = dOf(key); const i = d ? d.people.findIndex((x) => x.id === id) : -1; if (i < 0) return { ok: false, error: 'No such person.' };
    const p = d.people[i]; d.people.splice(i, 1); act(now(), key, `Removed ${p.name} from the roster`, 'people'); save();
    return { ok: true, toast: `Removed ${p.name} from the roster.` };
  }
  function sendCode(key, id) {
    const p = rawPeople(key).find((x) => x.id === id); if (!p) return { ok: false, error: 'No such person.' };
    const ph = p.phone || (p.phone = { number: null, verified: false, channel: null, codeSentAt: null, verifiedAt: null });
    if (!ph.number) return { ok: false, error: 'Add a phone number first.' };
    if (ph.verified) return { ok: false, error: `${p.name}'s phone is already verified.` };
    ph.codeSentAt = now(); act(now(), key, `Sent a code to ${p.name}'s phone`, 'people'); save();
    return { ok: true, codeSentAt: ph.codeSentAt, toast: `Code sent to ${p.name}'s phone. They verify it by entering the code.` };
  }
  /* the prototype's stand-in for the person typing the code they were sent */
  function confirmCode(key, id) {
    const p = rawPeople(key).find((x) => x.id === id); if (!p) return { ok: false, error: 'No such person.' };
    const ph = p.phone || {}; if (ph.verified) return { ok: true, already: true };
    if (ph.codeSentAt == null) return { ok: false, error: 'Send a code first.' };
    Object.assign(ph, { verified: true, verifiedAt: now() }); if (!ph.channel) ph.channel = 'wa';
    act(now(), key, `${p.name}'s phone verified`, 'people'); save();
    return { ok: true, toast: `${p.name}'s phone is verified. They can now be reached by ${CHANNEL[ph.channel] || 'WhatsApp'}.` };
  }
  function routing(key) {
    const ppl = rawPeople(key); const n = (...roles) => ppl.filter((p) => roles.includes(p.role)).length; const on = hooterOn(key);
    const ladder = [
      { band: 'emergency', label: 'Emergency', text: on ? 'Emergency: calls every Operator, Lead and Senior Lead, a full-screen warning in the app, and the hooter' : 'Emergency: calls every Operator, Lead and Senior Lead, and a full-screen warning in the app (the hooter is off)', count: n('l1', 'l3', 'l4') },
      { band: 'major', label: 'Major', text: 'Major: Operators and Leads by WhatsApp or SMS, with a full-screen warning in the app', count: n('l1', 'l3') },
      { band: 'minor', label: 'Minor', text: 'Minor: Operators by WhatsApp or SMS; Leads in the app', count: n('l1', 'l3') },
      { band: 'caution', label: 'Caution', text: 'Caution: Operators and Leads in the app and the morning email', count: n('l1', 'l3') },
    ].map((l) => ({ ...l, countText: plural(l.count, 'person', 'people') }));
    const clocks = BANDS.slice().reverse().map((b) => { const c = CLOCK_HOURS(b); return { band: b, label: BAND_LABEL[b], start: c[0], fix: c[1], text: c[0] == null ? `${BAND_LABEL[b]}: none` : `${BAND_LABEL[b]} ${c[0]} h / ${c[1]} h` }; });
    const comm = !isLive(key);
    return { hooter: on, ladder, clocks, clocksText: `Start by / fix by follow the severity: ${clocks.map((c) => c.text).join(' · ')}.`, clocksNote: 'No Trigger sets its own.', commissioning: comm, banner: comm ? 'Commissioning: nothing is sent. This is who will be told from go-live.' : null, title: 'Routing', sub: 'Who each severity reaches at this plant, worked out from the roster.', hooterLabel: 'Hooter at this plant', offConfirm: `Switch the hooter off at ${plantName(key)}? Emergencies will still call every Operator, Lead and Senior Lead, but the hooter won't sound.` };
  }
  function setRouting(key, x) {
    const P = PS(key); if (!P) return { ok: false, error: 'No such plant.' }; const want = !!(x && x.hooter); const r = routingOf(key);
    if ((r.hooter !== false) === want) return { ok: true, changed: false };
    r.hooter = want; const text = `Hooter switched ${want ? 'on' : 'off'} at ${plantName(key)}`; act(now(), key, text, 'people'); save();
    return { ok: true, changed: true, hooter: want, toast: `${text}.` };
  }

  /* ════════════════════ last service dates, first due dates ════════════════════ */
  const nodeOfSched = (key, sc) => (sc && sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(key, sc.subject.id) : null);
  const serviceDateOf = (key, eqId) => { const P = PS(key); const x = P && P.serviceDates ? P.serviceDates[eqId] : null; return x ? x.date : null; };
  /* a scheduled Task's first due date at go-live: from its last real completion, else (PM work) its equipment's last service date,
     plus its cadence (run-hours work by its hour meter); without either it is due on go-live day; a date already passed is due then */
  function firstDueAt(key, sc, state, goLiveAt) {
    const st = state || {}; const at = goLiveAt != null ? goLiveAt : now(); const e = nodeOfSched(key, sc);
    const sd = e && sc.workType === 'pm' ? serviceDateOf(key, e.id) : null;
    let anchor = null, from = null; if (st.lastDone != null) { anchor = st.lastDone; from = 'done'; } else if (sd != null) { anchor = sd; from = 'entered'; }
    if (anchor == null) return { due: at, why: 'golive', anchorFrom: null, serviceDate: null };
    const md = safe(() => _.meterDue(key, sc, { lastDone: anchor }), null);
    const due = Math.round((md != null ? md : anchor + _.intervalH(sc, _.rateOfEq(e)) * HOUR) / MIN) * MIN;
    if (due <= at) return { due: at, why: 'service-passed', anchorFrom: from, serviceDate: sd };
    return { due, why: 'service', anchorFrom: from, serviceDate: sd };
  }
  /* every scheduled Task's first due date if the plant went live at `at` (a pure preview) */
  function goLiveTasks(key, at0, opts) {
    const P = PS(key); if (!P || !dOf(key)) return null; const at = at0 != null ? at0 : now(); const only = opts && opts.eqId;
    const rows = _.buildTasks(key).filter((v) => !only || v.eqIds.includes(only)).map((v) => { const r = firstDueAt(key, v.sc, P.tasks[v.id] || {}, at); return { taskId: v.id, scheduleId: v.sc.id, eqId: v.eqIds[0] || null, eqTag: v.eqIds.length ? tagOf(key, v.eqIds[0]) : null, name: v.name, workType: v.workType, due: r.due, why: r.why, anchorFrom: r.anchorFrom }; });
    const sd = serviceDates(key, { light: true });
    return { at, scheduled: rows.length, dueToday: rows.filter((r) => r.due <= at).length, fromDates: rows.filter((r) => r.why === 'service').length, eqDated: sd.entered, eqWithPM: sd.total, perDay: _.tasksPerDay(key), rows };
  }
  /* the nodes with at least one PM Task: active, accepted as a draft, or (while the bindings pass is open) still proposed */
  function pmNodes(key) {
    const d = dOf(key); const P = PS(key); const m = new Map();
    const add = (id, name) => { if (!id || id === 'plant') return; if (!m.has(id)) m.set(id, new Set()); m.get(id).add(name); };
    d.schedules.filter((sc) => sc.workType === 'pm' && sc.subject && sc.subject.kind === 'eq' && sc.status !== 'off').forEach((sc) => { if (sc.status === 'active' || (P.decisions[`${sc.subject.id}|task|${sc.name}`] || {}).decided === 'accepted') add(sc.subject.id, sc.name); });
    if (P.state !== 'live' && passOpen(key)) passRows(key).filter((r) => r.kind === 'task' && r.workType === 'pm' && (r.status === 'undecided' || r.status === 'draft')).forEach((r) => add(r.eqId, r.template));
    return m;
  }
  function serviceDates(key, opts) {
    const P = PS(key); const d = dOf(key); if (!P || !d) return null; const live = P.state === 'live'; const sdAll = P.serviceDates || {};
    const pm = pmNodes(key); const order = d.equipment.map((e) => e.id).filter((id) => pm.has(id));
    const entered = order.filter((id) => sdAll[id]).length;
    if (opts && opts.light) return { total: order.length, entered };
    const all = goLiveTasks(key, now()); const by = (id) => all.rows.filter((r) => r.eqId === id && r.workType === 'pm');
    const rows = order.map((id) => {
      const e = _.eqRaw(key, id); const x = sdAll[id] || null; const rs = by(id); const later = rs.filter((r) => r.why === 'service'); const today = rs.length - later.length;
      const earliest = later.length ? Math.min(...later.map((r) => r.due)) : null;
      const text = !rs.length ? `${plural(pm.get(id).size, 'PM Task')} once accepted` : !later.length ? `All ${rs.length} on go-live day` : !today ? `All ${rs.length} later · earliest ${fmtDay(earliest)}` : `${today} on go-live day, ${later.length} later · earliest ${fmtDay(earliest)}`;
      return { eqId: id, tag: e.tag, name: e.name, typeName: e.libType || e.type, pmTasks: pm.get(id).size, date: x ? x.date : null, dateText: x ? fmtDay(x.date) : null, iso: x ? _.isoDay(x.date) : null, at: x ? x.at : null, by: x ? x.by : null, preview: { fromDate: later.length, dueAtGoLive: today, earliest, text } };
    });
    return {
      live, total: order.length, entered, rows, dueTodayIfNow: all.dueToday, scheduled: all.scheduled, max: isoToday(),
      counterText: `Entered for ${entered} of ${plural(order.length, 'piece', 'pieces')} of equipment · If you went live now, ${all.dueToday} of ${all.scheduled} scheduled Tasks would fall due on go-live day.`,
      title: 'Last service dates', sub: 'Optional. Scheduled Tasks start at go-live. A PM Task\'s first due date counts from its equipment\'s last service date; without one, it is due on go-live day.',
      foot: 'Calibrations, routine checks, routine work and manual tests have no service date: they fall due on go-live day.',
      liveText: live ? `${plantName(key)} is Live: PM Tasks count from their last completion.` : null,
    };
  }
  function setServiceDate(key, eqId, iso) {
    const P = PS(key); if (!P || !dOf(key)) return { ok: false, error: 'No such plant.' };
    if (P.state === 'live') return { ok: false, error: `${plantName(key)} is Live: PM Tasks count from their last completion.` };
    const e = _.eqRaw(key, eqId); if (!e) return { ok: false, error: 'No such equipment.' };
    if (!pmNodes(key).has(eqId)) return { ok: false, error: `${e.tag} has no PM Task.` };
    P.serviceDates = P.serviceDates || {};
    if (iso == null || iso === '') {
      if (!P.serviceDates[eqId]) return { ok: true, changed: false };
      delete P.serviceDates[eqId]; act(now(), key, `Last service date for ${e.tag} cleared`, 'config'); save(); return { ok: true, changed: true, toast: `Last service date for ${e.tag} cleared.` };
    }
    const s = String(iso).trim(); if (!/^\d{4}-\d\d-\d\d$/.test(s) || !Number.isFinite(dayStart(s))) return { ok: false, error: 'Pick a date.' };
    if (s > isoToday()) return { ok: false, error: 'A last service date can\'t be in the future.' };
    const date = dayStart(s); P.serviceDates[eqId] = { date, at: now(), by: ME }; _.touch();
    const rs = goLiveTasks(key, now(), { eqId }).rows.filter((r) => r.workType === 'pm'); const later = rs.filter((r) => r.why === 'service').length;
    act(now(), key, `Last service date for ${e.tag} set to ${fmtDay(date)}`, 'config'); save();
    return { ok: true, changed: true, date, toast: `Last service for ${e.tag} set to ${fmtDay(date)}: ${later} of its ${rs.length} PM Tasks now count from it.` };
  }

  /* ── cadence changes from the library: where counting starts ─────────────────────────────────── */
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  /* the schedules that follow a Task template, at every plant: from the library file when it says, else read from the template id */
  function followersOf(templateId) {
    const tf = fnOf('template'); const tp = tf ? safe(() => tf(templateId), null) : null;
    const uses = tp ? arr(tp.uses || tp.followers || tp.instances).filter((u) => u && (u.scheduleId || u.id) && (u.plant || u.key)) : [];
    if (uses.length) return uses.map((u) => ({ key: u.plant || u.key, scheduleId: u.scheduleId || u.id })).filter((u) => _.schedRaw(u.key, u.scheduleId));
    const id = String(templateId || ''); let typeName = null, plantType = null, sl = null;
    let m = /^tpl_up_([^_]+)_(.+)$/.exec(id);
    if (m) { const ut = arr(V.UP_TYPES).find((x) => x.id === m[1]); typeName = ut ? ut.name : null; sl = m[2]; }
    else if ((m = /^tpl_PLANT_([A-Z]+)_(.+)$/.exec(id))) { plantType = m[1]; sl = m[2]; }
    else if ((m = /^tpl_(.+)_([^_]+)$/.exec(id))) { const cat = _.catByCode(m[1]); typeName = cat ? cat.type : null; sl = m[2]; }
    if (!sl || (!typeName && !plantType)) return [];
    const base = sl.replace(/-\d+$/, ''); const out = [];
    ORDER.forEach((key) => { const d = dOf(key); if (!d) return; d.schedules.forEach((sc) => {
      const node = sc.subject && sc.subject.kind === 'eq' ? _.eqRaw(key, sc.subject.id) : null;
      const fits = plantType ? sc.subject.kind === 'plant' && d.plant.type === plantType : !!node && (node.libType || node.type) === typeName;
      if (!fits) return;
      if (slug(sc.name) === sl || slug(sc.name) === base) out.push({ key, scheduleId: sc.id });
    }); });
    return out;
  }
  const withEvery = (sc, every) => { const x = _.clone(sc); if (every && every.runHours != null) { x.meter = { ...(x.meter || {}), hours: +every.runHours }; if (x.basis === 'meter') x.every = { n: +every.runHours, unit: 'hour' }; } else if (every && every.n) x.every = { n: +every.n, unit: every.unit }; return x; };
  /* where a following Task's next due date lands under each choice: "service" counts from its last real completion, else its
     equipment's last service date entered at commissioning, else go-live; "publish" counts from the publish moment */
  function countFromDue(key, sc, st, at, countFrom) {
    const P = PS(key); const s0 = st || {}; const e = nodeOfSched(key, sc); const I = _.intervalH(sc, _.rateOfEq(e)) * HOUR;
    if (countFrom === 'publish') { const md = safe(() => _.meterDue(key, sc, { lastDone: at }), null); return { anchor: at, anchorFrom: 'publish', newDue: Math.round((md != null ? md : at + I) / MIN) * MIN, dueNow: false }; }
    let anchor, from;
    if (s0.lastDone != null) { anchor = s0.lastDone; from = 'done'; } else if (sc.workType === 'pm' && e && serviceDateOf(key, e.id) != null) { anchor = serviceDateOf(key, e.id); from = 'entered'; } else { anchor = P.goLiveAt != null ? P.goLiveAt : at; from = 'golive'; }
    const md = safe(() => _.meterDue(key, sc, { lastDone: anchor }), null); const due = Math.round((md != null ? md : anchor + I) / MIN) * MIN;
    return due <= at ? { anchor, anchorFrom: from, newDue: at, dueNow: true } : { anchor, anchorFrom: from, newDue: due, dueNow: false };
  }
  /* the 'dueAfterChange' hook: a publish's countFrom decides; any other change keeps core7's rule */
  function dueAfter(key, scNew, scOld, st, at, opts) {
    const cf = opts && opts.countFrom; if (cf !== 'service' && cf !== 'publish') return _.dueAfterChange(key, scNew, scOld, st, at);
    const r = countFromDue(key, scNew, st, at, cf); return { due: r.newDue, calDue: null };
  }
  function cadenceDueNow(templateId, every, countFrom) {
    const at = now(); const cf = countFrom === 'publish' ? 'publish' : 'service';
    const followers = followersOf(templateId); const plants = []; const later = [];
    const count = { service: 0, publish: 0 };
    ORDER.forEach((key) => {
      const P = PS(key); if (!P || P.state !== 'live') return; const tasks = [];
      followers.filter((f) => f.key === key).forEach((f) => {
        const sc = _.schedRaw(key, f.scheduleId); if (!sc || sc.status !== 'active') return;
        if (_.ovCadence(key, sc.id) || _.findOv(key, (t) => t.kind === 'runhours' && t.scheduleId === sc.id)) return;
        const tid = _.taskIdOfSchedule(key, sc.id); const st = (tid && P.tasks[tid]) || {}; if (st.status === 'due' || st.status === 'doing') return;
        const scNew = withEvery(sc, every); const r = countFromDue(key, scNew, st, at, cf);
        const rs = countFromDue(key, scNew, st, at, 'service'); if (rs.dueNow) count.service++;
        const isLater = st.due != null && r.newDue > st.due; if (isLater) later.push(tid);
        tasks.push({ taskId: tid, scheduleId: sc.id, eqTag: tagOf(key, sc.subject && sc.subject.id), name: sc.name, anchor: r.anchor, anchorFrom: r.anchorFrom, oldDue: st.due != null ? st.due : null, newDue: r.newDue, dueNow: r.dueNow, later: isLater, text: `${taskName(key, sc)}: ${r.dueNow ? 'due now' : `due ${fmt(r.newDue)}`}${isLater ? ' (later than before)' : ''}` });
      });
      if (tasks.length) plants.push({ key, name: plantName(key), tasks });
    });
    const dueNow = plants.reduce((n, p) => n + p.tasks.filter((x) => x.dueNow).length, 0); const withDue = plants.filter((p) => p.tasks.some((x) => x.dueNow)).length;
    const interval = every && every.runHours != null ? `${every.runHours} run-hours` : every && every.n ? _.everyText({ n: +every.n, unit: every.unit }).replace(/^every /, '') : '';
    return { templateId, countFrom: cf, plants, dueNow, plantsWithDueNow: withDue, interval, later: later.length, text: `${plural(dueNow, 'Task')} become${dueNow === 1 ? 's' : ''} due now across ${plural(withDue, 'plant')}`, labels: { service: `Count from the last service: ${count.service} due now`, publish: `Count from the publish date: first due in ${interval}` } };
  }

  /* ════════════════════ the one checklist ════════════════════ */
  const step = (id, mark, label, text, action) => ({ id, mark, label, text, action: action || null });
  function limitGapsOf(key) {
    const f = fnOf('limitGaps'); if (f) return arr(safe(() => f(key), []));
    /* without the library file: plant-graph readings with no limits in any band, once the bindings are proposed or the plant is Live */
    if (!isLive(key) && !passOpen(key)) return [];
    return V.sensors(key).filter((r) => !r.nextPhase && r.kind !== 'meter' && r.kind !== 'status' && _.noLimitsYet(key, r)).map((r) => ({ sensorId: r.id, tag: r.tag, name: r.name, nodeId: r.eqId, nodeTag: r.eqTag, why: 'norule', param: null, label: null, link: `#/p/${key}/sensor/${r.id}` }));
  }
  function gapNoLimits(key) {
    const gs = limitGapsOf(key); if (!gs.length) return null; const n = gs.length;
    const pr = gs.filter((g) => g.why === 'param'); const nr = gs.filter((g) => g.why !== 'param');
    const byParam = new Map(); pr.forEach((g) => { const k = g.label || g.param || 'a design parameter'; if (!byParam.has(k)) byParam.set(k, []); byParam.get(k).push(g.nodeTag || g.eqTag || g.tag); });
    const bits = [...byParam.entries()].map(([lab, tags]) => `${lab} missing on ${[...new Set(tags)].join(', ')}`).concat(nr.map((g) => `${g.name ? `${g.name} · ` : ''}${g.tag}: no limit rule`));
    const text = `${plural(n, 'reading')} ${n === 1 ? 'has' : 'have'} no limits: ${n === 1 ? 'it raises' : 'they raise'} nothing (${bits.join('; ')})`;
    const first = pr[0] || gs[0];
    return { id: 'nolimits', kind: 'gap', text, link: first.link || `#/p/${key}/readings`, linkText: pr.length ? 'Add parameter' : 'Open', count: n, items: gs.map((g) => { const s = _.sensorRaw(key, g.sensorId) || {}; const node = g.nodeId || g.eqId || ((_.homeOf(key, s) || {}).id) || null; return { sensorId: g.sensorId, name: g.name || s.name || g.tag, tag: g.tag || s.tag || null, eqId: node, nodeId: node, nodeTag: g.nodeTag || g.eqTag || (node ? tagOf(key, node) : null), why: g.why, param: g.param || null, label: g.label || null, link: g.link || null }; }), short: plural(n, 'reading without limits', 'readings without limits') };
  }
  function gapNoisy(key) {
    const P = PS(key); const comm = P.state === 'commissioning'; const items = [];
    activeIssueTriggers(key).forEach((a) => {
      if (comm) { const ts = trialStats(key, a.id); if (ts && ts.noisy) items.push({ alertId: a.id, name: tName(key, a.id), perDay: r1(ts.perDay), perDayText: one(ts.perDay) }); }
      else { const lr = liveRate(key, a.id); if (lr.perDay > 10) items.push({ alertId: a.id, name: tName(key, a.id), perDay: r1(lr.perDay), perDayText: rateText(lr.perDay), issues: lr.n }); }
    });
    if (!items.length) return null; items.sort((x, y) => y.perDay - x.perDay);
    const unit = comm ? ' a day' : ' Issues a day'; const list = items.map((x) => `${x.name} (${x.perDayText}${unit})`).join(', ');
    const text = comm ? (items.length === 1 ? `1 Trigger is noisy in trial: ${list}` : `${items.length} Triggers are noisy in trial: ${list}`) : (items.length === 1 ? `1 Trigger is noisy: ${list}` : `${items.length} Triggers are noisy: ${list}`);
    return { id: 'noisy', kind: 'gap', text, link: items.length === 1 ? `#/p/${key}/trigger/${items[0].alertId}` : `#/p/${key}/triggers?sort=trial`, linkText: 'Open', count: items.length, items, short: plural(items.length, 'noisy Trigger') };
  }
  function gapNoPm(key) {
    const d = dOf(key);
    const hasTask = (e) => d.schedules.some((sc) => sc.subject.kind === 'eq' && sc.subject.id === e.id && sc.workType !== 'calibration' && sc.status === 'active') || d.conditionWork.some((w) => w.subject.id === e.id && w.status === 'active');
    const list = d.equipment.filter((e) => (e.expects || []).length && !hasTask(e)); if (!list.length) return null; const n = list.length;
    const head = `${plural(n, 'piece', 'pieces')} of equipment without a maintenance programme`;
    const up = fnOf('isUp'); const one1 = n === 1 ? list[0] : null;
    return { id: 'nopm', kind: 'gap', text: `${head}: a planning gap, not a safety failure`, coverageText: head, link: one1 ? `#/p/${key}/${up && safe(() => up(key, one1.id), false) ? 'up' : 'eq'}/${one1.id}/tasks` : `#/p/${key}/structure`, linkText: 'Open', count: n, items: list.map((e) => ({ eqId: e.id, tag: e.tag })), short: plural(n, 'piece of equipment without a maintenance programme', 'pieces of equipment without a maintenance programme') };
  }
  function gapNoDiag(key) {
    const list = issueTriggers(key).filter((a) => { const st = _.alertState(key, a.id); if (st !== 'active' && st !== 'draft') return false; const f = safe(() => _.withPlant(key, () => C.diagFor(a)), null); return !f; });
    if (!list.length) return null; const n = list.length; const names = list.map((a) => tName(key, a.id));
    return { id: 'nodiag', kind: 'gap', text: n === 1 ? `1 Issue Trigger without a diagnostic flow: ${names[0]}` : `${n} Issue Triggers without a diagnostic flow`, link: n === 1 ? `#/p/${key}/trigger/${list[0].id}` : `#/p/${key}/triggers`, linkText: 'Open', count: n, items: list.map((a, i) => ({ alertId: a.id, name: names[i] })), short: plural(n, 'Issue Trigger without a diagnostic flow', 'Issue Triggers without a diagnostic flow') };
  }
  /* the trial so far at a Commissioning plant: from the earliest trial window over its active Triggers */
  function trialOf(key) {
    const P = PS(key); if (!P || P.state !== 'commissioning') return null; const since = _.trialStart(key); if (since == null) return null;
    const act0 = activeIssueTriggers(key); const firings = _.trialLogOf(key).filter((r) => r.start >= since && r.start <= now()).length;
    const noisy = []; act0.forEach((a) => { const ts = trialStats(key, a.id); if (ts && ts.noisy) noisy.push({ alertId: a.id, name: tName(key, a.id), perDay: r1(ts.perDay) }); });
    const day = Math.floor((now() - since) / DAY) + 1;
    return { day, since, active: act0.length, firings, noisy, text: `Day ${day} of trial · ${plural(act0.length, 'Trigger')} active · ${plural(firings, 'trial firing')} so far${noisy.length ? ` · ${plural(noisy.length, 'Trigger')} noisy` : ''}`, link: `#/p/${key}/triggers?sort=trial`, linkText: 'Review them' };
  }
  function structureSteps(key, open) {
    const base = `#/p/${key}`; const f = fnOf('structureTrack'); const raw = f ? arr(safe(() => f(key), [])) : null;
    const steps = raw ? raw.map((s) => step(s.id, s.mark || s.state || 'waiting', s.label, s.text || s.detail || '', s.action || (s.link ? { label: s.linkText || 'Review', href: s.link } : null))) : [step('structure', 'waiting', 'Structure pass', 'Not available yet')];
    if (!open && !isLive(key)) steps.push(step('params', 'waiting', 'Design parameters', 'Waiting for bindings'));
    else {
      const miss = limitGapsOf(key).filter((g) => g.why === 'param'); const pairs = []; miss.forEach((g) => { const k = `${g.label || g.param} ${g.nodeTag || g.eqTag || g.tag}`; if (!pairs.includes(k)) pairs.push(k); });
      steps.push(pairs.length ? step('params', 'attention', 'Design parameters', `${pairs.length} missing: ${pairs.join(', ')}`, { label: 'Add parameter', href: miss[0].link || `${base}/structure` }) : step('params', 'done', 'Design parameters', 'None missing'));
    }
    return steps;
  }
  function bindingSteps(key, bp, trial) {
    const base = `#/p/${key}`;
    if (!bp.open) return [step('proposed', 'waiting', 'Bindings proposed', 'Waiting for structure pass →', { label: 'Structure pass', href: `${base}/review/structure` }), step('resolved', 'waiting', 'Limits resolved into sensor zones', 'Waiting for bindings'), step('pass', 'waiting', 'Bindings pass', 'Waiting for bindings'), step('trial', 'waiting', 'Trial evidence', 'Starts when Triggers are active')];
    const c = bp.counts; const gaps = limitGapsOf(key).length; const waiting = c.waiting;
    const out = [step('proposed', 'done', 'Bindings proposed', bp.proposedText), step('resolved', 'done', 'Limits resolved into sensor zones', gaps ? `${gaps} can't resolve (gaps)` : 'All resolved')];
    out.push(waiting ? step('pass', 'current', 'Bindings pass', waiting === 1 ? '1 draft undecided' : `${waiting} drafts undecided`, { label: 'Review', href: `${base}/review/bindings?show=undecided` }) : step('pass', 'done', 'Bindings pass', `${c.accepted} accepted · ${c.active} active · ${c.inactive} left inactive on purpose`));
    if (!trial) out.push(step('trial', 'waiting', 'Trial evidence', 'Starts when Triggers are active'));
    else out.push(trial.noisy.length ? step('trial', 'current', 'Trial evidence', `Day ${trial.day} · ${plural(trial.noisy.length, 'Trigger')} ${trial.noisy.length === 1 ? 'fires' : 'fire'} more than 10 times a day`, { label: 'Tune', href: `${base}/triggers?sort=trial` }) : step('trial', 'done', 'Trial evidence', `Day ${trial.day} · none fires more than 10 times a day`));
    return out;
  }
  function peopleSteps(key) {
    const base = `#/p/${key}`; const ppl = people(key); const rc = reachability(key); const out = [];
    if (!ppl.length) out.push(step('roster', 'attention', 'Roster', 'No people yet', { label: 'Add people', href: `${base}/people` }));
    else { const by = (r) => ppl.filter((p) => p.role === r).length; const bits = ['l1', 'l3', 'l4', 'regular'].filter((r) => by(r)).map((r) => `${by(r)} ${by(r) === 1 ? ROLE[r] : ROLE_PLURAL[r]}`); out.push(step('roster', 'done', 'Roster', `${plural(ppl.length, 'person', 'people')} · ${bits.join(' · ')}`)); }
    if (rc.ok) out.push(step('reach', 'done', 'Reachability', `${plural(rc.operators.length, 'Operator')} and ${plural(rc.leads.length, 'Lead')} with verified phones`));
    else if (rc.missing.length === 2) out.push(step('reach', 'attention', 'Reachability', 'No Operator or Lead with a verified phone', { label: 'People', href: `${base}/people` }));
    else {
      const role = rc.missing[0]; const pool = ppl.filter((p) => (role === 'lead' ? p.role === 'l3' || p.role === 'l4' : p.role === 'l1'));
      const word = role === 'lead' ? 'Lead' : 'Operator';
      out.push(pool.length === 1 && pool[0].number ? step('reach', 'attention', 'Reachability', `The ${word} has no verified phone`, { label: 'Send code', act: 'ppl:send', data: { plant: key, id: pool[0].id } }) : step('reach', 'attention', 'Reachability', `No ${word} with a verified phone`, { label: 'People', href: `${base}/people` }));
    }
    const sd = serviceDates(key, { light: true });
    out.push(step('dates', 'waiting', 'Last service dates', sd.entered ? `Entered for ${sd.entered} of ${plural(sd.total, 'piece', 'pieces')} of equipment` : 'Optional · sets first PM due dates', { label: 'Enter dates', href: `${base}/people/service-dates` }));
    return out;
  }
  function blockersOf(key, bp) {
    const P = PS(key); if (P.state === 'live') return []; const base = `#/p/${key}`; const out = []; const rc = reachability(key);
    if (rc.missing.includes('operator')) out.push({ id: 'operator', kind: 'blocker', text: 'No Operator with a verified phone: nobody would be notified', link: `${base}/people`, linkText: 'People', count: 1, items: [] });
    if (rc.missing.includes('lead')) out.push({ id: 'lead', kind: 'blocker', text: 'No Lead with a verified phone: nobody would be notified', link: `${base}/people`, linkText: 'People', count: 1, items: [] });
    const sc = fnOf('surveyCheck'); const un = sc ? arr((safe(() => sc(key), {}) || {}).untyped) : [];
    if (un.length) out.push({ id: 'untyped', kind: 'blocker', text: un.length === 1 ? `1 piece of equipment has no type: ${un[0].tag}` : `${un.length} pieces of equipment have no type: ${un.map((x) => x.tag).join(', ')}`, link: `${base}/structure`, linkText: 'Fix the survey, then re-run', toast: 'The survey sets each piece of equipment\'s type. Correct the survey, then re-run identification.', count: un.length, items: un });
    const sp = fnOf('structurePass'); const uc = sp ? arr((safe(() => sp(key), {}) || {}).unclassified) : [];
    if (uc.length) { const tags = uc.map((x) => x.tag); const list = tags.length <= 3 ? joinAnd(tags) : `${tags.slice(0, 3).join(', ')} and ${tags.length - 3} more`; out.push({ id: 'unclassified', kind: 'blocker', text: uc.length === 1 ? `1 piece of equipment is unclassified: ${list}` : `${uc.length} pieces of equipment are unclassified: ${list}`, link: `${base}/review/structure?show=unclassified`, linkText: 'Place them', count: uc.length, items: uc }); }
    if (bp.open) {
      const w = bp.rows.filter((r) => ['undecided', 'cantResolve', 'draft'].includes(r.status)); const n = w.length;
      if (n) { const show = w.some((r) => r.status === 'undecided') ? 'undecided' : w.some((r) => r.status === 'cantResolve') ? 'cantresolve' : 'draft'; out.push({ id: 'drafts', kind: 'blocker', text: n === 1 ? `1 draft is undecided: ${w[0].name}` : `${n} drafts are undecided`, link: `${base}/review/bindings?show=${show}`, linkText: 'Decide', count: n, items: w.map((r) => ({ pid: r.pid, name: r.name, status: r.status })) }); }
    }
    return out;
  }
  function checklist(key) {
    return cached(`check:${key}`, () => {
      const P = PS(key); const d = dOf(key); if (!P || !d) return null; const live = P.state === 'live';
      const bp = bindingsPass(key); const trial = trialOf(key);
      const blockers = blockersOf(key, bp);
      const gaps = [gapNoisy(key), gapNoLimits(key), gapNoPm(key), gapNoDiag(key)].filter(Boolean);
      const canGoLive = !live && blockers.length === 0; const n = blockers.length;
      const buttonLabel = live ? `${plantName(key)} is Live` : canGoLive ? 'Go live' : `Go live · ${plural(n, 'blocker')} left`;
      return {
        state: P.state, live, tracks: { structure: { title: 'Structure', steps: structureSteps(key, bp.open) }, bindings: { title: 'Bindings', steps: bindingSteps(key, bp, trial) }, people: { title: 'People', steps: peopleSteps(key) } },
        trial, blockers, gaps, canGoLive, buttonLabel, whyNot: buttonLabel, foot: 'Go live needs Full Admin', readyText: 'No blockers. Gaps don\'t stop go-live.',
        emptyText: !blockers.length && !gaps.length ? 'Nothing blocks go-live and there are no gaps.' : null, firstBlocker: blockers.length ? blockers[0].text : null,
        blockersChip: live ? null : { text: plural(n, 'blocker'), tone: n ? 'bad' : 'plain' }, bindings: bp.counts, open: bp.open,
      };
    });
  }

  /* ════════════════════ go live and back ════════════════════ */
  function goLivePreview(key) {
    const P = PS(key); const d = dOf(key); if (!P || !d) return null; const cl = checklist(key); const g = goLiveTasks(key, now()); const pd = Math.round(g.perDay);
    const tasksText = !g.scheduled ? 'No scheduled Tasks yet: nothing falls due today.' : !g.eqDated ? `All ${g.scheduled} scheduled Tasks fall due today: no service dates were entered. After today, about ${pd} Tasks a day.` : `${g.dueToday} of ${g.scheduled} scheduled Tasks fall due today. Service dates were entered for ${g.eqDated} of ${plural(g.eqWithPM, 'piece', 'pieces')} of equipment; ${plural(g.fromDates, 'Task')} count${g.fromDates === 1 ? 's' : ''} from them. After today, about ${pd} Tasks a day.`;
    const loud = hooterOn(key) ? 'Triggers create Issues and notify the plant\'s people, including Emergency calls and the hooter' : 'Triggers create Issues and notify the plant\'s people, including Emergency calls (the hooter is switched off at this plant)';
    const tasks = { scheduled: g.scheduled, dueToday: g.dueToday, fromDates: g.fromDates, eqDated: g.eqDated, eqWithPM: g.eqWithPM, perDay: pd, perDayExact: g.perDay, text: tasksText };
    const lines = [{ text: loud, loud: true }, { text: 'Scheduled Tasks start. First due dates come from the service dates you entered, otherwise today.', loud: false, sub: tasksText }, { text: 'Metrics and PM compliance start counting today', loud: false }, { text: 'Changing structure will need a reason', loud: false }];
    const act0 = activeIssueTriggers(key); const stats = act0.map((a) => ({ a, ts: trialStats(key, a.id) })).filter((x) => x.ts);
    const fired = stats.filter((x) => x.ts.count > 0).length; const noisy = stats.filter((x) => x.ts.noisy).map((x) => ({ alertId: x.a.id, name: tName(key, x.a.id), perDay: r1(x.ts.perDay) }));
    const firings = stats.reduce((n, x) => n + x.ts.count, 0);
    const trialText = !act0.length ? 'Trial: no Trigger was active' : !fired ? 'Trial: no Trigger fired' : `Trial: ${plural(fired, 'Trigger')} fired · ${noisy.length ? noisy.length : 'none'} fired more than 10 times a day`;
    const gaps = cl.gaps; const gapsText = gaps.length ? `${plural(gaps.length, 'gap')} remain${gaps.length === 1 ? 's' : ''} · ${gaps.map((x) => x.short).join(' · ')}` : 'No gaps remain';
    return { title: `Go live: ${plantName(key)}`, head: 'From now on:', lines, tasks, tasksPerDay: pd, lastService: { entered: g.eqDated, total: g.eqWithPM }, trial: { fired, active: act0.length, firings, noisy, text: trialText, link: `#/p/${key}/triggers?sort=trial`, linkText: fired ? 'Review them' : null }, gaps, gapsText, gapsLinkText: gaps.length ? 'List' : null, buttons: ['Not yet', 'Go live'], canGoLive: cl.canGoLive, checklist: cl };
  }
  function goLive(key) {
    const P = PS(key); if (!P || !dOf(key)) return { ok: false, error: 'No such plant.' };
    if (P.state === 'live') return { ok: false, error: `${plantName(key)} is already Live.` };
    const cl = checklist(key); if (!cl.canGoLive) return { ok: false, error: `Go live is blocked: ${cl.blockers[0].text}` };
    const pv = goLivePreview(key); const t = now(); const cs = P.commissioningSince;
    /* no Trigger changes its status; a trial firing still running ends now, and the trial is over */
    Object.keys(P.trialOpen || {}).forEach((id) => _.endTrialRecord(key, id, t)); P.trialOpen = {};
    P.state = 'live'; P.since = t; P.goLiveAt = t; P.goLives = arr(P.goLives).concat([{ at: t, commissioningSince: cs != null ? cs : null }]); P.commissioningSince = null;
    P.engineAt = _.lastPollAtOrBefore(t); P.eng = {};
    _.touch(); _.ensureTaskStates(key, 'golive'); _.touch();
    const ids = _.buildTasks(key).map((v) => v.id); const dueNow = ids.filter((id) => P.tasks[id] && P.tasks[id].due != null && P.tasks[id].due <= t).length;
    const a = activeIssueTriggers(key).length; const loud = hooterOn(key) ? 'including Emergency calls and the hooter' : 'including Emergency calls (the hooter is switched off at this plant)';
    act(t, key, `Went live: ${plural(a, 'Trigger')} now create${a === 1 ? 's' : ''} Issues and notify people, ${loud}. ${dueNow} of ${ids.length} scheduled Tasks due today.`, 'golive');
    save();
    return { ok: true, preview: pv, dueToday: dueNow, toast: `${plantName(key)} is Live. Issues and notifications started at ${fmtTime(t)}.` };
  }
  function returnToCommissioning(key, reason) {
    const P = PS(key); if (!P || !dOf(key)) return { ok: false, error: 'No such plant.' };
    if (P.state !== 'live') return { ok: false, error: `${plantName(key)} is already in Commissioning.` };
    const why = String(reason || '').trim(); if (!why) return { ok: false, error: 'Say why the plant goes back to Commissioning.', field: 'reason' };
    const t = now(); P.state = 'commissioning'; P.since = t; P.commissioningSince = t; P.trialOpen = {}; P.returned = arr(P.returned).concat([{ at: t, reason: why }]);
    /* statuses stay; upcoming Tasks wait for go-live again; Tasks already due or started stay open */
    Object.values(P.tasks || {}).forEach((st) => { if (st && st.status === 'upcoming') { st.status = 'waiting'; st.due = null; } });
    P.engineAt = _.lastPollAtOrBefore(t); P.eng = {};
    act(t, key, `Returned to Commissioning: ${why.replace(/[.\s]+$/, '')}. Triggers record trial firings only, Emergencies included: nothing is sent. Scheduled Tasks stop; metrics stop counting.`, 'golive');
    save(); return { ok: true, toast: `${plantName(key)} is back in Commissioning. Triggers record trial firings only; nothing is sent, Emergencies included.` };
  }
  function returnPreview(key) {
    const P = PS(key); if (!P || !dOf(key)) return null;
    const activeTriggers = activeIssueTriggers(key).length; const openIssues = P.issues.filter((i) => i.status !== 'closed').map((i) => ({ id: i.id, title: i.title }));
    const ts = V.tasks(key); const up = ts.filter((x) => x.status === 'upcoming'); const tasksUpcoming = up.length; const tasksDueNext7 = up.filter((x) => x.due != null && x.due <= now() + 7 * DAY).length; const tasksOpen = ts.filter((x) => x.status === 'due' || x.status === 'doing').length;
    const after = P.state === 'live' ? _.dryRun(key, () => { returnToCommissioning(key, 'preview'); return checklist(key); }) : checklist(key);
    const blockersAfter = arr(after && after.blockers); const dr = blockersAfter.find((b) => b.id === 'drafts'); const draftsAfter = dr ? dr.count : 0;
    const lines = [{ text: `${plural(activeTriggers, 'active Trigger')} record${activeTriggers === 1 ? 's' : ''} trial firings only, at every severity, Emergencies included. Nobody is told: no Issues, no WhatsApp, no calls, no hooter.`, loud: true }];
    if (openIssues.length) lines.push({ text: openIssues.length === 1 ? `1 open Issue stays open and is worked as normal, with its reminders and escalations: ${openIssues[0].title}.` : `${openIssues.length} open Issues stay open and are worked as normal, with their reminders and escalations: ${joinAnd(openIssues.map((x) => x.title))}.`, loud: false });
    lines.push({ text: `Scheduled Tasks stop: ${plural(tasksUpcoming, 'upcoming Task')} won't come due (${tasksDueNext7} ${tasksDueNext7 === 1 ? 'was' : 'were'} due in the next 7 days).${tasksOpen ? ` ${tasksOpen === 1 ? '1 Task already due stays open' : `${tasksOpen} Tasks already due stay open`}.` : ''}`, loud: false });
    lines.push({ text: 'Metrics stop counting. Coverage becomes Readiness again.', loud: false });
    lines.push({ text: 'Changing structure won\'t need a reason.', loud: false });
    lines.push({ text: `To go live again, every draft must be decided: ${draftsAfter ? `${draftsAfter} ${draftsAfter === 1 ? 'is' : 'are'} waiting` : 'none are waiting'}.`, loud: true });
    blockersAfter.filter((b) => b.id !== 'drafts').forEach((b) => lines.push({ text: `Also blocking: ${b.text}`, loud: false }));
    return { activeTriggers, openIssues, tasksUpcoming, tasksDueNext7, tasksOpen, draftsAfter, blockersAfter, lines, title: `Return ${plantName(key)} to Commissioning?`, head: 'From now on:', note: 'Needs a reason. Global Admin, Full Admin or Technical Admin can return a plant.', reasonLabel: 'Why it goes back', placeholder: 'For example: aeration grid retrofit, two weeks', buttons: ['Not yet', 'Return to Commissioning'] };
  }

  /* ════════════════════ Coverage (the Live home) ════════════════════ */
  function coverage(key) {
    return cached(`cov:${key}`, () => {
      const P = PS(key); const d = dOf(key); if (!P || !d) return null;
      const gl = P.goLiveAt != null ? P.goLiveAt : P.since; const from = Math.max(gl, now() - 7 * DAY); const days = Math.max(1, (now() - from) / DAY);
      const label = gl > now() - 7 * DAY ? 'Issues since go-live' : 'Issues, last 7 days';
      const inWin = P.issues.filter((i) => i.opened >= from && i.opened <= now()); const closed = inWin.filter((i) => i.status === 'closed'); const fa = closed.filter((i) => i.falseAlarm);
      const act0 = activeIssueTriggers(key);
      const perTrigger = act0.map((a) => {
        const list = inWin.filter((i) => i.alertId === a.id); const cl = list.filter((i) => i.status === 'closed'); const mm = cl.length ? Math.round(_.median(cl.map((i) => (i.closed - i.opened) / MIN))) : null;
        const latest = list.length ? Math.max(...list.map((i) => i.opened)) : null;
        return { alertId: a.id, name: tName(key, a.id), issues: list.length, perDay: r1(list.length / days), perDayText: rateText(list.length / days), falseAlarmShare: cl.length ? Math.round((cl.filter((i) => i.falseAlarm).length / cl.length) * 100) / 100 : null, medianCloseMin: mm, open: list.filter((i) => i.status !== 'closed').length, latest, noisy: list.length / days > 10 };
      }).sort((x, y) => y.issues - x.issues || (x.latest != null && y.latest != null ? x.latest - y.latest : 0) || (x.name < y.name ? -1 : 1));
      const top = perTrigger.find((x) => x.issues > 0) || null;
      const bp = bindingsPass(key); const waiting = bp.open ? bp.counts.waiting : 0;
      const dc = fnOf('deviationCounts') ? safe(() => V.deviationCounts(key), null) : null;
      const deviations = dc ? { ...dc, reviewPassed: dc.pastReview } : { overrides: S().overrides.filter((o) => o.plant === key && !o.endedAt && (o.status == null || o.status === 'active')).length, baseMoved: 0, pastReview: 0, reviewPassed: 0 };
      const gaps = checklist(key).gaps.map((g) => (g.id === 'nopm' && g.coverageText ? { ...g, text: g.coverageText } : g));
      const share = closed.length ? Math.round((fa.length / closed.length) * 100) / 100 : null;
      return {
        state: P.state, since: gl, window: { from, to: now(), days, label },
        triggers: { active: act0.length, drafts: waiting, issues: inWin.length, closed: closed.length, falseAlarms: fa.length, falseAlarmShare: share, falseAlarmText: share == null ? '—' : `${Math.round(share * 100)}%`, closedText: closed.length ? `${fa.length} of ${closed.length} closed` : 'none closed yet', noisiest: top ? { alertId: top.alertId, name: top.name, issues: top.issues } : null, draftsText: `Drafts in the review queue: ${waiting}`, draftsLink: `#/p/${key}/review/bindings?show=undecided`, draftsLinkText: 'Open the bindings pass' },
        deviations, deviationsLink: `#/p/${key}/deviations`, blindSpots: { placeholder: true, text: BLIND_SPOTS }, gaps, gapsEmpty: gaps.length ? null : 'No gaps.',
        perTrigger, alerts: perTrigger.map((x) => ({ ...x, firesPerDay: x.perDay, state: 'active' })),
        returnCard: { text: 'For a retrofit or a long shutdown. Every Trigger goes back to trial firings, Emergencies included: nothing is sent until the plant goes live again.', button: 'Return to Commissioning…' },
        freshText: now() - gl < DAY && now() >= gl ? `${plantName(key)} went live ${fmt(gl)}. Counts start at go-live.` : null, sample: true,
      };
    });
  }

  /* ════════════════════ the seed ════════════════════ */
  const PHONE_BASE = { vedanta: 10000, manesar: 20000, bawal: 30000 };
  const SEED_DATES = { vedanta: { at: '2026-10-23T11:40', by: 'Satyadev Singh', dates: [['v_bl1', '2026-10-19'], ['v_bl2', '2026-10-19'], ['v_p1', '2026-10-20'], ['v_p2', '2026-10-20']] } };
  _.onSeed('after', () => {
    ORDER.forEach((key) => {
      const P = PS(key); const d = dOf(key); if (!P || !d) return;
      P.routing = P.routing || { hooter: true }; P.serviceDates = {}; P.returned = arr(P.returned);
      P.goLives = P.state === 'live' ? [{ at: P.since, commissioningSince: null }] : [];
      /* phones: a number in the fictional +91 90000 range for everyone on a roster who can be told */
      const base = PHONE_BASE[key];
      d.people.forEach((p, i) => {
        if (p.grant === 'fullsite') p.grant = 'full';
        const ph = p.phone || (p.phone = { verified: false, channel: null });
        if (base && p.role !== 'regular') ph.number = `+91 90000 ${base + i + 1}`; else if (ph.number === undefined) ph.number = null;
        ph.codeSentAt = null; ph.verifiedAt = ph.verified ? (key === 'vedanta' ? T('2026-10-23T10:05') : P.since) : null;
        if (!ph.verified && ph.channel === undefined) ph.channel = null;
      });
    });
    /* Vedanta: the last service dates entered during commissioning */
    Object.entries(SEED_DATES).forEach(([key, x]) => {
      const P = PS(key); if (!P || !dOf(key)) return; const at = T(x.at);
      x.dates.forEach(([id, iso]) => { if (_.eqRaw(key, id)) P.serviceDates[id] = { date: dayStart(iso), at, by: x.by }; });
      const groups = []; x.dates.forEach(([id, iso]) => { if (!_.eqRaw(key, id)) return; let g = groups.find((y) => y.iso === iso); if (!g) groups.push(g = { iso, tags: [] }); g.tags.push(tagOf(key, id)); });
      if (groups.length) act(at, key, `Last service dates entered for ${joinAnd(groups.map((g) => `${g.tags.join(', ')} (${fmtDay(dayStart(g.iso))})`))}`, 'config', x.by);
    });
    _.touch();
    /* Vedanta's bindings pass at 10:55, in v7/2's words, with the counts worked out from what the seed accepted */
    const key = 'vedanta'; const P = PS(key);
    if (P && dOf(key)) {
      const rows = passRows(key); const acc = rows.filter((r) => r.decided === 'accepted'); const ni = acc.filter((r) => r.outcome === 'issue').length; const nt = acc.length - ni;
      const left = rows.filter((r) => r.status === 'undecided' || r.status === 'cantResolve');
      const text = `Bindings pass: accepted ${acc.length} and started the trial (${ni} raise${ni === 1 ? 's' : ''} Issues, ${nt} create${nt === 1 ? 's' : ''} Tasks).${left.length ? ` ${joinAnd(left.map((r) => r.name))} left undecided while the biology settles.` : ''} Commissioning: nothing is sent.`;
      if (!_.replaceActivity(key, (x) => /^Accepted what the library brings/.test(x.text), { text, kind: 'config' })) act(T('2026-10-23T10:55'), key, text, 'config', 'Satyadev Singh');
    }
    _.touch();
  });

  /* ── hooks ──────────────────────────────────────────────────────────────────────────────────── */
  _.hook('firstDue', firstDueAt);
  _.hook('dueAfterChange', dueAfter);

  /* ── exports ────────────────────────────────────────────────────────────────────────────────── */
  Object.assign(V, {
    setAlertState, activate, leaveInactive, activatePreview,
    trialFirings, trialStats, trialTable, isNoisy,
    bindingsPass, decide, acceptAllFor, undoDecision, allBoundPreview,
    checklist, goLivePreview, goLive, goLiveTasks, firstDueAt, returnPreview, returnToCommissioning, cadenceDueNow, dueAfter,
    people, reachability, addPerson, updatePerson, removePreview, removePerson, sendCode, confirmCode, routing, setRouting,
    serviceDates, setServiceDate, coverage,
  });
  /* this file's internals, for the tests (never for page code) */
  V.__commission = { passRows, rowByPid, limitGapsOf, followersOf, countFromDue, trialWindowOf, liveRate, tName, slug };
})();
