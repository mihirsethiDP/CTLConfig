/* What's enabled: the read-only page for the plant team and the client, derived from the plant's configuration.
   Per unit process in flow order: what is watched, what runs, what is not enabled yet. Registered as the 'enabled'
   view; everything on it follows the Config tab. Clicks are bound in wire('enabled') when a later phase needs them. */
window.CTL_ENABLED = (function () {
  'use strict';
  const C = window.CTL, V = window.CTL_VIEWS;
  const { esc, plural, D, subjectKey } = C;

  const isOn = (x) => x.status === 'active';
  /* alerts and schedules filed on one subject ('plant', 'stage:<id>', 'eq:<id>'), active only */
  const counts = (d, key) => ({ al: d.alerts.filter((a) => isOn(a) && subjectKey(a.subject) === key).length, sc: d.schedules.filter((s) => isOn(s) && subjectKey(s.subject) === key).length });
  const said = (c, word) => (!c.al && !c.sc) ? '<span class="muted">nothing enabled yet</span>' : [c.al ? `watched by ${plural(c.al, 'alert')}` : '', c.sc ? `${plural(c.sc, word)} run` : ''].filter(Boolean).join(' · ');

  function enabled(rest) {
    const d = D(); const name = d.plant.name || 'New plant';
    const head = `<div class="pagehead"><div class="grow"><h1>What's enabled at ${esc(name)}</h1><p class="lede">What this plant watches and the work it runs, as the plant team sees it. Change anything on the Config tab.</p></div></div>`;
    if (!d.stages.length) return head + `<div class="card"><div class="empty2" style="padding:28px"><b>Nothing enabled yet</b><p>Connect SCADA on the Config tab. What the plant watches and runs appears here as it is set up.</p><a class="btn sm primary" href="#/setup/scada">Connect SCADA</a></div></div>`;
    const focus = rest[0] && rest[0].startsWith('stage:') ? rest[0].slice(6) : null;
    const nAl = d.alerts.filter(isOn).length, nSc = d.schedules.filter(isOn).length;
    const quiet = d.equipment.filter((e) => { const c = counts(d, 'eq:' + e.id); return !c.al && !c.sc; });
    const top = `<div class="covline"><div class="kpi"><div class="v">${nAl}</div><div class="l">alerts watching</div></div><div class="kpi"><div class="v">${nSc}</div><div class="l">schedules and rounds running</div></div><div class="kpi"><div class="v">${quiet.length} <span class="muted" style="font-size:14px">of ${d.equipment.length}</span></div><div class="l">machines with nothing enabled yet</div></div></div>`;
    const row = (e) => { const c = counts(d, 'eq:' + e.id); return `<div class="wfrow" data-enabled-eq="${esc(e.id)}"><div class="wfl"><b>${esc(e.name)}</b> <span class="mono small muted">${esc(e.tag)}</span> <span class="small muted">· ${esc(e.unmapped || !e.type ? 'not in the library' : e.type)}</span></div><div class="wfr"><span class="small">${said(c, 'schedule')}</span></div></div>`; };
    const pc = counts(d, 'plant');
    const plantBlock = `<div class="fs" data-enabled="plant"><div class="t">The plant as a whole <span class="hint">${esc(d.plant.type || '')}</span></div><div class="small">${said(pc, 'round')}</div></div>`;
    const blocks = d.stages.map((st) => { const eqs = d.equipment.filter((e) => e.stage === st.id); const c = counts(d, 'stage:' + st.id); return `<div class="fs ${focus === st.id ? 'cur' : ''}" data-enabled="stage:${esc(st.id)}"><div class="t">${esc(st.name)} <span class="hint">${plural(eqs.length, 'machine')}</span></div><div class="small" style="margin-bottom:6px">The unit process as a whole · ${said(c, 'round')}</div>${eqs.map(row).join('') || '<div class="small muted">No machines in this unit process.</div>'}</div>`; }).join('');
    return head + top + plantBlock + blocks;
  }

  function wire(view) { if (view === 'enabled') { /* read-only for now: nothing to bind; row clicks come in a later phase */ } }
  V.enabled = enabled;
  const baseWire = V.wire; V.wire = function (view, rest) { baseWire(view, rest); wire(view, rest); };
  return { enabled };
})();
