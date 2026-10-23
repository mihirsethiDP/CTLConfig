/* What's enabled: the read-only page for the plant team and the client. Everything here is derived from the plant's
   own data (alerts, schedules, condition jobs, milestones, people) and from what the standard for each type offers;
   nothing is edited here. Registered as the 'enabled' view (#/enabled, #/enabled/stage:<id>, #/enabled/eq:<id>). */
window.CTL_EN = (function () {
  'use strict';
  const C = window.CTL, V = window.CTL_VIEWS;
  const { S, $$, esc, plural, SEVS, SEV_LABEL, D, stage, sensor, sensorHome, sensorsOf, limitsOfAlert, entrySeverity, every, gaps, eqInheritItems, inheritance, profileById, plantProfile, plantRoundDone, upRoundDone } = C;

  const act = (x) => x.status === 'active';
  const isProcess = (s) => s.kind !== 'meter' && s.kind !== 'status';
  const hasLimits = (s) => !!(s.limits && SEVS.some((k) => s.limits[k] != null));
  /* 'a' or 'an' before a type name; spelt-out acronyms (MBBR, RO) take 'an' when the first letter is said with a vowel. */
  const an = (t) => { const w = String(t || '').split(' ')[0]; if (/^[A-Z]{2,}$/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? 'an' : 'a'; return /^[aeio]/i.test(w) || /^u[a-z]/i.test(w) ? 'an' : 'a'; };
  const std = (type) => `the standard for ${an(type)} ${esc(type)}`;

  /* ── one line per item, plain words ─────────────────────────── */
  const alertLine = (a) => { const s = sensor(a.sensor); if (!s) return esc(a.name); const { lim, dir } = limitsOfAlert(a); const entry = entrySeverity(lim); const how = s.kind === 'status' ? 'when the contact is ON' : entry ? `${dir === 'below' ? 'below' : 'above'} ${lim[entry]}${s.unit ? ' ' + esc(s.unit) : ''}` : 'no limits yet'; return `${esc(s.name)} · ${how}${entry ? ` <span class="sev ${entry}">${SEV_LABEL[entry]}</span>` : ''}`; };
  const schedLine = (sc) => `${esc(sc.name)} · ${esc(every(sc))}${sc.statutory ? ' · statutory' : ''}${sc.performedBy === 'vendor' ? ' · by a vendor' : ''}`;
  const workLine = (w) => { const s = sensor(w.sensor); return `${esc(w.name)} · when ${s ? esc(s.name) : 'the reading'} passes ${w.doWhen}${s && s.unit ? ' ' + esc(s.unit) : ''}${w.performedBy === 'vendor' ? ' · by a vendor' : ''}`; };
  const offLines = (items) => items.filter((x) => x.status === 'paused' || x.status === 'off' || x.status === 'draft').map((x) => `${esc(x.name)}: ${x.status === 'paused' ? 'paused' : x.status === 'off' ? 'switched off' : 'still a draft'}`);

  /* ── the derived model, computed once per render ─────────────── */
  function machine(e, d) {
    const sens = sensorsOf({ kind: 'eq', id: e.id });
    const mine = d.alerts.filter((a) => (a.subject.kind === 'eq' && a.subject.id === e.id) || sens.some((s) => s.id === a.sensor));
    const sched = d.schedules.filter((s) => s.subject.kind === 'eq' && s.subject.id === e.id);
    const work = d.conditionWork.filter((w) => w.subject.kind === 'eq' && w.subject.id === e.id);
    const typed = !!e.type && !e.unmapped; const it = typed ? eqInheritItems(e) : null; const inh = typed ? inheritance(e) : null;
    const watched = mine.filter(act).map(alertLine);
    const planned = [...sched.filter(act).map(schedLine), ...work.filter(act).map(workLine)];
    const no = [];
    if (!typed) no.push('no type chosen, so nothing is inherited');
    else if (!it) no.push(`no standard for ${an(e.type)} ${esc(e.type)} yet`);
    else {
      it.items.filter((i) => i.ok && !i.done).forEach((i) => no.push(`${std(e.type)} also has ${esc(i.name)}: not switched on yet`));
      [...inh.alerts, ...inh.schedules].filter((x) => !x.ok).forEach((x) => no.push(`${esc(x.name)} needs a ${esc(x.sensorKind)} sensor that SCADA does not have`));
    }
    mine.filter((a) => a.status === 'draft').forEach((a) => no.push(`${esc(a.name)} has no limits yet`));
    mine.filter((a) => a.status === 'off').forEach((a) => no.push(`${esc(a.name)}: switched off`));
    no.push(...offLines(sched), ...offLines(work));
    const offeredKinds = it && inh ? inh.alerts.filter((a) => a.ok && it.items.some((i) => i.kind === 'alert' && i.name === a.name && !i.done)).map((a) => a.sensorKind) : [];
    sens.filter((s) => isProcess(s) && !hasLimits(s) && !mine.some((a) => a.sensor === s.id) && !offeredKinds.includes(s.name)).forEach((s) => no.push(`the ${esc(s.name)} reading has no limits`));
    const covered = !!it && it.pending === 0 && it.blocked === 0;
    return { e, watched, planned, no, covered, alerts: mine.filter(act), scheds: [...sched.filter(act), ...work.filter(act)] };
  }
  function unitProcess(st, d, machines) {
    const own = { alerts: d.alerts.filter((a) => a.subject.kind === 'stage' && a.subject.id === st.id), scheds: d.schedules.filter((s) => s.subject.kind === 'stage' && s.subject.id === st.id) };
    const p = profileById(st.profile);
    const no = [...own.alerts.filter((a) => a.status === 'draft').map((a) => `${esc(a.name)} has no limits yet`), ...own.alerts.filter((a) => a.status === 'off').map((a) => `${esc(a.name)}: switched off`), ...offLines(own.scheds)];
    if (p) p.rounds.filter((r) => !upRoundDone(st, r)).forEach((r) => no.push(`the standard for ${esc(p.name)} also has ${esc(r.name)}: not switched on yet`));
    else if (st.scadaZone) no.push('not matched to a unit process yet, so no rounds come from the standard');
    const alertIds = new Set([...own.alerts.filter(act), ...machines.flatMap((m) => m.alerts)].map((a) => a.id));
    const nSched = own.scheds.filter(act).length + machines.reduce((n, m) => n + m.scheds.length, 0);
    return { st, machines, watched: own.alerts.filter(act).map(alertLine), rounds: own.scheds.filter(act).map(schedLine), no, nAlerts: alertIds.size, nSched };
  }
  function plantWide(d) {
    const rounds = d.schedules.filter((s) => s.subject.kind === 'plant');
    const prof = plantProfile(); const pt = d.plant.type; const pstd = pt ? `the standard for ${an(pt)} ${esc(pt)} plant` : 'the plant standard';
    const no = offLines(rounds);
    if (d.plant.name) { prof.rounds.filter((r) => !plantRoundDone(r)).forEach((r) => no.push(`${pstd} also has ${esc(r.name)}: not switched on yet`)); prof.milestones.filter((m) => !d.milestones.some((x) => x.name === m)).forEach((m) => no.push(`${pstd} also has the milestone ${esc(m)}: not switched on yet`)); }
    return { rounds: rounds.filter(act).map(schedLine), milestones: d.milestones.filter((m) => m.status !== 'off').map((m) => esc(m.name)), no };
  }
  function model() {
    const d = D(), g = gaps();
    const machines = d.equipment.map((e) => machine(e, d));
    const ups = d.stages.map((st) => unitProcess(st, d, machines.filter((m) => m.e.stage === st.id)));
    const plant = plantWide(d);
    const notEnabled = plant.no.length + ups.reduce((n, u) => n + u.no.length + u.machines.reduce((k, m) => k + m.no.length, 0), 0);
    return { d, g, machines, ups, plant, alertsWatching: d.alerts.filter(act).length, running: d.schedules.filter(act).length + d.conditionWork.filter(act).length, covered: machines.filter((m) => m.covered).length, notEnabled };
  }
  /* The tile counts, for the export and for other pages. */
  function enabledSummary(plantId) { const run = () => { const m = model(); return { plant: m.d.plant.name || 'New plant', alertsWatching: m.alertsWatching, running: m.running, machinesCovered: m.covered, machines: m.machines.length, notEnabled: m.notEnabled, routingOk: m.g.routingOk }; }; return plantId && plantId !== S.plant && S.plants[plantId] ? C.withPlant(plantId, run) : run(); }

  /* ── the page ───────────────────────────────────────────────── */
  const list = (label, items, cls) => items.length ? `<div${cls ? ` class="${cls}"` : ''}><b>${label}</b><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></div>` : '';
  const kpi = (v, l) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  function card(m) {
    const e = m.e; const lists = list('Watched for', m.watched) + list('Planned work', m.planned) + list('Not enabled yet', m.no, 'no');
    const head = `<div class="enh"><span>${esc(e.name)}</span><span class="mono muted">${esc(e.tag)}</span>${e.type && !e.unmapped ? `<span class="muted">· ${esc(e.type)}</span>` : '<span class="warnink">· no type yet</span>'}${e.duty === 'standby' ? '<span class="chip">standby</span>' : e.duty ? '<span class="chip">duty</span>' : ''}${e.remote ? '<span class="chip teal">remote control</span>' : ''}</div>`;
    return `<div class="encard" id="en-${esc(e.id)}">${head}${lists ? `<div class="enl">${lists}</div>` : '<div class="ennone">nothing enabled yet</div>'}</div>`;
  }
  function block(u, view) {
    const st = u.st; const cards = u.machines.filter((m) => view === 'all' || m.no.length);
    const own = list('Watched for', u.watched) + list('Rounds', u.rounds) + list('Not enabled yet', u.no, 'no');
    if (view === 'not' && !cards.length && !u.no.length) return '';
    const zone = st.scadaZone && st.scadaZone !== st.name ? `<span class="muted small">${esc(st.scadaZone)}</span>` : '';
    const chips = `<span class="chip">${plural(u.machines.length, 'machine')}</span><span class="chip">${plural(u.nAlerts, 'alert')}</span><span class="chip">${plural(u.nSched, 'schedule')}</span>`;
    return `<div class="fs enup" id="en-${esc(st.id)}"><div class="t">${esc(st.name)}${zone}${chips}</div>${own ? `<div class="enl enown">${own}</div>` : ''}${cards.map(card).join('') || (view === 'all' ? '<div class="ennone">no machines in this unit process</div>' : '')}</div>`;
  }
  function enabled(rest) {
    const m = model(); const d = m.d, g = m.g; const view = S.enView === 'not' ? 'not' : 'all'; const name = d.plant.name || 'the plant';
    const head = `<div class="pagehead"><div class="grow"><h1>What's enabled at ${esc(name)}</h1><p class="lede">What this plant watches, the work it runs, and what is not switched on yet. Change anything on the <a href="#/setup">Config tab</a>.</p></div></div>`;
    if (!d.stages.length && !d.equipment.length) return `${head}<div class="card"><div class="empty2"><b>Nothing is connected yet</b><p>Once SCADA is connected on the Config tab, this page shows what the plant watches and the work it runs.</p><a class="btn sm primary" href="#/setup/scada">Connect SCADA</a></div></div>`;
    const tiles = `<div class="kpis enkpis">${kpi(m.alertsWatching, 'alerts watching')}${kpi(m.running, 'schedules and rounds running')}${kpi(`${m.covered} <span class="of">of ${m.machines.length}</span>`, 'machines fully covered')}${kpi(m.notEnabled, 'not enabled yet')}</div>`;
    const reach = g.routingOk ? `<p class="enreach">Alerts reach ${esc(C.first(g.reachOps))} first, then ${esc(C.first(g.reachLeads))}.</p>` : `<p class="enreach warnink">Nobody can be reached yet: <a href="#/setup/people">add people on the Config tab</a>.</p>`;
    const filter = `<div class="enbar"><div class="seg" id="enFilter"><button data-v="all" aria-pressed="${view === 'all'}">Everything</button><button data-v="not" aria-pressed="${view === 'not'}">Not enabled yet<span class="cnt">${m.notEnabled}</span></button></div></div>`;
    /* #/enabled/stage:<id> or #/enabled/eq:<id> shows that unit process only. */
    const key = rest && rest[0] ? decodeURIComponent(rest[0]) : ''; const focusId = key.startsWith('stage:') ? key.slice(6) : key.startsWith('eq:') ? (d.equipment.find((e) => e.id === key.slice(3)) || {}).stage : null; const focus = focusId ? stage(focusId) : null;
    const ups = (focus ? m.ups.filter((u) => u.st.id === focus.id) : m.ups).map((u) => block(u, view)).join('');
    const pw = (() => { if (focus) return ''; const p = m.plant; const lists = list('Rounds', p.rounds) + list('Milestones', p.milestones) + list('Not enabled yet', p.no, 'no'); if (view === 'not' && !p.no.length) return ''; return `<div class="fs enup"><div class="t">Plant-wide<span class="hint">rounds and milestones that count against no machine</span></div>${lists ? `<div class="enl enown">${lists}</div>` : '<div class="ennone">nothing plant-wide yet</div>'}</div>`; })();
    const note = focus ? `<p class="enfocus">Showing <b>${esc(focus.name)}</b> only · <a href="#/enabled">every unit process</a></p>` : '';
    const empty = view === 'not' && !ups && !pw ? '<div class="health ok"><div class="ic">✓</div><div><b>Everything the standard offers is switched on</b><p>Nothing is waiting at this plant.</p></div></div>' : '';
    return `<div class="enwrap">${head}${tiles}${reach}${filter}${note}${pw}${ups}${empty}<p class="h enfoot">Read-only. The <a href="#/setup">Config tab</a> is where this is set.</p></div>`;
  }
  function wire(view) { if (view === 'enabled') C.segWire(document, 'enFilter', (v) => { S.enView = v; C.render(); }); }
  V.enabled = enabled;
  const baseWire = V.wire; V.wire = function (view, rest) { baseWire(view, rest); wire(view); };
  return { enabled, enabledSummary };
})();
