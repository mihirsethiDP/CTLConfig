/* Runtime: what the configuration becomes once the plant runs. Records (issues and tasks), the
   notification pipeline, a clock you can advance, maintenance mode, sensor faults, and the planning
   arithmetic behind the Maintenance page. Simulated, in memory, per plant (d.rt). Loaded after app.js.
   v6: schedules every few hours (unit 'hour', due at a time of day: nextAt); an issue reported from the RCA file's list opens
   with that issue's diagnostic, like an alert's; a fix step that names a general task opens the task's steps and comes back. */
window.CTL_RT = (function () {
  'use strict';
  const C = window.CTL;
  const { S, D, eq, sensor, flow, cause, alertById, schedById, workById, subjectName, subjectTier, sensorHome, sensorsOf, limitsOfAlert, SEVS, SEV_LABEL, SEV_CLOCK, WT_LABEL, taskClocks, ops, leads, seniors, siteAdmins, uid, plural, audit, fmtH } = C;
  const BASE = Date.parse('2026-10-05T09:00:00+05:30');          // the clock starts here, Monday 09:00
  const rt = () => { const d = D(); if (!d.rt) d.rt = { records: [], messages: [], offset: 0 }; return d.rt; };
  const now = () => rt().offset;                                   // minutes since BASE (can be negative for seeded history)
  const minuteOfDay = (min) => (((540 + (min == null ? now() : min)) % 1440) + 1440) % 1440;
  const fmtClock = (min) => { const t = new Date(BASE + (min == null ? now() : min) * 60000); return t.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }); };
  const fmtAgo = (min) => { const dm = now() - min; if (dm < 1) return 'just now'; if (dm < 60) return `${Math.round(dm)} min ago`; if (dm < 1440) return `${Math.round(dm / 60 * 10) / 10} h ago`; return `${Math.round(dm / 1440 * 10) / 10} d ago`; };
  const fmtLeft = (min) => { if (min <= 0) return 'now'; if (min < 60) return `${Math.round(min)} min`; if (min < 1440) return `${Math.round(min / 60 * 10) / 10} h`; return `${Math.round(min / 1440 * 10) / 10} d`; };
  const dateMin = (iso) => Math.round((Date.parse(iso + 'T06:00:00+05:30') - BASE) / 60000);
  const SEV_RANK = { emergency: 4, major: 3, minor: 2, caution: 1 };
  /* when a schedule is due, in minutes on the clock: its date at 06:00, or, for one due every few hours, its date at nextAt. Work due
     on run hours (basis 'meter' with a run-hours reading) is never on the clock: its every-n-hours is only an estimate. */
  const hourly = (sc) => !C.runsOnMeter(sc) && !!sc.every && sc.every.unit === 'hour';
  /* run-hours work, estimated: the hours left on the meter at the planning rate of 20 run-hours a day */
  const RUN_RATE = 20;
  const hoursLeft = (sc) => { const m = sensor(sc.meter.tag); return m ? Math.max(0, sc.meter.hours - (m.reading - (sc.meter.last || 0))) : sc.meter.hours; };
  const hm = (s) => { const m = String(s || '').match(/^(\d\d):(\d\d)/); return m ? +m[1] * 60 + +m[2] : 360; };
  const dueMin = (sc) => dateMin(sc.nextDue) + (hourly(sc) && sc.nextAt ? hm(sc.nextAt) - 360 : 0);
  const dueKey = (sc) => sc.nextDue + (hourly(sc) && sc.nextAt ? ' ' + sc.nextAt : '');
  /* a clock minute as the plant's date and time of day (IST) */
  const istAt = (min) => { const iso = new Date(BASE + min * 60000 + 330 * 60000).toISOString(); return { date: iso.slice(0, 10), at: iso.slice(11, 16) }; };

  /* ── the pipeline: who is told, on what channel, and when it is held ─────────────────────── */
  const channelOf = (p) => !p.phone.verified ? 'inapp' : p.phone.channel === 'wa' ? 'whatsapp' : 'sms';
  const quietWindow = (p) => { if (!p.quiet || p.quiet === 'off') return null; const m = p.quiet.match(/(\d\d):(\d\d)\D+(\d\d):(\d\d)/); if (!m) return null; return { from: +m[1] * 60 + +m[2], to: +m[3] * 60 + +m[4], toText: `${m[3]}:${m[4]}` }; };
  const inQuiet = (p) => { const q = quietWindow(p); if (!q) return false; const t = minuteOfDay(); return q.from > q.to ? (t >= q.from || t < q.to) : (t >= q.from && t < q.to); };
  function send(rec, to, channel, text, opts) { const m = { id: uid('m'), at: now(), to: to ? to.id : null, name: to ? to.name : (opts && opts.name) || 'Plant', role: to ? to.role : null, channel, text, recordId: rec ? rec.id : null, held: (opts && opts.held) || null }; rt().messages.unshift(m); if (rec) (rec.told = rec.told || []).push(m.id); return m; }
  function tell(rec, people, kind, text, sev) {
    const seen = new Set();
    people.forEach((p) => { if (seen.has(p.id)) return; seen.add(p.id); let ch = kind === 'phone' ? channelOf(p) : kind; let held = null;
      if (sev === 'major' && ch !== 'inapp' && ch !== 'alarm') { if (p.major === 'email') ch = 'email'; else if (p.major === 'off') return; }
      if ((sev === 'minor' || sev === 'caution' || !sev) && (ch === 'whatsapp' || ch === 'sms') && inQuiet(p)) held = `held until ${quietWindow(p).toText} (quiet hours)`;
      send(rec, p, ch, text, { held }); });
  }
  const everyone = () => [...ops(), ...leads(), ...seniors()];
  const seniorsOr = () => seniors().length ? seniors() : leads();
  function notifyIssue(rec, rung) {
    const d = D(), sev = rec.severity, s = rec.sensorId ? sensor(rec.sensorId) : null, c = rec.clocks;
    const base = `${SEV_LABEL[sev]} · ${rec.title} · ${subjectName(rec.subject)}${s && rec.reading != null ? ` · ${s.name} ${s.kind === 'status' ? (rec.reading ? 'ON' : 'OFF') : rec.reading + ' ' + s.unit}` : ''}`;
    if (sev === 'emergency') {
      if (rung === 0) { tell(rec, everyone(), 'call', `${base} · Start now`, sev); tell(rec, everyone(), 'alarm', `Full-screen alarm: ${rec.title}`, sev); if (d.plant.hooter.on) send(rec, null, 'hooter', `Hooter sounds for ${d.plant.hooter.seconds} s`, { name: 'Plant hooter' }); }
      if (rung === 1) tell(rec, [...leads(), ...seniors()], 'call', `${base} · Not started in ${fmtH(c.start / 60)}`, sev);
      if (rung === 2) { tell(rec, everyone(), 'call', `${base} · Not fixed in ${fmtH(c.deadline / 60)}`, sev); tell(rec, siteAdmins(), 'email', `${base} · past its deadline`, sev); }
    } else if (sev === 'major') {
      if (rung === 0) { tell(rec, [...ops(), ...leads()], 'phone', `${base} · Start within ${fmtH(c.start / 60)}`, sev); tell(rec, [...ops(), ...leads()], 'alarm', `Full-screen alarm: ${rec.title}`, sev); }
      if (rung === 1) tell(rec, leads(), 'phone', `${base} · Nobody has started`, sev);
      if (rung === 2) { tell(rec, seniorsOr(), 'phone', `${base} · Not fixed in ${fmtH(c.deadline / 60)}`, sev); tell(rec, siteAdmins(), 'email', `${base} · past its deadline`, sev); }
    } else if (sev === 'minor') {
      if (rung === 0) { tell(rec, ops(), 'phone', `${base} · Start within ${fmtH(c.start / 60)}`, sev); tell(rec, leads(), 'inapp', base, sev); }
      if (rung === 1) tell(rec, leads(), 'phone', `${base} · Nobody has started`, sev);
      if (rung === 2) { tell(rec, seniorsOr(), 'phone', `${base} · Not fixed in ${fmtH(c.deadline / 60)}`, sev); tell(rec, siteAdmins(), 'email', `${base} · past its deadline`, sev); }
    } else if (rung === 0) { tell(rec, [...ops(), ...leads()], 'inapp', base, sev); tell(rec, [...ops(), ...leads()], 'email', `Morning email: ${base}`, sev); }
    if (rung === 3) tell(rec, [...everyone(), ...siteAdmins()], 'phone', `${base} · Twice overdue`, sev);
  }
  function notifyTask(rec, rung) {
    const loud = rec.tier === 'A' || rec.statutory; const base = `Task · ${rec.title} · ${subjectName(rec.subject)}${rec.workType === 'pm' ? ' · preventive' : rec.workType === 'calibration' ? ' · calibration' : rec.workType === 'test' ? ' · manual testing' : ''}`;
    if (rung === 0) { tell(rec, ops(), 'inapp', `${base} · due ${rec.statutory ? 'today (statutory)' : 'now'}`); tell(rec, ops(), 'email', `Morning email: ${base}`); }
    if (rung === 1) tell(rec, ops(), loud ? 'phone' : 'inapp', `${base} · Not started`);
    if (rung === 2) { tell(rec, [...ops(), ...leads()], 'phone', `${base} · Overdue`); if (loud) tell(rec, seniors(), 'phone', `${base} · Overdue`); }
    if (rung === 3) tell(rec, [...everyone(), ...siteAdmins()], 'phone', `${base} · Twice overdue`);
  }
  function notifyApproval(rec, rung) { const base = `Approval waiting: ${rec.title} · ${subjectName(rec.subject)}`; if (rung === 0) tell(rec, leads(), 'phone', base); if (rung === 1) tell(rec, leads(), 'phone', base + ' · still waiting'); if (rung === 2) tell(rec, seniorsOr(), 'phone', base + ' · overdue'); }

  /* ── records ────────────────────────────────────────────────────────────────────────────── */
  const log = (rec, text) => rec.log.push({ at: now(), text });
  const issueClocks = (a, sev) => { const c = a && a.clocks ? [a.clocks.response, a.clocks.deadline] : SEV_CLOCK[sev]; return { start: (c[0] || 0) * 60, deadline: (c[1] || 0) * 60 }; };
  /* the deepest tier a reading has crossed. A measured reading crosses when it passes a limit; a status reading (0/1, incl) when
     it reaches it: a trip contact at 1 with a limit of 1 has tripped. */
  const crossedSev = (lim, dir, v, incl) => SEVS.slice().reverse().find((k) => lim[k] != null && (dir === 'below' ? (incl ? v <= lim[k] : v < lim[k]) : (incl ? v >= lim[k] : v > lim[k]))) || null;
  const shownAs = (s, v) => s.kind === 'status' ? (v ? 'ON' : 'OFF') : `${v} ${s.unit}`;
  const gateOk = (a) => { if (!a.gate || !a.gate.sensor) return true; const g = sensor(a.gate.sensor); if (!g) return true; if (g.kind === 'status') return (a.gate.op === 'on') === !!g.reading; return a.gate.op === 'above' ? g.reading > a.gate.value : g.reading < a.gate.value; };
  const gateText = (a) => { if (!a.gate || !a.gate.sensor) return ''; const g = sensor(a.gate.sensor); if (!g) return ''; return `${g.name} on ${(sensorHome(g) || { tag: 'the plant' }).tag} is ${g.kind === 'status' ? a.gate.op.toUpperCase() : a.gate.op + ' ' + a.gate.value + ' ' + g.unit}`; };
  function fireAlert(alertId, value) {
    const a = alertById(alertId); const { lim, dir, s } = limitsOfAlert(a); const home = sensorHome(s) || { name: D().plant.name || 'The plant', tag: '' };
    if (a.status !== 'active') return { refused: `${a.name} is ${a.status}; it cannot fire.` };
    if (s.nextPhase) return { refused: `${s.name} is read on a connection. It waits for the next phase and raises nothing yet.` };
    if (s.kind !== 'status' && (value < s.valid[0] || value > s.valid[1])) { const sf = sensorFault(s, 'reading outside the valid range', null, value); return { refused: `Refused as a sensor fault: ${s.name} cannot read ${value} ${s.unit}. The Technical Admin and the Lead are told; ${s.name}'s alerts are paused.`, record: sf }; }
    if (s.state === 'not_trusted') return { refused: `${s.name} is not trusted since ${fmtAgo(s.fault ? s.fault.at : now())}. Its alerts stay paused until the Technical Admin marks it trusted again.` };
    if (home.maintenance) return { refused: `${home.name} is in maintenance mode (${home.maintenance.reason}). Its alerts are paused until it is brought back online.` };
    if (!gateOk(a)) return { refused: `Gated: the alert only counts while ${gateText(a)}, and it is not. Nothing raised.` };
    s.reading = value; if (s.state === 'stale') s.state = 'live';
    const sev = crossedSev(lim, dir, value, s.kind === 'status');
    const open = rt().records.find((r) => r.kind === 'issue' && r.alertId === a.id && r.status !== 'closed');
    if (!sev) { if (open && a.closes.mode === 'sensor' && (dir === 'below' ? value >= a.closes.back : value <= a.closes.back)) { closeRecord(open, 'resolved', `${s.name} back at ${value} ${s.unit}: the sensor closed it`); return { closed: open }; } return { nothing: open ? (a.closes.mode === 'sensor' ? `${shownAs(s, value)} is inside the limits but not yet past the closing threshold (${a.closes.back} ${s.unit}); the issue stays open.` : `${s.name} is ${shownAs(s, value)}; the issue stays open until someone closes it.`) : s.kind === 'status' ? `${s.name} is ${shownAs(s, value)}. Nothing happens.` : `${value} ${s.unit} is inside every limit. Nothing happens.` }; }
    if (open) { if (SEV_RANK[sev] > SEV_RANK[open.severity]) { open.severity = sev; open.clocks = issueClocks(a, sev); open.rungs = [0]; open.reading = value; log(open, `Promoted to ${SEV_LABEL[sev]}: ${s.name} ${value} ${s.unit}; the ladder restarts`); notifyIssue(open, 0); return { promoted: open }; } open.reading = value; log(open, `${s.name} ${value} ${s.unit}, still ${SEV_LABEL[open.severity]}`); return { stillOpen: open }; }
    const rec = { id: uid('r'), kind: 'issue', title: a.name, subject: a.subject, eqId: home.id || null, alertId: a.id, sensorId: s.id, reading: value, severity: sev, status: 'open', openedAt: now(), startedAt: null, closedAt: null, clocks: issueClocks(a, sev), rungs: [0], flowId: a.flow || null, cause: a.cause || null, verify: !!a.verify, log: [], run: null, proof: null, ...(C.alertIssue(a) ? { issue: C.alertIssue(a) } : {}) };
    rt().records.unshift(rec); a.open = (a.open || 0) + 1; log(rec, `Opened as ${SEV_LABEL[sev]}: ${s.name} ${shownAs(s, value)}`); notifyIssue(rec, 0); return { opened: rec };
  }
  function dueTask(scheduleId, at) { const sc = schedById(scheduleId); const tier = sc.statutory ? 'A' : subjectTier(sc.subject); const c = taskClocks(sc, tier); const rec = { id: uid('r'), kind: 'task', title: sc.name, subject: sc.subject, eqId: sc.subject.kind === 'eq' ? sc.subject.id : null, scheduleId: sc.id, workType: sc.workType, tier, statutory: !!sc.statutory, status: 'open', openedAt: at == null ? now() : at, dueAt: at == null ? now() : at, startedAt: null, closedAt: null, clocks: { start: Math.round(c.start * 60), deadline: Math.round(c.deadline * 60) }, rungs: [0], flowId: sc.flow || null, cause: sc.cause || null, verify: !!sc.verify, probe: sc.probe || null, log: [], run: null, proof: null, dueReason: sc.basis === 'meter' ? 'meter' : 'calendar' }; rt().records.unshift(rec); sc.open = (sc.open || 0) + 1; sc.lastEmitted = dueKey(sc); log(rec, `Due: ${(WT_LABEL[sc.workType] || 'Routine check').toLowerCase()}${sc.cause && cause(sc.cause) ? ' · logs against ' + cause(sc.cause).name : ''}`); notifyTask(rec, 0); return rec; }
  /* a condition job starts on a reading on the equipment, on a machine that is working: never on a reading that waits for
     connections, never while the machine is in maintenance mode */
  function dueWork(workId, value) { const w = workById(workId); const s = sensor(w.sensor); if (!s) return { refused: `${w.name} has no reading to start on.` }; if (s.nextPhase) return { refused: `${s.name} is read on a connection; it waits for the next phase.` }; const home = w.subject && w.subject.kind === 'eq' ? eq(w.subject.id) : null; if (home && home.maintenance) return { refused: `${home.name} is in maintenance mode (${home.maintenance.reason}). Its jobs wait until it is brought back online.` }; if (value != null) s.reading = value; const open = rt().records.find((r) => r.workId === w.id && r.status !== 'closed'); if (open) { log(open, `${s.name} ${s.reading} ${s.unit}, still asked for`); return { stillOpen: open }; } if (s.reading <= w.doWhen) return { nothing: `${s.reading} ${s.unit} is below ${w.doWhen}; the plant is not asking for the job.` }; const tier = subjectTier(w.subject); const hrs = { A: 8, B: 24, C: 72 }[tier]; const rec = { id: uid('r'), kind: 'task', title: w.name, subject: w.subject, eqId: w.subject.id, workId: w.id, workType: 'condition', tier, status: 'open', openedAt: now(), dueAt: now(), clocks: { start: hrs * 30, deadline: hrs * 60 }, rungs: [0], flowId: w.flow || null, cause: w.cause || null, verify: false, sensorId: s.id, reading: s.reading, log: [], run: null, proof: null }; rt().records.unshift(rec); w.open = (w.open || 0) + 1; log(rec, `${s.name} ${s.reading} ${s.unit} crossed ${w.doWhen}: the plant asks for the job`); notifyTask(rec, 0); return { opened: rec }; }

  /* ── the clock ──────────────────────────────────────────────────────────────────────────── */
  function tick(minutes) {
    rt().offset += minutes; const d = D();
    rt().records.filter((r) => r.status !== 'closed').forEach((r) => { const age = now() - r.openedAt;
      if (r.status === 'awaiting_verification') { const w = now() - (r.awaitingAt == null ? now() : r.awaitingAt); [[1, r.clocks.start || 60], [2, (r.clocks.start || 60) * 3]].forEach(([rung, at]) => { if (w >= at && !r.rungs.includes('v' + rung)) { r.rungs.push('v' + rung); notifyApproval(r, rung); } }); return; }
      const n = r.kind === 'issue' ? notifyIssue : notifyTask;
      if (r.status === 'open' && r.clocks.start && age >= r.clocks.start && !r.rungs.includes(1)) { r.rungs.push(1); log(r, 'Not started in time'); n(r, 1); }
      if (r.clocks.deadline && age >= r.clocks.deadline && !r.rungs.includes(2)) { r.rungs.push(2); log(r, 'Past its deadline'); n(r, 2); }
      if (r.clocks.deadline && age >= r.clocks.deadline * 2 && !r.rungs.includes(3)) { r.rungs.push(3); n(r, 3); } });
    d.schedules.filter((s) => s.status === 'active').forEach((s) => { const due = dueMin(s); if (due <= now() && s.lastEmitted !== dueKey(s) && !rt().records.some((r) => r.scheduleId === s.id && r.status !== 'closed')) dueTask(s.id, due); });
    d.equipment.filter((e) => e.maintenance && !e.maintenance.overdueTold && now() >= e.maintenance.since + e.maintenance.hours * 60).forEach((e) => { e.maintenance.overdueTold = true; tell(null, leads(), 'inapp', `${e.name} has been in maintenance mode longer than planned (${e.maintenance.hours} h). Bring it back online or extend.`); });
  }

  /* ── working a record ───────────────────────────────────────────────────────────────────── */
  const fixFor = (causeId) => { const c = cause(causeId); return c && c.fix && flow(c.fix) ? flow(c.fix) : null; };
  const firstStep = (f) => f && f.steps[0] ? f.steps[0].id : null;
  function initRun(rec) { if (rec.kind === 'issue') { if (rec.cause && !rec.flowId) { const fx = fixFor(rec.cause); return fx ? { phase: 'fix', flowId: fx.id, stepIdx: 0 } : { phase: 'proof' }; } if (rec.flowId && flow(rec.flowId)) return { phase: 'diagnose', flowId: rec.flowId, stepId: firstStep(flow(rec.flowId)) }; return { phase: 'proof' }; } return rec.flowId && flow(rec.flowId) ? { phase: 'fix', flowId: rec.flowId, stepIdx: 0 } : { phase: 'proof' }; }
  function startRecord(rec, who) { rec.status = 'in_progress'; rec.startedAt = now(); rec.by = who; log(rec, `${who} started`); rec.run = initRun(rec); return rec.run; }
  const curStep = (rec) => { const r = rec.run; if (!r || !r.flowId) return null; const f = flow(r.flowId); if (!f) return null; if (r.phase === 'diagnose') return f.steps.find((s) => s.id === r.stepId) || null; return f.steps[r.stepIdx] || null; };
  const boundSensor = (rec, st) => { if (st.sensor && sensor(st.sensor)) return sensor(st.sensor); if (!st.sensorKind) return null; const live = (x) => !x.nextPhase && x.name === st.sensorKind; if (rec.eqId) return sensorsOf({ kind: 'eq', id: rec.eqId }).find(live) || null; return D().sensors.find((x) => live(x) && !String(x.on || '').startsWith('eq:')) || null; };
  const said = (st) => String(st.text || '').replace(/[.\s]+$/, '');
  function answer(rec, key, value) {
    const r = rec.run, st = curStep(rec); if (!st) return { finished: true }; const f = flow(r.flowId);
    if (key === 'cannot') { if (st.type !== 'reading') return { refused: 'Only a reading can be marked as not readable.' }; log(rec, `${said(st)}: could not be read`); if (r.phase === 'diagnose') { r.phase = 'proof'; return { unread: true }; } }
    else if (st.type === 'reading') { const s = boundSensor(rec, st); if (value == null || Number.isNaN(value)) return { refused: 'Enter the reading.' }; if (s && s.kind !== 'status' && (value < s.valid[0] || value > s.valid[1])) { log(rec, `${said(st)}: ${value} refused, outside ${s.valid[0]}–${s.valid[1]} ${s.unit}`); return { refused: `${s.name} cannot read ${value} ${s.unit}. Look again, or report the sensor.` }; } if (s) s.reading = value; log(rec, `${said(st)}: ${value}${s ? ' ' + s.unit : ''}`); }
    else if (st.type === 'question') log(rec, `${said(st)}: ${key}`);
    else if (st.type === 'wait') log(rec, key === 'skip' ? `${said(st)}: skipped (${value || 'no reason given'})` : `${said(st)}: waited ${st.minutes} min`);
    else { log(rec, `${said(st)}: done${st.photo === 'required' || value === 'photo' ? ' · photo' : ''}${st.approve ? (key === 'signed' ? ' · signed by the Lead' : ' · needs the Lead\'s signature') : ''}`); if (st.approve && key !== 'signed') rec.needsVerify = true; }
    if (r.phase === 'diagnose') { const dest = st.type === 'reading' ? (value > st.split ? st.answers.Above : st.answers.Below) : st.answers[key]; if (!dest || dest.t === 'open') { log(rec, dest && dest.text ? dest.text : 'The flow has no answer here. Tell the Lead.'); r.phase = 'proof'; return { open: true, ...(dest && dest.text ? { text: dest.text } : {}) }; } if (dest.t === 'cause') return conclude(rec, dest.id); r.stepId = dest.id; return { next: curStep(rec) }; }
    r.stepIdx++; if (r.stepIdx >= f.steps.length) { if (r.back) return leaveTask(rec, true); r.phase = 'proof'; return { finished: true }; } return { next: curStep(rec) };
  }
  /* A fix step that names a general task (link kind 'task') opens that task's steps inside the record; finishing them, or
     leaving early, comes back to the same fix step, which the operator then marks done. One level deep. */
  /* a step's links: st.links when it names several, else st.link */
  const linksOf = (st) => !st ? [] : st.links && st.links.length ? st.links : st.link ? [st.link] : [];
  const taskOfStep = (st, id) => { const l = linksOf(st).find((x) => x.kind === 'task' && (!id || x.id === id)); return l ? C.taskById(l.id) : null; };
  function openTask(rec, taskId) { const r = rec.run, st = curStep(rec); if (!r || r.phase !== 'fix' || r.back) return { refused: 'Open a task from a step of the fix.' }; const tk = taskOfStep(st, taskId); const tf = tk && tk.flow ? flow(tk.flow) : null; if (!tf || !tf.steps.length) return { refused: 'That task has no steps here.' }; rec.run = { phase: 'fix', flowId: tf.id, stepIdx: 0, task: tk.id, back: { ...r } }; log(rec, `Opened the task: ${tk.name}`); return { task: tk, next: curStep(rec) }; }
  function leaveTask(rec, finished) { const r = rec.run; if (!r || !r.back) return { refused: 'No task is open.' }; const tk = C.taskById(r.task); rec.run = r.back; if (finished) (rec.run.followed = rec.run.followed || []).push(r.task); log(rec, finished ? `Followed the task: ${tk ? tk.name : r.task}` : `Back to the fix without finishing the task${tk ? ': ' + tk.name : ''}`); return { returned: tk, finished: !!finished, next: curStep(rec) }; }
  function conclude(rec, causeId) { const c = cause(causeId); rec.cause = causeId; log(rec, `Diagnosed: ${c.name}`); if (c.sensorFault && rec.sensorId && sensor(rec.sensorId)) return sensorWrong(rec, 'calibration', causeId); if (c.noFault) { closeRecord(rec, 'no_fault', 'Closed: no fault found, reading verified normal'); return { closed: true }; } const fx = c.fix ? flow(c.fix) : null; if (fx) { rec.run = { phase: 'fix', flowId: fx.id, stepIdx: 0 }; return { fix: fx }; } rec.run = { phase: 'proof' }; return { noFix: c }; }
  function knowReason(rec, causeId, who) { if (rec.status === 'open') startRecord(rec, who); log(rec, 'Skipped the diagnostic: I know the reason'); return conclude(rec, causeId); }
  function notThat(rec) { log(rec, 'That is not it: back to the diagnostic'); rec.cause = null; rec.run = rec.flowId && flow(rec.flowId) ? { phase: 'diagnose', flowId: rec.flowId, stepId: firstStep(flow(rec.flowId)) } : { phase: 'proof' }; }
  function finish(rec, proof, who) { rec.proof = proof || {}; if (rec.verify || rec.needsVerify) { rec.status = 'awaiting_verification'; rec.awaitingAt = now(); rec.rungs.push('v0'); log(rec, `${who} finished${proof && proof.note ? ': ' + proof.note : ''}; waiting for a Lead`); notifyApproval(rec, 0); return { awaiting: true }; } closeRecord(rec, 'done', `${who} closed it${proof && proof.note ? ': ' + proof.note : ''}${proof && proof.photo ? ' · photo' : ''}`); return { closed: true }; }
  function verify(rec, who, ok) { if (ok) { log(rec, `${who} verified`); closeRecord(rec, 'done', 'verified and closed'); } else { rec.status = 'in_progress'; rec.needsVerify = false; log(rec, `${who} sent it back`); rec.run = { phase: 'proof' }; } }
  function closeRecord(rec, how, note) {
    rec.status = 'closed'; rec.closedHow = how; rec.closedAt = now(); log(rec, note);
    if (rec.alertId) { const a = alertById(rec.alertId); if (a) a.open = Math.max(0, (a.open || 0) - 1); }
    if (rec.scheduleId) { const sc = schedById(rec.scheduleId); if (sc) { sc.open = Math.max(0, (sc.open || 0) - 1); if (how === 'done') { const late = now() > rec.dueAt + rec.clocks.deadline; (sc.history = sc.history || []).push({ due: sc.nextDue, done: true, late, leg: rec.dueReason || sc.basis, at: now() }); if (sc.meter) { const m = sensor(sc.meter.tag); if (m) sc.meter.last = m.reading; } moveOn(sc); } } }
    if (rec.workId) { const w = workById(rec.workId); if (w) w.open = Math.max(0, (w.open || 0) - 1); }
    if (rec.eqId && how === 'done') { const e = eq(rec.eqId); if (e) (e.history = e.history || []).unshift({ at: now(), what: rec.kind === 'task' ? rec.title : `Issue closed: ${rec.title}${rec.cause && cause(rec.cause) ? ' · ' + cause(rec.cause).name : ''}`, who: rec.by || '' }); }
  }
  /* the next due date; a schedule every few hours moves on by the clock and keeps its time of day (nextAt) */
  function moveOn(sc) { if (C.runsOnMeter(sc)) { const today = istAt(now()).date; let at = istAt(now() + hoursLeft(sc) / RUN_RATE * 1440).date; if (at <= today) at = new Date(Date.parse(today + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10); sc.nextDue = at; delete sc.nextAt; return sc.nextDue; }
    if (!hourly(sc)) { sc.nextDue = advance(sc); delete sc.nextAt; return sc.nextDue; } const H = Math.max(1, sc.every.n) * 60; let t = sc.anchor === 'last' ? now() + H : dueMin(sc) + H; if (t <= now()) t += Math.ceil((now() - t + 1) / H) * H; const at = istAt(t); sc.nextDue = at.date; sc.nextAt = at.at; return sc.nextDue; }
  const advance = (sc) => { const step = (t) => { const n = new Date(t); if (sc.every.unit === 'hour') n.setTime(n.getTime() + sc.every.n * 3600000); else if (sc.every.unit === 'day') n.setDate(n.getDate() + sc.every.n); else if (sc.every.unit === 'week') n.setDate(n.getDate() + 7 * sc.every.n); else if (sc.every.unit === 'month') n.setMonth(n.getMonth() + sc.every.n); else n.setFullYear(n.getFullYear() + sc.every.n); return n; }; const nowMs = BASE + now() * 60000; let t = sc.anchor === 'last' ? step(new Date(nowMs)) : step(new Date(Date.parse(sc.nextDue + 'T06:00:00+05:30'))); let guard = 0; while (t.getTime() <= nowMs && guard++ < 400) t = step(t); return t.toISOString().slice(0, 10); };

  /* ── sensor faults, maintenance mode, reports ───────────────────────────────────────────── */
  function sensorFault(s, reason, rec, value, causeId) {
    const d = D(), home = sensorHome(s) || { id: null, tag: 'the plant' }; s.state = 'not_trusted'; s.fault = { reason, at: now() }; const paused = d.alerts.filter((a) => a.sensor === s.id && a.status === 'active').length;
    const sf = { id: uid('r'), kind: 'issue', sensorFault: true, title: `Sensor fault: ${s.name} on ${home.tag}`, subject: home.id ? { kind: 'eq', id: home.id } : { kind: 'plant' }, eqId: home.id, sensorId: s.id, reading: value != null ? value : s.reading, severity: 'minor', status: 'open', openedAt: now(), clocks: { start: 24 * 60, deadline: 72 * 60 }, rungs: [0], flowId: null, cause: causeId && cause(causeId) ? causeId : 'c_probe', verify: false, log: [], run: null, proof: null, reason };
    rt().records.unshift(sf); log(sf, `${reason}. ${plural(paused, 'alert')} on this reading paused; excluded from plant reliability.`);
    const tech = d.people.filter((p) => p.grant === 'tech' || p.grant === 'fullsite'); tell(sf, [...tech, ...leads()], 'phone', `Sensor fault · ${s.name} on ${home.tag} · ${reason} · ${plural(paused, 'alert')} paused`, 'minor');
    if (rec) { rec.cause = causeId && cause(causeId) ? causeId : 'c_probe'; closeRecord(rec, 'sensor_fault', `Closed as a sensor fault (${reason}); not counted against the plant`); }
    audit(`Sensor fault on ${s.name} (${s.tag})`, `${reason} · ${plural(paused, 'alert')} paused`); return sf;
  }
  function sensorWrong(rec, reason, causeId) { const s = rec.sensorId ? sensor(rec.sensorId) : null; if (!s) { closeRecord(rec, 'no_fault', 'Closed: no fault found'); return { closed: true }; } return { sensorFault: sensorFault(s, reason, rec, undefined, causeId) }; }
  function trustAgain(s, who) { s.state = 'live'; delete s.fault; rt().records.filter((r) => r.sensorFault && r.sensorId === s.id && r.status !== 'closed').forEach((r) => closeRecord(r, 'done', `${who}: fixed, and a valid reading recorded`)); audit(`${s.name} (${s.tag}) trusted again`, `${who} · its alerts resume`); }
  const alertsOn = (e) => D().alerts.filter((a) => (sensorHome(sensor(a.sensor)) || {}).id === e.id && a.status === 'active');
  function setMaintenance(e, o, who) { e.maintenance = { reason: o.reason, hours: o.hours, note: o.note || '', since: now(), by: who, suppress: o.suppress || alertsOn(e).map((a) => a.id) }; e.prevStatus = e.status; e.status = 'in_maintenance'; audit(`${e.name} put in maintenance mode by ${who}`, `${o.reason} · ${o.hours} h · ${plural(e.maintenance.suppress.length, 'alert')} paused`); if (e.tier === 'A') tell(null, leads(), 'phone', `${e.name} (tier A) in maintenance mode: ${o.reason}, ${o.hours} h · ${who}`, 'major'); else tell(null, leads(), 'inapp', `${e.name} in maintenance mode: ${o.reason}, ${o.hours} h · ${who}`); }
  function clearMaintenance(e, note, who) { const m = e.maintenance; delete e.maintenance; e.status = e.prevStatus || 'running'; audit(`${e.name} back online by ${who}`, `${note || ''} · in maintenance ${fmtH((now() - m.since) / 60)}`); tell(null, leads(), 'inapp', `${e.name} back online · ${who}${note ? ' · ' + note : ''} · alerts resume, PLC interlocks apply`); (e.history = e.history || []).unshift({ at: now(), what: `Maintenance mode: ${m.reason}`, who, note: note || m.note }); }
  const issueFlow = (id) => { const i = C.issueById(id); return i && i.flow && flow(i.flow) ? i.flow : null; };
  /* The operator picked one of the type's issues (the RCA file): it opens with that issue's diagnostic, walked like an alert's. */
  function reportIssue(e, issueId, sev, who) { const i = C.issueById(issueId); if (!i) return { refused: 'That problem is not in the library.' }; const fid = issueFlow(issueId); const rec = { id: uid('r'), kind: 'issue', manual: true, issue: i.id, title: i.name, subject: { kind: 'eq', id: e.id }, eqId: e.id, severity: sev, status: 'open', openedAt: now(), clocks: issueClocks(null, sev), rungs: [0], flowId: fid, cause: null, verify: sev === 'emergency', log: [], run: null, proof: null, by: who }; rt().records.unshift(rec); log(rec, `Reported by ${who}: ${i.name}`); notifyIssue(rec, 0); return rec; }
  function reportProblem(e, text, sev, who) { const rec = { id: uid('r'), kind: 'issue', manual: true, title: text, subject: { kind: 'eq', id: e.id }, eqId: e.id, severity: sev, status: 'open', openedAt: now(), clocks: issueClocks(null, sev), rungs: [0], flowId: null, cause: null, verify: sev === 'emergency', log: [], run: null, proof: null, by: who }; rt().records.unshift(rec); log(rec, `Reported by ${who}`); notifyIssue(rec, 0); return rec; }

  /* ── ranking: one ladder across issues, maintenance mode and tasks ──────────────────────── */
  const isOverdue = (r) => r.status !== 'closed' && !!r.clocks.deadline && now() - r.openedAt > r.clocks.deadline;
  const lateBy = (r) => now() - r.openedAt - r.clocks.deadline;
  const band = (r) => r.kind === 'issue' ? SEV_RANK[r.severity] : (isOverdue(r) ? 2 : 1);
  const rank = (list) => list.slice().sort((a, b) => band(b) - band(a) || (isOverdue(b) ? 1 : 0) - (isOverdue(a) ? 1 : 0) || (isOverdue(a) && isOverdue(b) ? lateBy(b) - lateBy(a) : 0) || ((a.openedAt + a.clocks.deadline) - (b.openedAt + b.clocks.deadline)) || (a.kind === b.kind ? 0 : a.kind === 'issue' ? -1 : 1));
  const openRecords = () => rt().records.filter((r) => r.status !== 'closed');
  const onMachine = (e) => rt().records.filter((r) => r.eqId === e.id);
  function cardCTA(e) { const open = rank(openRecords().filter((r) => r.eqId === e.id && !r.sensorFault)); const issue = open.find((r) => r.kind === 'issue'); if (issue) return { kind: 'issue', rec: issue, label: issue.status === 'in_progress' ? 'Resume' : issue.status === 'awaiting_verification' ? 'Waiting for a Lead' : 'Start' }; if (e.maintenance) return { kind: 'maint', label: 'Bring back online' }; const task = open.find((r) => r.kind === 'task'); if (task) return { kind: 'task', rec: task, label: task.status === 'in_progress' ? 'Resume task' : task.status === 'awaiting_verification' ? 'Waiting for a Lead' : 'Start task' }; return { kind: 'none', label: 'All clear' }; }
  const upcoming = (days) => D().schedules.filter((s) => s.status === 'active' && !rt().records.some((r) => r.scheduleId === s.id && r.status !== 'closed')).map((s) => ({ s, at: dueMin(s) })).filter((x) => x.at > now() && x.at - now() <= (days || 3) * 1440).sort((a, b) => a.at - b.at);
  const readingState = (s) => { if (s.kind === 'meter' || !s.limits) return null; return crossedSev(s.limits, s.direction, s.reading, s.kind === 'status'); };

  /* ── planning: coverage, compliance by due occurrences, the month, contracts, warnings ──── */
  const complianceOf = (sc) => { const h = sc.history || []; const due = h.length, done = h.filter((x) => x.done).length, onTime = h.filter((x) => x.done && !x.late).length; return { due, done, onTime, pct: due ? Math.round(onTime / due * 100) : null, last3Late: h.length >= 3 && h.slice(-3).every((x) => x.late || !x.done), sameLeg: sc.basis === 'either' && h.length >= 6 && h.slice(-6).every((x) => x.leg === h[h.length - 1].leg) ? h[h.length - 1].leg : null }; };
  const coverage = () => { const d = D(); const need = d.equipment.filter((e) => e.expects.length); const has = need.filter((e) => d.schedules.some((s) => s.subject.kind === 'eq' && s.subject.id === e.id && s.workType !== 'calibration' && s.status === 'active') || d.conditionWork.some((w) => w.subject.id === e.id)); return { need, has, missing: need.filter((e) => !has.includes(e)) }; };
  function planningWarnings() {
    const d = D(), out = []; const cov = coverage();
    cov.missing.forEach((e) => out.push({ level: 'warn', text: `${e.name} has no preventive maintenance scheduled. Its type expects ${e.expects.join(' and ')}.`, link: '#/setup/inherit' }));
    d.schedules.filter((s) => s.status === 'active').forEach((s) => { const c = complianceOf(s); if (s.meter) { const m = sensor(s.meter.tag); if (m && m.state === 'stale') out.push({ level: 'warn', text: `${s.name} on ${subjectName(s.subject)} is due on run-hours and ${m.name} has not reported for 7 days. ${s.basis === 'meter' ? 'Its due date stays an estimate until the meter reports again.' : 'Running on the calendar leg.'}` }); } if (c.last3Late) out.push({ level: 'warn', text: `${s.name} on ${subjectName(s.subject)} has been late three times running. The cadence may be wrong, or nobody owns it.` }); if (c.sameLeg) out.push({ level: 'notice', text: `${s.name} on ${subjectName(s.subject)} has fired on its ${c.sameLeg} leg six times running. The other leg may be set wrong.` }); if (s.subject.kind === 'eq' && eq(s.subject.id) && eq(s.subject.id).maintenance) out.push({ level: 'notice', text: `${s.name}: ${eq(s.subject.id).name} is in maintenance mode; the next occurrence still comes.` }); });
    d.sensors.filter((s) => s.kind === 'analytical' && !s.nextPhase && !d.schedules.some((x) => x.workType === 'calibration' && x.probe === s.id && x.status === 'active')).forEach((s) => out.push({ level: 'warn', text: `${s.name} on ${(sensorHome(s) || { tag: 'the plant' }).tag} has no calibration scheduled.`, link: '#/setup/maintenance' }));
    contracts().forEach((k) => { if (k.daysLeft != null && k.daysLeft <= 30) out.push({ level: k.daysLeft < 0 ? 'warn' : 'notice', text: `${k.vendor}'s contract for ${k.sensor.name} on ${k.home.tag} ${k.daysLeft < 0 ? 'ended ' + Math.abs(k.daysLeft) + ' days ago' : 'ends in ' + k.daysLeft + ' days'}.` }); });
    return out;
  }
  const contracts = () => D().sensors.filter((s) => s.calibration && s.calibration.by === 'vendor').map((s) => { const end = s.calibration.contractEnd ? Date.parse(s.calibration.contractEnd) : null; return { sensor: s, home: sensorHome(s) || { tag: 'the plant', name: 'the plant' }, vendor: s.calibration.vendor || 'Vendor', calEvery: s.calibration.every || 'monthly', cleanEvery: s.calibration.cleanEvery || null, end: s.calibration.contractEnd, daysLeft: end ? Math.round((end - (BASE + now() * 60000)) / 86400000) : null }; });
  function monthPlan(year, month) {
    const d = D(); const first = new Date(Date.UTC(year, month, 1)); const last = new Date(Date.UTC(year, month + 1, 0)); const out = [];
    const step = (t, sc) => { const n = new Date(t); if (sc.every.unit === 'hour') n.setTime(n.getTime() + sc.every.n * 3600000); else if (sc.every.unit === 'day') n.setUTCDate(n.getUTCDate() + sc.every.n); else if (sc.every.unit === 'week') n.setUTCDate(n.getUTCDate() + 7 * sc.every.n); else if (sc.every.unit === 'month') n.setUTCMonth(n.getUTCMonth() + sc.every.n); else n.setUTCFullYear(n.getUTCFullYear() + sc.every.n); return n; };
    const fromIso = first.toISOString().slice(0, 10), toIso = last.toISOString().slice(0, 10);
    d.schedules.filter((s) => s.status === 'active').forEach((sc) => { if (C.runsOnMeter(sc)) { const gap = Math.max(1, sc.meter.hours) / RUN_RATE * 1440; const per = {}; let m = now() + hoursLeft(sc) / RUN_RATE * 1440; const lo = Math.round((first.getTime() - 330 * 60000 - BASE) / 60000); if (m < lo) m += Math.ceil((lo - m) / gap) * gap; for (let g = 0; g < 800 && istAt(m).date <= toIso; g++, m += gap) { const day = istAt(m).date; if (day >= fromIso) per[day] = (per[day] || 0) + 1; } Object.entries(per).forEach(([date, n]) => out.push({ sc, date, est: true, ...(n > 1 ? { perDay: n } : {}) })); return; }
      if (hourly(sc)) { const H = Math.max(1, sc.every.n) * 60; const lo = Math.round((first.getTime() - 330 * 60000 - BASE) / 60000), hi = Math.round((last.getTime() + 86400000 - 330 * 60000 - BASE) / 60000); let m = dueMin(sc); if (m < lo) m += Math.ceil((lo - m) / H) * H; const per = {}; for (let g = 0; m < hi && g < 800; g++, m += H) { const at = istAt(m); (per[at.date] = per[at.date] || []).push(at.at); } Object.entries(per).forEach(([date, times]) => out.push({ sc, date, est: false, perDay: times.length, times })); return; } let t = new Date(Date.parse(sc.nextDue + 'T00:00:00Z')); let guard = 0;
      while (t < first && guard++ < 400) t = step(t, sc); while (t <= last && guard++ < 400) { out.push({ sc, date: t.toISOString().slice(0, 10), est: false }); t = step(t, sc); } });
    return out;
  }
  const hoursPlanned = (plan) => plan.reduce((n, x) => n + (x.sc.hours || 0) * (x.perDay || 1), 0);
  const planCount = (plan) => plan.reduce((n, x) => n + (x.perDay || 1), 0);  /* occurrences, counting each time of a job due every few hours */

  /* ── seed: a plant that is already running when you arrive ─────────────────────────────── */
  function seedRuntime(key) {
    const d = D(); d.rt = { records: [], messages: [], offset: 0 }; d.alerts.forEach((a) => { a.open = 0; }); d.schedules.forEach((s) => { s.open = 0; }); d.conditionWork.forEach((w) => { w.open = 0; });
    if (key === 'manesar') {
      /* the sample's September due dates are behind the clock: move them on, keep three due */
      d.schedules.forEach((s) => { if (dateMin(s.nextDue) < 0 && !['s_logbook', 's_mbr_cip', 's_sample'].includes(s.id)) moveOn(s); });
      /* the seeded records name their alert and schedules by id; one the sample no longer has is skipped, never a crash */
      const r1 = alertById('a_bl1_amps') ? fireAlert('a_bl1_amps', 49) : {}; if (r1.opened) { r1.opened.openedAt = -45; r1.opened.log[0].at = -45; rt().messages.filter((m) => m.recordId === r1.opened.id).forEach((m) => { m.at = -45; }); }
      const t1 = schedById('s_logbook') ? dueTask('s_logbook', -180) : null; const t2 = schedById('s_mbr_cip') ? dueTask('s_mbr_cip', -2 * 1440) : null;
      if (t2) { startRecord(t2, 'Nagesh Patil'); t2.startedAt = -1440; t2.run.stepIdx = 2; log(t2, 'Isolate the skid and drain the membrane tank: done'); log(t2, 'Prepare 500 ppm hypochlorite solution: done · photo'); }
      if (t1) rt().messages.filter((m) => m.recordId === t1.id).forEach((m) => { m.at = -180; }); if (t2) rt().messages.filter((m) => m.recordId === t2.id).forEach((m) => { m.at = -2 * 1440; });
      const mlss = sensor('at1_mlss'); if (mlss) mlss.state = 'stale';
    }
    tick(0);
  }

  return { BASE, rt, now, fmtClock, fmtAgo, fmtLeft, dateMin, minuteOfDay, SEV_RANK, channelOf, inQuiet, send, tell, fireAlert, dueTask, dueWork, tick, startRecord, curStep, boundSensor, answer, conclude, knowReason, notThat, finish, verify, closeRecord, sensorFault, sensorWrong, trustAgain, setMaintenance, clearMaintenance, reportProblem, reportIssue, openTask, leaveTask, taskOfStep, linksOf, dueMin, dueKey, moveOn, planCount, alertsOn, isOverdue, lateBy, band, rank, openRecords, onMachine, cardCTA, upcoming, readingState, gateOk, gateText, crossedSev, complianceOf, coverage, planningWarnings, contracts, monthPlan, hoursPlanned, seedRuntime };
})();
